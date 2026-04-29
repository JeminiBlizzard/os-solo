import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  schema: [
    './src/schema/foundation.ts',
    './src/schema/audit.ts',
    './src/schema/agents.ts',
    './src/schema/approval-queue.ts',
    './src/schema/inbox.ts',
    './src/schema/infrastructure.ts',
    './src/schema/finance.ts',
    './src/schema/projects.ts',
    './src/schema/vault.ts',
    './src/schema/skills.ts',
    './src/schema/skill-executions.ts',
    './src/schema/misc.ts',
    './src/schema/user-settings.ts',
    './src/schema/integrations.ts',
    './src/schema/workflows.ts',
    './src/schema/command-history.ts',
    './src/schema/notifications.ts',
  ],
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
});
