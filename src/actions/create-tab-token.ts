'use server';

import { auth } from '@/lib/auth';
import { createTabSession } from '@/lib/tab-session';

export async function createTabSessionToken(): Promise<string | null> {
  const session = await auth();
  if (!session?.user) return null;

  const token = await createTabSession({
    id: session.user.id,
    name: session.user.name,
    email: session.user.email,
    role: session.user.role,
    businessId: session.user.businessId ?? 0,
    currency: session.user.currency ?? 'LKR',
  });

  return token;
}
