import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { CountdownTimer } from '@/components/CountdownTimer';
import { BidDialog } from '@/components/BidDialog';
import { BottomNav } from '@/components/BottomNav';
import { ArrowLeft, Heart, Share2, Gavel, User } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';

//todo: remove mock functionality
import cameraImg from '@assets/generated_images/Vintage_camera_auction_item_567c74a8.png';

//todo: remove mock functionality
const mockBidHistory = [
  { id: '1', bidder: 'User***45', amount: 850, time: '2 min ago' },
  { id: '2', bidder: 'User***23', amount: 840, time: '15 min ago' },
  { id: '3', bidder: 'User***78', amount: 820, time: '1 hour ago' },
  { id: '4', bidder: 'User***45', amount: 800, time: '2 hours ago' },
];

export default function AuctionDetail() {
  const [bidDialogOpen, setBidDialogOpen] = useState(false);
  const [isFavorite, setIsFavorite] = useState(false);
  const { toast } = useToast();

  const handleBidSubmit = (amount: number) => {
    console.log('Bid submitted:', amount);
    toast({
      title: 'Bid placed successfully!',
      description: `Your bid of $${amount.toLocaleString()} has been placed.`,
    });
  };

  return (
    <div className="min-h-screen bg-background pb-24">
      <header className="sticky top-0 z-40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b">
        <div className="flex items-center justify-between h-14 px-4">
          <Button
            size="icon"
            variant="ghost"
            onClick={() => console.log('Navigate back')}
            data-testid="button-back"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex gap-2">
            <Button
              size="icon"
              variant="ghost"
              onClick={() => {
                setIsFavorite(!isFavorite);
                console.log('Favorite toggled');
              }}
              data-testid="button-favorite"
            >
              <Heart className={`h-5 w-5 ${isFavorite ? 'fill-destructive text-destructive' : ''}`} />
            </Button>
            <Button
              size="icon"
              variant="ghost"
              onClick={() => console.log('Share clicked')}
              data-testid="button-share"
            >
              <Share2 className="h-5 w-5" />
            </Button>
          </div>
        </div>
      </header>

      <div className="aspect-square bg-muted">
        <img
          src={cameraImg}
          alt="Vintage camera"
          className="w-full h-full object-cover"
          data-testid="img-auction-main"
        />
      </div>

      <div className="p-4 space-y-4">
        <div className="space-y-2">
          <div className="flex items-start justify-between gap-3">
            <h1 className="text-xl font-bold flex-1" data-testid="text-title">
              Vintage Analog Camera - Rare 1960s Film Camera
            </h1>
            <CountdownTimer endTime={new Date(Date.now() + 2 * 60 * 60 * 1000)} />
          </div>
          <Badge variant="secondary" data-testid="badge-category">Electronics</Badge>
        </div>

        <Card className="p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Current bid</p>
              <p className="text-2xl font-bold" data-testid="text-current-bid">$850</p>
            </div>
            <div className="text-right">
              <p className="text-sm text-muted-foreground">Total bids</p>
              <p className="text-xl font-semibold">12</p>
            </div>
          </div>
        </Card>

        <div className="space-y-3">
          <h2 className="font-semibold">Description</h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Beautiful vintage analog camera from the 1960s in excellent condition. This rare piece features a fully manual control system, leather detailing, and original lens. Perfect for collectors or photography enthusiasts looking for authentic vintage equipment.
          </p>
        </div>

        <Separator />

        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <Avatar data-testid="avatar-seller">
              <AvatarFallback>
                <User className="h-4 w-4" />
              </AvatarFallback>
            </Avatar>
            <div className="flex-1">
              <p className="font-medium text-sm">Seller: vintage_finds</p>
              <p className="text-xs text-muted-foreground">98.5% positive feedback</p>
            </div>
            <Button variant="outline" size="sm" data-testid="button-view-seller">
              View
            </Button>
          </div>
        </div>

        <Separator />

        <div className="space-y-3">
          <h2 className="font-semibold">Bid History</h2>
          <div className="space-y-2">
            {mockBidHistory.map((bid) => (
              <div
                key={bid.id}
                className="flex items-center justify-between text-sm p-2 rounded-md hover-elevate"
                data-testid={`bid-history-${bid.id}`}
              >
                <div>
                  <p className="font-medium">{bid.bidder}</p>
                  <p className="text-xs text-muted-foreground">{bid.time}</p>
                </div>
                <p className="font-semibold">${bid.amount}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="fixed bottom-16 left-0 right-0 p-4 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 border-t">
        <Button
          className="w-full gap-2"
          size="lg"
          onClick={() => setBidDialogOpen(true)}
          data-testid="button-place-bid"
        >
          <Gavel className="h-5 w-5" />
          Place Bid
        </Button>
      </div>

      <BottomNav />

      <BidDialog
        open={bidDialogOpen}
        onOpenChange={setBidDialogOpen}
        currentBid={850}
        onSubmit={handleBidSubmit}
      />
    </div>
  );
}
