import 'react-native-gesture-handler';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import React, { useEffect, useState } from 'react';
import './src/i18n';
import { Provider, useDispatch, useSelector } from 'react-redux';
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
import { scheduleTaskReminder, scheduleExactTaskReminder, cancelNotification, DEFAULT_APP_CHANNEL } from './src/utils/notifications';
import dayjs from 'dayjs';
import { navigationRef } from './src/navigation/AppNavigator';
import PinLockScreen from './src/screens/PinLockScreen';

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
  const [isUnlocked, setIsUnlocked] = useState(false);
  const { hasShareIntent, shareIntent, resetShareIntent } = useShareIntent();
  const themeReducer = useSelector(state => state.themeReducer);

  useEffect(() => {
    if (hasShareIntent && shareIntent && ready) {
      let taskname = '';
      let notes = [];
      let subtasks = [];
      let completionDate = dayjs().format('YYYY-MM-DD'); 
      let priority = 'none';
      let imgUri = '';
      let taskTime = null;

      if (shareIntent.type === 'media' || shareIntent.type === 'file' || Array.isArray(shareIntent.value)) {
        // Shared a file/image
        const files = Array.isArray(shareIntent.value) ? shareIntent.value : [shareIntent.value];
        if (files.length > 0) {
          const file = files[0];
          taskname = file.fileName || 'Shared File';
          if (file.mimeType?.startsWith('image/')) {
            imgUri = file.contentUri || file.path || '';
          } else {
            notes.push(`File: ${file.path || file.contentUri}`);
          }
        }
      } else {
        const text = shareIntent.value || shareIntent.text || shareIntent.description || '';
        if (typeof text === 'string' && text.trim().length > 0) {
          const lines = text.split('\n');
          let hasFoundSubtasks = false;
          let remainingLines = [];

          for (let line of lines) {
              let trimmed = line.trim();
              if (!trimmed) continue;
              
              const priorityMatch = trimmed.match(/Priority:\s*(low|medium|high)/i);
              if (priorityMatch) {
                  priority = priorityMatch[1].toLowerCase();
                  trimmed = trimmed.replace(priorityMatch[0], '').trim();
                  if (!trimmed) continue;
              }

              const dRegex = /\b(today|tomorrow|\d{4}-\d{2}-\d{2}|\d{1,2}\/\d{1,2}\/\d{2,4}|(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\s+\d{1,2}(?:st|nd|rd|th)?(?:,?\s+\d{4})?)\b/i;
              const tRegex = /\b(\d{1,2}:\d{2}(?:\s*[aA][pP][mM])?|\d{1,2}\s*[aA][pP][mM])\b/i;
              const keywordRegex = /\b(due time|due|deadline at|deadline|date\(due\)|date)\b/i;
              
              if (keywordRegex.test(trimmed)) {
                  let foundAny = false;
                  
                  const dMatch = trimmed.match(dRegex);
                  if (dMatch) {
                      const dateStr = dMatch[1];
                      if (dateStr.toLowerCase() === 'today') {
                          completionDate = dayjs().format('YYYY-MM-DD');
                      } else if (dateStr.toLowerCase() === 'tomorrow') {
                          completionDate = dayjs().add(1, 'day').format('YYYY-MM-DD');
                      } else {
                          let cleanDateStr = dateStr.replace(/(\d+)(st|nd|rd|th)/, '$1');
                          if (/[a-z]+\s+\d{1,2}$/i.test(cleanDateStr)) {
                              cleanDateStr += `, ${dayjs().year()}`;
                          }
                          const parsedDate = dayjs(cleanDateStr);
                          if (parsedDate.isValid()) {
                              completionDate = parsedDate.format('YYYY-MM-DD');
                          }
                      }
                      trimmed = trimmed.replace(dMatch[0], '');
                      foundAny = true;
                  }
                  
                  const tMatch = trimmed.match(tRegex);
                  if (tMatch) {
                      const timeStr = tMatch[1];
                      let t = timeStr.trim();
                      const pm = /pm/i.test(t);
                      const am = /am/i.test(t);
                      t = t.replace(/[aA][pP][mM]/i, '').trim();
                      
                      let [h, m] = t.split(':');
                      h = parseInt(h, 10);
                      m = m ? parseInt(m, 10) : 0;
                      
                      if (pm && h < 12) h += 12;
                      if (am && h === 12) h = 0;
                      
                      taskTime = `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
                      trimmed = trimmed.replace(tMatch[0], '');
                      foundAny = true;
                  }
                  
                  if (foundAny) {
                      trimmed = trimmed.replace(keywordRegex, '').replace(/\bat\b/i, '').replace(/:\s*$/, '').replace(/^\s*:\s*/, '').trim();
                  }
                  
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

              if (!hasFoundSubtasks) {
                  remainingLines.push(trimmed);
              } else {
                  notes.push(trimmed);
              }
          }

          let preText = remainingLines.join('\n');
          let extraNotes = [];

          if (preText) {
              const words = preText.split(/\s+/);
              if (words.length > 5) {
                  taskname = words.slice(0, 5).join(' ') + '...';
                  let wordCount = 0;
                  let splitIndex = 0;
                  let inWord = false;
                  for (let i = 0; i < preText.length; i++) {
                      if (/\s/.test(preText[i])) {
                          inWord = false;
                      } else {
                          if (!inWord) {
                              wordCount++;
                              inWord = true;
                          }
                      }
                      if (wordCount === 6) {
                          splitIndex = i;
                          break;
                      }
                  }
                  if (splitIndex > 0) {
                      extraNotes.push(preText.substring(splitIndex).trim());
                  } else {
                      extraNotes.push(words.slice(5).join(' '));
                  }
              } else {
                  taskname = preText;
              }
          }

          notes = [...extraNotes, ...notes];
        }
      }

      if (!taskname && notes.length > 0) {
          taskname = notes.shift();
      }
      
      if (!taskname) {
          taskname = 'Shared Task';
      }

      dispatch(addTask({
        task: {
          id: Date.now().toString(),
          taskname: taskname.slice(0, 100), // Limit title length
          description: { text: notes.join('\n'), img: imgUri, url: '' },
          subtasks: subtasks,
          completed: false,
          priority: priority,
          completionDate: dayjs(completionDate).toISOString(),
          time: taskTime
        }
      }));
      resetShareIntent();
    }
  }, [hasShareIntent, shareIntent, ready, dispatch, resetShareIntent]);

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

        // Process any automatic task transfers / deletions based on settings
        const { processAutoManageTasks } = require('./src/features/taskSlice');
        await dispatch(processAutoManageTasks());

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
      
      // Dismiss the notification from the system tray since Android doesn't always do this automatically for background actions
      if (response.notification?.request?.identifier) {
        await Notifications.dismissNotificationAsync(response.notification.request.identifier);
      }

      if (taskId) {
        let tasks = store.getState().taskReducer.tasks;
        let task = tasks.find(t => t.id === taskId);
        
        if (!task) {
          const tasksJson = await AsyncStorage.getItem('tasks');
          if (tasksJson) {
            const parsedTasks = JSON.parse(tasksJson);
            task = parsedTasks.find(t => t.id === taskId);
          }
        }
        
        if (task) {
          if (actionIdentifier === Notifications.DEFAULT_ACTION_IDENTIFIER || actionIdentifier === 'reschedule') {
            if (navigationRef.isReady()) {
              navigationRef.navigate('Board', { editTaskId: taskId });
            }
          } else if (actionIdentifier === 'complete_task') {
             dispatch(updateTask({ taskId, completed: true }));
          } else if (actionIdentifier === 'snooze') {
             const themeState = store.getState().themeReducer;
             const snoozeMins = themeState.defaultSnoozeTime || 30;

             const newTime = dayjs().add(snoozeMins, 'minute');
             
             // Schedule new reminder without changing the actual task's time
             const notifId = await scheduleExactTaskReminder(task.taskname, newTime.toDate(), task.id, task.isAlarm || false, 'task_reminder');
             if (notifId) {
               // Append the new snoozed notification ID so it can be cleaned up if task is deleted
               const updatedNotifIds = [...(task.notificationId || []), notifId];
               dispatch(updateTask({
                 taskId,
                 notificationId: updatedNotifIds
               }));

               await Notifications.scheduleNotificationAsync({
                 content: {
                   title: 'Task Snoozed',
                   body: `Snoozed '${task.taskname}' for ${snoozeMins} minute(s)`,
                   priority: Notifications.AndroidNotificationPriority.MAX,
                 },
                 trigger: Platform.OS === 'android' ? { channelId: DEFAULT_APP_CHANNEL } : null,
               });
             }
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

  if (themeReducer.appPin && !isUnlocked) {
    return <PinLockScreen correctPin={themeReducer.appPin} onUnlock={() => setIsUnlocked(true)} />;
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
