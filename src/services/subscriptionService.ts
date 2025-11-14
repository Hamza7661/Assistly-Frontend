import { HttpService } from './httpService';

interface Subscription {
  _id: string;
  user: string;
  package: any;
  stripeCustomerId: string;
  stripeSubscriptionId: string;
  stripePriceId: string;
  status: 'active' | 'canceled' | 'past_due' | 'unpaid' | 'incomplete' | 'incomplete_expired' | 'trialing' | 'paused';
  currentPeriodStart: string;
  currentPeriodEnd: string;
  cancelAtPeriodEnd: boolean;
  canceledAt: string | null;
  billingCycle: 'monthly' | 'yearly' | 'one-time';
  amount: number;
  currency: string;
  createdAt: string;
  updatedAt: string;
}

interface SubscriptionResponse {
  status: string;
  data: {
    subscription: Subscription | null;
    package: any;
    stripeCustomerId: string | null;
  };
}

interface CheckoutSessionResponse {
  status: string;
  data: {
    sessionId: string;
    url: string;
  };
}

interface PortalSessionResponse {
  status: string;
  data: {
    url: string;
  };
}

class SubscriptionService extends HttpService {
  async getMySubscription(): Promise<SubscriptionResponse> {
    const response = await this.request<SubscriptionResponse>('/subscriptions/me', {
      method: 'GET',
    });
    return response;
  }

  async createCheckoutSession(packageId: string, successUrl?: string, cancelUrl?: string): Promise<CheckoutSessionResponse> {
    const response = await this.request<CheckoutSessionResponse>('/subscriptions/create-checkout-session', {
      method: 'POST',
      body: JSON.stringify({
        packageId,
        successUrl: successUrl || `${window.location.origin}/dashboard?subscription=success`,
        cancelUrl: cancelUrl || `${window.location.origin}/packages?subscription=canceled`
      }),
    });
    return response;
  }

  async createPortalSession(returnUrl?: string): Promise<PortalSessionResponse> {
    const response = await this.request<PortalSessionResponse>('/subscriptions/create-portal-session', {
      method: 'POST',
      body: JSON.stringify({
        returnUrl: returnUrl || `${window.location.origin}/dashboard`
      }),
    });
    return response;
  }
}

export const subscriptionService = new SubscriptionService();

