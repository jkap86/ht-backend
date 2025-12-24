// src/app/leagues/leagues.controller.ts
import { Response, NextFunction } from 'express';
import { AuthRequest } from '../common/middleware/auth.middleware';
import { ValidationError } from '../common/utils/errors';
import { Container } from '../../infrastructure/di/Container';
import { LeagueService } from '../../application/services/LeagueService';
import { LeaguePaymentService } from '../../application/services/league/LeaguePaymentService';
import { LeagueResetService } from '../../application/services/league/LeagueResetService';
import { LeagueMembershipService } from '../../application/services/league/LeagueMembershipService';
import { LeagueSettingsService } from '../../application/services/league/LeagueSettingsService';
import { DraftUtilityService } from '../../application/services/DraftUtilityService';

// Helper functions to get services from DI Container
function getLeagueService(): LeagueService {
  return Container.getInstance().getLeagueService();
}

function getLeaguePaymentService(): LeaguePaymentService {
  return Container.getInstance().getLeaguePaymentService();
}

function getLeagueResetService(): LeagueResetService {
  return Container.getInstance().getLeagueResetService();
}

function getLeagueMembershipService(): LeagueMembershipService {
  return Container.getInstance().getLeagueMembershipService();
}

function getLeagueSettingsService(): LeagueSettingsService {
  return Container.getInstance().getLeagueSettingsService();
}

function getDraftUtilityService(): DraftUtilityService {
  return Container.getInstance().getDraftUtilityService();
}

// Use service layer for commissioner check instead of direct DB access
async function isUserCommissioner(leagueId: number, userId: string): Promise<boolean> {
  return getDraftUtilityService().isUserCommissioner(leagueId, userId);
}

/**
 * GET /api/leagues/my-leagues
 * Get all leagues for the authenticated user
 */
export const getMyLeagues = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const userId = req.user?.userId;

    if (!userId) {
      throw new ValidationError('User ID not found in request');
    }

    const leagues = await getLeagueService().getUserLeagues(userId);

    return res.status(200).json(leagues);
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/leagues/:id
 * Get a specific league by ID
 */
export const getLeague = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const leagueId = parseInt(req.params.id, 10);
    const userId = req.user?.userId;

    if (!userId) {
      throw new ValidationError('User ID not found in request');
    }

    if (isNaN(leagueId)) {
      throw new ValidationError('Invalid league ID');
    }

    const league = await getLeagueService().getLeagueById(leagueId, userId);

    return res.status(200).json(league);
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/leagues/:id/join
 * Join a league
 */
export const joinLeague = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const userId = req.user?.userId;
    const leagueId = parseInt(req.params.id, 10);

    if (!userId) {
      throw new ValidationError('User ID not found in request');
    }

    if (isNaN(leagueId)) {
      throw new ValidationError('Invalid league ID');
    }

    const result = await getLeagueMembershipService().joinLeague(leagueId, userId);

    return res.status(200).json({
      message: result.message,
      roster_id: result.roster.roster_id,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/leagues
 * Create a new league
 */
export const createLeague = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const userId = req.user?.userId;
    const {
      name,
      season,
      total_rosters = 12,
      settings = {},
      scoring_settings = {},
      roster_positions = [],
      season_type = 'regular',
      description,
    } = req.body;

    if (!userId) {
      throw new ValidationError('User ID not found in request');
    }

    // Validation
    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      throw new ValidationError('League name is required');
    }

    if (!season || typeof season !== 'string' || !/^\d{4}$/.test(season)) {
      throw new ValidationError('Valid season year is required (e.g., 2024)');
    }

    if (
      typeof total_rosters !== 'number' ||
      total_rosters < 2 ||
      total_rosters > 20
    ) {
      throw new ValidationError('Total rosters must be between 2 and 20');
    }

    const league = await getLeagueService().createLeague(
      {
        name: name.trim(),
        description,
        totalRosters: total_rosters,
        season,
        seasonType: season_type,
        settings,
        scoringSettings: scoring_settings,
        rosterPositions: roster_positions,
      },
      userId
    );

    return res.status(201).json(league);
  } catch (error) {
    next(error);
  }
};

/**
 * PUT /api/leagues/:id
 * Update league settings
 */
