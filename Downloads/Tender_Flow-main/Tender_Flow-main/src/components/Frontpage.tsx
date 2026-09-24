import * as React from 'react';
import { useState, useEffect } from 'react';
import { RfpInput } from './RfpInput'; 
import { Tender } from '../../types';

interface FrontPageProps {
  onNavigateToDiscovery: () => void;
  onProcessRfp: (data: { source: 'URL' | 'File'; content: string; fileName?: string; }) => void;
  tenders: Tender[];
  isScanning: boolean;           
  onProcessDiscovery: (url: string) => void;
  onRefreshDiscovery: () => void;
}

interface AgentNodeProps {
  icon: string;
  label: string;
  status: string;
  isActive: boolean;
  isCompleted: boolean;
}

export const FrontPage: React.FC<FrontPageProps> = ({
  onNavigateToDiscovery,
  onRefreshDiscovery,
  onProcessRfp,
  tenders = [],
  isScanning,        
  onProcessDiscovery 
}) => {

  const [activeStep, setActiveStep] = useState(0);
  const totalSteps = 6;

  useEffect(() => {
    if (isScanning) {
      setActiveStep(0);
      return;
    }
    const interval = setInterval(() => {
      setActiveStep((prev) => (prev < totalSteps ? prev + 1 : 1));
    }, 5000); // UPDATED: Increased by 2 seconds (from 3000 to 5000)
    return () => clearInterval(interval);
  }, [isScanning]);

  return (
    <div className="w-full h-[calc(100vh-100px)] flex gap-6 overflow-hidden text-slate-50 relative">
      
      {/* --- LEFT & CENTER OPERATIONS HUB (80% Area) --- */}
      <div className="flex-[8.5] flex flex-col gap-6 h-full relative z-10">
        
        {/* TOP: EXECUTIVE HEADER & KPIS */}
        <div className="h-[20%] min-h-[120px] bg-slate-900/30 border border-slate-700/50 rounded-3xl p-8 flex items-center justify-between backdrop-blur-2xl shadow-[0_8px_32px_rgba(0,0,0,0.4)]">
          <div className="space-y-2">
            <h1 className="text-4xl font-black italic tracking-tighter text-white uppercase drop-shadow-md">
              Bidding <span className="text-gold-500">Dashboard</span>
            </h1>
            <p className="text-[10px] text-blue-300 font-bold leading-relaxed max-w-sm uppercase tracking-[0.2em] opacity-80">
              Autonomous B2B Procurement Intelligence. <br/>Streamlining Discovery to Response.
            </p>
          </div>
          
          <div className="flex gap-4">
  {[
    { label: 'Response Volume', val: '+320%', subtext: 'Annual Submissions', color: 'text-emerald-400', glow: 'shadow-[0_0_15px_rgba(52,211,153,0.1)]' },
    { label: 'Turnaround Time', val: '< 1 hr', subtext: 'Down from 1 week', color: 'text-blue-400', glow: 'shadow-[0_0_15px_rgba(96,165,250,0.1)]' },
    { label: 'Tech Match Speed', val: '96%', subtext: 'Faster processing', color: 'text-gold-400', glow: 'shadow-[0_0_15px_rgba(250,204,21,0.1)]' }
  ].map((stat, idx) => (
    <div 
      key={idx} 
      className={`bg-slate-900/50 border border-slate-800 rounded-2xl px-6 py-4 flex flex-col justify-center items-center ${stat.glow}`}
    >
      <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1 text-center">
        {stat.label}
      </span>
      <span className={`text-2xl font-black ${stat.color}`}>
        {stat.val}
      </span>
      <span className="text-[8px] font-bold text-slate-400/80 uppercase tracking-widest mt-1 text-center">
        {stat.subtext}
      </span>
    </div>
  ))}
</div>
        </div>

        {/* --- MIDDLE SECTION: URGENCY HEATMAP (65%) & CHART (35%) --- */}
        <div className="h-[75%] flex gap-6">
          
          {/* 1. BID URGENCY HEATMAP (65%) */}
          <div className="flex-[6.5] bg-slate-900/30 border border-slate-700/50 rounded-3xl p-7 flex flex-col backdrop-blur-2xl shadow-[0_8px_32px_rgba(0,0,0,0.4)] relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-b from-transparent to-slate-950/50 pointer-events-none" />
            
            <div className="flex justify-between items-center mb-6 relative z-10">
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-3">
                  <span className="relative flex h-2.5 w-2.5">
                    <span className={`animate-ping absolute inline-flex h-full w-full rounded-full ${isScanning ? 'bg-gold-400' : 'bg-red-400'} opacity-75`}></span>
                    <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${isScanning ? 'bg-gold-500' : 'bg-red-500'}`}></span>
                  </span>
                  <h3 className="text-[11px] font-black uppercase tracking-[0.3em] text-slate-300 drop-shadow-sm">
                    {isScanning ? "Agentic Search in Progress..." : "High-Urgency Discovery"}
                  </h3>
                </div>
                <button 
                  onClick={onRefreshDiscovery}
                  disabled={isScanning}
                  className={`text-[9px] font-black px-3 py-1.5 rounded-lg border border-slate-700 transition-all shadow-md
                    ${isScanning ? 'opacity-50 cursor-not-allowed' : 'hover:bg-slate-800 hover:text-gold-400 hover:border-gold-500/30 text-slate-400'}`}
                >
                  {isScanning ? 'SCANNING...' : '↻ REFRESH SCAN'}
                </button>
                <span className="px-2.5 py-1 bg-blue-500/10 border border-blue-500/30 text-blue-400 rounded-md text-[8px] font-black uppercase tracking-widest shadow-sm">
                            Due ≤ 3 Months
                </span>
              </div>
            </div>

            <div className="flex-1 flex flex-col gap-4 relative z-10 overflow-hidden pr-2">
  {(isScanning ? [1, 2, 3] : tenders.slice(0, 3)).map((bid, i) => (
    <div 
      key={i} 
      className={`flex-1 flex items-center justify-between p-5 rounded-2xl border transition-all duration-500 backdrop-blur-md
        ${isScanning 
          ? 'border-slate-700/50 bg-slate-800/10 animate-pulse' 
          : 'border-red-500/20 bg-red-500/5 hover:border-red-500/40 hover:bg-red-500/10 hover:shadow-[0_0_20px_rgba(239,68,68,0.1)] group'
        }`}
    >
      {isScanning ? (
        <div className="flex items-center justify-between w-full">
          <div className="space-y-3">
            <div className="h-5 w-64 bg-slate-700/50 rounded animate-pulse" />
            <div className="h-2.5 w-40 bg-slate-800/80 rounded animate-pulse" />
          </div>
          <div className="h-10 w-24 bg-slate-800/80 rounded-xl animate-pulse" />
        </div>
      ) : (
        <>
          <div className="flex flex-col gap-2 w-[65%]">
            <div className="flex items-start gap-3">
              <span className="text-[9px] font-black px-2.5 py-1 rounded bg-slate-900 border border-slate-700 text-slate-400 shadow-inner mt-0.5 shrink-0">
                {(bid as Tender).id}
              </span>
              <span className="text-sm font-bold text-white text-center items-center group-hover:text-gold-400 transition-colors uppercase italic tracking-tight drop-shadow-sm line-clamp-2 leading-snug pr-4">
                {(bid as Tender).title}
              </span>
            </div>
            <div className="flex gap-5 text-[10px] font-bold uppercase tracking-widest text-slate-400 mt-1">
              <span className="bg-slate-950/50 px-2 py-0.5 rounded truncate max-w-[160px]">
                Category: {(bid as Tender).category}
              </span>
              <span className="text-red-400 bg-red-950/30 px-2 py-0.5 rounded border border-red-900/50 flex items-center gap-1 shrink-0">
                <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" /> Ends: {(bid as Tender).endDate}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-8 shrink-0">
            <div className="text-right">
              <div className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-0.5">Match Score</div>
              <div className="text-xl font-black text-white drop-shadow-[0_0_8px_rgba(255,255,255,0.3)]">{(bid as Tender).matchScore}%</div>
            </div>
            <button 
              onClick={() => onProcessDiscovery((bid as Tender).url)}
              className="bg-slate-900 border border-slate-600 text-slate-300 hover:bg-gold-500 hover:border-gold-400 hover:text-slate-950 px-6 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all shadow-[0_5px_15px_rgba(0,0,0,0.3)] hover:shadow-[0_0_20px_rgba(212,175,55,0.4)]"
            >
              Analyze
            </button>
          </div>
        </>
      )}
    </div>
  ))}
</div>
</div>

          {/* 2. DIRECT INGESTION HUB (Right - 40%) */}
          <div className="flex-[4] bg-slate-900/30 border border-slate-700/50 rounded-3xl p-7 relative overflow-hidden backdrop-blur-2xl shadow-[0_8px_32px_rgba(0,0,0,0.4)] flex flex-col">
            <div className="absolute -right-4 -bottom-4 text-[7rem] text-blue-500/5 font-black pointer-events-none italic select-none">
              INGEST
            </div>

            <div className="relative z-10 flex flex-col h-full">
              <div className="flex justify-between items-start mb-6">
                <div>
                  <h2 className="text-2xl font-black uppercase italic text-white tracking-tighter drop-shadow-md">Direct <span className="text-gold-400">Parser</span></h2>
                  <p className="text-slate-400 text-[9px] uppercase tracking-[0.3em] font-bold mt-1.5">Manual Document Ingestion</p>
                </div>
                <button 
                  onClick={onNavigateToDiscovery}
                  className="text-[9px] font-black text-gold-500/80 hover:text-gold-400 border border-gold-500/30 hover:bg-gold-500/10 px-3 py-1.5 rounded-lg uppercase tracking-widest transition-all shadow-sm"
                >
                  Discover Bids →
                </button>
              </div>

              <div className="flex-grow flex flex-col justify-center">
                <div className="bg-slate-950/60 rounded-2xl p-3 border border-slate-700/50 shadow-inner backdrop-blur-md">
                  <RfpInput onSubmit={onProcessRfp} />
                </div>
              </div>
            </div>
          </div>
        </div>

      </div>
      
      {/* --- RIGHT HUD: VERTICAL AGENTIC ORCHESTRATION --- */}
      <div className="flex-[2] bg-slate-900/30 border border-slate-700/50 rounded-3xl p-8 relative flex flex-col shadow-[0_8px_32px_rgba(0,0,0,0.4)] overflow-hidden min-h-full backdrop-blur-2xl">
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-600 via-purple-500 to-gold-500" />
        
        <div className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] text-center mb-8 border-b border-slate-700/50 pb-5 shrink-0">
          Orchestration Pipeline
        </div>
        
        <div className="flex-1 flex flex-col justify-between py-2 relative">
          <AgentNode icon="📡" label="Sales" status="Scanning Portals" isActive={activeStep === 0} isCompleted={activeStep > 0} />
          <AgentNode icon="👤" label="Review" status="Filtering Bids" isActive={activeStep === 1} isCompleted={activeStep > 1} />
          <AgentNode icon="⚙️" label="Technical" status="SKU Matching" isActive={activeStep === 2} isCompleted={activeStep > 2} />
          <AgentNode icon="💰" label="Financial" status="Pricing Logic" isActive={activeStep === 3} isCompleted={activeStep > 3} />
          <AgentNode icon="🤖" label="Master" status="Strategic Planning" isActive={activeStep === 4} isCompleted={activeStep > 4} />
          <AgentNode icon="👤" label="Feedback" status="Finalizing Report" isActive={activeStep === 5} isCompleted={activeStep > 5} />
          <AgentNode icon="🏆" label="Win" status="Bid Authorized" isActive={activeStep === 6} isCompleted={activeStep > 6} />
        </div>

        {activeStep >= 6 && (
          <div className="mt-8 animate-in zoom-in-95 fade-in slide-in-from-bottom-4 duration-700">
            <button 
              onClick={onNavigateToDiscovery} 
              className="w-full bg-gradient-to-r from-amber-500 to-amber-400 text-slate-950 py-5 rounded-xl font-black uppercase text-xs tracking-[0.2em] 
                         hover:scale-[1.02] active:scale-95
                         shadow-[0_0_35px_rgba(245,158,11,0.4)] border border-white/40
                         transition-all duration-300 relative overflow-hidden group"
            >
              <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-300" />
              <span className="relative z-10 flex items-center justify-center gap-2 drop-shadow-sm">
                Initiate Final Bid <span className="animate-bounce text-base">→</span>
              </span>
            </button>
            <p className="text-center text-[9px] text-gold-400 font-black uppercase mt-4 tracking-widest animate-pulse drop-shadow-[0_0_5px_rgba(250,204,21,0.5)]">
              Master AI Authorization Confirmed
            </p>
          </div>
        )}
      </div>
      
      <style>{`.scrollbar-hide::-webkit-scrollbar { display: none; }`}</style>
    </div>
  );
};

const AgentNode: React.FC<AgentNodeProps> = ({ icon, label, status, isActive, isCompleted }) => (
  <div className={`z-10 flex items-center gap-5 w-full transition-all duration-500 ${isActive ? 'translate-x-3 scale-[1.05]' : 'opacity-40 hover:opacity-70'}`}>
    <div className={`w-14 h-14 rounded-2xl flex items-center justify-center border-2 transition-all shrink-0 ${
      isActive ? 'bg-slate-900 border-gold-400 shadow-[0_0_25px_rgba(212,175,55,0.5)]' : 
      isCompleted ? 'bg-gold-500 border-gold-400 shadow-[0_0_10px_rgba(212,175,55,0.2)]' : 'bg-slate-950 border-slate-800'
    }`}>
      {isCompleted && !isActive ? <span className="text-slate-950 text-2xl font-black">✓</span> : <span className="text-2xl drop-shadow-md">{icon}</span>}
    </div>
    
    <div className="flex flex-col justify-center">
      <div className={`text-[13px] font-black uppercase tracking-widest drop-shadow-sm ${isActive ? 'text-gold-400' : 'text-slate-200'}`}>{label}</div>
      <div className="text-[10px] text-slate-400 uppercase font-bold tracking-wider leading-none mt-1.5">{status}</div>
    </div>
  </div>
);