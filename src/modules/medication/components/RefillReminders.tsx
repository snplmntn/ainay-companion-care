// ============================================
// Refill Reminders Component
// Shows prescriptions that need to be refilled soon
// ============================================

import React, { useMemo } from "react";
import { 
  AlertTriangle, 
  Calendar, 
  Clock, 
  Pill, 
  Bell,
  ExternalLink,
  ChevronRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useApp } from "@/contexts/AppContext";
import { getRefillReminders, type RefillReminder } from "../services/analyticsService";
import { CATEGORY_COLORS, CATEGORY_LABELS } from "@/types";
import type { MedicationCategory } from "@/types";

interface RefillRemindersProps {
  /** Maximum number of reminders to show */
  maxItems?: number;
  /** Whether to show in compact mode */
  compact?: boolean;
  /** Callback when user clicks on a reminder */
  onReminderClick?: (reminder: RefillReminder) => void;
}

export function RefillReminders({ 
  maxItems = 5, 
  compact = false,
  onReminderClick,
}: RefillRemindersProps) {
  const { medications } = useApp();
  
  const reminders = useMemo(() => {
    return getRefillReminders(medications).slice(0, maxItems);
  }, [medications, maxItems]);
  
  if (reminders.length === 0) {
    return null; // Don't show anything if no refills needed
  }
  
  const getUrgencyStyles = (urgency: RefillReminder["urgency"]) => {
    switch (urgency) {
      case "critical":
        return {
          bg: "bg-red-50 dark:bg-red-950/30",
          border: "border-red-200 dark:border-red-800",
          icon: "text-red-600 dark:text-red-400",
          text: "text-red-700 dark:text-red-400",
          badge: "bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-400",
        };
      case "warning":
        return {
          bg: "bg-amber-50 dark:bg-amber-950/30",
          border: "border-amber-200 dark:border-amber-800",
          icon: "text-amber-600 dark:text-amber-400",
          text: "text-amber-700 dark:text-amber-400",
          badge: "bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-400",
        };
      case "info":
      default:
        return {
          bg: "bg-blue-50 dark:bg-blue-950/30",
          border: "border-blue-200 dark:border-blue-800",
          icon: "text-blue-600 dark:text-blue-400",
          text: "text-blue-700 dark:text-blue-400",
          badge: "bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-400",
        };
    }
  };
  
  const getUrgencyLabel = (urgency: RefillReminder["urgency"], daysRemaining: number) => {
    if (daysRemaining === 0) return "Ends today!";
    if (daysRemaining === 1) return "Ends tomorrow";
    return `${daysRemaining} days left`;
  };
  
  const criticalCount = reminders.filter(r => r.urgency === "critical").length;
  
  if (compact) {
    return (
      <div className="rounded-xl border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/30 p-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-amber-100 dark:bg-amber-900/50 flex items-center justify-center">
            <Bell className="w-5 h-5 text-amber-600 dark:text-amber-400" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-amber-700 dark:text-amber-400">
              {reminders.length} Refill{reminders.length > 1 ? "s" : ""} Needed
            </p>
            <p className="text-sm text-amber-600 dark:text-amber-500 truncate">
              {reminders.map(r => r.medicationName).join(", ")}
            </p>
          </div>
          {criticalCount > 0 && (
            <span className="shrink-0 px-2 py-1 rounded-full bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-400 text-xs font-semibold">
              {criticalCount} urgent
            </span>
          )}
        </div>
      </div>
    );
  }
  
  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Bell className="w-5 h-5 text-amber-600 dark:text-amber-400" />
          <h3 className="font-semibold text-lg">Refill Reminders</h3>
          <span className="px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-900/50 text-amber-700 dark:text-amber-400 text-xs font-semibold">
            {reminders.length}
          </span>
        </div>
      </div>
      
      {/* Critical Alert Banner */}
      {criticalCount > 0 && (
        <div className="rounded-xl bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 p-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-red-600 dark:text-red-400 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-red-700 dark:text-red-400">
                {criticalCount} prescription{criticalCount > 1 ? "s" : ""} ending very soon!
              </p>
              <p className="text-sm text-red-600 dark:text-red-500 mt-1">
                Contact your doctor or pharmacy immediately to arrange refills.
              </p>
            </div>
          </div>
        </div>
      )}
      
      {/* Reminder Cards */}
      <div className="space-y-3">
        {reminders.map((reminder) => {
          const styles = getUrgencyStyles(reminder.urgency);
          const category = reminder.category as MedicationCategory;
          
          return (
            <div
              key={reminder.medicationId}
              className={`rounded-xl border ${styles.border} ${styles.bg} p-4 transition-all hover:shadow-md cursor-pointer`}
              onClick={() => onReminderClick?.(reminder)}
            >
              <div className="flex items-center gap-4">
                {/* Icon */}
                <div className={`w-12 h-12 rounded-xl ${styles.badge} flex items-center justify-center`}>
                  <Pill className={`w-6 h-6 ${styles.icon}`} />
                </div>
                
                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <p className="font-semibold truncate">{reminder.medicationName}</p>
                    <span className={`text-xs px-2 py-0.5 rounded-full border ${CATEGORY_COLORS[category]}`}>
                      {CATEGORY_LABELS[category]}
                    </span>
                  </div>
                  <div className="flex items-center gap-4 text-sm text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Calendar className="w-4 h-4" />
                      Ends: {new Date(reminder.endDate).toLocaleDateString()}
                    </span>
                  </div>
                </div>
                
                {/* Days Badge */}
                <div className="text-right shrink-0">
                  <span className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-sm font-semibold ${styles.badge}`}>
                    <Clock className="w-4 h-4" />
                    {getUrgencyLabel(reminder.urgency, reminder.daysRemaining)}
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
      
      {/* Action Tip */}
      <div className="rounded-xl bg-muted/50 p-4">
        <div className="flex items-start gap-3">
          <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
            <ExternalLink className="w-4 h-4 text-primary" />
          </div>
          <div>
            <p className="font-medium text-sm">Need a refill?</p>
            <p className="text-xs text-muted-foreground mt-1">
              Contact your doctor at least 3-5 days before your prescription ends to ensure continuous coverage.
              For maintenance medications, consider asking about 90-day supplies.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

