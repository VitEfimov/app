import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ScrollView, Platform } from 'react-native';
import Modal from 'react-native-modal';
import { useTranslation } from 'react-i18next';
import Svg, { Path } from 'react-native-svg';
import { BOARD_COLORS } from '../utils/boardColors';

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

export default function CreateBoardModal({
  isVisible,
  onClose,
  onSubmit,
  colors
}) {
  const { t } = useTranslation();
  const [boardName, setBoardName] = useState('');
  const [selectedType, setSelectedType] = useState('standard');
  const [selectedColor, setSelectedColor] = useState(BOARD_COLORS[1]); // Blue by default, user can pick any

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
      badge: t('Auto-Repeat 10 yrs') || 'Auto-Repeat 10 yrs',
      desc: t('Track birthdays & events with automatic 10-year annual reminders.') || 'Track birthdays & events with automatic 10-year annual reminders.',
      Icon: IconGift,
      accentColor: '#EC4899',
    },
  ];

  const handleCreate = () => {
    const trimmed = boardName.trim();
    if (!trimmed) return;
    onSubmit({ name: trimmed, type: selectedType, color: selectedColor });
    setBoardName('');
    setSelectedType('standard');
    setSelectedColor(BOARD_COLORS[1]);
    onClose();
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
          placeholder={t('Category Name (e.g. Work, Personal, Shopping)') || 'Category Name'}
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
        <ScrollView style={styles.templateList} showsVerticalScrollIndicator={false}>
          {templates.map(tmpl => {
            const isSelected = selectedType === tmpl.id;
            const { Icon } = tmpl;
            return (
              <TouchableOpacity
                key={tmpl.id}
                style={[
                  styles.card,
                  {
                    borderColor: isSelected ? colors.primary : colors.borderColor,
                    backgroundColor: isSelected ? `${colors.primary}12` : colors.bgMain,
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
    paddingBottom: 30,
    paddingHorizontal: 20,
    maxHeight: '95%',
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
    maxHeight: 220,
    marginBottom: 20,
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
  buttonRow: {
    flexDirection: 'row',
    gap: 12,
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
