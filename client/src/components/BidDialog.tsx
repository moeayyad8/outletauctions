import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
  minIncrement = 10,
  onSubmit,
}: BidDialogProps) {
  const [bidAmount, setBidAmount] = useState(currentBid + minIncrement);

  const quickBids = [
    minIncrement,
    minIncrement * 2,
    minIncrement * 5,
  ];

  const handleQuickBid = (increment: number) => {
    setBidAmount(currentBid + increment);
  };

  const handleSubmit = () => {
    if (bidAmount > currentBid) {
      onSubmit(bidAmount);
      onOpenChange(false);
    }
  };

  const isValidBid = bidAmount > currentBid;

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

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="bid-amount">Your bid amount</Label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                $
              </span>
              <Input
                id="bid-amount"
                type="number"
                value={bidAmount}
                onChange={(e) => setBidAmount(Number(e.target.value))}
                className="pl-6"
                min={currentBid + minIncrement}
                data-testid="input-bid-amount"
              />
            </div>
            {!isValidBid && (
              <p className="text-xs text-destructive">
                Bid must be higher than current bid
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">Quick bid</Label>
            <div className="flex gap-2">
              {quickBids.map((increment) => (
                <Button
                  key={increment}
                  variant="outline"
                  size="sm"
                  onClick={() => handleQuickBid(increment)}
                  className="flex-1"
                  data-testid={`button-quick-bid-${increment}`}
                >
                  +${increment}
                </Button>
              ))}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            data-testid="button-cancel-bid"
          >
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!isValidBid}
            data-testid="button-confirm-bid"
          >
            Confirm Bid
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
