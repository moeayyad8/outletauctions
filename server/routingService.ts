import type { Auction, RoutingConfig, BrandRoutingStat, Platform, ItemCondition } from "@shared/schema";

export interface RoutingScores {
  whatnot: number;
  ebay: number;
  amazon: number;
}

export interface RoutingDisqualifications {
  whatnot: string[];
  ebay: string[];
  amazon: string[];
}

export interface RoutingResult {
  primary: Platform | null;
  secondary: Platform | null;
  scores: RoutingScores;
  disqualifications: RoutingDisqualifications;
  needsReview: boolean;
}

interface RoutingInput {
  brand: string | null;
  category: string | null;
  retailPrice: number | null;
  condition: ItemCondition | null;
  weightOunces: number | null;
  stockQuantity: number;
  upcMatched: boolean;
}

interface BrandStats {
  whatnotCount: number;
  otherPlatformCount: number;
}

export function calculateRouting(
  input: RoutingInput,
  config: RoutingConfig,
  brandStats: BrandStats | null
): RoutingResult {
  const scores: RoutingScores = { whatnot: 50, ebay: 50, amazon: 50 };
  const disqualifications: RoutingDisqualifications = { whatnot: [], ebay: [], amazon: [] };
  
  const highValueBrands = (config.highValueBrands as string[]) || [];
  const blockedAmazonBrands = (config.blockedAmazonBrands as string[]) || [];
  
  const isHighValueBrand = input.brand && 
    highValueBrands.some(b => b.toLowerCase() === input.brand!.toLowerCase());
  
  const isBlockedAmazonBrand = input.brand &&
    blockedAmazonBrands.some(b => b.toLowerCase() === input.brand!.toLowerCase());

  // === HARD RULES (Disqualifications) ===
  
  // Heavy items cannot go to Whatnot
  if (input.weightOunces && input.weightOunces >= config.heavyWeightOunces) {
    disqualifications.whatnot.push(`Too heavy (${(input.weightOunces / 16).toFixed(1)} lbs >= ${(config.heavyWeightOunces / 16).toFixed(1)} lbs limit)`);
  }
  
  // Damaged/parts items cannot go to Amazon
  if (input.condition === "parts_damaged") {
    disqualifications.amazon.push("Parts/damaged condition not allowed on Amazon");
  }
  
  // Blocked brands cannot go to Amazon
  if (isBlockedAmazonBrand) {
    disqualifications.amazon.push(`Brand "${input.brand}" is blocked on Amazon`);
  }

  // === HIGH-VALUE BRAND RATIO CHECK (10:1) ===
  // For every 10 high-value brand items sent to other platforms, 1 can go to Whatnot
  if (isHighValueBrand) {
    const whatnotCount = brandStats?.whatnotCount ?? 0;
    const otherCount = brandStats?.otherPlatformCount ?? 0;
    const allowedWhatnotCount = Math.floor(otherCount / config.whatnotBrandRatio);
    
    if (whatnotCount >= allowedWhatnotCount) {
      disqualifications.whatnot.push(
        `High-value brand quota: need ${config.whatnotBrandRatio} items on other platforms per Whatnot listing (${otherCount} elsewhere, ${allowedWhatnotCount} Whatnot spots available, ${whatnotCount} used)`
      );
    }
  }

  // === SCORING ===
  
  // --- WHATNOT SCORING ---
  // Whatnot favors variety and imperfect inventory
  if (input.condition === "good" || input.condition === "acceptable") {
    scores.whatnot += 15; // Imperfect items do well on Whatnot
  }
  if (input.condition === "parts_damaged") {
    scores.whatnot += 10; // Even parts can sell in live auctions
  }
  // Penalize high-value brands (they underperform live)
  if (isHighValueBrand) {
    scores.whatnot -= 25;
  }
  // Lower price items do better on Whatnot
  if (input.retailPrice && input.retailPrice < 3000) { // Under $30
    scores.whatnot += 10;
  }
  
  // --- EBAY SCORING ---
  // eBay favors searchable, branded, UPC-matched items
  if (input.upcMatched) {
    scores.ebay += 20; // UPC matching is huge for eBay search
  }
  if (input.brand) {
    scores.ebay += 15; // Branded items search well
  }
  // Higher value items do better on eBay
  if (input.retailPrice && input.retailPrice >= 2000) { // $20+
    scores.ebay += 10;
  }
  if (input.retailPrice && input.retailPrice >= 5000) { // $50+
    scores.ebay += 10;
  }
  // Good condition bonus
  if (input.condition === "new" || input.condition === "like_new") {
    scores.ebay += 10;
  }
  
  // --- AMAZON SCORING ---
  // Amazon favors new, brand-safe, repeatable items
  if (input.condition === "new") {
    scores.amazon += 30; // New condition is critical for Amazon
  } else if (input.condition === "like_new") {
    scores.amazon += 10;
  } else {
    scores.amazon -= 20; // Non-new items penalized
  }
  // Repeatability bonus (multiple units)
  if (input.stockQuantity > 1) {
    scores.amazon += 15;
  }
  if (input.stockQuantity >= 5) {
    scores.amazon += 10;
  }
  // Branded items do well
  if (input.brand && !isBlockedAmazonBrand) {
    scores.amazon += 10;
  }
  // Higher value items
  if (input.retailPrice && input.retailPrice >= 2000) {
    scores.amazon += 10;
  }

  // === DETERMINE PRIMARY & SECONDARY ===
  const platforms: Platform[] = ["whatnot", "ebay", "amazon"];
  
  // Filter to only eligible platforms
  const eligible = platforms.filter(p => disqualifications[p].length === 0);
  
  // Sort by score descending
  eligible.sort((a, b) => scores[b] - scores[a]);
  
  const primary = eligible[0] || null;
  const secondary = eligible[1] || null;
  
  // Needs review if all platforms disqualified or no clear winner
  const needsReview = eligible.length === 0 || 
    (eligible.length >= 2 && Math.abs(scores[eligible[0]] - scores[eligible[1]]) < 5);

  return {
    primary,
    secondary,
    scores,
    disqualifications,
    needsReview
  };
}

export function getRoutingInputFromAuction(auction: Partial<Auction>, upcMatched: boolean): RoutingInput {
  return {
    brand: auction.brand || null,
    category: auction.category || null,
    retailPrice: auction.retailPrice || null,
    condition: (auction.condition as ItemCondition) || null,
    weightOunces: auction.weightOunces || null,
    stockQuantity: auction.stockQuantity || 1,
    upcMatched
  };
}
