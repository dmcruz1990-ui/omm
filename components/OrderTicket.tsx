import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase.ts';
import { CreditCard, Loader2 } from 'lucide-react';
import { Table } from '../types.ts';
import CheckoutModal from './CheckoutModal.tsx';

interface OrderTicketProps {
  table: Table;
  onUpdateTable: (tableId: number, updates: Partial<Table>) => void;
  onPaymentSuccess?: () => void;
}

const OrderTicket: React.FC<OrderTicketProps> = ({ table, onUpdateTable, onPaymentSuccess }) => {
  const [loading, setLoading] = useState(true);
  const [order, setOrder] = useState<any>(null);
  const [items, setItems] = useState<any[]>([]);
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);

  const fetchData = async () => {
    if (!table) return;
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
      console.warn("❌ [TICKET] DB Sync Error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    if (!table) return;
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
  }, [table?.id]);

  const groupedItems = items.reduce((acc: any[], current) => {
    const itemName = current.menu_items?.name || 'Producto OMM';
    const existing = acc.find(i => i.menu_items?.name === itemName && i.status === current.status);
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

  const subtotal = items.reduce((sum, item) => sum + (Number(item.price_at_time) * item.quantity), 0);
  const tax = subtotal * 0.08;
  const service = subtotal * 0.10;
  const total = subtotal + tax + service;

  if (!table) return <div className="flex flex-col h-full bg-[#1a1d24] rounded-2xl p-6 text-gray-500 items-center justify-center">Select a table</div>;

  return (
    <div className="flex flex-col h-full bg-[#1a1d24] rounded-2xl overflow-hidden text-left">
      
      {/* Header */}
      <div className="p-6 border-b border-white/5">
        <div className="flex justify-between items-start mb-2">
          <h2 className="text-xl font-bold text-white">TABLE {table.id.toString().padStart(2, '0')}</h2>
          <span className={`px-3 py-1 rounded-full text-[9px] font-bold tracking-widest uppercase border ${order ? 'bg-blue-900/30 text-blue-400 border-blue-500/20' : 'bg-gray-800/30 text-gray-500 border-gray-700/30'}`}>
            {order ? 'ACTIVE' : 'VACANT'}
          </span>
        </div>
        <div className="flex justify-between items-center text-[10px] font-mono text-gray-400 uppercase">
          <span>ORD {order ? `#${order.id.substring(0,4)}` : '---'}</span>
          <span>SERVER: M.J.</span>
        </div>
      </div>

      {/* Items List */}
      <div className="flex-1 overflow-y-auto custom-scrollbar p-6 space-y-5">
        {loading ? (
          <div className="flex justify-center py-10"><Loader2 className="animate-spin text-blue-500" /></div>
        ) : groupedItems.length > 0 ? (
          groupedItems.map((item, idx) => (
            <div key={idx} className="flex justify-between items-start">
              <div className="flex gap-3">
                <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 ${item.status === 'pending' ? 'bg-blue-600 text-white' : 'bg-[#2a2d35] text-gray-300'}`}>
                  {item.quantity}
                </div>
                <div className="flex flex-col">
                  <span className={`text-sm font-bold ${item.status === 'pending' ? 'text-white' : 'text-gray-200'}`}>{item.menu_items?.name}</span>
                  <span className={`text-[10px] ${item.status === 'pending' ? 'text-blue-400' : 'text-gray-500'}`}>{item.status}</span>
                </div>
              </div>
              <span className="text-sm font-mono text-gray-300">${item.subtotal.toFixed(2)}</span>
            </div>
          ))
        ) : (
          <div className="text-center text-gray-600 text-xs py-10">No items yet</div>
        )}
      </div>

      {/* Totals & Action */}
      <div className="p-6 bg-[#15171c] border-t border-white/5">
        <div className="space-y-2 mb-6 text-xs font-mono">
          <div className="flex justify-between text-gray-400">
            <span>SUBTOTAL</span>
            <span>${subtotal.toFixed(2)}</span>
          </div>
          <div className="flex justify-between text-gray-400">
            <span>TAX (8%)</span>
            <span>${tax.toFixed(2)}</span>
          </div>
          <div className="flex justify-between text-green-500">
            <span>SERVICE (10%)</span>
            <span>${service.toFixed(2)}</span>
          </div>
        </div>
        
        <div className="border-t border-dashed border-gray-700 pt-4 mb-6 flex justify-between items-end">
          <span className="text-sm font-bold text-white tracking-widest">TOTAL</span>
          <span className="text-3xl font-bold text-white">${total.toFixed(2)}</span>
        </div>

        <button 
          onClick={() => setIsCheckoutOpen(true)}
          disabled={!order || items.length === 0}
          className="w-full bg-[#2563eb] hover:bg-blue-500 disabled:opacity-50 disabled:hover:bg-[#2563eb] text-white py-4 rounded-xl font-bold text-sm tracking-widest flex items-center justify-center gap-3 transition-all"
        >
          <CreditCard size={18} /> PROCESAR PAGO
        </button>
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
