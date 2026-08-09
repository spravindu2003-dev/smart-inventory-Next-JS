import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { getCurrencyByCode, DEFAULT_CURRENCY } from '@/lib/currencies';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(amount: number, currencyCode?: string): string {
  const code = currencyCode || DEFAULT_CURRENCY;
  const config = getCurrencyByCode(code);
  const locale = config?.locale || 'en-US';
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: code,
    minimumFractionDigits: config?.decimals ?? 2,
    maximumFractionDigits: config?.decimals ?? 2,
  }).format(amount);
}

export function formatDate(date: Date | string): string {
  return new Date(date).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export function formatDateTime(date: Date | string): string {
  return new Date(date).toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function getBusinessId(session: { businessId?: number | null } | null): number {
  return session?.businessId || 0;
}

export function getUserId(session: { id?: string | number } | null): number {
  return typeof session?.id === 'string' ? parseInt(session.id) : (session?.id || 0);
}