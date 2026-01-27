
import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { MenuItem } from '../types';
import { Plus, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';

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
        console.error("❌ Error cargando el menú:", error);
      } else {
        setMenuItems(data || []);
      }
      setLoading(false);
    };

    fetchMenu();
  }, []);

  const handleAddItem = async (item: MenuItem) => {
    console.log("🚀 [POS] Intentando agregar:", item.name, "a mesa:", selectedTableId);
    setAddingId(item.name); 
    
    try {
      // 1. Buscar si la mesa tiene una orden abierta (open)
      let { data: order, error: orderError } = await supabase
        .from('orders')
        .select('id, total_amount')
        .eq('table_id', selectedTableId)
        .eq('status', 'open')
        .maybeSingle();

      if (orderError) throw orderError;

      // 2. Si no hay orden abierta, creamos una nueva comanda
      if (!order) {
        console.log(`[POS] 🛠️ Creando nueva comanda para Mesa ${selectedTableId}...`);
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
        
        // Actualizar la mesa a estado 'occupied'
        await supabase.from('tables').update({ status: 'occupied' }).eq('id', selectedTableId);
      }

      // 3. Insertar el ítem en la tabla order_items
      const { error: itemError } = await supabase
        .from('order_items')
        .insert([{
          order_id: order.id,
          menu_item_id: (item as any).id, 
          quantity: 1,
          price_at_time: item.price,
          status: 'pending' // Esto dispara la alerta en Cocina (KDS)
        }]);

      if (itemError) throw itemError;

      console.log("✅ [POS] Pedido enviado al ticket de la Mesa:", selectedTableId);

      // 4. Actualizar el total acumulado de la orden en la base de datos
      const newTotal = (order.total_amount || 0) + item.price;
      await supabase
        .from('orders')
        .update({ total_amount: newTotal })
        .eq('id', order.id);

      // Feedback visual de éxito
      setSuccessId(item.name);
      setTimeout(() => setSuccessId(null), 1500);
      
    } catch (err: any) {
      console.error("❌ [POS] ERROR AL PROCESAR PEDIDO:", err);
      alert(`Error al añadir al ticket: ${err.message}`);
    } finally {
      setAddingId(null);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 opacity-40">
        <Loader2 className="animate-spin text-blue-500 mb-4" size={32} />
        <p className="text-[10px] font-black uppercase tracking-widest">Sincronizando Menú OMM...</p>
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
                {/* Overlay de Confirmación */}
                {successId === item.name && (
                  <div className="absolute inset-0 bg-blue-600/90 backdrop-blur-md z-20 flex flex-col items-center justify-center animate-in fade-in zoom-in duration-300">
                    <CheckCircle2 size={32} className="text-white mb-2" />
                    <span className="text-[10px] font-black uppercase tracking-widest text-white">¡AÑADIDO!</span>
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
                  <p className="text-[9px] text-gray-600 font-bold uppercase leading-relaxed line-clamp-2">
                    {item.note || 'OMM Signature Experience'}
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
                      <span className="text-[9px] font-black uppercase tracking-widest">PEDIR A MESA</span>
                    </>
                  )}
                </button>
              </div>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
};

export default MenuGrid;
