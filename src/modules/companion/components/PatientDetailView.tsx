import React, { useState, useEffect } from "react";
import {
  ArrowLeft,
  Pill,
  Check,
  Clock,
  TrendingUp,
  Calendar,
  Activity,
  AlertTriangle,
  Plus,
  RefreshCw,
  Wifi,
  WifiOff,
  MessageCircle,
  Camera,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import type { LinkedPatient, Medication } from "@/types";
import { CATEGORY_LABELS, CATEGORY_COLORS, FREQUENCY_LABELS } from "@/types";
import { getAdherenceColor } from "../constants";
import { AddMedicineForPatientModal } from "./AddMedicineForPatientModal";
import { useRealtimePatientMedications } from "../hooks/useRealtimePatientMedications";

interface Props {
  patient: LinkedPatient;
  onBack: () => void;
  onPatientUpdate?: (patientId: string, medications: Medication[]) => void;
}

export function PatientDetailView({ patient, onBack, onPatientUpdate }: Props) {
  const navigate = useNavigate();
  const [showAddModal, setShowAddModal] = useState(false);
  
  // Use realtime sync for this patient's medications
  const {
    medications: realtimeMedications,
    isLoading: isSyncing,
    isConnected,
    refresh,
  } = useRealtimePatientMedications(patient.id, {
    enabled: patient.linkStatus === "accepted",
    onUpdate: onPatientUpdate,
  });

  // Use realtime medications if available, otherwise fall back to initial data
  const medications = realtimeMedications.length > 0 ? realtimeMedications : patient.medications;
  const adherenceRate = patient.adherenceRate;
  const { name, email, lastActivity } = patient;

  const takenCount = medications.filter((m) => m.taken).length;
  const totalCount = medications.length;
  const progress = totalCount > 0 ? Math.round((takenCount / totalCount) * 100) : 0;

  // Group medications by category
  const groupedByCategory = medications.reduce((acc, med) => {
    const category = med.category || "medicine";
    if (!acc[category]) {
      acc[category] = [];
    }
    acc[category].push(med);
    return acc;
  }, {} as Record<string, typeof medications>);

  const categoryOrder = ["medicine", "vitamin", "supplement", "herbal", "other"];
  const sortedCategories = Object.keys(groupedByCategory).sort(
    (a, b) => categoryOrder.indexOf(a) - categoryOrder.indexOf(b)
  );

  // Find pending medications
  const pendingMeds = medications.filter((m) => !m.taken);
  const upcomingMed = pendingMeds[0];

  // Format last activity
  const formatLastActivity = (dateStr?: string) => {
    if (!dateStr) return "No activity";
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    return `${diffDays}d ago`;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={onBack}>
          <ArrowLeft className="w-6 h-6" />
        </Button>
        <div className="flex-1">
          <h2 className="text-senior-xl font-bold">{name}</h2>
          <div className="flex items-center gap-2">
            <p className="text-sm text-muted-foreground">{email}</p>
            {/* Realtime indicator */}
            <div className="flex items-center gap-1" title={isConnected ? "Real-time sync active" : "Offline"}>
              {isConnected ? (
                <Wifi className="w-3 h-3 text-green-500" />
              ) : (
                <WifiOff className="w-3 h-3 text-muted-foreground" />
              )}
            </div>
          </div>
        </div>
        
        {/* Actions */}
        <div className="flex gap-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={refresh}
            disabled={isSyncing}
            title="Refresh medications"
          >
            <RefreshCw className={`w-5 h-5 ${isSyncing ? "animate-spin" : ""}`} />
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => navigate(`/companion/patient/${patient.id}/ask`)}
            className="gap-1"
            title="Use AI to scan & add medicines"
          >
            <Camera className="w-4 h-4" />
            <MessageCircle className="w-4 h-4" />
          </Button>
          <Button
            variant="coral"
            size="sm"
            onClick={() => setShowAddModal(true)}
            className="gap-1"
          >
            <Plus className="w-4 h-4" />
            Add Medicine
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-3 gap-3">
        <div className="card-senior bg-coral-light">
          <div className="flex items-center gap-2 mb-2">
            <Activity className="w-5 h-5 text-primary" />
            <span className="text-xs text-muted-foreground">Today</span>
          </div>
          <p className="text-2xl font-bold text-primary">
            {takenCount}/{totalCount}
          </p>
          <p className="text-xs text-muted-foreground">completed</p>
        </div>

        <div className="card-senior bg-teal-light">
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp className="w-5 h-5 text-secondary" />
            <span className="text-xs text-muted-foreground">Adherence</span>
          </div>
          <p
            className={`text-2xl font-bold ${
              adherenceRate >= 80
                ? "text-green-600"
                : adherenceRate >= 50
                ? "text-amber-600"
                : "text-red-600"
            }`}
          >
            {adherenceRate}%
          </p>
          <p className="text-xs text-muted-foreground">rate</p>
        </div>

        <div className="card-senior">
          <div className="flex items-center gap-2 mb-2">
            <Clock className="w-5 h-5 text-muted-foreground" />
            <span className="text-xs text-muted-foreground">Activity</span>
          </div>
          <p className="text-lg font-bold">{formatLastActivity(lastActivity)}</p>
          <p className="text-xs text-muted-foreground">last seen</p>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="card-senior">
        <div className="flex items-center justify-between mb-3">
          <span className="font-semibold">Today's Progress</span>
          <span className="text-sm text-muted-foreground">{progress}%</span>
        </div>
        <div className="h-3 bg-muted rounded-full overflow-hidden">
          <div
            className="h-full bg-secondary rounded-full transition-all duration-500"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* Upcoming/Alert Section */}
      {pendingMeds.length > 0 && (
        <div className="card-senior border-2 border-amber-300">
          <div className="flex items-center gap-3 mb-3">
            <AlertTriangle className="w-5 h-5 text-amber-600" />
            <span className="font-semibold text-amber-700">
              {pendingMeds.length} medication{pendingMeds.length > 1 ? "s" : ""}{" "}
              pending
            </span>
          </div>
          {upcomingMed && (
            <div className="bg-amber-50 rounded-xl p-3 flex items-center gap-3">
              <div className="text-center">
                <p className="text-sm font-bold text-amber-700">
                  {upcomingMed.time.split(" ")[0]}
                </p>
                <p className="text-xs text-amber-600">
                  {upcomingMed.time.split(" ")[1]}
                </p>
              </div>
              <div className="flex-1">
                <p className="font-semibold">{upcomingMed.name}</p>
                <p className="text-sm text-muted-foreground">
                  {upcomingMed.dosage}
                </p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Medications by Category */}
      <div className="space-y-4">
        <h3 className="text-senior-lg font-bold flex items-center gap-2">
          <Calendar className="w-5 h-5 text-secondary" />
          Medication Schedule
        </h3>

        {sortedCategories.map((category) => {
          const categoryMeds = groupedByCategory[category];
          const catTakenCount = categoryMeds.filter((m) => m.taken).length;

          return (
            <div key={category} className="space-y-2">
              {/* Category Header */}
              <div className="flex items-center justify-between">
                <span
                  className={`text-sm px-3 py-1 rounded-full border font-medium ${
                    CATEGORY_COLORS[category as keyof typeof CATEGORY_COLORS]
                  }`}
                >
                  {CATEGORY_LABELS[category as keyof typeof CATEGORY_LABELS]}
                </span>
                <span className="text-sm text-muted-foreground">
                  {catTakenCount}/{categoryMeds.length}
                </span>
              </div>

              {/* Medications List */}
              <div className="space-y-2">
                {categoryMeds.map((med) => (
                  <div
                    key={med.id}
                    className={`bg-card rounded-xl p-4 border flex items-center gap-4 ${
                      med.taken ? "opacity-60 border-secondary" : "border-border"
                    }`}
                  >
                    {/* Medicine Photo or Icon */}
                    {med.imageUrl ? (
                      <img
                        src={med.imageUrl}
                        alt={med.name}
                        className="w-12 h-12 rounded-lg object-cover border border-border"
                      />
                    ) : (
                      <div
                        className={`w-12 h-12 rounded-lg flex items-center justify-center ${
                          med.taken ? "bg-secondary/20" : "bg-primary/10"
                        }`}
                      >
                        <Pill
                          className={`w-6 h-6 ${
                            med.taken ? "text-secondary" : "text-primary"
                          }`}
                        />
                      </div>
                    )}

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p
                          className={`font-semibold truncate ${
                            med.taken ? "line-through text-muted-foreground" : ""
                          }`}
                        >
                          {med.name}
                        </p>
                        {med.taken && (
                          <Check className="w-4 h-4 text-secondary shrink-0" />
                        )}
                      </div>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <span>{med.dosage}</span>
                        <span>•</span>
                        <span>{med.time}</span>
                      </div>
                      {med.frequency && med.frequency !== "once_daily" && (
                        <span className="text-xs px-2 py-0.5 mt-1 rounded-full bg-muted inline-block">
                          {FREQUENCY_LABELS[med.frequency]}
                        </span>
                      )}
                    </div>

                    {/* Status */}
                    <div
                      className={`px-3 py-1 rounded-full text-sm font-medium ${
                        med.taken
                          ? "bg-secondary/20 text-secondary"
                          : "bg-amber-100 text-amber-700"
                      }`}
                    >
                      {med.taken ? "Taken" : "Pending"}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {/* Add Medicine Modal */}
      <AddMedicineForPatientModal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        patient={patient}
        patientMedications={medications}
        onMedicationAdded={refresh}
      />
    </div>
  );
}

