import React from 'react';
import { ArrowLeft, User, Bell, Moon, HelpCircle, LogOut, Heart, Shield, Globe } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Navigation } from '@/components/Navigation';
import { useApp } from '@/contexts/AppContext';

export default function Profile() {
  const navigate = useNavigate();
  const { userName, userRole, setUserRole } = useApp();

  const handleLogout = () => {
    setUserRole(null);
    navigate('/');
  };

  const menuItems = [
    { icon: User, label: 'Personal Info', action: () => {} },
    { icon: Bell, label: 'Notifications', action: () => {} },
    { icon: Globe, label: 'Language', action: () => {} },
    { icon: Shield, label: 'Privacy', action: () => {} },
    { icon: HelpCircle, label: 'Help & Support', action: () => {} },
  ];

  return (
    <div className="min-h-screen bg-background pb-24">
      {/* Header */}
      <header className="gradient-coral text-white p-6 rounded-b-3xl">
        <div className="flex items-center gap-4 mb-6">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)} className="text-white hover:bg-white/20">
            <ArrowLeft className="w-6 h-6" />
          </Button>
          <h1 className="text-senior-xl font-bold">Profile</h1>
        </div>

        <div className="flex items-center gap-4">
          <div className="w-20 h-20 bg-white/20 rounded-full flex items-center justify-center">
            <User className="w-10 h-10" />
          </div>
          <div>
            <h2 className="text-senior-2xl">{userName}</h2>
            <p className="text-white/80 capitalize">{userRole}</p>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="p-4 space-y-4 -mt-4">
        {/* Stats Card */}
        <div className="card-senior">
          <div className="flex items-center gap-3 mb-4">
            <Heart className="w-6 h-6 text-primary" />
            <h3 className="text-senior-lg font-semibold">Health Stats</h3>
          </div>
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <p className="text-senior-xl font-bold text-primary">7</p>
              <p className="text-sm text-muted-foreground">Day Streak</p>
            </div>
            <div>
              <p className="text-senior-xl font-bold text-secondary">95%</p>
              <p className="text-sm text-muted-foreground">Adherence</p>
            </div>
            <div>
              <p className="text-senior-xl font-bold text-primary">3</p>
              <p className="text-sm text-muted-foreground">Active Meds</p>
            </div>
          </div>
        </div>

        {/* Menu Items */}
        <div className="card-senior p-2">
          {menuItems.map((item, index) => (
            <button
              key={index}
              onClick={item.action}
              className="w-full flex items-center gap-4 p-4 rounded-xl hover:bg-muted transition-colors"
            >
              <item.icon className="w-6 h-6 text-muted-foreground" />
              <span className="text-senior-base flex-1 text-left">{item.label}</span>
              <ArrowLeft className="w-5 h-5 text-muted-foreground rotate-180" />
            </button>
          ))}
        </div>

        {/* Logout */}
        <Button
          variant="outline"
          size="lg"
          className="w-full text-destructive border-destructive hover:bg-destructive/10"
          onClick={handleLogout}
        >
          <LogOut className="w-6 h-6" />
          Log Out
        </Button>
      </main>

      {/* Navigation */}
      <Navigation />
    </div>
  );
}
