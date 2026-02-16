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

function parseAuctionId(req: any): number | null {
  const value = req?.query?.id;
  const raw = Array.isArray(value) ? value[0] : value;
  const id = Number.parseInt(String(raw), 10);
  return Number.isFinite(id) && id > 0 ? id : null;
}

export default async function handler(req: any, res: any) {
  if (req.method !== "PATCH") {
    return res.status(405).json({ message: "Method not allowed" });
  }

  try {
    const auctionId = parseAuctionId(req);
    if (!auctionId) {
      return res.status(400).json({ message: "Invalid auction ID" });
    }

    const body = getBody(req);
    const status = typeof body.status === "string" ? body.status : "";
    if (!status || !["draft", "active", "ended", "sold"].includes(status)) {
      return res.status(400).json({ message: "Invalid status" });
    }

    const durationDays = typeof body.durationDays === "number" ? body.durationDays : null;
    const endTime =
      status === "active" && durationDays && durationDays > 0
        ? new Date(Date.now() + durationDays * 24 * 60 * 60 * 1000)
        : null;

    const db = getPool();
    const updated = await db.query(
      "UPDATE auctions SET status = $1, end_time = COALESCE($2, end_time) WHERE id = $3 RETURNING id, status, end_time",
      [status, endTime, auctionId],
    );

    if (updated.rowCount === 0) {
      return res.status(404).json({ message: "Auction not found" });
    }

    return res.status(200).json(updated.rows[0]);
  } catch (error: any) {
    console.error("Update status API error:", error);
    return res.status(500).json({
      message: "Failed to update auction status",
      error: error?.message || "Unknown error",
    });
  }
}
