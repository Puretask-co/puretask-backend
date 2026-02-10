# Founder Reference: Pricing

**Candidate:** Pricing (Feature #23)  
**Where it lives:** `pricingService`, `pricing` routes, dynamic or tiered pricing  
**Why document:** How price is calculated (per job, subscription, credits) and what inputs matter.

---

## The 8 main questions

### 1. What it is

**Technical:** Pricing in PureTask is the tier-aware job pricing logic that rewards cleaner reliability with higher rates. Implemented in `src/services/pricingService.ts` and `src/routes/pricing.ts`. **Tier price bands:** Bronze (floor: 0.9×, min/max per hour), Silver (standard 1.0×), Gold (1.15×), Platinum (1.25×). **Flow:** calculateJobPricing({ cleanerTier, baseHours, cleaningType?, baseRatePerHour? }) → basePrice = baseHours × baseRatePerHour (or tier band), tierAdjustment from multiplier, subtotal, platformFee (e.g. 15%), totalPrice, totalCredits (using CENTS_PER_CREDIT). createPricingSnapshot locks the breakdown (baseRatePerHour, tierAdjustedRatePerHour, baseHours, basePrice, tierAdjustment, tierMultiplier, subtotal, platformFee, totalPrice, totalCredits, cleanerTier, cleaningType?, calculatedAt) for storage on the job so price doesn’t drift after booking. **APIs:** getPricingEstimate (pre-booking, optional tier or range across tiers), getTierPriceBands; job assignment and accept flow call calculateJobPricing and createPricingSnapshot and store pricing_snapshot on jobs. Env: PLATFORM_FEE_PERCENT, CENTS_PER_CREDIT (used when converting to credits).

**Simple (like for a 10-year-old):** Pricing is how we decide how much a job costs. Cleaners have “levels” (bronze, silver, gold, platinum); higher level means they can charge more. We take hours and the cleaner’s level, add a platform fee (e.g. 15%), and get a total in dollars and credits. We save that “snapshot” on the job so the price doesn’t change after they book.

### 2. Where it is used

**Technical:** `src/services/pricingService.ts` — calculateJobPricing, createPricingSnapshot, getPricingEstimate, getTierPriceBands; `src/routes/pricing.ts` — GET /pricing/estimate, GET /pricing/tiers; `src/services/jobsService.ts` (on cleaner accept: calculate and store pricing_snapshot); `src/services/jobMatchingService.ts` (on assign and reassign: calculate and store pricing_snapshot). DB: jobs.pricing_snapshot (jsonb). Routes mounted at /pricing; jobs and matching call pricingService when assigning or accepting.

**Simple (like for a 10-year-old):** The code lives in pricingService and pricing routes. When we assign a cleaner or they accept, we calculate the price and save it on the job. The app can also get an “estimate” before booking and see the tier bands.

### 3. When we use it

**Technical:** When a client requests a pricing estimate (GET /pricing/estimate?hours=3&tier=gold); when a cleaner is assigned to a job (jobMatchingService calculates and stores pricing_snapshot); when a cleaner accepts a job (jobsService calculates and stores pricing_snapshot if not already set); when we display tier bands (GET /pricing/tiers). Triggered by user (estimate, accept) and by matching/assignment flow.

**Simple (like for a 10-year-old):** We use it when someone asks “how much for 3 hours?” or “how much for a gold cleaner?”, when we assign a cleaner (we lock the price), and when they accept (we lock it if we haven’t already). We also use it when we show the tier bands.

### 4. How it is used

**Technical:** calculateJobPricing: get base rate (from tier band or override), basePrice = baseHours × baseRatePerHour, tierMultiplier from TIER_PRICE_BANDS[cleanerTier], tierAdjustedRate = baseRate × multiplier, tierAdjustment = (adjusted - base) × hours, subtotal = basePrice + tierAdjustment, platformFee = subtotal × (PLATFORM_FEE_PERCENT/100), totalPrice = subtotal + platformFee, totalCredits = totalPrice / (CENTS_PER_CREDIT/100) or equivalent. createPricingSnapshot: same breakdown + calculatedAt (ISO). getPricingEstimate: optional tier → single tier breakdown or range across tiers. Jobs and matching: after assign/accept, call calculateJobPricing with job’s base hours and cleaner’s tier, createPricingSnapshot, UPDATE jobs SET pricing_snapshot = snapshot.

**Simple (like for a 10-year-old):** We take hours and the cleaner’s level, look up the rate and multiplier for that level, work out base price and the “level bonus,” add the platform fee, and convert to credits. We save that whole breakdown with a timestamp. For estimates we can do one tier or show a range. When we assign or accept we run this and save it on the job.

### 5. How we use it (practical)

**Technical:** Frontend: GET /pricing/estimate?hours=3 (optional &tier=gold), GET /pricing/tiers. Backend: jobsService and jobMatchingService call calculateJobPricing and createPricingSnapshot when assigning or accepting. Env: PLATFORM_FEE_PERCENT (e.g. 15), CENTS_PER_CREDIT. TIER_PRICE_BANDS and STANDARD_BASE_RATE in code (or config). If pricing calculation fails on assign/accept, we log and continue without snapshot (job still assigned).

**Simple (like for a 10-year-old):** The app calls “estimate” and “tiers.” When we assign or accept we run the calculation and save the snapshot. We have env for platform fee and cents-per-credit. The tier bands are in code. If the calculation fails we still assign the job but we log it and might not have a snapshot.

### 6. Why we use it vs other methods

**Technical:** Tier-based pricing rewards reliability (gold/platinum get premium) and gives clients a clear “better cleaner, higher rate.” Snapshot locks price at booking so we don’t change it later (fairness and disputes). Centralizing in pricingService keeps formula and bands in one place; jobs and matching just call it. Alternatives (flat rate, no snapshot) would be less fair or would allow price drift.

**Simple (like for a 10-year-old):** We use it so better cleaners can charge more and so the price we show at booking is the price we charge. Having one place for the formula keeps it fair and consistent.

### 7. Best practices

**Technical:** Always store snapshot on assign/accept so job has immutable price. Use same CENTS_PER_CREDIT and PLATFORM_FEE_PERCENT as rest of app (credits, payouts). Validate cleanerTier is one of bronze/silver/gold/platinum; fallback to silver if unknown. Document tier bands and platform fee in config or docs. Gaps: holiday rate (holidayService multiplier) may be applied elsewhere—ensure pricing and holiday flow are consistent; subscription pricing may have its own logic.

**Simple (like for a 10-year-old):** We always save the snapshot when we assign or accept so the job has a fixed price. We use the same “cents per credit” and platform fee everywhere. We could document the tier bands and platform fee clearly and make sure holiday rate is applied in the same way as here.

### 8. Other relevant info

**Technical:** jobs.pricing_snapshot is jsonb; payment and payout flows read it for credit_amount and breakdown. Holiday rate (holidayService) may multiply the rate when job date is a holiday and use_holiday_rate; that may be applied in pricing or in a separate step. FOUNDER_PAYMENT_FLOW.md and FOUNDER_PAYOUT_FLOW.md use pricing snapshot. FOUNDER_CREDIT_ECONOMY.md for credits; FOUNDER_HOLIDAYS.md for holiday multiplier.

**Simple (like for a 10-year-old):** The job stores the price breakdown; payment and payouts use it. Holiday rate might be applied on top when the job is on a holiday. The payment and payout docs explain how we use the snapshot; holidays doc explains the extra rate.

---

## Purpose and outcome

### 9. What is it supposed to accomplish?

**Technical:** Calculate job price from hours and cleaner tier (and optional cleaning type), apply platform fee, produce a stable snapshot for the job so price is locked at booking and used consistently for credits and payouts.

**Simple (like for a 10-year-old):** Figure out how much a job costs based on hours and cleaner level, add our fee, and save that so we don’t change the price after they book.

### 10. What does "done" or "success" look like?

**Technical:** calculateJobPricing returns correct breakdown; createPricingSnapshot returns snapshot with calculatedAt; job has pricing_snapshot after assign/accept; estimate and tiers endpoints return expected JSON. Invalid tier → fallback to silver or 400. Success = 200 + breakdown or snapshot.

**Simple (like for a 10-year-old):** Success means the numbers add up, the snapshot is saved on the job, and the estimate and tier endpoints return the right data. Bad tier gets a fallback or an error.

### 11. What would happen if we didn't have it?

**Technical:** No tier-based pricing; no snapshot; price could change between booking and payment or payout; inconsistent credits and payouts. Disputes would be harder (no locked breakdown).

**Simple (like for a 10-year-old):** We wouldn’t have “better cleaner, higher rate” or a locked price—we might charge or pay the wrong amount and disputes would be messy.

### 12. What is it not responsible for?

**Technical:** Not responsible for: capturing payment (paymentService); computing payout (payoutsService); tier computation (reliabilityService); holiday multiplier (holidayService). It only calculates and snapshots; callers store it and use it for credits and payouts.

**Simple (like for a 10-year-old):** It doesn’t take the payment or figure out what we pay the cleaner—it just calculates the price and saves the breakdown. Someone else figures out their “level” and applies holiday rate.

---

## Inputs, outputs, dependencies

### 13. Main inputs

**Technical:** cleanerTier (bronze|silver|gold|platinum), baseHours, cleaningType (optional), baseRatePerHour (optional). Env: PLATFORM_FEE_PERCENT, CENTS_PER_CREDIT. TIER_PRICE_BANDS in code.

**Simple (like for a 10-year-old):** We need the cleaner’s level, the hours, and maybe the cleaning type and a custom rate. We need the platform fee and cents-per-credit in env, and the tier bands in code.

### 14. What it produces or changes

**Technical:** Returns: PricingBreakdown (baseRatePerHour, tierAdjustedRatePerHour, basePrice, tierAdjustment, tierMultiplier, subtotal, platformFee, totalPrice, totalCredits); PricingSnapshot (same + calculatedAt). Does not write to DB itself; callers store snapshot on jobs.

**Simple (like for a 10-year-old):** It returns the full breakdown and a snapshot object. It doesn’t write to the database—the code that called it saves the snapshot on the job.

### 15–17. Consumers, flow, rules

**Technical:** Consumers: jobsService, jobMatchingService (store snapshot); payment flow (read snapshot for credit_amount); payout flow (read snapshot for earnings); frontend (estimate, tiers). Flow: input → calculateJobPricing → createPricingSnapshot → caller stores. Rules: tier from band; platform fee percent; snapshot immutable once stored.

**Simple (like for a 10-year-old):** Jobs and matching save the snapshot; payment and payout read it. We run the calculation, build the snapshot, and the caller saves it. We use the tier band and platform fee and we don’t change the snapshot after it’s stored.

---

## Triggers, dependencies, security

### 18. What triggers it

**Technical:** User request (estimate, tiers); assign flow (jobMatchingService); accept flow (jobsService). No cron.

**Simple (like for a 10-year-old):** When someone asks for an estimate or tier list, or when we assign or accept a job.

### 19. What could go wrong

**Technical:** Missing or invalid tier (fallback to silver); pricing_snapshot not stored (assign/accept continues but job has no locked price); CENTS_PER_CREDIT or PLATFORM_FEE_PERCENT mismatch with rest of app. Ensure snapshot is always stored on assign/accept and that env is consistent.

**Simple (like for a 10-year-old):** We might get a bad tier (we fall back to silver). We might fail to save the snapshot and still assign the job—then the job has no locked price. We need to use the same cents-per-credit and platform fee everywhere.

### 20–22. Monitoring, dependencies, config

**Technical:** Logs for pricing_calculated, pricing_snapshot_failed. Depends on env and tier bands. Config: PLATFORM_FEE_PERCENT, CENTS_PER_CREDIT; TIER_PRICE_BANDS in code.

**Simple (like for a 10-year-old):** We log when we calculate and when saving the snapshot fails. We depend on env and the tier bands. Platform fee and cents-per-credit are in env; bands are in code.

### 26. Security or privacy

**Technical:** Estimate and tiers are non-sensitive (no PII). Snapshot on job is sensitive (price); only job participants and admin should see. Same auth as rest of app.

**Simple (like for a 10-year-old):** The estimate and tier list don’t contain personal data. The snapshot on the job is private—only the client, cleaner, and admin should see it.

### 33. How it interacts with other systems

**Technical:** jobsService and jobMatchingService call and store snapshot; paymentService and payoutsService read snapshot. reliabilityService provides tier; holidayService may provide multiplier (applied in pricing or separately). Does not publish events or call Stripe directly.

**Simple (like for a 10-year-old):** Jobs and matching call us and save the snapshot; payment and payouts read it. Reliability gives us the tier; holidays might give us an extra multiplier. We don’t send events or call Stripe ourselves.

---

**See also:** FOUNDER_PAYMENT_FLOW.md, FOUNDER_PAYOUT_FLOW.md, FOUNDER_CREDIT_ECONOMY.md, FOUNDER_HOLIDAYS.md, FOUNDER_GAMIFICATION.md (tiers).
