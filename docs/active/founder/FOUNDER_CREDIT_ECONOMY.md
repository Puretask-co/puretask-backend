# Founder Reference: Credit Economy (balance, spend, decay)

**Candidate:** Credit economy (Module #34)  
**Where it lives:** `creditsService`, `creditEconomyService`, spend on job, decay, tier lock  
**Why document:** How credits are earned and spent, and how decay/tier lock work in the economy.

---

## The 8 main questions

### 1. What it is

**Technical:** The credit economy in PureTask is the set of rules and services that control how credits are earned, spent, and adjusted, and how reliability (tier) is protected or decayed. **creditsService:** balance (sum of credit_ledger), spend (debit on job completion), add (purchase, refund, adjustment). **creditEconomyService:** (1) **Bonus cap** — weekly bonus cap (e.g. 50 credits/week), canReceiveBonus, awardBonusCredits (with cap and optional bypassCap); (2) **Reliability decay** — applyReliabilityDecay: cleaners inactive for DECAY_INACTIVE_WEEKS (e.g. 2) lose DECAY_RATE_PER_WEEK (e.g. 2) points until min 50, unless tier lock; (3) **Tier lock** — TIER_LOCK_DAYS (e.g. 7) after promotion so tier can’t drop immediately; (4) **Cancellation policy** — LIFETIME_GRACE_CANCELLATIONS (e.g. 2), CANCEL_FREE_HOURS (48), CANCEL_PARTIAL_HOURS (24), fee percentages (50% / 100%); (5) **Anti-fraud** — FRAUD_RAPID_BONUS_THRESHOLD, FRAUD_LARGE_ADJUSTMENT_THRESHOLD, checkRapidBonusActivity, createFraudAlert; (6) **Cleaner penalties** — NO_SHOW_PENALTY_CLEANER (25), LATE_CANCEL_PENALTY_CLEANER (10); (7) **Photo compliance bonus** — PHOTO_COMPLIANCE_BONUS (10) per Photo Proof policy. Config: CREDIT_ECONOMY_CONFIG in creditEconomyService.

**Simple (like for a 10-year-old):** The credit economy is the “rules of money and level” in the app. We track how many credits you have and how you earn and spend them. We cap how much bonus we give per week, we let your “level” (reliability) go down a bit if you’re inactive (unless you’re in a “lock” period), we have rules for cancellation fees and for no-shows and photo proof, and we watch for weird bonus activity (fraud).

### 2. Where it is used

**Technical:** `src/services/creditsService.ts` — balance, spend, add, ledger entries; `src/services/creditEconomyService.ts` — CREDIT_ECONOMY_CONFIG, getUserWeeklyBonusTotal, canReceiveBonus, awardBonusCredits, applyReliabilityDecay, isTierLocked, cancellation fee logic, checkRapidBonusActivity, createFraudAlert, no-show/late-cancel penalties, createAuditLog. Used by: paymentService (purchase → add credits), payoutsService (spend on job completion), referralService (awardBonusCredits), cleanerGoalsService (awardBonusCredits), reliabilityService (photo compliance bonus), disputes (refund → add), cancellation (fee logic), workers (decay, no-show penalty). DB: credit_ledger, credit_bonuses, reliability_history, fraud_alerts, cleaner_profiles (tier, reliability_score).

**Simple (like for a 10-year-old):** The code lives in creditsService and creditEconomyService. When someone buys credits, completes a job, gets a referral or goal reward, gets a refund, or we apply a cancellation fee or no-show penalty, we use this. The decay and tier lock and fraud checks are in creditEconomyService. The database has the ledger, bonuses, reliability history, and fraud alerts.

### 3. When we use it

**Technical:** When a client purchases credits (paymentService → add); when a job is completed (payoutsService/creditsService → spend from client, release to cleaner); when we award referral or goal bonus (awardBonusCredits); when we apply reliability decay (scheduled worker); when we check or set tier lock (on tier promotion); when we apply cancellation fee or no-show/late-cancel penalty; when we create a fraud alert (rapid bonus or large adjustment); when we add photo compliance bonus (reliability flow). Triggered by payment, job completion, referral qualification, goal completion, scheduled decay, cancellation, no-show detection, and bonus/adjustment flows.

**Simple (like for a 10-year-old):** We use it when someone buys credits, when a job is done (we take credits from the client and give to the cleaner), when we pay referral or goal bonuses, when we run the “decay” job for inactive cleaners, when we lock or unlock tier, when we charge a cancellation fee or apply a no-show penalty, when we flag weird bonus activity, and when we add the photo compliance bonus.

### 4. How it is used

**Technical:** **Balance:** sum credit_ledger delta_credits for user_id. **Spend:** debit (negative delta) with reason (e.g. job), idempotent by job if required. **Add:** credit (positive delta) for purchase, refund, adjustment, bonus (bonus goes through awardBonusCredits so cap applies unless bypassCap). **Bonus cap:** getUserWeeklyBonusTotal (sum credit_bonuses for user, year, week); canReceiveBonus checks total + amount <= WEEKLY_BONUS_CAP; awardBonusCredits inserts credit_bonuses and credit_ledger, then checkRapidBonusActivity. **Decay:** applyReliabilityDecay finds cleaners with last job > DECAY_INACTIVE_WEEKS ago, skips if score <= 50 or isTierLocked, reduces score by DECAY_RATE_PER_WEEK, updates cleaner_profiles and reliability_history. **Tier lock:** set when tier promoted; isTierLocked checks promotion date + TIER_LOCK_DAYS. **Cancellation:** grace count and fee % by notice (e.g. >48h free, 24–48h 50%, <24h 100%). **Penalties:** no-show/late-cancel reduce reliability via reliabilityService or direct update. **Fraud:** checkRapidBonusActivity, createFraudAlert; createAuditLog for audit trail.

**Simple (like for a 10-year-old):** We add and subtract credits in the ledger and we cap how much bonus we give per week. When we give a bonus we record it and check for “too many bonuses too fast.” Decay: we find inactive cleaners and lower their score a bit (but not below 50 and not if they’re in a lock period). Tier lock: for a few days after a promotion we don’t let the tier drop. Cancellation: we count free cancellations and charge a fee based on how late they cancel. No-show and late cancel hurt their reliability. We create fraud alerts and audit logs when something looks wrong.

### 5. How we use it (practical)

**Technical:** creditsService is called by payment, payout, referral, goals, disputes, cancellation. creditEconomyService is called for any bonus (awardBonusCredits), for decay worker (applyReliabilityDecay), for tier lock check (isTierLocked), for cancellation fee logic, for no-show/late-cancel penalties, and for fraud checks. Env: no required credit-economy-specific env; CENTS_PER_CREDIT and ledger reason strings shared with payment/payout. Config: CREDIT_ECONOMY_CONFIG in code.

**Simple (like for a 10-year-old):** Whenever we add or spend credits or give a bonus we use creditsService and/or creditEconomyService. The decay job runs on a schedule. We use the same “cents per credit” everywhere. The economy rules (cap, decay, lock, fees, penalties) are in config in code.

### 6. Why we use it vs other methods

**Technical:** A single economy service and config keep bonus cap, decay, tier lock, cancellation fees, and fraud checks consistent. Centralizing in creditEconomyService avoids duplicate logic and ensures awardBonusCredits is always used for bonuses (so cap is enforced). Decay and tier lock protect fairness (inactive cleaners don’t keep top tier forever; new promotions get a short lock). Alternatives (no cap, no decay, no lock) would risk abuse or unfair tier drops.

**Simple (like for a 10-year-old):** We use one place for “how much bonus,” “when do we decay,” “when is tier locked,” and “what’s the cancellation fee” so everyone is treated the same. The cap stops us from giving too much bonus; decay and lock keep levels fair. Without it we’d have inconsistent rules and more risk.

### 7. Best practices

**Technical:** Always use awardBonusCredits for bonuses (never raw ledger insert for bonus) so cap applies. Run applyReliabilityDecay on schedule; respect isTierLocked. Use createAuditLog for material adjustments; createFraudAlert when thresholds hit. Idempotency for spend (e.g. by job_id) to avoid double debit. Document CREDIT_ECONOMY_CONFIG and cancellation policy in one place. Gaps: ensure all bonus paths go through awardBonusCredits; document tier lock duration and decay rate for ops.

**Simple (like for a 10-year-old):** We always give bonuses through the one function so the cap is applied. We run decay on a schedule and we don’t decay during lock. We write an audit log when we change something big and we create a fraud alert when something looks wrong. We avoid charging twice for the same job. We could document all the numbers (cap, decay, lock, fees) in one place.

### 8. Other relevant info

**Technical:** credit_ledger reason values: purchase, adjustment, job (spend), refund, etc.; source may be referral:code:qualified. credit_bonuses tracks weekly bonus for cap. reliability_history and cleaner_profiles for decay and tier. FOUNDER_PAYMENT_FLOW.md (purchase, capture, credits); FOUNDER_PAYOUT_FLOW.md (spend, release to cleaner); FOUNDER_REFERRALS.md, FOUNDER_GAMIFICATION.md (awardBonusCredits); FOUNDER_PHOTO_PROOF.md (photo compliance bonus).

**Simple (like for a 10-year-old):** The ledger says why we added or took credits (purchase, job, refund, etc.). The bonus table is what we use for the weekly cap. Reliability history and cleaner profile store score and tier. The payment and payout docs explain how we add and spend; referrals and gamification use the bonus function; photo proof uses the compliance bonus.

---

## Purpose and outcome

### 9. What is it supposed to accomplish?

**Technical:** Control credit earning and spending consistently; cap bonus to limit cost and abuse; apply decay and tier lock for fair reliability; enforce cancellation policy and no-show/late-cancel penalties; detect and log suspicious bonus/adjustment activity; support audit and fraud review.

**Simple (like for a 10-year-old):** Make sure credits are earned and spent by the same rules, limit how much bonus we give per week, keep “levels” fair with decay and lock, charge cancellation fees and apply no-show penalties, and flag weird activity so we can review it.

### 10. What does "done" or "success" look like?

**Technical:** Balance correct (sum of ledger); spend idempotent and correct; bonus within cap (or bypassCap documented); decay applied on schedule (respecting lock and min score); tier lock respected; cancellation fee and penalties applied per config; fraud alerts created when thresholds hit; audit log for material changes. Success = correct ledger state and no double spend or over-bonus.

**Simple (like for a 10-year-old):** Success means the balance is right, we never charge twice for the same job, we never give more bonus than the cap (unless we explicitly bypass), decay runs and doesn’t break lock or go below 50, cancellation and no-show rules are applied, and we create alerts and logs when something’s off.

### 11. What would happen if we didn't have it?

**Technical:** No single place for ledger and economy rules; bonus could be uncapped (cost and abuse); no decay (tier inflation); no tier lock (unfair drops); inconsistent cancellation fees and penalties; no fraud alerts or audit trail. Payment and payout would still work but economy would be inconsistent and risky.

**Simple (like for a 10-year-old):** We wouldn’t have one clear set of rules for credits and levels. We could give too much bonus, never lower inactive cleaners’ levels, drop someone’s tier right after we raised it, and we wouldn’t catch or log weird activity.

### 12. What is it not responsible for?

**Technical:** Not responsible for: creating payment intents or capturing payment (paymentService); computing payout amount from tier (payoutsService); computing reliability score (reliabilityService); sending notifications. It owns ledger entries, bonus cap, decay, tier lock, cancellation fee logic, penalties, and fraud/audit; others call it and own payment/payout/reliability computation.

**Simple (like for a 10-year-old):** It doesn’t charge the card or figure out the payout amount—it just adds and subtracts credits and enforces the economy rules. Someone else computes reliability and sends emails. We own the ledger and the rules; they own the rest.

---

## Inputs, outputs, dependencies

### 13. Main inputs

**Technical:** userId, amount, reason/source (for ledger); bonusType, source, bypassCap (for awardBonusCredits); jobId for idempotent spend; cancellation notice hours and grace count for fee; cleanerId for decay, tier lock, penalties. Config: CREDIT_ECONOMY_CONFIG (cap, decay weeks/rate, tier lock days, cancellation rules, fraud thresholds, penalties, photo bonus).

**Simple (like for a 10-year-old):** We need user id, amount, and reason for ledger; bonus type and maybe “bypass cap” for bonuses; job id so we don’t spend twice; notice time and grace count for cancellation fee; cleaner id for decay, lock, and penalties. All the numbers (cap, decay, lock, fees, thresholds) are in config.

### 14. What it produces or changes

**Technical:** Inserts/updates credit_ledger, credit_bonuses, reliability_history, fraud_alerts; updates cleaner_profiles (reliability_score on decay/penalty); createAuditLog. Returns: balance, awardBonusCredits (awarded, capped, newTotal), applyReliabilityDecay (processed, decayed), canReceiveBonus (allowed, currentTotal, cap, remaining).

**Simple (like for a 10-year-old):** It writes to the ledger and bonus table and sometimes to reliability history and fraud alerts. It updates the cleaner’s score when we decay or apply a penalty. It returns balance, how much bonus we gave (and if we capped), how many we decayed, and whether they can receive more bonus.

### 15–17. Consumers, flow, rules

**Technical:** Consumers: paymentService, payoutsService, referralService, cleanerGoalsService, reliabilityService, cancellation, no-show worker, admin (adjustments, fraud review). Flow: add/spend via creditsService; bonus via awardBonusCredits; decay via scheduled applyReliabilityDecay; tier lock checked by reliability/tier logic; cancellation fee and penalties applied by cancellation/no-show flows. Rules: cap, decay, lock, cancellation policy, fraud thresholds, idempotency for spend.

**Simple (like for a 10-year-old):** Payment, payout, referral, goals, reliability, cancellation, and no-show logic all use this. We add/spend, we give bonus (with cap), we run decay on a schedule, we check tier lock, and we apply fees and penalties. We follow the cap, decay, lock, cancellation, and fraud rules and we avoid double spend.

---

## Triggers, dependencies, security

### 18. What triggers it

**Technical:** Payment capture (add); job completion (spend, release); referral/goal qualification (awardBonusCredits); scheduled worker (applyReliabilityDecay); tier promotion (set lock); cancellation (fee logic); no-show/late-cancel (penalties); bonus/adjustment (awardBonusCredits, createFraudAlert, createAuditLog).

**Simple (like for a 10-year-old):** When someone pays, when a job is done, when they qualify for referral or goal, when the decay job runs, when we promote tier, when they cancel, when we detect no-show or late cancel, and when we give a bonus or do a big adjustment.

### 19. What could go wrong

**Technical:** Double spend if idempotency missing; over-bonus if awardBonusCredits bypassed; decay during lock or below 50 if bug; wrong cancellation fee if notice calculation wrong; fraud not flagged if thresholds not checked. Ensure idempotency keys for spend; all bonus paths through awardBonusCredits; decay and lock logic correct; cancellation and fraud checks in place.

**Simple (like for a 10-year-old):** We might charge twice, give too much bonus, decay when we shouldn’t, charge the wrong cancellation fee, or miss fraud. We need to use “only once” for spend, always use the bonus function, and get decay, lock, fee, and fraud logic right.

### 20–22. Monitoring, dependencies, config

**Technical:** Logs for bonus_awarded, decay_applied, fraud_alert; optional metrics for balance, bonus volume, decay count. Depends on DB (ledger, bonuses, reliability, fraud_alerts, cleaner_profiles). Config: CREDIT_ECONOMY_CONFIG in code (or env for key numbers).

**Simple (like for a 10-year-old):** We log when we award bonus, apply decay, or create a fraud alert. We might track balance and bonus volume. We need the DB and the config.

### 26. Security or privacy

**Technical:** Ledger and bonuses are sensitive (financial); only owner and admin should see. Fraud alerts and audit log are internal. Don’t log full ledger rows in plaintext. Enforce auth and scope on balance and adjustment endpoints.

**Simple (like for a 10-year-old):** Credits and bonuses are private—only the user and admins. Fraud and audit are for us. We don’t put full ledger data in logs. We check who’s asking before showing balance or doing adjustments.

### 33. How it interacts with other systems

**Technical:** paymentService adds credits on capture; payoutsService spends and releases; referralService and cleanerGoalsService call awardBonusCredits; reliabilityService uses photo compliance bonus and may call decay/penalty helpers; cancellation flow uses fee logic; no-show worker applies penalty; admin may create adjustments and review fraud_alerts. Events may be published (e.g. bonus_awarded) for notifications.

**Simple (like for a 10-year-old):** Payment adds credits; payout spends and releases. Referral and goals give bonus through us. Reliability uses us for photo bonus and for decay/penalties. Cancellation and no-show use our fee and penalty rules. Admins can do adjustments and look at fraud. We might send events so others can send notifications.

---

**See also:** FOUNDER_PAYMENT_FLOW.md, FOUNDER_PAYOUT_FLOW.md, FOUNDER_REFERRALS.md, FOUNDER_GAMIFICATION.md, FOUNDER_PHOTO_PROOF.md, FOUNDER_IDEMPOTENCY.md.
