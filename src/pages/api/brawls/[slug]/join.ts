import type { APIRoute } from 'astro';
import { db, brawls, characters, attacks } from '../../../../lib/db';
import { eq } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import {
  isValidSpecies,
  getSpeciesName,
  getSpeciesEmoji,
} from '../../../../lib/species';
import { broadcastToFight } from './stream';
import { generateCharacterStats } from '../../../../lib/llm/character-generator';
import { generateInitialFightScene } from '../../../../lib/services/image-generation';
import { storeBattleEvent } from '../../../../lib/db/helpers';

export const prerender = false;

export const POST: APIRoute = async ({ request, params }) => {
  try {
    const { slug } = params;

    if (!slug) {
      return new Response(JSON.stringify({ error: 'Slug is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const body = await request.json();
    const { species, browserId } = body;

    if (!species || !browserId) {
      return new Response(
        JSON.stringify({ error: 'Species and browserId are required' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Validate species
    if (!isValidSpecies(species)) {
      return new Response(JSON.stringify({ error: 'Invalid species' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Get the brawl with its characters
    const brawl = await db.query.brawls.findFirst({
      where: eq(brawls.slug, slug),
      with: {
        characters: {
          orderBy: (characters, { asc }) => [asc(characters.createdAt)], // Challenger created first
          with: {
            attacks: true, // Include attacks for existing characters
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

    // Check if brawl already has 2 characters (already accepted)
    if (brawl.characters.length >= 2) {
      return new Response(
        JSON.stringify({ error: 'Challenge has already been accepted' }),
        { status: 409, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Check if the same user is trying to accept their own challenge
    const challengerCharacter = brawl.characters[0];
    if (challengerCharacter.browserId === browserId) {
      return new Response(
        JSON.stringify({ error: 'You cannot accept your own challenge' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Check if the challenger already chose this species
    if (challengerCharacter.species === species) {
      return new Response(
        JSON.stringify({
          error: 'This species has already been chosen by the challenger',
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Generate character stats and attacks using LLM
    console.log(`Generating stats for ${species}...`);
    const generatedStats = await generateCharacterStats(species);

    // Create the second character (challengee) with generated stats
    const characterId = nanoid();
    const newCharacter = await db
      .insert(characters)
      .values({
        id: characterId,
        brawlId: brawl.id,
        browserId: browserId,
        species: species,
        attack: generatedStats.attack,
        defense: generatedStats.defense,
        speed: generatedStats.speed,
        energy: generatedStats.energy,
        recovery: generatedStats.recovery,
        health: generatedStats.health,
        maxHealth: generatedStats.health,
        maxEnergy: generatedStats.energy,
      })
      .returning();

    // Create the character's attacks
    const characterAttacks = generatedStats.attacks.map((attack) => ({
      id: nanoid(),
      characterId: characterId,
      name: attack.name,
      description: attack.description,
      energyCost: attack.energyCost,
      damage: attack.damage,
      criticalHitChance: attack.criticalHitChance,
    }));

    await db.insert(attacks).values(characterAttacks);

    // Now we have both characters, generate the initial fight scene
    const allCharacters = [challengerCharacter, newCharacter[0]];
    try {
      console.log('Generating initial fight scene...');
      await generateInitialFightScene(brawl.id, allCharacters, brawl.location);
      console.log('Initial fight scene generation started');
    } catch (error) {
      console.error('Failed to start initial image generation:', error);
      // Don't fail the join if image generation fails
    }

    // Broadcast the update to all connected clients
    broadcastToFight(slug, {
      type: 'challenge_accepted',
      challenger: {
        ...challengerCharacter,
        attacks: challengerCharacter.attacks || [], // Include attacks if available
      },
      challengee: {
        ...newCharacter[0],
        attacks: characterAttacks.map((attack) => ({
          ...attack,
          id: attack.id || nanoid(), // Ensure attack has an ID
        })),
      },
      brawlReady: true,
    });

    // Store the initial battle event
    await storeBattleEvent(
      brawl.id,
      1,
      'info',
      '⚔️ Battle begins! Choose your move!'
    );

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Challenge accepted successfully!',
        characterId: newCharacter[0].id,
        brawlId: brawl.id,
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Error accepting challenge:', error);
    return new Response(
      JSON.stringify({
        error: 'Failed to accept challenge',
        details: error instanceof Error ? error.message : 'Unknown error',
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
};
