import { BottomNav } from '../BottomNav';

export default function BottomNavExample() {
  return (
    <div className="h-screen bg-background">
      <div className="p-4 text-center">
        <p className="text-muted-foreground">Bottom navigation is fixed to the bottom</p>
      </div>
      <BottomNav />
    </div>
  );
}
