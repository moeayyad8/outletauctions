import { BottomNav } from '@/components/BottomNav';
import { Card } from '@/components/ui/card';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { PaymentSetup } from '@/components/PaymentSetup';
import { Settings, User, ChevronRight } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useQuery } from '@tanstack/react-query';
import type { User as UserType, Bid, Watchlist } from '@shared/schema';

export default function Profile() {
  const { user, isAuthenticated } = useAuth();
  const typedUser = user as UserType | undefined;
  
  const { data: bids = [], isLoading: bidsLoading } = useQuery<Bid[]>({
    queryKey: ['/api/bids'],
    enabled: isAuthenticated,
  });

  const { data: watchlist = [], isLoading: watchlistLoading } = useQuery<Watchlist[]>({
    queryKey: ['/api/watchlist'],
    enabled: isAuthenticated,
  });

  const getUserInitials = () => {
    if (!typedUser?.firstName && !typedUser?.lastName) return <User className="h-8 w-8" />;
    const first = typedUser.firstName?.[0] || '';
    const last = typedUser.lastName?.[0] || '';
    return `${first}${last}`.toUpperCase();
  };

  const getDisplayName = () => {
    if (typedUser?.firstName || typedUser?.lastName) {
      return `${typedUser.firstName || ''} ${typedUser.lastName || ''}`.trim();
    }
    return typedUser?.email || 'Guest';
  };

  return (
    <div className="min-h-screen bg-background pb-20">
      <header className="bg-card border-b">
        <div className="p-6">
          <div className="flex items-center gap-4">
            <Avatar className="h-20 w-20" data-testid="avatar-profile">
              <AvatarFallback className="text-2xl">
                {getUserInitials()}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1">
              <h1 className="text-xl font-bold" data-testid="text-username">
                {getDisplayName()}
              </h1>
              {isAuthenticated && typedUser?.email && (
                <p className="text-sm text-muted-foreground">{typedUser.email}</p>
              )}
            </div>
          </div>
        </div>
      </header>

      <main className="p-4 space-y-6">
        <div>
          <h2 className="text-lg font-semibold mb-3">My Bids</h2>
          {bidsLoading ? (
            <p className="text-sm text-muted-foreground">Loading...</p>
          ) : bids.length === 0 ? (
            <p className="text-sm text-muted-foreground" data-testid="text-no-bids">Nothing here yet</p>
          ) : (
            <div className="space-y-3" data-testid="section-my-bids">
              {bids.map((bid) => (
                <Card key={bid.id} className="p-3">
                  <div className="flex items-center gap-3">
                    {bid.auctionImage && (
                      <img 
                        src={bid.auctionImage} 
                        alt={bid.auctionTitle}
                        className="w-16 h-16 object-cover rounded-md"
                      />
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{bid.auctionTitle}</p>
                      <p className="text-sm text-muted-foreground">
                        Your bid: ${bid.amount.toLocaleString()}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(bid.createdAt!).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>

        <div>
          <h2 className="text-lg font-semibold mb-3">Watchlist</h2>
          {watchlistLoading ? (
            <p className="text-sm text-muted-foreground">Loading...</p>
          ) : watchlist.length === 0 ? (
            <p className="text-sm text-muted-foreground" data-testid="text-no-watchlist">Nothing here yet</p>
          ) : (
            <div className="space-y-3" data-testid="section-watchlist">
              {watchlist.map((item) => (
                <Card key={item.id} className="p-3">
                  <div className="flex items-center gap-3">
                    {item.auctionImage && (
                      <img 
                        src={item.auctionImage} 
                        alt={item.auctionTitle}
                        className="w-16 h-16 object-cover rounded-md"
                      />
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{item.auctionTitle}</p>
                      <p className="text-xs text-muted-foreground">
                        Added {new Date(item.createdAt!).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>

        {isAuthenticated && (
          <PaymentSetup />
        )}

        <Card
          className="p-4 hover-elevate active-elevate-2 cursor-pointer"
          onClick={() => console.log('Navigate to Settings')}
          data-testid="card-settings"
        >
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-md bg-muted flex items-center justify-center flex-shrink-0">
              <Settings className="h-5 w-5 text-muted-foreground" />
            </div>
            <div className="flex-1">
              <p className="font-medium">Settings</p>
            </div>
            <ChevronRight className="h-5 w-5 text-muted-foreground flex-shrink-0" />
          </div>
        </Card>
      </main>

      <BottomNav />
    </div>
  );
}
