import { requireNativeModule } from 'expo-modules-core';

const ExpoTaskAlarm = requireNativeModule('ExpoTaskAlarm');

export async function scheduleExactAlarm(
  taskId: string,
  taskName: string,
  triggerTimeMillis: number,
  soundName: string
): Promise<boolean> {
  return await ExpoTaskAlarm.scheduleExactAlarm(taskId, taskName, triggerTimeMillis, soundName);
}

export async function cancelAlarm(taskId: string): Promise<boolean> {
  return await ExpoTaskAlarm.cancelAlarm(taskId);
}
