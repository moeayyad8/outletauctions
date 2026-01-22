import { Button } from '@/components/ui/button';
import { Gavel } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { useState, useEffect, useMemo } from 'react';
import type { Auction } from '@shared/schema';

function formatPrice(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

function CountdownTimer({ endTime }: { endTime: Date }) {
  const [timeLeft, setTimeLeft] = useState({ days: 0, hours: 0, minutes: 0, seconds: 0 });

  useEffect(() => {
    const calculateTimeLeft = () => {
      const now = new Date().getTime();
      const end = new Date(endTime).getTime();
      const diff = Math.max(0, end - now);

      setTimeLeft({
        days: Math.floor(diff / (1000 * 60 * 60 * 24)),
        hours: Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)),
        minutes: Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60)),
        seconds: Math.floor((diff % (1000 * 60)) / 1000),
      });
    };

    calculateTimeLeft();
    const timer = setInterval(calculateTimeLeft, 1000);
    return () => clearInterval(timer);
  }, [endTime]);

  const formatUnit = (value: number) => value.toString().padStart(2, '0');

  return (
    <div className="flex items-center gap-1 text-sm font-mono">
      <span className="text-muted-foreground">Ends in</span>
      <div className="flex items-center gap-0.5">
        {timeLeft.days > 0 && (
          <>
            <span className="bg-background border rounded px-1.5 py-0.5 font-bold">{formatUnit(timeLeft.days)}</span>
            <span className="text-muted-foreground">:</span>
          </>
        )}
        <span className="bg-background border rounded px-1.5 py-0.5 font-bold">{formatUnit(timeLeft.hours)}</span>
        <span className="text-muted-foreground">:</span>
        <span className="bg-background border rounded px-1.5 py-0.5 font-bold">{formatUnit(timeLeft.minutes)}</span>
        <span className="text-muted-foreground">:</span>
        <span className="bg-background border rounded px-1.5 py-0.5 font-bold">{formatUnit(timeLeft.seconds)}</span>
      </div>
    </div>
  );
}

function ProductCard({ auction }: { auction: Auction }) {
  const discount = auction.retailPrice && auction.currentBid 
    ? Math.round(((auction.retailPrice - auction.currentBid) / auction.retailPrice) * 100)
    : auction.retailPrice && auction.startingBid
    ? Math.round(((auction.retailPrice - auction.startingBid) / auction.retailPrice) * 100)
    : null;

  const displayPrice = auction.currentBid > 0 ? auction.currentBid : auction.startingBid;

  return (
    <div 
      className="flex-shrink-0 w-28 cursor-pointer hover-elevate rounded-lg p-1"
      data-testid={`card-featured-auction-${auction.id}`}
    >
      <div className="aspect-square rounded-lg overflow-hidden bg-muted mb-2 relative">
        {auction.image ? (
          <img 
            src={auction.image} 
            alt={auction.title}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-muted-foreground">
            <Gavel className="w-8 h-8" />
          </div>
        )}
      </div>
      <div className="space-y-0.5">
        {discount && discount > 0 && (
          <span className="text-xs font-semibold text-destructive">-{discount}%</span>
        )}
        <p className="text-sm font-bold">{formatPrice(displayPrice)}</p>
      </div>
    </div>
  );
}

export function HeroSection() {
  const { data: auctions = [], isLoading } = useQuery<Auction[]>({
    queryKey: ['/api/auctions/homepage'],
  });

  const earliestEndTime = useMemo(() => {
    if (auctions.length === 0) return null;
    const withEndTimes = auctions.filter(a => a.endTime);
    if (withEndTimes.length === 0) return null;
    return new Date(Math.min(...withEndTimes.map(a => new Date(a.endTime!).getTime())));
  }, [auctions]);

  return (
    <div className="bg-muted/50 rounded-xl p-4 overflow-hidden" data-testid="hero-section">
      <div className="flex flex-col sm:flex-row gap-4">
        {/* Left Panel - Text Content */}
        <div className="flex-shrink-0 sm:w-40 space-y-3">
          <h2 className="text-xl font-bold text-foreground">
            NO FEES
          </h2>
          {earliestEndTime && (
            <CountdownTimer endTime={earliestEndTime} />
          )}
          <Button
            size="sm"
            className="gap-2"
            data-testid="button-hero-browse"
          >
            <Gavel className="h-4 w-4" />
            Bid Now
          </Button>
        </div>

        {/* Right Panel - Scrolling Products */}
        <div className="flex-1 overflow-hidden">
          {isLoading ? (
            <div className="flex gap-3 overflow-x-auto pb-2">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="flex-shrink-0 w-28">
                  <div className="aspect-square rounded-lg bg-muted animate-pulse mb-2" />
                  <div className="h-4 bg-muted rounded animate-pulse w-16" />
                </div>
              ))}
            </div>
          ) : auctions.length > 0 ? (
            <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
              {auctions.map((auction) => (
                <ProductCard key={auction.id} auction={auction} />
              ))}
            </div>
          ) : (
            <div className="flex items-center justify-center h-28 text-muted-foreground text-sm">
              No featured items yet
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
