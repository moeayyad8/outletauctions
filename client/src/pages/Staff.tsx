import { useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import type { Auction } from '@shared/schema';

interface ScanResult {
  code: string;
  codeType: "UPC" | "EAN" | "ASIN" | "UNKNOWN";
  lookupStatus: "SUCCESS" | "NEEDS_ENRICHMENT" | "NOT_FOUND";
  title: string;
  image: string | null;
  brand: string | null;
  category: string | null;
  highestPrice: number | null;
}

interface EnrichmentQueueItem {
  code: string;
  codeType: string;
  title: string;
  scannedAt: Date;
}

export default function Staff() {
  const [code, setCode] = useState('');
  const [scanResult, setScanResult] = useState<ScanResult | null>(null);
  const [enrichmentQueue, setEnrichmentQueue] = useState<EnrichmentQueueItem[]>([]);
  const { toast } = useToast();

  const { data: auctions = [] } = useQuery<Auction[]>({
    queryKey: ['/api/staff/auctions'],
  });

  const scanMutation = useMutation({
    mutationFn: async (codeToScan: string) => {
      const res = await apiRequest('POST', '/api/scan', { code: codeToScan });
      return res.json();
    },
    onSuccess: (data: ScanResult) => {
      setScanResult(data);
      
      if (data.lookupStatus === "SUCCESS") {
        toast({ title: `${data.codeType} found! Ready to list.` });
      } else if (data.lookupStatus === "NEEDS_ENRICHMENT") {
        setEnrichmentQueue(prev => [...prev, {
          code: data.code,
          codeType: data.codeType,
          title: data.title,
          scannedAt: new Date()
        }]);
        toast({ 
          title: `${data.codeType} added to enrichment queue`,
          description: 'Manual details needed later'
        });
        setScanResult(null);
        setCode('');
      } else {
        toast({ title: 'Product not found in database', variant: 'destructive' });
      }
    },
    onError: () => {
      setScanResult(null);
      toast({ title: 'Scan failed', variant: 'destructive' });
    },
  });

  const createAuctionMutation = useMutation({
    mutationFn: async (result: ScanResult) => {
      const auctionData = {
        upc: result.code,
        title: result.title,
        description: result.brand ? `Brand: ${result.brand}` : null,
        image: result.image,
        retailPrice: result.highestPrice ? Math.round(result.highestPrice * 100) : null,
        startingBid: 1,
        status: 'draft',
      };
      return apiRequest('POST', '/api/staff/auctions', auctionData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/staff/auctions'] });
      setScanResult(null);
      setCode('');
      toast({ title: 'Auction created!' });
    },
    onError: () => {
      toast({ title: 'Failed to create auction', variant: 'destructive' });
    },
  });

  const handleScan = () => {
    if (code.trim()) {
      scanMutation.mutate(code.trim());
    }
  };

  const handleAddToInventory = () => {
    if (scanResult && scanResult.lookupStatus === "SUCCESS") {
      createAuctionMutation.mutate(scanResult);
    }
  };

  const handleRemoveFromQueue = (index: number) => {
    setEnrichmentQueue(prev => prev.filter((_, i) => i !== index));
  };

  return (
    <div className="p-4 max-w-2xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold">Staff Panel - Scanner</h1>
      
      <div className="space-y-2">
        <label className="text-sm font-medium">Scan Code (UPC/EAN/ASIN):</label>
        <div className="flex gap-2">
          <Input
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="Enter UPC, EAN, or ASIN..."
            onKeyDown={(e) => e.key === 'Enter' && handleScan()}
            data-testid="input-code"
          />
          <Button 
            onClick={handleScan} 
            disabled={scanMutation.isPending}
            data-testid="button-scan"
          >
            {scanMutation.isPending ? 'Scanning...' : 'Scan'}
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          UPC (12 digits) and EAN (13 digits) lookup automatically. ASIN and unknown codes go to enrichment queue.
        </p>
      </div>

      {scanResult && scanResult.lookupStatus === "SUCCESS" && (
        <div className="border border-green-500 p-4 rounded space-y-2 bg-green-50 dark:bg-green-950">
          <div className="flex items-center gap-2">
            <span className="px-2 py-1 text-xs font-bold bg-green-500 text-white rounded">{scanResult.codeType}</span>
            <span className="text-green-700 dark:text-green-300 font-medium">Ready to List</span>
          </div>
          <p><strong>Title:</strong> {scanResult.title}</p>
          <p><strong>Code:</strong> {scanResult.code}</p>
          <p><strong>Brand:</strong> {scanResult.brand || 'N/A'}</p>
          <p><strong>Category:</strong> {scanResult.category || 'N/A'}</p>
          <p><strong>Highest Price:</strong> {scanResult.highestPrice ? `$${scanResult.highestPrice.toFixed(2)}` : 'N/A'}</p>
          {scanResult.image && (
            <img src={scanResult.image} alt={scanResult.title} className="w-32 h-32 object-contain bg-white rounded" />
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

      {scanResult && scanResult.lookupStatus === "NOT_FOUND" && (
        <div className="border border-yellow-500 p-4 rounded space-y-2 bg-yellow-50 dark:bg-yellow-950">
          <div className="flex items-center gap-2">
            <span className="px-2 py-1 text-xs font-bold bg-yellow-500 text-white rounded">{scanResult.codeType}</span>
            <span className="text-yellow-700 dark:text-yellow-300 font-medium">Not Found</span>
          </div>
          <p>Code <code>{scanResult.code}</code> not found in product database.</p>
          <Button 
            variant="outline"
            onClick={() => {
              setEnrichmentQueue(prev => [...prev, {
                code: scanResult.code,
                codeType: scanResult.codeType,
                title: scanResult.title,
                scannedAt: new Date()
              }]);
              setScanResult(null);
              setCode('');
              toast({ title: 'Added to enrichment queue' });
            }}
            data-testid="button-add-to-queue"
          >
            Add to Enrichment Queue
          </Button>
        </div>
      )}

      {enrichmentQueue.length > 0 && (
        <div className="space-y-2">
          <h2 className="font-bold text-orange-600 dark:text-orange-400">
            Enrichment Queue ({enrichmentQueue.length} items)
          </h2>
          <p className="text-xs text-muted-foreground">Items needing manual title/image/price entry</p>
          <div className="space-y-2">
            {enrichmentQueue.map((item, index) => (
              <div key={index} className="border border-orange-300 p-2 rounded text-sm bg-orange-50 dark:bg-orange-950 flex justify-between items-center">
                <div>
                  <span className="px-1 py-0.5 text-xs font-bold bg-orange-500 text-white rounded mr-2">{item.codeType}</span>
                  <code>{item.code}</code>
                  <p className="text-muted-foreground text-xs">{item.title}</p>
                </div>
                <Button 
                  variant="ghost" 
                  size="sm"
                  onClick={() => handleRemoveFromQueue(index)}
                >
                  Remove
                </Button>
              </div>
            ))}
          </div>
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
                  Code: {auction.upc || 'N/A'}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
