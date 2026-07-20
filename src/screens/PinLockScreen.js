import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, Alert } from 'react-native';
import { useTheme } from '../styles/ThemeContext';
import { useTranslation } from 'react-i18next';

export default function PinLockScreen({ correctPin, onUnlock }) {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const [pin, setPin] = useState('');

  const handleUnlock = () => {
    if (pin === correctPin) {
      onUnlock();
    } else {
      Alert.alert(t('Incorrect PIN'), t('Please try again.'));
      setPin('');
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.bgMain }]}>
      <Text style={[styles.title, { color: colors.textPrimary }]}>{t('Enter PIN')}</Text>
      <TextInput
        style={[styles.input, { color: colors.textPrimary, borderColor: colors.borderColor, backgroundColor: colors.bgCard }]}
        value={pin}
        onChangeText={setPin}
        keyboardType="numeric"
        secureTextEntry
        maxLength={4}
        autoFocus
        onSubmitEditing={handleUnlock}
      />
      <TouchableOpacity style={[styles.btn, { backgroundColor: colors.primary }]} onPress={handleUnlock}>
        <Text style={[styles.btnText, { color: '#fff' }]}>{t('Unlock')}</Text>
      </TouchableOpacity>
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
    marginBottom: 30,
  },
  input: {
    width: '100%',
    maxWidth: 300,
    borderWidth: 1,
    borderRadius: 12,
    padding: 15,
    fontSize: 24,
    textAlign: 'center',
    letterSpacing: 10,
    marginBottom: 30,
  },
  btn: {
    paddingHorizontal: 40,
    paddingVertical: 15,
    borderRadius: 8,
  },
  btnText: {
    fontSize: 18,
    fontWeight: 'bold',
  }
});
