// ============================================
// Companion Module Constants
// ============================================

export const ADHERENCE_THRESHOLDS = {
  EXCELLENT: 90,
  GOOD: 70,
  FAIR: 50,
  POOR: 0,
} as const;

export const ADHERENCE_COLORS = {
  EXCELLENT: "text-green-600 bg-green-100",
  GOOD: "text-blue-600 bg-blue-100",
  FAIR: "text-amber-600 bg-amber-100",
  POOR: "text-red-600 bg-red-100",
} as const;

export function getAdherenceLevel(
  rate: number
): keyof typeof ADHERENCE_THRESHOLDS {
  if (rate >= ADHERENCE_THRESHOLDS.EXCELLENT) return "EXCELLENT";
  if (rate >= ADHERENCE_THRESHOLDS.GOOD) return "GOOD";
  if (rate >= ADHERENCE_THRESHOLDS.FAIR) return "FAIR";
  return "POOR";
}

export function getAdherenceColor(rate: number): string {
  return ADHERENCE_COLORS[getAdherenceLevel(rate)];
}

