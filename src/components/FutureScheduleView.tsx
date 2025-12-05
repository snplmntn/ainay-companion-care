import React, { useState, useMemo } from "react";
import { ChevronLeft, ChevronRight, Clock, Pill, Calendar } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useApp } from "@/contexts/AppContext";
import { CATEGORY_COLORS, type Medication } from "@/types";
import {
  calculateDoseTimes,
  addMinutesToTime,
  formatTime12Hour,
} from "@/modules/medication/services/scheduleService";
import type { FrequencyType, NextDayMode } from "@/modules/medication/types";

interface FutureDoseEntry {
  medicationId: string;
  name: string;
  dosage: string;
  time: string;
  timeSort: number;
  label: string;
  category: string;
  imageUrl?: string;
  instructions?: string;
}

// Convert time string to minutes from midnight for sorting
function timeToMinutes(timeStr: string): number {
  const match = timeStr.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)?$/i);
  if (!match) return 0;

  let hours = parseInt(match[1], 10);
  const minutes = parseInt(match[2], 10);
  const period = match[3]?.toUpperCase();

  if (period === "PM" && hours !== 12) hours += 12;
  if (period === "AM" && hours === 12) hours = 0;

  return hours * 60 + minutes;
}

// Get the next N days starting from today
function getUpcomingDays(count: number): Date[] {
  const days: Date[] = [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  for (let i = 0; i < count; i++) {
    const date = new Date(today);
    date.setDate(today.getDate() + i);
    days.push(date);
  }

  return days;
}

// Format date for display
function formatDateShort(date: Date): string {
  return date.toLocaleDateString("en-US", {
    weekday: "short",
    day: "numeric",
  });
}

function formatDateFull(date: Date): string {
  return date.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
}

// Check if two dates are the same day
function isSameDay(date1: Date, date2: Date): boolean {
  return (
    date1.getFullYear() === date2.getFullYear() &&
    date1.getMonth() === date2.getMonth() &&
    date1.getDate() === date2.getDate()
  );
}

// Check if date is today
function isToday(date: Date): boolean {
  return isSameDay(date, new Date());
}

interface Props {
  daysToShow?: number;
}

export function FutureScheduleView({ daysToShow = 7 }: Props) {
  const { medications } = useApp();
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [weekOffset, setWeekOffset] = useState(0);

  // Get days to display in the date selector
  const visibleDays = useMemo(() => {
    const startDate = new Date();
    startDate.setHours(0, 0, 0, 0);
    startDate.setDate(startDate.getDate() + weekOffset * 7);

    const days: Date[] = [];
    for (let i = 0; i < daysToShow; i++) {
      const date = new Date(startDate);
      date.setDate(startDate.getDate() + i);
      days.push(date);
    }
    return days;
  }, [weekOffset, daysToShow]);

  // Calculate doses for a specific medication on a given date
  const calculateMedicationDosesForDate = (
    med: Medication,
    targetDate: Date
  ): FutureDoseEntry[] => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const targetDay = new Date(targetDate);
    targetDay.setHours(0, 0, 0, 0);

    const daysDiff = Math.floor(
      (targetDay.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
    );

    // Skip medications that aren't active
    if (!med.isActive) return [];

    // Handle different frequency types
    const frequency = (med.frequency || "once_daily") as FrequencyType;
    const nextDayMode = (med.nextDayMode || "restart") as NextDayMode;

    // For weekly medications, only show on the right day
    if (frequency === "weekly") {
      // Assuming weekly starts from when medication was added
      if (daysDiff % 7 !== 0) return [];
    }

    // For every_other_day, only show on alternate days
    if (frequency === "every_other_day") {
      if (daysDiff % 2 !== 0) return [];
    }

    // For "as_needed" medications, don't show in future
    if (frequency === "as_needed" && daysDiff > 0) {
      return [];
    }

    // Get start time - prefer schedule doses or startTime, fallback to time
    let startTime = med.startTime || med.time || "08:00";

    // Convert to 24h format if needed
    if (startTime.includes("AM") || startTime.includes("PM")) {
      const match = startTime.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
      if (match) {
        let hours = parseInt(match[1], 10);
        const mins = match[2];
        const period = match[3].toUpperCase();
        if (period === "PM" && hours !== 12) hours += 12;
        if (period === "AM" && hours === 12) hours = 0;
        startTime = `${hours.toString().padStart(2, "0")}:${mins}`;
      }
    }

    // Calculate doses for this day based on mode
    let doses;
    if (daysDiff === 0) {
      // Today - use existing doses if available
      if (med.doses && med.doses.length > 0) {
        return med.doses.map((dose) => ({
          medicationId: med.id,
          name: med.name,
          dosage: med.dosage,
          time: formatTime12Hour(dose.time),
          timeSort: timeToMinutes(dose.time),
          label: dose.label || "Dose",
          category: med.category || "medicine",
          imageUrl: med.imageUrl,
          instructions: med.instructions,
        }));
      }
      doses = calculateDoseTimes(startTime, frequency, med.customFrequency, nextDayMode);
    } else if (nextDayMode === "restart") {
      // Restart mode - same times every day
      doses = calculateDoseTimes(startTime, frequency, med.customFrequency, nextDayMode);
    } else {
      // Continue mode - calculate based on last dose time rolling over
      // For simplicity, we'll calculate what the first dose would be
      const lastDoseOfPrevDay = med.doses?.[med.doses.length - 1]?.time || startTime;
      let rollingTime = lastDoseOfPrevDay;
      const interval = med.intervalMinutes || 480; // Default 8 hours

      // Roll forward by number of days
      for (let d = 0; d < daysDiff; d++) {
        // Add doses for each day until we reach target
        const dailyDoses = calculateDoseTimes(
          rollingTime,
          frequency,
          med.customFrequency,
          nextDayMode
        );
        if (dailyDoses.length > 0) {
          rollingTime = addMinutesToTime(
            dailyDoses[dailyDoses.length - 1].time,
            interval
          );
        }
      }

      doses = calculateDoseTimes(rollingTime, frequency, med.customFrequency, nextDayMode);
    }

    return doses.map((dose) => ({
      medicationId: med.id,
      name: med.name,
      dosage: med.dosage,
      time: formatTime12Hour(dose.time),
      timeSort: timeToMinutes(dose.time),
      label: dose.label,
      category: med.category || "medicine",
      imageUrl: med.imageUrl,
      instructions: med.instructions,
    }));
  };

  // Get all doses for the selected date
  const dosesForSelectedDate = useMemo(() => {
    const allDoses: FutureDoseEntry[] = [];

    for (const med of medications) {
      const medDoses = calculateMedicationDosesForDate(med, selectedDate);
      allDoses.push(...medDoses);
    }

    // Sort by time
    return allDoses.sort((a, b) => a.timeSort - b.timeSort);
  }, [medications, selectedDate]);

  // Group by category
  const groupedByCategory = useMemo(() => {
    return dosesForSelectedDate.reduce((acc, dose) => {
      if (!acc[dose.category]) {
        acc[dose.category] = [];
      }
      acc[dose.category].push(dose);
      return acc;
    }, {} as Record<string, FutureDoseEntry[]>);
  }, [dosesForSelectedDate]);

  const categoryOrder = ["medicine", "vitamin", "supplement", "herbal", "other"];
  const sortedCategories = Object.keys(groupedByCategory).sort(
    (a, b) => categoryOrder.indexOf(a) - categoryOrder.indexOf(b)
  );

  if (medications.length === 0) {
    return null;
  }

  return (
    <div className="space-y-4">
      {/* Section Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-senior-lg font-bold flex items-center gap-2">
          <Calendar className="w-5 h-5 text-primary" />
          Upcoming Schedule
        </h3>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => setWeekOffset((prev) => prev - 1)}
            disabled={weekOffset <= 0}
          >
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => setWeekOffset((prev) => prev + 1)}
            disabled={weekOffset >= 3} // Max 4 weeks ahead
          >
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Date Selector */}
      <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-none">
        {visibleDays.map((date) => {
          const isSelected = isSameDay(date, selectedDate);
          const todayFlag = isToday(date);

          return (
            <button
              key={date.toISOString()}
              onClick={() => setSelectedDate(date)}
              className={`flex flex-col items-center min-w-[60px] py-2 px-3 rounded-xl transition-all ${
                isSelected
                  ? "bg-primary text-primary-foreground shadow-lg"
                  : todayFlag
                  ? "bg-primary/10 text-primary border-2 border-primary"
                  : "bg-muted/50 text-muted-foreground hover:bg-muted"
              }`}
            >
              <span className="text-xs font-medium">
                {todayFlag ? "Today" : date.toLocaleDateString("en-US", { weekday: "short" })}
              </span>
              <span className="text-lg font-bold">{date.getDate()}</span>
              <span className="text-xs">
                {date.toLocaleDateString("en-US", { month: "short" })}
              </span>
            </button>
          );
        })}
      </div>

      {/* Selected Date Header */}
      <div className="bg-muted/30 rounded-xl p-3">
        <p className="text-sm font-medium text-center">
          {isToday(selectedDate) ? "Today's" : formatDateFull(selectedDate)} Schedule
        </p>
        <p className="text-xs text-muted-foreground text-center mt-1">
          {dosesForSelectedDate.length} dose{dosesForSelectedDate.length !== 1 ? "s" : ""} scheduled
        </p>
      </div>

      {/* Doses List */}
      {dosesForSelectedDate.length === 0 ? (
        <div className="text-center py-8 bg-muted/20 rounded-xl">
          <Clock className="w-10 h-10 mx-auto text-muted-foreground mb-2" />
          <p className="text-muted-foreground">No medications scheduled for this day</p>
        </div>
      ) : (
        <div className="space-y-4">
          {sortedCategories.map((category) => {
            const categoryDoses = groupedByCategory[category];

            return (
              <div key={category} className="space-y-2">
                {/* Category Badge */}
                <span
                  className={`inline-block text-xs px-2 py-1 rounded-full border font-medium ${
                    CATEGORY_COLORS[category as keyof typeof CATEGORY_COLORS] ||
                    "bg-muted text-muted-foreground"
                  }`}
                >
                  {category.charAt(0).toUpperCase() + category.slice(1)}
                </span>

                {/* Dose Cards */}
                <div className="space-y-2">
                  {categoryDoses.map((dose, index) => (
                    <div
                      key={`${dose.medicationId}-${index}`}
                      className="flex items-center gap-3 p-3 bg-card rounded-xl border border-border"
                    >
                      {/* Time */}
                      <div className="flex flex-col items-center min-w-[50px] text-primary">
                        <span className="text-sm font-bold">
                          {dose.time.split(" ")[0]}
                        </span>
                        <span className="text-xs font-medium">
                          {dose.time.split(" ")[1]}
                        </span>
                      </div>

                      {/* Divider */}
                      <div className="w-0.5 h-10 bg-primary/20 rounded-full" />

                      {/* Medicine Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <Pill className="w-4 h-4 text-primary shrink-0" />
                          <span className="font-semibold truncate">{dose.name}</span>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {dose.dosage}
                          {dose.label && dose.label !== "Dose" && dose.label !== "Daily" && (
                            <span className="ml-2 text-xs px-1.5 py-0.5 rounded bg-muted">
                              {dose.label}
                            </span>
                          )}
                        </p>
                      </div>

                      {/* Image if available */}
                      {dose.imageUrl && (
                        <img
                          src={dose.imageUrl}
                          alt={dose.name}
                          className="w-10 h-10 rounded-lg object-cover border border-border"
                        />
                      )}
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

