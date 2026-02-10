# Founder's Backend Reference: PureTask Backend Deep Dive

**What it is:** A single reference that explains every major piece of the PureTask backend—what it is, where and when it's used, how and why we use it, and how it aligns with best practices.  
**What it does:** Answers founder-level questions so you can reason about architecture, tradeoffs, and changes.  
**How we use it:** Read sections as needed when making product/tech decisions or onboarding technical leads.

---

For each component this guide covers eight questions. **Every answer has two parts:** a **Technical** explanation (for engineers and product/tech decisions) and a **Simple** explanation (like for a 10-year-old). Each part is at least two sentences and may be several paragraphs when needed.

1. **What it is** — Definition and role in the system  
2. **Where it is used** — Files and call sites  
3. **When we use it** — Triggers (user action, cron, API call, etc.)  
4. **How it is used** — Data flow and API surface  
5. **How we use it (practical)** — Day-to-day usage (APIs, env, scripts)  
6. **Why we use it vs other methods** — Design rationale and alternatives  
7. **Best practices** — Whether we follow them and any gaps  
8. **Other relevant info** — Risks, dependencies, founder-level notes  

---

## 1. Engines (Scoring & Assignment)

Engines are the **scoring and assignment logic** that decide "who is reliable," "who is risky," and "who gets the job." They live in `src/core/` and are used by services, workers, and routes.

---

### 1.1 Reliability Score Engine

#### What it is

**Technical:** The Reliability Score Engine is the subsystem that computes, stores, and exposes cleaner reliability scores (0–100) and tiers (Developing, Semi Pro, Pro, Elite). It uses a rolling window of recent job history (e.g. last 30 jobs or 60 days), aggregates base-behavior metrics (attendance, punctuality, photo compliance, communication, completion, ratings), adds a streak/consistency bonus, and subtracts event-based penalties (late reschedules, cancellations, no-shows, disputes, inconvenience). The result is a single score and tier per cleaner used by matching, payouts, and the frontend. The database layer pre-aggregates metrics in `cleaner_metrics` so we don’t recompute from raw jobs on every read.

**Simple (like for a 10-year-old):** Think of it like a report card for cleaners. The system looks at their last bunch of jobs and asks: Did they show up? Were they on time? Did they take the right photos and make customers happy? If yes, their score goes up; if they cancel a lot or don’t show up, it goes down. They get a level like “Pro” or “Developing.” We use this so customers get good cleaners and good cleaners can earn better pay.

#### Where it is

**Technical:** The engine is implemented across: `src/core/db/reliabilityDb.ts` (cleaner_metrics, cleaner_events, reliability scores, streaks), `src/core/scoring.ts` (computeReliabilityTier, computeReliabilityBasePoints), `src/core/reliabilityScoreV2Service.ts` (full recompute for one cleaner), and `src/services/reliabilityService.ts` (get/update reliability used by jobs and disputes). It is invoked from jobsService, jobTrackingService, disputesService, cleaner routes, routes/scoring.ts, and workers: reliabilityRecalc, nightlyScoreRecompute, cleaningScores.

**Simple (like for a 10-year-old):** The “report card” is built and stored in several parts of the code: one part keeps the numbers, another part figures out the score and level, and another part is what the rest of the app uses when it needs to show or update a cleaner’s score. Anything that shows a cleaner’s profile, pays them, or runs the nightly update uses this.

#### When we use it

**Technical:** We use it on demand when displaying a cleaner profile, when updating tier after job completion or dispute resolution, or when an admin views scoring. We also use it on a schedule: nightly at 2 AM and 3 AM via the `nightly-scores` and `reliability-recalc` workers to recompute all or many cleaners so scores stay fresh without blocking user requests.

**Simple (like for a 10-year-old):** We update the report card when something important happens (like a job finishes or someone complains) and also every night while everyone’s asleep, so the scores are always up to date when people look the next day.

#### How it is used

**Technical:** Services call `getCleanerMetricsById`, `updateCleanerReliability`, or `ReliabilityScoreV2Service.recomputeForCleaner`; routes expose scoring APIs (e.g. GET `/scoring/cleaner/:id`); workers iterate over active cleaners and call recompute. Data flows from DB (reliabilityDb) into the scoring service, then into the higher-level reliabilityService used by jobs and disputes.

**Simple (like for a 10-year-old):** Other parts of the app either “ask” for a cleaner’s score (to show it or decide pay), “tell” the system to update it after something happened, or run a nightly job that updates everyone’s score. The app never makes up the score on the spot; it always uses this one system.

#### How we use it (practical)

**Technical:** Tier drives payout percentage via env vars `CLEANER_PAYOUT_PERCENT_BRONZE/SILVER/GOLD/PLATINUM`. The frontend reads score and tier from the API. For daily recompute you rely on workers; for a one-off recompute you run `npm run worker:reliability-recalc` or call the scoring API.

**Simple (like for a 10-year-old):** Better cleaners get a higher percentage of the job money (we set that in our settings). The app shows their level and score. Usually the computer updates everyone at night; if we need to update someone right now, we can run a special command.

#### Why we use it vs other methods

**Technical:** A rolling window plus event-based penalties keeps scores responsive to recent behavior and avoids “one bad job forever” while still reflecting patterns. Pre-aggregated metrics in `cleaner_metrics` avoid expensive recomputation from raw jobs on every request. Tiers give us clear product buckets (badges, payout bands) and matching rules (e.g. hide low tier from certain clients). Alternatives—e.g. a simple average star rating or no score at all—would be easier to build but less fair and less useful for matching and payouts.

**Simple (like for a 10-year-old):** We want the report card to reflect what cleaners did lately, not one old mistake. We also want simple labels (like “Pro”) so we can show them to customers and pay people fairly. Doing it the simple way (just average stars or no score) would be easier but wouldn’t be as fair or useful.

#### Best practices

**Technical:** We follow a single source of truth for reliability (core + db), separation between DB access and calculation logic, and idempotent recompute so running twice doesn’t break anything. We must ensure `cleaner_metrics` and event logging stay in sync with the job lifecycle—every cancellation, reschedule, and dispute path that should affect reliability must log the right events.

**Simple (like for a 10-year-old):** We have one place that “owns” the report card so we don’t get different answers in different parts of the app. We also make sure whenever someone cancels, reschedules, or has a dispute, we record it so the report card can update. If we forget to record something, the score will be wrong.

#### Other relevant info

**Technical:** Reliability is critical for trust and payouts. Changing the formula or time windows should be done in code and config and may require a backfill; document any change in DECISIONS.md so future changes are traceable.

**Simple (like for a 10-year-old):** This report card really matters: it affects who gets jobs and how much they get paid. If we ever change how we calculate it, we have to do it carefully and write it down so we remember why we changed it.

---

### 1.2 Client Risk Score Engine

