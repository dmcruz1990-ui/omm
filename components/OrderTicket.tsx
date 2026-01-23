
import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { Receipt, Loader2, ShoppingBag, CreditCard, Clock, AlertCircle } from 'lucide-react';

interface OrderItemWithDetails {
  id: string;
  quantity: number;
  price_at_time: number;
  menu_items: {
    name: string;
  };
}

interface OrderTicketProps {
  tableId: number;
}

const OrderTicket: React.FC<OrderTicketProps> = ({ tableId }) => {
  const [loading, setLoading] = useState(true);
  const [order, setOrder] = useState<any>(null);
  const [items, setItems] = useState<OrderItemWithDetails[]>([]);

  const fetchOrderData = async () => {
    setLoading(true);
    try {
      // 1. Buscar la orden abierta para esta mesa
      const { data: orderData, error: orderError } = await supabase
        .from('orders')
        .select('*')
        .eq('table_id', tableId)
        .eq('status', 'open')
        .maybeSingle();

      if (orderError) throw orderError;

      if (orderData) {
        setOrder(orderData);
        // 2. Traer los items vinculados con los nombres de menu_items
        const { data: itemsData, error: itemsError } = await supabase
          .from('order_items')
          .select('*, menu_items(name)')
          .eq('order_id', orderData.id);

        if (itemsError) throw itemsError;
        setItems(itemsData || []);
      } else {
        setOrder(null);
        setItems([]);
      }
    } catch (err) {
      console.error("Error fetching order ticket:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrderData();

    // Suscripción en tiempo real para actualizaciones de la cuenta
    const channel = supabase
      .channel(`table-order-${tableId}`)
      .on('postgres_changes', { 
        event: '*', 
        schema: 'public', 
        table: 'order_items' 
      }, () => fetchOrderData())
      .on('postgres_changes', { 
        event: 'UPDATE', 
        schema: 'public', 
        table: 'orders' 
      }, () => fetchOrderData())
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [tableId]);

  // Agrupar items idénticos para el ticket visual
  const groupedItems = items.reduce((acc: any[], current) => {
    const itemName = current.menu_items?.name || 'Item Desconocido';
    const existing = acc.find(i => i.menu_items?.name === itemName);
    if (existing) {
      existing.quantity += current.quantity;
      existing.subtotal += current.price_at_time * current.quantity;
    } else {
      acc.push({
        ...current,
        subtotal: current.price_at_time * current.quantity
      });
    }
    return acc;
  }, []);

  const total = groupedItems.reduce((sum, item) => sum + item.subtotal, 0);

  if (loading && !order) {
    return (
      <div className="h-full flex flex-col items-center justify-center opacity-40 py-20">
        <Loader2 className="animate-spin text-blue-500 mb-4" />
        <p className="text-[10px] font-black uppercase tracking-widest">Generando Recibo...</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-[#111114] border border-white/5 rounded-[2.5rem] overflow-hidden shadow-2xl animate-in slide-in-from-right duration-500">
      {/* Header del Ticket */}
      <div className="p-6 bg-black/40 border-b border-white/5">
        <div className="flex justify-between items-center mb-4">
          <div className="flex items-center gap-2">
            <Receipt size={16} className="text-blue-500" />
            <h4 className="text-[10px] font-black uppercase tracking-[0.2em] italic text-gray-400">TICKET_DE_MESA</h4>
          </div>
          <span className="text-[10px] font-black text-white bg-blue-600 px-3 py-1 rounded-full">
            #{tableId.toString().padStart(2, '0')}
          </span>
        </div>
        
        {order ? (
          <div className="flex items-center justify-between text-[9px] font-bold text-gray-500 uppercase tracking-widest">
            <span className="flex items-center gap-1"><Clock size={10} /> {new Date(order.opened_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
            <span>ID: {String(order.id).split('-')[0]}</span>
          </div>
        ) : (
          <div className="text-[9px] text-orange-500 font-black uppercase tracking-widest">Mesa sin orden activa</div>
        )}
      </div>

      {/* Cuerpo del Recibo */}
      <div className="flex-1 overflow-y-auto custom-scrollbar p-6 space-y-4">
        {groupedItems.length > 0 ? (
          groupedItems.map((item, idx) => (
            <div key={idx} className="flex justify-between items-start animate-in fade-in slide-in-from-bottom-2">
              <div className="flex flex-col">
                <span className="text-[11px] font-black uppercase italic text-gray-200">
                  {item.quantity}x {item.menu_items?.name || 'Producto'}
                </span>
                <span className="text-[9px] text-gray-600 font-mono tracking-tighter">
                  Unit: ${item.price_at_time.toLocaleString()}
                </span>
              </div>
              <span className="text-xs font-black font-mono text-white">
                ${item.subtotal.toLocaleString()}
              </span>
            </div>
          ))
        ) : (
          <div className="h-full flex flex-col items-center justify-center text-center opacity-20 py-10">
            <ShoppingBag size={32} className="mb-4" />
            <p className="text-[10px] font-black uppercase tracking-widest">Añade productos<br/>desde el menú</p>
          </div>
        )}
      </div>

      {/* Totales y Acciones */}
      <div className="p-6 bg-black/60 border-t border-white/5 space-y-6">
        <div className="space-y-2">
          <div className="flex justify-between items-center text-[10px] text-gray-500 font-bold uppercase tracking-widest">
            <span>Subtotal</span>
            <span className="font-mono">${(total * 0.92).toLocaleString()}</span>
          </div>
          <div className="flex justify-between items-center text-[10px] text-gray-500 font-bold uppercase tracking-widest">
            <span>Impoconsumo (8%)</span>
            <span className="font-mono">${(total * 0.08).toLocaleString()}</span>
          </div>
          <div className="h-[1px] w-full bg-white/5 my-2"></div>
          <div className="flex justify-between items-center">
            <span className="text-sm font-black italic uppercase tracking-widest text-blue-500">Total Cuenta</span>
            <span className="text-2xl font-black italic text-[#10b981] drop-shadow-[0_0_10px_rgba(16,185,129,0.3)]">
              ${total.toLocaleString()}
            </span>
          </div>
        </div>

        <button 
          disabled={!order || groupedItems.length === 0}
          className="w-full bg-white text-black hover:bg-blue-600 hover:text-white py-5 rounded-2xl font-black italic text-xs uppercase tracking-widest flex items-center justify-center gap-3 transition-all active:scale-95 disabled:opacity-20 disabled:grayscale shadow-xl"
        >
          <CreditCard size={16} />
          PROCESAR PAGO / CERRAR
        </button>
      </div>
    </div>
  );
};

export default OrderTicket;
