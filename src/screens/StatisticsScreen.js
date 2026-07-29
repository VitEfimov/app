import React, { useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { useSelector, useDispatch } from 'react-redux';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../styles/ThemeContext';
import { clearStats } from '../features/statsSlice';
import dayjs from 'dayjs';

export default function StatisticsScreen() {
  const { colors, isDark } = useTheme();
  const { t } = useTranslation();
  const dispatch = useDispatch();
  const dailyStats = useSelector(state => state.statsReducer?.dailyStats || {});

  const handleClearStats = () => {
    Alert.alert(
      t("Clear Statistics"),
      t("Are you sure you want to clear all your statistics? This cannot be undone."),
      [
        { text: t("Cancel"), style: "cancel" },
        { 
          text: t("Clear"), 
          style: "destructive",
          onPress: () => dispatch(clearStats())
        }
      ]
    );
  };

  // Generate last 7 days keys
  const last7Days = useMemo(() => {
    return Array.from({ length: 7 }).map((_, i) => dayjs().subtract(6 - i, 'day').format('YYYY-MM-DD'));
  }, []);

  const statsData = useMemo(() => {
    let totalCreated = 0;
    let totalCompleted = 0;
    let totalPomodoroMins = 0;
    
    const chartData = last7Days.map(date => {
      const stats = dailyStats[date] || { tasksCreated: 0, tasksCompleted: 0, pomodoroMinutes: 0 };
      totalCreated += stats.tasksCreated;
      totalCompleted += stats.tasksCompleted;
      totalPomodoroMins += stats.pomodoroMinutes;
      return {
        date,
        dayLabel: dayjs(date).format('dd'),
        ...stats
      };
    });

    return { chartData, totalCreated, totalCompleted, totalPomodoroMins };
  }, [dailyStats, last7Days]);

  const maxTaskValue = Math.max(1, ...statsData.chartData.map(d => Math.max(d.tasksCreated, d.tasksCompleted)));
  const maxPomodoroValue = Math.max(1, ...statsData.chartData.map(d => d.pomodoroMinutes));

  const ChartBar = ({ value, max, color }) => {
    const heightPercent = (value / max) * 100;
    return (
      <View style={styles.barWrapper}>
        <View style={[styles.bar, { height: `${heightPercent}%`, backgroundColor: color }]} />
      </View>
    );
  };

  const surfaceLighter = isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)';

  return (
    <ScrollView style={[styles.container, { backgroundColor: colors.bgMain }]} contentContainerStyle={styles.scrollContent}>
      
      <View style={styles.header}>
        <Text style={[styles.title, { color: colors.textPrimary }]}>{t('Your Statistics')}</Text>
      </View>

      <View style={styles.summaryCards}>
        <View style={[styles.summaryCard, { backgroundColor: colors.bgCard }]}>
          <Text style={[styles.summaryValue, { color: colors.primary }]}>{statsData.totalCompleted}</Text>
          <Text style={[styles.summaryLabel, { color: colors.textSecondary }]}>{t('Tasks Completed')}</Text>
        </View>
        <View style={[styles.summaryCard, { backgroundColor: colors.bgCard }]}>
          <Text style={[styles.summaryValue, { color: '#ff9800' }]}>{Math.round(statsData.totalPomodoroMins / 60 * 10) / 10}h</Text>
          <Text style={[styles.summaryLabel, { color: colors.textSecondary }]}>{t('Focus Time')}</Text>
        </View>
      </View>

      <View style={[styles.chartContainer, { backgroundColor: colors.bgCard }]}>
        <Text style={[styles.chartTitle, { color: colors.textPrimary }]}>{t('Tasks Activity (Last 7 Days)')}</Text>
        <View style={styles.legend}>
          <View style={styles.legendItem}>
            <View style={[styles.legendColor, { backgroundColor: colors.primary }]} />
            <Text style={{ color: colors.textSecondary, fontSize: 12 }}>{t('Completed')}</Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.legendColor, { backgroundColor: '#666' }]} />
            <Text style={{ color: colors.textSecondary, fontSize: 12 }}>{t('Created')}</Text>
          </View>
        </View>
        <View style={[styles.chartArea, { backgroundColor: surfaceLighter }]}>
          {statsData.chartData.map((d, i) => (
            <View key={i} style={styles.dayCol}>
              <View style={styles.barsContainer}>
                <ChartBar value={d.tasksCreated} max={maxTaskValue} color="#666" />
                <ChartBar value={d.tasksCompleted} max={maxTaskValue} color={colors.primary} />
              </View>
              <Text style={[styles.dayLabel, { color: colors.textSecondary }]}>{d.dayLabel}</Text>
            </View>
          ))}
        </View>
      </View>

      <View style={[styles.chartContainer, { backgroundColor: colors.bgCard }]}>
        <Text style={[styles.chartTitle, { color: colors.textPrimary }]}>{t('Focus Time (Minutes)')}</Text>
        <View style={[styles.chartArea, { backgroundColor: surfaceLighter }]}>
          {statsData.chartData.map((d, i) => (
            <View key={i} style={styles.dayCol}>
              <View style={styles.barsContainer}>
                <ChartBar value={d.pomodoroMinutes} max={maxPomodoroValue} color="#ff9800" />
              </View>
              <Text style={[styles.dayLabel, { color: colors.textSecondary }]}>{d.dayLabel}</Text>
              <Text style={[styles.valueLabel, { color: colors.textPrimary }]}>{d.pomodoroMinutes}</Text>
            </View>
          ))}
        </View>
      </View>

      <TouchableOpacity 
        style={[styles.clearBtn, { borderColor: '#f44336' }]} 
        onPress={handleClearStats}
      >
        <Text style={{ color: '#f44336', fontWeight: 'bold' }}>{t('Clear Statistics')}</Text>
      </TouchableOpacity>

      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollContent: { padding: 20 },
  header: { marginBottom: 20 },
  title: { fontSize: 24, fontWeight: 'bold' },
  summaryCards: { flexDirection: 'row', gap: 15, marginBottom: 25 },
  summaryCard: { flex: 1, padding: 20, borderRadius: 15, alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4, elevation: 2 },
  summaryValue: { fontSize: 32, fontWeight: 'bold', marginBottom: 5 },
  summaryLabel: { fontSize: 13, textTransform: 'uppercase', letterSpacing: 0.5 },
  chartContainer: { padding: 20, borderRadius: 15, marginBottom: 20, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4, elevation: 2 },
  chartTitle: { fontSize: 16, fontWeight: 'bold', marginBottom: 15 },
  legend: { flexDirection: 'row', gap: 15, marginBottom: 15 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  legendColor: { width: 12, height: 12, borderRadius: 6 },
  chartArea: { height: 180, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', padding: 15, borderRadius: 10 },
  dayCol: { alignItems: 'center', width: 30, height: '100%', justifyContent: 'flex-end' },
  barsContainer: { flexDirection: 'row', gap: 2, flex: 1, alignItems: 'flex-end', width: '100%', justifyContent: 'center' },
  barWrapper: { width: 10, height: '100%', justifyContent: 'flex-end' },
  bar: { width: '100%', borderTopLeftRadius: 3, borderTopRightRadius: 3 },
  dayLabel: { marginTop: 10, fontSize: 12, textTransform: 'uppercase' },
  valueLabel: { fontSize: 10, marginTop: 5, fontWeight: 'bold' },
  clearBtn: { padding: 15, borderWidth: 1, borderRadius: 10, alignItems: 'center', marginTop: 10 }
});
