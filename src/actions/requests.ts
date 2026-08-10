'use server';

import { getAuthSession } from '@/lib/server-auth';
import { prisma } from '@/lib/prisma';
import { productChangeRequestSchema, rejectRequestSchema } from '@/lib/validations';
import { serialize } from '@/lib/serialize';
import { revalidatePath } from 'next/cache';
import { triggerRequestEvent } from '@/lib/pusher';

const REQUEST_INCLUDE = {
  requestedBy: {
    select: { id: true, name: true, email: true, role: true },
  },
  reviewedBy: {
    select: { id: true, name: true, email: true },
  },
} as const;

function getProductFields(product: Record<string, unknown>) {
  return {
    name: product.name,
    sku: product.sku,
    price: Number(product.price),
    stock: product.stock,
    category: product.category,
    description: product.description,
    expiryDate: product.expiryDate,
  };
}

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
        ...REQUEST_INCLUDE,
      },
      skip,
      take: limit,
      orderBy: { createdAt: 'desc' },
    }),
    prisma.editRequest.count({ where }),
  ]);

  const requestsWithProduct = await Promise.all(
    requests.map(async (req) => {
      let product = null;
      if (req.targetType === 'product') {
        const p = await prisma.product.findUnique({ where: { id: req.targetId } });
        if (p) product = serialize(p);
      }
      return { ...req, product };
    })
  );

  return {
    requests: serialize(requestsWithProduct),
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

  const where: Record<string, unknown> = {
    businessId: Number(session.businessId) || 0,
    status: 'PENDING',
  };

  if (session.role === 'cashier') {
    where.requestedById = Number(session.id);
  }

  const count = await prisma.editRequest.count({ where });

  return { count };
}

export async function createProductChangeRequest(
  token: string,
  data: {
    targetType: 'product';
    targetId: number;
    actionType: 'UPDATE_PRODUCT' | 'REMOVE_PRODUCT' | 'DELETE_PRODUCT';
    changes: Record<string, unknown>;
    reason: string;
  }
) {
  const session = await getAuthSession(token);

  if (session.role !== 'cashier') {
    return { error: 'Only cashiers can submit product change requests' };
  }

  const validated = productChangeRequestSchema.safeParse(data);
  if (!validated.success) {
    return { error: 'Invalid request', details: validated.error.flatten().fieldErrors };
  }

  const { targetId, actionType, changes, reason } = validated.data;

  const product = await prisma.product.findUnique({ where: { id: targetId } });
  if (!product) {
    return { error: 'Product not found' };
  }

  if (product.businessId !== Number(session.businessId)) {
    return { error: 'Unauthorized' };
  }

  if (actionType !== 'DELETE_PRODUCT' && product.removedAt) {
    return { error: 'Cannot modify a removed product' };
  }

  const existingPending = await prisma.editRequest.findFirst({
    where: {
      businessId: Number(session.businessId) || 0,
      requestedById: Number(session.id),
      targetId,
      actionType,
      status: 'PENDING',
    },
  });

  if (existingPending) {
    const existingPayload = existingPending.payload as Record<string, unknown>;
    const sameChanges = Object.keys(changes).every(
      (key) => JSON.stringify(changes[key]) === JSON.stringify(existingPayload[key])
    );
    if (sameChanges) {
      return { error: 'You already have a pending request for this change' };
    }
  }

  const productSnapshot = getProductFields(product as unknown as Record<string, unknown>);

  const message = reason;

  const request = await prisma.editRequest.create({
    data: {
      targetType: 'product',
      targetId,
      actionType,
      payload: changes as never,
      message,
      productSnapshot: productSnapshot as never,
      businessId: Number(session.businessId) || 0,
      requestedById: Number(session.id),
    },
    include: REQUEST_INCLUDE,
  });

  await prisma.activityLog.create({
    data: {
      action: 'REQUEST_CREATED',
      entity: 'EditRequest',
      entityId: request.id,
      description: `Created ${actionType.replace('_', ' ')} request for product "${product.name}"`,
      userId: Number(session.id),
      businessId: Number(session.businessId) || 0,
    },
  });

  revalidatePath('/dashboard/requests');

  try {
    await triggerRequestEvent(Number(session.businessId), 'request-created', {
      request: {
        id: request.id,
        actionType: request.actionType,
        targetType: request.targetType,
        targetId: request.targetId,
        status: request.status,
        message: request.message,
        createdAt: request.createdAt,
        requestedBy: request.requestedBy,
        product: { name: product.name, price: Number(product.price), stock: product.stock, sku: product.sku },
        changes,
      },
    });
  } catch { /* Pusher not configured */ }

  return { success: 'Change request submitted', request: serialize(request) };
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

  if (session.role === 'cashier') {
    return { error: 'Cashiers must use the product change request workflow' };
  }

  const request = await prisma.editRequest.create({
    data: {
      targetType: data.targetType,
      targetId: data.targetId,
      actionType: data.actionType,
      payload: data.payload as never,
      message: data.message,
      businessId: Number(session.businessId) || 0,
      requestedById: Number(session.id),
    },
    include: REQUEST_INCLUDE,
  });

  await prisma.activityLog.create({
    data: {
      action: 'REQUEST_CREATED',
      entity: 'EditRequest',
      entityId: request.id,
      description: `Created ${data.actionType} request for ${data.targetType} #${data.targetId}`,
      userId: Number(session.id),
      businessId: Number(session.businessId) || 0,
    },
  });

  revalidatePath('/dashboard/requests');

  try {
    await triggerRequestEvent(Number(session.businessId), 'request-created', {
      request: {
        id: request.id,
        actionType: request.actionType,
        targetType: request.targetType,
        targetId: request.targetId,
        status: request.status,
        createdAt: request.createdAt,
        requestedBy: request.requestedBy,
      },
    });
  } catch { /* Pusher not configured */ }

  return { success: 'Request created', request: serialize(request) };
}

