import React from 'react';
import { Home, MessageCircle, Calendar, User } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useApp } from '@/contexts/AppContext';

export function Navigation() {
  const location = useLocation();
  const navigate = useNavigate();
  const { userRole } = useApp();

  // Different navigation for patients vs companions
  const navItems = userRole === 'companion' 
    ? [
        // Companions: Care dashboard is their home
        { path: '/companion', icon: Home, label: 'Care' },
        { path: '/ask', icon: MessageCircle, label: 'Help' },
        { path: '/profile', icon: User, label: 'Me' },
      ]
    : [
        // Patients: Standard navigation
        { path: '/dashboard', icon: Home, label: 'Home' },
        { path: '/ask', icon: MessageCircle, label: 'Help' },
        { path: '/timeline', icon: Calendar, label: 'Meds' },
        { path: '/profile', icon: User, label: 'Me' },
      ];

  return (
    <>
      {/* Desktop Side Navigation - Hidden on mobile */}
      <nav className="hidden lg:flex fixed left-0 top-0 bottom-0 w-20 xl:w-24 bg-card border-r border-border flex-col items-center py-8 z-50">
        {/* Logo area */}
        <div className="mb-8">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-primary to-primary/80 flex items-center justify-center">
            <span className="text-white font-bold text-xl">A</span>
          </div>
        </div>

        {/* Nav items */}
        <div className="flex flex-col items-center gap-2 flex-1">
          {navItems.map((item) => {
            const isActive = location.pathname === item.path;
            return (
              <button
                key={item.path}
                onClick={() => navigate(item.path)}
                className={`
                  flex flex-col items-center justify-center gap-1.5
                  w-16 xl:w-20 h-16 xl:h-20 rounded-2xl
                  transition-all duration-200
                  ${isActive
                    ? 'text-primary bg-primary/10'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
                  }
                `}
                title={item.label}
              >
                <item.icon 
                  className={`w-6 h-6 xl:w-7 xl:h-7 ${isActive ? 'stroke-[2.5px]' : 'stroke-[2px]'}`} 
                />
                <span className="text-xs font-semibold">{item.label}</span>
              </button>
            );
          })}
        </div>
      </nav>

      {/* Mobile Bottom Navigation - Hidden on desktop */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 bg-card border-t-2 border-border pb-safe-bottom z-40 shadow-lg">
        <div className="flex justify-around py-1">
          {navItems.map((item) => {
            const isActive = location.pathname === item.path;
            return (
              <button
                key={item.path}
                onClick={() => navigate(item.path)}
                className={`
                  flex flex-col items-center justify-center gap-1 
                  min-w-[72px] min-h-[64px] p-2 rounded-xl 
                  transition-all duration-200
                  ${isActive
                    ? 'text-primary bg-primary/10 scale-105'
                    : 'text-muted-foreground hover:text-foreground active:scale-95'
                  }
                `}
              >
                <item.icon 
                  className={`w-7 h-7 ${isActive ? 'stroke-[2.5px]' : 'stroke-[2px]'}`} 
                />
                <span 
                  className={`
                    text-sm font-bold
                    ${isActive ? 'text-primary' : ''}
                  `}
                >
                  {item.label}
                </span>
              </button>
            );
          })}
        </div>
      </nav>
    </>
  );
}
