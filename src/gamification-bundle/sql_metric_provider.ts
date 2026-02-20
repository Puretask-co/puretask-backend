import { MetricProvider, MetricValue, Window } from "../../puretask_gamification_step5/src/types";
import { withClient } from "../db/client";

/**
 * SqlMetricProvider (scaffold)
 * Implement each metric per metrics_contract_v1.
 */
export class SqlMetricProvider implements MetricProvider {
  async getMetric(params: { cleaner_id: string; metric_key: string; window?: Window | null; filters?: Record<string, any>; now?: Date }): Promise<MetricValue> {
    const w = params.window ?? { type: "lifetime" as const };
    const filters = params.filters ?? {};

    return await withClient(async (client) => {
      switch (params.metric_key) {
        case "jobs.completed.count":
          return await jobsCompletedCount(client, params.cleaner_id, w, filters);

        case "ratings.avg_stars":
          return await ratingsAvgStars(client, params.cleaner_id, w);

        case "messages.sent_to_clients.meaningful.count":
          return await meaningfulMessagesCount(client, params.cleaner_id, w);

        // TODO: implement all other keys from metrics_contract_v1.json
        default:
          return null;
      }
    });
  }
}

async function jobsCompletedCount(client:any, cleanerId:string, w:Window, filters:Record<string,any>): Promise<number> {
  let sql = `SELECT count(*)::int AS c FROM jobs WHERE cleaner_id=$1 AND status='completed'`;
  const args:any[] = [cleanerId];

  if (w.type === "days") { args.push(w.value); sql += ` AND completed_at >= now() - ($${args.length}::int || ' days')::interval`; }
  if (filters.cleaning_type) { args.push(filters.cleaning_type); sql += ` AND cleaning_type = $${args.length}`; }
  if (filters.time_slot) { args.push(filters.time_slot); sql += ` AND time_slot = $${args.length}`; }

  const { rows } = await client.query(sql, args);
  return rows?.[0]?.c ?? 0;
}

async function ratingsAvgStars(client:any, cleanerId:string, w:Window): Promise<number|null> {
  let sql = `SELECT avg(stars)::float AS a FROM ratings WHERE cleaner_id=$1`;
  const args:any[] = [cleanerId];
  if (w.type === "days") { args.push(w.value); sql += ` AND created_at >= now() - ($${args.length}::int || ' days')::interval`; }
  const { rows } = await client.query(sql, args);
  const a = rows?.[0]?.a;
  return a == null ? null : Number(a);
}

async function meaningfulMessagesCount(client:any, cleanerId:string, w:Window): Promise<number> {
  let sql = `SELECT count(*)::int AS c
    FROM messages
    WHERE cleaner_id=$1 AND direction='outbound'
      AND (template_id IS NOT NULL OR text_length >= 25 OR client_replied_within_24h=true)`;
  const args:any[] = [cleanerId];
  if (w.type === "days") { args.push(w.value); sql += ` AND created_at >= now() - ($${args.length}::int || ' days')::interval`; }
  const { rows } = await client.query(sql, args);
  return rows?.[0]?.c ?? 0;
}
