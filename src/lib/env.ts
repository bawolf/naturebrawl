/**
 * Get environment variable that works in both Astro dev mode and Node.js production
 * In dev: uses import.meta.env
 * In production (Fly.io): uses process.env
 */
export function getEnvVar(key: string): string | undefined {
  // In production (Node.js), always use process.env
  if (typeof process !== 'undefined' && process.env && process.env[key]) {
    return process.env[key];
  }

  // In development (Vite/Astro), use import.meta.env
  if (
    typeof import.meta !== 'undefined' &&
    import.meta.env &&
    import.meta.env[key]
  ) {
    return import.meta.env[key];
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
