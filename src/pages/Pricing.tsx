import React, { useState, useEffect } from "react";
import {
  ArrowLeft,
  Shield,
  Zap,
  CreditCard,
  Sparkles,
  CheckCircle,
  AlertCircle,
  Check,
  X,
  Crown,
  Heart,
  Building2,
  Star,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Navigation } from "@/components/Navigation";
import {
  useSubscription,
  SUBSCRIPTION_PLANS,
  isPaymentServerAvailable,
} from "@/modules/subscription";
import type { SubscriptionTier } from "@/modules/subscription";
import { toast } from "@/hooks/use-toast";
import confetti from "canvas-confetti";
import { cn } from "@/lib/utils";

// Feature comparison data for the table
const FEATURE_COMPARISON = [
  {
    name: "Track Medicines",
    free: "Up to 5",
    pro: "Unlimited",
    enterprise: "Unlimited",
  },
  { name: "Dose Reminders", free: true, pro: true, enterprise: true },
  { name: "Chat with AInay", free: true, pro: true, enterprise: true },
  { name: "Daily Medicine List", free: true, pro: true, enterprise: true },
  { name: "Daily Health Updates", free: true, pro: true, enterprise: true },
  { name: "Scan Prescriptions", free: false, pro: true, enterprise: true },
  { name: "Voice Features", free: false, pro: true, enterprise: true },
  { name: "Tagalog & English", free: false, pro: true, enterprise: true },
  { name: "Progress Analytics", free: false, pro: true, enterprise: true },
  { name: "Priority Support", free: false, pro: true, enterprise: true },
  { name: "Custom Branding", free: false, pro: false, enterprise: true },
  {
    name: "Multi-Patient Management",
    free: false,
    pro: false,
    enterprise: true,
  },
  { name: "Admin Controls", free: false, pro: false, enterprise: true },
  { name: "API Integration", free: false, pro: false, enterprise: true },
];

