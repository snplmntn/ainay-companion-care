import React, { useMemo, useState } from "react";
import {
  Check,
  Clock,
  Pill,
  Calendar,
  AlertTriangle,
  Edit2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useApp } from "@/contexts/AppContext";
import { toast } from "@/hooks/use-toast";
import {
  CATEGORY_LABELS,
  CATEGORY_COLORS,
  FREQUENCY_LABELS,
  type Medication,
} from "@/types";
import {
  formatRemainingDays,
  getDurationStatusColor,
  isPrescriptionExpired,
  isPrescriptionEndingSoon,
} from "@/modules/medication/constants";
import { EditMedicineModal } from "./EditMedicineModal";

// Represents a single scheduled dose entry for display
interface DoseEntry {
  medicationId: string;
  doseId?: string;
  name: string;
  dosage: string;
  time: string; // Display time (e.g., "8:00 AM")
  timeSort: number; // Minutes from midnight for sorting
  label: string;
  taken: boolean;
  instructions?: string;
  imageUrl?: string;
  category: string;
  frequency: string;
  endDate?: string; // ISO date string for prescription end date
  timePeriod?: string; // Time period value
}

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

// Convert 24-hour time to 12-hour format
function formatTime12Hour(timeStr: string): string {
  const match = timeStr.match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return timeStr; // Already in 12-hour format or invalid

  let hours = parseInt(match[1], 10);
  const minutes = match[2];
  const period = hours >= 12 ? "PM" : "AM";

  if (hours === 0) hours = 12;
  else if (hours > 12) hours -= 12;

  return `${hours}:${minutes} ${period}`;
}

