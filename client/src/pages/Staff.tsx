import { useState, useRef, useEffect } from 'react';
import { Link } from 'wouter';
import { useMutation, useQuery } from '@tanstack/react-query';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { useUpload } from '@/hooks/use-upload';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Package, Camera, X, Plus, Printer, Trash2, Send, ScanLine, Archive, ImagePlus, Truck, Gavel, Store, ExternalLink, Grid3X3, ArrowRightLeft, LogIn, LogOut, AlertTriangle, CheckCircle2, Scale, ChevronDown, ChevronUp, Flag, Search, Settings2, RotateCcw } from 'lucide-react';
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

interface RoutingResult {
  primary: 'whatnot' | 'ebay' | 'amazon' | null;
  secondary: 'whatnot' | 'ebay' | 'amazon' | null;
  scores: { whatnot: number; ebay: number; amazon: number };
  disqualifications: { whatnot: string[]; ebay: string[]; amazon: string[] };
  needsReview: boolean;
  missingRequiredFields: string[];
}

type BrandTier = "A" | "B" | "C";
type WeightClass = "light" | "medium" | "heavy";
type ItemCondition = "new" | "like_new" | "good" | "acceptable" | "parts_damaged";

interface BatchItem extends ScanResult {
  customImage: string | null;
  selectedTags: number[];
  id: string;
  destination: DestinationType;
  shelfId: number | null;
  routing: RoutingResult | null;
  brandTier: BrandTier | null;
  condition: ItemCondition | null;
  weightClass: WeightClass | null;
  weightOunces: number | null;
  stockQuantity: number;
}

type TabType = 'scanner' | 'inventory' | 'fulfillment' | 'shelves';

interface ScanDefaults {
  destination: DestinationType;
  shelfId: number | null;
  brandTier: BrandTier | null;
  condition: ItemCondition | null;
  weightClass: WeightClass | null;
  stockQuantity: number;
}

const DEFAULT_SCAN_SETTINGS: ScanDefaults = {
  destination: 'ebay',
  shelfId: null,
  brandTier: null,
  condition: null,
  weightClass: null,
  stockQuantity: 1,
};

function loadScanDefaults(): ScanDefaults {
  try {
    const stored = localStorage.getItem('scanDefaults');
    if (stored) {
      return { ...DEFAULT_SCAN_SETTINGS, ...JSON.parse(stored) };
    }
  } catch (e) {
    console.error('Failed to load scan defaults:', e);
  }
  return DEFAULT_SCAN_SETTINGS;
}

function saveScanDefaults(defaults: ScanDefaults) {
  try {
    localStorage.setItem('scanDefaults', JSON.stringify(defaults));
  } catch (e) {
    console.error('Failed to save scan defaults:', e);
  }
}

function CompactRoutingScores({ 
  scores, 
  disquals, 
  primaryPlatform 
}: { 
  scores: { whatnot: number; ebay: number; amazon: number };
  disquals: { whatnot: string[]; ebay: string[]; amazon: string[] } | null;
  primaryPlatform: string | null;
}) {
  return (
    <div className="flex gap-0.5 font-mono text-[9px]">
      <span className={`px-1 rounded ${
        disquals?.whatnot?.length ? 'line-through opacity-40' :
        primaryPlatform === 'whatnot' ? 'bg-primary/20 text-primary font-bold' : ''
      }`} title={disquals?.whatnot?.join(', ')}>W:{scores.whatnot}</span>
      <span className={`px-1 rounded ${
        disquals?.ebay?.length ? 'line-through opacity-40' :
        primaryPlatform === 'ebay' ? 'bg-primary/20 text-primary font-bold' : ''
      }`} title={disquals?.ebay?.join(', ')}>E:{scores.ebay}</span>
      <span className={`px-1 rounded ${
        disquals?.amazon?.length ? 'line-through opacity-40' :
        primaryPlatform === 'amazon' ? 'bg-primary/20 text-primary font-bold' : ''
      }`} title={disquals?.amazon?.join(', ')}>A:{scores.amazon}</span>
    </div>
  );
}

