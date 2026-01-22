
import React, { useState } from 'react';
import { StaffMember, RitualTask, ServiceRecord } from '../types';
import { User, ShieldCheck, Clock, CheckCircle2, Timer, ListChecks, PlayCircle, ChefHat, GlassWater as Bottle, Martini } from 'lucide-react';

interface PersonalProps {
  serviceRecords: ServiceRecord[];
  tasks: RitualTask[];
  onCompleteTask: (taskId: string) => void;
}

const PersonalModule: React.FC<PersonalProps> = ({ serviceRecords, tasks, onCompleteTask }) => {
  const staff: StaffMember[] = [
    { id: '1', name: 'Carlos Mendoza', role: 'CHEF', status: 'active', shift: '08:00 - 17:00' },
    { id: '2', name: 'Laura Restrepo', role: 'MESERO', status: 'active', shift: '11:00 - 20:00' },
    { id: '3', name: 'Andrés Gaviria', role: 'BARTENDER', status: 'active', shift: '15:00 - 00:00' },
    { id: '4', name: 'Sofia Ruiz', role: 'MESERO', status: 'active', shift: '12:00 - 21:00' },
  ];

  return (
    <div className="space-y-8 animate-in fade-in duration-700">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h2 className="text-3xl font-black italic uppercase tracking-tighter">SINCRO DE PERSONAL OMM</h2>
          <p className="text-gray-500 text-xs font-bold uppercase tracking-[0.3em]">Lista de Atención Live | Ritual OS</p>
        </div>
        <div className="flex gap-4 bg-[#111114] p-3 rounded-2xl border border-white/5">
           <div className="text-center px-4 border-r border-white/5">
              <span className="text-[8px] text-gray-600 font-black uppercase block">Tareas Pendientes</span>
              <span className="text-xl font-black italic text-blue-500">{tasks.filter(t => t.status === 'pending').length}</span>
           </div>
           <div className="text-center px-4">
              <span className="text-[8px] text-gray-600 font-black uppercase block">Atendidos Hoy</span>
              <span className="text-xl font-black italic text-green-500">{tasks.filter(t => t.status === 'completed').length}</span>
           </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {staff.map((member) => {
          const staffTasks = tasks.filter(t => 
            (t.responsible === member.role || (member.role === 'MESERO' && t.responsible === 'MESERO')) && 
            t.status !== 'completed'
          );

          return (
            <div key={member.id} className="bg-[#111114] border border-white/5 rounded-[2.5rem] p-8 flex flex-col h-fit shadow-2xl hover:border-blue-500/20 transition-all">
              <div className="flex justify-between items-start mb-6">
                 <div className="w-12 h-12 bg-white/5 rounded-2xl flex items-center justify-center text-blue-500">
                    <User size={24} />
                 </div>
                 <span className={`text-[7px] font-black uppercase tracking-widest px-3 py-1 rounded-full ${
                   member.status === 'active' ? 'bg-green-500/10 text-green-500' : 'bg-gray-500/10 text-gray-500'
                 }`}>
                   {member.status}
                 </span>
              </div>
              
              <h3 className="text-lg font-black italic uppercase leading-none mb-1">{member.name}</h3>
              <span className="text-[9px] text-gray-600 font-black uppercase tracking-widest mb-6 block">{member.role}</span>

              <div className="space-y-3 flex-1">
                 <h4 className="text-[8px] text-gray-500 font-black uppercase tracking-widest mb-2 flex items-center gap-2">
                    <ListChecks size={10} /> TAREAS ASIGNADAS ({staffTasks.length})
                 </h4>
                 {staffTasks.length > 0 ? (
                   staffTasks.map(task => (
                     <div key={task.id} className="bg-white/5 border border-white/5 p-4 rounded-2xl flex justify-between items-center group">
                        <div>
                           <span className="text-[7px] text-blue-500 font-black uppercase block">MESA {task.tableId}</span>
                           <span className="text-[10px] font-black italic uppercase">{task.ritualLabel}</span>
                        </div>
                        <button 
                          onClick={() => onCompleteTask(task.id)}
                          className="w-8 h-8 bg-blue-600/20 rounded-xl flex items-center justify-center text-blue-500 hover:bg-blue-600 hover:text-white transition-all shadow-lg"
                        >
                           <CheckCircle2 size={16} />
                        </button>
                     </div>
                   ))
                 ) : (
                   <div className="py-6 text-center border-2 border-dashed border-white/5 rounded-3xl opacity-30">
                      <span className="text-[8px] font-black uppercase italic">En espera...</span>
                   </div>
                 )}
              </div>

              <div className="mt-8 pt-6 border-t border-white/5 flex justify-between items-center">
                 <div className="flex items-center gap-2">
                    <Timer size={12} className="text-gray-600" />
                    <span className="text-[8px] font-black uppercase text-gray-500">SLA: 02:40</span>
                 </div>
                 <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse"></div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default PersonalModule;
