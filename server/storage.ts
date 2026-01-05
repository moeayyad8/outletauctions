import { users, bids, watchlist, auctions, tags, auctionTags, type User, type UpsertUser, type Bid, type InsertBid, type Watchlist, type InsertWatchlist, type Auction, type InsertAuction, type Tag, type InsertTag, type AuctionTag } from "@shared/schema";
import { db } from "./db";
import { eq, desc, and, like, inArray } from "drizzle-orm";

export interface IStorage {
  getUser(id: string): Promise<User | undefined>;
  upsertUser(user: UpsertUser): Promise<User>;
  createBid(bid: InsertBid): Promise<Bid>;
  getUserBids(userId: string): Promise<Bid[]>;
  getUserWatchlist(userId: string): Promise<Watchlist[]>;
  addToWatchlist(item: InsertWatchlist): Promise<Watchlist>;
  removeFromWatchlist(userId: string, auctionId: number): Promise<void>;
  createAuction(auction: InsertAuction): Promise<Auction>;
  getAllAuctions(): Promise<Auction[]>;
  getAuction(id: number): Promise<Auction | undefined>;
  getNextInternalCode(): Promise<string>;
  getAllTags(): Promise<Tag[]>;
  getTagsByType(type: string): Promise<Tag[]>;
  createTag(tag: InsertTag): Promise<Tag>;
  attachTagsToAuction(auctionId: number, tagIds: number[]): Promise<void>;
  getAuctionTags(auctionId: number): Promise<Tag[]>;
  searchAuctionsByTags(tagIds: number[]): Promise<Auction[]>;
  deleteAuction(id: number): Promise<void>;
}

export class DatabaseStorage implements IStorage {
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async upsertUser(userData: UpsertUser): Promise<User> {
    const [user] = await db
      .insert(users)
      .values(userData)
      .onConflictDoUpdate({
        target: users.email,
        set: {
          firstName: userData.firstName,
          lastName: userData.lastName,
          profileImageUrl: userData.profileImageUrl,
          updatedAt: new Date(),
        },
      })
      .returning();
    return user;
  }

  async createBid(bid: InsertBid): Promise<Bid> {
    const [newBid] = await db.insert(bids).values(bid).returning();
    return newBid;
  }

  async getUserBids(userId: string): Promise<Bid[]> {
    return db.select().from(bids).where(eq(bids.userId, userId)).orderBy(desc(bids.createdAt));
  }

  async getUserWatchlist(userId: string): Promise<Watchlist[]> {
    return db.select().from(watchlist).where(eq(watchlist.userId, userId)).orderBy(desc(watchlist.createdAt));
  }

  async addToWatchlist(item: InsertWatchlist): Promise<Watchlist> {
    const [newItem] = await db.insert(watchlist).values(item).returning();
    return newItem;
  }

  async removeFromWatchlist(userId: string, auctionId: number): Promise<void> {
    await db.delete(watchlist).where(and(eq(watchlist.userId, userId), eq(watchlist.auctionId, auctionId)));
  }

  async createAuction(auction: InsertAuction): Promise<Auction> {
    const internalCode = await this.getNextInternalCode();
    const [newAuction] = await db.insert(auctions).values({
      ...auction,
      internalCode,
    }).returning();
    return newAuction;
  }

  async getAllAuctions(): Promise<Auction[]> {
    return db.select().from(auctions).orderBy(desc(auctions.createdAt));
  }

  async getAuction(id: number): Promise<Auction | undefined> {
    const [auction] = await db.select().from(auctions).where(eq(auctions.id, id));
    return auction;
  }

  async getNextInternalCode(): Promise<string> {
    const oaAuctions = await db
      .select({ internalCode: auctions.internalCode })
      .from(auctions)
      .where(like(auctions.internalCode, 'OA%'));
    
    let maxNumber = 0;
    for (const auction of oaAuctions) {
      if (auction.internalCode) {
        const numPart = auction.internalCode.replace('OA', '');
        const num = parseInt(numPart, 10);
        if (!isNaN(num) && num > maxNumber) {
          maxNumber = num;
        }
      }
    }
    
    const nextNumber = maxNumber + 1;
    return `OA${nextNumber.toString().padStart(9, '0')}`;
  }

  async getAllTags(): Promise<Tag[]> {
    return db.select().from(tags).orderBy(tags.type, tags.name);
  }

  async getTagsByType(type: string): Promise<Tag[]> {
    return db.select().from(tags).where(eq(tags.type, type)).orderBy(tags.name);
  }

  async createTag(tag: InsertTag): Promise<Tag> {
    const [newTag] = await db.insert(tags).values(tag).returning();
    return newTag;
  }

  async attachTagsToAuction(auctionId: number, tagIds: number[]): Promise<void> {
    if (tagIds.length === 0) return;
    const values = tagIds.map(tagId => ({ auctionId, tagId }));
    await db.insert(auctionTags).values(values);
  }

  async getAuctionTags(auctionId: number): Promise<Tag[]> {
    const result = await db
      .select({ tag: tags })
      .from(auctionTags)
      .innerJoin(tags, eq(auctionTags.tagId, tags.id))
      .where(eq(auctionTags.auctionId, auctionId));
    return result.map(r => r.tag);
  }

  async searchAuctionsByTags(tagIds: number[]): Promise<Auction[]> {
    if (tagIds.length === 0) return [];
    const auctionIdsResult = await db
      .select({ auctionId: auctionTags.auctionId })
      .from(auctionTags)
      .where(inArray(auctionTags.tagId, tagIds));
    
    const auctionIds = [...new Set(auctionIdsResult.map(r => r.auctionId))];
    if (auctionIds.length === 0) return [];
    
    return db.select().from(auctions).where(inArray(auctions.id, auctionIds));
  }

  async deleteAuction(id: number): Promise<void> {
    await db.delete(auctionTags).where(eq(auctionTags.auctionId, id));
    await db.delete(bids).where(eq(bids.auctionId, id));
    await db.delete(watchlist).where(eq(watchlist.auctionId, id));
    await db.delete(auctions).where(eq(auctions.id, id));
  }
}

export const storage = new DatabaseStorage();
