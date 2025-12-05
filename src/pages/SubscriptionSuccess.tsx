import React, { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { CheckCircle, ArrowRight, Sparkles, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useSubscription } from "@/modules/subscription";
import confetti from "canvas-confetti";

export default function SubscriptionSuccess() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { verifyPayment, refreshSubscription, tier } = useSubscription();
  const [status, setStatus] = useState<"loading" | "success" | "error">(
    "loading"
  );
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const sessionId = searchParams.get("session_id");

  useEffect(() => {
    async function verifyAndCelebrate() {
      if (!sessionId) {
        setStatus("error");
        setErrorMessage("No session ID found");
        return;
      }

      const result = await verifyPayment(sessionId);

      if (result.success) {
        setStatus("success");
        await refreshSubscription();

        // Celebration confetti!
        confetti({
          particleCount: 100,
          spread: 70,
          origin: { y: 0.6 },
          colors: ["#FF6B6B", "#4ECDC4", "#FFE66D", "#95E1D3"],
        });

        // Second burst
        setTimeout(() => {
          confetti({
            particleCount: 50,
            angle: 60,
            spread: 55,
            origin: { x: 0 },
            colors: ["#FF6B6B", "#4ECDC4"],
          });
          confetti({
            particleCount: 50,
            angle: 120,
            spread: 55,
            origin: { x: 1 },
            colors: ["#FFE66D", "#95E1D3"],
          });
        }, 250);
      } else {
        setStatus("error");
        setErrorMessage(result.error || "Payment verification failed");
      }
    }

    verifyAndCelebrate();
  }, [sessionId, verifyPayment, refreshSubscription]);

  if (status === "loading") {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-b from-background via-primary/5 to-background p-6">
        <div className="w-20 h-20 border-4 border-primary border-t-transparent rounded-full animate-spin mb-6" />
        <h2 className="text-xl font-semibold text-foreground mb-2">
          Verifying your payment...
        </h2>
        <p className="text-muted-foreground text-center">
          Please wait while we confirm your subscription
        </p>
      </div>
    );
  }

  if (status === "error") {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-b from-background via-red-50/30 to-background dark:via-red-950/10 p-6">
        <div className="w-24 h-24 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center mb-6">
          <XCircle className="w-12 h-12 text-red-500" />
        </div>

        <h1 className="text-2xl font-bold text-foreground mb-2 text-center">
          Payment Verification Failed
        </h1>
        <p className="text-muted-foreground text-center mb-6 max-w-md">
          {errorMessage ||
            "We couldn't verify your payment. Please try again or contact support."}
        </p>

        <div className="flex flex-col sm:flex-row gap-3">
          <Button
            onClick={() => navigate("/subscription/pricing")}
            variant="outline"
          >
            Try Again
          </Button>
          <Button onClick={() => navigate("/dashboard")}>
            Go to Dashboard
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-b from-background via-emerald-50/30 to-background dark:via-emerald-950/10 p-6">
      {/* Success Animation */}
      <div className="relative mb-8">
        <div className="absolute inset-0 animate-ping">
          <div className="w-24 h-24 rounded-full bg-emerald-400/30" />
        </div>
        <div className="relative w-24 h-24 rounded-full bg-gradient-to-br from-emerald-400 to-emerald-600 flex items-center justify-center shadow-xl">
          <CheckCircle className="w-12 h-12 text-white" />
        </div>
      </div>

      {/* Success Message */}
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold text-foreground mb-2">
          Welcome to Pro! 🎉
        </h1>
        <p className="text-muted-foreground max-w-md">
          Your subscription is now active. Enjoy all the premium features of
          AInay Companion Care.
        </p>
      </div>

      {/* Pro Features Unlocked */}
      <div className="bg-card border rounded-2xl p-6 mb-8 w-full max-w-md">
        <div className="flex items-center gap-2 mb-4">
          <Sparkles className="w-5 h-5 text-primary" />
          <h2 className="font-semibold">Features Now Unlocked</h2>
        </div>

        <ul className="space-y-3">
          {[
            "Prescription scanning with AI",
            "Voice assistance in Tagalog & English",
            "Daily morning briefing",
            "Unlimited medications",
            "Advanced analytics",
            "Priority support",
          ].map((feature, index) => (
            <li key={index} className="flex items-center gap-3">
              <div className="w-5 h-5 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
                <CheckCircle className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
              </div>
              <span className="text-sm">{feature}</span>
            </li>
          ))}
        </ul>
      </div>

      {/* CTA Buttons */}
      <div className="flex flex-col sm:flex-row gap-3 w-full max-w-md">
        <Button
          onClick={() => navigate("/dashboard")}
          className="flex-1 bg-gradient-to-r from-primary to-secondary hover:opacity-90"
          size="lg"
        >
          Go to Dashboard
          <ArrowRight className="w-4 h-4 ml-2" />
        </Button>
        <Button
          onClick={() => navigate("/ask")}
          variant="outline"
          size="lg"
          className="flex-1"
        >
          Try Voice Assistant
        </Button>
      </div>

      {/* Receipt Info */}
      <p className="text-xs text-muted-foreground mt-8 text-center">
        A receipt has been sent to your email.
        <br />
        Questions? Contact support@ainay.care
      </p>
    </div>
  );
}
