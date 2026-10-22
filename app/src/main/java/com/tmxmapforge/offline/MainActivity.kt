package com.tmxmapforge.offline

import android.Manifest
import android.annotation.SuppressLint
import android.content.ClipData
import android.content.ContentValues
import android.content.Context
import android.content.Intent
import android.content.pm.ActivityInfo
import android.content.pm.ApplicationInfo
import android.content.pm.PackageManager
import android.content.res.Configuration
import android.graphics.Color
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.os.Environment
import android.os.SystemClock
import android.provider.DocumentsContract
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
 * TMX MapForge Offline 3.19.0
 *
 * 3.19.0：第十七轮审查。① onShowFileChooser 启动失败分支已回传 null 却返回 false，WebView 会再完成一次回调（3.18.0 回归），
 *  改为返回 true；② 写入导出文件夹失败时，只有授权真正失效才遗忘文件夹（3.18.0 对任何 IO 错误都会永久释放授权）。
 *  出生点上限 100 / FFA 模式完全在网页层实现，原生层无需改动。
 *
 * 3.17.0：原生代码无改动。新增的视图截图走已有的 beginSave / appendChunk / finishSave 保存链路与 shareSaved 分享链路。
 *
 * 3.16.0：原生代码无改动。新主题的系统栏颜色 / 图标深浅仍通过已有的 AndroidBridge.setSystemBars(color, lightIcons) 设置。
 *
 * 3.15.0：原生代码无改动（仅启动器图标资源更换为新图标，见 tools/icon/make-icons.py）。
 *
 * 3.14.0：导出后一键分享（QQ / 微信 / 其他应用）
 *  铁锈战争的地图主要在群里互传，过去导出后还要自己去「下载」目录里翻文件。现在每次成功导出（Android 10+ 的下载目录，
 *  或用户选择的导出文件夹）都会把文件的 content:// URI 记入「本批次已保存」列表，网页在导出完成的提示里提供「分享」按钮，
 *  经 shareSaved() 拉起系统分享面板（单文件 ACTION_SEND，TMX + 小地图两个文件 ACTION_SEND_MULTIPLE），并授予接收方只读权限。
 *  桥接：resetShareList() 开始新批次 / canShare() 是否有可分享文件 / shareSaved() 拉起分享面板。
 *  Android 9 及以下写入公共「下载」目录的文件没有可授权的 content:// URI，canShare() 返回 false，网页不显示分享按钮。
 *  不新增任何权限，也不需要 FileProvider（分享的是 MediaStore / SAF 本来就存在的 URI）。
 *
 * 3.10.0
 * 3.10.0：屏幕方向锁定持久化（核心修复）
 *  旧实现 setOrientationLock(true) 只是把 requestedOrientation 设为 SCREEN_ORIENTATION_LOCKED（「锁定为此刻的方向」），
 *  原生层并不记录锁的是竖屏还是横屏；而 Manifest 固定为 fullSensor，冷启动时 App 总是先按手机当前姿态显示，
 *  等网页加载完、从 localStorage 读到 orient=true 后再调一次 setOrientationLock(true)——此时锁住的是
 *  「启动时手机恰好的方向」，而不是上次锁定的方向。所以横屏锁定后、竖着拿手机重新打开，就变成了竖屏锁定；
 *  而且要等网页启动完才生效，启动过程中还会先转一次屏。
 *  现在：
 *   1. 方向模式（auto / portrait / landscape）由原生层用 SharedPreferences 持久化，是唯一可信来源；
 *   2. onCreate() 在创建任何视图之前就按保存的模式设置 requestedOrientation，冷启动第一帧就是上次锁定的方向；
 *   3. 「锁定当前方向」在原生层解析为具体的 portrait / landscape 再保存（不再用 SCREEN_ORIENTATION_LOCKED）；
 *   4. 新增 getOrientationMode() / setOrientationMode(mode) 桥接，结果经 window.__onOrientationMode(mode) 回传网页；
 *      保留旧接口 setOrientationLock(Boolean) 兼容；
 *   5. 网页渲染进程崩溃重建、Activity 因进程回收重建、系统深浅色切换（uiMode）等情况下锁定都不会丢失。
 *  其他：setKeepScreenOn 只在状态真正变化时切换（网页进度更新不再每帧都跨线程调用）。
 *
 * 3.9.0：
 *  1. finishSave() 返回值修复：导出成功时带上实际落点后缀（"|tree" / "|downloads" / "|downloads:fallback"），
 *     网页侧据此同步显示真实保存位置。此前「自定义导出文件夹授权已失效、已自动回退到下载目录」这件事只通过
 *     notifyFolder() 经 runOnUiThread 异步回传，和 finishSave() 的同步返回值谁先到达没有保证，常见表现是
 *     文件已经回退存到下载目录，Toast 却仍提示保存到了（已失效的）自定义文件夹。详见 app.js 对应修复的注释。
 *  2. 本轮网页前端（app.js）新增「近家资源点」等功能，原生层本身逻辑不受影响，仅随版本号一并升级。
 *
 * 3.8.0：
 *  1. 新增「另存为 / 导出位置」：通过系统文件夹选择器（SAF，ACTION_OPEN_DOCUMENT_TREE）选一个文件夹并持久授权，
 *     之后导出的 TMX / 小地图 / ZIP / 项目文件可写入该文件夹（也可每次导出时在「另存为」面板里选择下载目录或该文件夹）。
 *     选择器直接启动（不再经过 Intent.createChooser 中转），并以「下载」目录或上次选择的文件夹作为初始位置，
 *     打开后无需再从根目录（共享存储）一级级导航。授权失效（文件夹被删除 / 权限被撤销）时自动回退到下载目录并通知网页。
 *  2. 修复：网页文件选择器（导入 TMX / 图片）旧版包了一层 Intent.createChooser。部分系统上这会先弹出「选择应用」面板，
 *     选中的第三方文件管理器以对话框形式盖在本 App 的边到边窗口上，顶部的存储路径导航被状态栏遮挡；且每次都要多点一步。
 *     现在直接启动系统文档选择器（ACTION_OPEN_DOCUMENT），与「另存为」使用同一个系统界面。
 *  3. 系统栏：在 Android 15 强制边到边下，除系统栏 / 刘海外还处理了 systemGestures 之外的「可点击区域」内边距
 *     （tappableElement），避免手势导航条盖住底部按钮；其余逻辑无改动。
 *
 * 3.7.0：Android 9 及以下「下载」目录重名时，TMX 被改名为 xxx_1.tmx，旧版随后的小地图仍按原名得到 xxx_map_1.png，
 *  两者不再成对（游戏按「地图名_map.png」找小地图）。现在记录最近一次 TMX 改名，60 秒内的同名 _map.png 使用相同的新主干
 *  （与 PC 版 desktop/src/main.rs 的 target_for 逻辑一致；Android 10+ 由网页按 TMX 实际文件名命名小地图）。其余逻辑无改动。
 *
 * 3.6.0：合并 3.4.x（屏幕方向锁定 setOrientationLock）与 3.5.0（PC 版）两条分支；网页控制台日志只在可调试构建输出
 *  （旧版 release 包也会把网页每条 console 消息写进 logcat，生成大地图时日志量很大）。其余逻辑无改动。
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

    /** 3.7.0：最近一次 TMX 因重名被改名的记录（原文件名主干, 实际主干, 时间），让随后的 _map.png 同步改名 */
    private val pairLock = Any()
    private var lastTmxRename: Triple<String, String, Long>? = null

    /** 3.14.0：本次导出批次中已保存的文件（content:// URI + MIME），供「分享」使用 */
    private val shareLock = Any()
    private val shareList = ArrayList<Pair<Uri, String>>()
    private fun addShareable(uri: Uri, mime: String) { synchronized(shareLock) { shareList.add(uri to mime) } }

    /** 3.8.0：每个保存会话的写入目标（downloads / tree） */
    private val sessionTargets = ConcurrentHashMap<String, String>()
    private val prefs by lazy { getSharedPreferences("export", Context.MODE_PRIVATE) }
    /** 3.10.0：界面偏好（目前只有屏幕方向模式）；与导出偏好分文件保存，互不影响 */
    private val uiPrefs by lazy { getSharedPreferences("ui", Context.MODE_PRIVATE) }
    @Volatile private var keepScreenOnState = false

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

    /** 3.8.0：导出文件夹选择器（SAF）。初始位置：上次选择的文件夹，否则「下载」目录 */
    private val folderPicker =
        registerForActivityResult(object : ActivityResultContracts.OpenDocumentTree() {
            override fun createIntent(context: Context, input: Uri?): Intent =
                super.createIntent(context, input).addFlags(
                    Intent.FLAG_GRANT_READ_URI_PERMISSION or Intent.FLAG_GRANT_WRITE_URI_PERMISSION or
                        Intent.FLAG_GRANT_PERSISTABLE_URI_PERMISSION or Intent.FLAG_GRANT_PREFIX_URI_PERMISSION
                )
        }) { uri -> onFolderPicked(uri) }

    private val fileChooser =
        registerForActivityResult(ActivityResultContracts.StartActivityForResult()) { result ->
            val cb = fileCallback
            fileCallback = null
            cb?.onReceiveValue(WebChromeClient.FileChooserParams.parseResult(result.resultCode, result.data))
        }

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        // 3.10.0：在创建任何视图之前恢复上次保存的屏幕方向，冷启动第一帧就是上次锁定的竖屏 / 横屏，
        // 不再等网页加载完成后才锁（旧版此时锁住的是「启动时手机恰好的方向」）
        applyOrientationMode(loadOrientationMode())
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
            val bars = insets.getInsets(WindowInsetsCompat.Type.systemBars() or WindowInsetsCompat.Type.displayCutout() or WindowInsetsCompat.Type.tappableElement())
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
                    // 3.8.0：直接启动系统文档选择器（旧版 Intent.createChooser 会先弹「选择应用」面板，部分第三方文件管理器
                    // 以对话框形式盖在边到边窗口上，顶部存储导航被状态栏遮挡）
                    fileChooser.launch(intent)
                    true
                } catch (e: Exception) {
                    /* 3.18.0 修复：启动选择器失败时必须把 null 回传给 WebView 回调，否则网页侧 <input type=file>
                     * 永远收不到结果、file-chooser 的挂起状态也不会被清理，该 input 之后可能不再触发
                     * onShowFileChooser。同文件其余三处（重入前、渲染进程崩溃恢复、onDestroy）都做了这一步。 */
                    filePathCallback.onReceiveValue(null)
                    fileCallback = null
                    toast("无法打开文件选择器：${e.message}")
                    /* 3.19.0 修复（3.18.0 回归）：已经调用过 onReceiveValue(null)，这里必须返回 true。
                     * WebView 的约定是「返回 false = 由 WebView 自行处理并结束这次请求」，Chromium 会再回传一次空结果，
                     * 同一个回调被完成两次（部分版本抛出 IllegalStateException「showFileChooser result was already called」）。
                     * 官方文档要求的取消方式正是「onReceiveValue(null) 并返回 true」。 */
                    true
                }
            }

            override fun onConsoleMessage(consoleMessage: ConsoleMessage): Boolean {
                if (applicationInfo.flags and ApplicationInfo.FLAG_DEBUGGABLE != 0) {
                    Log.d(TAG, "[web] ${consoleMessage.message()} @${consoleMessage.sourceId()}:${consoleMessage.lineNumber()}")
                }
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
        sessionTargets.clear()
        if (rendererCrashes.size > 3) {
            toast("页面连续崩溃，请尝试减小地图尺寸后重新打开应用")
            finish()
            return
        }
        keepScreenOnState = false // 新 WebView 默认不常亮，与网页状态重新对齐
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
                    // 3.9.0：finishSave() 现在返回 "ok:<name>|<where>"，这里仅用于旧接口的系统 Toast 展示，去掉后缀
                    r.startsWith("ok:") -> toast("已保存到下载目录：${r.removePrefix("ok:").substringBefore('|')}")
                    r.startsWith("error:") -> toast("保存失败：${r.removePrefix("error:")}")
                }
                r
            } catch (e: Exception) {
                toast("保存失败：${e.message}")
                "error:${e.message}"
            }
        }

        /** 分块保存：开始（写入下载目录，兼容旧接口）。返回会话 id，失败返回空串 */
        @JavascriptInterface
        fun beginSave(filename: String, mime: String): String = beginSaveTo(filename, mime, TARGET_DOWNLOADS)

        /** 3.8.0：分块保存：开始，并指定写入目标 "downloads"（下载目录）/ "tree"（用户选择的导出文件夹） */
        @JavascriptInterface
        fun beginSaveTo(filename: String, mime: String, target: String): String {
            val id = beginSaveInternal(filename, mime)
            if (id.isNotEmpty()) sessionTargets[id] = if (target == TARGET_TREE) TARGET_TREE else TARGET_DOWNLOADS
            return id
        }

        /** 3.8.0：当前导出文件夹 JSON：{"set":true,"name":"…","path":"…"} 或 {"set":false} */
        @JavascriptInterface
        fun getExportFolder(): String = folderJson().toString()

        /** 3.8.0：打开系统文件夹选择器；结果经 window.__onExportFolder(json) 回传（取消时 json.cancelled=true） */
        @JavascriptInterface
        fun chooseExportFolder() {
            runOnUiThread {
                try { folderPicker.launch(initialFolderUri()) }
                catch (e: Exception) {
                    Log.e(TAG, "chooseExportFolder", e)
                    notifyFolder(folderJson().put("cancelled", true).put("error", e.message ?: "无法打开文件夹选择器"))
                }
            }
        }

        /** 3.8.0：清除导出文件夹（恢复为下载目录），并释放持久授权 */
        @JavascriptInterface
        fun clearExportFolder() {
            prefs.getString(KEY_TREE, null)?.let { old ->
                runCatching { contentResolver.releasePersistableUriPermission(Uri.parse(old), Intent.FLAG_GRANT_READ_URI_PERMISSION or Intent.FLAG_GRANT_WRITE_URI_PERMISSION) }
            }
            prefs.edit().remove(KEY_TREE).apply()
        }

        private fun beginSaveInternal(filename: String, mime: String): String {
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
            val target = sessionTargets.remove(id) ?: TARGET_DOWNLOADS
            // 3.9.0 修复：导出成功时返回值带上实际落点后缀（"|tree" / "|downloads" / "|downloads:fallback"），
            // 网页侧据此同步显示真实保存位置，不再依赖 notifyFolder() 那条经 runOnUiThread 异步回传的通知——
            // 那条通知和这次 finishSave() 的返回值谁先到达没有保证，常见顺序是 finishSave() 先返回、网页按
            // “所选文件夹仍然有效”的假设提示成功，“文件夹已失效”的提示才姗姗来迟，用户看到的保存位置和文件
            // 实际落点对不上（文件已经回退存到下载目录，提示却仍是自定义文件夹名）。
            var fellBackFromTree = false
            var folderLost = false // 3.19.0：true = 授权失效已遗忘文件夹；false 且 fellBackFromTree = 瞬时失败，文件夹设置保留
            return try {
                s.stream.close()
                if (target == TARGET_TREE && prefs.getString(KEY_TREE, null) != null) {
                    // 写入用户选择的导出文件夹；授权失效时回退到下面的下载目录分支
                    val name = try { copyToTree(s.file, s.filename, s.mime) } catch (e: Exception) {
                        Log.w(TAG, "copyToTree failed, fallback to Downloads", e)
                        /* 3.18.0 修复：旧版这里只 prefs.edit().remove(KEY_TREE)，没有释放该文件夹的持久授权。
                         * 持久授权跨重启存活，唯一释放点是 clearExportFolder()，两处行为不一致会泄漏授权，
                         * 同时用户选择的导出文件夹被永久遗忘、后续导出静默回退。按 clearExportFolder() 同款方式先释放再移除。 */
                        /* 3.19.0 修复（3.18.0 矫枉过正）：只有授权真的失效（被撤销 / 文件夹已删除）时才遗忘该文件夹并释放授权。
                         * 磁盘已满、单次 IO 错误、文档提供方暂时不可用等瞬时失败，本次回退到下载目录，但保留用户的文件夹选择，
                         * 否则一次偶发错误就要用户重新去系统选择器里一级级找回导出文件夹。 */
                        folderLost = !treeStillUsable()
                        if (folderLost) {
                            prefs.getString(KEY_TREE, null)?.let { old ->
                                runCatching { contentResolver.releasePersistableUriPermission(Uri.parse(old), Intent.FLAG_GRANT_READ_URI_PERMISSION or Intent.FLAG_GRANT_WRITE_URI_PERMISSION) }
                            }
                            prefs.edit().remove(KEY_TREE).apply()
                            notifyFolder(JSONObject().put("set", false).put("lost", true).put("error", e.message ?: "无法写入所选文件夹"))
                        }
                        fellBackFromTree = true
                        null
                    }
                    if (name != null) { s.file.delete(); return "ok:$name|tree" }
                }
                val suffix = if (!fellBackFromTree) "downloads" else if (folderLost) "downloads:fallback" else "downloads:retry"
                if (Build.VERSION.SDK_INT >= 29) {
                    val name = copyToMediaStore(s.file, s.filename, s.mime)
                    s.file.delete()
                    "ok:$name|$suffix"
                } else if (hasStoragePermission()) {
                    val name = copyToLegacyDownloads(s.file, s.filename)
                    s.file.delete()
                    "ok:$name|$suffix"
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
            sessionTargets.remove(id)
            sessions.remove(id)?.let { runCatching { it.stream.close() }; it.file.delete() }
        }

        /** 地图生成期间保持屏幕常亮（3.10.0：状态未变化时不再跨线程投递） */
        @JavascriptInterface
        fun setKeepScreenOn(on: Boolean) {
            if (keepScreenOnState == on) return
            keepScreenOnState = on
            runOnUiThread { if (::web.isInitialized) web.keepScreenOn = on }
        }

        /** 随网页主题同步系统栏背景色与图标明暗 */
        @JavascriptInterface
        fun setSystemBars(color: String, lightIcons: Boolean) {
            runOnUiThread { applySystemBars(color, lightIcons) }
        }

        /** 兼容旧接口：true = 锁定到当前方向（解析为具体的竖屏 / 横屏并持久化），false = 自动旋转 */
        @JavascriptInterface
        fun setOrientationLock(lock: Boolean) = setOrientationMode(if (lock) ORIENT_CURRENT else ORIENT_AUTO)

        /**
         * 3.10.0：设置屏幕方向模式并持久化。mode："auto" / "portrait" / "landscape" / "current"（锁定为此刻的方向）。
         * 实际生效的模式经 window.__onOrientationMode(mode) 回传网页（"current" 会被解析为 portrait / landscape）。
         */
        @JavascriptInterface
        fun setOrientationMode(mode: String) {
            runOnUiThread {
                val resolved = when (mode) {
                    ORIENT_CURRENT -> currentOrientationFamily()
                    ORIENT_PORTRAIT, ORIENT_LANDSCAPE, ORIENT_AUTO -> mode
                    else -> ORIENT_AUTO
                }
                saveOrientationMode(resolved)
                applyOrientationMode(resolved)
                notifyOrientation(resolved)
            }
        }

        /** 3.14.0：开始新的导出批次（清空「可分享文件」列表）。网页在每次导出开始前调用 */
        @JavascriptInterface
        fun resetShareList() { synchronized(shareLock) { shareList.clear() } }

        /** 3.14.0：本批次是否有可分享的文件 */
        @JavascriptInterface
        fun canShare(): Boolean = synchronized(shareLock) { shareList.isNotEmpty() }

        /** 3.14.0：用系统分享面板分享本批次已保存的文件。返回 false 表示没有可分享的文件 */
        @JavascriptInterface
        fun shareSaved(): Boolean {
            val items = synchronized(shareLock) { ArrayList(shareList) }
            if (items.isEmpty()) return false
            runOnUiThread {
                try {
                    val uris = ArrayList<Uri>(items.map { it.first })
                    val send = if (uris.size == 1) {
                        Intent(Intent.ACTION_SEND).apply {
                            type = items[0].second
                            putExtra(Intent.EXTRA_STREAM, uris[0])
                        }
                    } else {
                        Intent(Intent.ACTION_SEND_MULTIPLE).apply {
                            type = "*/*"
                            putParcelableArrayListExtra(Intent.EXTRA_STREAM, uris)
                        }
                    }
                    val clip = ClipData.newRawUri(null, uris[0])
                    for (i in 1 until uris.size) clip.addItem(ClipData.Item(uris[i]))
                    send.clipData = clip
                    send.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
                    startActivity(Intent.createChooser(send, "分享地图文件"))
                } catch (e: Exception) {
                    Log.e(TAG, "shareSaved", e)
                    toast("无法打开分享面板：${e.message ?: "未知错误"}")
                }
            }
            return true
        }

        /** 3.10.0：当前保存的方向模式 JSON：{"mode":"auto|portrait|landscape","stored":true|false,"current":"portrait|landscape"} */
        @JavascriptInterface
        fun getOrientationMode(): String = JSONObject()
            .put("mode", loadOrientationMode())
            .put("stored", uiPrefs.contains(KEY_ORIENT))
            .put("current", currentOrientationFamily())
            .toString()
    }

    /* ------------------------------------------------------------------ 3.10.0：屏幕方向（持久化） */

    private fun loadOrientationMode(): String =
        uiPrefs.getString(KEY_ORIENT, ORIENT_AUTO).takeIf { it == ORIENT_PORTRAIT || it == ORIENT_LANDSCAPE } ?: ORIENT_AUTO

    /** apply() 异步落盘；系统在 onPause / onStop 时会等待挂起的写入完成，划掉后台也不会丢 */
    private fun saveOrientationMode(mode: String) {
        uiPrefs.edit().putString(KEY_ORIENT, mode).apply()
    }

    /**
     * 竖屏：SCREEN_ORIENTATION_PORTRAIT（固定正向竖屏，避免倒置）；
     * 横屏：SCREEN_ORIENTATION_SENSOR_LANDSCAPE（锁定横屏，但左右两个横向随重力翻转，手机怎么横着拿都是正的）；
     * 自动：与 Manifest 一致的 FULL_SENSOR。
     */
    private fun applyOrientationMode(mode: String) {
        val want = when (mode) {
            ORIENT_PORTRAIT -> ActivityInfo.SCREEN_ORIENTATION_PORTRAIT
            ORIENT_LANDSCAPE -> ActivityInfo.SCREEN_ORIENTATION_SENSOR_LANDSCAPE
            else -> ActivityInfo.SCREEN_ORIENTATION_FULL_SENSOR
        }
        if (requestedOrientation != want) requestedOrientation = want
    }

    /** 此刻界面的方向（竖 / 横）；Configuration 未定义时按窗口宽高判断 */
    private fun currentOrientationFamily(): String {
        return when (resources.configuration.orientation) {
            Configuration.ORIENTATION_LANDSCAPE -> ORIENT_LANDSCAPE
            Configuration.ORIENTATION_PORTRAIT -> ORIENT_PORTRAIT
            else -> resources.displayMetrics.let { if (it.widthPixels > it.heightPixels) ORIENT_LANDSCAPE else ORIENT_PORTRAIT }
        }
    }

    private fun notifyOrientation(mode: String) {
        if (!::web.isInitialized) return
        web.evaluateJavascript("window.__onOrientationMode&&window.__onOrientationMode(${JSONObject.quote(mode)})", null)
    }

    /* ------------------------------------------------------------------ 3.8.0：导出文件夹（SAF） */

    /** 选择器初始位置：已选文件夹；否则「下载」目录（避免每次从共享存储根目录一级级导航） */
    private fun initialFolderUri(): Uri? {
        if (Build.VERSION.SDK_INT < 26) return null
        prefs.getString(KEY_TREE, null)?.let { t ->
            return runCatching { val tree = Uri.parse(t); DocumentsContract.buildDocumentUriUsingTree(tree, DocumentsContract.getTreeDocumentId(tree)) }.getOrNull()
        }
        return runCatching { DocumentsContract.buildDocumentUri(EXTERNAL_STORAGE_AUTHORITY, "primary:" + Environment.DIRECTORY_DOWNLOADS) }.getOrNull()
    }

    private fun onFolderPicked(uri: Uri?) {
        if (uri == null) { notifyFolder(folderJson().put("cancelled", true)); return }
        try {
            contentResolver.takePersistableUriPermission(uri, Intent.FLAG_GRANT_READ_URI_PERMISSION or Intent.FLAG_GRANT_WRITE_URI_PERMISSION)
        } catch (e: SecurityException) {
            Log.e(TAG, "takePersistableUriPermission", e)
            notifyFolder(folderJson().put("cancelled", true).put("error", "系统未授予该文件夹的长期写入权限，请换一个文件夹"))
            return
        }
        val old = prefs.getString(KEY_TREE, null)
        if (old != null && old != uri.toString()) {
            runCatching { contentResolver.releasePersistableUriPermission(Uri.parse(old), Intent.FLAG_GRANT_READ_URI_PERMISSION or Intent.FLAG_GRANT_WRITE_URI_PERMISSION) }
        }
        prefs.edit().putString(KEY_TREE, uri.toString()).apply()
        notifyFolder(folderJson().put("picked", true))
    }

    /** 3.19.0：导出文件夹是否仍可用——持久写授权还在，且文件夹本身仍能查询到（没有被删除 / 卸载） */
    private fun treeStillUsable(): Boolean {
        val t = prefs.getString(KEY_TREE, null) ?: return false
        val tree = Uri.parse(t)
        if (contentResolver.persistedUriPermissions.none { it.uri == tree && it.isWritePermission }) return false
        return runCatching {
            val doc = DocumentsContract.buildDocumentUriUsingTree(tree, DocumentsContract.getTreeDocumentId(tree))
            contentResolver.query(doc, arrayOf(DocumentsContract.Document.COLUMN_DOCUMENT_ID), null, null, null)?.use { it.moveToFirst() } ?: false
        }.getOrDefault(false)
    }

    /** 当前导出文件夹信息；授权已失效时视为未设置 */
    private fun folderJson(): JSONObject {
        val t = prefs.getString(KEY_TREE, null) ?: return JSONObject().put("set", false)
        val tree = Uri.parse(t)
        val granted = contentResolver.persistedUriPermissions.any { it.uri == tree && it.isWritePermission }
        if (!granted) { prefs.edit().remove(KEY_TREE).apply(); return JSONObject().put("set", false).put("lost", true) }
        val docId = runCatching { DocumentsContract.getTreeDocumentId(tree) }.getOrNull() ?: ""
        // primary:Download/RW → 内部存储/Download/RW；其他卷（SD 卡等）显示卷 ID
        val path = docId.substringAfter(':', docId).let { rel ->
            val vol = docId.substringBefore(':', "")
            (if (vol == "primary" || vol.isEmpty()) "内部存储" else vol) + if (rel.isEmpty()) "" else "/$rel"
        }
        val name = runCatching {
            val doc = DocumentsContract.buildDocumentUriUsingTree(tree, docId)
            contentResolver.query(doc, arrayOf(DocumentsContract.Document.COLUMN_DISPLAY_NAME), null, null, null)?.use { c -> if (c.moveToFirst()) c.getString(0) else null }
        }.getOrNull() ?: path.substringAfterLast('/')
        return JSONObject().put("set", true).put("name", name).put("path", path)
    }

    private fun notifyFolder(json: JSONObject) {
        runOnUiThread {
            if (!::web.isInitialized) return@runOnUiThread
            web.evaluateJavascript("window.__onExportFolder&&window.__onExportFolder(${JSONObject.quote(json.toString())})", null)
        }
    }

    /** 写入导出文件夹。重名时由文档提供方自动改名（如「地图 (1).tmx」），小地图沿用与 TMX 相同的成对规则 */
    private fun copyToTree(src: File, filename: String, mime: String): String {
        val tree = Uri.parse(prefs.getString(KEY_TREE, null) ?: error("未设置导出文件夹"))
        val dirDoc = DocumentsContract.buildDocumentUriUsingTree(tree, DocumentsContract.getTreeDocumentId(tree))
        val stem = filename.substringBeforeLast('.', filename)
        val ext = if (filename.contains('.')) filename.substringAfterLast('.') else ""
        val wanted = synchronized(pairLock) {
            val now = SystemClock.elapsedRealtime()
            lastTmxRename?.let { (from, to, at) ->
                if (now - at < 60_000 && from != to && stem == "${from}_map") (if (ext.isEmpty()) "${to}_map" else "${to}_map.$ext") else null
            } ?: filename
        }
        // 八位字节流不让提供方按 MIME 追加扩展名（.tmx 会被保留）
        val docMime = if (ext.equals("tmx", true) || ext.equals("json", true)) "application/octet-stream" else mime
        val doc = DocumentsContract.createDocument(contentResolver, dirDoc, docMime, wanted) ?: error("无法在所选文件夹创建文件")
        try {
            contentResolver.openOutputStream(doc, "w")?.use { out -> src.inputStream().use { it.copyTo(out) } } ?: error("无法写入文件")
        } catch (e: Exception) {
            runCatching { DocumentsContract.deleteDocument(contentResolver, doc) }
            throw e
        }
        addShareable(doc, docMime)
        val actual = runCatching {
            contentResolver.query(doc, arrayOf(DocumentsContract.Document.COLUMN_DISPLAY_NAME), null, null, null)?.use { c -> if (c.moveToFirst()) c.getString(0) else null }
        }.getOrNull() ?: wanted
        if (ext.equals("tmx", true)) synchronized(pairLock) { lastTmxRename = Triple(stem, actual.substringBeforeLast('.', actual), SystemClock.elapsedRealtime()) }
        return actual
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
        addShareable(uri, mime)
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
        val stem = filename.substringBeforeLast('.', filename)
        val ext = if (filename.contains('.')) filename.substringAfterLast('.') else ""
        val target = synchronized(pairLock) {
            val now = SystemClock.elapsedRealtime()
            val paired = lastTmxRename?.let { (from, to, at) ->
                if (now - at < 60_000 && from != to && stem == "${from}_map") {
                    File(dir, if (ext.isEmpty()) "${to}_map" else "${to}_map.$ext")
                } else null
            }?.takeIf { !it.exists() }
            val t = paired ?: uniqueFile(dir, stem, ext)
            if (ext.equals("tmx", ignoreCase = true)) {
                lastTmxRename = Triple(stem, t.name.substringBeforeLast('.', t.name), now)
            }
            t
        }
        src.inputStream().use { input -> target.outputStream().use { input.copyTo(it) } }
        return target.name
    }

    private fun uniqueFile(dir: File, stem: String, ext: String): File {
        var target = File(dir, if (ext.isEmpty()) stem else "$stem.$ext")
        var n = 1
        while (target.exists()) {
            target = File(dir, if (ext.isEmpty()) "${stem}_$n" else "${stem}_$n.$ext")
            n++
        }
        return target
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
        private const val TARGET_DOWNLOADS = "downloads"
        private const val TARGET_TREE = "tree"
        private const val KEY_TREE = "tree_uri"
        private const val EXTERNAL_STORAGE_AUTHORITY = "com.android.externalstorage.documents"
        private const val KEY_ORIENT = "orientation_mode"
        private const val ORIENT_AUTO = "auto"
        private const val ORIENT_PORTRAIT = "portrait"
        private const val ORIENT_LANDSCAPE = "landscape"
        private const val ORIENT_CURRENT = "current"
    }
}
