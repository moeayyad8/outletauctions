import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Package, Trash2, DollarSign, ShoppingCart, Pencil } from "lucide-react";

interface ScannedItem {
  code: string;
  title: string;
  brand: string | null;
  image: string | null;
  retailPrice: number | null;
  scannedAt: Date;
}

export default function RetailValueFinder() {
  const [code, setCode] = useState("");
  const [currentItem, setCurrentItem] = useState<ScannedItem | null>(null);
  const [boxItems, setBoxItems] = useState<ScannedItem[]>([]);
  const [showPriceDialog, setShowPriceDialog] = useState(false);
  const [editingPrice, setEditingPrice] = useState("");
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const { toast } = useToast();

  const handleAdjustPrice = (index: number | null) => {
    if (index === null && currentItem) {
      setEditingPrice(currentItem.retailPrice ? (currentItem.retailPrice / 100).toFixed(2) : "");
    } else if (index !== null && boxItems[index]) {
      setEditingPrice(boxItems[index].retailPrice ? (boxItems[index].retailPrice / 100).toFixed(2) : "");
    }
    setEditingIndex(index);
    setShowPriceDialog(true);
  };

  const handleSavePrice = () => {
    const newPrice = parseFloat(editingPrice);
    if (isNaN(newPrice) || newPrice < 0) {
      toast({ title: "Please enter a valid price", variant: "destructive" });
      return;
    }
    
    const priceInCents = Math.round(newPrice * 100);
    
    if (editingIndex === null && currentItem) {
      setCurrentItem({ ...currentItem, retailPrice: priceInCents });
    } else if (editingIndex !== null) {
      setBoxItems(prev => prev.map((item, i) => 
        i === editingIndex ? { ...item, retailPrice: priceInCents } : item
      ));
    }
    
    setShowPriceDialog(false);
    toast({ title: "Price updated!" });
  };

  const scanMutation = useMutation({
    mutationFn: async (scanCode: string) => {
      const response = await apiRequest("POST", "/api/scan", { code: scanCode });
      return response.json();
    },
    onSuccess: (data) => {
      if (currentItem) {
        setBoxItems(prev => [currentItem, ...prev]);
      }
      
      const newItem: ScannedItem = {
        code: data.code,
        title: data.title || "Unknown Item",
        brand: data.brand,
        image: data.image,
        retailPrice: data.highestPrice ? Math.round(data.highestPrice * 100) : null,
        scannedAt: new Date(),
      };
      
      setCurrentItem(newItem);
      setCode("");
    },
    onError: () => {
      toast({ title: "Failed to scan item", variant: "destructive" });
    },
  });

  const handleScan = () => {
    if (code.trim()) {
      scanMutation.mutate(code.trim());
    }
  };

  const handleClearBox = () => {
    setCurrentItem(null);
    setBoxItems([]);
    toast({ title: "Box cleared!" });
  };

  const allItems = currentItem ? [currentItem, ...boxItems] : boxItems;
  const totalRetail = allItems.reduce((sum, item) => sum + (item.retailPrice || 0), 0);
  const itemCount = allItems.length;

  return (
    <div className="min-h-screen bg-gradient-to-br from-background to-muted/30 p-4">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-bold tracking-tight">Retail Value Finder</h1>
          <p className="text-muted-foreground">Scan items to build your mystery box</p>
        </div>

        <div className="flex gap-2">
          <Input
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="Scan UPC/EAN..."
            onKeyDown={(e) => e.key === "Enter" && handleScan()}
            className="text-lg h-12"
            autoFocus
            data-testid="input-scan-code"
          />
          <Button 
            onClick={handleScan} 
            disabled={scanMutation.isPending}
            className="h-12 px-6"
            data-testid="button-scan"
          >
            {scanMutation.isPending ? "Scanning..." : "Scan"}
          </Button>
        </div>

        {currentItem && (
          <Card className="border-2 border-primary bg-gradient-to-br from-primary/5 to-primary/10 overflow-visible">
            <CardContent className="p-6">
              <div className="flex gap-6">
                <div className="w-48 h-48 rounded-xl bg-white flex items-center justify-center shrink-0 shadow-lg">
                  {currentItem.image ? (
                    <img 
                      src={currentItem.image} 
                      alt={currentItem.title}
                      className="w-full h-full object-contain rounded-xl"
                    />
                  ) : (
                    <Package className="w-16 h-16 text-muted-foreground" />
                  )}
                </div>
                <div className="flex-1 space-y-3">
                  <div>
                    <p className="text-sm text-muted-foreground uppercase tracking-wide">Just Scanned</p>
                    <h2 className="text-2xl font-bold leading-tight line-clamp-2">{currentItem.title}</h2>
                    {currentItem.brand && (
                      <p className="text-muted-foreground">{currentItem.brand}</p>
                    )}
                  </div>
                  <div className="pt-2">
                    <p className="text-sm text-muted-foreground">Retail Value</p>
                    <div className="flex items-center gap-2">
                      <p className="text-4xl font-bold text-primary">
                        {currentItem.retailPrice 
                          ? `$${(currentItem.retailPrice / 100).toFixed(2)}`
                          : "N/A"
                        }
                      </p>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleAdjustPrice(null)}
                        data-testid="button-adjust-current-price"
                      >
                        <Pencil className="w-3 h-3 mr-1" />
                        Adjust
                      </Button>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground font-mono">{currentItem.code}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        <div className="grid grid-cols-2 gap-4">
          <Card className="bg-gradient-to-br from-green-500/10 to-green-600/10 border-green-500/30">
            <CardContent className="p-6 text-center">
              <DollarSign className="w-8 h-8 mx-auto mb-2 text-green-600" />
              <p className="text-sm text-muted-foreground">Total Retail Value</p>
              <p className="text-4xl font-bold text-green-600" data-testid="text-total-value">
                ${(totalRetail / 100).toFixed(2)}
              </p>
            </CardContent>
          </Card>
          <Card className="bg-gradient-to-br from-blue-500/10 to-blue-600/10 border-blue-500/30">
            <CardContent className="p-6 text-center">
              <ShoppingCart className="w-8 h-8 mx-auto mb-2 text-blue-600" />
              <p className="text-sm text-muted-foreground">Items in Box</p>
              <p className="text-4xl font-bold text-blue-600" data-testid="text-item-count">
                {itemCount}
              </p>
            </CardContent>
          </Card>
        </div>

        {boxItems.length > 0 && (
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold text-lg">Previous Items</h3>
                <span className="text-sm text-muted-foreground">{boxItems.length} items</span>
              </div>
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {boxItems.map((item, index) => (
                  <div 
                    key={`${item.code}-${index}`}
                    className="flex items-center gap-3 p-2 rounded-lg bg-muted/50"
                  >
                    <div className="w-12 h-12 rounded bg-white flex items-center justify-center shrink-0">
                      {item.image ? (
                        <img 
                          src={item.image} 
                          alt={item.title}
                          className="w-full h-full object-contain rounded"
                        />
                      ) : (
                        <Package className="w-6 h-6 text-muted-foreground" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate text-sm">{item.title}</p>
                      <p className="text-xs text-muted-foreground font-mono">{item.code}</p>
                    </div>
                    <p className="font-bold text-green-600 shrink-0">
                      {item.retailPrice 
                        ? `$${(item.retailPrice / 100).toFixed(2)}`
                        : "N/A"
                      }
                    </p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        <Button 
          variant="destructive" 
          size="lg"
          onClick={handleClearBox}
          className="w-full h-14 text-lg"
          disabled={itemCount === 0}
          data-testid="button-clear-box"
        >
          <Trash2 className="w-5 h-5 mr-2" />
          Clear Box - Start New Bundle
        </Button>
      </div>

      <Dialog open={showPriceDialog} onOpenChange={setShowPriceDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Adjust Retail Value</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <span className="text-2xl">$</span>
              <Input
                type="number"
                step="0.01"
                min="0"
                value={editingPrice}
                onChange={(e) => setEditingPrice(e.target.value)}
                placeholder="0.00"
                className="text-2xl h-14"
                autoFocus
                onKeyDown={(e) => e.key === "Enter" && handleSavePrice()}
                data-testid="input-adjust-price"
              />
            </div>
            <div className="flex gap-2">
              <Button onClick={handleSavePrice} className="flex-1" data-testid="button-save-price">
                Save
              </Button>
              <Button variant="outline" onClick={() => setShowPriceDialog(false)} className="flex-1">
                Cancel
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
