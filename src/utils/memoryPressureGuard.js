import { useState, useEffect, useRef, useCallback } from 'react';
import { Platform } from 'react-native';
import { DevLogger } from './logger';

/**
 * Standard Hardware & Runtime Thresholds
 * 
 * Defines the operational boundaries for RAM, CPU latency, and payload density.
 */
export const HARDWARE_THRESHOLDS = {
  // 1. App JVM/ART Heap Saturation (usedHeapMb / maxHeapMb)
  HEAP_WARNING_PERCENT: 75,       // >= 75%: GC thrashing begins, minor frame drops
  HEAP_CRITICAL_PERCENT: 85,      // >= 85%: CRITICAL PEAK, danger of OutOfMemoryError (app crash)

  // 2. Total Device Free RAM (availMemMb)
  AVAIL_MEM_WARNING_MB: 350,      // < 350 MB free on device
  AVAIL_MEM_CRITICAL_MB: 180,     // < 180 MB free on device -> CRITICAL PEAK (Linux OOM killer risk)

  // 3. Processor Responsiveness (Event loop latency)
  EVENT_LOOP_LAG_WARNING_MS: 60,  // >= 60ms lag (drops to ~15-30 FPS)
  EVENT_LOOP_LAG_CRITICAL_MS: 150,// >= 150ms lag (severe thread lock, danger of 5s Android ANR)

  // 4. Section List Density (Single accordion container)
  SECTION_DENSITY_WARNING: 60,    // > 60 items in an expanded section
  SECTION_DENSITY_CRITICAL: 100,  // > 100 items (must disable LayoutAnimation, use clipping)

  // 5. Redux / Storage Payload Size
  PAYLOAD_WARNING_KB: 500,        // > 500 KB serialized task payload
  PAYLOAD_CRITICAL_KB: 1500,      // > 1.5 MB serialized task payload
};

// Internal Singleton State
let currentMetrics = {
  usedHeapMb: 48,
  totalHeapMb: 64,
  maxHeapMb: 256,
  availMemMb: 1850,
  totalMemMb: 4096,
  lowMemory: false,
  thresholdMb: 150,
  eventLoopLagMs: 0,
  fps: 60,
};

let lastLoopTimestamp = Date.now();
let heartbeatTimer = null;
const cleanupHooks = new Map();
const stateListeners = new Set();
let peakHistory = [];
const MAX_HISTORY = 30;
let lastPeakAlertTimestamp = 0;
const PEAK_ALERT_COOLDOWN_MS = 10000; // prevent alert spamming within 10s

/**
 * Reads memory metrics from native Android module or JS runtime fallback.
 */
function sampleRawMetrics() {
  let nativeMetrics = null;
  try {
    const alarmMod = require('../../modules/expo-task-alarm');
    if (alarmMod && typeof alarmMod.getSystemMemoryMetrics === 'function') {
      nativeMetrics = alarmMod.getSystemMemoryMetrics();
    }
  } catch (e) {}

  let jsMemory = null;
  if (typeof global !== 'undefined' && global.performance && global.performance.memory) {
    const m = global.performance.memory;
    jsMemory = {
      usedHeapMb: +(m.usedJSHeapSize / (1024 * 1024)).toFixed(1),
      totalHeapMb: +(m.totalJSHeapSize / (1024 * 1024)).toFixed(1),
      maxHeapMb: +(m.jsHeapSizeLimit / (1024 * 1024)).toFixed(1),
    };
  }

  const now = Date.now();
  const delta = now - lastLoopTimestamp;
  lastLoopTimestamp = now;
  const lag = Math.max(0, delta - (heartbeatIntervalMs || 1000));
  const estFps = Math.max(10, Math.min(60, Math.round(1000 / (16.6 + lag))));

  currentMetrics = {
    usedHeapMb: nativeMetrics?.usedHeapMb ?? jsMemory?.usedHeapMb ?? currentMetrics.usedHeapMb ?? 48,
    totalHeapMb: nativeMetrics?.totalHeapMb ?? jsMemory?.totalHeapMb ?? currentMetrics.totalHeapMb ?? 64,
    maxHeapMb: nativeMetrics?.maxHeapMb ?? jsMemory?.maxHeapMb ?? currentMetrics.maxHeapMb ?? 256,
    availMemMb: nativeMetrics?.availMemMb ?? currentMetrics.availMemMb ?? 1850,
    totalMemMb: nativeMetrics?.totalMemMb ?? currentMetrics.totalMemMb ?? 4096,
    lowMemory: nativeMetrics?.lowMemory ?? false,
    thresholdMb: nativeMetrics?.thresholdMb ?? 150,
    eventLoopLagMs: lag,
    fps: estFps,
  };

  return currentMetrics;
}

