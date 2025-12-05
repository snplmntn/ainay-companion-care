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
export { TelegramNotificationSettings } from "./components/TelegramNotificationSettings";

// Services
export * from "./services";
export * from "./services/pushNotificationService";
export * from "./services/telegramService";

// Hooks
export * from "./hooks";
export { usePushNotifications } from "./hooks/usePushNotifications";
