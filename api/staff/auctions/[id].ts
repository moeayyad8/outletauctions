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

function parseAuctionId(req: any): number | null {
  const value = req?.query?.id;
  const raw = Array.isArray(value) ? value[0] : value;
  const id = Number.parseInt(String(raw), 10);
  return Number.isFinite(id) && id > 0 ? id : null;
}

type AuctionRow = {
  id: number;
  internal_code: string | null;
  upc: string | null;
  title: string;
  description: string | null;
  image: string | null;
  brand: string | null;
  category: string | null;
  retail_price: number | null;
  starting_bid: number;
  current_bid: number;
  bid_count: number;
  end_time: string | null;
  status: string;
  destination: string;
  external_status: string | null;
  external_listing_id: string | null;
  external_listing_url: string | null;
  external_payload: unknown;
  last_sync_at: string | null;
  shelf_id: number | null;
  condition: string | null;
  weight_ounces: number | null;
  weight_class: string | null;
  brand_tier: string | null;
  stock_quantity: number;
  routing_primary: string | null;
  routing_secondary: string | null;
  routing_scores: unknown;
  routing_disqualifications: unknown;
  needs_review: number;
  last_exported_at: string | null;
  ebay_status: string | null;
  batch_id: number | null;
  scanned_by_staff_id: number | null;
  cost: number;
  sold_at: string | null;
  sold_price: number | null;
  show_on_homepage: number;
  created_at: string | null;
};

function toAuction(row: AuctionRow) {
  return {
    id: row.id,
    internalCode: row.internal_code,
    upc: row.upc,
    title: row.title,
    description: row.description,
    image: row.image,
    brand: row.brand,
    category: row.category,
    retailPrice: row.retail_price,
    startingBid: row.starting_bid,
    currentBid: row.current_bid,
    bidCount: row.bid_count,
    endTime: row.end_time,
    status: row.status,
    destination: row.destination,
    externalStatus: row.external_status,
    externalListingId: row.external_listing_id,
    externalListingUrl: row.external_listing_url,
    externalPayload: row.external_payload,
    lastSyncAt: row.last_sync_at,
    shelfId: row.shelf_id,
    condition: row.condition,
    weightOunces: row.weight_ounces,
    weightClass: row.weight_class,
    brandTier: row.brand_tier,
    stockQuantity: row.stock_quantity,
    routingPrimary: row.routing_primary,
    routingSecondary: row.routing_secondary,
    routingScores: row.routing_scores,
    routingDisqualifications: row.routing_disqualifications,
    needsReview: row.needs_review,
    lastExportedAt: row.last_exported_at,
    ebayStatus: row.ebay_status,
    batchId: row.batch_id,
    scannedByStaffId: row.scanned_by_staff_id,
    cost: row.cost,
    soldAt: row.sold_at,
    soldPrice: row.sold_price,
    showOnHomepage: row.show_on_homepage,
    createdAt: row.created_at,
  };
}

export default async function handler(req: any, res: any) {
  if (req.method !== "DELETE" && req.method !== "GET") {
    return res.status(405).json({ message: "Method not allowed" });
  }

  try {
    const auctionId = parseAuctionId(req);
    if (!auctionId) {
      return res.status(400).json({ message: "Invalid auction ID" });
    }

    const db = getPool();

    if (req.method === "GET") {
      const existing = await db.query<AuctionRow>("SELECT * FROM auctions WHERE id = $1 LIMIT 1", [auctionId]);
      if (existing.rowCount === 0) {
        return res.status(404).json({ message: "Auction not found" });
      }
      return res.status(200).json(toAuction(existing.rows[0]));
    }

    await db.query("BEGIN");
    await db.query("DELETE FROM auction_tags WHERE auction_id = $1", [auctionId]);
    await db.query("DELETE FROM bids WHERE auction_id = $1", [auctionId]);
    await db.query("DELETE FROM watchlist WHERE auction_id = $1", [auctionId]);
    const deleted = await db.query("DELETE FROM auctions WHERE id = $1 RETURNING id", [auctionId]);
    await db.query("COMMIT");

    if (deleted.rowCount === 0) {
      return res.status(404).json({ message: "Auction not found" });
    }

    return res.status(200).json({ success: true, id: auctionId });
  } catch (error: any) {
    try {
      await getPool().query("ROLLBACK");
    } catch {
      // no-op
    }
    console.error("Delete auction API error:", error);
    return res.status(500).json({
      message: "Failed to delete auction",
      error: error?.message || "Unknown error",
    });
  }
}
