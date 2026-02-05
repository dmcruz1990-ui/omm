
import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase.ts';
import { 
  Receipt, Loader2, ShoppingBag, CreditCard, Clock, 
  CheckCircle2, TrendingUp, AlertCircle, PlayCircle,
  Timer, ChevronRight, Zap, ShieldCheck
} from 'lucide-react';
import { Table } from '../types.ts';
import { useAuth } from '../contexts/AuthContext.tsx';
import CheckoutModal from './CheckoutModal.tsx';

interface OrderItemWithDetails {
  id: string;
  quantity: number;
  price_at_time: number;
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
        setItems(itemsData || []);
      } else {
        setOrder(null);
        setItems([]);
      }
    } catch (err) {
      console.error("❌ [TICKET] Sync Error");
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
    return () => { supabase.removeChannel(channel); };
  }, [table.id]);

  const groupedItems = items.reduce((acc: any[], current) => {
    const itemName = current.menu_items?.name || 'Item Desconocido';
    const existing = acc.find(i => i.menu_items?.name === itemName);
    if (existing) {
      existing.quantity += current.quantity;
      existing.subtotal += current.price_at_time * current.quantity;
    } else {
      acc.push({ ...current, subtotal: current.price_at_time * current.quantity });
    }
    return acc;
  }, []);

  const total = groupedItems.reduce((sum, item) => sum + item.subtotal, 0);

  if (loading && !order) return (
    <div className="h-full flex flex-col items-center justify-center opacity-40 py-20 bg-[#111114] rounded-[2.5rem]">
      <Loader2 className="animate-spin text-blue-500 mb-4" />
      <p className="text-[10px] font-black uppercase tracking-widest">Sincronizando Cuenta...</p>
    </div>
  );

  return (
    <div className="flex flex-col h-full gap-6 animate-in slide-in-from-right duration-500 text-left">
      <div className="flex flex-col bg-[#111114] border border-white/5 rounded-[2.5rem] overflow-hidden shadow-2xl flex-1">
        <div className="p-8 bg-black/40 border-b border-white/5">
          <div className="flex justify-between items-center mb-4">
            <div className="flex items-center gap-2">
              <Receipt size={18} className="text-blue-500" />
              <h4 className="text-[10px] font-black uppercase tracking-[0.3em] italic text-gray-400">TICKET_M{table.id}</h4>
            </div>
            <span className={`text-[10px] font-black px-4 py-1.5 rounded-full uppercase italic ${order ? 'bg-blue-600 text-white shadow-lg' : 'bg-white/5 text-gray-600'}`}>
              {order ? 'CUENTA ABIERTA' : 'SIN PEDIDOS'}
            </span>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto custom-scrollbar p-8 space-y-6">
          {groupedItems.length > 0 ? (
            groupedItems.map((item, idx) => (
              <div key={idx} className="flex justify-between items-start">
                <div className="flex flex-col">
                  <span className="text-xs font-black uppercase italic text-gray-200">{item.quantity}x {item.menu_items?.name}</span>
                </div>
                <span className="text-sm font-black italic text-white font-mono">$ {item.subtotal.toLocaleString()}</span>
              </div>
            ))
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-center opacity-20 py-20">
              <ShoppingBag size={48} className="mb-4 text-blue-500" />
              <p className="text-[10px] font-black uppercase tracking-[0.2em] italic italic">Esperando primera comanda</p>
            </div>
          )}
        </div>

        <div className="p-8 bg-black/60 border-t border-white/10">
          <div className="flex justify-between items-center mb-6">
            <span className="text-lg font-black italic uppercase tracking-tighter text-blue-500">TOTAL</span>
            <span className="text-3xl font-black italic text-[#10b981]">$ {total.toLocaleString()}</span>
          </div>
          <button 
            onClick={() => setIsCheckoutOpen(true)}
            disabled={!order || items.length === 0}
            className="w-full bg-white text-black hover:bg-blue-600 hover:text-white py-5 rounded-[1.8rem] font-black italic text-xs uppercase tracking-widest flex items-center justify-center gap-3 transition-all disabled:opacity-20 active:scale-95"
          >
            <CreditCard size={18} /> CERRAR CUENTA
          </button>
        </div>
      </div>

      <div className="bg-[#111114] border border-white/5 p-6 rounded-[2rem] flex items-center gap-4">
         <div className="p-3 bg-green-600/10 rounded-xl text-green-500"><ShieldCheck size={20} /></div>
         <div>
            <span className="text-[8px] text-gray-600 font-black uppercase block leading-none">Protección Fiscal</span>
            <span className="text-[10px] font-bold text-white uppercase italic">DIAN_CERTIFIED_V4</span>
         </div>
      </div>

      <CheckoutModal 
        isOpen={isCheckoutOpen} onClose={() => setIsCheckoutOpen(false)}
        order={order} items={groupedItems} tableId={table.id} total={total}
        onSuccess={() => { if (onPaymentSuccess) onPaymentSuccess(); }}
      />
    </div>
  );
};

export default OrderTicket;
