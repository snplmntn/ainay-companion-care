import React, { useMemo, useState } from "react";
import {
  Check,
  Clock,
  Pill,
  ChevronDown,
  ChevronUp,
  Edit2,
  Sun,
  Sunrise,
  Sunset,
  Moon,
  CheckCircle2,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useApp } from "@/contexts/AppContext";
import { toast } from "@/hooks/use-toast";
import { type Medication } from "@/types";
import { EditMedicineModal } from "./EditMedicineModal";

// Represents a single scheduled dose entry for display
interface DoseEntry {
  medicationId: string;
  doseId?: string;
  name: string;
  dosage: string;
  time: string;
  timeSort: number;
  label: string;
  taken: boolean;
  instructions?: string;
  imageUrl?: string;
  category: string;
  frequency: string;
  endDate?: string;
  timePeriod?: string;
}

// Time period groupings for elderly-friendly display
type TimePeriod = "morning" | "afternoon" | "evening" | "night";

interface TimeGroup {
  period: TimePeriod;
  label: string;
  icon: React.ReactNode;
  startHour: number;
  endHour: number;
  color: string;
  bgColor: string;
}

const TIME_GROUPS: TimeGroup[] = [
  {
    period: "morning",
    label: "Morning",
    icon: <Sunrise className="w-6 h-6" />,
    startHour: 5,
    endHour: 12,
    color: "text-amber-600",
    bgColor: "bg-amber-50 dark:bg-amber-950/30",
  },
  {
    period: "afternoon",
    label: "Afternoon",
    icon: <Sun className="w-6 h-6" />,
    startHour: 12,
    endHour: 17,
    color: "text-orange-500",
    bgColor: "bg-orange-50 dark:bg-orange-950/30",
  },
  {
    period: "evening",
    label: "Evening",
    icon: <Sunset className="w-6 h-6" />,
    startHour: 17,
    endHour: 21,
    color: "text-purple-500",
    bgColor: "bg-purple-50 dark:bg-purple-950/30",
  },
  {
    period: "night",
    label: "Night",
    icon: <Moon className="w-6 h-6" />,
    startHour: 21,
    endHour: 5,
    color: "text-indigo-500",
    bgColor: "bg-indigo-50 dark:bg-indigo-950/30",
  },
];

// Convert time string to minutes from midnight for sorting
function timeToMinutes(timeStr: string): number {
  const match = timeStr.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)?$/i);
  if (!match) return 0;

  let hours = parseInt(match[1], 10);
  const minutes = parseInt(match[2], 10);
  const period = match[3]?.toUpperCase();

  if (period === "PM" && hours !== 12) hours += 12;
  if (period === "AM" && hours === 12) hours = 0;

  return hours * 60 + minutes;
}

// Get hour from time string
function getHourFromTime(timeStr: string): number {
  return Math.floor(timeToMinutes(timeStr) / 60);
}

// Convert 24-hour time to 12-hour format
function formatTime12Hour(timeStr: string): string {
  const match = timeStr.match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return timeStr;

  let hours = parseInt(match[1], 10);
  const minutes = match[2];
  const period = hours >= 12 ? "PM" : "AM";

  if (hours === 0) hours = 12;
  else if (hours > 12) hours -= 12;

  return `${hours}:${minutes} ${period}`;
}

// Get time period for a given hour
function getTimePeriod(hour: number): TimePeriod {
  if (hour >= 5 && hour < 12) return "morning";
  if (hour >= 12 && hour < 17) return "afternoon";
  if (hour >= 17 && hour < 21) return "evening";
  return "night";
}

