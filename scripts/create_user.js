import 'dotenv/config';
import { db } from '../src/db/index.js';
import { profiles, shops } from '../src/db/schema.js';
import bcrypt from 'bcryptjs';

async function main() {
  try {
    console.log('Creating owner account...');
    
    // Create Shop
    const [shop] = await db.insert(shops).values({
      name: "Leul's Shop",
      code: "leulshop123"
    }).returning();
    console.log('Shop created:', shop.name);

    // Create Profile
    const passwordHash = await bcrypt.hash('EasyStock2026!', 10);
    const [profile] = await db.insert(profiles).values({
      email: 'msw.loul@gmail.com',
      fullName: 'leul mulushewa',
      passwordHash,
      role: 'owner',
      shopId: shop.id
    }).returning();
    
    console.log('User created:', profile.email);
    console.log('Password set to: EasyStock2026!');
    process.exit(0);
  } catch (err) {
    console.error('Error:', err);
    process.exit(1);
  }
}

main();
