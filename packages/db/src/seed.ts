import { config } from 'dotenv';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { seedUser } from './seeds/user.js';
import { seedUserSettings } from './seeds/user_settings.js';
import { seedAgentTemplates } from './seeds/agent_templates.js';
import { seedAiProviders } from './seeds/ai_providers.js';
import { seedWorkflowComponents } from './seeds/workflow-components.js';
import { seedBuiltinSkills } from './seeds/builtin-skills.js';
import * as schema from './schema/index.js';

// Load .env from workspace root
const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: resolve(__dirname, '../../../.env') });

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error('DATABASE_URL environment variable is not set');
}

const client = postgres(connectionString, { max: 1 });
const db = drizzle(client, { schema });

async function seed() {
  console.log('Starting database seed...');

  try {
    await seedUser(db);
    await seedUserSettings(db);
    await seedAgentTemplates(db);
    await seedAiProviders(db);
    await seedWorkflowComponents(db);
    await seedBuiltinSkills(db);

    console.log('\n✓ Seed completed successfully!');
    console.log('  Summary: 1 user, 4 settings, 3 templates, 1 ai_provider, 11 workflow_components, 9 builtin_skills');
  } catch (error) {
    console.error('Seed failed:', error);
    process.exit(1);
  } finally {
    await client.end();
  }
}

seed();
