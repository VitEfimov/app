import React, { useEffect, useState } from 'react';
import { View, Text, FlatList, StyleSheet, TouchableOpacity } from 'react-native';
import { DevLogger } from '../utils/logger';
import { useTheme } from '../styles/ThemeContext';
import { testAndroidDefaultNotification } from '../utils/notifications';

export default function DevLogsScreen() {
  const [logs, setLogs] = useState([]);
  const { colors } = useTheme();

  useEffect(() => {
    const unsubscribe = DevLogger.subscribe((newLogs) => {
      setLogs(newLogs);
    });
    return unsubscribe;
  }, []);

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
        <TouchableOpacity style={[styles.button, { backgroundColor: colors.primary }]} onPress={() => testAndroidDefaultNotification()}>
          <Text style={[styles.buttonText, { color: '#fff' }]}>Test Sys Notification</Text>
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
