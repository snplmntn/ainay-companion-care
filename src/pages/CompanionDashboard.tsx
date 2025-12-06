import React, { useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Users, Bell, Activity, Heart, Wifi, WifiOff, RefreshCw, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Navigation } from "@/components/Navigation";
import { useApp } from "@/contexts/AppContext";
import {
  PatientLinkManager,
  useRealtimeMultiplePatients,
} from "@/modules/companion";
import type { Medication } from "@/types";

export default function CompanionDashboard() {
  const navigate = useNavigate();
  const { userName, linkedPatients, refreshCompanionData } = useApp();

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

  // Helper to check if a dose time has passed (is overdue if not taken)
  const isDoseOverdue = (doseTime: string): boolean => {
    const now = new Date();
    const [hours, minutes] = doseTime.split(':').map(Number);
    const doseDate = new Date();
    doseDate.setHours(hours, minutes, 0, 0);
    return now > doseDate;
  };

  // Helper to calculate dose-level stats for a medication
  const getMedDoseStats = (med: Medication) => {
    if (med.doses && med.doses.length > 0) {
      return {
        total: med.doses.length,
        taken: med.doses.filter(d => d.taken).length,
      };
    }
    return { total: 1, taken: med.taken ? 1 : 0 };
  };

  // Helper to get overdue doses (past time and not taken)
  const getOverdueDoses = (med: Medication): number => {
    if (med.doses && med.doses.length > 0) {
      return med.doses.filter(d => !d.taken && isDoseOverdue(d.time)).length;
    }
    // For single-dose medications, check the medication's time
    if (!med.taken && med.time && isDoseOverdue(med.time)) {
      return 1;
    }
    return 0;
  };

  // Merge realtime medications with linked patients data
  const patientsWithRealtimeMeds = linkedPatients.map((patient) => {
    const realtimeMeds = patientMedications.get(patient.id);
    if (realtimeMeds && realtimeMeds.length > 0) {
      // Calculate adherence based on DOSES, not medications
      const doseStats = realtimeMeds.reduce((acc, med) => {
        const stats = getMedDoseStats(med);
        acc.total += stats.total;
        acc.taken += stats.taken;
        return acc;
      }, { total: 0, taken: 0 });
      
      const adherenceRate = doseStats.total > 0 
        ? Math.round((doseStats.taken / doseStats.total) * 100) 
        : 0;
      return {
        ...patient,
        medications: realtimeMeds,
        adherenceRate,
      };
    }
    return patient;
  });

  // Calculate overall stats using realtime data (DOSE-level)
  const activePatients = patientsWithRealtimeMeds.filter(
    (p) => p.linkStatus === "accepted"
  );
  
  // Calculate total DOSES across all patients
  const { totalDoses, takenDoses } = activePatients.reduce((acc, p) => {
    p.medications.forEach(med => {
      const stats = getMedDoseStats(med);
      acc.totalDoses += stats.total;
      acc.takenDoses += stats.taken;
    });
    return acc;
  }, { totalDoses: 0, takenDoses: 0 });
  
  const overallProgress =
    totalDoses > 0
      ? Math.round((takenDoses / totalDoses) * 100)
      : 0;

  // Patients needing attention (has OVERDUE doses - past scheduled time and not taken)
  const patientsNeedingAttention = activePatients.filter((p) => {
    const totalOverdueDoses = p.medications.reduce((acc, med) => acc + getOverdueDoses(med), 0);
    return totalOverdueDoses > 0;
  });

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return "Good Morning";
    if (hour < 17) return "Good Afternoon";
    return "Good Evening";
  };

  return (
    <div className="min-h-screen bg-background pb-24 lg:pb-8 lg:ml-20 xl:ml-24">
      {/* Header */}
      <header className="gradient-teal text-white p-6 rounded-b-3xl">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-senior-2xl font-bold">
              {getGreeting()}, {userName}!
            </h1>
            <div className="flex items-center gap-2 mt-1">
              <p className="text-white/90 text-base">Your Care Dashboard</p>
              {/* Realtime sync indicator */}
              <div 
                className="flex items-center gap-1 text-sm px-2 py-1 rounded-full bg-white/20"
                title={isConnected ? "Real-time sync active" : "Connecting..."}
              >
                {isConnected ? (
                  <>
                    <Wifi className="w-3 h-3" />
                    <span>Connected</span>
                  </>
                ) : (
                  <>
                    <WifiOff className="w-3 h-3" />
                    <span>Not Connected</span>
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
              onClick={() => navigate("/profile")}
              title="Settings"
            >
              <Settings className="w-6 h-6" />
            </Button>
          </div>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-white/20 rounded-xl p-4 text-center">
            <Users className="w-7 h-7 mx-auto mb-1" />
            <p className="text-3xl font-bold">{activePatients.length}</p>
            <p className="text-sm text-white/90">People</p>
          </div>
          <div className="bg-white/20 rounded-xl p-4 text-center">
            <Activity className="w-7 h-7 mx-auto mb-1" />
            <p className="text-3xl font-bold">{overallProgress}%</p>
            <p className="text-sm text-white/90">Done Today</p>
          </div>
          <div className="bg-white/20 rounded-xl p-4 text-center">
            <Heart className="w-7 h-7 mx-auto mb-1" />
            <p className="text-3xl font-bold">
              {takenDoses}/{totalDoses}
            </p>
            <p className="text-sm text-white/90">Doses Taken</p>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="p-4 space-y-6 mt-4">
        {/* Attention Alert - Only shows for OVERDUE doses (past scheduled time) */}
        {patientsNeedingAttention.length > 0 && (
          <div className="card-senior border-2 border-amber-300 bg-amber-50">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-full bg-amber-200 flex items-center justify-center">
                <Bell className="w-6 h-6 text-amber-700" />
              </div>
              <div>
                <h3 className="font-bold text-lg text-amber-900">
                  Check on Them! ⚠️
                </h3>
                <p className="text-base text-amber-700">
                  {patientsNeedingAttention.length} {patientsNeedingAttention.length > 1 ? "people have" : "person has"} missed doses
                </p>
              </div>
            </div>
            <div className="space-y-3">
              {patientsNeedingAttention.slice(0, 2).map((patient) => {
                // Calculate OVERDUE doses only (past scheduled time, not taken)
                const overdueDoses = patient.medications.reduce((acc, med) => {
                  return acc + getOverdueDoses(med);
                }, 0);
                return (
                  <button
                    key={patient.id}
                    onClick={() => navigate(`/companion/patient/${patient.id}`)}
                    className="w-full bg-white rounded-xl p-4 flex items-center justify-between text-left hover:bg-amber-50 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-full bg-amber-100 flex items-center justify-center">
                        <span className="font-bold text-xl text-amber-700">
                          {patient.name[0]}
                        </span>
                      </div>
                      <div>
                        <p className="font-semibold text-lg">{patient.name}</p>
                        <p className="text-base text-amber-600">
                          {overdueDoses} dose{overdueDoses > 1 ? "s" : ""} overdue
                        </p>
                      </div>
                    </div>
                    <span className="text-amber-600 text-lg font-semibold">
                      See →
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Patient Link Manager - pass realtime patient data */}
        <PatientLinkManager realtimePatients={patientsWithRealtimeMeds} />
      </main>

      {/* Navigation */}
      <Navigation />
    </div>
  );
}
