
import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase.ts';
import {
  Loader2,
  Flame,
  Clock,
  Zap,
  History,
  CheckCircle,
  TrendingUp,
} from 'lucide-react';

type ItemStatus = 'pending' | 'preparing' | 'almost' | 'ready' | 'served';

interface OrderItem {
  id: string;
  order_id: string;
  status: ItemStatus;
  quantity: number;
  created_at: string;
  updated_at: string;
  tiempo_inicio: string | null;
  menu_items: {
    name: string;
    category: string;
  };
}

interface KitchenOrder {
  id: string;
  table_id: number;
  opened_at: string;
  items: OrderItem[];
}

// ── Flujo visual de 5 estados ───────────────────────────────────────────
const FLOW: Record<ItemStatus, {
  dot: string; label: string; color: string;
  next: ItemStatus | null; btn: string | null;
}> = {
  pending:   { dot:'🔴', label:'NUEVO PEDIDO',        color:'#ef4444', next:'preparing', btn:'Comenzar preparación' },
  preparing: { dot:'🟠', label:'PREPARANDO',          color:'#f97316', next:'almost',    btn:'Marcar casi listo' },
  almost:    { dot:'🟡', label:'CASI LISTO',          color:'#eab308', next:'ready',     btn:'Listo para entrega' },
  ready:     { dot:'🔵', label:'LISTO PARA ENTREGA',  color:'#3b82f6', next:'served',    btn:'Marcar entregado' },
  served:    { dot:'🟢', label:'ENTREGADO',           color:'#22c55e', next:null,        btn:null },
};

