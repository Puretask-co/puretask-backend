# Extraction Analysis & Improvements

**Purpose:** Review what we extract from the prior long output (expert review, 14-section hardening plan, legal/IC deliverables) and ensure all important data is captured. Suggest improvements.

**Reference:** Conversation summary mentioned: multi-expert ZIP review, 9 frameworks, 14 sections with objectives/exit conditions/runbooks/checklists, legal TOS/IC/AB5/lawyer notes/in-app copy, consolidation into MASTER_CHECKLIST + section runbooks.

---

## 1. What We're Already Extracting Well

| Data from prior output | Where it lives | Status |
|------------------------|----------------|--------|
| **Critical findings (3 + additional risks)** | MASTER_CHECKLIST.md § Critical Findings | ✅ Captured |
| **Expert evaluation frameworks (9 lenses)** | MASTER_CHECKLIST.md § Expert Evaluation Frameworks | ✅ Table with lens + question |
| **Status overview (done vs remaining)** | MASTER_CHECKLIST.md § Status Overview | ✅ Design complete 1–12; Legal deliverables; Remaining 13–14 + implementation |
| **Master outline (14 sections, order)** | MASTER_CHECKLIST.md § Master Outline | ✅ Locked order |
| **Per-section checklists** | MASTER_CHECKLIST.md § SECTION 1 … § SECTION 14 | ✅ Actionable `- [ ]` items |
| **Legal & IC deliverables (list)** | MASTER_CHECKLIST.md § Legal & IC Deliverables | ✅ Bullet list of what was produced |
| **Section runbooks (objectives, exit conditions, tables, procedures)** | docs/active/sections/SECTION_01_SECRETS.md … SECTION_14_LAUNCH.md | ✅ Full runbooks with tables (e.g. secret inventory, route classification, webhook_events, payment state machine) |
| **Runbook links** | MASTER_CHECKLIST.md § Section Runbooks table + inline per section | ✅ One link per section |
| **Route Protection Table** | docs/active/ROUTE_PROTECTION_TABLE.md | ✅ Exists with full route inventory |
| **Implementation phase (high-level)** | MASTER_CHECKLIST.md § Implementation Phase | ✅ Code migrations, CI, admin UI, workers, tests |
| **How to use (order, no skip, PR = task)** | MASTER_CHECKLIST.md § How to Use This Checklist | ✅ Clear rules |

---

## 2. Gaps — Important Data Not Fully Extracted or Linked

### 2.1 Legal artifact files missing

- **Issue:** MASTER_CHECKLIST says "Full TOS sections… Written & merged," "Lawyer review notes… Written," "In-app copy… Written," but there are **no dedicated files** in the repo for:
  - Full TOS text (merged clauses)
  - Independent Contractor Safeguards appendix (full text)
  - California AB5 / ABC Test analysis (prong-by-prong)
  - Lawyer review notes (rationale per clause)
  - In-app copy (cleaner + client bullets)
- **Risk:** If that content existed only in the "long message," it is **not** in the repo. If it was written elsewhere, it's not discoverable from MASTER_CHECKLIST.
- **Action:**  
  1. Add a **Legal & IC artifact index** in MASTER_CHECKLIST (or a short `docs/active/legal/README.md`) listing expected deliverables and **file paths** (e.g. `docs/active/legal/TOS_CONSOLIDATED.md`, `docs/active/legal/IC_SAFEGUARDS_APPENDIX.md`). Use placeholders "To be created" if files don't exist yet.  
  2. If the long message contained **actual TOS/AB5/lawyer/in-app text**, extract it into those files and link from MASTER_CHECKLIST.

### 2.2 Route Protection Table not linked from master or Section 2

- **Issue:** ROUTE_PROTECTION_TABLE.md is the canonical route → auth table. MASTER_CHECKLIST Section 2 says "Build Route Protection Table" but doesn't point to it. SECTION_02_AUTH.md describes the table format but doesn't say "see ROUTE_PROTECTION_TABLE.md."
- **Action:** In MASTER_CHECKLIST Section 2, add: **Artifact:** [ROUTE_PROTECTION_TABLE.md](./ROUTE_PROTECTION_TABLE.md). In SECTION_02_AUTH.md, add a line: **Canonical table:** [ROUTE_PROTECTION_TABLE.md](../ROUTE_PROTECTION_TABLE.md).

### 2.3 Expert lens → section mapping absent

- **Issue:** The program was designed using 9 lenses; different sections address different lenses. We have lenses and sections but no explicit **"which lens drives which section"** mapping. That mapping helps prioritize (e.g. Security lens → Sections 1, 2, 4, 8) and explains why sections exist.
- **Action:** Add a small table (in MASTER_CHECKLIST or in a "Program design" subsection): Lens # → Primary sections (e.g. 1→1,2,8; 2→1,3,6; 3→1,2,4,8; 4→5; 5→11,12; 6→6; 7→9; 8→10; 9→13,14). Can be refined from your actual design.

### 2.4 Section dependencies / critical path not explicit

