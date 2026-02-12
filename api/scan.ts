type ScanResult = {
  code: string;
  codeType: "UPC" | "EAN" | "ASIN" | "UNKNOWN";
  lookupStatus: "SUCCESS" | "NEEDS_ENRICHMENT" | "NOT_FOUND";
  title: string;
  image: string | null;
  brand: string | null;
  category: string | null;
  highestPrice: number | null;
};

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

function detectCodeType(code: string): ScanResult["codeType"] {
  const cleaned = code.trim();
  if (/^\d{12}$/.test(cleaned)) return "UPC";
  if (/^\d{13}$/.test(cleaned)) return "EAN";
  if (/^[A-Z0-9]{10}$/i.test(cleaned)) return "ASIN";
  return "UNKNOWN";
}

function fallbackResult(code: string, codeType: ScanResult["codeType"]): ScanResult {
  return {
    code,
    codeType,
    lookupStatus: codeType === "ASIN" || codeType === "UNKNOWN" ? "NEEDS_ENRICHMENT" : "NOT_FOUND",
    title: `Unidentified Retail Item - ID ${code}`,
    image: null,
    brand: null,
    category: null,
    highestPrice: null,
  };
}

async function lookupCode(code: string): Promise<ScanResult> {
  const cleaned = code.trim();
  const codeType = detectCodeType(cleaned);

  if (codeType === "ASIN" || codeType === "UNKNOWN") {
    return fallbackResult(cleaned, codeType);
  }

  const apiKey = process.env.UPCITEMDB_API_KEY;
  const url = apiKey
    ? `https://api.upcitemdb.com/prod/v1/lookup?upc=${cleaned}`
    : `https://api.upcitemdb.com/prod/trial/lookup?upc=${cleaned}`;

  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (apiKey) {
    headers.user_key = apiKey;
    headers.key_type = "3scale";
  }

  const response = await fetch(url, { headers });
  if (!response.ok) {
    return fallbackResult(cleaned, codeType);
  }

  const data = await response.json();
  const item = data?.items?.[0];
  if (!item) {
    return fallbackResult(cleaned, codeType);
  }

  const image = Array.isArray(item.images) && item.images.length > 0 ? item.images[0] : null;
  let highestPrice: number | null = null;
  if (Array.isArray(item.offers)) {
    const prices = item.offers
      .map((o: any) => Number.parseFloat(o?.price))
      .filter((p: number) => Number.isFinite(p) && p > 0);
    if (prices.length > 0) {
      highestPrice = Math.max(...prices);
    }
  }
  if (!highestPrice && item.highest_recorded_price) {
    const parsed = Number.parseFloat(item.highest_recorded_price);
    if (Number.isFinite(parsed) && parsed > 0) {
      highestPrice = parsed;
    }
  }

  return {
    code: cleaned,
    codeType,
    lookupStatus: "SUCCESS",
    title: item.title || `Retail Item - ${cleaned}`,
    image,
    brand: item.brand || null,
    category: item.category || null,
    highestPrice,
  };
}

export default async function handler(req: any, res: any) {
  if (req.method !== "POST") {
    return res.status(405).json({ message: "Method not allowed" });
  }

  try {
    const code = getCode(req.body);
    if (!code) {
      return res.status(400).json({ message: "Code is required" });
    }

    const result = await lookupCode(code);
    return res.status(200).json(result);
  } catch (error: any) {
    console.error("Scan API error:", error);
    return res.status(500).json({
      message: "Failed to scan code",
      error: error?.message || "Unknown error",
    });
  }
}
