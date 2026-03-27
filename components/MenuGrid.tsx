import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase.ts';
import { MenuItem } from '../types.ts';
import { Loader2 } from 'lucide-react';

interface MenuGridProps {
  selectedTableId: number;
  currentCat: string;
}

const MenuGrid: React.FC<MenuGridProps> = ({ selectedTableId, currentCat }) => {
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [addingId, setAddingId] = useState<string | null>(null);

  useEffect(() => {
    fetchMenuAndDemand();
  }, []);

  const fetchMenuAndDemand = async () => {
    setLoading(true);
    try {
      const { data: items, error } = await supabase
        .from('menu_items')
        .select('*')
        .order('category', { ascending: true });
      
      if (error) throw error;
      if (items) setMenuItems(items);
    } catch (err) {
      console.error("❌ [MENU] Error:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleAddItem = async (item: MenuItem) => {
    if (selectedTableId === 0) return;
    const itemId = item.id;
    if (!itemId) return;
    
    setAddingId(itemId); 
    
    try {
      let { data: order } = await supabase.from('orders').select('id, total_amount').eq('table_id', selectedTableId).eq('status', 'open').maybeSingle();
      
      if (!order) {
        const { data: newOrder, error: orderErr } = await supabase.from('orders').insert([{ 
          table_id: selectedTableId, 
          status: 'open', 
          opened_at: new Date().toISOString(), 
          total_amount: 0 
        }]).select().single();
        if (orderErr) throw orderErr;
        order = newOrder;
        await supabase.from('tables').update({ status: 'occupied' }).eq('id', selectedTableId);
      }
      
      const { error: itemErr } = await supabase.from('order_items').insert([{ 
        order_id: order.id, 
        menu_item_id: itemId, 
        quantity: 1, 
        price_at_time: item.price, 
        status: 'pending'
      }]);
      if (itemErr) throw itemErr;

      await supabase.from('orders').update({ total_amount: (order.total_amount || 0) + item.price }).eq('id', order.id);
      
      window.dispatchEvent(new CustomEvent('manual-order-update', { detail: { tableId: selectedTableId } }));
    } catch (err) { 
      console.error("❌ [ORDER] Error:", err);
    } finally { setAddingId(null); }
  };

  if (loading) return (
    <div className="py-20 flex flex-col items-center justify-center opacity-40">
      <Loader2 className="animate-spin text-[#4a8fd4] mb-4" size={32} />
    </div>
  );

  const filteredItems = currentCat === 'ALL' ? menuItems : menuItems.filter(i => i.category.toUpperCase() === currentCat.toUpperCase());

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2.5 pb-24 text-left">
      {filteredItems.map((item) => {
        // Mocking some data that might not be in DB yet
        const emoji = (item as any).emoji || '🍽️';
        const desc = (item as any).description || 'Delicioso plato preparado con los mejores ingredientes.';
        const badge = (item as any).badge || 'recomendado';
        
        let badgeClass = 'bg-[#3dba6f]/15 text-[#3dba6f]';
        let badgeLabel = 'Recomendado';
        if (badge === 'gold') { badgeClass = 'bg-[#d4943a]/15 text-[#d4943a]'; badgeLabel = 'Alta rentable'; }
        if (badge === 'orange') { badgeClass = 'bg-[#e07830]/15 text-[#e07830]'; badgeLabel = 'Mover Hoy'; }
        if (badge === 'red') { badgeClass = 'bg-[#e05050]/15 text-[#e05050]'; badgeLabel = 'Urgente'; }

        return (
          <div 
            key={item.id} 
            className="bg-[#1c1c1c] border border-[#2a2a2a] rounded-xl overflow-hidden cursor-pointer transition-all duration-200 relative flex flex-col hover:border-[#d4943a]/50 hover:-translate-y-0.5 hover:shadow-[0_6px_20px_rgba(0,0,0,0.4)] group"
            onClick={() => handleAddItem(item)}
          >
            <div className="w-full aspect-[4/3] bg-[#222222] flex items-center justify-center text-[44px] shrink-0">
              {emoji}
            </div>
            <div className="p-2.5 flex-1 flex flex-col gap-1">
              <div className="text-[13px] font-bold leading-[1.3] text-[#f0f0f0]">{item.name}</div>
              <div className="text-[11px] text-[#606060] leading-[1.4] flex-1 line-clamp-2">{desc}</div>
              <span className={`inline-block px-2 py-0.5 rounded-full text-[9px] font-semibold tracking-[0.3px] self-start mt-1 ${badgeClass}`}>
                {badgeLabel}
              </span>
              <div className="text-[14px] font-bold text-[#d4943a] mt-0.5">${item.price.toLocaleString()}</div>
              <button 
                disabled={!!addingId || selectedTableId === 0}
                className="w-full mt-2 py-1.5 rounded-md bg-[#d4943a] text-black font-['DM_Sans'] text-[11px] font-bold border-none cursor-pointer transition-all tracking-[0.2px] hover:bg-[#f0b45a] disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {addingId === item.id ? <Loader2 size={14} className="animate-spin" /> : '+ Agregar a la orden'}
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default MenuGrid;
