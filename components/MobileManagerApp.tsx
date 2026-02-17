
import React, { useState, useEffect } from 'react';
import { 
  TrendingUp, 
  DollarSign, 
  Users, 
  Zap, 
  ShieldCheck, 
  BrainCircuit, 
  Activity, 
  ChevronRight,
  Bell,
  RefreshCw,
  PieChart,
  Target,
  ArrowUpRight,
  Menu,
  X,
  Sparkles,
  ArrowLeft
} from 'lucide-react';
import { GoogleGenAI } from "@google/genai";
import { supabase } from '../lib/supabase.ts';

interface MobileManagerAppProps {
  onExit?: () => void;
}

const MobileManagerApp: React.FC<MobileManagerAppProps> = ({ onExit }) => {
  const [loading, setLoading] = useState(true);
  const [aiInsight, setAiInsight] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [notifications, setNotifications] = useState(3);

  // KPIs en tiempo real (Mock con lógica de sync)
  const [kpis, setKpis] = useState({
    ventasHoy: 12450000,
    ebitda: 21.7,
    labor: 28.4,
    paxActual: 84
  });

  useEffect(() => {
    const init = async () => {
      await generateMobileInsight();
      setLoading(false);
    };
    init();

    // Suscripción a cambios en ventas para actualización en vivo en el celular
    const channel = supabase.channel('mobile-manager-sync')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'orders' }, (payload) => {
         // Aquí actualizarías los KPIs reales
         console.log("Syncing mobile KPIs...");
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  const generateMobileInsight = async () => {
    setIsRefreshing(true);
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    try {
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: "Eres el consultor IA de OMM. Escribe un micro-briefing de 2 líneas para un gerente que acaba de abrir la app en su Android. KPIs: Ventas 12M, EBITDA 21%. Sé motivador y directo.",
      });
      setAiInsight(response.text || "");
    } catch (e) {
      setAiInsight("Operación estable. El EBITDA se mantiene 2% arriba del objetivo. Foco en rotación de postres.");
    } finally {
      setIsRefreshing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[5000] bg-[#050505] text-white flex flex-col font-sans overflow-hidden animate-in fade-in duration-500">
      
      {/* Salida de Emergencia / Retorno a Desktop */}
      <button 
        onClick={onExit}
        className="absolute top-12 right-6 z-[6000] bg-white/10 hover:bg-white/20 p-4 rounded-2xl backdrop-blur-md border border-white/10 text-white shadow-2xl transition-all active:scale-90"
      >
        <ArrowLeft size={24} />
      </button>

      {/* Status Bar Fake for Mobile Feel */}
      <div className="h-8 bg-black w-full flex justify-between items-center px-6 text-[10px] font-bold text-gray-500">
        <span>NEXUM_OS_MOBILE</span>
        <div className="flex gap-2">
           <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse"></div>
           <span>LIVE_SYNC</span>
        </div>
      </div>

      {/* Header Mobile */}
      <header className="px-6 py-4 flex justify-between items-center border-b border-white/5 bg-black/40 backdrop-blur-xl">
        <div className="flex items-center gap-3">
           <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center shadow-lg">
              <Zap size={20} fill="white" />
           </div>
           <h1 className="text-xl font-black italic tracking-tighter uppercase">COCKPIT <span className="text-blue-500">MGR</span></h1>
        </div>
        <div className="flex items-center gap-4 mr-14">
           <div className="relative">
              <Bell size={22} className="text-gray-400" />
              {notifications > 0 && <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-600 rounded-full text-[8px] flex items-center justify-center font-black">{notifications}</span>}
           </div>
           <Menu size={24} className="text-gray-400" />
        </div>
      </header>

      {/* Main Content Vertical Scroll */}
      <main className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar pb-24 text-left">
        
        {/* AI Insight Box - "The Morning Brief" */}
        <section 
          onClick={generateMobileInsight}
          className="bg-blue-600 rounded-[2.5rem] p-8 shadow-2xl relative overflow-hidden group active:scale-[0.98] transition-all"
        >
           <div className="absolute top-0 right-0 p-6 opacity-10">
              <BrainCircuit size={80} fill="white" />
           </div>
           <div className="relative z-10 space-y-3">
              <div className="flex items-center gap-2">
                 <Sparkles size={14} className="text-blue-200" />
                 <span className="text-[10px] font-black uppercase tracking-widest text-blue-100">Inteligencia OMM</span>
              </div>
              <p className="text-sm font-black italic text-white leading-tight">
                 {isRefreshing ? "Analizando flujo..." : `"${aiInsight}"`}
              </p>
           </div>
        </section>

        {/* Dashboard Grid */}
        <div className="grid grid-cols-2 gap-4">
           <MobileStatCard label="Venta Hoy" value={`$${(kpis.ventasHoy / 1000000).toFixed(1)}M`} sub="+12%" icon={<DollarSign size={16} />} color="text-green-500" />
           <MobileStatCard label="EBITDA" value={`${kpis.ebitda}%`} sub="Optimal" icon={<PieChart size={16} />} color="text-blue-500" />
           <MobileStatCard label="Labor Cost" value={`${kpis.labor}%`} sub="-1.4%" icon={<Users size={16} />} color="text-purple-500" />
           <MobileStatCard label="Pax Live" value={kpis.paxActual.toString()} sub="84% Cap" icon={<Target size={16} />} color="text-orange-500" />
        </div>

        {/* Live Traffic Monitor */}
        <section className="bg-[#111114] border border-white/5 rounded-[3rem] p-8 space-y-6 shadow-xl">
           <div className="flex justify-between items-center">
              <h3 className="text-xs font-black uppercase tracking-widest text-gray-500 flex items-center gap-2">
                 <Activity size={14} className="text-blue-500" /> Status de Pista
              </h3>
              <RefreshCw size={14} className={`text-gray-700 ${isRefreshing ? 'animate-spin' : ''}`} />
           </div>
           <div className="space-y-6">
              <MobileProgress label="Cocina Robata" value={92} color="bg-orange-600" />
              <MobileProgress label="Servicio Salón" value={45} color="bg-blue-600" />
              <MobileProgress label="Barra Mixología" value={78} color="bg-purple-600" />
           </div>
        </section>

        {/* Critical Alerts Sidebar (Flat) */}
        <div className="space-y-4">
           <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-gray-600 px-2">Alertas de Intervención</h3>
           <AlertItem icon={<RefreshCw size={16} />} title="Delay en Mesa 04" time="Hace 3m" urgent />
           <AlertItem icon={<Users size={16} />} title="VIP: Arribo de Mesa 12" time="Ahora" />
           <AlertItem icon={<ShieldCheck size={16} />} title="Corte de Turno OK" time="14:00" />
        </div>

      </main>

      {/* Bottom Nav Bar - Android Native Style */}
      <nav className="h-20 bg-black/80 backdrop-blur-2xl border-t border-white/5 flex justify-around items-center px-6 pb-2">
         <NavIcon icon={<Activity size={24} />} label="Live" active />
         <NavIcon icon={<DollarSign size={24} />} label="Ventas" />
         <div className="w-14 h-14 bg-blue-600 rounded-2xl flex items-center justify-center -mt-10 shadow-2xl shadow-blue-900/50 border-4 border-[#050505] active:scale-90 transition-transform">
            <BrainCircuit size={28} className="text-white" />
         </div>
         <NavIcon icon={<Users size={24} />} label="Staff" />
         <NavIcon icon={<ShieldCheck size={24} />} label="Admin" />
      </nav>
    </div>
  );
};

const MobileStatCard = ({ label, value, sub, icon, color }: any) => (
  <div className="bg-[#111114] border border-white/5 p-6 rounded-[2rem] flex flex-col gap-3 shadow-lg">
     <div className={`p-2 w-fit rounded-lg bg-white/5 ${color}`}>{icon}</div>
     <div>
        <span className="text-[9px] font-black uppercase text-gray-600 block mb-1">{label}</span>
        <span className="text-xl font-black italic text-white tracking-tighter">{value}</span>
     </div>
     <span className={`text-[8px] font-black uppercase ${sub.includes('+') || sub === 'Optimal' ? 'text-green-500' : 'text-red-500'}`}>{sub}</span>
  </div>
);

const MobileProgress = ({ label, value, color }: any) => (
  <div className="space-y-2">
     <div className="flex justify-between text-[9px] font-black uppercase tracking-widest">
        <span className="text-gray-500">{label}</span>
        <span className="text-white">{value}%</span>
     </div>
     <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden">
        <div className={`h-full ${color} shadow-[0_0_10px_currentColor] transition-all duration-1000`} style={{ width: `${value}%` }}></div>
     </div>
  </div>
);

const AlertItem = ({ icon, title, time, urgent }: any) => (
  <div className={`flex items-center gap-4 p-5 rounded-2xl border transition-all ${urgent ? 'bg-red-600/10 border-red-500/20' : 'bg-white/5 border-white/5'}`}>
     <div className={`p-2 rounded-xl ${urgent ? 'bg-red-600 text-white' : 'bg-black text-blue-500'}`}>
        {icon}
     </div>
     <div className="flex-1">
        <h4 className="text-[11px] font-black uppercase italic text-white leading-none">{title}</h4>
        <span className="text-[8px] text-gray-500 font-bold uppercase mt-1">{time}</span>
     </div>
     <ChevronRight size={16} className="text-gray-700" />
  </div>
);

const NavIcon = ({ icon, label, active }: any) => (
  <div className={`flex flex-col items-center gap-1 ${active ? 'text-blue-500' : 'text-gray-600'}`}>
     {icon}
     <span className="text-[8px] font-black uppercase tracking-widest">{label}</span>
  </div>
);

export default MobileManagerApp;
