# 若开启混淆（isMinifyEnabled = true），必须保留 WebView JS 桥接方法
-keepclassmembers class com.tmxmapforge.offline.MainActivity$AndroidBridge {
    @android.webkit.JavascriptInterface <methods>;
}
-keepattributes JavascriptInterface
