package expo.modules.taskalarm

import android.content.Context
import android.content.Intent
import android.media.AudioFormat
import android.media.AudioRecord
import android.media.MediaRecorder
import android.os.Build
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.os.ParcelFileDescriptor
import android.speech.RecognitionListener
import android.speech.RecognizerIntent
import android.speech.SpeechRecognizer
import android.util.Log
import java.io.File
import java.io.FileInputStream
import java.io.FileOutputStream
import java.io.OutputStream
import java.nio.ByteBuffer
import java.nio.ByteOrder
import java.util.Locale
import java.util.concurrent.atomic.AtomicBoolean
import kotlin.math.log10
import kotlin.math.max
import kotlin.math.min
import kotlin.math.sqrt

class VoiceNoteManager(
  private val context: Context,
  private val emitEvent: (Map<String, Any?>) -> Unit
) {
  companion object {
    private const val TAG = "VoiceNoteManager"
    private const val SAMPLE_RATE = 16000
    private const val CHANNEL_CONFIG = AudioFormat.CHANNEL_IN_MONO
    private const val AUDIO_FORMAT = AudioFormat.ENCODING_PCM_16BIT
    private const val WAVEFORM_BARS = 36
  }

  private val mainHandler = Handler(Looper.getMainLooper())
  private val isRecording = AtomicBoolean(false)
  private val isPaused = AtomicBoolean(false)
  private val isStandaloneSpeech = AtomicBoolean(false)

  private var audioRecord: AudioRecord? = null
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

  @Volatile
  private var sttPipeOutput: OutputStream? = null
  private var sttPipeReadPfd: ParcelFileDescriptor? = null

  fun startCapture(languageTag: String?): Boolean {
    stopAndCleanupInternal(deleteFiles = true)

    val minBufSize = AudioRecord.getMinBufferSize(SAMPLE_RATE, CHANNEL_CONFIG, AUDIO_FORMAT)
    if (minBufSize <= 0) {
      Log.e(TAG, "Invalid min buffer size: $minBufSize")
      return false
    }
    val bufferSize = max(minBufSize * 2, 4096)

    val record = try {
      AudioRecord(
        MediaRecorder.AudioSource.VOICE_RECOGNITION,
        SAMPLE_RATE,
        CHANNEL_CONFIG,
        AUDIO_FORMAT,
        bufferSize
      ).takeIf { it.state == AudioRecord.STATE_INITIALIZED }
        ?: AudioRecord(
          MediaRecorder.AudioSource.MIC,
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

    val ts = System.currentTimeMillis()
    rawPcmFile = File(context.cacheDir, "voice_raw_$ts.pcm")
    outputWavFile = File(context.cacheDir, "Voice-$ts.wav")
    meteringHistory.clear()
    finalizedSentences.clear()
    currentPartialTranscript = ""
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

    startSpeechRecognizerOnMainThread(languageTag, useAudioPipe = Build.VERSION.SDK_INT >= 33)

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
    mainHandler.post {
      try {
        closeSttPipe()
        speechRecognizer?.stopListening()
      } catch (_: Exception) {}
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
    startSpeechRecognizerOnMainThread(currentLanguageTag, useAudioPipe = Build.VERSION.SDK_INT >= 33)
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

    try {
      audioRecord?.stop()
    } catch (_: Exception) {}
    try {
      audioRecord?.release()
    } catch (_: Exception) {}
    audioRecord = null

    mainHandler.post {
      destroySpeechRecognizer()
    }

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

    val fullTranscript = buildCombinedTranscript()
    val waveform = downsampleMeteringHistory(WAVEFORM_BARS)

    return mapOf(
      "uri" to "file://${wav.absolutePath}",
      "name" to wav.name,
      "size" to wav.length().toDouble(),
      "mimeType" to "audio/wav",
      "durationMs" to max(totalDurationMs, 500L).toDouble(),
      "transcript" to fullTranscript,
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
    startSpeechRecognizerOnMainThread(languageTag, useAudioPipe = false)
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
    val frameShorts = 960 // 60ms at 16kHz
    val byteBuffer = ByteArray(frameShorts * 2)

    FileOutputStream(pcmFile).use { fos ->
      while (isRecording.get()) {
        val bytesRead = record.read(byteBuffer, 0, byteBuffer.size)
        if (bytesRead <= 0) continue

        if (isPaused.get()) {
          continue
        }

        fos.write(byteBuffer, 0, bytesRead)

        // Tee PCM bytes to SpeechRecognizer pipe on Android 13+
        val pipeOut = sttPipeOutput
        if (pipeOut != null) {
          try {
            pipeOut.write(byteBuffer, 0, bytesRead)
            pipeOut.flush()
          } catch (_: Exception) {
            closeSttPipe()
          }
        }

        // Compute RMS dBFS & normalized bar level [0.08 .. 1.0]
        var sumSquares = 0.0
        val sampleCount = bytesRead / 2
        var i = 0
        while (i + 1 < bytesRead) {
          val lo = byteBuffer[i].toInt() and 0xFF
          val hi = byteBuffer[i + 1].toInt()
          val sample = ((hi shl 8) or lo).toShort().toDouble() / 32768.0
          sumSquares += sample * sample
          i += 2
        }

        val rms = if (sampleCount > 0) sqrt(sumSquares / sampleCount) else 0.0
        val db = if (rms > 0.00001) max(-60.0, min(0.0, 20.0 * log10(rms))) else -60.0
        val normalized = min(1.0, max(0.08, ((db + 55.0) / 50.0)))

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

  private fun startSpeechRecognizerOnMainThread(languageTag: String?, useAudioPipe: Boolean) {
    mainHandler.post {
      try {
        if (!SpeechRecognizer.isRecognitionAvailable(context)) {
          Log.w(TAG, "SpeechRecognizer is not available on this device")
          return@post
        }

        destroySpeechRecognizer()

        val recognizer = SpeechRecognizer.createSpeechRecognizer(context)
        speechRecognizer = recognizer

        val intent = Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH).apply {
          putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM)
          putExtra(RecognizerIntent.EXTRA_PARTIAL_RESULTS, true)
          putExtra(RecognizerIntent.EXTRA_MAX_RESULTS, 1)
          val lang = if (!languageTag.isNullOrBlank()) languageTag else Locale.getDefault().toLanguageTag()
          putExtra(RecognizerIntent.EXTRA_LANGUAGE, lang)
          putExtra(RecognizerIntent.EXTRA_LANGUAGE_PREFERENCE, lang)
        }

        if (useAudioPipe && Build.VERSION.SDK_INT >= 33) {
          try {
            val pipe = ParcelFileDescriptor.createPipe()
            sttPipeReadPfd = pipe[0]
            sttPipeOutput = ParcelFileDescriptor.AutoCloseOutputStream(pipe[1])
            intent.putExtra(RecognizerIntent.EXTRA_AUDIO_SOURCE, pipe[0])
            intent.putExtra(RecognizerIntent.EXTRA_AUDIO_SOURCE_CHANNEL_COUNT, 1)
            intent.putExtra(RecognizerIntent.EXTRA_AUDIO_SOURCE_ENCODING, AudioFormat.ENCODING_PCM_16BIT)
            intent.putExtra(RecognizerIntent.EXTRA_AUDIO_SOURCE_SAMPLING_RATE, SAMPLE_RATE)
          } catch (e: Exception) {
            Log.w(TAG, "Pipe setup failed, falling back to direct mic recognition", e)
            closeSttPipe()
          }
        }

        recognizer.setRecognitionListener(object : RecognitionListener {
          override fun onReadyForSpeech(params: Bundle?) {}
          override fun onBeginningOfSpeech() {}
          override fun onRmsChanged(rmsdB: Float) {
            if (isStandaloneSpeech.get()) {
              val norm = min(1.0, max(0.08, (rmsdB.toDouble() + 2.0) / 12.0))
              emitEvent(
                mapOf(
                  "type" to "metering",
                  "db" to (rmsdB.toDouble() * 3.0 - 45.0),
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
            // Restart automatically while session is still active (e.g. after a pause in speech)
            val shouldContinue = (isRecording.get() && !isPaused.get()) || isStandaloneSpeech.get()
            if (shouldContinue && error != SpeechRecognizer.ERROR_INSUFFICIENT_PERMISSIONS && error != SpeechRecognizer.ERROR_CLIENT) {
              mainHandler.postDelayed({
                val stillActive = (isRecording.get() && !isPaused.get()) || isStandaloneSpeech.get()
                if (stillActive) {
                  // If piped audio failed with ERROR_AUDIO, fall back to direct mic recognizer
                  val nextUsePipe = if (error == SpeechRecognizer.ERROR_AUDIO) false else (useAudioPipe && Build.VERSION.SDK_INT >= 33 && !isStandaloneSpeech.get())
                  startSpeechRecognizerOnMainThread(currentLanguageTag, nextUsePipe)
                }
              }, 220L)
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

            val shouldContinue = (isRecording.get() && !isPaused.get()) || isStandaloneSpeech.get()
            if (shouldContinue) {
              mainHandler.postDelayed({
                val stillActive = (isRecording.get() && !isPaused.get()) || isStandaloneSpeech.get()
                if (stillActive) {
                  startSpeechRecognizerOnMainThread(
                    currentLanguageTag,
                    useAudioPipe && Build.VERSION.SDK_INT >= 33 && !isStandaloneSpeech.get()
                  )
                }
              }, 120L)
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
      var peak = 0.08
      for (j in start until end) {
        if (copy[j] > peak) peak = copy[j]
      }
      result.add(peak)
    }
    return result
  }

  private fun closeSttPipe() {
    try {
      sttPipeOutput?.close()
    } catch (_: Exception) {}
    sttPipeOutput = null
    try {
      sttPipeReadPfd?.close()
    } catch (_: Exception) {}
    sttPipeReadPfd = null
  }

  private fun destroySpeechRecognizer() {
    closeSttPipe()
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

  private fun stopAndCleanupInternal(deleteFiles: Boolean) {
    isRecording.set(false)
    isPaused.set(false)
    isStandaloneSpeech.set(false)
    try {
      recordingThread?.join(400)
    } catch (_: Exception) {}
    recordingThread = null
    try {
      audioRecord?.stop()
    } catch (_: Exception) {}
    try {
      audioRecord?.release()
    } catch (_: Exception) {}
    audioRecord = null
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
