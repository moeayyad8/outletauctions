import { useState, useEffect, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, Package, MapPin, Clock, Volume2, VolumeX, Trash2 } from "lucide-react";
import type { Auction, Shelf } from "@shared/schema";

interface ScannedItem {
  id: number;
  auction: Auction;
  shelfCode: string;
  timestamp: Date;
  shelved: boolean;
}

export default function LiveView() {
  const [items, setItems] = useState<ScannedItem[]>([]);
  const [connected, setConnected] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const shelfMapRef = useRef<Map<number, string>>(new Map());
  const seenAuctionIdsRef = useRef<Set<number>>(new Set());
  const initializedRef = useRef(false);

  useEffect(() => {
    audioRef.current = new Audio("data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1pdHx3dXJrc3N8d3t6f4CBg4GKioyQkZCMj46SkZaWl5mZmZmZmZmZmZaWlpaTkZCNi4mJhYaEgn98enl4d3Z1dHN0c3R0dHR1dnZ3d3h5ent8fn+Bg4SFh4mKi42OkJGSlJWWl5iZmZqampqamZmYl5aVlJOSkI+OjYyLioiHhoWEg4KBgH9+fXx7enl4d3Z1dHNycXBwcHBxcnN0dXZ3eHl6e3x9fn+AgYKDhIWGh4iJiouMjY6PkJGSk5SVlpeYmJmZmpqampmZmJeWlZSTkpGQj46NjIuKiYiHhoWEg4KBgH9+fXx7enl4d3Z1dHNycXBvcG9wcHFyc3R1dnd4eXp7fH1+f4CBgoOEhYaHiImKi4yNjo+QkZKTlJWWl5iYmZmampqamZmYl5aVlJOSkZCPjo2Mi4qJiIeGhYSDgoGAf359fHt6eXh3dnV0c3JxcHBwcHFyc3R1dnd4eXp7fH1+f4CBgoOEhYaHiImKi4yNjo+QkZKTlJWWl5iYmZmampqamZmYl5aVlJOSkZCPjo2Mi4qJiIeGhQ==");

    let disposed = false;

    const loadShelves = async () => {
      try {
        const res = await fetch("/api/shelves");
        if (!res.ok) return;
        const shelves: Shelf[] = await res.json();
        shelfMapRef.current = new Map(shelves.map((s) => [s.id, s.code]));
      } catch (error) {
        console.error("Failed to load shelves:", error);
      }
    };

    const pollScans = async () => {
      try {
        const res = await fetch("/api/staff/auctions");
        if (!res.ok) {
          setConnected(false);
          return;
        }
        const auctions: Auction[] = await res.json();
        const seen = seenAuctionIdsRef.current;

        if (!initializedRef.current) {
          auctions.forEach((a) => seen.add(a.id));
          initializedRef.current = true;
          setConnected(true);
          return;
        }

        const newAuctions = auctions
          .filter((a) => !seen.has(a.id))
          .sort((a, b) => {
            const aTime = a.createdAt ? new Date(a.createdAt).getTime() : 0;
            const bTime = b.createdAt ? new Date(b.createdAt).getTime() : 0;
            return bTime - aTime;
          });

        if (newAuctions.length > 0) {
          newAuctions.forEach((a) => seen.add(a.id));
          const newItems: ScannedItem[] = newAuctions.map((auction) => ({
            id: Date.now() + auction.id,
            auction,
            shelfCode: auction.shelfId
              ? shelfMapRef.current.get(auction.shelfId) || "Unknown"
              : "Unknown",
            timestamp: auction.createdAt ? new Date(auction.createdAt) : new Date(),
            shelved: false,
          }));
          if (!disposed) {
            setItems((prev) => [...newItems, ...prev].slice(0, 50));
          }
          if (soundEnabled && audioRef.current) {
            audioRef.current.play().catch(() => {});
          }
        }

        setConnected(true);
      } catch (error) {
        console.error("Live polling failed:", error);
        setConnected(false);
      }
    };

    void loadShelves().then(() => pollScans());
    const intervalId = window.setInterval(pollScans, 5000);

    return () => {
      disposed = true;
      window.clearInterval(intervalId);
    };
  }, [soundEnabled]);

  const markAsShelved = (id: number) => {
    setItems(prev => prev.map(item => 
      item.id === id ? { ...item, shelved: true } : item
    ));
  };

  const removeItem = (id: number) => {
    setItems(prev => prev.filter(item => item.id !== id));
  };

  const clearShelved = () => {
    setItems(prev => prev.filter(item => !item.shelved));
  };

  const pendingItems = items.filter(item => !item.shelved);
  const shelvedItems = items.filter(item => item.shelved);

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur">
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-bold">Live View</h1>
            <Badge 
              variant={connected ? "default" : "destructive"}
              data-testid="status-connection"
            >
              {connected ? "Connected" : "Disconnected"}
            </Badge>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setSoundEnabled(!soundEnabled)}
              data-testid="button-toggle-sound"
            >
              {soundEnabled ? <Volume2 className="w-5 h-5" /> : <VolumeX className="w-5 h-5" />}
            </Button>
            {shelvedItems.length > 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={clearShelved}
                data-testid="button-clear-shelved"
              >
                <Trash2 className="w-4 h-4 mr-2" />
                Clear Done ({shelvedItems.length})
              </Button>
            )}
          </div>
        </div>
      </header>

      <main className="p-4 max-w-2xl mx-auto space-y-4">
        {pendingItems.length === 0 && shelvedItems.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <Package className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
              <h2 className="text-lg font-medium mb-2">Waiting for Scans</h2>
              <p className="text-muted-foreground">
                Items will appear here when Person A scans them
              </p>
            </CardContent>
          </Card>
        ) : (
          <>
            {pendingItems.length > 0 && (
              <div className="space-y-3">
                <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
                  To Be Shelved ({pendingItems.length})
                </h2>
                {pendingItems.map((item) => (
                  <Card 
                    key={item.id} 
                    className="border-2 border-primary/20 bg-primary/5"
                    data-testid={`card-pending-item-${item.id}`}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-start gap-4">
                        {item.auction.image && (
                          <img
                            src={item.auction.image}
                            alt={item.auction.title}
                            className="w-20 h-20 object-cover rounded-md flex-shrink-0"
                          />
                        )}
                        <div className="flex-1 min-w-0">
                          <h3 className="font-medium truncate" data-testid={`text-title-${item.id}`}>
                            {item.auction.title}
                          </h3>
                          <p className="text-sm text-muted-foreground" data-testid={`text-code-${item.id}`}>
                            {item.auction.internalCode}
                          </p>
                          <div className="flex items-center gap-4 mt-2">
                            <div className="flex items-center gap-1.5 text-lg font-bold text-primary">
                              <MapPin className="w-5 h-5" />
                              <span data-testid={`text-shelf-${item.id}`}>{item.shelfCode}</span>
                            </div>
                            <div className="flex items-center gap-1 text-xs text-muted-foreground">
                              <Clock className="w-3 h-3" />
                              {item.timestamp.toLocaleTimeString()}
                            </div>
                          </div>
                        </div>
                        <Button
                          size="lg"
                          onClick={() => markAsShelved(item.id)}
                          className="flex-shrink-0"
                          data-testid={`button-shelved-${item.id}`}
                        >
                          <CheckCircle2 className="w-5 h-5 mr-2" />
                          Done
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}

            {shelvedItems.length > 0 && (
              <div className="space-y-3 opacity-60">
                <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
                  Shelved ({shelvedItems.length})
                </h2>
                {shelvedItems.map((item) => (
                  <Card 
                    key={item.id}
                    className="bg-muted/30"
                    data-testid={`card-shelved-item-${item.id}`}
                  >
                    <CardContent className="p-3">
                      <div className="flex items-center gap-3">
                        <CheckCircle2 className="w-5 h-5 text-green-500 flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm truncate">{item.auction.title}</p>
                          <p className="text-xs text-muted-foreground">
                            {item.shelfCode} • {item.auction.internalCode}
                          </p>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => removeItem(item.id)}
                          data-testid={`button-remove-${item.id}`}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}
