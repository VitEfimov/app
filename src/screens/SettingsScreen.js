import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, Modal as RNModal } from 'react-native';
import { useDispatch, useSelector } from 'react-redux';
import { clearTasks } from '../features/taskSlice';
import { setTaskNameWrap, setFontSize, setProgressMode, setDefaultSnoozeTime } from '../features/themeSlice';
import { togglePomodoroSettings } from '../features/pomodoroSlice';
import { useTheme } from '../styles/ThemeContext';
import Svg, { Path, Circle } from 'react-native-svg';
import ThemeSettingsModal from '../components/ThemeSettingsModal';
import AutoManageSettings from '../components/AutoManageSettings';

const IconUser = ({ color }) => (
  <Svg width="24" height="24" viewBox="0 0 24 24" fill={color}>
    <Path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/>
  </Svg>
);

const IconSave = ({ color }) => (
  <Svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <Path d="M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2z" />
    <Path d="M17 21v-8H7v8" />
    <Path d="M7 3v5h8V3" />
  </Svg>
);

import CustomDropdown from '../components/CustomDropdown';
import { useTranslation } from 'react-i18next';
import AsyncStorage from '@react-native-async-storage/async-storage';

export default function SettingsScreen({ navigation }) {
  const dispatch = useDispatch();
  const { colors } = useTheme();
  const { t, i18n } = useTranslation();
  
  const theme = useSelector(state => state.themeReducer);
  const taskNameWrap = theme.taskNameWrap || 'wrap';
  const fontSize = theme.fontSize || 'normal';
  const progressMode = theme.progressMode || 'daily';
  const defaultSnoozeTime = theme.defaultSnoozeTime || 30;

  const [isThemeModalVisible, setThemeModalVisible] = useState(false);
  const [isAutoManageModalVisible, setAutoManageModalVisible] = useState(false);

  const languageOptions = [
    { label: 'English', value: 'en' },
    { label: 'Русский', value: 'ru' },
    { label: 'Español', value: 'es' },
    { label: '中文', value: 'zh' },
    { label: '日本語', value: 'ja' },
    { label: 'हिन्दी', value: 'hi' },
    { label: 'Français', value: 'fr' },
    { label: 'Deutsch', value: 'de' },
    { label: 'Italiano', value: 'it' },
    { label: '한국어', value: 'ko' }
  ];

  const wrapOptions = [
    { label: t('Full'), value: 'wrap' },
    { label: t('Truncate'), value: 'nowrap' },
  ];

  const fontOptions = [
    { label: t('Small'), value: 'small' },
    { label: t('Normal'), value: 'normal' },
    { label: t('Big'), value: 'big' },
  ];

  const progressOptions = [
    { label: t('Daily Goal'), value: 'daily' },
    { label: t('Active Workload'), value: 'active' },
    { label: t('Weekly Sprint'), value: 'weekly' },
    { label: t('Lifetime'), value: 'lifetime' },
  ];

  const snoozeOptions = [
    { label: t('5 min'), value: 5 },
    { label: t('10 min'), value: 10 },
    { label: t('15 min'), value: 15 },
    { label: t('30 min'), value: 30 },
    { label: t('1 hour'), value: 60 },
  ];

  const handleDeleteData = () => {
    Alert.alert(
      t("Delete All Data"),
      t("Are you sure you want to clear all your tasks? This action cannot be undone."),
      [
        { text: t("Cancel"), style: "cancel" },
        { 
          text: t("Delete"), 
          style: "destructive",
          onPress: () => {
            dispatch(clearTasks());
            Alert.alert(t('Deleted'), t('All tasks have been cleared.'));
          }
        }
      ]
    );
  };

  const handleSave = () => {
    Alert.alert(t('Settings Saved'), t('Your preferences have been updated.'));
    if (navigation) {
      navigation.navigate('Board');
    }
  };



  return (
    <View style={[styles.container, { backgroundColor: colors.bgMain }]}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        
        {/* Header Section */}
        <View style={styles.topHeader}>
          <View style={{ flex: 1, marginRight: 10 }}>
            <Text style={[styles.pageTitle, { color: colors.textPrimary }]} numberOfLines={1} adjustsFontSizeToFit>{t('Settings')}</Text>
            <Text style={[styles.pageSubtitle, { color: colors.textSecondary }]}>{t('App preferences & account')}</Text>
          </View>
          <TouchableOpacity 
            accessible={true} accessibilityRole="button" accessibilityLabel="Save settings"
            style={[styles.saveBtn, { backgroundColor: colors.primary }]} onPress={handleSave}
          >
            <IconSave color="#fff" />
            <Text style={styles.saveBtnText} numberOfLines={1} adjustsFontSizeToFit>{t('Save')}</Text>
          </TouchableOpacity>
        </View>

        {/* Appearance Section */}
        <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>{t('Appearance')}</Text>
        <View style={styles.sectionGroup}>
          <TouchableOpacity 
            accessible={true} accessibilityRole="button" accessibilityLabel="Customize theme"
            style={[styles.rowItem, { borderBottomColor: colors.borderColor }]} 
            onPress={() => setThemeModalVisible(true)}
          >
            <Text style={[styles.rowLabel, { color: colors.textPrimary }]}>{t('Customize theme')}</Text>
            <Text style={[styles.rowArrow, { color: colors.textSecondary }]}>{'>'}</Text>
          </TouchableOpacity>
          <View style={styles.dropdownRow}>
            <CustomDropdown 
              label={t("Text wrapping") || "Text wrapping"} 
              value={taskNameWrap} 
              options={wrapOptions} 
              onSelect={val => dispatch(setTaskNameWrap(val))} 
              colors={colors}
              layout="horizontal"
            />
          </View>
          <View style={styles.dropdownRow}>
            <CustomDropdown 
              label={t("Font size") || "Font size"} 
              value={fontSize} 
              options={fontOptions} 
              onSelect={val => dispatch(setFontSize(val))} 
              colors={colors}
              layout="horizontal"
            />
          </View>
          <View style={[styles.dropdownRow, { borderBottomWidth: 0, paddingBottom: 0 }]}>
            <CustomDropdown 
              label={t('Language') || 'Language'} 
              value={i18n.language} 
              options={languageOptions} 
              onSelect={val => {
                i18n.changeLanguage(val);
                AsyncStorage.setItem('appLanguage', val);
              }} 
              colors={colors}
              layout="horizontal"
              searchable={true}
              searchPlaceholder={t('Search language...')}
            />
          </View>
        </View>

        {/* Notifications Section */}
        <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>{t('Notifications')}</Text>
        <View style={styles.sectionGroup}>
          <View style={[styles.dropdownRow, { borderBottomWidth: 0, paddingBottom: 0, paddingTop: 15 }]}>
            <CustomDropdown 
              label={t("Default Snooze")} 
              value={defaultSnoozeTime} 
              options={snoozeOptions} 
              onSelect={val => dispatch(setDefaultSnoozeTime(val))} 
              colors={colors}
              layout="horizontal"
            />
          </View>
        </View>

        {/* Automation Section */}
        <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>{t('Automation')}</Text>
        <View style={styles.sectionGroup}>
          <TouchableOpacity 
            accessible={true} accessibilityRole="button" accessibilityLabel="Task Automations"
            style={[styles.rowItem, { borderBottomWidth: 0 }]} 
            onPress={() => setAutoManageModalVisible(true)}
          >
            <Text style={[styles.rowLabel, { color: colors.textPrimary }]}>{t('Task Automations')}</Text>
            <Text style={[styles.rowArrow, { color: colors.textSecondary }]}>{'>'}</Text>
          </TouchableOpacity>
        </View>

        {/* Account Section */}
        <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>{t('Account')}</Text>
        <View style={styles.sectionGroup}>
          <View style={styles.profileRow}>
            <View style={styles.profileIconContainer}>
              <IconUser color="#42416b" />
            </View>
            <View style={styles.profileInfo}>
              <Text style={[styles.profileName, { color: colors.textPrimary }]}>{t('User Profile')}</Text>
              <Text style={[styles.profileEmail, { color: colors.textSecondary }]}>user@example.com</Text>
            </View>
          </View>
          <TouchableOpacity 
            accessible={true} accessibilityRole="button" accessibilityLabel="Delete all data"
            style={styles.deleteBtn} onPress={handleDeleteData}
          >
            <Text style={styles.deleteBtnText}>{t('Delete All Data')}</Text>
          </TouchableOpacity>
        </View>


      </ScrollView>

      {/* Modals */}
      <ThemeSettingsModal 
        isVisible={isThemeModalVisible} 
        onClose={() => setThemeModalVisible(false)} 
      />
      <AutoManageSettings 
        isVisible={isAutoManageModalVisible}
        onClose={() => setAutoManageModalVisible(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 50,
  },
  topHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15,
  },
  pageTitle: {
    fontSize: 32,
    fontWeight: '900',
  },
  pageSubtitle: {
    fontSize: 16,
    marginTop: 2,
  },
  saveBtn: {
    flexDirection: 'row',
    backgroundColor: '#285da1',
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 8,
    alignItems: 'center',
    maxWidth: 140,
  },
  saveBtnText: {
    color: '#fff',
    fontWeight: 'bold',
    marginLeft: 6,
    fontSize: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 10,
    paddingTop: 5,
  },
  sectionGroup: {
    marginBottom: 25,
  },
  rowItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 15,
    borderBottomWidth: 1,
  },
  rowLabel: {
    fontSize: 16,
    fontWeight: '600',
  },
  rowArrow: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  dropdownRow: {
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.05)',
  },
  profileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 15,
  },
  profileIconContainer: {
    width: 50,
    height: 50,
    borderRadius: 10,
    backgroundColor: '#9ca1ca',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 15,
  },
  profileInfo: {
    flex: 1,
  },
  profileName: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  profileEmail: {
    fontSize: 14,
  },
  deleteBtn: {
    backgroundColor: '#c62828',
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
  },
  deleteBtnText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
  }
});
