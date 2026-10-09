import React, { useState } from 'react';
import { Menu, X } from 'lucide-react';

interface HeaderProps {
  currentRoute: string;
  navigate: (route: string) => void;
  hasActiveSession?: boolean;
}

export const Header: React.FC<HeaderProps> = ({ currentRoute, navigate, hasActiveSession }) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <header className="sticky top-0 z-40 bg-[#F4F0E8]/95 backdrop-blur-sm border-b border-[#C9C3B8] h-[84px] transition-all">
      <div className="max-w-7xl mx-auto h-full px-6 sm:px-8 lg:px-12 flex items-center justify-between">
        
        {/* LEFT: S.19 SKINLABS Brand */}
        <button
          onClick={() => {
            navigate('/');
            setMobileMenuOpen(false);
          }}
          className="text-left group focus:outline-none cursor-pointer"
          aria-label="S.19 SKINLABS Home"
        >
          <div className="flex items-baseline gap-1">
            <span className="text-2xl sm:text-3xl font-medium tracking-[-0.03em] text-[#171715] group-hover:opacity-80 transition-opacity">
              S:19
            </span>
          </div>
          <span className="block text-[9px] sm:text-[10px] tracking-[0.3em] font-medium uppercase text-[#6D6A63] -mt-1 group-hover:text-[#171715] transition-colors">
            SKINLABS
          </span>
        </button>

        {/* CENTER: Find your phase */}
        <nav className="hidden md:flex items-center justify-center">
          <button
            onClick={() => navigate('/find-phase')}
            className={`text-sm tracking-wide transition-all cursor-pointer relative py-2 px-3 ${
              currentRoute === '/find-phase' || currentRoute === '/assessment'
                ? 'text-[#171715] font-medium'
                : 'text-[#6D6A63] hover:text-[#171715]'
            }`}
          >
            Find your phase
            {(currentRoute === '/find-phase' || currentRoute === '/assessment') && (
              <span className="absolute bottom-0 left-3 right-3 h-[1px] bg-[#171715]" />
            )}
          </button>
        </nav>

        {/* Mobile menu toggle */}
        <div className="flex md:hidden items-center gap-3">

          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="p-2 text-[#171715] focus:outline-none"
            aria-label="Toggle Menu"
          >
            {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>
      </div>

      {/* Mobile dropdown */}
      {mobileMenuOpen && (
        <div className="md:hidden bg-[#F4F0E8] border-b border-[#C9C3B8] px-6 py-6 space-y-4 shadow-sm">
          <button
            onClick={() => {
              navigate('/');
              setMobileMenuOpen(false);
            }}
            className="block w-full text-left py-2 text-base font-medium text-[#171715]"
          >
            Home
          </button>
          <button
            onClick={() => {
              navigate('/find-phase');
              setMobileMenuOpen(false);
            }}
            className="block w-full text-left py-2 text-base font-medium text-[#171715]"
          >
            Find your phase
          </button>

        </div>
      )}
    </header>
  );
};