#### What it is

**Technical:** The Client Risk Score Engine computes and stores client risk scores (0–100) and risk bands (normal, mild, elevated, high, critical). It is event-driven: each risk-relevant event (late reschedule, card decline, dispute client-at-fault, inconvenience, etc.) has a weight; the score sums weights over a time window, with pattern bonuses (e.g. 3+ late reschedules in 14 days) and time decay (−2 per week with no new events) so clients can improve over time. The result is used to protect cleaners and the platform by filtering or penalizing which cleaners we show to high-risk clients.

**Simple (like for a 10-year-old):** This is like a “safety score” for customers. If someone often cancels last-minute, has payment problems, or causes trouble, their score goes up (they’re riskier). If they behave well for a while, the score goes down a bit. We use it so we don’t send our best cleaners to people who might no-show or cause problems—we still serve most people, but we’re careful with the riskiest ones.

#### Where it is

**Technical:** Implemented in `src/core/db/clientRiskDb.ts` (client_risk_events, client_risk_scores, helpers), `src/core/scoring.ts` (computeRiskBand), and `src/core/clientRiskService.ts` (recompute for one client, upsert score, log events). Invoked from routes/scoring.ts, workers/reliability/nightlyScoreRecompute.ts, and core/matchingService.ts for risk-based filtering and penalties.

**Simple (like for a 10-year-old):** The safety score is stored and calculated in a few code files: one keeps the list of “bad” things that happened, one turns that into a score and a band (like “high risk”), and the matching and nightly jobs use that when deciding who gets which cleaners.

#### When we use it

**Technical:** We use it on demand when matching (to avoid showing top cleaners to high-risk clients) and when an admin views risk. We also recompute it nightly via the `nightly-scores` worker. Event-driven: every cancellation, reschedule, and dispute path that should affect risk logs events through core/cancellation and core/reschedule so the next recompute picks them up.

**Simple (like for a 10-year-old):** We look at the safety score when we’re choosing which cleaners to show a customer, and we update everyone’s score every night. Whenever someone cancels late, reschedules a lot, or has a dispute, we write that down so the next update can change their score.

#### How it is used

**Technical:** Matching calls `ClientRiskService` to get a client’s risk score and band, then applies filtering or score penalties (e.g. don’t show Pro/Elite to critical band). Workers call `recomputeForClient` for active clients. Event logging happens inside cancellation and reschedule services so we don’t miss risk-relevant actions.

**Simple (like for a 10-year-old):** When we’re picking cleaners for a job, we ask “what’s this customer’s safety score?” and then we might hide our best cleaners from very risky customers or mix in other rules. At night we go through customers and recalculate their scores from all the things we wrote down.

#### How we use it (practical)

**Technical:** High-risk clients see fewer or different cleaners; the critical band can be used to block or restrict. Windows, decay, and weights are in `src/core/config.ts` (or env) so product can tune without code deploy.

**Simple (like for a 10-year-old):** Risky customers might not see our top cleaners, or we might add extra checks. We can change how strict we are (e.g. how much one late cancel counts) in our settings without changing the main code.

#### Why we use it vs other methods

**Technical:** Event-driven scoring with decay reflects recent behavior and gives clients a path to improve. Bands make it easy to enforce policies (e.g. “no Pro/Elite to critical”). Alternatives—no risk score, or only manual flags—would be simpler to build but less scalable and less fair to cleaners who’d bear the cost of bad clients.

**Simple (like for a 10-year-old):** We want the score to reflect what people did lately and to get better if they behave. We also want clear levels (like “high risk”) so we can make simple rules. Not having a score at all would be easier but wouldn’t protect our cleaners or scale.

#### Best practices

**Technical:** We log events from a single place (cancellation/reschedule flows), recompute is idempotent, and bands are explicit. We must ensure every cancellation, reschedule, and dispute path that should affect risk actually logs the correct events; missing one path would undercount risk.

**Simple (like for a 10-year-old):** We always record “bad” actions in the same way so the score is fair. We also make sure we don’t forget to record something (like a dispute) or the safety score would be wrong.

#### Other relevant info

**Technical:** Client risk is the lever to reduce no-shows, abuse, and chargebacks while still serving most clients. Tuning weights and bands is product policy; document decisions in DECISIONS.md.

**Simple (like for a 10-year-old):** This score helps us cut down on people who don’t show up or cause trouble, while still letting most customers book. When we decide how strict to be, we write it down so we remember why.

---

### 1.3 Matching Engine

#### What it is

**Technical:** The Matching Engine is the logic that finds and ranks cleaners for a job. It considers availability, reliability (tier/score), client risk (filter or penalize), distance, repeat-client bonus, and flexibility alignment, and returns an ordered list of candidates. It does not perform assignment; it only produces the ranked list. The core lives in `MatchingService`; the API-facing layer that adds waves and broadcasting is `jobMatchingService`.

**Simple (like for a 10-year-old):** When someone books a cleaning, the system makes a list of cleaners who can do it and sorts them: best match first (reliable, not too far, maybe someone the customer used before). It doesn’t pick who gets the job—it just gives the list. The app or the customer/cleaner then decides who actually gets it.

#### Where it is

**Technical:** Core logic is in `src/core/matchingService.ts` (MatchingService.findCandidates, getMatchingContext); persistence may use `src/core/db/matchingDb.ts`. The orchestration layer is `src/services/jobMatchingService.ts` (findMatchingCleaners, getWaveEligibleCleaners, broadcastJobToCleaners). Used by routes/matching.ts, routes/assignment.ts, and routes/jobs.ts.

**Simple (like for a 10-year-old):** The “make the list and sort it” code lives in the matching and job-matching files. The website and app call the matching and assignment pages to get that list when they need to show “who can do this job” or “next group of cleaners.”

#### When we use it

**Technical:** We use it whenever a job is created or we need to show/offer cleaners: e.g. client or app requests “who can do this job?” or “next wave of cleaners,” or when we broadcast a job to a set of cleaners. Each of these flows calls the matching or job-matching service.

**Simple (like for a 10-year-old):** We use it when someone is booking a cleaning (to show who’s available) and when we’re offering the job to cleaners in groups (wave 1, then wave 2 if needed). Any time we need “the list of good cleaners for this job,” we use this.

#### How it is used

**Technical:** Routes load the job and call `MatchingService.getMatchingContext(jobId)` then `MatchingService.findCandidates(context)`, or call `jobMatchingService.getWaveEligibleCleaners(job, { wave, limit })` for wave-based assignment. Matching consumes reliability tier, client risk, distance, repeat status, and flexibility from the other engines.

**Simple (like for a 10-year-old):** The app asks “give me the best cleaners for this job” or “give me the next group (wave 2).” The system looks at reliability, risk, distance, and whether the customer used this cleaner before, then returns the sorted list.

