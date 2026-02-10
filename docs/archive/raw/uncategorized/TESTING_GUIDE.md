# PureTask – Stripe & Lifecycle Testing Guide (v1.0)

Polished, startup-style operational and engineering guide for validating PureTask’s end-to-end money and job flows.

---

## SECTION 1 — Purpose & Scope
**What this guide is:** End-to-end testing playbook for every revenue-critical workflow:
- Stripe credit purchases, subscriptions, auto-refill
- Credit escrow for jobs, job lifecycle, completion flows
- Refunds, disputes, cleaner earnings, weekly payouts
- Connect onboarding, reliability system, tier adjustments

**Why it matters:** Ensures credits are created/escrowed/released correctly, earnings and payouts are accurate, refunds/disputes reverse ledgers, subscriptions and auto-refill stay in sync, and webhook retries/out-of-order events cause no damage.

**Who uses this:** Founder, backend engineers, n8n/automation engineers, QA, support, DevOps/SRE, new hires.

**Artifacts before testing:**
- Three terminals: backend (`npm run dev`), Stripe listener (`stripe listen --forward-to https://puretask.app.n8n.cloud/webhook/stripe/webhook`), trigger window (`stripe trigger …`)
- n8n access: `01 – Stripe Webhook Ingest`, `02 – Stripe Event Router`, job/payout/subscription workflows
- DB access: `users`, `jobs`, `earnings`, `payouts`, `stripe_events`, `credit_ledger`, `reliability_events`, `credit_subscriptions`, `auto_refill_settings`
- Stripe Dashboard (test mode)

**Use case categories:** Happy, Edge, Negative, Resilience.

---

## SECTION 2 — System Architecture & Flow Maps
**Stripe → n8n → Backend**
- Stripe (test) → CLI listener → n8n Ingest (`01`) → verify signature → log `stripe_events` → dedupe → Router (`02`) → handlers:
  - `payment_intent.succeeded` (credits purchase)
  - `invoice.paid` (subscription renewal)
  - `invoice.payment_failed` (dunning)
  - `charge.refunded` (refund)
  - `payout.paid` (payout confirm)
  - `payout.failed` (payout fail)
  - `account.updated` (Connect status)

**Credit Economy**
- Entry: PI succeeded / invoice.paid / auto-refill → wallet credits
- Hold: booking creates `escrow_hold`
- Release: approval → earnings
- Reverse: refunds/disputes
- Ledger: wallet_purchase, escrow_hold, escrow_release, refund, adjustment

**Job Lifecycle**
- `created → assigned → accepted → in_progress → completed → approved → archived`
- Ties to escrow, reliability, earnings creation.

**Earnings & Payouts**
- Approval → earnings → weekly batch → Stripe payout → `payout.paid`/`payout.failed` updates payouts/earnings.

**Reliability & Tier**
- Events: on-time, GPS, photos, cancellations, disputes → reliability score → tier → visibility/payout effects.

**Subscription & Auto-Refill**
- `invoice.paid` credits monthly; `invoice.payment_failed` dunning.
- Auto-refill hourly detects low balance → PI → credits on success.

**Validation checklist (Section 2)**
- All Stripe events mapped; signature + dedupe present
- Credit lifecycle mapped end-to-end
- Job states and links to escrow/earnings mapped
- Payout confirmation/failure mapped
- Reliability, subscription, auto-refill, Connect flows included

---

## SECTION 3 — Stripe Event Canon & Full Use Cases
Canonical events (7):
1) `payment_intent.succeeded` — One-off credit purchase (incl. auto-refill).  
   - DB: `stripe_events`, ledger `wallet_purchase`, wallet balance ↑.  
   - Use cases: first purchase; back-to-back; auto-refill; duplicate event (dedupe).
2) `invoice.paid` — Subscription renewal credits.  
   - DB: ledger `wallet_purchase` (source=subscription), wallet balance ↑, subscription next billing.  
   - Use cases: renewal during low balance; renewal after dunning.
