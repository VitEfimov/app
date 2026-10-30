let logs = [];
const listeners = new Set();

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

export const DevLogger = {
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
  },
  error: (message, details = null) => DevLogger.log(message, details, 'error'),
  success: (message, details = null) => DevLogger.log(message, details, 'success'),
  warn: (message, details = null) => DevLogger.log(message, details, 'warning'),
  info: (message, details = null) => DevLogger.log(message, details, 'info'),
  
  getLogs: () => [...logs],
  
  clearLogs: () => {
    logs = [];
    listeners.forEach(listener => listener([]));
  },
  
  subscribe: (listener) => {
    listeners.add(listener);
    listener([...logs]); // Initial call
    return () => listeners.delete(listener);
  }
};