#### How we use it (practical)

**Technical:** We expose GET-style APIs for “list candidates” and “list wave N” (e.g. GET /assignment/:jobId/wave), and POST for creating a job and optionally broadcasting. The frontend uses these to show “top cleaners” or “wave 1 / wave 2” for voluntary accept; the actual assign step is a separate API (e.g. accept offer on jobs).

**Simple (like for a 10-year-old):** The app shows “here are the best cleaners” or “here’s the next group.” When a cleaner says “I’ll take it,” that’s a different button/request; this part only builds the list.

#### Why we use it vs other methods

**Technical:** Score-based ranking balances quality (reliability), safety (client risk), and convenience (distance, repeat). Wave-based rollout allows voluntary accept and fair distribution instead of one person getting every job. Alternatives—random order, first-come-first-served, or only distance—would be simpler to implement but worse for quality and fairness.

**Simple (like for a 10-year-old):** We want the best cleaners at the top and we don’t want to send them to risky customers. We also show them in groups (waves) so everyone gets a fair chance. Picking randomly or “whoever clicks first” would be easier but wouldn’t be as good for customers or cleaners.

#### Best practices

**Technical:** Matching is stateless per request and reuses the reliability and client-risk engines. Distance is currently simplified in code (see comment in matchingService); for production you may want real geocoding. Keep matching and assignment (wave logic) aligned so filters and ordering are consistent.

**Simple (like for a 10-year-old):** We use the same report cards (reliability and risk) every time so the list is fair. Right now “how far” is a simple version; we could later use real maps. We also make sure the “wave” list and the “best cleaners” list use the same rules.

#### Other relevant info

**Technical:** Matching is the bridge between “job” and “who does it.” Changing factor weights (e.g. distance vs reliability) is a product decision; consider A/B tests or feature flags and document in DECISIONS.md.

**Simple (like for a 10-year-old):** This is the part that connects “a job” to “the list of people who could do it.” If we change how we sort (e.g. care more about distance), we should test it and write down why we changed it.

---

### 1.4 Assignment Engine (API)

#### What it is

**Technical:** The Assignment Engine in this codebase is the HTTP API for wave-based assignment: “for this job, who is in wave 1 (or 2, …)?” It does not compute scores; it calls `jobMatchingService.getWaveEligibleCleaners(job, { wave, limit })` and returns that list. Voluntary accept is implied: we expose who is in each wave; the actual assign happens when a cleaner accepts (e.g. via jobs/accept).

**Simple (like for a 10-year-old):** This is the part of the app that answers “who’s in the first group of cleaners for this job?” or “who’s in the second group?” It doesn’t pick the winner—it just gives the group. When a cleaner says “I’ll do it,” that’s a different step.

#### Where it is

**Technical:** Implemented as a single route in `src/routes/assignment.ts`: one endpoint, GET /assignment/:jobId/wave. Mounted in `src/index.ts` as assignmentRouter. No business logic in the route; it delegates to jobMatchingService.

**Simple (like for a 10-year-old):** It’s one page in our code that only does “give me wave 1 or wave 2 for this job.” The rest of the app uses this when it needs to show the next group of cleaners.

#### When we use it

**Technical:** We use it when the client app needs the next wave of eligible cleaners for a given job—e.g. after wave 1 didn’t accept, or on initial load to show wave 1. Each request is one wave (wave=1, wave=2, …) so the frontend can paginate.

**Simple (like for a 10-year-old):** We use it when the app needs to show “here’s the first group of cleaners” or “here’s the next group” for a booking. So: when someone is picking a cleaner and we show them in batches.

#### How it is used

**Technical:** Client sends GET /assignment/:jobId/wave?wave=1&limit=20 with auth. Server returns { jobId, wave, cleaners }. The route validates params, loads the job, calls getWaveEligibleCleaners(job, { wave, limit }), and returns the list. Actual assignment is a separate endpoint (e.g. POST to accept the job).

**Simple (like for a 10-year-old):** The app asks “give me 20 cleaners for wave 1 for this job.” The server checks who’s logged in, gets the job, gets the right wave from the matching system, and sends back the list. Saying “I accept” is a different request.

#### How we use it (practical)

**Technical:** Frontend calls this to populate the list of cleaners to offer the job to; the “assign” action (cleaner accepts) is a separate API (e.g. jobs/accept). So assignment in product terms = “show wave” + “cleaner accepts”; this API only does “show wave.”

**Simple (like for a 10-year-old):** The app uses this to fill the screen with “these are the cleaners we’re offering the job to.” When one of them clicks “I’ll do it,” the app sends that to a different part of the system.

#### Why we use it vs other methods

**Technical:** A dedicated wave API keeps “who’s in which wave” in one place and lets the client paginate (wave 1, then wave 2) without loading all candidates at once. Alternative would be one “all candidates” endpoint; waves give clearer rollout and fairer distribution.

**Simple (like for a 10-year-old):** Showing cleaners in groups (waves) is fairer and easier to understand than dumping everyone in one huge list. So we have one request that means “give me the next group,” and the app can ask again for the next group if needed.

#### Best practices

**Technical:** The route is thin: auth, parse params, call service, return JSON. We should keep getWaveEligibleCleaners aligned with the matching engine (same filters and ordering) so “wave 1” is consistent with “top candidates.”

**Simple (like for a 10-year-old):** This page doesn’t do the hard math—it just asks the matching system for a wave and passes the answer back. We make sure “wave 1” really is our best group so the list makes sense.

#### Other relevant info

**Technical:** This endpoint is the public contract for “who gets offered the job” in wave form. Changing wave size, ordering, or semantics can affect product behavior; document and consider versioning if you change it.

**Simple (like for a 10-year-old):** Whatever we show as “wave 1” or “wave 2” is what customers and cleaners see. If we change how we build those groups, we should write it down and maybe tell the app team.

---

### 1.5 Cancellation "Engine" (Core Logic)

#### What it is

**Technical:** The cancellation engine is the centralized policy and fee logic for job cancellation. It defines time windows (>48h, 24–48h, <24h before start), fee percentages per window, grace cancellations (e.g. 2 per client lifetime), and how fees/refunds/credits are split (client refund, cleaner comp, platform). It also triggers risk and reliability event logging and handles no-show cases so both engines stay in sync.

**Simple (like for a 10-year-old):** When someone cancels a cleaning, we have rules: cancel early and it’s free (or cheap); cancel last minute and there might be a fee. We also give everyone a couple of “free” cancels. This part of the system figures out how much to refund, how much to give the cleaner, and writes down what happened so our “report cards” (risk and reliability) can update.

#### Where it is / Where it is used / When we use it / How it is used

