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
  const { name, email, lastActivity } = patient;

  // Helper to check if a medication is fully taken (considering doses)
  const isMedTaken = (med: Medication) => {
    if (med.doses && med.doses.length > 0) {
      return med.doses.every((d) => d.taken);
    }
    return med.taken;
  };
  
  // Calculate DOSE-level progress (more accurate than medication count)
  const { totalDoses, takenDoses } = medications.reduce((acc, med) => {
    if (med.doses && med.doses.length > 0) {
      acc.totalDoses += med.doses.length;
      acc.takenDoses += med.doses.filter(d => d.taken).length;
    } else {
      acc.totalDoses += 1;
      acc.takenDoses += med.taken ? 1 : 0;
    }
    return acc;
  }, { totalDoses: 0, takenDoses: 0 });
  
  const takenCount = medications.filter(isMedTaken).length;
  const totalCount = medications.length;
  const progress = totalDoses > 0 ? Math.round((takenDoses / totalDoses) * 100) : 0;

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

  // Find the NEXT PENDING DOSE (not just medication)
  const getNextPendingDose = () => {
    const allPendingDoses: Array<{ medName: string; dosage: string; time: string; label: string }> = [];
    
    medications.forEach(med => {
      if (med.doses && med.doses.length > 0) {
        // Multi-dose: find pending doses
        med.doses.forEach(dose => {
          if (!dose.taken) {
            allPendingDoses.push({
              medName: med.name,
              dosage: med.dosage,
              time: dose.time,
              label: dose.label,
            });
          }
        });
      } else if (!med.taken) {
        // Single dose: use medication time
        allPendingDoses.push({
          medName: med.name,
          dosage: med.dosage,
          time: med.time,
          label: "Scheduled",
        });
      }
    });
    
    // Sort by time to find the earliest pending dose
    allPendingDoses.sort((a, b) => {
      const timeA = a.time.replace(/(\d+):(\d+)\s*(AM|PM)/i, (_, h, m, p) => {
        let hour = parseInt(h);
        if (p.toUpperCase() === 'PM' && hour !== 12) hour += 12;
        if (p.toUpperCase() === 'AM' && hour === 12) hour = 0;
        return `${hour.toString().padStart(2, '0')}:${m}`;
      });
      const timeB = b.time.replace(/(\d+):(\d+)\s*(AM|PM)/i, (_, h, m, p) => {
        let hour = parseInt(h);
        if (p.toUpperCase() === 'PM' && hour !== 12) hour += 12;
        if (p.toUpperCase() === 'AM' && hour === 12) hour = 0;
        return `${hour.toString().padStart(2, '0')}:${m}`;
      });
      return timeA.localeCompare(timeB);
    });
    
    return allPendingDoses[0] || null;
  };
  
  const nextPendingDose = getNextPendingDose();
  const pendingMeds = medications.filter((m) => !isMedTaken(m));

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
      <div className="flex flex-col gap-3">
        {/* Top row: Back button and patient info */}
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={onBack} className="shrink-0">
            <ArrowLeft className="w-6 h-6" />
          </Button>
          <div className="flex-1 min-w-0">
            <h2 className="text-senior-xl font-bold truncate">{name}</h2>
            <div className="flex items-center gap-2">
              <p className="text-sm text-muted-foreground truncate">{email}</p>
              {/* Realtime indicator */}
              <div className="flex items-center gap-1 shrink-0" title={isConnected ? "Real-time sync active" : "Offline"}>
                {isConnected ? (
                  <Wifi className="w-3 h-3 text-green-500" />
                ) : (
                  <WifiOff className="w-3 h-3 text-muted-foreground" />
                )}
              </div>
            </div>
          </div>
          {/* Refresh button stays in top row */}
          <Button
            variant="ghost"
            size="icon"
            onClick={refresh}
            disabled={isSyncing}
            title="Refresh medications"
            className="shrink-0"
          >
            <RefreshCw className={`w-5 h-5 ${isSyncing ? "animate-spin" : ""}`} />
          </Button>
        </div>
        
        {/* Actions row: Buttons wrap on mobile */}
        <div className="flex flex-wrap gap-2 ml-12 sm:ml-0 sm:justify-end">
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
            <span className="text-xs text-muted-foreground">Doses Today</span>
          </div>
          <p className="text-2xl font-bold text-primary">
            {takenDoses}/{totalDoses}
          </p>
          <p className="text-xs text-muted-foreground">taken</p>
        </div>

        <div className="card-senior bg-teal-light">
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp className="w-5 h-5 text-secondary" />
            <span className="text-xs text-muted-foreground">Adherence</span>
          </div>
          <p
            className={`text-2xl font-bold ${
              progress >= 80
                ? "text-green-600"
                : progress >= 50
                ? "text-amber-600"
                : "text-red-600"
            }`}
          >
            {progress}%
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
      {(totalDoses - takenDoses) > 0 && (
        <div className="card-senior border-2 border-amber-300">
          <div className="flex items-center gap-3 mb-3">
            <AlertTriangle className="w-5 h-5 text-amber-600" />
            <span className="font-semibold text-amber-700">
              {totalDoses - takenDoses} dose{(totalDoses - takenDoses) > 1 ? "s" : ""}{" "}
              pending
            </span>
          </div>
          {nextPendingDose && (
            <div className="bg-amber-50 rounded-xl p-3 flex items-center gap-3">
              <div className="text-center">
                <p className="text-sm font-bold text-amber-700">
                  {nextPendingDose.time.split(" ")[0]}
                </p>
                <p className="text-xs text-amber-600">
                  {nextPendingDose.time.split(" ")[1]}
                </p>
              </div>
              <div className="flex-1">
                <p className="font-semibold">{nextPendingDose.medName}</p>
                <p className="text-sm text-muted-foreground">
                  {nextPendingDose.dosage} • {nextPendingDose.label}
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
          const catTakenCount = categoryMeds.filter(isMedTaken).length;

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
                {categoryMeds.map((med) => {
                  const medIsTaken = isMedTaken(med);
                  return (
                  <div
                    key={med.id}
                    className={`bg-card rounded-xl p-4 border flex items-center gap-4 ${
                      medIsTaken ? "opacity-60 border-secondary" : "border-border"
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
                          medIsTaken ? "bg-secondary/20" : "bg-primary/10"
                        }`}
                      >
                        <Pill
                          className={`w-6 h-6 ${
                            medIsTaken ? "text-secondary" : "text-primary"
                          }`}
                        />
                      </div>
                    )}

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p
                          className={`font-semibold truncate ${
                            medIsTaken ? "line-through text-muted-foreground" : ""
                          }`}
                        >
                          {med.name}
                        </p>
                        {medIsTaken && (
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
                      {/* Show individual doses for multi-dose medications */}
                      {med.doses && med.doses.length > 0 && (
                        <div className="mt-2 space-y-1">
                          {med.doses.map((dose) => (
                            <div key={dose.id} className="flex items-center gap-2 text-xs">
                              <span className={dose.taken ? "text-secondary" : "text-muted-foreground"}>
                                {dose.taken ? "✓" : "○"} {dose.label} ({dose.time})
                              </span>
                              {dose.taken && dose.takenAt && (
                                <span className="text-muted-foreground">
                                  → {new Date(dose.takenAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                </span>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Status */}
                    <div className="text-right">
                      {(() => {
                        // Calculate dose progress for multi-dose medications
                        const hasDoses = med.doses && med.doses.length > 0;
                        const totalDoses = hasDoses ? med.doses!.length : 1;
                        const takenDoses = hasDoses 
                          ? med.doses!.filter(d => d.taken).length 
                          : (med.taken ? 1 : 0);
                        const allTaken = takenDoses === totalDoses;
                        const someTaken = takenDoses > 0 && !allTaken;
                        
                        return (
                          <>
                            <div
                              className={`px-3 py-1 rounded-full text-sm font-medium inline-block ${
                                allTaken
                                  ? "bg-secondary/20 text-secondary"
                                  : someTaken
                                  ? "bg-blue-100 text-blue-700"
                                  : "bg-amber-100 text-amber-700"
                              }`}
                            >
                              {allTaken 
                                ? "Taken" 
                                : someTaken 
                                ? `${takenDoses}/${totalDoses}` 
                                : "Pending"}
                            </div>
                            {/* Show actual time when medication was taken (single-dose only) */}
                            {allTaken && !hasDoses && med.takenAt && (
                              <p className="text-xs text-muted-foreground mt-1">
                                at {new Date(med.takenAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              </p>
                            )}
                          </>
                        );
                      })()}
                    </div>
                  </div>
                )})}
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

