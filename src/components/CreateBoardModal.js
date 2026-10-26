import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ScrollView, Platform } from 'react-native';
import Modal from 'react-native-modal';
import { useTranslation } from 'react-i18next';
import Svg, { Path } from 'react-native-svg';
import { BOARD_COLORS } from '../utils/boardColors';
import CustomRepeatModal from './CustomRepeatModal';

const IconCalendar = ({ color }) => (
  <Svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <Path d="M19 4H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2z" />
    <Path d="M16 2v4M8 2v4M3 10h18" />
  </Svg>
);

const IconList = ({ color }) => (
  <Svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <Path d="M9 6h11M9 12h11M9 18h11M5 6v.01M5 12v.01M5 18v.01" />
  </Svg>
);

const IconGift = ({ color }) => (
  <Svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <Path d="M20 12v10H4V12M2 7h20v5H2zM12 22V7M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7zM12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z" />
  </Svg>
);

const IconRepeat = ({ color = '#EC4899', size = 18 }) => (
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

const getDurationShort = (count, unit) => {
  const num = parseInt(count, 10) || 1;
  if (unit === 'year') return num === 1 ? '1 yr' : `${num} yrs`;
  if (unit === 'month') return num === 1 ? '1 mo' : `${num} mos`;
  if (unit === 'week') return num === 1 ? '1 wk' : `${num} wks`;
  return `${num} ${unit}`;
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
  const [repeatConfig, setRepeatConfig] = useState({ preset: 'every_year' });
  const [repeatDurationCount, setRepeatDurationCount] = useState('10');
  const [repeatDurationUnit, setRepeatDurationUnit] = useState('year'); // 'year' | 'month' | 'week'
  const [isRepeatModalVisible, setIsRepeatModalVisible] = useState(false);

  const durationText = `${repeatDurationCount || 1} ${
    repeatDurationUnit === 'year' 
      ? (repeatDurationCount === '1' ? (t('year') || 'year') : (t('years') || 'years'))
      : repeatDurationUnit === 'month'
      ? (repeatDurationCount === '1' ? (t('month') || 'month') : (t('months') || 'months'))
      : (repeatDurationCount === '1' ? (t('week') || 'week') : (t('weeks') || 'weeks'))
  }`;

  const templates = [
    {
      id: 'standard',
      title: t('Standard Date Category') || 'Standard Date Category',
      badge: t('Date-Driven') || 'Date-Driven',
      desc: t('Organized by Missed, Today, Tomorrow & Upcoming dates.') || 'Organized by Missed, Today, Tomorrow & Upcoming dates.',
      Icon: IconCalendar,
      accentColor: '#3B82F6',
    },
    {
      id: 'simple_list',
      title: t('List') || 'List',
      badge: t('Clean List') || 'Clean List',
      desc: t('Quick date-free checklist with List & Completed sections.') || 'Quick date-free checklist with List & Completed sections.',
      Icon: IconList,
      accentColor: '#10B981',
    },
    {
      id: 'birthdays',
      title: t('Events') || 'Events',
      badge: repeatConfig.preset === 'None'
        ? (t('No Repeat') || 'No Repeat')
        : `${t('Auto-Repeat') || 'Auto-Repeat'} ${getDurationShort(repeatDurationCount, repeatDurationUnit)}`,
      desc: `${t('Track birthdays & events with automatic')} ${getRepeatLabel(repeatConfig, t).toLowerCase()} ${t('reminders for')} ${durationText}.`,
      Icon: IconGift,
      accentColor: '#EC4899',
    },
  ];

  const handleCreate = () => {
    const trimmed = boardName.trim();
    if (!trimmed) return;
    onSubmit({
      name: trimmed,
      type: selectedType,
      color: selectedColor,
      repeatConfig: selectedType === 'birthdays' ? repeatConfig : null,
      repeatDuration: selectedType === 'birthdays' ? {
        count: parseInt(repeatDurationCount, 10) || 1,
        unit: repeatDurationUnit
      } : null
    });
    setBoardName('');
    setSelectedType('standard');
    setSelectedColor(BOARD_COLORS[1]);
    setRepeatConfig({ preset: 'every_year' });
    setRepeatDurationCount('10');
    setRepeatDurationUnit('year');
    onClose();
  };

  const handleSelectQuickFrequency = (presetId) => {
    if (presetId === 'custom') {
      setIsRepeatModalVisible(true);
      return;
    }
    const newCfg = { preset: presetId };
    setRepeatConfig(newCfg);
    
    // Auto-adjust default duration unit to match frequency
    if (presetId === 'every_year') {
      if (repeatDurationUnit !== 'year') {
        setRepeatDurationCount('6');
        setRepeatDurationUnit('year');
      }
    } else if (presetId === 'every_2_weeks' || presetId === 'every_week') {
      if (repeatDurationUnit === 'year') {
        setRepeatDurationCount('2');
        setRepeatDurationUnit('month');
      }
    } else if (presetId === 'every_month') {
      if (repeatDurationUnit === 'week') {
        setRepeatDurationCount('6');
        setRepeatDurationUnit('month');
      }
    }
  };

  return (
    <Modal
      isVisible={isVisible}
      onSwipeComplete={onClose}
      swipeDirection={['down']}
      propagateSwipe={true}
      onBackdropPress={onClose}
      style={styles.modalContainer}
    >
      <View style={[styles.modalContent, { backgroundColor: colors.bgCard }]}>
        <View style={styles.dragHandle} />

        <Text style={[styles.title, { color: colors.textPrimary }]}>
          {t('Create New Category') || 'Create New Category'}
        </Text>

        <ScrollView 
          style={styles.scrollBody} 
          contentContainerStyle={styles.scrollBodyContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <TextInput
            testID="prompt_input"
            style={[
              styles.input,
              {
                backgroundColor: colors.bgMain,
                color: colors.textPrimary,
                borderColor: colors.borderColor,
                marginBottom: 16,
              },
            ]}
            placeholder={t('Category Name (e.g. Birthdays, Sprint, Work)') || 'Category Name'}
            placeholderTextColor={colors.textSecondary}
            value={boardName}
            onChangeText={setBoardName}
            autoFocus={true}
          />

          {/* Category Color Palette with Custom Color Picker */}
          <View style={styles.colorSection}>
            <View style={styles.colorHeaderRow}>
              <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>
                {t('Category Color') || 'Category Color'}
              </Text>
              <View style={[styles.hexBadge, { borderColor: colors.borderColor, backgroundColor: colors.bgMain }]}>
                <View style={[styles.hexDot, { backgroundColor: selectedColor }]} />
                <TextInput
                  style={[styles.hexInput, { color: colors.textPrimary }]}
                  value={selectedColor}
                  onChangeText={(val) => {
                    let formatted = val.trim();
                    if (!formatted.startsWith('#') && formatted.length > 0) formatted = `#${formatted}`;
                    setSelectedColor(formatted);
                  }}
                  maxLength={9}
                  placeholder="#HEX"
                  placeholderTextColor={colors.textSecondary}
                />
              </View>
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.colorRow}>
              {BOARD_COLORS.map(c => {
                const isSelected = selectedColor.toLowerCase() === c.toLowerCase();
                return (
                  <TouchableOpacity
                    key={c}
                    accessible={true}
                    accessibilityRole="button"
                    accessibilityLabel={`Color ${c}`}
                    onPress={() => setSelectedColor(c)}
                    style={[
                      styles.colorCircle,
                      {
                        backgroundColor: c,
                        borderColor: colors.textPrimary,
                        borderWidth: isSelected ? 3 : 0,
                      }
                    ]}
                  >
                    {isSelected && <Text style={styles.colorCheck}>✓</Text>}
                  </TouchableOpacity>
                );
              })}
              {Platform.OS === 'web' && (
                <label 
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: 36,
                    height: 36,
                    borderRadius: 18,
                    backgroundColor: 'rgba(128,128,128,0.12)',
                    border: '2px dashed ' + (colors.borderColor || '#999'),
                    cursor: 'pointer',
                    overflow: 'hidden',
                    position: 'relative'
                  }}
                  title={t('Custom Color') || 'Custom Color'}
                >
                  <span style={{ fontSize: 16 }}>🎨</span>
                  <input
                    type="color"
                    value={selectedColor.startsWith('#') && selectedColor.length === 7 ? selectedColor : '#4CAF50'}
                    onChange={(e) => setSelectedColor(e.target.value)}
                    style={{
                      position: 'absolute',
                      opacity: 0,
                      width: '100%',
                      height: '100%',
                      cursor: 'pointer'
                    }}
                  />
                </label>
              )}
            </ScrollView>
          </View>

          {/* Template Selector */}
          <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>
            {t('Category Type') || 'Category Type'}
          </Text>
          <View style={styles.templateList}>
            {templates.map(tmpl => {
              const isSelected = selectedType === tmpl.id;
              const { Icon } = tmpl;
              return (
                <TouchableOpacity
                  key={tmpl.id}
                  testID={`category_type_${tmpl.id}`}
                  style={[
                    styles.card,
                    {
                      borderColor: isSelected ? tmpl.accentColor : colors.borderColor,
                      backgroundColor: isSelected ? `${tmpl.accentColor}12` : colors.bgMain,
                    },
                  ]}
                  onPress={() => setSelectedType(tmpl.id)}
                >
                  <View style={styles.cardHeader}>
                    <View style={styles.cardTitleRow}>
                      <View style={[styles.iconWrapper, { backgroundColor: `${tmpl.accentColor}20` }]}>
                        <Icon color={tmpl.accentColor} />
                      </View>
                      <Text style={[styles.cardTitle, { color: colors.textPrimary }]}>
                        {tmpl.title}
                      </Text>
                    </View>
                    <View style={[styles.badge, { backgroundColor: `${tmpl.accentColor}20` }]}>
                      <Text style={[styles.badgeText, { color: tmpl.accentColor }]}>
                        {tmpl.badge}
                      </Text>
                    </View>
                  </View>
                  <Text style={[styles.cardDesc, { color: colors.textSecondary }]}>
                    {tmpl.desc}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Custom Repeat Configuration Panel (for Events category before creation) */}
          {selectedType === 'birthdays' && (
            <View 
              testID="events_repeat_customizer"
              style={[
                styles.repeatSettingsCard, 
                { 
                  backgroundColor: colors.bgMain, 
                  borderColor: '#EC4899',
                }
              ]}
            >
              <View style={styles.repeatHeaderRow}>
                <View style={styles.repeatTitleGroup}>
                  <IconRepeat color="#EC4899" size={18} />
                  <Text style={[styles.repeatSettingsTitle, { color: colors.textPrimary }]}>
                    {t('Default Auto-Repeat Configuration') || 'Default Auto-Repeat Configuration'}
                  </Text>
                </View>
                <TouchableOpacity
                  testID="change_repeat_pattern_btn"
                  activeOpacity={0.7}
                  accessible={true}
                  accessibilityRole="button"
                  accessibilityLabel="Change repeat pattern"
                  style={styles.changePatternBtn}
                  onPress={() => setIsRepeatModalVisible(true)}
                >
                  <Text style={styles.changePatternBtnText}>
                    {t('More Options...')}
                  </Text>
                </TouchableOpacity>
              </View>

              {/* Quick Frequency Selector Chips */}
              <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>
                {t('Repeat Frequency') || 'Repeat Frequency'}
              </Text>
              <View style={styles.freqPillsRow}>
                {[
                  { id: 'every_year', label: t('Every year') || 'Every year' },
                  { id: 'every_2_weeks', label: t('Every 2 weeks') || 'Every 2 weeks' },
                  { id: 'every_month', label: t('Every month') || 'Every month' },
                  { id: 'every_week', label: t('Every week') || 'Every week' },
                  { id: 'custom', label: t('Custom...') || 'Custom...' },
                ].map((item) => {
                  const isCurrent = repeatConfig.preset === item.id;
                  return (
                    <TouchableOpacity
                      key={item.id}
                      testID={`freq_chip_${item.id}`}
                      style={[
                        styles.freqPill,
                        { borderColor: colors.borderColor, backgroundColor: colors.bgCard },
                        isCurrent && { borderColor: '#EC4899', backgroundColor: 'rgba(236, 72, 153, 0.14)' }
                      ]}
                      onPress={() => handleSelectQuickFrequency(item.id)}
                    >
                      <Text style={[
                        styles.freqPillText,
                        { color: colors.textSecondary },
                        isCurrent && { color: '#EC4899', fontWeight: '700' }
                      ]}>
                        {item.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {/* Repeat Duration Section: "Repeat for: [ 6 ] [ Years | Months | Weeks ]" */}
              <View style={styles.durationSection}>
                <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>
                  {t('Repeat For (Duration)') || 'Repeat For (Duration)'}
                </Text>
                <View style={styles.durationInputRow}>
                  <TextInput
                    testID="duration_count_input"
                    style={[
                      styles.durationNumberInput, 
                      { 
                        backgroundColor: colors.bgCard, 
                        color: colors.textPrimary, 
                        borderColor: colors.borderColor 
                      }
                    ]}
                    value={repeatDurationCount}
                    onChangeText={(val) => setRepeatDurationCount(val.replace(/[^0-9]/g, ''))}
                    keyboardType="numeric"
                    maxLength={3}
                    placeholder="10"
                    placeholderTextColor={colors.textSecondary}
                  />

                  {/* Unit Switcher Pills: Years | Months | Weeks */}
                  <View style={[styles.unitPillsWrapper, { backgroundColor: colors.bgCard, borderColor: colors.borderColor }]}>
                    {[
                      { id: 'year', label: t('Years') || 'Years' },
                      { id: 'month', label: t('Months') || 'Months' },
                      { id: 'week', label: t('Weeks') || 'Weeks' }
                    ].map(u => {
                      const isUnitActive = repeatDurationUnit === u.id;
                      return (
                        <TouchableOpacity
                          key={u.id}
                          testID={`duration_unit_${u.id}`}
                          style={[
                            styles.unitPill,
                            isUnitActive && { backgroundColor: '#EC4899' }
                          ]}
                          onPress={() => setRepeatDurationUnit(u.id)}
                        >
                          <Text style={[
                            styles.unitPillText,
                            { color: isUnitActive ? '#ffffff' : colors.textSecondary, fontWeight: isUnitActive ? '700' : '500' }
                          ]}>
                            {u.label}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>

                {/* Quick Duration Shortcuts */}
                <View style={styles.quickDurationRow}>
                  {[
                    { count: '1', unit: 'year', label: '1 yr' },
                    { count: '2', unit: 'month', label: '2 mos' },
                    { count: '6', unit: 'month', label: '6 mos' },
                    { count: '2', unit: 'year', label: '2 yrs' },
                    { count: '6', unit: 'year', label: '6 yrs' },
                    { count: '10', unit: 'year', label: '10 yrs' },
                  ].map(item => {
                    const isSelected = repeatDurationCount === item.count && repeatDurationUnit === item.unit;
                    return (
                      <TouchableOpacity
                        key={`${item.count}-${item.unit}`}
                        testID={`duration_chip_${item.count}_${item.unit}`}
                        style={[
                          styles.quickDurationChip,
                          { borderColor: colors.borderColor, backgroundColor: colors.bgCard },
                          isSelected && {
                            borderColor: '#EC4899',
                            backgroundColor: 'rgba(236, 72, 153, 0.16)'
                          }
                        ]}
                        onPress={() => {
                          setRepeatDurationCount(item.count);
                          setRepeatDurationUnit(item.unit);
                        }}
                      >
                        <Text style={[
                          styles.quickDurationText,
                          { color: colors.textSecondary },
                          isSelected && { color: '#EC4899', fontWeight: '700' }
                        ]}>
                          {item.label}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>

                {/* Summary Banner */}
                <View style={[styles.summaryBanner, { backgroundColor: colors.bgCard, borderColor: colors.borderColor }]}>
                  <Text style={[styles.summaryText, { color: colors.textSecondary }]}>
                    ℹ️ {t('New tasks in this category will repeat')} <Text style={{ color: '#EC4899', fontWeight: '700' }}>{getRepeatLabel(repeatConfig, t).toLowerCase()}</Text> {t('for')} <Text style={{ color: '#EC4899', fontWeight: '700' }}>{durationText}</Text>.
                  </Text>
                </View>
              </View>
            </View>
          )}
        </ScrollView>

        <View style={styles.buttonRow}>
          <TouchableOpacity
            style={[styles.btn, styles.cancelBtn, { borderColor: colors.borderColor }]}
            onPress={onClose}
          >
            <Text style={[styles.btnText, { color: colors.textSecondary }]}>
              {t('Cancel') || 'Cancel'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            testID="prompt_submit_btn"
            style={[
              styles.btn,
              styles.submitBtn,
              { backgroundColor: selectedColor || colors.primary, opacity: boardName.trim() ? 1 : 0.5 },
            ]}
            disabled={!boardName.trim()}
            onPress={handleCreate}
          >
            <Text style={styles.submitBtnText}>{t('Create') || 'Create'}</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Full Repeat Task Modal (from single task editor) */}
      <CustomRepeatModal
        isVisible={isRepeatModalVisible}
        onClose={() => setIsRepeatModalVisible(false)}
        initialConfig={repeatConfig}
        onSave={(newConfig) => {
          setRepeatConfig(newConfig);
          if (newConfig.preset === 'every_2_weeks' || newConfig.preset === 'every_week') {
            if (repeatDurationUnit === 'year' && parseInt(repeatDurationCount, 10) > 2) {
              setRepeatDurationCount('2');
              setRepeatDurationUnit('month');
            }
          } else if (newConfig.preset === 'every_year') {
            if (repeatDurationUnit !== 'year') {
              setRepeatDurationCount('6');
              setRepeatDurationUnit('year');
            }
          }
        }}
      />
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalContainer: {
    margin: 0,
    justifyContent: 'flex-end',
  },
  modalContent: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: 15,
    paddingBottom: 25,
    paddingHorizontal: 20,
    maxHeight: '92%',
  },
  dragHandle: {
    width: 40,
    height: 5,
    backgroundColor: '#888',
    borderRadius: 3,
    marginBottom: 15,
    alignSelf: 'center',
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 15,
    textAlign: 'center',
  },
  scrollBody: {
    flexShrink: 1,
    maxHeight: 520,
  },
  scrollBodyContent: {
    paddingBottom: 10,
  },
  input: {
    height: 48,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 15,
    fontSize: 16,
  },
  colorSection: {
    marginBottom: 16,
  },
  sectionLabel: {
    fontSize: 13,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  colorHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  hexBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 2,
    gap: 6,
  },
  hexDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  hexInput: {
    fontSize: 12,
    fontWeight: '600',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    padding: 0,
    width: 65,
  },
  colorRow: {
    paddingVertical: 4,
    gap: 10,
    alignItems: 'center',
  },
  colorCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  colorCheck: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: 'bold',
  },
  templateList: {
    marginBottom: 14,
  },
  card: {
    borderRadius: 14,
    borderWidth: 2,
    padding: 12,
    marginBottom: 10,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  cardTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  iconWrapper: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: 'bold',
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '600',
  },
  cardDesc: {
    fontSize: 12,
    lineHeight: 16,
    paddingLeft: 44,
  },
  repeatSettingsCard: {
    borderRadius: 14,
    borderWidth: 1.5,
    padding: 14,
    marginBottom: 16,
  },
  repeatHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  repeatTitleGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    flex: 1,
  },
  repeatSettingsTitle: {
    fontSize: 13,
    fontWeight: '700',
  },
  changePatternBtn: {
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: 'rgba(236, 72, 153, 0.15)',
  },
  changePatternBtnText: {
    color: '#EC4899',
    fontSize: 12,
    fontWeight: '700',
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 6,
  },
  freqPillsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 14,
  },
  freqPill: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
    borderWidth: 1,
  },
  freqPillText: {
    fontSize: 12,
  },
  durationSection: {
    marginTop: 2,
  },
  durationInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
  },
  durationNumberInput: {
    width: 60,
    height: 40,
    borderWidth: 1,
    borderRadius: 10,
    textAlign: 'center',
    fontSize: 16,
    fontWeight: '700',
  },
  unitPillsWrapper: {
    flexDirection: 'row',
    borderRadius: 10,
    borderWidth: 1,
    padding: 2,
    flex: 1,
  },
  unitPill: {
    flex: 1,
    paddingVertical: 6,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  unitPillText: {
    fontSize: 12,
  },
  quickDurationRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 12,
  },
  quickDurationChip: {
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 10,
    borderWidth: 1,
  },
  quickDurationText: {
    fontSize: 11,
  },
  summaryBanner: {
    padding: 10,
    borderRadius: 10,
    borderWidth: 1,
  },
  summaryText: {
    fontSize: 12,
    lineHeight: 16,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 4,
  },
  btn: {
    flex: 1,
    height: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelBtn: {
    borderWidth: 1,
  },
  submitBtn: {},
  btnText: {
    fontSize: 16,
    fontWeight: '600',
  },
  submitBtnText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
});
