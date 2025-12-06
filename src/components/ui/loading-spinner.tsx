import * as React from "react";
import { cn } from "@/lib/utils";

interface LoadingSpinnerProps {
  className?: string;
  size?: "sm" | "md" | "lg";
  fullScreen?: boolean;
}

const sizeClasses = {
  sm: "w-6 h-6 border-2",
  md: "w-12 h-12 border-4",
  lg: "w-16 h-16 border-4",
};

/**
 * Reusable loading spinner component
 * OPTIMIZATION: Extracted from duplicate code in App.tsx
 */
export function LoadingSpinner({
  className,
  size = "md",
  fullScreen = false,
}: LoadingSpinnerProps) {
  const spinner = (
    <div
      className={cn(
        "border-primary border-t-transparent rounded-full animate-spin",
        sizeClasses[size],
        className
      )}
    />
  );

  if (fullScreen) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        {spinner}
      </div>
    );
  }

  return spinner;
}

/**
 * Full screen loading state with spinner
 */
export function FullScreenLoader() {
  return <LoadingSpinner fullScreen size="md" />;
}

/**
 * Inline loading indicator for buttons or small areas
 */
export function InlineLoader({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin",
        className
      )}
    />
  );
}


