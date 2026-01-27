
import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { 
  Loader2, 
  ChefHat, 
  Flame, 
  CheckCircle2, 
  Clock, 
  AlertCircle,
  TrendingUp,
  Zap,
  Play
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
    const timer = setInterval(() => setNow(Date.now()), 60000);
    return () => clearInterval(timer);
  }, []);

  const fetchKitchenOrders = async () => {
    console.log("🔄 KDS: Buscando comandas activas...");
    try {
      const { data: ordersData, error: ordersError } = await supabase
        .from('orders')
        .select('*')
        .eq('status', 'open')
        .order('opened_at', { ascending: true });

      if (ordersError) {
        console.error("❌ KDS Error órdenes:", ordersError);
        throw ordersError;
      }

      if (ordersData && ordersData.length > 0) {
        const orderIds = ordersData.map(o => o.id);
        
        // UNIÓN DE DATOS EN LA QUERY: Traemos nombre y categoría
        const { data: itemsData, error: itemsError } = await supabase
          .from('order_items')
          .select('*, menu_items(name, category)')
          .in('order_id', orderIds);

        if (itemsError) {
          console.error("❌ KDS Error items:", itemsError);
          throw itemsError;
        }

        console.log(`📦 KDS: ${itemsData?.length} items recibidos para ${orderIds.length} comandas.`);

        const mappedOrders = ordersData.map(order => ({
          ...order,
          items: (itemsData || []).filter(item => item.order_id === order.id && item.status !== 'served')
        })).filter(order => order.items.length > 0);

        setOrders(mappedOrders);
      } else {
        console.log("ℹ️ KDS: No hay órdenes abiertas en este momento.");
        setOrders([]);
      }
    } catch (err: any) {
      console.error("❌ KDS ERROR CRÍTICO:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchKitchenOrders();

    console.log("📡 KDS: Activando suscripción Real-time para 'order_items'...");
    const channel = supabase
      .channel('kds-realtime-v4')
      .on('postgres_changes', { 
        event: '*', 
        schema: 'public', 
        table: 'order_items' 
      }, (payload) => {
        console.log("⚡ KDS REALTIME: Cambio en order_items detectado:", payload.eventType);
        fetchKitchenOrders();
      })
      .on('postgres_changes', { 
        event: '*', 
        schema: 'public', 
        table: 'orders' 
      }, (payload) => {
        console.log("⚡ KDS REALTIME: Cambio en órdenes detectado:", payload.eventType);
        fetchKitchenOrders();
      })
      .subscribe((status) => {
        console.log(`📡 KDS SYNC STATUS: ${status}`);
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const updateItemStatus = async (itemId: string, newStatus: 'pending' | 'preparing' | 'served') => {
    try {
      const { error } = await supabase
        .from('order_items')
        .update({ status: newStatus })
        .eq('id', itemId);
      
      if (error) throw error;
      console.log(`✅ Item ${itemId} actualizado a: ${newStatus}`);
    } catch (err) {
      console.error("❌ Error actualizando status de item:", err);
    }
  };

  const getElapsedTime = (isoString: string) => {
    const diff = Math.floor((now - new Date(isoString).getTime()) / 60000);
    return diff;
  };

  if (loading) {
    return (
      <div className="h-full flex flex-col items-center justify-center bg-black">
        <Loader2 className="animate-spin text-blue-500 mb-4" size={48} />
        <p className="text-xl font-black uppercase tracking-[0.5em] text-gray-500 italic">Sincronizando KDS OMM...</p>
      </div>
    );
  }

  return (
    <div className="min-h-full bg-black text-white p-8 animate-in fade-in duration-500">
      <header className="flex items-center justify-between mb-12 border-b border-white/10 pb-8">
        <div className="flex items-center gap-6">
          <div className="w-16 h-16 bg-blue-600 rounded-[2rem] flex items-center justify-center shadow-[0_0_30px_rgba(37,99,235,0.4)]">
            <ChefHat size={32} />
          </div>
          <div>
            <h2 className="text-4xl font-black italic uppercase tracking-tighter leading-none">NEXUM FLOW | KDS</h2>
            <p className="text-[11px] text-gray-500 font-black uppercase tracking-[0.4em] mt-3 flex items-center gap-2">
               <Zap size={14} className="text-blue-500" /> Monitor de Producción Live
            </p>
          </div>
        </div>
        <div className="flex items-center gap-8">
           <div className="bg-white/5 border border-white/10 px-6 py-3 rounded-2xl flex flex-col items-end">
              <span className="text-[10px] text-gray-500 font-black uppercase tracking-widest">Comandas Activas</span>
              <span className="text-2xl font-black italic text-blue-500">{orders.length}</span>
           </div>
        </div>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8">
        {orders.map((order) => (
          <div 
            key={order.id} 
            className="bg-[#050505] border-2 border-white/5 rounded-[3rem] overflow-hidden flex flex-col h-full shadow-2xl animate-in zoom-in"
          >
            <div className={`p-8 border-b-4 flex flex-col items-center gap-2 ${
              getElapsedTime(order.opened_at) > 15 ? 'bg-red-600/20 border-red-500' : 'bg-blue-600/10 border-blue-600/50'
            }`}>
              <div className="flex justify-between w-full items-center mb-2">
                 <span className="text-[10px] font-black uppercase tracking-widest text-gray-500">Mesa</span>
                 <div className="flex items-center gap-2">
                    <Clock size={14} className={getElapsedTime(order.opened_at) > 15 ? 'text-red-500 animate-pulse' : 'text-blue-500'} />
                    <span className={`text-sm font-black italic ${getElapsedTime(order.opened_at) > 15 ? 'text-red-500' : 'text-blue-500'}`}>
                      Hace {getElapsedTime(order.opened_at)}m
                    </span>
                 </div>
              </div>
              <h3 className="text-7xl font-black italic tracking-tighter leading-none mb-2">
                M{order.table_id.toString().padStart(2, '0')}
              </h3>
              <p className="text-[10px] font-bold text-gray-600 uppercase tracking-[0.2em]">{String(order.id).split('-')[0]}</p>
            </div>

            <div className="flex-1 p-8 space-y-6 overflow-y-auto max-h-[400px] custom-scrollbar">
              {order.items.map((item) => (
                <div key={item.id} className="flex flex-col gap-4 border-b border-white/5 pb-6 last:border-0">
                  <div className="flex justify-between items-start">
                    <div className="flex flex-col">
                      <h4 className={`text-2xl font-black italic leading-tight uppercase ${
                        item.status === 'preparing' ? 'text-blue-400' : 'text-white'
                      }`}>
                        {item.quantity}x {item.menu_items?.name}
                      </h4>
                      <span className="text-[8px] text-gray-600 font-black uppercase tracking-widest">{item.menu_items?.category}</span>
                      <span className={`text-[10px] font-black uppercase mt-2 px-3 py-1 rounded-full w-fit ${
                        item.status === 'pending' ? 'bg-orange-500/10 text-orange-500' : 'bg-blue-600/10 text-blue-500'
                      }`}>
                        {item.status === 'pending' ? 'PENDIENTE' : 'PREPARANDO'}
                      </span>
                    </div>
                  </div>

                  <div className="flex gap-3">
                    {item.status === 'pending' ? (
                      <button 
                        onClick={() => updateItemStatus(item.id, 'preparing')}
                        className="flex-1 bg-blue-600 hover:bg-blue-500 text-white py-4 rounded-2xl text-xs font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 shadow-lg"
                      >
                        <Play size={16} fill="white" /> PREPARAR
                      </button>
                    ) : (
                      <button 
                        onClick={() => updateItemStatus(item.id, 'served')}
                        className="flex-1 bg-green-600 hover:bg-green-500 text-white py-4 rounded-2xl text-xs font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 shadow-lg"
                      >
                        <CheckCircle2 size={16} /> SERVIR
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}

        {orders.length === 0 && (
          <div className="col-span-full py-40 flex flex-col items-center justify-center text-center opacity-20 border-4 border-dashed border-white/5 rounded-[4rem]">
             <Flame size={80} className="mb-8" />
             <h4 className="text-4xl font-black italic uppercase tracking-widest">Esperando Comandas</h4>
          </div>
        )}
      </div>
    </div>
  );
};

export default KitchenModule;
