import { db } from '@os-solo/db';
import { sql } from 'drizzle-orm';

interface TableRowCount {
  table_name: string;
  row_count: number;
}

interface DatabaseInfo {
  tables: TableRowCount[];
  total_size_bytes: number;
  total_size_human: string;
}

/**
 * Get database statistics including table row counts and total size
 */
export async function getDatabaseInfo(): Promise<DatabaseInfo> {
  // Get row counts for major tables
  const tableNames = [
    'agents',
    'agent_runs',
    'projects',
    'vault_entries',
    'inbox_items',
    'revenue_events',
    'expenses',
    'servers',
    'briefings',
    'integrations',
    'users',
    'user_settings',
  ];

  const tables: TableRowCount[] = [];

  for (const tableName of tableNames) {
    try {
      const result = await db.execute(
        sql.raw(`SELECT COUNT(*) as count FROM ${tableName}`)
      );
      const count = parseInt((result.rows[0] as any).count || '0');
      tables.push({ table_name: tableName, row_count: count });
    } catch (error) {
      console.error(`Error counting rows in ${tableName}:`, error);
      tables.push({ table_name: tableName, row_count: 0 });
    }
  }

  // Get total database size
  let totalSizeBytes = 0;
  try {
    const result = await db.execute(
      sql`SELECT pg_database_size(current_database()) as size`
    );
    totalSizeBytes = parseInt((result.rows[0] as any).size || '0');
  } catch (error) {
    console.error('Error getting database size:', error);
  }

  // Convert bytes to human-readable format
  const totalSizeHuman = formatBytes(totalSizeBytes);

  return {
    tables,
    total_size_bytes: totalSizeBytes,
    total_size_human: totalSizeHuman,
  };
}

/**
 * Format bytes to human-readable format
 */
function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 Bytes';

  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
}
