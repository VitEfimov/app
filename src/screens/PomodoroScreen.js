import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, AppState } from 'react-native';
import { useSelector, useDispatch } from 'react-redux';
import { useTheme } from '../styles/ThemeContext';
import { useKeepAwake } from 'expo-keep-awake';
import { Audio } from 'expo-av';
import Svg, { Circle, Path, Polyline, Line } from 'react-native-svg';
import {
  startTimer,
  pauseTimer,
  resetTimer,
  updateTime,
  completeWorkInterval,
  completeBreakInterval,
  togglePomodoroSettings
} from '../features/pomodoroSlice';
import { scheduleLocalNotification } from '../utils/notifications';
import { useTranslation } from 'react-i18next';

// Icons
const IconPlay = ({ color }) => (
  <Svg width="24" height="24" viewBox="0 0 24 24" fill={color} stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <Polygon points="5 3 19 12 5 21 5 3" />
  </Svg>
);
// wait Polygon isn't imported from react-native-svg above. I should import Polygon or use Path.
const IconPlayPath = ({ color }) => (
  <Svg width="24" height="24" viewBox="0 0 24 24" fill={color} stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <Path d="M5 3l14 9-14 9z" />
  </Svg>
);

const IconPause = ({ color }) => (
  <Svg width="24" height="24" viewBox="0 0 24 24" fill={color} stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <Path d="M6 4h4v16H6zM14 4h4v16h-4z" />
  </Svg>
);

const IconReset = ({ color }) => (
  <Svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <Path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
    <Path d="M3 3v5h5" />
  </Svg>
);

const IconSettings = ({ color }) => (
  <Svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <Circle cx="12" cy="12" r="3" />
    <Path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
  </Svg>
);

const SOUND_MAP = {
  'chime.wav': require('../../assets/audio/chime.wav'),
  'light_ping.wav': require('../../assets/audio/light_ping.wav'),
  'notification.wav': require('../../assets/audio/notification.wav'),
  'end_sound.ogg': require('../../assets/audio/end_sound.ogg'),
  'start_sound.mp3': require('../../assets/audio/start_sound.mp3')
};

