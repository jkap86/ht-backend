import { Pool } from 'pg';
import { DraftData } from '../../domain/repositories/IDraftRepository';
import { DraftUtilityService } from './DraftUtilityService';
import { ValidationException, NotFoundException } from '../../domain/exceptions/AuthExceptions';
import { withTransaction } from '../../db/transaction';

/**
 * Service responsible for derby draft operations
 * Handles derby-specific workflow: start, pick slot, pause, resume
 */
export class DerbyService {
  constructor(
    private readonly pool: Pool,
    private readonly utilityService: DraftUtilityService
  ) {}

  /**
   * Start a derby draft
   */
  async startDerby(leagueId: number, draftId: number, userId: string): Promise<DraftData> {
    // Verify commissioner
    await this.utilityService.verifyCommissioner(leagueId, userId);

    // Check if draft exists and is a derby draft
    const draftResult = await this.pool.query(
      'SELECT id, draft_type, settings FROM drafts WHERE id = $1 AND league_id = $2',
      [draftId, leagueId]
    );

    if (draftResult.rows.length === 0) {
      throw new NotFoundException('Draft not found');
    }

    const draft = draftResult.rows[0];
    const settings = draft.settings || {};

    if (settings.draft_order !== 'derby') {
      throw new ValidationException(
        "This endpoint is only for derby drafts (draft_order must be 'derby')"
      );
    }

    // Check if draft order has been randomized
    const orderCheck = await this.pool.query(
      'SELECT COUNT(*) as count FROM draft_order WHERE draft_id = $1',
      [draftId]
    );

    if (parseInt(orderCheck.rows[0].count) === 0) {
      throw new ValidationException('Derby order must be randomized before starting');
    }

    // Use derby timer seconds from settings (not pick_time_seconds)
    const derbyTimerSeconds = settings.derby_timer_seconds || 300; // Default 5 minutes

    // Set derby start time to now
    const derbyStartTime = new Date();
    settings.derby_start_time = derbyStartTime.toISOString();
    settings.derby_status = 'in_progress';
    settings.current_picker_index = 0; // First person in derby order picks first
    settings.pick_deadline = new Date(Date.now() + derbyTimerSeconds * 1000).toISOString();
    // Preserve derby_timer_seconds in settings
    settings.derby_timer_seconds = derbyTimerSeconds;

    // Update the draft with derby start time and status
    await this.pool.query(
      `UPDATE drafts
       SET settings = $1,
           updated_at = CURRENT_TIMESTAMP,
           pick_deadline = $2
       WHERE id = $3`,
      [JSON.stringify(settings), settings.pick_deadline, draftId]
    );

    // Get username for system message
    const username = await this.utilityService.getUsernameById(userId);

    // Send system message
    await this.utilityService.sendSystemMessage(
      leagueId,
      `${username} started the derby! Users can now select their draft positions.`
    );

    // Fetch the updated draft with league info to get total_rosters
    const result = await this.pool.query(
      `SELECT d.*, l.total_rosters
       FROM drafts d
       INNER JOIN leagues l ON l.id = d.league_id
       WHERE d.id = $1`,
      [draftId]
    );

    return this.utilityService.mapDraftRow(result.rows[0]);
  }

  /**
   * Pick a draft slot in derby
   * Uses transaction to ensure atomicity of slot selection and draft state update
   */
  async pickDerbySlot(leagueId: number, draftId: number, userId: string, slotNumber: number): Promise<DraftData> {
    // Get draft settings and check it's a derby in progress
    const draftResult = await this.pool.query(
      'SELECT id, draft_type, settings, pick_time_seconds FROM drafts WHERE id = $1 AND league_id = $2',
      [draftId, leagueId]
    );

    if (draftResult.rows.length === 0) {
      throw new NotFoundException('Draft not found');
    }

    const draft = draftResult.rows[0];
    const settings = draft.settings || {};

    if (settings.draft_order !== 'derby') {
      throw new ValidationException("This endpoint is only for derby drafts (draft_order must be 'derby')");
    }

    if (settings.derby_status !== 'in_progress') {
      throw new ValidationException('Derby is not in progress');
    }

    // Get draft order to find current picker
    // Order by id to preserve the original derby picking order (not draft_position which changes as people pick)
    const orderResult = await this.pool.query(
      `SELECT d_order.id, d_order.roster_id, d_order.draft_position, r.user_id
       FROM draft_order d_order
       INNER JOIN rosters r ON r.id = d_order.roster_id
       WHERE d_order.draft_id = $1
       ORDER BY d_order.id`,
      [draftId]
    );

    if (orderResult.rows.length === 0) {
      throw new ValidationException('No draft order found');
    }

    const currentPickerIndex = settings.current_picker_index || 0;
    const currentPicker = orderResult.rows[currentPickerIndex];

    // Verify it's this user's turn
    if (currentPicker.user_id !== userId) {
      throw new ValidationException("It's not your turn to pick");
    }

    // Validate slot number
    if (slotNumber < 1 || slotNumber > orderResult.rows.length) {
      throw new ValidationException(`Slot number must be between 1 and ${orderResult.rows.length}`);
    }

    // Wrap slot selection and draft update in a transaction
    await withTransaction(async (client) => {
      // Check if slot is already taken (within transaction for consistency)
      const slotCheck = await client.query(
        `SELECT id FROM draft_order
         WHERE draft_id = $1 AND draft_position = $2 AND id != $3`,
        [draftId, slotNumber, currentPicker.id]
      );

      if (slotCheck.rows.length > 0) {
        throw new ValidationException('This slot is already taken');
      }

      // Update the draft order with the selected slot
      await client.query(
        `UPDATE draft_order SET draft_position = $1 WHERE id = $2`,
        [slotNumber, currentPicker.id]
      );

      // Move to next picker
      const nextPickerIndex = currentPickerIndex + 1;

      if (nextPickerIndex < orderResult.rows.length) {
        // More pickers to go
        settings.current_picker_index = nextPickerIndex;
        // Use derby timer seconds from settings (not pick_time_seconds)
        const derbyTimerSeconds = settings.derby_timer_seconds || 300;
        settings.pick_deadline = new Date(Date.now() + derbyTimerSeconds * 1000).toISOString();
      } else {
        // Derby complete
        settings.derby_status = 'completed';
        delete settings.current_picker_index;
        delete settings.pick_deadline;
      }

      // Update draft settings and pick_deadline column
      await client.query(
        `UPDATE drafts SET settings = $1, pick_deadline = $2, updated_at = CURRENT_TIMESTAMP WHERE id = $3`,
        [JSON.stringify(settings), settings.pick_deadline || null, draftId]
      );
    }, this.pool);

    // Get username for system message
    const username = await this.utilityService.getUsernameById(userId);

    // Send system message
    await this.utilityService.sendSystemMessage(leagueId, `${username} selected slot ${slotNumber}`);

    // Fetch the updated draft with league info to get total_rosters
    const result = await this.pool.query(
      `SELECT d.*, l.total_rosters
       FROM drafts d
       INNER JOIN leagues l ON l.id = d.league_id
       WHERE d.id = $1`,
      [draftId]
    );

    return this.utilityService.mapDraftRow(result.rows[0]);
  }

