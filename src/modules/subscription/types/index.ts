// Subscription tier types
export type SubscriptionTier = "free" | "pro" | "enterprise";

// Subscription status types
export type SubscriptionStatus =
  | "active"
  | "cancelled"
  | "past_due"
  | "trialing"
  | "inactive";

// Feature keys for access control
export type FeatureKey =
  | "prescription_scan"
  | "voice_assistance"
  | "morning_briefing"
  | "unlimited_medications"
  | "priority_support"
  | "analytics_dashboard"
  | "family_sharing"
  | "custom_branding";

// Subscription plan definition
export interface SubscriptionPlan {
  id: SubscriptionTier;
  name: string;
  description: string;
  price: number;
  priceInCents: number;
  interval: "monthly" | "yearly" | "custom";
  features: string[];
  limitations?: string[];
  isPopular?: boolean;
  isContactUs?: boolean;
}

// PayRex checkout session types
export interface PayRexCheckoutSession {
  id: string;
  url: string;
  status: string;
  currency: string;
  amount: number;
  metadata?: Record<string, string>;
  created_at: string;
}

export interface CreateCheckoutSessionParams {
  line_items: Array<{
    name: string;
    amount: number;
    quantity: number;
    description?: string;
  }>;
  success_url: string;
  cancel_url: string;
  customer_reference_id?: string;
  description?: string;
  metadata?: Record<string, string>;
  payment_methods?: string[];
}


