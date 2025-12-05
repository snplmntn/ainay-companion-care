import React from "react";
import { Lock, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { useSubscription } from "../hooks/useSubscription";
import type { FeatureKey } from "../types";
import { getPlanByTier } from "../constants";
import { cn } from "@/lib/utils";

interface FeatureGateProps {
  feature: FeatureKey;
  children: React.ReactNode;
  /** Custom locked message */
  lockedMessage?: string;
  /** Show children but with overlay */
  showPreview?: boolean;
  /** Custom className for the container */
  className?: string;
  /** Hide the upgrade prompt */
  hideUpgradePrompt?: boolean;
}

/**
 * FeatureGate component wraps features that require a specific subscription tier
 * If the user doesn't have access, it shows a locked state with upgrade prompt
 */
export function FeatureGate({
  feature,
  children,
  lockedMessage,
  showPreview = false,
  className,
  hideUpgradePrompt = false,
}: FeatureGateProps) {
  const navigate = useNavigate();
  const { hasFeature, getFeatureRequiredTier, tier } = useSubscription();

  const hasAccess = hasFeature(feature);
  const requiredTier = getFeatureRequiredTier(feature);
  const requiredPlan = getPlanByTier(requiredTier);

  if (hasAccess) {
    return <>{children}</>;
  }

  // Show locked state
  if (showPreview) {
    return (
      <div className={cn("relative", className)}>
        {/* Preview content with blur */}
        <div className="blur-sm pointer-events-none select-none">
          {children}
        </div>

        {/* Overlay */}
        <div className="absolute inset-0 flex items-center justify-center bg-background/60 backdrop-blur-sm rounded-lg">
          <LockedContent
            message={lockedMessage}
            requiredPlan={requiredPlan.name}
            hideUpgrade={hideUpgradePrompt}
            onUpgrade={() => navigate("/subscription/pricing")}
          />
        </div>
      </div>
    );
  }

  // Full locked state
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center p-6 bg-muted/50 rounded-xl border-2 border-dashed border-muted-foreground/30",
        className
      )}
    >
      <LockedContent
        message={lockedMessage}
        requiredPlan={requiredPlan.name}
        hideUpgrade={hideUpgradePrompt}
        onUpgrade={() => navigate("/subscription/pricing")}
      />
    </div>
  );
}

interface LockedContentProps {
  message?: string;
  requiredPlan: string;
  hideUpgrade?: boolean;
  onUpgrade: () => void;
}

function LockedContent({
  message,
  requiredPlan,
  hideUpgrade,
  onUpgrade,
}: LockedContentProps) {
  return (
    <div className="text-center space-y-4">
      <div className="w-16 h-16 mx-auto rounded-full bg-gradient-to-br from-primary/20 to-secondary/20 flex items-center justify-center">
        <Lock className="w-8 h-8 text-primary" />
      </div>

      <div className="space-y-2">
        <h3 className="font-semibold text-foreground">
          {message || "This feature is locked"}
        </h3>
        <p className="text-sm text-muted-foreground">
          Upgrade to {requiredPlan} to unlock this feature
        </p>
      </div>

      {!hideUpgrade && (
        <Button
          onClick={onUpgrade}
          className="bg-gradient-to-r from-primary to-secondary hover:opacity-90"
        >
          <Sparkles className="w-4 h-4 mr-2" />
          Upgrade Now
        </Button>
      )}
    </div>
  );
}

/**
 * Simple hook to check if a feature is available
 */
export function useFeatureAccess(feature: FeatureKey) {
  const { hasFeature, getFeatureRequiredTier, tier } = useSubscription();

  return {
    hasAccess: hasFeature(feature),
    requiredTier: getFeatureRequiredTier(feature),
    currentTier: tier,
  };
}

/**
 * Inline locked badge for showing lock status on buttons/icons
 */
export function LockedBadge({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "absolute -top-1 -right-1 w-5 h-5 rounded-full bg-amber-500 flex items-center justify-center shadow-lg",
        className
      )}
    >
      <Lock className="w-2.5 h-2.5 text-white" />
    </div>
  );
}
