// ============================================
// Alarm Scheduler Component
// ============================================

import React, { useState, useMemo } from "react";
import {
  Clock,
  Bell,
  ChevronLeft,
  Check,
  Sunrise,
  Sun,
  Sunset,
  Moon,
  RotateCcw,
  ArrowRight,
  ChevronUp,
  ChevronDown,
  Calendar,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import type {
  MedicineFormData,
  MedicationSchedule,
  NextDayMode,
} from "../types";
import { NEXT_DAY_MODE_OPTIONS, FREQUENCY_OPTIONS, getIntervalForFrequency } from "../constants";
import {
  calculateDoseTimes,
  formatTime12Hour,
  createMedicationSchedule,
  addMinutesToTime,
  parseTime,
  getDosesPerDay,
} from "../services/scheduleService";

interface Props {
  medicine: MedicineFormData;
  onScheduleSet: (schedule: Omit<MedicationSchedule, "id" | "medicationId">) => void;
  onBack: () => void;
}

export function AlarmScheduler({ medicine, onScheduleSet, onBack }: Props) {
  const [startHour, setStartHour] = useState(() => {
    const { hours } = parseTime(medicine.startTime || "08:00");
    return hours;
  });
  const [startMinute, setStartMinute] = useState(() => {
    const { minutes } = parseTime(medicine.startTime || "08:00");
    return minutes;
  });
  const [period, setPeriod] = useState<"AM" | "PM">(() => {
    const { hours } = parseTime(medicine.startTime || "08:00");
    return hours >= 12 ? "PM" : "AM";
  });
  const [nextDayMode, setNextDayMode] = useState<NextDayMode>(
    medicine.nextDayMode || "restart"
  );

  // Convert 12-hour display to 24-hour for internal use
  const get24Hour = () => {
    let hour = startHour;
    if (period === "PM" && hour !== 12) hour += 12;
    if (period === "AM" && hour === 12) hour = 0;
    return hour;
  };

  // Build start time string from hour/minute
  const startTime = `${get24Hour().toString().padStart(2, "0")}:${startMinute.toString().padStart(2, "0")}`;

  // Calculate preview doses
  const previewDoses = useMemo(() => {
    return calculateDoseTimes(
      startTime,
      medicine.frequency,
      medicine.customFrequency,
      nextDayMode
    );
  }, [startTime, medicine.frequency, medicine.customFrequency, nextDayMode]);

  // Get frequency info
  const frequencyInfo = FREQUENCY_OPTIONS.find(
    (opt) => opt.value === medicine.frequency
  );
  
  const dosesPerDay = getDosesPerDay(medicine.frequency, medicine.customFrequency);
  const intervalMinutes = getIntervalForFrequency(medicine.frequency, medicine.customFrequency);
  const intervalHours = Math.floor(intervalMinutes / 60);
  const intervalMins = intervalMinutes % 60;

  // Calculate next day preview (first dose)
  const nextDayFirstDose = useMemo(() => {
    if (previewDoses.length === 0) return null;
    const lastDoseTime = previewDoses[previewDoses.length - 1].time;
    
    if (nextDayMode === "restart") {
      return startTime;
    } else {
      // Continue mode: add interval to last dose
      return addMinutesToTime(lastDoseTime, intervalMinutes);
    }
  }, [previewDoses, nextDayMode, startTime, intervalMinutes]);

  const getDoseIcon = (time: string) => {
    const hour = parseInt(time.split(":")[0]);
    if (hour >= 5 && hour < 9) return <Sunrise className="w-4 h-4 text-orange-500" />;
    if (hour >= 9 && hour < 17) return <Sun className="w-4 h-4 text-yellow-500" />;
    if (hour >= 17 && hour < 20) return <Sunset className="w-4 h-4 text-orange-600" />;
    return <Moon className="w-4 h-4 text-indigo-500" />;
  };

  const adjustHour = (delta: number) => {
    setStartHour((prev) => {
      let newHour = prev + delta;
      if (newHour < 1) newHour = 12;
      if (newHour > 12) newHour = 1;
      return newHour;
    });
  };

  const adjustMinute = (delta: number) => {
    setStartMinute((prev) => {
      const newMin = prev + delta;
      if (newMin < 0) return 45;
      if (newMin >= 60) return 0;
      return newMin;
    });
  };

  const handleConfirm = () => {
    const schedule = createMedicationSchedule({
      ...medicine,
      startTime,
      nextDayMode,
    });

    onScheduleSet({
      frequency: schedule.frequency,
      customFrequency: schedule.customFrequency,
      startTime: schedule.startTime,
      nextDayMode: schedule.nextDayMode,
      intervalMinutes: schedule.intervalMinutes,
      doses: schedule.doses,
      isActive: true,
      createdAt: schedule.createdAt,
      updatedAt: schedule.updatedAt,
    });
  };

  // Format interval display
  const formatInterval = () => {
    if (intervalHours === 0) return `${intervalMins} minutes`;
    if (intervalMins === 0) return `${intervalHours} hours`;
    return `${intervalHours}h ${intervalMins}m`;
  };

  return (
    <div className="bg-card rounded-2xl border border-border overflow-hidden">
      {/* Header */}
      <div className="bg-gradient-to-r from-primary/10 to-secondary/10 px-6 py-4 border-b border-border">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={onBack}>
            <ChevronLeft className="w-5 h-5" />
          </Button>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center">
              <Bell className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h3 className="font-bold text-lg">Set Alarm Schedule</h3>
              <p className="text-sm text-muted-foreground">
                {medicine.name} - {medicine.dosage}
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="p-6 space-y-6">
        {/* Frequency Summary with Interval */}
        <div className="bg-gradient-to-br from-primary/5 to-secondary/5 rounded-xl p-4 border border-primary/20">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <Clock className="w-5 h-5 text-primary" />
                <span className="font-bold text-lg">
                  {frequencyInfo?.label || "Daily"}
                </span>
              </div>
              <p className="text-sm text-muted-foreground">
                {frequencyInfo?.description}
              </p>
            </div>
            {dosesPerDay > 1 && (
              <div className="text-right">
                <div className="text-xs text-muted-foreground">Interval</div>
                <div className="font-bold text-primary">{formatInterval()}</div>
              </div>
            )}
          </div>
        </div>

        {/* Start Time Selection - Wheel-style Picker */}
        <div>
          <label className="text-sm font-semibold text-muted-foreground mb-3 block">
            First dose time
          </label>

          <div className="bg-muted/30 rounded-2xl p-6 border-2 border-primary/20">
            <div className="flex items-center justify-center gap-2">
              {/* Hour Selector */}
              <div className="flex flex-col items-center">
                <button
                  type="button"
                  onClick={() => adjustHour(1)}
                  className="p-2 hover:bg-muted rounded-lg transition-colors"
                >
                  <ChevronUp className="w-6 h-6 text-muted-foreground" />
                </button>
                <div className="text-5xl font-bold tabular-nums w-20 text-center py-2">
                  {startHour.toString().padStart(2, "0")}
                </div>
                <button
                  type="button"
                  onClick={() => adjustHour(-1)}
                  className="p-2 hover:bg-muted rounded-lg transition-colors"
                >
                  <ChevronDown className="w-6 h-6 text-muted-foreground" />
                </button>
              </div>

              <div className="text-5xl font-bold text-muted-foreground">:</div>

              {/* Minute Selector */}
              <div className="flex flex-col items-center">
                <button
                  type="button"
                  onClick={() => adjustMinute(15)}
                  className="p-2 hover:bg-muted rounded-lg transition-colors"
                >
                  <ChevronUp className="w-6 h-6 text-muted-foreground" />
                </button>
                <div className="text-5xl font-bold tabular-nums w-20 text-center py-2">
                  {startMinute.toString().padStart(2, "0")}
                </div>
                <button
                  type="button"
                  onClick={() => adjustMinute(-15)}
                  className="p-2 hover:bg-muted rounded-lg transition-colors"
                >
                  <ChevronDown className="w-6 h-6 text-muted-foreground" />
                </button>
              </div>

              {/* AM/PM Selector */}
              <div className="flex flex-col gap-1 ml-2">
                <button
                  type="button"
                  onClick={() => setPeriod("AM")}
                  className={`px-4 py-2 rounded-lg font-bold transition-all ${
                    period === "AM"
                      ? "bg-primary text-white"
                      : "bg-muted hover:bg-muted/80 text-muted-foreground"
                  }`}
                >
                  AM
                </button>
                <button
                  type="button"
                  onClick={() => setPeriod("PM")}
                  className={`px-4 py-2 rounded-lg font-bold transition-all ${
                    period === "PM"
                      ? "bg-primary text-white"
                      : "bg-muted hover:bg-muted/80 text-muted-foreground"
                  }`}
                >
                  PM
                </button>
              </div>
            </div>

            {/* Quick Time Presets */}
            <div className="mt-4 pt-4 border-t border-border">
              <div className="text-xs text-muted-foreground mb-2 text-center">Quick select</div>
              <div className="flex flex-wrap justify-center gap-2">
                {[
                  { h: 6, m: 0, p: "AM" as const, icon: Sunrise },
                  { h: 8, m: 0, p: "AM" as const, icon: Sunrise },
                  { h: 9, m: 0, p: "AM" as const, icon: Sun },
                  { h: 12, m: 0, p: "PM" as const, icon: Sun },
                  { h: 6, m: 0, p: "PM" as const, icon: Sunset },
                  { h: 8, m: 0, p: "PM" as const, icon: Moon },
                ].map((preset) => (
                  <button
                    key={`${preset.h}-${preset.p}`}
                    type="button"
                    onClick={() => {
                      setStartHour(preset.h);
                      setStartMinute(preset.m);
                      setPeriod(preset.p);
                    }}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm transition-all ${
                      startHour === preset.h && startMinute === preset.m && period === preset.p
                        ? "bg-primary text-white"
                        : "bg-muted hover:bg-muted/80"
                    }`}
                  >
                    <preset.icon className="w-3.5 h-3.5" />
                    {preset.h === 12 ? 12 : preset.h}:00 {preset.p}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Today's Schedule Preview */}
        <div>
          <div className="flex items-center gap-2 mb-3">
            <Calendar className="w-4 h-4 text-primary" />
            <label className="text-sm font-semibold text-muted-foreground">
              Today's Schedule
            </label>
          </div>
          <div className="space-y-2">
            {previewDoses.map((dose, index) => (
              <div
                key={dose.id}
                className="flex items-center gap-4 p-3 rounded-xl bg-muted/30 border border-border"
              >
                <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center">
                  {getDoseIcon(dose.time)}
                </div>
                <div className="flex-1">
                  <div className="font-bold text-lg">
                    {formatTime12Hour(dose.time)}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {dose.label} • Dose {index + 1} of {previewDoses.length}
                  </div>
                </div>
                {index > 0 && (
                  <div className="text-xs text-primary/70 bg-primary/10 px-2 py-1 rounded-full">
                    +{formatInterval()}
                  </div>
                )}
                <Bell className="w-5 h-5 text-muted-foreground" />
              </div>
            ))}
          </div>

          {/* Visual Timeline */}
          {previewDoses.length > 1 && (
            <div className="mt-4 px-4">
              <div className="relative h-2 bg-muted rounded-full overflow-hidden">
                {previewDoses.map((dose, idx) => {
                  const { hours, minutes } = parseTime(dose.time);
                  const totalMins = hours * 60 + minutes;
                  const percentage = ((totalMins - 6 * 60) / (16 * 60)) * 100; // 6am to 10pm range
                  return (
                    <div
                      key={dose.id}
                      className="absolute w-3 h-3 rounded-full bg-primary -top-0.5 transform -translate-x-1/2"
                      style={{ left: `${Math.min(100, Math.max(0, percentage))}%` }}
                      title={formatTime12Hour(dose.time)}
                    />
                  );
                })}
              </div>
              <div className="flex justify-between mt-1 text-xs text-muted-foreground">
                <span>6 AM</span>
                <span>12 PM</span>
                <span>6 PM</span>
                <span>10 PM</span>
              </div>
            </div>
          )}
        </div>

        {/* Next Day Behavior */}
        {medicine.frequency !== "as_needed" &&
          medicine.frequency !== "once_daily" && (
            <div>
              <label className="text-sm font-semibold text-muted-foreground mb-3 block">
                Next day behavior
              </label>
              <div className="space-y-3">
                {NEXT_DAY_MODE_OPTIONS.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setNextDayMode(option.value)}
                    className={`w-full flex items-start gap-4 p-4 rounded-xl border-2 text-left transition-all ${
                      nextDayMode === option.value
                        ? "border-primary bg-primary/5"
                        : "border-border hover:border-primary/50"
                    }`}
                  >
                    <div
                      className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 mt-0.5 ${
                        nextDayMode === option.value
                          ? "border-primary bg-primary"
                          : "border-muted-foreground"
                      }`}
                    >
                      {nextDayMode === option.value && (
                        <Check className="w-3 h-3 text-white" />
                      )}
                    </div>
                    <div className="flex-1">
                      <div className="font-semibold flex items-center gap-2">
                        {option.value === "restart" ? (
                          <RotateCcw className="w-4 h-4" />
                        ) : (
                          <ArrowRight className="w-4 h-4" />
                        )}
                        {option.label}
                      </div>
                      <div className="text-sm text-muted-foreground mt-1">
                        {option.description}
                      </div>
                    </div>
                  </button>
                ))}
              </div>

              {/* Next Day Preview */}
              {nextDayFirstDose && (
                <div className={`mt-3 p-4 rounded-xl border ${
                  nextDayMode === "continue" 
                    ? "bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800"
                    : "bg-green-50 dark:bg-green-950/30 border-green-200 dark:border-green-800"
                }`}>
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-white dark:bg-gray-800 flex items-center justify-center">
                      {getDoseIcon(nextDayFirstDose)}
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground">
                        Tomorrow's first dose
                      </div>
                      <div className={`font-bold text-lg ${
                        nextDayMode === "continue" 
                          ? "text-amber-700 dark:text-amber-300"
                          : "text-green-700 dark:text-green-300"
                      }`}>
                        {formatTime12Hour(nextDayFirstDose)}
                      </div>
                    </div>
                  </div>
                  {nextDayMode === "continue" && previewDoses.length > 0 && (
                    <p className="text-xs text-amber-700 dark:text-amber-300 mt-2">
                      From last dose at {formatTime12Hour(previewDoses[previewDoses.length - 1].time)} + {formatInterval()}
                    </p>
                  )}
                </div>
              )}
            </div>
          )}

        {/* Confirm Button */}
        <Button variant="coral" size="lg" className="w-full" onClick={handleConfirm}>
          <Bell className="w-5 h-5 mr-2" />
          Set Alarm Schedule
        </Button>
      </div>
    </div>
  );
}