3) `invoice.payment_failed` — Dunning.  
   - DB: log; subscription flagged for retry; payment issue flag.  
   - Use cases: consecutive failures; recovery after card update.
4) `charge.refunded` — Refund prior purchase.  
   - DB: ledger `refund`, wallet balance ↓ if available, log refund.  
   - Use cases: refund after partial spend; duplicate refund (dedupe).
5) `payout.paid` — Cleaner payout success.  
   - DB: `payouts.status=paid`, set `stripe_payout_id`, linked earnings paid.  
   - Use cases: multiple jobs in one payout; event early/late vs batch.
6) `payout.failed` — Payout failed.  
   - DB: `payouts.status=failed`, reason stored, earnings remain unpaid.  
   - Use cases: bad bank info; retry after fix; repeated failures.
7) `account.updated` — Connect status change.  
   - DB: update `connect_status`/requirements; affects payout eligibility.  
   - Use cases: onboarding complete; restricted; requirements pending.

**Validation checklist (Section 3)**
- All 7 events present; router paths correct
- DB + ledger effects noted
- Job/escrow/payout interactions mapped
- Use cases: happy/edge/negative/resilience covered

---

## SECTION 4 — Booking → Escrow Testing
**Flow**
- Booking request → estimate hours × tier rate → required credits
- Check wallet; if enough → ledger `escrow_hold`, wallet ↓, job stores escrow amount
- If not enough → auto-refill (PI) or wait for subscription credits; otherwise block booking

**Tests**
1) Enough credits: create booking → expect `jobs` row, `escrow_hold`, wallet ↓, ledger consistent.  
2) Insufficient credits → auto-refill: booking attempt triggers auto-refill; after `payment_intent.succeeded`, booking proceeds; ledger shows `wallet_purchase` + `escrow_hold`.  
3) Subscription credits pending: renewal adds credits, then booking succeeds.  
4) Duplicate booking attempts: separate jobs allowed; no double escrow per job; no double charges.  
5) Oversized job with low balance: booking blocked/queued; clear error; no partial hold.

**Negative/Failure**
- Refund while booking pending → booking fails (insufficient).  
- Auto-refill card decline (`invoice.payment_failed`) → booking blocked.  
- Ledger mismatch alerts if wallet vs ledger diverge.

**Resilience**
- Duplicate PI succeeded → single credit deposit (dedupe).  
- Out-of-order PI arrival → booking retries/queues safely.

**Validation checklist (Section 4)**
- Job row + escrow_hold created; wallet math correct; ledger consistent
- Auto-refill triggers only when needed; no double holds/charges
- Booking fails cleanly on insufficient/decline

---

## SECTION 5 — Job Execution → Completion Testing
**State machine (execution phase)**  
`accepted → in_progress → completed` (approval is Section 6).

**Acceptance**
- Cleaner must accept: `jobs.status=accepted`, `accepted_at`, reliability event `job_accepted`.
- Cases: normal; delayed accept; accept then cancel (penalty).

**In-progress (GPS check-in)**
- Endpoint: `POST /jobs/:id/check-in` with GPS.  
- Expected: `jobs.status=in_progress`; location logged; reliability event `check_in` with distance/on_time.  
- Cases: on-time; slightly off radius; early/late; far away; no location permission; duplicate check-ins ignored; retry on temporary failure.

**Photos**
- Before photos at check-in; after photos at completion (during optional).  
- Stored in `job_media`; reliability event `photos_uploaded`.  
- Cases: required counts met; extra photos; slow uploads; missing photos → block completion; duplicate uploads tolerated/ignored.

**Completion**
- Endpoint: `PATCH /jobs/:id/complete`.  
- Preconditions: check-in exists; before/after photos present.  
- Expected: `jobs.status=completed`; `completed_at`; reliability event `job_completed` with duration.  
- Cases: early/late finish; partial photo set but meets minimum; no photos → reject; no check-in → reject; duplicate completion ignored.

