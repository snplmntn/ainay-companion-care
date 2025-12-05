import React, { useState } from 'react';
import { ArrowLeft, Plus, Calendar } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { MedicationTimeline } from '@/components/MedicationTimeline';
import { AddMedicineModal } from '@/components/AddMedicineModal';
import { Navigation } from '@/components/Navigation';

export default function Timeline() {
  const navigate = useNavigate();
  const [showAddModal, setShowAddModal] = useState(false);

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

      {/* Content */}
      <main className="p-4">
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
