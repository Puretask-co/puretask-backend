# PureTask Backend — Audit & Correction Playbook

**Created:** 2026-05-13
**Status:** Active — work through top to bottom in priority order
**Owner:** PURETASK (user)

---

## How to use this playbook

This document is organized **strictly by priority**. Start at Section 0 and don't skip ahead — earlier items are either dangerous (security) or block later items.

**Every task has four parts:**
- **WHY** — what bad thing happens if you skip it
- **WHAT** — the specific change in plain English
- **HOW** — exact commands or code to run/write
- **DONE WHEN** — concrete signal that you completed it correctly

**Difficulty markers:**
- 🟢 Easy — copy/paste commands, low risk
- 🟡 Medium — requires understanding what you're changing
- 🔴 Hard — requires real engineering judgment; ask for help if unsure

**Time estimates** are real-world for a beginner. Senior engineer would do most in half the time.

**Before you start anything in this playbook:**
1. Open a terminal in the project root: `cd C:\Users\onlyw\Documents\GitHub\puretask-backend`
2. Make sure you have a clean git state: run `git status`. If you have uncommitted changes, commit or stash them first.
3. Create a branch for this work: `git checkout -b audit-corrections-2026-05`
4. Have your `.env` file backed up somewhere safe (copy it to a non-repo location).

---

# SECTION 0 — CRITICAL: Security incidents (do TODAY)

These are not theoretical. They are real, present-tense problems.

---

## 0.1 🔴 Rotate the exposed JWT_SECRET

**Time:** 15 minutes
**Risk:** Logs every user out, forces re-login. Acceptable.

### WHY

Your live production `JWT_SECRET` is committed in git history at `docs/_archive/cleanup-2026-01-29/JWT_AUTHENTICATION_GUIDE.md`. The value:

```
c2f5bd0adc095f8c4571124e69c23177baa22aedfc8486c185e38279e09c7c9d2654d3d979a09a5beea07766bd56bb32a35f4c20ced90e9e069bfca9bba068c8
```

Anyone who has ever cloned this repo — collaborators, AI agents, leaked drives, GitHub forks — has this secret. With it, they can forge a valid login token for *any user including admins*, bypassing all authentication. Deleting the file does NOT help because git keeps every old version forever. You must assume this secret is compromised and rotate it.

### WHAT

1. Generate a new 64-byte random secret
2. Replace it in Railway (production) environment variables
3. Replace it in `.env` (local)
4. Replace it in staging if you have one
5. Delete the leaked file from working tree
6. (Optional but recommended) Scrub the secret from git history

### HOW

**Step 1 — Generate new secret.** In a terminal, run:
```powershell
# Windows PowerShell
[System.BitConverter]::ToString((1..64 | ForEach-Object {Get-Random -Maximum 256})).Replace("-","").ToLower()
```
Or use Node:
```powershell
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```
Copy the output. It should be 128 characters long.

**Step 2 — Update Railway.** Go to railway.app → your project → Variables → edit `JWT_SECRET` → paste the new value → Save. Railway will redeploy automatically.

**Step 3 — Update local `.env`.** Open `C:\Users\onlyw\Documents\GitHub\puretask-backend\.env` and replace the `JWT_SECRET=` line with the new value.

**Step 4 — Update other environments.** If you have staging on Railway, repeat Step 2 there.

**Step 5 — Delete the leaked file:**
```powershell
Remove-Item "docs\_archive\cleanup-2026-01-29\JWT_AUTHENTICATION_GUIDE.md"
git add docs/_archive/cleanup-2026-01-29/JWT_AUTHENTICATION_GUIDE.md
git commit -m "security: remove file containing exposed JWT secret"
```

**Step 6 (OPTIONAL) — Scrub git history.** Only worth doing if no one has forked your repo publicly. If you do this, *everyone* who has cloned the repo needs to re-clone:
```powershell
# Install BFG: https://rtyley.github.io/bfg-repo-cleaner/
# Then:
java -jar bfg.jar --delete-files JWT_AUTHENTICATION_GUIDE.md
git reflog expire --expire=now --all
git gc --prune=now --aggressive
git push --force
```
**Warning:** This is a destructive operation. The secret is already compromised — even after scrubbing, treat the old value as permanently leaked. The rotation is what protects you.

### DONE WHEN
- [ ] You can `grep "c2f5bd0adc095f8c" docs -r` and get zero results
- [ ] Your production app is still working (test by logging in)
- [ ] Existing users get logged out and have to log back in (this is expected — confirms the rotation worked)
- [ ] The new secret in `.env` matches the one in Railway

---

## 0.2 🟡 Sweep for other leaked secrets

**Time:** 30 minutes
**Risk:** None (read-only audit)

### WHY

If one secret leaked into a doc, others might have too. `.gitleaks.toml` exists in your repo but the audit didn't confirm whether it's actively running on every push. You need to know whether anything *else* is hot.

### WHAT

Run `gitleaks` against your full git history AND your working tree. Triage any findings.

### HOW

**Step 1 — Install gitleaks.** On Windows:
```powershell
# Using winget (preferred):
winget install gitleaks

# Or download from https://github.com/gitleaks/gitleaks/releases
# Drop the .exe somewhere on your PATH.
```

**Step 2 — Scan working tree (currently checked-out files):**
```powershell
gitleaks detect --no-git --source . --verbose
```

**Step 3 — Scan full git history:**
```powershell
gitleaks detect --source . --verbose
```

**Step 4 — Read every finding.** For each one:
- Is it a real secret? (Stripe keys start with `sk_`, AWS keys start with `AKIA`, JWT secrets are long hex strings)
- Is it currently in use? Check Railway env vars against what was found.
- If yes to both: **rotate that secret immediately** (same process as 0.1).
- If it's a false positive (test fixture, example value): add it to `.gitleaks.toml` as an allowlist entry.

**Step 5 — Wire gitleaks into CI permanently** (it may already be — verify):
```powershell
# Check if it's in your workflows:
grep -r "gitleaks" .github/workflows/
```
If not present, you'd add it. (Don't worry about this unless missing.)

### DONE WHEN
- [ ] Both gitleaks scans completed
- [ ] Every finding triaged (rotated OR allowlisted)
- [ ] `.github/workflows/security-scan.yml` contains a gitleaks step
- [ ] You have a written list of what you found and what you did about each

---

## 0.3 🟡 Investigate the orphaned `webhookEventStorage.ts`

**Time:** 30 minutes
**Risk:** None (investigation only)

### WHY

`docs/archive/webhookEventStorage.ts` is a 6.3 KB service file that defines `storeWebhookEvent()` and inserts into a `webhook_events` table. **It does not exist anywhere in `src/`** — meaning either:
- (a) Your webhook intake layer was designed and coded but never moved into production. Webhooks may be processing without canonical audit storage.
- (b) Some other code does this job and the orphan file is dead.

You need to know which.

### WHAT

Check whether the `webhook_events` table is being written to in production. Decide accordingly.

### HOW

**Step 1 — Connect to your production database.** Use a Postgres client (TablePlus, DBeaver, or `psql` command line). Your connection string is in Railway env vars under `DATABASE_URL`.

**Step 2 — Check if the table exists and has data:**
```sql
-- Does the table exist?
SELECT to_regclass('public.webhook_events');

-- If it does, are rows being written?
SELECT COUNT(*) FROM webhook_events;

-- When was the most recent row written?
SELECT MAX(received_at) FROM webhook_events;
```

**Step 3 — Decide based on results:**

| Result | What it means | Action |
|---|---|---|
| Table doesn't exist | The whole intake layer was never built | Either build it (use the orphan file as your spec — move it to `src/services/webhookEventStorage.ts` and add the migration) OR delete the orphan and confirm your existing webhook handlers are OK |
| Table exists but is empty / hasn't been written in >1 month | The intake layer was built but isn't being called | Find what calls `storeWebhookEvent()`. If nothing does, the layer is dead code. Either wire it up or remove it. |
| Table exists and has recent rows | The intake layer is live | Someone else (an earlier version of the file?) ended up implementing this. Search `src/` for similar code, delete the orphan. |

**Step 4 — Search `src/` for similar logic:**
```powershell
grep -r "webhook_events" src/ --include="*.ts"
grep -r "INSERT INTO webhook_events" src/ --include="*.ts"
```

**Step 5 — Take the appropriate action above.** If you need to move the file to `src/services/`, check that the migration that creates `webhook_events` table exists in `DB/migrations/`.

### DONE WHEN
- [ ] You can articulate in one sentence what `webhook_events` is for in your system
- [ ] `docs/archive/webhookEventStorage.ts` has been deleted OR moved to `src/services/`
- [ ] If moved: it compiles (`npm run build` succeeds) and your tests still pass (`npm test`)
- [ ] No `.ts` files remain in `docs/` anywhere (`find docs -name "*.ts"` returns nothing)

---

# SECTION 1 — HIGH PRIORITY: Enforce your own rules

You wrote good rules. You're not enforcing them. This is fixable.

---

## 1.1 🟡 Fix the DB-in-routes violation in `jobs.ts`

**Time:** 1-2 hours
**Risk:** Medium — touches a critical route file

### WHY

