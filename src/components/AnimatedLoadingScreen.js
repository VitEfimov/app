import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated, Easing, Image } from 'react-native';
import Svg, { Path, Circle } from 'react-native-svg';
import { useTheme } from '../styles/ThemeContext';
import { useTranslation } from 'react-i18next';

export default function AnimatedLoadingScreen() {
  const { colors, isDark } = useTheme();
  const { t } = useTranslation();
  
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

  const primaryColor = colors.primary || '#3B82F6';
  const bgColor = colors.bgMain || (isDark ? '#121212' : '#F8FAFC');

  return (
    <View style={[styles.container, { backgroundColor: bgColor }]}>
      <View style={styles.content}>
        {/* Animated App Logo Icon */}
        <Animated.View style={{ transform: [{ scale: pulseAnim }], marginBottom: 28, alignItems: 'center' }}>
          <View style={[styles.logoBadge, { backgroundColor: `${primaryColor}18`, borderColor: `${primaryColor}30`, borderWidth: 1.5 }]}>
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
            <Circle cx="12" cy="12" r="9" stroke={`${primaryColor}30`} strokeWidth="3" />
            <Path d="M12 3a9 9 0 0 1 9 9" stroke={primaryColor} strokeWidth="3" strokeLinecap="round" />
          </Svg>
        </Animated.View>

        {/* Pulsing Loading Text */}
        <Animated.Text style={[styles.title, { color: colors.textPrimary || '#1E293B', opacity: fadeAnim }]}>
          {t('Task Flow')}
        </Animated.Text>
        <Text style={[styles.subtitle, { color: colors.textSecondary || '#64748B' }]}>
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

