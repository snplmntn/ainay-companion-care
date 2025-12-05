// ============================================
// Add Medicine For Patient Modal
// Allows companions to add medications for their linked patients
// ============================================

import React, { useState, useRef, useCallback } from "react";
import {
  X,
  Plus,
  Pill,
  ChevronDown,
  Image as ImageIcon,
  Loader2,
  Check,
  Clock,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "@/hooks/use-toast";
import { searchDrugs, type Drug } from "@/services/drugDatabase";
import type { MedicationCategory, FrequencyType, NextDayMode, LinkedPatient } from "@/types";
import { CATEGORY_LABELS, CATEGORY_COLORS, FREQUENCY_LABELS } from "@/types";
import { fileToDataUrl } from "@/services/openai";
import { addMedicationForPatient } from "../services/companionMedication";
import { useApp } from "@/contexts/AppContext";
import { TIME_PERIOD_OPTIONS, calculateEndDate, getTodayDateString } from "@/modules/medication/constants";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  patient: LinkedPatient;
  patientMedications?: { name: string }[];
  onMedicationAdded?: () => void;
}

// Normalize medicine name for comparison (case-insensitive, trimmed)
const normalizeMedicineName = (name: string): string => {
  return name.toLowerCase().trim().replace(/\s+/g, ' ');
};

// Check if a medicine name is a duplicate
const isMedicineDuplicate = (
  name: string,
  existingNames: string[]
): { isDuplicate: boolean; matchedName?: string } => {
  const normalizedName = normalizeMedicineName(name);
  
  for (const existing of existingNames) {
    const normalizedExisting = normalizeMedicineName(existing);
    
    // Exact match
    if (normalizedName === normalizedExisting) {
      return { isDuplicate: true, matchedName: existing };
    }
    
    // Check if one contains the other
    if (normalizedName.includes(normalizedExisting) || normalizedExisting.includes(normalizedName)) {
      return { isDuplicate: true, matchedName: existing };
    }
    
    // Simple similarity check
    const minLen = Math.min(normalizedName.length, normalizedExisting.length);
    if (minLen >= 4) {
      const shorterName = normalizedName.slice(0, minLen);
      const shorterExisting = normalizedExisting.slice(0, minLen);
      if (shorterName === shorterExisting) {
        return { isDuplicate: true, matchedName: existing };
      }
    }
  }
  
  return { isDuplicate: false };
};

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

