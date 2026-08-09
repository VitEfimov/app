package expo.modules.taskalarm

import android.app.Activity
import android.app.AlarmManager
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.provider.MediaStore
import androidx.core.content.FileProvider
import expo.modules.kotlin.Promise
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.io.File
import java.util.ArrayList

class ExpoTaskAlarmModule : Module() {
  private var photoPromise: Promise? = null
  private var tempPhotoPath: String? = null
  override fun definition() = ModuleDefinition {
    Name("ExpoTaskAlarm")

    AsyncFunction("scheduleExactAlarm") { taskId: String, taskName: String, triggerTimeMillis: Long, channelId: String ->
      val context = appContext.reactContext ?: return@AsyncFunction false
      
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
          val channelId = "task_alarm_channel"
          val channelName = "Full Screen Alarms"
          val importance = NotificationManager.IMPORTANCE_HIGH
          val channel = NotificationChannel(channelId, channelName, importance).apply {
              description = "Channel for full screen alarms"
              setSound(null, null) 
              enableVibration(false)
          }
          val notificationManager = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
          notificationManager.createNotificationChannel(channel)
      }

      val requestCode = taskId.hashCode()

      val alarmManager = context.getSystemService(Context.ALARM_SERVICE) as AlarmManager

      val receiverIntent = Intent(context, TaskAlarmReceiver::class.java).apply {
          putExtra("taskId", taskId)
          putExtra("taskName", taskName)
          putExtra("channelId", channelId)
          putExtra("requestCode", requestCode)
      }

      val pendingIntent = PendingIntent.getBroadcast(
          context,
          requestCode,
          receiverIntent,
          PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
      )

      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
          alarmManager.setExactAndAllowWhileIdle(
              AlarmManager.RTC_WAKEUP,
              triggerTimeMillis,
              pendingIntent
          )
      } else {
          alarmManager.setExact(
              AlarmManager.RTC_WAKEUP,
              triggerTimeMillis,
              pendingIntent
          )
      }

