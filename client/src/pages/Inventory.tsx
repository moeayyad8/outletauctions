import { useQuery, useMutation } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft, Download, Package, Image as ImageIcon, Check, Clock, CheckCircle2, Upload } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { Auction } from "@shared/schema";

const EBAY_CONDITION_MAP: Record<string, string> = {
  new: "1000",
  like_new: "3000",
  good: "5000",
  acceptable: "6000",
  parts_damaged: "7000",
};

const EBAY_CONDITION_LABELS: Record<string, string> = {
  "1000": "NEW",
  "3000": "LIKE_NEW",
  "5000": "GOOD",
  "6000": "ACCEPTABLE",
  "7000": "FOR_PARTS_OR_NOT_WORKING",
};

function getPublicImageUrl(image: string | null): string {
  if (!image) return '';
  if (image.startsWith('/objects/')) {
    return `${window.location.origin}${image}`;
  }
  return image;
}

function generateEbayCSV(items: Auction[]): string {
  const headers = [
    '#INFO,Version=0.0.2,Template= eBay-draft-listings-template_US,,,,,,,,',
    '#INFO Action and Category ID are required fields. 1) Set Action to Draft 2) Please find the category ID for your listings here: https://pages.ebay.com/sellerinformation/news/categorychanges.html,,,,,,,,,,',
    '"#INFO After you\'ve successfully uploaded your draft from the Seller Hub Reports tab, complete your drafts to active listings here: https://www.ebay.com/sh/lst/drafts",,,,,,,,,,',
    '#INFO,,,,,,,,,,',
    'Action(SiteID=US|Country=US|Currency=USD|Version=1193|CC=UTF-8),Custom label (SKU),Category ID,Title,UPC,Price,Quantity,Item photo URL,Condition ID,Description,Format',
  ];

  const rows = items.map(item => {
    const conditionLabel = item.condition ? 
      (item.condition === 'new' ? 'NEW' : 
       item.condition === 'like_new' ? 'LIKE_NEW' :
       item.condition === 'good' ? 'GOOD' :
       item.condition === 'acceptable' ? 'ACCEPTABLE' :
       item.condition === 'parts_damaged' ? 'FOR_PARTS_OR_NOT_WORKING' : 'NEW') 
      : 'NEW';
    const priceInDollars = item.retailPrice ? (item.retailPrice / 100) : "";
    const escapedTitle = (item.title || "").replace(/"/g, '""');
    const escapedDesc = (item.description || "").replace(/"/g, '""');
    const imageUrl = getPublicImageUrl(item.image);
    
    return [
      'Draft',
      item.internalCode || '',
      '47140',
      escapedTitle,
      item.upc || '',
      priceInDollars,
      item.stockQuantity || 1,
      imageUrl,
      conditionLabel,
      `<p>${escapedDesc}</p>`,
      'FixedPrice',
    ].join(',');
  });

  return [...headers, ...rows].join('\n');
}

function downloadCSV(content: string, filename: string) {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export default function Inventory() {
  const [activeTab, setActiveTab] = useState("all");
  const { toast } = useToast();
  
  const { data: auctions = [], isLoading } = useQuery<Auction[]>({
    queryKey: ['/api/staff/auctions'],
  });

  const ebayItems = useMemo(() => 
    auctions.filter(a => a.destination === 'ebay'), 
    [auctions]
  );
  
  const readyToExportItems = useMemo(() => 
    ebayItems.filter(a => !a.ebayStatus || a.ebayStatus === null), 
    [ebayItems]
  );
  
  const exportedItems = useMemo(() => 
    ebayItems.filter(a => a.ebayStatus === 'exported'), 
    [ebayItems]
  );
  
  const listedItems = useMemo(() => 
    ebayItems.filter(a => a.ebayStatus === 'listed'), 
    [ebayItems]
  );
  
  const amazonItems = useMemo(() => 
    auctions.filter(a => a.destination === 'amazon'), 
    [auctions]
  );

  const markExportedMutation = useMutation({
    mutationFn: async (ids: number[]) => {
      const response = await apiRequest('POST', '/api/staff/auctions/mark-exported', { ids });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/staff/auctions'] });
    },
  });

  const markListedMutation = useMutation({
    mutationFn: async (ids: number[]) => {
      const response = await apiRequest('POST', '/api/staff/auctions/mark-listed', { ids });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/staff/auctions'] });
    },
  });

  const handleExportEbayCSV = async () => {
    if (readyToExportItems.length === 0) {
      toast({ title: 'No new items to export', variant: 'destructive' });
      return;
    }
    
    const ids = readyToExportItems.map(item => item.id);
    const itemCount = readyToExportItems.length;
    const itemsToExport = [...readyToExportItems];
    
    try {
      await markExportedMutation.mutateAsync(ids);
      
      const csv = generateEbayCSV(itemsToExport);
      const timestamp = new Date().toISOString().slice(0, 10);
      const timeStr = new Date().toTimeString().slice(0, 5).replace(':', '-');
      downloadCSV(csv, `ebay-draft-listings-${timestamp}-${timeStr}.csv`);
      
      toast({ 
        title: `Exported ${itemCount} items`, 
        description: 'Upload the CSV to eBay, then click "Mark as Listed"' 
      });
    } catch (error) {
      toast({ 
        title: 'Export failed', 
        description: 'Could not mark items as exported. Please try again.',
        variant: 'destructive' 
      });
    }
  };

  const handleMarkAsListed = async () => {
    if (exportedItems.length === 0) return;
    
    const ids = exportedItems.map(item => item.id);
    
    try {
      await markListedMutation.mutateAsync(ids);
      toast({ 
        title: `Marked ${ids.length} items as listed`, 
        description: 'Items moved to Listed section' 
      });
    } catch (error) {
      toast({ 
        title: 'Failed to mark as listed', 
        variant: 'destructive' 
      });
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 bg-background/95 backdrop-blur border-b">
        <div className="flex items-center gap-4 p-4">
          <Link href="/staff">
            <Button variant="ghost" size="icon" data-testid="button-back-staff">
              <ArrowLeft className="w-5 h-5" />
            </Button>
          </Link>
          <h1 className="text-lg font-bold">Inventory</h1>
          <Badge variant="secondary" className="ml-auto">
            {auctions.length} items
          </Badge>
        </div>
      </header>

      <main className="p-4 space-y-4">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-3" data-testid="tabs-inventory">
            <TabsTrigger value="all" data-testid="tab-all">
              All ({auctions.length})
            </TabsTrigger>
            <TabsTrigger value="ebay" data-testid="tab-ebay">
              eBay ({ebayItems.length})
            </TabsTrigger>
            <TabsTrigger value="amazon" data-testid="tab-amazon">
              Amazon ({amazonItems.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="all" className="mt-4 space-y-3">
            <InventoryList items={auctions} showDestination />
          </TabsContent>

          <TabsContent value="ebay" className="mt-4 space-y-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between gap-4 pb-2">
                <div>
                  <CardTitle className="text-base">Ready to Export</CardTitle>
                  <p className="text-xs text-muted-foreground mt-1">
                    {readyToExportItems.length} new items
                  </p>
                </div>
                <Button
                  size="sm"
                  onClick={handleExportEbayCSV}
                  disabled={readyToExportItems.length === 0 || markExportedMutation.isPending}
                  data-testid="button-export-ebay-csv"
                >
                  <Download className="w-4 h-4 mr-2" />
                  {markExportedMutation.isPending ? 'Exporting...' : `Export ${readyToExportItems.length} Items`}
                </Button>
              </CardHeader>
              <CardContent className="pt-2">
                {readyToExportItems.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-6">
                    No new items to export
                  </p>
                ) : (
                  <div className="space-y-2">
                    {readyToExportItems.map(item => (
                      <EbayItemRow key={item.id} item={item} />
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {exportedItems.length > 0 && (
              <Card className="border-amber-200 bg-amber-50/50 dark:border-amber-800 dark:bg-amber-900/20">
                <CardHeader className="flex flex-row items-center justify-between gap-4 pb-2">
                  <div className="flex items-center gap-2">
                    <Upload className="w-4 h-4 text-amber-600" />
                    <div>
                      <CardTitle className="text-base">Pending Upload to eBay</CardTitle>
                      <p className="text-xs text-muted-foreground">
                        {exportedItems.length} items exported - upload CSV to eBay then mark as listed
                      </p>
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleMarkAsListed}
                    disabled={markListedMutation.isPending}
                    data-testid="button-mark-listed"
                  >
                    <Check className="w-4 h-4 mr-2" />
                    {markListedMutation.isPending ? 'Marking...' : 'Mark as Listed'}
                  </Button>
                </CardHeader>
                <CardContent className="pt-2">
                  <div className="space-y-2">
                    {exportedItems.map(item => (
                      <EbayItemRow key={item.id} item={item} status="exported" />
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {listedItems.length > 0 && (
              <Card>
                <CardHeader className="pb-2">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-green-600" />
                    <CardTitle className="text-base">Listed on eBay</CardTitle>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {listedItems.length} items already on eBay
                  </p>
                </CardHeader>
                <CardContent className="pt-2">
                  <div className="space-y-2 opacity-60">
                    {listedItems.map(item => (
                      <EbayItemRow key={item.id} item={item} status="listed" />
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="amazon" className="mt-4 space-y-3">
            <InventoryList items={amazonItems} />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}

function InventoryList({ items, showDestination = false }: { items: Auction[]; showDestination?: boolean }) {
  if (items.length === 0) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          No items in inventory
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-2">
      {items.map(item => (
        <Card key={item.id} className="overflow-hidden">
          <div className="flex gap-3 p-3">
            <div className="w-16 h-16 bg-muted rounded flex items-center justify-center flex-shrink-0">
              {item.image ? (
                <img 
                  src={item.image} 
                  alt={item.title} 
                  className="w-full h-full object-cover rounded"
                />
              ) : (
                <ImageIcon className="w-6 h-6 text-muted-foreground" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-medium text-sm truncate" data-testid={`text-title-${item.id}`}>
                {item.title}
              </p>
              <p className="text-xs text-muted-foreground">
                {item.internalCode || item.upc || 'No code'}
              </p>
              <div className="flex items-center gap-2 mt-1">
                {item.retailPrice && (
                  <Badge variant="secondary" className="text-xs">
                    ${(item.retailPrice / 100).toFixed(2)}
                  </Badge>
                )}
                {showDestination && (
                  <Badge 
                    variant={item.destination === 'ebay' ? 'default' : item.destination === 'amazon' ? 'outline' : 'secondary'}
                    className="text-xs"
                  >
                    {item.destination}
                  </Badge>
                )}
                {item.condition && (
                  <span className="text-xs text-muted-foreground capitalize">
                    {item.condition.replace('_', ' ')}
                  </span>
                )}
              </div>
            </div>
          </div>
        </Card>
      ))}
    </div>
  );
}

function EbayItemRow({ item, status }: { item: Auction; status?: 'exported' | 'listed' }) {
  const conditionId = item.condition ? (EBAY_CONDITION_MAP[item.condition] || "1000") : "1000";
  const conditionLabel = EBAY_CONDITION_LABELS[conditionId] || "NEW";
  
  return (
    <div 
      className="flex items-center gap-3 p-2 rounded-md border bg-card"
      data-testid={`ebay-item-${item.id}`}
    >
      <div className="w-12 h-12 bg-muted rounded flex items-center justify-center flex-shrink-0">
        {item.image ? (
          <img 
            src={item.image} 
            alt={item.title} 
            className="w-full h-full object-cover rounded"
          />
        ) : (
          <Package className="w-5 h-5 text-muted-foreground" />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-medium text-sm truncate">{item.title}</p>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span>{item.internalCode || 'No SKU'}</span>
          <span>|</span>
          <span>{conditionLabel}</span>
          {item.retailPrice && (
            <>
              <span>|</span>
              <span className="font-medium">${(item.retailPrice / 100).toFixed(2)}</span>
            </>
          )}
        </div>
      </div>
      {status === 'listed' && (
        <Badge variant="outline" className="text-xs text-green-600 border-green-600 flex-shrink-0">
          Listed
        </Badge>
      )}
      {status === 'exported' && (
        <Badge variant="outline" className="text-xs text-amber-600 border-amber-600 flex-shrink-0">
          Exported
        </Badge>
      )}
    </div>
  );
}
