@file:Suppress("unused", "UNUSED_PARAMETER")
package androidx.activity.result.contract
import android.content.Context
import android.content.Intent
import android.net.Uri
abstract class ActivityResultContract<I, O> { abstract fun createIntent(context: Context, input: I): Intent }
class ActivityResultContracts {
    class RequestPermission : ActivityResultContract<String, Boolean>() { override fun createIntent(context: Context, input: String): Intent = TODO() }
    open class OpenDocumentTree : ActivityResultContract<Uri?, Uri?>() { override fun createIntent(context: Context, input: Uri?): Intent = TODO() }
    class StartActivityForResult : ActivityResultContract<Intent, androidx.activity.result.ActivityResult>() { override fun createIntent(context: Context, input: Intent): Intent = TODO() }
}
