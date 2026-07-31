package expo.modules.taskalarm

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.os.PowerManager
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat

class PomodoroAlarmReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        val title = intent.getStringExtra("title") ?: "Pomodoro"
        val body = intent.getStringExtra("body") ?: "Session Complete"
        val channelId = intent.getStringExtra("channelId") ?: "task_default_system_sound_v16"
        val requestCode = intent.getIntExtra("requestCode", 0)

        // Wake the screen for Heads-Up notification
        val powerManager = context.getSystemService(Context.POWER_SERVICE) as PowerManager
        val wakeLock = powerManager.newWakeLock(
            PowerManager.FULL_WAKE_LOCK or PowerManager.ACQUIRE_CAUSES_WAKEUP or PowerManager.ON_AFTER_RELEASE,
            "TaskFlow::PomodoroWakeLock"
        )
        wakeLock.acquire(3000) // Wake for 3 seconds to let notification pop

        // Find the generic notification icon or fallback to default
        var iconResId = context.resources.getIdentifier("notification_icon", "drawable", context.packageName)
        if (iconResId == 0) {
            iconResId = context.resources.getIdentifier("ic_launcher", "mipmap", context.packageName)
        }

        // App launch intent if clicked
        val launchIntent = context.packageManager.getLaunchIntentForPackage(context.packageName)
        launchIntent?.flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
        val pendingLaunchIntent = android.app.PendingIntent.getActivity(
            context,
            requestCode,
            launchIntent,
            android.app.PendingIntent.FLAG_UPDATE_CURRENT or android.app.PendingIntent.FLAG_IMMUTABLE
        )

        val notification = NotificationCompat.Builder(context, channelId)
            .setSmallIcon(iconResId)
            .setContentTitle(title)
            .setContentText(body)
            .setPriority(NotificationCompat.PRIORITY_MAX)
            .setCategory(NotificationCompat.CATEGORY_ALARM)
            .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
            .setContentIntent(pendingLaunchIntent)
            .setAutoCancel(true)
            .setDefaults(NotificationCompat.DEFAULT_ALL)
            .build()
            
        notification.flags = notification.flags or android.app.Notification.FLAG_INSISTENT

        try {
            NotificationManagerCompat.from(context).notify(requestCode, notification)
        } catch (e: SecurityException) {
            e.printStackTrace()
        }
    }
}
