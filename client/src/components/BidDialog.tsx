import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Gavel } from 'lucide-react';

interface BidDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentBid: number;
  minIncrement?: number;
  onSubmit: (amount: number) => void;
}

export function BidDialog({
  open,
  onOpenChange,
  currentBid,
  onSubmit,
}: BidDialogProps) {
  const getQuickBidIncrements = () => {
    if (currentBid < 20) {
      return [1, 2, 3];
    } else if (currentBid <= 50) {
      return [2, 3, 4, 5];
    } else {
      return [3, 5, 10];
    }
  };

  const handleQuickBid = (increment: number) => {
    const newBid = currentBid + increment;
    onSubmit(newBid);
    onOpenChange(false);
  };

  const quickBids = getQuickBidIncrements();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm" data-testid="dialog-bid">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Gavel className="h-5 w-5" />
            Place Your Bid
          </DialogTitle>
          <DialogDescription>
            Current bid: ${currentBid.toLocaleString()}
          </DialogDescription>
        </DialogHeader>

        <div className="py-6">
          <p className="text-sm text-muted-foreground mb-4 text-center">
            Select your bid increment:
          </p>
          <div className={`grid gap-3 ${quickBids.length === 4 ? 'grid-cols-2' : 'grid-cols-3'}`}>
            {quickBids.map((increment) => (
              <Button
                key={increment}
                variant="outline"
                size="lg"
                onClick={() => handleQuickBid(increment)}
                className="h-20 flex flex-col gap-1"
                data-testid={`button-quick-bid-${increment}`}
              >
                <span className="text-xs text-muted-foreground">Bid</span>
                <span className="text-2xl font-bold">+${increment}</span>
                <span className="text-xs text-muted-foreground">
                  ${(currentBid + increment).toLocaleString()}
                </span>
              </Button>
            ))}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
