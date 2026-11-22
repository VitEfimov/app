import { Platform } from 'react-native';
import { Audio } from 'expo-av';
import * as FileSystem from 'expo-file-system';
import {
  hasNativeVoiceNoteCapture,
  startVoiceNoteCapture as nativeStartVoiceNoteCapture,
  pauseVoiceNoteCapture as nativePauseVoiceNoteCapture,
  resumeVoiceNoteCapture as nativeResumeVoiceNoteCapture,
  stopVoiceNoteCapture as nativeStopVoiceNoteCapture,
  cancelVoiceNoteCapture as nativeCancelVoiceNoteCapture,
  startSpeechRecognition as nativeStartSpeechRecognition,
  stopSpeechRecognition as nativeStopSpeechRecognition,
  addVoiceNoteListener,
} from '../../modules/expo-task-alarm';

export const DEFAULT_WAVEFORM_BARS = 36;

/**
 * Maps a raw decibel metering value (-60..0 dBFS) to a normalized visual bar height [0.10 .. 1.0].
 */
export function normalizeMeteringToLevel(db) {
  if (typeof db !== 'number' || isNaN(db)) return 0.12;
  const clamped = Math.max(-60, Math.min(0, db));
  const linear = (clamped + 55) / 50;
  return Math.max(0.10, Math.min(1.0, Number(linear.toFixed(3))));
}

/**
 * Downsamples or interpolates an arbitrary array of amplitude levels into `barCount` bars in [0.10 .. 1.0].
 */
export function downsampleWaveform(samples, barCount = DEFAULT_WAVEFORM_BARS) {
  const count = Math.max(4, Number(barCount) || DEFAULT_WAVEFORM_BARS);
  if (!Array.isArray(samples) || samples.length === 0) {
    return Array.from({ length: count }, (_, idx) => {
      const wave = 0.22 + 0.14 * Math.sin(idx * 0.65);
      return Number(Math.max(0.12, Math.min(0.85, wave)).toFixed(3));
    });
  }

  const sanitized = samples.map((v) => {
    const n = Number(v);
    if (isNaN(n)) return 0.12;
    if (n < 0) return normalizeMeteringToLevel(n);
    return Math.max(0.10, Math.min(1.0, n));
  });

  if (sanitized.length <= count) {
    const out = [];
    for (let i = 0; i < count; i++) {
      const srcIdx = Math.min(sanitized.length - 1, Math.floor((i * sanitized.length) / count));
      out.push(Number(sanitized[srcIdx].toFixed(3)));
    }
    return out;
  }

  const out = [];
  const chunkSize = sanitized.length / count;
  for (let i = 0; i < count; i++) {
    const start = Math.floor(i * chunkSize);
    const end = Math.min(sanitized.length, Math.max(start + 1, Math.floor((i + 1) * chunkSize)));
    let peak = 0.10;
    for (let j = start; j < end; j++) {
      if (sanitized[j] > peak) peak = sanitized[j];
    }
    out.push(Number(peak.toFixed(3)));
  }
  return out;
}

/**
 * Formats duration in milliseconds to M:SS (e.g. 0:05, 1:42).
 */
export function formatVoiceDuration(durationMs) {
  const safeMs = Math.max(0, Number(durationMs) || 0);
  const totalSeconds = Math.round(safeMs / 1000);
  const mins = Math.floor(totalSeconds / 60);
  const secs = totalSeconds % 60;
  return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
}

/**
 * Cleanly merges a live or completed voice transcript into the task's base notes text.
 */
export function mergeTranscriptIntoNotes(baseNotes, transcriptText) {
  const base = typeof baseNotes === 'string' ? baseNotes.trim() : '';
  const spoken = typeof transcriptText === 'string' ? transcriptText.trim() : '';
  if (!spoken) return base;
  if (!base) return spoken;
  return `${base}\n${spoken}`;
}

/**
 * Requests microphone recording permission across Android, iOS, and Web.
 */
