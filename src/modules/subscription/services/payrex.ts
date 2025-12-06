import { PAYREX_CONFIG, SUBSCRIPTION_PLANS } from "../constants";
import type {
  PayRexCheckoutSession,
  CreateCheckoutSessionParams,
  SubscriptionTier,
  PayRexLineItem,
} from "../types";

/**
 * PayRex API Service
 * Handles payment processing through PayRex checkout sessions
 *
 * Documentation: https://docs.payrexhq.com/
 */

// Create authorization header for PayRex API
function getAuthHeader(): string {
  // PayRex uses Basic auth with secret key as username and empty password
  const credentials = btoa(`${PAYREX_CONFIG.SECRET_KEY}:`);
  return `Basic ${credentials}`;
}

/**
 * Create a PayRex checkout session for subscription payment
 */
export async function createCheckoutSession(
  params: CreateCheckoutSessionParams
): Promise<{ session: PayRexCheckoutSession | null; error: string | null }> {
  try {
    const response = await fetch(
      `${PAYREX_CONFIG.API_BASE_URL}/checkout_sessions`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: getAuthHeader(),
        },
        body: JSON.stringify({
          line_items: params.line_items,
          success_url: params.success_url,
          cancel_url: params.cancel_url,
          customer_reference_id: params.customer_reference_id,
          description: params.description,
          metadata: params.metadata,
          payment_methods: params.payment_methods || [
            "card",
            "gcash",
            "grab_pay",
            "maya",
          ],
        }),
      }
    );

    if (!response.ok) {
      const errorData = await response.json();
      console.error("PayRex API Error:", errorData);
      return {
        session: null,
        error: errorData.message || "Failed to create checkout session",
      };
    }

    const data = await response.json();
    return { session: data.data, error: null };
  } catch (error) {
    console.error("PayRex checkout error:", error);
    return {
      session: null,
      error: error instanceof Error ? error.message : "Network error occurred",
    };
  }
}

/**
 * Retrieve a checkout session by ID
 */
export async function getCheckoutSession(
  sessionId: string
): Promise<{ session: PayRexCheckoutSession | null; error: string | null }> {
  try {
    const response = await fetch(
      `${PAYREX_CONFIG.API_BASE_URL}/checkout_sessions/${sessionId}`,
      {
        method: "GET",
        headers: {
          Authorization: getAuthHeader(),
        },
      }
    );

    if (!response.ok) {
      const errorData = await response.json();
      return {
        session: null,
        error: errorData.message || "Failed to retrieve checkout session",
      };
    }

    const data = await response.json();
    return { session: data.data, error: null };
  } catch (error) {
    console.error("PayRex get session error:", error);
    return {
      session: null,
      error: error instanceof Error ? error.message : "Network error occurred",
    };
  }
}

/**
 * Expire a checkout session
 */
export async function expireCheckoutSession(
  sessionId: string
): Promise<{ success: boolean; error: string | null }> {
  try {
    const response = await fetch(
      `${PAYREX_CONFIG.API_BASE_URL}/checkout_sessions/${sessionId}/expire`,
      {
        method: "POST",
        headers: {
          Authorization: getAuthHeader(),
        },
      }
    );

    if (!response.ok) {
      const errorData = await response.json();
      return {
        success: false,
        error: errorData.message || "Failed to expire checkout session",
      };
    }

    return { success: true, error: null };
  } catch (error) {
    console.error("PayRex expire session error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Network error occurred",
    };
  }
}

/**
 * Create a checkout session for Pro subscription
 */
export async function createProSubscriptionCheckout(
  userId: string,
  successUrl: string,
  cancelUrl: string
): Promise<{
  checkoutUrl: string | null;
  sessionId: string | null;
  error: string | null;
}> {
  const proPlan = SUBSCRIPTION_PLANS.find((p) => p.id === "pro");
  if (!proPlan) {
    return { checkoutUrl: null, sessionId: null, error: "Pro plan not found" };
  }

  const lineItems: PayRexLineItem[] = [
    {
      name: "AInay Pro Subscription",
      quantity: 1,
      amount: proPlan.priceInCents,
      description: "Monthly subscription - Unlock all features",
    },
  ];

  const { session, error } = await createCheckoutSession({
    line_items: lineItems,
    success_url: successUrl,
    cancel_url: cancelUrl,
    customer_reference_id: userId,
    description: "AInay Companion Care - Pro Subscription",
    metadata: {
      user_id: userId,
      tier: "pro",
      subscription_type: "monthly",
    },
  });

  if (error || !session) {
    return { checkoutUrl: null, sessionId: null, error };
  }

  return {
    checkoutUrl: session.url,
    sessionId: session.id,
    error: null,
  };
}

/**
 * Verify if a checkout session was successful
 */
export async function verifyCheckoutSuccess(sessionId: string): Promise<{
  success: boolean;
  tier: SubscriptionTier | null;
  error: string | null;
}> {
  const { session, error } = await getCheckoutSession(sessionId);

  if (error || !session) {
    return { success: false, tier: null, error };
  }

  if (session.status === "completed") {
    const tier = (session.metadata?.tier as SubscriptionTier) || "pro";
    return { success: true, tier, error: null };
  }

  return {
    success: false,
    tier: null,
    error: `Checkout session status: ${session.status}`,
  };
}

/**
 * Check if PayRex is properly configured
 */
export function isPayRexConfigured(): boolean {
  return !!PAYREX_CONFIG.SECRET_KEY && PAYREX_CONFIG.SECRET_KEY.length > 10;
}

/**
 * Get test mode status message
 */
export function getPayRexModeMessage(): string {
  if (!isPayRexConfigured()) {
    return "PayRex not configured. Add VITE_PAYREX_SECRET_KEY to your environment.";
  }

  if (PAYREX_CONFIG.SECRET_KEY.startsWith("sk_test_")) {
    return "Running in PayRex TEST mode - No real charges will be made.";
  }

  if (PAYREX_CONFIG.SECRET_KEY.startsWith("sk_live_")) {
    return "Running in PayRex LIVE mode - Real charges will be processed.";
  }

  return "PayRex mode unknown - Please verify your API key.";
}

