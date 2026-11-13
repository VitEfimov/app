import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  BackHandler,
  Platform,
  useWindowDimensions,
} from 'react-native';
import Svg, { Path, Circle } from 'react-native-svg';
import { useSelector, useDispatch } from 'react-redux';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../styles/ThemeContext';
import { useToast } from '../styles/ToastContext';
import { setBoardCurrency, setBoardExpensesSettings } from '../features/themeSlice';
import { updateBoardRepeatSettings } from '../features/userSlice';
import {
  CURRENCY_OPTION_CODES,
  getCurrencyMeta,
  resolveCurrencyCode,
  parseLocalizedNumber,
  formatCurrency,
} from '../utils/currencyHelper';
import * as Localization from 'expo-localization';

const IconClose = ({ color = '#666', size = 20 }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <Path d="M18 6L6 18M6 6l12 12" />
  </Svg>
);

const IconReceipt = ({ color = '#EF4444', size = 22 }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <Path d="M4 2v20l2-1 2 1 2-1 2 1 2-1 2 1 2-1 2 1V2l-2 1-2-1-2 1-2-1-2 1-2-1-2 1z" />
    <Path d="M16 8h-8M16 12h-8M12 16h-4" />
  </Svg>
);

const REPEAT_PRESETS = [
  { id: 'every_month', label: 'Monthly' },
  { id: 'every_2_weeks', label: 'Bi-weekly' },
  { id: 'every_week', label: 'Weekly' },
  { id: 'every_year', label: 'Annual' },
  { id: 'None', label: 'Manual / Off' },
];

const DURATION_OPTIONS = [
  { count: 3, unit: 'month', label: '3 months' },
  { count: 6, unit: 'month', label: '6 months' },
  { count: 12, unit: 'month', label: '12 months' },
  { count: 24, unit: 'month', label: '24 months' },
];

const REMINDER_OPTIONS = [
  { id: 'None', label: 'None' },
  { id: 'Day of', label: 'Day of (due date)' },
  { id: '15 min before', label: '15 min before' },
  { id: '1 hr before', label: '1 hr before' },
  { id: '1 day before', label: '1 day before' },
  { id: '3 days before', label: '3 days before' },
  { id: '1 week before', label: '1 week before' },
];

const BUDGET_PRESETS = [0, 500, 1000, 2000, 3000, 5000];

