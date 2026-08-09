'use server';

import { getAuthSession } from '@/lib/server-auth';
import { prisma } from '@/lib/prisma';
import { createSaleSchema, updateSaleSchema } from '@/lib/validations';
import { revalidatePath } from 'next/cache';
import { serialize } from '@/lib/serialize';

export async function getSales(token: string, params?: { page?: number; limit?: number }) {
  const session = await getAuthSession(token);

  const page = params?.page || 1;
  const limit = params?.limit || 50;
  const skip = (page - 1) * limit;

  const where = {
    businessId: Number(session.businessId) || 0,
  };

  const [sales, total] = await Promise.all([
    prisma.sale.findMany({
      where,
      include: {
        user: {
          select: { id: true, name: true, email: true },
        },
        items: {
          include: {
            product: {
              select: { id: true, name: true, sku: true, price: true, stock: true },
            },
          },
        },
      },
      skip,
      take: limit,
      orderBy: { createdAt: 'desc' },
    }),
    prisma.sale.count({ where }),
  ]);

  return {
    sales: serialize(sales),
    pagination: {
      page,
      limit,
      total,
      pages: Math.ceil(total / limit),
    },
  };
}

export async function getSale(token: string, id: number) {
  const session = await getAuthSession(token);

  const sale = await prisma.sale.findUnique({
    where: { id },
    include: {
      user: {
        select: { id: true, name: true, email: true },
      },
      items: {
        include: {
          product: {
            select: { id: true, name: true, sku: true, price: true, stock: true },
          },
        },
      },
    },
  });

  if (!sale) {
    return { error: 'Sale not found' };
  }

  return { sale: serialize(sale) };
}

export async function createSale(token: string, data: { items: { productId: number; quantity: number }[] }) {
  const session = await getAuthSession(token);

  const validatedFields = createSaleSchema.safeParse(data);

  if (!validatedFields.success) {
    return { error: 'Invalid fields', details: validatedFields.error.flatten().fieldErrors };
  }

  const { items } = validatedFields.data;

  const productIds = items.map((item) => item.productId);

  const products = await prisma.product.findMany({
    where: {
      id: { in: productIds },
      businessId: Number(session.businessId) || 0,
    },
  });

  if (products.length !== items.length) {
    return { error: 'Some products not found' };
  }

  const outOfStock = items.filter((item) => {
    const product = products.find((p) => p.id === item.productId);
    return product && product.stock < item.quantity;
  });

  if (outOfStock.length > 0) {
    const productNames = outOfStock.map((item) => {
      const product = products.find((p) => p.id === item.productId);
      return product?.name;
    });
    return { error: `Insufficient stock for: ${productNames.join(', ')}` };
  }

  const sale = await prisma.$transaction(async (tx) => {
    let total = 0;

    const saleItems = items.map((item) => {
      const product = products.find((p) => p.id === item.productId)!;
      const unitPrice = product.price;
      const subtotal = unitPrice.mul(item.quantity);
      total = total + subtotal.toNumber();

      return {
        productId: item.productId,
        quantity: item.quantity,
        unitPrice,
        subtotal,
        userId: Number(session.id),
      };
    });

    const createdSale = await tx.sale.create({
      data: {
        total,
        userId: Number(session.id),
        businessId: Number(session.businessId) || 0,
        items: {
          create: saleItems,
        },
      },
      include: {
        items: true,
      },
    });

    for (const item of items) {
      await tx.product.update({
        where: { id: item.productId },
        data: {
          stock: {
            decrement: item.quantity,
          },
        },
      });
    }

    return createdSale;
  });

  await prisma.activityLog.create({
    data: {
      action: 'CREATE_SALE',
      entity: 'Sale',
      entityId: sale.id,
      description: `Created sale #${sale.id} with ${items.length} items`,
      userId: Number(session.id),
      businessId: Number(session.businessId) || 0,
    },
  });

  revalidatePath('/dashboard/sales');
  revalidatePath('/dashboard');
  revalidatePath('/dashboard/products');

  return { success: 'Sale created', sale: serialize(sale) };
}

