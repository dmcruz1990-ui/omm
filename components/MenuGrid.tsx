import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase.ts';
import { MenuItem } from '../types.ts';
import { 
  Plus, 
  Loader2, 
  CheckCircle2
} from 'lucide-react';

interface MenuGridProps {
  selectedTableId: number;
}

const MenuGrid: React.FC<MenuGridProps> = ({ selectedTableId }) => {
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
      <Loader2 className="animate-spin text-blue-500 mb-4" size={32} />
    </div>
  );

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 pb-24 text-left">
      {menuItems.map((item) => {
        return (
          <div 
            key={item.id} 
            className="group relative bg-[#1a1d24] rounded-2xl overflow-hidden transition-all duration-300 flex flex-col h-[280px] border border-transparent hover:border-gray-600"
          >
            {/* Image Background */}
            <div className="absolute top-0 left-0 right-0 h-[140px] z-0">
               <img src={(item as any).image_url || 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?q=80&w=400'} className="w-full h-full object-cover opacity-80" alt={item.name} />
               <div className="absolute inset-0 bg-gradient-to-b from-transparent via-[#1a1d24]/80 to-[#1a1d24]"></div>
            </div>

            {/* Price Tag */}
            <div className="absolute top-3 right-3 z-10 bg-black/60 backdrop-blur-md px-2 py-1 rounded text-xs font-bold text-white">
               ${item.price}
            </div>

            {/* Content */}
            <div className="relative z-10 flex-1 flex flex-col p-5 pt-[100px]">
               <h4 className="text-base font-bold text-white mb-2 leading-tight">
                 {item.name}
               </h4>
               <p className="text-[11px] text-gray-400 font-medium leading-relaxed line-clamp-2">
                 {(item as any).description || 'Delicioso plato preparado con los mejores ingredientes.'}
               </p>
            </div>

            {/* Footer */}
            <div className="relative z-10 px-5 pb-5 flex justify-between items-end mt-auto">
               <span className="text-[10px] font-mono text-gray-600">ID: {item.id?.substring(0,4) || '0000'}</span>
               <button 
                 onClick={() => handleAddItem(item)}
                 disabled={!!addingId || selectedTableId === 0}
                 className="w-8 h-8 rounded-full bg-[#2a2d35] hover:bg-blue-600 text-white flex items-center justify-center transition-colors disabled:opacity-50"
               >
                 {addingId === item.id ? <Loader2 size={14} className="animate-spin" /> : <Plus size={16} />}
               </button>
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default MenuGrid;
