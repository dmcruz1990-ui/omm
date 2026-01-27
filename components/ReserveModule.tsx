
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
  ChevronRight,
  PlayCircle,
  Video,
  BellRing
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

const ReserveModule: React.FC = () => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<'floorplan' | 'agenda'>('floorplan');
  const [loading, setLoading] = useState(true);
  const [openingId, setOpeningId] = useState<number | null>(null);
  const [tables, setTables] = useState<any[]>([]); 
  const [dailyReservations, setDailyReservations] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [syncStatus, setSyncStatus] = useState<'connected' | 'reconnecting'>('connected');
  
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
      .channel('reserve-sync-v6')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tables' }, () => fetchData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'reservations' }, () => fetchData())
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') setSyncStatus('connected');
        else setSyncStatus('reconnecting');
      });

    return () => { supabase.removeChannel(channel); };
  }, []);

  const handleOpenTable = async (tableId: number) => {
    setOpeningId(tableId);
    try {
      // Si la mesa está llamando, la "atendemos" al abrirla
      await supabase.from('tables').update({ status: 'occupied', welcome_timer_start: null }).eq('id', tableId);
      setIsModalOpen(false);
      await fetchData();
    } catch (err) {
      console.error(err);
    } finally {
      setOpeningId(null);
    }
  };

  const formatTime = (isoString: string) => {
    const date = new Date(isoString);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const activeZones = [
    { name: 'Mantra Amatista', color: 'purple', glow: 'shadow-[0_0_30px_rgba(168,85,247,0.15)]' },
    { name: 'Eterno', color: 'indigo', glow: 'shadow-[0_0_30px_rgba(99,102,241,0.15)]' }
  ];

  return (
    <div className="space-y-10 animate-in fade-in duration-1000">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-8 border-b border-white/5 pb-10">
        <div className="flex items-center gap-5">
           <div className="p-5 bg-blue-600 rounded-[2rem] shadow-2xl shadow-blue-600/30">
              <CalendarDays className="text-white" size={32} />
           </div>
           <div>
              <h2 className="text-4xl font-black italic tracking-tighter uppercase leading-none">NEXUM RESERVE</h2>
              <p className="text-gray-500 text-[10px] font-black uppercase tracking-[0.4em] mt-3">Floorplan & AI Queue Sync</p>
           </div>
        </div>
        <div className="flex bg-[#111114] p-2 rounded-2xl border border-white/5">
          <TabButton active={activeTab === 'floorplan'} onClick={() => setActiveTab('floorplan')} icon={<LayoutGrid size={16} />} label="Mapa de Planta" />
          <TabButton active={activeTab === 'agenda'} onClick={() => setActiveTab('agenda')} icon={<Clock size={16} />} label={`Agenda (${dailyReservations.length})`} />
        </div>
      </div>

      {activeTab === 'floorplan' ? (
        <div className="space-y-16">
          {activeZones.map(zone => (
            <section key={zone.name} className={`bg-[#0d0d0f] border border-white/5 rounded-[4rem] p-10 md:p-14 ${zone.glow}`}>
              <div className="flex items-center justify-between mb-12">
                <div className="flex items-center gap-4">
                   <div className={`w-3 h-3 rounded-full bg-${zone.color}-500 animate-pulse`}></div>
                   <h3 className={`text-2xl font-black italic uppercase tracking-tighter text-${zone.color}-400`}>
                     {zone.name}
                   </h3>
                </div>
                <div className="flex gap-4">
                   <LegendItem color="bg-green-500" label="Libre" />
                   <LegendItem color="bg-red-500 animate-pulse shadow-[0_0_10px_red]" label="¡LLAMANDO!" />
                </div>
              </div>

              <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 xl:grid-cols-10 gap-6">
                {tables.filter(t => t.zone === zone.name).map(table => (
                  <FloorTableNode 
                    key={table.id} 
                    table={table} 
                    onClick={() => { setSelectedTable(table); setIsModalOpen(true); }}
                  />
                ))}
              </div>
            </section>
          ))}
        </div>
      ) : (
        <div className="bg-[#111114] border border-white/5 rounded-[4rem] p-12">
           <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {dailyReservations.map(res => (
                <div key={res.id} className="bg-black/40 border border-white/5 p-8 rounded-3xl flex items-center gap-8 group hover:border-blue-500/30 transition-all">
                   <div className="text-center min-w-[80px]">
                      <span className="text-[10px] font-black text-blue-500 uppercase block mb-1">HORA</span>
                      <span className="text-2xl font-black italic">{formatTime(res.reservation_time)}</span>
                   </div>
                   <div className="flex-1">
                      <h4 className="text-base font-black uppercase italic tracking-tight mb-1">{res.customers?.name || 'Invitado OMM'}</h4>
                      <p className="text-[10px] text-gray-600 font-bold uppercase tracking-widest">{res.pax} PAX • {res.tables?.name || `Mesa ${res.table_id}`}</p>
                   </div>
                </div>
              ))}
           </div>
        </div>
      )}

      {/* Modal de Mesa */}
      {isModalOpen && selectedTable && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-8 animate-in fade-in backdrop-blur-3xl">
           <div className="absolute inset-0 bg-black/60" onClick={() => setIsModalOpen(false)}></div>
           <div className="bg-[#0a0a0c] border border-white/10 rounded-[4rem] w-full max-w-2xl relative z-10 overflow-hidden shadow-[0_0_120px_rgba(37,99,235,0.2)]">
              <div className="p-10 border-b border-white/5 flex justify-between items-center bg-gradient-to-r from-blue-600/20 to-transparent">
                 <div className="flex items-center gap-6">
                    <div className="w-20 h-20 bg-blue-600 rounded-[2.5rem] flex items-center justify-center text-white font-black italic text-3xl">
                       {selectedTable.id}
                    </div>
                    <div>
                       <h3 className="text-3xl font-black italic uppercase tracking-tighter leading-none">{selectedTable.status === 'calling' ? '⚠️ ALERTA DE SERVICIO' : `MESA ${selectedTable.id}`}</h3>
                       <span className="text-[11px] text-blue-500 font-black uppercase tracking-[0.3em] mt-2 block">{selectedTable.zone}</span>
                    </div>
                 </div>
                 <button onClick={() => setIsModalOpen(false)} className="text-gray-500 hover:text-white"><X size={24} /></button>
              </div>

              <div className="p-12 space-y-8">
                 {selectedTable.status === 'calling' && (
                   <div className="bg-red-600/20 border border-red-500 p-8 rounded-3xl flex flex-col items-center text-center space-y-4 animate-pulse">
                      <BellRing size={48} className="text-red-500" />
                      <h4 className="text-xl font-black italic uppercase text-red-500">CLIENTE SOLICITA ATENCIÓN</h4>
                      <button 
                        onClick={() => handleOpenTable(selectedTable.id)}
                        className="bg-red-600 hover:bg-red-500 text-white px-12 py-5 rounded-[1.5rem] font-black text-xs uppercase tracking-widest shadow-xl transition-all"
                      >
                         ATENDER Y ABRIR MESA
                      </button>
                   </div>
                 )}

                 <div className="grid grid-cols-2 gap-8">
                    <div className="bg-white/5 p-8 rounded-[2.5rem] flex flex-col gap-2">
                       <span className="text-[10px] text-gray-500 font-black uppercase">Capacidad</span>
                       <span className="text-2xl font-black italic">{selectedTable.seats} Personas</span>
                    </div>
                    <div className="bg-white/5 p-8 rounded-[2.5rem] flex flex-col gap-2">
                       <span className="text-[10px] text-gray-500 font-black uppercase">Estado</span>
                       <span className={`text-2xl font-black italic uppercase ${selectedTable.status === 'calling' ? 'text-red-500' : 'text-green-500'}`}>
                         {selectedTable.status}
                       </span>
                    </div>
                 </div>
                 
                 {selectedTable.status !== 'calling' && (
                   <button onClick={() => handleOpenTable(selectedTable.id)} className="w-full bg-blue-600 py-6 rounded-[2rem] text-xs font-black uppercase tracking-widest text-white shadow-xl">
                      {selectedTable.status === 'free' ? 'SENTAR CLIENTE' : 'VER DETALLES'}
                   </button>
                 )}
              </div>
           </div>
        </div>
      )}
    </div>
  );
};

