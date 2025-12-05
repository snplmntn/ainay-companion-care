import React, { useEffect, useState, useCallback } from "react";
import { ArrowLeft, AlertCircle, Loader2 } from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ChatInterface } from "@/components/ChatInterface";
import { Navigation } from "@/components/Navigation";
import { useApp } from "@/contexts/AppContext";
import type { LinkedPatient, Medication } from "@/types";
import { useRealtimePatientMedications } from "@/modules/companion/hooks/useRealtimePatientMedications";

export default function AskAInayForPatient() {
  const navigate = useNavigate();
  const { patientId } = useParams<{ patientId: string }>();
  const { linkedPatients, userRole } = useApp();
  const [patient, setPatient] = useState<LinkedPatient | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Find the patient from linked patients
  useEffect(() => {
    if (!patientId || !linkedPatients) {
      setIsLoading(false);
      return;
    }

    const foundPatient = linkedPatients.find(
      (p) => p.id === patientId && p.linkStatus === "accepted"
    );

    if (foundPatient) {
      setPatient(foundPatient);
    }
    setIsLoading(false);
  }, [patientId, linkedPatients]);

  // Use realtime sync for patient's medications
  const {
    medications: realtimeMedications,
    isLoading: isSyncing,
    refresh,
  } = useRealtimePatientMedications(patientId || "", {
    enabled: !!patient,
  });

  // Update patient with realtime medications
  const patientWithRealtimeMeds: LinkedPatient | null = patient
    ? {
        ...patient,
        medications: realtimeMedications.length > 0 ? realtimeMedications : patient.medications,
      }
    : null;

  // Callback when medications are updated via chat
  const handleMedicationsUpdated = useCallback(() => {
    refresh();
  }, [refresh]);

  // Redirect non-companions
  if (userRole !== "companion") {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
        <AlertCircle className="w-16 h-16 text-destructive mb-4" />
        <h1 className="text-senior-xl font-bold mb-2">Can't Open This Page</h1>
        <p className="text-lg text-muted-foreground text-center mb-4">
          This page is for helpers and caregivers only.
        </p>
        <Button variant="coral" size="lg" className="text-lg" onClick={() => navigate("/dashboard")}>
          Go Home
        </Button>
      </div>
    );
  }

  // Loading state
  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-12 h-12 text-primary animate-spin" />
      </div>
    );
  }

  // Patient not found
  if (!patientWithRealtimeMeds) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
        <AlertCircle className="w-16 h-16 text-amber-500 mb-4" />
        <h1 className="text-senior-xl font-bold mb-2">Person Not Found</h1>
        <p className="text-lg text-muted-foreground text-center mb-4">
          We couldn't find this person. They may not be connected to your account yet.
        </p>
        <Button variant="coral" size="lg" className="text-lg" onClick={() => navigate("/companion")}>
          Go Back
        </Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col lg:ml-20 xl:ml-24">
      {/* Header */}
      <header className="bg-card border-b border-border p-4 flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
          <ArrowLeft className="w-6 h-6" />
        </Button>

        <div className="flex items-center gap-3 flex-1">
          <img
            src="/icon.ico"
            alt="AInay"
            className="w-14 h-14 rounded-full object-cover"
          />
          <div>
            <h1 className="text-senior-lg font-bold">Talk to AInay</h1>
            <p className="text-base text-secondary font-medium">
              Helping {patientWithRealtimeMeds.name}
            </p>
          </div>
        </div>
      </header>

      {/* Chat Interface with patient context */}
      <div className="flex-1 flex flex-col pb-20 lg:pb-4">
        <ChatInterface 
          targetPatient={patientWithRealtimeMeds}
          onMedicationsUpdated={handleMedicationsUpdated}
        />
      </div>

      {/* Navigation */}
      <Navigation />
    </div>
  );
}

