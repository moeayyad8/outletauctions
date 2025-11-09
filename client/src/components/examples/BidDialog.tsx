import { useState } from 'react';
import { BidDialog } from '../BidDialog';
import { Button } from '@/components/ui/button';

export default function BidDialogExample() {
  const [open, setOpen] = useState(false);

  return (
    <div className="p-4 bg-background">
      <Button onClick={() => setOpen(true)}>Open Bid Dialog</Button>
      <BidDialog
        open={open}
        onOpenChange={setOpen}
        currentBid={850}
        minIncrement={10}
        onSubmit={(amount) => console.log('Bid placed:', amount)}
      />
    </div>
  );
}
