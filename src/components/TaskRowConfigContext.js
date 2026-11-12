import React, { createContext, useContext, useMemo } from 'react';
import { useSelector } from 'react-redux';
import { useTranslation } from 'react-i18next';
import * as Localization from 'expo-localization';
import { getBoardColor } from '../utils/boardColors';
import { resolveCurrencyCode } from '../utils/currencyHelper';

const EMPTY_BOARDS = [];
const EMPTY_MAP = {};

function getDeviceCurrencySafe() {
  try {
    const locales = Localization.getLocales?.();
    if (Array.isArray(locales) && locales.length > 0 && locales[0]?.currencyCode) {
      return locales[0].currencyCode;
    }
  } catch (e) {}
  return null;
}

const DEFAULT_ROW_CONFIG = {
  taskNameWrap: 'nowrap',
  fontSizeSetting: 'normal',
  boards: EMPTY_BOARDS,
  boardsByIdMap: new Map(),
  boardColorsMap: new Map(),
  currencyCode: 'auto',
  boardCurrencies: EMPTY_MAP,
  effectiveCurrencyCode: 'USD',
  deviceCurrencyCode: null,
  habitStreakMode: 'grace',
};

const TaskRowConfigContext = createContext(DEFAULT_ROW_CONFIG);

/**
 * Single top-level Redux subscription provider for TaskRow display & board metadata.
 * Eliminates 3x per-row `useSelector` subscriptions and O(B) `boards.find()` scans
 * across 50-200 mounted TaskRow instances during scrolling and task completion.
 */
export function TaskRowConfigProvider({ children }) {
  const { i18n } = useTranslation();
  const taskNameWrap = useSelector(state => state.themeReducer?.taskNameWrap || 'nowrap');
  const fontSizeSetting = useSelector(state => state.themeReducer?.fontSize || 'normal');
  const currencyCode = useSelector(state => state.themeReducer?.currencyCode || 'auto');
  const boardCurrencies = useSelector(state => state.themeReducer?.boardCurrencies || EMPTY_MAP);
  const habitStreakMode = useSelector(state => state.themeReducer?.habitStreakMode || 'grace');
  const boards = useSelector(state => state.userReducer?.boards ?? EMPTY_BOARDS);
  const langCode = i18n?.language || 'en';
  const deviceCurrencyCode = useMemo(() => getDeviceCurrencySafe(), []);

  const value = useMemo(() => {
    const boardsByIdMap = new Map();
    const boardColorsMap = new Map();

    if (Array.isArray(boards)) {
      for (let i = 0; i < boards.length; i++) {
        const b = boards[i];
        if (!b) continue;
        const color = getBoardColor(b, boards);
        if (b.id !== undefined && b.id !== null) {
          const idStr = String(b.id);
          boardsByIdMap.set(idStr, b);
          boardColorsMap.set(idStr, color);
        }
        if (b._id !== undefined && b._id !== null) {
          const altStr = String(b._id);
          boardsByIdMap.set(altStr, b);
          boardColorsMap.set(altStr, color);
        }
      }
    }

    if (!boardColorsMap.has('main')) {
      boardColorsMap.set('main', getBoardColor('main', boards));
    }

    const effectiveCurrencyCode = resolveCurrencyCode({
      settingCode: currencyCode,
      langCode,
      deviceCurrencyCode,
    });

    return {
      taskNameWrap,
      fontSizeSetting,
      boards,
      boardsByIdMap,
      boardColorsMap,
      currencyCode,
      boardCurrencies,
      effectiveCurrencyCode,
      deviceCurrencyCode,
      habitStreakMode,
    };
  }, [taskNameWrap, fontSizeSetting, boards, currencyCode, boardCurrencies, langCode, deviceCurrencyCode, habitStreakMode]);

  return (
    <TaskRowConfigContext.Provider value={value}>
      {children}
    </TaskRowConfigContext.Provider>
  );
}

export function useTaskRowConfig() {
  return useContext(TaskRowConfigContext);
}

export default TaskRowConfigContext;

