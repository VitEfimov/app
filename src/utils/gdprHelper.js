import { Platform, Share } from 'react-native';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import * as DocumentPicker from 'expo-document-picker';
import * as Notifications from 'expo-notifications';
import dayjs from 'dayjs';
import { CryptoStorage } from './cryptoStorage';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { clearTasks, addMultipleTasks } from '../features/taskSlice';
import { resetTheme } from '../features/themeSlice';
import { logout, addBoardAsync } from '../features/userSlice';
import { cancelAlarm } from '../../modules/expo-task-alarm';
import { SecurityLockHelper } from './securityLockHelper';

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
 * RFC 4180 compliant CSV parser
 */
export function parseCsv(text) {
  if (!text || typeof text !== 'string') return [];
  const rows = [];
  let currentRow = [];
  let currentField = '';
  let insideQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const nextChar = text[i + 1];

    if (char === '"') {
      if (insideQuotes && nextChar === '"') {
        currentField += '"';
        i++; // skip escaped quote
      } else {
        insideQuotes = !insideQuotes;
      }
    } else if (char === ',' && !insideQuotes) {
      currentRow.push(currentField);
      currentField = '';
    } else if ((char === '\r' || char === '\n') && !insideQuotes) {
      if (char === '\r' && nextChar === '\n') {
        i++;
      }
      currentRow.push(currentField);
      currentField = '';
      if (currentRow.some(f => f.trim().length > 0)) {
        rows.push(currentRow);
      }
      currentRow = [];
    } else {
      currentField += char;
    }
  }

  if (currentField.length > 0 || currentRow.length > 0) {
    currentRow.push(currentField);
    if (currentRow.some(f => f.trim().length > 0)) {
      rows.push(currentRow);
    }
  }

  return rows;
}

/**
 * Cross-platform text file picker with Smart PIN Lock grace protection
 */
export async function pickAndReadTextFileAsync(allowedTypes = ['application/json', 'text/csv', 'text/comma-separated-values', 'text/plain', '*/*']) {
  SecurityLockHelper.markPickingAttachment(true);
  try {
    const result = await DocumentPicker.getDocumentAsync({
      type: allowedTypes,
      copyToCacheDirectory: true,
      multiple: false
    });

    if (result.canceled || !result.assets || !result.assets.length) {
      return null;
    }

    const asset = result.assets[0];
    let fileContent = '';

    if (Platform.OS === 'web') {
      if (asset.file && typeof asset.file.text === 'function') {
        fileContent = await asset.file.text();
      } else if (asset.uri) {
        const response = await fetch(asset.uri);
        fileContent = await response.text();
      }
    } else {
      if (asset.uri) {
        fileContent = await FileSystem.readAsStringAsync(asset.uri, {
          encoding: FileSystem.EncodingType.UTF8
        });
      }
    }

    return {
      name: asset.name || 'imported_file',
      size: asset.size,
      mimeType: asset.mimeType,
      content: fileContent
    };
  } finally {
    SecurityLockHelper.markPickingAttachment(false);
  }
}

/**
 * Import tasks from CSV string or file
 */
