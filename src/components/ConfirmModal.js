import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import Modal from 'react-native-modal';
import { useTheme } from '../styles/ThemeContext';

export default function ConfirmModal({ isVisible, title, message, onCancel, onConfirm, confirmText = 'Confirm', cancelText = 'Cancel', isDestructive = false, hideCancel = false, secondaryConfirmText, onSecondaryConfirm }) {
  const { colors } = useTheme();

  return (
    <Modal 
      isVisible={isVisible} 
      animationIn="fadeIn" 
      animationOut="fadeOut"
      backdropOpacity={0.5}
      onBackdropPress={onCancel}
      style={{ margin: 20, justifyContent: 'center', alignItems: 'center' }}
    >
      <View style={[styles.container, { backgroundColor: colors.bgCard, borderColor: colors.borderColor || 'transparent' }]}>
        <Text testID="confirm_modal_title" style={[styles.title, { color: colors.textPrimary }]}>{title}</Text>
          {message ? <Text style={[styles.message, { color: colors.textSecondary }]}>{message}</Text> : null}

          <View style={styles.actions}>
            {!hideCancel && (
              <TouchableOpacity testID="confirm_modal_cancel" style={[styles.btn, { backgroundColor: colors.surfaceContainer, borderColor: colors.borderColor, borderWidth: 1 }]} onPress={onCancel}>
                <Text style={[styles.btnText, { color: colors.textPrimary }]}>{cancelText}</Text>
              </TouchableOpacity>
            )}
            {secondaryConfirmText && onSecondaryConfirm && (
              <TouchableOpacity testID="confirm_modal_secondary" style={[styles.btn, { backgroundColor: colors.surfaceContainer, borderColor: colors.borderColor, borderWidth: 1 }]} onPress={onSecondaryConfirm}>
                <Text style={[styles.btnText, { color: colors.textPrimary, fontWeight: 'bold' }]}>{secondaryConfirmText}</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity testID="confirm_modal_submit" style={[styles.btn, { backgroundColor: isDestructive ? 'transparent' : colors.primary }]} onPress={onConfirm}>
              <Text style={[styles.btnText, { color: isDestructive ? '#f44336' : colors.textInverse, fontWeight: 'bold' }]}>{confirmText}</Text>
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
    marginBottom: 20,
    lineHeight: 20,
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    flexWrap: 'wrap',
    gap: 12,
  },
  btn: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  btnText: {
    fontSize: 16,
  }
});
