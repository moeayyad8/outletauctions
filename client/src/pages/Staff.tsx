import { useState, useRef, useEffect } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { useUpload } from '@/hooks/use-upload';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Package, Camera, X, Plus, Printer, Trash2, Send, Barcode, Archive } from 'lucide-react';
import JsBarcode from 'jsbarcode';
import type { Auction, Tag as TagType } from '@shared/schema';

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

interface BatchItem extends ScanResult {
  customImage: string | null;
  selectedTags: number[];
  id: string;
}

export default function Staff() {
  const [code, setCode] = useState('');
  const [batch, setBatch] = useState<BatchItem[]>([]);
  const [showBarcodeDialog, setShowBarcodeDialog] = useState(false);
  const [barcodeValue, setBarcodeValue] = useState('');
  const [editingItem, setEditingItem] = useState<string | null>(null);
  const [newTagName, setNewTagName] = useState('');
  const [newTagType, setNewTagType] = useState<'location' | 'category'>('category');
  const barcodeRef = useRef<SVGSVGElement>(null);
  const { toast } = useToast();

  const { data: allTags = [] } = useQuery<TagType[]>({
    queryKey: ['/api/tags'],
  });

  const { data: auctions = [] } = useQuery<Auction[]>({
    queryKey: ['/api/staff/auctions'],
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
      };
      setBatch(prev => [newItem, ...prev]);
      toast({ title: `Generated: ${data.code}` });
    },
  });

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
      };
      const response = await apiRequest('POST', '/api/staff/auctions', auctionData);
      const auction = await response.json();
      
      if (item.selectedTags.length > 0) {
        await apiRequest('POST', `/api/staff/auctions/${auction.id}/tags`, { tagIds: item.selectedTags });
      }
      
      return auction;
    },
  });

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

  const [isSending, setIsSending] = useState(false);

  const handleSendToInventory = async () => {
    if (batch.length === 0) return;
    
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
    <div className="min-h-screen bg-gradient-to-br from-background to-muted/30">
      <div className="max-w-4xl mx-auto p-4 space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">Staff Scanner</h1>
          <Badge variant="outline" className="text-sm">
            {auctions.length} in inventory
          </Badge>
        </div>

        <Card>
          <CardContent className="p-4">
            <div className="flex gap-2">
              <Input
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="Scan barcode..."
                onKeyDown={(e) => e.key === 'Enter' && handleScan()}
                className="text-lg h-12"
                autoFocus
                data-testid="input-code"
              />
              <Button 
                onClick={handleScan} 
                disabled={scanMutation.isPending}
                className="h-12 px-6"
                data-testid="button-scan"
              >
                <Barcode className="w-5 h-5 mr-2" />
                Scan
              </Button>
            </div>
            <div className="flex items-center justify-between mt-3">
              <p className="text-xs text-muted-foreground">
                UPC/EAN auto-lookup • ASIN/other need manual entry
              </p>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => generateInternalCodeMutation.mutate()}
                disabled={generateInternalCodeMutation.isPending}
                data-testid="button-generate-internal"
              >
                <Plus className="w-4 h-4 mr-1" />
                New Code
              </Button>
            </div>
          </CardContent>
        </Card>

        <Tabs defaultValue="batch" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="batch" className="gap-2">
              <Package className="w-4 h-4" />
              Batch ({batch.length})
            </TabsTrigger>
            <TabsTrigger value="inventory" className="gap-2">
              <Archive className="w-4 h-4" />
              Inventory ({auctions.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="batch" className="space-y-4 mt-4">
            {batch.length > 0 && (
              <Button
                onClick={handleSendToInventory}
                disabled={isSending}
                className="w-full h-14 text-lg"
                data-testid="button-send-inventory"
              >
                <Send className="w-5 h-5 mr-2" />
                {isSending ? 'Sending...' : `Send ${batch.length} Items to Inventory`}
              </Button>
            )}

            {batch.length === 0 ? (
              <Card className="border-dashed">
                <CardContent className="p-8 text-center text-muted-foreground">
                  <Package className="w-12 h-12 mx-auto mb-3 opacity-50" />
                  <p>Scan items to add them to your batch</p>
                  <p className="text-sm">Then send them all to inventory at once</p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-3">
                {batch.map((item) => (
                  <Card key={item.id} className={item.lookupStatus === "SUCCESS" ? "border-green-500/50" : "border-orange-500/50"}>
                    <CardContent className="p-4">
                      <div className="flex gap-4">
                        <div className="w-20 h-20 rounded-lg bg-muted flex items-center justify-center shrink-0 overflow-hidden">
                          {(item.customImage || item.image) ? (
                            <img 
                              src={item.customImage || item.image!} 
                              alt={item.title}
                              className="w-full h-full object-contain"
                            />
                          ) : (
                            <label className="cursor-pointer w-full h-full flex flex-col items-center justify-center gap-1 hover:bg-muted/80">
                              <Camera className="w-6 h-6 text-muted-foreground" />
                              <span className="text-xs text-muted-foreground">Add</span>
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
                        
                        <div className="flex-1 min-w-0 space-y-2">
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <Badge variant={item.lookupStatus === "SUCCESS" ? "default" : "secondary"} className="shrink-0">
                                  {item.codeType}
                                </Badge>
                                {item.lookupStatus !== "SUCCESS" && (
                                  <Badge variant="outline" className="text-orange-600 border-orange-300 shrink-0">
                                    Needs Info
                                  </Badge>
                                )}
                              </div>
                              <p className="font-medium mt-1 truncate">{item.title}</p>
                              <p className="text-xs text-muted-foreground font-mono">{item.code}</p>
                            </div>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleRemoveFromBatch(item.id)}
                              className="shrink-0"
                              data-testid={`button-remove-${item.id}`}
                            >
                              <X className="w-4 h-4" />
                            </Button>
                          </div>
                          
                          {item.highestPrice && (
                            <p className="text-sm text-green-600 font-medium">
                              Retail: ${item.highestPrice.toFixed(2)}
                            </p>
                          )}
                          
                          <div className="flex flex-wrap gap-1">
                            {[...locationTags, ...categoryTags].map(tag => (
                              <Badge
                                key={tag.id}
                                variant={item.selectedTags.includes(tag.id) ? "default" : "outline"}
                                className={`cursor-pointer text-xs ${tag.type === 'location' ? 'border-blue-300' : 'border-purple-300'}`}
                                onClick={() => toggleItemTag(item.id, tag.id)}
                              >
                                {tag.name}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}

            {batch.length > 0 && (
              <div className="flex gap-2">
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
                  Clear Batch
                </Button>
              </div>
            )}

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Quick Add Tag</CardTitle>
              </CardHeader>
              <CardContent className="flex gap-2">
                <Input
                  placeholder="Tag name"
                  value={newTagName}
                  onChange={(e) => setNewTagName(e.target.value)}
                  className="flex-1"
                  data-testid="input-new-tag"
                />
                <select
                  value={newTagType}
                  onChange={(e) => setNewTagType(e.target.value as 'location' | 'category')}
                  className="border rounded px-2 text-sm bg-background"
                  data-testid="select-tag-type"
                >
                  <option value="location">Location</option>
                  <option value="category">Category</option>
                </select>
                <Button
                  size="sm"
                  onClick={() => newTagName.trim() && createTagMutation.mutate({ name: newTagName.trim(), type: newTagType })}
                  disabled={!newTagName.trim()}
                  data-testid="button-create-tag"
                >
                  <Plus className="w-4 h-4" />
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="inventory" className="space-y-3 mt-4">
            {auctions.length === 0 ? (
              <Card className="border-dashed">
                <CardContent className="p-8 text-center text-muted-foreground">
                  <Archive className="w-12 h-12 mx-auto mb-3 opacity-50" />
                  <p>No items in inventory yet</p>
                </CardContent>
              </Card>
            ) : (
              auctions.map((auction) => (
                <Card key={auction.id}>
                  <CardContent className="p-3">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded bg-muted flex items-center justify-center shrink-0 overflow-hidden">
                        {auction.image ? (
                          <img src={auction.image} alt={auction.title} className="w-full h-full object-contain" />
                        ) : (
                          <Package className="w-6 h-6 text-muted-foreground" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate text-sm">{auction.title}</p>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <span>{auction.retailPrice ? `$${(auction.retailPrice / 100).toFixed(2)}` : 'No price'}</span>
                          <span>•</span>
                          <span className="font-mono">{auction.internalCode || auction.upc}</span>
                        </div>
                      </div>
                      {auction.internalCode && (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handlePrintBarcode(auction.internalCode!)}
                          data-testid={`button-print-${auction.id}`}
                        >
                          <Printer className="w-4 h-4" />
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </TabsContent>
        </Tabs>
      </div>

      <Dialog open={showBarcodeDialog} onOpenChange={setShowBarcodeDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Print Barcode</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col items-center space-y-4">
            <svg ref={barcodeRef} data-testid="barcode-svg"></svg>
            <div className="flex gap-2">
              <Button onClick={printBarcode} data-testid="button-confirm-print">
                <Printer className="w-4 h-4 mr-1" />
                Print
              </Button>
              <Button variant="outline" onClick={() => setShowBarcodeDialog(false)}>
                Close
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
