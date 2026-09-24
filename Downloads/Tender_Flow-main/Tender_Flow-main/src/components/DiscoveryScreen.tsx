import * as React from 'react';
import { useState } from 'react';
import {SearchX } from 'lucide-react';
import { SKU, Tender, DiscoveryFilters } from '../../types';

interface DiscoveryScreenProps {
  inventory: SKU[];
  onSearch: (portal: string, category: string, filters: DiscoveryFilters) => void;
  onProcessDiscovery: (url: string) => void;
  onOpenAdvanced: () => void;
  isScanning: boolean;
  hasSearched: boolean;
  results: Tender[];
}

export const DiscoveryScreen: React.FC<DiscoveryScreenProps> = ({ 
  results = [],
  onSearch, 
  onProcessDiscovery,
  hasSearched,
  isScanning,
}) => {
  const [category, setCategory] = useState('');
  const [manualAvgKms, setManualAvgKms] = useState(400);
  const [manualRatePerKm, setManualRatePerKm] = useState(55);
  const [allowEMD] = useState(false);
  const [minMatchThreshold] = useState(20);
  const [deliveryType, setDeliveryType] = useState<'Pan India' | 'Intra State' | 'Zonal'>('Pan India');

  const handleSearchTrigger = () => {
    if (!category) return;
    onSearch('gem', category, {
      manualAvgKms,
      manualRatePerKm,
      allowEMD,
      minMatchThreshold,
      deliveryType,
      categories: [category]
    });
  };

  return (
    <div className="h-[calc(100vh-140px)] flex flex-col lg:flex-row gap-6 overflow-hidden text-slate-200">
      
      {/* --- SIDEBAR: LOGISTICS COMMAND --- */}
      <div className="w-full lg:w-80 flex flex-col h-full bg-slate-900/40 border border-slate-800 rounded-3xl backdrop-blur-xl shadow-2xl overflow-hidden">
        <div className="p-6 border-b border-slate-800/50">
          <h1 className="text-xl font-black italic tracking-tighter text-white uppercase drop-shadow-md">
            Master<span className="text-gold-500"> Qualification  </span>
            </h1>
          <div className="mt-3 inline-block px-2 py-1 bg-blue-500/10 border border-blue-500/30 text-blue-400 rounded-md text-[8px] font-black uppercase tracking-widest">
            Active Filter: Next 3 Months
          </div>
        </div>
        
        <div className="flex-grow overflow-y-auto p-6 space-y-8 scrollbar-hide">
          {/* Distance Logic - Increased Label Size */}
          <div className="space-y-4">
            <div className="flex justify-between items-end">
              <label className="text-xs font-black text-slate-300 uppercase tracking-widest">Avg. Distance</label>
              <span className="text-gold-500 font-mono font-bold text-sm">{manualAvgKms} KM</span>
            </div>
            <input 
              type="range" min="50" max="2500" step="50"
              value={manualAvgKms} onChange={(e) => setManualAvgKms(Number(e.target.value))}
              className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-gold-500"
            />
          </div>

          {/* Freight Logic */}
          <div className="space-y-4 pt-4 border-t border-slate-800/30">
            <div className="flex justify-between items-end">
              <label className="text-xs font-black text-slate-300 uppercase tracking-widest">Freight Rate</label>
              <span className="text-gold-500 font-mono font-bold text-sm">₹{manualRatePerKm}/KM</span>
            </div>
            <input 
              type="range" min="10" max="150" step="5"
              value={manualRatePerKm} onChange={(e) => setManualRatePerKm(Number(e.target.value))}
              className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-gold-500"
            />
            <div className="p-4 bg-slate-950 border border-gold-500/20 rounded-xl">
              <p className="text-[10px] text-gold-500 font-black uppercase tracking-tighter mb-1">Total Logistics Load</p>
              <p className="text-xl font-mono font-bold text-white tracking-tighter">₹{(manualAvgKms * manualRatePerKm).toLocaleString()}</p>
            </div>
          </div>

          {/* Regional Scope - FIXED BUTTON VISIBILITY */}
          <div className="space-y-4 pt-6 border-t border-slate-800/30">
            <label className="text-xs font-black text-slate-300 uppercase tracking-widest">Regional Scope</label>
            <div className="grid grid-cols-1 gap-2">
              {(['Pan India', 'Intra State', 'Zonal'] as const).map(type => (
                <button 
                  key={type}
                  onClick={() => setDeliveryType(type)}
                  className={`text-[10px] py-3 px-3 rounded-xl border font-black uppercase tracking-widest transition-all ${
                    deliveryType === type 
                      ? 'bg-gold-500 border-gold-500 shadow-[0_0_15px_rgba(212,175,55,0.3)]' 
                      : 'bg-slate-950 border-slate-700 text-slate-300 hover:border-gold-500/50 hover:text-white'
                  }`}
                >
                  {type}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* --- MAIN AREA: GeM DISCOVERY --- */}
      <div className="flex-grow flex flex-col h-full space-y-6 overflow-hidden">
        
        {/* ROW 1: SEARCH */}
        <div className="shrink-0">
          <div className="bg-slate-900/40 p-6 rounded-3xl border border-slate-800 backdrop-blur-xl shadow-2xl flex gap-4">
            <input
              type="text"
              placeholder="Enter Procurement Category (e.g. Cables)..."
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="flex-grow p-4 bg-slate-950 border border-slate-800 rounded-2xl focus:border-gold-500 outline-none font-bold text-white transition-all placeholder:text-slate-500 text-sm"
            />
            <button 
              onClick={handleSearchTrigger}
              disabled={isScanning || !category}
              className="bg-white text-slate-950 px-6 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all shadow-[0_0_20px_rgba(212,175,55,0.3)]"
            >
              {isScanning ? 'Scraping GeM...' : 'Run Discovery'}
            </button>

          </div>
        </div>

        {/* ROW 2: RESULTS */}
        <div className="flex-grow overflow-y-auto pr-2 scrollbar-hide pb-4">
          {(results || []).length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
              {results.map((bid) => (
                <div key={bid.id} className="bg-slate-900/40 border border-slate-800 rounded-3xl p-6 flex flex-col relative group hover:border-gold-500/50 transition-all backdrop-blur-md overflow-hidden min-h-[220px]">
                  {/* Badge Fix */}
                  <div className="absolute top-0 right-0 bg-emerald-600 text-white text-[10px] font-black px-4 py-1.5 rounded-bl-xl uppercase tracking-widest shadow-lg z-10">
                    Qualified
                  </div>
                  
                  <div className="mb-4 pt-2">
                    <div className="text-[10px] font-black text-emerald-500 uppercase tracking-widest mb-2">{bid.matchScore}% Stock Match</div>
                    <h4 className="font-bold text-white text-base leading-snug group-hover:text-gold-500 transition-colors line-clamp-2 h-10">{bid.title}</h4>
                  </div>
                  
                  <div className="space-y-2 mb-6 text-[10px] text-slate-400 font-bold uppercase tracking-widest">
                    <div className="flex items-center gap-3">🏢 <span className="truncate">{bid.org}</span></div>
                    <div className="flex items-center gap-3">📅 {bid.endDate}</div>
                  </div>

                  <button 
                    onClick={() => onProcessDiscovery(bid.url)}
                    className="w-full bg-slate-950 border border-slate-800 text-white py-4 rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-gold-500 hover:text-slate-150 transition-all mt-auto"
                  >
                    Initiate Deep Analysis
                  </button>
                </div>
              ))}
            </div>
         ) : (
            // --- EMPTY STATE HANDLING ---
            <div className="h-full flex flex-col items-center justify-center opacity-60">
              {hasSearched ? (
                <>
                  <div className="w-20 h-20 bg-slate-900 rounded-full flex items-center justify-center mb-6 border border-slate-800">
                    <SearchX className="w-10 h-10 text-slate-500" />
                  </div>
                  <h3 className="text-xl font-bold text-white mb-2">No Tenders Found</h3>
                  <p className="text-slate-500 text-xs font-medium uppercase tracking-widest max-w-md text-center leading-relaxed">
                    We couldn't find any live bids matching your criteria on GeM. <br/>
                    Try adjusting your <span className="text-gold-500">filters</span> (Distance/Rate) or broadening the search category.
                  </p>
                </>
              ) : (
                <>
                  <div className="text-6xl mb-4 grayscale opacity-50">🏛️</div>
                  <p className="font-black uppercase tracking-[0.4em] text-xs text-slate-500">Waiting for GeM Command</p>
                </>
              )}
            </div>
          )}
        </div>
    </div>

      <style>{`.scrollbar-hide::-webkit-scrollbar { display: none; }`}</style>
    </div>
  );
};