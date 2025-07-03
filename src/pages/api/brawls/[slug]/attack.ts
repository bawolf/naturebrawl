import type { APIRoute } from 'astro';
import { db, brawls, characters } from '../../../../lib/db';
import { eq } from 'drizzle-orm';
import { createGameEngine } from '../../../../lib/game/engine';
import { broadcastToFight } from './stream';
import {
  generateAttackScene,
  generateVictoryImage,
} from '../../../../lib/services/image-generation';
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
          orderBy: (characters, { asc }) => [asc(characters.createdAt)], // Challenger created first
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

    console.log('Brawl currentImageUrl:', brawl.currentImageUrl); // Debug log

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
    if (brawl.currentImageUrl) {
      try {
        const attacker = gameState.brawl.characters.find(
          (c) => c.id === attackResult.attackerId
        );
        const defender = gameState.brawl.characters.find(
          (c) => c.id === attackResult.defenderId
        );

        if (attacker && defender) {
          if (attackResult.gameOver) {
            // Generate victory scene based on initial image for consistency
            console.log('Generating victory scene image...');
            await generateVictoryImage(
              brawl.id,
              attacker, // Winner is the attacker who landed the final blow
              defender, // Loser is the defender who was defeated
              brawl.initialImageUrl || brawl.currentImageUrl
            );
          } else {
            // Generate attack scene
            console.log('Generating attack scene image...');
            await generateAttackScene(
              brawl.id,
              gameState.brawl.turnNumber,
              attackResult,
              attacker,
              defender,
              brawl.initialImageUrl || brawl.currentImageUrl
            );
          }
        }
      } catch (error) {
        console.error('Error generating image:', error);
        // Continue without failing the entire request
      }
    } else {
      console.log('No currentImageUrl available, skipping image generation');
    }

    // Broadcast the attack result to all connected clients
    console.log('Broadcasting attack result via Socket.IO...');
    const battleSummary = gameEngine.getBattleSummary();
    console.log('Battle summary being broadcast:', {
      currentPlayer: battleSummary.currentPlayer,
      turnNumber: battleSummary.turnNumber,
      gamePhase: battleSummary.gamePhase,
    });

    broadcastToFight(slug, {
      type: 'attack_result',
      attackResult,
      gameState: battleSummary,
    });

    // Store battle events in the database
    const attacker = gameState.brawl.characters.find(
      (c) => c.id === attackResult.attackerId
    );
    const defender = gameState.brawl.characters.find(
      (c) => c.id === attackResult.defenderId
    );

    if (attacker && defender) {
      const attackerName = getSpeciesName(attacker.species);
      const defenderName = getSpeciesName(defender.species);

      if (attackResult.isHit) {
        let message = `⚔️ ${attackerName} used ${attackResult.attackUsed.name}!`;
        if (attackResult.isCritical) {
          message += ` 💥 Critical hit!`;
        }
        message += ` Dealt ${attackResult.damage} damage to ${defenderName}.`;
        await storeBattleEvent(
          brawl.id,
          gameState.brawl.turnNumber,
          'attack',
          message
        );
      } else {
        const message = `💨 ${attackerName} used ${attackResult.attackUsed.name} but missed!`;
        await storeBattleEvent(
          brawl.id,
          gameState.brawl.turnNumber,
          'miss',
          message
        );
      }

      if (attackResult.gameOver) {
        const message = `🏆 ${attackerName} wins the battle!`;
        await storeBattleEvent(
          brawl.id,
          gameState.brawl.turnNumber,
          'victory',
          message
        );
      }
    }

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
