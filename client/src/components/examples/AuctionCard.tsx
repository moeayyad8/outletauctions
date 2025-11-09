import { AuctionCard } from '../AuctionCard';
import cameraImg from '@assets/generated_images/Vintage_camera_auction_item_567c74a8.png';

export default function AuctionCardExample() {
  return (
    <div className="p-4 bg-background max-w-md">
      <AuctionCard
        id="1"
        title="Vintage Analog Camera - Rare 1960s Film Camera"
        currentBid={850}
        endTime={new Date(Date.now() + 2 * 60 * 60 * 1000)}
        image={cameraImg}
        bidCount={12}
        onBid={() => console.log('Bid clicked')}
        onClick={() => console.log('Card clicked')}
      />
    </div>
  );
}
