import type { Express } from "express";
import { createServer, type Server } from "http";
import { WebSocketServer, WebSocket } from "ws";
import { storage } from "./storage";
import { setupAuth, isAuthenticated } from "./replitAuth";
import { insertBidSchema, insertWatchlistSchema, insertAuctionSchema, insertTagSchema, insertStaffSchema, insertBatchSchema } from "@shared/schema";
import { scanCode } from "./upcService";
import { registerObjectStorageRoutes } from "./replit_integrations/object_storage";
import { calculateRouting, getRoutingInputFromAuction } from "./routingService";
import * as stripeService from "./stripeService";

// Store connected WebSocket clients
const wsClients = new Set<WebSocket>();

// Broadcast to all connected clients
function broadcast(type: string, data: any) {
  const message = JSON.stringify({ type, data });
  wsClients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(message);
    }
  });
}

// Batch payment processing function (called daily at 4 AM EST)
async function processBatchPayments(): Promise<{
  processed: number;
  failed: number;
  totalAmount: number;
  errors: string[];
}> {
  const result = {
    processed: 0,
    failed: 0,
    totalAmount: 0,
    errors: [] as string[],
  };

  if (!stripeService.isStripeConfigured()) {
    result.errors.push('Stripe not configured');
    return result;
  }

  // Get all users with pending charges
  const usersWithCharges = await storage.getUsersWithPendingCharges();
  
  for (const user of usersWithCharges) {
    if (!user.stripeCustomerId || !user.stripePaymentMethodId) {
      // Block user from bidding if no payment method
      await storage.updateUserStripeInfo(user.id, {
        biddingBlocked: 1,
        biddingBlockedReason: 'No payment method on file',
        paymentStatus: 'blocked',
      });
      result.errors.push(`User ${user.id}: No payment method on file`);
      continue;
    }

    // Get all pending charges for this user
    const charges = await storage.getUserPendingCharges(user.id);
    if (charges.length === 0) continue;

    // Calculate total
    const totalAmount = charges.reduce((sum, c) => sum + c.amount + (c.shippingAmount || 0), 0);
    
    // Attempt to charge
    try {
      const chargeResult = await stripeService.chargeCustomer(
        user.stripeCustomerId,
        user.stripePaymentMethodId,
        totalAmount,
        `Outlet Auctions - ${charges.length} item(s)`,
        { userId: user.id, chargeCount: String(charges.length) }
      );

      if (chargeResult.success) {
        // Mark all charges as processed
        for (const charge of charges) {
          await storage.updatePendingChargeStatus(charge.id, 'processed');
        }
        
        // Create payment history record
        await storage.createPaymentHistory({
          userId: user.id,
          stripePaymentIntentId: chargeResult.paymentIntentId,
          amount: totalAmount,
          itemCount: charges.length,
          status: 'succeeded',
          chargeIds: charges.map(c => c.id),
        });

        result.processed += charges.length;
        result.totalAmount += totalAmount;
      } else {
        // Payment failed
        for (const charge of charges) {
          await storage.updatePendingChargeStatus(charge.id, 'failed', chargeResult.error);
        }

        // Check if this is a retry - block bidding after too many failures
        const anyChargeWithRetries = charges.find(c => (c.retryCount || 0) >= 2);
        if (anyChargeWithRetries) {
          await storage.updateUserStripeInfo(user.id, {
            biddingBlocked: 1,
            biddingBlockedReason: 'Payment failed multiple times - please update payment method',
            paymentStatus: 'failed',
          });
        }

        result.failed += charges.length;
        result.errors.push(`User ${user.id}: ${chargeResult.error}`);
      }
    } catch (error: any) {
      result.errors.push(`User ${user.id}: ${error.message}`);
      result.failed += charges.length;
    }
  }

  return result;
}

