import React, { useState } from 'react';
import { Table, RitualTask } from '../types.ts';
import { 
  Zap, ChevronRight, 
  Flame, Coffee, Receipt, Martini, 
  BellRing, CheckCircle, UserCheck, GlassWater as Bottle,
  LayoutGrid, UtensilsCrossed, Wine, Sparkles
} from 'lucide-react';
import MenuGrid from './MenuGrid.tsx';
import OrderTicket from './OrderTicket.tsx';

interface POSProps {
  tables: any[]; 
  onUpdateTable: (tableId: number, updates: Partial<Table>) => void;
  tasks: RitualTask[];
}

const ServiceOSModule: React.FC<POSProps> = ({ tables, onUpdateTable, tasks }) => {
  const [selectedTableId, setSelectedTableId] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState<'menu' | 'insights'>('menu');

  const selectedTable = tables.find(t => t.id === selectedTableId);

  const handleAttend = async (e: React.MouseEvent, tableId: number) => {
    e.stopPropagation();
    await onUpdateTable(tableId, { status: 'occupied', welcome_timer_start: null });
  };

  const handlePaymentSuccess = () => {
    // Al completar el pago, volvemos a la vista de planta
    setSelectedTableId(null);
  };

  if (!selectedTableId) {
    return (
      <div className="space-y-12 animate-in fade-in duration-700 text-left">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <h2 className="text-4xl font-black italic tracking-tighter uppercase">Service OS | Planta</h2>
            <p className="text-gray-500 text-[10px] font-black uppercase tracking-[0.4em] mt-2 italic">Selecciona una mesa para iniciar servicio</p>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-6">
          {tables.map(table => (
            <button
              key={table.id}
              onClick={() => setSelectedTableId(table.id)}
              className={`group p-8 rounded-[3rem] border-2 transition-all flex flex-col items-center gap-4 relative overflow-hidden ${
                table.status === 'calling' 
                  ? 'bg-red-600/10 border-red-500 animate-pulse' 
                  : table.status === 'occupied' 
                    ? 'bg-blue-600/10 border-blue-500/50' 
                    : 'bg-[#111114] border-white/5 hover:border-white/20'
              }`}
            >
              <span className="text-[10px] font-black uppercase tracking-widest opacity-40">MESA</span>
              <span className="text-5xl font-black italic">{table.id}</span>
              <span className={`text-[8px] font-black uppercase tracking-widest px-3 py-1 rounded-full ${
                table.status === 'free' ? 'bg-green-500/10 text-green-500' : 'bg-blue-500/10 text-blue-500'
              }`}>
                {table.status}
              </span>
            </button>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col lg:flex-row gap-8 h-full animate-in fade-in duration-700 overflow-hidden text-left">
      {/* Sidebar de Navegación Rápida de Mesas */}
      <div className="w-full lg:w-[280px] flex flex-col gap-4 shrink-0 overflow-y-auto custom-scrollbar pr-2">
        <button 
          onClick={() => setSelectedTableId(null)}
          className="bg-white/5 hover:bg-white/10 p-5 rounded-[1.8rem] text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2 mb-4 border border-white/5"
        >
          <LayoutGrid size={14} /> VOLVER A PLANTA
        </button>
        
        {tables.map(table => (
          <button
            key={table.id}
            onClick={() => setSelectedTableId(table.id)}
            className={`p-4 rounded-2xl border transition-all flex items-center justify-between ${
              selectedTableId === table.id 
                ? 'bg-blue-600 border-blue-500 text-white shadow-xl' 
                : 'bg-[#111114] border-white/5 text-gray-500'
            }`}
          >
            <span className="font-black italic">MESA {table.id}</span>
            <div className={`w-2 h-2 rounded-full ${table.status === 'calling' ? 'bg-red-500 animate-pulse' : table.status === 'occupied' ? 'bg-blue-400' : 'bg-green-500'}`}></div>
          </button>
        ))}
      </div>

      {/* Columna Central: Menú de Pedidos */}
      <div className="flex-1 flex flex-col gap-6 overflow-hidden bg-[#0d0d0f] rounded-[3rem] border border-white/5 p-8 shadow-2xl">
        <div className="flex items-center justify-between mb-4">
           <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-blue-600/20 rounded-2xl flex items-center justify-center text-blue-500">
                <UtensilsCrossed size={24} />
              </div>
              <div>
                <h3 className="text-xl font-black italic uppercase tracking-tighter">MENÚ DE SERVICIO</h3>
                <p className="text-[9px] text-gray-500 font-bold uppercase tracking-widest">Atendiendo Mesa {selectedTableId}</p>
              </div>
           </div>
           
           {selectedTable?.status === 'calling' && (
             <button 
              onClick={(e) => handleAttend(e, selectedTableId!)}
              className="bg-red-600 hover:bg-red-500 text-white px-6 py-3 rounded-xl font-black text-[10px] uppercase tracking-widest flex items-center gap-2 animate-bounce"
             >
                <BellRing size={16} /> ATENDER LLAMADO
             </button>
           )}
        </div>

        <div className="flex-1 overflow-y-auto custom-scrollbar pr-2">
           <MenuGrid selectedTableId={selectedTableId} />
        </div>
      </div>

      {/* Columna Derecha: Ticket / Cuenta */}
      <div className="w-full xl:w-[380px] flex flex-col shrink-0">
        <OrderTicket 
          table={selectedTable!} 
          tasks={tasks} 
          onUpdateTable={onUpdateTable} 
          onPaymentSuccess={handlePaymentSuccess}
        />
      </div>
    </div>
  );
};

export default ServiceOSModule;