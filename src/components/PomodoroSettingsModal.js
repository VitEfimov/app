import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
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
  const [breakMin, setBreakMin] = useState('5');
  const [sessions, setSessions] = useState('5');
  const [workSound, setWorkSoundState] = useState('default');
  const [breakSound, setBreakSoundState] = useState('default');

  useEffect(() => {
    if (isSettingsOpen) {
      setWorkMin(String(Math.floor((currentPomodoro.initialTime || 1500) / 60)));
      setBreakMin(String(Math.floor((currentPomodoro.breakInterval || 300) / 60)));
      setSessions(String(typeof currentPomodoro.intervalCount === 'object' ? currentPomodoro.intervalCount.count : 5));
      setWorkSoundState(currentPomodoro.workSound || 'default');
      setBreakSoundState(currentPomodoro.breakSound || 'default');
    }
  }, [isSettingsOpen, currentPomodoro]);

  const handleSave = () => {
    const wMin = parseInt(workMin) || 25;
    const bMin = parseInt(breakMin) || 5;
    const sCount = parseInt(sessions) || 5;

    dispatch(setTime(wMin * 60));
    dispatch(setBreakInterval(bMin * 60));
    dispatch(setIntervalCount(Math.min(sCount, 10))); // Max 10 sessions
    dispatch(setWorkSound(workSound));
    dispatch(setBreakSound(breakSound));
    
    dispatch(togglePomodoroSettings(false));
  };

  const SoundPicker = ({ label, selectedValue, onSelect }) => (
    <View style={styles.settingRow}>
      <Text style={[styles.settingLabel, { color: colors.textPrimary }]}>{label}</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.soundScroll}>
        {predefinedSounds.map((sound) => (
          <TouchableOpacity
            key={sound.value}
            style={[
              styles.soundChip, 
              { borderColor: colors.borderColor },
              selectedValue === sound.value && { backgroundColor: colors.primary, borderColor: colors.primary }
            ]}
            onPress={() => onSelect(sound.value)}
          >
            <Text style={[
              styles.soundChipText,
              { color: selectedValue === sound.value ? colors.textInverse : colors.textPrimary }
            ]}>
              {sound.label}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
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
            <Text style={[styles.settingLabel, { color: colors.textPrimary }]}>Work duration (min)</Text>
            <TextInput
              style={[styles.input, { color: colors.textPrimary, backgroundColor: colors.surfaceContainer, borderColor: colors.surfaceContainerHigh }]}
              value={workMin}
              onChangeText={setWorkMin}
              keyboardType="numeric"
              maxLength={3}
            />
          </View>

          <View style={styles.settingRow}>
            <Text style={[styles.settingLabel, { color: colors.textPrimary }]}>Break duration (min)</Text>
            <TextInput
              style={[styles.input, { color: colors.textPrimary, backgroundColor: colors.surfaceContainer, borderColor: colors.surfaceContainerHigh }]}
              value={breakMin}
              onChangeText={setBreakMin}
              keyboardType="numeric"
              maxLength={3}
            />
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
    marginBottom: 20,
  },
  settingLabel: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 15,
    paddingVertical: 12,
    fontSize: 16,
    width: 100,
  },
  soundScroll: {
    flexDirection: 'row',
  },
  soundChip: {
    borderWidth: 1,
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 20,
    marginRight: 10,
  },
  soundChipText: {
    fontSize: 14,
    fontWeight: '500',
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