export async function registerRoutes(app: Express): Promise<Server> {
  await setupAuth(app);
  registerObjectStorageRoutes(app);
  
  // Seed shelves and routing config on startup
  await storage.seedShelves();
  await storage.seedRoutingConfig();

  app.get('/api/auth/user', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      res.json(user);
    } catch (error) {
      console.error("Error fetching user:", error);
      res.status(500).json({ message: "Failed to fetch user" });
    }
  });

  app.post('/api/bids', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      
      // Check if user has valid payment method before allowing bid
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      
      if (user.biddingBlocked) {
        return res.status(403).json({ 
          message: user.biddingBlockedReason || "Bidding is currently blocked on your account",
          code: "BIDDING_BLOCKED"
        });
      }
      
      if (!user.stripePaymentMethodId) {
        return res.status(403).json({ 
          message: "Please add a payment method before placing bids",
          code: "NO_PAYMENT_METHOD"
        });
      }
      
      const bidData = insertBidSchema.parse({ ...req.body, userId });
      const bid = await storage.createBid(bidData);
      res.json(bid);
    } catch (error) {
      console.error("Error creating bid:", error);
      res.status(400).json({ message: "Failed to create bid" });
    }
  });

  app.get('/api/bids', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const bids = await storage.getUserBids(userId);
      res.json(bids);
    } catch (error) {
      console.error("Error fetching bids:", error);
      res.status(500).json({ message: "Failed to fetch bids" });
    }
  });

  app.get('/api/watchlist', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const watchlist = await storage.getUserWatchlist(userId);
      res.json(watchlist);
    } catch (error) {
      console.error("Error fetching watchlist:", error);
      res.status(500).json({ message: "Failed to fetch watchlist" });
    }
  });

  app.post('/api/watchlist', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const watchlistData = insertWatchlistSchema.parse({ ...req.body, userId });
      const item = await storage.addToWatchlist(watchlistData);
      res.json(item);
    } catch (error) {
      console.error("Error adding to watchlist:", error);
      res.status(400).json({ message: "Failed to add to watchlist" });
    }
  });

  app.delete('/api/watchlist/:auctionId', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const auctionId = parseInt(req.params.auctionId);
      
      if (isNaN(auctionId)) {
        return res.status(400).json({ message: "Invalid auction ID" });
      }
      
      await storage.removeFromWatchlist(userId, auctionId);
      res.json({ success: true });
    } catch (error) {
      console.error("Error removing from watchlist:", error);
      res.status(500).json({ message: "Failed to remove from watchlist" });
    }
  });

  // Diagnostic endpoint to test UPC API directly
  app.get('/api/upc-diagnostic/:code', async (req, res) => {
    try {
      const code = req.params.code;
      const UPCITEMDB_API_URL = "https://api.upcitemdb.com/prod/trial/lookup";
      
      const response = await fetch(`${UPCITEMDB_API_URL}?upc=${code}`, {
        headers: { "Content-Type": "application/json" }
      });
      
      const responseText = await response.text();
      let responseJson;
      try {
        responseJson = JSON.parse(responseText);
      } catch {
        responseJson = null;
      }
      
      res.json({
        code,
        apiStatus: response.status,
        apiStatusText: response.statusText,
        apiHeaders: Object.fromEntries(response.headers.entries()),
        apiResponse: responseJson || responseText,
        hasApiKey: !!process.env.UPCITEMDB_API_KEY,
        environment: process.env.NODE_ENV
      });
    } catch (error: any) {
      res.json({
        error: error.message,
        stack: error.stack
      });
    }
  });

  // Staff endpoints - UPC/EAN/ASIN scanning and auction management
  app.post('/api/scan', async (req, res) => {
    try {
      const { code } = req.body;
      
      if (!code || typeof code !== 'string') {
        return res.status(400).json({ message: "Code is required" });
      }
      
      const result = await scanCode(code);
      res.json(result);
    } catch (error) {
      console.error("Error scanning code:", error);
      res.status(500).json({ message: "Failed to scan code" });
    }
  });

  // Calculate routing preview without creating an auction
  app.post('/api/staff/routing-preview', async (req, res) => {
    try {
      const { brandTier, weightClass, category, retailPrice, condition, weightOunces, stockQuantity, upcMatched } = req.body;
      
      const config = await storage.getRoutingConfig();
      
      // Get brand stats for Tier A items (premium brands) to check 10:1 ratio
      let brandStats = null;
      if (brandTier === "A") {
        // Use "TIER_A" as a generic key for tracking all Tier A items
        brandStats = await storage.getBrandRoutingStats("TIER_A");
      }
      
      const routingInput = {
        brandTier: brandTier || null,
        weightClass: weightClass || null,
        category: category || null,
        retailPrice: retailPrice || null,
        condition: condition || null,
        weightOunces: weightOunces || null,
        stockQuantity: stockQuantity || 1,
        upcMatched: upcMatched !== false
      };
      
      const routingResult = calculateRouting(routingInput, config, brandStats ? {
        whatnotCount: brandStats.whatnotCount,
        otherPlatformCount: brandStats.otherPlatformCount
      } : null);
      
      res.json(routingResult);
    } catch (error) {
      console.error("Error calculating routing preview:", error);
      res.status(500).json({ message: "Failed to calculate routing" });
    }
  });

  app.post('/api/staff/auctions', async (req, res) => {
    try {
      const auctionData = insertAuctionSchema.parse(req.body);
      
      if (!auctionData.shelfId) {
        return res.status(400).json({ message: "Shelf location is required" });
      }
      
      // Note: brandTier, condition, and weightClass are optional for now
      // Items without these fields will default to eBay destination
      
      // Get active batch if no batchId provided
      let batchId = auctionData.batchId;
      if (!batchId) {
        const activeBatch = await storage.getActiveBatch();
        batchId = activeBatch?.id;
      }
      
      // Create auction with batch and staff tracking
      const auction = await storage.createAuction({
        ...auctionData,
        batchId,
      });
      
      // Update batch stats if assigned to a batch
      if (batchId) {
        await storage.incrementBatchItems(batchId, auctionData.cost || 200);
      }
      
      // Increment staff shift scans if staff is tracking
      if (auctionData.scannedByStaffId) {
        const activeShift = await storage.getActiveShift(auctionData.scannedByStaffId);
        if (activeShift) {
          await storage.incrementShiftScans(activeShift.id);
        }
      }
      
      // Calculate routing for the new auction
      const config = await storage.getRoutingConfig();
      const upcMatched = !!(auction.upc && auction.title && !auction.title.startsWith('Unidentified'));
      
      // Get brand stats for Tier A (premium brands) quota check
      let brandStats = null;
      if (auction.brandTier === "A") {
        brandStats = await storage.getBrandRoutingStats("TIER_A");
      }
      
      const routingInput = getRoutingInputFromAuction(auction, upcMatched);
      const routingResult = calculateRouting(routingInput, config, brandStats ? {
        whatnotCount: brandStats.whatnotCount,
        otherPlatformCount: brandStats.otherPlatformCount
      } : null);
      
      // Update auction with routing info
      const updatedAuction = await storage.updateAuctionRouting(auction.id, {
        routingPrimary: routingResult.primary,
        routingSecondary: routingResult.secondary,
        routingScores: routingResult.scores,
        routingDisqualifications: routingResult.disqualifications,
        needsReview: routingResult.needsReview ? 1 : 0,
      });
      
      // Track Tier A brand routing stats for 10:1 quota
      if (auction.brandTier === "A" && routingResult.primary) {
        await storage.incrementBrandRoutingStats(
          "TIER_A", 
          routingResult.primary === 'whatnot' ? 'whatnot' : 'other'
        );
      }
      
      // Get shelf info for live view
      const shelf = await storage.getShelf(auction.shelfId!);
      
      // Broadcast new scan to live view clients
      broadcast('new_scan', {
        auction: updatedAuction || auction,
        shelfCode: shelf?.code || 'Unknown'
      });
      
      res.json(updatedAuction || auction);
    } catch (error) {
      console.error("Error creating auction:", error);
      res.status(400).json({ message: "Failed to create auction" });
    }
  });

  app.get('/api/staff/auctions', async (req, res) => {
    try {
      const auctions = await storage.getAllAuctions();
      res.json(auctions);
    } catch (error) {
      console.error("Error fetching auctions:", error);
      res.status(500).json({ message: "Failed to fetch auctions" });
    }
  });

  app.get('/api/staff/auctions/:id', async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid auction ID" });
      }
      
      const auction = await storage.getAuction(id);
      if (!auction) {
        return res.status(404).json({ message: "Auction not found" });
      }
      
      res.json(auction);
    } catch (error) {
      console.error("Error fetching auction:", error);
      res.status(500).json({ message: "Failed to fetch auction" });
    }
  });

  app.get('/api/staff/next-internal-code', async (req, res) => {
    try {
      const nextCode = await storage.getNextInternalCode();
      res.json({ code: nextCode });
    } catch (error) {
      console.error("Error getting next internal code:", error);
      res.status(500).json({ message: "Failed to get next internal code" });
    }
  });

  // Shelves management
  app.get('/api/shelves', async (req, res) => {
    try {
      const allShelves = await storage.getAllShelves();
      res.json(allShelves);
    } catch (error) {
      console.error("Error fetching shelves:", error);
      res.status(500).json({ message: "Failed to fetch shelves" });
    }
  });

  app.patch('/api/staff/auctions/:id/shelf', async (req, res) => {
    try {
      const auctionId = parseInt(req.params.id);
      const { shelfId } = req.body;
      
      if (isNaN(auctionId)) {
        return res.status(400).json({ message: "Invalid auction ID" });
      }
      
      const updated = await storage.updateAuctionShelf(auctionId, shelfId);
      if (!updated) {
        return res.status(404).json({ message: "Auction not found" });
      }
      
      res.json(updated);
    } catch (error) {
      console.error("Error updating auction shelf:", error);
      res.status(400).json({ message: "Failed to update shelf" });
    }
  });

  // Tags management
  app.get('/api/tags', async (req, res) => {
    try {
      const { type } = req.query;
      const tags = type ? await storage.getTagsByType(type as string) : await storage.getAllTags();
      res.json(tags);
    } catch (error) {
      console.error("Error fetching tags:", error);
      res.status(500).json({ message: "Failed to fetch tags" });
    }
  });

  app.post('/api/tags', async (req, res) => {
    try {
      const tagData = insertTagSchema.parse(req.body);
      const tag = await storage.createTag(tagData);
      res.json(tag);
    } catch (error) {
      console.error("Error creating tag:", error);
      res.status(400).json({ message: "Failed to create tag" });
    }
  });

  app.post('/api/staff/auctions/:id/tags', async (req, res) => {
    try {
      const auctionId = parseInt(req.params.id);
      const { tagIds } = req.body;
      
      if (isNaN(auctionId)) {
        return res.status(400).json({ message: "Invalid auction ID" });
      }
      
      if (!Array.isArray(tagIds)) {
        return res.status(400).json({ message: "tagIds must be an array" });
      }
      
      await storage.attachTagsToAuction(auctionId, tagIds);
      res.json({ success: true });
    } catch (error) {
      console.error("Error attaching tags:", error);
      res.status(400).json({ message: "Failed to attach tags" });
    }
  });

  app.get('/api/staff/auctions/:id/tags', async (req, res) => {
    try {
      const auctionId = parseInt(req.params.id);
      
      if (isNaN(auctionId)) {
        return res.status(400).json({ message: "Invalid auction ID" });
      }
      
      const tags = await storage.getAuctionTags(auctionId);
      res.json(tags);
    } catch (error) {
      console.error("Error fetching auction tags:", error);
      res.status(500).json({ message: "Failed to fetch auction tags" });
    }
  });

  app.delete('/api/staff/auctions/:id', async (req, res) => {
    try {
      const auctionId = parseInt(req.params.id);
      
      if (isNaN(auctionId)) {
        return res.status(400).json({ message: "Invalid auction ID" });
      }
      
      await storage.deleteAuction(auctionId);
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting auction:", error);
      res.status(500).json({ message: "Failed to delete auction" });
    }
  });

  // Update auction routing info (condition, weight, quantity) and recalculate
  app.patch('/api/staff/auctions/:id/routing', async (req, res) => {
    try {
      const auctionId = parseInt(req.params.id);
      const { condition, weightOunces, stockQuantity, needsReview } = req.body;
      
      if (isNaN(auctionId)) {
        return res.status(400).json({ message: "Invalid auction ID" });
      }
      
      const auction = await storage.getAuction(auctionId);
      if (!auction) {
        return res.status(404).json({ message: "Auction not found" });
      }
      
      // First update the item fields
      const updateData: any = {};
      if (condition !== undefined) updateData.condition = condition;
      if (weightOunces !== undefined) updateData.weightOunces = weightOunces;
      if (stockQuantity !== undefined) updateData.stockQuantity = stockQuantity;
      if (needsReview !== undefined) updateData.needsReview = needsReview;
      
      // Get merged auction data for routing calculation
      const mergedAuction = { ...auction, ...updateData };
      
      // Recalculate routing
      const config = await storage.getRoutingConfig();
      const upcMatched = !!(mergedAuction.upc && mergedAuction.title && !mergedAuction.title.startsWith('Unidentified'));
      
      // Get Tier A stats for quota check
      let brandStats = null;
      if (mergedAuction.brandTier === "A") {
        brandStats = await storage.getBrandRoutingStats("TIER_A");
      }
      
      const routingInput = getRoutingInputFromAuction(mergedAuction, upcMatched);
      const routingResult = calculateRouting(routingInput, config, brandStats ? {
        whatnotCount: brandStats.whatnotCount,
        otherPlatformCount: brandStats.otherPlatformCount
      } : null);
      
      // Update with new routing
      updateData.routingPrimary = routingResult.primary;
      updateData.routingSecondary = routingResult.secondary;
      updateData.routingScores = routingResult.scores;
      updateData.routingDisqualifications = routingResult.disqualifications;
      if (needsReview === undefined) {
        updateData.needsReview = routingResult.needsReview ? 1 : 0;
      }
      
      const updated = await storage.updateAuctionRouting(auctionId, updateData);
      res.json(updated);
    } catch (error) {
      console.error("Error updating auction routing:", error);
      res.status(500).json({ message: "Failed to update routing" });
    }
  });

  // Get routing configuration
  app.get('/api/staff/routing-config', async (req, res) => {
    try {
      const config = await storage.getRoutingConfig();
      res.json(config);
    } catch (error) {
      console.error("Error fetching routing config:", error);
      res.status(500).json({ message: "Failed to fetch routing config" });
    }
  });

  // Mark auctions as exported (for CSV export tracking)
  app.post('/api/staff/auctions/mark-exported', async (req, res) => {
    try {
      const { ids } = req.body;
      
      if (!ids || !Array.isArray(ids) || ids.length === 0) {
        return res.status(400).json({ message: "ids array is required" });
      }
      
      const validIds = ids.filter(id => typeof id === 'number' && Number.isInteger(id) && id > 0);
      if (validIds.length === 0) {
        return res.status(400).json({ message: "No valid numeric IDs provided" });
      }
      
      if (validIds.length !== ids.length) {
        console.warn(`Filtered out ${ids.length - validIds.length} invalid IDs from export request`);
      }
      
      await storage.markAuctionsExported(validIds);
      res.json({ success: true, count: validIds.length });
    } catch (error) {
      console.error("Error marking auctions as exported:", error);
      res.status(500).json({ message: "Failed to mark auctions as exported" });
    }
  });

  // Mark auctions as listed on eBay (after CSV uploaded to eBay)
  app.post('/api/staff/auctions/mark-listed', async (req, res) => {
    try {
      const { ids } = req.body;
      
      if (!ids || !Array.isArray(ids) || ids.length === 0) {
        return res.status(400).json({ message: "ids array is required" });
      }
      
      const validIds = ids.filter(id => typeof id === 'number' && Number.isInteger(id) && id > 0);
      if (validIds.length === 0) {
        return res.status(400).json({ message: "No valid numeric IDs provided" });
      }
      
      await storage.markAuctionsListed(validIds);
      res.json({ success: true, count: validIds.length });
    } catch (error) {
      console.error("Error marking auctions as listed:", error);
      res.status(500).json({ message: "Failed to mark auctions as listed" });
    }
  });

  // Public endpoint - get active auctions for homepage
  app.get('/api/auctions', async (req, res) => {
    try {
      const activeAuctions = await storage.getActiveAuctions();
      res.json(activeAuctions);
    } catch (error) {
      console.error("Error fetching active auctions:", error);
      res.status(500).json({ message: "Failed to fetch auctions" });
    }
  });

  // Get featured auctions for homepage section (showOnHomepage = 1)
  app.get('/api/auctions/homepage', async (req, res) => {
    try {
      const homepageAuctions = await storage.getHomepageAuctions();
      res.json(homepageAuctions);
    } catch (error) {
      console.error("Error fetching homepage auctions:", error);
      res.status(500).json({ message: "Failed to fetch homepage auctions" });
    }
  });

  // Update auction status (send to auction)
  app.patch('/api/staff/auctions/:id/status', async (req, res) => {
    try {
      const auctionId = parseInt(req.params.id);
      const { status, durationDays } = req.body;
      
      if (isNaN(auctionId)) {
        return res.status(400).json({ message: "Invalid auction ID" });
      }
      
      if (!status || !['draft', 'active', 'ended', 'sold'].includes(status)) {
        return res.status(400).json({ message: "Invalid status" });
      }
      
      let endTime: Date | undefined;
      if (status === 'active' && durationDays) {
        endTime = new Date(Date.now() + durationDays * 24 * 60 * 60 * 1000);
      }
      
      const updated = await storage.updateAuctionStatus(auctionId, status, endTime);
      if (!updated) {
        return res.status(404).json({ message: "Auction not found" });
      }
      
      res.json(updated);
    } catch (error) {
      console.error("Error updating auction status:", error);
      res.status(500).json({ message: "Failed to update auction status" });
    }
  });

  // Publish auction to destination (auction, eBay, or Amazon)
  app.post('/api/staff/auctions/:id/publish', async (req, res) => {
    try {
      const auctionId = parseInt(req.params.id);
      const { destination } = req.body;
      
      if (isNaN(auctionId)) {
        return res.status(400).json({ message: "Invalid auction ID" });
      }
      
      if (!destination || !['auction', 'ebay', 'amazon'].includes(destination)) {
        return res.status(400).json({ message: "Invalid destination" });
      }
      
      const auction = await storage.getAuction(auctionId);
      if (!auction) {
        return res.status(404).json({ message: "Auction not found" });
      }
      
      if (destination === 'auction') {
        // Send to internal auction - also reset any external metadata
        const endTime = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
        await storage.updateAuctionExternal(auctionId, 'auction', '', '', '', null);
        const updated = await storage.updateAuctionStatus(auctionId, 'active', endTime);
        res.json(updated);
      } else {
        // Mock eBay/Amazon publishing - simulate pending then listed
        const externalPayload = {
          platform: destination,
          submittedAt: new Date().toISOString(),
          title: auction.title,
          price: auction.retailPrice,
        };
        
        // Simulate external listing creation (mock)
        const mockListingId = `${destination.toUpperCase()}-${Date.now()}`;
        const mockListingUrl = destination === 'ebay' 
          ? `https://www.ebay.com/itm/${mockListingId}`
          : `https://www.amazon.com/dp/${mockListingId}`;
        
        const updated = await storage.updateAuctionExternal(
          auctionId,
          destination,
          'listed', // In real integration, would start as 'pending'
          mockListingId,
          mockListingUrl,
          externalPayload
        );
        
        res.json(updated);
      }
    } catch (error) {
      console.error("Error publishing auction:", error);
      res.status(500).json({ message: "Failed to publish auction" });
    }
  });

  app.get('/api/staff/auctions/search/by-tags', async (req, res) => {
    try {
      const { tagIds } = req.query;
      
      if (!tagIds) {
        return res.status(400).json({ message: "tagIds query parameter required" });
      }
      
      const tagIdArray = (tagIds as string).split(',').map(id => parseInt(id)).filter(id => !isNaN(id));
      const auctions = await storage.searchAuctionsByTags(tagIdArray);
      res.json(auctions);
    } catch (error) {
      console.error("Error searching auctions by tags:", error);
      res.status(500).json({ message: "Failed to search auctions" });
    }
  });

  // Admin export endpoint - exports all inventory data as JSON for migration
  app.get('/api/admin/export', async (req, res) => {
    try {
      const auctions = await storage.getAllAuctions();
      const shelves = await storage.getAllShelves();
      const tags = await storage.getAllTags();
      const nextCode = await storage.getNextInternalCode();
      
      const exportData = {
        version: 1,
        exportedAt: new Date().toISOString(),
        data: {
          auctions,
          shelves,
          tags,
          nextInternalCode: nextCode,
        }
      };
      
      res.json(exportData);
    } catch (error) {
      console.error("Error exporting data:", error);
      res.status(500).json({ message: "Failed to export data" });
    }
  });

  // Admin import endpoint - imports inventory data from JSON backup
  app.post('/api/admin/import', async (req, res) => {
    try {
      const { data } = req.body;
      
      if (!data || !data.auctions) {
        return res.status(400).json({ message: "Invalid import data format" });
      }
      
      let imported = { auctions: 0, tags: 0, skipped: 0 };
      
      // Import tags first if provided (to preserve tag IDs for auction references)
      if (data.tags && Array.isArray(data.tags)) {
        const existingTags = await storage.getAllTags();
        const existingTagNames = new Set(existingTags.map(t => t.name.toLowerCase()));
        
        for (const tag of data.tags) {
          if (!tag.name || existingTagNames.has(tag.name.toLowerCase())) {
            continue;
          }
          try {
            await storage.createTag({ name: tag.name, type: tag.type || 'category' });
            existingTagNames.add(tag.name.toLowerCase());
            imported.tags++;
          } catch (err) {
            console.error("Error importing tag:", tag.name, err);
          }
        }
      }
      
      // Get existing internal codes to avoid duplicates
      const existingAuctions = await storage.getAllAuctions();
      const existingCodes = new Set(existingAuctions.map(a => a.internalCode).filter(Boolean));
      
      // Import auctions (skip id to let DB generate new ones, but preserve internalCode)
      for (const auction of data.auctions) {
        const { id, createdAt, currentBid, bidCount, ...auctionData } = auction;
        
        // Skip if internalCode already exists (avoid duplicates)
        if (auctionData.internalCode && existingCodes.has(auctionData.internalCode)) {
          console.log("Skipping duplicate:", auctionData.internalCode, "destination:", auctionData.destination);
          imported.skipped++;
          continue;
        }
        
        try {
          // Validate required fields
          if (!auctionData.title) {
            console.log("Skipping no title:", auctionData.internalCode, "destination:", auctionData.destination);
            imported.skipped++;
            continue;
          }
          
          // Clean up any fields that might cause issues
          const cleanAuctionData = {
            title: auctionData.title,
            description: auctionData.description || null,
            imageUrl: auctionData.imageUrl || null,
            additionalImages: auctionData.additionalImages || null,
            startingBid: auctionData.startingBid || 1,
            status: auctionData.status || 'draft',
            destination: auctionData.destination || 'ebay',
            stockQuantity: auctionData.stockQuantity || 1,
            needsReview: auctionData.needsReview || 0,
            internalCode: auctionData.internalCode,
            upcCode: auctionData.upcCode || null,
            brand: auctionData.brand || null,
            model: auctionData.model || null,
            condition: auctionData.condition || null,
            weightOunces: auctionData.weightOunces || null,
            shelfId: auctionData.shelfId || null,
            routingPrimary: auctionData.routingPrimary || null,
            routingSecondary: auctionData.routingSecondary || null,
            routingScores: auctionData.routingScores || null,
            externalStatus: auctionData.externalStatus || null,
            externalListingId: auctionData.externalListingId || null,
            externalListingUrl: auctionData.externalListingUrl || null,
            externalPayload: auctionData.externalPayload || null,
            ebayStatus: auctionData.ebayStatus || null,
            lastExportedAt: auctionData.lastExportedAt ? new Date(auctionData.lastExportedAt) : null,
          };
          
          await storage.importAuction(cleanAuctionData);
          console.log("Imported:", cleanAuctionData.internalCode, "destination:", cleanAuctionData.destination);
          imported.auctions++;
          
          // Track the code so subsequent duplicates in same import are skipped
          if (auctionData.internalCode) {
            existingCodes.add(auctionData.internalCode);
          }
        } catch (err) {
          console.error("Error importing auction:", auctionData.internalCode, "destination:", auctionData.destination, err);
          imported.skipped++;
        }
      }
      
      let message = `Imported ${imported.auctions} auctions`;
      if (imported.tags > 0) message += `, ${imported.tags} tags`;
      if (imported.skipped > 0) message += ` (${imported.skipped} skipped)`;
      
      res.json({ 
        success: true, 
        message,
        imported 
      });
    } catch (error) {
      console.error("Error importing data:", error);
      res.status(500).json({ message: "Failed to import data" });
    }
  });

  // === Clothes Inventory Endpoints ===
  
  // Get all clothes items
  app.get('/api/clothes', async (req, res) => {
    try {
      const items = await storage.getAllClothesItems();
      res.json(items);
    } catch (error) {
      console.error("Error fetching clothes:", error);
      res.status(500).json({ message: "Failed to fetch clothes inventory" });
    }
  });

  // Create a new clothes item
  app.post('/api/clothes', async (req, res) => {
    try {
      // Auto-assign active batch and track staff
      const activeBatch = await storage.getActiveBatch();
      const itemData = {
        ...req.body,
        batchId: req.body.batchId || activeBatch?.id || null,
        scannedByStaffId: req.body.scannedByStaffId || null,
        cost: req.body.cost || 200, // Default $2 cost
      };
      
      const item = await storage.createClothesItem(itemData);
      
      // Update batch totalItems count
      if (item.batchId) {
        await storage.incrementBatchItemCount(item.batchId);
      }
      
      // Update staff shift scan count
      if (item.scannedByStaffId) {
        const activeShift = await storage.getActiveShift(item.scannedByStaffId);
        if (activeShift) {
          await storage.incrementShiftScanCount(activeShift.id);
        }
      }
      
      res.json(item);
    } catch (error) {
      console.error("Error creating clothes item:", error);
      res.status(500).json({ message: "Failed to create clothes item" });
    }
  });

  // Get single clothes item
  app.get('/api/clothes/:id', async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const item = await storage.getClothesItem(id);
      if (!item) {
        return res.status(404).json({ message: "Item not found" });
      }
      res.json(item);
    } catch (error) {
      console.error("Error fetching clothes item:", error);
      res.status(500).json({ message: "Failed to fetch clothes item" });
    }
  });

  // Update clothes item
  app.patch('/api/clothes/:id', async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const item = await storage.updateClothesItem(id, req.body);
      if (!item) {
        return res.status(404).json({ message: "Item not found" });
      }
      res.json(item);
    } catch (error) {
      console.error("Error updating clothes item:", error);
      res.status(500).json({ message: "Failed to update clothes item" });
    }
  });

  // Delete clothes item
  app.delete('/api/clothes/:id', async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      await storage.deleteClothesItem(id);
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting clothes item:", error);
      res.status(500).json({ message: "Failed to delete clothes item" });
    }
  });

  // Export clothes to Depop CSV
  app.get('/api/clothes/export/depop', async (req, res) => {
    try {
      const items = await storage.getAllClothesItems();
      
      // Build CSV header
      const headers = [
        'Description', 'Category', 'Price', 'Brand', 'Condition', 'Size',
        'Color 1', 'Color 2', 'Source 1', 'Source 2', 'Age',
        'Style 1', 'Style 2', 'Style 3', 'Location',
        'Picture Hero url', 'Picture 2 url', 'Picture 3 url', 'Picture 4 url',
        'Picture 5 url', 'Picture 6 url', 'Picture 7 url', 'Picture 8 url',
        'Domestic Shipping price', 'International Shipping price', 'SKU'
      ];
      
      const rows = items.map(item => {
        // Convert photo URLs to full URLs if they're relative paths
        const getFullUrl = (path: string | null) => {
          if (!path) return '';
          if (path.startsWith('http')) return path;
          const baseUrl = process.env.REPLIT_DOMAINS?.split(',')[0] || '';
          return baseUrl ? `https://${baseUrl}${path}` : path;
        };
        
        return [
          item.description || '',
          item.category || '',
          item.price ? (item.price / 100).toFixed(2) : '',
          item.brand || '',
          item.condition || 'New',
          item.size || '',
          item.color1 || '',
          item.color2 || '',
          item.source1 || 'Target',
          item.source2 || '',
          item.age || '',
          item.style1 || '',
          item.style2 || '',
          item.style3 || '',
          item.location || '',
          getFullUrl(item.pictureHero),
          getFullUrl(item.picture2),
          getFullUrl(item.picture3),
          getFullUrl(item.picture4),
          getFullUrl(item.picture5),
          getFullUrl(item.picture6),
          getFullUrl(item.picture7),
          getFullUrl(item.picture8),
          item.domesticShipping ? (item.domesticShipping / 100).toFixed(2) : '',
          item.internationalShipping ? (item.internationalShipping / 100).toFixed(2) : '',
          item.sku
        ].map(val => `"${String(val).replace(/"/g, '""')}"`).join(',');
      });
      
      // Depop template requires version header as first line
      const templateVersion = 'Template version: 6' + ','.repeat(25); // 26 total columns
      const csv = [templateVersion, headers.join(','), ...rows].join('\n');
      
      // Mark items as exported
      const ids = items.map(i => i.id);
      await storage.markClothesExported(ids);
      
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename="depop_export.csv"');
      res.send(csv);
    } catch (error) {
      console.error("Error exporting clothes to CSV:", error);
      res.status(500).json({ message: "Failed to export clothes" });
    }
  });

  // ============== STRIPE PAYMENT ROUTES ==============

  // Check if Stripe is configured
  app.get('/api/stripe/status', (req, res) => {
    res.json({ configured: stripeService.isStripeConfigured() });
  });

  // Get current user's payment status
  app.get('/api/payment/status', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      res.json({
        hasPaymentMethod: !!user.stripePaymentMethodId,
        paymentMethodLast4: user.paymentMethodLast4,
        paymentMethodBrand: user.paymentMethodBrand,
        paymentStatus: user.paymentStatus,
        biddingBlocked: !!user.biddingBlocked,
        biddingBlockedReason: user.biddingBlockedReason,
      });
    } catch (error) {
      console.error("Error fetching payment status:", error);
      res.status(500).json({ message: "Failed to fetch payment status" });
    }
  });

  // Create SetupIntent to collect payment method
  app.post('/api/stripe/setup-intent', isAuthenticated, async (req: any, res) => {
    try {
      if (!stripeService.isStripeConfigured()) {
        return res.status(503).json({ message: "Payment system not configured" });
      }

      const userId = req.user.claims.sub;
      const userEmail = req.user.claims.email;
      const userName = `${req.user.claims.first_name || ''} ${req.user.claims.last_name || ''}`.trim();
      
      let user = await storage.getUser(userId);
      
      // Create Stripe customer if not exists
      let stripeCustomerId = user?.stripeCustomerId;
      if (!stripeCustomerId) {
        const result = await stripeService.createCustomer(userEmail, userName);
        stripeCustomerId = result.customerId;
        
        // Update user with Stripe customer ID
        await storage.updateUserStripeInfo(userId, { stripeCustomerId });
      }
      
      const setupIntent = await stripeService.createSetupIntent(stripeCustomerId);
      
      res.json({
        clientSecret: setupIntent.clientSecret,
        publishableKey: process.env.STRIPE_PUBLISHABLE_KEY,
      });
    } catch (error) {
      console.error("Error creating setup intent:", error);
      res.status(500).json({ message: "Failed to create payment setup" });
    }
  });

  // Confirm payment method was saved
  app.post('/api/stripe/confirm-setup', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { paymentMethodId } = req.body;
      
      if (!paymentMethodId) {
        return res.status(400).json({ message: "Payment method ID required" });
      }
      
      const user = await storage.getUser(userId);
      if (!user?.stripeCustomerId) {
        return res.status(400).json({ message: "User not set up for payments" });
      }

      // Attach payment method to customer and set as default
      await stripeService.attachPaymentMethodToCustomer(paymentMethodId, user.stripeCustomerId);

      // Get payment method info
      const pmInfo = await stripeService.getPaymentMethodInfo(paymentMethodId);
      
      // Update user with payment method info
      await storage.updateUserStripeInfo(userId, {
        stripePaymentMethodId: pmInfo.paymentMethodId,
        paymentMethodLast4: pmInfo.last4,
        paymentMethodBrand: pmInfo.brand,
        paymentStatus: 'active',
        biddingBlocked: 0,
        biddingBlockedReason: null,
      });
      
      res.json({ 
        success: true,
        last4: pmInfo.last4,
        brand: pmInfo.brand,
      });
    } catch (error) {
      console.error("Error confirming setup:", error);
      res.status(500).json({ message: "Failed to confirm payment setup" });
    }
  });

  // Remove payment method
  app.delete('/api/stripe/payment-method', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      
      if (!user?.stripePaymentMethodId) {
        return res.status(400).json({ message: "No payment method to remove" });
      }
      
      await stripeService.detachPaymentMethod(user.stripePaymentMethodId);
      
      await storage.updateUserStripeInfo(userId, {
        stripePaymentMethodId: null,
        paymentMethodLast4: null,
        paymentMethodBrand: null,
        paymentStatus: 'none',
        biddingBlocked: 1,
        biddingBlockedReason: 'No payment method on file',
      });
      
      res.json({ success: true });
    } catch (error) {
      console.error("Error removing payment method:", error);
      res.status(500).json({ message: "Failed to remove payment method" });
    }
  });

  // Get user's pending charges
  app.get('/api/payment/pending-charges', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const charges = await storage.getUserPendingCharges(userId);
      res.json(charges);
    } catch (error) {
      console.error("Error fetching pending charges:", error);
      res.status(500).json({ message: "Failed to fetch pending charges" });
    }
  });

  // Get user's payment history
  app.get('/api/payment/history', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const history = await storage.getUserPaymentHistory(userId);
      res.json(history);
    } catch (error) {
      console.error("Error fetching payment history:", error);
      res.status(500).json({ message: "Failed to fetch payment history" });
    }
  });

  // Admin: Process batch payments (protected with admin secret)
  // In production, this would be called by a cron service with the admin secret
  app.post('/api/admin/process-batch-payments', async (req, res) => {
    try {
      // Verify admin authorization via secret header
      const adminSecret = req.headers['x-admin-secret'];
      const expectedSecret = process.env.ADMIN_BATCH_SECRET || 'batch-4406-secret';
      
      if (adminSecret !== expectedSecret) {
        return res.status(401).json({ message: "Unauthorized" });
      }
      
      const result = await processBatchPayments();
      res.json(result);
    } catch (error) {
      console.error("Error processing batch payments:", error);
      res.status(500).json({ message: "Failed to process batch payments" });
    }
  });

  // ============ ADMIN AUTHENTICATION ============
  
  // Admin secret for protected routes (4406)
  const ADMIN_SECRET = '4406';
  
  // Middleware to check admin authentication via x-admin-secret header
  const requireAdminAuth = (req: any, res: any, next: any) => {
    const adminSecret = req.headers['x-admin-secret'];
    if (adminSecret !== ADMIN_SECRET) {
      return res.status(401).json({ message: 'Admin authentication required', code: 'ADMIN_AUTH_REQUIRED' });
    }
    next();
  };

  // ============ STAFF MANAGEMENT ROUTES ============
  
  // Get all staff (admin only)
  app.get('/api/staff', requireAdminAuth, async (req, res) => {
    try {
      const allStaff = await storage.getAllStaff();
      res.json(allStaff);
    } catch (error) {
      console.error("Error fetching staff:", error);
      res.status(500).json({ message: "Failed to fetch staff" });
    }
  });

  // Get active staff only (public - for dropdown selections)
  app.get('/api/staff/active', async (req, res) => {
    try {
      const activeStaff = await storage.getActiveStaff();
      res.json(activeStaff);
    } catch (error) {
      console.error("Error fetching active staff:", error);
      res.status(500).json({ message: "Failed to fetch active staff" });
    }
  });

  // Staff login by PIN (checks active status)
  app.post('/api/staff/login', async (req, res) => {
    try {
      const { pin } = req.body;
      if (!pin || pin.length !== 4) {
        return res.status(400).json({ message: "Invalid PIN format" });
      }
      const staffMember = await storage.getStaffByPin(pin);
      if (!staffMember) {
        return res.status(401).json({ message: "Invalid PIN" });
      }
      
      // Check if staff member is active
      if (!staffMember.active) {
        return res.status(401).json({ message: "Staff account is inactive" });
      }
      
      // Check for active shift, create one if none
      let activeShift = await storage.getActiveShift(staffMember.id);
      if (!activeShift) {
        activeShift = await storage.clockIn(staffMember.id);
      }
      
      res.json({ staff: staffMember, shift: activeShift });
    } catch (error) {
      console.error("Error logging in staff:", error);
      res.status(500).json({ message: "Failed to login" });
    }
  });

  // Create new staff member (admin only)
  app.post('/api/staff', requireAdminAuth, async (req, res) => {
    try {
      const staffData = insertStaffSchema.parse(req.body);
      const newStaff = await storage.createStaff(staffData);
      res.json(newStaff);
    } catch (error) {
      console.error("Error creating staff:", error);
      res.status(400).json({ message: "Failed to create staff member" });
    }
  });

  // Update staff member (admin only)
  app.patch('/api/staff/:id', requireAdminAuth, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const updated = await storage.updateStaff(id, req.body);
      if (!updated) {
        return res.status(404).json({ message: "Staff member not found" });
      }
      res.json(updated);
    } catch (error) {
      console.error("Error updating staff:", error);
      res.status(400).json({ message: "Failed to update staff member" });
    }
  });

  // Deactivate staff member (admin only)
  app.delete('/api/staff/:id', requireAdminAuth, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const deactivated = await storage.deactivateStaff(id);
      if (!deactivated) {
        return res.status(404).json({ message: "Staff member not found" });
      }
      res.json(deactivated);
    } catch (error) {
      console.error("Error deactivating staff:", error);
      res.status(500).json({ message: "Failed to deactivate staff member" });
    }
  });

  // ============ SHIFT ROUTES ============

  // Clock out (staff can clock themselves out)
  app.post('/api/shifts/:id/clockout', async (req, res) => {
    try {
      const shiftId = parseInt(req.params.id);
      const shift = await storage.clockOut(shiftId);
      if (!shift) {
        return res.status(404).json({ message: "Shift not found" });
      }
      res.json(shift);
    } catch (error) {
      console.error("Error clocking out:", error);
      res.status(500).json({ message: "Failed to clock out" });
    }
  });

  // Get staff shifts (admin only)
  app.get('/api/staff/:id/shifts', requireAdminAuth, async (req, res) => {
    try {
      const staffId = parseInt(req.params.id);
      const shifts = await storage.getStaffShifts(staffId);
      res.json(shifts);
    } catch (error) {
      console.error("Error fetching shifts:", error);
      res.status(500).json({ message: "Failed to fetch shifts" });
    }
  });

  // ============ BATCH ROUTES ============

  // Get all batches (admin only)
  app.get('/api/batches', requireAdminAuth, async (req, res) => {
    try {
      const allBatches = await storage.getAllBatches();
      res.json(allBatches);
    } catch (error) {
      console.error("Error fetching batches:", error);
      res.status(500).json({ message: "Failed to fetch batches" });
    }
  });

  // Get active batch (public - needed for scan assignment)
  app.get('/api/batches/active', async (req, res) => {
    try {
      const activeBatch = await storage.getActiveBatch();
      res.json(activeBatch || null);
    } catch (error) {
      console.error("Error fetching active batch:", error);
      res.status(500).json({ message: "Failed to fetch active batch" });
    }
  });

  // Create new batch (admin only)
  app.post('/api/batches', requireAdminAuth, async (req, res) => {
    try {
      const batchData = insertBatchSchema.parse(req.body);
      const newBatch = await storage.createBatch(batchData);
      res.json(newBatch);
    } catch (error) {
      console.error("Error creating batch:", error);
      res.status(400).json({ message: "Failed to create batch" });
    }
  });

  // Update batch (admin only)
  app.patch('/api/batches/:id', requireAdminAuth, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const updated = await storage.updateBatch(id, req.body);
      if (!updated) {
        return res.status(404).json({ message: "Batch not found" });
      }
      res.json(updated);
    } catch (error) {
      console.error("Error updating batch:", error);
      res.status(400).json({ message: "Failed to update batch" });
    }
  });

  // ============ ANALYTICS ROUTES (Admin only) ============

  // Get staff performance stats
  app.get('/api/analytics/staff', requireAdminAuth, async (req, res) => {
    try {
      const allStaff = await storage.getActiveStaff();
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      const stats = await Promise.all(allStaff.map(async (s) => {
        const todayStats = await storage.getStaffScanStats(s.id, today);
        const allTimeStats = await storage.getStaffScanStats(s.id);
        const activeShift = await storage.getActiveShift(s.id);
        
        return {
          id: s.id,
          name: s.name,
          dailyGoal: s.dailyScanGoal || 50,
          todayScans: todayStats.totalScans,
          todayHours: Math.round(todayStats.totalHours * 10) / 10,
          allTimeScans: allTimeStats.totalScans,
          allTimeHours: Math.round(allTimeStats.totalHours * 10) / 10,
          itemsPerHour: allTimeStats.totalHours > 0 ? Math.round(allTimeStats.totalScans / allTimeStats.totalHours) : 0,
          isClockIn: !!activeShift,
        };
      }));
      
      res.json(stats);
    } catch (error) {
      console.error("Error fetching staff analytics:", error);
      res.status(500).json({ message: "Failed to fetch staff analytics" });
    }
  });

  // Get batch sell-through stats
  app.get('/api/analytics/batches', requireAdminAuth, async (req, res) => {
    try {
      const stats = await storage.getBatchStats();
      res.json(stats);
    } catch (error) {
      console.error("Error fetching batch analytics:", error);
      res.status(500).json({ message: "Failed to fetch batch analytics" });
    }
  });

  // Get inventory aging report
  app.get('/api/analytics/aging', requireAdminAuth, async (req, res) => {
    try {
      const aging = await storage.getInventoryAging();
      res.json(aging);
    } catch (error) {
      console.error("Error fetching inventory aging:", error);
      res.status(500).json({ message: "Failed to fetch inventory aging" });
    }
  });

  // Get category performance
  app.get('/api/analytics/categories', requireAdminAuth, async (req, res) => {
    try {
      const performance = await storage.getCategoryPerformance();
      res.json(performance);
    } catch (error) {
      console.error("Error fetching category performance:", error);
      res.status(500).json({ message: "Failed to fetch category performance" });
    }
  });

  // Get financial summary
  app.get('/api/analytics/financial', requireAdminAuth, async (req, res) => {
    try {
      const batchStats = await storage.getBatchStats();
      
      const totalCost = batchStats.reduce((sum, b) => sum + (b.totalItems * 200), 0); // $2 default
      const totalRevenue = batchStats.reduce((sum, b) => sum + (b.soldItems * 500), 0); // Placeholder
      const totalProfit = totalRevenue - totalCost;
      const overallRoi = totalCost > 0 ? Math.round((totalProfit / totalCost) * 100) : 0;
      
      res.json({
        totalCost: totalCost / 100, // Convert to dollars
        totalRevenue: totalRevenue / 100,
        totalProfit: totalProfit / 100,
        overallRoi,
        batchCount: batchStats.length,
        totalItems: batchStats.reduce((sum, b) => sum + b.totalItems, 0),
        soldItems: batchStats.reduce((sum, b) => sum + b.soldItems, 0),
      });
    } catch (error) {
      console.error("Error fetching financial analytics:", error);
      res.status(500).json({ message: "Failed to fetch financial analytics" });
    }
  });

  // ============ COST EDITING (Admin only) ============

  // Update auction cost
  app.patch('/api/auctions/:id/cost', requireAdminAuth, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const { cost } = req.body;
      if (typeof cost !== 'number' || cost < 0) {
        return res.status(400).json({ message: "Invalid cost value" });
      }
      const updated = await storage.updateAuctionCost(id, cost);
      if (!updated) {
        return res.status(404).json({ message: "Auction not found" });
      }
      res.json(updated);
    } catch (error) {
      console.error("Error updating auction cost:", error);
      res.status(500).json({ message: "Failed to update cost" });
    }
  });

  // Update clothes cost
  app.patch('/api/clothes/:id/cost', requireAdminAuth, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const { cost } = req.body;
      if (typeof cost !== 'number' || cost < 0) {
        return res.status(400).json({ message: "Invalid cost value" });
      }
      const updated = await storage.updateClothesCost(id, cost);
      if (!updated) {
        return res.status(404).json({ message: "Clothes item not found" });
      }
      res.json(updated);
    } catch (error) {
      console.error("Error updating clothes cost:", error);
      res.status(500).json({ message: "Failed to update cost" });
    }
  });

  const httpServer = createServer(app);
  
  // Set up WebSocket server for live view
  const wss = new WebSocketServer({ server: httpServer, path: '/ws' });
  
  wss.on('connection', (ws) => {
    console.log('Live view client connected');
    wsClients.add(ws);
    
    ws.on('close', () => {
      console.log('Live view client disconnected');
      wsClients.delete(ws);
    });
    
    ws.on('error', (error) => {
      console.error('WebSocket error:', error);
      wsClients.delete(ws);
    });
  });
  
  return httpServer;
}
