package expo.modules.taskalarm

import android.app.UiModeManager
import android.content.Context
import android.content.res.Configuration
import android.media.AudioAttributes
import android.media.AudioFocusRequest
import android.media.AudioManager
import android.media.MediaPlayer
import android.media.RingtoneManager
import android.net.Uri
import android.os.Build
import android.os.Handler
import android.os.Looper
import android.os.PowerManager

object CarUtils {
    fun isAndroidAutoMuteEnabled(context: Context): Boolean {
        return try {
            val prefs = context.getSharedPreferences("taskflow_theme", Context.MODE_PRIVATE)
            prefs.getBoolean("androidAutoEnabled", true)
        } catch (e: Exception) {
            true
        }
    }

    fun setAndroidAutoMuteEnabled(context: Context, enabled: Boolean) {
        try {
            val prefs = context.getSharedPreferences("taskflow_theme", Context.MODE_PRIVATE)
            prefs.edit().putBoolean("androidAutoEnabled", enabled).apply()
        } catch (e: Exception) {}
    }

    fun shouldMuteForCar(context: Context): Boolean {
        if (!isAndroidAutoMuteEnabled(context)) {
            return false
        }
        return isConnectedToCar(context)
    }

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

        return false
    }
}

object AlarmAudioManager {
    private var focusRequest: AudioFocusRequest? = null
    private var mediaPlayer: MediaPlayer? = null
    private val mainHandler = Handler(Looper.getMainLooper())
    private var duckReleaseRunnable: Runnable? = null

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

    @Synchronized
    fun isPlaying(): Boolean {
        return try {
            mediaPlayer?.isPlaying == true
        } catch (e: Exception) {
            false
        }
    }

    /**
     * Start continuous looping alarm sound with USAGE_ALARM stream and duck background media
     * (Amazon Music, YouTube, Spotify, etc.).
     */
    @Synchronized
    fun startAlarmSound(context: Context, soundName: String? = null) {
        duckReleaseRunnable?.let { mainHandler.removeCallbacks(it) }
        duckReleaseRunnable = null
        requestAlarmFocus(context)
        try {
            stopAlarmSound(context, retainFocus = true)
            val appCtx = context.applicationContext ?: context
            val uri = getSoundUri(appCtx, soundName)
            val player = MediaPlayer().apply {
                setDataSource(appCtx, uri)
                try {
                    setWakeMode(appCtx, PowerManager.PARTIAL_WAKE_LOCK)
                } catch (ignored: Exception) {}
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
     * Stop continuous alarm audio playback and release player + audio focus so
     * Amazon Music / YouTube restore to 100% volume.
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
     * Request AUDIOFOCUS_GAIN_TRANSIENT_MAY_DUCK so background media apps
     * (Amazon Music, YouTube, Spotify) lower their volume ("duck") while alarm/notification sounds.
     */
    fun requestAlarmFocus(context: Context) {
        val audioManager = context.getSystemService(Context.AUDIO_SERVICE) as? AudioManager ?: return
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                val request = AudioFocusRequest.Builder(AudioManager.AUDIOFOCUS_GAIN_TRANSIENT_MAY_DUCK)
                    .setAudioAttributes(
                        AudioAttributes.Builder()
                            .setUsage(AudioAttributes.USAGE_ALARM)
                            .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                            .build()
                    )
                    .setAcceptsDelayedFocusGain(false)
                    .setWillPauseWhenDucked(false)
                    .build()
                focusRequest = request
                audioManager.requestAudioFocus(request)
            } else {
                @Suppress("DEPRECATION")
                audioManager.requestAudioFocus(
                    null,
                    AudioManager.STREAM_ALARM,
                    AudioManager.AUDIOFOCUS_GAIN_TRANSIENT_MAY_DUCK
                )
            }
        } catch (e: Exception) {
            e.printStackTrace()
        }
    }

    /**
     * Temporarily duck background media (Amazon Music, YouTube) for a short notification chime.
     */
    fun duckAudioTemporarily(context: Context, durationMs: Long = 3500L) {
        if (isPlaying()) return
        duckReleaseRunnable?.let { mainHandler.removeCallbacks(it) }
        requestAlarmFocus(context)
        val appCtx = context.applicationContext ?: context
        val runnable = Runnable {
            if (!isPlaying()) {
                abandonAlarmFocus(appCtx)
            }
        }
        duckReleaseRunnable = runnable
        mainHandler.postDelayed(runnable, durationMs)
    }

    /**
     * Release alarm audio focus so background media / audio can resume full volume.
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