**Reliability during execution**
- On-time check-in (positive); late check-in (negative); missing photos (negative/block); no-show/late cancel (major negative). Stored in `reliability_events` → rolls into score/tier.

**Time tracking**
- Must have `accepted_at`, `check_in_at`, `completed_at`; durations non-negative; chronological order enforced.

**Validation checklist (Section 5)**
- Status transitions valid; timestamps present/in order
- GPS logged; distance + on-time computed; reliability updated
- Before/after photos present in storage + DB
- Completion allowed only when prerequisites met; no duplicate effects
- Reliability events captured once; no double-penalties

---

## SECTION 6 — Approval → Escrow Release → Earnings Creation
**Flow**
- After completion, client approval triggers money movement.
- Approval prerequisites: job `completed`; GPS check-in; before & after photos; required metadata; not already approved/disputed.

**On approval**
- Ledger: `escrow_release` (amount = escrow) + `earning`.
- Wallet unchanged (already deducted at escrow).
- Earnings row: `pending`, linked to job/cleaner.
- Job: `status=approved`, `approved_at`.
- Reliability: positive event.

**On denial/dispute (no approval)**
- Job → `disputed`; NO escrow release; NO earnings; dispute flow (Section 7); potential cleaner penalty.

**Tests**
1) Standard approval: one release + one earning; wallet unchanged; job approved.  
2) Duplicate approvals: idempotent — no double release/earnings.  
3) Missing prerequisites: approval rejected; no ledger/earnings.  
4) Approve-before-complete: blocked.  
5) Slow/duplicate requests: no double effects; timestamps consistent.

**Validation checklist (Section 6)**
- Job approved + `approved_at`
- `escrow_hold` exists; `escrow_release` recorded; wallet unchanged
- Earnings row created (`pending`, correct amount)
- Reliability event added
- Duplicate approvals safe

---

## SECTION 7 — Refunds & Disputes
**Refund types**
- Credit purchase refund (`charge.refunded`)
- Subscription refund (`invoice` charge refund)
- Job refund (escrow reversal)
- Stripe chargeback (`charge.dispute.*`)

**Escrow reversal by job state**
- Not approved: return escrow to wallet; no earnings.
- Approved, not paid: reverse escrow + reverse earnings.
- Paid out: reverse escrow + reverse earnings + negative earning adjustment (cleaner owes).

**Dispute flow**
- Client denies → job `disputed`, escrow frozen.
- Outcomes: cleaner wins → release escrow/approve; client wins → refund, reverse earnings, negative adjustment if already paid.

**Stripe chargeback**
- `charge.dispute.created`: freeze related funds, flag job/cleaner.
- `charge.dispute.closed`: if client wins → treat like refund-after-payout; if platform wins → clear flags.

**Tests**
1) Refund before execution: credits removed; booking blocked.  
2) Refund in-progress: wallet decreases; escrow locked; approval blocked.  
3) Refund after completion, before approval: escrow reversed; no earnings.  
4) Refund after approval, before payout: reverse earnings; no payout.  
5) Refund after payout: negative earning created; next payout nets it.  
6) Duplicate refunds: idempotent.  
7) Chargeback created/closed: follows dispute logic; no double refund.

**Validation checklist (Section 7)**
- Ledger balanced; wallet non-negative (or explicit debt flag)
- Escrow reversed appropriately; no stray releases
- Earnings reversed/negative adjustments as needed
- Disputed jobs blocked from payout
- Stripe events idempotent

---

## SECTION 8 — Weekly Payouts (Stripe Connect)
**Flow**
- Earnings (`pending`) → weekly payout processor → payout per cleaner → Stripe → `payout.paid` / `payout.failed` webhooks → DB updates.