**Technical:** Implemented in `src/core/cancellationService.ts` (and cancellationDb if present); uses timeBuckets and CANCELLATION_CONFIG. Used by any route or service that cancels a job (cancellation routes, jobsService) and by the reschedule flow when a reschedule is declined and we fall back to cancel. Invoked every time a job is cancelled (client, cleaner, admin, or system e.g. no-show). Caller passes job, actor, type, reason code, etc.; the service returns the fee breakdown and performs DB updates and event logging (client_risk_events, cleaner_events).

**Simple (like for a 10-year-old):** The rules live in one place (cancellation service). Whenever anyone cancels—customer, cleaner, or the system (e.g. no-show)—we use that same place. It works out the money and writes down what happened for the report cards.

#### How we use it (practical) / Why we use it vs other methods / Best practices / Other

**Technical:** Cancellation routes and jobsService call the core cancellation API; there is no cron—every cancel goes through this path. Time windows plus grace balance fairness and abuse; a single place ensures consistent fees and event logging. Keep time buckets and fee percentages in config/env so you can tune without code deploy. Cancellation policy is a key lever for supply/demand and trust; document it in product/legal and keep code in sync.

**Simple (like for a 10-year-old):** We always use the same cancellation rules so everyone is treated the same and the report cards get updated. We keep the “how much to charge” rules in settings so we can change them without changing code. Cancellation is a big deal for trust and for how many jobs we have—so we write down the policy and make sure the code matches.

---

### 1.6 Reschedule "Engine" (Core Logic)

#### What it is

**Technical:** The reschedule engine is the request/accept/decline workflow for changing a job’s time. It creates a reschedule request, checks cleaner availability for the new slot, applies time-bucket logic (<24h, 24–48h, >48h), classifies requests as reasonable or unreasonable, and integrates with cancellation, client risk, and reliability by logging the right events when someone requests, accepts, or declines.

**Simple (like for a 10-year-old):** When someone wants to change the cleaning to a different day or time, this part handles it: the other person can say yes or no. We check if the new time is free, we remember how late the request was (last minute vs early), and we write it down for the safety score and the cleaner report card.

#### Where it is / Where it is used / When / How / How practical / Why / Best practices / Other

**Technical:** Core is `src/core/rescheduleService.ts` (RescheduleServiceV2); uses timeBuckets and RESCHEDULE_CONFIG, CLIENT_RISK_CONFIG, RELIABILITY_CONFIG. Used by reschedule routes and any service that creates or responds to reschedule requests. Used when a client or cleaner requests a new time and when the other party accepts or declines. Create request via RescheduleServiceV2.createRequest; accept/decline via the response method; the service checks availability, writes reschedule_events, and logs risk/reliability events. API exposes “request reschedule” and “accept/decline reschedule.” Request/response gives the other party control; time buckets align with cancellation and risk (e.g. late reschedule <24h). Availability check must match calendar/slots elsewhere. Reschedule is a major source of client risk events and cleaner reliability (e.g. declining reasonable requests); all paths must go through this service.

**Simple (like for a 10-year-old):** The reschedule rules live in one place. When someone asks to change the time, we record it and let the other person say yes or no. We write down whether it was last-minute or early, and whether they said yes or no, so the safety score and cleaner report card stay correct. We always use this same flow so we don’t miss anything.

---

### 1.7 Flexibility "Engine"

#### What it is

**Technical:** The flexibility engine has two sides: (1) Cleaner flexibility—we log when a cleaner declines a “reasonable” client reschedule; a nightly job can then assign or remove a “Low Flexibility” badge. (2) Client flexibility—we maintain a profile (e.g. how often they reschedule, how they react to requests). Matching uses this for a flexibility bonus or alignment so we can rank cleaners who are more flexible higher when it matters.

**Simple (like for a 10-year-old):** Sometimes we track whether a cleaner says no to a reasonable reschedule (like “can we do Tuesday instead?” when they’re free). If they say no a lot, we might show a “Low Flexibility” badge. We also remember how often customers change their mind. When we’re ranking cleaners, we can favor people who are more flexible so customers have a better experience.

#### Where / When / How / How practical / Why / Best practices / Other

**Technical:** Implemented in `src/core/flexibilityService.ts` (FlexibilityService); config in FLEXIBILITY_CONFIG. Used when a cleaner declines a reasonable reschedule (we call logCleanerReasonableDecline), in matching (flexibility bonus), and optionally in a nightly job (evaluateCleanerFlexibility). Mostly automatic; product can show the badge and use it in ranking. “Reasonable” must be defined consistently (e.g. by time bucket or reason code). Flexibility affects matching and client experience; tune the definition of “reasonable” in config.

**Simple (like for a 10-year-old):** We record “cleaner said no to a reasonable change” in one place, and the matching system uses that when sorting cleaners. We decide what counts as “reasonable” in our settings and use the same rule everywhere so it’s fair.

---

### 1.8 Inconvenience "Engine"

#### What it is

**Technical:** Inconvenience is the measure of harm one party causes the other (e.g. late cancellation, no-show). It feeds into the reliability engine (cleaner) and the client risk engine (client). The score or events are read during recompute so we can weight “how bad” the action was; this is fairness-critical because wrong attribution would penalize the wrong side.

**Simple (like for a 10-year-old):** When someone cancels last minute or doesn’t show up, the other person is inconvenienced. We record who caused it so the right report card goes down—the cleaner’s if the cleaner no-showed, the customer’s if the customer caused the problem. Getting “who caused it” right is really important so nobody’s score is hurt by mistake.

#### Where / When / How / How practical / Why / Best practices / Other

**Technical:** Logic may live in `src/core/inconvenienceService.ts` or inside reliability/risk or cancellation/reschedule. Used when a job or event causes inconvenience; reliability and risk engines read it on recompute. Usually implicit in event logging; no separate “set inconvenience” API. Explicit inconvenience lets us weight severity; we must set who-caused (cleaner vs client) correctly so the right engine is penalized. Small but fairness-critical.

**Simple (like for a 10-year-old):** We don’t have a special screen for “inconvenience”—we just write it down when someone cancels late or no-shows, and say who was responsible. The report cards use that when they update. We’re careful to blame the right person so the scores are fair.

---

### 1.9 Reason Code Service

#### What it is

**Technical:** The Reason Code Service provides a structured list of codes for why someone is rescheduling or cancelling (and why the other party accepts or declines). Codes are validated and stored with each event so downstream systems—analytics, risk, reliability, support—can use them. Using codes instead of free text enables consistent policy (e.g. “family_emergency” vs “other”) and better automation.

**Simple (like for a 10-year-old):** When someone cancels or wants to change the time, we ask them to pick a reason from a list (e.g. “schedule conflict,” “family emergency,” “other”). We save that reason so we can look at patterns later (e.g. how many cancel because of emergencies) and so our report cards and support team have clear info. Picking from a list is better than everyone typing different things.

#### Where / When / How / How practical / Why / Best practices / Other

