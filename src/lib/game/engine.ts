import type {
  Brawl as DbBrawl,
  Character as DbCharacter,
  Attack as DbAttack,
} from '../db/schema';

// Re-exporting and extending types for game logic
export type Attack = DbAttack;
export type Character = DbCharacter & { attacks: Attack[] };
export type Brawl = DbBrawl & { characters: Character[] };

export interface GameState {
  brawl: Brawl;
  currentTurn: number;
  gamePhase: 'waiting' | 'active' | 'finished';
  winner?: string;
}

export interface AttackResult {
  attackerId: string;
  defenderId: string;
  attackUsed: Attack;
  damage: number;
  isCritical: boolean;
  isHit: boolean;
  defenderHealthBefore: number;
  defenderHealthAfter: number;
  attackerEnergyBefore: number;
  attackerEnergyAfter: number;
  gameOver: boolean;
  winner?: string;
}

export interface TurnAction {
  type: 'attack';
  characterId: string;
  attackId: string;
}

/**
 * Core game engine for Nature Brawl
 */
export class GameEngine {
  private gameState: GameState;

  constructor(gameState: GameState) {
    this.gameState = gameState;
  }

  /**
   * Get the current game state
   */
  getGameState(): GameState {
    return { ...this.gameState };
  }

  /**
   * Get the character whose turn it is
   */
  getCurrentPlayer(): (Character & { attacks: Attack[] }) | null {
    if (this.gameState.gamePhase !== 'active') {
      return null;
    }

    const currentPlayerId = this.gameState.brawl.currentPlayerId;
    return (
      this.gameState.brawl.characters.find((c) => c.id === currentPlayerId) ||
      null
    );
  }

  /**
   * Get the opponent of the current player
   */
  getOpponent(): (Character & { attacks: Attack[] }) | null {
    const currentPlayer = this.getCurrentPlayer();
    if (!currentPlayer) return null;

    return (
      this.gameState.brawl.characters.find((c) => c.id !== currentPlayer.id) ||
      null
    );
  }

  /**
   * Check if a character can use a specific attack
   */
  canUseAttack(
    characterId: string,
    attackId: string
  ): { canUse: boolean; reason?: string } {
    const character = this.gameState.brawl.characters.find(
      (c) => c.id === characterId
    );
    if (!character) {
      return { canUse: false, reason: 'Character not found' };
    }

    const attack = character.attacks.find((a) => a.id === attackId);
    if (!attack) {
      return { canUse: false, reason: 'Attack not found' };
    }

    if (character.energy < attack.energyCost) {
      return { canUse: false, reason: 'Not enough energy' };
    }

    if (character.health <= 0) {
      return { canUse: false, reason: 'Character is defeated' };
    }

    if (this.gameState.gamePhase !== 'active') {
      return { canUse: false, reason: 'Game not active' };
    }

    if (this.gameState.brawl.currentPlayerId !== characterId) {
      return { canUse: false, reason: 'Not your turn' };
    }

    return { canUse: true };
  }

