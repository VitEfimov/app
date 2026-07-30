import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import Modal from 'react-native-modal';
import { useTheme } from '../styles/ThemeContext';

export default function ConfirmModal({ isVisible, title, message, onCancel, onConfirm, confirmText = 'Confirm', cancelText = 'Cancel', isDestructive = false, hideCancel = false }) {
  const { colors } = useTheme();

  return (
    <Modal 
      isVisible={isVisible} 
      animationIn="fadeIn" 
      animationOut="fadeOut"
      backdropOpacity={0.5}
      onBackdropPress={onCancel}
      style={{ margin: 0 }}
    >
      <View style={styles.overlay}>
        <View style={[styles.container, { backgroundColor: colors.bgCard, borderColor: colors.borderColor || 'transparent' }]}>
          <Text testID="confirm_modal_title" style={[styles.title, { color: colors.textPrimary }]}>{title}</Text>
          {message ? <Text style={[styles.message, { color: colors.textSecondary }]}>{message}</Text> : null}

          <View style={styles.actions}>
            {!hideCancel && (
              <TouchableOpacity testID="confirm_modal_cancel" style={styles.btn} onPress={onCancel}>
                <Text style={[styles.btnText, { color: colors.textSecondary }]}>{cancelText}</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity testID="confirm_modal_submit" style={styles.btn} onPress={onConfirm}>
              <Text style={[styles.btnText, { color: isDestructive ? '#f44336' : colors.primary, fontWeight: 'bold' }]}>{confirmText}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
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
    marginBottom: 20,
    lineHeight: 20,
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
