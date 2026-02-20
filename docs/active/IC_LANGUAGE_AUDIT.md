# IC-Language Audit (Section 12)

**Purpose:** Single reference for independent-contractor-safe language across app copy, admin UI, support macros, and API messages. Use when writing or reviewing any user-facing or support text.

---

## Phrases to avoid

- **Required procedures** / **must follow** / **failure to comply** — implies employment-style direction.
- **Performance correction** / **corrective action** / **performance improvement plan (PIP)** — employment discipline framing.
- **Mandatory re-cleans** / **required re-clean** — directs how work is done.
- **Warnings** (in disciplinary sense) — use **risk indicators** or **participation conditions**.
- **Override completion** (in admin UI) — use **platform status adjustment** or **outcome confirmation override**.
- **Productivity targets** / **quotas** — use **eligibility** or **access** (e.g. visibility, payout timing).
- **Supervision** / **monitoring** (of how work is done) — use **outcome verification** or **evidence for dispute resolution**.

---

## Preferred phrasing

| Instead of | Use |
|------------|-----|
| Required procedures | Eligibility requirements / participation conditions |
| Performance correction | Platform status adjustment / participation conditions |
| Mandatory re-cleans | Re-clean option (client-paid or platform-facilitated) |
| Warnings | Risk indicators / participation conditions |
| Override completion | Platform status adjustment |
| Failure to comply | Does not meet eligibility / participation conditions |
| Corrective action | Access adjustment / platform participation conditions |

---

## Where the codebase was audited

- **Admin routes and API messages:** Section 11; `src/routes/admin.ts` and admin service error messages; RUNBOOK § 3.7.
- **Gamification copy:** RUNBOOK § 4 support macros; in-app explainers (progress paused, meaningful login, photos, on-time); no productivity mandates, no PIPs.
- **Support macros:** RUNBOOK § 4.2 — “Progress paused,” “Why didn’t my message count,” etc.; language is eligibility/access-focused.
- **Dispute/refund flows:** Admin actions use “resolution,” “refund,” “credit,” “payout hold”; no “disciplinary” or “corrective” framing.

---

## Remaining app copy to audit

- **Client app:** Booking flow, dispute submission, review/rating screens — ensure “what was purchased” (outcomes) not “how work was done.”
- **Cleaner app:** Onboarding, job acceptance, completion, dispute response — ensure no “required procedures” or “must follow”; use “eligibility,” “platform protections,” “evidence for dispute resolution.”
- **Email/SMS templates:** Transactional and notification copy — avoid “warning,” “corrective,” “mandatory”; use “participation conditions,” “platform status,” “next steps.”
- **Legal and policy pages:** TOS, Privacy Policy, Cleaner Agreement — already aligned per Section 13 and IC Safeguards appendix; keep consistent in any new clauses.

---

## Maintenance

- When adding new admin actions or support macros, check this list and SECTION_12 language rules.
- Before each major release, quick pass on in-app strings and email/SMS templates against “Phrases to avoid.”

**See also:** [SECTION_12_TRUST_IC_SAFE.md](./sections/SECTION_12_TRUST_IC_SAFE.md) § 12.12, [SECTION_11_ADMIN_OPS.md](./sections/SECTION_11_ADMIN_OPS.md) § 11.1, [RUNBOOK.md](./RUNBOOK.md) § 3.7.
