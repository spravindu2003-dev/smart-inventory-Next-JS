'use server';

import { getAuthSession } from '@/lib/server-auth';
import { prisma } from '@/lib/prisma';
import { isValidCurrencyCode, DEFAULT_CURRENCY } from '@/lib/currencies';

export async function getCurrency(token: string) {
  const session = await getAuthSession(token);

  if (!session.businessId) {
    return { currency: DEFAULT_CURRENCY };
  }

  try {
    const business = await prisma.business.findUnique({
      where: { id: session.businessId },
      select: { currency: true },
    });
    return { currency: business?.currency || DEFAULT_CURRENCY };
  } catch {
    return { currency: DEFAULT_CURRENCY };
  }
}

export async function updateCurrency(token: string, currencyCode: string) {
  const session = await getAuthSession(token);

  const role = session.role;
  if (role !== 'owner' && role !== 'manager') {
    return { error: 'Only owners and managers can change currency settings' };
  }

  if (!session.businessId) {
    return { error: 'No business associated with this account' };
  }

  if (!isValidCurrencyCode(currencyCode)) {
    return { error: `Invalid currency code: ${currencyCode}` };
  }

  try {
    await prisma.business.update({
      where: { id: session.businessId },
      data: { currency: currencyCode },
    });

    return { success: true, currency: currencyCode };
  } catch {
    return { error: 'Failed to update currency' };
  }
}
