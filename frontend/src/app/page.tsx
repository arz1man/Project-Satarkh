'use client';
import { useState, useEffect, useRef } from 'react';
import { ShieldAlert, Crosshair, Users, Activity, Settings, Video, FileVideo, Save, RotateCcw, Trash2, Shield, Lock, Unlock, AlertTriangle, Target, ScanEye } from 'lucide-react';

export default function Home() {
  const svgRef = useRef<SVGSVGElement>(null);
  const videoFileRef = useRef<HTMLInputElement>(null);
  const faceFileRef = useRef<HTMLInputElement>(null);

  const [currentTime, setCurrentTime] = useState('');
  const [videoSource, setVideoSource] = useState('file');
  const [nightVision, setNightVision] = useState(false);
  
  // Security / Lock
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [passcode, setPasscode] = useState('');
  
  // Display Toggles
  const [bwFilter, setBwFilter] = useState(false);
  
  // Advanced Modules (SentinelAI visual toggles)
  const [modules, setModules] = useState({
    weapon: false,
    anomaly: false,
    face: true,
    alpr: true
  });

  // Tripwire State
  const [boundaryMode, setBoundaryMode] = useState(false);
  // Default to a perspective-friendly shape
  const defaultZone = [
    { x: 300, y: 650 },
    { x: 980, y: 650 },
    { x: 700, y: 400 },
    { x: 400, y: 400 }
  ];
  const [drawPoints, setDrawPoints] = useState<{x: number, y: number}[]>([]);
  const [draggingIdx, setDraggingIdx] = useState<number | null>(null);

  const [events, setEvents] = useState<any[]>([]);
  const [isBreaching, setIsBreaching] = useState(false);
  const [sosActive, setSosActive] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const [faces, setFaces] = useState<string[]>([]);

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date().toISOString().replace('T', ' ').substring(0, 19));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    fetchFaces();
    const saved = localStorage.getItem('satark_zone');
    if (saved) {
      const parsed = JSON.parse(saved);
      setDrawPoints(parsed);
      fetch(`http://localhost:8000/api/tripwire`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ points: parsed.map((p: any) => [p.x, p.y]) })
      }).catch(() => console.warn("Backend not ready"));
    } else {
      setDrawPoints(defaultZone);
      fetch(`http://localhost:8000/api/tripwire`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ points: defaultZone.map(p => [p.x, p.y]) })
      }).catch(() => console.warn("Backend not ready"));
    }

    const connectWS = () => {
      const ws = new WebSocket('ws://localhost:8000/ws/events');
      ws.onmessage = (event) => {
        const data = JSON.parse(event.data);
        
        const isCritical = data.type === 'PERSON_BREACH' || data.type === 'VEHICLE_BREACH' || data.type === 'WEAPON_DETECTED' || data.type === 'VIOLENCE_ANOMALY';
        
        if (data.type === 'SOS_TRIGGERED' || isCritical) {
          setSosActive(true);
          setTimeout(() => setSosActive(false), 5000); // 5 sec SOS mode
        }
        
        if (isCritical) {
          setIsBreaching(true);
          setTimeout(() => setIsBreaching(false), 2000);
        }
        
        setEvents(prev => [data, ...prev].slice(0, 50));
      };
      ws.onclose = () => setTimeout(connectWS, 2000);
      wsRef.current = ws;
    };
    connectWS();
    return () => wsRef.current?.close();
  }, []);

  const changeSource = async (src: string, mode: string) => {
    setVideoSource(mode);
    try {
      await fetch(`http://localhost:8000/api/source`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ source: src })
      });
    } catch (e) {}
  };

  const handleVideoFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    const formData = new FormData();
    formData.append('file', e.target.files[0]);
    try {
      const res = await fetch(`http://localhost:8000/api/upload_video`, { method: 'POST', body: formData });
      const data = await res.json();
      if (data.path) changeSource(data.path, 'file');
    } catch (err) {}
  };

  const getMousePos = (e: React.MouseEvent | React.TouchEvent) => {
    if (!svgRef.current) return { x: 0, y: 0 };
    const rect = svgRef.current.getBoundingClientRect();
    const clientX = 'touches' in e ? e.touches[0].clientX : (e as React.MouseEvent).clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : (e as React.MouseEvent).clientY;
    const scaleX = 1280 / rect.width;
    const scaleY = 720 / rect.height;
    return {
      x: Math.round((clientX - rect.left) * scaleX),
      y: Math.round((clientY - rect.top) * scaleY)
    };
  };

  const handlePointerDown = (idx: number, e: React.MouseEvent | React.TouchEvent) => {
    if (!boundaryMode) return;
    e.stopPropagation();
    setDraggingIdx(idx);
  };

  const handlePointerMove = (e: React.MouseEvent | React.TouchEvent) => {
    if (draggingIdx === null || !boundaryMode) return;
    const { x, y } = getMousePos(e);
    setDrawPoints(prev => {
      const newPoints = [...prev];
      newPoints[draggingIdx] = { x, y };
      return newPoints;
    });
  };

  const handlePointerUp = () => setDraggingIdx(null);

  const saveBoundary = async () => {
    setBoundaryMode(false);
    localStorage.setItem('satark_zone', JSON.stringify(drawPoints));
    try {
      await fetch(`http://localhost:8000/api/tripwire`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ points: drawPoints.map(p => [p.x, p.y]) })
      });
    } catch (e) {
      console.warn("Failed to save boundary to backend", e);
    }
  };

  const resetBoundary = () => {
    setDrawPoints(defaultZone);
    localStorage.removeItem('satark_zone');
  };

  const fetchFaces = async () => {
    try {
      const res = await fetch(`http://localhost:8000/api/faces`);
      const data = await res.json();
      setFaces(data.faces || []);
    } catch (err) {}
  };

  const handleFaceUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    const formData = new FormData();
    formData.append('file', e.target.files[0]);
    await fetch(`http://localhost:8000/api/faces`, { method: 'POST', body: formData });
    fetchFaces();
  };

  const deleteFace = async (filename: string) => {
    await fetch(`http://localhost:8000/api/faces/${filename}`, { method: 'DELETE' });
    fetchFaces();
  };

  const handleUnlock = (e: React.FormEvent) => {
    e.preventDefault();
    if (passcode === 'ADMIN') {
      setIsUnlocked(true);
      setPasscode('');
    } else {
      alert("UNAUTHORIZED ACCESS DENIED");
      setPasscode('');
    }
  };

  return (
    <div className={`flex flex-col h-screen bg-black text-red-500 font-mono overflow-hidden selection:bg-red-500/30 ${sosActive ? 'animate-pulse bg-red-950 shadow-[inset_0_0_150px_rgba(255,0,0,0.8)]' : ''}`}>
      
      {/* HUD Header */}
      <header className="h-12 border-b border-red-900/50 flex items-center justify-between px-6 shrink-0 relative">
        <div className="absolute top-0 left-0 w-2 h-2 border-l border-t border-red-500"></div>
        <div className="absolute top-0 right-0 w-2 h-2 border-r border-t border-red-500"></div>
        
        <div className="flex items-center gap-6">
          <h1 className="font-bold tracking-widest text-red-500 text-lg shadow-red-500/50 drop-shadow-md">
            PROJECT SATARKH
          </h1>
          <div className="text-[10px] tracking-widest uppercase border border-red-900/50 px-2 py-0.5 rounded-sm">
            v9.4.01
          </div>
        </div>
        
        <div className="flex items-center gap-6">
          <button 
            onClick={() => {
              fetch('http://localhost:8000/api/sos', { method: 'POST' }).catch(()=>{});
              alert("SOS DEPLOYED TO LOCAL AUTHORITIES!");
            }} 
            className="px-4 py-0.5 bg-red-900 text-black text-[12px] tracking-widest font-bold animate-pulse hover:bg-red-500 border border-red-500 shadow-[0_0_10px_red]"
          >
            TRIGGER SOS
          </button>
          <div className="flex items-center gap-2 px-3 py-0.5 bg-red-950/20 border border-red-900/50 rounded-sm">
            <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse shadow-[0_0_5px_red]"></span>
            <span className="text-[10px] text-red-400 font-bold tracking-widest">UPLINK ACTIVE</span>
          </div>
          <div className="text-[10px] text-red-500 flex items-center gap-2 font-bold tracking-widest">
            {currentTime}
          </div>
        </div>
      </header>

      {/* Main Layout */}
      <main className="flex-1 grid grid-cols-12 gap-1 p-2 overflow-hidden relative">
        
        {/* Decorative Grid Background */}
        <div className="absolute inset-0 pointer-events-none opacity-[0.03]" style={{backgroundImage: 'linear-gradient(rgba(255,0,0,1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,0,0,1) 1px, transparent 1px)', backgroundSize: '50px 50px'}}></div>

        {/* LEFT COLUMN: Controls & Security */}
        <div className="col-span-3 flex flex-col gap-1 min-h-0 z-10">
          
          <div className="border border-red-900/50 bg-black/80 flex-1 p-4 flex flex-col relative">
            <div className="absolute top-0 left-0 w-2 h-2 border-l border-t border-red-500"></div>
            
            <h2 className="text-[10px] tracking-widest uppercase border-b border-red-900/50 pb-2 mb-4 text-red-400">
              System Control & Access
            </h2>
            
            {!isUnlocked ? (
              <div className="flex-1 flex flex-col items-center justify-center">
                <Lock className="w-12 h-12 text-red-900 mb-4" />
                <p className="text-[10px] text-red-500 mb-4 text-center">ACCESS RESTRICTED<br/>AUTHORIZATION REQUIRED</p>
                <form onSubmit={handleUnlock} className="flex flex-col gap-2 w-full max-w-[200px]">
                  <input 
                    type="password" 
                    value={passcode} 
                    onChange={e => setPasscode(e.target.value)}
                    className="bg-black border border-red-900/50 text-red-500 text-center text-xs py-1 outline-none focus:border-red-500 placeholder-red-900/50 tracking-widest"
                    placeholder="PASSCODE"
                  />
                  <button type="submit" className="border border-red-900 hover:border-red-500 text-[10px] py-1 transition-colors hover:bg-red-950/30">
                    AUTHENTICATE
                  </button>
                </form>
                <p className="text-[8px] text-red-900 mt-4">(Hint: ADMIN)</p>
              </div>
            ) : (
              <div className="flex-1 flex flex-col gap-4 overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-red-900">
                
                {/* Zone Config */}
                <div className="border border-red-900/30 p-2">
                  <h3 className="text-[9px] text-red-400 tracking-widest mb-2 flex items-center gap-1"><Crosshair className="w-3 h-3"/> 3D PERIMETER ZONE</h3>
                  {boundaryMode ? (
                    <div className="flex gap-1">
                      <button onClick={saveBoundary} className="flex-1 border border-red-500 bg-red-950/30 hover:bg-red-900 text-red-500 py-1 text-[9px] tracking-widest transition-colors">
                        LOCK ZONE
                      </button>
                      <button onClick={resetBoundary} className="px-2 border border-red-900 hover:border-red-500 text-red-500 transition-colors">
                        <RotateCcw className="w-3 h-3" />
                      </button>
                    </div>
                  ) : (
                    <button onClick={() => setBoundaryMode(true)} className="w-full border border-red-900 hover:border-red-500 text-[9px] tracking-widest py-1 transition-colors text-red-400">
                      EDIT ZONE (3D GRID)
                    </button>
                  )}
                </div>

                {/* Sentinel Modules */}
                <div className="border border-red-900/30 p-2">
                  <h3 className="text-[9px] text-red-400 tracking-widest mb-2 flex items-center gap-1"><Target className="w-3 h-3"/> THREAT MODULES</h3>
                  <div className="flex flex-col gap-1 text-[9px]">
                    <div className="flex justify-between border-b border-red-900/20 pb-1">
                      <span className="text-red-500">WEAPON DETECT</span>
                      <span className="text-red-400 shadow-red-500 drop-shadow-md">ONLINE</span>
                    </div>
                    <div className="flex justify-between border-b border-red-900/20 pb-1">
                      <span className="text-red-500">ANOMALY DETECT</span>
                      <span className="text-red-400 shadow-red-500 drop-shadow-md">ONLINE</span>
                    </div>
                    <div className="flex justify-between border-b border-red-900/20 pb-1">
                      <span className="text-red-500">FACIAL RECOGNITION</span>
                      <span className="text-red-400 shadow-red-500 drop-shadow-md">ONLINE</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-red-500">ALPR TRACKING</span>
                      <span className="text-red-400 shadow-red-500 drop-shadow-md">ONLINE</span>
                    </div>
                  </div>
                </div>

                {/* Display Config */}
                <div className="border border-red-900/30 p-2">
                  <h3 className="text-[9px] text-red-400 tracking-widest mb-2 flex items-center gap-1"><Video className="w-3 h-3"/> DISPLAY CONFIG</h3>
                  <button 
                    onClick={() => setBwFilter(!bwFilter)} 
                    className={`w-full border text-[9px] tracking-widest py-1 transition-colors ${bwFilter ? 'border-red-500 bg-red-950/30 text-red-500' : 'border-red-900 text-red-700 hover:border-red-500 hover:text-red-500'}`}
                  >
                    B&W FILTER: {bwFilter ? 'ON' : 'OFF'}
                  </button>
                </div>

                {/* Face DB */}
                <div className="border border-red-900/30 p-2 flex-1 flex flex-col min-h-0">
                  <h3 className="text-[9px] text-red-400 tracking-widest mb-2 flex items-center justify-between">
                    <span className="flex items-center gap-1"><Users className="w-3 h-3"/> FACIAL DATABASE</span>
                    <span>[{faces.length}]</span>
                  </h3>
                  <input type="file" accept="image/*" className="hidden" ref={faceFileRef} onChange={handleFaceUpload} />
                  <button onClick={() => faceFileRef.current?.click()} className="w-full border border-red-900 hover:border-red-500 text-[9px] tracking-widest py-1 transition-colors text-red-400 mb-2">
                    + REGISTER ENTITY
                  </button>
                  <div className="flex-1 overflow-y-auto space-y-1 scrollbar-thin scrollbar-thumb-red-900">
                    {faces.map((f, i) => (
                      <div key={i} className="flex items-center justify-between bg-red-950/20 border border-red-900/50 p-1 group">
                        <span className="text-[9px] text-red-300 uppercase tracking-widest">{f.split('.')[0]}</span>
                        <button onClick={() => deleteFace(f)} className="text-red-900 group-hover:text-red-500">
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
                
                <button onClick={() => setIsUnlocked(false)} className="border border-red-900 hover:border-red-500 text-red-600 text-[9px] tracking-widest py-1 flex items-center justify-center gap-1 transition-colors mt-auto">
                  <Lock className="w-3 h-3"/> LOCK SYSTEM
                </button>
              </div>
            )}
          </div>
        </div>

        {/* CENTER COLUMN: Tactical Feed (3D Isometric Vibe) */}
        <div className="col-span-6 flex flex-col min-h-0 z-10 relative">
          
          <div className="absolute -top-1 -left-1 w-4 h-4 border-l-2 border-t-2 border-red-500 pointer-events-none z-50"></div>
          <div className="absolute -top-1 -right-1 w-4 h-4 border-r-2 border-t-2 border-red-500 pointer-events-none z-50"></div>
          <div className="absolute -bottom-1 -left-1 w-4 h-4 border-l-2 border-b-2 border-red-500 pointer-events-none z-50"></div>
          <div className="absolute -bottom-1 -right-1 w-4 h-4 border-r-2 border-b-2 border-red-500 pointer-events-none z-50"></div>

          <div className={`relative flex-1 bg-black border ${isBreaching ? 'border-red-500 shadow-[0_0_30px_rgba(255,0,0,0.4)]' : 'border-red-900/30'} overflow-hidden flex items-center justify-center group`}>
            
            {/* Visual Crosshairs Center */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-8 h-8 border border-red-900/50 rounded-full pointer-events-none z-10 flex items-center justify-center">
              <div className="w-1 h-1 bg-red-500/50 rounded-full"></div>
            </div>
            
            <div className="absolute top-2 left-2 z-30 pointer-events-none text-[9px] tracking-widest">
              <div className="text-red-400">SOURCE: {videoSource === 'file' ? 'TAPE_RECORD' : 'LIVE_FEED'}</div>
              <div className="text-red-900">COORD: 39.9042° N, 116.4074° E</div>
            </div>
            
            {isBreaching && (
              <div className="absolute top-8 left-1/2 -translate-x-1/2 z-40 bg-red-600/90 text-black font-black px-8 py-1 tracking-[0.3em] border border-red-400 animate-pulse pointer-events-none shadow-[0_0_20px_red] text-sm backdrop-blur-sm">
                ANOMALY DETECTED IN SECTOR 4
              </div>
            )}
            
            {/* Aspect Video Wrapper to prevent coordinate drift */}
            <div className="relative w-full aspect-video max-h-full flex items-center justify-center">
              {/* Dark overlay for sci-fi contrast */}
              <div className="absolute inset-0 bg-red-900/10 mix-blend-color-burn pointer-events-none z-30"></div>

              <img 
                src="http://localhost:8000/video_feed" 
                className={`absolute inset-0 w-full h-full object-contain select-none opacity-80 mix-blend-screen contrast-125 ${bwFilter ? 'saturate-0' : ''} ${isBreaching ? 'sepia-[.8] hue-rotate-[-30deg] saturate-150' : 'brightness-75'}`} 
                draggable={false} 
              />

              {/* 3D Depth Perimeter Grid & SVG */}
              <div className="absolute inset-0 z-20 pointer-events-none">
                <svg 
                  ref={svgRef}
                  className={`w-full h-full ${boundaryMode ? 'cursor-crosshair pointer-events-auto' : 'pointer-events-none'}`} 
                  viewBox="0 0 1280 720" preserveAspectRatio="none"
                  onMouseMove={handlePointerMove}
                  onMouseUp={handlePointerUp}
                  onMouseLeave={handlePointerUp}
                  onTouchMove={handlePointerMove}
                  onTouchEnd={handlePointerUp}
                >
                  {/* Decorative isometric grid floor under the polygon (only visible if zone exists) */}
                  {drawPoints.length > 2 && !boundaryMode && (
                    <g opacity="0.2">
                       <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
                         <path d="M 40 0 L 0 0 0 40" fill="none" stroke="red" strokeWidth="0.5"/>
                       </pattern>
                       <rect width="1280" height="720" fill="url(#grid)" />
                    </g>
                  )}

                  {drawPoints.length > 2 && (
                    <polygon 
                      points={drawPoints.map(p => `${p.x},${p.y}`).join(' ')} 
                      fill={isBreaching ? "rgba(255, 0, 0, 0.2)" : "rgba(255, 0, 0, 0.05)"} 
                      stroke="#ff0000" 
                      strokeWidth="1.5" 
                      strokeDasharray={boundaryMode ? "5 5" : "none"}
                      className={isBreaching ? 'animate-pulse' : ''}
                    />
                  )}
                  
                  {/* Points */}
                  {boundaryMode && drawPoints.map((p, i) => (
                    <g key={i}>
                      <circle cx={p.x} cy={p.y} r="30" fill="transparent" className="cursor-grab active:cursor-grabbing pointer-events-auto" onMouseDown={(e) => handlePointerDown(i, e)} onTouchStart={(e) => handlePointerDown(i, e)} />
                      <circle cx={p.x} cy={p.y} r="4" fill={draggingIdx === i ? "#fff" : "#ff0000"} stroke="#ff0000" strokeWidth="1" className="pointer-events-none shadow-[0_0_10px_red]" />
                      <text x={p.x + 10} y={p.y - 10} fill="red" fontSize="12" fontFamily="monospace" opacity="0.6">P{i}</text>
                    </g>
                  ))}
                </svg>
              </div>
            </div>
          </div>
          
          {/* Quick HUD Data row */}
          <div className="h-12 border border-red-900/50 mt-1 bg-black flex items-center justify-between px-4 text-[9px] tracking-widest text-red-500 overflow-x-auto shrink-0 scrollbar-none">
            <div className="flex gap-4 shrink-0 mr-4">
               <span className="flex items-center gap-1"><Activity className="w-3 h-3"/> FPS: 30.1</span>
               <span className="flex items-center gap-1"><ScanEye className="w-3 h-3"/> YOLOv8n CUDA</span>
            </div>
            <div className="flex gap-2 shrink-0">
               <input type="file" accept="video/*" className="hidden" ref={videoFileRef} onChange={handleVideoFileUpload} />
               <button onClick={() => videoFileRef.current?.click()} className="border border-red-900 px-2 py-0.5 hover:bg-red-950/50 transition-colors">UPLOAD FEED</button>
               <button onClick={() => changeSource('uploaded_footage/weapon_demo.mp4', 'file')} className="border border-red-900 px-2 py-0.5 hover:bg-red-950/50 text-red-400 transition-colors">DEMO: WEAPON</button>
               <button onClick={() => changeSource('uploaded_footage/violence_demo.mp4', 'file')} className="border border-red-900 px-2 py-0.5 hover:bg-red-950/50 text-red-400 transition-colors">DEMO: VIOLENCE</button>
               <button onClick={() => changeSource('0', 'webcam')} className="border border-red-900 px-2 py-0.5 hover:bg-red-950/50 transition-colors">ACTIVATE WEBCAM</button>
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: Telemetry & Logs */}
        <div className="col-span-3 flex flex-col gap-1 min-h-0 z-10">
          
          <div className="h-48 border border-red-900/50 bg-black/80 p-3 flex flex-col relative shrink-0">
             <div className="absolute top-0 right-0 w-2 h-2 border-r border-t border-red-500"></div>
             
             <h2 className="text-[10px] tracking-widest uppercase border-b border-red-900/50 pb-1 mb-2 text-red-400">
               THREAT TELEMETRY
             </h2>
             
             {/* Circular radar mock */}
             <div className="flex-1 relative flex items-center justify-center">
                <div className="absolute w-24 h-24 border border-red-900/30 rounded-full"></div>
                <div className="absolute w-16 h-16 border border-red-500/30 rounded-full border-t-red-500 animate-spin" style={{animationDuration: '3s'}}></div>
                <div className="text-center">
                  <div className="text-2xl font-black text-red-500 drop-shadow-[0_0_5px_red] leading-none">{events.length}</div>
                  <div className="text-[8px] text-red-900 tracking-widest">TOTAL</div>
                </div>
                {/* Blips */}
                {isBreaching && <div className="absolute top-4 right-4 w-1.5 h-1.5 bg-red-500 rounded-full animate-ping"></div>}
             </div>
             
             <div className="grid grid-cols-2 gap-2 mt-2 text-center">
                <div className="border border-red-900/30 py-1 bg-red-950/10">
                  <div className="text-red-500 font-bold">{events.filter(e => e.threat === 'CRITICAL').length}</div>
                  <div className="text-[8px] text-red-900 tracking-widest">CRITICAL</div>
                </div>
                <div className="border border-red-900/30 py-1 bg-red-950/10">
                  <div className="text-red-500 font-bold">{events.filter(e => e.threat === 'WARNING').length}</div>
                  <div className="text-[8px] text-red-900 tracking-widest">WARNING</div>
                </div>
             </div>
          </div>

          <div className="border border-red-900/50 bg-black/80 p-3 flex flex-col flex-1 min-h-0 relative">
            <div className="absolute top-0 right-0 w-2 h-2 border-r border-t border-red-500"></div>
            <h2 className="text-[10px] tracking-widest uppercase border-b border-red-900/50 pb-1 mb-2 text-red-400 flex justify-between">
              <span>ALERT LOG</span>
              <span className="animate-pulse">_</span>
            </h2>
            
            <div className="flex-1 overflow-y-auto space-y-2 pr-1 scrollbar-thin scrollbar-thumb-red-900">
              {events.map((evt, idx) => (
                <div key={idx} className={`border border-red-900/30 p-2 relative ${evt.threat === 'CRITICAL' ? 'bg-red-950/40' : 'bg-red-950/10'}`}>
                  {evt.threat === 'CRITICAL' && <div className="absolute left-0 top-0 bottom-0 w-0.5 bg-red-500"></div>}
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-[8px] text-red-500/70">{new Date(evt.timestamp * 1000).toLocaleTimeString()}</span>
                    <span className="text-[8px] tracking-widest font-bold text-red-500">[{evt.threat}]</span>
                  </div>
                  <div className="text-[9px] text-red-400 leading-tight uppercase">{evt.description}</div>
                  <div className="text-[7px] text-red-900 mt-1">{evt.id}</div>
                </div>
              ))}
              {events.length === 0 && (
                <div className="text-[9px] text-red-900 text-center mt-10 tracking-widest">AWAITING TARGET...</div>
              )}
            </div>
          </div>
          
        </div>
      </main>
    </div>
  );
}
