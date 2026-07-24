package expo.modules.taskalarm

import android.app.AlarmManager
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.os.Build
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class ExpoTaskAlarmModule : Module() {
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
  }
}
