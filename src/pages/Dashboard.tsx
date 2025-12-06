import React, { useState, useEffect, useMemo } from "react";
import { Navigate } from "react-router-dom";
import { Plus, Sun, CloudSun, Cloud, CloudRain, Loader2, Clock, ChevronRight, Pill, Calendar } from "lucide-react";
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

// Check if a dose can be taken (within 30 minutes before scheduled time or later)
// Only applies to patients
function canTakeDose(timeStr: string): boolean {
  const now = new Date();
  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  
  // Parse time string (supports both "8:00 AM" and "14:30" formats)
  const match = timeStr.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)?$/i);
  if (!match) return true; // If can't parse, allow action
  
  let hours = parseInt(match[1], 10);
  const minutes = parseInt(match[2], 10);
  const period = match[3]?.toUpperCase();
  
  if (period === "PM" && hours !== 12) hours += 12;
  if (period === "AM" && hours === 12) hours = 0;
  
  const scheduledMinutes = hours * 60 + minutes;
  
  // Allow if current time is 30 minutes before scheduled time or later
  return currentMinutes >= scheduledMinutes - 30;
}

// Get minutes until dose can be taken (for display)
function getMinutesUntilCanTake(timeStr: string): number {
  const now = new Date();
  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  
  const match = timeStr.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)?$/i);
  if (!match) return 0;
  
  let hours = parseInt(match[1], 10);
  const minutes = parseInt(match[2], 10);
  const period = match[3]?.toUpperCase();
  
  if (period === "PM" && hours !== 12) hours += 12;
  if (period === "AM" && hours === 12) hours = 0;
  
  const scheduledMinutes = hours * 60 + minutes;
  const canTakeAt = scheduledMinutes - 30;
  
  return Math.max(0, canTakeAt - currentMinutes);
}

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

// Get the next medication that hasn't been taken
// Priority: 1) Latest pending (past time, most recent first), 2) Next upcoming
function useNextMedication() {
  const { medications } = useApp();
  
  return useMemo(() => {
    const now = new Date();
    const currentMinutes = now.getHours() * 60 + now.getMinutes();
    
    // Flatten all doses
    const allDoses: Array<{
      medId: string;
      doseId?: string;
      name: string;
      dosage: string;
      time: string;
      timeMinutes: number;
      taken: boolean;
    }> = [];
    
    for (const med of medications) {
      if (med.doses && med.doses.length > 0) {
        for (const dose of med.doses) {
          const match = dose.time.match(/^(\d{1,2}):(\d{2})$/);
          if (match) {
            const hours = parseInt(match[1], 10);
            const minutes = parseInt(match[2], 10);
            const period = hours >= 12 ? "PM" : "AM";
            const displayHours = hours === 0 ? 12 : hours > 12 ? hours - 12 : hours;
            
            allDoses.push({
              medId: med.id,
              doseId: dose.id,
              name: med.name,
              dosage: med.dosage,
              time: `${displayHours}:${match[2]} ${period}`,
              timeMinutes: hours * 60 + minutes,
              taken: dose.taken ?? med.taken,
            });
          }
        }
      } else {
        const timeStr = med.time;
        const match = timeStr.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)?$/i);
        if (match) {
          let hours = parseInt(match[1], 10);
          const mins = parseInt(match[2], 10);
          const period = match[3]?.toUpperCase();
          
          if (period === "PM" && hours !== 12) hours += 12;
          if (period === "AM" && hours === 12) hours = 0;
          
          allDoses.push({
            medId: med.id,
            name: med.name,
            dosage: med.dosage,
            time: med.time,
            timeMinutes: hours * 60 + mins,
            taken: med.taken,
          });
        }
      }
    }
    
    allDoses.sort((a, b) => a.timeMinutes - b.timeMinutes);
    
    // Filter untaken doses
    const untakenDoses = allDoses.filter(d => !d.taken);
    
    // Separate into pending (past time) and upcoming (future time)
    const pendingDoses = untakenDoses.filter(d => d.timeMinutes < currentMinutes);
    const upcomingDoses = untakenDoses.filter(d => d.timeMinutes >= currentMinutes);
    
    // Priority 1: Oldest pending medicine (earliest past time - first in the sorted list)
    if (pendingDoses.length > 0) {
      return pendingDoses[0]; // Get the oldest pending (e.g., 9 AM before 10 AM)
    }
    
    // Priority 2: Next upcoming medicine
    if (upcomingDoses.length > 0) {
      return upcomingDoses[0]; // Get the earliest upcoming
    }
    
    return null;
  }, [medications]);
}

