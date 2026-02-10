// src/workers/runDurableJobWorker.ts
// CLI entry for durable job worker. One cycle (cron) or loop.
// Usage: ts-node src/workers/runDurableJobWorker.ts [--loop] [--interval=10000]

import { runDurableJobWorkerCycle, runDurableJobWorkerLoop } from "./durableJobWorker";

const args = process.argv.slice(2);
const loop = args.includes("--loop");
const intervalArg = args.find((a) => a.startsWith("--interval="));
const intervalMs = intervalArg ? parseInt(intervalArg.split("=")[1], 10) : 10_000;

async function main() {
  if (loop) {
    await runDurableJobWorkerLoop(intervalMs);
  } else {
    const result = await runDurableJobWorkerCycle();
    console.log(JSON.stringify(result));
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
