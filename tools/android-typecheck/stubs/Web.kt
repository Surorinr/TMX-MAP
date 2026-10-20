@file:Suppress("unused", "UNUSED_PARAMETER")
package androidx.webkit
import android.net.Uri
import android.webkit.WebResourceResponse
open class WebViewClientCompat : android.webkit.WebViewClient()
class WebViewAssetLoader {
  fun shouldInterceptRequest(u: Uri): WebResourceResponse? = null
  class AssetsPathHandler(c: android.content.Context) : PathHandler
  interface PathHandler
  class Builder { fun addPathHandler(p: String, h: PathHandler): Builder = this; fun build(): WebViewAssetLoader = WebViewAssetLoader() }
}
