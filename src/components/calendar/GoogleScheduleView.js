import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Platform } from 'react-native';
import dayjs from 'dayjs';
import { useTranslation } from 'react-i18next';
import { IconClock, IconAlarm, IconDotsVertical, IconCheckCircle } from './CalendarIcons';
import { getBoardColor } from '../../utils/boardColors';

export default function GoogleScheduleView({
  tasks = [],
  selectedDate,
  onSelectDate,
  onPressTask,
  onToggleComplete,
  onPressMore,
  boards = [],
  colors,
  isDark,
  searchQuery = ''
}) {
  const { t } = useTranslation();

  // Group tasks by completionDate / dateString
  // We want to show a span around today and scheduled dates
  const tasksByDate = {};
  tasks.forEach(task => {
    if (!task) return;
    const dateStr = task.dateString || (typeof task.completionDate === 'string' ? task.completionDate.split('T')[0] : null);
    if (!dateStr) return;
    if (!tasksByDate[dateStr]) tasksByDate[dateStr] = [];
    tasksByDate[dateStr].push(task);
  });

  // Collect and sort unique dates
  const sortedDates = Object.keys(tasksByDate).sort();

  // If selectedDate is not in the list, ensure it can still be displayed or today is included
  const todayStr = dayjs().format('YYYY-MM-DD');
  const allDisplayDates = Array.from(new Set([...sortedDates, todayStr, selectedDate])).sort();

  if (tasks.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <View style={[styles.emptyIconCircle, { backgroundColor: isDark ? 'rgba(66, 133, 244, 0.15)' : 'rgba(66, 133, 244, 0.08)' }]}>
          <Text style={{ fontSize: 36 }}>🗓️</Text>
        </View>
        <Text style={[styles.emptyTitle, { color: colors.textPrimary }]}>
          {searchQuery ? t('No matching tasks') || 'No matching tasks' : t('No tasks scheduled') || 'No tasks scheduled'}
        </Text>
        <Text style={[styles.emptySubtitle, { color: colors.textSecondary }]}>
          {t('Tap the + button to add a task to your calendar') || 'Tap the + button to add a task to your calendar'}
        </Text>
      </View>
    );
  }

  return (
    <ScrollView 
      style={styles.container} 
      contentContainerStyle={styles.scrollContent}
      showsVerticalScrollIndicator={false}
    >
      {allDisplayDates.map(dateStr => {
        const dayTasks = tasksByDate[dateStr] || [];
        if (dayTasks.length === 0 && dateStr !== todayStr && dateStr !== selectedDate) {
          return null; // Skip empty dates that are neither today nor selected
        }

        const dateObj = dayjs(dateStr);
        const isToday = dateStr === todayStr;
        const isSelected = dateStr === selectedDate;
        const dayOfWeek = dateObj.format('ddd').toUpperCase();
        const dayNum = dateObj.format('D');
        const monthShort = dateObj.format('MMM').toUpperCase();

        return (
          <View key={dateStr} style={styles.daySection}>
            {/* Left Date Column */}
            <TouchableOpacity 
              style={styles.dateColumn}
              onPress={() => onSelectDate && onSelectDate(dateStr)}
            >
              <Text style={[styles.dayOfWeekText, { color: isToday ? colors.primary : colors.textSecondary }]}>
                {dayOfWeek}
              </Text>
              <View style={[
                styles.dayNumBadge,
                isToday ? { backgroundColor: colors.primary } : isSelected ? { borderWidth: 1.5, borderColor: colors.primary } : null
              ]}>
                <Text style={[
                  styles.dayNumText,
                  { color: isToday ? '#ffffff' : colors.textPrimary, fontWeight: isToday ? 'bold' : '600' }
                ]}>
                  {dayNum}
                </Text>
              </View>
              {dateObj.date() === 1 && (
                <Text style={[styles.monthShortText, { color: colors.textSecondary }]}>
                  {monthShort}
                </Text>
              )}
            </TouchableOpacity>

            {/* Right Tasks Column */}
            <View style={styles.tasksColumn}>
              {dayTasks.length === 0 ? (
                <View style={[styles.emptyDayPill, { borderColor: colors.borderColor }]}>
                  <Text style={[styles.emptyDayText, { color: colors.textTertiary }]}>
                    {t('No tasks') || 'No tasks'}
                  </Text>
                </View>
              ) : (
                dayTasks.map(task => {
                  const bId = task.boardId || 'main';
                  const boardObj = boards.find(b => (b.id === bId || b._id === bId)) || { id: bId, name: bId === 'main' ? 'Main' : 'Board' };
                  const categoryColor = getBoardColor(boardObj, boards);
                  const isCompleted = !!task.completed;

                  return (
                    <TouchableOpacity
                      key={task.id || task._id}
                      activeOpacity={0.7}
                      style={[
                        styles.taskCard,
                        {
                          backgroundColor: isDark ? colors.surfaceContainer : colors.bgCard,
                          borderColor: colors.borderColor,
                          borderLeftColor: categoryColor,
                        }
                      ]}
                      onPress={() => onPressTask && onPressTask(task)}
                    >
                      {/* Checkbox */}
                      <TouchableOpacity
                        style={styles.checkboxTouch}
                        onPress={() => onToggleComplete && onToggleComplete(task)}
                      >
                        <IconCheckCircle checked={isCompleted} color={categoryColor} size={20} />
                      </TouchableOpacity>

                      {/* Content */}
                      <View style={styles.taskInfo}>
                        <Text
                          style={[
                            styles.taskTitle,
                            {
                              color: isCompleted ? colors.textSecondary : colors.textPrimary,
                              textDecorationLine: isCompleted ? 'line-through' : 'none',
                              opacity: isCompleted ? 0.65 : 1,
                            }
                          ]}
                          numberOfLines={2}
                        >
                          {task.taskname}
                        </Text>

                        {/* Meta info row: Time, Reminder, Category badge, Priority */}
                        <View style={styles.taskMetaRow}>
                          {task.reminder && task.reminder !== 'None' ? (
                            <View style={styles.timeBadge}>
                              <IconAlarm color={colors.textSecondary} size={12} />
                              <Text style={[styles.timeBadgeText, { color: colors.textSecondary }]}>
                                {task.reminder}
                              </Text>
                            </View>
                          ) : (task.time && task.time.trim() !== '') ? (
                            <View style={styles.timeBadge}>
                              <IconClock color={colors.textSecondary} size={12} />
                              <Text style={[styles.timeBadgeText, { color: colors.textSecondary }]}>
                                {task.time}
                              </Text>
                            </View>
                          ) : null}

                          <View style={styles.categoryDotPill}>
                            <View style={[styles.smallDot, { backgroundColor: categoryColor }]} />
                            <Text style={[styles.categoryPillText, { color: colors.textSecondary }]}>
                              {boardObj.name === 'Main' ? (t('Main') || 'Main') : boardObj.name}
                            </Text>
                          </View>

                          {task.priority && task.priority !== 'none' && (
                            <View style={[
                              styles.priorityChip,
                              {
                                backgroundColor: task.priority === 'high' 
                                  ? (isDark ? 'rgba(234, 67, 53, 0.25)' : '#FCE8E6')
                                  : (isDark ? 'rgba(251, 188, 4, 0.25)' : '#FEF7E0')
                              }
                            ]}>
                              <Text style={[
                                styles.priorityText,
                                {
                                  color: task.priority === 'high' ? '#D93025' : '#E37400'
                                }
                              ]}>
                                {task.priority.toUpperCase()}
                              </Text>
                            </View>
                          )}
                        </View>
                      </View>

                      {/* Options Button */}
                      <TouchableOpacity
                        style={styles.moreBtn}
                        onPress={() => onPressMore && onPressMore(task)}
                      >
                        <IconDotsVertical color={colors.textSecondary} size={16} />
                      </TouchableOpacity>
                    </TouchableOpacity>
                  );
                })
              )}
            </View>
          </View>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    paddingVertical: 12,
    paddingHorizontal: 12,
  },
  daySection: {
    flexDirection: 'row',
    marginBottom: 16,
  },
  dateColumn: {
    width: 52,
    alignItems: 'center',
    paddingTop: 4,
    marginRight: 8,
  },
  dayOfWeekText: {
    fontSize: 11,
    fontWeight: '700',
    marginBottom: 2,
    letterSpacing: 0.5,
  },
  dayNumBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayNumText: {
    fontSize: 15,
  },
  monthShortText: {
    fontSize: 10,
    fontWeight: 'bold',
    marginTop: 2,
  },
  tasksColumn: {
    flex: 1,
    gap: 8,
  },
  emptyDayPill: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderStyle: 'dashed',
    justifyContent: 'center',
  },
  emptyDayText: {
    fontSize: 12,
    fontStyle: 'italic',
  },
  taskCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 10,
    borderWidth: 1,
    borderLeftWidth: 4,
    paddingVertical: 10,
    paddingHorizontal: 12,
    elevation: 1,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 1 },
  },
  checkboxTouch: {
    paddingRight: 10,
    paddingVertical: 4,
  },
  taskInfo: {
    flex: 1,
  },
  taskTitle: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 4,
  },
  taskMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
  },
  timeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  timeBadgeText: {
    fontSize: 11,
    fontWeight: '500',
  },
  categoryDotPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  smallDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  categoryPillText: {
    fontSize: 11,
  },
  priorityChip: {
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 4,
  },
  priorityText: {
    fontSize: 9,
    fontWeight: '700',
  },
  moreBtn: {
    padding: 6,
    marginLeft: 4,
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  emptyIconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 8,
    textAlign: 'center',
  },
  emptySubtitle: {
    fontSize: 14,
    textAlign: 'center',
    maxWidth: 260,
    lineHeight: 20,
  },
});
