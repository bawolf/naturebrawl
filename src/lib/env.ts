/**
 * Get environment variable that works in both Astro dev mode and Node.js production
 * In dev: uses import.meta.env
 * In production (Fly.io): uses process.env
 */
export function getEnvVar(key: string): string | undefined {
  // Try import.meta.env first (Astro dev mode)
  if (typeof import.meta !== 'undefined' && import.meta.env) {
    return import.meta.env[key];
  }

  // Fallback to process.env (Node.js production)
  if (typeof process !== 'undefined' && process.env) {
    return process.env[key];
  }

  return undefined;
}

/**
 * Get required environment variable, throws if not found
 */
export function getRequiredEnvVar(key: string): string {
  const value = getEnvVar(key);
  if (!value) {
    throw new Error(`Required environment variable ${key} is not set`);
  }
  return value;
}
