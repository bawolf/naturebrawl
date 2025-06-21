import type { Character } from '../../db/schema';
import type { AttackResult } from '../../game/engine';
import { getSpeciesName } from '../../species';

/**
 * Generate initial fight scene prompt
 */
export function generateInitialScenePrompt(
  characters: Character[],
  location: string
): string {
  const [char1, char2] = characters;

  return `A dynamic 2D fighting game scene in ${location}. Two anthropomorphic creatures face each other in combat stance: a ${char1.species} (left side, full health, energetic pose) and a ${char2.species} (right side, full health, ready to fight). Urban environment background, dramatic lighting, colorful art style similar to Street Fighter or King of Fighters, high quality digital art.`;
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

  let modification = `Modify the current image so that the ${attacker.species} is using "${attackUsed.name}" move. `;

  if (isHit) {
    modification += `The move connects successfully! `;
    if (isCritical) {
      modification += `Amazing critical hit with spectacular effects and bright impact sparks! `;
    }
    modification += `The ${defender.species} is affected by the move. `;

    // Add condition details based on remaining health (using game-friendly terms)
    const healthPercentage = (defender.health / defender.maxHealth) * 100;
    if (healthPercentage <= 25) {
      modification += `The ${defender.species} looks very tired and is breathing heavily, showing signs of fatigue. `;
    } else if (healthPercentage <= 50) {
      modification += `The ${defender.species} appears somewhat tired and is working harder to maintain stance. `;
    } else if (healthPercentage <= 75) {
      modification += `The ${defender.species} looks slightly tired but remains determined and focused. `;
    }
  } else {
    modification += `The move misses! The ${defender.species} successfully dodges or blocks with great agility. `;
  }

  // Add energy state for attacker
  const energyPercentage = (attacker.energy / attacker.maxEnergy) * 100;
  if (energyPercentage <= 30) {
    modification += `The ${attacker.species} appears tired after using the move. `;
  }

  modification += `Colorful cartoon fighting game scene with dynamic poses and action effects. Keep the same background and lighting.`;

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

  return `Victory scene! The ${winnerName} has won the battle and stands triumphantly in the center. A referee (human in black and white striped shirt) is standing next to the ${winnerName} and raising the winner's arm/paw high in the air in classic victory pose. The ${loserName} is sitting/lying down in the background, looking tired but respectful of the victory. Bright celebratory lighting, confetti or sparkles in the air, victory celebration atmosphere. Colorful cartoon fighting game victory screen style, similar to Street Fighter or Mortal Kombat victory poses.`;
}
