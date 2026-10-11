package com.tmxmapforge.offline

import android.Manifest
import android.annotation.SuppressLint
import android.content.ContentValues
import android.content.Intent
import android.content.pm.ApplicationInfo
import android.content.pm.PackageManager
import android.graphics.Color
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.os.Environment
import android.os.SystemClock
import android.provider.MediaStore
import android.util.Log
import android.view.ViewGroup
import android.webkit.ConsoleMessage
import android.webkit.JavascriptInterface
import android.webkit.RenderProcessGoneDetail
import android.webkit.ValueCallback
import android.webkit.WebChromeClient
import android.webkit.WebResourceRequest
import android.webkit.WebView
import android.widget.FrameLayout
import android.widget.Toast
import androidx.activity.ComponentActivity
import androidx.activity.OnBackPressedCallback
import androidx.activity.result.contract.ActivityResultContracts
import androidx.annotation.RequiresApi
import androidx.core.content.ContextCompat
import androidx.core.view.ViewCompat
import androidx.core.view.WindowCompat
import androidx.core.view.WindowInsetsCompat
import androidx.core.view.WindowInsetsControllerCompat
import androidx.webkit.WebViewAssetLoader
import androidx.webkit.WebViewClientCompat
import org.json.JSONObject
import java.io.File
import java.io.FileOutputStream
import java.util.UUID
import java.util.concurrent.ConcurrentHashMap

/**
 * TMX MapForge Offline 3.5.0
 *
 * 3.5.0：新增 PC 版（仓库 desktop/ 目录，Rust + Tauri 2），与本 App 共用 assets 前端。
 *  本文件无逻辑改动；assets 中新增的 desktop-bridge.js 在 Android 上为空操作。
 *  PC 宿主 desktop/src/main.rs 与本类的职责一一对应（见该文件头部对照表）。
 *
 * 3.4.0：
 *  小地图 PNG 与槽位整理均在网页层完成；原生层修复：
 *  - 导出文件名去掉首尾的点号与空格（Android 文件系统 / MediaStore 会拒绝或改名，导致 TMX 与 _map.png 名称不再成对）。
 *
 * 3.3.0：
 *  - 出生点槽位映射修复在网页层（app.js buildCcMap / patchTmxUnits），原生层无需改动。
 *  - 新增 onTrimMemory：系统内存告急（大地图常见）时提前触发网页自动保存，
 *    降低随后渲染进程被回收时丢失编辑的概率（旧版只在 onPause 保存）。
 *
 * 3.2.0 修复：
 *  1. Android 9 及以下未授予存储权限时，「导出 TMX+小地图」会连续产生两个待保存文件；旧实现用单个
 *     pendingLegacy 字段保存，第二个文件会把第一个的临时文件删除并覆盖，最终只剩小地图、TMX 丢失，
 *     而且会重复弹出两次权限请求。现改为队列：只申请一次权限，授权后按顺序全部写入。
 *  2. 异步保存（等待权限）的最终结果旧版只弹系统 Toast，网页永远以为“等待中”。现通过
 *     window.__onNativeSaveResult(ok, msg) 回传给网页，由网页统一提示。
 *  3. WebView 渲染进程被系统杀死（大地图内存不足）时，旧版未处理 onRenderProcessGone，整个 App 直接闪退。
 *     现在会销毁并重建 WebView，带 ?recovered=1 重新加载，网页提示用户一键恢复自动保存的草稿；
 *     60 秒内连续崩溃 3 次以上才退出，避免死循环。
 *  4. 声明 largeHeap，降低分块 Base64 解码时 Java 堆 OOM 的概率。
 *
 * 3.1.0 已有：文件选择器、分块保存桥接、边到边 Insets、返回键交给网页、系统栏随主题同步等。
 */
class MainActivity : ComponentActivity() {
    private lateinit var web: WebView
    private lateinit var root: FrameLayout
    private lateinit var loader: WebViewAssetLoader

    private var fileCallback: ValueCallback<Array<Uri>>? = null

    private data class PendingLegacy(val temp: File, val filename: String)
    private class SaveSession(val file: File, val stream: FileOutputStream, val filename: String, val mime: String)

    private val sessions = ConcurrentHashMap<String, SaveSession>()

    /** 等待存储权限的保存任务队列（JS 桥线程写入、主线程消费，统一用 pendingLock 同步） */
    private val pendingLock = Any()
    private val pendingLegacy = ArrayList<PendingLegacy>()
    private var permissionInFlight = false

