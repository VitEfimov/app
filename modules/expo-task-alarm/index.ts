import { requireNativeModule } from 'expo-modules-core';
import { Platform } from 'react-native';

const ExpoTaskAlarm = Platform.OS === 'web' ? null : requireNativeModule('ExpoTaskAlarm');

export async function scheduleExactAlarm(
  taskId: string,
  taskName: string,
  triggerTimeMillis: number,
  soundName: string
): Promise<boolean> {
  if (!ExpoTaskAlarm) return false;
  return await ExpoTaskAlarm.scheduleExactAlarm(taskId, taskName, triggerTimeMillis, soundName);
}

export async function cancelAlarm(taskId: string): Promise<boolean> {
  if (!ExpoTaskAlarm) return false;
  return await ExpoTaskAlarm.cancelAlarm(taskId);
}

export async function schedulePomodoroAlarm(
  id: string,
  title: string,
  body: string,
  triggerTimeMillis: number,
  channelId: string
): Promise<boolean> {
  if (!ExpoTaskAlarm) return false;
  return await ExpoTaskAlarm.schedulePomodoroAlarm(id, title, body, triggerTimeMillis, channelId);
}

export async function cancelPomodoroAlarm(id: string): Promise<boolean> {
  if (!ExpoTaskAlarm) return false;
  return await ExpoTaskAlarm.cancelPomodoroAlarm(id);
}
