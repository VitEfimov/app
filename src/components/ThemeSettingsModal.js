import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Switch, Platform } from 'react-native';
import Modal from 'react-native-modal';
import { useDispatch, useSelector } from 'react-redux';
import { setSourceColor, resetTheme, setUserPicture, setThemeMode, setRandomColorDaily } from '../features/themeSlice';
import { useTheme } from '../styles/ThemeContext';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system';
import { useTranslation } from 'react-i18next';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getDeviceLanguage } from '../i18n';
import ConfirmModal from './ConfirmModal';
import Svg, { Path, Circle, Rect, Line, Polyline } from 'react-native-svg';

const THEME_ACCENT_COLORS = [
  { name: 'Violet', color: '#6750A4' },
  { name: 'Green', color: '#2E7D32' },
  { name: 'Blue', color: '#1E88E5' },
  { name: 'Orange', color: '#FB8C00' },
  { name: 'Purple', color: '#8E24AA' },
  { name: 'Slate', color: '#455A64' },
];

const IconArrowLeft = ({ color = '#000', size = 20 }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <Line x1="19" y1="12" x2="5" y2="12" />
    <Polyline points="12 19 5 12 12 5" />
  </Svg>
);

const IconCheck = ({ color = '#fff', size = 14 }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
    <Polyline points="20 6 9 17 4 12" />
  </Svg>
);