export default function Pricing() {
  const navigate = useNavigate();
  const { tier, startProCheckout, simulateProUpgrade, downgradeToFree, isPro } =
    useSubscription();
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [serverAvailable, setServerAvailable] = useState<boolean | null>(null);
  const [showComparison, setShowComparison] = useState(false);

  // Check if payment server is running
  useEffect(() => {
    const checkServer = async () => {
      const available = await isPaymentServerAvailable();
      setServerAvailable(available);
    };
    checkServer();
  }, []);

  const handleSelectPlan = async (selectedTier: SubscriptionTier) => {
    // Prevent multiple clicks
    if (checkoutLoading) return;

    if (selectedTier === "free") {
      if (isPro) {
        // Downgrade to free
        setCheckoutLoading(true);
        try {
          const result = await downgradeToFree();

          if (result.success) {
            toast({
              title: "Downgraded to Free",
              description: "You've been downgraded to the free plan.",
            });
          } else {
            setError(result.error || "Failed to downgrade");
          }
        } finally {
          setCheckoutLoading(false);
        }
      }
      return;
    }

    if (selectedTier === "pro") {
      setError(null);
      setCheckoutLoading(true);

      try {
        // Try real checkout if payment server is available
        if (serverAvailable) {
          const result = await startProCheckout();

          if (!result.success) {
            // If server checkout fails, offer demo mode
            setError(
              `${result.error}. Would you like to try demo mode instead?`
            );
          }
          // If successful, user will be redirected to PayRex checkout
          return;
        }

        // Demo mode: Simulate upgrade (no payment server)
        const result = await simulateProUpgrade();

        if (result.success) {
          // Celebration!
          confetti({
            particleCount: 100,
            spread: 70,
            origin: { y: 0.6 },
            colors: ["#FF6B6B", "#4ECDC4", "#FFE66D", "#95E1D3"],
          });

          toast({
            title: "🎉 Welcome to Pro!",
            description:
              "Upgrade successful! All Pro features are now unlocked.",
          });

          // Navigate to dashboard after celebration
          setTimeout(() => {
            navigate("/dashboard");
          }, 1500);
        } else {
          setError(result.error || "Failed to upgrade");
        }
      } finally {
        setCheckoutLoading(false);
      }
    }
  };

  const handleContactUs = () => {
    // Open email or contact form
    window.location.href =
      "mailto:enterprise@ainay.care?subject=Enterprise%20Plan%20Inquiry";
  };

  const isCurrentPlan = (planId: SubscriptionTier) => tier === planId;

  const getButtonText = (planId: SubscriptionTier) => {
    if (isCurrentPlan(planId)) return "Your Current Plan";
    if (planId === "enterprise") return "Contact Sales";
    if (tier === "free" && planId === "pro") return "Upgrade to Pro";
    if (tier === "pro" && planId === "free") return "Downgrade";
    return "Get Started";
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 via-white to-slate-50 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 pb-24 lg:pb-8 lg:ml-20 xl:ml-24">
      {/* Header */}
      <header className="relative overflow-hidden bg-gradient-to-br from-coral-500 via-coral-600 to-rose-600 text-white px-6 py-10 rounded-b-[2.5rem]">
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9IiNmZmZmZmYiIGZpbGwtb3BhY2l0eT0iMC4xIj48cGF0aCBkPSJNMzYgMzRjMC0yLjIxLTEuNzktNC00LTRzLTQgMS43OS00IDQgMS43OSA0IDQgNCA0LTEuNzkgNC00eiIvPjwvZz48L2c+PC9zdmc+')] opacity-30"></div>
        <div className="relative">
          <div className="flex items-center gap-4 mb-6">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate(-1)}
              className="text-white hover:bg-white/20 rounded-full"
            >
              <ArrowLeft className="w-6 h-6" />
            </Button>
            <div>
              <h1 className="text-3xl font-bold tracking-tight">
                Choose Your Plan
              </h1>
              <p className="text-white/80 text-base mt-1">
                Simple pricing, powerful care
              </p>
            </div>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="px-4 sm:px-6 -mt-6 relative z-10">
        {/* Alerts Section */}
        <div className="space-y-3 mb-6">
          {serverAvailable === false && (
            <Alert className="bg-emerald-50 border-emerald-200 dark:bg-emerald-950/30 dark:border-emerald-800 shadow-sm">
              <Sparkles className="h-4 w-4 text-emerald-600" />
              <AlertDescription className="text-emerald-800 dark:text-emerald-200">
                <strong>🚀 Demo Mode:</strong> Click "Upgrade to Pro" to
                instantly unlock all features!
              </AlertDescription>
            </Alert>
          )}

          {isPro && (
            <Alert className="bg-gradient-to-r from-primary/10 to-secondary/10 border-primary/30 shadow-sm">
              <CheckCircle className="h-4 w-4 text-primary" />
              <AlertDescription className="text-primary font-medium">
                <strong>You're on Pro!</strong> You have access to all premium
                features.
              </AlertDescription>
            </Alert>
          )}

          {error && (
            <Alert variant="destructive" className="shadow-sm">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
        </div>

        {/* Value Props Strip */}
        <div className="flex gap-2 overflow-x-auto pb-2 mb-6 scrollbar-hide">
          <div className="flex items-center gap-2 px-4 py-2.5 bg-white dark:bg-slate-800 rounded-full shadow-sm border whitespace-nowrap">
            <Shield className="w-4 h-4 text-emerald-500" />
            <span className="text-sm font-medium">Secure & Private</span>
          </div>
          <div className="flex items-center gap-2 px-4 py-2.5 bg-white dark:bg-slate-800 rounded-full shadow-sm border whitespace-nowrap">
            <Zap className="w-4 h-4 text-amber-500" />
            <span className="text-sm font-medium">Instant Access</span>
          </div>
          <div className="flex items-center gap-2 px-4 py-2.5 bg-white dark:bg-slate-800 rounded-full shadow-sm border whitespace-nowrap">
            <Heart className="w-4 h-4 text-rose-500" />
            <span className="text-sm font-medium">Cancel Anytime</span>
          </div>
        </div>

        {/* Pricing Cards - Grid Layout */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6 mb-8">
          {/* Free Plan */}
          <div
            className={cn(
              "relative bg-white dark:bg-slate-800 rounded-2xl p-6 shadow-lg border-2 transition-all duration-300 flex flex-col",
              isCurrentPlan("free")
                ? "border-emerald-500 ring-2 ring-emerald-500/20"
                : "border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600"
            )}
          >
            {isCurrentPlan("free") && (
              <div className="absolute -top-3 left-4">
                <span className="inline-flex items-center gap-1 px-3 py-1 bg-emerald-500 text-white text-xs font-semibold rounded-full shadow-sm">
                  <Check className="w-3 h-3" /> Current Plan
                </span>
              </div>
            )}

            <div className="mb-6">
              <div className="w-12 h-12 rounded-xl bg-slate-100 dark:bg-slate-700 flex items-center justify-center mb-4">
                <Heart className="w-6 h-6 text-slate-600 dark:text-slate-300" />
              </div>
              <h3 className="text-xl font-bold text-slate-900 dark:text-white">
                Free
              </h3>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                Perfect to get started
              </p>
            </div>

            <div className="mb-6">
              <div className="flex items-baseline gap-1">
                <span className="text-4xl font-bold text-slate-900 dark:text-white">
                  ₱0
                </span>
                <span className="text-slate-500 dark:text-slate-400">
                  /month
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-1">Free forever</p>
            </div>

            <div className="space-y-3 mb-6 flex-1">
              <div className="flex items-start gap-3">
                <Check className="w-5 h-5 text-emerald-500 shrink-0 mt-0.5" />
                <span className="text-sm text-slate-700 dark:text-slate-300">
                  Track up to 5 medicines
                </span>
              </div>
              <div className="flex items-start gap-3">
                <Check className="w-5 h-5 text-emerald-500 shrink-0 mt-0.5" />
                <span className="text-sm text-slate-700 dark:text-slate-300">
                  Dose reminders
                </span>
              </div>
              <div className="flex items-start gap-3">
                <Check className="w-5 h-5 text-emerald-500 shrink-0 mt-0.5" />
                <span className="text-sm text-slate-700 dark:text-slate-300">
                  Chat with AInay
                </span>
              </div>
              <div className="flex items-start gap-3">
                <Check className="w-5 h-5 text-emerald-500 shrink-0 mt-0.5" />
                <span className="text-sm text-slate-700 dark:text-slate-300">
                  Daily health updates
                </span>
              </div>
              <div className="flex items-start gap-3 opacity-50">
                <X className="w-5 h-5 text-slate-400 shrink-0 mt-0.5" />
                <span className="text-sm text-slate-500 line-through">
                  Prescription scanning
                </span>
              </div>
              <div className="flex items-start gap-3 opacity-50">
                <X className="w-5 h-5 text-slate-400 shrink-0 mt-0.5" />
                <span className="text-sm text-slate-500 line-through">
                  Voice features
                </span>
              </div>
            </div>

            <Button
              variant="outline"
              size="lg"
              className="w-full font-semibold"
              disabled={isCurrentPlan("free") || checkoutLoading}
              onClick={() => handleSelectPlan("free")}
            >
              {getButtonText("free")}
            </Button>
          </div>

          {/* Pro Plan - Featured */}
          <div
            className={cn(
              "relative bg-gradient-to-b from-coral-50 to-white dark:from-coral-950/30 dark:to-slate-800 rounded-2xl p-6 shadow-xl border-2 transition-all duration-300 flex flex-col",
              isCurrentPlan("pro")
                ? "border-primary ring-2 ring-primary/30"
                : "border-primary/50 hover:border-primary md:scale-105 md:-my-4"
            )}
          >
            <div className="absolute -top-3 left-1/2 -translate-x-1/2">
              <span className="inline-flex items-center gap-1.5 px-4 py-1.5 bg-gradient-to-r from-primary to-secondary text-white text-sm font-semibold rounded-full shadow-lg">
                <Star className="w-4 h-4" /> Best Value
              </span>
            </div>
            {isCurrentPlan("pro") && (
              <div className="absolute -top-3 right-4">
                <span className="inline-flex items-center gap-1 px-3 py-1 bg-emerald-500 text-white text-xs font-semibold rounded-full shadow-sm">
                  <Check className="w-3 h-3" /> Current
                </span>
              </div>
            )}

            <div className="mb-6 mt-2">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary to-secondary flex items-center justify-center mb-4 shadow-lg">
                <Crown className="w-6 h-6 text-white" />
              </div>
              <h3 className="text-xl font-bold text-slate-900 dark:text-white">
                Pro
              </h3>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                Complete care companion
              </p>
            </div>

            <div className="mb-6">
              <div className="flex items-baseline gap-1">
                <span className="text-lg text-slate-500">₱</span>
                <span className="text-4xl font-bold text-slate-900 dark:text-white">
                  99
                </span>
                <span className="text-slate-500 dark:text-slate-400">
                  /month
                </span>
              </div>
              <p className="text-xs text-emerald-600 font-medium mt-1">
                Less than ₱4/day!
              </p>
            </div>

            <div className="space-y-3 mb-6 flex-1">
              <div className="flex items-start gap-3">
                <Check className="w-5 h-5 text-primary shrink-0 mt-0.5" />
                <span className="text-sm text-slate-700 dark:text-slate-300 font-medium">
                  Unlimited medicines
                </span>
              </div>
              <div className="flex items-start gap-3">
                <Check className="w-5 h-5 text-primary shrink-0 mt-0.5" />
                <span className="text-sm text-slate-700 dark:text-slate-300">
                  Scan prescriptions with camera
                </span>
              </div>
              <div className="flex items-start gap-3">
                <Check className="w-5 h-5 text-primary shrink-0 mt-0.5" />
                <span className="text-sm text-slate-700 dark:text-slate-300">
                  Voice in Tagalog & English
                </span>
              </div>
              <div className="flex items-start gap-3">
                <Check className="w-5 h-5 text-primary shrink-0 mt-0.5" />
                <span className="text-sm text-slate-700 dark:text-slate-300">
                  Smart adaptive reminders
                </span>
              </div>
              <div className="flex items-start gap-3">
                <Check className="w-5 h-5 text-primary shrink-0 mt-0.5" />
                <span className="text-sm text-slate-700 dark:text-slate-300">
                  Progress analytics
                </span>
              </div>
              <div className="flex items-start gap-3">
                <Check className="w-5 h-5 text-primary shrink-0 mt-0.5" />
                <span className="text-sm text-slate-700 dark:text-slate-300">
                  Priority support
                </span>
              </div>
            </div>

            <Button
              size="lg"
              className="w-full font-semibold bg-gradient-to-r from-primary to-secondary hover:opacity-90 shadow-lg"
              disabled={isCurrentPlan("pro") || checkoutLoading}
              onClick={() => handleSelectPlan("pro")}
            >
              {checkoutLoading ? (
                <span className="flex items-center gap-2">
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Processing...
                </span>
              ) : (
                getButtonText("pro")
              )}
            </Button>
          </div>

          {/* Enterprise Plan */}
          <div
            className={cn(
              "relative bg-gradient-to-b from-amber-50/50 to-white dark:from-amber-950/20 dark:to-slate-800 rounded-2xl p-6 shadow-lg border-2 transition-all duration-300 flex flex-col",
              isCurrentPlan("enterprise")
                ? "border-amber-500 ring-2 ring-amber-500/20"
                : "border-amber-200 dark:border-amber-800/50 hover:border-amber-300 dark:hover:border-amber-700"
            )}
          >
            {isCurrentPlan("enterprise") && (
              <div className="absolute -top-3 left-4">
                <span className="inline-flex items-center gap-1 px-3 py-1 bg-emerald-500 text-white text-xs font-semibold rounded-full shadow-sm">
                  <Check className="w-3 h-3" /> Current Plan
                </span>
              </div>
            )}

            <div className="mb-6">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center mb-4 shadow-lg">
                <Building2 className="w-6 h-6 text-white" />
              </div>
              <h3 className="text-xl font-bold text-slate-900 dark:text-white">
                Enterprise
              </h3>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                For healthcare organizations
              </p>
            </div>

            <div className="mb-6">
              <div className="flex items-baseline gap-1">
                <span className="text-2xl font-bold text-slate-900 dark:text-white">
                  Custom
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-1">
                Tailored to your needs
              </p>
            </div>

            <div className="space-y-3 mb-6 flex-1">
              <div className="flex items-start gap-3">
                <Check className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
                <span className="text-sm text-slate-700 dark:text-slate-300 font-medium">
                  Everything in Pro
                </span>
              </div>
              <div className="flex items-start gap-3">
                <Check className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
                <span className="text-sm text-slate-700 dark:text-slate-300">
                  Custom branding
                </span>
              </div>
              <div className="flex items-start gap-3">
                <Check className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
                <span className="text-sm text-slate-700 dark:text-slate-300">
                  Multi-patient management
                </span>
              </div>
              <div className="flex items-start gap-3">
                <Check className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
                <span className="text-sm text-slate-700 dark:text-slate-300">
                  Admin dashboard
                </span>
              </div>
              <div className="flex items-start gap-3">
                <Check className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
                <span className="text-sm text-slate-700 dark:text-slate-300">
                  API integration
                </span>
              </div>
              <div className="flex items-start gap-3">
                <Check className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
                <span className="text-sm text-slate-700 dark:text-slate-300">
                  Dedicated support
                </span>
              </div>
            </div>

            <Button
              variant="outline"
              size="lg"
              className="w-full font-semibold border-amber-300 dark:border-amber-700 hover:bg-amber-50 dark:hover:bg-amber-900/20 text-amber-700 dark:text-amber-400"
              onClick={handleContactUs}
            >
              {getButtonText("enterprise")}
            </Button>
          </div>
        </div>

        {/* Feature Comparison Toggle */}
        <div className="text-center mb-6">
          <Button
            variant="ghost"
            onClick={() => setShowComparison(!showComparison)}
            className="text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
          >
            {showComparison ? "Hide" : "Show"} Full Feature Comparison
            <span
              className={cn(
                "ml-2 transition-transform",
                showComparison && "rotate-180"
              )}
            >
              ▼
            </span>
          </Button>
        </div>

        {/* Feature Comparison Table */}
        {showComparison && (
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-lg border overflow-hidden mb-8">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b bg-slate-50 dark:bg-slate-900">
                    <th className="text-left py-4 px-4 font-semibold text-slate-700 dark:text-slate-300">
                      Feature
                    </th>
                    <th className="text-center py-4 px-4 font-semibold text-slate-700 dark:text-slate-300 min-w-[100px]">
                      Free
                    </th>
                    <th className="text-center py-4 px-4 font-semibold text-primary min-w-[100px]">
                      Pro
                    </th>
                    <th className="text-center py-4 px-4 font-semibold text-amber-600 min-w-[100px]">
                      Enterprise
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {FEATURE_COMPARISON.map((feature, idx) => (
                    <tr
                      key={feature.name}
                      className={cn(
                        "border-b last:border-0",
                        idx % 2 === 0 && "bg-slate-50/50 dark:bg-slate-900/30"
                      )}
                    >
                      <td className="py-3 px-4 text-sm text-slate-700 dark:text-slate-300">
                        {feature.name}
                      </td>
                      <td className="py-3 px-4 text-center">
                        {typeof feature.free === "boolean" ? (
                          feature.free ? (
                            <Check className="w-5 h-5 text-emerald-500 mx-auto" />
                          ) : (
                            <X className="w-5 h-5 text-slate-300 mx-auto" />
                          )
                        ) : (
                          <span className="text-sm text-slate-600 dark:text-slate-400">
                            {feature.free}
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-center bg-primary/5">
                        {typeof feature.pro === "boolean" ? (
                          feature.pro ? (
                            <Check className="w-5 h-5 text-primary mx-auto" />
                          ) : (
                            <X className="w-5 h-5 text-slate-300 mx-auto" />
                          )
                        ) : (
                          <span className="text-sm font-medium text-primary">
                            {feature.pro}
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-center">
                        {typeof feature.enterprise === "boolean" ? (
                          feature.enterprise ? (
                            <Check className="w-5 h-5 text-amber-500 mx-auto" />
                          ) : (
                            <X className="w-5 h-5 text-slate-300 mx-auto" />
                          )
                        ) : (
                          <span className="text-sm font-medium text-amber-600">
                            {feature.enterprise}
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Payment Methods */}
        <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 shadow-lg border mb-6">
          <h3 className="font-semibold text-slate-900 dark:text-white mb-4 text-center">
            Accepted Payment Methods
          </h3>
          <div className="flex justify-center gap-3 flex-wrap">
            <div className="flex items-center gap-2 px-4 py-2.5 bg-slate-100 dark:bg-slate-700 rounded-xl">
              <CreditCard className="w-4 h-4 text-slate-600 dark:text-slate-300" />
              <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                Cards
              </span>
            </div>
            <div className="px-4 py-2.5 bg-blue-50 dark:bg-blue-900/30 rounded-xl">
              <span className="text-sm font-semibold text-blue-600 dark:text-blue-400">
                GCash
              </span>
            </div>
            <div className="px-4 py-2.5 bg-green-50 dark:bg-green-900/30 rounded-xl">
              <span className="text-sm font-semibold text-green-600 dark:text-green-400">
                GrabPay
              </span>
            </div>
            <div className="px-4 py-2.5 bg-purple-50 dark:bg-purple-900/30 rounded-xl">
              <span className="text-sm font-semibold text-purple-600 dark:text-purple-400">
                Maya
              </span>
            </div>
          </div>
        </div>

        {/* FAQ Section */}
        <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 shadow-lg border">
          <h3 className="font-bold text-xl mb-5 text-slate-900 dark:text-white">
            Frequently Asked Questions
          </h3>
          <div className="space-y-5">
            <div className="pb-4 border-b border-slate-100 dark:border-slate-700">
              <p className="font-semibold text-slate-900 dark:text-white mb-2">
                Can I cancel anytime?
              </p>
              <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                Yes! Cancel whenever you want with no questions asked. You'll
                keep Pro access until your billing period ends.
              </p>
            </div>
            <div className="pb-4 border-b border-slate-100 dark:border-slate-700">
              <p className="font-semibold text-slate-900 dark:text-white mb-2">
                When do I get Pro features?
              </p>
              <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                Instantly! All Pro features unlock the moment your payment is
                confirmed.
              </p>
            </div>
            <div>
              <p className="font-semibold text-slate-900 dark:text-white mb-2">
                Is my payment secure?
              </p>
              <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                Absolutely. We use bank-level encryption and never store your
                card details directly.
              </p>
            </div>
          </div>
        </div>
      </main>

      {/* Navigation */}
      <Navigation />
    </div>
  );
}
