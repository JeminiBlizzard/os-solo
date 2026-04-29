import { db, schema } from '@os-solo/db';
import { eq } from 'drizzle-orm';
import type { Response } from 'express';

/**
 * Export all user data as a streaming JSON response
 */
export async function exportUserData(userId: number, res: Response): Promise<void> {
  try {
    // Set headers for JSON download
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="solo-export-${timestamp}.json"`);
    res.setHeader('Transfer-Encoding', 'chunked');

    // Start JSON object
    res.write('{\n');
    res.write('  "exported_at": "' + new Date().toISOString() + '",\n');
    res.write('  "user_id": ' + userId + ',\n');

    // Export agents
    const agents = await db.query.agents.findMany({
      where: eq(schema.agents.userId, userId),
    });
    res.write('  "agents": ' + JSON.stringify(agents, null, 2).replace(/\n/g, '\n  ') + ',\n');

    // Export agent runs
    const agentRuns = await db.query.agentRuns.findMany({
      where: eq(schema.agentRuns.userId, userId),
    });
    res.write('  "agent_runs": ' + JSON.stringify(agentRuns, null, 2).replace(/\n/g, '\n  ') + ',\n');

    // Export projects
    const projects = await db.query.projects.findMany({
      where: eq(schema.projects.userId, userId),
    });
    res.write('  "projects": ' + JSON.stringify(projects, null, 2).replace(/\n/g, '\n  ') + ',\n');

    // Export vault entries (with encrypted values, not plaintext)
    const vaultEntries = await db.query.vaultEntries.findMany({
      where: eq(schema.vaultEntries.userId, userId),
    });
    res.write('  "vault_entries": ' + JSON.stringify(vaultEntries, null, 2).replace(/\n/g, '\n  ') + ',\n');

    // Export inbox items
    const inboxItems = await db.query.inboxItems.findMany({
      where: eq(schema.inboxItems.userId, userId),
    });
    res.write('  "inbox_items": ' + JSON.stringify(inboxItems, null, 2).replace(/\n/g, '\n  ') + ',\n');

    // Export revenue events
    const revenueEvents = await db.query.revenueEvents.findMany({
      where: eq(schema.revenueEvents.userId, userId),
    });
    res.write('  "revenue_events": ' + JSON.stringify(revenueEvents, null, 2).replace(/\n/g, '\n  ') + ',\n');

    // Export expenses
    const expenses = await db.query.expenses.findMany({
      where: eq(schema.expenses.userId, userId),
    });
    res.write('  "expenses": ' + JSON.stringify(expenses, null, 2).replace(/\n/g, '\n  ') + ',\n');

    // Export servers
    const servers = await db.query.servers.findMany({
      where: eq(schema.servers.userId, userId),
    });
    res.write('  "servers": ' + JSON.stringify(servers, null, 2).replace(/\n/g, '\n  ') + ',\n');

    // Export briefings
    const briefings = await db.query.briefings.findMany({
      where: eq(schema.briefings.userId, userId),
    });
    res.write('  "briefings": ' + JSON.stringify(briefings, null, 2).replace(/\n/g, '\n  ') + ',\n');

    // Export integrations
    const integrations = await db.query.integrations.findMany({
      where: eq(schema.integrations.userId, userId),
    });
    res.write('  "integrations": ' + JSON.stringify(integrations, null, 2).replace(/\n/g, '\n  ') + ',\n');

    // Export user settings
    const userSettings = await db.query.userSettings.findFirst({
      where: eq(schema.userSettings.userId, userId),
    });
    res.write('  "user_settings": ' + JSON.stringify(userSettings, null, 2).replace(/\n/g, '\n  ') + ',\n');

    // Export user preferences KV
    const userPreferencesKv = await db.query.userPreferencesKv.findMany({
      where: eq(schema.userPreferencesKv.userId, userId),
    });
    res.write('  "user_preferences_kv": ' + JSON.stringify(userPreferencesKv, null, 2).replace(/\n/g, '\n  ') + '\n');

    // Close JSON object
    res.write('}\n');
    res.end();
  } catch (error) {
    console.error('Error exporting user data:', error);
    // If we haven't sent any data yet, we can send an error response
    if (!res.headersSent) {
      res.status(500).json({ error: 'Failed to export data' });
    } else {
      // If we've already started streaming, just end the response
      res.end();
    }
  }
}
