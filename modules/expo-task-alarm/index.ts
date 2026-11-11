import { requireNativeModule, requireOptionalNativeModule } from 'expo-modules-core';
import { Platform } from 'react-native';

const ExpoTaskAlarm = (() => {
  if (Platform.OS === 'web') return null;
  try {
    if (typeof requireOptionalNativeModule === 'function') {
      return requireOptionalNativeModule('ExpoTaskAlarm');
    }
    return requireNativeModule('ExpoTaskAlarm');
  } catch (e) {
    console.warn('ExpoTaskAlarm native module unavailable:', e);
    return null;
  }
})();

export async function scheduleExactAlarm(
  taskId: string,
  taskName: string,
  triggerTimeMillis: number,
  soundName: string,
  presentationStyle?: string,
  keepNotificationAllDay?: boolean,
  channelId?: string
): Promise<boolean> {
  if (!ExpoTaskAlarm || typeof ExpoTaskAlarm.scheduleExactAlarm !== 'function') return false;
  try {
    return await ExpoTaskAlarm.scheduleExactAlarm(
      taskId,
      taskName,
      triggerTimeMillis,
      soundName,
      presentationStyle || 'adaptive',
      !!keepNotificationAllDay,
      channelId || ''
    );
  } catch (e) {
    console.warn('scheduleExactAlarm failed:', e);
    return false;
  }
}

export function getSavedThemeMode(): string | null {
  if (!ExpoTaskAlarm || typeof ExpoTaskAlarm.getSavedThemeMode !== 'function') return null;
  try {
    return ExpoTaskAlarm.getSavedThemeMode();
  } catch (e) {
    return null;
  }
}

export function setSavedThemeMode(mode: string): boolean {
  if (!ExpoTaskAlarm || typeof ExpoTaskAlarm.setSavedThemeMode !== 'function') return false;
  try {
    return ExpoTaskAlarm.setSavedThemeMode(mode);
  } catch (e) {
    return false;
  }
}

export function setSavedAndroidAutoMute(enabled: boolean): boolean {
  if (!ExpoTaskAlarm || typeof ExpoTaskAlarm.setSavedAndroidAutoMute !== 'function') return false;
  try {
    return ExpoTaskAlarm.setSavedAndroidAutoMute(!!enabled);
  } catch (e) {
    return false;
  }
}

export function duckAudioForNotification(): boolean {
  if (!ExpoTaskAlarm || typeof ExpoTaskAlarm.duckAudioForNotification !== 'function') return false;
  try {
    return ExpoTaskAlarm.duckAudioForNotification();
  } catch (e) {
    return false;
  }
}

export function getSystemMemoryMetrics(): Record<string, any> {
  if (!ExpoTaskAlarm || typeof ExpoTaskAlarm.getSystemMemoryMetrics !== 'function') return {};
  try {
    return ExpoTaskAlarm.getSystemMemoryMetrics() || {};
  } catch (e) {
    return {};
  }
}

export function getNativeCrashLogs(): any[] {
  if (!ExpoTaskAlarm || typeof ExpoTaskAlarm.getNativeCrashLogs !== 'function') return [];
  try {
    const raw = ExpoTaskAlarm.getNativeCrashLogs();
    if (typeof raw === 'string') return JSON.parse(raw);
    if (Array.isArray(raw)) return raw;
    return [];
  } catch (e) {
    return [];
  }
}

export function clearNativeCrashLogs(): boolean {
  if (!ExpoTaskAlarm || typeof ExpoTaskAlarm.clearNativeCrashLogs !== 'function') return false;
  try {
    return ExpoTaskAlarm.clearNativeCrashLogs();
  } catch (e) {
    return false;
  }
}

export function initNativeCrashHandler(): boolean {
  if (!ExpoTaskAlarm || typeof ExpoTaskAlarm.initNativeCrashHandler !== 'function') return false;
  try {
    return ExpoTaskAlarm.initNativeCrashHandler();
  } catch (e) {
    return false;
  }
}

export async function isCarConnected(): Promise<boolean> {
  if (!ExpoTaskAlarm || typeof ExpoTaskAlarm.isCarConnected !== 'function') return false;
  try {
    return await ExpoTaskAlarm.isCarConnected();
  } catch (e) {
    return false;
  }
}

export async function getAlarmSystemDiagnostics(): Promise<Record<string, any>> {
  if (!ExpoTaskAlarm || typeof ExpoTaskAlarm.getAlarmSystemDiagnostics !== 'function') return {};
  try {
    return await ExpoTaskAlarm.getAlarmSystemDiagnostics();
  } catch (e) {
    console.warn('getAlarmSystemDiagnostics failed:', e);
    return {};
  }
}

export async function openExactAlarmSettings(): Promise<boolean> {
  if (!ExpoTaskAlarm || typeof ExpoTaskAlarm.openExactAlarmSettings !== 'function') return false;
  try {
    return await ExpoTaskAlarm.openExactAlarmSettings();
  } catch (e) {
    return false;
  }
}

export async function openBatteryOptimizationSettings(): Promise<boolean> {
  if (!ExpoTaskAlarm || typeof ExpoTaskAlarm.openBatteryOptimizationSettings !== 'function') return false;
  try {
    return await ExpoTaskAlarm.openBatteryOptimizationSettings();
  } catch (e) {
    return false;
  }
}

export async function openOverlaySettings(): Promise<boolean> {
  if (!ExpoTaskAlarm || typeof ExpoTaskAlarm.openOverlaySettings !== 'function') return false;
  try {
    return await ExpoTaskAlarm.openOverlaySettings();
  } catch (e) {
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

export async function setScreenSecurityAsync(enabled: boolean): Promise<boolean> {
  if (!ExpoTaskAlarm || typeof ExpoTaskAlarm.setScreenSecurityAsync !== 'function') return false;
  try {
    return await ExpoTaskAlarm.setScreenSecurityAsync(enabled);
  } catch (e) {
    console.warn('setScreenSecurityAsync failed:', e);
    return false;
  }
}

export async function isScreenSecurityEnabled(): Promise<boolean> {
  if (!ExpoTaskAlarm || typeof ExpoTaskAlarm.isScreenSecurityEnabled !== 'function') return false;
  try {
    return await ExpoTaskAlarm.isScreenSecurityEnabled();
  } catch (e) {
    return false;
  }
}

