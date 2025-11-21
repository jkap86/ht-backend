import { Container } from '../../../infrastructure/di/Container';
import { pool } from '../../../db/pool';

let isProcessing = false;

/**
 * Process expired draft picks
 * Called by cron job to check for drafts where pick_deadline has passed
 */
export const processExpiredDraftPicks = async () => {
  // Prevent concurrent processing
  if (isProcessing) {
    return;
  }

  try {
    isProcessing = true;

    // Find drafts with expired pick deadlines
    const result = await pool.query(
      `SELECT id, league_id FROM drafts
       WHERE status = 'in_progress'
       AND pick_deadline IS NOT NULL
       AND pick_deadline < NOW()`,
      []
    );

    if (result.rows.length === 0) {
      return;
    }

    console.log(`[Draft Auto-Pick] Found ${result.rows.length} draft(s) with expired picks`);

    // Process each expired draft
    for (const row of result.rows) {
      const draftId = row.id;
      const leagueId = row.league_id;

      try {
        console.log(`[Draft Auto-Pick] Processing draft ${draftId} (league ${leagueId})`);

        const draftService = Container.getInstance().getDraftService();
        await draftService.autoPickForCurrentUser(draftId);

        console.log(`[Draft Auto-Pick] Successfully auto-picked for draft ${draftId}`);
      } catch (error) {
        console.error(`[Draft Auto-Pick] Error processing draft ${draftId}:`, error);
      }
    }
  } catch (error) {
    console.error('[Draft Auto-Pick] Error in processExpiredDraftPicks:', error);
  } finally {
    isProcessing = false;
  }
};
