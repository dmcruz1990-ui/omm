
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
  Target,
  MoreVertical,
  Bell
} from 'lucide-react';
import { CustomerProfile } from '../types.ts';

const RelationshipModule: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [customers] = useState<CustomerProfile[]>([
    { 
      id: 'C1', 
      name: 'Margarita Rosa', 
      phone: '+57 310 444 5566', 
      segment: 'Héroe', 
      total_spend: 15400000, 
      order_count: 42,
      visit_count: 28,
      rating: 5,
      avatar_url: 'https://i.pravatar.cc/150?u=margarita',
      lastVisit: {
        venue: 'OMM Bogotá - Salón Principal',
        total: 485000,
        items: [
          { qty: 1, name: 'Sake Junmai Ginjo', price: 185000 },
          { qty: 2, name: 'Kaori Lobster Roll', price: 140000 },
          { qty: 3, name: 'Nigiri Hamachi', price: 160000 }
        ]
      },
      tags: [
        { label: 'Alergia Trufa', type: 'red' },
        { label: '⭐ VIP', type: 'yellow' },
        { label: 'Big Spender', type: 'blue' },
        { label: 'Cumpleaños Mayo', type: 'pink' },
        { label: 'Regular', type: 'teal' }
      ],
      churnRisk: 5, 
      walletBalance: 'Mesa 01 Prioritaria'
    },
    { 
      id: 'C2', 
      name: 'Julián Román', 
      phone: '+57 300 222 1100', 
      segment: 'En Riesgo', 
      total_spend: 2100000, 
      order_count: 8,
      visit_count: 12,
      rating: 4,
      avatar_url: 'https://i.pravatar.cc/150?u=julian',
      lastVisit: {
        venue: 'OMM Bogotá - Terraza Pagoda',
        total: 215000,
        items: [
          { qty: 2, name: 'Coctel Zen Tonic', price: 90000 },
          { qty: 1, name: 'Gyozas de Cerdo', price: 45000 },
          { qty: 1, name: 'Ramen Tonkotsu', price: 80000 }
        ]
      },
      tags: [
        { label: 'Mixología', type: 'blue' },
        { label: 'DJ Lover', type: 'orange' },
        { label: 'En Riesgo', type: 'red' }
      ],
      churnRisk: 78, 
      walletBalance: 'Coctel de Bienvenida'
    },
    { 
      id: 'C3', 
      name: 'Elena Poniatowska', 
      phone: '+57 315 999 8877', 
      segment: 'Frecuente', 
      total_spend: 8900000, 
      order_count: 24,
      visit_count: 21,
      rating: 5,
      avatar_url: 'https://i.pravatar.cc/150?u=elena',
      lastVisit: {
        venue: 'OMM Bogotá - Cava VIP',
        total: 1250000,
        items: [
          { qty: 1, name: 'Botella Laurent Perrier', price: 850000 },
          { qty: 1, name: 'Omakase 12 Pasos', price: 400000 }
        ]
      },
      tags: [
        { label: 'Wine Lover', type: 'purple' as any },
        { label: 'VIP', type: 'yellow' },
        { label: 'Sashimi Expert', type: 'teal' }
      ],
      churnRisk: 12, 
      walletBalance: 'Degustación de Sashimi'
    },
  ]);

  const filteredCustomers = customers.filter(c => 
    c.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    c.tags.some(t => t.label.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  return (
    <div className="space-y-10 animate-in fade-in duration-700 text-left">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-8 border-b border-white/5 pb-8">
        <div>
           <h2 className="text-4xl font-black italic tracking-tighter uppercase leading-none text-white">NEXUM Relation Brain</h2>
           <p className="text-[10px] text-gray-500 font-black uppercase tracking-[0.4em] mt-3">Sincronización POS & Guest Intelligence</p>
        </div>
        <div className="relative">
           <Search size={16} className="absolute left-5 top-1/2 -translate-y-1/2 text-gray-600" />
           <input 
             type="text" 
             placeholder="BUSCAR POR NOMBRE O TAG..." 
             className="bg-[#111114] border border-white/10 rounded-2xl py-4 pl-14 pr-6 text-[10px] font-black uppercase tracking-widest focus:border-blue-500 transition-all outline-none w-full md:w-80"
             value={searchTerm}
             onChange={(e) => setSearchTerm(e.target.value)}
           />
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 2xl:grid-cols-3 gap-10">
        {filteredCustomers.map(customer => (
          /* Fix: Correctly define the component call with its key and props */
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
                  <h3 className="text-2xl font-black italic uppercase text-white">Próximas Activaciones IA</h3>
                  <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest mt-2">Marketing Predictivo basado en Churn Risk</p>
               </div>
               <button className="bg-blue-600 hover:bg-blue-500 text-white px-8 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all shadow-xl shadow-blue-600/20">
                  DISPARAR CAMPAÑAS
               </button>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
               <ActivatorCard label="Clientes en Riesgo" count={filteredCustomers.filter(c => c.churnRisk > 50).length} color="text-red-500" />
               <ActivatorCard label="VIPs por Regresar" count={12} color="text-yellow-500" />
               <ActivatorCard label="Cumpleaños esta Semana" count={4} color="text-pink-500" />
            </div>
         </div>
      </div>
    </div>
  );
};

/* Fix: Type CustomerCard as React.FC to properly handle standard props like key */
const CustomerCard: React.FC<{ customer: CustomerProfile }> = ({ customer }) => {
  return (
    <div className="bg-white rounded-[2rem] overflow-hidden shadow-2xl transition-all hover:scale-[1.02] duration-300 flex flex-col group">
      {/* Header & Avatar */}
      <div className="p-10 pb-6 flex flex-col items-center text-center relative">
        <div className="absolute top-8 right-8">
           <button className="p-2 text-gray-200 hover:text-gray-400 transition-colors">
              <MoreVertical size={20} />
           </button>
        </div>
        
        <div className="relative mb-6">
          <div className="w-24 h-24 rounded-full border-4 border-gray-50 overflow-hidden shadow-xl group-hover:border-blue-100 transition-colors">
            <img src={customer.avatar_url} alt={customer.name} className="w-full h-full object-cover" />
          </div>
          {customer.churnRisk < 10 && (
            <div className="absolute bottom-1 right-1 bg-green-500 w-5 h-5 rounded-full border-2 border-white"></div>
          )}
        </div>

        <h3 className="text-2xl font-black text-gray-900 leading-none mb-2">{customer.name}</h3>
        <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">{customer.segment}</p>
      </div>

      {/* Tags Container */}
      <div className="px-10 flex flex-wrap justify-center gap-2 mb-10">
        {customer.tags.map((tag, i) => (
          <span 
            key={i} 
            className={`px-4 py-1.5 rounded-full text-[9px] font-black uppercase tracking-tight ${getTagStyle(tag.type)}`}
          >
            {tag.label}
          </span>
        ))}
      </div>

      {/* Stats Row */}
      <div className="px-10 grid grid-cols-4 gap-2 mb-10">
        <StatUnit label="GASTO TOTAL" value={`$${(customer.total_spend / 1000).toFixed(0)}k`} />
        <StatUnit label="PEDIDOS" value={customer.order_count} />
        <StatUnit label="VISITAS" value={customer.visit_count} />
        <StatUnit label="RATING" value={'★'.repeat(customer.rating)} className="text-yellow-500 text-[10px]" />
      </div>

      <div className="mx-10 border-t border-gray-100 mb-8"></div>

      {/* Last Visit Details */}
      <div className="px-10 pb-10 flex-1 flex flex-col">
        <div className="flex justify-between items-end mb-6 text-left">
           <div>
              <span className="text-[10px] font-black text-gray-300 uppercase tracking-widest leading-none">ÚLTIMA VISITA</span>
              <p className="text-[13px] font-bold text-gray-600 mt-1">{customer.lastVisit.venue}</p>
           </div>
           <span className="text-lg font-black text-gray-500 font-mono">${customer.lastVisit.total.toLocaleString()}</span>
        </div>

        <div className="space-y-3">
           {customer.lastVisit.items.map((item, idx) => (
             <div key={idx} className="flex items-center justify-between text-xs">
                <div className="flex gap-4">
                   <span className="text-gray-300 font-black w-6">({item.qty})</span>
                   <span className="text-gray-500 font-bold uppercase tracking-tight">{item.name}</span>
                </div>
                <span className="text-gray-400 font-mono font-bold">${item.price.toLocaleString()}</span>
             </div>
           ))}
        </div>

        <div className="mt-auto pt-10">
           <button className="w-full bg-gray-50 group-hover:bg-blue-600 group-hover:text-white transition-all py-4 rounded-2xl flex items-center justify-center gap-3 text-[10px] font-black uppercase tracking-[0.2em] text-gray-400 shadow-inner">
              HABLAR CON CLIENTE <ChevronRight size={14} />
           </button>
        </div>
      </div>
    </div>
  );
};

const StatUnit = ({ label, value, className = "text-gray-800" }: any) => (
  <div className="flex flex-col text-center">
    <span className="text-[8px] text-gray-300 font-black uppercase tracking-tighter mb-1 leading-none">{label}</span>
    <span className={`text-[13px] font-black italic tracking-tighter leading-none ${className}`}>{value}</span>
  </div>
);

const ActivatorCard = ({ label, count, color }: any) => (
  <div className="bg-black/40 border border-white/5 p-6 rounded-3xl flex items-center justify-between group hover:border-blue-500/30 transition-all">
     <div>
        <span className="text-[9px] text-gray-500 font-black uppercase block">{label}</span>
        <span className={`text-2xl font-black italic ${color}`}>{count}</span>
     </div>
     <div className={`p-3 bg-white/5 rounded-2xl ${color} opacity-40 group-hover:opacity-100 transition-opacity`}>
        <Target size={20} />
     </div>
  </div>
);

const getTagStyle = (type: string) => {
  switch(type) {
    case 'red': return 'bg-[#fadbd8] text-[#c0392b]';
    case 'yellow': return 'bg-[#f9e79f] text-[#d4ac0d]';
    case 'blue': return 'bg-[#aed6f1] text-[#2e86c1]';
    case 'pink': return 'bg-[#f5b7b1] text-[#c0392b]';
    case 'teal': return 'bg-[#a2d9ce] text-[#117864]';
    case 'orange': return 'bg-[#fce8d6] text-[#d35400]';
    default: return 'bg-[#ebedef] text-[#566573]';
  }
};

export default RelationshipModule;
