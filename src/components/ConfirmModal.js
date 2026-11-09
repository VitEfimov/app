import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Modal as RNModal } from 'react-native';
import { useTheme } from '../styles/ThemeContext';

export default function ConfirmModal({ isVisible, title, message, onCancel, onConfirm, confirmText = 'Confirm', cancelText = 'Cancel', isDestructive = false, secondaryIsDestructive = false, hideCancel = false, secondaryConfirmText, onSecondaryConfirm }) {
  const { colors } = useTheme();

  return (
    <RNModal 
      visible={Boolean(isVisible)} 
      transparent={true} 
      animationType="fade"
      onRequestClose={onCancel}
    >
      <View style={styles.overlay}>
        <TouchableOpacity 
          style={styles.backdrop}
          activeOpacity={1}
          onPress={onCancel}
        />
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
                <Text style={[styles.btnText, { color: secondaryIsDestructive ? '#f44336' : colors.textPrimary, fontWeight: 'bold' }]}>{secondaryConfirmText}</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity testID="confirm_modal_submit" style={[styles.btn, { backgroundColor: isDestructive ? 'transparent' : colors.primary }]} onPress={onConfirm}>
              <Text style={[styles.btnText, { color: isDestructive ? '#f44336' : colors.textInverse, fontWeight: 'bold' }]}>{confirmText}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </RNModal>
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
  backdrop: {
    ...StyleSheet.absoluteFillObject,
  },
  container: {
    width: '100%',
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    elevation: 10,
    zIndex: 2,
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
    gap: 10,
  },
  btn: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnText: {
    fontSize: 14,
  }
});
