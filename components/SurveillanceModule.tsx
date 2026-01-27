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
  Video
} from 'lucide-react';
import { Table } from '../types';
import { supabase } from '../lib/supabase';

interface SurveillanceProps {
  videoRef: React.RefObject<HTMLVideoElement | null>;
  isCameraReady: boolean;
  resultsRef: React.RefObject<HandLandmarkerResult | null>;
  tables: Table[];
  onCheckService: (tableId: number) => void;
  activeStation: number;
  setActiveStation: (id: number) => void;
  onManualTrigger: (id: number) => void;
}

const SurveillanceModule: React.FC<SurveillanceProps> = ({ 
  videoRef, isCameraReady, resultsRef, tables, onCheckService, activeStation, setActiveStation, onManualTrigger 
}) => {
  const canvasRefs = useRef<Array<HTMLCanvasElement | null>>([null, null, null, null]);
  
  const [detectionCount, setDetectionCount] = useState<number>(0);
  const [isDetecting, setIsDetecting] = useState<boolean>(false);
  const [lastAction, setLastAction] = useState<string>('Sistema Listo');
  const [showGlobalAlert, setShowGlobalAlert] = useState<{show: boolean, tableId: number}>({show: false, tableId: 0});

  const internalCounter = useRef<number>(0);
  const lastAlertTimestamp = useRef<number>(0);

  const testTables = tables.filter(t => t.id <= 3);
  const activeTable = testTables.find(t => t.id === activeStation);
  const sideTables = testTables.filter(t => t.id !== activeStation);

  // Función para desactivar la alarma localmente y en DB
  const handleClearAlarm = (tableId: number) => {
    console.log(`[SYNC] Desactivando Alarma Mesa ${tableId}`);
    // Resetear lógica de detección local
    internalCounter.current = 0;
    setDetectionCount(0);
    setIsDetecting(false);
    // Bloquear re-disparo por 10 segundos adicionales para dar tiempo al staff
    lastAlertTimestamp.current = Date.now() + 5000; 
    setLastAction("ALARMA SILENCIADA");
    
    // Llamar al handler del padre que actualiza Supabase
    onCheckService(tableId);
  };

  const triggerAlert = async (retries = 1): Promise<void> => {
    if (!activeStation) {
      console.error("❌ ERROR: ID de mesa no asignado.");
      return;
    }

    const tableId = activeStation;
    const now = Date.now();
    
    // Throttle: Si se atendió hace poco o se alertó hace poco, no disparar
    if (now - lastAlertTimestamp.current < 5000) return;

    setLastAction(`SYNC M${tableId}...`);
    
    try {
      console.log(`[SYNC] Intentando alertar Mesa ${tableId}. Reintentos restantes: ${retries}`);
      
      const { error } = await supabase
        .from('tables')
        .update({ 
          status: 'calling',
          welcome_timer_start: new Date().toISOString()
        })
        .eq('id', tableId);

      if (error) {
        if (retries > 0) {
          console.warn(`⚠️ Error en Supabase, reintentando... (${error.message})`);
          return triggerAlert(retries - 1);
        }
        throw error;
      }

      setLastAction(`M${tableId} ALERTADA OK`);
      lastAlertTimestamp.current = now;
      setShowGlobalAlert({ show: true, tableId });
      setTimeout(() => setShowGlobalAlert({ show: false, tableId: 0 }), 3000);
      
      onManualTrigger(tableId);

    } catch (err: any) {
      console.error("❌ ERROR CRÍTICO SYNC:", err);
      setLastAction("RECONECTANDO DB...");
    }
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

            if (isMaster && resultsRef.current?.landmarks) {
              let handIsRaised = false;

              resultsRef.current.landmarks.forEach(landmarks => {
                const tip = landmarks[8]; 
                if (tip.y < 0.35) {
                   handIsRaised = true;
                   ctx.fillStyle = '#ef4444';
                   ctx.beginPath();
                   ctx.arc(tip.x * canvas.width, tip.y * canvas.height, 15, 0, 2 * Math.PI);
                   ctx.fill();
                }
              });

              // Solo incrementar si NO estamos en estado de enfriamiento/atendido
              if (handIsRaised && (Date.now() - lastAlertTimestamp.current > 5000)) {
                internalCounter.current += 1;
                setIsDetecting(true);
                if (internalCounter.current > 60) {
                  if (table.status !== 'calling') triggerAlert();
                  internalCounter.current = 0;
                }
              } else {
                internalCounter.current = 0;
                setIsDetecting(false);
              }
              
              if (animationFrameId % 5 === 0) setDetectionCount(internalCounter.current);
            }

            if (table.status === 'calling') {
              const pulse = Math.floor(Date.now() / 250) % 2 === 0;
              ctx.strokeStyle = '#ef4444';
              ctx.lineWidth = isMaster ? 30 : 15;
              if (pulse) ctx.strokeRect(0, 0, canvas.width, canvas.height);
            }
          }
        }
      });
      animationFrameId = requestAnimationFrame(render);
    };

    render();
    return () => cancelAnimationFrame(animationFrameId);
  }, [isCameraReady, videoRef, resultsRef, activeStation, testTables]);

  return (
    <div className="space-y-8 animate-in fade-in duration-700">
      {showGlobalAlert.show && (
        <div className="fixed top-24 left-1/2 -translate-x-1/2 z-[500] bg-red-600 text-white px-10 py-5 rounded-[2.5rem] font-black italic text-xl uppercase tracking-tighter shadow-[0_0_60px_rgba(239,68,68,0.5)] flex items-center gap-4 border-2 border-white animate-in zoom-in slide-in-from-top-4">
          <Video size={28} className="animate-pulse" />
          ¡VIGILANCIA MESA {showGlobalAlert.tableId} ACTIVA!
        </div>
      )}

      <div className="flex flex-col md:flex-row gap-6">
        <div className="flex-1 bg-[#111114] p-6 rounded-[2.5rem] border border-white/5 shadow-2xl flex items-center justify-between">
          <div className="flex items-center gap-5">
            <div className={`p-4 rounded-3xl transition-all ${isDetecting ? 'bg-red-600 shadow-red-600/30' : 'bg-blue-600 shadow-blue-600/30'} shadow-xl`}>
              <Monitor className="text-white" size={28} />
            </div>
            <div>
              <h3 className="text-xl font-black italic tracking-tighter uppercase leading-none">NEXUM Service Vision</h3>
              <div className="flex items-center gap-3 mt-2">
                <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-full ${isDetecting ? 'bg-red-500 text-white' : 'bg-green-500/20 text-green-500'}`}>
                  {isDetecting ? 'IA_TRIGGER_READY' : 'IA_SCANNING'}
                </span>
                <span className="text-[9px] text-gray-500 font-bold uppercase tracking-widest">
                  Estación: <span className="text-blue-500 font-mono">{activeStation}</span>
                </span>
              </div>
            </div>
          </div>
          
          <button 
            onClick={() => triggerAlert()}
            disabled={!activeStation}
            className="bg-yellow-500 hover:bg-yellow-400 text-black px-6 py-3 rounded-2xl font-black text-[10px] uppercase tracking-widest flex items-center gap-2 shadow-xl transition-all active:scale-95"
          >
            <Zap size={16} fill="currentColor" /> TEST SYNC M{activeStation}
          </button>
        </div>

        <div className="bg-[#111114] p-6 rounded-[2.5rem] border border-white/5 min-w-[200px] flex flex-col justify-center">
          <span className="text-[8px] text-gray-600 font-black uppercase tracking-widest block mb-1">Network Sincro</span>
          <div className="flex items-center gap-2">
             <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse"></div>
             <span className="text-[10px] font-black text-white italic uppercase">{lastAction}</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        <div className="lg:col-span-3">
          <div className={`relative rounded-[3.5rem] overflow-hidden border-4 transition-all duration-500 shadow-2xl bg-black ${
            activeTable?.status === 'calling' ? 'border-red-500 ring-8 ring-red-500/10' : 'border-blue-500/30'
          }`}>
             <div className="absolute top-8 left-8 z-20 flex flex-col gap-3">
               <div className="flex items-center gap-3 bg-black/80 backdrop-blur-xl px-5 py-2 rounded-full border border-white/10">
                  <div className={`w-3 h-3 rounded-full ${activeTable?.status === 'calling' ? 'bg-red-500 animate-pulse' : 'bg-green-500'}`}></div>
                  <span className="text-xs font-black text-white italic tracking-widest uppercase">MESA_{activeStation}_CAM_V4</span>
               </div>
               <div className="w-48 h-2 bg-white/10 rounded-full overflow-hidden">
                  <div className={`h-full bg-blue-500 transition-all`} style={{ width: `${(detectionCount / 60) * 100}%` }}></div>
               </div>
            </div>

            <div className="aspect-video relative">
               {/* Fix: replaced 'table.id' with 'activeStation' as 'table' was undefined in this scope */}
               <canvas ref={el => { if (el) canvasRefs.current[activeStation] = el; }} className="w-full h-full object-cover" />
               {activeTable?.status === 'calling' && (
                 <div className="absolute inset-0 bg-red-600/10 flex flex-col items-center justify-center p-12 text-center animate-in zoom-in">
                    <div className="bg-red-600 p-8 rounded-full shadow-[0_0_60px_rgba(239,68,68,0.4)] mb-8 animate-bounce">
                       <BellRing size={64} className="text-white" />
                    </div>
                    <h4 className="text-6xl font-black italic text-white uppercase mb-4 tracking-tighter">SERVICIO SOLICITADO</h4>
                    <button 
                      onClick={() => handleClearAlarm(activeStation)} 
                      className="bg-white text-red-600 px-12 py-5 rounded-[2rem] font-black text-sm uppercase tracking-widest shadow-2xl hover:scale-105 transition-transform flex items-center gap-3"
                    >
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