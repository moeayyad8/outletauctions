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

type AuctionRow = {
  id: number;
  destination: string;
  status: string;
  end_time: string | null;
  external_status: string | null;
  external_listing_id: string | null;
  external_listing_url: string | null;
  external_payload: unknown;
};

export default async function handler(req: any, res: any) {
  if (req.method !== "POST") {
    return res.status(405).json({ message: "Method not allowed" });
  }

  try {
    const auctionId = parseAuctionId(req);
    if (!auctionId) {
      return res.status(400).json({ message: "Invalid auction ID" });
    }

    const body = getBody(req);
    const destination = typeof body.destination === "string" ? body.destination : "";
    if (!destination || !["auction", "ebay", "amazon"].includes(destination)) {
      return res.status(400).json({ message: "Invalid destination" });
    }

    const db = getPool();
    const existing = await db.query("SELECT id, title, retail_price FROM auctions WHERE id = $1 LIMIT 1", [auctionId]);
    if (existing.rowCount === 0) {
      return res.status(404).json({ message: "Auction not found" });
    }

    if (destination === "auction") {
      const endTime = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
      const updated = await db.query<AuctionRow>(
        `UPDATE auctions
         SET destination = 'auction',
             status = 'active',
             end_time = $1,
             external_status = NULL,
             external_listing_id = NULL,
             external_listing_url = NULL,
             external_payload = NULL
         WHERE id = $2
         RETURNING id, destination, status, end_time, external_status, external_listing_id, external_listing_url, external_payload`,
        [endTime, auctionId],
      );
      return res.status(200).json(updated.rows[0]);
    }

    const mockListingId = `${destination.toUpperCase()}-${Date.now()}`;
    const mockListingUrl =
      destination === "ebay"
        ? `https://www.ebay.com/itm/${mockListingId}`
        : `https://www.amazon.com/dp/${mockListingId}`;

    const externalPayload = {
      platform: destination,
      submittedAt: new Date().toISOString(),
      title: existing.rows[0].title,
      price: existing.rows[0].retail_price,
    };

    const updated = await db.query<AuctionRow>(
      `UPDATE auctions
       SET destination = $1,
           external_status = 'listed',
           external_listing_id = $2,
           external_listing_url = $3,
           external_payload = $4
       WHERE id = $5
       RETURNING id, destination, status, end_time, external_status, external_listing_id, external_listing_url, external_payload`,
      [destination, mockListingId, mockListingUrl, externalPayload, auctionId],
    );

    return res.status(200).json(updated.rows[0]);
  } catch (error: any) {
    console.error("Publish auction API error:", error);
    return res.status(500).json({
      message: "Failed to publish auction",
      error: error?.message || "Unknown error",
    });
  }
}
