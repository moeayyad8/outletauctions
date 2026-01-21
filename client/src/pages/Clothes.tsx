import { useState, useRef, useEffect, useCallback } from 'react';
import { Link } from 'wouter';
import { useMutation, useQuery } from '@tanstack/react-query';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { useUpload } from '@/hooks/use-upload';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Package, Camera, X, Plus, Trash2, ScanLine, Download, ArrowLeft, ImagePlus, LogIn, LogOut, Shirt, RotateCw, FlipHorizontal2, ZoomIn, Crop, User, LayoutDashboard } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import type { ClothesItem, Shelf } from '@shared/schema';

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

const DEPOP_CATEGORIES = [
  "Tops", "Bottoms", "Dresses", "Outerwear", "Activewear", 
  "Intimates", "Swimwear", "Accessories", "Shoes", "Bags",
  "Jewelry", "Vintage", "Handmade", "Other"
];

const DEPOP_CONDITIONS = [
  "Brand New", "Like New", "Used - Excellent", "Used - Good", "Used - Fair"
];

const DEPOP_SIZES = [
  "XXS", "XS", "S", "M", "L", "XL", "XXL", "XXXL",
  "One Size", "0", "2", "4", "6", "8", "10", "12", "14", "16"
];

const DEPOP_COLORS = [
  "Black", "White", "Gray", "Red", "Pink", "Orange", "Yellow", 
  "Green", "Blue", "Purple", "Brown", "Cream", "Gold", "Silver", "Multi"
];

const STAFF_PASSWORD = '4406';

function getStaffAuthState(): { authenticated: boolean } {
  try {
    const stored = localStorage.getItem('staffAuth');
    if (stored) {
      return JSON.parse(stored);
    }
  } catch (e) {
    console.error('Failed to load staff auth state:', e);
  }
  return { authenticated: false };
}

function saveStaffAuthState(state: { authenticated: boolean }) {
  try {
    localStorage.setItem('staffAuth', JSON.stringify(state));
  } catch (e) {
    console.error('Failed to save staff auth state:', e);
  }
}

interface LoggedInStaffData {
  id: number;
  name: string;
  shiftId: number;
}

