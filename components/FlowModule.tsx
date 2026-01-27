import React, { useState, useEffect } from 'react';
import { 
  ChefHat, 
  Flame, 
  Zap, 
  Wine, 
  Clock, 
  TrendingUp, 
  AlertTriangle, 
  CheckCircle2, 
  ChevronRight,
  Monitor,
  Droplets,
  Timer,
  Activity,
  BarChart3,
  Coffee,
  Martini
} from 'lucide-react';
/* Fix: Removed non-existent export StationSaturation and unused NEXUS_COLORS from types import */
import { KitchenOrder, RitualTask } from '../types';

interface FlowProps {
  orders: KitchenOrder[];
  tasks: RitualTask[];
  onCompleteTask: (taskId: string) => void;
}

const FlowModule: React.FC<FlowProps> = ({ orders, tasks, onCompleteTask }) => {
  const [activeStation, setActiveStation] = useState<'ALL' | 'COCINA' | 'BAR' | 'SOMMELIER'>('ALL');

  const filteredTasks = tasks.filter(t => 
    t.status !== 'completed' && 
    (activeStation === 'ALL' || t.responsible === activeStation)
  );

  return (
    <div className="space-y-8 animate-in fade-in duration-700">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 border-b border-white/5 pb-8">
        <div className="flex items-center gap-4">
           <div className="w-12 h-12 bg-blue-600 rounded-[1.5rem] flex items-center justify-center shadow-lg shadow-blue-600/20">
              <ChefHat size={28} className="text-white" />
           </div>
           <div>
              <h2 className="text-3xl font-black italic tracking-tighter uppercase">NEXUM Flow</h2>
              <p className="text-gray-500 text-[10px] font-black uppercase tracking-[0.3em]">Orquestación de Producción Ritual</p>
           </div>
        </div>
        <div className="flex bg-[#111114] p-1.5 rounded-2xl border border-white/5">
          <TabButton active={activeStation === 'ALL'} onClick={() => setActiveStation('ALL'} label="Global" icon={<Activity size={14} />} />
          <TabButton active={activeStation === 'COCINA'} onClick={() => setActiveStation('COCINA')} label="Cocina" icon={<Flame size={14} />} />
          <TabButton active={activeStation === 'BAR'} onClick={() => setActiveStation('BAR')} label="Bar" icon={<Martini size={14} />} />
          <TabButton active={activeStation === 'SOMMELIER'} onClick={() => setActiveStation('SOMMELIER')} label="Cava" icon={<Wine size={14} />} />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        <div className="lg:col-span-3">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {filteredTasks.map(task => (
              <div key={task.id} className={`bg-[#111114] border-l-8 rounded-[2.5rem] p-8 shadow-2xl relative overflow-hidden transition-all hover:scale-[1.02] ${
                task.responsible === 'COCINA' ? 'border-orange-500' : 
                task.responsible === 'BAR' ? 'border-blue-500' : 'border-purple-500'
              }`}>
                <div className="flex justify-between items-start mb-6">
                   <div className="flex items-center gap-3">
                      <div className="bg-white/5 px-4 py-2 rounded-2xl font-black italic text-xl">
                        M{task.tableId}
                      </div>
                      <div>
                         <span className="text-[10px] text-gray-500 font-black uppercase block">{task.responsible}</span>
                         <span className="text-[9px] font-bold text-blue-400 uppercase tracking-widest italic leading-none">{task.ritualLabel}</span>
                      </div>
                   </div>
                   <div className="text-right">
                      <TaskTimer startTime={task.startTime} />
                   </div>
                </div>

                <div className="bg-black/40 p-4 rounded-2xl border border-white/5 mb-8">
                   <span className="text-[8px] text-gray-600 font-black uppercase block mb-1">Status Sincro Ritual</span>
                   <p className="text-[11px] text-gray-300 font-bold italic leading-relaxed uppercase">Esperando salida para etapa: {task.ritualLabel}</p>
                </div>

                <div className="flex items-center gap-3">
                   <button 
                    onClick={() => onCompleteTask(task.id)}
                    className="flex-1 bg-blue-600 hover:bg-blue-500 py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all shadow-xl shadow-blue-600/20"
                   >
                      NOTIFICAR SALIDA / MARCAR COMPLETADO
                   </button>
                </div>
              </div>
            ))}
            {filteredTasks.length === 0 && (
              <div className="col-span-2 py-20 text-center border-4 border-dashed border-white/5 rounded-[3rem] opacity-20">
                 <Monitor size={48} className="mx-auto mb-4" />
                 <h4 className="text-xl font-black italic uppercase">Sin órdenes activas en esta estación</h4>
              </div>
            )}
          </div>
        </div>

        <div className="space-y-8">
           <div className="bg-[#111114] p-8 rounded-[3rem] border border-white/5 shadow-2xl">
              <div className="flex items-center gap-2 mb-8">
                 <BarChart3 className="text-blue-500" size={18} />
                 <h3 className="text-xs font-black text-gray-400 uppercase tracking-widest italic">Estadísticas Live</h3>
              </div>
              <div className="space-y-6">
                 <StatRow label="T. Prep Promedio" value="06:12" />
                 <StatRow label="Sincronía Ritual" value="98%" />
                 <StatRow label="Carga Cocina" value="Baja" color="text-green-500" />
              </div>
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
      active ? 'bg-blue-600 text-white shadow-lg' : 'text-gray-500 hover:text-gray-300'
    }`}
  >
    {icon} {label}
  </button>
);

const TaskTimer = ({ startTime }: { startTime: number }) => {
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    const interval = setInterval(() => setElapsed(Math.floor((Date.now() - startTime) / 1000)), 1000);
    return () => clearInterval(interval);
  }, [startTime]);
  
  const minutes = Math.floor(elapsed / 60);
  return (
    <div className="flex flex-col items-end">
       <div className="flex items-center gap-1 text-gray-500">
          <Clock size={12} />
          <span className="text-lg font-black italic">{minutes}:{(elapsed % 60).toString().padStart(2, '0')}</span>
       </div>
    </div>
  );
};

const StatRow = ({ label, value, color }: { label: string, value: string, color?: string }) => (
  <div className="flex justify-between items-center border-b border-white/5 pb-3">
     <span className="text-[10px] text-gray-500 font-black uppercase">{label}</span>
     <span className={`text-xs font-black italic ${color || 'text-white'}`}>{value}</span>
  </div>
);

export default FlowModule;