// Desktop Sidebar Stats Component
function DesktopSidebar({
  userName,
  currentTime,
  weather,
  weatherLoading,
  progress,
  takenCount,
  totalCount,
  pendingCount,
  allDone,
  nextMed,
  onTakeNext,
  onAddMed,
  isTakingMed,
  canTakeNext,
  minutesUntilCanTake,
}: {
  userName: string;
  currentTime: Date;
  weather: WeatherData | null;
  weatherLoading: boolean;
  progress: number;
  takenCount: number;
  totalCount: number;
  pendingCount: number;
  allDone: boolean;
  nextMed: ReturnType<typeof useNextMedication>;
  onTakeNext: () => void;
  onAddMed: () => void;
  isTakingMed: boolean;
  canTakeNext: boolean;
  minutesUntilCanTake: number;
}) {
  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return "Good Morning";
    if (hour < 17) return "Good Afternoon";
    return "Good Evening";
  };

  return (
    <div className="hidden lg:flex lg:flex-col lg:w-80 xl:w-96 bg-card border-l border-border p-5 h-screen fixed top-0 right-0">
      {/* Time & Greeting Row */}
      <div className="flex items-start justify-between gap-4 mb-4">
        <div className="flex-1 min-w-0">
          <div className="text-4xl xl:text-5xl font-bold text-foreground mb-1">
            {currentTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </div>
          <h1 className="text-lg xl:text-xl font-semibold text-muted-foreground truncate">
            {getGreeting()}, <span className="text-primary">{userName}</span>
          </h1>
          {/* Weather */}
          <div className="flex items-center gap-2 text-muted-foreground mt-2">
            {weatherLoading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : weather ? (
              <>
                <WeatherIcon condition={weather.condition} className="w-4 h-4" />
                <span className="text-sm">{weather.temperature}°C, {weather.condition}</span>
              </>
            ) : null}
          </div>
        </div>
        
        {/* Progress Circle - Compact inline */}
        <div className="relative w-20 h-20 shrink-0">
          <svg className="w-full h-full transform -rotate-90">
            <circle
              cx="40"
              cy="40"
              r="34"
              stroke="currentColor"
              strokeWidth="8"
              fill="none"
              className="text-muted"
            />
            <circle
              cx="40"
              cy="40"
              r="34"
              stroke="currentColor"
              strokeWidth="8"
              fill="none"
              strokeDasharray={213.6}
              strokeDashoffset={213.6 - (213.6 * progress) / 100}
              className="text-secondary transition-all duration-500"
              strokeLinecap="round"
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-xl font-bold">{progress}%</span>
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 gap-3 mb-4">
        <div className="bg-primary/10 rounded-xl p-3 text-center">
          <Pill className="w-6 h-6 text-primary mx-auto mb-1" />
          <div className="text-2xl font-bold text-primary">{pendingCount}</div>
          <div className="text-sm text-muted-foreground">Still to Take</div>
        </div>
        <div className="bg-secondary/10 rounded-xl p-3 text-center">
          <Calendar className="w-6 h-6 text-secondary mx-auto mb-1" />
          <div className="text-2xl font-bold text-secondary">{takenCount}</div>
          <div className="text-sm text-muted-foreground">Done! ✓</div>
        </div>
      </div>

      {/* Next Medication Card */}
      {nextMed && !allDone && (
        <div className="bg-gradient-to-br from-primary/10 to-primary/5 border-2 border-primary/20 rounded-2xl p-4 mb-4">
          <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
            <Clock className="w-4 h-4" />
            <span>Time to take: {nextMed.time}</span>
          </div>
          <h3 className="text-xl font-bold mb-0.5 truncate">{nextMed.name}</h3>
          <p className="text-base text-muted-foreground mb-3">{nextMed.dosage}</p>
          {/* Time restriction message for patients */}
          {!canTakeNext && minutesUntilCanTake > 0 && (
            <p className="text-sm text-amber-600 mb-2 flex items-center gap-1">
              <Clock className="w-3 h-3" />
              Available in {minutesUntilCanTake} min
            </p>
          )}
          <Button
            variant="coral"
            size="lg"
            onClick={onTakeNext}
            disabled={isTakingMed || !canTakeNext}
            className={`w-full rounded-xl ${!canTakeNext ? 'opacity-50' : ''}`}
            title={!canTakeNext ? 'Available 30 min before scheduled time' : undefined}
          >
            {isTakingMed ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin mr-2" />
                Saving...
              </>
            ) : (
              <>
                I Took This ✓
                <ChevronRight className="w-5 h-5 ml-1" />
              </>
            )}
          </Button>
        </div>
      )}

      {/* All Done Celebration */}
      {allDone && totalCount > 0 && (
        <div className="bg-secondary/20 border-2 border-secondary/30 rounded-2xl p-4 text-center mb-4">
          <div className="text-4xl mb-2">🎉</div>
          <h3 className="text-xl font-bold text-secondary">All Done for Today!</h3>
          <p className="text-base text-muted-foreground mt-1">You did great! Keep it up!</p>
        </div>
      )}

      {/* Spacer to push button to bottom */}
      <div className="flex-1" />

      {/* Add Medication Button - Always visible at bottom */}
      <Button
        variant="outline"
        size="lg"
        onClick={onAddMed}
        className="w-full rounded-xl shrink-0"
      >
        <Plus className="w-5 h-5 mr-2" />
        Add New Medicine
      </Button>
    </div>
  );
}

