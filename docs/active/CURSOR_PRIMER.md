# PureTask — Cursor Primer (Read This First)

> **Paste this into Cursor before the full gamification conversation.**
> It gives Cursor the mental model, rules, and framing so it reasons correctly.

---

## 1. What You Are About to See

You are looking at the design and implementation of a **full incentive, trust, and governance system** for a two-sided cleaning marketplace (PureTask).

This is **not just gamification**. It is:

- Progression system (Levels 1–10)
- Incentive engine (rewards, visibility, fee discounts)
- Anti-gaming framework (meaningful login, messages, photos)
- Revenue-quality optimizer (add-ons, reliability pricing)
- Marketplace health governor (regional thermostat)
- Admin control plane (config, budget, audit)
- Ops & support safety net (debug, macros, explainers)

**Most of it is already built and integrated** in this repo. Your job is to **wire, validate, extend** — not reinvent.

---

## 2. Core Product Truths (Do Not Violate)

These are non-negotiable.

1. Cleaners **never** lose levels.
2. Progress and rewards may **pause** if maintenance fails, but identity is permanent.
3. Customers **always** choose their cleaner — no forced assignment.
4. Visibility boosts are **relative**, never guarantees.
5. Goals unlock **tangible rewards**; leveling itself is minimal.
6. Anti-gaming rules apply everywhere.
7. System must scale **region by region**.
8. Admins must be able to pause, tune, audit, and rollback.

**If code conflicts with these, the code is wrong.**

---

## 3. What the System Does (Plain English)

### A. Cleaner Progression
Cleaners move through Levels 1–10. Each level has core goals (required), stretch goals (choice), and maintenance rules (ongoing health). Leveling up unlocks better opportunities, not just badges.

### B. Rewards
Rewards are: cash (capped), visibility boosts, early exposure, fee reductions, premium access. They are earned, temporary or conditional, and economically safe.

### C. Anti-Gaming
The system prevents fake behavior:
- Login counts only if real actions occur within 15 minutes.
- Messages count only if meaningful (template, 25+ chars, or customer reply).
- Photos count only if taken during the job (before + after, between clock-in and clock-out).
- Job declines are allowed if reasons are legitimate (distance, safety, timing).
- Acceptance rate is fair by design.

### D. Add-Ons (Revenue Quality)
Add-ons are selected during booking, priced by cleaners, scaled by reliability, tied to progression goals. This raises average order value without spam.

### E. Marketplace Health Governor
Monitors each region (supply/demand, fill times, cancels, disputes, ratings) and adjusts incentives like a thermostat. It does not force jobs, override customer choice, or create runaway advantages.

---

## 4. Key Constants (Canonical)

Use these everywhere. Do not change without product approval.

| Rule | Value |
|------|-------|
| Meaningful login window | 15 minutes |
| Meaningful message | template OR ≥25 chars OR customer reply in 24h |
| Photo verification | ≥1 before + ≥1 after, between clock-in and clock-out |
| On-time window | ±15 minutes |
| GPS radius | 250 meters |
| Short-notice decline | < 18 hours |
| Good-faith declines | 6 per 7 days |
| Distance decline (penalty-free) | travel radius 10 mi → penalty-free at ≥11 mi |

**If implementations drift, flag it.**

---

## 5. Architecture Mental Model

**Inputs:** Event stream (jobs, messages, photos, ratings, logins, disputes) → `pt_event_log`

**Processing:** Metrics engine → goal evaluation → reward granting (idempotent) → badges → seasonal modifiers → governor computation

**Outputs:** Progression API, reward activation state, ranking modifiers, admin endpoints, support/debug explanations

**Control:** Feature flags, budget caps, region governors, audit logs

---

## 6. Repo-Specific Facts

- **Events table:** `pt_event_log` (not `event_store`). Columns: `event_type`, `occurred_at`, `payload`.
- **DB client:** `query`, `withTransaction` from `src/db/client.ts`. No `withClient`.
- **Auth:** `requireAuth`, `requireAdmin` from `src/middleware/authCanonical.ts`.
- **Docs rule:** New .md only in `docs/active/` or `docs/archive/`. Append to existing docs when possible.

**For artifact locations and wiring:** read `docs/active/CURSOR_CONTEXT.md`.

---

## 7. How to Reason When Unsure

1. Check `docs/active/CURSOR_CONTEXT.md`.
2. Check `docs/active/ARCHITECTURE.md`.
3. Prefer configuration over new logic.
4. Prefer safety over aggressiveness.
5. Never break customer choice.

**If still unsure, stop and flag.**

---

## 8. Definition of Done

The system is correct when:

- Progress increments correctly with anti-gaming filters.
- Rewards grant only when allowed (caps, flags, governor).
- Cash never exceeds caps.
- Admin can explain every decision.
- Governor adapts without chaos.
- CI tests pass consistently.

---

## 9. What Not to Do

- Invent new rules.
- Simplify away safeguards.
- Collapse levels.
- Auto-assign customers.
- Remove fairness checks.
- Hardcode region behavior.

---

## 10. Suggested Order When Using This With the Full Conversation

1. **This file (CURSOR_PRIMER.md)** — mental model, rules, framing.
2. **docs/active/CURSOR_CONTEXT.md** — technical mapping, artifact locations, repo-specific wiring.
3. **Full conversation** — implementation history, design decisions, rollout plan.

---

END OF PRIMER
