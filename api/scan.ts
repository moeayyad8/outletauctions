import type { Request, Response } from "express";
import { scanCode } from "../server/upcService";

function getCode(body: unknown): string | null {
  if (!body) return null;
  if (typeof body === "string") {
    try {
      const parsed = JSON.parse(body);
      return typeof parsed?.code === "string" ? parsed.code : null;
    } catch {
      return null;
    }
  }
  if (typeof body === "object" && body !== null) {
    const maybeCode = (body as { code?: unknown }).code;
    return typeof maybeCode === "string" ? maybeCode : null;
  }
  return null;
}

export default async function handler(req: Request, res: Response) {
  if (req.method !== "POST") {
    return res.status(405).json({ message: "Method not allowed" });
  }

  try {
    const code = getCode(req.body);
    if (!code) {
      return res.status(400).json({ message: "Code is required" });
    }

    const result = await scanCode(code);
    return res.status(200).json(result);
  } catch (error: any) {
    console.error("Scan API error:", error);
    return res.status(500).json({
      message: "Failed to scan code",
      error: error?.message || "Unknown error",
    });
  }
}
