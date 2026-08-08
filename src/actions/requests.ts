'use server';

import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { editRequestSchema } from '@/lib/validations';
import { revalidatePath } from 'next/cache';

export async function getRequests(params?: { page?: number; limit?: number; status?: string }) {
  const session = await auth();

  if (!session?.user) {
    return { error: 'Unauthorized' };
  }

  const page = params?.page || 1;
  const limit = params?.limit || 50;
  const skip = (page - 1) * limit;

  const where: any = {
    businessId: Number(session.user.businessId) || 0,
  };

  if (session.user.role === 'cashier') {
    where.requestedById = Number(session.user.id);
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

export async function getPendingRequestCount() {
  const session = await auth();

  if (!session?.user) {
    return { error: 'Unauthorized' };
  }

  if (session.user.role !== 'owner' && session.user.role !== 'manager') {
    return { count: 0 };
  }

  const count = await prisma.editRequest.count({
    where: {
      businessId: Number(session.user.businessId) || 0,
      status: 'PENDING',
    },
  });

  return { count };
}

export async function createRequest(data: {
  targetType: string;
  targetId: number;
  actionType: string;
  payload: Record<string, unknown>;
  message?: string;
}) {
  const session = await auth();

  if (!session?.user) {
    return { error: 'Unauthorized' };
  }

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
      payload: payload as any,
      message,
      businessId: Number(session.user.businessId) || 0,
      requestedById: Number(session.user.id),
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
      userId: Number(session.user.id),
      businessId: Number(session.user.businessId) || 0,
    },
  });

  revalidatePath('/dashboard/requests');

  return { success: 'Request created', request };
}

export async function approveRequest(id: number) {
  const session = await auth();

  if (!session?.user) {
    return { error: 'Unauthorized' };
  }

  if (session.user.role !== 'owner' && session.user.role !== 'manager') {
    return { error: 'Only owners and managers can approve requests' };
  }

  const request = await prisma.editRequest.findUnique({
    where: { id },
  });

  if (!request) {
    return { error: 'Request not found' };
  }

  if (request.status !== 'PENDING') {
    return { error: 'Request already processed' };
  }

  const payload = request.payload as Record<string, any>;

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
          removalReason: payload.reason || null,
          removedAt: new Date(),
        },
      });
    }

    await tx.editRequest.update({
      where: { id },
      data: {
        status: 'APPROVED',
        reviewedById: Number(session.user.id),
      },
    });
  });

  await prisma.activityLog.create({
    data: {
      action: 'APPROVE_REQUEST',
      entity: 'EditRequest',
      entityId: id,
      description: `Approved ${request.actionType} request for ${request.targetType} #${request.targetId}`,
      userId: Number(session.user.id),
      businessId: Number(session.user.businessId) || 0,
    },
  });

  revalidatePath('/dashboard/requests');
  revalidatePath('/dashboard/products');

  return { success: 'Request approved' };
}

export async function rejectRequest(id: number) {
  const session = await auth();

  if (!session?.user) {
    return { error: 'Unauthorized' };
  }

  if (session.user.role !== 'owner' && session.user.role !== 'manager') {
    return { error: 'Only owners and managers can reject requests' };
  }

  const request = await prisma.editRequest.findUnique({
    where: { id },
  });

  if (!request) {
    return { error: 'Request not found' };
  }

  if (request.status !== 'PENDING') {
    return { error: 'Request already processed' };
  }

  await prisma.editRequest.update({
    where: { id },
    data: {
      status: 'REJECTED',
      reviewedById: Number(session.user.id),
    },
  });

  await prisma.activityLog.create({
    data: {
      action: 'REJECT_REQUEST',
      entity: 'EditRequest',
      entityId: id,
      description: `Rejected ${request.actionType} request for ${request.targetType} #${request.targetId}`,
      userId: Number(session.user.id),
      businessId: Number(session.user.businessId) || 0,
    },
  });

  revalidatePath('/dashboard/requests');

  return { success: 'Request rejected' };
}