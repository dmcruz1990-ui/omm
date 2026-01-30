
import React, { useState } from 'react';
import { 
  Users, 
  Search, 
  Star, 
  AlertTriangle, 
  ChevronRight,
  Target,
  MoreVertical,
  Zap,
  Heart,
  ShieldCheck,
  TrendingUp,
  Clock
} from 'lucide-react';
import { CustomerProfile } from '../types.ts';

const RelationshipModule: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState('');
  
  // Implementación de los 12 Tags Maestros de NEXUM con data estratégica
  const [customers] = useState<CustomerProfile[]>([
    { 
      id: 'C1', 
      name: 'Margarita Rosa', 
      phone: '+57 310 444 5566', 
      segment: 'HÉROE / VIP REAL', 
      total_spend: 24500000, 
      order_count: 42,
      visit_count: 28,
      rating: 5,
      avatar_url: 'https://i.pravatar.cc/150?u=margarita',
      lastVisit: {
        venue: 'OMM Bogotá - Cava Principal',
        total: 1250000,
        items: [
          { qty: 1, name: 'Botella Dom Pérignon', price: 950000 },
          { qty: 2, name: 'Kaori Lobster Roll', price: 150000 },
          { qty: 1, name: 'Nigiri Ohtoro', price: 150000 }
        ]
      },
      tags: [
        { label: 'VIP REAL', type: 'yellow' },
        { label: 'HIGH MARGIN LOVER', type: 'blue' },
        { label: 'BUSCA EXPERIENCIA', type: 'pink' },
        { label: 'FIDELIZABLE CON RITUAL', type: 'teal' }
      ],
      churnRisk: 5, 
      walletBalance: 'Mesa 01 Prioritaria'
    },
    { 
      id: 'C2', 
      name: 'Julián Román', 
      phone: '+57 300 222 1100', 
      segment: 'RECUPERACIÓN URGENTE', 
      total_spend: 4200000, 
      order_count: 8,
      visit_count: 12,
      rating: 2,
      avatar_url: 'https://i.pravatar.cc/150?u=julian',
      lastVisit: {
        venue: 'OMM Bogotá - Terraza',
        total: 125000,
        items: [
          { qty: 2, name: 'Zen Gin Tonic', price: 90000 },
          { qty: 1, name: 'Gyozas Tradicionales', price: 35000 }
        ]
      },
      tags: [
        { label: 'MAL ATENDIDO / ALTO VALOR', type: 'red' },
        { label: 'EN RIESGO', type: 'red' },
        { label: 'CAMBIO DE HÁBITOS', type: 'pink' },
        { label: 'PRICE SENSITIVE', type: 'orange' }
      ],
      churnRisk: 88, 
      walletBalance: 'Intervención Gerente'
    },
    { 
      id: 'C3', 
      name: 'Elena Poniatowska', 
      phone: '+57 315 999 8877', 
      segment: 'CRECIMIENTO / POTENCIAL', 
      total_spend: 8900000, 
      order_count: 24,
      visit_count: 15,
      rating: 5,
      avatar_url: 'https://i.pravatar.cc/150?u=elena',
      lastVisit: {
        venue: 'OMM Bogotá - Salón Kaiseki',
        total: 950000,
        items: [
          { qty: 1, name: 'Menú Ritual Omakase', price: 450000 },
          { qty: 2, name: 'Sake Junmai Daijinjo', price: 500000 }
        ]
      },
      tags: [
        { label: 'POTENCIAL VIP', type: 'yellow' },
        { label: 'NO TOLERA ESPERA', type: 'red' },
        { label: 'UPSELL FRIENDLY', type: 'blue' },
        { label: 'LE GUSTA PRIVACIDAD', type: 'teal' }
      ],
      churnRisk: 12, 
      walletBalance: 'Regalo Aniversario'
    },
  ]);

  const filteredCustomers = customers.filter(c => 
    c.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    c.tags.some(t => t.label.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  return (
    <div className="space-y-10 animate-in fade-in duration-700 text-left">
      {/* Header CRM */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-8 border-b border-white/5 pb-8">
        <div>
           <h2 className="text-4xl font-black italic tracking-tighter uppercase leading-none text-white">NEXUM Relation Brain</h2>
           <p className="text-[10px] text-gray-500 font-black uppercase tracking-[0.4em] mt-3 italic">Guest Intelligence & 12 Tags Maestros de NEXUM</p>
        </div>
        <div className="relative">
           <Search size={16} className="absolute left-5 top-1/2 -translate-y-1/2 text-gray-600" />
           <input 
             type="text" 
             placeholder="BUSCAR POR NOMBRE O TAG MAESTRO..." 
             className="bg-[#111114] border border-white/10 rounded-2xl py-4 pl-14 pr-6 text-[10px] font-black uppercase tracking-widest focus:border-blue-500 transition-all outline-none w-full md:w-96 text-white"
             value={searchTerm}
             onChange={(e) => setSearchTerm(e.target.value)}
           />
        </div>
      </div>

      {/* Grid de Clientes */}
      <div className="grid grid-cols-1 xl:grid-cols-2 2xl:grid-cols-3 gap-10">
        {filteredCustomers.map(customer => (
          <CustomerCard key={customer.id} customer={customer} />
        ))}
      </div>

      {/* Panel de Oportunidades CRM */}
      <div className="bg-[#111114] border border-white/5 rounded-[4rem] p-12 mt-16 shadow-2xl overflow-hidden relative">
         <div className="absolute top-0 right-0 p-12 opacity-5">
            <Users size={180} className="text-blue-500" />
         </div>
         <div className="relative z-10 space-y-10">
            <div className="flex items-center justify-between">
               <div>
                  <h3 className="text-2xl font-black italic uppercase text-white">Consola de Activación IA</h3>
                  <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest mt-2 italic">Detección de "Mal Atendido" y "Potencial VIP" en tiempo real</p>
               </div>
               <div className="flex gap-4">
                  <div className="bg-red-600/10 border border-red-500/20 px-6 py-3 rounded-xl flex items-center gap-3">
                     <AlertTriangle size={16} className="text-red-500" />
                     <span className="text-[10px] font-black text-red-500 uppercase tracking-widest">1 CASO CRÍTICO DETECTADO</span>
                  </div>
               </div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
               <ActivatorCard label="VIP REAL ACTIVO" count={customers.filter(c => c.tags.some(t => t.label === 'VIP REAL')).length} color="text-yellow-500" />
               <ActivatorCard label="EN RIESGO HOY" count={customers.filter(c => c.churnRisk > 70).length} color="text-red-500" />
               <ActivatorCard label="UPSELL POTENTIAL" count={customers.filter(c => c.tags.some(t => t.label === 'UPSELL FRIENDLY')).length} color="text-blue-500" />
               <ActivatorCard label="FIDELIZABLES" count={customers.filter(c => c.tags.some(t => t.label === 'FIDELIZABLE CON RITUAL')).length} color="text-teal-500" />
            </div>
         </div>
      </div>
    </div>
  );
};

const CustomerCard: React.FC<{ customer: CustomerProfile }> = ({ customer }) => {
  // Cálculo de Ticket de Visita: Total / Visitas
  const avgTicket = customer.visit_count > 0 ? customer.total_spend / customer.visit_count : 0;

  return (
    <div className="bg-white rounded-[2.5rem] overflow-hidden shadow-[0_15px_40px_rgba(0,0,0,0.1)] transition-all hover:scale-[1.02] duration-300 flex flex-col group border border-gray-100">
      
      {/* Indicador de Alerta Roja Superior para casos críticos */}
      {customer.tags.some(t => t.label.includes('MAL ATENDIDO') || t.label.includes('RIESGO')) && (
        <div className="h-2 w-full bg-red-600 animate-pulse"></div>
      )}

      {/* Header & Avatar */}
      <div className="p-10 pb-6 flex flex-col items-center text-center relative">
        <div className="absolute top-8 right-8">
           <button className="p-2 text-gray-200 hover:text-gray-400 transition-colors">
              <MoreVertical size={20} />
           </button>
        </div>
        
        <div className="relative mb-6">
          <div className={`w-24 h-24 rounded-full border-4 overflow-hidden shadow-xl group-hover:scale-105 transition-transform duration-500 ${customer.churnRisk > 70 ? 'border-red-100' : 'border-gray-50'}`}>
            <img src={customer.avatar_url} alt={customer.name} className="w-full h-full object-cover" />
          </div>
          {customer.churnRisk < 10 && (
            <div className="absolute bottom-1 right-1 bg-green-500 w-6 h-6 rounded-full border-4 border-white flex items-center justify-center">
               <Star size={10} className="text-white" fill="currentColor" />
            </div>
          )}
          {customer.churnRisk > 70 && (
            <div className="absolute bottom-1 right-1 bg-red-600 w-6 h-6 rounded-full border-4 border-white flex items-center justify-center animate-bounce">
               <AlertTriangle size={10} className="text-white" fill="currentColor" />
            </div>
          )}
        </div>

        <h3 className="text-2xl font-black text-gray-900 leading-none mb-2 uppercase">{customer.name}</h3>
        <p className="text-[10px] font-black text-gray-400 uppercase tracking-[0.3em]">{customer.segment}</p>
      </div>

      {/* 12 Tags Maestros Container (Pills Estilo Pastel) */}
      <div className="px-10 flex flex-wrap justify-center gap-2 mb-10 min-h-[60px]">
        {customer.tags.map((tag, i) => (
          <span 
            key={i} 
            className={`px-4 py-1.5 rounded-full text-[9px] font-black uppercase tracking-tight shadow-sm border border-black/5 ${getTagStyle(tag.type)}`}
          >
            {tag.label}
          </span>
        ))}
      </div>

      {/* Stats Matrix */}
      <div className="px-10 grid grid-cols-4 gap-2 mb-10 border-t border-gray-50 pt-8">
        <StatUnit label="TOTAL GASTADO" value={`$${(customer.total_spend / 1000).toFixed(0)}k`} />
        <StatUnit label="TICKET VISITA" value={`$${(avgTicket / 1000).toFixed(0)}k`} className="text-blue-600" />
        <StatUnit label="VISITAS" value={customer.visit_count} />
        <StatUnit label="RATING" value={'★'.repeat(customer.rating)} className="text-yellow-500 text-[10px]" />
      </div>

      <div className="mx-10 border-t border-gray-100 mb-8"></div>

      {/* Última Visita Detail */}
      <div className="px-10 pb-10 flex-1 flex flex-col">
        <div className="flex justify-between items-end mb-6 text-left">
           <div>
              <span className="text-[10px] font-black text-gray-300 uppercase tracking-widest leading-none">ÚLTIMA VISITA</span>
              <p className="text-[13px] font-bold text-gray-600 mt-1">{customer.lastVisit.venue}</p>
           </div>
           <span className="text-lg font-black text-gray-500 font-mono italic tracking-tighter">${customer.lastVisit.total.toLocaleString()}</span>
        </div>

        <div className="space-y-3">
           {customer.lastVisit.items.map((item, idx) => (
             <div key={idx} className="flex items-center justify-between text-[11px] border-b border-gray-50 pb-2">
                <div className="flex gap-4">
                   <span className="text-gray-300 font-black w-6">({item.qty})</span>
                   <span className="text-gray-600 font-bold uppercase tracking-tight italic">{item.name}</span>
                </div>
                <span className="text-gray-400 font-mono font-bold">${item.price.toLocaleString()}</span>
             </div>
           ))}
        </div>

        {/* Acción Sugerida basada en Churn o Tags */}
        <div className="mt-auto pt-10">
           <button className={`w-full transition-all py-4 rounded-2xl flex items-center justify-center gap-3 text-[10px] font-black uppercase tracking-[0.2em] shadow-lg ${
             customer.churnRisk > 70 
              ? 'bg-red-600 text-white hover:bg-red-700' 
              : 'bg-gray-900 text-white hover:bg-blue-600'
           }`}>
              {customer.churnRisk > 70 ? <Zap size={14} /> : <Heart size={14} />}
              {customer.walletBalance} <ChevronRight size={14} />
           </button>
        </div>
      </div>
    </div>
  );
};

const StatUnit = ({ label, value, className = "text-gray-800" }: any) => (
  <div className="flex flex-col text-center">
    <span className="text-[8px] text-gray-300 font-black uppercase tracking-tighter mb-1 leading-none">{label}</span>
    <span className={`text-[14px] font-black italic tracking-tighter leading-none ${className}`}>{value}</span>
  </div>
);

const ActivatorCard = ({ label, count, color }: any) => (
  <div className="bg-black/40 border border-white/5 p-6 rounded-3xl flex items-center justify-between group hover:border-blue-500/30 transition-all cursor-pointer">
     <div>
        <span className="text-[9px] text-gray-500 font-black uppercase block tracking-widest">{label}</span>
        <span className={`text-3xl font-black italic ${color}`}>{count}</span>
     </div>
     <div className={`p-3 bg-white/5 rounded-2xl ${color} opacity-40 group-hover:opacity-100 transition-opacity`}>
        <TrendingUp size={20} />
     </div>
  </div>
);

const getTagStyle = (type: string) => {
  switch(type) {
    case 'red': return 'bg-[#fadbd8] text-[#c0392b] border-[#f5b7b1]';
    case 'yellow': return 'bg-[#f9e79f] text-[#b7950b] border-[#f7dc6f]';
    case 'blue': return 'bg-[#aed6f1] text-[#2e86c1] border-[#85c1e9]';
    case 'pink': return 'bg-[#f5b7b1] text-[#b03a2e] border-[#f1948a]';
    case 'teal': return 'bg-[#a2d9ce] text-[#117864] border-[#76d7c4]';
    case 'orange': return 'bg-[#fce8d6] text-[#d35400] border-[#f8c471]';
    default: return 'bg-[#ebedef] text-[#566573] border-[#d5dbdb]';
  }
};

export default RelationshipModule;