  /**
   * Execute an attack and return the result
   */
  executeAttack(attackerId: string, attackId: string): AttackResult {
    const attacker = this.gameState.brawl.characters.find(
      (c) => c.id === attackerId
    );
    const defender = this.gameState.brawl.characters.find(
      (c) => c.id !== attackerId
    );

    if (!attacker || !defender) {
      throw new Error('Invalid attacker or defender');
    }

    const attack = attacker.attacks.find((a) => a.id === attackId);
    if (!attack) {
      throw new Error('Attack not found');
    }

    // Validate the attack can be used
    const validation = this.canUseAttack(attackerId, attackId);
    if (!validation.canUse) {
      throw new Error(validation.reason || 'Cannot use attack');
    }

    // Store initial states
    const defenderHealthBefore = defender.health;
    const attackerEnergyBefore = attacker.energy;

    // Calculate hit chance (base 85% + speed difference bonus)
    const speedDifference = attacker.speed - defender.speed;
    const hitChance = Math.max(60, Math.min(95, 85 + speedDifference * 0.5));
    const isHit = Math.random() * 100 < hitChance;

    let damage = 0;
    let isCritical = false;

    if (isHit) {
      // Calculate base damage
      const attackPower = attack.damage;
      const attackerBonus = attacker.attack * 0.1; // 10% of attack stat
      const baseDamage = attackPower + attackerBonus;

      // Apply defense reduction
      const defenseReduction = defender.defense * 0.08; // 8% of defense stat
      damage = Math.max(1, Math.round(baseDamage - defenseReduction));

      // Check for critical hit
      isCritical = Math.random() * 100 < attack.criticalHitChance;
      if (isCritical) {
        damage = Math.round(damage * 2);
      }

      // Apply damage
      defender.health = Math.max(0, defender.health - damage);
    }

    // Consume energy
    attacker.energy = Math.max(0, attacker.energy - attack.energyCost);

    // Check if game is over
    const gameOver = defender.health <= 0;
    let winner: string | undefined;

    if (gameOver) {
      winner = attacker.id;
      this.gameState.gamePhase = 'finished';
      this.gameState.winner = winner;
      this.gameState.brawl.winnerId = winner;
    } else {
      // Switch turns (energy recovery happens in switchTurn)
      this.switchTurn();
      // Increment turn counter
      this.gameState.currentTurn++;
      this.gameState.brawl.turnNumber = this.gameState.currentTurn;
    }

    return {
      attackerId,
      defenderId: defender.id,
      attackUsed: attack,
      damage,
      isCritical,
      isHit,
      defenderHealthBefore,
      defenderHealthAfter: defender.health,
      attackerEnergyBefore,
      attackerEnergyAfter: attacker.energy,
      gameOver,
      winner,
    };
  }

  /**
   * Switch to the next player's turn and recover energy
   */
  private switchTurn(): void {
    const currentPlayer = this.getCurrentPlayer();
    const opponent = this.getOpponent();

    if (!currentPlayer || !opponent) return;

    // Switch current player first
    this.gameState.brawl.currentPlayerId = opponent.id;

    // Then recover energy for the NEW current player (start of their turn)
    opponent.energy = Math.min(
      opponent.maxEnergy,
      opponent.energy + opponent.recovery
    );
  }

  /**
   * Get available attacks for a character (ones they have enough energy for)
   */
  getAvailableAttacks(characterId: string): Attack[] {
    const character = this.gameState.brawl.characters.find(
      (c) => c.id === characterId
    );
    if (!character) return [];

    return character.attacks.filter(
      (attack) => character.energy >= attack.energyCost
    );
  }

  /**
   * Get battle summary for display
   */
  getBattleSummary(): {
    player1: Character & { attacks: Attack[] };
    player2: Character & { attacks: Attack[] };
    currentPlayer: string | null;
    gamePhase: string;
    turnNumber: number;
    winner?: string;
  } {
    const [player1, player2] = this.gameState.brawl.characters;

    return {
      player1,
      player2,
      currentPlayer: this.gameState.brawl.currentPlayerId,
      gamePhase: this.gameState.gamePhase,
      turnNumber: this.gameState.currentTurn,
      winner: this.gameState.winner,
    };
  }
}

/**
 * Create a new game engine from a brawl
 */
export function createGameEngine(brawl: Brawl): GameEngine {
  let gamePhase: 'waiting' | 'active' | 'finished' = 'waiting';
  if (brawl.winnerId) {
    gamePhase = 'finished';
  } else if (brawl.characters.length === 2) {
    gamePhase = 'active';
  }

  const gameState: GameState = {
    brawl,
    currentTurn: brawl.turnNumber,
    gamePhase,
    winner: brawl.winnerId || undefined,
  };

  return new GameEngine(gameState);
}
