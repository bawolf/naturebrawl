/**
 * Template-based prompt generation (Legacy)
 *
 * This file contains the original template-based prompt generation functions.
 * For better, more vivid prompts, use the LLM-based functions in llm-prompts.ts.
 * These functions are kept as fallbacks when OpenAI is not available.
 */

import type { Character } from '../../db/schema';
import type { AttackResult } from '../../game/engine';
import { getSpeciesName } from '../../species';

const background = `The background is a San Francisco style fighting game background, dramatic lighting, colorful art style similar to Street Fighter or King of Fighters, high quality digital art.`;

/**
 * Generate initial fight scene prompt
 * Note: characters[0] is always the challenger, characters[1] is always the challengee
 * We establish consistent positioning: challenger on LEFT, challengee on RIGHT
 */
export function generateInitialScenePrompt(
  characters: Character[],
  location: string
): string {
  const [challenger, challengee] = characters;
  const challengerName = getSpeciesName(challenger.species);
  const challengeeName = getSpeciesName(challengee.species);

  return `A dynamic 2D fighting game scene in ${location}. Two creatures face each other in combat stance: a ${challengerName} on the left side with full health in an energetic ready pose (this is the CHALLENGER), and a ${challengeeName} on the right side with full health in a defensive fighting stance (this is the CHALLENGEE). Both characters should be clearly visible and well-positioned with the challenger always on the left and challengee always on the right. ${background}. there should not be health bars, or UI elements, no game interfaces, no text overlays.`;
}

/**
 * Build modification prompt for attack scene
 * @deprecated Use generateAttackSceneModification from llm-prompts.ts for better, LLM-generated prompts
 * This function is kept as a fallback when LLM is not available
 */
export function buildAttackModification(
  attackResult: AttackResult,
  attacker: Character,
  defender: Character
): string {
  const { attackUsed, isCritical, isHit } = attackResult;
  const attackerName = getSpeciesName(attacker.species);
  const defenderName = getSpeciesName(defender.species);

  let modification = `Change the ${attackerName} to be attack like "${attackUsed.name}"`;

  if (isHit) {
    modification += `Add impact effects where the ${attackerName} hits the ${defenderName}. `;
    if (isCritical) {
      modification += `Add bright critical hit sparks. `;
    }
  } else {
    modification += `Show the ${defenderName} dodging the attack. `;
  }

  // Show damage state if significant
  const defenderHealthPercent = (defender.health / defender.maxHealth) * 100;
  if (defenderHealthPercent <= 25) {
    modification += `Make the ${defenderName} look battle-worn. `;
  }

  modification += `Maintain the same composition, camera angle, lighting, and background.`;

  return modification;
}

/**
 * Generate victory scene modification prompt
 * @deprecated Use generateVictorySceneModification from llm-prompts.ts for better, LLM-generated prompts
 * This function is kept as a fallback when LLM is not available
 */
export function buildVictoryModification(
  winner: Character,
  loser: Character
): string {
  const winnerName = getSpeciesName(winner.species);
  const loserName = getSpeciesName(loser.species);

  return `Change the ${winnerName} to a victory pose with arms raised. Add a referee raising the ${winnerName}'s arm. Change the ${loserName} to sit on the ground looking defeated. Add confetti falling. Maintain the same composition, lighting, and background.`;
}
