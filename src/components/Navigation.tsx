import React from 'react';
import { Home, MessageCircle, Calendar, User, Users } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useApp } from '@/contexts/AppContext';

export function Navigation() {
  const location = useLocation();
  const navigate = useNavigate();
  const { userRole } = useApp();

  // Base navigation items
  const baseNavItems = [
    { path: '/dashboard', icon: Home, label: 'Home' },
    { path: '/ask', icon: MessageCircle, label: 'Ask AInay' },
    { path: '/timeline', icon: Calendar, label: 'Schedule' },
  ];

  // Add companion dashboard for companion role
  const navItems = userRole === 'companion' 
    ? [
        ...baseNavItems,
        { path: '/companion', icon: Users, label: 'Patients' },
        { path: '/profile', icon: User, label: 'Profile' },
      ]
    : [
        ...baseNavItems,
        { path: '/profile', icon: User, label: 'Profile' },
      ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-card border-t border-border pb-safe-bottom z-40">
      <div className="flex justify-around py-2">
        {navItems.map((item) => {
          const isActive = location.pathname === item.path;
          return (
            <button
              key={item.path}
              onClick={() => navigate(item.path)}
              className={`flex flex-col items-center gap-1 p-3 min-w-[60px] rounded-xl transition-all ${
                isActive
                  ? 'text-primary bg-primary/10'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <item.icon className={`w-6 h-6 ${isActive ? 'stroke-[2.5px]' : ''}`} />
              <span className={`text-xs font-semibold ${isActive ? 'text-primary' : ''}`}>
                {item.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
