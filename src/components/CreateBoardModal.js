import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ScrollView, Platform } from 'react-native';
import Modal from 'react-native-modal';
import { useTranslation } from 'react-i18next';
import Svg, { Path, Circle, Rect, Line } from 'react-native-svg';
import { BOARD_COLORS } from '../utils/boardColors';
import CustomRepeatModal from './CustomRepeatModal';

const IconCalendar = ({ color = '#6246EA' }) => (
  <Svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <Rect x="3" y="4" width="18" height="18" rx="3" ry="3" />
    <Line x1="16" y1="2" x2="16" y2="6" />
    <Line x1="8" y1="2" x2="8" y2="6" />
    <Line x1="3" y1="10" x2="21" y2="10" />
  </Svg>
);

const IconBoard = ({ color = '#6246EA' }) => (
  <Svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <Rect x="4" y="3" width="16" height="18" rx="2" />
    <Line x1="9" y1="3" x2="9" y2="21" />
    <Line x1="15" y1="3" x2="15" y2="21" />
  </Svg>
);

const IconGift = ({ color = '#6246EA' }) => (
  <Svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <Path d="M20 12v10H4V12M2 7h20v5H2zM12 22V7M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7zM12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z" />
  </Svg>
);

const IconRepeat = ({ color = '#6246EA', size = 20 }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <Path d="M17 1l4 4-4 4" />
    <Path d="M3 11V9a4 4 0 0 1 4-4h14" />
    <Path d="M7 23l-4-4 4-4" />
    <Path d="M21 13v2a4 4 0 0 1-4 4H3" />
  </Svg>
);

const getRepeatLabel = (cfg, t) => {
  if (!cfg || cfg.preset === 'None') return t('None (Does not repeat)') || 'None';
  if (cfg.preset === 'every_day') return t('Every day') || 'Every day';
  if (cfg.preset === 'every_weekday') return t('Every weekday (Mon-Fri)') || 'Every weekday (Mon-Fri)';
  if (cfg.preset === 'every_weekend') return t('Every weekend (Sat-Sun)') || 'Every weekend (Sat-Sun)';
  if (cfg.preset === 'every_week') return t('Every week') || 'Every week';
  if (cfg.preset === 'every_2_weeks') return t('Every 2 weeks') || 'Every 2 weeks';
  if (cfg.preset === 'every_month') return t('Every month') || 'Every month';
  if (cfg.preset === 'every_year') return t('Every year') || 'Every year';
  if (cfg.preset === 'custom') {
    return `${t('Every') || 'Every'} ${cfg.customInterval || 1} ${t(cfg.customFreq || 'days') || (cfg.customFreq || 'days')}`;
  }
  return cfg.preset;
};

