# Founder Reference: Gamification

**Candidate:** Gamification (Feature #11)  
**Where it lives:** `src/routes/gamification.ts`, `cleanerGoalsService`, tiers/boosts, `expireBoosts` worker  
**Why document:** Cleaner goals, tiers, boosts; how they affect matching or pay and when boosts expire.

---

## The 8 main questions

### 1. What it is

**Technical:** Gamification in PureTask is the set of features that reward and motivate cleaners: onboarding progress tracking (`cleaner_onboarding_progress`), achievements and points (`achievements`, `cleaner_achievements`), certifications (`certifications`, `cleaner_certifications`), template library, goals (jobs/earnings/rating) and route suggestions from `cleanerGoalsService`, reliability tiers (bronze/silver/gold/platinum), and boosts (time-limited pay or visibility perks). Tiers come from reliability score; boosts are granted or purchased and expire (handled by `expireBoosts` worker). Goals can award bonus credits via `creditEconomyService.awardBonusCredits`.

**Simple (like for a 10-year-old):** Gamification is the “game-like” stuff for cleaners: progress through setup, badges and points for doing well, goals (e.g. “do 10 jobs this month”), and levels (tiers) that can mean better pay. There are also short-term “boosts” that give extra perks until they expire. The system tracks what you’ve done and rewards you.

### 2. Where it is used

**Technical:** `src/routes/gamification.ts` (mounted under `/cleaner`) for onboarding progress, achievements, certifications, template library, goals; `src/services/cleanerGoalsService.ts` for goals CRUD, route suggestions, reliability breakdown, tier/thresholds, and awarding bonus credits; reliability tier used by `pricingService` and `payoutsService`; boosts used in matching or pay; `expireBoosts` worker in workers index. DB: `cleaner_onboarding_progress`, `achievements`, `cleaner_achievements`, `certifications`, `cleaner_certifications`, goal tables, tier on `cleaner_profiles`, boost tables.

**Simple (like for a 10-year-old):** The app has a “gamification” section for cleaners where they see progress, achievements, certifications, and goals. Behind the scenes, goals and tiers are used to decide pricing and pay, and a nightly job turns off expired boosts.

### 3. When we use it

**Technical:** When a cleaner views or updates onboarding progress, achievements, certifications, or goals (API calls); when goals are evaluated and bonus credits awarded; when pricing or pay is calculated (tier); when matching considers boosts; when the `expireBoosts` worker runs on schedule to expire time-limited boosts.

**Simple (like for a 10-year-old):** We use it when a cleaner opens their progress or goals, when we figure out how much to charge or pay (using their tier), when we match jobs (using boosts), and when a scheduled job runs to end boosts that have expired.

### 4. How it is used

**Technical:** Routes: GET/POST onboarding progress, GET achievements, POST mark-seen, GET certifications, POST claim, GET templates, goals CRUD, reliability breakdown. Goals have templates (STARTER/REGULAR/PRO/ELITE) and reward credits when targets (e.g. jobs in month) are met. Tier thresholds (e.g. silver 70, gold 85, platinum 95) map reliability score to tier. Boosts have start/end; expireBoosts updates DB. Bonus credits go through `creditEconomyService` (cap enforced).

**Simple (like for a 10-year-old):** Cleaners call APIs to see and update progress, achievements, certifications, and goals. When they hit a goal target, we give bonus credits (within our weekly cap). Their reliability score decides their tier; boosts are time-limited and a nightly job turns them off when time’s up.

### 5. How we use it (practical)

**Technical:** Frontend calls `/cleaner/onboarding/progress`, `/cleaner/achievements`, `/cleaner/certifications`, `/cleaner/goals`, etc. with JWT. Admin or workers may create/update goals or trigger evaluation. Tier is read from `cleaner_profiles.tier`; boosts from boost tables. Env/config for tier thresholds and boost rules; worker schedule for expireBoosts.

**Simple (like for a 10-year-old):** The cleaner app calls these APIs with the user logged in. Admins or the system can set goals and run the job that expires boosts. Tier and boost data live in the database and are used by pricing and pay.

### 6. Why we use it vs other methods

**Technical:** Goals and tiers align cleaner behavior with quality and volume; bonuses and tiers make pay and visibility feel fair and progressive. Achievements and certifications give visible recognition. Alternatives (flat pay, no goals) would reduce motivation and make it harder to steer supply. Centralizing in cleanerGoalsService and gamification routes keeps logic and APIs in one place.

**Simple (like for a 10-year-old):** We use it so cleaners are rewarded for doing more and doing it well, and so pay and visibility feel fair. Without it, everyone would be treated the same and we’d have fewer levers to encourage good behavior.

### 7. Best practices

**Technical:** Goals and bonuses go through credit economy cap; tier from a single reliability source; boosts have explicit expiry and a worker to enforce it. Document tier thresholds and goal templates; ensure expireBoosts is scheduled. Gaps: achievement/certification “earned” logic may be spread; ensure no double-award for same goal period.

**Simple (like for a 10-year-old):** We cap how much bonus we give per week, use one place for “level” (tier), and have a job that really does turn off boosts when they expire. We could be clearer about exactly when an achievement or certification is earned and avoid giving the same reward twice.

### 8. Other relevant info

**Technical:** Tier is shared with pricing (FOUNDER_PRICING.md) and payouts (FOUNDER_PAYOUT_FLOW.md). Bonus credits are part of credit economy (FOUNDER_CREDIT_ECONOMY.md). Low Flexibility badge is separate (flexibilityService, scoring); leaderboard endpoints exist for cleaner and referral leaderboards. Migration `030_onboarding_gamification_system.sql` creates gamification tables.

**Simple (like for a 10-year-old):** Tier affects both what we charge and what we pay. Bonus credits count toward our weekly bonus cap. There’s also a “low flexibility” badge and leaderboards; those are related but separate. The database tables for this were added in a migration.

---

## Purpose and outcome

### 9. What is it supposed to accomplish?

**Technical:** Motivate cleaners through progress, achievements, goals, and tiers; reward reliability with better pricing and pay; offer time-limited boosts; and expire boosts so the economy stays consistent.

**Simple (like for a 10-year-old):** Get cleaners to complete setup, do more jobs, and do them well by showing progress and giving rewards and levels—and to turn off boosts when their time is up.

### 10. What does "done" or "success" look like?

**Technical:** Cleaner sees accurate progress, achievements, certifications, and goals; goals that are met award bonus credits (within cap); tier reflects current reliability; boosts are active only until expiry and expireBoosts marks them inactive on schedule.

**Simple (like for a 10-year-old):** Success means the cleaner sees the right progress and rewards, gets bonus credits when they hit goals (but not over the cap), their level matches their reliability, and boosts really do end when they’re supposed to.

### 11. What would happen if we didn't have it?

**Technical:** No structured onboarding progress, achievements, or goals; tier could still exist for pricing/pay but without the gamification UI. Boosts might never expire, distorting pay or matching. Less motivation and fewer levers to improve supply quality and volume.

**Simple (like for a 10-year-old):** Cleaners wouldn’t see progress or badges or goals in one place; we might still have “levels” for pay but without the game-like part. Boosts might never turn off, which would be unfair and expensive.

### 12. What is it not responsible for?

**Technical:** Not responsible for: computing reliability score (reliabilityService); calculating job price or payout (pricingService, payoutsService); enforcing bonus cap (creditEconomyService); sending notifications; or running the main app. It consumes tier and awards bonuses but doesn’t own the core reliability or credit ledger.

**Simple (like for a 10-year-old):** It doesn’t decide how reliable someone is—that’s another system. It doesn’t do the actual pricing or pay math—it uses the tier and gives bonus credits. It doesn’t send emails or run the whole app.

---

## Inputs, outputs, dependencies

### 13. Main inputs

**Technical:** Cleaner ID (JWT), goal type/target/period, achievement/certification IDs, onboarding step flags. For tier: reliability score from DB. For boosts: start/end time, boost type. Config: tier thresholds, goal templates, bonus amounts.

**Simple (like for a 10-year-old):** We need who the cleaner is, what goals they have, which achievements/certs, and their progress. Tier comes from their reliability score; boosts need start and end time and type.

### 14. What it produces or changes

**Technical:** Updates to onboarding progress, cleaner_achievements (earned, seen), cleaner_certifications (earned, claimed), goals and progress; bonus credit ledger entries via creditEconomyService; boost status (active/expired). Read outputs: progress, achievements, certifications, goals, reliability breakdown, tier, next tier points.

**Simple (like for a 10-year-old):** It updates progress, marks achievements/certs as earned or seen, updates goals, and can add bonus credits. It also flips boosts to expired when the worker runs. It returns all the stuff the cleaner sees (progress, badges, goals, level).

### 15–17. Consumers, flow, rules

**Technical:** Consumers: cleaner app (UI), pricing and payouts (tier), matching (boosts). Flow: API → DB read/update or cleanerGoalsService → optional awardBonusCredits. Rules: tier from thresholds; goal rewards within weekly bonus cap; boosts expire by time; only allowlisted onboarding fields and goal types.

**Simple (like for a 10-year-old):** The cleaner app and the pricing/pay and matching systems use this. We read and update the DB and sometimes give bonus credits. We follow rules: tier from score, bonus cap, boost expiry, and only certain fields and goal types.

---

## Triggers, dependencies, stakeholders

### 18. What triggers it

**Technical:** User requests (view/update progress, achievements, certifications, goals); scheduled worker (expireBoosts); internal calls when evaluating goals or reading tier/boosts for pricing and matching.

**Simple (like for a 10-year-old):** When the cleaner uses the app, when the nightly job runs to expire boosts, and when we need tier or boost info for price or pay.

### 19. What could go wrong

**Technical:** Double-award for same goal; expireBoosts not scheduled or failing; tier out of sync with reliability; achievement/certification criteria not evaluated consistently; bonus over cap if called outside creditEconomyService.

**Simple (like for a 10-year-old):** We might give a goal reward twice, or the boost-expiry job might not run. Tier might not match reliability, or we might give too much bonus if we don’t use the cap.

### 20–22. Monitoring, dependencies, config

**Technical:** Logs and API responses; no dedicated dashboard. Depends on DB, cleanerGoalsService, creditEconomyService, reliability data, worker scheduler. Config: tier thresholds in code or config, goal templates, bonus amounts, boost duration.

**Simple (like for a 10-year-old):** We watch logs and what the API returns. We depend on the database, the goals service, the credit cap, and the worker that expires boosts. Thresholds and goal templates are in code or config.

---

## Stakeholders, security, interactions

### 25. Main stakeholders

**Technical:** Cleaners (progress, achievements, goals, tier, boosts); product (motivation and retention); finance (bonus cap, tier-based pay); matching (boosts).

**Simple (like for a 10-year-old):** Cleaners care most; product and finance care that it’s fair and within budget; matching cares about boosts.

### 26. Security or privacy

**Technical:** All gamification APIs are cleaner-scoped (own progress, achievements, goals); tier and boost data are sensitive to the cleaner. No PII in achievement keys; consent and data export may include progress/consents (GDPR).

**Simple (like for a 10-year-old):** Cleaners only see and change their own progress and goals. Their tier and boosts are their business; we don’t expose other people’s. If we export their data, we might include this.

### 33. How it interacts with other systems

**Technical:** Uses reliability score/tier from reliabilityService and cleaner_profiles; awards bonuses via creditEconomyService; tier read by pricingService and payoutsService; boosts read by matching; expireBoosts worker in queue. Events may be published for achievements/goals (if implemented).

**Simple (like for a 10-year-old):** It gets “level” from the reliability system and gives money through the credit system. Pricing and pay use the tier; matching uses boosts. The worker that expires boosts is part of the queue system.

---

**See also:** FOUNDER_CREDIT_ECONOMY.md, FOUNDER_PRICING.md, FOUNDER_PAYOUT_FLOW.md, FOUNDER_CLEANER_ONBOARDING.md.