export const updateLeague = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const userId = req.user?.userId;
    const leagueId = parseInt(req.params.id, 10);

    if (!userId) {
      throw new ValidationError('User ID not found in request');
    }

    if (isNaN(leagueId)) {
      throw new ValidationError('Invalid league ID');
    }

    // Build updates object
    const updates: any = {};
    if (req.body.name) updates.name = req.body.name;
    if (req.body.total_rosters) updates.totalRosters = req.body.total_rosters;
    if (req.body.settings) updates.settings = req.body.settings;
    if (req.body.scoring_settings)
      updates.scoringSettings = req.body.scoring_settings;
    if (req.body.roster_positions)
      updates.rosterPositions = req.body.roster_positions;
    if (req.body.status) updates.status = req.body.status;

    if (Object.keys(updates).length === 0) {
      throw new ValidationError('No updates provided');
    }

    const updatedLeague = await getLeagueSettingsService().updateLeague(
      leagueId,
      userId,
      updates
    );

    return res.status(200).json(updatedLeague);
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/leagues/:id/reset
 * Reset league - clears rosters, drafts, and matchups but preserves settings
 */
export const resetLeague = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const userId = req.user?.userId;
    const leagueId = parseInt(req.params.id, 10);

    if (!userId) {
      throw new ValidationError('User ID not found in request');
    }

    if (isNaN(leagueId)) {
      throw new ValidationError('Invalid league ID');
    }

    const result = await getLeagueResetService().resetLeague(leagueId, userId);

    return res.status(200).json(result);
  } catch (error) {
    next(error);
  }
};

/**
 * DELETE /api/leagues/:id
 * Delete league permanently
 */
export const deleteLeague = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const userId = req.user?.userId;
    const leagueId = parseInt(req.params.id, 10);

    if (!userId) {
      throw new ValidationError('User ID not found in request');
    }

    if (isNaN(leagueId)) {
      throw new ValidationError('Invalid league ID');
    }

    await getLeagueResetService().deleteLeague(leagueId, userId);

    return res.status(200).json({ message: 'League deleted successfully' });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/leagues/:id/dev/add-users
 * Developer endpoint to add multiple users to a league by username
 */
export const devAddUsersToLeague = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const userId = req.user?.userId;
    const leagueId = parseInt(req.params.id, 10);
    const { usernames } = req.body;

    if (!userId) {
      throw new ValidationError('User ID not found in request');
    }

    if (isNaN(leagueId)) {
      throw new ValidationError('Invalid league ID');
    }

    if (!Array.isArray(usernames) || usernames.length === 0) {
      throw new ValidationError('usernames must be a non-empty array');
    }

    const results = await getLeagueMembershipService().bulkAddUsers(
      leagueId,
      usernames,
      userId
    );

    return res.status(200).json({ results });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/leagues/:id/members
 * Get all members of a league with their payment status
 */
export const getLeagueMembers = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const userId = req.user?.userId;
    const leagueId = parseInt(req.params.id, 10);

    if (!userId) {
      throw new ValidationError('User ID not found in request');
    }

    if (isNaN(leagueId)) {
      throw new ValidationError('Invalid league ID');
    }

    const members = await getLeagueMembershipService().getLeagueMembers(leagueId, userId);

    // Transform to match frontend expectations (camelCase + extract paid from settings)
    const transformedMembers = members.map((member) => ({
      rosterId: member.roster_id,
      userId: member.user_id,
      username: member.username,
      paid: member.settings?.paid ?? false,
    }));

    return res.status(200).json({ members: transformedMembers });
  } catch (error) {
    next(error);
  }
};

/**
 * PATCH /api/leagues/:id/members/:rosterId/payment
 * Toggle payment status for a league member (commissioner only)
 */
export const toggleMemberPayment = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const userId = req.user?.userId;
    const leagueId = parseInt(req.params.id, 10);
    const rosterId = parseInt(req.params.rosterId, 10);
    const { paid } = req.body;

    if (!userId) {
      throw new ValidationError('User ID not found in request');
    }

    if (isNaN(leagueId) || isNaN(rosterId)) {
      throw new ValidationError('Invalid league ID or roster ID');
    }

    if (typeof paid !== 'boolean') {
      throw new ValidationError('paid must be a boolean');
    }

    const updatedRoster = await getLeaguePaymentService().updatePaymentStatus(
      leagueId,
      rosterId,
      paid,
      userId
    );

    return res.status(200).json({
      rosterId: updatedRoster.roster_id,
      paid: (updatedRoster.settings as any).paid,
    });
  } catch (error) {
    next(error);
  }
};

// ============================================
// Payout Management Endpoints
// ============================================

interface Payout {
  id: string;
  type: 'playoff_finish' | 'reg_season_points';
  place: number;
  amount: number;
}

/**
 * GET /api/leagues/:id/payouts
 * Get all payouts for a league
 */