**Processor (n8n)**
- Fetch earnings `status=pending` with Connect account.
- Group by cleaner; sum totals; create `payouts` row (`status=initiated`, `stripe_payout_id=null`).
- Call Stripe payout API; mark earnings `in_payout`.

**Webhooks**
- `payout.paid`: payouts → `paid`; earnings → `paid`; set `stripe_payout_id`, `paid_at`.
- `payout.failed`: payouts → `failed`; store reason; earnings remain unpaid/return to pending; notify admin/cleaner.

**Negative earnings**
- Net positive + negative per cleaner; if net ≤ 0 → no payout; carry forward; flag for review.

**Tests**
1) Normal batch: multiple earnings → one payout/cleaner; sums match.  
2) Multiple cleaners: no mixing.  
3) Missing Connect: earnings stay pending; logged.  
4) Simulate `payout.paid`: statuses update; idempotent on retry.  
5) Simulate `payout.failed`: payout failed; earnings not paid.  
6) Negative adjustment: netting correct; skip if net ≤ 0.  
7) Run processor twice: no duplicate payouts.  
8) Duplicate `payout.paid`: idempotent.

**Validation checklist (Section 8)**
- Earnings pending before run; payouts rows per cleaner; amounts correct
- On success: payouts/earnings marked paid; Stripe IDs stored
- On failure: payouts failed; earnings not paid; notifications sent
- Negative adjustments netted correctly
- Processor + webhooks idempotent

---

## SECTION 9 — System-Wide Financial Integrity
**Core invariants**
- (Total credits purchased – total refunds) = net credits ever in wallet
- Net wallet credits – escrow holds + escrow releases = active wallet balance
- Sum(escrow releases) = Sum(earnings) (± negative adjustments)
- Sum(paid earnings) ≈ Sum(payouts)

**Integrity tests**
1) Wallet vs ledger: recompute wallet from ledger (purchases, subs, holds, releases, refunds) → equals stored wallet.  
2) Escrow holds vs releases: only open jobs retain escrow; approved/refunded jobs have zero active escrow.  
3) Earnings vs escrow releases: per job, earning == escrow_release; system-wide sums match (± negatives).  
4) Payouts vs paid earnings: payouts total == paid earnings; no earning in multiple payouts; no reversed earnings in payouts.  
5) Refunds: refund amounts map to original transactions; no double refunds; ledger balanced.  
6) Disputes: disputed jobs have frozen escrow; no earnings/payouts if client wins; correct if cleaner wins.  
7) Idempotency: replay Stripe events (PI, refund, payout.*) → no duplicate effects.  
8) Audit simulation: full lifecycle with later refund → all equations hold; no orphaned records.

**Validation checklist (Section 9)**
- Wallet == ledger-derived; no impossible negatives
- No unreleased escrow on approved jobs; no double releases
- Earnings sum matches escrow releases (± negatives)
- Payouts match paid earnings; no duplicates
- Refunds/disputes balanced; no double actions
- Webhook/flow replays are safe

---

