import AsyncStorage from '@react-native-async-storage/async-storage';

let logs = [];
const listeners = new Set();
const STORAGE_KEY_DEV_LOGS = '@system_dev_logs';
const MAX_PERSISTED_LOGS = 100;
let isInitialized = false;
let saveLogsTimeout = null;

const SENSITIVE_KEY_REGEX = /(password|pin|token|auth|secret|credential|key|authorization|bearer|cookie|session)/i;
const JWT_REGEX = /eyJ[A-Za-z0-9-_=]+\.[A-Za-z0-9-_=]+\.?[A-Za-z0-9-_.+/=]*/g;
const BEARER_REGEX = /Bearer\s+[A-Za-z0-9\-._~+/]+=*/gi;

function sanitizeValue(value, seen = new WeakSet()) {
  if (value === null || value === undefined) return value;
  
  if (typeof value === 'string') {
    return value
      .replace(BEARER_REGEX, 'Bearer [REDACTED]')
      .replace(JWT_REGEX, '[REDACTED_JWT]');
  }
  
  if (typeof value === 'number' || typeof value === 'boolean') {
    return value;
  }
  
  if (typeof value === 'object') {
    if (seen.has(value)) {
      return '[CIRCULAR]';
    }
    seen.add(value);
    
    if (Array.isArray(value)) {
      return value.map(item => sanitizeValue(item, seen));
    }
    
    const sanitizedObj = {};
    for (const [k, v] of Object.entries(value)) {
      if (SENSITIVE_KEY_REGEX.test(k)) {
        sanitizedObj[k] = '[REDACTED]';
      } else {
        sanitizedObj[k] = sanitizeValue(v, seen);
      }
    }
    return sanitizedObj;
  }
  
  return String(value);
}

const persistLogsToStorage = () => {
  if (saveLogsTimeout) clearTimeout(saveLogsTimeout);
  saveLogsTimeout = setTimeout(async () => {
    try {
      const sliceToPersist = logs.slice(0, MAX_PERSISTED_LOGS);
      await AsyncStorage.setItem(STORAGE_KEY_DEV_LOGS, JSON.stringify(sliceToPersist));
    } catch (e) {
      // Avoid recursive logging on storage failure
    }
  }, 500);
};

export const DevLogger = {
  init: async () => {
    if (isInitialized) return logs;
    try {
      const stored = await AsyncStorage.getItem(STORAGE_KEY_DEV_LOGS);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length > 0) {
          // Merge stored logs with any in-memory logs
          const existingIds = new Set(logs.map(l => l.id));
          const newEntries = parsed.filter(l => !existingIds.has(l.id));
          logs = [...logs, ...newEntries].slice(0, 200);
        }
      }
    } catch (e) {
      // Storage unavailable or empty
    }
    isInitialized = true;
    listeners.forEach(listener => listener([...logs]));
    return logs;
  },

  log: (message, details = null, type = 'info') => {
    const timestamp = new Date().toISOString();
    const safeMessage = typeof message === 'string' ? sanitizeValue(message) : message;
    const safeDetails = details !== null ? sanitizeValue(details) : null;

    const newLog = {
      id: Math.random().toString(36).substring(2, 9),
      timestamp,
      message: safeMessage,
      details: safeDetails,
      type // 'info', 'error', 'success', 'warning'
    };
    
    logs.unshift(newLog);
    if (logs.length > 200) {
      logs.pop(); // Keep only last 200
    }
    
    listeners.forEach(listener => listener([...logs]));
    persistLogsToStorage();
  },
  error: (message, details = null) => DevLogger.log(message, details, 'error'),
  success: (message, details = null) => DevLogger.log(message, details, 'success'),
  warn: (message, details = null) => DevLogger.log(message, details, 'warning'),
  info: (message, details = null) => DevLogger.log(message, details, 'info'),
  
  getLogs: () => [...logs],
  
  clearLogs: async () => {
    logs = [];
    if (saveLogsTimeout) clearTimeout(saveLogsTimeout);
    try {
      await AsyncStorage.removeItem(STORAGE_KEY_DEV_LOGS);
    } catch (e) {}
    listeners.forEach(listener => listener([]));
  },
  
  subscribe: (listener) => {
    listeners.add(listener);
    if (!isInitialized) {
      DevLogger.init().then(() => listener([...logs])).catch(() => listener([...logs]));
    } else {
      listener([...logs]);
    }
    return () => listeners.delete(listener);
  }
};
