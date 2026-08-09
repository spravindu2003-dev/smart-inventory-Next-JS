'use server';

import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { isValidCurrencyCode, DEFAULT_CURRENCY } from '@/lib/currencies';

export async function getCurrency() {
  const session = await auth();
  if (!session?.user?.businessId) {
    return { currency: DEFAULT_CURRENCY };
  }

  try {
    const business = await prisma.business.findUnique({
      where: { id: session.user.businessId },
      select: { currency: true },
    });
    return { currency: business?.currency || DEFAULT_CURRENCY };
  } catch {
    return { currency: DEFAULT_CURRENCY };
  }
}

export async function updateCurrency(currencyCode: string) {
  const session = await auth();
  if (!session?.user) {
    return { error: 'Unauthorized' };
  }

  const role = session.user.role;
  if (role !== 'owner' && role !== 'manager') {
    return { error: 'Only owners and managers can change currency settings' };
  }

  if (!session.user.businessId) {
    return { error: 'No business associated with this account' };
  }

  if (!isValidCurrencyCode(currencyCode)) {
    return { error: `Invalid currency code: ${currencyCode}` };
  }

  try {
    await prisma.business.update({
      where: { id: session.user.businessId },
      data: { currency: currencyCode },
    });

    return { success: true, currency: currencyCode };
  } catch {
    return { error: 'Failed to update currency' };
  }
}
