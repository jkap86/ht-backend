// src/app/services/derby-autopick.service.ts
import { pool } from "../../db/pool";
import { sendSystemMessage } from "../controllers/leagueChat.controller";

/**
 * Check all active derbies and auto-pick for expired deadlines
 */
export const processExpiredDerbyPicks = async () => {
  try {
    // Find all drafts with derby in progress and expired pick deadlines
    const expiredDraftsResult = await pool.query(
      `SELECT id, league_id, settings, pick_time_seconds
       FROM drafts
       WHERE settings->>'derby_status' = 'in_progress'
       AND settings->>'pick_deadline' IS NOT NULL
       AND (settings->>'pick_deadline')::timestamp < NOW()`
    );

    if (expiredDraftsResult.rows.length === 0) {
      return; // No expired picks to process
    }

    console.log(`[Derby Auto-Pick] Found ${expiredDraftsResult.rows.length} expired pick(s) to process`);

    // Process each expired draft
    for (const draft of expiredDraftsResult.rows) {
      try {
        await autoPickSlot(draft.id, draft.league_id, draft.settings, draft.pick_time_seconds);
      } catch (error) {
        console.error(`[Derby Auto-Pick] Error processing draft ${draft.id}:`, error);
      }
    }
  } catch (error) {
    console.error('[Derby Auto-Pick] Error checking for expired picks:', error);
  }
};

/**
 * Auto-pick a random available slot for the current picker
 */
async function autoPickSlot(
  draftId: number,
  leagueId: number,
  settings: any,
  pickTimeSeconds: number
) {
  // Get the current draft order
  const orderResult = await pool.query(
    `SELECT d_order.id, d_order.roster_id, d_order.draft_position, r.user_id, u.username
     FROM draft_order d_order
     INNER JOIN rosters r ON r.id = d_order.roster_id
     LEFT JOIN users u ON u.id = r.user_id
     WHERE d_order.draft_id = $1
     ORDER BY d_order.draft_position`,
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

  // Find all available slots (slots not yet taken)
  const takenSlots = new Set<number>();
  for (let i = 0; i < currentPickerIndex; i++) {
    takenSlots.add(orderResult.rows[i].draft_position);
  }

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

  console.log(`[Derby Auto-Pick] Auto-picking slot ${randomSlot} for ${username} in draft ${draftId}`);

  // Update the draft order with the auto-picked slot
  await pool.query(
    `UPDATE draft_order SET draft_position = $1 WHERE id = $2`,
    [randomSlot, currentPicker.id]
  );

  // Move to next picker or complete the derby
  const nextPickerIndex = currentPickerIndex + 1;

  if (nextPickerIndex < orderResult.rows.length) {
    // More pickers to go
    settings.current_picker_index = nextPickerIndex;
    settings.pick_deadline = new Date(Date.now() + pickTimeSeconds * 1000).toISOString();
  } else {
    // Derby complete
    settings.derby_status = 'completed';
    delete settings.current_picker_index;
    delete settings.pick_deadline;
  }

  // Update draft settings
  await pool.query(
    `UPDATE drafts SET settings = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2`,
    [JSON.stringify(settings), draftId]
  );

  // Send system message
  await sendSystemMessage(
    leagueId,
    `${username} was auto-assigned slot ${randomSlot} (time expired)`,
    { draft_id: draftId, action: 'slot_auto_picked', slot_number: randomSlot }
  );

  console.log(`[Derby Auto-Pick] Successfully auto-picked slot ${randomSlot} for ${username} in draft ${draftId}`);
}
