
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
  Cpu,
  Layers,
  Terminal,
  Play
} from 'lucide-react';
import { GoogleGenAI } from "@google/genai";
import { PayrollEmployee, ShiftPayroll } from '../types.ts';

const PayrollModule: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'live' | 'shifts' | 'compliance' | 'simulator' | 'case_study' | 'architecture'>('live');
  const [selectedCase, setSelectedCase] = useState<1 | 2>(1);
  const [loading, setLoading] = useState(true);
  const [aiAnalysis, setAiAnalysis] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  
  // Estado para Nota de Ajuste
  const [bonusValue, setBonusValue] = useState(120000); 
  const [incapacityDays, setIncapacityDays] = useState(5); 
  const [isAdjusting, setIsAdjusting] = useState(false);

  // Mock de Empleados
  const [employees] = useState<PayrollEmployee[]>([
    { id: 'E1', name: 'JUAN PÉREZ', role: 'SERVICIO', contract_type: 'INDEFINIDO', salary_base: 1600000, efficiency_score: 94, status_dian: 'ENVIADO', cufe: '8b7f...3e12' },
    { id: 'E2', name: 'MARÍA LÓPEZ', role: 'COCINA', contract_type: 'FIJO', salary_base: 2200000, efficiency_score: 88, status_dian: 'ENVIADO', cufe: '1a2b...9d0c' },
    { id: 'E3', name: 'CARLOS RUÍZ', role: 'BAR', contract_type: 'OBRA_LABOR', salary_base: 1600000, efficiency_score: 72, status_dian: 'PENDIENTE' },
    { id: 'E000980', name: 'CARLOS ROJAS', role: 'COCINA', contract_type: 'INDEFINIDO', salary_base: 2400000, efficiency_score: 91, status_dian: 'PENDIENTE' },
  ]);

  useEffect(() => {
    setTimeout(() => setLoading(false), 1200);
  }, []);

  const runAiSimulation = async () => {
    setIsAnalyzing(true);
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    try {
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: `Analiza este flujo de nómina y proporciona una recomendación estratégica de arquitectura de datos.`,
      });
      setAiAnalysis(response.text);
    } catch (e) {
      setAiAnalysis("Sugerencia Arquitectura: Implementar un validador de pre-transmisión que verifique el 'Hash de Integridad' entre el Objeto Canónico y el XML final para evitar rechazos DIAN por redondeo.");
    } finally {
      setIsAnalyzing(false);
    }
  };

  // Cálculos Caso 1 (Juan)
  const c1_baseSalary = 1600000;
  const c1_auxTransport = 162000;
  const c1_extraHours = 66667;
  const c1_sundays = 120000;
  const c1_totalDevengado = c1_baseSalary + c1_auxTransport + c1_extraHours + c1_sundays + bonusValue;
  const c1_deducciones = 192934;

  // Cálculos Caso 2 (Carlos)
  const c2_salaryBase = 2400000;
  const c2_salaryProportional = 1714286;
  const c2_incapacityValue = ( (c2_salaryBase / 28) * 0.6667 ) * incapacityDays;
  const c2_vacationsEnjoyed = 342857;
  const c2_totalDevengado = c2_salaryProportional + c2_incapacityValue + c2_vacationsEnjoyed + 340000 + 340000 + 5780 + 257143;
  const c2_totalDeducciones = 267428;

  if (loading) return (
    <div className="h-full flex flex-col items-center justify-center opacity-40">
      <Loader2 className="animate-spin text-blue-500 mb-4" size={48} />
      <p className="text-[10px] font-black uppercase tracking-widest italic">Cargando Motor Canónico Nexus...</p>
    </div>
  );

  return (
    <div className="space-y-12 animate-in fade-in duration-700 text-left pb-20">
      
      {/* HEADER PRINCIPAL */}
      <div className="flex flex-col xl:flex-row gap-8 justify-between items-start xl:items-center border-b border-white/5 pb-10">
        <div className="flex items-center gap-6">
           <div className="p-5 bg-blue-600 rounded-[2rem] shadow-2xl shadow-blue-600/30">
              <Briefcase size={32} className="text-white" />
           </div>
           <div>
              <h2 className="text-4xl font-black italic tracking-tighter uppercase leading-none">Intelligence Payroll</h2>
              <p className="text-gray-500 text-[10px] font-black uppercase tracking-[0.4em] mt-3 flex items-center gap-2">
                 <ShieldCheck size={14} className="text-green-500" /> Modelado por Capas UBL 2.1
              </p>
           </div>
        </div>

        <div className="flex bg-[#111114] p-1.5 rounded-2xl border border-white/5 overflow-x-auto">
          <TabBtn active={activeTab === 'live'} onClick={() => setActiveTab('live')} icon={<Activity size={14} />} label="RESUMEN" />
          <TabBtn active={activeTab === 'case_study'} onClick={() => setActiveTab('case_study')} icon={<Database size={14} />} label="DOCUMENTOS" />
          <TabBtn active={activeTab === 'architecture'} onClick={() => setActiveTab('architecture')} icon={<Cpu size={14} />} label="ARQUITECTURA" />
          <TabBtn active={activeTab === 'compliance'} onClick={() => setActiveTab('compliance')} icon={<Lock size={14} />} label="DIAN SYNC" />
          <TabBtn active={activeTab === 'simulator'} onClick={() => setActiveTab('simulator')} icon={<Brain size={14} />} label="SIMULADOR" />
        </div>
      </div>

      {activeTab === 'architecture' && (
        <div className="space-y-16 animate-in slide-in-from-bottom-4 duration-700">
           {/* Visualización Tip 2: Los Bloques */}
           <div className="bg-[#0d0d0f] border border-white/5 rounded-[4rem] p-16 relative overflow-hidden shadow-2xl">
              <div className="absolute top-0 right-0 p-16 opacity-5 rotate-12"><Layers size={200} className="text-blue-500" /></div>
              
              <div className="relative z-10 space-y-16">
                 <div className="text-center max-w-2xl mx-auto space-y-4">
                    <h3 className="text-4xl font-black italic uppercase tracking-tighter">Arquitectura de Flujo NEXUM</h3>
                    <p className="text-gray-500 italic">"La nómina no es contabilidad, es una tubería de datos modular."</p>
                 </div>

                 <div className="grid grid-cols-1 md:grid-cols-4 lg:grid-cols-7 gap-4">
                    <ArchBlock step="1" label="DATOS MAESTROS" sub="Employer / Staff" active />
                    <ArchBlock step="2" label="NOVEDADES" sub="Events / Days" active />
                    <ArchBlock step="3" label="MOTOR CÁLCULOS" sub="Rule Engine" active />
                    <ArchBlock step="4" label="OBJETO CANÓNICO" sub="Internal JSON" active color="border-blue-500 bg-blue-500/10" />
                    <ArchBlock step="5" label="MAPPER UBL" sub="XML Generator" />
                    <ArchBlock step="6" label="TRANSMISIÓN" sub="API Provider" />
                    <ArchBlock step="7" label="RESPUESTA DIAN" sub="CUFE / Status" />
                 </div>

                 <div className="bg-blue-600/5 border border-blue-500/20 p-10 rounded-[3rem] flex gap-10 items-center">
                    <Terminal size={32} className="text-blue-500" />
                    <div className="flex-1">
                       <h4 className="text-xs font-black uppercase text-blue-400 mb-2">Tip de Ingeniería #1: Objeto Canónico</h4>
                       <p className="text-gray-400 text-sm italic font-medium leading-relaxed">
                          NEXUM separa la lógica de negocio de la lógica fiscal. Antes de generar el XML para la DIAN, construimos un **Objeto Canónico** que contiene toda la verdad del mes. Si la DIAN cambia sus reglas, solo cambiamos el "Traductor (Step 5)", no todo el sistema.
                       </p>
                    </div>
                 </div>
              </div>
           </div>

           {/* Visualización Tip 5: Máquina de Estados */}
           <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
              <div className="lg:col-span-2 bg-[#111114] border border-white/5 p-12 rounded-[4rem] shadow-2xl">
                 <h3 className="text-2xl font-black italic uppercase tracking-tighter mb-10">Máquina de Estados del Documento</h3>
                 <div className="flex items-center justify-between relative px-4">
                    <div className="absolute top-1/2 left-0 right-0 h-0.5 bg-white/5 -translate-y-1/2"></div>
                    <StateNode label="DRAFT" status="complete" />
                    <StateNode label="VALIDATED" status="complete" />
                    <StateNode label="APPROVED" status="active" />
                    <StateNode label="SENT" status="pending" />
                    <StateNode label="ACCEPTED" status="pending" />
                    <StateNode label="ADJUSTED" status="pending" />
                 </div>
                 <div className="mt-16 bg-black/40 p-8 rounded-3xl border border-white/5">
                    <p className="text-xs text-gray-500 font-medium italic">
                       "Un documento en estado **APPROVED** está bloqueado para edición. Cualquier cambio posterior disparará automáticamente una **Nota de Ajuste** manteniendo el rastro de auditoría original." (Tip 6)
                    </p>
                 </div>
              </div>

              <div className="bg-gradient-to-br from-green-600/10 to-transparent border border-green-500/20 p-10 rounded-[4rem] flex flex-col justify-center text-center">
                 <CheckCircle2 size={48} className="text-green-500 mx-auto mb-6" />
                 <h4 className="text-xl font-black italic uppercase text-white mb-2">Idempotencia Garantizada</h4>
                 <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest leading-relaxed">
                   Cada envío al proveedor tecnológico está firmado con un Hash único basado en el Objeto Canónico. No hay duplicidad posible.
                 </p>
              </div>
           </div>
        </div>
      )}

      {activeTab === 'case_study' && (
        <div className="space-y-12 animate-in slide-in-from-bottom-4 duration-700">
           <div className="flex gap-4">
              <button onClick={() => setSelectedCase(1)} className={`flex-1 p-6 rounded-3xl border-2 transition-all ${selectedCase === 1 ? 'bg-blue-600 border-blue-400' : 'bg-[#111114] border-white/5 opacity-50'}`}>
                 <span className="text-xs font-black uppercase text-white">Juan Pérez (Enero)</span>
                 <span className="text-[8px] font-bold text-blue-100 uppercase block">Caso Simple: Salario + Recargos</span>
              </button>
              <button onClick={() => setSelectedCase(2)} className={`flex-1 p-6 rounded-3xl border-2 transition-all ${selectedCase === 2 ? 'bg-purple-600 border-purple-400' : 'bg-[#111114] border-white/5 opacity-50'}`}>
                 <span className="text-xs font-black uppercase text-white">Carlos Rojas (Febrero)</span>
                 <span className="text-[8px] font-bold text-purple-100 uppercase block">Caso Heavy: Novedades + Retiro</span>
              </button>
           </div>

           <div className="grid grid-cols-1 xl:grid-cols-3 gap-10">
              <div className="xl:col-span-2 space-y-10">
                 {/* Visualización Tip 3: El mes es una suma de Novedades */}
                 <div className="bg-[#111114] border border-white/5 rounded-[4rem] p-12 shadow-2xl">
                    <h3 className="text-2xl font-black italic uppercase tracking-tighter mb-10 flex items-center gap-3">
                       <Activity size={24} className="text-blue-500" /> Línea de Vida del Mes (Tip 3)
                    </h3>
                    <div className="space-y-8">
                       <TimelineBar period={selectedCase === 1 ? 'ENERO 2026' : 'FEBRERO 2026'} days={selectedCase === 1 ? 31 : 28} 
                        events={selectedCase === 1 ? [
                          { start: 1, end: 31, label: 'Vinculación Activa', color: 'bg-blue-500' }
                        ] : [
                          { start: 1, end: 20, label: 'Vinculación Activa', color: 'bg-purple-500' },
                          { start: 6, end: 10, label: 'Incapacidad', color: 'bg-red-500' },
                          { start: 17, end: 20, label: 'Vac. Disfrutadas', color: 'bg-blue-500' }
                        ]} />
                       <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-4">
                          <LegendItem color="bg-blue-500" label="Normal" />
                          <LegendItem color="bg-red-500" label="Incapacidad" />
                          <LegendItem color="bg-purple-500" label="Liquidación" />
                          <LegendItem color="bg-green-500" label="Vacaciones" />
                       </div>
                    </div>
                 </div>

                 {/* Tip 8: Debugging de Cálculos */}
                 <div className="bg-black border border-white/5 rounded-[4rem] p-12 shadow-2xl">
                    <h3 className="text-xl font-black italic uppercase tracking-tighter text-blue-500 mb-8 flex items-center gap-3">
                       <Terminal size={18} /> Trace de Cálculos Matemáticos (Tip 8)
                    </h3>
                    <div className="space-y-4 font-mono text-[11px] text-gray-400">
                       {selectedCase === 1 ? (
                         <>
                           <div className="flex justify-between border-b border-white/5 pb-2">
                              <span>VALOR_HORA_ORDINARIA</span>
                              <span className="text-white">1,600,000 / 240 = $ 6,666.67</span>
                           </div>
                           <div className="flex justify-between border-b border-white/5 pb-2">
                              <span>HORAS_EXTRA_DIURNAS (Factor 1.25)</span>
                              <span className="text-white">8h * (6,666.67 * 1.25) = $ 66,667</span>
                           </div>
                           <div className="flex justify-between text-blue-400 font-black">
                              <span>TOTAL_DEVENGADO_NETO</span>
                              <span>$ {(c1_totalDevengado).toLocaleString()}</span>
                           </div>
                         </>
                       ) : (
                         <>
                           <div className="flex justify-between border-b border-white/5 pb-2">
                              <span>DIAS_VINCULADOS (Feb 1-20)</span>
                              <span className="text-white">20 Días</span>
                           </div>
                           <div className="flex justify-between border-b border-white/5 pb-2">
                              <span>LIQUIDACION_VACACIONES_COMPENSADAS</span>
                              <span className="text-white">(2,400,000 / 28) * 3 Días = $ 257,143</span>
                           </div>
                           <div className="flex justify-between text-purple-400 font-black">
                              <span>NETO_FINAL_LIQUIDACION</span>
                              <span>$ {Math.round(c2_totalDevengado - c2_totalDeducciones).toLocaleString()}</span>
                           </div>
                         </>
                       )}
                    </div>
                 </div>
              </div>

              <div className="space-y-8">
                 <div className="bg-[#111114] border border-white/5 p-10 rounded-[3.5rem] shadow-2xl">
                    <h4 className="text-xs font-black text-gray-500 uppercase tracking-widest mb-8">Resumen Fiscal</h4>
                    <div className="space-y-6">
                       <LineItem label="Document ID" value={selectedCase === 1 ? "NE-ATL-234" : "LIQ-PV03-980"} isText />
                       <LineItem label="Estado Motor" value="PROCESADO" isText color="text-green-500" />
                       <LineItem label="Validación UBL" value="EXITOSA" isText color="text-green-500" />
                    </div>
                 </div>
                 <CanonicalViewer data={{ 
                    meta: { tip: "Paso 4: Objeto Canónico", version: "4.2" },
                    data: selectedCase === 1 ? { base: c1_baseSalary, neto: c1_totalDevengado-c1_deducciones } : { base: c2_salaryBase, neto: c2_totalDevengado-c2_totalDeducciones }
                 }} />
              </div>
           </div>
        </div>
      )}

      {activeTab === 'live' && (
        <div className="space-y-10">
           <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              <KpiCard label="Nómina Total Mes" value="$34.2M" sub="28.4% Ventas" trend="+1.2%" color="text-blue-500" />
              <KpiCard label="Efficiency Score" value="88%" sub="Media Grupal" trend="+4%" color="text-green-500" />
              <KpiCard label="Estado Transmisión" value="100%" sub="CUFE OK" trend="Ready" color="text-blue-500" />
              <KpiCard label="Alertas Fiscales" value="0" sub="Sincronizado" trend="OK" color="text-green-500" />
           </div>

           <div className="lg:col-span-2 space-y-6">
              <h3 className="text-xs font-black text-gray-500 uppercase tracking-widest flex items-center gap-2 mb-4">
                 <Users size={14} /> Gestión Operativa de Nómina
              </h3>
              <div className="bg-[#111114] border border-white/5 rounded-[3rem] overflow-hidden shadow-2xl">
                 <table className="w-full text-left">
                    <thead>
                       <tr className="bg-black/20 text-[8px] font-black text-gray-600 uppercase tracking-[0.3em]">
                          <th className="px-8 py-6">Colaborador</th>
                          <th className="px-8 py-6">Estado Proceso</th>
                          <th className="px-8 py-6">Neto Estimado</th>
                          <th className="px-8 py-6 text-right">Detalle</th>
                       </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                       {employees.map(emp => (
                          <tr key={emp.id} className="group hover:bg-white/[0.01]">
                             <td className="px-8 py-6">
                                <div className="flex flex-col">
                                   <span className="text-xs font-black uppercase italic text-white leading-none mb-1">{emp.name}</span>
                                   <span className="text-[8px] text-gray-600 font-bold uppercase">{emp.role}</span>
                                </div>
                             </td>
                             <td className="px-8 py-6">
                                <div className="flex items-center gap-2">
                                   <div className={`w-1.5 h-1.5 rounded-full ${emp.status_dian === 'ENVIADO' ? 'bg-green-500' : 'bg-orange-500'} animate-pulse`}></div>
                                   <span className="text-[9px] font-black uppercase text-gray-400">{emp.status_dian}</span>
                                </div>
                             </td>
                             <td className="px-8 py-6">
                                <span className="text-xs font-black text-white">$ {emp.salary_base.toLocaleString()}</span>
                             </td>
                             <td className="px-8 py-6 text-right">
                                <button 
                                 onClick={() => { setActiveTab('case_study'); setSelectedCase(emp.id === 'E1' ? 1 : 2); }}
                                 className="p-3 bg-white/5 rounded-xl hover:bg-blue-600 hover:text-white transition-all"
                                >
                                   <ChevronRight size={14} />
                                </button>
                             </td>
                          </tr>
                       ))}
                    </tbody>
                 </table>
              </div>
           </div>
        </div>
      )}

      {/* Otras Tabs esqueletos */}
      {activeTab === 'compliance' && (
        <div className="py-40 text-center opacity-40 animate-pulse"><Lock size={48} className="mx-auto mb-4" /><p className="text-xs font-black uppercase tracking-widest italic">Mapeando Objeto Canónico a XML UBL 2.1...</p></div>
      )}
      {activeTab === 'simulator' && (
        <div className="py-40 text-center">
           <button onClick={runAiSimulation} disabled={isAnalyzing} className="bg-blue-600 px-12 py-6 rounded-[2.5rem] font-black italic text-sm uppercase tracking-widest transition-all shadow-xl">
             {isAnalyzing ? <Loader2 className="animate-spin mx-auto" /> : 'Sugerencia de Arquitectura IA'}
           </button>
           {aiAnalysis && <div className="mt-12 bg-[#111114] border border-white/5 p-8 rounded-[2rem] max-w-2xl mx-auto"><p className="text-gray-400 italic text-sm">"{aiAnalysis}"</p></div>}
        </div>
      )}

    </div>
  );
};

