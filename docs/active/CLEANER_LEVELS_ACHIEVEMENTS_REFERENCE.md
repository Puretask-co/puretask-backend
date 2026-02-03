# Cleaner Levels, Progress & Achievements — Full Reference

**Purpose:** Explain everything about cleaner progress, levels/tiers, milestones, achievements, certifications, and goals in PureTask.

---

## 1. "Levels" vs what the system actually has

PureTask does **not** have "level 1 to level 7" in the backend. It has:

| Concept | Count | What it is |
|--------|--------|------------|
| **Tiers** (reliability standing) | **4** | Developing → Semi Pro → Pro → Elite (from reliability score 0–100) |
| **Certification levels** | **4** | AI Assistant: Basic → Intermediate → Advanced → Master |
| **7** appears as | — | **7-job streak** (reliability bonus) and **7-day streak** (achievement) |

So "going from level 1 to level 7" in practice means either:
- **Tiers:** going from tier 1 (Developing) to tier 4 (Elite), or
- **Certifications:** going from cert level 1 (Basic) to level 4 (Master), or
- **Achievements:** e.g. earning the "7-Day Streak" achievement.

The rest of this doc describes each system in detail.

---

## 2. Tiers (reliability standing) — "Level 1" to "Level 4"

Cleaners have a **reliability score** (0–100). That score maps to one of **4 tiers**. Moving "up" means increasing your score so you cross into the next tier.

### 2.1 The four tiers

| Tier # | Name (canonical) | Legacy name | Score range | Payout % | Credit rate (min–max) |
|--------|-------------------|-------------|-------------|----------|------------------------|
| 1 | **Developing** | bronze | 0–59 | 80% | 150–350 |
| 2 | **Semi Pro** | silver | 60–74 | 82% | 350–450 |
| 3 | **Pro** | gold | 75–89 | 84% | 450–600 |
| 4 | **Elite** | platinum | 90–100 | 85% | 600–850 |

- **Backend / DB:** Tiers are stored as canonical names (e.g. `Pro`) or legacy (e.g. `gold`).
- **Code:** `src/lib/tiers.ts`, `src/core/config.ts` (RELIABILITY_CONFIG), `src/core/scoring.ts`.

### 2.2 What it takes to go from tier 1 to tier 4

Your **reliability score** is recalculated from your recent jobs (last 30 jobs or 60 days). To move up:

1. **Reach the next tier's minimum score**
   - Developing → Semi Pro: score ≥ 60
   - Semi Pro → Pro: score ≥ 75
   - Pro → Elite: score ≥ 90

2. **Score is built from:**
   - **Base behavior (up to 90 pts):** attendance, punctuality, photo compliance, communication, completion, ratings (see §3).
   - **Streak bonus (up to +10 pts):** each block of **7 consecutive "perfect" jobs** adds +2 pts (max +10).
   - **Minus penalties:** late reschedules, cancellations, no-shows, disputes, inconvenience patterns (see §3).

So "level 1 → 7" in a tier sense is really **Developing (1) → Semi Pro (2) → Pro (3) → Elite (4)** by raising your reliability score.

---

## 3. Reliability score — how it's calculated

- **Config:** `src/core/config.ts` (RELIABILITY_CONFIG).
- **Logic:** `src/core/reliabilityScoreV2Service.ts`.

### 3.1 Windows

- Last **30** jobs (completed/attempted), or last **60** days.
- Minimum **5** jobs for a full score; new cleaners get a **provisional score of 70** and blend with real score until **5** completed jobs.

### 3.2 Base behavior (max 90 points)

| Component | Max points | What it measures |
|-----------|------------|-------------------|
| Attendance | 25 | Showing up, not no-show |
| Punctuality | 20 | Check-in within 15 min of scheduled start |
| Photo compliance | 15 | At least 3 "after" photos when required |
| Communication | 10 | Proactive message, response within 2h |
| Completion | 10 | Job completed (not cancelled/disputed) |
| Ratings | 10 | Client star rating (scaled to 10) |

