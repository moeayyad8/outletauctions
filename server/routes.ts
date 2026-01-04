import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { setupAuth, isAuthenticated } from "./replitAuth";
import { insertBidSchema, insertWatchlistSchema, insertAuctionSchema } from "@shared/schema";
import { lookupUPC } from "./upcService";

export async function registerRoutes(app: Express): Promise<Server> {
  await setupAuth(app);

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

  // Staff endpoints - UPC scanning and auction management
  app.post('/api/staff/scan', async (req, res) => {
    try {
      const { upc } = req.body;
      
      if (!upc || typeof upc !== 'string') {
        return res.status(400).json({ message: "UPC code is required" });
      }
      
      const cleanUPC = upc.replace(/[^0-9]/g, '');
      
      if (cleanUPC.length < 8 || cleanUPC.length > 14) {
        return res.status(400).json({ message: "Invalid UPC format" });
      }
      
      const product = await lookupUPC(cleanUPC);
      
      if (!product) {
        return res.status(404).json({ message: "Product not found" });
      }
      
      res.json(product);
    } catch (error) {
      console.error("Error scanning UPC:", error);
      res.status(500).json({ message: "Failed to scan UPC" });
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

  const httpServer = createServer(app);
  return httpServer;
}