Your `.eslintrc.json` forbids importing `db/client` directly from route files. The route should call a service, the service should call the database. This separation lets you change database logic without touching HTTP code.

`src/routes/jobs.ts:31` violates this:
```typescript
import { query } from "../db/client";
```

It's not on the whitelist of allowed exceptions. CI isn't catching it. Every new developer who reads this file will think "oh, jobs.ts does it, so I can too" — and the rule slowly dies.

### WHAT

1. Find all places `query()` is called inside `routes/jobs.ts`
2. Move each one into `src/services/jobsService.ts` (or create a new `src/services/jobsDbService.ts` if jobsService is too crowded)
3. Update `routes/jobs.ts` to call the service instead
4. Remove the `db/client` import from the route file
5. Run ESLint to confirm it now flags violations if you add them back

### HOW

**Step 1 — Find all `query(` calls in jobs.ts:**
```powershell
grep -n "query(" src/routes/jobs.ts
```
You'll get a list of line numbers. Note them.

**Step 2 — For each one, identify what it's doing.** Open `src/routes/jobs.ts` and read the surrounding code. Each call is probably part of a helper function (like `getCleanerComposite` mentioned in your audit at line 48). The whole helper should move.

**Step 3 — Open `src/services/jobsService.ts`.** Add a new exported function for each helper. Example pattern:

```typescript
// BEFORE in routes/jobs.ts:
async function getCleanerComposite(cleanerId: string) {
  const result = await query(`SELECT ... FROM cleaners WHERE id = $1`, [cleanerId]);
  return result.rows[0];
}

// AFTER in services/jobsService.ts:
export async function getCleanerComposite(cleanerId: string) {
  const result = await query(`SELECT ... FROM cleaners WHERE id = $1`, [cleanerId]);
  return result.rows[0];
}

// AFTER in routes/jobs.ts:
import { getCleanerComposite } from "../services/jobsService";
// ...delete the local function...
```

**Step 4 — Remove the offending import:**
```typescript
// DELETE this line from routes/jobs.ts:
import { query } from "../db/client";
```

**Step 5 — Verify TypeScript still compiles:**
```powershell
npm run build
```
Fix any errors before continuing.

**Step 6 — Verify ESLint is satisfied:**
```powershell
npx eslint src/routes/jobs.ts
```
Should report no `no-restricted-imports` errors.

**Step 7 — Test the routes still work:**
```powershell
npm test
```
Pay attention to any tests under `src/tests/integration/` involving jobs.

**Step 8 — Confirm the rule fires on violations.** Temporarily add this line to `routes/jobs.ts`:
```typescript
import { query } from "../db/client";
```
Then run `npx eslint src/routes/jobs.ts`. It SHOULD now error. If it doesn't, your ESLint rule is misconfigured — investigate `.eslintrc.json` lines 44-60. Once confirmed working, remove the test line.

### DONE WHEN
- [ ] `grep "from \"\\.\\./db/client\"" src/routes/jobs.ts` returns nothing
- [ ] `npm run build` succeeds with no errors
- [ ] `npm test` passes
- [ ] `npx eslint src/routes/` succeeds with no `no-restricted-imports` errors
- [ ] Manual test: try adding the bad import back temporarily — ESLint catches it. Remove your test addition.

---

## 1.2 🟢 Make ESLint actually block CI on architecture violations

**Time:** 30 minutes
**Risk:** Low

### WHY

Even with rule 1.1 fixed, if CI doesn't run ESLint on every PR with a failure gate, future violations will sneak in. The whole point is to make these rules **automatic**.

### WHAT

Verify `.github/workflows/ci.yml` runs `npm run lint` (or equivalent) and fails the build on errors. If not, add it.

### HOW

**Step 1 — Open `.github/workflows/ci.yml`.** Look for a step that runs `eslint` or `npm run lint`.

**Step 2 — Check `package.json`** for a `lint` script:
```powershell
grep "\"lint\"" package.json
```
If you don't see one, add this to the `scripts` section:
```json
"lint": "eslint src --ext .ts --max-warnings 0"
```
The `--max-warnings 0` is critical — without it, warnings don't fail the build.

**Step 3 — Verify CI runs it.** Open `.github/workflows/ci.yml` and confirm there's a step like:
```yaml
- name: Lint
  run: npm run lint
```
If missing, add it after the install step and before the test step.

