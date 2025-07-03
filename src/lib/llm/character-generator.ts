import { z } from 'zod';
import { getInstructorClient, isLLMAvailable, isTestEnv } from './client';

// Define the attack schema
const AttackSchema = z.object({
  name: z
    .string()
    .describe(
      'The name of the attack (e.g., "Roar of Dominance", "Lightning Pounce")'
    ),
  description: z
    .string()
    .describe('A brief description of the attack and how it works'),
  energyCost: z
    .number()
    .min(10)
    .max(30)
    .describe('Energy cost to use this attack (10-30)'),
  damage: z
    .number()
    .min(15)
    .max(40)
    .describe('Base damage of the attack (15-40)'),
  criticalHitChance: z
    .number()
    .min(5)
    .max(25)
    .describe('Critical hit percentage (5-25%)'),
});

// Define the character stats schema
const CharacterStatsSchema = z.object({
  attack: z.number().min(1).max(100).describe('Physical attack power (1-100)'),
  defense: z.number().min(1).max(100).describe('Defensive capability (1-100)'),
  speed: z.number().min(1).max(100).describe('Speed and agility (1-100)'),
  health: z.number().min(80).max(120).describe('Health points (80-120)'),
  energy: z.number().min(80).max(120).describe('Energy points (80-120)'),
  recovery: z.number().min(2).max(6).describe('Energy recovery per turn (2-6)'),
  attacks: z
    .array(AttackSchema)
    .length(4)
    .describe('Exactly 4 unique attacks for this character'),
});

export type GeneratedCharacterStats = z.infer<typeof CharacterStatsSchema>;
export type GeneratedAttack = z.infer<typeof AttackSchema>;

/**
 * Generate character stats and attacks based on species using LLM
 */
