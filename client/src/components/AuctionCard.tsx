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
      className="overflow-hidden"
      data-testid={`card-auction-${id}`}
    >
      <div className="relative aspect-[4/3] bg-muted overflow-hidden" onClick={onClick}>
        <img
          src={image}
          alt={title}
          className="w-full h-full object-cover cursor-pointer hover-elevate active-elevate-2"
          data-testid={`img-auction-${id}`}
        />
        <Button
          size="icon"
          variant="ghost"
          className="absolute top-2 right-2 h-8 w-8 bg-background/80 backdrop-blur-sm hover:bg-background"
          onClick={handleFavorite}
          data-testid={`button-favorite-${id}`}
        >
          <Heart
            className={`h-4 w-4 ${isFavorite ? 'fill-destructive text-destructive' : ''}`}
          />
        </Button>
        <div className="absolute bottom-2 left-2">
          <CountdownTimer endTime={endTime} />
        </div>
      </div>

      <div className="p-4 space-y-3">
        <div onClick={onClick} className="cursor-pointer">
          <h3 className="font-semibold text-base line-clamp-2" data-testid={`text-title-${id}`}>
            {title}
          </h3>
          <p className="text-sm text-muted-foreground mt-1">
            {bidCount} {bidCount === 1 ? 'bid' : 'bids'}
          </p>
        </div>

        <div className="flex items-end justify-between gap-3">
          <div className="flex flex-col">
            <span className="text-sm text-muted-foreground">Current bid</span>
            <span className="text-2xl font-bold" data-testid={`text-bid-${id}`}>
              ${currentBid.toLocaleString()}
            </span>
          </div>
          <Button
            onClick={handleBid}
            className="gap-2"
            size="lg"
            data-testid={`button-bid-${id}`}
          >
            <Gavel className="h-4 w-4" />
            Place Bid
          </Button>
        </div>
      </div>
    </Card>
  );
}
