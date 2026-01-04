interface UPCProduct {
  title: string;
  description: string;
  image: string;
  retailPrice: number | null;
  upc: string;
}

interface UPCAPIResponse {
  code: string;
  total: number;
  offset: number;
  items: Array<{
    ean: string;
    title: string;
    description: string;
    upc: string;
    brand: string;
    model: string;
    color: string;
    size: string;
    dimension: string;
    weight: string;
    category: string;
    currency: string;
    lowest_recorded_price: number;
    highest_recorded_price: number;
    images: string[];
    offers: Array<{
      merchant: string;
      domain: string;
      title: string;
      currency: string;
      list_price: string;
      price: number;
      shipping: string;
      condition: string;
      availability: string;
      link: string;
      updated_t: number;
    }>;
  }>;
}

export async function lookupUPC(upc: string): Promise<UPCProduct | null> {
  const apiKey = process.env.UPCITEMDB_API_KEY;
  
  let url: string;
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  };
  
  if (apiKey) {
    url = `https://api.upcitemdb.com/prod/v1/lookup?upc=${upc}`;
    headers['user_key'] = apiKey;
    headers['key_type'] = '3scale';
  } else {
    url = `https://api.upcitemdb.com/prod/trial/lookup?upc=${upc}`;
  }
  
  try {
    const response = await fetch(url, { headers });
    
    if (!response.ok) {
      console.error(`UPC API error: ${response.status} ${response.statusText}`);
      return null;
    }
    
    const data: UPCAPIResponse = await response.json();
    
    if (data.code !== 'OK' || data.total === 0 || !data.items || data.items.length === 0) {
      console.log(`No product found for UPC: ${upc}`);
      return null;
    }
    
    const item = data.items[0];
    
    const retailPrice = item.highest_recorded_price 
      ? Math.round(item.highest_recorded_price * 100)
      : null;
    
    return {
      title: item.title || 'Unknown Product',
      description: item.description || '',
      image: item.images && item.images.length > 0 ? item.images[0] : '',
      retailPrice,
      upc: item.upc || upc,
    };
  } catch (error) {
    console.error('Error looking up UPC:', error);
    return null;
  }
}
