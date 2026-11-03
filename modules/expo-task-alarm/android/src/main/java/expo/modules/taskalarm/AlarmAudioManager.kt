package expo.modules.taskalarm

import android.app.UiModeManager
import android.content.Context
import android.content.IntentFilter
import android.content.res.Configuration
import android.media.AudioAttributes
import android.media.AudioFocusRequest
import android.media.AudioManager
import android.media.MediaPlayer
import android.media.RingtoneManager
import android.net.Uri
import android.os.Build

object CarUtils {
    fun isConnectedToCar(context: Context): Boolean {
        // 1. Check TaskFlowCarService static flag
        try {
            val clazz = Class.forName("com.vitvalef.app.TaskFlowCarService")
            val field = clazz.getDeclaredField("isCarConnected")
            field.isAccessible = true
            if (field.getBoolean(null)) {
                return true
            }
        } catch (ignored: Throwable) {}

        // 2. Check Android standard UiModeManager for Car Mode
        try {
            val uiModeManager = context.getSystemService(Context.UI_MODE_SERVICE) as? UiModeManager
            if (uiModeManager?.currentModeType == Configuration.UI_MODE_TYPE_CAR) {
                return true
            }
        } catch (ignored: Throwable) {}

        // 3. Check Google Play Services Android Auto Projection Status
        try {
            val filter = IntentFilter("com.google.android.gms.car.PROJECTION_STATUS")
            val stickyIntent = context.registerReceiver(null, filter)
            if (stickyIntent != null) {
                val status = stickyIntent.getIntExtra("status", 0)
                if (status != 0) {
                    return true
                }
            }
        } catch (ignored: Throwable) {}

        return false
    }
}

object AlarmAudioManager {
    private var focusRequest: AudioFocusRequest? = null
    private var mediaPlayer: MediaPlayer? = null

    fun getSoundUri(context: Context, soundName: String?): Uri {
        if (!soundName.isNullOrEmpty()) {
            val cleanName = soundName.replace(".mp3", "").replace(".wav", "").lowercase()
            val resId = context.resources.getIdentifier(cleanName, "raw", context.packageName)
            if (resId != 0) {
                return Uri.parse("android.resource://${context.packageName}/$resId")
            }
        }
        val defaultAlarm = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_ALARM)
        if (defaultAlarm != null) return defaultAlarm
        val defaultNotif = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION)
        if (defaultNotif != null) return defaultNotif
        return RingtoneManager.getDefaultUri(RingtoneManager.TYPE_RINGTONE)
    }

    /**
     * Start continuous looping alarm sound with USAGE_ALARM stream.
     */
    @Synchronized
    fun startAlarmSound(context: Context, soundName: String? = null) {
        requestAlarmFocus(context)
        try {
            stopAlarmSound(context, retainFocus = true)
            val uri = getSoundUri(context, soundName)
            val player = MediaPlayer().apply {
                setDataSource(context, uri)
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
                    setAudioAttributes(
                        AudioAttributes.Builder()
                            .setUsage(AudioAttributes.USAGE_ALARM)
                            .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                            .build()
                    )
                } else {
                    @Suppress("DEPRECATION")
                    setAudioStreamType(AudioManager.STREAM_ALARM)
                }
                isLooping = true
                prepare()
                start()
            }
            mediaPlayer = player
        } catch (e: Exception) {
            e.printStackTrace()
        }
    }

    /**
     * Stop continuous alarm audio playback and release player.
     */
    @Synchronized
    fun stopAlarmSound(context: Context, retainFocus: Boolean = false) {
        try {
            mediaPlayer?.let {
                if (it.isPlaying) {
                    it.stop()
                }
                it.reset()
                it.release()
            }
        } catch (e: Exception) {
            e.printStackTrace()
        } finally {
            mediaPlayer = null
        }
        if (!retainFocus) {
            abandonAlarmFocus(context)
        }
    }

    /**
     * Request transient audio focus for urgent alarm.
     */
    fun requestAlarmFocus(context: Context) {
        val audioManager = context.getSystemService(Context.AUDIO_SERVICE) as? AudioManager ?: return
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                val request = AudioFocusRequest.Builder(AudioManager.AUDIOFOCUS_GAIN_TRANSIENT)
                    .setAudioAttributes(
                        AudioAttributes.Builder()
                            .setUsage(AudioAttributes.USAGE_ALARM)
                            .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                            .build()
                    )
                    .setAcceptsDelayedFocusGain(false)
                    .setWillPauseWhenDucked(true)
                    .build()
                focusRequest = request
                audioManager.requestAudioFocus(request)
            } else {
                @Suppress("DEPRECATION")
                audioManager.requestAudioFocus(null, AudioManager.STREAM_ALARM, AudioManager.AUDIOFOCUS_GAIN_TRANSIENT)
            }
        } catch (e: Exception) {
            e.printStackTrace()
        }
    }

    /**
     * Release alarm audio focus so background media / audio can resume.
     */
    fun abandonAlarmFocus(context: Context) {
        val audioManager = context.getSystemService(Context.AUDIO_SERVICE) as? AudioManager ?: return
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                focusRequest?.let {
                    audioManager.abandonAudioFocusRequest(it)
                }
                focusRequest = null
            } else {
                @Suppress("DEPRECATION")
                audioManager.abandonAudioFocus(null)
            }
        } catch (e: Exception) {
            e.printStackTrace()
        }
    }
}
