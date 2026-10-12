import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet } from 'react-native';
import Modal from 'react-native-modal';
import { useTheme } from '../styles/ThemeContext';

export default function PromptModal({ isVisible, title, message, defaultValue = '', onCancel, onSubmit, submitText = 'Submit', maxLength, keyboardType }) {
  const { colors } = useTheme();
  const [value, setValue] = useState(defaultValue);

  useEffect(() => {
    if (isVisible) {
      setValue(defaultValue);
    }
  }, [isVisible, defaultValue]);

  return (
    <Modal 
      isVisible={isVisible} 
      animationIn="zoomIn" 
      animationOut="zoomOut"
      animationInTiming={180}
      animationOutTiming={150}
      backdropTransitionInTiming={180}
      backdropTransitionOutTiming={150}
      useNativeDriver={true}
      useNativeDriverForBackdrop={true}
      hideModalContentWhileAnimating={true}
      backdropOpacity={0.5}
      onBackdropPress={onCancel}
      style={{ margin: 20, justifyContent: 'center', alignItems: 'center' }}
    >
      <View style={[styles.container, { backgroundColor: colors.bgCard, borderColor: colors.borderColor || 'transparent' }]}>
        <Text style={[styles.title, { color: colors.textPrimary }]}>{title}</Text>
        {message ? <Text style={[styles.message, { color: colors.textSecondary }]}>{message}</Text> : null}
        
        <TextInput
          testID="prompt_input"
          style={[styles.input, { color: colors.textPrimary, borderColor: colors.borderColor, backgroundColor: colors.bgMain }]}
          value={value}
          onChangeText={setValue}
          autoFocus
          onSubmitEditing={() => onSubmit(value)}
          returnKeyType="done"
          maxLength={maxLength}
          keyboardType={keyboardType}
        />

        <View style={styles.actions}>
          <TouchableOpacity style={styles.btn} onPress={onCancel}>
            <Text style={[styles.btnText, { color: colors.textSecondary }]}>Cancel</Text>
          </TouchableOpacity>
          <TouchableOpacity testID="prompt_submit_btn" style={styles.btn} onPress={() => onSubmit(value)}>
            <Text style={[styles.btnText, { color: colors.primary, fontWeight: 'bold' }]}>{submitText}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    borderRadius: 12,
    padding: 20,
    borderWidth: 1,
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  message: {
    fontSize: 14,
    marginBottom: 15,
  },
  input: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    marginBottom: 20,
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 20,
  },
  btn: {
    padding: 10,
  },
  btnText: {
    fontSize: 16,
  }
});
