import { z } from 'zod';
import type { Character } from '../../db/schema';
import type { AttackResult } from '../../game/engine';
import { getSpeciesName } from '../../species';
import {
  getInstructorClient,
  isLLMAvailable,
  isTestEnv,
} from '../../llm/client';

// Schema for structured LLM responses
const SceneModificationSchema = z.object({
  description: z
    .string()
    .describe(
      'A vivid, detailed description of how the scene should be modified to show the attack result'
    ),
  reasoning: z
    .string()
    .describe(
      'Brief explanation of why this visual representation works well for this attack'
    ),
});

/**
 * Generate LLM-powered attack scene modification prompt
 */
export async function generateAttackSceneModification(
  attackResult: AttackResult,
  attacker: Character,
  defender: Character
): Promise<string> {
  // If in test environment or no LLM available, use fallback
  if (isTestEnv() || !isLLMAvailable()) {
    console.log('Using fallback attack scene modification (no LLM available)');
    return generateFallbackAttackModification(attackResult, attacker, defender);
  }

  const { attackUsed, isCritical, isHit } = attackResult;
  const attackerName = getSpeciesName(attacker.species);
  const defenderName = getSpeciesName(defender.species);

  // Calculate defender's health percentage for context
  const defenderHealthPercent = (defender.health / defender.maxHealth) * 100;
  const healthStatus =
    defenderHealthPercent <= 25
      ? 'critically wounded'
      : defenderHealthPercent <= 50
        ? 'badly injured'
        : defenderHealthPercent <= 75
          ? 'moderately injured'
          : 'mostly healthy';

  const prompt = `You are providing positioning instructions to someone who is creating a fighting game scene.

CURRENT SCENE: Two anthropomorphic creatures in a fighting game scene - a ${attackerName} and a ${defenderName} facing each other.

ATTACK DETAILS:
- Attacker: ${attackerName}
- Defender: ${defenderName}  
- Attack Used: "${attackUsed.name}" (${attackUsed.description || 'a powerful combat move'})
- Attack Hit: ${isHit ? 'YES' : 'NO'}
- Critical Hit: ${isCritical ? 'YES' : 'NO'}
- Defender's Condition: ${healthStatus}

TASK: Tell me exactly what I should see at the moment of maximum impact for this attack. Think of it like freeze-framing a fighting game right when the attack connects (or misses).

I need you to describe the scene like you're directing me to set up action figures:

${
  isHit
    ? `
THE ATTACK CONNECTS - Show me the exact moment of impact:
- Where is the ${attackerName} positioned as they're making contact?
- How is the ${defenderName} reacting physically to being hit?
- Are they mid-fall, being pushed, getting knocked back?
- What does the moment of contact look like?
${isCritical ? `- Since this was a critical hit, what extra visual impact should I show? (sparks, extra force, etc.)` : ''}
`
    : `
THE ATTACK MISSES - Show me how they both look as the attack whiffs:
- Where did the ${attackerName} end up when they missed?
- How did the ${defenderName} avoid it? (stepped back, ducked, moved aside?)
- What positions are they both in now that the attack failed?
`
}

${defenderHealthPercent <= 25 ? `IMPORTANT: The ${defenderName} is badly hurt (${Math.round(defenderHealthPercent)}% health left) - show this in their body position.` : ''}

WRITE LIKE THIS - Simple, direct positioning:
✅ "The lion is on top of the tiger"  
✅ "The tiger fell down"
✅ "The bear is pushed back"
✅ "The lion is standing over the tiger"

NEVER WRITE LIKE THIS - No flowery descriptions:
❌ "chest puffed out, mouth wide open, emitting a powerful roar"
❌ "eyes wide with fear, ears pinned back against its head"  
❌ "feels the shockwave vibrating through its body"
❌ "dramatic lighting casting shadows"
❌ "The spoils of battle are evident"
❌ "causing it to stagger backward, almost losing balance"

GOOD EXAMPLE (simple and direct):
"The lion is now on top of the tiger, jumping onto the tiger aggressively. The tiger is pushed over and fell down and is scared. The lion is on top of him. Maintain the same composition, camera angle, lighting, and background."

TERRIBLE EXAMPLE (way too descriptive - NEVER do this):
"The lion is standing firmly on its hind legs, chest puffed out, and mouth wide open, emitting a powerful roar directed at the tiger. The tiger is leaning backward, eyes wide with fear, its ears pinned back against its head. Its front paws are raised defensively as it feels the shockwave of the roar vibrating through its body, causing it to stagger backward, almost losing balance..."

Show me the freeze-frame moment of this ${attackUsed.name}:`;

  try {
    const instructor = getInstructorClient();
    const response = await instructor.chat.completions.create({
      messages: [
        {
          role: 'system',
          content:
            'You provide simple, direct positioning instructions. Use basic language like "The lion is on top of the tiger" and "The bear fell down". Never use flowery descriptions or emotional language. Keep it extremely simple and concrete.',
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      model: 'gpt-4o-mini',
      response_model: {
        schema: SceneModificationSchema,
        name: 'SceneModification',
      },
      max_retries: 3,
    });

    console.log(`Generated LLM prompt for ${attackUsed.name}:`, {
      description: response.description.substring(0, 100) + '...',
      reasoning: response.reasoning,
    });

    return response.description;
  } catch (error) {
    console.error('Error generating LLM attack scene modification:', error);
    console.log('Falling back to template-based modification');
    return generateFallbackAttackModification(attackResult, attacker, defender);
  }
}

/**
 * Generate LLM-powered victory scene modification prompt
 */
export async function generateVictorySceneModification(
  winner: Character,
  loser: Character
): Promise<string> {
  // If in test environment or no LLM available, use fallback
  if (isTestEnv() || !isLLMAvailable()) {
    console.log('Using fallback victory scene modification (no LLM available)');
    return generateFallbackVictoryModification(winner, loser);
  }

  const winnerName = getSpeciesName(winner.species);
  const loserName = getSpeciesName(loser.species);

  const prompt = `You are creating a victory scene modification prompt for an AI image model (Flux Kontext).

CURRENT SCENE: Two anthropomorphic creatures in a fighting game scene - a ${winnerName} and a ${loserName}.

VICTORY DETAILS:
- Winner: ${winnerName}
- Loser: ${loserName}

REQUIREMENTS:
- Show the ${winnerName} in a triumphant victory pose (arms raised, celebrating)
- Add a referee raising the ${winnerName}'s arm in victory
- Show the ${loserName} defeated, sitting or lying on the ground looking exhausted
- Add celebration effects like confetti or victory sparkles falling
- The scene should clearly communicate that the fight is over and ${winnerName} has won
- End with "Maintain the same composition, lighting, and background."

Generate a vivid description of this victory scene.`;

  try {
    const instructor = getInstructorClient();
    const response = await instructor.chat.completions.create({
      messages: [
        {
          role: 'system',
          content:
            'You are an expert at creating vivid, specific visual descriptions for AI image generation, specializing in victory and celebration scenes.',
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      model: 'gpt-4o-mini',
      response_model: {
        schema: SceneModificationSchema,
        name: 'SceneModification',
      },
      max_retries: 3,
    });

    console.log(`Generated LLM victory prompt for ${winnerName}:`, {
      description: response.description.substring(0, 100) + '...',
    });

    return response.description;
  } catch (error) {
    console.error('Error generating LLM victory scene modification:', error);
    console.log('Falling back to template-based modification');
    return generateFallbackVictoryModification(winner, loser);
  }
}

/**
 * Fallback attack modification (similar to original template-based approach but slightly improved)
 */
function generateFallbackAttackModification(
  attackResult: AttackResult,
  attacker: Character,
  defender: Character
): string {
  const { attackUsed, isCritical, isHit } = attackResult;
  const attackerName = getSpeciesName(attacker.species);
  const defenderName = getSpeciesName(defender.species);

  let modification = `The ${attackerName} is now performing "${attackUsed.name}". `;

  if (isHit) {
    modification += `The ${attackerName} successfully hits the ${defenderName} with impact effects visible. `;
    if (isCritical) {
      modification += `Bright critical hit sparks and energy surround the impact. `;
    }
    modification += `The ${defenderName} reacts to being hit, showing the damage taken. `;
  } else {
    modification += `The ${defenderName} skillfully dodges the attack, avoiding the ${attackerName}'s strike. `;
  }

  // Show damage state if significant
  const defenderHealthPercent = (defender.health / defender.maxHealth) * 100;
  if (defenderHealthPercent <= 25) {
    modification += `The ${defenderName} looks battle-worn and struggling. `;
  }

  modification += `Maintain the same composition, camera angle, lighting, and background.`;

  return modification;
}

/**
 * Fallback victory modification
 */
function generateFallbackVictoryModification(
  winner: Character,
  loser: Character
): string {
  const winnerName = getSpeciesName(winner.species);
  const loserName = getSpeciesName(loser.species);

  return `The ${winnerName} is now in a victory pose with arms raised in triumph. A referee is raising the ${winnerName}'s arm to declare victory. The ${loserName} is sitting on the ground looking defeated and exhausted. Confetti and victory sparkles are falling from above. Maintain the same composition, lighting, and background.`;
}
