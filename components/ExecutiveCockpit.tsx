
import React, { useState, useEffect } from 'react';
import { 
  X, 
  TrendingUp, 
  Zap, 
  ShieldCheck, 
  ArrowDownRight, 
  BrainCircuit,
  PieChart,
  Activity,
  Sparkles,
  Flame,
  Loader2,
  CalendarDays,
  Clock,
  UserCheck,
  // Added missing Star icon import
  Star
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
  const [flowItems, setFlowItems] = useState<any[]>([]);
  const [now, setNow] = useState(Date.now());

  // Top 3 Waiters (Mock Data for this view)
  const topWaiters = [
    { name: "Juan Pérez", efficiency: 98, avgTicket: 340000, img: "https://i.pravatar.cc/150?u=juan" },
    { name: "María López", efficiency: 94, avgTicket: 312000, img: "https://i.pravatar.cc/150?u=maria" },
    { name: "Valentina Gomez", efficiency: 91, avgTicket: 295000, img: "https://i.pravatar.cc/150?u=val" }
  ];

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => setLoading(false), 1200);
      generateStrategicBrief();
      fetchLiveFlow();
      
      const interval = setInterval(() => setNow(Date.now()), 1000);
      
      const channel = supabase.channel('copilot-flow-sync')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'order_items' }, () => fetchLiveFlow())
        .subscribe();

      return () => {
        clearInterval(interval);
        supabase.removeChannel(channel);
      };
    }
  }, [isOpen]);

  const fetchLiveFlow = async () => {
    try {
      const { data: ordersData } = await supabase.from('orders').select('id, table_id').eq('status', 'open');
      if (!ordersData || ordersData.length === 0) {
        setFlowItems([]);
        return;
      }
      const orderIds = ordersData.map(o => o.id);
      const { data: itemsData } = await supabase
        .from('order_items')
        .select('*, menu_items(name, category)')
        .in('order_id', orderIds)
        .neq('status', 'served')
        .order('created_at', { ascending: false })
        .limit(5);

      if (itemsData) {
        const enriched = itemsData.map(item => ({
          ...item,
          table_id: ordersData.find(o => o.id === item.order_id)?.table_id
        }));
        setFlowItems(enriched);
      }
    } catch { console.warn("Flow Sync Error"); }
  };

  const generateStrategicBrief = async () => {
    setIsThinking(true);
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    try {
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: `Eres el NEXUM COPILOT Estratégico de Grupo Seratta. 
        DATOS REAL-TIME PARA EL INFORME:
        - Venta de Hoy: $12.4M COP
        - Venta Mes Actual (Acumulada): $124M COP
        - Venta Mes Anterior (Cierre): $118M COP (+5.1% Crecimiento intermensual)
        - Reservas de Hoy: 42 mesas confirmadas (Ocupación proyectada: 85%)
        - Top Waiter: Juan Pérez (98% Eficiencia, Ticket $340k)
        - Labor Cost: 28.4% (Eficiencia Alta)
        - COGS: 32% (Dentro de rango)
        - EBITDA: 21.7% (Saludable)
        
        Genera un 'Strategic Brief' de 2 párrafos que analice el crecimiento vs el mes anterior, el impacto de las 42 reservas y resalte la eficiencia operativa del staff de meseros liderado por Juan Pérez.`,
      });
      setAiInsight(response.text || "");
    } catch {
      setAiInsight("Análisis resumido: La operación registra un crecimiento del 5.1% vs mes anterior. Con 42 reservas hoy y un staff operando al 98% de eficiencia (liderado por Juan Pérez), se proyecta un cierre de turno exitoso.");
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
               <BrainCircuit className="text-white" size={32} />
            </div>
            <div>
               <h2 className="text-4xl font-black italic tracking-tighter uppercase leading-none text-white">Nexum <span className="text-blue-500">Copilot</span></h2>
               <p className="text-[10px] text-gray-500 font-black uppercase tracking-[0.5em] mt-3 flex items-center gap-2 italic">
                  <ShieldCheck size={14} className="text-blue-500" /> Strategic Business Intelligence Node V4
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
        <div className="flex-1 overflow-y-auto custom-scrollbar p-10 md:p-16 relative z-10 text-left">
          {loading ? (
            <div className="h-full flex flex-col items-center justify-center space-y-6 opacity-40">
               <Loader2 className="animate-spin text-blue-500" size={64} />
               <p className="text-xl font-black uppercase tracking-[0.4em] italic">Decodificando Rendimiento Global...</p>
            </div>
          ) : (
            <div className="space-y-16 animate-in slide-in-from-bottom-4 duration-700">
               
               {/* 1. Fila de KPIs de Alto Impacto */}
               <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
                  <KPIMiniCard label="VENTA HOY (LIVE)" value="$12.4M" trend="+8.2%" positive icon={<Zap size={20} />} />
                  <KPIMiniCard label="RESERVAS HOY" value="42 mesas" trend="High Vol" positive icon={<CalendarDays size={20} />} />
                  <KPIMiniCard label="VS MES ANTERIOR" value="+5.1%" trend="Growth" positive icon={<TrendingUp size={20} />} />
                  <KPIMiniCard label="EBITDA ACUM." value="21.7%" trend="Optimal" positive icon={<PieChart size={20} />} />
               </div>

               <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
                  
                  {/* 2. Radar de Eficiencia y Crecimiento */}
                  <div className="lg:col-span-8 space-y-10">
                    <div className="bg-[#111114] border border-white/5 p-12 rounded-[4rem] shadow-2xl relative overflow-hidden group">
                       <div className="absolute top-0 right-0 p-12 opacity-5 group-hover:scale-110 transition-transform duration-700">
                          <Activity size={180} className="text-blue-500" />
                       </div>
                       <div className="relative z-10 space-y-10">
                          <div className="flex items-center justify-between border-b border-white/5 pb-8">
                             <div>
                                <h3 className="text-2xl font-black italic uppercase tracking-tighter text-white">Live Intelligence Report</h3>
                                <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest mt-2">Cruce de Tráfico vs Nómina vs Mes Anterior</p>
                             </div>
                             <span className="bg-blue-600/10 text-blue-500 text-[8px] font-black px-3 py-1.5 rounded-full border border-blue-500/20 uppercase">COPILOT_ACTIVE</span>
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-3 gap-12 text-center">
                             <YieldMetric label="Venta Mes (Acum)" value={124} target={118} suffix="M" isGrowth />
                             <YieldMetric label="Eficiencia Laboral" value={28.4} target={32} suffix="%" isInverse />
                             <YieldMetric label="Conversión Reservas" value={92} target={85} suffix="%" />
                          </div>

                          <div className="bg-black/40 p-8 rounded-3xl border border-white/5">
                             <h4 className="text-[9px] font-black text-gray-600 uppercase tracking-[0.3em] mb-4">Análisis de Crecimiento Mensual</h4>
                             <div className="flex items-center gap-6">
                                <div className="flex-1 h-3 bg-white/5 rounded-full overflow-hidden flex">
                                   <div className="h-full bg-blue-600 w-[75%] shadow-[0_0_15px_rgba(37,99,235,0.4)]"></div>
                                </div>
                                <span className="text-xs font-black italic text-white">+5.1% VS FEB</span>
                             </div>
                             <p className="text-[10px] text-gray-500 mt-4 italic">El volumen de facturación actual ($124M) supera el cierre del mes anterior ($118M).</p>
                          </div>
                       </div>
                    </div>

                    {/* 4. Monitor de Flujo Live (Modulo Flow en Copilot) */}
                    <div className="bg-[#111114] border border-white/5 p-12 rounded-[4rem] shadow-2xl relative overflow-hidden">
                       <div className="flex items-center justify-between mb-10 border-b border-white/5 pb-8">
                          <div className="flex items-center gap-4">
                             <div className="p-3 bg-orange-600/20 rounded-2xl text-orange-500"><Flame size={24} /></div>
                             <div>
                                <h3 className="text-2xl font-black italic uppercase tracking-tighter text-white">Live Preparation Flow</h3>
                                <p className="text-[9px] text-gray-500 font-bold uppercase tracking-widest mt-1 italic">Sincronización con Módulo Flow (5 Recientes)</p>
                             </div>
                          </div>
                          <div className="flex items-center gap-3">
                             <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
                             <span className="text-[10px] font-black text-green-500 uppercase tracking-widest">Live_KDS</span>
                          </div>
                       </div>

                       <div className="space-y-4">
                          {flowItems.length > 0 ? flowItems.map((item, idx) => {
                             const startTime = new Date(item.status === 'preparing' ? item.updated_at : item.created_at).getTime();
                             const diffMins = Math.floor((now - startTime) / 60000);
                             return (
                               <div key={idx} className="bg-white/[0.02] border border-white/5 p-6 rounded-[2rem] flex items-center justify-between group hover:bg-white/[0.04] transition-all">
                                  <div className="flex items-center gap-6">
                                     <div className="w-12 h-12 bg-white/5 rounded-2xl flex flex-col items-center justify-center border border-white/10 group-hover:border-blue-500/40 transition-colors">
                                        <span className="text-[7px] text-gray-500 font-black uppercase">Mesa</span>
                                        <span className="text-lg font-black italic text-blue-500">{item.table_id}</span>
                                     </div>
                                     <div>
                                        <h4 className="text-sm font-black italic uppercase text-white leading-none mb-2">{item.quantity}x {item.menu_items?.name}</h4>
                                        <div className="flex items-center gap-2">
                                           <span className={`text-[8px] font-black px-2 py-0.5 rounded-full uppercase ${item.status === 'preparing' ? 'bg-orange-600 text-white animate-pulse' : 'bg-white/5 text-gray-500'}`}>
                                              {item.status === 'preparing' ? 'COCINANDO' : 'EN COLA'}
                                           </span>
                                           <span className="w-1 h-1 bg-gray-800 rounded-full"></span>
                                           <span className="text-[8px] text-gray-600 font-bold uppercase">{item.menu_items?.category}</span>
                                        </div>
                                     </div>
                                  </div>
                                  <div className="text-right">
                                     <span className={`text-sm font-black italic font-mono ${diffMins > 10 ? 'text-red-500' : 'text-gray-400'}`}>
                                        {diffMins}m
                                     </span>
                                  </div>
                               </div>
                             );
                          }) : (
                             <div className="py-20 text-center opacity-20 border-2 border-dashed border-white/5 rounded-[3rem]">
                                <Clock size={48} className="mx-auto mb-4" />
                                <p className="text-[10px] font-black uppercase tracking-widest">No hay pedidos en curso.</p>
                             </div>
                          )}
                       </div>
                    </div>
                  </div>

                  {/* 3. Strategic AI Advisor & Staff Efficiency Sideboard */}
                  <div className="lg:col-span-4 space-y-8">
                     
                     {/* Ranking Eficiencia Staff */}
                     <div className="bg-[#111114] border border-white/5 p-10 rounded-[3.5rem] shadow-2xl space-y-10">
                        <div className="flex items-center justify-between">
                           <h4 className="text-xs font-black text-gray-500 uppercase tracking-widest flex items-center gap-2">
                              <UserCheck size={16} className="text-blue-500" /> Top Staff Efficiency
                           </h4>
                           <Star size={16} className="text-yellow-500 fill-current" />
                        </div>
                        <div className="space-y-8">
                           {topWaiters.map((waiter, i) => (
                              <div key={i} className="flex flex-col gap-4">
                                 <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-4">
                                       <div className="w-10 h-10 rounded-xl overflow-hidden border border-white/10 shrink-0">
                                          <img src={waiter.img} className="w-full h-full object-cover grayscale group-hover:grayscale-0" />
                                       </div>
                                       <div>
                                          <h5 className="text-[11px] font-black uppercase italic text-white leading-none mb-1">{waiter.name}</h5>
                                          <span className="text-[8px] text-gray-600 font-bold uppercase">Ticket Avg: <span className="text-blue-400">${(waiter.avgTicket/1000).toFixed(0)}k</span></span>
                                       </div>
                                    </div>
                                    <div className="text-right">
                                       <span className="text-lg font-black italic text-white">{waiter.efficiency}%</span>
                                    </div>
                                 </div>
                                 <div className="h-1 w-full bg-white/5 rounded-full overflow-hidden">
                                    <div className="h-full bg-blue-600 shadow-[0_0_10px_rgba(37,99,235,0.4)] transition-all duration-1000" style={{ width: `${waiter.efficiency}%` }}></div>
                                 </div>
                              </div>
                           ))}
                        </div>
                        <button className="w-full bg-white/5 hover:bg-white/10 py-4 rounded-2xl text-[9px] font-black uppercase tracking-widest transition-all italic border border-white/5">
                           Ver Auditoría de Personal
                        </button>
                     </div>

                     <div className="bg-blue-600 p-10 rounded-[4rem] shadow-2xl relative overflow-hidden group">
                        <div className="absolute top-0 right-0 p-8 opacity-10 group-hover:scale-110 transition-transform">
                           <Sparkles size={120} fill="white" />
                        </div>
                        <div className="relative z-10 space-y-6">
                           <div className="flex items-center gap-3">
                              <Zap size={24} className="text-white" fill="white" />
                              <h4 className="text-xs font-black text-white/80 uppercase tracking-widest italic">AI Strategic Brief</h4>
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
                            className="w-full bg-white text-blue-600 py-4 rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-xl hover:bg-blue-50 transition-all active:scale-95"
                           >
                              REFRESCAR COPILOT
                           </button>
                        </div>
                     </div>

                     <div className="bg-[#111114] border border-white/5 p-8 rounded-[3rem] shadow-2xl">
                        <h4 className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-6 italic">Status del Día (Marzo 2025)</h4>
                        <div className="space-y-4">
                           <div className="flex justify-between items-center border-b border-white/5 pb-2">
                              <span className="text-[9px] font-bold text-gray-400 uppercase">Ventas Hoy</span>
                              <span className="text-sm font-black italic text-green-500">$ 12.4M</span>
                           </div>
                           <div className="flex justify-between items-center border-b border-white/5 pb-2">
                              <span className="text-[9px] font-bold text-gray-400 uppercase">Reservas Activas</span>
                              <span className="text-sm font-black italic text-blue-500">42 Mesas</span>
                           </div>
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
           </div>
           <div className="flex items-center gap-3">
              <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
              <span className="text-[10px] font-black text-gray-600 uppercase tracking-widest italic">NEXUM_COPILOT_SYNC_ESTABLISHED</span>
           </div>
        </footer>
      </div>
    </div>
  );
};

const KPIMiniCard = ({ label, value, trend, positive, icon }: { label: string, value: string, trend: string, positive?: boolean, icon: React.ReactNode }) => (
  <div className="bg-[#111114] border border-white/5 p-8 rounded-[2.5rem] shadow-xl hover:border-blue-500/20 transition-all group">
     <div className="flex justify-between items-start mb-6">
        <div className="p-3 bg-white/5 rounded-2xl text-blue-500 group-hover:bg-blue-600 group-hover:text-white transition-all">
           {icon}
        </div>
        <div className={`flex items-center gap-1 text-[10px] font-black ${positive ? 'text-green-500' : 'text-red-500'}`}>
           {positive ? <TrendingUp size={12} /> : <ArrowDownRight size={12} />}
           {trend}
        </div>
     </div>
     <span className="text-[9px] text-gray-600 font-black uppercase tracking-widest block mb-1 leading-none">{label}</span>
     <span className="text-3xl font-black italic text-white tracking-tighter leading-none">{value}</span>
  </div>
);

const YieldMetric = ({ label, value, target, suffix, isInverse, isGrowth }: { label: string, value: number, target: number, suffix: string, isInverse?: boolean, isGrowth?: boolean }) => {
  const isBetter = isInverse ? value < target : value > target;
  return (
    <div className="flex flex-col items-center space-y-2">
       <span className="text-[10px] text-gray-600 font-black uppercase tracking-widest block">{label}</span>
       <div className={`text-4xl font-black italic tracking-tighter ${isBetter ? 'text-green-500' : 'text-orange-500'}`}>
          {isGrowth ? '$ ' : ''}{value}{suffix}
       </div>
       <span className="text-[8px] text-gray-700 font-bold uppercase block italic">Prev: {isGrowth ? '$ ' : ''}{target}{suffix}</span>
    </div>
  );
};

export default ExecutiveCockpit;
