import React from 'react';
import { requestWidgetUpdate } from 'react-native-android-widget';
import { TodayTasksWidget } from './TodayTasksWidget';
import AsyncStorage from '@react-native-async-storage/async-storage';

export async function widgetTaskHandler(props) {
  const widgetInfo = props.widgetInfo;
  
  if (props.widgetAction === 'WIDGET_ADDED' || props.widgetAction === 'WIDGET_UPDATE' || props.widgetAction === 'WIDGET_RESIZED') {
    let tasks = [];
    try {
      const storedTasks = await AsyncStorage.getItem('widget_today_tasks');
      if (storedTasks) {
        tasks = JSON.parse(storedTasks);
      }
    } catch (e) {
      console.error('Failed to load tasks for widget', e);
    }
    
    requestWidgetUpdate({
      widgetName: 'TodayTasksWidget',
      renderWidget: () => <TodayTasksWidget tasks={tasks} />,
      widgetInfo,
    });
  }
}
