import type { APIRoute } from 'astro';
import { db, brawls, characters, attacks } from '../../../lib/db';
import { nanoid } from 'nanoid';
import { isValidSpecies } from '../../../lib/species';
import { generateCharacterStats } from '../../../lib/llm/character-generator';
import { eq } from 'drizzle-orm';

export const prerender = false;

export const POST: APIRoute = async ({ request }) => {
  try {
    // Check if request has body
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

    const { species, browserId } = body;

    // Validate input
    if (!species || !browserId) {
      return new Response(
        JSON.stringify({ error: 'Species and browserId are required' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    if (!isValidSpecies(species)) {
      return new Response(JSON.stringify({ error: 'Invalid species' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Generate a unique slug for the brawl
    const slug = nanoid(8); // Short, URL-safe ID

    // Create the brawl
    const [brawl] = await db
      .insert(brawls)
      .values({
        slug,
        turnNumber: 1,
      })
      .returning();

    // Generate character stats and attacks using LLM
    console.log(`Generating stats for ${species}...`);
    const generatedStats = await generateCharacterStats(species);

    // Create the character for the challenger with generated stats
    const [character] = await db
      .insert(characters)
      .values({
        brawlId: brawl.id,
        browserId,
        species,
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
      characterId: character.id,
      name: attack.name,
      description: attack.description,
      energyCost: attack.energyCost,
      damage: attack.damage,
      criticalHitChance: attack.criticalHitChance,
    }));

    await db.insert(attacks).values(characterAttacks);

    // Update the brawl to set the current player
    await db
      .update(brawls)
      .set({
        currentPlayerId: character.id,
      })
      .where(eq(brawls.id, brawl.id));

    // Note: Initial image generation will happen when the second player joins
    // since we need both characters to create the initial scene

    return new Response(
      JSON.stringify({
        success: true,
        slug: brawl.slug,
        brawlId: brawl.id,
        characterId: character.id,
      }),
      {
        status: 201,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Error creating brawl:', error);
    return new Response(
      JSON.stringify({
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error',
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
