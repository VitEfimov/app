import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useSelector } from 'react-redux';
import { selectStreaks } from '../../features/statsSelectors';
import Svg, { Path, Circle } from 'react-native-svg';

const IconCheck = ({ color }) => (
  <Svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <Path d="M20 6L9 17l-5-5" />
  </Svg>
);

const IconTimer = ({ color }) => (
  <Svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <Circle cx="12" cy="13" r="8" />
    <Path d="M12 9v4l2 2M12 2v2M4 4l2 2" />
  </Svg>
);

const IconFlame = ({ color }) => (
  <Svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <Path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z" />
  </Svg>
);

export default function StreaksCard({ colors }) {
  const { t } = useTranslation();
  const streaksData = useSelector(selectStreaks);

  const renderStreakItem = (title, data, IconComponent, accentColor) => {
    // Only show if there's an actual streak to show
    if (data.longest === 0) return null;
    
    return (
      <View style={styles.streakRow}>
        <View style={[styles.iconBox, { backgroundColor: `${accentColor}20` }]}>
          <IconComponent color={accentColor} />
        </View>
        <View style={styles.streakInfo}>
          <Text style={[styles.streakTitle, { color: colors.textPrimary }]}>{title}</Text>
          <Text style={[styles.streakSub, { color: colors.textSecondary }]}>
            {t('Best')}: {data.longest} {t('days')} · {t('Current')}: {data.current}
          </Text>
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
        {renderStreakItem(t("Task Completion"), streaksData.taskStreak, IconCheck, colors.primary)}
        {renderStreakItem(t("Focus Sessions"), streaksData.focusStreak, IconTimer, "#ff9800")}
        {renderStreakItem(t("Productive Days"), streaksData.productiveStreak, IconFlame, "#f44336")}
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
    fontSize: 13,
    marginTop: 2
  }
});
