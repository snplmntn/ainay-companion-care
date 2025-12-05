// ============================================
// Drug Interaction Warning Card Component
// ============================================

import React from "react";
import {
  AlertOctagon,
  AlertTriangle,
  Info,
  ChevronRight,
  ArrowLeft,
  Stethoscope,
  ShieldAlert,
  Pill,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import type {
  DetectedInteraction,
  InteractionSeverity,
} from "../services/interactionService";
import { getSeverityColor } from "../services/interactionService";

interface Props {
  newMedicineName: string;
  interactions: DetectedInteraction[];
  onProceedAnyway: () => void;
  onGoBack: () => void;
}

function SeverityIcon({ severity }: { severity: InteractionSeverity }) {
  const colors = getSeverityColor(severity);
  const iconClass = `w-5 h-5 ${colors.icon}`;

  switch (severity) {
    case "Major":
      return <AlertOctagon className={iconClass} />;
    case "Moderate":
      return <AlertTriangle className={iconClass} />;
    case "Minor":
      return <Info className={iconClass} />;
  }
}

function SeverityBadge({ severity }: { severity: InteractionSeverity }) {
  const colors = getSeverityColor(severity);

  return (
    <span
      className={`px-2.5 py-1 rounded-full text-xs font-bold uppercase tracking-wide ${colors.bg} ${colors.text} ${colors.border} border`}
    >
      {severity}
    </span>
  );
}

export function InteractionWarningCard({
  newMedicineName,
  interactions,
  onProceedAnyway,
  onGoBack,
}: Props) {
  const hasMajorInteraction = interactions.some((i) => i.severity === "Major");
  const hasModerateInteraction = interactions.some(
    (i) => i.severity === "Moderate"
  );

  // Determine the overall warning level
  const overallLevel: InteractionSeverity = hasMajorInteraction
    ? "Major"
    : hasModerateInteraction
    ? "Moderate"
    : "Minor";

  const overallColors = getSeverityColor(overallLevel);

  return (
    <div className="bg-card rounded-2xl border border-border overflow-hidden">
      {/* Header with Warning */}
      <div
        className={`px-6 py-5 border-b ${overallColors.bg} ${overallColors.border}`}
      >
        <div className="flex items-start gap-4">
          <div
            className={`w-14 h-14 rounded-2xl flex items-center justify-center ${
              hasMajorInteraction
                ? "bg-red-100 dark:bg-red-900/50"
                : hasModerateInteraction
                ? "bg-amber-100 dark:bg-amber-900/50"
                : "bg-blue-100 dark:bg-blue-900/50"
            }`}
          >
            <ShieldAlert
              className={`w-7 h-7 ${
                hasMajorInteraction
                  ? "text-red-600 dark:text-red-400"
                  : hasModerateInteraction
                  ? "text-amber-600 dark:text-amber-400"
                  : "text-blue-600 dark:text-blue-400"
              }`}
            />
          </div>
          <div className="flex-1">
            <h3 className={`font-bold text-lg ${overallColors.text}`}>
              Drug Interaction{interactions.length > 1 ? "s" : ""} Detected
            </h3>
            <p className="text-sm text-muted-foreground mt-1">
              <span className="font-semibold">{newMedicineName}</span> may
              interact with{" "}
              {interactions.length === 1 ? (
                <span className="font-semibold">
                  {interactions[0].currentMedication}
                </span>
              ) : (
                <span className="font-semibold">
                  {interactions.length} of your current medications
                </span>
              )}
            </p>
          </div>
        </div>
      </div>

      {/* Doctor Consultation Recommendation */}
      <div className="px-6 py-4 bg-gradient-to-r from-primary/5 to-secondary/5 border-b border-border">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
            <Stethoscope className="w-5 h-5 text-primary" />
          </div>
          <p className="text-sm font-medium">
            We recommend consulting your doctor or pharmacist before taking this
            medicine together with your current medications.
          </p>
        </div>
      </div>

      {/* Interaction Details */}
      <div className="p-6">
        <Accordion type="multiple" className="space-y-3">
          {interactions.map((interaction, index) => {
            const colors = getSeverityColor(interaction.severity);

            return (
              <AccordionItem
                key={index}
                value={`interaction-${index}`}
                className={`border rounded-xl overflow-hidden ${colors.border}`}
              >
                <AccordionTrigger
                  className={`px-4 py-3 hover:no-underline ${colors.bg}`}
                >
                  <div className="flex items-center gap-3 flex-1 text-left">
                    <SeverityIcon severity={interaction.severity} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold">
                          Interaction with {interaction.currentMedication}
                        </span>
                        <SeverityBadge severity={interaction.severity} />
                      </div>
                    </div>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="px-4 pb-4 pt-2">
                  <div className="space-y-4">
                    {/* Clinical Effect */}
                    <div>
                      <h5 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1">
                        What could happen
                      </h5>
                      <p className="text-sm">{interaction.clinicalEffect}</p>
                    </div>

                    {/* Mechanism */}
                    <div>
                      <h5 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1">
                        Why it happens
                      </h5>
                      <p className="text-sm text-muted-foreground">
                        {interaction.mechanism}
                      </p>
                    </div>

                    {/* Safer Alternative */}
                    {interaction.saferAlternative && (
                      <div
                        className={`p-3 rounded-lg border ${
                          interaction.severity === "Major"
                            ? "bg-green-50 dark:bg-green-950/30 border-green-200 dark:border-green-800"
                            : "bg-muted/50 border-border"
                        }`}
                      >
                        <h5 className="text-xs font-semibold uppercase tracking-wide text-green-700 dark:text-green-400 mb-1">
                          Safer Alternative
                        </h5>
                        <p className="text-sm font-medium">
                          {interaction.saferAlternative}
                        </p>
                      </div>
                    )}
                  </div>
                </AccordionContent>
              </AccordionItem>
            );
          })}
        </Accordion>

        {/* Action Buttons */}
        <div className="mt-6 space-y-3">
          {/* Primary Action - Go Back */}
          <Button
            variant="outline"
            size="lg"
            className="w-full"
            onClick={onGoBack}
          >
            <ArrowLeft className="w-5 h-5 mr-2" />
            Go Back & Review
          </Button>

          {/* Secondary Action - Proceed Anyway (with warning styling for Major) */}
          <Button
            variant={hasMajorInteraction ? "destructive" : "secondary"}
            size="lg"
            className="w-full"
            onClick={onProceedAnyway}
          >
            <Pill className="w-5 h-5 mr-2" />
            I Understand, Continue Anyway
            <ChevronRight className="w-5 h-5 ml-2" />
          </Button>

          {hasMajorInteraction && (
            <p className="text-xs text-center text-muted-foreground">
              ⚠️ Major interactions detected. Proceeding is not recommended
              without medical consultation.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
