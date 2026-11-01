import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useDispatch } from 'react-redux';
import { setAppPin } from '../features/themeSlice';
import { useTheme } from '../styles/ThemeContext';
import { useTranslation } from 'react-i18next';
import Svg, { Path } from 'react-native-svg';
import { BiometricHelper } from '../utils/biometricHelper';
import { CryptoStorage } from '../utils/cryptoStorage';
import { HapticHelper } from '../utils/hapticHelper';

import ConfirmModal from '../components/ConfirmModal';

const STORAGE_KEY_FAILED_ATTEMPTS = '@pin_lock_failed_attempts';
const STORAGE_KEY_LOCKOUT_UNTIL = '@pin_lock_lockout_until';

// Timing-attack resistant string comparison
function timingSafeEqual(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  let diff = a.length ^ b.length;
  const maxLen = Math.max(a.length, b.length);
  for (let i = 0; i < maxLen; i++) {
    const codeA = a.charCodeAt(i % (a.length || 1)) || 0;
    const codeB = b.charCodeAt(i % (b.length || 1)) || 0;
    diff |= (codeA ^ codeB);
  }
  return diff === 0;
}

const IconBackspace = ({ color }) => (
  <Svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" pointerEvents="none">
    <Path d="M21 4H8l-7 8 7 8h13a2 2 0 002-2V6a2 2 0 00-2-2z" />
    <Path d="M18 9l-6 6M12 9l6 6" />
  </Svg>
);

const IconFingerprint = ({ color }) => (
  <Svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" pointerEvents="none">
    <Path d="M12 10a2 2 0 0 0-2 2c0 1.02-.1 2.51-.26 4" />
    <Path d="M14 13.12c0 2.38 0 6.38-1 8.88" />
    <Path d="M17.29 21.02c.12-.6.43-2.3.5-3.02" />
    <Path d="M2 12a10 10 0 0 1 18-6" />
    <Path d="M2 16h.01" />
    <Path d="M21.8 16c.2-2 .131-5.354 0-6" />
    <Path d="M5 19.5C5.5 18 6 15 6 12a6 6 0 0 1 .34-2" />
    <Path d="M8.65 22c.21-.66.45-1.32.57-2" />
    <Path d="M9 6.8a6 6 0 0 1 9 5.2v2" />
  </Svg>
);

