/**
 * Multi-currency detection, price extraction, and formatting helpers
 * for Grocery, Shopping, and Expenses boards.
 */

export const PRICE_BOARD_TYPES = new Set(['grocery', 'shopping', 'expenses']);

export const CURRENCIES = {
  USD: { code: 'USD', symbol: '$', position: 'prefix', decimals: 2, space: false, trimWhole: false, label: 'USD ($)' },
  EUR: { code: 'EUR', symbol: '€', position: 'prefix', decimals: 2, space: false, trimWhole: false, label: 'EUR (€)' },
  RUB: { code: 'RUB', symbol: '₽', position: 'suffix', decimals: 2, space: true, trimWhole: true, label: 'RUB (₽)' },
  GBP: { code: 'GBP', symbol: '£', position: 'prefix', decimals: 2, space: false, trimWhole: false, label: 'GBP (£)' },
  JPY: { code: 'JPY', symbol: '¥', position: 'prefix', decimals: 0, space: false, trimWhole: true, label: 'JPY (¥)' },
  CNY: { code: 'CNY', symbol: '¥', position: 'prefix', decimals: 2, space: false, trimWhole: true, label: 'CNY (¥)' },
  INR: { code: 'INR', symbol: '₹', position: 'prefix', decimals: 2, space: false, trimWhole: true, label: 'INR (₹)' },
  KRW: { code: 'KRW', symbol: '₩', position: 'prefix', decimals: 0, space: false, trimWhole: true, label: 'KRW (₩)' },
  UAH: { code: 'UAH', symbol: '₴', position: 'suffix', decimals: 2, space: true, trimWhole: true, label: 'UAH (₴)' },
  TRY: { code: 'TRY', symbol: '₺', position: 'prefix', decimals: 2, space: false, trimWhole: true, label: 'TRY (₺)' },
  KZT: { code: 'KZT', symbol: '₸', position: 'suffix', decimals: 2, space: true, trimWhole: true, label: 'KZT (₸)' },
};

export const CURRENCY_OPTION_CODES = [
  'auto', 'USD', 'EUR', 'RUB', 'GBP', 'JPY', 'CNY', 'INR', 'KRW', 'UAH', 'TRY', 'KZT',
];

export const DEFAULT_EXCHANGE_RATES = {
  USD: 1.0,
  EUR: 0.92,
  RUB: 96.5,
  GBP: 0.79,
  JPY: 152.0,
  CNY: 7.24,
  INR: 84.0,
  KRW: 1380.0,
  UAH: 41.5,
  TRY: 34.3,
  KZT: 495.0,
};

export const SYMBOL_TO_CURRENCY_CODE = {
  '$': 'USD',
  '€': 'EUR',
  '₽': 'RUB',
  'руб': 'RUB',
  'руб.': 'RUB',
  'р.': 'RUB',
  '£': 'GBP',
  '¥': 'CNY',
  '円': 'JPY',
  '元': 'CNY',
  '₹': 'INR',
  '₩': 'KRW',
  '원': 'KRW',
  '₴': 'UAH',
  'грн': 'UAH',
  'грн.': 'UAH',
  '₺': 'TRY',
  '₸': 'KZT',
  'тг': 'KZT',
  'тг.': 'KZT',
  'USD': 'USD',
  'EUR': 'EUR',
  'RUB': 'RUB',
  'GBP': 'GBP',
  'JPY': 'JPY',
  'CNY': 'CNY',
  'INR': 'INR',
  'KRW': 'KRW',
  'UAH': 'UAH',
  'TRY': 'TRY',
  'KZT': 'KZT',
};

export function isPriceBoardType(boardType) {
  return PRICE_BOARD_TYPES.has(boardType);
}

/**
 * Safely resolves the effective ISO currency code from:
 * per-board override -> user setting -> language + device region fallback.
 */
