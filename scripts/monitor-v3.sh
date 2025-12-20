#!/bin/bash
# scripts/monitor-v3.sh
# Monitoring script for V3 features

set -e

echo "📊 V3 Monitoring Dashboard"
echo "=========================="
echo ""

# Check if DATABASE_URL is set
if [ -z "$DATABASE_URL" ]; then
    echo "❌ DATABASE_URL not set. Loading from .env..."
    if [ -f .env ]; then
        export $(cat .env | grep -v '^#' | xargs)
    else
        echo "❌ .env file not found"
        exit 1
    fi
fi

# Function to run SQL query
run_query() {
    psql "$DATABASE_URL" -t -c "$1"
}

echo "🔍 Subscription Worker Status"
echo "----------------------------"
SUBSCRIPTION_COUNT=$(run_query "SELECT COUNT(*) FROM cleaning_subscriptions WHERE status = 'active';")
echo "Active subscriptions: $SUBSCRIPTION_COUNT"

SUBSCRIPTION_DUE=$(run_query "SELECT COUNT(*) FROM cleaning_subscriptions WHERE status = 'active' AND next_job_date <= NOW() + INTERVAL '1 day';")
echo "Subscriptions due for job creation (next 24h): $SUBSCRIPTION_DUE"
echo ""

echo "💰 Pricing Snapshots"
echo "-------------------"
PRICING_COUNT=$(run_query "SELECT COUNT(*) FROM jobs WHERE pricing_snapshot IS NOT NULL;")
echo "Jobs with pricing snapshots: $PRICING_COUNT"

if [ "$PRICING_COUNT" -gt 0 ]; then
    PRICING_TIERS=$(run_query "SELECT pricing_snapshot->>'cleanerTier' as tier, COUNT(*) FROM jobs WHERE pricing_snapshot IS NOT NULL GROUP BY tier ORDER BY COUNT(*) DESC;")
    echo "Breakdown by tier:"
    echo "$PRICING_TIERS"
fi
echo ""

echo "💵 Earnings Dashboard Status"
echo "---------------------------"
PENDING_EARNINGS=$(run_query "SELECT COUNT(DISTINCT user_id) FROM credit_ledger WHERE reason = 'job_release' AND job_id IS NOT NULL AND delta_credits > 0 AND NOT EXISTS (SELECT 1 FROM payouts p WHERE p.cleaner_id = credit_ledger.user_id AND p.job_id = credit_ledger.job_id AND p.status IN ('paid', 'completed', 'succeeded'));")
echo "Cleaners with pending earnings: $PENDING_EARNINGS"

PAID_OUT_CLEANERS=$(run_query "SELECT COUNT(DISTINCT cleaner_id) FROM payouts WHERE status IN ('paid', 'completed', 'succeeded');")
echo "Cleaners who have received payouts: $PAID_OUT_CLEANERS"
echo ""

echo "📈 Recent Activity (Last 24h)"
echo "----------------------------"
RECENT_JOBS=$(run_query "SELECT COUNT(*) FROM jobs WHERE created_at > NOW() - INTERVAL '24 hours';")
echo "Jobs created: $RECENT_JOBS"

RECENT_PRICING=$(run_query "SELECT COUNT(*) FROM jobs WHERE pricing_snapshot IS NOT NULL AND updated_at > NOW() - INTERVAL '24 hours';")
echo "Jobs with pricing snapshots created: $RECENT_PRICING"

RECENT_SUBSCRIPTIONS=$(run_query "SELECT COUNT(*) FROM cleaning_subscriptions WHERE updated_at > NOW() - INTERVAL '24 hours';")
echo "Subscriptions updated: $RECENT_SUBSCRIPTIONS"
echo ""

echo "✅ Monitoring complete"

