package expo.modules.taskalarm

import android.content.Context
import android.content.Intent
import android.media.AudioFormat
import android.media.AudioRecord
import android.media.MediaRecorder
import android.media.audiofx.AcousticEchoCanceler
import android.media.audiofx.AutomaticGainControl
import android.media.audiofx.NoiseSuppressor
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.speech.RecognitionListener
import android.speech.RecognizerIntent
import android.speech.SpeechRecognizer
import android.util.Log
import java.io.File
import java.io.FileInputStream
import java.io.FileOutputStream
import java.nio.ByteBuffer
import java.nio.ByteOrder
import java.util.Locale
import java.util.concurrent.atomic.AtomicBoolean
import kotlin.math.log10
import kotlin.math.max
import kotlin.math.min
import kotlin.math.pow
import kotlin.math.sqrt
import kotlin.math.tanh

class VoiceNoteManager(
  private val context: Context,
  private val emitEvent: (Map<String, Any?>) -> Unit
) {
  companion object {
    private const val TAG = "VoiceNoteManager"
    // 24 kHz wideband 16-bit mono PCM for crisp WhatsApp/Telegram voice clarity
    private const val SAMPLE_RATE = 24000
    private const val CHANNEL_CONFIG = AudioFormat.CHANNEL_IN_MONO
    private const val AUDIO_FORMAT = AudioFormat.ENCODING_PCM_16BIT
    private const val WAVEFORM_BARS = 36
    // Pre-amp gain boost (2.8x) with soft-knee tanh limiter so quiet speech is captured clearly
    private const val PREAMP_GAIN = 2.8
  }

  private val mainHandler = Handler(Looper.getMainLooper())
  private val isRecording = AtomicBoolean(false)
  private val isPaused = AtomicBoolean(false)
  private val isStandaloneSpeech = AtomicBoolean(false)

  private var audioRecord: AudioRecord? = null
  private var agcEffect: AutomaticGainControl? = null
  private var nsEffect: NoiseSuppressor? = null
  private var aecEffect: AcousticEchoCanceler? = null
  private var recordingThread: Thread? = null
  private var rawPcmFile: File? = null
  private var outputWavFile: File? = null
  private var startTimeMs: Long = 0L
  private var accumulatedDurationMs: Long = 0L
  private var lastResumeTimeMs: Long = 0L

  private val meteringHistory = ArrayList<Double>()
  private var speechRecognizer: SpeechRecognizer? = null
  private var currentLanguageTag: String? = null
  private val finalizedSentences = ArrayList<String>()
  private var currentPartialTranscript: String = ""

  /**
   * Starts pure, high-sensitivity voice recording (WhatsApp / Telegram style)
   * with hardware AutomaticGainControl + NoiseSuppressor + software 2.8x soft-knee pre-amp.
   * Does NOT run SpeechRecognizer concurrently so the microphone is 100% dedicated to crystal-clear audio.
   */
  fun startCapture(languageTag: String?): Boolean {
    stopAndCleanupInternal(deleteFiles = true)

    val minBufSize = AudioRecord.getMinBufferSize(SAMPLE_RATE, CHANNEL_CONFIG, AUDIO_FORMAT)
    if (minBufSize <= 0) {
      Log.e(TAG, "Invalid min buffer size: $minBufSize")
      return false
    }
    val bufferSize = max(minBufSize * 2, 4800)

    // Use AudioSource.MIC (with hardware AGC support) rather than VOICE_RECOGNITION (which disables AGC)
    val record = try {
      AudioRecord(
        MediaRecorder.AudioSource.MIC,
        SAMPLE_RATE,
        CHANNEL_CONFIG,
        AUDIO_FORMAT,
        bufferSize
      ).takeIf { it.state == AudioRecord.STATE_INITIALIZED }
        ?: AudioRecord(
          MediaRecorder.AudioSource.VOICE_COMMUNICATION,
          SAMPLE_RATE,
          CHANNEL_CONFIG,
          AUDIO_FORMAT,
          bufferSize
        )
    } catch (e: SecurityException) {
      Log.e(TAG, "RECORD_AUDIO permission missing", e)
      return false
    } catch (e: Exception) {
      Log.e(TAG, "Failed to create AudioRecord", e)
      return false
    }

    if (record.state != AudioRecord.STATE_INITIALIZED) {
      Log.e(TAG, "AudioRecord failed to initialize")
      try { record.release() } catch (_: Exception) {}
      return false
    }

    // Attach hardware DSP Automatic Gain Control & Noise Suppression when supported by device
    try {
      val sessionId = record.audioSessionId
      if (AutomaticGainControl.isAvailable()) {
        agcEffect = AutomaticGainControl.create(sessionId)?.apply { enabled = true }
      }
      if (NoiseSuppressor.isAvailable()) {
        nsEffect = NoiseSuppressor.create(sessionId)?.apply { enabled = true }
      }
      if (AcousticEchoCanceler.isAvailable()) {
        aecEffect = AcousticEchoCanceler.create(sessionId)?.apply { enabled = true }
      }
    } catch (e: Exception) {
      Log.w(TAG, "AudioFX initialization warning", e)
    }

    val ts = System.currentTimeMillis()
    rawPcmFile = File(context.cacheDir, "voice_raw_$ts.pcm")
    outputWavFile = File(context.cacheDir, "Voice-$ts.wav")
    meteringHistory.clear()
    currentLanguageTag = languageTag
    accumulatedDurationMs = 0L
    startTimeMs = ts
    lastResumeTimeMs = ts

    audioRecord = record
    isPaused.set(false)
    isRecording.set(true)
    isStandaloneSpeech.set(false)

    try {
      record.startRecording()
    } catch (e: Exception) {
      Log.e(TAG, "startRecording threw", e)
      stopAndCleanupInternal(deleteFiles = true)
      return false
    }

    recordingThread = Thread {
      runAudioCaptureLoop(record, rawPcmFile!!)
    }.apply {
      name = "TaskFlow-VoiceNoteRecorder"
      priority = Thread.MAX_PRIORITY
      start()
    }

    emitEvent(
      mapOf(
        "type" to "status",
        "state" to "recording",
        "durationMs" to 0L
      )
    )
    return true
  }

  fun pauseCapture(): Boolean {
    if (!isRecording.get() || isPaused.get()) return false
    isPaused.set(true)
    val now = System.currentTimeMillis()
    if (lastResumeTimeMs > 0L) {
      accumulatedDurationMs += (now - lastResumeTimeMs)
      lastResumeTimeMs = 0L
    }
    emitEvent(
      mapOf(
        "type" to "status",
        "state" to "paused",
        "durationMs" to accumulatedDurationMs
      )
    )
    return true
  }

  fun resumeCapture(): Boolean {
    if (!isRecording.get() || !isPaused.get()) return false
    lastResumeTimeMs = System.currentTimeMillis()
    isPaused.set(false)
    emitEvent(
      mapOf(
        "type" to "status",
        "state" to "recording",
        "durationMs" to getCurrentDurationMs()
      )
    )
    return true
  }

  fun stopCapture(): Map<String, Any?>? {
    if (!isRecording.get()) return null
    val totalDurationMs = getCurrentDurationMs()
    isRecording.set(false)
    isPaused.set(false)

    try {
      recordingThread?.join(800)
    } catch (_: Exception) {}
    recordingThread = null

    releaseAudioRecordAndEffects()

    val pcm = rawPcmFile
    val wav = outputWavFile
    if (pcm == null || wav == null || !pcm.exists()) {
      return null
    }

    try {
      writeWavFromPcm(pcm, wav, SAMPLE_RATE, 1, 16)
      pcm.delete()
    } catch (e: Exception) {
      Log.e(TAG, "Failed to encode WAV from PCM", e)
      return null
    }

    val waveform = downsampleMeteringHistory(WAVEFORM_BARS)

    return mapOf(
      "uri" to "file://${wav.absolutePath}",
      "name" to wav.name,
      "size" to wav.length().toDouble(),
      "mimeType" to "audio/wav",
      "durationMs" to max(totalDurationMs, 500L).toDouble(),
      "waveform" to waveform
    )
  }

  fun cancelCapture(): Boolean {
    stopAndCleanupInternal(deleteFiles = true)
    emitEvent(
      mapOf(
        "type" to "status",
        "state" to "cancelled",
        "durationMs" to 0L
      )
    )
    return true
  }

  fun startStandaloneSpeech(languageTag: String?): Boolean {
    stopAndCleanupInternal(deleteFiles = false)
    finalizedSentences.clear()
    currentPartialTranscript = ""
    currentLanguageTag = languageTag
    isStandaloneSpeech.set(true)
    isRecording.set(false)
    isPaused.set(false)
    startSpeechRecognizerOnMainThread(languageTag)
    return true
  }

  fun stopStandaloneSpeech(): String {
    isStandaloneSpeech.set(false)
    mainHandler.post {
      destroySpeechRecognizer()
    }
    return buildCombinedTranscript()
  }

  private fun getCurrentDurationMs(): Long {
    val activeDelta = if (!isPaused.get() && lastResumeTimeMs > 0L) {
      System.currentTimeMillis() - lastResumeTimeMs
    } else {
      0L
    }
    return max(0L, accumulatedDurationMs + activeDelta)
  }

  private fun runAudioCaptureLoop(record: AudioRecord, pcmFile: File) {
    val frameShorts = 1440 // 60ms at 24kHz
    val byteBuffer = ByteArray(frameShorts * 2)
    val boostedBuffer = ByteArray(frameShorts * 2)

    FileOutputStream(pcmFile).use { fos ->
      while (isRecording.get()) {
        val bytesRead = record.read(byteBuffer, 0, byteBuffer.size)
        if (bytesRead <= 0) continue

        if (isPaused.get()) {
          continue
        }

        // Apply 2.8x soft-knee pre-amp boost and compute RMS dBFS for sensitive WhatsApp/Telegram waveform
        var sumSquares = 0.0
        val sampleCount = bytesRead / 2
        var i = 0
        while (i + 1 < bytesRead) {
          val lo = byteBuffer[i].toInt() and 0xFF
          val hi = byteBuffer[i + 1].toInt()
          val rawShort = ((hi shl 8) or lo).toShort()
          val normSample = rawShort.toDouble() / 32768.0

          // Soft-knee tanh pre-amp so quiet voices are boosted 2.8x while loud peaks never harsh-clip
          val amplified = tanh(normSample * PREAMP_GAIN)
          sumSquares += amplified * amplified

          val boostedInt = (amplified * 32767.0).toInt().coerceIn(-32768, 32767)
          boostedBuffer[i] = (boostedInt and 0xFF).toByte()
          boostedBuffer[i + 1] = ((boostedInt shr 8) and 0xFF).toByte()
          i += 2
        }

        fos.write(boostedBuffer, 0, bytesRead)

        val rms = if (sampleCount > 0) sqrt(sumSquares / sampleCount) else 0.0
        val db = if (rms > 0.00001) max(-60.0, min(0.0, 20.0 * log10(rms))) else -60.0
        // Perceptual curve: map [-52 dBFS .. -4 dBFS] with power 0.58 for high-sensitivity visual feedback
        val linear = ((db + 52.0) / 48.0).coerceIn(0.0, 1.0)
        val normalized = (linear.pow(0.58)).coerceIn(0.10, 1.0)

        synchronized(meteringHistory) {
          meteringHistory.add(normalized)
        }

        emitEvent(
          mapOf(
            "type" to "metering",
            "db" to db,
            "level" to normalized,
            "durationMs" to getCurrentDurationMs(),
            "isPaused" to isPaused.get()
          )
        )
      }
      fos.flush()
    }
  }

  private fun startSpeechRecognizerOnMainThread(languageTag: String?) {
    mainHandler.post {
      try {
        if (!SpeechRecognizer.isRecognitionAvailable(context)) {
          Log.w(TAG, "SpeechRecognizer is not available on this device")
          return@post
        }

        destroySpeechRecognizer()

        val recognizer = SpeechRecognizer.createSpeechRecognizer(context)
        speechRecognizer = recognizer

        val lang = if (!languageTag.isNullOrBlank()) languageTag else Locale.getDefault().toLanguageTag()
        val intent = Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH).apply {
          putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM)
          putExtra(RecognizerIntent.EXTRA_PARTIAL_RESULTS, true)
          putExtra(RecognizerIntent.EXTRA_MAX_RESULTS, 3)
          putExtra(RecognizerIntent.EXTRA_LANGUAGE, lang)
          putExtra(RecognizerIntent.EXTRA_LANGUAGE_PREFERENCE, lang)
          // Extended silence windows so dictation catches quiet pauses without cutting off early
          putExtra(RecognizerIntent.EXTRA_SPEECH_INPUT_COMPLETE_SILENCE_LENGTH_MILLIS, 3500L)
          putExtra(RecognizerIntent.EXTRA_SPEECH_INPUT_POSSIBLY_COMPLETE_SILENCE_LENGTH_MILLIS, 2500L)
          putExtra(RecognizerIntent.EXTRA_SPEECH_INPUT_MINIMUM_LENGTH_MILLIS, 4000L)
        }

        recognizer.setRecognitionListener(object : RecognitionListener {
          override fun onReadyForSpeech(params: Bundle?) {}
          override fun onBeginningOfSpeech() {}
          override fun onRmsChanged(rmsdB: Float) {
            if (isStandaloneSpeech.get()) {
              val norm = min(1.0, max(0.10, (rmsdB.toDouble() + 2.0) / 10.0))
              emitEvent(
                mapOf(
                  "type" to "metering",
                  "db" to (rmsdB.toDouble() * 3.0 - 40.0),
                  "level" to norm,
                  "durationMs" to 0L,
                  "isPaused" to false
                )
              )
            }
          }
          override fun onBufferReceived(buffer: ByteArray?) {}
          override fun onEndOfSpeech() {}

          override fun onError(error: Int) {
            if (isStandaloneSpeech.get() && error != SpeechRecognizer.ERROR_INSUFFICIENT_PERMISSIONS && error != SpeechRecognizer.ERROR_CLIENT) {
              mainHandler.postDelayed({
                if (isStandaloneSpeech.get()) {
                  startSpeechRecognizerOnMainThread(currentLanguageTag)
                }
              }, 180L)
            }
          }

          override fun onResults(results: Bundle?) {
            val matches = results?.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION)
            val topText = matches?.firstOrNull()?.trim() ?: ""
            if (topText.isNotEmpty()) {
              synchronized(finalizedSentences) {
                finalizedSentences.add(topText)
              }
            }
            currentPartialTranscript = ""
            val combined = buildCombinedTranscript()
            emitEvent(
              mapOf(
                "type" to "transcript",
                "text" to combined,
                "finalizedText" to combined,
                "partialText" to "",
                "isFinal" to true
              )
            )

            if (isStandaloneSpeech.get()) {
              mainHandler.postDelayed({
                if (isStandaloneSpeech.get()) {
                  startSpeechRecognizerOnMainThread(currentLanguageTag)
                }
              }, 100L)
            }
          }

          override fun onPartialResults(partialResults: Bundle?) {
            val matches = partialResults?.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION)
            val partial = matches?.firstOrNull()?.trim() ?: ""
            if (partial.isNotEmpty()) {
              currentPartialTranscript = partial
              val combined = buildCombinedTranscript()
              emitEvent(
                mapOf(
                  "type" to "transcript",
                  "text" to combined,
                  "finalizedText" to synchronized(finalizedSentences) { finalizedSentences.joinToString(" ") },
                  "partialText" to partial,
                  "isFinal" to false
                )
              )
            }
          }

          override fun onEvent(eventType: Int, params: Bundle?) {}
        })

        recognizer.startListening(intent)
      } catch (e: Exception) {
        Log.w(TAG, "Failed to start SpeechRecognizer", e)
      }
    }
  }

  private fun buildCombinedTranscript(): String {
    val base = synchronized(finalizedSentences) {
      finalizedSentences.filter { it.isNotBlank() }.joinToString(" ").trim()
    }
    val partial = currentPartialTranscript.trim()
    return when {
      base.isEmpty() -> partial
      partial.isEmpty() -> base
      else -> "$base $partial"
    }
  }

  private fun downsampleMeteringHistory(targetCount: Int): List<Double> {
    val copy = synchronized(meteringHistory) { ArrayList(meteringHistory) }
    if (copy.isEmpty()) {
      return List(targetCount) { 0.15 }
    }
    if (copy.size <= targetCount) {
      val result = ArrayList<Double>(targetCount)
      for (i in 0 until targetCount) {
        val idx = (i * copy.size) / targetCount
        result.add(copy[min(idx, copy.size - 1)])
      }
      return result
    }
    val result = ArrayList<Double>(targetCount)
    val chunkSize = copy.size.toDouble() / targetCount.toDouble()
    for (i in 0 until targetCount) {
      val start = (i * chunkSize).toInt()
      val end = min(copy.size, max(start + 1, ((i + 1) * chunkSize).toInt()))
      var peak = 0.10
      for (j in start until end) {
        if (copy[j] > peak) peak = copy[j]
      }
      result.add(peak)
    }
    return result
  }

  private fun destroySpeechRecognizer() {
    try {
      speechRecognizer?.stopListening()
    } catch (_: Exception) {}
    try {
      speechRecognizer?.cancel()
    } catch (_: Exception) {}
    try {
      speechRecognizer?.destroy()
    } catch (_: Exception) {}
    speechRecognizer = null
  }

  private fun releaseAudioRecordAndEffects() {
    try { agcEffect?.release() } catch (_: Exception) {}
    agcEffect = null
    try { nsEffect?.release() } catch (_: Exception) {}
    nsEffect = null
    try { aecEffect?.release() } catch (_: Exception) {}
    aecEffect = null
    try { audioRecord?.stop() } catch (_: Exception) {}
    try { audioRecord?.release() } catch (_: Exception) {}
    audioRecord = null
  }

  private fun stopAndCleanupInternal(deleteFiles: Boolean) {
    isRecording.set(false)
    isPaused.set(false)
    isStandaloneSpeech.set(false)
    try {
      recordingThread?.join(400)
    } catch (_: Exception) {}
    recordingThread = null
    releaseAudioRecordAndEffects()
    mainHandler.post {
      destroySpeechRecognizer()
    }
    if (deleteFiles) {
      try { rawPcmFile?.delete() } catch (_: Exception) {}
      try { outputWavFile?.delete() } catch (_: Exception) {}
    }
  }

  private fun writeWavFromPcm(pcmFile: File, wavFile: File, sampleRate: Int, channels: Int, bitsPerSample: Int) {
    val pcmLength = pcmFile.length()
    val totalDataLen = pcmLength + 36
    val byteRate = (sampleRate * channels * bitsPerSample) / 8
    val blockAlign = (channels * bitsPerSample) / 8

    val header = ByteBuffer.allocate(44).order(ByteOrder.LITTLE_ENDIAN)
    header.put("RIFF".toByteArray(Charsets.US_ASCII))
    header.putInt(totalDataLen.toInt())
    header.put("WAVE".toByteArray(Charsets.US_ASCII))
    header.put("fmt ".toByteArray(Charsets.US_ASCII))
    header.putInt(16) // Subchunk1Size for PCM
    header.putShort(1.toShort()) // AudioFormat 1 = PCM
    header.putShort(channels.toShort())
    header.putInt(sampleRate)
    header.putInt(byteRate)
    header.putShort(blockAlign.toShort())
    header.putShort(bitsPerSample.toShort())
    header.put("data".toByteArray(Charsets.US_ASCII))
    header.putInt(pcmLength.toInt())

    FileOutputStream(wavFile).use { fos ->
      fos.write(header.array())
      FileInputStream(pcmFile).use { fis ->
        val buf = ByteArray(8192)
        var read: Int
        while (fis.read(buf).also { read = it } != -1) {
          fos.write(buf, 0, read)
        }
      }
      fos.flush()
    }
  }
}
