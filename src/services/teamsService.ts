// src/services/teamsService.ts
// Cleaner teams and helpers system

import { query } from "../db/client";
import { logger } from "../lib/logger";

// ============================================
// Types
// ============================================

export interface Team {
  id: number;
  owner_cleaner_id: string;
  name: string;
  description: string | null;
  max_members: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface TeamMember {
  id: number;
  team_id: number;
  cleaner_id: string;
  role: "owner" | "lead" | "member";
  invited_at: string;
  accepted_at: string | null;
  status: "pending" | "active" | "inactive";
  created_at: string;
  // Joined data
  cleaner_email?: string;
  cleaner_reliability?: number;
}

export interface TeamWithMembers extends Team {
  members: TeamMember[];
  member_count: number;
}

// ============================================
// Team CRUD
// ============================================

/**
 * Create a new team (owner is the creating cleaner)
 */
export async function createTeam(
  ownerCleanerId: string,
  name: string,
  description?: string
): Promise<Team> {
  // Check if cleaner already owns a team
  const existingResult = await query<{ id: number }>(
    `SELECT id FROM cleaner_teams WHERE owner_cleaner_id = $1 AND is_active = true`,
    [ownerCleanerId]
  );

  if (existingResult.rows.length > 0) {
    throw Object.assign(new Error("You already own a team"), { statusCode: 400 });
  }

  // Create team
  const teamResult = await query<Team>(
    `
      INSERT INTO cleaner_teams (owner_cleaner_id, name, description)
      VALUES ($1, $2, $3)
      RETURNING *
    `,
    [ownerCleanerId, name, description ?? null]
  );

  const team = teamResult.rows[0];

  // Add owner as first member
  await query(
    `
      INSERT INTO team_members (team_id, cleaner_id, role, status, accepted_at)
      VALUES ($1, $2, 'owner', 'active', NOW())
    `,
    [team.id, ownerCleanerId]
  );

  logger.info("team_created", { teamId: team.id, ownerId: ownerCleanerId });

  return team;
}

/**
 * Get team by ID
 */
export async function getTeamById(teamId: number): Promise<Team | null> {
  const result = await query<Team>(`SELECT * FROM cleaner_teams WHERE id = $1`, [teamId]);
  return result.rows[0] ?? null;
}

/**
 * Get team with members
 */
export async function getTeamWithMembers(teamId: number): Promise<TeamWithMembers | null> {
  const teamResult = await query<Team>(`SELECT * FROM cleaner_teams WHERE id = $1`, [teamId]);

  if (teamResult.rows.length === 0) return null;

  const team = teamResult.rows[0];

  const membersResult = await query<
    TeamMember & { cleaner_email: string; reliability_score: number }
  >(
    `
      SELECT 
        tm.*,
        u.email as cleaner_email,
        cp.reliability_score
      FROM team_members tm
      JOIN users u ON u.id = tm.cleaner_id
      LEFT JOIN cleaner_profiles cp ON cp.user_id = tm.cleaner_id
      WHERE tm.team_id = $1
      ORDER BY 
        CASE tm.role WHEN 'owner' THEN 1 WHEN 'lead' THEN 2 ELSE 3 END,
        tm.created_at ASC
    `,
    [teamId]
  );

  return {
    ...team,
    members: membersResult.rows.map((m) => ({
      ...m,
      cleaner_reliability: m.reliability_score,
    })),
    member_count: membersResult.rows.length,
  };
}

/**
 * Get team owned by a cleaner
 */
export async function getCleanerTeam(cleanerId: string): Promise<TeamWithMembers | null> {
  const result = await query<{ id: number }>(
    `SELECT id FROM cleaner_teams WHERE owner_cleaner_id = $1 AND is_active = true`,
    [cleanerId]
  );

  if (result.rows.length === 0) return null;

  return getTeamWithMembers(result.rows[0].id);
}

/**
 * Get teams a cleaner belongs to
 */
export async function getCleanerMemberships(cleanerId: string): Promise<
  Array<{
    team: Team;
    role: string;
    status: string;
  }>
> {
  const result = await query<TeamMember & { team_name: string; team_owner: string }>(
    `
      SELECT 
        tm.*,
        t.name as team_name,
        t.owner_cleaner_id as team_owner,
        t.*
      FROM team_members tm
      JOIN cleaner_teams t ON t.id = tm.team_id
      WHERE tm.cleaner_id = $1 AND t.is_active = true
    `,
    [cleanerId]
  );

  return result.rows.map((row) => ({
    team: {
      id: row.team_id,
      owner_cleaner_id: row.team_owner,
      name: row.team_name,
    } as Team,
    role: row.role,
    status: row.status,
  }));
}

/**
 * Update team details
 */
export async function updateTeam(
  teamId: number,
  ownerId: string,
  updates: { name?: string; description?: string }
): Promise<Team> {
  // Verify ownership
  const team = await getTeamById(teamId);
  if (!team) {
    throw Object.assign(new Error("Team not found"), { statusCode: 404 });
  }
  if (team.owner_cleaner_id !== ownerId) {
    throw Object.assign(new Error("Not team owner"), { statusCode: 403 });
  }

  const setClauses: string[] = [];
  const values: unknown[] = [];
  let paramIndex = 1;

  if (updates.name) {
    setClauses.push(`name = $${paramIndex++}`);
    values.push(updates.name);
  }
  if (updates.description !== undefined) {
    setClauses.push(`description = $${paramIndex++}`);
    values.push(updates.description);
  }

  if (setClauses.length === 0) return team;

  setClauses.push(`updated_at = NOW()`);
  values.push(teamId);

  const result = await query<Team>(
    `UPDATE cleaner_teams SET ${setClauses.join(", ")} WHERE id = $${paramIndex} RETURNING *`,
    values
  );

  logger.info("team_updated", { teamId });

  return result.rows[0];
}

/**
 * Deactivate team
 */
export async function deactivateTeam(teamId: number, ownerId: string): Promise<void> {
  const team = await getTeamById(teamId);
  if (!team) {
    throw Object.assign(new Error("Team not found"), { statusCode: 404 });
  }
  if (team.owner_cleaner_id !== ownerId) {
    throw Object.assign(new Error("Not team owner"), { statusCode: 403 });
  }

  await query(`UPDATE cleaner_teams SET is_active = false, updated_at = NOW() WHERE id = $1`, [
    teamId,
  ]);

  logger.info("team_deactivated", { teamId });
}

// ============================================
// Team Members
// ============================================

/**
 * Invite a cleaner to the team
 */
export async function inviteTeamMember(
  teamId: number,
  ownerId: string,
  cleanerId: string,
  role: "lead" | "member" = "member"
): Promise<TeamMember> {
  const team = await getTeamWithMembers(teamId);
  if (!team) {
    throw Object.assign(new Error("Team not found"), { statusCode: 404 });
  }
  if (team.owner_cleaner_id !== ownerId) {
    throw Object.assign(new Error("Not team owner"), { statusCode: 403 });
  }

  // Check max members
  if (team.member_count >= team.max_members) {
    throw Object.assign(new Error("Team is full"), { statusCode: 400 });
  }

  // Check if already a member
  const existingMember = team.members.find((m) => m.cleaner_id === cleanerId);
  if (existingMember) {
    throw Object.assign(new Error("Cleaner is already a team member"), { statusCode: 400 });
  }

  // Add member with pending status
  const result = await query<TeamMember>(
    `
      INSERT INTO team_members (team_id, cleaner_id, role, status)
      VALUES ($1, $2, $3, 'pending')
      RETURNING *
    `,
    [teamId, cleanerId, role]
  );

  logger.info("team_member_invited", { teamId, cleanerId, role });

  // TODO: Send notification to invited cleaner

  return result.rows[0];
}

/**
 * Accept team invitation
 */
export async function acceptTeamInvitation(teamId: number, cleanerId: string): Promise<TeamMember> {
  const result = await query<TeamMember>(
    `
      UPDATE team_members
      SET status = 'active', accepted_at = NOW()
      WHERE team_id = $1 AND cleaner_id = $2 AND status = 'pending'
      RETURNING *
    `,
    [teamId, cleanerId]
  );

  if (result.rows.length === 0) {
    throw Object.assign(new Error("No pending invitation found"), { statusCode: 404 });
  }

  logger.info("team_invitation_accepted", { teamId, cleanerId });

  return result.rows[0];
}

/**
 * Decline team invitation
 */
export async function declineTeamInvitation(teamId: number, cleanerId: string): Promise<void> {
  await query(
    `DELETE FROM team_members WHERE team_id = $1 AND cleaner_id = $2 AND status = 'pending'`,
    [teamId, cleanerId]
  );

  logger.info("team_invitation_declined", { teamId, cleanerId });
}

/**
 * Remove team member
 */
export async function removeTeamMember(
  teamId: number,
  ownerId: string,
  cleanerId: string
): Promise<void> {
  const team = await getTeamById(teamId);
  if (!team) {
    throw Object.assign(new Error("Team not found"), { statusCode: 404 });
  }
  if (team.owner_cleaner_id !== ownerId) {
    throw Object.assign(new Error("Not team owner"), { statusCode: 403 });
  }

  // Can't remove owner
  if (cleanerId === ownerId) {
    throw Object.assign(new Error("Cannot remove team owner"), { statusCode: 400 });
  }

  await query(`DELETE FROM team_members WHERE team_id = $1 AND cleaner_id = $2`, [
    teamId,
    cleanerId,
  ]);

  logger.info("team_member_removed", { teamId, cleanerId });
}

/**
 * Update member role
 */
export async function updateMemberRole(
  teamId: number,
  ownerId: string,
  cleanerId: string,
  newRole: "lead" | "member"
): Promise<TeamMember> {
  const team = await getTeamById(teamId);
  if (!team) {
    throw Object.assign(new Error("Team not found"), { statusCode: 404 });
  }
  if (team.owner_cleaner_id !== ownerId) {
    throw Object.assign(new Error("Not team owner"), { statusCode: 403 });
  }

  const result = await query<TeamMember>(
    `UPDATE team_members SET role = $3 WHERE team_id = $1 AND cleaner_id = $2 RETURNING *`,
    [teamId, cleanerId, newRole]
  );

  if (result.rows.length === 0) {
    throw Object.assign(new Error("Member not found"), { statusCode: 404 });
  }

  logger.info("team_member_role_updated", { teamId, cleanerId, newRole });

  return result.rows[0];
}

/**
 * Leave a team
 */
export async function leaveTeam(teamId: number, cleanerId: string): Promise<void> {
  const team = await getTeamById(teamId);
  if (!team) {
    throw Object.assign(new Error("Team not found"), { statusCode: 404 });
  }

  // Owner can't leave (must deactivate team)
  if (team.owner_cleaner_id === cleanerId) {
    throw Object.assign(new Error("Owner cannot leave team. Deactivate it instead."), {
      statusCode: 400,
    });
  }

  await query(`DELETE FROM team_members WHERE team_id = $1 AND cleaner_id = $2`, [
    teamId,
    cleanerId,
  ]);

  logger.info("team_member_left", { teamId, cleanerId });
}

// ============================================
// Team Job Assignment
// ============================================

/**
 * Assign a job to a team
 */
export async function assignJobToTeam(
  jobId: string,
  teamId: number,
  assignerId: string
): Promise<void> {
  // Verify team exists and assigner is owner or lead
  const team = await getTeamWithMembers(teamId);
  if (!team) {
    throw Object.assign(new Error("Team not found"), { statusCode: 404 });
  }

  const assignerMember = team.members.find((m) => m.cleaner_id === assignerId);
  if (!assignerMember || !["owner", "lead"].includes(assignerMember.role)) {
    throw Object.assign(new Error("Not authorized to assign jobs"), { statusCode: 403 });
  }

  await query(`UPDATE jobs SET team_id = $2, updated_at = NOW() WHERE id = $1`, [jobId, teamId]);

  logger.info("job_assigned_to_team", { jobId, teamId, assignerId });
}

/**
 * Get team statistics
 */
export async function getTeamStats(teamId: number): Promise<{
  totalJobs: number;
  completedJobs: number;
  avgRating: number;
  totalEarnings: number;
  memberStats: Array<{
    cleanerId: string;
    email: string;
    jobsCompleted: number;
    avgRating: number;
  }>;
}> {
  // Get team job stats
  const jobsResult = await query<{
    total_jobs: string;
    completed_jobs: string;
    avg_rating: string;
    total_earnings: string;
  }>(
    `
      SELECT
        COUNT(*)::text as total_jobs,
        COUNT(*) FILTER (WHERE status = 'completed')::text as completed_jobs,
        AVG(rating)::text as avg_rating,
        COALESCE(SUM(credit_amount) FILTER (WHERE status = 'completed'), 0)::text as total_earnings
      FROM jobs
      WHERE team_id = $1
    `,
    [teamId]
  );

  // Get per-member stats
  const memberStatsResult = await query<{
    cleaner_id: string;
    email: string;
    jobs_completed: string;
    avg_rating: string;
  }>(
    `
      SELECT
        j.cleaner_id,
        u.email,
        COUNT(*)::text as jobs_completed,
        AVG(j.rating)::text as avg_rating
      FROM jobs j
      JOIN users u ON u.id = j.cleaner_id
      WHERE j.team_id = $1 AND j.status = 'completed'
      GROUP BY j.cleaner_id, u.email
    `,
    [teamId]
  );

  const row = jobsResult.rows[0];

  return {
    totalJobs: Number(row?.total_jobs || 0),
    completedJobs: Number(row?.completed_jobs || 0),
    avgRating: Number(row?.avg_rating || 0),
    totalEarnings: Number(row?.total_earnings || 0),
    memberStats: memberStatsResult.rows.map((m) => ({
      cleanerId: m.cleaner_id,
      email: m.email,
      jobsCompleted: Number(m.jobs_completed),
      avgRating: Number(m.avg_rating || 0),
    })),
  };
}
