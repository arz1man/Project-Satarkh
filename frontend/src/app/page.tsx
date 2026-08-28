'use client';
import { useState, useEffect, useRef, useCallback } from 'react';
import { ShieldAlert, Crosshair, Users, Activity, Settings, Video, FileVideo, Save, RotateCcw, Trash2, Shield, UploadCloud, Download, Plus, Clock, Terminal } from 'lucide-react';

export default function Home() {
  const svgRef = useRef<SVGSVGElement>(null);
  const videoFileRef = useRef<HTMLInputElement>(null);
  const faceFileRef = useRef<HTMLInputElement>(null);

  // Layout & Global State
  const [currentTime, setCurrentTime] = useState('');
  
  // Video Source
  const [videoSource, setVideoSource] = useState('file');
  const [nightVision, setNightVision] = useState(false);
  
  // Tripwire State
  const [boundaryMode, setBoundaryMode] = useState(false);
  const defaultZone = [
    { x: 300, y: 500 },
    { x: 980, y: 500 },
    { x: 1100, y: 650 },
    { x: 180, y: 650 }
  ];
  const [drawPoints, setDrawPoints] = useState<{x: number, y: number}[]>([]);
  const [draggingIdx, setDraggingIdx] = useState<number | null>(null);

  // Events & Telemetry
  const [events, setEvents] = useState<any[]>([]);
  const [isBreaching, setIsBreaching] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const latestEventRef = useRef<any>(null);

  // Database
  const [faces, setFaces] = useState<string[]>([]);

  // Clock
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date().toLocaleTimeString('en-US', { hour12: false }) + ' L');
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Initialization & WebSocket
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
      });
    } else {
      setDrawPoints(defaultZone);
      fetch(`http://localhost:8000/api/tripwire`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ points: defaultZone.map(p => [p.x, p.y]) })
      });
    }

    const connectWS = () => {
      const ws = new WebSocket('ws://localhost:8000/ws/events');
      ws.onmessage = (event) => {
        const data = JSON.parse(event.data);
        if (data.type === 'HEARTBEAT') {
          setIsBreaching(data.is_breaching);
        } else if (data.type === 'ALERT') {
          setEvents(prev => [data.data, ...prev].slice(0, 50));
          latestEventRef.current = data.data;
        }
      };
      ws.onclose = () => setTimeout(connectWS, 2000);
      wsRef.current = ws;
    };
    connectWS();
    return () => wsRef.current?.close();
  }, []);

  // Source Switching
  const changeSource = async (src: string, mode: string) => {
    setVideoSource(mode);
    try {
      await fetch(`http://localhost:8000/api/source`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ source: src })
      });
    } catch (e) {
      console.warn("Source change fetch failed:", e);
    }
  };

  const handleVideoFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    const formData = new FormData();
    formData.append('file', e.target.files[0]);
    try {
      const res = await fetch(`http://localhost:8000/api/upload_video`, { method: 'POST', body: formData });
      const data = await res.json();
      if (data.path) changeSource(data.path, 'file');
    } catch (err) {
      console.error(err);
    }
  };

  const toggleNightVision = async () => {
    const newState = !nightVision;
    setNightVision(newState);
    try {
      await fetch(`http://localhost:8000/api/nightvision`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: newState })
      });
    } catch (e) {
      console.warn(e);
    }
  };

  // Boundary Logic
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

  const handlePointerUp = () => {
    setDraggingIdx(null);
  };

  const saveBoundary = async () => {
    setBoundaryMode(false);
    localStorage.setItem('satark_zone', JSON.stringify(drawPoints));
    await fetch(`http://localhost:8000/api/tripwire`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ points: drawPoints.map(p => [p.x, p.y]) })
    });
  };

  const resetBoundary = () => {
    setDrawPoints(defaultZone);
    localStorage.removeItem('satark_zone');
  };

  // Face Database
  const fetchFaces = async () => {
    try {
      const res = await fetch(`http://localhost:8000/api/faces`);
      const data = await res.json();
      setFaces(data.faces || []);
    } catch (err) {
      console.error(err);
    }
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

  return (
    <div className="flex flex-col h-screen bg-slate-950 text-slate-300 font-mono overflow-hidden selection:bg-blue-500/30">
      
      {/* Top Navigation Bar */}
      <header className="h-14 bg-slate-900 border-b border-slate-800 flex items-center justify-between px-6 shrink-0 z-50 shadow-md">
        <div className="flex items-center gap-4">
          <ShieldAlert className="w-6 h-6 text-blue-500" />
          <div>
            <h1 className="font-black tracking-widest text-white leading-none">SATARKH</h1>
            <p className="text-[10px] text-blue-400 tracking-widest uppercase">Tactical Command Center</p>
          </div>
        </div>
        
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2 px-3 py-1 bg-black/40 rounded border border-slate-800">
            <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
            <span className="text-xs text-green-400 font-bold tracking-widest">SECURE LINK ESTABLISHED</span>
          </div>
          
          <button 
            onClick={toggleNightVision}
            className={`flex items-center gap-2 px-4 py-1.5 rounded text-xs font-bold transition-all border ${nightVision ? 'bg-green-900/30 border-green-500 text-green-400 shadow-[0_0_10px_rgba(34,197,94,0.2)]' : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-white'}`}
          >
            <Activity className="w-4 h-4" />
            NIGHT VISION {nightVision ? 'ON' : 'OFF'}
          </button>
          
          <div className="text-xs text-slate-500 flex items-center gap-2 bg-slate-950 px-3 py-1.5 rounded border border-slate-800">
            <Clock className="w-4 h-4 text-blue-500" />
            {currentTime}
          </div>
        </div>
      </header>

      {/* Main Grid Layout */}
      <main className="flex-1 grid grid-cols-12 gap-4 p-4 overflow-hidden">
        
        {/* LEFT COLUMN: Controls & Settings */}
        <div className="col-span-3 flex flex-col gap-4 min-h-0">
          
          {/* Module 1: Video Source */}
          <div className="bg-slate-900 border border-slate-800 rounded-lg flex flex-col overflow-hidden shrink-0">
            <div className="bg-slate-800/50 px-4 py-2 border-b border-slate-800 flex items-center gap-2">
              <Settings className="w-4 h-4 text-slate-400" />
              <h2 className="text-xs font-bold text-white tracking-widest">VIDEO SOURCE</h2>
            </div>
            <div className="p-4 grid grid-cols-2 gap-3">
              <input type="file" accept="video/*" className="hidden" ref={videoFileRef} onChange={handleVideoFileUpload} />
              <button 
                onClick={() => videoFileRef.current?.click()}
                className={`flex flex-col items-center justify-center p-3 border rounded transition-colors ${videoSource === 'file' ? 'bg-blue-900/20 border-blue-500 text-blue-400' : 'bg-slate-950 border-slate-800 hover:border-slate-600'}`}
              >
                <FileVideo className="w-6 h-6 mb-2" />
                <span className="text-[10px] font-bold">UPLOAD .MP4</span>
              </button>
              <button 
                onClick={() => changeSource('0', 'webcam')}
                className={`flex flex-col items-center justify-center p-3 border rounded transition-colors ${videoSource === 'webcam' ? 'bg-orange-900/20 border-orange-500 text-orange-400' : 'bg-slate-950 border-slate-800 hover:border-slate-600'}`}
              >
                <Video className="w-6 h-6 mb-2" />
                <span className="text-[10px] font-bold">LOCAL WEBCAM</span>
              </button>
            </div>
          </div>

          {/* Module 2: Zone Config */}
          <div className="bg-slate-900 border border-slate-800 rounded-lg flex flex-col overflow-hidden shrink-0">
            <div className="bg-slate-800/50 px-4 py-2 border-b border-slate-800 flex items-center gap-2">
              <Crosshair className="w-4 h-4 text-slate-400" />
              <h2 className="text-xs font-bold text-white tracking-widest">PERIMETER ZONE</h2>
            </div>
            <div className="p-4 flex flex-col gap-3">
              <p className="text-[10px] text-slate-500">Modify the tactical tripwire zone overlay on the primary feed.</p>
              {boundaryMode ? (
                <div className="flex gap-2">
                  <button onClick={saveBoundary} className="flex-1 bg-green-600 hover:bg-green-500 text-white py-2 rounded text-xs font-bold flex items-center justify-center gap-2">
                    <Save className="w-4 h-4" /> SAVE ZONE
                  </button>
                  <button onClick={resetBoundary} className="px-3 bg-slate-800 hover:bg-slate-700 text-white rounded flex items-center justify-center transition-colors">
                    <RotateCcw className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <button onClick={() => setBoundaryMode(true)} className="w-full bg-slate-800 hover:bg-slate-700 text-white py-2 rounded text-xs font-bold transition-colors">
                  EDIT ZONE
                </button>
              )}
            </div>
          </div>

          {/* Module 3: Face Database */}
          <div className="bg-slate-900 border border-slate-800 rounded-lg flex flex-col overflow-hidden flex-1 min-h-0">
            <div className="bg-slate-800/50 px-4 py-2 border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-slate-400" />
                <h2 className="text-xs font-bold text-white tracking-widest">KNOWN ENTITIES</h2>
              </div>
              <span className="text-[10px] bg-slate-950 px-2 py-0.5 rounded text-slate-400 border border-slate-800">{faces.length}</span>
            </div>
            <div className="p-4 flex-1 flex flex-col min-h-0">
              <input type="file" accept="image/*" className="hidden" ref={faceFileRef} onChange={handleFaceUpload} />
              <button 
                onClick={() => faceFileRef.current?.click()}
                className="w-full border border-dashed border-slate-600 hover:border-slate-400 text-slate-400 hover:text-white rounded py-2 text-[10px] font-bold flex items-center justify-center gap-2 mb-3 shrink-0 transition-colors"
              >
                <Plus className="w-4 h-4" /> REGISTER NEW FACE
              </button>
              
              <div className="flex-1 overflow-y-auto space-y-2 pr-1 scrollbar-thin scrollbar-thumb-slate-700">
                {faces.map((f, i) => (
                  <div key={i} className="flex items-center justify-between bg-slate-950 border border-slate-800 p-2 rounded group hover:border-slate-600 transition-colors">
                    <span className="text-[11px] font-bold text-slate-300">{f.split('.')[0]}</span>
                    <button onClick={() => deleteFace(f)} className="text-red-900 group-hover:text-red-500 transition-colors">
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                ))}
                {faces.length === 0 && (
                  <div className="text-center mt-6 text-[10px] text-slate-600">NO ENTITIES REGISTERED</div>
                )}
              </div>
            </div>
          </div>
          
        </div>

        {/* CENTER COLUMN: Tactical Feed */}
        <div className="col-span-6 flex flex-col min-h-0">
          <div className={`relative flex-1 bg-black rounded-lg border-2 overflow-hidden flex items-center justify-center transition-all duration-300 ${
            boundaryMode ? 'border-orange-500 shadow-[0_0_20px_rgba(249,115,22,0.15)]' : 
            isBreaching ? 'border-red-600 shadow-[0_0_40px_rgba(220,38,38,0.4)]' : 
            'border-slate-800 shadow-xl shadow-black/50'
          }`}>
            
            {/* Visual Indicators overlay */}
            <div className="absolute top-4 left-4 z-30 pointer-events-none flex items-center gap-2 bg-black/60 px-3 py-1.5 rounded backdrop-blur border border-white/10">
              <Video className="w-4 h-4 text-blue-400" />
              <span className="text-[10px] font-bold text-white tracking-widest">CAM_01 // SECURE_FEED</span>
            </div>
            
            <div className="absolute top-4 right-4 z-30 pointer-events-none flex items-center gap-2 bg-black/60 px-3 py-1.5 rounded backdrop-blur border border-white/10">
              <span className="text-[10px] font-bold text-red-500 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse"></span>
                REC // LIVE
              </span>
            </div>

            {/* Perimeter Breach Flash */}
            {isBreaching && (
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-40 bg-red-600 text-white font-black px-8 py-3 tracking-[0.25em] border-2 border-white animate-pulse pointer-events-none shadow-[0_0_50px_rgba(220,38,38,1)] text-xl">
                THREAT DETECTED
              </div>
            )}

            {/* Video Stream */}
            <img 
              src="http://localhost:8000/video_feed" 
              className={`absolute inset-0 w-full h-full object-contain select-none transition-all duration-75 ${isBreaching ? 'opacity-80' : 'opacity-100'}`} 
              draggable={false} 
            />

            {/* SVG Boundary Layer */}
            <svg 
              ref={svgRef}
              className={`absolute inset-0 w-full h-full z-20 ${boundaryMode ? 'cursor-crosshair' : 'pointer-events-none'}`} 
              viewBox="0 0 1280 720" preserveAspectRatio="xMidYMid meet"
              onMouseMove={handlePointerMove}
              onMouseUp={handlePointerUp}
              onMouseLeave={handlePointerUp}
              onTouchMove={handlePointerMove}
              onTouchEnd={handlePointerUp}
            >
              {drawPoints.length > 2 && (
                <polygon 
                  points={drawPoints.map(p => `${p.x},${p.y}`).join(' ')} 
                  fill={boundaryMode ? "rgba(249, 115, 22, 0.15)" : "transparent"} 
                  stroke={boundaryMode ? "#f97316" : "rgba(255, 255, 255, 0.3)"} 
                  strokeWidth={boundaryMode ? "2" : "1"} 
                  strokeDasharray={boundaryMode ? "8 4" : "4 4"}
                />
              )}
              {boundaryMode && drawPoints.map((p, i) => (
                <g key={i}>
                  <circle cx={p.x} cy={p.y} r="24" fill="transparent" className="cursor-grab active:cursor-grabbing" onMouseDown={(e) => handlePointerDown(i, e)} onTouchStart={(e) => handlePointerDown(i, e)} />
                  <circle cx={p.x} cy={p.y} r="6" fill={draggingIdx === i ? "#fff" : "#f97316"} stroke="#fff" strokeWidth="2" className="pointer-events-none" />
                </g>
              ))}
            </svg>
          </div>
        </div>

        {/* RIGHT COLUMN: Telemetry & Logs */}
        <div className="col-span-3 flex flex-col gap-4 min-h-0">
          
          {/* Module 4: Live Analytics */}
          <div className="bg-slate-900 border border-slate-800 rounded-lg flex flex-col overflow-hidden shrink-0">
             <div className="bg-slate-800/50 px-4 py-2 border-b border-slate-800 flex items-center gap-2">
              <Activity className="w-4 h-4 text-slate-400" />
              <h2 className="text-xs font-bold text-white tracking-widest">TELEMETRY</h2>
            </div>
            <div className="p-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="text-[10px] text-slate-500 tracking-wider mb-1">TOTAL TRACKS</div>
                  <div className="text-3xl font-bold text-white font-sans">{events.length}</div>
                </div>
                <div>
                  <div className="text-[10px] text-slate-500 tracking-wider mb-1">CRITICAL THREATS</div>
                  <div className="text-3xl font-bold text-red-500 font-sans">{events.filter(e => e.threat === 'CRITICAL').length}</div>
                </div>
              </div>
            </div>
          </div>

          {/* Module 5: Audit Log */}
          <div className="bg-slate-900 border border-slate-800 rounded-lg flex flex-col overflow-hidden flex-1 min-h-0">
            <div className="bg-slate-800/50 px-4 py-2 border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Terminal className="w-4 h-4 text-slate-400" />
                <h2 className="text-xs font-bold text-white tracking-widest">EVENT LOG</h2>
              </div>
              <button 
                className="text-[10px] font-bold bg-slate-950 px-2 py-1 rounded text-blue-400 border border-slate-800 hover:border-slate-600 transition-colors"
                onClick={() => {
                  const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(events, null, 2));
                  const downloadAnchorNode = document.createElement('a');
                  downloadAnchorNode.setAttribute("href", dataStr);
                  downloadAnchorNode.setAttribute("download", "satark_events.json");
                  document.body.appendChild(downloadAnchorNode);
                  downloadAnchorNode.click();
                  downloadAnchorNode.remove();
                }}
              >
                EXPORT
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-3 space-y-3 scrollbar-thin scrollbar-thumb-slate-700">
              {events.map((evt, idx) => (
                <div key={idx} className={`p-3 rounded border-l-2 ${evt.threat === 'CRITICAL' ? 'bg-red-950/20 border-red-500' : 'bg-slate-950/50 border-orange-500'}`}>
                  <div className="flex justify-between items-start mb-2">
                    <span className="text-[10px] text-slate-400 flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {new Date(evt.timestamp * 1000).toLocaleTimeString()}
                    </span>
                    <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded tracking-widest ${evt.threat === 'CRITICAL' ? 'bg-red-500 text-white' : 'bg-orange-900/50 text-orange-400'}`}>
                      {evt.threat}
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-200 leading-tight mb-2 font-sans font-medium">{evt.description}</div>
                  <div className="text-[9px] text-slate-600 bg-black/50 px-2 py-1 rounded inline-block">{evt.id}</div>
                </div>
              ))}
              {events.length === 0 && (
                <div className="flex flex-col items-center justify-center h-full text-slate-600 opacity-50">
                  <Shield className="w-12 h-12 mb-3 text-slate-700" />
                  <p className="text-[11px] tracking-widest uppercase font-bold text-center">SYSTEM ARMED.<br/>NO BREACHES RECORDED.</p>
                </div>
              )}
            </div>
          </div>
          
        </div>
      </main>
    </div>
  );
}
