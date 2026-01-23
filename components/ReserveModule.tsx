
import React, { useState, useEffect } from 'react';
import { 
  Users, 
  Calendar, 
  Clock, 
  Map as MapIcon, 
  MessageSquare, 
  AlertCircle, 
  ShieldCheck, 
  TrendingUp, 
  CheckCircle2, 
  ChevronRight,
  UserPlus,
  Zap,
  Star,
  DollarSign,
  Loader2,
  PlusCircle
} from 'lucide-react';
import { Reservation, Table, NEXUS_COLORS } from '../types';
import { supabase } from '../lib/supabase';

const ReserveModule: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'timeline' | 'floorplan' | 'waitlist'>('timeline');
  const [loading, setLoading] = useState(true);
  const [openingId, setOpeningId] = useState<number | null>(null);
  const [tables, setTables] = useState<Table[]>([]);
  const [reservations, setReservations] = useState<Reservation[]>([
    { 
      id: 'R1', customer: 'Andrés Pastrana', pax: 4, time: '20:30', plan: 'Aniversario / Vista Ventana', 
      type: 'VIP', status: 'Confirmada', noShowProbability: 5, assignedTable: 4, duration: 150,
      upsellSuggested: 'Moët & Chandon Impérial'
    },
    { 
      id: 'R2', customer: 'Mariana Duque', pax: 2, time: '20:45', plan: 'Negocios / Rápido', 
      type: 'Nuevo', status: 'Pendiente', noShowProbability: 42, duration: 90 
    },
    { 
      id: 'R3', customer: 'Juan Gómez', pax: 6, time: '21:00', plan: 'Cena Foodie', 
      type: 'Foodie', status: 'Confirmada', noShowProbability: 12, assignedTable: 12, duration: 180,
      upsellSuggested: 'Menú Degustación 9 Pasos'
    },
  ]);

  // Función reutilizable para cargar mesas
  const fetchTables = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('tables')
        .select('*')
        .order('id', { ascending: true });
      
      if (error) throw error;
      if (data) setTables(data);
    } catch (err) {
      console.error("Error fetching tables from Supabase:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTables();
  }, []);

  // Función para abrir mesa (Crear orden + Actualizar estado de mesa)
  const handleOpenTable = async (tableId: number) => {
    setOpeningId(tableId);
    try {
      // 1. Insertar orden en Supabase
      const { error: orderError } = await supabase
        .from('orders')
        .insert([{ 
          table_id: tableId, 
          status: 'open', 
          opened_at: new Date().toISOString(), 
          total_amount: 0 
        }]);

      if (orderError) throw orderError;

      // 2. Actualizar estado de la mesa a 'occupied'
      const { error: tableError } = await supabase
        .from('tables')
        .update({ status: 'occupied' })
        .eq('id', tableId);

      if (tableError) throw tableError;

      // 3. Recargar datos para refrescar la UI
      await fetchTables();
    } catch (err) {
      console.error("Error al abrir la mesa:", err);
      alert("No se pudo abrir la mesa. Revisa la consola para más detalles.");
    } finally {
      setOpeningId(null);
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-700">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 border-b border-white/5 pb-8">
        <div>
          <h2 className="text-3xl font-black italic tracking-tighter uppercase flex items-center gap-3">
            <Calendar className="text-blue-500" /> NEXUM Reserve
          </h2>
          <p className="text-gray-500 text-xs font-bold mt-2 uppercase tracking-[0.3em]">Optimización de Ocupación & Concierge IA</p>
        </div>
        <div className="flex bg-[#111114] p-1.5 rounded-2xl border border-white/5">
          <TabButton active={activeTab === 'timeline'} onClick={() => setActiveTab('timeline')} icon={<Clock size={14} />} label="Timeline" />
          <TabButton active={activeTab === 'floorplan'} onClick={() => setActiveTab('floorplan')} icon={<MapIcon size={14} />} label="Plano" />
          <TabButton active={activeTab === 'waitlist'} onClick={() => setActiveTab('waitlist')} icon={<UserPlus size={14} />} label="Lista de Espera" />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        <div className="lg:col-span-3 space-y-8">
          {loading && tables.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-24 bg-[#111114] rounded-[3rem] border border-white/5">
              <Loader2 className="text-blue-500 animate-spin mb-4" size={48} />
              <p className="text-[10px] font-black uppercase tracking-widest text-gray-500">Sincronizando con Supabase...</p>
            </div>
          ) : activeTab === 'timeline' && (
            <div className="bg-[#111114] border border-white/5 rounded-[3rem] p-8 shadow-2xl">
              <div className="flex items-center justify-between mb-8">
                <h3 className="text-xs font-black text-gray-500 uppercase tracking-widest flex items-center gap-2">
                  <TrendingUp size={14} className="text-blue-500" /> Próximas Llegadas
                </h3>
              </div>
              <div className="space-y-4">
                {reservations.map(res => (
                  <div key={res.id} className="bg-[#16161a] border border-white/5 rounded-3xl p-5 hover:border-blue-500/30 transition-all group">
                    <div className="flex flex-col md:flex-row md:items-center gap-6">
                       <div className="flex items-center gap-4 min-w-[200px]">
                          <div className={`w-12 h-12 rounded-2xl flex items-center justify-center font-black italic text-sm ${
                            res.type === 'VIP' ? 'bg-blue-600/20 text-blue-500' : 'bg-white/5 text-gray-500'
                          }`}>
                            {res.time}
                          </div>
                          <div>
                            <h4 className="font-black uppercase text-sm group-hover:text-blue-500 transition-colors">{res.customer}</h4>
                            <div className="flex items-center gap-2 text-[10px] font-bold text-gray-500 uppercase mt-1">
                               <span className={res.type === 'VIP' ? 'text-blue-400' : ''}>{res.type}</span>
                               <span>•</span>
                               <span>{res.pax} Personas</span>
                            </div>
                          </div>
                       </div>
                       <div className="flex-1">
                          <div className="bg-black/40 px-4 py-2 rounded-xl border border-white/5">
                             <span className="text-[9px] text-gray-500 font-black uppercase block mb-0.5">Plan Detectado</span>
                             <p className="text-xs text-gray-400 italic">"{res.plan}"</p>
                          </div>
                       </div>
                       <div className="flex items-center gap-2">
                          <button className="p-2.5 bg-blue-600 hover:bg-blue-500 rounded-xl transition-all text-white shadow-lg">
                             <ChevronRight size={16} />
                          </button>
                       </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'floorplan' && (
            <div className="bg-[#111114] border border-white/5 rounded-[3rem] p-12 min-h-[600px] relative overflow-hidden flex flex-col gap-10">
               {/* Zone Labels */}
               <div className="grid grid-cols-3 gap-8 text-center border-b border-white/5 pb-6">
                  <div className="flex flex-col">
                     <span className="text-[10px] font-black text-blue-500 uppercase tracking-widest italic">CAVA VIP</span>
                     <span className="text-[8px] text-gray-600 font-bold uppercase mt-1">Nivel Silencio</span>
                  </div>
                  <div className="flex flex-col">
                     <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest italic">SALÓN PRINCIPAL</span>
                     <span className="text-[8px] text-gray-600 font-bold uppercase mt-1">Ambiente OMM</span>
                  </div>
                  <div className="flex flex-col">
                     <span className="text-[10px] font-black text-orange-500 uppercase tracking-widest italic">TERRAZA</span>
                     <span className="text-[8px] text-gray-600 font-bold uppercase mt-1">Outdoor / DJ</span>
                  </div>
               </div>

               <div className="grid grid-cols-3 gap-12 flex-1 items-start">
                  {/* Cava VIP Column */}
                  <div className="flex flex-col gap-8 items-center bg-blue-600/5 p-6 rounded-[2rem] border border-blue-500/10 min-h-[400px]">
                    {tables.filter(t => t.zone === 'Cava VIP').map(table => (
                       <FloorTable 
                        key={table.id} 
                        table={table} 
                        onOpenTable={handleOpenTable}
                        isOpening={openingId === table.id}
                       />
                    ))}
                    {tables.filter(t => t.zone === 'Cava VIP').length === 0 && !loading && <p className="text-[8px] text-gray-700 uppercase font-black">Sin mesas</p>}
                  </div>
                  {/* Salón Column */}
                  <div className="flex flex-col gap-8 items-center bg-white/5 p-6 rounded-[2rem] border border-white/5 min-h-[400px]">
                    {tables.filter(t => t.zone === 'Salón Principal').map(table => (
                       <FloorTable 
                        key={table.id} 
                        table={table} 
                        onOpenTable={handleOpenTable}
                        isOpening={openingId === table.id}
                       />
                    ))}
                    {tables.filter(t => t.zone === 'Salón Principal').length === 0 && !loading && <p className="text-[8px] text-gray-700 uppercase font-black">Sin mesas</p>}
                  </div>
                  {/* Terraza Column */}
                  <div className="flex flex-col gap-8 items-center bg-orange-600/5 p-6 rounded-[2rem] border border-orange-500/10 min-h-[400px]">
                    {tables.filter(t => t.zone === 'Terraza').map(table => (
                       <FloorTable 
                        key={table.id} 
                        table={table} 
                        onOpenTable={handleOpenTable}
                        isOpening={openingId === table.id}
                       />
                    ))}
                    {tables.filter(t => t.zone === 'Terraza').length === 0 && !loading && <p className="text-[8px] text-gray-700 uppercase font-black">Sin mesas</p>}
                  </div>
               </div>
            </div>
          )}
        </div>

        <div className="space-y-8">
           <div className="bg-[#111114] rounded-[2.5rem] border border-white/5 flex flex-col h-fit overflow-hidden shadow-2xl">
              <div className="p-6 bg-gradient-to-r from-blue-600/20 to-transparent border-b border-white/5">
                 <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-blue-600 rounded-2xl flex items-center justify-center shadow-lg shadow-blue-600/20">
                       <MessageSquare size={18} className="text-white" />
                    </div>
                    <div>
                       <h4 className="text-xs font-black uppercase tracking-widest italic">Concierge IA</h4>
                       <span className="text-[9px] text-green-500 font-bold uppercase animate-pulse">En línea</span>
                    </div>
                 </div>
              </div>
              <div className="p-6 space-y-4">
                 <div className="bg-white/5 p-4 rounded-3xl text-[11px] leading-relaxed italic border border-white/5">
                   {openingId ? `Abriendo mesa ${openingId}... registrando orden en Supabase.` : `Sincronizando disponibilidad real con Supabase... ${tables.length} mesas activas en el sistema.`}
                 </div>
              </div>
           </div>
        </div>
      </div>
    </div>
  );
};

const FloorTable: React.FC<{ table: Table, onOpenTable: (id: number) => void, isOpening: boolean }> = ({ table, onOpenTable, isOpening }) => (
  <div className="flex flex-col items-center gap-3 group w-full">
     <div className={`w-full h-24 rounded-[1.8rem] border-2 flex flex-col items-center justify-center transition-all shadow-xl relative ${
       table.status === 'occupied' || table.status === 'calling'
        ? (table.zone === 'Cava VIP' ? 'bg-blue-600/20 border-blue-500' : table.zone === 'Terraza' ? 'bg-orange-600/20 border-orange-500' : 'bg-white/20 border-white/40') 
        : 'bg-[#16161a] border-white/5 hover:border-white/10'
     }`}>
        <span className="text-[7px] font-black text-gray-600 uppercase tracking-tighter mb-1">
          {table.name || `MESA ${table.id}`}
        </span>
        <span className="text-2xl font-black italic leading-none">{table.id.toString().padStart(2, '0')}</span>
        <span className="text-[6px] font-black uppercase text-gray-500 mt-1">{table.zone}</span>
     </div>
     
     <div className="flex gap-1 mb-1">
        {Array.from({ length: table.capacity }).map((_, i) => (
          <div key={i} className={`w-1.5 h-1.5 rounded-full ${table.status === 'occupied' || table.status === 'calling' ? 'bg-blue-500' : 'bg-white/10'}`}></div>
        ))}
     </div>

     {table.status !== 'occupied' && table.status !== 'calling' && (
       <button 
        disabled={isOpening}
        onClick={() => onOpenTable(table.id)}
        className="w-full bg-[#111114] hover:bg-blue-600 text-[8px] font-black uppercase py-2.5 rounded-xl border border-white/10 transition-all flex items-center justify-center gap-2 group/btn shadow-lg disabled:opacity-50"
       >
         {isOpening ? <Loader2 size={12} className="animate-spin" /> : <PlusCircle size={12} className="text-blue-500 group-hover/btn:text-white" />}
         {isOpening ? 'ABRIENDO...' : 'ABRIR MESA'}
       </button>
     )}
  </div>
);

const TabButton: React.FC<{ active: boolean, onClick: () => void, icon: any, label: string }> = ({ active, onClick, icon, label }) => (
  <button 
    onClick={onClick}
    className={`flex items-center gap-2 px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
      active ? 'bg-blue-600 text-white shadow-lg' : 'text-gray-500 hover:text-gray-300'
    }`}
  >
    {icon} {label}
  </button>
);

export default ReserveModule;
