// src/app/routes/index.ts
import { Router } from "express";
import healthRoutes from "./health.routes";
import authRoutes from "./auth.routes";
import leaguesRoutes from "./leagues.routes";
import directMessagesRoutes from "./directMessages.routes";
import draftsRoutes from "./drafts.routes";

const router = Router();

// All route modules go here
router.use("/health", healthRoutes);
router.use("/auth", authRoutes);
router.use("/leagues", leaguesRoutes);
router.use("/leagues", draftsRoutes); // Drafts routes are nested under leagues
router.use("/direct-messages", directMessagesRoutes);

export default router;
