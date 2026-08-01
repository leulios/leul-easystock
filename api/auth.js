import { db } from '../src/db/index.js';
import { profiles, shops } from '../src/db/schema.js';
import { eq } from 'drizzle-orm';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import cookie from 'cookie';

const JWT_SECRET = process.env.JWT_SECRET || 'super-secret-key-for-dev';

export default async function handler(req, res) {
  const { action } = req.query;

  try {
    if (req.method === 'POST' && action === 'signup') {
      const { email, password, fullName, shopName } = req.body;
      
      const existingUser = await db.select().from(profiles).where(eq(profiles.email, email));
      if (existingUser.length > 0) return res.status(400).json({ error: 'User already exists' });

      // Generate a shop code (e.g. from shop name)
      const code = shopName.toLowerCase().replace(/[^a-z0-9]/g, '') + Math.floor(Math.random() * 1000);
      
      const [newShop] = await db.insert(shops).values({ name: shopName, code }).returning();
      
      const passwordHash = await bcrypt.hash(password, 10);
      const [newUser] = await db.insert(profiles).values({
        email,
        passwordHash,
        fullName,
        role: 'owner',
        shopId: newShop.id
      }).returning();

      const token = jwt.sign({ id: newUser.id, role: newUser.role, shopId: newUser.shopId }, JWT_SECRET, { expiresIn: '7d' });
      res.setHeader('Set-Cookie', cookie.serialize('auth_token', token, { httpOnly: true, path: '/', maxAge: 604800 }));
      
      return res.status(200).json({ user: newUser, shop: newShop });
    }

    if (req.method === 'POST' && action === 'login') {
      const { email, password } = req.body;
      const [user] = await db.select().from(profiles).where(eq(profiles.email, email));
      if (!user) return res.status(401).json({ error: 'Invalid credentials' });

      const isValid = await bcrypt.compare(password, user.passwordHash);
      if (!isValid) return res.status(401).json({ error: 'Invalid credentials' });

      const token = jwt.sign({ id: user.id, role: user.role, shopId: user.shopId }, JWT_SECRET, { expiresIn: '7d' });
      res.setHeader('Set-Cookie', cookie.serialize('auth_token', token, { httpOnly: true, path: '/', maxAge: 604800 }));
      
      return res.status(200).json({ user });
    }

    if (req.method === 'POST' && action === 'logout') {
      res.setHeader('Set-Cookie', cookie.serialize('auth_token', '', { httpOnly: true, path: '/', expires: new Date(0) }));
      return res.status(200).json({ success: true });
    }

    if (req.method === 'GET' && action === 'me') {
      const cookies = cookie.parse(req.headers.cookie || '');
      const token = cookies.auth_token;
      if (!token) return res.status(401).json({ user: null });

      try {
        const decoded = jwt.verify(token, JWT_SECRET);
        const [user] = await db.select().from(profiles).where(eq(profiles.id, decoded.id));
        return res.status(200).json({ user });
      } catch (err) {
        return res.status(401).json({ user: null });
      }
    }
    
    if (req.method === 'POST' && action === 'create-shopkeeper') {
      // Must be authenticated as owner
      const cookies = cookie.parse(req.headers.cookie || '');
      const token = cookies.auth_token;
      if (!token) return res.status(401).json({ error: 'Unauthorized' });
      
      const decoded = jwt.verify(token, JWT_SECRET);
      if (decoded.role !== 'owner') return res.status(403).json({ error: 'Forbidden' });

      const { email, password, fullName } = req.body;
      const passwordHash = await bcrypt.hash(password, 10);
      const [newUser] = await db.insert(profiles).values({
        email,
        passwordHash,
        fullName,
        role: 'shopkeeper',
        shopId: decoded.shopId
      }).returning();

      return res.status(200).json({ user: newUser });
    }

    return res.status(404).json({ error: 'Not found' });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: error.message });
  }
}
