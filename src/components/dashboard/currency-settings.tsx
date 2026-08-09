'use client';

import * as React from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { useAuth } from '@/hooks/use-auth';
import { getCurrency, updateCurrency } from '@/actions/settings';
import { CURRENCIES, DEFAULT_CURRENCY, getCurrencyByCode } from '@/lib/currencies';
import { formatCurrency } from '@/lib/utils';
import { getExchangeRate } from '@/lib/exchange-rates';
import { toast } from '@/lib/toast';
import { DollarSign, RefreshCw, AlertCircle } from 'lucide-react';

export function CurrencySettings() {
  const { user } = useAuth();
  const canEdit = user?.role === 'owner' || user?.role === 'manager';

  const [currentCurrency, setCurrentCurrency] = React.useState(DEFAULT_CURRENCY);
  const [selectedCurrency, setSelectedCurrency] = React.useState(DEFAULT_CURRENCY);
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);

  const [exchangeInfo, setExchangeInfo] = React.useState<{
    rate: number;
    timestamp: Date;
  } | null>(null);
  const [rateLoading, setRateLoading] = React.useState(false);
  const [rateError, setRateError] = React.useState(false);

  React.useEffect(() => {
    async function loadCurrency() {
      try {
        const data = await getCurrency();
        setCurrentCurrency(data.currency);
        setSelectedCurrency(data.currency);
      } catch {
        setCurrentCurrency(DEFAULT_CURRENCY);
        setSelectedCurrency(DEFAULT_CURRENCY);
      } finally {
        setLoading(false);
      }
    }
    loadCurrency();
  }, []);

  React.useEffect(() => {
    if (currentCurrency === DEFAULT_CURRENCY || !canEdit) {
      setExchangeInfo(null);
      setRateError(false);
      return;
    }

    async function fetchRate() {
      setRateLoading(true);
      setRateError(false);
      try {
        const result = await getExchangeRate(DEFAULT_CURRENCY, currentCurrency);
        if (result && result.rate) {
          setExchangeInfo({ rate: result.rate, timestamp: result.timestamp });
        } else {
          setRateError(true);
        }
      } catch {
        setRateError(true);
      } finally {
        setRateLoading(false);
      }
    }

    fetchRate();
  }, [currentCurrency, canEdit]);

  async function handleSave() {
    if (selectedCurrency === currentCurrency) return;
    setSaving(true);
    try {
      const result = await updateCurrency(selectedCurrency);
      if ('error' in result) {
        toast.error(result.error || 'Failed to update currency');
      } else {
        setCurrentCurrency(selectedCurrency);
        toast.success('Currency updated successfully');
        if (typeof window !== 'undefined') {
          window.location.reload();
        }
      }
    } catch {
      toast.error('Failed to update currency');
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="animate-pulse space-y-4">
            <div className="h-4 bg-gray-200 rounded w-1/3" />
            <div className="h-10 bg-gray-200 rounded" />
          </div>
        </CardContent>
      </Card>
    );
  }

  const config = getCurrencyByCode(currentCurrency);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <DollarSign className="h-5 w-5 text-[#2563EB]" />
          Currency
        </CardTitle>
        <CardDescription>
          {canEdit
            ? 'Select the currency used for all monetary values in the application'
            : 'View the currently selected currency for this application'}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <label className="block text-sm font-medium text-gray-700">
            Application Currency
          </label>
          {canEdit ? (
            <select
              value={selectedCurrency}
              onChange={(e) => setSelectedCurrency(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#2563EB] focus:border-transparent"
            >
              {CURRENCIES.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.code} — {c.name} ({c.symbol})
                </option>
              ))}
            </select>
          ) : (
            <div className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm text-gray-700">
              {config ? `${config.code} — ${config.name} (${config.symbol})` : currentCurrency}
            </div>
          )}
        </div>

        <div className="rounded-lg bg-gray-50 p-3">
          <p className="text-sm text-gray-500">Selected currency:</p>
          <p className="text-lg font-semibold text-gray-900">
            {config ? `${config.code} \u00B7 ${config.symbol}` : currentCurrency}
          </p>
        </div>

        {canEdit && (
          <div className="flex justify-end">
            <Button
              onClick={handleSave}
              loading={saving}
              disabled={selectedCurrency === currentCurrency}
            >
              Save Changes
            </Button>
          </div>
        )}

        {canEdit && currentCurrency !== DEFAULT_CURRENCY && (
          <div className="border-t pt-4 space-y-2">
            <p className="text-sm font-medium text-gray-700 flex items-center gap-2">
              Exchange Rate Info
              {rateLoading && <RefreshCw className="h-3 w-3 animate-spin" />}
            </p>
            {rateError ? (
              <div className="flex items-start gap-2 text-sm text-amber-600 bg-amber-50 rounded-lg p-3">
                <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
                <span>
                  Exchange rates currently unavailable. Showing values in base currency ({DEFAULT_CURRENCY}).
                </span>
              </div>
            ) : exchangeInfo ? (
              <div className="text-sm text-gray-600 space-y-1">
                <p>
                  1 {DEFAULT_CURRENCY} &asymp; {exchangeInfo.rate.toFixed(4)} {currentCurrency}
                </p>
                <p className="text-xs text-gray-400">
                  Last updated: {exchangeInfo.timestamp.toLocaleString()}
                </p>
              </div>
            ) : null}
          </div>
        )}

        <div className="text-xs text-gray-400 border-t pt-3">
          <p>Base currency: {DEFAULT_CURRENCY}</p>
          <p className="mt-1">
            Changing the display currency does not modify stored monetary values. All original
            amounts are preserved in the base currency.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
