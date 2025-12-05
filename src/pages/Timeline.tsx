import React, { useState } from 'react';
import { ArrowLeft, Plus, Calendar, BarChart3, CalendarDays } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { MedicationTimeline } from '@/components/MedicationTimeline';
import { FutureScheduleView } from '@/components/FutureScheduleView';
import { AddMedicineModal } from '@/components/AddMedicineModal';
import { Navigation } from '@/components/Navigation';
import { RefillReminders, AdherenceAnalytics } from '@/modules/medication';
import { useApp } from '@/contexts/AppContext';

export default function Timeline() {
  const navigate = useNavigate();
  const [showAddModal, setShowAddModal] = useState(false);
  const [activeTab, setActiveTab] = useState<'today' | 'upcoming' | 'analytics'>('today');
  const { medications } = useApp();

  const today = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });

  return (
    <div className="min-h-screen bg-background pb-24">
      {/* Header */}
      <header className="bg-card border-b border-border p-4">
        <div className="flex items-center gap-4 mb-4">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="w-6 h-6" />
          </Button>
          <div>
            <h1 className="text-senior-xl font-bold">Medication Schedule</h1>
            <div className="flex items-center gap-2 text-muted-foreground">
              <Calendar className="w-4 h-4" />
              <span className="text-senior-sm">{today}</span>
            </div>
          </div>
        </div>
      </header>

      {/* Tab Switcher */}
      {medications.length > 0 && (
        <div className="px-4 py-2 bg-card border-b border-border">
          <div className="flex gap-2">
            <button
              onClick={() => setActiveTab('today')}
              className={`flex-1 py-2.5 px-3 rounded-xl text-sm font-medium transition-all flex items-center justify-center gap-1.5 ${
                activeTab === 'today'
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-muted-foreground hover:bg-muted/80'
              }`}
            >
              <Calendar className="w-4 h-4" />
              Today
            </button>
            <button
              onClick={() => setActiveTab('upcoming')}
              className={`flex-1 py-2.5 px-3 rounded-xl text-sm font-medium transition-all flex items-center justify-center gap-1.5 ${
                activeTab === 'upcoming'
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-muted-foreground hover:bg-muted/80'
              }`}
            >
              <CalendarDays className="w-4 h-4" />
              Upcoming
            </button>
            <button
              onClick={() => setActiveTab('analytics')}
              className={`flex-1 py-2.5 px-3 rounded-xl text-sm font-medium transition-all flex items-center justify-center gap-1.5 ${
                activeTab === 'analytics'
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-muted-foreground hover:bg-muted/80'
              }`}
            >
              <BarChart3 className="w-4 h-4" />
              Stats
            </button>
          </div>
        </div>
      )}

      {/* Content */}
      <main className="p-4 space-y-6">
        {activeTab === 'today' && (
          <>
            <RefillReminders compact />
            <MedicationTimeline />
          </>
        )}
        {activeTab === 'upcoming' && (
          <FutureScheduleView daysToShow={7} />
        )}
        {activeTab === 'analytics' && (
          <>
            <AdherenceAnalytics />
            <RefillReminders />
          </>
        )}
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