    private val rendererCrashes = ArrayList<Long>()
    private var systemBarColor = DEFAULT_BG

    private val storagePermission =
        registerForActivityResult(ActivityResultContracts.RequestPermission()) { granted ->
            val jobs = synchronized(pendingLock) {
                permissionInFlight = false
                val copy = ArrayList(pendingLegacy)
                pendingLegacy.clear()
                copy
            }
            if (jobs.isEmpty()) return@registerForActivityResult
            if (granted) {
                Thread {
                    jobs.forEach { job ->
                        val result = runCatching { copyToLegacyDownloads(job.temp, job.filename) }
                        job.temp.delete()
                        result.onSuccess { notifyWeb(true, it) }
                            .onFailure { notifyWeb(false, "${job.filename}：${it.message ?: "写入失败"}") }
                    }
                }.start()
            } else {
                jobs.forEach { it.temp.delete() }
                notifyWeb(false, "未授予存储权限，${jobs.size} 个文件未保存")
            }
        }

    private val fileChooser =
        registerForActivityResult(ActivityResultContracts.StartActivityForResult()) { result ->
            val cb = fileCallback
            fileCallback = null
            cb?.onReceiveValue(WebChromeClient.FileChooserParams.parseResult(result.resultCode, result.data))
        }

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        WindowCompat.setDecorFitsSystemWindows(window, false)
        cleanupExportCache()

        if (applicationInfo.flags and ApplicationInfo.FLAG_DEBUGGABLE != 0) {
            WebView.setWebContentsDebuggingEnabled(true)
        }

        loader = WebViewAssetLoader.Builder()
            .addPathHandler("/assets/", WebViewAssetLoader.AssetsPathHandler(this))
            .build()

        root = FrameLayout(this).apply { setBackgroundColor(Color.parseColor(DEFAULT_BG)) }
        setContentView(root)
        web = createWebView()

        // 系统栏 / 刘海 / 输入法内边距：Android 15 强制边到边后顶栏不再被状态栏遮挡
        ViewCompat.setOnApplyWindowInsetsListener(root) { v, insets ->
            val bars = insets.getInsets(WindowInsetsCompat.Type.systemBars() or WindowInsetsCompat.Type.displayCutout())
            val ime = insets.getInsets(WindowInsetsCompat.Type.ime())
            v.setPadding(bars.left, bars.top, bars.right, maxOf(bars.bottom, ime.bottom))
            WindowInsetsCompat.CONSUMED
        }
        applySystemBars(DEFAULT_BG, false)

        onBackPressedDispatcher.addCallback(this, object : OnBackPressedCallback(true) {
            override fun handleOnBackPressed() {
                if (!::web.isInitialized) { finishFromBack(this); return }
                web.evaluateJavascript("(function(){try{return !!(window.__onAndroidBack&&window.__onAndroidBack());}catch(e){return false;}})()") { value ->
                    if (value != "true") finishFromBack(this)
                }
            }
        })