// COMPONENTES AUXILIARES ARQUITECTURA
const ArchBlock = ({ step, label, sub, active, color }: any) => (
  <div className={`flex flex-col items-center text-center p-4 rounded-2xl border-2 transition-all ${active ? (color || 'border-white/10 bg-white/5') : 'border-white/5 opacity-20'}`}>
     <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-[10px] font-black mb-3 shadow-lg">{step}</div>
     <span className="text-[8px] font-black uppercase text-white mb-1 leading-tight">{label}</span>
     <span className="text-[7px] font-bold text-gray-500 uppercase">{sub}</span>
  </div>
);

const StateNode = ({ label, status }: { label: string, status: 'complete' | 'active' | 'pending' }) => (
  <div className="flex flex-col items-center relative z-10">
     <div className={`w-10 h-10 rounded-2xl flex items-center justify-center border-2 transition-all ${status === 'complete' ? 'bg-green-600 border-green-400 text-white' : status === 'active' ? 'bg-blue-600 border-blue-400 text-white animate-pulse' : 'bg-[#1a1a1e] border-white/5 text-gray-600'}`}>
        {status === 'complete' ? <CheckCircle2 size={18} /> : <Play size={18} />}
     </div>
     <span className="text-[8px] font-black uppercase tracking-widest mt-3 text-gray-400">{label}</span>
  </div>
);

