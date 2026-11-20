import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Platform,
} from 'react-native';
import Svg, { Path, Circle } from 'react-native-svg';
import { useTranslation } from 'react-i18next';
import { HapticHelper } from '../utils/hapticHelper';
import { A11yHelper } from '../utils/a11yHelper';

const IconCircle = ({ color = '#999', size = 20 }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2">
    <Circle cx="12" cy="12" r="10" />
  </Svg>
);

const IconCheckCircle = ({ color = '#5D45DB', size = 20 }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <Path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
    <Path d="M22 4L12 14.01l-3-3" />
  </Svg>
);

const IconClose = ({ color = '#888', size = 18 }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <Path d="M18 6L6 18M6 6l12 12" />
  </Svg>
);

/**
 * Pure helper to order Quick List items stably in creation order
 * so checked items stay right in place (just like Subtasks in Edit Task).
 */
export function sortQuickListItems(tasks = []) {
  return [...(tasks || [])]
    .filter(Boolean)
    .sort((a, b) => {
      const timeA = Date.parse(a.creationDate || a.createdAt || '') || Number(a.id) || 0;
      const timeB = Date.parse(b.creationDate || b.createdAt || '') || Number(b.id) || 0;
      if (timeA !== timeB) return timeA - timeB;
      return String(a.id || a._id || '').localeCompare(String(b.id || b._id || ''));
    });
}

const QuickListRow = React.memo(({
  item,
  accentColor,
  colors,
  placeholder,
  autoFocus,
  inputRefCallback,
  onToggle,
  onSaveText,
  onSubmitNext,
  onDelete,
  onBlurEmpty,
}) => {
  const itemId = String(item.id || item._id);
  const [draftText, setDraftText] = useState(item.taskname || '');
  const lastSavedRef = useRef(item.taskname || '');
  const debounceRef = useRef(null);
  const isCompleted = Boolean(item.completed);

  useEffect(() => {
    const incoming = item.taskname || '';
    if (incoming !== lastSavedRef.current) {
      lastSavedRef.current = incoming;
      setDraftText(incoming);
    }
  }, [item.taskname]);

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  const flushText = useCallback((val) => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
      debounceRef.current = null;
    }
    const trimmed = val.trim();
    if (trimmed !== lastSavedRef.current) {
      lastSavedRef.current = trimmed;
      onSaveText(itemId, trimmed);
    }
  }, [itemId, onSaveText]);

  const handleChangeText = (text) => {
    setDraftText(text);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      const trimmed = text.trim();
      if (trimmed !== lastSavedRef.current) {
        lastSavedRef.current = trimmed;
        onSaveText(itemId, trimmed);
      }
    }, 300);
  };

  const handleBlur = () => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
      debounceRef.current = null;
    }
    const trimmed = draftText.trim();
    if (!trimmed) {
      onBlurEmpty(itemId);
      return;
    }
    if (trimmed !== lastSavedRef.current) {
      lastSavedRef.current = trimmed;
      onSaveText(itemId, trimmed);
    }
  };

  const handleSubmit = () => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
      debounceRef.current = null;
    }
    const trimmed = draftText.trim();
    if (!trimmed) {
      onBlurEmpty(itemId);
      return;
    }
    if (trimmed !== lastSavedRef.current) {
      lastSavedRef.current = trimmed;
      onSaveText(itemId, trimmed);
    }
    onSubmitNext();
  };

  return (
    <View
      testID={`quick_list_item_${itemId}`}
      style={[
        styles.itemRow,
        { borderBottomColor: colors.borderColor || colors.outlineVariant },
      ]}
    >
      <TouchableOpacity
        testID={`quick_list_check_${itemId}`}
        accessible={true}
        accessibilityRole="checkbox"
        accessibilityState={{ checked: isCompleted }}
        accessibilityLabel={isCompleted ? 'Mark item incomplete' : 'Mark item complete'}
        onPress={() => {
          const next = !isCompleted;
          HapticHelper.trigger(next ? 'success' : 'light');
          A11yHelper.announce(next ? 'Item completed' : 'Item uncompleted');
          onToggle(itemId, next);
        }}
        style={styles.checkBtn}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      >
        {isCompleted ? (
          <IconCheckCircle color={accentColor} size={21} />
        ) : (
          <IconCircle color={colors.onSurfaceVariant || colors.textSecondary} size={21} />
        )}
      </TouchableOpacity>

      <TextInput
        ref={(node) => inputRefCallback(itemId, node)}
        testID={`quick_list_input_${itemId}`}
        accessible={true}
        accessibilityRole="text"
        accessibilityLabel={draftText || placeholder}
        style={[
          styles.itemInput,
          { color: colors.textPrimary },
          isCompleted && styles.itemInputCompleted,
        ]}
        value={draftText}
        onChangeText={handleChangeText}
        onBlur={handleBlur}
        onSubmitEditing={handleSubmit}
        placeholder={placeholder}
        placeholderTextColor={colors.onSurfaceVariant || colors.textSecondary}
        autoFocus={autoFocus}
        returnKeyType="next"
        blurOnSubmit={false}
      />

      <TouchableOpacity
        testID={`quick_list_delete_${itemId}`}
        accessible={true}
        accessibilityRole="button"
        accessibilityLabel="Delete item"
        onPress={() => {
          if (debounceRef.current) clearTimeout(debounceRef.current);
          HapticHelper.trigger('light');
          onDelete(itemId);
        }}
        style={styles.deleteBtn}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      >
        <IconClose color={colors.onSurfaceVariant || colors.textSecondary} size={18} />
      </TouchableOpacity>
    </View>
  );
});

