
import React, { useState, useEffect } from 'react';
import { Table, RitualTask } from '../types.ts';
import { 
  Zap, ChevronRight, 
  Flame, Coffee, Receipt, Martini, 
  BellRing, CheckCircle, UserCheck, GlassWater as Bottle,
  LayoutGrid, UtensilsCrossed, Wine, Sparkles, Clock, PlayCircle, CheckCircle2, Timer
} from 'lucide-react';
import { supabase } from '../lib/supabase.ts';
import { useAuth } from '../contexts/AuthContext.tsx';
import MenuGrid from './MenuGrid.tsx';
import OrderTicket from './OrderTicket.tsx';

interface POSProps {
  tables: any[]; 
  onUpdateTable: (tableId: number, updates: Partial<Table>) => void;
  tasks: RitualTask[];
}

const RITUAL_STEPS = [
  "Agua", 
  "Carta", 
  "Tomar Pedido", 
  "Bebidas", 
  "Entrada", 
  "Plato Fuerte", 
  "Refill", 
  "Postre", 
  "Café", 
  "Cierre"
];

const ServiceOSModule: React.FC<POSProps> = ({ tables, onUpdateTable }) => {
  const { user } = useAuth();
  const [selectedTableId, setSelectedTableId] = useState<number | null>(null);
  const [ritualTasks, setRitualTasks] = useState<RitualTask[]>([]);
  const [isRitualLoading, setIsRitualLoading] = useState(false);

  const selectedTable = tables.find(t => t.id === selectedTableId);

  useEffect(() => {
    if (selectedTableId) {
      fetchRitualData();
      const channel = supabase.channel(`ritual-m${selectedTableId}`)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'ritual_tasks', filter: `table_id=eq.${selectedTableId}` }, () => fetchRitualData())
        .subscribe();
      return () => { supabase.removeChannel(channel); };
    }
  }, [selectedTableId]);

  const fetchRitualData = async () => {
    if (!selectedTableId) return;
    const { data } = await supabase.from('ritual_tasks').select('*').eq('table_id', selectedTableId).order('started_at', { ascending: true });
    setRitualTasks(data || []);
  };

  const startRitualStep = async (stepLabel: string) => {
    if (!user || !selectedTableId) return;
    setIsRitualLoading(true);
    try {
      await supabase.from('ritual_tasks').insert([{
        table_id: selectedTableId,
        step_label: stepLabel,
        staff_id: user.id,
        started_at: new Date().toISOString(),
        status: 'active',
        responsible: 'MESERO'
      }]);
    } catch (err) { console.error(err); }
    finally { setIsRitualLoading(false); }
  };

  const advanceRitualStep = async () => {
    const activeTask = ritualTasks.find(t => t.status === 'active');
    if (!activeTask || !user) return;
    setIsRitualLoading(true);
    try {
      await supabase.from('ritual_tasks').update({ status: 'completed', completed_at: new Date().toISOString() }).eq('id', activeTask.id);
      const nextIndex = RITUAL_STEPS.indexOf(activeTask.step_label) + 1;
      if (nextIndex < RITUAL_STEPS.length) {
        await startRitualStep(RITUAL_STEPS[nextIndex]);
      }
    } catch (err) { console.error(err); }
    finally { setIsRitualLoading(false); }
  };

  const handleAttend = async (e: React.MouseEvent, tableId: number) => {
    e.stopPropagation();
    await onUpdateTable(tableId, { status: 'occupied', welcome_timer_start: null });
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
                table.status === 'calling' ? 'bg-red-600/10 border-red-500 animate-pulse' : 
                table.status === 'occupied' ? 'bg-blue-600/10 border-blue-500/50' : 'bg-[#111114] border-white/5 hover:border-white/20'
              }`}
            >
              <span className="text-[10px] font-black uppercase tracking-widest opacity-40">MESA</span>
              <span className="text-5xl font-black italic">{table.id}</span>
              <span className={`text-[8px] font-black uppercase tracking-widest px-3 py-1 rounded-full ${table.status === 'free' ? 'bg-green-500/10 text-green-500' : 'bg-blue-500/10 text-blue-500'}`}>{table.status}</span>
            </button>
          ))}
        </div>
      </div>
    );
  }

  const activeStepTask = ritualTasks.find(t => t.status === 'active');

  return (
    <div className="flex flex-col lg:flex-row gap-8 h-full animate-in fade-in duration-700 overflow-hidden text-left">
      <div className="w-full lg:w-[280px] flex flex-col gap-4 shrink-0 overflow-y-auto custom-scrollbar pr-2">
        <button onClick={() => setSelectedTableId(null)} className="bg-white/5 hover:bg-white/10 p-5 rounded-[1.8rem] text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2 mb-4 border border-white/5 shadow-lg"><LayoutGrid size={14} /> VOLVER A PLANTA</button>
        {tables.map(table => (
          <button key={table.id} onClick={() => setSelectedTableId(table.id)} className={`p-4 rounded-2xl border transition-all flex items-center justify-between ${selectedTableId === table.id ? 'bg-blue-600 border-blue-500 text-white shadow-xl' : 'bg-[#111114] border-white/5 text-gray-500 hover:border-white/20'}`}>
            <span className="font-black italic">MESA {table.id}</span>
            <div className={`w-2 h-2 rounded-full ${table.status === 'calling' ? 'bg-red-500 animate-pulse' : table.status === 'occupied' ? 'bg-blue-400' : 'bg-green-500'}`}></div>
          </button>
        ))}
      </div>

      <div className="flex-1 flex flex-col gap-8 overflow-hidden">
        {/* RITUAL STEPPER HORIZONTAL ACTUALIZADO */}
        <div className="bg-[#111114] rounded-[3rem] border border-white/10 p-10 shadow-2xl relative overflow-hidden group">
           <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-600/20 via-blue-500 to-blue-600/20 opacity-30"></div>
           <div className="flex items-center justify-between mb-10">
              <div className="flex items-center gap-4">
                 <div className="p-3 bg-blue-600 rounded-2xl text-white shadow-lg shadow-blue-600/20"><Sparkles size={24} /></div>
                 <div>
                   <h3 className="text-xl font-black italic uppercase tracking-tighter text-white">Línea de Tiempo del Ritual OMM</h3>
                   <p className="text-[9px] text-gray-500 font-bold uppercase tracking-widest italic mt-1">Sincronización Operacional en Tiempo Real</p>
                 </div>
              </div>
              <div className="flex gap-3">
                {ritualTasks.length === 0 ? (
                  <button onClick={() => startRitualStep(RITUAL_STEPS[0])} disabled={isRitualLoading} className="bg-red-600 hover:bg-red-500 text-white px-8 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest flex items-center gap-2 animate-pulse transition-all shadow-xl shadow-red-600/20"><PlayCircle size={16} /> INICIAR RITUAL</button>
                ) : activeStepTask ? (
                  <button onClick={advanceRitualStep} disabled={isRitualLoading} className="bg-blue-600 hover:bg-blue-500 text-white px-8 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest flex items-center gap-2 shadow-xl shadow-blue-600/20 transition-all group/btn">
                    SIGUIENTE PASO <ChevronRight size={16} className="group-hover/btn:translate-x-1 transition-transform" />
                  </button>
                ) : (
                  <div className="bg-green-600/10 border border-green-500/30 px-6 py-3 rounded-2xl flex items-center gap-3">
                    <CheckCircle2 size={16} className="text-green-500" />
                    <span className="text-[10px] font-black text-green-500 uppercase italic">RITUAL_COMPLETADO_OK</span>
                  </div>
                )}
              </div>
           </div>

           <div className="relative flex items-center justify-between px-6 pb-2 overflow-x-auto custom-scrollbar gap-12">
              <div className="absolute top-[21px] left-14 right-14 h-[1px] bg-white/5 -z-10"></div>
              
              {RITUAL_STEPS.map((step, idx) => {
                 const task = ritualTasks.find(t => t.step_label === step);
                 const isCompleted = task?.status === 'completed';
                 const isActive = task?.status === 'active';
                 
                 return (
                   <div key={step} className="flex flex-col items-center min-w-[120px] shrink-0">
                      <div className={`w-12 h-12 rounded-full border-2 flex items-center justify-center transition-all duration-700 relative ${
                        isActive ? 'bg-blue-600 border-blue-400 shadow-[0_0_30px_rgba(59,130,246,0.5)] scale-125 z-10' : 
                        isCompleted ? 'bg-green-600 border-green-500 text-white shadow-lg shadow-green-900/20' : 'bg-[#0a0a0c] border-white/10 text-gray-700'
                      }`}>
                         {isCompleted ? <CheckCircle size={22} strokeWidth={3} /> : <span className={`text-xs font-black italic ${isActive ? 'text-white' : ''}`}>{idx + 1}</span>}
                         
                         {isActive && (
                            <div className="absolute inset-[-4px] rounded-full border border-blue-500 animate-ping opacity-20"></div>
                         )}
                      </div>
                      <div className="mt-5 text-center">
                        <span className={`text-[10px] font-black uppercase italic tracking-tight block whitespace-nowrap transition-colors duration-500 ${isActive ? 'text-white' : isCompleted ? 'text-green-500' : 'text-gray-600'}`}>{step}</span>
                        {task && (
                          <StepTimer start={task.started_at} end={task.completed_at} active={isActive} />
                        )}
                      </div>
                   </div>
                 );
              })}
           </div>
        </div>

        <div className="flex-1 flex flex-col gap-6 overflow-hidden bg-[#0d0d0f] rounded-[3rem] border border-white/5 p-8 shadow-2xl">
          <div className="flex items-center justify-between mb-4">
             <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-blue-600/20 rounded-2xl flex items-center justify-center text-blue-500"><UtensilsCrossed size={24} /></div>
                <div>
                  <h3 className="text-xl font-black italic uppercase tracking-tighter">MENÚ DE SERVICIO</h3>
                  <p className="text-[9px] text-gray-500 font-bold uppercase tracking-widest">Añadiendo a Mesa {selectedTableId}</p>
                </div>
             </div>
             {selectedTable?.status === 'calling' && (
               <button onClick={(e) => handleAttend(e, selectedTableId!)} className="bg-red-600 hover:bg-red-500 text-white px-8 py-3 rounded-2xl font-black text-[10px] uppercase tracking-widest flex items-center gap-2 animate-bounce shadow-xl shadow-red-900/40"><BellRing size={18} /> ATENDER LLAMADO</button>
             )}
          </div>
          <div className="flex-1 overflow-y-auto custom-scrollbar pr-2">
             <MenuGrid selectedTableId={selectedTableId} />
          </div>
        </div>
      </div>

      <div className="w-full xl:w-[380px] flex flex-col shrink-0">
        <OrderTicket 
          table={selectedTable!} 
          onUpdateTable={onUpdateTable} 
          onPaymentSuccess={() => setSelectedTableId(null)}
        />
      </div>
    </div>
  );
};

const StepTimer = ({ start, end, active }: { start: string, end?: string, active: boolean }) => {
  const [elapsed, setElapsed] = useState('');

  useEffect(() => {
    const calculate = () => {
      const s = new Date(start).getTime();
      const e = end ? new Date(end).getTime() : Date.now();
      const diff = Math.floor((e - s) / 1000);
      const m = Math.floor(diff / 60);
      const sec = diff % 60;
      setElapsed(`${m}:${sec.toString().padStart(2, '0')}`);
    };

    calculate();
    if (active) {
      const interval = setInterval(calculate, 1000);
      return () => clearInterval(interval);
    }
  }, [start, end, active]);

  return (
    <div className={`mt-2 flex items-center justify-center gap-1.5 font-mono font-black ${active ? 'text-blue-400 animate-pulse' : 'text-gray-700'}`}>
       <Clock size={10} strokeWidth={3} />
       <span className="text-[10px] tracking-tighter">{elapsed}</span>
    </div>
  );
};

export default ServiceOSModule;
