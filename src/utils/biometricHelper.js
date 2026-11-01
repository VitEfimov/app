import * as LocalAuthentication from 'expo-local-authentication';
import { Platform } from 'react-native';
import { SecurityLockHelper } from './securityLockHelper';

export const BiometricHelper = {
  /**
   * Check if the device has biometric or lock-screen authentication hardware and enrolled credentials.
   */
  isAvailable: async () => {
    try {
      if (Platform.OS === 'web') return false;
      const hasHardware = await LocalAuthentication.hasHardwareAsync();
      const isEnrolled = await LocalAuthentication.isEnrolledAsync();
      return !!(hasHardware && isEnrolled);
    } catch (e) {
      console.warn('[BiometricHelper] Availability check error:', e);
      return false;
    }
  },

  /**
   * Determine primary biometric type supported by device.
   */
  getBiometricType: async () => {
    try {
      if (Platform.OS === 'web') return null;
      const types = await LocalAuthentication.supportedAuthenticationTypesAsync();
      if (types.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION)) {
        return 'face';
      }
      if (types.includes(LocalAuthentication.AuthenticationType.FINGERPRINT)) {
        return 'fingerprint';
      }
      if (types.includes(LocalAuthentication.AuthenticationType.IRIS)) {
        return 'iris';
      }
      return 'passcode';
    } catch (e) {
      return null;
    }
  },

  /**
   * Prompt biometric or device screen lock authentication.
   */
  authenticate: async ({
    promptMessage = 'Verify your identity',
    cancelLabel = 'Cancel',
    fallbackLabel = 'Use Passcode'
  } = {}) => {
    if (Platform.OS === 'web') {
      return { success: false, error: 'not_supported' };
    }

    SecurityLockHelper.markAuthenticatingBiometric(true);
    try {
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage,
        cancelLabel,
        fallbackLabel,
        disableDeviceFallback: false,
      });

      return {
        success: !!result.success,
        error: result.error || null,
        warning: result.warning || null,
      };
    } catch (error) {
      console.error('[BiometricHelper] authenticate exception:', error);
      return { success: false, error: error?.message || 'Authentication error' };
    } finally {
      SecurityLockHelper.markAuthenticatingBiometric(false);
    }
  }
};

