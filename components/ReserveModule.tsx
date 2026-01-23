
import React, { useState, useEffect } from 'react';
import { 
  Calendar, 
  Clock, 
  Map as MapIcon, 
  TrendingUp, 
  Loader2, 
  CalendarDays, 
  UserCheck, 
  XCircle, 
  RefreshCcw, 
  ShieldCheck, 
  X,
  LayoutGrid,
  ChevronRight
} from 'lucide-react';
import { supabase } from '../lib/supabase';

const ReserveModule: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'floorplan' | 'agenda'>('floorplan');
  const [loading, setLoading] = useState(true);
  const [openingId, setOpeningId] = useState<number | null>(null);
  const [tables, setTables] = useState<any[]>([]); 
  const [dailyReservations, setDailyReservations] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);
  
  const [selectedTable, setSelectedTable] = useState<any | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const { data: tablesData, error: tablesError } = await supabase
        .from('tables')
        .select(`
          *,
          reservations(id, reservation_time, pax, status, customers(name))
        `)
        .order('id', { ascending: true });
      
      if (tablesError) throw tablesError;
      setTables(tablesData || []);

      const today = new Date().toISOString().split('T')[0];
      const { data: resData, error: resError } = await supabase
        .from('reservations')
        .select('*, customers(name), tables(id, zone, name)')
        .gte('reservation_time', `${today}T00:00:00`)
        .lte('reservation_time', `${today}T23:59:59`)
        .order('reservation_time', { ascending: true });

      if (resError) throw resError;
      setDailyReservations(resData || []);

    } catch (err: any) {
      console.error("Error cargando datos de reserva:", err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();

    const channel = supabase
      .channel('reserve-sync-v4')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tables' }, () => fetchData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'reservations' }, () => fetchData())
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const handleOpenTable = async (tableId: number) => {
    setOpeningId(tableId);
    try {
      await supabase.from('orders').insert([{ 
        table_id: tableId, 
        status: 'open', 
        opened_at: new Date().toISOString(), 
        total_amount: 0 
      }]);

      await supabase.from('tables').update({ status: 'occupied' }).eq('id', tableId);
      
      setIsModalOpen(false);
      await fetchData();
    } catch (err) {
      console.error("Error al abrir mesa:", err);
    } finally {
      setOpeningId(null);
    }
  };

  const handleNoShow = async (reservationId: string, tableId: number) => {
    try {
      await supabase.from('reservations').update({ status: 'no_show' }).eq('id', reservationId);
      await supabase.from('tables').update({ status: 'free' }).eq('id', tableId);
      setIsModalOpen(false);
      await fetchData();
    } catch (err) {
      console.error("Error al procesar No Show:", err);
    }
  };

  const formatTime = (isoString: string) => {
    const date = new Date(isoString);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  // Zonas Filtradas (Eliminadas Cava VIP y Terraza)
  const activeZones = [
    { name: 'Mantra Amatista', color: 'purple', glow: 'shadow-[0_0_30px_rgba(168,85,247,0.15)]' },
    { name: 'Eterno', color: 'indigo', glow: 'shadow-[0_0_30px_rgba(99,102,241,0.15)]' }
  ];

  return (
    <div className="space-y-10 animate-in fade-in duration-1000">
      {/* Header Premium */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-8 border-b border-white/5 pb-10">
        <div className="flex items-center gap-5">
           <div className="p-5 bg-blue-600 rounded-[2rem] shadow-2xl shadow-blue-600/30">
              <CalendarDays className="text-white" size={32} />
           </div>
           <div>
              <h2 className="text-4xl font-black italic tracking-tighter uppercase leading-none">NEXUM RESERVE</h2>
              <p className="text-gray-500 text-[10px] font-black uppercase tracking-[0.4em] mt-3">Planta de Alta Densidad (57 Mesas)</p>
           </div>
        </div>
        <div className="flex bg-[#111114] p-2 rounded-2xl border border-white/5 shadow-inner">
          <TabButton active={activeTab === 'floorplan'} onClick={() => setActiveTab('floorplan')} icon={<LayoutGrid size={16} />} label="Mapa Interactivo" />
          <TabButton active={activeTab === 'agenda'} onClick={() => setActiveTab('agenda')} icon={<Clock size={16} />} label={`Agenda Diaria (${dailyReservations.length})`} />
        </div>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-40 bg-[#111114] rounded-[4rem] border border-white/5">
          <Loader2 className="text-blue-500 animate-spin mb-6" size={64} />
          <p className="text-xs font-black uppercase tracking-[0.5em] text-gray-500 italic">Sincronizando 57 Nodos...</p>
        </div>
      ) : activeTab === 'floorplan' ? (
        <div className="space-y-16">
          {activeZones.map(zone => (
            <section key={zone.name} className={`bg-[#0d0d0f] border border-white/5 rounded-[4rem] p-10 md:p-14 ${zone.glow}`}>
              <div className="flex items-center justify-between mb-12">
                <div className="flex items-center gap-4">
                   <div className={`w-3 h-3 rounded-full bg-${zone.color}-500 animate-pulse`}></div>
                   <h3 className={`text-2xl font-black italic uppercase tracking-tighter text-${zone.color}-400`}>
                     {zone.name}
                   </h3>
                   <span className="text-[10px] text-gray-600 font-black uppercase tracking-widest bg-white/5 px-4 py-1.5 rounded-full border border-white/5">
                     {tables.filter(t => t.zone === zone.name).length} Mesas
                   </span>
                </div>
                <div className="flex gap-2">
                   <LegendItem color="bg-green-500" label="Libre" />
                   <LegendItem color="bg-amber-500" label="Reservada" />
                   <LegendItem color="bg-red-500" label="En Servicio" />
                </div>
              </div>

              {/* GRID INTELIGENTE DE MESAS */}
              <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 xl:grid-cols-10 gap-6">
                {tables.filter(t => t.zone === zone.name).map(table => (
                  <FloorTableNode 
                    key={table.id} 
                    table={table} 
                    onClick={() => { setSelectedTable(table); setIsModalOpen(true); }}
                    formatTime={formatTime}
                  />
                ))}
              </div>
            </section>
          ))}
        </div>
      ) : (
        /* AGENDA COMPACTA */
        <div className="bg-[#111114] border border-white/5 rounded-[4rem] p-12 shadow-2xl animate-in slide-in-from-bottom-6">
           <div className="flex items-center gap-4 mb-12 border-b border-white/5 pb-8">
              <TrendingUp className="text-blue-500" />
              <h3 className="text-xs font-black text-gray-400 uppercase tracking-[0.4em]">Cronograma de Arribos - Hoy</h3>
           </div>
           <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {dailyReservations.map(res => (
                <div key={res.id} className="bg-black/40 border border-white/5 p-8 rounded-3xl flex items-center gap-8 hover:border-blue-500/30 transition-all group">
                   <div className="text-center min-w-[80px]">
                      <span className="text-[10px] font-black text-blue-500 uppercase block mb-1">HORA</span>
                      <span className="text-2xl font-black italic leading-none">{formatTime(res.reservation_time)}</span>
                   </div>
                   <div className="flex-1">
                      <h4 className="text-base font-black uppercase italic tracking-tight mb-1">{res.customers?.name || 'Invitado OMM'}</h4>
                      <p className="text-[10px] text-gray-600 font-bold uppercase tracking-widest">
                        {res.pax} PAX • {res.tables?.name || `Mesa ${res.table_id}`} ({res.tables?.zone || 'NEXUM'})
                      </p>
                   </div>
                   <div className="flex flex-col items-end gap-2">
                      <span className={`text-[8px] font-black uppercase px-4 py-1.5 rounded-full ${res.status === 'confirmed' ? 'bg-green-500/10 text-green-500' : 'bg-amber-500/10 text-amber-500'}`}>
                        {res.status}
                      </span>
                   </div>
                </div>
              ))}
              {dailyReservations.length === 0 && (
                <div className="col-span-2 py-32 text-center opacity-20 italic uppercase font-black text-sm tracking-[0.5em]">No se registran arribos</div>
              )}
           </div>
        </div>
      )}

      {/* MODAL DETALLES DE MESA (REDISEÑADO) */}
      {isModalOpen && selectedTable && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-8 animate-in fade-in duration-500 backdrop-blur-3xl">
           <div className="absolute inset-0 bg-black/60" onClick={() => setIsModalOpen(false)}></div>
           <div className="bg-[#0a0a0c] border border-white/10 rounded-[4rem] w-full max-w-2xl relative z-10 overflow-hidden shadow-[0_0_120px_rgba(37,99,235,0.2)] animate-in zoom-in duration-500">
              <div className="p-10 border-b border-white/5 flex justify-between items-center bg-gradient-to-r from-blue-600/20 to-transparent">
                 <div className="flex items-center gap-6">
                    <div className="w-20 h-20 bg-blue-600 rounded-[2.5rem] flex items-center justify-center shadow-2xl shadow-blue-600/40 text-white font-black italic text-3xl">
                       {selectedTable.id.toString().padStart(2, '0')}
                    </div>
                    <div>
                       <h3 className="text-3xl font-black italic uppercase tracking-tighter leading-none">{selectedTable.name || `MESA ${selectedTable.id}`}</h3>
                       <span className="text-[11px] text-blue-500 font-black uppercase tracking-[0.3em] mt-2 block">{selectedTable.zone}</span>
                    </div>
                 </div>
                 <button onClick={() => setIsModalOpen(false)} className="w-14 h-14 bg-white/5 rounded-2xl flex items-center justify-center text-gray-500 hover:text-white hover:bg-white/10 transition-all">
                    <X size={24} />
                 </button>
              </div>

              <div className="p-12 space-y-12">
                 <div className="grid grid-cols-2 gap-8">
                    <div className="bg-white/5 p-8 rounded-[2.5rem] border border-white/5 flex flex-col gap-2">
                       <span className="text-[10px] text-gray-500 font-black uppercase tracking-widest">Capacidad</span>
                       <span className="text-2xl font-black italic uppercase">{selectedTable.seats} Personas</span>
                    </div>
                    <div className="bg-white/5 p-8 rounded-[2.5rem] border border-white/5 flex flex-col gap-2">
                       <span className="text-[10px] text-gray-500 font-black uppercase tracking-widest">Estado Nexum</span>
                       <span className={`text-2xl font-black italic uppercase ${
                         selectedTable.status === 'occupied' ? 'text-red-500' : 
                         selectedTable.status === 'reserved' ? 'text-amber-500' : 'text-green-500'
                       }`}>
                         {selectedTable.status}
                       </span>
                    </div>
                 </div>

                 <div className="space-y-6">
                    <h4 className="text-[11px] font-black text-gray-500 uppercase tracking-[0.3em] flex items-center gap-3">
                       <Clock size={16} /> Agenda de Turnos
                    </h4>
                    <div className="space-y-4">
                       {dailyReservations.filter(r => r.table_id === selectedTable.id).length > 0 ? (
                         dailyReservations.filter(r => r.table_id === selectedTable.id).map(res => (
                           <div key={res.id} className="bg-white/5 border border-white/5 p-6 rounded-[2rem] flex items-center justify-between group">
                              <div className="flex items-center gap-6">
                                 <span className="text-xl font-black italic text-blue-500">{formatTime(res.reservation_time)}</span>
                                 <div>
                                    <span className="text-sm font-black uppercase text-gray-200 tracking-tight">{res.customers?.name || 'Cliente OMM'}</span>
                                    <span className="text-[9px] text-gray-600 block uppercase font-bold tracking-widest mt-0.5">{res.pax} PAX • {res.plan || 'Plan Zen'}</span>
                                 </div>
                              </div>
                              <span className={`text-[8px] font-black uppercase px-4 py-1.5 rounded-full ${res.status === 'confirmed' ? 'bg-green-500/10 text-green-500' : 'bg-amber-500/10 text-amber-500'}`}>
                                 {res.status}
                              </span>
                           </div>
                         ))
                       ) : (
                         <div className="py-20 text-center opacity-30 italic text-[11px] font-black uppercase tracking-[0.4em] bg-black/20 rounded-[2.5rem] border border-dashed border-white/10">
                            Nodo disponible para asignación
                         </div>
                       )}
                    </div>
                 </div>

                 <div className="pt-10 border-t border-white/5 flex gap-6">
                    {selectedTable.status !== 'occupied' ? (
                      <button 
                        onClick={() => handleOpenTable(selectedTable.id)}
                        disabled={openingId === selectedTable.id}
                        className="flex-1 bg-blue-600 hover:bg-blue-500 text-white py-6 rounded-[2rem] text-xs font-black uppercase tracking-widest transition-all shadow-2xl shadow-blue-600/30 flex items-center justify-center gap-3"
                      >
                         {openingId === selectedTable.id ? <Loader2 size={18} className="animate-spin" /> : <UserCheck size={20} />}
                         PROCEDER AL SERVICIO
                      </button>
                    ) : (
                      <button disabled className="flex-1 bg-white/5 text-gray-600 py-6 rounded-[2rem] text-xs font-black uppercase tracking-widest border border-white/5 opacity-50 cursor-not-allowed">
                         SERVICIO EN CURSO
                      </button>
                    )}
                    
                    {(selectedTable.status === 'reserved' || selectedTable.status === 'occupied') && (
                      <button 
                        onClick={() => {
                          const res = dailyReservations.find(r => r.table_id === selectedTable.id && (r.status === 'confirmed' || r.status === 'reserved'));
                          if (res) handleNoShow(res.id, selectedTable.id);
                        }}
                        className="bg-red-600/10 hover:bg-red-600/20 text-red-500 px-10 rounded-[2rem] text-[10px] font-black uppercase tracking-widest border border-red-500/20 transition-all"
                      >
                        NO SHOW
                      </button>
                    )}
                 </div>
              </div>
           </div>
        </div>
      )}
    </div>
  );
};

const FloorTableNode: React.FC<{ table: any, onClick: () => void, formatTime: (t: string) => string }> = ({ table, onClick, formatTime }) => {
  const activeReservation = table.reservations?.find((r: any) => r.status === 'confirmed' || r.status === 'reserved');
  const isOccupied = table.status === 'occupied' || table.status === 'calling';
  const isReserved = table.status === 'reserved' || (!!activeReservation && !isOccupied);

  let bgClass = 'bg-[#16161a] border-white/5 shadow-lg';
  let accentColor = 'text-gray-700';

  if (isOccupied) {
    bgClass = 'bg-red-600/10 border-red-500/50 shadow-[0_0_20px_rgba(239,68,68,0.1)]';
    accentColor = 'text-red-500';
  } else if (isReserved) {
    bgClass = 'bg-amber-600/10 border-amber-500/50 shadow-[0_0_20px_rgba(245,158,11,0.15)]';
    accentColor = 'text-amber-500';
  }

  const isBar = table.name?.includes('B') || table.zone.toLowerCase().includes('barra');

  return (
    <div 
      onClick={onClick}
      className={`relative cursor-pointer transition-all duration-500 hover:scale-110 group ${
        isBar ? 'aspect-square rounded-full' : 'aspect-[4/5] rounded-3xl'
      } border-2 flex flex-col items-center justify-center ${bgClass}`}
    >
      <span className={`text-[8px] font-black uppercase tracking-tighter mb-1 opacity-50 ${accentColor}`}>
        {table.name || `M${table.id}`}
      </span>
      <span className={`${isBar ? 'text-lg' : 'text-2xl'} font-black italic leading-none`}>
        {table.id.toString().padStart(2, '0')}
      </span>
      
      {isReserved && activeReservation && (
        <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 bg-amber-500 text-black text-[7px] font-black px-2 py-0.5 rounded-full shadow-lg">
          {formatTime(activeReservation.reservation_time)}
        </div>
      )}

      {isOccupied && (
        <div className="absolute top-2 right-2 w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse shadow-[0_0_8px_rgba(239,68,68,0.8)]"></div>
      )}
      
      {/* Indicador de capacidad minimalista */}
      <div className="absolute -top-1 right-2 flex gap-0.5">
          {Array.from({ length: Math.min(table.seats, 4) }).map((_, i) => (
            <div key={i} className={`w-0.5 h-2 rounded-full ${isOccupied ? 'bg-red-500' : isReserved ? 'bg-amber-500' : 'bg-white/10'}`}></div>
          ))}
      </div>
    </div>
  );
};

const TabButton: React.FC<{ active: boolean, onClick: () => void, icon: any, label: string }> = ({ active, onClick, icon, label }) => (
  <button 
    onClick={onClick}
    className={`flex items-center gap-3 px-8 py-3.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
      active ? 'bg-blue-600 text-white shadow-2xl shadow-blue-600/40' : 'text-gray-500 hover:text-gray-300'
    }`}
  >
    {icon} {label}
  </button>
);

const LegendItem = ({ color, label }: { color: string, label: string }) => (
  <div className="flex items-center gap-2 px-3 py-1 bg-white/5 rounded-full border border-white/5">
    <div className={`w-2 h-2 rounded-full ${color}`}></div>
    <span className="text-[8px] font-black uppercase text-gray-500">{label}</span>
  </div>
);

export default ReserveModule;
