// ============================================
// Medicine Confirmation Flow Component
// ============================================

import React, { useState, useCallback } from "react";
import {
  ChevronLeft,
  Check,
  AlertCircle,
  Pill,
  PartyPopper,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useApp } from "@/contexts/AppContext";
import type {
  ExtractedMedicineData,
  MedicineFormData,
  MedicationSchedule,
  EnhancedMedication,
} from "../types";
import { MEDICATION_CATEGORIES } from "../constants";
import { generateId, formatScheduleSummary } from "../services/scheduleService";
import {
  checkDrugInteractions,
  type InteractionCheckResult,
} from "../services/interactionService";
import { MedicineConfirmationCard } from "./MedicineConfirmationCard";
import { AlarmScheduler } from "./AlarmScheduler";
import { InteractionWarningCard } from "./InteractionWarningCard";

interface Props {
  extractedMedicines: ExtractedMedicineData[];
  onComplete: (medications: EnhancedMedication[]) => void;
  onCancel: () => void;
}

type FlowStep = "confirm" | "interaction-check" | "schedule" | "complete";

interface ProcessedMedicine {
  formData: MedicineFormData;
  schedule?: Omit<MedicationSchedule, "id" | "medicationId">;
}

export function MedicineConfirmationFlow({
  extractedMedicines,
  onComplete,
  onCancel,
}: Props) {
  const { medications: currentMedications } = useApp();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [step, setStep] = useState<FlowStep>("confirm");
  const [processedMedicines, setProcessedMedicines] = useState<
    ProcessedMedicine[]
  >([]);
  const [currentFormData, setCurrentFormData] =
    useState<MedicineFormData | null>(null);
  const [skippedCount, setSkippedCount] = useState(0);
  const [isCheckingInteractions, setIsCheckingInteractions] = useState(false);
  const [interactionResult, setInteractionResult] =
    useState<InteractionCheckResult | null>(null);

  const currentMedicine = extractedMedicines[currentIndex];
  const totalCount = extractedMedicines.length;
  const isLastMedicine = currentIndex >= totalCount - 1;

  // Handle confirmation of a medicine - now checks for interactions first
  const handleConfirm = useCallback(
    async (formData: MedicineFormData) => {
      setCurrentFormData(formData);
      setIsCheckingInteractions(true);

      try {
        // Check for drug interactions with current medications
        const result = await checkDrugInteractions(
          formData.name,
          currentMedications
        );
        setInteractionResult(result);

        if (result.hasInteractions) {
          // Show interaction warning step
          setStep("interaction-check");
        } else {
          // No interactions, proceed to scheduling
          setStep("schedule");
        }
      } catch (error) {
        console.error("Error checking drug interactions:", error);
        // If interaction check fails, proceed anyway
        setStep("schedule");
      } finally {
        setIsCheckingInteractions(false);
      }
    },
    [currentMedications]
  );

  // Handle proceeding despite interactions
  const handleProceedDespiteInteractions = useCallback(() => {
    setStep("schedule");
  }, []);

  // Handle going back from interaction warning
  const handleBackFromInteractionWarning = useCallback(() => {
    setStep("confirm");
    setInteractionResult(null);
  }, []);

  // Handle schedule set
  const handleScheduleSet = useCallback(
    (schedule: Omit<MedicationSchedule, "id" | "medicationId">) => {
      if (!currentFormData) return;

      const processed: ProcessedMedicine = {
        formData: currentFormData,
        schedule,
      };

      setProcessedMedicines((prev) => [...prev, processed]);

      if (isLastMedicine) {
        setStep("complete");
      } else {
        setCurrentIndex((prev) => prev + 1);
        setStep("confirm");
        setCurrentFormData(null);
      }
    },
    [currentFormData, isLastMedicine]
  );

  // Handle skip
  const handleSkip = useCallback(() => {
    setSkippedCount((prev) => prev + 1);

    if (isLastMedicine) {
      if (processedMedicines.length > 0) {
        setStep("complete");
      } else {
        onCancel();
      }
    } else {
      setCurrentIndex((prev) => prev + 1);
      setStep("confirm");
    }
  }, [isLastMedicine, processedMedicines.length, onCancel]);

  // Handle back from schedule
  const handleBackFromSchedule = useCallback(() => {
    // If there were interactions, go back to interaction warning
    if (interactionResult?.hasInteractions) {
      setStep("interaction-check");
    } else {
      setStep("confirm");
      setCurrentFormData(null);
      setInteractionResult(null);
    }
  }, [interactionResult]);

  // Final save
  const handleSaveAll = useCallback(() => {
    const medications: EnhancedMedication[] = processedMedicines.map((pm) => {
      const medId = generateId();
      const scheduleId = generateId();

      return {
        id: medId,
        userId: "", // Will be set by the context
        name: pm.formData.name,
        dosage: pm.formData.dosage,
        category: pm.formData.category,
        frequency: pm.formData.frequency,
        customFrequency: pm.formData.customFrequency,
        timePeriod: pm.formData.timePeriod,
        instructions: pm.formData.instructions || undefined,
        imageUrl: pm.formData.imageUrl,
        schedule: {
          id: scheduleId,
          medicationId: medId,
          ...pm.schedule!,
        },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
    });

    onComplete(medications);
  }, [processedMedicines, onComplete]);

  // Progress indicator
  const progress = ((currentIndex + 1) / totalCount) * 100;

  return (
    <div className="flex flex-col h-full max-h-[85vh]">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-border shrink-0">
        <Button variant="ghost" size="sm" onClick={onCancel}>
          <ChevronLeft className="w-5 h-5 mr-1" />
          Cancel
        </Button>
        <div className="text-center">
          <div className="text-sm text-muted-foreground">
            {step === "complete"
              ? "All done!"
              : step === "schedule"
              ? "Set Schedule"
              : step === "interaction-check"
              ? "Review Interactions"
              : `Medicine ${currentIndex + 1} of ${totalCount}`}
          </div>
        </div>
        <div className="w-20" /> {/* Spacer for alignment */}
      </div>

      {/* Progress bar */}
      {step !== "complete" && (
        <div className="w-full h-1 bg-muted shrink-0">
          <div
            className="h-full bg-primary transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>
      )}

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4">
        {/* Loading state while checking interactions */}
        {isCheckingInteractions && (
          <div className="flex flex-col items-center justify-center py-12">
            <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
              <Loader2 className="w-8 h-8 text-primary animate-spin" />
            </div>
            <h3 className="font-semibold text-lg mb-2">
              Checking Drug Interactions
            </h3>
            <p className="text-sm text-muted-foreground text-center max-w-sm">
              Checking if {currentFormData?.name} has any interactions with your
              current medications...
            </p>
          </div>
        )}

        {step === "confirm" && currentMedicine && !isCheckingInteractions && (
          <MedicineConfirmationCard
            medicine={currentMedicine}
            onConfirm={handleConfirm}
            onSkip={handleSkip}
            currentIndex={currentIndex}
            totalCount={totalCount}
          />
        )}

        {step === "interaction-check" &&
          currentFormData &&
          interactionResult && (
            <InteractionWarningCard
              newMedicineName={currentFormData.name}
              interactions={interactionResult.interactions}
              onProceedAnyway={handleProceedDespiteInteractions}
              onGoBack={handleBackFromInteractionWarning}
            />
          )}

        {step === "schedule" && currentFormData && (
          <AlarmScheduler
            medicine={currentFormData}
            onScheduleSet={handleScheduleSet}
            onBack={handleBackFromSchedule}
          />
        )}

        {step === "complete" && (
          <div className="text-center py-8">
            <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
              <PartyPopper className="w-10 h-10 text-green-600 dark:text-green-400" />
            </div>
            <h2 className="text-2xl font-bold mb-2">All Set!</h2>
            <p className="text-muted-foreground mb-6">
              You've set up {processedMedicines.length} medication
              {processedMedicines.length !== 1 ? "s" : ""}
              {skippedCount > 0 && ` (${skippedCount} skipped)`}
            </p>

            {/* Summary */}
            <div className="space-y-3 max-w-md mx-auto mb-8">
              {processedMedicines.map((pm, index) => {
                const category = MEDICATION_CATEGORIES.find(
                  (c) => c.value === pm.formData.category
                );
                return (
                  <div
                    key={index}
                    className="flex items-center gap-3 p-4 rounded-xl bg-muted/50 text-left"
                  >
                    <span className="text-2xl">{category?.icon || "💊"}</span>
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold truncate">
                        {pm.formData.name}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {pm.formData.dosage} •{" "}
                        {pm.schedule
                          ? formatScheduleSummary(
                              pm.schedule as MedicationSchedule
                            )
                          : ""}
                      </div>
                    </div>
                    <Check className="w-5 h-5 text-green-600" />
                  </div>
                );
              })}
            </div>

            <Button
              variant="coral"
              size="lg"
              onClick={handleSaveAll}
              className="w-full max-w-md"
            >
              <Pill className="w-5 h-5 mr-2" />
              Save {processedMedicines.length} Medication
              {processedMedicines.length !== 1 ? "s" : ""}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
