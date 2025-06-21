import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';
import { getRequiredEnvVar } from '../env';

// Get database URL using our cross-platform helper
const databaseUrl = getRequiredEnvVar('DATABASE_URL');

if (!databaseUrl) {
  throw new Error('DATABASE_URL environment variable is required');
}

// Create the connection
const client = postgres(databaseUrl);

// Create the database instance
export const db = drizzle(client, { schema });

// Export schema for easy access
export * from './schema';
