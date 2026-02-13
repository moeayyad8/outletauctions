import { useQuery, useMutation } from "@tanstack/react-query";
import { useMemo, useState, useRef } from "react";
import { Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft, Download, Package, Image as ImageIcon, Check, Clock, CheckCircle2, Upload, Database, FileUp, FileDown } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { Auction } from "@shared/schema";

type InventoryLocation = "bins" | "things" | "flatrate" | "unassigned";

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

function getInventoryLocation(item: Auction): InventoryLocation {
  const loc = (item.externalPayload as any)?.inventoryLocation;
  if (loc === "bins" || loc === "things" || loc === "flatrate") return loc;
  return "unassigned";
}

function locationLabel(location: InventoryLocation): string {
  if (location === "bins") return "Bins";
  if (location === "things") return "Things";
  if (location === "flatrate") return "Flatrate";
  return "Unassigned";
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

  const binsItems = useMemo(
    () => auctions.filter(a => getInventoryLocation(a) === "bins"),
    [auctions]
  );

  const thingsItems = useMemo(
    () => auctions.filter(a => getInventoryLocation(a) === "things"),
    [auctions]
  );

  const flatrateItems = useMemo(
    () => auctions.filter(a => getInventoryLocation(a) === "flatrate"),
    [auctions]
  );

  const unassignedItems = useMemo(
    () => auctions.filter(a => getInventoryLocation(a) === "unassigned"),
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
      const csv = generateEbayCSV(itemsToExport);
      const timestamp = new Date().toISOString().slice(0, 10);
      const timeStr = new Date().toTimeString().slice(0, 5).replace(':', '-');
      downloadCSV(csv, `ebay-draft-listings-${timestamp}-${timeStr}.csv`);

      try {
        await markExportedMutation.mutateAsync(ids);
      } catch (markError: any) {
        toast({
          title: `CSV downloaded (${itemCount} items)`,
          description: `Could not mark exported status: ${markError?.message || 'Unknown error'}`,
          variant: 'destructive'
        });
        return;
      }
      
      toast({ 
        title: `Exported ${itemCount} items`, 
        description: 'Upload the CSV to eBay, then click "Mark as Listed"' 
      });
    } catch (error: any) {
      toast({ 
        title: 'Export failed', 
        description: error?.message || 'Could not generate CSV. Please try again.',
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

  // Data migration handlers
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);

  const handleExportData = async () => {
    setIsExporting(true);
    try {
      const response = await fetch('/api/admin/export');
      if (!response.ok) throw new Error('Export failed');
      
      const exportData = await response.json();
      const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      const timestamp = new Date().toISOString().slice(0, 10);
      link.download = `outlet-auctions-backup-${timestamp}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      
      toast({ 
        title: `Exported ${exportData.data.auctions.length} items`,
        description: 'Backup saved. Upload to production to restore.'
      });
    } catch (error) {
      toast({ title: 'Export failed', variant: 'destructive' });
    } finally {
      setIsExporting(false);
    }
  };

  const handleImportData = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    
    setIsImporting(true);
    try {
      const text = await file.text();
      const importData = JSON.parse(text);
      
      if (!importData.data?.auctions) {
        throw new Error('Invalid backup file format');
      }
      
      const auctions = Array.isArray(importData.data.auctions) ? importData.data.auctions : [];
      const shelves = Array.isArray(importData.data.shelves) ? importData.data.shelves : [];
      const tags = Array.isArray(importData.data.tags) ? importData.data.tags : [];
      const chunkSize = 75;

      let totalImported = 0;
      let totalSkipped = 0;

      for (let i = 0; i < auctions.length; i += chunkSize) {
        const chunk = auctions.slice(i, i + chunkSize);
        const response = await apiRequest('POST', '/api/admin/import', {
          data: {
            auctions: chunk,
            shelves: i === 0 ? shelves : [],
            tags: i === 0 ? tags : [],
          },
          options: {
            importShelves: i === 0,
            importTags: i === 0,
          },
        });
        const result = await response.json();
        totalImported += result?.imported?.auctions ?? 0;
        totalSkipped += result?.imported?.skipped ?? 0;
      }

      queryClient.invalidateQueries({ queryKey: ['/api/staff/auctions'] });
      
      toast({ 
        title: `Imported ${totalImported} items`,
        description: totalSkipped > 0 ? `${totalSkipped} skipped as duplicates/invalid` : 'Data imported successfully'
      });
    } catch (error) {
      toast({ 
        title: 'Import failed', 
        description: error instanceof Error ? error.message : 'Invalid file',
        variant: 'destructive' 
      });
    } finally {
      setIsImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
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
    <div className="min-h-screen bg-gradient-to-b from-slate-50 via-background to-background">
      <header className="sticky top-0 z-50 bg-background/95 backdrop-blur border-b">
        <div className="flex items-center gap-4 p-4">
          <Link href="/staff">
            <Button variant="ghost" size="icon" data-testid="button-back-staff">
              <ArrowLeft className="w-5 h-5" />
            </Button>
          </Link>
          <div>
            <h1 className="text-lg font-bold">Inventory</h1>
            <p className="text-xs text-muted-foreground">Track local inventory, exports, and listing state</p>
          </div>
          <Badge variant="secondary" className="ml-auto">
            {auctions.length} items
          </Badge>
        </div>
      </header>

      <main className="p-4 space-y-4">
        <div className="grid grid-cols-3 gap-2">
          <Card className="rounded-xl shadow-sm">
            <CardContent className="p-3">
              <p className="text-[11px] text-muted-foreground">Ready eBay</p>
              <p className="text-xl font-bold">{readyToExportItems.length}</p>
            </CardContent>
          </Card>
          <Card className="rounded-xl shadow-sm">
            <CardContent className="p-3">
              <p className="text-[11px] text-muted-foreground">Exported</p>
              <p className="text-xl font-bold">{exportedItems.length}</p>
            </CardContent>
          </Card>
          <Card className="rounded-xl shadow-sm">
            <CardContent className="p-3">
              <p className="text-[11px] text-muted-foreground">Listed</p>
              <p className="text-xl font-bold">{listedItems.length}</p>
            </CardContent>
          </Card>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-3 rounded-xl bg-card border" data-testid="tabs-inventory">
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
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Bins</CardTitle>
              </CardHeader>
              <CardContent className="pt-2">
                <InventoryList items={binsItems} showDestination />
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Things</CardTitle>
              </CardHeader>
              <CardContent className="pt-2">
                <InventoryList items={thingsItems} showDestination />
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Flatrate</CardTitle>
              </CardHeader>
              <CardContent className="pt-2">
                <InventoryList items={flatrateItems} showDestination />
              </CardContent>
            </Card>

            {unassignedItems.length > 0 && (
              <Card className="border-amber-300">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base text-amber-700">Unassigned</CardTitle>
                </CardHeader>
                <CardContent className="pt-2">
                  <InventoryList items={unassignedItems} showDestination />
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="ebay" className="mt-4 space-y-4">
            <Card className="rounded-2xl shadow-sm">
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
              <Card className="rounded-2xl shadow-sm border-amber-200 bg-amber-50/50 dark:border-amber-800 dark:bg-amber-900/20">
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
              <Card className="rounded-2xl shadow-sm">
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

        {/* Data Migration Section */}
        <Card className="mt-6 border-dashed rounded-2xl shadow-sm">
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <Database className="w-4 h-4 text-muted-foreground" />
              <CardTitle className="text-base">Data Migration</CardTitle>
            </div>
            <p className="text-xs text-muted-foreground">
              Export from development, import to production
            </p>
          </CardHeader>
          <CardContent className="pt-2">
            <div className="flex flex-col gap-3 sm:flex-row">
              <Button 
                variant="outline" 
                onClick={handleExportData}
                disabled={isExporting}
                className="flex-1"
                data-testid="button-export-data"
              >
                <FileDown className="w-4 h-4 mr-2" />
                {isExporting ? 'Exporting...' : 'Export All Data'}
              </Button>
              
              <input
                ref={fileInputRef}
                type="file"
                accept=".json"
                onChange={handleImportData}
                className="hidden"
                data-testid="input-import-file"
              />
              <Button 
                variant="outline" 
                onClick={() => fileInputRef.current?.click()}
                disabled={isImporting}
                className="flex-1"
                data-testid="button-import-data"
              >
                <FileUp className="w-4 h-4 mr-2" />
                {isImporting ? 'Importing...' : 'Import Data'}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground text-center mt-3">
              Exports all inventory items and tags. Import on production after deploying.
            </p>
          </CardContent>
        </Card>
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
        <Card key={item.id} className="overflow-hidden rounded-xl shadow-sm border">
          <div className="flex gap-3 p-3.5">
            <div className="w-16 h-16 bg-muted rounded-lg flex items-center justify-center flex-shrink-0">
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
            <div className="flex-1 min-w-0 space-y-1">
              <p className="font-medium text-sm truncate" data-testid={`text-title-${item.id}`}>
                {item.title}
              </p>
              <p className="text-xs text-muted-foreground">
                {item.internalCode || item.upc || 'No code'}
              </p>
              <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                {item.retailPrice && (
                  <Badge variant="secondary" className="text-xs">
                    ${(item.retailPrice / 100).toFixed(2)}
                  </Badge>
                )}
                <Badge variant="outline" className="text-xs">
                  {locationLabel(getInventoryLocation(item))}
                </Badge>
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
          <span>{locationLabel(getInventoryLocation(item))}</span>
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
