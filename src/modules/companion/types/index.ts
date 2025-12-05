// ============================================
// Companion Module Types
// ============================================

import type { Medication } from "@/types";

export interface PatientSummary {
  id: string;
  name: string;
  email: string;
  linkId: string;
  linkStatus: "pending" | "accepted" | "rejected";
  medications: Medication[];
  adherenceRate: number;
  lastActivity?: string;
  todayProgress: {
    taken: number;
    total: number;
  };
}

export interface CompanionNotification {
  id: string;
  type: "missed_medication" | "low_adherence" | "link_request";
  patientId: string;
  patientName: string;
  medicationName?: string;
  scheduledTime?: string;
  message: string;
  createdAt: string;
  read: boolean;
}

export interface LinkRequest {
  id: string;
  companionId: string;
  companionName: string;
  companionEmail: string;
  createdAt: string;
}

