# PureTask Backend – Implementation Plan (From Specs to Code)

This plan turns the completed specs into implementation steps. It is organized to minimize risk and leverage existing code (most APIs already exist); focus on gaps, correctness, and wiring (Stripe/n8n/payouts/refunds).

## Guiding Principles
- Do not rewrite what already works; tighten correctness and idempotency against specs.
- Preserve contractor independence: PureTask facilitates; cleaners choose; long-wave visibility; no supervision of methods.
- Ship incrementally with validation after each step (integrity checks).

## Sprint 0 – Setup & Baseline Checks
- [ ] Confirm consolidated schema + seed load cleanly in target env.
- [ ] Add/verify test identities: `test-client`, `test-cleaner` (with Connect test ID), optional subscription.
- [ ] Ensure `.env` has Stripe test keys, n8n webhook secret/URL; run `stripe listen --forward-to …`.
- [ ] Run `scripts/verify_integrity.sql` on a seeded DB (replace placeholders) and fix any mismatch.

## Sprint 1 – Stripe/n8n Wiring & Idempotency
- [ ] Review `routes/stripe.ts`, `services/*` to ensure event coverage matches `infra/STRIPE_WEBHOOK_ROUTER.md`.
- [ ] Enforce idempotency on handlers (event_id + object_id) per `micro/STRIPE_IDEMPOTENCY.md`.
- [ ] Verify wallet/ledger updates for `payment_intent.succeeded`, `invoice.paid`, `charge.refunded`, `charge.dispute.*`, `payout.*`.
- [ ] Ensure webhook signature verification is on; unknown events log and 200 OK (no-op).
- [ ] Add/review n8n flows to align with router (ingest → router → handlers).

## Sprint 2 – Jobs & Approval/Earnings Correctness
- [ ] Verify job status machine matches `job/JOB_STATUS_MACHINE.md`; block invalid transitions.
- [ ] Approve endpoint idempotent: one escrow_release, one earnings row.
- [ ] Completion gating: check-in + required photos per `job/PHOTO_VERIFICATION.md`.
- [ ] Dispute path blocks approval; cancellation/no-show follow policy (refund/reversal, reliability).
- [ ] Earnings = escrow_release (until fees/splits are added); status flow pending → in_payout → paid.

## Sprint 3 – Refunds & Negative Earnings
- [ ] Implement/refine refund handler per `infra/REFUND_PROCESSOR.md` and `financial Refund Logic Spec`.
- [ ] Before/after payout refund paths: reverse earnings or create negative adjustments; prevent double refunds.
- [ ] Chargeback handling: freeze/flag; on lost dispute create negative earning; wallet/ledger consistent.
- [ ] Admin refunds: ledger-backed, reasoned, idempotent; Stripe refund mapping to original charge/invoice.

## Sprint 4 – Payouts
- [ ] Implement/refine payout processor per `infra/PAYOUT_PROCESSOR.md`: select eligible earnings, net negatives, create payouts, attach earnings, call Stripe, update statuses on `payout.paid/failed`.
- [ ] Caps on negative offsets if policy applies; skip cleaners without Connect.
- [ ] Integrity: payout.total == sum(earnings), paid payouts == paid earnings totals.

## Sprint 5 – Assignment Engine (Marketplace-Safe)
- [ ] Configure long-wave visibility (e.g., 24h) and score/tier-based ranking per `infra/ASSIGNMENT_ENGINE.md`.
- [ ] No forced assignment; voluntary accept; expand radius/tiers per wave; limit spam (max concurrent offers).
- [ ] Filter high-risk flags; handle no-cleaner-found → reschedule/notify/refund.

## Sprint 6 – Admin/Ops Hardening
- [ ] Admin wallet/refund/dispute/earnings adjustments: ensure all actions write ledger, are audited, and are idempotent.
- [ ] Risk flags: block payouts or bookings as configured; audit flag changes.
- [ ] Monitoring/Logging: surface webhook/payout/refund failures; integrity mismatches; admin action audit logs.

## Sprint 7 – UI/UX Alignment (API-facing)
- [ ] Ensure API responses support UI specs (booking UX, post-job UX, cleaner app UX, error states).
- [ ] Clear error codes/messages for payment failures, payout failures, disputes.
- [ ] Preserve idempotency keys on approve/refund-sensitive endpoints.

## Sprint 8 – Future Features (Optional)
- [ ] Tipping, promos/referrals, membership/tier, platform fee/commission, bonuses, instant payout, multi-cleaner jobs.

## Testing & Validation (ongoing each sprint)
- Run scenario suite (A–O) from `docs/TESTING_GUIDE.md`.
- Use integrity SQL (`scripts/verify_integrity.sql`) after payout/refund/dispute flows.
- Stripe CLI triggers for PI success/fail, invoice paid/fail, charge.refunded, charge.dispute.*, payout.*.
- API smoke/integration tests (existing `src/tests`); add cases for disputes/refunds/payouts/idempotency.

## Deployment Safeguards
- Blue/green or staging verification: run migrations, seeds, integrity checks before prod.
- Monitor Stripe webhook delivery and payout failure rates; alert on integrity mismatches.
- Keep contractor independence language in TOS/UX; avoid features that imply supervision.

