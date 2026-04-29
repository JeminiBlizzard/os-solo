import { eq } from 'drizzle-orm';
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { users } from '../schema/foundation.js';

export async function seedUser(db: PostgresJsDatabase<any>) {
  console.log('  Seeding default user...');

  // Upsert default operator user (id=1)
  await db.insert(users)
    .values({
      id: 1,
      email: 'operator@localhost',
      displayName: 'Operator',
      authEnabled: false,
      passwordHash: null,
      avatarUrl: null,
    })
    .onConflictDoUpdate({
      target: users.id,
      set: {
        email: 'operator@localhost',
        displayName: 'Operator',
        authEnabled: false,
        updatedAt: new Date(),
      },
    });

  console.log('    ✓ Default user created/updated (id=1)');
}