export async function approveRequest(token: string, id: number) {
  const session = await getAuthSession(token);

  if (session.role !== 'owner' && session.role !== 'manager') {
    return { error: 'Only owners and managers can approve requests' };
  }

  const request = await prisma.editRequest.findUnique({ where: { id } });
  if (!request) {
    return { error: 'Request not found' };
  }

  if (request.businessId !== Number(session.businessId)) {
    return { error: 'Unauthorized' };
  }

  if (request.status !== 'PENDING') {
    return { error: 'This request has already been processed' };
  }

  const payload = request.payload as Record<string, unknown>;
  const snapshot = request.productSnapshot as Record<string, unknown> | null;

  if (request.actionType === 'UPDATE_PRODUCT' && snapshot) {
    const currentProduct = await prisma.product.findUnique({ where: { id: request.targetId } });
    if (!currentProduct) {
      return { error: 'Product no longer exists' };
    }

    const currentSnapshot = getProductFields(currentProduct as unknown as Record<string, unknown>);
    const conflicts: string[] = [];

    for (const key of Object.keys(payload)) {
      if (key === 'expiryDate') continue;
      const originalVal = snapshot[key];
      const currentVal = currentSnapshot[key as keyof typeof currentSnapshot];
      if (JSON.stringify(originalVal) !== JSON.stringify(currentVal)) {
        conflicts.push(key);
      }
    }

    if (conflicts.length > 0) {
      return {
        error: 'This request conflicts with current product data. The product has been modified since this request was submitted.',
        conflicts,
      };
    }
  }

  await prisma.$transaction(async (tx) => {
    if (request.actionType === 'UPDATE_PRODUCT') {
      const allowedFields: Record<string, unknown> = {};
      for (const [key, val] of Object.entries(payload)) {
        if (['name', 'sku', 'price', 'stock', 'category', 'description', 'expiryDate'].includes(key)) {
          allowedFields[key] = key === 'expiryDate' && val ? new Date(val as string) : val;
        }
      }
      await tx.product.update({
        where: { id: request.targetId },
        data: allowedFields,
      });
    } else if (request.actionType === 'DELETE_PRODUCT') {
      await tx.product.delete({ where: { id: request.targetId } });
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
        reviewedAt: new Date(),
      },
    });
  });

  const product = request.targetType === 'product'
    ? await prisma.product.findUnique({ where: { id: request.targetId } }).catch(() => null)
    : null;

  await prisma.activityLog.create({
    data: {
      action: 'REQUEST_APPROVED',
      entity: 'EditRequest',
      entityId: id,
      description: `Approved ${request.actionType.replace('_', ' ')} request for ${request.targetType} #${request.targetId}`,
      userId: Number(session.id),
      businessId: Number(session.businessId) || 0,
    },
  });

  if (request.actionType.includes('PRODUCT')) {
    await prisma.activityLog.create({
      data: {
        action: 'PRODUCT_UPDATED_AFTER_APPROVAL',
        entity: 'Product',
        entityId: request.targetId,
        description: `Product updated after request #${id} approval`,
        userId: Number(session.id),
        businessId: Number(session.businessId) || 0,
      },
    });
  }

  revalidatePath('/dashboard/requests');
  revalidatePath('/dashboard/products');

  try {
    await triggerRequestEvent(Number(session.businessId), 'request-approved', {
      request: {
        id: request.id,
        actionType: request.actionType,
        targetType: request.targetType,
        targetId: request.targetId,
        status: 'APPROVED',
        requestedById: request.requestedById,
        reviewedBy: { id: session.id, name: session.name || 'Manager' },
        product: product ? { name: product.name, price: Number(product.price), stock: product.stock } : null,
      },
    });
  } catch { /* Pusher not configured */ }

  return { success: 'Request approved' };
}