const TimelineBar = ({ period, days, events }: any) => (
  <div className="space-y-4">
     <div className="flex justify-between items-end">
        <span className="text-xs font-black italic text-gray-400">{period}</span>
        <span className="text-[10px] font-bold text-gray-600">{days} DÍAS</span>
     </div>
     <div className="h-12 w-full bg-white/5 rounded-2xl overflow-hidden flex relative border border-white/10">
        {events.map((ev: any, idx: number) => (
          <div 
            key={idx} 
            className={`h-full ${ev.color} absolute border-x border-black/20 flex items-center justify-center overflow-hidden group cursor-help`}
            style={{ 
              left: `${((ev.start - 1) / days) * 100}%`, 
              width: `${((ev.end - ev.start + 1) / days) * 100}%` 
            }}
          >
             <span className="text-[8px] font-black uppercase text-white opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap px-2">
                {ev.label}
             </span>
          </div>
        ))}
     </div>
  </div>
);

const LegendItem = ({ color, label }: any) => (
  <div className="flex items-center gap-2">
     <div className={`w-2 h-2 rounded-full ${color}`}></div>
     <span className="text-[8px] font-black uppercase text-gray-500">{label}</span>
  </div>
);

const TabBtn = ({ active, onClick, icon, label }: any) => (
  <button onClick={onClick} className={`px-8 py-3.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-3 shrink-0 ${active ? 'bg-blue-600 text-white shadow-xl shadow-blue-600/20' : 'text-gray-500 hover:text-white'}`}>
    {icon} {label}
  </button>
);

