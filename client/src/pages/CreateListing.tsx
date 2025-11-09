import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card } from '@/components/ui/card';
import { BottomNav } from '@/components/BottomNav';
import { ArrowLeft, Upload, X } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';

export default function CreateListing() {
  const [images, setImages] = useState<string[]>([]);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [startingBid, setStartingBid] = useState('');
  const [duration, setDuration] = useState('3');
  const [category, setCategory] = useState('');
  const { toast } = useToast();

  const handleImageUpload = () => {
    console.log('Image upload clicked');
    toast({
      title: 'Image upload',
      description: 'Image upload functionality will be implemented in the backend.',
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    console.log('Form submitted:', { title, description, startingBid, duration, category });
    toast({
      title: 'Listing created!',
      description: 'Your auction has been created successfully.',
    });
  };

  return (
    <div className="min-h-screen bg-background pb-20">
      <header className="sticky top-0 z-40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b">
        <div className="flex items-center gap-3 h-14 px-4">
          <Button
            size="icon"
            variant="ghost"
            onClick={() => console.log('Navigate back')}
            data-testid="button-back"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-lg font-semibold">Create Listing</h1>
        </div>
      </header>

      <form onSubmit={handleSubmit} className="p-4 space-y-6">
        <div className="space-y-3">
          <Label>Photos</Label>
          <div className="grid grid-cols-3 gap-3">
            {images.map((img, index) => (
              <div key={index} className="relative aspect-square bg-muted rounded-md">
                <img src={img} alt={`Upload ${index + 1}`} className="w-full h-full object-cover rounded-md" />
                <Button
                  size="icon"
                  variant="ghost"
                  className="absolute top-1 right-1 h-6 w-6 bg-background/80 backdrop-blur-sm"
                  onClick={() => setImages(images.filter((_, i) => i !== index))}
                  type="button"
                  data-testid={`button-remove-image-${index}`}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ))}
            {images.length < 6 && (
              <button
                type="button"
                onClick={handleImageUpload}
                className="aspect-square bg-muted rounded-md flex flex-col items-center justify-center gap-2 hover-elevate active-elevate-2 border-2 border-dashed border-border"
                data-testid="button-upload-image"
              >
                <Upload className="h-6 w-6 text-muted-foreground" />
                <span className="text-xs text-muted-foreground">Add Photo</span>
              </button>
            )}
          </div>
          <p className="text-xs text-muted-foreground">Add up to 6 photos</p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="title">Title</Label>
          <Input
            id="title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g., Vintage Analog Camera"
            required
            data-testid="input-title"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="category">Category</Label>
          <Select value={category} onValueChange={setCategory} required>
            <SelectTrigger data-testid="select-category">
              <SelectValue placeholder="Select a category" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="electronics">Electronics</SelectItem>
              <SelectItem value="fashion">Fashion</SelectItem>
              <SelectItem value="collectibles">Collectibles</SelectItem>
              <SelectItem value="home">Home & Garden</SelectItem>
              <SelectItem value="sports">Sports & Outdoors</SelectItem>
              <SelectItem value="music">Musical Instruments</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="description">Description</Label>
          <Textarea
            id="description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Describe your item in detail..."
            rows={4}
            required
            data-testid="input-description"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="starting-bid">Starting Bid</Label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
            <Input
              id="starting-bid"
              type="number"
              value={startingBid}
              onChange={(e) => setStartingBid(e.target.value)}
              placeholder="0.00"
              className="pl-6"
              min="1"
              step="0.01"
              required
              data-testid="input-starting-bid"
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="duration">Auction Duration</Label>
          <Select value={duration} onValueChange={setDuration}>
            <SelectTrigger data-testid="select-duration">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="1">1 day</SelectItem>
              <SelectItem value="3">3 days</SelectItem>
              <SelectItem value="7">7 days</SelectItem>
              <SelectItem value="14">14 days</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <Card className="p-4 bg-muted/50">
          <h3 className="font-medium mb-2">Preview</h3>
          <div className="space-y-1 text-sm">
            <p className="text-muted-foreground">Title: {title || 'Not set'}</p>
            <p className="text-muted-foreground">Starting bid: ${startingBid || '0.00'}</p>
            <p className="text-muted-foreground">Duration: {duration} days</p>
          </div>
        </Card>

        <Button type="submit" className="w-full" size="lg" data-testid="button-create-listing">
          Create Listing
        </Button>
      </form>

      <BottomNav />
    </div>
  );
}
