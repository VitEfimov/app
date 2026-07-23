package expo.modules.taskalarm

import android.app.PendingIntent
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat

class TaskAlarmReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        val taskName = intent.getStringExtra("taskName") ?: "Task Alarm"
        val soundName = intent.getStringExtra("soundName") ?: "default"
        val requestCode = intent.getIntExtra("requestCode", 0)

        val taskId = intent.getStringExtra("taskId") ?: ""

        // Wake intent
        val alarmIntent = Intent(context, AlarmActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
            putExtra("taskId", taskId)
            putExtra("taskName", taskName)
            putExtra("soundName", soundName)
            putExtra("requestCode", requestCode)
        }

        val fullScreenPendingIntent = PendingIntent.getActivity(
            context,
            requestCode,
            alarmIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        // Find the generic notification icon or fallback to default
        var iconResId = context.resources.getIdentifier("notification_icon", "drawable", context.packageName)
        if (iconResId == 0) {
            iconResId = context.resources.getIdentifier("ic_launcher", "mipmap", context.packageName)
        }

        val notification = NotificationCompat.Builder(context, "task_alarm_channel")
            .setSmallIcon(iconResId)
            .setContentTitle("Task Alarm")
            .setContentText(taskName)
            .setPriority(NotificationCompat.PRIORITY_MAX)
            .setCategory(NotificationCompat.CATEGORY_ALARM)
            .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
            .setFullScreenIntent(fullScreenPendingIntent, true)
            .setOngoing(true)
            .setAutoCancel(false)
            .build()

        try {
            NotificationManagerCompat.from(context).notify(requestCode, notification)
        } catch (e: SecurityException) {
            e.printStackTrace()
        }
    }
}
