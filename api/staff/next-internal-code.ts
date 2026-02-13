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
  if (req.method !== "GET") {
    return res.status(405).json({ message: "Method not allowed" });
  }

  try {
    const db = getPool();
    const code = await getNextInternalCode(db);
    return res.status(200).json({ code });
  } catch (error: any) {
    console.error("Next internal code API error:", error);
    return res.status(500).json({
      message: "Failed to get next internal code",
      error: error?.message || "Unknown error",
    });
  }
}
