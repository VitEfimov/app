import { FastStorage } from './fastStorage';
import { Platform } from 'react-native';

const STORAGE_KEY_CRASH_LOGS = '@system_crash_logs';
const MAX_CRASH_LOGS = 50;

let memoryCrashLogs = [];
const listeners = new Set();
let isInitialized = false;

/**
 * Normal OS background process eviction (REASON_LOW_MEMORY with Importance > 200, e.g. Importance=400 CACHED)
 * is routine Android OS cache reclamation when the app is minimized/closed, not an application crash.
 */
export function isBackgroundCacheEviction(entry) {
  if (!entry) return false;
  const msg = String(entry.message || '');
  const stack = String(entry.stack || '');
  if (!msg.includes('LOW_MEMORY')) return false;
  const match = stack.match(/Importance=(\d+)/);
  if (match && Number(match[1]) > 200) {
    return true;
  }
  return false;
}

export const CrashLogger = {
  init: async () => {
    if (isInitialized) return memoryCrashLogs;
    try {
      const stored = await FastStorage.getItem(STORAGE_KEY_CRASH_LOGS, { migratePlainOnHit: true });
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) {
          const filtered = parsed.filter(entry => !isBackgroundCacheEviction(entry));
          memoryCrashLogs = filtered;
          if (filtered.length !== parsed.length) {
            FastStorage.setItem(STORAGE_KEY_CRASH_LOGS, JSON.stringify(filtered)).catch(() => {});
          }
        }
      }
    } catch (e) {
      console.warn('[CrashLogger] Failed to load stored crashes:', e);
    }

    // Check for native uncaught crashes from Android runtime
    try {
      const alarmMod = require('../../modules/expo-task-alarm');
      if (alarmMod) {
        if (typeof alarmMod.initNativeCrashHandler === 'function') {
          alarmMod.initNativeCrashHandler();
        }
        if (typeof alarmMod.getNativeCrashLogs === 'function') {
          const rawNative = alarmMod.getNativeCrashLogs();
          const nativeLogs = typeof rawNative === 'string' ? JSON.parse(rawNative) : rawNative;
          if (Array.isArray(nativeLogs) && nativeLogs.length > 0) {
            nativeLogs.filter(entry => !isBackgroundCacheEviction(entry)).forEach(entry => {
              memoryCrashLogs.unshift({
                id: `native_${entry.timestamp || Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
                timestamp: entry.timestamp ? new Date(Number(entry.timestamp)).toISOString() : new Date().toISOString(),
                screenName: 'Native Android Exception',
                message: entry.message || 'Fatal Android Native Crash',
                stack: entry.stack || null,
                componentStack: `Thread: ${entry.thread || 'main'}`,
                platform: `${Platform.OS} (Native ART Crash)`,
                context: 'Captured by Android UncaughtExceptionHandler',
              });
            });
            if (typeof alarmMod.clearNativeCrashLogs === 'function') {
              alarmMod.clearNativeCrashLogs();
            }
            if (memoryCrashLogs.length > MAX_CRASH_LOGS) {
              memoryCrashLogs = memoryCrashLogs.slice(0, MAX_CRASH_LOGS);
            }
            FastStorage.setItem(STORAGE_KEY_CRASH_LOGS, JSON.stringify(memoryCrashLogs)).catch(() => {});
          }
        }
      }
    } catch (e) {}

    isInitialized = true;
    return memoryCrashLogs;
  },

  recordCrash: async ({ screenName = 'Unknown', error, errorInfo = null, context = null }) => {
    try {
      await CrashLogger.init();

      const timestamp = new Date().toISOString();
      const errorMessage = error?.message || (typeof error === 'string' ? error : 'Unknown error');
      const errorStack = error?.stack || null;
      const componentStack = errorInfo?.componentStack || null;

      const crashEntry = {
        id: `crash_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        timestamp,
        screenName,
        message: errorMessage,
        stack: errorStack,
        componentStack,
        platform: `${Platform.OS} (${Platform.Version})`,
        context: context ? JSON.stringify(context) : null,
      };

      memoryCrashLogs.unshift(crashEntry);
      if (memoryCrashLogs.length > MAX_CRASH_LOGS) {
        memoryCrashLogs = memoryCrashLogs.slice(0, MAX_CRASH_LOGS);
      }

      await FastStorage.setItem(STORAGE_KEY_CRASH_LOGS, JSON.stringify(memoryCrashLogs));
      listeners.forEach(fn => fn([...memoryCrashLogs]));
      return crashEntry;
    } catch (e) {
      console.error('[CrashLogger] Failed to save crash:', e);
    }
  },

  getCrashLogs: async () => {
    await CrashLogger.init();
    return [...memoryCrashLogs];
  },

  clearCrashLogs: async () => {
    memoryCrashLogs = [];
    try {
      await FastStorage.removeItem(STORAGE_KEY_CRASH_LOGS);
    } catch (e) {
      console.warn('[CrashLogger] Failed to clear storage:', e);
    }
    listeners.forEach(fn => fn([]));
  },

  subscribe: (listener) => {
    listeners.add(listener);
    CrashLogger.init().then(logs => listener([...logs]));
    return () => listeners.delete(listener);
  }
};

