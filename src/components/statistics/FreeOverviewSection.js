import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';

const ChartBar = ({ value, max, color }) => {
  const heightPercent = max > 0 ? (value / max) * 100 : 0;
  return (
    <View style={styles.barWrapper}>
      <View style={[styles.bar, { height: `${heightPercent}%`, backgroundColor: color }]} />
    </View>
  );
};

export default function FreeOverviewSection({ colors, isDark, dailyStats, currentDate, viewMode }) {
  const { t } = useTranslation();

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
          dayLabel: t(d.format('dd')),
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
            dayLabel: t(`W${weeks.length + 1}`),
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
          dayLabel: t(monthStart.format('MMM').substring(0, 3)),
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

  const maxTaskValue = Math.max(1, ...statsData.chartData.map(d => Math.max(d.tasksCreated || 0, d.tasksCompleted || 0)));
  const maxPomodoroValue = Math.max(1, ...statsData.chartData.map(d => d.pomodoroMinutes || 0));

  const surfaceLighter = isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)';

  return (
    <>
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
                <Text style={[styles.dayLabel, { color: colors.textSecondary }, d.dayLabel.length > 2 && { transform: [{ rotate: '-90deg' }], width: 50, textAlign: 'center', marginBottom: 15 }]}>{d.dayLabel}</Text>
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
                <Text style={[styles.dayLabel, { color: colors.textSecondary }, d.dayLabel.length > 2 && { transform: [{ rotate: '-90deg' }], width: 50, textAlign: 'center', marginBottom: 15 }]}>{d.dayLabel}</Text>
              </View>
            ))}
          </View>
        </View>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
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
});
