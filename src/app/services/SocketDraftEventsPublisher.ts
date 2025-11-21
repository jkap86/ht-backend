import { IDraftEventsPublisher } from '../../application/services/IDraftEventsPublisher';
import { DraftData } from '../../domain/repositories/IDraftRepository';
import { DraftPick } from '../../domain/models/DraftPick';
import { DraftOrderEntry } from '../../domain/models/DraftOrderEntry';
import { getSocketService } from './socket.service';

export class SocketDraftEventsPublisher implements IDraftEventsPublisher {
  emitDraftStarted(leagueId: number, draft: DraftData, currentPicker: DraftOrderEntry): void {
    const socketService = getSocketService();
    socketService.emitToRoom(`league_${leagueId}`, 'draft_event', {
      event_type: 'draft_started',
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
    socketService.emitToRoom(`league_${leagueId}`, 'draft_event', {
      event_type: 'pick_made',
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
    socketService.emitToRoom(`league_${leagueId}`, 'draft_event', {
      event_type: 'picker_changed',
      draft_id: draft.id,
      current_picker: currentPicker,
      draft
    });
  }

  emitDraftPaused(leagueId: number, draft: DraftData): void {
    const socketService = getSocketService();
    socketService.emitToRoom(`league_${leagueId}`, 'draft_event', {
      event_type: 'draft_paused',
      draft_id: draft.id,
      draft
    });
  }

  emitDraftResumed(leagueId: number, draft: DraftData, currentPicker: DraftOrderEntry): void {
    const socketService = getSocketService();
    socketService.emitToRoom(`league_${leagueId}`, 'draft_event', {
      event_type: 'draft_resumed',
      draft_id: draft.id,
      draft,
      current_picker: currentPicker
    });
  }

  emitDraftCompleted(leagueId: number, draft: DraftData): void {
    const socketService = getSocketService();
    socketService.emitToRoom(`league_${leagueId}`, 'draft_event', {
      event_type: 'draft_completed',
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
    socketService.emitToRoom(`league_${leagueId}`, 'draft_event', {
      event_type: 'auto_pick_occurred',
      draft_id: draft.id,
      pick,
      draft,
      next_picker: nextPicker
    });
  }
}