**Step 4 — Test locally:**
```powershell
npm run lint
```
Should complete with no errors. (Warnings are OK to start; you'll tighten this in section 2.)

**Step 5 — Push to a test branch and watch CI** to confirm it runs and reports lint status.

### DONE WHEN
- [ ] `package.json` has `"lint": "eslint src --ext .ts --max-warnings 0"` or similar
- [ ] `.github/workflows/ci.yml` calls `npm run lint`
- [ ] You have proof from a CI run that lint executed and would fail on errors
- [ ] Try deliberately breaking a rule on a test branch — CI fails. Then revert.

---

## 1.3 🟡 Set a coverage threshold floor

**Time:** 1 hour
**Risk:** Low

### WHY

Right now you measure test coverage but don't enforce a minimum. Coverage can silently decrease over time. Setting a floor means a PR that drops coverage *fails CI*.

The right starting threshold is **your current coverage minus 1-2%** — not aspirational, just "don't get worse."

### WHAT

1. Measure current coverage
2. Add `thresholds` block to `vitest.config.ts`
3. Verify CI fails when coverage drops below threshold

### HOW

**Step 1 — Measure current coverage:**
```powershell
npm run test:coverage
```
At the end of the output you'll see a table with `Lines`, `Branches`, `Functions`, `Statements` percentages. Write these down.

Example output might look like:
```
All files     |   68.3 |    52.1 |   71.4 |   67.9 |
```

**Step 2 — Pick threshold values 2 points below current.** Example: if current is 68.3% lines, set threshold to 66%.

**Step 3 — Open `vitest.config.ts`** and find the `coverage` block. Add `thresholds`:
```typescript
coverage: {
  provider: 'v8',
  reporter: ['text', 'json-summary', 'lcov'],
  reportsDirectory: './coverage',
  thresholds: {
    lines: 66,
    branches: 50,
    functions: 70,
    statements: 66,
  },
},
```

**Step 4 — Test it locally:**
```powershell
npm run test:coverage
```
Should still pass (your thresholds are below current).

**Step 5 — Test that it would fail on regression.** Temporarily set `lines: 99` and re-run — it should fail with a threshold error. Then put your real values back.

**Step 6 — Confirm CI runs the coverage command.** Check `.github/workflows/ci.yml` — there should already be a `test:ci:coverage` step per your audit.

### DONE WHEN
- [ ] `vitest.config.ts` contains a `thresholds` block
- [ ] `npm run test:coverage` passes
- [ ] Demonstrated that artificially high threshold causes failure
- [ ] Numbers committed match your actual current coverage minus 2

**Going forward:** Every quarter, raise the threshold by 2-5 points. This is how you ratchet quality upward without ever taking a step back.

---

## 1.4 🟡 Enable `strictFunctionTypes` in TypeScript

**Time:** 1-3 hours (depends on how many errors surface)
**Risk:** Medium — may reveal real bugs you have to fix

### WHY

`tsconfig.json` has `"strict": true` but `"strictFunctionTypes": false`. This intentionally weakens one of the most useful checks: it lets you assign a function with wrong-type parameters to a variable expecting different parameters. Real bugs hide here.

### WHAT

Turn the flag on. Fix whatever errors appear.

### HOW

**Step 1 — Open `tsconfig.json`.** Find `"strictFunctionTypes": false` and change to `true`.

**Step 2 — Compile and count errors:**
```powershell
npm run build 2>&1 | grep -c "error TS"
```

**Step 3 — If 0 errors:** You're done. Commit the change.

**Step 4 — If errors exist:** Fix them one by one. Common patterns:
- Event handlers passed to listeners that expect different argument shapes
- Callbacks where the signature drifted

Get errors one at a time:
```powershell
npm run build 2>&1 | grep "error TS" | head -5
```

For each, open the file and fix the type. If you can't figure out a fix in 15 minutes, comment the function and add a `// TODO: strictFunctionTypes fix` and ask for help.

**Step 5 — When all errors resolved:**
```powershell
npm run build  # should succeed
npm test       # should pass
```

### DONE WHEN
- [ ] `tsconfig.json` has `"strictFunctionTypes": true`
- [ ] `npm run build` succeeds
- [ ] `npm test` passes
- [ ] No new `// @ts-ignore` comments were added to suppress errors

---

## 1.5 🟢 Make `npm audit` blocking

**Time:** 15-60 minutes (depends on what's vulnerable)
**Risk:** Low

### WHY

`.github/workflows/security-scan.yml` line 166 has `continue-on-error: true` for the `npm audit` step. This means dependency vulnerabilities are *reported* but don't block PRs. You're collecting CVEs silently.

### WHAT

Remove `continue-on-error`. Triage whatever breaks.

### HOW

**Step 1 — See what audit currently finds:**
```powershell
npm audit
```
This lists vulnerabilities by severity. Ignore `info` and `low`. Focus on `high` and `critical`.

**Step 2 — For each high/critical, try the automatic fix:**
```powershell
npm audit fix
```
If that doesn't resolve everything:
```powershell
npm audit fix --force
```
**Warning:** `--force` can install breaking version upgrades. Test thoroughly after.

**Step 3 — For any unresolvable issues:** Add them to `.npmrc` or use `npm audit --audit-level=critical` to only block on critical.

**Step 4 — Edit `.github/workflows/security-scan.yml`** line ~166. Remove the `continue-on-error: true` line entirely. Or change the audit command to `npm audit --audit-level=high` so only high/critical block.

**Step 5 — Verify locally:**
```powershell
npm audit --audit-level=high
```
Should exit with code 0 (no high or critical issues).

**Step 6 — Push and verify CI passes.**

### DONE WHEN
- [ ] `npm audit --audit-level=high` exits 0
- [ ] `.github/workflows/security-scan.yml` no longer has `continue-on-error: true` on the audit step
- [ ] CI passes on a fresh PR
- [ ] You can articulate any remaining low/moderate issues and why they're acceptable

---

# SECTION 2 — MEDIUM: Code quality cleanup

The codebase has good bones. These are the tech debt items to keep it healthy.

---

## 2.1 🟡 Pay down `any` types in the top 4 worst files

**Time:** 1 day spread across a week
**Risk:** Low

### WHY

You have 231 `any` types in the codebase. They concentrate in:
- `src/routes/gamification.ts` (22)
- `src/routes/cleaner-ai-settings.ts` (22)
- `src/routes/cleanerOnboarding.ts` (13)
- `src/routes/cleaner-ai-advanced.ts` (12)

`any` defeats TypeScript. If a function takes `any`, you can pass it garbage and the compiler won't warn. Every `any` is a place where bugs can hide.

### WHAT

Open each file, look at every `any`, replace with a real type (or `unknown` if you genuinely don't know).

### HOW

**Step 1 — Find every `any` in the target file:**
```powershell
grep -n ": any" src/routes/gamification.ts
```

**Step 2 — For each occurrence, ask:**
- "What does this variable actually contain?" Look at how it's used.
- If it's a request body: define a `zod` schema (you already use Zod) and use the inferred type.
- If it's a function parameter: write an interface for it.
- If it's a database row: there's likely already a type in `src/types/db.ts` — use it.
- If you truly cannot tell what it is: change `any` to `unknown`. The compiler will force you to validate before using it — that's the point.

**Step 3 — Example fix:**

```typescript
// BEFORE:
async function handleGamificationUpdate(req: any, res: any) {
  const { cleanerId, points } = req.body;
  // ...
}

// AFTER:
import { z } from "zod";

const GamificationUpdateSchema = z.object({
  cleanerId: z.string(),
  points: z.number(),
});

async function handleGamificationUpdate(req: Request, res: Response) {
  const { cleanerId, points } = GamificationUpdateSchema.parse(req.body);
  // ...
}
```

**Step 4 — After fixing each file, compile and test:**
```powershell
npm run build
npm test
```

**Step 5 — Once you've cleaned the top 4 files, flip the ESLint rule to `error`:**
Open `.eslintrc.json`, find:
```json
"@typescript-eslint/no-explicit-any": "warn"
```
Change to:
```json
"@typescript-eslint/no-explicit-any": "error"
```
This means no new `any` can sneak in. Existing ones in other files will need `// eslint-disable-next-line @typescript-eslint/no-explicit-any` comments — annoying enough that people will just fix them.

### DONE WHEN
- [ ] `grep -c ": any" src/routes/gamification.ts` returns 0 (or close to it)
- [ ] Same for the other three target files
- [ ] `.eslintrc.json` has `no-explicit-any: error`
- [ ] `npm run lint` passes
- [ ] `npm test` passes

---

## 2.2 🟡 Replace raw `throw new Error()` with the `Errors.*` factory

**Time:** 2-4 hours
**Risk:** Low-Medium

### WHY

You designed a beautiful error system (`AppError` + `ErrorCode` enum + `Errors.*` factories) but only use it in ~3 places. Meanwhile there are **122 raw `throw new Error()`** calls. The result: some clients get nicely-shaped JSON errors with codes; others get generic 500s with raw messages. Inconsistent contracts.

### WHAT

Find every `throw new Error(...)` and replace with the appropriate `Errors.*` factory call.

### HOW

**Step 1 — Find all occurrences:**
```powershell
grep -rn "throw new Error(" src/ --include="*.ts" > error-throws.txt
```

**Step 2 — Open `error-throws.txt`.** You'll see ~122 lines like:
```
src/services/jobsService.ts:142:  throw new Error("Job not found");
src/services/paymentService.ts:88:  throw new Error("Invalid payment state");
```

**Step 3 — Open `src/lib/errors.ts`** and list available factories. Probably something like:
```typescript
Errors.notFound(resource)
Errors.unauthenticated()
Errors.forbidden()
Errors.invalidState(message)
Errors.validation(details)
Errors.internal(message)
```

**Step 4 — For each `throw new Error()`, pick the right factory:**

| Old | New |
|---|---|
| `throw new Error("Job not found")` | `throw Errors.notFound("job")` |
| `throw new Error("Invalid payment state")` | `throw Errors.invalidState("payment")` |
| `throw new Error("Missing field foo")` | `throw Errors.validation({ field: "foo" })` |
| `throw new Error("Internal X failed")` | `throw Errors.internal("X failed")` |

**Step 5 — Add the import** if missing from the file:
```typescript
import { Errors } from "../lib/errors";
```

**Step 6 — Test thoroughly.** Run tests after every batch of ~20 changes:
```powershell
npm test
```

**Step 7 — Once done, prevent new violations.** Add a custom ESLint rule. In `.eslintrc.json`:
```json
"no-restricted-syntax": [
  "error",
  {
    "selector": "ThrowStatement > NewExpression[callee.name='Error']",
    "message": "Use Errors.* factories from src/lib/errors.ts instead of raw Error."
  }
]
```

### DONE WHEN
- [ ] `grep -rc "throw new Error(" src/ --include="*.ts"` returns 0 in production code (test files are OK)
- [ ] ESLint rule prevents new `throw new Error()` in `src/`
- [ ] `npm test` passes
- [ ] Spot-check 3 error responses in Postman — they all have `code`, `message`, `details` fields

---

## 2.3 🟡 Audit `asyncHandler` coverage

**Time:** 1-2 hours
**Risk:** Low

### WHY

Async route handlers that don't get wrapped in `asyncHandler` can throw unhandled promise rejections that crash the Node process. You have 39 uses of `asyncHandler` across 6 files — but ~68 route files. The math says many routes are unwrapped.

### WHAT

Find every async route handler, ensure it's wrapped, then add a lint rule to prevent regressions.

### HOW

**Step 1 — Find async handlers without asyncHandler wrap.** This is tricky to grep perfectly, but a starting heuristic:
```powershell
grep -rn "router\.\(get\|post\|put\|delete\|patch\)" src/routes/ --include="*.ts" > all-routes.txt
```

**Step 2 — Open each route file** and look for handlers like:
```typescript
// UNWRAPPED (DANGEROUS):
router.get("/jobs/:id", async (req, res) => {
  const job = await getJob(req.params.id);  // if this throws, process crashes
  res.json(job);
});

// WRAPPED (SAFE):
router.get("/jobs/:id", asyncHandler(async (req, res) => {
  const job = await getJob(req.params.id);
  res.json(job);
}));
```

**Step 3 — Wrap each unwrapped handler.** Import `asyncHandler` if missing:
```typescript
import { asyncHandler } from "../lib/asyncHandler";  // adjust path
```

**Step 4 — Test as you go:**
```powershell
npm test
```

**Step 5 — After cleanup, consider adding a custom lint rule** to fail PRs that add unwrapped handlers. This is hard to do generically; alternative is a custom CodeQL query or a code review checklist item.

### DONE WHEN
- [ ] You've reviewed every route file once
- [ ] Every async handler is either wrapped in `asyncHandler` or doesn't return a Promise
- [ ] `npm test` passes
- [ ] You can articulate why this matters in one sentence (in case you need to explain to a future collaborator)

---

## 2.4 🟡 Phase out ESLint route exemptions

**Time:** Spread across 6-12 weeks (one route per week)
**Risk:** Medium

### WHY

`.eslintrc.json` lines 62-99 exempt 37 routes from import restrictions. Each exemption is acknowledged technical debt. Every exempt file is a place where the architectural rule doesn't apply, and over time, that becomes "the rule doesn't apply to anything."

### WHAT

Pick one exempt route per week. Refactor it to comply with the rule. Remove the exemption.

### HOW

**Step 1 — Pick the smallest exempt route first.** Open `.eslintrc.json`, see the list of exempt files. Choose one with few lines of code to refactor as your starter.

**Step 2 — Refactor it the same way you did `jobs.ts`** (section 1.1): move DB code to a service.

**Step 3 — Remove its entry from the ESLint whitelist** in `.eslintrc.json`.

**Step 4 — Run `npx eslint src/routes/<that-file>.ts` — should pass.

**Step 5 — Run tests and verify:**
```powershell
npm test
```

**Step 6 — Commit, push, and move to the next file next week.**

Don't try to do all 37 at once. Steady, predictable cleanup. After 6-12 weeks, the whitelist is empty.

### DONE WHEN (per cycle)
- [ ] One exempt route refactored
- [ ] Its entry removed from `.eslintrc.json` whitelist
- [ ] Tests pass
- [ ] Committed with a clear message

### DONE WHEN (overall)
- [ ] `.eslintrc.json` has no route exemptions
- [ ] Or: the remaining exemptions are explicitly documented as permanent with reasons (the AI route files might genuinely need DB access for valid reasons)

---

# SECTION 3 — MEDIUM: Documentation cleanup

Your docs say one thing, your code does another. Fix the docs.

---

## 3.1 🟡 Restore the 8 verified-missing reference docs

**Time:** 1 hour
**Risk:** None

### WHY

Eight reference documents are in archives but have unique content that doesn't exist in `docs/active/`. They have ongoing reference value.

### WHAT

Move them to `docs/active/` with appropriate naming.

### HOW

For each file below, read it first (`Read` in your editor) to verify the content matches the filename and is still accurate. Then move:

| Source | Destination | Why |
|---|---|---|
| `docs/_archive/cleanup-2026-01-29/STRIPE_TESTING.md` | `docs/active/founder/STRIPE_TESTING.md` | Stripe CLI testing commands |
| `docs/_archive/old-misc/ARCHITECTURE_ENFORCEMENT_GUIDE.md` | `docs/active/ARCHITECTURE_ENFORCEMENT.md` | The "how to enforce the rules" companion to ARCHITECTURE.md |
| `docs/_archive/old-misc/N8N_WORKFLOW_VALIDATION.md` | `docs/active/founder/N8N_WORKFLOW_VALIDATION.md` | n8n workflow import/validation reference |
| `docs/archive/TESTING_QUICK_REFERENCE.md` | `docs/active/TESTING_QUICK_REFERENCE.md` | Vitest command cheatsheet |
| `docs/archive/raw/development/DEVELOPMENT_WORKFLOW_GUIDE.md` | `docs/active/DEVELOPMENT_WORKFLOW.md` | Local dev workflow |
| `docs/archive/raw/development/WINDOWS_SETUP.md` | `docs/active/WINDOWS_SETUP.md` | Windows-specific setup (you're on Windows) |
| `docs/archive/raw/deployment/DEPLOY_TO_RAILWAY.md` | `docs/active/DEPLOY_TO_RAILWAY.md` | Only if content is materially different from existing `DEPLOYMENT.md` |
| `docs/archive/raw/frontend-backend-specs/FRONTEND_STATUS_AND_BACKEND_EXPECTATIONS.md` | `docs/active/FRONTEND_API_CONTRACT.md` | Frontend-backend coordination spec |

**Step 1 — Read each source file first.** Confirm content matches the filename and is still accurate. If a file references "V2 plans" but you're past V4, skip it.

**Step 2 — Use git mv to preserve history:**
```powershell
git mv "docs/_archive/cleanup-2026-01-29/STRIPE_TESTING.md" "docs/active/founder/STRIPE_TESTING.md"
# ... repeat for each
```

**Step 3 — Add a note at the top of each restored file:**
```markdown
> **Restored from archive 2026-05-13** — verified content still applicable.
> Last reviewed by: PURETASK
```

**Step 4 — Update `docs/active/DOCUMENTATION_INDEX.md`** to reference the newly restored files.

**Step 5 — Commit:**
```powershell
git commit -m "docs: restore 8 reference docs verified absent from active docs"
```

### DONE WHEN
- [ ] All 8 files exist in `docs/active/` with restoration note headers
- [ ] `DOCUMENTATION_INDEX.md` references them
- [ ] git log shows the moves (preserves history)

---

## 3.2 🟢 Archive the stale root docs

**Time:** 15 minutes
**Risk:** None

### WHY

Five files at the repo root contradict your canonical `docs/active/` content. New developers might find them via search and follow obsolete guidance.

### WHAT

Move these to `docs/_archive/stale-root-2026-05/` with a header explaining why.

### HOW

**Step 1 — Create the archive folder:**
```powershell
New-Item -ItemType Directory -Path "docs/_archive/stale-root-2026-05"
```

**Step 2 — Move each file:**
```powershell
git mv "IMPLEMENTATION_GUIDE.md" "docs/_archive/stale-root-2026-05/IMPLEMENTATION_GUIDE.md"
git mv "NEXT_5_MOVES.md" "docs/_archive/stale-root-2026-05/NEXT_5_MOVES.md"
git mv "NEXT_5_STRATEGIC_MOVES.md" "docs/_archive/stale-root-2026-05/NEXT_5_STRATEGIC_MOVES.md"
git mv "SERVER_STARTUP_GUIDE.md" "docs/_archive/stale-root-2026-05/SERVER_STARTUP_GUIDE.md"
```

**Step 3 — Add a README to the new folder:**
Create `docs/_archive/stale-root-2026-05/README.md`:
```markdown
# Archived 2026-05-13

These files were at the repo root but contradict the canonical docs in `docs/active/`.
Archived to reduce confusion. Do not restore without confirming the content matches current architecture.

- `IMPLEMENTATION_GUIDE.md` — empty placeholder
- `NEXT_5_MOVES.md`, `NEXT_5_STRATEGIC_MOVES.md` — old strategic plans, recommend logging/APM tools that contradict the live stack (custom logger + Sentry)
- `SERVER_STARTUP_GUIDE.md` — outdated local-dev guide
```

**Step 4 — Commit:**
```powershell
git commit -m "docs: archive stale root-level guides that contradict docs/active"
```

### DONE WHEN
- [ ] `ls *.md` at repo root shows only README.md, ENV_VARS_CHECKLIST.md, TEST_ACCOUNTS_REFERENCE.md, and CODEOWNERS
- [ ] The four files exist in the archive folder
- [ ] The new archive folder has a README explaining the why

---

## 3.3 🟡 Triage and delete the junk archives

**Time:** 1 hour
**Risk:** Low

### WHY

You have:
- `docs/archive/raw/uncategorized/` — **243 files** of unsorted content, probably almost all junk
- `docs/archive/migrations/` — 8 SQL files of old patches superseded by canonical migrations
- `puretask info- NEEDS REVIEW.zip` (3.5 MB) at root — never reviewed

These are taking space and creating confusion.

### WHAT

Sample, decide, delete.

### HOW

**Step 1 — Sample the uncategorized folder:**
```powershell
Get-ChildItem "docs/archive/raw/uncategorized/" | Get-Random -Count 10 | Select-Object Name
```
You'll get 10 random filenames. Open each and judge: is this junk (progress reports, AI outputs, status snapshots)? Or actual reference content?

**Step 2 — If 10/10 are junk, delete the whole folder:**
```powershell
Remove-Item "docs/archive/raw/uncategorized" -Recurse
git add docs/archive/raw/uncategorized
git commit -m "docs: delete 243-file uncategorized archive folder (sampled, all junk)"
```

If even 1 looks like reference material, do a fuller pass before deleting.

**Step 3 — Triage `docs/archive/migrations/`:**
```powershell
Get-ChildItem "docs/archive/migrations/"
```
These are SQL files like `000_fix_*.sql`, `DROP_*.sql`, `FIX_*.sql`. Confirm each was already applied in production (check `DB/migrations/` for the canonical version) — then:
```powershell
Remove-Item "docs/archive/migrations/" -Recurse
git commit -m "docs: delete obsolete migration patches (superseded by DB/migrations/)"
```

**Step 4 — Handle the zip file:**
```powershell
# Read the README inside the zip if you want to know what's in it:
Expand-Archive -Path "puretask info- NEEDS REVIEW.zip" -DestinationPath "tmp-review/"
# Look at what's in tmp-review/
# If nothing valuable:
Remove-Item "puretask info- NEEDS REVIEW.zip"
Remove-Item "tmp-review/" -Recurse
git commit -m "chore: remove 3.5MB unreviewed archive zip"
```

### DONE WHEN
- [ ] `docs/archive/raw/uncategorized/` deleted (or sampled and confirmed needed)
- [ ] `docs/archive/migrations/` deleted or moved to `DB/migrations/archive/`
- [ ] `puretask info- NEEDS REVIEW.zip` deleted or contents reviewed
- [ ] Repo size decreased; `git status` is clean

---

## 3.4 🟢 Remove vestigial Jest configs

**Time:** 5 minutes
**Risk:** None

### WHY

`jest.config.js` and `jest.config.coverage.js` exist but Vitest is your actual test runner. Future devs will edit Jest configs and wonder why tests don't change.

### WHAT

Delete the Jest configs and remove Jest from dependencies if it's unused.

### HOW

**Step 1 — Verify Jest is unused:**
```powershell
grep -r "from 'jest'" src/ 2>$null
grep -r "from \"jest\"" src/ 2>$null
grep "\"jest\":" package.json
```
Should find nothing in `src/`. The only reference should be in `package.json` devDependencies.

**Step 2 — Delete the config files:**
```powershell
Remove-Item jest.config.js
Remove-Item jest.config.coverage.js
```

**Step 3 — Remove from `package.json`:**
```powershell
npm uninstall jest @types/jest
```

**Step 4 — Verify tests still work:**
```powershell
npm test
```

**Step 5 — Commit:**
```powershell
git add -A
git commit -m "chore: remove vestigial Jest configs (Vitest is the runner)"
```

### DONE WHEN
- [ ] `jest.config.js` and `jest.config.coverage.js` deleted
- [ ] No `jest` packages in `package.json`
- [ ] `npm test` still works (it uses Vitest)

---

## 3.5 🟢 Mark stale phase docs clearly

**Time:** 15 minutes
**Risk:** None

### WHY

`docs/active/00-CRITICAL/PHASE_*_STATUS.md` files were last updated at different times. PHASE_3 and PHASE_5 are recent (April 18), but PHASE_0_1, 2, 4, 6, 7, 8, 9, 10, 11, 12, 13, 14 may be frozen at Feb 11. A reader can't tell which is "current state" vs "archived snapshot."

### WHAT

For each phase doc not updated in 90+ days, add an ARCHIVED header.

### HOW

**Step 1 — Check last-modified dates:**
```powershell
Get-ChildItem "docs/active/00-CRITICAL/PHASE_*_STATUS.md" | Select-Object Name, LastWriteTime
```

**Step 2 — For each file older than ~90 days,** add this to the very top of the file:
```markdown
> **⚠️ ARCHIVED — point-in-time snapshot from [date]**
> This file reflects the state of Phase N at the time of writing.
> For current status, see `docs/active/PROJECT_ISSUES_AND_REMEDIATION.md`.
```

**Step 3 — Commit:**
```powershell
git commit -m "docs: mark stale phase status docs as point-in-time snapshots"
```

### DONE WHEN
- [ ] Every PHASE_*_STATUS.md is either recently updated OR has an ARCHIVED header
- [ ] A new reader of the docs can tell which phase docs are "live"

---

# SECTION 4 — MEDIUM: Operational gaps

Things that matter when prod breaks. Document them before you need them.

---

## 4.1 🟡 Write detailed incident playbooks

**Time:** 4-8 hours total
**Risk:** None

### WHY

`docs/active/RUNBOOK.md` § 3.1 has a table of incident types but no step-by-step playbooks. When prod breaks at 2 AM, you don't want to be inventing the response.

### WHAT

Write a 1-page playbook for each common incident type.

### HOW

For each incident in the table below, create a file at `docs/active/incidents/<incident-name>.md`:

**Step 1 — Create the folder:**
```powershell
New-Item -ItemType Directory -Path "docs/active/incidents"
```

**Step 2 — Use this template for each incident:**

```markdown
# Incident Playbook: <Name>

## Symptoms (how do I know this is happening?)
- Alert from: <Sentry / Slack / customer report>
- Visible signal: <e.g., "5xx rate >5%", "Stripe webhook backlog >100">
- Where to confirm: <link to Sentry / health endpoint / Stripe dashboard>

## Severity
- P0 / P1 / P2 (define what each means in your system)

## First 5 minutes
1. Acknowledge the alert
2. Check <specific dashboard URL>
3. Determine: is this widespread or single-user?
4. Post initial status in <Slack channel>

## Diagnosis steps
1. <command or check 1>
2. <command or check 2>
3. ...

## Common root causes
- Cause A → Fix A
- Cause B → Fix B

## Mitigation (stop the bleeding)
- <feature flag to toggle>
- <kill switch to flip>

## Resolution (fix the underlying issue)
- <code change / deploy / rollback>

## Post-incident
- Create a postmortem in `docs/active/incidents/postmortems/`
- Update this playbook if you learned something new
```

**Step 3 — Write playbooks for at least these incidents:**

| Playbook | Why it's critical |
|---|---|
| `stripe-webhook-backlog.md` | Your retry queue is filling up — orders aren't being marked paid |
| `payment-spike.md` | High Stripe error rate; may be fraud, may be Stripe outage, may be your bug |
| `auth-broken.md` | Users can't log in (was this caused by your JWT rotation? Did you forget to update one environment?) |
| `database-down.md` | Neon Postgres is unreachable |
| `worker-not-running.md` | Cron jobs stopped executing — payouts/notifications backlog |
| `cleaner-cant-receive-payout.md` | Stripe Connect issue, specific user impact |
| `n8n-workflow-failure.md` | External workflow integration broke |
| `notification-delivery-failure.md` | SendGrid/Twilio/OneSignal failing |

**Step 4 — Add this index to `docs/active/incidents/README.md`:**
```markdown
# Incident Playbooks

When something breaks, find the right playbook here. Each is 1 page, designed for 2AM-clarity reading.

- [Stripe webhook backlog](./stripe-webhook-backlog.md)
- ... (list each)
```

### DONE WHEN
- [ ] `docs/active/incidents/` folder exists with 8+ playbooks
- [ ] Each playbook follows the template
- [ ] `RUNBOOK.md` § 3.1 links to the new playbooks
- [ ] You can imagine handing your laptop to someone at 2AM and they could follow a playbook end-to-end

---

## 4.2 🟢 Document on-call rotation (even if it's just you)

**Time:** 15 minutes
**Risk:** None

### WHY

If you're a solo founder, you ARE on call. That's fine. But documenting it makes it explicit and helps when you (a) hire someone or (b) want to go on vacation.

### WHAT

A 1-page doc at `docs/active/ON_CALL.md`.

### HOW

Create the file with:

```markdown
# On-Call Procedures

## Current rotation
- **Primary:** PURETASK (reeperzx7@gmail.com)
- **Secondary:** None (solo)

## Escalation
- Stripe issues: stripe-support@stripe.com (or via dashboard)
- Railway issues: status.railway.app + Discord
- Neon DB: dashboard alerts → console.neon.tech
- SendGrid: support.sendgrid.com
- Twilio: support.twilio.com

## What pages me
- Sentry: any P0 error (configure in Sentry alert rules)
- Health check failure (configure in <monitoring tool>)
- Customer-reported critical bug

## What I check first
1. Sentry dashboard: <URL>
2. Railway service status: <URL>
3. Neon status: <URL>
4. Stripe webhook delivery: <URL>

## When I'm off
- Vacation dates: <update as needed>
- Backup contact: <when you have a backup>
- Auto-responder: configure for emails
```

### DONE WHEN
- [ ] File exists
- [ ] All URLs are filled in with your actual dashboard links
- [ ] You've configured the alert rules referenced in the doc

---

## 4.3 🔴 Test your database backup restoration

**Time:** 2-3 hours
**Risk:** Low (testing in isolation)

### WHY

You have `BACKUP_RESTORE_PROCEDURE.md` in your docs. **A backup you've never tested is a wish, not a backup.** When you actually need to restore (corrupt migration, accidental DELETE, ransomware), you'll find out whether it works under the worst possible conditions.

### WHAT

Practice a real restore. From a real backup. Into a non-production database. Verify the result.

### HOW

**Step 1 — Take a fresh backup of production.** Neon has point-in-time recovery; you may also want a SQL dump:
```powershell
# Get DATABASE_URL from Railway prod env
$env:PROD_DB = "<your-prod-database-url>"
pg_dump $env:PROD_DB -F c -f puretask-prod-backup.dump
```

**Step 2 — Create a fresh empty Neon database** (or local Postgres).

**Step 3 — Restore the backup into it:**
```powershell
$env:TEST_DB = "<your-test-database-url>"
pg_restore -d $env:TEST_DB -c puretask-prod-backup.dump
```

**Step 4 — Verify the restore succeeded:**
```sql
-- Connect to the restored DB
-- Count rows in key tables
SELECT COUNT(*) FROM users;
SELECT COUNT(*) FROM jobs;
SELECT COUNT(*) FROM credit_ledger;
SELECT MAX(created_at) FROM jobs;
```
Compare to production counts. They should match (or be within 1 minute of recent activity).

**Step 5 — Connect your local app to the restored DB.** Set `DATABASE_URL` to the test DB in `.env`. Run:
```powershell
npm run dev
```
Visit `localhost:4000/health`. Visit a few admin pages. Make sure everything looks normal.

**Step 6 — Time how long the restore took.** Write it down. That's your **RTO** (recovery time objective) baseline. Add to `docs/active/01-HIGH/BACKUP_RESTORE_PROCEDURE.md`.

**Step 7 — Document any pain points encountered.** What was unclear? What broke? Update the procedure doc with fixes.

**Step 8 — Delete the test database** when done. Keep the SQL dump for a week, then delete.

### DONE WHEN
- [ ] A backup was successfully restored to a non-prod DB
- [ ] Row counts match production
- [ ] App connects and serves traffic against the restore
- [ ] `BACKUP_RESTORE_PROCEDURE.md` updated with real RTO + any clarifications
- [ ] You can answer "how long would it take to restore from a backup" with a real number

---

## 4.4 🟢 Document Railway deploy step-by-step

**Time:** 30 minutes
**Risk:** None

### WHY

`RUNBOOK.md` references Railway but doesn't have a step-by-step "deploy from scratch" or "deploy a hotfix" guide. When you onboard a new dev or need to deploy under pressure, you need this.

### WHAT

Create `docs/active/DEPLOY_TO_RAILWAY.md` if not already restored from archive in section 3.1.

### HOW

Template:

```markdown
# Deploying to Railway

## Pre-deploy checklist
- [ ] All tests pass: `npm test`
- [ ] Lint passes: `npm run lint`
- [ ] Build succeeds: `npm run build`
- [ ] Migrations reviewed (if any new ones in `DB/migrations/`)
- [ ] No new env vars needed (if any: add them to Railway BEFORE deploying)

## Normal deploy (auto via git push)
1. `git push origin main`
2. Railway detects the push and starts a build
3. Watch the build log: railway.app → project → Deployments → latest
4. Wait for "Deployment successful"
5. Verify: `curl https://<your-prod-url>/health` returns 200

## Hotfix deploy
1. Create branch from `main`: `git checkout -b hotfix-<description>`
2. Make minimal change
3. Test locally
4. PR → review → merge to main (or push direct to main if truly urgent)
5. Same auto-deploy as normal

## Rollback
1. Railway dashboard → Deployments
2. Find the last good deployment
3. Click "Redeploy"
4. Wait for it to become active
5. Verify health endpoint

## Env var changes
1. Railway dashboard → Variables
2. Add/edit variable
3. Railway will trigger a redeploy
4. Verify the new variable is in effect (some need code referencing them)

## What to do if deploy fails
1. Check Railway build log for the error
2. Common: TypeScript build errors → fix in code and push again
3. Common: Migration failure → check Neon dashboard, fix migration
4. Common: env var missing → add it in Railway, redeploy
5. If you can't fix in 30 min: rollback (see above)
```

### DONE WHEN
- [ ] File exists with all sections filled
- [ ] You've tested the rollback procedure once (without actually breaking prod)
- [ ] You can deploy from memory without referencing the doc

---

## 4.5 🟡 Create a database migration policy doc

**Time:** 1 hour
**Risk:** None

### WHY

You have 96 migration files. New devs (or you, 6 months from now) won't know:
- What order migrations run in
- Are they forward-only or reversible?
- How to name a new one
- What's safe vs dangerous to do in a migration
- When to consolidate old migrations

Decisions made implicitly become inconsistent over time.

### WHAT

Create `docs/active/MIGRATION_POLICY.md`.

### HOW

Template (adapt to your actual practice):

```markdown
# Database Migration Policy

## Naming
- Format: `NNN_<short_description>.sql` where NNN is a zero-padded incrementing number
- Use snake_case
- Examples: `042_add_cleaner_certifications.sql`, `043_index_jobs_status.sql`

## Forward-only vs reversible
- We use **forward-only** migrations. Down-migrations are not maintained.
- If you need to undo a migration, write a NEW forward migration that reverses the effect.
- Why: simpler, fewer bugs, matches our deploy model.

## What's safe in a migration
✅ `CREATE TABLE`, `CREATE INDEX CONCURRENTLY`, `ALTER TABLE ADD COLUMN (nullable)`
✅ `INSERT` for seed data
✅ Backfills in batches (small UPDATE chunks)

## What's dangerous
🚨 `ALTER TABLE ADD COLUMN NOT NULL` without a default — blocks writes during migration
🚨 `DROP COLUMN` — breaks old running code; deploy code that ignores the column first, then drop later
🚨 `RENAME COLUMN` — same issue
🚨 Full-table updates on big tables — locks the table

## Required checks before merging a migration
- [ ] Tested locally against a copy of prod data
- [ ] Reviewed by another set of eyes (or AI review)
- [ ] Migration runs in < 30 seconds on prod-size data, OR uses CONCURRENTLY/batching
- [ ] Code that depends on the schema change is in the same PR or already deployed

## How to run migrations
- Locally: `npm run db:migrate`
- Production: Migrations run automatically on Railway deploy (verify in deploy log)

## Consolidating old migrations
- Every ~50 migrations, consider consolidating into a new "baseline" migration
- This is a major operation — coordinate with all environments
- Last consolidation: <date or "never">

## Recovery if a migration breaks prod
- See `docs/active/incidents/database-down.md`
- Most common: revert the migration's effect with a new forward migration
- If catastrophic: see backup restoration procedure
```

### DONE WHEN
- [ ] File exists
- [ ] Policy reflects your actual current practice (not aspirational)
- [ ] `RUNBOOK.md` links to it

---

# SECTION 5 — LOW: Architecture cleanup

Polish. Do these last, or never.

---

## 5.1 🟡 Consolidate the three auth route files

**Time:** 4-8 hours
**Risk:** Medium-High (touches auth)

### WHY

You have `routes/auth.ts`, `routes/authEnhanced.ts`, and `routes/authRefactored.ts`. Three files trying to do the same job — the result of mid-refactor abandonment. Future devs will not know which is the "real" auth.

### WHAT

Pick the canonical one (probably `authRefactored.ts` based on the name), migrate any unique functionality from the other two into it, then delete the other two.

### HOW

**Step 1 — Identify what's in each file:**
```powershell
grep -c "router\." src/routes/auth.ts
grep -c "router\." src/routes/authEnhanced.ts
grep -c "router\." src/routes/authRefactored.ts
```
This gives you a rough endpoint count per file.

**Step 2 — Check what's mounted in `src/index.ts`:**
```powershell
grep "auth" src/index.ts
```
Probably all three are mounted at different paths.

**Step 3 — For each endpoint in `auth.ts` and `authEnhanced.ts`:** check whether `authRefactored.ts` has the same one. If not, port it over with updated patterns.

**Step 4 — Update `src/index.ts`** to only mount the canonical file.

**Step 5 — Update the frontend** to point to the canonical endpoints (this is the dangerous part — if you have a separate frontend repo, coordinate).

**Step 6 — Delete the old files:**
```powershell
git rm src/routes/auth.ts src/routes/authEnhanced.ts
```

**Step 7 — Rename the canonical:**
```powershell
git mv src/routes/authRefactored.ts src/routes/auth.ts
```
Update its mount path in `src/index.ts` accordingly.

**Step 8 — Test exhaustively.** Sign up, sign in, log out, password reset, OAuth, 2FA. All the auth tests:
```powershell
npm test -- auth
```

### DONE WHEN
- [ ] Only one auth route file exists
- [ ] All auth flows work end-to-end (manual test + automated tests)
- [ ] Frontend (if applicable) points to the canonical endpoints
- [ ] No `authEnhanced` or `authRefactored` references remain in the codebase

**⚠️ DO NOT do this on a Friday. Auth issues bite hard. Do it on a Monday with full attention.**

---

## 5.2 🟡 Plan deprecation of dual-mounted routes

**Time:** Plan: 1 hour. Execute: 1-3 months
**Risk:** Medium

### WHY

`src/index.ts` mounts every route at both `/` and `/api/v1`. This is back-compat for old API clients. Carrying it forever doubles your route surface and confuses analytics.

### WHAT

Decide on a deprecation timeline. Communicate it. Execute.

### HOW

**Step 1 — Find out who uses the unversioned (`/`) endpoints.** Check Sentry / your logs for the path patterns. If only old mobile app versions use them, identify the cutoff version.

**Step 2 — Decide a deprecation policy:**
```markdown
# Add to docs/active/API_DEPRECATION.md
- Unversioned paths (`/auth`, `/jobs`, etc.) deprecated as of 2026-05-13
- Will be removed on 2026-08-13 (3 months)
- All clients must migrate to `/api/v1/*`
```

**Step 3 — Add a deprecation header** to unversioned responses. In `src/index.ts` after the unversioned mount:
```typescript
apiRouter.use("/", (req, res, next) => {
  res.setHeader("Deprecation", "true");
  res.setHeader("Sunset", "Wed, 13 Aug 2026 00:00:00 GMT");
  res.setHeader("Link", '</api/v1/'+req.path.slice(1)+'>; rel="successor-version"');
  next();
});
```

**Step 4 — On the sunset date, remove the unversioned mount.** Watch error rates.

### DONE WHEN
- [ ] Decision documented
- [ ] Deprecation headers in place
- [ ] Sunset date passed and unversioned routes removed
- [ ] No error rate increase

---

## 5.3 🔴 Decide on aspirational features: kill or finish

**Time:** Decision: 1 hour. Execute: weeks per feature
**Risk:** Low (it's all upside)

### WHY

You have stubs for: background-check integration, AI assistant end-to-end, subscriptions auto-renewal, trust tier enforcement, property management, export/reporting. Half-built features rot. They confuse the codebase. They imply functionality that doesn't exist.

**Pick one or two to ship. Kill the rest until you're ready.**

### WHAT

For each aspirational feature, decide: SHIP NOW, SHIP LATER, or KILL.

### HOW

**Step 1 — For each feature, answer:**
1. Does any current customer / partner / contract require it?
2. Is it on a near-term roadmap (next 90 days)?
3. Is it generating bugs / confusion as it currently sits?

**Step 2 — Decision matrix:**

| Q1 yes | Q2 yes | Q3 yes | Decision |
|---|---|---|---|
| Yes | Yes | — | SHIP NOW |
| No | Yes | — | SHIP LATER (timebox to 4 weeks) |
| No | No | Yes | KILL (remove or feature-flag-off) |
| No | No | No | KILL (remove or feature-flag-off) |

**Step 3 — For "KILL":**
- Remove the routes that aren't functional
- Remove the service files
- Migrate any data that would be lost
- Leave a comment in the place it used to be: `// Removed YYYY-MM-DD. Restore from git: <commit-sha>`

**Step 4 — For "SHIP LATER":**
- Add `<feature>_ENABLED` env var, default false
- Wrap routes in `if (env.FEATURE_X_ENABLED)` middleware
- Add a "deferred until <date>" note to your `PROJECT_ISSUES_AND_REMEDIATION.md`

**Step 5 — For "SHIP NOW":**
- Make it a real project with timeline, tests, deploy plan
- Don't start another feature until this one ships

### DONE WHEN
- [ ] Every aspirational feature has a decision documented
- [ ] Killed features are removed from active codebase
- [ ] Shipped/shipping features have a real timeline
- [ ] No more "what does this folder do?" mysteries in `src/`

---

## 5.4 🟢 Move large committed SQL files out of repo root

**Time:** 10 minutes
**Risk:** None

### WHY

`prod.sql` (350 KB) and `test.sql` (316 KB) sit at the repo root. They should be in `DB/` for organization, OR they're snapshots and shouldn't be in the repo at all.

### WHAT

Decide and move/delete.

### HOW

**Step 1 — Determine what they are:**
```powershell
Get-Content prod.sql -TotalCount 30
Get-Content test.sql -TotalCount 30
```
Likely they're either schema dumps or full data dumps.

**Step 2 — If they're schema dumps:** Move to `DB/`:
```powershell
git mv prod.sql DB/snapshots/prod-schema-2026-02.sql
git mv test.sql DB/snapshots/test-schema-2026-02.sql
```

**Step 3 — If they contain real production data:** Delete from git history (this is sensitive):
```powershell
git rm prod.sql test.sql
git commit -m "remove production data snapshots from repo"
```
(Optionally scrub from history with BFG — see section 0.1 for procedure.)

**Step 4 — Add to `.gitignore`:**
```
prod.sql
test.sql
```

### DONE WHEN
- [ ] `ls *.sql` at repo root returns nothing
- [ ] If files were moved: they're in `DB/snapshots/`
- [ ] `.gitignore` prevents accidental re-add

---

# SECTION 6 — Things you didn't ask but should care about

The questions that catch most founders off-guard.

---

## 6.1 Run KPI reports regularly

### WHY

You built `kpiService` and a daily snapshot worker. **Have you ever actually read the output?** A KPI you don't look at is worse than no KPI — it gives false confidence.

### WHAT

Once a week, look at your top business numbers.

### HOW

**Step 1 — Build a quick admin dashboard view** (probably already exists at `/api/admin/analytics`). If it doesn't surface these, add them:
- Daily Active Users (clients + cleaners)
- Jobs created this week vs last week
- Jobs completed vs cancelled
- Revenue collected
- Payouts to cleaners
- Chargeback rate (last 30 days)
- New cleaner signups
- Cleaner retention (% active 30 days after signup)
- Customer support tickets opened

**Step 2 — Block 15 minutes every Monday morning.** Look at the numbers. Write down one thing you noticed.

### DONE WHEN
- [ ] You can name your current weekly active users without checking
- [ ] You know if any KPI is trending bad

---

## 6.2 Know your monthly infrastructure cost

### WHY

You're paying for: Railway, Neon, Sentry, SendGrid, Twilio, OneSignal, OpenAI, S3, possibly more. If any single one of these silently 10x's (bot abuse, runaway loop, leaked API key), you find out via credit card statement.

### WHAT

Catalog every paid service. Set spend alerts. Review monthly.

### HOW

**Step 1 — List every service with billing access:**
```markdown
# docs/active/COSTS.md
| Service | Plan | Monthly cost | Alert threshold | Login |
|---|---|---|---|---|
| Railway | Hobby | $X | $X+50% | <email> |
| Neon | Free? | $X | $X+50% | <email> |
| Sentry | Developer | $X | $X+50% | <email> |
| SendGrid | Essentials | $X | $X+50% | <email> |
| Twilio | Pay-as-you-go | $X | $X+50% | <email> |
| OpenAI | Pay-as-you-go | $X | $X+50% | <email> |
| AWS S3 | Pay-as-you-go | $X | $X+50% | <email> |
```

**Step 2 — Set billing alerts in each provider.** Most have a dashboard for this. Set an alert at 150% of normal monthly spend.

**Step 3 — On the 1st of every month, review.** Note anything that grew.

### DONE WHEN
- [ ] File exists with real numbers
- [ ] Billing alerts set in every provider
- [ ] You know your total monthly burn within $20

---

## 6.3 Establish performance baselines

### WHY

"Is the app slow?" is unanswerable without baseline numbers. Once you have baselines, regressions are obvious.

### WHAT

Measure p50/p95/p99 response times for your top 10 endpoints.

### HOW

**Step 1 — Open Sentry → Performance.** It already tracks this if you instrumented routes (you did via `@sentry/node`).

**Step 2 — Identify your top 10 endpoints by traffic.** Sentry sorts by it.

**Step 3 — For each, write down:**
- Median (p50)
- 95th percentile (p95)
- 99th percentile (p99)

**Step 4 — Put in a doc:**
```markdown
# docs/active/PERFORMANCE_BASELINES.md
Updated: 2026-05-13

| Endpoint | p50 | p95 | p99 | Notes |
|---|---|---|---|---|
| GET /api/v1/jobs | 80ms | 240ms | 580ms | OK |
| POST /api/v1/auth/login | 120ms | 320ms | 800ms | bcrypt-bound |
| ... | | | | |
```

**Step 5 — Re-measure monthly.** If any number doubles, investigate.

### DONE WHEN
- [ ] Baselines doc exists with at least 10 endpoints
- [ ] You can answer "is the app slower than usual" with data

---

## 6.4 Get a real security review

### WHY

You handle payments and PII (cleaner addresses, client property photos, ID documents). One vulnerability could end the business. Helmet+JWT+Zod is a great start — but not a substitute for someone trying to break in.

### WHAT

Hire (or trade with) a security researcher to do a focused review.

### HOW

**Option A — Free, slow:** Post a structured bug bounty on a platform like HackerOne or open a `SECURITY.md` in your repo inviting reports. Set rewards small initially.

**Option B — Paid, fast:** Hire a pentester for a 1-week engagement. Cost: $5-15k. Worth it before any major launch.

**Option C — Cheap, OK quality:** Run automated scans. **Snyk** (free tier for small teams), **OWASP ZAP** (open source, scans live URL). These find the easy stuff but miss business logic flaws.

**Minimum action:**
1. Create `SECURITY.md` in repo root with contact info for reporting vulnerabilities
2. Run Snyk against the repo
3. Run OWASP ZAP against staging

### DONE WHEN
- [ ] `SECURITY.md` exists at repo root
- [ ] You've run at least one automated scan and triaged findings
- [ ] You have a plan for a real pentest before public launch

---

## 6.5 Build a GDPR / data-deletion endpoint

### WHY

You have `GDPR_COMPLIANCE.md` in `docs/active/01-HIGH/`. Has it been implemented? You're legally required (EU users, CA users) to delete personal data on request.

### WHAT

A real endpoint or admin tool that, given a user ID, deletes or anonymizes everything you have about them.

### HOW

**Step 1 — Audit what you have.** List every table that contains personal data:
```sql
-- Tables that contain user-identifying info
SELECT * FROM information_schema.columns
WHERE column_name IN ('email', 'phone', 'name', 'address', 'photo_url')
ORDER BY table_name;
```

**Step 2 — Decide for each: delete or anonymize?**
- `users.email` → set to `deleted-<id>@example.invalid`
- `users.phone` → null
- `jobs` → keep for financial records but anonymize references
- `messages` → delete content, keep metadata
- `payment_intents` → keep (legal retention requirement)
- ...

**Step 3 — Implement `deleteUserData(userId)` as a service.** Wrap in a transaction.

**Step 4 — Expose it.** Either as an admin endpoint or via support workflow (user requests → support runs).

**Step 5 — Document the process** in `GDPR_COMPLIANCE.md`. Include retention exceptions (you keep payment records for 7 years per financial regs).

**Step 6 — Test it.** Create a test user, run the deletion, verify nothing personal remains.

### DONE WHEN
- [ ] A function exists to delete/anonymize a user
- [ ] Tested on a real test account
- [ ] Documented in GDPR_COMPLIANCE.md
- [ ] You can respond to a deletion request within 30 days (legal requirement)

---

## 6.6 Verify PCI compliance scope

### WHY

You handle payment data. PCI-DSS applies. Using Stripe Connect should keep you in **SAQ A** (the easiest level) — meaning Stripe handles card data, you never touch it. But you need to verify.

### WHAT

Confirm card data never enters your servers. Document the proof.

### HOW

**Step 1 — Audit your code for any handling of raw card data:**
```powershell
grep -ri "card_number\|cvv\|cvc\|pan\|expir" src/
```
There should be **zero results**. If you find any, that's a critical PCI issue.

**Step 2 — Confirm Stripe checkout is hosted:**
- Are users sent to Stripe's Checkout page? (SAQ A ✅)
- Or do they enter card info on your domain? (More complex SAQ)

**Step 3 — Document the architecture** in a new file `docs/active/PCI_COMPLIANCE.md`:
```markdown
# PCI Compliance
- Scope: SAQ A (we never touch card data)
- Card data flows directly from user's browser to Stripe via Stripe.js / Checkout
- We store: Stripe `customer_id`, `payment_method_id`, `charge_id` — none of these are card data
- Annual SAQ A self-assessment: required, see stripe.com/checklist
```

**Step 4 — Set a reminder to do your annual self-attestation** with Stripe.

### DONE WHEN
- [ ] No card data anywhere in your code or DB
- [ ] PCI scope documented
- [ ] Annual reminder set

---

## 6.7 Set up customer support intake

### WHY

When something breaks for a user, you need a way for them to tell you. Without that, you find out via Twitter or never.

### WHAT

A clear path: user has a problem → it lands somewhere you check.

### HOW

**Minimum viable:**
- A "Help" link in the app footer → emails support@puretask.com
- That email auto-forwards to your personal inbox + creates a Slack notification
- You check the inbox at least daily

**Better:**
- Use Intercom / Crisp / HelpScout (free tiers exist)
- Categorize: bug / feature request / billing / urgent
- SLA: respond within 24h

**Best:**
- In-app help button → opens a chat or ticket form
- Tickets auto-tagged with user ID, current page, browser info
- Admin dashboard tab for triaging
- Auto-escalation if untouched for X hours

### DONE WHEN
- [ ] There's a documented support path users can find
- [ ] You actually receive and respond to tickets
- [ ] Volume is tracked weekly (links to KPIs in 6.1)

---

## 6.8 Have a written legal posture

### WHY

A cleaning marketplace = real employment law risk. You have `docs/active/legal/AB5_ANALYSIS.md` and `IC_SAFEGUARDS_APPENDIX.md` — good signs. But have you actually had a lawyer review?

### WHAT

Verify your legal docs are reviewed by a real attorney (not just AI-generated).

### HOW

**Step 1 — Audit what you have:**
- Terms of Service
- Privacy Policy
- Cleaner contractor agreement
- Client booking terms
- Refund / cancellation policy
- Dispute resolution / arbitration clause

**Step 2 — Verify each was reviewed by a licensed attorney.** If not, get a review. Cost: $500-3000 for a startup-friendly attorney to review existing docs.

**Step 3 — Check IC vs employee classification.** If your state has strict laws (CA, NY, MA), you may be at risk of misclassification suits.

**Step 4 — Document everything in `docs/active/legal/REVIEW_LOG.md`:**
```markdown
| Doc | Last reviewed | By | Status |
|---|---|---|---|
| TOS | 2026-04-15 | Smith & Co | ✅ Approved |
| Privacy | 2026-04-15 | Smith & Co | ✅ Approved |
| Cleaner agreement | ??? | AI-only | ⚠️ Needs human review |
```

### DONE WHEN
- [ ] Every legal doc has been reviewed by a licensed attorney
- [ ] The review log exists
- [ ] You have legal insurance (E&O for marketplaces)

---

## 6.9 Insurance coverage

### WHY

Customer property damaged by a cleaner. Cleaner injured on a job. Data breach. Any of these can bankrupt an uninsured business.

### WHAT

At minimum: General liability + E&O (errors & omissions) + cyber liability.

### HOW

**Talk to a broker who specializes in marketplaces or gig platforms.** Quotes will vary by:
- Revenue
- Number of cleaners
- Geographic concentration
- Whether cleaners carry their own insurance (often required)

**Typical coverage for a small marketplace:**
- General liability: $1M / $2M aggregate
- E&O / professional liability: $1M
- Cyber liability: $1-5M
- Costs: $200-1000/month depending on scale

### DONE WHEN
- [ ] You have at least general liability and E&O policies
- [ ] Insurance docs filed in `docs/active/business/` (or a secure non-repo location)
- [ ] Policy renewal dates calendared

---

## 6.10 Have a "what if I get hit by a bus" plan

### WHY

You are a single point of failure. If something happens to you, who:
- Gets the Railway / Neon / Stripe passwords?
- Knows how to deploy?
- Refunds angry customers?
- Tells the cleaners what to do?

### WHAT

A succession document. Stored securely. Shared with one trusted person.

### HOW

Create a document (NOT in this repo — somewhere personal and secure):
- All admin account credentials (or where to find them — 1Password vault, etc.)
- Domain registrar
- Trusted-person contact info (lawyer, accountant)
- "If I'm incapacitated for >7 days, do X" instructions
- Backup admin user in your own system (so someone else can refund/manage without your account)

Store in: 1Password Family Vault, sealed envelope with a lawyer, etc.

### DONE WHEN
- [ ] The doc exists
- [ ] One trusted person knows it exists and how to access
- [ ] You'd be comfortable if you couldn't log in for a week

---

# SECTION 7 — The master verification checklist

When you've finished this playbook, you should be able to check every box below:

## Security
- [ ] JWT secret rotated; old value no longer valid
- [ ] No secrets found in git history scan
- [ ] gitleaks runs on every PR
- [ ] No card data in your code or DB
- [ ] PCI compliance scope documented
- [ ] GDPR deletion endpoint works

## Code quality
- [ ] No `query` imports in `src/routes/*.ts` (except whitelist)
- [ ] No `any` types in top 4 worst files
- [ ] `no-explicit-any: error` in ESLint
- [ ] Zero raw `throw new Error()` in `src/services/` or `src/lib/`
- [ ] All async route handlers wrapped in asyncHandler
- [ ] Coverage threshold set and passing
- [ ] `strictFunctionTypes: true` in tsconfig
- [ ] `npm audit --audit-level=high` exits 0
- [ ] `npm run lint` passes with `--max-warnings 0`

## Docs hygiene
- [ ] No empty files in repo
- [ ] No `.ts` files in `docs/`
- [ ] Stale root docs archived
- [ ] No 3.5MB unreviewed zip
- [ ] No vestigial Jest configs
- [ ] All phase docs marked as live or archived
- [ ] 8 verified-missing reference docs restored

## Operations
- [ ] Incident playbooks exist for top 8 scenarios
- [ ] On-call doc exists (even if it's just you)
- [ ] Backup restoration tested with real data
- [ ] Deploy procedure documented
- [ ] Migration policy documented
- [ ] Cost tracking doc exists
- [ ] Performance baselines documented
- [ ] Customer support intake exists

## Business / legal
- [ ] All legal docs reviewed by an attorney
- [ ] Insurance coverage in place
- [ ] Succession plan exists
- [ ] KPI review on calendar weekly
- [ ] Decision made on every aspirational feature

---

# Appendix A — Glossary

For when terminology gets in the way.

**ASYNC / AWAIT** — Marker that says "this code waits for something (a database, an API call) before continuing." Without `await`, the code keeps running and the result you wanted isn't ready yet.

**CI** — Continuous Integration. The robot that runs your tests on every PR.

**CI/CD** — CI + Continuous Deployment. Tests + auto-deploy if tests pass.

**ENV VAR** — Environment variable. A piece of configuration outside the code, like a database password.

**ESLINT** — A tool that reads your code and complains about bad patterns based on rules you set.

**HOTFIX** — An urgent production fix that bypasses normal release process.

**JWT** — JSON Web Token. A signed string that proves "this user is logged in." Like a wristband at a concert.

**LINT / LINTING** — Automated code style checking. Catches problems before runtime.

**MIGRATION** — A SQL file that changes the database schema (adds a table, adds a column, etc.).

**ORM** — Object-Relational Mapper. A library that lets you talk to the database using code objects instead of writing SQL. You don't use one (you write raw SQL).

**p50/p95/p99** — Performance percentiles. p50 = median. p95 = 95% of requests are faster than this. p99 = the slow 1%.

**PR** — Pull Request. A proposed change to the code, reviewed before merging.

**ROLLBACK** — Reverting a deploy to a previous version.

**ROUTE** — A URL pattern your server responds to. E.g., `GET /api/v1/jobs` is a route.

**RTO / RPO** — Recovery Time Objective / Recovery Point Objective. How fast you recover from a disaster, and how much data you can afford to lose.

**SAQ A** — The simplest level of PCI compliance, for merchants who never see card data.

**SDK** — Software Development Kit. A library that wraps an API (like Stripe's SDK wraps Stripe's HTTP API).

**SEED DATA** — Initial data inserted into the database to bootstrap a test environment.

**WEBHOOK** — A reverse API call: an external service (like Stripe) calls YOUR server when something happens on their side.

---

# Appendix B — Order of operations

If you do nothing else, do these five things, in this order:

1. **Rotate the JWT secret.** (Section 0.1.) Today.
2. **Fix the orphan webhook code.** (Section 0.3.) This week.
3. **Make lint block CI.** (Section 1.2.) This week.
4. **Set a coverage threshold floor.** (Section 1.3.) This week.
5. **Restore the 8 missing docs.** (Section 3.1.) This week.

Everything else can wait, but those five compound into safety and momentum for the rest.

---

**End of playbook.**

When you finish a section, append a note here with the date and what you did. This file is the living record.

## Completion log

| Date | Section | What I did |
|---|---|---|
| | | |
