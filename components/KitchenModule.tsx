
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
  Timer
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
}

interface KitchenOrder {
  id: string;
  table_id: number;
  opened_at: string;
  items: OrderItem[];
}

const KitchenModule: React.FC = () => {
  const [orders, setOrders] = useState<KitchenOrder[]>([]);
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

        const mappedOrders = ordersData.map(order => ({
          ...order,
          items: (itemsData || []).filter(item => item.order_id === order.id && item.status !== 'served')
        })).filter(order => order.items.length > 0);

        setOrders(mappedOrders);
      } else {
        setOrders([]);
      }
    } catch (err) {
      console.error("KDS Sync Error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchKitchenOrders();
    const channel = supabase.channel('kds-live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'order_items' }, () => fetchKitchenOrders())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, () => fetchKitchenOrders())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  const updateItemStatus = async (itemId: string, newStatus: 'pending' | 'preparing' | 'served') => {
    await supabase.from('order_items').update({ status: newStatus }).eq('id', itemId);
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
      <p className="text-xl font-black uppercase tracking-[0.5em] text-gray-500 italic">Sincronizando Comandas...</p>
    </div>
  );

  return (
    <div className="min-h-full bg-[#0a0a0c] text-white animate-in fade-in duration-500 text-left">
      <header className="flex items-center justify-between mb-12 border-b border-white/5 pb-8">
        <div className="flex items-center gap-6">
          <div className="w-16 h-16 bg-blue-600 rounded-[2rem] flex items-center justify-center shadow-2xl shadow-blue-600/20">
            <ChefHat size={32} />
          </div>
          <div>
            <h2 className="text-4xl font-black italic uppercase tracking-tighter leading-none">Kitchen OS | KDS</h2>
            <p className="text-[11px] text-gray-500 font-black uppercase tracking-[0.4em] mt-3">Monitor de Tiempos OMM_V4</p>
          </div>
        </div>
        <div className="flex items-center gap-8 bg-[#111114] p-4 rounded-3xl border border-white/5">
           <div className="flex flex-col items-end border-r border-white/5 pr-6">
              <span className="text-[9px] text-gray-600 font-black uppercase tracking-widest">En Fuego</span>
              <span className="text-2xl font-black italic text-orange-500">{orders.length}</span>
           </div>
           <div className="flex flex-col items-end">
              <span className="text-[9px] text-gray-600 font-black uppercase tracking-widest">SLA Objetivo</span>
              <span className="text-2xl font-black italic text-blue-500">12:00</span>
           </div>
        </div>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8">
        {orders.map((order) => {
          const timeMins = Math.floor((now - new Date(order.opened_at).getTime()) / 60000);
          const isLate = timeMins >= 12;

          return (
            <div key={order.id} className={`bg-[#111114] border-2 rounded-[3.5rem] overflow-hidden flex flex-col h-full shadow-2xl transition-all ${isLate ? 'border-red-500/50' : 'border-white/5'}`}>
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

              <div className="flex-1 p-8 space-y-4 overflow-y-auto max-h-[400px] custom-scrollbar">
                {order.items.map((item) => (
                  <div key={item.id} className="bg-black/40 border border-white/5 rounded-2xl p-5 group">
                    <div className="flex justify-between items-start mb-4">
                       <div>
                          <h4 className="text-xl font-black italic uppercase leading-none text-white">{item.quantity}x {item.menu_items?.name}</h4>
                          <span className="text-[8px] text-gray-600 font-bold uppercase tracking-widest mt-1 block">{item.menu_items?.category}</span>
                       </div>
                    </div>
                    
                    <div className="flex gap-2">
                       {item.status === 'pending' ? (
                         <button 
                           onClick={() => updateItemStatus(item.id, 'preparing')}
                           className="flex-1 bg-white/5 hover:bg-orange-600 text-gray-500 hover:text-white py-3 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2"
                         >
                           <Play size={14} /> PREPARAR
                         </button>
                       ) : (
                         <button 
                           onClick={() => updateItemStatus(item.id, 'served')}
                           className="flex-1 bg-blue-600 hover:bg-green-600 text-white py-3 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 shadow-lg"
                         >
                           <CheckCircle2 size={14} /> SERVIR
                         </button>
                       )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {orders.length === 0 && (
        <div className="py-40 flex flex-col items-center justify-center text-center opacity-10">
           <Zap size={80} className="mb-6" />
           <h4 className="text-4xl font-black italic uppercase tracking-[0.2em]">Pista Despejada</h4>
        </div>
      )}
    </div>
  );
};

export default KitchenModule;
