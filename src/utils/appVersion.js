import { APP_VERSION_INFO } from '../versionInfo.js';

export const DEBUG_UNLOCK_TAP_COUNT = 10;
export const DEBUG_UNLOCK_WINDOW_MS = 10000; // 10 seconds

/**
 * Returns the commit-upgraded app version metadata.
 */
export function getAppVersionInfo() {
  return APP_VERSION_INFO || {
    version: '1.0.1',
    baseVersion: '1.0',
    commitCount: 1,
    buildRandom: 1000,
    commitHash: 'dev',
    displayVersion: '1.0.1 (1000)',
  };
}

/**
 * Formats the display string for Settings -> More -> Version.
 */
export function formatAppVersionDisplay(info = getAppVersionInfo()) {
  if (!info) return '1.0.1 (1000)';
  if (info.displayVersion) return String(info.displayVersion);
  const ver = info.version || `${info.baseVersion || '1.0'}.${info.commitCount || 1}`;
  const rnd = info.buildRandom !== undefined ? info.buildRandom : 1000;
  return `${ver} (${rnd})`;
}

/**
 * Pure sliding-window tap tracker for unlocking Debugger & System Logs.
 * Requires `requiredTaps` (10) taps within `windowMs` (10,000 ms = 10 seconds).
 */
export function recordDebugUnlockTap(
  tapTimestamps = [],
  now = Date.now(),
  requiredTaps = DEBUG_UNLOCK_TAP_COUNT,
  windowMs = DEBUG_UNLOCK_WINDOW_MS
) {
  const validExisting = Array.isArray(tapTimestamps)
    ? tapTimestamps.filter((ts) => typeof ts === 'number' && ts <= now && (now - ts) <= windowMs)
    : [];
  const nextTimestamps = [...validExisting, now];
  const tapCount = nextTimestamps.length;
  const unlocked = tapCount >= requiredTaps;

  return {
    timestamps: unlocked ? [] : nextTimestamps,
    tapCount,
    remainingTaps: Math.max(0, requiredTaps - tapCount),
    unlocked,
  };
}
