import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  X,
  Check,
  Trash2,
  ChevronDown,
  Clock,
  AlertTriangle,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useApp } from "@/contexts/AppContext";
import { toast } from "@/hooks/use-toast";
import { searchDrugs, type Drug } from "@/services/drugDatabase";
import { createMedicationSchedule } from "@/modules/medication/services/scheduleService";
import { TIME_PERIOD_OPTIONS, calculateEndDate, getTodayDateString } from "@/modules/medication/constants";
import type { Medication, MedicationCategory, FrequencyType, NextDayMode } from "@/types";
import { CATEGORY_LABELS, CATEGORY_COLORS, FREQUENCY_LABELS } from "@/types";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  medication: Medication;
}

const DEFAULT_CATEGORIES: MedicationCategory[] = [
  "medicine",
  "vitamin",
  "supplement",
  "herbal",
  "other",
];

const DEFAULT_FREQUENCIES: FrequencyType[] = [
  "once_daily",
  "twice_daily",
  "three_times_daily",
  "four_times_daily",
  "as_needed",
];

// Time presets for quick selection
const TIME_PRESETS = [
  { label: "Morning", time: "8:00 AM", icon: "🌅" },
  { label: "Noon", time: "12:00 PM", icon: "☀️" },
  { label: "Afternoon", time: "3:00 PM", icon: "🌤️" },
  { label: "Evening", time: "6:00 PM", icon: "🌆" },
  { label: "Bedtime", time: "9:00 PM", icon: "🌙" },
];

const HOURS = [12, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];
const MINUTES = [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55];

// Convert 24-hour time to 12-hour format
function formatTime12Hour(timeStr: string): string {
  const match = timeStr.match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return timeStr; // Already in 12-hour format or invalid

  let hours = parseInt(match[1], 10);
  const minutes = match[2];
  const period = hours >= 12 ? "PM" : "AM";

  if (hours === 0) hours = 12;
  else if (hours > 12) hours -= 12;

  return `${hours}:${minutes} ${period}`;
}

// Convert 12-hour time (e.g., "8:00 AM") to 24-hour format (e.g., "08:00")
const convertTo24Hour = (time12h: string): string => {
  const match = time12h.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (!match) return "08:00";

  let hours = parseInt(match[1], 10);
  const minutes = match[2];
  const period = match[3].toUpperCase();

  if (period === "PM" && hours !== 12) {
    hours += 12;
  } else if (period === "AM" && hours === 12) {
    hours = 0;
  }

  return `${hours.toString().padStart(2, "0")}:${minutes}`;
};

