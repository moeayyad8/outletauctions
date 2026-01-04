import { useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import type { Auction } from '@shared/schema';

interface ScannedProduct {
  title: string;
  description: string;
  image: string;
  retailPrice: number | null;
  upc: string;
}

export default function Staff() {
  const [upc, setUpc] = useState('');
  const [scannedProduct, setScannedProduct] = useState<ScannedProduct | null>(null);
  const { toast } = useToast();

  const { data: auctions = [] } = useQuery<Auction[]>({
    queryKey: ['/api/staff/auctions'],
  });

  const scanMutation = useMutation({
    mutationFn: async (upcCode: string) => {
      const res = await apiRequest('POST', '/api/staff/scan', { upc: upcCode });
      return res.json();
    },
    onSuccess: (data: ScannedProduct) => {
      setScannedProduct(data);
      toast({ title: 'Product found!' });
    },
    onError: () => {
      setScannedProduct(null);
      toast({ title: 'Product not found', variant: 'destructive' });
    },
  });

  const createAuctionMutation = useMutation({
    mutationFn: async (product: ScannedProduct) => {
      const auctionData = {
        upc: product.upc,
        title: product.title,
        description: product.description,
        image: product.image,
        retailPrice: product.retailPrice,
        startingBid: 1,
        status: 'draft',
      };
      return apiRequest('POST', '/api/staff/auctions', auctionData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/staff/auctions'] });
      setScannedProduct(null);
      setUpc('');
      toast({ title: 'Auction created!' });
    },
    onError: () => {
      toast({ title: 'Failed to create auction', variant: 'destructive' });
    },
  });

  const handleScan = () => {
    if (upc.trim()) {
      scanMutation.mutate(upc.trim());
    }
  };

  const handleAddToInventory = () => {
    if (scannedProduct) {
      createAuctionMutation.mutate(scannedProduct);
    }
  };

  return (
    <div className="p-4 max-w-2xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold">Staff Panel - UPC Scanner</h1>
      
      <div className="space-y-2">
        <label className="text-sm font-medium">Scan UPC Barcode:</label>
        <div className="flex gap-2">
          <Input
            value={upc}
            onChange={(e) => setUpc(e.target.value)}
            placeholder="Enter UPC code..."
            onKeyDown={(e) => e.key === 'Enter' && handleScan()}
            data-testid="input-upc"
          />
          <Button 
            onClick={handleScan} 
            disabled={scanMutation.isPending}
            data-testid="button-scan"
          >
            {scanMutation.isPending ? 'Scanning...' : 'Scan'}
          </Button>
        </div>
      </div>

      {scannedProduct && (
        <div className="border p-4 rounded space-y-2 bg-muted/50">
          <h2 className="font-bold">Scanned Product:</h2>
          <p><strong>Title:</strong> {scannedProduct.title}</p>
          <p><strong>UPC:</strong> {scannedProduct.upc}</p>
          <p><strong>Retail Price:</strong> {scannedProduct.retailPrice ? `$${(scannedProduct.retailPrice / 100).toFixed(2)}` : 'N/A'}</p>
          {scannedProduct.image && (
            <img src={scannedProduct.image} alt={scannedProduct.title} className="w-32 h-32 object-contain" />
          )}
          <Button 
            onClick={handleAddToInventory}
            disabled={createAuctionMutation.isPending}
            data-testid="button-add-inventory"
          >
            {createAuctionMutation.isPending ? 'Adding...' : 'Add to Inventory'}
          </Button>
        </div>
      )}

      <div className="space-y-2">
        <h2 className="font-bold">Inventory ({auctions.length} items):</h2>
        {auctions.length === 0 ? (
          <p className="text-muted-foreground">No items in inventory yet.</p>
        ) : (
          <div className="space-y-2">
            {auctions.map((auction) => (
              <div key={auction.id} className="border p-2 rounded text-sm">
                <p><strong>#{auction.id}</strong> - {auction.title}</p>
                <p className="text-muted-foreground">
                  Retail: {auction.retailPrice ? `$${(auction.retailPrice / 100).toFixed(2)}` : 'N/A'} | 
                  Status: {auction.status} | 
                  UPC: {auction.upc || 'N/A'}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
