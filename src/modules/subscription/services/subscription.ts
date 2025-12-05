import { supabase } from "@/lib/supabase";
import type { DbSubscription, DbPaymentHistory } from "@/types/database";
import type { SubscriptionTier, SubscriptionStatus } from "../types";

/**
 * Subscription Service
 * Handles subscription-related database operations
 */

// ============ LOCAL STORAGE HELPERS (for demo mode) ============

const DEMO_SUBSCRIPTION_KEY = "ainay_demo_subscription";

function getDemoSubscription(): DbSubscription | null {
  try {
    const stored = localStorage.getItem(DEMO_SUBSCRIPTION_KEY);
    if (stored) {
      return JSON.parse(stored);
    }
  } catch (e) {
    console.warn("Failed to read demo subscription from localStorage", e);
  }
  return null;
}

function setDemoSubscription(subscription: DbSubscription): void {
  try {
    localStorage.setItem(DEMO_SUBSCRIPTION_KEY, JSON.stringify(subscription));
  } catch (e) {
    console.warn("Failed to save demo subscription to localStorage", e);
  }
}

function createDefaultDemoSubscription(userId: string): DbSubscription {
  return {
    id: "demo",
    user_id: userId,
    tier: "free",
    status: "active",
    current_period_start: new Date().toISOString(),
    current_period_end: null,
    payrex_checkout_id: null,
    payrex_payment_id: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
}

// ============ GET SUBSCRIPTION ============

/**
 * Get user's current subscription
 */
export async function getUserSubscription(
  userId: string
): Promise<{ subscription: DbSubscription | null; error: string | null }> {
  if (!supabase) {
    // Demo mode - use localStorage
    const demoSub = getDemoSubscription();
    if (demoSub) {
      return { subscription: demoSub, error: null };
    }

    // Create default free subscription
    const defaultSub = createDefaultDemoSubscription(userId);
    setDemoSubscription(defaultSub);
    return { subscription: defaultSub, error: null };
  }

  const { data, error } = await supabase
    .from("subscriptions")
    .select("*")
    .eq("user_id", userId)
    .single();

  if (error && error.code !== "PGRST116") {
    // PGRST116 = no rows returned
    return { subscription: null, error: error.message };
  }

  // If no subscription exists, create a free one
  if (!data) {
    const { subscription, error: createError } = await createFreeSubscription(
      userId
    );
    return { subscription, error: createError };
  }

  return { subscription: data, error: null };
}

/**
 * Create a free subscription for a user
 */
export async function createFreeSubscription(
  userId: string
): Promise<{ subscription: DbSubscription | null; error: string | null }> {
  if (!supabase) {
    const freeSub = createDefaultDemoSubscription(userId);
    setDemoSubscription(freeSub);
    return { subscription: freeSub, error: null };
  }

  const { data, error } = await supabase
    .from("subscriptions")
    .insert({
      user_id: userId,
      tier: "free",
      status: "active",
    })
    .select()
    .single();

  return { subscription: data, error: error?.message ?? null };
}

// ============ UPDATE SUBSCRIPTION ============

/**
 * Upgrade subscription to a paid tier
 */
export async function upgradeSubscription(
  userId: string,
  tier: SubscriptionTier,
  payrexCheckoutId: string,
  payrexPaymentId?: string
): Promise<{ subscription: DbSubscription | null; error: string | null }> {
  if (!supabase) {
    // Demo mode - save to localStorage
    const upgradedSub: DbSubscription = {
      id: "demo-upgraded",
      user_id: userId,
      tier,
      status: "active",
      current_period_start: new Date().toISOString(),
      current_period_end: getNextMonthDate(),
      payrex_checkout_id: payrexCheckoutId,
      payrex_payment_id: payrexPaymentId ?? null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    setDemoSubscription(upgradedSub);
    return { subscription: upgradedSub, error: null };
  }

  // Calculate period end (1 month from now for monthly subscription)
  const periodEnd = getNextMonthDate();

  const { data, error } = await supabase
    .from("subscriptions")
    .update({
      tier,
      status: "active",
      current_period_start: new Date().toISOString(),
      current_period_end: periodEnd,
      payrex_checkout_id: payrexCheckoutId,
      payrex_payment_id: payrexPaymentId,
      updated_at: new Date().toISOString(),
    })
    .eq("user_id", userId)
    .select()
    .single();

  return { subscription: data, error: error?.message ?? null };
}

/**
 * Cancel subscription (downgrade to free at period end)
 */
export async function cancelSubscription(
  userId: string
): Promise<{ error: string | null }> {
  if (!supabase) {
    return { error: null };
  }

  const { error } = await supabase
    .from("subscriptions")
    .update({
      status: "cancelled",
      updated_at: new Date().toISOString(),
    })
    .eq("user_id", userId);

  return { error: error?.message ?? null };
}

/**
 * Downgrade subscription to free immediately
 */
export async function downgradeToFree(
  userId: string
): Promise<{ error: string | null }> {
  if (!supabase) {
    // Demo mode - reset to free in localStorage
    const freeSub = createDefaultDemoSubscription(userId);
    setDemoSubscription(freeSub);
    return { error: null };
  }

  const { error } = await supabase
    .from("subscriptions")
    .update({
      tier: "free",
      status: "active",
      current_period_end: null,
      payrex_checkout_id: null,
      payrex_payment_id: null,
      updated_at: new Date().toISOString(),
    })
    .eq("user_id", userId);

  return { error: error?.message ?? null };
}

// ============ PAYMENT HISTORY ============

/**
 * Record a payment in history
 */
export async function recordPayment(
  userId: string,
  subscriptionId: string | null,
  amount: number,
  status: DbPaymentHistory["status"],
  payrexCheckoutId: string,
  payrexPaymentId?: string,
  description?: string
): Promise<{ payment: DbPaymentHistory | null; error: string | null }> {
  if (!supabase) {
    return {
      payment: {
        id: "demo-payment",
        user_id: userId,
        subscription_id: subscriptionId,
        amount,
        currency: "PHP",
        status,
        payrex_checkout_id: payrexCheckoutId,
        payrex_payment_id: payrexPaymentId ?? null,
        payment_method: null,
        description: description ?? null,
        metadata: null,
        created_at: new Date().toISOString(),
      },
      error: null,
    };
  }

  const { data, error } = await supabase
    .from("payment_history")
    .insert({
      user_id: userId,
      subscription_id: subscriptionId,
      amount,
      status,
      payrex_checkout_id: payrexCheckoutId,
      payrex_payment_id: payrexPaymentId,
      description,
    })
    .select()
    .single();

  return { payment: data, error: error?.message ?? null };
}

/**
 * Get user's payment history
 */
export async function getPaymentHistory(
  userId: string
): Promise<{ payments: DbPaymentHistory[]; error: string | null }> {
  if (!supabase) {
    return { payments: [], error: null };
  }

  const { data, error } = await supabase
    .from("payment_history")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  return { payments: data ?? [], error: error?.message ?? null };
}

/**
 * Update payment status
 */
export async function updatePaymentStatus(
  paymentId: string,
  status: DbPaymentHistory["status"],
  payrexPaymentId?: string
): Promise<{ error: string | null }> {
  if (!supabase) {
    return { error: null };
  }

  const updates: Partial<DbPaymentHistory> = { status };
  if (payrexPaymentId) {
    updates.payrex_payment_id = payrexPaymentId;
  }

  const { error } = await supabase
    .from("payment_history")
    .update(updates)
    .eq("id", paymentId);

  return { error: error?.message ?? null };
}

// ============ HELPERS ============

/**
 * Get date one month from now
 */
function getNextMonthDate(): string {
  const date = new Date();
  date.setMonth(date.getMonth() + 1);
  return date.toISOString();
}

/**
 * Check if subscription is active
 */
export function isSubscriptionActive(
  subscription: DbSubscription | null
): boolean {
  if (!subscription) return false;

  if (subscription.status !== "active" && subscription.status !== "trialing") {
    return false;
  }

  // Check if period has ended
  if (subscription.current_period_end) {
    const endDate = new Date(subscription.current_period_end);
    if (endDate < new Date()) {
      return false;
    }
  }

  return true;
}

/**
 * Get effective tier (considering cancelled status)
 */
export function getEffectiveTier(
  subscription: DbSubscription | null
): SubscriptionTier {
  if (!subscription) return "free";

  // If cancelled but still in period, keep the tier
  if (subscription.status === "cancelled" && subscription.current_period_end) {
    const endDate = new Date(subscription.current_period_end);
    if (endDate > new Date()) {
      return subscription.tier as SubscriptionTier;
    }
    return "free";
  }

  if (!isSubscriptionActive(subscription)) {
    return "free";
  }

  return subscription.tier as SubscriptionTier;
}