### 3.3 Streak bonus (max +10 points)

- Jobs are sorted by scheduled start.
- **Blocks of 7:** each block of 7 consecutive jobs is checked.
- A block is **"perfect"** if: no no-shows, no cleaner cancellations, no disputes (cleaner at fault), punctuality rate ≥ 90%, photo compliance rate ≥ 90%.
- **+2 points** per perfect 7-job block, **capped at +10** total.

So "7" in progress = **7-job perfect streak blocks** that boost your score.

### 3.4 Penalties (subtracted from score)

| Event | Penalty |
|-------|---------|
| Late reschedule by cleaner (<24h) | −3 each (cap −9) |
| Cancel 24–48h before | −8 |
| Cancel <24h before | −12 |
| No-show (cleaner) | −25 |
| Dispute (cleaner at fault) | −10 (cap −20) |
| Inconvenience pattern | −5 (extra −5 if 5+ events) |

Final score = base + streak bonus − penalties, clamped to 0–100. Tier is then read from the tier bands above.

---

## 4. Milestones (what cleaners are working toward)

### 4.1 Tier milestones (reliability)

- **60** → Semi Pro (better payout %, higher rate range).
- **75** → Pro.
- **90** → Elite (top payout % and rate range).

### 4.2 Onboarding milestones (10 steps)

- Agreements (terms, contractor, background consent).
- Basic info.
- Phone send/verify OTP.
- Face photo.
- ID verification.
- Background consent.
- Service areas.
- Availability.
- Rates.
- Complete.

Completion is tracked in `cleaner_onboarding_progress` and used for achievements and certifications.

### 4.3 Monthly goal milestones (jobs per month)

- **STARTER:** 10 jobs → 50 bonus credits.
- **REGULAR:** 20 jobs → 150 bonus credits.
- **PRO:** 35 jobs → 300 bonus credits.
- **ELITE:** 50 jobs → 500 bonus credits.

Which template applies is based on the cleaner's recent average monthly jobs (e.g. avg ≥ 40 → ELITE template). See `src/services/cleanerGoalsService.ts` (GOAL_TEMPLATES).

---

## 5. Achievements (what cleaners are trying to achieve)

Achievements are stored in the `achievements` table; earned ones in `cleaner_achievements`. Criteria are in JSON (e.g. `profile_completion`, `setup_wizard_completed`).
**API:** `GET /gamification/achievements` (and related routes in `src/routes/gamification.ts`).

### 5.1 Full list (seeded in DB)

| # | Key | Name | Category | Tier | Points | Criteria |
|---|-----|------|----------|------|--------|----------|
| 1 | first_login | Welcome Aboard! 👋 | onboarding | bronze | 10 | First login |
| 2 | profile_complete | Profile Pro ⭐ | onboarding | silver | 25 | Profile 100% complete |
| 3 | setup_wizard | Quick Starter 🚀 | onboarding | bronze | 15 | Setup wizard completed |
| 4 | first_template | Template Explorer 📝 | activity | bronze | 10 | Used first message template |
| 5 | template_creator | Content Creator ✨ | activity | silver | 20 | Created first custom template |
| 6 | quick_response_master | Quick Responder ⚡ | activity | silver | 20 | Added 5+ quick responses |
| 7 | template_customizer | Customization Expert 🎨 | activity | gold | 30 | Customized 10+ templates |
| 8 | week_warrior | 7-Day Streak 🔥 | engagement | silver | 25 | Active 7 consecutive days |
| 9 | month_master | 30-Day Champion 🏆 | engagement | gold | 50 | Active 30 days |
| 10 | insights_explorer | Data Detective 🔍 | discovery | bronze | 10 | Viewed insights dashboard |
| 11 | settings_exporter | Backup Pro 💾 | discovery | bronze | 10 | Exported AI settings |
| 12 | favorite_picker | Favorites Fan 💖 | discovery | bronze | 10 | Marked a quick response as favorite |
| 13 | ai_personality | AI Personality Set 🤖 | onboarding | silver | 20 | Set AI personality |
| 14 | power_user | Power User 💪 | milestone | platinum | 100 | Profile 100%, wizard done, 5+ templates customized |

