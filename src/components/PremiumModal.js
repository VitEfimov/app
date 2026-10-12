import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import Modal from 'react-native-modal';
import { useDispatch } from 'react-redux';
import { useTranslation } from 'react-i18next';
import { toggleDevPremium } from '../features/entitlementSlice';
import { useTheme } from '../styles/ThemeContext';

export default function PremiumModal({ isVisible, onClose, featureName }) {
  const dispatch = useDispatch();
  const { colors } = useTheme();
  const { t } = useTranslation();

  const handleUpgrade = () => {
    dispatch(toggleDevPremium());
    onClose();
  };

  const name = featureName ? t(featureName) : t('Premium');

  return (
    <Modal
      isVisible={isVisible}
      animationIn="fadeInUp"
      animationOut="fadeOutDown"
      backdropOpacity={0.6}
      onBackdropPress={onClose}
      style={styles.modal}
    >
      <View style={[styles.container, { backgroundColor: colors.bgCard || '#fff', borderColor: colors.borderColor || 'transparent' }]}>
        <View style={styles.crownContainer}>
          <Text style={styles.crownEmoji}>👑</Text>
        </View>
        <Text style={[styles.badgeText, { color: colors.primary || '#6750A4' }]}>{t('PRO FEATURE') || 'PRO FEATURE'}</Text>
        <Text style={[styles.title, { color: colors.textPrimary || '#000' }]}>
          {name}
        </Text>
        <Text style={[styles.description, { color: colors.textSecondary || '#666' }]}>
          {t('Understand your work patterns with monthly and yearly trends, productivity scores, activity heat maps, streaks, records, goals, and personalized insights.')}
        </Text>

        <TouchableOpacity 
          style={[styles.upgradeBtn, { backgroundColor: colors.primary || '#6750A4' }]}
          onPress={handleUpgrade}
        >
          <Text style={styles.upgradeBtnText}>{t('Upgrade to Pro (Dev Mode)')}</Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={styles.closeBtn}
          onPress={onClose}
        >
          <Text style={[styles.closeBtnText, { color: colors.textSecondary || '#666' }]}>{t('Not now')}</Text>
        </TouchableOpacity>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modal: {
    margin: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  container: {
    width: '100%',
    maxWidth: 400,
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1,
    elevation: 5,
  },
  crownContainer: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: 'rgba(255, 215, 0, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  crownEmoji: {
    fontSize: 32,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1.5,
    marginBottom: 6,
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 10,
  },
  description: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 20,
  },
  upgradeBtn: {
    width: '100%',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 10,
  },
  upgradeBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  closeBtn: {
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  closeBtnText: {
    fontSize: 14,
    fontWeight: '600',
  },
});

