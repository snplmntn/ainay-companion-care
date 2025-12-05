import React from "react";
import { Check, Clock, Pill } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useApp } from "@/contexts/AppContext";
import { toast } from "@/hooks/use-toast";
import { CATEGORY_LABELS, CATEGORY_COLORS, FREQUENCY_LABELS } from "@/types";

export function MedicationTimeline() {
  const { medications, toggleMedication } = useApp();

  const handleTake = (id: string, name: string) => {
    toggleMedication(id);
    toast({
      title: "Great job! 💪",
      description: `${name} marked as taken.`,
    });
  };

  // Group medications by category
  const groupedByCategory = medications.reduce((acc, med) => {
    const category = med.category || "medicine";
    if (!acc[category]) {
      acc[category] = [];
    }
    acc[category].push(med);
    return acc;
  }, {} as Record<string, typeof medications>);

  // Sort categories: medicine first, then vitamins, supplements, herbal, other
  const categoryOrder = ["medicine", "vitamin", "supplement", "herbal", "other"];
  const sortedCategories = Object.keys(groupedByCategory).sort(
    (a, b) => categoryOrder.indexOf(a) - categoryOrder.indexOf(b)
  );

  if (medications.length === 0) {
    return (
      <div className="text-center py-8">
        <div className="w-20 h-20 mx-auto bg-muted rounded-full flex items-center justify-center mb-4">
          <Pill className="w-10 h-10 text-muted-foreground" />
        </div>
        <h3 className="text-senior-lg font-semibold mb-2">No Medications Yet</h3>
        <p className="text-muted-foreground">
          Tap the + button to add your first medication.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h2 className="text-senior-xl font-bold flex items-center gap-2">
        <Clock className="w-6 h-6 text-secondary" />
        Today's Schedule
      </h2>

      {sortedCategories.map((category) => {
        const categoryMeds = groupedByCategory[category];
        const takenCount = categoryMeds.filter((m) => m.taken).length;

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
                  {takenCount}/{categoryMeds.length} taken
                </span>
              </div>
            </div>

            {/* Medications in Category */}
            <div className="space-y-3">
              {categoryMeds.map((med, index) => (
                <div
                  key={med.id}
                  className={`card-senior flex items-center gap-4 transition-all fade-in ${
                    med.taken ? "opacity-70" : ""
                  }`}
                  style={{ animationDelay: `${index * 0.05}s` }}
                >
                  {/* Medicine Photo or Time */}
                  {med.imageUrl ? (
                    <div className="relative">
                      <img
                        src={med.imageUrl}
                        alt={med.name}
                        className={`w-14 h-14 rounded-xl object-cover border-2 ${
                          med.taken ? "border-secondary" : "border-primary/30"
                        }`}
                      />
                      <div
                        className={`absolute -bottom-1 -right-1 text-xs font-bold px-1.5 py-0.5 rounded ${
                          med.taken
                            ? "bg-secondary text-white"
                            : "bg-primary text-white"
                        }`}
                      >
                        {med.time.split(" ")[0]}
                      </div>
                    </div>
                  ) : (
                    <div
                      className={`flex flex-col items-center ${
                        med.taken ? "text-secondary" : "text-primary"
                      }`}
                    >
                      <span className="text-senior-sm font-bold">
                        {med.time.split(" ")[0]}
                      </span>
                      <span className="text-xs font-semibold">
                        {med.time.split(" ")[1]}
                      </span>
                    </div>
                  )}

                  {/* Divider */}
                  <div
                    className={`w-1 h-16 rounded-full ${
                      med.taken ? "bg-secondary" : "bg-primary/30"
                    }`}
                  />

                  {/* Medicine info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <Pill
                        className={`w-5 h-5 shrink-0 ${
                          med.taken ? "text-secondary" : "text-primary"
                        }`}
                      />
                      <span
                        className={`text-senior-lg font-bold truncate ${
                          med.taken
                            ? "line-through text-muted-foreground"
                            : ""
                        }`}
                      >
                        {med.name}
                      </span>
                    </div>
                    <p className="text-senior-sm text-muted-foreground">
                      {med.dosage}
                    </p>
                    {/* Frequency badge */}
                    {med.frequency && med.frequency !== "once_daily" && (
                      <span className="inline-block text-xs px-2 py-0.5 mt-1 rounded-full bg-muted text-muted-foreground">
                        {FREQUENCY_LABELS[med.frequency]}
                      </span>
                    )}
                    {med.instructions && (
                      <p className="text-sm text-muted-foreground mt-1 truncate">
                        {med.instructions}
                      </p>
                    )}
                  </div>

                  {/* Action button */}
                  <Button
                    variant={med.taken ? "secondary" : "coral"}
                    size="icon-lg"
                    onClick={() => handleTake(med.id, med.name)}
                    className="rounded-full shrink-0"
                  >
                    {med.taken ? (
                      <Check className="w-6 h-6" />
                    ) : (
                      <span className="text-sm font-bold">Take</span>
                    )}
                  </Button>
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
            {medications.filter((m) => m.taken).length} of {medications.length}{" "}
            completed
          </span>
        </div>
        <div className="mt-2 h-2 bg-background rounded-full overflow-hidden">
          <div
            className="h-full bg-secondary rounded-full transition-all duration-500"
            style={{
              width: `${
                medications.length > 0
                  ? (medications.filter((m) => m.taken).length /
                      medications.length) *
                    100
                  : 0
              }%`,
            }}
          />
        </div>
      </div>
    </div>
  );
}
