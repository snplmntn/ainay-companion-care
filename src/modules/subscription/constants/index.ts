import type { SubscriptionPlan, SubscriptionTier, FeatureKey } from "../types";

// PayRex API Configuration
// Docs: https://docs.payrexhq.com/
export const PAYREX_CONFIG = {
  // API base URL (same for test and live)
  API_BASE_URL: "https://api.payrexhq.com",
  // Test mode uses sk_test_ prefix, live uses sk_live_ prefix
  // This should be set in environment variables
  SECRET_KEY: import.meta.env.VITE_PAYREX_SECRET_KEY || "",
  PUBLIC_KEY: import.meta.env.VITE_PAYREX_PUBLIC_KEY || "",
  // Test mode indicator
  IS_TEST_MODE: true,
};

// Subscription Plans Configuration
export const SUBSCRIPTION_PLANS: SubscriptionPlan[] = [
  {
    id: "free",
    name: "Free",
    description: "Start tracking your medicines for free",
    price: 0,
    priceInCents: 0,
    interval: "monthly",
    features: [
      "Track up to 5 medicines",
      "Get reminders for your doses",
      "Chat with AInay anytime",
      "See your daily medicine list",
      "Daily health updates", // Enabled for hackathon demo
    ],
    limitations: [
      "Can't scan prescriptions",
      "No voice features",
    ],
  },
  {
    id: "pro",
    name: "Pro",
    description: "Get all features for better care",
    price: 99,
    priceInCents: 9900, // 99 pesos in centavos
    interval: "monthly",
    features: [
      "Add as many medicines as you need",
      "Scan your prescriptions with your camera",
      "Talk in Tagalog or English",
      "Daily health updates",
      "Smart reminders that work for you",
      "See how you're doing over time",
      "Fast help when you need it",
    ],
    isPopular: true,
  },
  {
    id: "enterprise",
    name: "Enterprise",
    description: "For hospitals and clinics",
    price: 0, // Custom pricing
    priceInCents: 0,
    interval: "custom",
    features: [
      "Everything in Pro",
      "Your own branding",
      "Manage many patients",
      "Admin controls",
      "Connect to your systems",
      "Personal account manager",
      "Custom setup",
      "Guaranteed uptime",
    ],
    isContactUs: true,
  },
];

// Feature access matrix by tier
// Note: morning_briefing is enabled for free tier for hackathon demo
export const FEATURE_ACCESS: Record<FeatureKey, SubscriptionTier[]> = {
  prescription_scan: ["pro", "enterprise"],
  voice_assistance: ["pro", "enterprise"],
  morning_briefing: ["free", "pro", "enterprise"], // Enabled for free tier for hackathon demo
  unlimited_medications: ["pro", "enterprise"],
  priority_support: ["pro", "enterprise"],
  analytics_dashboard: ["pro", "enterprise"],
  family_sharing: ["enterprise"],
  custom_branding: ["enterprise"],
};

// Maximum medications for free tier
export const FREE_TIER_MAX_MEDICATIONS = 5;

// Helper function to check feature access
export function hasFeatureAccess(
  tier: SubscriptionTier,
  feature: FeatureKey
): boolean {
  const allowedTiers = FEATURE_ACCESS[feature];
  return allowedTiers.includes(tier);
}

// Helper function to get required tier for feature
export function getRequiredTier(feature: FeatureKey): SubscriptionTier {
  const allowedTiers = FEATURE_ACCESS[feature];
  if (allowedTiers.includes("free")) return "free";
  if (allowedTiers.includes("pro")) return "pro";
  return "enterprise";
}

// Helper function to get plan by tier
export function getPlanByTier(tier: SubscriptionTier): SubscriptionPlan {
  return (
    SUBSCRIPTION_PLANS.find((plan) => plan.id === tier) || SUBSCRIPTION_PLANS[0]
  );
}

// Test card numbers for PayRex testing
export const PAYREX_TEST_CARDS = {
  visa_success: "4242424242424242",
  visa_decline: "4000000000000002",
  mastercard_success: "5555555555554444",
  // Use any future expiry date and any 3-digit CVC
};

