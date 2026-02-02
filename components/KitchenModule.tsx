
import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase.ts';
import { 
  Loader2, 
  ChefHat, 
  Flame, 
  CheckCircle2, 
  Clock, 
  Zap,
  Play,
  History,
  Timer,
  CheckCircle,
  ArrowRight
} from 'lucide-react';

interface OrderItem {
  id: string;
  order_id: string;
  status: 'pending' | 'preparing' | 'served';
  quantity: number;
  menu_items: {
    name: string;
    category: string;
  };
  updated_at?: string;
}

interface KitchenOrder {
  id: string;
  table_id: number;
  opened_at: string;
  items: OrderItem[];
}

const KitchenModule: React.FC = () => {
  const [orders, setOrders] = useState<KitchenOrder[]>([]);
  const [completedItems, setCompletedItems] = useState<OrderItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  const fetchKitchenOrders = async () => {
    try {
      const { data: ordersData } = await supabase
        .from('orders')
        .select('*')
        .eq('status', 'open')
        .order('opened_at', { ascending: true });

      if (ordersData && ordersData.length > 0) {
        const orderIds = ordersData.map(o => o.id);
        const { data: itemsData } = await supabase
          .from('order_items')
          .select('*, menu_items(name, category)')
          .in('order_id', orderIds);

        const allItems = itemsData || [];

        // Comandas activas: Solo items no servidos
        const mappedOrders = ordersData.map(order => ({
          ...order,
          items: allItems.filter(item => item.order_id === order.id && item.status !== 'served')
        })).filter(order => order.items.length > 0);

        // Completados: Todos los items servidos hoy (últimos 30)
        const served = allItems
          .filter(item => item.status === 'served')
          .sort((a, b) => new Date(b.updated_at || 0).getTime() - new Date(a.updated_at || 0).getTime())
          .slice(0, 30);

        setOrders(mappedOrders);
        setCompletedItems(served);
      } else {
        setOrders([]);
        setCompletedItems([]);
      }
    } catch (err) {
      console.error("KDS Sync Error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchKitchenOrders();
    const channel = supabase.channel('kds-live-v8')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'order_items' }, () => fetchKitchenOrders())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, () => fetchKitchenOrders())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  const updateItemStatus = async (itemId: string, newStatus: 'pending' | 'preparing' | 'served') => {
    await supabase.from('order_items').update({ 
      status: newStatus,
      updated_at: new Date().toISOString()
    }).eq('id', itemId);
    fetchKitchenOrders();
  };

  const getElapsedTime = (isoString: string) => {
    const diff = Math.floor((now - new Date(isoString).getTime()) / 1000);
    const mins = Math.floor(diff / 60);
    const secs = diff % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  if (loading) return (
    <div className="h-full flex flex-col items-center justify-center opacity-40">
      <Loader2 className="animate-spin text-blue-500 mb-4" size={48} />
      <p className="text-xl font-black uppercase tracking-[0.5em] text-gray-500 italic">Sincronizando Estación...</p>
    </div>
  );

  return (
    <div className="min-h-full bg-[#0a0a0c] text-white animate-in fade-in duration-500 text-left pb-20">
      
      {/* HEADER DE CONTROL */}
      <header className="flex flex-col xl:flex-row items-start xl:items-center justify-between mb-12 border-b border-white/5 pb-8 gap-6">
        <div className="flex items-center gap-6">
          <div className="w-16 h-16 bg-blue-600 rounded-[2rem] flex items-center justify-center shadow-2xl shadow-blue-600/20">
            <ChefHat size={32} />
          </div>
          <div>
            <h2 className="text-4xl font-black italic uppercase tracking-tighter leading-none">Kitchen OS | KDS</h2>
            <p className="text-[11px] text-gray-500 font-black uppercase tracking-[0.4em] mt-3 flex items-center gap-2">
              <Flame size={12} className="text-orange-500" /> Producción en Tiempo Real OMM_V4
            </p>
          </div>
        </div>
        
        <div className="flex items-center gap-6 bg-[#111114] p-5 rounded-[2rem] border border-white/5 shadow-xl">
           <div className="flex flex-col items-end border-r border-white/5 pr-6">
              <span className="text-[8px] text-gray-600 font-black uppercase tracking-widest">Activas</span>
              <span className="text-2xl font-black italic text-orange-500 leading-none">{orders.length}</span>
           </div>
           <div className="flex flex-col items-end">
              <span className="text-[8px] text-gray-600 font-black uppercase tracking-widest">Servidos (Session)</span>
              <span className="text-2xl font-black italic text-green-500 leading-none">{completedItems.length}</span>
           </div>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
        
        {/* COLUMNA IZQUIERDA: COMANDAS ACTIVAS */}
        <div className="lg:col-span-8 space-y-10">
           <div className="flex items-center justify-between">
              <h3 className="text-xs font-black text-gray-500 uppercase tracking-widest flex items-center gap-2 italic">
                 <Zap size={14} className="text-yellow-500" /> COMANDAS EN PROCESO
              </h3>
              <span className="text-[8px] bg-white/5 px-3 py-1 rounded-full text-gray-500 font-bold uppercase tracking-widest">Auto-Refresh: ON</span>
           </div>

           <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {orders.map((order) => {
                const timeMins = Math.floor((now - new Date(order.opened_at).getTime()) / 60000);
                const isLate = timeMins >= 12;

                return (
                  <div key={order.id} className={`bg-[#111114] border-2 rounded-[3.5rem] overflow-hidden flex flex-col h-full shadow-2xl transition-all ${isLate ? 'border-red-500/50 scale-[1.02]' : 'border-white/5'}`}>
                    <div className={`p-8 border-b-2 flex flex-col items-center gap-2 ${isLate ? 'bg-red-600/10 border-red-500/30' : 'bg-blue-600/5 border-blue-500/20'}`}>
                      <div className="flex justify-between w-full items-center">
                         <span className="text-[10px] font-black uppercase text-gray-500">Mesa</span>
                         <div className={`flex items-center gap-2 font-mono ${isLate ? 'text-red-500 animate-pulse' : 'text-blue-500'}`}>
                            <Timer size={14} />
                            <span className="text-sm font-black italic">{getElapsedTime(order.opened_at)}</span>
                         </div>
                      </div>
                      <h3 className="text-7xl font-black italic tracking-tighter leading-none mb-1">M{order.table_id}</h3>
                    </div>

                    <div className="flex-1 p-8 space-y-4">
                      {order.items.map((item) => (
                        <div key={item.id} className="bg-black/40 border border-white/5 rounded-2xl p-5 group hover:border-white/20 transition-all">
                          <div className="flex justify-between items-start mb-4">
                             <div>
                                <h4 className="text-xl font-black italic uppercase leading-none text-white">{item.quantity}x {item.menu_items?.name}</h4>
                                <span className="text-[8px] text-gray-600 font-bold uppercase tracking-widest mt-1 block">{item.menu_items?.category}</span>
                             </div>
                             <div className={`w-2 h-2 rounded-full ${item.status === 'preparing' ? 'bg-orange-500 animate-pulse' : 'bg-gray-800'}`}></div>
                          </div>
                          
                          <div className="flex gap-2">
                             {item.status === 'pending' ? (
                               <button 
                                 onClick={() => updateItemStatus(item.id, 'preparing')}
                                 className="flex-1 bg-white/5 hover:bg-orange-600 text-gray-500 hover:text-white py-3 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 border border-white/5"
                               >
                                 <Play size={14} /> COMENZAR
                               </button>
                             ) : (
                               <button 
                                 onClick={() => updateItemStatus(item.id, 'served')}
                                 className="flex-1 bg-orange-600 hover:bg-green-600 text-white py-3 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 shadow-xl shadow-orange-900/20"
                               >
                                 <CheckCircle2 size={14} /> MARCAR SERVIDO
                               </button>
                             )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
              {orders.length === 0 && (
                <div className="col-span-full py-40 flex flex-col items-center justify-center text-center opacity-10 border-4 border-dashed border-white/5 rounded-[4rem]">
                   <Zap size={80} className="mb-6" />
                   <h4 className="text-4xl font-black italic uppercase tracking-[0.2em]">Pista Despejada</h4>
                </div>
              )}
           </div>
        </div>

        {/* COLUMNA DERECHA: COMPLETADOS / HISTORIAL */}
        <div className="lg:col-span-4 space-y-10">
           <div className="flex items-center justify-between">
              <h3 className="text-xs font-black text-gray-500 uppercase tracking-widest flex items-center gap-2 italic">
                 <History size={14} className="text-green-500" /> HISTORIAL DE SALIDA
              </h3>
           </div>

           <div className="bg-[#111114] border border-white/5 rounded-[3.5rem] p-8 shadow-2xl h-fit max-h-[800px] overflow-hidden flex flex-col">
              <div className="space-y-4 overflow-y-auto custom-scrollbar pr-2">
                 {completedItems.length > 0 ? (
                   completedItems.map((item, idx) => (
                     <div key={item.id} className="bg-black/20 border border-white/5 p-6 rounded-[2rem] flex items-center justify-between group hover:bg-green-600/5 transition-all animate-in slide-in-from-right duration-300">
                        <div className="flex items-center gap-4">
                           <div className="w-10 h-10 bg-green-600/20 rounded-full flex items-center justify-center text-green-500 shadow-inner">
                              <CheckCircle size={18} />
                           </div>
                           <div>
                              <h4 className="text-sm font-black uppercase italic text-gray-200 leading-none mb-1">{item.menu_items?.name}</h4>
                              <div className="flex items-center gap-2">
                                 <span className="text-[7px] text-gray-600 font-bold uppercase tracking-widest">Servido hace: {Math.max(0, Math.floor((now - new Date(item.updated_at || 0).getTime()) / 60000))}m</span>
                                 <span className="w-1 h-1 bg-gray-800 rounded-full"></span>
                                 <span className="text-[7px] text-blue-500 font-black uppercase">Mesa OK</span>
                              </div>
                           </div>
                        </div>
                        <button 
                          onClick={() => updateItemStatus(item.id, 'preparing')}
                          className="opacity-0 group-hover:opacity-100 p-2 bg-white/5 rounded-lg text-gray-500 hover:text-orange-500 transition-all"
                          title="Deshacer / Volver a Cocina"
                        >
                           <RefreshCw size={12} />
                        </button>
                     </div>
                   ))
                 ) : (
                   <div className="py-20 text-center opacity-20">
                      <Clock size={32} className="mx-auto mb-4" />
                      <p className="text-[10px] font-black uppercase tracking-widest italic">No hay platos servidos recientemente</p>
                   </div>
                 )}
              </div>
              
              <div className="mt-8 pt-6 border-t border-white/5 flex flex-col gap-4">
                 <div className="flex justify-between items-center px-2">
                    <span className="text-[9px] font-black text-gray-600 uppercase tracking-widest">SLA Cumplimiento</span>
                    <span className="text-xs font-black italic text-green-500">98.4%</span>
                 </div>
                 <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden">
                    <div className="h-full bg-green-500 shadow-[0_0_10px_rgba(34,197,94,0.4)]" style={{ width: '98.4%' }}></div>
                 </div>
              </div>
           </div>

           <div className="bg-gradient-to-br from-blue-600/10 to-transparent p-10 rounded-[3rem] border border-blue-500/10 shadow-xl">
              <h4 className="text-[10px] font-black text-blue-400 uppercase tracking-[0.3em] mb-4 italic">Operational Tip</h4>
              <p className="text-xs text-gray-400 italic leading-relaxed">
                 "El tiempo promedio de salida hoy es de <span className="text-white font-bold">08:24</span>. Estás <span className="text-green-500 font-bold">12% por debajo</span> del SLA objetivo."
              </p>
           </div>
        </div>

      </div>

    </div>
  );
};

// Reutilizamos el icono RefreshCw para la funcionalidad de deshacer
const RefreshCw = ({ size, className }: any) => (
  <svg 
    xmlns="http://www.w3.org/2000/svg" 
    width={size} 
    height={size} 
    viewBox="0 0 24 24" 
    fill="none" 
    stroke="currentColor" 
    strokeWidth="3" 
    strokeLinecap="round" 
    strokeLinejoin="round" 
    className={className}
  >
    <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" />
    <path d="M21 3v5h-5" />
    <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" />
    <path d="M3 21v-5h5" />
  </svg>
);

export default KitchenModule;
