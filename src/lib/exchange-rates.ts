import { BASE_CURRENCY } from '@/lib/currencies';

interface RateCache {
  rates: Record<string, number>;
  timestamp: number;
}

const CACHE_TTL_MS = 60 * 60 * 1000;
let rateCache: RateCache | null = null;

export interface ExchangeRateResult {
  rate: number;
  from: string;
  to: string;
  timestamp: Date;
  cached: boolean;
}

export async function getExchangeRate(
  fromCurrency: string,
  toCurrency: string
): Promise<ExchangeRateResult | null> {
  if (fromCurrency === toCurrency) {
    return {
      rate: 1,
      from: fromCurrency,
      to: toCurrency,
      timestamp: new Date(),
      cached: false,
    };
  }

  const now = Date.now();
  if (rateCache && now - rateCache.timestamp < CACHE_TTL_MS) {
    const rateKey = `${fromCurrency}-${toCurrency}`;
    const rate = rateCache.rates[rateKey];
    if (rate !== undefined) {
      return {
        rate,
        from: fromCurrency,
        to: toCurrency,
        timestamp: new Date(rateCache.timestamp),
        cached: true,
      };
    }
  }

  try {
    const url = `https://api.frankfurter.app/latest?from=${fromCurrency}&to=${toCurrency}`;
    const response = await fetch(url, { signal: AbortSignal.timeout(10000) });

    if (!response.ok) {
      return null;
    }

    const data = await response.json();
    const rate = data.rates?.[toCurrency];

    if (rate === undefined) {
      return null;
    }

    const cacheKey = `${fromCurrency}-${toCurrency}`;
    if (!rateCache || now - rateCache.timestamp >= CACHE_TTL_MS) {
      rateCache = { rates: {}, timestamp: now };
    }
    rateCache.rates[cacheKey] = rate;

    return {
      rate,
      from: fromCurrency,
      to: toCurrency,
      timestamp: new Date(data.date || now),
      cached: false,
    };
  } catch {
    return null;
  }
}

export function convertAmount(
  amount: number,
  fromCurrency: string,
  toCurrency: string,
  rate: number
): number {
  if (fromCurrency === toCurrency) return amount;
  return amount * rate;
}

export function formatConvertedAmount(
  amount: number,
  fromCurrency: string,
  toCurrency: string
): Promise<{ formatted: string; rate: number; timestamp: Date } | null> {
  return getExchangeRate(fromCurrency, toCurrency).then((result) => {
    if (!result) return null;
    const converted = convertAmount(amount, fromCurrency, toCurrency, result.rate);
    const formatted = new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: toCurrency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(converted);
    return {
      formatted,
      rate: result.rate,
      timestamp: result.timestamp,
    };
  });
}
