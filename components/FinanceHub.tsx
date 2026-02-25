
import React, { useState } from 'react';
import { 
  DollarSign, 
  Zap, 
  FileText, 
  ShieldCheck,
  Lock,
  Unlock,
  CheckCircle2,
  ShieldAlert,
  ChevronRight
} from 'lucide-react';
import FinanceAutopilot from './FinanceAutopilot.tsx';
import FinanceModule from './FinanceModule.tsx';

const FinanceHub: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'autopilot' | 'ledger' | 'closing'>('autopilot');
  const [isClosing, setIsClosing] = useState(false);

  // Mock de blockers para el cierre (Nivel Auditoría)
  const blockers = [
    { id: 1, label: 'Conciliación de Inventario', status: 'fail', desc: 'Merma Atún Bluefin no justificada (Mesa 04)' },
    { id: 2, label: 'Match de Facturación DIAN', status: 'pass', desc: 'CUFE Sync 100% (2,412 registros)' },
    { id: 3, label: 'Gastos sin Clasificar (IA)', status: 'fail', desc: '4 registros requieren validación humana' },
    { id: 4, label: 'Nómina Variable Pendiente', status: 'pass', desc: 'Sincronizado con StaffHub' }
  ];

  const canClose = blockers.every(b => b.status === 'pass');

  return (
    <div className="space-y-10 animate-in fade-in duration-700 max-w-7xl mx-auto pb-20 text-left">
      {/* Header unificado del Hub Financiero */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-8 border-b border-white/5 pb-10">
        <div className="flex items-center gap-6">
          <div className="p-5 bg-green-600 rounded-[2rem] shadow-2xl shadow-green-600/20">
            <DollarSign className="text-white" size={32} />
          </div>
          <div>
            <h2 className="text-4xl font-black italic tracking-tighter uppercase leading-none">Finance Intelligence</h2>
            <p className="text-gray-500 text-[10px] font-black uppercase tracking-[0.4em] mt-3 italic italic">Sincronización Fiscal & Sector Benchmarks OMM_V4</p>
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
             {/* Consola de Cierre Preventivo */}
             <div className="bg-[#111114] border border-white/5 rounded-[4rem] p-16 text-center relative overflow-hidden shadow-2xl">
                <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-b from-blue-600/5 to-transparent opacity-50"></div>
                <div className="relative z-10">
                   <div className="w-24 h-24 bg-white/5 rounded-[2.5rem] flex items-center justify-center mx-auto mb-8 border border-white/10 shadow-inner">
                      {canClose ? <Unlock size={48} className="text-green-500" /> : <Lock size={48} className="text-red-500 animate-pulse" />}
                   </div>
                   <h3 className="text-4xl font-black italic uppercase tracking-tighter mb-4">Consola de Cierre de Mes</h3>
                   <p className="text-gray-500 text-sm italic max-w-md mx-auto leading-relaxed">
                      El cierre de mes bloquea el libro mayor y congela las cifras para reporte contable final. NEXUM prohíbe el cierre si existen anomalías fiscales o discrepancias operativas.
                   </p>
                </div>
             </div>

             {/* Auditoría de Blockers */}
             <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {blockers.map(b => (
                   <div key={b.id} className="bg-[#111114] border border-white/5 p-8 rounded-[2.5rem] flex items-center gap-6 group hover:border-white/10 transition-all">
                      <div className={`p-3 rounded-2xl ${b.status === 'pass' ? 'bg-green-600/10 text-green-500' : 'bg-red-600/10 text-red-500'}`}>
                         {b.status === 'pass' ? <CheckCircle2 size={24} /> : <ShieldAlert size={24} />}
                      </div>
                      <div className="flex-1">
                         <h4 className="text-xs font-black uppercase tracking-widest text-white">{b.label}</h4>
                         <p className="text-[10px] text-gray-600 font-bold uppercase italic mt-1">{b.desc}</p>
                      </div>
                      <ChevronRight size={16} className="text-gray-800 group-hover:text-gray-400 transition-colors" />
                   </div>
                ))}
             </div>

             <div className="flex flex-col items-center gap-6 pt-10">
                <button 
                  disabled={!canClose || isClosing}
                  onClick={() => setIsClosing(true)}
                  className="bg-blue-600 hover:bg-blue-500 disabled:bg-gray-800 disabled:text-gray-500 text-white px-16 py-6 rounded-[2.5rem] font-black italic text-sm uppercase tracking-widest shadow-2xl transition-all active:scale-95 flex items-center gap-4"
                >
                   {isClosing ? 'PROCESANDO CIERRE FISCAL...' : 'CONGELAR Y CERRAR MES'}
                </button>
                <div className="flex items-center gap-4 opacity-50">
                   <div className="flex items-center gap-2">
                      <div className="w-1.5 h-1.5 rounded-full bg-green-500"></div>
                      <span className="text-[8px] text-gray-500 font-black uppercase tracking-widest">DIAN INTEGRATION OK</span>
                   </div>
                   <div className="flex items-center gap-2">
                      <div className="w-1.5 h-1.5 rounded-full bg-blue-500"></div>
                      <span className="text-[8px] text-gray-500 font-black uppercase tracking-widest">AUDITORÍA ACTIVA</span>
                   </div>
                </div>
             </div>
          </div>
        )}
      </div>

      <div className="flex items-center justify-center gap-6 opacity-30 text-[9px] font-black uppercase tracking-[0.3em] text-white pt-10 border-t border-white/5">
         <ShieldCheck size={14} />
         <span>NEXUM_FINANCIAL_GATEWAY_CONNECTED</span>
         <div className="w-1.5 h-1.5 rounded-full bg-green-500"></div>
      </div>
    </div>
  );
};

const TabBtn = ({ active, onClick, icon, label }: { active: boolean, onClick: () => void, icon: React.ReactNode, label: string }) => (
  <button onClick={onClick} className={`px-8 py-3.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-3 ${active ? 'bg-blue-600 text-white shadow-xl shadow-blue-600/20' : 'text-gray-500 hover:text-white'}`}>
    {icon} {label}
  </button>
);

export default FinanceHub;
