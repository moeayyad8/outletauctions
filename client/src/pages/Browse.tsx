import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { HeroSection } from '@/components/HeroSection';
import { AuctionCard } from '@/components/AuctionCard';
import { BidDialog } from '@/components/BidDialog';
import { BottomNav } from '@/components/BottomNav';
import { Bell, LogIn, LogOut, Package } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { apiRequest, queryClient } from '@/lib/queryClient';

import logoImg from '@assets/OUTLET AUCTIONS_1762736482366.png';
import type { Auction } from '@shared/schema';

export default function Browse() {
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

      <main className="px-4 pt-4 space-y-6">
        <HeroSection />

        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold">Active Auctions</h2>
            <p className="text-sm text-muted-foreground">{auctions.length} items available</p>
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
              <Package className="w-8 h-8 text-muted-foreground" />
            </div>
            <h3 className="font-semibold text-lg mb-1">No active auctions</h3>
            <p className="text-muted-foreground text-sm max-w-xs mx-auto">
              Check back soon for new items
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
