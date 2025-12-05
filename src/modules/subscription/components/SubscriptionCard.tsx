import React from "react";
import {
  Crown,
  Sparkles,
  ArrowRight,
  Calendar,
  AlertCircle,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useSubscription, getPlanByTier } from "@/modules/subscription";
import { cn } from "@/lib/utils";

interface SubscriptionCardProps {
  className?: string;
  compact?: boolean;
}

export function SubscriptionCard({
  className,
  compact = false,
}: SubscriptionCardProps) {
  const navigate = useNavigate();
  const {
    tier,
    isPro,
    isEnterprise,
    isFree,
    isLoading,
    daysUntilRenewal,
    subscription,
  } = useSubscription();

  const currentPlan = getPlanByTier(tier);

  if (isLoading) {
    return (
      <div className={cn("card-senior animate-pulse", className)}>
        <div className="h-20 bg-muted rounded-lg" />
      </div>
    );
  }

  // Free tier card
  if (isFree) {
    return (
      <div
        className={cn(
          "card-senior overflow-hidden relative",
          "bg-gradient-to-br from-primary/5 via-transparent to-secondary/5",
          className
        )}
      >
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-sm font-medium text-muted-foreground">
                Current Plan
              </span>
              <span className="px-2 py-0.5 bg-muted rounded-full text-xs font-medium">
                Free
              </span>
            </div>
            <p className="text-sm text-muted-foreground mb-3">
              Unlock prescription scanning, voice assistance & more
            </p>
            {!compact && (
              <Button
                onClick={() => navigate("/subscription/pricing")}
                className="bg-gradient-to-r from-primary to-secondary hover:opacity-90"
                size="sm"
              >
                <Sparkles className="w-4 h-4 mr-2" />
                Upgrade to Pro
              </Button>
            )}
          </div>

          {compact ? (
            <Button
              onClick={() => navigate("/subscription/pricing")}
              variant="ghost"
              size="icon"
              className="shrink-0"
            >
              <ArrowRight className="w-5 h-5" />
            </Button>
          ) : (
            <div className="w-16 h-16 rounded-full bg-gradient-to-br from-primary/20 to-secondary/20 flex items-center justify-center">
              <Sparkles className="w-8 h-8 text-primary" />
            </div>
          )}
        </div>
      </div>
    );
  }

  // Pro/Enterprise tier card
  return (
    <div
      className={cn(
        "card-senior overflow-hidden relative",
        isPro
          ? "bg-gradient-to-br from-primary/10 via-transparent to-secondary/10 border-primary/30"
          : "bg-gradient-to-br from-amber-400/10 via-transparent to-orange-500/10 border-amber-400/30",
        className
      )}
    >
      {/* Pro badge */}
      <div className="absolute top-0 right-0">
        <div
          className={cn(
            "px-3 py-1 rounded-bl-xl text-xs font-semibold text-white",
            isPro
              ? "bg-gradient-to-r from-primary to-secondary"
              : "bg-gradient-to-r from-amber-400 to-orange-500"
          )}
        >
          <Crown className="w-3 h-3 inline-block mr-1 -mt-0.5" />
          {tier.toUpperCase()}
        </div>
      </div>

      <div className="flex items-start justify-between gap-4 pt-2">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-sm font-medium text-foreground">
              {currentPlan.name} Plan
            </span>
          </div>

          {daysUntilRenewal !== null && (
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-3">
              <Calendar className="w-3 h-3" />
              {daysUntilRenewal > 0 ? (
                <span>Renews in {daysUntilRenewal} days</span>
              ) : (
                <span className="text-amber-600">Renewal due today</span>
              )}
            </div>
          )}

          {subscription?.status === "cancelled" && (
            <div className="flex items-center gap-1.5 text-xs text-amber-600 mb-3">
              <AlertCircle className="w-3 h-3" />
              <span>Cancelled - access until period ends</span>
            </div>
          )}

          {!compact && (
            <Button
              onClick={() => navigate("/subscription/pricing")}
              variant="outline"
              size="sm"
            >
              Manage Subscription
            </Button>
          )}
        </div>

        {compact ? (
          <Button
            onClick={() => navigate("/subscription/pricing")}
            variant="ghost"
            size="icon"
            className="shrink-0"
          >
            <ArrowRight className="w-5 h-5" />
          </Button>
        ) : (
          <div
            className={cn(
              "w-16 h-16 rounded-full flex items-center justify-center",
              isPro
                ? "bg-gradient-to-br from-primary to-secondary"
                : "bg-gradient-to-br from-amber-400 to-orange-500"
            )}
          >
            <Crown className="w-8 h-8 text-white" />
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Compact subscription badge for headers/nav
 */
export function SubscriptionBadge({ className }: { className?: string }) {
  const { tier, isFree } = useSubscription();

  if (isFree) {
    return null;
  }

  return (
    <span
      className={cn(
        "px-2 py-0.5 rounded-full text-xs font-semibold text-white",
        tier === "pro"
          ? "bg-gradient-to-r from-primary to-secondary"
          : "bg-gradient-to-r from-amber-400 to-orange-500",
        className
      )}
    >
      {tier.toUpperCase()}
    </span>
  );
}
