import 'react-native-gesture-handler';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import React, { useEffect, useState } from 'react';
import './src/i18n';
import { Provider, useDispatch } from 'react-redux';
import AsyncStorage from '@react-native-async-storage/async-storage';
import store from './src/store';
import AppNavigator from './src/navigation/AppNavigator';
import { View, Text, ActivityIndicator, TouchableOpacity } from 'react-native';

import { hydrateUserState } from './src/features/userSlice';
import { hydrateThemeState } from './src/features/themeSlice';
import { hydratePomodoroState } from './src/features/pomodoroSlice';
import { fetchTasks } from './src/features/taskSlice';
import axios from 'axios';
import { Platform } from 'react-native';
import { registerForPushNotificationsAsync } from './src/utils/notifications';
import i18n from './src/i18n';
import PomodoroSettingsModal from './src/components/PomodoroSettingsModal';
import { useShareIntent } from 'expo-share-intent';
import { addTask, updateTask } from './src/features/taskSlice';
import * as Notifications from 'expo-notifications';
import { scheduleTaskReminder, scheduleExactTaskReminder, cancelNotification } from './src/utils/notifications';
import dayjs from 'dayjs';

// Polyfill for Hermes / Reanimated warnings
if (typeof structuredClone === 'undefined') {
  global.structuredClone = function(obj) {
    return JSON.parse(JSON.stringify(obj));
  };
}
if (typeof queueMicrotask === 'undefined') {
  global.queueMicrotask = function(callback) {
    Promise.resolve().then(callback);
  };
}

// Configure Axios for remote Vercel backend
// axios.defaults.baseURL = 'https://task-manager-v2-indol.vercel.app';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error("ErrorBoundary caught an error:", error, errorInfo);
    this.setState({ errorInfo });
  }

  render() {
    if (this.state.hasError) {
      return (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 }}>
          <Text style={{ fontSize: 20, fontWeight: 'bold', marginBottom: 10, color: 'red' }}>Oops! Something went wrong.</Text>
          <Text style={{ textAlign: 'center', color: '#333', marginBottom: 10 }}>{this.state.error?.toString()}</Text>
          <Text style={{ fontSize: 10, color: '#666', marginBottom: 20, textAlign: 'left' }}>
            {this.state.errorInfo?.componentStack || 'No component stack available'}
          </Text>
          <TouchableOpacity 
            onPress={() => this.setState({ hasError: false, error: null, errorInfo: null })} 
            style={{ padding: 12, backgroundColor: '#2196f3', borderRadius: 8 }}
          >
            <Text style={{ color: 'white', fontWeight: 'bold' }}>Try Again</Text>
          </TouchableOpacity>
        </View>
      );
    }
    return this.props.children;
  }
}

