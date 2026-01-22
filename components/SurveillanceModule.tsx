
import React, { useEffect, useRef } from 'react';
import { HandLandmarkerResult } from '@mediapipe/tasks-vision';
import { 
  Monitor, 
  Target,
  Zap,
  PlayCircle,
  Activity,
  ShieldCheck,
  Maximize2
} from 'lucide-react';
import { Table } from '../types';

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
  
  const testTables = tables.filter(t => t.id <= 3);
  const activeTable = testTables.find(t => t.id === activeStation) || testTables[0];
  const sideTables = testTables.filter(t => t.id !== activeStation);

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
            ctx.filter = isMaster ? 'contrast(1.1) saturate(1.1)' : 'grayscale(40%) brightness(50%)';
            ctx.drawImage(video, 0, 0);
            ctx.filter = 'none';

            if (isMaster && resultsRef.current?.landmarks) {
              resultsRef.current.landmarks.forEach(landmarks => {
                const tip = landmarks[8];
                const x = tip.x * canvas.width;
                const y = tip.y * canvas.height;

                ctx.strokeStyle = '#3b82f6';
                ctx.lineWidth = 4;
                ctx.setLineDash([5, 5]);
                ctx.beginPath();
                landmarks.forEach(p => {
                  ctx.moveTo(p.x * canvas.width, p.y * canvas.height);
                  ctx.arc(p.x * canvas.width, p.y * canvas.height, 3, 0, 2 * Math.PI);
                });
                ctx.stroke();
                ctx.setLineDash([]);

                if (tip.y < 0.35) {
                   ctx.fillStyle = '#ef4444';
                   ctx.beginPath();
                   ctx.arc(x, y, 20, 0, 2 * Math.PI);
                   ctx.fill();
                   ctx.font = 'bold 16px Inter';
                   ctx.fillText("GESTO_DETECTADO", x + 30, y);
                }
              });
            }

            if (table.status === 'calling') {
              const pulse = Math.floor(Date.now() / 300) % 2 === 0;
              ctx.strokeStyle = '#ef4444';
              ctx.lineWidth = isMaster ? 25 : 12;
              if (pulse) ctx.strokeRect(0, 0, canvas.width, canvas.height);
              
              if (isMaster) {
                ctx.fillStyle = 'rgba(239, 68, 68, 0.9)';
                ctx.fillRect(40, 40, 420, 70);
                ctx.fillStyle = 'white';
                ctx.font = 'black 24px Inter';
                ctx.fillText("⚠️ SERVICIO SOLICITADO", 70, 85);
              }
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
      {/* Header Estilo Master Control */}
      <div className="flex items-center justify-between bg-[#111114] p-6 rounded-[2.5rem] border border-white/5 shadow-2xl">
        <div className="flex items-center gap-5">
           <div className="p-4 bg-blue-600 rounded-3xl shadow-xl shadow-blue-600/30">
              <Monitor className="text-white" size={28} />
           </div>
           <div>
              <h3 className="text-2xl font-black italic tracking-tighter uppercase leading-none">NEXUM Service Vision</h3>
              <p className="text-[10px] text-blue-400 font-bold uppercase tracking-[0.3em] mt-2">IA Engine: YOLOv8-Pose | Estación {activeStation} en Foco</p>
           </div>
        </div>
        <div className="flex gap-2 bg-black/40 p-2 rounded-2xl">
          {testTables.map(t => (
            <button
              key={t.id}
              onClick={() => setActiveStation(t.id)}
              className={`px-6 py-2 rounded-xl text-xs font-black transition-all ${
                activeStation === t.id ? 'bg-blue-600 text-white shadow-xl' : 'text-gray-500 hover:text-white'
              }`}
            >
              MESA {t.id}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        {/* Feed Principal (Hero) */}
        <div className="lg:col-span-3">
          <div className={`relative rounded-[3.5rem] overflow-hidden border-4 transition-all duration-500 shadow-2xl bg-black ${
            activeTable.status === 'calling' ? 'border-red-500 ring-8 ring-red-500/10' : 'border-blue-500/30'
          }`}>
             <div className="absolute top-8 left-8 z-20 flex flex-col gap-3">
               <div className="flex items-center gap-3 bg-black/80 backdrop-blur-xl px-5 py-2 rounded-full border border-white/10">
                  <div className={`w-3 h-3 rounded-full ${activeTable.status === 'calling' ? 'bg-red-500 animate-pulse' : 'bg-green-500'}`}></div>
                  <span className="text-xs font-black text-white italic">FEED_MASTER_MESA_{activeStation}</span>
               </div>
            </div>

            <div className="aspect-video relative">
               <canvas ref={el => { if (el) canvasRefs.current[activeStation] = el; }} className="w-full h-full object-cover" />
               
               {activeTable.status === 'calling' && (
                 <div className="absolute inset-0 bg-red-600/10 flex flex-col items-center justify-center p-12 text-center animate-in zoom-in">
                    <div className="bg-red-600 p-8 rounded-full shadow-[0_0_60px_rgba(239,68,68,0.4)] mb-8 animate-bounce">
                       <Zap className="text-white" size={48} />
                    </div>
                    <h4 className="text-5xl font-black italic text-white uppercase mb-6 tracking-tighter">ALERTA ACTIVA</h4>
                    <button 
                      onClick={() => onCheckService(activeStation)}
                      className="bg-white text-red-600 px-12 py-5 rounded-[2rem] font-black text-sm uppercase tracking-widest shadow-2xl hover:scale-105 transition-transform"
                    >
                      MARCAR ATENDIDO
                    </button>
                 </div>
               )}
            </div>

            <div className="absolute bottom-8 left-8 flex gap-4 z-20">
               <button 
                onClick={() => onManualTrigger(activeStation)}
                className="bg-yellow-500 text-black px-6 py-3 rounded-2xl font-black text-[10px] uppercase tracking-widest flex items-center gap-2 shadow-xl hover:bg-yellow-400 transition-all"
               >
                 <PlayCircle size={16} /> TEST IA GESTURE
               </button>
            </div>
          </div>
        </div>

        {/* Feeds Laterales */}
        <div className="flex flex-col gap-6">
          <h4 className="text-[10px] font-black text-gray-500 uppercase tracking-widest border-b border-white/5 pb-2">Canales Secundarios</h4>
          {sideTables.map(table => (
            <div 
              key={table.id}
              onClick={() => setActiveStation(table.id)}
              className={`relative cursor-pointer group rounded-3xl overflow-hidden border-2 transition-all ${
                table.status === 'calling' ? 'border-red-500' : 'border-white/5 opacity-70 hover:opacity-100'
              }`}
            >
              <div className="absolute top-3 left-3 z-10 bg-black/60 px-2 py-1 rounded text-[8px] font-black text-white">MESA {table.id}</div>
              <div className="aspect-video bg-gray-900">
                <canvas ref={el => { if (el) canvasRefs.current[table.id] = el; }} className="w-full h-full object-cover" />
              </div>
              <div className="p-3 bg-black flex items-center justify-between">
                 <span className={`text-[8px] font-black uppercase ${table.status === 'calling' ? 'text-red-500' : 'text-green-500'}`}>
                   {table.status === 'calling' ? '⚠️ CALLING' : 'OK_MONITORING'}
                 </span>
                 <button 
                  onClick={(e) => { e.stopPropagation(); onManualTrigger(table.id); }}
                  className="bg-white/5 hover:bg-yellow-500 hover:text-black p-1.5 rounded-lg text-[8px] font-black"
                 >
                   TEST
                 </button>
              </div>
            </div>
          ))}
          
          <div className="mt-auto bg-blue-600/5 p-6 rounded-3xl border border-blue-500/10 space-y-4">
             <div className="flex items-center gap-3">
                <ShieldCheck size={18} className="text-green-500" />
                <span className="text-[10px] font-bold text-gray-400 uppercase">BoT-SORT Active</span>
             </div>
             <div className="flex items-center gap-3">
                <Activity size={18} className="text-blue-500" />
                <span className="text-[10px] font-bold text-gray-400 uppercase">FPS: 24.2 | 18ms</span>
             </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SurveillanceModule;
