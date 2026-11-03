package expo.modules.taskalarm

import android.app.AlarmManager
import android.app.PendingIntent
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Build
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat

class AlarmActionReceiver : BroadcastReceiver() {

    companion object {
        fun postSilentPersistentReminder(context: Context, notificationId: Int, taskName: String, taskId: String) {
            val channelId = "task_persistent_silent_channel"
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                val nm = context.getSystemService(Context.NOTIFICATION_SERVICE) as? android.app.NotificationManager
                if (nm != null && nm.getNotificationChannel(channelId) == null) {
                    val channel = android.app.NotificationChannel(
                        channelId,
                        "Persistent Reminders",
                        android.app.NotificationManager.IMPORTANCE_LOW
                    ).apply {
                        description = "Silent all-day reminders for tasks"
                        setSound(null, null)
                        enableVibration(false)
                    }
                    nm.createNotificationChannel(channel)
                }
            }

            var iconResId = context.resources.getIdentifier("notification_icon", "drawable", context.packageName)
            if (iconResId == 0) {
                iconResId = context.resources.getIdentifier("ic_launcher", "mipmap", context.packageName)
            }

            val launchIntent = if (taskId.isNotEmpty()) {
                val safeTaskId = Uri.encode(taskId)
                Intent(Intent.ACTION_VIEW, Uri.parse("taskmanager://board?editTaskId=$safeTaskId")).apply {
                    setPackage(context.packageName)
                    flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
                }
            } else {
                context.packageManager.getLaunchIntentForPackage(context.packageName)?.apply {
                    flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
                }
            }

            val contentPendingIntent = PendingIntent.getActivity(
                context,
                notificationId + 5000,
                launchIntent,
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
            )

            val dismissIntent = Intent(context, AlarmActionReceiver::class.java).apply {
                action = "DISMISS_PERSISTENT"
                putExtra("requestCode", notificationId)
            }
            val dismissPendingIntent = PendingIntent.getBroadcast(
                context,
                notificationId + 6000,
                dismissIntent,
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
            )

            val notification = NotificationCompat.Builder(context, channelId)
                .setSmallIcon(iconResId)
                .setContentTitle("Task Reminder")
                .setContentText(taskName)
                .setPriority(NotificationCompat.PRIORITY_LOW)
                .setCategory(NotificationCompat.CATEGORY_REMINDER)
                .setContentIntent(contentPendingIntent)
                .setOngoing(true)
                .setAutoCancel(false)
                .setSound(null)
                .setVibrate(null)
                .addAction(0, "Dismiss", dismissPendingIntent)
                .build()

            try {
                NotificationManagerCompat.from(context).notify(notificationId, notification)
            } catch (e: SecurityException) {
                e.printStackTrace()
            }
        }
    }

    override fun onReceive(context: Context, intent: Intent) {
        val action = intent.action
        val notificationId = intent.getIntExtra("requestCode", 0)
        val keepAllDay = intent.getBooleanExtra("keepNotificationAllDay", false)
        val taskId = intent.getStringExtra("taskId") ?: ""
        val taskName = intent.getStringExtra("taskName") ?: "Task"
        val channelId = intent.getStringExtra("channelId") ?: "task_alarm_channel"
        val presentationStyle = intent.getStringExtra("presentationStyle") ?: "fullscreen"

        // Stop continuous alarm sound playback and release focus
        AlarmAudioManager.stopAlarmSound(context)

        if (action == "STOP_ALARM") {
            if (keepAllDay) {
                // If keep notification all day is enabled, replace alarm with a silent persistent notification
                postSilentPersistentReminder(context, notificationId, taskName, taskId)
            } else {
                NotificationManagerCompat.from(context).cancel(notificationId)
            }
            return
        }

        if (action == "DISMISS_PERSISTENT") {
            NotificationManagerCompat.from(context).cancel(notificationId)
            return
        }

        // Snooze always dismisses current notification and schedules 5-min snooze
        NotificationManagerCompat.from(context).cancel(notificationId)

        if (action == "SNOOZE_ALARM") {
            val alarmManager = context.getSystemService(Context.ALARM_SERVICE) as AlarmManager
            val snoozeIntent = Intent(context, TaskAlarmReceiver::class.java).apply {
                putExtra("taskId", taskId)
                putExtra("taskName", taskName)
                putExtra("channelId", channelId)
                putExtra("requestCode", notificationId)
                putExtra("presentationStyle", presentationStyle)
                putExtra("keepNotificationAllDay", keepAllDay)
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