export async function requestMicrophonePermissionAsync() {
  try {
    const current = await Audio.getPermissionsAsync();
    if (current?.granted) return true;
    const requested = await Audio.requestPermissionsAsync();
    return Boolean(requested?.granted);
  } catch (e) {
    console.warn('[VoiceRecorder] Permission request error:', e);
    return false;
  }
}

const VOICE_RECORDING_OPTIONS = {
  isMeteringEnabled: true,
  android: {
    extension: '.m4a',
    outputFormat: Audio?.AndroidOutputFormat?.MPEG_4 ?? 2,
    audioEncoder: Audio?.AndroidAudioEncoder?.AAC ?? 3,
    sampleRate: 44100,
    numberOfChannels: 1,
    bitRate: 64000,
  },
  ios: {
    extension: '.m4a',
    outputFormat: Audio?.IOSOutputFormat?.MPEG4AAC ?? 'aac ',
    audioQuality: Audio?.IOSAudioQuality?.HIGH ?? 96,
    sampleRate: 44100,
    numberOfChannels: 1,
    bitRate: 64000,
    linearPCMBitDepth: 16,
    linearPCMIsBigEndian: false,
    linearPCMIsFloat: false,
  },
  web: {
    mimeType: 'audio/webm',
    bitsPerSecond: 64000,
  },
};

/**
 * Starts a Web Speech API recognition listener when available (Web or hybrid webviews).
 */
function createWebSpeechRecognizer(language, onTranscriptCallback) {
  if (typeof window === 'undefined') return null;
  const SpeechRecognitionCtor = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecognitionCtor) return null;

  try {
    const recognition = new SpeechRecognitionCtor();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = language || 'en-US';

    let finalizedSegments = [];
    let isActive = true;

    recognition.onresult = (event) => {
      let interim = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const res = event.results[i];
        const transcript = (res[0]?.transcript || '').trim();
        if (!transcript) continue;
        if (res.isFinal) {
          finalizedSegments.push(transcript);
        } else {
          interim += (interim ? ' ' : '') + transcript;
        }
      }
      const finalizedText = finalizedSegments.join(' ').trim();
      const combined = [finalizedText, interim.trim()].filter(Boolean).join(' ').trim();
      if (onTranscriptCallback && combined) {
        onTranscriptCallback({
          text: combined,
          finalizedText,
          partialText: interim.trim(),
          isFinal: !interim,
        });
      }
    };

    recognition.onerror = () => {};
    recognition.onend = () => {
      if (isActive) {
        try {
          recognition.start();
        } catch (_) {}
      }
    };

    recognition.start();

    return {
      stop: () => {
        isActive = false;
        try {
          recognition.stop();
        } catch (_) {}
      },
      getTranscript: () => finalizedSegments.join(' ').trim(),
    };
  } catch (e) {
    return null;
  }
}

/**
 * Creates a unified voice recording + live transcription session.
 * Automatically uses the Android native dual-stream (`AudioRecord` + `SpeechRecognizer`) when available,
 * and falls back cleanly to `expo-av` + available SpeechRecognition on iOS/Web/legacy builds.
 */
