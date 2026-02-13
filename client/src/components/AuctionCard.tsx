import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CountdownTimer } from './CountdownTimer';
import { Gavel, Heart, Package } from 'lucide-react';
import { useState } from 'react';

interface AuctionCardProps {
  id: string;
  title: string;
  currentBid: number;
  endTime: Date;
  image: string;
  bidCount: number;
  onBid?: () => void;
  onClick?: () => void;
}

export function AuctionCard({
  id,
  title,
  currentBid,
  endTime,
  image,
  bidCount,
  onBid,
  onClick,
}: AuctionCardProps) {
  const [isWatching, setIsWatching] = useState(false);

  const handleWatch = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsWatching(!isWatching);
    console.log(`Watch toggled for auction ${id}: ${!isWatching}`);
  };

  const handleBid = (e: React.MouseEvent) => {
    e.stopPropagation();
    onBid?.();
  };

  const nextBid = currentBid + 1;

  return (
    <Card
      className="overflow-hidden"
      data-testid={`card-auction-${id}`}
    >
      <div className="relative aspect-square bg-muted overflow-hidden cursor-pointer" onClick={onClick}>
        {image ? (
          <img
            src={image}
            alt={title}
            className="w-full h-full object-cover"
            data-testid={`img-auction-${id}`}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Package className="h-8 w-8 text-muted-foreground" />
          </div>
        )}
        <div className="absolute top-2 right-2">
          <Button
            variant="outline"
            size="icon"
            onClick={handleWatch}
            className="bg-white/10 border-white/30 backdrop-blur-md text-white hover:bg-white/20"
            data-testid={`button-watch-${id}`}
          >
            <Heart className={`h-4 w-4 ${isWatching ? 'fill-white' : ''}`} />
          </Button>
        </div>
      </div>

      <div className="p-3 space-y-2">
        <p className="text-sm font-semibold leading-tight line-clamp-2 min-h-[2.5rem]">{title}</p>
        <div className="flex justify-between items-start text-sm">
          <div>
            <p className="text-muted-foreground">Ending in</p>
            <CountdownTimer endTime={endTime} compact />
          </div>
          <div className="text-right">
            <p className="text-muted-foreground">Current Bid</p>
            <p className="font-bold" data-testid={`text-retail-${id}`}>
              ${currentBid.toLocaleString()}
            </p>
          </div>
        </div>
        <div className="flex items-center justify-between gap-2">
          <Button
            onClick={handleBid}
            className="flex-1 gap-2"
            data-testid={`button-bid-${id}`}
          >
            <Gavel className="h-4 w-4" />
            <span data-testid={`text-bid-${id}`}>Bid ${nextBid.toLocaleString()}</span>
          </Button>
          <p className="text-xs text-muted-foreground whitespace-nowrap">
            {bidCount} {bidCount === 1 ? 'bid' : 'bids'}
          </p>
        </div>
      </div>
    </Card>
  );
}