export default function CreateBoardModal({
  isVisible,
  onClose,
  onSubmit,
  colors
}) {
  const { t } = useTranslation();
  const [boardName, setBoardName] = useState('');
  const [selectedType, setSelectedType] = useState('standard');
  const [selectedColor, setSelectedColor] = useState(BOARD_COLORS[1]); // Blue by default

  // Category Auto-Repeat settings (applied by default to events before creation)
  const [repeatConfig, setRepeatConfig] = useState({ preset: 'every_week' });
  const [repeatDurationCount, setRepeatDurationCount] = useState('6');
  const [repeatDurationUnit, setRepeatDurationUnit] = useState('month'); // 'year' | 'month' | 'week'
  const [isRepeatModalVisible, setIsRepeatModalVisible] = useState(false);
  const [showDurationDropdown, setShowDurationDropdown] = useState(false);

  const durationText = `${repeatDurationCount} ${
    repeatDurationUnit === 'year' 
      ? (repeatDurationCount === '1' ? (t('year') || 'year') : (t('years') || 'years'))
      : repeatDurationUnit === 'month'
      ? (repeatDurationCount === '1' ? (t('month') || 'month') : (t('months') || 'months'))
      : (repeatDurationCount === '1' ? (t('week') || 'week') : (t('weeks') || 'weeks'))
  }`;

  const isEvents = selectedType === 'birthdays';

  const templates = [
    {
      id: 'standard',
      title: t('Standard date category') || 'Standard date category',
      badge: t('Date-driven') || 'Date-driven',
      desc: t('Organize by Missed, Today, Tomorrow and Upcoming dates.') || 'Organize by Missed, Today, Tomorrow and Upcoming dates.',
      Icon: IconCalendar,
    },
    {
      id: 'simple_list',
      title: t('Board') || 'Board',
      badge: t('Section-based') || 'Section-based',
      desc: t('Organize tasks into sections and move them as you go.') || 'Organize tasks into sections and move them as you go.',
      Icon: IconBoard,
    },
    {
      id: 'birthdays',
      title: t('Events') || 'Events',
      badge: `${t('Auto-repeat')} · ${durationText}`,
      desc: t('Track birthdays and events with automatic reminders for 6 months.') || `Track birthdays and events with automatic reminders for ${durationText}.`,
      Icon: IconGift,
    },
  ];

  const handleCreate = () => {
    const trimmed = boardName.trim();
    if (!trimmed) return;
    onSubmit({
      name: trimmed,
      type: selectedType,
      color: selectedColor,
      repeatConfig: isEvents ? repeatConfig : null,
      repeatDuration: isEvents ? {
        count: parseInt(repeatDurationCount, 10) || 6,
        unit: repeatDurationUnit
      } : null
    });
    setBoardName('');
    setSelectedType('standard');
    setSelectedColor(BOARD_COLORS[1]);
    setRepeatConfig({ preset: 'every_week' });
    setRepeatDurationCount('6');
    setRepeatDurationUnit('month');
    onClose();
  };

  const handleSelectQuickFrequency = (presetId) => {
    if (presetId === 'custom') {
      setIsRepeatModalVisible(true);
      return;
    }
    setRepeatConfig({ preset: presetId });
  };

  const durationPresets = [
    { count: '1', unit: 'month', label: '1 month' },
    { count: '3', unit: 'month', label: '3 months' },
    { count: '6', unit: 'month', label: '6 months' },
    { count: '1', unit: 'year', label: '1 year' },
    { count: '2', unit: 'year', label: '2 years' },
    { count: '5', unit: 'year', label: '5 years' },
  ];

  const primaryAccent = colors?.primary || '#5D45DB';

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
      <View style={[styles.modalContent, { backgroundColor: colors?.bgCard || '#FAF9F6' }]}>
        <View style={styles.dragHandleContainer}>
          <View style={[styles.dragHandle, { backgroundColor: colors?.borderColor || '#DDD' }]} />
        </View>

        {/* Header navigation row */}
        <View style={styles.topNavRow}>
          <TouchableOpacity 
            onPress={onClose} 
            activeOpacity={0.7}
            style={[styles.backCircle, { borderColor: colors?.borderColor || '#E5E5EA', backgroundColor: colors?.bgCard || '#FFF' }]}
          >
            <Svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={colors?.textPrimary || '#000'} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <Path d="M19 12H5M12 19l-7-7 7-7" />
            </Svg>
          </TouchableOpacity>

          <TouchableOpacity onPress={onClose} activeOpacity={0.7}>
            <Text style={[styles.cancelText, { color: colors?.textSecondary || '#8E8E93' }]}>{t('Cancel') || 'Cancel'}</Text>
          </TouchableOpacity>
        </View>

        <ScrollView 
          style={styles.scrollBody} 
          contentContainerStyle={styles.scrollBodyContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Title and subtitle */}
          <Text style={[styles.pageTitle, { color: colors?.textPrimary || '#1A1A24' }]}>
            {isEvents ? (t('Create category') || 'Create category') : (t('Create category') || 'Create category')}
          </Text>
          <Text style={[styles.pageSubtitle, { color: colors?.textSecondary || '#8E8E93' }]}>
            {isEvents 
              ? (t('Let the important dates come back.') || 'Let the important dates come back.')
              : (t('Give your tasks a place to belong.') || 'Give your tasks a place to belong.')}
          </Text>

          {/* Category name input */}
          <Text style={[styles.inputLabel, { color: colors?.textPrimary || '#1A1A24' }]}>
            {t('Category name') || 'Category name'}
          </Text>
          <TextInput
            testID="prompt_input"
            style={[
              styles.input,
              {
                backgroundColor: colors?.bgCard || '#FFFFFF',
                color: colors?.textPrimary || '#1A1A24',
                borderColor: colors?.borderColor || '#E5E5EA',
              },
            ]}
            placeholder={t('e.g. Birthdays, Sprint, Work') || 'e.g. Birthdays, Sprint, Work'}
            placeholderTextColor={colors?.textSecondary || '#999'}
            value={boardName}
            onChangeText={setBoardName}
            autoFocus={true}
          />

          {/* Category color section */}
          <View style={styles.colorHeaderRow}>
            <Text style={[styles.inputLabel, { color: colors?.textPrimary || '#1A1A24', marginBottom: 0 }]}>
              {t('Category color') || 'Category color'}
            </Text>
            <Text style={[styles.hexCodeText, { color: colors?.textSecondary || '#999' }]}>
              {selectedColor.toUpperCase()}
            </Text>
          </View>
          
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.colorRow}>
            {BOARD_COLORS.map(c => {
              const isSelected = selectedColor.toLowerCase() === c.toLowerCase();
              return (
                <TouchableOpacity
                  key={c}
                  activeOpacity={0.75}
                  onPress={() => setSelectedColor(c)}
                  style={[
                    styles.colorCircle,
                    { backgroundColor: c }
                  ]}
                >
                  {isSelected && (
                    <Svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                      <Path d="M20 6L9 17l-5-5" />
                    </Svg>
                  )}
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          {/* Category type selection */}
          <View style={styles.typeHeaderRow}>
            <Text style={[styles.inputLabel, { color: colors?.textPrimary || '#1A1A24', marginBottom: 0 }]}>
              {isEvents ? (t('Category type') || 'Category type') : (t('Choose a category type') || 'Choose a category type')}
            </Text>
            {isEvents && (
              <TouchableOpacity onPress={() => setSelectedType('standard')} activeOpacity={0.7}>
                <Text style={[styles.changeTypeText, { color: colors?.textSecondary || '#888' }]}>{t('Change') || 'Change'}</Text>
              </TouchableOpacity>
            )}
          </View>

          <View style={styles.templateList}>
            {templates
              .filter(tmpl => !isEvents || tmpl.id === 'birthdays')
              .map(tmpl => {
                const isSelected = selectedType === tmpl.id;
                const { Icon } = tmpl;
                return (
                  <TouchableOpacity
                    key={tmpl.id}
                    activeOpacity={0.75}
                    testID={`category_type_${tmpl.id}`}
                    style={[
                      styles.templateCard,
                      {
                        borderColor: isSelected ? primaryAccent : (colors?.borderColor || '#E5E5EA'),
                        backgroundColor: isSelected ? `${primaryAccent}0D` : (colors?.bgCard || '#FFFFFF'),
                      },
                    ]}
                    onPress={() => setSelectedType(tmpl.id)}
                  >
                    <View style={styles.cardHeader}>
                      <View style={[styles.iconWrapper, { backgroundColor: `${primaryAccent}18` }]}>
                        <Icon color={primaryAccent} />
                      </View>
                      
                      <View style={{ flex: 1, marginRight: 8 }}>
                        <Text style={[styles.cardTitle, { color: colors?.textPrimary || '#1A1A24' }]}>
                          {tmpl.title}
                        </Text>
                        <Text style={[styles.cardDesc, { color: colors?.textSecondary || '#8E8E93' }]}>
                          {tmpl.desc}
                        </Text>
                        <View style={[styles.badge, { backgroundColor: 'transparent' }]}>
                          <Text style={[styles.badgeText, { color: primaryAccent }]}>
                            {tmpl.badge}
                          </Text>
                        </View>
                      </View>

                      {/* Radio Selection Indicator */}
                      <View style={[
                        styles.radioOuter,
                        { borderColor: isSelected ? primaryAccent : (colors?.borderColor || '#CCC') }
                      ]}>
                        {isSelected && <View style={[styles.radioInner, { backgroundColor: primaryAccent }]} />}
                      </View>
                    </View>
                  </TouchableOpacity>
                );
              })}
          </View>

          {/* Default Auto-Repeat Card (when Events is selected) */}
          {isEvents && (
            <View style={[styles.autoRepeatCard, { backgroundColor: colors?.bgCard || '#FFFFFF', borderColor: colors?.borderColor || '#E5E5EA' }]}>
              <View style={styles.autoRepeatHeader}>
                <View style={[styles.iconWrapper, { backgroundColor: `${primaryAccent}18` }]}>
                  <IconRepeat color={primaryAccent} size={18} />
                </View>
                <Text style={[styles.autoRepeatTitle, { color: colors?.textPrimary || '#1A1A24' }]}>
                  {t('Default auto-repeat') || 'Default auto-repeat'}
                </Text>
              </View>

              {/* Repeat Frequency Pills */}
              <Text style={[styles.fieldLabel, { color: colors?.textSecondary || '#8E8E93' }]}>
                {t('Repeat frequency') || 'Repeat frequency'}
              </Text>
              <View style={styles.freqPillsRow}>
                {[
                  { id: 'every_year', label: t('Every year') || 'Every year' },
                  { id: 'every_2_weeks', label: t('Every 2 weeks') || 'Every 2 weeks' },
                  { id: 'every_month', label: t('Every month') || 'Every month' },
                  { id: 'every_week', label: t('Every week') || 'Every week' },
                  { id: 'custom', label: t('Custom') || 'Custom' },
                ].map((item) => {
                  const isCurrent = repeatConfig.preset === item.id;
                  return (
                    <TouchableOpacity
                      key={item.id}
                      activeOpacity={0.75}
                      style={[
                        styles.freqPill,
                        { borderColor: colors?.borderColor || '#E5E5EA', backgroundColor: isCurrent ? primaryAccent : (colors?.bgCard || '#FFF') },
                      ]}
                      onPress={() => handleSelectQuickFrequency(item.id)}
                    >
                      <Text style={[
                        styles.freqPillText,
                        { color: isCurrent ? '#FFFFFF' : (colors?.textPrimary || '#1A1A24'), fontWeight: isCurrent ? '700' : '500' }
                      ]}>
                        {item.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {/* Repeat for Dropdown */}
              <Text style={[styles.fieldLabel, { color: colors?.textSecondary || '#8E8E93', marginTop: 14 }]}>
                {t('Repeat for') || 'Repeat for'}
              </Text>
              <TouchableOpacity
                activeOpacity={0.75}
                style={[styles.dropdownPill, { borderColor: colors?.borderColor || '#E5E5EA', backgroundColor: colors?.bgCard || '#FFF' }]}
                onPress={() => setShowDurationDropdown(!showDurationDropdown)}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <IconCalendar color={colors?.textSecondary || '#888'} />
                  <Text style={[styles.dropdownValueText, { color: colors?.textPrimary || '#1A1A24', marginLeft: 8 }]}>
                    {durationText}
                  </Text>
                </View>
                <Svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={colors?.textSecondary || '#888'} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <Path d="M6 9l6 6 6-6" />
                </Svg>
              </TouchableOpacity>

              {showDurationDropdown && (
                <View style={[styles.dropdownMenu, { backgroundColor: colors?.bgCard || '#FFF', borderColor: colors?.borderColor || '#E5E5EA' }]}>
                  {durationPresets.map(preset => (
                    <TouchableOpacity
                      key={preset.label}
                      style={styles.dropdownMenuItem}
                      onPress={() => {
                        setRepeatDurationCount(preset.count);
                        setRepeatDurationUnit(preset.unit);
                        setShowDurationDropdown(false);
                      }}
                    >
                      <Text style={[styles.dropdownMenuItemText, { color: colors?.textPrimary || '#1A1A24' }]}>
                        {preset.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}

              {/* More options link */}
              <TouchableOpacity
                activeOpacity={0.7}
                style={styles.moreOptionsRow}
                onPress={() => setIsRepeatModalVisible(true)}
              >
                <Text style={[styles.moreOptionsText, { color: primaryAccent }]}>
                  {t('More options') || 'More options'}
                </Text>
                <Svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={primaryAccent} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <Path d="M7 17L17 7M7 7h10v10" />
                </Svg>
              </TouchableOpacity>
            </View>
          )}

          {/* Footnote note */}
          {isEvents && (
            <View style={styles.footnoteRow}>
              <Text style={[styles.footnoteText, { color: colors?.textSecondary || '#8E8E93' }]}>
                ⓘ {t('New events will repeat every week for 6 months. You can change this for each event.') || 'New events will repeat every week for 6 months. You can change this for each event.'}
              </Text>
            </View>
          )}
        </ScrollView>

        {/* Bottom submit button */}
        <View style={styles.bottomBar}>
          <TouchableOpacity
            activeOpacity={0.85}
            onPress={handleCreate}
            style={[
              styles.createBtn,
              { backgroundColor: primaryAccent, opacity: boardName.trim() ? 1 : 0.6 }
            ]}
            disabled={!boardName.trim()}
          >
            <Text style={styles.createBtnText}>
              + {isEvents ? (t('Create event category') || 'Create event category') : (t('Create category') || 'Create category')}
            </Text>
          </TouchableOpacity>
        </View>

        <CustomRepeatModal
          isVisible={isRepeatModalVisible}
          onClose={() => setIsRepeatModalVisible(false)}
          onSave={(cfg) => {
            setRepeatConfig(cfg);
            setIsRepeatModalVisible(false);
          }}
          initialConfig={repeatConfig}
          colors={colors}
        />
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
    maxHeight: '92%',
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
  topNavRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    marginBottom: 8,
  },
  backCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cancelText: {
    fontSize: 15,
    fontWeight: '500',
  },
  scrollBody: {
    paddingHorizontal: 20,
  },
  scrollBodyContent: {
    paddingBottom: 20,
  },
  pageTitle: {
    fontSize: 28,
    fontWeight: '700',
    letterSpacing: -0.5,
    marginBottom: 4,
  },
  pageSubtitle: {
    fontSize: 14,
    marginBottom: 20,
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 8,
  },
  input: {
    height: 50,
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 16,
    fontSize: 15,
    marginBottom: 18,
  },
  colorHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  hexCodeText: {
    fontSize: 13,
    fontWeight: '500',
  },
  colorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 20,
    paddingVertical: 2,
  },
  colorCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    justifyContent: 'center',
    alignItems: 'center',
  },
  typeHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  changeTypeText: {
    fontSize: 13,
    fontWeight: '500',
  },
  templateList: {
    gap: 10,
    marginBottom: 14,
  },
  templateCard: {
    borderRadius: 18,
    borderWidth: 1.5,
    padding: 14,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconWrapper: {
    width: 44,
    height: 44,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 2,
  },
  cardDesc: {
    fontSize: 12,
    lineHeight: 16,
    marginBottom: 6,
  },
  badge: {
    alignSelf: 'flex-start',
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '600',
  },
  radioOuter: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 6,
  },
  radioInner: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  autoRepeatCard: {
    borderRadius: 20,
    borderWidth: 1,
    padding: 16,
    marginTop: 4,
    marginBottom: 12,
  },
  autoRepeatHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
  },
  autoRepeatTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 8,
  },
  freqPillsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  freqPill: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
  },
  freqPillText: {
    fontSize: 13,
  },
  dropdownPill: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    height: 46,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 14,
  },
  dropdownValueText: {
    fontSize: 14,
    fontWeight: '600',
  },
  dropdownMenu: {
    marginTop: 4,
    borderRadius: 12,
    borderWidth: 1,
    paddingVertical: 6,
  },
  dropdownMenuItem: {
    paddingVertical: 10,
    paddingHorizontal: 14,
  },
  dropdownMenuItemText: {
    fontSize: 14,
  },
  moreOptionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#F0F0F4',
  },
  moreOptionsText: {
    fontSize: 13,
    fontWeight: '600',
  },
  footnoteRow: {
    marginTop: 6,
    marginBottom: 12,
    paddingHorizontal: 4,
  },
  footnoteText: {
    fontSize: 12,
    lineHeight: 18,
  },
  bottomBar: {
    paddingHorizontal: 20,
    paddingTop: 8,
  },
  createBtn: {
    height: 52,
    borderRadius: 26,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 4,
  },
  createBtnText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
});
