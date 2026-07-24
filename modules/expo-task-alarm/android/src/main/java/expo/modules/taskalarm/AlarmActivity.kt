package expo.modules.taskalarm

import android.app.Activity
import android.app.KeyguardManager
import android.content.Context
import android.os.Build
import android.os.Bundle
import android.view.WindowManager
import android.widget.Button
import android.widget.TextView
import android.app.PendingIntent
import android.app.AlarmManager
import androidx.core.app.NotificationManagerCompat
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import android.content.Intent
import android.net.Uri

class AlarmActivity : Activity() {

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        // Wake screen
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O_MR1) {
            setShowWhenLocked(true)
            setTurnScreenOn(true)
            val keyguardManager = getSystemService(Context.KEYGUARD_SERVICE) as KeyguardManager
            keyguardManager.requestDismissKeyguard(this, null)
        } else {
            @Suppress("DEPRECATION")
            window.addFlags(
                WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED or
                WindowManager.LayoutParams.FLAG_TURN_SCREEN_ON or
                WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON
            )
        }

        val layoutId = resources.getIdentifier("activity_alarm", "layout", packageName)
        setContentView(layoutId)

        val taskName = intent.getStringExtra("taskName") ?: "Unknown Task"
        val channelId = intent.getStringExtra("channelId") ?: "task_alarm_channel"
        val requestCode = intent.getIntExtra("requestCode", 0)
        val taskId = intent.getStringExtra("taskId") ?: ""
        
        val titleId = resources.getIdentifier("alarm_title", "id", packageName)
        val nameId = resources.getIdentifier("alarm_task_name", "id", packageName)
        val dismissBtnId = resources.getIdentifier("alarm_dismiss_button", "id", packageName)
        val snoozeBtnId = resources.getIdentifier("alarm_snooze_button", "id", packageName)

        val titleView = findViewById<TextView>(titleId)
        titleView?.text = taskName
        
        titleView?.setOnClickListener {
            NotificationManagerCompat.from(this).cancel(requestCode)
            
            if (taskId.isNotEmpty()) {
                val launchIntent = Intent(Intent.ACTION_VIEW, Uri.parse("taskmanager://board?editTaskId=$taskId"))
                launchIntent.flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
                startActivity(launchIntent)
            } else {
                val launchIntent = packageManager.getLaunchIntentForPackage(packageName)
                launchIntent?.flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
                startActivity(launchIntent)
            }
            finish()
        }
        
        val dateFormat = SimpleDateFormat("EEE, MMM d • hh:mm a", Locale.getDefault())
        val currentDateTime = dateFormat.format(Date())
        findViewById<TextView>(nameId)?.text = currentDateTime

        findViewById<Button>(dismissBtnId)?.setOnClickListener {
            NotificationManagerCompat.from(this).cancel(requestCode)
            finish()
        }

        findViewById<Button>(snoozeBtnId)?.setOnClickListener {
            NotificationManagerCompat.from(this).cancel(requestCode)
            
            val alarmManager = getSystemService(Context.ALARM_SERVICE) as AlarmManager
            val snoozeIntent = Intent(this, TaskAlarmReceiver::class.java).apply {
                putExtra("taskId", taskId)
                putExtra("taskName", taskName)
                putExtra("channelId", channelId)
                putExtra("requestCode", requestCode)
            }
            val pendingIntent = PendingIntent.getBroadcast(
                this,
                requestCode,
                snoozeIntent,
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
            )
            
            val triggerTime = System.currentTimeMillis() + 5 * 60 * 1000 // 5 minutes
            
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                alarmManager.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, triggerTime, pendingIntent)
            } else {
                alarmManager.setExact(AlarmManager.RTC_WAKEUP, triggerTime, pendingIntent)
            }
            
            finish()
        }
    }
}
