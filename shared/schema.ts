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
  stripeCustomerId: varchar("stripe_customer_id"),
  stripePaymentMethodId: varchar("stripe_payment_method_id"),
  paymentMethodLast4: varchar("payment_method_last4", { length: 4 }),
  paymentMethodBrand: varchar("payment_method_brand", { length: 20 }),
  paymentStatus: varchar("payment_status", { length: 20 }).default("none"),
  biddingBlocked: integer("bidding_blocked").default(0),
  biddingBlockedReason: varchar("bidding_blocked_reason", { length: 200 }),
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
  ebayStatus: varchar("ebay_status", { length: 20 }),
  batchId: integer("batch_id"),
  scannedByStaffId: integer("scanned_by_staff_id"),
  cost: integer("cost").notNull().default(200), // In cents, default $2
  soldAt: timestamp("sold_at"),
  soldPrice: integer("sold_price"), // In cents
  showOnHomepage: integer("show_on_homepage").notNull().default(0), // 1 = featured on homepage
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertAuctionSchema = createInsertSchema(auctions).omit({
  id: true,
  currentBid: true,
  bidCount: true,
  soldAt: true,
  soldPrice: true,
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

// Clothes inventory table - for Depop and clothing platforms
export const clothesInventory = pgTable("clothes_inventory", {
  id: serial("id").primaryKey(),
  sku: varchar("sku", { length: 20 }).notNull().unique(), // OAC0000001 format
  upc: varchar("upc", { length: 20 }),
  description: text("description"), // Max 1000 chars, max 5 hashtags
  category: varchar("category", { length: 100 }),
  price: integer("price"), // In cents
  brand: varchar("brand", { length: 200 }),
  condition: varchar("condition", { length: 50 }).default("New"),
  size: varchar("size", { length: 50 }),
  color1: varchar("color_1", { length: 50 }),
  color2: varchar("color_2", { length: 50 }),
  source1: varchar("source_1", { length: 100 }).default("Target"),
  source2: varchar("source_2", { length: 100 }),
  age: varchar("age", { length: 50 }),
  style1: varchar("style_1", { length: 100 }),
  style2: varchar("style_2", { length: 100 }),
  style3: varchar("style_3", { length: 100 }),
  location: varchar("location", { length: 200 }),
  pictureHero: varchar("picture_hero", { length: 1000 }),
  picture2: varchar("picture_2", { length: 1000 }),
  picture3: varchar("picture_3", { length: 1000 }),
  picture4: varchar("picture_4", { length: 1000 }),
  picture5: varchar("picture_5", { length: 1000 }),
  picture6: varchar("picture_6", { length: 1000 }),
  picture7: varchar("picture_7", { length: 1000 }),
  picture8: varchar("picture_8", { length: 1000 }),
  domesticShipping: integer("domestic_shipping"), // In cents
  internationalShipping: integer("international_shipping"), // In cents
  shelfId: integer("shelf_id"),
  status: varchar("status", { length: 20 }).notNull().default("draft"),
  lastExportedAt: timestamp("last_exported_at"),
  batchId: integer("batch_id"),
  scannedByStaffId: integer("scanned_by_staff_id"),
  cost: integer("cost").notNull().default(200), // In cents, default $2
  soldAt: timestamp("sold_at"),
  soldPrice: integer("sold_price"), // In cents
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertClothesSchema = createInsertSchema(clothesInventory).omit({
  id: true,
  createdAt: true,
  soldAt: true,
  soldPrice: true,
});
export type InsertClothes = z.infer<typeof insertClothesSchema>;
export type ClothesItem = typeof clothesInventory.$inferSelect;

// Depop category options
export const DEPOP_CATEGORIES = [
  "Tops", "Bottoms", "Dresses", "Outerwear", "Activewear", 
  "Intimates", "Swimwear", "Accessories", "Shoes", "Bags",
  "Jewelry", "Vintage", "Handmade", "Other"
] as const;

// Depop condition options
export const DEPOP_CONDITIONS = [
  "Brand New", "Like New", "Used - Excellent", "Used - Good", "Used - Fair"
] as const;

// Depop size options
export const DEPOP_SIZES = [
  "XXS", "XS", "S", "M", "L", "XL", "XXL", "XXXL",
  "One Size", "0", "2", "4", "6", "8", "10", "12", "14", "16"
] as const;

// Depop color options
export const DEPOP_COLORS = [
  "Black", "White", "Gray", "Red", "Pink", "Orange", "Yellow", 
  "Green", "Blue", "Purple", "Brown", "Cream", "Gold", "Silver", "Multi"
] as const;

// Pending charges table - for daily batch processing
export const pendingCharges = pgTable("pending_charges", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").notNull(),
  auctionId: integer("auction_id"),
  clothesItemId: integer("clothes_item_id"),
  itemType: varchar("item_type", { length: 20 }).notNull(), // 'auction' or 'clothes'
  itemTitle: varchar("item_title", { length: 500 }).notNull(),
  itemImage: varchar("item_image", { length: 1000 }),
  amount: integer("amount").notNull(), // In cents
  shippingAmount: integer("shipping_amount").default(0), // In cents
  status: varchar("status", { length: 20 }).notNull().default("pending"), // pending, processed, failed, refunded
  failureReason: varchar("failure_reason", { length: 500 }),
  retryCount: integer("retry_count").default(0),
  processedAt: timestamp("processed_at"),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("IDX_pending_charges_status").on(table.status),
  index("IDX_pending_charges_user").on(table.userId),
]);

export const insertPendingChargeSchema = createInsertSchema(pendingCharges).omit({
  id: true,
  processedAt: true,
  createdAt: true,
});
export type InsertPendingCharge = z.infer<typeof insertPendingChargeSchema>;
export type PendingCharge = typeof pendingCharges.$inferSelect;

// Payment history table - completed transactions
export const paymentHistory = pgTable("payment_history", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").notNull(),
  stripePaymentIntentId: varchar("stripe_payment_intent_id"),
  amount: integer("amount").notNull(), // Total in cents
  itemCount: integer("item_count").notNull().default(1),
  status: varchar("status", { length: 20 }).notNull(), // succeeded, failed, refunded
  failureReason: varchar("failure_reason", { length: 500 }),
  chargeIds: jsonb("charge_ids"), // Array of pending_charge IDs included
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("IDX_payment_history_user").on(table.userId),
  index("IDX_payment_history_status").on(table.status),
]);

export const insertPaymentHistorySchema = createInsertSchema(paymentHistory).omit({
  id: true,
  createdAt: true,
});
export type InsertPaymentHistory = z.infer<typeof insertPaymentHistorySchema>;
export type PaymentHistory = typeof paymentHistory.$inferSelect;

// Payment status options
export const PAYMENT_STATUS_OPTIONS = ["none", "active", "failed", "blocked"] as const;
export type PaymentStatus = typeof PAYMENT_STATUS_OPTIONS[number];

// Charge status options
export const CHARGE_STATUS_OPTIONS = ["pending", "processed", "failed", "refunded"] as const;
export type ChargeStatus = typeof CHARGE_STATUS_OPTIONS[number];

// Staff table - employee tracking
export const staff = pgTable("staff", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 100 }).notNull(),
  pinCode: varchar("pin_code", { length: 4 }).notNull().unique(),
  dailyScanGoal: integer("daily_scan_goal").default(50),
  active: integer("active").notNull().default(1),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertStaffSchema = createInsertSchema(staff).omit({
  id: true,
  createdAt: true,
});
export type InsertStaff = z.infer<typeof insertStaffSchema>;
export type Staff = typeof staff.$inferSelect;

// Staff shifts table - clock in/out tracking
export const staffShifts = pgTable("staff_shifts", {
  id: serial("id").primaryKey(),
  staffId: integer("staff_id").notNull(),
  clockIn: timestamp("clock_in").notNull().defaultNow(),
  clockOut: timestamp("clock_out"),
  itemsScanned: integer("items_scanned").notNull().default(0),
}, (table) => [
  index("IDX_staff_shifts_staff").on(table.staffId),
  index("IDX_staff_shifts_clock_in").on(table.clockIn),
]);

export const insertStaffShiftSchema = createInsertSchema(staffShifts).omit({
  id: true,
});
export type InsertStaffShift = z.infer<typeof insertStaffShiftSchema>;
export type StaffShift = typeof staffShifts.$inferSelect;

// Batches table - inventory batches for tracking
export const batches = pgTable("batches", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 100 }).notNull(),
  totalItems: integer("total_items").notNull().default(0),
  soldItems: integer("sold_items").notNull().default(0),
  totalCost: integer("total_cost").notNull().default(0), // In cents
  totalRevenue: integer("total_revenue").notNull().default(0), // In cents
  active: integer("active").notNull().default(1),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertBatchSchema = createInsertSchema(batches).omit({
  id: true,
  totalItems: true,
  soldItems: true,
  totalCost: true,
  totalRevenue: true,
  createdAt: true,
});
export type InsertBatch = z.infer<typeof insertBatchSchema>;
export type Batch = typeof batches.$inferSelect;
