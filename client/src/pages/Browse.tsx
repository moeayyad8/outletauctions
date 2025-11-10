import { useState } from 'react';
import { HeroSection } from '@/components/HeroSection';
import { AuctionCard } from '@/components/AuctionCard';
import { BidDialog } from '@/components/BidDialog';
import { BottomNav } from '@/components/BottomNav';
import { Bell } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';

//todo: remove mock functionality
import cameraImg from '@assets/generated_images/Vintage_camera_auction_item_567c74a8.png';
import headphonesImg from '@assets/generated_images/Wireless_headphones_product_02537959.png';
import watchImg from '@assets/generated_images/Luxury_watch_auction_0a8d3cfb.png';
import handbagImg from '@assets/generated_images/Designer_handbag_item_812faad0.png';
import laptopImg from '@assets/generated_images/Gaming_laptop_auction_2ffb5e51.png';
import guitarImg from '@assets/generated_images/Acoustic_guitar_item_806d6b76.png';

//todo: remove mock functionality
const productData = [
  { names: ['Vintage Camera', 'Camera Lens', 'Film Camera', 'Digital Camera', 'Retro Camera'], img: cameraImg },
  { names: ['Wireless Headphones', 'Bluetooth Speaker', 'Earbuds', 'Audio System', 'Sound Bar'], img: headphonesImg },
  { names: ['Luxury Watch', 'Smart Watch', 'Sports Watch', 'Classic Watch', 'Designer Watch'], img: watchImg },
  { names: ['Designer Handbag', 'Leather Wallet', 'Tote Bag', 'Clutch Purse', 'Travel Bag'], img: handbagImg },
  { names: ['Gaming Laptop', 'Gaming Mouse', 'Mechanical Keyboard', 'Monitor Stand', 'Webcam'], img: laptopImg },
  { names: ['Acoustic Guitar', 'Electric Guitar', 'Bass Guitar', 'Guitar Pedal', 'Guitar Amp'], img: guitarImg },
];

const mockAuctions = Array.from({ length: 99 }, (_, i) => {
  const productIndex = i % productData.length;
  const nameIndex = Math.floor(i / productData.length) % productData[productIndex].names.length;
  const product = productData[productIndex];
  
  return {
    id: String(i + 1),
    title: product.names[nameIndex],
    currentBid: Math.floor(50 + Math.random() * 2500),
    endTime: new Date(Date.now() + Math.floor(Math.random() * 7 * 24 * 60 * 60 * 1000)),
    image: product.img,
    bidCount: Math.floor(1 + Math.random() * 40),
  };
});

export default function Browse() {
  const [bidDialogOpen, setBidDialogOpen] = useState(false);
  const [selectedAuction, setSelectedAuction] = useState<typeof mockAuctions[0] | null>(null);
  const { toast } = useToast();

  const handleBid = (auction: typeof mockAuctions[0]) => {
    setSelectedAuction(auction);
    setBidDialogOpen(true);
  };

  const handleBidSubmit = (amount: number) => {
    console.log('Bid submitted:', amount);
    toast({
      title: 'Bid placed successfully!',
      description: `Your bid of $${amount.toLocaleString()} has been placed.`,
    });
  };

  return (
    <div className="min-h-screen bg-background pb-20">
      <header className="sticky top-0 z-40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b">
        <div className="flex items-center justify-between h-14 px-4">
          <div>
            <h1 className="text-lg font-bold">BidHub</h1>
            <p className="text-xs text-muted-foreground">Live Auctions</p>
          </div>
          <Button size="icon" variant="ghost" data-testid="button-notifications">
            <Bell className="h-5 w-5" />
          </Button>
        </div>
      </header>

      <main className="px-4 pt-4 space-y-6">
        <HeroSection />

        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold">Active Auctions</h2>
            <p className="text-sm text-muted-foreground">{mockAuctions.length} items available</p>
          </div>
          <Badge variant="secondary" data-testid="badge-ending-soon">
            Ending Soon
          </Badge>
        </div>

        <div className="grid grid-cols-2 gap-3">
          {mockAuctions.map((auction) => (
            <AuctionCard
              key={auction.id}
              {...auction}
              onBid={() => handleBid(auction)}
              onClick={() => console.log('Navigate to auction detail:', auction.id)}
            />
          ))}
        </div>
      </main>

      <BottomNav />

      {selectedAuction && (
        <BidDialog
          open={bidDialogOpen}
          onOpenChange={setBidDialogOpen}
          currentBid={selectedAuction.currentBid}
          onSubmit={handleBidSubmit}
        />
      )}
    </div>
  );
}
