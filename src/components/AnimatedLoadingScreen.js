import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated, Easing, Image, StatusBar } from 'react-native';
import Svg, { Path, Circle } from 'react-native-svg';
import { useTheme } from '../styles/ThemeContext';
import { useTranslation } from 'react-i18next';

export default function AnimatedLoadingScreen() {
  const { colors, isDark, mode } = useTheme();
  const { t } = useTranslation();
  
  const isContrast = mode === 'contrast';
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const spinAnim = useRef(new Animated.Value(0)).current;
  const fadeAnim = useRef(new Animated.Value(0.4)).current;

  useEffect(() => {
    // Pulse animation for logo badge
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.12,
          duration: 900,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 900,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    ).start();

    // Spin animation for circular spinner
    Animated.loop(
      Animated.timing(spinAnim, {
        toValue: 1,
        duration: 1200,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    ).start();

    // Fade pulse animation for text
    Animated.loop(
      Animated.sequence([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 800,
          useNativeDriver: true,
        }),
        Animated.timing(fadeAnim, {
          toValue: 0.4,
          duration: 800,
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, [pulseAnim, spinAnim, fadeAnim]);

  const spin = spinAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  const primaryColor = colors?.primary || '#3B82F6';
  const bgColor = isContrast
    ? '#000000'
    : (colors?.bgMain || (isDark ? '#141419' : '#FAF9F6'));

  // Theme-aware badge styling (light, dark, contrast)
  const badgeBg = isContrast
    ? '#0A0A0A'
    : isDark
      ? `${primaryColor}22`
      : `${primaryColor}14`;

  const badgeBorderColor = isContrast
    ? '#FFFFFF'
    : isDark
      ? `${primaryColor}45`
      : `${primaryColor}30`;

  const badgeBorderWidth = isContrast ? 2 : 1.5;

  // Theme-aware spinner styling
  const spinnerTrack = isContrast
    ? '#333333'
    : isDark
      ? 'rgba(255, 255, 255, 0.15)'
      : `${primaryColor}25`;

  const spinnerHead = isContrast
    ? '#FFFFFF'
    : primaryColor;

  const spinnerWidth = isContrast ? 3.5 : 3;

  // Theme-aware text styling
  const titleColor = isContrast
    ? '#FFFFFF'
    : (colors?.textPrimary || (isDark ? '#FFFFFF' : '#1A1A24'));

  const subtitleColor = isContrast
    ? '#DDDDDD'
    : (colors?.textSecondary || (isDark ? '#9E9EB2' : '#7D7D8E'));

  return (
    <View style={[styles.container, { backgroundColor: bgColor }]}>
      <StatusBar
        backgroundColor={bgColor}
        barStyle={isDark || isContrast ? 'light-content' : 'dark-content'}
      />
      <View style={styles.content}>
        {/* Animated App Logo Icon */}
        <Animated.View style={{ transform: [{ scale: pulseAnim }], marginBottom: 28, alignItems: 'center' }}>
          <View style={[styles.logoBadge, { backgroundColor: badgeBg, borderColor: badgeBorderColor, borderWidth: badgeBorderWidth }]}>
            <Image 
              source={require('../../assets/icon.png')} 
              style={styles.logoImage} 
              resizeMode="contain"
            />
          </View>
        </Animated.View>

        {/* Animated Loading Spinner */}
        <Animated.View style={{ transform: [{ rotate: spin }], marginBottom: 20 }}>
          <Svg width="40" height="40" viewBox="0 0 24 24" fill="none">
            <Circle cx="12" cy="12" r="9" stroke={spinnerTrack} strokeWidth={spinnerWidth} />
            <Path d="M12 3a9 9 0 0 1 9 9" stroke={spinnerHead} strokeWidth={spinnerWidth} strokeLinecap="round" />
          </Svg>
        </Animated.View>

        {/* Pulsing Loading Text */}
        <Animated.Text style={[styles.title, { color: titleColor, opacity: fadeAnim }]}>
          {t('Task Flow')}
        </Animated.Text>
        <Text style={[styles.subtitle, { color: subtitleColor }]}>
          {t('Organizing your tasks...')}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  logoBadge: {
    width: 96,
    height: 96,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 6,
    overflow: 'hidden',
  },
  logoImage: {
    width: 64,
    height: 64,
    borderRadius: 16,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 14,
    fontWeight: '500',
  },
});

