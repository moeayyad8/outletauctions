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

function clampString(value: unknown, max: number): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed.slice(0, max);
}

function toInt(value: unknown, fallback: number | null = null): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return Math.trunc(value);
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number.parseInt(value, 10);
    if (Number.isFinite(parsed)) return parsed;
  }
  return fallback;
}

function toDate(value: unknown): Date | null {
  if (!value) return null;
  const d = new Date(String(value));
  return Number.isNaN(d.getTime()) ? null : d;
}

type ImportCounts = {
  auctions: number;
  shelves: number;
  tags: number;
  skipped: number;
};

export default async function handler(req: any, res: any) {
  if (req.method !== "POST") {
    return res.status(405).json({ message: "Method not allowed" });
  }

  try {
    const body = getBody(req);
    const payload = (body.data as Record<string, unknown>) ?? {};
    const options = (body.options as Record<string, unknown>) ?? {};

    const auctions = Array.isArray(payload.auctions) ? payload.auctions : [];
    const shelves = Array.isArray(payload.shelves) ? payload.shelves : [];
    const tags = Array.isArray(payload.tags) ? payload.tags : [];

    const importShelves = options.importShelves !== false;
    const importTags = options.importTags !== false;

    const db = getPool();
    const counts: ImportCounts = { auctions: 0, shelves: 0, tags: 0, skipped: 0 };

    if (importShelves && shelves.length > 0) {
      const existingShelves = await db.query<{ code: string }>("SELECT code FROM shelves");
      const existingCodes = new Set(existingShelves.rows.map((r) => r.code.toUpperCase()));
      for (const s of shelves as any[]) {
        const code = clampString(s?.code ?? s?.Code, 10)?.toUpperCase();
        const name = clampString(s?.name ?? s?.Name, 50);
        if (!code || !name || existingCodes.has(code)) continue;
        await db.query("INSERT INTO shelves (name, code) VALUES ($1, $2)", [name, code]);
        existingCodes.add(code);
        counts.shelves++;
      }
    }

    if (importTags && tags.length > 0) {
      const existingTags = await db.query<{ name: string }>("SELECT name FROM tags");
      const existingNames = new Set(existingTags.rows.map((r) => r.name.toLowerCase()));
      for (const t of tags as any[]) {
        const name = clampString(t?.name ?? t?.Name, 100);
        const type = clampString(t?.type ?? t?.Type, 20) ?? "category";
        if (!name || existingNames.has(name.toLowerCase())) continue;
        await db.query("INSERT INTO tags (name, type) VALUES ($1, $2)", [name, type]);
        existingNames.add(name.toLowerCase());
        counts.tags++;
      }
    }

    const existingAuctions = await db.query<{ internal_code: string | null }>(
      "SELECT internal_code FROM auctions WHERE internal_code IS NOT NULL",
    );
    const existingCodes = new Set(
      existingAuctions.rows.map((r) => r.internal_code).filter(Boolean) as string[],
    );

    for (const source of auctions as any[]) {
      const title = clampString(source?.title ?? source?.Title, 500);
      if (!title) {
        counts.skipped++;
        continue;
      }

      const internalCode =
        clampString(source?.internalCode ?? source?.internal_code, 20) ??
        clampString(source?.internalcode, 20);

      if (internalCode && existingCodes.has(internalCode)) {
        counts.skipped++;
        continue;
      }

      const upc = clampString(source?.upc ?? source?.upcCode ?? source?.upc_code, 20);
      const description = clampString(source?.description, 10000);
      const image = clampString(source?.image ?? source?.imageUrl ?? source?.image_url, 1000);
      const brand = clampString(source?.brand, 200);
      const category = clampString(source?.category, 200);
      const retailPrice = toInt(source?.retailPrice ?? source?.retail_price, null);
      const startingBid = toInt(source?.startingBid ?? source?.starting_bid, 1) ?? 1;
      const currentBid = toInt(source?.currentBid ?? source?.current_bid, 0) ?? 0;
      const bidCount = toInt(source?.bidCount ?? source?.bid_count, 0) ?? 0;
      const endTime = toDate(source?.endTime ?? source?.end_time);
      const status = clampString(source?.status, 20) ?? "draft";
      const destination = clampString(source?.destination, 20) ?? "auction";
      const externalStatus = clampString(source?.externalStatus ?? source?.external_status, 20);
      const externalListingId = clampString(source?.externalListingId ?? source?.external_listing_id, 100);
      const externalListingUrl = clampString(source?.externalListingUrl ?? source?.external_listing_url, 500);
      const externalPayload = source?.externalPayload ?? source?.external_payload ?? null;
      const lastSyncAt = toDate(source?.lastSyncAt ?? source?.last_sync_at);
      const shelfId = toInt(source?.shelfId ?? source?.shelf_id, null);
      const condition = clampString(source?.condition, 20);
      const weightOunces = toInt(source?.weightOunces ?? source?.weight_ounces, null);
      const weightClass = clampString(source?.weightClass ?? source?.weight_class, 20);
      const brandTier = clampString(source?.brandTier ?? source?.brand_tier, 5);
      const stockQuantity = toInt(source?.stockQuantity ?? source?.stock_quantity, 1) ?? 1;
      const routingPrimary = clampString(source?.routingPrimary ?? source?.routing_primary, 20);
      const routingSecondary = clampString(source?.routingSecondary ?? source?.routing_secondary, 20);
      const routingScores = source?.routingScores ?? source?.routing_scores ?? null;
      const routingDisqualifications =
        source?.routingDisqualifications ?? source?.routing_disqualifications ?? null;
      const needsReview = toInt(source?.needsReview ?? source?.needs_review, 0) ?? 0;
      const lastExportedAt = toDate(source?.lastExportedAt ?? source?.last_exported_at);
      const ebayStatus = clampString(source?.ebayStatus ?? source?.ebay_status, 20);
      const batchId = toInt(source?.batchId ?? source?.batch_id, null);
      const scannedByStaffId = toInt(source?.scannedByStaffId ?? source?.scanned_by_staff_id, null);
      const cost = toInt(source?.cost, 200) ?? 200;
      const soldAt = toDate(source?.soldAt ?? source?.sold_at);
      const soldPrice = toInt(source?.soldPrice ?? source?.sold_price, null);
      const showOnHomepage = toInt(source?.showOnHomepage ?? source?.show_on_homepage, 0) ?? 0;
      const createdAt = toDate(source?.createdAt ?? source?.created_at);

      await db.query(
        `INSERT INTO auctions (
          internal_code, upc, title, description, image, brand, category, retail_price,
          starting_bid, current_bid, bid_count, end_time, status, destination, external_status,
          external_listing_id, external_listing_url, external_payload, last_sync_at, shelf_id,
          condition, weight_ounces, weight_class, brand_tier, stock_quantity, routing_primary,
          routing_secondary, routing_scores, routing_disqualifications, needs_review,
          last_exported_at, ebay_status, batch_id, scanned_by_staff_id, cost, sold_at, sold_price,
          show_on_homepage, created_at
        ) VALUES (
          $1,$2,$3,$4,$5,$6,$7,$8,
          $9,$10,$11,$12,$13,$14,$15,
          $16,$17,$18,$19,$20,
          $21,$22,$23,$24,$25,$26,
          $27,$28,$29,$30,
          $31,$32,$33,$34,$35,$36,$37,
          $38,$39
        )`,
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
          currentBid,
          bidCount,
          endTime,
          status,
          destination,
          externalStatus,
          externalListingId,
          externalListingUrl,
          externalPayload,
          lastSyncAt,
          shelfId,
          condition,
          weightOunces,
          weightClass,
          brandTier,
          stockQuantity,
          routingPrimary,
          routingSecondary,
          routingScores,
          routingDisqualifications,
          needsReview,
          lastExportedAt,
          ebayStatus,
          batchId,
          scannedByStaffId,
          cost,
          soldAt,
          soldPrice,
          showOnHomepage,
          createdAt,
        ],
      );

      if (internalCode) existingCodes.add(internalCode);
      counts.auctions++;
    }

    return res.status(200).json({
      success: true,
      message: `Imported ${counts.auctions} auctions (${counts.skipped} skipped)`,
      imported: counts,
    });
  } catch (error: any) {
    console.error("Admin import API error:", error);
    return res.status(500).json({
      message: "Failed to import data",
      error: error?.message || "Unknown error",
    });
  }
}