export default function PinLockScreen({ correctPin, onUnlock }) {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const dispatch = useDispatch();
  const [pin, setPin] = useState('');
  const [alertConfig, setAlertConfig] = useState({ isVisible: false, title: '', message: '' });
  const [failedAttempts, setFailedAttempts] = useState(0);
  const [lockoutRemaining, setLockoutRemaining] = useState(0);
  const [forgotModalVisible, setForgotModalVisible] = useState(false);
  const [isBiometricAvailable, setIsBiometricAvailable] = useState(false);
  const timerRef = useRef(null);

  // Load persisted lockout state and check biometrics on mount
  useEffect(() => {
    let isMounted = true;
    const initLockoutState = async () => {
      try {
        const [storedAttempts, storedLockout, bioAvail] = await Promise.all([
          AsyncStorage.getItem(STORAGE_KEY_FAILED_ATTEMPTS),
          AsyncStorage.getItem(STORAGE_KEY_LOCKOUT_UNTIL),
          BiometricHelper.isAvailable()
        ]);

        const attempts = storedAttempts ? parseInt(storedAttempts, 10) : 0;
        const lockoutUntil = storedLockout ? parseInt(storedLockout, 10) : 0;

        if (!isMounted) return;
        setFailedAttempts(attempts);
        setIsBiometricAvailable(bioAvail);

        const now = Date.now();
        if (lockoutUntil > now) {
          const remainingSec = Math.ceil((lockoutUntil - now) / 1000);
          setLockoutRemaining(remainingSec);
        } else if (bioAvail) {
          // Auto-prompt biometric unlock on initial display if device supports it
          attemptBiometricUnlock();
        }
      } catch (e) {
        // Fallback silently if storage read fails
      }
    };

    initLockoutState();
    return () => {
      isMounted = false;
    };
  }, []);

  const attemptBiometricUnlock = async () => {
    if (lockoutRemaining > 0) return;
    const result = await BiometricHelper.authenticate({
      promptMessage: t('Unlock with Biometrics') || 'Unlock with Biometrics',
      cancelLabel: t('Cancel') || 'Cancel'
    });
    if (result.success) {
      await handleSuccessfulUnlock();
    }
  };

  const handleForgotPinPress = async () => {
    if (isBiometricAvailable) {
      const result = await BiometricHelper.authenticate({
        promptMessage: t('Verify fingerprint to reset App PIN') || 'Verify fingerprint to reset App PIN',
        cancelLabel: t('Cancel') || 'Cancel'
      });
      if (result.success) {
        dispatch(setAppPin(null));
        await handleSuccessfulUnlock();
      } else {
        setAlertConfig({
          isVisible: true,
          title: t('Authentication Failed') || 'Authentication Failed',
          message: t('Biometric authentication failed. The App PIN cannot be reset without verification.') || 'Biometric authentication failed. The App PIN cannot be reset without verification.'
        });
      }
    } else {
      setForgotModalVisible(true);
    }
  };

  // Countdown timer for active lockout
  useEffect(() => {
    if (lockoutRemaining > 0) {
      timerRef.current = setInterval(() => {
        setLockoutRemaining(prev => {
          if (prev <= 1) {
            clearInterval(timerRef.current);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [lockoutRemaining]);

  const recordFailedAttempt = async () => {
    const nextAttempts = failedAttempts + 1;
    setFailedAttempts(nextAttempts);

    let lockoutSeconds = 0;
    if (nextAttempts >= 10) {
      lockoutSeconds = 300; // 5 minutes lockout after 10 failed attempts
    } else if (nextAttempts >= 5) {
      lockoutSeconds = 30; // 30 seconds lockout after 5 failed attempts
    }

    try {
      await AsyncStorage.setItem(STORAGE_KEY_FAILED_ATTEMPTS, nextAttempts.toString());
      if (lockoutSeconds > 0) {
        const lockoutUntil = Date.now() + (lockoutSeconds * 1000);
        await AsyncStorage.setItem(STORAGE_KEY_LOCKOUT_UNTIL, lockoutUntil.toString());
        setLockoutRemaining(lockoutSeconds);
      }
    } catch (e) {
      // Ignore storage errors
    }

    if (lockoutSeconds > 0) {
      HapticHelper.error();
      setAlertConfig({
        isVisible: true,
        title: t('Temporary Lockout'),
        message: t('Too many failed attempts. Keypad locked for {{count}} seconds.', { count: lockoutSeconds })
      });
    } else {
      HapticHelper.error();
      const remainingBeforeLock = 5 - (nextAttempts % 5);
      setAlertConfig({
        isVisible: true,
        title: t('Incorrect PIN'),
        message: t('Please try again. {{count}} attempt(s) remaining before temporary lockout.', { count: remainingBeforeLock })
      });
    }
  };

  const handleSuccessfulUnlock = async () => {
    HapticHelper.success();
    try {
      await Promise.all([
        AsyncStorage.removeItem(STORAGE_KEY_FAILED_ATTEMPTS),
        AsyncStorage.removeItem(STORAGE_KEY_LOCKOUT_UNTIL)
      ]);
    } catch (e) {
      // Ignore
    }
    setFailedAttempts(0);
    setLockoutRemaining(0);
    onUnlock();
  };

  useEffect(() => {
    if (pin.length === 4) {
      if (lockoutRemaining > 0) {
        setPin('');
        return;
      }

      if (CryptoStorage.verifyPin(pin, correctPin)) {
        if (correctPin && !CryptoStorage.isPinHashed(correctPin)) {
          // Transparently upgrade legacy plaintext PIN to salted cryptographic hash
          dispatch(setAppPin(CryptoStorage.hashPin(pin)));
        }
        handleSuccessfulUnlock();
      } else {
        recordFailedAttempt();
        setPin('');
      }
    }
  }, [pin, lockoutRemaining]);

  const handlePress = (num) => {
    if (lockoutRemaining > 0) return;
    HapticHelper.light();
    if (pin.length < 4) {
      setPin(prev => prev + num);
    }
  };

  const handleBackspace = () => {
    if (lockoutRemaining > 0) return;
    HapticHelper.selection();
    if (pin.length > 0) {
      setPin(prev => prev.slice(0, -1));
    }
  };

  const isKeypadDisabled = lockoutRemaining > 0;

  return (
    <View style={[styles.container, { backgroundColor: colors.bgMain }]}>
      <Text accessibilityRole="header" style={[styles.title, { color: colors.textPrimary }]}>{t('Enter PIN')}</Text>
      
      {lockoutRemaining > 0 ? (
        <View 
          style={styles.lockoutBanner}
          accessibilityRole="alert"
          accessibilityLiveRegion="assertive"
          accessibilityLabel={t('Too many failed attempts. Try again in {{count}}s', { count: lockoutRemaining })}
        >
          <Text style={styles.lockoutText}>
            {t('Too many failed attempts. Try again in {{count}}s', { count: lockoutRemaining })}
          </Text>
        </View>
      ) : (
        <View 
          style={styles.pinDisplay}
          accessible={true}
          accessibilityRole="text"
          accessibilityLabel={t('{{count}} of 4 digits entered', { count: pin.length })}
          accessibilityLiveRegion="polite"
        >
          {[0, 1, 2, 3].map(i => (
            <View 
              key={i} 
              accessible={false}
              importantForAccessibility="no"
              style={[
                styles.pinDot, 
                { 
                  borderColor: colors.borderColor,
                  backgroundColor: i < pin.length ? colors.primary : 'transparent' 
                }
              ]} 
            />
          ))}
        </View>
      )}

      <View 
        style={[styles.keypad, isKeypadDisabled && styles.keypadDisabled]}
        pointerEvents={isKeypadDisabled ? 'none' : 'auto'}
      >
        {['1', '2', '3', '4', '5', '6', '7', '8', '9', 'biometric', '0', 'delete'].map((key, index) => {
          if (key === 'biometric') {
            if (!isBiometricAvailable) {
              return <View key={index} style={styles.key} pointerEvents="none" accessible={false} importantForAccessibility="no" />;
            }
            return (
              <TouchableOpacity 
                key={index} 
                activeOpacity={0.6}
                disabled={isKeypadDisabled}
                style={[styles.key, { backgroundColor: colors.bgCard }]} 
                onPress={attemptBiometricUnlock}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                accessibilityRole="button"
                accessibilityLabel={t('Unlock with Biometrics') || 'Unlock with Biometrics'}
                accessibilityHint={t('Authenticates with device fingerprint or face to unlock') || 'Authenticates with device fingerprint or face to unlock'}
              >
                <IconFingerprint color={colors.primary} />
              </TouchableOpacity>
            );
          }

          if (key === 'delete') {
            return (
              <TouchableOpacity 
                key={index} 
                activeOpacity={0.6}
                disabled={isKeypadDisabled}
                style={styles.key} 
                onPress={handleBackspace}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                accessibilityRole="button"
                accessibilityLabel={t('Delete digit') || 'Delete digit'}
                accessibilityHint={t('Deletes the last entered PIN digit') || 'Deletes the last entered PIN digit'}
              >
                <IconBackspace color={colors.textSecondary} />
              </TouchableOpacity>
            );
          }

          return (
            <TouchableOpacity 
              key={index} 
              activeOpacity={0.6}
              disabled={isKeypadDisabled}
              style={[styles.key, { backgroundColor: colors.bgCard }]} 
              onPress={() => handlePress(key)}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              accessibilityRole="button"
              accessibilityLabel={key}
              accessibilityHint={t('Enters digit {{digit}}', { digit: key }) || `Enters digit ${key}`}
            >
              <Text style={[styles.keyText, { color: colors.textPrimary }]}>{key}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Forgot PIN Button */}
      <TouchableOpacity
        style={styles.forgotPinBtn}
        onPress={handleForgotPinPress}
        activeOpacity={0.7}
        accessibilityRole="button"
        accessibilityLabel={t('Forgot PIN?') || 'Forgot PIN?'}
        accessibilityHint={t('Resets your App PIN via biometric verification') || 'Resets your App PIN via biometric verification'}
      >
        <Text style={[styles.forgotPinText, { color: colors.primary }]}>
          {t('Forgot PIN?') || 'Forgot PIN?'}
        </Text>
      </TouchableOpacity>

      <ConfirmModal
        isVisible={alertConfig.isVisible}
        title={alertConfig.title}
        message={alertConfig.message}
        confirmText={t('OK')}
        hideCancel={true}
        onConfirm={() => setAlertConfig({ isVisible: false, title: '', message: '' })}
        onCancel={() => setAlertConfig({ isVisible: false, title: '', message: '' })}
      />

      {/* Forgot PIN Confirmation Modal */}
      <ConfirmModal
        isVisible={forgotModalVisible}
        title={t('Forgot PIN?') || 'Forgot PIN?'}
        message={t('Reset PIN will remove the App PIN lock and allow you to access your tasks. Do you want to reset your PIN?') || 'Reset PIN will remove the App PIN lock and allow you to access your tasks. Do you want to reset your PIN?'}
        confirmText={t('Reset PIN') || 'Reset PIN'}
        cancelText={t('Cancel') || 'Cancel'}
        isDestructive={true}
        onConfirm={async () => {
          setForgotModalVisible(false);
          dispatch(setAppPin(null));
          await handleSuccessfulUnlock();
        }}
        onCancel={() => setForgotModalVisible(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    zIndex: 9999,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 40,
  },
  lockoutBanner: {
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    paddingVertical: 12,
    paddingHorizontal: 18,
    borderRadius: 8,
    marginBottom: 50,
    borderWidth: 1,
    borderColor: '#ef4444',
  },
  lockoutText: {
    color: '#ef4444',
    fontSize: 15,
    fontWeight: '600',
    textAlign: 'center',
  },
  pinDisplay: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 60,
    gap: 20,
  },
  pinDot: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
  },
  keypad: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    width: '100%',
    maxWidth: 320,
    gap: 16,
  },
  keypadDisabled: {
    opacity: 0.35,
  },
  key: {
    width: 76,
    height: 76,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 38,
  },
  keyText: {
    fontSize: 34,
    fontWeight: '300',
    textAlign: 'center',
    includeFontPadding: false,
    textAlignVertical: 'center',
  },
  forgotPinBtn: {
    marginTop: 20,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  forgotPinText: {
    fontSize: 14,
    fontWeight: '600',
  }
});
