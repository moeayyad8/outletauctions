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

async function getNextInternalCode(db: Pool): Promise<string> {
  const rows = await db.query<{ internal_code: string | null }>(
    "SELECT internal_code FROM auctions WHERE internal_code LIKE 'OA%'",
  );

  let maxNumber = 0;
  for (const row of rows.rows) {
    if (!row.internal_code) continue;
    const parsed = Number.parseInt(row.internal_code.replace("OA", ""), 10);
    if (Number.isFinite(parsed) && parsed > maxNumber) {
      maxNumber = parsed;
    }
  }

  return `OA${(maxNumber + 1).toString().padStart(9, "0")}`;
}

export default async function handler(req: any, res: any) {
  try {
    const db = getPool();

    if (req.method === "GET") {
      const result = await db.query<AuctionRow>(
        "SELECT * FROM auctions ORDER BY created_at DESC",
      );
      return res.status(200).json(result.rows.map(toAuction));
    }

    if (req.method !== "POST") {
      return res.status(405).json({ message: "Method not allowed" });
    }

    const body = getBody(req);
    const shelfId = typeof body.shelfId === "number" ? body.shelfId : null;
    const title = typeof body.title === "string" ? body.title.trim() : "";
    if (!title) {
      return res.status(400).json({ message: "Title is required" });
    }
    if (!shelfId) {
      return res.status(400).json({ message: "Shelf location is required" });
    }

    const internalCode = await getNextInternalCode(db);
    const upc = typeof body.upc === "string" ? body.upc.trim() : null;
    const description = typeof body.description === "string" ? body.description : null;
    const image = typeof body.image === "string" ? body.image : null;
    const brand = typeof body.brand === "string" ? body.brand : null;
    const category = typeof body.category === "string" ? body.category : null;
    const retailPrice = typeof body.retailPrice === "number" ? body.retailPrice : null;
    const startingBid = typeof body.startingBid === "number" ? body.startingBid : 1;
    const status = typeof body.status === "string" ? body.status : "draft";
    const destination = typeof body.destination === "string" ? body.destination : "auction";
    const condition = typeof body.condition === "string" ? body.condition : null;
    const weightClass = typeof body.weightClass === "string" ? body.weightClass : null;
    const brandTier = typeof body.brandTier === "string" ? body.brandTier : null;
    const stockQuantity = typeof body.stockQuantity === "number" ? body.stockQuantity : 1;
    const scannedByStaffId =
      typeof body.scannedByStaffId === "number" ? body.scannedByStaffId : null;
    const showOnHomepage = body.showOnHomepage === 1 ? 1 : 0;

    const created = await db.query<AuctionRow>(
      `INSERT INTO auctions (
        internal_code, upc, title, description, image, brand, category, retail_price,
        starting_bid, status, destination, shelf_id, condition, weight_class, brand_tier,
        stock_quantity, scanned_by_staff_id, show_on_homepage
      ) VALUES (
        $1,$2,$3,$4,$5,$6,$7,$8,
        $9,$10,$11,$12,$13,$14,$15,
        $16,$17,$18
      )
      RETURNING *`,
      [
        internalCode,
        upc,
        title,
        description,
        image,
        brand,
        category,
        retailPrice,
        startingBid,
        status,
        destination,
        shelfId,
        condition,
        weightClass,
        brandTier,
        stockQuantity,
        scannedByStaffId,
        showOnHomepage,
      ],
    );

    return res.status(201).json(toAuction(created.rows[0]));
  } catch (error: any) {
    console.error("Staff auctions API error:", error);
    return res.status(500).json({
      message: "Failed to create auction",
      error: error?.message || "Unknown error",
    });
  }
}
