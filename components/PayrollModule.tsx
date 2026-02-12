
import React, { useState, useEffect } from 'react';
import { 
  Briefcase, 
  ShieldCheck, 
  TrendingUp, 
  Zap, 
  Clock, 
  CheckCircle2, 
  ChevronRight,
  Search,
  Brain,
  Loader2,
  DollarSign,
  Activity,
  Lock,
  Sparkles,
  Database,
  Building2,
  Fingerprint,
  MapPin,
  Target,
  Award
} from 'lucide-react';
import { PayrollEmployee, SalaryBenchmark } from '../types.ts';

const PayrollModule: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'liquidations' | 'benchmarks' | 'compliance'>('liquidations');
  const [loading, setLoading] = useState(true);
  
  // Data de reporte Indeed Careers (Baseline Público)
  const salaryBenchmarks: SalaryBenchmark[] = [
    { city: 'Bogotá', role: 'Mesero/a', avg_base: 1425396, currency: 'COP' },
    { city: 'Bogotá', role: 'Bartender', avg_base: 1669595, currency: 'COP' },
    { city: 'Ciudad de México', role: 'Cocinero/a', avg_base: 9704, currency: 'MXN' },
    { city: 'São Paulo', role: 'Garçom', avg_base: 2122, currency: 'BRL' },
    { city: 'Santiago', role: 'Sommelier', avg_base: 750000, currency: 'CLP' }, // Mock value as per report gap
  ];

  const [employees, setEmployees] = useState<PayrollEmployee[]>([
    { id: 'E1', name: 'Carlos Mendoza', role: 'Chef de Partie', base_salary: 3200000, efficiency: 94, reputation_score: 98, credentials: [{ id: 'C1', name: 'Cocinero Nivel 3 BOH', level: 3, category: 'BOH', status: 'earned' }] },
    { id: 'E2', name: 'Laura Restrepo', role: 'Mesero Nivel 2', base_salary: 1850000, efficiency: 88, reputation_score: 92, credentials: [{ id: 'C2', name: 'Mesero Nivel 2 - Alto Volumen', level: 2, category: 'FOH', status: 'earned' }] },
  ]);

  useEffect(() => {
    setTimeout(() => setLoading(false), 800);
  }, []);

  if (loading) return (
    <div className="flex flex-col items-center justify-center py-40 opacity-40">
      <Loader2 className="animate-spin text-blue-500 mb-4" size={32} />
      <p className="text-[10px] font-black uppercase tracking-widest italic">Cargando Infraestructura de Trabajo...</p>
    </div>
  );

  return (
    <div className="space-y-12 animate-in fade-in duration-700 text-left pb-20 max-w-7xl mx-auto">
      
      <div className="flex flex-col xl:flex-row gap-8 justify-between items-start xl:items-center border-b border-white/5 pb-10">
        <div className="flex items-center gap-6">
           <div className="p-5 bg-blue-600 rounded-[2rem] shadow-2xl shadow-blue-600/30">
              <Briefcase size={32} className="text-white" />
           </div>
           <div>
              <h2 className="text-4xl font-black italic tracking-tighter uppercase leading-none">Employment OS</h2>
              <p className="text-gray-500 text-[10px] font-black uppercase tracking-[0.4em] mt-3 flex items-center gap-2">
                 <ShieldCheck size={14} className="text-green-500" /> Sincronía DIAN & Reputación Laboral OMM_V4
              </p>
           </div>
        </div>

        <div className="flex bg-[#111114] p-1.5 rounded-2xl border border-white/5 overflow-x-auto">
          <TabBtn active={activeTab === 'liquidations'} onClick={() => setActiveTab('liquidations')} icon={<Activity size={14} />} label="LIQUIDACIÓN LIVE" />
          <TabBtn active={activeTab === 'benchmarks'} onClick={() => setActiveTab('benchmarks')} icon={<MapPin size={14} />} label="GUÍA SALARIAL LatAm" />
          <TabBtn active={activeTab === 'compliance'} onClick={() => setActiveTab('compliance')} icon={<Lock size={14} />} label="DIAN_NÓMINA_ELECTRONICA" />
        </div>
      </div>

      {activeTab === 'benchmarks' ? (
        <div className="space-y-10 animate-in slide-in-from-bottom-4 duration-700">
           <div className="bg-blue-600/10 border-2 border-blue-500/20 p-12 rounded-[4rem] relative overflow-hidden shadow-2xl">
              <div className="absolute top-0 right-0 p-12 opacity-10"><Database size={180} className="text-blue-500" /></div>
              <div className="relative z-10 max-w-2xl space-y-6">
                 <h2 className="text-5xl font-black italic tracking-tighter uppercase leading-none text-white">Market Salary Baseline</h2>
                 <p className="text-gray-400 text-lg italic leading-relaxed">
                   Datos calibrados mensualmente cruzando portales públicos (Indeed) con ofertas reales aceptadas en el ecosistema NEXUM.
                   <span className="text-blue-400 font-bold block mt-4 italic">Nota: Los montos no incluyen propinas ni service charge.</span>
                 </p>
              </div>
           </div>

           <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {salaryBenchmarks.map((b, i) => (
                <div key={i} className="bg-[#111114] border border-white/5 p-8 rounded-[3rem] shadow-xl group hover:border-blue-500/30 transition-all">
                   <div className="flex justify-between items-start mb-6">
                      <div className="bg-white/5 px-4 py-2 rounded-xl text-[8px] font-black uppercase text-gray-500 tracking-widest">{b.city}</div>
                      <TrendingUp size={16} className="text-green-500 opacity-40 group-hover:opacity-100 transition-opacity" />
                   </div>
                   <h4 className="text-xl font-black italic uppercase text-white mb-2">{b.role}</h4>
                   <div className="flex items-baseline gap-2">
                      <span className="text-3xl font-black italic text-blue-500">{b.avg_base.toLocaleString()}</span>
                      <span className="text-[10px] font-black text-gray-600 uppercase tracking-widest">{b.currency} / mes</span>
                   </div>
                   <p className="text-[8px] text-gray-700 font-bold uppercase mt-6 italic">Sueldo Base Promedio Publicado</p>
                </div>
              ))}
           </div>
        </div>
      ) : activeTab === 'liquidations' ? (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
           <div className="lg:col-span-8 space-y-10">
              <div className="flex items-center justify-between">
                 <h3 className="text-xs font-black text-gray-500 uppercase tracking-widest italic">Personal Activo & Credenciales</h3>
                 <span className="text-[8px] bg-green-500/10 text-green-500 px-3 py-1 rounded-full font-black uppercase tracking-widest italic">Sync Biometry: OK</span>
              </div>
              
              <div className="grid grid-cols-1 gap-6">
                 {employees.map(emp => (
                   <div key={emp.id} className="bg-[#111114] border border-white/5 p-10 rounded-[3.5rem] flex flex-col md:flex-row gap-10 items-center group hover:border-blue-500/20 transition-all shadow-2xl">
                      <div className="w-24 h-24 rounded-[2rem] bg-gray-900 border-2 border-white/5 overflow-hidden grayscale group-hover:grayscale-0 transition-all shadow-xl">
                         <img src={`https://i.pravatar.cc/150?u=${emp.id}`} className="w-full h-full object-cover" />
                      </div>
                      <div className="flex-1 space-y-4">
                         <div>
                            <h4 className="text-2xl font-black italic uppercase text-white leading-none mb-1">{emp.name}</h4>
                            <span className="text-[10px] text-blue-500 font-black uppercase tracking-[0.2em] italic">{emp.role}</span>
                         </div>
                         <div className="flex flex-wrap gap-2">
                            {emp.credentials?.map(c => (
                               <span key={c.id} className="bg-blue-600 text-white text-[8px] font-black px-3 py-1.5 rounded-full uppercase tracking-widest flex items-center gap-2 shadow-lg">
                                  <Award size={10} /> {c.name}
                               </span>
                            ))}
                            <span className="bg-white/5 text-gray-500 text-[8px] font-black px-3 py-1.5 rounded-full uppercase tracking-widest">Efficiency: {emp.efficiency}%</span>
                         </div>
                      </div>
                      <div className="flex flex-col items-end gap-3 min-w-[150px]">
                         <span className="text-[10px] font-black text-gray-600 uppercase tracking-widest">Base Sugerida</span>
                         <span className="text-xl font-black italic text-white">$ {emp.base_salary.toLocaleString()}</span>
                         <button className="bg-white/5 hover:bg-blue-600 hover:text-white px-6 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest border border-white/5 transition-all">LIQUIDAR</button>
                      </div>
                   </div>
                 ))}
              </div>
           </div>

           <div className="lg:col-span-4 space-y-8">
              <div className="bg-[#111114] p-8 rounded-[3rem] border border-white/5 shadow-2xl">
                 <div className="flex items-center gap-3 mb-8">
                    <Fingerprint className="text-blue-500" size={20} />
                    <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-widest italic">Reputation Signal Core</h4>
                 </div>
                 <div className="space-y-8">
                    <ReputationMetric label="Puntualidad Agregada" value={98} target={95} />
                    <ReputationMetric label="Calidad de Servicio (FOH)" value={92} target={85} />
                    <ReputationMetric label="Retención Promedio" value={8.4} target={6.0} suffix="meses" />
                 </div>
              </div>

              <div className="bg-gradient-to-br from-green-600/10 to-transparent p-10 rounded-[3rem] border border-green-500/10 shadow-xl">
                 <h4 className="text-[10px] font-black text-green-500 uppercase tracking-[0.3em] mb-4">Compliance Note</h4>
                 <p className="text-xs text-gray-500 italic leading-relaxed">
                   "El sistema ha validado 241 reportes de nómina electrónica para este periodo. Todo el personal cumple con la Ley de Transparencia Salarial."
                 </p>
              </div>
           </div>
        </div>
      ) : (
        <div className="py-40 text-center opacity-30">
           <Lock size={48} className="mx-auto mb-4" />
           <p className="text-sm font-black uppercase tracking-widest italic">Capa de Cumplimiento DIAN Encriptada.</p>
        </div>
      )}
    </div>
  );
};

const TabBtn = ({ active, onClick, icon, label }: any) => (
  <button onClick={onClick} className={`px-8 py-3.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-3 shrink-0 ${active ? 'bg-blue-600 text-white shadow-xl shadow-blue-600/20' : 'text-gray-500 hover:text-white'}`}>
    {icon} {label}
  </button>
);

const ReputationMetric = ({ label, value, target, suffix = "%" }: any) => (
  <div className="space-y-3">
     <div className="flex justify-between items-center text-[10px] font-black uppercase tracking-widest">
        <span className="text-gray-500">{label}</span>
        <span className={value >= target ? 'text-green-500' : 'text-orange-500'}>{value}{suffix}</span>
     </div>
     <div className="h-1 w-full bg-white/5 rounded-full overflow-hidden">
        <div className={`h-full ${value >= target ? 'bg-green-500 shadow-[0_0_10px_rgba(34,197,94,0.4)]' : 'bg-orange-500'} transition-all duration-1000`} style={{ width: `${Math.min(100, (value/target)*80)}%` }}></div>
     </div>
  </div>
);

export default PayrollModule;