export default function Clothes() {
  const [isAuthenticated, setIsAuthenticated] = useState(() => getStaffAuthState().authenticated);
  const [passwordInput, setPasswordInput] = useState('');
  const [loginError, setLoginError] = useState('');
  
  // Staff login for tracking
  const [loggedInStaff, setLoggedInStaff] = useState<LoggedInStaffData | null>(() => {
    try {
      const stored = localStorage.getItem('loggedInStaff');
      return stored ? JSON.parse(stored) : null;
    } catch { return null; }
  });
  const [showStaffLoginDialog, setShowStaffLoginDialog] = useState(false);
  const [staffPinInput, setStaffPinInput] = useState('');
  
  const [scanInput, setScanInput] = useState('');
  const [isScanning, setIsScanning] = useState(false);
  const [scanResult, setScanResult] = useState<ScanResult | null>(null);
  
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('');
  const [price, setPrice] = useState('');
  const [brand, setBrand] = useState('');
  const [condition, setCondition] = useState('Brand New');
  const [size, setSize] = useState('');
  const [color1, setColor1] = useState('');
  const [color2, setColor2] = useState('');
  const [source1, setSource1] = useState('Target');
  const [source2, setSource2] = useState('');
  const [age, setAge] = useState('');
  const [style1, setStyle1] = useState('');
  const [style2, setStyle2] = useState('');
  const [style3, setStyle3] = useState('');
  const [location, setLocation] = useState('');
  const [domesticShipping, setDomesticShipping] = useState('');
  const [internationalShipping, setInternationalShipping] = useState('');
  const [shelfId, setShelfId] = useState<number | null>(null);
  
  const [photos, setPhotos] = useState<string[]>([]);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [activePhotoIndex, setActivePhotoIndex] = useState(0);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  
  const [zoomLevel, setZoomLevel] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [previewRotation, setPreviewRotation] = useState(0);
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [maxZoom, setMaxZoom] = useState(1);
  const [cropMode, setCropMode] = useState(false);
  const [cropArea, setCropArea] = useState({ x: 10, y: 10, width: 80, height: 80 });
  const cropContainerRef = useRef<HTMLDivElement>(null);
  const previewImgRef = useRef<HTMLImageElement>(null);
  
  const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null);
  
  const { toast } = useToast();
  const { uploadFile, isUploading } = useUpload();
  
  const scanInputRef = useRef<HTMLInputElement>(null);
  
  const { data: clothesItems = [], isLoading: itemsLoading } = useQuery<ClothesItem[]>({
    queryKey: ['/api/clothes'],
  });
  
  const { data: shelves = [] } = useQuery<Shelf[]>({
    queryKey: ['/api/shelves'],
  });
  
  const scanMutation = useMutation({
    mutationFn: async (code: string) => {
      const res = await apiRequest('POST', '/api/scan', { code });
      return res.json() as Promise<ScanResult>;
    },
    onSuccess: (result) => {
      setScanResult(result);
      if (result.lookupStatus === 'SUCCESS') {
        setDescription(result.title || '');
        setBrand(result.brand || '');
        if (result.highestPrice) {
          setPrice((result.highestPrice).toFixed(2));
        }
      }
      toast({
        title: result.lookupStatus === 'SUCCESS' ? 'Product Found' : 'Manual Entry Required',
        description: result.title,
      });
      
      if (!cameraOpen && photos.length === 0) {
        setTimeout(() => {
          openCamera(0);
        }, 300);
      }
    },
    onError: () => {
      toast({ title: 'Scan failed', variant: 'destructive' });
    },
  });
  
  // Staff login mutation
  const staffLoginMutation = useMutation({
    mutationFn: async (pin: string) => {
      const response = await apiRequest('POST', '/api/staff/login', { pin });
      return response.json();
    },
    onSuccess: (data) => {
      const staffData = { id: data.staff.id, name: data.staff.name, shiftId: data.shift.id };
      setLoggedInStaff(staffData);
      localStorage.setItem('loggedInStaff', JSON.stringify(staffData));
      setShowStaffLoginDialog(false);
      setStaffPinInput('');
      toast({ title: `Welcome, ${data.staff.name}!`, description: 'Shift started. Your scans are being tracked.' });
    },
    onError: () => {
      toast({ title: 'Invalid PIN', variant: 'destructive' });
      setStaffPinInput('');
    }
  });

  const handleStaffLogout = async () => {
    if (loggedInStaff?.shiftId) {
      try {
        await apiRequest('POST', `/api/shifts/${loggedInStaff.shiftId}/clockout`, {});
        toast({ title: 'Clocked out', description: 'Your shift has ended.' });
      } catch (e) {
        console.error('Clock out failed:', e);
      }
    }
    setLoggedInStaff(null);
    localStorage.removeItem('loggedInStaff');
  };

  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      // Include staff ID for tracking
      const enrichedData = {
        ...data,
        scannedByStaffId: loggedInStaff?.id || null,
      };
      const res = await apiRequest('POST', '/api/clothes', enrichedData);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/clothes'] });
      resetForm();
      toast({ title: 'Item added successfully' });
    },
    onError: () => {
      toast({ title: 'Failed to add item', variant: 'destructive' });
    },
  });
  
  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest('DELETE', `/api/clothes/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/clothes'] });
      toast({ title: 'Item deleted' });
    },
    onError: () => {
      toast({ title: 'Failed to delete item', variant: 'destructive' });
    },
  });
  
  const resetForm = () => {
    setScanInput('');
    setScanResult(null);
    setDescription('');
    setCategory('');
    setPrice('');
    setBrand('');
    setCondition('Brand New');
    setSize('');
    setColor1('');
    setColor2('');
    setSource1('Target');
    setSource2('');
    setAge('');
    setStyle1('');
    setStyle2('');
    setStyle3('');
    setLocation('');
    setDomesticShipping('');
    setInternationalShipping('');
    setPhotos([]);
    setShelfId(null);
    scanInputRef.current?.focus();
  };
  
  const handleScan = () => {
    if (!scanInput.trim()) return;
    setIsScanning(true);
    scanMutation.mutate(scanInput.trim());
    setIsScanning(false);
  };
  
  const handleSubmit = () => {
    if (!description.trim()) {
      toast({ title: 'Description is required', variant: 'destructive' });
      return;
    }
    
    if (photos.length === 0) {
      toast({ title: 'At least one photo is required', variant: 'destructive' });
      return;
    }
    
    createMutation.mutate({
      upc: scanInput.trim() || null,
      description,
      category: category || null,
      price: price ? Math.round(parseFloat(price) * 100) : null,
      brand: brand || null,
      condition,
      size: size || null,
      color1: color1 || null,
      color2: color2 || null,
      source1,
      source2: source2 || null,
      age: age || null,
      style1: style1 || null,
      style2: style2 || null,
      style3: style3 || null,
      location: location || null,
      pictureHero: photos[0] || null,
      picture2: photos[1] || null,
      picture3: photos[2] || null,
      picture4: photos[3] || null,
      picture5: photos[4] || null,
      picture6: photos[5] || null,
      picture7: photos[6] || null,
      picture8: photos[7] || null,
      domesticShipping: domesticShipping ? Math.round(parseFloat(domesticShipping) * 100) : null,
      internationalShipping: internationalShipping ? Math.round(parseFloat(internationalShipping) * 100) : null,
      shelfId,
    });
  };
  
  const openCamera = (photoIndex: number) => {
    setActivePhotoIndex(photoIndex);
    setZoomLevel(1);
    setRotation(0);
    setPreviewRotation(0);
    setCapturedImage(null);
    setCropMode(false);
    setCropArea({ x: 10, y: 10, width: 80, height: 80 });
    setCameraOpen(true);
  };
  
  const startCamera = useCallback(async () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    
    try {
      console.log('Requesting camera access...');
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { 
          facingMode: facingMode, 
          width: { ideal: 1920 }, 
          height: { ideal: 1080 } 
        } 
      });
      console.log('Camera access granted, stream:', stream);
      streamRef.current = stream;
      
      const videoTrack = stream.getVideoTracks()[0];
      if (videoTrack) {
        const capabilities = videoTrack.getCapabilities?.();
        if (capabilities && 'zoom' in capabilities) {
          const zoomCaps = capabilities as any;
          setMaxZoom(zoomCaps.zoom?.max || 1);
        } else {
          setMaxZoom(4);
        }
      }
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (err) {
      console.error('Camera error:', err);
      toast({ title: 'Camera access denied', variant: 'destructive' });
      setCameraOpen(false);
    }
  }, [facingMode, toast]);
  
  useEffect(() => {
    if (cameraOpen && !capturedImage) {
      const timer = setTimeout(() => {
        if (videoRef.current) {
          startCamera();
        }
      }, 100);
      return () => clearTimeout(timer);
    } else if (!cameraOpen) {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
        streamRef.current = null;
      }
    }
  }, [cameraOpen, facingMode, capturedImage, startCamera]);
  
  useEffect(() => {
    if (streamRef.current && zoomLevel > 1) {
      const videoTrack = streamRef.current.getVideoTracks()[0];
      if (videoTrack) {
        const capabilities = videoTrack.getCapabilities?.();
        if (capabilities && 'zoom' in capabilities) {
          try {
            videoTrack.applyConstraints({ advanced: [{ zoom: zoomLevel } as any] });
          } catch (e) {
            console.log('Zoom not supported on this device');
          }
        }
      }
    }
  }, [zoomLevel]);
  
  const capturePreview = () => {
    if (!videoRef.current) return;
    
    const video = videoRef.current;
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = video.videoWidth;
    tempCanvas.height = video.videoHeight;
    const tempCtx = tempCanvas.getContext('2d');
    if (!tempCtx) return;
    
    if (zoomLevel > 1 && !('zoom' in (streamRef.current?.getVideoTracks()[0]?.getCapabilities?.() || {}))) {
      const zoomedWidth = video.videoWidth / zoomLevel;
      const zoomedHeight = video.videoHeight / zoomLevel;
      const startX = (video.videoWidth - zoomedWidth) / 2;
      const startY = (video.videoHeight - zoomedHeight) / 2;
      tempCtx.drawImage(video, startX, startY, zoomedWidth, zoomedHeight, 0, 0, tempCanvas.width, tempCanvas.height);
    } else {
      tempCtx.drawImage(video, 0, 0);
    }
    
    const finalCanvas = document.createElement('canvas');
    const finalCtx = finalCanvas.getContext('2d');
    if (!finalCtx) return;
    
    if (previewRotation === 90 || previewRotation === 270) {
      finalCanvas.width = tempCanvas.height;
      finalCanvas.height = tempCanvas.width;
    } else {
      finalCanvas.width = tempCanvas.width;
      finalCanvas.height = tempCanvas.height;
    }
    
    finalCtx.translate(finalCanvas.width / 2, finalCanvas.height / 2);
    finalCtx.rotate((previewRotation * Math.PI) / 180);
    finalCtx.drawImage(tempCanvas, -tempCanvas.width / 2, -tempCanvas.height / 2);
    
    const dataUrl = finalCanvas.toDataURL('image/jpeg', 0.9);
    setCapturedImage(dataUrl);
    setRotation(0);
    
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
  };
  
  const rotatePreview = () => {
    setPreviewRotation((prev) => (prev + 90) % 360);
  };
  
  const rotatePhoto = () => {
    setRotation((prev) => (prev + 90) % 360);
  };
  
  const savePhoto = async () => {
    if (!capturedImage) return;
    
    const img = new Image();
    img.onload = async () => {
      let sourceCanvas = document.createElement('canvas');
      let sourceCtx = sourceCanvas.getContext('2d');
      if (!sourceCtx) return;
      
      if (cropMode && previewImgRef.current) {
        const imgEl = previewImgRef.current;
        const renderedW = imgEl.clientWidth;
        const renderedH = imgEl.clientHeight;
        const naturalW = img.width;
        const naturalH = img.height;
        
        const renderedAspect = renderedW / renderedH;
        const naturalAspect = naturalW / naturalH;
        
        let scale: number;
        let offsetX: number;
        let offsetY: number;
        
        if (naturalAspect > renderedAspect) {
          scale = naturalH / renderedH;
          const scaledNaturalW = naturalW / scale;
          offsetX = ((scaledNaturalW - renderedW) / 2) * scale;
          offsetY = 0;
        } else {
          scale = naturalW / renderedW;
          const scaledNaturalH = naturalH / scale;
          offsetY = ((scaledNaturalH - renderedH) / 2) * scale;
          offsetX = 0;
        }
        
        const visibleNaturalW = renderedW * scale;
        const visibleNaturalH = renderedH * scale;
        
        const cropX = offsetX + (cropArea.x / 100) * visibleNaturalW;
        const cropY = offsetY + (cropArea.y / 100) * visibleNaturalH;
        const cropW = (cropArea.width / 100) * visibleNaturalW;
        const cropH = (cropArea.height / 100) * visibleNaturalH;
        
        const finalCropX = Math.max(0, Math.min(cropX, naturalW - 1));
        const finalCropY = Math.max(0, Math.min(cropY, naturalH - 1));
        const finalCropW = Math.max(1, Math.min(cropW, naturalW - finalCropX));
        const finalCropH = Math.max(1, Math.min(cropH, naturalH - finalCropY));
        
        sourceCanvas.width = Math.round(finalCropW);
        sourceCanvas.height = Math.round(finalCropH);
        sourceCtx.drawImage(img, finalCropX, finalCropY, finalCropW, finalCropH, 0, 0, sourceCanvas.width, sourceCanvas.height);
      } else {
        sourceCanvas.width = img.width;
        sourceCanvas.height = img.height;
        sourceCtx.drawImage(img, 0, 0);
      }
      
      const finalCanvas = document.createElement('canvas');
      const finalCtx = finalCanvas.getContext('2d');
      if (!finalCtx) return;
      
      if (rotation === 90 || rotation === 270) {
        finalCanvas.width = sourceCanvas.height;
        finalCanvas.height = sourceCanvas.width;
      } else {
        finalCanvas.width = sourceCanvas.width;
        finalCanvas.height = sourceCanvas.height;
      }
      
      finalCtx.translate(finalCanvas.width / 2, finalCanvas.height / 2);
      finalCtx.rotate((rotation * Math.PI) / 180);
      finalCtx.drawImage(sourceCanvas, -sourceCanvas.width / 2, -sourceCanvas.height / 2);
      
      finalCanvas.toBlob(async (blob) => {
        if (!blob) return;
        
        const file = new File([blob], `photo_${Date.now()}.jpg`, { type: 'image/jpeg' });
        
        try {
          const result = await uploadFile(file);
          if (result?.objectPath) {
            const newPhotos = [...photos];
            newPhotos[activePhotoIndex] = result.objectPath;
            setPhotos(newPhotos);
            toast({ title: `Photo ${activePhotoIndex + 1} saved` });
            
            if (activePhotoIndex < 7 && !photos[activePhotoIndex + 1]) {
              setCapturedImage(null);
              setRotation(0);
              setCropMode(false);
              setCropArea({ x: 10, y: 10, width: 80, height: 80 });
              setActivePhotoIndex(activePhotoIndex + 1);
              setTimeout(() => {
                startCamera();
              }, 100);
            } else {
              setCameraOpen(false);
            }
          }
        } catch (err) {
          toast({ title: 'Failed to upload photo', variant: 'destructive' });
        }
      }, 'image/jpeg', 0.9);
    };
    img.src = capturedImage;
  };
  
  const retakePhoto = () => {
    setCapturedImage(null);
    setRotation(0);
    setCropMode(false);
    setCropArea({ x: 10, y: 10, width: 80, height: 80 });
    setTimeout(() => {
      startCamera();
    }, 100);
  };
  
  const toggleCamera = () => {
    setFacingMode(prev => prev === 'environment' ? 'user' : 'environment');
  };
  
  const closeCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    setCapturedImage(null);
    setRotation(0);
    setPreviewRotation(0);
    setZoomLevel(1);
    setCropMode(false);
    setCropArea({ x: 10, y: 10, width: 80, height: 80 });
    setCameraOpen(false);
  };
  
  const removePhoto = (index: number) => {
    const newPhotos = [...photos];
    newPhotos.splice(index, 1);
    setPhotos(newPhotos);
  };
  
  const handlePasswordSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (passwordInput === STAFF_PASSWORD) {
      setIsAuthenticated(true);
      setLoginError('');
      saveStaffAuthState({ authenticated: true });
    } else {
      setLoginError('Incorrect password');
      setPasswordInput('');
    }
  };
  
  const handleLogout = () => {
    setIsAuthenticated(false);
    saveStaffAuthState({ authenticated: false });
  };
  
  const handleExport = () => {
    window.location.href = '/api/clothes/export/depop';
    toast({ title: 'Exporting to Depop CSV...' });
  };
  
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="w-full max-w-sm">
          <CardHeader className="text-center">
            <div className="mx-auto w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mb-2">
              <Shirt className="w-6 h-6 text-primary" />
            </div>
            <CardTitle>Clothes Scanner</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handlePasswordSubmit} className="space-y-4">
              <Input
                type="password"
                placeholder="Enter staff password"
                value={passwordInput}
                onChange={(e) => setPasswordInput(e.target.value)}
                data-testid="input-staff-password"
              />
              {loginError && <p className="text-sm text-destructive">{loginError}</p>}
              <Button type="submit" className="w-full" data-testid="button-login">
                <LogIn className="w-4 h-4 mr-2" />
                Access Clothes Scanner
              </Button>
            </form>
            <div className="mt-4 text-center">
              <Link href="/staff">
                <Button variant="ghost" size="sm" data-testid="link-back-staff">
                  <ArrowLeft className="w-4 h-4 mr-1" />
                  Back to Staff
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }
  
  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 bg-background border-b p-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Link href="/staff">
              <Button variant="ghost" size="icon" data-testid="button-back">
                <ArrowLeft className="w-5 h-5" />
              </Button>
            </Link>
            <Shirt className="w-5 h-5 text-primary" />
            <span className="font-semibold">Clothes Scanner</span>
            <Badge variant="secondary">{clothesItems.length} items</Badge>
          </div>
          <div className="flex items-center gap-2">
            <Link href="/admin">
              <Button variant="ghost" size="sm" data-testid="button-admin">
                <LayoutDashboard className="w-4 h-4" />
              </Button>
            </Link>
            <Button variant="outline" size="sm" onClick={handleExport} disabled={clothesItems.length === 0} data-testid="button-export">
              <Download className="w-4 h-4 mr-1" />
              Export Depop
            </Button>
            <Button variant="ghost" size="icon" onClick={handleLogout} data-testid="button-logout">
              <LogOut className="w-4 h-4" />
            </Button>
          </div>
        </div>
        <div className="flex items-center justify-end mt-2">
          {loggedInStaff ? (
            <Button 
              variant="outline" 
              size="sm"
              onClick={handleStaffLogout}
              className="h-7 text-xs"
              data-testid="button-staff-logout"
            >
              <User className="w-3 h-3 mr-1" />
              {loggedInStaff.name}
              <LogOut className="w-3 h-3 ml-1" />
            </Button>
          ) : (
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => setShowStaffLoginDialog(true)}
              className="h-7 text-xs"
              data-testid="button-staff-login-pin"
            >
              <User className="w-3 h-3 mr-1" />
              Clock In
            </Button>
          )}
        </div>
      </header>
      
      <main className="p-3 pb-24 space-y-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <ScanLine className="w-4 h-4" />
              Scan UPC (Optional)
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex gap-2">
              <Input
                ref={scanInputRef}
                placeholder="Scan or enter UPC..."
                value={scanInput}
                onChange={(e) => setScanInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleScan()}
                data-testid="input-upc"
              />
              <Button onClick={handleScan} disabled={isScanning || scanMutation.isPending} data-testid="button-scan">
                <ScanLine className="w-4 h-4" />
              </Button>
            </div>
            {scanResult && (
              <div className="bg-muted/50 rounded p-2 text-sm">
                <Badge variant={scanResult.lookupStatus === 'SUCCESS' ? 'default' : 'secondary'} className="mb-1">
                  {scanResult.lookupStatus}
                </Badge>
                <p className="text-xs text-muted-foreground">{scanResult.title}</p>
              </div>
            )}
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Camera className="w-4 h-4" />
              Photos (Required - Up to 8)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-4 gap-2">
              {[0, 1, 2, 3, 4, 5, 6, 7].map((index) => (
                <div key={index} className="relative aspect-square">
                  {photos[index] ? (
                    <>
                      <img 
                        src={photos[index]} 
                        alt={`Photo ${index + 1}`}
                        className="w-full h-full object-cover rounded border"
                      />
                      <button
                        onClick={() => removePhoto(index)}
                        className="absolute -top-1 -right-1 bg-destructive text-destructive-foreground rounded-full w-5 h-5 flex items-center justify-center"
                        data-testid={`button-remove-photo-${index}`}
                      >
                        <X className="w-3 h-3" />
                      </button>
                      {index === 0 && (
                        <Badge className="absolute bottom-1 left-1 text-[8px] px-1 py-0">Hero</Badge>
                      )}
                    </>
                  ) : (
                    <button
                      onClick={() => openCamera(index)}
                      className="w-full h-full border-2 border-dashed border-muted-foreground/30 rounded flex flex-col items-center justify-center text-muted-foreground hover:border-primary hover:text-primary transition-colors"
                      data-testid={`button-add-photo-${index}`}
                    >
                      <ImagePlus className="w-5 h-5" />
                      <span className="text-[9px] mt-0.5">{index === 0 ? 'Hero' : index + 1}</span>
                    </button>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Package className="w-4 h-4" />
              Item Details
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <label className="text-xs text-muted-foreground">Description *</label>
              <Textarea
                placeholder="Max 1000 characters, max 5 hashtags"
                value={description}
                onChange={(e) => setDescription(e.target.value.slice(0, 1000))}
                className="min-h-20"
                data-testid="input-description"
              />
              <span className="text-[10px] text-muted-foreground">{description.length}/1000</span>
            </div>
            
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-muted-foreground">Category</label>
                <Select value={category} onValueChange={setCategory}>
                  <SelectTrigger data-testid="select-category">
                    <SelectValue placeholder="Select..." />
                  </SelectTrigger>
                  <SelectContent>
                    {DEPOP_CATEGORIES.map((cat) => (
                      <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div>
                <label className="text-xs text-muted-foreground">Price ($)</label>
                <Input
                  type="number"
                  step="0.01"
                  placeholder="0.00"
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  data-testid="input-price"
                />
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-muted-foreground">Brand</label>
                <Input
                  placeholder="Enter brand..."
                  value={brand}
                  onChange={(e) => setBrand(e.target.value)}
                  data-testid="input-brand"
                />
              </div>
              
              <div>
                <label className="text-xs text-muted-foreground">Condition</label>
                <Select value={condition} onValueChange={setCondition}>
                  <SelectTrigger data-testid="select-condition">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {DEPOP_CONDITIONS.map((cond) => (
                      <SelectItem key={cond} value={cond}>{cond}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-muted-foreground">Size</label>
                <Select value={size} onValueChange={setSize}>
                  <SelectTrigger data-testid="select-size">
                    <SelectValue placeholder="Select..." />
                  </SelectTrigger>
                  <SelectContent>
                    {DEPOP_SIZES.map((s) => (
                      <SelectItem key={s} value={s}>{s}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div>
                <label className="text-xs text-muted-foreground">Shelf Location</label>
                <Select value={shelfId?.toString() || ''} onValueChange={(v) => setShelfId(v ? parseInt(v) : null)}>
                  <SelectTrigger data-testid="select-shelf">
                    <SelectValue placeholder="Select..." />
                  </SelectTrigger>
                  <SelectContent>
                    {shelves.map((shelf) => (
                      <SelectItem key={shelf.id} value={shelf.id.toString()}>{shelf.code}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-muted-foreground">Color 1</label>
                <Select value={color1} onValueChange={setColor1}>
                  <SelectTrigger data-testid="select-color1">
                    <SelectValue placeholder="Select..." />
                  </SelectTrigger>
                  <SelectContent>
                    {DEPOP_COLORS.map((c) => (
                      <SelectItem key={c} value={c}>{c}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div>
                <label className="text-xs text-muted-foreground">Color 2</label>
                <Select value={color2} onValueChange={setColor2}>
                  <SelectTrigger data-testid="select-color2">
                    <SelectValue placeholder="Select..." />
                  </SelectTrigger>
                  <SelectContent>
                    {DEPOP_COLORS.map((c) => (
                      <SelectItem key={c} value={c}>{c}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-muted-foreground">Source 1</label>
                <Input
                  value={source1}
                  onChange={(e) => setSource1(e.target.value)}
                  data-testid="input-source1"
                />
              </div>
              
              <div>
                <label className="text-xs text-muted-foreground">Source 2</label>
                <Input
                  placeholder="Optional..."
                  value={source2}
                  onChange={(e) => setSource2(e.target.value)}
                  data-testid="input-source2"
                />
              </div>
            </div>
            
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="text-xs text-muted-foreground">Style 1</label>
                <Input
                  placeholder="Optional..."
                  value={style1}
                  onChange={(e) => setStyle1(e.target.value)}
                  data-testid="input-style1"
                />
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Style 2</label>
                <Input
                  placeholder="Optional..."
                  value={style2}
                  onChange={(e) => setStyle2(e.target.value)}
                  data-testid="input-style2"
                />
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Style 3</label>
                <Input
                  placeholder="Optional..."
                  value={style3}
                  onChange={(e) => setStyle3(e.target.value)}
                  data-testid="input-style3"
                />
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-muted-foreground">Age</label>
                <Input
                  placeholder="Optional..."
                  value={age}
                  onChange={(e) => setAge(e.target.value)}
                  data-testid="input-age"
                />
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Location</label>
                <Input
                  placeholder="Optional..."
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  data-testid="input-location"
                />
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-muted-foreground">Domestic Shipping ($)</label>
                <Input
                  type="number"
                  step="0.01"
                  placeholder="0.00"
                  value={domesticShipping}
                  onChange={(e) => setDomesticShipping(e.target.value)}
                  data-testid="input-domestic-shipping"
                />
              </div>
              <div>
                <label className="text-xs text-muted-foreground">International Shipping ($)</label>
                <Input
                  type="number"
                  step="0.01"
                  placeholder="0.00"
                  value={internationalShipping}
                  onChange={(e) => setInternationalShipping(e.target.value)}
                  data-testid="input-international-shipping"
                />
              </div>
            </div>
          </CardContent>
        </Card>
        
        <div className="flex gap-2">
          <Button onClick={handleSubmit} className="flex-1" disabled={createMutation.isPending || isUploading} data-testid="button-add-item">
            <Plus className="w-4 h-4 mr-2" />
            Add Item
          </Button>
          <Button variant="outline" onClick={resetForm} data-testid="button-reset">
            Clear
          </Button>
        </div>
        
        {clothesItems.length > 0 && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Recent Items</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {clothesItems.slice(0, 10).map((item) => (
                <div key={item.id} className="flex items-center gap-3 p-2 bg-muted/30 rounded">
                  {item.pictureHero ? (
                    <img src={item.pictureHero} alt="" className="w-12 h-12 object-cover rounded" />
                  ) : (
                    <div className="w-12 h-12 bg-muted rounded flex items-center justify-center">
                      <Shirt className="w-5 h-5 text-muted-foreground" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{item.description?.slice(0, 50) || 'No description'}</p>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Badge variant="outline" className="text-[10px]">{item.sku}</Badge>
                      {item.price && <span>${(item.price / 100).toFixed(2)}</span>}
                      {item.size && <span>{item.size}</span>}
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setDeleteConfirmId(item.id)}
                    data-testid={`button-delete-${item.id}`}
                  >
                    <Trash2 className="w-4 h-4 text-destructive" />
                  </Button>
                </div>
              ))}
            </CardContent>
          </Card>
        )}
      </main>
      
      <Dialog open={cameraOpen} onOpenChange={(open) => !open && closeCamera()}>
        <DialogContent className="max-w-md p-4">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between">
              <span>Photo {activePhotoIndex + 1} of 8</span>
              <Badge variant="outline">{photos.filter(Boolean).length} taken</Badge>
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            {capturedImage ? (
              <div 
                ref={cropContainerRef}
                className="relative"
                style={{ transform: cropMode ? 'none' : `rotate(${rotation}deg)` }}
              >
                <img 
                  ref={previewImgRef}
                  src={capturedImage} 
                  alt="Captured preview"
                  className="w-full rounded bg-black aspect-video object-cover"
                />
                {cropMode && (
                  <>
                    <div className="absolute inset-0 bg-black/50" />
                    <div 
                      className="absolute border-2 border-white bg-transparent overflow-hidden"
                      style={{
                        left: `${cropArea.x}%`,
                        top: `${cropArea.y}%`,
                        width: `${cropArea.width}%`,
                        height: `${cropArea.height}%`,
                        boxShadow: '0 0 0 9999px rgba(0,0,0,0.5)',
                      }}
                    >
                      <img 
                        src={capturedImage}
                        alt=""
                        className="absolute object-cover"
                        style={{
                          width: `${100 / (cropArea.width / 100)}%`,
                          height: `${100 / (cropArea.height / 100)}%`,
                          left: `-${cropArea.x / cropArea.width * 100}%`,
                          top: `-${cropArea.y / cropArea.height * 100}%`,
                        }}
                      />
                      <div className="absolute -top-2 -left-2 w-5 h-5 bg-white rounded-full cursor-nw-resize touch-none"
                        onPointerDown={(e) => {
                          e.preventDefault();
                          (e.target as HTMLElement).setPointerCapture(e.pointerId);
                          const startX = e.clientX;
                          const startY = e.clientY;
                          const startArea = { ...cropArea };
                          const onMove = (ev: PointerEvent) => {
                            const container = cropContainerRef.current;
                            if (!container) return;
                            const rect = container.getBoundingClientRect();
                            const dx = ((ev.clientX - startX) / rect.width) * 100;
                            const dy = ((ev.clientY - startY) / rect.height) * 100;
                            const newX = Math.max(0, Math.min(startArea.x + dx, startArea.x + startArea.width - 15));
                            const newY = Math.max(0, Math.min(startArea.y + dy, startArea.y + startArea.height - 15));
                            setCropArea({
                              x: newX,
                              y: newY,
                              width: startArea.width - (newX - startArea.x),
                              height: startArea.height - (newY - startArea.y),
                            });
                          };
                          const onUp = () => {
                            window.removeEventListener('pointermove', onMove);
                            window.removeEventListener('pointerup', onUp);
                          };
                          window.addEventListener('pointermove', onMove);
                          window.addEventListener('pointerup', onUp);
                        }}
                      />
                      <div className="absolute -bottom-2 -right-2 w-5 h-5 bg-white rounded-full cursor-se-resize touch-none"
                        onPointerDown={(e) => {
                          e.preventDefault();
                          (e.target as HTMLElement).setPointerCapture(e.pointerId);
                          const startX = e.clientX;
                          const startY = e.clientY;
                          const startArea = { ...cropArea };
                          const onMove = (ev: PointerEvent) => {
                            const container = cropContainerRef.current;
                            if (!container) return;
                            const rect = container.getBoundingClientRect();
                            const dx = ((ev.clientX - startX) / rect.width) * 100;
                            const dy = ((ev.clientY - startY) / rect.height) * 100;
                            setCropArea({
                              ...startArea,
                              width: Math.max(15, Math.min(100 - startArea.x, startArea.width + dx)),
                              height: Math.max(15, Math.min(100 - startArea.y, startArea.height + dy)),
                            });
                          };
                          const onUp = () => {
                            window.removeEventListener('pointermove', onMove);
                            window.removeEventListener('pointerup', onUp);
                          };
                          window.addEventListener('pointermove', onMove);
                          window.addEventListener('pointerup', onUp);
                        }}
                      />
                      <div className="absolute inset-0 cursor-move touch-none"
                        onPointerDown={(e) => {
                          e.preventDefault();
                          (e.target as HTMLElement).setPointerCapture(e.pointerId);
                          const startX = e.clientX;
                          const startY = e.clientY;
                          const startArea = { ...cropArea };
                          const onMove = (ev: PointerEvent) => {
                            const container = cropContainerRef.current;
                            if (!container) return;
                            const rect = container.getBoundingClientRect();
                            const dx = ((ev.clientX - startX) / rect.width) * 100;
                            const dy = ((ev.clientY - startY) / rect.height) * 100;
                            setCropArea({
                              ...startArea,
                              x: Math.max(0, Math.min(100 - startArea.width, startArea.x + dx)),
                              y: Math.max(0, Math.min(100 - startArea.height, startArea.y + dy)),
                            });
                          };
                          const onUp = () => {
                            window.removeEventListener('pointermove', onMove);
                            window.removeEventListener('pointerup', onUp);
                          };
                          window.addEventListener('pointermove', onMove);
                          window.addEventListener('pointerup', onUp);
                        }}
                      />
                    </div>
                  </>
                )}
              </div>
            ) : (
              <div className="relative overflow-hidden rounded">
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  className="w-full bg-black aspect-video object-cover"
                  style={{ 
                    transform: `${facingMode === 'user' ? 'scaleX(-1)' : ''} scale(${zoomLevel}) rotate(${previewRotation}deg)`.trim(),
                    transformOrigin: 'center center'
                  }}
                />
                {(zoomLevel > 1 || previewRotation > 0) && (
                  <div className="absolute bottom-2 left-2 bg-black/60 text-white text-xs px-2 py-1 rounded flex gap-2">
                    {zoomLevel > 1 && <span>{zoomLevel.toFixed(1)}x</span>}
                    {previewRotation > 0 && <span>{previewRotation}°</span>}
                  </div>
                )}
              </div>
            )}
            
            {!capturedImage && (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <ZoomIn className="w-4 h-4 text-muted-foreground" />
                  <Slider
                    value={[zoomLevel]}
                    onValueChange={([val]) => setZoomLevel(val)}
                    min={1}
                    max={maxZoom}
                    step={0.1}
                    className="flex-1"
                    data-testid="slider-zoom"
                  />
                  <span className="text-xs text-muted-foreground w-8">{zoomLevel.toFixed(1)}x</span>
                </div>
                
                <div className="flex gap-2">
                  <Button onClick={capturePreview} className="flex-1" data-testid="button-capture">
                    <Camera className="w-4 h-4 mr-2" />
                    Capture
                  </Button>
                  <Button variant="outline" size="icon" onClick={rotatePreview} data-testid="button-rotate-preview">
                    <RotateCw className="w-4 h-4" />
                  </Button>
                  <Button variant="outline" size="icon" onClick={toggleCamera} data-testid="button-flip-camera">
                    <FlipHorizontal2 className="w-4 h-4" />
                  </Button>
                  <Button variant="outline" onClick={closeCamera} data-testid="button-cancel-camera">
                    Cancel
                  </Button>
                </div>
              </div>
            )}
            
            {capturedImage && (
              <div className="space-y-2">
                <div className="flex gap-2 justify-center items-center">
                  <Button 
                    variant="outline" 
                    size="icon" 
                    onClick={rotatePhoto} 
                    disabled={cropMode}
                    data-testid="button-rotate"
                  >
                    <RotateCw className="w-4 h-4" />
                  </Button>
                  {!cropMode && <span className="text-xs text-muted-foreground">{rotation}°</span>}
                  <Button 
                    variant={cropMode ? "default" : "outline"} 
                    size="icon" 
                    onClick={() => {
                      if (!cropMode) {
                        setRotation(0);
                      }
                      setCropMode(!cropMode);
                    }} 
                    data-testid="button-crop"
                  >
                    <Crop className="w-4 h-4" />
                  </Button>
                  {cropMode && <span className="text-xs text-muted-foreground">Drag corners to crop</span>}
                </div>
                
                <div className="flex gap-2">
                  <Button onClick={savePhoto} className="flex-1" disabled={isUploading} data-testid="button-save-photo">
                    <Plus className="w-4 h-4 mr-2" />
                    {isUploading ? 'Saving...' : 'Save & Next'}
                  </Button>
                  <Button variant="outline" onClick={retakePhoto} data-testid="button-retake">
                    Retake
                  </Button>
                </div>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
      
      <AlertDialog open={deleteConfirmId !== null} onOpenChange={() => setDeleteConfirmId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Item?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. The item will be permanently removed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (deleteConfirmId) {
                  deleteMutation.mutate(deleteConfirmId);
                  setDeleteConfirmId(null);
                }
              }}
              data-testid="button-confirm-delete"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      
      <Dialog open={showStaffLoginDialog} onOpenChange={setShowStaffLoginDialog}>
        <DialogContent className="max-w-xs">
          <DialogHeader>
            <DialogTitle>Clock In</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <p className="text-sm text-muted-foreground">Enter your 4-digit PIN to start tracking your scans.</p>
            <Input
              type="password"
              placeholder="Enter PIN"
              value={staffPinInput}
              onChange={(e) => setStaffPinInput(e.target.value.replace(/\D/g, '').slice(0, 4))}
              maxLength={4}
              className="text-center text-2xl tracking-widest"
              autoFocus
              data-testid="input-staff-pin"
            />
            <Button 
              className="w-full" 
              onClick={() => staffLoginMutation.mutate(staffPinInput)}
              disabled={staffPinInput.length !== 4 || staffLoginMutation.isPending}
              data-testid="button-clock-in"
            >
              {staffLoginMutation.isPending ? 'Logging in...' : 'Clock In'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
