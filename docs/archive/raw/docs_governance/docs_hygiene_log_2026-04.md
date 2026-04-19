# Docs hygiene log — 2026-04

## Pass metadata

- **Date:** 2026-04-19
- **Scope:** Full `.md` and `.txt` tracked docs inventory + `docs/active` link integrity
- **Operator:** `@owner-platform`

## Commands executed

- `git ls-files "*.md" > /workspace/md_inventory.txt`
- `git ls-files "*.txt" > /workspace/txt_inventory.txt`
- `wc -l /workspace/md_inventory.txt /workspace/txt_inventory.txt`
- `node -e '...generate docs/archive/raw/docs_governance/docs_file_ledger_2026-04-19.csv...'`
- `while IFS=$'\t' read -r src dest; do mkdir -p "$(dirname "/workspace/$dest")" && git mv "$src" "$dest"; done < /workspace/docs/archive/raw/docs_governance/docs_file_moves_2026-04-19.tsv`
- `node -e '...docs/active internal link checker...'`

## Results

- Ledger totals:
  - `TOTAL 1060`
  - `Archive 832`
  - `Keep Canonical 7`
  - `Keep Reference 153`
  - `Merge 68`
- Link integrity:
  - `TOTAL_FILES 115`
  - `MISSING 0`

## Artifacts

- `docs/archive/raw/docs_governance/docs_file_ledger_2026-04-19.csv`
- `docs/archive/raw/docs_governance/docs_file_ledger_summary_2026-04-19.txt`
- `docs/archive/raw/docs_governance/docs_file_moves_2026-04-19.tsv`
- `docs/archive/raw/docs_governance/docs_active_link_check_2026-04-19.txt`

## Canonical update check

- Reviewed `docs/active/ARCHITECTURE.md` and confirmed high-value extracted spec constraints are included (`3.6 High-value spec extracts`).
- Reviewed `docs/active/RUNBOOK.md` and confirmed D1.1/D1.2 evidence is recorded; D2.1 now complete.
