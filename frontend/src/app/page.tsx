'use client';
import { useState, useEffect } from 'react';

export default function Dashboard() {
  const [events, setEvents] = useState([
    { id: 'EVT-001', type: 'SYSTEM_START', time: new Date().toLocaleTimeString(), threat: 'NONE' }
  ]);
  const [nightVision, setNightVision] = useState(false);
  const [audioMuted, setAudioMuted] = useState(true);

  // Simulated event stream for the UI scaffolding
  useEffect(() => {
    const interval = setInterval(() => {
      if (Math.random() > 0.8) {
        setEvents(prev => [{
          id: `EVT-${Math.floor(Math.random() * 1000).toString().padStart(3, '0')}`,
          type: Math.random() > 0.5 ? 'PERSON_BREACH' : 'VEHICLE_BREACH',
          time: new Date().toLocaleTimeString(),
          threat: 'CRITICAL'
        }, ...prev].slice(0, 50));
      }
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="p-4 md:p-8 h-screen flex flex-col gap-6 max-w-[1600px] mx-auto">
      {/* Header */}
      <header className="flex justify-between items-center pb-4 border-b border-slate-700">
        <div>
          <h1 className="text-2xl font-bold tracking-tight uppercase">Project Satark</h1>
          <p className="text-sm text-slate-400 font-mono mt-1">SIH26187 | COMMAND CENTER</p>
        </div>
        
        {/* Controls */}
        <div className="flex gap-4">
          <button 
            onClick={() => setNightVision(!nightVision)}
            className={`px-4 py-2 text-sm font-semibold rounded-sm border ${nightVision ? 'bg-green-900/30 border-green-500 text-green-400' : 'bg-slate-800 border-slate-600 text-slate-300'}`}
          >
            IR/NVG MODE: {nightVision ? 'ON' : 'OFF'}
          </button>
          <button 
            onClick={() => setAudioMuted(!audioMuted)}
            className={`px-4 py-2 text-sm font-semibold rounded-sm border ${!audioMuted ? 'bg-red-900/30 border-red-500 text-red-400' : 'bg-slate-800 border-slate-600 text-slate-300'}`}
          >
            AUDIO: {audioMuted ? 'MUTED' : 'LIVE'}
          </button>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex flex-col lg:flex-row gap-6 h-full min-h-0 overflow-hidden">
        
        {/* Left: Video Feed */}
        <div className="flex-1 flex flex-col gap-2">
          <div className="flex justify-between items-center text-xs font-mono text-slate-400 uppercase tracking-widest">
            <span>Live Feed - Sector Alpha</span>
            <span>FPS: 30 | RTX 4050 ACTIVE</span>
          </div>
          
          <div className={`relative flex-1 rounded-sm border border-slate-700 bg-black overflow-hidden flex items-center justify-center ${nightVision ? 'sepia hue-rotate-50 contrast-150' : ''}`}>
             {/* Placeholder for the actual MJPEG stream */}
             <div className="absolute inset-0 flex items-center justify-center opacity-50">
               <div className="text-center font-mono">
                 <div className="animate-pulse w-16 h-16 border-2 border-slate-600 rounded-full border-t-blue-500 mx-auto mb-4"></div>
                 <p className="text-slate-500">AWAITING VIDEO STREAM...</p>
                 <p className="text-slate-600 text-xs mt-2">Connecting to Backend WebSocket</p>
               </div>
             </div>
             
             {/* Simulated Tripwire overlay */}
             <svg className="absolute inset-0 w-full h-full pointer-events-none opacity-40">
               <polygon points="100,500 800,500 900,600 50,600" fill="none" stroke="#f59e0b" strokeWidth="2" strokeDasharray="10,5" />
             </svg>
          </div>
        </div>

        {/* Right: Event Ticker */}
        <div className="w-full lg:w-96 flex flex-col gap-2">
           <div className="flex justify-between items-center text-xs font-mono text-slate-400 uppercase tracking-widest">
            <span>Threat Intelligence Log</span>
            <span>LIVE</span>
          </div>
          
          <div className="flex-1 bg-slate-900 border border-slate-700 rounded-sm overflow-y-auto">
            <div className="p-4 flex flex-col gap-3">
              {events.map((evt, idx) => (
                <div key={idx} className={`p-3 rounded-sm border font-mono text-xs ${evt.threat === 'CRITICAL' ? 'border-red-900/50 bg-red-950/20' : 'border-slate-800 bg-slate-800/50'}`}>
                  <div className="flex justify-between mb-1">
                    <span className="text-slate-500">{evt.time}</span>
                    <span className="text-slate-400">{evt.id}</span>
                  </div>
                  <div className={`font-bold ${evt.threat === 'CRITICAL' ? 'text-red-400' : 'text-slate-300'}`}>
                    [{evt.threat}] {evt.type}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
