import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Platform } from 'react-native';
import Modal from 'react-native-modal';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../styles/ThemeContext';
import Svg, { Path, Circle, Rect, Line } from 'react-native-svg';

const IconClock = ({ color, size = 20 }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <Circle cx="12" cy="12" r="10" />
    <Path d="M12 6v6l4 2" />
  </Svg>
);

const IconFlag = ({ color, size = 20 }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <Path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z" />
    <Line x1="4" y1="22" x2="4" y2="15" />
  </Svg>
);

const IconPlus = ({ color, size = 20 }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <Line x1="12" y1="5" x2="12" y2="19" />
    <Line x1="5" y1="12" x2="19" y2="12" />
  </Svg>
);

const IconChevronRight = ({ color, size = 18 }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <Path d="M9 18l6-6-6-6" />
  </Svg>
);

export default function CalendarDayOptionsModal({
  isVisible,
  onClose,
  dateFormatted,
  onSortTime,
  onSortPriority,
  onAddTask,
  onSelectTasks,
  onDeleteAll,
}) {
  const { colors, isDark } = useTheme();
  const { t } = useTranslation();

  const primaryAccent = colors.primary || '#5D45DB';
  const iconBg = isDark ? 'rgba(93, 69, 219, 0.22)' : 'rgba(93, 69, 219, 0.12)';

  return (
    <Modal
      isVisible={isVisible}
      onSwipeComplete={onClose}
      swipeDirection={['down']}
      propagateSwipe={true}
      onBackdropPress={onClose}
      onBackButtonPress={onClose}
      style={styles.modalContainer}
    >
      <View style={[styles.modalContent, { backgroundColor: colors.bgCard || (isDark ? '#1C1B24' : '#FFFFFF') }]}>
        <View style={styles.dragHandleContainer}>
          <View style={[styles.dragHandle, { backgroundColor: colors.borderColor || '#DDD' }]} />
        </View>

        {/* Title row */}
        <View style={styles.headerRow}>
          <View style={{ flex: 1, paddingRight: 10 }}>
            <Text style={[styles.title, { color: colors.textPrimary }]}>
              {t('Day options') || 'Day options'}
            </Text>
            <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
              {dateFormatted}
            </Text>
          </View>

          <TouchableOpacity 
            onPress={onClose} 
            activeOpacity={0.7}
            style={[styles.closeCircle, { backgroundColor: isDark ? '#2B2A36' : '#F0F0F4' }]}
          >
            <Svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={colors.textSecondary} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <Path d="M18 6L6 18M6 6l12 12" />
            </Svg>
          </TouchableOpacity>
        </View>

        {/* Options list in grouped card */}
        <View style={[styles.cardGroup, { backgroundColor: isDark ? '#23222E' : '#FFFFFF', borderColor: colors.borderColor || '#ECECEF' }]}>
          {/* Sort by time */}
          <TouchableOpacity
            style={styles.optionRow}
            activeOpacity={0.7}
            onPress={() => {
              onSortTime();
              onClose();
            }}
          >
            <View style={[styles.iconWrapper, { backgroundColor: iconBg }]}>
              <IconClock color={primaryAccent} />
            </View>
            <Text style={[styles.optionLabel, { color: colors.textPrimary }]}>
              {t('Sort by time') || 'Sort by time'}
            </Text>
            <IconChevronRight color={colors.textSecondary} />
          </TouchableOpacity>

          <View style={[styles.divider, { backgroundColor: colors.borderColor || '#F0F0F4' }]} />

          {/* Sort by priority */}
          <TouchableOpacity
            style={styles.optionRow}
            activeOpacity={0.7}
            onPress={() => {
              onSortPriority();
              onClose();
            }}
          >
            <View style={[styles.iconWrapper, { backgroundColor: iconBg }]}>
              <IconFlag color={primaryAccent} />
            </View>
            <Text style={[styles.optionLabel, { color: colors.textPrimary }]}>
              {t('Sort by priority') || 'Sort by priority'}
            </Text>
            <IconChevronRight color={colors.textSecondary} />
          </TouchableOpacity>

          <View style={[styles.divider, { backgroundColor: colors.borderColor || '#F0F0F4' }]} />

          {/* Add task */}
          <TouchableOpacity
            style={styles.optionRow}
            activeOpacity={0.7}
            onPress={() => {
              onClose();
              if (onAddTask) onAddTask();
            }}
          >
            <View style={[styles.iconWrapper, { backgroundColor: iconBg }]}>
              <IconPlus color={primaryAccent} />
            </View>
            <Text style={[styles.optionLabel, { color: colors.textPrimary }]}>
              {t('Add task') || 'Add task'}
            </Text>
            <IconChevronRight color={colors.textSecondary} />
          </TouchableOpacity>
        </View>

        {/* Cancel button */}
        <View style={styles.bottomBar}>
          <TouchableOpacity
            activeOpacity={0.8}
            onPress={onClose}
            style={[styles.cancelBtn, { backgroundColor: isDark ? '#292736' : '#F0EEFC' }]}
          >
            <Text style={[styles.cancelBtnText, { color: primaryAccent }]}>
              {t('Cancel') || 'Cancel'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalContainer: {
    margin: 0,
    justifyContent: 'flex-end',
  },
  modalContent: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingBottom: Platform.OS === 'ios' ? 24 : 12,
  },
  dragHandleContainer: {
    alignItems: 'center',
    paddingVertical: 10,
  },
  dragHandle: {
    width: 38,
    height: 4,
    borderRadius: 2,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    marginBottom: 16,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    letterSpacing: -0.4,
    marginBottom: 2,
  },
  subtitle: {
    fontSize: 13,
  },
  closeCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cardGroup: {
    marginHorizontal: 20,
    borderRadius: 20,
    borderWidth: 1.5,
    overflow: 'hidden',
    marginBottom: 14,
  },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  iconWrapper: {
    width: 38,
    height: 38,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  optionLabel: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
  },
  divider: {
    height: 1,
    marginLeft: 68,
  },
  bottomBar: {
    paddingHorizontal: 20,
    paddingTop: 4,
  },
  cancelBtn: {
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cancelBtnText: {
    fontSize: 15,
    fontWeight: '700',
  },
});
