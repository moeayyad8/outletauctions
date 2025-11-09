import { Button } from '@/components/ui/button';
import { Gavel, TrendingUp } from 'lucide-react';
import heroImg from '@assets/generated_images/Hero_banner_background_900aca12.png';

export function HeroSection() {
  return (
    <div className="relative h-64 overflow-hidden rounded-lg">
      <img
        src={heroImg}
        alt="Featured auctions"
        className="absolute inset-0 w-full h-full object-cover"
      />
      <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/50 to-black/30" />
      
      <div className="relative h-full flex flex-col justify-end p-6 text-white">
        <div className="space-y-3">
          <h1 className="text-2xl font-bold">
            Discover Unique Treasures
          </h1>
          <p className="text-sm text-white/90">
            Bid on premium items from verified sellers
          </p>
          <div className="flex gap-2 pt-2">
            <Button
              variant="default"
              className="gap-2 bg-white/20 border border-white/40 backdrop-blur-md text-white hover:bg-white/30"
              data-testid="button-hero-browse"
            >
              <Gavel className="h-4 w-4" />
              Start Bidding
            </Button>
            <Button
              variant="outline"
              className="gap-2 bg-white/10 border border-white/30 backdrop-blur-md text-white hover:bg-white/20"
              data-testid="button-hero-trending"
            >
              <TrendingUp className="h-4 w-4" />
              Trending
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
