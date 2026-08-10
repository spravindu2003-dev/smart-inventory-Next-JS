'use server';

import { getAuthSession } from '@/lib/server-auth';
import { prisma } from '@/lib/prisma';
import { serialize } from '@/lib/serialize';

export interface ReportFilters {
  startDate?: string;
  endDate?: string;
  category?: string;
  userId?: number;
  role?: string;
  activityType?: string;
  requestStatus?: string;
}

function getDateRange(filters: ReportFilters): { gte?: Date; lte?: Date } {
  const range: { gte?: Date; lte?: Date } = {};
  if (filters.startDate) {
    const d = new Date(filters.startDate);
    d.setHours(0, 0, 0, 0);
    range.gte = d;
  }
  if (filters.endDate) {
    const d = new Date(filters.endDate);
    d.setHours(23, 59, 59, 999);
    range.lte = d;
  }
  return range;
}

export async function getReportKPIs(token: string, filters: ReportFilters) {
  const session = await getAuthSession(token);
  const businessId = Number(session.businessId) || 0;
  const dateRange = getDateRange(filters);

  const saleWhere: Record<string, unknown> = { businessId };
  if (Object.keys(dateRange).length > 0) saleWhere.createdAt = dateRange;

  const productWhere: Record<string, unknown> = { businessId, removedAt: null };

  const [
    salesAgg,
    totalProducts,
    totalStock,
    lowStock,
    outOfStock,
    pendingRequests,
    inventoryValue,
  ] = await Promise.all([
    prisma.sale.aggregate({
      where: saleWhere,
      _sum: { total: true },
      _count: true,
    }),
    prisma.product.count({ where: productWhere }),
    prisma.product.aggregate({ where: productWhere, _sum: { stock: true } }),
    prisma.product.count({
      where: { ...productWhere, stock: { gt: 0, lte: 10 } },
    }),
    prisma.product.count({
      where: { ...productWhere, stock: 0 },
    }),
    prisma.editRequest.count({
      where: {
        businessId,
        status: 'PENDING',
        ...(filters.role === 'cashier' ? { requestedById: Number(session.id) } : {}),
      },
    }),
    prisma.product.findMany({
      where: productWhere,
      select: { price: true, stock: true },
    }),
  ]);

  const totalRevenue = Number(salesAgg._sum.total) || 0;
  const totalSales = salesAgg._count;
  const totalStockUnits = totalStock._sum.stock || 0;
  const inventoryValueTotal = inventoryValue.reduce(
    (sum, p) => sum + Number(p.price) * p.stock,
    0
  );

  return serialize({
    totalRevenue,
    totalSales,
    totalProducts,
    totalStockUnits,
    lowStock,
    outOfStock,
    pendingRequests,
    inventoryValue: inventoryValueTotal,
  });
}

