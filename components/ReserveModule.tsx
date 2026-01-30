
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
import { supabase } from '../lib/supabase.ts';
import { useAuth } from '../contexts/AuthContext.tsx';

const ReserveModule: React.FC = () => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<'floorplan' | 'agenda'>('floorplan');
  const [loading, setLoading] = useState(true);
  const [openingId, setOpeningId] = useState<number | null>(null);
  const [tables, setTables] = useState<any[]>([]); 
  const [dailyReservations, setDailyReservations] = useState<any[]>([]);
  const [selectedTable, setSelectedTable] = useState<any | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    try {
      const { data: tablesData } = await supabase
        .from('tables')
        .select(`*, reservations(id, reservation_time, pax, status, customers(name))`)
        .order('id', { ascending: true });
      setTables(tablesData || []);

      const today = new Date().toISOString().split('T')[0];
      const { data: resData } = await supabase
        .from('reservations')
        .select('*, customers(name), tables(id, zone, name)')
        .gte('reservation_time', `${today}T00:00:00`)
        .lte('reservation_time', `${today}T23:59:59`)
        .order('reservation_time', { ascending: true });
      setDailyReservations(resData || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    const channel = supabase.channel('reserve-sync')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tables' }, () => fetchData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'reservations' }, () => fetchData())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  const handleOpenTable = async (tableId: number) => {
    setOpeningId(tableId);
    try {
      await supabase.from('tables').update({ status: 'occupied', welcome_timer_start: null }).eq('id', tableId);
      setIsModalOpen(false);
      fetchData();
    } catch (err) { console.error(err); }
    finally { setOpeningId(null); }
  };

  return (
    <div className="space-y-10 animate-in fade-in duration-1000 text-left">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-8 border-b border-white/5 pb-10">
        <div className="flex items-center gap-5">
           <div className="p-5 bg-blue-600 rounded-[2rem] shadow-2xl">
              <CalendarDays className="text-white" size={32} />
           </div>
           <div>
              <h2 className="text-4xl font-black italic tracking-tighter uppercase leading-none">NEXUM RESERVE</h2>
              <p className="text-gray-500 text-[10px] font-black uppercase tracking-[0.4em] mt-3 italic">Floorplan Intelligence</p>
           </div>
        </div>
        <div className="flex bg-[#111114] p-2 rounded-2xl border border-white/5">
          <TabButton active={activeTab === 'floorplan'} onClick={() => setActiveTab('floorplan')} icon={<LayoutGrid size={16} />} label="Planta" />
          <TabButton active={activeTab === 'agenda'} onClick={() => setActiveTab('agenda')} icon={<Clock size={16} />} label={`Agenda (${dailyReservations.length})`} />
        </div>
      </div>

      {activeTab === 'floorplan' ? (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-10 gap-6">
          {tables.map(table => (
            <div key={table.id} onClick={() => { setSelectedTable(table); setIsModalOpen(true); }} className={`aspect-square rounded-[2rem] border-2 flex flex-col items-center justify-center cursor-pointer transition-all ${table.status === 'calling' ? 'bg-red-600/20 border-red-500 animate-pulse shadow-lg shadow-red-600/30' : 'bg-[#111114] border-white/5 hover:border-white/20'}`}>
              <span className="text-[10px] font-black opacity-30">MESA</span>
              <span className="text-2xl font-black italic">{table.id}</span>
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
           {dailyReservations.map(res => (
             <div key={res.id} className="bg-[#111114] p-6 rounded-3xl border border-white/5 flex justify-between items-center">
                <div>
                   <h4 className="text-lg font-black italic uppercase">{res.customers?.name}</h4>
                   <p className="text-[9px] text-gray-500 font-bold uppercase tracking-widest">{res.pax} PAX • {res.tables?.zone}</p>
                </div>
                <div className="text-right">
                   <span className="text-xl font-black italic text-blue-500">{new Date(res.reservation_time).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                </div>
             </div>
           ))}
        </div>
      )}

      {isModalOpen && selectedTable && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-8 animate-in fade-in backdrop-blur-3xl">
           <div className="absolute inset-0 bg-black/60" onClick={() => setIsModalOpen(false)}></div>
           <div className="bg-[#0a0a0c] border border-white/10 rounded-[4rem] w-full max-w-xl relative z-10 overflow-hidden shadow-2xl">
              <div className="p-10 border-b border-white/5 flex justify-between items-center">
                 <h3 className="text-3xl font-black italic uppercase">MESA {selectedTable.id}</h3>
                 <button onClick={() => setIsModalOpen(false)}><X size={24} /></button>
              </div>
              <div className="p-12 space-y-8">
                 <button onClick={() => handleOpenTable(selectedTable.id)} className="w-full bg-blue-600 py-6 rounded-[2rem] text-xs font-black uppercase tracking-widest text-white shadow-xl">SENTAR CLIENTE</button>
              </div>
           </div>
        </div>
      )}
    </div>
  );
};

const TabButton = ({ active, onClick, icon, label }: any) => (
  <button onClick={onClick} className={`flex items-center gap-3 px-8 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${active ? 'bg-blue-600 text-white shadow-2xl' : 'text-gray-500 hover:text-white'}`}>
    {icon} {label}
  </button>
);

export default ReserveModule;