const LineItem = ({ label, value, isNegative, isHighlighted, isText, color }: any) => (
  <div className={`flex justify-between items-center ${isHighlighted ? 'bg-blue-600/10 p-2 rounded-lg -mx-2 animate-pulse' : ''}`}>
     <span className="text-[11px] font-bold text-gray-400 uppercase tracking-tight italic">{label}</span>
     {isText ? (
       <span className={`text-[10px] font-black italic uppercase ${color || 'text-white'}`}>{value}</span>
     ) : (
       <span className={`text-sm font-black font-mono italic ${isNegative ? 'text-red-400' : 'text-white'}`}>
          {isNegative ? '-' : ''}$ {value.toLocaleString()}
       </span>
     )}
  </div>
);

const CanonicalViewer = ({ data }: any) => (
  <div className="bg-black border border-white/5 rounded-[4rem] p-12 shadow-2xl relative group">
     <div className="absolute top-8 right-12 flex gap-4">
        <span className="text-[9px] font-black text-blue-500 uppercase tracking-widest flex items-center gap-2">
           <FileCode size={14} /> INTERNAL_MODEL_VIEW
        </span>
     </div>
     <h3 className="text-xl font-black italic uppercase tracking-tighter text-gray-500 mb-8 leading-none">Step 4: Canonical Object</h3>
     <div className="bg-[#050505] p-8 rounded-3xl border border-white/5 font-mono text-[11px] text-blue-300 leading-relaxed overflow-x-auto max-h-[300px] custom-scrollbar">
        <pre>{JSON.stringify(data, null, 2)}</pre>
     </div>
  </div>
);

const KpiCard = ({ label, value, sub, trend, color }: any) => (
  <div className="bg-[#111114] border border-white/5 p-8 rounded-[2.5rem] shadow-xl hover:border-white/10 transition-all">
     <span className="text-[9px] text-gray-600 font-black uppercase tracking-[0.2em] block mb-4 italic">{label}</span>
     <div className="flex items-end justify-between">
        <div>
           <span className={`text-4xl font-black italic tracking-tighter ${color} leading-none`}>{value}</span>
           <p className="text-[10px] text-gray-400 font-bold uppercase mt-2 tracking-tight">{sub}</p>
        </div>
        <span className={`text-[10px] font-black px-2 py-1 rounded-lg bg-white/5 ${trend.includes('+') || trend === 'OK' || trend === 'Ready' ? 'text-green-500' : 'text-orange-500'}`}>
           {trend}
        </span>
     </div>
  </div>
);

export default PayrollModule;
