
import React, { useState } from 'react';
import { 
  Users, 
  Search, 
  MessageSquare, 
  TrendingUp, 
  Zap, 
  Heart, 
  Star, 
  AlertTriangle, 
  ChevronRight,
  Send,
  Wallet,
  PieChart,
  Target
} from 'lucide-react';
import { CustomerProfile } from '../types.ts';

const RelationshipModule: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [customers] = useState<CustomerProfile[]>([
    { 
      id: 'C1', name: 'Margarita Rosa', phone: '+57 310 444 5566', segment: 'Héroe', 
      totalSpend: 15400000, lastVisit: '2025-05-15', preferredRest: 'OMM',
      tastes: ['Vinos Blancos', 'Trufa', 'Mesas VIP'], nextVisitPrediction: 'Viernes, 20:30',
      churnRisk: 5, walletBalance: 'Mesa 01 Prioritaria'
    },
    { 
      id: 'C2', name: 'Julián Román', phone: '+57 300 222 1100', segment: 'En Riesgo', 
      totalSpend: 2100000, lastVisit: '2025-04-10', preferredRest: 'OMM',
      tastes: ['Mixología', 'DJ Sets'], nextVisitPrediction: 'Sábado, 22:00',
      churnRisk: 78, walletBalance: 'Coctel de Bienvenida'
    },
    { 
      id: 'C3', name: 'Elena Poniatowska', phone: '+57 315 999 8877', segment: 'Frecuente', 
      totalSpend: 8900000, lastVisit: '2025-05-20', preferredRest: 'OMM',
      tastes: ['Comida Japonesa', 'Tapas', 'Sake'], nextVisitPrediction: 'Domingo, 14:00',
      churnRisk: 12, walletBalance: 'Degustación de Sashimi'
    },
  ]);

  return (
    <div className="space-y-8 animate-in fade-in duration-700 text-left">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
         <StatItem label="NPS OMM" value="9.6/10" icon={<Heart className="text-red-500" />} trend="+0.2" />
         <StatItem label="Retención 30d" value="72%" icon={<Zap className="text-yellow-500" />} trend="+5%" />
         <StatItem label="LTV Promedio" value="$1.5M" icon={<Star className="text-blue-500" />} trend="+$150k" />
         <StatItem label="Activaciones" value="28" icon={<Send className="text-green-500" />} trend="88% Conv." />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-[#111114] border border-white/5 rounded-[3rem] p-8 shadow-2xl">
            <div className="flex items-center justify-between mb-8">
               <h3 className="text-xs font-black text-gray-500 uppercase tracking-widest flex items-center gap-2">
                  <Users size={14} className="text-blue-500" /> OMM Relationship Brain
               </h3>
               <div className="relative">
                  <Search size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-600" />
                  <input 
                    type="text" 
                    placeholder="BUSCAR CLIENTE O GUSTO..." 
                    className="bg-black/40 border border-white/10 rounded-2xl py-3 pl-10 pr-6 text-[10px] font-black uppercase tracking-widest focus:border-blue-500 transition-all outline-none w-64"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
               </div>
            </div>

            <div className="space-y-4">
               {customers.map(customer => (
                 <div key={customer.id} className="bg-[#16161a] border border-white/5 rounded-3xl p-6 hover:border-blue-500/40 transition-all group">
                    <div className="flex flex-col md:flex-row md:items-center gap-6">
                       <div className="flex items-center gap-4 min-w-[240px]">
                          <div className={`w-14 h-14 rounded-2xl flex items-center justify-center font-black italic text-xl ${
                            customer.segment === 'Héroe' ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/20' : 'bg-white/5 text-gray-500'
                          }`}>
                            {customer.name.charAt(0)}
                          </div>
                          <div>
                             <h4 className="font-black uppercase text-sm group-hover:text-blue-500 transition-colors">{customer.name}</h4>
                             <div className="flex items-center gap-2 text-[9px] font-bold text-gray-500 uppercase mt-1">
                                <span className={customer.segment === 'Héroe' ? 'text-blue-400' : ''}>{customer.segment}</span>
                                <span>•</span>
                                <span>{customer.phone}</span>
                             </div>
                          </div>
                       </div>

                       <div className="flex-1 grid grid-cols-2 md:grid-cols-2 gap-4">
                          <div>
                             <span className="text-[8px] text-gray-600 font-black uppercase block mb-1">Gasto Total</span>
                             <span className="text-xs font-black italic text-gray-300">$ {customer.totalSpend.toLocaleString()}</span>
                          </div>
                          <div>
                             <span className="text-[8px] text-gray-600 font-black uppercase block mb-1">Predicción Visita</span>
                             <span className="text-xs font-black italic text-green-500 uppercase">{customer.nextVisitPrediction}</span>
                          </div>
                       </div>

                       <div className="flex items-center gap-2">
                          <button className="p-3 bg-white/5 hover:bg-blue-600/20 rounded-xl transition-all text-gray-500 hover:text-blue-500">
                             <Wallet size={16} />
                          </button>
                          <button className="p-3 bg-blue-600 hover:bg-blue-500 rounded-xl transition-all text-white shadow-xl shadow-blue-600/20">
                             <ChevronRight size={16} />
                          </button>
                       </div>
                    </div>
                    
                    <div className="mt-4 pt-4 border-t border-white/5 flex flex-wrap gap-2">
                       {customer.tastes.map((taste, i) => (
                         <span key={i} className="text-[8px] bg-white/5 px-2 py-1 rounded-full text-gray-500 font-bold uppercase tracking-widest">{taste}</span>
                       ))}
                    </div>
                 </div>
               ))}
            </div>
          </div>
        </div>

        <div className="space-y-8">
           <div className="bg-[#111114] rounded-[2.5rem] border border-blue-500/10 p-8 shadow-2xl relative overflow-hidden">
              <div className="absolute top-0 right-0 p-8 opacity-5">
                 <Target size={120} className="text-blue-500" />
              </div>
              
              <div className="relative z-10 space-y-6">
                 <div className="flex items-center gap-3">
                    <div className="bg-blue-600 w-12 h-12 rounded-2xl flex items-center justify-center shadow-lg shadow-blue-600/20">
                       <Send size={20} className="text-white" />
                    </div>
                    <div>
                       <h4 className="text-xs font-black uppercase tracking-widest italic">OMM Ping</h4>
                       <span className="text-[9px] text-blue-400 font-bold uppercase">Activación IA</span>
                    </div>
                 </div>

                 <div className="bg-white/5 p-5 rounded-3xl border border-white/5 space-y-4">
                    <p className="text-[11px] text-gray-300 italic leading-relaxed">
                      "Hola Margarita Rosa, vimos que tus viernes suelen ser en OMM. Para este 23 de mayo tenemos una mesa VIP lista para ti con vista a la Pagoda..."
                    </p>
                    <div className="flex items-center justify-between pt-4 border-t border-white/5">
                       <span className="text-[9px] text-gray-500 font-black uppercase">Canal: <span className="text-green-500 italic">WhatsApp</span></span>
                       <button className="bg-green-600 hover:bg-green-500 px-4 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest text-white transition-all">
                          Enviar
                       </button>
                    </div>
                 </div>
              </div>
           </div>

           <div className="bg-[#111114] p-8 rounded-[3rem] border border-white/5">
              <div className="flex items-center gap-2 mb-6">
                 <PieChart className="text-blue-500" size={18} />
                 <h4 className="text-xs font-black uppercase tracking-widest">Tendencias OMM</h4>
              </div>
              <div className="space-y-4">
                 <TasteItem label="Sake & Vinos" value={45} color="bg-red-500" />
                 <TasteItem label="Mixología Zen" value={35} color="bg-blue-500" />
                 <TasteItem label="Kaiseki Experience" value={20} color="bg-purple-500" />
              </div>
           </div>
        </div>
      </div>
    </div>
  );
};

const StatItem = ({ label, value, icon, trend }: { label: string, value: string, icon: any, trend: string }) => (
  <div className="bg-[#111114] border border-white/5 p-6 rounded-[2.5rem] relative overflow-hidden group">
     <div className="flex justify-between items-start mb-4 relative z-10">
        <div className="p-3 bg-white/5 rounded-2xl">{icon}</div>
        <span className="text-[10px] font-black text-green-500 bg-green-500/10 px-2 py-0.5 rounded-full">{trend}</span>
     </div>
     <div className="text-2xl font-black italic relative z-10 mb-1 tracking-tighter">{value}</div>
     <div className="text-[9px] text-gray-500 font-bold uppercase tracking-widest relative z-10">{label}</div>
  </div>
);

const TasteItem = ({ label, value, color }: { label: string, value: number, color: string }) => (
  <div className="space-y-1.5">
     <div className="flex justify-between text-[8px] font-black text-gray-500 uppercase">
        <span>{label}</span>
        <span>{value}%</span>
     </div>
     <div className="h-1.5 bg-gray-800 rounded-full overflow-hidden">
        <div className={`h-full ${color}`} style={{ width: `${value}%` }}></div>
     </div>
  </div>
);

export default RelationshipModule;
