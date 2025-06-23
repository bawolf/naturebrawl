import type { Character } from '../../db/schema';
import type { AttackResult } from '../../game/engine';
import {
  generateInitialScenePrompt,
  buildAttackModification,
  buildVictoryModification,
} from './prompts';
import {
  createInitialScenePrediction,
  createAttackScenePrediction,
} from './replicate';
import { uploadImageToGCS, getPublicUrl } from './storage';
import {
  createImageGeneration,
  updateImageGeneration,
  updateBrawlCurrentImage,
  updateBrawlInitialImage,
  getImageGenerationByReplicateId,
} from './database';

// Re-export config for external use
export { FLUX_KONTEXT_CONFIG } from './config';

/**
 * Generate initial fight scene image
 */
export async function generateInitialFightScene(
  brawlId: string,
  characters: Character[],
  location: string
): Promise<string> {
  const prompt = generateInitialScenePrompt(characters, location);

  const generationId = await createImageGeneration({
    brawlId,
    turnNumber: 0, // Initial scene
    prompt,
    status: 'pending',
  });

  try {
    const replicateId = await createInitialScenePrediction(prompt);

    await updateImageGeneration(generationId, {
      replicateId,
      status: 'processing',
    });

    return generationId;
  } catch (error) {
    await updateImageGeneration(generationId, {
      status: 'failed',
      errorMessage: error instanceof Error ? error.message : 'Unknown error',
    });
    throw error;
  }
}

/**
 * Generate attack scene using Flux Kontext modification
 */
export async function generateAttackScene(
  brawlId: string,
  turnNumber: number,
  attackResult: AttackResult,
  attacker: Character,
  defender: Character,
  previousImageUrl: string
): Promise<string> {
  const modification = buildAttackModification(
    attackResult,
    attacker,
    defender
  );

  const generationId = await createImageGeneration({
    brawlId,
    turnNumber,
    modification,
    inputImageUrl: previousImageUrl,
    status: 'pending',
  });

  try {
    const replicateId = await createAttackScenePrediction(
      previousImageUrl,
      modification
    );

    await updateImageGeneration(generationId, {
      replicateId,
      status: 'processing',
    });

    return generationId;
  } catch (error) {
    console.error('Error generating attack scene:', error);
    await updateImageGeneration(generationId, {
      status: 'failed',
      errorMessage: error instanceof Error ? error.message : 'Unknown error',
    });
    throw error;
  }
}

/**
 * Handle webhook response from Replicate
 * This function is called by the webhook endpoint and uses dependency injection
 * to avoid circular dependencies with the streaming service
 */
export async function handleReplicateWebhook(
  replicateId: string,
  webhookData: any,
  broadcastUpdate?: (slug: string, data: any) => void
): Promise<void> {
  console.log('Processing Replicate webhook:', {
    replicateId,
    status: webhookData.status,
  });

  const generation = await getImageGenerationByReplicateId(replicateId);

  if (!generation) {
    console.error('Image generation not found for Replicate ID:', replicateId);
    return;
  }

  try {
    if (webhookData.status === 'succeeded' && webhookData.output) {
      // Download and upload image to GCS
      const imageUrl = Array.isArray(webhookData.output)
        ? webhookData.output[0]
        : webhookData.output;

      const gcsPath = await uploadImageToGCS(imageUrl, generation.id);
      const publicUrl = await getPublicUrl(gcsPath);

      await updateImageGeneration(generation.id, {
        status: 'completed',
        outputImageUrl: publicUrl,
        gcsPath,
        webhookData,
      });

      // Update brawl's current image
      await updateBrawlCurrentImage(generation.brawlId, publicUrl);

      // Set initial image URL if this is the initial scene (turn 0)
      if (generation.turnNumber === 0) {
        await updateBrawlInitialImage(generation.brawlId, publicUrl);
      }

      // Broadcast image update to connected clients if function provided
      if (broadcastUpdate) {
        broadcastUpdate(generation.brawl.slug, {
          type: 'image_updated',
          imageUrl: publicUrl,
          turnNumber: generation.turnNumber,
          generationId: generation.id,
        });
      }

      console.log('Image generation completed successfully:', generation.id);
    } else if (webhookData.status === 'failed') {
      await updateImageGeneration(generation.id, {
        status: 'failed',
        errorMessage: webhookData.error || 'Generation failed',
        webhookData,
      });

      // Broadcast failure to connected clients if function provided
      if (broadcastUpdate) {
        broadcastUpdate(generation.brawl.slug, {
          type: 'image_failed',
          turnNumber: generation.turnNumber,
          generationId: generation.id,
          error: webhookData.error || 'Generation failed',
        });
      }

      console.error(
        'Image generation failed:',
        generation.id,
        webhookData.error
      );
    }
  } catch (error) {
    await updateImageGeneration(generation.id, {
      status: 'failed',
      errorMessage: error instanceof Error ? error.message : 'Unknown error',
    });

    console.error('Error processing webhook:', error);
  }
}

/**
 * Generate victory scene using Flux Kontext modification
 */
export async function generateVictoryImage(
  brawlId: string,
  winner: Character,
  loser: Character,
  previousImageUrl?: string
): Promise<string> {
  const modification = buildVictoryModification(winner, loser);

  const generationId = await createImageGeneration({
    brawlId,
    turnNumber: -1, // Special value for victory scene
    modification,
    inputImageUrl: previousImageUrl,
    status: 'pending',
  });

  try {
    if (!previousImageUrl) {
      throw new Error(
        'Previous image URL is required for victory scene generation'
      );
    }

    const replicateId = await createAttackScenePrediction(
      previousImageUrl,
      modification
    );

    await updateImageGeneration(generationId, {
      replicateId,
      status: 'processing',
    });

    return generationId;
  } catch (error) {
    console.error('Error generating victory image:', error);
    await updateImageGeneration(generationId, {
      status: 'failed',
      errorMessage: error instanceof Error ? error.message : 'Unknown error',
    });
    throw error;
  }
}
