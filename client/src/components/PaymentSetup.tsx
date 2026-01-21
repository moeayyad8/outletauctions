import { useState, useEffect } from 'react';
import { loadStripe } from '@stripe/stripe-js';
import { Elements, CardElement, useStripe, useElements } from '@stripe/react-stripe-js';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { CreditCard, Check, AlertCircle, Loader2, Trash2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { apiRequest, queryClient } from '@/lib/queryClient';

interface PaymentStatus {
  hasPaymentMethod: boolean;
  paymentMethodLast4: string | null;
  paymentMethodBrand: string | null;
  paymentStatus: string;
  biddingBlocked: boolean;
  biddingBlockedReason: string | null;
}

interface SetupIntentResponse {
  clientSecret: string;
  publishableKey: string;
}

function CardSetupForm({ 
  clientSecret, 
  onSuccess 
}: { 
  clientSecret: string; 
  onSuccess: () => void;
}) {
  const stripe = useStripe();
  const elements = useElements();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  const confirmMutation = useMutation({
    mutationFn: async (paymentMethodId: string) => {
      return apiRequest('POST', '/api/stripe/confirm-setup', { paymentMethodId });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/payment/status'] });
      toast({
        title: 'Payment method saved',
        description: 'Your card has been saved for future purchases.',
      });
      onSuccess();
    },
    onError: () => {
      setError('Failed to save payment method. Please try again.');
    },
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!stripe || !elements) return;

    setLoading(true);
    setError(null);

    const cardElement = elements.getElement(CardElement);
    if (!cardElement) {
      setError('Card element not found');
      setLoading(false);
      return;
    }

    const { error: stripeError, setupIntent } = await stripe.confirmCardSetup(clientSecret, {
      payment_method: {
        card: cardElement,
      },
    });

    if (stripeError) {
      setError(stripeError.message || 'Failed to save card');
      setLoading(false);
      return;
    }

    if (setupIntent?.status === 'succeeded' && setupIntent.payment_method) {
      confirmMutation.mutate(setupIntent.payment_method as string);
    } else {
      setError('Card setup did not complete. Please try again.');
    }

    setLoading(false);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="p-4 border rounded-lg bg-background">
        <CardElement 
          options={{
            style: {
              base: {
                fontSize: '16px',
                color: '#424770',
                '::placeholder': {
                  color: '#aab7c4',
                },
              },
              invalid: {
                color: '#9e2146',
              },
            },
          }}
        />
      </div>
      
      {error && (
        <div className="flex items-center gap-2 text-sm text-destructive">
          <AlertCircle className="w-4 h-4" />
          {error}
        </div>
      )}
      
      <Button 
        type="submit" 
        disabled={!stripe || loading || confirmMutation.isPending}
        className="w-full"
        data-testid="button-save-card"
      >
        {loading || confirmMutation.isPending ? (
          <>
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            Saving...
          </>
        ) : (
          <>
            <CreditCard className="w-4 h-4 mr-2" />
            Save Card
          </>
        )}
      </Button>
    </form>
  );
}

export function PaymentSetup() {
  const [showForm, setShowForm] = useState(false);
  const [stripePromise, setStripePromise] = useState<ReturnType<typeof loadStripe> | null>(null);
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const { toast } = useToast();

  const { data: paymentStatus, isLoading } = useQuery<PaymentStatus>({
    queryKey: ['/api/payment/status'],
  });

  const setupMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest('POST', '/api/stripe/setup-intent');
      return response.json() as Promise<SetupIntentResponse>;
    },
    onSuccess: (data) => {
      setStripePromise(loadStripe(data.publishableKey));
      setClientSecret(data.clientSecret);
      setShowForm(true);
    },
    onError: () => {
      toast({
        title: 'Error',
        description: 'Failed to initialize payment setup. Please try again.',
        variant: 'destructive',
      });
    },
  });

  const removeMutation = useMutation({
    mutationFn: async () => {
      return apiRequest('DELETE', '/api/stripe/payment-method');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/payment/status'] });
      toast({
        title: 'Card removed',
        description: 'Your payment method has been removed.',
      });
    },
    onError: () => {
      toast({
        title: 'Error',
        description: 'Failed to remove payment method.',
        variant: 'destructive',
      });
    },
  });

  const handleAddCard = () => {
    setupMutation.mutate();
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card data-testid="card-payment-setup">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <CreditCard className="w-5 h-5" />
              Payment Method
            </CardTitle>
            <CardDescription>
              {paymentStatus?.hasPaymentMethod 
                ? 'Your card on file for auction purchases'
                : 'Add a card to start bidding on items'
              }
            </CardDescription>
          </div>
          {paymentStatus?.biddingBlocked && (
            <Badge variant="destructive" data-testid="badge-bidding-blocked">
              Bidding Blocked
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {paymentStatus?.biddingBlocked && paymentStatus.biddingBlockedReason && (
          <div className="mb-4 p-3 bg-destructive/10 border border-destructive/20 rounded-lg">
            <div className="flex items-center gap-2 text-sm text-destructive">
              <AlertCircle className="w-4 h-4" />
              {paymentStatus.biddingBlockedReason}
            </div>
          </div>
        )}

        {paymentStatus?.hasPaymentMethod ? (
          <div className="space-y-4">
            <div className="flex items-center justify-between p-4 border rounded-lg bg-muted/50">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                  <CreditCard className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <p className="font-medium capitalize" data-testid="text-card-brand">
                    {paymentStatus.paymentMethodBrand || 'Card'}
                  </p>
                  <p className="text-sm text-muted-foreground" data-testid="text-card-last4">
                    •••• {paymentStatus.paymentMethodLast4}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="secondary" className="bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300">
                  <Check className="w-3 h-3 mr-1" />
                  Active
                </Badge>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => removeMutation.mutate()}
                  disabled={removeMutation.isPending}
                  data-testid="button-remove-card"
                >
                  {removeMutation.isPending ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Trash2 className="w-4 h-4 text-muted-foreground hover:text-destructive" />
                  )}
                </Button>
              </div>
            </div>
            
            <Button 
              variant="outline" 
              className="w-full"
              onClick={handleAddCard}
              disabled={setupMutation.isPending}
              data-testid="button-update-card"
            >
              {setupMutation.isPending ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <CreditCard className="w-4 h-4 mr-2" />
              )}
              Update Card
            </Button>
          </div>
        ) : showForm && stripePromise && clientSecret ? (
          <Elements stripe={stripePromise} options={{ clientSecret }}>
            <CardSetupForm 
              clientSecret={clientSecret} 
              onSuccess={() => setShowForm(false)} 
            />
          </Elements>
        ) : (
          <Button 
            className="w-full"
            onClick={handleAddCard}
            disabled={setupMutation.isPending}
            data-testid="button-add-card"
          >
            {setupMutation.isPending ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Setting up...
              </>
            ) : (
              <>
                <CreditCard className="w-4 h-4 mr-2" />
                Add Payment Method
              </>
            )}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