**Technical:** Implemented in `src/core/reasonCodeService.ts` (REASON_CODES for client_reschedule, cleaner_reschedule, client_cancel, cleaner_cancel, etc.). Used on every reschedule request, reschedule response, and cancellation; API accepts reasonCode, service validates against REASON_CODES and stores with the event. Frontend sends a code from the list; backend validates and stores; admin/support use same codes for reporting. Adding new codes is a product decision; document and keep client in sync. Reason codes are the main qualitative signal for risk and reliability; keep “other” to a small share for good data.

**Simple (like for a 10-year-old):** We have one list of reasons that the app and the backend both use. Whenever someone cancels or reschedules, they pick from that list and we save it. If we add a new reason, we update the list and tell the app so everyone stays in sync. The more people pick real reasons (and not “other”), the better we can understand and improve.

---

## 2. Workers (Background Jobs)

Workers are **scheduled or on-demand background tasks** (lifecycle, payouts, scores, backups, notifications, analytics). They do not serve HTTP; they run in a separate process or cron.

---

### 2.1 Worker Runner (Registry)

#### What it is

**Technical:** The Worker Runner is the registry and single entry point for all background workers. It maintains a map from worker name to an async function; calling `runWorker(name)` runs that worker, and `runWorker("all")` runs every registered worker in sequence. Workers are invoked via `node dist/workers/index.js <name>` or `npm run worker:<name>`. This gives one place to enable/disable workers (e.g. WORKERS_ENABLED) and to run them from the scheduler or from external cron (e.g. Railway).

**Simple (like for a 10-year-old):** Think of workers as chores the computer does in the background—like “cancel old bookings,” “update everyone’s report cards,” “send reminder emails.” The runner is the list of all those chores and the button that runs one or all of them. So when we want “run the nightly scores,” we tell the runner “run nightly-scores” and it does that one chore.

#### Where it is / Where it is used / When / How / How practical

**Technical:** Implemented in `src/workers/index.ts`; exports `runWorker(name)`. The scheduler (scheduler.ts) calls `runWorker(workerName)` on a schedule; the CLI and Railway cron run one worker per invocation (e.g. `npm run worker:auto-cancel`). We use it on a schedule (via scheduler or external cron) or manually for debugging. Each worker is an async function that runs to completion. In practice: `npm run worker:auto-cancel`, `npm run worker:nightly-scores`, etc.; set `WORKERS_ENABLED=false` to disable all workers (kill switch).

**Simple (like for a 10-year-old):** The runner lives in one file that knows every chore. The clock (scheduler) or a person can say “run this chore now.” We use it when the clock says so (e.g. every night at 2 AM) or when we’re testing. To run a chore by hand we type something like `npm run worker:nightly-scores`. If we turn workers off (one setting), no chores run—handy if something’s broken.

#### Why we use it vs other methods / Best practices / Other

**Technical:** A single registry avoids scattered cron scripts and gives one place to guard (WORKERS_ENABLED) and to audit what runs. Alternatives (separate repos or no runner) would be harder to operate. We guard with WORKERS_ENABLED, keep one entry point, and make workers idempotent where possible. “All” runs sequentially; in production prefer one process per worker type (e.g. Railway cron per worker). Workers are critical for payouts, scores, and hygiene—if they’re off, scores go stale and notifications don’t retry; monitor runs via logs or Sentry.

**Simple (like for a 10-year-old):** Having one list of chores means we can turn them all off in one place if we need to, and we always know what’s supposed to run. We try to make each chore safe to run twice (idempotent). If workers stop running, report cards don’t update and people don’t get paid on time—so we watch that they actually run.

---

### 2.2 Worker Scheduler

#### What it is

**Technical:** The Worker Scheduler is the definition of when each worker runs: a list of (workerName, cronExpression, description, enabled). Optionally it can start an in-process cron (node-cron) that calls `runWorker` on schedule; for production we prefer external cron (e.g. Railway) that runs `node dist/workers/scheduler.js <worker-name>` at the right time. So the scheduler answers “what runs when” and can either run inside the API process (not recommended at scale) or be used only as a reference while external cron does the actual triggering.

**Simple (like for a 10-year-old):** The scheduler is the “when” list: “auto-cancel every 5 minutes,” “nightly scores at 2 AM,” “weekly payout on Sunday,” etc. We can either have the main app run these on a timer (ok for small setups) or have a separate clock (e.g. Railway cron) run one chore at a time at the right moment (better when we’re big).

#### Where / When / How / How practical / Why / Best practices / Other

**Technical:** Implemented in `src/workers/scheduler.ts` (WORKER_SCHEDULES, startInternalScheduler(), runScheduledWorker(workerName)). Used when we want time-based execution: every 5/10/15 min (auto-cancel, retry-notifications, webhook-retry, lock-recovery, no-show-detection), hourly (auto-expire), daily (kpi-daily, nightly-scores, subscription-jobs, reliability-recalc, backup-daily, credit-economy, photo-cleanup, payout-retry, payout-reconciliation, expire-boosts), weekly (payout-weekly, weekly-summary), every 6h (onboarding-reminders). Each schedule has workerName, cronExpression, description, enabled; some workers respect PAYOUTS_ENABLED. In practice: on Railway, create cron jobs that run e.g. `node dist/workers/scheduler.js nightly-scores` at 2 AM. Central schedule makes “what runs when” auditable; external cron keeps workers out of the API process. Don’t run heavy workers in the same process as the API. Full list in `src/workers/WORKER_STATUS.md`; document schedule changes in runbooks.

**Simple (like for a 10-year-old):** The scheduler file holds the list of “this chore runs at this time.” Some run every few minutes, some once a day, some once a week. In production we usually have the host (e.g. Railway) run one chore at a time at the right time instead of the main app doing it. That way the website and the chores don’t slow each other down. We write down the full list in WORKER_STATUS.md and when we change when something runs, we note it in the runbook.

---

### 2.3 Worker Tiers (V1–V4, Reliability, Other)

**Technical:** Workers are grouped by purpose. **V1 Core** (job lifecycle, payouts, notifications): autoCancelJobs, autoExpireAwaitingApproval, payoutWeekly, retryFailedNotifications, webhookRetry, jobReminders, noShowDetection—keep jobs moving, pay cleaners, retry failed side effects; critical. **V2 Operations** (economy, payouts, backups, queue): creditEconomyMaintenance, payoutRetry, payoutReconciliation, backupDaily, photoRetentionCleanup, queueProcessor—operational health, money, data safety; critical. **V3 Automation**: subscriptionJobs—create recurring jobs; product-critical. **V4 Analytics**: expireBoosts, kpiDailySnapshot, weeklySummary—KPIs, boosts, reports; important. **Reliability**: nightlyScoreRecompute, cleaningScores, reliabilityRecalc—keep reliability and client risk up to date; critical for matching and payouts. **Other**: lockRecovery, onboardingReminderWorker—prevent stuck locks, nudge incomplete onboarding; important. Workers are idempotent where possible, guarded by WORKERS_ENABLED, and payout workers by PAYOUTS_ENABLED. Deprecated workers live in _deprecated/ and are not in the registry.

