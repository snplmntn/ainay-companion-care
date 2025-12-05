// Types
export * from "./types";

// Constants
export * from "./constants";

// Hooks
export { useSubscription } from "./hooks/useSubscription";
export type { UseSubscriptionReturn } from "./hooks/useSubscription";

// Components
export { PricingCard } from "./components/PricingCard";
export {
  FeatureGate,
  LockedBadge,
  useFeatureAccess,
} from "./components/FeatureGate";
export {
  SubscriptionCard,
  SubscriptionBadge,
} from "./components/SubscriptionCard";

// Services - PayRex (direct API calls - for backend use)
export {
  createCheckoutSession,
  getCheckoutSession,
  expireCheckoutSession,
  createProSubscriptionCheckout,
  verifyCheckoutSuccess,
  isPayRexConfigured,
  getPayRexModeMessage,
} from "./services/payrex";

// Services - Payment API (calls backend server)
export {
  createCheckout,
  verifyPayment as verifyPaymentSession,
  getPaymentStatus,
  isPaymentServerAvailable,
  expireSession,
  lookupSessionByTxnRef,
} from "./services/paymentApi";

export {
  getUserSubscription,
  createFreeSubscription,
  upgradeSubscription,
  cancelSubscription,
  downgradeToFree,
  recordPayment,
  getPaymentHistory,
  updatePaymentStatus,
  isSubscriptionActive,
  getEffectiveTier,
} from "./services/subscription";
