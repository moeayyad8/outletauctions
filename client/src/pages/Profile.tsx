import { BottomNav } from '@/components/BottomNav';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Settings, User, Gavel, Heart, ChevronRight } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

export default function Profile() {
  const menuItems = [
    { icon: Gavel, label: 'My Bids', count: 5, testId: 'my-bids' },
    { icon: Heart, label: 'Watchlist', count: 8, testId: 'watchlist' },
    { icon: Settings, label: 'Settings', testId: 'settings' },
  ];

  return (
    <div className="min-h-screen bg-background pb-20">
      <header className="bg-card border-b">
        <div className="p-6 space-y-4">
          <div className="flex items-center gap-4">
            <Avatar className="h-20 w-20" data-testid="avatar-profile">
              <AvatarFallback className="text-2xl">
                <User className="h-8 w-8" />
              </AvatarFallback>
            </Avatar>
            <div className="flex-1">
              <h1 className="text-xl font-bold" data-testid="text-username">Guest User</h1>
              <p className="text-sm text-muted-foreground">Member since 2024</p>
              <Badge variant="secondary" className="mt-2">Free Account</Badge>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4 pt-4">
            <div className="text-center">
              <p className="text-2xl font-bold">5</p>
              <p className="text-xs text-muted-foreground">Active Bids</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold">12</p>
              <p className="text-xs text-muted-foreground">Won Auctions</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold">98%</p>
              <p className="text-xs text-muted-foreground">Rating</p>
            </div>
          </div>
        </div>
      </header>

      <main className="p-4 space-y-3">
        {menuItems.map((item) => {
          const Icon = item.icon;
          return (
            <Card
              key={item.label}
              className="p-4 hover-elevate active-elevate-2 cursor-pointer"
              onClick={() => console.log(`Navigate to ${item.label}`)}
              data-testid={`card-${item.testId}`}
            >
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-md bg-muted flex items-center justify-center flex-shrink-0">
                  <Icon className="h-5 w-5 text-muted-foreground" />
                </div>
                <div className="flex-1">
                  <p className="font-medium">{item.label}</p>
                  {item.count !== undefined && (
                    <p className="text-sm text-muted-foreground">{item.count} items</p>
                  )}
                </div>
                <ChevronRight className="h-5 w-5 text-muted-foreground flex-shrink-0" />
              </div>
            </Card>
          );
        })}

        <div className="pt-6">
          <Button variant="outline" className="w-full" data-testid="button-sign-in">
            Sign In / Sign Up
          </Button>
        </div>
      </main>

      <BottomNav />
    </div>
  );
}
