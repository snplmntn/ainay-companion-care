import React, { useState, useEffect } from "react";
import { Navigate } from "react-router-dom";
import { Plus, Sun, CloudSun, Cloud, CloudRain, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { MorningBriefing } from "@/components/MorningBriefing";
import { MedicationTimeline } from "@/components/MedicationTimeline";
import { AddMedicineModal } from "@/components/AddMedicineModal";
import { Navigation } from "@/components/Navigation";
import { useApp } from "@/contexts/AppContext";
import { fetchWeather, type WeatherData } from "@/modules/morning-briefing";
import { FeatureGate, useSubscription, FREE_TIER_MAX_MEDICATIONS } from "@/modules/subscription";
import { RefillReminders } from "@/modules/medication";
import { toast } from "@/hooks/use-toast";

// Weather icon based on condition
function WeatherIcon({
  condition,
  className,
}: {
  condition: string;
  className?: string;
}) {
  const cond = condition.toLowerCase();
  if (
    cond.includes("rain") ||
    cond.includes("drizzle") ||
    cond.includes("shower")
  ) {
    return <CloudRain className={className} />;
  }
  if (cond.includes("cloud") || cond.includes("overcast")) {
    return <Cloud className={className} />;
  }
  return <Sun className={className} />;
}

export default function Dashboard() {
  const { userName, medications, userRole } = useApp();
  
  // Redirect companions to their dashboard
  if (userRole === "companion") {
    return <Navigate to="/companion" replace />;
  }
  const [showAddModal, setShowAddModal] = useState(false);
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [weatherLoading, setWeatherLoading] = useState(true);
  const { canAddMoreMedications, isFree } = useSubscription();

  // Fetch weather on mount
  useEffect(() => {
    fetchWeather()
      .then(setWeather)
      .catch((err) => console.warn("Weather fetch failed:", err))
      .finally(() => setWeatherLoading(false));
  }, []);

  const takenCount = medications.filter((m) => m.taken).length;
  const progress =
    medications.length > 0
      ? Math.round((takenCount / medications.length) * 100)
      : 0;

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return "Good Morning";
    if (hour < 17) return "Good Afternoon";
    return "Good Evening";
  };

  return (
    <div className="min-h-screen bg-background pb-24">
      {/* Header */}
      <header className="bg-card border-b border-border p-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-senior-2xl">
              {getGreeting()}, <span className="text-primary">{userName}!</span>
            </h1>
            <div className="flex items-center gap-2 text-muted-foreground mt-1">
              {weatherLoading ? (
                <>
                  <Loader2 className="w-5 h-5 text-secondary animate-spin" />
                  <span className="text-senior-sm">Loading weather...</span>
                </>
              ) : weather ? (
                <>
                  <WeatherIcon
                    condition={weather.condition}
                    className="w-5 h-5 text-secondary"
                  />
                  <span className="text-senior-sm">
                    {weather.temperature}°C, {weather.condition}
                  </span>
                </>
              ) : (
                <>
                  <CloudSun className="w-5 h-5 text-secondary" />
                  <span className="text-senior-sm">Weather unavailable</span>
                </>
              )}
            </div>
          </div>

          {/* Progress circle */}
          <div className="relative w-16 h-16">
            <svg className="w-full h-full transform -rotate-90">
              <circle
                cx="32"
                cy="32"
                r="28"
                stroke="currentColor"
                strokeWidth="6"
                fill="none"
                className="text-muted"
              />
              <circle
                cx="32"
                cy="32"
                r="28"
                stroke="currentColor"
                strokeWidth="6"
                fill="none"
                strokeDasharray={175.9}
                strokeDashoffset={175.9 - (175.9 * progress) / 100}
                className="text-secondary transition-all duration-500"
                strokeLinecap="round"
              />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-sm font-bold">{progress}%</span>
            </div>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="p-4 space-y-6">
        {/* Morning Briefing - Pro feature */}
        <FeatureGate 
          feature="morning_briefing" 
          showPreview={true}
          lockedMessage="Morning Briefing is a Pro feature"
        >
          <MorningBriefing />
        </FeatureGate>
        
        {/* Refill Reminders - Shows only if there are prescriptions ending soon */}
        <RefillReminders compact />

        {/* Medication Timeline */}
        <MedicationTimeline />
      </main>

      {/* Floating Add Button */}
      <Button
        variant="coral"
        size="icon-xl"
        className="fixed bottom-24 right-4 rounded-full shadow-2xl shadow-primary/40 z-30"
        onClick={() => {
          if (!canAddMoreMedications(medications.length)) {
            toast({
              title: "Medication limit reached",
              description: `Free plan allows up to ${FREE_TIER_MAX_MEDICATIONS} medications. Upgrade to Pro for unlimited.`,
              variant: "destructive",
            });
            return;
          }
          setShowAddModal(true);
        }}
      >
        <Plus className="w-10 h-10" />
      </Button>

      {/* Add Medicine Modal */}
      <AddMedicineModal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
      />

      {/* Navigation */}
      <Navigation />
    </div>
  );
}
