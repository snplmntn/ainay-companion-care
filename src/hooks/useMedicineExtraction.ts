import { useState, useCallback } from "react";
import {
  extractMedicinesFromAIResponse,
  ExtractedMedicine,
} from "@/services/openai";

interface DetectedMedicine extends ExtractedMedicine {
  id: string;
  selected: boolean;
}

const generateId = () =>
  `${Date.now()}-${Math.random().toString(16).slice(2)}`;

interface UseMedicineExtractionOptions {
  onMedicinesDetected?: (medicines: DetectedMedicine[]) => void;
}

interface UseMedicineExtractionReturn {
  detectedMedicines: DetectedMedicine[];
  isExtracting: boolean;
  showAddPanel: boolean;
  extractMedicines: (responseText: string) => Promise<void>;
  toggleMedicineSelection: (id: string) => void;
  updateMedicineField: (
    id: string,
    field: keyof ExtractedMedicine,
    value: string
  ) => void;
  getSelectedMedicines: () => DetectedMedicine[];
  clearDetectedMedicines: () => void;
  setShowAddPanel: (show: boolean) => void;
}

/**
 * Custom hook for extracting and managing detected medicines from AI responses
 * OPTIMIZATION: Extracted from ChatInterface for reusability and maintainability
 */
export function useMedicineExtraction(
  options: UseMedicineExtractionOptions = {}
): UseMedicineExtractionReturn {
  const { onMedicinesDetected } = options;

  const [detectedMedicines, setDetectedMedicines] = useState<DetectedMedicine[]>(
    []
  );
  const [isExtracting, setIsExtracting] = useState(false);
  const [showAddPanel, setShowAddPanel] = useState(false);

  // Extract medicines from AI response text
  const extractMedicines = useCallback(
    async (responseText: string) => {
      setIsExtracting(true);
      try {
        const medicines = await extractMedicinesFromAIResponse(responseText);
        if (medicines.length > 0) {
          const detected: DetectedMedicine[] = medicines.map((m) => ({
            ...m,
            id: generateId(),
            selected: true,
          }));
          setDetectedMedicines(detected);
          setShowAddPanel(true);

          if (onMedicinesDetected) {
            onMedicinesDetected(detected);
          }
        }
      } catch (error) {
        console.error("Failed to extract medicines:", error);
      } finally {
        setIsExtracting(false);
      }
    },
    [onMedicinesDetected]
  );

  // Toggle selection of a detected medicine
  const toggleMedicineSelection = useCallback((id: string) => {
    setDetectedMedicines((prev) =>
      prev.map((m) => (m.id === id ? { ...m, selected: !m.selected } : m))
    );
  }, []);

  // Update a field of a detected medicine
  const updateMedicineField = useCallback(
    (id: string, field: keyof ExtractedMedicine, value: string) => {
      setDetectedMedicines((prev) =>
        prev.map((m) => (m.id === id ? { ...m, [field]: value } : m))
      );
    },
    []
  );

  // Get only selected medicines
  const getSelectedMedicines = useCallback(() => {
    return detectedMedicines.filter((m) => m.selected && m.name);
  }, [detectedMedicines]);

  // Clear all detected medicines
  const clearDetectedMedicines = useCallback(() => {
    setDetectedMedicines([]);
    setShowAddPanel(false);
  }, []);

  return {
    detectedMedicines,
    isExtracting,
    showAddPanel,
    extractMedicines,
    toggleMedicineSelection,
    updateMedicineField,
    getSelectedMedicines,
    clearDetectedMedicines,
    setShowAddPanel,
  };
}

/**
 * Validate that detected medicines have required fields
 */
export function validateMedicines(
  medicines: DetectedMedicine[]
): { valid: DetectedMedicine[]; incomplete: DetectedMedicine[] } {
  const valid: DetectedMedicine[] = [];
  const incomplete: DetectedMedicine[] = [];

  for (const medicine of medicines) {
    if (medicine.selected && medicine.name) {
      if (medicine.dosage && medicine.time) {
        valid.push(medicine);
      } else {
        incomplete.push(medicine);
      }
    }
  }

  return { valid, incomplete };
}

// Re-export types
export type { DetectedMedicine, ExtractedMedicine };


