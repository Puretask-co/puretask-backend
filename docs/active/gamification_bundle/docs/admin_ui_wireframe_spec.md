# Step 10 — Admin UI Wireframe Spec (gamification control plane)

This is wireframe-level: screens + fields + permissions. Designers can render UI from this directly.

## Roles
- viewer: read-only
- support: read + explain + view audit
- ops: edit configs, budgets, governor, flags
- admin: all + manage admin users

---

## Screen A — Overview Dashboard (support+)
**Widgets**
- Level distribution (histogram)
- Avg time-to-level (sparkline)
- Disputes per level (bar)
- On-time rate per level (bar)
- Active reward cost burn (cash) daily/monthly
- Governor caps & current overrides (by region)
- Reward pause % (maintenance) by level

**Controls (ops+)**
- Emergency disable all rewards (toggle)
- Cash rewards enabled (toggle)
- Cash daily cap (cents)
- Cash monthly cap (cents)

---

## Screen B — Goals Config Versions (support+)
**List**
- config_type=goals
- version
- status
- effective_at
- created_at
- change_summary
- created_by

**Actions (ops+)**
- Create new version (JSON editor upload)
- Schedule effective_at
- Rollback to version

---

## Screen C — Rewards Config Versions (support+)
Same as Screen B but config_type=rewards.

---

## Screen D — Governor Console (support+)
**Region picker**
- region_id

**Live config**
- visibility_cap_multiplier
- early_exposure_cap_minutes
- fee_discount_cap_percent
- optional: cash_rewards_enabled_override

**Actions (ops+)**
- Save config JSON
- View audit history (filtered)

---

## Screen E — Feature Flags / A-B (support+)
**List flags**
- key
- region_id (null=global)
- enabled
- variant
- effective_at
- config JSON
- created_by

**Actions (ops+)**
- Set new flag entry (append-only)
- Schedule effective_at
- Disable by creating a new entry (enabled=false)

---

## Screen F — Audit Log (support+)
**Filters**
- actor
- action
- entity_type
- date range

**Rows**
- created_at
- actor
- action
- entity_type
- entity_id
- before/after diff view

---

## Screen G — Admin Users (admin only)
- create/disable users
- set roles
- rotate tokens (if you use token auth)
