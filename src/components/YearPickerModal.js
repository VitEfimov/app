import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Modal as RNModal,
  useWindowDimensions,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import dayjs from 'dayjs';

const capitalize = (str) => {
  if (!str) return '';
  return str.charAt(0).toUpperCase() + str.slice(1);
};

export const parseCalendarHeaderDate = (date, fallbackDateStr) => {
  if (date) {
    if (typeof date.getFullYear === 'function' && typeof date.getMonth === 'function') {
      const y = date.getFullYear();
      const m = date.getMonth(); // 0-11
      const pad = String(m + 1).padStart(2, '0');
      return dayjs(`${y}-${pad}-01`);
    }
    if (typeof date.toString === 'function') {
      try {
        const str = date.toString('yyyy-MM-dd');
        if (str && /^\d{4}-\d{2}-\d{2}/.test(str)) {
          return dayjs(str.slice(0, 10));
        }
      } catch (e) {}
    }
    if (date.dateString) {
      return dayjs(date.dateString);
    }
    if (typeof date === 'string') {
      return dayjs(date);
    }
  }
  return dayjs(fallbackDateStr || dayjs().format('YYYY-MM-DD'));
};

export function YearPickerModal({
  isVisible,
  onClose,
  currentYear,
  currentMonth,
  onSelectYear,
  onSelectMonthYear,
  colors = {},
  minYear = 2020,
  maxYear = 2040,
}) {
  const { t, i18n } = useTranslation();
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();

  const [selectedYear, setSelectedYear] = useState(
    () => Number(currentYear) || dayjs().year()
  );
  const [selectedMonth, setSelectedMonth] = useState(() =>
    typeof currentMonth === 'number' && currentMonth >= 0 && currentMonth <= 11
      ? currentMonth
      : dayjs().month()
  );
  const [activeTab, setActiveTab] = useState('month'); // 'month' | 'year'

  // Sync internal state when modal opens or props change
  useEffect(() => {
    if (isVisible) {
      if (currentYear) {
        setSelectedYear(Number(currentYear));
      }
      if (typeof currentMonth === 'number' && currentMonth >= 0 && currentMonth <= 11) {
        setSelectedMonth(Number(currentMonth));
      }
    }
  }, [isVisible, currentYear, currentMonth]);

  const isContrast = colors?.bgMain === '#000000' || colors?.textPrimary === '#FFFFFF' && colors?.bgCard === '#000000';

  // Localized name of the currently selected month
  const selectedMonthName = useMemo(() => {
    return capitalize(dayjs().month(selectedMonth).format('MMMM'));
  }, [selectedMonth, i18n?.language]);

  // Next 5 Months Hot Taps
  const hotMonths = useMemo(() => {
    const base = dayjs();
    const list = [];
    for (let i = 0; i < 5; i++) {
      const d = base.add(i, 'month');
      list.push({
        label: `${capitalize(d.format('MMM'))} ${d.format('YYYY')}`,
        year: d.year(),
        month: d.month(),
      });
    }
    return list;
  }, [i18n?.language]);

  // Next 5 Years Hot Taps
  const hotYears = useMemo(() => {
    const baseYear = dayjs().year();
    const list = [];
    for (let i = 0; i < 5; i++) {
      const y = baseYear + i;
      list.push({
        label: String(y),
        year: y,
      });
    }
    return list;
  }, []);

  // 12 Months List for 3x4 Grid
  const months = useMemo(() => {
    return Array.from({ length: 12 }, (_, index) => {
      const mDate = dayjs().month(index);
      return {
        index,
        shortName: capitalize(mDate.format('MMM')),
        fullName: capitalize(mDate.format('MMMM')),
      };
    });
  }, [i18n?.language]);

  // Years List for Grid
  const years = useMemo(() => {
    const list = [];
    const min = Math.min(Number(minYear) || 2020, selectedYear);
    const max = Math.max(Number(maxYear) || 2040, selectedYear);
    for (let y = min; y <= max; y++) {
      list.push(y);
    }
    return list;
  }, [minYear, maxYear, selectedYear]);

  // Hot Tap: Quick Apply Month & Year immediately
  const handleHotMonthPress = (hot) => {
    setSelectedYear(hot.year);
    setSelectedMonth(hot.month);
    if (typeof onSelectMonthYear === 'function') {
      onSelectMonthYear(hot.year, hot.month);
    } else if (typeof onSelectYear === 'function') {
      onSelectYear(hot.year);
    }
    onClose();
  };

  // Hot Tap: Quick Apply Year immediately
  const handleHotYearPress = (hot) => {
    setSelectedYear(hot.year);
    if (typeof onSelectMonthYear === 'function') {
      onSelectMonthYear(hot.year, selectedMonth);
    } else if (typeof onSelectYear === 'function') {
      onSelectYear(hot.year);
    }
    onClose();
  };

  // Confirm manual selection
  const handleApply = () => {
    if (typeof onSelectMonthYear === 'function') {
      onSelectMonthYear(selectedYear, selectedMonth);
    } else if (typeof onSelectYear === 'function') {
      onSelectYear(selectedYear);
    }
    onClose();
  };

  return (
    <RNModal
      visible={Boolean(isVisible)}
      transparent={true}
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={[styles.sheetOverlay, { width: windowWidth, height: windowHeight }]}>
        <TouchableOpacity
          style={{ flex: 1, width: windowWidth }}
          activeOpacity={1}
          onPress={onClose}
        />
        <View
          style={[
            styles.content,
            {
              backgroundColor: isContrast
                ? '#000000'
                : (colors.bgCard || '#1e1e1e'),
              borderColor: isContrast ? '#FFFFFF' : 'transparent',
              borderWidth: isContrast ? 2 : 0,
              width: windowWidth,
            },
          ]}
        >
        {/* Drag Handle */}
        <View style={styles.dragHandleContainer}>
          <View
            style={[
              styles.dragHandle,
              { backgroundColor: colors.textSecondary || '#888' },
            ]}
          />
        </View>

        {/* Modal Header */}
        <View style={styles.headerRow}>
          <Text
            style={[
              styles.title,
              { color: colors.textPrimary || '#fff' },
            ]}
          >
            {`${selectedMonthName} ${selectedYear}`}
          </Text>
          <TouchableOpacity
            accessible={true}
            accessibilityRole="button"
            accessibilityLabel={t('Cancel') || 'Close'}
            style={styles.closeBtn}
            onPress={onClose}
          >
            <Text
              style={[
                styles.closeBtnText,
                { color: colors.textSecondary || '#888' },
              ]}
            >
              ✕
            </Text>
          </TouchableOpacity>
        </View>

        {/* 1. HOT TAPS: Next 5 Months */}
        <View style={styles.hotSection}>
          <Text
            style={[
              styles.hotSectionTitle,
              { color: colors.textSecondary || '#888' },
            ]}
          >
            ⚡ {t('Next 5 Months') || 'Next 5 Months'}
          </Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.hotChipsScroll}
          >
            {hotMonths.map((hot) => {
              const isSelected =
                hot.month === selectedMonth && hot.year === selectedYear;
              return (
                <TouchableOpacity
                  key={`hot_m_${hot.year}_${hot.month}`}
                  testID={`hot_month_${hot.year}_${hot.month}`}
                  accessible={true}
                  accessibilityRole="button"
                  accessibilityLabel={`Quick select ${hot.label}`}
                  accessibilityState={{ selected: isSelected }}
                  activeOpacity={0.7}
                  style={[
                    styles.hotChip,
                    {
                      borderColor: isContrast
                        ? isSelected
                          ? '#FFFFFF'
                          : '#666666'
                        : isSelected
                        ? colors.primary || '#6200ee'
                        : colors.borderColor || 'rgba(128,128,128,0.25)',
                      backgroundColor: isContrast
                        ? isSelected
                          ? '#FFFFFF'
                          : 'transparent'
                        : isSelected
                        ? colors.primary || '#6200ee'
                        : colors.bgMain || 'rgba(0,0,0,0.04)',
                    },
                  ]}
                  onPress={() => handleHotMonthPress(hot)}
                >
                  <Text
                    style={[
                      styles.hotChipText,
                      {
                        color: isContrast
                          ? isSelected
                            ? '#000000'
                            : '#FFFFFF'
                          : isSelected
                          ? colors.textInverse || '#FFFFFF'
                          : colors.textPrimary || '#FFFFFF',
                        fontWeight: isSelected ? '700' : '600',
                      },
                    ]}
                  >
                    {hot.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>

        {/* 2. HOT TAPS: Next 5 Years */}
        <View style={styles.hotSection}>
          <Text
            style={[
              styles.hotSectionTitle,
              { color: colors.textSecondary || '#888' },
            ]}
          >
            ⚡ {t('Next 5 Years') || 'Next 5 Years'}
          </Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.hotChipsScroll}
          >
            {hotYears.map((hot) => {
              const isSelected = hot.year === selectedYear;
              return (
                <TouchableOpacity
                  key={`hot_y_${hot.year}`}
                  testID={`hot_year_${hot.year}`}
                  accessible={true}
                  accessibilityRole="button"
                  accessibilityLabel={`Quick select year ${hot.year}`}
                  accessibilityState={{ selected: isSelected }}
                  activeOpacity={0.7}
                  style={[
                    styles.hotChip,
                    {
                      borderColor: isContrast
                        ? isSelected
                          ? '#FFFFFF'
                          : '#666666'
                        : isSelected
                        ? colors.primary || '#6200ee'
                        : colors.borderColor || 'rgba(128,128,128,0.25)',
                      backgroundColor: isContrast
                        ? isSelected
                          ? '#FFFFFF'
                          : 'transparent'
                        : isSelected
                        ? colors.primary || '#6200ee'
                        : colors.bgMain || 'rgba(0,0,0,0.04)',
                    },
                  ]}
                  onPress={() => handleHotYearPress(hot)}
                >
                  <Text
                    style={[
                      styles.hotChipText,
                      {
                        color: isContrast
                          ? isSelected
                            ? '#000000'
                            : '#FFFFFF'
                          : isSelected
                          ? colors.textInverse || '#FFFFFF'
                          : colors.textPrimary || '#FFFFFF',
                        fontWeight: isSelected ? '700' : '600',
                      },
                    ]}
                  >
                    {hot.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>

        {/* 3. SEGMENTED TABS: Month vs Year */}
        <View
          style={[
            styles.tabContainer,
            {
              backgroundColor: isContrast
                ? '#111111'
                : colors.bgMain || 'rgba(0,0,0,0.05)',
              borderColor: isContrast
                ? '#FFFFFF'
                : colors.borderColor || 'rgba(128,128,128,0.2)',
              borderWidth: isContrast ? 1.5 : 1,
            },
          ]}
        >
          <TouchableOpacity
            testID="tab_month_picker"
            accessible={true}
            accessibilityRole="tab"
            accessibilityLabel={`Month tab, currently ${selectedMonthName}`}
            accessibilityState={{ selected: activeTab === 'month' }}
            style={[
              styles.tabBtn,
              activeTab === 'month' && [
                styles.activeTabBtn,
                {
                  backgroundColor: isContrast
                    ? '#FFFFFF'
                    : colors.primary || '#6200ee',
                },
              ],
            ]}
            onPress={() => setActiveTab('month')}
          >
            <Text
              style={[
                styles.tabText,
                {
                  color:
                    activeTab === 'month'
                      ? isContrast
                        ? '#000000'
                        : colors.textInverse || '#FFFFFF'
                      : colors.textPrimary || '#FFFFFF',
                  fontWeight: activeTab === 'month' ? '700' : '600',
                },
              ]}
            >
              🗓 {t('Month') || 'Month'}: {selectedMonthName}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            testID="tab_year_picker"
            accessible={true}
            accessibilityRole="tab"
            accessibilityLabel={`Year tab, currently ${selectedYear}`}
            accessibilityState={{ selected: activeTab === 'year' }}
            style={[
              styles.tabBtn,
              activeTab === 'year' && [
                styles.activeTabBtn,
                {
                  backgroundColor: isContrast
                    ? '#FFFFFF'
                    : colors.primary || '#6200ee',
                },
              ],
            ]}
            onPress={() => setActiveTab('year')}
          >
            <Text
              style={[
                styles.tabText,
                {
                  color:
                    activeTab === 'year'
                      ? isContrast
                        ? '#000000'
                        : colors.textInverse || '#FFFFFF'
                      : colors.textPrimary || '#FFFFFF',
                  fontWeight: activeTab === 'year' ? '700' : '600',
                },
              ]}
            >
              📅 {t('year') || 'Year'}: {selectedYear}
            </Text>
          </TouchableOpacity>
        </View>

        {/* 4. SELECTOR CONTENT: 3x4 Month Grid or Year Grid */}
        {activeTab === 'month' ? (
          <View style={styles.gridContainer}>
            {months.map((m) => {
              const isSelected = m.index === selectedMonth;
              return (
                <TouchableOpacity
                  key={`month_${m.index}`}
                  testID={`month_option_${m.index}`}
                  accessible={true}
                  accessibilityRole="button"
                  accessibilityLabel={`Select month ${m.fullName}`}
                  accessibilityState={{ selected: isSelected }}
                  activeOpacity={0.7}
                  style={[
                    styles.gridCell,
                    {
                      borderColor: isContrast
                        ? isSelected
                          ? '#FFFFFF'
                          : '#444444'
                        : isSelected
                        ? colors.primary || '#6200ee'
                        : colors.borderColor || 'rgba(128,128,128,0.2)',
                      backgroundColor: isContrast
                        ? isSelected
                          ? '#FFFFFF'
                          : 'transparent'
                        : isSelected
                        ? colors.primary || '#6200ee'
                        : 'transparent',
                      borderWidth: isContrast ? 1.5 : 1,
                    },
                  ]}
                  onPress={() => setSelectedMonth(m.index)}
                >
                  <Text
                    style={[
                      styles.cellText,
                      {
                        color: isContrast
                          ? isSelected
                            ? '#000000'
                            : '#FFFFFF'
                          : isSelected
                          ? colors.textInverse || '#FFFFFF'
                          : colors.textPrimary || '#FFFFFF',
                        fontWeight: isSelected ? '700' : '500',
                      },
                    ]}
                    numberOfLines={1}
                  >
                    {m.fullName}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        ) : (
          <ScrollView
            style={styles.yearScroll}
            contentContainerStyle={styles.gridContainer}
            nestedScrollEnabled={true}
            showsVerticalScrollIndicator={true}
          >
            {years.map((year) => {
              const isSelected = year === selectedYear;
              return (
                <TouchableOpacity
                  key={`year_${year}`}
                  testID={`year_option_${year}`}
                  accessible={true}
                  accessibilityRole="button"
                  accessibilityLabel={`Select year ${year}`}
                  accessibilityState={{ selected: isSelected }}
                  activeOpacity={0.7}
                  style={[
                    styles.gridCell,
                    {
                      borderColor: isContrast
                        ? isSelected
                          ? '#FFFFFF'
                          : '#444444'
                        : isSelected
                        ? colors.primary || '#6200ee'
                        : colors.borderColor || 'rgba(128,128,128,0.2)',
                      backgroundColor: isContrast
                        ? isSelected
                          ? '#FFFFFF'
                          : 'transparent'
                        : isSelected
                        ? colors.primary || '#6200ee'
                        : 'transparent',
                      borderWidth: isContrast ? 1.5 : 1,
                    },
                  ]}
                  onPress={() => setSelectedYear(year)}
                >
                  <Text
                    style={[
                      styles.cellText,
                      {
                        color: isContrast
                          ? isSelected
                            ? '#000000'
                            : '#FFFFFF'
                          : isSelected
                          ? colors.textInverse || '#FFFFFF'
                          : colors.textPrimary || '#FFFFFF',
                        fontWeight: isSelected ? '700' : '500',
                      },
                    ]}
                  >
                    {year}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        )}

        {/* 5. FOOTER BUTTONS: Cancel & Apply */}
        <View style={styles.footerRow}>
          <TouchableOpacity
            testID="month_year_cancel_btn"
            accessible={true}
            accessibilityRole="button"
            accessibilityLabel={t('Cancel') || 'Cancel'}
            activeOpacity={0.7}
            style={[
              styles.cancelBtn,
              {
                borderColor: isContrast
                  ? '#FFFFFF'
                  : colors.borderColor || 'rgba(128,128,128,0.3)',
                borderWidth: isContrast ? 1.5 : 1,
              },
            ]}
            onPress={onClose}
          >
            <Text
              style={[
                styles.cancelText,
                {
                  color: isContrast
                    ? '#FFFFFF'
                    : colors.textSecondary || '#888',
                },
              ]}
            >
              {t('Cancel') || 'Cancel'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            testID="month_year_apply_btn"
            accessible={true}
            accessibilityRole="button"
            accessibilityLabel={`Apply ${selectedMonthName} ${selectedYear}`}
            activeOpacity={0.8}
            style={[
              styles.applyBtn,
              {
                backgroundColor: isContrast
                  ? '#FFFFFF'
                  : colors.primary || '#6200ee',
                borderColor: isContrast
                  ? '#FFFFFF'
                  : colors.primary || '#6200ee',
                borderWidth: isContrast ? 1.5 : 1,
              },
            ]}
            onPress={handleApply}
          >
            <Text
              style={[
                styles.applyBtnText,
                {
                  color: isContrast
                    ? '#000000'
                    : colors.textInverse || '#FFFFFF',
                },
              ]}
            >
              {`${t('Done') || 'Done'} • ${selectedMonthName} ${selectedYear}`}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
      </View>
    </RNModal>
  );
}

export { YearPickerModal as MonthYearPickerModal };
export default YearPickerModal;

const styles = StyleSheet.create({
  sheetOverlay: {
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  content: {
    width: '100%',
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 24,
    zIndex: 2,
    elevation: 10,
  },
  dragHandleContainer: {
    alignItems: 'center',
    marginBottom: 8,
  },
  dragHandle: {
    width: 44,
    height: 5,
    borderRadius: 3,
    opacity: 0.5,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  closeBtn: {
    padding: 6,
  },
  closeBtnText: {
    fontSize: 18,
    fontWeight: '600',
  },
  hotSection: {
    marginBottom: 10,
  },
  hotSectionTitle: {
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  hotChipsScroll: {
    flexDirection: 'row',
    gap: 8,
    paddingRight: 10,
  },
  hotChip: {
    paddingVertical: 7,
    paddingHorizontal: 12,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  hotChipText: {
    fontSize: 13,
  },
  tabContainer: {
    flexDirection: 'row',
    borderRadius: 12,
    padding: 4,
    marginVertical: 10,
  },
  tabBtn: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
  },
  activeTabBtn: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.15,
    shadowRadius: 2,
    elevation: 2,
  },
  tabText: {
    fontSize: 14,
  },
  gridContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    paddingVertical: 4,
    rowGap: 8,
  },
  yearScroll: {
    maxHeight: 200,
  },
  gridCell: {
    width: '31.5%',
    paddingVertical: 11,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cellText: {
    fontSize: 14,
    textAlign: 'center',
  },
  footerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    marginTop: 16,
    paddingTop: 8,
  },
  cancelBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelText: {
    fontSize: 15,
    fontWeight: '600',
  },
  applyBtn: {
    flex: 2,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 2,
  },
  applyBtnText: {
    fontSize: 15,
    fontWeight: '700',
  },
});
