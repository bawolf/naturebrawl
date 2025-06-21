import { db, imageGenerations, brawls } from '../../db';
import { eq } from 'drizzle-orm';

/**
 * Create a new image generation record
 */
export async function createImageGeneration(data: {
  brawlId: string;
  turnNumber: number;
  prompt?: string;
  modification?: string;
  inputImageUrl?: string;
  status: string;
}): Promise<string> {
  const [generation] = await db
    .insert(imageGenerations)
    .values({
      brawlId: data.brawlId,
      turnNumber: data.turnNumber,
      prompt: data.prompt,
      modification: data.modification,
      inputImageUrl: data.inputImageUrl,
      status: data.status,
    })
    .returning();

  return generation.id;
}

/**
 * Update an existing image generation record
 */
export async function updateImageGeneration(
  id: string,
  data: Partial<{
    replicateId: string;
    status: string;
    outputImageUrl: string;
    gcsPath: string;
    webhookData: any;
    errorMessage: string;
  }>
): Promise<void> {
  await db
    .update(imageGenerations)
    .set(data)
    .where(eq(imageGenerations.id, id));
}

/**
 * Update brawl's current image URL
 */
export async function updateBrawlCurrentImage(
  brawlId: string,
  imageUrl: string
): Promise<void> {
  await db
    .update(brawls)
    .set({ currentImageUrl: imageUrl })
    .where(eq(brawls.id, brawlId));
}

/**
 * Get image generation by Replicate ID
 */
export async function getImageGenerationByReplicateId(replicateId: string) {
  return await db.query.imageGenerations.findFirst({
    where: eq(imageGenerations.replicateId, replicateId),
    with: {
      brawl: true,
    },
  });
}
