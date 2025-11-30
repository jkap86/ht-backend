import { Router } from "express";
import { authMiddleware } from "../common/middleware/auth.middleware";
import {
  getPlayerWeeklyStats,
  getPlayerSeasonStats,
  getPlayerSeasonTotals,
  getWeekStats,
  getPlayerProjection,
  getWeekProjections,
  calculateFantasyPoints,
  calculateSeasonFantasyPoints,
  getSyncStatus,
  syncWeeklyStats,
  syncWeeklyProjections,
  syncAll,
} from "./stats.controller";

const router = Router();

// Sync endpoints - No auth required for admin scripts/cron jobs
// POST /api/stats/sync/stats/:season/:week
router.post("/sync/stats/:season/:week", syncWeeklyStats);

// POST /api/stats/sync/projections/:season/:week
router.post("/sync/projections/:season/:week", syncWeeklyProjections);

// POST /api/stats/sync/all/:season/:week
router.post("/sync/all/:season/:week", syncAll);

// All other stats routes require authentication
router.use(authMiddleware);

// GET /api/stats/sync/status/:season/:week - Get sync status
router.get("/sync/status/:season/:week", getSyncStatus);

// Weekly stats endpoints
// GET /api/stats/week/:season/:week - Get all stats for a week
router.get("/week/:season/:week", getWeekStats);

// GET /api/stats/players/:playerSleeperId/weekly/:season/:week - Get player weekly stats
router.get("/players/:playerSleeperId/weekly/:season/:week", getPlayerWeeklyStats);

// Season stats endpoints
// GET /api/stats/players/:playerSleeperId/season/:season - Get player's full season
router.get("/players/:playerSleeperId/season/:season", getPlayerSeasonStats);

// GET /api/stats/players/:playerSleeperId/totals/:season - Get player season totals
router.get("/players/:playerSleeperId/totals/:season", getPlayerSeasonTotals);

// Projections endpoints
// GET /api/stats/projections/week/:season/:week - Get all projections for a week
router.get("/projections/week/:season/:week", getWeekProjections);

// GET /api/stats/projections/:playerSleeperId/:season/:week - Get player projection
router.get("/projections/:playerSleeperId/:season/:week", getPlayerProjection);

// Fantasy points calculation endpoints
// GET /api/stats/fantasy-points/:playerSleeperId/:season/:week/:leagueId - Calculate weekly points
router.get("/fantasy-points/:playerSleeperId/:season/:week/:leagueId", calculateFantasyPoints);

// GET /api/stats/fantasy-points/:playerSleeperId/:season/totals/:leagueId - Calculate season total
router.get("/fantasy-points/:playerSleeperId/:season/totals/:leagueId", calculateSeasonFantasyPoints);

export default router;
