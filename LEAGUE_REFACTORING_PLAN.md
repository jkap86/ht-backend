# League Controller Refactoring Plan

## Overview
This document outlines the plan to refactor `leagues.controller.ts` to use a proper service layer architecture, eliminating the ~35+ direct `pool.query` calls.

## Current State
- ✅ `IRosterRepository` and `RosterRepository` created (commit 6952078)
- ✅ `ILeagueRepository` and `LeagueRepository` exist with basic CRUD
- ❌ `leagues.controller.ts` has ~35+ direct database queries
- ❌ Business logic mixed with controller code
- ❌ No comprehensive `LeagueService` for complex operations

## Architecture Pattern
Following the same pattern as ChatService refactoring:
```
Controller (HTTP) -> Service (Business Logic) -> Repository (Data Access) -> Database
```

## Step 1: Extend ILeagueRepository

Add these methods to `src/domain/repositories/ILeagueRepository.ts`:

```typescript
export interface ILeagueRepository {
  // ... existing methods ...

  /**
   * Find league with commissioner roster ID
   */
  findByIdWithCommissioner(id: number, userId: string): Promise<LeagueWithCommissioner | null>;

  /**
   * Reset league (delete all draft-related data)
   * Should be called within a transaction
   */
  resetLeague(leagueId: number): Promise<void>;
}

export interface LeagueWithCommissioner extends League {
  commissioner_roster_id?: number;
  user_roster_id?: number;
}
```

## Step 2: Implement in LeagueRepository

Add to `src/infrastructure/repositories/LeagueRepository.ts`:

```typescript
async findByIdWithCommissioner(
  id: number,
  userId: string
): Promise<LeagueWithCommissioner | null> {
  const result = await this.db.query(
    `SELECT
      l.*,
      commissioner.roster_id as commissioner_roster_id,
      user_roster.roster_id as user_roster_id
     FROM leagues l
     LEFT JOIN rosters commissioner ON l.commissioner_roster_id = commissioner.roster_id AND l.id = commissioner.league_id
     LEFT JOIN rosters user_roster ON l.id = user_roster.league_id AND user_roster.user_id = $1
     WHERE l.id = $2`,
    [userId, id]
  );

  return result.rows.length > 0 ? League.fromDatabase(result.rows[0]) : null;
}

async resetLeague(leagueId: number): Promise<void> {
  // Delete all rosters
  await this.db.query('DELETE FROM rosters WHERE league_id = $1', [leagueId]);

  // Delete draft picks
  await this.db.query('DELETE FROM draft_picks WHERE league_id = $1', [leagueId]);

  // Reset league to pre_draft status
  await this.db.query(
    `UPDATE leagues
     SET status = 'pre_draft',
         commissioner_roster_id = NULL,
         updated_at = CURRENT_TIMESTAMP
     WHERE id = $1`,
    [leagueId]
  );
}
```

## Step 3: Create Comprehensive LeagueService

Create new file or completely rewrite `src/application/services/LeagueService.ts`:

### Required Dependencies
```typescript
import { ILeagueRepository } from '../../domain/repositories/ILeagueRepository';
import { IRosterRepository } from '../../domain/repositories/IRosterRepository';
import { ChatService } from './ChatService';
import { Pool, PoolClient } from 'pg';
```

### Service Methods Needed

#### 1. `getUserLeagues(userId: string)`
- Uses: `leagueRepo.findByUserId()`
- Returns: User's leagues with roster info

#### 2. `getLeagueById(leagueId: number, userId: string)`
- Uses: `leagueRepo.findByIdWithCommissioner()`
- Validates: User is member
- Returns: League with commissioner and user roster info

#### 3. `createLeague(params, userId: string)`
- Creates league via `leagueRepo.create()`
- Creates commissioner roster via `rosterRepo.create()`
- Updates league with commissioner_roster_id
- Sends system message via `chatService.sendSystemMessage()`
- Returns: League with commissioner info

####  4. `joinLeague(leagueId: number, userId: string)`
- Validates: League exists and not full
- Validates: User not already member
- Gets next roster ID via `rosterRepo.getNextRosterId()`
- Creates roster via `rosterRepo.create()`
- Sends system message
- Returns: Roster info

#### 5. `updateLeague(leagueId, userId, updates)`
- Validates: User is member
- Gets username for system message
- Updates league via `leagueRepo.update()`
- Tracks changes and sends system message if needed
- Returns: Updated league

#### 6. `resetLeague(leagueId: number, userId: string)`
- Validates: User is member
- Uses transaction with `PoolClient`
- Calls `leagueRepo.resetLeague()` within transaction
- Sends system message
- Returns: Success message

#### 7. `getLeagueMembers(leagueId: number, userId: string)`
- Validates: User is member
- Gets members via `rosterRepo.getLeagueMembers()`
- Returns: Member list

