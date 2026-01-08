import { useState, useRef, useEffect } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { useUpload } from '@/hooks/use-upload';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Package, Camera, X, Plus, Printer, Trash2, Send, ScanLine, Archive, ImagePlus, Truck, Gavel, Store, ExternalLink, Grid3X3, ArrowRightLeft, LogIn, LogOut } from 'lucide-react';
import { SiAmazon, SiEbay } from 'react-icons/si';
import JsBarcode from 'jsbarcode';
import type { Auction, Tag as TagType, Shelf } from '@shared/schema';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { MapPin } from 'lucide-react';

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

type DestinationType = 'auction' | 'ebay' | 'amazon';

interface BatchItem extends ScanResult {
  customImage: string | null;
  selectedTags: number[];
  id: string;
  destination: DestinationType;
  shelfId: number | null;
}

type TabType = 'scanner' | 'inventory' | 'fulfillment' | 'shelves';

export default function Staff() {
  const [activeTab, setActiveTab] = useState<TabType>('scanner');
  const [code, setCode] = useState('');
  const [batch, setBatch] = useState<BatchItem[]>([]);
  const [showBarcodeDialog, setShowBarcodeDialog] = useState(false);
  const [barcodeValue, setBarcodeValue] = useState('');
  const [editingItem, setEditingItem] = useState<string | null>(null);
  const [newTagName, setNewTagName] = useState('');
  const [newTagType, setNewTagType] = useState<'location' | 'category'>('category');
  const [isSending, setIsSending] = useState(false);
  const [selectedShelf, setSelectedShelf] = useState<number | null>(null);
  const [shelfScanCode, setShelfScanCode] = useState('');
  const [shelfScanMode, setShelfScanMode] = useState<'in' | 'out'>('in');
  const barcodeRef = useRef<SVGSVGElement>(null);
  const { toast } = useToast();

  const { data: allTags = [] } = useQuery<TagType[]>({
    queryKey: ['/api/tags'],
  });

  const { data: auctions = [] } = useQuery<Auction[]>({
    queryKey: ['/api/staff/auctions'],
  });

  const { data: shelves = [] } = useQuery<Shelf[]>({
    queryKey: ['/api/shelves'],
  });

  const locationTags = allTags.filter(t => t.type === 'location');
  const categoryTags = allTags.filter(t => t.type === 'category');

  const createTagMutation = useMutation({
    mutationFn: async (tag: { name: string; type: string }) => {
      return apiRequest('POST', '/api/tags', tag);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/tags'] });
      setNewTagName('');
      toast({ title: 'Tag created!' });
    },
  });

  useEffect(() => {
    if (showBarcodeDialog && barcodeRef.current && barcodeValue) {
      setTimeout(() => {
        if (barcodeRef.current) {
          try {
            JsBarcode(barcodeRef.current, barcodeValue, {
              format: 'CODE128',
              width: 2,
              height: 80,
              displayValue: true,
              fontSize: 16,
              margin: 10,
            });
          } catch (e) {
            console.error('Barcode generation failed:', e);
          }
        }
      }, 100);
    }
  }, [showBarcodeDialog, barcodeValue]);

  const { uploadFile, isUploading } = useUpload({
    onSuccess: (response) => {
      if (editingItem) {
        setBatch(prev => prev.map(item => 
          item.id === editingItem ? { ...item, customImage: response.objectPath } : item
        ));
      }
      toast({ title: 'Image uploaded!' });
    },
    onError: () => {
      toast({ title: 'Failed to upload image', variant: 'destructive' });
    }
  });

  const scanMutation = useMutation({
    mutationFn: async (codeToScan: string) => {
      const res = await apiRequest('POST', '/api/scan', { code: codeToScan });
      return res.json();
    },
    onSuccess: (data: ScanResult) => {
      const newItem: BatchItem = {
        ...data,
        customImage: null,
        selectedTags: [],
        id: `${data.code}-${Date.now()}`,
        destination: 'auction',
        shelfId: null,
      };
      setBatch(prev => [newItem, ...prev]);
      setCode('');
      
      if (data.lookupStatus === "SUCCESS") {
        toast({ title: `Added: ${data.title.slice(0, 40)}...` });
      } else {
        toast({ title: 'Item needs details', description: 'Tap to add image/info' });
      }
    },
    onError: () => {
      toast({ title: 'Scan failed', variant: 'destructive' });
    },
  });

  const generateInternalCodeMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/staff/next-internal-code');
      if (!res.ok) throw new Error('Failed');
      return res.json();
    },
    onSuccess: (data: { code: string }) => {
      const newItem: BatchItem = {
        code: data.code,
        codeType: "UNKNOWN",
        lookupStatus: "NEEDS_ENRICHMENT",
        title: `New Product`,
        image: null,
        brand: null,
        category: null,
        highestPrice: null,
        customImage: null,
        selectedTags: [],
        id: `${data.code}-${Date.now()}`,
        destination: 'auction',
        shelfId: null,
      };
      setBatch(prev => [newItem, ...prev]);
      toast({ title: `Generated: ${data.code}` });
    },
  });

  const toggleItemDestination = (id: string, destination: DestinationType) => {
    setBatch(prev => prev.map(item => 
      item.id === id ? { ...item, destination } : item
    ));
  };

  const setItemShelf = (id: string, shelfId: number | null) => {
    setBatch(prev => prev.map(item => 
      item.id === id ? { ...item, shelfId } : item
    ));
  };

  const createAuctionMutation = useMutation({
    mutationFn: async (item: BatchItem) => {
      const auctionData = {
        upc: item.code,
        title: item.title,
        description: item.brand ? `Brand: ${item.brand}` : null,
        image: item.customImage || item.image,
        retailPrice: item.highestPrice ? Math.round(item.highestPrice * 100) : null,
        startingBid: 1,
        status: 'draft',
        destination: item.destination,
        shelfId: item.shelfId,
      };
      const response = await apiRequest('POST', '/api/staff/auctions', auctionData);
      const auction = await response.json();
      
      if (item.selectedTags.length > 0) {
        await apiRequest('POST', `/api/staff/auctions/${auction.id}/tags`, { tagIds: item.selectedTags });
      }
      
      return auction;
    },
  });

  const deleteAuctionMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest('DELETE', `/api/staff/auctions/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/staff/auctions'] });
      queryClient.invalidateQueries({ queryKey: ['/api/shelves'] });
      toast({ title: 'Item deleted' });
    },
  });

  const updateAuctionShelfMutation = useMutation({
    mutationFn: async ({ id, shelfId }: { id: number; shelfId: number | null }) => {
      await apiRequest('PATCH', `/api/staff/auctions/${id}/shelf`, { shelfId });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/staff/auctions'] });
      queryClient.invalidateQueries({ queryKey: ['/api/shelves'] });
    },
  });

  const handleDeleteAuction = (id: number) => {
    deleteAuctionMutation.mutate(id);
  };

  const sendToAuctionMutation = useMutation({
    mutationFn: async (id: number) => {
      const response = await apiRequest('PATCH', `/api/staff/auctions/${id}/status`, {
        status: 'active',
        durationDays: 7,
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/staff/auctions'] });
      toast({ title: 'Item is now live!' });
    },
    onError: () => {
      toast({ title: 'Failed to send to auction', variant: 'destructive' });
    },
  });

  const handleSendToAuction = (id: number) => {
    sendToAuctionMutation.mutate(id);
  };

  const publishMutation = useMutation({
    mutationFn: async ({ id, destination }: { id: number; destination: DestinationType }) => {
      const response = await apiRequest('POST', `/api/staff/auctions/${id}/publish`, {
        destination,
      });
      return response.json();
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['/api/staff/auctions'] });
      const dest = variables.destination;
      if (dest === 'auction') {
        toast({ title: 'Item is now live on your auction!' });
      } else {
        toast({ title: `Sent to ${dest === 'ebay' ? 'eBay' : 'Amazon'}!`, description: 'Check Fulfillment tab for status' });
      }
    },
    onError: () => {
      toast({ title: 'Failed to publish', variant: 'destructive' });
    },
  });

  const handlePublish = (id: number, destination: DestinationType) => {
    publishMutation.mutate({ id, destination });
  };

  const handleScan = () => {
    if (code.trim()) {
      scanMutation.mutate(code.trim());
    }
  };

  const handleRemoveFromBatch = (id: string) => {
    setBatch(prev => prev.filter(item => item.id !== id));
  };

  const toggleItemTag = (itemId: string, tagId: number) => {
    setBatch(prev => prev.map(item => {
      if (item.id !== itemId) return item;
      const tags = item.selectedTags.includes(tagId)
        ? item.selectedTags.filter(t => t !== tagId)
        : [...item.selectedTags, tagId];
      return { ...item, selectedTags: tags };
    }));
  };

  const handleSendToInventory = async () => {
    if (batch.length === 0) return;
    
    const itemsWithoutShelf = batch.filter(item => !item.shelfId);
    if (itemsWithoutShelf.length > 0) {
      toast({ 
        title: 'Select location for all items', 
        description: `${itemsWithoutShelf.length} item(s) need a shelf location`,
        variant: 'destructive' 
      });
      return;
    }
    
    setIsSending(true);
    let successCount = 0;
    
    for (const item of batch) {
      try {
        await createAuctionMutation.mutateAsync(item);
        successCount++;
      } catch (e) {
        console.error('Failed to add item:', e);
      }
    }
    
    queryClient.invalidateQueries({ queryKey: ['/api/staff/auctions'] });
    queryClient.invalidateQueries({ queryKey: ['/api/shelves'] });
    setBatch([]);
    setIsSending(false);
    toast({ title: `Added ${successCount} items to inventory!` });
  };

  const handlePrintBarcode = (codeValue: string) => {
    setBarcodeValue(codeValue);
    setShowBarcodeDialog(true);
  };

  const printBarcode = () => {
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      const tempSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      try {
        JsBarcode(tempSvg, barcodeValue, {
          format: 'CODE128',
          width: 2,
          height: 80,
          displayValue: true,
          fontSize: 16,
          margin: 10,
        });
        const svgData = new XMLSerializer().serializeToString(tempSvg);
        printWindow.document.write(`
          <!DOCTYPE html>
          <html>
          <head>
            <title>Barcode - ${barcodeValue}</title>
            <style>
              body { margin: 0; padding: 20px; display: flex; justify-content: center; align-items: center; min-height: 100vh; }
            </style>
          </head>
          <body>
            ${svgData}
            <script>window.onload = function() { window.print(); window.close(); };</script>
          </body>
          </html>
        `);
        printWindow.document.close();
      } catch (e) {
        printWindow.close();
        toast({ title: 'Failed to print', variant: 'destructive' });
      }
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>, itemId: string) => {
    const file = e.target.files?.[0];
    if (file) {
      setEditingItem(itemId);
      await uploadFile(file);
    }
  };

  return (
    <div className="min-h-screen bg-background pb-20">
      {activeTab === 'scanner' && (
        <div className="max-w-2xl mx-auto p-4 space-y-6">
          <header className="pt-2">
            <div className="flex items-center justify-between mb-1">
              <h1 className="text-2xl font-bold tracking-tight">Scanner</h1>
              <Badge variant="secondary" className="font-mono text-xs">
                {batch.length} in batch
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground">Scan products to build your batch</p>
          </header>

          <div className="relative">
            <div className="flex gap-2">
              <div className="relative flex-1">
                <ScanLine className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                <Input
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  placeholder="Scan or enter barcode..."
                  onKeyDown={(e) => e.key === 'Enter' && handleScan()}
                  className="pl-10 h-14 text-lg rounded-xl"
                  autoFocus
                  data-testid="input-code"
                />
              </div>
              <Button 
                onClick={handleScan} 
                disabled={scanMutation.isPending || !code.trim()}
                size="lg"
                className="h-14 px-6 rounded-xl"
                data-testid="button-scan"
              >
                {scanMutation.isPending ? 'Scanning...' : 'Scan'}
              </Button>
            </div>
            <div className="flex items-center justify-end mt-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => generateInternalCodeMutation.mutate()}
                disabled={generateInternalCodeMutation.isPending}
                className="text-xs"
                data-testid="button-generate-internal"
              >
                <Plus className="w-3 h-3 mr-1" />
                Generate Code
              </Button>
            </div>
          </div>

          {batch.length === 0 ? (
            <div className="text-center py-16 px-4">
              <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mx-auto mb-4">
                <Package className="w-8 h-8 text-muted-foreground" />
              </div>
              <h3 className="font-semibold text-lg mb-1">No items in batch</h3>
              <p className="text-muted-foreground text-sm max-w-xs mx-auto">
                Scan barcodes to add items, then send them all to inventory at once
              </p>
            </div>
          ) : (
            <>
              <div className="space-y-3">
                {batch.map((item) => (
                  <Card key={item.id} className="overflow-hidden">
                    <CardContent className="p-0">
                      <div className="flex">
                        <div className="w-24 h-24 bg-muted flex items-center justify-center shrink-0 relative group">
                          {(item.customImage || item.image) ? (
                            <>
                              <img 
                                src={item.customImage || item.image!} 
                                alt={item.title}
                                className="w-full h-full object-cover"
                              />
                              <label className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer flex items-center justify-center">
                                <Camera className="w-5 h-5 text-white" />
                                <input
                                  type="file"
                                  accept="image/*"
                                  onChange={(e) => handleImageUpload(e, item.id)}
                                  disabled={isUploading}
                                  className="hidden"
                                />
                              </label>
                            </>
                          ) : (
                            <label className="cursor-pointer w-full h-full flex flex-col items-center justify-center gap-1 hover:bg-muted/80 transition-colors">
                              <ImagePlus className="w-6 h-6 text-muted-foreground" />
                              <span className="text-xs text-muted-foreground">Add photo</span>
                              <input
                                type="file"
                                accept="image/*"
                                onChange={(e) => handleImageUpload(e, item.id)}
                                disabled={isUploading}
                                className="hidden"
                              />
                            </label>
                          )}
                        </div>
                        
                        <div className="flex-1 p-3 min-w-0">
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-1.5 mb-1">
                                <Badge 
                                  variant={item.lookupStatus === "SUCCESS" ? "default" : "outline"}
                                  className="text-[10px] px-1.5 py-0"
                                >
                                  {item.codeType}
                                </Badge>
                                {item.lookupStatus !== "SUCCESS" && (
                                  <Badge variant="secondary" className="text-[10px] px-1.5 py-0 text-orange-600">
                                    Needs info
                                  </Badge>
                                )}
                              </div>
                              <p className="font-medium text-sm leading-tight line-clamp-2">{item.title}</p>
                              <p className="text-[11px] text-muted-foreground font-mono mt-0.5">{item.code}</p>
                            </div>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 shrink-0"
                              onClick={() => handleRemoveFromBatch(item.id)}
                              data-testid={`button-remove-${item.id}`}
                            >
                              <X className="w-4 h-4" />
                            </Button>
                          </div>
                          
                          <div className="flex items-center justify-between mt-2 gap-2">
                            {item.highestPrice ? (
                              <span className="text-sm font-semibold text-green-600">
                                ${item.highestPrice.toFixed(2)}
                              </span>
                            ) : (
                              <span className="text-xs text-muted-foreground">No price</span>
                            )}
                            
                            <Select
                              value={item.shelfId?.toString() || ''}
                              onValueChange={(val) => setItemShelf(item.id, val ? parseInt(val) : null)}
                            >
                              <SelectTrigger 
                                className={`w-[120px] h-7 text-xs ${!item.shelfId ? 'border-orange-400 text-orange-600' : ''}`}
                                data-testid={`select-shelf-${item.id}`}
                              >
                                <MapPin className="w-3 h-3 mr-1" />
                                <SelectValue placeholder="Location" />
                              </SelectTrigger>
                              <SelectContent>
                                {shelves.map(shelf => (
                                  <SelectItem key={shelf.id} value={shelf.id.toString()}>
                                    {shelf.name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          
                          <div className="flex gap-1 flex-wrap mt-1">
                            {[...locationTags, ...categoryTags].slice(0, 4).map(tag => (
                              <Badge
                                key={tag.id}
                                variant={item.selectedTags.includes(tag.id) ? "default" : "outline"}
                                className={`cursor-pointer text-[10px] px-1.5 py-0 ${
                                  tag.type === 'location' ? 'border-blue-400' : 'border-purple-400'
                                }`}
                                onClick={() => toggleItemTag(item.id, tag.id)}
                              >
                                {tag.name}
                              </Badge>
                            ))}
                          </div>
                          
                          <div className="flex gap-1 mt-2 pt-2 border-t">
                            <Button
                              variant={item.destination === 'auction' ? 'default' : 'outline'}
                              size="sm"
                              className="flex-1 h-7 text-[10px]"
                              onClick={() => toggleItemDestination(item.id, 'auction')}
                              data-testid={`dest-auction-${item.id}`}
                            >
                              <Gavel className="w-3 h-3 mr-1" />
                              Auction
                            </Button>
                            <Button
                              variant={item.destination === 'ebay' ? 'default' : 'outline'}
                              size="sm"
                              className="flex-1 h-7 text-[10px]"
                              onClick={() => toggleItemDestination(item.id, 'ebay')}
                              data-testid={`dest-ebay-${item.id}`}
                            >
                              <SiEbay className="w-3 h-3 mr-1" />
                              eBay
                            </Button>
                            <Button
                              variant={item.destination === 'amazon' ? 'default' : 'outline'}
                              size="sm"
                              className="flex-1 h-7 text-[10px]"
                              onClick={() => toggleItemDestination(item.id, 'amazon')}
                              data-testid={`dest-amazon-${item.id}`}
                            >
                              <SiAmazon className="w-3 h-3 mr-1" />
                              Amazon
                            </Button>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>

              <div className="flex gap-2 pt-2">
                <Button
                  variant="outline"
                  onClick={() => {
                    setBatch([]);
                    toast({ title: 'Batch cleared' });
                  }}
                  className="flex-1"
                  data-testid="button-clear-batch"
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  Clear
                </Button>
                <Button
                  onClick={handleSendToInventory}
                  disabled={isSending}
                  className="flex-[2]"
                  data-testid="button-send-inventory"
                >
                  <Send className="w-4 h-4 mr-2" />
                  {isSending ? 'Sending...' : `Send ${batch.length} to Inventory`}
                </Button>
              </div>
            </>
          )}

          <Card>
            <CardContent className="p-3">
              <p className="text-xs font-medium text-muted-foreground mb-2">Quick Add Tag</p>
              <div className="flex gap-2">
                <Input
                  placeholder="Tag name..."
                  value={newTagName}
                  onChange={(e) => setNewTagName(e.target.value)}
                  className="flex-1 h-9"
                  data-testid="input-new-tag"
                />
                <select
                  value={newTagType}
                  onChange={(e) => setNewTagType(e.target.value as 'location' | 'category')}
                  className="border rounded-md px-2 text-sm bg-background h-9"
                  data-testid="select-tag-type"
                >
                  <option value="location">Location</option>
                  <option value="category">Category</option>
                </select>
                <Button
                  size="sm"
                  className="h-9"
                  onClick={() => newTagName.trim() && createTagMutation.mutate({ name: newTagName.trim(), type: newTagType })}
                  disabled={!newTagName.trim()}
                  data-testid="button-create-tag"
                >
                  <Plus className="w-4 h-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {activeTab === 'inventory' && (
        <div className="max-w-2xl mx-auto p-4 space-y-4">
          <header className="pt-2">
            <div className="flex items-center justify-between mb-1">
              <h1 className="text-2xl font-bold tracking-tight">Inventory</h1>
              <Badge variant="secondary" className="font-mono text-xs">
                {auctions.length} items
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground">All items in your inventory</p>
          </header>

          {auctions.length === 0 ? (
            <div className="text-center py-16 px-4">
              <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mx-auto mb-4">
                <Archive className="w-8 h-8 text-muted-foreground" />
              </div>
              <h3 className="font-semibold text-lg mb-1">Inventory empty</h3>
              <p className="text-muted-foreground text-sm">
                Scanned items will appear here after sending from batch
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {auctions.map((auction) => {
                const dest = (auction.destination as DestinationType) || 'auction';
                const isListed = auction.status === 'active' || auction.externalStatus === 'listed';
                
                return (
                  <div 
                    key={auction.id} 
                    className={`p-3 rounded-xl transition-colors ${
                      isListed
                        ? 'bg-green-500/10 border border-green-500/30' 
                        : 'bg-muted/50 hover:bg-muted/80'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-14 h-14 rounded-lg bg-background flex items-center justify-center shrink-0 overflow-hidden">
                        {auction.image ? (
                          <img src={auction.image} alt={auction.title} className="w-full h-full object-cover rounded-lg" />
                        ) : (
                          <Package className="w-6 h-6 text-muted-foreground" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 mb-0.5 flex-wrap">
                          <p className="font-medium text-sm truncate">{auction.title}</p>
                          <Badge 
                            variant="outline" 
                            className={`text-[10px] px-1.5 py-0 ${
                              dest === 'auction' ? 'border-primary text-primary' :
                              dest === 'ebay' ? 'border-blue-500 text-blue-600' :
                              'border-orange-500 text-orange-600'
                            }`}
                          >
                            {dest === 'auction' && <Gavel className="w-2.5 h-2.5 mr-0.5" />}
                            {dest === 'ebay' && <SiEbay className="w-2.5 h-2.5 mr-0.5" />}
                            {dest === 'amazon' && <SiAmazon className="w-2.5 h-2.5 mr-0.5" />}
                            {dest === 'auction' ? 'Auction' : dest === 'ebay' ? 'eBay' : 'Amazon'}
                          </Badge>
                          {isListed && (
                            <Badge variant="default" className="text-[10px] px-1.5 py-0 bg-green-600">
                              Live
                            </Badge>
                          )}
                          {auction.externalStatus === 'pending' && (
                            <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                              Pending
                            </Badge>
                          )}
                          {auction.externalStatus === 'error' && (
                            <Badge variant="destructive" className="text-[10px] px-1.5 py-0">
                              Error
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <span className="font-semibold text-foreground">
                            {auction.retailPrice ? `$${(auction.retailPrice / 100).toFixed(2)}` : '—'}
                          </span>
                          <span className="font-mono text-[10px] truncate">{auction.internalCode || auction.upc}</span>
                          {auction.shelfId && (
                            <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-green-400 text-green-600">
                              <MapPin className="w-2.5 h-2.5 mr-0.5" />
                              {shelves.find(s => s.id === auction.shelfId)?.name || `Shelf ${auction.shelfId}`}
                            </Badge>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-0.5">
                        {auction.status === 'draft' && !auction.externalStatus && (
                          <Button
                            variant="default"
                            size="sm"
                            className={`h-8 px-2 text-xs ${
                              dest === 'ebay' ? 'bg-blue-600 hover:bg-blue-700' :
                              dest === 'amazon' ? 'bg-orange-600 hover:bg-orange-700' : ''
                            }`}
                            onClick={() => handlePublish(auction.id, dest)}
                            disabled={publishMutation.isPending}
                            data-testid={`button-publish-${auction.id}`}
                          >
                            {dest === 'auction' && <Gavel className="w-3 h-3 mr-1" />}
                            {dest === 'ebay' && <SiEbay className="w-3 h-3 mr-1" />}
                            {dest === 'amazon' && <SiAmazon className="w-3 h-3 mr-1" />}
                            {dest === 'auction' ? 'Go Live' : 'Publish'}
                          </Button>
                        )}
                        {auction.externalListingUrl && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => window.open(auction.externalListingUrl!, '_blank')}
                            data-testid={`button-view-${auction.id}`}
                          >
                            <ExternalLink className="w-4 h-4" />
                          </Button>
                        )}
                        {auction.internalCode && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => handlePrintBarcode(auction.internalCode!)}
                            data-testid={`button-print-${auction.id}`}
                          >
                            <Printer className="w-4 h-4" />
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive hover:text-destructive"
                          onClick={() => handleDeleteAuction(auction.id)}
                          data-testid={`button-delete-${auction.id}`}
                        >
                          <X className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {activeTab === 'fulfillment' && (
        <div className="max-w-2xl mx-auto p-4 space-y-4 pb-24">
          <header className="pt-2">
            <h1 className="text-2xl font-bold tracking-tight">Fulfillment</h1>
            <p className="text-sm text-muted-foreground">External listings & orders</p>
          </header>

          {(() => {
            const externalAuctions = auctions.filter(a => 
              a.destination === 'ebay' || a.destination === 'amazon'
            );
            
            if (externalAuctions.length === 0) {
              return (
                <div className="text-center py-16 px-4">
                  <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mx-auto mb-4">
                    <Truck className="w-8 h-8 text-muted-foreground" />
                  </div>
                  <h3 className="font-semibold text-lg mb-1">No external listings</h3>
                  <p className="text-muted-foreground text-sm max-w-xs mx-auto">
                    Items sent to eBay or Amazon will appear here
                  </p>
                </div>
              );
            }
            
            return (
              <div className="space-y-2">
                {externalAuctions.map((auction) => {
                  const dest = auction.destination as DestinationType;
                  return (
                    <div 
                      key={auction.id}
                      className={`p-3 rounded-xl ${
                        auction.externalStatus === 'listed' ? 'bg-green-500/10 border border-green-500/30' :
                        auction.externalStatus === 'error' ? 'bg-red-500/10 border border-red-500/30' :
                        'bg-muted/50'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-lg bg-background flex items-center justify-center shrink-0 overflow-hidden">
                          {auction.image ? (
                            <img src={auction.image} alt={auction.title} className="w-full h-full object-cover rounded-lg" />
                          ) : (
                            <Package className="w-5 h-5 text-muted-foreground" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5 mb-0.5 flex-wrap">
                            <p className="font-medium text-sm truncate">{auction.title}</p>
                            <Badge 
                              variant="outline" 
                              className={`text-[10px] px-1.5 py-0 ${
                                dest === 'ebay' ? 'border-blue-500 text-blue-600' : 'border-orange-500 text-orange-600'
                              }`}
                            >
                              {dest === 'ebay' && <SiEbay className="w-2.5 h-2.5 mr-0.5" />}
                              {dest === 'amazon' && <SiAmazon className="w-2.5 h-2.5 mr-0.5" />}
                              {dest === 'ebay' ? 'eBay' : 'Amazon'}
                            </Badge>
                            {auction.externalStatus === 'listed' && (
                              <Badge variant="default" className="text-[10px] px-1.5 py-0 bg-green-600">
                                Listed
                              </Badge>
                            )}
                            {auction.externalStatus === 'pending' && (
                              <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                                Pending
                              </Badge>
                            )}
                            {auction.externalStatus === 'error' && (
                              <Badge variant="destructive" className="text-[10px] px-1.5 py-0">
                                Error
                              </Badge>
                            )}
                          </div>
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <span className="font-mono text-[10px] truncate">{auction.externalListingId || auction.internalCode}</span>
                          </div>
                        </div>
                        {auction.externalListingUrl && (
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-8 text-xs"
                            onClick={() => window.open(auction.externalListingUrl!, '_blank')}
                            data-testid={`button-view-listing-${auction.id}`}
                          >
                            <ExternalLink className="w-3 h-3 mr-1" />
                            View
                          </Button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })()}
        </div>
      )}

      {activeTab === 'shelves' && (
        <div className="max-w-2xl mx-auto p-4 space-y-6">
          <header className="pt-2">
            <div className="flex items-center justify-between mb-1">
              <h1 className="text-2xl font-bold tracking-tight">Shelves</h1>
              <Badge variant="secondary" className="font-mono text-xs">
                {shelves.length} shelves
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground">Track items across shelf locations</p>
          </header>

          {selectedShelf === null ? (
            <>
              <div className="grid grid-cols-4 gap-2">
                {shelves.map((shelf) => {
                  const itemsOnShelf = auctions.filter(a => a.shelfId === shelf.id);
                  return (
                    <button
                      key={shelf.id}
                      onClick={() => setSelectedShelf(shelf.id)}
                      className="p-3 rounded-xl border bg-card hover-elevate text-center transition-all"
                      data-testid={`button-shelf-${shelf.id}`}
                    >
                      <div className="font-mono font-bold text-lg">{shelf.code}</div>
                      <div className="text-xs text-muted-foreground mt-1">
                        {itemsOnShelf.length} items
                      </div>
                    </button>
                  );
                })}
              </div>
            </>
          ) : (
            <>
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setSelectedShelf(null);
                    setShelfScanCode('');
                  }}
                  data-testid="button-back-shelves"
                >
                  <X className="w-4 h-4 mr-1" />
                  Back
                </Button>
                <div className="flex-1">
                  <h2 className="font-bold text-lg">
                    {shelves.find(s => s.id === selectedShelf)?.name}
                  </h2>
                  <span className="font-mono text-sm text-muted-foreground">
                    {shelves.find(s => s.id === selectedShelf)?.code}
                  </span>
                </div>
              </div>

              <Card>
                <CardContent className="p-4 space-y-3">
                  <div className="flex gap-2">
                    <Button
                      variant={shelfScanMode === 'in' ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setShelfScanMode('in')}
                      className="flex-1"
                      data-testid="button-scan-in"
                    >
                      <LogIn className="w-4 h-4 mr-1" />
                      Scan In
                    </Button>
                    <Button
                      variant={shelfScanMode === 'out' ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setShelfScanMode('out')}
                      className="flex-1"
                      data-testid="button-scan-out"
                    >
                      <LogOut className="w-4 h-4 mr-1" />
                      Scan Out
                    </Button>
                  </div>
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <ScanLine className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <Input
                        value={shelfScanCode}
                        onChange={(e) => setShelfScanCode(e.target.value)}
                        placeholder={shelfScanMode === 'in' ? 'Scan to add to shelf...' : 'Scan to remove from shelf...'}
                        disabled={updateAuctionShelfMutation.isPending}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && shelfScanCode.trim() && !updateAuctionShelfMutation.isPending) {
                            const searchCode = shelfScanCode.trim();
                            const item = auctions.find(a => 
                              (a.upc && a.upc === searchCode) || 
                              (a.internalCode && a.internalCode === searchCode)
                            );
                            if (item) {
                              if (shelfScanMode === 'in') {
                                updateAuctionShelfMutation.mutate(
                                  { id: item.id, shelfId: selectedShelf },
                                  { onSuccess: () => toast({ title: `Moved "${item.title.slice(0, 30)}..." to this shelf` }) }
                                );
                              } else {
                                updateAuctionShelfMutation.mutate(
                                  { id: item.id, shelfId: null },
                                  { onSuccess: () => toast({ title: `Removed "${item.title.slice(0, 30)}..." from shelf` }) }
                                );
                              }
                            } else {
                              toast({ title: 'Item not found in inventory', variant: 'destructive' });
                            }
                            setShelfScanCode('');
                          }
                        }}
                        className="pl-9"
                        autoFocus
                        data-testid="input-shelf-scan"
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <div className="space-y-2">
                <div className="text-sm font-medium text-muted-foreground">
                  Items on this shelf ({auctions.filter(a => a.shelfId === selectedShelf).length})
                </div>
                {auctions.filter(a => a.shelfId === selectedShelf).length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <Package className="w-8 h-8 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">No items on this shelf</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {auctions.filter(a => a.shelfId === selectedShelf).map((auction) => (
                      <Card key={auction.id} className="overflow-hidden">
                        <CardContent className="p-0">
                          <div className="flex items-center">
                            <div className="w-14 h-14 bg-muted flex items-center justify-center shrink-0">
                              {auction.image ? (
                                <img 
                                  src={auction.image} 
                                  alt={auction.title}
                                  className="w-full h-full object-cover"
                                />
                              ) : (
                                <Package className="w-5 h-5 text-muted-foreground" />
                              )}
                            </div>
                            <div className="flex-1 p-2 min-w-0">
                              <div className="font-medium text-sm truncate">{auction.title}</div>
                              <div className="text-xs text-muted-foreground font-mono">
                                {auction.internalCode || auction.upc}
                              </div>
                            </div>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="mr-2"
                              disabled={updateAuctionShelfMutation.isPending}
                              onClick={() => {
                                updateAuctionShelfMutation.mutate(
                                  { id: auction.id, shelfId: null },
                                  { onSuccess: () => toast({ title: 'Removed from shelf' }) }
                                );
                              }}
                              data-testid={`button-remove-${auction.id}`}
                            >
                              <LogOut className="w-4 h-4" />
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      )}

      {/* Bottom Tab Bar */}
      <div className="fixed bottom-0 left-0 right-0 bg-background border-t safe-area-pb">
        <div className="max-w-2xl mx-auto flex">
          <button
            onClick={() => setActiveTab('scanner')}
            className={`flex-1 flex flex-col items-center gap-1 py-3 transition-colors ${
              activeTab === 'scanner' 
                ? 'text-primary' 
                : 'text-muted-foreground hover:text-foreground'
            }`}
            data-testid="tab-scanner"
          >
            <ScanLine className="w-5 h-5" />
            <span className="text-xs font-medium">Scanner</span>
          </button>
          <button
            onClick={() => setActiveTab('inventory')}
            className={`flex-1 flex flex-col items-center gap-1 py-3 transition-colors ${
              activeTab === 'inventory' 
                ? 'text-primary' 
                : 'text-muted-foreground hover:text-foreground'
            }`}
            data-testid="tab-inventory"
          >
            <Archive className="w-5 h-5" />
            <span className="text-xs font-medium">Inventory</span>
          </button>
          <button
            onClick={() => setActiveTab('fulfillment')}
            className={`flex-1 flex flex-col items-center gap-1 py-3 transition-colors ${
              activeTab === 'fulfillment' 
                ? 'text-primary' 
                : 'text-muted-foreground hover:text-foreground'
            }`}
            data-testid="tab-fulfillment"
          >
            <Truck className="w-5 h-5" />
            <span className="text-xs font-medium">Fulfillment</span>
          </button>
          <button
            onClick={() => setActiveTab('shelves')}
            className={`flex-1 flex flex-col items-center gap-1 py-3 transition-colors ${
              activeTab === 'shelves' 
                ? 'text-primary' 
                : 'text-muted-foreground hover:text-foreground'
            }`}
            data-testid="tab-shelves"
          >
            <Grid3X3 className="w-5 h-5" />
            <span className="text-xs font-medium">Shelves</span>
          </button>
        </div>
      </div>

      <Dialog open={showBarcodeDialog} onOpenChange={setShowBarcodeDialog}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Print Barcode</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col items-center py-4">
            <div className="bg-white p-4 rounded-lg">
              <svg ref={barcodeRef} data-testid="barcode-svg"></svg>
            </div>
            <div className="flex gap-2 mt-6 w-full">
              <Button onClick={printBarcode} className="flex-1" data-testid="button-confirm-print">
                <Printer className="w-4 h-4 mr-2" />
                Print
              </Button>
              <Button variant="outline" onClick={() => setShowBarcodeDialog(false)} className="flex-1">
                Close
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
