import { eq } from "drizzle-orm";
import { db } from "../server/db";
import { insertShelfSchema, shelves } from "@shared/schema";

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
  try {
    if (req.method === "GET") {
      const allShelves = await db.select().from(shelves).orderBy(shelves.id);
      return res.status(200).json(allShelves);
    }

    if (req.method !== "POST") {
      return res.status(405).json({ message: "Method not allowed" });
    }

    const body = getBody(req);
    const rawName = typeof body.name === "string" ? body.name.trim() : "";
    if (!rawName) {
      return res.status(400).json({ message: "Shelf name is required" });
    }

    const requestedCode = typeof body.code === "string" ? body.code.trim().toUpperCase() : "";

    const allShelves = await db.select().from(shelves).orderBy(shelves.id);
    const existingCodes = new Set(allShelves.map((s) => s.code.toUpperCase()));

    let code = requestedCode;
    if (!code) {
      let nextShelfNumber = allShelves.length + 1;
      while (existingCodes.has(`OAS${nextShelfNumber.toString().padStart(2, "0")}`)) {
        nextShelfNumber += 1;
      }
      code = `OAS${nextShelfNumber.toString().padStart(2, "0")}`;
    } else {
      const existing = await db.select().from(shelves).where(eq(shelves.code, code)).limit(1);
      if (existing.length > 0) {
        return res.status(409).json({ message: "Shelf code already exists" });
      }
    }

    const shelfData = insertShelfSchema.parse({ name: rawName, code });
    const [created] = await db.insert(shelves).values(shelfData).returning();
    return res.status(201).json(created);
  } catch (error: any) {
    console.error("Shelves API error:", error);
    return res.status(500).json({
      message: "Failed to create shelf",
      error: error?.message || "Unknown error",
    });
  }
}
