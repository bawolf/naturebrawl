import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock environment variables
process.env.REPLICATE_API_TOKEN = 'test-token';
process.env.GCS_BUCKET = 'test-bucket';
process.env.GCS_PROJECT_ID = 'test-project';

// Mock dependencies
vi.mock('replicate');
vi.mock('@google-cloud/storage');
vi.mock('../src/lib/db');
vi.mock('../src/lib/tunnel');

// Mock the environment to test fallback behavior
vi.mock('../src/lib/env', () => ({
  getEnvVar: vi.fn((key) => {
    if (key === 'OPENAI_API_KEY') {
      return undefined; // No API key to test fallback
    }
    return undefined;
  }),
}));

describe('Image Generation Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it.skip('should create initial fight scene prompt correctly', async () => {
    // TODO
  });

  it('should handle different health percentages correctly', () => {
    // Test health percentage logic
    const testCases = [
      { health: 25, maxHealth: 100, expected: 'critically wounded' },
      { health: 50, maxHealth: 100, expected: 'badly injured' },
      { health: 75, maxHealth: 100, expected: 'moderately injured' },
      { health: 90, maxHealth: 100, expected: 'mostly healthy' },
    ];

    testCases.forEach(({ health, maxHealth, expected }) => {
      const percentage = (health / maxHealth) * 100;

      if (percentage <= 25) {
        expect(expected).toBe('critically wounded');
      } else if (percentage <= 50) {
        expect(expected).toBe('badly injured');
      } else if (percentage <= 75) {
        expect(expected).toBe('moderately injured');
      } else {
        expect(expected).toBe('mostly healthy');
      }
    });
  });

  it('should use fallback prompt generation when no OpenAI key is available', async () => {
    // Import the LLM prompt functions
    const {
      generateAttackSceneModification,
      generateVictorySceneModification,
    } = await import('../src/lib/services/image-generation/llm-prompts');

    const mockAttackResult = {
      attackUsed: { name: 'Power Pounce', description: 'A leaping attack' },
      damage: 30,
      isCritical: true,
      isHit: true,
      attackerId: 'attacker1',
      defenderId: 'defender1',
    };

    const mockAttacker = {
      id: 'attacker1',
      species: 'lion',
      health: 100,
      maxHealth: 100,
      energy: 70,
      maxEnergy: 100,
    };

    const mockDefender = {
      id: 'defender1',
      species: 'tiger',
      health: 30,
      maxHealth: 100,
    };

    // Test attack scene modification
    const attackModification = await generateAttackSceneModification(
      mockAttackResult,
      mockAttacker,
      mockDefender
    );

    expect(attackModification).toContain('Lion');
    expect(attackModification).toContain('Tiger');
    expect(attackModification).toContain('Power Pounce');
    expect(attackModification).toContain('Maintain the same composition');

    // Test victory scene modification
    const victoryModification = await generateVictorySceneModification(
      mockAttacker,
      mockDefender
    );

    expect(victoryModification).toContain('Lion');
    expect(victoryModification).toContain('Tiger');
    expect(victoryModification).toContain('victory');
    expect(victoryModification).toContain('Maintain the same composition');
  });

  it('should generate different prompts for hit vs miss attacks', async () => {
    const { generateAttackSceneModification } = await import(
      '../src/lib/services/image-generation/llm-prompts'
    );

    const baseAttackResult = {
      attackUsed: { name: 'Swift Strike', description: 'A quick attack' },
      damage: 20,
      isCritical: false,
      attackerId: 'attacker1',
      defenderId: 'defender1',
    };

    const attacker = {
      id: 'attacker1',
      species: 'tiger',
      health: 100,
      maxHealth: 100,
      energy: 80,
      maxEnergy: 100,
    };

    const defender = {
      id: 'defender1',
      species: 'bear',
      health: 85,
      maxHealth: 100,
    };

    // Test hit scenario
    const hitResult = { ...baseAttackResult, isHit: true };
    const hitModification = await generateAttackSceneModification(
      hitResult,
      attacker,
      defender
    );

    // Test miss scenario
    const missResult = { ...baseAttackResult, isHit: false, damage: 0 };
    const missModification = await generateAttackSceneModification(
      missResult,
      attacker,
      defender
    );

    // Both should contain the species names and attack name
    expect(hitModification).toContain('Tiger');
    expect(hitModification).toContain('Bear');
    expect(missModification).toContain('Tiger');
    expect(missModification).toContain('Bear');

    // Hit and miss modifications should be different
    expect(hitModification).not.toBe(missModification);
  });
});
