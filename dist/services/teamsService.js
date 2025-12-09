"use strict";
// src/services/teamsService.ts
// Cleaner teams and helpers system
Object.defineProperty(exports, "__esModule", { value: true });
exports.createTeam = createTeam;
exports.getTeamById = getTeamById;
exports.getTeamWithMembers = getTeamWithMembers;
exports.getCleanerTeam = getCleanerTeam;
exports.getCleanerMemberships = getCleanerMemberships;
exports.updateTeam = updateTeam;
exports.deactivateTeam = deactivateTeam;
exports.inviteTeamMember = inviteTeamMember;
exports.acceptTeamInvitation = acceptTeamInvitation;
exports.declineTeamInvitation = declineTeamInvitation;
exports.removeTeamMember = removeTeamMember;
exports.updateMemberRole = updateMemberRole;
exports.leaveTeam = leaveTeam;
exports.assignJobToTeam = assignJobToTeam;
exports.getTeamStats = getTeamStats;
const client_1 = require("../db/client");
const logger_1 = require("../lib/logger");
// ============================================
// Team CRUD
// ============================================
/**
 * Create a new team (owner is the creating cleaner)
 */
async function createTeam(ownerCleanerId, name, description) {
    // Check if cleaner already owns a team
    const existingResult = await (0, client_1.query)(`SELECT id FROM cleaner_teams WHERE owner_cleaner_id = $1 AND is_active = true`, [ownerCleanerId]);
    if (existingResult.rows.length > 0) {
        throw Object.assign(new Error("You already own a team"), { statusCode: 400 });
    }
    // Create team
    const teamResult = await (0, client_1.query)(`
      INSERT INTO cleaner_teams (owner_cleaner_id, name, description)
      VALUES ($1, $2, $3)
      RETURNING *
    `, [ownerCleanerId, name, description ?? null]);
    const team = teamResult.rows[0];
    // Add owner as first member
    await (0, client_1.query)(`
      INSERT INTO team_members (team_id, cleaner_id, role, status, accepted_at)
      VALUES ($1, $2, 'owner', 'active', NOW())
    `, [team.id, ownerCleanerId]);
    logger_1.logger.info("team_created", { teamId: team.id, ownerId: ownerCleanerId });
    return team;
}
/**
 * Get team by ID
 */
async function getTeamById(teamId) {
    const result = await (0, client_1.query)(`SELECT * FROM cleaner_teams WHERE id = $1`, [teamId]);
    return result.rows[0] ?? null;
}
/**
 * Get team with members
 */
