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
import android.os.PowerManager
import android.provider.MediaStore
import android.provider.Settings
import androidx.core.content.FileProvider
import expo.modules.kotlin.Promise
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.io.File
import java.util.ArrayList
import java.util.HashMap

class ExpoTaskAlarmModule : Module() {
  private var photoPromise: Promise? = null
  private var tempPhotoPath: String? = null
  override fun definition() = ModuleDefinition {
    Name("ExpoTaskAlarm")

    AsyncFunction("isCarConnected") {
      val context = appContext.reactContext ?: return@AsyncFunction false
      return@AsyncFunction CarUtils.isConnectedToCar(context)
    }

    AsyncFunction("getAlarmSystemDiagnostics") {
      val context = appContext.reactContext ?: return@AsyncFunction emptyMap<String, Any>()
      val result = HashMap<String, Any>()

      val alarmManager = context.getSystemService(Context.ALARM_SERVICE) as? AlarmManager
      val notificationManager = context.getSystemService(Context.NOTIFICATION_SERVICE) as? NotificationManager
      val powerManager = context.getSystemService(Context.POWER_SERVICE) as? PowerManager

      // 1. Exact Alarms Permission (Android 12+)
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
        result["canScheduleExactAlarms"] = alarmManager?.canScheduleExactAlarms() ?: false
      } else {
        result["canScheduleExactAlarms"] = true
      }

      // 2. Notifications Enabled
      result["areNotificationsEnabled"] = notificationManager?.areNotificationsEnabled() ?: false

      // 3. Full Screen Intent Permission (Android 14+)
      if (Build.VERSION.SDK_INT >= 34) {
        try {
          val method = notificationManager?.javaClass?.getMethod("canUseFullScreenIntent")
          result["canUseFullScreenIntent"] = method?.invoke(notificationManager) as? Boolean ?: true
        } catch (e: Exception) {
          result["canUseFullScreenIntent"] = true
        }
      } else {
        result["canUseFullScreenIntent"] = true
      }

      // 4. Battery Optimization / Doze mode
      val packageName = context.packageName
      result["isIgnoringBatteryOptimizations"] = powerManager?.isIgnoringBatteryOptimizations(packageName) ?: false

      // 5. Overlay / Draw over other apps (canDrawOverlays)
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
        result["canDrawOverlays"] = Settings.canDrawOverlays(context)
      } else {
        result["canDrawOverlays"] = true
      }

      // 6. Car / Android Auto connected
      result["isCarConnected"] = CarUtils.isConnectedToCar(context)

      // 7. System metadata
      result["androidSdkVersion"] = Build.VERSION.SDK_INT
      result["deviceModel"] = Build.MODEL
      result["deviceManufacturer"] = Build.MANUFACTURER

