import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Link2,
  Copy,
  Check,
  UserPlus,
  Users,
  X,
  ChevronRight,
  AlertCircle,
  Clock,
  CheckCircle,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useApp } from "@/contexts/AppContext";
import { toast } from "@/hooks/use-toast";

import type { LinkedPatient } from "@/types";

interface Props {
  onPatientSelect?: (patientId: string) => void;
  /** Optional realtime patient data to use instead of context data */
  realtimePatients?: LinkedPatient[];
}

export function PatientLinkManager({
  onPatientSelect,
  realtimePatients,
}: Props) {
  const navigate = useNavigate();
  const {
    userRole,
    linkCode,
    linkedPatients: contextPatients,
    linkedCompanions,
    pendingRequests,
    requestLinkToPatient,
    acceptLinkRequest,
    rejectLinkRequest,
    unlinkPatientOrCompanion,
  } = useApp();

  // Use realtime data if provided, otherwise fall back to context
  const linkedPatients = realtimePatients || contextPatients;

  const [linkInput, setLinkInput] = useState("");
  const [isLinking, setIsLinking] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showLinkInput, setShowLinkInput] = useState(false);

  const handleCopyCode = async () => {
    if (!linkCode) return;

    try {
      await navigator.clipboard.writeText(linkCode);
      setCopied(true);
      toast({
        title: "Code copied!",
        description: "Share this code with your caregiver.",
      });
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast({
        title: "Copy failed",
        description: "Please copy the code manually.",
        variant: "destructive",
      });
    }
  };

  const handleLinkToPatient = async () => {
    if (!linkInput.trim()) {
      toast({
        title: "Enter link code",
        description: "Please enter the patient's link code.",
        variant: "destructive",
      });
      return;
    }

    setIsLinking(true);
    const result = await requestLinkToPatient(linkInput.trim().toUpperCase());
    setIsLinking(false);

    if (result.success) {
      toast({
        title: "Link request sent!",
        description: `Request sent to ${result.patientName}. Waiting for approval.`,
      });
      setLinkInput("");
      setShowLinkInput(false);
    } else {
      toast({
        title: "Link failed",
        description: result.error || "Please check the code and try again.",
        variant: "destructive",
      });
    }
  };

  const handleAcceptRequest = async (requestId: string, name: string) => {
    await acceptLinkRequest(requestId);
    toast({
      title: "Request accepted!",
      description: `${name} can now view your medications.`,
    });
  };

  const handleRejectRequest = async (requestId: string, name: string) => {
    await rejectLinkRequest(requestId);
    toast({
      title: "Request rejected",
      description: `${name}'s request has been declined.`,
    });
  };

  const handleUnlink = async (linkId: string, name: string) => {
    await unlinkPatientOrCompanion(linkId);
    toast({
      title: "Unlinked",
      description: `${name} has been removed from your linked accounts.`,
    });
  };

  // ============ PATIENT VIEW ============
  if (userRole === "patient") {
    return (
      <div className="space-y-6">
        {/* Share Your Code Section */}
        <div className="card-senior">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
              <Link2 className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h3 className="font-semibold">Your Link Code</h3>
              <p className="text-sm text-muted-foreground">
                Share this with your caregiver
              </p>
            </div>
          </div>

          {linkCode ? (
            <div className="flex items-center gap-3">
              <div className="flex-1 bg-muted rounded-xl px-6 py-4 font-mono text-2xl font-bold tracking-wider text-center">
                {linkCode}
              </div>
              <Button
                variant="secondary"
                size="icon-lg"
                onClick={handleCopyCode}
                className="rounded-xl shrink-0"
              >
                {copied ? (
                  <Check className="w-6 h-6 text-green-600" />
                ) : (
                  <Copy className="w-6 h-6" />
                )}
              </Button>
            </div>
          ) : (
            <div className="bg-muted rounded-xl px-6 py-4 text-center text-muted-foreground">
              Link code will appear here when available
            </div>
          )}
        </div>

        {/* Pending Requests Section */}
        {pendingRequests.length > 0 && (
          <div className="card-senior border-2 border-amber-300">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center">
                <AlertCircle className="w-5 h-5 text-amber-600" />
              </div>
              <div>
                <h3 className="font-semibold">Pending Requests</h3>
                <p className="text-sm text-muted-foreground">
                  {pendingRequests.length} caregiver
                  {pendingRequests.length > 1 ? "s" : ""} want
                  {pendingRequests.length === 1 ? "s" : ""} to link
                </p>
              </div>
            </div>

            <div className="space-y-3">
              {pendingRequests.map((request) => (
                <div
                  key={request.id}
                  className="bg-muted rounded-xl p-4 flex items-center justify-between"
                >
                  <div>
                    <p className="font-semibold">{request.companionName}</p>
                    <p className="text-sm text-muted-foreground">
                      {request.companionEmail}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() =>
                        handleRejectRequest(request.id, request.companionName)
                      }
                    >
                      <X className="w-5 h-5 text-destructive" />
                    </Button>
                    <Button
                      variant="coral"
                      size="icon"
                      onClick={() =>
                        handleAcceptRequest(request.id, request.companionName)
                      }
                    >
                      <Check className="w-5 h-5" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Linked Companions Section */}
        <div className="card-senior">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-full bg-secondary/10 flex items-center justify-center">
              <Users className="w-5 h-5 text-secondary" />
            </div>
            <div>
              <h3 className="font-semibold">My Caregivers</h3>
              <p className="text-sm text-muted-foreground">
                {linkedCompanions.length} linked
              </p>
            </div>
          </div>

          {linkedCompanions.length > 0 ? (
            <div className="space-y-3">
              {linkedCompanions.map((companion) => (
                <div
                  key={companion.id}
                  className="bg-muted rounded-xl p-4 flex items-center justify-between"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-secondary/20 flex items-center justify-center">
                      <span className="font-semibold text-secondary">
                        {companion.name[0].toUpperCase()}
                      </span>
                    </div>
                    <div>
                      <p className="font-semibold">{companion.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {companion.email}
                      </p>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() =>
                      handleUnlink(companion.linkId, companion.name)
                    }
                    className="text-destructive hover:text-destructive"
                  >
                    <X className="w-5 h-5" />
                  </Button>
                </div>
              ))}
            </div>
          ) : (
            <div className="bg-muted rounded-xl p-6 text-center">
              <Users className="w-10 h-10 mx-auto mb-3 text-muted-foreground" />
              <p className="text-muted-foreground">
                No caregivers linked yet. Share your code to connect.
              </p>
            </div>
          )}
        </div>
      </div>
    );
  }

  // ============ COMPANION VIEW ============
  return (
    <div className="space-y-6">
      {/* Link to Patient Section */}
      <div className="card-senior">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
            <UserPlus className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h3 className="font-semibold">Link to Patient</h3>
            <p className="text-sm text-muted-foreground">
              Enter the patient's 6-digit code
            </p>
          </div>
        </div>

        {showLinkInput ? (
          <div className="space-y-3">
            <Input
              value={linkInput}
              onChange={(e) => setLinkInput(e.target.value.toUpperCase())}
              placeholder="Enter 6-digit code"
              className="input-senior text-center font-mono text-xl tracking-widest"
              maxLength={6}
              autoComplete="off"
            />
            <div className="flex gap-2">
              <Button
                variant="secondary"
                className="flex-1"
                onClick={() => {
                  setShowLinkInput(false);
                  setLinkInput("");
                }}
              >
                Cancel
              </Button>
              <Button
                variant="coral"
                className="flex-1"
                onClick={handleLinkToPatient}
                disabled={isLinking || linkInput.length < 6}
              >
                {isLinking ? (
                  <>
                    <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                    Linking...
                  </>
                ) : (
                  <>
                    <Link2 className="w-5 h-5 mr-2" />
                    Link
                  </>
                )}
              </Button>
            </div>
          </div>
        ) : (
          <Button
            variant="coral"
            className="w-full"
            onClick={() => setShowLinkInput(true)}
          >
            <UserPlus className="w-5 h-5 mr-2" />
            Add Patient
          </Button>
        )}
      </div>

      {/* Divider */}
      <div className="border-t border-border my-2" />

      {/* My Patients Section */}
      <div className="card-senior">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-full bg-secondary/10 flex items-center justify-center">
            <Users className="w-5 h-5 text-secondary" />
          </div>
          <div>
            <h3 className="font-semibold">My Patients</h3>
            <p className="text-sm text-muted-foreground">
              {linkedPatients.filter((p) => p.linkStatus === "accepted").length}{" "}
              active
              {linkedPatients.filter((p) => p.linkStatus === "pending").length >
                0 &&
                `, ${
                  linkedPatients.filter((p) => p.linkStatus === "pending")
                    .length
                } pending`}
            </p>
          </div>
        </div>

        {linkedPatients.length > 0 ? (
          <div className="space-y-3">
            {linkedPatients.map((patient) => {
              const isPending = patient.linkStatus === "pending";

              // Calculate DOSE-level stats (not medication count)
              const { todayTaken, todayTotal } = patient.medications.reduce(
                (acc, med) => {
                  if (med.doses && med.doses.length > 0) {
                    acc.todayTotal += med.doses.length;
                    acc.todayTaken += med.doses.filter((d) => d.taken).length;
                  } else {
                    acc.todayTotal += 1;
                    acc.todayTaken += med.taken ? 1 : 0;
                  }
                  return acc;
                },
                { todayTaken: 0, todayTotal: 0 }
              );

              return (
                <button
                  key={patient.id}
                  onClick={() => {
                    if (!isPending) {
                      // Navigate to dedicated patient page
                      navigate(`/companion/patient/${patient.id}`);
                      onPatientSelect?.(patient.id);
                    }
                  }}
                  disabled={isPending}
                  className={`w-full bg-muted rounded-xl p-4 flex items-center gap-4 text-left transition-all ${
                    isPending
                      ? "opacity-70 cursor-not-allowed"
                      : "hover:bg-muted/80 cursor-pointer"
                  }`}
                >
                  {/* Avatar */}
                  <div
                    className={`w-12 h-12 rounded-full flex items-center justify-center shrink-0 ${
                      isPending ? "bg-amber-100" : "bg-secondary/20"
                    }`}
                  >
                    {isPending ? (
                      <Clock className="w-6 h-6 text-amber-600" />
                    ) : (
                      <span className="font-bold text-lg text-secondary">
                        {patient.name[0].toUpperCase()}
                      </span>
                    )}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-semibold truncate">{patient.name}</p>
                      {isPending && (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">
                          Pending
                        </span>
                      )}
                    </div>
                    {!isPending && (
                      <div className="flex items-center gap-3 mt-1">
                        <div className="flex items-center gap-1 text-sm text-muted-foreground">
                          <CheckCircle className="w-4 h-4 text-secondary" />
                          {todayTaken}/{todayTotal} today
                        </div>
                        <div
                          className={`text-sm font-medium ${
                            patient.adherenceRate >= 80
                              ? "text-green-600"
                              : patient.adherenceRate >= 50
                              ? "text-amber-600"
                              : "text-red-600"
                          }`}
                        >
                          {patient.adherenceRate}% adherence
                        </div>
                      </div>
                    )}
                    {isPending && (
                      <p className="text-sm text-muted-foreground">
                        Waiting for patient approval
                      </p>
                    )}
                  </div>

                  {/* Arrow */}
                  {!isPending && (
                    <ChevronRight className="w-5 h-5 text-muted-foreground shrink-0" />
                  )}
                </button>
              );
            })}
          </div>
        ) : (
          <div className="bg-muted rounded-xl p-6 text-center">
            <Users className="w-10 h-10 mx-auto mb-3 text-muted-foreground" />
            <p className="text-muted-foreground">
              No patients linked yet. Ask for their link code to connect.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
