import React from "react";
import { Check, X, Sparkles, Building2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { SubscriptionPlan, SubscriptionTier } from "../types";

interface PricingCardProps {
  plan: SubscriptionPlan;
  currentTier: SubscriptionTier;
  isLoading?: boolean;
  onSelect: (tier: SubscriptionTier) => void;
  onContactUs?: () => void;
}

export function PricingCard({
  plan,
  currentTier,
  isLoading,
  onSelect,
  onContactUs,
}: PricingCardProps) {
  const isCurrentPlan = currentTier === plan.id;
  const isUpgrade =
    (currentTier === "free" &&
      (plan.id === "pro" || plan.id === "enterprise")) ||
    (currentTier === "pro" && plan.id === "enterprise");
  const isDowngrade =
    (currentTier === "pro" && plan.id === "free") ||
    (currentTier === "enterprise" && (plan.id === "pro" || plan.id === "free"));

  const handleClick = () => {
    if (plan.isContactUs) {
      onContactUs?.();
    } else {
      onSelect(plan.id);
    }
  };

  return (
    <div
      className={cn(
        "relative rounded-2xl p-6 transition-all duration-300",
        plan.isPopular
          ? "bg-gradient-to-br from-primary/10 via-primary/5 to-secondary/10 border-2 border-primary shadow-xl scale-105"
          : "bg-card border border-border shadow-lg hover:shadow-xl",
        isCurrentPlan && "ring-2 ring-primary ring-offset-2"
      )}
    >
      {/* Popular badge */}
      {plan.isPopular && (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2">
          <div className="bg-gradient-to-r from-primary to-secondary text-white px-4 py-1 rounded-full text-sm font-semibold flex items-center gap-1.5 shadow-lg">
            <Sparkles className="w-3.5 h-3.5" />
            Most Popular
          </div>
        </div>
      )}

      {/* Current plan badge */}
      {isCurrentPlan && (
        <div className="absolute -top-3 right-4">
          <div className="bg-emerald-500 text-white px-3 py-1 rounded-full text-xs font-semibold">
            Current Plan
          </div>
        </div>
      )}

      {/* Plan header */}
      <div className="text-center mb-6">
        <div className="flex justify-center mb-3">
          {plan.id === "enterprise" ? (
            <div className="w-14 h-14 rounded-full bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center">
              <Building2 className="w-7 h-7 text-white" />
            </div>
          ) : (
            <div
              className={cn(
                "w-14 h-14 rounded-full flex items-center justify-center",
                plan.id === "pro"
                  ? "bg-gradient-to-br from-primary to-secondary"
                  : "bg-muted"
              )}
            >
              <span
                className={cn(
                  "text-2xl font-bold",
                  plan.id === "pro" ? "text-white" : "text-muted-foreground"
                )}
              >
                {plan.name[0]}
              </span>
            </div>
          )}
        </div>

        <h3 className="text-xl font-bold text-foreground">{plan.name}</h3>
        <p className="text-sm text-muted-foreground mt-1">{plan.description}</p>
      </div>

      {/* Price */}
      <div className="text-center mb-6">
        {plan.isContactUs ? (
          <div className="text-2xl font-bold text-foreground">
            Custom Pricing
          </div>
        ) : plan.price === 0 ? (
          <div className="text-4xl font-bold text-foreground">Free</div>
        ) : (
          <div className="flex items-baseline justify-center gap-1">
            <span className="text-lg text-muted-foreground">₱</span>
            <span className="text-4xl font-bold text-foreground">
              {plan.price}
            </span>
            <span className="text-muted-foreground">/month</span>
          </div>
        )}
      </div>

      {/* Features */}
      <div className="space-y-3 mb-6">
        {plan.features.map((feature, index) => (
          <div key={index} className="flex items-start gap-3">
            <div className="w-5 h-5 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center flex-shrink-0 mt-0.5">
              <Check className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
            </div>
            <span className="text-sm text-foreground">{feature}</span>
          </div>
        ))}

        {/* Limitations */}
        {plan.limitations?.map((limitation, index) => (
          <div key={`limit-${index}`} className="flex items-start gap-3">
            <div className="w-5 h-5 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center flex-shrink-0 mt-0.5">
              <X className="w-3 h-3 text-red-600 dark:text-red-400" />
            </div>
            <span className="text-sm text-muted-foreground line-through">
              {limitation}
            </span>
          </div>
        ))}
      </div>

      {/* CTA Button */}
      <Button
        onClick={handleClick}
        disabled={isCurrentPlan || isLoading}
        className={cn(
          "w-full",
          plan.isPopular
            ? "bg-gradient-to-r from-primary to-secondary hover:opacity-90"
            : plan.isContactUs
            ? "bg-gradient-to-r from-amber-500 to-orange-500 hover:opacity-90"
            : ""
        )}
        variant={plan.isPopular || plan.isContactUs ? "default" : "outline"}
        size="lg"
      >
        {isLoading ? (
          <span className="flex items-center gap-2">
            <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
            Processing...
          </span>
        ) : isCurrentPlan ? (
          "Current Plan"
        ) : plan.isContactUs ? (
          "Contact Us"
        ) : isUpgrade ? (
          `Upgrade to ${plan.name}`
        ) : isDowngrade ? (
          `Downgrade to ${plan.name}`
        ) : (
          `Select ${plan.name}`
        )}
      </Button>
    </div>
  );
}
