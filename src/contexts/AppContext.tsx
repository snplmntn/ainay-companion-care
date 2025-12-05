import React, { createContext, useContext, useState, ReactNode } from 'react';
import { Medication, UserRole } from '@/types';

interface AppContextType {
  userRole: UserRole;
  setUserRole: (role: UserRole) => void;
  userName: string;
  setUserName: (name: string) => void;
  medications: Medication[];
  addMedication: (med: Omit<Medication, 'id' | 'taken'>) => void;
  toggleMedication: (id: string) => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

const defaultMedications: Medication[] = [
  { id: '1', name: 'Losartan', dosage: '50mg', time: '7:00 AM', taken: false, instructions: 'Take after breakfast' },
  { id: '2', name: 'Metformin', dosage: '500mg', time: '12:00 PM', taken: false, instructions: 'Take with lunch' },
  { id: '3', name: 'Amlodipine', dosage: '10mg', time: '8:00 PM', taken: false, instructions: 'Take before bed' },
];

export function AppProvider({ children }: { children: ReactNode }) {
  const [userRole, setUserRole] = useState<UserRole>(null);
  const [userName, setUserName] = useState('Lola');
  const [medications, setMedications] = useState<Medication[]>(defaultMedications);

  const addMedication = (med: Omit<Medication, 'id' | 'taken'>) => {
    const newMed: Medication = {
      ...med,
      id: Date.now().toString(),
      taken: false,
    };
    setMedications(prev => [...prev, newMed]);
  };

  const toggleMedication = (id: string) => {
    setMedications(prev =>
      prev.map(med =>
        med.id === id ? { ...med, taken: !med.taken } : med
      )
    );
  };

  return (
    <AppContext.Provider value={{
      userRole,
      setUserRole,
      userName,
      setUserName,
      medications,
      addMedication,
      toggleMedication,
    }}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within AppProvider');
  }
  return context;
}
