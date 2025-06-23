import type { Character } from '../../db/schema';
import type { AttackResult } from '../../game/engine';
import { getSpeciesName } from '../../species';

const background = `The background is a San Francisco style fighting game background, dramatic lighting, colorful art style similar to Street Fighter or King of Fighters, high quality digital art.`;

/**
 * Generate initial fight scene prompt
 */
export function generateInitialScenePrompt(
  characters: Character[],
  location: string
): string {
  const [char1, char2] = characters;
  const char1Name = getSpeciesName(char1.species);
  const char2Name = getSpeciesName(char2.species);

  return `A dynamic 2D fighting game scene in ${location}. Two anthropomorphic creatures face each other in combat stance: a ${char1Name} on the left side with full health in an energetic ready pose, and a ${char2Name} on the right side with full health in a defensive fighting stance. Both characters should be clearly visible and well-positioned. ${background}`;
}

/**
 * Build modification prompt for attack scene
 */
export function buildAttackModification(
  attackResult: AttackResult,
  attacker: Character,
  defender: Character
): string {
  const { attackUsed, damage, isCritical, isHit } = attackResult;
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
 */
export function buildVictoryModification(
  winner: Character,
  loser: Character
): string {
  const winnerName = getSpeciesName(winner.species);
  const loserName = getSpeciesName(loser.species);

  return `Change the ${winnerName} to a victory pose with arms raised. Add a referee raising the ${winnerName}'s arm. Change the ${loserName} to sit on the ground looking defeated. Add confetti falling. Maintain the same composition, lighting, and background.`;
}
