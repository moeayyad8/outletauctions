import { Pool, neonConfig } from "@neondatabase/serverless";
import ws from "ws";

neonConfig.webSocketConstructor = ws;

type ShelfRow = {
  id: number;
  name: string;
  code: string;
  item_count: number;
  created_at: string | null;
};
type ShelfLocation = "bins" | "things" | "flatrate";

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

function normalizeShelf(row: ShelfRow) {
  return {
    id: row.id,
    name: row.name,
    code: row.code,
    itemCount: row.item_count,
    createdAt: row.created_at,
  };
}

async function ensureLocationShelves(db: Pool) {
  const existing = await db.query<{ code: string }>("SELECT code FROM shelves");
  const existingCodes = new Set(existing.rows.map((r) => r.code.toUpperCase()));

  const inserts: Array<{ name: string; code: string }> = [];
  for (let i = 1; i <= 32; i++) {
    const suffix = i.toString().padStart(2, "0");
    const binsCode = `BIN${suffix}`;
    const thingsCode = `THG${suffix}`;
    const flatrateCode = `FLT${suffix}`;
    if (!existingCodes.has(binsCode)) {
      inserts.push({ name: `Bins Shelf ${i}`, code: binsCode });
    }
    if (!existingCodes.has(thingsCode)) {
      inserts.push({ name: `Things Shelf ${i}`, code: thingsCode });
    }
    if (!existingCodes.has(flatrateCode)) {
      inserts.push({ name: `Flatrate Shelf ${i}`, code: flatrateCode });
    }
  }

  if (inserts.length === 0) return;

  for (const row of inserts) {
    await db.query("INSERT INTO shelves (name, code) VALUES ($1, $2)", [row.name, row.code]);
  }
}

function getLocationMeta(location: ShelfLocation): { prefix: string; label: string } {
  if (location === "bins") return { prefix: "BIN", label: "Bins" };
  if (location === "things") return { prefix: "THG", label: "Things" };
  return { prefix: "FLT", label: "Flatrate" };
}

export default async function handler(req: any, res: any) {
  try {
    const db = getPool();

    if (req.method === "GET") {
      await ensureLocationShelves(db);
      const result = await db.query<ShelfRow>(
        "SELECT id, name, code, item_count, created_at FROM shelves ORDER BY id",
      );
      return res.status(200).json(result.rows.map(normalizeShelf));
    }

    if (req.method !== "POST") {
      return res.status(405).json({ message: "Method not allowed" });
    }

    const body = getBody(req);
    const requestedLocation =
      body.location === "bins" || body.location === "things" || body.location === "flatrate"
        ? (body.location as ShelfLocation)
        : null;
    const rawName = typeof body.name === "string" ? body.name.trim() : "";

    const requestedCode = typeof body.code === "string" ? body.code.trim().toUpperCase() : "";
    let name = rawName.slice(0, 50);
    let code = requestedCode.slice(0, 10);

    if (requestedLocation) {
      const { prefix, label } = getLocationMeta(requestedLocation);
      const rows = await db.query<{ code: string }>(
        "SELECT code FROM shelves WHERE UPPER(code) LIKE UPPER($1)",
        [`${prefix}%`],
      );

      let maxNumber = 0;
      for (const row of rows.rows) {
        const parsed = Number.parseInt(row.code.slice(prefix.length), 10);
        if (Number.isFinite(parsed) && parsed > maxNumber) {
          maxNumber = parsed;
        }
      }
      const nextNumber = maxNumber + 1;
      code = `${prefix}${nextNumber.toString().padStart(2, "0")}`;
      if (!name) {
        name = `${label} Shelf ${nextNumber}`;
      }
    } else if (!code) {
      return res.status(400).json({ message: "location or code is required" });
    } else {
      const exists = await db.query<{ id: number }>(
        "SELECT id FROM shelves WHERE UPPER(code) = UPPER($1) LIMIT 1",
        [code],
      );
      if (exists.rowCount && exists.rowCount > 0) {
        return res.status(409).json({ message: "Shelf code already exists" });
      }
      if (!name) {
        name = code;
      }
    }

    if (!name) {
      return res.status(400).json({ message: "Shelf name is required" });
    }

    const created = await db.query<ShelfRow>(
      "INSERT INTO shelves (name, code) VALUES ($1, $2) RETURNING id, name, code, item_count, created_at",
      [name, code],
    );

    return res.status(201).json(normalizeShelf(created.rows[0]));
  } catch (error: any) {
    console.error("Shelves API error:", error);
    return res.status(500).json({
      message: "Failed to create shelf",
      error: error?.message || "Unknown error",
    });
  }
}
