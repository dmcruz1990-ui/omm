
import React, { useState, useEffect } from 'react';
import { 
  X, 
  TrendingUp, 
  BarChart3, 
  Zap, 
  Target, 
  ShieldCheck, 
  DollarSign, 
  Users, 
  ArrowUpRight, 
  ArrowDownRight, 
  BrainCircuit,
  PieChart,
  Activity,
  Sparkles,
  Flame,
  Globe,
  Loader2
} from 'lucide-react';
import { GoogleGenAI } from "@google/genai";
import { supabase } from '../lib/supabase.ts';

interface ExecutiveCockpitProps {
  isOpen: boolean;
  onClose: () => void;
}

const ExecutiveCockpit: React.FC<ExecutiveCockpitProps> = ({ isOpen, onClose }) => {
  const [loading, setLoading] = useState(true);
  const [aiInsight, setAiInsight] = useState<string | null>(null);
  const [isThinking, setIsThinking] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => setLoading(false), 1200);
      generateStrategicBrief();
    }
  }, [isOpen]);

  const generateStrategicBrief = async () => {
    setIsThinking(true);
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    try {
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: `Eres el CFO Estratégico de Grupo Seratta. 
        KPIs Actuales: Ventas $124M, Labor Cost 28.4% (Eficiente), COGS 32%, EBITDA 21.7%. 
        El ratio de servicio en Fine Dining está en 1:12 (Levemente sub-dimensionado).
        Genera un 'Strategic Brief' de 2 párrafos sobre la salud de la empresa y una recomendación para maximizar el margen este fin de semana.`,
      });
      setAiInsight(response.text || "");
    } catch (e) {
      setAiInsight("Análisis resumido: La operación mantiene un EBITDA saludable por encima del 20%. Se recomienda optimizar el inventario de cava para el evento del viernes.");
    } finally {
      setIsThinking(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[1000] bg-black/60 backdrop-blur-2xl animate-in fade-in duration-500 flex items-center justify-center p-4 md:p-12">
      <div className="bg-[#0a0a0c]/90 border border-white/10 w-full h-full rounded-[4rem] shadow-[0_0_100px_rgba(0,0,0,0.5)] flex flex-col overflow-hidden relative">
        
        {/* Decoración de Fondo */}
        <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-blue-600/10 blur-[150px] rounded-full -mr-40 -mt-40"></div>
        <div className="absolute bottom-0 left-0 w-[300px] h-[300px] bg-purple-600/5 blur-[120px] rounded-full -ml-20 -mb-20"></div>

        {/* Header del Cockpit */}
        <header className="p-10 border-b border-white/5 flex justify-between items-center bg-white/[0.02] relative z-10">
          <div className="flex items-center gap-6">
            <div className="p-4 bg-gradient-to-br from-blue-600 to-blue-400 rounded-3xl shadow-xl shadow-blue-600/20">
               <Globe className="text-white" size={32} />
            </div>
            <div>
               <h2 className="text-4xl font-black italic tracking-tighter uppercase leading-none text-white">Executive Cockpit</h2>
               <p className="text-[10px] text-gray-500 font-black uppercase tracking-[0.5em] mt-3 flex items-center gap-2 italic">
                  <ShieldCheck size={14} className="text-blue-500" /> Nexum Business Intelligence Core V4
               </p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="w-14 h-14 bg-white/5 hover:bg-red-600 text-white rounded-2xl flex items-center justify-center transition-all group"
          >
            <X size={24} className="group-hover:rotate-90 transition-transform" />
          </button>
        </header>

        {/* Main Content */}
        <div className="flex-1 overflow-y-auto custom-scrollbar p-10 md:p-16 relative z-10">
          {loading ? (
            <div className="h-full flex flex-col items-center justify-center space-y-6 opacity-40">
               <Loader2 className="animate-spin text-blue-500" size={64} />
               <p className="text-xl font-black uppercase tracking-[0.4em] italic">Decodificando Rendimiento Global...</p>
            </div>
          ) : (
            <div className="space-y-16 animate-in slide-in-from-bottom-4 duration-700">
               
               {/* 1. Fila de KPIs de Alto Impacto */}
               <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
                  <KPIMiniCard label="VENTA NETA MES" value="$1.24B" trend="+12.4%" positive icon={<DollarSign size={20} />} />
                  <KPIMiniCard label="EBITDA ACUMULADO" value="21.7%" trend="+2.1%" positive icon={<PieChart size={20} />} />
                  <KPIMiniCard label="LABOR COST RATIO" value="28.4%" trend="-1.2%" positive icon={<Users size={20} />} />
                  <KPIMiniCard label="GUEST SATISFACTION" value="4.82/5" trend="-0.02" icon={<Target size={20} />} />
               </div>

               <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
                  
                  {/* 2. Radar de Eficiencia (Capa Operativa vs Financiera) */}
                  <div className="lg:col-span-8 bg-[#111114] border border-white/5 p-12 rounded-[4rem] shadow-2xl relative overflow-hidden group">
                     <div className="absolute top-0 right-0 p-12 opacity-5 group-hover:scale-110 transition-transform duration-700">
                        <Activity size={180} className="text-blue-500" />
                     </div>
                     <div className="relative z-10 space-y-10">
                        <div className="flex items-center justify-between border-b border-white/5 pb-8">
                           <div>
                              <h3 className="text-2xl font-black italic uppercase tracking-tighter">Real-Time Yield Efficiency</h3>
                              <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest mt-2">Cruce de Tráfico vs Nómina vs COGS</p>
                           </div>
                           <div className="flex gap-4">
                              <span className="bg-green-500/10 text-green-500 text-[8px] font-black px-3 py-1.5 rounded-full border border-green-500/20 uppercase">ÓPTIMO</span>
                           </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-12">
                           <YieldMetric label="Margen Bruto" value={68} target={65} suffix="%" />
                           <YieldMetric label="Carga de Nómina" value={28.4} target={32} suffix="%" isInverse />
                           <YieldMetric label="Ocupación Prom." value={84} target={75} suffix="%" />
                        </div>

                        <div className="bg-black/40 p-8 rounded-3xl border border-white/5">
                           <h4 className="text-[9px] font-black text-gray-600 uppercase tracking-[0.3em] mb-4">Análisis de Estructura (Regla 1:10)</h4>
                           <div className="flex items-center gap-6">
                              <div className="flex-1 h-3 bg-white/5 rounded-full overflow-hidden flex">
                                 <div className="h-full bg-blue-600 w-[90%] shadow-[0_0_15px_rgba(37,99,235,0.4)]"></div>
                              </div>
                              <span className="text-xs font-black italic text-white">90% EFICIENCIA</span>
                           </div>
                           <p className="text-[10px] text-gray-500 mt-4 italic">El staff está operando en el sweet spot de rentabilidad sin degradar el ritual de servicio.</p>
                        </div>
                     </div>
                  </div>

                  {/* 3. Strategic AI Advisor Sideboard */}
                  <div className="lg:col-span-4 space-y-8">
                     <div className="bg-blue-600 p-10 rounded-[4rem] shadow-2xl relative overflow-hidden group">
                        <div className="absolute top-0 right-0 p-8 opacity-10 group-hover:scale-110 transition-transform">
                           <Sparkles size={120} fill="white" />
                        </div>
                        <div className="relative z-10 space-y-6">
                           <div className="flex items-center gap-3">
                              <BrainCircuit size={24} className="text-white" />
                              <h4 className="text-xs font-black text-white/80 uppercase tracking-widest italic">CFO Strategic Agent</h4>
                           </div>
                           
                           {isThinking ? (
                             <div className="py-10 flex justify-center">
                                <Loader2 className="animate-spin text-white" size={32} />
                             </div>
                           ) : (
                             <p className="text-sm text-white italic font-medium leading-relaxed">
                                {aiInsight || "Analizando variables de mercado y rendimiento interno..."}
                             </p>
                           )}

                           <button 
                            onClick={generateStrategicBrief}
                            className="w-full bg-white text-blue-600 py-4 rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-xl hover:bg-blue-50 transition-all"
                           >
                              REFRESCAR ANÁLISIS
                           </button>
                        </div>
                     </div>

                     <div className="bg-[#111114] border border-white/5 p-8 rounded-[3rem] shadow-2xl">
                        <h4 className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-6 italic">COGS Watchlist</h4>
                        <div className="space-y-4">
                           <RiskItem label="Salmón Noruego" impact="+12%" risk="high" />
                           <RiskItem label="Aceite Trufado" impact="+4.5%" risk="medium" />
                           <RiskItem label="Vino Reserva OMM" impact="-2.1%" risk="low" />
                        </div>
                     </div>
                  </div>
               </div>
            </div>
          )}
        </div>

        {/* Footer con Quick Actions */}
        <footer className="p-8 border-t border-white/5 bg-white/[0.01] flex justify-between items-center relative z-10">
           <div className="flex gap-4">
              <button className="bg-white/5 hover:bg-white/10 text-white px-8 py-3 rounded-xl text-[9px] font-black uppercase tracking-widest border border-white/5 transition-all">Exportar Board</button>
              <button className="bg-white/5 hover:bg-white/10 text-white px-8 py-3 rounded-xl text-[9px] font-black uppercase tracking-widest border border-white/5 transition-all">Ver Auditoría Fiscal</button>
           </div>
           <div className="flex items-center gap-3">
              <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
              <span className="text-[10px] font-black text-gray-600 uppercase tracking-widest italic">NEXUM_FINANCE_LINK_ESTABLISHED</span>
           </div>
        </footer>
      </div>
    </div>
  );
};