## SECTION 10 — Full End-to-End Scenarios (Master Suite)
Master Scenarios:
- **A — Perfect Job → Normal Payout:** PI succeeded → booking/escrow → execution → approval → earnings → payout → `payout.paid` → integrity checks.
- **B — Dispute → Refund (No Payout):** Client denies → dispute → refund/escrow reversal → no earnings/payout → idempotent refund.
- **C — Refund After Payout → Negative Earnings:** Happy path through payout, then refund → reverse escrow/earnings → negative adjustment → next payout nets it.
- **D — Auto-Refill During Booking:** Low wallet; booking triggers auto-refill (PI succeeded) → credits added → escrow created; single hold/debit; no double auto-refill.
- **E — Subscription Renewal → Credits → Booking:** `invoice.paid` adds credits → booking uses subscription credits → normal flow; no auto-refill if sufficient.
- **F — Job Cancellation Flows:** Early client cancel → full refund; late client cancel → partial/no refund; cleaner cancel → full client refund + cleaner reliability penalty.
- **G — Cleaner No-Show:** Auto-mark no_show → full refund to client; no earnings; strong reliability penalty.
- **H — Payment Failure / Decline:** `payment_intent.payment_failed` or auto-refill decline → wallet unchanged; booking blocked; no bad ledger writes.
- **I — Stripe Chargeback:** `charge.dispute.created/closed` → freeze funds; if client wins, treat like refund-after-payout; if platform wins, clear flags; no double refunds.
- **J — Multi-Job Client Flow:** One credit pack funds multiple jobs; each job independent; refunds/disputes isolated; payouts only for approved jobs.
- **K — Job Reassignment:** Cleaner A removed; cleaner B finishes; earnings only to B; penalties to A as applicable; escrow tied to job.
- **L — Out-of-Order Webhooks:** Mixed/late Stripe events → idempotent handling keeps final state correct (no double credit/refund/payout).
- **M — n8n Failure & Retry:** Workflow crash/retry in payout/refund/router → retries do not double-create payouts/refunds; DB guards respected.
- **N — Low Wallet / Rounding:** Fractional wallet + booking → auto-refill tops up correctly; no negative wallet; no rounding bugs.
- **O — High Volume / Batch:** Many clients/jobs/payouts/refunds/disputes → run integrity queries (Section 9); all invariants hold.

**Scenario steps & checks (examples)**
- D: Low wallet → auto-refill PI → `payment_intent.succeeded` → wallet_purchase + escrow_hold; no double auto-refill; job proceeds.
- E: `invoice.paid` → wallet up → booking uses sub credits; normal escrow/approval/payout.
- F: Early cancel → escrow_reversal + wallet_refund; late cancel → partial; cleaner cancel → full refund + cleaner penalty.
- G: No check-in → job auto no_show → full refund; no earnings; reliability hit.
- I: chargeback created → freeze; closed → if client wins, reverse like C; if win, clear flags; idempotent.
- M: Force n8n failure then retry → no duplicate payouts/refunds; idempotency holds.
- O: Run batches, then run Section 9 integrity SQL to confirm balances.

**End-to-end checklist**
- Credits: purchase/refund correct; wallet matches ledger
- Booking/Escrow: holds placed/released/reversed correctly
- Execution: check-in/photos/completion validated
- Approval: earnings created; release recorded; no duplicates
- Payout: batches correct; `payout.paid/failure` handled; no double pay
- Refunds/Disputes: reversals correct; negative adjustments when needed
- Integrity: Section 9 equations hold; no orphaned records; no negatives unless explicit

---

## Master Scenario → Event/Workflow Map
- W1: `01 – Stripe Webhook Ingest`; W2: `02 – Stripe Event Router`; W3: Auto-Refill; W4: Subscription Renewal; W5: Weekly Payout Processor; W6: Refund Handler; W7: Dispute/Chargeback Handler; W8: Reliability/Job Events; Backend: job/approval APIs.
- A: `payment_intent.succeeded`, `payout.paid` → W1, W2, W3 (if needed), W5, W8, Backend.
- B: `charge.refunded` (if card) → W1, W2, W6, W7, Backend, W8.
- C: `charge.refunded` or `charge.dispute.*` → W1, W2, W6, W7, W5 (next payout), Backend.
- D: `payment_intent.succeeded` → W1, W2, W3, Backend.
- E: `invoice.paid`/`invoice.payment_failed` → W1, W2, W4, W3 (if needed), Backend.
- F: none (unless refund) → Backend, W6 (if refund), W8.
- G: none at no-show moment (refund may trigger `charge.refunded`) → Backend scheduler, W6, W8.
- H: `payment_intent.payment_failed` → W1, W2, W3, Backend.
- I: `charge.dispute.created/closed` → W1, W2, W7, W6, W5 (future correction), Backend.
- J: `payment_intent.succeeded`, `invoice.paid`, `payout.paid` → W1–W5, Backend, W8.
- K: none (unless refund) → Backend, W8, W6 (if refund).
- L: any mix → W1, W2 + relevant handlers.
- M: any originating event → W1–W7 with retry safeguards.
- N: `payment_intent.succeeded` (auto-refill) → W1, W2, W3, Backend.
- O: all of the above.

