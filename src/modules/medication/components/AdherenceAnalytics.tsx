// ============================================
// Adherence Analytics Component
// Shows medication adherence stats and patterns
// ============================================

import React, { useMemo } from "react";
import {
  TrendingUp,
  TrendingDown,
  Clock,
  Target,
  Award,
  BarChart3,
  Lightbulb,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Calendar,
  Zap,
} from "lucide-react";
import { useApp } from "@/contexts/AppContext";
import {
  calculateOverallAnalytics,
  generateInsights,
  type OverallAnalytics,
  type TimeSlotPattern,
} from "../services/analyticsService";

interface AdherenceAnalyticsProps {
  /** Show in compact mode (less detail) */
  compact?: boolean;
  /** Show weekly chart */
  showWeeklyChart?: boolean;
  /** Show time slot breakdown */
  showTimeSlots?: boolean;
  /** Show insights */
  showInsights?: boolean;
}

// Mini bar chart for weekly trend
function WeeklyChart({ data }: { data: OverallAnalytics["weeklyTrend"] }) {
  const maxValue = 100;
  const days = ["S", "M", "T", "W", "T", "F", "S"];
  
  return (
    <div className="flex items-end justify-between gap-1 h-24">
      {data.map((day, index) => {
        const height = (day.adherenceRate / maxValue) * 100;
        const isToday = index === data.length - 1;
        const dayOfWeek = new Date(day.date).getDay();
        
        return (
          <div key={day.date} className="flex-1 flex flex-col items-center gap-1">
            <div className="relative w-full flex-1 flex items-end">
              <div
                className={`w-full rounded-t transition-all ${
                  isToday 
                    ? "bg-primary" 
                    : day.adherenceRate >= 80 
                      ? "bg-secondary" 
                      : day.adherenceRate >= 50 
                        ? "bg-amber-400" 
                        : "bg-red-400"
                }`}
                style={{ height: `${Math.max(height, 4)}%` }}
              />
            </div>
            <span className={`text-xs ${isToday ? "font-bold text-primary" : "text-muted-foreground"}`}>
              {days[dayOfWeek]}
            </span>
          </div>
        );
      })}
    </div>
  );
}

// Time slot adherence indicator
function TimeSlotIndicator({ slot }: { slot: TimeSlotPattern }) {
  const getSlotIcon = (timeSlot: TimeSlotPattern["timeSlot"]) => {
    switch (timeSlot) {
      case "morning": return "🌅";
      case "midday": return "☀️";
      case "afternoon": return "🌤️";
      case "evening": return "🌆";
      case "night": return "🌙";
    }
  };
  
  const getStatusColor = (rate: number) => {
    if (rate >= 80) return "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400";
    if (rate >= 50) return "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400";
    return "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400";
  };
  
  if (slot.scheduledCount === 0) return null;
  
  return (
    <div className="flex items-center justify-between p-3 rounded-xl bg-muted/50">
      <div className="flex items-center gap-3">
        <span className="text-xl">{getSlotIcon(slot.timeSlot)}</span>
        <div>
          <p className="font-medium capitalize">{slot.timeSlot}</p>
          <p className="text-xs text-muted-foreground">
            {slot.takenCount}/{slot.scheduledCount} doses
          </p>
        </div>
      </div>
      <span className={`px-3 py-1 rounded-full text-sm font-semibold ${getStatusColor(slot.adherenceRate)}`}>
        {slot.adherenceRate}%
      </span>
    </div>
  );
}

