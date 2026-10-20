@file:Suppress("unused", "UNUSED_PARAMETER")
package androidx.activity
open class OnBackPressedCallback(enabled: Boolean) { var isEnabled: Boolean = enabled; open fun handleOnBackPressed() {} }
class OnBackPressedDispatcher { fun addCallback(owner: Any, cb: OnBackPressedCallback) {}; fun onBackPressed() {} }
open class ComponentActivity : android.app.Activity() {
    val onBackPressedDispatcher = OnBackPressedDispatcher()
    fun <I, O> registerForActivityResult(c: androidx.activity.result.contract.ActivityResultContract<I, O>, cb: (O) -> Unit): androidx.activity.result.ActivityResultLauncher<I> = TODO()
}
