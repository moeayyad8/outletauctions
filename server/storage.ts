import { users, bids, watchlist, auctions, type User, type UpsertUser, type Bid, type InsertBid, type Watchlist, type InsertWatchlist, type Auction, type InsertAuction } from "@shared/schema";
import { db } from "./db";
import { eq, desc, and, like } from "drizzle-orm";

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
    const [newAuction] = await db.insert(auctions).values(auction).returning();
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
      .select({ upc: auctions.upc })
      .from(auctions)
      .where(like(auctions.upc, 'OA%'));
    
    let maxNumber = 0;
    for (const auction of oaAuctions) {
      if (auction.upc) {
        const numPart = auction.upc.replace('OA', '');
        const num = parseInt(numPart, 10);
        if (!isNaN(num) && num > maxNumber) {
          maxNumber = num;
        }
      }
    }
    
    const nextNumber = maxNumber + 1;
    return `OA${nextNumber.toString().padStart(9, '0')}`;
  }
}

export const storage = new DatabaseStorage();
