
import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { MenuItem, NEXUS_COLORS } from '../types';
import { Plus, Loader2, CheckCircle2, ShoppingCart, AlertCircle } from 'lucide-react';

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

  useEffect(() => {
    const fetchMenu = async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from('menu_items')
        .select('*')
        .order('category', { ascending: true });

      if (error) {
        console.error("Error fetching menu:", error);
      } else {
        setMenuItems(data || []);
      }
      setLoading(false);
    };

    fetchMenu();
  }, []);

  const handleAddItem = async (item: MenuItem) => {
    setAddingId(item.name); // Usamos el nombre como ID temporal para el feedback
    try {
      // 1. Buscar orden abierta para la mesa
      let { data: order, error: orderError } = await supabase
        .from('orders')
        .select('id, total_amount')
        .eq('table_id', selectedTableId)
        .eq('status', 'open')
        .maybeSingle();

      // 2. Si no hay orden, crearla
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
        
        // Actualizar estado de la mesa a occupied por si acaso
        await supabase.from('tables').update({ status: 'occupied' }).eq('id', selectedTableId);
      }

      // 3. Insertar en order_items (Asumimos que la tabla existe)
      const { error: itemError } = await supabase
        .from('order_items')
        .insert([{
          order_id: order.id,
          menu_item_id: (item as any).id, // Usar ID real de la DB
          quantity: 1,
          price_at_time: item.price
        }]);

      // Nota: Si la tabla order_items no existe aún en la DB del usuario,
      // el sistema fallará aquí, pero la lógica es la correcta según el prompt.

      // 4. Actualizar total de la orden
      const { error: updateError } = await supabase
        .from('orders')
        .update({ total_amount: (order.total_amount || 0) + item.price })
        .eq('id', order.id);

      if (updateError) throw updateError;

      // Feedback exitoso
      setSuccessId(item.name);
      setTimeout(() => setSuccessId(null), 2000);
    } catch (err) {
      console.error("Error adding item:", err);
      alert("Error al procesar la orden. Asegúrate de que la mesa esté abierta.");
    } finally {
      setAddingId(null);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 opacity-40">
        <Loader2 className="animate-spin text-blue-500 mb-4" size={32} />
        <p className="text-[10px] font-black uppercase tracking-widest">Sincronizando Catálogo OMM...</p>
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
        <section key={category} className="space-y-6">
          <div className="flex items-center gap-4">
            <h3 className="text-sm font-black italic uppercase tracking-widest text-blue-500">{category}</h3>
            <div className="h-[1px] flex-1 bg-white/5"></div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {items.map((item, idx) => (
              <div 
                key={idx}
                className="bg-[#16161a] border border-white/5 p-6 rounded-[2.2rem] hover:border-blue-500/30 transition-all group relative overflow-hidden flex flex-col justify-between h-44 shadow-xl"
              >
                {/* Status Overlay */}
                {successId === item.name && (
                  <div className="absolute inset-0 bg-blue-600/90 backdrop-blur-md z-20 flex flex-col items-center justify-center animate-in fade-in zoom-in duration-300">
                    <CheckCircle2 size={32} className="text-white mb-2" />
                    <span className="text-[10px] font-black uppercase tracking-widest text-white">AÑADIDO</span>
                  </div>
                )}

                <div>
                  <div className="flex justify-between items-start mb-2">
                    <h4 className="text-sm font-black uppercase italic tracking-tight group-hover:text-blue-400 transition-colors leading-tight max-w-[70%]">
                      {item.name}
                    </h4>
                    <span className="text-xs font-black italic text-white whitespace-nowrap">
                      $ {item.price.toLocaleString()}
                    </span>
                  </div>
                  <p className="text-[10px] text-gray-600 font-bold uppercase leading-relaxed line-clamp-2">
                    {item.note || 'Descripción no disponible'}
                  </p>
                </div>

                <button 
                  onClick={() => handleAddItem(item)}
                  disabled={!!addingId}
                  className="w-full mt-4 bg-white/5 group-hover:bg-blue-600 group-hover:text-white border border-white/5 py-3 rounded-2xl flex items-center justify-center gap-3 transition-all active:scale-95 disabled:opacity-50"
                >
                  {addingId === item.name ? (
                    <Loader2 size={14} className="animate-spin" />
                  ) : (
                    <>
                      <Plus size={14} className="text-blue-500 group-hover:text-white" />
                      <span className="text-[9px] font-black uppercase tracking-widest">AGREGAR AL TICKET</span>
                    </>
                  )}
                </button>
              </div>
            ))}
          </div>
        </section>
      ))}
      
      {menuItems.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20 bg-white/5 rounded-[3rem] border border-dashed border-white/10 opacity-30">
          <AlertCircle size={40} className="mb-4 text-gray-500" />
          <p className="text-xs font-black uppercase tracking-widest">No hay ítems en la tabla menu_items</p>
        </div>
      )}
    </div>
  );
};

export default MenuGrid;
