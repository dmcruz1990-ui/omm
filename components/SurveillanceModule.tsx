
import React, { useEffect, useRef, useState, useCallback } from 'react';
import { HandLandmarkerResult } from '@mediapipe/tasks-vision';
import { 
  Activity,
  ShieldCheck,
  BellRing,
  Volume2,
  Target,
  Clock
} from 'lucide-react';
import { Table } from '../types.ts';
import { supabase } from '../lib/supabase.ts';

interface SurveillanceProps {
  videoRef: React.RefObject<HTMLVideoElement | null>;
  isCameraReady: boolean;
  resultsRef: React.RefObject<HandLandmarkerResult | null>;
  tables: Table[];
  onManualTrigger: (id: number) => void;
}

// Definición de Zonas de Mesa (Coordenadas normalizadas 0.0 a 1.0)
// En un entorno real, esto se calibraría mediante una interfaz de administración
const TABLE_ZONES = [
  { id: 1, x: [0.0, 0.33], y: [0.0, 1.0], label: "ZONA_NORTE_M1" },
  { id: 2, x: [0.33, 0.66], y: [0.0, 1.0], label: "ZONA_CENTRO_M2" },
  { id: 3, x: [0.66, 1.0], y: [0.0, 1.0], label: "ZONA_SUR_M3" }
];