async function getTeamWithMembers(teamId) {
    const teamResult = await (0, client_1.query)(`SELECT * FROM cleaner_teams WHERE id = $1`, [teamId]);
    if (teamResult.rows.length === 0)
        return null;
    const team = teamResult.rows[0];
    const membersResult = await (0, client_1.query)(`
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
    `, [teamId]);
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
async function getCleanerTeam(cleanerId) {
    const result = await (0, client_1.query)(`SELECT id FROM cleaner_teams WHERE owner_cleaner_id = $1 AND is_active = true`, [cleanerId]);
    if (result.rows.length === 0)
        return null;
    return getTeamWithMembers(result.rows[0].id);
}
/**
 * Get teams a cleaner belongs to
 */
async function getCleanerMemberships(cleanerId) {
    const result = await (0, client_1.query)(`
      SELECT 
        tm.*,
        t.name as team_name,
        t.owner_cleaner_id as team_owner,
        t.*
      FROM team_members tm
      JOIN cleaner_teams t ON t.id = tm.team_id
      WHERE tm.cleaner_id = $1 AND t.is_active = true
    `, [cleanerId]);
    return result.rows.map((row) => ({
        team: {
            id: row.team_id,
            owner_cleaner_id: row.team_owner,
            name: row.team_name,
        },
        role: row.role,
        status: row.status,
    }));
}
/**
 * Update team details
 */
async function updateTeam(teamId, ownerId, updates) {
    // Verify ownership
    const team = await getTeamById(teamId);
    if (!team) {
        throw Object.assign(new Error("Team not found"), { statusCode: 404 });
    }
    if (team.owner_cleaner_id !== ownerId) {
        throw Object.assign(new Error("Not team owner"), { statusCode: 403 });
    }
    const setClauses = [];
    const values = [];
    let paramIndex = 1;
    if (updates.name) {
        setClauses.push(`name = $${paramIndex++}`);
        values.push(updates.name);
    }
    if (updates.description !== undefined) {
        setClauses.push(`description = $${paramIndex++}`);
        values.push(updates.description);
    }
    if (setClauses.length === 0)
        return team;
    setClauses.push(`updated_at = NOW()`);
    values.push(teamId);
    const result = await (0, client_1.query)(`UPDATE cleaner_teams SET ${setClauses.join(", ")} WHERE id = $${paramIndex} RETURNING *`, values);
    logger_1.logger.info("team_updated", { teamId });
    return result.rows[0];
}
/**
 * Deactivate team
 */
async function deactivateTeam(teamId, ownerId) {
    const team = await getTeamById(teamId);
    if (!team) {
        throw Object.assign(new Error("Team not found"), { statusCode: 404 });
    }
    if (team.owner_cleaner_id !== ownerId) {
        throw Object.assign(new Error("Not team owner"), { statusCode: 403 });
    }
    await (0, client_1.query)(`UPDATE cleaner_teams SET is_active = false, updated_at = NOW() WHERE id = $1`, [teamId]);
    logger_1.logger.info("team_deactivated", { teamId });
}
// ============================================
// Team Members
// ============================================
/**
 * Invite a cleaner to the team
 */
async function inviteTeamMember(teamId, ownerId, cleanerId, role = "member") {
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
    const result = await (0, client_1.query)(`
      INSERT INTO team_members (team_id, cleaner_id, role, status)
      VALUES ($1, $2, $3, 'pending')
      RETURNING *
    `, [teamId, cleanerId, role]);
    logger_1.logger.info("team_member_invited", { teamId, cleanerId, role });
    // TODO: Send notification to invited cleaner
    return result.rows[0];
}
/**
 * Accept team invitation
 */
async function acceptTeamInvitation(teamId, cleanerId) {
    const result = await (0, client_1.query)(`
      UPDATE team_members
      SET status = 'active', accepted_at = NOW()
      WHERE team_id = $1 AND cleaner_id = $2 AND status = 'pending'
      RETURNING *
    `, [teamId, cleanerId]);
    if (result.rows.length === 0) {
        throw Object.assign(new Error("No pending invitation found"), { statusCode: 404 });
    }
    logger_1.logger.info("team_invitation_accepted", { teamId, cleanerId });
    return result.rows[0];
}
/**
 * Decline team invitation
 */
async function declineTeamInvitation(teamId, cleanerId) {
    await (0, client_1.query)(`DELETE FROM team_members WHERE team_id = $1 AND cleaner_id = $2 AND status = 'pending'`, [teamId, cleanerId]);
    logger_1.logger.info("team_invitation_declined", { teamId, cleanerId });
}
/**
 * Remove team member
 */
async function removeTeamMember(teamId, ownerId, cleanerId) {
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
    await (0, client_1.query)(`DELETE FROM team_members WHERE team_id = $1 AND cleaner_id = $2`, [teamId, cleanerId]);
    logger_1.logger.info("team_member_removed", { teamId, cleanerId });
}
/**
 * Update member role
 */
async function updateMemberRole(teamId, ownerId, cleanerId, newRole) {
    const team = await getTeamById(teamId);
    if (!team) {
        throw Object.assign(new Error("Team not found"), { statusCode: 404 });
    }
    if (team.owner_cleaner_id !== ownerId) {
        throw Object.assign(new Error("Not team owner"), { statusCode: 403 });
    }
    const result = await (0, client_1.query)(`UPDATE team_members SET role = $3 WHERE team_id = $1 AND cleaner_id = $2 RETURNING *`, [teamId, cleanerId, newRole]);
    if (result.rows.length === 0) {
        throw Object.assign(new Error("Member not found"), { statusCode: 404 });
    }
    logger_1.logger.info("team_member_role_updated", { teamId, cleanerId, newRole });
    return result.rows[0];
}
/**
 * Leave a team
 */
async function leaveTeam(teamId, cleanerId) {
    const team = await getTeamById(teamId);
    if (!team) {
        throw Object.assign(new Error("Team not found"), { statusCode: 404 });
    }
    // Owner can't leave (must deactivate team)
    if (team.owner_cleaner_id === cleanerId) {
        throw Object.assign(new Error("Owner cannot leave team. Deactivate it instead."), { statusCode: 400 });
    }
    await (0, client_1.query)(`DELETE FROM team_members WHERE team_id = $1 AND cleaner_id = $2`, [teamId, cleanerId]);
    logger_1.logger.info("team_member_left", { teamId, cleanerId });
}
// ============================================
// Team Job Assignment
// ============================================
/**
 * Assign a job to a team
 */
async function assignJobToTeam(jobId, teamId, assignerId) {
    // Verify team exists and assigner is owner or lead
    const team = await getTeamWithMembers(teamId);
    if (!team) {
        throw Object.assign(new Error("Team not found"), { statusCode: 404 });
    }
    const assignerMember = team.members.find((m) => m.cleaner_id === assignerId);
    if (!assignerMember || !["owner", "lead"].includes(assignerMember.role)) {
        throw Object.assign(new Error("Not authorized to assign jobs"), { statusCode: 403 });
    }
    await (0, client_1.query)(`UPDATE jobs SET team_id = $2, updated_at = NOW() WHERE id = $1`, [jobId, teamId]);
    logger_1.logger.info("job_assigned_to_team", { jobId, teamId, assignerId });
}
/**
 * Get team statistics
 */
async function getTeamStats(teamId) {
    // Get team job stats
    const jobsResult = await (0, client_1.query)(`
      SELECT
        COUNT(*)::text as total_jobs,
        COUNT(*) FILTER (WHERE status = 'completed')::text as completed_jobs,
        AVG(rating)::text as avg_rating,
        COALESCE(SUM(credit_amount) FILTER (WHERE status = 'completed'), 0)::text as total_earnings
      FROM jobs
      WHERE team_id = $1
    `, [teamId]);
    // Get per-member stats
    const memberStatsResult = await (0, client_1.query)(`
      SELECT
        j.cleaner_id,
        u.email,
        COUNT(*)::text as jobs_completed,
        AVG(j.rating)::text as avg_rating
      FROM jobs j
      JOIN users u ON u.id = j.cleaner_id
      WHERE j.team_id = $1 AND j.status = 'completed'
      GROUP BY j.cleaner_id, u.email
    `, [teamId]);
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
