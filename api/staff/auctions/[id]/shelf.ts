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
    const shelfId = typeof body.shelfId === "number" ? body.shelfId : null;

    const db = getPool();
    const updated = await db.query(
      "UPDATE auctions SET shelf_id = $1 WHERE id = $2 RETURNING id, shelf_id",
      [shelfId, auctionId],
    );

    if (updated.rowCount === 0) {
      return res.status(404).json({ message: "Auction not found" });
    }

    return res.status(200).json({
      id: updated.rows[0].id,
      shelfId: updated.rows[0].shelf_id,
    });
  } catch (error: any) {
    console.error("Update shelf API error:", error);
    return res.status(500).json({
      message: "Failed to update shelf",
      error: error?.message || "Unknown error",
    });
  }
}
