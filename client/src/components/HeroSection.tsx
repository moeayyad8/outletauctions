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
      className="flex-shrink-0 w-20 cursor-pointer hover-elevate rounded-md p-1"
      data-testid={`card-featured-auction-${auction.id}`}
    >
      <div className="aspect-square rounded-md overflow-hidden bg-muted mb-1">
        {auction.image ? (
          <img 
            src={auction.image} 
            alt={auction.title}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-muted-foreground">
            <Gavel className="w-6 h-6" />
          </div>
        )}
      </div>
      <div className="space-y-0.5">
        {discount && discount > 0 && (
          <span className="text-[10px] font-semibold text-destructive">-{discount}%</span>
        )}
        <p className="text-xs font-bold">{formatPrice(displayPrice)}</p>
      </div>
    </div>
  );
}

export function HeroSection() {
  const { data: auctions = [], isLoading } = useQuery<Auction[]>({
    queryKey: ['/api/auctions/homepage'],
  });

  // Limit to 3 items max
  const displayAuctions = auctions.slice(0, 3);

  const earliestEndTime = useMemo(() => {
    if (auctions.length === 0) return null;
    const withEndTimes = auctions.filter(a => a.endTime);
    if (withEndTimes.length === 0) return null;
    return new Date(Math.min(...withEndTimes.map(a => new Date(a.endTime!).getTime())));
  }, [auctions]);

  return (
    <div className="bg-muted/50 rounded-xl p-3" data-testid="hero-section">
      <div className="flex items-center gap-4">
        {/* Left Panel - Text Content */}
        <div className="flex-shrink-0 space-y-1">
          <h2 className="text-lg font-bold text-foreground">
            NO FEES
          </h2>
          {earliestEndTime && (
            <CountdownTimer endTime={earliestEndTime} />
          )}
        </div>

        {/* Right Panel - Products */}
        <div className="flex-1 flex justify-end">
          {isLoading ? (
            <div className="flex gap-2">
              {[1, 2, 3].map((i) => (
                <div key={i} className="flex-shrink-0 w-20">
                  <div className="aspect-square rounded-lg bg-muted animate-pulse mb-1" />
                  <div className="h-3 bg-muted rounded animate-pulse w-12" />
                </div>
              ))}
            </div>
          ) : displayAuctions.length > 0 ? (
            <div className="flex gap-2">
              {displayAuctions.map((auction) => (
                <ProductCard key={auction.id} auction={auction} />
              ))}
            </div>
          ) : (
            <div className="text-muted-foreground text-sm">
              No featured items
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
