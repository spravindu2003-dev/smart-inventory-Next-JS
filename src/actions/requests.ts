'use server';

import { getAuthSession } from '@/lib/server-auth';
import { prisma } from '@/lib/prisma';
import { editRequestSchema } from '@/lib/validations';
import { revalidatePath } from 'next/cache';
import { triggerRequestEvent } from '@/lib/pusher';

export async function getRequests(token: string, params?: { page?: number; limit?: number; status?: string }) {
  const session = await getAuthSession(token);

  const page = params?.page || 1;
  const limit = params?.limit || 50;
  const skip = (page - 1) * limit;

  const where: Record<string, unknown> = {
    businessId: Number(session.businessId) || 0,
  };

  if (session.role === 'cashier') {
    where.requestedById = Number(session.id);
  }

  if (params?.status) {
    where.status = params.status;
  }

  const [requests, total] = await Promise.all([
    prisma.editRequest.findMany({
      where,
      include: {
        requestedBy: {
          select: { id: true, name: true, email: true },
        },
        reviewedBy: {
          select: { id: true, name: true, email: true },
        },
      },
      skip,
      take: limit,
      orderBy: { createdAt: 'desc' },
    }),
    prisma.editRequest.count({ where }),
  ]);

  return {
    requests,
    pagination: {
      page,
      limit,
      total,
      pages: Math.ceil(total / limit),
    },
  };
}

export async function getPendingRequestCount(token: string) {
  const session = await getAuthSession(token);

  if (session.role !== 'owner' && session.role !== 'manager') {
    return { count: 0 };
  }

  const count = await prisma.editRequest.count({
    where: {
      businessId: Number(session.businessId) || 0,
      status: 'PENDING',
    },
  });

  return { count };
}

export async function createRequest(
  token: string,
  data: {
    targetType: string;
    targetId: number;
    actionType: string;
    payload: Record<string, unknown>;
    message?: string;
  }
) {
  const session = await getAuthSession(token);

  const validatedFields = editRequestSchema.safeParse(data);

  if (!validatedFields.success) {
    return { error: 'Invalid fields', details: validatedFields.error.flatten().fieldErrors };
  }

  const { targetType, targetId, actionType, payload, message } = validatedFields.data;

  const request = await prisma.editRequest.create({
    data: {
      targetType,
      targetId,
      actionType,
      payload: payload as never,
      message,
      businessId: Number(session.businessId) || 0,
      requestedById: Number(session.id),
    },
    include: {
      requestedBy: {
        select: { id: true, name: true, email: true },
      },
    },
  });

  await prisma.activityLog.create({
    data: {
      action: 'CREATE_REQUEST',
      entity: 'EditRequest',
      entityId: request.id,
      description: `Created ${actionType} request for ${targetType} #${targetId}`,
      userId: Number(session.id),
      businessId: Number(session.businessId) || 0,
    },
  });

  revalidatePath('/dashboard/requests');

  try {
    await triggerRequestEvent(Number(session.businessId), 'request-created', {
      request: { id: request.id, actionType: request.actionType, targetType: request.targetType, targetId: request.targetId, status: request.status, createdAt: request.createdAt, requestedBy: request.requestedBy },
    });
  } catch { /* Pusher not configured */ }

  return { success: 'Request created', request };
}

export async function approveRequest(token: string, id: number) {
  const session = await getAuthSession(token);

  if (session.role !== 'owner' && session.role !== 'manager') {
    return { error: 'Only owners and managers can approve requests' };
  }

  const request = await prisma.editRequest.findUnique({
    where: { id },
  });

  if (!request) {
    return { error: 'Request not found' };
  }

  if (request.businessId !== Number(session.businessId)) {
    return { error: 'Unauthorized' };
  }

  if (request.status !== 'PENDING') {
    return { error: 'Request already processed' };
  }

  const payload = request.payload as Record<string, unknown>;

  await prisma.$transaction(async (tx) => {
    if (request.actionType === 'UPDATE_PRODUCT') {
      await tx.product.update({
        where: { id: request.targetId },
        data: payload,
      });
    } else if (request.actionType === 'DELETE_PRODUCT') {
      await tx.product.delete({
        where: { id: request.targetId },
      });
    } else if (request.actionType === 'REMOVE_PRODUCT') {
      await tx.product.update({
        where: { id: request.targetId },
        data: {
          removalReason: (payload.reason as 'expired' | 'damaged' | 'low_demand' | null) || null,
          removedAt: new Date(),
        },
      });
    } else if (request.actionType === 'CREATE_PRODUCT') {
      await tx.product.create({
        data: {
          name: payload.name as string,
          sku: payload.sku as string,
          price: payload.price as number,
          stock: (payload.stock as number) || 0,
          category: payload.category as string | undefined,
          description: payload.description as string | undefined,
          expiryDate: payload.expiryDate ? new Date(payload.expiryDate as string) : null,
          businessId: request.businessId,
        },
      });
    }

    await tx.editRequest.update({
      where: { id },
      data: {
        status: 'APPROVED',
        reviewedById: Number(session.id),
      },
    });
  });

  await prisma.activityLog.create({
    data: {
      action: 'APPROVE_REQUEST',
      entity: 'EditRequest',
      entityId: id,
      description: `Approved ${request.actionType} request for ${request.targetType} #${request.targetId}`,
      userId: Number(session.id),
      businessId: Number(session.businessId) || 0,
    },
  });

  revalidatePath('/dashboard/requests');
  revalidatePath('/dashboard/products');

  try {
    await triggerRequestEvent(Number(session.businessId), 'request-approved', {
      request: { id: request.id, actionType: request.actionType, targetType: request.targetType, targetId: request.targetId, status: 'APPROVED', requestedById: request.requestedById },
    });
  } catch { /* Pusher not configured */ }

  return { success: 'Request approved' };
}

export async function rejectRequest(token: string, id: number, reason?: string) {
  const session = await getAuthSession(token);

  if (session.role !== 'owner' && session.role !== 'manager') {
    return { error: 'Only owners and managers can reject requests' };
  }

  const request = await prisma.editRequest.findUnique({
    where: { id },
  });

  if (!request) {
    return { error: 'Request not found' };
  }

  if (request.businessId !== Number(session.businessId)) {
    return { error: 'Unauthorized' };
  }

  if (request.status !== 'PENDING') {
    return { error: 'Request already processed' };
  }

  await prisma.editRequest.update({
    where: { id },
    data: {
      status: 'REJECTED',
      reviewedById: Number(session.id),
    },
  });

  await prisma.activityLog.create({
    data: {
      action: 'REJECT_REQUEST',
      entity: 'EditRequest',
      entityId: id,
      description: `Rejected ${request.actionType} request for ${request.targetType} #${request.targetId}${reason ? `: ${reason}` : ''}`,
      userId: Number(session.id),
      businessId: Number(session.businessId) || 0,
    },
  });

  revalidatePath('/dashboard/requests');

  try {
    await triggerRequestEvent(Number(session.businessId), 'request-rejected', {
      request: { id: request.id, actionType: request.actionType, targetType: request.targetType, targetId: request.targetId, status: 'REJECTED', requestedById: request.requestedById },
    });
  } catch { /* Pusher not configured */ }

  return { success: 'Request rejected' };
}
