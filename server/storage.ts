import { users, bids, watchlist, auctions, tags, auctionTags, shelves, routingConfig, brandRoutingStats, clothesInventory, pendingCharges, paymentHistory, staff, staffShifts, batches, type User, type UpsertUser, type Bid, type InsertBid, type Watchlist, type InsertWatchlist, type Auction, type InsertAuction, type Tag, type InsertTag, type AuctionTag, type Shelf, type InsertShelf, type RoutingConfig, type BrandRoutingStat, type ClothesItem, type InsertClothes, type PendingCharge, type InsertPendingCharge, type PaymentHistory, type InsertPaymentHistory, type Staff, type InsertStaff, type StaffShift, type InsertStaffShift, type Batch, type InsertBatch } from "@shared/schema";
import { db } from "./db";
import { eq, desc, and, like, inArray, sql, gte, lte, isNull } from "drizzle-orm";

export interface IStorage {
  getUser(id: string): Promise<User | undefined>;
  upsertUser(user: UpsertUser): Promise<User>;
  createBid(bid: InsertBid): Promise<Bid>;
  getUserBids(userId: string): Promise<Bid[]>;
  getUserWatchlist(userId: string): Promise<Watchlist[]>;
  addToWatchlist(item: InsertWatchlist): Promise<Watchlist>;
  removeFromWatchlist(userId: string, auctionId: number): Promise<void>;
  createAuction(auction: InsertAuction): Promise<Auction>;
  importAuction(auction: InsertAuction & { internalCode?: string }): Promise<Auction>;
  getAllAuctions(): Promise<Auction[]>;
  getActiveAuctions(): Promise<Auction[]>;
  getHomepageAuctions(): Promise<Auction[]>;
  getAuction(id: number): Promise<Auction | undefined>;
  updateAuctionStatus(id: number, status: string, endTime?: Date): Promise<Auction | undefined>;
  updateAuctionExternal(id: number, destination: string, externalStatus: string, externalListingId: string, externalListingUrl: string, externalPayload: unknown): Promise<Auction | undefined>;
  getNextInternalCode(): Promise<string>;
  getAllTags(): Promise<Tag[]>;
  getTagsByType(type: string): Promise<Tag[]>;
  createTag(tag: InsertTag): Promise<Tag>;
  attachTagsToAuction(auctionId: number, tagIds: number[]): Promise<void>;
  getAuctionTags(auctionId: number): Promise<Tag[]>;
  searchAuctionsByTags(tagIds: number[]): Promise<Auction[]>;
  deleteAuction(id: number): Promise<void>;
  getAllShelves(): Promise<Shelf[]>;
  getShelf(id: number): Promise<Shelf | undefined>;
  getShelfByCode(code: string): Promise<Shelf | undefined>;
  createShelf(shelf: InsertShelf): Promise<Shelf>;
  updateAuctionShelf(auctionId: number, shelfId: number | null): Promise<Auction | undefined>;
  seedShelves(): Promise<void>;
  getRoutingConfig(): Promise<RoutingConfig>;
  seedRoutingConfig(): Promise<void>;
  getBrandRoutingStats(brand: string): Promise<BrandRoutingStat | undefined>;
  incrementBrandRoutingStats(brand: string, platform: 'whatnot' | 'other'): Promise<void>;
  updateAuctionRouting(id: number, data: {
    condition?: string | null;
    weightOunces?: number | null;
    stockQuantity?: number;
    routingPrimary?: string | null;
    routingSecondary?: string | null;
    routingScores?: unknown;
    routingDisqualifications?: unknown;
    needsReview?: number;
  }): Promise<Auction | undefined>;
  markAuctionsExported(ids: number[]): Promise<void>;
  markAuctionsListed(ids: number[]): Promise<void>;
  // Clothes inventory
  createClothesItem(item: InsertClothes): Promise<ClothesItem>;
  getAllClothesItems(): Promise<ClothesItem[]>;
  getClothesItem(id: number): Promise<ClothesItem | undefined>;
  updateClothesItem(id: number, data: Partial<InsertClothes>): Promise<ClothesItem | undefined>;
  deleteClothesItem(id: number): Promise<void>;
  getNextClothesSku(): Promise<string>;
  markClothesExported(ids: number[]): Promise<void>;
  // Payment methods
  updateUserStripeInfo(userId: string, data: {
    stripeCustomerId?: string;
    stripePaymentMethodId?: string | null;
    paymentMethodLast4?: string | null;
    paymentMethodBrand?: string | null;
    paymentStatus?: string;
    biddingBlocked?: number;
    biddingBlockedReason?: string | null;
  }): Promise<User | undefined>;
  // Pending charges
  createPendingCharge(charge: InsertPendingCharge): Promise<PendingCharge>;
  getUserPendingCharges(userId: string): Promise<PendingCharge[]>;
  getAllPendingCharges(): Promise<PendingCharge[]>;
  updatePendingChargeStatus(id: number, status: string, failureReason?: string): Promise<PendingCharge | undefined>;
  // Payment history
  createPaymentHistory(payment: InsertPaymentHistory): Promise<PaymentHistory>;
  getUserPaymentHistory(userId: string): Promise<PaymentHistory[]>;
  // User queries for batch processing
  getUsersWithPendingCharges(): Promise<User[]>;
  // Staff management
  getAllStaff(): Promise<Staff[]>;
  getActiveStaff(): Promise<Staff[]>;
  getStaff(id: number): Promise<Staff | undefined>;
  getStaffByPin(pin: string): Promise<Staff | undefined>;
  createStaff(staffData: InsertStaff): Promise<Staff>;
  updateStaff(id: number, data: Partial<InsertStaff>): Promise<Staff | undefined>;
  deactivateStaff(id: number): Promise<Staff | undefined>;
  // Staff shifts
  clockIn(staffId: number): Promise<StaffShift>;
  clockOut(shiftId: number): Promise<StaffShift | undefined>;
  getActiveShift(staffId: number): Promise<StaffShift | undefined>;
  getStaffShifts(staffId: number, startDate?: Date, endDate?: Date): Promise<StaffShift[]>;
  incrementShiftScans(shiftId: number): Promise<void>;
  // Batches
  getAllBatches(): Promise<Batch[]>;
  getActiveBatch(): Promise<Batch | undefined>;
  getBatch(id: number): Promise<Batch | undefined>;
  createBatch(batch: InsertBatch): Promise<Batch>;
  updateBatch(id: number, data: Partial<InsertBatch>): Promise<Batch | undefined>;
  deactivateBatch(id: number): Promise<Batch | undefined>;
  incrementBatchItems(batchId: number, cost: number): Promise<void>;
  incrementBatchSold(batchId: number, revenue: number): Promise<void>;
  // Analytics
  getStaffScanStats(staffId: number, startDate?: Date, endDate?: Date): Promise<{ totalScans: number; totalHours: number }>;
  getBatchStats(): Promise<{ id: number; name: string; totalItems: number; soldItems: number; sellThrough: number; roi: number }[]>;
  getInventoryAging(): Promise<{ range: string; count: number }[]>;
  getCategoryPerformance(): Promise<{ category: string; listed: number; sold: number; sellThrough: number }[]>;
  // Item cost updates
  updateAuctionCost(id: number, cost: number): Promise<Auction | undefined>;
  updateClothesCost(id: number, cost: number): Promise<ClothesItem | undefined>;
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