export function createVoiceRecorderSession({
  language = 'en-US',
  onMetering,
  onTranscript,
  onStatusChange,
} = {}) {
  let mode = 'idle'; // 'native' | 'expo-av' | 'idle'
  let nativeSub = null;
  let expoRecording = null;
  let webSpeech = null;
  let meteringHistory = [];
  let rollingBars = Array.from({ length: DEFAULT_WAVEFORM_BARS }, () => 0.12);
  let latestTranscript = '';
  let latestDurationMs = 0;
  let isPaused = false;

  const pushMeteringLevel = (level, durationMs) => {
    const safeLevel = Math.max(0.10, Math.min(1.0, Number(level) || 0.12));
    meteringHistory.push(safeLevel);
    rollingBars = [...rollingBars.slice(1), safeLevel];
    latestDurationMs = durationMs ?? latestDurationMs;
    if (onMetering) {
      onMetering({
        level: safeLevel,
        bars: rollingBars,
        durationMs: latestDurationMs,
        isPaused,
      });
    }
  };

  return {
    async start() {
      const granted = await requestMicrophonePermissionAsync();
      if (!granted) {
        throw new Error('MICROPHONE_PERMISSION_DENIED');
      }

      meteringHistory = [];
      rollingBars = Array.from({ length: DEFAULT_WAVEFORM_BARS }, () => 0.12);
      latestTranscript = '';
      latestDurationMs = 0;
      isPaused = false;

      // 1. Try Native Android Dual-Stream Capture (AudioRecord + SpeechRecognizer)
      if (Platform.OS === 'android' && hasNativeVoiceNoteCapture()) {
        nativeSub = addVoiceNoteListener((evt) => {
          if (!evt || typeof evt !== 'object') return;
          if (evt.type === 'metering') {
            if (!evt.isPaused) {
              pushMeteringLevel(evt.level ?? normalizeMeteringToLevel(evt.db), evt.durationMs || 0);
            }
          } else if (evt.type === 'transcript') {
            latestTranscript = (evt.text || '').trim();
            if (onTranscript) {
              onTranscript({
                text: latestTranscript,
                finalizedText: evt.finalizedText || '',
                partialText: evt.partialText || '',
                isFinal: Boolean(evt.isFinal),
              });
            }
          } else if (evt.type === 'status' && onStatusChange) {
            onStatusChange(evt.state);
          }
        });

        const started = await nativeStartVoiceNoteCapture(language);
        if (started) {
          mode = 'native';
          if (onStatusChange) onStatusChange('recording');
          return true;
        }
        if (nativeSub) {
          nativeSub.remove();
          nativeSub = null;
        }
      }

      // 2. Fallback: Expo AV High-Quality Recording + Web/Hybrid SpeechRecognition
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
        staysActiveInBackground: false,
        shouldDuckAndroid: true,
      });

      const recording = new Audio.Recording();
      await recording.prepareToRecordAsync(VOICE_RECORDING_OPTIONS);
      recording.setProgressUpdateInterval(65);
      recording.setOnRecordingStatusUpdate((status) => {
        if (!status) return;
        if (status.isRecording && !isPaused) {
          const level = normalizeMeteringToLevel(status.metering ?? -35);
          pushMeteringLevel(level, status.durationMillis || 0);
        }
      });

      await recording.startAsync();
      expoRecording = recording;
      mode = 'expo-av';

      webSpeech = createWebSpeechRecognizer(language, (tEvt) => {
        latestTranscript = tEvt.text;
        if (onTranscript) onTranscript(tEvt);
      });

      if (onStatusChange) onStatusChange('recording');
      return true;
    },

    async pause() {
      if (isPaused) return true;
      isPaused = true;
      if (mode === 'native') {
        await nativePauseVoiceNoteCapture();
      } else if (mode === 'expo-av' && expoRecording) {
        try {
          await expoRecording.pauseAsync();
        } catch (_) {}
      }
      if (onStatusChange) onStatusChange('paused');
      return true;
    },

    async resume() {
      if (!isPaused) return true;
      isPaused = false;
      if (mode === 'native') {
        await nativeResumeVoiceNoteCapture();
      } else if (mode === 'expo-av' && expoRecording) {
        try {
          await expoRecording.startAsync();
        } catch (_) {}
      }
      if (onStatusChange) onStatusChange('recording');
      return true;
    },

    async stop() {
      if (webSpeech) {
        webSpeech.stop();
        if (!latestTranscript) {
          latestTranscript = webSpeech.getTranscript();
        }
        webSpeech = null;
      }

      if (nativeSub) {
        nativeSub.remove();
        nativeSub = null;
      }

      if (mode === 'native') {
        mode = 'idle';
        const res = await nativeStopVoiceNoteCapture();
        if (!res || !res.uri) return null;
        return {
          uri: res.uri,
          name: res.name || `Voice-${Date.now()}.wav`,
          size: Number(res.size) || 0,
          mimeType: res.mimeType || 'audio/wav',
          durationMs: Number(res.durationMs) || latestDurationMs || 1000,
          transcript: (res.transcript || latestTranscript || '').trim(),
          waveform: downsampleWaveform(res.waveform || meteringHistory, DEFAULT_WAVEFORM_BARS),
        };
      }

      if (mode === 'expo-av' && expoRecording) {
        const rec = expoRecording;
        expoRecording = null;
        mode = 'idle';
        let finalStatus = null;
        try {
          finalStatus = await rec.stopAndUnloadAsync();
        } catch (_) {}
        try {
          await Audio.setAudioModeAsync({ allowsRecordingIOS: false, playsInSilentModeIOS: true });
        } catch (_) {}

        const uri = rec.getURI();
        if (!uri) return null;
        let fileSize = 0;
        try {
          if (Platform.OS !== 'web') {
            const info = await FileSystem.getInfoAsync(uri);
            if (info?.exists && info.size) fileSize = info.size;
          }
        } catch (_) {}

        const ext = Platform.OS === 'web' ? 'webm' : 'm4a';
        const mimeType = Platform.OS === 'web' ? 'audio/webm' : 'audio/mp4';

        return {
          uri,
          name: `Voice-${Date.now()}.${ext}`,
          size: fileSize,
          mimeType,
          durationMs: finalStatus?.durationMillis || latestDurationMs || 1000,
          transcript: (latestTranscript || '').trim(),
          waveform: downsampleWaveform(meteringHistory, DEFAULT_WAVEFORM_BARS),
        };
      }

      mode = 'idle';
      return null;
    },

    async cancel() {
      if (webSpeech) {
        webSpeech.stop();
        webSpeech = null;
      }
      if (nativeSub) {
        nativeSub.remove();
        nativeSub = null;
      }
      if (mode === 'native') {
        mode = 'idle';
        await nativeCancelVoiceNoteCapture();
      } else if (mode === 'expo-av' && expoRecording) {
        const rec = expoRecording;
        expoRecording = null;
        mode = 'idle';
        try {
          await rec.stopAndUnloadAsync();
        } catch (_) {}
        try {
          const uri = rec.getURI();
          if (uri && Platform.OS !== 'web') {
            await FileSystem.deleteAsync(uri, { idempotent: true });
          }
        } catch (_) {}
      }
      if (onStatusChange) onStatusChange('cancelled');
      return true;
    },
  };
}