export default function PomodoroScreen() {
  const dispatch = useDispatch();
  const { colors } = useTheme();
  const { t } = useTranslation();
  useKeepAwake(); // Keep screen awake during pomodoro

  const pomodoro = useSelector(state => state.pomodoroReducer.pomodoro[0]);
  
  const [localTime, setLocalTime] = useState(pomodoro.time);
  const [localIsActive, setLocalIsActive] = useState(false);
  const [localIsBreak, setLocalIsBreak] = useState(pomodoro.isBreak);
  
  const initialIntervalCount = typeof pomodoro.intervalCount === 'object' ? pomodoro.intervalCount.count : 5;
  const initialPassed = typeof pomodoro.intervalCount === 'object' ? pomodoro.intervalCount.passed : 0;
  
  const [localCompletedIntervals, setLocalCompletedIntervals] = useState(initialPassed);

  const staticIntervalCountRef = useRef(initialIntervalCount);
  const intervalRef = useRef(null);
  const targetEndTimeRef = useRef(null);

  // Determine sounds
  const workSoundKey = pomodoro.workSound && pomodoro.workSound !== 'default' && pomodoro.workSound !== 'none' 
    ? pomodoro.workSound : 'end_sound.ogg';
  const breakSoundKey = pomodoro.breakSound && pomodoro.breakSound !== 'default' && pomodoro.breakSound !== 'none'
    ? pomodoro.breakSound : 'start_sound.mp3';

  const appState = useRef(AppState.currentState);
  const notificationIdRef = useRef(null);

  useEffect(() => {
    setLocalTime(pomodoro.time);
    setLocalIsBreak(pomodoro.isBreak);
    setLocalCompletedIntervals(
      typeof pomodoro.intervalCount === 'object' ? pomodoro.intervalCount.passed : 0
    );
  }, [pomodoro]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', nextAppState => {
      if (appState.current.match(/inactive|background/) && nextAppState === 'active') {
        if (localIsActive && targetEndTimeRef.current) {
          const remainingMs = targetEndTimeRef.current - Date.now();
          const newTime = Math.round(remainingMs / 1000);
          
          if (newTime <= 0) {
            handlePauseTimer();
            handlePeriodEnd();
          } else {
            setLocalTime(newTime);
          }
        }
      }
      appState.current = nextAppState;
    });
    return () => {
      subscription.remove();
    };
  }, [localIsActive]);

  const playAudio = async (soundKey) => {
    if (soundKey === 'none') return;
    try {
      const soundModule = SOUND_MAP[soundKey];
      if (soundModule) {
        const { sound } = await Audio.Sound.createAsync(soundModule);
        await sound.playAsync();
        // optionally unload sound after playing, but expo-av handles it fine for small clips
      }
    } catch (e) {
      console.warn("Failed to play sound", e);
    }
  };

  const handlePeriodEnd = () => {
    if (localIsBreak) {
      dispatch(completeBreakInterval());
      playAudio(breakSoundKey);

      if (localCompletedIntervals + 1 >= staticIntervalCountRef.current) {
        dispatch(resetTimer());
      }
    } else {
      dispatch(completeWorkInterval());
      playAudio(workSoundKey);
    }
  };

  const handleStartTimer = async () => {
    if (localIsActive) return;
    
    setLocalIsActive(true);
    dispatch(startTimer());
    
    const endTime = Date.now() + (localTime * 1000);
    targetEndTimeRef.current = endTime;

    // Schedule the notification to fire exactly when the timer ends
    // This ensures it works even if the app goes to sleep or device locks
    const title = localIsBreak ? 'Break time is over!' : 'Work session complete!';
    const body = localIsBreak ? 'Time to get back to work.' : 'Take a short break.';
    const triggerDate = new Date(endTime);
    
    import('../utils/notifications').then(({ scheduleLocalNotification }) => {
      scheduleLocalNotification(title, body, triggerDate).then(id => {
        notificationIdRef.current = id;
      });
    });

    intervalRef.current = setInterval(() => {
      const remainingMs = targetEndTimeRef.current - Date.now();
      const newTime = Math.round(remainingMs / 1000);

      if (newTime <= 0) {
        clearInterval(intervalRef.current);
        setLocalIsActive(false);
        dispatch(pauseTimer());
        handlePeriodEnd();
      } else {
        setLocalTime(newTime);
        dispatch(updateTime(newTime));
      }
    }, 1000);
  };

  const handlePauseTimer = () => {
    clearInterval(intervalRef.current);
    setLocalIsActive(false);
    targetEndTimeRef.current = null;
    dispatch(pauseTimer());
    
    import('../utils/notifications').then(({ cancelNotification }) => {
      if (notificationIdRef.current) {
        cancelNotification(notificationIdRef.current);
        notificationIdRef.current = null;
      }
    });
  };

  const handleResetTimer = () => {
    clearInterval(intervalRef.current);
    setLocalIsActive(false);
    setLocalIsBreak(false);
    setLocalCompletedIntervals(0);
    targetEndTimeRef.current = null;
    dispatch(resetTimer());

    import('../utils/notifications').then(({ cancelNotification }) => {
      if (notificationIdRef.current) {
        cancelNotification(notificationIdRef.current);
        notificationIdRef.current = null;
      }
    });
  };

  const formatTime = (timeInSeconds) => {
    const hours = Math.floor(timeInSeconds / 3600);
    const minutes = Math.floor((timeInSeconds % 3600) / 60);
    const seconds = timeInSeconds % 60;
    return {
      hrs: hours > 0 ? String(hours) : null,
      min: String(minutes).padStart(2, '0'),
      sec: String(seconds).padStart(2, '0')
    };
  };

  const currentFill = Math.max(0, Math.min(100, 100 - (localTime / (localIsBreak ? pomodoro.breakInterval : pomodoro.initialTime)) * 100));
  const circumference = 283; // 2 * pi * r (where r = 45)
  const strokeDashoffset = circumference - (circumference * currentFill) / 100;
  
  const intervalCount = staticIntervalCountRef.current;
  const timerColor = colors.primary;

  return (
    <View style={[styles.container, { backgroundColor: colors.bgMain }]}>
      
      <View style={styles.header}>
        <View style={{ flex: 1, marginRight: 10 }}>
          <Text style={[styles.title, { color: colors.textPrimary }]} numberOfLines={1} adjustsFontSizeToFit>{t('Pomodoro')}</Text>
          <Text style={[styles.subtitle, { color: colors.textSecondary }]}>{t('Stay focused, take breaks')}</Text>
        </View>
        <TouchableOpacity 
          style={[styles.settingsBtn, { backgroundColor: colors.surfaceContainer }]}
          onPress={() => dispatch(togglePomodoroSettings(true))}
        >
          <IconSettings color={colors.textPrimary} />
          <Text style={[styles.settingsText, { color: colors.textPrimary }]} numberOfLines={1} adjustsFontSizeToFit>{t('Settings')}</Text>
        </TouchableOpacity>
      </View>

      <View style={[styles.timerCard, { backgroundColor: colors.bgCard }]}>
        
        {/* Work / Break Toggle */}
        <View style={styles.toggleContainer}>
          <View style={[styles.toggleBtn, !localIsBreak ? styles.toggleBtnActive : null]}>
            <Text style={[styles.toggleText, !localIsBreak && { color: colors.primary }]}>{t('Work Time')}</Text>
          </View>
          <View style={[styles.toggleBtn, localIsBreak ? styles.toggleBtnActive : null]}>
            <Text style={[styles.toggleText, localIsBreak && { color: colors.primary }]}>{t('Break Time')}</Text>
          </View>
        </View>

        {/* Circular Timer */}
        <View style={styles.circleTimer}>
          <Svg viewBox="0 0 100 100" width="220" height="220">
            <Circle cx="50" cy="50" r="45" stroke={colors.surfaceContainerHigh} strokeWidth="5" fill="none" />
            <Circle 
              cx="50" cy="50" r="45" 
              stroke={timerColor} 
              strokeWidth="5" 
              fill="none" 
              strokeDasharray={circumference}
              strokeDashoffset={strokeDashoffset}
              strokeLinecap="round"
              transform="rotate(-90 50 50)"
            />
          </Svg>
          <View style={styles.circleTextContainer}>
            <Text style={[styles.timeText, { color: colors.textPrimary }, formatTime(localTime).hrs && { fontSize: 48 }]}>
              {formatTime(localTime).hrs ? `${formatTime(localTime).hrs}:` : ''}{formatTime(localTime).min}:{formatTime(localTime).sec}
            </Text>
            <Text style={[styles.sessionLabel, { color: colors.textSecondary }]}>
              {localIsBreak ? t('Break session') : t('Work session')}
            </Text>
          </View>
        </View>

        {/* Controls */}
        <View style={styles.controls}>
          <TouchableOpacity 
            style={[styles.playPauseBtn, { backgroundColor: timerColor }]}
            onPress={localIsActive ? handlePauseTimer : handleStartTimer}
          >
            {localIsActive ? <IconPause color="#fff" /> : <IconPlayPath color="#fff" />}
          </TouchableOpacity>
          <TouchableOpacity 
            style={[styles.resetBtn, { backgroundColor: colors.surfaceContainerHigh }]}
            onPress={handleResetTimer}
          >
            <IconReset color={colors.textPrimary} />
          </TouchableOpacity>
        </View>

        {/* Dots */}
        <View style={styles.dotsContainer}>
          <View style={styles.dots}>
            {[...Array(intervalCount)].map((_, index) => {
              const isCompleted = index < localCompletedIntervals;
              const isCurrent = index === localCompletedIntervals && !localIsBreak;
              const dotColor = isCompleted || isCurrent ? timerColor : colors.surfaceContainerHigh;
              return (
                <View key={index} style={[styles.dot, { backgroundColor: dotColor }]} />
              );
            })}
          </View>
          <Text style={[styles.intervalsText, { color: colors.textSecondary }]}>
            {Math.min(localCompletedIntervals + 1, intervalCount)} / {intervalCount} {t('sessions completed')}
          </Text>
        </View>

      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
  },
  subtitle: {
    fontSize: 14,
    marginTop: 5,
  },
  settingsBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 8,
    gap: 4,
    flexShrink: 1,
  },
  settingsText: {
    fontSize: 14,
    fontWeight: '600',
  },
  timerCard: {
    alignItems: 'center',
    padding: 20,
    borderRadius: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 3,
  },
  toggleContainer: {
    flexDirection: 'row',
    backgroundColor: 'rgba(0,0,0,0.05)',
    borderRadius: 25,
    padding: 5,
    marginBottom: 20,
  },
  toggleBtn: {
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 20,
  },
  toggleBtnActive: {
    backgroundColor: 'transparent', // removed background to fix android border bug
  },
  toggleText: {
    fontWeight: 'bold',
    color: '#888',
  },
  circleTimer: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  circleTextContainer: {
    position: 'absolute',
    alignItems: 'center',
  },
  timeText: {
    fontSize: 64,
    fontWeight: 'bold',
    fontVariant: ['tabular-nums'],
  },
  sessionLabel: {
    fontSize: 16,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginTop: 5,
  },
  controls: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 25,
    gap: 20,
  },
  playPauseBtn: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 5,
  },
  resetBtn: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dotsContainer: {
    marginTop: 25,
    alignItems: 'center',
  },
  dots: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 10,
  },
  dot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  intervalsText: {
    fontSize: 14,
  }
});
