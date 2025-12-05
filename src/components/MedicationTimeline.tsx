import React from 'react';
import { Check, Clock, Pill } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useApp } from '@/contexts/AppContext';
import { toast } from '@/hooks/use-toast';

export function MedicationTimeline() {
  const { medications, toggleMedication } = useApp();

  const handleTake = (id: string, name: string) => {
    toggleMedication(id);
    toast({
      title: "Great job! 💪",
      description: `${name} marked as taken.`,
    });
  };

  return (
    <div className="space-y-4">
      <h2 className="text-senior-xl font-bold flex items-center gap-2">
        <Clock className="w-6 h-6 text-secondary" />
        Today's Medications
      </h2>

      <div className="space-y-3">
        {medications.map((med, index) => (
          <div
            key={med.id}
            className={`card-senior flex items-center gap-4 transition-all fade-in ${
              med.taken ? 'opacity-60' : ''
            }`}
            style={{ animationDelay: `${index * 0.1}s` }}
          >
            {/* Time indicator */}
            <div className={`flex flex-col items-center ${med.taken ? 'text-secondary' : 'text-primary'}`}>
              <span className="text-senior-sm font-bold">{med.time.split(' ')[0]}</span>
              <span className="text-xs font-semibold">{med.time.split(' ')[1]}</span>
            </div>

            {/* Divider */}
            <div className={`w-1 h-16 rounded-full ${med.taken ? 'bg-secondary' : 'bg-primary/30'}`} />

            {/* Medicine info */}
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <Pill className={`w-5 h-5 ${med.taken ? 'text-secondary' : 'text-primary'}`} />
                <span className={`text-senior-lg font-bold ${med.taken ? 'line-through text-muted-foreground' : ''}`}>
                  {med.name}
                </span>
              </div>
              <p className="text-senior-sm text-muted-foreground">{med.dosage}</p>
              {med.instructions && (
                <p className="text-sm text-muted-foreground mt-1">{med.instructions}</p>
              )}
            </div>

            {/* Action button */}
            <Button
              variant={med.taken ? 'secondary' : 'coral'}
              size="icon-lg"
              onClick={() => handleTake(med.id, med.name)}
              className="rounded-full shrink-0"
            >
              <Check className={`w-6 h-6 ${med.taken ? '' : 'opacity-0'}`} />
              {!med.taken && <span className="text-sm font-bold">Take</span>}
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
}
