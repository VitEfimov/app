import React, { createContext, useContext, useState, useCallback, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Animated } from 'react-native';
import { SafeAreaInsetsContext } from 'react-native-safe-area-context';
import { useTheme } from './ThemeContext';

const ToastContext = createContext(null);

export const useToast = () => {
  return useContext(ToastContext);
};

export const ToastProvider = ({ children }) => {
  const { colors, isDark, mode } = useTheme();
  const insets = useContext(SafeAreaInsetsContext);
  const [toastConfig, setToastConfig] = useState({
    id: 0,
    visible: false,
    message: '',
    actionLabel: '',
    onAction: null,
  });

  const translateY = useRef(new Animated.Value(100)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(0.95)).current;
  const timeoutRef = useRef(null);
  const activeToastIdRef = useRef(0);

  const hideToast = useCallback((expectedId) => {
    const targetId = expectedId !== undefined ? expectedId : activeToastIdRef.current;
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    Animated.parallel([
      Animated.timing(translateY, {
        toValue: 100,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.timing(scale, {
        toValue: 0.95,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start(({ finished }) => {
      if (finished && targetId === activeToastIdRef.current) {
        setToastConfig(prev => ({ ...prev, visible: false }));
      }
    });
  }, [translateY, opacity, scale]);

  const showToast = useCallback((message, actionLabel, onAction, duration = 5500) => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }

    // Stop any existing toast animation immediately and reset so the new toast visibly pops up fresh as the single active popup
    translateY.stopAnimation();
    opacity.stopAnimation();
    scale.stopAnimation();

    const nextId = activeToastIdRef.current + 1;
    activeToastIdRef.current = nextId;

    translateY.setValue(36);
    opacity.setValue(0);
    scale.setValue(0.95);

    setToastConfig({
      id: nextId,
      visible: true,
      message,
      actionLabel,
      onAction: () => {
        if (onAction) onAction();
        hideToast(nextId);
      }
    });

    Animated.parallel([
      Animated.spring(translateY, {
        toValue: 0,
        useNativeDriver: true,
        bounciness: 4,
        speed: 20,
      }),
      Animated.timing(opacity, {
        toValue: 1,
        duration: 180,
        useNativeDriver: true,
      }),
      Animated.spring(scale, {
        toValue: 1,
        useNativeDriver: true,
        bounciness: 4,
        speed: 20,
      }),
    ]).start();

    timeoutRef.current = setTimeout(() => {
      hideToast(nextId);
    }, duration);
  }, [hideToast, translateY, opacity, scale]);

  return (
    <ToastContext.Provider value={{ showToast, hideToast }}>
      {children}
      {toastConfig.visible && (
        <View style={[styles.toastWrapper, { bottom: 30 + (insets?.bottom || 0) }]} pointerEvents="box-none">
          <Animated.View 
            key={`toast_${toastConfig.id}`}
            style={[
              styles.container, 
              { 
                backgroundColor: isDark ? colors.bgCard : '#333333',
                borderColor: isDark ? colors.borderColor : 'transparent',
                borderWidth: isDark ? 1 : 0,
                transform: [{ translateY }, { scale }],
                opacity
              }
            ]}
          >
            <Text style={[styles.message, { color: isDark ? colors.textPrimary : '#ffffff' }]}>{toastConfig.message}</Text>
            {toastConfig.actionLabel && toastConfig.onAction && (
              <TouchableOpacity onPress={toastConfig.onAction} style={styles.actionButton}>
                <Text style={[styles.actionLabel, { color: isDark ? colors.primary : '#ffca28' }]}>{toastConfig.actionLabel}</Text>
              </TouchableOpacity>
            )}
          </Animated.View>
        </View>
      )}
    </ToastContext.Provider>
  );
};

const styles = StyleSheet.create({
  toastWrapper: {
    position: 'absolute',
    bottom: 30,
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 9999,
  },
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    width: '90%',
    maxWidth: 400,
    elevation: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    zIndex: 9999
  },
  message: {
    flex: 1,
    fontSize: 14,
    fontWeight: '500'
  },
  actionButton: {
    marginLeft: 15,
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  actionLabel: {
    fontSize: 14,
    fontWeight: 'bold',
    textTransform: 'uppercase'
  }
});
