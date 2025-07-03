import type { APIRoute } from 'astro';
import { db, brawls, characters } from '../../../../lib/db';
import { eq } from 'drizzle-orm';
import { createGameEngine } from '../../../../lib/game/engine';
import { broadcastToFight } from './stream';
import { storeBattleEvent } from '../../../../lib/db/helpers';
import { getSpeciesName } from '../../../../lib/species';

export const prerender = false;

export const POST: APIRoute = async ({ params, request }) => {
  try {
    const { slug } = params;
    if (!slug) {
      return new Response(JSON.stringify({ error: 'Slug is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const contentType = request.headers.get('content-type');
    if (!contentType || !contentType.includes('application/json')) {
      return new Response(
        JSON.stringify({ error: 'Content-Type must be application/json' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const { characterId, browserId } = await request.json();
    if (!characterId || !browserId) {
      return new Response(
        JSON.stringify({ error: 'characterId and browserId are required' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Get the brawl with characters and attacks
    const brawl = await db.query.brawls.findFirst({
      where: eq(brawls.slug, slug),
      with: {
        characters: {
          orderBy: (characters, { asc }) => [asc(characters.createdAt)],
          with: { attacks: true },
        },
      },
    });

    if (!brawl) {
      return new Response(JSON.stringify({ error: 'Brawl not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Verify the character belongs to the requesting browser
    const character = brawl.characters.find((c) => c.id === characterId);
    if (!character || character.browserId !== browserId) {
      return new Response(
        JSON.stringify({ error: 'Character not found or unauthorized' }),
        { status: 403, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Create game engine and let it handle all validation
    const gameEngine = createGameEngine(brawl);

    // The game engine handles all the validation logic
    const restResult = gameEngine.executeRest(characterId);
    const gameState = gameEngine.getGameState();

    // Update both characters (resting character + new current player gets energy recovery)
    for (const char of gameState.brawl.characters) {
      await db
        .update(characters)
        .set({ energy: char.energy })
        .where(eq(characters.id, char.id));
    }

    // Update brawl state (turn switching)
    await db
      .update(brawls)
      .set({
        currentPlayerId: gameState.brawl.currentPlayerId,
        turnNumber: gameState.brawl.turnNumber,
      })
      .where(eq(brawls.id, brawl.id));

    // Broadcast the rest result
    const battleSummary = gameEngine.getBattleSummary();
    broadcastToFight(slug, {
      type: 'rest_result',
      restResult,
      gameState: battleSummary,
    });

    // Store battle event
    const restingCharacter = gameState.brawl.characters.find(
      (c) => c.id === restResult.characterId
    );
    if (restingCharacter) {
      const speciesName = getSpeciesName(restingCharacter.species);
      const message = `🌟 ${speciesName} rests and recovers ${restResult.energyRecovered} energy!`;
      await storeBattleEvent(
        brawl.id,
        gameState.brawl.turnNumber,
        'info',
        message
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        restResult,
        gameState: battleSummary,
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Error in /rest endpoint:', error);
    return new Response(
      JSON.stringify({
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error',
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
};
