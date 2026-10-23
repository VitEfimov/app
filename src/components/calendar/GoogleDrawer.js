import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Animated, Dimensions, Platform } from 'react-native';
import dayjs from 'dayjs';
import { useTranslation } from 'react-i18next';
import {
  GooglePlusIcon,
  IconSchedule,
  IconDayView,
  IconMonthView,
  IconSettings,
  IconChevronLeft,
  IconChevronRight,
  IconClose
} from './CalendarIcons';
import { getBoardColor } from '../../utils/boardColors';

export default function GoogleDrawer({
  isOpen,
  onClose,
  currentDate,
  onSelectDate,
  activeView,
  onSelectView,
  boards = [],
  selectedCategoryIds = [],
  onToggleCategory,
  onSelectAllCategories,
  onOpenCreateCategory,
  onPressSettings,
  onPressSync,
  tasks = [],
  colors,
  isDark,
  isDesktop
}) {
  const { t } = useTranslation();
  const [miniCalMonth, setMiniCalMonth] = useState(dayjs(currentDate).startOf('month'));

  // Mini calendar calculation
  const startDay = miniCalMonth.startOf('month').startOf('week');
  const endDay = miniCalMonth.endOf('month').endOf('week');
  const daysInGrid = [];
  let dayCursor = startDay;
  while (dayCursor.isBefore(endDay) || dayCursor.isSame(endDay, 'day')) {
    daysInGrid.push(dayCursor);
    dayCursor = dayCursor.add(1, 'day');
  }

  // Count tasks per board/category
  const taskCountByBoard = {};
  tasks.forEach(t => {
    const bId = t.boardId || 'main';
    taskCountByBoard[bId] = (taskCountByBoard[bId] || 0) + 1;
  });

  const allCategoriesSelected = boards.length > 0 && boards.every(b => {
    const id = b.id || b._id || 'main';
    return selectedCategoryIds.includes(id);
  });

  const drawerContent = (
    <View style={[styles.drawerContainer, { backgroundColor: colors.bgCard, borderRightColor: colors.borderColor }]}>
      {/* App Branding & Title */}
      <View style={styles.brandRow}>
        <View style={styles.logoPill}>
          <Text style={{ fontSize: 20 }}>📅</Text>
        </View>
        <Text style={[styles.brandTitle, { color: colors.textPrimary }]}>
          {t('Calendar') || 'Calendar'}
        </Text>
        {!isDesktop && (
          <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
            <IconClose color={colors.textSecondary} size={20} />
          </TouchableOpacity>
        )}
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        {/* Extended Google "+ Create" Pill Button */}
        <TouchableOpacity
          accessible={true}
          accessibilityLabel="Create task"
          accessibilityRole="button"
          style={[styles.createBtn, { backgroundColor: isDark ? colors.surfaceContainerHighest : '#ffffff', borderColor: colors.borderColor }]}
          onPress={() => {
            if (!isDesktop) onClose();
            onOpenCreateCategory && onOpenCreateCategory('task');
          }}
        >
          <GooglePlusIcon size={24} />
          <Text style={[styles.createBtnText, { color: colors.textPrimary }]}>
            {t('Create') || 'Create'}
          </Text>
        </TouchableOpacity>

        {/* Mini Calendar Header */}
        <View style={styles.miniCalHeader}>
          <Text style={[styles.miniCalMonthText, { color: colors.textPrimary }]}>
            {miniCalMonth.format('MMMM YYYY')}
          </Text>
          <View style={styles.miniCalNavBtns}>
            <TouchableOpacity 
              style={styles.miniNavBtn} 
              onPress={() => setMiniCalMonth(prev => prev.subtract(1, 'month'))}
            >
              <IconChevronLeft color={colors.textSecondary} size={16} />
            </TouchableOpacity>
            <TouchableOpacity 
              style={styles.miniNavBtn} 
              onPress={() => setMiniCalMonth(prev => prev.add(1, 'month'))}
            >
              <IconChevronRight color={colors.textSecondary} size={16} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Mini Calendar Day-of-week header */}
        <View style={styles.weekDaysRow}>
          {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((wd, idx) => (
            <Text key={idx} style={[styles.weekDayText, { color: colors.textSecondary }]}>
              {wd}
            </Text>
          ))}
        </View>

        {/* Mini Calendar Grid */}
        <View style={styles.daysGrid}>
          {daysInGrid.map((day, idx) => {
            const isCurrentMonth = day.month() === miniCalMonth.month();
            const isSelected = day.isSame(dayjs(currentDate), 'day');
            const isToday = day.isSame(dayjs(), 'day');

            return (
              <TouchableOpacity
                key={idx}
                style={[
                  styles.miniDayCell,
                  isSelected ? { backgroundColor: colors.primary } : isToday ? { backgroundColor: isDark ? 'rgba(66, 133, 244, 0.25)' : 'rgba(66, 133, 244, 0.15)' } : null
                ]}
                onPress={() => {
                  onSelectDate(day.format('YYYY-MM-DD'));
                  if (!isDesktop) onClose();
                }}
              >
                <Text style={[
                  styles.miniDayText,
                  {
                    color: isSelected 
                      ? (colors.textInverse || '#ffffff') 
                      : isToday 
                      ? colors.primary 
                      : !isCurrentMonth 
                      ? colors.textTertiary 
                      : colors.textPrimary,
                    fontWeight: isSelected || isToday ? 'bold' : 'normal'
                  }
                ]}>
                  {day.date()}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <View style={[styles.divider, { backgroundColor: colors.borderColor }]} />



        {/* My Calendars / Categories */}
        <View style={styles.categoriesHeaderRow}>
          <Text style={[styles.sectionHeading, { color: colors.textSecondary }]}>
            {t('My Calendars') || 'MY CALENDARS'}
          </Text>
          <TouchableOpacity 
            onPress={() => onOpenCreateCategory && onOpenCreateCategory('category')}
            style={styles.addCategoryBtn}
          >
            <Text style={{ fontSize: 18, color: colors.primary, fontWeight: 'bold' }}>+</Text>
          </TouchableOpacity>
        </View>

        {boards.map(board => {
          const boardId = board.id || board._id || 'main';
          const isSelected = selectedCategoryIds.length === 0 || selectedCategoryIds.includes(boardId);
          const boardColor = getBoardColor(board, boards);
          const count = taskCountByBoard[boardId] || 0;

          return (
            <TouchableOpacity
              key={boardId}
              style={styles.categoryRow}
              onPress={() => onToggleCategory(boardId)}
            >
              <View style={[
                styles.categoryCheckbox,
                {
                  borderColor: boardColor,
                  backgroundColor: isSelected ? boardColor : 'transparent'
                }
              ]}>
                {isSelected && <Text style={{ color: '#fff', fontSize: 10, fontWeight: 'bold' }}>✓</Text>}
              </View>

              <Text style={[styles.categoryName, { color: colors.textPrimary }]} numberOfLines={1}>
                {board.name === 'Main' ? (t('Main') || 'Main') : board.name}
              </Text>

              {count > 0 && (
                <View style={[styles.categoryCountBadge, { backgroundColor: colors.surfaceContainerHigh }]}>
                  <Text style={[styles.categoryCountText, { color: colors.textSecondary }]}>
                    {count}
                  </Text>
                </View>
              )}
            </TouchableOpacity>
          );
        })}

        <View style={[styles.divider, { backgroundColor: colors.borderColor }]} />

        {/* Settings & Extras */}
        <TouchableOpacity
          style={styles.navItemRow}
          onPress={() => {
            if (!isDesktop) onClose();
            onPressSettings && onPressSettings();
          }}
        >
          <IconSettings color={colors.textSecondary} size={18} />
          <Text style={[styles.navItemText, { color: colors.textPrimary }]}>
            {t('Settings') || 'Settings'}
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );

  if (isDesktop) {
    return <View style={styles.desktopWrapper}>{drawerContent}</View>;
  }

  if (!isOpen) return null;

  return (
    <View style={StyleSheet.absoluteFillObject} pointerEvents="box-none">
      <TouchableOpacity 
        style={styles.backdrop} 
        activeOpacity={1} 
        onPress={onClose} 
      />
      <View style={styles.mobileDrawerWrapper}>
        {drawerContent}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  desktopWrapper: {
    width: 256,
    height: '100%',
    zIndex: 5,
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
    zIndex: 100,
  },
  mobileDrawerWrapper: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    width: 280,
    zIndex: 101,
    elevation: 16,
    shadowColor: '#000',
    shadowOpacity: 0.35,
    shadowRadius: 16,
    shadowOffset: { width: 4, height: 0 },
  },
  drawerContainer: {
    flex: 1,
    borderRightWidth: 1,
    paddingTop: Platform.OS === 'ios' ? 44 : 12,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  logoPill: {
    width: 34,
    height: 34,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  brandTitle: {
    fontSize: 20,
    fontWeight: '700',
    flex: 1,
  },
  closeBtn: {
    padding: 6,
  },
  scrollContent: {
    paddingHorizontal: 12,
    paddingBottom: 24,
  },
  createBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 24,
    borderWidth: 1,
    paddingVertical: 10,
    paddingHorizontal: 16,
    marginVertical: 12,
    alignSelf: 'flex-start',
    gap: 12,
    elevation: 3,
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
  },
  createBtnText: {
    fontSize: 14,
    fontWeight: '600',
  },
  miniCalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 6,
    paddingHorizontal: 4,
  },
  miniCalMonthText: {
    fontSize: 14,
    fontWeight: '700',
  },
  miniCalNavBtns: {
    flexDirection: 'row',
    gap: 4,
  },
  miniNavBtn: {
    padding: 4,
  },
  weekDaysRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 4,
  },
  weekDayText: {
    width: 28,
    textAlign: 'center',
    fontSize: 11,
    fontWeight: '600',
  },
  daysGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  miniDayCell: {
    width: `${100 / 7}%`,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 1,
  },
  miniDayText: {
    fontSize: 12,
  },
  divider: {
    height: 1,
    marginVertical: 14,
  },
  sectionHeading: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.8,
    marginBottom: 8,
    paddingHorizontal: 6,
  },
  navItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 18,
    marginBottom: 3,
    gap: 12,
  },
  navItemText: {
    fontSize: 13,
  },
  categoriesHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  addCategoryBtn: {
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  categoryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 7,
    paddingHorizontal: 8,
    borderRadius: 8,
  },
  categoryCheckbox: {
    width: 16,
    height: 16,
    borderRadius: 4,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  categoryName: {
    fontSize: 13,
    flex: 1,
  },
  categoryCountBadge: {
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 10,
  },
  categoryCountText: {
    fontSize: 10,
    fontWeight: '600',
  },
});