export function EditMedicineModal({ isOpen, onClose, medication }: Props) {
  const { updateMedication, deleteMedication } = useApp();
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // Form state
  const [formData, setFormData] = useState({
    name: "",
    dosage: "",
    time: "",
    instructions: "",
    category: "medicine" as MedicationCategory,
    frequency: "once_daily" as FrequencyType,
    timePeriod: "ongoing",
  });

  // Dropdown states
  const [showCategoryDropdown, setShowCategoryDropdown] = useState(false);
  const [showFrequencyDropdown, setShowFrequencyDropdown] = useState(false);
  const [showDurationDropdown, setShowDurationDropdown] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);

  // Time picker state
  const [selectedHour, setSelectedHour] = useState(8);
  const [selectedMinute, setSelectedMinute] = useState(0);
  const [selectedPeriod, setSelectedPeriod] = useState<"AM" | "PM">("AM");

  // Drug autocomplete
  const [drugSuggestions, setDrugSuggestions] = useState<Drug[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const suggestionTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Initialize form data when modal opens or medication changes
  useEffect(() => {
    if (isOpen && medication) {
      // Determine display time - use start time or first dose time
      let displayTime = medication.time || medication.startTime || "8:00 AM";
      // Convert from 24h to 12h if needed
      if (displayTime.match(/^\d{1,2}:\d{2}$/)) {
        displayTime = formatTime12Hour(displayTime);
      }

      setFormData({
        name: medication.name,
        dosage: medication.dosage,
        time: displayTime,
        instructions: medication.instructions || "",
        category: medication.category || "medicine",
        frequency: medication.frequency || "once_daily",
        timePeriod: medication.timePeriod || "ongoing",
      });
    }
  }, [isOpen, medication]);

  // Reset state when modal closes
  useEffect(() => {
    if (!isOpen) {
      setShowDeleteConfirm(false);
      setShowCategoryDropdown(false);
      setShowFrequencyDropdown(false);
      setShowDurationDropdown(false);
      setShowTimePicker(false);
    }
  }, [isOpen]);

  // Search drug database with debounce
  const handleDrugSearch = useCallback((query: string) => {
    if (suggestionTimeoutRef.current) {
      clearTimeout(suggestionTimeoutRef.current);
    }

    if (query.length < 2) {
      setDrugSuggestions([]);
      setShowSuggestions(false);
      return;
    }

    suggestionTimeoutRef.current = setTimeout(async () => {
      const results = await searchDrugs(query, 5);
      setDrugSuggestions(results);
      setShowSuggestions(results.length > 0);
    }, 300);
  }, []);

  // Handle selecting a drug from suggestions
  const handleSelectDrug = useCallback((drug: Drug) => {
    let category: MedicationCategory = "medicine";
    const lowerName = (drug.genericName || "").toLowerCase();
    const lowerCategory = (drug.category || "").toLowerCase();

    if (lowerCategory.includes("vitamin") || lowerName.includes("vitamin")) {
      category = "vitamin";
    } else if (lowerCategory.includes("supplement") || lowerName.includes("supplement")) {
      category = "supplement";
    } else if (lowerCategory.includes("herbal") || lowerName.includes("herbal")) {
      category = "herbal";
    }

    setFormData((prev) => ({
      ...prev,
      name: drug.brandName || drug.genericName,
      dosage: drug.strength || prev.dosage,
      category,
    }));
    setShowSuggestions(false);
    setDrugSuggestions([]);
  }, []);

  // Format time from picker state
  const formatTimeFromPicker = (hour: number, minute: number, period: "AM" | "PM") => {
    return `${hour}:${minute.toString().padStart(2, "0")} ${period}`;
  };

  // Parse time string to picker state
  const parseTimeToPickerState = (timeStr: string) => {
    const match = timeStr.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
    if (match) {
      let hour = parseInt(match[1], 10);
      const minute = parseInt(match[2], 10);
      const period = match[3].toUpperCase() as "AM" | "PM";
      if (hour === 0) hour = 12;
      if (hour > 12) hour = hour - 12;
      const roundedMinute = Math.round(minute / 5) * 5;
      return { hour, minute: roundedMinute >= 60 ? 55 : roundedMinute, period };
    }
    return { hour: 8, minute: 0, period: "AM" as const };
  };

  // Apply custom time from picker
  const applyCustomTime = () => {
    const timeStr = formatTimeFromPicker(selectedHour, selectedMinute, selectedPeriod);
    setFormData((prev) => ({ ...prev, time: timeStr }));
    setShowTimePicker(false);
  };

  // Open time picker with current value
  const openTimePicker = () => {
    if (formData.time) {
      const { hour, minute, period } = parseTimeToPickerState(formData.time);
      setSelectedHour(hour);
      setSelectedMinute(minute);
      setSelectedPeriod(period);
    }
    setShowTimePicker(true);
  };

  // Handle save
  const handleSave = async () => {
    if (!formData.name) {
      toast({
        title: "Missing name",
        description: "Please enter a medicine name.",
        variant: "destructive",
      });
      return;
    }

    if (!formData.dosage) {
      toast({
        title: "Missing dosage",
        description: "Please enter a dosage.",
        variant: "destructive",
      });
      return;
    }

    if (!formData.time) {
      toast({
        title: "Missing time",
        description: "Please select a time.",
        variant: "destructive",
      });
      return;
    }

    setIsSaving(true);

    try {
      // Convert time to 24-hour format for schedule calculation
      const startTime24h = convertTo24Hour(formData.time);

      // Calculate dates
      const startDate = medication.startDate || getTodayDateString();
      const endDate = calculateEndDate(startDate, formData.timePeriod);

      // Create new schedule based on updated frequency
      const schedule = createMedicationSchedule({
        name: formData.name,
        dosage: formData.dosage,
        category: formData.category,
        frequency: formData.frequency,
        timePeriod: formData.timePeriod,
        startDate,
        endDate: endDate ?? undefined,
        instructions: formData.instructions,
        startTime: startTime24h,
        nextDayMode: medication.nextDayMode || ("restart" as NextDayMode),
      });

      // Prepare update data
      const updates: Partial<Medication> = {
        name: formData.name,
        dosage: formData.dosage,
        time: formData.time,
        instructions: formData.instructions,
        category: formData.category,
        frequency: formData.frequency,
        timePeriod: formData.timePeriod,
        startTime: startTime24h,
        endDate: endDate ?? undefined,
        doses: schedule.doses,
      };

      await updateMedication(medication.id, updates);

      toast({
        title: "Medication updated! ✓",
        description: `${formData.name} has been updated.`,
      });

      onClose();
    } catch (error) {
      console.error("Error updating medication:", error);
      toast({
        title: "Update failed",
        description: error instanceof Error ? error.message : "Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  // Handle delete
  const handleDelete = async () => {
    setIsDeleting(true);

    try {
      await deleteMedication(medication.id);

      toast({
        title: "Medication removed",
        description: `${medication.name} has been removed from your list.`,
      });

      onClose();
    } catch (error) {
      console.error("Error deleting medication:", error);
      toast({
        title: "Delete failed",
        description: error instanceof Error ? error.message : "Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsDeleting(false);
      setShowDeleteConfirm(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
      <div className="bg-background w-full max-w-lg rounded-2xl shadow-2xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-border bg-background sticky top-0 z-10 rounded-t-2xl">
          <div>
            <h2 className="text-senior-xl font-bold">Edit Medication</h2>
            <p className="text-sm text-muted-foreground">
              Update {medication.name}
            </p>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="w-6 h-6" />
          </Button>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {/* Medicine Name with autocomplete */}
          <div className="relative">
            <label className="text-senior-sm font-semibold text-muted-foreground mb-2 block">
              Medicine Name *
            </label>
            <Input
              value={formData.name}
              onChange={(e) => {
                const value = e.target.value;
                setFormData((prev) => ({ ...prev, name: value }));
                handleDrugSearch(value);
              }}
              onFocus={() => {
                if (drugSuggestions.length > 0) setShowSuggestions(true);
              }}
              onBlur={() => {
                setTimeout(() => setShowSuggestions(false), 200);
              }}
              placeholder="Enter medicine name"
              className="input-senior"
              autoComplete="off"
            />
            {/* Drug Suggestions Dropdown */}
            {showSuggestions && drugSuggestions.length > 0 && (
              <div className="absolute z-50 w-full mt-1 bg-card border border-border rounded-xl shadow-lg max-h-60 overflow-y-auto">
                {drugSuggestions.map((drug, index) => (
                  <button
                    key={`${drug.regId}-${index}`}
                    type="button"
                    className="w-full px-4 py-3 text-left hover:bg-muted transition-colors border-b border-border last:border-b-0"
                    onClick={() => handleSelectDrug(drug)}
                  >
                    <div className="font-semibold text-foreground">
                      {drug.brandName || drug.genericName}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {drug.genericName !== drug.brandName && drug.genericName && (
                        <span>{drug.genericName} • </span>
                      )}
                      {drug.strength} {drug.form && `• ${drug.form}`}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Category and Frequency Row */}
          <div className="grid grid-cols-2 gap-4">
            {/* Category Dropdown */}
            <div className="relative">
              <label className="text-senior-sm font-semibold text-muted-foreground mb-2 block">
                Category *
              </label>
              <button
                type="button"
                onClick={() => {
                  setShowCategoryDropdown(!showCategoryDropdown);
                  setShowFrequencyDropdown(false);
                  setShowDurationDropdown(false);
                }}
                className="w-full h-12 px-4 rounded-xl border border-border bg-background flex items-center justify-between text-left"
              >
                <span
                  className={`text-sm px-2 py-0.5 rounded-full border ${CATEGORY_COLORS[formData.category]}`}
                >
                  {CATEGORY_LABELS[formData.category]}
                </span>
                <ChevronDown className="w-4 h-4 text-muted-foreground" />
              </button>
              {showCategoryDropdown && (
                <div className="absolute z-50 w-full mt-1 bg-card border border-border rounded-xl shadow-lg overflow-hidden">
                  {DEFAULT_CATEGORIES.map((cat) => (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => {
                        setFormData((prev) => ({ ...prev, category: cat }));
                        setShowCategoryDropdown(false);
                      }}
                      className={`w-full px-4 py-3 text-left hover:bg-muted transition-colors flex items-center gap-2 ${
                        formData.category === cat ? "bg-muted" : ""
                      }`}
                    >
                      <span className={`text-sm px-2 py-0.5 rounded-full border ${CATEGORY_COLORS[cat]}`}>
                        {CATEGORY_LABELS[cat]}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Frequency Dropdown */}
            <div className="relative">
              <label className="text-senior-sm font-semibold text-muted-foreground mb-2 block">
                Frequency *
              </label>
              <button
                type="button"
                onClick={() => {
                  setShowFrequencyDropdown(!showFrequencyDropdown);
                  setShowCategoryDropdown(false);
                  setShowDurationDropdown(false);
                }}
                className="w-full h-12 px-4 rounded-xl border border-border bg-background flex items-center justify-between text-left"
              >
                <span className="text-sm truncate">{FREQUENCY_LABELS[formData.frequency]}</span>
                <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0" />
              </button>
              {showFrequencyDropdown && (
                <div className="absolute z-50 w-full mt-1 bg-card border border-border rounded-xl shadow-lg overflow-hidden">
                  {DEFAULT_FREQUENCIES.map((freq) => (
                    <button
                      key={freq}
                      type="button"
                      onClick={() => {
                        setFormData((prev) => ({ ...prev, frequency: freq }));
                        setShowFrequencyDropdown(false);
                      }}
                      className={`w-full px-4 py-3 text-left hover:bg-muted transition-colors ${
                        formData.frequency === freq ? "bg-muted" : ""
                      }`}
                    >
                      {FREQUENCY_LABELS[freq]}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Duration Dropdown */}
          <div className="relative">
            <label className="text-senior-sm font-semibold text-muted-foreground mb-2 block">
              Duration (How long to take) *
            </label>
            <button
              type="button"
              onClick={() => {
                setShowDurationDropdown(!showDurationDropdown);
                setShowCategoryDropdown(false);
                setShowFrequencyDropdown(false);
              }}
              className="w-full h-12 px-4 rounded-xl border border-border bg-background flex items-center justify-between text-left"
            >
              <span className="text-sm">
                {TIME_PERIOD_OPTIONS.find((opt) => opt.value === formData.timePeriod)?.label || "Select duration"}
              </span>
              <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0" />
            </button>
            {showDurationDropdown && (
              <div className="absolute z-50 w-full mt-1 bg-card border border-border rounded-xl shadow-lg max-h-60 overflow-y-auto">
                {TIME_PERIOD_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => {
                      setFormData((prev) => ({ ...prev, timePeriod: opt.value }));
                      setShowDurationDropdown(false);
                    }}
                    className={`w-full px-4 py-3 text-left hover:bg-muted transition-colors ${
                      formData.timePeriod === opt.value ? "bg-muted" : ""
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Dosage and Time Row */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-senior-sm font-semibold text-muted-foreground mb-2 block">
                Dosage *
              </label>
              <Input
                value={formData.dosage}
                onChange={(e) => setFormData((prev) => ({ ...prev, dosage: e.target.value }))}
                placeholder="e.g., 10mg"
                className="input-senior"
              />
            </div>
            <div className="relative">
              <label className="text-senior-sm font-semibold text-muted-foreground mb-2 block">
                Start Time *
              </label>
              <button
                type="button"
                onClick={openTimePicker}
                className="w-full h-12 px-4 rounded-xl border border-border bg-background flex items-center justify-between text-left hover:border-primary transition-colors"
              >
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-muted-foreground" />
                  <span className={formData.time ? "font-medium" : "text-muted-foreground"}>
                    {formData.time || "Select time"}
                  </span>
                </div>
                <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0" />
              </button>
            </div>
          </div>

          {/* Instructions */}
          <div>
            <label className="text-senior-sm font-semibold text-muted-foreground mb-2 block">
              Instructions (optional)
            </label>
            <Input
              value={formData.instructions}
              onChange={(e) => setFormData((prev) => ({ ...prev, instructions: e.target.value }))}
              placeholder="e.g., Take after meals"
              className="input-senior"
            />
          </div>

          {/* Delete Section */}
          <div className="pt-4 border-t border-border">
            {showDeleteConfirm ? (
              <div className="bg-destructive/10 border border-destructive/30 rounded-xl p-4 space-y-3">
                <div className="flex items-center gap-2 text-destructive">
                  <AlertTriangle className="w-5 h-5" />
                  <span className="font-semibold">Delete this medication?</span>
                </div>
                <p className="text-sm text-muted-foreground">
                  This will remove <strong>{medication.name}</strong> from your list. This action cannot be undone.
                </p>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1"
                    onClick={() => setShowDeleteConfirm(false)}
                    disabled={isDeleting}
                  >
                    Cancel
                  </Button>
                  <Button
                    variant="destructive"
                    size="sm"
                    className="flex-1"
                    onClick={handleDelete}
                    disabled={isDeleting}
                  >
                    {isDeleting ? (
                      <Loader2 className="w-4 h-4 animate-spin mr-2" />
                    ) : (
                      <Trash2 className="w-4 h-4 mr-2" />
                    )}
                    Delete
                  </Button>
                </div>
              </div>
            ) : (
              <Button
                variant="ghost"
                className="w-full text-destructive hover:text-destructive hover:bg-destructive/10"
                onClick={() => setShowDeleteConfirm(true)}
              >
                <Trash2 className="w-4 h-4 mr-2" />
                Remove Medication
              </Button>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="p-6 pt-0 space-y-3">
          <Button
            variant="coral"
            size="lg"
            className="w-full"
            onClick={handleSave}
            disabled={isSaving || isDeleting}
          >
            {isSaving ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin mr-2" />
                Saving...
              </>
            ) : (
              <>
                <Check className="w-5 h-5 mr-2" />
                Save Changes
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Time Picker Modal */}
      {showTimePicker && (
        <div className="fixed inset-0 z-[60] bg-black/50 flex items-center justify-center p-4">
          <div className="bg-background w-full max-w-sm rounded-2xl shadow-2xl overflow-hidden">
            {/* Header with live preview */}
            <div className="bg-gradient-to-br from-primary to-primary/80 p-5 text-primary-foreground">
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm font-medium opacity-80">Select Time</span>
                <button
                  onClick={() => setShowTimePicker(false)}
                  className="w-7 h-7 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="text-center">
                <span className="text-4xl font-bold tracking-tight">
                  {formatTimeFromPicker(selectedHour, selectedMinute, selectedPeriod)}
                </span>
              </div>
            </div>

            {/* Quick Presets */}
            <div className="p-4 bg-muted/30 border-b border-border">
              <div className="grid grid-cols-5 gap-2">
                {TIME_PRESETS.map((preset) => (
                  <button
                    key={preset.label}
                    type="button"
                    onClick={() => {
                      setFormData((prev) => ({ ...prev, time: preset.time }));
                      setShowTimePicker(false);
                    }}
                    className={`flex flex-col items-center gap-0.5 p-2 rounded-xl border transition-all ${
                      formData.time === preset.time
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border bg-background hover:border-primary"
                    }`}
                  >
                    <span className="text-lg">{preset.icon}</span>
                    <span className="text-[10px] font-medium leading-tight">{preset.label}</span>
                    <span className="text-[9px] opacity-70">{preset.time}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Time Selector */}
            <div className="p-4">
              <div className="flex gap-3 items-start">
                {/* Hour */}
                <div className="flex-1">
                  <p className="text-xs font-semibold text-muted-foreground mb-2 text-center uppercase tracking-wide">
                    Hour
                  </p>
                  <div className="grid grid-cols-4 gap-1">
                    {HOURS.map((hour) => (
                      <button
                        key={hour}
                        type="button"
                        onClick={() => setSelectedHour(hour)}
                        className={`h-9 rounded-md font-semibold text-sm transition-all ${
                          selectedHour === hour
                            ? "bg-primary text-primary-foreground shadow"
                            : "bg-muted/60 hover:bg-muted text-foreground"
                        }`}
                      >
                        {hour}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Minute */}
                <div className="flex-1">
                  <p className="text-xs font-semibold text-muted-foreground mb-2 text-center uppercase tracking-wide">
                    Min
                  </p>
                  <div className="grid grid-cols-4 gap-1">
                    {MINUTES.map((minute) => (
                      <button
                        key={minute}
                        type="button"
                        onClick={() => setSelectedMinute(minute)}
                        className={`h-9 rounded-md font-semibold text-sm transition-all ${
                          selectedMinute === minute
                            ? "bg-primary text-primary-foreground shadow"
                            : "bg-muted/60 hover:bg-muted text-foreground"
                        }`}
                      >
                        {minute.toString().padStart(2, "0")}
                      </button>
                    ))}
                  </div>
                </div>

                {/* AM/PM */}
                <div className="w-14">
                  <p className="text-xs font-semibold text-muted-foreground mb-2 text-center uppercase tracking-wide">
                    AM/PM
                  </p>
                  <div className="flex flex-col gap-1">
                    <button
                      type="button"
                      onClick={() => setSelectedPeriod("AM")}
                      className={`h-9 rounded-md font-bold text-sm transition-all ${
                        selectedPeriod === "AM"
                          ? "bg-primary text-primary-foreground shadow"
                          : "bg-muted/60 hover:bg-muted text-foreground"
                      }`}
                    >
                      AM
                    </button>
                    <button
                      type="button"
                      onClick={() => setSelectedPeriod("PM")}
                      className={`h-9 rounded-md font-bold text-sm transition-all ${
                        selectedPeriod === "PM"
                          ? "bg-primary text-primary-foreground shadow"
                          : "bg-muted/60 hover:bg-muted text-foreground"
                      }`}
                    >
                      PM
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="p-4 pt-0">
              <Button variant="coral" size="lg" className="w-full h-12" onClick={applyCustomTime}>
                <Check className="w-5 h-5 mr-2" />
                Set Time
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

