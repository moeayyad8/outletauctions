import type { Auction, RoutingConfig, BrandRoutingStat, Platform, ItemCondition, BrandTier, WeightClass } from "@shared/schema";

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
  missingRequiredFields: string[];
}

export interface RoutingInput {
  brandTier: BrandTier | null;
  weightClass: WeightClass | null;
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
  const missingRequiredFields: string[] = [];
  
  // === CHECK REQUIRED FIELDS ===
  // Brand Tier, Condition, and Weight Class must ALL be set before scoring runs
  if (!input.brandTier) {
    missingRequiredFields.push("Brand Tier");
  }
  if (!input.condition) {
    missingRequiredFields.push("Condition");
  }
  if (!input.weightClass) {
    missingRequiredFields.push("Weight Class");
  }
  
  // If required fields are missing, return early with no routing
  if (missingRequiredFields.length > 0) {
    return {
      primary: null,
      secondary: null,
      scores,
      disqualifications,
      needsReview: true,
      missingRequiredFields
    };
  }

  // === HARD RULES (Disqualifications) ===
  
  // Heavy items (weight class = heavy) cannot go to Whatnot
  if (input.weightClass === "heavy") {
    disqualifications.whatnot.push("Heavy items cannot be shipped via Whatnot");
  }
  
  // Damaged/parts items cannot go to Amazon
  if (input.condition === "parts_damaged") {
    disqualifications.amazon.push("Parts/damaged condition not allowed on Amazon");
  }
  
  // Tier C (private label/white label) items BLOCKED on Amazon
  if (input.brandTier === "C") {
    disqualifications.amazon.push("Tier C (private label) items not allowed on Amazon");
  }

  // === TIER A BRAND RATIO CHECK (10:1) ===
  // For every 10 Tier A items sent to other platforms, 1 can go to Whatnot
  if (input.brandTier === "A") {
    const whatnotCount = brandStats?.whatnotCount ?? 0;
    const otherCount = brandStats?.otherPlatformCount ?? 0;
    const allowedWhatnotCount = Math.floor(otherCount / config.whatnotBrandRatio);
    
    if (whatnotCount >= allowedWhatnotCount) {
      disqualifications.whatnot.push(
        `Premium brand quota: need ${config.whatnotBrandRatio} items on other platforms per Whatnot listing (${otherCount} elsewhere, ${allowedWhatnotCount} Whatnot spots available, ${whatnotCount} used)`
      );
    }
  }

  // === SCORING BASED ON BRAND TIER ===
  
  // --- WHATNOT SCORING ---
  // Whatnot favors variety and imperfect inventory
  if (input.condition === "good" || input.condition === "acceptable") {
    scores.whatnot += 15; // Imperfect items do well on Whatnot
  }
  if (input.condition === "parts_damaged") {
    scores.whatnot += 10; // Even parts can sell in live auctions
  }
  // Tier A (premium brands) are penalized on Whatnot - they underperform live
  if (input.brandTier === "A") {
    scores.whatnot -= 25;
  }
  // Tier B and C do well on Whatnot
  if (input.brandTier === "B") {
    scores.whatnot += 5;
  }
  if (input.brandTier === "C") {
    scores.whatnot += 15; // Private label does great on Whatnot
  }
  // Lower price items do better on Whatnot
  if (input.retailPrice && input.retailPrice < 3000) { // Under $30
    scores.whatnot += 10;
  }
  // Light items preferred for Whatnot shipping
  if (input.weightClass === "light") {
    scores.whatnot += 10;
  }
  
  // --- EBAY SCORING ---
  // eBay favors searchable, branded items
  if (input.upcMatched) {
    scores.ebay += 20; // UPC matching is huge for eBay search
  }
  // Tier A and B brands search well on eBay
  if (input.brandTier === "A") {
    scores.ebay += 20; // Premium brands excel on eBay
  }
  if (input.brandTier === "B") {
    scores.ebay += 15; // Recognizable brands do well
  }
  if (input.brandTier === "C") {
    scores.ebay += 5; // Private label still okay
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
  // Tier A brands do best on Amazon
  if (input.brandTier === "A") {
    scores.amazon += 20;
  }
  if (input.brandTier === "B") {
    scores.amazon += 10;
  }
  // Tier C already disqualified above
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
    needsReview,
    missingRequiredFields: []
  };
}

export function getRoutingInputFromAuction(auction: Partial<Auction>, upcMatched: boolean): RoutingInput {
  return {
    brandTier: (auction.brandTier as BrandTier) || null,
    weightClass: (auction.weightClass as WeightClass) || null,
    category: auction.category || null,
    retailPrice: auction.retailPrice || null,
    condition: (auction.condition as ItemCondition) || null,
    weightOunces: auction.weightOunces || null,
    stockQuantity: auction.stockQuantity || 1,
    upcMatched
  };
}