// Full medication card for PENDING medications
function PendingMedicationCard({
  dose,
  onTake,
  onEdit,
  expanded,
  onToggleExpand,
  isLoading,
}: {
  dose: DoseEntry;
  onTake: () => void;
  onEdit: () => void;
  expanded: boolean;
  onToggleExpand: () => void;
  isLoading: boolean;
}) {
  const hasDetails = dose.instructions || dose.imageUrl;

  return (
    <div className="rounded-2xl border-2 border-border bg-card shadow-md hover:shadow-lg transition-all duration-200 overflow-hidden h-fit">
      {/* Main content */}
      <div className="p-4 lg:p-5">
        <div className="flex items-center gap-3 lg:gap-4">
          {/* Time badge */}
          <div className="flex flex-col items-center justify-center min-w-[60px] lg:min-w-[72px] h-[60px] lg:h-[72px] rounded-xl bg-primary/10">
            <span className="text-xl lg:text-2xl font-bold text-primary">
              {dose.time.split(" ")[0]}
            </span>
            <span className="text-xs lg:text-sm font-semibold text-primary">
              {dose.time.split(" ")[1]}
            </span>
          </div>

          {/* Medicine info */}
          <div className="flex-1 min-w-0">
            <h3 className="text-lg lg:text-xl font-bold leading-tight text-foreground truncate">
              {dose.name}
            </h3>
            <p className="text-base lg:text-lg text-muted-foreground mt-0.5 lg:mt-1">
              {dose.dosage}
            </p>
          </div>

          {/* Take button */}
          <Button
            variant="coral"
            size="icon-lg"
            onClick={onTake}
            disabled={isLoading}
            className="rounded-2xl shrink-0 w-14 h-14 lg:w-16 lg:h-16"
          >
            {isLoading ? (
              <Loader2 className="w-6 h-6 animate-spin" />
            ) : (
              <span className="text-base lg:text-lg font-bold">Take</span>
            )}
          </Button>
        </div>
      </div>

      {/* Expandable details section */}
      {hasDetails && (
        <>
          <button
            onClick={onToggleExpand}
            className="w-full px-4 lg:px-5 py-2 flex items-center justify-center gap-2 text-muted-foreground hover:bg-muted/50 transition-colors border-t border-border/50"
          >
            <span className="text-sm font-medium">
              {expanded ? "Hide details" : "Show details"}
            </span>
            {expanded ? (
              <ChevronUp className="w-4 h-4" />
            ) : (
              <ChevronDown className="w-4 h-4" />
            )}
          </button>

          {expanded && (
            <div className="px-4 lg:px-5 pb-4 lg:pb-5 space-y-3 border-t border-border/50 bg-muted/30">
              {dose.imageUrl && (
                <img
                  src={dose.imageUrl}
                  alt={dose.name}
                  className="w-20 h-20 lg:w-24 lg:h-24 rounded-xl object-cover mt-4"
                />
              )}
              {dose.instructions && (
                <p className="text-sm lg:text-base text-muted-foreground leading-relaxed mt-3">
                  📝 {dose.instructions}
                </p>
              )}
              <Button
                variant="ghost"
                size="sm"
                onClick={onEdit}
                className="mt-2"
              >
                <Edit2 className="w-4 h-4 mr-2" />
                Edit medication
              </Button>
            </div>
          )}
        </>
      )}

      {/* Simple edit for cards without details */}
      {!hasDetails && (
        <button
          onClick={onEdit}
          className="w-full px-4 lg:px-5 py-2 flex items-center justify-center gap-2 text-muted-foreground hover:bg-muted/50 transition-colors border-t border-border/50 text-sm"
        >
          <Edit2 className="w-4 h-4" />
          Edit
        </button>
      )}
    </div>
  );
}

// Compact card for COMPLETED medications
function CompletedMedicationRow({
  dose,
  onUndo,
  isLoading,
}: {
  dose: DoseEntry;
  onUndo: () => void;
  isLoading: boolean;
}) {
  return (
    <div className="flex items-center gap-3 py-2 lg:py-3 px-3 lg:px-4 bg-secondary/5 rounded-xl">
      <CheckCircle2 className="w-5 h-5 text-secondary shrink-0" />
      <span className="text-sm lg:text-base text-muted-foreground line-through flex-1 truncate">
        {dose.name}
      </span>
      <span className="text-xs lg:text-sm text-muted-foreground/70">
        {dose.time}
      </span>
      <button
        onClick={onUndo}
        disabled={isLoading}
        className="text-xs text-muted-foreground hover:text-foreground underline ml-2 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
      >
        {isLoading ? (
          <>
            <Loader2 className="w-3 h-3 animate-spin" />
            Wait...
          </>
        ) : (
          "Undo"
        )}
      </button>
    </div>
  );
}

