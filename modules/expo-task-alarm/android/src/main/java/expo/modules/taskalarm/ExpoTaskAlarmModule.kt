package expo.modules.taskalarm

import android.app.Activity
import android.app.ActivityManager
import android.app.AlarmManager
import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.media.AudioAttributes
import android.net.Uri
import android.os.Build
import android.os.PowerManager
import android.provider.MediaStore
import android.provider.Settings
import android.util.Log
import android.view.WindowManager
import androidx.core.content.FileProvider
import androidx.core.app.NotificationManagerCompat
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

    Function("getSavedThemeMode") {
      val context = appContext.reactContext ?: return@Function null
      val prefs = context.getSharedPreferences("taskflow_theme", Context.MODE_PRIVATE)
      return@Function prefs.getString("themeMode", null)
    }

    Function("setSavedThemeMode") { mode: String ->
      val context = appContext.reactContext ?: return@Function false
      val prefs = context.getSharedPreferences("taskflow_theme", Context.MODE_PRIVATE)
      prefs.edit().putString("themeMode", mode).apply()
      return@Function true
    }

    Function("getSystemMemoryMetrics") {
      val context = appContext.reactContext
      val result = HashMap<String, Any>()
      val runtime = Runtime.getRuntime()
      val usedHeapMb = (runtime.totalMemory() - runtime.freeMemory()) / (1024 * 1024)
      val totalHeapMb = runtime.totalMemory() / (1024 * 1024)
      val maxHeapMb = runtime.maxMemory() / (1024 * 1024)

      result["usedHeapMb"] = usedHeapMb.toDouble()
      result["totalHeapMb"] = totalHeapMb.toDouble()
      result["maxHeapMb"] = maxHeapMb.toDouble()

      if (context != null) {
        val actManager = context.getSystemService(Context.ACTIVITY_SERVICE) as? ActivityManager
        if (actManager != null) {
          val memInfo = ActivityManager.MemoryInfo()
          actManager.getMemoryInfo(memInfo)
          result["availMemMb"] = (memInfo.availMem / (1024 * 1024)).toDouble()
          result["totalMemMb"] = (memInfo.totalMem / (1024 * 1024)).toDouble()
          result["lowMemory"] = memInfo.lowMemory
          result["thresholdMb"] = (memInfo.threshold / (1024 * 1024)).toDouble()
        }
      }
      return@Function result
    }

    Function("getNativeCrashLogs") {
      val context = appContext.reactContext ?: return@Function "[]"
      val prefs = context.getSharedPreferences("taskflow_native_crashes", Context.MODE_PRIVATE)
      return@Function prefs.getString("logs", "[]") ?: "[]"
    }

    Function("clearNativeCrashLogs") {
      val context = appContext.reactContext ?: return@Function false
      val prefs = context.getSharedPreferences("taskflow_native_crashes", Context.MODE_PRIVATE)
      prefs.edit().remove("logs").apply()
      return@Function true
    }

    Function("initNativeCrashHandler") {
      val context = appContext.reactContext ?: return@Function false

      // Also inspect Android 11+ ApplicationExitInfo for native C++ SIGSEGV/SIGABRT/ANR/OOM crashes
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
        try {
          val actManager = context.getSystemService(Context.ACTIVITY_SERVICE) as? ActivityManager
          val exitList = actManager?.getHistoricalProcessExitReasons(null, 0, 5)
          if (!exitList.isNullOrEmpty()) {
            val prefs = context.getSharedPreferences("taskflow_native_crashes", Context.MODE_PRIVATE)
            val lastSeenExitTime = prefs.getLong("last_exit_timestamp", 0L)
            var maxSeenTime = lastSeenExitTime
            var existing = prefs.getString("logs", "[]") ?: "[]"

            for (exitInfo in exitList) {
              val reason = exitInfo.reason
              val isCrashExit = reason == android.app.ApplicationExitInfo.REASON_CRASH_NATIVE ||
                  reason == android.app.ApplicationExitInfo.REASON_ANR ||
                  reason == android.app.ApplicationExitInfo.REASON_LOW_MEMORY ||
                  reason == android.app.ApplicationExitInfo.REASON_CRASH
              if (isCrashExit && exitInfo.timestamp > lastSeenExitTime) {
                if (exitInfo.timestamp > maxSeenTime) maxSeenTime = exitInfo.timestamp
                val reasonName = when (reason) {
                  android.app.ApplicationExitInfo.REASON_CRASH_NATIVE -> "NATIVE_CPP_CRASH (SIGSEGV/SIGABRT)"
                  android.app.ApplicationExitInfo.REASON_ANR -> "ANR (Application Not Responding)"
                  android.app.ApplicationExitInfo.REASON_LOW_MEMORY -> "LOW_MEMORY (OOM Kill)"
                  else -> "JVM_CRASH"
                }
                val desc = (exitInfo.description ?: reasonName).replace("\"", "\\\"").replace("\n", "\\n")
                val entry = "{\"timestamp\":\"${exitInfo.timestamp}\",\"thread\":\"os_exit_monitor\",\"message\":\"$reasonName: $desc\",\"stack\":\"Status=${exitInfo.status}, Importance=${exitInfo.importance}, PSS=${exitInfo.pss}KB, RSS=${exitInfo.rss}KB\"}"
                existing = if (existing == "[]") "[$entry]" else existing.replace("]", ",$entry]")
              }
            }
            if (maxSeenTime > lastSeenExitTime) {
              prefs.edit().putString("logs", existing).putLong("last_exit_timestamp", maxSeenTime).apply()
            }
          }
        } catch (e: Exception) {}
      }

      val oldHandler = Thread.getDefaultUncaughtExceptionHandler()
      Thread.setDefaultUncaughtExceptionHandler { thread, throwable ->
        try {
          val prefs = context.getSharedPreferences("taskflow_native_crashes", Context.MODE_PRIVATE)
          val existing = prefs.getString("logs", "[]") ?: "[]"
          val stackTrace = Log.getStackTraceString(throwable)
          val entry = "{\"timestamp\":\"${System.currentTimeMillis()}\",\"thread\":\"${thread.name}\",\"message\":\"${throwable.message ?: "Native Exception"}\",\"stack\":\"${stackTrace.replace("\"", "\\\"").replace("\n", "\\n")}\"}"
          val updated = if (existing == "[]") "[$entry]" else existing.replace("]", ",$entry]")
          prefs.edit().putString("logs", updated).commit()
        } catch (e: Exception) {
          // ignore
        }
        oldHandler?.uncaughtException(thread, throwable)
      }
      return@Function true
    }

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

    AsyncFunction("scheduleExactAlarm") { taskId: String, taskName: String, triggerTimeMillis: Long, soundOrChannel: String?, presentationStyle: String?, keepNotificationAllDay: Boolean?, explicitChannelId: String? ->
      val context = appContext.reactContext ?: return@AsyncFunction false
      
      val resolvedChannelId: String
      val resolvedSoundName: String?

      if (!explicitChannelId.isNullOrEmpty()) {
          resolvedSoundName = soundOrChannel
          resolvedChannelId = explicitChannelId
      } else if (!soundOrChannel.isNullOrEmpty() && (soundOrChannel.startsWith("task_") || soundOrChannel.contains("channel") || soundOrChannel.contains("_vib"))) {
          resolvedChannelId = soundOrChannel
          // If channelId is like task_alarm_alarm_02_vib1_v17, extract sound basename
          val match = Regex("""task_alarm_(.+)_vib[01]_""").find(soundOrChannel)
          resolvedSoundName = match?.groupValues?.get(1) ?: "alarm_02"
      } else {
          resolvedSoundName = soundOrChannel
          resolvedChannelId = "task_alarm_channel"
      }

      val style = presentationStyle ?: "adaptive"

      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
          val notificationManager = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager

          // Purge legacy split channels (*_fs_v* and *_popup_v*) that had null sound
          try {
              for (ch in notificationManager.notificationChannels) {
                  if (ch.id.contains("_fs_v") || ch.id.contains("_popup_v")) {
                      notificationManager.deleteNotificationChannel(ch.id)
                  }
              }
          } catch (e: Exception) {}

          if (notificationManager.getNotificationChannel(resolvedChannelId) == null) {
              val soundUri = AlarmAudioManager.getSoundUri(context, resolvedSoundName)
              val audioAttributes = AudioAttributes.Builder()
                  .setUsage(AudioAttributes.USAGE_ALARM)
                  .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                  .build()
              val alarmChannel = NotificationChannel(resolvedChannelId, "Task alarms", NotificationManager.IMPORTANCE_HIGH).apply {
                  description = "Urgent task alarms with sound and vibration"
                  setSound(soundUri, audioAttributes)
                  enableVibration(!resolvedChannelId.contains("_vib0_"))
                  setBypassDnd(true)
                  lockscreenVisibility = Notification.VISIBILITY_PUBLIC
              }
              notificationManager.createNotificationChannel(alarmChannel)
          }
      }

      val requestCode = taskId.hashCode()

      val alarmManager = context.getSystemService(Context.ALARM_SERVICE) as AlarmManager

      val receiverIntent = Intent(context, TaskAlarmReceiver::class.java).apply {
          putExtra("taskId", taskId)
          putExtra("taskName", taskName)
          putExtra("channelId", resolvedChannelId)
          putExtra("soundName", resolvedSoundName)
          putExtra("requestCode", requestCode)
          putExtra("presentationStyle", style)
          putExtra("keepNotificationAllDay", keepNotificationAllDay ?: false)
      }

      val pendingIntent = PendingIntent.getBroadcast(
          context,
          requestCode,
          receiverIntent,
          PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
      )

      try {
          val canExact = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
              alarmManager.canScheduleExactAlarms()
          } else {
              true
          }

          if (canExact) {
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
          } else {
              // Google Play & Android 14+ Battery Policy Fallback
              if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                  alarmManager.setAndAllowWhileIdle(
                      AlarmManager.RTC_WAKEUP,
                      triggerTimeMillis,
                      pendingIntent
                  )
              } else {
                  alarmManager.set(
                      AlarmManager.RTC_WAKEUP,
                      triggerTimeMillis,
                      pendingIntent
                  )
              }
          }
      } catch (e: SecurityException) {
          Log.w("ExpoTaskAlarm", "Exact alarm denied by system policy, falling back to inexact alarm: ${e.message}")
          try {
              if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                  alarmManager.setAndAllowWhileIdle(
                      AlarmManager.RTC_WAKEUP,
                      triggerTimeMillis,
                      pendingIntent
                  )
              } else {
                  alarmManager.set(
                      AlarmManager.RTC_WAKEUP,
                      triggerTimeMillis,
                      pendingIntent
                  )
              }
          } catch (fallbackError: Exception) {
              Log.e("ExpoTaskAlarm", "Fallback alarm scheduling failed", fallbackError)
              return@AsyncFunction false
          }
      } catch (e: Exception) {
          Log.e("ExpoTaskAlarm", "Failed to schedule alarm", e)
          return@AsyncFunction false
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

      try {
          val canExact = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
              alarmManager.canScheduleExactAlarms()
          } else {
              true
          }

          if (canExact) {
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
          } else {
              if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                  alarmManager.setAndAllowWhileIdle(
                      AlarmManager.RTC_WAKEUP,
                      triggerTimeMillis,
                      pendingIntent
                  )
              } else {
                  alarmManager.set(
                      AlarmManager.RTC_WAKEUP,
                      triggerTimeMillis,
                      pendingIntent
                  )
              }
          }
      } catch (e: SecurityException) {
          Log.w("ExpoTaskAlarm", "Exact alarm denied, falling back for pomodoro: ${e.message}")
          try {
              if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                  alarmManager.setAndAllowWhileIdle(
                      AlarmManager.RTC_WAKEUP,
                      triggerTimeMillis,
                      pendingIntent
                  )
              } else {
                  alarmManager.set(
                      AlarmManager.RTC_WAKEUP,
                      triggerTimeMillis,
                      pendingIntent
                  )
              }
          } catch (fallbackError: Exception) {
              Log.e("ExpoTaskAlarm", "Pomodoro fallback alarm failed", fallbackError)
              return@AsyncFunction false
          }
      } catch (e: Exception) {
          Log.e("ExpoTaskAlarm", "Failed to schedule pomodoro alarm", e)
          return@AsyncFunction false
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
      try {
          NotificationManagerCompat.from(context).cancel(requestCode)
          AlarmAudioManager.stopAlarmSound(context)
      } catch (e: Exception) {
          e.printStackTrace()
      }
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

    AsyncFunction("setScreenSecurityAsync") { enabled: Boolean ->
      val activity = appContext.currentActivity ?: return@AsyncFunction false
      activity.runOnUiThread {
        try {
          if (enabled) {
            activity.window.addFlags(WindowManager.LayoutParams.FLAG_SECURE)
          } else {
            activity.window.clearFlags(WindowManager.LayoutParams.FLAG_SECURE)
          }
        } catch (e: Exception) {
          e.printStackTrace()
        }
      }
      return@AsyncFunction true
    }

    AsyncFunction("isScreenSecurityEnabled") {
      val activity = appContext.currentActivity ?: return@AsyncFunction false
      val flags = activity.window.attributes.flags
      return@AsyncFunction (flags and WindowManager.LayoutParams.FLAG_SECURE) != 0
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
