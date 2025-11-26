import { IMatchupDraftEventsPublisher } from '../../../application/services/IMatchupDraftEventsPublisher';
import { getSocketService } from './socket.service';
import { SocketEvents, MatchupDraftEventTypes } from './socketEvents';

export class SocketMatchupDraftEventsPublisher implements IMatchupDraftEventsPublisher {
  emitMatchupDraftStarted(leagueId: number, draftId: number, currentPicker: any): void {
    const socketService = getSocketService();
    socketService.emitToRoom(`league_${leagueId}`, SocketEvents.MATCHUP_DRAFT_EVENT, {
      event_type: MatchupDraftEventTypes.MATCHUP_DRAFT_STARTED,
      draft_id: draftId,
      current_picker: currentPicker
    });
  }

  emitMatchupPickMade(leagueId: number, draftId: number, pick: any, picker: any): void {
    const socketService = getSocketService();
    socketService.emitToRoom(`league_${leagueId}`, SocketEvents.MATCHUP_DRAFT_EVENT, {
      event_type: MatchupDraftEventTypes.MATCHUP_PICK_MADE,
      draft_id: draftId,
      pick,
      picker
    });
  }

  emitMatchupPickerChanged(leagueId: number, draftId: number, currentPicker: any, pickDeadline: Date | null): void {
    const socketService = getSocketService();
    socketService.emitToRoom(`league_${leagueId}`, SocketEvents.MATCHUP_DRAFT_EVENT, {
      event_type: MatchupDraftEventTypes.MATCHUP_PICKER_CHANGED,
      draft_id: draftId,
      current_picker: currentPicker,
      pick_deadline: pickDeadline
    });
  }

  emitMatchupDraftPaused(leagueId: number, draftId: number): void {
    const socketService = getSocketService();
    socketService.emitToRoom(`league_${leagueId}`, SocketEvents.MATCHUP_DRAFT_EVENT, {
      event_type: MatchupDraftEventTypes.MATCHUP_DRAFT_PAUSED,
      draft_id: draftId
    });
  }

  emitMatchupDraftResumed(leagueId: number, draftId: number): void {
    const socketService = getSocketService();
    socketService.emitToRoom(`league_${leagueId}`, SocketEvents.MATCHUP_DRAFT_EVENT, {
      event_type: MatchupDraftEventTypes.MATCHUP_DRAFT_RESUMED,
      draft_id: draftId
    });
  }

  emitMatchupDraftCompleted(leagueId: number, draftId: number): void {
    const socketService = getSocketService();
    socketService.emitToRoom(`league_${leagueId}`, SocketEvents.MATCHUP_DRAFT_EVENT, {
      event_type: MatchupDraftEventTypes.MATCHUP_DRAFT_COMPLETED,
      draft_id: draftId
    });
  }
}
