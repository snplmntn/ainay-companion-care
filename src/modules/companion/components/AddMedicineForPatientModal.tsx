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
  Camera,
  Upload,
  Image as ImageIcon,
  Loader2,
  Check,
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

interface Props {
  isOpen: boolean;
  onClose: () => void;
  patient: LinkedPatient;
  onMedicationAdded?: () => void;
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

export function AddMedicineForPatientModal({
  isOpen,
  onClose,
  patient,
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
    imageUrl: "",
  });

  // Dropdown states
  const [showCategoryDropdown, setShowCategoryDropdown] = useState(false);
  const [showFrequencyDropdown, setShowFrequencyDropdown] = useState(false);

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
      imageUrl: "",
    });
    setShowCategoryDropdown(false);
    setShowFrequencyDropdown(false);
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

    setIsSubmitting(true);

    try {
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
          timePeriod: "ongoing",
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
    <div className="fixed inset-0 z-50 bg-black/50 flex items-end justify-center">
      <div className="bg-background w-full max-w-lg rounded-t-3xl slide-up max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-border">
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
            <div>
              <label className="text-senior-sm font-semibold text-muted-foreground mb-2 block">
                Start Time *
              </label>
              <Input
                value={formData.time}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, time: e.target.value }))
                }
                placeholder="e.g., 8:00 AM"
                className="input-senior"
              />
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
    </div>
  );
}

