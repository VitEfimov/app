import React, { useEffect, useRef } from 'react';
import { Animated, TouchableOpacity, StyleSheet, View } from 'react-native';
import Svg, { Path, Circle, Line } from 'react-native-svg';

export default function AnimatedThemeToggle({ mode, isDark, colors, onPress, style }) {
  const spinValue = useRef(new Animated.Value(0)).current;
  const scaleValue = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    spinValue.setValue(0);
    scaleValue.setValue(0.6);

    Animated.parallel([
      Animated.timing(spinValue, {
        toValue: 1,
        duration: 400,
        useNativeDriver: true,
      }),
      Animated.spring(scaleValue, {
        toValue: 1,
        friction: 5,
        tension: 50,
        useNativeDriver: true,
      })
    ]).start();
  }, [mode, isDark]);

  const spin = spinValue.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  return (
    <TouchableOpacity
      activeOpacity={0.8}
      accessible={true}
      accessibilityRole="button"
      accessibilityLabel="Toggle Theme Mode"
      style={[styles.container, { backgroundColor: colors.surfaceContainerHigh }, style]}
      onPress={onPress}
    >
      <Animated.View style={{ transform: [{ rotate: spin }, { scale: scaleValue }], alignItems: 'center', justifyContent: 'center' }}>
        {mode === 'contrast' ? (
          <Svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={colors.textPrimary} strokeWidth="2">
            <Circle cx="12" cy="12" r="10" />
            <Path d="M12 2a10 10 0 0 0 0 20V2z" fill={colors.textPrimary} />
          </Svg>
        ) : isDark ? (
          <Svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={colors.primary} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <Path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" fill={`${colors.primary}33`} />
          </Svg>
        ) : (
          <Svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={colors.primary} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <Circle cx="12" cy="12" r="5" fill={`${colors.primary}33`} />
            <Line x1="12" y1="1" x2="12" y2="3" />
            <Line x1="12" y1="21" x2="12" y2="23" />
            <Line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
            <Line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
            <Line x1="1" y1="12" x2="3" y2="12" />
            <Line x1="21" y1="12" x2="23" y2="12" />
            <Line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
            <Line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
          </Svg>
        )}
      </Animated.View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