---

## Additional Scenario Groups (Sub + Micro)
**Micro / Unit (system internals)**
- Stripe event units: handle each event; signature check; duplicate/unknown events safe.
- Ledger write units: wallet_purchase, escrow_hold/release, refund, earning, negative_adjustment with validation/idempotency.
- Wallet math units: add/subtract/refund; fractional; prevent negatives.
- Status machine units: allowed vs forbidden transitions.
- Reliability units: each reliability_event effect.
- DB/constraints: required foreign keys (job_id, cleaner_id); time ordering.
- Idempotency-key units: same event/operation key → no double side-effect.

**UI/UX**
- Client booking UX: new/returning, with/without credits/subscription, low balance → auto-refill; errors (address/time).
- Client post-job UX: approve/deny/dispute; ratings; delayed approval; guardrails on disputed/settled jobs.
- Cleaner workday UX: view/accept; check-in GPS; photos; offline/slow upload handling.
- Error/edge UX: payment failure (client), payout failure (cleaner), suspension/restriction CTAs.

**Admin/Ops**
- Wallet & credits: manual credit/debit; freeze wallet; all logged; ledger entries with admin + reason.
- Earnings/payout corrections: bonus/clawback; manually resolve payout; lock payouts until KYC.
- Disputes: client wins, cleaner wins, partial; reason codes; internal notes required.
- Risk/fraud/compliance: high-risk flags; pause payouts; audit log of toggles.

**Future/Optional Features**
- Tipping: at approval/after job; adjustments post-dispute.
- Promotions/discounts: promo codes; subscription bonuses; referrals; visible ledger lines.
- Marketplace fees/splits: platform fee per job; dynamic commissions; fee holidays.
- Other: tiered membership; instant payouts; multi-cleaner/team jobs.

---

## Locked Spec Groups (what can be formalized next)
- **Financial Specs:** Credit Purchase; Wallet; Auto-Refill; Subscription Credits; Escrow; Approval→Earnings; Refunds; Disputes; Negative Earnings; Payout Pipeline; Chargeback Response; Financial Integrity.
- **Job Lifecycle Specs:** Booking; Pricing/Credit Calc; Status Machine; Cleaner Workflow; Photo Verification; Cancellation Rules; No-Show Detection; Reassignment.
- **Micro/Unit Specs:** Stripe Event Handling; Stripe Idempotency; Ledger Entry Rules; Wallet Math; Earnings Math; Reliability Score; DB Constraints.
- **UI/UX Specs:** Client Booking UX; Client Post-Job UX; Cleaner App UX; Account/Settings UX; Payment Failure UX; Payout Failure UX; Dispute UX.
- **Admin/Ops Specs:** Admin Wallet Controls; Admin Dispute Resolution; Admin Refund Controls; Admin Earnings Adjustment; Admin Risk/Fraud Rules; Admin Monitoring & Logging; Admin Job Override Tools.
- **Infrastructure Specs:** n8n Orchestration; Stripe Webhook Router; Payout Processor; Refund Processor; DB Schema/Migrations; API Endpoints; Monitoring & Alerting.
- **Future Feature Specs:** Tipping; Promo/Referral; Tiered Membership; Platform Fees/Commission; Cleaner Bonus/Rewards; Instant Payout; Multi-Cleaner/Team Jobs.

---

## Review Status
- Sections 1–5: compiled from approved content; arbiter-reviewed for alignment with backend, n8n workflows, Stripe canon, credit system, job lifecycle, and reliability model.
- Future sections to be filled following the same pattern (declare → describe → deliver → use cases → validation checklist → review).