export async function updateSale(token: string, id: number, data: { items: { productId: number; quantity: number }[] }) {
  const session = await getAuthSession(token);

  const validatedFields = updateSaleSchema.safeParse(data);

  if (!validatedFields.success) {
    return { error: 'Invalid fields', details: validatedFields.error.flatten().fieldErrors };
  }

  const existingSale = await prisma.sale.findUnique({
    where: { id },
    include: { items: true },
  });

  if (!existingSale) {
    return { error: 'Sale not found' };
  }

  const { items } = validatedFields.data;

  const productIds = items.map((item) => item.productId);

  const products = await prisma.product.findMany({
    where: {
      id: { in: productIds },
      businessId: Number(session.businessId) || 0,
    },
  });

  if (products.length !== items.length) {
    return { error: 'Some products not found' };
  }

  const outOfStock = items.filter((item) => {
    const product = products.find((p) => p.id === item.productId);
    return product && product.stock < item.quantity;
  });

  if (outOfStock.length > 0) {
    const productNames = outOfStock.map((item) => {
      const product = products.find((p) => p.id === item.productId);
      return product?.name;
    });
    return { error: `Insufficient stock for: ${productNames.join(', ')}` };
  }

  const sale = await prisma.$transaction(async (tx) => {
    for (const oldItem of existingSale.items) {
      await tx.product.update({
        where: { id: oldItem.productId },
        data: {
          stock: {
            increment: oldItem.quantity,
          },
        },
      });
    }

    await tx.saleItem.deleteMany({
      where: { saleId: id },
    });

    let total = 0;

    const saleItems = items.map((item) => {
      const product = products.find((p) => p.id === item.productId)!;
      const unitPrice = product.price;
      const subtotal = unitPrice.mul(item.quantity);
      total = total + subtotal.toNumber();

      return {
        saleId: id,
        productId: item.productId,
        quantity: item.quantity,
        unitPrice,
        subtotal,
        userId: Number(session.id),
      };
    });

    await tx.saleItem.createMany({
      data: saleItems,
    });

    for (const item of items) {
      await tx.product.update({
        where: { id: item.productId },
        data: {
          stock: {
            decrement: item.quantity,
          },
        },
      });
    }

    const updatedSale = await tx.sale.update({
      where: { id },
      data: { total },
      include: {
        items: {
          include: {
            product: true,
          },
        },
        user: true,
      },
    });

    return updatedSale;
  });

  await prisma.activityLog.create({
    data: {
      action: 'UPDATE_SALE',
      entity: 'Sale',
      entityId: id,
      description: `Updated sale #${id}`,
      userId: Number(session.id),
      businessId: Number(session.businessId) || 0,
    },
  });

  revalidatePath('/dashboard/sales');
  revalidatePath('/dashboard');
  revalidatePath('/dashboard/products');

  return { success: 'Sale updated', sale: serialize(sale) };
}

export async function undoSale(token: string, id: number) {
  const session = await getAuthSession(token);

  const existingSale = await prisma.sale.findUnique({
    where: { id },
    include: { items: true },
  });

  if (!existingSale) {
    return { error: 'Sale not found' };
  }

  await prisma.$transaction(async (tx) => {
    for (const item of existingSale.items) {
      await tx.product.update({
        where: { id: item.productId },
        data: {
          stock: {
            increment: item.quantity,
          },
        },
      });
    }

    await tx.saleItem.deleteMany({
      where: { saleId: id },
    });

    await tx.sale.delete({
      where: { id },
    });
  });

  await prisma.activityLog.create({
    data: {
      action: 'UNDO_SALE',
      entity: 'Sale',
      entityId: id,
      description: `Undone sale #${id}`,
      userId: Number(session.id),
      businessId: Number(session.businessId) || 0,
    },
  });

  revalidatePath('/dashboard/sales');
  revalidatePath('/dashboard');
  revalidatePath('/dashboard/products');

  return { success: 'Sale undone' };
}
