
import React, { useState } from 'react';
import { Table, RitualTask } from '../types';
import { 
  Sparkles, UtensilsCrossed, Zap, Wine, ChevronRight, 
  Flame, Coffee, Receipt, Martini, Info, GlassWater as Bottle,
  ShoppingBag
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import MenuGrid from './MenuGrid';
import OrderTicket from './OrderTicket';

interface POSProps {
  tables: Table[];
  onUpdateTable: (tableId: number, updates: Partial<Table>) => void;
  tasks: RitualTask[];
}

const RitualSteps = [
  { id: 0, label: 'AGUA', icon: <Bottle size={18} />, responsible: 'MESERO' as const },
  { id: 1, label: 'APERITIVO', icon: <UtensilsCrossed size={18} />, responsible: 'COCINA' as const },
  { id: 2, label: 'COCTEL', icon: <Martini size={18} />, responsible: 'BAR' as const },
  { id: 3, label: 'VINO', icon: <Wine size={18} />, responsible: 'SOMMELIER' as const },
  { id: 4, label: 'FUERTE', icon: <Flame size={18} />, responsible: 'COCINA' as const },
  { id: 5, label: 'POSTRE', icon: <Sparkles size={18} />, responsible: 'COCINA' as const },
  { id: 6, label: 'CAFÉ', icon: <Coffee size={18} />, responsible: 'BAR' as const },
  { id: 7, label: 'CUENTA', icon: <Receipt size={18} />, responsible: 'MESERO' as const },
];

const ServiceOSModule: React.FC<POSProps> = ({ tables, onUpdateTable, tasks }) => {
  const [selectedTableId, setSelectedTableId] = useState<number>(1);
  const [activeTab, setActiveTab] = useState<'copilot' | 'menu' | 'precuenta'>('menu');

  // Safety check: Find table or fallback to first, or null if empty
  const selectedTable = tables.find(t => t.id === selectedTableId) || tables[0];

  if (!selectedTable || tables.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-20 bg-[#111114] rounded-[3rem] border border-white/5 opacity-40">
        <Zap className="text-gray-600 mb-4 animate-pulse" size={48} />
        <p className="text-xs font-black uppercase tracking-widest text-gray-500">Cargando mesas del ecosistema...</p>
      </div>
    );
  }

  const currentStepIdx = selectedTable.ritual_step ?? 0;

  const nextStep = async () => {
    if (currentStepIdx < RitualSteps.length - 1) {
      const nextIdx = currentStepIdx + 1;
      const step = RitualSteps[nextIdx];
      
      // Persistencia en Supabase via Prop Callback
      await onUpdateTable(selectedTable.id, { ritual_step: nextIdx });

      // Registrar la tarea en la tabla 'ritual_tasks' de Supabase
      try {
        await supabase.from('ritual_tasks').insert({
          table_id: selectedTable.id,
          ritual_label: step.label,
          responsible: step.responsible,
          status: 'pending'
        });
      } catch (e) {
        console.error("Error creating ritual task:", e);
      }
    }
  };

  const nextStepLabel = RitualSteps[Math.min(currentStepIdx + 1, RitualSteps.length - 1)]?.label || 'FINALIZAR';

  return (
    <div className="flex flex-col lg:flex-row gap-6 h-full animate-in fade-in duration-700 overflow-hidden">
      {/* Selector de Mesas Lateral (Izquierda) */}
      <div className="w-full lg:w-[280px] flex flex-col gap-4 shrink-0">
        <h3 className="text-[10px] font-black text-gray-500 uppercase tracking-[0.2em] mb-2 px-2">PLANTA OMM REALTIME</h3>
        <div className="grid grid-cols-2 gap-3 overflow-y-auto custom-scrollbar pr-1 max-h-[calc(100vh-320px)]">
          {tables.map(table => (
            <button
              key={table.id}
              onClick={() => setSelectedTableId(table.id)}
              className={`group p-5 rounded-[1.8rem] border-2 transition-all flex flex-col items-center gap-1 relative ${
                selectedTableId === table.id 
                  ? 'bg-[#2563eb] border-[#2563eb] text-white shadow-[0_10px_25px_rgba(37,99,235,0.3)]' 
                  : 'bg-[#111114] border-white/5 text-gray-500 hover:border-white/10'
              }`}
            >
              <span className={`text-[7px] font-black uppercase tracking-widest ${selectedTableId === table.id ? 'text-blue-100' : 'text-gray-700'}`}>
                {table.zone?.split(' ')[0] || 'ZONA'}
              </span>
              <span className="text-3xl font-black italic tracking-tighter leading-none">{table.id.toString().padStart(2, '0')}</span>
              <div className="flex gap-1 mt-2">
                {Array.from({ length: 8 }).map((_, i) => (
                  <div key={i} className={`w-1 h-1 rounded-full ${i < (table.ritual_step ?? 0) ? (selectedTableId === table.id ? 'bg-white' : 'bg-blue-500') : 'bg-white/10'}`}></div>
                ))}
              </div>
              {table.status === 'calling' && (
                <div className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full animate-ping"></div>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Espacio de Trabajo Central (Menú y Ritual) */}
      <div className="flex-1 flex flex-col gap-6 overflow-hidden">
        <div className="bg-[#111114] rounded-[2.5rem] border border-white/5 p-8 shadow-2xl relative overflow-hidden shrink-0">
          <div className="absolute top-4 right-8 bg-blue-600/10 px-3 py-1 rounded-full border border-blue-500/20 flex items-center gap-2">
             <Info size={10} className="text-blue-500" />
             <span className="text-[7px] text-gray-500 font-black uppercase italic">Mesa {selectedTable.id} | Ritual Sync</span>
          </div>

          <div className="flex items-center gap-4 mb-8">
            <div className="w-10 h-10 bg-blue-600/20 rounded-xl flex items-center justify-center text-blue-500">
              <Zap size={20} fill="currentColor" />
            </div>
            <h4 className="text-[11px] font-black uppercase tracking-widest leading-none">RITUAL ENGINE | {selectedTable.zone}</h4>
          </div>

          <div className="flex justify-between items-center relative px-4">
            <div className="absolute top-1/2 left-10 right-10 h-[2px] bg-white/5 -translate-y-1/2"></div>
            {RitualSteps.map((step, idx) => (
              <div key={idx} className="relative z-10 flex flex-col items-center gap-3">
                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center border-2 transition-all duration-500 ${
                  currentStepIdx === idx ? 'bg-blue-600/20 border-blue-500 text-blue-500 shadow-[0_0_20px_rgba(37,99,235,0.2)]' 
                  : idx < currentStepIdx ? 'bg-blue-600 border-blue-600 text-white' 
                  : 'bg-[#16161a] border-white/5 text-gray-700'
                }`}>
                  {step.icon}
                </div>
                <span className={`text-[8px] font-black uppercase tracking-tighter ${currentStepIdx === idx ? 'text-blue-400' : 'text-gray-600'}`}>
                  {step.label}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="flex-1 bg-[#111114] rounded-[3rem] border border-white/5 overflow-hidden flex flex-col shadow-2xl">
          <div className="flex bg-black/30 p-2 border-b border-white/5 shrink-0">
            <TabButton active={activeTab === 'menu'} onClick={() => setActiveTab('menu')} label="MENÚ RÁPIDO" />
            <TabButton active={activeTab === 'copilot'} onClick={() => setActiveTab('copilot')} label="AI COPILOT" />
          </div>

          <div className="flex-1 overflow-y-auto custom-scrollbar p-8">
            {activeTab === 'menu' ? (
              <MenuGrid selectedTableId={selectedTableId} />
            ) : (
              <div className="flex flex-col items-center justify-center py-20 opacity-40 italic text-xs">
                Sugerencias de upsell basadas en historial de cliente de Supabase...
              </div>
            )}
          </div>

          <div className="p-8 mt-auto border-t border-white/5 shrink-0">
            <button 
              onClick={nextStep}
              className="w-full bg-[#2563eb] hover:bg-blue-500 text-white py-6 rounded-[2rem] font-black italic text-sm uppercase tracking-widest flex items-center justify-center gap-4 transition-all shadow-xl active:scale-95"
            >
              AVANZAR RITUAL: {nextStepLabel} 
              <ChevronRight size={20} />
            </button>
          </div>
        </div>
      </div>

      {/* Ticket Digital (Derecha) */}
      <div className="hidden xl:flex w-[350px] flex-col shrink-0">
        <OrderTicket tableId={selectedTableId} />
      </div>
    </div>
  );
};

const TabButton = ({ active, onClick, label }: { active: boolean, onClick: () => void, label: string }) => (
  <button onClick={onClick} className={`flex-1 py-4 rounded-[1.2rem] text-[10px] font-black uppercase tracking-widest transition-all ${
    active ? 'bg-white/5 text-white shadow-inner' : 'text-gray-600 hover:text-white'
  }`}>
    {label}
  </button>
);

export default ServiceOSModule;
