import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CountdownTimer } from './CountdownTimer';
import { Gavel, Heart } from 'lucide-react';
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
      <div className="relative aspect-square bg-muted overflow-hidden">
        <img
          src={image}
          alt={title}
          className="w-full h-full object-cover cursor-pointer hover-elevate active-elevate-2"
          onClick={onClick}
          data-testid={`img-auction-${id}`}
        />
        <div className="absolute top-2 left-2">
          <CountdownTimer endTime={endTime} />
        </div>
        <div className="absolute bottom-0 left-0 right-0 p-3">
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={handleWatch}
              className="flex-1 bg-white/10 border-white/30 backdrop-blur-md text-white hover:bg-white/20"
              data-testid={`button-watch-${id}`}
            >
              <Heart className={`h-4 w-4 ${isWatching ? 'fill-white' : ''}`} />
            </Button>
            <Button
              onClick={handleBid}
              className="flex-[2] gap-2"
              data-testid={`button-bid-${id}`}
            >
              <Gavel className="h-4 w-4" />
              Bid ${nextBid.toLocaleString()}
            </Button>
          </div>
        </div>
      </div>

      <div className="p-3 space-y-1" onClick={onClick}>
        <h3 className="font-semibold text-base line-clamp-2 cursor-pointer" data-testid={`text-title-${id}`}>
          {title}
        </h3>
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            {bidCount} {bidCount === 1 ? 'bid' : 'bids'}
          </p>
          <p className="text-xl font-bold" data-testid={`text-bid-${id}`}>
            ${currentBid.toLocaleString()}
          </p>
        </div>
      </div>
    </Card>
  );
}
