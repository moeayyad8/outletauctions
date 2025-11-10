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
      <div className="relative aspect-square bg-muted overflow-hidden cursor-pointer" onClick={onClick}>
        <img
          src={image}
          alt="Auction item"
          className="w-full h-full object-cover"
          data-testid={`img-auction-${id}`}
        />
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
        <div className="flex justify-between items-start text-sm">
          <div>
            <p className="text-muted-foreground">Auction ending in:</p>
            <CountdownTimer endTime={endTime} compact />
          </div>
          <div className="text-right">
            <p className="text-muted-foreground">Retail price:</p>
            <p className="font-bold" data-testid={`text-bid-${id}`}>
              ${currentBid.toLocaleString()}
            </p>
          </div>
        </div>
        <Button
          onClick={handleBid}
          className="w-full gap-2"
          data-testid={`button-bid-${id}`}
        >
          <Gavel className="h-4 w-4" />
          Bid
        </Button>
      </div>
    </Card>
  );
}
