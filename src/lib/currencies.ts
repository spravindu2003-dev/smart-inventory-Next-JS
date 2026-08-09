export interface CurrencyConfig {
  code: string;
  name: string;
  symbol: string;
  decimals: number;
  locale: string;
}

export const CURRENCIES: CurrencyConfig[] = [
  { code: 'LKR', name: 'Sri Lankan Rupee', symbol: 'Rs.', decimals: 2, locale: 'en-LK' },
  { code: 'USD', name: 'US Dollar', symbol: '$', decimals: 2, locale: 'en-US' },
  { code: 'EUR', name: 'Euro', symbol: '\u20AC', decimals: 2, locale: 'de-DE' },
  { code: 'GBP', name: 'British Pound', symbol: '\u00A3', decimals: 2, locale: 'en-GB' },
  { code: 'INR', name: 'Indian Rupee', symbol: '\u20B9', decimals: 2, locale: 'en-IN' },
  { code: 'AUD', name: 'Australian Dollar', symbol: 'A$', decimals: 2, locale: 'en-AU' },
  { code: 'CAD', name: 'Canadian Dollar', symbol: 'C$', decimals: 2, locale: 'en-CA' },
  { code: 'SGD', name: 'Singapore Dollar', symbol: 'S$', decimals: 2, locale: 'en-SG' },
  { code: 'AED', name: 'UAE Dirham', symbol: 'AED', decimals: 2, locale: 'ar-AE' },
  { code: 'JPY', name: 'Japanese Yen', symbol: '\u00A5', decimals: 0, locale: 'ja-JP' },
  { code: 'CNY', name: 'Chinese Yuan', symbol: '\u00A5', decimals: 2, locale: 'zh-CN' },
];

export const DEFAULT_CURRENCY = 'LKR';
export const BASE_CURRENCY = 'LKR';

export function getCurrencyByCode(code: string): CurrencyConfig | undefined {
  return CURRENCIES.find((c) => c.code === code);
}

export function getCurrencySymbol(code: string): string {
  return getCurrencyByCode(code)?.symbol ?? code;
}

export function isValidCurrencyCode(code: string): boolean {
  return CURRENCIES.some((c) => c.code === code);
}
