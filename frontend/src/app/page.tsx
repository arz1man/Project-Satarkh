'use client';
import { useState, useEffect, useRef } from 'react';
import { MonitorPlay, PenTool, Cctv, BellRing, ChartColumn, ShieldAlert, Eye, Timer } from 'lucide-react';

export default function Dashboard() {
  const [events, setEvents] = useState([
    { id: 'SYS', type: 'SYSTEM_START', time: new Date().toLocaleTimeString(), threat: 'NONE', label: 'System initialized' }
  ]);
  const [nightVision, setNightVision] = useState(false);
  const [tripwireActive, setTripwireActive] = useState(false);

  // WebSocket for real events
  useEffect(() => {
    const ws = new WebSocket('ws://localhost:8000/ws/events');
    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      setEvents(prev => [{
        id: data.id.toString(),
        type: data.type,
        time: new Date(data.timestamp * 1000).toLocaleTimeString(),
        threat: data.type.includes('BREACH') ? 'CRITICAL' : 'WARNING',
        label: `Obj #${data.id} ${data.plate ? '| Plate: '+data.plate : ''} ${data.face ? '| Face: '+data.face : ''}`
      }, ...prev].slice(0, 50));
    };
    return () => ws.close();
  }, []);

  const toggleNightVision = async () => {
    const newVal = !nightVision;
    setNightVision(newVal);
    await fetch(`http://localhost:8000/api/nightvision?enabled=${newVal}`, { method: 'POST' });
  };

  const toggleTripwire = async () => {
    const newVal = !tripwireActive;
    setTripwireActive(newVal);
    // Simple line across the middle of the screen (assuming 640x480 standard webcam size for now)
    const points = newVal ? [[100, 240], [540, 240]] : [];
    
    await fetch(`http://localhost:8000/api/tripwire`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ points })
    });
  };

  return (
    <div className="flex min-h-screen bg-slate-950 text-slate-200">
      
      {/* Sidebar */}
      <aside className="w-64 flex flex-col border-r border-slate-800 bg-slate-900/50 shrink-0">
        <div className="flex items-center gap-3 p-6 border-b border-slate-800">
          <div className="flex size-8 items-center justify-center rounded bg-blue-600 font-bold text-white">S</div>
          <span className="font-semibold tracking-tight text-white uppercase">Project Satark</span>
        </div>
        <nav className="flex-1 space-y-1 p-4">
          <a className="flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium bg-blue-500/10 text-blue-400">
            <MonitorPlay size={18} /> Live Monitor
          </a>
          <a className="flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-slate-400 hover:text-slate-200 cursor-pointer">
            <PenTool size={18} /> Boundary Config
          </a>
          <a className="flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-slate-400 hover:text-slate-200 cursor-pointer">
            <Cctv size={18} /> Cameras
          </a>
          <a className="flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-slate-400 hover:text-slate-200 cursor-pointer">
            <BellRing size={18} /> Alerts Archive
          </a>
          <a className="flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-slate-400 hover:text-slate-200 cursor-pointer">
            <ChartColumn size={18} /> Analytics
          </a>
        </nav>
        <div className="p-4 border-t border-slate-800">
          <div className="flex items-center gap-3 rounded bg-slate-800/50 p-3">
            <div className="size-2 rounded-full bg-green-500 animate-pulse"></div>
            <div>
              <div className="font-mono text-[10px] uppercase tracking-wider">System Online</div>
              <div className="font-mono text-[9px] text-slate-500">Edge node · RTX 4050 Active</div>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0">
        
        {/* Header */}
        <header className="h-16 flex items-center justify-between border-b border-slate-800 px-8 bg-slate-900/30 shrink-0">
          <div className="flex items-center gap-4 text-sm text-slate-400">
            <span>Active Feeds: 1</span>
            <span>Storage: 84%</span>
          </div>
          <div className="flex items-center gap-4">
            <button onClick={toggleTripwire} className={`px-4 py-1.5 text-xs font-semibold rounded transition-colors ${tripwireActive ? 'bg-orange-600 hover:bg-orange-700 text-white' : 'bg-slate-700 hover:bg-slate-600 text-white'}`}>
              {tripwireActive ? 'DISABLE TRIPWIRE' : 'ENABLE TRIPWIRE'}
            </button>
            <button onClick={toggleNightVision} className={`px-4 py-1.5 text-xs font-semibold rounded transition-colors ${nightVision ? 'bg-green-700 hover:bg-green-600 text-white' : 'bg-slate-700 hover:bg-slate-600 text-white'}`}>
              IR/NVG: {nightVision ? 'ON' : 'OFF'}
            </button>
          </div>
        </header>

        {/* Dashboard Grid */}
        <div className="flex-1 p-6 flex gap-6 overflow-hidden">
          
          {/* Video Section */}
          <div className="flex-1 flex flex-col gap-4 min-w-0">
            {/* Main Feed */}
            <div className="flex-1 relative rounded-xl border border-slate-700 bg-black overflow-hidden flex items-center justify-center">
              <img 
                src="http://localhost:8000/video_feed" 
                className="absolute inset-0 w-full h-full object-contain"
                alt="Main Camera Feed"
              />
              <div className="absolute left-3 top-3 flex items-center gap-2">
                <span className="rounded bg-black/60 px-2 py-1 font-mono text-[10px] text-white">CAM_01 // BORDER_PRIMARY</span>
              </div>
              <div className="absolute right-3 top-3 flex items-center gap-2 font-mono text-[10px] text-slate-300">
                <span className="flex items-center gap-1 text-red-500"><span className="size-1.5 rounded-full bg-red-500 animate-pulse"></span>REC</span>
              </div>
            </div>

            {/* Bottom Grid (Placeholders for multi-cam) */}
            <div className="h-44 grid grid-cols-3 gap-4 shrink-0">
              {[2, 3, 4].map(num => (
                <div key={num} className="relative rounded-xl border border-slate-800 bg-slate-900 overflow-hidden flex items-center justify-center">
                   <div className="text-slate-600 font-mono text-xs text-center">
                     <Cctv size={24} className="mx-auto mb-2 opacity-50" />
                     CAM_0{num} OFFLINE
                   </div>
                   <div className="absolute left-2 top-2 rounded bg-black/60 px-1.5 py-0.5 font-mono text-[8px] text-white">CAM_0{num}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Event Log Right Sidebar */}
          <div className="w-80 flex flex-col border border-slate-800 rounded-xl bg-slate-900 shrink-0 overflow-hidden">
            <div className="flex items-center justify-between border-b border-slate-800 p-4 shrink-0">
              <h2 className="text-xs font-semibold uppercase tracking-wider text-white">Event Log</h2>
              <span className="flex items-center gap-1.5 font-mono text-[10px] text-blue-400">
                <span className="size-1.5 rounded-full bg-blue-500 animate-pulse"></span>LIVE RECAP
              </span>
            </div>
            
            <div className="flex-1 overflow-y-auto p-4 space-y-3 scrollbar-thin scrollbar-thumb-slate-700">
              {events.map((evt, idx) => (
                <div key={idx} className={`border-l-2 py-2 pl-3 ${evt.threat === 'CRITICAL' ? 'border-red-500 bg-red-500/10' : 'border-orange-500 bg-orange-500/10'}`}>
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <span className={`flex items-center gap-1.5 font-mono text-[10px] ${evt.threat === 'CRITICAL' ? 'text-red-400' : 'text-orange-400'}`}>
                      <ShieldAlert size={12} /> {evt.time}
                    </span>
                    <span className={`rounded px-1 text-[9px] font-bold uppercase ${evt.threat === 'CRITICAL' ? 'bg-red-500 text-white' : 'bg-orange-500/20 text-orange-400'}`}>
                      {evt.threat}
                    </span>
                  </div>
                  <p className="text-xs text-white leading-tight">{evt.type}</p>
                  <p className="mt-1 font-mono text-[10px] text-slate-500">{evt.label}</p>
                </div>
              ))}
            </div>
          </div>

        </div>
      </main>
    </div>
  );
}
