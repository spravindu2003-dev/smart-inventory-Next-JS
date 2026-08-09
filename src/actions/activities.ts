'use server';

import { getAuthSession } from '@/lib/server-auth';
import { prisma } from '@/lib/prisma';

export async function getActivities(token: string, params?: {
  page?: number;
  limit?: number;
  action?: string;
  userId?: number;
  startDate?: string;
  endDate?: string;
  search?: string;
}) {
  const session = await getAuthSession(token);

  if (session.role !== 'owner' && session.role !== 'manager') {
    return { error: 'Unauthorized' };
  }

  const page = params?.page || 1;
  const limit = params?.limit || 50;
  const skip = (page - 1) * limit;

  const where: Record<string, unknown> = {
    businessId: Number(session.businessId) || 0,
  };

  if (params?.action) {
    where.action = params.action;
  }

  if (params?.userId) {
    where.userId = params.userId;
  }

  if (params?.startDate || params?.endDate) {
    where.createdAt = {};
    if (params.startDate) {
      (where.createdAt as Record<string, unknown>).gte = new Date(params.startDate);
    }
    if (params.endDate) {
      (where.createdAt as Record<string, unknown>).lte = new Date(params.endDate);
    }
  }

  if (params?.search) {
    where.OR = [
      { description: { contains: params.search, mode: 'insensitive' } },
      { action: { contains: params.search, mode: 'insensitive' } },
    ];
  }

  const [activities, total] = await Promise.all([
    prisma.activityLog.findMany({
      where,
      include: {
        user: {
          select: { id: true, name: true, email: true },
        },
      },
      skip,
      take: limit,
      orderBy: { createdAt: 'desc' },
    }),
    prisma.activityLog.count({ where }),
  ]);

  return {
    activities,
    pagination: {
      page,
      limit,
      total,
      pages: Math.ceil(total / limit),
    },
  };
}

export async function getActivitySummary(token: string) {
  const session = await getAuthSession(token);

  if (session.role !== 'owner' && session.role !== 'manager') {
    return { error: 'Unauthorized' };
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const [totalToday, actionCounts] = await Promise.all([
    prisma.activityLog.count({
      where: {
        businessId: Number(session.businessId) || 0,
        createdAt: { gte: today },
      },
    }),
    prisma.activityLog.groupBy({
      by: ['action'],
      where: {
        businessId: Number(session.businessId) || 0,
        createdAt: { gte: today },
      },
      _count: {
        action: true,
      },
    }),
  ]);

  return {
    totalToday,
    actionCounts: actionCounts.map((item) => ({
      action: item.action,
      count: item._count.action,
    })),
  };
}