  /**
   * Pause a derby draft
   */
  async pauseDerby(leagueId: number, draftId: number, userId: string): Promise<DraftData> {
    // Verify commissioner
    await this.utilityService.verifyCommissioner(leagueId, userId);

    // Get draft settings
    const draftResult = await this.pool.query(
      'SELECT * FROM drafts WHERE id = $1 AND league_id = $2',
      [draftId, leagueId]
    );

    if (draftResult.rows.length === 0) {
      throw new NotFoundException('Draft not found');
    }

    const draft = draftResult.rows[0];
    const settings = draft.settings || {};

    if (settings.draft_order !== 'derby') {
      throw new ValidationException('This endpoint is only for derby drafts');
    }

    if (settings.derby_status !== 'in_progress') {
      throw new ValidationException('Derby is not in progress');
    }

    // Pause the derby
    settings.derby_status = 'paused';
    delete settings.pick_deadline; // Remove the deadline when paused

    await this.pool.query(
      `UPDATE drafts SET settings = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2`,
      [JSON.stringify(settings), draftId]
    );

    // Get username for system message
    const username = await this.utilityService.getUsernameById(userId);

    // Send system message
    await this.utilityService.sendSystemMessage(leagueId, `${username} paused the derby`);

    // Fetch the updated draft with league info to get total_rosters
    const result = await this.pool.query(
      `SELECT d.*, l.total_rosters
       FROM drafts d
       INNER JOIN leagues l ON l.id = d.league_id
       WHERE d.id = $1`,
      [draftId]
    );

    return this.utilityService.mapDraftRow(result.rows[0]);
  }

  /**
   * Resume a derby draft
   */
  async resumeDerby(leagueId: number, draftId: number, userId: string): Promise<DraftData> {
    // Verify commissioner
    await this.utilityService.verifyCommissioner(leagueId, userId);

    // Get draft settings and pick time
    const draftResult = await this.pool.query(
      'SELECT * FROM drafts WHERE id = $1 AND league_id = $2',
      [draftId, leagueId]
    );

    if (draftResult.rows.length === 0) {
      throw new NotFoundException('Draft not found');
    }

    const draft = draftResult.rows[0];
    const settings = draft.settings || {};

    if (settings.draft_order !== 'derby') {
      throw new ValidationException('This endpoint is only for derby drafts');
    }

    if (settings.derby_status !== 'paused') {
      throw new ValidationException('Derby is not paused');
    }

    // Resume the derby
    settings.derby_status = 'in_progress';
    // Use derby_timer_seconds (default to 300 seconds if not set)
    const derbyTimerSeconds = settings.derby_timer_seconds || 300;
    settings.pick_deadline = new Date(Date.now() + derbyTimerSeconds * 1000).toISOString();

    await this.pool.query(
      `UPDATE drafts SET settings = $1, pick_deadline = $2, updated_at = CURRENT_TIMESTAMP WHERE id = $3`,
      [JSON.stringify(settings), settings.pick_deadline, draftId]
    );

    // Get username for system message
    const username = await this.utilityService.getUsernameById(userId);

    // Send system message
    await this.utilityService.sendSystemMessage(leagueId, `${username} resumed the derby`);

    // Fetch the updated draft with league info to get total_rosters
    const result = await this.pool.query(
      `SELECT d.*, l.total_rosters
       FROM drafts d
       INNER JOIN leagues l ON l.id = d.league_id
       WHERE d.id = $1`,
      [draftId]
    );

    return this.utilityService.mapDraftRow(result.rows[0]);
  }
}
