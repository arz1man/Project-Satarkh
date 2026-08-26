'use client';
import { useState, useEffect, useRef } from 'react';
import { MonitorPlay, PenTool, Cctv, BellRing, ChartColumn, ShieldAlert, X, Check, RotateCcw, Download, Lock, UserPlus, Trash2 } from 'lucide-react';

export default function Dashboard() {
  const [events, setEvents] = useState([
    { id: 'SYS', type: 'SYSTEM_START', time: 'INITIALIZING', threat: 'NONE', label: 'System initialized' }
  ]);
  const [nightVision, setNightVision] = useState(false);
  const [audioMuted, setAudioMuted] = useState(false);
  
  // Navigation State
  const [activeTab, setActiveTab] = useState('monitor'); // 'monitor' | 'boundary' | 'analytics' | 'access'
  
  // Source State
  const [videoSource, setVideoSource] = useState('0');
  
  // Access Control State
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [passcode, setPasscode] = useState('');
  const [faces, setFaces] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // SOS State
  const [isBreaching, setIsBreaching] = useState(false);
  
  // Boundary Drawing State
  const defaultZone = [
    { x: 150, y: 250 },
    { x: 490, y: 250 },
    { x: 580, y: 420 },
    { x: 60, y: 420 }
  ];
  const [drawPoints, setDrawPoints] = useState<{x: number, y: number}[]>(defaultZone);
  const [draggingIdx, setDraggingIdx] = useState<number | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const breachTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Play Tactical Beep using Web Audio API
  const playAlarm = () => {
    if (audioMuted) return;
    try {
      const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
      const ctx = new AudioContext();
      const osc = ctx.createOscillator();
      const gainNode = ctx.createGain();
      osc.type = 'square';
      osc.frequency.setValueAtTime(880, ctx.currentTime);
      osc.frequency.setValueAtTime(1108.73, ctx.currentTime + 0.1);
      osc.connect(gainNode);
      gainNode.connect(ctx.destination);
      osc.start();
      gainNode.gain.exponentialRampToValueAtTime(0.00001, ctx.currentTime + 0.5);
      osc.stop(ctx.currentTime + 0.5);
    } catch(e) {}
  };

  // WebSocket for real events
  useEffect(() => {
    const ws = new WebSocket('ws://localhost:8000/ws/events');
    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      const isCritical = data.type.includes('BREACH');
      
      setEvents(prev => [{
        id: data.id.toString(),
        type: data.type,
        time: new Date(data.timestamp * 1000).toLocaleTimeString(),
        threat: isCritical ? 'CRITICAL' : 'WARNING',
        label: `Obj #${data.id} ${data.plate ? '| Plate: '+data.plate : ''} ${data.face ? '| Face: '+data.face : ''}`
      }, ...prev].slice(0, 100));

      if (isCritical) {
        setIsBreaching(true);
        playAlarm();
        if (breachTimeoutRef.current) clearTimeout(breachTimeoutRef.current);
        breachTimeoutRef.current = setTimeout(() => {
          setIsBreaching(false);
        }, 2000);
      }
    };
    return () => ws.close();
  }, [audioMuted]);

  // Fetch faces when authenticated
  useEffect(() => {
    if (isAuthenticated) fetchFaces();
  }, [isAuthenticated]);

  const toggleNightVision = async () => {
    const newVal = !nightVision;
    setNightVision(newVal);
    await fetch(`http://localhost:8000/api/nightvision?enabled=${newVal}`, { method: 'POST' });
  };

  const changeSource = async () => {
    await fetch(`http://localhost:8000/api/source`, { 
      method: 'POST', 
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ source: videoSource }) 
    });
  };

  // --- DRAGGING LOGIC ---
  const getMousePos = (e: React.MouseEvent | React.TouchEvent) => {
    if (!svgRef.current) return { x: 0, y: 0 };
    const rect = svgRef.current.getBoundingClientRect();
    const clientX = 'touches' in e ? e.touches[0].clientX : (e as React.MouseEvent).clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : (e as React.MouseEvent).clientY;
    
    const scaleX = 640 / rect.width;
    const scaleY = 480 / rect.height;
    return {
      x: Math.round((clientX - rect.left) * scaleX),
      y: Math.round((clientY - rect.top) * scaleY)
    };
  };

  const handlePointerDown = (idx: number, e: React.MouseEvent | React.TouchEvent) => {
    e.stopPropagation();
    setDraggingIdx(idx);
  };

  const handlePointerMove = (e: React.MouseEvent | React.TouchEvent) => {
    if (draggingIdx === null) return;
    const { x, y } = getMousePos(e);
    setDrawPoints(prev => {
      const newPoints = [...prev];
      newPoints[draggingIdx] = { x, y };
      return newPoints;
    });
  };

  const handlePointerUp = () => {
    setDraggingIdx(null);
  };

  const saveBoundary = async () => {
    const points = drawPoints.map(p => [p.x, p.y]);
    await fetch(`http://localhost:8000/api/tripwire`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ points })
    });
    setActiveTab('monitor');
  };

  const resetBoundary = () => {
    setDrawPoints(defaultZone);
  };

  const clearBoundary = async () => {
    setDrawPoints([]);
    await fetch(`http://localhost:8000/api/tripwire`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ points: [] })
    });
  };

  const exportLogs = () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(events, null, 2));
    const downloadAnchorNode = document.createElement('a');
    downloadAnchorNode.setAttribute("href", dataStr);
    downloadAnchorNode.setAttribute("download", "satark_logs.json");
    document.body.appendChild(downloadAnchorNode);
    downloadAnchorNode.click();
    downloadAnchorNode.remove();
  };

  // --- ACCESS CONTROL METHODS ---
  const handleAuth = (e: React.FormEvent) => {
    e.preventDefault();
    if (passcode === '1234') {
      setIsAuthenticated(true);
    } else {
      alert("INVALID PASSCODE");
      setPasscode('');
    }
  };

  const fetchFaces = async () => {
    try {
      const res = await fetch(`http://localhost:8000/api/faces`);
      const data = await res.json();
      setFaces(data.faces || []);
    } catch (err) {
      console.error("Failed to fetch faces", err);
      setFaces([]);
    }
  };

  const handleFaceUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    const file = e.target.files[0];
    const formData = new FormData();
    formData.append('file', file);
    await fetch(`http://localhost:8000/api/faces`, {
      method: 'POST',
      body: formData
    });
    fetchFaces();
  };

  const deleteFace = async (filename: string) => {
    await fetch(`http://localhost:8000/api/faces/${filename}`, { method: 'DELETE' });
    fetchFaces();
  };

  return (
    <div className="flex min-h-screen bg-slate-950 text-slate-200">
      
      {/* Sidebar */}
      <aside className="w-64 flex flex-col border-r border-slate-800 bg-slate-900/50 shrink-0 select-none">
        <div className="flex items-center gap-3 p-6 border-b border-slate-800">
          <div className="flex size-8 items-center justify-center rounded bg-blue-600 font-bold text-white">S</div>
          <span className="font-semibold tracking-tight text-white uppercase">Project Satark</span>
        </div>
        <nav className="flex-1 space-y-1 p-4">
          <a 
            onClick={() => setActiveTab('monitor')}
            className={`flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium cursor-pointer ${activeTab === 'monitor' ? 'bg-blue-500/10 text-blue-400' : 'text-slate-400 hover:text-slate-200'}`}
          >
            <MonitorPlay size={18} /> Live Monitor
          </a>
          <a 
            onClick={() => setActiveTab('boundary')}
            className={`flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium cursor-pointer ${activeTab === 'boundary' ? 'bg-orange-500/10 text-orange-400' : 'text-slate-400 hover:text-slate-200'}`}
          >
            <PenTool size={18} /> Boundary Config
          </a>
          <a 
            onClick={() => setActiveTab('analytics')}
            className={`flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium cursor-pointer ${activeTab === 'analytics' ? 'bg-purple-500/10 text-purple-400' : 'text-slate-400 hover:text-slate-200'}`}
          >
            <ChartColumn size={18} /> Analytics
          </a>
          <a 
            onClick={() => setActiveTab('access')}
            className={`flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium cursor-pointer ${activeTab === 'access' ? 'bg-green-500/10 text-green-400' : 'text-slate-400 hover:text-slate-200'}`}
          >
            <Lock size={18} /> Access Control
          </a>
          <a className="flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-slate-400 cursor-not-allowed opacity-50">
            <Cctv size={18} /> Cameras
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
            {activeTab === 'boundary' ? (
              <span className="text-orange-400 font-mono font-bold animate-pulse">BOUNDARY EDIT MODE ACTIVE - DRAG CORNERS TO EDIT ZONE</span>
            ) : activeTab === 'analytics' ? (
              <span className="text-purple-400 font-mono font-bold">SYSTEM ANALYTICS & INTELLIGENCE</span>
            ) : activeTab === 'access' ? (
              <span className="text-green-400 font-mono font-bold">SECURE DATABASE MANAGEMENT</span>
            ) : (
              <div className="flex items-center gap-2">
                <span className="font-mono text-xs">SOURCE:</span>
                <input 
                  type="text" 
                  value={videoSource}
                  onChange={e => setVideoSource(e.target.value)}
                  placeholder="0 or path/to/video.mp4"
                  className="bg-slate-800 border border-slate-700 rounded px-2 py-1 text-xs text-white w-48 focus:outline-none"
                />
                <button onClick={changeSource} className="px-2 py-1 text-xs font-semibold rounded bg-blue-900/50 hover:bg-blue-900 text-blue-200 border border-blue-800">
                  CONNECT
                </button>
              </div>
            )}
          </div>
          <div className="flex items-center gap-4">
            <button onClick={() => setAudioMuted(!audioMuted)} className={`px-4 py-1.5 text-xs font-semibold rounded transition-colors ${!audioMuted ? 'bg-red-900/30 border-red-500 text-red-400 border' : 'bg-slate-800 text-slate-400'}`}>
              AUDIO: {!audioMuted ? 'LIVE' : 'MUTED'}
            </button>
            {activeTab === 'boundary' && (
              <>
                <button onClick={resetBoundary} className="px-3 py-1.5 flex items-center gap-2 text-xs font-semibold rounded bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700">
                  <RotateCcw size={14} /> DEFAULT 3D ZONE
                </button>
                <button onClick={clearBoundary} className="px-3 py-1.5 flex items-center gap-2 text-xs font-semibold rounded bg-red-900/50 hover:bg-red-900 text-red-200 border border-red-800">
                  <X size={14} /> CLEAR
                </button>
                <button onClick={saveBoundary} className="px-3 py-1.5 flex items-center gap-2 text-xs font-semibold rounded bg-green-900/50 hover:bg-green-900 text-green-200 border border-green-800">
                  <Check size={14} /> SAVE ZONE
                </button>
              </>
            )}
            <button onClick={toggleNightVision} className={`px-4 py-1.5 text-xs font-semibold rounded transition-colors ${nightVision ? 'bg-green-700 hover:bg-green-600 text-white' : 'bg-slate-700 hover:bg-slate-600 text-white'}`}>
              IR/NVG: {nightVision ? 'ON' : 'OFF'}
            </button>
          </div>
        </header>

        {/* Dashboard Content */}
        <div className="flex-1 p-6 flex gap-6 overflow-hidden">
          
          {/* Main Area based on Tab */}
          {activeTab === 'access' ? (
            <div className="flex-1 flex flex-col items-center justify-center">
              {!isAuthenticated ? (
                <div className="bg-slate-900 border border-slate-800 p-8 rounded-xl flex flex-col items-center gap-4">
                  <Lock size={48} className="text-slate-500 mb-4" />
                  <h2 className="text-xl font-bold font-mono text-white">SECURE DATABASE ACCESS</h2>
                  <p className="text-sm text-slate-400 mb-4">Enter passcode to view registered personnel</p>
                  <form onSubmit={handleAuth} className="flex gap-2">
                    <input 
                      type="password" 
                      value={passcode}
                      onChange={e => setPasscode(e.target.value)}
                      className="bg-slate-950 border border-slate-700 rounded px-4 py-2 text-center tracking-[0.5em] font-mono focus:outline-none focus:border-blue-500"
                      placeholder="****"
                      autoFocus
                    />
                    <button type="submit" className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded font-bold">
                      VERIFY
                    </button>
                  </form>
                </div>
              ) : (
                <div className="w-full max-w-4xl h-full flex flex-col gap-6">
                  <div className="flex items-center justify-between bg-slate-900 border border-slate-800 p-6 rounded-xl">
                    <div>
                      <h2 className="text-xl font-bold font-mono text-white">REGISTERED PERSONNEL</h2>
                      <p className="text-sm text-slate-400">Manage faces for DeepFace recognition</p>
                    </div>
                    <input 
                      type="file" 
                      accept="image/*" 
                      className="hidden" 
                      ref={fileInputRef}
                      onChange={handleFaceUpload}
                    />
                    <button onClick={() => fileInputRef.current?.click()} className="flex items-center gap-2 bg-green-600 hover:bg-green-500 text-white px-4 py-2 rounded font-bold text-sm">
                      <UserPlus size={16} /> ADD PERSON
                    </button>
                  </div>
                  
                  <div className="flex-1 bg-slate-900 border border-slate-800 rounded-xl p-6 overflow-y-auto">
                    {faces.length === 0 ? (
                      <div className="h-full flex flex-col items-center justify-center text-slate-500 font-mono text-sm">
                        NO PERSONNEL REGISTERED
                      </div>
                    ) : (
                      <div className="grid grid-cols-4 gap-4">
                        {faces.map((f, i) => (
                          <div key={i} className="border border-slate-800 rounded-lg p-4 flex flex-col items-center justify-between gap-4 bg-slate-950">
                            <div className="size-20 rounded-full bg-slate-800 flex items-center justify-center overflow-hidden">
                              <span className="text-slate-500 font-bold">{f.charAt(0).toUpperCase()}</span>
                            </div>
                            <span className="text-xs font-mono text-slate-300 truncate w-full text-center">{f}</span>
                            <button onClick={() => deleteFace(f)} className="flex items-center gap-1 text-red-500 hover:text-red-400 text-xs mt-2">
                              <Trash2 size={12} /> REMOVE
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          ) : activeTab === 'analytics' ? (
            <div className="flex-1 flex flex-col gap-6 overflow-y-auto">
              <div className="grid grid-cols-3 gap-6">
                <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
                  <h3 className="text-slate-400 text-xs font-mono mb-2">TOTAL INCIDENTS TODAY</h3>
                  <p className="text-4xl font-bold text-white">{events.length}</p>
                </div>
                <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
                  <h3 className="text-slate-400 text-xs font-mono mb-2">CRITICAL BREACHES</h3>
                  <p className="text-4xl font-bold text-red-500">{events.filter(e => e.threat === 'CRITICAL').length}</p>
                </div>
                <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
                  <h3 className="text-slate-400 text-xs font-mono mb-2">SYSTEM UPTIME</h3>
                  <p className="text-4xl font-bold text-green-500">99.9%</p>
                </div>
              </div>
              
              <div className="flex-1 bg-slate-900 border border-slate-800 rounded-xl p-6 flex flex-col">
                <h3 className="text-slate-400 text-xs font-mono mb-6">HOURLY THREAT DISTRIBUTION</h3>
                <div className="flex-1 flex items-end gap-2">
                  {/* Dummy bar chart */}
                  {[12, 45, 23, 67, 10, 8, 90, 34, 12, 5].map((val, i) => (
                    <div key={i} className="flex-1 bg-blue-500/20 hover:bg-blue-500/40 rounded-t-sm relative group" style={{ height: `${val}%` }}>
                       <div className="absolute -top-6 left-1/2 -translate-x-1/2 text-xs font-mono opacity-0 group-hover:opacity-100">{val}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="flex-1 flex flex-col gap-4 min-w-0">
              {/* Main Feed */}
              <div className={`flex-1 relative rounded-xl border-2 overflow-hidden flex items-center justify-center bg-black select-none ${activeTab === 'boundary' ? 'border-orange-500 shadow-[0_0_15px_rgba(249,115,22,0.3)]' : isBreaching ? 'border-red-600 shadow-[0_0_30px_rgba(220,38,38,0.6)]' : 'border-slate-700'}`}>
                
                {/* SOS FLASH OVERLAY */}
                {isBreaching && (
                  <div className="absolute inset-0 bg-red-600/30 animate-pulse pointer-events-none z-10 flex items-center justify-center">
                    <div className="bg-black/80 px-8 py-4 rounded-lg border-2 border-red-600">
                      <h1 className="text-5xl font-black text-red-500 tracking-widest animate-bounce">SOS / BREACH DETECTED</h1>
                    </div>
                  </div>
                )}

                <img 
                  src="http://localhost:8000/video_feed" 
                  draggable={false}
                  className="absolute inset-0 w-full h-full object-contain pointer-events-none select-none"
                  alt="Main Camera Feed"
                />
                
                {/* Boundary Drawing Overlay */}
                {activeTab === 'boundary' && (
                  <svg 
                    ref={svgRef}
                    className="absolute inset-0 w-full h-full cursor-crosshair touch-none z-20" 
                    viewBox="0 0 640 480" 
                    preserveAspectRatio="xMidYMid meet"
                    onMouseMove={handlePointerMove}
                    onMouseUp={handlePointerUp}
                    onMouseLeave={handlePointerUp}
                    onTouchMove={handlePointerMove}
                    onTouchEnd={handlePointerUp}
                  >
                    {drawPoints.length > 2 && (
                      <polygon 
                        points={drawPoints.map(p => `${p.x},${p.y}`).join(' ')} 
                        fill="rgba(249, 115, 22, 0.15)" 
                        stroke="#f97316" 
                        strokeWidth="2" 
                        strokeDasharray="8 4"
                      />
                    )}
                    {drawPoints.map((p, i) => (
                      <g key={i}>
                        <circle 
                          cx={p.x} cy={p.y} r="20" 
                          fill="transparent"
                          className="cursor-grab active:cursor-grabbing"
                          onMouseDown={(e) => handlePointerDown(i, e)}
                          onTouchStart={(e) => handlePointerDown(i, e)}
                        />
                        <circle 
                          cx={p.x} cy={p.y} r="6" 
                          fill={draggingIdx === i ? "#fff" : "#f97316"} 
                          stroke="#fff" strokeWidth="2"
                          className="pointer-events-none"
                        />
                      </g>
                    ))}
                  </svg>
                )}

                <div className="absolute left-3 top-3 flex items-center gap-2 pointer-events-none z-20">
                  <span className="rounded bg-black/60 px-2 py-1 font-mono text-[10px] text-white">CAM_01 // BORDER_PRIMARY</span>
                </div>
                <div className="absolute right-3 top-3 flex items-center gap-2 font-mono text-[10px] text-slate-300 pointer-events-none z-20">
                  <span className="flex items-center gap-1 text-red-500"><span className="size-1.5 rounded-full bg-red-500 animate-pulse"></span>REC</span>
                </div>
              </div>

              {/* Bottom Grid */}
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
          )}

          {/* Event Log Right Sidebar */}
          <div className="w-80 flex flex-col border border-slate-800 rounded-xl bg-slate-900 shrink-0 overflow-hidden">
            <div className="flex items-center justify-between border-b border-slate-800 p-4 shrink-0">
              <h2 className="text-xs font-semibold uppercase tracking-wider text-white">Event Log</h2>
              <div className="flex items-center gap-3">
                <button onClick={exportLogs} className="text-slate-400 hover:text-white" title="Export Logs">
                  <Download size={14} />
                </button>
                <span className="flex items-center gap-1.5 font-mono text-[10px] text-blue-400">
                  <span className="size-1.5 rounded-full bg-blue-500 animate-pulse"></span>LIVE
                </span>
              </div>
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
