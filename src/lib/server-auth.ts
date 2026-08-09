import { verifyTabSession, type TabSessionPayload } from '@/lib/tab-session';
import { prisma } from '@/lib/prisma';

export async function getAuthSession(token: string): Promise<TabSessionPayload> {
  const payload = await verifyTabSession(token);
  if (!payload) {
    throw new Error('Unauthorized');
  }

  const user = await prisma.user.findUnique({
    where: { id: Number(payload.id) },
    select: { id: true, isActive: true, isDeleted: true },
  });

  if (!user || !user.isActive || user.isDeleted) {
    throw new Error('Unauthorized');
  }

  return payload;
}
