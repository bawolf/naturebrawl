import type { APIRoute } from 'astro';
import { db, brawls, characters, attacks } from '../../../../lib/db';
import { eq } from 'drizzle-orm';
import { createGameEngine } from '../../../../lib/game/engine';
import { broadcastBrawlUpdate } from './stream';
import {
  generateAttackScene,
  generateVictoryImage,
} from '../../../../lib/services/image-generation';

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

    // Check if request has valid JSON body
    const contentType = request.headers.get('content-type');
    if (!contentType || !contentType.includes('application/json')) {
      return new Response(
        JSON.stringify({ error: 'Content-Type must be application/json' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    let body;
    try {
      body = await request.json();
    } catch (err) {
      return new Response(
        JSON.stringify({ error: 'Invalid JSON in request body' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const { characterId, attackId, browserId } = body;

    // Validate input
    if (!characterId || !attackId || !browserId) {
      return new Response(
        JSON.stringify({
          error: 'characterId, attackId, and browserId are required',
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Get the brawl with characters and attacks
    const brawl = await db.query.brawls.findFirst({
      where: eq(brawls.slug, slug),
      with: {
        characters: {
          with: {
            attacks: true,
          },
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

    // Create game engine
    const gameEngine = createGameEngine(brawl);

    // Validate it's the player's turn
    const currentPlayer = gameEngine.getCurrentPlayer();
    if (!currentPlayer || currentPlayer.id !== characterId) {
      return new Response(JSON.stringify({ error: 'Not your turn' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Validate the attack can be used
    const validation = gameEngine.canUseAttack(characterId, attackId);
    if (!validation.canUse) {
      return new Response(
        JSON.stringify({ error: validation.reason || 'Cannot use attack' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Execute the attack
    const attackResult = gameEngine.executeAttack(characterId, attackId);

    // Update the database with new character states
    const gameState = gameEngine.getGameState();

    // Update both characters
    for (const char of gameState.brawl.characters) {
      await db
        .update(characters)
        .set({
          health: char.health,
          energy: char.energy,
        })
        .where(eq(characters.id, char.id));
    }

    // Update brawl state
    await db
      .update(brawls)
      .set({
        currentPlayerId: gameState.brawl.currentPlayerId,
        turnNumber: gameState.brawl.turnNumber,
        winnerId: gameState.brawl.winnerId,
      })
      .where(eq(brawls.id, brawl.id));

    // Generate appropriate image based on game state
    if (gameState.brawl.currentImageUrl) {
      try {
        const attacker = gameState.brawl.characters.find(
          (c) => c.id === attackResult.attackerId
        );
        const defender = gameState.brawl.characters.find(
          (c) => c.id === attackResult.defenderId
        );

        if (attacker && defender) {
          if (attackResult.gameOver) {
            // Generate victory scene
            console.log('Generating victory scene image...');
            await generateVictoryImage(
              brawl.id,
              attacker, // Winner is the attacker who landed the final blow
              defender, // Loser is the defender who was defeated
              gameState.brawl.currentImageUrl
            );
            console.log('Victory scene generation started');
          } else {
            // Generate regular attack scene
            console.log('Generating attack scene image...');
            await generateAttackScene(
              brawl.id,
              gameState.currentTurn,
              attackResult,
              attacker,
              defender,
              gameState.brawl.currentImageUrl
            );
            console.log('Attack scene generation started');
          }
        }
      } catch (error) {
        console.error('Failed to start image generation:', error);
        // Don't fail the attack if image generation fails
      }
    }

    // Broadcast the attack result to all connected clients
    console.log('Broadcasting attack result via SSE...');
    const battleSummary = gameEngine.getBattleSummary();
    console.log('Battle summary being broadcast:', {
      currentPlayer: battleSummary.currentPlayer,
      turnNumber: battleSummary.turnNumber,
      gamePhase: battleSummary.gamePhase,
    });

    broadcastBrawlUpdate(slug, {
      type: 'attack_result',
      attackResult,
      gameState: battleSummary,
    });

    return new Response(
      JSON.stringify({
        success: true,
        attackResult,
        gameState: battleSummary,
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Error executing attack:', error);
    return new Response(
      JSON.stringify({
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error',
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
