import { DraftData } from '../../domain/repositories/IDraftRepository';
import { DraftPick } from '../../domain/models/DraftPick';
import { DraftOrderEntry } from '../../domain/models/DraftOrderEntry';

export interface IDraftEventsPublisher {
  /**
   * Emit event when draft is started
   */
  emitDraftStarted(leagueId: number, draft: DraftData, currentPicker: DraftOrderEntry): void;

  /**
   * Emit event when a pick is made
   */
  emitPickMade(
    leagueId: number,
    pick: DraftPick,
    draft: DraftData,
    nextPicker: DraftOrderEntry | null
  ): void;

  /**
   * Emit event when the current picker changes (timer expired, etc.)
   */
  emitPickerChanged(
    leagueId: number,
    currentPicker: DraftOrderEntry,
    draft: DraftData
  ): void;

  /**
   * Emit event when draft is paused
   */
  emitDraftPaused(leagueId: number, draft: DraftData): void;

  /**
   * Emit event when draft is resumed
   */
  emitDraftResumed(leagueId: number, draft: DraftData, currentPicker: DraftOrderEntry): void;

  /**
   * Emit event when draft is completed
   */
  emitDraftCompleted(leagueId: number, draft: DraftData): void;

  /**
   * Emit event when an auto-pick occurs
   */
  emitAutoPickOccurred(
    leagueId: number,
    pick: DraftPick,
    draft: DraftData,
    nextPicker: DraftOrderEntry | null
  ): void;

  /**
   * Emit event when autopick status is manually changed
   */
  emitAutopickStatusChanged(
    leagueId: number,
    draftId: number,
    rosterId: number,
    enabled: boolean,
    userId: string
  ): void;

  /**
   * Emit event when autopick is automatically enabled due to timeout
   */
  emitAutopickEnabledOnTimeout(
    leagueId: number,
    draftId: number,
    rosterId: number,
    userId: string
  ): void;
}