// Circular progress for adherence
function AdherenceCircle({ 
  value, 
  size = "lg",
  label,
}: { 
  value: number; 
  size?: "sm" | "md" | "lg";
  label?: string;
}) {
  const sizes = {
    sm: { outer: 48, stroke: 4, text: "text-sm" },
    md: { outer: 64, stroke: 5, text: "text-lg" },
    lg: { outer: 96, stroke: 6, text: "text-2xl" },
  };
  
  const { outer, stroke, text } = sizes[size];
  const radius = (outer - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (value / 100) * circumference;
  
  const getColor = (v: number) => {
    if (v >= 80) return "text-green-500";
    if (v >= 50) return "text-amber-500";
    return "text-red-500";
  };
  
  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative" style={{ width: outer, height: outer }}>
        <svg className="w-full h-full transform -rotate-90">
          <circle
            cx={outer / 2}
            cy={outer / 2}
            r={radius}
            stroke="currentColor"
            strokeWidth={stroke}
            fill="none"
            className="text-muted"
          />
          <circle
            cx={outer / 2}
            cy={outer / 2}
            r={radius}
            stroke="currentColor"
            strokeWidth={stroke}
            fill="none"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            strokeLinecap="round"
            className={`transition-all duration-1000 ${getColor(value)}`}
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className={`font-bold ${text}`}>{value}%</span>
        </div>
      </div>
      {label && <span className="text-sm text-muted-foreground">{label}</span>}
    </div>
  );
}

