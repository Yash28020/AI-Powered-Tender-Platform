import * as React from 'react';
import { useRef, useEffect } from 'react';
import { LogEntry } from '../../types';

export const LogScreen: React.FC<{ logs: LogEntry[] }> = ({ logs }) => {
  const endOfLogsRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to keep the latest agent activity visible
  useEffect(() => {
    endOfLogsRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  // Helper to assign specific neon colors to different agents
  const getAgentColor = (agent: string) => {
    switch (agent) {
      case 'MASTER_AGENT': return 'text-gold-500 drop-shadow-[0_0_8px_rgba(212,175,55,0.6)]';
      case 'SYSTEM': return 'text-red-500 drop-shadow-[0_0_8px_rgba(239,68,68,0.6)]';
      case 'PARSING_ENGINE': return 'text-fuchsia-400 drop-shadow-[0_0_8px_rgba(232,121,249,0.6)]';
      case 'TECHNICAL_AGENT': return 'text-cyan-400 drop-shadow-[0_0_8px_rgba(34,211,238,0.6)]';
      case 'PRICING_AGENT': return 'text-emerald-400 drop-shadow-[0_0_8px_rgba(52,211,153,0.6)]';
      case 'DISCOVERY_AGENT': return 'text-blue-400 drop-shadow-[0_0_8px_rgba(96,165,250,0.6)]';
      case 'SALES_AGENT': return 'text-orange-400 drop-shadow-[0_0_8px_rgba(251,146,60,0.6)]';
      case 'FINALIZING_AGENT': return 'text-pink-400 drop-shadow-[0_0_8px_rgba(244,114,182,0.6)]';
      default: return 'text-slate-400';
    }
  };

  return (
    <div className="h-full flex flex-col space-y-6 overflow-hidden text-slate-200">
      
      {/* 1. TERMINAL HEADER */}
      <div className="shrink-0 h-[15%] min-h-[100px] bg-slate-900/40 border border-slate-800 rounded-3xl p-6 flex items-center justify-between backdrop-blur-xl">
        <div className="space-y-1">
          <h1 className="text-4xl font-black italic tracking-tighter text-white uppercase drop-shadow-md">
            Execution <span className="text-gold-500">Logs</span>
          </h1>
          <p className="text-[10px] text-slate-500 font-bold leading-relaxed max-w-xs uppercase tracking-widest">
            Real-Time Agent Orchestration Stream
          </p>
        </div>
        
        <div className="flex items-center gap-3 bg-slate-950/50 px-4 py-2 rounded-xl border border-slate-800/80">
          <div className="flex gap-1.5">
            <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_10px_rgba(16,185,129,0.8)]" />
            <div className="w-2 h-2 rounded-full bg-slate-700" />
            <div className="w-2 h-2 rounded-full bg-slate-700" />
          </div>
          <span className="text-[9px] font-black text-emerald-500 uppercase tracking-widest ml-2">System Active</span>
        </div>
      </div>

      {/* 2. MAIN LOG TERMINAL */}
      <div className="flex-grow bg-slate-950/80 border border-slate-800 rounded-3xl p-6 backdrop-blur-xl flex flex-col overflow-hidden relative shadow-2xl">
        
        {/* Decorative Grid Overlay for Terminal Feel */}
        <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:20px_20px] pointer-events-none opacity-20" />
        
        {/* Scanline Effect */}
        <div className="absolute inset-0 bg-[linear-gradient(transparent_50%,rgba(0,0,0,0.25)_50%)] bg-[size:100%_4px] pointer-events-none z-20" />

        <div className="relative z-30 flex-grow overflow-y-auto pr-4 scrollbar-hide font-mono text-xs space-y-1">
          {logs.map((log, index) => (
            <div key={index} className="group flex gap-4 py-1.5 hover:bg-slate-800/30 rounded px-2 transition-all">
              
              {/* Timestamp with high-visibility slate */}
              <div className="flex-shrink-0 text-slate-500 select-none w-20">
                {log.timestamp instanceof Date 
                  ? log.timestamp.toLocaleTimeString('en-US', { hour12: false, hour: 'numeric', minute: 'numeric', second: 'numeric' }) 
                  : String(log.timestamp)}
              </div>

              {/* Agent Badge - Distinct neon colors for different agents */}
              <div className={`flex-shrink-0 w-44 font-black tracking-tighter uppercase ${getAgentColor(log.agent)}`}>
                [{log.agent}]
              </div>

              {/* Message Content */}
              <div className="flex-grow text-slate-300 leading-relaxed">
                <span className="group-hover:text-white transition-colors">
                  {log.message}
                </span>

                {/* Structured Data View (Redesigned Details) */}
                {log.data && (
                  <details className="mt-2 group/data outline-none">
                    <summary className="cursor-pointer text-[10px] font-black text-blue-500/70 hover:text-blue-400 uppercase tracking-widest transition-all outline-none flex items-center gap-2">
                      <span className="text-blue-500 group-open/data:rotate-90 transition-transform">▸</span> INTERROGATE_DATA_PAYLOAD
                    </summary>
                    <div className="mt-2 relative ml-4 mb-2">
                      <div className="absolute -left-3 top-0 bottom-0 w-[1px] bg-blue-500/30" />
                      <pre className="bg-slate-900/80 p-4 rounded-xl border border-slate-700 text-[10px] text-cyan-300 overflow-x-auto shadow-inner leading-relaxed">
                        {typeof log.data === 'object' 
                          ? JSON.stringify(log.data, null, 2) 
                          : log.data}
                      </pre>
                    </div>
                  </details>
                )}
              </div>
            </div>
          ))}
          
          {/* Live Blinking Cursor at the bottom */}
          <div className="flex gap-4 py-2 px-2">
            <div className="flex-shrink-0 text-slate-600 select-none w-20">...</div>
            <div className="text-gold-500 animate-pulse w-44 font-black">█</div>
          </div>
          
          <div ref={endOfLogsRef} className="h-4" />
        </div>

        {/* 3. TERMINAL FOOTER STATS */}
        <div className="mt-4 pt-4 border-t border-slate-800 flex justify-between items-center text-[9px] font-black text-slate-500 uppercase tracking-[0.2em] relative z-30">
          <div>Buffer Size: <span className="text-white">{logs.length} Operations</span> recorded</div>
          <div className="flex gap-6">
            <span className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-fuchsia-400 shadow-[0_0_5px_#e879f9]" /> Neural Net
            </span>
            <span className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 shadow-[0_0_5px_#22d3ee]" /> Logic Core
            </span>
            <span className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shadow-[0_0_5px_#34d399]" /> Fin Engine
            </span>
          </div>
        </div>
      </div>

      <style>{`
        .scrollbar-hide::-webkit-scrollbar { display: none; }
      `}</style>
    </div>
  );
};