export async function getRevenueSalesTrend(token: string, filters: ReportFilters) {
  const session = await getAuthSession(token);
  const businessId = Number(session.businessId) || 0;

  const startDate = filters.startDate ? new Date(filters.startDate) : new Date(Date.now() - 30 * 86400000);
  startDate.setHours(0, 0, 0, 0);
  const endDate = filters.endDate ? new Date(filters.endDate) : new Date();
  endDate.setHours(23, 59, 59, 999);

  const sales = await prisma.sale.findMany({
    where: {
      businessId,
      createdAt: { gte: startDate, lte: endDate },
    },
    select: { createdAt: true, total: true },
    orderBy: { createdAt: 'asc' },
  });

  const daysDiff = Math.ceil((endDate.getTime() - startDate.getTime()) / 86400000);
  const groupBy = daysDiff > 90 ? 'month' : daysDiff > 14 ? 'week' : 'day';

  const grouped: Record<string, { revenue: number; count: number }> = {};

  const current = new Date(startDate);
  while (current <= endDate) {
    let key: string;
    if (groupBy === 'month') {
      key = `${current.getFullYear()}-${String(current.getMonth() + 1).padStart(2, '0')}`;
    } else if (groupBy === 'week') {
      const weekStart = new Date(current);
      weekStart.setDate(current.getDate() - current.getDay());
      key = weekStart.toISOString().split('T')[0];
    } else {
      key = current.toISOString().split('T')[0];
    }
    if (!grouped[key]) grouped[key] = { revenue: 0, count: 0 };
    current.setDate(current.getDate() + 1);
  }

  sales.forEach((sale) => {
    let key: string;
    if (groupBy === 'month') {
      const d = sale.createdAt;
      key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    } else if (groupBy === 'week') {
      const d = new Date(sale.createdAt);
      d.setDate(d.getDate() - d.getDay());
      key = d.toISOString().split('T')[0];
    } else {
      key = sale.createdAt.toISOString().split('T')[0];
    }
    if (!grouped[key]) grouped[key] = { revenue: 0, count: 0 };
    grouped[key].revenue += Number(sale.total);
    grouped[key].count += 1;
  });

  return serialize({
    trend: Object.entries(grouped)
      .map(([date, data]) => ({ date, ...data }))
      .sort((a, b) => a.date.localeCompare(b.date)),
    groupBy,
  });
}

export async function getProductCategoryDistribution(token: string, filters: ReportFilters) {
  const session = await getAuthSession(token);
  const businessId = Number(session.businessId) || 0;

  const where: Record<string, unknown> = { businessId, removedAt: null };
  if (filters.category && filters.category !== 'all') {
    where.category = filters.category;
  }

  const [byCategory, stockByCategory] = await Promise.all([
    prisma.product.groupBy({
      by: ['category'],
      where,
      _count: { category: true },
    }),
    prisma.product.groupBy({
      by: ['category'],
      where: { ...where, category: { not: null } },
      _sum: { stock: true },
      _count: { category: true },
    }),
  ]);

  return serialize({
    productsByCategory: byCategory.map((c) => ({
      category: c.category || 'Uncategorized',
      count: c._count.category,
    })),
    stockByCategory: stockByCategory.map((c) => ({
      category: c.category || 'Uncategorized',
      stock: c._sum.stock || 0,
      count: c._count.category,
    })),
  });
}

export async function getInventoryStatus(token: string) {
  const session = await getAuthSession(token);
  const businessId = Number(session.businessId) || 0;

  const [inStock, lowStock, outOfStock, expired] = await Promise.all([
    prisma.product.count({ where: { businessId, removedAt: null, stock: { gt: 10 } } }),
    prisma.product.count({ where: { businessId, removedAt: null, stock: { gt: 0, lte: 10 } } }),
    prisma.product.count({ where: { businessId, removedAt: null, stock: 0 } }),
    prisma.product.count({
      where: { businessId, removedAt: null, expiryDate: { lt: new Date() } },
    }),
  ]);

  return serialize({ inStock, lowStock, outOfStock, expired });
}

