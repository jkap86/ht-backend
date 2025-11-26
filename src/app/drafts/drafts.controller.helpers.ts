// src/app/drafts/drafts.controller.helpers.ts
import { Container } from "../../infrastructure/di/Container";
import { ChatService } from "../../application/services/ChatService";

/**
 * Shared helper functions for draft controllers
 */

// Helper to get ChatService from DI Container
export function getChatService(): ChatService {
  return Container.getInstance().getChatService();
}

// Helper to get repositories from DI Container
export function getLeagueRepository() {
  return Container.getInstance().getLeagueRepository();
}

export function getRosterRepository() {
  return Container.getInstance().getRosterRepository();
}

export function getDraftQueueRepository() {
  return Container.getInstance().getDraftQueueRepository();
}

interface DraftRow {
  id: number;
  league_id: number;
  draft_type: string;
  third_round_reversal: boolean;
  status: string;
  current_pick: number;
  current_round: number;
  current_roster_id: number | null;
  pick_time_seconds: number;
  pick_deadline: Date | null;
  rounds: number;
  started_at: Date | null;
  completed_at: Date | null;
  settings: any;
  created_at: Date;
  updated_at: Date;
}

export function mapDraftRow(row: DraftRow) {
  const settings: any = row.settings || {};

  const settingsPickDeadline = settings.pick_deadline as string | undefined;

  // Prefer the JSON settings pick_deadline (used by derby), fall back to column
  const pickDeadline: Date | null = settingsPickDeadline
    ? new Date(settingsPickDeadline)
    : row.pick_deadline;

  return {
    id: row.id,
    leagueId: row.league_id,
    draftType: row.draft_type,
    thirdRoundReversal: row.third_round_reversal,
    status: row.status,
    currentPick: row.current_pick,
    currentRound: row.current_round,
    currentRosterId: row.current_roster_id,
    pickTimeSeconds: row.pick_time_seconds,
    pickDeadline, // <- now comes from settings for derby
    rounds: row.rounds,
    startedAt: row.started_at,
    completedAt: row.completed_at,
    settings: row.settings,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
