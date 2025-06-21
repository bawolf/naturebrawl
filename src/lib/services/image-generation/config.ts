import { getRequiredEnvVar, getEnvVar } from '../../env';

export interface FluxKontextConfig {
  model: string;
}

// Flux models configuration
export const FLUX_KONTEXT_CONFIG: FluxKontextConfig = {
  model: 'black-forest-labs/flux-kontext-pro',
};

// For initial scene generation (Kontext is for editing, not generation)
export const FLUX_DEV_CONFIG = {
  model: 'black-forest-labs/flux-dev',
};

// Environment variable getters
export const getReplicateApiToken = (): string =>
  getRequiredEnvVar('REPLICATE_API_TOKEN');

export const getGCSBucket = (): string => getRequiredEnvVar('GCS_BUCKET');

export const getGCSKeyfile = (): string | undefined => getEnvVar('GCS_KEYFILE'); // Optional - used in dev

export const getGCSServiceAccount = (): string | undefined =>
  getEnvVar('GCS_SERVICE_ACCOUNT_JSON'); // Optional - used in prod

export const getGCSProjectId = (): string =>
  getRequiredEnvVar('GCS_PROJECT_ID');
