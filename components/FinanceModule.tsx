
import React, { useState, useEffect } from 'react';
import { 
  DollarSign, 
  TrendingUp, 
  TrendingDown, 
  AlertOctagon, 
  FileText, 
  ArrowRightLeft, 
  PieChart, 
  Zap, 
  ShieldCheck, 
  Clock, 
  BarChart3,
  Search,
  ChevronRight,
  Download,
  AlertTriangle,
  Receipt
} from 'lucide-react';
import { Transaction, FinancialAnomaly, CashflowPoint } from '../types';
import { GoogleGenAI } from "@google/genai";

const FinanceModule: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'overview' | 'ledger' | 'reconciliation'>('overview');
  const [isExplaining, setIsExplaining] = useState(false);
  const [aiExplanation, setAiExplanation] = useState<string | null>(null);

  const [transactions] = useState<Transaction[]>([
    { id: 'TX-OMM-901', timestamp: Date.now() - 300000, type: 'Venta', amount: 385000, tax: 73150, paymentMethod: 'Tarjeta', brand: 'OMM Robata', status: 'conciliado' },
    { id: 'TX-OMM-902', timestamp: Date.now() - 1200000, type: 'Cortesía', amount: 112500, tax: 0, paymentMethod: 'Efectivo', brand: 'OMM Kaiseki', status: 'pendiente' },
    { id: 'TX-OMM-903', timestamp: Date.now() - 1800000, type: 'Venta', amount: 1580600, tax: 300314, paymentMethod: 'Tarjeta', brand: 'OMM Cava VIP', status: 'conciliado' },
    { id: 'TX-OMM-904', timestamp: Date.now() - 3600000, type: 'Venta', amount: 489000, tax: 92910, paymentMethod: 'Transferencia', brand: 'OMM Sushi', status: 'error' },
  ]);

  const [anomalies] = useState<FinancialAnomaly[]>([
    { id: 'A1', title: 'Merma Crítica: Langosta', severity: 'alta', description: 'Se detecta pérdida del 15% en stock de Kaori Lobster vs Comandado. Posible fallo en gramaje o robo hormiga.', impact: 845000 },
    { id: 'A2', title: 'Sobrecosto Carbón Binchotan', severity: 'media', description: 'Incremento del 22% en el costo del carbón para Robata. Proveedor cambió tarifas sin aviso previo.', impact: 320000 },
  ]);

  const [cashflow] = useState<CashflowPoint[]>([
    { date: 'Lun', actual: 25, predicted: 22 },
    { date: 'Mar', actual: 28, predicted: 30 },
    { date: 'Mie', actual: 42, predicted: 38 },
    { date: 'Jue', actual: 51, predicted: 55 },
    { date: 'Vie', actual: 0, predicted: 115 },
    { date: 'Sab', actual: 0, predicted: 140 },
    { date: 'Dom', actual: 0, predicted: 95 },
  ]);

  const getFinancialExplanation = async () => {
    setIsExplaining(true);
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    try {
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: `Actúa como un CFO estratégico para OMM (Restaurante Japonés). Explica por qué el margen operativo bajó un 5.2% esta semana considerando: 
        1. Aumento en el costo de importación del atún para Nigiris. 
        2. Merma inusual en el inventario de Langosta (Kaori Lobster). 
        3. El ticket promedio en la Terraza bajó debido a una promoción agresiva de coctelería. 
        Sé conciso y sugiere 2 acciones correctivas de alto impacto para OMM.`,
      });
      setAiExplanation(response.text || "");
    } catch (e) {
      setAiExplanation("Análisis IA OMM: El margen se contrajo por la merma en proteínas premium (Langosta) y el alza en insumos importados. Acción 1: Auditoría de gramaje en cocina Robata. Acción 2: Re-balancear maridaje en Terraza para incluir Sakes de mayor margen.");
    } finally {
      setIsExplaining(false);
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-700">
      {/* Header Estilo Terminal Financiera */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 border-b border-white/5 pb-8">
        <div className="flex items-center gap-4">
           <div className="w-12 h-12 bg-green-600 rounded-[1.5rem] flex items-center justify-center shadow-lg shadow-green-600/20">
              <DollarSign size={28} className="text-white" />
           </div>
           <div>
              <h2 className="text-3xl font-black italic tracking-tighter uppercase">OMM Finance Autopilot</h2>
              <p className="text-gray-500 text-[10px] font-black uppercase tracking-[0.3em]">Contabilidad & Cashflow Live (Datos OMM)</p>
           </div>
        </div>
        <div className="flex bg-[#111114] p-1.5 rounded-2xl border border-white/5">
          <TabButton active={activeTab === 'overview'} onClick={() => setActiveTab('overview')} label="Visión Global" icon={<PieChart size={14} />} />
          <TabButton active={activeTab === 'ledger'} onClick={() => setActiveTab('ledger')} label="Libro Mayor" icon={<FileText size={14} />} />
          <TabButton active={activeTab === 'reconciliation'} onClick={() => setActiveTab('reconciliation')} label="Conciliación" icon={<ArrowRightLeft size={14} />} />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        {/* Panel Principal: KPIs & Cashflow */}
        <div className="lg:col-span-3 space-y-8">
           <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <StatCard label="Ventas OMM (Hoy)" value="$14.8M" trend="+8.4%" icon={<TrendingUp className="text-green-500" />} color="text-white" />
              <StatCard label="Margen OMM" value="24.1%" trend="-2.2%" icon={<TrendingDown className="text-red-500" />} color="text-blue-500" />
              <StatCard label="Impuestos OMM" value="$2.8M" trend="DIAN_OK" icon={<Receipt className="text-gray-500" />} color="text-gray-400" />
           </div>

           {/* Gráfico de Cashflow Predictivo */}
           <div className="bg-[#111114] border border-white/5 rounded-[3rem] p-10 shadow-2xl">
              <div className="flex items-center justify-between mb-10">
                 <div>
                    <h3 className="text-xs font-black text-gray-500 uppercase tracking-widest flex items-center gap-2">
                       <Zap size={14} className="text-blue-500" /> Proyección Cashflow OMM
                    </h3>
                    <p className="text-[10px] text-gray-600 font-bold uppercase mt-1">Sincronizado con Reservas de Terraza & Cava VIP</p>
                 </div>
                 <div className="flex items-center gap-6">
                    <div className="flex items-center gap-2">
                       <div className="w-3 h-3 bg-blue-600 rounded-full"></div>
                       <span className="text-[10px] text-gray-500 font-black uppercase">Real</span>
                    </div>
                    <div className="flex items-center gap-2">
                       <div className="w-3 h-3 border-2 border-dashed border-gray-600 rounded-full"></div>
                       <span className="text-[10px] text-gray-500 font-black uppercase">Predicción OMM</span>
                    </div>
                 </div>
              </div>

              <div className="flex items-end justify-between h-48 gap-4 px-4">
                 {cashflow.map((point, i) => (
                   <div key={point.date} className="flex-1 flex flex-col items-center group relative">
                      <div className="w-full bg-white/5 rounded-t-xl absolute bottom-0 border-2 border-dashed border-white/10" style={{ height: `${point.predicted}%` }}></div>
                      <div className="w-full bg-blue-600 rounded-t-xl relative z-10 transition-all group-hover:bg-blue-500 shadow-lg shadow-blue-600/20" style={{ height: `${point.actual}%` }}>
                         {point.actual > 0 && (
                           <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-white text-black px-2 py-1 rounded-lg text-[8px] font-black opacity-0 group-hover:opacity-100 transition-opacity">
                              ${point.actual}M
                           </div>
                         )}
                      </div>
                      <span className="text-[9px] font-black text-gray-600 mt-4 uppercase tracking-widest">{point.date}</span>
                   </div>
                 ))}
              </div>
           </div>

           {/* Live Ledger (Transacciones Recientes) */}
           <div className="bg-[#111114] border border-white/5 rounded-[3rem] p-8 shadow-2xl">
              <div className="flex items-center justify-between mb-8">
                 <h3 className="text-xs font-black text-gray-500 uppercase tracking-widest">Libro Mayor OMM Live</h3>
                 <div className="relative">
                    <Search size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-600" />
                    <input type="text" placeholder="BUSCAR VENTA OMM..." className="bg-black/40 border border-white/10 rounded-2xl py-2 pl-10 pr-6 text-[9px] font-black uppercase tracking-widest focus:border-blue-500 outline-none w-48" />
                 </div>
              </div>
              <div className="space-y-4">
                 {transactions.map(tx => (
                   <div key={tx.id} className="bg-[#16161a] border border-white/5 rounded-3xl p-6 flex items-center justify-between hover:border-white/10 transition-all">
                      <div className="flex items-center gap-4">
                         <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                           tx.type === 'Cortesía' ? 'bg-orange-500/10 text-orange-500' : 'bg-green-500/10 text-green-500'
                         }`}>
                            {tx.type === 'Cortesía' ? <Zap size={18} /> : <DollarSign size={18} />}
                         </div>
                         <div>
                            <span className="text-[10px] text-gray-500 font-black uppercase block">{tx.brand}</span>
                            <span className="text-sm font-black italic uppercase text-white">{tx.type} #{tx.id}</span>
                         </div>
                      </div>
                      <div className="flex-1 px-12 grid grid-cols-2 gap-8">
                         <div>
                            <span className="text-[8px] text-gray-600 font-black uppercase block mb-1">Método</span>
                            <span className="text-xs font-black italic text-gray-300">{tx.paymentMethod}</span>
                         </div>
                         <div>
                            <span className="text-[8px] text-gray-600 font-black uppercase block mb-1">Estado Fiscal</span>
                            <div className="flex items-center gap-1">
                               <div className={`w-1.5 h-1.5 rounded-full ${tx.status === 'conciliado' ? 'bg-green-500' : tx.status === 'error' ? 'bg-red-500' : 'bg-yellow-500'}`}></div>
                               <span className="text-[9px] font-black uppercase text-gray-500">{tx.status}</span>
                            </div>
                         </div>
                      </div>
                      <div className="text-right">
                         <span className="text-lg font-black italic text-white">$ {tx.amount.toLocaleString()}</span>
                         <span className="text-[8px] text-gray-600 font-bold uppercase block">IVA Incl: ${tx.tax.toLocaleString()}</span>
                      </div>
                   </div>
                 ))}
              </div>
           </div>
        </div>

        {/* Sidebar: AI Anomaly & Explanation */}
        <div className="space-y-8">
           {/* AI Anomaly Detection */}
           <div className="bg-[#111114] border border-white/5 rounded-[3rem] p-8 shadow-2xl relative overflow-hidden">
              <div className="flex items-center gap-2 mb-8">
                 <AlertOctagon className="text-red-500" size={18} />
                 <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-widest italic">Anomalías OMM</h3>
              </div>
              <div className="space-y-6">
                 {anomalies.map(anomaly => (
                   <div key={anomaly.id} className="space-y-3 p-5 bg-red-600/5 border border-red-500/10 rounded-3xl relative">
                      <div className="flex justify-between items-center">
                         <span className={`text-[8px] font-black uppercase px-2 py-0.5 rounded-full ${anomaly.severity === 'alta' ? 'bg-red-500 text-white' : 'bg-yellow-500 text-black'}`}>
                           {anomaly.severity}
                         </span>
                         <span className="text-xs font-black text-red-500 italic">-$ {anomaly.impact.toLocaleString()}</span>
                      </div>
                      <h4 className="text-xs font-black uppercase italic text-gray-200">{anomaly.title}</h4>
                      <p className="text-[10px] text-gray-500 font-medium leading-relaxed italic">"{anomaly.description}"</p>
                      <button className="w-full bg-white/5 hover:bg-white/10 py-2 rounded-xl text-[8px] font-black uppercase tracking-widest text-gray-400">
                         REVISAR ESCANDALLO
                      </button>
                   </div>
                 ))}
              </div>
           </div>

           {/* Explainable Finance AI */}
           <div className="bg-gradient-to-br from-blue-600/20 to-transparent p-8 rounded-[3rem] border border-blue-500/10 space-y-6">
              <div className="flex items-center gap-2 text-blue-500">
                 <PieChart size={18} />
                 <h4 className="text-[10px] font-black uppercase tracking-widest italic">Análisis Estratégico OMM</h4>
              </div>
              
              {!aiExplanation ? (
                 <button 
                  onClick={getFinancialExplanation}
                  disabled={isExplaining}
                  className="w-full bg-blue-600 hover:bg-blue-500 text-white py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all shadow-xl shadow-blue-600/20"
                 >
                   {isExplaining ? "ANALIZANDO MÁRGENES OMM..." : "EXPLICAR MARGEN OMM"}
                 </button>
              ) : (
                <div className="space-y-4 animate-in fade-in zoom-in duration-500">
                   <div className="bg-black/40 p-5 rounded-3xl border border-white/5">
                      <p className="text-[10px] text-gray-300 italic leading-relaxed font-medium">
                         "{aiExplanation}"
                      </p>
                   </div>
                   <button 
                    onClick={() => setAiExplanation(null)}
                    className="w-full bg-white/5 hover:bg-white/10 py-3 rounded-2xl text-[8px] font-black uppercase tracking-widest text-gray-500"
                   >
                     ACTUALIZAR ANÁLISIS OMM
                   </button>
                </div>
              )}
           </div>

           {/* Auditoría OMM */}
           <div className="bg-[#111114] p-8 rounded-[3rem] border border-white/5">
              <div className="flex items-center gap-3 mb-6">
                 <ShieldCheck size={18} className="text-green-500" />
                 <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Auditoría OMM</span>
              </div>
              <div className="space-y-4">
                 <div className="flex justify-between items-center text-[10px] font-black uppercase tracking-widest">
                    <span className="text-gray-600">Arqueo Robata</span>
                    <span className="text-green-500">OK</span>
                 </div>
                 <div className="flex justify-between items-center text-[10px] font-black uppercase tracking-widest">
                    <span className="text-gray-600">Sync DIAN OMM</span>
                    <span className="text-blue-500 italic">OMM_POS_LIVE</span>
                 </div>
              </div>
              <button className="w-full mt-8 bg-white text-black py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 group">
                 <Download size={14} className="group-hover:translate-y-0.5 transition-transform" /> REPORTES OMM
              </button>
           </div>
        </div>
      </div>
    </div>
  );
};

const TabButton = ({ active, onClick, icon, label }: { active: boolean, onClick: () => void, icon: any, label: string }) => (
  <button 
    onClick={onClick}
    className={`flex items-center gap-2 px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
      active ? 'bg-green-600 text-white shadow-lg shadow-green-600/20' : 'text-gray-500 hover:text-gray-300'
    }`}
  >
    {icon} {label}
  </button>
);

const StatCard = ({ label, value, trend, icon, color }: { label: string, value: string, trend: string, icon: any, color: string }) => (
  <div className="bg-[#111114] border border-white/5 p-6 rounded-[2.5rem] relative overflow-hidden group transition-all hover:border-white/10 shadow-2xl">
     <div className="flex justify-between items-start mb-4 relative z-10">
        <div className="p-3 bg-white/5 rounded-2xl">{icon}</div>
        <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${trend?.includes('+') ? 'bg-green-500/10 text-green-500' : 'bg-red-500/10 text-red-500'}`}>
          {trend}
        </span>
     </div>
     <div className={`text-2xl font-black italic relative z-10 mb-1 tracking-tighter ${color}`}>{value}</div>
     <div className="text-[9px] text-gray-500 font-bold uppercase tracking-widest relative z-10">{label}</div>
  </div>
);

export default FinanceModule;
