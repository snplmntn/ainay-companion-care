// ============================================
// Companion Module - Public API
// ============================================

// Types
export * from "./types";

// Constants
export * from "./constants";

// Components
export { PatientLinkManager } from "./components/PatientLinkManager";
export { PatientDetailView } from "./components/PatientDetailView";
export { AddMedicineForPatientModal } from "./components/AddMedicineForPatientModal";
export { PushNotificationSettings } from "./components/PushNotificationSettings";

// Services
export * from "./services";
export * from "./services/pushNotificationService";

// Hooks
export * from "./hooks";
export { usePushNotifications } from "./hooks/usePushNotifications";