/**
 * Standalone live speech-to-text session for dictating directly into task notes.
 */
export function createStandaloneDictationSession({ language = 'en-US', onTranscript, onMetering } = {}) {
  let nativeSub = null;
  let webSpeech = null;
  let usingNative = false;

  return {
    async start() {
      const granted = await requestMicrophonePermissionAsync();
      if (!granted) {
        throw new Error('MICROPHONE_PERMISSION_DENIED');
      }

      if (Platform.OS === 'android' && hasNativeVoiceNoteCapture()) {
        nativeSub = addVoiceNoteListener((evt) => {
          if (!evt) return;
          if (evt.type === 'transcript' && onTranscript) {
            onTranscript({
              text: (evt.text || '').trim(),
              finalizedText: evt.finalizedText || '',
              partialText: evt.partialText || '',
              isFinal: Boolean(evt.isFinal),
            });
          } else if (evt.type === 'metering' && onMetering) {
            onMetering(evt.level || 0.2);
          }
        });
        const ok = await nativeStartSpeechRecognition(language);
        if (ok) {
          usingNative = true;
          return true;
        }
        if (nativeSub) {
          nativeSub.remove();
          nativeSub = null;
        }
      }

      webSpeech = createWebSpeechRecognizer(language, (tEvt) => {
        if (onTranscript) onTranscript(tEvt);
      });
      return Boolean(webSpeech);
    },

    async stop() {
      if (nativeSub) {
        nativeSub.remove();
        nativeSub = null;
      }
      if (usingNative) {
        usingNative = false;
        return await nativeStopSpeechRecognition();
      }
      if (webSpeech) {
        webSpeech.stop();
        const txt = webSpeech.getTranscript();
        webSpeech = null;
        return txt;
      }
      return '';
    },
  };
}
