
import React, { useState, useEffect, useCallback } from 'react';
import { 
  BarChart4, 
  TrendingUp, 
  AlertTriangle, 
  CheckCircle2, 
  Activity, 
  ShieldCheck, 
  DollarSign, 
  Info, 
  TrendingDown,
  Gauge,
  Zap,
  Target,
  Users,
  Droplets,
  Lightbulb,
  MoreHorizontal,
  Loader2,
  RefreshCw
} from 'lucide-react';
import { supabase } from '../lib/supabase';

interface FinancialReals {
  sales: number;
  cogs: number;
  labor: number;
  rent: number;
  marketing: number;
  utilities: number;
  others: number;
  opex: number;
  ebitda: number;
  margin: number;
}

interface Benchmark {
  target_ebitda_min: number;
  target_ebitda_max: number;
  target_margin_min: number;
  target_margin_max: number;
  target_cogs_min: number;
  target_cogs_max: number;
  target_labor_min: number;
  target_labor_max: number;
  target_rent_min: number;
  target_rent_max: number;
  target_marketing_min: number;
  target_marketing_max: number;
  target_utilities_max: number;
}

const FinanceAutopilot: React.FC = () => {
  const [reals, setReals] = useState<FinancialReals | null>(null);
  const [benchmark, setBenchmark] = useState<Benchmark | null>(null);
  const [loading, setLoading] = useState(true);
  const [showDetails, setShowDetails] = useState<string | null>(null);

  const fetchFinancialData = useCallback(async () => {
    setLoading(true);
    try {
      // 1. Definir Periodo Mensual
      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
      const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59).toISOString();

      // 2. Cargar Benchmarks
      const { data: bData } = await supabase
        .from('benchmark_profiles')
        .select('*')
        .eq('slug', 'omm')
        .single();
      
      const b = bData as Benchmark || {
        target_ebitda_min: 18, target_ebitda_max: 25,
        target_margin_min: 68, target_margin_max: 75,
        target_cogs_min: 28, target_cogs_max: 32,
        target_labor_min: 18, target_labor_max: 22,
        target_rent_min: 8, target_rent_max: 10,
        target_marketing_min: 3, target_marketing_max: 5,
        target_utilities_max: 4
      };
      setBenchmark(b);

      // 3. Ventas Reales del Mes (Órdenes Pagadas)
      const { data: orders } = await supabase
        .from('orders')
        .select('total_amount')
        .eq('status', 'paid')
        .gte('closed_at', startOfMonth)
        .lte('closed_at', endOfMonth);
      
      const totalSales = orders?.reduce((acc, o) => acc + (o.total_amount || 0), 0) || 0;

      // 4. Gastos Reales del Mes
      const { data: expenses } = await supabase
        .from('expenses')
        .select('*')
        .gte('date', startOfMonth.split('T')[0])
        .lte('date', endOfMonth.split('T')[0]);

      let cogs = 0, labor = 0, rent = 0, marketing = 0, utilities = 0, others = 0;

      expenses?.forEach(e => {
        const amt = e.amount || 0;
        const category = (e.category || '').toLowerCase();
        const account = (e.account || '').toLowerCase();

        if (e.type === 'COSTO') {
          cogs += amt;
        } else if (category.includes('labor') || account.includes('nómina') || account.includes('sueldo')) {
          labor += amt;
        } else if (category.includes('arriendo') || account.includes('renta')) {
          rent += amt;
        } else if (category.includes('marketing') || category.includes('publicidad')) {
          marketing += amt;
        } else if (category.includes('servicios') || account.includes('luz') || account.includes('agua') || account.includes('gas') || account.includes('internet')) {
          utilities += amt;
        } else {
          others += amt;
        }
      });

      // Cálculo de Totales
      const margin = totalSales - cogs;
      const opex = labor + rent + marketing + utilities + others;
      const ebitda = margin - opex;

      setReals({
        sales: totalSales,
        cogs,
        labor,
        rent,
        marketing,
        utilities,
        others,
        opex,
        ebitda,
        margin
      });

    } catch (err) {
      console.error("Error financiero:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  // Suscripción Real-time
  useEffect(() => {
    fetchFinancialData();

    const channel = supabase
      .channel('finance-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, () => fetchFinancialData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'expenses' }, () => fetchFinancialData())
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchFinancialData]);

  // Lógica de Semáforos de 3 Colores (🟢 🟡 🔴)
  const getStoplight = (value: number, min: number, max: number) => {
    const buffer = 2; // Margen de advertencia
    
    // Si el valor está fuera del rango absoluto -> 🔴 CRÍTICO
    if (value < min || value > max) return 'text-red-500';
    
    // Si el valor está cerca de los límites (dentro de los 2 puntos de buffer) -> 🟡 ADVERTENCIA
    if (value <= min + buffer || value >= max - buffer) return 'text-yellow-500';
    
    // Si está cómodamente en el medio -> 🟢 SALUDABLE
    return 'text-green-500';
  };

  const getStoplightBg = (value: number, min: number, max: number) => {
    const color = getStoplight(value, min, max);
    if (color === 'text-green-500') return 'bg-green-500 shadow-[0_0_15px_rgba(34,197,94,0.4)]';
    if (color === 'text-yellow-500') return 'bg-yellow-500 shadow-[0_0_15px_rgba(234,179,8,0.4)]';
    return 'bg-red-500 shadow-[0_0_15px_rgba(239,68,68,0.4)]';
  };

  if (loading && !reals) return (
    <div className="flex flex-col items-center justify-center py-40 opacity-40">
      <Loader2 className="animate-spin text-blue-500 mb-4" size={48} />
      <p className="text-[10px] font-black uppercase tracking-[0.4em] italic">Consolidando Cierre de Mes...</p>
    </div>
  );

  if (!reals || !benchmark) return null;

  const sales = reals.sales || 1; // Evitar división por cero
  const ebitdaPct = (reals.ebitda / sales) * 100;
  const goldenRulePct = ((reals.labor + reals.rent) / sales) * 100;
  const isGoldenRuleBroken = goldenRulePct > 35;

  return (
    <div className="space-y-12 animate-in fade-in duration-700 max-w-7xl mx-auto pb-20 text-left">
      
      {/* 1. SECCIÓN DE SALUD GENERAL */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-8">
         <div className="lg:col-span-5 bg-[#111114] border border-white/5 rounded-[4rem] p-12 flex flex-col items-center justify-center text-center shadow-2xl relative overflow-hidden group">
            <div className={`absolute inset-0 opacity-5 group-hover:scale-110 transition-transform duration-1000 ${ebitdaPct >= benchmark.target_ebitda_min ? 'text-green-500' : 'text-red-500'}`}>
               <Gauge size={300} className="mx-auto" />
            </div>
            <span className="text-[10px] font-black text-gray-500 uppercase tracking-[0.5em] mb-6">EBITDA REAL DEL MES</span>
            <div className={`text-9xl font-black italic tracking-tighter leading-none mb-4 ${getStoplight(ebitdaPct, benchmark.target_ebitda_min, benchmark.target_ebitda_max)}`}>
               {ebitdaPct.toFixed(1)}<span className="text-3xl text-gray-600">%</span>
            </div>
            <h3 className={`text-xl font-black italic uppercase tracking-widest ${ebitdaPct >= benchmark.target_ebitda_min ? 'text-green-500' : 'text-red-600'}`}>
               {ebitdaPct >= benchmark.target_ebitda_min ? 'OPERACIÓN EN RANGO' : 'DÉFICIT DE UTILIDAD'}
            </h3>
            <div className="mt-8 flex gap-3">
               <div className="bg-white/5 px-4 py-2 rounded-xl text-[9px] font-black text-gray-500 uppercase flex items-center gap-2">
                 <RefreshCw size={10} className={loading ? 'animate-spin' : ''} /> 
                 LIVE: ${reals.ebitda.toLocaleString()}
               </div>
               <div className="bg-white/5 px-4 py-2 rounded-xl text-[9px] font-black text-gray-500 uppercase">TARGET: {benchmark.target_ebitda_min}-{benchmark.target_ebitda_max}%</div>
            </div>
         </div>

         {/* KPIs DE CONTROL CON SEMÁFOROS 3 COLORES */}
         <div className="lg:col-span-7 bg-[#111114] border border-white/5 rounded-[4rem] p-12 grid grid-cols-1 md:grid-cols-2 gap-10 shadow-2xl overflow-y-auto max-h-[600px] custom-scrollbar">
            <KPITard 
              label="Gross Margin" 
              value={(reals.margin / sales * 100)} 
              min={benchmark.target_margin_min} 
              max={benchmark.target_margin_max} 
              suffix="%"
              icon={<TrendingUp size={20} />}
              getStoplight={getStoplight}
              getStoplightBg={getStoplightBg}
            />
            <KPITard 
              label="COGS (Costo Venta)" 
              value={(reals.cogs / sales * 100)} 
              min={benchmark.target_cogs_min} 
              max={benchmark.target_cogs_max} 
              suffix="%"
              icon={<Zap size={20} />}
              getStoplight={getStoplight}
              getStoplightBg={getStoplightBg}
            />
            <KPITard 
              label="Labor (Nómina)" 
              value={(reals.labor / sales * 100)} 
              min={benchmark.target_labor_min} 
              max={benchmark.target_labor_max} 
              suffix="%"
              icon={<Users size={20} />}
              getStoplight={getStoplight}
              getStoplightBg={getStoplightBg}
            />
            <KPITard 
              label="Rentas & Adm" 
              value={(reals.rent / sales * 100)} 
              min={benchmark.target_rent_min} 
              max={benchmark.target_rent_max} 
              suffix="%"
              icon={<Target size={20} />}
              getStoplight={getStoplight}
              getStoplightBg={getStoplightBg}
            />
            <KPITard 
              label="Servicios (Luz/Gas)" 
              value={(reals.utilities / sales * 100)} 
              min={1} 
              max={benchmark.target_utilities_max} 
              suffix="%"
              icon={<Lightbulb size={20} />}
              getStoplight={getStoplight}
              getStoplightBg={getStoplightBg}
            />
            <KPITard 
              label="Otros Gastos" 
              value={(reals.others / sales * 100)} 
              min={0} 
              max={5} 
              suffix="%"
              icon={<MoreHorizontal size={20} />}
              getStoplight={getStoplight}
              getStoplightBg={getStoplightBg}
            />
         </div>
      </section>

      {/* REGLA DE ORO ALERT */}
      {isGoldenRuleBroken && (
        <div className="bg-red-600/10 border-2 border-red-500/40 rounded-[3rem] p-10 flex items-center gap-10 animate-in shake duration-1000">
           <div className="bg-red-600 p-6 rounded-3xl shadow-2xl shadow-red-600/30 shrink-0">
              <AlertTriangle className="text-white" size={40} />
           </div>
           <div>
              <h4 className="text-3xl font-black italic uppercase tracking-tighter text-red-500 mb-2">VIOLACIÓN REGLA DE ORO</h4>
              <p className="text-lg text-gray-400 font-medium italic leading-relaxed">
                Labor + Rent están consumiendo el <span className="text-white font-bold">{goldenRulePct.toFixed(1)}%</span> de tus ventas mensuales. 
                Si este valor supera el 35%, el negocio no tiene punto de equilibrio. Reduzca personal o renegocie arriendo.
              </p>
           </div>
        </div>
      )}

      {/* P&G SIMULADO RÁPIDO */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
         <FinanceMiniCard label="Ventas Totales" value={reals.sales} color="text-white" />
         <FinanceMiniCard label="Utilidad Bruta" value={reals.margin} color="text-blue-500" />
         <FinanceMiniCard label="Gastos Operativos" value={reals.opex} color="text-gray-500" prefix="-" />
         <FinanceMiniCard label="Utilidad Neta (EBITDA)" value={reals.ebitda} color="text-green-500" />
      </div>

    </div>
  );
};

const KPITard = ({ label, value, min, max, suffix, icon, getStoplight, getStoplightBg }: any) => (
  <div className="flex items-center justify-between group">
     <div className="flex items-center gap-6">
        <div className={`w-3 h-3 rounded-full ${getStoplightBg(value, min, max)}`}></div>
        <div>
           <h5 className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1 flex items-center gap-2">
              {icon} {label}
           </h5>
           <div className={`text-4xl font-black italic tracking-tighter ${getStoplight(value, min, max)}`}>
              {value.toFixed(1)}{suffix}
           </div>
        </div>
     </div>
     <div className="text-right">
        <span className="text-[8px] text-gray-700 font-bold uppercase block mb-2">Rango: {min}-{max}{suffix}</span>
        <div className="flex gap-1 justify-end">
           <div className={`w-1 h-1 rounded-full ${value < min || value > max ? 'bg-red-500' : 'bg-gray-800'}`}></div>
           <div className={`w-1 h-1 rounded-full ${value >= min && value <= max ? 'bg-green-500' : 'bg-gray-800'}`}></div>
        </div>
     </div>
  </div>
);

const FinanceMiniCard = ({ label, value, color, prefix = "" }: { label: string, value: number, color: string, prefix?: string }) => (
  <div className="bg-[#111114] border border-white/5 p-8 rounded-[2.5rem] flex flex-col gap-2 shadow-xl hover:border-white/10 transition-all">
     <span className="text-[10px] text-gray-600 font-black uppercase tracking-widest">{label}</span>
     <div className={`text-2xl font-black italic tracking-tight ${color}`}>
        {prefix}$ {value.toLocaleString()}
     </div>
  </div>
);

export default FinanceAutopilot;
