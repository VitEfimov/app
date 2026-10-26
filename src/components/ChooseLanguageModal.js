import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Platform } from 'react-native';
import Modal from 'react-native-modal';
import { useTranslation } from 'react-i18next';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTheme } from '../styles/ThemeContext';
import Svg, { Path } from 'react-native-svg';

const LANGUAGES = [
  { code: 'en', label: 'English', sub: 'English' },
  { code: 'ru', label: 'Русский', sub: 'Russian' },
  { code: 'es', label: 'Español', sub: 'Spanish' },
  { code: 'zh', label: '中文', sub: 'Chinese' },
  { code: 'ja', label: '日本語', sub: 'Japanese' },
  { code: 'fr', label: 'Français', sub: 'French' },
  { code: 'de', label: 'Deutsch', sub: 'German' },
  { code: 'it', label: 'Italiano', sub: 'Italian' },
  { code: 'hi', label: 'हिन्दी', sub: 'Hindi' },
  { code: 'ko', label: '한국어', sub: 'Korean' },
];

export default function ChooseLanguageModal({ isVisible, onClose }) {
  const { colors, isDark } = useTheme();
  const { t, i18n } = useTranslation();
  const [selectedLang, setSelectedLang] = useState(i18n.language || 'en');

  useEffect(() => {
    if (isVisible) {
      setSelectedLang(i18n.language || 'en');
    }
  }, [isVisible, i18n.language]);

  const handleApply = async () => {
    await i18n.changeLanguage(selectedLang);
    await AsyncStorage.setItem('appLanguage', selectedLang);
    onClose();
  };

  const activeBg = colors.primaryLight 
    ? (colors.primaryLight.startsWith('#') ? `${colors.primaryLight}25` : colors.primaryLight) 
    : (isDark ? 'rgba(98, 70, 234, 0.25)' : 'rgba(98, 70, 234, 0.12)');

  return (
    <Modal
      isVisible={isVisible}
      onSwipeComplete={onClose}
      swipeDirection={['down']}
      propagateSwipe={true}
      onBackdropPress={onClose}
      onBackButtonPress={onClose}
      style={{ margin: 0, justifyContent: 'flex-end' }}
    >
      <View style={[styles.modalContent, { backgroundColor: colors.bgCard || (isDark ? '#1C1B24' : '#FFFFFF') }]}>
        <View style={styles.dragHandleContainer}>
          <View style={[styles.dragHandle, { backgroundColor: colors.borderColor || '#DDD' }]} />
        </View>

        {/* Title row */}
        <View style={styles.headerRow}>
          <View style={{ flex: 1, paddingRight: 10 }}>
            <Text style={[styles.title, { color: colors.textPrimary }]}>{t('Choose your language') || 'Choose your language'}</Text>
            <Text style={[styles.subtitle, { color: colors.textSecondary }]}>{t('Make planning feel more familiar.') || 'Make planning feel more familiar.'}</Text>
          </View>
          <TouchableOpacity 
            onPress={onClose}
            activeOpacity={0.7}
            style={[styles.closeCircle, { backgroundColor: isDark ? '#2B2A36' : '#F0F0F4' }]}
          >
            <Svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={colors.textSecondary} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <Path d="M18 6L6 18M6 6l12 12" />
            </Svg>
          </TouchableOpacity>
        </View>

        <ScrollView showsVerticalScrollIndicator={false} style={styles.languagesList}>
          {LANGUAGES.map((lang) => {
            const isSelected = selectedLang === lang.code;

            return (
              <TouchableOpacity
                key={lang.code}
                activeOpacity={0.75}
                onPress={() => setSelectedLang(lang.code)}
                style={[
                  styles.languageCard,
                  {
                    backgroundColor: isSelected ? activeBg : (isDark ? '#23222E' : '#FFFFFF'),
                    borderColor: isSelected ? (colors.primary || '#6750A4') : (colors.borderColor || '#ECECEF'),
                  }
                ]}
              >
                <View style={{ flex: 1 }}>
                  <Text style={[
                    styles.langLabel, 
                    { 
                      color: isSelected ? (colors.primary || '#6750A4') : colors.textPrimary,
                      fontWeight: isSelected ? '700' : '600'
                    }
                  ]}>
                    {lang.label}
                  </Text>
                  <Text style={[styles.langSub, { color: colors.textSecondary }]}>
                    {lang.sub}
                  </Text>
                </View>

                {/* Radio Circle */}
                <View style={[
                  styles.radioOuter,
                  {
                    borderColor: isSelected ? (colors.primary || '#6750A4') : (colors.borderColor || '#CCC')
                  }
                ]}>
                  {isSelected && (
                    <View style={[styles.radioInner, { backgroundColor: colors.primary || '#6750A4' }]} />
                  )}
                </View>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* Apply language button */}
        <View style={styles.bottomBar}>
          <TouchableOpacity
            activeOpacity={0.85}
            onPress={handleApply}
            style={[styles.applyBtn, { backgroundColor: colors.primary || '#6750A4' }]}
          >
            <Text style={styles.applyBtnText}>{t('Apply language') || 'Apply language'}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalContent: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    maxHeight: '85%',
    paddingBottom: Platform.OS === 'ios' ? 24 : 12,
  },
  dragHandleContainer: {
    alignItems: 'center',
    paddingVertical: 10,
  },
  dragHandle: {
    width: 38,
    height: 4,
    borderRadius: 2,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    marginBottom: 16,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    letterSpacing: -0.4,
    marginBottom: 2,
  },
  subtitle: {
    fontSize: 13,
  },
  closeCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  languagesList: {
    paddingHorizontal: 20,
    maxHeight: 360,
  },
  languageCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: 16,
    borderWidth: 1.5,
    paddingVertical: 14,
    paddingHorizontal: 16,
    marginBottom: 10,
  },
  langLabel: {
    fontSize: 16,
    marginBottom: 2,
  },
  langSub: {
    fontSize: 12,
  },
  radioOuter: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 10,
  },
  radioInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  bottomBar: {
    paddingHorizontal: 20,
    paddingTop: 12,
  },
  applyBtn: {
    height: 52,
    borderRadius: 26,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 4,
  },
  applyBtnText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
});