const KPIMiniCard = ({ label, value, trend, positive, icon }: any) => (
  <div className="bg-[#111114] border border-white/5 p-8 rounded-[2.5rem] shadow-xl hover:border-blue-500/20 transition-all group">
     <div className="flex justify-between items-start mb-6">
        <div className="p-3 bg-white/5 rounded-2xl text-blue-500 group-hover:bg-blue-600 group-hover:text-white transition-all">
           {icon}
        </div>
        <div className={`flex items-center gap-1 text-[10px] font-black ${positive ? 'text-green-500' : 'text-red-500'}`}>
           {positive ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
           {trend}
        </div>
     </div>
     <span className="text-[9px] text-gray-500 font-black uppercase tracking-widest block mb-1 leading-none">{label}</span>
     <span className="text-3xl font-black italic text-white tracking-tighter leading-none">{value}</span>
  </div>
);

const YieldMetric = ({ label, value, target, suffix, isInverse }: any) => {
  const isBetter = isInverse ? value < target : value > target;
  return (
    <div className="text-center space-y-2">
       <span className="text-[10px] text-gray-600 font-black uppercase tracking-widest block">{label}</span>
       <div className={`text-4xl font-black italic tracking-tighter ${isBetter ? 'text-green-500' : 'text-orange-500'}`}>
          {value}{suffix}
       </div>
       <span className="text-[8px] text-gray-700 font-bold uppercase block italic">Target: {target}{suffix}</span>
    </div>
  );
};

const RiskItem = ({ label, impact, risk }: any) => (
  <div className="flex justify-between items-center">
     <span className="text-xs font-bold text-gray-400 uppercase italic">{label}</span>
     <div className="flex items-center gap-3">
        <span className={`text-[10px] font-black ${risk === 'high' ? 'text-red-500' : risk === 'medium' ? 'text-orange-500' : 'text-green-500'}`}>
           {impact}
        </span>
        <div className={`w-1.5 h-1.5 rounded-full ${risk === 'high' ? 'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.6)]' : risk === 'medium' ? 'bg-orange-500' : 'bg-green-500'}`}></div>
     </div>
  </div>
);

const TrendingDown = ({ size }: any) => (
  <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 18 13.5 8.5 8.5 13.5 1 6"/><polyline points="17 18 23 18 23 12"/></svg>
);

export default ExecutiveCockpit;
