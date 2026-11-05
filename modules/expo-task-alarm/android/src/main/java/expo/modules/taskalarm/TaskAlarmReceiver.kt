package expo.modules.taskalarm

import android.app.KeyguardManager
import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.media.AudioAttributes
import android.os.Build
import android.os.PowerManager
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat

class TaskAlarmReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        val taskName = intent.getStringExtra("taskName") ?: "Task Alarm"
        val channelId = intent.getStringExtra("channelId") ?: "task_alarm_channel"
        val requestCode = intent.getIntExtra("requestCode", 0)
        val taskId = intent.getStringExtra("taskId") ?: ""
        val presentationStyle = intent.getStringExtra("presentationStyle") ?: "fullscreen"
        val keepNotificationAllDay = intent.getBooleanExtra("keepNotificationAllDay", false)
        val soundName = intent.getStringExtra("soundName")

        val powerManager = context.getSystemService(Context.POWER_SERVICE) as? PowerManager
        val wakeLock = powerManager?.newWakeLock(
            PowerManager.PARTIAL_WAKE_LOCK or PowerManager.ACQUIRE_CAUSES_WAKEUP,
            "expo:taskalarm:receiver"
        )
        try {
            wakeLock?.acquire(10000)
        } catch (e: Exception) {}

        val keyguardManager = context.getSystemService(Context.KEYGUARD_SERVICE) as? KeyguardManager
        val isInteractive = powerManager?.isInteractive ?: false
        val isLocked = keyguardManager?.isKeyguardLocked ?: false

        // Locked screen (or screen off) -> full screen; active/unlocked phone -> popup banner
        val isFullScreenMode = !isInteractive || isLocked
        val isCar = CarUtils.isConnectedToCar(context)
        val activeChannelId = if (isCar) "task_car_silent_channel_v1" else channelId

        // Wake intent
        val alarmIntent = Intent(context, AlarmActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP or Intent.FLAG_ACTIVITY_REORDER_TO_FRONT or Intent.FLAG_ACTIVITY_SINGLE_TOP
            putExtra("taskId", taskId)
            putExtra("taskName", taskName)
            putExtra("channelId", channelId)
            putExtra("requestCode", requestCode)
            putExtra("isCar", isCar)
            putExtra("presentationStyle", presentationStyle)
            putExtra("keepNotificationAllDay", keepNotificationAllDay)
            putExtra("soundName", soundName)
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
            putExtra("taskId", taskId)
            putExtra("taskName", taskName)
            putExtra("channelId", channelId)
            putExtra("keepNotificationAllDay", keepNotificationAllDay)
        }
        val stopPendingIntent = PendingIntent.getBroadcast(context, requestCode + 1000, stopIntent, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)

        val snoozeIntent = Intent(context, AlarmActionReceiver::class.java).apply {
            action = "SNOOZE_ALARM"
            putExtra("requestCode", requestCode)
            putExtra("taskId", taskId)
            putExtra("taskName", taskName)
            putExtra("channelId", channelId)
            putExtra("presentationStyle", presentationStyle)
            putExtra("keepNotificationAllDay", keepNotificationAllDay)
            putExtra("soundName", soundName)
        }
        val snoozePendingIntent = PendingIntent.getBroadcast(context, requestCode + 2000, snoozeIntent, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)

        val soundUri = if (isCar) null else AlarmAudioManager.getSoundUri(context, soundName)

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val nm = context.getSystemService(Context.NOTIFICATION_SERVICE) as? NotificationManager
            if (nm != null && nm.getNotificationChannel(activeChannelId) == null) {
                val audioAttributes = AudioAttributes.Builder()
                    .setUsage(AudioAttributes.USAGE_ALARM)
                    .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                    .build()
                val fallbackChannel = NotificationChannel(
                    activeChannelId,
                    if (isCar) "Car / Driving notifications" else "Task alarms",
                    NotificationManager.IMPORTANCE_HIGH
                ).apply {
                    description = if (isCar) "Silent notifications when connected to Car" else "Urgent task alarms with sound and vibration"
                    if (isCar) {
                        setSound(null, null)
                        enableVibration(false)
                    } else {
                        setSound(soundUri, audioAttributes)
                        enableVibration(!activeChannelId.contains("_vib0_"))
                        setBypassDnd(true)
                    }
                    lockscreenVisibility = Notification.VISIBILITY_PUBLIC
                }
                nm.createNotificationChannel(fallbackChannel)
            }
        }

        val notificationBuilder = NotificationCompat.Builder(context, activeChannelId)
            .setSmallIcon(iconResId)
            .setContentTitle("Task Alarm")
            .setContentText(taskName)
            .setCategory(NotificationCompat.CATEGORY_ALARM)
            .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
            .setContentIntent(fullScreenPendingIntent)
            .setOngoing(true)
            .setAutoCancel(false)
            .setPriority(NotificationCompat.PRIORITY_MAX)
            .addAction(0, "Snooze", snoozePendingIntent)
            .addAction(0, "Stop", stopPendingIntent)

        if (isCar) {
            notificationBuilder.setSound(null)
            notificationBuilder.setVibrate(null)
        } else {
            notificationBuilder.setSound(soundUri)
            notificationBuilder.setDefaults(Notification.DEFAULT_VIBRATE or Notification.DEFAULT_LIGHTS)
        }

        if (isFullScreenMode) {
            notificationBuilder.setFullScreenIntent(fullScreenPendingIntent, true)
        }

        val notification = notificationBuilder.build()

        if (!isCar) {
            // Native Android insistent looping on the system USAGE_ALARM stream.
            // Guarantees reliable playback while app is closed/minimized and prevents double sounding.
            notification.flags = notification.flags or Notification.FLAG_INSISTENT
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