  // Import auction with existing internal code (for data migration)
  async importAuction(auction: InsertAuction & { internalCode?: string }): Promise<Auction> {
    const [newAuction] = await db.insert(auctions).values({
      ...auction,
      internalCode: auction.internalCode || await this.getNextInternalCode(),
    }).returning();
    return newAuction;
  }

  async getAllAuctions(): Promise<Auction[]> {
    return db.select().from(auctions).orderBy(desc(auctions.createdAt));
  }

  async getActiveAuctions(): Promise<Auction[]> {
    return db.select().from(auctions).where(eq(auctions.status, 'active')).orderBy(desc(auctions.createdAt));
  }

  async getHomepageAuctions(): Promise<Auction[]> {
    return db.select().from(auctions)
      .where(and(eq(auctions.status, 'active'), eq(auctions.showOnHomepage, 1)))
      .orderBy(auctions.endTime);
  }

  async getAuction(id: number): Promise<Auction | undefined> {
    const [auction] = await db.select().from(auctions).where(eq(auctions.id, id));
    return auction;
  }

  async updateAuctionStatus(id: number, status: string, endTime?: Date): Promise<Auction | undefined> {
    const updateData: { status: string; endTime?: Date } = { status };
    if (endTime) {
      updateData.endTime = endTime;
    }
    const [updated] = await db.update(auctions).set(updateData).where(eq(auctions.id, id)).returning();
    return updated;
  }

