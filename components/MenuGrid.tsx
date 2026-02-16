
import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase.ts';
import { MenuItem } from '../types.ts';
import { 
  Plus, 
  Loader2, 
  CheckCircle2, 
  CheckCircle,
  Zap,
  Timer,
  AlertCircle
} from 'lucide-react';

interface MenuGridProps {
  selectedTableId: number;
}

interface ItemMetrics {
  [key: string]: number;
}

const MenuGrid: React.FC<MenuGridProps> = ({ selectedTableId }) => {
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [addingId, setAddingId] = useState<string | null>(null);
  const [successId, setSuccessId] = useState<string | null>(null);
  const [itemDemand, setItemDemand] = useState<ItemMetrics>({});

  useEffect(() => {
    fetchMenuAndDemand();
    const interval = setInterval(fetchDemandMetrics, 30000);
    return () => clearInterval(interval);
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
      await fetchDemandMetrics();
    } catch (err) {
      console.error("❌ [MENU] Error de carga:", err);
    } finally {
      setLoading(false);
    }
  };

  const fetchDemandMetrics = async () => {
    try {
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
      const { data } = await supabase.from('order_items').select('menu_item_id').gte('created_at', oneHourAgo);
      const metrics: ItemMetrics = {};
      data?.forEach((row: any) => { metrics[row.menu_item_id] = (metrics[row.menu_item_id] || 0) + 1; });
      setItemDemand(metrics);
    } catch (err) { /* silent fail */ }
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
      
      setSuccessId(itemId);
      window.dispatchEvent(new CustomEvent('manual-order-update', { detail: { tableId: selectedTableId } }));
      setTimeout(() => setSuccessId(null), 800);
    } catch (err) { 
      console.error("❌ [ORDER] Error:", err);
    } finally { setAddingId(null); }
  };

  if (loading) return (
    <div className="py-20 flex flex-col items-center justify-center opacity-40">
      <Loader2 className="animate-spin text-blue-500 mb-4" size={32} />
      <p className="text-[10px] font-black uppercase tracking-widest italic text-white">Sincronizando Carta OMM Real...</p>
    </div>
  );

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-8 pb-24 text-left">
      {menuItems.map((item) => {
        const count = itemDemand[item.id!] || 0;
        const isHot = count >= 4;
        return (
          <div 
            key={item.id} 
            className={`group relative bg-[#111114] border-2 rounded-[3rem] overflow-hidden transition-all duration-500 flex flex-col h-[460px] ${isHot ? 'border-yellow-600' : 'border-white/5'} hover:scale-[1.01]`}
          >
            {successId === item.id && (
              <div className="absolute inset-0 bg-blue-600/90 backdrop-blur-md z-50 flex flex-col items-center justify-center animate-in zoom-in">
                <CheckCircle2 size={64} className="text-white mb-4 animate-bounce" />
                <span className="text-[10px] font-black uppercase tracking-[0.4em] text-white text-center">PEDIDO<br/>SINCRONIZADO</span>
              </div>
            )}

            <div className="pt-8 px-8 flex justify-between items-center w-full">
               <div className={`flex items-center gap-2 px-3 py-1 rounded-full text-[8px] font-black uppercase tracking-widest ${isHot ? 'bg-yellow-600 text-white' : 'bg-white/5 text-gray-500'}`}>
                  {isHot ? <Zap size={10} fill="white" /> : <CheckCircle size={10} />} {isHot ? 'DEMANDA ALTA' : 'DISPONIBLE'}
               </div>
               <span className="text-[9px] font-black text-gray-700 uppercase tracking-widest">{item.category}</span>
            </div>

            <div className="flex-1 flex flex-col p-10 justify-center">
               <h4 className="text-2xl font-black italic uppercase tracking-tighter leading-tight text-white group-hover:text-blue-500 transition-colors mb-3">
                 {item.name}
               </h4>
               <p className="text-[10px] text-gray-500 italic font-medium leading-relaxed line-clamp-3 mb-6">
                 {(item as any).description || "Plato de autoría OMM preparado con ingredientes frescos del día."}
               </p>
               <span className="text-2xl font-black italic text-white tracking-tight">$ {item.price.toLocaleString()}</span>
            </div>

            <div className="px-8 pb-10 w-full mt-auto">
               <button 
                 onClick={() => handleAddItem(item)}
                 disabled={!!addingId || selectedTableId === 0}
                 className={`w-full py-5 rounded-2xl flex items-center justify-center gap-3 transition-all font-black text-[10px] uppercase tracking-widest shadow-xl ${
                   isHot ? 'bg-yellow-600 text-white' : 'bg-white text-black hover:bg-blue-600 hover:text-white'
                 } active:scale-95 disabled:opacity-50`}
               >
                 {addingId === item.id ? <Loader2 size={18} className="animate-spin" /> : <>
                     <Plus size={16} />
                     <span>{selectedTableId === 0 ? 'SOLO CONSULTA' : 'AÑADIR A MESA'}</span>
                   </>}
               </button>
            </div>
            <div className="absolute inset-0 bg-gradient-to-b from-white/[0.01] to-transparent pointer-events-none"></div>
          </div>
        );
      })}
    </div>
  );
};

export default MenuGrid;