export function resolveCurrencyCode({
  boardCurrencyCode = null,
  settingCode = 'auto',
  langCode = 'en',
  deviceCurrencyCode = null,
} = {}) {
  if (boardCurrencyCode && boardCurrencyCode !== 'auto' && CURRENCIES[boardCurrencyCode]) {
    return boardCurrencyCode;
  }
  if (settingCode && settingCode !== 'auto' && CURRENCIES[settingCode]) {
    return settingCode;
  }

  const normalizedLang = String(langCode || 'en').toLowerCase().split(/[-_]/)[0];
  const deviceCode = deviceCurrencyCode ? String(deviceCurrencyCode).toUpperCase() : null;
  const supportedDevice = deviceCode && CURRENCIES[deviceCode] ? deviceCode : null;

  switch (normalizedLang) {
    case 'ru':
      if (supportedDevice === 'UAH' || supportedDevice === 'KZT') return supportedDevice;
      return 'RUB';
    case 'ja':
      return 'JPY';
    case 'zh':
      return 'CNY';
    case 'ko':
      return 'KRW';
    case 'hi':
      return 'INR';
    case 'de':
    case 'fr':
    case 'it':
      return supportedDevice || 'EUR';
    case 'es':
      return supportedDevice || 'EUR';
    case 'en':
    default:
      return supportedDevice || 'USD';
  }
}

export function getCurrencyMeta(currencyCode = 'USD') {
  return CURRENCIES[currencyCode] || CURRENCIES.USD;
}

/**
 * Parses numbers written with '.' or ',' decimal separators and optional
 * thousands spaces/commas/dots (e.g., "12,50", "4.99", "1,200", "1 200,50").
 */
