import { z } from 'zod';

export const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
});

export const registerSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  email: z.string().email('Invalid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required'),
  newPassword: z.string().min(6, 'New password must be at least 6 characters'),
});

export const forgotPasswordSchema = z.object({
  email: z.string().email('Invalid email address'),
});

export const resetPasswordSchema = z.object({
  password: z.string().min(6, 'Password must be at least 6 characters'),
});

export const productSchema = z.object({
  name: z.string().min(1, 'Product name is required'),
  sku: z.string().min(1, 'SKU is required'),
  price: z.number().positive('Price must be positive'),
  stock: z.number().int().min(0, 'Stock cannot be negative'),
  category: z.string().optional(),
  description: z.string().optional(),
  expiryDate: z.string().optional().nullable(),
});

export const updateProductSchema = productSchema.partial();

export const saleItemSchema = z.object({
  productId: z.number().int().positive(),
  quantity: z.number().int().positive('Quantity must be at least 1'),
});

export const createSaleSchema = z.object({
  items: z.array(saleItemSchema).min(1, 'At least one item is required'),
});

export const updateSaleSchema = z.object({
  items: z.array(saleItemSchema).min(1, 'At least one item is required'),
});

export const userSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  email: z.string().email('Invalid email address'),
  role: z.enum(['manager', 'cashier']),
  password: z.string().min(6, 'Password must be at least 6 characters'),
});

export const updateUserSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters').optional(),
  email: z.string().email('Invalid email address').optional(),
  role: z.enum(['manager', 'cashier']).optional(),
});

export const profileSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  email: z.string().email('Invalid email address'),
});

export const editRequestSchema = z.object({
  targetType: z.string(),
  targetId: z.number().int().positive(),
  actionType: z.string(),
  payload: z.record(z.string(), z.any()),
  message: z.string().optional(),
});

export const productChangeRequestSchema = z.object({
  targetType: z.literal('product'),
  targetId: z.number().int().positive(),
  actionType: z.enum(['UPDATE_PRODUCT', 'REMOVE_PRODUCT', 'DELETE_PRODUCT']),
  changes: z.record(z.string(), z.any()),
  reason: z.string().min(1, 'Reason is required'),
}).refine(
  (data) => Object.keys(data.changes).length > 0,
  { message: 'At least one change must be specified' }
);

export const rejectRequestSchema = z.object({
  reason: z.string().min(1, 'Rejection reason is required'),
});

export const activityFilterSchema = z.object({
  action: z.string().optional(),
  userId: z.number().int().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  search: z.string().optional(),
  page: z.number().int().positive().optional(),
  limit: z.number().int().positive().optional(),
});

export type LoginInput = z.infer<typeof loginSchema>;
export type RegisterInput = z.infer<typeof registerSchema>;
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;
export type ProductInput = z.infer<typeof productSchema>;
export type UpdateProductInput = z.infer<typeof updateProductSchema>;
export type CreateSaleInput = z.infer<typeof createSaleSchema>;
export type UpdateSaleInput = z.infer<typeof updateSaleSchema>;
export type UserInput = z.infer<typeof userSchema>;
export type UpdateUserInput = z.infer<typeof updateUserSchema>;
export type ProfileInput = z.infer<typeof profileSchema>;
export type EditRequestInput = z.infer<typeof editRequestSchema>;
export type ProductChangeRequestInput = z.infer<typeof productChangeRequestSchema>;
export type RejectRequestInput = z.infer<typeof rejectRequestSchema>;