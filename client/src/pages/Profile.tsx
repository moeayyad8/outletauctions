import { BottomNav } from '@/components/BottomNav';
import { Card } from '@/components/ui/card';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Settings, User, Gavel, Heart, ChevronRight } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import type { User as UserType } from '@shared/schema';

export default function Profile() {
  const { user, isAuthenticated } = useAuth();
  const typedUser = user as UserType | undefined;
  
  const menuItems = [
    { icon: Gavel, label: 'My Bids', testId: 'my-bids' },
    { icon: Heart, label: 'Watchlist', testId: 'watchlist' },
    { icon: Settings, label: 'Settings', testId: 'settings' },
  ];

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
                </div>
                <ChevronRight className="h-5 w-5 text-muted-foreground flex-shrink-0" />
              </div>
            </Card>
          );
        })}
      </main>

      <BottomNav />
    </div>
  );
}