let heartbeatIntervalMs = 2000;

/**
 * Evaluates given or current metrics against HARDWARE_THRESHOLDS.
 * 
 * @param {object} [metrics]
 * @returns {object} evaluation result { level, isPeak, isWarning, heapSaturationPercent, reasons, metrics }
 */
export function evaluateHardwareHealth(metrics = null) {
  const m = metrics || currentMetrics;
  const reasons = [];

  const maxHeap = m.maxHeapMb > 0 ? m.maxHeapMb : 256;
  const heapSaturationPercent = Math.min(100, Math.max(0, Math.round((m.usedHeapMb / maxHeap) * 100)));

  // 1. Heap Checks
  const isHeapCritical = heapSaturationPercent >= HARDWARE_THRESHOLDS.HEAP_CRITICAL_PERCENT;
  const isHeapWarning = !isHeapCritical && heapSaturationPercent >= HARDWARE_THRESHOLDS.HEAP_WARNING_PERCENT;

  if (isHeapCritical) {
    reasons.push(`Heap saturation critical: ${heapSaturationPercent}% (${m.usedHeapMb}MB / ${maxHeap}MB max) >= ${HARDWARE_THRESHOLDS.HEAP_CRITICAL_PERCENT}% limit`);
  } else if (isHeapWarning) {
    reasons.push(`Heap saturation elevated: ${heapSaturationPercent}% (${m.usedHeapMb}MB / ${maxHeap}MB max) >= ${HARDWARE_THRESHOLDS.HEAP_WARNING_PERCENT}% warning`);
  }

  // 2. Device Free RAM Checks
  const isDeviceCritical = m.lowMemory === true || (m.availMemMb > 0 && m.availMemMb < HARDWARE_THRESHOLDS.AVAIL_MEM_CRITICAL_MB);
  const isDeviceWarning = !isDeviceCritical && m.availMemMb > 0 && m.availMemMb < HARDWARE_THRESHOLDS.AVAIL_MEM_WARNING_MB;

  if (isDeviceCritical) {
    reasons.push(`Device RAM critical: ${m.availMemMb}MB free (System lowMemory=${m.lowMemory}) < ${HARDWARE_THRESHOLDS.AVAIL_MEM_CRITICAL_MB}MB limit`);
  } else if (isDeviceWarning) {
    reasons.push(`Device RAM low: ${m.availMemMb}MB free < ${HARDWARE_THRESHOLDS.AVAIL_MEM_WARNING_MB}MB warning`);
  }

  // 3. Processor Latency / Event Loop Lag Checks
  const isLagCritical = m.eventLoopLagMs >= HARDWARE_THRESHOLDS.EVENT_LOOP_LAG_CRITICAL_MS;
  const isLagWarning = !isLagCritical && m.eventLoopLagMs >= HARDWARE_THRESHOLDS.EVENT_LOOP_LAG_WARNING_MS;

  if (isLagCritical) {
    reasons.push(`Event loop latency critical: ${m.eventLoopLagMs}ms lag (${m.fps} FPS) >= ${HARDWARE_THRESHOLDS.EVENT_LOOP_LAG_CRITICAL_MS}ms limit`);
  } else if (isLagWarning) {
    reasons.push(`Event loop lag detected: ${m.eventLoopLagMs}ms lag (${m.fps} FPS) >= ${HARDWARE_THRESHOLDS.EVENT_LOOP_LAG_WARNING_MS}ms warning`);
  }

  const isPeak = isHeapCritical || isDeviceCritical || isLagCritical;
  const isWarning = !isPeak && (isHeapWarning || isDeviceWarning || isLagWarning);

  const level = isPeak ? 'CRITICAL_PEAK' : isWarning ? 'WARNING' : 'HEALTHY';

  return {
    level,
    isPeak,
    isWarning,
    heapSaturationPercent,
    reasons,
    metrics: { ...m },
    timestamp: new Date().toISOString(),
  };
}

/**
 * MemoryPressureGuard Singleton
 */