      return@AsyncFunction true
    }

    AsyncFunction("schedulePomodoroAlarm") { id: String, title: String, body: String, triggerTimeMillis: Long, channelId: String ->
      val context = appContext.reactContext ?: return@AsyncFunction false
      
      val requestCode = id.hashCode()
      val alarmManager = context.getSystemService(Context.ALARM_SERVICE) as AlarmManager

      val receiverIntent = Intent(context, PomodoroAlarmReceiver::class.java).apply {
          putExtra("id", id)
          putExtra("title", title)
          putExtra("body", body)
          putExtra("channelId", channelId)
          putExtra("requestCode", requestCode)
      }

      val pendingIntent = PendingIntent.getBroadcast(
          context,
          requestCode,
          receiverIntent,
          PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
      )

      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
          alarmManager.setExactAndAllowWhileIdle(
              AlarmManager.RTC_WAKEUP,
              triggerTimeMillis,
              pendingIntent
          )
      } else {
          alarmManager.setExact(
              AlarmManager.RTC_WAKEUP,
              triggerTimeMillis,
              pendingIntent
          )
      }
      return@AsyncFunction true
    }

    AsyncFunction("cancelPomodoroAlarm") { id: String ->
      val context = appContext.reactContext ?: return@AsyncFunction false
      val requestCode = id.hashCode()
      val alarmManager = context.getSystemService(Context.ALARM_SERVICE) as AlarmManager

      val receiverIntent = Intent(context, PomodoroAlarmReceiver::class.java)
      val pendingIntent = PendingIntent.getBroadcast(
          context,
          requestCode,
          receiverIntent,
          PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
      )
      
      alarmManager.cancel(pendingIntent)
      pendingIntent.cancel()
      return@AsyncFunction true
    }

    AsyncFunction("cancelAlarm") { taskId: String ->
      val context = appContext.reactContext ?: return@AsyncFunction false
      val requestCode = taskId.hashCode()
      val alarmManager = context.getSystemService(Context.ALARM_SERVICE) as AlarmManager

      val receiverIntent = Intent(context, TaskAlarmReceiver::class.java)
      val pendingIntent = PendingIntent.getBroadcast(
          context,
          requestCode,
          receiverIntent,
          PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
      )
      
      alarmManager.cancel(pendingIntent)
      pendingIntent.cancel()
      return@AsyncFunction true
    }

    AsyncFunction("takePhotoAsync") { promise: Promise ->
      val activity = appContext.currentActivity ?: run {
          promise.reject("E_MISSING_ACTIVITY", "Current activity is null", null)
          return@AsyncFunction
      }
      try {
          val intent = Intent(MediaStore.ACTION_IMAGE_CAPTURE)
          val photoFile = File.createTempFile("photo_${System.currentTimeMillis()}", ".jpg", activity.cacheDir)
          tempPhotoPath = photoFile.absolutePath
          
          val authority = "${activity.packageName}.FileSystemFileProvider"
          val photoUri = FileProvider.getUriForFile(activity, authority, photoFile)
          
          intent.putExtra(MediaStore.EXTRA_OUTPUT, photoUri)
          intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION or Intent.FLAG_GRANT_WRITE_URI_PERMISSION)
          
          this@ExpoTaskAlarmModule.photoPromise = promise
          activity.startActivityForResult(intent, 9002)
      } catch (e: Exception) {
          promise.reject("E_CAMERA_FAILED", e.message, e)
      }
    }

    AsyncFunction("shareTaskAsync") { text: String, uris: List<String> ->
      val activity = appContext.currentActivity ?: return@AsyncFunction false
      val intent = Intent(Intent.ACTION_SEND_MULTIPLE)
      intent.type = "*/*"
      intent.putExtra(Intent.EXTRA_TEXT, text)
      
      val parcelableUris = ArrayList<Uri>()
      val authority = "${activity.packageName}.FileSystemFileProvider"
      for (uriString in uris) {
          var uri = Uri.parse(uriString)
          if (uri.scheme == "file" && uri.path != null) {
              val file = File(uri.path!!)
              uri = FileProvider.getUriForFile(activity, authority, file)
          }
          parcelableUris.add(uri)
      }
      intent.putParcelableArrayListExtra(Intent.EXTRA_STREAM, parcelableUris)
      intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
      
      activity.startActivity(Intent.createChooser(intent, "Share Task"))
      return@AsyncFunction true
    }

    AsyncFunction("openDocumentAsync") { uriString: String, mimeType: String? ->
      val activity = appContext.currentActivity ?: return@AsyncFunction false
      val intent = Intent(Intent.ACTION_VIEW)
      var uri = Uri.parse(uriString)
      
      if (uri.scheme == "file" && uri.path != null) {
          val authority = "${activity.packageName}.FileSystemFileProvider"
          val file = File(uri.path!!)
          uri = FileProvider.getUriForFile(activity, authority, file)
      }
      
      if (mimeType != null) {
          intent.setDataAndType(uri, mimeType)
      } else {
          intent.data = uri
      }
      intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
      intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
      
      try {
          activity.startActivity(intent)
          return@AsyncFunction true
      } catch (e: Exception) {
          e.printStackTrace()
          return@AsyncFunction false
      }
    }

    OnActivityResult { _, payload ->
        if (payload.requestCode == 9002) {
            val promise = photoPromise
            if (promise != null) {
                if (payload.resultCode == Activity.RESULT_OK) {
                    val path = tempPhotoPath
                    if (path != null) {
                        promise.resolve("file://$path")
                    } else {
                        promise.reject("E_NO_PATH", "Temporary photo path is null", null)
                    }
                } else {
                    promise.reject("E_CANCELLED", "User cancelled camera", null)
                }
                photoPromise = null
                tempPhotoPath = null
            }
        }
    }
  }
}
