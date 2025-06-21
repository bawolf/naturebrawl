import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { getRequiredEnvVar } from '../env';
import * as schema from './schema';

// Create the connection
const client = postgres(getRequiredEnvVar('DATABASE_URL'));

// Create the database instance
export const db = drizzle(client, { schema });

// Export tables and types
export * from './schema';
export {
  brawls,
  characters,
  attacks,
  imageGenerations,
  battleEvents,
} from './schema';
