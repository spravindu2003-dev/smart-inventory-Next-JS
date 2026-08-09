'use server';

import { prisma } from '@/lib/prisma';
import bcrypt from 'bcryptjs';
import { createTabSession } from '@/lib/tab-session';
import { DEFAULT_CURRENCY } from '@/lib/currencies';

export async function loginUser(email: string, password: string): Promise<string> {
  const user = await prisma.user.findUnique({
    where: { email },
    include: { business: { select: { currency: true } } },
  });

  if (!user || !user.isActive || user.isDeleted) {
    throw new Error('Invalid credentials');
  }

  const passwordMatch = await bcrypt.compare(password, user.password);
  if (!passwordMatch) {
    throw new Error('Invalid credentials');
  }

  await prisma.activityLog.create({
    data: {
      action: 'LOGIN_SUCCESS',
      entity: 'User',
      entityId: user.id,
      description: `User ${user.name} logged in`,
      userId: user.id,
      businessId: user.businessId || 0,
    },
  });

  const token = await createTabSession({
    id: user.id.toString(),
    name: user.name,
    email: user.email,
    role: user.role,
    businessId: user.businessId ?? 0,
    currency: user.business?.currency || DEFAULT_CURRENCY,
  });

  return token;
}
