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
        val channelId = intent.getStringExtra("channelId") ?: "task_alarm_channel"
        val requestCode = intent.getIntExtra("requestCode", 0)

        val taskId = intent.getStringExtra("taskId") ?: ""
        val presentationStyle = intent.getStringExtra("presentationStyle") ?: "fullscreen"

        val keyguardManager = context.getSystemService(Context.KEYGUARD_SERVICE) as? KeyguardManager
        val powerManager = context.getSystemService(Context.POWER_SERVICE) as? PowerManager
        val isInteractive = powerManager?.isInteractive ?: false
        val isLocked = keyguardManager?.isKeyguardLocked ?: false

        val isFullScreenMode = (presentationStyle == "fullscreen") || (presentationStyle == "adaptive" && (!isInteractive || isLocked))
        val isPopupMode = (presentationStyle == "popup") || (presentationStyle == "adaptive" && isInteractive && !isLocked)

        val activeChannelId = if (isFullScreenMode) "${channelId}_fs" else channelId
        val isCar = CarUtils.isConnectedToCar(context)

        // Wake intent
        val alarmIntent = Intent(context, AlarmActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP or Intent.FLAG_ACTIVITY_REORDER_TO_FRONT or Intent.FLAG_ACTIVITY_SINGLE_TOP
            putExtra("taskId", taskId)
            putExtra("taskName", taskName)
            putExtra("channelId", channelId)
            putExtra("requestCode", requestCode)
            putExtra("isCar", isCar)
            putExtra("presentationStyle", presentationStyle)
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

        val stopIntent = Intent(context, AlarmActionReceiver::class.java).apply {
            action = "STOP_ALARM"
            putExtra("requestCode", requestCode)
        }
        val stopPendingIntent = PendingIntent.getBroadcast(context, requestCode + 1000, stopIntent, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)

        val snoozeIntent = Intent(context, AlarmActionReceiver::class.java).apply {
            action = "SNOOZE_ALARM"
            putExtra("requestCode", requestCode)
            putExtra("taskId", taskId)
            putExtra("taskName", taskName)
            putExtra("channelId", channelId)
            putExtra("presentationStyle", presentationStyle)
        }
        val snoozePendingIntent = PendingIntent.getBroadcast(context, requestCode + 2000, snoozeIntent, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)

        val notificationBuilder = NotificationCompat.Builder(context, activeChannelId)
            .setSmallIcon(iconResId)
            .setContentTitle("Task Alarm")
            .setContentText(taskName)
            .setCategory(NotificationCompat.CATEGORY_ALARM)
            .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
            .setContentIntent(fullScreenPendingIntent)
            .setOngoing(true)
            .setAutoCancel(false)
            .addAction(0, "Snooze", snoozePendingIntent)
            .addAction(0, "Stop", stopPendingIntent)

        if (isFullScreenMode) {
            // In Full-Screen mode, priority is DEFAULT so Android does not show a heads-up popup banner over the full-screen activity
            notificationBuilder.setPriority(NotificationCompat.PRIORITY_DEFAULT)
            if (!isInteractive || isLocked) {
                // If screen is locked or off, fullScreenIntent will wake the device to full-screen activity (no heads-up banner on lockscreen)
                notificationBuilder.setFullScreenIntent(fullScreenPendingIntent, true)
            }
        } else {
            // In Popup mode, priority is MAX so Android drops down the heads-up notification banner with action buttons
            notificationBuilder.setPriority(NotificationCompat.PRIORITY_MAX)
        }

        if (isCar) {
            // Mute completely when connected to Android Auto / car
            notificationBuilder.setSound(null)
            notificationBuilder.setVibrate(null)
        } else {
            // Request audio focus to pause/stop background media (e.g. YouTube, Spotify)
            AlarmAudioManager.requestAlarmFocus(context)
            notificationBuilder.setDefaults(NotificationCompat.DEFAULT_LIGHTS)
        }

        val notification = notificationBuilder.build()
        if (!isCar) {
            notification.flags = notification.flags or android.app.Notification.FLAG_INSISTENT
        }

        try {
            NotificationManagerCompat.from(context).notify(requestCode, notification)
        } catch (e: SecurityException) {
            e.printStackTrace()
        }

        if (isFullScreenMode) {
            try {
                alarmIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP or Intent.FLAG_ACTIVITY_REORDER_TO_FRONT or Intent.FLAG_ACTIVITY_SINGLE_TOP)
                context.startActivity(alarmIntent)
            } catch (e: Exception) {
                try {
                    fullScreenPendingIntent.send()
                } catch (e2: Exception) {
                    e2.printStackTrace()
                }
            }
        }
    }
}
