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
  Heart,
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

interface Props {
  newMedicineName: string;
  interactions: DetectedInteraction[];
  onProceedAnyway: () => void;
  onGoBack: () => void;
}

// Brand-aligned severity colors
function getBrandSeverityColor(severity: InteractionSeverity) {
  switch (severity) {
    case "Major":
      return {
        bg: "bg-primary/10 dark:bg-primary/20",
        text: "text-primary dark:text-primary",
        border: "border-primary/30",
        icon: "text-primary",
        badge: "bg-primary text-white",
      };
    case "Moderate":
      return {
        bg: "bg-amber-50 dark:bg-amber-950/30",
        text: "text-amber-700 dark:text-amber-400",
        border: "border-amber-200 dark:border-amber-800",
        icon: "text-amber-600 dark:text-amber-400",
        badge: "bg-amber-500 text-white",
      };
    case "Minor":
      return {
        bg: "bg-secondary/10 dark:bg-secondary/20",
        text: "text-secondary dark:text-secondary",
        border: "border-secondary/30",
        icon: "text-secondary",
        badge: "bg-secondary text-white",
      };
  }
}

function SeverityIcon({ severity }: { severity: InteractionSeverity }) {
  const colors = getBrandSeverityColor(severity);
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
  const colors = getBrandSeverityColor(severity);

  return (
    <span
      className={`px-2.5 py-1 rounded-full text-xs font-bold uppercase tracking-wide ${colors.badge}`}
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

  return (
    <div className="bg-card rounded-3xl border-2 border-primary/20 overflow-hidden shadow-xl shadow-primary/10">
      {/* Branded Header with Coral Gradient */}
      <div className="relative px-6 py-6 bg-gradient-to-br from-primary via-primary to-[hsl(16_100%_72%)] overflow-hidden">
        {/* Decorative Pattern */}
        <div className="absolute inset-0 opacity-10">
          <div className="absolute -top-4 -right-4 w-32 h-32 rounded-full border-4 border-white"></div>
          <div className="absolute -bottom-8 -left-8 w-40 h-40 rounded-full border-4 border-white"></div>
        </div>

        <div className="relative flex items-start gap-4">
          <div className="w-16 h-16 rounded-2xl bg-white/20 backdrop-blur-sm flex items-center justify-center border border-white/30">
            <ShieldAlert className="w-8 h-8 text-white" />
          </div>
          <div className="flex-1">
            <h3 className="font-bold text-xl text-white">
              Drug Interaction{interactions.length > 1 ? "s" : ""} Detected
            </h3>
            <p className="text-sm text-white/90 mt-1">
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

      {/* Doctor Consultation Recommendation - Teal Themed */}
      <div className="px-6 py-4 bg-gradient-to-r from-secondary/10 to-teal-light/50 dark:from-secondary/20 dark:to-secondary/10 border-b border-secondary/20">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-secondary/20 flex items-center justify-center shrink-0">
            <Stethoscope className="w-6 h-6 text-secondary" />
          </div>
          <div>
            <p className="text-sm font-bold text-secondary">Recommendation</p>
            <p className="text-sm text-muted-foreground">
              Consult your doctor or pharmacist before taking these medicines
              together.
            </p>
          </div>
        </div>
      </div>

      {/* Interaction Details */}
      <div className="p-6">
        <Accordion type="multiple" className="space-y-3">
          {interactions.map((interaction, index) => {
            const colors = getBrandSeverityColor(interaction.severity);

            return (
              <AccordionItem
                key={index}
                value={`interaction-${index}`}
                className={`border-2 rounded-2xl overflow-hidden ${colors.border}`}
              >
                <AccordionTrigger
                  className={`px-4 py-4 hover:no-underline ${colors.bg}`}
                >
                  <div className="flex items-center gap-3 flex-1 text-left">
                    <SeverityIcon severity={interaction.severity} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold">
                          {interaction.currentMedication}
                        </span>
                        <SeverityBadge severity={interaction.severity} />
                      </div>
                    </div>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="px-4 pb-4 pt-2">
                  <div className="space-y-4">
                    {/* Clinical Effect */}
                    <div className="bg-muted/50 rounded-xl p-3">
                      <h5 className="text-xs font-bold uppercase tracking-wide text-primary mb-1 flex items-center gap-1">
                        <Heart className="w-3 h-3" />
                        What could happen
                      </h5>
                      <p className="text-sm">{interaction.clinicalEffect}</p>
                    </div>

                    {/* Mechanism */}
                    <div>
                      <h5 className="text-xs font-bold uppercase tracking-wide text-muted-foreground mb-1">
                        Why it happens
                      </h5>
                      <p className="text-sm text-muted-foreground">
                        {interaction.mechanism}
                      </p>
                    </div>

                    {/* Safer Alternative */}
                    {interaction.saferAlternative && (
                      <div className="p-3 rounded-xl border-2 border-secondary/30 bg-secondary/10">
                        <h5 className="text-xs font-bold uppercase tracking-wide text-secondary mb-1">
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
          {/* Primary Action - Go Back (Teal) */}
          <Button
            variant="teal"
            size="lg"
            className="w-full"
            onClick={onGoBack}
          >
            <ArrowLeft className="w-5 h-5 mr-2" />
            Go Back & Review
          </Button>

          {/* Secondary Action - Proceed Anyway */}
          <Button
            variant="outline"
            size="lg"
            className={`w-full border-2 ${
              hasMajorInteraction
                ? "border-primary/50 text-primary hover:bg-primary/10"
                : ""
            }`}
            onClick={onProceedAnyway}
          >
            <Pill className="w-5 h-5 mr-2" />
            I Understand, Continue Anyway
            <ChevronRight className="w-5 h-5 ml-2" />
          </Button>

          {hasMajorInteraction && (
            <div className="flex items-center justify-center gap-2 py-2 px-4 rounded-xl bg-primary/5 border border-primary/20">
              <AlertTriangle className="w-4 h-4 text-primary shrink-0" />
              <p className="text-xs text-primary font-medium">
                Medical consultation recommended before proceeding
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
