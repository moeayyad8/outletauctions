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
  upc: varchar("upc", { length: 20 }),
  title: varchar("title", { length: 500 }).notNull(),
  description: text("description"),
  image: varchar("image", { length: 1000 }),
  retailPrice: integer("retail_price"),
  startingBid: integer("starting_bid").notNull().default(1),
  currentBid: integer("current_bid").notNull().default(0),
  bidCount: integer("bid_count").notNull().default(0),
  endTime: timestamp("end_time"),
  status: varchar("status", { length: 20 }).notNull().default("draft"),
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