- **Issue:** "Do not skip; do not parallelize money + auth" is there, but we don't have a concise **dependency graph** (e.g. Section 2 depends on 1; Section 4 before 6; Section 11 depends on 4, 12). That helps with ordering and parallelization of non-conflicting work.
- **Action:** Add a short "Section dependencies" or "Critical path" subsection: e.g. 1 → 2; 1,2 → 3; 2,3 → 4; 4 → 5,6; 5,6 → 7,8; etc. Optional: mark "money + auth" sections (1, 2, 4) as "do not parallelize."

### 2.5 Incident response and existing 00-CRITICAL docs not cross-referenced

- **Issue:** Section 1 runbook covers incident response; repo has `00-CRITICAL/SECURITY_INCIDENT_RESPONSE.md`, `SECURITY_GUARDRAILS.md`, etc. MASTER_CHECKLIST and SECTION_01 don't link to them. Risk of duplication or drift.
- **Action:** In SECTION_01_SECRETS.md (e.g. § Incident response), add: **See also:** [SECURITY_INCIDENT_RESPONSE.md](../00-CRITICAL/SECURITY_INCIDENT_RESPONSE.md). In MASTER_CHECKLIST Section 1, optionally add a one-line "Cross-reference: 00-CRITICAL incident response."

### 2.6 Checklist item-level progress not tracked

- **Issue:** We have section-level status (design complete vs not) but no convention for **which checklist items are done** (e.g. "- [x] Rotate Stripe" vs "- [ ] Rotate DB"). For implementation mode, item-level progress is useful.
- **Action:** Use `- [x]` for done and `- [ ]` for todo; or add a separate "Progress log" (date + section + item completed). Keep MASTER_CHECKLIST as the single source of truth for checklist state.

### 2.7 "Next Steps" could reference section runbooks

- **Issue:** "Next Steps (Choose One)" lists: Proceed with Section 13, Section 14, Switch to implementation, Use as-is. It could explicitly say "See SECTION_13_LEGAL.md / SECTION_14_LAUNCH.md for full outline" so the next step is one click away.
- **Action:** In Next Steps, add runbook links for "Proceed with Section 13" and "Proceed with Section 14."

---

## 3. Suggested Improvements (Prioritized)

### High impact

1. **Legal artifact index and files**  
   - Add `docs/active/legal/` (or a table in MASTER_CHECKLIST) with: TOS_CONSOLIDATED, IC_SAFEGUARDS_APPENDIX, AB5_ANALYSIS, LAWYER_REVIEW_NOTES, IN_APP_COPY_CLEANER, IN_APP_COPY_CLIENT.  
   - If the long message contained full text, create those files and paste; otherwise create stubs with "To be created — see MASTER_CHECKLIST Legal deliverables."

2. **Cross-link Route Protection Table**  
   - MASTER_CHECKLIST Section 2: add **Artifact:** [ROUTE_PROTECTION_TABLE.md](./ROUTE_PROTECTION_TABLE.md).  
   - SECTION_02_AUTH.md: add **Canonical table:** [ROUTE_PROTECTION_TABLE.md](../ROUTE_PROTECTION_TABLE.md).

3. **Expert lens → section map**  
   - Add a small table: which lenses map to which sections. Improves traceability and prioritization.

### Medium impact

4. **Section dependencies / critical path**  
   - One short subsection (table or list): Section N depends on Sections X, Y; note "money + auth" ordering.

5. **Cross-links from Section 1 to 00-CRITICAL**  
   - SECTION_01: link to SECURITY_INCIDENT_RESPONSE.md and optionally SECURITY_GUARDRAILS.md.  
   - MASTER_CHECKLIST Section 1: optional one-line reference to 00-CRITICAL.

6. **Next Steps runbook links**  
   - "Proceed with Section 13" → link to SECTION_13_LEGAL.md; "Proceed with Section 14" → SECTION_14_LAUNCH.md.

### Nice to have

7. **Checklist progress convention**  
   - Document in "How to Use": use `- [x]` when an item is done; or add a "Progress log" section with date + section + item.

8. **Single "Program design" subsection**  
   - In MASTER_CHECKLIST, add a short "Program design" block: expert lenses (existing table) + lens→section map + dependency hints + link to this extraction analysis. Keeps design rationale in one place.

---

## 4. Summary

- **Already captured well:** Critical findings, 9 lenses, status overview, master outline, per-section checklists, legal deliverable list, full section runbooks with tables and procedures, runbook links, Route Protection Table (as file), implementation phase, usage rules.
- **Main gaps:** Legal artifact **files** (TOS, IC appendix, AB5, lawyer notes, in-app copy) missing or unlinked; Route Protection Table not linked from MASTER_CHECKLIST/Section 2; no lens→section map; no explicit section dependencies; no cross-links from Section 1 to 00-CRITICAL; Next Steps could link runbooks.
- **Top improvements:** (1) Create legal artifact index and, if available, extract legal text into files; (2) Link ROUTE_PROTECTION_TABLE from Section 2 and runbook; (3) Add lens→section map; (4) Add dependency/critical path; (5) Cross-link Section 1 ↔ 00-CRITICAL; (6) Add runbook links in Next Steps.

If you want, next step can be: implement the high-impact changes in MASTER_CHECKLIST and section runbooks (links + legal index + lens map + dependencies), and add stub files under `docs/active/legal/` for TOS/IC/AB5/lawyer/in-app.
