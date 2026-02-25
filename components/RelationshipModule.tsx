
import React, { useState, useMemo } from 'react';
import { 
  Users, 
  Search, 
  Star, 
  ChevronRight,
  Target,
  Zap,
  ShieldCheck,
  TrendingUp,
  Clock,
  UserPlus,
  BarChart3,
  Sparkles,
  Phone,
  Mail,
  X
} from 'lucide-react';
import { CustomerProfile, RFMSegment } from '../types.ts';

const RelationshipModule: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [activeSegment, setActiveSegment] = useState<RFMSegment | 'ALL'>('ALL');
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);
  
  // Data de ejemplo ampliada para motor RFM
  const [customers] = useState<CustomerProfile[]>(() => [
    { 
      id: 'C1', 
      name: 'Margarita Rosa', 
      phone: '+57 310 444 5566', 
      email: 'margarita@seratta.com',
      segment: 'CHAMPION', 
      total_spend: 24500000, 
      order_count: 42,
      visit_count: 28,
      last_visit_at: new Date(Date.now() - 1000 * 60 * 60 * 24 * 3).toISOString(), // 3 días
      rating: 5,
      avatar_url: 'https://i.pravatar.cc/150?u=margarita',
      preferences: [
        { category: 'Bebidas', item_name: 'Dom Pérignon', weight: 0.9 },
        { category: 'Sushi', item_name: 'Lobster Roll', weight: 0.8 },
      ],
      tags: [
        { id: 't1', label: 'VIP REAL', type: 'financial', color: 'bg-yellow-500' },
        { id: 't2', label: 'CHAMPAGNE LOVER', type: 'behavior', color: 'bg-blue-500' },
        { id: 't3', label: 'CELEBRACIÓN PRÓXIMA', type: 'alert', color: 'bg-pink-500' }
      ],
      rfm_scores: { r: 5, f: 5, m: 5 },
      ai_hospitality_note: "Margarita prefiere siempre la mesa en rincón para privacidad. No tolera esperas mayores a 10 min por su vino."
    },
    { 
      id: 'C2', 
      name: 'Julián Román', 
      phone: '+57 300 222 1100', 
      segment: 'AT_RISK', 
      total_spend: 4200000, 
      order_count: 8,
      visit_count: 12,
      last_visit_at: new Date(Date.now() - 1000 * 60 * 60 * 24 * 60).toISOString(), // 60 días
      rating: 2,
      avatar_url: 'https://i.pravatar.cc/150?u=julian',
      preferences: [
        { category: 'Gin', item_name: 'Tanqueray Ten', weight: 0.7 }
      ],
      tags: [
        { id: 't4', label: 'EN RIESGO', type: 'alert', color: 'bg-red-500' },
        { id: 't5', label: 'PRICE SENSITIVE', type: 'behavior', color: 'bg-orange-500' }
      ],
      rfm_scores: { r: 1, f: 3, m: 3 },
      ai_hospitality_note: "Tuvo un incidente con el tiempo de preparación en su última visita. Ofrecer cortesía inmediata."
    },
    { 
      id: 'C3', 
      name: 'Elena Poniatowska', 
      phone: '+57 315 999 8877', 
      segment: 'NEW', 
      total_spend: 850000, 
      order_count: 2,
      visit_count: 1,
      last_visit_at: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString(), // Hoy
      rating: 5,
      avatar_url: 'https://i.pravatar.cc/150?u=elena',
      preferences: [],
      tags: [
        { id: 't6', label: 'NUEVO_LEAD', type: 'behavior', color: 'bg-green-500' }
      ],
      rfm_scores: { r: 5, f: 1, m: 2 },
    },
  ]);

  const filteredCustomers = useMemo(() => {
    return customers.filter(c => {
      const matchesSearch = c.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          c.phone.includes(searchTerm);
      const matchesSegment = activeSegment === 'ALL' || c.segment === activeSegment;
      return matchesSearch && matchesSegment;
    });
  }, [customers, searchTerm, activeSegment]);

  const segments: { label: string; value: RFMSegment | 'ALL'; count: number }[] = [
    { label: 'Todos', value: 'ALL', count: customers.length },
    { label: 'Champions (VIP)', value: 'CHAMPION', count: customers.filter(c => c.segment === 'CHAMPION').length },
    { label: 'En Riesgo', value: 'AT_RISK', count: customers.filter(c => c.segment === 'AT_RISK').length },
    { label: 'Nuevos', value: 'NEW', count: customers.filter(c => c.segment === 'NEW').length },
  ];

  const selectedCustomer = customers.find(c => c.id === selectedCustomerId);

  return (
    <div className="space-y-10 animate-in fade-in duration-700 text-left">
      {/* Header CRM Estratégico */}
      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-8 border-b border-white/5 pb-10">
        <div>
           <h2 className="text-4xl font-black italic tracking-tighter uppercase leading-none text-white">Relationship Brain</h2>
           <p className="text-[10px] text-gray-500 font-black uppercase tracking-[0.4em] mt-3 italic">Guest Intelligence & RFM Scoring V4</p>
        </div>
        <div className="flex flex-col sm:flex-row gap-4">
           <div className="relative">
              <Search size={16} className="absolute left-5 top-1/2 -translate-y-1/2 text-gray-600" />
              <input 
                type="text" 
                placeholder="BUSCAR CLIENTE..." 
                className="bg-[#111114] border border-white/10 rounded-2xl py-4 pl-14 pr-6 text-[10px] font-black uppercase tracking-widest focus:border-blue-500 transition-all outline-none w-full sm:w-80 text-white"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
           </div>
           <button className="bg-blue-600 hover:bg-blue-500 text-white px-8 py-4 rounded-2xl font-black italic text-[10px] uppercase tracking-widest flex items-center justify-center gap-3 transition-all shadow-xl shadow-blue-600/20 active:scale-95">
              <UserPlus size={18} /> NUEVO CLIENTE
           </button>
        </div>
      </div>

      {/* Segment Selector & Stats */}
      <div className="flex flex-wrap gap-4 items-center">
         <div className="flex bg-[#111114] p-1.5 rounded-2xl border border-white/5">
            {segments.map(seg => (
              <button 
                key={seg.value}
                onClick={() => setActiveSegment(seg.value)}
                className={`px-6 py-3 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all flex items-center gap-3 ${activeSegment === seg.value ? 'bg-blue-600 text-white shadow-xl' : 'text-gray-500 hover:text-white'}`}
              >
                {seg.label} <span className={`px-2 py-0.5 rounded-full text-[8px] ${activeSegment === seg.value ? 'bg-white/20' : 'bg-black/40'}`}>{seg.count}</span>
              </button>
            ))}
         </div>
         <div className="ml-auto hidden lg:flex items-center gap-6">
            <StatsBadge icon={<BarChart3 size={14} />} label="LTV Promedio" value="$1.4M" />
            <StatsBadge icon={<TrendingUp size={14} />} label="Tasa Retención" value="68%" />
         </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
        {/* Lista de Clientes */}
        <div className="lg:col-span-8 space-y-6">
           <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {filteredCustomers.map(customer => (
                <div 
                  key={customer.id} 
                  onClick={() => setSelectedCustomerId(customer.id)}
                  className={`bg-[#111114] rounded-[2.5rem] p-8 border-2 transition-all cursor-pointer group relative overflow-hidden ${selectedCustomerId === customer.id ? 'border-blue-500 shadow-[0_0_40px_rgba(37,99,235,0.15)]' : 'border-white/5 hover:border-white/10'}`}
                >
                   {customer.segment === 'CHAMPION' && (
                     <div className="absolute top-0 right-0 p-6 opacity-10 group-hover:scale-110 transition-transform"><Star size={60} fill="gold" className="text-yellow-500" /></div>
                   )}
                   
                   <div className="flex items-center gap-6 relative z-10">
                      <div className="relative">
                         <div className="w-20 h-20 rounded-full border-4 border-black overflow-hidden shadow-xl">
                            <img src={customer.avatar_url} alt={customer.name} className="w-full h-full object-cover" />
                         </div>
                         <div className={`absolute -bottom-1 -right-1 w-6 h-6 rounded-full border-4 border-black flex items-center justify-center text-white ${getSegmentColor(customer.segment)}`}>
                            {customer.segment === 'CHAMPION' ? <Zap size={10} fill="white" /> : <Clock size={10} />}
                         </div>
                      </div>
                      <div className="flex-1">
                         <h3 className="text-xl font-black italic uppercase leading-none mb-2 text-white group-hover:text-blue-400 transition-colors">{customer.name}</h3>
                         <div className="flex flex-wrap gap-2">
                            {customer.tags.slice(0, 2).map(tag => (
                               <span key={tag.id} className={`${tag.color} text-white text-[7px] font-black uppercase px-2 py-0.5 rounded-full shadow-lg`}>{tag.label}</span>
                            ))}
                         </div>
                      </div>
                      <div className="text-right">
                         <span className="text-[10px] font-black italic text-green-500 block">$ {(customer.total_spend / 1000).toFixed(0)}k</span>
                         <span className="text-[8px] text-gray-600 font-bold uppercase tracking-widest">LTV TOTAL</span>
                      </div>
                   </div>

                   <div className="mt-8 pt-6 border-t border-white/5 flex justify-between items-end relative z-10">
                      <div className="flex gap-6">
                         <div>
                            <span className="text-[8px] text-gray-600 font-black uppercase block">Visitas</span>
                            <span className="text-sm font-black italic text-white">{customer.visit_count}</span>
                         </div>
                         <div>
                            <span className="text-[8px] text-gray-600 font-black uppercase block">Ticket Avg</span>
                            <span className="text-sm font-black italic text-blue-500">$ {(customer.total_spend / customer.visit_count / 1000).toFixed(0)}k</span>
                         </div>
                      </div>
                      <ChevronRight size={18} className={`transition-all ${selectedCustomerId === customer.id ? 'text-blue-500 translate-x-2' : 'text-gray-800'}`} />
                   </div>
                </div>
              ))}
           </div>
        </div>

        {/* Deep Profile View */}
        <div className="lg:col-span-4">
           {selectedCustomer ? (
             <div className="bg-[#111114] border border-white/5 rounded-[3.5rem] p-10 shadow-2xl space-y-10 animate-in slide-in-from-right duration-500 sticky top-12">
                <div className="flex justify-between items-start">
                   <div className="p-4 bg-white/5 rounded-2xl text-blue-500"><ShieldCheck size={28} /></div>
                   <button onClick={() => setSelectedCustomerId(null)} className="text-gray-700 hover:text-white transition-colors"><X size={24} /></button>
                </div>

                <div className="text-center space-y-4">
                   <h3 className="text-3xl font-black italic uppercase tracking-tighter text-white leading-none">{selectedCustomer.name}</h3>
                   <div className="flex items-center justify-center gap-4 text-gray-500">
                      <div className="flex items-center gap-1"><Phone size={12} /> <span className="text-[10px] font-bold">{selectedCustomer.phone}</span></div>
                      <div className="w-1 h-1 bg-gray-800 rounded-full"></div>
                      <div className="flex items-center gap-1"><Mail size={12} /> <span className="text-[10px] font-bold">VIP_SYNC</span></div>
                   </div>
                </div>

                {/* RFM HUD */}
                <div className="grid grid-cols-3 gap-3">
                   <RFMUnit label="RECENCY" score={selectedCustomer.rfm_scores.r} color="text-blue-500" />
                   <RFMUnit label="FREQUENCY" score={selectedCustomer.rfm_scores.f} color="text-purple-500" />
                   <RFMUnit label="MONETARY" score={selectedCustomer.rfm_scores.m} color="text-green-500" />
                </div>

                {/* AI Insight */}
                <div className="bg-blue-600/10 border border-blue-500/20 p-6 rounded-3xl relative overflow-hidden group">
                   <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity"><Sparkles size={40} className="text-blue-400" /></div>
                   <h4 className="text-[10px] font-black text-blue-400 uppercase tracking-widest mb-3 flex items-center gap-2">
                     <Target size={14} /> AI_HOSPITALITY_NOTE
                   </h4>
                   <p className="text-xs text-gray-300 italic leading-relaxed font-medium">
                     "{selectedCustomer.ai_hospitality_note || "Sin notas estratégicas registradas. Analizando historial..."}"
                   </p>
                </div>

                {/* Preferences Graph */}
                <div className="space-y-6">
                   <h4 className="text-[10px] font-black text-gray-600 uppercase tracking-widest italic">Intereses Detectados</h4>
                   <div className="space-y-4">
                      {selectedCustomer.preferences.length > 0 ? selectedCustomer.preferences.map((pref, i) => (
                        <div key={i} className="space-y-2">
                           <div className="flex justify-between items-center text-[10px] font-black uppercase">
                              <span className="text-gray-400">{pref.item_name}</span>
                              <span className="text-white">{Math.round(pref.weight * 100)}%</span>
                           </div>
                           <div className="h-1 w-full bg-white/5 rounded-full overflow-hidden">
                              <div className="h-full bg-blue-500" style={{ width: `${pref.weight * 100}%` }}></div>
                           </div>
                        </div>
                      )) : (
                        <div className="py-6 text-center border-2 border-dashed border-white/5 rounded-3xl opacity-20">
                           <p className="text-[8px] font-black uppercase italic">Analizando consumo histórico...</p>
                        </div>
                      )}
                   </div>
                </div>

                <div className="pt-6 border-t border-white/5 grid grid-cols-2 gap-4">
                   <button className="w-full bg-white/5 hover:bg-white/10 text-white py-4 rounded-2xl text-[9px] font-black uppercase tracking-widest transition-all">Ver Pedidos</button>
                   <button className="w-full bg-blue-600 hover:bg-blue-500 text-white py-4 rounded-2xl text-[9px] font-black uppercase tracking-widest transition-all shadow-xl">Agendar VIP</button>
                </div>
             </div>
           ) : (
             <div className="h-full flex flex-col items-center justify-center opacity-20 border-4 border-dashed border-white/5 rounded-[4rem] p-12 text-center">
                <Users size={64} className="mb-6" />
                <h4 className="text-2xl font-black italic uppercase tracking-tighter text-white">Selecciona un Perfil</h4>
                <p className="text-[10px] font-bold uppercase tracking-[0.4em] mt-4">NEXUM_CRM_HUD_V4</p>
             </div>
           )}
        </div>
      </div>
    </div>
  );
};

