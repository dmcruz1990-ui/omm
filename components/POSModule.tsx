import React, { useState, useEffect } from 'react';
import { Table, RitualTask } from '../types.ts';
import { 
  Zap, ChevronRight, 
  Flame, Coffee, Receipt, Martini, 
  BellRing, CheckCircle, UserCheck, GlassWater as Bottle,
  LayoutGrid, UtensilsCrossed, Wine, Sparkles, Clock, PlayCircle, CheckCircle2, Timer,
  Eye,
  Info,
  ChevronDown,
  Plus,
  Map as MapIcon
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
  "WATER", 
  "MENU", 
  "ORDER", 
  "STARTER", 
  "MAIN", 
  "DESSERT", 
  "COFFEE", 
  "BILL"
];

const ServiceOSModule: React.FC<POSProps> = ({ tables, onUpdateTable }) => {
  const { user } = useAuth();
  const [selectedTableId, setSelectedTableId] = useState<number | null>(4); // Default to 4 for demo
  const [ritualTasks, setRitualTasks] = useState<RitualTask[]>([]);
  const [isRitualLoading, setIsRitualLoading] = useState(false);
  const [showQuickMenu, setShowQuickMenu] = useState(false);

  // Aseguramos que siempre haya al menos 20 mesas para la visualización de la planta
  const displayTables = tables.length > 0 ? tables : [
    { id: 4, status: 'occupied', seats: 6, zone: 'TERRACE A', timer: '00:45:12' },
    { id: 1, status: 'calling', seats: 2, zone: 'TERRACE A', timer: '01:12:05' },
    { id: 5, status: 'ordering', seats: 4, zone: 'TERRACE A', timer: '00:08:30' },
    { id: 2, status: 'free', seats: 4, zone: 'TERRACE A', timer: '' },
  ];

  const selectedTable = displayTables.find(t => t.id === selectedTableId);

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

  const activeStepTask = ritualTasks.find(t => t.status === 'active');

  return (
    <div className="flex flex-col lg:flex-row gap-6 h-full animate-in fade-in duration-700 overflow-hidden text-left bg-[#0f1115] -m-12 p-6">
      
      {/* LEFT COLUMN: TABLE SELECTION */}
      <div className="w-full lg:w-[260px] flex flex-col gap-4 shrink-0 overflow-y-auto custom-scrollbar">
        <div className="mb-2">
          <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block mb-2">ZONE SELECTION</span>
          <div className="flex items-center justify-between text-white font-bold text-lg cursor-pointer hover:text-blue-400 transition-colors">
            TERRACE A <ChevronDown size={16} />
          </div>
        </div>

        <div className="flex flex-col gap-3 flex-1">
          {displayTables.map(table => {
            const isActive = selectedTableId === table.id;
            let statusColor = 'bg-gray-600';
            let statusText = 'VACANT';
            let statusTextColor = 'text-gray-500';
            let borderColor = 'border-transparent';
            let bgColor = 'bg-[#1a1d24]';

            if (table.status === 'occupied') {
              statusColor = 'bg-green-500';
              statusText = 'SEATED';
              statusTextColor = 'text-green-500';
            } else if (table.status === 'calling') {
              statusColor = 'bg-red-500';
              statusText = 'SVC LATE';
              statusTextColor = 'text-red-500';
            } else if (table.status === 'ordering') {
              statusColor = 'bg-yellow-500';
              statusText = 'ORDERING';
              statusTextColor = 'text-yellow-500';
            }

            if (isActive) {
              borderColor = 'border-blue-500';
              bgColor = 'bg-[#1a1d24]';
            }

            return (
              <button 
                key={table.id} 
                onClick={() => setSelectedTableId(table.id)} 
                className={`p-4 rounded-2xl border-2 transition-all flex flex-col gap-3 relative overflow-hidden ${borderColor} ${bgColor} hover:border-gray-500`}
              >
                <div className="flex items-start justify-between w-full">
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center ${isActive ? 'bg-blue-600/20 text-blue-500' : 'bg-white/5 text-gray-400'}`}>
                      <UtensilsCrossed size={18} />
                    </div>
                    <div className="text-left">
                      <span className="font-bold text-white block leading-none mb-1">TABLE {table.id.toString().padStart(2, '0')}</span>
                      <span className="text-[10px] text-gray-500 font-medium">{table.seats} PAX</span>
                    </div>
                  </div>
                  <div className={`w-2 h-2 rounded-full ${statusColor}`}></div>
                </div>
                
                <div className="flex items-center justify-between w-full mt-2">
                  <div className="flex flex-col text-left">
                    <span className="text-[8px] text-gray-500 uppercase tracking-widest">STATUS</span>
                    <span className={`text-[10px] font-bold uppercase tracking-wider ${statusTextColor}`}>{statusText}</span>
                  </div>
                  {table.timer && (
                    <div className="flex flex-col text-right">
                      <span className="text-[8px] text-gray-500 uppercase tracking-widest">TIMER</span>
                      <span className="text-[10px] font-mono text-gray-300">{table.timer}</span>
                    </div>
                  )}
                </div>

                {isActive && table.status === 'occupied' && (
                  <div className="absolute bottom-0 left-0 h-1 bg-green-500 w-2/3"></div>
                )}
                {isActive && table.status === 'calling' && (
                  <div className="absolute bottom-0 left-0 h-1 bg-red-500 w-full"></div>
                )}
              </button>
            );
          })}
        </div>

        <div className="flex gap-3 mt-auto pt-4 border-t border-white/5">
          <button className="flex-1 bg-[#1a1d24] hover:bg-white/10 text-white py-3 rounded-xl text-[10px] font-bold uppercase tracking-widest flex items-center justify-center gap-2 transition-all">
            <Plus size={14} /> TABLE
          </button>
          <button className="flex-1 bg-[#1a1d24] hover:bg-white/10 text-white py-3 rounded-xl text-[10px] font-bold uppercase tracking-widest flex items-center justify-center gap-2 transition-all">
            <LayoutGrid size={14} /> MAP
          </button>
        </div>
      </div>

      {/* MIDDLE COLUMN: RITUAL & MENU */}
      <div className="flex-1 flex flex-col gap-6 overflow-hidden">
        
        {/* RITUAL STEPPER */}
        <div className="bg-[#1a1d24] rounded-2xl p-6 flex flex-col gap-6">
           <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold tracking-widest text-gray-300 uppercase">SERVICE RITUAL SEQUENCE</h3>
              <div className="bg-blue-900/30 text-blue-400 px-3 py-1 rounded-full text-[9px] font-mono border border-blue-500/20">
                SEQ: STANDARD_DINNER_V4
              </div>
           </div>

           <div className="flex items-center justify-between gap-2">
              {/* Hardcoded steps for visual match */}
              <div className="flex flex-col items-center gap-2 flex-1">
                <div className="w-full h-10 rounded-full bg-[#2a2d35] flex items-center justify-center text-gray-400">
                  <CheckCircle2 size={16} />
                </div>
                <div className="text-center">
                  <span className="text-[9px] font-bold text-gray-400 uppercase block">01 WATER</span>
                  <span className="text-[8px] text-gray-500">Done</span>
                </div>
              </div>
              <div className="w-4 h-[1px] bg-gray-700"></div>

              <div className="flex flex-col items-center gap-2 flex-1">
                <div className="w-full h-10 rounded-full bg-blue-600 flex items-center justify-center text-white shadow-[0_0_15px_rgba(37,99,235,0.4)]">
                  <span className="text-[11px] font-bold">02 MENU</span>
                  <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin ml-2"></div>
                </div>
                <div className="text-center">
                  <span className="text-[9px] font-bold text-blue-400 uppercase block">IN PROGRESS</span>
                  <span className="text-[10px] font-mono text-white">04:12</span>
                </div>
              </div>
              <div className="w-4 h-[1px] bg-gray-700"></div>

              <div className="flex flex-col items-center gap-2 flex-1">
                <div className="w-full h-10 rounded-full border border-dashed border-gray-600 flex items-center justify-center text-gray-500">
                  <span className="text-[10px] font-bold">03 ORDER</span>
                </div>
                <div className="text-center">
                  <span className="text-[9px] font-bold text-gray-600 uppercase block">PENDING</span>
                  <span className="text-[8px] text-gray-700">-- : --</span>
                </div>
              </div>
              <div className="w-4 h-[1px] bg-gray-700"></div>

              <div className="flex flex-col items-center gap-2 flex-1">
                <div className="w-full h-10 rounded-full border border-dashed border-gray-600 flex items-center justify-center text-gray-500">
                  <span className="text-[10px] font-bold">04 STARTER</span>
                </div>
                <div className="text-center">
                  <span className="text-[9px] font-bold text-gray-600 uppercase block">PENDING</span>
                  <span className="text-[8px] text-gray-700">-- : --</span>
                </div>
              </div>
              <div className="w-4 h-[1px] bg-gray-700"></div>

              <div className="flex flex-col items-center gap-2 flex-1">
                <div className="w-full h-10 rounded-full border border-dashed border-gray-600 flex items-center justify-center text-gray-500">
                  <span className="text-[10px] font-bold">05 MAIN</span>
                </div>
                <div className="text-center">
                  <span className="text-[9px] font-bold text-gray-600 uppercase block">PENDING</span>
                  <span className="text-[8px] text-gray-700">-- : --</span>
                </div>
              </div>
           </div>
        </div>

        {/* MENU CATEGORIES */}
        <div className="flex gap-3 overflow-x-auto no-scrollbar pb-2">
          {['ALL', 'STARTERS', 'MAINS', 'GRILL', 'SIDES', 'DESSERTS', 'DRINKS'].map((cat, i) => (
            <button key={cat} className={`px-5 py-2 rounded-full text-[10px] font-bold tracking-widest transition-all whitespace-nowrap ${i === 0 ? 'bg-blue-900/30 text-blue-400 border border-blue-500/30' : 'bg-[#1a1d24] text-gray-400 hover:text-white'}`}>
              {cat}
            </button>
          ))}
        </div>

        {/* MENU GRID */}
        <div className="flex-1 overflow-y-auto custom-scrollbar pr-2">
           <MenuGrid selectedTableId={selectedTableId!} />
        </div>
      </div>

      {/* RIGHT COLUMN: ORDER TICKET */}
      <div className="w-full xl:w-[340px] flex flex-col shrink-0">
        <OrderTicket 
          table={selectedTable as any} 
          onUpdateTable={onUpdateTable} 
          onPaymentSuccess={() => setSelectedTableId(null)}
        />
      </div>
    </div>
  );
};

export default ServiceOSModule;
