'use server';

import { getAuthSession } from '@/lib/server-auth';
import { prisma } from '@/lib/prisma';
import { productSchema, updateProductSchema } from '@/lib/validations';
import { revalidatePath } from 'next/cache';
import { serialize } from '@/lib/serialize';

export async function getProducts(token: string, params?: { page?: number; limit?: number; filter?: string }) {
  const session = await getAuthSession(token);

  const page = params?.page || 1;
  const limit = params?.limit || 50;
  const skip = (page - 1) * limit;

  const where: Record<string, unknown> = {
    businessId: Number(session.businessId) || 0,
  };

  if (params?.filter === 'active') {
    (where as Record<string, unknown>).removedAt = null;
  } else if (params?.filter === 'removed') {
    (where as Record<string, unknown>).removedAt = { not: null };
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
    products: serialize(products),
    pagination: {
      page,
      limit,
      total,
      pages: Math.ceil(total / limit),
    },
  };
}

export async function getProduct(token: string, id: number) {
  const session = await getAuthSession(token);

  const product = await prisma.product.findUnique({
    where: { id },
  });

  if (!product) {
    return { error: 'Product not found' };
  }

  return { product: serialize(product) };
}

export async function createProduct(
  token: string,
  data: {
    name: string;
    sku: string;
    price: number;
    stock: number;
    category?: string;
    description?: string;
    expiryDate?: string | null;
  }
) {
  const session = await getAuthSession(token);

  if (session.role === 'cashier') {
    return { error: 'Cashiers cannot create products. Please ask a manager to create it.' };
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
      businessId: Number(session.businessId) || 0,
    },
  });

  await prisma.activityLog.create({
    data: {
      action: 'CREATE_PRODUCT',
      entity: 'Product',
      entityId: product.id,
      description: `Created product ${product.name}`,
      userId: Number(session.id),
      businessId: Number(session.businessId) || 0,
    },
  });

  revalidatePath('/dashboard/products');

  return { success: 'Product created', product: serialize(product) };
}

export async function updateProduct(
  token: string,
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
  const session = await getAuthSession(token);

  if (session.role === 'cashier') {
    return { error: 'Cashiers cannot update products directly. Please submit a change request.' };
  }

  const existingProduct = await prisma.product.findUnique({ where: { id } });
  if (!existingProduct) {
    return { error: 'Product not found' };
  }

  const validatedFields = updateProductSchema.safeParse(data);
  if (!validatedFields.success) {
    return { error: 'Invalid fields', details: validatedFields.error.flatten().fieldErrors };
  }

  const updateData = validatedFields.data;

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
      userId: Number(session.id),
      businessId: Number(session.businessId) || 0,
    },
  });

  revalidatePath('/dashboard/products');

  return { success: 'Product updated', product: serialize(product) };
}

export async function deleteProduct(token: string, id: number) {
  const session = await getAuthSession(token);

  if (session.role === 'cashier') {
    return { error: 'Cashiers cannot delete products. Please submit a change request.' };
  }

  if (session.role !== 'owner' && session.role !== 'manager') {
    return { error: 'Unauthorized' };
  }

  const product = await prisma.product.findUnique({ where: { id } });
  if (!product) {
    return { error: 'Product not found' };
  }

  await prisma.product.delete({ where: { id } });

  await prisma.activityLog.create({
    data: {
      action: 'DELETE_PRODUCT',
      entity: 'Product',
      entityId: id,
      description: `Deleted product ${product.name}`,
      userId: Number(session.id),
      businessId: Number(session.businessId) || 0,
    },
  });

  revalidatePath('/dashboard/products');

  return { success: 'Product deleted' };
}

export async function removeProduct(token: string, id: number, reason?: string) {
  const session = await getAuthSession(token);

  if (session.role === 'cashier') {
    return { error: 'Cashiers cannot remove products directly. Please submit a change request.' };
  }

  const product = await prisma.product.findUnique({ where: { id } });
  if (!product) {
    return { error: 'Product not found' };
  }

  const removedProduct = await prisma.product.update({
    where: { id },
    data: {
      removalReason: (reason as 'expired' | 'damaged' | 'low_demand' | null) || null,
      removedAt: new Date(),
    },
  });

  await prisma.activityLog.create({
    data: {
      action: 'REMOVE_PRODUCT',
      entity: 'Product',
      entityId: id,
      description: `Removed product ${product.name} (Reason: ${reason || 'N/A'})`,
      userId: Number(session.id),
      businessId: Number(session.businessId) || 0,
    },
  });

  revalidatePath('/dashboard/products');

  return { success: 'Product removed', product: serialize(removedProduct) };
}
