# Section 11 — Admin Ops Console & Support Tooling (Full Runbook)

**Objective:** Internal admin system reduces support time, enforces consistent decisions, manages disputes/refunds/payouts safely, gives full auditability, surfaces risk and operational blind spots.

**Exit condition:** Any support scenario (unhappy client, disputed job, payout hold, fraud suspicion, refund request) can be handled quickly, consistently, safely — with a complete record.

---

## 11.1 Core Principles (IC-Safe)

- **Admin is a separate product:** Routes under /api/admin/*; strong auth + strict roles.  
- **Least privilege:** support_agent (read + limited actions); support_lead (refunds/credits within limits); ops_finance (payout holds/releases); admin (superuser).  
- **IC-safe language:** “Platform status adjustment” not “override completion”; “risk indicators” not “warnings”; no PIPs, mandatory re-cleans, or productivity targets.

---

## 11.2 Action Authorization Matrix (Deliverable)

| Action | Support Agent | Support Lead | Ops Finance | Admin |
|--------|---------------|--------------|-------------|-------|
| View user/job | ✅ | ✅ | ✅ | ✅ |
| View dispute evidence | ✅ | ✅ | ✅ | ✅ |
| Refund (small) | ❌ | ✅ | ✅ | ✅ |
| Refund (large) | ❌ | ❌ | ✅ | ✅ |
| Hold payout | ❌ | ❌ | ✅ | ✅ |
| Override dispute | ❌ | ✅ | ✅ | ✅ |
| Change user role | ❌ | ❌ | ❌ | ✅ |

**Deliverable:** Finalized RBAC matrix.

---

## 11.3 Admin Audit Logging (Non-Negotiable)

Every action logged:

- **who** (admin id)  
- **when**  
- **what** (action type)  
- **target entity** (user/job/dispute/payout)  
- **before/after** (where safe)  
- **reason** (required)  
- **requestId / correlationId**  

**Rule:** No action can execute without a reason string.

---

## 11.4 Primary Admin Surfaces

| Surface | Purpose |
|---------|---------|
| **Dashboard** | Open disputes; failed webhooks; failed payouts; jobs pending verification; notification failures; cleaner reliability distribution; flagged accounts |
| **User Management** | Search/view profile, bookings, disputes, payouts, reliability, flags; actions: disable/enable, reset verification, apply warning flag, adjust credits (with ledger + reason) |
| **Job/Booking Management** | View job details, timeline, photos, messages; actions: cancel (with reason), override completion, partial refund, reassign (optional), internal notes; show state machine timeline |
| **Dispute Resolution Center** | Dispute reason + description; job timeline; before/after photos; chat/messages; prior disputes; decision playbook suggestions; actions: request evidence, issue credit, partial refund, deny, hold payout, escalate |
| **Payments, Credits, Payouts** | View payment intents/charges, refunds, escrow holds/releases, payout batches, failures; actions: create refund (with limits), credit adjustment (ledger entry), hold/release payout, retry payout (idempotent) |
| **Webhook Events & Delivery Logs** | List by status (pending/failed); filter by provider/type; view payload (redacted); processing attempts/errors; replay event safely (idempotent); delivery log: email/sms/push attempts, provider message ID, error codes, retry button (where safe) |

---

## 11.5 Standard Playbooks

- **Dispute playbook templates:** Categories (cleaner no-show, client no-show, “cleaning not good enough,” missed areas, damages claim, scam suspicion); required evidence; decision options; recommended resolution ranges (% refund, credit amount, payout hold duration); escalation thresholds.  
- **Refund rules:** Max refund by role; refund windows (e.g. 48h after completion); automatic fraud triggers.

**Deliverable:** Playbook library v1.

---

## 11.6 Risk & Fraud Signals

- **Flags:** Excessive disputes filed; excessive refunds requested; multiple accounts same payment method (if detected); repeated no-shows; high cancellation rate.  
- **Severity score + auto-actions (optional):** Require manual approval for bookings; force photo evidence; payout delays.  

**Deliverable:** Risk flags catalog + actions.

---

## 11.7 Case Management & PII

- **Case records:** Every dispute/support scenario = case; links to user/job/dispute/payment; internal notes; status (open/in-progress/resolved); assignee (optional); resolution summary.  
- **PII redaction:** Admin sees what they need; mask phone/email by default; show full only for elevated roles; never show full payment details; use Stripe references only.  
- **Secure photo viewing:** Signed URLs (short TTL); optional watermarking later; never expose permanent public URLs.

---

## 11.8 Admin UI Requirements

- **Global search:** Users, jobs, disputes, payments, webhook events.  
- **Filters and saved views:** “Disputes opened last 24h”; “Payout failures”; “High-risk clients”; “Cleaners with reliability drop.”  
- **Action confirmations:** High-risk actions require confirmation modal + reason field; optional second approver for large refunds (later).

---

## 11.9 Testing & Safety

- **Permission tests:** support_agent cannot refund; finance can hold payouts; only admin can change roles.  
- **Audit log tests:** Every action writes audit record; missing reason blocks action.  
- **Idempotency:** Retry payout doesn’t double-pay; replay webhook doesn’t double-apply.

---

## 11.10 Done Checklist

- [ ] Admin RBAC matrix implemented  
- [ ] Admin actions require reason and produce audit log  
- [ ] Dashboard includes high-signal operational KPIs  
- [ ] User/job/dispute/payment views complete  
- [ ] Refund/credit/payout actions guarded and idempotent  
- [ ] Webhook events and delivery log tools exist  
- [ ] Playbooks for disputes defined and usable  
- [ ] Risk flags catalog exists and is actionable  
- [ ] Case management (notes + resolution) exists  
- [ ] PII redaction rules enforced  
- [ ] IC-safe admin language used everywhere  
- [ ] Permission and audit tests pass  

---

**See also:** [MASTER_CHECKLIST.md](../MASTER_CHECKLIST.md) — Section 11 checklist.