export function AdherenceAnalytics({
  compact = false,
  showWeeklyChart = true,
  showTimeSlots = true,
  showInsights = true,
}: AdherenceAnalyticsProps) {
  const { medications } = useApp();
  
  const analytics = useMemo(() => {
    return calculateOverallAnalytics(medications);
  }, [medications]);
  
  const insights = useMemo(() => {
    return generateInsights(analytics);
  }, [analytics]);
  
  if (medications.length === 0) {
    return (
      <div className="text-center py-8">
        <BarChart3 className="w-12 h-12 mx-auto text-muted-foreground mb-3" />
        <p className="text-muted-foreground">Add medications to see analytics</p>
      </div>
    );
  }
  
  if (compact) {
    return (
      <div className="grid grid-cols-3 gap-4">
        <div className="text-center">
          <AdherenceCircle value={analytics.todayAdherence} size="sm" />
          <p className="text-xs text-muted-foreground mt-1">Today</p>
        </div>
        <div className="text-center">
          <div className="text-2xl font-bold text-secondary">{analytics.currentStreak}</div>
          <p className="text-xs text-muted-foreground">Day Streak</p>
        </div>
        <div className="text-center">
          <div className="text-2xl font-bold">{analytics.weeklyAverage}%</div>
          <p className="text-xs text-muted-foreground">Weekly Avg</p>
        </div>
      </div>
    );
  }
  
  return (
    <div className="space-y-6">
      {/* Header with main stats */}
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-lg flex items-center gap-2">
          <BarChart3 className="w-5 h-5 text-primary" />
          Adherence Analytics
        </h3>
        <div className="flex items-center gap-2">
          {analytics.isImproving ? (
            <span className="flex items-center gap-1 text-sm text-green-600 dark:text-green-400">
              <TrendingUp className="w-4 h-4" />
              Improving
            </span>
          ) : (
            <span className="flex items-center gap-1 text-sm text-amber-600 dark:text-amber-400">
              <TrendingDown className="w-4 h-4" />
              Needs attention
            </span>
          )}
        </div>
      </div>
      
      {/* Main Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="rounded-xl bg-gradient-to-br from-primary/10 to-primary/5 p-4 text-center">
          <AdherenceCircle value={analytics.todayAdherence} size="md" />
          <p className="text-sm font-medium mt-2">Today's Adherence</p>
          <p className="text-xs text-muted-foreground">
            {analytics.todayTaken}/{analytics.todayScheduled} doses
          </p>
        </div>
        
        <div className="rounded-xl bg-gradient-to-br from-secondary/10 to-secondary/5 p-4 text-center">
          <div className="w-16 h-16 mx-auto rounded-full bg-secondary/20 flex items-center justify-center mb-2">
            <Award className="w-8 h-8 text-secondary" />
          </div>
          <p className="text-2xl font-bold">{analytics.currentStreak}</p>
          <p className="text-sm font-medium">Day Streak</p>
          <p className="text-xs text-muted-foreground">Best: {analytics.bestStreak}</p>
        </div>
        
        <div className="rounded-xl bg-gradient-to-br from-green-500/10 to-green-500/5 p-4 text-center">
          <div className="w-16 h-16 mx-auto rounded-full bg-green-500/20 flex items-center justify-center mb-2">
            <CheckCircle2 className="w-8 h-8 text-green-500" />
          </div>
          <p className="text-2xl font-bold text-green-600">{analytics.todayTaken}</p>
          <p className="text-sm font-medium">Doses Taken</p>
          <p className="text-xs text-muted-foreground">Today</p>
        </div>
        
        <div className="rounded-xl bg-gradient-to-br from-amber-500/10 to-amber-500/5 p-4 text-center">
          <div className="w-16 h-16 mx-auto rounded-full bg-amber-500/20 flex items-center justify-center mb-2">
            <Clock className="w-8 h-8 text-amber-500" />
          </div>
          <p className="text-2xl font-bold text-amber-600">{analytics.todayMissed}</p>
          <p className="text-sm font-medium">Pending</p>
          <p className="text-xs text-muted-foreground">Still to take</p>
        </div>
      </div>
      
      {/* Weekly Chart */}
      {showWeeklyChart && (
        <div className="rounded-xl border border-border p-4">
          <div className="flex items-center justify-between mb-4">
            <h4 className="font-medium flex items-center gap-2">
              <Calendar className="w-4 h-4 text-muted-foreground" />
              Last 7 Days
            </h4>
            <span className="text-sm text-muted-foreground">
              Avg: {analytics.weeklyAverage}%
            </span>
          </div>
          <WeeklyChart data={analytics.weeklyTrend} />
        </div>
      )}
      
      {/* Time Slot Breakdown */}
      {showTimeSlots && (
        <div className="rounded-xl border border-border p-4">
          <h4 className="font-medium flex items-center gap-2 mb-4">
            <Clock className="w-4 h-4 text-muted-foreground" />
            Time of Day Performance
          </h4>
          <div className="space-y-2">
            {analytics.timeSlotPatterns
              .filter(s => s.scheduledCount > 0)
              .map((slot) => (
                <TimeSlotIndicator key={slot.timeSlot} slot={slot} />
              ))}
          </div>
          
          {/* Weakest slot tip */}
          {analytics.weakestTimeSlot && analytics.weakestTimeSlot.adherenceRate < 70 && (
            <div className="mt-4 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 p-3">
              <div className="flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                <p className="text-sm text-amber-700 dark:text-amber-400">
                  Your {analytics.weakestTimeSlot.timeSlot} doses have the lowest adherence. 
                  Try setting an extra reminder for this time.
                </p>
              </div>
            </div>
          )}
        </div>
      )}
      
      {/* Insights */}
      {showInsights && insights.length > 0 && (
        <div className="rounded-xl border border-border p-4">
          <h4 className="font-medium flex items-center gap-2 mb-4">
            <Lightbulb className="w-4 h-4 text-amber-500" />
            Insights
          </h4>
          <div className="space-y-3">
            {insights.map((insight, index) => (
              <div 
                key={index}
                className="flex items-start gap-3 p-3 rounded-lg bg-muted/50"
              >
                <Zap className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                <p className="text-sm">{insight}</p>
              </div>
            ))}
          </div>
        </div>
      )}
      
      {/* Prescription Status Summary */}
      {(analytics.expiringSoon.length > 0 || analytics.needsRefill.length > 0) && (
        <div className="rounded-xl border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/30 p-4">
          <h4 className="font-medium flex items-center gap-2 mb-3">
            <Target className="w-4 h-4 text-amber-600" />
            Prescription Status
          </h4>
          <div className="grid grid-cols-2 gap-4 text-center">
            <div>
              <p className="text-2xl font-bold text-amber-600">{analytics.needsRefill.length}</p>
              <p className="text-xs text-muted-foreground">Need Refill Soon</p>
            </div>
            <div>
              <p className="text-2xl font-bold">{analytics.activeMedications}</p>
              <p className="text-xs text-muted-foreground">Active Prescriptions</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

