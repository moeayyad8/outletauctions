import { Gavel, Clock, Sparkles } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { useState, useEffect, useMemo } from 'react';
import type { Auction } from '@shared/schema';

function formatPrice(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

function formatTimeLeft(endTime: Date): string {
  const now = new Date().getTime();
  const end = new Date(endTime).getTime();
  const diff = Math.max(0, end - now);
  
  const hours = Math.floor(diff / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  
  if (hours > 24) {
    const days = Math.floor(hours / 24);
    return `${days}d ${hours % 24}h`;
  }
  return `${hours}h ${minutes}m`;
}

export function HeroSection() {
  const { data: auctions = [], isLoading } = useQuery<Auction[]>({
    queryKey: ['/api/auctions/homepage'],
  });

  const [, setTick] = useState(0);
  
  useEffect(() => {
    const timer = setInterval(() => setTick(t => t + 1), 60000);
    return () => clearInterval(timer);
  }, []);

  const displayAuctions = auctions.slice(0, 3);

  const earliestEndTime = useMemo(() => {
    if (auctions.length === 0) return null;
    const withEndTimes = auctions.filter(a => a.endTime);
    if (withEndTimes.length === 0) return null;
    return new Date(Math.min(...withEndTimes.map(a => new Date(a.endTime!).getTime())));
  }, [auctions]);

  if (isLoading) {
    return (
      <div className="bg-gradient-to-r from-primary/10 to-primary/5 rounded-xl p-4 animate-pulse" data-testid="hero-section">
        <div className="h-16" />
      </div>
    );
  }

  if (displayAuctions.length === 0) {
    return null;
  }

  return (
    <div 
      className="relative bg-gradient-to-r from-primary/15 via-primary/10 to-primary/5 dark:from-primary/20 dark:via-primary/15 dark:to-primary/10 rounded-xl overflow-hidden"
      data-testid="hero-section"
    >
      <div className="flex items-center justify-between p-4 gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <Sparkles className="w-4 h-4 text-primary" />
            <span className="text-xs font-medium text-primary uppercase tracking-wide">Featured</span>
          </div>
          <h2 className="text-xl font-bold tracking-tight">
            0% Fees
          </h2>
          {earliestEndTime && (
            <div className="flex items-center gap-1.5 mt-1 text-sm text-muted-foreground">
              <Clock className="w-3.5 h-3.5" />
              <span>Ends in {formatTimeLeft(earliestEndTime)}</span>
            </div>
          )}
        </div>

        <div className="flex items-center -space-x-3">
          {displayAuctions.map((auction, index) => (
            <div
              key={auction.id}
              className="relative w-14 h-14 rounded-lg overflow-hidden border-2 border-background shadow-md"
              style={{ zIndex: displayAuctions.length - index }}
              data-testid={`card-featured-auction-${auction.id}`}
            >
              {auction.image ? (
                <img 
                  src={auction.image} 
                  alt={auction.title}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full bg-muted flex items-center justify-center">
                  <Gavel className="w-5 h-5 text-muted-foreground" />
                </div>
              )}
            </div>
          ))}
          {displayAuctions.length > 0 && (
            <div className="relative w-14 h-14 rounded-lg bg-background border-2 border-background shadow-md flex items-center justify-center">
              <span className="text-xs font-bold text-primary">+{auctions.length}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
