import React, { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  CheckCircle,
  ArrowRight,
  Sparkles,
  XCircle,
  Crown,
  Mic,
  Scan,
  Calendar,
  BarChart3,
  HeadphonesIcon,
  RefreshCw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useSubscription, lookupSessionByTxnRef } from "@/modules/subscription";
import confetti from "canvas-confetti";

const UNLOCKED_FEATURES = [
  { icon: Scan, label: "Prescription scanning with AI", color: "text-violet-500" },
  { icon: Mic, label: "Voice assistance in Tagalog & English", color: "text-sky-500" },
  { icon: Calendar, label: "Daily morning briefing", color: "text-amber-500" },
  { icon: Sparkles, label: "Unlimited medications", color: "text-emerald-500" },
  { icon: BarChart3, label: "Advanced analytics", color: "text-rose-500" },
  { icon: HeadphonesIcon, label: "Priority support", color: "text-indigo-500" },
];

export default function SubscriptionSuccess() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { verifyPayment, refreshSubscription } = useSubscription();
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [showContent, setShowContent] = useState(false);

  const urlSessionId = searchParams.get("session_id");
  const urlTxnRef = searchParams.get("txn_ref");
  const storedSessionId = localStorage.getItem("payrex_session_id");
  const storedTxnRef = localStorage.getItem("payrex_txn_ref");

  useEffect(() => {
    async function verifyAndCelebrate() {
      let sessionId: string | null = null;

      if (urlSessionId && urlSessionId !== "{CHECKOUT_SESSION_ID}") {
        sessionId = urlSessionId;
      } else if (storedSessionId) {
        sessionId = storedSessionId;
      } else if (urlTxnRef) {
        const lookupResult = await lookupSessionByTxnRef(urlTxnRef);
        if (lookupResult.success && lookupResult.sessionId) {
          sessionId = lookupResult.sessionId;
        }
      }
      if (!sessionId && storedTxnRef) {
        const lookupResult = await lookupSessionByTxnRef(storedTxnRef);
        if (lookupResult.success && lookupResult.sessionId) {
          sessionId = lookupResult.sessionId;
        }
      }

      if (!sessionId) {
        setStatus("error");
        setErrorMessage("No session ID found. Please try the checkout again.");
        return;
      }

      const result = await verifyPayment(sessionId);

      if (result.success) {
        setStatus("success");
        await refreshSubscription();

        localStorage.removeItem("payrex_session_id");
        localStorage.removeItem("payrex_user_id");
        localStorage.removeItem("payrex_txn_ref");

        // Staggered entrance animation
        setTimeout(() => setShowContent(true), 100);

        // Grand celebration confetti!
        setTimeout(() => {
          // Center burst
          confetti({
            particleCount: 150,
            spread: 100,
            origin: { y: 0.5, x: 0.5 },
            colors: ["#FF6B6B", "#4ECDC4", "#FFE66D", "#95E1D3", "#A78BFA"],
            startVelocity: 45,
          });
        }, 300);

        // Side bursts
        setTimeout(() => {
          confetti({
            particleCount: 60,
            angle: 60,
            spread: 60,
            origin: { x: 0, y: 0.6 },
            colors: ["#FF6B6B", "#FFE66D"],
          });
          confetti({
            particleCount: 60,
            angle: 120,
            spread: 60,
            origin: { x: 1, y: 0.6 },
            colors: ["#4ECDC4", "#A78BFA"],
          });
        }, 600);
      } else {
        setStatus("error");
        setErrorMessage(result.error || "Payment verification failed");
      }
    }

    verifyAndCelebrate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [urlSessionId, urlTxnRef, verifyPayment, refreshSubscription]);

  // Loading State
  if (status === "loading") {
    return (
      <div className="fixed inset-0 flex flex-col items-center justify-center bg-gradient-to-br from-slate-50 via-white to-emerald-50/50 dark:from-slate-950 dark:via-slate-900 dark:to-emerald-950/30 p-6">
        <div className="relative">
          {/* Outer glow */}
          <div className="absolute inset-0 animate-pulse">
            <div className="w-24 h-24 rounded-full bg-primary/20 blur-xl" />
          </div>
          {/* Spinner */}
          <div className="relative w-24 h-24 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
          {/* Center icon */}
          <div className="absolute inset-0 flex items-center justify-center">
            <Crown className="w-8 h-8 text-primary animate-pulse" />
          </div>
        </div>
        
        <div className="mt-8 text-center space-y-2">
          <h2 className="text-xl font-semibold text-foreground">
            Verifying your payment...
          </h2>
          <p className="text-muted-foreground text-sm max-w-xs">
            Hang tight! We're activating your Pro subscription
          </p>
        </div>
      </div>
    );
  }

  // Error State
  if (status === "error") {
    return (
      <div className="fixed inset-0 flex flex-col items-center justify-center bg-gradient-to-br from-slate-50 via-white to-red-50/30 dark:from-slate-950 dark:via-slate-900 dark:to-red-950/20 p-6">
        <div className="w-full max-w-md mx-auto text-center">
          {/* Error Icon */}
          <div className="relative w-24 h-24 mx-auto mb-6">
            <div className="absolute inset-0 bg-red-500/20 rounded-full blur-xl animate-pulse" />
            <div className="relative w-24 h-24 rounded-full bg-gradient-to-br from-red-400 to-red-600 flex items-center justify-center shadow-lg shadow-red-500/30">
              <XCircle className="w-12 h-12 text-white" />
            </div>
          </div>

          <h1 className="text-2xl font-bold text-foreground mb-3">
            Payment Verification Failed
          </h1>
          <p className="text-muted-foreground mb-8 leading-relaxed">
            {errorMessage || "We couldn't verify your payment. Please try again or contact support."}
          </p>

          <div className="flex flex-col gap-3">
            <Button
              onClick={() => navigate("/subscription/pricing")}
              size="lg"
              className="w-full gap-2"
            >
              <RefreshCw className="w-4 h-4" />
              Try Again
            </Button>
            <Button
              onClick={() => navigate("/dashboard")}
              variant="ghost"
              size="lg"
              className="w-full"
            >
              Go to Dashboard
            </Button>
          </div>

          <p className="text-xs text-muted-foreground mt-8">
            Need help? Contact{" "}
            <a href="mailto:support@ainay.care" className="text-primary hover:underline">
              support@ainay.care
            </a>
          </p>
        </div>
      </div>
    );
  }

  // Success State
  return (
    <div className="fixed inset-0 overflow-y-auto bg-gradient-to-br from-slate-50 via-white to-emerald-50/50 dark:from-slate-950 dark:via-slate-900 dark:to-emerald-950/30">
      {/* Decorative background elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-64 h-64 bg-emerald-400/10 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-primary/5 rounded-full blur-3xl" />
      </div>

      <div className="relative min-h-full flex flex-col items-center justify-center p-6 py-12">
        <div className="w-full max-w-md mx-auto">
          {/* Success Badge Animation */}
          <div
            className={`relative w-28 h-28 mx-auto mb-8 transition-all duration-700 ease-out ${
              showContent ? "opacity-100 scale-100" : "opacity-0 scale-50"
            }`}
          >
            {/* Animated rings */}
            <div className="absolute inset-0 animate-ping opacity-30">
              <div className="w-28 h-28 rounded-full bg-emerald-400" />
            </div>
            <div className="absolute inset-2 animate-pulse">
              <div className="w-24 h-24 rounded-full bg-emerald-400/30" />
            </div>
            {/* Main badge */}
            <div className="relative w-28 h-28 rounded-full bg-gradient-to-br from-emerald-400 via-emerald-500 to-teal-600 flex items-center justify-center shadow-2xl shadow-emerald-500/40">
              <CheckCircle className="w-14 h-14 text-white drop-shadow-lg" strokeWidth={2.5} />
            </div>
            {/* Pro crown */}
            <div className="absolute -top-2 -right-2 w-10 h-10 rounded-full bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center shadow-lg">
              <Crown className="w-5 h-5 text-white" />
            </div>
          </div>

          {/* Welcome Message */}
          <div
            className={`text-center mb-8 transition-all duration-500 delay-200 ${
              showContent ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
            }`}
          >
            <h1 className="text-3xl sm:text-4xl font-bold text-foreground mb-3 tracking-tight">
              Welcome to Pro! 🎉
            </h1>
            <p className="text-muted-foreground leading-relaxed">
              Your subscription is now active. Enjoy all the premium features of AInay Companion Care.
            </p>
          </div>

          {/* Features Card */}
          <div
            className={`bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm border border-slate-200/50 dark:border-slate-700/50 rounded-3xl p-6 mb-6 shadow-xl shadow-slate-200/50 dark:shadow-slate-900/50 transition-all duration-500 delay-300 ${
              showContent ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
            }`}
          >
            <div className="flex items-center gap-3 mb-5">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary/20 to-secondary/20 flex items-center justify-center">
                <Sparkles className="w-5 h-5 text-primary" />
              </div>
              <h2 className="font-semibold text-lg">Features Now Unlocked</h2>
            </div>

            <ul className="space-y-3">
              {UNLOCKED_FEATURES.map((feature, index) => (
                <li
                  key={index}
                  className={`flex items-center gap-3 p-2 rounded-xl hover:bg-slate-100/50 dark:hover:bg-slate-800/50 transition-all duration-300 ${
                    showContent ? "opacity-100 translate-x-0" : "opacity-0 -translate-x-4"
                  }`}
                  style={{ transitionDelay: `${400 + index * 80}ms` }}
                >
                  <div className={`w-9 h-9 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center flex-shrink-0`}>
                    <feature.icon className={`w-4 h-4 ${feature.color}`} />
                  </div>
                  <span className="text-sm font-medium text-foreground">{feature.label}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* CTA Buttons */}
          <div
            className={`space-y-3 transition-all duration-500 delay-700 ${
              showContent ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
            }`}
          >
            <Button
              onClick={() => navigate("/dashboard")}
              size="lg"
              className="w-full h-14 text-base font-semibold bg-gradient-to-r from-emerald-500 via-emerald-600 to-teal-600 hover:from-emerald-600 hover:via-emerald-700 hover:to-teal-700 shadow-lg shadow-emerald-500/30 transition-all duration-300 hover:shadow-xl hover:shadow-emerald-500/40 hover:-translate-y-0.5"
            >
              Go to Dashboard
              <ArrowRight className="w-5 h-5 ml-2" />
            </Button>
            <Button
              onClick={() => navigate("/ask")}
              variant="outline"
              size="lg"
              className="w-full h-12 font-medium border-2 hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              <Mic className="w-4 h-4 mr-2" />
              Try Voice Assistant
            </Button>
          </div>

          {/* Footer */}
          <p
            className={`text-center text-xs text-muted-foreground mt-8 transition-all duration-500 delay-900 ${
              showContent ? "opacity-100" : "opacity-0"
            }`}
          >
            A receipt has been sent to your email.
            <br />
            <span className="text-muted-foreground/70">
              Questions?{" "}
              <a href="mailto:support@ainay.care" className="text-primary hover:underline">
                support@ainay.care
              </a>
            </span>
          </p>
        </div>
      </div>
    </div>
  );
}