export default function PaymentBoardSettingsModal({
  isVisible,
  board,
  onClose,
  colors: propColors,
  isDark: propIsDark,
}) {
  const { t, i18n } = useTranslation();
  const themeContext = useTheme();
  const colors = propColors || themeContext.colors;
  const isDark = propIsDark !== undefined ? propIsDark : themeContext.isDark;
  const { showToast } = useToast();
  const dispatch = useDispatch();
  const { height: windowHeight, width: windowWidth } = useWindowDimensions();

  const themeState = useSelector((state) => state.themeReducer);
  const boardId = board?.id || board?._id;

  const currentExpenseSettings = useMemo(() => {
    if (!boardId || !themeState?.boardExpensesSettings) return {};
    return themeState.boardExpensesSettings[boardId] || {};
  }, [boardId, themeState?.boardExpensesSettings]);

  const [selectedCurrency, setSelectedCurrency] = useState('auto');
  const [selectedRepeatPreset, setSelectedRepeatPreset] = useState('every_month');
  const [selectedDurationCount, setSelectedDurationCount] = useState(12);
  const [selectedDurationUnit, setSelectedDurationUnit] = useState('month');
  const [selectedReminder, setSelectedReminder] = useState('None');
  const [budgetInput, setBudgetInput] = useState('');

  // Synchronize state when modal opens or board changes
  useEffect(() => {
    if (isVisible && boardId) {
      const savedCur = themeState?.boardCurrencies?.[boardId] || 'auto';
      setSelectedCurrency(savedCur);

      const savedRepeat = currentExpenseSettings.repeatPreset !== undefined
        ? currentExpenseSettings.repeatPreset
        : (board?.repeatConfig?.preset || 'every_month');
      setSelectedRepeatPreset(savedRepeat);

      const savedCount = currentExpenseSettings.repeatDurationCount !== undefined
        ? currentExpenseSettings.repeatDurationCount
        : (board?.repeatDuration?.count || 12);
      setSelectedDurationCount(Number(savedCount) || 12);

      const savedUnit = currentExpenseSettings.repeatDurationUnit || board?.repeatDuration?.unit || 'month';
      setSelectedDurationUnit(savedUnit);

      const savedReminder = currentExpenseSettings.defaultReminder || 'None';
      setSelectedReminder(savedReminder);

      const savedBudget = currentExpenseSettings.monthlyBudget !== undefined && currentExpenseSettings.monthlyBudget !== null
        ? String(currentExpenseSettings.monthlyBudget)
        : '';
      setBudgetInput(savedBudget);
    }
  }, [isVisible, boardId, currentExpenseSettings, board, themeState?.boardCurrencies]);

  // Hardware back press handler on Android Fabric
  useEffect(() => {
    if (!isVisible) return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      onClose();
      return true;
    });
    return () => sub.remove();
  }, [isVisible, onClose]);

  const deviceCurrencyCode = useMemo(() => {
    try {
      return Localization.getLocales?.()?.[0]?.currencyCode || null;
    } catch (e) {
      return null;
    }
  }, []);

  const effectiveCurrencyCode = useMemo(() => {
    return resolveCurrencyCode({
      boardCurrencyCode: selectedCurrency,
      settingCode: themeState?.currencyCode || 'auto',
      langCode: i18n?.language,
      deviceCurrencyCode,
    });
  }, [selectedCurrency, themeState?.currencyCode, i18n?.language, deviceCurrencyCode]);

  const currencyMeta = useMemo(() => getCurrencyMeta(effectiveCurrencyCode), [effectiveCurrencyCode]);

  const parsedBudgetVal = useMemo(() => {
    const trimmed = budgetInput.trim();
    if (!trimmed) return null;
    const num = parseLocalizedNumber(trimmed);
    return isNaN(num) || num <= 0 ? null : num;
  }, [budgetInput]);

  const handleSave = () => {
    if (!boardId) {
      onClose();
      return;
    }

    // 1. Currency
    dispatch(setBoardCurrency({ boardId, currencyCode: selectedCurrency }));

    // 2. Expenses Settings (Budget, Default Reminder, Repeat cycle & duration)
    const newSettings = {
      monthlyBudget: parsedBudgetVal,
      repeatPreset: selectedRepeatPreset,
      repeatDurationCount: selectedDurationCount,
      repeatDurationUnit: selectedDurationUnit,
      defaultReminder: selectedReminder,
    };
    dispatch(setBoardExpensesSettings({ boardId, settings: newSettings }));

    // 3. User Board metadata synchronization
    const newRepeatConfig = selectedRepeatPreset === 'None' ? null : { preset: selectedRepeatPreset };
    const newRepeatDuration = { count: selectedDurationCount, unit: selectedDurationUnit };
    dispatch(updateBoardRepeatSettings({
      boardId,
      repeatConfig: newRepeatConfig,
      repeatDuration: newRepeatDuration,
    }));

    if (showToast) {
      showToast(t('Payment board settings updated') || 'Payment board settings updated');
    }
    onClose();
  };

  if (!isVisible) return null;

  const primaryAccent = colors.primary || '#5D45DB';
  const cardBg = colors.bgCard || (isDark ? '#1E1E1E' : '#FFFFFF');
  const chipBgInactive = isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.05)';
  const borderCol = colors.borderColor || (isDark ? 'rgba(255, 255, 255, 0.12)' : '#E5E7EB');

  return (
    <View style={[StyleSheet.absoluteFillObject, styles.overlay, { zIndex: 99999, elevation: 99999 }]}>
      <TouchableOpacity
        style={styles.backdrop}
        activeOpacity={1}
        onPress={onClose}
        accessible={true}
        accessibilityLabel={t('Close')}
      />

      <View
        style={[
          styles.sheetContainer,
          {
            backgroundColor: colors.bgMain || (isDark ? '#121212' : '#F9FAFB'),
            maxHeight: windowHeight * 0.92,
            borderTopColor: borderCol,
          },
        ]}
      >
        {/* Modal Header */}
        <View style={[styles.headerRow, { borderBottomColor: borderCol }]}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <View style={[styles.iconBadge, { backgroundColor: isDark ? 'rgba(239, 68, 68, 0.2)' : 'rgba(239, 68, 68, 0.12)' }]}>
              <IconReceipt color="#EF4444" size={22} />
            </View>
            <View>
              <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>
                {t('Payment Board Settings') || 'Payment Board Settings'}
              </Text>
              <Text style={[styles.headerSubtitle, { color: colors.textSecondary }]}>
                {board?.name || 'Payments'}
              </Text>
            </View>
          </View>

          <TouchableOpacity
            onPress={onClose}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            style={[styles.closeBtn, { backgroundColor: chipBgInactive }]}
            accessible={true}
            accessibilityRole="button"
            accessibilityLabel={t('Close')}
          >
            <IconClose color={colors.textSecondary} size={18} />
          </TouchableOpacity>
        </View>

        {/* Scrollable Form Body */}
        <ScrollView
          style={styles.scrollBody}
          contentContainerStyle={{ paddingBottom: 24 }}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* SECTION 1: Monthly Budget Target */}
          <View style={[styles.sectionCard, { backgroundColor: cardBg, borderColor: borderCol }]}>
            <View style={styles.sectionTitleRow}>
              <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>
                {t('Monthly Budget Limit') || 'Monthly Budget Limit'}
              </Text>
              {parsedBudgetVal !== null && (
                <View style={[styles.budgetChip, { backgroundColor: isDark ? 'rgba(16, 185, 129, 0.2)' : 'rgba(16, 185, 129, 0.12)' }]}>
                  <Text style={{ fontSize: 11, fontWeight: '700', color: '#10B981' }}>
                    {formatCurrency(parsedBudgetVal, effectiveCurrencyCode)}
                  </Text>
                </View>
              )}
            </View>
            <Text style={[styles.sectionSubtitle, { color: colors.textSecondary }]}>
              {t('Track spending progress and remaining balance in the summary bar') || 'Track spending progress and remaining balance in the summary bar'}
            </Text>

            <View style={[styles.budgetInputRow, { borderColor: borderCol, backgroundColor: isDark ? 'rgba(0,0,0,0.3)' : 'rgba(0,0,0,0.02)' }]}>
              <Text style={[styles.budgetCurrencyPrefix, { color: primaryAccent }]}>
                {currencyMeta.symbol}
              </Text>
              <TextInput
                value={budgetInput}
                onChangeText={setBudgetInput}
                placeholder="0.00"
                placeholderTextColor={colors.textSecondary}
                keyboardType="numeric"
                style={[styles.budgetTextInput, { color: colors.textPrimary }]}
              />
              {budgetInput.length > 0 && (
                <TouchableOpacity
                  onPress={() => setBudgetInput('')}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  style={{ padding: 4 }}
                >
                  <Text style={{ fontSize: 13, fontWeight: 'bold', color: colors.textSecondary }}>✕</Text>
                </TouchableOpacity>
              )}
            </View>

            {/* Quick Budget Suggestion Chips */}
            <View style={styles.quickChipsRow}>
              {BUDGET_PRESETS.map((val) => {
                const isSelected = (val === 0 && !parsedBudgetVal) || (parsedBudgetVal === val);
                const chipLabel = val === 0 ? (t('No budget set') || 'No budget') : formatCurrency(val, effectiveCurrencyCode);
                return (
                  <TouchableOpacity
                    key={val}
                    onPress={() => setBudgetInput(val === 0 ? '' : String(val))}
                    style={[
                      styles.quickChip,
                      {
                        backgroundColor: isSelected ? primaryAccent : chipBgInactive,
                        borderColor: isSelected ? primaryAccent : borderCol,
                      },
                    ]}
                  >
                    <Text style={[styles.quickChipText, { color: isSelected ? '#FFFFFF' : colors.textPrimary }]}>
                      {chipLabel}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          {/* SECTION 2: Billing Cycle & Auto-Repeat */}
          <View style={[styles.sectionCard, { backgroundColor: cardBg, borderColor: borderCol }]}>
            <View style={styles.sectionTitleRow}>
              <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>
                {t('Billing Cycle & Repeat') || 'Billing Cycle & Repeat'}
              </Text>
              <View style={[styles.budgetChip, { backgroundColor: isDark ? 'rgba(59, 130, 246, 0.2)' : 'rgba(59, 130, 246, 0.12)' }]}>
                <Text style={{ fontSize: 11, fontWeight: '700', color: '#3B82F6' }}>
                  {t(REPEAT_PRESETS.find(p => p.id === selectedRepeatPreset)?.label || selectedRepeatPreset)}
                </Text>
              </View>
            </View>
            <Text style={[styles.sectionSubtitle, { color: colors.textSecondary }]}>
              {t('Default recurrence applied to bills added to this board') || 'Default recurrence applied to bills added to this board'}
            </Text>

            <View style={styles.optionsWrap}>
              {REPEAT_PRESETS.map((p) => {
                const isSelected = selectedRepeatPreset === p.id;
                return (
                  <TouchableOpacity
                    key={p.id}
                    onPress={() => setSelectedRepeatPreset(p.id)}
                    style={[
                      styles.selectPill,
                      {
                        backgroundColor: isSelected ? primaryAccent : chipBgInactive,
                        borderColor: isSelected ? primaryAccent : borderCol,
                      },
                    ]}
                  >
                    <Text style={[styles.selectPillText, { color: isSelected ? '#FFFFFF' : colors.textPrimary }]}>
                      {t(p.label) || p.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Repeat Generation Duration (Visible if repeat != 'None') */}
            {selectedRepeatPreset !== 'None' && (
              <View style={{ marginTop: 12, paddingTop: 10, borderTopWidth: 1, borderTopColor: borderCol }}>
                <Text style={[styles.subLabel, { color: colors.textSecondary }]}>
                  {t('Generate Ahead Duration') || 'Generate Ahead Duration'}:
                </Text>
                <View style={styles.optionsWrap}>
                  {DURATION_OPTIONS.map((d) => {
                    const isSelected = selectedDurationCount === d.count && selectedDurationUnit === d.unit;
                    return (
                      <TouchableOpacity
                        key={`${d.count}_${d.unit}`}
                        onPress={() => {
                          setSelectedDurationCount(d.count);
                          setSelectedDurationUnit(d.unit);
                        }}
                        style={[
                          styles.selectPill,
                          {
                            backgroundColor: isSelected ? (isDark ? 'rgba(59, 130, 246, 0.3)' : '#DBEAFE') : chipBgInactive,
                            borderColor: isSelected ? '#3B82F6' : borderCol,
                          },
                        ]}
                      >
                        <Text style={[styles.selectPillText, { color: isSelected ? (isDark ? '#93C5FD' : '#1D4ED8') : colors.textPrimary }]}>
                          {t(d.label) || d.label}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            )}
          </View>

          {/* SECTION 3: Default Bill Reminder */}
          <View style={[styles.sectionCard, { backgroundColor: cardBg, borderColor: borderCol }]}>
            <View style={styles.sectionTitleRow}>
              <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>
                {t('Default Bill Reminder') || 'Default Bill Reminder'}
              </Text>
              <View style={[styles.budgetChip, { backgroundColor: isDark ? 'rgba(245, 158, 11, 0.2)' : 'rgba(245, 158, 11, 0.12)' }]}>
                <Text style={{ fontSize: 11, fontWeight: '700', color: '#D97706' }}>
                  🔔 {t(selectedReminder) || selectedReminder}
                </Text>
              </View>
            </View>
            <Text style={[styles.sectionSubtitle, { color: colors.textSecondary }]}>
              {t('Automatically notifies you before upcoming bills and payment due dates') || 'Automatically notifies you before upcoming bills and payment due dates'}
            </Text>

            <View style={styles.optionsWrap}>
              {REMINDER_OPTIONS.map((r) => {
                const isSelected = selectedReminder === r.id;
                return (
                  <TouchableOpacity
                    key={r.id}
                    onPress={() => setSelectedReminder(r.id)}
                    style={[
                      styles.selectPill,
                      {
                        backgroundColor: isSelected ? primaryAccent : chipBgInactive,
                        borderColor: isSelected ? primaryAccent : borderCol,
                      },
                    ]}
                  >
                    <Text style={[styles.selectPillText, { color: isSelected ? '#FFFFFF' : colors.textPrimary }]}>
                      {t(r.label) || r.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          {/* SECTION 4: Board Currency Override */}
          <View style={[styles.sectionCard, { backgroundColor: cardBg, borderColor: borderCol }]}>
            <View style={styles.sectionTitleRow}>
              <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>
                {t('Currency') || 'Currency'}
              </Text>
              <View style={[styles.budgetChip, { backgroundColor: isDark ? 'rgba(139, 92, 246, 0.2)' : 'rgba(139, 92, 246, 0.12)' }]}>
                <Text style={{ fontSize: 11, fontWeight: '700', color: '#8B5CF6' }}>
                  {currencyMeta.symbol} {currencyMeta.code}
                </Text>
              </View>
            </View>
            <Text style={[styles.sectionSubtitle, { color: colors.textSecondary }]}>
              {t('Currency symbol and formatting for this board') || 'Currency symbol and formatting for this board'}
            </Text>

            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6, paddingVertical: 4 }}>
              {CURRENCY_OPTION_CODES.map((code) => {
                const isSelected = selectedCurrency === code;
                const label = code === 'auto' ? (t('Auto') || 'Auto') : `${code} (${getCurrencyMeta(code).symbol})`;
                return (
                  <TouchableOpacity
                    key={code}
                    onPress={() => setSelectedCurrency(code)}
                    style={[
                      styles.quickChip,
                      {
                        backgroundColor: isSelected ? primaryAccent : chipBgInactive,
                        borderColor: isSelected ? primaryAccent : borderCol,
                      },
                    ]}
                  >
                    <Text style={[styles.quickChipText, { color: isSelected ? '#FFFFFF' : colors.textPrimary }]}>
                      {label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        </ScrollView>

        {/* Modal Footer (Action Buttons) */}
        <View style={[styles.footerRow, { borderTopColor: borderCol }]}>
          <TouchableOpacity
            style={[styles.cancelBtn, { borderColor: borderCol }]}
            onPress={onClose}
            accessible={true}
            accessibilityRole="button"
          >
            <Text style={[styles.cancelBtnText, { color: colors.textSecondary }]}>
              {t('Cancel') || 'Cancel'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.saveBtn, { backgroundColor: primaryAccent }]}
            onPress={handleSave}
            accessible={true}
            accessibilityRole="button"
          >
            <Text style={styles.saveBtnText}>
              {t('Save changes') || 'Save Changes'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
  },
  sheetContainer: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderTopWidth: 1,
    overflow: 'hidden',
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 18,
    paddingVertical: 14,
    borderBottomWidth: 1,
  },
  iconBadge: {
    width: 38,
    height: 38,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  headerSubtitle: {
    fontSize: 12,
    fontWeight: '500',
    marginTop: 1,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollBody: {
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  sectionCard: {
    borderRadius: 14,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
  },
  sectionTitleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '700',
  },
  sectionSubtitle: {
    fontSize: 11,
    marginTop: 2,
    marginBottom: 10,
  },
  budgetChip: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  budgetInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: Platform.OS === 'ios' ? 10 : 4,
    marginBottom: 8,
  },
  budgetCurrencyPrefix: {
    fontSize: 17,
    fontWeight: 'bold',
    marginRight: 8,
  },
  budgetTextInput: {
    flex: 1,
    fontSize: 16,
    fontWeight: '700',
  },
  quickChipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 4,
  },
  quickChip: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
  },
  quickChipText: {
    fontSize: 11,
    fontWeight: '600',
  },
  subLabel: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 6,
  },
  optionsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  selectPill: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 10,
    borderWidth: 1,
  },
  selectPillText: {
    fontSize: 12,
    fontWeight: '600',
  },
  footerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderTopWidth: 1,
  },
  cancelBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelBtnText: {
    fontSize: 14,
    fontWeight: '600',
  },
  saveBtn: {
    flex: 2,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 3,
  },
  saveBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
});

