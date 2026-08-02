import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import { pgTable, uuid, varchar, timestamp } from 'drizzle-orm/pg-core';
import { eq } from 'drizzle-orm';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

function parseCookie(str) {
  if (!str) return {};
  return str.split(';').reduce((res, c) => {
    const parts = c.split('=');
    const key = parts[0].trim();
    if (!key) return res;
    const val = parts.slice(1).join('=').trim();
    res[key] = decodeURIComponent(val);
    return res;
  }, {});
}

function serializeCookie(name, val, options = {}) {
  let str = `${name}=${encodeURIComponent(val)}`;
  if (options.maxAge) str += `; Max-Age=${options.maxAge}`;
  if (options.path) str += `; Path=${options.path}`;
  if (options.httpOnly) str += `; HttpOnly`;
  if (options.sameSite) str += `; SameSite=${options.sameSite}`;
  if (options.secure) str += `; Secure`;
  if (options.expires) str += `; Expires=${options.expires.toUTCString()}`;
  return str;
}

// ─── Inline schema ─────────────────────────────────────────────────────────────
const shops = pgTable('shops', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: varchar('name', { length: 255 }).notNull(),
  code: varchar('code', { length: 50 }).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

const profiles = pgTable('profiles', {
  id: uuid('id').defaultRandom().primaryKey(),
  fullName: varchar('full_name', { length: 255 }),
  role: varchar('role', { length: 50 }).default('owner').notNull(),
  shopId: uuid('shop_id'),
  email: varchar('email', { length: 255 }).notNull(),
  passwordHash: varchar('password_hash', { length: 255 }),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

function getDb() {
  const sql = neon(process.env.DATABASE_URL);
  return drizzle(sql);
}

const JWT_SECRET = process.env.JWT_SECRET || 'super-secret-key-for-dev';

function setCookieHeader(res, token) {
  res.setHeader('Set-Cookie', serializeCookie('auth_token', token, {
    httpOnly: true,
    path: '/',
    maxAge: 604800,
    sameSite: 'Lax',
    secure: process.env.NODE_ENV === 'production',
  }));
}

export default async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', req.headers.origin || '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { action } = req.query;

  try {
    const db = getDb();

    // ── SIGNUP ─────────────────────────────────────────────────────────────────
    if (req.method === 'POST' && action === 'signup') {
      const { email, password, fullName, shopName } = req.body;

      if (!email || !password || !fullName) {
        return res.status(400).json({ error: 'Missing required fields' });
      }

      const existing = await db.select({ id: profiles.id })
        .from(profiles)
        .where(eq(profiles.email, email.toLowerCase().trim()));

      if (existing.length > 0) {
        return res.status(400).json({ error: 'An account with this email already exists' });
      }

      const code = (shopName || 'shop').toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 8)
        + Math.floor(1000 + Math.random() * 9000);

      const [newShop] = await db.insert(shops)
        .values({ name: shopName || `${fullName}'s Shop`, code })
        .returning();

      const passwordHash = await bcrypt.hash(password, 10);
      const [newUser] = await db.insert(profiles)
        .values({ email: email.toLowerCase().trim(), passwordHash, fullName: fullName.trim(), role: 'owner', shopId: newShop.id })
        .returning();

      const token = jwt.sign({ id: newUser.id, role: newUser.role, shopId: newUser.shopId }, JWT_SECRET, { expiresIn: '7d' });
      setCookieHeader(res, token);

      return res.status(200).json({ user: newUser, shop: newShop });
    }

    // ── LOGIN ──────────────────────────────────────────────────────────────────
    if (req.method === 'POST' && action === 'login') {
      const { email, password } = req.body;

      if (!email || !password) {
        return res.status(400).json({ error: 'Email and password are required' });
      }

      const [user] = await db.select().from(profiles)
        .where(eq(profiles.email, email.toLowerCase().trim()));

      if (!user) return res.status(401).json({ error: 'Invalid email or password' });

      const isValid = await bcrypt.compare(password, user.passwordHash);
      if (!isValid) return res.status(401).json({ error: 'Invalid email or password' });

      const token = jwt.sign({ id: user.id, role: user.role, shopId: user.shopId }, JWT_SECRET, { expiresIn: '7d' });
      setCookieHeader(res, token);

      return res.status(200).json({ user });
    }

    // ── LOGOUT ─────────────────────────────────────────────────────────────────
    if (req.method === 'POST' && action === 'logout') {
      res.setHeader('Set-Cookie', serializeCookie('auth_token', '', { httpOnly: true, path: '/', expires: new Date(0) }));
      return res.status(200).json({ success: true });
    }

    // ── ME ─────────────────────────────────────────────────────────────────────
    if (req.method === 'GET' && action === 'me') {
      const cookies = parseCookie(req.headers.cookie || '');
      const token = cookies.auth_token;
      if (!token) return res.status(200).json({ user: null });

      try {
        const decoded = jwt.verify(token, JWT_SECRET);
        const [user] = await db.select().from(profiles).where(eq(profiles.id, decoded.id));
        return res.status(200).json({ user: user || null });
      } catch {
        return res.status(200).json({ user: null });
      }
    }

    // ── CREATE SHOPKEEPER ──────────────────────────────────────────────────────
    if (req.method === 'POST' && action === 'create-shopkeeper') {
      const cookies = parseCookie(req.headers.cookie || '');
      const token = cookies.auth_token;
      if (!token) return res.status(401).json({ error: 'Unauthorized' });

      const decoded = jwt.verify(token, JWT_SECRET);
      if (decoded.role !== 'owner') return res.status(403).json({ error: 'Forbidden' });

      const { email, password, fullName } = req.body;
      const passwordHash = await bcrypt.hash(password, 10);
      const [newUser] = await db.insert(profiles)
        .values({ email: email.toLowerCase().trim(), passwordHash, fullName, role: 'shopkeeper', shopId: decoded.shopId })
        .returning();

      return res.status(200).json({ user: newUser });
    }

    return res.status(404).json({ error: 'Not found' });

  } catch (error) {
    console.error('[api/auth] ERROR:', error.message, error.stack);
    return res.status(500).json({ error: error.message });
  }
}
