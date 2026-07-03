import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, KeyboardAvoidingView, Platform, ScrollView, Modal as RNModal } from 'react-native';
import Modal from 'react-native-modal';
import { useDispatch, useSelector } from 'react-redux';
import { togglePomodoroSettings, setTime, setBreakInterval, setIntervalCount, setWorkSound, setBreakSound } from '../features/pomodoroSlice';
import { useTheme } from '../styles/ThemeContext';
import Svg, { Path } from 'react-native-svg';

const IconClose = ({ color }) => (
  <Svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <Path d="M18 6L6 18M6 6l12 12" />
  </Svg>
);

const IconChevronDown = ({ color }) => (
  <Svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <Path d="M6 9l6 6 6-6" />
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
  
  const { isSettingsOpen, pomodoro } = useSelector(state => state.pomodoroReducer);
  const currentPomodoro = pomodoro[0] || {};

  const [workMin, setWorkMin] = useState('25');
  const [workSec, setWorkSec] = useState('0');
  const [breakMin, setBreakMin] = useState('5');
  const [breakSec, setBreakSec] = useState('0');
  const [sessions, setSessions] = useState('5');
  const [workSound, setWorkSoundState] = useState('default');
  const [breakSound, setBreakSoundState] = useState('default');

  useEffect(() => {
    if (isSettingsOpen) {
      setWorkMin(String(Math.floor((currentPomodoro.initialTime || 1500) / 60)));
      setWorkSec(String((currentPomodoro.initialTime || 1500) % 60));
      setBreakMin(String(Math.floor((currentPomodoro.breakInterval || 300) / 60)));
      setBreakSec(String((currentPomodoro.breakInterval || 300) % 60));
      setSessions(String(typeof currentPomodoro.intervalCount === 'object' ? currentPomodoro.intervalCount.count : 5));
      setWorkSoundState(currentPomodoro.workSound || 'default');
      setBreakSoundState(currentPomodoro.breakSound || 'default');
    }
  }, [isSettingsOpen, currentPomodoro]);

  const handleSave = () => {
    const wMin = parseInt(workMin) || 0;
    const wSec = parseInt(workSec) || 0;
    const bMin = parseInt(breakMin) || 0;
    const bSec = parseInt(breakSec) || 0;
    const sCount = parseInt(sessions) || 5;

    let workTime = wMin * 60 + wSec;
    if (workTime === 0) workTime = 25 * 60;

    let breakTime = bMin * 60 + bSec;
    if (breakTime === 0) breakTime = 5 * 60;

    dispatch(setTime(workTime));
    dispatch(setBreakInterval(breakTime));
    dispatch(setIntervalCount(Math.min(sCount, 10))); // Max 10 sessions
    dispatch(setWorkSound(workSound));
    dispatch(setBreakSound(breakSound));
    
    dispatch(togglePomodoroSettings(false));
  };

  const Dropdown = ({ value, options, onSelect }) => {
    const [isOpen, setIsOpen] = useState(false);
    const selectedLabel = options.find(o => o.value === value)?.label || value;
    const surfaceLighter = colors.surfaceContainerHigh;
    
    return (
      <View>
        <TouchableOpacity 
          style={[styles.dropdownBtn, { borderColor: colors.borderColor, backgroundColor: surfaceLighter }]}
          onPress={() => setIsOpen(true)}
        >
          <Text style={[styles.dropdownText, { color: colors.textPrimary }]}>{selectedLabel}</Text>
          <IconChevronDown color={colors.textSecondary} />
        </TouchableOpacity>
        
        <RNModal visible={isOpen} transparent animationType="fade">
          <TouchableOpacity style={styles.dropdownOverlay} activeOpacity={1} onPress={() => setIsOpen(false)}>
            <View style={[styles.dropdownMenu, { backgroundColor: colors.bgCard, borderColor: colors.borderColor }]}>
              {options.map(opt => (
                <TouchableOpacity 
                  key={opt.value} 
                  style={styles.dropdownItem} 
                  onPress={() => { onSelect(opt.value); setIsOpen(false); }}
                >
                  <Text style={[styles.dropdownItemText, { color: opt.value === value ? colors.primary : colors.textPrimary, fontWeight: opt.value === value ? 'bold' : 'normal' }]}>{opt.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </TouchableOpacity>
        </RNModal>
      </View>
    );
  };

  const SoundPicker = ({ label, selectedValue, onSelect }) => (
    <View style={styles.settingRow}>
      <Text style={[styles.settingLabel, { color: colors.textPrimary }]}>{label}</Text>
      <Dropdown value={selectedValue} options={predefinedSounds} onSelect={onSelect} />
    </View>
  );

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
            <Text style={[styles.title, { color: colors.textPrimary }]}>Pomodoro Settings</Text>
            <TouchableOpacity onPress={() => dispatch(togglePomodoroSettings(false))}>
              <IconClose color={colors.textPrimary} />
            </TouchableOpacity>
          </View>

          <View style={styles.settingRow}>
            <Text style={[styles.settingLabel, { color: colors.textPrimary }]}>Work duration</Text>
            <View style={{ flexDirection: 'row', gap: 10, alignItems: 'center' }}>
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

          <View style={styles.settingRow}>
            <Text style={[styles.settingLabel, { color: colors.textPrimary }]}>Break duration</Text>
            <View style={{ flexDirection: 'row', gap: 10, alignItems: 'center' }}>
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
            <Text style={[styles.settingLabel, { color: colors.textPrimary }]}>Sessions (max 10)</Text>
            <TextInput
              style={[styles.input, { color: colors.textPrimary, backgroundColor: colors.surfaceContainer, borderColor: colors.surfaceContainerHigh }]}
              value={sessions}
              onChangeText={setSessions}
              keyboardType="numeric"
              maxLength={2}
            />
          </View>

          <SoundPicker label="Work complete sound" selectedValue={workSound} onSelect={setWorkSoundState} />
          <SoundPicker label="Break complete sound" selectedValue={breakSound} onSelect={setBreakSoundState} />

          <TouchableOpacity 
            style={[styles.saveBtn, { backgroundColor: colors.primary }]}
            onPress={handleSave}
          >
            <Text style={[styles.saveBtnText, { color: colors.textInverse }]}>Save Settings</Text>
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
  },
  settingLabel: {
    fontSize: 15,
    fontWeight: '600',
    flex: 1,
  },
  input: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 15,
    paddingVertical: 12,
    fontSize: 16,
    width: 80,
    textAlign: 'center',
  },
  dropdownBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 15,
    paddingVertical: 10,
    minWidth: 150,
  },
  dropdownText: {
    fontSize: 14,
    marginRight: 10,
  },
  dropdownOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  dropdownMenu: {
    width: 250,
    borderRadius: 8,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  dropdownItem: {
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.05)',
  },
  dropdownItemText: {
    fontSize: 16,
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
  }
});
