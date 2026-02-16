
import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase.ts';
import { 
  Receipt, Loader2, ShoppingBag, CreditCard, 
  CheckCircle2, ShieldCheck, Zap, BellRing,
  ChefHat, Timer, Clock
} from 'lucide-react';
import { Table } from '../types.ts';
import { useAuth } from '../contexts/AuthContext.tsx';
import CheckoutModal from './CheckoutModal.tsx';

interface OrderItemWithDetails {
  id: string;
  quantity: number;
  price_at_time: number;
  status: 'pending' | 'preparing' | 'served';
  menu_items: {
    name: string;
    price: number;
  };
}

interface OrderTicketProps {
  table: Table;
  onUpdateTable: (tableId: number, updates: Partial<Table>) => void;
  onPaymentSuccess?: () => void;
}

const OrderTicket: React.FC<OrderTicketProps> = ({ table, onUpdateTable, onPaymentSuccess }) => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [order, setOrder] = useState<any>(null);
  const [items, setItems] = useState<OrderItemWithDetails[]>([]);
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
  const [alertReady, setAlertReady] = useState(false);

  const fetchData = async () => {
    try {
      const { data: orderData } = await supabase
        .from('orders')
        .select('*')
        .eq('table_id', table.id)
        .eq('status', 'open')
        .maybeSingle();

      if (orderData) {
        setOrder(orderData);
        const { data: itemsData } = await supabase
          .from('order_items')
          .select('*, menu_items(name, price)')
          .eq('order_id', orderData.id);
        
        const currentItems = itemsData || [];
        
        // Alerta al mesero si hay algo nuevo servido
        const hasNewServed = currentItems.some(item => item.status === 'served' && !items.find(old => old.id === item.id && old.status === 'served'));
        if (hasNewServed) {
          setAlertReady(true);
          setTimeout(() => setAlertReady(false), 5000);
          // Opcional: Reproducir sonido de campana
          const audio = new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3');
          audio.volume = 0.3;
          audio.play().catch(() => {});
        }

        setItems(currentItems);
      } else {
        setOrder(null);
        setItems([]);
      }
    } catch (err) {
      console.warn("❌ [TICKET] DB Sync Error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    
    const channel = supabase
      .channel(`ticket-live-m${table.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'order_items' }, () => fetchData())
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'orders' }, () => fetchData())
      .subscribe();

    const handleManualRefresh = (e: any) => {
      if (e.detail.tableId === table.id) fetchData();
    };
    window.addEventListener('manual-order-update', handleManualRefresh);

    return () => { 
      supabase.removeChannel(channel);
      window.removeEventListener('manual-order-update', handleManualRefresh);
    };
  }, [table.id]);

  const groupedItems = items.reduce((acc: any[], current) => {
    const itemName = current.menu_items?.name || 'Producto OMM';
    const status = current.status;
    // Agrupamos también por status para que el mesero vea qué está listo y qué no
    const existing = acc.find(i => i.menu_items?.name === itemName && i.status === status);
    const price = Number(current.price_at_time);
    
    if (existing) {
      existing.quantity += current.quantity;
      existing.subtotal += price * current.quantity;
    } else {
      acc.push({ 
        ...current, 
        subtotal: price * current.quantity 
      });
    }
    return acc;
  }, []);

  const total = items.reduce((sum, item) => sum + (Number(item.price_at_time) * item.quantity), 0);

  if (loading && !order) return (
    <div className="h-full flex flex-col items-center justify-center opacity-40 py-20 bg-[#111114] rounded-[2.5rem]">
      <Loader2 className="animate-spin text-blue-500 mb-4" />
      <p className="text-[10px] font-black uppercase tracking-widest italic text-white">Sincronizando Cuenta OMM...</p>
    </div>
  );

  return (
    <div className="flex flex-col h-full gap-6 animate-in slide-in-from-right duration-500 text-left relative">
      
      {alertReady && (
        <div className="absolute -top-12 left-0 right-0 z-50 animate-in slide-in-from-top duration-300">
          <div className="bg-blue-600 text-white px-6 py-3 rounded-full shadow-[0_0_30px_rgba(37,99,235,0.6)] flex items-center justify-center gap-3">
            <BellRing size={16} className="animate-bounce" />
            <span className="text-[10px] font-black uppercase tracking-widest">¡PEDIDO LISTO EN BARRA!</span>
          </div>
        </div>
      )}

      <div className="flex flex-col bg-[#111114] border border-white/5 rounded-[2.5rem] overflow-hidden shadow-2xl flex-1">
        <div className="p-8 bg-black/40 border-b border-white/5">
          <div className="flex justify-between items-center mb-4">
            <div className="flex items-center gap-2">
              <Receipt size={18} className="text-blue-500" />
              <h4 className="text-[10px] font-black uppercase tracking-[0.3em] italic text-gray-400">CUENTA_M{table.id}</h4>
            </div>
            <span className={`text-[9px] font-black px-4 py-1.5 rounded-full uppercase italic ${order ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/40' : 'bg-white/5 text-gray-600'}`}>
              {order ? 'MESA_ACTIVA' : 'DISPONIBLE'}
            </span>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto custom-scrollbar p-8 space-y-6">
          {groupedItems.length > 0 ? (
            groupedItems.map((item, idx) => (
              <div 
                key={idx} 
                className={`flex justify-between items-start p-4 rounded-2xl transition-all duration-500 ${
                  item.status === 'served' 
                    ? 'bg-blue-600/10 border border-blue-500/30 shadow-[inset_0_0_15px_rgba(37,99,235,0.1)]' 
                    : 'bg-black/20 border border-transparent'
                }`}
              >
                <div className="flex flex-col gap-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-black uppercase italic text-gray-200">
                      {item.quantity}x {item.menu_items?.name}
                    </span>
                    {item.status === 'served' && <CheckCircle2 size={12} className="text-blue-500" />}
                  </div>
                  
                  {/* Status Label for Waiter */}
                  <div className="flex items-center gap-2">
                    {item.status === 'pending' ? (
                      <span className="text-[7px] font-black text-gray-600 uppercase tracking-widest flex items-center gap-1">
                        {/* Fix: Clock icon used from lucide-react */}
                        <Clock size={8} /> EN COLA
                      </span>
                    ) : item.status === 'preparing' ? (
                      <span className="text-[7px] font-black text-orange-500 uppercase tracking-widest flex items-center gap-1 animate-pulse">
                        <ChefHat size={8} /> EN COCINA
                      </span>
                    ) : (
                      <span className="text-[8px] font-black text-blue-400 uppercase tracking-widest flex items-center gap-1">
                        <Zap size={8} fill="currentColor" /> LISTO EN BARRA • RECOGER
                      </span>
                    )}
                  </div>
                </div>
                <span className="text-sm font-black italic text-white font-mono">$ {item.subtotal.toLocaleString()}</span>
              </div>
            ))
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-center opacity-20 py-20">
              <ShoppingBag size={48} className="mb-4 text-blue-500" />
              <p className="text-[10px] font-black uppercase tracking-[0.2em] italic text-white">Sin platos registrados</p>
            </div>
          )}
        </div>

        <div className="p-8 bg-black/60 border-t border-white/10">
          <div className="flex justify-between items-center mb-6">
            <span className="text-lg font-black italic uppercase tracking-tighter text-blue-500">GRAN TOTAL</span>
            <span className="text-3xl font-black italic text-[#10b981]">$ {total.toLocaleString()}</span>
          </div>
          <button 
            onClick={() => setIsCheckoutOpen(true)}
            disabled={!order || items.length === 0}
            className="w-full bg-white text-black hover:bg-blue-600 hover:text-white py-5 rounded-2xl font-black italic text-[11px] uppercase tracking-widest flex items-center justify-center gap-3 transition-all disabled:opacity-20 active:scale-95 shadow-xl"
          >
            <CreditCard size={18} /> CERRAR Y FACTURAR
          </button>
        </div>
      </div>

      <div className="bg-[#111114] border border-white/5 p-6 rounded-[2rem] flex items-center gap-4">
         <div className="p-3 bg-green-600/10 rounded-xl text-green-500"><ShieldCheck size={20} /></div>
         <div>
            <span className="text-[8px] text-gray-600 font-black uppercase block leading-none">Protección Fiscal OMM</span>
            <span className="text-[10px] font-bold text-white uppercase italic">DIAN_CERTIFIED_HUB_V4</span>
         </div>
      </div>

      <CheckoutModal 
        isOpen={isCheckoutOpen} onClose={() => setIsCheckoutOpen(false)}
        order={order} items={groupedItems} tableId={table.id} total={total}
        onSuccess={() => { if (onPaymentSuccess) onPaymentSuccess(); fetchData(); }}
      />
    </div>
  );
};

export default OrderTicket;
