import { Vibration, Platform } from 'react-native';

/**
 * Apple Human Interface Guidelines (HIG) & Google Material Design Haptic Engine
 * 
 * Provides tactile feedback for user interactions:
 * - selection: subtle tap on tab switch, picker scroll, keypad press
 * - light: minor control activation
 * - medium: checkbox toggle, bottom sheet expand
 * - heavy: destructive actions, reordering
 * - success: celebratory rhythm on task completion
 * - warning: alert pulse on timeouts, warnings
 * - error: triple buzz on failed PIN verification or security lockout
 * 
 * Automatically adheres to user's global vibration preference in Settings.
 */

// Vibration motor duration patterns in milliseconds
export const HAPTIC_PATTERNS = {
  selection: 8,
  light: 12,
  medium: 22,
  heavy: 38,
  success: [0, 25, 60, 35],
  warning: [0, 35, 50, 35],
  error: [0, 45, 60, 45, 60, 45],
};

let _vibrationEnabled = true;

// Optional lazy require of expo-haptics if present in environment
let _expoHaptics = null;
try {
  _expoHaptics = require('expo-haptics');
} catch (e) {
  _expoHaptics = null;
}

export const HapticHelper = {
  /**
   * Set global vibration enabled state from user preferences.
   * @param {boolean} enabled
   */
  setVibrationEnabled: (enabled) => {
    _vibrationEnabled = enabled !== false;
  },

  /**
   * Get current vibration enabled state.
   * @returns {boolean}
   */
  isVibrationEnabled: () => _vibrationEnabled,

  /**
   * Core trigger function supporting patterns and expo-haptics fallback.
   * @param {'selection'|'light'|'medium'|'heavy'|'success'|'warning'|'error'} type 
   * @param {object} [options]
   * @param {boolean} [options.vibrationEnabled] Overrides global setting if provided
   */
  trigger: (type = 'selection', options = {}) => {
    const isEnabled = options.vibrationEnabled !== undefined 
      ? !!options.vibrationEnabled 
      : _vibrationEnabled;

    if (!isEnabled) return false;

    try {
      // 1. Web environment handling
      if (Platform.OS === 'web') {
        const pattern = HAPTIC_PATTERNS[type] || HAPTIC_PATTERNS.selection;
        if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
          navigator.vibrate(pattern);
          return true;
        }
        return false;
      }

      // 2. If expo-haptics is available on native iOS/Android, use Taptic / Haptic engine
      if (_expoHaptics) {
        if (type === 'selection' && typeof _expoHaptics.selectionAsync === 'function') {
          _expoHaptics.selectionAsync().catch(() => {});
          return true;
        }
        if ((type === 'light' || type === 'medium' || type === 'heavy') && typeof _expoHaptics.impactAsync === 'function') {
          const style = type === 'heavy' 
            ? _expoHaptics.ImpactFeedbackStyle?.Heavy 
            : type === 'medium'
            ? _expoHaptics.ImpactFeedbackStyle?.Medium
            : _expoHaptics.ImpactFeedbackStyle?.Light;
          _expoHaptics.impactAsync(style).catch(() => {});
          return true;
        }
        if ((type === 'success' || type === 'warning' || type === 'error') && typeof _expoHaptics.notificationAsync === 'function') {
          const notifType = type === 'error'
            ? _expoHaptics.NotificationFeedbackType?.Error
            : type === 'warning'
            ? _expoHaptics.NotificationFeedbackType?.Warning
            : _expoHaptics.NotificationFeedbackType?.Success;
          _expoHaptics.notificationAsync(notifType).catch(() => {});
          return true;
        }
      }

      // 3. Cross-platform universal fallback via react-native Vibration
      const pattern = HAPTIC_PATTERNS[type] || HAPTIC_PATTERNS.selection;
      Vibration.vibrate(pattern);
      return true;
    } catch (e) {
      // Fail silently without disrupting user flow
      return false;
    }
  },

  selection: (options) => HapticHelper.trigger('selection', options),
  light: (options) => HapticHelper.trigger('light', options),
  medium: (options) => HapticHelper.trigger('medium', options),
  heavy: (options) => HapticHelper.trigger('heavy', options),
  success: (options) => HapticHelper.trigger('success', options),
  warning: (options) => HapticHelper.trigger('warning', options),
  error: (options) => HapticHelper.trigger('error', options),

  /**
   * Expose reset for isolated test runs
   */
  _resetForTesting: () => {
    _vibrationEnabled = true;
  }
};
