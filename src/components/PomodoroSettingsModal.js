import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, KeyboardAvoidingView, Platform, ScrollView, Modal as RNModal } from 'react-native';
import Modal from 'react-native-modal';
import { useDispatch, useSelector } from 'react-redux';
import { togglePomodoroSettings, setTime, setBreakInterval, setIntervalCount, setWorkSound, setBreakSound } from '../features/pomodoroSlice';
import { useTheme } from '../styles/ThemeContext';
import Svg, { Path } from 'react-native-svg';
import CustomDropdown from './CustomDropdown';
import { useTranslation } from 'react-i18next';

const IconClose = ({ color }) => (
  <Svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <Path d="M18 6L6 18M6 6l12 12" />
  </Svg>
);



const predefinedSounds = [
  { label: 'Default', value: 'default' },
  { label: 'None', value: 'none' },
  { label: 'Chime', value: 'chime.wav' },
  { label: 'Light', value: 'light ping.wav' },
  { label: 'Notification', value: 'notification.wav' },
];

export default function PomodoroSettingsModal() {
  const dispatch = useDispatch();
  const { colors } = useTheme();
  const { t } = useTranslation();
  
  const { isSettingsOpen, pomodoro } = useSelector(state => state.pomodoroReducer);
  const currentPomodoro = pomodoro[0] || {};

  const [workHrs, setWorkHrs] = useState('0');
  const [workMin, setWorkMin] = useState('25');
  const [workSec, setWorkSec] = useState('0');
  const [breakHrs, setBreakHrs] = useState('0');
  const [breakMin, setBreakMin] = useState('5');
  const [breakSec, setBreakSec] = useState('0');
  const [sessions, setSessions] = useState('5');
  const [workSound, setWorkSoundState] = useState('default');
  const [breakSound, setBreakSoundState] = useState('none');

  const localizedSounds = predefinedSounds.map(s => ({ ...s, label: t(s.label) }));

  useEffect(() => {
    if (isSettingsOpen) {
      setWorkHrs(String(Math.floor((currentPomodoro.initialTime || 1500) / 3600)));
      setWorkMin(String(Math.floor(((currentPomodoro.initialTime || 1500) % 3600) / 60)));
      setWorkSec(String((currentPomodoro.initialTime || 1500) % 60));
      setBreakHrs(String(Math.floor((currentPomodoro.breakInterval || 300) / 3600)));
      setBreakMin(String(Math.floor(((currentPomodoro.breakInterval || 300) % 3600) / 60)));
      setBreakSec(String((currentPomodoro.breakInterval || 300) % 60));
      setSessions(String(typeof currentPomodoro.intervalCount === 'object' ? currentPomodoro.intervalCount.count : 5));
      setWorkSoundState(currentPomodoro.workSound || 'default');
      setBreakSoundState(currentPomodoro.breakSound || 'default');
    }
  }, [isSettingsOpen, currentPomodoro]);

  const handleSave = () => {
    const wHrs = parseInt(workHrs) || 0;
    const wMin = parseInt(workMin) || 0;
    const wSec = parseInt(workSec) || 0;
    const bHrs = parseInt(breakHrs) || 0;
    const bMin = parseInt(breakMin) || 0;
    const bSec = parseInt(breakSec) || 0;
    const sCount = parseInt(sessions) || 5;

    let workTime = wHrs * 3600 + wMin * 60 + wSec;
    if (workTime === 0) workTime = 25 * 60;

    let breakTime = bHrs * 3600 + bMin * 60 + bSec;
    if (breakTime === 0) breakTime = 5 * 60;

    dispatch(setTime(workTime));
    dispatch(setBreakInterval(breakTime));
    dispatch(setIntervalCount(Math.min(sCount, 10))); // Max 10 sessions
    dispatch(setWorkSound(workSound));
    dispatch(setBreakSound(breakSound));
    
    dispatch(togglePomodoroSettings(false));
  };

  const handleResetToDefault = () => {
    dispatch(setTime(25 * 60));
    dispatch(setBreakInterval(5 * 60));
    dispatch(setIntervalCount(5));
    dispatch(setWorkSound('default'));
    dispatch(setBreakSound('default'));
    dispatch(togglePomodoroSettings(false));
  };



  return (
    <Modal
      isVisible={isSettingsOpen}
      onSwipeComplete={() => dispatch(togglePomodoroSettings(false))}
      swipeDirection={['down']}
      onBackdropPress={() => dispatch(togglePomodoroSettings(false))}
      style={{ margin: 0, justifyContent: 'flex-end' }}
    >
      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <View style={[styles.modalContent, { backgroundColor: colors.bgCard }]}>
          <View style={styles.dragHandleContainer}>
            <View style={[styles.dragHandle, { backgroundColor: colors.textSecondary }]} />
          </View>
          <View style={styles.header}>
            <Text style={[styles.title, { color: colors.textPrimary }]}>{t('Pomodoro Settings')}</Text>
            <TouchableOpacity onPress={() => dispatch(togglePomodoroSettings(false))}>
              <IconClose color={colors.textPrimary} />
            </TouchableOpacity>
          </View>

          <View style={[styles.settingRow, { flexDirection: 'column', alignItems: 'flex-start', rowGap: 15 }]}>
            <Text style={[styles.settingLabel, { color: colors.textPrimary }]}>{t('Work duration')}</Text>
            <View style={{ flexDirection: 'row', gap: 10, alignItems: 'center' }}>
              <TextInput
                style={[styles.input, { color: colors.textPrimary, backgroundColor: colors.surfaceContainer, borderColor: colors.surfaceContainerHigh }]}
                value={workHrs}
                onChangeText={setWorkHrs}
                keyboardType="numeric"
                maxLength={2}
                placeholder="Hrs"
                placeholderTextColor={colors.textSecondary}
              />
              <Text style={{ color: colors.textPrimary }}>:</Text>
              <TextInput
                style={[styles.input, { color: colors.textPrimary, backgroundColor: colors.surfaceContainer, borderColor: colors.surfaceContainerHigh }]}
                value={workMin}
                onChangeText={setWorkMin}
                keyboardType="numeric"
                maxLength={3}
                placeholder="Min"
                placeholderTextColor={colors.textSecondary}
              />
              <Text style={{ color: colors.textPrimary }}>:</Text>
              <TextInput
                style={[styles.input, { color: colors.textPrimary, backgroundColor: colors.surfaceContainer, borderColor: colors.surfaceContainerHigh }]}
                value={workSec}
                onChangeText={setWorkSec}
                keyboardType="numeric"
                maxLength={2}
                placeholder="Sec"
                placeholderTextColor={colors.textSecondary}
              />
            </View>
          </View>

          <View style={[styles.settingRow, { flexDirection: 'column', alignItems: 'flex-start', rowGap: 15 }]}>
            <Text style={[styles.settingLabel, { color: colors.textPrimary }]}>{t('Break duration')}</Text>
            <View style={{ flexDirection: 'row', gap: 10, alignItems: 'center' }}>
              <TextInput
                style={[styles.input, { color: colors.textPrimary, backgroundColor: colors.surfaceContainer, borderColor: colors.surfaceContainerHigh }]}
                value={breakHrs}
                onChangeText={setBreakHrs}
                keyboardType="numeric"
                maxLength={2}
                placeholder="Hrs"
                placeholderTextColor={colors.textSecondary}
              />
              <Text style={{ color: colors.textPrimary }}>:</Text>
              <TextInput
                style={[styles.input, { color: colors.textPrimary, backgroundColor: colors.surfaceContainer, borderColor: colors.surfaceContainerHigh }]}
                value={breakMin}
                onChangeText={setBreakMin}
                keyboardType="numeric"
                maxLength={3}
                placeholder="Min"
                placeholderTextColor={colors.textSecondary}
              />
              <Text style={{ color: colors.textPrimary }}>:</Text>
              <TextInput
                style={[styles.input, { color: colors.textPrimary, backgroundColor: colors.surfaceContainer, borderColor: colors.surfaceContainerHigh }]}
                value={breakSec}
                onChangeText={setBreakSec}
                keyboardType="numeric"
                maxLength={2}
                placeholder="Sec"
                placeholderTextColor={colors.textSecondary}
              />
            </View>
          </View>

          <View style={styles.settingRow}>
            <Text style={[styles.settingLabel, { color: colors.textPrimary }]}>{t('Sessions (max 10)')}</Text>
            <TextInput
              style={[styles.input, { color: colors.textPrimary, backgroundColor: colors.surfaceContainer, borderColor: colors.surfaceContainerHigh }]}
              value={sessions}
              onChangeText={setSessions}
              keyboardType="numeric"
              maxLength={2}
            />
          </View>

          <CustomDropdown 
            label={t("Work complete sound")} 
            value={workSound} 
            options={localizedSounds} 
            onSelect={setWorkSoundState} 
            colors={colors} 
            layout="horizontal" 
          />
          <CustomDropdown 
            label={t("Break complete sound")} 
            value={breakSound} 
            options={localizedSounds} 
            onSelect={setBreakSoundState} 
            colors={colors} 
            layout="horizontal" 
          />

          <TouchableOpacity 
            style={[styles.saveBtn, { backgroundColor: colors.primary }]}
            onPress={handleSave}
          >
            <Text style={[styles.saveBtnText, { color: colors.textInverse }]}>{t('Save Settings')}</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={[styles.saveBtn, { backgroundColor: 'transparent', borderWidth: 1, borderColor: colors.borderColor, marginTop: 10 }]}
            onPress={handleResetToDefault}
          >
            <Text style={[styles.saveBtnText, { color: colors.textPrimary }]}>{t('Reset to Default')}</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  modalContent: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 25,
    paddingBottom: 40, // safe area padding
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -5 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 20,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 25,
  },
  dragHandleContainer: {
    paddingBottom: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dragHandle: {
    width: 40,
    height: 5,
    borderRadius: 3,
    opacity: 0.5,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  settingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
    flexWrap: 'wrap',
    rowGap: 10,
  },
  settingLabel: {
    fontSize: 16,
    fontWeight: 'bold',
    flex: 1,
    marginRight: 10,
    minWidth: '50%',
  },
  input: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 16,
    width: 70,
    textAlign: 'center',
  },

  saveBtn: {
    paddingVertical: 15,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 10,
  },
  saveBtnText: {
    fontSize: 16,
    fontWeight: 'bold',
    textAlign: 'center',
  }
});