export default function Dashboard() {
  const { userName, medications, userRole, toggleMedication, toggleDose } = useApp();
  
  // Redirect companions to their dashboard
  if (userRole === "companion") {
    return <Navigate to="/companion" replace />;
  }
  
  const [showAddModal, setShowAddModal] = useState(false);
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [weatherLoading, setWeatherLoading] = useState(true);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [isTakingMed, setIsTakingMed] = useState(false);
  const { canAddMoreMedications } = useSubscription();
  const nextMed = useNextMedication();

  // Update time every minute
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 60000);
    return () => clearInterval(timer);
  }, []);

  // Fetch weather on mount
  useEffect(() => {
    fetchWeather()
      .then(setWeather)
      .catch((err) => console.warn("Weather fetch failed:", err))
      .finally(() => setWeatherLoading(false));
  }, []);

  const takenCount = medications.reduce((count, m) => {
    if (m.doses && m.doses.length > 0) {
      return count + m.doses.filter(d => d.taken).length;
    }
    return count + (m.taken ? 1 : 0);
  }, 0);
  
  const totalCount = medications.reduce((count, m) => {
    if (m.doses && m.doses.length > 0) {
      return count + m.doses.length;
    }
    return count + 1;
  }, 0);

  const progress = totalCount > 0 ? Math.round((takenCount / totalCount) * 100) : 0;
  const pendingCount = totalCount - takenCount;
  const allDone = takenCount === totalCount && totalCount > 0;
  
  // Time restriction for patients - can only take 30 min before scheduled time
  const canTakeNext = nextMed ? canTakeDose(nextMed.time) : false;
  const minutesUntilCanTake = nextMed ? getMinutesUntilCanTake(nextMed.time) : 0;

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return "Good Morning";
    if (hour < 17) return "Good Afternoon";
    return "Good Evening";
  };

  const handleTakeNext = async () => {
    if (!nextMed || isTakingMed) return;
    
    setIsTakingMed(true);
    
    try {
      if ("vibrate" in navigator) {
        navigator.vibrate(100);
      }
      
      if (nextMed.doseId) {
        await toggleDose(nextMed.medId, nextMed.doseId);
      } else {
        await toggleMedication(nextMed.medId);
      }
      
      toast({
        title: "Great job! 💪",
        description: `${nextMed.name} marked as taken.`,
      });
    } finally {
      setIsTakingMed(false);
    }
  };

  const handleAddMed = () => {
    if (!canAddMoreMedications(medications.length)) {
            toast({
              title: "You've reached the limit",
              description: `The free plan only allows ${FREE_TIER_MAX_MEDICATIONS} medicines. Upgrade to Pro to add more.`,
              variant: "destructive",
            });
      return;
    }
    setShowAddModal(true);
  };

  return (
    <div className="min-h-screen bg-background lg:ml-20 xl:ml-24">
      {/* Desktop Stats Sidebar - Right side on large screens */}
      <DesktopSidebar
        userName={userName}
        currentTime={currentTime}
        weather={weather}
        weatherLoading={weatherLoading}
        progress={progress}
        takenCount={takenCount}
        totalCount={totalCount}
        pendingCount={pendingCount}
        allDone={allDone}
        nextMed={nextMed}
        onTakeNext={handleTakeNext}
        onAddMed={handleAddMed}
        isTakingMed={isTakingMed}
        canTakeNext={canTakeNext}
        minutesUntilCanTake={minutesUntilCanTake}
      />

      {/* Main Content Area */}
      <div className="flex-1 pb-32 lg:pb-8 lg:mr-80 xl:mr-96">
        {/* Mobile Header - Hidden on Desktop */}
        <header className="lg:hidden bg-card border-b border-border p-6">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-4xl font-bold text-foreground mb-1">
                {currentTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </div>
              <h1 className="text-xl font-semibold text-muted-foreground">
                {getGreeting()}, <span className="text-primary">{userName}</span>
              </h1>
              <div className="flex items-center gap-2 text-muted-foreground mt-2">
                {weatherLoading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : weather ? (
                  <>
                    <WeatherIcon condition={weather.condition} className="w-4 h-4" />
                    <span className="text-sm">
                      {weather.temperature}°C, {weather.condition}
                    </span>
                  </>
                ) : null}
              </div>
            </div>

            {/* Progress circle */}
            <div className="relative w-20 h-20">
              <svg className="w-full h-full transform -rotate-90">
                <circle
                  cx="40"
                  cy="40"
                  r="34"
                  stroke="currentColor"
                  strokeWidth="8"
                  fill="none"
                  className="text-muted"
                />
                <circle
                  cx="40"
                  cy="40"
                  r="34"
                  stroke="currentColor"
                  strokeWidth="8"
                  fill="none"
                  strokeDasharray={213.6}
                  strokeDashoffset={213.6 - (213.6 * progress) / 100}
                  className="text-secondary transition-all duration-500"
                  strokeLinecap="round"
                />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-xl font-bold">{progress}%</span>
              </div>
            </div>
          </div>
        </header>

        {/* Mobile Status Banner - Hidden on Desktop */}
        <div className="lg:hidden">
          {allDone ? (
            <div className="bg-secondary/20 border-b border-secondary/30 px-6 py-4">
              <div className="flex items-center gap-3">
                <span className="text-4xl">🎉</span>
                <div>
                  <p className="text-xl font-bold text-secondary">All done for today!</p>
                  <p className="text-base text-muted-foreground">You did great!</p>
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-muted/50 border-b border-border px-6 py-4">
              <p className="text-xl">
                <span className="font-bold text-primary">{pendingCount}</span>
                <span className="text-muted-foreground"> medicine{pendingCount !== 1 ? 's' : ''} left to take</span>
              </p>
            </div>
          )}
        </div>

        {/* Content */}
        <main className="p-4 lg:p-8 lg:max-w-4xl xl:max-w-5xl">
          {/* Morning Briefing */}
          <div className="mb-6">
            <FeatureGate 
              feature="morning_briefing" 
              showPreview={true}
              lockedMessage="Upgrade to Pro for daily health updates"
            >
              <MorningBriefing />
            </FeatureGate>
          </div>
          
          {/* Refill Reminders */}
          <RefillReminders compact />

          {/* Medication Timeline */}
          <MedicationTimeline />
        </main>
      </div>

      {/* Mobile Sticky "Next Medication" Bar - Hidden on Desktop */}
      {nextMed && (
        <div className="lg:hidden fixed bottom-20 left-0 right-0 bg-card/95 backdrop-blur-sm border-t-2 border-primary/20 shadow-lg z-30 safe-area-bottom">
          <div className="px-4 py-4">
            <div className="flex items-center gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 text-base text-muted-foreground mb-1">
                  <Clock className="w-5 h-5" />
                  <span>Time: {nextMed.time}</span>
                </div>
                <p className="text-xl font-bold truncate">{nextMed.name}</p>
                <p className="text-base text-muted-foreground">{nextMed.dosage}</p>
                {/* Time restriction message for patients */}
                {!canTakeNext && minutesUntilCanTake > 0 && (
                  <p className="text-sm text-amber-600 mt-1 flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    Available in {minutesUntilCanTake} min
                  </p>
                )}
              </div>
              
              <Button
                variant="coral"
                size="xl"
                onClick={handleTakeNext}
                disabled={isTakingMed || !canTakeNext}
                className={`rounded-2xl px-6 shrink-0 text-lg ${!canTakeNext ? 'opacity-50' : ''}`}
                title={!canTakeNext ? 'Available 30 min before scheduled time' : undefined}
              >
                {isTakingMed ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin mr-2" />
                    Saving...
                  </>
                ) : (
                  "I Took It ✓"
                )}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Mobile Floating Add Button - Hidden on Desktop */}
      <Button
        variant="coral"
        size="icon-xl"
        className="lg:hidden fixed bottom-24 right-4 rounded-full shadow-2xl shadow-primary/40 z-20"
        onClick={handleAddMed}
      >
        <Plus className="w-10 h-10" />
      </Button>

      {/* Add Medicine Modal */}
      <AddMedicineModal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
      />

      {/* Navigation - Mobile only */}
      <Navigation />
    </div>
  );
}
