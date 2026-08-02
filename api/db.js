import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import { pgTable, uuid, varchar, text, timestamp, integer, numeric } from 'drizzle-orm/pg-core';
import { eq, and, desc, asc } from 'drizzle-orm';
import jwt from 'jsonwebtoken';
import { parse as parseCookie } from 'cookie';

// ─── Inline schema ─────────────────────────────────────────────────────────────
const shops    = pgTable('shops',    { id: uuid('id').primaryKey(), name: varchar('name',{length:255}), code: varchar('code',{length:50}), createdAt: timestamp('created_at') });
const profiles = pgTable('profiles', { id: uuid('id').primaryKey(), fullName: varchar('full_name',{length:255}), role: varchar('role',{length:50}), shopId: uuid('shop_id'), email: varchar('email',{length:255}), passwordHash: varchar('password_hash',{length:255}), createdAt: timestamp('created_at') });
const products = pgTable('products', { id: uuid('id').primaryKey(), name: varchar('name',{length:255}), sku: varchar('sku',{length:100}), category: varchar('category',{length:100}), description: text('description'), unitPrice: numeric('unit_price',{precision:12,scale:2}), lowStockThreshold: integer('low_stock_threshold'), quantity: integer('quantity'), shopId: uuid('shop_id'), createdAt: timestamp('created_at') });
const productVariants = pgTable('product_variants', { id: uuid('id').primaryKey(), productId: uuid('product_id'), name: varchar('name',{length:255}), sku: varchar('sku',{length:100}), unitPrice: numeric('unit_price',{precision:12,scale:2}), quantity: integer('quantity'), shopId: uuid('shop_id') });
const suppliers = pgTable('suppliers', { id: uuid('id').primaryKey(), name: varchar('name',{length:255}), contact: varchar('contact',{length:255}), email: varchar('email',{length:255}), phone: varchar('phone',{length:50}), address: text('address'), shopId: uuid('shop_id'), createdAt: timestamp('created_at') });
const customers = pgTable('customers', { id: uuid('id').primaryKey(), name: varchar('name',{length:255}), phone: varchar('phone',{length:50}), shopId: uuid('shop_id'), createdAt: timestamp('created_at') });
const purchaseOrders = pgTable('purchase_orders', { id: uuid('id').primaryKey(), orderNumber: varchar('order_number',{length:100}), supplierId: uuid('supplier_id'), productId: uuid('product_id'), quantity: integer('quantity'), unitCost: numeric('unit_cost',{precision:12,scale:2}), totalCost: numeric('total_cost',{precision:12,scale:2}), status: varchar('status',{length:50}), expectedAt: timestamp('expected_at'), notes: text('notes'), shopId: uuid('shop_id'), createdAt: timestamp('created_at') });
const salesOrders = pgTable('sales_orders', { id: uuid('id').primaryKey(), orderNumber: varchar('order_number',{length:100}), customerId: uuid('customer_id'), status: varchar('status',{length:50}), subtotal: numeric('subtotal',{precision:12,scale:2}), taxRate: numeric('tax_rate',{precision:5,scale:2}), taxAmount: numeric('tax_amount',{precision:12,scale:2}), total: numeric('total',{precision:12,scale:2}), notes: text('notes'), shopId: uuid('shop_id'), createdAt: timestamp('created_at') });
const salesOrderItems = pgTable('sales_order_items', { id: uuid('id').primaryKey(), orderId: uuid('order_id'), productId: uuid('product_id'), quantity: integer('quantity'), unitPrice: numeric('unit_price',{precision:12,scale:2}) });
const transactions = pgTable('transactions', { id: uuid('id').primaryKey(), productId: uuid('product_id'), type: varchar('type',{length:20}), quantity: integer('quantity'), notes: text('notes'), shopId: uuid('shop_id'), createdAt: timestamp('created_at') });
const stockLots = pgTable('stock_lots', { id: uuid('id').primaryKey(), productId: uuid('product_id'), expiryDate: timestamp('expiry_date'), quantity: integer('quantity'), shopId: uuid('shop_id'), createdAt: timestamp('created_at') });
const appSettings = pgTable('app_settings', { key: varchar('key',{length:100}).primaryKey(), value: text('value'), shopId: uuid('shop_id') });

const TABLE_MAP = { shops, profiles, products, product_variants: productVariants, suppliers, customers, purchase_orders: purchaseOrders, sales_orders: salesOrders, sales_order_items: salesOrderItems, transactions, stock_lots: stockLots, app_settings: appSettings };

// ─── DB connection ─────────────────────────────────────────────────────────────
function getDb() {
  return drizzle(neon(process.env.DATABASE_URL));
}

const JWT_SECRET = process.env.JWT_SECRET || 'super-secret-key-for-dev';

function requireAuth(req, res) {
  const cookies = parseCookie(req.headers.cookie || '');
  const token = cookies.auth_token;
  if (!token) { res.status(401).json({ error: 'Unauthorized' }); return null; }
  try { return jwt.verify(token, JWT_SECRET); }
  catch { res.status(401).json({ error: 'Invalid token' }); return null; }
}

// ─── Handler ───────────────────────────────────────────────────────────────────
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', req.headers.origin || '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const user = requireAuth(req, res);
  if (!user) return;

  const { table } = req.query;
  const dbTable = TABLE_MAP[table];
  if (!dbTable) return res.status(400).json({ error: `Unknown table: ${table}` });

  const db = getDb();

  try {
    if (req.method === 'GET') {
      let query = db.select().from(dbTable);
      // Enforce shop isolation
      if (dbTable.shopId) query = query.where(eq(dbTable.shopId, user.shopId));
      // Order
      if (req.query.order) {
        const col = dbTable[req.query.order] || dbTable.createdAt;
        query = query.orderBy(req.query.ascending === 'false' ? desc(col) : asc(col));
      }
      const data = await query;
      return res.status(200).json({ data });
    }

    if (req.method === 'POST') {
      const payload = { ...req.body };
      if (dbTable.shopId) payload.shopId = user.shopId;
      const [data] = await db.insert(dbTable).values(payload).returning();
      return res.status(200).json({ data });
    }

    if (req.method === 'PUT') {
      const { id, ...payload } = req.body;
      const conditions = [eq(dbTable.id, id)];
      if (dbTable.shopId) conditions.push(eq(dbTable.shopId, user.shopId));
      const [data] = await db.update(dbTable).set(payload).where(and(...conditions)).returning();
      return res.status(200).json({ data });
    }

    if (req.method === 'DELETE') {
      const { id } = req.query;
      const conditions = [eq(dbTable.id, id)];
      if (dbTable.shopId) conditions.push(eq(dbTable.shopId, user.shopId));
      await db.delete(dbTable).where(and(...conditions));
      return res.status(200).json({ data: null });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    console.error('[API/db error]', error);
    return res.status(500).json({ error: error.message });
  }
}
