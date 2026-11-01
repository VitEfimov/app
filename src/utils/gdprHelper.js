import { Platform, Share } from 'react-native';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import * as Notifications from 'expo-notifications';
import dayjs from 'dayjs';
import { CryptoStorage } from './cryptoStorage';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { clearTasks } from '../features/taskSlice';
import { resetTheme } from '../features/themeSlice';
import { logout } from '../features/userSlice';
import { cancelAlarm } from '../../modules/expo-task-alarm';

/**
 * GDPR (Art. 17 & Art. 20) and CCPA Privacy Compliance Helper
 * 
 * Provides:
 * 1. Data Portability: Full JSON & CSV user data export
 * 2. Right to Erasure: Complete, permanent data & alarm wiping
 * 3. Privacy Policy metadata & structured disclosures
 */

/**
 * Escape CSV field according to RFC 4180
 */
function escapeCsv(field) {
  if (field === null || field === undefined) return '""';
  const str = String(field).replace(/"/g, '""');
  return `"${str}"`;
}

/**
 * Export full user dataset as JSON (GDPR Art. 20 Data Portability)
 */
export async function exportDataAsJsonAsync({ tasks = [], boards = [], stats = {}, pomodoro = {}, theme = {}, user = {} } = {}) {
  const today = dayjs().format('YYYY-MM-DD');
  const filename = `taskcalendar_export_${today}.json`;
  const mimeType = 'application/json';

  const exportPayload = {
    app: 'TaskCalendar',
    schemaVersion: 1,
    exportedAt: new Date().toISOString(),
    account: {
      email: user.userEmail || null,
      isGuest: !!user.isGuest
    },
    boards: boards || [],
    tasks: (tasks || []).map(t => ({
      id: t.id,
      taskname: t.taskname,
      completed: !!t.completed,
      priority: t.priority || 'none',
      completionDate: t.completionDate || t.dueDate || null,
      time: t.time || null,
      boardId: t.boardId || 'main',
      reminder: t.reminder || 'None',
      isAlarm: !!t.isAlarm,
      isRecurring: !!(t.isRecurring || t.recurringSeriesId),
      repeatConfig: t.repeatConfig || null,
      notes: t.description || t.notes || '',
      subtasks: t.subtasks || []
    })),
    stats: stats || {},
    pomodoro: pomodoro || {},
    preferences: {
      themeMode: theme.themeMode || 'system',
      fontSize: theme.fontSize || 'medium',
      defaultReminderTime: theme.defaultReminderTime || '15 min before',
      defaultSnoozeTime: theme.defaultSnoozeTime || 10,
      vibrationEnabled: theme.vibrationEnabled !== false
    }
  };

  const jsonContent = JSON.stringify(exportPayload, null, 2);

  // Web download handling
  if (Platform.OS === 'web' && typeof document !== 'undefined') {
    const blob = new Blob([jsonContent], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    return { success: true, filename };
  }

  // Native iOS / Android handling
  const fileUri = `${FileSystem.cacheDirectory || FileSystem.documentDirectory}${filename}`;
  await FileSystem.writeAsStringAsync(fileUri, jsonContent, {
    encoding: FileSystem.EncodingType.UTF8
  });

  const canShare = await Sharing.isAvailableAsync();
  if (canShare) {
    await Sharing.shareAsync(fileUri, {
      mimeType,
      dialogTitle: 'Export TaskCalendar Data (JSON)',
      UTI: 'public.json'
    });
  } else {
    await Share.share({
      title: filename,
      message: jsonContent
    });
  }

  return { success: true, filename, uri: fileUri };
}

/**
 * Export tasks as formatted CSV (spreadsheet compatible)
 */
export async function exportTasksAsCsvAsync({ tasks = [], boards = [] } = {}) {
  const today = dayjs().format('YYYY-MM-DD');
  const filename = `taskcalendar_tasks_${today}.csv`;
  const mimeType = 'text/csv';

  const boardMap = new Map((boards || []).map(b => [b.id, b.name]));

  const headers = [
    'Task ID',
    'Task Name',
    'Status',
    'Priority',
    'Due Date',
    'Due Time',
    'Board',
    'Recurring',
    'Subtasks Total',
    'Subtasks Completed',
    'Notes'
  ];

  const rows = (tasks || []).map(t => {
    const boardName = boardMap.get(t.boardId) || t.boardId || 'Main';
    const subtasks = Array.isArray(t.subtasks) ? t.subtasks : [];
    const completedSubs = subtasks.filter(s => s.completed).length;
    const isRecurring = !!(t.isRecurring || t.recurringSeriesId || (t.repeatConfig && t.repeatConfig.preset !== 'None'));

    return [
      escapeCsv(t.id),
      escapeCsv(t.taskname),
      escapeCsv(t.completed ? 'Completed' : 'Pending'),
      escapeCsv(t.priority || 'Normal'),
      escapeCsv(t.completionDate || t.dueDate || ''),
      escapeCsv(t.time || ''),
      escapeCsv(boardName),
      escapeCsv(isRecurring ? 'Yes' : 'No'),
      escapeCsv(subtasks.length),
      escapeCsv(completedSubs),
      escapeCsv(t.description || t.notes || '')
    ].join(',');
  });

  const csvContent = [headers.join(','), ...rows].join('\n');

  // Web download handling
  if (Platform.OS === 'web' && typeof document !== 'undefined') {
    const blob = new Blob([csvContent], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    return { success: true, filename };
  }

  // Native iOS / Android handling
  const fileUri = `${FileSystem.cacheDirectory || FileSystem.documentDirectory}${filename}`;
  await FileSystem.writeAsStringAsync(fileUri, csvContent, {
    encoding: FileSystem.EncodingType.UTF8
  });

  const canShare = await Sharing.isAvailableAsync();
  if (canShare) {
    await Sharing.shareAsync(fileUri, {
      mimeType,
      dialogTitle: 'Export Tasks as CSV',
      UTI: 'public.comma-separated-values-text'
    });
  } else {
    await Share.share({
      title: filename,
      message: csvContent
    });
  }

  return { success: true, filename, uri: fileUri };
}

/**
 * Execute full data wipe (GDPR Art. 17 Right to Erasure)
 */
export async function wipeAllUserDataAsync({ dispatch, getState } = {}) {
  try {
    // 1. Cancel all scheduled OS notifications
    try {
      await Notifications.cancelAllScheduledNotificationsAsync();
    } catch (e) {
      console.warn('[GDPR Wipe] Notification cancellation warning:', e);
    }

    // 2. Cancel all active alarms
    try {
      if (getState) {
        const tasks = getState().taskReducer?.tasks || [];
        for (const task of tasks) {
          if (task.id) {
            cancelAlarm(task.id).catch(() => {});
          }
        }
      }
    } catch (e) {
      console.warn('[GDPR Wipe] Alarm cancellation warning:', e);
    }

    // 3. Wipe encrypted storage & AsyncStorage
    try {
      await CryptoStorage.clear();
      await AsyncStorage.clear();
    } catch (e) {
      console.warn('[GDPR Wipe] Storage clear warning:', e);
    }

    // 4. Reset in-memory Redux states
    if (dispatch) {
      dispatch(clearTasks());
      dispatch(resetTheme());
      dispatch(logout());
    }

    return { success: true };
  } catch (error) {
    console.error('[GDPR Wipe] Fatal error during data wipe:', error);
    throw error;
  }
}

/**
 * Structured Privacy & Data Protection Disclosures
 */
export const PRIVACY_POLICY_DISCLOSURES = [
  {
    id: 'ownership',
    title: 'Data Ownership & Local Storage',
    text: 'You own 100% of your data. TaskCalendar is built on a local-first architecture. Your tasks, lists, notes, and habits are stored directly on your device rather than on third-party servers.'
  },
  {
    id: 'encryption',
    title: 'AES-256 Storage Encryption at Rest',
    text: 'All task records, descriptions, and user configurations saved on this device are encrypted at rest using industry-standard AES-256 CTR and HMAC-SHA256 authenticated encryption.'
  },
  {
    id: 'no_trackers',
    title: 'Zero Third-Party Ad Trackers',
    text: 'We never sell, rent, or monetize your personal data. The app contains zero advertising SDKs, tracking pixels, or commercial telemetry beacons.'
  },
  {
    id: 'biometrics',
    title: 'Hardware-Enclave Biometric Security',
    text: 'Biometric authentication (fingerprint) operates exclusively through your device hardware Secure Enclave / KeyStore. Biometric samples are never captured, read, or transmitted by this app.'
  },
  {
    id: 'gdpr_rights',
    title: 'Your GDPR & CCPA Rights',
    text: 'In compliance with GDPR Articles 17 and 20 and the California Consumer Privacy Act (CCPA), you can export your complete personal data in standard JSON or CSV format (Data Portability) or permanently erase all your data (Right to Erasure) at any time from this Settings menu.'
  }
];