      return@AsyncFunction result
    }

    AsyncFunction("openExactAlarmSettings") {
      val context = appContext.reactContext ?: return@AsyncFunction false
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
        try {
          val intent = Intent(Settings.ACTION_REQUEST_SCHEDULE_EXACT_ALARM).apply {
            data = Uri.parse("package:${context.packageName}")
            flags = Intent.FLAG_ACTIVITY_NEW_TASK
          }
          context.startActivity(intent)
          return@AsyncFunction true
        } catch (e: Exception) {
          try {
            val intent = Intent(Settings.ACTION_REQUEST_SCHEDULE_EXACT_ALARM).apply {
              flags = Intent.FLAG_ACTIVITY_NEW_TASK
            }
            context.startActivity(intent)
            return@AsyncFunction true
          } catch (e2: Exception) {}
        }
      }
      return@AsyncFunction false
    }

    AsyncFunction("openBatteryOptimizationSettings") {
      val context = appContext.reactContext ?: return@AsyncFunction false
      try {
        val intent = Intent(Settings.ACTION_IGNORE_BATTERY_OPTIMIZATION_SETTINGS).apply {
          flags = Intent.FLAG_ACTIVITY_NEW_TASK
        }
        context.startActivity(intent)
        return@AsyncFunction true
      } catch (e: Exception) {
        return@AsyncFunction false
      }
    }

    AsyncFunction("openOverlaySettings") {
      val context = appContext.reactContext ?: return@AsyncFunction false
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
        try {
          val intent = Intent(Settings.ACTION_MANAGE_OVERLAY_PERMISSION).apply {
            data = Uri.parse("package:${context.packageName}")
            flags = Intent.FLAG_ACTIVITY_NEW_TASK
          }
          context.startActivity(intent)
          return@AsyncFunction true
        } catch (e: Exception) {}
      }
      return@AsyncFunction false
    }

    AsyncFunction("scheduleExactAlarm") { taskId: String, taskName: String, triggerTimeMillis: Long, channelId: String, presentationStyle: String? ->
      val context = appContext.reactContext ?: return@AsyncFunction false
      
      val targetChannelId = if (!channelId.isNullOrEmpty()) channelId else "task_alarm_channel"
      val style = presentationStyle ?: "fullscreen"

      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
          val notificationManager = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
          
          // 1. Ensure high priority channel exists for popup mode
          if (notificationManager.getNotificationChannel(targetChannelId) == null) {
              val channel = NotificationChannel(targetChannelId, "Task Alarms", NotificationManager.IMPORTANCE_HIGH).apply {
                  description = "Channel for task alarms"
              }
              notificationManager.createNotificationChannel(channel)
          }

          // 2. Default importance channel for full-screen mode to prevent popup banner over the full screen activity
          val fsChannelId = "${targetChannelId}_fs"
          if (notificationManager.getNotificationChannel(fsChannelId) == null) {
              val existing = notificationManager.getNotificationChannel(targetChannelId)
              val fsChannel = NotificationChannel(fsChannelId, "Task Full Screen Alarms", NotificationManager.IMPORTANCE_DEFAULT).apply {
                  description = "Channel for full screen alarms without heads-up popup banner"
                  if (existing != null) {
                      setSound(existing.sound, existing.audioAttributes)
                      enableVibration(existing.shouldVibrate())
                      vibrationPattern = existing.vibrationPattern
                  }
              }
              notificationManager.createNotificationChannel(fsChannel)
          }
      }

      val requestCode = taskId.hashCode()

      val alarmManager = context.getSystemService(Context.ALARM_SERVICE) as AlarmManager

      val receiverIntent = Intent(context, TaskAlarmReceiver::class.java).apply {
          putExtra("taskId", taskId)
          putExtra("taskName", taskName)
          putExtra("channelId", targetChannelId)
          putExtra("requestCode", requestCode)
          putExtra("presentationStyle", style)
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
          
          val authority = "${activity.packageName}.TaskAlarmFileProvider"
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
      
      val parcelableUris = ArrayList<Uri>()
      val authority = "${activity.packageName}.TaskAlarmFileProvider"
      for (uriString in uris) {
          var uri = Uri.parse(uriString)
          if (uri.scheme == "file" && uri.path != null) {
              val file = File(uri.path!!)
              uri = FileProvider.getUriForFile(activity, authority, file)
          }
          parcelableUris.add(uri)
      }
      
      val intent = if (parcelableUris.size > 1) {
          Intent(Intent.ACTION_SEND_MULTIPLE).apply {
              putParcelableArrayListExtra(Intent.EXTRA_STREAM, parcelableUris)
          }
      } else if (parcelableUris.size == 1) {
          Intent(Intent.ACTION_SEND).apply {
              putExtra(Intent.EXTRA_STREAM, parcelableUris[0])
          }
      } else {
          Intent(Intent.ACTION_SEND)
      }
      
      if (parcelableUris.isNotEmpty()) {
          intent.type = "*/*"
      } else {
          intent.type = "text/plain"
      }
      intent.putExtra(Intent.EXTRA_TEXT, text)

      
      if (parcelableUris.isNotEmpty()) {
          val clipData = android.content.ClipData.newUri(activity.contentResolver, "Task Attachments", parcelableUris[0])
          for (i in 1 until parcelableUris.size) {
              clipData.addItem(android.content.ClipData.Item(parcelableUris[i]))
          }
          intent.clipData = clipData
      }
      
      intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
      
      activity.startActivity(Intent.createChooser(intent, "Share Task"))
      return@AsyncFunction true
    }

    AsyncFunction("openDocumentAsync") { uriString: String, mimeType: String? ->
      val activity = appContext.currentActivity ?: return@AsyncFunction false
      val intent = Intent(Intent.ACTION_VIEW)
      var uri = Uri.parse(uriString)
      
      if (uri.scheme == "file" && uri.path != null) {
          val authority = "${activity.packageName}.TaskAlarmFileProvider"
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
