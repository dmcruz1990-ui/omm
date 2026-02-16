
import React, { useState, useEffect } from 'react';
import { 
  ChefHat, 
  Flame, 
  Zap, 
  Wine, 
  Clock, 
  TrendingUp, 
  AlertTriangle, 
  CheckCircle2, 
  ChevronRight,
  Monitor,
  Droplets,
  Timer,
  Activity,
  BarChart3,
  Coffee,
  Martini,
  IceCream,
  Utensils,
  Beef,
  GlassWater,
  // Fix: Added missing Loader2 and Play imports from lucide-react
  Loader2,
  Play
} from 'lucide-react';
import { supabase } from '../lib/supabase.ts';

type Station = 'ALL' | 'CALIENTE' | 'FRIA' | 'ENSALADAS' | 'POSTRES' | 'CHARCUTERIA' | 'BAR' | 'CAVA';

interface FlowOrderItem {
  id: string;
  order_id: string;
  status: 'pending' | 'preparing' | 'served';
  quantity: number;
  created_at: string;
  updated_at: string;
  table_id?: number;
  menu_items: {
    name: string;
    category: string;
  };
}

const FlowModule: React.FC = () => {
  const [activeStation, setActiveStation] = useState<Station>('ALL');
  const [items, setItems] = useState<FlowOrderItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  const fetchFlowData = async () => {
    try {
      // Obtenemos todos los items de ordenes abiertas que no han sido servidos
      const { data: ordersData } = await supabase
        .from('orders')
        .select('id, table_id')
        .eq('status', 'open');

      if (!ordersData || ordersData.length === 0) {
        setItems([]);
        return;
      }

      const orderIds = ordersData.map(o => o.id);
      const { data: itemsData } = await supabase
        .from('order_items')
        .select('*, menu_items(name, category)')
        .in('order_id', orderIds)
        .neq('status', 'served')
        .order('created_at', { ascending: true });

      if (itemsData) {
        // Enriquecemos los items con el table_id de la orden madre
        const enriched = itemsData.map(item => ({
          ...item,
          table_id: ordersData.find(o => o.id === item.order_id)?.table_id
        }));
        setItems(enriched);
      }
    } catch (err) {
      console.error("Flow Sync Error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFlowData();
    const channel = supabase.channel('flow-live-v1')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'order_items' }, () => fetchFlowData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, () => fetchFlowData())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  const updateItemStatus = async (itemId: string, newStatus: string) => {
    await supabase.from('order_items').update({ 
      status: newStatus,
      updated_at: new Date().toISOString()
    }).eq('id', itemId);
  };

  // Lógica de mapeo de categorías de menú a estaciones físicas de OMM
  const getStationForItem = (category: string): Station => {
    const cat = category.toUpperCase();
    if (cat.includes('ROBATA') || cat.includes('CALIENTE')) return 'CALIENTE';
    if (cat.includes('SUSHI') || cat.includes('ENTRADAS') || cat.includes('FRIA')) return 'FRIA';
    if (cat.includes('ENSALADA')) return 'ENSALADAS';
    if (cat.includes('POSTRE')) return 'POSTRES';
    if (cat.includes('CHARCUTERIA') || cat.includes('TABLA')) return 'CHARCUTERIA';
    if (cat.includes('COCTEL') || cat.includes('BEBIDA')) return 'BAR';
    if (cat.includes('VINO') || cat.includes('CAVA')) return 'CAVA';
    return 'CALIENTE'; // Default
  };

  const filteredItems = items.filter(item => {
    if (activeStation === 'ALL') return true;
    return getStationForItem(item.menu_items.category) === activeStation;
  });

  const getStationCount = (station: Station) => {
    if (station === 'ALL') return items.length;
    return items.filter(i => getStationForItem(i.menu_items.category) === station).length;
  };

  if (loading) return (
    <div className="h-full flex flex-col items-center justify-center opacity-40 py-40">
      {/* Fix: Loader2 correctly used after import */}
      <Loader2 className="animate-spin text-blue-500 mb-4" size={48} />
      <p className="text-sm font-black uppercase tracking-[0.5em] text-gray-500 italic">Balanceando Carga Estaciones...</p>
    </div>
  );

  return (
    <div className="space-y-10 animate-in fade-in duration-700 text-left pb-20">
      
      {/* Header Orquestador */}
      <header className="flex flex-col xl:flex-row items-start xl:items-center justify-between gap-8 border-b border-white/5 pb-10">
        <div className="flex items-center gap-6">
           <div className="w-16 h-16 bg-blue-600 rounded-[2rem] flex items-center justify-center shadow-2xl shadow-blue-600/30">
              <Activity size={32} className="text-white" />
           </div>
           <div>
              <h2 className="text-4xl font-black italic tracking-tighter uppercase leading-none">Command Flow</h2>
              <p className="text-[11px] text-gray-500 font-black uppercase tracking-[0.4em] mt-3">Orquestación Multizona OMM</p>
           </div>
        </div>

        {/* Tab Selector de Estaciones Estilo Centro de Control */}
        <div className="flex flex-wrap gap-2 bg-[#111114] p-2 rounded-[2.5rem] border border-white/5">
          <StationTab active={activeStation === 'ALL'} count={getStationCount('ALL')} onClick={() => setActiveStation('ALL')} label="GLOBAL" icon={<Monitor size={14} />} />
          <StationTab active={activeStation === 'CALIENTE'} count={getStationCount('CALIENTE')} onClick={() => setActiveStation('CALIENTE')} label="CALIENTE" icon={<Flame size={14} />} color="text-orange-500" />
          <StationTab active={activeStation === 'FRIA'} count={getStationCount('FRIA')} onClick={() => setActiveStation('FRIA')} label="FRÍA" icon={<Droplets size={14} />} color="text-blue-400" />
          <StationTab active={activeStation === 'ENSALADAS'} count={getStationCount('ENSALADAS')} onClick={() => setActiveStation('ENSALADAS')} label="ENSALADAS" icon={<Utensils size={14} />} color="text-green-500" />
          <StationTab active={activeStation === 'POSTRES'} count={getStationCount('POSTRES')} onClick={() => setActiveStation('POSTRES')} label="POSTRES" icon={<IceCream size={14} />} color="text-pink-500" />
          <StationTab active={activeStation === 'CHARCUTERIA'} count={getStationCount('CHARCUTERIA')} onClick={() => setActiveStation('CHARCUTERIA')} label="CHARCUTERÍA" icon={<Beef size={14} />} color="text-amber-600" />
          <StationTab active={activeStation === 'BAR'} count={getStationCount('BAR')} onClick={() => setActiveStation('BAR')} label="BAR" icon={<Martini size={14} />} color="text-purple-500" />
          <StationTab active={activeStation === 'CAVA'} count={getStationCount('CAVA')} onClick={() => setActiveStation('CAVA')} label="CAVA" icon={<Wine size={14} />} color="text-red-400" />
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
        
        {/* Panel de Comandas por Estación */}
        <div className="lg:col-span-9">
           <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
              {filteredItems.map(item => {
                const isPreparing = item.status === 'preparing';
                const station = getStationForItem(item.menu_items.category);
                const startTime = new Date(isPreparing ? item.updated_at : item.created_at).getTime();
                const diff = Math.floor((now - startTime) / 1000);
                const mins = Math.floor(diff / 60);
                const secs = diff % 60;
                const isAlert = mins >= (station === 'CALIENTE' ? 12 : 8);

                return (
                  <div key={item.id} className={`bg-[#111114] border-2 rounded-[3rem] overflow-hidden flex flex-col shadow-2xl transition-all hover:scale-[1.02] ${isAlert ? 'border-red-600 animate-pulse' : isPreparing ? 'border-blue-500/40' : 'border-white/5'}`}>
                     
                     {/* Card Header: Mesa y Cronómetro */}
                     <div className={`p-6 border-b flex justify-between items-center ${isAlert ? 'bg-red-600/10 border-red-600/20' : 'bg-white/[0.02] border-white/5'}`}>
                        <div className="flex items-center gap-3">
                           <div className="bg-white/5 px-3 py-1 rounded-xl font-black italic text-sm text-blue-500">M{item.table_id}</div>
                           <span className="text-[8px] font-black text-gray-600 uppercase tracking-widest">{station}</span>
                        </div>
                        <div className={`flex items-center gap-2 font-mono text-sm font-black italic ${isAlert ? 'text-red-500' : isPreparing ? 'text-blue-400' : 'text-gray-500'}`}>
                           <Clock size={14} />
                           {mins}:{secs.toString().padStart(2, '0')}
                        </div>
                     </div>

                     {/* Card Body: Producto */}
                     <div className="p-8 flex-1">
                        <h4 className="text-xl font-black italic uppercase leading-tight text-white mb-2">{item.quantity}x {item.menu_items.name}</h4>
                        <div className="flex items-center gap-2">
                           <span className="text-[9px] font-black text-gray-600 uppercase tracking-widest">{item.menu_items.category}</span>
                           <div className={`w-1 h-1 rounded-full ${isPreparing ? 'bg-blue-500' : 'bg-gray-700'}`}></div>
                           <span className={`text-[9px] font-black uppercase ${isPreparing ? 'text-blue-500' : 'text-gray-700'}`}>{item.status}</span>
                        </div>
                     </div>

                     {/* Action Button */}
                     <div className="p-6 pt-0">
                        {!isPreparing ? (
                          <button 
                            onClick={() => updateItemStatus(item.id, 'preparing')}
                            className="w-full bg-white text-black hover:bg-blue-600 hover:text-white py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 shadow-xl"
                          >
                             {/* Fix: Play correctly used after import */}
                             <Play size={16} fill="currentColor" /> COMENZAR
                          </button>
                        ) : (
                          <button 
                            onClick={() => updateItemStatus(item.id, 'served')}
                            className="w-full bg-blue-600 hover:bg-green-600 text-white py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 shadow-xl"
                          >
                             <CheckCircle2 size={16} /> LISTO PARA ENTREGA
                          </button>
                        )}
                     </div>
                  </div>
                );
              })}

              {filteredItems.length === 0 && (
                <div className="col-span-full py-40 flex flex-col items-center justify-center text-center opacity-10 border-4 border-dashed border-white/5 rounded-[4rem]">
                   <Zap size={80} className="mb-6 text-blue-500" />
                   <h4 className="text-4xl font-black italic uppercase tracking-[0.2em]">Estación Despejada</h4>
                   <p className="text-sm font-bold uppercase mt-4">No hay pedidos pendientes en {activeStation}</p>
                </div>
              )}
           </div>
        </div>

        {/* Sidebar Intelligence */}
        <div className="lg:col-span-3 space-y-8">
           <div className="bg-[#111114] border border-white/5 p-8 rounded-[3.5rem] shadow-2xl">
              <h3 className="text-xs font-black text-gray-500 uppercase tracking-widest flex items-center gap-2 italic mb-8">
                 <BarChart3 size={16} className="text-blue-500" /> Rendimiento Live
              </h3>
              <div className="space-y-6">
                 <MetricRow label="Ocupación de Pista" value="74%" />
                 <MetricRow label="Items en Fuego" value={items.filter(i => i.status === 'preparing').length.toString()} />
                 <MetricRow label="SLA de Cocción" value="09:42 min" color="text-green-500" />
              </div>
           </div>

           <div className="bg-gradient-to-br from-blue-600/20 to-transparent p-10 rounded-[3.5rem] border border-blue-500/10 shadow-xl">
              <div className="flex items-center gap-3 mb-4">
                 <Zap size={20} className="text-blue-500" fill="currentColor" />
                 <h4 className="text-[10px] font-black text-white uppercase tracking-widest italic">Predictivo Nexum</h4>
              </div>
              <p className="text-sm text-gray-400 italic leading-relaxed">
                "Alta demanda detectada en la estación de **CALIENTE**. Sugiero mover un refuerzo de **ENSALADAS** para apoyar la salida de Robata."
              </p>
           </div>
        </div>

      </div>
    </div>
  );
};

const StationTab = ({ active, onClick, icon, label, count, color }: any) => (
  <button 
    onClick={onClick}
    className={`flex items-center gap-3 px-6 py-3 rounded-full text-[10px] font-black uppercase tracking-widest transition-all relative ${
      active ? 'bg-white text-black shadow-2xl scale-105 z-10' : 'text-gray-500 hover:text-white'
    }`}
  >
    <span className={active ? '' : (color || 'text-gray-600')}>{icon}</span>
    <span>{label}</span>
    {count > 0 && (
      <span className={`ml-1 px-2 py-0.5 rounded-full text-[8px] ${active ? 'bg-black text-white' : 'bg-white/5 text-gray-500'}`}>
        {count}
      </span>
    )}
  </button>
);

const MetricRow = ({ label, value, color }: any) => (
  <div className="flex justify-between items-center border-b border-white/5 pb-4 last:border-0 last:pb-0">
     <span className="text-[10px] text-gray-500 font-black uppercase tracking-tighter">{label}</span>
     <span className={`text-sm font-black italic ${color || 'text-white'}`}>{value}</span>
  </div>
);

export default FlowModule;
