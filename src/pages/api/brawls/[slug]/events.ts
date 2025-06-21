import type { APIRoute } from 'astro';
import { db, brawls, battleEvents } from '../../../../lib/db';
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

    // Get the brawl
    const brawl = await db.query.brawls.findFirst({
      where: eq(brawls.slug, slug),
    });

    if (!brawl) {
      return new Response(JSON.stringify({ error: 'Brawl not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Get battle events for this brawl, ordered by creation time
    const events = await db
      .select()
      .from(battleEvents)
      .where(eq(battleEvents.brawlId, brawl.id))
      .orderBy(battleEvents.createdAt);

    return new Response(JSON.stringify({ events }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error fetching battle events:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