  async updateAuctionExternal(
    id: number,
    destination: string,
    externalStatus: string,
    externalListingId: string,
    externalListingUrl: string,
    externalPayload: unknown
  ): Promise<Auction | undefined> {
    const [updated] = await db
      .update(auctions)
      .set({
        destination,
        externalStatus,
        externalListingId,
        externalListingUrl,
        externalPayload,
        lastSyncAt: new Date(),
      })
      .where(eq(auctions.id, id))
      .returning();
    return updated;
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
    
    const auctionIds = Array.from(new Set(auctionIdsResult.map(r => r.auctionId)));
    if (auctionIds.length === 0) return [];
    
    return db.select().from(auctions).where(inArray(auctions.id, auctionIds));
  }

  async deleteAuction(id: number): Promise<void> {
    await db.delete(auctionTags).where(eq(auctionTags.auctionId, id));
    await db.delete(bids).where(eq(bids.auctionId, id));
    await db.delete(watchlist).where(eq(watchlist.auctionId, id));
    await db.delete(auctions).where(eq(auctions.id, id));
  }

  async getAllShelves(): Promise<Shelf[]> {
    return db.select().from(shelves).orderBy(shelves.id);
  }

  async getShelf(id: number): Promise<Shelf | undefined> {
    const [shelf] = await db.select().from(shelves).where(eq(shelves.id, id));
    return shelf;
  }

  async createShelf(shelf: InsertShelf): Promise<Shelf> {
    const [newShelf] = await db.insert(shelves).values(shelf).returning();
    return newShelf;
  }

  async updateAuctionShelf(auctionId: number, shelfId: number | null): Promise<Auction | undefined> {
    const [updated] = await db.update(auctions).set({ shelfId }).where(eq(auctions.id, auctionId)).returning();
    return updated;
  }

  async seedShelves(): Promise<void> {
    const existingShelves = await this.getAllShelves();
    
    if (existingShelves.length > 0) {
      // Update existing shelves to new OASXX format if needed
      for (const shelf of existingShelves) {
        if (!shelf.code.startsWith('OAS')) {
          const num = shelf.id;
          const newCode = `OAS${num.toString().padStart(2, '0')}`;
          await db.update(shelves).set({ code: newCode }).where(eq(shelves.id, shelf.id));
        }
      }
      return;
    }
    
    const shelfData: InsertShelf[] = [];
    for (let i = 1; i <= 32; i++) {
      shelfData.push({
        name: `Shelf ${i}`,
        code: `OAS${i.toString().padStart(2, '0')}`,
      });
    }
    await db.insert(shelves).values(shelfData);
  }
  
  async getShelfByCode(code: string): Promise<Shelf | undefined> {
    const [shelf] = await db.select().from(shelves).where(eq(shelves.code, code));
    return shelf;
  }

