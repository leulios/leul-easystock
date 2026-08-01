import { pgTable, uuid, text, varchar, timestamp, integer, numeric, boolean, pgEnum, serial } from 'drizzle-orm/pg-core';

export const shops = pgTable('shops', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: varchar('name', { length: 255 }).notNull(),
  code: varchar('code', { length: 50 }).notNull().unique(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const profiles = pgTable('profiles', {
  id: uuid('id').defaultRandom().primaryKey(), // maps to auth user id
  fullName: varchar('full_name', { length: 255 }),
  role: varchar('role', { length: 50 }).default('owner').notNull(),
  shopId: uuid('shop_id').references(() => shops.id),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  email: varchar('email', { length: 255 }).unique().notNull(),
  passwordHash: varchar('password_hash', { length: 255 }), // new for custom auth
});

export const products = pgTable('products', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: varchar('name', { length: 255 }).notNull(),
  sku: varchar('sku', { length: 100 }),
  category: varchar('category', { length: 100 }),
  description: text('description'),
  unitPrice: numeric('unit_price', { precision: 12, scale: 2 }).notNull(),
  lowStockThreshold: integer('low_stock_threshold').default(10).notNull(),
  quantity: integer('quantity').default(0).notNull(),
  shopId: uuid('shop_id').references(() => shops.id).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const productVariants = pgTable('product_variants', {
  id: uuid('id').defaultRandom().primaryKey(),
  productId: uuid('product_id').references(() => products.id, { onDelete: 'cascade' }).notNull(),
  name: varchar('name', { length: 255 }).notNull(),
  sku: varchar('sku', { length: 100 }),
  unitPrice: numeric('unit_price', { precision: 12, scale: 2 }),
  quantity: integer('quantity').default(0).notNull(),
  shopId: uuid('shop_id').references(() => shops.id).notNull(),
});

export const suppliers = pgTable('suppliers', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: varchar('name', { length: 255 }).notNull(),
  contact: varchar('contact', { length: 255 }),
  email: varchar('email', { length: 255 }),
  phone: varchar('phone', { length: 50 }),
  address: text('address'),
  shopId: uuid('shop_id').references(() => shops.id).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const customers = pgTable('customers', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: varchar('name', { length: 255 }).notNull(),
  phone: varchar('phone', { length: 50 }),
  shopId: uuid('shop_id').references(() => shops.id).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const purchaseOrders = pgTable('purchase_orders', {
  id: uuid('id').defaultRandom().primaryKey(),
  orderNumber: varchar('order_number', { length: 100 }).notNull(),
  supplierId: uuid('supplier_id').references(() => suppliers.id),
  productId: uuid('product_id').references(() => products.id),
  quantity: integer('quantity').notNull(),
  unitCost: numeric('unit_cost', { precision: 12, scale: 2 }).notNull(),
  totalCost: numeric('total_cost', { precision: 12, scale: 2 }).notNull(),
  status: varchar('status', { length: 50 }).default('pending').notNull(),
  expectedAt: timestamp('expected_at'),
  notes: text('notes'),
  shopId: uuid('shop_id').references(() => shops.id).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const salesOrders = pgTable('sales_orders', {
  id: uuid('id').defaultRandom().primaryKey(),
  orderNumber: varchar('order_number', { length: 100 }).notNull(),
  customerId: uuid('customer_id').references(() => customers.id),
  status: varchar('status', { length: 50 }).default('completed').notNull(),
  subtotal: numeric('subtotal', { precision: 12, scale: 2 }).notNull(),
  taxRate: numeric('tax_rate', { precision: 5, scale: 2 }).default('0').notNull(),
  taxAmount: numeric('tax_amount', { precision: 12, scale: 2 }).default('0').notNull(),
  total: numeric('total', { precision: 12, scale: 2 }).notNull(),
  notes: text('notes'),
  shopId: uuid('shop_id').references(() => shops.id).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const salesOrderItems = pgTable('sales_order_items', {
  id: uuid('id').defaultRandom().primaryKey(),
  orderId: uuid('order_id').references(() => salesOrders.id, { onDelete: 'cascade' }).notNull(),
  productId: uuid('product_id').references(() => products.id).notNull(),
  quantity: integer('quantity').notNull(),
  unitPrice: numeric('unit_price', { precision: 12, scale: 2 }).notNull(),
});

export const transactions = pgTable('transactions', {
  id: uuid('id').defaultRandom().primaryKey(),
  productId: uuid('product_id').references(() => products.id).notNull(),
  type: varchar('type', { length: 20 }).notNull(), // 'in' or 'out'
  quantity: integer('quantity').notNull(),
  notes: text('notes'),
  shopId: uuid('shop_id').references(() => shops.id).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const stockLots = pgTable('stock_lots', {
  id: uuid('id').defaultRandom().primaryKey(),
  productId: uuid('product_id').references(() => products.id).notNull(),
  expiryDate: timestamp('expiry_date'),
  quantity: integer('quantity').notNull(),
  shopId: uuid('shop_id').references(() => shops.id).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const appSettings = pgTable('app_settings', {
  key: varchar('key', { length: 100 }).primaryKey(),
  value: text('value').notNull(),
  shopId: uuid('shop_id').references(() => shops.id).notNull(),
});
