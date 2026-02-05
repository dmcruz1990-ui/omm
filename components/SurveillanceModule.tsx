
import React, { useEffect, useRef, useState } from 'react';
import { HandLandmarkerResult } from '@mediapipe/tasks-vision';
import { 
  Monitor, 
  Zap,
  Activity,
  ShieldCheck,
  Hand,
  BellRing,
  AlertTriangle,
  CheckCircle,
  Video,
  UserCheck,
  Fingerprint,
  Scan,
  RefreshCw,
  CameraOff,
  Settings
} from 'lucide-react';
import { Table, AttendanceLog } from '../types.ts';
import { supabase } from '../lib/supabase.ts';

interface SurveillanceProps {
  videoRef: React.RefObject<HTMLVideoElement | null>;
  isCameraReady: boolean;
  resultsRef: React.RefObject<HandLandmarkerResult | null>;
  tables: Table[];
  onCheckService: (tableId: number) => void;
  activeStation: number;
  setActiveStation: (id: number) => void;
  onManualTrigger: (id: number) => void;
  cameraError?: string | null;
  onRetryCamera?: () => void;
}

const SurveillanceModule: React.FC<SurveillanceProps> = ({ 
  videoRef, isCameraReady, resultsRef, tables, onCheckService, activeStation, setActiveStation, onManualTrigger,
  cameraError, onRetryCamera
}) => {
  const canvasRefs = useRef<Array<HTMLCanvasElement | null>>([null, null, null, null]);
  
  const [mode, setMode] = useState<'SURVEILLANCE' | 'BIOMETRIC'>('SURVEILLANCE');
  const [detectionCount, setDetectionCount] = useState<number>(0);
  const [isDetecting, setIsDetecting] = useState<boolean>(false);
  const [lastAction, setLastAction] = useState<string>('Sistema Listo');
  const [showGlobalAlert, setShowGlobalAlert] = useState<{show: boolean, tableId: number}>({show: false, tableId: 0});
  const [lastVerifiedStaff, setLastVerifiedStaff] = useState<AttendanceLog | null>(null);

  const internalCounter = useRef<number>(0);
  const lastAlertTimestamp = useRef<number>(0);

  const testTables = tables.filter(t => t.id <= 3);
  const activeTable = testTables.find(t => t.id === activeStation);
  const sideTables = testTables.filter(t => t.id !== activeStation);

  const handleClearAlarm = (tableId: number) => {
    internalCounter.current = 0;
    setDetectionCount(0);
    setIsDetecting(false);
    lastAlertTimestamp.current = Date.now() + 5000; 
    setLastAction("ALARMA SILENCIADA");
    onCheckService(tableId);
  };

  const processBiometricCheck = async () => {
    setIsDetecting(true);
    internalCounter.current += 1;
    if (internalCounter.current > 40) {
      const mockStaff: AttendanceLog = {
        id: Math.random().toString(),
        staff_id: 'E001',
        name: 'Juan Pérez',
        timestamp: new Date().toISOString(),
        type: Math.random() > 0.5 ? 'IN' : 'OUT',
        confidence: 0.98,
      };
      
      setLastVerifiedStaff(mockStaff);
      setLastAction(`BIOMETRIC_${mockStaff.type}_OK`);
      internalCounter.current = 0;
      
      // Simular push a DB para nómina
      console.log("Attendance Sync:", mockStaff);
      
      setTimeout(() => setLastVerifiedStaff(null), 4000);
    }
  };

  const triggerAlert = async (retries = 1): Promise<void> => {
    const tableId = activeStation;
    const now = Date.now();
    if (now - lastAlertTimestamp.current < 5000) return;
    setLastAction(`SYNC M${tableId}...`);
    try {
      const { error } = await supabase.from('tables').update({ status: 'calling', welcome_timer_start: new Date().toISOString() }).eq('id', tableId);
      if (error) return triggerAlert(retries - 1);
      setLastAction(`M${tableId} ALERTADA OK`);
      lastAlertTimestamp.current = now;
      setShowGlobalAlert({ show: true, tableId });
      setTimeout(() => setShowGlobalAlert({ show: false, tableId: 0 }), 3000);
      onManualTrigger(tableId);
    } catch (err) { setLastAction("RECONECTANDO DB..."); }
  };

  useEffect(() => {
    if (!isCameraReady) return;
    let animationFrameId: number;

    const render = () => {
      const video = videoRef.current;
      if (!video || video.readyState < 2) {
        animationFrameId = requestAnimationFrame(render);
        return;
      }

      testTables.forEach((table) => {
        const canvas = canvasRefs.current[table.id];
        if (canvas) {
          const ctx = canvas.getContext('2d');
          if (ctx) {
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
            const isMaster = table.id === activeStation;
            
            ctx.filter = isMaster ? 'contrast(1.1) saturate(1.1)' : 'grayscale(60%) brightness(40%)';
            ctx.drawImage(video, 0, 0);
            ctx.filter = 'none';

            if (isMaster) {
              if (mode === 'SURVEILLANCE' && resultsRef.current?.landmarks) {
                let handIsRaised = false;
                resultsRef.current.landmarks.forEach(landmarks => {
                  const tip = landmarks[8]; 
                  if (tip.y < 0.35) {
                     handIsRaised = true;
                     ctx.strokeStyle = '#ef4444';
                     ctx.lineWidth = 4;
                     ctx.strokeRect(tip.x * canvas.width - 50, tip.y * canvas.height - 50, 100, 100);
                  }
                });

                if (handIsRaised && (Date.now() - lastAlertTimestamp.current > 5000)) {
                  internalCounter.current += 1;
                  setIsDetecting(true);
                  if (internalCounter.current > 60) {
                    if (table.status !== 'calling') triggerAlert();
                    internalCounter.current = 0;
                  }
                } else { internalCounter.current = 0; setIsDetecting(false); }
              } 
              else if (mode === 'BIOMETRIC') {
                // Simulación de escaneo facial visual
                ctx.strokeStyle = '#2563eb';
                ctx.lineWidth = 2;
                ctx.strokeRect(canvas.width * 0.3, canvas.height * 0.2, canvas.width * 0.4, canvas.height * 0.6);
                
                // Línea de escaneo animada
                const scanLineY = (Date.now() % 2000 / 2000) * (canvas.height * 0.6) + (canvas.height * 0.2);
                ctx.beginPath();
                ctx.moveTo(canvas.width * 0.3, scanLineY);
                ctx.lineTo(canvas.width * 0.7, scanLineY);
                ctx.stroke();

                processBiometricCheck();
              }
              
              if (animationFrameId % 5 === 0) setDetectionCount(internalCounter.current);
            }
          }
        }
      });
      animationFrameId = requestAnimationFrame(render);
    };

    render();
    return () => cancelAnimationFrame(animationFrameId);
  }, [isCameraReady, videoRef, resultsRef, activeStation, testTables, mode]);

  return (
    <div className="space-y-8 animate-in fade-in duration-700 text-left">
      <div className="flex flex-col lg:flex-row gap-6">
        <div className="flex-1 bg-[#111114] p-6 rounded-[2.5rem] border border-white/5 shadow-2xl flex items-center justify-between">
          <div className="flex items-center gap-5">
            <div className={`p-4 rounded-3xl transition-all ${mode === 'BIOMETRIC' ? 'bg-blue-600 shadow-blue-600/30' : 'bg-red-600 shadow-red-600/30'} shadow-xl`}>
              {mode === 'BIOMETRIC' ? <Fingerprint className="text-white" size={28} /> : <Monitor className="text-white" size={28} />}
            </div>
            <div>
              <h3 className="text-xl font-black italic tracking-tighter uppercase leading-none">NEXUM Vision Core</h3>
              <div className="flex bg-black/40 p-1 rounded-xl mt-3 border border-white/5">
                <button onClick={() => { setMode('SURVEILLANCE'); internalCounter.current = 0; }} className={`px-4 py-1.5 rounded-lg text-[8px] font-black uppercase tracking-widest transition-all ${mode === 'SURVEILLANCE' ? 'bg-red-600 text-white' : 'text-gray-500'}`}>Surveillance</button>
                <button onClick={() => { setMode('BIOMETRIC'); internalCounter.current = 0; }} className={`px-4 py-1.5 rounded-lg text-[8px] font-black uppercase tracking-widest transition-all ${mode === 'BIOMETRIC' ? 'bg-blue-600 text-white' : 'text-gray-500'}`}>Staff Biometry</button>
              </div>
            </div>
          </div>
          
          {mode === 'SURVEILLANCE' ? (
             <button onClick={() => triggerAlert()} className="bg-yellow-500 hover:bg-yellow-400 text-black px-6 py-3 rounded-2xl font-black text-[10px] uppercase tracking-widest flex items-center gap-2 shadow-xl transition-all">
                <Zap size={16} fill="currentColor" /> TEST SYNC M{activeStation}
             </button>
          ) : (
            <div className="flex items-center gap-4">
               <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse"></div>
               <span className="text-[10px] font-black text-blue-500 uppercase italic">ESPERANDO ROSTRO...</span>
            </div>
          )}
        </div>

        <div className="bg-[#111114] p-6 rounded-[2.5rem] border border-white/5 min-w-[240px] flex flex-col justify-center relative overflow-hidden">
          <span className="text-[8px] text-gray-600 font-black uppercase tracking-widest block mb-1">Status Sincro</span>
          <div className="flex items-center gap-2">
             <div className={`w-2 h-2 rounded-full animate-pulse ${cameraError ? 'bg-red-500' : 'bg-green-500'}`}></div>
             <span className="text-[10px] font-black text-white italic uppercase">{cameraError ? 'CAMERA_ERROR' : lastAction}</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        <div className="lg:col-span-3 relative">
          <div className={`relative rounded-[3.5rem] overflow-hidden border-4 transition-all duration-500 shadow-2xl bg-black ${
            mode === 'BIOMETRIC' ? 'border-blue-600' : (activeTable?.status === 'calling' ? 'border-red-500' : 'border-white/10')
          }`}>
             
             {/* HUD de Error de Cámara */}
             {cameraError && (
               <div className="absolute inset-0 z-50 bg-[#0a0a0c]/90 backdrop-blur-xl flex flex-col items-center justify-center p-12 text-center animate-in zoom-in duration-500">
                  <div className="w-20 h-20 bg-red-600/20 rounded-full flex items-center justify-center mb-8 border border-red-500/30">
                     <CameraOff size={40} className="text-red-500" />
                  </div>
                  <h4 className="text-3xl font-black italic text-white uppercase mb-4 tracking-tighter">Acceso a Cámara Bloqueado</h4>
                  <p className="text-gray-400 text-sm max-w-md italic mb-10 leading-relaxed uppercase">
                    NEXUM requiere acceso a la cámara para el seguimiento de gestos y biometría. Por favor, revisa los permisos en la barra de direcciones del navegador.
                  </p>
                  <div className="flex gap-4">
                     <button 
                      onClick={onRetryCamera}
                      className="bg-white text-black px-10 py-5 rounded-[2rem] font-black text-[10px] uppercase tracking-widest shadow-xl flex items-center gap-3 hover:bg-blue-600 hover:text-white transition-all"
                     >
                        <RefreshCw size={18} /> REINTENTAR ACCESO
                     </button>
                     <button className="bg-white/5 text-gray-500 px-8 py-5 rounded-[2rem] font-black text-[10px] uppercase tracking-widest border border-white/5 transition-all">
                        MODO MANUAL
                     </button>
                  </div>
               </div>
             )}

             {/* HUD de Biometría */}
             {mode === 'BIOMETRIC' && lastVerifiedStaff && (
               <div className="absolute inset-0 z-50 bg-blue-600/90 backdrop-blur-md flex flex-col items-center justify-center p-12 text-center animate-in zoom-in duration-500">
                  <div className="w-24 h-24 bg-white rounded-full flex items-center justify-center mb-6 shadow-2xl">
                     <UserCheck size={48} className="text-blue-600" />
                  </div>
                  <h4 className="text-4xl font-black italic text-white uppercase mb-2">IDENTIDAD VERIFICADA</h4>
                  <p className="text-2xl font-black text-white/80 italic uppercase tracking-tighter">{lastVerifiedStaff.name}</p>
                  <div className="mt-8 bg-black/40 px-8 py-4 rounded-2xl border border-white/20">
                     <span className="text-[10px] font-black text-white uppercase block mb-1">Registro de Nómina</span>
                     <span className="text-xl font-black italic text-blue-400">PUNCH_{lastVerifiedStaff.type} OK</span>
                  </div>
               </div>
             )}

             <div className="absolute top-8 left-8 z-20 flex flex-col gap-3">
               <div className="flex items-center gap-3 bg-black/80 backdrop-blur-xl px-5 py-2 rounded-full border border-white/10">
                  <div className={`w-3 h-3 rounded-full ${mode === 'BIOMETRIC' ? 'bg-blue-500 animate-pulse' : (activeTable?.status === 'calling' ? 'bg-red-500 animate-pulse' : 'bg-green-500')}`}></div>
                  <span className="text-xs font-black text-white italic tracking-widest uppercase">
                    {mode === 'BIOMETRIC' ? 'BIOMETRIC_CHECKPOINT_01' : `MESA_${activeStation}_CAM_V4`}
                  </span>
               </div>
               <div className="w-48 h-2 bg-white/10 rounded-full overflow-hidden">
                  <div className={`h-full bg-blue-500 transition-all`} style={{ width: `${(detectionCount / 60) * 100}%` }}></div>
               </div>
            </div>

            <div className="aspect-video relative">
               <canvas ref={el => { if (el) canvasRefs.current[activeStation] = el; }} className="w-full h-full object-cover" />
               {activeTable?.status === 'calling' && mode === 'SURVEILLANCE' && (
                 <div className="absolute inset-0 bg-red-600/10 flex flex-col items-center justify-center p-12 text-center animate-in zoom-in">
                    <div className="bg-red-600 p-8 rounded-full shadow-[0_0_60px_rgba(239,68,68,0.4)] mb-8 animate-bounce">
                       <BellRing size={64} className="text-white" />
                    </div>
                    <h4 className="text-6xl font-black italic text-white uppercase mb-4 tracking-tighter">SERVICIO SOLICITADO</h4>
                    <button onClick={() => handleClearAlarm(activeStation)} className="bg-white text-red-600 px-12 py-5 rounded-[2rem] font-black text-sm uppercase tracking-widest shadow-2xl hover:scale-105 transition-transform flex items-center gap-3">
                      <CheckCircle size={20} /> MARCAR ATENDIDO
                    </button>
                 </div>
               )}
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-6">
          <h4 className="text-[10px] font-black text-gray-500 uppercase tracking-widest border-b border-white/5 pb-3 italic">Multichannel Vision</h4>
          {sideTables.map(table => (
            <div key={table.id} onClick={() => setActiveStation(table.id)} className={`relative cursor-pointer group rounded-[2.5rem] overflow-hidden border-2 transition-all ${table.status === 'calling' ? 'border-red-500 shadow-lg animate-pulse' : 'border-white/5 opacity-60 hover:opacity-100'}`}>
              <div className="absolute top-4 left-4 z-10 bg-black/70 px-3 py-1 rounded-xl text-[9px] font-black text-white uppercase tracking-widest">MESA {table.id}</div>
              <div className="aspect-video bg-gray-900">
                <canvas ref={el => { if (el) canvasRefs.current[table.id] = el; }} className="w-full h-full object-cover" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default SurveillanceModule;
