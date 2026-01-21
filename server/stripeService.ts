import Stripe from 'stripe';

if (!process.env.STRIPE_SECRET_KEY) {
  console.warn('STRIPE_SECRET_KEY not configured - payment features will be disabled');
}

const stripe = process.env.STRIPE_SECRET_KEY 
  ? new Stripe(process.env.STRIPE_SECRET_KEY)
  : null;

export interface CreateCustomerResult {
  customerId: string;
}

export interface SetupIntentResult {
  clientSecret: string;
  setupIntentId: string;
}

export interface PaymentMethodInfo {
  paymentMethodId: string;
  last4: string;
  brand: string;
}

export interface ChargeResult {
  success: boolean;
  paymentIntentId?: string;
  error?: string;
  requiresAction?: boolean;
}

export async function createCustomer(email: string, name?: string): Promise<CreateCustomerResult> {
  if (!stripe) throw new Error('Stripe not configured');
  
  const customer = await stripe.customers.create({
    email,
    name: name || undefined,
    metadata: {
      platform: 'outlet_auctions'
    }
  });
  
  return { customerId: customer.id };
}

export async function createSetupIntent(customerId: string): Promise<SetupIntentResult> {
  if (!stripe) throw new Error('Stripe not configured');
  
  const setupIntent = await stripe.setupIntents.create({
    customer: customerId,
    payment_method_types: ['card'],
    usage: 'off_session',
  });
  
  return {
    clientSecret: setupIntent.client_secret!,
    setupIntentId: setupIntent.id,
  };
}

export async function getPaymentMethodInfo(paymentMethodId: string): Promise<PaymentMethodInfo> {
  if (!stripe) throw new Error('Stripe not configured');
  
  const paymentMethod = await stripe.paymentMethods.retrieve(paymentMethodId);
  
  if (paymentMethod.type !== 'card' || !paymentMethod.card) {
    throw new Error('Invalid payment method type');
  }
  
  return {
    paymentMethodId: paymentMethod.id,
    last4: paymentMethod.card.last4,
    brand: paymentMethod.card.brand,
  };
}

export async function attachPaymentMethodToCustomer(
  paymentMethodId: string, 
  customerId: string
): Promise<void> {
  if (!stripe) throw new Error('Stripe not configured');
  
  await stripe.paymentMethods.attach(paymentMethodId, {
    customer: customerId,
  });
  
  await stripe.customers.update(customerId, {
    invoice_settings: {
      default_payment_method: paymentMethodId,
    },
  });
}

export async function chargeCustomer(
  customerId: string,
  paymentMethodId: string,
  amountCents: number,
  description: string,
  metadata?: Record<string, string>
): Promise<ChargeResult> {
  if (!stripe) throw new Error('Stripe not configured');
  
  try {
    const paymentIntent = await stripe.paymentIntents.create({
      amount: amountCents,
      currency: 'usd',
      customer: customerId,
      payment_method: paymentMethodId,
      off_session: true,
      confirm: true,
      description,
      metadata: metadata || {},
    });
    
    if (paymentIntent.status === 'succeeded') {
      return {
        success: true,
        paymentIntentId: paymentIntent.id,
      };
    } else if (paymentIntent.status === 'requires_action') {
      return {
        success: false,
        paymentIntentId: paymentIntent.id,
        requiresAction: true,
        error: 'Payment requires additional authentication',
      };
    } else {
      return {
        success: false,
        paymentIntentId: paymentIntent.id,
        error: `Payment failed with status: ${paymentIntent.status}`,
      };
    }
  } catch (error: any) {
    if (error.type === 'StripeCardError') {
      return {
        success: false,
        error: error.message || 'Card was declined',
      };
    }
    throw error;
  }
}

export async function detachPaymentMethod(paymentMethodId: string): Promise<void> {
  if (!stripe) throw new Error('Stripe not configured');
  await stripe.paymentMethods.detach(paymentMethodId);
}

export async function listCustomerPaymentMethods(customerId: string): Promise<PaymentMethodInfo[]> {
  if (!stripe) throw new Error('Stripe not configured');
  
  const methods = await stripe.paymentMethods.list({
    customer: customerId,
    type: 'card',
  });
  
  return methods.data.map(pm => ({
    paymentMethodId: pm.id,
    last4: pm.card?.last4 || '',
    brand: pm.card?.brand || '',
  }));
}

export function isStripeConfigured(): boolean {
  return stripe !== null;
}
