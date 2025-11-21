import { Router } from "express";
import { authMiddleware } from "../common/middleware/auth.middleware";
import { getPlayerById, searchPlayers, getActivePlayers, syncPlayers } from "./players.controller";

const router = Router();

// POST /api/players/sync - No auth required for admin scripts
router.post("/sync", syncPlayers);

// All other player routes require authentication
router.use(authMiddleware);

// GET /api/players - Get all active players
router.get("/", getActivePlayers);

// GET /api/players/search - Search players with filters
router.get("/search", searchPlayers);

// GET /api/players/:id - Get a specific player by ID
router.get("/:id", getPlayerById);

export default router;
