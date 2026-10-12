import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, KeyboardAvoidingView, Platform } from 'react-native';
import Modal from 'react-native-modal';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../styles/ThemeContext';

export default function CustomReminderModal({ isVisible, onClose, onSave, initialValue }) {
  const { t } = useTranslation();
  const { colors, isDark } = useTheme();

  const [amount, setAmount] = useState('10');
  const [unit, setUnit] = useState('min'); // 'min', 'hr', 'day'

  useEffect(() => {
    if (initialValue && typeof initialValue === 'string') {
      const match = initialValue.match(/^(\d+)\s*(min|minute|hr|hour|day)s?\s*before$/i);
      if (match) {
        setAmount(match[1]);
        const u = match[2].toLowerCase();
        if (u.startsWith('min')) setUnit('min');
        else if (u.startsWith('hr') || u.startsWith('hour')) setUnit('hr');
        else setUnit('day');
        return;
      }
    }
    setAmount('10');
    setUnit('min');
  }, [initialValue, isVisible]);

  const handleSave = () => {
    const val = parseInt(amount, 10);
    if (!val || val <= 0) {
      onClose();
      return;
    }
    const unitLabel = unit === 'min' ? 'min' : unit === 'hr' ? 'hr' : val === 1 ? 'day' : 'days';
    const reminderStr = `${val} ${unitLabel} before`;
    onSave(reminderStr);
    onClose();
  };

  const quickPresets = [
    { label: '5 min', amount: '5', unit: 'min' },
    { label: '10 min', amount: '10', unit: 'min' },
    { label: '45 min', amount: '45', unit: 'min' },
    { label: '2 hr', amount: '2', unit: 'hr' },
    { label: '3 hr', amount: '3', unit: 'hr' },
    { label: '2 days', amount: '2', unit: 'day' },
  ];

  const getUnitFull = () => {
    const val = parseInt(amount, 10) || 1;
    if (unit === 'min') return val === 1 ? t('minute') : t('minutes');
    if (unit === 'hr') return val === 1 ? t('hour') : t('hours');
    return val === 1 ? t('day') : t('days');
  };

  return (
    <Modal
      isVisible={isVisible}
      onSwipeComplete={onClose}
      swipeDirection={['down']}
      onBackdropPress={onClose}
      style={styles.modal}
      avoidKeyboard={true}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={[styles.modalContent, { backgroundColor: colors.bgCard, borderColor: colors.borderColor }]}
      >
        <View style={styles.dragHandle} />

        <View style={styles.header}>
          <Text style={[styles.title, { color: colors.textPrimary }]}>{t('Custom Reminder') || 'Custom Reminder'}</Text>
          <TouchableOpacity onPress={handleSave}>
            <Text style={[styles.saveBtn, { color: colors.primary }]}>{t('Done') || 'Done'}</Text>
          </TouchableOpacity>
        </View>

        {/* Input & Unit Row */}
        <View style={styles.inputRow}>
          <TextInput
            style={[styles.numberInput, { 
              backgroundColor: colors.surfaceContainerHigh || 'rgba(0,0,0,0.05)', 
              color: colors.textPrimary,
              borderColor: colors.borderColor
            }]}
            value={amount}
            onChangeText={(txt) => setAmount(txt.replace(/[^0-9]/g, ''))}
            keyboardType="number-pad"
            maxLength={3}
            placeholder="10"
            placeholderTextColor={colors.textSecondary}
            autoFocus={false}
          />

          <View style={styles.unitSelector}>
            {[
              { id: 'min', label: t('min') || 'min' },
              { id: 'hr', label: t('hr') || 'hr' },
              { id: 'day', label: t('day') || 'day' }
            ].map(item => (
              <TouchableOpacity
                key={item.id}
                style={[
                  styles.unitBtn,
                  unit === item.id 
                    ? { backgroundColor: colors.primary } 
                    : { backgroundColor: colors.surfaceContainer || 'rgba(0,0,0,0.04)' }
                ]}
                onPress={() => setUnit(item.id)}
              >
                <Text style={[
                  styles.unitBtnText,
                  { color: unit === item.id ? (colors.textInverse || '#fff') : colors.textPrimary }
                ]}>
                  {item.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Preview String */}
        <View style={[styles.previewContainer, { backgroundColor: colors.surfaceContainer || 'rgba(0,0,0,0.04)' }]}>
          <Text style={[styles.previewText, { color: colors.textSecondary }]}>
            {t('Remind before task') || 'Remind before task'}:{' '}
            <Text style={{ color: colors.primary, fontWeight: 'bold' }}>
              {amount || '0'} {getUnitFull()} {t('before') || 'before'}
            </Text>
          </Text>
        </View>

        {/* Quick Presets */}
        <Text style={[styles.sectionSubtitle, { color: colors.textSecondary }]}>{t('Quick Presets') || 'Quick Presets'}</Text>
        <View style={styles.presetsGrid}>
          {quickPresets.map((preset, idx) => (
            <TouchableOpacity
              key={idx}
              style={[
                styles.presetChip,
                { 
                  borderColor: amount === preset.amount && unit === preset.unit ? colors.primary : colors.borderColor,
                  backgroundColor: amount === preset.amount && unit === preset.unit ? `${colors.primary}15` : 'transparent'
                }
              ]}
              onPress={() => {
                setAmount(preset.amount);
                setUnit(preset.unit);
              }}
            >
              <Text style={[
                styles.presetChipText,
                { color: amount === preset.amount && unit === preset.unit ? colors.primary : colors.textPrimary }
              ]}>
                {preset.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Action Buttons */}
        <View style={styles.footerBtns}>
          <TouchableOpacity 
            style={[styles.cancelBtn, { borderColor: colors.borderColor }]} 
            onPress={onClose}
          >
            <Text style={[styles.cancelBtnText, { color: colors.textPrimary }]}>{t('Cancel')}</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={[styles.confirmBtn, { backgroundColor: colors.primary }]} 
            onPress={handleSave}
          >
            <Text style={[styles.confirmBtnText, { color: colors.textInverse || '#fff' }]}>{t('Set Reminder') || 'Set Reminder'}</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modal: {
    margin: 0,
    justifyContent: 'flex-end',
  },
  modalContent: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    paddingBottom: Platform.OS === 'ios' ? 36 : 24,
    borderWidth: 1,
  },
  dragHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#888',
    opacity: 0.4,
    alignSelf: 'center',
    marginBottom: 15,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  saveBtn: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 16,
  },
  numberInput: {
    width: 80,
    height: 48,
    borderRadius: 12,
    borderWidth: 1,
    textAlign: 'center',
    fontSize: 20,
    fontWeight: 'bold',
  },
  unitSelector: {
    flex: 1,
    flexDirection: 'row',
    gap: 8,
  },
  unitBtn: {
    flex: 1,
    height: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  unitBtnText: {
    fontSize: 14,
    fontWeight: '600',
  },
  previewContainer: {
    padding: 12,
    borderRadius: 10,
    marginBottom: 16,
    alignItems: 'center',
  },
  previewText: {
    fontSize: 14,
  },
  sectionSubtitle: {
    fontSize: 12,
    fontWeight: 'bold',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 10,
  },
  presetsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 24,
  },
  presetChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
  },
  presetChipText: {
    fontSize: 13,
    fontWeight: '600',
  },
  footerBtns: {
    flexDirection: 'row',
    gap: 12,
  },
  cancelBtn: {
    flex: 1,
    height: 46,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelBtnText: {
    fontSize: 15,
    fontWeight: '600',
  },
  confirmBtn: {
    flex: 2,
    height: 46,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmBtnText: {
    fontSize: 15,
    fontWeight: 'bold',
  },
});
