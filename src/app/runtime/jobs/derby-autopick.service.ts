// src/app/runtime/jobs/derby-autopick.service.ts
import { pool } from "../../../db/pool";
import { Container } from "../../../infrastructure/di/Container";
import { getSocketService } from "../socket/socket.service";

/**
 * Check all active derbies and auto-pick for expired deadlines
 */
export const processExpiredDerbyPicks = async () => {
  try {
    // Find all drafts with derby in progress and expired pick deadlines
    // Use the pick_deadline column (more reliable than JSON field)
    // LIMIT to prevent excessive processing in one iteration
    const expiredDraftsResult = await pool.query(
      `SELECT id, league_id, settings
       FROM drafts
       WHERE settings->>'derby_status' = 'in_progress'
       AND pick_deadline IS NOT NULL
       AND pick_deadline < NOW()
       LIMIT 50`
    );

    if (expiredDraftsResult.rows.length === 0) {
      return; // No expired picks to process
    }

    // Process expired picks

    // Process each expired draft
    for (const draft of expiredDraftsResult.rows) {
      try {
        // Use derby timer seconds from settings (default to 300 seconds if not set)
        const derbyTimerSeconds = draft.settings.derby_timer_seconds || 300;
        await autoPickSlot(draft.id, draft.league_id, draft.settings, derbyTimerSeconds);
      } catch (error) {
        console.error(`[Derby Auto-Pick] Error processing draft ${draft.id}:`, error);
      }
    }

  } catch (error) {
    console.error(`[Derby Auto-Pick] Error:`, error);
  }
};

/**
 * Handle timeout for the current picker - either auto-pick or skip based on settings
 */
async function autoPickSlot(
  draftId: number,
  leagueId: number,
  settings: any,
  derbyTimerSeconds: number
) {
  // Get the current draft order
  // Order by id to preserve the original derby picking order (not draft_position which changes as people pick)
  const orderResult = await pool.query(
    `SELECT d_order.id, d_order.roster_id, d_order.draft_position, r.user_id, u.username
     FROM draft_order d_order
     INNER JOIN rosters r ON r.id = d_order.roster_id
     LEFT JOIN users u ON u.id = r.user_id
     WHERE d_order.draft_id = $1
     ORDER BY d_order.id`,
    [draftId]
  );

  if (orderResult.rows.length === 0) {
    console.error(`[Derby Auto-Pick] No draft order found for draft ${draftId}`);
    return;
  }

  const currentPickerIndex = settings.current_picker_index || 0;
  if (currentPickerIndex >= orderResult.rows.length) {
    console.error(`[Derby Auto-Pick] Invalid picker index ${currentPickerIndex} for draft ${draftId}`);
    return;
  }

  const currentPicker = orderResult.rows[currentPickerIndex];
  const username = currentPicker.username || `Team ${currentPicker.roster_id}`;

  // Check derby_on_timeout setting (default to 'randomize' if not set - matches Zod schema)
  const onTimeoutAction = settings.derby_on_timeout || 'randomize';

  let systemMessage = '';
  let action = '';
  let slotNumber = null;

  if (onTimeoutAction === 'skip') {
    // Skip mode: just move to next user without assigning a slot
    systemMessage = `${username} was skipped (time expired)`;
    action = 'slot_skipped';
  } else {
    // Auto-pick mode (randomize or auto_assign): pick a random available slot
    // Query database to find all slots that have been taken
    const takenSlotsResult = await pool.query(
      `SELECT DISTINCT draft_position
       FROM draft_order
       WHERE draft_id = $1
       AND draft_position IS NOT NULL
       AND draft_position > 0`,
      [draftId]
    );

    const takenSlots = new Set<number>(
      takenSlotsResult.rows.map(row => row.draft_position)
    );

    // Build list of available slots
    const availableSlots: number[] = [];
    for (let i = 1; i <= orderResult.rows.length; i++) {
      if (!takenSlots.has(i)) {
        availableSlots.push(i);
      }
    }

    if (availableSlots.length === 0) {
      console.error(`[Derby Auto-Pick] No available slots for draft ${draftId}`);
      return;
    }

    // Pick a random available slot
    const randomSlot = availableSlots[Math.floor(Math.random() * availableSlots.length)];
    slotNumber = randomSlot;

    // Update the draft order with the auto-picked slot
    await pool.query(
      `UPDATE draft_order SET draft_position = $1 WHERE id = $2`,
      [randomSlot, currentPicker.id]
    );

    systemMessage = `${username} was auto-assigned slot ${randomSlot} (time expired)`;
    action = 'slot_auto_picked';
  }

  // Move to next picker or complete the derby
  const nextPickerIndex = currentPickerIndex + 1;

  if (nextPickerIndex < orderResult.rows.length) {
    // More pickers to go
    settings.current_picker_index = nextPickerIndex;
    settings.pick_deadline = new Date(Date.now() + derbyTimerSeconds * 1000).toISOString();
  } else {
    // Derby complete
    settings.derby_status = 'completed';
    delete settings.current_picker_index;
    delete settings.pick_deadline;
  }

  // Update draft settings and pick_deadline column
  await pool.query(
    `UPDATE drafts SET settings = $1, pick_deadline = $2, updated_at = CURRENT_TIMESTAMP WHERE id = $3`,
    [JSON.stringify(settings), settings.pick_deadline || null, draftId]
  );

  // Send system message
  const metadata: any = { draft_id: draftId, action };
  if (slotNumber !== null) {
    metadata.slot_number = slotNumber;
  }

  await Container.getInstance().getChatService().sendSystemMessage(
    leagueId,
    systemMessage,
    metadata
  );

  // Emit WebSocket event to notify all clients in the league
  try {
    const socketService = getSocketService();
    socketService.emitDerbyUpdate(leagueId, {
      draft_id: draftId,
      action,
      slot_number: slotNumber,
      current_picker_index: settings.current_picker_index,
      derby_status: settings.derby_status,
      pick_deadline: settings.pick_deadline,
    });
  } catch (error) {
    console.error(`[Derby Auto-Pick] Error emitting WebSocket event:`, error);
  }
}
