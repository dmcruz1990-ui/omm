
import React, { useState } from 'react';
import { 
  DollarSign, 
  BarChart4, 
  Zap, 
  TrendingUp, 
  FileText, 
  PieChart, 
  ArrowUpRight,
  ShieldCheck,
  Percent,
  Lock,
  Unlock,
  AlertTriangle,
  History,
  CheckCircle2,
  XCircle,
  ShieldAlert,
  // Added ChevronRight icon
  ChevronRight
} from 'lucide-react';
import FinanceAutopilot from './FinanceAutopilot.tsx';
import FinanceModule from './FinanceModule.tsx';

const FinanceHub: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'autopilot' | 'ledger' | 'closing'>('autopilot');
  const [isClosing, setIsClosing] = useState(false);

  // Mock de blockers para el cierre
  const blockers = [
    { id: 1, label: 'Inventario Recibido sin Factura', status: 'fail', desc: 'Pesquera del Mar (Remisión #902)' },
    { id: 2, label: 'Clasificación IA Pendiente', status: 'fail', desc: '4 gastos requieren validación humana' },
    { id: 3, label: 'Conciliación Bancaria', status: 'pass', desc: 'Ventas vs Datafono OK' },
    { id: 4, label: 'Integración DIAN', status: 'pass', desc: 'CUFE Sync 100%' }
  ];

  const canClose = blockers.every(b => b.status === 'pass');

  return (
    <div className="space-y-10 animate-in fade-in duration-700 max-w-7xl mx-auto pb-20 text-left">
      {/* Header unificado del Hub */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-8 border-b border-white/5 pb-10">
        <div className="flex items-center gap-6">
          <div className="p-5 bg-green-600 rounded-[2rem] shadow-2xl shadow-green-600/20">
            <DollarSign className="text-white" size={32} />
          </div>
          <div>
            <h2 className="text-4xl font-black italic tracking-tighter uppercase leading-none">Finance Intelligence</h2>
            <p className="text-gray-500 text-[10px] font-black uppercase tracking-[0.4em] mt-3">Fiscal Sync & Sector Benchmarks</p>
          </div>
        </div>

        <div className="flex bg-[#111114] p-2 rounded-2xl border border-white/5">
          <TabBtn active={activeTab === 'autopilot'} onClick={() => setActiveTab('autopilot')} icon={<Zap size={14} />} label="AUTOPILOT" />
          <TabBtn active={activeTab === 'ledger'} onClick={() => setActiveTab('ledger')} icon={<FileText size={14} />} label="LEDGER" />
          <TabBtn active={activeTab === 'closing'} onClick={() => setActiveTab('closing')} icon={<Lock size={14} />} label="CIERRE" />
        </div>
      </div>

      <div className="animate-in slide-in-from-bottom-2 duration-500">
        {activeTab === 'autopilot' && <FinanceAutopilot />}
        {activeTab === 'ledger' && <FinanceModule />}
        {activeTab === 'closing' && (
          <div className="max-w-4xl mx-auto space-y-12">
             <div className="bg-[#111114] border border-white/5 rounded-[4rem] p-16 text-center relative overflow-hidden shadow-2xl">
                <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-b from-blue-600/5 to-transparent"></div>
                <div className="relative z-10">
                   <div className="w-24 h-24 bg-white/5 rounded-[2.5rem] flex items-center justify-center mx-auto mb-8 border border-white/10">
                      {canClose ? <Unlock size={48} className="text-green-500" /> : <Lock size={48} className="text-red-500" />}
                   </div>
                   <h3 className="text-4xl font-black italic uppercase tracking-tighter mb-4">Consola de Cierre Mensual</h3>
                   <p className="text-gray-500 text-sm italic max-w-md mx-auto leading-relaxed">
                      El cierre de mes congela los datos para reporte contable y genera el P&G final. NEXUM bloquea el cierre si existen discrepancias fiscales u operativas.
                   </p>
                </div>
             </div>

             <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {blockers.map(b => (
                   <div key={b.id} className="bg-[#111114] border border-white/5 p-8 rounded-[2.5rem] flex items-center gap-6">
                      <div className={`p-3 rounded-2xl ${b.status === 'pass' ? 'bg-green-600/10 text-green-500' : 'bg-red-600/10 text-red-500'}`}>
                         {b.status === 'pass' ? <CheckCircle2 size={24} /> : <ShieldAlert size={24} />}
                      </div>
                      <div className="flex-1">
                         <h4 className="text-xs font-black uppercase tracking-widest text-white">{b.label}</h4>
                         <p className="text-[10px] text-gray-600 font-bold uppercase italic mt-1">{b.desc}</p>
                      </div>
                      <ChevronRight size={16} className="text-gray-800" />
                   </div>
                ))}
             </div>

             <div className="flex flex-col items-center gap-6 pt-10">
                <button 
                  disabled={!canClose || isClosing}
                  className="bg-blue-600 hover:bg-blue-500 disabled:bg-gray-800 disabled:text-gray-500 text-white px-16 py-6 rounded-[2.5rem] font-black italic text-sm uppercase tracking-widest shadow-2xl transition-all active:scale-95 flex items-center gap-4"
                >
                   {isClosing ? 'PROCESANDO CIERRE...' : 'CONGELAR Y CERRAR MES'}
                </button>
                <p className="text-[9px] text-gray-700 font-black uppercase tracking-[0.4em] italic flex items-center gap-2">
                   <ShieldCheck size={12} /> Trazabilidad fiscal DIAN asegurada
                </p>
             </div>
          </div>
        )}
      </div>

      <div className="flex items-center justify-center gap-6 opacity-30 text-[9px] font-black uppercase tracking-[0.3em] text-white pt-10 border-t border-white/5">
         <ShieldCheck size={14} />
         <span>Conexión Segura OMM_FINANCE_GW</span>
         <div className="w-1.5 h-1.5 rounded-full bg-green-500"></div>
      </div>
    </div>
  );
};

const TabBtn = ({ active, onClick, icon, label }: any) => (
  <button onClick={onClick} className={`px-8 py-3.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-3 ${active ? 'bg-blue-600 text-white shadow-xl' : 'text-gray-500 hover:text-white'}`}>
    {icon} {label}
  </button>
);

const CareMetric = ({ label, value, color }: any) => (
  <div className="flex justify-between items-center border-b border-white/5 pb-3">
     <span className="text-[10px] text-gray-400 font-bold uppercase">{label}</span>
     <span className={`text-sm font-black italic ${color || 'text-white'}`}>{value}</span>
  </div>
);

export default FinanceHub;