  async getRoutingConfig(): Promise<RoutingConfig> {
    const [config] = await db.select().from(routingConfig).limit(1);
    if (!config) {
      await this.seedRoutingConfig();
      const [newConfig] = await db.select().from(routingConfig).limit(1);
      return newConfig;
    }
    return config;
  }

  async seedRoutingConfig(): Promise<void> {
    const existing = await db.select().from(routingConfig).limit(1);
    if (existing.length === 0) {
      await db.insert(routingConfig).values({
        heavyWeightOunces: 238,
        highValueBrands: ["LEGO", "Nike", "Apple", "Sony", "Nintendo"],
        blockedAmazonBrands: [],
        whatnotBrandRatio: 10,
      });
    }
  }

  async getBrandRoutingStats(brand: string): Promise<BrandRoutingStat | undefined> {
    const normalizedBrand = brand.toLowerCase();
    const [stats] = await db.select().from(brandRoutingStats).where(
      sql`LOWER(${brandRoutingStats.brand}) = ${normalizedBrand}`
    );
    return stats;
  }

  async incrementBrandRoutingStats(brand: string, platform: 'whatnot' | 'other'): Promise<void> {
    const existing = await this.getBrandRoutingStats(brand);
    if (existing) {
      if (platform === 'whatnot') {
        await db.update(brandRoutingStats).set({
          whatnotCount: existing.whatnotCount + 1,
          updatedAt: new Date(),
        }).where(eq(brandRoutingStats.id, existing.id));
      } else {
        await db.update(brandRoutingStats).set({
          otherPlatformCount: existing.otherPlatformCount + 1,
          updatedAt: new Date(),
        }).where(eq(brandRoutingStats.id, existing.id));
      }
    } else {
      await db.insert(brandRoutingStats).values({
        brand,
        whatnotCount: platform === 'whatnot' ? 1 : 0,
        otherPlatformCount: platform === 'other' ? 1 : 0,
      });
    }
  }

  async updateAuctionRouting(id: number, data: {
    condition?: string | null;
    weightOunces?: number | null;
    stockQuantity?: number;
    routingPrimary?: string | null;
    routingSecondary?: string | null;
    routingScores?: unknown;
    routingDisqualifications?: unknown;
    needsReview?: number;
  }): Promise<Auction | undefined> {
    const [updated] = await db.update(auctions).set(data).where(eq(auctions.id, id)).returning();
    return updated;
  }

  async markAuctionsExported(ids: number[]): Promise<void> {
    if (ids.length === 0) return;
    await db.update(auctions)
      .set({ lastExportedAt: new Date(), ebayStatus: 'exported' })
      .where(inArray(auctions.id, ids));
  }

  async markAuctionsListed(ids: number[]): Promise<void> {
    if (ids.length === 0) return;
    await db.update(auctions)
      .set({ ebayStatus: 'listed' })
      .where(inArray(auctions.id, ids));
  }

  // Clothes inventory methods
  async getNextClothesSku(): Promise<string> {
    const [result] = await db.select({ sku: clothesInventory.sku })
      .from(clothesInventory)
      .orderBy(desc(clothesInventory.id))
      .limit(1);
    
    if (!result) {
      return 'OAC0000001';
    }
    
    const currentNumber = parseInt(result.sku.replace('OAC', ''), 10);
    const nextNumber = currentNumber + 1;
    return `OAC${nextNumber.toString().padStart(7, '0')}`;
  }

  async createClothesItem(item: InsertClothes): Promise<ClothesItem> {
    const sku = await this.getNextClothesSku();
    const [newItem] = await db.insert(clothesInventory).values({
      ...item,
      sku,
    }).returning();
    return newItem;
  }

  async getAllClothesItems(): Promise<ClothesItem[]> {
    return db.select().from(clothesInventory).orderBy(desc(clothesInventory.createdAt));
  }

