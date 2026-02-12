import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { HeroSection } from '@/components/HeroSection';
import { AuctionCard } from '@/components/AuctionCard';
import { BidDialog } from '@/components/BidDialog';
import { BottomNav } from '@/components/BottomNav';
import { Bell, LogIn, LogOut, Shirt, Gavel, Tv, Home, Puzzle, Footprints, Trees, Dumbbell, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { redirectToLogin } from '@/lib/authRedirect';
import { supabase } from '@/lib/supabaseClient';

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
        <HeroSection />

        {/* Category Circles */}
        <div className="overflow-x-auto scrollbar-hide -mx-4 px-4" data-testid="category-bar">
          <div className="flex gap-4">
            {categories.map((category) => {
              const Icon = category.icon;
              const isActive = activeCategory === category.id;
              return (
                <button
                  key={category.id}
                  onClick={() => setActiveCategory(isActive ? 'all' : category.id)}
                  className="flex flex-col items-center gap-1.5 flex-shrink-0"
                  data-testid={`category-${category.id}`}
                >
                  <div className={`w-14 h-14 rounded-full flex items-center justify-center transition-colors ${
                    isActive 
                      ? 'bg-primary text-primary-foreground' 
                      : 'bg-muted text-muted-foreground'
                  }`}>
                    <Icon className="w-6 h-6" />
                  </div>
                  <span className={`text-[11px] font-medium ${isActive ? 'text-foreground' : 'text-muted-foreground'}`}>
                    {category.label}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Auctions Content */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold">
              {activeCategory === 'all' ? 'All Items' : categories.find(c => c.id === activeCategory)?.label}
            </h2>
            <p className="text-sm text-muted-foreground">{auctions.length} items</p>
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
