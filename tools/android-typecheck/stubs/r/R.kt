@file:Suppress("unused", "UNUSED_PARAMETER")
package androidx.activity.result
abstract class ActivityResultLauncher<I> { abstract fun launch(input: I) }
class ActivityResult(val resultCode: Int, val data: android.content.Intent?)
