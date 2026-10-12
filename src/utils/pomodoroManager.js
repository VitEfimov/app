import React, { useEffect, useRef } from 'react';
import { Platform, AppState } from 'react-native';
import { useDispatch, useSelector } from 'react-redux';
import { Audio } from 'expo-av';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  startTimer,
  pauseTimer,
  resetTimer,
  tickTimer,
  completeWorkInterval,
  completeBreakInterval,
} from '../features/pomodoroSlice';
import {
  configurePomodoroChannel,
  schedulePomodoroAlarm,
  cancelPomodoroAlarm,
  scheduleLocalNotification,
} from './notifications';

export const SOUND_MAP = {
  'pisk.mp3': require('../../assets/audio/pisk.mp3'),
  'tucktuck.mp3': require('../../assets/audio/tucktuck.mp3'),
  'alarm_02.mp3': require('../../assets/audio/alarm_02.mp3'),
  'bass_alarm.mp3': require('../../assets/audio/bass_alarm.mp3'),
  'bell.mp3': require('../../assets/audio/bell.mp3'),
  'bell01.mp3': require('../../assets/audio/bell01.mp3'),
  'bonjo.mp3': require('../../assets/audio/bonjo.mp3'),
  'cellos_pizz.mp3': require('../../assets/audio/cellos_pizz.mp3'),
  'cellos_pizzdgg.mp3': require('../../assets/audio/cellos_pizzdgg.mp3'),
  'cellos_pizzedf.mp3': require('../../assets/audio/cellos_pizzedf.mp3'),
  'cellos_tremolo.mp3': require('../../assets/audio/cellos_tremolo.mp3'),
  'chime.wav': require('../../assets/audio/chime.wav'),
  'fireworks.mp3': require('../../assets/audio/fireworks.mp3'),
  'keys.mp3': require('../../assets/audio/keys.mp3'),
  'keys2.mp3': require('../../assets/audio/keys2.mp3'),
  'koto.mp3': require('../../assets/audio/koto.mp3'),
  'koto_notification.mp3': require('../../assets/audio/koto_notification.mp3'),
  'koto_shamisen.mp3': require('../../assets/audio/koto_shamisen.mp3'),
  'light_ping.mp3': require('../../assets/audio/light_ping.mp3'),
  'light_scrub.mp3': require('../../assets/audio/light_scrub.mp3'),
  'low_piano.mp3': require('../../assets/audio/low_piano.mp3'),
  'marinba.mp3': require('../../assets/audio/marinba.mp3'),
  'marinbaeefge.mp3': require('../../assets/audio/marinbaeefge.mp3'),
  'notification.wav': require('../../assets/audio/notification.wav'),
  'overdue_nudge.wav': require('../../assets/audio/overdue_nudge.wav'),
  'shamisen.mp3': require('../../assets/audio/shamisen.mp3'),
  'viola_solo_pizzicatoegabeb.mp3': require('../../assets/audio/viola_solo_pizzicatoegabeb.mp3'),
  'viola_solo_pizzicatoegag.mp3': require('../../assets/audio/viola_solo_pizzicatoegag.mp3'),
  'violin_pizzicatobefe.mp3': require('../../assets/audio/violin_pizzicatobefe.mp3'),
  'violla_pizzicatoegf.mp3': require('../../assets/audio/violla_pizzicatoegf.mp3'),
  'vpizzicato.mp3': require('../../assets/audio/vpizzicato.mp3'),
  'xelod.mp3': require('../../assets/audio/xelod.mp3'),
  'xelodfs.mp3': require('../../assets/audio/xelodfs.mp3'),
  'xelof.mp3': require('../../assets/audio/xelof.mp3'),
  'xylo.mp3': require('../../assets/audio/xylo.mp3'),
};

export const playAudio = async (soundKey) => {
  if (Platform.OS === 'android') return;
  if (!soundKey || soundKey === 'none') return;
  try {
    const soundModule = SOUND_MAP[soundKey];
    if (soundModule) {
      const { sound } = await Audio.Sound.createAsync(soundModule);
      await sound.playAsync();
    }
  } catch (e) {
    console.warn('Failed to play sound', e);
  }
};

