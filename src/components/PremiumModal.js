import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import Modal from 'react-native-modal';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../styles/ThemeContext';
import { useDispatch } from 'react-redux';
import { toggleDevPremium } from '../features/entitlementSlice';

export default function PremiumModal({ isVisible, onClose, featureName }) {
  const { colors, isDark } = useTheme();
  const { t } = useTranslation();
  const dispatch = useDispatch();

  const handleUpgrade = () => {
    // For now, this triggers our dev toggle to unlock premium instantly
    dispatch(toggleDevPremium());
    onClose();
  };

  return (
    <Modal
      isVisible={isVisible}
      onSwipeComplete={onClose}
      swipeDirection={['down']}
      propagateSwipe={true}
      onBackdropPress={onClose}
      style={{ margin: 0, justifyContent: 'flex-end' }}
    >
      <View style={[styles.modalContent, { backgroundColor: colors.bgCard }]}>
        <View style={styles.dragHandle} />
        
        <View style={styles.iconContainer}>
          <Text style={styles.lockIcon}>🔒</Text>
        </View>

        <Text style={[styles.title, { color: colors.textPrimary }]}>
          {t('Unlock')} {featureName || t('Premium')}
        </Text>
        
        <Text style={[styles.description, { color: colors.textSecondary }]}>
          {t('Understand your work patterns with monthly and yearly trends, productivity scores, activity heat maps, streaks, records, goals, and personalized insights.')}
        </Text>

        <View style={styles.benefitsList}>
          {['Monthly and yearly trends', 'Productivity Score', 'Activity Heat Map', 'Streaks and personal records', 'Focus and board analytics', 'Productivity goals', 'Android Auto integration'].map((benefit, i) => (
            <View key={i} style={styles.benefitRow}>
              <Text style={{ color: colors.primary, marginRight: 10 }}>✓</Text>
              <Text style={{ color: colors.textPrimary }}>{t(benefit)}</Text>
            </View>
          ))}
        </View>

        <TouchableOpacity 
          style={[styles.upgradeBtn, { backgroundColor: '#FFD700' }]}
          onPress={handleUpgrade}
        >
          <Text style={styles.upgradeText}>{t('Upgrade to Pro (Dev Mode)')}</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.cancelBtn} onPress={onClose}>
          <Text style={[styles.cancelText, { color: colors.textSecondary }]}>{t('Not now')}</Text>
        </TouchableOpacity>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalContent: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 25,
    alignItems: 'center',
    paddingBottom: 40
  },
  dragHandle: {
    width: 40,
    height: 5,
    backgroundColor: '#888',
    borderRadius: 3,
    marginBottom: 20,
    alignSelf: 'center'
  },
  iconContainer: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: 'rgba(255, 215, 0, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20
  },
  lockIcon: {
    fontSize: 30
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
    marginBottom: 10,
    textAlign: 'center'
  },
  description: {
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 25,
    lineHeight: 20
  },
  benefitsList: {
    width: '100%',
    marginBottom: 30,
    gap: 12
  },
  benefitRow: {
    flexDirection: 'row',
    alignItems: 'center'
  },
  upgradeBtn: {
    width: '100%',
    padding: 15,
    borderRadius: 10,
    alignItems: 'center',
    marginBottom: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3
  },
  upgradeText: {
    color: '#000',
    fontWeight: 'bold',
    fontSize: 16
  },
  cancelBtn: {
    padding: 10
  },
  cancelText: {
    fontSize: 14
  }
});
