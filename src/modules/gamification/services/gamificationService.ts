// ============================================
// Gamification Service
// Handles streak tracking and gamification data
// ============================================

import { supabase } from "@/lib/supabase";

export interface GamificationStats {
  currentStreak: number;
  bestStreak: number;
  totalVictories: number;
  lastPerfectDate: string | null;
}

export interface DailyAdherence {
  date: string;
  totalDoses: number;
  takenDoses: number;
  adherenceRate: number;
  isPerfect: boolean;
}

/**
 * Fetch user's gamification stats from the database
 */
export async function getGamificationStats(
  userId: string
): Promise<{ stats: GamificationStats | null; error: string | null }> {
  try {
    const { data, error } = await supabase
      .from("profiles")
      .select("current_streak, best_streak, total_victories, last_perfect_date")
      .eq("id", userId)
      .single();

    if (error) {
      console.error("Error fetching gamification stats:", error);
      return { stats: null, error: error.message };
    }

    return {
      stats: {
        currentStreak: data?.current_streak ?? 0,
        bestStreak: data?.best_streak ?? 0,
        totalVictories: data?.total_victories ?? 0,
        lastPerfectDate: data?.last_perfect_date ?? null,
      },
      error: null,
    };
  } catch (err) {
    console.error("Error in getGamificationStats:", err);
    return { stats: null, error: "Failed to fetch gamification stats" };
  }
}

/**
 * Record daily adherence and update streak
 * This should be called when medication status changes
 */
export async function recordDailyAdherence(
  userId: string,
  totalDoses: number,
  takenDoses: number,
  date?: Date
): Promise<{ success: boolean; error: string | null }> {
  try {
    const dateStr = (date ?? new Date()).toISOString().split("T")[0];

    const { error } = await supabase.rpc("record_daily_adherence", {
      p_user_id: userId,
      p_date: dateStr,
      p_total_doses: totalDoses,
      p_taken_doses: takenDoses,
    });

    if (error) {
      console.error("Error recording daily adherence:", error);
      return { success: false, error: error.message };
    }

    return { success: true, error: null };
  } catch (err) {
    console.error("Error in recordDailyAdherence:", err);
    return { success: false, error: "Failed to record daily adherence" };
  }
}

/**
 * Get recent daily adherence history
 */
export async function getDailyAdherenceHistory(
  userId: string,
  days: number = 7
): Promise<{ history: DailyAdherence[]; error: string | null }> {
  try {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const { data, error } = await supabase
      .from("daily_adherence")
      .select("date, total_doses, taken_doses, adherence_rate, is_perfect")
      .eq("user_id", userId)
      .gte("date", startDate.toISOString().split("T")[0])
      .order("date", { ascending: false });

    if (error) {
      console.error("Error fetching adherence history:", error);
      return { history: [], error: error.message };
    }

    return {
      history: (data ?? []).map((row) => ({
        date: row.date,
        totalDoses: row.total_doses,
        takenDoses: row.taken_doses,
        adherenceRate: row.adherence_rate,
        isPerfect: row.is_perfect,
      })),
      error: null,
    };
  } catch (err) {
    console.error("Error in getDailyAdherenceHistory:", err);
    return { history: [], error: "Failed to fetch adherence history" };
  }
}

/**
 * Check if user had a perfect day today
 */
export async function checkTodaysPerfection(
  userId: string
): Promise<{ isPerfect: boolean; error: string | null }> {
  try {
    const today = new Date().toISOString().split("T")[0];

    const { data, error } = await supabase
      .from("daily_adherence")
      .select("is_perfect")
      .eq("user_id", userId)
      .eq("date", today)
      .single();

    if (error && error.code !== "PGRST116") {
      // PGRST116 = no rows found
      console.error("Error checking today's perfection:", error);
      return { isPerfect: false, error: error.message };
    }

    return { isPerfect: data?.is_perfect ?? false, error: null };
  } catch (err) {
    console.error("Error in checkTodaysPerfection:", err);
    return { isPerfect: false, error: "Failed to check today's perfection" };
  }
}

/**
 * Calculate streak from local medication data (for demo mode)
 */
export function calculateLocalStreak(
  medications: Array<{ taken?: boolean; doses?: Array<{ taken: boolean }> }>
): { currentStreak: number; isPerfectToday: boolean } {
  // Check if all medications are taken today
  const totalDoses = medications.reduce((acc, med) => {
    if (med.doses && med.doses.length > 0) {
      return acc + med.doses.length;
    }
    return acc + 1;
  }, 0);

  const takenDoses = medications.reduce((acc, med) => {
    if (med.doses && med.doses.length > 0) {
      return acc + med.doses.filter((d) => d.taken).length;
    }
    return acc + (med.taken ? 1 : 0);
  }, 0);

  const isPerfectToday = totalDoses > 0 && takenDoses === totalDoses;

  // For demo mode, just return 1 if perfect today, else 0
  // In production, this would come from the database
  return {
    currentStreak: isPerfectToday ? 1 : 0,
    isPerfectToday,
  };
}

