const UPCITEMDB_API_URL = "https://api.upcitemdb.com/prod/trial/lookup";

interface ScanResult {
  code: string;
  codeType: "UPC" | "EAN" | "ASIN" | "UNKNOWN";
  lookupStatus: "SUCCESS" | "NEEDS_ENRICHMENT" | "NOT_FOUND";
  title: string;
  image: string | null;
  brand: string | null;
  category: string | null;
  highestPrice: number | null;
}

function detectCodeType(code: string): "UPC" | "EAN" | "ASIN" | "UNKNOWN" {
  const cleaned = code.trim();
  
  if (/^\d{12}$/.test(cleaned)) {
    return "UPC";
  }
  
  if (/^\d{13}$/.test(cleaned)) {
    return "EAN";
  }
  
  if (/^[A-Z0-9]{10}$/i.test(cleaned)) {
    return "ASIN";
  }
  
  return "UNKNOWN";
}

const MARKETING_WORDS = [
  "new", "official", "authentic", "genuine", "original", "free shipping",
  "fast shipping", "best seller", "hot sale", "limited edition", "exclusive",
  "premium", "deluxe", "professional", "ultra", "super", "mega", "extra",
  "special offer", "sale", "deal", "discount", "cheap", "affordable",
  "high quality", "top quality", "best quality", "100%", "brand new",
  "factory sealed", "sealed", "unopened", "mint", "perfect", "excellent"
];

function cleanTitle(rawTitle: string): string {
  if (!rawTitle) return "";
  
  let title = rawTitle;
  
  for (const word of MARKETING_WORDS) {
    const regex = new RegExp(`\\b${word}\\b`, "gi");
    title = title.replace(regex, "");
  }
  
  title = title
    .replace(/\s*[-–—]\s*size\s*:?\s*\w+/gi, "")
    .replace(/\s*[-–—]\s*color\s*:?\s*\w+/gi, "")
    .replace(/\s*,\s*size\s*:?\s*\w+/gi, "")
    .replace(/\s*,\s*color\s*:?\s*\w+/gi, "")
    .replace(/\s*\(\s*\w+\s*(size|color|pack|count)\s*\)/gi, "")
    .replace(/\s+/g, " ")
    .replace(/^[,\s-]+|[,\s-]+$/g, "")
    .trim();
  
  if (title.length > 120) {
    title = title.substring(0, 117) + "...";
  }
  
  return title;
}

export async function scanCode(code: string): Promise<ScanResult> {
  const cleaned = code.trim();
  const codeType = detectCodeType(cleaned);
  
  if (codeType === "ASIN" || codeType === "UNKNOWN") {
    return {
      code: cleaned,
      codeType,
      lookupStatus: "NEEDS_ENRICHMENT",
      title: `Unidentified Retail Item – ID ${cleaned}`,
      image: null,
      brand: null,
      category: null,
      highestPrice: null
    };
  }
  
  try {
    const apiKey = process.env.UPCITEMDB_API_KEY;
    
    let response;
    if (apiKey) {
      response = await fetch(`https://api.upcitemdb.com/prod/v1/lookup?upc=${cleaned}`, {
        headers: {
          "Content-Type": "application/json",
          "user_key": apiKey,
          "key_type": "3scale"
        }
      });
    } else {
      response = await fetch(`${UPCITEMDB_API_URL}?upc=${cleaned}`, {
        headers: { "Content-Type": "application/json" }
      });
    }

    if (!response.ok) {
      return {
        code: cleaned,
        codeType,
        lookupStatus: "NOT_FOUND",
        title: `Unidentified Retail Item – ID ${cleaned}`,
        image: null,
        brand: null,
        category: null,
        highestPrice: null
      };
    }

    const data = await response.json();
    
    if (!data.items || data.items.length === 0) {
      return {
        code: cleaned,
        codeType,
        lookupStatus: "NOT_FOUND",
        title: `Unidentified Retail Item – ID ${cleaned}`,
        image: null,
        brand: null,
        category: null,
        highestPrice: null
      };
    }

    const item = data.items[0];
    
    const rawTitle = item.title || "";
    const cleanedTitle = cleanTitle(rawTitle) || `Retail Item – ${cleaned}`;
    
    const image = item.images && item.images.length > 0 ? item.images[0] : null;
    
    const brand = item.brand || null;
    const category = item.category || null;
    
    let highestPrice: number | null = null;
    if (item.offers && item.offers.length > 0) {
      const prices = item.offers
        .map((o: any) => parseFloat(o.price))
        .filter((p: number) => !isNaN(p) && p > 0);
      if (prices.length > 0) {
        highestPrice = Math.max(...prices);
      }
    }
    if (!highestPrice && item.highest_recorded_price) {
      highestPrice = parseFloat(item.highest_recorded_price);
    }

    return {
      code: cleaned,
      codeType,
      lookupStatus: "SUCCESS",
      title: cleanedTitle,
      image,
      brand,
      category,
      highestPrice
    };
  } catch (error) {
    console.error("UPC lookup error:", error);
    return {
      code: cleaned,
      codeType,
      lookupStatus: "NOT_FOUND",
      title: `Unidentified Retail Item – ID ${cleaned}`,
      image: null,
      brand: null,
      category: null,
      highestPrice: null
    };
  }
}

export type { ScanResult };
