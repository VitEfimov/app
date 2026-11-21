import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Platform,
  Keyboard,
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
 * Extracts a stable numeric creation timestamp (ms) from a Quick List task.
 * Falls back to parsing a leading epoch timestamp from IDs like "1763699123456_a1b2".
 */
export function extractQuickListTimestamp(task) {
  if (!task) return 0;
  const parsed = Date.parse(task.creationDate || task.createdAt || '');
  if (!Number.isNaN(parsed) && parsed > 0) return parsed;
  const rawId = String(task.id || task._id || '');
  const leadingNum = parseInt(rawId, 10);
  if (!Number.isNaN(leadingNum) && leadingNum > 1000000000000) return leadingNum;
  return 0;
}

/**
 * Pure helper to order Quick List items stably in creation order
 * so checked and edited items stay right in place (just like Subtasks in Edit Task).
 */
export function sortQuickListItems(tasks = []) {
  return [...(tasks || [])]
    .filter(Boolean)
    .sort((a, b) => {
      const timeA = extractQuickListTimestamp(a);
      const timeB = extractQuickListTimestamp(b);
      if (timeA !== timeB) return timeA - timeB;
      return String(a.id || a._id || '').localeCompare(String(b.id || b._id || ''));
    });
}

const QuickListRow = React.memo(({
  item,
  accentColor,
  colors,
  placeholder,
  inputRefCallback,
  onRowLayout,
  onFocusItem,
  onToggle,
  onSaveText,
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
      onBlurEmpty(itemId, { fromSubmit: true });
      return;
    }
    if (trimmed !== lastSavedRef.current) {
      lastSavedRef.current = trimmed;
      onSaveText(itemId, trimmed);
    }
    // Pressing Done/Enter on keyboard finishes editing this item in place (just like Subtasks in Edit Task)
    // and never creates a new task or jumps to the bottom.
  };

  return (
    <View
      testID={`quick_list_item_${itemId}`}
      onLayout={() => {
        if (onRowLayout) onRowLayout(itemId);
      }}
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
        onFocus={() => {
          if (onFocusItem) onFocusItem(itemId);
        }}
        onBlur={handleBlur}
        onSubmitEditing={handleSubmit}
        placeholder={placeholder}
        placeholderTextColor={colors.onSurfaceVariant || colors.textSecondary}
        returnKeyType="done"
        blurOnSubmit={true}
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
  const inputRefs = useRef(new Map());
  const laidOutRowsRef = useRef(new Set());
  const contentSizeReadyForIdRef = useRef(null);
  const scrollRef = useRef(null);
  const focusedItemIdRef = useRef(null);
  const pendingFocusIdRef = useRef(null);
  const suppressFocusBounceUntilRef = useRef(0);
  const emptyBlurTimersRef = useRef(new Map());
  const pendingScrollToEndRef = useRef(false);
  const lastItemIdRef = useRef(null);

  const orderedItems = useMemo(() => sortQuickListItems(tasks), [tasks]);
  const totalCount = orderedItems.length;
  lastItemIdRef.current = totalCount > 0
    ? String(orderedItems[totalCount - 1].id || orderedItems[totalCount - 1]._id)
    : null;
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

  const scrollListToEnd = useCallback((animated = false) => {
    if (scrollRef.current && typeof scrollRef.current.scrollToEnd === 'function') {
      scrollRef.current.scrollToEnd({ animated });
    }
  }, []);

  /**
   * Commits focus to a newly added item ONLY AFTER both its native row layout (`onLayout`)
   * and the ScrollView's content size (`onContentSizeChange`) have updated, and AFTER
   * positioning the ScrollView at the bottom with `animated: false`.
   * This prevents Android's `ScrollView.requestChildFocus()` from seeing (0, 0) un-laid-out
   * bounds and jumping the ScrollView to the top of the list.
   */
  const commitPendingNewItemFocus = useCallback((force = false) => {
    const targetId = pendingFocusIdRef.current;
    if (!targetId) return;
    const isRowLaidOut = laidOutRowsRef.current.has(targetId);
    const isContentReady = contentSizeReadyForIdRef.current === targetId;
    if (!force && (!isRowLaidOut || !isContentReady)) {
      return;
    }
    const input = inputRefs.current.get(targetId);
    if (!input) return;

    pendingScrollToEndRef.current = false;
    contentSizeReadyForIdRef.current = null;

    // 1. Position ScrollView at the bottom synchronously so the new row is already inside
    //    the visible viewport before requesting focus.
    scrollListToEnd(false);

    // 2. Focus on the next frame so Android requestChildFocus sees scrollDelta = 0 (no jump!)
    const focusAfterScroll = () => {
      const latestInput = inputRefs.current.get(targetId);
      if (latestInput && typeof latestInput.focus === 'function') {
        latestInput.focus();
      }
    };
    if (typeof requestAnimationFrame === 'function') {
      requestAnimationFrame(focusAfterScroll);
    } else {
      setTimeout(focusAfterScroll, 16);
    }
  }, [scrollListToEnd]);

  const registerInputRef = useCallback((id, node) => {
    const idStr = String(id);
    if (node) {
      inputRefs.current.set(idStr, node);
    } else {
      inputRefs.current.delete(idStr);
      laidOutRowsRef.current.delete(idStr);
    }
  }, []);

  const handleRowLayout = useCallback((id) => {
    const idStr = String(id);
    laidOutRowsRef.current.add(idStr);
    if (pendingFocusIdRef.current === idStr) {
      commitPendingNewItemFocus(false);
    }
  }, [commitPendingNewItemFocus]);

  useEffect(() => {
    return () => {
      emptyBlurTimersRef.current.forEach((timerId) => clearTimeout(timerId));
      emptyBlurTimersRef.current.clear();
    };
  }, []);

  // Automatically clean up any stale unfocused empty rows stuck in the middle of the list
  useEffect(() => {
    const now = Date.now();
    for (let i = 0; i < orderedItems.length; i++) {
      const it = orderedItems[i];
      if (!it) continue;
      const idStr = String(it.id || it._id);
      const hasText = Boolean(String(it.taskname || '').trim());
      if (hasText) continue;
      if (
        idStr === focusedItemIdRef.current ||
        idStr === pendingFocusIdRef.current ||
        emptyBlurTimersRef.current.has(idStr)
      ) {
        continue;
      }
      const isMiddleItem = i < orderedItems.length - 1;
      const ageMs = now - extractQuickListTimestamp(it);
      if (isMiddleItem || ageMs > 2500) {
        onDeleteItem(idStr);
      }
    }
  }, [orderedItems, onDeleteItem]);

  useEffect(() => {
    if (Platform.OS === 'web') return;
    let scrollTimer = null;
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const sub = Keyboard.addListener(showEvent, () => {
      const focusedId = focusedItemIdRef.current;
      const pendingId = pendingFocusIdRef.current;
      // Only keep the bottom in view if the user is actively focused on the very last item.
      // Never scroll to the bottom when the user is editing an existing item higher in the list!
      if ((pendingId && pendingId === lastItemIdRef.current) || (focusedId && focusedId === lastItemIdRef.current)) {
        if (scrollTimer) clearTimeout(scrollTimer);
        scrollTimer = setTimeout(() => {
          scrollListToEnd(false);
        }, 60);
      }
    });
    const hideSub = Keyboard.addListener('keyboardDidHide', () => {
      // Prevent Android rootViewRequestFocus() from bouncing focus to the first item when keyboard closes
      suppressFocusBounceUntilRef.current = Date.now() + 400;
      pendingFocusIdRef.current = null;
      pendingScrollToEndRef.current = false;
      const activeId = focusedItemIdRef.current;
      focusedItemIdRef.current = null;
      if (activeId) {
        const activeNode = inputRefs.current.get(String(activeId));
        if (activeNode && typeof activeNode.blur === 'function') {
          activeNode.blur();
        }
      }
      if (scrollTimer) {
        clearTimeout(scrollTimer);
        scrollTimer = null;
      }
    });
    return () => {
      sub.remove();
      hideSub.remove();
      if (scrollTimer) clearTimeout(scrollTimer);
    };
  }, [scrollListToEnd]);

  const handleFocusItem = useCallback((itemId) => {
    const idStr = String(itemId);
    const now = Date.now();
    if (now < suppressFocusBounceUntilRef.current) {
      const targetId = pendingFocusIdRef.current;
      if (targetId && idStr !== targetId) {
        // Android attempted to focus another item before the newly added last row claimed focus
        const strayNode = inputRefs.current.get(idStr);
        if (strayNode && typeof strayNode.blur === 'function') {
          strayNode.blur();
        }
        commitPendingNewItemFocus(true);
        return;
      }
      if (!targetId) {
        // Keyboard just closed or empty trailing row was dismissed -> block bounce to first task
        const strayNode = inputRefs.current.get(idStr);
        if (strayNode && typeof strayNode.blur === 'function') {
          strayNode.blur();
        }
        return;
      }
    }
    if (pendingFocusIdRef.current === idStr) {
      pendingFocusIdRef.current = null;
    } else if (pendingFocusIdRef.current && pendingFocusIdRef.current !== idStr) {
      // User explicitly tapped a different existing item
      pendingFocusIdRef.current = null;
      pendingScrollToEndRef.current = false;
    }
    focusedItemIdRef.current = idStr;
  }, [commitPendingNewItemFocus]);

  const handleAddNewItem = useCallback(() => {
    HapticHelper.trigger('light');

    // If the trailing item is already empty, reuse and focus it in place instead of
    // deleting and recreating a second empty item (which causes a layout height bounce).
    if (orderedItems.length > 0) {
      const lastItem = orderedItems[orderedItems.length - 1];
      const lastId = String(lastItem.id || lastItem._id);
      if (!String(lastItem.taskname || '').trim()) {
        if (emptyBlurTimersRef.current.has(lastId)) {
          clearTimeout(emptyBlurTimersRef.current.get(lastId));
          emptyBlurTimersRef.current.delete(lastId);
        }
        pendingFocusIdRef.current = lastId;
        focusedItemIdRef.current = lastId;
        suppressFocusBounceUntilRef.current = Date.now() + 450;
        scrollListToEnd(false);
        const existingInput = inputRefs.current.get(lastId);
        if (existingInput && typeof existingInput.focus === 'function') {
          existingInput.focus();
        }
        return;
      }
    }

    const createdId = onAddItem();
    if (createdId) {
      const idStr = String(createdId);
      pendingFocusIdRef.current = idStr;
      focusedItemIdRef.current = idStr;
      suppressFocusBounceUntilRef.current = Date.now() + 500;
      pendingScrollToEndRef.current = true;
      contentSizeReadyForIdRef.current = null;
      // Fallback timer in case onContentSizeChange/onLayout coalesces on web or fast renders
      setTimeout(() => {
        if (pendingFocusIdRef.current === idStr) {
          commitPendingNewItemFocus(true);
        }
      }, 90);
    }
  }, [onAddItem, orderedItems, scrollListToEnd, commitPendingNewItemFocus]);

  const handleContentSizeChange = useCallback(() => {
    if (pendingScrollToEndRef.current && pendingFocusIdRef.current) {
      contentSizeReadyForIdRef.current = pendingFocusIdRef.current;
      commitPendingNewItemFocus(false);
    }
  }, [commitPendingNewItemFocus]);

  const handleBlurEmpty = useCallback((itemId, options = {}) => {
    const idStr = String(itemId);
    suppressFocusBounceUntilRef.current = Math.max(suppressFocusBounceUntilRef.current, Date.now() + 400);
    if (pendingFocusIdRef.current === idStr) {
      pendingFocusIdRef.current = null;
    }
    if (focusedItemIdRef.current === idStr) {
      focusedItemIdRef.current = null;
    }
    const node = inputRefs.current.get(idStr);
    if (node && typeof node.blur === 'function') {
      node.blur();
    }
    if (options?.fromSubmit) {
      Keyboard.dismiss();
    }
    if (emptyBlurTimersRef.current.has(idStr)) {
      clearTimeout(emptyBlurTimersRef.current.get(idStr));
    }
    // Defer unmounting the empty row until after focus/blur settles so Android ViewGroup
    // never fires rootViewRequestFocus() onto the first task in the ScrollView.
    const timerId = setTimeout(() => {
      emptyBlurTimersRef.current.delete(idStr);
      onDeleteItem(itemId);
    }, 45);
    emptyBlurTimersRef.current.set(idStr, timerId);
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
      onContentSizeChange={handleContentSizeChange}
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
                inputRefCallback={registerInputRef}
                onRowLayout={handleRowLayout}
                onFocusItem={handleFocusItem}
                onToggle={onToggleItem}
                onSaveText={onUpdateItemText}
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
    paddingBottom: 16,
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
