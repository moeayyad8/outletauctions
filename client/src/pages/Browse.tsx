import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { HeroSection } from '@/components/HeroSection';
import { AuctionCard } from '@/components/AuctionCard';
import { BidDialog } from '@/components/BidDialog';
import { BottomNav } from '@/components/BottomNav';
import { Bell, LogIn, LogOut, Package, Shirt, Gavel } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { apiRequest, queryClient } from '@/lib/queryClient';

import logoImg from '@assets/OUTLET AUCTIONS_1762736482366.png';
import type { Auction, ClothesItem } from '@shared/schema';

type TabType = 'auctions' | 'clothes';

export default function Browse() {
  const [activeTab, setActiveTab] = useState<TabType>('auctions');
  const [bidDialogOpen, setBidDialogOpen] = useState(false);
  const [selectedAuction, setSelectedAuction] = useState<Auction | null>(null);
  const { toast } = useToast();
  const { isAuthenticated, isLoading } = useAuth();

  const { data: auctions = [], isLoading: auctionsLoading } = useQuery<Auction[]>({
    queryKey: ['/api/auctions'],
  });

  const { data: clothesItems = [], isLoading: clothesLoading } = useQuery<ClothesItem[]>({
    queryKey: ['/api/clothes'],
  });

  const handleBid = (auction: Auction) => {
    if (!isAuthenticated) {
      toast({
        title: 'Login required',
        description: 'Please log in to place a bid.',
        variant: 'destructive',
      });
      setTimeout(() => {
        window.location.href = '/api/login';
      }, 500);
      return;
    }
    setSelectedAuction(auction);
    setBidDialogOpen(true);
  };

  const bidMutation = useMutation({
    mutationFn: async (data: { auctionId: number; amount: number; auctionTitle: string; auctionImage: string }) => {
      return apiRequest('POST', '/api/bids', data);
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['/api/bids'] });
      queryClient.invalidateQueries({ queryKey: ['/api/auctions'] });
      setBidDialogOpen(false);
      toast({
        title: 'Bid placed successfully!',
        description: `Your bid of $${variables.amount.toLocaleString()} has been placed.`,
      });
    },
    onError: () => {
      toast({
        title: 'Failed to place bid',
        description: 'Please try again.',
        variant: 'destructive',
      });
    },
  });

  const handleBidSubmit = (amount: number) => {
    if (!selectedAuction) return;
    bidMutation.mutate({
      auctionId: selectedAuction.id,
      amount,
      auctionTitle: selectedAuction.title,
      auctionImage: selectedAuction.image || '',
    });
  };

  return (
    <div className="min-h-screen bg-background pb-20">
      <header className="sticky top-0 z-40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b">
        <div className="flex items-center justify-between h-14 px-4">
          <img 
            src={logoImg} 
            alt="Outlet Auction" 
            className="h-8"
            data-testid="img-logo"
          />
          <div className="flex items-center gap-2">
            <Button size="icon" variant="ghost" data-testid="button-notifications">
              <Bell className="h-5 w-5" />
            </Button>
            {!isLoading && (
              isAuthenticated ? (
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => window.location.href = '/api/logout'}
                  data-testid="button-logout"
                >
                  <LogOut className="h-5 w-5" />
                </Button>
              ) : (
                <Button
                  size="sm"
                  onClick={() => window.location.href = '/api/login'}
                  data-testid="button-login"
                >
                  <LogIn className="h-4 w-4 mr-2" />
                  Login
                </Button>
              )
            )}
          </div>
        </div>
      </header>
      <main className="px-4 pt-4 space-y-4">
        <HeroSection />

        {/* Tab Bar */}
        <div className="flex gap-2 p-1 bg-muted rounded-lg" data-testid="tab-bar">
          <button
            onClick={() => setActiveTab('auctions')}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-md text-sm font-medium transition-colors ${
              activeTab === 'auctions'
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}
            data-testid="tab-auctions"
          >
            <Gavel className="w-4 h-4" />
            <span>Auctions</span>
            <Badge variant="secondary" className="ml-1 text-xs px-1.5 py-0">
              {auctions.length}
            </Badge>
          </button>
          <button
            onClick={() => setActiveTab('clothes')}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-md text-sm font-medium transition-colors ${
              activeTab === 'clothes'
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}
            data-testid="tab-clothes"
          >
            <Shirt className="w-4 h-4" />
            <span>Clothes</span>
            <Badge variant="secondary" className="ml-1 text-xs px-1.5 py-0">
              {clothesItems.length}
            </Badge>
          </button>
        </div>

        {/* Auctions Tab Content */}
        {activeTab === 'auctions' && (
          <>
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold">Active Auctions</h2>
                <p className="text-sm text-muted-foreground">{auctions.length} items in inventory</p>
              </div>
              <Badge variant="secondary" data-testid="badge-ending-soon">
                Ending Soon
              </Badge>
            </div>

            {auctionsLoading ? (
              <div className="grid grid-cols-2 gap-3">
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className="aspect-square bg-muted animate-pulse rounded-lg" />
                ))}
              </div>
            ) : auctions.length === 0 ? (
              <div className="text-center py-16 px-4">
                <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mx-auto mb-4">
                  <Gavel className="w-8 h-8 text-muted-foreground" />
                </div>
                <h3 className="font-semibold text-lg mb-1">No auction items</h3>
                <p className="text-muted-foreground text-sm max-w-xs mx-auto">
                  Scan items in the Staff page to add inventory
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                {auctions.map((auction) => (
                  <AuctionCard
                    key={auction.id}
                    id={String(auction.id)}
                    title={auction.title}
                    currentBid={auction.currentBid || auction.startingBid}
                    endTime={auction.endTime ? new Date(auction.endTime) : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)}
                    image={auction.image || ''}
                    bidCount={auction.bidCount}
                    onBid={() => handleBid(auction)}
                    onClick={() => console.log('Navigate to auction detail:', auction.id)}
                  />
                ))}
              </div>
            )}
          </>
        )}

        {/* Clothes Tab Content */}
        {activeTab === 'clothes' && (
          <>
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold">Clothes Inventory</h2>
                <p className="text-sm text-muted-foreground">{clothesItems.length} items</p>
              </div>
              <Badge variant="secondary" data-testid="badge-depop">Start Saving!</Badge>
            </div>

            {clothesLoading ? (
              <div className="grid grid-cols-2 gap-3">
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className="aspect-square bg-muted animate-pulse rounded-lg" />
                ))}
              </div>
            ) : clothesItems.length === 0 ? (
              <div className="text-center py-16 px-4">
                <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mx-auto mb-4">
                  <Shirt className="w-8 h-8 text-muted-foreground" />
                </div>
                <h3 className="font-semibold text-lg mb-1">No clothes items</h3>
                <p className="text-muted-foreground text-sm max-w-xs mx-auto">
                  Use the Clothes Scanner to add items for Depop
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                {clothesItems.map((item) => (
                  <Card 
                    key={item.id} 
                    className="overflow-hidden hover-elevate cursor-pointer"
                    data-testid={`card-clothes-${item.id}`}
                  >
                    <div className="aspect-square bg-muted relative">
                      {item.pictureHero ? (
                        <img 
                          src={item.pictureHero} 
                          alt={item.description || item.sku}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <Shirt className="w-8 h-8 text-muted-foreground" />
                        </div>
                      )}
                      {item.condition && (
                        <Badge 
                          variant="secondary" 
                          className="absolute top-2 left-2 text-xs"
                        >
                          {item.condition}
                        </Badge>
                      )}
                    </div>
                    <div className="p-3 space-y-1">
                      <p className="text-xs text-muted-foreground font-mono">{item.sku}</p>
                      <p className="text-sm font-medium line-clamp-2">
                        {item.description || 'No description'}
                      </p>
                      <div className="flex items-center justify-between">
                        {item.price ? (
                          <span className="text-sm font-semibold text-primary">
                            ${(item.price / 100).toFixed(2)}
                          </span>
                        ) : (
                          <span className="text-sm text-muted-foreground">No price</span>
                        )}
                        {item.size && (
                          <Badge variant="outline" className="text-xs">
                            {item.size}
                          </Badge>
                        )}
                      </div>
                      {item.brand && (
                        <p className="text-xs text-muted-foreground">{item.brand}</p>
                      )}
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </>
        )}
      </main>
      <BottomNav />
      {selectedAuction && (
        <BidDialog
          open={bidDialogOpen}
          onOpenChange={setBidDialogOpen}
          currentBid={selectedAuction.currentBid || selectedAuction.startingBid}
          onSubmit={handleBidSubmit}
        />
      )}
    </div>
  );
}
