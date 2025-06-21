import { Storage } from '@google-cloud/storage';
import {
  getGCSBucket,
  getGCSKeyfile,
  getGCSServiceAccount,
  getGCSProjectId,
} from './config';

let storageInstance: Storage | null = null;
let bucketInstance: any = null;

/**
 * Get or create Storage instance
 */
function getStorage(): Storage {
  if (!storageInstance) {
    const keyFile = getGCSKeyfile();
    const serviceAccountJson = getGCSServiceAccount();
    const projectId = getGCSProjectId();

    if (serviceAccountJson) {
      // Production: Use service account JSON from environment variable
      const credentials = JSON.parse(serviceAccountJson);
      storageInstance = new Storage({
        credentials,
        projectId,
      });
    } else if (keyFile) {
      // Development: Use service account key file
      storageInstance = new Storage({
        keyFilename: keyFile,
        projectId,
      });
    } else {
      throw new Error(
        'No Google Cloud credentials found. Set either GCS_KEYFILE (dev) or GCS_SERVICE_ACCOUNT_JSON (prod)'
      );
    }
  }
  return storageInstance;
}

/**
 * Get or create bucket instance
 */
function getBucket() {
  if (!bucketInstance) {
    const storage = getStorage();
    bucketInstance = storage.bucket(getGCSBucket());
  }
  return bucketInstance;
}

/**
 * Upload image from URL to Google Cloud Storage
 */
export async function uploadImageToGCS(
  imageUrl: string,
  generationId: string
): Promise<string> {
  const response = await fetch(imageUrl);
  if (!response.ok) {
    throw new Error(`Failed to fetch image: ${response.statusText}`);
  }

  const imageBuffer = await response.arrayBuffer();
  const fileName = `fight-scenes/${generationId}.jpg`;
  const file = getBucket().file(fileName);

  await file.save(Buffer.from(imageBuffer), {
    metadata: {
      contentType: 'image/jpeg',
    },
  });

  return fileName;
}

/**
 * Get public URL for GCS file
 */
export async function getPublicUrl(gcsPath: string): Promise<string> {
  const file = getBucket().file(gcsPath);
  const [url] = await file.getSignedUrl({
    action: 'read',
    expires: '03-01-2030', // Long expiry for fight images
  });
  return url;
}