        if (savedInstanceState != null) web.restoreState(savedInstanceState)
        if (web.url == null) web.loadUrl(START_URL)
    }

    /** 创建并挂载 WebView（启动时与渲染进程崩溃后重建时共用） */
    @SuppressLint("SetJavaScriptEnabled")
    private fun createWebView(): WebView {
        val w = WebView(this)
        w.settings.apply {
            javaScriptEnabled = true
            domStorageEnabled = true
            allowFileAccess = false
            // 文件选择器返回 content:// URI，需允许内容访问；页面本身被限制只能加载本地资源
            allowContentAccess = true
            setSupportZoom(false)
            builtInZoomControls = false
            displayZoomControls = false
            loadWithOverviewMode = true
            useWideViewPort = true
            textZoom = 100
        }
        w.isVerticalScrollBarEnabled = false
        w.isHorizontalScrollBarEnabled = false
        w.overScrollMode = WebView.OVER_SCROLL_NEVER
        w.setBackgroundColor(runCatching { Color.parseColor(systemBarColor) }.getOrDefault(Color.parseColor(DEFAULT_BG)))

        w.webViewClient = object : WebViewClientCompat() {
            override fun shouldInterceptRequest(view: WebView, request: WebResourceRequest) =
                loader.shouldInterceptRequest(request.url)

            @Deprecated("Deprecated in API")
            override fun shouldInterceptRequest(view: WebView, url: String) =
                loader.shouldInterceptRequest(Uri.parse(url))

            override fun shouldOverrideUrlLoading(view: WebView, request: WebResourceRequest): Boolean {
                // 只允许停留在本地资源域；其他链接一律拦截（App 为完全离线）
                return request.url.host != ASSET_HOST
            }

            @RequiresApi(Build.VERSION_CODES.O)
            override fun onRenderProcessGone(view: WebView, detail: RenderProcessGoneDetail): Boolean {
                Log.e(TAG, "WebView renderer gone, crashed=${detail.didCrash()}")
                recoverFromRendererCrash(view)
                return true // 已处理，系统不会因此杀死整个 App
            }
        }
        w.webChromeClient = object : WebChromeClient() {
            override fun onShowFileChooser(
                webView: WebView,
                filePathCallback: ValueCallback<Array<Uri>>,
                fileChooserParams: FileChooserParams
            ): Boolean {
                fileCallback?.onReceiveValue(null)
                fileCallback = filePathCallback
                val accepts = fileChooserParams.acceptTypes.orEmpty().map { it.trim() }.filter { it.isNotEmpty() }
                val imageOnly = accepts.isNotEmpty() && accepts.all { it.startsWith("image/") }
                val intent = Intent(Intent.ACTION_OPEN_DOCUMENT).apply {
                    addCategory(Intent.CATEGORY_OPENABLE)
                    // .tmx/.json 不是标准 MIME，过滤会让系统选择器什么都选不了，因此非图片一律用 */*
                    type = if (imageOnly) "image/*" else "*/*"
                }
                return try {
                    fileChooser.launch(Intent.createChooser(intent, if (imageOnly) "选择地形图片" else "选择 TMX / 项目文件"))
                    true
                } catch (e: Exception) {
                    fileCallback = null
                    toast("无法打开文件选择器：${e.message}")
                    false
                }
            }

            override fun onConsoleMessage(consoleMessage: ConsoleMessage): Boolean {
                Log.d(TAG, "[web] ${consoleMessage.message()} @${consoleMessage.sourceId()}:${consoleMessage.lineNumber()}")
                return true
            }
        }
        w.addJavascriptInterface(AndroidBridge(), "AndroidBridge")
        root.addView(w, FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT))
        return w
    }

    private fun recoverFromRendererCrash(dead: WebView) {
        val now = SystemClock.elapsedRealtime()
        rendererCrashes.removeAll { now - it > 60_000 }
        rendererCrashes.add(now)
        (dead.parent as? ViewGroup)?.removeView(dead)
        runCatching { dead.destroy() }
        fileCallback?.onReceiveValue(null)
        fileCallback = null
        sessions.values.forEach { runCatching { it.stream.close() }; it.file.delete() }
        sessions.clear()
        if (rendererCrashes.size > 3) {
            toast("页面连续崩溃，请尝试减小地图尺寸后重新打开应用")
            finish()
            return
        }
        toast("页面因内存不足被系统回收，正在恢复…")
        web = createWebView()
        web.loadUrl("$START_URL?recovered=1")
    }

    private fun finishFromBack(cb: OnBackPressedCallback) {
        cb.isEnabled = false
        onBackPressedDispatcher.onBackPressed()
        cb.isEnabled = true
    }

    /** 把异步保存结果回传给网页；网页未加载回调时退化为系统 Toast */
    private fun notifyWeb(ok: Boolean, message: String) {
        runOnUiThread {
            if (!::web.isInitialized) { toast(if (ok) "已保存到下载目录：$message" else "保存失败：$message"); return@runOnUiThread }
            val js = "(function(){if(window.__onNativeSaveResult){window.__onNativeSaveResult($ok,${JSONObject.quote(message)});return true;}return false;})()"
            web.evaluateJavascript(js) { handled ->
                if (handled != "true") toast(if (ok) "已保存到下载目录：$message" else "保存失败：$message")
            }
        }
    }

    inner class AndroidBridge {
        /** 兼容旧接口：一次性传入整个文件的 Base64（小文件可用） */
        @JavascriptInterface
        fun saveBase64File(base64: String, filename: String, mime: String): String {
            return try {
                val id = beginSave(filename, mime)
                if (id.isEmpty() || !appendChunk(id, base64)) return "error:写入失败"
                val r = finishSave(id)
                when {
                    r.startsWith("ok:") -> toast("已保存到下载目录：${r.removePrefix("ok:")}")
                    r.startsWith("error:") -> toast("保存失败：${r.removePrefix("error:")}")
                }
                r
            } catch (e: Exception) {
                toast("保存失败：${e.message}")
                "error:${e.message}"
            }
        }

        /** 分块保存：开始。返回会话 id，失败返回空串 */
        @JavascriptInterface
        fun beginSave(filename: String, mime: String): String {
            return try {
                val dir = File(cacheDir, "exports").apply { mkdirs() }
                val id = UUID.randomUUID().toString()
                val f = File(dir, id)
                sessions[id] = SaveSession(f, FileOutputStream(f), safeName(filename), mime.ifBlank { "application/octet-stream" })
                id
            } catch (e: Exception) {
                Log.e(TAG, "beginSave", e)
                ""
            }
        }

        /** 分块保存：追加一块 Base64（每块由 3 的倍数字节编码而来，可独立解码） */
        @JavascriptInterface
        fun appendChunk(id: String, base64: String): Boolean {
            val s = sessions[id] ?: return false
            return try {
                s.stream.write(decodeBase64(base64))
                true
            } catch (e: Exception) {
                Log.e(TAG, "appendChunk", e)
                false
            }
        }

        /** 分块保存：完成。返回 "ok:<文件名>" / "pending"（等待存储权限，结果稍后经 __onNativeSaveResult 回传）/ "error:<原因>" */
        @JavascriptInterface
        fun finishSave(id: String): String {
            val s = sessions.remove(id) ?: return "error:会话不存在"
            return try {
                s.stream.close()
                if (Build.VERSION.SDK_INT >= 29) {
                    val name = copyToMediaStore(s.file, s.filename, s.mime)
                    s.file.delete()
                    "ok:$name"
                } else if (hasStoragePermission()) {
                    val name = copyToLegacyDownloads(s.file, s.filename)
                    s.file.delete()
                    "ok:$name"
                } else {
                    // 3.2.0：排队等待，只发起一次权限请求（旧版第二个文件会删除并覆盖第一个）
                    val launch = synchronized(pendingLock) {
                        pendingLegacy.add(PendingLegacy(s.file, s.filename))
                        if (!permissionInFlight) { permissionInFlight = true; true } else false
                    }
                    if (launch) runOnUiThread { storagePermission.launch(Manifest.permission.WRITE_EXTERNAL_STORAGE) }
                    "pending"
                }
            } catch (e: Exception) {
                Log.e(TAG, "finishSave", e)
                s.file.delete()
                "error:${e.message ?: "未知错误"}"
            }
        }

        @JavascriptInterface
        fun abortSave(id: String) {
            sessions.remove(id)?.let { runCatching { it.stream.close() }; it.file.delete() }
        }

        /** 地图生成期间保持屏幕常亮 */
        @JavascriptInterface
        fun setKeepScreenOn(on: Boolean) {
            runOnUiThread { if (::web.isInitialized) web.keepScreenOn = on }
        }

        /** 随网页主题同步系统栏背景色与图标明暗 */
        @JavascriptInterface
        fun setSystemBars(color: String, lightIcons: Boolean) {
            runOnUiThread { applySystemBars(color, lightIcons) }
        }
    }

    @Suppress("DEPRECATION")
    private fun applySystemBars(color: String, lightIcons: Boolean) {
        val parsed = runCatching { Color.parseColor(color) }.getOrNull()
        val c = parsed ?: Color.parseColor(DEFAULT_BG)
        systemBarColor = if (parsed != null) color else DEFAULT_BG
        if (::root.isInitialized) root.setBackgroundColor(c)
        if (Build.VERSION.SDK_INT < 35) {
            window.statusBarColor = Color.TRANSPARENT
            window.navigationBarColor = c
        }
        WindowInsetsControllerCompat(window, window.decorView).apply {
            isAppearanceLightStatusBars = lightIcons
            isAppearanceLightNavigationBars = lightIcons
        }
    }

    private fun safeName(name: String): String {
        val cleaned = name.replace(Regex("[\\\\/:*?\"<>|\\u0000-\\u001f]"), "_").replace("..", "_").trim().trim('.', ' ')
        return cleaned.ifEmpty { "export_${System.currentTimeMillis()}" }.take(120)
    }

    private fun decodeBase64(base64: String): ByteArray =
        if (Build.VERSION.SDK_INT >= 26) java.util.Base64.getDecoder().decode(base64)
        else android.util.Base64.decode(base64, android.util.Base64.DEFAULT)

    private fun hasStoragePermission(): Boolean =
        ContextCompat.checkSelfPermission(this, Manifest.permission.WRITE_EXTERNAL_STORAGE) ==
            PackageManager.PERMISSION_GRANTED

    @RequiresApi(29)
    private fun copyToMediaStore(src: File, filename: String, mime: String): String {
        val values = ContentValues().apply {
            put(MediaStore.Downloads.DISPLAY_NAME, filename)
            put(MediaStore.Downloads.MIME_TYPE, mime)
            put(MediaStore.Downloads.RELATIVE_PATH, Environment.DIRECTORY_DOWNLOADS)
            put(MediaStore.Downloads.IS_PENDING, 1)
        }
        val uri = contentResolver.insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, values)
            ?: error("无法创建下载文件")
        try {
            contentResolver.openOutputStream(uri)?.use { out -> src.inputStream().use { it.copyTo(out) } }
                ?: error("无法写入文件")
            contentResolver.update(uri, ContentValues().apply { put(MediaStore.Downloads.IS_PENDING, 0) }, null, null)
        } catch (e: Exception) {
            runCatching { contentResolver.delete(uri, null, null) } // 清理残留的“待定”条目
            throw e
        }
        return runCatching {
            contentResolver.query(uri, arrayOf(MediaStore.Downloads.DISPLAY_NAME), null, null, null)?.use { c ->
                if (c.moveToFirst()) c.getString(0) else null
            }
        }.getOrNull() ?: filename
    }

    private fun copyToLegacyDownloads(src: File, filename: String): String {
        @Suppress("DEPRECATION")
        val dir = Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DOWNLOADS)
        if (!dir.exists()) dir.mkdirs()
        var target = File(dir, filename)
        val stem = filename.substringBeforeLast('.', filename)
        val ext = if (filename.contains('.')) filename.substringAfterLast('.') else ""
        var n = 1
        while (target.exists()) {
            target = File(dir, if (ext.isEmpty()) "${stem}_$n" else "${stem}_$n.$ext")
            n++
        }
        src.inputStream().use { input -> target.outputStream().use { input.copyTo(it) } }
        return target.name
    }

    private fun cleanupExportCache() {
        runCatching { File(cacheDir, "exports").listFiles()?.forEach { it.delete() } }
    }

    private fun toast(msg: String) {
        runOnUiThread { Toast.makeText(this@MainActivity, msg, Toast.LENGTH_LONG).show() }
    }

    override fun onSaveInstanceState(outState: Bundle) {
        super.onSaveInstanceState(outState)
        if (::web.isInitialized) web.saveState(outState)
    }

    override fun onPause() {
        if (::web.isInitialized) {
            web.evaluateJavascript("window.__onAppPause&&window.__onAppPause()", null)
            web.onPause()
        }
        super.onPause()
    }

    @Suppress("DEPRECATION")
    override fun onTrimMemory(level: Int) {
        super.onTrimMemory(level)
        if (level >= android.content.ComponentCallbacks2.TRIM_MEMORY_RUNNING_LOW && ::web.isInitialized) {
            web.evaluateJavascript("window.__onAppPause&&window.__onAppPause()", null)
        }
    }

    override fun onResume() {
        super.onResume()
        if (::web.isInitialized) web.onResume()
    }

    override fun onDestroy() {
        fileCallback?.onReceiveValue(null)
        fileCallback = null
        sessions.values.forEach { runCatching { it.stream.close() }; it.file.delete() }
        sessions.clear()
        synchronized(pendingLock) { pendingLegacy.forEach { it.temp.delete() }; pendingLegacy.clear() }
        if (::web.isInitialized) {
            (web.parent as? ViewGroup)?.removeView(web)
            web.destroy()
        }
        super.onDestroy()
    }

    companion object {
        private const val TAG = "TMXMapForge"
        private const val ASSET_HOST = "appassets.androidplatform.net"
        private const val START_URL = "https://$ASSET_HOST/assets/index.html"
        private const val DEFAULT_BG = "#0B1220"
    }
}