function RoutingScoresDisplay({ 
  scores, 
  disquals, 
  primaryPlatform 
}: { 
  scores: { whatnot: number; ebay: number; amazon: number };
  disquals: { whatnot: string[]; ebay: string[]; amazon: string[] } | null;
  primaryPlatform: string | null;
}) {
  return (
    <div className="bg-muted/30 rounded-lg p-2">
      <div className="text-[10px] text-muted-foreground mb-1.5">Routing Scores</div>
      <div className="flex gap-2">
        {(['whatnot', 'ebay', 'amazon'] as const).map((platform) => {
          const score = scores[platform];
          const isDisqualified = disquals && disquals[platform]?.length > 0;
          const isPrimary = primaryPlatform === platform;
          const disqualReasons = isDisqualified ? disquals[platform].join(', ') : '';
          
          return (
            <div 
              key={platform}
              className={`flex-1 text-center p-1.5 rounded ${
                isDisqualified ? 'bg-destructive/10 dark:bg-destructive/20 text-destructive line-through opacity-50' :
                isPrimary ? 'bg-primary/10 dark:bg-primary/20 text-primary font-semibold' : 'bg-background'
              }`}
              title={disqualReasons}
            >
              <div className="text-[10px] uppercase opacity-70">
                {platform === 'whatnot' ? 'W' : platform === 'ebay' ? 'E' : 'A'}
              </div>
              <div className="text-sm font-mono">{score}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

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
  const [expandedItem, setExpandedItem] = useState<number | null>(null);
  const [inventorySearch, setInventorySearch] = useState('');
  const [scanDefaults, setScanDefaults] = useState<ScanDefaults>(loadScanDefaults);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [cameraItemId, setCameraItemId] = useState<string | null>(null);
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const barcodeRef = useRef<SVGSVGElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const scanDefaultsRef = useRef<ScanDefaults>(scanDefaults);
  const { toast } = useToast();
  
  // Keep ref in sync with state for use in mutation callbacks
  useEffect(() => {
    scanDefaultsRef.current = scanDefaults;
  }, [scanDefaults]);
  
  // Update defaults and persist to localStorage
  const updateScanDefaults = (updates: Partial<ScanDefaults>) => {
    setScanDefaults(prev => {
      const updated = { ...prev, ...updates };
      saveScanDefaults(updated);
      return updated;
    });
  };

  // Camera functions
  const openCamera = async (itemId: string) => {
    setCameraItemId(itemId);
    setCameraOpen(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } }
      });
      setCameraStream(stream);
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (err) {
      console.error('Camera access error:', err);
      toast({ title: 'Could not access camera', variant: 'destructive' });
      setCameraOpen(false);
    }
  };

  const closeCamera = () => {
    if (cameraStream) {
      cameraStream.getTracks().forEach(track => track.stop());
      setCameraStream(null);
    }
    setCameraOpen(false);
    setCameraItemId(null);
  };

  const capturePhoto = async () => {
    if (!videoRef.current || !canvasRef.current || !cameraItemId) return;
    
    const video = videoRef.current;
    const canvas = canvasRef.current;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    ctx.drawImage(video, 0, 0);
    
    canvas.toBlob(async (blob) => {
      if (!blob) return;
      const file = new File([blob], `photo-${Date.now()}.jpg`, { type: 'image/jpeg' });
      setEditingItem(cameraItemId);
      closeCamera();
      await uploadFile(file);
    }, 'image/jpeg', 0.9);
  };

  // Cleanup camera on unmount
  useEffect(() => {
    return () => {
      if (cameraStream) {
        cameraStream.getTracks().forEach(track => track.stop());
      }
    };
  }, [cameraStream]);

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
      const scanData: ScanResult = await res.json();
      // Don't fetch routing preview on scan - required fields (brandTier, condition, weightClass) 
      // are not known yet. User must set them, then routing will be calculated.
      return { scanData };
    },
    onSuccess: ({ scanData }) => {
      // Apply scan defaults from sticky settings (use ref to get current values)
      const defaults = scanDefaultsRef.current;
      const newItem: BatchItem = {
        ...scanData,
        customImage: null,
        selectedTags: [],
        id: `${scanData.code}-${Date.now()}`,
        destination: defaults.destination,
        shelfId: defaults.shelfId,
        routing: null, // Will be set when user fills required fields
        brandTier: defaults.brandTier,
        condition: defaults.condition,
        weightClass: defaults.weightClass,
        weightOunces: null,
        stockQuantity: defaults.stockQuantity,
      };
      setBatch(prev => [newItem, ...prev]);
      setCode('');
      
      if (scanData.lookupStatus === "SUCCESS") {
        toast({ title: `Added: ${scanData.title.slice(0, 40)}...` });
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
      const codeData = await res.json();
      // Don't fetch routing preview - required fields must be set by user first
      return { codeData };
    },
    onSuccess: ({ codeData }) => {
      // Apply scan defaults from sticky settings (use ref to get current values)
      const defaults = scanDefaultsRef.current;
      const newItem: BatchItem = {
        code: codeData.code,
        codeType: "UNKNOWN",
        lookupStatus: "NEEDS_ENRICHMENT",
        title: `New Product`,
        image: null,
        brand: null,
        category: null,
        highestPrice: null,
        customImage: null,
        selectedTags: [],
        id: `${codeData.code}-${Date.now()}`,
        destination: defaults.destination,
        shelfId: defaults.shelfId,
        routing: null, // Will be set when user fills required fields
        brandTier: defaults.brandTier,
        condition: defaults.condition,
        weightClass: defaults.weightClass,
        weightOunces: null,
        stockQuantity: defaults.stockQuantity,
      };
      setBatch(prev => [newItem, ...prev]);
      toast({ title: `Generated: ${codeData.code}` });
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

  const updateItemAndRecalculateRouting = async (
    id: string, 
    updates: Partial<Pick<BatchItem, 'brandTier' | 'condition' | 'weightClass'>>
  ) => {
    const item = batch.find(i => i.id === id);
    if (!item) return;

    const updatedItem = { ...item, ...updates };
    
    try {
      const routingRes = await apiRequest('POST', '/api/staff/routing-preview', {
        brandTier: updatedItem.brandTier,
        weightClass: updatedItem.weightClass,
        category: updatedItem.category,
        retailPrice: updatedItem.highestPrice ? Math.round(updatedItem.highestPrice * 100) : null,
        condition: updatedItem.condition,
        weightOunces: updatedItem.weightOunces,
        stockQuantity: updatedItem.stockQuantity,
        upcMatched: updatedItem.lookupStatus === 'SUCCESS'
      });
      
      if (routingRes.ok) {
        const routingData: RoutingResult = await routingRes.json();
        
        let destination: DestinationType = item.destination;
        if (routingData.missingRequiredFields.length === 0 && routingData.primary) {
          if (routingData.primary === 'ebay') destination = 'ebay';
          else if (routingData.primary === 'amazon') destination = 'amazon';
          else destination = 'auction';
        }
        
        setBatch(prev => prev.map(i => 
          i.id === id ? { ...i, ...updates, routing: routingData, destination } : i
        ));
      } else {
        setBatch(prev => prev.map(i => 
          i.id === id ? { ...i, ...updates } : i
        ));
      }
    } catch (e) {
      console.error('Routing recalc failed:', e);
      setBatch(prev => prev.map(i => 
        i.id === id ? { ...i, ...updates } : i
      ));
    }
  };

  const createAuctionMutation = useMutation({
    mutationFn: async (item: BatchItem) => {
      const auctionData = {
        upc: item.code,
        title: item.title,
        description: item.brand ? `Brand: ${item.brand}` : null,
        image: item.customImage || item.image,
        brand: item.brand,
        category: item.category,
        retailPrice: item.highestPrice ? Math.round(item.highestPrice * 100) : null,
        startingBid: 1,
        status: 'draft',
        destination: item.destination,
        shelfId: item.shelfId,
        brandTier: item.brandTier,
        condition: item.condition,
        weightClass: item.weightClass,
        stockQuantity: item.stockQuantity,
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

  const updateRoutingMutation = useMutation({
    mutationFn: async ({ id, condition, weightOunces, stockQuantity, needsReview }: { 
      id: number; 
      condition?: string; 
      weightOunces?: number;
      stockQuantity?: number;
      needsReview?: number;
    }) => {
      const response = await apiRequest('PATCH', `/api/staff/auctions/${id}/routing`, { 
        condition, 
        weightOunces,
        stockQuantity,
        needsReview
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/staff/auctions'] });
      toast({ title: 'Routing updated' });
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
    
    // Note: tier/condition/weight fields are optional for now
    // Items without these fields will default to eBay destination
    
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

          {/* Scan Defaults Panel */}
          <div className="bg-muted/50 rounded-xl p-3 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm font-medium">
                <Settings2 className="w-4 h-4" />
                Scan Defaults
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setScanDefaults(DEFAULT_SCAN_SETTINGS);
                  saveScanDefaults(DEFAULT_SCAN_SETTINGS);
                  toast({ title: 'Defaults reset' });
                }}
                className="h-7 text-xs text-muted-foreground"
                data-testid="button-reset-defaults"
              >
                <RotateCcw className="w-3 h-3 mr-1" />
                Reset
              </Button>
            </div>

            {/* Destination Toggle */}
            <div className="flex gap-1.5">
              <Button
                variant={scanDefaults.destination === 'auction' ? 'default' : 'outline'}
                size="sm"
                className="flex-1 h-9"
                onClick={() => updateScanDefaults({ destination: 'auction' })}
                data-testid="button-default-auction"
              >
                <Gavel className="w-4 h-4 mr-1.5" />
                Auction
              </Button>
              <Button
                variant={scanDefaults.destination === 'ebay' ? 'default' : 'outline'}
                size="sm"
                className="flex-1 h-9"
                onClick={() => updateScanDefaults({ destination: 'ebay' })}
                data-testid="button-default-ebay"
              >
                <SiEbay className="w-4 h-4 mr-1.5" />
                eBay
              </Button>
              <Button
                variant={scanDefaults.destination === 'amazon' ? 'default' : 'outline'}
                size="sm"
                className="flex-1 h-9"
                onClick={() => updateScanDefaults({ destination: 'amazon' })}
                data-testid="button-default-amazon"
              >
                <SiAmazon className="w-4 h-4 mr-1.5" />
                Amazon
              </Button>
            </div>

            {/* Shelf, Quantity, Brand, Condition, Weight */}
            <div className="grid grid-cols-2 gap-2">
              <Select
                value={scanDefaults.shelfId?.toString() || 'none'}
                onValueChange={(val) => updateScanDefaults({ shelfId: val === 'none' ? null : parseInt(val) })}
              >
                <SelectTrigger className="h-9" data-testid="select-default-shelf">
                  <MapPin className="w-3.5 h-3.5 mr-1.5 text-muted-foreground" />
                  <SelectValue placeholder="Shelf" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No shelf</SelectItem>
                  {shelves.map((shelf) => (
                    <SelectItem key={shelf.id} value={shelf.id.toString()}>
                      {shelf.code}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select
                value={scanDefaults.stockQuantity.toString()}
                onValueChange={(val) => updateScanDefaults({ stockQuantity: parseInt(val) })}
              >
                <SelectTrigger className="h-9" data-testid="select-default-quantity">
                  <SelectValue placeholder="Qty" />
                </SelectTrigger>
                <SelectContent>
                  {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((qty) => (
                    <SelectItem key={qty} value={qty.toString()}>
                      Qty: {qty}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select
                value={scanDefaults.brandTier || 'none'}
                onValueChange={(val) => updateScanDefaults({ brandTier: val === 'none' ? null : val as BrandTier })}
              >
                <SelectTrigger className="h-9" data-testid="select-default-brand">
                  <SelectValue placeholder="Brand Tier" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No brand tier</SelectItem>
                  <SelectItem value="A">Tier A (Premium)</SelectItem>
                  <SelectItem value="B">Tier B (Mid)</SelectItem>
                  <SelectItem value="C">Tier C (Budget)</SelectItem>
                </SelectContent>
              </Select>

              <Select
                value={scanDefaults.condition || 'none'}
                onValueChange={(val) => updateScanDefaults({ condition: val === 'none' ? null : val as ItemCondition })}
              >
                <SelectTrigger className="h-9" data-testid="select-default-condition">
                  <SelectValue placeholder="Condition" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No condition</SelectItem>
                  <SelectItem value="new">New</SelectItem>
                  <SelectItem value="like_new">Like New</SelectItem>
                  <SelectItem value="good">Good</SelectItem>
                  <SelectItem value="acceptable">Acceptable</SelectItem>
                  <SelectItem value="parts_damaged">Parts/Damaged</SelectItem>
                </SelectContent>
              </Select>

              <Select
                value={scanDefaults.weightClass || 'none'}
                onValueChange={(val) => updateScanDefaults({ weightClass: val === 'none' ? null : val as WeightClass })}
              >
                <SelectTrigger className="h-9" data-testid="select-default-weight">
                  <Scale className="w-3.5 h-3.5 mr-1.5 text-muted-foreground" />
                  <SelectValue placeholder="Weight" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No weight</SelectItem>
                  <SelectItem value="light">Light (&lt;1lb)</SelectItem>
                  <SelectItem value="medium">Medium (1-5lb)</SelectItem>
                  <SelectItem value="heavy">Heavy (&gt;5lb)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <p className="text-[11px] text-muted-foreground text-center">
              These settings apply automatically to every scan
            </p>
          </div>

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
                              <button
                                type="button"
                                onClick={() => openCamera(item.id)}
                                disabled={isUploading}
                                className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer flex items-center justify-center"
                                data-testid={`button-camera-${item.id}`}
                              >
                                <Camera className="w-6 h-6 text-white" />
                              </button>
                            </>
                          ) : (
                            <button
                              type="button"
                              onClick={() => openCamera(item.id)}
                              disabled={isUploading}
                              className="cursor-pointer w-full h-full flex flex-col items-center justify-center gap-1 hover:bg-muted/80 transition-colors"
                              data-testid={`button-camera-${item.id}`}
                            >
                              <Camera className="w-6 h-6 text-muted-foreground" />
                              <span className="text-xs text-muted-foreground">Take Photo</span>
                            </button>
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
                              {item.lookupStatus === "SUCCESS" ? (
                                <p className="font-medium text-sm leading-tight line-clamp-2">{item.title}</p>
                              ) : (
                                <Input
                                  className="h-7 text-sm font-medium px-2"
                                  value={item.title}
                                  placeholder="Enter product name"
                                  onChange={(e) => {
                                    setBatch(prev => prev.map(b => 
                                      b.id === item.id ? { ...b, title: e.target.value } : b
                                    ));
                                  }}
                                  data-testid={`input-title-${item.id}`}
                                />
                              )}
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
                            
                            <div className="flex items-center gap-2">
                              <div className="flex items-center gap-1">
                                <span className="text-[10px] text-muted-foreground">Qty:</span>
                                <Input
                                  type="number"
                                  min="1"
                                  className="w-14 h-7 text-xs text-center px-1"
                                  value={item.stockQuantity}
                                  onChange={(e) => {
                                    const qty = parseInt(e.target.value) || 1;
                                    setBatch(prev => prev.map(b => 
                                      b.id === item.id ? { ...b, stockQuantity: Math.max(1, qty) } : b
                                    ));
                                  }}
                                  data-testid={`input-qty-${item.id}`}
                                />
                              </div>
                              
                              <Select
                                value={item.shelfId?.toString() || ''}
                                onValueChange={(val) => setItemShelf(item.id, val ? parseInt(val) : null)}
                              >
                                <SelectTrigger 
                                  className={`w-[110px] h-7 text-xs ${!item.shelfId ? 'border-orange-400 text-orange-600' : ''}`}
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
                          </div>
                          
                          <div className="grid grid-cols-3 gap-1 mt-2 pt-2 border-t">
                            <Select
                              value={item.brandTier || ''}
                              onValueChange={(val) => updateItemAndRecalculateRouting(item.id, { brandTier: val as BrandTier })}
                            >
                              <SelectTrigger 
                                className={`h-7 text-[10px] ${!item.brandTier ? 'border-red-400 text-red-600' : ''}`}
                                data-testid={`select-brand-tier-${item.id}`}
                              >
                                <SelectValue placeholder="Tier*" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="A">A - Premium</SelectItem>
                                <SelectItem value="B">B - Name Brand</SelectItem>
                                <SelectItem value="C">C - Private Label</SelectItem>
                              </SelectContent>
                            </Select>
                            
                            <Select
                              value={item.condition || ''}
                              onValueChange={(val) => updateItemAndRecalculateRouting(item.id, { condition: val as ItemCondition })}
                            >
                              <SelectTrigger 
                                className={`h-7 text-[10px] ${!item.condition ? 'border-red-400 text-red-600' : ''}`}
                                data-testid={`select-condition-${item.id}`}
                              >
                                <SelectValue placeholder="Cond*" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="new">New</SelectItem>
                                <SelectItem value="like_new">Like New</SelectItem>
                                <SelectItem value="good">Good</SelectItem>
                                <SelectItem value="acceptable">Acceptable</SelectItem>
                                <SelectItem value="parts_damaged">Parts/Damaged</SelectItem>
                              </SelectContent>
                            </Select>
                            
                            <Select
                              value={item.weightClass || ''}
                              onValueChange={(val) => updateItemAndRecalculateRouting(item.id, { weightClass: val as WeightClass })}
                            >
                              <SelectTrigger 
                                className={`h-7 text-[10px] ${!item.weightClass ? 'border-red-400 text-red-600' : ''}`}
                                data-testid={`select-weight-class-${item.id}`}
                              >
                                <SelectValue placeholder="Weight*" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="light">Light (&lt;5 lbs)</SelectItem>
                                <SelectItem value="medium">Medium (5-14 lbs)</SelectItem>
                                <SelectItem value="heavy">Heavy (15+ lbs)</SelectItem>
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
                          
                          {!item.routing && (
                            <div className="mt-2 pt-2 border-t" data-testid={`routing-pending-${item.id}`}>
                              <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                                <span>Default: eBay (set fields for smart routing)</span>
                              </div>
                            </div>
                          )}
                          
                          {item.routing && item.routing.missingRequiredFields?.length > 0 && (
                            <div className="mt-2 pt-2 border-t" data-testid={`routing-missing-${item.id}`}>
                              <div className="flex items-center gap-1 text-[10px] text-red-600">
                                <AlertTriangle className="w-3 h-3" />
                                <span>Set: {item.routing.missingRequiredFields.join(', ')}</span>
                              </div>
                            </div>
                          )}
                          
                          {item.routing && item.routing.missingRequiredFields?.length === 0 && (
                            <div className="mt-2 pt-2 border-t" data-testid={`routing-preview-${item.id}`}>
                              <div className="flex items-center justify-between gap-2">
                                <span className="text-[10px] text-muted-foreground">Routing:</span>
                                <CompactRoutingScores 
                                  scores={item.routing.scores}
                                  disquals={item.routing.disqualifications}
                                  primaryPlatform={item.routing.primary}
                                />
                              </div>
                              {item.routing.needsReview && (
                                <div className="flex items-center gap-1 mt-1 text-[10px] text-amber-600" data-testid={`routing-review-warning-${item.id}`}>
                                  <AlertTriangle className="w-3 h-3" />
                                  <span>Needs review - close scores</span>
                                </div>
                              )}
                            </div>
                          )}
                          
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
              <div className="flex items-center gap-2">
                <Link href="/inventory">
                  <Button variant="outline" size="sm" data-testid="button-inventory-page">
                    <ExternalLink className="w-4 h-4 mr-1" />
                    Full View
                  </Button>
                </Link>
                <Badge variant="secondary" className="font-mono text-xs">
                  {auctions.length} items
                </Badge>
              </div>
            </div>
            <p className="text-sm text-muted-foreground">All items in your inventory</p>
          </header>

          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search by name, code, or shelf..."
              value={inventorySearch}
              onChange={(e) => setInventorySearch(e.target.value)}
              className="pl-9"
              data-testid="input-inventory-search"
            />
            {inventorySearch && (
              <Button
                variant="ghost"
                size="icon"
                className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7"
                onClick={() => setInventorySearch('')}
              >
                <X className="w-4 h-4" />
              </Button>
            )}
          </div>

          {(() => {
            const searchLower = inventorySearch.toLowerCase().trim();
            const filteredAuctions = searchLower 
              ? auctions.filter(a => 
                  a.title.toLowerCase().includes(searchLower) ||
                  a.internalCode?.toLowerCase().includes(searchLower) ||
                  a.upc?.toLowerCase().includes(searchLower) ||
                  shelves.find(s => s.id === a.shelfId)?.name.toLowerCase().includes(searchLower) ||
                  shelves.find(s => s.id === a.shelfId)?.code.toLowerCase().includes(searchLower)
                )
              : auctions;
            
            return filteredAuctions.length === 0 ? (
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
              {filteredAuctions.map((auction) => {
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
                          {auction.needsReview === 1 && (
                            <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-yellow-500 text-yellow-600 bg-yellow-50">
                              <AlertTriangle className="w-2.5 h-2.5 mr-0.5" />
                              Review
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground flex-wrap">
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
                          {auction.routingScores ? (
                            <CompactRoutingScores 
                              scores={auction.routingScores as { whatnot: number; ebay: number; amazon: number }}
                              disquals={auction.routingDisqualifications as { whatnot: string[]; ebay: string[]; amazon: string[] } | null}
                              primaryPlatform={auction.routingPrimary}
                            />
                          ) : null}
                          {auction.condition && (
                            <span className="text-[10px] capitalize">{auction.condition.replace('_', ' ')}</span>
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
                          className="h-8 w-8"
                          onClick={() => setExpandedItem(expandedItem === auction.id ? null : auction.id)}
                          data-testid={`button-expand-${auction.id}`}
                        >
                          {expandedItem === auction.id ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                        </Button>
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
                    
                    {expandedItem === auction.id && (
                      <div className="mt-3 pt-3 border-t border-border/50 space-y-3">
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="text-[10px] text-muted-foreground block mb-1">Condition</label>
                            <Select
                              value={auction.condition || ''}
                              onValueChange={(value) => updateRoutingMutation.mutate({ id: auction.id, condition: value })}
                            >
                              <SelectTrigger className="h-8 text-xs" data-testid={`select-condition-${auction.id}`}>
                                <SelectValue placeholder="Select condition" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="new">New</SelectItem>
                                <SelectItem value="like_new">Like New</SelectItem>
                                <SelectItem value="good">Good</SelectItem>
                                <SelectItem value="acceptable">Acceptable</SelectItem>
                                <SelectItem value="parts_damaged">Parts/Damaged</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <div>
                            <label className="text-[10px] text-muted-foreground block mb-1">Weight (lbs)</label>
                            <Input
                              type="number"
                              step="0.1"
                              className="h-8 text-xs"
                              placeholder="Optional"
                              defaultValue={auction.weightOunces ? (auction.weightOunces / 16).toFixed(1) : ''}
                              onBlur={(e) => {
                                const lbs = parseFloat(e.target.value);
                                if (!isNaN(lbs) && lbs > 0) {
                                  updateRoutingMutation.mutate({ id: auction.id, weightOunces: Math.round(lbs * 16) });
                                }
                              }}
                              data-testid={`input-weight-${auction.id}`}
                            />
                          </div>
                        </div>
                        
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="text-[10px] text-muted-foreground block mb-1">Stock Qty</label>
                            <Input
                              type="number"
                              min="1"
                              className="h-8 text-xs"
                              defaultValue={auction.stockQuantity || 1}
                              onBlur={(e) => {
                                const qty = parseInt(e.target.value);
                                if (!isNaN(qty) && qty >= 1) {
                                  updateRoutingMutation.mutate({ id: auction.id, stockQuantity: qty });
                                }
                              }}
                              data-testid={`input-quantity-${auction.id}`}
                            />
                          </div>
                          <div className="flex items-end">
                            <Button
                              variant={auction.needsReview === 1 ? "default" : "outline"}
                              size="sm"
                              className="w-full"
                              onClick={() => updateRoutingMutation.mutate({ 
                                id: auction.id, 
                                needsReview: auction.needsReview === 1 ? 0 : 1 
                              })}
                              data-testid={`button-flag-review-${auction.id}`}
                            >
                              <Flag className="w-3 h-3 mr-1" />
                              {auction.needsReview === 1 ? 'Flagged' : 'Flag Review'}
                            </Button>
                          </div>
                        </div>

                        {auction.routingScores ? (
                          <RoutingScoresDisplay 
                            scores={auction.routingScores as { whatnot: number; ebay: number; amazon: number }}
                            disquals={auction.routingDisqualifications as { whatnot: string[]; ebay: string[]; amazon: string[] } | null}
                            primaryPlatform={auction.routingPrimary}
                          />
                        ) : null}

                        {auction.brand && (
                          <div className="text-[10px] text-muted-foreground">
                            Brand: <span className="text-foreground">{auction.brand}</span>
                            {auction.category && <span className="ml-2">Category: <span className="text-foreground">{auction.category}</span></span>}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
            );
          })()}
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

          <Card>
            <CardContent className="p-3">
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <ScanLine className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    placeholder="Scan shelf barcode (OASXX)..."
                    className="pl-9"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        const input = e.currentTarget.value.trim().toUpperCase();
                        const shelf = shelves.find(s => s.code === input);
                        if (shelf) {
                          setSelectedShelf(shelf.id);
                          e.currentTarget.value = '';
                        } else {
                          toast({ title: 'Shelf not found', variant: 'destructive' });
                        }
                      }
                    }}
                    data-testid="input-shelf-barcode"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {selectedShelf === null ? (
            <>
              <div className="grid grid-cols-4 gap-2">
                {shelves.map((shelf) => {
                  const itemsOnShelf = auctions.filter(a => a.shelfId === shelf.id);
                  const hasItems = itemsOnShelf.length > 0;
                  return (
                    <button
                      key={shelf.id}
                      onClick={() => setSelectedShelf(shelf.id)}
                      className={`p-3 rounded-xl border-2 bg-card hover-elevate text-center transition-all ${
                        hasItems 
                          ? 'border-green-500 dark:border-green-400' 
                          : 'border-border'
                      }`}
                      data-testid={`button-shelf-${shelf.id}`}
                    >
                      <div className="font-mono font-bold text-lg">{shelf.code}</div>
                      <div className={`text-xs mt-1 ${hasItems ? 'text-green-600 dark:text-green-400 font-medium' : 'text-muted-foreground'}`}>
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
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    const shelf = shelves.find(s => s.id === selectedShelf);
                    if (shelf) {
                      handlePrintBarcode(shelf.code);
                    }
                  }}
                  data-testid="button-print-shelf-barcode"
                >
                  <Printer className="w-4 h-4 mr-1" />
                  Print Label
                </Button>
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

      <Dialog open={cameraOpen} onOpenChange={(open) => !open && closeCamera()}>
        <DialogContent className="sm:max-w-md p-0 overflow-hidden">
          <DialogHeader className="p-4 pb-0">
            <DialogTitle>Take Photo</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col items-center">
            <div className="relative w-full aspect-[4/3] bg-black">
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="w-full h-full object-cover"
                data-testid="camera-video"
              />
              <canvas ref={canvasRef} className="hidden" />
            </div>
            <div className="flex gap-3 p-4 w-full">
              <Button
                onClick={capturePhoto}
                className="flex-1"
                disabled={!cameraStream || isUploading}
                data-testid="button-capture"
              >
                <Camera className="w-4 h-4 mr-2" />
                {isUploading ? 'Uploading...' : 'Capture'}
              </Button>
              <Button variant="outline" onClick={closeCamera} className="flex-1">
                Cancel
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

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
