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

  // 4. Safe trailing bare-number heuristic on price-oriented boards
  if (useBareHeuristic) {
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
