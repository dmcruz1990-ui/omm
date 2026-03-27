import React, { useEffect, useState, useCallback } from 'react';
import { supabase } from '../lib/supabase.ts';
import { Table } from '../types.ts';

interface OrderTicketProps {
  table: Table;
  onUpdateTable: (tableId: number, updates: Partial<Table>) => void;
}

const OrderTicket: React.FC<OrderTicketProps> = ({ table, onUpdateTable }) => {
  const [order, setOrder] = useState<any>(null);
  const [items, setItems] = useState<any[]>([]);

  const fetchData = useCallback(async () => {
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
    }
  }, [table]);

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
  }, [table, fetchData]);

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

  const pax = (table as any).pax || 2;
  const time = (table as any).time || '00:00';

  if (!table) return null;

  return (
    <div className="bg-[#1c1c1c] border border-[#2a2a2a] rounded-xl overflow-hidden mt-2">
      <div className="p-2.5 px-3 border-b border-[#2a2a2a] flex items-center justify-between">
        <span className="font-['Syne'] text-[12px] font-bold text-[#f0f0f0] flex items-center gap-1.5">
          🧾 Cuenta — Mesa {(table as any).num || table.id}
        </span>
        <span className="text-[10px] text-[#606060]">{pax} personas · {time}</span>
      </div>

      <div className="p-2 px-3 max-h-[180px] overflow-y-auto custom-scrollbar flex flex-col gap-1">
        {groupedItems.length === 0 ? (
          <p className="text-[11px] text-[#606060] text-center py-2.5">Sin productos agregados aún</p>
        ) : (
          groupedItems.map((o, i) => (
            <div key={i} className="flex items-center gap-2 py-1 border-b border-[#2a2a2a]">
              <span className="text-[14px]">🍽️</span>
              <span className="flex-1 text-[12px] text-[#f0f0f0]">{o.quantity}x {o.menu_items?.name}</span>
              <span className="text-[12px] font-bold text-[#d4943a] whitespace-nowrap">${o.subtotal.toLocaleString()}</span>
              <button className="bg-transparent border-none text-[#606060] cursor-pointer text-[12px] p-0.5 hover:text-[#e05050]">✕</button>
            </div>
          ))
        )}
      </div>

      <div className="p-2 px-3 border-t border-[#2a2a2a] flex flex-col gap-1">
        <div className="flex justify-between text-[11px] text-[#a0a0a0]">
          <span>Subtotal</span><span>${subtotal.toLocaleString()}</span>
        </div>
        <div className="flex justify-between text-[11px] text-[#a0a0a0]">
          <span>IVA (8%)</span><span>${tax.toLocaleString()}</span>
        </div>
        <div className="flex justify-between text-[11px] text-[#606060]">
          <span>Propina sugerida (10%)</span><span>${service.toLocaleString()}</span>
        </div>
        <div className="flex justify-between text-[15px] font-bold pt-1.5 border-t border-[#2a2a2a] mt-0.5">
          <span>Total</span>
          <span className="text-[#f0b45a]">${total.toLocaleString()}</span>
        </div>
      </div>

      <div className="flex gap-1.5 p-2 px-2.5 border-t border-[#2a2a2a]">
        <button className="flex-1 py-1.5 rounded-md font-['DM_Sans'] text-[11px] font-semibold cursor-pointer border border-[#2a2a2a] bg-transparent text-[#a0a0a0] hover:border-[#a0a0a0] hover:text-[#f0f0f0] transition-all text-center">
          📋 Detalle
        </button>
        <button className="flex-[2] py-1.5 rounded-md font-['DM_Sans'] text-[11px] font-semibold cursor-pointer border border-[#d4943a] bg-[#d4943a] text-black hover:bg-[#f0b45a] hover:border-[#f0b45a] transition-all text-center">
          💳 Cobrar ahora
        </button>
      </div>
    </div>
  );
};

export default OrderTicket;
