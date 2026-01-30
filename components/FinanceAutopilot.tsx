
import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase.ts';
import { 
  DollarSign, 
  TrendingUp, 
  TrendingDown, 
  Zap, 
  Activity, 
  Target,
  Flame,
  ShieldCheck,
  Loader2,
  BarChart3,
  Lightbulb,
  Brain,
  HeartPulse,
  Star,
  Sparkles
} from 'lucide-react';
import { OperationalSettings, BusinessDNA } from '../types.ts';

// JSON Maestro de Benchmarks NEXUM - Actualizado con CASUAL_PREMIUM (Service-Forward)
const BENCHMARK_PROFILES = {
  'CASUAL_DINING': {
    ranges: {
      cogs: { green: [28, 35], yellow: [35, 38], red: 38 },
      labor: { green: [22, 30], yellow: [30, 33], red: 33 },
      rent: { green: [6, 12], yellow: [12, 15], red: 15 },
      marketing: { green: [1, 4], yellow: [4, 6], red: 6 },
      ebitda: { green: [10, 18], yellow: [6, 10], red: 6 },
      grossMargin: 65
    }
  },
  'CASUAL_PREMIUM': {
    ranges: {
      cogs: { green: [30, 34], yellow: [34, 36], red: 36 },
      labor: { green: [26, 32], yellow: [32, 34], red: 34 },
      rent: { green: [8, 12], yellow: [12, 13], red: 13 },
      marketing: { green: [2, 4], yellow: [4, 5], red: 5 },
      entertainment: { green: [0.5, 2], yellow: [2, 3], red: 3 },
      ebitda: { green: [10, 20], yellow: [6, 9], red: 6 },
      grossMargin: 66
    }
  },
  'FINE_DINING': {
    ranges: {
      cogs: { green: [30, 38], yellow: [38, 42], red: 42 },
      labor: { green: [28, 38], yellow: [38, 42], red: 42 },
      rent: { green: [8, 15], yellow: [15, 18], red: 18 },
      marketing: { green: [1, 4], yellow: [4, 7], red: 7 },
      ebitda: { green: [8, 15], yellow: [4, 8], red: 4 },
      grossMargin: 62
    }
  },
  'BAR_NIGHTLIFE': {
    ranges: {
      cogs: { green: [18, 28], yellow: [28, 32], red: 32 },
      labor: { green: [18, 28], yellow: [28, 32], red: 32 },
      rent: { green: [8, 15], yellow: [15, 20], red: 20 },
      marketing: { green: [2, 8], yellow: [8, 12], red: 12 },
      entertainment: { green: [3, 7], yellow: [7, 10], red: 10 },
      ebitda: { green: [15, 30], yellow: [10, 15], red: 10 },
      grossMargin: 72
    }
  },
  'QSR_FAST_CASUAL': {
    ranges: {
      cogs: { green: [25, 33], yellow: [33, 36], red: 36 },
      labor: { green: [18, 25], yellow: [25, 28], red: 28 },
      rent: { green: [6, 12], yellow: [12, 15], red: 15 },
      marketing: { green: [1, 3], yellow: [3, 5], red: 5 },
      ebitda: { green: [12, 22], yellow: [8, 12], red: 8 },
      grossMargin: 67
    }
  }
};

