import React, { useState, useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { useSelector, useDispatch } from 'react-redux';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../styles/ThemeContext';
import { clearStats } from '../features/statsSlice';
import dayjs from 'dayjs';
import Svg, { Path } from 'react-native-svg';

const IconLeft = ({ color }) => (
  <Svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <Path d="M15 18l-6-6 6-6" />
  </Svg>
);

const IconRight = ({ color }) => (
  <Svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <Path d="M9 18l6-6-6-6" />
  </Svg>
);

export default function StatisticsScreen() {
  const { colors, isDark } = useTheme();
  const { t } = useTranslation();
  const dispatch = useDispatch();
  const dailyStats = useSelector(state => state.statsReducer?.dailyStats || {});

  const [viewMode, setViewMode] = useState('week'); // 'week', 'month', 'year'
  const [currentDate, setCurrentDate] = useState(dayjs());

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

  const handlePrev = () => {
    if (viewMode === 'week') setCurrentDate(currentDate.subtract(1, 'week'));
    if (viewMode === 'month') setCurrentDate(currentDate.subtract(1, 'month'));
    if (viewMode === 'year') setCurrentDate(currentDate.subtract(1, 'year'));
  };

  const handleNext = () => {
    if (viewMode === 'week') setCurrentDate(currentDate.add(1, 'week'));
    if (viewMode === 'month') setCurrentDate(currentDate.add(1, 'month'));
    if (viewMode === 'year') setCurrentDate(currentDate.add(1, 'year'));
  };

  const modes = ['week', 'month', 'year'];
  const cycleMode = () => {
    const nextIdx = (modes.indexOf(viewMode) + 1) % modes.length;
    setViewMode(modes[nextIdx]);
    setCurrentDate(dayjs());
  };

  const getModeTitle = () => {
    if (viewMode === 'week') return t('Week view');
    if (viewMode === 'month') return t('Month view');
    if (viewMode === 'year') return t('Year view');
    return '';
  };

  const getDateLabel = () => {
    if (viewMode === 'week') {
      const start = currentDate.subtract(6, 'day');
      return `${start.format('MMM D')} - ${currentDate.format('MMM D')}`;
    }
    if (viewMode === 'month') return currentDate.format('MMMM YYYY');
    if (viewMode === 'year') return currentDate.format('YYYY');
  };

  const statsData = useMemo(() => {
    let totalCreated = 0;
    let totalCompleted = 0;
    let totalPomodoroMins = 0;
    let chartData = [];

    if (viewMode === 'week') {
      chartData = Array.from({ length: 7 }).map((_, i) => {
        const d = currentDate.subtract(6 - i, 'day');
        const dateStr = d.format('YYYY-MM-DD');
        const stats = dailyStats[dateStr] || { tasksCreated: 0, tasksCompleted: 0, pomodoroMinutes: 0 };
        return {
          dayLabel: d.format('dd'),
          ...stats
        };
      });
    } else if (viewMode === 'month') {
      const startOfMonth = currentDate.startOf('month');
      const daysInMonth = currentDate.daysInMonth();
      let weeks = [];
      let currentWeekStats = { tasksCreated: 0, tasksCompleted: 0, pomodoroMinutes: 0 };
      
      for (let i = 1; i <= daysInMonth; i++) {
        const d = startOfMonth.date(i);
        const dateStr = d.format('YYYY-MM-DD');
        const stats = dailyStats[dateStr] || { tasksCreated: 0, tasksCompleted: 0, pomodoroMinutes: 0 };
        currentWeekStats.tasksCreated += stats.tasksCreated;
        currentWeekStats.tasksCompleted += stats.tasksCompleted;
        currentWeekStats.pomodoroMinutes += stats.pomodoroMinutes;
        
        if (i % 7 === 0 || i === daysInMonth) {
          weeks.push({
            dayLabel: `W${weeks.length + 1}`,
            ...currentWeekStats
          });
          currentWeekStats = { tasksCreated: 0, tasksCompleted: 0, pomodoroMinutes: 0 };
        }
      }
      chartData = weeks;
    } else if (viewMode === 'year') {
      const startOfYear = currentDate.startOf('year');
      chartData = Array.from({ length: 12 }).map((_, i) => {
        const monthStart = startOfYear.month(i);
        const daysInMonth = monthStart.daysInMonth();
        let monthStats = { tasksCreated: 0, tasksCompleted: 0, pomodoroMinutes: 0 };
        
        for (let d = 1; d <= daysInMonth; d++) {
          const dateStr = monthStart.date(d).format('YYYY-MM-DD');
          const stats = dailyStats[dateStr] || { tasksCreated: 0, tasksCompleted: 0, pomodoroMinutes: 0 };
          monthStats.tasksCreated += stats.tasksCreated;
          monthStats.tasksCompleted += stats.tasksCompleted;
          monthStats.pomodoroMinutes += stats.pomodoroMinutes;
        }
        
        return {
          dayLabel: monthStart.format('MMM').substring(0, 3),
          ...monthStats
        };
      });
    }

    chartData.forEach(d => {
      totalCreated += d.tasksCreated;
      totalCompleted += d.tasksCompleted;
      totalPomodoroMins += d.pomodoroMinutes;
    });

    return { chartData, totalCreated, totalCompleted, totalPomodoroMins };
  }, [dailyStats, currentDate, viewMode]);

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

      <View style={styles.controlsContainer}>
        <TouchableOpacity style={styles.arrowBtn} onPress={handlePrev}>
          <IconLeft color={colors.textSecondary} />
        </TouchableOpacity>
        
        <TouchableOpacity style={styles.dateSelector} onPress={cycleMode}>
          <Text style={[styles.dateText, { color: colors.textPrimary }]}>{getDateLabel()}</Text>
          <Text style={[styles.modeSubtitle, { color: colors.textSecondary }]}>{getModeTitle()}</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.arrowBtn} onPress={handleNext}>
          <IconRight color={colors.textSecondary} />
        </TouchableOpacity>
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
        <Text style={[styles.chartTitle, { color: colors.textPrimary }]}>{t('Tasks Activity')}</Text>
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
        <View style={{ flexDirection: 'row', height: 180 }}>
          <View style={styles.yAxis}>
            <Text style={[styles.yAxisLabel, { color: colors.textSecondary }]}>{maxTaskValue}</Text>
            <Text style={[styles.yAxisLabel, { color: colors.textSecondary }]}>{Math.round(maxTaskValue / 2)}</Text>
            <Text style={[styles.yAxisLabel, { color: colors.textSecondary }]}>0</Text>
          </View>
          <View style={[styles.chartArea, { backgroundColor: surfaceLighter }]}>
            {statsData.chartData.map((d, i) => (
              <View key={i} style={styles.dayCol}>
                <View style={styles.barsContainer}>
                  <ChartBar value={d.tasksCreated} max={maxTaskValue} color="#666" />
                  <ChartBar value={d.tasksCompleted} max={maxTaskValue} color={colors.primary} />
                </View>
                <Text style={[styles.dayLabel, { color: colors.textSecondary }]} numberOfLines={1}>{d.dayLabel}</Text>
              </View>
            ))}
          </View>
        </View>
      </View>

      <View style={[styles.chartContainer, { backgroundColor: colors.bgCard }]}>
        <Text style={[styles.chartTitle, { color: colors.textPrimary }]}>{t('Focus Time (Minutes)')}</Text>
        <View style={{ flexDirection: 'row', height: 180 }}>
          <View style={styles.yAxis}>
            <Text style={[styles.yAxisLabel, { color: colors.textSecondary }]}>{maxPomodoroValue}</Text>
            <Text style={[styles.yAxisLabel, { color: colors.textSecondary }]}>{Math.round(maxPomodoroValue / 2)}</Text>
            <Text style={[styles.yAxisLabel, { color: colors.textSecondary }]}>0</Text>
          </View>
          <View style={[styles.chartArea, { backgroundColor: surfaceLighter }]}>
            {statsData.chartData.map((d, i) => (
              <View key={i} style={styles.dayCol}>
                <View style={styles.barsContainer}>
                  <ChartBar value={d.pomodoroMinutes} max={maxPomodoroValue} color="#ff9800" />
                </View>
                <Text style={[styles.dayLabel, { color: colors.textSecondary }]} numberOfLines={1}>{d.dayLabel}</Text>
              </View>
            ))}
          </View>
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
  header: { marginBottom: 10 },
  title: { fontSize: 24, fontWeight: 'bold' },
  controlsContainer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 25 },
  arrowBtn: { padding: 10 },
  dateSelector: { alignItems: 'center' },
  dateText: { fontSize: 18, fontWeight: 'bold' },
  modeSubtitle: { fontSize: 12, marginTop: 2 },
  summaryCards: { flexDirection: 'row', gap: 15, marginBottom: 25 },
  summaryCard: { flex: 1, padding: 20, borderRadius: 15, alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4, elevation: 2 },
  summaryValue: { fontSize: 32, fontWeight: 'bold', marginBottom: 5 },
  summaryLabel: { fontSize: 13, textTransform: 'uppercase', letterSpacing: 0.5 },
  chartContainer: { padding: 20, borderRadius: 15, marginBottom: 20, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4, elevation: 2 },
  chartTitle: { fontSize: 16, fontWeight: 'bold', marginBottom: 15 },
  legend: { flexDirection: 'row', gap: 15, marginBottom: 15 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  legendColor: { width: 12, height: 12, borderRadius: 6 },
  chartArea: { flex: 1, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', padding: 15, borderRadius: 10 },
  yAxis: { justifyContent: 'space-between', paddingVertical: 15, paddingRight: 10, alignItems: 'flex-end', paddingBottom: 35 },
  yAxisLabel: { fontSize: 10 },
  dayCol: { alignItems: 'center', flex: 1, height: '100%', justifyContent: 'flex-end' },
  barsContainer: { flexDirection: 'row', gap: 2, flex: 1, alignItems: 'flex-end', width: '100%', justifyContent: 'center' },
  barWrapper: { width: 8, height: '100%', justifyContent: 'flex-end' },
  bar: { width: '100%', borderTopLeftRadius: 3, borderTopRightRadius: 3 },
  dayLabel: { marginTop: 10, fontSize: 10, textTransform: 'uppercase' },
  clearBtn: { padding: 15, borderWidth: 1, borderRadius: 10, alignItems: 'center', marginTop: 10 }
});