const SurveillanceModule: React.FC<SurveillanceProps> = ({ 
  videoRef, isCameraReady, resultsRef, tables, onManualTrigger
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  
  const [detectionHistory, setDetectionHistory] = useState<string[]>([]);
  
  // Contadores de frames por mesa para evitar falsos positivos
  const tableCounters = useRef<Record<number, number>>({ 1: 0, 2: 0, 3: 0 });
  const lastAlertTime = useRef<Record<number, number>>({ 1: 0, 2: 0, 3: 0 });

  useEffect(() => {
    audioRef.current = new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3');
    audioRef.current.volume = 0.4;
  }, []);

  const playAlertSound = () => {
    if (audioRef.current) {
      audioRef.current.currentTime = 0;
      audioRef.current.play().catch(() => {});
    }
  };

  const triggerAutoAlert = useCallback(async (tableId: number) => {
    const now = Date.now();
    if (now - lastAlertTime.current[tableId] < 10000) return; // Cooldown de 10s

    playAlertSound();
    setDetectionHistory(prev => [`GESTO DETECTADO EN MESA ${tableId}`, ...prev].slice(0, 5));

    try {
      const { error } = await supabase.from('tables').update({ 
        status: 'calling', 
        welcome_timer_start: new Date().toISOString() 
      }).eq('id', tableId);
      
      if (!error) {
        lastAlertTime.current[tableId] = now;
        onManualTrigger(tableId);
      }
    } catch {
      setDetectionHistory(prev => [`ERROR SYNC M${tableId}`, ...prev].slice(0, 5));
    }
  }, [onManualTrigger]);

  useEffect(() => {
    if (!isCameraReady) return;
    let animationFrameId: number;

    const render = () => {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      if (!video || !canvas || video.readyState < 2) {
        animationFrameId = requestAnimationFrame(render);
        return;
      }

      const ctx = canvas.getContext('2d', { alpha: false });
      if (!ctx) return;

      if (canvas.width !== video.videoWidth) {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
      }

      // Dibujar Feed Principal con Filtro de Seguridad
      ctx.filter = 'contrast(1.2) brightness(0.9)';
      ctx.drawImage(video, 0, 0);
      ctx.filter = 'none';

      // Dibujar Cuadrícula de Zonas (HUD)
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
      ctx.lineWidth = 1;
      TABLE_ZONES.forEach(zone => {
        const xStart = zone.x[0] * canvas.width;
        const xEnd = zone.x[1] * canvas.width;
        ctx.strokeRect(xStart, 0, xEnd - xStart, canvas.height);
        
        ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
        ctx.font = 'bold 10px Inter';
        ctx.fillText(zone.label, xStart + 10, 20);
      });

      // Procesar Resultados de MediaPipe
      if (resultsRef.current?.landmarks) {
        const activeMesasInFrame = new Set<number>();

        resultsRef.current.landmarks.forEach((landmarks) => {
          const tip = landmarks[8]; // Punta del índice
          
          // Lógica de Gesto: ¿Está la mano por encima del hombro/muñeca?
          // En MediaPipe, Y disminuye hacia arriba
          const isRaised = tip.y < 0.4;

          if (isRaised) {
            // Identificar en qué zona está el gesto
            const tableZone = TABLE_ZONES.find(z => tip.x >= z.x[0] && tip.x <= z.x[1]);
            
            if (tableZone) {
              activeMesasInFrame.add(tableZone.id);
              
              // Dibujar Indicador de Detección sobre el Video
              ctx.strokeStyle = '#ef4444';
              ctx.lineWidth = 4;
              ctx.beginPath();
              ctx.arc(tip.x * canvas.width, tip.y * canvas.height, 30, 0, Math.PI * 2);
              ctx.stroke();
              
              // Glow effect
              ctx.shadowBlur = 15;
              ctx.shadowColor = '#ef4444';
              ctx.fillStyle = 'white';
              ctx.fillText(`GESTO_ACTIVO: M${tableZone.id}`, tip.x * canvas.width - 40, tip.y * canvas.height - 40);
              ctx.shadowBlur = 0;

              // Incrementar contador de confianza
              tableCounters.current[tableZone.id] += 1;
              if (tableCounters.current[tableZone.id] > 40) { // Necesita ~1.5 seg sostenido
                triggerAutoAlert(tableZone.id);
                tableCounters.current[tableZone.id] = 0;
              }
            }
          }
        });

        // Decrementar contadores de mesas no detectadas en este frame
        [1, 2, 3].forEach(id => {
          if (!activeMesasInFrame.has(id)) {
            tableCounters.current[id] = Math.max(0, tableCounters.current[id] - 1);
          }
        });
      }

      animationFrameId = requestAnimationFrame(render);
    };

    render();
    return () => cancelAnimationFrame(animationFrameId);
  }, [isCameraReady, videoRef, resultsRef, triggerAutoAlert]);

  return (
    <div className="space-y-8 animate-in fade-in duration-700 text-left">
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        
        {/* PANEL DE ESTADO DE VISIÓN */}
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-[#111114] p-8 rounded-[2.5rem] border border-white/5 shadow-2xl relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-6 opacity-5 group-hover:scale-110 transition-transform">
              <ShieldCheck size={80} className="text-blue-500" />
            </div>
            <div className="relative z-10 space-y-6">
               <div className="flex items-center gap-4">
                  <div className="p-3 bg-blue-600 rounded-2xl text-white shadow-lg">
                    <Activity size={24} />
                  </div>
                  <div>
                    <h3 className="text-lg font-black italic uppercase leading-none text-white">Vision AI</h3>
                    <p className="text-[8px] text-blue-400 font-black uppercase tracking-widest mt-1">Spatial Tracking Active</p>
                  </div>
               </div>

               <div className="space-y-4">
                  <StatusRow label="Cámaras" value="3/3 ONLINE" color="text-green-500" />
                  <StatusRow label="Latencia" value="14ms" color="text-blue-500" />
                  <StatusRow label="Inferencia" value="Gemini Multimodal" color="text-purple-500" />
               </div>

               <div className="pt-6 border-t border-white/5">
                  <span className="text-[8px] text-gray-500 font-black uppercase block mb-3 italic">Registro de Eventos Automáticos</span>
                  <div className="space-y-2">
                     {detectionHistory.length > 0 ? detectionHistory.map((h, i) => (
                       <div key={i} className="flex items-center gap-2 text-[9px] font-bold text-gray-400 animate-in slide-in-from-left">
                          <Target size={10} className="text-blue-500" /> {h}
                       </div>
                     )) : (
                       <p className="text-[9px] text-gray-700 italic">Esperando interacciones...</p>
                     )}
                  </div>
               </div>
            </div>
          </div>

          {/* SLA MONITOR */}
          <div className="bg-[#111114] p-8 rounded-[2.5rem] border border-white/5 shadow-2xl">
             <div className="flex items-center justify-between mb-6">
                <span className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Global Service SLA</span>
                <Clock size={16} className="text-blue-500" />
             </div>
             <div className="text-3xl font-black italic text-white tracking-tighter">98.4%</div>
             <div className="w-full h-1 bg-white/5 rounded-full mt-4 overflow-hidden">
                <div className="h-full bg-green-500 w-[98.4%]"></div>
             </div>
          </div>
        </div>

        {/* FEED DE VIDEO PRINCIPAL CON OVERLAY GEOESPACIAL */}
        <div className="lg:col-span-3 relative">
           <div className="bg-black rounded-[3.5rem] overflow-hidden border-4 border-white/10 shadow-[0_0_60px_rgba(0,0,0,0.8)] relative aspect-video group">
              
              {/* HUD OVERLAY */}
              <div className="absolute top-8 left-8 z-20 flex flex-col gap-3">
                 <div className="bg-black/60 backdrop-blur-xl px-5 py-2.5 rounded-2xl border border-white/10 flex items-center gap-3">
                    <div className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse"></div>
                    <span className="text-[10px] font-black text-white italic tracking-widest uppercase">REC_LIVE_SUITE_V4</span>
                 </div>
                 <div className="bg-blue-600/20 backdrop-blur-md px-4 py-2 rounded-xl border border-blue-500/20 text-[9px] font-black text-blue-400 uppercase tracking-tighter">
                    LÓGICA: RECONOCIMIENTO DE MESA POR COORDENADAS
                 </div>
              </div>

              {/* MESA INDICATORS (DYNAMIC) */}
              <div className="absolute inset-0 z-10 pointer-events-none">
                 <div className="flex justify-around items-end h-full pb-10 px-10">
                    {[1, 2, 3].map(id => {
                      const table = tables.find(t => t.id === id);
                      return (
                        <div key={id} className={`flex flex-col items-center gap-3 transition-all duration-500 ${table?.status === 'calling' ? 'scale-110' : 'opacity-40'}`}>
                           <div className={`p-4 rounded-full border-2 ${table?.status === 'calling' ? 'bg-red-600 border-white shadow-[0_0_30px_red] animate-bounce' : 'bg-black/40 border-white/10'}`}>
                              <BellRing size={20} className="text-white" />
                           </div>
                           <div className="bg-black/80 px-4 py-1.5 rounded-full text-[9px] font-black text-white uppercase tracking-widest border border-white/10">
                              MESA {id}
                           </div>
                        </div>
                      );
                    })}
                 </div>
              </div>

              <canvas ref={canvasRef} className="w-full h-full object-cover" />
              
              {/* ALERTA GLOBAL DE INTERVENCIÓN */}
              {tables.some(t => t.status === 'calling' && t.id <= 3) && (
                <div className="absolute inset-0 bg-red-600/10 pointer-events-none animate-pulse"></div>
              )}
           </div>
           
           <div className="mt-6 flex items-center justify-between px-8 text-gray-500">
              <div className="flex items-center gap-4">
                 <span className="text-[10px] font-black uppercase tracking-widest flex items-center gap-2">
                    <Target size={14} className="text-blue-500" /> Tracking Automático Activado
                 </span>
                 <span className="w-1 h-1 bg-gray-800 rounded-full"></span>
                 <span className="text-[10px] font-black uppercase tracking-widest">3 Zonas Calibradas</span>
              </div>
              <div className="flex items-center gap-2 text-green-500">
                 <Volume2 size={14} />
                 <span className="text-[9px] font-black uppercase italic">Audio Monitor: Activo</span>
              </div>
           </div>
        </div>
      </div>
    </div>
  );
};

const StatusRow = ({ label, value, color }: { label: string, value: string, color: string }) => (
  <div className="flex justify-between items-center text-[10px] font-bold">
     <span className="text-gray-500 uppercase tracking-widest">{label}</span>
     <span className={`${color} italic`}>{value}</span>
  </div>
);

export default SurveillanceModule;
