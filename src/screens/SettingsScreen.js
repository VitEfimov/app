import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, Modal as RNModal } from 'react-native';
import { useDispatch, useSelector } from 'react-redux';
import { clearTasks } from '../features/taskSlice';
import { setTaskNameWrap, setFontSize, setProgressMode } from '../features/themeSlice';
import { useTheme } from '../styles/ThemeContext';
import Svg, { Path, Circle } from 'react-native-svg';
import ThemeSettingsModal from '../components/ThemeSettingsModal';

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

export default function SettingsScreen({ navigation }) {
  const dispatch = useDispatch();
  const { colors } = useTheme();
  
  const theme = useSelector(state => state.themeReducer);
  const taskNameWrap = theme.taskNameWrap || 'wrap';
  const fontSize = theme.fontSize || 'normal';
  const progressMode = theme.progressMode || 'daily';

  const [isThemeModalVisible, setThemeModalVisible] = useState(false);

  const wrapOptions = [
    { label: 'Full', value: 'wrap' },
    { label: 'Truncate', value: 'nowrap' },
  ];

  const fontOptions = [
    { label: 'Small', value: 'small' },
    { label: 'Normal', value: 'normal' },
    { label: 'Big', value: 'big' },
  ];

  const progressOptions = [
    { label: 'Daily Goal', value: 'daily' },
    { label: 'Active Workload', value: 'active' },
    { label: 'Weekly Sprint', value: 'weekly' },
    { label: 'Lifetime', value: 'lifetime' },
  ];

  const handleDeleteData = () => {
    Alert.alert(
      "Delete All Data",
      "Are you sure you want to clear all your tasks? This action cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        { 
          text: "Delete", 
          style: "destructive",
          onPress: () => {
            dispatch(clearTasks());
            Alert.alert('Deleted', 'All tasks have been cleared.');
          }
        }
      ]
    );
  };

  const handleSave = () => {
    Alert.alert('Settings Saved', 'Your preferences have been updated.');
    if (navigation) {
      navigation.navigate('Board');
    }
  };



  return (
    <View style={[styles.container, { backgroundColor: colors.bgMain }]}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        
        {/* Header Section */}
        <View style={styles.topHeader}>
          <View>
            <Text style={[styles.pageTitle, { color: colors.textPrimary }]}>Settings</Text>
            <Text style={[styles.pageSubtitle, { color: colors.textSecondary }]}>App preferences & account</Text>
          </View>
          <TouchableOpacity style={[styles.saveBtn, { backgroundColor: colors.primary }]} onPress={handleSave}>
            <IconSave color="#fff" />
            <Text style={styles.saveBtnText}>Save</Text>
          </TouchableOpacity>
        </View>

        {/* Account Section */}
        <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>Account</Text>
        <View style={[styles.card, { backgroundColor: colors.bgCard }]}>
          <View style={styles.profileRow}>
            <View style={styles.profileIconContainer}>
              <IconUser color="#42416b" />
            </View>
            <View style={styles.profileInfo}>
              <Text style={[styles.profileName, { color: colors.textPrimary }]}>User Profile</Text>
              <Text style={[styles.profileEmail, { color: colors.textSecondary }]}>user@example.com</Text>
            </View>
          </View>
          <TouchableOpacity style={styles.deleteBtn} onPress={handleDeleteData}>
            <Text style={styles.deleteBtnText}>Delete All Data</Text>
          </TouchableOpacity>
        </View>

        {/* Customization Section */}
        <Text style={[styles.sectionTitle, { color: colors.textSecondary, paddingTop: 20 }]}>Customization</Text>
        <View style={[styles.card, { backgroundColor: colors.bgCard }]}>
          
          <CustomDropdown 
            label="Text wrapping" 
            value={taskNameWrap} 
            options={wrapOptions} 
            onSelect={val => dispatch(setTaskNameWrap(val))} 
            colors={colors}
            layout="horizontal"
          />

          <CustomDropdown 
            label="Font size" 
            value={fontSize} 
            options={fontOptions} 
            onSelect={val => dispatch(setFontSize(val))} 
            colors={colors}
            layout="horizontal"
          />

          <CustomDropdown 
            label="Dashboard Progress" 
            value={progressMode} 
            options={progressOptions} 
            onSelect={val => dispatch(setProgressMode(val))} 
            colors={colors}
            layout="horizontal"
          />

          {/* Customize Theme Button */}
          <TouchableOpacity style={[styles.actionBtn, { zIndex: 1, backgroundColor: colors.primary }]} onPress={() => setThemeModalVisible(true)}>
            <Text style={styles.actionBtnText}>🎨 Customize theme</Text>
          </TouchableOpacity>



        </View>

      </ScrollView>

      {/* Modal */}
      <ThemeSettingsModal 
        isVisible={isThemeModalVisible} 
        onClose={() => setThemeModalVisible(false)} 
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
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 8,
    alignItems: 'center',
  },
  saveBtnText: {
    color: '#fff',
    fontWeight: 'bold',
    marginLeft: 8,
    fontSize: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 10,
    paddingTop: 5,
  },
  card: {
    borderRadius: 20,
    padding: 15,
    marginBottom: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 3,
  },
  profileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
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
    paddingVertical: 15,
    borderRadius: 10,
    alignItems: 'center',
  },
  deleteBtnText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
  },

  actionBtn: {
    backgroundColor: '#285da1',
    paddingVertical: 15,
    borderRadius: 10,
    alignItems: 'center',
    marginBottom: 10,
  },
  actionBtnText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
  }
});