export const MemoryPressureGuard = {
  /**
   * Returns current hardware thresholds.
   */
  getThresholds: () => ({ ...HARDWARE_THRESHOLDS }),

  /**
   * Returns latest cached metrics.
   */
  getMetrics: () => ({ ...currentMetrics }),

  /**
   * Returns history of peak events.
   */
  getHistory: () => [...peakHistory],

  /**
   * Clears peak events history.
   */
  clearHistory: () => {
    peakHistory = [];
    MemoryPressureGuard._notifyListeners();
  },

  /**
   * Registers a defensive cleanup hook that runs when peak memory is reached.
   * 
   * @param {string|Function} identifierOrFn Unique name or callback function
   * @param {Function} [fn] Callback function if first arg is name
   * @returns {Function} Unregister function
   */
  registerCleanupHook: (identifierOrFn, fn) => {
    const key = typeof identifierOrFn === 'string' ? identifierOrFn : `hook_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const callback = typeof identifierOrFn === 'function' ? identifierOrFn : fn;

    if (typeof callback === 'function') {
      cleanupHooks.set(key, callback);
    }

    return () => {
      cleanupHooks.delete(key);
    };
  },

  /**
   * Unregisters a cleanup hook by key.
   */
  unregisterCleanupHook: (key) => {
    cleanupHooks.delete(key);
  },

  /**
   * Executes emergency cleanup routines across all registered hooks and triggers GC.
   * 
   * @param {string} [reason='MANUAL_TRIGGER']
   * @returns {object} { freedCount, timestamp, reason }
   */
  runEmergencyCleanup: (reason = 'MANUAL_TRIGGER') => {
    const start = Date.now();
    let hooksExecuted = 0;

    cleanupHooks.forEach((cb, key) => {
      try {
        cb(currentMetrics);
        hooksExecuted++;
      } catch (err) {
        console.warn(`[MemoryPressureGuard] Cleanup hook "${key}" failed:`, err);
      }
    });

    // Invoke Garbage Collector if exposed in runtime
    if (typeof global !== 'undefined' && typeof global.gc === 'function') {
      try {
        global.gc();
      } catch (e) {}
    }

    const durationMs = Date.now() - start;
    const historyEntry = {
      id: `cleanup_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      timestamp: new Date().toISOString(),
      reason,
      durationMs,
      hooksExecuted,
      metricsSnapshot: { ...currentMetrics },
    };

    peakHistory.unshift(historyEntry);
    if (peakHistory.length > MAX_HISTORY) {
      peakHistory = peakHistory.slice(0, MAX_HISTORY);
    }

    try {
      DevLogger.warn(
        `🛡️ [PEAK GUARD] Emergency cleanup executed (${reason}) in ${durationMs}ms`,
        { hooksExecuted, heap: `${currentMetrics.usedHeapMb}/${currentMetrics.maxHeapMb}MB`, availMem: `${currentMetrics.availMemMb}MB` }
      );
    } catch (e) {}

    MemoryPressureGuard._notifyListeners();
    return historyEntry;
  },

  /**
   * Evaluates custom metrics or samples the system now.
   */
  evaluateMetrics: (customMetrics = null) => {
    return evaluateHardwareHealth(customMetrics);
  },

  /**
   * Evaluates memory pressure and triggers mitigations if peak limit reached.
   */
  checkMemoryPressure: () => {
    const metrics = sampleRawMetrics();
    const evaluation = evaluateHardwareHealth(metrics);

    if (evaluation.isPeak) {
      const now = Date.now();
      if (now - lastPeakAlertTimestamp > PEAK_ALERT_COOLDOWN_MS) {
        lastPeakAlertTimestamp = now;
        try {
          DevLogger.error(
            `⚠️ [PEAK GUARD] Critical Hardware Peak Limit Reached!`,
            { reasons: evaluation.reasons, metrics }
          );
        } catch (e) {}
        MemoryPressureGuard.runEmergencyCleanup('CRITICAL_PEAK_AUTOCLEANUP');
      }
    }

    MemoryPressureGuard._notifyListeners(evaluation);
    return evaluation;
  },

  /**
   * Starts periodic heartbeat monitoring.
   */
  startMonitoring: (intervalMs = 2000) => {
    heartbeatIntervalMs = intervalMs;
    if (heartbeatTimer) clearInterval(heartbeatTimer);
    lastLoopTimestamp = Date.now();
    MemoryPressureGuard.checkMemoryPressure();
    heartbeatTimer = setInterval(() => {
      MemoryPressureGuard.checkMemoryPressure();
    }, heartbeatIntervalMs);
  },

  /**
   * Stops periodic heartbeat monitoring.
   */
  stopMonitoring: () => {
    if (heartbeatTimer) {
      clearInterval(heartbeatTimer);
      heartbeatTimer = null;
    }
  },

  /**
   * Subscribes to memory status and peak events.
   */
  subscribe: (listener) => {
    stateListeners.add(listener);
    listener({
      metrics: { ...currentMetrics },
      evaluation: evaluateHardwareHealth(currentMetrics),
      history: [...peakHistory],
    });
    return () => {
      stateListeners.delete(listener);
    };
  },

  _notifyListeners: (evaluation = null) => {
    const evalData = evaluation || evaluateHardwareHealth(currentMetrics);
    const payload = {
      metrics: { ...currentMetrics },
      evaluation: evalData,
      history: [...peakHistory],
    };
    stateListeners.forEach((fn) => {
      try {
        fn(payload);
      } catch (e) {}
    });
  },
};

