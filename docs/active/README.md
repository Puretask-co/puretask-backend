# PureTask Documentation

**What it is:** The main entry point for PureTask backend documentation.  
**What it does:** Points you to setup, architecture, ops, deployment, and troubleshooting.  
**How we use it:** Start here when onboarding or looking for the right doc.

---

## Start here

| Doc | Purpose |
|-----|---------|
| [SETUP.md](./SETUP.md) | Run locally: clone, env, migrate, run |
| [ARCHITECTURE.md](./ARCHITECTURE.md) | How the system fits together (layers, flow, DB, integrations) |

## Operations

| Doc | Purpose |
|-----|---------|
| [RUNBOOK.md](./RUNBOOK.md) | Ops commands, health checks, incident playbooks |
| [TROUBLESHOOTING.md](./TROUBLESHOOTING.md) | Known issues and fixes |
| [DEPLOYMENT.md](./DEPLOYMENT.md) | Railway / production deploy and rollback |
| [DECISIONS.md](./DECISIONS.md) | Architectural and product decisions (from logs) |

## Runbooks (detailed)

- [Rollback a deploy](../runbooks/rollback-deploy.md)
- [Handle a production incident](../runbooks/handle-incident.md)

## Archived history

Raw historical notes live in `docs/archive/raw/` and are not edited.  
MD inventory reports: run `powershell -ExecutionPolicy Bypass -File scripts\classify-md.ps1` → `docs/_md_inventory/md_report.md`.
