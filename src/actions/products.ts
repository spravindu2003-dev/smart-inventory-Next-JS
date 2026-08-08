'use server';

import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { productSchema, updateProductSchema } from '@/lib/validations';
import { revalidatePath } from 'next/cache';

export async function getProducts(params?: { page?: number; limit?: number; filter?: string }) {
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

  if (params?.filter === 'active') {
    where.removedAt = null;
  } else if (params?.filter === 'removed') {
    where.removedAt = { not: null };
  }

  const [products, total] = await Promise.all([
    prisma.product.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: 'desc' },
    }),
    prisma.product.count({ where }),
  ]);

  return {
    products,
    pagination: {
      page,
      limit,
      total,
      pages: Math.ceil(total / limit),
    },
  };
}

export async function getProduct(id: number) {
  const session = await auth();

  if (!session?.user) {
    return { error: 'Unauthorized' };
  }

  const product = await prisma.product.findUnique({
    where: { id },
  });

  if (!product) {
    return { error: 'Product not found' };
  }

  return { product };
}

export async function createProduct(data: {
  name: string;
  sku: string;
  price: number;
  stock: number;
  category?: string;
  description?: string;
  expiryDate?: string | null;
}) {
  const session = await auth();

  if (!session?.user) {
    return { error: 'Unauthorized' };
  }

  if (session.user.role === 'cashier') {
    return { error: 'Cashiers cannot create products directly' };
  }

  const validatedFields = productSchema.safeParse(data);

  if (!validatedFields.success) {
    return { error: 'Invalid fields', details: validatedFields.error.flatten().fieldErrors };
  }

  const { name, sku, price, stock, category, description, expiryDate } = validatedFields.data;

  const existingProduct = await prisma.product.findUnique({
    where: { sku },
  });

  if (existingProduct) {
    return { error: 'Product with this SKU already exists' };
  }

  const product = await prisma.product.create({
    data: {
      name,
      sku,
      price,
      stock,
      category,
      description,
      expiryDate: expiryDate ? new Date(expiryDate) : null,
      businessId: Number(session.user.businessId) || 0,
    },
  });

  await prisma.activityLog.create({
    data: {
      action: 'CREATE_PRODUCT',
      entity: 'Product',
      entityId: product.id,
      description: `Created product ${product.name}`,
      userId: Number(session.user.id),
      businessId: Number(session.user.businessId) || 0,
    },
  });

  revalidatePath('/dashboard/products');

  return { success: 'Product created', product };
}

export async function updateProduct(
  id: number,
  data: {
    name?: string;
    sku?: string;
    price?: number;
    stock?: number;
    category?: string;
    description?: string;
    expiryDate?: string | null;
  }
) {
  const session = await auth();

  if (!session?.user) {
    return { error: 'Unauthorized' };
  }

  const existingProduct = await prisma.product.findUnique({
    where: { id },
  });

  if (!existingProduct) {
    return { error: 'Product not found' };
  }

  if (session.user.role === 'cashier') {
    return {
      success: 'Edit request sent to manager',
      request: true,
    };
  }

  const validatedFields = updateProductSchema.safeParse(data);

  if (!validatedFields.success) {
    return { error: 'Invalid fields', details: validatedFields.error.flatten().fieldErrors };
  }

  const updateData = validatedFields.data;

  if (updateData.expiryDate !== undefined) {
    updateData.expiryDate = updateData.expiryDate ? new Date(updateData.expiryDate as any) as any : null;
  }

  const product = await prisma.product.update({
    where: { id },
    data: updateData,
  });

  await prisma.activityLog.create({
    data: {
      action: 'UPDATE_PRODUCT',
      entity: 'Product',
      entityId: product.id,
      description: `Updated product ${product.name}`,
      userId: Number(session.user.id),
      businessId: Number(session.user.businessId) || 0,
    },
  });

  revalidatePath('/dashboard/products');

  return { success: 'Product updated', product };
}

export async function deleteProduct(id: number) {
  const session = await auth();

  if (!session?.user) {
    return { error: 'Unauthorized' };
  }

  if (session.user.role !== 'owner' && session.user.role !== 'manager') {
    return { error: 'Unauthorized' };
  }

  const product = await prisma.product.findUnique({
    where: { id },
  });

  if (!product) {
    return { error: 'Product not found' };
  }

  await prisma.product.delete({
    where: { id },
  });

  await prisma.activityLog.create({
    data: {
      action: 'DELETE_PRODUCT',
      entity: 'Product',
      entityId: id,
      description: `Deleted product ${product.name}`,
      userId: Number(session.user.id),
      businessId: Number(session.user.businessId) || 0,
    },
  });

  revalidatePath('/dashboard/products');

  return { success: 'Product deleted' };
}

export async function removeProduct(id: number, reason?: string) {
  const session = await auth();

  if (!session?.user) {
    return { error: 'Unauthorized' };
  }

  const product = await prisma.product.findUnique({
    where: { id },
  });

  if (!product) {
    return { error: 'Product not found' };
  }

  if (session.user.role === 'cashier') {
    return {
      success: 'Removal request sent to manager',
      request: true,
    };
  }

  const removedProduct = await prisma.product.update({
    where: { id },
    data: {
      removalReason: reason as any || null,
      removedAt: new Date(),
    },
  });

  await prisma.activityLog.create({
    data: {
      action: 'REMOVE_PRODUCT',
      entity: 'Product',
      entityId: id,
      description: `Removed product ${product.name} (Reason: ${reason || 'N/A'})`,
      userId: Number(session.user.id),
      businessId: Number(session.user.businessId) || 0,
    },
  });

  revalidatePath('/dashboard/products');

  return { success: 'Product removed', product: removedProduct };
}