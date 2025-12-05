import { useState, useEffect, useCallback } from "react";
import { useApp } from "@/contexts/AppContext";
import type { DbSubscription } from "@/types/database";
import type { SubscriptionTier, FeatureKey } from "../types";
import {
  getUserSubscription,
  upgradeSubscription,
  cancelSubscription,
  downgradeToFree,
  getEffectiveTier,
  isSubscriptionActive,
  recordPayment,
} from "../services/subscription";
import {
  createCheckout,
  verifyPayment as verifyPaymentApi,
  getPaymentStatus,
  isPaymentServerAvailable,
} from "../services/paymentApi";
import {
  hasFeatureAccess,
  getRequiredTier,
  getPlanByTier,
  FREE_TIER_MAX_MEDICATIONS,
} from "../constants";

export interface UseSubscriptionReturn {
  // State
  subscription: DbSubscription | null;
  tier: SubscriptionTier;
  isLoading: boolean;
  error: string | null;

  // Computed
  isPro: boolean;
  isEnterprise: boolean;
  isFree: boolean;
  isActive: boolean;
  canUpgrade: boolean;
  daysUntilRenewal: number | null;
  isPayRexConfigured: boolean;

  // Feature access
  hasFeature: (feature: FeatureKey) => boolean;
  getFeatureRequiredTier: (feature: FeatureKey) => SubscriptionTier;
  canAddMoreMedications: (currentCount: number) => boolean;

  // Actions
  startProCheckout: () => Promise<{ success: boolean; error?: string }>;
  simulateProUpgrade: () => Promise<{ success: boolean; error?: string }>;
  verifyPayment: (
    sessionId: string
  ) => Promise<{ success: boolean; error?: string }>;
  cancelSubscription: () => Promise<{ success: boolean; error?: string }>;
  downgradeToFree: () => Promise<{ success: boolean; error?: string }>;
  refreshSubscription: () => Promise<void>;
}

