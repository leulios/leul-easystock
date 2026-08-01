import { db } from '../src/db/index.js';
import * as schema from '../src/db/schema.js';
import { requireAuth } from './_auth.js';
import { eq, and, desc, asc, gte } from 'drizzle-orm';

export default async function handler(req, res) {
  const user = requireAuth(req, res);
  if (!user) return; // response already sent

  const { table, action } = req.query;
  const dbTable = schema[table]; // e.g. schema.products

  if (!dbTable) return res.status(400).json({ error: 'Invalid table' });

  try {
    if (req.method === 'GET') {
      let query = db.select().from(dbTable);
      
      // Enforce RLS if table has shopId
      if (dbTable.shopId) {
        query = query.where(eq(dbTable.shopId, user.shopId));
      }

      // Hacky way to support relations specifically for this app
      if (req.query.join === 'true') {
        if (table === 'transactions') {
          query = db.select({
             id: schema.transactions.id,
             productId: schema.transactions.productId,
             type: schema.transactions.type,
             quantity: schema.transactions.quantity,
             notes: schema.transactions.notes,
             createdAt: schema.transactions.createdAt,
             products: { name: schema.products.name },
             profiles: { full_name: schema.profiles.fullName }
          })
          .from(schema.transactions)
          .leftJoin(schema.products, eq(schema.transactions.productId, schema.products.id))
          .leftJoin(schema.profiles, eq(schema.transactions.shopId, schema.profiles.shopId)); // approximation
        } else if (table === 'sales_orders') {
          query = db.select({
             id: schema.salesOrders.id,
             orderNumber: schema.salesOrders.orderNumber,
             status: schema.salesOrders.status,
             subtotal: schema.salesOrders.subtotal,
             total: schema.salesOrders.total,
             createdAt: schema.salesOrders.createdAt,
             customers: { name: schema.customers.name }
          })
          .from(schema.salesOrders)
          .leftJoin(schema.customers, eq(schema.salesOrders.customerId, schema.customers.id));
        } else if (table === 'purchase_orders') {
          query = db.select({
             id: schema.purchaseOrders.id,
             orderNumber: schema.purchaseOrders.orderNumber,
             status: schema.purchaseOrders.status,
             totalCost: schema.purchaseOrders.totalCost,
             createdAt: schema.purchaseOrders.createdAt,
             suppliers: { name: schema.suppliers.name },
             products: { name: schema.products.name, quantity: schema.purchaseOrders.quantity }
          })
          .from(schema.purchaseOrders)
          .leftJoin(schema.suppliers, eq(schema.purchaseOrders.supplierId, schema.suppliers.id))
          .leftJoin(schema.products, eq(schema.purchaseOrders.productId, schema.products.id));
        }
      }

      // Add simple sorts
      if (req.query.order) {
         query = query.orderBy(req.query.ascending === 'false' ? desc(dbTable[req.query.order]) : asc(dbTable[req.query.order]));
      }

      const data = await query;
      return res.status(200).json({ data });
    }

    if (req.method === 'POST') {
      const payload = { ...req.body };
      if (dbTable.shopId) payload.shopId = user.shopId; // Enforce RLS

      const [data] = await db.insert(dbTable).values(payload).returning();
      return res.status(200).json({ data });
    }

    if (req.method === 'PUT') {
      const { id, ...payload } = req.body;
      const [data] = await db.update(dbTable).set(payload).where(and(eq(dbTable.id, id), dbTable.shopId ? eq(dbTable.shopId, user.shopId) : undefined)).returning();
      return res.status(200).json({ data });
    }

    if (req.method === 'DELETE') {
      const { id } = req.query;
      await db.delete(dbTable).where(and(eq(dbTable.id, id), dbTable.shopId ? eq(dbTable.shopId, user.shopId) : undefined));
      return res.status(200).json({ data: null });
    }

  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: error.message });
  }
}
