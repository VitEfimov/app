import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ScrollView } from 'react-native';
import Modal from 'react-native-modal';
import { useTranslation } from 'react-i18next';
import Svg, { Path } from 'react-native-svg';

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

const IconShopping = ({ color }) => (
  <Svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <Path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4zM3 6h18M16 10a4 4 0 0 1-8 0" />
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

  const templates = [
    {
      id: 'standard',
      title: t('Standard Date Board') || 'Standard Date Board',
      badge: t('Date-Driven') || 'Date-Driven',
      desc: t('Organized by Missed, Today, Tomorrow & Upcoming dates.') || 'Organized by Missed, Today, Tomorrow & Upcoming dates.',
      Icon: IconCalendar,
      accentColor: '#3B82F6',
    },
    {
      id: 'simple_list',
      title: t('Simple List') || 'Simple List',
      badge: t('Clean List') || 'Clean List',
      desc: t('Quick date-free checklist with To-Do & Completed sections.') || 'Quick date-free checklist with To-Do & Completed sections.',
      Icon: IconList,
      accentColor: '#10B981',
    },
    {
      id: 'birthdays',
      title: t('Birthdays & Events') || 'Birthdays & Events',
      badge: t('Auto-Repeat 10 yrs') || 'Auto-Repeat 10 yrs',
      desc: t('Track birthdays & events with automatic 10-year annual reminders.') || 'Track birthdays & events with automatic 10-year annual reminders.',
      Icon: IconGift,
      accentColor: '#EC4899',
    },
    {
      id: 'shopping',
      title: t('Shopping List') || 'Shopping List',
      badge: t('Checklist') || 'Checklist',
      desc: t('Quick shopping list with Need to Buy & Purchased sections.') || 'Quick shopping list with Need to Buy & Purchased sections.',
      Icon: IconShopping,
      accentColor: '#F59E0B',
    },
  ];

  const handleCreate = () => {
    const trimmed = boardName.trim();
    if (!trimmed) return;
    onSubmit({ name: trimmed, type: selectedType });
    setBoardName('');
    setSelectedType('standard');
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
          {t('Create New Board') || 'Create New Board'}
        </Text>

        <TextInput
          testID="prompt_input"
          style={[
            styles.input,
            {
              backgroundColor: colors.bgMain,
              color: colors.textPrimary,
              borderColor: colors.borderColor,
            },
          ]}
          placeholder={t('Board Name (e.g. Birthdays, Groceries)') || 'Board Name'}
          placeholderTextColor={colors.textSecondary}
          value={boardName}
          onChangeText={setBoardName}
          autoFocus={true}
        />

        <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>
          {t('Select Board Type') || 'Select Board Type'}
        </Text>

        <ScrollView style={styles.templateList} showsVerticalScrollIndicator={false}>
          {templates.map((tmpl) => {
            const isSelected = selectedType === tmpl.id;
            const Icon = tmpl.Icon;

            return (
              <TouchableOpacity
                key={tmpl.id}
                testID={`create_board_type_${tmpl.id}`}
                activeOpacity={0.7}
                style={[
                  styles.card,
                  {
                    backgroundColor: isSelected ? `${tmpl.accentColor}12` : colors.bgMain,
                    borderColor: isSelected ? tmpl.accentColor : colors.borderColor,
                  },
                ]}
                onPress={() => setSelectedType(tmpl.id)}
              >
                <View style={styles.cardHeader}>
                  <View style={styles.cardTitleRow}>
                    <View
                      style={[
                        styles.iconWrapper,
                        { backgroundColor: isSelected ? tmpl.accentColor : `${colors.textSecondary}20` },
                      ]}
                    >
                      <Icon color={isSelected ? '#FFF' : colors.textPrimary} />
                    </View>
                    <Text style={[styles.cardTitle, { color: colors.textPrimary }]}>{tmpl.title}</Text>
                  </View>
                  <View
                    style={[
                      styles.badge,
                      { backgroundColor: isSelected ? `${tmpl.accentColor}25` : `${colors.textSecondary}15` },
                    ]}
                  >
                    <Text style={[styles.badgeText, { color: isSelected ? tmpl.accentColor : colors.textSecondary }]}>
                      {tmpl.badge}
                    </Text>
                  </View>
                </View>

                <Text style={[styles.cardDesc, { color: colors.textSecondary }]}>{tmpl.desc}</Text>
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
              { backgroundColor: colors.primary, opacity: boardName.trim() ? 1 : 0.5 },
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
    maxHeight: '85%',
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
    marginBottom: 18,
  },
  sectionLabel: {
    fontSize: 13,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 10,
  },
  templateList: {
    maxHeight: 280,
    marginBottom: 20,
  },
  card: {
    borderRadius: 14,
    borderWidth: 2,
    padding: 14,
    marginBottom: 10,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  cardTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  iconWrapper: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardTitle: {
    fontSize: 16,
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
    fontSize: 13,
    lineHeight: 18,
    paddingLeft: 46,
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
