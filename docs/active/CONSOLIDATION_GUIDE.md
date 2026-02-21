# Document Consolidation Guide

**Purpose:** Plan and log which docs are combined, and how.
**Approach:** We **synthesize** into one document per topic: gather all ideas and important information, deduplicate, and present in one coherent flow. We do **not** just concatenate (paste one file after another).

## Approach: Synthesize, Don't Concatenate

| Do | Don't |
|----|--------|
| One purpose per combined doc; clear sections (Strategy, Procedures, Reference). | Paste File A + File B + File C one after another. |
| Single glossary / Key terms section; remove duplicate tables. | Keep three separate plain English tables. |
| Merge overlapping procedures into one step list; keep the most complete version. | Leave two Restore procedure sections that say similar things. |
| Preserve every important idea, checklist, command, and link from all source files. | Drop content that's redundant without checking it adds nuance. |
| Add a short Sources consolidated note at the end listing original files (and where they were archived). | Omit where the content came from. |

Result: **one document per topic that contains all important information from the source files**, in a single readable flow.

## Which Docs Are Being Combined

| # | Topic | Source files | Result doc | Status |
|---|--------|--------------|------------|--------|
| 1 | Backup and restore | BACKUP_RESTORE.md, 01-HIGH/BACKUP_SETUP.md, 01-HIGH/BACKUP_RESTORE_PROCEDURE.md | docs/active/BACKUP_RESTORE.md | Done |
| 2 | CI/CD | CI_CD_SETUP.md, 01-HIGH/CI_CD_SETUP.md | docs/active/CI_CD_SETUP.md | Done |
| 3 | Notifications | 02-MEDIUM/NOTIFICATION_*.md (4 files) | docs/active/NOTIFICATIONS.md | Done |
| 4 | API reference | 02-MEDIUM/API_DOCUMENTATION, API_SPEC_COMPARISON, API_EXACT_ENDPOINTS | docs/active/API_REFERENCE.md | Done |
| 5 | Founder reference | FOUNDER_BACKEND_REFERENCE.md + founder/*.md | FOUNDER_BACKEND_REFERENCE.md as index linking to founder/*.md | Done |

After each consolidation: (1) Archive source files to docs/archive/raw/consolidated-sources/. (2) Add Sources consolidated at end of result doc.
