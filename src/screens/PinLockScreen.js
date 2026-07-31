import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Pressable, Alert } from 'react-native';
import { useTheme } from '../styles/ThemeContext';
import { useTranslation } from 'react-i18next';
import Svg, { Path } from 'react-native-svg';

const IconBackspace = ({ color }) => (
  <Svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <Path d="M21 4H8l-7 8 7 8h13a2 2 0 002-2V6a2 2 0 00-2-2z" />
    <Path d="M18 9l-6 6M12 9l6 6" />
  </Svg>
);

export default function PinLockScreen({ correctPin, onUnlock }) {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const [pin, setPin] = useState('');

  useEffect(() => {
    if (pin.length === 4) {
      if (pin === correctPin) {
        onUnlock();
      } else {
        Alert.alert(t('Incorrect PIN'), t('Please try again.'));
        setPin('');
      }
    }
  }, [pin]);

  const handlePress = (num) => {
    if (pin.length < 4) {
      setPin(prev => prev + num);
    }
  };

  const handleBackspace = () => {
    if (pin.length > 0) {
      setPin(prev => prev.slice(0, -1));
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.bgMain }]}>
      <Text style={[styles.title, { color: colors.textPrimary }]}>{t('Enter PIN')}</Text>
      
      <View style={styles.pinDisplay}>
        {[0, 1, 2, 3].map(i => (
          <View 
            key={i} 
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

      <View style={styles.keypad}>
        {['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', 'delete'].map((key, index) => {
          if (key === '') {
            return <View key={index} style={styles.key} />;
          }

          if (key === 'delete') {
            return (
              <Pressable 
                key={index} 
                style={({ pressed }) => [styles.key, { opacity: pressed ? 0.5 : 1 }]} 
                onPress={handleBackspace}
              >
                <IconBackspace color={colors.textSecondary} />
              </Pressable>
            );
          }

          return (
            <Pressable 
              key={index} 
              style={({ pressed }) => [styles.key, { backgroundColor: colors.bgCard, opacity: pressed ? 0.5 : 1 }]} 
              onPress={() => handlePress(key)}
            >
              <Text style={[styles.keyText, { color: colors.textPrimary }]}>{key}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 50,
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
  }
});
