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
  BarChart3,
  HeadphonesIcon,
  RefreshCw,
  Infinity,
  Languages,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useSubscription, lookupSessionByTxnRef } from "@/modules/subscription";
import confetti from "canvas-confetti";

const UNLOCKED_FEATURES = [
  { icon: Infinity, label: "Unlimited medicines", color: "text-emerald-500" },
  { icon: Scan, label: "Scan prescriptions", color: "text-violet-500" },
  { icon: Languages, label: "Tagalog & English", color: "text-sky-500" },
  { icon: BarChart3, label: "Progress tracking", color: "text-rose-500" },
  { icon: Sparkles, label: "Smart reminders", color: "text-amber-500" },
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
          confetti({
            particleCount: 150,
            spread: 100,
            origin: { y: 0.4, x: 0.5 },
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
            origin: { x: 0, y: 0.5 },
            colors: ["#FF6B6B", "#FFE66D"],
          });
          confetti({
            particleCount: 60,
            angle: 120,
            spread: 60,
            origin: { x: 1, y: 0.5 },
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
          <div className="absolute inset-0 animate-pulse">
            <div className="w-20 h-20 rounded-full bg-primary/20 blur-xl" />
          </div>
          <div className="relative w-20 h-20 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
          <div className="absolute inset-0 flex items-center justify-center">
            <Crown className="w-7 h-7 text-primary animate-pulse" />
          </div>
        </div>
        
        <div className="mt-6 text-center">
          <h2 className="text-xl font-semibold text-foreground">Just a moment...</h2>
          <p className="text-muted-foreground text-sm mt-1">Getting everything ready!</p>
        </div>
      </div>
    );
  }

  // Error State
  if (status === "error") {
    return (
      <div className="fixed inset-0 flex flex-col items-center justify-center bg-gradient-to-br from-slate-50 via-white to-red-50/30 dark:from-slate-950 dark:via-slate-900 dark:to-red-950/20 p-6">
        <div className="w-full max-w-sm mx-auto text-center">
          <div className="relative w-20 h-20 mx-auto mb-5">
            <div className="absolute inset-0 bg-red-500/20 rounded-full blur-xl animate-pulse" />
            <div className="relative w-20 h-20 rounded-full bg-gradient-to-br from-red-400 to-red-600 flex items-center justify-center shadow-lg">
              <XCircle className="w-10 h-10 text-white" />
            </div>
          </div>

          <h1 className="text-xl font-bold text-foreground mb-2">Something Went Wrong</h1>
          <p className="text-sm text-muted-foreground mb-6">
            {errorMessage || "We couldn't complete your payment. Let's try again!"}
          </p>

          <div className="flex flex-col gap-2">
            <Button onClick={() => navigate("/subscription/pricing")} size="lg" className="w-full gap-2">
              <RefreshCw className="w-4 h-4" />
              Try Again
            </Button>
            <Button onClick={() => navigate("/dashboard")} variant="ghost" className="w-full">
              Go Home
            </Button>
          </div>

          <p className="text-xs text-muted-foreground mt-6">
            Need help?{" "}
            <a href="mailto:support@ainay.care" className="text-primary hover:underline">
              support@ainay.care
            </a>
          </p>
        </div>
      </div>
    );
  }

  // Success State - Balanced design that fits on one screen
  return (
    <div className="fixed inset-0 flex flex-col bg-gradient-to-br from-slate-50 via-white to-emerald-50/50 dark:from-slate-950 dark:via-slate-900 dark:to-emerald-950/30">
      {/* Decorative background */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-56 h-56 bg-emerald-400/10 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-72 h-72 bg-primary/5 rounded-full blur-3xl" />
      </div>

      {/* Main Content - Centered with flex */}
      <div className="relative flex-1 flex flex-col items-center justify-center px-6 py-8 max-w-md mx-auto w-full">
        {/* Success Badge */}
        <div
          className={`relative w-24 h-24 mb-5 transition-all duration-700 ease-out ${
            showContent ? "opacity-100 scale-100" : "opacity-0 scale-50"
          }`}
        >
          <div className="absolute inset-0 animate-ping opacity-20">
            <div className="w-24 h-24 rounded-full bg-emerald-400" />
          </div>
          <div className="relative w-24 h-24 rounded-full bg-gradient-to-br from-emerald-400 via-emerald-500 to-teal-600 flex items-center justify-center shadow-xl shadow-emerald-500/30">
            <CheckCircle className="w-12 h-12 text-white" strokeWidth={2.5} />
          </div>
          <div className="absolute -top-1.5 -right-1.5 w-9 h-9 rounded-full bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center shadow-lg">
            <Crown className="w-5 h-5 text-white" />
          </div>
        </div>

        {/* Welcome Message */}
        <div
          className={`text-center mb-6 transition-all duration-500 delay-200 ${
            showContent ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
          }`}
        >
          <h1 className="text-2xl sm:text-3xl font-bold text-foreground mb-2">You're All Set! 🎉</h1>
          <p className="text-base text-muted-foreground">All Pro features are now unlocked!</p>
        </div>

        {/* Features Grid - 2-column layout */}
        <div
          className={`w-full bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm border border-slate-200/50 dark:border-slate-700/50 rounded-2xl p-5 mb-6 shadow-lg transition-all duration-500 delay-300 ${
            showContent ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
          }`}
        >
          <div className="grid grid-cols-2 gap-3">
            {UNLOCKED_FEATURES.map((feature, index) => (
              <div
                key={index}
                className={`flex items-center gap-3 p-3 rounded-xl bg-slate-50/80 dark:bg-slate-800/50 transition-all duration-300 ${
                  showContent ? "opacity-100" : "opacity-0"
                }`}
                style={{ transitionDelay: `${400 + index * 50}ms` }}
              >
                <div className="w-10 h-10 rounded-xl bg-white dark:bg-slate-700 flex items-center justify-center shrink-0 shadow-sm">
                  <feature.icon className={`w-5 h-5 ${feature.color}`} />
                </div>
                <span className="text-sm font-medium text-foreground leading-tight">{feature.label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* CTA Buttons */}
        <div
          className={`w-full space-y-3 transition-all duration-500 delay-600 ${
            showContent ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
          }`}
        >
          <Button
            onClick={() => navigate("/dashboard")}
            size="lg"
            className="w-full h-14 text-lg font-semibold bg-gradient-to-r from-emerald-500 via-emerald-600 to-teal-600 hover:from-emerald-600 hover:via-emerald-700 hover:to-teal-700 shadow-lg shadow-emerald-500/25"
          >
            Go Home
            <ArrowRight className="w-5 h-5 ml-2" />
          </Button>
          <Button
            onClick={() => navigate("/ask")}
            variant="outline"
            size="lg"
            className="w-full h-12 text-base font-medium border-2"
          >
            <Mic className="w-5 h-5 mr-2" />
            Talk to AInay
          </Button>
        </div>

        {/* Footer */}
        <p
          className={`text-center text-sm text-muted-foreground mt-5 transition-all duration-500 delay-700 ${
            showContent ? "opacity-100" : "opacity-0"
          }`}
        >
          Receipt sent to your email •{" "}
          <a href="mailto:support@ainay.care" className="text-primary hover:underline">
            Need help?
          </a>
        </p>
      </div>
    </div>
  );
}
