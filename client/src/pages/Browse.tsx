import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { AuctionCard } from '@/components/AuctionCard';
import { BidDialog } from '@/components/BidDialog';
import { BottomNav } from '@/components/BottomNav';
import { Bell, LogIn, LogOut, Shirt, Gavel, Tv, Home, Puzzle, Footprints, Trees, Dumbbell, Sparkles, Truck, Warehouse, ArrowUpRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { redirectToLogin } from '@/lib/authRedirect';
import { supabase } from '@/lib/supabaseClient';
import { useLocation } from 'wouter';

import logoImg from '@assets/OUTLET AUCTIONS_1762736482366.png';
import type { Auction } from '@shared/schema';

type CategoryType = 'all' | 'electronics' | 'home' | 'toys' | 'clothes' | 'shoes' | 'outdoors' | 'sports' | 'fragrances';

const categories: { id: CategoryType; label: string; icon: typeof Tv }[] = [
  { id: 'electronics', label: 'Electronics', icon: Tv },
  { id: 'home', label: 'Home', icon: Home },
  { id: 'toys', label: 'Toys', icon: Puzzle },
  { id: 'clothes', label: 'Clothes', icon: Shirt },
  { id: 'shoes', label: 'Shoes', icon: Footprints },
  { id: 'outdoors', label: 'Outdoors', icon: Trees },
  { id: 'sports', label: 'Sports', icon: Dumbbell },
  { id: 'fragrances', label: 'Fragrance', icon: Sparkles },
];

export default function Browse() {
  const [activeCategory, setActiveCategory] = useState<CategoryType>('all');
  const [bidDialogOpen, setBidDialogOpen] = useState(false);
  const [selectedAuction, setSelectedAuction] = useState<Auction | null>(null);
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { isAuthenticated, isLoading } = useAuth();

  const { data: auctions = [], isLoading: auctionsLoading } = useQuery<Auction[]>({
    queryKey: ['/api/auctions'],
  });

  const handleBid = (auction: Auction) => {
    if (!isAuthenticated) {
      toast({
        title: 'Login required',
        description: 'Please log in to place a bid.',
        variant: 'destructive',
      });
      setTimeout(() => {
        redirectToLogin();
      }, 500);
      return;
    }
    setSelectedAuction(auction);
    setBidDialogOpen(true);
  };

  const handleLogout = async () => {
    if (supabase) {
      await supabase.auth.signOut();
      queryClient.invalidateQueries({ queryKey: ['/api/auth/user'] });
      toast({ title: 'Signed out' });
      return;
    }
    window.location.href = '/api/logout';
  };

  const bidMutation = useMutation({
    mutationFn: async (data: { auctionId: number; amount: number; auctionTitle: string; auctionImage: string }) => {
      const response = await apiRequest('POST', '/api/bids', data);
      if (!response.ok) {
        const errorData = await response.json();
        throw errorData;
      }
      return response;
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
    onError: (error: any) => {
      if (error?.code === 'NO_PAYMENT_METHOD') {
        toast({
          title: 'Payment method required',
          description: 'Please add a payment method in your profile before placing bids.',
          variant: 'destructive',
        });
        setBidDialogOpen(false);
        setTimeout(() => {
          window.location.href = '/profile';
        }, 1500);
      } else if (error?.code === 'BIDDING_BLOCKED') {
        toast({
          title: 'Bidding blocked',
          description: error.message || 'Your bidding privileges are currently blocked.',
          variant: 'destructive',
        });
        setBidDialogOpen(false);
      } else {
        toast({
          title: 'Failed to place bid',
          description: error?.message || 'Please try again.',
          variant: 'destructive',
        });
      }
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

  const categoryKeywords: Record<Exclude<CategoryType, 'all'>, string[]> = {
    electronics: ['electronic', 'tv', 'laptop', 'monitor', 'camera', 'phone', 'headphone', 'speaker', 'console'],
    home: ['home', 'kitchen', 'furniture', 'sofa', 'table', 'chair', 'dresser', 'cabinet', 'mattress', 'appliance'],
    toys: ['toy', 'lego', 'game', 'figure', 'doll', 'plush'],
    clothes: ['shirt', 'hoodie', 'jacket', 'pants', 'dress', 'clothes', 'apparel'],
    shoes: ['shoe', 'sneaker', 'boot', 'sandals', 'footwear'],
    outdoors: ['outdoor', 'patio', 'camp', 'grill', 'garden', 'tent', 'bike'],
    sports: ['sport', 'fitness', 'dumbbell', 'treadmill', 'weights', 'golf', 'baseball'],
    fragrances: ['fragrance', 'perfume', 'cologne', 'scent'],
  };

  const matchesCategory = (auction: Auction, category: CategoryType) => {
    if (category === 'all') return true;
    const haystack = `${auction.title || ''} ${auction.category || ''}`.toLowerCase();
    return categoryKeywords[category].some((keyword) => haystack.includes(keyword));
  };

  const isLocalPickupCandidate = (auction: Auction) => {
    const text = `${auction.title || ''} ${auction.category || ''}`.toLowerCase();
    const pickupKeywords = [
      'sofa', 'couch', 'sectional', 'mattress', 'dresser', 'cabinet', 'table', 'desk', 'chair',
      'bike', 'treadmill', 'elliptical', 'barbell', 'grill', 'generator', 'patio', 'large', 'oversize'
    ];
    return pickupKeywords.some((keyword) => text.includes(keyword));
  };

  const filteredAuctions = auctions.filter((auction) => matchesCategory(auction, activeCategory));
  const localPickupAuctions = filteredAuctions.filter(isLocalPickupCandidate);
  const mixedInventoryAuctions = filteredAuctions.filter((auction) => !isLocalPickupCandidate(auction));
  const endingSoonCount = filteredAuctions.filter((auction) => {
    if (!auction.endTime) return false;
    const diff = new Date(auction.endTime).getTime() - Date.now();
    return diff > 0 && diff <= 24 * 60 * 60 * 1000;
  }).length;

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
                  onClick={handleLogout}
                  data-testid="button-logout"
                >
                  <LogOut className="h-5 w-5" />
                </Button>
              ) : (
                <Button
                  size="sm"
                  onClick={redirectToLogin}
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
        <section className="relative overflow-hidden rounded-2xl border bg-gradient-to-br from-blue-600 via-blue-500 to-cyan-500 text-white p-4">
          <div className="absolute -right-8 -top-8 w-36 h-36 rounded-full bg-white/10" />
          <div className="absolute -left-10 -bottom-12 w-40 h-40 rounded-full bg-black/10" />
          <div className="relative z-10 space-y-3">
            <div className="inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-xs font-semibold tracking-wide">
              <Warehouse className="h-3.5 w-3.5" />
              LOCAL AUCTION MARKET
            </div>
            <h1 className="text-2xl font-extrabold leading-tight">
              Big local-only deals plus fresh mixed inventory drops
            </h1>
            <p className="text-sm text-blue-50/95">
              Built for bulky, non-shippable items with new everyday inventory added throughout the week.
            </p>
            <div className="grid grid-cols-3 gap-2 pt-1">
              <div className="rounded-xl bg-white/15 p-2">
                <div className="text-lg font-bold">{filteredAuctions.length}</div>
                <div className="text-[11px] text-blue-50">Live Lots</div>
              </div>
              <div className="rounded-xl bg-white/15 p-2">
                <div className="text-lg font-bold">{localPickupAuctions.length}</div>
                <div className="text-[11px] text-blue-50">Pickup First</div>
              </div>
              <div className="rounded-xl bg-white/15 p-2">
                <div className="text-lg font-bold">{endingSoonCount}</div>
                <div className="text-[11px] text-blue-50">Ending 24h</div>
              </div>
            </div>
          </div>
        </section>

        {/* Category Filter */}
        <div className="overflow-x-auto scrollbar-hide -mx-4 px-4" data-testid="category-bar">
          <div className="flex gap-2">
            <button
              onClick={() => setActiveCategory('all')}
              className={`px-3 py-2 rounded-full text-xs font-semibold border transition-colors ${
                activeCategory === 'all'
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'bg-card text-muted-foreground border-border hover:text-foreground'
              }`}
              data-testid="category-all"
            >
              All
            </button>
            {categories.map((category) => {
              const Icon = category.icon;
              const isActive = activeCategory === category.id;
              return (
                <button
                  key={category.id}
                  onClick={() => setActiveCategory(isActive ? 'all' : category.id)}
                  className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-full border text-xs font-semibold transition-colors flex-shrink-0 ${
                    isActive
                      ? 'bg-primary text-primary-foreground border-primary'
                      : 'bg-card text-muted-foreground border-border hover:text-foreground'
                  }`}
                  data-testid={`category-${category.id}`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span>{category.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Auctions Content */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold">
              {activeCategory === 'all' ? 'Current Marketplace' : categories.find(c => c.id === activeCategory)?.label}
            </h2>
            <p className="text-sm text-muted-foreground">{filteredAuctions.length} items</p>
          </div>
          <Badge variant="secondary" className="gap-1" data-testid="badge-ending-soon">
            <Truck className="w-3 h-3" />
            Pickup Ready
          </Badge>
        </div>

        {auctionsLoading ? (
          <div className="grid grid-cols-2 gap-3">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="aspect-square bg-muted animate-pulse rounded-lg" />
            ))}
          </div>
        ) : filteredAuctions.length === 0 ? (
          <div className="text-center py-16 px-4">
            <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mx-auto mb-4">
              <Gavel className="w-8 h-8 text-muted-foreground" />
            </div>
            <h3 className="font-semibold text-lg mb-1">No items in this category yet</h3>
            <p className="text-muted-foreground text-sm max-w-xs mx-auto">
              Scan items in the Staff page to add inventory
            </p>
          </div>
        ) : (
          <div className="space-y-5">
            <section className="space-y-2">
              <div className="flex items-center justify-between">
                <h3 className="text-base font-semibold">Local Pickup Spotlight</h3>
                <Badge variant="outline" className="gap-1">
                  <Truck className="w-3 h-3" />
                  No Shipping
                </Badge>
              </div>
              {localPickupAuctions.length === 0 ? (
                <div className="rounded-xl border bg-card p-4 text-sm text-muted-foreground">
                  No oversized/local-only candidates in this filter right now.
                </div>
              ) : (
                <div className="overflow-x-auto scrollbar-hide -mx-4 px-4">
                  <div className="flex gap-3 min-w-max">
                    {localPickupAuctions.slice(0, 8).map((auction) => (
                      <div key={auction.id} className="w-56">
                        <AuctionCard
                          id={String(auction.id)}
                          title={auction.title}
                          currentBid={auction.currentBid || auction.startingBid}
                          endTime={auction.endTime ? new Date(auction.endTime) : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)}
                          image={auction.image || ''}
                          bidCount={auction.bidCount}
                          onBid={() => handleBid(auction)}
                          onClick={() => setLocation(`/auction/${auction.id}`)}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </section>

            <section className="space-y-2">
              <div className="flex items-center justify-between">
                <h3 className="text-base font-semibold">Mixed Inventory Drops</h3>
                <span className="text-xs text-muted-foreground inline-flex items-center gap-1">
                  View lot
                  <ArrowUpRight className="w-3 h-3" />
                </span>
              </div>
              <div className="grid grid-cols-2 gap-3">
                {(mixedInventoryAuctions.length > 0 ? mixedInventoryAuctions : filteredAuctions).map((auction) => (
                  <AuctionCard
                    key={auction.id}
                    id={String(auction.id)}
                    title={auction.title}
                    currentBid={auction.currentBid || auction.startingBid}
                    endTime={auction.endTime ? new Date(auction.endTime) : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)}
                    image={auction.image || ''}
                    bidCount={auction.bidCount}
                    onBid={() => handleBid(auction)}
                    onClick={() => setLocation(`/auction/${auction.id}`)}
                  />
                ))}
              </div>
            </section>
          </div>
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
