import { Pool } from 'pg';
import { IDraftQueueRepository, DraftQueueWithPlayer } from '../../domain/repositories/IDraftQueueRepository';
import { DraftQueue } from '../../domain/models/DraftQueue';
import { Player } from '../../domain/models/Player';

export class DraftQueueRepository implements IDraftQueueRepository {
  constructor(private readonly db: Pool) {}

  async getQueueForRoster(draftId: number, rosterId: number): Promise<DraftQueueWithPlayer[]> {
    const result = await this.db.query(
      `SELECT
        dq.id,
        dq.draft_id,
        dq.roster_id,
        dq.player_id,
        dq.queue_position,
        dq.created_at,
        p.id as p_id,
        p.sleeper_id,
        p.first_name,
        p.last_name,
        p.full_name,
        p.fantasy_positions,
        p.position,
        p.team,
        p.years_exp,
        p.age,
        p.active,
        p.status,
        p.injury_status,
        p.injury_notes,
        p.depth_chart_position,
        p.jersey_number,
        p.height,
        p.weight,
        p.college
      FROM draft_queues dq
      LEFT JOIN players p ON p.id = dq.player_id
      WHERE dq.draft_id = $1 AND dq.roster_id = $2
      ORDER BY dq.queue_position ASC`,
      [draftId, rosterId]
    );

    return result.rows.map(row => {
      const queue = DraftQueue.fromDatabase(row);
      const player = row.p_id ? Player.fromDatabase({ ...row, id: row.p_id }) : undefined;
      return { ...queue, player };
    });
  }

  async addToQueue(draftId: number, rosterId: number, playerId: number): Promise<DraftQueueWithPlayer> {
    // Get the next available position
    const positionResult = await this.db.query(
      `SELECT COALESCE(MAX(queue_position), 0) + 1 as next_position
       FROM draft_queues
       WHERE draft_id = $1 AND roster_id = $2`,
      [draftId, rosterId]
    );

    const nextPosition = positionResult.rows[0].next_position;

    // Insert the new queue entry
    await this.db.query(
      `INSERT INTO draft_queues (draft_id, roster_id, player_id, queue_position)
       VALUES ($1, $2, $3, $4)`,
      [draftId, rosterId, playerId, nextPosition]
    );

    // Fetch the complete entry with player info
    const result = await this.db.query(
      `SELECT
        dq.id,
        dq.draft_id,
        dq.roster_id,
        dq.player_id,
        dq.queue_position,
        dq.created_at,
        p.id as p_id,
        p.sleeper_id,
        p.first_name,
        p.last_name,
        p.full_name,
        p.fantasy_positions,
        p.position,
        p.team,
        p.years_exp,
        p.age,
        p.active,
        p.status,
        p.injury_status,
        p.injury_notes,
        p.depth_chart_position,
        p.jersey_number,
        p.height,
        p.weight,
        p.college
      FROM draft_queues dq
      LEFT JOIN players p ON p.id = dq.player_id
      WHERE dq.draft_id = $1 AND dq.roster_id = $2 AND dq.player_id = $3`,
      [draftId, rosterId, playerId]
    );

    const row = result.rows[0];
    const queue = DraftQueue.fromDatabase(row);
    const player = row.p_id ? Player.fromDatabase({ ...row, id: row.p_id }) : undefined;
    return { ...queue, player };
  }

  async removeFromQueue(queueId: number): Promise<void> {
    // Get the queue entry to know its position
    const queueEntry = await this.db.query(
      'SELECT draft_id, roster_id, queue_position FROM draft_queues WHERE id = $1',
      [queueId]
    );

    if (queueEntry.rows.length === 0) {
      return; // Already deleted
    }

    const { draft_id, roster_id, queue_position } = queueEntry.rows[0];

    // Delete the entry
    await this.db.query('DELETE FROM draft_queues WHERE id = $1', [queueId]);

    // Reorder remaining items to fill the gap
    await this.db.query(
      `UPDATE draft_queues
       SET queue_position = queue_position - 1
       WHERE draft_id = $1 AND roster_id = $2 AND queue_position > $3`,
      [draft_id, roster_id, queue_position]
    );
  }