function InitApp() {
  const dispatch = useDispatch();
  const [ready, setReady] = useState(false);
  const { hasShareIntent, shareIntent, resetShareIntent } = useShareIntent();

  useEffect(() => {
    if (hasShareIntent && shareIntent.value && ready) {
      const text = shareIntent.value;
      let taskname = '';
      let notes = [];
      let subtasks = [];
      let completionDate = dayjs().toISOString(); 
      let priority = 'none';

      const lines = text.split('\n');
      let hasFoundSubtasks = false;
      let firstLineFound = false;

      for (let line of lines) {
          let trimmed = line.trim();
          if (!trimmed) continue;
          
          const priorityMatch = trimmed.match(/Priority:\s*(low|medium|high)/i);
          if (priorityMatch) {
              priority = priorityMatch[1].toLowerCase();
              trimmed = trimmed.replace(priorityMatch[0], '').trim();
              if (!trimmed) continue;
          }

          const dateMatch = trimmed.match(/(?:Due|date\(due\)|Date):\s*([A-Za-z]+\s+\d{1,2},?\s+\d{4}|\d{4}-\d{2}-\d{2}|\d{1,2}\/\d{1,2}\/\d{2,4}|Today|Tomorrow)/i);
          if (dateMatch) {
              const dateStr = dateMatch[1];
              if (dateStr.toLowerCase() === 'today') {
                  completionDate = dayjs().toISOString();
              } else if (dateStr.toLowerCase() === 'tomorrow') {
                  completionDate = dayjs().add(1, 'day').toISOString();
              } else {
                  const parsedDate = dayjs(dateStr);
                  if (parsedDate.isValid()) {
                      completionDate = parsedDate.toISOString();
                  }
              }
              trimmed = trimmed.replace(dateMatch[0], '').trim();
              if (!trimmed) continue;
          }

          const subtaskMatch = trimmed.match(/^(\[ \]|\[x\]|-|\*|\d+\.)\s+(.+)/i);
          if (subtaskMatch) {
              hasFoundSubtasks = true;
              subtasks.push({
                  id: Date.now().toString() + Math.random().toString(),
                  text: subtaskMatch[2].trim(),
                  completed: subtaskMatch[1].toLowerCase() === '[x]'
              });
              continue;
          }

          if (!firstLineFound && !hasFoundSubtasks) {
              taskname = trimmed;
              firstLineFound = true;
          } else {
              notes.push(trimmed);
          }
      }

      if (!taskname && notes.length > 0) {
          taskname = notes.shift();
      }

      dispatch(addTask({
        task: {
          id: Date.now().toString(),
          taskname: taskname.slice(0, 100), // Limit title length
          description: { text: notes.join('\n'), img: '', url: '' },
          subtasks: subtasks,
          completed: false,
          priority: priority,
          completionDate: completionDate
        }
      }));
      resetShareIntent();
    }
  }, [hasShareIntent, shareIntent, ready]);

  useEffect(() => {
    const loadStorage = async () => {
      try {
        const theme = await AsyncStorage.getItem('customTheme');
        if (theme) dispatch(hydrateThemeState(JSON.parse(theme)));

        const boardsJson = await AsyncStorage.getItem('boards');
        if (boardsJson) dispatch(hydrateUserState({ boards: JSON.parse(boardsJson) }));

        const pomodoroJson = await AsyncStorage.getItem('pomodoro');
        if (pomodoroJson) dispatch(hydratePomodoroState(JSON.parse(pomodoroJson)));

        const appLanguage = await AsyncStorage.getItem('appLanguage');
        if (appLanguage) {
          i18n.changeLanguage(appLanguage);
        }

        // Load tasks from local storage
        await dispatch(fetchTasks()).unwrap();

        await registerForPushNotificationsAsync();
      } catch (e) {
        console.error(e);
      } finally {
        setReady(true);
      }
    };
    loadStorage();
  }, [dispatch]);

  useEffect(() => {
    const subscription = Notifications.addNotificationResponseReceivedListener(async response => {
      const actionIdentifier = response.actionIdentifier;
      const taskId = response.notification.request.content.data?.taskId;
      
      if (taskId && actionIdentifier.startsWith('snooze_')) {
        const tasks = store.getState().taskReducer.tasks;
        const task = tasks.find(t => t.id === taskId);
        
        if (task) {
          if (task.notificationId) {
            await cancelNotification(task.notificationId);
          }

          const snoozeMap = {
            snooze_30_min: { value: 30, unit: 'minute' },
            snooze_1_hr: { value: 1, unit: 'hour' },
            snooze_1_day: { value: 1, unit: 'day' },
          };

          const snooze = snoozeMap[actionIdentifier];
          if (!snooze) return;

          const newTime = dayjs().add(snooze.value, snooze.unit);
          
          const notifId = await scheduleExactTaskReminder(task.taskname, newTime.toDate(), task.id, task.isAlarm || false);
          
          if (notifId) {
            dispatch(updateTask({
              taskId,
              notificationId: notifId
            }));
          }
        }
      }
    });
    return () => subscription.remove();
  }, [dispatch]);

  if (!ready) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return <AppNavigator />;
}

function RootWrapper({ children }) {
  const { colors } = useTheme();
  return (
    <View style={{ flex: 1, backgroundColor: colors.bgMain }}>
      {children}
      <PomodoroSettingsModal />
    </View>
  );
}

import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ThemeProvider, useTheme } from './src/styles/ThemeContext';

export default function App() {
  return (
    <ErrorBoundary>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <SafeAreaProvider>
          <Provider store={store}>
            <ThemeProvider>
              <RootWrapper>
                <InitApp />
              </RootWrapper>
            </ThemeProvider>
          </Provider>
        </SafeAreaProvider>
      </GestureHandlerRootView>
    </ErrorBoundary>
  );
}
