import { createClient } from '@libsql/client';

const client = createClient({
  url: process.env.TURSO_DATABASE_URL!,
  authToken: process.env.TURSO_AUTH_TOKEN,
});

let initialized = false;

async function ensureTable() {
  if (initialized) return;
  await client.execute(`
    CREATE TABLE IF NOT EXISTS kv_store (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL DEFAULT '[]',
      updated_at INTEGER NOT NULL DEFAULT 0
    )
  `);
  initialized = true;
}

export async function getValue(key: string): Promise<{ value: string; updatedAt: number } | null> {
  await ensureTable();
  const result = await client.execute({
    sql: 'SELECT value, updated_at FROM kv_store WHERE key = ?',
    args: [key],
  });
  if (result.rows.length === 0) return null;
  const row = result.rows[0];
  return {
    value: row.value as string,
    updatedAt: row.updated_at as number,
  };
}

export async function setValue(key: string, value: string): Promise<number> {
  await ensureTable();
  const now = Date.now();
  await client.execute({
    sql: `INSERT INTO kv_store (key, value, updated_at) VALUES (?, ?, ?)
          ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
    args: [key, value, now],
  });
  return now;
}

export async function getTimestamps(): Promise<Record<string, number>> {
  await ensureTable();
  const result = await client.execute('SELECT key, updated_at FROM kv_store');
  const timestamps: Record<string, number> = {};
  for (const row of result.rows) {
    timestamps[row.key as string] = row.updated_at as number;
  }
  return timestamps;
}
