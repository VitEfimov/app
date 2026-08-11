import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import Modal from 'react-native-modal';
import { useDispatch, useSelector } from 'react-redux';
import { executePendingCleanup, cancelPendingCleanup } from '../features/taskSlice';
import { useTheme } from '../styles/ThemeContext';
import { useTranslation } from 'react-i18next';

export default function AutomaticCleanupModal() {
  const dispatch = useDispatch();
  const { colors } = useTheme();
  const { t } = useTranslation();
  
  const pendingCleanupTaskIds = useSelector(state => state.taskReducer.pendingCleanupTaskIds || []);
  const isVisible = pendingCleanupTaskIds.length > 0;

  if (!isVisible) return null;

  return (
    <Modal
      isVisible={isVisible}
      animationIn="fadeIn"
      animationOut="fadeOut"
      backdropOpacity={0.5}
      style={{ margin: 0, justifyContent: 'center', alignItems: 'center' }}
    >
      <View style={[styles.modalContent, { backgroundColor: colors.bgCard }]}>
        <Text style={[styles.title, { color: colors.textPrimary, marginBottom: 15 }]}>
          {t('Automatic Cleanup')}
        </Text>
        <Text style={[styles.description, { color: colors.textSecondary, marginBottom: 25 }]}>
          {t('You have {{count}} old task(s) scheduled for automatic deletion based on your settings. Do you want to delete them?', { count: pendingCleanupTaskIds.length })}
        </Text>
        
        <View style={styles.buttonContainer}>
          <TouchableOpacity 
            style={[styles.button, { backgroundColor: 'transparent', borderWidth: 1, borderColor: colors.borderColor }]}
            onPress={() => dispatch(cancelPendingCleanup())}
          >
            <Text style={[styles.buttonText, { color: colors.textPrimary }]}>{t('Keep Them')}</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={[styles.button, { backgroundColor: colors.danger }]}
            onPress={() => dispatch(executePendingCleanup())}
          >
            <Text style={[styles.buttonText, { color: '#fff' }]}>{t('Delete')}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalContent: {
    width: '85%',
    borderRadius: 16,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  description: {
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 22,
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  button: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  buttonText: {
    fontSize: 16,
    fontWeight: 'bold',
  }
});
