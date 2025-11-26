export interface IMatchupDraftEventsPublisher {
  /**
   * Emit event when matchup draft is started
   */
  emitMatchupDraftStarted(leagueId: number, draftId: number, currentPicker: any): void;

  /**
   * Emit event when a matchup pick is made
   */
  emitMatchupPickMade(leagueId: number, draftId: number, pick: any, picker: any): void;

  /**
   * Emit event when the current picker changes
   */
  emitMatchupPickerChanged(leagueId: number, draftId: number, currentPicker: any, pickDeadline: Date | null): void;

  /**
   * Emit event when matchup draft is paused
   */
  emitMatchupDraftPaused(leagueId: number, draftId: number): void;

  /**
   * Emit event when matchup draft is resumed
   */
  emitMatchupDraftResumed(leagueId: number, draftId: number): void;

  /**
   * Emit event when matchup draft is completed
   */
  emitMatchupDraftCompleted(leagueId: number, draftId: number): void;
}