  async reorderQueue(
    draftId: number,
    rosterId: number,
    updates: Array<{id: number, queuePosition: number}>
  ): Promise<void> {
    // Use a transaction to ensure all updates happen atomically
    const client = await this.db.connect();
    try {
      await client.query('BEGIN');

      // Update each queue entry
      for (const update of updates) {
        await client.query(
          `UPDATE draft_queues
           SET queue_position = $1
           WHERE id = $2 AND draft_id = $3 AND roster_id = $4`,
          [update.queuePosition, update.id, draftId, rosterId]
        );
      }

      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async getNextQueuedPlayer(draftId: number, rosterId: number): Promise<DraftQueueWithPlayer | null> {
    const result = await this.db.query(
      `SELECT
        dq.id,
        dq.draft_id,
        dq.roster_id,
        dq.player_id,
        dq.queue_position,
        dq.created_at,
        p.id as p_id,
        p.sleeper_id,
        p.first_name,
        p.last_name,
        p.full_name,
        p.fantasy_positions,
        p.position,
        p.team,
        p.years_exp,
        p.age,
        p.active,
        p.status,
        p.injury_status,
        p.injury_notes,
        p.depth_chart_position,
        p.jersey_number,
        p.height,
        p.weight,
        p.college
      FROM draft_queues dq
      LEFT JOIN players p ON p.id = dq.player_id
      WHERE dq.draft_id = $1 AND dq.roster_id = $2
      ORDER BY dq.queue_position ASC
      LIMIT 1`,
      [draftId, rosterId]
    );

    if (result.rows.length === 0) {
      return null;
    }

    const row = result.rows[0];
    const queue = DraftQueue.fromDatabase(row);
    const player = row.p_id ? Player.fromDatabase({ ...row, id: row.p_id }) : undefined;
    return { ...queue, player };
  }

  async removePlayerFromAllQueues(draftId: number, playerId: number): Promise<void> {
    // Get all rosters affected
    const affected = await this.db.query(
      `SELECT DISTINCT roster_id FROM draft_queues
       WHERE draft_id = $1 AND player_id = $2`,
      [draftId, playerId]
    );

    // Delete all entries for this player
    await this.db.query(
      'DELETE FROM draft_queues WHERE draft_id = $1 AND player_id = $2',
      [draftId, playerId]
    );

    // Reorder each affected roster's queue
    for (const row of affected.rows) {
      const rosterId = row.roster_id;

      // Get all remaining entries for this roster
      const remaining = await this.db.query(
        `SELECT id FROM draft_queues
         WHERE draft_id = $1 AND roster_id = $2
         ORDER BY queue_position ASC`,
        [draftId, rosterId]
      );

      // Reassign positions sequentially
      for (let i = 0; i < remaining.rows.length; i++) {
        await this.db.query(
          'UPDATE draft_queues SET queue_position = $1 WHERE id = $2',
          [i + 1, remaining.rows[i].id]
        );
      }
    }
  }

  async isPlayerInQueue(draftId: number, rosterId: number, playerId: number): Promise<boolean> {
    const result = await this.db.query(
      `SELECT 1 FROM draft_queues
       WHERE draft_id = $1 AND roster_id = $2 AND player_id = $3
       LIMIT 1`,
      [draftId, rosterId, playerId]
    );

    return result.rows.length > 0;
  }

  async belongsToRoster(queueId: number, rosterId: number, draftId: number): Promise<boolean> {
    const result = await this.db.query(
      `SELECT 1 FROM draft_queues
       WHERE id = $1 AND roster_id = $2 AND draft_id = $3
       LIMIT 1`,
      [queueId, rosterId, draftId]
    );

    return result.rows.length > 0;
  }
}
