import { Role, RemovalReason, Prisma } from '@prisma/client';

export type { Role, RemovalReason };

export interface SessionUser {
  id: number;
  name: string;
  email: string;
  role: Role;
  businessId: number | null;
}

export interface UserWithBusiness {
  id: number;
  name: string;
  email: string;
  role: Role;
  isActive: boolean;
  isDeleted: boolean;
  businessId: number | null;
  createdById: number | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface ProductWithRelations {
  id: number;
  name: string;
  description: string | null;
  price: Prisma.Decimal;
  stock: number;
  sku: string;
  category: string | null;
  expiryDate: Date | null;
  removalReason: RemovalReason | null;
  removedAt: Date | null;
  businessId: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface SaleWithItems {
  id: number;
  total: Prisma.Decimal;
  userId: number;
  businessId: number;
  createdAt: Date;
  updatedAt: Date;
  user: {
    id: number;
    name: string;
    email: string;
  };
  items: SaleItemWithProduct[];
}

export interface SaleItemWithProduct {
  id: number;
  saleId: number;
  productId: number;
  quantity: number;
  unitPrice: Prisma.Decimal;
  subtotal: Prisma.Decimal;
  userId: number;
  product: {
    id: number;
    name: string;
    sku: string;
    price: Prisma.Decimal;
    stock: number;
  };
}

export interface ActivityLogWithUser {
  id: number;
  action: string;
  entity: string | null;
  entityId: number | null;
  description: string | null;
  userId: number;
  businessId: number;
  createdAt: Date;
  user: {
    id: number;
    name: string;
    email: string;
  };
}

export interface EditRequestWithRelations {
  id: number;
  businessId: number;
  requestedById: number;
  targetType: string;
  targetId: number;
  actionType: string;
  payload: Prisma.JsonValue;
  status: string;
  message: string | null;
  reviewedById: number | null;
  createdAt: Date;
  updatedAt: Date;
  requestedBy: {
    id: number;
    name: string;
    email: string;
  };
  reviewedBy: {
    id: number;
    name: string;
    email: string;
  } | null;
}

export interface DashboardSummary {
  totalProducts: number;
  totalStock: number;
  lowStockCount: number;
  totalRevenue: number;
  totalSales: number;
  recentSales: SaleWithItems[];
  topProducts: ProductWithRelations[];
}

export interface SalesTrend {
  date: string;
  count: number;
}

export interface RevenueTrend {
  date: string;
  revenue: number;
}

export interface TopProduct {
  id: number;
  name: string;
  sku: string;
  totalSold: number;
  totalRevenue: number;
}

export interface StockDistribution {
  inStock: number;
  lowStock: number;
  outOfStock: number;
  expired: number;
}

export interface CategoryDistribution {
  category: string;
  count: number;
}

export interface ActivityDistribution {
  action: string;
  count: number;
}

export interface QuickInsights {
  bestSeller: TopProduct | null;
  lowStockAlerts: ProductWithRelations[];
  avgSaleValue: number;
  revenueTrend: RevenueTrend[];
}