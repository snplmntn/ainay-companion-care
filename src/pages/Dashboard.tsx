import React, { useState } from 'react';
import { Plus, Sun, CloudSun } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { MorningBriefing } from '@/components/MorningBriefing';
import { MedicationTimeline } from '@/components/MedicationTimeline';
import { AddMedicineModal } from '@/components/AddMedicineModal';
import { Navigation } from '@/components/Navigation';
import { useApp } from '@/contexts/AppContext';

export default function Dashboard() {
  const { userName, medications } = useApp();
  const [showAddModal, setShowAddModal] = useState(false);

  const takenCount = medications.filter(m => m.taken).length;
  const progress = Math.round((takenCount / medications.length) * 100);

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good Morning';
    if (hour < 17) return 'Good Afternoon';
    return 'Good Evening';
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
              <CloudSun className="w-5 h-5 text-secondary" />
              <span className="text-senior-sm">28°C, Partly Cloudy</span>
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
        {/* Morning Briefing */}
        <MorningBriefing />

        {/* Quick Stats */}
        <div className="grid grid-cols-2 gap-4">
          <div className="card-senior bg-coral-light">
            <p className="text-senior-sm text-muted-foreground mb-1">Today's Meds</p>
            <p className="text-senior-2xl text-primary">{medications.length}</p>
          </div>
          <div className="card-senior bg-teal-light">
            <p className="text-senior-sm text-muted-foreground mb-1">Completed</p>
            <p className="text-senior-2xl text-secondary">{takenCount}/{medications.length}</p>
          </div>
        </div>

        {/* Medication Timeline */}
        <MedicationTimeline />
      </main>

      {/* Floating Add Button */}
      <Button
        variant="coral"
        size="icon-xl"
        className="fixed bottom-24 right-4 rounded-full shadow-2xl shadow-primary/40 z-30"
        onClick={() => setShowAddModal(true)}
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
