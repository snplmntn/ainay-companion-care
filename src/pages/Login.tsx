import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Heart, Users, User, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useApp } from '@/contexts/AppContext';

export default function Login() {
  const navigate = useNavigate();
  const { setUserRole, setUserName } = useApp();
  const [step, setStep] = useState<'name' | 'role'>('name');
  const [name, setName] = useState('');

  const handleNameSubmit = () => {
    if (name.trim()) {
      setUserName(name.trim());
      setStep('role');
    }
  };

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
          Your digital health companion — caring for you every step of the way.
        </p>

        {step === 'name' ? (
          /* Name Input Step */
          <div className="w-full max-w-sm space-y-4">
            <div>
              <label className="text-senior-sm font-semibold text-muted-foreground mb-2 block">
                What's your name?
              </label>
              <Input
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="Enter your name"
                className="input-senior text-center"
                onKeyDown={e => e.key === 'Enter' && handleNameSubmit()}
              />
            </div>
            <Button
              variant="coral"
              size="xl"
              className="w-full"
              onClick={handleNameSubmit}
              disabled={!name.trim()}
            >
              Continue
              <ArrowRight className="w-6 h-6" />
            </Button>
          </div>
        ) : (
          /* Role Selection Step */
          <div className="w-full max-w-sm space-y-4">
            <p className="text-senior-base text-center text-muted-foreground mb-4">
              Hi <span className="text-primary font-semibold">{name}</span>! How will you use AInay?
            </p>
            <Button
              variant="coral"
              size="xl"
              className="w-full"
              onClick={() => handleLogin('patient')}
            >
              <User className="w-7 h-7" />
              I'm managing my health
            </Button>

            <Button
              variant="teal"
              size="xl"
              className="w-full"
              onClick={() => handleLogin('companion')}
            >
              <Users className="w-7 h-7" />
              I'm a caregiver/companion
            </Button>
          </div>
        )}

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
          Made with ❤️ for better health
        </p>
      </div>
    </div>
  );
}