export async function generateCharacterStats(
  species: string
): Promise<GeneratedCharacterStats> {
  // If in test environment, always use fallback stats (no LLM calls)
  if (isTestEnv()) {
    console.log(
      `Test environment detected, using fallback stats for ${species}`
    );
    return getFallbackStats(species);
  }

  // If no OpenAI API key or instructor is available, use fallback stats
  if (!isLLMAvailable()) {
    console.log(`LLM not available, using fallback stats for ${species}`);
    return getFallbackStats(species);
  }

  const prompt = `Generate realistic combat stats and attacks for a ${species} in a turn-based fighting game.

SPECIES: ${species.toUpperCase()}

REQUIRED OUTPUT FORMAT:
You MUST provide exactly 4 attacks, each with ALL of these fields:
- name: The attack name (e.g., "Savage Claw")
- description: Brief description of the attack (e.g., "Swift claw attack that tears through defenses")
- energyCost: Energy cost (10-30)
- damage: Base damage (15-40)
- criticalHitChance: Critical hit percentage (5-25)

GUIDELINES:
- Stats should reflect the real-world characteristics of a ${species}
- All stats are between 1-100, with most falling between 30-80 for balance
- Health and Energy can be 80-120 for variety
- Recovery should be low (2-6) to make energy management strategic
- Each attack should feel authentic to the species
- Energy costs should vary (10-30) with stronger attacks costing more
- Damage should vary (15-40) with some attacks being stronger
- Critical hit chances should vary (5-25%) based on attack type
- EVERY attack MUST have a description explaining what it does

For a ${species}, consider:
- Physical traits (size, strength, speed, natural weapons)
- Behavioral patterns (aggressive, defensive, cunning)
- Natural abilities (claws, teeth, roar, stealth, etc.)
- Fighting style that would be authentic

Example attack format:
{
  "name": "Lightning Pounce",
  "description": "Swift leap attack that catches enemies off guard",
  "energyCost": 25,
  "damage": 30,
  "criticalHitChance": 18
}

Make the character feel powerful but balanced for competitive gameplay.`;

  try {
    const instructor = getInstructorClient();
    const response = await instructor.chat.completions.create({
      messages: [
        {
          role: 'system',
          content:
            'You are an expert game designer creating balanced character stats for a turn-based fighting game. Focus on authenticity while maintaining competitive balance.',
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      model: 'gpt-4o-mini',
      response_model: {
        schema: CharacterStatsSchema,
        name: 'CharacterStats',
      },
      max_retries: 3,
    });

    // Validate the response
    if (!response.attacks || response.attacks.length !== 4) {
      throw new Error('Invalid response: must have exactly 4 attacks');
    }

    // Validate each attack has all required fields
    for (let i = 0; i < response.attacks.length; i++) {
      const attack = response.attacks[i];
      if (
        !attack.name ||
        !attack.description ||
        typeof attack.energyCost !== 'number' ||
        typeof attack.damage !== 'number' ||
        typeof attack.criticalHitChance !== 'number'
      ) {
        console.error(`Attack ${i} is missing required fields:`, attack);
        throw new Error(
          `Attack ${i} (${attack.name || 'unnamed'}) is missing required fields`
        );
      }
    }

    console.log(`Generated stats for ${species}:`, {
      stats: {
        attack: response.attack,
        defense: response.defense,
        speed: response.speed,
        health: response.health,
        energy: response.energy,
        recovery: response.recovery,
      },
      attacks: response.attacks.map((a: GeneratedAttack) => ({
        name: a.name,
        description: a.description,
        energyCost: a.energyCost,
        damage: a.damage,
        criticalHitChance: a.criticalHitChance,
      })),
    });

    return response;
  } catch (error) {
    console.error('Error generating character stats:', error);

    // Fallback to default stats if LLM fails
    console.log(`Using fallback stats for ${species}`);
    return getFallbackStats(species);
  }
}

/**
 * Fallback stats in case LLM generation fails
 */
function getFallbackStats(species: string): GeneratedCharacterStats {
  const baseStats = {
    lion: {
      attack: 75,
      defense: 60,
      speed: 70,
      health: 100,
      energy: 90,
      recovery: 4,
      attacks: [
        {
          name: 'Roar of Power',
          description: 'A mighty roar that intimidates and damages',
          energyCost: 20,
          damage: 25,
          criticalHitChance: 15,
        },
        {
          name: 'Claw Strike',
          description: 'Swift claw attack',
          energyCost: 15,
          damage: 20,
          criticalHitChance: 10,
        },
        {
          name: 'Pounce Attack',
          description: 'Leap and strike with full force',
          energyCost: 30,
          damage: 35,
          criticalHitChance: 20,
        },
        {
          name: 'Bite',
          description: 'Powerful jaw bite',
          energyCost: 25,
          damage: 30,
          criticalHitChance: 12,
        },
      ],
    },
    tiger: {
      attack: 80,
      defense: 55,
      speed: 85,
      health: 95,
      energy: 95,
      recovery: 5,
      attacks: [
        {
          name: 'Lightning Pounce',
          description: 'Lightning-fast pounce attack',
          energyCost: 25,
          damage: 30,
          criticalHitChance: 18,
        },
        {
          name: 'Claw Swipe',
          description: 'Razor-sharp claw swipe',
          energyCost: 18,
          damage: 22,
          criticalHitChance: 12,
        },
        {
          name: 'Stealth Strike',
          description: 'Attack from the shadows',
          energyCost: 35,
          damage: 38,
          criticalHitChance: 25,
        },
        {
          name: 'Tiger Bite',
          description: 'Crushing bite attack',
          energyCost: 28,
          damage: 32,
          criticalHitChance: 15,
        },
      ],
    },
    bear: {
      attack: 85,
      defense: 80,
      speed: 45,
      health: 120,
      energy: 85,
      recovery: 3,
      attacks: [
        {
          name: 'Bear Hug',
          description: 'Crushing embrace attack',
          energyCost: 30,
          damage: 35,
          criticalHitChance: 10,
        },
        {
          name: 'Claw Slam',
          description: 'Powerful downward claw strike',
          energyCost: 25,
          damage: 30,
          criticalHitChance: 14,
        },
        {
          name: 'Charge',
          description: 'Full-body charging attack',
          energyCost: 40,
          damage: 40,
          criticalHitChance: 8,
        },
        {
          name: 'Swat',
          description: 'Heavy paw swipe',
          energyCost: 20,
          damage: 25,
          criticalHitChance: 12,
        },
      ],
    },
  };

  const stats = baseStats[species as keyof typeof baseStats] || baseStats.lion;
  return stats;
}
