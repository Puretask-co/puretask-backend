# Metrics Contract Test Checklist (v1)

Each metric must have a unit test (pure function) and at least one integration test where applicable.

| metric_key | unit_test | integration_test | notes |
|---|---|---|---|
| jobs.completed.count | test_jobs_completed_count |  | See edge cases in contract. |
| jobs.completed.split_counts | test_jobs_completed_split_counts |  | See edge cases in contract. |
| jobs.on_time.count | test_jobs_on_time_count |  | See edge cases in contract. |
| jobs.on_time.rate_percent | test_jobs_on_time_rate_percent |  | See edge cases in contract. |
| jobs.on_time.streak | test_jobs_on_time_streak |  | See edge cases in contract. |
| jobs.clock_in_out.success.count | test_jobs_clock_in_out_success_count |  | See edge cases in contract. |
| jobs.clock_in_out.missing.count | test_jobs_clock_in_out_missing_count |  | See edge cases in contract. |
| jobs.photos.valid.count | test_jobs_photos_valid_count |  | See edge cases in contract. |
| jobs.rescheduled.count | test_jobs_rescheduled_count |  | See edge cases in contract. |
| jobs.cancelled_by_cleaner.count | test_jobs_cancelled_by_cleaner_count |  | See edge cases in contract. |
| jobs.addons.completed.count | test_jobs_addons_completed_count |  | See edge cases in contract. |
| messages.sent_to_clients.meaningful.count | test_messages_sent_to_clients_meaningful_count |  | See edge cases in contract. |
| engagement.meaningful_login_days.count | test_engagement_meaningful_login_days_count |  | See edge cases in contract. |
| engagement.login_streak_days | test_engagement_login_streak_days |  | See edge cases in contract. |
| job_requests.accepted.count | test_job_requests_accepted_count |  | See edge cases in contract. |
| job_requests.acceptance_rate_percent | test_job_requests_acceptance_rate_percent |  | See edge cases in contract. |
| clients.repeat_clients.count | test_clients_repeat_clients_count |  | See edge cases in contract. |
| clients.count_with_min_jobs | test_clients_count_with_min_jobs |  | See edge cases in contract. |
| clients.max_jobs_with_single_client | test_clients_max_jobs_with_single_client |  | See edge cases in contract. |
| ratings.avg_stars | test_ratings_avg_stars |  | See edge cases in contract. |
| ratings.five_star.count | test_ratings_five_star_count |  | See edge cases in contract. |
| disputes.opened.count | test_disputes_opened_count |  | See edge cases in contract. |
| disputes.lost.count | test_disputes_lost_count |  | See edge cases in contract. |
| disputes.open_or_lost.count | test_disputes_open_or_lost_count |  | See edge cases in contract. |
| disputes.lost.rate_percent_lifetime | test_disputes_lost_rate_percent_lifetime |  | See edge cases in contract. |
| reliability.percentile | test_reliability_percentile |  | See edge cases in contract. |
| badges.composite.review_whisperer | test_badges_composite_review_whisperer |  | See edge cases in contract. |
| badges.composite.tip_jar_energy | test_badges_composite_tip_jar_energy |  | See edge cases in contract. |
| tips.received.count | test_tips_received_count |  | See edge cases in contract. |