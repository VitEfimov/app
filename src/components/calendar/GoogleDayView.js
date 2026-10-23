import React, { useRef, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Platform } from 'react-native';
import dayjs from 'dayjs';
import { useTranslation } from 'react-i18next';
import {
  IconChevronLeft,
  IconChevronRight,
  IconCheckCircle,
  IconClock,
  IconPlus
} from './CalendarIcons';
import { getBoardColor } from '../../utils/boardColors';

const HOURS = Array.from({ length: 24 }, (_, i) => i);

export default function GoogleDayView({
  selectedDate,
  onSelectDate,
  tasks = [],
  onPressTask,
  onToggleComplete,
  onQuickAddTaskAtHour,
  boards = [],
  colors,
  isDark
}) {
  const { t } = useTranslation();
  const scrollViewRef = useRef(null);

  const dateObj = dayjs(selectedDate);
  const isToday = dateObj.isSame(dayjs(), 'day');
  const now = dayjs();
  const currentHour = now.hour();
  const currentMinute = now.minute();

  // Scroll to roughly current time on mount if today
  useEffect(() => {
    if (isToday && scrollViewRef.current) {
      const scrollY = Math.max(0, (currentHour - 2) * 60);
      setTimeout(() => {
        scrollViewRef.current?.scrollTo({ y: scrollY, animated: true });
      }, 200);
    }
  }, [selectedDate, isToday]);

  // Filter tasks for this day
  const dayTasks = tasks.filter(task => {
    if (!task) return false;
    const d = task.dateString || (typeof task.completionDate === 'string' ? task.completionDate.split('T')[0] : null);
    return d === selectedDate;
  });

  // Separate all-day tasks from timed tasks
  const allDayTasks = [];
  const timedTasksByHour = {};
  HOURS.forEach(h => { timedTasksByHour[h] = []; });

  dayTasks.forEach(task => {
    if (!task.time || task.time.trim() === '') {
      allDayTasks.push(task);
    } else {
      // Parse hour from time string (e.g., "09:30" or "9:30 AM" or "14:15")
      let hourNum = 9; // Default fallback
      const match = task.time.match(/(\d{1,2}):(\d{2})\s*(AM|PM)?/i);
      if (match) {
        let h = parseInt(match[1], 10);
        const isPM = match[3] && match[3].toUpperCase() === 'PM';
        const isAM = match[3] && match[3].toUpperCase() === 'AM';
        if (isPM && h < 12) h += 12;
        if (isAM && h === 12) h = 0;
        hourNum = Math.min(23, Math.max(0, h));
      }
      timedTasksByHour[hourNum].push(task);
    }
  });

  const formatHourLabel = (hour) => {
    if (hour === 0) return '12 AM';
    if (hour < 12) return `${hour} AM`;
    if (hour === 12) return '12 PM';
    return `${hour - 12} PM`;
  };

  const handlePrevDay = () => {
    onSelectDate(dateObj.subtract(1, 'day').format('YYYY-MM-DD'));
  };

  const handleNextDay = () => {
    onSelectDate(dateObj.add(1, 'day').format('YYYY-MM-DD'));
  };

  return (
    <View style={styles.container}>
      {/* Day Subheader with Navigator */}
      <View style={[styles.dayHeaderRow, { backgroundColor: colors.bgCard, borderBottomColor: colors.borderColor }]}>
        <TouchableOpacity style={styles.navBtn} onPress={handlePrevDay}>
          <IconChevronLeft color={colors.textPrimary} size={18} />
        </TouchableOpacity>

        <View style={styles.dayCenterInfo}>
          <Text style={[styles.dayTitleText, { color: isToday ? colors.primary : colors.textPrimary }]}>
            {dateObj.format('dddd, MMMM D, YYYY')}
          </Text>
          {isToday && (
            <View style={[styles.todayTag, { backgroundColor: isDark ? 'rgba(66, 133, 244, 0.2)' : 'rgba(66, 133, 244, 0.1)' }]}>
              <Text style={{ fontSize: 11, color: colors.primary, fontWeight: '700' }}>
                {t('Today') || 'Today'}
              </Text>
            </View>
          )}
        </View>

        <TouchableOpacity style={styles.navBtn} onPress={handleNextDay}>
          <IconChevronRight color={colors.textPrimary} size={18} />
        </TouchableOpacity>
      </View>

      {/* All-Day Tasks Section */}
      {allDayTasks.length > 0 && (
        <View style={[styles.allDaySection, { backgroundColor: isDark ? colors.surfaceContainer : '#f9f9f9', borderBottomColor: colors.borderColor }]}>
          <Text style={[styles.allDayLabel, { color: colors.textSecondary }]}>
            {t('All-day') || 'All-day'}
          </Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.allDayChipsScroll}>
            {allDayTasks.map(task => {
              const bId = task.boardId || 'main';
              const boardObj = boards.find(b => (b.id === bId || b._id === bId)) || { id: bId, name: 'Main' };
              const categoryColor = getBoardColor(boardObj, boards);
              const isCompleted = !!task.completed;

              return (
                <TouchableOpacity
                  key={task.id || task._id}
                  style={[
                    styles.allDayChip,
                    {
                      backgroundColor: isDark ? colors.surfaceContainerHigh : '#fff',
                      borderColor: colors.borderColor,
                      borderLeftColor: categoryColor,
                    }
                  ]}
                  onPress={() => onPressTask && onPressTask(task)}
                >
                  <TouchableOpacity 
                    style={{ paddingRight: 6 }} 
                    onPress={() => onToggleComplete && onToggleComplete(task)}
                  >
                    <IconCheckCircle checked={isCompleted} color={categoryColor} size={16} />
                  </TouchableOpacity>
                  <Text
                    style={[
                      styles.allDayChipText,
                      {
                        color: isCompleted ? colors.textSecondary : colors.textPrimary,
                        textDecorationLine: isCompleted ? 'line-through' : 'none'
                      }
                    ]}
                    numberOfLines={1}
                  >
                    {task.taskname}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>
      )}

      {/* 24-Hour Timeline Grid */}
      <ScrollView 
        ref={scrollViewRef}
        style={styles.timelineScroll}
        contentContainerStyle={styles.timelineContent}
        showsVerticalScrollIndicator={false}
      >
        {HOURS.map(hour => {
          const hourTasks = timedTasksByHour[hour] || [];
          const isCurrentHourSlot = isToday && currentHour === hour;
          const currentLineTop = isCurrentHourSlot ? Math.floor((currentMinute / 60) * 60) : 0;

          return (
            <View key={hour} style={[styles.hourRow, { borderBottomColor: colors.borderColor }]}>
              {/* Hour Label */}
              <View style={styles.hourLabelCol}>
                <Text style={[styles.hourLabelText, { color: colors.textSecondary }]}>
                  {formatHourLabel(hour)}
                </Text>
              </View>

              {/* Hour Slot Stage */}
              <TouchableOpacity
                activeOpacity={0.9}
                style={styles.hourStage}
                onPress={() => onQuickAddTaskAtHour && onQuickAddTaskAtHour(hour)}
              >
                {/* Red Current Time Line */}
                {isCurrentHourSlot && (
                  <View style={[styles.currentTimeLine, { top: currentLineTop }]}>
                    <View style={styles.currentTimeCircle} />
                    <View style={styles.currentTimeBar} />
                  </View>
                )}

                {/* Tasks in this hour */}
                {hourTasks.map(task => {
                  const bId = task.boardId || 'main';
                  const boardObj = boards.find(b => (b.id === bId || b._id === bId)) || { id: bId, name: 'Main' };
                  const categoryColor = getBoardColor(boardObj, boards);
                  const isCompleted = !!task.completed;

                  return (
                    <TouchableOpacity
                      key={task.id || task._id}
                      style={[
                        styles.timedTaskCard,
                        {
                          backgroundColor: isDark ? colors.surfaceContainer : colors.bgCard,
                          borderColor: colors.borderColor,
                          borderLeftColor: categoryColor,
                        }
                      ]}
                      onPress={() => onPressTask && onPressTask(task)}
                    >
                      <TouchableOpacity 
                        style={{ paddingRight: 8 }} 
                        onPress={() => onToggleComplete && onToggleComplete(task)}
                      >
                        <IconCheckCircle checked={isCompleted} color={categoryColor} size={18} />
                      </TouchableOpacity>

                      <View style={{ flex: 1 }}>
                        <Text
                          style={[
                            styles.timedTaskTitle,
                            {
                              color: isCompleted ? colors.textSecondary : colors.textPrimary,
                              textDecorationLine: isCompleted ? 'line-through' : 'none'
                            }
                          ]}
                          numberOfLines={1}
                        >
                          {task.taskname}
                        </Text>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 }}>
                          <IconClock color={colors.textSecondary} size={11} />
                          <Text style={{ fontSize: 11, color: colors.textSecondary }}>
                            {task.time}
                          </Text>
                        </View>
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </TouchableOpacity>
            </View>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  dayHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
  },
  navBtn: {
    padding: 8,
  },
  dayCenterInfo: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  dayTitleText: {
    fontSize: 15,
    fontWeight: '700',
  },
  todayTag: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
  },
  allDaySection: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
  },
  allDayLabel: {
    fontSize: 11,
    fontWeight: '700',
    marginBottom: 6,
    letterSpacing: 0.5,
  },
  allDayChipsScroll: {
    gap: 8,
  },
  allDayChip: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 8,
    borderWidth: 1,
    borderLeftWidth: 3.5,
    paddingVertical: 6,
    paddingHorizontal: 10,
    maxWidth: 220,
  },
  allDayChipText: {
    fontSize: 12,
    fontWeight: '600',
  },
  timelineScroll: {
    flex: 1,
  },
  timelineContent: {
    paddingBottom: 40,
  },
  hourRow: {
    flexDirection: 'row',
    minHeight: 60,
    borderBottomWidth: 0.5,
  },
  hourLabelCol: {
    width: 62,
    paddingRight: 8,
    paddingTop: 4,
    alignItems: 'flex-end',
  },
  hourLabelText: {
    fontSize: 11,
    fontWeight: '600',
  },
  hourStage: {
    flex: 1,
    borderLeftWidth: 1,
    borderLeftColor: 'rgba(128,128,128,0.2)',
    paddingLeft: 8,
    paddingVertical: 4,
    gap: 6,
    position: 'relative',
  },
  currentTimeLine: {
    position: 'absolute',
    left: -5,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    zIndex: 10,
  },
  currentTimeCircle: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#EA4335',
  },
  currentTimeBar: {
    flex: 1,
    height: 2,
    backgroundColor: '#EA4335',
  },
  timedTaskCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 8,
    borderWidth: 1,
    borderLeftWidth: 4,
    paddingVertical: 6,
    paddingHorizontal: 10,
    marginRight: 10,
  },
  timedTaskTitle: {
    fontSize: 13,
    fontWeight: '600',
  },
});