export async function importTasksFromCsvAsync({ fileUri, csvString, dispatch, defaultBoardId = 'main', existingBoards = [] } = {}) {
  let content = csvString;
  if (!content && fileUri) {
    if (Platform.OS === 'web') {
      const resp = await fetch(fileUri);
      content = await resp.text();
    } else {
      content = await FileSystem.readAsStringAsync(fileUri, {
        encoding: FileSystem.EncodingType.UTF8
      });
    }
  }

  if (!content || typeof content !== 'string') {
    throw new Error('Empty or invalid CSV content');
  }

  const rows = parseCsv(content);
  if (rows.length < 2) {
    throw new Error('CSV file contains no data rows');
  }

  const header = rows[0].map(h => (h || '').trim().toLowerCase());
  
  const findCol = (candidates) => {
    return header.findIndex(h => candidates.some(c => h === c || h.includes(c)));
  };

  const nameIdx = findCol(['task name', 'taskname', 'name', 'title', 'task', 'summary']);
  const statusIdx = findCol(['status', 'completed', 'done', 'state']);
  const priorityIdx = findCol(['priority', 'importance']);
  const dateIdx = findCol(['due date', 'duedate', 'completion date', 'completiondate', 'date', 'due']);
  const timeIdx = findCol(['due time', 'duetime', 'time']);
  const boardIdx = findCol(['board', 'category', 'list']);
  const notesIdx = findCol(['notes', 'description', 'details', 'desc']);
  const subtasksIdx = findCol(['subtasks', 'checklist']);

  const boardNameMap = new Map();
  (existingBoards || []).forEach(b => {
    if (b && b.id) {
      boardNameMap.set(b.id.toLowerCase(), b.id);
      if (b.name) boardNameMap.set(b.name.toLowerCase(), b.id);
    }
  });

  const parsedTasks = [];
  const baseTimestamp = Date.now();

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (!row || !row.length) continue;

    const taskname = (nameIdx >= 0 ? row[nameIdx] : (row[1] || row[0]))?.trim();
    if (!taskname) continue;

    // Status
    const statusVal = (statusIdx >= 0 ? row[statusIdx] : '')?.trim().toLowerCase();
    const completed = ['completed', 'done', 'true', '1', 'yes'].includes(statusVal);

    // Priority
    const priorityVal = (priorityIdx >= 0 ? row[priorityIdx] : '')?.trim().toLowerCase();
    let priority = 'none';
    if (['high', 'urgent'].includes(priorityVal)) priority = 'high';
    else if (['medium', 'med', 'normal'].includes(priorityVal)) priority = 'medium';
    else if (['low'].includes(priorityVal)) priority = 'low';

    // Due Date
    const rawDate = (dateIdx >= 0 ? row[dateIdx] : '')?.trim();
    let completionDate = null;
    let dateString = null;
    if (rawDate) {
      const parsedD = dayjs(rawDate);
      if (parsedD.isValid()) {
        completionDate = parsedD.toISOString();
        dateString = parsedD.format('YYYY-MM-DD');
      }
    }

    // Time
    const rawTime = (timeIdx >= 0 ? row[timeIdx] : '')?.trim();
    let time = null;
    if (rawTime && /^(\d{1,2}:\d{2})(\s?[APap][Mm])?$/.test(rawTime)) {
      time = rawTime;
    }

    // Board
    const rawBoard = (boardIdx >= 0 ? row[boardIdx] : '')?.trim().toLowerCase();
    let boardId = defaultBoardId;
    if (rawBoard && boardNameMap.has(rawBoard)) {
      boardId = boardNameMap.get(rawBoard);
    }

    // Notes
    const notes = (notesIdx >= 0 ? row[notesIdx] : '')?.trim() || '';

    // Subtasks
    const rawSubs = (subtasksIdx >= 0 ? row[subtasksIdx] : '')?.trim();
    let subtasks = [];
    if (rawSubs && rawSubs.includes(';')) {
      subtasks = rawSubs.split(';').map((s, sIdx) => ({
        id: `sub_${baseTimestamp}_${i}_${sIdx}`,
        text: s.trim(),
        completed: false
      })).filter(s => s.text.length > 0);
    }

    parsedTasks.push({
      id: `${baseTimestamp}_${i}_${Math.random().toString(36).substr(2, 6)}`,
      taskname: taskname.slice(0, 200),
      completed,
      priority,
      completionDate,
      dateString,
      time,
      boardId,
      reminder: 'None',
      isAlarm: false,
      description: {
        text: notes,
        img: '',
        url: '',
        attachments: []
      },
      subtasks
    });
  }

  if (parsedTasks.length === 0) {
    throw new Error('No valid tasks found in CSV file');
  }

  if (dispatch) {
    await dispatch(addMultipleTasks({ tasks: parsedTasks }));
  }

  return {
    success: true,
    count: parsedTasks.length,
    tasks: parsedTasks
  };
}

/**
 * Import full data backup or tasks list from JSON
 */
