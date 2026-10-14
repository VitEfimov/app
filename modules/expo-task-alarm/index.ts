import { requireNativeModule } from 'expo-modules-core';
import { Platform } from 'react-native';

const ExpoTaskAlarm = Platform.OS === 'web' ? null : requireNativeModule('ExpoTaskAlarm');

export async function scheduleExactAlarm(
  taskId: string,
  taskName: string,
  triggerTimeMillis: number,
  soundName: string
): Promise<boolean> {
  if (!ExpoTaskAlarm || typeof ExpoTaskAlarm.scheduleExactAlarm !== 'function') return false;
  try {
    return await ExpoTaskAlarm.scheduleExactAlarm(taskId, taskName, triggerTimeMillis, soundName);
  } catch (e) {
    console.warn('scheduleExactAlarm failed:', e);
    return false;
  }
}

export async function cancelAlarm(taskId: string): Promise<boolean> {
  if (!ExpoTaskAlarm || typeof ExpoTaskAlarm.cancelAlarm !== 'function') return false;
  try {
    return await ExpoTaskAlarm.cancelAlarm(taskId);
  } catch (e) {
    console.warn('cancelAlarm failed:', e);
    return false;
  }
}

export async function schedulePomodoroAlarm(
  id: string,
  title: string,
  body: string,
  triggerTimeMillis: number,
  channelId: string
): Promise<boolean> {
  if (!ExpoTaskAlarm || typeof ExpoTaskAlarm.schedulePomodoroAlarm !== 'function') return false;
  try {
    return await ExpoTaskAlarm.schedulePomodoroAlarm(id, title, body, triggerTimeMillis, channelId);
  } catch (e) {
    console.warn('schedulePomodoroAlarm failed:', e);
    return false;
  }
}

export async function cancelPomodoroAlarm(id: string): Promise<boolean> {
  if (!ExpoTaskAlarm || typeof ExpoTaskAlarm.cancelPomodoroAlarm !== 'function') return false;
  try {
    return await ExpoTaskAlarm.cancelPomodoroAlarm(id);
  } catch (e) {
    console.warn('cancelPomodoroAlarm failed:', e);
    return false;
  }
}

export async function takePhotoAsync(): Promise<string | null> {
  if (!ExpoTaskAlarm || typeof ExpoTaskAlarm.takePhotoAsync !== 'function') return null;
  try {
    return await ExpoTaskAlarm.takePhotoAsync();
  } catch (e) {
    console.warn('takePhotoAsync failed:', e);
    return null;
  }
}

export async function shareTaskAsync(text: string, uris: string[]): Promise<boolean> {
  if (!ExpoTaskAlarm || typeof ExpoTaskAlarm.shareTaskAsync !== 'function') return false;
  try {
    return await ExpoTaskAlarm.shareTaskAsync(text, uris);
  } catch (e) {
    console.warn('shareTaskAsync failed:', e);
    return false;
  }
}

export async function openDocumentAsync(uri: string, mimeType: string | null = null): Promise<boolean> {
  if (!ExpoTaskAlarm || typeof ExpoTaskAlarm.openDocumentAsync !== 'function') return false;
  try {
    return await ExpoTaskAlarm.openDocumentAsync(uri, mimeType);
  } catch (e) {
    console.warn('openDocumentAsync failed:', e);
    return false;
  }
}

