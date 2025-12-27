// src/workers/metricsSnapshot.ts
// Periodic operational metrics logging worker

import { workerLogger } from "../lib/logger";
import { logOperationalSnapshot } from "../services/operationalMetricsService";

const log = workerLogger("metricsSnapshot");
const INTERVAL_MS = 60 * 60 * 1000; // Every hour

async function main() {
  log.info("metrics_snapshot_worker_started");

  // Run immediately on start
  await runSnapshot();

  // Then run periodically
  setInterval(runSnapshot, INTERVAL_MS);
}

async function runSnapshot() {
  try {
    await logOperationalSnapshot();
    log.info("metrics_snapshot_completed");
  } catch (error) {
    log.error("metrics_snapshot_failed", { error });
  }
}

main().catch((error) => {
  log.error("metrics_snapshot_worker_fatal", { error });
  process.exit(1);
});