export function parseLocalizedNumber(raw) {
  if (raw === null || raw === undefined) return NaN;
  const cleaned = String(raw)
    .replace(/[\s\u00A0\u202F']/g, '')
    .trim();
  if (!cleaned || !/^\d[\d.,]*$/.test(cleaned)) return NaN;

  const lastDot = cleaned.lastIndexOf('.');
  const lastComma = cleaned.lastIndexOf(',');
  let normalized = cleaned;

  if (lastDot !== -1 && lastComma !== -1) {
    if (lastComma > lastDot) {
      // European "1.200,50" -> "1200.50"
      normalized = cleaned.replace(/\./g, '').replace(',', '.');
    } else {
      // US/UK "1,200.50" -> "1200.50"
      normalized = cleaned.replace(/,/g, '');
    }
  } else if (lastComma !== -1) {
    const commaCount = (cleaned.match(/,/g) || []).length;
    const digitsAfter = cleaned.length - lastComma - 1;
    if (commaCount === 1 && (digitsAfter === 1 || digitsAfter === 2)) {
      normalized = cleaned.replace(',', '.');
    } else {
      normalized = cleaned.replace(/,/g, '');
    }
  } else if (lastDot !== -1) {
    const dotCount = (cleaned.match(/\./g) || []).length;
    if (dotCount > 1) {
      normalized = cleaned.replace(/\./g, '');
    }
  }

  const parsed = parseFloat(normalized);
  if (!Number.isFinite(parsed) || parsed < 0 || parsed > 1e9) return NaN;
  return parsed;
}

// Explicit currency symbols and ISO/local currency markers
const PREFIX_SYMBOL_RE = /(?:^|[\s([{"'])([$€£¥₽₹₩₴₺₸])\s*(\d+(?:[\s\u00A0.,']\d{3})*(?:[.,]\d{1,2})?|\d+(?:[.,]\d{1,2})?)/;
const PREFIX_CODE_RE = /(?:^|[\s([{"'])(USD|EUR|RUB|GBP|JPY|CNY|INR|KRW|UAH|TRY|KZT)\s+(\d+(?:[\s\u00A0.,']\d{3})*(?:[.,]\d{1,2})?|\d+(?:[.,]\d{1,2})?)(?=$|[\s.,;!?)}\]"'])/i;
const SUFFIX_CURRENCY_RE = /(?:^|[\s([{"'])(\d+(?:[\s\u00A0.,']\d{3})*(?:[.,]\d{1,2})?|\d+(?:[.,]\d{1,2})?)\s*(?:([$€£¥₽₹₩₴₺₸])|(USD|EUR|RUB|GBP|JPY|CNY|INR|KRW|UAH|TRY|KZT|руб\.?|р\.|грн\.?|тг\.?|円|元|원)(?=$|[\s,;!?)\]}"']))/i;
// Decimal amount with hash prefix (e.g. "Mr Wash #34.5", "#34.50") - decimal points distinguish amounts from integer IDs
const HASH_DECIMAL_RE = /(?:^|[\s([{"'])#\s*(\d+(?:[\s\u00A0.,']\d{3})*[.,]\d{1,2}|\d+[.,]\d{1,2})(?=$|[\s.,;!?)}\]"'])/;
// Hash followed by any number on price-oriented boards (e.g. "Mr Wash #34.5", "Rent #1200")
const HASH_PRICE_BOARD_RE = /(?:^|[\s([{"'])#\s*(\d+(?:[\s\u00A0.,']\d{3})*(?:[.,]\d{1,2})?|\d+(?:[.,]\d{1,2})?)(?=$|[\s.,;!?)}\]"'])/;

// Tokens that introduce an identifier/multiplier AFTER them (e.g., "Room 101", "Episode 4", "Eggs x 2")
const NUMBER_PREFIX_WORDS = /^(?:x|х|×|\*|no\.?|nr\.?|№|#|ep\.?|ch\.?|vol\.?|part|pt\.?|ver\.?|v\.?|level|lvl|step|room|apt|suite|page|pg\.?|p\.?)$/i;

/**
 * Extracts a numeric item amount from a task title.
 * - Always matches explicit currency symbols/codes across all languages.
 * - When `allowBareTrailing` is true (on grocery/shopping/expenses boards),
 *   safely parses a trailing standalone number (e.g., "Молоко 120", "2x Apples 3.50")
 *   while ignoring leading quantities ("2 apples"), attached numbers ("Vitamin B12"),
 *   and measurements/counts ("Flour 500g", "Eggs 12 pcs", "Milk 2%").
 */
export function extractTaskAmountFromTitle(title, options = {}) {
  if (!title || typeof title !== 'string') return 0;
  const trimmed = title.trim();
  if (!trimmed) return 0;

  const { allowBareTrailing = false, boardType = null } = options;
  const useBareHeuristic = Boolean(allowBareTrailing || PRICE_BOARD_TYPES.has(boardType));

  // 1. Explicit currency symbol prefix ($4.99, €12,50, ¥1200, ₹250, ₩5000, ₽120)
  const prefixSym = trimmed.match(PREFIX_SYMBOL_RE);
  if (prefixSym) {
    const val = parseLocalizedNumber(prefixSym[2]);
    if (!isNaN(val)) return val;
  }

  // 2. Explicit currency symbol or local currency suffix (120₽, 120 руб, 120 р., 1200円, 12,50 EUR)
  const suffixCur = trimmed.match(SUFFIX_CURRENCY_RE);
  if (suffixCur) {
    const val = parseLocalizedNumber(suffixCur[1]);
    if (!isNaN(val)) return val;
  }

  // 3. Explicit currency ISO code prefix (RUB 120, USD 4.50)
  const prefixCode = trimmed.match(PREFIX_CODE_RE);
  if (prefixCode) {
    const val = parseLocalizedNumber(prefixCode[2]);
    if (!isNaN(val)) return val;
  }

  // 4. Decimal amount with '#' prefix (e.g. "Mr Wash #34.5", "Bill #15.99")
  const hashDec = trimmed.match(HASH_DECIMAL_RE);
  if (hashDec) {
    const val = parseLocalizedNumber(hashDec[1]);
    if (!isNaN(val)) return val;
  }

  // 5. Safe trailing bare-number heuristic or hash-prefixed amount on price-oriented boards
  if (useBareHeuristic) {
    const hashBoard = trimmed.match(HASH_PRICE_BOARD_RE);
    if (hashBoard) {
      const val = parseLocalizedNumber(hashBoard[1]);
      if (!isNaN(val)) return val;
    }

    // Require whitespace before the trailing number so "Vitamin B12" or "A4" never matches.
    const trailingMatch = trimmed.match(/^(.*\S)\s+(\d+(?:[.,]\d{1,2})?)\s*$/);
    if (trailingMatch) {
      const preceding = trailingMatch[1].trim();
      const rawNum = trailingMatch[2];
      // Do not match multipliers or numbered prefixes like "Eggs x 2", "Item #12", "Model - 3"
      const lastToken = preceding.split(/\s+/).pop() || '';
      const lastChar = preceding.slice(-1);
      if (
        !['×', '*', '#', '№', '/', '-', '+'].includes(lastChar) &&
        !NUMBER_PREFIX_WORDS.test(lastToken)
      ) {
        const val = parseLocalizedNumber(rawNum);
        if (!isNaN(val)) return val;
      }
    }
  }

  return 0;
}

/**
 * Extracts item quantity from grocery/shopping titles in any supported script.
 * Returns null if no explicit quantity marker is present.
 */
export function extractGroceryQuantity(title) {
  if (!title || typeof title !== 'string') return null;
  const qtyMatch =
    title.match(/(?:^|\s)(\d+)\s*(?:x|х|×|pcs|pk|packs?|items?|шт\.?|уп\.?|個|个|개|kg|lbs?)(?=$|\s|[.,!?)])/i) ||
    title.match(/(?:^|\s)(?:x|х|×|\*)\s*(\d+)(?=$|\s|[.,!?)])/i);
  if (qtyMatch) {
    const qty = parseInt(qtyMatch[1], 10);
    if (Number.isFinite(qty) && qty >= 1 && qty <= 9999) {
      return qty;
    }
  }
  return null;
}

/**
 * Formats an amount with the appropriate currency symbol and decimal precision.
 */
export function formatCurrency(amount, currencyCode = 'USD', options = {}) {
  const num = Number(amount);
  const safeNum = Number.isFinite(num) ? num : 0;
  const meta = getCurrencyMeta(currencyCode);
  const decimals = options.decimals !== undefined ? options.decimals : meta.decimals;

  const rounded = decimals === 0 ? Math.round(safeNum) : Number(safeNum.toFixed(decimals));
  const isNegative = rounded < 0;
  const absVal = Math.abs(rounded);

  let numberStr;
  if (decimals === 0 || (meta.trimWhole && options.preserveDecimals !== true && Math.abs(absVal - Math.round(absVal)) < 1e-6)) {
    numberStr = String(Math.round(absVal)).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  } else {
    const fixed = absVal.toFixed(decimals);
    const [intPart, decPart] = fixed.split('.');
    const groupedInt = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    numberStr = decPart !== undefined ? `${groupedInt}.${decPart}` : groupedInt;
  }

  const sign = isNegative ? '-' : '';
  if (meta.position === 'suffix') {
    return `${sign}${numberStr}${meta.space ? ' ' : ''}${meta.symbol}`;
  }
  return `${sign}${meta.symbol}${meta.space ? ' ' : ''}${numberStr}`;
}

/**
 * Converts a monetary amount from one currency to another using exchange rates.
 * Defaults to embedded reliable offline rates, supporting custom or live fetched rates.
 */
export function convertCurrency(amount, fromCode = 'USD', toCode = 'USD', customRates = null) {
  const num = Number(amount);
  if (!Number.isFinite(num) || num === 0) return 0;
  const safeFrom = String(fromCode || 'USD').toUpperCase();
  const safeTo = String(toCode || 'USD').toUpperCase();
  if (safeFrom === safeTo) return num;

  const rates = { ...DEFAULT_EXCHANGE_RATES, ...(customRates || {}) };
  const fromRate = rates[safeFrom] || DEFAULT_EXCHANGE_RATES[safeFrom] || 1.0;
  const toRate = rates[safeTo] || DEFAULT_EXCHANGE_RATES[safeTo] || 1.0;

  const inUSD = num / fromRate;
  const inTarget = inUSD * toRate;

  return inTarget;
}

/**
 * Extracts both amount and explicit currency symbol/code from text (e.g. "$20", "Costco $400", "20€", "120 руб").
 */
export function extractTaskAmountAndCurrency(title, options = {}) {
  if (!title || typeof title !== 'string') return { amount: 0, currency: null };
  const trimmed = title.trim();
  if (!trimmed) return { amount: 0, currency: null };

  // 1. Explicit currency symbol prefix ($4.99, €12,50, ¥1200, ₽120, ₴45, £20, etc.)
  const prefixSym = trimmed.match(/(?:^|[\s([{"'])([$€£¥₽₹₩₴₺₸])\s*(\d+(?:[\s\u00A0.,']\d{3})*(?:[.,]\d{1,2})?|\d+(?:[.,]\d{1,2})?)/);
  if (prefixSym) {
    const val = parseLocalizedNumber(prefixSym[2]);
    if (!isNaN(val)) {
      const code = SYMBOL_TO_CURRENCY_CODE[prefixSym[1]] || null;
      return { amount: val, currency: code };
    }
  }

  // 2. Explicit currency ISO code prefix (USD 4.50, EUR 20, RUB 120, etc.)
  const prefixCode = trimmed.match(/(?:^|[\s([{"'])(USD|EUR|RUB|GBP|JPY|CNY|INR|KRW|UAH|TRY|KZT)\s+(\d+(?:[\s\u00A0.,']\d{3})*(?:[.,]\d{1,2})?|\d+(?:[.,]\d{1,2})?)(?=$|[\s.,;!?)}\]"'])/i);
  if (prefixCode) {
    const val = parseLocalizedNumber(prefixCode[2]);
    if (!isNaN(val)) {
      return { amount: val, currency: prefixCode[1].toUpperCase() };
    }
  }

  // 3. Explicit currency symbol or local currency suffix (120₽, 20$, 50EUR, 100 руб, 45 грн, etc.)
  const suffixCur = trimmed.match(/(?:^|[\s([{"'])(\d+(?:[\s\u00A0.,']\d{3})*(?:[.,]\d{1,2})?|\d+(?:[.,]\d{1,2})?)\s*(?:([$€£¥₽₹₩₴₺₸])|(USD|EUR|RUB|GBP|JPY|CNY|INR|KRW|UAH|TRY|KZT|руб\.?|р\.|грн\.?|тг\.?|円|元|원)(?=$|[\s,;!?)\]}"']))/i);
  if (suffixCur) {
    const val = parseLocalizedNumber(suffixCur[1]);
    if (!isNaN(val)) {
      const marker = suffixCur[2] || suffixCur[3];
      const code = SYMBOL_TO_CURRENCY_CODE[marker] || (marker ? marker.toUpperCase() : null);
      return { amount: val, currency: code };
    }
  }

  // Fallback to standard amount extraction
  const amt = extractTaskAmountFromTitle(title, options);
  return { amount: amt, currency: null };
}

const TASK_CURRENCY_CACHE = new Map();

/**
 * Returns the effective currency for a task:
 * 1. Explicit itemCurrency on task object
 * 2. Currency marker parsed from task title
 * 3. null (falls back to board currency)
 */
export function getCachedTaskCurrency(t, boardType = null) {
  if (!t) return null;
  if (t.itemCurrency && t.itemCurrency !== 'auto' && t.itemCurrency !== '') {
    return t.itemCurrency;
  }
  const name = String(t.taskname || t.name || '');
  if (!name) return null;
  const cached = TASK_CURRENCY_CACHE.get(name);
  if (cached !== undefined) return cached;

  const { currency } = extractTaskAmountAndCurrency(name, { boardType });
  if (TASK_CURRENCY_CACHE.size > 1000) TASK_CURRENCY_CACHE.clear();
  TASK_CURRENCY_CACHE.set(name, currency || null);
  return currency || null;
}

export function clearTaskCurrencyCache() {
  TASK_CURRENCY_CACHE.clear();
}

let cachedLiveRates = null;
let lastRatesFetchTime = 0;

/**
 * Optionally refreshes live rates in background.
 * Falls back gracefully to DEFAULT_EXCHANGE_RATES on network failure or offline mode.
 */
export async function fetchLiveExchangeRatesAsync() {
  const now = Date.now();
  if (cachedLiveRates && now - lastRatesFetchTime < 3600000) {
    return cachedLiveRates;
  }
  try {
    const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
    const timer = controller ? setTimeout(() => controller.abort(), 4000) : null;
    const res = await fetch('https://open.er-api.com/v6/latest/USD', {
      signal: controller?.signal
    });
    if (timer) clearTimeout(timer);
    if (res.ok) {
      const data = await res.json();
      if (data && data.rates && data.result === 'success') {
        const rates = { ...DEFAULT_EXCHANGE_RATES };
        Object.keys(DEFAULT_EXCHANGE_RATES).forEach(code => {
          if (data.rates[code] && Number(data.rates[code]) > 0) {
            rates[code] = Number(data.rates[code]);
          }
        });
        cachedLiveRates = rates;
        lastRatesFetchTime = now;
        return rates;
      }
    }
  } catch (e) {}
  return cachedLiveRates || DEFAULT_EXCHANGE_RATES;
}
