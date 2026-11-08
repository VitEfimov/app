import { DevLogger } from './logger';

let eventHistory = [];
const listeners = new Set();

export const TaskEditDiagnostics = {
  record: (type, payload = {}) => {
    const event = {
      id: Math.random().toString(36).substring(2, 9),
      type,
      timestamp: new Date().toISOString(),
      payload,
    };
    eventHistory.unshift(event);
    if (eventHistory.length > 30) {
      eventHistory.pop();
    }
    listeners.forEach((listener) => {
      try {
        listener([...eventHistory]);
      } catch (e) {}
    });

    // Also pipe directly into DevLogger for persistent storage across app restarts
    const summary = typeof payload === 'string' ? payload : JSON.stringify(payload);
    DevLogger.info(`[TaskEditDiag] ${type}`, payload);
  },

  getHistory: () => [...eventHistory],

  getLastEvent: () => (eventHistory.length > 0 ? eventHistory[0] : null),

  subscribe: (listener) => {
    if (typeof listener === 'function') {
      listeners.add(listener);
      listener([...eventHistory]);
      return () => listeners.delete(listener);
    }
    return () => {};
  },

  clear: () => {
    eventHistory = [];
    listeners.forEach((l) => {
      try {
        l([]);
      } catch (e) {}
    });
  },
};

