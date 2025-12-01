// src/workers/index.ts
// Worker runner - can run all workers or specific ones

import { runAutoCancelWorker } from "./autoCancelJobs";
import { runPayoutsWorker } from "./processPayouts";
import { runKPISnapshotWorker } from "./kpiSnapshot";
import { runRetryFailedEventsWorker } from "./retryFailedEvents";
import { logger } from "../lib/logger";

type WorkerName = "auto-cancel" | "payouts" | "kpi-snapshot" | "retry-events" | "all";

const workers: Record<string, () => Promise<any>> = {
  "auto-cancel": runAutoCancelWorker,
  "payouts": runPayoutsWorker,
  "kpi-snapshot": runKPISnapshotWorker,
  "retry-events": runRetryFailedEventsWorker,
};

/**
 * Run a specific worker or all workers
 */
export async function runWorker(name: WorkerName): Promise<void> {
  if (name === "all") {
    logger.info("running_all_workers");

    for (const [workerName, workerFn] of Object.entries(workers)) {
      try {
        logger.info("worker_starting", { worker: workerName });
        await workerFn();
        logger.info("worker_finished", { worker: workerName });
      } catch (error) {
        logger.error("worker_error", {
          worker: workerName,
          error: (error as Error).message,
        });
      }
    }

    return;
  }

  const workerFn = workers[name];
  if (!workerFn) {
    throw new Error(`Unknown worker: ${name}. Available: ${Object.keys(workers).join(", ")}`);
  }

  await workerFn();
}

// Run if executed directly
if (require.main === module) {
  const workerName = (process.argv[2] || "all") as WorkerName;

  runWorker(workerName)
    .then(() => {
      console.log(`Worker(s) completed: ${workerName}`);
      process.exit(0);
    })
    .catch((error) => {
      console.error(`Worker(s) failed:`, error);
      process.exit(1);
    });
}