export function MedicationTimeline() {
  const { medications, toggleMedication, toggleDose } = useApp();
  const [editingMedication, setEditingMedication] = useState<Medication | null>(
    null
  );
  const [expandedCards, setExpandedCards] = useState<Set<string>>(new Set());
  const [showCompleted, setShowCompleted] = useState(false);
  const [loadingMedIds, setLoadingMedIds] = useState<Set<string>>(new Set());

  const getMedicationById = (medicationId: string): Medication | undefined => {
    return medications.find((m) => m.id === medicationId);
  };

  const handleEdit = (medicationId: string) => {
    const medication = getMedicationById(medicationId);
    if (medication) {
      setEditingMedication(medication);
    }
  };

  const handleTake = async (
    id: string,
    name: string,
    doseId?: string,
    currentlyTaken?: boolean
  ) => {
    const loadingKey = doseId ? `${id}-${doseId}` : id;

    // Prevent multiple clicks
    if (loadingMedIds.has(loadingKey)) return;

    setLoadingMedIds((prev) => new Set(prev).add(loadingKey));

    try {
      if ("vibrate" in navigator) {
        navigator.vibrate(currentlyTaken ? 50 : 100);
      }

      if (doseId) {
        await toggleDose(id, doseId);
      } else {
        await toggleMedication(id);
      }

      toast({
        title: currentlyTaken ? "Unmarked" : "Great job! 💪",
        description: currentlyTaken
          ? `${name} unmarked as taken.`
          : `${name} marked as taken.`,
      });
    } finally {
      setLoadingMedIds((prev) => {
        const next = new Set(prev);
        next.delete(loadingKey);
        return next;
      });
    }
  };

  const toggleCardExpand = (cardId: string) => {
    setExpandedCards((prev) => {
      const next = new Set(prev);
      if (next.has(cardId)) {
        next.delete(cardId);
      } else {
        next.add(cardId);
      }
      return next;
    });
  };

  // Flatten medications into individual dose entries
  const doseEntries = useMemo(() => {
    const entries: DoseEntry[] = [];

    for (const med of medications) {
      if (med.doses && med.doses.length > 0) {
        for (const dose of med.doses) {
          const time12h = formatTime12Hour(dose.time);
          entries.push({
            medicationId: med.id,
            doseId: dose.id,
            name: med.name,
            dosage: med.dosage,
            time: time12h,
            timeSort: timeToMinutes(dose.time),
            label: dose.label || "Dose",
            taken: dose.taken ?? med.taken,
            instructions: med.instructions,
            imageUrl: med.imageUrl,
            category: med.category || "medicine",
            frequency: med.frequency || "once_daily",
            endDate: med.endDate,
            timePeriod: med.timePeriod,
          });
        }
      } else {
        entries.push({
          medicationId: med.id,
          name: med.name,
          dosage: med.dosage,
          time: med.time,
          timeSort: timeToMinutes(med.time),
          label: "Daily",
          taken: med.taken,
          instructions: med.instructions,
          imageUrl: med.imageUrl,
          category: med.category || "medicine",
          frequency: med.frequency || "once_daily",
          endDate: med.endDate,
          timePeriod: med.timePeriod,
        });
      }
    }

    return entries.sort((a, b) => a.timeSort - b.timeSort);
  }, [medications]);

  // Separate pending and completed
  const pendingDoses = useMemo(
    () => doseEntries.filter((d) => !d.taken),
    [doseEntries]
  );
  const completedDoses = useMemo(
    () => doseEntries.filter((d) => d.taken),
    [doseEntries]
  );

  // Group PENDING by time period
  const pendingByTime = useMemo(() => {
    const groups: Record<TimePeriod, DoseEntry[]> = {
      morning: [],
      afternoon: [],
      evening: [],
      night: [],
    };

    for (const entry of pendingDoses) {
      const hour = getHourFromTime(entry.time);
      const period = getTimePeriod(hour);
      groups[period].push(entry);
    }

    return groups;
  }, [pendingDoses]);

  // Empty state
  if (doseEntries.length === 0) {
    return (
      <div className="text-center py-12 lg:py-16">
        <div className="w-24 h-24 lg:w-32 lg:h-32 mx-auto bg-muted rounded-full flex items-center justify-center mb-6">
          <Pill className="w-12 h-12 lg:w-16 lg:h-16 text-muted-foreground" />
        </div>
        <h3 className="text-2xl lg:text-3xl font-bold mb-3">
          No Medications Yet
        </h3>
        <p className="text-lg lg:text-xl text-muted-foreground">
          Tap the + button to add your first medication.
        </p>
      </div>
    );
  }

  const takenCount = completedDoses.length;
  const totalCount = doseEntries.length;
  const pendingCount = pendingDoses.length;
  const allDone = pendingCount === 0;

  return (
    <div className="space-y-6 lg:space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-2xl lg:text-3xl font-bold flex items-center gap-3">
          <Clock className="w-7 h-7 lg:w-8 lg:h-8 text-secondary" />
          Today's Meds
        </h2>
        <div className="text-lg lg:text-xl font-semibold text-muted-foreground">
          {takenCount}/{totalCount} done
        </div>
      </div>

      {/* All done celebration */}
      {allDone && totalCount > 0 && (
        <div className="bg-secondary/20 border-2 border-secondary/30 rounded-2xl p-6 lg:p-8 text-center">
          <div className="text-4xl lg:text-5xl mb-2">🎉</div>
          <h3 className="text-xl lg:text-2xl font-bold text-secondary">
            All Done for Today!
          </h3>
          <p className="text-muted-foreground mt-1 lg:text-lg">
            Great job taking care of yourself!
          </p>
        </div>
      )}

      {/* ===== PENDING MEDICATIONS ===== */}
      {pendingCount > 0 && (
        <div className="space-y-4 lg:space-y-6">
          {/* Pending header */}
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-primary animate-pulse" />
            <span className="text-lg lg:text-xl font-bold text-foreground">
              {pendingCount} medication{pendingCount !== 1 ? "s" : ""} to take
            </span>
          </div>

          {/* Time-grouped pending medications */}
          {TIME_GROUPS.map((group) => {
            const groupDoses = pendingByTime[group.period];
            if (groupDoses.length === 0) return null;

            return (
              <div key={group.period} className="space-y-3 lg:space-y-4">
                {/* Time period header */}
                <div
                  className={`flex items-center gap-2 px-3 lg:px-4 py-2 lg:py-3 rounded-lg lg:rounded-xl ${group.bgColor}`}
                >
                  <span className={group.color}>{group.icon}</span>
                  <span
                    className={`text-lg lg:text-xl font-bold ${group.color}`}
                  >
                    {group.label}
                  </span>
                  <span className="ml-auto text-sm lg:text-base text-muted-foreground font-medium">
                    {groupDoses.length} left
                  </span>
                </div>

                {/* Medication cards - Grid on desktop */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 lg:gap-4">
                  {groupDoses.map((dose, index) => {
                    const cardId = `${dose.medicationId}-${
                      dose.doseId || index
                    }`;
                    const loadingKey = dose.doseId
                      ? `${dose.medicationId}-${dose.doseId}`
                      : dose.medicationId;
                    return (
                      <PendingMedicationCard
                        key={cardId}
                        dose={dose}
                        onTake={() =>
                          handleTake(
                            dose.medicationId,
                            dose.name,
                            dose.doseId,
                            false
                          )
                        }
                        onEdit={() => handleEdit(dose.medicationId)}
                        expanded={expandedCards.has(cardId)}
                        onToggleExpand={() => toggleCardExpand(cardId)}
                        isLoading={loadingMedIds.has(loadingKey)}
                      />
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ===== COMPLETED MEDICATIONS (Collapsed Section) ===== */}
      {completedDoses.length > 0 && (
        <div className="border-t border-border pt-4 lg:pt-6">
          {/* Collapsible header */}
          <button
            onClick={() => setShowCompleted(!showCompleted)}
            className="w-full flex items-center justify-between py-3 lg:py-4 px-4 lg:px-5 bg-secondary/10 rounded-xl hover:bg-secondary/15 transition-colors"
          >
            <div className="flex items-center gap-3">
              <CheckCircle2 className="w-6 h-6 lg:w-7 lg:h-7 text-secondary" />
              <span className="text-lg lg:text-xl font-semibold text-secondary">
                {completedDoses.length} completed
              </span>
            </div>
            <div className="flex items-center gap-2 text-muted-foreground">
              <span className="text-sm lg:text-base">
                {showCompleted ? "Hide" : "Show"}
              </span>
              {showCompleted ? (
                <ChevronUp className="w-5 h-5" />
              ) : (
                <ChevronDown className="w-5 h-5" />
              )}
            </div>
          </button>

          {/* Collapsed compact list - Grid on desktop */}
          {showCompleted && (
            <div className="mt-3 lg:mt-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2 lg:gap-3">
              {completedDoses.map((dose, index) => {
                const loadingKey = dose.doseId
                  ? `${dose.medicationId}-${dose.doseId}`
                  : dose.medicationId;
                return (
                  <CompletedMedicationRow
                    key={`${dose.medicationId}-${dose.doseId || index}`}
                    dose={dose}
                    onUndo={() =>
                      handleTake(
                        dose.medicationId,
                        dose.name,
                        dose.doseId,
                        true
                      )
                    }
                    isLoading={loadingMedIds.has(loadingKey)}
                  />
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Progress bar - Hidden on desktop (shown in sidebar) */}
      <div className="lg:hidden bg-muted rounded-2xl p-5">
        <div className="flex items-center justify-between mb-3">
          <span className="text-lg font-semibold">Today's Progress</span>
          <span className="text-2xl font-bold text-secondary">
            {totalCount > 0 ? Math.round((takenCount / totalCount) * 100) : 0}%
          </span>
        </div>
        <div className="h-4 bg-background rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-secondary to-teal-400 rounded-full transition-all duration-500"
            style={{
              width: `${totalCount > 0 ? (takenCount / totalCount) * 100 : 0}%`,
            }}
          />
        </div>
      </div>

      {/* Edit Medicine Modal */}
      {editingMedication && (
        <EditMedicineModal
          isOpen={!!editingMedication}
          onClose={() => setEditingMedication(null)}
          medication={editingMedication}
        />
      )}
    </div>
  );
}