export async function importDataFromJsonAsync({ fileUri, jsonString, dispatch, getState, existingBoards = [] } = {}) {
  let content = jsonString;
  if (!content && fileUri) {
    if (Platform.OS === 'web') {
      const resp = await fetch(fileUri);
      content = await resp.text();
    } else {
      content = await FileSystem.readAsStringAsync(fileUri, {
        encoding: FileSystem.EncodingType.UTF8
      });
    }
  }

  if (!content || typeof content !== 'string') {
    throw new Error('Empty or invalid JSON content');
  }

  let parsed;
  try {
    parsed = JSON.parse(content);
  } catch (e) {
    throw new Error('Invalid JSON format: ' + e.message);
  }

  const rawTasks = Array.isArray(parsed) 
    ? parsed 
    : (Array.isArray(parsed?.tasks) ? parsed.tasks : []);

  if (!rawTasks || rawTasks.length === 0) {
    throw new Error('No valid tasks found in JSON file');
  }

  // Import new boards if backup contains boards
  let addedBoardsCount = 0;
  if (dispatch && Array.isArray(parsed?.boards)) {
    const currentBoards = existingBoards.length > 0 
      ? existingBoards 
      : (getState ? (getState().userReducer?.boards || []) : []);
    const currentBoardIds = new Set(currentBoards.map(b => b.id));

    for (const b of parsed.boards) {
      if (b && b.id && b.id !== 'main' && !currentBoardIds.has(b.id)) {
        try {
          await dispatch(addBoardAsync({
            id: b.id,
            name: b.name || 'Imported Board',
            type: b.type || 'standard',
            color: b.color || '#1E88E5'
          }));
          currentBoardIds.add(b.id);
          addedBoardsCount++;
        } catch (e) {
          console.warn('[GDPR Import] Board import warning:', e);
        }
      }
    }
  }

  const baseTimestamp = Date.now();
  const normalizedTasks = rawTasks.map((t, idx) => {
    const name = (t.taskname || t.name || t.title || '').trim();
    if (!name) return null;

    let completionDate = t.completionDate || t.dueDate || t.date || null;
    let dateString = t.dateString || null;
    if (completionDate) {
      const parsedD = dayjs(completionDate);
      if (parsedD.isValid()) {
        completionDate = parsedD.toISOString();
        if (!dateString) dateString = parsedD.format('YYYY-MM-DD');
      }
    }

    const priorityVal = (t.priority || 'none').toLowerCase();
    const priority = ['high', 'medium', 'low', 'none'].includes(priorityVal) ? priorityVal : 'none';

    let descObj = { text: '', img: '', url: '', attachments: [] };
    if (typeof t.description === 'string') {
      descObj.text = t.description;
    } else if (t.description && typeof t.description === 'object') {
      descObj = {
        text: t.description.text || '',
        img: t.description.img || '',
        url: t.description.url || '',
        attachments: Array.isArray(t.description.attachments) ? t.description.attachments : []
      };
    } else if (t.notes) {
      descObj.text = String(t.notes);
    }

    const subtasks = Array.isArray(t.subtasks) ? t.subtasks.map((s, sIdx) => ({
      id: s.id || `sub_${baseTimestamp}_${idx}_${sIdx}`,
      text: typeof s === 'string' ? s : (s.text || s.title || ''),
      completed: !!s.completed
    })) : [];

    return {
      id: t.id ? String(t.id) : `${baseTimestamp}_${idx}_${Math.random().toString(36).substr(2, 6)}`,
      taskname: name.slice(0, 200),
      completed: !!t.completed,
      priority,
      completionDate,
      dateString,
      time: t.time || null,
      boardId: t.boardId || 'main',
      reminder: t.reminder || 'None',
      isAlarm: !!t.isAlarm,
      isRecurring: !!(t.isRecurring || t.recurringSeriesId),
      recurringSeriesId: t.recurringSeriesId || null,
      repeatConfig: t.repeatConfig || null,
      repeatFrequency: t.repeatFrequency || null,
      description: descObj,
      subtasks
    };
  }).filter(Boolean);

  if (normalizedTasks.length === 0) {
    throw new Error('No valid tasks found in JSON file');
  }

  if (dispatch) {
    await dispatch(addMultipleTasks({ tasks: normalizedTasks }));
  }

  return {
    success: true,
    count: normalizedTasks.length,
    boardsCount: addedBoardsCount,
    tasks: normalizedTasks
  };
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

