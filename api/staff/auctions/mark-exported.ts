import { Pool, neonConfig } from "@neondatabase/serverless";
import ws from "ws";

neonConfig.webSocketConstructor = ws;

let pool: Pool | null = null;

function getConnectionString(): string | null {
  return process.env.DATABASE_URL || process.env.SUPABASE_DB_URL || null;
}

function getPool(): Pool {
  if (!pool) {
    const connectionString = getConnectionString();
    if (!connectionString) {
      throw new Error("DATABASE_URL or SUPABASE_DB_URL is required");
    }
    pool = new Pool({ connectionString });
  }
  return pool;
}

function getBody(req: any): Record<string, unknown> {
  if (!req?.body) return {};
  if (typeof req.body === "string") {
    try {
      return JSON.parse(req.body);
    } catch {
      return {};
    }
  }
  if (typeof req.body === "object") return req.body as Record<string, unknown>;
  return {};
}

export default async function handler(req: any, res: any) {
  if (req.method !== "POST") {
    return res.status(405).json({ message: "Method not allowed" });
  }

  try {
    const body = getBody(req);
    const ids = Array.isArray(body.ids)
      ? body.ids.filter((id): id is number => typeof id === "number" && Number.isInteger(id) && id > 0)
      : [];

    if (ids.length === 0) {
      return res.status(400).json({ message: "ids array is required" });
    }

    const db = getPool();
    const result = await db.query(
      "UPDATE auctions SET last_exported_at = NOW(), ebay_status = 'exported' WHERE id = ANY($1::int[])",
      [ids],
    );

    return res.status(200).json({ success: true, count: result.rowCount ?? 0 });
  } catch (error: any) {
    console.error("Mark exported API error:", error);
    return res.status(500).json({
      message: "Failed to mark auctions as exported",
      error: error?.message || "Unknown error",
    });
  }
}
