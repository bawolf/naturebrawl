import { db, battleEvents } from './index';

/**
 * Store a battle event in the database
 */
export async function storeBattleEvent(
  brawlId: string,
  turnNumber: number,
  eventType: 'info' | 'attack' | 'miss' | 'victory' | 'error' | 'warning',
  message: string
): Promise<void> {
  try {
    await db.insert(battleEvents).values({
      brawlId,
      turnNumber,
      eventType,
      message,
    });
  } catch (error) {
    console.error('Error storing battle event:', error);
    // Don't throw - we don't want to fail the game logic if event storage fails
  }
}
