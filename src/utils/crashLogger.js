import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

const STORAGE_KEY_CRASH_LOGS = '@system_crash_logs';
const MAX_CRASH_LOGS = 50;

let memoryCrashLogs = [];
const listeners = new Set();
let isInitialized = false;

export const CrashLogger = {
  init: async () => {
    if (isInitialized) return memoryCrashLogs;
    try {
      const stored = await AsyncStorage.getItem(STORAGE_KEY_CRASH_LOGS);
      if (stored) {
        memoryCrashLogs = JSON.parse(stored);
      }
    } catch (e) {
      console.warn('[CrashLogger] Failed to load stored crashes:', e);
    }
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

      await AsyncStorage.setItem(STORAGE_KEY_CRASH_LOGS, JSON.stringify(memoryCrashLogs));
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
      await AsyncStorage.removeItem(STORAGE_KEY_CRASH_LOGS);
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

