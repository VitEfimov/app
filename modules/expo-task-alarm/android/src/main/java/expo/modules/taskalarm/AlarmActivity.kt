package expo.modules.taskalarm

import android.app.Activity
import android.app.KeyguardManager
import android.content.Context
import android.media.AudioAttributes
import android.media.MediaPlayer
import android.os.Build
import android.os.Bundle
import android.os.Vibrator
import android.os.VibratorManager
import android.view.WindowManager
import android.widget.Button
import android.widget.TextView
import androidx.core.app.NotificationManagerCompat
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import android.content.Intent
import android.net.Uri

class AlarmActivity : Activity() {
    private var mediaPlayer: MediaPlayer? = null
    private var vibrator: Vibrator? = null

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
        val soundName = intent.getStringExtra("soundName") ?: "default"
        val requestCode = intent.getIntExtra("requestCode", 0)
        val taskId = intent.getStringExtra("taskId") ?: ""
        
        val titleId = resources.getIdentifier("alarm_title", "id", packageName)
        val nameId = resources.getIdentifier("alarm_task_name", "id", packageName)
        val dismissBtnId = resources.getIdentifier("alarm_dismiss_button", "id", packageName)
        val snoozeBtnId = resources.getIdentifier("alarm_snooze_button", "id", packageName)

        val titleView = findViewById<TextView>(titleId)
        titleView?.text = taskName
        
        titleView?.setOnClickListener {
            stopAlarm()
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
            stopAlarm()
            NotificationManagerCompat.from(this).cancel(requestCode)
            finish()
        }

        findViewById<Button>(snoozeBtnId)?.setOnClickListener {
            stopAlarm()
            NotificationManagerCompat.from(this).cancel(requestCode)
            finish()
        }

        startAlarmSoundAndVibration(soundName)
    }

    private fun startAlarmSoundAndVibration(soundName: String) {
        val soundResId = resources.getIdentifier(soundName, "raw", packageName)
        if (soundResId != 0) {
            mediaPlayer = MediaPlayer.create(this, soundResId)?.apply {
                isLooping = true
                val attrs = AudioAttributes.Builder()
                    .setUsage(AudioAttributes.USAGE_ALARM)
                    .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                    .build()
                setAudioAttributes(attrs)
                start()
            }
        }

        vibrator = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            val vibratorManager = getSystemService(Context.VIBRATOR_MANAGER_SERVICE) as VibratorManager
            vibratorManager.defaultVibrator
        } else {
            @Suppress("DEPRECATION")
            getSystemService(Context.VIBRATOR_SERVICE) as Vibrator
        }
        
        @Suppress("DEPRECATION")
        vibrator?.vibrate(longArrayOf(0, 500, 500), 0) // Vibrate in a loop
    }

    private fun stopAlarm() {
        mediaPlayer?.stop()
        mediaPlayer?.release()
        mediaPlayer = null

        vibrator?.cancel()
    }

    override fun onDestroy() {
        super.onDestroy()
        stopAlarm()
    }
}
