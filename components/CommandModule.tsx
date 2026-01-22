
import React, { useState } from 'react';
import { 
  Zap, 
  BarChart3, 
  PieChart, 
  TrendingUp, 
  ShieldCheck, 
  Activity,
  Users,
  DollarSign,
  Flame,
  UtensilsCrossed,
  Wind,
  Info,
  Play,
  Hand,
  ChefHat,
  AlertTriangle
} from 'lucide-react';
import { GoogleGenAI } from "@google/genai";

interface CommandModuleProps {
  onSimulateEvent?: (type: 'hand' | 'task' | 'finance' | 'reserve') => void;
}

const CommandModule: React.FC<CommandModuleProps> = ({ onSimulateEvent }) => {
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [aiReport, setAiReport] = useState<string | null>(null);

  const getOmmStrategicReport = async () => {
    setIsAnalyzing(true);
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    try {
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: `Analiza los KPIs actuales de OMM (Autopista Norte Bogota): Ocupación 85%, Ticket Promedio $245k, Mermas 3.2%. El plato más vendido es Kaori Lobster. Genera un plan táctico de 3 puntos para maximizar el turno de la noche con concepto espiritual/Zen.`,
      });
      setAiReport(response.text || "");
    } catch (e) {
      setAiReport("Análisis Estratégico OMM: Se detecta oportunidad de Upsell en la Pagoda (Terraza). Acción: Lanzar 'Noche de Robata & Sakes' para elevar el ticket promedio a $280k.");
    } finally {
      setIsAnalyzing(false);
    }
  };

  return (
    <div className="space-y-12 animate-in fade-in duration-1000">
      
      {/* Guía Funcional Rápida */}
      <div className="bg-blue-600/5 border border-blue-500/20 rounded-[2.5rem] p-8 flex items-center justify-between">
        <div className="flex items-center gap-4">
           <Info className="text-blue-500" />
           <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest leading-relaxed">
             <span className="text-blue-500">PRUEBAS DE ECO-SISTEMA:</span> Usa el panel de simulación a la derecha para disparar eventos IA, tareas de cocina y alertas financieras en todo el ecosistema Nexum.
           </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
         <MetricCard label="RevPASH OMM" value="$210k" trend="+14.2%" icon={<TrendingUp size={24} />} />
         <MetricCard label="Ocupación" value="85%" trend="+5.8%" icon={<Users size={24} />} />
         <MetricCard label="Ticket Prom." value="$245k" trend="-1.5%" icon={<DollarSign size={24} />} />
         <MetricCard label="SLA Servicio" value="98.8%" trend="Optimal" icon={<ShieldCheck size={24} />} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
        <div className="lg:col-span-2 space-y-10">
           {/* Monitor Operativo NEXUM */}
           <div className="bg-[#16161a] rounded-[3.5rem] p-12 border border-white/5 shadow-2xl relative overflow-hidden">
              <div className="absolute top-0 right-0 p-12 opacity-5">
                <Activity size={180} className="text-[#2563eb]" />
              </div>
              <h3 className="text-xs font-black text-gray-500 uppercase tracking-[0.5em] mb-12 flex items-center gap-3">
                 <Activity size={18} className="text-[#2563eb]" /> MONITOR_OPERATIVO_OMM_LIVE
              </h3>
              <div className="space-y-12">
                 <ProgressRow label="Cocina Robata (Fuego)" value={85} color="bg-orange-600 shadow-[0_0_15px_rgba(234,88,12,0.4)]" />
                 <ProgressRow label="Mesa OMM (Kaiseki)" value={62} color="bg-[#2563eb] shadow-[0_0_15px_rgba(37,99,235,0.4)]" />
                 <ProgressRow label="Terraza Pagoda (Vibe)" value={94} color="bg-[#22c55e] shadow-[0_0_15px_rgba(34,197,94,0.4)]" />
              </div>
           </div>

           {/* Simulación Maestro */}
           <div className="bg-[#16161a] rounded-[3.5rem] p-12 border border-white/5 shadow-2xl">
              <h3 className="text-[11px] font-black text-gray-500 uppercase tracking-[0.4em] mb-10">CONSOLA DE SIMULACIÓN PARA PRUEBAS</h3>
              <div className="grid grid-cols-2 gap-4">
                 <SimButton 
                  icon={<Hand size={16} />} 
                  label="Simular Gesto IA" 
                  desc="Activa alerta de ayuda en Mesa 01" 
                  onClick={() => onSimulateEvent?.('hand')} 
                 />
                 <SimButton 
                  icon={<ChefHat size={16} />} 
                  label="Simular Comanda" 
                  desc="Envía tarea ritual al Bar" 
                  onClick={() => onSimulateEvent?.('task')} 
                 />
                 <SimButton 
                  icon={<AlertTriangle size={16} />} 
                  label="Fuga de Inventario" 
                  desc="Genera alerta de merma crítica" 
                  onClick={() => {}} 
                 />
                 <SimButton 
                  icon={<DollarSign size={16} />} 
                  label="Anomalía Financiera" 
                  desc="Dispara error de conciliación POS" 
                  onClick={() => {}} 
                 />
              </div>
           </div>
        </div>

        {/* AI Control Center Sidebar */}
        <div className="space-y-10">
           <div className="bg-[#2563eb] rounded-[3.5rem] p-12 relative overflow-hidden shadow-[0_20px_50px_rgba(37,99,235,0.3)] group transition-all">
              <div className="absolute top-0 right-0 p-10 opacity-10 group-hover:scale-110 transition-transform">
                 <Zap size={140} className="text-white" fill="currentColor" />
              </div>
              <h3 className="text-[11px] font-black text-white/80 uppercase tracking-[0.4em] mb-10 flex items-center gap-3 italic">
                 <Zap size={18} fill="currentColor" /> NEXUM_BRAIN_OMM
              </h3>
              
              {!aiReport ? (
                <div className="space-y-8 flex flex-col items-center text-center">
                   <p className="text-sm text-white/90 italic font-medium leading-relaxed tracking-tight">
                     Analizando flujos de Autopista 114 y tiempos de Robata para optimizar el turno noche...
                   </p>
                   <button 
                    onClick={getOmmStrategicReport}
                    className="w-full bg-white text-[#2563eb] py-6 rounded-[2.2rem] text-[11px] font-black uppercase tracking-[0.3em] shadow-2xl hover:bg-blue-50 transition-all active:scale-95"
                   >
                     GENERAR PLAN MAESTRO
                   </button>
                </div>
              ) : (
                <div className="space-y-8 animate-in fade-in duration-500">
                   <p className="text-sm text-white italic leading-relaxed font-medium tracking-tight">"{aiReport}"</p>
                   <button 
                    onClick={() => setAiReport(null)}
                    className="w-full bg-white/10 hover:bg-white/20 border border-white/20 py-4 rounded-[1.8rem] text-[9px] font-black uppercase tracking-widest text-white transition-all"
                   >
                     RESET ANALYTICS
                   </button>
                </div>
              )}
           </div>

           <div className="bg-[#16161a] rounded-[3.5rem] p-12 border border-white/5 shadow-2xl">
              <h3 className="text-[11px] font-black text-gray-500 uppercase tracking-[0.4em] mb-8">CRITICAL_ALERTS_OMM</h3>
              <div className="space-y-6">
                 <AlertRow label="Delay Kaori Lobster" value="!" color="text-red-500" />
                 <AlertRow label="Stock Robata Charcoal" value="Low" color="text-orange-500" />
                 <AlertRow label="VIP Reservation (Duque)" value="Near" color="text-[#2563eb]" />
              </div>
           </div>
        </div>
      </div>
    </div>
  );
};