const FinanceAutopilot: React.FC = () => {
  const [config, setConfig] = useState<OperationalSettings | null>(null);
  const [loading, setLoading] = useState(true);

  const kpis = {
    sales: 124500000,
    netSales: 120300000, 
    cogs: 38500000,
    labor: 34200000,
    opex: 21500000,
    ebitda: 26100000,
    grossMargin: 68      
  };

  useEffect(() => {
    const fetchConfig = async () => {
      setLoading(true);
      const { data } = await supabase.from('operational_settings').select('*').maybeSingle();
      setConfig(data || {
        business_dna: 'CASUAL_PREMIUM',
        target_margin: 68,
        target_cogs: 32,
        target_labor: 28,
        ai_agency_level: 'ADVISORY',
        notifications_enabled: true
      });
      setLoading(false);
    };
    fetchConfig();
  }, []);

  if (loading || !config) return <div className="py-20 text-center opacity-40"><Loader2 className="animate-spin mx-auto mb-4" />Calibrando Benchmarks OMM...</div>;

  const profile = BENCHMARK_PROFILES[config.business_dna as keyof typeof BENCHMARK_PROFILES] || BENCHMARK_PROFILES.FINE_DINING;
  
  const getStatusColor = (value: number, range: any) => {
    if (value <= range.green[1]) return 'text-green-500';
    if (value <= range.yellow[1]) return 'text-yellow-500';
    return 'text-red-500';
  };

  const cogsPct = (kpis.cogs / kpis.netSales) * 100;
  const laborPct = (kpis.labor / kpis.netSales) * 100;
  const ebitdaPct = (kpis.ebitda / kpis.netSales) * 100;

  const isHealthy = kpis.grossMargin >= profile.ranges.grossMargin;
  const healthStatus = ebitdaPct >= (profile.ranges.ebitda.green ? profile.ranges.ebitda.green[0] : 10) ? 'ÓPTIMO' : ebitdaPct >= (profile.ranges.ebitda.yellow ? profile.ranges.ebitda.yellow[0] : 6) ? 'REVISAR' : 'FUERA_RANGO';

  return (
    <div className="space-y-12 animate-in fade-in duration-1000 max-w-7xl mx-auto pb-20 text-left">
      
      {/* Indicador de ADN Activo Estilo HUD */}
      <div className="flex items-center justify-between bg-[#1a1a1e] border-2 border-blue-500/20 px-8 py-4 rounded-[2rem] shadow-xl">
         <div className="flex items-center gap-4">
            <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-600/20">
               <Brain className="text-white" size={20} />
            </div>
            <div>
               <span className="text-[8px] text-gray-500 font-black uppercase tracking-[0.4em] block">Sincronía Operacional</span>
               <div className="flex items-center gap-2">
                  <h4 className="text-lg font-black italic uppercase text-white tracking-tight">ACTIVE_DNA: {config.business_dna.replace(/_/g, ' ')}</h4>
                  {config.business_dna === 'CASUAL_PREMIUM' && <Star size={16} className="text-yellow-500 fill-current" />}
               </div>
            </div>
         </div>
         <div className="flex items-center gap-8">
            <div className="flex flex-col items-end">
               <span className="text-[8px] text-gray-600 font-bold uppercase">Estado IA</span>
               <div className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse"></div>
                  <span className="text-[10px] font-black text-green-500 uppercase italic">Calibrado OK</span>
               </div>
            </div>
            <Sparkles size={20} className="text-blue-500 opacity-30" />
         </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 bg-[#111114] border border-white/5 p-10 rounded-[3rem] shadow-2xl relative overflow-hidden">
           <div className="absolute top-0 right-0 p-10 opacity-5">
              <HeartPulse size={120} className="text-blue-500" />
           </div>
           <div className="relative z-10 flex items-center gap-10">
              <div className="text-center">
                 <span className="text-[10px] text-gray-500 font-black uppercase tracking-[0.4em] block mb-4">Métrica Salud OMM</span>
                 <div className={`text-6xl font-black italic tracking-tighter ${healthStatus === 'ÓPTIMO' ? 'text-green-500' : 'text-red-500'}`}>
                   {ebitdaPct.toFixed(1)}%
                 </div>
                 <span className="text-[10px] text-gray-400 font-bold uppercase mt-2 block italic">EBITDA REAL VS NETO</span>
              </div>
              <div className="flex-1 space-y-4 border-l border-white/5 pl-10">
                 <div className="flex items-center gap-3">
                    <h3 className="text-2xl font-black italic text-white uppercase tracking-tighter">Status: {healthStatus}</h3>
                    {isHealthy && <span className="bg-green-500/10 text-green-500 text-[8px] font-black px-2 py-1 rounded-full border border-green-500/20 uppercase tracking-widest">MARGEN SALUDABLE</span>}
                 </div>
                 <p className="text-sm text-gray-400 font-medium italic leading-relaxed">
                   "Tu Margen Bruto del {kpis.grossMargin}% es sólido para el modelo {config.business_dna.replace(/_/g, ' ')}. El sistema está aplicando los semáforos de industria específicos para este perfil."
                 </p>
              </div>
           </div>
        </div>

        <div className="bg-gradient-to-br from-blue-600/20 to-transparent p-10 rounded-[3rem] border border-blue-500/10 flex flex-col justify-center text-center group">
           <Brain className="text-blue-500 mx-auto mb-4 group-hover:scale-110 transition-transform" size={32} />
           <span className="text-[9px] text-gray-400 font-black uppercase tracking-widest leading-none">Preset de Industria</span>
           <h4 className="text-2xl font-black italic text-white uppercase tracking-tight mt-3">{config.business_dna.replace(/_/g, ' ')}</h4>
           <p className="text-[8px] text-gray-500 font-black uppercase mt-4 italic">Benchmarks Corporativos Seratta V4</p>
        </div>
      </div>

      {/* Grid de Semáforos Contables */}
      <div className="bg-[#111114] border border-white/5 rounded-[4rem] p-12 shadow-2xl">
         <div className="flex items-center justify-between mb-16 border-b border-white/5 pb-10">
            <div>
               <h3 className="text-2xl font-black italic uppercase tracking-tighter text-white leading-none">Monitor de Semáforos Preventivos</h3>
               <p className="text-[10px] text-gray-500 font-black uppercase tracking-[0.4em] mt-3 italic">Métricas Clave de Industria (NEXUM Score)</p>
            </div>
            <BarChart3 size={24} className="text-blue-500" />
         </div>

         <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-12 text-white">
            <TrafficCard 
               label="COGS (FOOD & BEV)" 
               value={cogsPct} 
               range={profile.ranges.cogs} 
               color={getStatusColor(cogsPct, profile.ranges.cogs)}
               icon={<Flame size={14} />} 
            />
            <TrafficCard 
               label="NÓMINA (LABOR)" 
               value={laborPct} 
               range={profile.ranges.labor} 
               color={getStatusColor(laborPct, profile.ranges.labor)}
               icon={<Activity size={14} />} 
            />
            <TrafficCard 
               label="ARRIENDO + ADM" 
               value={(12000000 / kpis.netSales) * 100} 
               range={profile.ranges.rent} 
               color={getStatusColor((12000000 / kpis.netSales) * 100, profile.ranges.rent)}
               icon={<ShieldCheck size={14} />} 
            />
            <TrafficCard 
               label="MARKETING OMM" 
               value={(4500000 / kpis.netSales) * 100} 
               range={profile.ranges.marketing} 
               color={getStatusColor((4500000 / kpis.netSales) * 100, profile.ranges.marketing)}
               icon={<TrendingUp size={14} />} 
            />
         </div>
      </div>
    </div>
  );
};

const TrafficCard = ({ label, value, range, color, icon }: any) => {
  return (
    <div className="space-y-6 bg-white/[0.02] p-8 rounded-[2.5rem] border border-white/5 group transition-all hover:border-white/10">
       <div className="flex flex-col">
          <div className="flex items-center gap-2 mb-2">
             <span className={`${color}`}>{icon}</span>
             <span className="text-[10px] text-gray-500 font-black uppercase tracking-widest">{label}</span>
          </div>
          <span className={`text-4xl font-black italic tracking-tighter ${color}`}>{value.toFixed(1)}%</span>
       </div>
       
       <div className="space-y-2">
          <div className="flex justify-between text-[8px] font-black text-gray-600 uppercase">
             <span>OBJETIVO</span>
             <span>{range.green[0]}-{range.green[1]}%</span>
          </div>
          <div className="h-1 w-full bg-white/5 rounded-full overflow-hidden">
             <div className={`h-full ${color} transition-all duration-1000 shadow-[0_0_10px_currentColor]`} style={{ width: `${Math.min(100, (value/range.green[1])*80)}%` }}></div>
          </div>
       </div>
    </div>
  );
};

export default FinanceAutopilot;
