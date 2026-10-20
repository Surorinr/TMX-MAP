@file:Suppress("unused", "UNUSED_PARAMETER")
package androidx.core.view
import android.view.View
import android.view.Window
class Insets(val left: Int, val top: Int, val right: Int, val bottom: Int)
class WindowInsetsCompat { fun getInsets(t: Int): Insets = TODO()
  object Type { fun systemBars() = 1; fun displayCutout() = 2; fun tappableElement() = 4; fun ime() = 8 }
  companion object { val CONSUMED = WindowInsetsCompat() } }
fun interface OnApplyWindowInsetsListener { fun onApplyWindowInsets(v: View, insets: WindowInsetsCompat): WindowInsetsCompat }
object ViewCompat { @JvmStatic fun setOnApplyWindowInsetsListener(v: View, l: OnApplyWindowInsetsListener?) {} }
object WindowCompat { @JvmStatic fun setDecorFitsSystemWindows(w: Window, b: Boolean) {} }
class WindowInsetsControllerCompat(w: Window, v: View) { var isAppearanceLightStatusBars = false; var isAppearanceLightNavigationBars = false }
