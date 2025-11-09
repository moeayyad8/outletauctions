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
  const [isFavorite, setIsFavorite] = useState(false);

  const handleFavorite = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsFavorite(!isFavorite);
    console.log(`Favorite toggled for auction ${id}: ${!isFavorite}`);
  };

  const handleBid = (e: React.MouseEvent) => {
    e.stopPropagation();
    onBid?.();
  };

  return (
    <Card
      className="overflow-hidden hover-elevate active-elevate-2 cursor-pointer"
      onClick={onClick}
      data-testid={`card-auction-${id}`}
    >
      <div className="flex gap-3 p-3">
        <div className="relative w-24 h-24 flex-shrink-0 rounded-md overflow-hidden bg-muted">
          <img
            src={image}
            alt={title}
            className="w-full h-full object-cover"
            data-testid={`img-auction-${id}`}
          />
          <Button
            size="icon"
            variant="ghost"
            className="absolute top-1 right-1 h-7 w-7 bg-background/80 backdrop-blur-sm hover:bg-background"
            onClick={handleFavorite}
            data-testid={`button-favorite-${id}`}
          >
            <Heart
              className={`h-4 w-4 ${isFavorite ? 'fill-destructive text-destructive' : ''}`}
            />
          </Button>
        </div>

        <div className="flex-1 min-w-0 flex flex-col gap-2">
          <div>
            <h3 className="font-semibold text-sm line-clamp-2" data-testid={`text-title-${id}`}>
              {title}
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              {bidCount} {bidCount === 1 ? 'bid' : 'bids'}
            </p>
          </div>

          <div className="mt-auto flex items-center justify-between gap-2">
            <div className="flex flex-col">
              <span className="text-xs text-muted-foreground">Current bid</span>
              <span className="text-lg font-bold" data-testid={`text-bid-${id}`}>
                ${currentBid.toLocaleString()}
              </span>
            </div>
            <Button
              size="sm"
              onClick={handleBid}
              className="gap-1.5"
              data-testid={`button-bid-${id}`}
            >
              <Gavel className="h-3.5 w-3.5" />
              Bid
            </Button>
          </div>
        </div>
      </div>

      <div className="px-3 pb-3">
        <CountdownTimer endTime={endTime} />
      </div>
    </Card>
  );
}
