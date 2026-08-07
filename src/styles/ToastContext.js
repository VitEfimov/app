import React, { createContext, useContext, useState, useCallback, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Animated } from 'react-native';
import { useTheme } from './ThemeContext';

const ToastContext = createContext(null);

export const useToast = () => {
  return useContext(ToastContext);
};

export const ToastProvider = ({ children }) => {
  const { colors } = useTheme();
  const [toastConfig, setToastConfig] = useState({
    visible: false,
    message: '',
    actionLabel: '',
    onAction: null,
  });

  const translateY = useRef(new Animated.Value(100)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const timeoutRef = useRef(null);

  const hideToast = useCallback(() => {
    Animated.parallel([
      Animated.timing(translateY, {
        toValue: 100,
        duration: 250,
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: 0,
        duration: 250,
        useNativeDriver: true,
      })
    ]).start(() => {
      setToastConfig(prev => ({ ...prev, visible: false }));
    });
  }, [translateY, opacity]);

  const showToast = useCallback((message, actionLabel, onAction, duration = 4000) => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    setToastConfig({
      visible: true,
      message,
      actionLabel,
      onAction: () => {
        if (onAction) onAction();
        hideToast();
      }
    });

    Animated.parallel([
      Animated.spring(translateY, {
        toValue: 0,
        useNativeDriver: true,
        bounciness: 0,
      }),
      Animated.timing(opacity, {
        toValue: 1,
        duration: 250,
        useNativeDriver: true,
      })
    ]).start();

    timeoutRef.current = setTimeout(() => {
      hideToast();
    }, duration);
  }, [hideToast, translateY, opacity]);

  return (
    <ToastContext.Provider value={{ showToast, hideToast }}>
      {children}
      {toastConfig.visible && (
        <Animated.View 
          style={[
            styles.container, 
            { 
              backgroundColor: colors.textPrimary, // Inverse colors for high contrast
              transform: [{ translateY }],
              opacity
            }
          ]}
        >
          <Text style={[styles.message, { color: colors.bgMain }]}>{toastConfig.message}</Text>
          {toastConfig.actionLabel && toastConfig.onAction && (
            <TouchableOpacity onPress={toastConfig.onAction} style={styles.actionButton}>
              <Text style={[styles.actionLabel, { color: colors.primary }]}>{toastConfig.actionLabel}</Text>
            </TouchableOpacity>
          )}
        </Animated.View>
      )}
    </ToastContext.Provider>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 30,
    alignSelf: 'center',
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