export function useSubscription(): UseSubscriptionReturn {
  const { user, isAuthenticated } = useApp();
  const [subscription, setSubscription] = useState<DbSubscription | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [paymentServerStatus, setPaymentServerStatus] = useState<{
    configured: boolean;
    mode: string;
  }>({ configured: false, mode: "unconfigured" });

  // Derived state
  const tier = getEffectiveTier(subscription);
  const isActive = isSubscriptionActive(subscription);
  const isPro = tier === "pro";
  const isEnterprise = tier === "enterprise";
  const isFree = tier === "free";
  const payRexConfigured = paymentServerStatus.configured;
  const canUpgrade = isFree; // Allow upgrade even without PayRex (demo mode)

  // Check payment server status on mount
  useEffect(() => {
    const checkPaymentServer = async () => {
      const status = await getPaymentStatus();
      setPaymentServerStatus({
        configured: status.configured,
        mode: status.mode,
      });
    };
    checkPaymentServer();
  }, []);

  // Calculate days until renewal
  const daysUntilRenewal = subscription?.current_period_end
    ? Math.ceil(
        (new Date(subscription.current_period_end).getTime() - Date.now()) /
          (1000 * 60 * 60 * 24)
      )
    : null;

  // Load subscription on mount
  const loadSubscription = useCallback(async () => {
    if (!user?.id) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    const { subscription: sub, error: err } = await getUserSubscription(
      user.id
    );

    if (err) {
      setError(err);
    } else {
      setSubscription(sub);
    }

    setIsLoading(false);
  }, [user?.id]);

  useEffect(() => {
    if (isAuthenticated) {
      loadSubscription();
    } else {
      setSubscription(null);
      setIsLoading(false);
    }
  }, [isAuthenticated, loadSubscription]);

  // Feature access check
  const hasFeature = useCallback(
    (feature: FeatureKey): boolean => {
      return hasFeatureAccess(tier, feature);
    },
    [tier]
  );

  // Get required tier for a feature
  const getFeatureRequiredTier = useCallback(
    (feature: FeatureKey): SubscriptionTier => {
      return getRequiredTier(feature);
    },
    []
  );

  // Check if user can add more medications
  const canAddMoreMedications = useCallback(
    (currentCount: number): boolean => {
      if (isPro || isEnterprise) return true;
      return currentCount < FREE_TIER_MAX_MEDICATIONS;
    },
    [isPro, isEnterprise]
  );

  // Start Pro checkout via backend API
  const startProCheckout = useCallback(async () => {
    if (!user?.id) {
      return { success: false, error: "User not authenticated" };
    }

    // Check if payment server is available
    const isAvailable = await isPaymentServerAvailable();
    if (!isAvailable) {
      return {
        success: false,
        error: "Payment server not available. Please start the server.",
      };
    }

    const baseUrl = window.location.origin;
    // Don't use placeholder - PayRex doesn't replace it
    // We'll store the session ID in localStorage instead
    const successUrl = `${baseUrl}/subscription/success`;
    const cancelUrl = `${baseUrl}/subscription/pricing`;

    // Clear any old session ID before starting new checkout
    localStorage.removeItem("payrex_session_id");
    localStorage.removeItem("payrex_user_id");

    // Call backend API to create checkout
    const result = await createCheckout(user.id, successUrl, cancelUrl);

    if (!result.success || !result.checkoutUrl) {
      return {
        success: false,
        error: result.error || "Failed to create checkout",
      };
    }

    // Store session ID and txnRef in localStorage for verification after redirect
    // This is a backup in case the URL params don't work
    if (result.sessionId) {
      console.log("[Checkout] Storing session ID:", result.sessionId);
      console.log("[Checkout] Transaction ref:", result.txnRef);
      localStorage.setItem("payrex_session_id", result.sessionId);
      localStorage.setItem("payrex_user_id", user.id);
      if (result.txnRef) {
        localStorage.setItem("payrex_txn_ref", result.txnRef);
      }

      await recordPayment(
        user.id,
        subscription?.id ?? null,
        9900, // Pro plan price in centavos
        "pending",
        result.sessionId,
        undefined,
        "Pro Subscription"
      );
    }

    // Redirect to PayRex checkout
    window.location.href = result.checkoutUrl;

    return { success: true };
  }, [user?.id, subscription?.id]);

  // Verify payment after checkout via backend API
  const verifyPayment = useCallback(
    async (sessionId: string) => {
      if (!user?.id) {
        return { success: false, error: "User not authenticated" };
      }

      // Verify payment with backend
      const verifyResult = await verifyPaymentApi(sessionId);

      if (!verifyResult.success) {
        return {
          success: false,
          error: verifyResult.error || "Payment verification failed",
        };
      }

      const paidTier = (verifyResult.tier as SubscriptionTier) || "pro";

      // Upgrade subscription locally
      const { subscription: updatedSub, error: upgradeError } =
        await upgradeSubscription(user.id, paidTier, sessionId);

      if (upgradeError) {
        return { success: false, error: upgradeError };
      }

      setSubscription(updatedSub);

      return { success: true };
    },
    [user?.id]
  );

  // Simulate Pro upgrade (demo mode - no actual payment)
  const simulateProUpgrade = useCallback(async () => {
    if (!user?.id) {
      return { success: false, error: "User not authenticated" };
    }

    // Create a demo checkout session ID
    const demoSessionId = `demo_${Date.now()}_${Math.random()
      .toString(36)
      .substring(7)}`;

    // Upgrade subscription directly
    const { subscription: updatedSub, error: upgradeError } =
      await upgradeSubscription(
        user.id,
        "pro",
        demoSessionId,
        `demo_payment_${Date.now()}`
      );

    if (upgradeError) {
      return { success: false, error: upgradeError };
    }

    setSubscription(updatedSub);

    return { success: true };
  }, [user?.id]);

  // Cancel subscription
  const handleCancelSubscription = useCallback(async () => {
    if (!user?.id) {
      return { success: false, error: "User not authenticated" };
    }

    const { error } = await cancelSubscription(user.id);

    if (error) {
      return { success: false, error };
    }

    await loadSubscription();

    return { success: true };
  }, [user?.id, loadSubscription]);

  // Downgrade to free
  const handleDowngradeToFree = useCallback(async () => {
    if (!user?.id) {
      return { success: false, error: "User not authenticated" };
    }

    const { error } = await downgradeToFree(user.id);

    if (error) {
      return { success: false, error };
    }

    await loadSubscription();

    return { success: true };
  }, [user?.id, loadSubscription]);

  return {
    subscription,
    tier,
    isLoading,
    error,
    isPro,
    isEnterprise,
    isFree,
    isActive,
    canUpgrade,
    daysUntilRenewal,
    isPayRexConfigured: payRexConfigured,
    hasFeature,
    getFeatureRequiredTier,
    canAddMoreMedications,
    startProCheckout,
    simulateProUpgrade,
    verifyPayment,
    cancelSubscription: handleCancelSubscription,
    downgradeToFree: handleDowngradeToFree,
    refreshSubscription: loadSubscription,
  };
}
