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

export default async function handler(req: any, res: any) {
  if (req.method !== "GET") {
    return res.status(405).json({ message: "Method not allowed" });
  }

  try {
    const db = getPool();
    const [auctions, shelves, tags] = await Promise.all([
      db.query("SELECT * FROM auctions ORDER BY created_at DESC"),
      db.query("SELECT * FROM shelves ORDER BY id"),
      db.query("SELECT * FROM tags ORDER BY id"),
    ]);

    return res.status(200).json({
      version: 2,
      exportedAt: new Date().toISOString(),
      data: {
        auctions: auctions.rows,
        shelves: shelves.rows,
        tags: tags.rows,
      },
    });
  } catch (error: any) {
    console.error("Admin export API error:", error);
    return res.status(500).json({
      message: "Failed to export data",
      error: error?.message || "Unknown error",
    });
  }
}
