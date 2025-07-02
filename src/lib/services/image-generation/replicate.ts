import Replicate from 'replicate';
import {
  FLUX_KONTEXT_CONFIG,
  FLUX_DEV_CONFIG,
  getReplicateApiToken,
} from './config';
import { TunnelManager } from '../../tunnel';

let replicateInstance: Replicate | null = null;

/**
 * Get or create Replicate instance
 */
function getReplicate(): Replicate {
  if (!replicateInstance) {
    replicateInstance = new Replicate({
      auth: getReplicateApiToken(),
    });
  }
  return replicateInstance;
}

/**
 * Get webhook URL for Replicate callbacks
 */
async function getWebhookUrl(): Promise<string> {
  const baseUrl = await TunnelManager.getInstance().getUrl();
  return `${baseUrl}/api/replicate-webhook`;
}

/**
 * Create initial scene prediction with Replicate using Flux Dev
 * (Kontext is for editing, not initial generation)
 */
export async function createInitialScenePrediction(
  prompt: string
): Promise<string> {
  const webhookUrl = await getWebhookUrl();

  const prediction = await getReplicate().predictions.create({
    model: FLUX_DEV_CONFIG.model,
    input: {
      prompt,
      aspect_ratio: '4:3', // Fighting game style aspect ratio
      num_inference_steps: 28,
      guidance_scale: 3.5,
      output_format: 'jpg',
    },
    webhook: webhookUrl,
    webhook_events_filter: ['completed'],
  });

  return prediction.id;
}

/**
 * Create attack scene prediction using Flux Kontext Pro for image editing
 */
export async function createAttackScenePrediction(
  previousImageUrl: string,
  modification: string
): Promise<string> {
  const webhookUrl = await getWebhookUrl();

  const prediction = await getReplicate().predictions.create({
    model: FLUX_KONTEXT_CONFIG.model,
    input: {
      input_image: previousImageUrl,
      prompt: modification,
      guidance_scale: 3.5,
      output_format: 'jpg',
      disable_safety_checker: true,
      safety_tolerance: 6,
      // Removed aspect_ratio to preserve original image dimensions
    },
    webhook: webhookUrl,
    webhook_events_filter: ['completed'],
  });

  return prediction.id;
}
