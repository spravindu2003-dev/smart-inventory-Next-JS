'use server';

import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function getDashboardSummary() {
  const session = await auth();

  if (!session?.user) {
    return { error: 'Unauthorized' };
  }

  const businessId = Number(session.user.businessId) || 0;

  const [
    totalProducts,
    totalStock,
    lowStockProducts,
    salesData,
    recentSales,
    topProducts,
  ] = await Promise.all([
    prisma.product.count({
      where: { businessId, removedAt: null },
    }),
    prisma.product.aggregate({
      where: { businessId, removedAt: null },
      _sum: { stock: true },
    }),
    prisma.product.count({
      where: {
        businessId,
        removedAt: null,
        stock: { lte: 10, gt: 0 },
      },
    }),
    prisma.sale.aggregate({
      where: { businessId },
      _sum: { total: true },
      _count: true,
    }),
    prisma.sale.findMany({
      where: { businessId },
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
      orderBy: { createdAt: 'desc' },
      take: 10,
    }),
    prisma.product.findMany({
      where: { businessId, removedAt: null },
      orderBy: { createdAt: 'desc' },
      take: 5,
    }),
  ]);

  return {
    totalProducts,
    totalStock: totalStock._sum.stock || 0,
    lowStockCount: lowStockProducts,
    totalRevenue: Number(salesData._sum.total) || 0,
    totalSales: salesData._count,
    recentSales,
    topProducts,
  };
}

export async function getMostSold() {
  const session = await auth();

  if (!session?.user) {
    return { error: 'Unauthorized' };
  }

  const businessId = Number(session.user.businessId) || 0;

  const products = await prisma.product.findMany({
    where: { businessId, removedAt: null },
    include: {
      saleItems: {
        select: {
          quantity: true,
          subtotal: true,
        },
      },
    },
  });

  const productsWithSales = products.map((product) => ({
    id: product.id,
    name: product.name,
    sku: product.sku,
    totalSold: product.saleItems.reduce((sum, item) => sum + item.quantity, 0),
    totalRevenue: product.saleItems.reduce((sum, item) => sum + Number(item.subtotal), 0),
  }));

  productsWithSales.sort((a, b) => b.totalSold - a.totalSold);

  return { products: productsWithSales };
}

export async function getLeastSold() {
  const session = await auth();

  if (!session?.user) {
    return { error: 'Unauthorized' };
  }

  const businessId = Number(session.user.businessId) || 0;

  const products = await prisma.product.findMany({
    where: { businessId, removedAt: null },
    include: {
      saleItems: {
        select: {
          quantity: true,
          subtotal: true,
        },
      },
    },
  });

  const productsWithSales = products.map((product) => ({
    id: product.id,
    name: product.name,
    sku: product.sku,
    totalSold: product.saleItems.reduce((sum, item) => sum + item.quantity, 0),
    totalRevenue: product.saleItems.reduce((sum, item) => sum + Number(item.subtotal), 0),
  }));

  productsWithSales.sort((a, b) => a.totalSold - b.totalSold);

  return { products: productsWithSales };
}

export async function getLowStock() {
  const session = await auth();

  if (!session?.user) {
    return { error: 'Unauthorized' };
  }

  const businessId = Number(session.user.businessId) || 0;

  const products = await prisma.product.findMany({
    where: {
      businessId,
      removedAt: null,
      stock: { lte: 10, gt: 0 },
    },
    orderBy: { stock: 'asc' },
  });

  return { products };
}

export async function getDeadStock() {
  const session = await auth();

  if (!session?.user) {
    return { error: 'Unauthorized' };
  }

  const businessId = Number(session.user.businessId) || 0;

  const products = await prisma.product.findMany({
    where: {
      businessId,
      removedAt: null,
      saleItems: { none: {} },
    },
  });

  return { products };
}

export async function getSalesTrend(days: number = 30) {
  const session = await auth();

  if (!session?.user) {
    return { error: 'Unauthorized' };
  }

  const businessId = Number(session.user.businessId) || 0;

  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  const sales = await prisma.sale.findMany({
    where: {
      businessId,
      createdAt: { gte: startDate },
    },
    select: {
      createdAt: true,
    },
  });

  const salesByDate: Record<string, number> = {};

  for (let i = 0; i < days; i++) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    const dateStr = date.toISOString().split('T')[0];
    salesByDate[dateStr] = 0;
  }

  sales.forEach((sale) => {
    const dateStr = sale.createdAt.toISOString().split('T')[0];
    salesByDate[dateStr] = (salesByDate[dateStr] || 0) + 1;
  });

  const trend = Object.entries(salesByDate)
    .map(([date, count]) => ({ date, count }))
    .sort((a, b) => a.date.localeCompare(b.date));

  return { trend };
}

export async function getRevenueTrend(days: number = 30) {
  const session = await auth();

  if (!session?.user) {
    return { error: 'Unauthorized' };
  }

  const businessId = Number(session.user.businessId) || 0;

  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  const sales = await prisma.sale.findMany({
    where: {
      businessId,
      createdAt: { gte: startDate },
    },
    select: {
      createdAt: true,
      total: true,
    },
  });

  const revenueByDate: Record<string, number> = {};

  for (let i = 0; i < days; i++) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    const dateStr = date.toISOString().split('T')[0];
    revenueByDate[dateStr] = 0;
  }

  sales.forEach((sale) => {
    const dateStr = sale.createdAt.toISOString().split('T')[0];
    revenueByDate[dateStr] = (revenueByDate[dateStr] || 0) + Number(sale.total);
  });

  const trend = Object.entries(revenueByDate)
    .map(([date, revenue]) => ({ date, revenue }))
    .sort((a, b) => a.date.localeCompare(b.date));

  return { trend };
}