export default function QuickListBoard({
  board,
  boardColor,
  tasks = [],
  colors,
  isDark,
  onAddItem,
  onUpdateItemText,
  onToggleItem,
  onDeleteItem,
  onClearCompleted,
}) {
  const { t } = useTranslation();
  const [focusItemId, setFocusItemId] = useState(null);
  const inputRefs = useRef(new Map());
  const scrollRef = useRef(null);

  const orderedItems = useMemo(() => sortQuickListItems(tasks), [tasks]);
  const totalCount = orderedItems.length;
  const completedItems = useMemo(
    () => orderedItems.filter(it => Boolean(it.completed)),
    [orderedItems]
  );
  const completedCount = completedItems.length;
  const progressPct = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;
  // Material You (M3) dynamic palette tokens derived from user's theme sourceColor
  const accentColor = colors.primary;
  const addButtonBg = colors.primaryContainer || colors.primaryLight;
  const addButtonTextColor = colors.onPrimaryContainer || colors.primary;
  const clearBtnBg = colors.errorContainer;
  const clearBtnTextColor = colors.onErrorContainer || colors.danger;
  const progressTrackBg = colors.surfaceContainerHighest || colors.surfaceContainerHigh;

  const registerInputRef = useCallback((id, node) => {
    if (node) {
      inputRefs.current.set(String(id), node);
    } else {
      inputRefs.current.delete(String(id));
    }
  }, []);

  useEffect(() => {
    if (!focusItemId) return;
    const timer = setTimeout(() => {
      const input = inputRefs.current.get(String(focusItemId));
      if (input && typeof input.focus === 'function') {
        input.focus();
      }
      if (scrollRef.current && typeof scrollRef.current.scrollToEnd === 'function') {
        scrollRef.current.scrollToEnd({ animated: true });
      }
      setFocusItemId(null);
    }, 60);
    return () => clearTimeout(timer);
  }, [focusItemId, orderedItems.length]);

  const handleAddNewItem = useCallback(() => {
    HapticHelper.trigger('light');
    const createdId = onAddItem();
    if (createdId) {
      setFocusItemId(String(createdId));
    }
  }, [onAddItem]);

  const handleBlurEmpty = useCallback((itemId) => {
    onDeleteItem(itemId);
  }, [onDeleteItem]);

  const handleClearCompleted = useCallback(() => {
    if (completedItems.length === 0) return;
    HapticHelper.trigger('medium');
    const ids = completedItems.map(it => it.id || it._id).filter(Boolean);
    onClearCompleted(ids);
  }, [completedItems, onClearCompleted]);

  return (
    <ScrollView
      ref={scrollRef}
      testID="quick_list_board_container"
      style={styles.scroll}
      contentContainerStyle={styles.scrollContent}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      {/* Compact Progress & Clear Completed Card */}
      <View
        style={[
          styles.summaryCard,
          {
            backgroundColor: colors.bgCard,
            borderColor: colors.cardBorder || colors.borderColor,
          },
        ]}
      >
        <View style={styles.summaryTopRow}>
          <View style={styles.summaryStats}>
            <Text style={[styles.summaryCount, { color: colors.textPrimary }]}>
              {completedCount} / {totalCount}
            </Text>
            <Text style={[styles.summaryLabel, { color: colors.onSurfaceVariant || colors.textSecondary }]}>
              {t('Completed') || 'Completed'}
            </Text>
          </View>

          {completedCount > 0 && (
            <TouchableOpacity
              testID="quick_list_clear_completed_btn"
              accessible={true}
              accessibilityRole="button"
              accessibilityLabel={t('Clear completed') || 'Clear completed'}
              activeOpacity={0.75}
              onPress={handleClearCompleted}
              style={[
                styles.clearBtn,
                { backgroundColor: clearBtnBg },
              ]}
            >
              <Text style={[styles.clearBtnText, { color: clearBtnTextColor }]}>
                {t('Clear completed') || 'Clear completed'} ({completedCount})
              </Text>
            </TouchableOpacity>
          )}
        </View>

        <View
          style={[
            styles.progressTrack,
            { backgroundColor: progressTrackBg },
          ]}
        >
          <View
            style={[
              styles.progressFill,
              { width: `${progressPct}%`, backgroundColor: accentColor },
            ]}
          />
        </View>
      </View>

      {/* Inline Subtask-Style Checklist Card */}
      <View
        style={[
          styles.listCard,
          {
            backgroundColor: colors.bgCard,
            borderColor: colors.cardBorder || colors.borderColor,
          },
        ]}
      >
        {orderedItems.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={[styles.emptyText, { color: colors.onSurfaceVariant || colors.textSecondary }]}>
              {t('Tap + Add item to start your quick list') || 'Tap + Add item to start your quick list'}
            </Text>
          </View>
        ) : (
          orderedItems.map((item) => {
            const itemId = String(item.id || item._id);
            return (
              <QuickListRow
                key={itemId}
                item={item}
                accentColor={accentColor}
                colors={colors}
                placeholder={t('List item...') || 'List item...'}
                autoFocus={focusItemId === itemId}
                inputRefCallback={registerInputRef}
                onToggle={onToggleItem}
                onSaveText={onUpdateItemText}
                onSubmitNext={handleAddNewItem}
                onDelete={onDeleteItem}
                onBlurEmpty={handleBlurEmpty}
              />
            );
          })
        )}

        <TouchableOpacity
          testID="quick_list_add_item_btn"
          accessible={true}
          accessibilityRole="button"
          accessibilityLabel={t('Add item') || 'Add item'}
          activeOpacity={0.75}
          onPress={handleAddNewItem}
          style={[
            styles.addItemBtn,
            { backgroundColor: addButtonBg },
          ]}
        >
          <Text style={[styles.addItemBtnText, { color: addButtonTextColor }]}>
            + {t('Add item') || 'Add item'}
          </Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 4,
    paddingBottom: 120,
  },
  summaryCard: {
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginBottom: 10,
  },
  summaryTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  summaryStats: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 6,
  },
  summaryCount: {
    fontSize: 16,
    fontWeight: '700',
  },
  summaryLabel: {
    fontSize: 12,
    fontWeight: '600',
  },
  clearBtn: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 10,
  },
  clearBtnText: {
    fontSize: 12,
    fontWeight: '700',
  },
  progressTrack: {
    height: 5,
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 3,
  },
  listCard: {
    borderRadius: 16,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingTop: 6,
    paddingBottom: 12,
  },
  emptyState: {
    paddingVertical: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    fontSize: 14,
    textAlign: 'center',
  },
  itemRow: {
    minHeight: 46,
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: StyleSheet.hairlineWidth,
    paddingVertical: 2,
  },
  checkBtn: {
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
    paddingVertical: 6,
  },
  itemInput: {
    flex: 1,
    fontSize: 15,
    paddingVertical: 10,
    paddingHorizontal: 0,
    borderWidth: 0,
    backgroundColor: 'transparent',
    ...(Platform.OS === 'web' ? { outlineStyle: 'none', outlineWidth: 0 } : {}),
  },
  itemInputCompleted: {
    textDecorationLine: 'line-through',
    opacity: 0.5,
  },
  deleteBtn: {
    padding: 6,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 6,
  },
  addItemBtn: {
    marginTop: 12,
    height: 42,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  addItemBtnText: {
    fontSize: 14,
    fontWeight: '700',
  },
});
