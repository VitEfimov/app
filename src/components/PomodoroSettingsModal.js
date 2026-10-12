import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, KeyboardAvoidingView, Platform, ScrollView, Modal as RNModal } from 'react-native';
import Modal from 'react-native-modal';
import { useDispatch, useSelector } from 'react-redux';
import { togglePomodoroSettings, updatePomodoroSettings } from '../features/pomodoroSlice';
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
  { label: 'Bonjo', value: 'bonjo.mp3' },
  { label: 'Pisk', value: 'pisk.mp3' },
  { label: 'Tucktuck', value: 'tucktuck.mp3' },
  { label: 'Alarm 02', value: 'alarm_02.mp3' },
  { label: 'Bass Alarm', value: 'bass_alarm.mp3' },
  { label: 'Bell', value: 'bell.mp3' },
  { label: 'Bell 01', value: 'bell01.mp3' },
  { label: 'Oak (Cello)', value: 'cellos_pizz.mp3' },
  { label: 'Summit (Cello)', value: 'cellos_pizzdgg.mp3' },
  { label: 'Timber (Cello)', value: 'cellos_pizzedf.mp3' },
  { label: 'Suspense (Cello)', value: 'cellos_tremolo.mp3' },
  { label: 'Chime', value: 'chime.wav' },
  { label: 'Fireworks', value: 'fireworks.mp3' },
  { label: 'Keystone', value: 'keys.mp3' },
  { label: 'Keystone Soft', value: 'keys2.mp3' },
  { label: 'Koto', value: 'koto.mp3' },
  { label: 'Zen (Koto)', value: 'koto_notification.mp3' },
  { label: 'Koto Shamisen', value: 'koto_shamisen.mp3' },
  { label: 'Light Ping', value: 'light_ping.mp3' },
  { label: 'Brush', value: 'light_scrub.mp3' },
  { label: 'Nocturne', value: 'low_piano.mp3' },
  { label: 'Amber (Marimba)', value: 'marinba.mp3' },
  { label: 'Aurora (Marimba)', value: 'marinbaeefge.mp3' },
  { label: 'Notification', value: 'notification.wav' },
  { label: 'Overdue Nudge', value: 'overdue_nudge.wav' },
  { label: 'Shamisen', value: 'shamisen.mp3' },
  { label: 'Harmony (Viola)', value: 'viola_solo_pizzicatoegabeb.mp3' },
  { label: 'Velvet (Viola)', value: 'viola_solo_pizzicatoegag.mp3' },
  { label: 'Spark (Violin)', value: 'violin_pizzicatobefe.mp3' },
  { label: 'Whisper (Viola)', value: 'violla_pizzicatoegf.mp3' },
  { label: 'Pluck', value: 'vpizzicato.mp3' },
  { label: 'Pebble (Xylo)', value: 'xelod.mp3' },
  { label: 'Cascade (Xylo)', value: 'xelodfs.mp3' },
  { label: 'Echo (Xylo)', value: 'xelof.mp3' },
  { label: 'Crystal (Xylo)', value: 'xylo.mp3' },
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

  const [prevValues, setPrevValues] = useState({});
  const wasOpenRef = useRef(false);

  const handleInputFocus = (key, currentValue) => {
    if (currentValue !== '') {
      setPrevValues(prev => ({ ...prev, [key]: currentValue }));
    }
  };

  const handleInputBlur = (key, currentValue, setter, defaultValue) => {
    if (currentValue === undefined || currentValue === null || String(currentValue).trim() === '') {
      const restored = prevValues[key] !== undefined && prevValues[key] !== '' ? prevValues[key] : defaultValue;
      setter(restored);
    }
  };

  const localizedSounds = predefinedSounds.map(s => ({ ...s, label: t(s.label) }));

  useEffect(() => {
    if (isSettingsOpen && !wasOpenRef.current) {
      const initTime = currentPomodoro.initialTime || 1500;
      const brkTime = currentPomodoro.breakInterval || 300;
      setWorkHrs(String(Math.floor(initTime / 3600)));
      setWorkMin(String(Math.floor((initTime % 3600) / 60)));
      setWorkSec(String(initTime % 60));
      setBreakHrs(String(Math.floor(brkTime / 3600)));
      setBreakMin(String(Math.floor((brkTime % 3600) / 60)));
      setBreakSec(String(brkTime % 60));
      setSessions(String(typeof currentPomodoro.intervalCount === 'object' ? (currentPomodoro.intervalCount.count || 5) : 5));
      setWorkSoundState(currentPomodoro.workSound || 'default');
      setBreakSoundState(currentPomodoro.breakSound || 'default');
      setPrevValues({});
    }
    wasOpenRef.current = isSettingsOpen;
  }, [isSettingsOpen]);

  const parseVal = (str, fallback) => {
    if (str === '' || str === null || str === undefined) return fallback;
    const parsed = parseInt(str, 10);
    return isNaN(parsed) || parsed < 0 ? fallback : parsed;
  };

  const handleSave = () => {
    const wHrs = parseVal(workHrs, prevValues.workHrs !== undefined ? parseVal(prevValues.workHrs, 0) : 0);
    const wMin = parseVal(workMin, prevValues.workMin !== undefined ? parseVal(prevValues.workMin, 25) : 25);
    const wSec = parseVal(workSec, prevValues.workSec !== undefined ? parseVal(prevValues.workSec, 0) : 0);
    const bHrs = parseVal(breakHrs, prevValues.breakHrs !== undefined ? parseVal(prevValues.breakHrs, 0) : 0);
    const bMin = parseVal(breakMin, prevValues.breakMin !== undefined ? parseVal(prevValues.breakMin, 5) : 5);
    const bSec = parseVal(breakSec, prevValues.breakSec !== undefined ? parseVal(prevValues.breakSec, 0) : 0);
    const sCount = parseVal(sessions, prevValues.sessions !== undefined ? parseVal(prevValues.sessions, 5) : 5);

    let workTime = wHrs * 3600 + wMin * 60 + wSec;
    if (workTime <= 0) workTime = 25 * 60;

    let breakTime = bHrs * 3600 + bMin * 60 + bSec;
    if (breakTime <= 0) breakTime = 5 * 60;

    const sessionCount = Math.max(1, Math.min(sCount, 10));

    dispatch(updatePomodoroSettings({
      workTime,
      breakTime,
      intervalCount: sessionCount,
      workSound,
      breakSound,
    }));

    dispatch(togglePomodoroSettings(false));
  };

  const handleResetToDefault = () => {
    dispatch(updatePomodoroSettings({
      workTime: 25 * 60,
      breakTime: 5 * 60,
      intervalCount: 5,
      workSound: 'default',
      breakSound: 'default',
    }));
    dispatch(togglePomodoroSettings(false));
  };



  return (
    <Modal
      isVisible={isSettingsOpen}
      animationIn="slideInUp"
      animationOut="slideOutDown"
      animationInTiming={220}
      animationOutTiming={180}
      backdropTransitionInTiming={220}
      backdropTransitionOutTiming={180}
      useNativeDriver={true}
      useNativeDriverForBackdrop={true}
      hideModalContentWhileAnimating={true}
      onSwipeComplete={() => dispatch(togglePomodoroSettings(false))}
      swipeDirection={['down']}
      onBackdropPress={() => dispatch(togglePomodoroSettings(false))}
      onBackButtonPress={() => dispatch(togglePomodoroSettings(false))}
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

          <View style={styles.settingRow}>
            <Text style={[styles.settingLabel, { color: colors.textPrimary }]}>{t('Work duration')}</Text>
            <View style={styles.timeInputsContainer}>
              <TextInput
                style={[styles.timeInput, { color: colors.textPrimary, backgroundColor: colors.surfaceContainer, borderColor: colors.surfaceContainerHigh }]}
                value={workHrs}
                onChangeText={setWorkHrs}
                onFocus={() => handleInputFocus('workHrs', workHrs, setWorkHrs)}
                onBlur={() => handleInputBlur('workHrs', workHrs, setWorkHrs, '0')}
                keyboardType="numeric"
                maxLength={2}
                selectTextOnFocus={true}
                placeholder=""
                placeholderTextColor={colors.textSecondary}
              />
              <Text style={[styles.timeColon, { color: colors.textSecondary }]}>:</Text>
              <TextInput
                style={[styles.timeInput, { color: colors.textPrimary, backgroundColor: colors.surfaceContainer, borderColor: colors.surfaceContainerHigh }]}
                value={workMin}
                onChangeText={setWorkMin}
                onFocus={() => handleInputFocus('workMin', workMin, setWorkMin)}
                onBlur={() => handleInputBlur('workMin', workMin, setWorkMin, '25')}
                keyboardType="numeric"
                maxLength={3}
                selectTextOnFocus={true}
                placeholder=""
                placeholderTextColor={colors.textSecondary}
              />
              <Text style={[styles.timeColon, { color: colors.textSecondary }]}>:</Text>
              <TextInput
                style={[styles.timeInput, { color: colors.textPrimary, backgroundColor: colors.surfaceContainer, borderColor: colors.surfaceContainerHigh }]}
                value={workSec}
                onChangeText={setWorkSec}
                onFocus={() => handleInputFocus('workSec', workSec, setWorkSec)}
                onBlur={() => handleInputBlur('workSec', workSec, setWorkSec, '0')}
                keyboardType="numeric"
                maxLength={2}
                selectTextOnFocus={true}
                placeholder=""
                placeholderTextColor={colors.textSecondary}
              />
            </View>
          </View>

          <View style={styles.settingRow}>
            <Text style={[styles.settingLabel, { color: colors.textPrimary }]}>{t('Break duration')}</Text>
            <View style={styles.timeInputsContainer}>
              <TextInput
                style={[styles.timeInput, { color: colors.textPrimary, backgroundColor: colors.surfaceContainer, borderColor: colors.surfaceContainerHigh }]}
                value={breakHrs}
                onChangeText={setBreakHrs}
                onFocus={() => handleInputFocus('breakHrs', breakHrs, setBreakHrs)}
                onBlur={() => handleInputBlur('breakHrs', breakHrs, setBreakHrs, '0')}
                keyboardType="numeric"
                maxLength={2}
                selectTextOnFocus={true}
                placeholder=""
                placeholderTextColor={colors.textSecondary}
              />
              <Text style={[styles.timeColon, { color: colors.textSecondary }]}>:</Text>
              <TextInput
                style={[styles.timeInput, { color: colors.textPrimary, backgroundColor: colors.surfaceContainer, borderColor: colors.surfaceContainerHigh }]}
                value={breakMin}
                onChangeText={setBreakMin}
                onFocus={() => handleInputFocus('breakMin', breakMin, setBreakMin)}
                onBlur={() => handleInputBlur('breakMin', breakMin, setBreakMin, '5')}
                keyboardType="numeric"
                maxLength={3}
                selectTextOnFocus={true}
                placeholder=""
                placeholderTextColor={colors.textSecondary}
              />
              <Text style={[styles.timeColon, { color: colors.textSecondary }]}>:</Text>
              <TextInput
                style={[styles.timeInput, { color: colors.textPrimary, backgroundColor: colors.surfaceContainer, borderColor: colors.surfaceContainerHigh }]}
                value={breakSec}
                onChangeText={setBreakSec}
                onFocus={() => handleInputFocus('breakSec', breakSec, setBreakSec)}
                onBlur={() => handleInputBlur('breakSec', breakSec, setBreakSec, '0')}
                keyboardType="numeric"
                maxLength={2}
                selectTextOnFocus={true}
                placeholder=""
                placeholderTextColor={colors.textSecondary}
              />
            </View>
          </View>

          <View style={styles.settingRow}>
            <Text style={[styles.settingLabel, { color: colors.textPrimary }]}>{t('Sessions (max 10)')}</Text>
            <TextInput
              style={[styles.sessionInput, { color: colors.textPrimary, backgroundColor: colors.surfaceContainer, borderColor: colors.surfaceContainerHigh }]}
              value={sessions}
              onChangeText={setSessions}
              onFocus={() => handleInputFocus('sessions', sessions, setSessions)}
              onBlur={() => handleInputBlur('sessions', sessions, setSessions, '5')}
              keyboardType="numeric"
              maxLength={2}
              selectTextOnFocus={true}
              placeholder=""
              placeholderTextColor={colors.textSecondary}
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
    padding: 20,
    paddingBottom: 35, // safe area padding
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
    marginBottom: 20,
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
    marginBottom: 16,
  },
  settingLabel: {
    fontSize: 15,
    fontWeight: '600',
    flex: 1,
    marginRight: 10,
  },
  timeInputsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  timeInput: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 6,
    paddingVertical: 8,
    fontSize: 15,
    width: 46,
    height: 40,
    textAlign: 'center',
  },
  timeColon: {
    fontSize: 16,
    fontWeight: 'bold',
    paddingHorizontal: 1,
  },
  sessionInput: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 8,
    fontSize: 15,
    width: 50,
    height: 40,
    textAlign: 'center',
  },
  saveBtn: {
    paddingVertical: 14,
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
