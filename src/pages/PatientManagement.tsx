import React, { useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Navigation } from "@/components/Navigation";
import { useApp } from "@/contexts/AppContext";
import {
  PatientDetailView,
  useRealtimePatientMedications,
} from "@/modules/companion";
import type { Medication } from "@/types";
import { Loader2 } from "lucide-react";

export default function PatientManagement() {
  const { patientId } = useParams<{ patientId: string }>();
  const navigate = useNavigate();
  const { linkedPatients } = useApp();

  // Find the patient
  const patient = linkedPatients.find(
    (p) => p.id === patientId && p.linkStatus === "accepted"
  );

  // Use realtime sync for this patient's medications
  const {
    medications: realtimeMedications,
    isLoading: isSyncing,
  } = useRealtimePatientMedications(patientId || "", {
    enabled: !!patient,
  });

  // Merge realtime medications with patient data
  const patientWithRealtimeMeds = patient
    ? (() => {
        const meds = realtimeMedications.length > 0 ? realtimeMedications : patient.medications;
        const takenCount = meds.filter((m) => m.taken).length;
        const adherenceRate = meds.length > 0
          ? Math.round((takenCount / meds.length) * 100)
          : 0;
        return {
          ...patient,
          medications: meds,
          adherenceRate,
        };
      })()
    : null;

  // Handle patient medication update
  const handlePatientUpdate = useCallback((patientId: string, medications: Medication[]) => {
    console.log(`Patient ${patientId} medications updated:`, medications.length);
  }, []);

  // Loading state
  if (!patient && isSyncing) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-10 h-10 animate-spin mx-auto mb-4 text-primary" />
          <p className="text-lg text-muted-foreground">Getting information...</p>
        </div>
      </div>
    );
  }

  // Patient not found
  if (!patientWithRealtimeMeds) {
    return (
      <div className="min-h-screen bg-background pb-24">
        <div className="p-4 text-center mt-20">
          <h2 className="text-senior-xl font-bold mb-2">Person Not Found</h2>
          <p className="text-lg text-muted-foreground mb-6">
            We can't find this person. They may not be connected to your account yet.
          </p>
          <button
            onClick={() => navigate("/companion")}
            className="text-primary font-semibold text-lg"
          >
            ← Go Back
          </button>
        </div>
        <Navigation />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-24 lg:pb-8 lg:ml-20 xl:ml-24">
      <div className="p-4">
        <PatientDetailView
          patient={patientWithRealtimeMeds}
          onBack={() => navigate("/companion")}
          onPatientUpdate={handlePatientUpdate}
        />
      </div>
      <Navigation />
    </div>
  );
}

