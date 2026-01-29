import { z } from 'zod';

export const loginSchema = z.object({
  username: z.string().min(1, 'Username is required'),
  password: z.string().min(1, 'Password is required'),
});

export const createUserSchema = z.object({
  username: z.string().min(3),
  password: z.string().min(6),
  name: z.string().min(1),
  role: z.enum(['MASTER', 'ADMIN', 'CASHIER']).default('CASHIER'),
  shopId: z.string().optional(),
  managedShopIds: z.array(z.string()).optional(),
});

export const createProductSchema = z.object({
  name: z.string().min(1),
  sku: z.string().min(1).default(() => `SKU-${Date.now()}`),
  barcode: z.string().optional().nullable(),
  sellingPrice: z.coerce.number().positive(),
  costPrice: z.coerce.number().nonnegative().default(0),
  taxRate: z.coerce.number().nonnegative().default(15.0),
  stockQuantity: z.coerce.number().int().nonnegative().default(0),
  lowStockLevel: z.coerce.number().int().nonnegative().default(5),
  category: z.string().optional(),
});

export const createShopSchema = z.object({
  shopName: z.string().min(1),
  adminUsername: z.string().min(3),
  adminPassword: z.string().min(6),
});
