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
