# PureTask Cleaner Agreement — Draft for Counsel Review

**Status:** Draft. Separate from main TOS; cleaners sign/accept at onboarding.  
**See also:** [TOS_CONSOLIDATED.md](./TOS_CONSOLIDATED.md), [IC_SAFEGUARDS_APPENDIX.md](./IC_SAFEGUARDS_APPENDIX.md), [SECTION_13_LEGAL.md](../sections/SECTION_13_LEGAL.md).  
**Last updated:** 2026-02-02

---

## Purpose

This agreement governs the relationship between PureTask and cleaners who use the platform to offer cleaning services. Cleaners are independent contractors, not employees.

---

## Sections (for counsel to draft)

1. **Independent Contractor Status** — No employment; cleaners responsible for taxes, insurance, tools; full discretion over methods and availability.
2. **Platform Rules** — Accept/decline jobs at discretion; evidence requirements for protections; maintenance participation conditions.
3. **Payout Terms** — Platform fee; payout schedule; Stripe Connect; holds during disputes.
4. **Dispute Resolution** — Evidence-based review; resolution options; appeal process.
5. **Evidence Requirements** — When evidence is required for payout protection or dispute priority; voluntary provision with protection consequences.
6. **Termination of Access** — Platform may suspend or terminate access per policy; no employment termination language.
7. **Acceptance** — Record acceptance in DB (e.g. `cleaner_agreement_accepted_at`); present at signup or first login.

---

## Implementation Notes

- **Storage:** Record acceptance in `user_consents` or `cleaner_agreement_accepted_at` column.
- **Presentation:** Show at cleaner onboarding; require acceptance before first job acceptance.
- **Versioning:** Store agreement version with acceptance for future amendments.
