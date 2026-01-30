
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
  Percent
} from 'lucide-react';
import FinanceAutopilot from './FinanceAutopilot.tsx';
import FinanceModule from './FinanceModule.tsx';

const FinanceHub: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'autopilot' | 'ledger'>('autopilot');

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
            <p className="text-gray-500 text-[10px] font-black uppercase tracking-[0.4em] mt-3">Sincronización Fiscal & EBITDA OMM</p>
          </div>
        </div>

        <div className="flex bg-[#111114] p-2 rounded-2xl border border-white/5">
          <button 
            onClick={() => setActiveTab('autopilot')}
            className={`px-8 py-3.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-3 ${activeTab === 'autopilot' ? 'bg-blue-600 text-white shadow-xl' : 'text-gray-500 hover:text-white'}`}
          >
            <Zap size={14} /> AUTOPILOT
          </button>
          <button 
            onClick={() => setActiveTab('ledger')}
            className={`px-8 py-3.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-3 ${activeTab === 'ledger' ? 'bg-blue-600 text-white shadow-xl' : 'text-gray-500 hover:text-white'}`}
          >
            <FileText size={14} /> LIBRO MAYOR
          </button>
        </div>
      </div>

      {/* Renderizado condicional del contenido */}
      <div className="animate-in slide-in-from-bottom-2 duration-500">
        {activeTab === 'autopilot' ? (
          <FinanceAutopilot />
        ) : (
          <FinanceModule />
        )}
      </div>

      {/* Footer de Auditoría Permanente */}
      <div className="flex items-center justify-center gap-6 opacity-30 text-[9px] font-black uppercase tracking-[0.3em] text-white pt-10 border-t border-white/5">
         <ShieldCheck size={14} />
         <span>Conexión Segura OMM_FINANCE_GW</span>
         <div className="w-1.5 h-1.5 rounded-full bg-green-500"></div>
      </div>
    </div>
  );
};

export default FinanceHub;
