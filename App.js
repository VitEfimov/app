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
import { hydrateStatsState } from './src/features/statsSlice';
import { hydrateEntitlementState } from './src/features/entitlementSlice';
import { fetchTasks } from './src/features/taskSlice';
import axios from 'axios';
import { Platform } from 'react-native';
import { registerForPushNotificationsAsync } from './src/utils/notifications';
import { registerBackgroundFetchAsync } from './src/utils/backgroundTasks';
import i18n from './src/i18n';
import PomodoroSettingsModal from './src/components/PomodoroSettingsModal';
import AutomaticCleanupModal from './src/components/AutomaticCleanupModal';
import { useShareIntent } from 'expo-share-intent';
import { addTask, updateTask, addMultipleTasks } from './src/features/taskSlice';
import * as Notifications from 'expo-notifications';
import { scheduleTaskReminder, scheduleExactTaskReminder, cancelNotification, getChannelId, attachNotificationDiagnostics } from './src/utils/notifications';
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
  const [pendingNotificationPayload, setPendingNotificationPayload] = useState(null);
  const { hasShareIntent, shareIntent, resetShareIntent } = useShareIntent();
  const themeReducer = useSelector(state => state.themeReducer);

  useEffect(() => {
    const isLocked = !!(themeReducer.appPin && !isUnlocked);
    if (!isLocked && pendingNotificationPayload) {
      let attempts = 0;
      const interval = setInterval(() => {
        attempts++;
        if (navigationRef.isReady()) {
          const { type, taskId, automationType, actionIdentifier } = pendingNotificationPayload;
          setPendingNotificationPayload(null);
          clearInterval(interval);

          if (type === 'task' && taskId) {
            if (actionIdentifier === Notifications.DEFAULT_ACTION_IDENTIFIER || actionIdentifier === 'reschedule') {
              navigationRef.navigate('Board', { editTaskId: taskId });
            }
          } else if (type === 'automation' || automationType) {
            const targetSection = automationType === 'summary' ? 'missed' : 'today';
            navigationRef.navigate('Board', { sectionId: targetSection });
          }
        } else if (attempts > 30) {
          clearInterval(interval);
        }
      }, 100);
      return () => clearInterval(interval);
    }
  }, [isUnlocked, themeReducer.appPin, pendingNotificationPayload]);

  useEffect(() => {
    const removeDiagnostics = attachNotificationDiagnostics();
    return removeDiagnostics;
  }, []);

  useEffect(() => {
    if (hasShareIntent && shareIntent && ready) {
      let taskname = '';
      let notes = [];
      let subtasks = [];
      let completionDate = dayjs().format('YYYY-MM-DD'); 
      let priority = 'none';
      let imgUri = '';
      let attachments = [];
      let taskTime = null;

      if (shareIntent.type === 'media' || shareIntent.type === 'file' || Array.isArray(shareIntent.value) || shareIntent.files) {
        // Shared file(s) or image(s)
        const files = Array.isArray(shareIntent.value) 
          ? shareIntent.value 
          : (shareIntent.files || (typeof shareIntent.value === 'object' && shareIntent.value ? [shareIntent.value] : []));
        
        for (let i = 0; i < files.length; i++) {
          const file = files[i];
          if (!file) continue;
          const uri = file.contentUri || file.path || file.uri || '';
          const isImg = file.mimeType?.startsWith('image/') || file.type?.startsWith('image/') || /\.(jpg|jpeg|png|gif|webp)$/i.test(file.path || file.fileName || uri);
          
          if (isImg) {
            if (!imgUri) imgUri = uri;
            attachments.push({
              id: `shared_img_${Date.now()}_${i}`,
              type: 'image',
              uri: uri,
              name: file.fileName || `Photo-${Date.now()}.jpg`,
              size: file.fileSize || file.size || 0,
              mimeType: file.mimeType || file.type || 'image/jpeg'
            });
          } else if (uri) {
            notes.push(`File: ${file.path || file.contentUri || uri}`);
          }
        }
      }

      const text = shareIntent.value || shareIntent.text || shareIntent.description || '';
      if (typeof text === 'string' && text.trim().length > 0) {
        const textLines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
        const structuredTasks = [];

        // Regex to match tabular or space-separated date entries:
        // e.g. "23\t01\t.1988\tЖена", "24\t08\t\tБабушка", "01\t24\t\tНаталья Лысенкова", "15/05/2024 Party"
        const lineRegex = /^(\d{1,2})[\s\t\.\/]+(\d{1,2})(?:[\s\t\.\/]+\.?(\d{2,4}))?[\s\t]+(.+)$/;

        for (let i = 0; i < textLines.length; i++) {
          const l = textLines[i];
          const m = l.match(lineRegex);
          if (m) {
            let p1 = parseInt(m[1], 10);
            let p2 = parseInt(m[2], 10);
            let yearStr = m[3];
            const title = m[4].trim();

            let day, month;
            if (p1 > 12 && p2 <= 12) {
              day = p1;
              month = p2;
            } else if (p2 > 12 && p1 <= 12) {
              day = p2;
              month = p1;
            } else {
              day = p1;
              month = p2;
            }

            let year = dayjs().year();
            if (yearStr) {
              let y = parseInt(yearStr, 10);
              if (y < 100) y += y > 50 ? 1900 : 2000;
              year = y;
            }

            const dObj = dayjs(`${year}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`);
            let dateFormatted = dObj.isValid() ? dObj.format('YYYY-MM-DD') : dayjs().format('YYYY-MM-DD');

            structuredTasks.push({
              id: (Date.now() + i).toString(),
              taskname: title.slice(0, 100),
              description: { text: '', img: '', url: '' },
              subtasks: [],
              completed: false,
              priority: 'none',
              completionDate: dayjs(dateFormatted).toISOString(),
              reminder: themeState?.defaultReminderEnabled ? (themeState?.defaultReminderTime || '09:00') : null
            });
          }
        }

        if (structuredTasks.length > 0) {
          dispatch(addMultipleTasks({ tasks: structuredTasks }));
          resetShareIntent();
          if (navigationRef.isReady()) {
            navigationRef.navigate('Board', { editTaskId: structuredTasks[0].id });
          }
          return;
        }

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

      if (!taskname && notes.length > 0) {
          taskname = notes.shift();
      }
      
      if (!taskname) {
          taskname = 'Shared Task';
      }

      const newTaskId = Date.now().toString();

      dispatch(addTask({
        task: {
          id: newTaskId,
          taskname: taskname.slice(0, 100), // Limit title length
          description: { text: notes.join('\n'), img: imgUri, attachments: attachments, url: '' },
          subtasks: subtasks,
          completed: false,
          priority: priority,
          completionDate: dayjs(completionDate).toISOString(),
          time: taskTime
        }
      }));
      resetShareIntent();

      if (navigationRef.isReady()) {
        navigationRef.navigate('Board', { editTaskId: newTaskId });
      } else {
        setPendingNotificationPayload({ type: 'task', taskId: newTaskId, actionIdentifier: Notifications.DEFAULT_ACTION_IDENTIFIER });
      }
    }
  }, [hasShareIntent, shareIntent, ready, dispatch, resetShareIntent]);

  useEffect(() => {
    const loadStorage = async () => {
      try {
        await registerBackgroundFetchAsync();
        const theme = await AsyncStorage.getItem('customTheme');
        if (theme) {
          let themeData = JSON.parse(theme);
          
          if (themeData.randomColorDaily) {
            const today = dayjs().format('YYYY-MM-DD');
            if (themeData.lastRandomColorDate !== today) {
              const PREDEFINED_COLORS = [
                '#C62828', '#AD1457', '#8E24AA', '#5E35B1', '#1E88E5',
                '#00897B', '#2E7D32', '#6B8E6B', '#C0CA33', '#F9A825', '#FB8C00', '#455A64'
              ];
              themeData.sourceColor = PREDEFINED_COLORS[Math.floor(Math.random() * PREDEFINED_COLORS.length)];
              themeData.lastRandomColorDate = today;
              await AsyncStorage.setItem('customTheme', JSON.stringify(themeData));
            }
          }
          
          dispatch(hydrateThemeState(themeData));
        }

        const boardsJson = await AsyncStorage.getItem('boards');
        if (boardsJson) dispatch(hydrateUserState({ boards: JSON.parse(boardsJson) }));

        const pomodoroJson = await AsyncStorage.getItem('pomodoro');
        if (pomodoroJson) dispatch(hydratePomodoroState(JSON.parse(pomodoroJson)));

        const appLanguage = await AsyncStorage.getItem('appLanguage');
        if (appLanguage) {
          i18n.changeLanguage(appLanguage);
        }

        const statsJson = await AsyncStorage.getItem('stats');
        if (statsJson) dispatch(hydrateStatsState(JSON.parse(statsJson)));

        const entitlementJson = await AsyncStorage.getItem('entitlement');
        if (entitlementJson) dispatch(hydrateEntitlementState(JSON.parse(entitlementJson)));

        // Load tasks from local storage
        await dispatch(fetchTasks()).unwrap();

        // Process any automatic task transfers / deletions based on settings
        const { processAutoManageTasks } = require('./src/features/taskSlice');
        await dispatch(processAutoManageTasks());

        const currentThemeState = store.getState().themeReducer;
        const currentTasks = store.getState().taskReducer.tasks;
        await registerForPushNotificationsAsync(currentThemeState);
        const { updateRecurringAutomations } = require('./src/utils/notifications');
        await updateRecurringAutomations(currentThemeState, currentTasks);
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
      const data = response.notification.request.content.data || {};
      const taskId = data.taskId;
      const isAutomation = data.isAutomation;
      const automationType = data.automationType;
      
      // Dismiss the notification from the system tray since Android doesn't always do this automatically for background actions
      if (response.notification?.request?.identifier && actionIdentifier !== Notifications.DEFAULT_ACTION_IDENTIFIER) {
        try {
          await Notifications.dismissNotificationAsync(response.notification.request.identifier);
        } catch (err) {
          console.warn("Failed to dismiss notification", err);
        }
      }

      const isLocked = !!(store.getState().themeReducer.appPin && !isUnlocked);

      if (isAutomation || automationType) {
        if (isLocked) {
          setPendingNotificationPayload({ type: 'automation', automationType, actionIdentifier });
        } else {
          const targetSection = automationType === 'summary' ? 'missed' : 'today';
          if (navigationRef.isReady()) {
            navigationRef.navigate('Board', { sectionId: targetSection });
          } else {
            setPendingNotificationPayload({ type: 'automation', automationType, actionIdentifier });
          }
        }
        return;
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
            if (isLocked) {
              setPendingNotificationPayload({ type: 'task', taskId, actionIdentifier });
            } else {
              if (navigationRef.isReady()) {
                navigationRef.navigate('Board', { editTaskId: taskId });
              } else {
                setPendingNotificationPayload({ type: 'task', taskId, actionIdentifier });
              }
            }
          } else if (actionIdentifier === 'complete_task') {
             dispatch(updateTask({ taskId, completed: true }));
          } else if (actionIdentifier === 'snooze') {
             const themeState = store.getState().themeReducer;
             const snoozeMins = themeState.defaultSnoozeTime || 30;

             const newTime = dayjs().add(snoozeMins, 'minute');
             
             // Schedule new reminder without changing the actual task's time
             const notifId = await scheduleExactTaskReminder(task.taskname, newTime.toDate(), task.id, task.isAlarm || false, 'task_reminder', themeState);
             if (notifId) {
               // Append the new snoozed notification ID so it can be cleaned up if task is deleted
               const updatedNotifIds = [...(task.notificationId || []), notifId];
               dispatch(updateTask({
                 taskId,
                 notificationId: updatedNotifIds
               }));

               const channelId = getChannelId(false, themeState.notificationSound, themeState.vibrationEnabled);

               await Notifications.scheduleNotificationAsync({
                 content: {
                   title: 'Task Snoozed',
                   body: `Snoozed '${task.taskname}' for ${snoozeMins} minute(s)`,
                   priority: Notifications.AndroidNotificationPriority.MAX,
                 },
                 trigger: Platform.OS === 'android' ? { channelId } : null,
               });
             }
          }
        }
      }
    });
    return () => subscription.remove();
  }, [dispatch, isUnlocked]);

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

  return (
    <>
      <AppNavigator />
      <AutomaticCleanupModal />
    </>
  );
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
import { ToastProvider } from './src/styles/ToastContext';

export default function App() {
  return (
    <ErrorBoundary>
      <Provider store={store}>
        <ThemeProvider>
          <ToastProvider>
            <RootWrapper>
              <GestureHandlerRootView style={{ flex: 1, backgroundColor: 'transparent' }}>
                <SafeAreaProvider>
                  <InitApp />
                </SafeAreaProvider>
              </GestureHandlerRootView>
            </RootWrapper>
          </ToastProvider>
        </ThemeProvider>
      </Provider>
    </ErrorBoundary>
  );
}