**Simple (like for a 10-year-old):** We group our background chores by what they do. Some keep jobs and pay moving (cancel old ones, pay cleaners, retry failed emails). Some keep the system healthy (backups, clean old photos, fix the credit system). Some create recurring cleanings. Some just record numbers and send reports. Some update everyone’s report cards (reliability and risk). Some unlock stuck things or remind people to finish signing up. We try to make each chore safe to run twice, and we can turn off all chores or just pay-related ones with a setting. Old chores we don’t use anymore are in a “deprecated” folder and aren’t in the main list.

---

## 3. Job State Machine

#### What it is

**Technical:** The Job State Machine is the single source of truth for allowed job statuses and transitions. Statuses follow the lifecycle: requested → accepted → on_my_way → in_progress → awaiting_approval → completed | disputed | cancelled. For each (current status, event) it defines the next status (e.g. from “requested” on event “job_accepted” we go to “accepted”). It also defines which actor (client, cleaner, admin, system) can emit which event. So before any code writes a status change to the DB, it must call validateTransition({ currentStatus, event, actorType }); if valid, it uses getNextStatus(current, event) and persists. This prevents invalid states (e.g. “completed” → “requested”) and inconsistent product behavior.

**Simple (like for a 10-year-old):** A cleaning job can be in different “states”: just requested, accepted by a cleaner, cleaner on the way, in progress, waiting for the customer to say “done,” or finished/cancelled/disputed. The state machine is the rulebook: “from this state, only these actions are allowed.” For example, only a cleaner can say “I accepted”; only the customer can say “I approve” when it’s waiting for approval. Before we save any change, we check the rulebook so we never end up with something impossible (like “finished” then suddenly “just requested”).

#### Where it is / Where it is used / When / How / How practical / Why / Best practices / Other

**Technical:** Implemented in `src/state/jobStateMachine.ts`; exports JobStatus, JobEventType, allowedTransitions, getNextStatus, canTransition, getValidEvents, isTerminalStatus, eventPermissions, canActorTriggerEvent, validateTransition. jobsService (and any code that changes job status) calls validateTransition before updating the DB and uses getNextStatus to get the new status; tests are in tests/integration/stateMachine.test.ts. We use it every time we change job status (accept, start, complete, approve, dispute, cancel). Flow: validateTransition(...); if valid, apply getNextStatus(current, event) and persist. No direct API—used inside services. When adding a new flow (e.g. new event), update the state machine and eventPermissions. Explicit state machine prevents invalid states; keep in sync with DB enum and frontend labels; document new events in DECISIONS.md. The state machine is the contract for job lifecycle; changing it is a product/tech change—coordinate with frontend and support.

**Simple (like for a 10-year-old):** The rulebook lives in one file. Whenever we’re about to change a job’s status (cleaner accepted, job started, customer approved, etc.), we ask the rulebook “is this allowed?” and “what’s the new status?” and only then save. There’s no special “state machine” button in the app—it’s used inside the code. We use it so we never save a nonsense state. If we ever add a new kind of step (new event), we have to update the rulebook and the list of who can do what. Changing the rulebook is a big deal because the app and support depend on it, so we coordinate with the team.

---

## 4. Core Services (Business Logic)

Services in `src/core/` and `src/services/` contain **business logic and orchestration**. They are called by routes and workers; they call the DB (via `src/db/client.ts`) and integrations. They do not know about HTTP—they take input and return data so the logic is testable and reusable.

**Simple (like for a 10-year-old):** Services are the “brain” of the app: they know the rules (how to match cleaners, how to pay, how to cancel). The website and the background chores ask the brain “do this” and the brain does the work and talks to the database and outside companies (Stripe, email, etc.). The brain doesn’t care if the request came from the web or from a nightly job—same rules either way.

---

### 4.1 Matching / Availability

**Technical:** **matchingService** (core) ranks cleaners for a job using reliability, client risk, distance, repeat-client bonus, and flexibility; it’s the single place that produces “who is a good candidate.” **availabilityService** checks whether a cleaner is free in a given slot (calendar, conflicts) so we don’t double-book; used by jobMatchingService, reschedule, and booking flows. **jobMatchingService** orchestrates matching and waves: findMatchingCleaners, getWaveEligibleCleaners, broadcastJobToCleaners, acceptJobOffer; it’s the API-facing layer that routes (jobs, assignment, matching) call.

**Simple (like for a 10-year-old):** Matching service makes the “best cleaners for this job” list. Availability service checks “is this cleaner free at that time?” so we never book them twice. Job-matching service is what the app actually talks to: it gets the list, splits it into waves, sends the job to cleaners, and handles “I’ll take it.”

---

### 4.2 Jobs

**Technical:** **jobsService** is the central job lifecycle: CRUD, status transitions (via the job state machine), assignment, cancellation; used by routes/jobs, assignment, cancellation, tracking. **cleanerJobsService** exposes job operations for the cleaner role (cleaner routes, cleanerPortal). **adminJobsService** handles admin actions (repair, override) for admin routes.

**Simple (like for a 10-year-old):** Jobs service is the main place that creates jobs, changes their status (accepted, started, completed, etc.), and cancels them. Cleaner jobs service is the same kind of stuff but only what a cleaner is allowed to do. Admin jobs service is what admins use to fix or override things.

---

### 4.3 Payments & Payouts

**Technical:** **paymentService** handles client payments (Stripe intents, capture); used by routes/payments and Stripe webhooks—money in. **payoutsService** handles cleaner payouts (Stripe Connect, tier-based percentage from reliability); used by payout workers and admin finance—money out. **stripeConnectService** handles Connect onboarding and accounts so cleaners can get paid. **refundProcessor** does full/partial refunds for cancellation, disputes, admin. **chargebackProcessor** handles chargebacks from Stripe and disputes.

**Simple (like for a 10-year-old):** Payment service takes the customer’s money (Stripe). Payouts service sends money to cleaners (using their report card level to decide how much). Stripe Connect is how we set up cleaners so they can receive money. Refund processor gives money back when someone cancels or there’s a dispute. Chargeback processor deals with when a bank reverses a payment.

---

### 4.4 Credits & Economy

**Technical:** **creditsService** manages client credit balance (spend, grant); used by routes/credits, jobs, cancellation—in-app currency. **creditEconomyService** handles decay, tier lock, and economy health; used by the credit-economy worker so balances don’t run away. **creditsPurchaseService** handles buying credits (Stripe); used by routes/credits—revenue.

