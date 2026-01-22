
import React, { useState } from 'react';
import { 
  Sparkles, 
  Heart, 
  Briefcase, 
  Music, 
  Wine, 
  TrendingUp, 
  Zap, 
  ChevronRight,
  MapPin,
  Clock,
  Target,
  BarChart3,
  Play
} from 'lucide-react';
import { Experience, PlanType } from '../types';

const DiscoverModule: React.FC = () => {
  const [plans] = useState<PlanType[]>([
    { id: 'romantic', label: 'Cena Zen', icon: 'Heart', description: 'Ambiente místico con maridaje de autor.' },
    { id: 'business', label: 'Estratégico', icon: 'Briefcase', description: 'Privacidad y servicio eficiente.' },
    { id: 'party', label: 'OMM Nights', icon: 'Music', description: 'DJ Sets y mixología de vanguardia.' },
    { id: 'foodie', label: 'Kaiseki', icon: 'Wine', description: 'Experiencia degustación del Chef.' },
  ]);

  const [experiences] = useState<Experience[]>([
    { 
      id: '1', 
      title: 'Cata de Sakes Premium', 
      category: 'Cata', 
      price: 180000, 
      availability: 45, 
      impact: 92,
      actionLabel: 'Maridaje guiado por Sommelier OMM con 5 variedades de Junmai Daiginjo.'
    },
    { 
      id: '2', 
      title: 'Mantra Beats & Jazz', 
      category: 'DJ Set', 
      price: 0, 
      availability: 80, 
      impact: 78,
      actionLabel: 'Ritual de incienso japonés y transición de frecuencias 432Hz para meditación activa.'
    },
    { 
      id: '3', 
      title: 'Ritual Robata OMM', 
      category: 'Degustación', 
      price: 250000, 
      availability: 20, 
      impact: 85,
      actionLabel: 'Servicio de brasas al carbón Binchotan directo en mesa con explicación del Itamae.'
    },
  ]);

  return (
    <div className="space-y-10 animate-in fade-in duration-700">
      <div className="bg-gradient-to-br from-blue-600/20 via-transparent to-transparent p-10 rounded-[3rem] border border-white/5 shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 right-0 p-10 opacity-10">
           <Sparkles size={200} className="text-blue-500" />
        </div>
        
        <div className="max-w-3xl relative z-10">
          <div className="flex items-center gap-2 mb-4">
             <div className="bg-blue-600 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest text-white italic">Motor de Experiencias</div>
             <span className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">OMM_DISCOVER_V1</span>
          </div>
          <h1 className="text-5xl font-black italic tracking-tighter uppercase mb-6 leading-none">
            La Experiencia <span className="text-blue-500">Definitiva</span> de OMM
          </h1>
          <p className="text-gray-400 text-sm font-medium mb-8 leading-relaxed max-w-xl">
            NEXUM analiza tendencias para posicionar las experiencias místicas de OMM según la intención real del comensal.
          </p>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {plans.map(plan => (
              <button key={plan.id} className="bg-white/5 hover:bg-blue-600/20 border border-white/10 p-5 rounded-3xl transition-all group text-left">
                <div className="bg-blue-600/20 w-10 h-10 rounded-xl flex items-center justify-center mb-3 group-hover:bg-blue-600 transition-colors">
                  {plan.id === 'romantic' && <Heart size={20} className="text-blue-400 group-hover:text-white" />}
                  {plan.id === 'business' && <Briefcase size={20} className="text-blue-400 group-hover:text-white" />}
                  {plan.id === 'party' && <Music size={20} className="text-blue-400 group-hover:text-white" />}
                  {plan.id === 'foodie' && <Wine size={20} className="text-blue-400 group-hover:text-white" />}
                </div>
                <h4 className="font-black italic text-sm uppercase mb-1">{plan.label}</h4>
                <p className="text-[10px] text-gray-500 leading-tight">{plan.description}</p>
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-6">
           <div className="flex items-center justify-between px-2">
              <h3 className="text-xs font-black text-gray-400 uppercase tracking-[0.3em] flex items-center gap-2">
                 <Zap size={14} className="text-yellow-500" /> Eventos OMM Live
              </h3>
              <button className="text-[10px] font-black text-blue-500 uppercase hover:underline">Ver todas</button>
           </div>
           
           <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {experiences.map(exp => (
                <div key={exp.id} className="bg-[#16161a] border border-white/5 rounded-[2.5rem] p-6 hover:border-blue-500/40 transition-all group cursor-pointer shadow-xl flex flex-col">
                   <div className="flex justify-between items-start mb-4">
                      <div className="bg-blue-600/10 px-3 py-1 rounded-full text-[9px] font-black text-blue-500 uppercase border border-blue-500/20">
                        {exp.category}
                      </div>
                      <div className="text-right">
                         <span className="text-[8px] text-gray-500 font-bold uppercase block">Impacto OMM</span>
                         <span className="text-sm font-black text-green-500 italic">+{exp.impact}%</span>
                      </div>
                   </div>
                   
                   <h4 className="text-xl font-black italic uppercase mb-2 group-hover:text-blue-500 transition-colors">{exp.title}</h4>
                   
                   <div className="bg-black/40 p-4 rounded-2xl border border-white/5 mb-6 flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <Play size={10} className="text-blue-500" fill="currentColor" />
                        <span className="text-[8px] font-black text-gray-400 uppercase tracking-widest">Acción Ritual</span>
                      </div>
                      <p className="text-[10px] text-gray-300 font-medium italic leading-relaxed">
                        {exp.actionLabel}
                      </p>
                   </div>

                   <div className="flex items-center gap-4 text-[10px] text-gray-500 font-bold mb-6 px-1">
                      <span className="flex items-center gap-1"><Clock size={12} /> {exp.availability}% cupo</span>
                      <span className="flex items-center gap-1"><MapPin size={12} /> OMM Terraza</span>
                   </div>

                   <div className="flex items-center justify-between pt-4 border-t border-white/5 mt-auto">
                      <span className="text-lg font-black italic">{exp.price > 0 ? `$${exp.price.toLocaleString()} COP` : 'ACCESO LIBRE'}</span>
                      <button className="bg-blue-600 hover:bg-blue-500 text-white p-2 rounded-xl transition-all shadow-lg shadow-blue-600/20">
                         <ChevronRight size={18} />
                      </button>
                   </div>
                </div>
              ))}
           </div>
        </div>

        <div className="space-y-8">
           <div className="bg-[#111114] p-8 rounded-[3rem] border border-blue-500/10 shadow-2xl">
              <div className="flex items-center gap-2 mb-6">
                 <Target className="text-blue-500" size={18} />
                 <h3 className="text-xs font-black text-gray-400 uppercase tracking-widest">OMM Demand Shaping</h3>
              </div>
              
              <div className="space-y-6">
                 <div className="p-4 bg-white/5 rounded-2xl border border-white/5">
                    <span className="text-[10px] text-blue-400 font-black uppercase block mb-2">Slot Optimizado</span>
                    <p className="text-xs text-gray-300 font-medium leading-relaxed italic">
                      "Baja demanda detectada los Martes. Se sugiere activar 'Robata Experience' para atraer flujo corporativo."
                    </p>
                    <button className="w-full mt-4 bg-blue-600 hover:bg-blue-500 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all">
                      Activar Campaña
                    </button>
                 </div>

                 <div className="space-y-4">
                    <h4 className="text-[10px] font-black text-gray-600 uppercase tracking-widest">Interés del Cliente</h4>
                    <div className="space-y-2">
                       <GraphBar label="Sake" value={85} />
                       <GraphBar label="Mantra Beats" value={62} />
                       <GraphBar label="Terraza VIP" value={45} />
                    </div>
                 </div>
              </div>
           </div>
        </div>
      </div>
    </div>
  );
};

const GraphBar = ({ label, value }: { label: string, value: number }) => (
  <div className="space-y-1">
    <div className="flex justify-between text-[8px] font-black text-gray-500 uppercase">
       <span>{label}</span>
       <span>{value}%</span>
    </div>
    <div className="h-1 bg-gray-800 rounded-full overflow-hidden">
       <div className="h-full bg-blue-500" style={{ width: `${value}%` }}></div>
    </div>
  </div>
);

export default DiscoverModule;
