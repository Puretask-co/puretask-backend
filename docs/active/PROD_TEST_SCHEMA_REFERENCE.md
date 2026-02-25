# Production vs test schema reference (exact differences)

**Purpose:** Exact list of what each database has and the differences in every category.  
**Source:** Generated from `prod.sql` and `test.sql` (run `npm run db:dump:schema:full` to refresh).  
**Environments:** Production = ep-fragrant-bird (Neon), Test = ep-small-unit (Neon).

**Do the DBs have the same capabilities?** No. Prod has objects test doesn’t (extensions, enums, tables); test has objects prod doesn’t. Until you unify (e.g. run 059–061 on prod and use one migration path on both), they are not equivalent. After unification, both can have the same schema and the same capabilities.

---

## 1. Extensions

| Extension       | Production | Test |
|----------------|------------|------|
| pg_session_jwt | ✅         | ❌   |
| citext         | ✅         | ✅   |
| pgcrypto       | ✅         | ✅   |
| uuid-ossp      | ✅         | ✅   |

**Production only:** `pg_session_jwt`  
**Test only:** (none)

---

## 2. Schemas

| Schema        | Production | Test |
|---------------|------------|------|
| neon_auth     | ✅         | ✅   |
| notifications | ✅         | ✅   |
| pgrst         | ✅         | ❌   |
| puretask      | ✅         | ✅   |

**Production only:** `pgrst`  
**Test only:** (none)

---

## 3. Public enums (CREATE TYPE public.* AS ENUM)

### Production has (full list)

actor_type, audit_actor_type_enum, availability_recurrence_enum, cleaner_earning_status, cleaner_event_type, cleaner_status_enum, cleaning_type, client_risk_band, client_risk_event_type, client_status_enum, credit_change_reason_enum, credit_reason, credit_transaction_type_enum, credit_tx_type, dispute_status, dispute_status_enum, earning_status, job_event_type, job_event_type_enum, job_status, job_status_enum, notification_channel_enum, notification_status_enum, participant_type_enum, payout_status, payout_status_enum, photo_type, reliability_event_type_enum, reschedule_bucket, reschedule_status, user_role, user_status

### Test has (full list)

cleaner_event_type, client_risk_band, client_risk_event_type, credit_reason, dispute_status, **invoice_status**, job_status, payout_status, reschedule_bucket, reschedule_status, user_role

### Differences

| Category      | Production only (test is missing) |
|---------------|------------------------------------|
| **Public enums** | actor_type, audit_actor_type_enum, availability_recurrence_enum, cleaner_earning_status, cleaner_status_enum, cleaning_type, client_status_enum, credit_change_reason_enum, credit_transaction_type_enum, credit_tx_type, dispute_status_enum, earning_status, job_event_type, job_event_type_enum, job_status_enum, notification_channel_enum, notification_status_enum, participant_type_enum, payout_status_enum, photo_type, reliability_event_type_enum, user_status |

| Category      | Test only (production is missing) |
|---------------|------------------------------------|
| **Public enums** | invoice_status |

---

## 4. Puretask schema enums

**Both have:** cleaner_tier, cleaning_type, credit_tx_type, dispute_status, earnings_status, job_event_type, job_status, payout_status, user_role, user_status  

**Differences:** None in puretask enums.

---

## 5. Public tables (public.*)

### Production only (test is missing these)

admin_users, audit_log, backup_runs, cleaner_reliability_events, cleaner_reliability_scores, cleaners, clients, customers, integration_events, job_gps_logs, job_time_logs, kpi_daily, message_threads, payment_failures, system_settings

### Test only (production is missing these)

ai_activity_log, ai_performance_metrics, ai_suggestions, cleaner_agreements, cleaner_client_notes, id_verifications, invalidated_tokens, invoice_line_items, invoice_status_history, invoices, message_delivery_log, payout_items, payout_reconciliation_flag_history, phone_verifications, reviews, stripe_events_processed, stripe_object_processed, worker_runs

### In both (shared public tables)

