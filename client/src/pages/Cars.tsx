import { useMemo, useState } from "react";
import { Link } from "wouter";
import { ArrowLeft, Car, Download, Plus, Wrench } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";

type PartCategory = "exterior" | "mechanical" | "missing";
type PhotoSource = "manual" | "stock";

interface VehicleRecord {
  vin: string;
  year: string;
  make: string;
  model: string;
  trim: string;
}

interface PartTemplate {
  id: string;
  name: string;
  category: PartCategory;
  stockPhotoUrl?: string;
}

interface ListingDraft {
  id: string;
  vin: string;
  partName: string;
  partCategory: PartCategory;
  title: string;
  photoSource: PhotoSource;
  stockPhotoUrl?: string;
}

const PART_LIBRARY: PartTemplate[] = [
  { id: "front_bumper", name: "Front Bumper", category: "exterior" },
  { id: "rear_bumper", name: "Rear Bumper", category: "exterior" },
  { id: "driver_door", name: "Driver Door", category: "exterior" },
  { id: "passenger_door", name: "Passenger Door", category: "exterior" },
  { id: "hood", name: "Hood", category: "exterior" },
  { id: "engine", name: "Engine Assembly", category: "mechanical" },
  { id: "transmission", name: "Transmission", category: "mechanical" },
  { id: "alternator", name: "Alternator", category: "mechanical" },
  { id: "starter", name: "Starter", category: "mechanical" },
  { id: "ecu", name: "ECU", category: "mechanical" },
  { id: "radio_missing", name: "Radio Missing", category: "missing" },
  { id: "mirror_missing", name: "Mirror Missing", category: "missing" },
];

const STOCK_PARTS_KEY = "carsStockParts";
const DRAFTS_KEY = "carsListingDrafts";