So cleaners are "trying to achieve" these 14 achievements; the **7-day streak** is the "7" in achievements.

---

## 6. Certifications (4 levels — "Level 1" to "Level 4")

Certifications are **AI Assistant** skill levels. Stored in `certifications`; earned in `cleaner_certifications`.
**API:** `GET /gamification/certifications`, `POST /gamification/certifications/:id/claim`.

### 6.1 The four certification levels

| Level | Key | Name | Requirements (summary) | Benefits (summary) |
|-------|-----|------|------------------------|--------------------|
| 1 | ai_assistant_basic | AI Assistant Basics | Profile 50%, 3 templates customized, 5 quick responses | Basic templates, community forum |
| 2 | ai_assistant_intermediate | AI Assistant Intermediate | Profile 75%, 10 templates, 15 quick responses, 1 custom template | Priority support, advanced library, analytics |
| 3 | ai_assistant_advanced | AI Assistant Advanced | Profile 90%, 20 templates, 25 quick responses, viewed insights, exported settings | 1-on-1 coaching, featured in marketplace, beta access |
| 4 | ai_assistant_master | AI Assistant Master | Profile 100%, 50 templates, 50 quick responses, 30 days since signup | Lifetime priority support, webinars, revenue share on templates, master badge |

Requirements are JSON (e.g. `profile_completion`, `templates_customized`, `quick_responses_added`). Progress is computed in the gamification route; when progress ≥ 100% the cleaner can claim the certification.

So "level 1 to level 7" for certs is actually **level 1 to level 4** (Basic → Master).

---

## 7. Summary: what it takes to go "from level 1 to the top"

### By tiers (reliability)

1. **Developing (1)** → **Semi Pro (2):** Score ≥ 60 (good attendance, on-time check-ins, photos, no no-shows/cancels).
2. **Semi Pro (2)** → **Pro (3):** Score ≥ 75 (keep consistency, 7-job perfect blocks help).
3. **Pro (3)** → **Elite (4):** Score ≥ 90 (very consistent, minimal cancellations/disputes, strong ratings).

### By certifications (AI Assistant)

1. **Basic (1)** → Complete profile 50%, customize 3 templates, add 5 quick responses.
2. **Intermediate (2)** → Profile 75%, 10 templates, 15 quick responses, create 1 custom template.
3. **Advanced (3)** → Profile 90%, 20 templates, 25 quick responses, use insights and export settings.
4. **Master (4)** → Profile 100%, 50 templates, 50 quick responses, 30 days active.

### By achievements

- Unlock all 14 achievements (login, profile, wizard, templates, quick responses, 7-day streak, 30-day, insights, settings, favorites, AI personality, power user).
- "7" here = **7-Day Streak** achievement.

### By monthly goals

- Hit STARTER (10 jobs), then REGULAR (20), PRO (35), ELITE (50) for bonus credits.

---

## 8. References in code

| What | Where |
|------|--------|
| Tier names and score bands | `src/lib/tiers.ts`, `src/core/config.ts` (RELIABILITY_CONFIG) |
| Reliability calculation | `src/core/reliabilityScoreV2Service.ts`, `src/core/scoring.ts` |
| Streak bonus (7-job block) | `src/core/config.ts` (streakBonus), `reliabilityScoreV2Service.ts` (computeStreakBonus) |
| Goals (monthly job targets) | `src/services/cleanerGoalsService.ts` (GOAL_TEMPLATES, TIER_THRESHOLDS) |
| Achievements & certifications | `src/routes/gamification.ts`, DB migrations `030_onboarding_gamification_NEON_FIX.sql` |
| Onboarding progress | `cleaner_onboarding_progress` table, `src/routes/cleanerOnboarding.ts`, `src/routes/gamification.ts` |

---

**Last updated:** 2026-01-31
