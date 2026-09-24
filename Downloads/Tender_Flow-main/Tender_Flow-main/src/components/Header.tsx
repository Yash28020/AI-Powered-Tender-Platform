
import * as React from 'react';
import { Logo } from './Logo';
import { View } from '../../types';

interface HeaderProps {
  currentView: View;
  setCurrentView: (view: View) => void;
}

export const Header: React.FC<HeaderProps> = ({ currentView, setCurrentView }) => {
  const navItems: { id: View; label: string }[] = [
   { id: 'frontpage', label: 'Dashboard' },
    { id: 'discovery', label: 'Discovery' },
    { id: 'store', label: 'Inventory'},
    { id: 'config', label: 'Settings'},
    { id: 'vault', label: 'Vault'},
    { id: 'logs', label: 'Terminal'},
  ];

  return (
    <header className="bg-slate-950 sticky top-0 z-[100] px-8 py-4 border-b border-slate-800 flex justify-between items-center shadow-2xl backdrop-blur-md bg-opacity-90">
      {/* 1. BRANDING AREA */}
      <div className="flex items-center gap-4 group cursor-pointer" onClick={() => setCurrentView('discovery')}>
        <Logo />
        <div className="flex flex-col">
          <h1 className="text-2xl font-black tracking-tighter text-white uppercase italic leading-none">
            Tender<span className="text-gold-500">Flow</span>
          </h1>
          <span className="text-[8px] font-black text-slate-500 uppercase tracking-[0.4em] mt-1 ml-0.5">
            Industrial Systems
          </span>
        </div>
      </div>

      {/* 2. HORIZONTAL NAVIGATION */}
      <nav className="flex items-center gap-1 bg-slate-900/50 p-1.5 rounded-2xl border border-slate-800">
        {navItems.map(item => (
          <button
            key={item.id}
            onClick={() => setCurrentView(item.id)}
            className={`px-5 py-2 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all duration-300 ${
              currentView === item.id
                ? 'bg-gold-500 shadow-[0_0_15px_rgba(212,175,55,0.3)] scale-105'
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            {item.label}
          </button>
        ))}
      </nav>

      {/* 3. OPERATOR STATUS */}
      <div 
        onClick={() => setCurrentView('config')}
        className="hidden md:flex items-center gap-3 pl-6 border-l border-slate-800 cursor-pointer group hover:bg-slate-900/50 p-2 rounded-xl transition-all"
      >
        <div className="text-right group-hover:translate-x-[-2px] transition-transform">
          <p className="text-[9px] font-black text-white uppercase tracking-tighter group-hover:text-gold-500 transition-colors">
            Ansh Pratap Singh
          </p>
          <p className="text-[8px] font-bold text-emerald-500 uppercase tracking-widest">
            Operator Online
          </p>
        </div>
        <div className="w-8 h-8 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-xs group-hover:border-gold-500/50 group-hover:shadow-[0_0_10px_rgba(212,175,55,0.2)] transition-all">
          👤
        </div>
      </div>
    </header>
  );
};