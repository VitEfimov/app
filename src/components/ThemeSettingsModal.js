import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, Alert, ScrollView } from 'react-native';
import Modal from 'react-native-modal';
import { useDispatch, useSelector } from 'react-redux';
import { setSourceColor, resetTheme, setUserPicture, setThemeMode } from '../features/themeSlice';
import { useTheme } from '../styles/ThemeContext';
import * as ImagePicker from 'expo-image-picker';
import { useTranslation } from 'react-i18next';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getDeviceLanguage } from '../i18n';

// const PREDEFINED_COLORS = [
//   '#f44336', '#e91e63', '#9c27b0', '#673ab7', '#3f51b5',
//   '#2196f3', '#03a9f4', '#00bcd4', '#009688', '#4caf50',
//   '#8bc34a', '#cddc39', '#ffeb3b', '#ffc107', '#ff9800',
//   '#ff5722', '#795548', '#9e9e9e', '#607d8b'
// ];

const PREDEFINED_COLORS = [
  '#C62828', // Red
  '#AD1457', // Pink
  '#8E24AA', // Purple
  '#5E35B1', // Deep Purple
  '#1E88E5', // Blue
  '#00897B', // Teal
  '#2E7D32', // Dark Green
  '#6B8E6B', // Sage
  '#C0CA33', // Lime
  '#F9A825', // Yellow
  '#FB8C00', // Orange
  '#455A64'  // Slate
];

