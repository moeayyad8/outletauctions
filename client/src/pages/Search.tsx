import { useState } from 'react';
import { SearchBar } from '@/components/SearchBar';
import { AuctionCard } from '@/components/AuctionCard';
import { BidDialog } from '@/components/BidDialog';
import { BottomNav } from '@/components/BottomNav';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { SlidersHorizontal, X } from 'lucide-react';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Slider } from '@/components/ui/slider';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { redirectToLogin } from '@/lib/authRedirect';

//todo: remove mock functionality
import cameraImg from '@assets/generated_images/Vintage_camera_auction_item_567c74a8.png';
import headphonesImg from '@assets/generated_images/Wireless_headphones_product_02537959.png';
import watchImg from '@assets/generated_images/Luxury_watch_auction_0a8d3cfb.png';
import handbagImg from '@assets/generated_images/Designer_handbag_item_812faad0.png';
import laptopImg from '@assets/generated_images/Gaming_laptop_auction_2ffb5e51.png';
import guitarImg from '@assets/generated_images/Acoustic_guitar_item_806d6b76.png';

//todo: remove mock functionality
const productData = [
  { names: ['Vintage Camera', 'Camera Lens', 'Film Camera', 'Digital Camera', 'Retro Camera'], img: cameraImg, category: 'electronics' },
  { names: ['Wireless Headphones', 'Bluetooth Speaker', 'Earbuds', 'Audio System', 'Sound Bar'], img: headphonesImg, category: 'electronics' },
  { names: ['Luxury Watch', 'Smart Watch', 'Sports Watch', 'Classic Watch', 'Designer Watch'], img: watchImg, category: 'fashion' },
  { names: ['Designer Handbag', 'Leather Wallet', 'Tote Bag', 'Clutch Purse', 'Travel Bag'], img: handbagImg, category: 'fashion' },
  { names: ['Gaming Laptop', 'Gaming Mouse', 'Mechanical Keyboard', 'Monitor Stand', 'Webcam'], img: laptopImg, category: 'electronics' },
  { names: ['Acoustic Guitar', 'Electric Guitar', 'Bass Guitar', 'Guitar Pedal', 'Guitar Amp'], img: guitarImg, category: 'music' },
];

const mockAuctions = Array.from({ length: 99 }, (_, i) => {
  const productIndex = i % productData.length;
  const nameIndex = Math.floor(i / productData.length) % productData[productIndex].names.length;
  const product = productData[productIndex];
  
  let currentBid;
  if (i < 20) {
    currentBid = Math.floor(5 + Math.random() * 15);
  } else if (i < 40) {
    currentBid = Math.floor(20 + Math.random() * 31);
  } else {
    currentBid = Math.floor(50 + Math.random() * 2500);
  }
  
  return {
    id: String(i + 1),
    title: product.names[nameIndex],
    currentBid,
    endTime: new Date(Date.now() + Math.floor(Math.random() * 7 * 24 * 60 * 60 * 1000)),
    image: product.img,
    bidCount: Math.floor(1 + Math.random() * 40),
    category: product.category,
  };
});

const categories = [
  { id: 'electronics', label: 'Electronics' },
  { id: 'fashion', label: 'Fashion' },
  { id: 'collectibles', label: 'Collectibles' },
  { id: 'home', label: 'Home & Garden' },
];

