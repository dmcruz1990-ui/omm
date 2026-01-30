import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase.ts';
import { 
  Receipt, Loader2, ShoppingBag, CreditCard, Clock, 
  CheckCircle2, TrendingUp, AlertCircle, PlayCircle,
  Timer, ChevronRight, Zap
} from 'lucide-react';
import { RitualTask, Table } from '../types.ts';
import { useAuth } from '../contexts/AuthContext.tsx';
import CheckoutModal from './CheckoutModal.tsx';

interface OrderItemWithDetails {
  id: string;
  quantity: number;
  price_at_time: number;
  menu_items: {
    name: string;
    price: number;
  };
}

interface OrderTicketProps {
  table: Table;
  tasks: RitualTask[]; // Usaremos fetch local para mayor precisión
  onUpdateTable: (tableId: number, updates: Partial<Table>) => void;
  onPaymentSuccess?: () => void;
}

const RITUAL_STEPS = [
  "Agua", 
  "Carta", 
  "Tomar Pedido", 
  "Llevar Bebidas", 
  "Entrada", 
  "Plato Fuerte", 
  "Refill Bebidas", 
  "Postre", 
  "Café", 
  "Cierre"
];

const OrderTicket: React.FC<OrderTicketProps> = ({ table, onUpdateTable, onPaymentSuccess }) => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [order, setOrder] = useState<any>(null);
  const [items, setItems] = useState<OrderItemWithDetails[]>([]);
  const [ritualTasks, setRitualTasks] = useState<RitualTask[]>([]);
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
  const [isRitualLoading, setIsRitualLoading] = useState(false);

  const fetchData = async () => {
    try {
      // 1. Datos de Orden
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

      // 2. Datos del Ritual
      const { data: ritualData } = await supabase
        .from('ritual_tasks')
        .select('*')
        .eq('table_id', table.id)
        .order('started_at', { ascending: true });
      
      setRitualTasks(ritualData || []);

    } catch (err) {
      console.error("❌ [TICKET] Sync Error:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    const channel = supabase
      .channel(`ticket-live-v7-m${table.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'order_items' }, () => fetchData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'ritual_tasks' }, () => fetchData())
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'orders' }, () => fetchData())
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [table.id]);

  // --- Lógica del Ritual ---
  const activeStepTask = ritualTasks.find(t => t.status === 'active');
  const lastCompletedIndex = ritualTasks.filter(t => t.status === 'completed').length;
  const currentStepLabel = activeStepTask ? activeStepTask.step_label : (lastCompletedIndex < RITUAL_STEPS.length ? RITUAL_STEPS[lastCompletedIndex] : 'Finalizado');

  const startRitualStep = async (stepLabel: string) => {
    if (!user) return;
    setIsRitualLoading(true);
    try {
      await supabase.from('ritual_tasks').insert([{
        table_id: table.id,
        step_label: stepLabel,
        staff_id: user.id,
        started_at: new Date().toISOString(),
        status: 'active'
      }]);
    } catch (err) {
      console.error(err);
    } finally {
      setIsRitualLoading(false);
    }
  };

  const advanceRitualStep = async () => {
    if (!activeStepTask || !user) return;
    setIsRitualLoading(true);
    try {
      // 1. Completar actual
      await supabase.from('ritual_tasks')
        .update({ status: 'completed', completed_at: new Date().toISOString() })
        .eq('id', activeStepTask.id);

      // 2. Iniciar siguiente si existe
      const nextIndex = RITUAL_STEPS.indexOf(activeStepTask.step_label) + 1;
      if (nextIndex < RITUAL_STEPS.length) {
        await startRitualStep(RITUAL_STEPS[nextIndex]);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsRitualLoading(false);
    }
  };

  const calculateDuration = (start: string, end?: string) => {
    const s = new Date(start).getTime();
    const e = end ? new Date(end).getTime() : Date.now();
    const diff = Math.round((e - s) / 60000); // minutos
    return diff === 0 ? '< 1m' : `${diff}m`;
  };

  const groupedItems = items.reduce((acc: any[], current) => {
    const itemName = current.menu_items?.name || 'Item Desconocido';
    const existing = acc.find(i => i.menu_items?.name === itemName);
    if (existing) {
      existing.quantity += current.quantity;
      existing.subtotal += current.price_at_time * current.quantity;
    } else {
      acc.push({ ...current, subtotal: current.price_at_time * current.quantity });
    }
    return acc;
  }, []);

  const total = groupedItems.reduce((sum, item) => sum + item.subtotal, 0);

  if (loading && !order) return (
    <div className="h-full flex flex-col items-center justify-center opacity-40 py-20 bg-[#111114] rounded-[2.5rem]">
      <Loader2 className="animate-spin text-blue-500 mb-4" />
      <p className="text-[10px] font-black uppercase tracking-widest">Sincronizando Cuenta...</p>
    </div>
  );

  return (
    <div className="flex flex-col h-full gap-6 animate-in slide-in-from-right duration-500 text-left">
      
      {/* TICKET DE CONSUMO */}
      <div className="flex flex-col bg-[#111114] border border-white/5 rounded-[2.5rem] overflow-hidden shadow-2xl">
        <div className="p-8 bg-black/40 border-b border-white/5">
          <div className="flex justify-between items-center mb-4">
            <div className="flex items-center gap-2">
              <Receipt size={18} className="text-blue-500" />
              <h4 className="text-[10px] font-black uppercase tracking-[0.3em] italic text-gray-400">TICKET_M{table.id}</h4>
            </div>
            <span className={`text-[10px] font-black px-4 py-1.5 rounded-full uppercase italic ${order ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/20' : 'bg-white/5 text-gray-600'}`}>
              {order ? 'CUENTA ABIERTA' : 'ESPERANDO PEDIDO'}
            </span>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto custom-scrollbar p-8 space-y-6 max-h-[300px]">
          {groupedItems.length > 0 ? (
            groupedItems.map((item, idx) => (
              <div key={idx} className="flex justify-between items-start">
                <div className="flex flex-col">
                  <span className="text-xs font-black uppercase italic text-gray-200">{item.quantity}x {item.menu_items?.name}</span>
                </div>
                <span className="text-sm font-black italic text-white font-mono">$ {item.subtotal.toLocaleString()}</span>
              </div>
            ))
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-center opacity-20 py-10">
              <ShoppingBag size={32} className="mb-4" />
              <p className="text-[9px] font-black uppercase tracking-[0.2em] italic">Mesa sin pedidos</p>
            </div>
          )}
        </div>

        <div className="p-8 bg-black/60 border-t border-white/10">
          <div className="flex justify-between items-center mb-6">
            <span className="text-lg font-black italic uppercase tracking-tighter text-blue-500">TOTAL</span>
            <span className="text-3xl font-black italic text-[#10b981]">$ {total.toLocaleString()}</span>
          </div>
          <button 
            onClick={() => setIsCheckoutOpen(true)}
            disabled={!order || items.length === 0}
            className="w-full bg-white text-black hover:bg-blue-600 hover:text-white py-4 rounded-2xl font-black italic text-xs uppercase tracking-widest flex items-center justify-center gap-3 transition-all disabled:opacity-20"
          >
            <CreditCard size={18} /> CERRAR CUENTA
          </button>
        </div>
      </div>

      {/* PROGRESO DEL RITUAL (CRONÓMETRO) */}
      <div className="flex flex-col bg-[#111114] border border-white/5 rounded-[2.5rem] overflow-hidden shadow-2xl p-8">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
             <div className="p-2 bg-blue-600/20 rounded-xl text-blue-500">
               <Timer size={20} />
             </div>
             <div>
               <h4 className="text-[10px] font-black uppercase tracking-[0.2em] leading-none">Progreso del Ritual</h4>
               <span className="text-[8px] text-gray-500 font-bold uppercase tracking-widest">Métricas de Velocidad OMM</span>
             </div>
          </div>
          <Zap size={14} className="text-yellow-500 animate-pulse" />
        </div>

        <div className="space-y-4 mb-8 max-h-[200px] overflow-y-auto custom-scrollbar pr-2">
           {RITUAL_STEPS.map((step, idx) => {
             const task = ritualTasks.find(t => t.step_label === step);
             const isCompleted = task?.status === 'completed';
             const isActive = task?.status === 'active';

             return (
               <div key={step} className={`flex items-center justify-between p-3 rounded-2xl border transition-all ${
                 isActive ? 'bg-blue-600/10 border-blue-500/30' : isCompleted ? 'bg-white/5 border-transparent opacity-60' : 'bg-transparent border-white/5 opacity-30'
               }`}>
                  <div className="flex items-center gap-3">
                    {isCompleted ? <CheckCircle2 size={14} className="text-green-500" /> : isActive ? <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse" /> : <div className="w-2 h-2 bg-gray-800 rounded-full" />}
                    <span className="text-[10px] font-black uppercase italic tracking-tight">{step}</span>
                  </div>
                  {task && (
                    <span className="text-[9px] font-mono text-gray-400">
                      {calculateDuration(task.started_at, task.completed_at)}
                    </span>
                  )}
               </div>
             );
           })}
        </div>

        {ritualTasks.length === 0 ? (
          <button 
            onClick={() => startRitualStep(RITUAL_STEPS[0])}
            disabled={isRitualLoading}
            className="w-full bg-red-600 hover:bg-red-500 text-white py-5 rounded-[1.8rem] font-black italic text-xs uppercase tracking-[0.2em] shadow-xl shadow-red-600/20 flex items-center justify-center gap-3 transition-all active:scale-95"
          >
            <PlayCircle size={20} /> INICIAR SERVICIO ({RITUAL_STEPS[0]})
          </button>
        ) : (
          <div className="space-y-4">
            {activeStepTask && (
               <button 
                onClick={advanceRitualStep}
                disabled={isRitualLoading}
                className="w-full bg-blue-600 hover:bg-blue-500 text-white py-5 rounded-[1.8rem] font-black italic text-xs uppercase tracking-[0.2em] shadow-xl shadow-red-600/20 flex items-center justify-center gap-3 transition-all active:scale-95"
              >
                <ChevronRight size={20} /> AVANZAR PASO
              </button>
            )}
            <div className="text-center">
               <span className="text-[8px] text-gray-600 font-black uppercase tracking-widest italic">
                 {activeStepTask ? `Siguiente: ${RITUAL_STEPS[RITUAL_STEPS.indexOf(activeStepTask.step_label) + 1] || 'Fin'}` : 'Ritual Completado'}
               </span>
            </div>
          </div>
        )}
      </div>

      <CheckoutModal 
        isOpen={isCheckoutOpen} onClose={() => setIsCheckoutOpen(false)}
        order={order} items={groupedItems} tableId={table.id} total={total}
        onSuccess={() => { if (onPaymentSuccess) onPaymentSuccess(); }}
      />
    </div>
  );
};

export default OrderTicket;