import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useSelector } from 'react-redux';
import { selectStreaks } from '../../features/statsSelectors';

export default function StreaksCard({ colors }) {
  const { t } = useTranslation();
  const streaksData = useSelector(selectStreaks);

  const renderStreakItem = (title, data, icon, accentColor) => {
    // Only show if there's an actual streak to show
    if (data.longest === 0) return null;
    
    return (
      <View style={styles.streakRow}>
        <View style={[styles.iconBox, { backgroundColor: `${accentColor}20` }]}>
          <Text style={styles.icon}>{icon}</Text>
        </View>
        <View style={styles.streakInfo}>
          <Text style={[styles.streakTitle, { color: colors.textPrimary }]}>{title}</Text>
          <Text style={[styles.streakSub, { color: colors.textSecondary }]}>
            {t('Longest')}: {data.longest} {t('days')}
          </Text>
        </View>
        <View style={styles.currentStreak}>
          <Text style={[styles.currentValue, { color: accentColor }]}>{data.current}</Text>
          <Text style={[styles.currentLabel, { color: colors.textSecondary }]}>{t('days')}</Text>
        </View>
      </View>
    );
  };

  const hasAnyStreak = streaksData.taskStreak.longest > 0 || streaksData.focusStreak.longest > 0;

  if (!hasAnyStreak) {
    return (
      <View style={[styles.card, { backgroundColor: colors.bgCard }]}>
        <Text style={[styles.title, { color: colors.textPrimary }]}>{t('Streaks & Records')}</Text>
        <View style={styles.emptyContainer}>
          <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
            {t('Complete tasks or focus sessions to build your streaks.')}
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.card, { backgroundColor: colors.bgCard }]}>
      <Text style={[styles.title, { color: colors.textPrimary }]}>{t('Streaks & Records')}</Text>
      
      <View style={styles.streaksList}>
        {renderStreakItem(t("Task Completion"), streaksData.taskStreak, "✅", colors.primary)}
        {renderStreakItem(t("Focus Sessions"), streaksData.focusStreak, "🍅", "#ff9800")}
        {renderStreakItem(t("Productive Days"), streaksData.productiveStreak, "🔥", "#f44336")}
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
    marginBottom: 20
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
  streaksList: {
    gap: 15
  },
  streakRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between'
  },
  iconBox: {
    width: 40,
    height: 40,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 15
  },
  icon: {
    fontSize: 20
  },
  streakInfo: {
    flex: 1
  },
  streakTitle: {
    fontSize: 15,
    fontWeight: 'bold',
    marginBottom: 4
  },
  streakSub: {
    fontSize: 12
  },
  currentStreak: {
    alignItems: 'center',
    minWidth: 50
  },
  currentValue: {
    fontSize: 22,
    fontWeight: 'bold'
  },
  currentLabel: {
    fontSize: 10,
    textTransform: 'uppercase'
  }
});
