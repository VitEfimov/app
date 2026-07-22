import React, { useEffect, useState } from 'react';
import { View, Text, FlatList, StyleSheet, TouchableOpacity, Platform } from 'react-native';
import { DevLogger } from '../utils/logger';
import { useTheme } from '../styles/ThemeContext';
import { testAndroidDefaultNotification, normalizeChannelForLog } from '../utils/notifications';
import * as Notifications from 'expo-notifications';

export default function DevLogsScreen() {
  const [logs, setLogs] = useState([]);
  const { colors } = useTheme();

  useEffect(() => {
    const unsubscribe = DevLogger.subscribe((newLogs) => {
      setLogs(newLogs);
    });
    return unsubscribe;
  }, []);

  const handleSystemNotificationTest = async () => {
    DevLogger.info('User started system notification test');

    try {
      const notificationId = await testAndroidDefaultNotification();

      if (notificationId) {
        DevLogger.success('System notification test started', { notificationId });
      } else {
        DevLogger.error('System notification test did not return an ID');
      }
    } catch (error) {
      DevLogger.error('Unhandled system notification test error', {
        name: error?.name,
        message: error?.message,
        stack: error?.stack,
      });
    }
  };

  const handleInspectChannels = async () => {
    if (Platform.OS !== 'android') {
      DevLogger.warn('Notification channels only exist on Android');
      return;
    }

    try {
      const channels = await Notifications.getNotificationChannelsAsync();

      DevLogger.info(
        `Android notification channels: ${channels.length}`,
        channels.map(normalizeChannelForLog)
      );
    } catch (error) {
      DevLogger.error('Failed to inspect Android channels', {
        name: error?.name,
        message: error?.message,
        stack: error?.stack,
      });
    }
  };

  const renderItem = ({ item }) => {
    let color = colors.textPrimary;
    if (item.type === 'error') color = '#ff4d4f';
    if (item.type === 'success') color = '#52c41a';
    if (item.type === 'warning') color = '#faad14';

    return (
      <View style={[styles.logItem, { borderBottomColor: colors.borderColor }]}>
        <Text style={{ color: colors.textSecondary, fontSize: 10 }}>{new Date(item.timestamp).toLocaleTimeString()}</Text>
        <Text style={{ color, fontWeight: 'bold', marginVertical: 4 }}>{item.message}</Text>
        {item.details && (
          <Text style={{ color: colors.textSecondary, fontSize: 12 }}>
            {typeof item.details === 'object' ? JSON.stringify(item.details, null, 2) : String(item.details)}
          </Text>
        )}
      </View>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.bgMain }]}>
      <View style={[styles.header, { backgroundColor: colors.bgCard, borderBottomColor: colors.borderColor }]}>
        <TouchableOpacity style={styles.button} onPress={() => DevLogger.clearLogs()}>
          <Text style={styles.buttonText}>Clear Logs</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.button, { backgroundColor: colors.primary }]} onPress={handleSystemNotificationTest}>
          <Text style={[styles.buttonText, { color: '#fff' }]}>Test Sys Notification</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.button} onPress={handleInspectChannels}>
          <Text style={styles.buttonText}>Inspect Channels</Text>
        </TouchableOpacity>
      </View>
      <FlatList
        data={logs}
        keyExtractor={item => item.id}
        renderItem={renderItem}
        contentContainerStyle={{ padding: 16 }}
        ListEmptyComponent={<Text style={{ color: colors.textSecondary, textAlign: 'center' }}>No logs yet. Trigger a notification to see details here.</Text>}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    padding: 16,
    justifyContent: 'space-between',
    borderBottomWidth: 1,
  },
  button: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: '#333',
    borderRadius: 8,
  },
  buttonText: {
    color: '#fff',
    fontWeight: 'bold',
  },
  logItem: {
    paddingVertical: 12,
    borderBottomWidth: 1,
  }
});
