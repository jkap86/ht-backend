import { IDraftQueueRepository, DraftQueueWithPlayer } from '../../domain/repositories/IDraftQueueRepository';
import { IDraftRepository } from '../../domain/repositories/IDraftRepository';
import { DraftQueue } from '../../domain/models/DraftQueue';
import { ValidationException, NotFoundException } from '../../domain/exceptions/AuthExceptions';

export class DraftQueueService {
  constructor(
    private readonly queueRepository: IDraftQueueRepository,
    private readonly draftRepository: IDraftRepository
  ) {}

  /**
   * Get queue for a specific roster
   */
  async getQueueForRoster(draftId: number, rosterId: number): Promise<DraftQueueWithPlayer[]> {
    return this.queueRepository.getQueueForRoster(draftId, rosterId);
  }

  /**
   * Add a player to a roster's queue
   */
  async addToQueue(draftId: number, rosterId: number, playerId: number): Promise<DraftQueueWithPlayer> {
    // Verify draft exists
    const draft = await this.draftRepository.findById(draftId);
    if (!draft) {
      throw new NotFoundException('Draft not found');
    }

    // Check if player is already in queue
    const inQueue = await this.queueRepository.isPlayerInQueue(draftId, rosterId, playerId);
    if (inQueue) {
      throw new ValidationException('Player is already in your queue');
    }

    // Check if player has already been drafted
    const isAvailable = await this.draftRepository.isPlayerAvailable(draftId, playerId);
    if (!isAvailable) {
      throw new ValidationException('Player has already been drafted');
    }

    return this.queueRepository.addToQueue(draftId, rosterId, playerId);
  }

  /**
   * Remove a player from queue
   */
  async removeFromQueue(queueId: number): Promise<void> {
    return this.queueRepository.removeFromQueue(queueId);
  }

  /**
   * Reorder queue
   */
  async reorderQueue(
    draftId: number,
    rosterId: number,
    updates: Array<{id: number, queuePosition: number}>
  ): Promise<void> {
    // Validate that all IDs belong to this roster's queue
    const currentQueue = await this.queueRepository.getQueueForRoster(draftId, rosterId);
    const validIds = new Set(currentQueue.map(q => q.id));

    for (const update of updates) {
      if (!validIds.has(update.id)) {
        throw new ValidationException(`Invalid queue entry ID: ${update.id}`);
      }
    }

    return this.queueRepository.reorderQueue(draftId, rosterId, updates);
  }

  /**
   * Get next queued player for auto-pick
   */
  async getNextQueuedPlayer(draftId: number, rosterId: number): Promise<DraftQueueWithPlayer | null> {
    const nextQueued = await this.queueRepository.getNextQueuedPlayer(draftId, rosterId);

    if (!nextQueued) {
      return null;
    }

    // Double-check player is still available
    const isAvailable = await this.draftRepository.isPlayerAvailable(draftId, nextQueued.playerId);
    if (!isAvailable) {
      // Player was drafted, remove from queue and try next
      await this.queueRepository.removeFromQueue(nextQueued.id);
      return this.getNextQueuedPlayer(draftId, rosterId); // Recursively get next
    }

    return nextQueued;
  }

  /**
   * Clean up queue after a player is drafted (called by DraftService)
   */
  async removePlayerFromAllQueues(draftId: number, playerId: number): Promise<void> {
    return this.queueRepository.removePlayerFromAllQueues(draftId, playerId);
  }

  /**
   * Check if player is in roster's queue
   */
  async isPlayerInQueue(draftId: number, rosterId: number, playerId: number): Promise<boolean> {
    return this.queueRepository.isPlayerInQueue(draftId, rosterId, playerId);
  }
}