achievements, addresses, admin_audit_log, admin_config_versions, admin_feature_flags, admin_reward_budget, admin_settings, admin_settings_history, availability_blocks, background_checks, backups, badge_definitions, blackout_periods, calendar_connections, calendar_events, cancellation_events, cancellation_records, certifications, cities, cleaner_achievement_feed, cleaner_achievements, cleaner_active_boosts, cleaner_ai_preferences, cleaner_ai_settings, cleaner_ai_templates, cleaner_availability, cleaner_badges, cleaner_certifications, cleaner_earnings, cleaner_events, cleaner_flex_profiles, cleaner_goal_completions, cleaner_goal_progress, cleaner_goals, cleaner_holiday_overrides, cleaner_holiday_settings, cleaner_level_definitions, cleaner_level_goals, cleaner_level_progress, cleaner_login_days, cleaner_meaningful_actions, cleaner_message_history, cleaner_metrics, cleaner_no_shows, cleaner_onboarding_progress, cleaner_preferences, cleaner_profiles, cleaner_quick_responses, cleaner_rewards_granted, cleaner_saved_library_templates, cleaner_saved_messages, cleaner_service_areas, cleaner_teams, cleaner_tier_history, cleaner_time_off, cleaner_weekly_streaks, cleaning_subscriptions, client_flex_profiles, client_profiles, client_risk_events, client_risk_scores, credit_accounts, credit_bonuses, credit_ledger, credit_purchases, credit_transactions, device_tokens, dispute_actions, disputes, durable_jobs, email_change_requests, favorite_cleaners, feature_flags, flexibility_decline_events, fraud_alerts, gamification_reward_grants, gamification_cash_reward_ledger, gamification_choice_eligibilities, grace_cancellations, holidays, idempotency_keys, inconvenience_logs, job_checkins, job_events, job_offers, job_photos, job_queue, job_status_history, jobs, login_attempts, match_recommendations, message_templates, messages, n8n_event_log, notification_failures, notification_log, notification_logs, notification_preferences, notification_templates, oauth_accounts, onboarding_tooltips, payment_intents, payout_adjustments, payout_requests, payout_retry_queue, payout_runs, payouts, photo_compliance, platform_service_areas, properties, pt_engagement_actions, pt_engagement_sessions, pt_event_log, referral_codes, referrals, region_governor_audit, region_governor_config, region_governor_state, region_marketplace_metrics, reliability_history, reliability_snapshots, reschedule_events, reschedule_reason_codes, rush_job_settings, safety_reports, schema_migrations, season_application_log, season_rules, security_events, stripe_connect_accounts, stripe_customers, stripe_events, support_messages, support_tickets, team_members, template_library, template_ratings, tier_locks, trusted_devices, two_factor_codes, user_preferences, user_sessions, users, webhook_events, webhook_failures

---

## 6. Other schemas: neon_auth, notifications, puretask tables

- **neon_auth:** Both have account, invitation, jwks, member, organization, project_config, session, user, verification.
- **notifications:** Both have deliveries, events.
- **puretask:** Both have credit_transactions, disputes, earnings, job_events, job_gps_logs, job_photos, job_time_logs, jobs, notifications, payouts, users.

No differences in these schemas between prod and test.

---

## 7. Summary by category

| Category        | Prod only count | Test only count |
|-----------------|-----------------|------------------|
| Extensions      | 1 (pg_session_jwt) | 0 |
| Schemas         | 1 (pgrst)       | 0 |
| Public enums    | 22              | 1 (invoice_status) |
| Public tables   | 15              | 18 |
| neon_auth/notifications/puretask | 0 | 0 |

---

## 8. How to refresh this reference

1. Run schema dumps: `npm run db:dump:schema:full` (produces `prod.sql`, `test.sql` in repo root; they are gitignored).
2. Re-extract lists from the dumps (e.g. `CREATE EXTENSION`, `CREATE TYPE public.*`, `CREATE TABLE public.*`) and update this file, or run a script that diffs the two files and outputs the same structure.

For unification steps and migration strategy, see [SETUP.md § Prod vs test schema differences](./SETUP.md#prod-vs-test-schema-differences-and-how-to-unify).