export default function ThemeSettingsModal({ isVisible, onClose }) {
  const dispatch = useDispatch();
  const { colors, isDark } = useTheme();
  const { t, i18n } = useTranslation();
  
  const currentSourceColor = useSelector(state => state.themeReducer.sourceColor);
  const currentUserPicture = useSelector(state => state.themeReducer.userPicture);
  const currentThemeMode = useSelector(state => state.themeReducer.themeMode);
  const currentRandomColorDaily = useSelector(state => state.themeReducer.randomColorDaily);
  const isPremium = useSelector(state => state.entitlementReducer?.isPremium);

  const [tempColor, setTempColor] = useState(currentSourceColor || '#6750A4');
  const [tempImage, setTempImage] = useState(currentUserPicture);
  const [tempThemeMode, setTempThemeMode] = useState(currentThemeMode || 'system');
  const [tempRandomColorDaily, setTempRandomColorDaily] = useState(currentRandomColorDaily || false);
  const [confirmConfig, setConfirmConfig] = useState({ isVisible: false, title: '', message: '', confirmText: 'Confirm', cancelText: 'Cancel', isDestructive: false, hideCancel: false, onConfirm: null });

  useEffect(() => {
    if (isVisible) {
      setTempColor(currentSourceColor || '#6750A4');
      setTempImage(currentUserPicture);
      setTempThemeMode(currentThemeMode || 'system');
      setTempRandomColorDaily(currentRandomColorDaily || false);
    }
  }, [isVisible, currentSourceColor, currentUserPicture, currentThemeMode, currentRandomColorDaily]);

  const handlePickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      setConfirmConfig({
        isVisible: true,
        title: t('Permission needed') || 'Permission needed',
        message: t('Sorry, we need camera roll permissions to upload an image.') || 'Sorry, we need camera roll permissions to upload an image.',
        confirmText: t('OK'),
        hideCancel: true,
        onConfirm: () => setConfirmConfig(prev => ({ ...prev, isVisible: false }))
      });
      return;
    }

    let result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      quality: 0.8,
    });

    if (!result.canceled) {
      const sourceUri = result.assets[0].uri;
      try {
        const filename = sourceUri.split('/').pop() || `bg_${Date.now()}.jpg`;
        const destUri = `${FileSystem.documentDirectory}${filename}`;
        await FileSystem.copyAsync({ from: sourceUri, to: destUri });
        setTempImage(destUri);
      } catch (e) {
        console.error("Failed to copy image", e);
        setTempImage(sourceUri);
      }
    }
  };

  const handleSave = () => {
    const finalColor = tempColor.startsWith('#') ? tempColor : `#${tempColor}`;
    dispatch(setSourceColor(finalColor));
    if (tempImage !== currentUserPicture) {
      dispatch(setUserPicture(tempImage));
    }
    if (tempThemeMode !== currentThemeMode) {
      dispatch(setThemeMode(tempThemeMode));
    }
    if (tempRandomColorDaily !== currentRandomColorDaily) {
      dispatch(setRandomColorDaily(tempRandomColorDaily));
    }
    onClose();
  };

  const currentColorObj = THEME_ACCENT_COLORS.find(
    c => c.color.toLowerCase() === (tempColor || '').toLowerCase()
  ) || { name: 'Custom', color: tempColor };

  const renderPhonePreview = (modeOption) => {
    const isSelected = tempThemeMode === modeOption.value;
    const isDarkCard = modeOption.value === 'dark';
    const isContrastCard = modeOption.value === 'contrast';

    return (
      <TouchableOpacity
        key={modeOption.value}
        activeOpacity={0.75}
        onPress={() => setTempThemeMode(modeOption.value)}
        style={styles.modeCardWrapper}
        accessibilityRole="radio"
        accessibilityState={{ selected: isSelected }}
      >
        <View style={[
          styles.miniPhone,
          {
            backgroundColor: isDarkCard ? '#1F1E26' : '#FFFFFF',
            borderColor: isSelected 
              ? (colors.primary || '#6750A4') 
              : isContrastCard 
              ? (isDark ? '#555555' : '#000000') 
              : (isDark ? '#2E2D38' : '#E5E5EB'),
            borderWidth: isSelected ? 2 : (isContrastCard ? 1.5 : 1),
          }
        ]}>
          {/* Header pill */}
          <View style={[
            styles.miniPhoneBar, 
            { backgroundColor: isDarkCard ? '#FFFFFF' : '#1A1A24' }
          ]} />
          {/* Main preview box */}
          <View style={[
            styles.miniPhoneBox, 
            { 
              backgroundColor: isDarkCard 
                ? '#2B2936' 
                : (modeOption.value === 'system' ? '#EEEEF2' : '#EDE8FA') 
            }
          ]} />
          {/* Text lines */}
          <View style={[
            styles.miniPhoneLine, 
            { backgroundColor: isDarkCard ? '#3A3848' : '#EEEEF2' }
          ]} />
          <View style={[
            styles.miniPhoneLineShort, 
            { backgroundColor: isDarkCard ? '#3A3848' : '#EEEEF2' }
          ]} />
        </View>

        <Text style={[
          styles.modeCardLabel, 
          { 
            color: isSelected ? (colors.primary || '#6750A4') : colors.textSecondary,
            fontWeight: isSelected ? '700' : '500' 
          }
        ]}>
          {modeOption.label}
        </Text>

        {/* Radio circle */}
        <View style={[
          styles.radioCircle,
          {
            borderColor: isSelected ? (colors.primary || '#6750A4') : colors.borderColor,
          }
        ]}>
          {isSelected && (
            <View style={[
              styles.radioDot, 
              { backgroundColor: colors.primary || '#6750A4' }
            ]} />
          )}
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <Modal
      isVisible={isVisible}
      onSwipeComplete={onClose}
      swipeDirection={['down']}
      propagateSwipe={true}
      onBackdropPress={onClose}
      onBackButtonPress={onClose}
      style={{ margin: 0, justifyContent: 'flex-end', height: '100%' }}
    >
      <View style={[styles.modalContent, { backgroundColor: colors.bgCard || (isDark ? '#18171E' : '#FAF9F6') }]}>
        {/* Drag handle for mobile */}
        <View style={styles.dragHandleContainer}>
          <View style={[styles.dragHandle, { backgroundColor: colors.borderColor || '#DDD' }]} />
        </View>

        {/* Header with back button and Cancel */}
        <View style={styles.topNavRow}>
          <TouchableOpacity 
            onPress={onClose} 
            activeOpacity={0.7}
            style={[styles.backCircle, { backgroundColor: isDark ? '#262530' : '#FFFFFF', borderColor: colors.borderColor }]}
          >
            <Svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={colors.textPrimary} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <Path d="M19 12H5M12 19l-7-7 7-7" />
            </Svg>
          </TouchableOpacity>

          <TouchableOpacity onPress={onClose} activeOpacity={0.7}>
            <Text style={[styles.cancelText, { color: colors.textSecondary }]}>{t('Cancel') || 'Cancel'}</Text>
          </TouchableOpacity>
        </View>

        <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollBody}>
          {/* Screen Title & Subtitle */}
          <Text style={[styles.pageTitle, { color: colors.textPrimary }]}>{t('Appearance') || 'Appearance'}</Text>
          <Text style={[styles.pageSubtitle, { color: colors.textSecondary }]}>{t('Find your focus, in your style.') || 'Find your focus, in your style.'}</Text>

          {/* Section: Appearance mode */}
          <Text style={[styles.sectionHeading, { color: colors.textPrimary }]}>{t('Appearance mode') || 'Appearance mode'}</Text>
          <View style={styles.modesRow}>
            {[
              { label: t('System') || 'System', value: 'system' },
              { label: t('Light') || 'Light', value: 'light' },
              { label: t('Dark') || 'Dark', value: 'dark' },
              { label: t('Contrast') || 'Contrast', value: 'contrast' },
            ].map(renderPhonePreview)}
          </View>

          {/* Section: Material You theme */}
          <Text style={[styles.sectionHeading, { color: colors.textPrimary, marginTop: 24 }]}>{t('Material You theme') || 'Material You theme'}</Text>
          
          <View style={[styles.themeCard, { backgroundColor: isDark ? '#22212C' : '#FFFFFF', borderColor: colors.borderColor }]}>
            {/* Accent Color Header */}
            <View style={styles.accentHeaderRow}>
              <Text style={[styles.accentLabel, { color: colors.textPrimary }]}>{t('Accent color') || 'Accent color'}</Text>
              <Text style={[styles.accentValue, { color: colors.primary || '#6750A4' }]}>{currentColorObj.name}</Text>
            </View>

            {/* Accent Color Circles */}
            <View style={styles.colorSwatchesRow}>
              {THEME_ACCENT_COLORS.map((item) => {
                const isSelected = (tempColor || '').toLowerCase() === item.color.toLowerCase();
                return (
                  <TouchableOpacity
                    key={item.color}
                    activeOpacity={0.75}
                    onPress={() => setTempColor(item.color)}
                    style={[
                      styles.colorDot,
                      { backgroundColor: item.color }
                    ]}
                  >
                    {isSelected && <IconCheck color="#FFFFFF" size={16} />}
                  </TouchableOpacity>
                );
              })}
            </View>

            <View style={[styles.divider, { backgroundColor: colors.borderColor || (isDark ? '#2E2D3A' : '#F0F0F4') }]} />

            {/* Randomize Daily Switch */}
            <View style={styles.randomizeRow}>
              <View style={{ flex: 1, marginRight: 12 }}>
                <Text style={[styles.randomizeTitle, { color: colors.textPrimary }]}>{t('Randomize daily') || 'Randomize daily'}</Text>
                <Text style={[styles.randomizeSubtitle, { color: colors.textSecondary }]}>{t('A fresh accent each morning') || 'A fresh accent each morning'}</Text>
              </View>
              <Switch
                value={tempRandomColorDaily}
                onValueChange={setTempRandomColorDaily}
                trackColor={{ false: colors.borderColor || '#CCC', true: colors.primary || '#6750A4' }}
              />
            </View>
          </View>

          {/* Caption text */}
          <Text style={[styles.captionText, { color: colors.textSecondary }]}>
            {t('System follows your device. Contrast uses stronger borders and clearer text.') || 'System follows your device. Contrast uses stronger borders and clearer text.'}
          </Text>

          {/* Background image upload option (retained as modification) */}
          <TouchableOpacity 
            onPress={handlePickImage}
            style={[styles.bgPictureBtn, { borderColor: colors.borderColor }]}
          >
            <Text style={[styles.bgPictureText, { color: colors.textSecondary }]}>
              {tempImage ? t('🖼 Custom background active (Tap to change)') : t('🖼 Add custom background image')}
            </Text>
          </TouchableOpacity>
        </ScrollView>

        {/* Bottom Save Action Button */}
        <View style={styles.bottomBar}>
          <TouchableOpacity
            activeOpacity={0.85}
            onPress={handleSave}
            style={[styles.saveButton, { backgroundColor: colors.primary || '#6750A4' }]}
          >
            <Text style={styles.saveButtonText}>{t('Save appearance') || 'Save appearance'}</Text>
          </TouchableOpacity>
        </View>

        <ConfirmModal
          isVisible={confirmConfig.isVisible}
          title={confirmConfig.title}
          message={confirmConfig.message}
          confirmText={confirmConfig.confirmText}
          cancelText={confirmConfig.cancelText}
          isDestructive={confirmConfig.isDestructive}
          hideCancel={confirmConfig.hideCancel}
          onConfirm={confirmConfig.onConfirm}
          onCancel={() => setConfirmConfig(prev => ({ ...prev, isVisible: false }))}
        />
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalContent: {
    height: '100%',
    maxHeight: '100%',
    borderTopLeftRadius: 0,
    borderTopRightRadius: 0,
    paddingTop: Platform.OS === 'ios' ? 44 : 16,
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
  topNavRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    marginBottom: 12,
  },
  backCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cancelText: {
    fontSize: 15,
    fontWeight: '500',
  },
  scrollBody: {
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  pageTitle: {
    fontSize: 28,
    fontWeight: '700',
    letterSpacing: -0.5,
    marginBottom: 4,
  },
  pageSubtitle: {
    fontSize: 14,
    marginBottom: 24,
  },
  sectionHeading: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 14,
  },
  modesRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  modeCardWrapper: {
    alignItems: 'center',
    flex: 1,
  },
  miniPhone: {
    width: 68,
    height: 94,
    borderRadius: 14,
    padding: 6,
    alignItems: 'center',
    marginBottom: 8,
  },
  miniPhoneBar: {
    width: 26,
    height: 3.5,
    borderRadius: 2,
    marginBottom: 8,
  },
  miniPhoneBox: {
    width: '100%',
    height: 22,
    borderRadius: 6,
    marginBottom: 6,
  },
  miniPhoneLine: {
    width: '100%',
    height: 5,
    borderRadius: 3,
    marginBottom: 4,
  },
  miniPhoneLineShort: {
    width: '55%',
    alignSelf: 'flex-start',
    height: 5,
    borderRadius: 3,
  },
  modeCardLabel: {
    fontSize: 12,
    marginBottom: 6,
  },
  radioCircle: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 2,
    justifyContent: 'center',
    alignItems: 'center',
  },
  radioDot: {
    width: 9,
    height: 9,
    borderRadius: 4.5,
  },
  themeCard: {
    borderRadius: 20,
    borderWidth: 1,
    padding: 18,
    marginBottom: 12,
  },
  accentHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  accentLabel: {
    fontSize: 15,
    fontWeight: '600',
  },
  accentValue: {
    fontSize: 14,
    fontWeight: '600',
  },
  colorSwatchesRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  colorDot: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  divider: {
    height: 1,
    marginVertical: 14,
  },
  randomizeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  randomizeTitle: {
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 2,
  },
  randomizeSubtitle: {
    fontSize: 12,
  },
  captionText: {
    fontSize: 12,
    lineHeight: 18,
    marginHorizontal: 4,
    marginBottom: 16,
  },
  bgPictureBtn: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    marginBottom: 10,
  },
  bgPictureText: {
    fontSize: 12,
  },
  bottomBar: {
    paddingHorizontal: 20,
    paddingTop: 8,
  },
  saveButton: {
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
  saveButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
});
