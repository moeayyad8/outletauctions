import { Home, Search, User } from 'lucide-react';
import { Link, useLocation } from 'wouter';

export function BottomNav() {
  const [location] = useLocation();

  const navItems = [
    { icon: Home, label: 'Browse', path: '/', testId: 'browse' },
    { icon: Search, label: 'Search', path: '/search', testId: 'search' },
    { icon: User, label: 'Profile', path: '/profile', testId: 'profile' },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-card border-t border-card-border safe-area-bottom">
      <div className="flex items-center justify-around h-16 max-w-screen-xl mx-auto px-4">
        {navItems.map((item) => {
          const isActive = location === item.path;
          const Icon = item.icon;
          
          return (
            <Link
              key={item.path}
              href={item.path}
              className="flex flex-col items-center justify-center flex-1 gap-1 hover-elevate active-elevate-2 py-2 rounded-md"
              data-testid={`link-nav-${item.testId}`}
            >
              <Icon
                className={`h-5 w-5 ${
                  isActive ? 'text-primary' : 'text-muted-foreground'
                }`}
              />
              <span
                className={`text-xs ${
                  isActive ? 'text-foreground font-medium' : 'text-muted-foreground'
                }`}
              >
                {item.label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