#### 8. `bulkAddUsers(leagueId, usernames, userId)`
- Validates: User is member and league not full
- Finds users via `rosterRepo.findUsersByUsernames()`
- For each user:
  - Check if already member
  - Get next roster ID
  - Create roster
  - Send system message
- Returns: Results array (success/failure per user)

#### 9. `updatePaymentStatus(leagueId, rosterId, paid, userId)`
- Validates: User is member
- Gets roster via `rosterRepo.findByLeagueAndRosterId()`
- Updates settings via `rosterRepo.updateSettings()`
- Gets member username for system message
- Sends system message
- Returns: Updated roster

## Step 4: Refactor leagues.controller.ts

For each endpoint, follow this pattern:

### Before (Current):
```typescript
export const getLeagues = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user?.userId;
    const result = await pool.query<LeagueRow>(/* complex SQL */);
    return res.status(200).json(result.rows);
  } catch (error) {
    next(error);
  }
};
```

### After (Target):
```typescript
const leagueService = new LeagueService(leagueRepo, rosterRepo, chatService);

export const getLeagues = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user?.userId;

    if (!userId) {
      throw new ValidationError("User ID not found in request");
    }

    const leagues = await leagueService.getUserLeagues(userId);

    return res.status(200).json(leagues);
  } catch (error) {
    next(error);
  }
};
```

### Endpoints to Refactor:
1. `getLeagues` - GET /api/leagues
2. `getLeagueById` - GET /api/leagues/:leagueId
3. `joinLeague` - POST /api/leagues/:leagueId/join
4. `createLeague` - POST /api/leagues
5. `updateLeagueSettings` - PATCH /api/leagues/:leagueId
6. `resetLeague` - POST /api/leagues/:leagueId/reset
7. `getPublicLeagues` - GET /api/leagues/public
8. `getLeagueMembers` - GET /api/leagues/:leagueId/members
9. `bulkAddUsers` - POST /api/leagues/:leagueId/bulk-add
10. `updateMemberPaymentStatus` - PATCH /api/leagues/:leagueId/rosters/:rosterId/payment

## Step 5: Testing Strategy

### Before Committing:
1. Verify TypeScript compiles without errors
2. Test each endpoint manually or with existing tests
3. Verify WebSocket system messages still work
4. Check transaction handling for resetLeague

### Test Cases:
- Create league → verify system message sent
- Join league → verify roster created and system message sent
- Reset league → verify rosters deleted and league status reset
- Bulk add → verify partial success handling
- Update payment → verify system message sent

## Step 6: Commit Strategy

### Commit 1: Repository Extensions
```bash
git add src/domain/repositories/ILeagueRepository.ts src/infrastructure/repositories/LeagueRepository.ts
git commit -m "Extend LeagueRepository with commissioner and reset methods"
```

### Commit 2: LeagueService
```bash
git add src/application/services/LeagueService.ts
git commit -m "Create comprehensive LeagueService with all business logic"
```

### Commit 3: Controller Refactoring
```bash
git add src/app/controllers/leagues.controller.ts
git commit -m "Refactor leagues.controller to use LeagueService

- Replace ~35 direct pool queries with service layer calls
- Move all business logic to LeagueService
- Keep controller thin - only HTTP request/response handling
- Maintain all existing functionality and system messages
"
```

## Implementation Notes

### Service Instantiation
In the controller, instantiate services like ChatService:
```typescript
import { LeagueService } from '../../application/services/LeagueService';
import { LeagueRepository } from '../../infrastructure/repositories/LeagueRepository';
import { RosterRepository } from '../../infrastructure/repositories/RosterRepository';
import { ChatService } from '../../application/services/ChatService';
import { pool } from '../../db/pool';

const leagueRepo = new LeagueRepository(pool);
const rosterRepo = new RosterRepository(pool);
const chatService = new ChatService();
const leagueService = new LeagueService(leagueRepo, rosterRepo, chatService);
```

### Transaction Handling
For `resetLeague`, use pg Pool client:
```typescript
const client = await this.db.connect();
try {
  await client.query('BEGIN');
  // ... operations ...
  await client.query('COMMIT');
} catch (error) {
  await client.query('ROLLBACK');
  throw error;
} finally {
  client.release();
}
```

### System Messages
All system messages should go through `ChatService.sendSystemMessage()`:
```typescript
await this.chatService.sendSystemMessage(
  leagueId,
  `${username} joined the league`,
  { event: 'user_joined', username, roster_id: rosterId }
);
```

## Benefits

1. **Separation of Concerns**: Controllers handle HTTP, services handle business logic, repositories handle data
2. **Testability**: Services can be unit tested independently
3. **Maintainability**: Business logic centralized in one place
4. **Reusability**: Service methods can be called from other places (e.g., admin tools, CLI)
5. **Consistency**: Same pattern as ChatService refactoring

## Estimated Effort

- Repository extensions: ~30 minutes
- LeagueService implementation: ~2-3 hours
- Controller refactoring: ~2-3 hours
- Testing: ~1-2 hours

**Total: 6-9 hours for complete, tested implementation**