/**
 * React Hook for Memory Pressure & Peak Guard
 * 
 * Automatically monitors device memory, heap saturation, and event loop lag.
 * Invokes optional callbacks when thresholds are reached.
 * 
 * @param {object} [options]
 * @param {Function} [options.onPeakReached] Callback invoked when CRITICAL_PEAK is hit
 * @param {Function} [options.onWarning] Callback invoked when WARNING threshold is hit
 * @param {boolean} [options.autoMitigateOnPeak=true] Auto-runs registered emergency cleanups
 * @param {number} [options.intervalMs=2500] Monitoring interval in ms
 * @param {boolean} [options.enabled=true] Whether monitoring is active
 * @returns {object} { status, isPeak, isWarning, heapSaturationPercent, reasons, metrics, peakHistory, triggerEmergencyCleanup, lastCleanedAt }
 */
export function useMemoryPressureGuard({
  onPeakReached,
  onWarning,
  autoMitigateOnPeak = true,
  intervalMs = 2500,
  enabled = true,
} = {}) {
  const [guardState, setGuardState] = useState(() => ({
    metrics: MemoryPressureGuard.getMetrics(),
    evaluation: evaluateHardwareHealth(MemoryPressureGuard.getMetrics()),
    history: MemoryPressureGuard.getHistory(),
  }));

  const lastCallbackLevel = useRef('HEALTHY');
  const onPeakReachedRef = useRef(onPeakReached);
  const onWarningRef = useRef(onWarning);

  useEffect(() => {
    onPeakReachedRef.current = onPeakReached;
    onWarningRef.current = onWarning;
  }, [onPeakReached, onWarning]);

  useEffect(() => {
    if (!enabled) return;

    MemoryPressureGuard.startMonitoring(intervalMs);

    const unsubscribe = MemoryPressureGuard.subscribe((data) => {
      setGuardState(data);

      const currentLevel = data.evaluation.level;
      if (currentLevel !== lastCallbackLevel.current) {
        lastCallbackLevel.current = currentLevel;
        if (currentLevel === 'CRITICAL_PEAK') {
          if (onPeakReachedRef.current) {
            onPeakReachedRef.current(data.evaluation);
          }
          if (autoMitigateOnPeak) {
            MemoryPressureGuard.runEmergencyCleanup('HOOK_AUTO_PEAK_MITIGATION');
          }
        } else if (currentLevel === 'WARNING') {
          if (onWarningRef.current) {
            onWarningRef.current(data.evaluation);
          }
        }
      }
    });

    return () => {
      unsubscribe();
    };
  }, [enabled, intervalMs, autoMitigateOnPeak]);

  const triggerEmergencyCleanup = useCallback((reason = 'USER_MANUAL_TRIGGER') => {
    return MemoryPressureGuard.runEmergencyCleanup(reason);
  }, []);

  return {
    status: guardState.evaluation.level,
    isPeak: guardState.evaluation.isPeak,
    isWarning: guardState.evaluation.isWarning,
    heapSaturationPercent: guardState.evaluation.heapSaturationPercent,
    reasons: guardState.evaluation.reasons,
    metrics: guardState.metrics,
    peakHistory: guardState.history,
    triggerEmergencyCleanup,
    lastCleanedAt: guardState.history[0]?.timestamp || null,
  };
}