export async function getActivityAnalytics(token: string, filters: ReportFilters) {
  const session = await getAuthSession(token);
  const businessId = Number(session.businessId) || 0;

  if (session.role !== 'owner' && session.role !== 'manager') {
    return { error: 'Unauthorized' };
  }

  const where: Record<string, unknown> = { businessId };
  const dateRange = getDateRange(filters);
  if (Object.keys(dateRange).length > 0) where.createdAt = dateRange;
  if (filters.activityType && filters.activityType !== 'all') {
    where.action = filters.activityType;
  }
  if (filters.userId) where.userId = filters.userId;

  const [activities, byType, byUser] = await Promise.all([
    prisma.activityLog.findMany({
      where,
      select: { createdAt: true, action: true },
      orderBy: { createdAt: 'asc' },
    }),
    prisma.activityLog.groupBy({
      by: ['action'],
      where,
      _count: { action: true },
      orderBy: { _count: { action: 'desc' } },
    }),
    prisma.activityLog.groupBy({
      by: ['userId'],
      where,
      _count: { userId: true },
      orderBy: { _count: { userId: 'desc' } },
      take: 10,
    }),
  ]);

  const startDate = filters.startDate ? new Date(filters.startDate) : new Date(Date.now() - 30 * 86400000);
  const endDate = filters.endDate ? new Date(filters.endDate) : new Date();
  const daysDiff = Math.ceil((endDate.getTime() - startDate.getTime()) / 86400000);
  const groupBy = daysDiff > 60 ? 'month' : 'day';

  const timeline: Record<string, number> = {};
  const current = new Date(startDate);
  while (current <= endDate) {
    const key = groupBy === 'month'
      ? `${current.getFullYear()}-${String(current.getMonth() + 1).padStart(2, '0')}`
      : current.toISOString().split('T')[0];
    if (!timeline[key]) timeline[key] = 0;
    current.setDate(current.getDate() + 1);
  }

  activities.forEach((a) => {
    const d = a.createdAt;
    const key = groupBy === 'month'
      ? `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
      : d.toISOString().split('T')[0];
    timeline[key] = (timeline[key] || 0) + 1;
  });

  const userIds = byUser.map((u) => u.userId);
  const users = userIds.length > 0
    ? await prisma.user.findMany({
        where: { id: { in: userIds } },
        select: { id: true, name: true, role: true },
      })
    : [];

  const userMap = new Map(users.map((u) => [u.id, u]));

  return serialize({
    timeline: Object.entries(timeline)
      .map(([date, count]) => ({ date, count }))
      .sort((a, b) => a.date.localeCompare(b.date)),
    byType: byType.map((t) => ({ action: t.action, count: t._count.action })),
    byUser: byUser.map((u) => ({
      user: userMap.get(u.userId) || { id: u.userId, name: 'Unknown', role: 'unknown' },
      count: u._count.userId,
    })),
    groupBy,
  });
}

export async function getTopProductsReport(token: string, filters: ReportFilters) {
  const session = await getAuthSession(token);
  const businessId = Number(session.businessId) || 0;

  const products = await prisma.product.findMany({
    where: { businessId, removedAt: null },
    select: {
      id: true,
      name: true,
      sku: true,
      category: true,
      price: true,
      stock: true,
      saleItems: {
        select: { quantity: true, subtotal: true, sale: { select: { createdAt: true } } },
      },
    },
  });

  const dateRange = getDateRange(filters);

  const productsWithSales = products.map((product) => {
    const filteredItems = product.saleItems.filter((item) => {
      if (!Object.keys(dateRange).length) return true;
      const saleDate = item.sale.createdAt;
      if (dateRange.gte && saleDate < dateRange.gte) return false;
      if (dateRange.lte && saleDate > dateRange.lte) return false;
      return true;
    });

    return {
      id: product.id,
      name: product.name,
      sku: product.sku,
      category: product.category || 'Uncategorized',
      price: Number(product.price),
      stock: product.stock,
      totalSold: filteredItems.reduce((sum, item) => sum + item.quantity, 0),
      totalRevenue: filteredItems.reduce((sum, item) => sum + Number(item.subtotal), 0),
    };
  });

  productsWithSales.sort((a, b) => b.totalSold - a.totalSold);

  return serialize({ products: productsWithSales.slice(0, 20) });
}

export async function getLowStockReport(token: string) {
  const session = await getAuthSession(token);
  const businessId = Number(session.businessId) || 0;

  const [lowStock, outOfStock] = await Promise.all([
    prisma.product.findMany({
      where: { businessId, removedAt: null, stock: { gt: 0, lte: 10 } },
      select: { id: true, name: true, sku: true, category: true, stock: true, price: true },
      orderBy: { stock: 'asc' },
    }),
    prisma.product.findMany({
      where: { businessId, removedAt: null, stock: 0 },
      select: { id: true, name: true, sku: true, category: true, stock: true, price: true },
      orderBy: { name: 'asc' },
    }),
  ]);

  return serialize({ lowStock, outOfStock });
}

export async function getSalesByCategoryReport(token: string, filters: ReportFilters) {
  const session = await getAuthSession(token);
  const businessId = Number(session.businessId) || 0;

  const saleWhere: Record<string, unknown> = { businessId };
  const dateRange = getDateRange(filters);
  if (Object.keys(dateRange).length > 0) saleWhere.createdAt = dateRange;

  const sales = await prisma.sale.findMany({
    where: saleWhere,
    select: {
      items: {
        select: {
          quantity: true,
          subtotal: true,
          product: { select: { category: true } },
        },
      },
    },
  });

  const categoryMap: Record<string, { quantity: number; revenue: number }> = {};

  sales.forEach((sale) => {
    sale.items.forEach((item) => {
      const cat = item.product.category || 'Uncategorized';
      if (!categoryMap[cat]) categoryMap[cat] = { quantity: 0, revenue: 0 };
      categoryMap[cat].quantity += item.quantity;
      categoryMap[cat].revenue += Number(item.subtotal);
    });
  });

  const result = Object.entries(categoryMap)
    .map(([category, data]) => ({ category, ...data }))
    .sort((a, b) => b.revenue - a.revenue);

  return serialize({ categories: result });
}

export async function getSalesByUserReport(token: string, filters: ReportFilters) {
  const session = await getAuthSession(token);
  const businessId = Number(session.businessId) || 0;

  if (session.role !== 'owner' && session.role !== 'manager') {
    const mySales = await prisma.sale.findMany({
      where: {
        businessId,
        userId: Number(session.id),
        ...(Object.keys(getDateRange(filters)).length > 0 ? { createdAt: getDateRange(filters) } : {}),
      },
      include: { items: true },
    });
    const totalRevenue = mySales.reduce((sum, s) => sum + Number(s.total), 0);
    const totalItems = mySales.reduce((sum, s) => sum + s.items.reduce((is, i) => is + i.quantity, 0), 0);
    return serialize({
      users: [{
        user: { id: session.id, name: session.name || 'You', role: session.role },
        saleCount: mySales.length,
        totalItems,
        totalRevenue,
      }],
    });
  }

  const sales = await prisma.sale.findMany({
    where: {
      businessId,
      ...(Object.keys(getDateRange(filters)).length > 0 ? { createdAt: getDateRange(filters) } : {}),
    },
    select: {
      userId: true,
      total: true,
      items: { select: { quantity: true } },
    },
  });

  const userMap: Record<number, { saleCount: number; totalItems: number; totalRevenue: number }> = {};

  sales.forEach((sale) => {
    if (!userMap[sale.userId]) userMap[sale.userId] = { saleCount: 0, totalItems: 0, totalRevenue: 0 };
    userMap[sale.userId].saleCount += 1;
    userMap[sale.userId].totalItems += sale.items.reduce((sum, i) => sum + i.quantity, 0);
    userMap[sale.userId].totalRevenue += Number(sale.total);
  });

  const userIds = Object.keys(userMap).map(Number);
  const users = userIds.length > 0
    ? await prisma.user.findMany({
        where: { id: { in: userIds } },
        select: { id: true, name: true, role: true },
      })
    : [];

  const userLookup = new Map(users.map((u) => [u.id, u]));

  const result = userIds.map((id) => ({
    user: userLookup.get(id) || { id, name: 'Unknown', role: 'unknown' },
    ...userMap[id],
  })).sort((a, b) => b.totalRevenue - a.totalRevenue);

  return serialize({ users: result });
}

export async function getRequestAnalytics(token: string, filters: ReportFilters) {
  const session = await getAuthSession(token);
  const businessId = Number(session.businessId) || 0;

  const where: Record<string, unknown> = { businessId };
  const dateRange = getDateRange(filters);
  if (Object.keys(dateRange).length > 0) where.createdAt = dateRange;
  if (session.role === 'cashier') where.requestedById = Number(session.id);
  if (filters.requestStatus && filters.requestStatus !== 'all') {
    where.status = filters.requestStatus;
  }

  const [byStatus, byType, total] = await Promise.all([
    prisma.editRequest.groupBy({
      by: ['status'],
      where,
      _count: { status: true },
    }),
    prisma.editRequest.groupBy({
      by: ['actionType'],
      where,
      _count: { actionType: true },
    }),
    prisma.editRequest.count({ where }),
  ]);

  const timelineWhere: Record<string, unknown> = { businessId };
  if (Object.keys(dateRange).length > 0) timelineWhere.createdAt = dateRange;
  if (session.role === 'cashier') timelineWhere.requestedById = Number(session.id);

  const requests = await prisma.editRequest.findMany({
    where: timelineWhere,
    select: { createdAt: true, status: true },
    orderBy: { createdAt: 'asc' },
  });

  const startDate = filters.startDate ? new Date(filters.startDate) : new Date(Date.now() - 30 * 86400000);
  const endDate = filters.endDate ? new Date(filters.endDate) : new Date();
  const daysDiff = Math.ceil((endDate.getTime() - startDate.getTime()) / 86400000);
  const groupBy = daysDiff > 60 ? 'month' : 'day';

  const timeline: Record<string, { created: number; approved: number; rejected: number }> = {};
  const current = new Date(startDate);
  while (current <= endDate) {
    const key = groupBy === 'month'
      ? `${current.getFullYear()}-${String(current.getMonth() + 1).padStart(2, '0')}`
      : current.toISOString().split('T')[0];
    if (!timeline[key]) timeline[key] = { created: 0, approved: 0, rejected: 0 };
    current.setDate(current.getDate() + 1);
  }

  requests.forEach((r) => {
    const d = r.createdAt;
    const key = groupBy === 'month'
      ? `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
      : d.toISOString().split('T')[0];
    if (!timeline[key]) timeline[key] = { created: 0, approved: 0, rejected: 0 };
    timeline[key].created += 1;
    if (r.status === 'APPROVED') timeline[key].approved += 1;
    if (r.status === 'REJECTED') timeline[key].rejected += 1;
  });

  return serialize({
    total,
    byStatus: byStatus.map((s) => ({ status: s.status, count: s._count.status })),
    byType: byType.map((t) => ({ type: t.actionType, count: t._count.actionType })),
    timeline: Object.entries(timeline)
      .map(([date, data]) => ({ date, ...data }))
      .sort((a, b) => a.date.localeCompare(b.date)),
    groupBy,
  });
}

export async function getBusinessInfo(token: string) {
  const session = await getAuthSession(token);
  const businessId = Number(session.businessId) || 0;

  const business = await prisma.business.findUnique({
    where: { id: businessId },
    select: { name: true, currency: true },
  });

  return serialize({ name: business?.name || 'Smart Inventory', currency: business?.currency || 'LKR' });
}

export async function getCategoriesList(token: string) {
  const session = await getAuthSession(token);
  const businessId = Number(session.businessId) || 0;

  const categories = await prisma.product.groupBy({
    by: ['category'],
    where: { businessId, removedAt: null, category: { not: null } },
    _count: { category: true },
  });

  return {
    categories: categories.map((c) => ({
      value: c.category || '',
      label: c.category || 'Uncategorized',
      count: c._count.category,
    })),
  };
}

export async function getUsersList(token: string) {
  const session = await getAuthSession(token);
  const businessId = Number(session.businessId) || 0;

  const users = await prisma.user.findMany({
    where: { businessId, isDeleted: false },
    select: { id: true, name: true, role: true },
    orderBy: { name: 'asc' },
  });

  return { users };
}
