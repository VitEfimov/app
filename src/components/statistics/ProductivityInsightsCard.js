import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useSelector } from 'react-redux';
import { selectNormalizedDailyStats, selectWeeklyAnalytics } from '../../features/statsSelectors';
import dayjs from 'dayjs';

export default function ProductivityInsightsCard({ colors }) {
  const { t } = useTranslation();
  const dailyStats = useSelector(selectNormalizedDailyStats);
  const currentWeekStats = useSelector(selectWeeklyAnalytics(dayjs()));
  const lastWeekStats = useSelector(selectWeeklyAnalytics(dayjs().subtract(1, 'week')));

  const insights = useMemo(() => {
    const activeDates = Object.keys(dailyStats).filter(
      k => dailyStats[k].tasksCompleted > 0 || dailyStats[k].pomodoroSessions > 0
    );
    
    if (activeDates.length < 5) {
      return null; // Not enough data for meaningful insights
    }

    const generated = [];

    // 1. Most productive weekday
    const weekdayCounts = [0, 0, 0, 0, 0, 0, 0];
    activeDates.forEach(date => {
      const dayOfWeek = dayjs(date).day();
      weekdayCounts[dayOfWeek] += (dailyStats[date].tasksCompleted || 0);
    });
    
    const maxCompleted = Math.max(...weekdayCounts);
    if (maxCompleted > 5) {
      const bestDayIndex = weekdayCounts.indexOf(maxCompleted);
      const dayNames = [t('Sunday'), t('Monday'), t('Tuesday'), t('Wednesday'), t('Thursday'), t('Friday'), t('Saturday')];
      generated.push(`${dayNames[bestDayIndex]} ${t('is your most productive day for completing tasks.')}`);
    }

    // 2. Focus time comparison
    if (lastWeekStats.activeDays > 0 && currentWeekStats.pomodoroMinutes > 0) {
      const diff = currentWeekStats.pomodoroMinutes - lastWeekStats.pomodoroMinutes;
      if (diff > 30) {
        generated.push(t('Great focus! You have spent more time focusing this week than last week.'));
      }
    }

    // 3. Completion Rate
    if (currentWeekStats.tasksDue >= 5) {
      const rate = currentWeekStats.completionRate;
      if (rate >= 0.8) {
        generated.push(t('You are completing most of your planned tasks this week. Keep it up!'));
      } else if (rate < 0.4) {
        generated.push(t('Try scheduling fewer tasks to improve your completion rate.'));
      }
    }

    // 4. Overdue control
    if (currentWeekStats.overdueTasks > 5) {
      generated.push(t('You have several overdue tasks. Consider rescheduling them or deleting them.'));
    }

    return generated.slice(0, 3); // Max 3 insights
  }, [dailyStats, currentWeekStats, lastWeekStats, t]);

  if (!insights || insights.length === 0) {
    return (
      <View style={[styles.card, { backgroundColor: colors.bgCard }]}>
        <Text style={[styles.title, { color: colors.textPrimary }]}>{t('Productivity Insights')}</Text>
        <View style={styles.emptyContainer}>
          <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
            {t('Complete more tasks to unlock personalized insights.')}
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.card, { backgroundColor: colors.bgCard }]}>
      <Text style={[styles.title, { color: colors.textPrimary }]}>{t('Productivity Insights')}</Text>
      
      <View style={styles.insightsList}>
        {insights.map((insight, index) => (
          <View key={index} style={styles.insightRow}>
            <Text style={[styles.bullet, { color: colors.primary }]}>•</Text>
            <Text style={[styles.insightText, { color: colors.textPrimary }]}>{insight}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 15,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  title: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 15
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 10
  },
  emptyText: {
    textAlign: 'center',
    fontSize: 14,
    lineHeight: 20
  },
  insightsList: {
    gap: 12
  },
  insightRow: {
    flexDirection: 'row',
    alignItems: 'flex-start'
  },
  bullet: {
    fontSize: 18,
    marginRight: 10,
    lineHeight: 22
  },
  insightText: {
    flex: 1,
    fontSize: 14,
    lineHeight: 22
  }
});
