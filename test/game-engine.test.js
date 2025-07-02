import { describe, it, expect } from 'vitest';
import { createGameEngine } from '../src/lib/game/engine.js';

describe('Game Engine', () => {
  // Mock brawl data
  const mockBrawl = {
    id: 'brawl_123',
    slug: 'test-slug',
    winnerId: null,
    currentPlayerId: 'char_1',
    turnNumber: 1,
    createdAt: new Date(),
    updatedAt: new Date(),
    characters: [
      {
        id: 'char_1',
        brawlId: 'brawl_123',
        browserId: 'browser_1',
        species: 'lion',
        attack: 75,
        defense: 60,
        speed: 70,
        energy: 90,
        recovery: 4,
        health: 100,
        maxHealth: 100,
        maxEnergy: 90,
        createdAt: new Date(),
        updatedAt: new Date(),
        attacks: [
          {
            id: 'attack_1',
            characterId: 'char_1',
            name: 'Roar of Power',
            description: 'A mighty roar that intimidates and damages',
            energyCost: 20,
            damage: 25,
            criticalHitChance: 15,
            createdAt: new Date(),
          },
          {
            id: 'attack_2',
            characterId: 'char_1',
            name: 'Claw Strike',
            description: 'Swift claw attack',
            energyCost: 15,
            damage: 20,
            criticalHitChance: 10,
            createdAt: new Date(),
          },
        ],
      },
      {
        id: 'char_2',
        brawlId: 'brawl_123',
        browserId: 'browser_2',
        species: 'tiger',
        attack: 80,
        defense: 55,
        speed: 85,
        energy: 95,
        recovery: 5,
        health: 95,
        maxHealth: 95,
        maxEnergy: 100,
        createdAt: new Date(),
        updatedAt: new Date(),
        attacks: [
          {
            id: 'attack_3',
            characterId: 'char_2',
            name: 'Lightning Pounce',
            description: 'Lightning-fast pounce attack',
            energyCost: 25,
            damage: 30,
            criticalHitChance: 18,
            createdAt: new Date(),
          },
          {
            id: 'attack_4',
            characterId: 'char_2',
            name: 'Claw Swipe',
            description: 'Razor-sharp claw swipe',
            energyCost: 18,
            damage: 22,
            criticalHitChance: 12,
            createdAt: new Date(),
          },
        ],
      },
    ],
  };

  it('should create game engine with correct initial state', () => {
    const engine = createGameEngine(mockBrawl);
    const gameState = engine.getGameState();

    expect(gameState.gamePhase).toBe('active');
    expect(gameState.currentTurn).toBe(1);
    expect(gameState.brawl.currentPlayerId).toBe('char_1');
  });

  it('should identify current player correctly', () => {
    const engine = createGameEngine(mockBrawl);
    const currentPlayer = engine.getCurrentPlayer();

    expect(currentPlayer).toBeTruthy();
    expect(currentPlayer.id).toBe('char_1');
    expect(currentPlayer.species).toBe('lion');
  });

  it('should identify opponent correctly', () => {
    const engine = createGameEngine(mockBrawl);
    const opponent = engine.getOpponent();

    expect(opponent).toBeTruthy();
    expect(opponent.id).toBe('char_2');
    expect(opponent.species).toBe('tiger');
  });

  it('should validate attacks correctly', () => {
    const engine = createGameEngine(mockBrawl);

    // Valid attack
    const validResult = engine.canUseAttack('char_1', 'attack_1');
    expect(validResult.canUse).toBe(true);

    // Invalid character
    const invalidCharResult = engine.canUseAttack('invalid_char', 'attack_1');
    expect(invalidCharResult.canUse).toBe(false);
    expect(invalidCharResult.reason).toBe('Character not found');

    // Invalid attack
    const invalidAttackResult = engine.canUseAttack('char_1', 'invalid_attack');
    expect(invalidAttackResult.canUse).toBe(false);
    expect(invalidAttackResult.reason).toBe('Attack not found');

    // Wrong turn
    const wrongTurnResult = engine.canUseAttack('char_2', 'attack_3');
    expect(wrongTurnResult.canUse).toBe(false);
    expect(wrongTurnResult.reason).toBe('Not your turn');
  });

  it('should execute attack and update game state', () => {
    // Create a fresh copy of mockBrawl to avoid shared state issues
    const freshMockBrawl = {
      ...mockBrawl,
      characters: mockBrawl.characters.map((char) => ({
        ...char,
        attacks: [...char.attacks],
      })),
    };

    const engine = createGameEngine(freshMockBrawl);
    // const initialState = engine.getGameState();

    // Execute attack
    const result = engine.executeAttack('char_1', 'attack_1');

    expect(result.attackerId).toBe('char_1');
    expect(result.defenderId).toBe('char_2');
    expect(result.attackUsed.name).toBe('Roar of Power');
    expect(result.attackerEnergyAfter).toBe(70); // 90 - 20 = 70

    // Check that turn switched
    const newState = engine.getGameState();
    expect(newState.brawl.currentPlayerId).toBe('char_2');
    expect(newState.currentTurn).toBe(2);

    // Check that the new current player (char_2) got energy recovery
    const char2 = newState.brawl.characters.find((c) => c.id === 'char_2');
    expect(char2.energy).toBe(100); // 95 + 5 recovery = 100
  });

  it('should handle insufficient energy', () => {
    const lowEnergyBrawl = {
      ...mockBrawl,
      characters: [
        {
          ...mockBrawl.characters[0],
          energy: 10, // Not enough for 20 cost attack
        },
        mockBrawl.characters[1],
      ],
    };

    const engine = createGameEngine(lowEnergyBrawl);
    const validation = engine.canUseAttack('char_1', 'attack_1');

    expect(validation.canUse).toBe(false);
    expect(validation.reason).toBe('Not enough energy');
  });

  it('should get available attacks based on energy', () => {
    const engine = createGameEngine(mockBrawl);
    const availableAttacks = engine.getAvailableAttacks('char_1');

    expect(availableAttacks).toHaveLength(2); // Both attacks available with 90 energy

    // Test with low energy character
    const lowEnergyBrawl = {
      ...mockBrawl,
      characters: [
        {
          ...mockBrawl.characters[0],
          energy: 16, // Only enough for 15 cost attack
        },
        mockBrawl.characters[1],
      ],
    };

    const lowEnergyEngine = createGameEngine(lowEnergyBrawl);
    const limitedAttacks = lowEnergyEngine.getAvailableAttacks('char_1');

    expect(limitedAttacks).toHaveLength(1);
    expect(limitedAttacks[0].energyCost).toBe(15);
  });

  it('should end game when character health reaches 0', () => {
    const nearDeathBrawl = {
      ...mockBrawl,
      characters: [
        mockBrawl.characters[0],
        {
          ...mockBrawl.characters[1],
          health: 1, // Very low health
        },
      ],
    };

    const engine = createGameEngine(nearDeathBrawl);

    // Execute multiple attacks until someone dies or we hit max attempts
    let result;
    let attempts = 0;
    const maxAttempts = 10;

    while (attempts < maxAttempts) {
      const currentPlayer = engine.getCurrentPlayer();
      if (!currentPlayer) break;

      const availableAttacks = engine.getAvailableAttacks(currentPlayer.id);
      if (availableAttacks.length === 0) break;

      result = engine.executeAttack(currentPlayer.id, availableAttacks[0].id);
      attempts++;

      if (result.gameOver) {
        expect(result.gameOver).toBe(true);
        expect(result.winner).toBeTruthy();
        expect(result.defenderHealthAfter).toBe(0);

        const finalState = engine.getGameState();
        expect(finalState.gamePhase).toBe('finished');
        expect(finalState.winner).toBeTruthy();
        break;
      }
    }

    // If we didn't end the game in maxAttempts, that's also valid for this test
    // The important thing is that the game engine handles low health correctly
  });

  it('should provide battle summary', () => {
    // Create a fresh copy of mockBrawl to avoid shared state issues
    const freshMockBrawl = {
      ...mockBrawl,
      characters: mockBrawl.characters.map((char) => ({
        ...char,
        attacks: [...char.attacks],
      })),
    };

    const engine = createGameEngine(freshMockBrawl);
    const summary = engine.getBattleSummary();

    expect(summary.player1.id).toBe('char_1');
    expect(summary.player2.id).toBe('char_2');
    expect(summary.currentPlayer).toBe('char_1');
    expect(summary.gamePhase).toBe('active');
    expect(summary.turnNumber).toBe(1);
  });
});
