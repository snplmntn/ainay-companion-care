/**
 * Payment API Service
 * Handles communication with the Express payment server
 */

// Payment server URL - can be configured via environment variable
const PAYMENT_SERVER_URL =
  import.meta.env.VITE_PAYMENT_SERVER_URL || "http://localhost:3001";

interface PaymentStatusResponse {
  configured: boolean;
  mode: "test" | "live" | "unconfigured" | "unknown";
  message: string;
}

interface CheckoutResponse {
  success: boolean;
  checkoutUrl?: string;
  sessionId?: string;
  txnRef?: string;
  error?: string;
  details?: string;
}

interface LookupResponse {
  success: boolean;
  sessionId?: string;
  userId?: string;
  error?: string;
}

interface VerifyResponse {
  success: boolean;
  status?: string;
  tier?: string;
  userId?: string;
  error?: string;
}

/**
 * Get the payment server status with retry support
 */
export async function getPaymentStatus(
  retries = 2,
  delayMs = 1000
): Promise<PaymentStatusResponse> {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const response = await fetch(`${PAYMENT_SERVER_URL}/api/payments/status`);

      if (!response.ok) {
        return {
          configured: false,
          mode: "unconfigured",
          message: "Payment server not available",
        };
      }

      return await response.json();
    } catch (error) {
      // Only log on final attempt to avoid console spam
      if (attempt === retries) {
        // Use debug-level logging - this is expected when payment server isn't running
        console.debug(
          "[Payment API] Payment server not reachable (this is normal if server is not started)"
        );
      } else {
        // Wait before retry
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }
    }
  }

  return {
    configured: false,
    mode: "unconfigured",
    message: "Cannot connect to payment server",
  };
}

/**
 * Check if the payment server is available
 */
export async function isPaymentServerAvailable(): Promise<boolean> {
  try {
    const response = await fetch(`${PAYMENT_SERVER_URL}/api/health`, {
      method: "GET",
    });
    return response.ok;
  } catch {
    return false;
  }
}

/**
 * Create a checkout session for Pro subscription
 */
export async function createCheckout(
  userId: string,
  successUrl?: string,
  cancelUrl?: string
): Promise<CheckoutResponse> {
  try {
    const response = await fetch(
      `${PAYMENT_SERVER_URL}/api/payments/checkout`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          userId,
          successUrl,
          cancelUrl,
        }),
      }
    );

    const data = await response.json();

    if (!response.ok) {
      return {
        success: false,
        error: data.error || "Failed to create checkout",
        details: data.details,
      };
    }

    return {
      success: true,
      checkoutUrl: data.checkoutUrl,
      sessionId: data.sessionId,
      txnRef: data.txnRef,
    };
  } catch (error) {
    console.error("[Payment API] Checkout error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Network error",
    };
  }
}

/**
 * Look up session ID by transaction reference
 * Used when localStorage is cleared during PayRex redirect
 */
export async function lookupSessionByTxnRef(
  txnRef: string
): Promise<LookupResponse> {
  try {
    const response = await fetch(
      `${PAYMENT_SERVER_URL}/api/payments/lookup/${txnRef}`
    );

    const data = await response.json();

    if (!response.ok) {
      return {
        success: false,
        error: data.error || "Lookup failed",
      };
    }

    return {
      success: true,
      sessionId: data.sessionId,
      userId: data.userId,
    };
  } catch (error) {
    console.error("[Payment API] Lookup error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Network error",
    };
  }
}

/**
 * Verify a payment/checkout session
 */
export async function verifyPayment(
  sessionId: string
): Promise<VerifyResponse> {
  try {
    const response = await fetch(
      `${PAYMENT_SERVER_URL}/api/payments/verify/${sessionId}`
    );

    const data = await response.json();

    if (!response.ok) {
      return {
        success: false,
        error: data.error || "Verification failed",
      };
    }

    return {
      success: data.success,
      status: data.status,
      tier: data.tier,
      userId: data.userId,
    };
  } catch (error) {
    console.error("[Payment API] Verify error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Network error",
    };
  }
}

/**
 * Expire a checkout session
 */
export async function expireSession(
  sessionId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const response = await fetch(
      `${PAYMENT_SERVER_URL}/api/payments/expire/${sessionId}`,
      {
        method: "POST",
      }
    );

    if (!response.ok) {
      const data = await response.json();
      return {
        success: false,
        error: data.error || "Failed to expire session",
      };
    }

    return { success: true };
  } catch (error) {
    console.error("[Payment API] Expire error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Network error",
    };
  }
}