export default function ThemeSettingsModal({ isVisible, onClose }) {
  const dispatch = useDispatch();
  const { colors, isDark } = useTheme();
  const { t, i18n } = useTranslation();
  
  const currentSourceColor = useSelector(state => state.themeReducer.sourceColor);
  const currentUserPicture = useSelector(state => state.themeReducer.userPicture);
  const currentThemeMode = useSelector(state => state.themeReducer.themeMode);

  const [tempColor, setTempColor] = useState(currentSourceColor);
  const [tempImage, setTempImage] = useState(currentUserPicture);
  const [tempThemeMode, setTempThemeMode] = useState(currentThemeMode || 'system');

  useEffect(() => {
    if (isVisible) {
      setTempColor(currentSourceColor);
      setTempImage(currentUserPicture);
      setTempThemeMode(currentThemeMode || 'system');
    }
  }, [isVisible, currentSourceColor, currentUserPicture, currentThemeMode]);

  const handlePickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Sorry, we need camera roll permissions to upload an image.');
      return;
    }

    let result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      quality: 0.8,
    });

    if (!result.canceled) {
      setTempImage(result.assets[0].uri);
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
    onClose();
  };

  const handleReset = () => {
    Alert.alert(
      t("Reset Defaults"),
      t("Are you sure you want to reset all theme settings to defaults?"),
      [
        { text: t("Cancel"), style: "cancel" },
        { 
          text: t("Reset"), 
          style: "destructive",
          onPress: () => {
            dispatch(resetTheme());
            AsyncStorage.removeItem('appLanguage');
            i18n.changeLanguage(getDeviceLanguage());
            onClose();
          }
        }
      ]
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
      style={{ margin: 0, justifyContent: 'flex-end' }}
    >
      <View style={[styles.modalContent, { backgroundColor: colors.bgCard }]}>
          <View style={styles.dragHandleContainer}>
            <View style={[styles.dragHandle, { backgroundColor: colors.textSecondary }]} />
          </View>
          
          <View style={[styles.header, { borderBottomColor: colors.borderColor }]}>
            <Text style={[styles.title, { color: colors.textPrimary }]}>{t('Theme Settings')}</Text>
            <TouchableOpacity 
              accessible={true} accessibilityRole="button" accessibilityLabel="Close theme settings"
              onPress={onClose} style={styles.closeBtn}
            >
              <Text style={[styles.closeText, { color: colors.textSecondary }]}>✕</Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.scrollArea}>
            
            <View style={[styles.card, { backgroundColor: colors.surfaceContainer }]}>
              <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>{t('Appearance Mode')}</Text>
              
              <View style={styles.themeModeRow}>
                {[
                  { label: t('System'), value: 'system' },
                  { label: t('Light'), value: 'light' },
                  { label: t('Dark'), value: 'dark' },
                  { label: t('Contrast'), value: 'contrast' }
                ].map((modeOption) => (
                  <TouchableOpacity
                    key={modeOption.value}
                    accessible={true} accessibilityRole="button" accessibilityLabel={`Select ${modeOption.label} mode`}
                    style={[
                      styles.themeModeBtn, 
                      { borderColor: colors.borderColor },
                      tempThemeMode === modeOption.value && { backgroundColor: colors.primary, borderColor: colors.primary }
                    ]}
                    onPress={() => setTempThemeMode(modeOption.value)}
                  >
                    <Text style={[
                      styles.themeModeText, 
                      { color: colors.textPrimary },
                      tempThemeMode === modeOption.value && { color: colors.textInverse, fontWeight: 'bold' }
                    ]}>
                      {modeOption.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <View style={[styles.card, { backgroundColor: colors.surfaceContainer }]}>
              <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>{t('Material You Theme')}</Text>
              
              <View style={styles.colorRow}>
                {PREDEFINED_COLORS.map((c, i) => (
                  <TouchableOpacity 
                    key={i} 
                    accessible={true} accessibilityRole="button" accessibilityLabel={`Select predefined color ${i + 1}`}
                    style={[styles.colorCircle, { backgroundColor: c }, tempColor === c && styles.selectedColor]} 
                    onPress={() => setTempColor(c)}
                  />
                ))}
              </View>

              <View style={styles.customColorRow}>
                <Text style={[styles.customColorLabel, { color: colors.textPrimary }]}>{t('Accent Color')}</Text>
                <TextInput 
                  accessible={true} accessibilityLabel="Custom hex color input"
                  style={[styles.colorInput, { backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.04)', color: colors.textPrimary }]}
                  value={tempColor}
                  onChangeText={setTempColor}
                  autoCapitalize="none"
                />
              </View>
            </View>

            <View style={[styles.card, { backgroundColor: colors.surfaceContainer }]}>
              <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>{t('Background Picture')}</Text>
              <TouchableOpacity 
                accessible={true} accessibilityRole="button" accessibilityLabel="Upload background image"
                style={[styles.uploadBox, { borderColor: colors.borderColor, backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : '#f9f9fa' }]} onPress={handlePickImage}
              >
                {tempImage ? (
                  <Text style={[styles.uploadText, { color: colors.textSecondary }]}>{t('Image selected. Tap to change.')}</Text>
                ) : (
                  <Text style={[styles.uploadText, { color: colors.textSecondary }]}>{t('📷 Tap to upload')}</Text>
                )}
              </TouchableOpacity>
              {tempImage && (
                <TouchableOpacity onPress={() => setTempImage(null)} style={{ marginTop: 10, alignSelf: 'center' }} accessible={true} accessibilityRole="button" accessibilityLabel="Remove background image">
                  <Text style={{ color: colors.error || '#c62828', fontSize: 13, fontWeight: 'bold' }}>{t('Remove Image')}</Text>
                </TouchableOpacity>
              )}
            </View>
            <View style={{ height: 20 }} />
          </ScrollView>

          <View style={[styles.footer, { borderTopColor: colors.borderColor }]}>
            <TouchableOpacity 
              accessible={true} accessibilityRole="button" accessibilityLabel="Reset to default theme"
              style={[styles.resetBtn, { backgroundColor: colors.error || '#c62828' }]} onPress={handleReset}
            >
              <Text style={styles.resetText}>{t('Reset Defaults')}</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              accessible={true} accessibilityRole="button" accessibilityLabel="Save theme"
              style={[styles.doneBtn, { backgroundColor: colors.primary }]} onPress={handleSave}
            >
              <Text style={styles.doneText}>{t('Done')}</Text>
            </TouchableOpacity>
          </View>

      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '90%',
    paddingTop: 10,
  },
  dragHandleContainer: {
    paddingBottom: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dragHandle: {
    width: 40,
    height: 5,
    borderRadius: 3,
    backgroundColor: '#666',
    opacity: 0.5,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#000',
  },
  closeBtn: {
    padding: 5,
  },
  closeText: {
    fontSize: 20,
    color: '#666',
  },
  scrollArea: {
    padding: 20,
  },
  card: {
    borderRadius: 12,
    padding: 15,
    marginBottom: 15,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 15,
    color: '#333',
  },
  themeModeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  themeModeBtn: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
  },
  themeModeText: {
    fontSize: 14,
  },
  colorRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 15,
    marginBottom: 20,
    justifyContent: 'flex-start'
  },
  colorCircle: {
    width: 40,
    height: 40,
    borderRadius: 25,
    borderWidth: 2,
    borderColor: '#333',
  },
  selectedColor: {
    borderWidth: 4,
    borderColor: '#000',
  },
  customColorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between'
  },
  customColorLabel: {
    fontSize: 14,
    fontWeight: 'bold',
    marginRight: 10,
  },
  colorInput: {
    flex: 1,
    paddingHorizontal: 15,
    paddingVertical: 10,
    borderRadius: 8,
    fontSize: 14,
    maxWidth: 150,
  },
  uploadBox: {
    borderWidth: 1,
    borderStyle: 'dashed',
    borderRadius: 10,
    padding: 30,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 10,
  },
  uploadText: {
    fontSize: 14,
  },
  footer: {
    flexDirection: 'row',
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: '#eee',
    justifyContent: 'space-between',
  },
  resetBtn: {
    backgroundColor: '#c62828',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 10,
    flex: 0.45,
    alignItems: 'center',
  },
  resetText: {
    color: '#fff',
    fontWeight: 'bold',
    textAlign: 'center',
  },
  doneBtn: {
    backgroundColor: '#285da1',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 10,
    flex: 0.45,
    alignItems: 'center',
  },
  doneText: {
    color: '#fff',
    fontWeight: 'bold',
    textAlign: 'center',
  }
});
