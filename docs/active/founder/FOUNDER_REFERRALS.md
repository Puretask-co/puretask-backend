# Founder Reference: Referrals

**Candidate:** Referrals (Feature #20)  
**Where it lives:** `referralService`, referral flows  
**Why document:** How referral codes/links work and how rewards are applied.

---

## The 8 main questions

### 1. What it is

**Technical:** The referral system lets users (cleaners or clients) share a unique code; when a new user signs up with that code and completes qualification (e.g. referee completes N jobs), both referrer and referee get credit rewards. Implemented in `src/services/referralService.ts` and exposed via premium/routes (e.g. GET referral code, apply code at signup, leaderboard). **Tables:** `referral_codes` (user_id, code, type, reward_credits, referee_credits, max_uses, uses_count, expires_at, is_active); `referrals` (referrer_id, referee_id, referral_code, status, jobs_completed, referrer_reward, referee_reward, rewarded_at). **Flow:** generateReferralCode(userId) → user gets code; referee signs up with code → validateReferralCode → create referral row (pending); when referee completes JOBS_REQUIRED_TO_QUALIFY (e.g. 3) within QUALIFICATION_WINDOW_DAYS → applyReferralRewards: award referrer and referee credits via creditEconomyService.awardBonusCredits, update referral row, increment uses_count. **Leaderboard:** referral_leaderboard view for top referrers. Events: publishEvent on qualification (e.g. referral_qualified).

**Simple (like for a 10-year-old):** Referrals are “invite a friend and you both get credits.” You get a unique code; when someone new signs up with your code and does enough jobs (e.g. 3), we give you and them bonus credits. We track who referred whom and how many jobs they did, and we have a leaderboard of top referrers.

### 2. Where it is used

**Technical:** `src/services/referralService.ts` — generateReferralCode, getUserReferralCode, validateReferralCode, applyReferralCode (at signup), checkAndApplyReferralRewards (when referee completes jobs), getReferralLeaderboard; awardBonusCredits from creditEconomyService. Routes: premium/referrals (get code, leaderboard), auth or onboarding (apply code at signup). Worker or job-completion flow calls checkAndApplyReferralRewards when referee completes a job. DB: referral_codes, referrals, referral_leaderboard (view). publishEvent for referral_qualified.

**Simple (like for a 10-year-old):** The code lives in referralService and premium routes. When someone signs up we apply the code; when they complete jobs we check if they’ve hit the target and then give both sides credits. We use the credit economy so we don’t exceed the weekly bonus cap.

### 3. When we use it

**Technical:** When a user requests their referral code (GET); when a new user signs up with a referral code (POST apply); when a referee completes a job (worker or completion handler calls checkAndApplyReferralRewards); when someone views the referral leaderboard (GET). Qualification is checked on each referee job completion until rewarded or window expired.

**Simple (like for a 10-year-old):** We use it when someone asks for their code, when a new user enters a code at signup, and when the new user finishes a job (we check if they’ve now done enough to qualify). We also use it when someone looks at the leaderboard.

### 4. How it is used

**Technical:** generateReferralCode: ensure user has one active code (return existing or create new unique code), INSERT referral_codes. validateReferralCode: code exists, active, not expired, under max_uses, referee not same as referrer, referee role allowed. applyReferralCode at signup: validate → INSERT referrals (status pending), link referee to referrer. checkAndApplyReferralRewards(refereeId): find pending referral for referee, count jobs_completed in window, if >= JOBS_REQUIRED_TO_QUALIFY then awardBonusCredits(referrer), awardBonusCredits(referee), UPDATE referrals rewarded_at, increment referral_codes.uses_count, publishEvent(referral_qualified). Leaderboard: SELECT from referral_leaderboard LIMIT N. Config: DEFAULT_REFERRER_REWARD, DEFAULT_REFEREE_REWARD, JOBS_REQUIRED_TO_QUALIFY, QUALIFICATION_WINDOW_DAYS, CODE_LENGTH.

**Simple (like for a 10-year-old):** We give each user one active code (or reuse it). When someone signs up with a code we check it’s valid and link them. When they complete jobs we count; when they hit the target we give both sides credits (through the bonus cap), mark the referral as rewarded, and publish an event. The leaderboard just reads the top referrers from a view.

### 5. How we use it (practical)

**Technical:** Frontend: “Get my referral code” (GET), “Apply code” at signup (POST), “Referral leaderboard” (GET). Backend: after job completion (or in worker), call checkAndApplyReferralRewards(refereeId). Env: no required referral-specific env; config in REFERRAL_CONFIG. Credits go through creditEconomyService so weekly cap applies.

**Simple (like for a 10-year-old):** The app shows “my code” and “enter a code” at signup and “leaderboard.” After each job we check if the new user has qualified and then pay out. We use the same credit rules so we don’t exceed the weekly bonus limit.

### 6. Why we use it vs other methods

**Technical:** Referrals grow supply and demand with aligned incentives; bonus credits are capped so cost is bounded. Centralizing in referralService and one config keeps rules (jobs required, window, amounts) in one place. Alternatives (no referrals, or uncapped rewards) would miss growth or risk abuse.

**Simple (like for a 10-year-old):** We use it to grow the platform by rewarding people who bring in new users. We cap the bonus so we don’t overspend. Having one place for the rules keeps it simple and fair.

### 7. Best practices

**Technical:** Validate code before linking (active, not expired, max_uses, not self-referral). Award rewards only once per referral (status pending → rewarded). Use awardBonusCredits so weekly cap applies. Idempotency: checkAndApplyReferralRewards should be safe if called multiple times (only reward when pending and jobs >= required). Gaps: document exact qualification window and job definition (completed only?); fraud (same household, fake accounts) — monitor and possibly restrict.

**Simple (like for a 10-year-old):** We only accept valid, non-expired codes and we don’t let people refer themselves. We pay only once per referral when they’ve done enough jobs. We use the bonus cap. We could be clearer about “what counts as a job” and watch for fake referrals.

### 8. Other relevant info

**Technical:** referral_leaderboard is a DB view (e.g. referrer, total_referees, total_rewarded). Credit source for rewards is e.g. `referral:${code}:qualified` in ledger. FOUNDER_CREDIT_ECONOMY.md for cap; FOUNDER_EVENTS.md for referral_qualified. Tables created in migrations; verify-v4-deployment checks referral_codes.

**Simple (like for a 10-year-old):** The leaderboard comes from a view that sums referrers and rewards. When we add credits we record where they came from (referral and code). The credit economy doc explains the cap; the event system gets a “referral qualified” event. The tables were added in migrations.

---

## Purpose and outcome

### 9. What is it supposed to accomplish?

**Technical:** Grow supply and demand by rewarding referrers and referees with credits when referees complete qualification (N jobs in window); provide a leaderboard for visibility.

**Simple (like for a 10-year-old):** Get more users by giving credits to people who refer and to the new users when they do enough jobs, and show who’s referring the most.

### 10. What does "done" or "success" look like?

**Technical:** Code generated and returned; code applied at signup and referral row created; when referee completes required jobs, both get credits (within cap), referral marked rewarded, uses_count incremented, event published; leaderboard returns correct ordering. Invalid code or self-referral → 400.

**Simple (like for a 10-year-old):** Success means they get a code, the new user can use it at signup, and when the new user does enough jobs both get paid (within our cap). The leaderboard shows the right order. Bad code or referring yourself gets an error.

### 11. What would happen if we didn't have it?

**Technical:** No structured referral program; no referral codes or rewards; no leaderboard; less growth from word-of-mouth.

**Simple (like for a 10-year-old):** We wouldn’t have “invite a friend” rewards or a leaderboard; we’d lose a way to grow by word-of-mouth.

### 12. What is it not responsible for?

**Technical:** Not responsible for: signup flow (auth); job completion state (jobsService); credit ledger (creditsService); bonus cap (creditEconomyService). It validates codes, links referee to referrer, and calls awardBonusCredits when qualified; auth and ledger do the rest.

**Simple (like for a 10-year-old):** It doesn’t create the user account or mark the job done—it just checks the code and links them, and when they’ve done enough it asks the credit system to pay both. The rest is auth and credits.

---

## Inputs, outputs, dependencies

### 13. Main inputs

**Technical:** userId (for code generation); code (for validate/apply); refereeId (for checkAndApplyReferralRewards); REFERRAL_CONFIG (reward amounts, jobs required, window, code length). At signup: referee_id, referral_code.

**Simple (like for a 10-year-old):** We need the user to generate a code, the code to validate/apply, and the new user’s id when we check qualification. We have config for how many jobs, how long the window is, and how much we pay.

### 14. What it produces or changes

**Technical:** Inserts/updates referral_codes (uses_count); inserts/updates referrals (status, rewarded_at); calls awardBonusCredits for referrer and referee; publishes referral_qualified event. Returns: referral code, leaderboard list.

**Simple (like for a 10-year-old):** It updates the code’s use count and the referral row, gives credits to both sides, and sends an event. It returns the code or the leaderboard list.

### 15–17. Consumers, flow, rules

**Technical:** Consumers: frontend (code, leaderboard), auth/signup (apply code), job completion (checkAndApplyReferralRewards). Flow: generate → return code; apply at signup → validate → insert referral; on job complete → check jobs in window → if qualified, award both, update referral, publish event. Rules: valid code, not self, max_uses, qualification window and job count; bonus cap via creditEconomyService.

**Simple (like for a 10-year-old):** The app and signup and job completion use this. We generate the code, apply it at signup, and when the new user has done enough jobs we pay both and publish an event. We follow the rules: valid code, not yourself, under max uses, and we respect the bonus cap.

---

## Triggers, dependencies, security

### 18. What triggers it

**Technical:** User request (get code, apply code, leaderboard); job completion flow or worker (checkAndApplyReferralRewards). No cron; qualification is evaluated on each referee job completion until rewarded or window passed.

**Simple (like for a 10-year-old):** When they ask for a code or enter one at signup, or when we look at the leaderboard. And when the new user finishes a job we check if they’ve qualified.

### 19. What could go wrong

**Technical:** Double reward if checkAndApplyReferralRewards not idempotent; code expired or max_uses exceeded after apply; self-referral; referee not in role we allow; bonus cap blocks reward (allowed but referrer/referee may expect payout). Ensure idempotency and validate at apply time.

**Simple (like for a 10-year-old):** We might pay twice if we don’t check “already rewarded.” The code might expire or hit max uses. Someone might try to refer themselves. We might hit the bonus cap and not be able to pay—we should handle that clearly.

### 20–22. Monitoring, dependencies, config

**Technical:** Logs for code generation, apply, reward; optional metric for referral_qualified. Depends on DB, creditEconomyService, events. Config: REFERRAL_CONFIG in code (or env).

**Simple (like for a 10-year-old):** We log when we generate, apply, and reward. We depend on the DB and the credit economy and events. The amounts and rules are in config.

### 26. Security or privacy

**Technical:** Code is not secret (shareable); don’t expose referrer PII in leaderboard if not intended. Validate referee ≠ referrer; watch for abuse (fake accounts, same household). Bonus cap limits financial exposure.

**Simple (like for a 10-year-old):** The code is meant to be shared. We don’t let you refer yourself. We should watch for fake signups. The bonus cap limits how much we pay out.

### 33. How it interacts with other systems

**Technical:** creditEconomyService.awardBonusCredits for both sides; publishEvent(referral_qualified); auth/signup for apply; job completion for checkAndApplyReferralRewards. Does not send notifications directly (n8n may react to event).

**Simple (like for a 10-year-old):** We give credits through the credit economy and publish an event. Signup uses us to apply the code; job completion uses us to check qualification. We don’t send emails ourselves—n8n might do that when we publish the event.

---

**See also:** FOUNDER_CREDIT_ECONOMY.md, FOUNDER_EVENTS.md, FOUNDER_PAYMENT_FLOW.md (credits).