export default function Search() {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [priceRange, setPriceRange] = useState([0, 5000]);
  const [bidDialogOpen, setBidDialogOpen] = useState(false);
  const [selectedAuction, setSelectedAuction] = useState<typeof mockAuctions[0] | null>(null);
  const [filterOpen, setFilterOpen] = useState(false);
  const { toast } = useToast();
  const { isAuthenticated } = useAuth();

  const handleBid = (auction: typeof mockAuctions[0]) => {
    if (!isAuthenticated) {
      toast({
        title: 'Login required',
        description: 'Please log in to place a bid.',
        variant: 'destructive',
      });
      setTimeout(() => {
        redirectToLogin();
      }, 500);
      return;
    }
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

  const toggleCategory = (categoryId: string) => {
    setSelectedCategories((prev) =>
      prev.includes(categoryId)
        ? prev.filter((id) => id !== categoryId)
        : [...prev, categoryId]
    );
  };

  const clearFilters = () => {
    setSelectedCategories([]);
    setPriceRange([0, 5000]);
  };

  const hasActiveFilters = selectedCategories.length > 0 || priceRange[0] > 0 || priceRange[1] < 5000;

  //todo: remove mock functionality
  const filteredAuctions = mockAuctions.filter((auction) => {
    const matchesSearch = auction.title.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = selectedCategories.length === 0 || selectedCategories.includes(auction.category);
    const matchesPrice = auction.currentBid >= priceRange[0] && auction.currentBid <= priceRange[1];
    return matchesSearch && matchesCategory && matchesPrice;
  });

  return (
    <div className="min-h-screen bg-background pb-20">
      <header className="sticky top-0 z-40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b">
        <div className="p-4 space-y-3">
          <div className="flex items-center gap-2">
            <SearchBar
              value={searchQuery}
              onChange={setSearchQuery}
              className="flex-1"
            />
            <Sheet open={filterOpen} onOpenChange={setFilterOpen}>
              <SheetTrigger asChild>
                <Button variant="outline" size="icon" className="relative" data-testid="button-filters">
                  <SlidersHorizontal className="h-4 w-4" />
                  {hasActiveFilters && (
                    <span className="absolute -top-1 -right-1 h-3 w-3 bg-primary rounded-full" />
                  )}
                </Button>
              </SheetTrigger>
              <SheetContent side="bottom" className="h-[80vh]">
                <SheetHeader>
                  <SheetTitle>Filters</SheetTitle>
                  <SheetDescription>
                    Refine your search results
                  </SheetDescription>
                </SheetHeader>

                <div className="py-6 space-y-6">
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <Label>Categories</Label>
                      {selectedCategories.length > 0 && (
                        <Badge variant="secondary">{selectedCategories.length} selected</Badge>
                      )}
                    </div>
                    <div className="space-y-2">
                      {categories.map((category) => (
                        <div key={category.id} className="flex items-center gap-2">
                          <Checkbox
                            id={category.id}
                            checked={selectedCategories.includes(category.id)}
                            onCheckedChange={() => toggleCategory(category.id)}
                            data-testid={`checkbox-category-${category.id}`}
                          />
                          <Label htmlFor={category.id} className="cursor-pointer">
                            {category.label}
                          </Label>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-3">
                    <Label>Price Range</Label>
                    <div className="pt-2">
                      <Slider
                        value={priceRange}
                        onValueChange={setPriceRange}
                        max={5000}
                        step={50}
                        className="w-full"
                        data-testid="slider-price-range"
                      />
                      <div className="flex items-center justify-between mt-2 text-sm text-muted-foreground">
                        <span>${priceRange[0]}</span>
                        <span>${priceRange[1]}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex gap-2 pt-4">
                    <Button
                      variant="outline"
                      onClick={clearFilters}
                      className="flex-1"
                      data-testid="button-clear-filters"
                    >
                      Clear All
                    </Button>
                    <Button
                      onClick={() => setFilterOpen(false)}
                      className="flex-1"
                      data-testid="button-apply-filters"
                    >
                      Apply Filters
                    </Button>
                  </div>
                </div>
              </SheetContent>
            </Sheet>
          </div>

          {hasActiveFilters && (
            <div className="flex items-center gap-2 flex-wrap">
              {selectedCategories.map((catId) => (
                <Badge key={catId} variant="secondary" className="gap-1">
                  {categories.find((c) => c.id === catId)?.label}
                  <X
                    className="h-3 w-3 cursor-pointer"
                    onClick={() => toggleCategory(catId)}
                  />
                </Badge>
              ))}
            </div>
          )}
        </div>
      </header>

      <main className="p-4">
        <div className="mb-4">
          <p className="text-sm text-muted-foreground">
            {filteredAuctions.length} {filteredAuctions.length === 1 ? 'result' : 'results'}
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3">
          {filteredAuctions.map((auction) => (
            <AuctionCard
              key={auction.id}
              {...auction}
              onBid={() => handleBid(auction)}
              onClick={() => console.log('Navigate to auction detail:', auction.id)}
            />
          ))}
        </div>

        {filteredAuctions.length === 0 && (
          <div className="text-center py-12">
            <p className="text-muted-foreground">No auctions found</p>
            <Button
              variant="ghost"
              onClick={() => {
                setSearchQuery('');
                clearFilters();
              }}
              className="mt-2"
              data-testid="button-clear-search"
            >
              Clear search and filters
            </Button>
          </div>
        )}
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
