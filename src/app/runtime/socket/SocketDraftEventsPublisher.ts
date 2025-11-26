import { IDraftEventsPublisher } from '../../../application/services/IDraftEventsPublisher';
import { DraftData } from '../../../domain/repositories/IDraftRepository';
import { DraftPick } from '../../../domain/models/DraftPick';
import { DraftOrderEntry } from '../../../domain/models/DraftOrderEntry';
import { getSocketService } from './socket.service';
import { SocketEvents, DraftEventTypes } from './socketEvents';

export class SocketDraftEventsPublisher implements IDraftEventsPublisher {
  emitDraftStarted(leagueId: number, draft: DraftData, currentPicker: DraftOrderEntry): void {
    const socketService = getSocketService();
    socketService.emitToRoom(`league_${leagueId}`, SocketEvents.DRAFT_EVENT, {
      event_type: DraftEventTypes.DRAFT_STARTED,
      draft_id: draft.id,
      draft,
      current_picker: currentPicker
    });
  }

  emitPickMade(
    leagueId: number,
    pick: DraftPick,
    draft: DraftData,
    nextPicker: DraftOrderEntry | null
  ): void {
    const socketService = getSocketService();
    socketService.emitToRoom(`league_${leagueId}`, SocketEvents.DRAFT_EVENT, {
      event_type: DraftEventTypes.PICK_MADE,
      draft_id: draft.id,
      pick,
      draft,
      next_picker: nextPicker
    });
  }

  emitPickerChanged(
    leagueId: number,
    currentPicker: DraftOrderEntry,
    draft: DraftData
  ): void {
    const socketService = getSocketService();
    socketService.emitToRoom(`league_${leagueId}`, SocketEvents.DRAFT_EVENT, {
      event_type: DraftEventTypes.PICKER_CHANGED,
      draft_id: draft.id,
      current_picker: currentPicker,
      draft
    });
  }

  emitDraftPaused(leagueId: number, draft: DraftData): void {
    const socketService = getSocketService();
    socketService.emitToRoom(`league_${leagueId}`, SocketEvents.DRAFT_EVENT, {
      event_type: DraftEventTypes.DRAFT_PAUSED,
      draft_id: draft.id,
      draft
    });
  }

  emitDraftResumed(leagueId: number, draft: DraftData, currentPicker: DraftOrderEntry): void {
    const socketService = getSocketService();
    socketService.emitToRoom(`league_${leagueId}`, SocketEvents.DRAFT_EVENT, {
      event_type: DraftEventTypes.DRAFT_RESUMED,
      draft_id: draft.id,
      draft,
      current_picker: currentPicker
    });
  }

  emitDraftCompleted(leagueId: number, draft: DraftData): void {
    const socketService = getSocketService();
    socketService.emitToRoom(`league_${leagueId}`, SocketEvents.DRAFT_EVENT, {
      event_type: DraftEventTypes.DRAFT_COMPLETED,
      draft_id: draft.id,
      draft
    });
  }

  emitAutoPickOccurred(
    leagueId: number,
    pick: DraftPick,
    draft: DraftData,
    nextPicker: DraftOrderEntry | null
  ): void {
    const socketService = getSocketService();
    socketService.emitToRoom(`league_${leagueId}`, SocketEvents.DRAFT_EVENT, {
      event_type: DraftEventTypes.AUTO_PICK_OCCURRED,
      draft_id: draft.id,
      pick,
      draft,
      next_picker: nextPicker
    });
  }

  emitAutopickStatusChanged(
    leagueId: number,
    draftId: number,
    rosterId: number,
    enabled: boolean,
    userId: string
  ): void {
    const socketService = getSocketService();
    socketService.emitToRoom(`league_${leagueId}`, SocketEvents.DRAFT_EVENT, {
      event_type: DraftEventTypes.AUTOPICK_STATUS_CHANGED,
      draft_id: draftId,
      roster_id: rosterId,
      user_id: userId,
      autopick_enabled: enabled
    });
  }

  emitAutopickEnabledOnTimeout(
    leagueId: number,
    draftId: number,
    rosterId: number,
    userId: string
  ): void {
    const socketService = getSocketService();
    socketService.emitToRoom(`league_${leagueId}`, SocketEvents.DRAFT_EVENT, {
      event_type: DraftEventTypes.AUTOPICK_ENABLED_ON_TIMEOUT,
      draft_id: draftId,
      roster_id: rosterId,
      user_id: userId
    });
  }
}