interface StatsBadgeProps {
  icon: React.ReactNode;
  label: string;
  value: string;
}

const StatsBadge = ({ icon, label, value }: StatsBadgeProps) => (
  <div className="flex items-center gap-3 bg-[#111114] border border-white/5 px-6 py-3 rounded-2xl">
     <div className="text-blue-500">{icon}</div>
     <div>
        <span className="text-[8px] text-gray-600 font-black uppercase block leading-none">{label}</span>
        <span className="text-xs font-black italic text-white">{value}</span>
     </div>
  </div>
);

interface RFMUnitProps {
  label: string;
  score: number;
  color: string;
}

const RFMUnit = ({ label, score, color }: RFMUnitProps) => (
  <div className="bg-black/40 border border-white/5 p-4 rounded-2xl text-center flex flex-col gap-2 group hover:border-white/10 transition-all">
     <span className="text-[8px] text-gray-600 font-black uppercase tracking-tighter">{label}</span>
     <div className="flex justify-center gap-0.5">
        {[1,2,3,4,5].map(i => (
          <div key={i} className={`w-1.5 h-3 rounded-full ${i <= score ? color + ' bg-current' : 'bg-white/5'}`}></div>
        ))}
     </div>
  </div>
);

const getSegmentColor = (segment: RFMSegment) => {
  switch(segment) {
    case 'CHAMPION': return 'bg-yellow-500';
    case 'LOYAL': return 'bg-blue-600';
    case 'AT_RISK': return 'bg-red-600';
    case 'NEW': return 'bg-green-500';
    case 'ABOUT_TO_SLEEP': return 'bg-purple-600';
    default: return 'bg-gray-700';
  }
};

export default RelationshipModule;
