let logs = [];
const listeners = new Set();

export const DevLogger = {
  log: (message, details = null, type = 'info') => {
    const timestamp = new Date().toISOString();
    const newLog = {
      id: Math.random().toString(36).substring(2, 9),
      timestamp,
      message,
      details,
      type // 'info', 'error', 'success', 'warning'
    };
    
    logs.unshift(newLog);
    if (logs.length > 200) {
      logs.pop(); // Keep only last 200
    }
    
    listeners.forEach(listener => listener([...logs]));
    
    if (type === 'error') {
      // console.error(`[DevLog] ${message}`, details || '');
    } else {
      // console.log(`[DevLog] ${message}`, details || '');
    }
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
