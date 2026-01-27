
import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { MenuItem } from '../types';
import { Plus, Loader2, CheckCircle2, Zap, Flame, TrendingUp } from 'lucide-react';

interface MenuGridProps {
  selectedTableId: number;
}

interface GroupedMenu {
  [key: string]: MenuItem[];
}

const MenuGrid: React.FC<MenuGridProps> = ({ selectedTableId }) => {
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [addingId, setAddingId] = useState<string | null>(null);
  const [successId, setSuccessId] = useState<string | null>(null);
  
  // Estado para el contador de ventas del día
  const [salesCounts, setSalesCounts] = useState<{ [key: string]: number }>({});

  useEffect(() => {
    const fetchInitialData = async () => {
      setLoading(true);
      
      // 1. Cargar Items del Menú
      const { data: items, error: itemsError } = await supabase
        .from('menu_items')
        .select('*')
        .order('category', { ascending: true });

      if (itemsError) {
        console.error("❌ Error cargando el menú:", itemsError);
      } else {
        setMenuItems(items || []);
      }

      // 2. Cargar Ventas de Hoy
      await fetchTodaySales();
      
      setLoading(false);
    };

    fetchInitialData();

    // 3. Suscripción Real-time a nuevas ventas
    const channel = supabase
      .channel('menu-live-sales-v1')
      .on('postgres_changes', 
        { event: 'INSERT', schema: 'public', table: 'order_items' }, 
        (payload) => {
          const menuId = payload.new.menu_item_id;
          console.log("⚡ [LIVE] Nueva venta detectada del item:", menuId);
          setSalesCounts(prev => ({
            ...prev,
            [menuId]: (prev[menuId] || 0) + 1
          }));
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const fetchTodaySales = async () => {
    const today = new Date().toISOString().split('T')[0];
    const { data, error } = await supabase
      .from('order_items')
      .select('menu_item_id')
      .gte('created_at', `${today}T00:00:00`);

    if (error) {
      console.error("❌ Error al cargar ventas del día:", error);
      return;
    }

    const counts: { [key: string]: number } = {};
    data?.forEach(row => {
      counts[row.menu_item_id] = (counts[row.menu_item_id] || 0) + 1;
    });
    setSalesCounts(counts);
  };

  const handleAddItem = async (item: MenuItem) => {
    const itemId = (item as any).id;
    setAddingId(item.name); 
    
    try {
      let { data: order, error: orderError } = await supabase
        .from('orders')
        .select('id, total_amount')
        .eq('table_id', selectedTableId)
        .eq('status', 'open')
        .maybeSingle();

      if (orderError) throw orderError;

      if (!order) {
        const { data: newOrder, error: createError } = await supabase
          .from('orders')
          .insert([{ 
            table_id: selectedTableId, 
            status: 'open', 
            opened_at: new Date().toISOString(), 
            total_amount: 0 
          }])
          .select()
          .single();
        
        if (createError) throw createError;
        order = newOrder;
        await supabase.from('tables').update({ status: 'occupied' }).eq('id', selectedTableId);
      }

      const { error: itemError } = await supabase
        .from('order_items')
        .insert([{
          order_id: order.id,
          menu_item_id: itemId, 
          quantity: 1,
          price_at_time: item.price,
          status: 'pending'
        }]);

      if (itemError) throw itemError;

      const newTotal = (order.total_amount || 0) + item.price;
      await supabase.from('orders').update({ total_amount: newTotal }).eq('id', order.id);

      setSuccessId(item.name);
      setTimeout(() => setSuccessId(null), 1500);
      
    } catch (err: any) {
      console.error("❌ [POS] ERROR:", err);
      alert(`Error: ${err.message}`);
    } finally {
      setAddingId(null);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 opacity-40">
        <Loader2 className="animate-spin text-blue-500 mb-4" size={32} />
        <p className="text-[10px] font-black uppercase tracking-widest italic">Sincronizando Tendencias Live...</p>
      </div>
    );
  }

  const grouped: GroupedMenu = menuItems.reduce((acc: GroupedMenu, item) => {
    if (!acc[item.category]) acc[item.category] = [];
    acc[item.category].push(item);
    return acc;
  }, {});

  return (
    <div className="space-y-12 pb-20">
      {Object.entries(grouped).map(([category, items]) => (
        <section key={category} className="space-y-8">
          <div className="flex items-center gap-4">
            <div className="bg-blue-600/10 p-2 rounded-lg border border-blue-500/20">
               <TrendingUp size={16} className="text-blue-500" />
            </div>
            <h3 className="text-sm font-black italic uppercase tracking-widest text-white/80">{category}</h3>
            <div className="h-[1px] flex-1 bg-white/5"></div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {items.map((item, idx) => {
              const count = salesCounts[(item as any).id] || 0;
              const isHot = count >= 5;

              return (
                <div 
                  key={idx}
                  className={`bg-[#16161a] border rounded-[2.5rem] p-8 transition-all group relative overflow-hidden flex flex-col justify-between h-52 shadow-xl hover:-translate-y-1 ${
                    isHot ? 'border-orange-500/40 shadow-orange-500/5 bg-gradient-to-br from-[#1a1614] to-[#16161a]' : 'border-white/5 hover:border-white/20'
                  }`}
                >
                  {/* Badge de Ventas Live */}
                  {count > 0 && (
                    <div className={`absolute top-6 right-6 px-4 py-1.5 rounded-full text-[8px] font-black uppercase tracking-widest flex items-center gap-2 z-10 animate-in fade-in zoom-in duration-500 ${
                      isHot 
                        ? 'bg-orange-500 text-white shadow-[0_0_20px_rgba(249,115,22,0.4)] border border-orange-400' 
                        : 'bg-blue-600/10 text-blue-400 border border-blue-500/20'
                    }`}>
                      {isHot ? <Flame size={12} className="animate-pulse" /> : <Zap size={10} />}
                      {isHot ? 'HOT ITEM' : `${count} HOY`}
                    </div>
                  )}

                  {/* Overlay de Confirmación */}
                  {successId === item.name && (
                    <div className="absolute inset-0 bg-blue-600/95 backdrop-blur-md z-20 flex flex-col items-center justify-center animate-in fade-in zoom-in duration-300">
                      <CheckCircle2 size={40} className="text-white mb-2 animate-bounce" />
                      <span className="text-[10px] font-black uppercase tracking-[0.3em] text-white">PEDIDO ENVIADO</span>
                    </div>
                  )}

                  <div>
                    <div className="mb-3">
                      <h4 className={`text-xl font-black uppercase italic tracking-tight transition-colors leading-none mb-2 ${
                        isHot ? 'text-orange-400' : 'group-hover:text-blue-400 text-white'
                      }`}>
                        {item.name}
                      </h4>
                      <div className="flex items-center gap-2">
                         <span className="text-sm font-black italic text-gray-500">$ {item.price.toLocaleString()}</span>
                         {isHot && <span className="text-[7px] font-black bg-orange-500/10 text-orange-500 px-2 py-0.5 rounded-full uppercase">Alta Demanda</span>}
                      </div>
                    </div>
                    <p className="text-[9px] text-gray-600 font-bold uppercase leading-relaxed line-clamp-2 italic">
                      {item.note || 'Una experiencia sensorial diseñada para OMM.'}
                    </p>
                  </div>

                  <button 
                    onClick={() => handleAddItem(item)}
                    disabled={!!addingId}
                    className={`w-full mt-6 py-4 rounded-2xl flex items-center justify-center gap-3 transition-all active:scale-95 disabled:opacity-50 font-black text-[9px] uppercase tracking-widest ${
                      isHot 
                        ? 'bg-orange-600 text-white hover:bg-orange-500 shadow-lg shadow-orange-900/20' 
                        : 'bg-white/5 hover:bg-blue-600 hover:text-white border border-white/5'
                    }`}
                  >
                    {addingId === item.name ? (
                      <Loader2 size={16} className="animate-spin" />
                    ) : (
                      <>
                        <Plus size={16} className={isHot ? 'text-white' : 'text-blue-500 group-hover:text-white'} />
                        <span>AÑADIR A COMANDA</span>
                      </>
                    )}
                  </button>
                </div>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
};

export default MenuGrid;
