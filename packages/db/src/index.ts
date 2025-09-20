import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

if (!process.env.DATABASE_URL) {
  console.error('🔴 DATABASE_URL environment variable is not set in the runtime environment.');
}

const isProduction = process.env.NODE_ENV === 'production';
const connectionOptions: postgres.Options<Record<string, postgres.PostgresType>> = {
  max: 1,
  ssl: isProduction ? ('require' as const) : undefined,
};

const queryClient = postgres(
  process.env.DATABASE_URL || 'postgresql://invalid:invalid@invalid/invalid',
  connectionOptions,
);

const shouldLogQueries = process.env.DB_LOG_QUERIES === 'true';
const safeLogger = shouldLogQueries
  ? {
      logQuery(query: string, params: unknown[]) {
        const MAX_PREVIEW = 160;
        const MAX_TOTAL = 320;
        const toPreview = (v: unknown) => {
          try {
            if (typeof v === 'string') return v.length > MAX_PREVIEW ? `${v.slice(0, MAX_PREVIEW)}… [${v.length} chars]` : v;
            const s = JSON.stringify(v);
            return s.length > MAX_PREVIEW ? `${s.slice(0, MAX_PREVIEW)}… [${s.length} chars]` : s;
          } catch {
            return '[unserializable]';
          }
        };
        const safeParams = Array.isArray(params) ? params.slice(0, 20).map(toPreview) : [];
        const str = JSON.stringify(safeParams);
        const trimmed = str.length > MAX_TOTAL ? `${str.slice(0, MAX_TOTAL)}… [truncated]` : str;
        console.log('DB Query:', query, '-- params:', trimmed);
      },
    }
  : false;

export const db = drizzle(queryClient, { schema, logger: safeLogger });
export * from './schema';
