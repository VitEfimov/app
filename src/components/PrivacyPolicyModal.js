import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import Modal from 'react-native-modal';
import Svg, { Path } from 'react-native-svg';
import { useTheme } from '../styles/ThemeContext';
import { useTranslation } from 'react-i18next';
import { PRIVACY_POLICY_DISCLOSURES } from '../utils/gdprHelper';

const IconShieldCheck = ({ color }) => (
  <Svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <Path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    <Path d="M9 12l2 2 4-4" />
  </Svg>
);

const IconClose = ({ color }) => (
  <Svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <Path d="M18 6L6 18M6 6l12 12" />
  </Svg>
);

export default function PrivacyPolicyModal({ isVisible, onClose }) {
  const { colors, isDark } = useTheme();
  const { t } = useTranslation();

  return (
    <Modal
      isVisible={isVisible}
      animationIn="fadeInUp"
      animationOut="fadeOutDown"
      backdropOpacity={0.6}
      onBackdropPress={onClose}
      style={styles.modal}
    >
      <View style={[styles.container, { backgroundColor: colors.bgCard, borderColor: colors.borderColor }]}>
        {/* Header */}
        <View style={[styles.header, { borderBottomColor: colors.borderColor }]}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 }}>
            <View style={[styles.iconCircle, { backgroundColor: isDark ? 'rgba(93,69,219,0.2)' : 'rgba(93,69,219,0.1)' }]}>
              <IconShieldCheck color={colors.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text 
                accessibilityRole="header" 
                style={[styles.title, { color: colors.textPrimary }]}
              >
                {t('Privacy & Data Protection') || 'Privacy & Data Protection'}
              </Text>
              <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
                {t('GDPR & CCPA Transparency Notice') || 'GDPR & CCPA Transparency Notice'}
              </Text>
            </View>
          </View>
          <TouchableOpacity
            accessible={true}
            accessibilityRole="button"
            accessibilityLabel={t('Close') || 'Close'}
            style={styles.closeBtn}
            onPress={onClose}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <IconClose color={colors.textSecondary} />
          </TouchableOpacity>
        </View>

        {/* Content list */}
        <ScrollView 
          style={styles.scrollArea} 
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {PRIVACY_POLICY_DISCLOSURES.map((item) => (
            <View 
              key={item.id} 
              style={[styles.disclosureCard, { backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)', borderColor: colors.borderColor }]}
            >
              <Text style={[styles.itemTitle, { color: colors.textPrimary }]}>
                {t(item.title) || item.title}
              </Text>
              <Text style={[styles.itemText, { color: colors.textSecondary }]}>
                {t(item.text) || item.text}
              </Text>
            </View>
          ))}
        </ScrollView>

        {/* Footer */}
        <View style={[styles.footer, { borderTopColor: colors.borderColor }]}>
          <TouchableOpacity
            accessible={true}
            accessibilityRole="button"
            accessibilityLabel={t('Got it') || 'Got it'}
            style={[styles.confirmBtn, { backgroundColor: colors.primary }]}
            onPress={onClose}
          >
            <Text style={[styles.confirmBtnText, { color: '#ffffff' }]}>
              {t('Got it') || 'Got it'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modal: {
    margin: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  container: {
    width: '100%',
    maxWidth: 500,
    maxHeight: '85%',
    borderRadius: 18,
    borderWidth: 1,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingVertical: 14,
    borderBottomWidth: 1,
  },
  iconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
  },
  subtitle: {
    fontSize: 12,
    marginTop: 2,
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollArea: {
    paddingHorizontal: 16,
  },
  scrollContent: {
    paddingVertical: 14,
    gap: 12,
  },
  disclosureCard: {
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
  },
  itemTitle: {
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 6,
  },
  itemText: {
    fontSize: 13,
    lineHeight: 18,
  },
  footer: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
  },
  confirmBtn: {
    height: 44,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  confirmBtnText: {
    fontSize: 15,
    fontWeight: '600',
  },
});

