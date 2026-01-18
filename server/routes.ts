import type { Express } from "express";
import { createServer, type Server } from "http";
import { WebSocketServer, WebSocket } from "ws";
import { storage } from "./storage";
import { setupAuth, isAuthenticated } from "./replitAuth";
import { insertBidSchema, insertWatchlistSchema, insertAuctionSchema, insertTagSchema } from "@shared/schema";
import { scanCode } from "./upcService";
import { registerObjectStorageRoutes } from "./replit_integrations/object_storage";
import { calculateRouting, getRoutingInputFromAuction } from "./routingService";

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
      
      const auction = await storage.createAuction(auctionData);
      
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