const FloorTableNode: React.FC<{ table: any, onClick: () => void }> = ({ table, onClick }) => {
  const isCalling = table.status === 'calling';
  const isOccupied = table.status === 'occupied';
  const isReserved = table.status === 'reserved';

  let bgClass = 'bg-[#16161a] border-white/5';
  let accentColor = 'text-gray-700';
  let glowEffect = '';

  if (isCalling) {
    bgClass = 'bg-red-600/20 border-red-500 animate-pulse';
    accentColor = 'text-red-500';
    glowEffect = 'shadow-[0_0_40px_rgba(239,68,68,0.5)]';
  } else if (isOccupied) {
    bgClass = 'bg-red-600/5 border-red-500/30';
    accentColor = 'text-red-500/50';
  } else if (isReserved) {
    bgClass = 'bg-amber-600/10 border-amber-500/40';
    accentColor = 'text-amber-500';
  }

  return (
    <div 
      onClick={onClick}
      className={`relative cursor-pointer transition-all duration-300 hover:scale-110 group aspect-square rounded-[2rem] border-2 flex flex-col items-center justify-center ${bgClass} ${glowEffect}`}
    >
      <span className={`text-[8px] font-black uppercase tracking-tighter mb-1 opacity-50 ${accentColor}`}>
        {table.id.toString().padStart(2, '0')}
      </span>
      <span className={`text-2xl font-black italic leading-none ${isCalling ? 'text-white' : ''}`}>
        {table.id}
      </span>
      
      {isCalling && (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2 flex flex-col items-center">
           <Video size={14} className="text-white bg-red-600 p-0.5 rounded-md shadow-lg" />
        </div>
      )}
    </div>
  );
};

const TabButton: React.FC<{ active: boolean, onClick: () => void, icon: any, label: string }> = ({ active, onClick, icon, label }) => (
  <button onClick={onClick} className={`flex items-center gap-3 px-8 py-3.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${active ? 'bg-blue-600 text-white shadow-2xl' : 'text-gray-500 hover:text-gray-300'}`}>
    {icon} {label}
  </button>
);

const LegendItem = ({ color, label }: { color: string, label: string }) => (
  <div className="flex items-center gap-2 px-4 py-2 bg-white/5 rounded-full border border-white/5">
    <div className={`w-2 h-2 rounded-full ${color}`}></div>
    <span className="text-[8px] font-black uppercase text-gray-500 tracking-widest">{label}</span>
  </div>
);

export default ReserveModule;
