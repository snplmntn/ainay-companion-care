// ============================================
// useGamification Hook
// Provides gamification data and actions
// ============================================

import { useState, useEffect, useCallback } from "react";
import { useApp } from "@/contexts/AppContext";
import {
  getGamificationStats,
  recordDailyAdherence,
  calculateLocalStreak,
  type GamificationStats,
} from "../services/gamificationService";

interface UseGamificationReturn {
  stats: GamificationStats;
  isLoading: boolean;
  error: string | null;
  todayCompleted: number;
  todayTotal: number;
  isPerfectToday: boolean;
  refreshStats: () => Promise<void>;
  recordAdherence: () => Promise<void>;
}

export function useGamification(): UseGamificationReturn {
  const { medications, profile, isAuthenticated } = useApp();
  const [stats, setStats] = useState<GamificationStats>({
    currentStreak: 0,
    bestStreak: 0,
    totalVictories: 0,
    lastPerfectDate: null,
  });
  // Start with isLoading false in demo mode (no auth)
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Calculate today's stats from medications
  const todayTotal = medications.reduce((acc, med) => {
    if (med.doses && med.doses.length > 0) {
      return acc + med.doses.length;
    }
    return acc + 1;
  }, 0);

  const todayCompleted = medications.reduce((acc, med) => {
    if (med.doses && med.doses.length > 0) {
      return acc + med.doses.filter((d) => d.taken).length;
    }
    return acc + (med.taken ? 1 : 0);
  }, 0);

  const isPerfectToday = todayTotal > 0 && todayCompleted === todayTotal;

  // Fetch stats from database or calculate locally
  const fetchStats = useCallback(async () => {
    if (!isAuthenticated || !profile?.id) {
      // Demo mode: use calculated stats based on current medications
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    const { stats: dbStats, error: fetchError } = await getGamificationStats(
      profile.id
    );

    if (fetchError) {
      setError(fetchError);
    } else if (dbStats) {
      setStats(dbStats);
    }

    setIsLoading(false);
  }, [isAuthenticated, profile?.id]);

  // Update stats from local medications when in demo mode
  useEffect(() => {
    if (!isAuthenticated || !profile?.id) {
      const { currentStreak, isPerfectToday: perfect } =
        calculateLocalStreak(medications);
      setStats({
        currentStreak,
        bestStreak: currentStreak,
        totalVictories: perfect ? 1 : 0,
        lastPerfectDate: perfect ? new Date().toISOString().split("T")[0] : null,
      });
    }
  }, [medications, isAuthenticated, profile?.id]);

  // Record adherence for today
  const recordAdherence = useCallback(async () => {
    if (!isAuthenticated || !profile?.id) {
      return; // Demo mode doesn't persist
    }

    const { error: recordError } = await recordDailyAdherence(
      profile.id,
      todayTotal,
      todayCompleted
    );

    if (recordError) {
      console.error("Failed to record adherence:", recordError);
    } else {
      // Refresh stats after recording
      await fetchStats();
    }
  }, [isAuthenticated, profile?.id, todayTotal, todayCompleted, fetchStats]);

  // Initial fetch
  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  // Auto-record adherence when medications change (debounced) - only for authenticated users
  useEffect(() => {
    if (!isAuthenticated || !profile?.id) return;

    const timer = setTimeout(() => {
      recordAdherence();
    }, 2000); // Debounce 2 seconds

    return () => clearTimeout(timer);
  }, [todayCompleted, todayTotal, isAuthenticated, profile?.id, recordAdherence]);

  return {
    stats,
    isLoading,
    error,
    todayCompleted,
    todayTotal,
    isPerfectToday,
    refreshStats: fetchStats,
    recordAdherence,
  };
}

