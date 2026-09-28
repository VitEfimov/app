package expo.modules.taskalarm

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.app.PendingIntent
import android.app.AlarmManager
import androidx.core.app.NotificationManagerCompat
import android.os.Build

class AlarmActionReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        val action = intent.action
        val notificationId = intent.getIntExtra("requestCode", 0)

        // Dismiss the notification (this stops the sound because FLAG_INSISTENT is tied to the notification)
        NotificationManagerCompat.from(context).cancel(notificationId)

        if (action == "SNOOZE_ALARM") {
            val taskId = intent.getStringExtra("taskId") ?: ""
            val taskName = intent.getStringExtra("taskName") ?: "Unknown Task"
            val channelId = intent.getStringExtra("channelId") ?: "task_alarm_channel"
            
            val alarmManager = context.getSystemService(Context.ALARM_SERVICE) as AlarmManager
            val snoozeIntent = Intent(context, TaskAlarmReceiver::class.java).apply {
                putExtra("taskId", taskId)
                putExtra("taskName", taskName)
                putExtra("channelId", channelId)
                putExtra("requestCode", notificationId)
            }
            
            val pendingIntent = PendingIntent.getBroadcast(
                context,
                notificationId,
                snoozeIntent,
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
            )
            
            val triggerTime = System.currentTimeMillis() + 5 * 60 * 1000 // 5 minutes
            
            try {
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                    if (alarmManager.canScheduleExactAlarms()) {
                        alarmManager.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, triggerTime, pendingIntent)
                    } else {
                        alarmManager.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, triggerTime, pendingIntent)
                    }
                } else if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                    alarmManager.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, triggerTime, pendingIntent)
                } else {
                    alarmManager.setExact(AlarmManager.RTC_WAKEUP, triggerTime, pendingIntent)
                }
            } catch (e: Exception) {
                try {
                    alarmManager.set(AlarmManager.RTC_WAKEUP, triggerTime, pendingIntent)
                } catch (e2: Exception) {
                    e2.printStackTrace()
                }
            }
        }
    }
}
