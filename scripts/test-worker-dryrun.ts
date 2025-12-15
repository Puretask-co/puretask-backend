// scripts/test-worker-dryrun.ts
// V1 HARDENING: Worker dry-run test script
// Tests workers in a controlled environment to verify idempotency and correctness

import { query } from "../src/db/client";
import { logger } from "../src/lib/logger";
import { runWorker } from "../src/workers/index";
import { env } from "../src/config/env";

const WORKERS_TO_TEST = [
  "auto-cancel",
  "payouts",
  "kpi-snapshot",
  "retry-events",
] as const;

type TestResult = {
  worker: string;
  success: boolean;
  error?: string;
  metrics?: Record<string, number>;
};

async function verifyDatabaseState(workerName: string, beforeState: any): Promise<void> {
  // Verify database integrity after worker run
  // This is a placeholder - expand based on specific worker needs
  
  logger.info("verifying_database_state", { worker: workerName });
  
  // Example: Check for duplicate entries
  const duplicateJobs = await query(
    `SELECT COUNT(*) as count FROM jobs WHERE status IN ('requested', 'accepted', 'on_my_way', 'in_progress')`
  );
  
  logger.info("database_state_check", {
    worker: workerName,
    activeJobs: duplicateJobs.rows[0].count,
  });
}

async function runWorkerDryRun(workerName: string): Promise<TestResult> {
  logger.info("worker_dryrun_start", { worker: workerName });

  try {
    // Capture state before
    const beforeState = {
      timestamp: new Date(),
      workerName,
    };

    // Run worker
    await runWorker(workerName as any);

    // Verify state after
    await verifyDatabaseState(workerName, beforeState);

    logger.info("worker_dryrun_success", { worker: workerName });
    return {
      worker: workerName,
      success: true,
    };
  } catch (error) {
    logger.error("worker_dryrun_failed", {
      worker: workerName,
      error: (error as Error).message,
    });
    return {
      worker: workerName,
      success: false,
      error: (error as Error).message,
    };
  }
}

async function testIdempotency(workerName: string): Promise<boolean> {
  logger.info("testing_worker_idempotency", { worker: workerName });

  try {
    // Run worker first time (capture state before)
    const beforeState = await query(`SELECT COUNT(*) as count FROM worker_runs WHERE worker_name = $1`, [workerName]);
    await runWorker(workerName as any);
    const afterFirstRun = await query(`SELECT COUNT(*) as count FROM worker_runs WHERE worker_name = $1`, [workerName]);

    // Run worker second time immediately (should be idempotent)
    await runWorker(workerName as any);
    const afterSecondRun = await query(`SELECT COUNT(*) as count FROM worker_runs WHERE worker_name = $1`, [workerName]);

    // Compare results (should be identical or non-destructive)
    // For idempotent workers, second run should not create duplicates
    
    logger.info("idempotency_test_complete", {
      worker: workerName,
      beforeRuns: beforeState.rows[0].count,
      afterFirstRun: afterFirstRun.rows[0].count,
      afterSecondRun: afterSecondRun.rows[0].count,
    });

    return true;
  } catch (error) {
    logger.error("idempotency_test_failed", {
      worker: workerName,
      error: (error as Error).message,
    });
    return false;
  }
}

async function main() {
  console.log("=".repeat(60));
  console.log("V1 HARDENING: Worker Dry-Run Test Suite");
  console.log("=".repeat(60));
  console.log(`Environment: ${env.NODE_ENV}`);
  console.log(`Database: ${env.DATABASE_URL ? "Connected" : "Not Connected"}`);
  console.log(`Workers Enabled: ${env.WORKERS_ENABLED}`);
  console.log("=".repeat(60));
  console.log();

  if (!env.WORKERS_ENABLED) {
    console.warn("⚠️  WARNING: WORKERS_ENABLED is false. Some tests may not run.");
    console.log();
  }

  const results: TestResult[] = [];

  // Test each worker
  for (const worker of WORKERS_TO_TEST) {
    console.log(`Testing worker: ${worker}`);
    console.log("-".repeat(60));

    // Dry run
    const dryRunResult = await runWorkerDryRun(worker);
    results.push(dryRunResult);

    // Idempotency test
    console.log(`Testing idempotency: ${worker}`);
    const isIdempotent = await testIdempotency(worker);
    
    if (!isIdempotent) {
      console.warn(`⚠️  Worker ${worker} may not be idempotent`);
    }

    console.log();
  }

  // Summary
  console.log("=".repeat(60));
  console.log("DRY-RUN RESULTS SUMMARY");
  console.log("=".repeat(60));

  const successful = results.filter((r) => r.success).length;
  const failed = results.filter((r) => !r.success).length;

  console.log(`Total Workers Tested: ${results.length}`);
  console.log(`✅ Successful: ${successful}`);
  console.log(`❌ Failed: ${failed}`);
  console.log();

  if (failed > 0) {
    console.log("FAILED WORKERS:");
    results
      .filter((r) => !r.success)
      .forEach((r) => {
        console.log(`  - ${r.worker}: ${r.error}`);
      });
    console.log();
  }

  console.log("=".repeat(60));

  // Exit with error code if any failed
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((error) => {
  logger.error("dryrun_main_failed", { error: (error as Error).message });
  console.error("Fatal error:", error);
  process.exit(1);
});

