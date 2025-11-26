import { DraftQueue } from '../models/DraftQueue';
import { Player } from '../models/Player';

export interface DraftQueueWithPlayer extends DraftQueue {
  player?: Player;
}

export interface IDraftQueueRepository {
  /**
   * Get all queue entries for a specific roster in a draft
   */
  getQueueForRoster(draftId: number, rosterId: number): Promise<DraftQueueWithPlayer[]>;

  /**
   * Add a player to the end of a roster's queue
   */
  addToQueue(draftId: number, rosterId: number, playerId: number): Promise<DraftQueueWithPlayer>;

  /**
   * Remove a specific queue entry
   */
  removeFromQueue(queueId: number): Promise<void>;

  /**
   * Reorder queue by providing new positions
   * @param updates Array of {id, queuePosition} to update
   */
  reorderQueue(draftId: number, rosterId: number, updates: Array<{id: number, queuePosition: number}>): Promise<void>;

  /**
   * Get the next queued player for a roster (lowest queue_position)
   * Returns null if queue is empty
   */
  getNextQueuedPlayer(draftId: number, rosterId: number): Promise<DraftQueueWithPlayer | null>;

  /**
   * Remove a player from queue after they've been drafted
   */
  removePlayerFromAllQueues(draftId: number, playerId: number): Promise<void>;

  /**
   * Check if a player is in a roster's queue
   */
  isPlayerInQueue(draftId: number, rosterId: number, playerId: number): Promise<boolean>;

  /**
   * Check if a queue entry belongs to a specific roster
   */
  belongsToRoster(queueId: number, rosterId: number, draftId: number): Promise<boolean>;
}
