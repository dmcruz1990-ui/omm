
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
  LogOut
} from 'lucide-react';
import { GoogleGenAI } from "@google/genai";
import { PayrollEmployee, ShiftPayroll } from '../types.ts';

const PayrollModule: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'live' | 'shifts' | 'compliance' | 'simulator' | 'case_study'>('live');
  const [selectedCase, setSelectedCase] = useState<1 | 2>(1);
  const [loading, setLoading] = useState(true);
  const [aiAnalysis, setAiAnalysis] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  
  // Estado para Nota de Ajuste (Casos Juan y Carlos)
  const [bonusValue, setBonusValue] = useState(120000); // Caso 1
  const [incapacityDays, setIncapacityDays] = useState(5); // Caso 2
  const [isAdjusting, setIsAdjusting] = useState(false);

  // Mock de Empleados
  const [employees] = useState<PayrollEmployee[]>([
    { id: 'E1', name: 'JUAN PÉREZ', role: 'SERVICIO', contract_type: 'INDEFINIDO', salary_base: 1600000, efficiency_score: 94, status_dian: 'ENVIADO', cufe: '8b7f...3e12' },
    { id: 'E2', name: 'MARÍA LÓPEZ', role: 'COCINA', contract_type: 'FIJO', salary_base: 2200000, efficiency_score: 88, status_dian: 'ENVIADO', cufe: '1a2b...9d0c' },
    { id: 'E3', name: 'CARLOS RUÍZ', role: 'BAR', contract_type: 'OBRA_LABOR', salary_base: 1600000, efficiency_score: 72, status_dian: 'PENDIENTE' },
    { id: 'E000980', name: 'CARLOS ROJAS', role: 'COCINA', contract_type: 'INDEFINIDO', salary_base: 2400000, efficiency_score: 91, status_dian: 'PENDIENTE' },
  ]);

  const [shifts] = useState<ShiftPayroll[]>([
    { id: 'S1', label: 'Almuerzo Mar (12-16h)', sales: 4500000, staff_cost: 1200000, hours_man: 16, efficiency: 281250 },
    { id: 'S2', label: 'Cena Mar (18-23h)', sales: 12800000, staff_cost: 2100000, hours_man: 25, efficiency: 512000 },
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
        contents: `Analiza este escenario de nómina para un restaurante Casual Premium. Genera una recomendación táctica.`,
      });
      setAiAnalysis(response.text);
    } catch (e) {
      setAiAnalysis("Sugerencia IA: El caso de Carlos Rojas (Retiro) impacta el flujo de caja en $3M. Se recomienda provisionar el 8% mensual de la nómina bruta para mitigar picos de liquidaciones finales.");
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

  // Cálculos Caso 2 (Carlos - Heavy)
  const c2_salaryBase = 2400000;
  const c2_salaryProportional = 1714286; // 20 días
  const c2_incapacityValue = ( (c2_salaryBase / 28) * 0.6667 ) * incapacityDays;
  const c2_vacationsEnjoyed = 342857; // 4 días
  const c2_vacationsCompensated = 257143; // 3 días
  const c2_prima = 340000;
  const c2_cesantias = 340000;
  const c2_intereses = 5780;
  const c2_totalDevengado = c2_salaryProportional + c2_incapacityValue + c2_vacationsEnjoyed + c2_vacationsCompensated + c2_prima + c2_cesantias + c2_intereses;
  const c2_health = 93714;
  const c2_pension = 93714;
  const c2_libranza = 80000;
  const c2_totalDeducciones = c2_health + c2_pension + c2_libranza;
  const c2_neto = c2_totalDevengado - c2_totalDeducciones;

  if (loading) return (
    <div className="h-full flex flex-col items-center justify-center opacity-40">
      <Loader2 className="animate-spin text-blue-500 mb-4" size={48} />
      <p className="text-[10px] font-black uppercase tracking-widest italic">Accediendo a Nexus Payroll Core...</p>
    </div>
  );

  return (
    <div className="space-y-12 animate-in fade-in duration-700 text-left pb-20">
      
      {/* HEADER DE MÓDULO */}
      <div className="flex flex-col xl:flex-row gap-8 justify-between items-start xl:items-center border-b border-white/5 pb-10">
        <div className="flex items-center gap-6">
           <div className="p-5 bg-blue-600 rounded-[2rem] shadow-2xl shadow-blue-600/30">
              <Briefcase size={32} className="text-white" />
           </div>
           <div>
              <h2 className="text-4xl font-black italic tracking-tighter uppercase leading-none">Intelligence Payroll</h2>
              <p className="text-gray-500 text-[10px] font-black uppercase tracking-[0.4em] mt-3 flex items-center gap-2">
                 <ShieldCheck size={14} className="text-green-500" /> Sincronización DIAN & Eficiencia Operativa
              </p>
           </div>
        </div>

        <div className="flex bg-[#111114] p-1.5 rounded-2xl border border-white/5 overflow-x-auto">
          <TabBtn active={activeTab === 'live'} onClick={() => setActiveTab('live')} icon={<Activity size={14} />} label="LIQUIDACIÓN" />
          <TabBtn active={activeTab === 'case_study'} onClick={() => setActiveTab('case_study')} icon={<Database size={14} />} label="EJEMPLOS REALES" />
          <TabBtn active={activeTab === 'shifts'} onClick={() => setActiveTab('shifts')} icon={<Clock size={14} />} label="POR TURNO" />
          <TabBtn active={activeTab === 'compliance'} onClick={() => setActiveTab('compliance')} icon={<Lock size={14} />} label="DIAN SYNC" />
          <TabBtn active={activeTab === 'simulator'} onClick={() => setActiveTab('simulator')} icon={<Brain size={14} />} label="SIMULADOR IA" />
        </div>
      </div>

      {activeTab === 'case_study' && (
        <div className="space-y-12 animate-in slide-in-from-bottom-4 duration-700">
           
           {/* Selector de Casos */}
           <div className="flex gap-4">
              <button 
                onClick={() => setSelectedCase(1)}
                className={`flex-1 p-6 rounded-3xl border-2 transition-all flex items-center gap-4 ${selectedCase === 1 ? 'bg-blue-600 border-blue-400 shadow-xl' : 'bg-[#111114] border-white/5 opacity-50'}`}
              >
                 <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center font-black italic">1</div>
                 <div className="text-left">
                    <span className="text-xs font-black uppercase text-white block">Caso Juan Pérez</span>
                    <span className="text-[8px] font-bold text-blue-100 uppercase">Mesero / Atlantis PV01</span>
                 </div>
              </button>
              <button 
                onClick={() => setSelectedCase(2)}
                className={`flex-1 p-6 rounded-3xl border-2 transition-all flex items-center gap-4 ${selectedCase === 2 ? 'bg-purple-600 border-purple-400 shadow-xl' : 'bg-[#111114] border-white/5 opacity-50'}`}
              >
                 <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center font-black italic">2</div>
                 <div className="text-left">
                    <span className="text-xs font-black uppercase text-white block">Caso Carlos Rojas (HEAVY)</span>
                    <span className="text-[8px] font-bold text-purple-100 uppercase">Cocinero / Retiro & Novedades</span>
                 </div>
              </button>
           </div>

           {selectedCase === 1 ? (
             <div className="space-y-12 animate-in fade-in duration-500">
                <div className="bg-[#1a1a1e] border-2 border-blue-500/20 p-10 rounded-[3.5rem] flex flex-col lg:flex-row gap-10 items-center justify-between shadow-2xl overflow-hidden relative">
                   <div className="absolute top-0 right-0 p-10 opacity-5"><Building2 size={200} className="text-blue-500" /></div>
                   <div className="space-y-6 relative z-10 max-w-2xl">
                      <div className="inline-flex items-center gap-2 bg-blue-600/10 px-4 py-1.5 rounded-full text-[10px] font-black text-blue-400 uppercase tracking-widest italic">
                         <Building2 size={12} /> Seratta Atlantis S.A.S. - NIT: 901.234.567-1
                      </div>
                      <h2 className="text-5xl font-black italic tracking-tighter uppercase leading-none text-white">Juan Pérez <span className="text-blue-500">/ Mesero</span></h2>
                   </div>
                   <div className="bg-black/60 p-8 rounded-[3rem] border border-white/10 text-center shrink-0 min-w-[280px]">
                      <span className="text-[10px] text-gray-500 font-black uppercase block mb-2">Neto Pagado</span>
                      <span className="text-4xl font-black italic text-green-500 tracking-tighter">$ {(c1_totalDevengado - c1_deducciones).toLocaleString()}</span>
                   </div>
                </div>

                <div className="grid grid-cols-1 xl:grid-cols-3 gap-10">
                   <div className="xl:col-span-2 space-y-10">
                      <div className="bg-[#111114] border border-white/5 rounded-[4rem] p-12 shadow-2xl">
                         <div className="flex items-center justify-between mb-12">
                            <h3 className="text-2xl font-black italic uppercase tracking-tighter">Detalle DSNE (Enero)</h3>
                            <button 
                             onClick={() => { setIsAdjusting(true); setTimeout(() => { setBonusValue(150000); setIsAdjusting(false); }, 1000); }}
                             className="bg-orange-600/10 hover:bg-orange-600 text-orange-500 hover:text-white px-6 py-3 rounded-2xl text-[9px] font-black uppercase tracking-widest transition-all flex items-center gap-2 border border-orange-500/20"
                            >
                              {isAdjusting ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />} 
                              {bonusValue === 150000 ? 'AJUSTE APLICADO' : 'SIMULAR AJUSTE BONO'}
                            </button>
                         </div>
                         <div className="grid grid-cols-1 md:grid-cols-2 gap-16">
                            <div className="space-y-6">
                               <h4 className="text-[10px] font-black text-green-500 uppercase tracking-widest mb-4">Devengados</h4>
                               <LineItem label="Salario Básico" value={c1_baseSalary} />
                               <LineItem label="Auxilio Transporte" value={c1_auxTransport} />
                               <LineItem label="Horas Extra (8h)" value={c1_extraHours} />
                               <LineItem label="Dominicales/Festivos" value={c1_sundays} />
                               <LineItem label="Bonificación" value={bonusValue} isHighlighted={bonusValue === 150000} />
                            </div>
                            <div className="space-y-6">
                               <h4 className="text-[10px] font-black text-red-500 uppercase tracking-widest mb-4">Deducciones</h4>
                               <LineItem label="Salud (4%)" value={71467} isNegative />
                               <LineItem label="Pensión (4%)" value={71467} isNegative />
                               <LineItem label="Libranza" value={50000} isNegative />
                            </div>
                         </div>
                      </div>
                      <CanonicalViewer data={{ document_id: "NE-ATL-2026-01-E001", employee: "JUAN PEREZ", total: c1_totalDevengado - c1_deducciones }} />
                   </div>
                   <div className="space-y-8">
                      <AuditSidebar cufe="8b7f...3e12" hours={138} />
                   </div>
                </div>
             </div>
           ) : (
             <div className="space-y-12 animate-in fade-in duration-500">
                <div className="bg-gradient-to-br from-[#1a1a1e] to-[#0d0d0f] border-2 border-purple-500/20 p-10 rounded-[3.5rem] flex flex-col lg:flex-row gap-10 items-center justify-between shadow-2xl overflow-hidden relative">
                   <div className="absolute top-0 right-0 p-10 opacity-5"><Building2 size={200} className="text-purple-500" /></div>
                   <div className="space-y-6 relative z-10 max-w-2xl">
                      <div className="inline-flex items-center gap-2 bg-purple-600/10 px-4 py-1.5 rounded-full text-[10px] font-black text-purple-400 uppercase tracking-widest italic">
                         <Building2 size={12} /> Sede Calle 114 - Punto PV03
                      </div>
                      <h2 className="text-5xl font-black italic tracking-tighter uppercase leading-none text-white">Carlos Rojas <span className="text-purple-500">/ Cocinero</span></h2>
                      <p className="text-gray-400 text-sm italic font-medium">Liquidación Final de Contrato Indefinido - Retiro: 20 Feb 2026</p>
                   </div>
                   <div className="bg-black/60 p-8 rounded-[3rem] border border-white/10 text-center shrink-0 min-w-[280px]">
                      <span className="text-[10px] text-gray-500 font-black uppercase block mb-2">Pago Liquidación Final</span>
                      <span className="text-4xl font-black italic text-green-500 tracking-tighter">$ {Math.round(c2_neto).toLocaleString()}</span>
                      <div className="mt-4 flex items-center justify-center gap-2 text-[9px] font-black text-purple-400 uppercase">
                         <LogOut size={12} /> Cierre Contable OK
                      </div>
                   </div>
                </div>

                <div className="grid grid-cols-1 xl:grid-cols-3 gap-10">
                   <div className="xl:col-span-2 space-y-10">
                      {/* Línea de Novedades - Diferencial NEXUM */}
                      <div className="bg-[#111114] border border-white/5 rounded-[4rem] p-12 shadow-2xl">
                         <h3 className="text-2xl font-black italic uppercase tracking-tighter mb-10 flex items-center gap-3">
                            <Activity size={24} className="text-purple-500" /> Resolución de Novedades (Feb)
                         </h3>
                         <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            <NovedadCard icon={<Stethoscope size={18} />} title="Incapacidad" period="06-10 Feb" days={incapacityDays} color="text-red-400" />
                            <NovedadCard icon={<Plane size={18} />} title="Vac. Disfrutadas" period="17-20 Feb" days={4} color="text-blue-400" />
                            <NovedadCard icon={<Plane size={18} />} title="Vac. Compensadas" period="21-23 Feb" days={3} color="text-green-400" isCompensated />
                         </div>
                      </div>

                      {/* Desglose Heavy */}
                      <div className="bg-[#111114] border border-white/5 rounded-[4rem] p-12 shadow-2xl">
                         <div className="flex items-center justify-between mb-12">
                            <h3 className="text-2xl font-black italic uppercase tracking-tighter">Desglose Fiscal UBL 2.1</h3>
                            <button 
                             onClick={() => { setIsAdjusting(true); setTimeout(() => { setIncapacityDays(6); setIsAdjusting(false); }, 1000); }}
                             className="bg-purple-600/10 hover:bg-purple-600 text-purple-500 hover:text-white px-6 py-3 rounded-2xl text-[9px] font-black uppercase tracking-widest transition-all flex items-center gap-2 border border-purple-500/20"
                            >
                              {isAdjusting ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />} 
                              {incapacityDays === 6 ? 'AJUSTE APLICADO' : 'AJUSTAR DÍAS INCAPACIDAD'}
                            </button>
                         </div>
                         <div className="grid grid-cols-1 md:grid-cols-2 gap-16">
                            <div className="space-y-6">
                               <h4 className="text-[10px] font-black text-green-500 uppercase tracking-widest mb-4">Devengados (Liquidación)</h4>
                               <LineItem label="Salario Prop. (20 d)" value={c2_salaryProportional} />
                               <LineItem label={`Incapacidad (${incapacityDays} d)`} value={Math.round(c2_incapacityValue)} />
                               <LineItem label="Vacaciones Disfr. (4 d)" value={c2_vacationsEnjoyed} />
                               <LineItem label="Vacaciones Comp. (3 d)" value={c2_vacationsCompensated} />
                               <LineItem label="Prima Proporcional" value={c2_prima} />
                               <LineItem label="Cesantías Prop." value={c2_cesantias} />
                               <LineItem label="Int. Cesantías" value={c2_intereses} />
                            </div>
                            <div className="space-y-6">
                               <h4 className="text-[10px] font-black text-red-500 uppercase tracking-widest mb-4">Deducciones Finales</h4>
                               <LineItem label="Salud (4% s/ base)" value={c2_health} isNegative />
                               <LineItem label="Pensión (4% s/ base)" value={c2_pension} isNegative />
                               <LineItem label="Libranza Final" value={c2_libranza} isNegative />
                               <div className="pt-10 border-t border-white/5">
                                  <div className="bg-black/40 p-6 rounded-3xl">
                                     <span className="text-[8px] text-gray-500 font-black uppercase block mb-1">Base Aportes Auditoría</span>
                                     <span className="text-xl font-black italic text-white">$ {Math.round(c2_salaryProportional + c2_incapacityValue + c2_vacationsEnjoyed).toLocaleString()}</span>
                                  </div>
                               </div>
                            </div>
                         </div>
                      </div>
                      <CanonicalViewer data={{ document_id: "NE-PV03-2026-02-E980", type: "LIQUIDACION_FINAL", employee: "CARLOS ROJAS", neto: Math.round(c2_neto) }} />
                   </div>

                   <div className="space-y-8">
                      <div className="bg-[#111114] border border-white/5 p-10 rounded-[3.5rem] shadow-2xl">
                         <h4 className="text-xs font-black text-gray-500 uppercase tracking-widest mb-8 flex items-center gap-2">
                            <History size={16} className="text-purple-500" /> Trazabilidad de Retiro
                         </h4>
                         <div className="space-y-6">
                            <div className="flex flex-col gap-2">
                               <span className="text-[10px] text-gray-500 font-black uppercase">Días Año 2026</span>
                               <span className="text-xl font-black italic text-white">51 Días</span>
                            </div>
                            <div className="flex flex-col gap-2">
                               <span className="text-[10px] text-gray-500 font-black uppercase">Motivo Retiro</span>
                               <span className="text-lg font-black italic text-purple-400">RENUNCIA VOLUNTARIA</span>
                            </div>
                            <div className="pt-6 border-t border-white/5">
                               <div className="flex justify-between items-center">
                                  <span className="text-[10px] text-gray-500 font-black uppercase">Soporte Incapacidad</span>
                                  <span className="text-[10px] font-black italic text-blue-500 underline cursor-pointer">INC-00031.pdf</span>
                               </div>
                            </div>
                         </div>
                      </div>
                      <AuditSidebar cufe="abc_adj_heavy..." hours={102} />
                   </div>
                </div>
             </div>
           )}

        </div>
      )}

      {activeTab === 'live' && (
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
                          {employees.map(emp => (
                             <tr key={emp.id} className="group hover:bg-white/[0.01] transition-colors">
                                <td className="px-8 py-6">
                                   <div className="flex flex-col">
                                      <span className="text-xs font-black uppercase italic text-white leading-none mb-1">{emp.name}</span>
                                      <span className="text-[8px] text-gray-600 font-bold uppercase">ID: {emp.id}</span>
                                   </div>
                                </td>
                                <td className="px-8 py-6">
                                   <span className={`text-[9px] font-black uppercase tracking-widest px-2 py-1 rounded-lg border ${emp.role === 'COCINA' ? 'text-purple-400 bg-purple-400/5 border-purple-400/10' : 'text-blue-400 bg-blue-400/5 border-blue-400/10'}`}>
                                      {emp.role}
                                   </span>
                                </td>
                                <td className="px-8 py-6">
                                   <span className="text-xs font-bold text-gray-400">$ {emp.salary_base.toLocaleString()}</span>
                                </td>
                                <td className="px-8 py-6">
                                   <div className="flex items-center gap-3">
                                      <div className="w-12 h-1.5 bg-white/5 rounded-full overflow-hidden">
                                         <div className={`h-full ${emp.efficiency_score > 90 ? 'bg-green-500' : 'bg-blue-500'}`} style={{ width: `${emp.efficiency_score}%` }}></div>
                                      </div>
                                      <span className="text-[10px] font-black italic">{emp.efficiency_score}%</span>
                                   </div>
                                </td>
                                <td className="px-8 py-6 text-right">
                                   <button 
                                    onClick={() => {
                                      setActiveTab('case_study');
                                      setSelectedCase(emp.id === 'E1' ? 1 : 2);
                                    }}
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

              <div className="space-y-8">
                 <div className="bg-[#111114] border border-white/5 p-8 rounded-[3.5rem] shadow-2xl">
                    <h3 className="text-xs font-black text-gray-500 uppercase tracking-widest mb-8 flex items-center gap-2">
                       <AlertTriangle size={16} className="text-orange-500" /> Alertas Operativas
                    </h3>
                    <div className="space-y-6">
                       <AlertRow label="Retiro Detectado" detail="Carlos Rojas (Liquidación Pendiente)" type="critical" />
                       <AlertRow label="Recargos Nocturnos" detail="Cena Sábado +24% vs Media" type="warning" />
                       <AlertRow label="Horas Extra" detail="Barista concentrando 12h semanales" type="warning" />
                    </div>
                 </div>
                 <div className="bg-blue-600 p-10 rounded-[4rem] relative overflow-hidden shadow-2xl shadow-blue-600/20 group">
                    <div className="absolute top-0 right-0 p-8 opacity-10 group-hover:scale-110 transition-transform"><TrendingUp size={120} fill="white" /></div>
                    <h4 className="text-xs font-black text-white/80 uppercase tracking-widest mb-6 italic">Métrica de Oro OMM</h4>
                    <span className="text-5xl font-black italic text-white tracking-tighter leading-none">$ 412k</span>
                    <p className="text-[10px] text-blue-100 font-bold uppercase mt-3 tracking-widest">Ventas / Hora Hombre Hoy</p>
                 </div>
              </div>
           </div>
        </div>
      )}

      {/* Otras tabs permanecen como esqueletos funcionales o completos si es necesario */}
      {activeTab === 'shifts' && (
        <div className="py-40 text-center opacity-40"><Clock size={48} className="mx-auto mb-4" /><p className="text-xs font-black uppercase tracking-widest">Análisis de eficiencia por turno en sincronía con SevenRooms...</p></div>
      )}
      {activeTab === 'compliance' && (
        <div className="py-40 text-center opacity-40"><ShieldCheck size={48} className="mx-auto mb-4" /><p className="text-xs font-black uppercase tracking-widest">Estado de transmisión UBL 2.1 ante la DIAN...</p></div>
      )}
      {activeTab === 'simulator' && (
        <div className="py-40 text-center">
           <button onClick={runAiSimulation} disabled={isAnalyzing} className="bg-blue-600 px-12 py-6 rounded-[2.5rem] font-black italic text-sm uppercase tracking-widest transition-all">
             {isAnalyzing ? <Loader2 className="animate-spin mx-auto" /> : 'ACTIVAR SIMULADOR IA'}
           </button>
           {aiAnalysis && <p className="mt-12 text-gray-400 italic max-w-2xl mx-auto">"{aiAnalysis}"</p>}
        </div>
      )}

    </div>
  );
};

// Componentes Auxiliares
const TabBtn = ({ active, onClick, icon, label }: any) => (
  <button onClick={onClick} className={`px-8 py-3.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-3 shrink-0 ${active ? 'bg-blue-600 text-white shadow-xl shadow-blue-600/20' : 'text-gray-500 hover:text-white'}`}>
    {icon} {label}
  </button>
);

const LineItem = ({ label, value, isNegative, isHighlighted }: any) => (
  <div className={`flex justify-between items-center ${isHighlighted ? 'bg-blue-600/10 p-2 rounded-lg -mx-2 animate-pulse' : ''}`}>
     <span className="text-[11px] font-bold text-gray-400 uppercase tracking-tight italic">{label}</span>
     <span className={`text-sm font-black font-mono italic ${isNegative ? 'text-red-400' : 'text-white'}`}>
        {isNegative ? '-' : ''}$ {value.toLocaleString()}
     </span>
  </div>
);

const NovedadCard = ({ icon, title, period, days, color, isCompensated }: any) => (
  <div className="bg-black/40 border border-white/10 p-6 rounded-3xl space-y-4">
     <div className={`w-10 h-10 rounded-xl flex items-center justify-center bg-white/5 ${color}`}>
        {icon}
     </div>
     <div>
        <h4 className="text-xs font-black uppercase text-white mb-1">{title}</h4>
        <p className="text-[9px] text-gray-500 font-bold uppercase">{period}</p>
     </div>
     <div className="flex justify-between items-center pt-2 border-t border-white/5">
        <span className="text-[8px] text-gray-600 font-black uppercase">{isCompensated ? 'COMPENSADO' : 'DISFRUTADO'}</span>
        <span className={`text-xs font-black italic ${color}`}>{days} Días</span>
     </div>
  </div>
);

const CanonicalViewer = ({ data }: any) => (
  <div className="bg-black border border-white/5 rounded-[4rem] p-12 shadow-2xl relative group">
     <div className="absolute top-8 right-12 flex gap-4">
        <span className="text-[9px] font-black text-blue-500 uppercase tracking-widest flex items-center gap-2">
           <FileCode size={14} /> DIAN_UBL_XML_SCHEMA
        </span>
     </div>
     <h3 className="text-xl font-black italic uppercase tracking-tighter text-gray-500 mb-8">Canonical Data Object (Internal)</h3>
     <div className="bg-[#050505] p-8 rounded-3xl border border-white/5 font-mono text-[11px] text-blue-300 leading-relaxed overflow-x-auto max-h-[300px] custom-scrollbar">
        <pre>{JSON.stringify(data, null, 2)}</pre>
     </div>
  </div>
);

const AuditSidebar = ({ cufe, hours }: any) => (
  <div className="bg-[#111114] border border-white/5 p-10 rounded-[3.5rem] shadow-2xl space-y-10">
     <div>
        <h4 className="text-xs font-black text-gray-500 uppercase tracking-widest mb-8 flex items-center gap-2">
           <Clock size={16} className="text-blue-500" /> Resumen Operativo
        </h4>
        <div className="space-y-6">
           <div className="flex justify-between items-center">
              <span className="text-[10px] text-gray-500 font-black uppercase">Horas Mes</span>
              <span className="text-xl font-black italic text-white">{hours}h</span>
           </div>
           <div className="flex justify-between items-center">
              <span className="text-[10px] text-gray-500 font-black uppercase">Estado DIAN</span>
              <span className="bg-green-600/10 text-green-500 px-3 py-1 rounded-full text-[8px] font-black">ACCEPTED</span>
           </div>
        </div>
     </div>
     <div className="bg-blue-600 p-8 rounded-[3rem] relative overflow-hidden group">
        <ShieldCheck size={80} className="absolute -bottom-4 -right-4 opacity-10 group-hover:scale-110 transition-transform" />
        <h4 className="text-[10px] font-black text-white/80 uppercase tracking-widest mb-4">CUFE SYNC</h4>
        <p className="text-[11px] font-mono text-white/60 break-all">{cufe}</p>
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
        <span className={`text-[10px] font-black px-2 py-1 rounded-lg bg-white/5 ${trend.includes('+') || trend === '!' ? 'text-orange-500' : 'text-green-500'}`}>
           {trend}
        </span>
     </div>
  </div>
);

const AlertRow = ({ label, detail, type }: any) => (
  <div className="flex items-center gap-4 group">
     <div className={`w-2 h-2 rounded-full ${type === 'critical' ? 'bg-red-500 animate-pulse' : type === 'warning' ? 'bg-orange-500' : 'bg-green-500'}`}></div>
     <div>
        <span className="text-[10px] font-black text-white uppercase italic leading-none block mb-1">{label}</span>
        <span className="text-[9px] text-gray-500 font-bold uppercase tracking-tight">{detail}</span>
     </div>
  </div>
);

const ComplianceMetric = ({ label, status }: any) => (
  <div className="flex justify-between items-center border-b border-white/5 pb-4">
     <span className="text-[10px] text-gray-500 font-black uppercase italic">{label}</span>
     <span className="text-xs font-black italic text-green-500">{status}</span>
  </div>
);

export default PayrollModule;
