import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useSelector } from 'react-redux';
import Modal from 'react-native-modal';
import dayjs from 'dayjs';
import { selectHeatMapData } from '../../features/statsSelectors';

export default function HeatMapCard({ colors, isDark }) {
  const { t } = useTranslation();
  const heatMapData = useSelector(selectHeatMapData);
  const [selectedDay, setSelectedDay] = useState(null);

  // Group into weeks (7 days each)
  const weeks = [];
  let currentWeek = [];
  heatMapData.forEach((day, index) => {
    currentWeek.push(day);
    if (currentWeek.length === 7 || index === heatMapData.length - 1) {
      weeks.push(currentWeek);
      currentWeek = [];
    }
  });

  const getIntensityColor = (intensity) => {
    if (intensity === 0) return isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)';
    if (intensity === 1) return `${colors.primary}40`; // 25% opacity
    if (intensity === 2) return `${colors.primary}80`; // 50% opacity
    if (intensity === 3) return `${colors.primary}C0`; // 75% opacity
    return colors.primary; // 100% opacity
  };

  return (
    <>
      <View style={[styles.card, { backgroundColor: colors.bgCard }]}>
        <Text style={[styles.title, { color: colors.textPrimary }]}>{t('Activity Heat Map')}</Text>
        
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.scrollArea}>
          <View style={styles.gridContainer}>
            {/* Day labels (M, W, F) */}
            <View style={styles.dayLabels}>
              <Text style={[styles.axisLabel, { color: colors.textSecondary }]}>{t('Mon')}</Text>
              <Text style={[styles.axisLabel, { color: colors.textSecondary, marginTop: 22 }]}>{t('Wed')}</Text>
              <Text style={[styles.axisLabel, { color: colors.textSecondary, marginTop: 22 }]}>{t('Fri')}</Text>
            </View>

            <View style={styles.weeksContainer}>
              {weeks.map((week, wIndex) => {
                // Show month label if this week contains the 1st of the month
                const firstDayOfMonth = week.find(d => dayjs(d.date).date() <= 7 && dayjs(d.date).day() === 1);
                return (
                  <View key={wIndex} style={styles.weekCol}>
                    {/* Month Label Row (Placeholder space if no label) */}
                    <View style={styles.monthLabelRow}>
                      {firstDayOfMonth && (
                        <Text style={[styles.axisLabel, { color: colors.textSecondary }]}>
                          {t(dayjs(firstDayOfMonth.date).format('MMM'))}
                        </Text>
                      )}
                    </View>

                    {/* 7 Days of the week */}
                    {Array.from({ length: 7 }).map((_, dIndex) => {
                      const day = week[dIndex];
                      if (!day) return <View key={dIndex} style={styles.emptySquare} />;
                      
                      return (
                        <TouchableOpacity
                          key={dIndex}
                          style={[styles.square, { backgroundColor: getIntensityColor(day.intensity) }]}
                          onPress={() => setSelectedDay(day)}
                        />
                      );
                    })}
                  </View>
                );
              })}
            </View>
          </View>
        </ScrollView>

        <View style={styles.legend}>
          <Text style={[styles.legendText, { color: colors.textSecondary }]}>{t('Less')}</Text>
          <View style={[styles.legendSquare, { backgroundColor: getIntensityColor(0) }]} />
          <View style={[styles.legendSquare, { backgroundColor: getIntensityColor(1) }]} />
          <View style={[styles.legendSquare, { backgroundColor: getIntensityColor(2) }]} />
          <View style={[styles.legendSquare, { backgroundColor: getIntensityColor(3) }]} />
          <View style={[styles.legendSquare, { backgroundColor: getIntensityColor(4) }]} />
          <Text style={[styles.legendText, { color: colors.textSecondary }]}>{t('More')}</Text>
        </View>
      </View>

      {/* Day Detail Modal */}
      <Modal
        isVisible={!!selectedDay}
        onSwipeComplete={() => setSelectedDay(null)}
        swipeDirection={['down']}
        propagateSwipe={true}
        onBackdropPress={() => setSelectedDay(null)}
        style={{ margin: 0, justifyContent: 'flex-end' }}
      >
        <View style={[styles.modalContent, { backgroundColor: colors.bgCard }]}>
          <View style={styles.dragHandle} />
          {selectedDay && (
            <>
              <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>
                {dayjs(selectedDay.date).format('MMMM D, YYYY')}
              </Text>
              
              <View style={styles.statsList}>
                <StatRow label={t("Tasks completed")} value={selectedDay.stats?.tasksCompleted || 0} colors={colors} />
                <StatRow label={t("Tasks created")} value={selectedDay.stats?.tasksCreated || 0} colors={colors} />
                <StatRow label={t("Focus sessions")} value={selectedDay.stats?.pomodoroSessions || 0} colors={colors} />
                <StatRow label={t("Focus minutes")} value={selectedDay.stats?.pomodoroMinutes || 0} colors={colors} />
                
                <StatRow 
                  label={t("Completion rate")} 
                  value={`${selectedDay.stats?.tasksDue > 0 ? Math.round(((selectedDay.stats?.tasksCompleted || 0) / Math.max(selectedDay.stats?.tasksDue || 1, 1)) * 100) : 0}%`} 
                  colors={colors} 
                />
              </View>

              <TouchableOpacity style={[styles.closeBtn, { backgroundColor: colors.primary }]} onPress={() => setSelectedDay(null)}>
                <Text style={styles.closeBtnText}>{t('Close')}</Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      </Modal>
    </>
  );
}

const StatRow = ({ label, value, colors }) => (
  <View style={styles.statRow}>
    <Text style={[styles.statLabel, { color: colors.textSecondary }]}>{label}</Text>
    <Text style={[styles.statValue, { color: colors.textPrimary }]}>{value}</Text>
  </View>
);

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
  scrollArea: {
    flexGrow: 0,
    marginBottom: 20
  },
  gridContainer: {
    flexDirection: 'row'
  },
  dayLabels: {
    paddingTop: 22, // Align with the grid below the month label row
    marginRight: 8
  },
  axisLabel: {
    fontSize: 10,
    lineHeight: 14,
  },
  weeksContainer: {
    flexDirection: 'row',
    gap: 4
  },
  weekCol: {
    gap: 4
  },
  monthLabelRow: {
    height: 16,
    justifyContent: 'center',
    marginBottom: 2
  },
  square: {
    width: 12,
    height: 12,
    borderRadius: 3
  },
  emptySquare: {
    width: 12,
    height: 12
  },
  legend: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 5
  },
  legendText: {
    fontSize: 10,
    marginHorizontal: 5
  },
  legendSquare: {
    width: 10,
    height: 10,
    borderRadius: 2
  },
  modalContent: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 25,
    paddingBottom: 40
  },
  dragHandle: {
    width: 40,
    height: 5,
    backgroundColor: '#888',
    borderRadius: 3,
    marginBottom: 20,
    alignSelf: 'center'
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 25,
    textAlign: 'center'
  },
  statsList: {
    gap: 15,
    marginBottom: 30
  },
  statRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(128,128,128,0.1)'
  },
  statLabel: {
    fontSize: 15
  },
  statValue: {
    fontSize: 16,
    fontWeight: 'bold'
  },
  closeBtn: {
    padding: 15,
    borderRadius: 10,
    alignItems: 'center'
  },
  closeBtnText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16
  }
});
