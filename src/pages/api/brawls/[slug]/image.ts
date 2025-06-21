import type { APIRoute } from 'astro';
import { db, brawls, imageGenerations } from '../../../../lib/db';
import { eq, desc } from 'drizzle-orm';

export const prerender = false;

export const GET: APIRoute = async ({ params }) => {
  try {
    const { slug } = params;

    if (!slug) {
      return new Response(JSON.stringify({ error: 'Slug is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Get the brawl with its current image and latest image generation
    const brawl = await db.query.brawls.findFirst({
      where: eq(brawls.slug, slug),
      with: {
        imageGenerations: {
          orderBy: desc(imageGenerations.createdAt),
          limit: 1,
        },
      },
    });

    if (!brawl) {
      return new Response(JSON.stringify({ error: 'Brawl not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const latestGeneration = brawl.imageGenerations[0];

    return new Response(
      JSON.stringify({
        currentImageUrl: brawl.currentImageUrl,
        latestGeneration: latestGeneration
          ? {
              id: latestGeneration.id,
              status: latestGeneration.status,
              turnNumber: latestGeneration.turnNumber,
              createdAt: latestGeneration.createdAt,
              errorMessage: latestGeneration.errorMessage,
            }
          : null,
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Error getting brawl image:', error);
    return new Response(
      JSON.stringify({
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error',
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