export async function rejectRequest(token: string, id: number, reason?: string) {
  const session = await getAuthSession(token);

  if (session.role !== 'owner' && session.role !== 'manager') {
    return { error: 'Only owners and managers can reject requests' };
  }

  if (!reason || reason.trim().length === 0) {
    const validated = rejectRequestSchema.safeParse({ reason: reason || '' });
    if (!validated.success) {
      return { error: 'Rejection reason is required' };
    }
  }

  const request = await prisma.editRequest.findUnique({ where: { id } });
  if (!request) {
    return { error: 'Request not found' };
  }

  if (request.businessId !== Number(session.businessId)) {
    return { error: 'Unauthorized' };
  }

  if (request.status !== 'PENDING') {
    return { error: 'This request has already been processed' };
  }

  await prisma.editRequest.update({
    where: { id },
    data: {
      status: 'REJECTED',
      rejectionReason: reason?.trim() || null,
      reviewedById: Number(session.id),
      reviewedAt: new Date(),
    },
  });

  await prisma.activityLog.create({
    data: {
      action: 'REQUEST_REJECTED',
      entity: 'EditRequest',
      entityId: id,
      description: `Rejected ${request.actionType.replace('_', ' ')} request for ${request.targetType} #${request.targetId}${reason ? `: ${reason}` : ''}`,
      userId: Number(session.id),
      businessId: Number(session.businessId) || 0,
    },
  });

  revalidatePath('/dashboard/requests');

  try {
    await triggerRequestEvent(Number(session.businessId), 'request-rejected', {
      request: {
        id: request.id,
        actionType: request.actionType,
        targetType: request.targetType,
        targetId: request.targetId,
        status: 'REJECTED',
        requestedById: request.requestedById,
        rejectionReason: reason?.trim() || null,
        reviewedBy: { id: session.id, name: session.name || 'Manager' },
      },
    });
  } catch { /* Pusher not configured */ }

  return { success: 'Request rejected' };
}
