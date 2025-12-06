// Re-export all hooks
export { useVoiceRecording, formatDuration } from "./useVoiceRecording";
export { useChatMessages, buildInitialMessage } from "./useChatMessages";
export {
  useMedicineExtraction,
  validateMedicines,
  type DetectedMedicine,
} from "./useMedicineExtraction";

// Re-export existing hooks
export { useMobile, useIsMobile } from "./use-mobile";
export { useToast, toast } from "./use-toast";


