
import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase.ts';
import { MenuItem } from '../types.ts';
import { Plus, Loader2, CheckCircle2, Zap, Flame, TrendingUp } from 'lucide-react';

interface MenuGridProps {
  selectedTableId: number;
}

const MenuGrid: React.FC<MenuGridProps> = ({ selectedTableId }) => {
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [addingId, setAddingId] = useState<string | null>(null);
  const [successId, setSuccessId] = useState<string | null>(null);
  
  useEffect(() => {
    const fetchMenu = async () => {
      setLoading(true);
      const { data } = await supabase.from('menu_items').select('*').order('category', { ascending: true });
      setMenuItems(data || []);
      setLoading(false);
    };
    fetchMenu();
  }, []);

  const handleAddItem = async (item: MenuItem) => {
    setAddingId(item.name); 
    try {
      let { data: order } = await supabase.from('orders').select('id, total_amount').eq('table_id', selectedTableId).eq('status', 'open').maybeSingle();
      if (!order) {
        const { data: newOrder } = await supabase.from('orders').insert([{ table_id: selectedTableId, status: 'open', opened_at: new Date().toISOString(), total_amount: 0 }]).select().single();
        order = newOrder;
        await supabase.from('tables').update({ status: 'occupied' }).eq('id', selectedTableId);
      }
      await supabase.from('order_items').insert([{ order_id: order.id, menu_item_id: (item as any).id, quantity: 1, price_at_time: item.price, status: 'pending' }]);
      await supabase.from('orders').update({ total_amount: (order.total_amount || 0) + item.price }).eq('id', order.id);
      setSuccessId(item.name);
      setTimeout(() => setSuccessId(null), 1500);
    } catch (err) { console.error(err); }
    finally { setAddingId(null); }
  };

  if (loading) return <div className="py-20 text-center opacity-40"><Loader2 className="animate-spin mx-auto mb-4" />Sincronizando Menú...</div>;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 pb-20 text-left">
      {menuItems.map((item, idx) => (
        <div key={idx} className="bg-[#16161a] border border-white/5 rounded-[2.5rem] p-8 transition-all group relative overflow-hidden flex flex-col justify-between h-52 shadow-xl hover:border-blue-500/20">
          {successId === item.name && (
            <div className="absolute inset-0 bg-blue-600/95 backdrop-blur-md z-20 flex flex-col items-center justify-center animate-in zoom-in">
              <CheckCircle2 size={40} className="text-white mb-2 animate-bounce" />
              <span className="text-[10px] font-black uppercase tracking-[0.3em] text-white">PEDIDO ENVIADO</span>
            </div>
          )}
          <div>
            <h4 className="text-xl font-black uppercase italic tracking-tight text-white group-hover:text-blue-400 transition-colors leading-none mb-2">{item.name}</h4>
            <span className="text-sm font-black italic text-gray-500">$ {item.price.toLocaleString()}</span>
          </div>
          <button 
            onClick={() => handleAddItem(item)}
            disabled={!!addingId}
            className="w-full mt-6 bg-white/5 hover:bg-blue-600 hover:text-white border border-white/5 py-4 rounded-2xl flex items-center justify-center gap-3 transition-all font-black text-[9px] uppercase tracking-widest"
          >
            {addingId === item.name ? <Loader2 size={16} className="animate-spin" /> : <><Plus size={16} className="text-blue-500 group-hover:text-white" /><span>AÑADIR</span></>}
          </button>
        </div>
      ))}
    </div>
  );
};

export default MenuGrid;
