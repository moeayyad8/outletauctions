import { sql } from "drizzle-orm";
import {
  index,
  integer,
  jsonb,
  pgTable,
  serial,
  timestamp,
  varchar,
  text,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Session storage table - required for Replit Auth
export const sessions = pgTable(
  "sessions",
  {
    sid: varchar("sid").primaryKey(),
    sess: jsonb("sess").notNull(),
    expire: timestamp("expire").notNull(),
  },
  (table) => [index("IDX_session_expire").on(table.expire)],
);

// User storage table - required for Replit Auth
export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  email: varchar("email").unique(),
  firstName: varchar("first_name"),
  lastName: varchar("last_name"),
  profileImageUrl: varchar("profile_image_url"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export type UpsertUser = typeof users.$inferInsert;
export type User = typeof users.$inferSelect;

// Bids table
export const bids = pgTable("bids", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull(),
  auctionId: integer("auction_id").notNull(),
  amount: integer("amount").notNull(),
  auctionTitle: varchar("auction_title").notNull(),
  auctionImage: varchar("auction_image"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertBidSchema = createInsertSchema(bids).omit({
  id: true,
  createdAt: true,
}).extend({
  amount: z.number().positive('Bid amount must be greater than 0'),
});
export type InsertBid = z.infer<typeof insertBidSchema>;
export type Bid = typeof bids.$inferSelect;

// Watchlist table
export const watchlist = pgTable("watchlist", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull(),
  auctionId: integer("auction_id").notNull(),
  auctionTitle: varchar("auction_title").notNull(),
  auctionImage: varchar("auction_image"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertWatchlistSchema = createInsertSchema(watchlist).omit({
  id: true,
  createdAt: true,
});
export type InsertWatchlist = z.infer<typeof insertWatchlistSchema>;
export type Watchlist = typeof watchlist.$inferSelect;

// Auctions table - platform inventory
export const auctions = pgTable("auctions", {
  id: serial("id").primaryKey(),
  internalCode: varchar("internal_code", { length: 20 }),
  upc: varchar("upc", { length: 20 }),
  title: varchar("title", { length: 500 }).notNull(),
  description: text("description"),
  image: varchar("image", { length: 1000 }),
  brand: varchar("brand", { length: 200 }),
  category: varchar("category", { length: 200 }),
  retailPrice: integer("retail_price"),
  startingBid: integer("starting_bid").notNull().default(1),
  currentBid: integer("current_bid").notNull().default(0),
  bidCount: integer("bid_count").notNull().default(0),
  endTime: timestamp("end_time"),
  status: varchar("status", { length: 20 }).notNull().default("draft"),
  destination: varchar("destination", { length: 20 }).notNull().default("auction"),
  externalStatus: varchar("external_status", { length: 20 }),
  externalListingId: varchar("external_listing_id", { length: 100 }),
  externalListingUrl: varchar("external_listing_url", { length: 500 }),
  externalPayload: jsonb("external_payload"),
  lastSyncAt: timestamp("last_sync_at"),
  shelfId: integer("shelf_id"),
  condition: varchar("condition", { length: 20 }),
  weightOunces: integer("weight_ounces"),
  weightClass: varchar("weight_class", { length: 20 }),
  brandTier: varchar("brand_tier", { length: 5 }),
  stockQuantity: integer("stock_quantity").notNull().default(1),
  routingPrimary: varchar("routing_primary", { length: 20 }),
  routingSecondary: varchar("routing_secondary", { length: 20 }),
  routingScores: jsonb("routing_scores"),
  routingDisqualifications: jsonb("routing_disqualifications"),
  needsReview: integer("needs_review").notNull().default(0),
  lastExportedAt: timestamp("last_exported_at"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertAuctionSchema = createInsertSchema(auctions).omit({
  id: true,
  currentBid: true,
  bidCount: true,
  createdAt: true,
});
export type InsertAuction = z.infer<typeof insertAuctionSchema>;
export type Auction = typeof auctions.$inferSelect;

// Tags table - for categorization and location tracking
export const tags = pgTable("tags", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 100 }).notNull(),
  type: varchar("type", { length: 20 }).notNull(), // 'location' or 'category'
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [index("IDX_tag_type").on(table.type)]);

export const insertTagSchema = createInsertSchema(tags).omit({
  id: true,
  createdAt: true,
});
export type InsertTag = z.infer<typeof insertTagSchema>;
export type Tag = typeof tags.$inferSelect;

// Auction-Tag join table
export const auctionTags = pgTable("auction_tags", {
  id: serial("id").primaryKey(),
  auctionId: integer("auction_id").notNull(),
  tagId: integer("tag_id").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertAuctionTagSchema = createInsertSchema(auctionTags).omit({
  id: true,
  createdAt: true,
});
export type InsertAuctionTag = z.infer<typeof insertAuctionTagSchema>;
export type AuctionTag = typeof auctionTags.$inferSelect;

// Shelves table - physical storage locations
export const shelves = pgTable("shelves", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 50 }).notNull(),
  code: varchar("code", { length: 10 }).notNull().unique(),
  itemCount: integer("item_count").notNull().default(0),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertShelfSchema = createInsertSchema(shelves).omit({
  id: true,
  itemCount: true,
  createdAt: true,
});
export type InsertShelf = z.infer<typeof insertShelfSchema>;
export type Shelf = typeof shelves.$inferSelect;

// Routing configuration table
export const routingConfig = pgTable("routing_config", {
  id: serial("id").primaryKey(),
  heavyWeightOunces: integer("heavy_weight_ounces").notNull().default(238),
  highValueBrands: jsonb("high_value_brands").notNull().default(sql`'["LEGO", "Nike", "Apple", "Sony", "Nintendo"]'::jsonb`),
  blockedAmazonBrands: jsonb("blocked_amazon_brands").notNull().default(sql`'[]'::jsonb`),
  whatnotBrandRatio: integer("whatnot_brand_ratio").notNull().default(10),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export type RoutingConfig = typeof routingConfig.$inferSelect;

// Brand routing stats for 10:1 ratio tracking
export const brandRoutingStats = pgTable("brand_routing_stats", {
  id: serial("id").primaryKey(),
  brand: varchar("brand", { length: 200 }).notNull().unique(),
  whatnotCount: integer("whatnot_count").notNull().default(0),
  otherPlatformCount: integer("other_platform_count").notNull().default(0),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export type BrandRoutingStat = typeof brandRoutingStats.$inferSelect;

// Condition options for items
export const CONDITION_OPTIONS = [
  "new",
  "like_new", 
  "good",
  "acceptable",
  "parts_damaged"
] as const;

export type ItemCondition = typeof CONDITION_OPTIONS[number];

// Brand Tier options (human-selected, not UPC-derived)
// A = Premium brands (Nike, Adidas, LEGO, Apple) - penalized on Whatnot, forced to bundle
// B = Recognizable name brands (Febreze, Mr Clean, Sharpie)  
// C = Private label/white label (Amazon Basics, unbranded) - BLOCKED on Amazon
export const BRAND_TIER_OPTIONS = ["A", "B", "C"] as const;
export type BrandTier = typeof BRAND_TIER_OPTIONS[number];

// Weight class options
export const WEIGHT_CLASS_OPTIONS = ["light", "medium", "heavy"] as const;
export type WeightClass = typeof WEIGHT_CLASS_OPTIONS[number];

// Platform options
export const PLATFORM_OPTIONS = ["whatnot", "ebay", "amazon"] as const;
export type Platform = typeof PLATFORM_OPTIONS[number];