export function MedicationTimeline() {
  const { medications, toggleMedication, toggleDose } = useApp();
  const [editingMedication, setEditingMedication] = useState<Medication | null>(
    null
  );

  // Get the full medication object from medications list by ID
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
    // Toggle individual dose if doseId provided, otherwise toggle medication
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
  };

  // Flatten medications into individual dose entries for display
  const doseEntries = useMemo(() => {
    const entries: DoseEntry[] = [];

    for (const med of medications) {
      // If medication has doses array with multiple entries, use those
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
        // Fallback: use single time field
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

    // Sort by time
    return entries.sort((a, b) => a.timeSort - b.timeSort);
  }, [medications]);

  // Group dose entries by category
  const groupedByCategory = useMemo(() => {
    return doseEntries.reduce((acc, entry) => {
      const category = entry.category;
      if (!acc[category]) {
        acc[category] = [];
      }
      acc[category].push(entry);
      return acc;
    }, {} as Record<string, DoseEntry[]>);
  }, [doseEntries]);

  // Sort categories: medicine first, then vitamins, supplements, herbal, other
  const categoryOrder = [
    "medicine",
    "vitamin",
    "supplement",
    "herbal",
    "other",
  ];
  const sortedCategories = Object.keys(groupedByCategory).sort(
    (a, b) => categoryOrder.indexOf(a) - categoryOrder.indexOf(b)
  );

  if (doseEntries.length === 0) {
    return (
      <div className="text-center py-8">
        <div className="w-20 h-20 mx-auto bg-muted rounded-full flex items-center justify-center mb-4">
          <Pill className="w-10 h-10 text-muted-foreground" />
        </div>
        <h3 className="text-senior-lg font-semibold mb-2">
          No Medications Yet
        </h3>
        <p className="text-muted-foreground">
          Tap the + button to add your first medication.
        </p>
      </div>
    );
  }

  const takenDoses = doseEntries.filter((d) => d.taken).length;
  const totalDoses = doseEntries.length;

  return (
    <div className="space-y-6">
      <h2 className="text-senior-xl font-bold flex items-center gap-2">
        <Clock className="w-6 h-6 text-secondary" />
        Today's Schedule
      </h2>

      {sortedCategories.map((category) => {
        const categoryDoses = groupedByCategory[category];
        const takenCount = categoryDoses.filter((d) => d.taken).length;

        return (
          <div key={category} className="space-y-3">
            {/* Category Header */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span
                  className={`text-sm px-3 py-1 rounded-full border font-medium ${
                    CATEGORY_COLORS[category as keyof typeof CATEGORY_COLORS]
                  }`}
                >
                  {CATEGORY_LABELS[category as keyof typeof CATEGORY_LABELS]}
                </span>
                <span className="text-sm text-muted-foreground">
                  {takenCount}/{categoryDoses.length} doses taken
                </span>
              </div>
            </div>

            {/* Doses in Category */}
            <div className="space-y-3">
              {categoryDoses.map((dose, index) => (
                <div
                  key={`${dose.medicationId}-${dose.doseId || index}`}
                  className={`card-senior flex items-center gap-4 transition-all fade-in ${
                    dose.taken ? "opacity-70" : ""
                  }`}
                  style={{ animationDelay: `${index * 0.05}s` }}
                >
                  {/* Medicine Photo or Time */}
                  {dose.imageUrl ? (
                    <div className="relative">
                      <img
                        src={dose.imageUrl}
                        alt={dose.name}
                        className={`w-14 h-14 rounded-xl object-cover border-2 ${
                          dose.taken ? "border-secondary" : "border-primary/30"
                        }`}
                      />
                      <div
                        className={`absolute -bottom-1 -right-1 text-xs font-bold px-1.5 py-0.5 rounded ${
                          dose.taken
                            ? "bg-secondary text-white"
                            : "bg-primary text-white"
                        }`}
                      >
                        {dose.time.split(" ")[0]}
                      </div>
                    </div>
                  ) : (
                    <div
                      className={`flex flex-col items-center min-w-[50px] ${
                        dose.taken ? "text-secondary" : "text-primary"
                      }`}
                    >
                      <span className="text-senior-sm font-bold">
                        {dose.time.split(" ")[0]}
                      </span>
                      <span className="text-xs font-semibold">
                        {dose.time.split(" ")[1]}
                      </span>
                    </div>
                  )}

                  {/* Divider */}
                  <div
                    className={`w-1 h-16 rounded-full ${
                      dose.taken ? "bg-secondary" : "bg-primary/30"
                    }`}
                  />

                  {/* Medicine info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <Pill
                        className={`w-5 h-5 shrink-0 ${
                          dose.taken ? "text-secondary" : "text-primary"
                        }`}
                      />
                      <span
                        className={`text-senior-lg font-bold truncate ${
                          dose.taken ? "line-through text-muted-foreground" : ""
                        }`}
                      >
                        {dose.name}
                      </span>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-senior-sm text-muted-foreground">
                        {dose.dosage}
                      </span>
                      {dose.label &&
                        dose.label !== "Daily" &&
                        dose.label !== "Dose" && (
                          <span className="text-xs px-2 py-0.5 rounded-full bg-muted">
                            {dose.label}
                          </span>
                        )}
                      {/* Duration Badge */}
                      {dose.timePeriod && dose.timePeriod !== "ongoing" && (
                        <span
                          className={`text-xs px-2 py-0.5 rounded-full border flex items-center gap-1 ${
                            getDurationStatusColor(dose.endDate).bg
                          } ${getDurationStatusColor(dose.endDate).text} ${
                            getDurationStatusColor(dose.endDate).border
                          }`}
                        >
                          {isPrescriptionEndingSoon(dose.endDate) && (
                            <AlertTriangle className="w-3 h-3" />
                          )}
                          <Calendar className="w-3 h-3" />
                          {formatRemainingDays(dose.endDate)}
                        </span>
                      )}
                    </div>
                    {dose.instructions && (
                      <p className="text-sm text-muted-foreground mt-1 truncate">
                        {dose.instructions}
                      </p>
                    )}
                  </div>

                  {/* Action buttons */}
                  <div className="flex items-center gap-2 shrink-0">
                    {/* Edit button */}
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleEdit(dose.medicationId)}
                      className="rounded-full text-muted-foreground hover:text-primary"
                      title="Edit medication"
                    >
                      <Edit2 className="w-5 h-5" />
                    </Button>

                    {/* Take button */}
                    <Button
                      variant={dose.taken ? "secondary" : "coral"}
                      size="icon-lg"
                      onClick={() =>
                        handleTake(
                          dose.medicationId,
                          dose.name,
                          dose.doseId,
                          dose.taken
                        )
                      }
                      className="rounded-full"
                    >
                      {dose.taken ? (
                        <Check className="w-6 h-6" />
                      ) : (
                        <span className="text-sm font-bold">Take</span>
                      )}
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      })}

      {/* Summary */}
      <div className="bg-muted rounded-xl p-4">
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Today's Progress</span>
          <span className="font-semibold">
            {takenDoses} of {totalDoses} doses completed
          </span>
        </div>
        <div className="mt-2 h-2 bg-background rounded-full overflow-hidden">
          <div
            className="h-full bg-secondary rounded-full transition-all duration-500"
            style={{
              width: `${totalDoses > 0 ? (takenDoses / totalDoses) * 100 : 0}%`,
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
