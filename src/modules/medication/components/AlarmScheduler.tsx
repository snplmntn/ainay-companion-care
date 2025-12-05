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
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import type {
  MedicineFormData,
  MedicationSchedule,
  NextDayMode,
  ScheduledDose,
} from "../types";
import { NEXT_DAY_MODE_OPTIONS, FREQUENCY_OPTIONS } from "../constants";
import {
  calculateDoseTimes,
  formatTime12Hour,
  createMedicationSchedule,
} from "../services/scheduleService";

interface Props {
  medicine: MedicineFormData;
  onScheduleSet: (schedule: Omit<MedicationSchedule, "id" | "medicationId">) => void;
  onBack: () => void;
}

const TIME_PRESETS = [
  { time: "06:00", label: "6 AM", icon: Sunrise },
  { time: "07:00", label: "7 AM", icon: Sunrise },
  { time: "08:00", label: "8 AM", icon: Sun },
  { time: "09:00", label: "9 AM", icon: Sun },
  { time: "10:00", label: "10 AM", icon: Sun },
  { time: "12:00", label: "12 PM", icon: Sun },
];

export function AlarmScheduler({ medicine, onScheduleSet, onBack }: Props) {
  const [startTime, setStartTime] = useState(medicine.startTime || "08:00");
  const [nextDayMode, setNextDayMode] = useState<NextDayMode>(
    medicine.nextDayMode || "restart"
  );
  const [showCustomTime, setShowCustomTime] = useState(false);

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

  const getDoseIcon = (time: string) => {
    const hour = parseInt(time.split(":")[0]);
    if (hour >= 5 && hour < 9) return <Sunrise className="w-4 h-4 text-orange-500" />;
    if (hour >= 9 && hour < 17) return <Sun className="w-4 h-4 text-yellow-500" />;
    if (hour >= 17 && hour < 20) return <Sunset className="w-4 h-4 text-orange-600" />;
    return <Moon className="w-4 h-4 text-indigo-500" />;
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

  return (
    <div className="bg-card rounded-2xl border border-border overflow-hidden">
      {/* Header */}
      <div className="bg-secondary/10 px-6 py-4 border-b border-border">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={onBack}>
            <ChevronLeft className="w-5 h-5" />
          </Button>
          <div className="flex items-center gap-3">
            <Bell className="w-6 h-6 text-secondary" />
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
        {/* Frequency Summary */}
        <div className="bg-muted/50 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <Clock className="w-5 h-5 text-primary" />
            <span className="font-semibold">
              {frequencyInfo?.label || "Daily"}
            </span>
          </div>
          <p className="text-sm text-muted-foreground">
            {frequencyInfo?.description}
          </p>
        </div>

        {/* Start Time Selection */}
        <div>
          <label className="text-sm font-semibold text-muted-foreground mb-3 block">
            When to start? (First dose)
          </label>

          <div className="grid grid-cols-3 gap-2 mb-3">
            {TIME_PRESETS.map((preset) => (
              <button
                key={preset.time}
                type="button"
                onClick={() => {
                  setStartTime(preset.time);
                  setShowCustomTime(false);
                }}
                className={`flex items-center justify-center gap-2 p-3 rounded-xl border-2 transition-all ${
                  startTime === preset.time && !showCustomTime
                    ? "border-primary bg-primary/10"
                    : "border-border hover:border-primary/50"
                }`}
              >
                <preset.icon className="w-4 h-4" />
                <span className="font-medium">{preset.label}</span>
              </button>
            ))}
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setShowCustomTime(true)}
              className={`flex-1 p-3 rounded-xl border-2 text-center transition-all ${
                showCustomTime
                  ? "border-primary bg-primary/10"
                  : "border-border hover:border-primary/50"
              }`}
            >
              <span className="font-medium">Custom time</span>
            </button>
            {showCustomTime && (
              <input
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className="p-3 border-2 border-primary rounded-xl bg-background text-lg font-mono"
              />
            )}
          </div>
        </div>

        {/* Dose Preview */}
        <div>
          <label className="text-sm font-semibold text-muted-foreground mb-3 block">
            Your doses for today
          </label>
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
                  <div className="font-semibold">
                    {formatTime12Hour(dose.time)}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {dose.label} - Dose {index + 1}
                  </div>
                </div>
                <Bell className="w-5 h-5 text-muted-foreground" />
              </div>
            ))}
          </div>
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
                    <div>
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

              {/* Example for continue mode */}
              {nextDayMode === "continue" && (
                <div className="mt-3 p-3 bg-amber-50 dark:bg-amber-950/30 rounded-xl border border-amber-200 dark:border-amber-800">
                  <p className="text-sm text-amber-800 dark:text-amber-200">
                    <strong>Example:</strong> If your last dose today is at 8:00
                    PM and you take medicine 3x daily (every 6 hours), your
                    first dose tomorrow will be at 2:00 AM.
                  </p>
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