export async function getTopProducts(limit: number = 10) {
  const session = await auth();

  if (!session?.user) {
    return { error: 'Unauthorized' };
  }

  const businessId = Number(session.user.businessId) || 0;

  const products = await prisma.product.findMany({
    where: { businessId, removedAt: null },
    include: {
      saleItems: {
        select: {
          quantity: true,
          subtotal: true,
        },
      },
    },
  });

  const productsWithSales = products.map((product) => ({
    id: product.id,
    name: product.name,
    sku: product.sku,
    totalSold: product.saleItems.reduce((sum, item) => sum + item.quantity, 0),
    totalRevenue: product.saleItems.reduce((sum, item) => sum + Number(item.subtotal), 0),
  }));

  productsWithSales.sort((a, b) => b.totalSold - a.totalSold);

  return { products: productsWithSales.slice(0, limit) };
}

export async function getStockDistribution() {
  const session = await auth();

  if (!session?.user) {
    return { error: 'Unauthorized' };
  }

  const businessId = Number(session.user.businessId) || 0;

  const [inStock, lowStock, outOfStock, expired] = await Promise.all([
    prisma.product.count({
      where: {
        businessId,
        removedAt: null,
        stock: { gt: 10 },
      },
    }),
    prisma.product.count({
      where: {
        businessId,
        removedAt: null,
        stock: { gt: 0, lte: 10 },
      },
    }),
    prisma.product.count({
      where: {
        businessId,
        removedAt: null,
        stock: 0,
      },
    }),
    prisma.product.count({
      where: {
        businessId,
        removedAt: null,
        expiryDate: { lt: new Date() },
      },
    }),
  ]);

  return { inStock, lowStock, outOfStock, expired };
}

export async function getCategoryDistribution() {
  const session = await auth();

  if (!session?.user) {
    return { error: 'Unauthorized' };
  }

  const businessId = Number(session.user.businessId) || 0;

  const categories = await prisma.product.groupBy({
    by: ['category'],
    where: {
      businessId,
      removedAt: null,
      category: { not: null },
    },
    _count: {
      category: true,
    },
  });

  return {
    categories: categories.map((cat) => ({
      category: cat.category || 'Uncategorized',
      count: cat._count.category,
    })),
  };
}

export async function getActivityDistribution() {
  const session = await auth();

  if (!session?.user) {
    return { error: 'Unauthorized' };
  }

  const businessId = Number(session.user.businessId) || 0;

  const actions = await prisma.activityLog.groupBy({
    by: ['action'],
    where: { businessId },
    _count: {
      action: true,
    },
  });

  return {
    actions: actions.map((action) => ({
      action: action.action,
      count: action._count.action,
    })),
  };
}

export async function getQuickInsights() {
  const session = await auth();

  if (!session?.user) {
    return { error: 'Unauthorized' };
  }

  const businessId = Number(session.user.businessId) || 0;

  const [mostSold, lowStock, salesStats, revenueTrend] = await Promise.all([
    prisma.product.findMany({
      where: { businessId, removedAt: null },
      include: {
        saleItems: {
          select: {
            quantity: true,
            subtotal: true,
          },
        },
      },
    }),
    prisma.product.findMany({
      where: {
        businessId,
        removedAt: null,
        stock: { lte: 10, gt: 0 },
      },
      orderBy: { stock: 'asc' },
      take: 5,
    }),
    prisma.sale.aggregate({
      where: { businessId },
      _avg: { total: true },
      _count: true,
    }),
    prisma.sale.findMany({
      where: {
        businessId,
        createdAt: {
          gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
        },
      },
      select: {
        createdAt: true,
        total: true,
      },
    }),
  ]);

  const bestSeller = mostSold
    .map((product) => ({
      id: product.id,
      name: product.name,
      sku: product.sku,
      totalSold: product.saleItems.reduce((sum, item) => sum + item.quantity, 0),
      totalRevenue: product.saleItems.reduce((sum, item) => sum + Number(item.subtotal), 0),
    }))
    .sort((a, b) => b.totalSold - a.totalSold)[0];

  const revenueByDate: Record<string, number> = {};

  for (let i = 0; i < 7; i++) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    const dateStr = date.toISOString().split('T')[0];
    revenueByDate[dateStr] = 0;
  }

  revenueTrend.forEach((sale) => {
    const dateStr = sale.createdAt.toISOString().split('T')[0];
    revenueByDate[dateStr] = (revenueByDate[dateStr] || 0) + Number(sale.total);
  });

  const revenueTrendArray = Object.entries(revenueByDate)
    .map(([date, revenue]) => ({ date, revenue }))
    .sort((a, b) => a.date.localeCompare(b.date));

  return {
    bestSeller,
    lowStockAlerts: lowStock,
    avgSaleValue: Number(salesStats._avg.total) || 0,
    revenueTrend: revenueTrendArray,
  };
}