const KitchenModule: React.FC = () => {
  const [orders, setOrders] = useState<KitchenOrder[]>([]);
  const [completedItems, setCompletedItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [now, setNow] = useState(Date.now());
  // Items recién entregados — se muestran 5s en verde y desaparecen
  const [justServed, setJustServed] = useState<Record<string, { item: OrderItem; tableId: number; at: number }>>({});

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  const fetchKitchenOrders = useCallback(async () => {
    try {
      const { data: ordersData } = await supabase
        .from('orders')
        .select('*')
        .eq('status', 'open')
        .order('opened_at', { ascending: true });

      if (ordersData && ordersData.length > 0) {
        const orderIds = ordersData.map(o => o.id);
        const { data: itemsData } = await supabase
          .from('order_items')
          .select('*, menu_items(name, category)')
          .in('order_id', orderIds);

        const allItems = itemsData || [];

        const mappedOrders = ordersData.map(order => ({
          ...order,
          items: allItems.filter(item => item.order_id === order.id && item.status !== 'served'),
        })).filter(order => order.items.length > 0);

        const served = allItems
          .filter(item => item.status === 'served')
          .map(item => {
            const start = new Date(item.created_at).getTime();
            const end = new Date(item.updated_at).getTime();
            const prepMinutes = Math.round((end - start) / 60000);
            return { ...item, prepMinutes };
          })
          .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())
          .slice(0, 20);

        setOrders(mappedOrders);
        setCompletedItems(served);
      } else {
        setOrders([]);
        setCompletedItems([]);
      }
    } catch (err) {
      console.error('KDS Sync Error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchKitchenOrders();
    const channel = supabase.channel('kds-live-v10')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'order_items' }, () => fetchKitchenOrders())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, () => fetchKitchenOrders())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [fetchKitchenOrders]);

  // Avanzar al siguiente estado del flujo
  const avanzar = async (item: OrderItem, tableId: number) => {
    const cfg = FLOW[item.status];
    if (!cfg.next) return;
    const nuevo = cfg.next;
    const updates: any = { status: nuevo, updated_at: new Date().toISOString() };
    if (nuevo === 'preparing') updates.tiempo_inicio = new Date().toISOString();
    if (nuevo === 'served') {
      updates.tiempo_listo = new Date().toISOString();
      updates.duracion_seg = Math.round((now - new Date(item.created_at).getTime()) / 1000);
    }
    // Si pasa a ENTREGADO, lo mostramos 5s en verde y luego desaparece
    if (nuevo === 'served') {
      setJustServed(prev => ({ ...prev, [item.id]: { item: { ...item, status: 'served' }, tableId, at: Date.now() } }));
      setTimeout(() => {
        setJustServed(prev => { const n = { ...prev }; delete n[item.id]; return n; });
      }, 5000);
    }
    await supabase.from('order_items').update(updates).eq('id', item.id);
  };

  const getTimeDiff = (isoString: string) => {
    const diff = Math.max(0, Math.floor((now - new Date(isoString).getTime()) / 1000));
    const mins = Math.floor(diff / 60);
    const secs = diff % 60;
    return { mins, secs, totalSecs: diff };
  };

  if (loading) return (
    <div className="h-full flex flex-col items-center justify-center opacity-40">
      <Loader2 className="animate-spin text-blue-500 mb-4" size={48} />
      <p className="text-xl font-black uppercase tracking-[0.5em] text-gray-500 italic">Sincronizando Estación...</p>
    </div>
  );

  const servedCards = Object.values(justServed);

  return (
    <div className="min-h-full bg-[#0a0a0c] text-white animate-in fade-in duration-500 text-left pb-20">

      <header className="flex flex-col xl:flex-row items-start xl:items-center justify-between mb-12 border-b border-white/5 pb-8 gap-6">
        <div className="flex items-center gap-6">
          <div className="w-16 h-16 bg-orange-600 rounded-[2rem] flex items-center justify-center shadow-2xl shadow-orange-600/20">
            <Flame size={32} fill="white" />
          </div>
          <div>
            <h2 className="text-4xl font-black italic uppercase tracking-tighter leading-none">Kitchen Flow OS</h2>
            <p className="text-[11px] text-gray-500 font-black uppercase tracking-[0.4em] mt-3 flex items-center gap-2">
              <Zap size={12} className="text-yellow-500" /> Monitoreo de Tiempos de Cocción Live
            </p>
          </div>
        </div>

        <div className="flex items-center gap-6 bg-[#111114] p-5 rounded-[2rem] border border-white/5 shadow-xl">
          <div className="flex flex-col items-end border-r border-white/5 pr-6">
            <span className="text-[8px] text-gray-600 font-black uppercase tracking-widest">En Fuego</span>
            <span className="text-2xl font-black italic text-orange-500 leading-none">
              {orders.reduce((acc, o) => acc + o.items.filter(i => i.status === 'preparing' || i.status === 'almost').length, 0)}
            </span>
          </div>
          <div className="flex flex-col items-end">
            <span className="text-[8px] text-gray-600 font-black uppercase tracking-widest">SLA Cumplimiento</span>
            <span className="text-2xl font-black italic text-green-500 leading-none">94.8%</span>
          </div>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">

        <div className="lg:col-span-8 space-y-10">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {orders.map((order) => {
              const orderTime = getTimeDiff(order.opened_at);
              const isUrgent = orderTime.mins >= 15;

              return (
                <div key={order.id} className={`bg-[#111114] border-2 rounded-[3.5rem] overflow-hidden flex flex-col h-full shadow-2xl transition-all ${isUrgent ? 'border-red-600 animate-pulse' : 'border-white/5'}`}>
                  <div className={`p-8 border-b-2 flex flex-col items-center gap-2 ${isUrgent ? 'bg-red-600/10 border-red-600/30' : 'bg-blue-600/5 border-blue-500/20'}`}>
                    <div className="flex justify-between w-full items-center">
                      <span className="text-[10px] font-black uppercase text-gray-500">Mesa</span>
                      <div className={`flex items-center gap-2 font-mono ${isUrgent ? 'text-red-500' : 'text-blue-500'}`}>
                        <Clock size={14} />
                        <span className="text-sm font-black italic">Total: {orderTime.mins}:{orderTime.secs.toString().padStart(2, '0')}</span>
                      </div>
                    </div>
                    <h3 className="text-7xl font-black italic tracking-tighter leading-none mb-1 text-white">M{order.table_id}</h3>
                  </div>

                  <div className="flex-1 p-8 space-y-4">
                    {order.items.map((item) => {
                      const st = (item.status in FLOW ? item.status : 'pending') as ItemStatus;
                      const cfg = FLOW[st];
                      // Tiempo desde que se inició la preparación
                      const desdeInicio = item.tiempo_inicio ? getTimeDiff(item.tiempo_inicio) : null;
                      const sub =
                        st === 'preparing' ? `Iniciado hace ${desdeInicio ? `${desdeInicio.mins} min` : 'un momento'}`
                        : st === 'almost'  ? 'Validar entrega'
                        : st === 'ready'   ? '✓ Esperando pickup'
                        : null;

                      return (
                        <div key={item.id}
                          className="bg-black/40 border-2 rounded-2xl p-5 transition-all"
                          style={{ borderColor: `${cfg.color}55` }}>
                          {/* Nombre del plato */}
                          <div className="flex justify-between items-start mb-3">
                            <div className="min-w-0">
                              <h4 className="text-xl font-black italic uppercase leading-none text-white">{item.quantity}x {item.menu_items?.name}</h4>
                              <span className="text-[8px] text-gray-600 font-bold uppercase tracking-widest mt-1 block">{item.menu_items?.category}</span>
                            </div>
                          </div>

                          {/* Badge de estado */}
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-sm">{cfg.dot}</span>
                            <span className="text-[11px] font-black uppercase tracking-widest" style={{ color: cfg.color }}>{cfg.label}</span>
                          </div>
                          {sub && <div className="text-[11px] text-gray-500 font-bold mb-3">{sub}</div>}
                          {!sub && <div className="mb-3" />}

                          {/* Botón de avance */}
                          {cfg.btn && (
                            <button
                              onClick={() => avanzar(item, order.table_id)}
                              className="w-full py-4 rounded-xl text-[11px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 shadow-xl"
                              style={{ background: cfg.color, color: '#0a0a0c' }}>
                              {cfg.btn} →
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}

            {/* Tarjetas ENTREGADO — visibles 5s y desaparecen */}
            {servedCards.map(({ item, tableId }) => {
              const total = getTimeDiff(item.created_at);
              return (
                <div key={`served-${item.id}`}
                  className="bg-[#111114] border-2 border-green-600/50 rounded-[3.5rem] overflow-hidden flex flex-col shadow-2xl animate-in fade-in zoom-in duration-300">
                  <div className="p-8 bg-green-600/10 border-b-2 border-green-600/30 flex flex-col items-center gap-2">
                    <div className="flex justify-between w-full items-center">
                      <span className="text-[10px] font-black uppercase text-gray-500">Mesa</span>
                      <div className="flex items-center gap-2 font-mono text-green-500">
                        <CheckCircle size={14} />
                        <span className="text-sm font-black italic">Total: {total.mins} min</span>
                      </div>
                    </div>
                    <h3 className="text-7xl font-black italic tracking-tighter leading-none text-white">M{tableId}</h3>
                  </div>
                  <div className="flex-1 p-8 flex flex-col items-center justify-center text-center gap-2">
                    <span className="text-4xl">🟢</span>
                    <span className="text-[12px] font-black uppercase tracking-widest text-green-500">ENTREGADO</span>
                    <h4 className="text-lg font-black italic uppercase text-white">{item.quantity}x {item.menu_items?.name}</h4>
                    <span className="text-[11px] text-gray-500 font-bold">Pedido finalizado · Tiempo total: {total.mins} min</span>
                  </div>
                </div>
              );
            })}

            {orders.length === 0 && servedCards.length === 0 && (
              <div className="col-span-full py-40 flex flex-col items-center justify-center text-center opacity-10 border-4 border-dashed border-white/5 rounded-[4rem]">
                <Zap size={80} className="mb-6 text-blue-500" />
                <h4 className="text-4xl font-black italic uppercase tracking-[0.2em]">Pista Despejada</h4>
                <p className="text-sm font-bold uppercase mt-4">Todo el staff de OMM en standby</p>
              </div>
            )}
          </div>
        </div>

        <div className="lg:col-span-4 space-y-10">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-black text-gray-500 uppercase tracking-widest flex items-center gap-2 italic">
              <History size={14} className="text-green-500" /> HISTORIAL DE EFICIENCIA
            </h3>
          </div>

          <div className="bg-[#111114] border border-white/5 rounded-[3.5rem] p-8 shadow-2xl h-fit max-h-[800px] overflow-hidden flex flex-col">
            <div className="space-y-4 overflow-y-auto custom-scrollbar pr-2">
              {completedItems.length > 0 ? (
                completedItems.map((item) => (
                  <div key={item.id} className="bg-black/20 border border-white/5 p-6 rounded-[2rem] flex items-center justify-between group hover:bg-green-600/5 transition-all animate-in slide-in-from-right duration-300">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 bg-green-600/20 rounded-full flex items-center justify-center text-green-500 shadow-inner">
                        <CheckCircle size={18} />
                      </div>
                      <div>
                        <h4 className="text-sm font-black uppercase italic text-gray-200 leading-none mb-1">{item.menu_items?.name}</h4>
                        <div className="flex items-center gap-2">
                          <span className="text-[7px] text-gray-600 font-bold uppercase tracking-widest">Prep: {item.prepMinutes}m</span>
                          <span className="w-1 h-1 bg-gray-800 rounded-full"></span>
                          <span className="text-[7px] text-blue-500 font-black uppercase">Finalizado</span>
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <span className={`text-[10px] font-black italic ${item.prepMinutes > 15 ? 'text-red-500' : 'text-green-500'}`}>
                        {item.prepMinutes > 15 ? 'FUERA SLA' : 'ÓPTIMO'}
                      </span>
                    </div>
                  </div>
                ))
              ) : (
                <div className="py-20 text-center opacity-20">
                  <Clock size={32} className="mx-auto mb-4" />
                  <p className="text-[10px] font-black uppercase tracking-widest italic">Esperando primeros platos...</p>
                </div>
              )}
            </div>

            <div className="mt-8 pt-8 border-t border-white/10 flex flex-col gap-6">
              <div className="bg-blue-600/5 p-6 rounded-3xl border border-blue-500/20">
                <div className="flex items-center gap-3 mb-3">
                  <TrendingUp size={16} className="text-blue-500" />
                  <span className="text-[9px] font-black text-white uppercase tracking-widest">Resumen de Turno</span>
                </div>
                <div className="flex justify-between items-end">
                  <div>
                    <span className="text-[8px] text-gray-500 font-black uppercase block">Ticket Promedio Preparación</span>
                    <span className="text-xl font-black italic text-white">08:42 min</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
};

export default KitchenModule;
