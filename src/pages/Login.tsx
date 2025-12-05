import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Heart, Users, User } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useApp } from '@/contexts/AppContext';

export default function Login() {
  const navigate = useNavigate();
  const { setUserRole } = useApp();

  const handleLogin = (role: 'patient' | 'companion') => {
    setUserRole(role);
    navigate('/dashboard');
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Hero Section */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 py-12">
        {/* Logo */}
        <div className="w-24 h-24 gradient-coral rounded-3xl flex items-center justify-center mb-8 shadow-lg shadow-primary/30">
          <Heart className="w-14 h-14 text-white" fill="white" />
        </div>

        <h1 className="text-senior-3xl text-center mb-3">
          Welcome to <span className="text-primary">AInay</span>
        </h1>
        
        <p className="text-senior-lg text-muted-foreground text-center mb-12 max-w-sm">
          Your digital mother for health — caring for you every step of the way.
        </p>

        {/* Login Options */}
        <div className="w-full max-w-sm space-y-4">
          <Button
            variant="coral"
            size="xl"
            className="w-full"
            onClick={() => handleLogin('patient')}
          >
            <User className="w-7 h-7" />
            I'm a Patient
          </Button>

          <Button
            variant="teal"
            size="xl"
            className="w-full"
            onClick={() => handleLogin('companion')}
          >
            <Users className="w-7 h-7" />
            I'm a Companion
          </Button>
        </div>

        {/* Features preview */}
        <div className="mt-12 grid grid-cols-3 gap-4 w-full max-w-sm">
          {[
            { icon: '💊', label: 'Medicine Reminders' },
            { icon: '🎤', label: 'Voice Assistant' },
            { icon: '📋', label: 'Health Tracking' },
          ].map((feature, i) => (
            <div key={i} className="text-center fade-in" style={{ animationDelay: `${i * 0.1}s` }}>
              <div className="text-3xl mb-2">{feature.icon}</div>
              <p className="text-sm text-muted-foreground font-medium">{feature.label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Footer */}
      <div className="p-6 text-center">
        <p className="text-sm text-muted-foreground">
          Made with ❤️ for our beloved seniors
        </p>
      </div>
    </div>
  );
}
