package expo.modules.taskalarm

import android.app.UiModeManager
import android.content.Context
import android.content.IntentFilter
import android.content.res.Configuration
import android.media.AudioAttributes
import android.media.AudioFocusRequest
import android.media.AudioManager
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

    /**
     * Request transient audio focus for urgent alarm.
     * This instructs background media apps (like YouTube, Spotify, Podcast players)
     * to pause / stop playback immediately.
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

