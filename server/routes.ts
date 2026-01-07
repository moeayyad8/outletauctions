import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { setupAuth, isAuthenticated } from "./replitAuth";
import { insertBidSchema, insertWatchlistSchema, insertAuctionSchema, insertTagSchema } from "@shared/schema";
import { scanCode } from "./upcService";
import { registerObjectStorageRoutes } from "./replit_integrations/object_storage";

export async function registerRoutes(app: Express): Promise<Server> {
  await setupAuth(app);
  registerObjectStorageRoutes(app);

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

  app.post('/api/staff/auctions', async (req, res) => {
    try {
      const auctionData = insertAuctionSchema.parse(req.body);
      const auction = await storage.createAuction(auctionData);
      res.json(auction);
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

  const httpServer = createServer(app);
  return httpServer;
}
