import { query } from "../db/client";

interface SearchUserRow {
  id: string;
  full_name: string;
  email: string;
}

interface SearchBookingRow {
  id: string;
  address: string;
  service_type: string;
}

export interface GlobalSearchResult {
  type: "cleaner" | "booking" | "client";
  id: string;
  title: string;
  subtitle: string;
  url: string;
}

export interface AutocompleteResult {
  id: string;
  text: string;
  type: "cleaner" | "service";
}

export async function globalSearch(
  searchTerm: string,
  role: string | undefined,
  userId: string | undefined,
  limit: number
): Promise<GlobalSearchResult[]> {
  const results: GlobalSearchResult[] = [];
  const sliceSize = Math.max(1, Math.floor(limit / 4));

  const cleaners = await query<SearchUserRow>(
    `SELECT id, full_name, email
     FROM users
     WHERE role = 'cleaner'
       AND (LOWER(full_name) LIKE $1 OR LOWER(email) LIKE $1)
     LIMIT $2`,
    [`%${searchTerm}%`, sliceSize]
  );
  for (const row of cleaners.rows) {
    results.push({
      type: "cleaner",
      id: row.id,
      title: row.full_name,
      subtitle: row.email,
      url: `/cleaner/${row.id}`,
    });
  }

  if (role === "client" || role === "admin") {
    const bookings = await query<SearchBookingRow>(
      `SELECT j.id, j.address, j.service_type
       FROM jobs j
       WHERE (LOWER(j.address) LIKE $1 OR LOWER(j.service_type) LIKE $1)
       ${role === "client" ? "AND j.client_id = $3" : ""}
       LIMIT $2`,
      role === "client" ? [`%${searchTerm}%`, sliceSize, userId] : [`%${searchTerm}%`, sliceSize]
    );
    for (const row of bookings.rows) {
      results.push({
        type: "booking",
        id: row.id,
        title: `Booking at ${row.address}`,
        subtitle: row.service_type,
        url: `/client/bookings/${row.id}`,
      });
    }
  }

  if (role === "admin") {
    const clients = await query<SearchUserRow>(
      `SELECT id, full_name, email
       FROM users
       WHERE role = 'client'
         AND (LOWER(full_name) LIKE $1 OR LOWER(email) LIKE $1)
       LIMIT $2`,
      [`%${searchTerm}%`, sliceSize]
    );
    for (const row of clients.rows) {
      results.push({
        type: "client",
        id: row.id,
        title: row.full_name,
        subtitle: row.email,
        url: `/admin/users/${row.id}`,
      });
    }
  }

  return results.slice(0, limit);
}

export async function autocompleteSearch(searchTerm: string, limit: number): Promise<AutocompleteResult[]> {
  const suggestions: AutocompleteResult[] = [];
  const cleaners = await query<{ id: string; text: string }>(
    `SELECT DISTINCT full_name as text, id
     FROM users
     WHERE role = 'cleaner'
       AND LOWER(full_name) LIKE $1
     LIMIT $2`,
    [`%${searchTerm}%`, Math.max(1, Math.floor(limit / 2))]
  );
  for (const row of cleaners.rows) {
    suggestions.push({
      id: row.id,
      text: row.text,
      type: "cleaner",
    });
  }

  const services = ["standard", "deep", "move_in_out", "airbnb"];
  const matchingServices = services
    .filter((s) => s.toLowerCase().includes(searchTerm))
    .slice(0, 3)
    .map((s) => ({
      id: `service-${s}`,
      text: s.replace("_", " "),
      type: "service" as const,
    }));
  suggestions.push(...matchingServices);

  return suggestions.slice(0, limit);
}
