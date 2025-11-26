// src/app/routes/index.ts
import { Router } from "express";
import healthRoutes from "../common/routes/health.routes";
import authRoutes from "../auth/auth.routes";
import leaguesRoutes from "../leagues/leagues.routes";
import directMessagesRoutes from "../directMessages/directMessages.routes";
import draftsRoutes from "../drafts/drafts.routes";
import matchupDraftsRoutes from "../matchup-drafts/matchup-drafts.routes";
import playersRoutes from "../players/players.routes";

const router = Router();

// All route modules go here
router.use("/health", healthRoutes);
router.use("/auth", authRoutes);
router.use("/leagues", leaguesRoutes);
router.use("/leagues", draftsRoutes); // Drafts routes are nested under leagues
router.use("/leagues", matchupDraftsRoutes); // Matchup drafts routes are nested under leagues
router.use("/direct-messages", directMessagesRoutes);
router.use("/players", playersRoutes);

export default router;
