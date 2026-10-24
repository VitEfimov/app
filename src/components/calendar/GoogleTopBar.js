import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, Platform, Modal, Image, useWindowDimensions } from 'react-native';
import dayjs from 'dayjs';
import { useTranslation } from 'react-i18next';
import {
  IconMenu,
  IconSearch,
  IconToday,
  IconChevronDown,
  IconChevronLeft,
  IconChevronRight,
  IconClose,
  IconSchedule,
  IconDayView,
  IconMonthView,
  IconSettings
} from './CalendarIcons';

export default function GoogleTopBar({
  currentDate,
  onPressMenu,
  onPressToday,
  onPressPrevMonth,
  onPressNextMonth,
  onPressMonthPicker,
  activeView,
  onSelectView,
  searchQuery,
  onSearchChange,
  colors,
  isDark,
  onToggleTheme,
  onPressSettings,
  isDesktop,
  showViewSelector = false
}) {
  const { t } = useTranslation();
  const { width: windowWidth } = useWindowDimensions();
  const isDesktopWidth = windowWidth >= 768;
  const isMediumWidth = windowWidth >= 540;

  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isViewMenuOpen, setIsViewMenuOpen] = useState(false);

  const monthYearLabel = dayjs(currentDate).format('MMMM YYYY');
  const isToday = dayjs(currentDate).isSame(dayjs(), 'day');

  const viewOptions = [
    { id: 'schedule', label: t('Schedule') || 'Schedule', icon: IconSchedule },
    { id: 'day', label: t('Day') || 'Day', icon: IconDayView },
    { id: 'month', label: t('Month') || 'Month', icon: IconMonthView }
  ];

  const currentViewObj = viewOptions.find(v => v.id === activeView) || viewOptions[0];

  return (
    <View style={[styles.headerContainer, { backgroundColor: colors.bgHeader, borderBottomColor: colors.borderColor }]}>
      {isSearchOpen ? (
        <View style={styles.searchBarRow}>
          <TouchableOpacity 
            style={styles.iconBtn} 
            onPress={() => {
              setIsSearchOpen(false);
              onSearchChange('');
            }}
          >
            <IconClose color={colors.textPrimary} size={20} />
          </TouchableOpacity>
          <TextInput
            style={[styles.searchInput, { color: colors.textPrimary }]}
            placeholder={t('Search tasks...') || 'Search tasks...'}
            placeholderTextColor={colors.textSecondary}
            value={searchQuery}
            onChangeText={onSearchChange}
            autoFocus={true}
          />
          {searchQuery ? (
            <TouchableOpacity style={styles.iconBtn} onPress={() => onSearchChange('')}>
              <IconClose color={colors.textSecondary} size={18} />
            </TouchableOpacity>
          ) : null}
        </View>
      ) : (
        <View style={styles.standardHeaderRow}>
          {/* Left: Hamburger + Brand (+ Month Selector on medium/desktop) */}
          <View style={styles.leftGroup}>
            <TouchableOpacity
              accessible={true}
              accessibilityLabel="Open navigation menu"
              accessibilityRole="button"
              style={styles.iconBtn}
              onPress={onPressMenu}
            >
              <IconMenu color={colors.textPrimary} size={22} />
            </TouchableOpacity>

            <View style={styles.brandGroup}>
              <Image 
                source={require('../../../assets/favicon.png')} 
                style={styles.brandIcon} 
                resizeMode="contain"
              />
              <Text style={[styles.brandNameText, { color: colors.textPrimary }]} numberOfLines={1}>
                TaskCalendar
              </Text>
            </View>

            {/* Month/Year Dropdown on medium and desktop screens */}
            {isMediumWidth && (
              <TouchableOpacity
                accessible={true}
                accessibilityLabel="Select month and year"
                accessibilityRole="button"
                style={[styles.monthSelectorBtn, { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)' }]}
                onPress={onPressMonthPicker}
              >
                <Text style={[styles.monthText, { color: colors.textPrimary }]} numberOfLines={1}>
                  {monthYearLabel}
                </Text>
                <IconChevronDown color={colors.primary} size={15} />
              </TouchableOpacity>
            )}

            {/* Desktop Month Chevrons */}
            {isDesktopWidth && onPressPrevMonth && (
              <TouchableOpacity
                accessible={true}
                accessibilityLabel="Previous month"
                accessibilityRole="button"
                style={styles.iconBtn}
                onPress={onPressPrevMonth}
              >
                <IconChevronLeft color={colors.textPrimary} size={18} />
              </TouchableOpacity>
            )}

            {isDesktopWidth && onPressNextMonth && (
              <TouchableOpacity
                accessible={true}
                accessibilityLabel="Next month"
                accessibilityRole="button"
                style={styles.iconBtn}
                onPress={onPressNextMonth}
              >
                <IconChevronRight color={colors.textPrimary} size={18} />
              </TouchableOpacity>
            )}
          </View>

          {/* Right: Today + Search + Theme + Settings (Always pinned and visible) */}
          <View style={styles.rightGroup}>
            <TouchableOpacity
              accessible={true}
              accessibilityLabel="Go to today"
              accessibilityRole="button"
              style={[
                styles.todayBtn,
                {
                  borderColor: isToday ? colors.primary : colors.borderColor,
                  backgroundColor: isToday ? (isDark ? 'rgba(66, 133, 244, 0.15)' : 'rgba(66, 133, 244, 0.08)') : 'transparent'
                }
              ]}
              onPress={onPressToday}
            >
              <Text style={[styles.todayText, { color: isToday ? colors.primary : colors.textPrimary }]}>
                {t('Today') || 'Today'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              accessible={true}
              accessibilityLabel="Search tasks"
              accessibilityRole="button"
              style={styles.iconBtn}
              onPress={() => setIsSearchOpen(true)}
            >
              <IconSearch color={colors.textPrimary} size={19} />
            </TouchableOpacity>

            {/* View Selector Menu Pill */}
            {showViewSelector && (
              <TouchableOpacity
                accessible={true}
                accessibilityLabel={`View selector: currently ${currentViewObj.label}`}
                accessibilityRole="button"
                style={[styles.viewSelectorBtn, { borderColor: colors.borderColor, backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : '#fff' }]}
                onPress={() => setIsViewMenuOpen(true)}
              >
                <currentViewObj.icon color={colors.primary} size={15} />
                <Text style={[styles.viewSelectorText, { color: colors.textPrimary }]}>
                  {currentViewObj.label}
                </Text>
                <IconChevronDown color={colors.textSecondary} size={13} />
              </TouchableOpacity>
            )}

            {/* Theme Toggle */}
            <TouchableOpacity
              accessible={true}
              accessibilityLabel="Toggle theme"
              accessibilityRole="button"
              style={styles.iconBtn}
              onPress={onToggleTheme}
            >
              <Text style={{ fontSize: 16 }}>{isDark ? '🌙' : '☀️'}</Text>
            </TouchableOpacity>

            {/* Settings */}
            <TouchableOpacity
              accessible={true}
              accessibilityLabel="Settings"
              accessibilityRole="button"
              style={styles.iconBtn}
              onPress={onPressSettings}
            >
              <IconSettings color={colors.textPrimary} size={19} />
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* View Switcher Modal Dropdown */}
      <Modal
        visible={isViewMenuOpen}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setIsViewMenuOpen(false)}
      >
        <TouchableOpacity 
          style={styles.modalBackdrop} 
          activeOpacity={1} 
          onPress={() => setIsViewMenuOpen(false)}
        >
          <View style={[styles.viewDropdownMenu, { backgroundColor: colors.bgCard, borderColor: colors.borderColor }]}>
            {viewOptions.map((view) => {
              const isSelected = activeView === view.id;
              const IconComp = view.icon;
              return (
                <TouchableOpacity
                  key={view.id}
                  style={[
                    styles.viewDropdownItem,
                    isSelected ? { backgroundColor: isDark ? 'rgba(66, 133, 244, 0.2)' : 'rgba(66, 133, 244, 0.1)' } : null
                  ]}
                  onPress={() => {
                    onSelectView(view.id);
                    setIsViewMenuOpen(false);
                  }}
                >
                  <IconComp color={isSelected ? colors.primary : colors.textSecondary} size={18} />
                  <Text style={[
                    styles.viewDropdownText,
                    { color: isSelected ? colors.primary : colors.textPrimary, fontWeight: isSelected ? '700' : '500' }
                  ]}>
                    {view.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  headerContainer: {
    height: 56,
    borderBottomWidth: 1,
    paddingHorizontal: 8,
    justifyContent: 'center',
    zIndex: 10,
  },
  standardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  leftGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    flexShrink: 1,
    minWidth: 0,
    overflow: 'hidden',
  },
  brandGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 6,
    marginLeft: 2,
    flexShrink: 1,
    minWidth: 0,
  },
  brandIcon: {
    width: 24,
    height: 24,
    borderRadius: 6,
    marginRight: 6,
    flexShrink: 0,
  },
  brandNameText: {
    fontSize: 17,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  rightGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    flexShrink: 0,
  },
  iconBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  monthSelectorBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 5,
    paddingHorizontal: 8,
    borderRadius: 8,
    marginLeft: 2,
    marginRight: 4,
    flexShrink: 0,
  },
  monthText: {
    fontSize: 15,
    fontWeight: '700',
    marginRight: 4,
  },
  todayBtn: {
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 14,
    borderWidth: 1,
    marginRight: 2,
  },
  todayText: {
    fontSize: 13,
    fontWeight: '600',
  },
  viewSelectorBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 8,
    borderWidth: 1,
    marginRight: 4,
    gap: 6,
  },
  viewSelectorText: {
    fontSize: 13,
    fontWeight: '600',
  },
  searchBarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    paddingVertical: 6,
    paddingHorizontal: 10,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.3)',
    justifyContent: 'flex-start',
    alignItems: 'flex-end',
    paddingTop: 60,
    paddingRight: 16,
  },
  viewDropdownMenu: {
    width: 170,
    borderRadius: 12,
    borderWidth: 1,
    paddingVertical: 6,
    elevation: 8,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
  },
  viewDropdownItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 14,
    gap: 10,
  },
  viewDropdownText: {
    fontSize: 14,
  },
});