export function AddMedicineForPatientModal({
  isOpen,
  onClose,
  patient,
  patientMedications = [],
  onMedicationAdded,
}: Props) {
  const { user } = useApp();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    dosage: "",
    time: "",
    instructions: "",
    category: "medicine" as MedicationCategory,
    frequency: "once_daily" as FrequencyType,
    timePeriod: "ongoing",
    imageUrl: "",
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

  // File input ref for medicine photo
  const medicinePhotoRef = useRef<HTMLInputElement>(null);

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
    } else if (
      lowerCategory.includes("supplement") ||
      lowerName.includes("supplement")
    ) {
      category = "supplement";
    } else if (
      lowerCategory.includes("herbal") ||
      lowerName.includes("herbal")
    ) {
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

  // Open time picker with current value or closest current time
  const openTimePicker = () => {
    if (formData.time) {
      const { hour, minute, period } = parseTimeToPickerState(formData.time);
      setSelectedHour(hour);
      setSelectedMinute(minute);
      setSelectedPeriod(period);
    } else {
      // Pre-fill with next available time slot
      const now = new Date();
      let hours = now.getHours();
      const minutes = now.getMinutes();
      
      // Round minutes UP to next 5-minute slot
      const roundedMinutes = Math.ceil(minutes / 5) * 5;
      
      // Handle minute overflow (e.g., 58 rounds to 60)
      let finalMinutes = roundedMinutes;
      if (roundedMinutes >= 60) {
        finalMinutes = 0;
        hours += 1;
      }
      
      // Handle hour overflow
      if (hours >= 24) hours = 0;
      
      // Convert to 12-hour format
      const period: "AM" | "PM" = hours >= 12 ? "PM" : "AM";
      let hour12 = hours % 12;
      if (hour12 === 0) hour12 = 12;
      
      setSelectedHour(hour12);
      setSelectedMinute(finalMinutes);
      setSelectedPeriod(period);
    }
    setShowTimePicker(true);
  };

  // Handle medicine photo upload
  const handleMedicinePhotoUpload = async (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const dataUrl = await fileToDataUrl(file);
      setFormData((prev) => ({ ...prev, imageUrl: dataUrl }));
      toast({
        title: "Photo added",
        description: "Medicine photo saved for reference.",
      });
    } catch (error) {
      console.error("Failed to process photo:", error);
    }
    event.target.value = "";
  };

  // Reset form
  const resetForm = () => {
    setFormData({
      name: "",
      dosage: "",
      time: "",
      instructions: "",
      category: "medicine",
      frequency: "once_daily",
      timePeriod: "ongoing",
      imageUrl: "",
    });
    setShowCategoryDropdown(false);
    setShowFrequencyDropdown(false);
    setShowDurationDropdown(false);
  };

  // Handle form submission
  const handleSubmit = async () => {
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
        description: "Please enter the dosage.",
        variant: "destructive",
      });
      return;
    }

    if (!formData.time) {
      toast({
        title: "Missing time",
        description: "Please enter the time to take the medicine.",
        variant: "destructive",
      });
      return;
    }

    if (!user?.id) {
      toast({
        title: "Not authenticated",
        description: "Please log in to add medications.",
        variant: "destructive",
      });
      return;
    }

    // Check for duplicate medicines
    const existingMedNames = patientMedications.map((m) => m.name);
    const { isDuplicate, matchedName } = isMedicineDuplicate(formData.name, existingMedNames);
    
    if (isDuplicate) {
      toast({
        title: "Already in their list",
        description: `${matchedName} is already added for ${patient.name}`,
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);

    try {
      // Calculate start and end dates for prescription duration
      const startDate = getTodayDateString();
      const endDate = calculateEndDate(startDate, formData.timePeriod);

      const { error } = await addMedicationForPatient(
        patient.id,
        user.id,
        {
          name: formData.name,
          dosage: formData.dosage,
          time: formData.time,
          instructions: formData.instructions || undefined,
          category: formData.category,
          frequency: formData.frequency,
          imageUrl: formData.imageUrl || undefined,
          timePeriod: formData.timePeriod,
          startDate,
          endDate: endDate ?? undefined,
          startTime: formData.time,
          nextDayMode: "restart" as NextDayMode,
          isActive: true,
        }
      );

      if (error) {
        throw new Error(error);
      }

      toast({
        title: "Medicine added!",
        description: `${formData.name} has been added for ${patient.name}.`,
      });

      resetForm();
      onMedicationAdded?.();
      onClose();
    } catch (error) {
      console.error("Failed to add medication:", error);
      toast({
        title: "Failed to add medicine",
        description: error instanceof Error ? error.message : "Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
      <div className="bg-background w-full max-w-lg rounded-2xl shadow-2xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-border rounded-t-2xl">
          <div>
            <h2 className="text-senior-xl font-bold">Add Medicine</h2>
            <p className="text-sm text-muted-foreground">
              For {patient.name}
            </p>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="w-6 h-6" />
          </Button>
        </div>

        {/* Form Content */}
        <div className="p-6 space-y-4">
          {/* Hidden medicine photo input */}
          <input
            ref={medicinePhotoRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleMedicinePhotoUpload}
          />

          {/* Medicine Photo */}
          <div>
            <label className="text-senior-sm font-semibold text-muted-foreground mb-2 block">
              Medicine Photo (optional)
            </label>
            <div className="flex items-center gap-3">
              {formData.imageUrl ? (
                <div className="relative">
                  <img
                    src={formData.imageUrl}
                    alt="Medicine"
                    className="w-16 h-16 rounded-lg object-cover border border-border"
                  />
                  <button
                    onClick={() =>
                      setFormData((prev) => ({ ...prev, imageUrl: "" }))
                    }
                    className="absolute -top-2 -right-2 w-5 h-5 bg-destructive text-white rounded-full flex items-center justify-center"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => medicinePhotoRef.current?.click()}
                  className="w-16 h-16 rounded-lg border-2 border-dashed border-border flex flex-col items-center justify-center text-muted-foreground hover:border-primary hover:text-primary transition-colors"
                >
                  <ImageIcon className="w-6 h-6" />
                  <span className="text-xs">Add</span>
                </button>
              )}
              <p className="text-xs text-muted-foreground flex-1">
                Add a photo of the medicine for easy identification
              </p>
            </div>
          </div>

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
                      {drug.genericName !== drug.brandName &&
                        drug.genericName && (
                          <span>{drug.genericName} • </span>
                        )}
                      {drug.strength} {drug.form && `• ${drug.form}`}
                    </div>
                    {drug.category && (
                      <div className="text-xs text-primary mt-1">
                        {drug.category}
                      </div>
                    )}
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
                }}
                className="w-full h-12 px-4 rounded-xl border border-border bg-background flex items-center justify-between text-left"
              >
                <span
                  className={`text-sm px-2 py-0.5 rounded-full border ${
                    CATEGORY_COLORS[formData.category]
                  }`}
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
                      <span
                        className={`text-sm px-2 py-0.5 rounded-full border ${CATEGORY_COLORS[cat]}`}
                      >
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
                }}
                className="w-full h-12 px-4 rounded-xl border border-border bg-background flex items-center justify-between text-left"
              >
                <span className="text-sm truncate">
                  {FREQUENCY_LABELS[formData.frequency]}
                </span>
                <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0" />
              </button>
              {showFrequencyDropdown && (
                <div className="absolute z-50 w-full mt-1 bg-card border border-border rounded-xl shadow-lg overflow-hidden">
                  {DEFAULT_FREQUENCIES.map((freq) => (
                    <button
                      key={freq}
                      type="button"
                      onClick={() => {
                        setFormData((prev) => ({
                          ...prev,
                          frequency: freq,
                        }));
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
                      setFormData((prev) => ({
                        ...prev,
                        timePeriod: opt.value,
                      }));
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
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    dosage: e.target.value,
                  }))
                }
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
              onChange={(e) =>
                setFormData((prev) => ({
                  ...prev,
                  instructions: e.target.value,
                }))
              }
              placeholder="e.g., Take after meals"
              className="input-senior"
            />
          </div>

          {/* Info Banner */}
          <div className="bg-muted rounded-xl p-4 flex items-start gap-3">
            <Pill className="w-5 h-5 text-primary shrink-0 mt-0.5" />
            <div className="text-sm">
              <p className="font-medium">Adding medicine for {patient.name}</p>
              <p className="text-muted-foreground mt-1">
                This medicine will appear in their schedule and reminders.
              </p>
            </div>
          </div>

          {/* Submit Button */}
          <Button
            variant="coral"
            size="lg"
            className="w-full"
            onClick={handleSubmit}
            disabled={isSubmitting}
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                Adding...
              </>
            ) : (
              <>
                <Plus className="w-5 h-5 mr-2" />
                Add Medicine
              </>
            )}
          </Button>
        </div>

        <div className="h-safe-bottom" />
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
                  <p className="text-xs font-semibold text-muted-foreground mb-2 text-center uppercase tracking-wide">Hour</p>
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
                  <p className="text-xs font-semibold text-muted-foreground mb-2 text-center uppercase tracking-wide">Min</p>
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
                  <p className="text-xs font-semibold text-muted-foreground mb-2 text-center uppercase tracking-wide">AM/PM</p>
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
              <Button
                variant="coral"
                size="lg"
                className="w-full h-12"
                onClick={applyCustomTime}
              >
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