function loadStockParts(): PartTemplate[] {
  try {
    const raw = localStorage.getItem(STOCK_PARTS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveStockParts(parts: PartTemplate[]) {
  localStorage.setItem(STOCK_PARTS_KEY, JSON.stringify(parts));
}

function loadDrafts(): ListingDraft[] {
  try {
    const raw = localStorage.getItem(DRAFTS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveDrafts(drafts: ListingDraft[]) {
  localStorage.setItem(DRAFTS_KEY, JSON.stringify(drafts));
}

function normalizeVin(vin: string): string {
  return vin.toUpperCase().replace(/[^A-HJ-NPR-Z0-9]/g, "");
}

function buildTitle(vehicle: VehicleRecord, partName: string): string {
  const base = [vehicle.year, vehicle.make, vehicle.model, vehicle.trim].filter(Boolean).join(" ");
  return `${base} ${partName}`.trim();
}

function csvEscape(value: string): string {
  const escaped = value.replace(/"/g, '""');
  return `"${escaped}"`;
}

export default function Cars() {
  const { toast } = useToast();
  const [vehicle, setVehicle] = useState<VehicleRecord>({
    vin: "",
    year: "",
    make: "",
    model: "",
    trim: "",
  });
  const [selectedPartIds, setSelectedPartIds] = useState<string[]>([]);
  const [stockParts, setStockParts] = useState<PartTemplate[]>(() => loadStockParts());
  const [drafts, setDrafts] = useState<ListingDraft[]>(() => loadDrafts());
  const [newPartName, setNewPartName] = useState("");
  const [newStockPhotoUrl, setNewStockPhotoUrl] = useState("");
  const [notes, setNotes] = useState("");

  const partCatalog = useMemo(() => [...PART_LIBRARY, ...stockParts], [stockParts]);
  const selectedParts = useMemo(
    () => partCatalog.filter((part) => selectedPartIds.includes(part.id)),
    [partCatalog, selectedPartIds],
  );

  const togglePart = (partId: string) => {
    setSelectedPartIds((prev) => (prev.includes(partId) ? prev.filter((id) => id !== partId) : [...prev, partId]));
  };

  const createVehicleRecord = () => {
    const normalized = normalizeVin(vehicle.vin);
    if (normalized.length < 11) {
      toast({ title: "Invalid VIN", description: "VIN must be at least 11 characters.", variant: "destructive" });
      return;
    }
    setVehicle((prev) => ({ ...prev, vin: normalized }));
    toast({ title: "Vehicle record ready", description: `${normalized} saved for draft generation.` });
  };

  const addStockPart = () => {
    const name = newPartName.trim();
    const photo = newStockPhotoUrl.trim();
    if (!name || !photo) {
      toast({ title: "Missing data", description: "Part name and stock photo URL are required.", variant: "destructive" });
      return;
    }

    const part: PartTemplate = {
      id: `stock_${Date.now()}`,
      name,
      category: "mechanical",
      stockPhotoUrl: photo,
    };
    const next = [...stockParts, part];
    setStockParts(next);
    saveStockParts(next);
    setNewPartName("");
    setNewStockPhotoUrl("");
    toast({ title: "Stock part added", description: `${name} can now auto-use stock photos.` });
  };

  const generateDrafts = () => {
    if (!vehicle.vin) {
      toast({ title: "Create vehicle first", description: "Scan/enter VIN and create vehicle record first.", variant: "destructive" });
      return;
    }
    if (selectedParts.length === 0) {
      toast({ title: "No parts selected", description: "Select at least one part to generate drafts.", variant: "destructive" });
      return;
    }

    const generated: ListingDraft[] = selectedParts.map((part) => {
      const isMechanical = part.category === "mechanical";
      const hasStock = isMechanical && !!part.stockPhotoUrl;
      return {
        id: `${vehicle.vin}_${part.id}_${Date.now()}`,
        vin: vehicle.vin,
        partName: part.name,
        partCategory: part.category,
        title: buildTitle(vehicle, part.name),
        photoSource: hasStock ? "stock" : "manual",
        stockPhotoUrl: hasStock ? part.stockPhotoUrl : undefined,
      };
    });

    const nextDrafts = [...generated, ...drafts];
    setDrafts(nextDrafts);
    saveDrafts(nextDrafts);
    toast({ title: "Drafts generated", description: `${generated.length} listing draft(s) created.` });
  };

  const exportCsv = () => {
    if (drafts.length === 0) {
      toast({ title: "No drafts to export", description: "Generate drafts first.", variant: "destructive" });
      return;
    }
    const header = ["VIN", "Title", "Part", "Category", "PhotoSource", "StockPhotoUrl", "Notes"];
    const rows = drafts.map((d) => [
      d.vin,
      d.title,
      d.partName,
      d.partCategory,
      d.photoSource,
      d.stockPhotoUrl || "",
      notes,
    ]);
    const csv = [header, ...rows].map((r) => r.map(csvEscape).join(",")).join("\n");

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `cars-drafts-${Date.now()}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <main className="min-h-screen bg-muted/20 pb-24">
      <div className="mx-auto w-full max-w-5xl space-y-4 p-4">
        <header className="rounded-2xl border bg-card p-4 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h1 className="text-2xl font-semibold tracking-tight">Cars</h1>
              <p className="text-sm text-muted-foreground">Vehicle to Parts to Listings workflow</p>
            </div>
            <Link href="/staff">
              <Button variant="outline" size="sm" data-testid="button-back-to-staff">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back to Staff
              </Button>
            </Link>
          </div>
        </header>

        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Car className="h-5 w-5" />
                1) Scan VIN & Create Vehicle
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Input
                value={vehicle.vin}
                onChange={(e) => setVehicle((v) => ({ ...v, vin: e.target.value }))}
                placeholder="VIN"
                data-testid="input-car-vin"
              />
              <div className="grid grid-cols-2 gap-2">
                <Input value={vehicle.year} onChange={(e) => setVehicle((v) => ({ ...v, year: e.target.value }))} placeholder="Year" />
                <Input value={vehicle.make} onChange={(e) => setVehicle((v) => ({ ...v, make: e.target.value }))} placeholder="Make" />
                <Input value={vehicle.model} onChange={(e) => setVehicle((v) => ({ ...v, model: e.target.value }))} placeholder="Model" />
                <Input value={vehicle.trim} onChange={(e) => setVehicle((v) => ({ ...v, trim: e.target.value }))} placeholder="Trim" />
              </div>
              <Button onClick={createVehicleRecord} className="w-full" data-testid="button-create-vehicle">
                Create vehicle record
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Wrench className="h-5 w-5" />
                Mechanical Stock Library
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Input
                value={newPartName}
                onChange={(e) => setNewPartName(e.target.value)}
                placeholder="Part identifier (ex: ABS Module)"
                data-testid="input-stock-part-name"
              />
              <Input
                value={newStockPhotoUrl}
                onChange={(e) => setNewStockPhotoUrl(e.target.value)}
                placeholder="Stock photo URL"
                data-testid="input-stock-part-photo"
              />
              <Button onClick={addStockPart} className="w-full" data-testid="button-add-stock-part">
                <Plus className="mr-2 h-4 w-4" />
                Add mechanical stock part
              </Button>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>2) Select Parts Present (Multi-Select)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {partCatalog.map((part) => {
                const selected = selectedPartIds.includes(part.id);
                return (
                  <button
                    key={part.id}
                    type="button"
                    onClick={() => togglePart(part.id)}
                    className={`rounded-full border px-3 py-1.5 text-sm transition-colors ${
                      selected ? "border-primary bg-primary/10 text-primary" : "border-border bg-background text-foreground"
                    }`}
                    data-testid={`part-chip-${part.id}`}
                  >
                    {part.name}
                  </button>
                );
              })}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>3-8) Generate Records, Save Drafts, CSV Upload Prep</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap gap-2">
              <Button onClick={generateDrafts} data-testid="button-generate-car-drafts">
                Generate part records
              </Button>
              <Button variant="outline" onClick={exportCsv} data-testid="button-export-car-csv">
                <Download className="mr-2 h-4 w-4" />
                Export CSV
              </Button>
            </div>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Optional notes for CSV upload"
              data-testid="textarea-cars-notes"
            />

            <div className="space-y-2">
              <h3 className="text-sm font-medium">Drafts</h3>
              {drafts.length === 0 ? (
                <p className="text-sm text-muted-foreground">No drafts yet.</p>
              ) : (
                <div className="space-y-2">
                  {drafts.map((d) => (
                    <div key={d.id} className="rounded-lg border bg-card p-3">
                      <p className="font-medium">{d.title}</p>
                      <div className="mt-1 flex flex-wrap gap-2 text-xs">
                        <Badge variant="secondary">{d.vin}</Badge>
                        <Badge variant="outline">{d.partCategory}</Badge>
                        <Badge variant={d.photoSource === "stock" ? "default" : "secondary"}>
                          photo: {d.photoSource}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
