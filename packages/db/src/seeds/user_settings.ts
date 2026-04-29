import { eq } from 'drizzle-orm';
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { userSettings } from '../schema/user-settings.js';

export async function seedUserSettings(db: PostgresJsDatabase<any>) {
  console.log('  Seeding user settings...');

  // Check if settings already exist for user_id=1
  const existing = await db
    .select()
    .from(userSettings)
    .where(eq(userSettings.userId, 1))
    .limit(1);

  if (existing.length > 0) {
    console.log('    ✓ User settings for user_id=1 already exist, skipping');
    return;
  }

  // Insert default settings for user_id=1
  await db.insert(userSettings).values({
    userId: 1,
    timezone: 'America/New_York',
    defaultAiModel: null,
    aiMonthlyBudgetCents: 30000,
    focusModeActive: false,
    focusModeStartedAt: null,
    briefingSchedule: '09:00',
    eveningDebriefEnabled: true,
    notificationEmailEnabled: false,
    notificationCriticalOnly: false,
    theme: 'light',
  });

  console.log('    ✓ User settings created for user_id=1');
}