  async getClothesItem(id: number): Promise<ClothesItem | undefined> {
    const [item] = await db.select().from(clothesInventory).where(eq(clothesInventory.id, id));
    return item;
  }

  async updateClothesItem(id: number, data: Partial<InsertClothes>): Promise<ClothesItem | undefined> {
    const [updated] = await db.update(clothesInventory).set(data).where(eq(clothesInventory.id, id)).returning();
    return updated;
  }

  async deleteClothesItem(id: number): Promise<void> {
    await db.delete(clothesInventory).where(eq(clothesInventory.id, id));
  }

  async markClothesExported(ids: number[]): Promise<void> {
    if (ids.length === 0) return;
    await db.update(clothesInventory)
      .set({ lastExportedAt: new Date() })
      .where(inArray(clothesInventory.id, ids));
  }

  // Payment methods
  async updateUserStripeInfo(userId: string, data: {
    stripeCustomerId?: string;
    stripePaymentMethodId?: string | null;
    paymentMethodLast4?: string | null;
    paymentMethodBrand?: string | null;
    paymentStatus?: string;
    biddingBlocked?: number;
    biddingBlockedReason?: string | null;
  }): Promise<User | undefined> {
    const [updated] = await db.update(users)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(users.id, userId))
      .returning();
    return updated;
  }

  // Pending charges
  async createPendingCharge(charge: InsertPendingCharge): Promise<PendingCharge> {
    const [newCharge] = await db.insert(pendingCharges).values(charge).returning();
    return newCharge;
  }

  async getUserPendingCharges(userId: string): Promise<PendingCharge[]> {
    return db.select().from(pendingCharges)
      .where(and(
        eq(pendingCharges.userId, userId),
        eq(pendingCharges.status, 'pending')
      ))
      .orderBy(desc(pendingCharges.createdAt));
  }

  async getAllPendingCharges(): Promise<PendingCharge[]> {
    return db.select().from(pendingCharges)
      .where(eq(pendingCharges.status, 'pending'))
      .orderBy(pendingCharges.createdAt);
  }

  async updatePendingChargeStatus(id: number, status: string, failureReason?: string): Promise<PendingCharge | undefined> {
    const [updated] = await db.update(pendingCharges)
      .set({ 
        status, 
        failureReason: failureReason || null,
        processedAt: status === 'processed' ? new Date() : null,
        retryCount: status === 'failed' ? sql`${pendingCharges.retryCount} + 1` : pendingCharges.retryCount,
      })
      .where(eq(pendingCharges.id, id))
      .returning();
    return updated;
  }

  // Payment history
  async createPaymentHistory(payment: InsertPaymentHistory): Promise<PaymentHistory> {
    const [newPayment] = await db.insert(paymentHistory).values(payment).returning();
    return newPayment;
  }

  async getUserPaymentHistory(userId: string): Promise<PaymentHistory[]> {
    return db.select().from(paymentHistory)
      .where(eq(paymentHistory.userId, userId))
      .orderBy(desc(paymentHistory.createdAt));
  }

  // User queries for batch processing
  async getUsersWithPendingCharges(): Promise<User[]> {
    const userIds = await db.selectDistinct({ userId: pendingCharges.userId })
      .from(pendingCharges)
      .where(eq(pendingCharges.status, 'pending'));
    
    if (userIds.length === 0) return [];
    
    return db.select().from(users)
      .where(inArray(users.id, userIds.map(u => u.userId)));
  }

  // Staff management
  async getAllStaff(): Promise<Staff[]> {
    return db.select().from(staff).orderBy(staff.name);
  }

  async getActiveStaff(): Promise<Staff[]> {
    return db.select().from(staff).where(eq(staff.active, 1)).orderBy(staff.name);
  }

  async getStaff(id: number): Promise<Staff | undefined> {
    const [result] = await db.select().from(staff).where(eq(staff.id, id));
    return result;
  }

  async getStaffByPin(pin: string): Promise<Staff | undefined> {
    const [result] = await db.select().from(staff).where(and(eq(staff.pinCode, pin), eq(staff.active, 1)));
    return result;
  }

  async createStaff(staffData: InsertStaff): Promise<Staff> {
    const [newStaff] = await db.insert(staff).values(staffData).returning();
    return newStaff;
  }

  async updateStaff(id: number, data: Partial<InsertStaff>): Promise<Staff | undefined> {
    const [updated] = await db.update(staff).set(data).where(eq(staff.id, id)).returning();
    return updated;
  }

  async deactivateStaff(id: number): Promise<Staff | undefined> {
    const [updated] = await db.update(staff).set({ active: 0 }).where(eq(staff.id, id)).returning();
    return updated;
  }

  // Staff shifts
  async clockIn(staffId: number): Promise<StaffShift> {
    const [shift] = await db.insert(staffShifts).values({ staffId, clockIn: new Date(), itemsScanned: 0 }).returning();
    return shift;
  }

  async clockOut(shiftId: number): Promise<StaffShift | undefined> {
    const [shift] = await db.update(staffShifts).set({ clockOut: new Date() }).where(eq(staffShifts.id, shiftId)).returning();
    return shift;
  }

  async getActiveShift(staffId: number): Promise<StaffShift | undefined> {
    const [shift] = await db.select().from(staffShifts).where(and(eq(staffShifts.staffId, staffId), isNull(staffShifts.clockOut))).orderBy(desc(staffShifts.clockIn));
    return shift;
  }

  async getStaffShifts(staffId: number, startDate?: Date, endDate?: Date): Promise<StaffShift[]> {
    let conditions = [eq(staffShifts.staffId, staffId)];
    if (startDate) conditions.push(gte(staffShifts.clockIn, startDate));
    if (endDate) conditions.push(lte(staffShifts.clockIn, endDate));
    return db.select().from(staffShifts).where(and(...conditions)).orderBy(desc(staffShifts.clockIn));
  }

  async incrementShiftScans(shiftId: number): Promise<void> {
    await db.update(staffShifts).set({ itemsScanned: sql`${staffShifts.itemsScanned} + 1` }).where(eq(staffShifts.id, shiftId));
  }

  // Batches
  async getAllBatches(): Promise<Batch[]> {
    return db.select().from(batches).orderBy(desc(batches.createdAt));
  }

  async getActiveBatch(): Promise<Batch | undefined> {
    const [batch] = await db.select().from(batches).where(eq(batches.active, 1)).orderBy(desc(batches.createdAt));
    return batch;
  }

  async getBatch(id: number): Promise<Batch | undefined> {
    const [batch] = await db.select().from(batches).where(eq(batches.id, id));
    return batch;
  }

  async createBatch(batchData: InsertBatch): Promise<Batch> {
    // Deactivate other batches first
    await db.update(batches).set({ active: 0 }).where(eq(batches.active, 1));
    const [newBatch] = await db.insert(batches).values({ ...batchData, active: 1 }).returning();
    return newBatch;
  }

  async updateBatch(id: number, data: Partial<InsertBatch>): Promise<Batch | undefined> {
    const [updated] = await db.update(batches).set(data).where(eq(batches.id, id)).returning();
    return updated;
  }

  async deactivateBatch(id: number): Promise<Batch | undefined> {
    const [updated] = await db.update(batches).set({ active: 0 }).where(eq(batches.id, id)).returning();
    return updated;
  }

  async incrementBatchItems(batchId: number, cost: number): Promise<void> {
    await db.update(batches).set({
      totalItems: sql`${batches.totalItems} + 1`,
      totalCost: sql`${batches.totalCost} + ${cost}`,
    }).where(eq(batches.id, batchId));
  }

  async incrementBatchSold(batchId: number, revenue: number): Promise<void> {
    await db.update(batches).set({
      soldItems: sql`${batches.soldItems} + 1`,
      totalRevenue: sql`${batches.totalRevenue} + ${revenue}`,
    }).where(eq(batches.id, batchId));
  }

  // Analytics
  async getStaffScanStats(staffId: number, startDate?: Date, endDate?: Date): Promise<{ totalScans: number; totalHours: number }> {
    const shifts = await this.getStaffShifts(staffId, startDate, endDate);
    let totalScans = 0;
    let totalHours = 0;
    for (const shift of shifts) {
      totalScans += shift.itemsScanned || 0;
      if (shift.clockOut) {
        const hours = (new Date(shift.clockOut).getTime() - new Date(shift.clockIn).getTime()) / (1000 * 60 * 60);
        totalHours += hours;
      }
    }
    return { totalScans, totalHours };
  }

  async getBatchStats(): Promise<{ id: number; name: string; totalItems: number; soldItems: number; sellThrough: number; roi: number }[]> {
    const allBatches = await this.getAllBatches();
    return allBatches.map(batch => ({
      id: batch.id,
      name: batch.name,
      totalItems: batch.totalItems,
      soldItems: batch.soldItems,
      sellThrough: batch.totalItems > 0 ? Math.round((batch.soldItems / batch.totalItems) * 100) : 0,
      roi: batch.totalCost > 0 ? Math.round(((batch.totalRevenue - batch.totalCost) / batch.totalCost) * 100) : 0,
    }));
  }

  async getInventoryAging(): Promise<{ range: string; count: number }[]> {
    const now = new Date();
    const day30 = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const day60 = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);
    const day90 = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);

    const [under30] = await db.select({ count: sql<number>`count(*)` }).from(auctions).where(and(gte(auctions.createdAt, day30), isNull(auctions.soldAt)));
    const [day30to60] = await db.select({ count: sql<number>`count(*)` }).from(auctions).where(and(gte(auctions.createdAt, day60), lte(auctions.createdAt, day30), isNull(auctions.soldAt)));
    const [day60to90] = await db.select({ count: sql<number>`count(*)` }).from(auctions).where(and(gte(auctions.createdAt, day90), lte(auctions.createdAt, day60), isNull(auctions.soldAt)));
    const [over90] = await db.select({ count: sql<number>`count(*)` }).from(auctions).where(and(lte(auctions.createdAt, day90), isNull(auctions.soldAt)));

    return [
      { range: '0-30 days', count: Number(under30?.count) || 0 },
      { range: '30-60 days', count: Number(day30to60?.count) || 0 },
      { range: '60-90 days', count: Number(day60to90?.count) || 0 },
      { range: '90+ days', count: Number(over90?.count) || 0 },
    ];
  }

  async getCategoryPerformance(): Promise<{ category: string; listed: number; sold: number; sellThrough: number }[]> {
    const results = await db.select({
      category: auctions.category,
      listed: sql<number>`count(*)`,
      sold: sql<number>`count(case when ${auctions.soldAt} is not null then 1 end)`,
    }).from(auctions).groupBy(auctions.category);

    return results.map(r => ({
      category: r.category || 'Uncategorized',
      listed: Number(r.listed) || 0,
      sold: Number(r.sold) || 0,
      sellThrough: r.listed > 0 ? Math.round((Number(r.sold) / Number(r.listed)) * 100) : 0,
    }));
  }

  // Item cost updates
  async updateAuctionCost(id: number, cost: number): Promise<Auction | undefined> {
    const [updated] = await db.update(auctions).set({ cost }).where(eq(auctions.id, id)).returning();
    return updated;
  }

  async updateClothesCost(id: number, cost: number): Promise<ClothesItem | undefined> {
    const [updated] = await db.update(clothesInventory).set({ cost }).where(eq(clothesInventory.id, id)).returning();
    return updated;
  }
}

export const storage = new DatabaseStorage();