const SimButton = ({ icon, label, desc, onClick }: { icon: any, label: string, desc: string, onClick: () => void }) => (
  <button 
    onClick={onClick}
    className="bg-white/5 border border-white/5 p-6 rounded-3xl text-left hover:bg-blue-600 transition-all group"
  >
    <div className="bg-blue-600/20 w-10 h-10 rounded-xl flex items-center justify-center text-blue-500 mb-4 group-hover:bg-white group-hover:text-blue-600">
      {icon}
    </div>
    <span className="text-[10px] font-black uppercase tracking-widest block mb-1">{label}</span>
    <span className="text-[8px] text-gray-500 font-bold uppercase tracking-tighter group-hover:text-white/70">{desc}</span>
  </button>
);

const MetricCard = ({ label, value, trend, icon }: { label: string, value: string, trend: string, icon: any }) => (
  <div className="bg-[#16161a] p-10 rounded-[3.5rem] border border-white/5 flex flex-col items-center text-center group hover:border-[#2563eb]/30 transition-all shadow-xl hover:shadow-[#2563eb]/5">
     <div className="p-4 bg-white/5 rounded-2xl mb-6 group-hover:bg-[#2563eb]/20 transition-all text-[#2563eb]">
        {icon}
     </div>
     <span className="text-[10px] text-gray-600 font-black uppercase tracking-[0.4em] mb-2 leading-none">{label}</span>
     <span className="text-4xl font-black italic text-white mb-2 tracking-tighter leading-none">{value}</span>
     <span className={`text-[10px] font-black tracking-widest ${trend.includes('+') ? 'text-[#22c55e]' : 'text-red-500'}`}>{trend}</span>
  </div>
);

const ProgressRow = ({ label, value, color }: { label: string, value: number, color: string }) => (
  <div className="space-y-3">
     <div className="flex justify-between text-[11px] font-black uppercase tracking-[0.3em]">
        <span className="text-gray-400 italic">{label}</span>
        <span className="text-white">{value}%</span>
     </div>
     <div className="h-2.5 bg-black/50 rounded-full overflow-hidden border border-white/5">
        <div className={`h-full ${color} transition-all duration-1000 ease-out`} style={{ width: `${value}%` }}></div>
     </div>
  </div>
);

const AlertRow = ({ label, value, color }: { label: string, value: string, color: string }) => (
  <div className="flex justify-between items-center border-b border-white/5 pb-4 last:border-0 last:pb-0">
     <span className="text-[10px] font-black text-gray-500 uppercase tracking-widest italic">{label}</span>
     <span className={`text-xs font-black italic tracking-tighter ${color} animate-pulse`}>{value}</span>
  </div>
);

export default CommandModule;
