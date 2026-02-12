# Database Backup Setup Guide

See `DATABASE_RECOVERY.md` for recovery procedures.

## Neon Backup Configuration

1. Enable automated backups in Neon Console
2. Set retention period (7-30 days)
3. Enable point-in-time recovery (Pro tier)
4. Run verification: `npm run backup:verify`

For detailed instructions, see Neon documentation: https://neon.tech/docs
