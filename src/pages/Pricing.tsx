import React, { useState, useEffect } from "react";
import {
  ArrowLeft,
  Shield,
  Zap,
  CreditCard,
  Sparkles,
  CheckCircle,
  AlertCircle,
  Server,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Navigation } from "@/components/Navigation";
import { PricingCard } from "@/modules/subscription/components/PricingCard";
import {
  useSubscription,
  SUBSCRIPTION_PLANS,
  isPaymentServerAvailable,
} from "@/modules/subscription";
import type { SubscriptionTier } from "@/modules/subscription";
import { toast } from "@/hooks/use-toast";
import confetti from "canvas-confetti";

export default function Pricing() {
  const navigate = useNavigate();
  const { tier, startProCheckout, simulateProUpgrade, downgradeToFree, isPro } =
    useSubscription();
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [serverAvailable, setServerAvailable] = useState<boolean | null>(null);

  // Check if payment server is running
  useEffect(() => {
    const checkServer = async () => {
      const available = await isPaymentServerAvailable();
      setServerAvailable(available);
    };
    checkServer();
  }, []);

  const handleSelectPlan = async (selectedTier: SubscriptionTier) => {
    if (selectedTier === "free") {
      if (isPro) {
        // Downgrade to free
        setCheckoutLoading(true);
        const result = await downgradeToFree();
        setCheckoutLoading(false);

        if (result.success) {
          toast({
            title: "Downgraded to Free",
            description: "You've been downgraded to the free plan.",
          });
        } else {
          setError(result.error || "Failed to downgrade");
        }
      }
      return;
    }

    if (selectedTier === "pro") {
      setError(null);
      setCheckoutLoading(true);

      // Try real checkout if payment server is available
      if (serverAvailable) {
        const result = await startProCheckout();

        if (!result.success) {
          // If server checkout fails, offer demo mode
          setCheckoutLoading(false);
          setError(`${result.error}. Would you like to try demo mode instead?`);
        }
        // If successful, user will be redirected to PayRex checkout
        return;
      }

      // Demo mode: Simulate upgrade (no payment server)
      const result = await simulateProUpgrade();
      setCheckoutLoading(false);

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
          description: "Upgrade successful! All Pro features are now unlocked.",
        });

        // Navigate to dashboard after celebration
        setTimeout(() => {
          navigate("/dashboard");
        }, 1500);
      } else {
        setError(result.error || "Failed to upgrade");
      }
    }
  };

  const handleContactUs = () => {
    // Open email or contact form
    window.location.href =
      "mailto:enterprise@ainay.care?subject=Enterprise%20Plan%20Inquiry";
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-background via-primary/5 to-background pb-24">
      {/* Header */}
      <header className="gradient-coral text-white p-6 rounded-b-3xl">
        <div className="flex items-center gap-4 mb-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate(-1)}
            className="text-white hover:bg-white/20"
          >
            <ArrowLeft className="w-6 h-6" />
          </Button>
          <h1 className="text-senior-xl font-bold">Subscription Plans</h1>
        </div>
        <p className="text-white/80 text-sm ml-12">
          Choose the perfect plan for your care needs
        </p>
      </header>

      {/* Content */}
      <main className="p-4 space-y-6 -mt-4">
        {/* Server Status Alert - only show if server unavailable */}
        {serverAvailable === false && (
          <Alert className="bg-emerald-50 border-emerald-200 dark:bg-emerald-950/30 dark:border-emerald-800">
            <Sparkles className="h-4 w-4 text-emerald-600" />
            <AlertDescription className="text-emerald-800 dark:text-emerald-200">
              <strong>🚀 Demo Mode:</strong> Click "Upgrade to Pro" to instantly
              unlock all features!
            </AlertDescription>
          </Alert>
        )}

        {/* Current Pro Status */}
        {isPro && (
          <Alert className="bg-primary/10 border-primary/30">
            <CheckCircle className="h-4 w-4 text-primary" />
            <AlertDescription className="text-primary">
              <strong>You're on Pro!</strong> Enjoying all premium features.
            </AlertDescription>
          </Alert>
        )}

        {/* Error Alert */}
        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* Value Propositions */}
        <div className="grid grid-cols-3 gap-3">
          <div className="text-center p-3 bg-card rounded-xl border">
            <Shield className="w-6 h-6 mx-auto mb-2 text-primary" />
            <p className="text-xs font-medium">Secure Payments</p>
          </div>
          <div className="text-center p-3 bg-card rounded-xl border">
            <Zap className="w-6 h-6 mx-auto mb-2 text-secondary" />
            <p className="text-xs font-medium">Instant Access</p>
          </div>
          <div className="text-center p-3 bg-card rounded-xl border">
            <CreditCard className="w-6 h-6 mx-auto mb-2 text-primary" />
            <p className="text-xs font-medium">Cancel Anytime</p>
          </div>
        </div>

        {/* Pricing Cards */}
        <div className="space-y-4 pt-4">
          {SUBSCRIPTION_PLANS.map((plan) => (
            <PricingCard
              key={plan.id}
              plan={plan}
              currentTier={tier}
              isLoading={checkoutLoading}
              onSelect={handleSelectPlan}
              onContactUs={handleContactUs}
            />
          ))}
        </div>

        {/* Payment Methods */}
        <div className="text-center pt-4">
          <p className="text-xs text-muted-foreground mb-3">
            Accepted Payment Methods
          </p>
          <div className="flex justify-center gap-4 flex-wrap">
            <div className="px-3 py-1.5 bg-muted rounded-lg text-xs font-medium">
              💳 Cards
            </div>
            <div className="px-3 py-1.5 bg-muted rounded-lg text-xs font-medium">
              GCash
            </div>
            <div className="px-3 py-1.5 bg-muted rounded-lg text-xs font-medium">
              GrabPay
            </div>
            <div className="px-3 py-1.5 bg-muted rounded-lg text-xs font-medium">
              Maya
            </div>
          </div>
        </div>

        {/* FAQ Section */}
        <div className="bg-card rounded-xl p-4 border mt-6">
          <h3 className="font-semibold mb-3">Frequently Asked Questions</h3>
          <div className="space-y-3 text-sm">
            <div>
              <p className="font-medium">Can I cancel anytime?</p>
              <p className="text-muted-foreground">
                Yes! Cancel your subscription anytime. You'll keep Pro features
                until the end of your billing period.
              </p>
            </div>
            <div>
              <p className="font-medium">What happens when I upgrade?</p>
              <p className="text-muted-foreground">
                You get instant access to all Pro features. Your billing cycle
                starts from the upgrade date.
              </p>
            </div>
            <div>
              <p className="font-medium">Is my payment secure?</p>
              <p className="text-muted-foreground">
                Absolutely. We use PayRex, a PCI-compliant payment processor, to
                handle all transactions securely.
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
