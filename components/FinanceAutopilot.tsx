
import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase.ts';
import { 
  DollarSign, 
  AlertCircle, 
  TrendingUp, 
  TrendingDown, 
  Zap, 
  Activity, 
  BarChart4, 
  PieChart, 
  Target,
  ArrowUpRight,
  AlertTriangle,
  Flame,
  ShieldCheck,
  Loader2,
  // Fix: Added missing Percent icon import
  Percent
} from 'lucide-react';

interface KPIData {
  sales: number;
  cogs: number;
  labor: number;
  rent: number;
  marketing: number;
  utilities: number;
  maintenance: number;
  tech: number;
  entertainment: number;
  others: number;
  ebitda: number;
  margin: number;
  marginPercentage: number;
}

const FinanceAutopilot: React.FC = () => {
  const [kpis, setKpis] = useState<KPIData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchFinancialData = async () => {
      setLoading(true);
      try {
        // 1. Fetch Sales (Paid Orders)
        const { data: orders } = await supabase
          .from('orders')
          .select('total_amount')
          .eq('status', 'paid');
        
        const totalSales = orders?.reduce((acc, curr) => acc + (curr.total_amount || 0), 0) || 0;

        // 2. Fetch Expenses
        const { data: expenses } = await supabase
          .from('expenses')
          .select('amount, category, type');

        let labor = 0, rent = 0, marketing = 0, cogs = 0, utilities = 0;
        let maintenance = 0, tech = 0, entertainment = 0, others = 0;

        expenses?.forEach(exp => {
          const cat = exp.category?.toLowerCase() || '';
          const amt = exp.amount || 0;

          if (cat.includes('labor') || cat.includes('nómina') || cat.includes('staff')) labor += amt;
          else if (cat.includes('arriendo') || cat.includes('administración') || cat.includes('renta')) rent += amt;
          else if (cat.includes('marketing') || cat.includes('publicidad') || cat.includes('ads')) marketing += amt;
          else if (cat.includes('servicios') || cat.includes('luz') || cat.includes('agua') || cat.includes('gas')) utilities += amt;
          else if (cat.includes('mantenimiento') || cat.includes('reparación') || cat.includes('limpieza')) maintenance += amt;
          else if (cat.includes('tecnología') || cat.includes('licencia') || cat.includes('software')) tech += amt;
          else if (cat.includes('entretenimiento') || cat.includes('show') || cat.includes('dj')) entertainment += amt;
          else if (exp.type === 'cost' || cat.includes('comida') || cat.includes('bebida') || cat.includes('insumo')) cogs += amt;
          else others += amt;
        });

        const totalOPEX = labor + rent + marketing + utilities + maintenance + tech + entertainment + others;
        const margin = totalSales - cogs;
        const ebitda = margin - totalOPEX;
        const marginPercentage = totalSales > 0 ? (margin / totalSales) * 100 : 0;

        setKpis({
          sales: totalSales,
          cogs,
          labor,
          rent,
          marketing,
          utilities,
          maintenance,
          tech,
          entertainment,
          others,
          margin,
          ebitda,
          marginPercentage
        });
      } catch (err) {
        console.error("Finance Engine Error:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchFinancialData();
  }, []);

  if (loading) return (
    <div className="flex flex-col items-center justify-center py-40 opacity-40">
      <Loader2 className="animate-spin text-blue-500 mb-4" size={48} />
      <p className="text-xl font-black uppercase tracking-[0.5em] text-gray-500 italic">Sincronizando Verdad Financiera...</p>
    </div>
  );

  if (!kpis) return null;

  const isLowMargin = kpis.marginPercentage < 66;

  return (
    <div className="space-y-12 animate-in fade-in duration-1000 max-w-7xl mx-auto pb-20">
      
      {/* Alerta Regla de Oro */}
      {isLowMargin && (
        <div className="bg-red-600/10 border-2 border-red-500/40 p-8 rounded-[3rem] flex items-center justify-between shadow-[0_0_50px_rgba(239,68,68,0.15)] animate-in shake duration-1000">
           <div className="flex items-center gap-6">
              <div className="bg-red-600 p-4 rounded-3xl shadow-xl shadow-red-600/20">
                 <AlertCircle size={32} className="text-white" />
              </div>
              <div>
                 <h2 className="text-3xl font-black italic uppercase text-red-500 tracking-tighter">⚠️ REGLA DE ORO QUEBRADA: MARGEN BRUTO BAJO</h2>
                 <p className="text-sm text-gray-400 font-medium italic mt-1 uppercase tracking-widest">Margen Actual: {kpis.marginPercentage.toFixed(1)}% | Mínimo requerido: 66%</p>
              </div>
           </div>
           <div className="hidden md:flex flex-col items-end">
              <span className="text-[10px] text-red-400 font-black uppercase tracking-widest">Impacto en EBITDA</span>
              <span className="text-2xl font-black italic text-red-500">ALTA PRESIÓN</span>
           </div>
        </div>
      )}

      {/* Main Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        <HeroCard 
          label="Ventas Netas (Real)" 
          value={`$ ${kpis.sales.toLocaleString()}`} 
          icon={<DollarSign size={24} />} 
          color="text-green-500" 
          bg="bg-green-600/5"
        />
        <HeroCard 
          label="Margen Bruto" 
          value={`${kpis.marginPercentage.toFixed(1)}%`} 
          subValue={`$ ${kpis.margin.toLocaleString()}`}
          icon={<Percent size={24} />} 
          color={isLowMargin ? "text-red-500" : "text-blue-500"} 
          bg={isLowMargin ? "bg-red-600/5" : "bg-blue-600/5"}
        />
        <HeroCard 
          label="EBITDA Proyectado" 
          value={`$ ${kpis.ebitda.toLocaleString()}`} 
          icon={<TrendingUp size={24} />} 
          color="text-white" 
          bg="bg-white/5"
        />
      </div>

      {/* Breakdown Matrix */}
      <div className="bg-[#111114] border border-white/5 rounded-[4rem] p-10 md:p-16 shadow-2xl">
         <div className="flex items-center justify-between mb-16 border-b border-white/5 pb-10">
            <div>
               <h3 className="text-2xl font-black italic uppercase tracking-tighter">Matriz de Eficiencia OMM</h3>
               <p className="text-[10px] text-gray-500 font-black uppercase tracking-[0.4em] mt-2 italic">Costos Operativos sobre Ventas</p>
            </div>
            <Zap size={24} className="text-blue-500 animate-pulse" />
         </div>

         <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-12">
            <MetricBox label="COGS" value={kpis.cogs} sales={kpis.sales} color="text-orange-500" />
            <MetricBox label="Mano de Obra" value={kpis.labor} sales={kpis.sales} color="text-blue-400" />
            <MetricBox label="Arriendo" value={kpis.rent} sales={kpis.sales} color="text-purple-400" />
            <MetricBox label="Marketing" value={kpis.marketing} sales={kpis.sales} color="text-pink-400" />
            <MetricBox label="Servicios" value={kpis.utilities} sales={kpis.sales} color="text-cyan-400" />
            <MetricBox label="Mantenimiento" value={kpis.maintenance} sales={kpis.sales} color="text-gray-400" />
            <MetricBox label="Tecnología" value={kpis.tech} sales={kpis.sales} color="text-yellow-500" />
            <MetricBox label="Show & Ent." value={kpis.entertainment} sales={kpis.sales} color="text-indigo-400" />
            <MetricBox label="Otros OPEX" value={kpis.others} sales={kpis.sales} color="text-gray-600" />
         </div>
      </div>
      
      {/* Auditoría Footer */}
      <div className="flex items-center justify-center gap-6 opacity-30 text-[10px] font-black uppercase tracking-[0.3em]">
         <ShieldCheck size={14} />
         <span>Auditoría Live Sincronizada con NEXUM_CLOUD_V4</span>
         <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
      </div>
    </div>
  );
};

const HeroCard = ({ label, value, subValue, icon, color, bg }: any) => (
  <div className={`${bg} border border-white/5 p-10 rounded-[3rem] group hover:border-white/10 transition-all shadow-xl`}>
     <div className="flex justify-between items-start mb-8">
        <div className={`p-4 bg-white/5 rounded-2xl ${color}`}>{icon}</div>
        <ArrowUpRight size={18} className="text-gray-700 group-hover:text-white transition-colors" />
     </div>
     <span className="text-[10px] text-gray-500 font-black uppercase tracking-widest">{label}</span>
     <div className={`text-4xl md:text-5xl font-black italic tracking-tighter leading-none mt-3 ${color}`}>{value}</div>
     {subValue && <p className="text-xs font-black italic text-gray-600 mt-2">{subValue}</p>}
  </div>
);

const MetricBox = ({ label, value, sales, color }: any) => {
  const percent = sales > 0 ? (value / sales) * 100 : 0;
  return (
    <div className="space-y-4">
       <div className="flex flex-col">
          <span className="text-[8px] text-gray-600 font-black uppercase tracking-widest leading-none mb-1">{label}</span>
          <span className={`text-lg font-black italic text-white leading-none`}>$ {value.toLocaleString()}</span>
       </div>
       <div className="flex items-center gap-3">
          <div className="h-1 flex-1 bg-white/5 rounded-full overflow-hidden">
             <div className={`h-full bg-current ${color} opacity-30`} style={{ width: `${Math.min(100, percent * 2)}%` }}></div>
          </div>
          <span className={`text-xs font-black italic font-mono ${color}`}>{percent.toFixed(1)}%</span>
       </div>
    </div>
  );
};

export default FinanceAutopilot;
