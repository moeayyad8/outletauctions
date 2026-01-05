import { useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { useUpload } from '@/hooks/use-upload';
import { ArrowDown, Clock, CheckCircle, Camera, X, Plus } from 'lucide-react';
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
  const [customImage, setCustomImage] = useState<string | null>(null);
  const { toast } = useToast();
  
  const { uploadFile, isUploading } = useUpload({
    onSuccess: (response) => {
      setCustomImage(response.objectPath);
      toast({ title: 'Image uploaded!' });
    },
    onError: () => {
      toast({ title: 'Failed to upload image', variant: 'destructive' });
    }
  });

  const { data: auctions = [] } = useQuery<Auction[]>({
    queryKey: ['/api/staff/auctions'],
  });
  
  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      await uploadFile(file);
    }
  };

  const scanMutation = useMutation({
    mutationFn: async (codeToScan: string) => {
      const res = await apiRequest('POST', '/api/scan', { code: codeToScan });
      return res.json();
    },
    onSuccess: (data: ScanResult) => {
      setScanResult(data);
      setCustomImage(null);
      setCode('');
      
      if (data.lookupStatus === "SUCCESS") {
        toast({ title: `${data.codeType} found! Ready to list.` });
      } else if (data.lookupStatus === "NEEDS_ENRICHMENT") {
        toast({ 
          title: `${data.codeType} needs manual entry`,
          description: 'Add image and details, then send to queue or list directly'
        });
      } else {
        toast({ title: 'Product not found in database', variant: 'destructive' });
      }
    },
    onError: () => {
      setScanResult(null);
      toast({ title: 'Scan failed', variant: 'destructive' });
    },
  });

  const generateInternalCodeMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/staff/next-internal-code');
      if (!res.ok) throw new Error('Failed to get internal code');
      return res.json();
    },
    onSuccess: (data: { code: string }) => {
      setScanResult({
        code: data.code,
        codeType: "UNKNOWN",
        lookupStatus: "NEEDS_ENRICHMENT",
        title: `Internal Product – ${data.code}`,
        image: null,
        brand: null,
        category: null,
        highestPrice: null
      });
      setCustomImage(null);
      setCode('');
      toast({ title: `Generated internal code: ${data.code}` });
    },
    onError: () => {
      toast({ title: 'Failed to generate code', variant: 'destructive' });
    },
  });

  const createAuctionMutation = useMutation({
    mutationFn: async (result: ScanResult) => {
      const auctionData = {
        upc: result.code,
        title: result.title,
        description: result.brand ? `Brand: ${result.brand}` : null,
        image: customImage || result.image,
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
      setCustomImage(null);
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
      
      {/* Visual Flow Diagram */}
      <div className="border rounded-lg p-4 bg-muted/30">
        <h2 className="text-sm font-semibold mb-3 text-muted-foreground">Scan Flow</h2>
        <div className="flex flex-col gap-3">
          {/* Input Row */}
          <div className="flex items-center justify-center">
            <div className="px-3 py-2 bg-blue-100 dark:bg-blue-900 border border-blue-300 dark:border-blue-700 rounded-lg text-center">
              <p className="font-medium text-blue-800 dark:text-blue-200">Scan Input</p>
              <p className="text-xs text-blue-600 dark:text-blue-400">Any barcode</p>
            </div>
          </div>
          
          <div className="flex justify-center">
            <ArrowDown className="w-5 h-5 text-muted-foreground" />
          </div>
          
          {/* Detection Row */}
          <div className="grid grid-cols-4 gap-2 text-center text-xs">
            <div className={`p-2 rounded-lg border-2 ${scanResult?.codeType === 'UPC' ? 'border-green-500 bg-green-50 dark:bg-green-950' : 'border-muted bg-background'}`}>
              <p className="font-bold">UPC</p>
              <p className="text-muted-foreground">12 digits</p>
            </div>
            <div className={`p-2 rounded-lg border-2 ${scanResult?.codeType === 'EAN' ? 'border-green-500 bg-green-50 dark:bg-green-950' : 'border-muted bg-background'}`}>
              <p className="font-bold">EAN</p>
              <p className="text-muted-foreground">13 digits</p>
            </div>
            <div className={`p-2 rounded-lg border-2 ${scanResult?.codeType === 'ASIN' ? 'border-orange-500 bg-orange-50 dark:bg-orange-950' : 'border-muted bg-background'}`}>
              <p className="font-bold">ASIN</p>
              <p className="text-muted-foreground">10 alphanum</p>
            </div>
            <div className={`p-2 rounded-lg border-2 ${scanResult?.codeType === 'UNKNOWN' ? 'border-orange-500 bg-orange-50 dark:bg-orange-950' : 'border-muted bg-background'}`}>
              <p className="font-bold">Other</p>
              <p className="text-muted-foreground">Unknown</p>
            </div>
          </div>
          
          <div className="flex justify-center">
            <ArrowDown className="w-5 h-5 text-muted-foreground" />
          </div>
          
          {/* Destination Row */}
          <div className="grid grid-cols-2 gap-3">
            <div className={`p-3 rounded-lg border-2 flex items-center gap-2 ${scanResult?.lookupStatus === 'SUCCESS' ? 'border-green-500 bg-green-100 dark:bg-green-900' : 'border-green-300 dark:border-green-800 bg-green-50/50 dark:bg-green-950/50'}`}>
              <CheckCircle className={`w-5 h-5 ${scanResult?.lookupStatus === 'SUCCESS' ? 'text-green-600' : 'text-green-400'}`} />
              <div>
                <p className="font-semibold text-green-800 dark:text-green-200">Ready to List</p>
                <p className="text-xs text-green-600 dark:text-green-400">UPC/EAN found</p>
                <p className="text-xs font-bold text-green-700 dark:text-green-300">{auctions.length} in inventory</p>
              </div>
            </div>
            <div className={`p-3 rounded-lg border-2 flex items-center gap-2 ${scanResult?.lookupStatus === 'NEEDS_ENRICHMENT' || enrichmentQueue.length > 0 ? 'border-orange-500 bg-orange-100 dark:bg-orange-900' : 'border-orange-300 dark:border-orange-800 bg-orange-50/50 dark:bg-orange-950/50'}`}>
              <Clock className={`w-5 h-5 ${enrichmentQueue.length > 0 ? 'text-orange-600' : 'text-orange-400'}`} />
              <div>
                <p className="font-semibold text-orange-800 dark:text-orange-200">Enrichment Queue</p>
                <p className="text-xs text-orange-600 dark:text-orange-400">ASIN/Unknown/Not found</p>
                <p className="text-xs font-bold text-orange-700 dark:text-orange-300">{enrichmentQueue.length} pending</p>
              </div>
            </div>
          </div>
        </div>
      </div>
      
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
        <div className="flex items-center gap-3">
          <p className="text-xs text-muted-foreground flex-1">
            UPC (12 digits) and EAN (13 digits) lookup automatically. ASIN and unknown codes go to enrichment queue.
          </p>
          <Button
            variant="outline"
            size="sm"
            onClick={() => generateInternalCodeMutation.mutate()}
            disabled={generateInternalCodeMutation.isPending}
            data-testid="button-generate-internal"
          >
            <Plus className="w-4 h-4 mr-1" />
            {generateInternalCodeMutation.isPending ? 'Generating...' : 'Internal Code'}
          </Button>
        </div>
      </div>

      {scanResult && scanResult.lookupStatus === "SUCCESS" && (
        <div className="border border-green-500 p-4 rounded space-y-3 bg-green-50 dark:bg-green-950">
          <div className="flex items-center gap-2">
            <span className="px-2 py-1 text-xs font-bold bg-green-500 text-white rounded">{scanResult.codeType}</span>
            <span className="text-green-700 dark:text-green-300 font-medium">Ready to List</span>
          </div>
          <p><strong>Title:</strong> {scanResult.title}</p>
          <p><strong>Code:</strong> {scanResult.code}</p>
          <p><strong>Brand:</strong> {scanResult.brand || 'N/A'}</p>
          <p><strong>Category:</strong> {scanResult.category || 'N/A'}</p>
          <p><strong>Highest Price:</strong> {scanResult.highestPrice ? `$${scanResult.highestPrice.toFixed(2)}` : 'N/A'}</p>
          
          <div className="flex items-start gap-4">
            <div className="space-y-2">
              <p className="text-sm font-medium">Product Image:</p>
              {(customImage || scanResult.image) ? (
                <div className="relative">
                  <img 
                    src={customImage || scanResult.image || ''} 
                    alt={scanResult.title} 
                    className="w-32 h-32 object-contain bg-white rounded border"
                  />
                  {customImage && (
                    <button 
                      onClick={() => setCustomImage(null)}
                      className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1"
                      data-testid="button-remove-image"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  )}
                </div>
              ) : (
                <div className="w-32 h-32 bg-muted rounded border flex items-center justify-center text-muted-foreground">
                  No image
                </div>
              )}
            </div>
            
            <div className="space-y-2">
              <p className="text-sm font-medium">
                {scanResult.image ? 'Replace Image:' : 'Add Image:'}
              </p>
              <label className="flex items-center gap-2 cursor-pointer">
                <div className="flex items-center gap-2 px-3 py-2 border rounded-lg bg-white dark:bg-gray-800 hover:bg-muted transition-colors">
                  <Camera className="w-4 h-4" />
                  <span className="text-sm">{isUploading ? 'Uploading...' : 'Upload Photo'}</span>
                </div>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleImageUpload}
                  disabled={isUploading}
                  className="hidden"
                  data-testid="input-image-upload"
                />
              </label>
              {customImage && (
                <p className="text-xs text-green-600">Custom image set</p>
              )}
            </div>
          </div>
          
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
        <div className="border border-yellow-500 p-4 rounded space-y-3 bg-yellow-50 dark:bg-yellow-950">
          <div className="flex items-center gap-2">
            <span className="px-2 py-1 text-xs font-bold bg-yellow-500 text-white rounded">{scanResult.codeType}</span>
            <span className="text-yellow-700 dark:text-yellow-300 font-medium">Not Found</span>
          </div>
          <p>Code <code>{scanResult.code}</code> not found in product database.</p>
          
          <div className="space-y-2">
            <p className="text-sm font-medium">Add Product Image:</p>
            <div className="flex items-center gap-3">
              {customImage ? (
                <div className="relative">
                  <img 
                    src={customImage} 
                    alt="Custom upload" 
                    className="w-24 h-24 object-contain bg-white rounded border"
                  />
                  <button 
                    onClick={() => setCustomImage(null)}
                    className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ) : null}
              <label className="flex items-center gap-2 cursor-pointer">
                <div className="flex items-center gap-2 px-3 py-2 border rounded-lg bg-white dark:bg-gray-800 hover:bg-muted transition-colors">
                  <Camera className="w-4 h-4" />
                  <span className="text-sm">{isUploading ? 'Uploading...' : 'Upload Photo'}</span>
                </div>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleImageUpload}
                  disabled={isUploading}
                  className="hidden"
                />
              </label>
            </div>
          </div>
          
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
              setCustomImage(null);
              toast({ title: 'Added to enrichment queue' });
            }}
            data-testid="button-add-to-queue"
          >
            Add to Enrichment Queue
          </Button>
        </div>
      )}

      {scanResult && scanResult.lookupStatus === "NEEDS_ENRICHMENT" && (
        <div className="border border-orange-500 p-4 rounded space-y-3 bg-orange-50 dark:bg-orange-950">
          <div className="flex items-center gap-2">
            <span className="px-2 py-1 text-xs font-bold bg-orange-500 text-white rounded">{scanResult.codeType}</span>
            <span className="text-orange-700 dark:text-orange-300 font-medium">Manual Entry Required</span>
          </div>
          <p><strong>Code:</strong> <code>{scanResult.code}</code></p>
          <p className="text-sm text-muted-foreground">This {scanResult.codeType} cannot be looked up automatically. Add an image and send to queue for manual details.</p>
          
          <div className="space-y-2">
            <p className="text-sm font-medium">Add Product Image:</p>
            <div className="flex items-center gap-3">
              {customImage ? (
                <div className="relative">
                  <img 
                    src={customImage} 
                    alt="Custom upload" 
                    className="w-24 h-24 object-contain bg-white rounded border"
                  />
                  <button 
                    onClick={() => setCustomImage(null)}
                    className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ) : (
                <div className="w-24 h-24 bg-muted rounded border flex items-center justify-center text-muted-foreground text-xs text-center p-2">
                  No image yet
                </div>
              )}
              <label className="flex items-center gap-2 cursor-pointer">
                <div className="flex items-center gap-2 px-3 py-2 border rounded-lg bg-white dark:bg-gray-800 hover:bg-muted transition-colors">
                  <Camera className="w-4 h-4" />
                  <span className="text-sm">{isUploading ? 'Uploading...' : 'Upload Photo'}</span>
                </div>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleImageUpload}
                  disabled={isUploading}
                  className="hidden"
                  data-testid="input-asin-image"
                />
              </label>
            </div>
            {customImage && (
              <p className="text-xs text-green-600">Image uploaded successfully</p>
            )}
          </div>
          
          <Button 
            variant="outline"
            onClick={() => {
              setEnrichmentQueue(prev => [...prev, {
                code: scanResult.code,
                codeType: scanResult.codeType,
                title: customImage ? `[Has Image] ${scanResult.title}` : scanResult.title,
                scannedAt: new Date()
              }]);
              setScanResult(null);
              setCode('');
              setCustomImage(null);
              toast({ title: 'Added to enrichment queue' });
            }}
            data-testid="button-asin-to-queue"
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
