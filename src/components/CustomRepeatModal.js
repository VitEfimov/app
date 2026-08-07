import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, TextInput } from 'react-native';
import Modal from 'react-native-modal';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../styles/ThemeContext';
import CustomDropdown from './CustomDropdown';

export default function CustomRepeatModal({ isVisible, onClose, onSave, initialConfig }) {
  const { t } = useTranslation();
  const { colors } = useTheme();

  const [preset, setPreset] = useState('None');
  const [customFreq, setCustomFreq] = useState('days');
  const [customInterval, setCustomInterval] = useState('1');
  const [customDaysOfWeek, setCustomDaysOfWeek] = useState([]);
  const [customMonthlyType, setCustomMonthlyType] = useState('same_day');
  const [customNthWeekday, setCustomNthWeekday] = useState({ n: 1, weekday: 1 });

  useEffect(() => {
    if (initialConfig) {
      setPreset(initialConfig.preset || 'None');
      setCustomFreq(initialConfig.customFreq || 'days');
      setCustomInterval(initialConfig.customInterval ? String(initialConfig.customInterval) : '1');
      setCustomDaysOfWeek(initialConfig.customDaysOfWeek || []);
      setCustomMonthlyType(initialConfig.customMonthlyType || 'same_day');
      setCustomNthWeekday(initialConfig.customNthWeekday || { n: 1, weekday: 1 });
    }
  }, [initialConfig, isVisible]);

  const handleSave = () => {
    onSave({
      preset,
      customFreq,
      customInterval: parseInt(customInterval, 10) || 1,
      customDaysOfWeek,
      customMonthlyType,
      customNthWeekday
    });
    onClose();
  };

  const toggleDayOfWeek = (dayIndex) => {
    if (customDaysOfWeek.includes(dayIndex)) {
      setCustomDaysOfWeek(customDaysOfWeek.filter(d => d !== dayIndex));
    } else {
      setCustomDaysOfWeek([...customDaysOfWeek, dayIndex].sort());
    }
  };

  const presetOptions = [
    { id: 'None', label: t('None (Does not repeat)') },
    { id: 'every_day', label: t('Every day') },
    { id: 'every_weekday', label: t('Every weekday (Mon-Fri)') },
    { id: 'every_weekend', label: t('Every weekend (Sat-Sun)') },
    { id: 'every_week', label: t('Every week') },
    { id: 'every_2_weeks', label: t('Every 2 weeks') },
    { id: 'every_month', label: t('Every month') },
    { id: 'every_year', label: t('Every year') },
    { id: 'custom', label: t('Custom...') }
  ];

  const daysLabels = ['S', 'M', 'T', 'W', 'T', 'F', 'S']; // 0 is Sunday in JS

  return (
    <Modal
      isVisible={isVisible}
      onSwipeComplete={onClose}
      swipeDirection={['down']}
      propagateSwipe={true}
      onBackdropPress={onClose}
      style={{ margin: 0, justifyContent: 'flex-end' }}
    >
      <View style={[styles.modalContent, { backgroundColor: colors.bgCard }]}>
        <View style={styles.dragHandle} />
        
        <View style={styles.header}>
          <Text style={[styles.title, { color: colors.textPrimary }]}>{t('Repeat Task')}</Text>
          <TouchableOpacity onPress={handleSave}>
            <Text style={[styles.saveBtn, { color: colors.primary }]}>{t('Done')}</Text>
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.scroll}>
          {presetOptions.map(opt => (
            <TouchableOpacity 
              key={opt.id} 
              style={[styles.presetRow, { borderBottomColor: colors.borderColor }]} 
              onPress={() => setPreset(opt.id)}
            >
              <Text style={[styles.presetLabel, { color: preset === opt.id ? colors.primary : colors.textPrimary, fontWeight: preset === opt.id ? 'bold' : 'normal' }]}>
                {opt.label}
              </Text>
              {preset === opt.id && <Text style={{ color: colors.primary, fontSize: 18 }}>✓</Text>}
            </TouchableOpacity>
          ))}

          {preset === 'custom' && (
            <View style={styles.customContainer}>
              <Text style={[styles.customHeader, { color: colors.textSecondary }]}>{t('Custom Repetition')}</Text>
              
              <View style={styles.row}>
                <Text style={{ color: colors.textPrimary, fontSize: 16, marginRight: 10 }}>{t('Repeat every')}</Text>
                <TextInput 
                  style={[styles.numberInput, { color: colors.textPrimary, borderColor: colors.borderColor, backgroundColor: colors.bgMain }]}
                  keyboardType="numeric"
                  value={customInterval}
                  onChangeText={setCustomInterval}
                />
                <View style={{ flex: 1, marginLeft: 10 }}>
                  <CustomDropdown
                    value={customFreq}
                    options={[
                      { label: t('days'), value: 'days' },
                      { label: t('weeks'), value: 'weeks' },
                      { label: t('months'), value: 'months' },
                      { label: t('years'), value: 'years' },
                    ]}
                    onSelect={setCustomFreq}
                    colors={colors}
                    customBtnStyle={{ height: 40 }}
                  />
                </View>
              </View>

              {customFreq === 'weeks' && (
                <View style={styles.daysContainer}>
                  <Text style={{ color: colors.textPrimary, marginBottom: 10 }}>{t('Repeat on')}</Text>
                  <View style={styles.daysRow}>
                    {daysLabels.map((lbl, idx) => {
                      const isSelected = customDaysOfWeek.includes(idx);
                      return (
                        <TouchableOpacity 
                          key={idx} 
                          onPress={() => toggleDayOfWeek(idx)}
                          style={[styles.dayCircle, { 
                            backgroundColor: isSelected ? colors.primary : colors.bgMain,
                            borderColor: colors.borderColor
                          }]}
                        >
                          <Text style={{ color: isSelected ? 'white' : colors.textPrimary, fontWeight: 'bold' }}>{lbl}</Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>
              )}

              {customFreq === 'months' && (
                <View style={styles.monthlyContainer}>
                  <Text style={{ color: colors.textPrimary, marginBottom: 10 }}>{t('Monthly type')}</Text>
                  <View style={styles.radioGroup}>
                    {[
                      { val: 'same_day', label: t('Same day of month (e.g. 15th)') },
                      { val: 'last_day', label: t('Last day of the month') },
                      { val: 'first_workday', label: t('First workday of the month') },
                      { val: 'nth_weekday', label: t('Specific weekday (e.g. 2nd Tuesday)') }
                    ].map(r => (
                      <TouchableOpacity 
                        key={r.val} 
                        style={styles.radioRow}
                        onPress={() => setCustomMonthlyType(r.val)}
                      >
                        <View style={[styles.radioOuter, { borderColor: customMonthlyType === r.val ? colors.primary : colors.textSecondary }]}>
                          {customMonthlyType === r.val && <View style={[styles.radioInner, { backgroundColor: colors.primary }]} />}
                        </View>
                        <Text style={{ color: colors.textPrimary }}>{r.label}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>

                  {customMonthlyType === 'nth_weekday' && (
                    <View style={styles.row}>
                      <CustomDropdown
                        value={String(customNthWeekday.n)}
                        options={[
                          { label: 'First', value: '1' },
                          { label: 'Second', value: '2' },
                          { label: 'Third', value: '3' },
                          { label: 'Fourth', value: '4' },
                          { label: 'Last', value: '5' },
                        ]}
                        onSelect={(v) => setCustomNthWeekday({...customNthWeekday, n: parseInt(v, 10)})}
                        colors={colors}
                        customBtnStyle={{ height: 40, flex: 1, marginRight: 5 }}
                      />
                      <CustomDropdown
                        value={String(customNthWeekday.weekday)}
                        options={[
                          { label: 'Sunday', value: '0' },
                          { label: 'Monday', value: '1' },
                          { label: 'Tuesday', value: '2' },
                          { label: 'Wednesday', value: '3' },
                          { label: 'Thursday', value: '4' },
                          { label: 'Friday', value: '5' },
                          { label: 'Saturday', value: '6' },
                        ]}
                        onSelect={(v) => setCustomNthWeekday({...customNthWeekday, weekday: parseInt(v, 10)})}
                        colors={colors}
                        customBtnStyle={{ height: 40, flex: 1, marginLeft: 5 }}
                      />
                    </View>
                  )}
                </View>
              )}

            </View>
          )}

        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalContent: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: 15,
    paddingBottom: 30,
    paddingHorizontal: 20,
    maxHeight: '90%'
  },
  dragHandle: {
    width: 40,
    height: 5,
    backgroundColor: '#888',
    borderRadius: 3,
    marginBottom: 20,
    alignSelf: 'center'
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15,
    paddingBottom: 15,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(128,128,128,0.2)'
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  saveBtn: {
    fontSize: 16,
    fontWeight: 'bold'
  },
  scroll: {
    width: '100%'
  },
  presetRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 15,
    borderBottomWidth: 1,
  },
  presetLabel: {
    fontSize: 16,
  },
  customContainer: {
    marginTop: 20,
    padding: 15,
    backgroundColor: 'rgba(0,0,0,0.03)',
    borderRadius: 12
  },
  customHeader: {
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: 15,
    textTransform: 'uppercase'
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20
  },
  numberInput: {
    width: 50,
    height: 40,
    borderWidth: 1,
    borderRadius: 8,
    textAlign: 'center',
    fontSize: 16
  },
  daysContainer: {
    marginBottom: 20
  },
  daysRow: {
    flexDirection: 'row',
    justifyContent: 'space-between'
  },
  dayCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center'
  },
  monthlyContainer: {
    marginBottom: 20
  },
  radioGroup: {
    marginBottom: 15
  },
  radioRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12
  },
  radioOuter: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    marginRight: 10,
    alignItems: 'center',
    justifyContent: 'center'
  },
  radioInner: {
    width: 10,
    height: 10,
    borderRadius: 5
  }
});