export const startPomodoroSession = async (dispatch, pomodoro) => {
  if (!pomodoro) return;
  const timeInSec = typeof pomodoro.time === 'number' && pomodoro.time > 0
    ? pomodoro.time
    : (pomodoro.isBreak ? (pomodoro.breakInterval || 300) : (pomodoro.initialTime || 1500));

  const endTime = Date.now() + (timeInSec * 1000);
  dispatch(startTimer({ targetEndTime: endTime }));

  const soundKey = pomodoro.isBreak
    ? (pomodoro.breakSound || 'default')
    : (pomodoro.workSound || 'default');

  try {
    const channelId = await configurePomodoroChannel(soundKey, pomodoro.isBreak);
    if (channelId) {
      const title = pomodoro.isBreak ? 'Break time is over!' : 'Work session complete!';
      const body = pomodoro.isBreak ? 'Time to get back to work.' : 'Take a short break.';
      await schedulePomodoroAlarm('current', title, body, endTime, channelId);
    }
  } catch (err) {
    console.warn('Failed to schedule native pomodoro alarm:', err);
  }
};

export const pausePomodoroSession = async (dispatch) => {
  try {
    await cancelPomodoroAlarm('current');
  } catch (e) {}
  dispatch(pauseTimer());
};

export const resetPomodoroSession = async (dispatch) => {
  try {
    await cancelPomodoroAlarm('current');
  } catch (e) {}
  dispatch(resetTimer());
};

export const handlePomodoroPeriodEnd = async (dispatch, pomodoro) => {
  if (!pomodoro) return;
  try {
    await cancelPomodoroAlarm('current');
  } catch (e) {}

  const isBreak = !!pomodoro.isBreak;
  const title = isBreak ? 'Break time is over!' : 'Work session complete!';
  const body = isBreak ? 'Time to get back to work.' : 'Take a short break.';

  const soundKey = isBreak
    ? (pomodoro.breakSound || 'default')
    : (pomodoro.workSound || 'default');

  const shouldBeSilent = Platform.OS === 'android' || soundKey !== 'default';

  try {
    scheduleLocalNotification(title, body, 1, shouldBeSilent);
  } catch (e) {}

  if (Platform.OS !== 'android') {
    playAudio(soundKey);
  }

  const intervalCount = typeof pomodoro.intervalCount === 'object'
    ? (pomodoro.intervalCount.count || 5)
    : 5;
  const passed = typeof pomodoro.intervalCount === 'object'
    ? (pomodoro.intervalCount.passed || 0)
    : 0;

  if (isBreak) {
    dispatch(completeBreakInterval());
    if (passed + 1 >= intervalCount) {
      dispatch(resetTimer());
    }
  } else {
    dispatch(completeWorkInterval(pomodoro.initialTime || 25 * 60));
  }
};

/**
 * Global watcher component mounted in App root that keeps the timer running
 * continuously, even when navigating across different tabs, and immediately
 * recalculates and synchronizes state when returning from the background.
 */
export function PomodoroGlobalWatcher() {
  const dispatch = useDispatch();
  const pomodoro = useSelector(state => state.pomodoroReducer?.pomodoro?.[0]);
  const pomodoroRef = useRef(pomodoro);
  pomodoroRef.current = pomodoro;

  const appState = useRef(AppState.currentState);

  // Active foreground interval
  useEffect(() => {
    if (!pomodoro?.isActive || !pomodoro?.targetEndTime) {
      return;
    }

    const interval = setInterval(() => {
      const current = pomodoroRef.current;
      if (!current?.isActive || !current?.targetEndTime) {
        clearInterval(interval);
        return;
      }

      const remaining = Math.round((current.targetEndTime - Date.now()) / 1000);
      if (remaining <= 0) {
        clearInterval(interval);
        handlePomodoroPeriodEnd(dispatch, current);
      } else {
        dispatch(tickTimer(remaining));
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [pomodoro?.isActive, pomodoro?.targetEndTime, pomodoro?.isBreak, dispatch]);

  // AppState background/foreground synchronization
  useEffect(() => {
    const subscription = AppState.addEventListener('change', nextAppState => {
      const current = pomodoroRef.current;

      if (appState.current.match(/inactive|background/) && nextAppState === 'active') {
        // App just opened from background: immediately calculate actual remaining time
        if (current?.isActive && current?.targetEndTime) {
          const remaining = Math.round((current.targetEndTime - Date.now()) / 1000);
          if (remaining <= 0) {
            handlePomodoroPeriodEnd(dispatch, current);
          } else {
            dispatch(tickTimer(remaining));
          }
        }
      } else if (appState.current === 'active' && nextAppState.match(/inactive|background/)) {
        // App is minimizing: ensure current pomodoro state is persisted
        if (current) {
          AsyncStorage.setItem('pomodoro', JSON.stringify([current])).catch(() => {});
        }
      }
      appState.current = nextAppState;
    });

    return () => subscription.remove();
  }, [dispatch]);

  return null;
}
