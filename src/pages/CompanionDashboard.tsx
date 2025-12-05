import React, { useState, useCallback } from "react";
import { Users, Bell, Settings, Activity, Heart, Wifi, WifiOff, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Navigation } from "@/components/Navigation";
import { useApp } from "@/contexts/AppContext";
import {
  PatientLinkManager,
  PatientDetailView,
  useRealtimeMultiplePatients,
} from "@/modules/companion";
import type { LinkedPatient, Medication } from "@/types";

export default function CompanionDashboard() {
  const { userName, linkedPatients, refreshCompanionData } = useApp();
  const [selectedPatientId, setSelectedPatientId] = useState<string | null>(
    null
  );

  // Use realtime sync for all linked patients
  const {
    patientMedications,
    isLoading: isSyncing,
    isConnected,
    refreshAll,
  } = useRealtimeMultiplePatients(linkedPatients, {
    enabled: true,
    onPatientUpdate: useCallback((patientId: string, medications: Medication[]) => {
      // Could trigger notifications here for missed medications
      console.log(`Patient ${patientId} medications updated:`, medications.length);
    }, []),
  });

  // Merge realtime medications with linked patients data
  const patientsWithRealtimeMeds = linkedPatients.map((patient) => {
    const realtimeMeds = patientMedications.get(patient.id);
    if (realtimeMeds && realtimeMeds.length > 0) {
      const takenCount = realtimeMeds.filter((m) => m.taken).length;
      const adherenceRate = realtimeMeds.length > 0 
        ? Math.round((takenCount / realtimeMeds.length) * 100) 
        : 0;
      return {
        ...patient,
        medications: realtimeMeds,
        adherenceRate,
      };
    }
    return patient;
  });

  // Find selected patient with realtime data
  const selectedPatient = patientsWithRealtimeMeds.find(
    (p) => p.id === selectedPatientId && p.linkStatus === "accepted"
  ) as LinkedPatient | undefined;

  // Calculate overall stats using realtime data
  const activePatients = patientsWithRealtimeMeds.filter(
    (p) => p.linkStatus === "accepted"
  );
  const totalMedications = activePatients.reduce(
    (sum, p) => sum + p.medications.length,
    0
  );
  const totalTaken = activePatients.reduce(
    (sum, p) => sum + p.medications.filter((m) => m.taken).length,
    0
  );
  const overallProgress =
    totalMedications > 0
      ? Math.round((totalTaken / totalMedications) * 100)
      : 0;

  // Patients needing attention (low adherence or missed meds)
  const patientsNeedingAttention = activePatients.filter(
    (p) => p.adherenceRate < 70 || p.medications.some((m) => !m.taken)
  );

  // Handle patient medication update from detail view
  const handlePatientUpdate = useCallback((patientId: string, medications: Medication[]) => {
    // The realtime hook already handles the update, but we can add additional logic here
    console.log(`Received update for patient ${patientId}`);
  }, []);

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return "Good Morning";
    if (hour < 17) return "Good Afternoon";
    return "Good Evening";
  };

  // If viewing a patient detail
  if (selectedPatient) {
    return (
      <div className="min-h-screen bg-background pb-24">
        <div className="p-4">
          <PatientDetailView
            patient={selectedPatient}
            onBack={() => setSelectedPatientId(null)}
            onPatientUpdate={handlePatientUpdate}
          />
        </div>
        <Navigation />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-24">
      {/* Header */}
      <header className="gradient-teal text-white p-6 rounded-b-3xl">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-senior-2xl font-bold">
              {getGreeting()}, {userName}!
            </h1>
            <div className="flex items-center gap-2 mt-1">
              <p className="text-white/80 text-sm">Caregiver Dashboard</p>
              {/* Realtime sync indicator */}
              <div 
                className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-white/20"
                title={isConnected ? "Real-time sync active" : "Connecting..."}
              >
                {isConnected ? (
                  <>
                    <Wifi className="w-3 h-3" />
                    <span>Live</span>
                  </>
                ) : (
                  <>
                    <WifiOff className="w-3 h-3" />
                    <span>Offline</span>
                  </>
                )}
              </div>
            </div>
          </div>
          <div className="flex gap-2">
            <Button
              variant="ghost"
              size="icon"
              className="text-white hover:bg-white/20"
              onClick={refreshAll}
              disabled={isSyncing}
              title="Refresh all patients"
            >
              <RefreshCw className={`w-5 h-5 ${isSyncing ? "animate-spin" : ""}`} />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="text-white hover:bg-white/20"
            >
              <Bell className="w-6 h-6" />
            </Button>
          </div>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-white/20 rounded-xl p-3 text-center">
            <Users className="w-6 h-6 mx-auto mb-1" />
            <p className="text-2xl font-bold">{activePatients.length}</p>
            <p className="text-xs text-white/80">Patients</p>
          </div>
          <div className="bg-white/20 rounded-xl p-3 text-center">
            <Activity className="w-6 h-6 mx-auto mb-1" />
            <p className="text-2xl font-bold">{overallProgress}%</p>
            <p className="text-xs text-white/80">Progress</p>
          </div>
          <div className="bg-white/20 rounded-xl p-3 text-center">
            <Heart className="w-6 h-6 mx-auto mb-1" />
            <p className="text-2xl font-bold">
              {totalTaken}/{totalMedications}
            </p>
            <p className="text-xs text-white/80">Meds Taken</p>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="p-4 space-y-6 -mt-4">
        {/* Attention Alert */}
        {patientsNeedingAttention.length > 0 && (
          <div className="card-senior border-2 border-amber-300 bg-amber-50">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-full bg-amber-200 flex items-center justify-center">
                <Bell className="w-5 h-5 text-amber-700" />
              </div>
              <div>
                <h3 className="font-semibold text-amber-900">
                  Needs Attention
                </h3>
                <p className="text-sm text-amber-700">
                  {patientsNeedingAttention.length} patient
                  {patientsNeedingAttention.length > 1 ? "s" : ""} with pending
                  medications
                </p>
              </div>
            </div>
            <div className="space-y-2">
              {patientsNeedingAttention.slice(0, 2).map((patient) => {
                const pendingCount = patient.medications.filter(
                  (m) => !m.taken
                ).length;
                return (
                  <button
                    key={patient.id}
                    onClick={() => setSelectedPatientId(patient.id)}
                    className="w-full bg-white rounded-lg p-3 flex items-center justify-between text-left hover:bg-amber-50 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-amber-100 flex items-center justify-center">
                        <span className="font-semibold text-amber-700">
                          {patient.name[0]}
                        </span>
                      </div>
                      <div>
                        <p className="font-medium">{patient.name}</p>
                        <p className="text-xs text-amber-600">
                          {pendingCount} pending medication
                          {pendingCount > 1 ? "s" : ""}
                        </p>
                      </div>
                    </div>
                    <span className="text-amber-600 text-sm font-medium">
                      View →
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Patient Link Manager */}
        <PatientLinkManager onPatientSelect={setSelectedPatientId} />
      </main>

      {/* Navigation */}
      <Navigation />
    </div>
  );
}