**Simple (like for a 10-year-old):** Credits service is the “wallet” for customers: how many credits they have and when we add or subtract. Credit economy service is the nightly chore that keeps the wallet system fair (e.g. so people can’t game it). Credits purchase service is when someone buys more credits with real money.

---

### 4.5 Reliability & Risk (Service Layer)

**Technical:** **reliabilityService** gets and updates cleaner reliability (wraps the core reliability engine); used by jobsService, jobTrackingService, disputesService, routes/cleaner after job completion, dispute, or no-show. **riskService** exposes client risk for admin and matching (may wrap ClientRiskService). **clientRiskService** is the core client risk engine (see engines); used by matching, nightly worker, routes/scoring.

**Simple (like for a 10-year-old):** Reliability service is what the rest of the app uses when it needs to read or update a cleaner’s report card. Risk service is what we use when we need a customer’s safety score (for admin or for matching). Client risk service is the actual “safety score” engine—same one used by matching and the nightly update.

---

### 4.6 Notifications

**Technical:** **src/services/notifications/** is the single place for sending notifications: event-based email, SMS, push (SendGrid, Twilio, OneSignal), with templates, preferences, and job-specific notifications. Routes (e.g. messages, jobs) and workers (retry failed notifications) use it so we don’t send from multiple places; workers retry failures.

**Simple (like for a 10-year-old):** The notifications folder is “the mailroom”: whenever we need to send an email, text, or push, we ask the mailroom. It uses the right company (SendGrid, Twilio, etc.) and the right template. If a send fails, the nightly retry chore tries again.

---

### 4.7 Auth & Users

**Technical:** **authService** handles login, register, JWT, sessions; used by routes/auth*. **emailVerificationService** runs the email verify flow for auth and onboarding. **phoneVerificationService** runs SMS verify for onboarding and auth. **onboardingReminderService** sends reminders for incomplete onboarding; used by the onboarding-reminders worker and routes.

**Simple (like for a 10-year-old):** Auth service is “log in and sign up.” Email and phone verification services are “prove this email/phone is yours.” Onboarding reminder service is the one that nags people to finish signing up (used by the reminder chore and the app).

---

### 4.8 Other Important Services

**Technical:** **calendarService** provides calendar/slots for availability (booking, reschedule). **disputesService** handles dispute creation, resolution, refund, and updates reliability; used by routes and admin. **invoiceService** handles invoicing for clients; used by routes/clientInvoices. **backupService** performs DB backup; used by the backup-daily worker.

**Simple (like for a 10-year-old):** Calendar service knows “when is this cleaner free.” Disputes service handles “customer and cleaner disagree”—who’s at fault, refund, and updating report cards. Invoice service creates bills for customers. Backup service is the chore that copies the database so we don’t lose data.

---

## 5. Routes (API Surface)

**Technical:** Routes in `src/routes/` are thin HTTP handlers: they validate input (e.g. body, query, params), call one or more services, and return responses (JSON, status codes). They contain no business logic and no direct database access; all logic lives in services. This keeps the API layer simple and testable and ensures the same rules apply whether the caller is the web app, mobile app, or a worker. All routers are imported and mounted in `src/index.ts`. Routes use middleware (auth, rate limit, validation), asyncHandler for errors, and shared response helpers (sendSuccess, sendCreated, sendError); they never call pool.query directly.

**Simple (like for a 10-year-old):** Routes are the “front desk” of the app: when someone (the website, the app, or another system) sends a request like “log me in” or “create a job,” the route checks who they are and what they sent, then asks the right “brain” (service) to do the work and sends back the answer. The front desk doesn’t do the work itself—it just passes the request to the brain and returns the result. We have one front desk for login, one for jobs, one for payments, one for admin, etc., and they all follow the same rules (check who’s asking, check the input, call the brain, return the answer).

**Areas:** Auth (auth.ts, authEnhanced, authRefactored—login, register, tokens). Jobs & assignment (jobs, assignment, matching, status, tracking—create job, get candidates, waves, status, tracking). Users (client, cleaner, cleanerOnboarding, cleanerPortal, userData—profile, onboarding, portal). Payments & credits (payments, stripe, credits—pay, webhooks, credit balance/purchase). Admin (admin/—analytics, bookings, cleaners, clients, finance, risk, settings, system). Other (health, cancellation, reschedule, messages, notifications, events, ai, gamification—health check, lifecycle, messaging, features).

---

## 6. Integrations (External Services)

**Technical:** Integrations are external API clients: Stripe (payments, Connect, webhooks), SendGrid (transactional email), Twilio (SMS, phone verification), n8n (workflow automation, e.g. event router). They live in `src/integrations/` (and sometimes `src/lib/`, e.g. Stripe wrapper). Only services and workers call integrations; routes never call them directly so we keep a clear boundary: routes → services → integrations. Clients are initialized once (singletons), use env for keys/secrets, and log initialization without exposing secrets; we fail fast if required env is missing.

**Simple (like for a 10-year-old):** Integrations are how we talk to other companies’ systems: Stripe for money, SendGrid for email, Twilio for texts, n8n for automation. We have one “connection” to each (like one phone line per company) and we keep the passwords and keys in our settings, not in the code. Only our “brain” (services) and background chores (workers) are allowed to use these connections—the front desk (routes) never talks to Stripe or SendGrid directly. That way we know exactly who’s allowed to do what.

**Per integration:** **Stripe**—payments, Connect (cleaner payouts), webhooks; used by paymentService, payoutsService, stripeConnectService, and the stripe webhook route; webhook secret from env. **SendGrid**—transactional email; used by services/notifications. **Twilio**—SMS, phone verification; used by phoneVerificationService and notifications. **n8n**—workflow automation (e.g. event router); used by events and webhooks for extensibility and automation.

---

## 7. Supporting Layers

### 7.1 Database

**Technical:** The database layer is a PostgreSQL connection pool and query helper. The single entry point is `src/db/client.ts`: `pool` (connection pool), `query(text, params)` for reads/writes, and `withTransaction(callback)` for multi-step atomic operations. Every service and core module that needs to read or write data uses this client; routes never call it directly. We use it on every request or worker that needs DB access. In practice we set DATABASE_URL in env; the test env uses a smaller pool (detected in client.ts). A single pool avoids connection leaks; withTransaction ensures we don’t commit half-finished work. We use one client, parameterized queries (no SQL injection), and the transaction helper; migrations live in DB/ or project root and are run separately (e.g. before deploy).

**Simple (like for a 10-year-old):** The database is where we store everything (jobs, users, report cards, payments). We have one “door” to the database (the db client): when the brain (services) needs to read or save something, it goes through that door. We never let the front desk (routes) touch the database directly—only the brain can. We also have a special “all or nothing” mode (transaction) so if we’re doing several steps (e.g. cancel job and refund and update report card), either all of them happen or none of them do. We keep the database address in our settings and run “migrations” (schema updates) separately before we deploy.

---

### 7.2 Config (Env)

**Technical:** Config is environment variable validation and defaults. `src/config/env.ts` exports an `env` object with required vars (DATABASE_URL, JWT_SECRET, STRIPE_*, N8N_WEBHOOK_SECRET) that throw on startup if missing, and optional vars with defaults (PORT, NODE_ENV, feature flags like WORKERS_ENABLED and PAYOUTS_ENABLED, payout percentages, etc.). It’s used at app startup (index.ts) and whenever any code needs a config value (db client, integrations, services). In practice we set env in Railway (or .env locally); required vars fail fast; optional have defaults. A single env object avoids scattered process.env and gives one place to document and validate. We use requireEnv for critical vars and typed defaults; we never put secrets in code—they stay in env.

**Simple (like for a 10-year-old):** Config is “our settings”: database address, secret keys for Stripe and JWT, and things like “are workers on?” and “what percentage do cleaners get?” We load them once when the app starts and check that the important ones are there (if not, we refuse to start). We keep everything in one list (env) so we know what the app needs and we never put passwords in the code—only in the environment so they’re not in the repo.

---

### 7.3 Lib

**Technical:** Lib (`src/lib/`) is shared utilities: auth (JWT helpers), errors (asyncHandler, sendError), logger (structured logging), validation (Zod schemas and middleware), response helpers (sendSuccess, sendCreated), queue, security (rate limit, sanitization), retry, circuit breaker, worker utils, etc. Routes use it for validation, auth, and response formatting; services use it for logger and retry; middleware use it for security. We use it on every request (middleware) and wherever a service needs logging, retry, or HTTP helpers. Lib is reusable and has no PureTask-specific business logic so we can keep it generic and test it independently.

**Simple (like for a 10-year-old):** Lib is a toolbox that the whole app shares: “check if this person is logged in,” “log this message,” “check this input is valid,” “send a success or error response,” “rate limit so nobody can spam us,” etc. The front desk and the brain both use the toolbox so we don’t duplicate the same checks and helpers everywhere. The toolbox doesn’t know PureTask-specific rules—it just knows “how to validate,” “how to log,” “how to respond”—so we can reuse it and keep the rules in the brain.

---

### 7.4 Middleware

**Technical:** Middleware (`src/middleware/`) is Express middleware that runs before route handlers: JWT auth (requireAuth, requireRole), admin auth, rate limiting, CSRF protection, security headers, request context (request ID). It’s applied to routers or the app in index.ts (e.g. auth on protected routes, rate limit globally or per route). We use it on every request that hits a protected or rate-limited route so unauthenticated or abusive requests never reach the handler. We put auth before the handler so we always know who’s calling; we use rate limit to prevent abuse. For multi-instance deployments we need Redis-backed rate limit; we use CSRF for state-changing operations where appropriate.

**Simple (like for a 10-year-old):** Middleware is the “bouncer” that runs before the front desk: “are you logged in?,” “are you an admin?,” “haven’t you sent too many requests?,” “is this request safe (CSRF)?” If the bouncer says no, the request never gets to the front desk. So every protected request gets checked the same way. We make sure we check “who are you?” before we do anything, and we limit how many requests someone can send so nobody can overload us.

---

## 8. One-Page Mental Model (Founder Cheat Sheet)

**Technical:** Engines = reliability + client risk + matching + assignment + cancellation + reschedule + flexibility + inconvenience + reason codes; they answer “who is good, who is risky, who gets the job, and how we handle changes.” Workers = scheduled background jobs (lifecycle, payouts, scores, backups, notifications, analytics) run via runner + scheduler or external cron. Job state machine = single source of truth for allowed job status transitions and who can trigger them; used on every status change. Core + services = all business logic and orchestration; called by routes and workers; they call DB and integrations. Routes = thin HTTP layer: validate → call services → return responses; no business logic, no direct DB. Integrations = Stripe, SendGrid, Twilio, n8n; used only by services/workers. Supporting = DB (pool, query, transaction), config (env), lib (auth, errors, logger, validation, security), middleware (auth, rate limit, CSRF).

**Simple (like for a 10-year-old):** **Engines** = the report cards (cleaner + customer) and the rules for “who gets the job” and “what happens when someone cancels or reschedules.” **Workers** = the chores that run on a schedule (update report cards, pay cleaners, send emails, backups). **Job state machine** = the rulebook for “what state a job can be in and who can change it.” **Core + services** = the brain: all the rules and work; the front desk and the chores ask the brain. **Routes** = the front desk: it checks who’s asking and what they sent, then asks the brain and returns the answer. **Integrations** = our connections to other companies (Stripe, email, SMS, automation); only the brain and the chores use them. **Supporting** = the database (where we store everything), settings (env), toolbox (auth, logging, validation, security), and bouncer (auth, rate limit, CSRF) that the whole app uses.

| Piece | One line |
|-------|----------|
| **Engines** | Reliability + client risk + matching + assignment + cancellation + reschedule + flexibility + inconvenience + reason codes = "who is good, who is risky, who gets the job, and how we handle changes." |
| **Workers** | Scheduled background jobs: lifecycle, payouts, scores, backups, notifications, analytics. Run via runner + scheduler or external cron. |
| **Job state machine** | Single source of truth for allowed job status transitions and who can trigger them; used on every status change. |
| **Core + services** | All business logic and orchestration; called by routes and workers; call DB and integrations. |
| **Routes** | Thin HTTP layer: validate → call services → return responses. No business logic, no direct DB. |
| **Integrations** | Stripe, SendGrid, Twilio, n8n. Used only by services/workers. |
| **Supporting** | DB (pool + query + transaction), config (env), lib (auth, errors, logger, validation, security), middleware (auth, rate limit, CSRF). |

---

## 9. Document Info

**Technical:** This document is a founder-level reference for the most important backend pieces. Each component is explained with eight questions (what it is, where/when/how it’s used, how we use it practically, why we use it vs alternatives, best practices, other info). Every answer has a Technical explanation (for engineers and product/tech decisions) and a Simple explanation (like for a 10-year-old). Minimum two sentences per part, up to several paragraphs where needed. See also: docs/active/ARCHITECTURE.md (layering, rules), docs/active/README.md (doc index), src/workers/WORKER_STATUS.md (worker list and status).

**Simple (like for a 10-year-old):** This doc explains every big part of the backend in two ways: the technical way (for the team building it) and the simple way (so even a kid could get the idea). For each part we answer: what is it, where do we use it, when, how, why we do it this way, and what to watch. Last updated 2026-01-31. For more detail on how the code is layered and how workers are scheduled, see ARCHITECTURE.md and WORKER_STATUS.md.
