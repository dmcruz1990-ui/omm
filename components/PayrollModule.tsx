
import React, { useState, useEffect } from 'react';
import { 
  Briefcase, 
  ShieldCheck, 
  TrendingUp, 
  TrendingDown,
  Zap, 
  FileText, 
  Users, 
  Clock, 
  BarChart3, 
  CheckCircle2, 
  AlertTriangle,
  ChevronRight,
  Search,
  ArrowUpRight,
  Brain,
  History,
  Info,
  Loader2,
  DollarSign,
  Coffee,
  Activity,
  Lock,
  Sparkles,
  FileCode,
  ArrowRightLeft,
  AlertCircle,
  Database,
  RefreshCw,
  Building2,
  UserCheck,
  Stethoscope,
  Plane,
  LogOut,
  Fingerprint,
  Camera
} from 'lucide-react';
import { GoogleGenAI } from "@google/genai";
import { PayrollEmployee, ShiftPayroll, AttendanceLog } from '../types.ts';

const PayrollModule: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'live' | 'shifts' | 'biometry' | 'compliance' | 'simulator' | 'case_study'>('live');
  const [selectedCase, setSelectedCase] = useState<1 | 2>(1);
  const [loading, setLoading] = useState(true);
  
  // Asistencia Biométrica Live Feed
  const [attendanceFeed, setAttendanceFeed] = useState<AttendanceLog[]>([
    { id: '1', staff_id: 'E001', name: 'JUAN PÉREZ', timestamp: new Date().toISOString(), type: 'IN', confidence: 0.98 },
    { id: '2', staff_id: 'E002', name: 'MARÍA LÓPEZ', timestamp: new Date(Date.now() - 3600000).toISOString(), type: 'IN', confidence: 0.99 }
  ]);

  useEffect(() => {
    setTimeout(() => setLoading(false), 1200);
  }, []);

  if (loading) return (
    <div className="h-full flex flex-col items-center justify-center opacity-40">
      <Loader2 className="animate-spin text-blue-500 mb-4" size={48} />
      <p className="text-[10px] font-black uppercase tracking-widest italic">Accediendo a Nexus Payroll Core...</p>
    </div>
  );

  return (
    <div className="space-y-12 animate-in fade-in duration-700 text-left pb-20">
      
      <div className="flex flex-col xl:flex-row gap-8 justify-between items-start xl:items-center border-b border-white/5 pb-10">
        <div className="flex items-center gap-6">
           <div className="p-5 bg-blue-600 rounded-[2rem] shadow-2xl shadow-blue-600/30">
              <Briefcase size={32} className="text-white" />
           </div>
           <div>
              <h2 className="text-4xl font-black italic tracking-tighter uppercase leading-none">Intelligence Payroll</h2>
              <p className="text-gray-500 text-[10px] font-black uppercase tracking-[0.4em] mt-3 flex items-center gap-2">
                 <ShieldCheck size={14} className="text-green-500" /> Sincronización DIAN & Biometría Live
              </p>
           </div>
        </div>

        <div className="flex bg-[#111114] p-1.5 rounded-2xl border border-white/5 overflow-x-auto">
          <TabBtn active={activeTab === 'live'} onClick={() => setActiveTab('live')} icon={<Activity size={14} />} label="LIQUIDACIÓN" />
          <TabBtn active={activeTab === 'biometry'} onClick={() => setActiveTab('biometry')} icon={<Fingerprint size={14} />} label="BIOMETRÍA LIVE" />
          <TabBtn active={activeTab === 'case_study'} onClick={() => setActiveTab('case_study')} icon={<Database size={14} />} label="EJEMPLOS REALES" />
          <TabBtn active={activeTab === 'shifts'} onClick={() => setActiveTab('shifts')} icon={<Clock size={14} />} label="POR TURNO" />
          <TabBtn active={activeTab === 'compliance'} onClick={() => setActiveTab('compliance')} icon={<Lock size={14} />} label="DIAN SYNC" />
        </div>
      </div>

      {activeTab === 'biometry' ? (
        <div className="space-y-12 animate-in slide-in-from-bottom-4 duration-700">
           <div className="bg-[#1a1a1e] border-2 border-blue-500/20 p-12 rounded-[4rem] relative overflow-hidden shadow-2xl">
              <div className="absolute top-0 right-0 p-12 opacity-5"><Camera size={180} className="text-blue-500" /></div>
              <div className="relative z-10 max-w-2xl space-y-6">
                 <div className="inline-flex items-center gap-2 bg-blue-600/10 px-4 py-1.5 rounded-full text-[10px] font-black text-blue-400 uppercase tracking-widest italic">
                    <Zap size={12} /> Sincronización Directa: Surveillance AI -> Payroll
                 </div>
                 <h2 className="text-5xl font-black italic tracking-tighter uppercase leading-none text-white">Biometric Attendance</h2>
                 <p className="text-gray-400 text-lg italic leading-relaxed">
                   El sistema registra automáticamente el tiempo laborado cruzando el reconocimiento facial de las cámaras de CCTV con el ID del colaborador. 
                   <span className="text-white font-bold block mt-4">Eliminamos el fraude de asistencia al 100%.</span>
                 </p>
              </div>
           </div>

           <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
              <div className="lg:col-span-2 bg-[#111114] border border-white/5 rounded-[3rem] overflow-hidden shadow-2xl">
                 <div className="p-8 border-b border-white/5 bg-white/5 flex justify-between items-center">
                    <h3 className="text-xs font-black uppercase tracking-[0.3em] text-gray-500 italic">Feed de Validación en Tiempo Real</h3>
                    <div className="flex items-center gap-2">
                       <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse"></div>
                       <span className="text-[8px] font-black text-green-500 uppercase">Live Sincro</span>
                    </div>
                 </div>
                 <div className="overflow-x-auto">
                    <table className="w-full text-left">
                       <thead>
                          <tr className="bg-black/20 text-[8px] font-black text-gray-600 uppercase tracking-[0.3em]">
                             <th className="px-8 py-6">Colaborador</th>
                             <th className="px-8 py-6">Evento</th>
                             <th className="px-8 py-6">Hora</th>
                             <th className="px-8 py-6">Confianza IA</th>
                          </tr>
                       </thead>
                       <tbody className="divide-y divide-white/5">
                          {attendanceFeed.map(log => (
                             <tr key={log.id} className="group hover:bg-white/[0.01] transition-colors">
                                <td className="px-8 py-6 flex items-center gap-4">
                                   <div className="w-10 h-10 rounded-xl bg-gray-800 border border-white/5 overflow-hidden">
                                      <img src={`https://i.pravatar.cc/100?u=${log.staff_id}`} className="w-full h-full object-cover grayscale" />
                                   </div>
                                   <div className="flex flex-col">
                                      <span className="text-xs font-black uppercase italic text-white leading-none mb-1">{log.name}</span>
                                      <span className="text-[8px] text-gray-600 font-bold uppercase">ID: {log.staff_id}</span>
                                   </div>
                                </td>
                                <td className="px-8 py-6">
                                   <span className={`text-[9px] font-black uppercase tracking-widest px-3 py-1 rounded-lg ${log.type === 'IN' ? 'bg-green-600/10 text-green-500 border border-green-500/20' : 'bg-orange-600/10 text-orange-500 border border-orange-500/20'}`}>
                                      PUNCH_{log.type}
                                   </span>
                                </td>
                                <td className="px-8 py-6 font-mono text-xs text-gray-400">
                                   {new Date(log.timestamp).toLocaleTimeString()}
                                </td>
                                <td className="px-8 py-6">
                                   <div className="flex items-center gap-2">
                                      <span className="text-[10px] font-black italic text-blue-500">{(log.confidence * 100).toFixed(0)}%</span>
                                      <ShieldCheck size={12} className="text-blue-500" />
                                   </div>
                                </td>
                             </tr>
                          ))}
                       </tbody>
                    </table>
                 </div>
              </div>

              <div className="space-y-8">
                 <div className="bg-blue-600 p-10 rounded-[3.5rem] shadow-2xl relative overflow-hidden group">
                    <div className="absolute top-0 right-0 p-10 opacity-10 group-hover:scale-110 transition-transform"><Fingerprint size={120} fill="white" /></div>
                    <h4 className="text-xs font-black text-white/80 uppercase tracking-widest mb-6 italic">Auditoría Operativa</h4>
                    <span className="text-5xl font-black italic text-white tracking-tighter leading-none">0h 00m</span>
                    <p className="text-[10px] text-blue-100 font-bold uppercase mt-3 tracking-widest">Discrepancia Manual vs Bio Hoy</p>
                 </div>
                 <div className="bg-[#111114] border border-white/5 p-8 rounded-[3.5rem]">
                    <h3 className="text-xs font-black text-gray-500 uppercase tracking-widest mb-6 italic">Alertas de Presencia</h3>
                    <div className="space-y-4">
                       <div className="flex items-center gap-3">
                          <AlertCircle size={14} className="text-orange-500" />
                          <span className="text-[10px] font-bold text-gray-400 uppercase">Sin Check-out ayer: E003</span>
                       </div>
                    </div>
                 </div>
              </div>
           </div>
        </div>
      ) : activeTab === 'live' && (
        <div className="space-y-10">
           {/* Global KPI Stats */}
           <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              <KpiCard label="Nómina Total Mes" value="$34.2M" sub="28.4% Ventas" trend="+1.2%" color="text-blue-500" />
              <KpiCard label="Efficiency Score" value="88%" sub="Media Grupal" trend="+4%" color="text-green-500" />
              <KpiCard label="Liquidaciones Pend." value="1" sub="Carlos Rojas" trend="!" color="text-purple-500" />
              <KpiCard label="Deducciones Leg." value="$8.4M" sub="Transmisión OK" trend="0%" color="text-purple-500" />
           </div>

           <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
              <div className="lg:col-span-2 space-y-6">
                 <h3 className="text-xs font-black text-gray-500 uppercase tracking-widest flex items-center gap-2 mb-4">
                    <Users size={14} /> Detalle de Liquidación por Colaborador
                 </h3>
                 <div className="bg-[#111114] border border-white/5 rounded-[3rem] overflow-hidden shadow-2xl">
                    <table className="w-full text-left">
                       <thead>
                          <tr className="bg-black/20 text-[8px] font-black text-gray-600 uppercase tracking-[0.3em]">
                             <th className="px-8 py-6">Colaborador</th>
                             <th className="px-8 py-6">Cargo / Área</th>
                             <th className="px-8 py-6">Salario Base</th>
                             <th className="px-8 py-6">Eficiencia</th>
                             <th className="px-8 py-6 text-right">Acciones</th>
                          </tr>
                       </thead>
                       <tbody className="divide-y divide-white/5">
                          {/* Empleados ... */}
                       </tbody>
                    </table>
                 </div>
              </div>
           </div>
        </div>
      )}

      {/* Otras tabs ... */}
    </div>
  );
};

// Componentes Auxiliares
const TabBtn = ({ active, onClick, icon, label }: any) => (
  <button onClick={onClick} className={`px-8 py-3.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-3 shrink-0 ${active ? 'bg-blue-600 text-white shadow-xl shadow-blue-600/20' : 'text-gray-500 hover:text-white'}`}>
    {icon} {label}
  </button>
);

const KpiCard = ({ label, value, sub, trend, color }: any) => (
  <div className="bg-[#111114] border border-white/5 p-8 rounded-[2.5rem] shadow-xl hover:border-white/10 transition-all">
     <span className="text-[9px] text-gray-600 font-black uppercase tracking-[0.2em] block mb-4 italic">{label}</span>
     <div className="flex items-end justify-between">
        <div>
           <span className={`text-4xl font-black italic tracking-tighter ${color} leading-none`}>{value}</span>
           <p className="text-[10px] text-gray-400 font-bold uppercase mt-2 tracking-tight">{sub}</p>
        </div>
        <span className={`text-[10px] font-black px-2 py-1 rounded-lg bg-white/5 ${trend.includes('+') || trend === '!' ? 'text-orange-500' : 'text-green-500'}`}>
           {trend}
        </span>
     </div>
  </div>
);

export default PayrollModule;