export const getPayouts = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const userId = req.user?.userId;
    const leagueId = parseInt(req.params.id, 10);

    if (!userId) {
      throw new ValidationError('User ID not found in request');
    }

    if (isNaN(leagueId)) {
      throw new ValidationError('Invalid league ID');
    }

    const league = await getLeagueService().getLeagueById(leagueId, userId);
    const payouts = (league.settings as any)?.payouts || [];

    return res.status(200).json({ payouts });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/leagues/:id/payouts
 * Add a new payout to a league (commissioner only)
 */
export const addPayout = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const userId = req.user?.userId;
    const leagueId = parseInt(req.params.id, 10);
    const { type, place, amount } = req.body;

    if (!userId) {
      throw new ValidationError('User ID not found in request');
    }

    if (isNaN(leagueId)) {
      throw new ValidationError('Invalid league ID');
    }

    // Get current league
    const league = await getLeagueService().getLeagueById(leagueId, userId);

    // Verify user is commissioner
    if (league.commissioner_roster_id) {
      const commissionerCheck = await isUserCommissioner(leagueId, userId);
      if (!commissionerCheck) {
        throw new ValidationError('Only the commissioner can manage payouts');
      }
    }

    // Get current payouts
    const currentSettings = (league.settings as any) || {};
    const payouts: Payout[] = currentSettings.payouts || [];

    // Generate unique ID for the payout
    const newPayout: Payout = {
      id: `payout_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type,
      place,
      amount,
    };

    // Add new payout
    payouts.push(newPayout);

    // Update league settings
    await getLeagueSettingsService().updateLeague(leagueId, userId, {
      settings: { ...currentSettings, payouts },
    });

    return res.status(201).json({ payout: newPayout });
  } catch (error) {
    next(error);
  }
};

/**
 * PUT /api/leagues/:id/payouts/:payoutId
 * Update a payout (commissioner only)
 */
export const updatePayout = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const userId = req.user?.userId;
    const leagueId = parseInt(req.params.id, 10);
    const { payoutId } = req.params;
    const { type, place, amount } = req.body;

    if (!userId) {
      throw new ValidationError('User ID not found in request');
    }

    if (isNaN(leagueId)) {
      throw new ValidationError('Invalid league ID');
    }

    // Get current league
    const league = await getLeagueService().getLeagueById(leagueId, userId);

    // Verify user is commissioner
    if (league.commissioner_roster_id) {
      const commissionerCheck = await isUserCommissioner(leagueId, userId);
      if (!commissionerCheck) {
        throw new ValidationError('Only the commissioner can manage payouts');
      }
    }

    // Get current payouts
    const currentSettings = (league.settings as any) || {};
    const payouts: Payout[] = currentSettings.payouts || [];

    // Find and update payout
    const payoutIndex = payouts.findIndex(p => p.id === payoutId);
    if (payoutIndex === -1) {
      throw new ValidationError('Payout not found');
    }

    // Update fields if provided
    if (type !== undefined) payouts[payoutIndex].type = type;
    if (place !== undefined) payouts[payoutIndex].place = place;
    if (amount !== undefined) payouts[payoutIndex].amount = amount;

    // Update league settings
    await getLeagueSettingsService().updateLeague(leagueId, userId, {
      settings: { ...currentSettings, payouts },
    });

    return res.status(200).json({ payout: payouts[payoutIndex] });
  } catch (error) {
    next(error);
  }
};

/**
 * DELETE /api/leagues/:id/payouts/:payoutId
 * Delete a payout (commissioner only)
 */
export const deletePayout = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const userId = req.user?.userId;
    const leagueId = parseInt(req.params.id, 10);
    const { payoutId } = req.params;

    if (!userId) {
      throw new ValidationError('User ID not found in request');
    }

    if (isNaN(leagueId)) {
      throw new ValidationError('Invalid league ID');
    }

    // Get current league
    const league = await getLeagueService().getLeagueById(leagueId, userId);

    // Verify user is commissioner
    if (league.commissioner_roster_id) {
      const commissionerCheck = await isUserCommissioner(leagueId, userId);
      if (!commissionerCheck) {
        throw new ValidationError('Only the commissioner can manage payouts');
      }
    }

    // Get current payouts
    const currentSettings = (league.settings as any) || {};
    const payouts: Payout[] = currentSettings.payouts || [];

    // Find payout
    const payoutIndex = payouts.findIndex(p => p.id === payoutId);
    if (payoutIndex === -1) {
      throw new ValidationError('Payout not found');
    }

    // Remove payout
    payouts.splice(payoutIndex, 1);

    // Update league settings
    await getLeagueSettingsService().updateLeague(leagueId, userId, {
      settings: { ...currentSettings, payouts },
    });

    return res.status(200).json({ message: 'Payout deleted successfully' });
  } catch (error) {
    next(error);
  }
};
