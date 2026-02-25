import React, { useState, useEffect, useCallback } from 'react';
import { 
  Calendar, 
  X,
  LayoutGrid,
  BellRing,
  Search,
  Bell,
  Settings,
  Plus,
  Minus,
  Check
} from 'lucide-react';
import { supabase } from '../lib/supabase.ts';

// Configuración del Plano (Updated to match image)
const FLOOR_LAYOUT = [
  // SECTOR: SUSHI_BAR (Top Center)
  { id: 1, x: 36, y: 25, type: 'sushi', label: 'S1', zone: 'SUSHI_BAR' },
  { id: 2, x: 41, y: 25, type: 'sushi', label: 'S2', zone: 'SUSHI_BAR' },
  { id: 3, x: 46, y: 25, type: 'sushi', label: 'S3', zone: 'SUSHI_BAR' },
  { id: 4, x: 51, y: 25, type: 'sushi', label: 'S4', zone: 'SUSHI_BAR' },
  { id: 5, x: 56, y: 25, type: 'sushi', label: 'S5', zone: 'SUSHI_BAR' },

  // SECTOR: SAKE_ZONE (Left)
  { id: 9, x: 15, y: 40, type: 'booth', label: 'B-01', zone: 'SAKE_ZONE' },
  { id: 10, x: 15, y: 55, type: 'booth', label: 'B-02', zone: 'SAKE_ZONE' },
  { id: 11, x: 15, y: 70, type: 'booth', label: 'B-03', zone: 'SAKE_ZONE' },

  // SECTOR: MAIN_HALL (Center)
  { id: 12, x: 28, y: 42, type: 'round', label: 'T-12', zone: 'MAIN_HALL' },
  { id: 14, x: 45, y: 42, type: 'rect', label: 'T-14', zone: 'MAIN_HALL' },
  { id: 15, x: 62, y: 42, type: 'round', label: 'T-15', zone: 'MAIN_HALL' },
  { id: 16, x: 38, y: 58, type: 'rect', label: 'T-16', zone: 'MAIN_HALL' },
  { id: 18, x: 55, y: 58, type: 'round', label: 'T-18', zone: 'MAIN_HALL' },

  // SECTOR: BAR_TOWER (Right)
  { id: 20, x: 80, y: 40, type: 'round', label: 'H-01', zone: 'BAR_TOWER' },
  { id: 21, x: 80, y: 55, type: 'rect', label: 'H-02', zone: 'BAR_TOWER' },
  { id: 22, x: 80, y: 70, type: 'round', label: 'H-03', zone: 'BAR_TOWER' },

  // SECTOR: TERRACE_OPEN_AIR (Bottom)
  { id: 17, x: 35, y: 85, type: 'round', label: 'TR-1', zone: 'TERRACE' },
  { id: 180, x: 48, y: 85, type: 'round', label: 'TR-2', zone: 'TERRACE' }, // Changed ID to avoid conflict
  { id: 19, x: 61, y: 85, type: 'round', label: 'TR-3', zone: 'TERRACE' },
];

interface Table {
  id: number;
  status?: string;
  seats?: number;
  label?: string;
  zone?: string;
  name?: string;
  welcome_timer_start?: string | null;
}

interface Reservation {
  id: number;
  reservation_time: string;
  pax: number;
  status: string;
  customers?: { name: string };
  tables?: { id: number; zone: string; name: string };
}

const ReserveModule: React.FC = () => {
  const [tables, setTables] = useState<Table[]>([]); 
  const [dailyReservations, setDailyReservations] = useState<Reservation[]>([]);
  const [selectedTable, setSelectedTable] = useState<Table | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [scale, setScale] = useState(1);

  const fetchData = useCallback(async () => {
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
    }
  }, []);

  useEffect(() => {
    fetchData();
    const channel = supabase.channel('reserve-sync')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tables' }, () => fetchData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'reservations' }, () => fetchData())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [fetchData]);

  const handleOpenTable = async (tableId: number) => {
    try {
      await supabase.from('tables').update({ status: 'occupied', welcome_timer_start: null }).eq('id', tableId);
      setIsModalOpen(false);
      fetchData();
    } catch (err) { console.error(err); }
  };

  const getTableStatus = (id: number) => {
    const table = tables.find(t => t.id === id);
    return table?.status || 'free';
  };

  const getTableData = (id: number) => {
    return tables.find(t => t.id === id) || { id, status: 'free', zone: 'Unknown' };
  };

  // Metrics Calculation
  const totalCovers = tables.reduce((acc, t) => acc + (t.status === 'occupied' ? (t.seats || 2) : 0), 0);
  const totalCapacity = 142; // Hardcoded from image or calculate
  const occupancyRate = Math.round((totalCovers / totalCapacity) * 100);
  const waitlistCount = 4; // Mock or fetch

  // Find calling table for Service Request card
  const callingTable = tables.find(t => t.status === 'calling');

  return (
    <div className="flex h-full bg-[#0B0E14] text-white overflow-hidden font-sans">
      {/* Main Floorplan Area */}
      <div className="flex-1 flex flex-col relative border-r border-white/5">
        {/* Header */}
        <header className="h-20 border-b border-white/5 flex items-center justify-between px-8 bg-[#0B0E14] z-10">
          <div>
            <div className="flex items-center gap-4 text-gray-400 text-xs font-bold tracking-widest uppercase mb-1">
              <span>Floorplan</span>
              <span className="w-px h-3 bg-gray-700"></span>
              <span>Intelligence</span>
            </div>
          </div>
          
          <div className="flex items-center gap-4 bg-[#151921] rounded-full px-4 py-2 border border-white/5 w-1/3">
            <Search size={16} className="text-gray-500" />
            <input 
              type="text" 
              placeholder="Search table, reservation ID, or guest name" 
              className="bg-transparent border-none outline-none text-xs w-full placeholder-gray-600"
            />
          </div>

          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2 px-3 py-1.5 bg-[#151921] rounded-full border border-white/5">
              <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
              <span className="text-[10px] font-bold text-green-500 uppercase tracking-wider">NODE_ACTIVO</span>
            </div>
            <div className="text-xl font-mono font-bold tracking-widest">
              {new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit', second:'2-digit'})}
            </div>
            <div className="flex items-center gap-4 text-gray-400">
              <Bell size={20} />
              <Settings size={20} />
            </div>
          </div>
        </header>

        {/* Floorplan Content */}
        <div className="flex-1 relative overflow-hidden bg-[#0B0E14]">
          {/* Grid Background */}
          <div className="absolute inset-0 opacity-5" 
               style={{ 
                 backgroundImage: 'linear-gradient(#333 1px, transparent 1px), linear-gradient(90deg, #333 1px, transparent 1px)', 
                 backgroundSize: '40px 40px' 
               }}>
          </div>

          {/* Controls & Title Overlay */}
          <div className="absolute top-8 left-8 z-10">
            <h1 className="text-3xl font-bold text-white mb-1">MAIN HALL LEVEL 1</h1>
            <div className="flex items-center gap-3 text-gray-400 text-sm">
              <span>Capacity: {totalCapacity}</span>
              <span className="w-1 h-1 rounded-full bg-gray-600"></span>
              <span>Occupancy: {occupancyRate}%</span>
            </div>
          </div>

          <div className="absolute top-8 right-8 z-10 flex items-center gap-3">
            <button onClick={() => setScale(s => Math.min(s + 0.1, 2))} className="w-10 h-10 rounded-full bg-[#1F232C] border border-white/10 flex items-center justify-center hover:bg-white/10 transition-colors">
              <Plus size={18} />
            </button>
            <button onClick={() => setScale(s => Math.max(s - 0.1, 0.5))} className="w-10 h-10 rounded-full bg-[#1F232C] border border-white/10 flex items-center justify-center hover:bg-white/10 transition-colors">
              <Minus size={18} />
            </button>
            <button className="px-6 py-2.5 bg-blue-600 hover:bg-blue-500 rounded-full text-xs font-bold uppercase tracking-wider shadow-lg shadow-blue-900/20 transition-all">
              Auto-Assign
            </button>
          </div>

          {/* Sector Labels */}
          <div className="absolute top-[18%] left-1/2 -translate-x-1/2 text-[10px] font-bold tracking-[0.2em] text-gray-600 uppercase">SECTOR: SUSHI_BAR</div>
          <div className="absolute left-8 top-1/2 -translate-y-1/2 -rotate-90 text-[10px] font-bold tracking-[0.2em] text-gray-600 uppercase origin-left">SECTOR: SAKE_ZONE</div>
          <div className="absolute right-8 top-1/2 -translate-y-1/2 rotate-90 text-[10px] font-bold tracking-[0.2em] text-gray-600 uppercase origin-right">SECTOR: BAR_TOWER</div>
          <div className="absolute bottom-[15%] left-1/2 -translate-x-1/2 text-[10px] font-bold tracking-[0.2em] text-gray-600 uppercase w-full text-center border-t border-dashed border-white/5 pt-4">SECTOR: TERRACE_OPEN_AIR</div>

          {/* Tables Layer */}
          <div className="absolute inset-0 transition-transform duration-500 ease-out" style={{ transform: `scale(${scale})` }}>
            {FLOOR_LAYOUT.map(item => {
              const status = getTableStatus(item.id);
              const data = getTableData(item.id);
              const isReserved = status === 'reserved';
              const isOccupied = status === 'occupied';
              const isCalling = status === 'calling';
              
              // Shape Styles
              let shapeClass = 'rounded-2xl'; // Default rect
              if (item.type === 'round' || item.type === 'sushi') shapeClass = 'rounded-full';
              if (item.type === 'booth') shapeClass = 'rounded-[2.5rem]';

              // Color Styles
              let colorClass = 'bg-[#151921] border-white/10 text-gray-500'; // Free
              if (isOccupied) colorClass = 'bg-blue-600 border-blue-400 text-white shadow-[0_0_30px_rgba(37,99,235,0.3)]';
              if (isReserved) colorClass = 'bg-[#151921] border-amber-500 border-dashed text-amber-500';
              if (isCalling) colorClass = 'bg-[#151921] border-red-500 text-red-500 shadow-[0_0_30px_rgba(239,68,68,0.2)] animate-pulse';

              return (
                <div 
                  key={item.id}
                  onClick={() => { setSelectedTable(data); setIsModalOpen(true); }}
                  className={`absolute cursor-pointer group flex items-center justify-center border-2 transition-all duration-300 hover:scale-105 ${shapeClass} ${colorClass}`}
                  style={{
                    left: `${item.x}%`,
                    top: `${item.y}%`,
                    width: item.type === 'sushi' ? '3.5%' : item.type === 'rect' ? '10%' : item.type === 'booth' ? '9%' : '7%',
                    height: item.type === 'sushi' ? '3.5%' : item.type === 'rect' ? '7%' : item.type === 'booth' ? '9%' : '7%',
                    aspectRatio: item.type === 'sushi' || item.type === 'round' ? '1/1' : 'auto'
                  }}
                >
                  <span className="font-bold text-[10px] tracking-wider">{item.label}</span>
                  
                  {/* Chairs Visuals (Pseudo-chairs) */}
                  {item.type !== 'sushi' && (
                    <>
                      <div className={`absolute -top-2 left-1/2 -translate-x-1/2 w-8 h-1.5 rounded-full ${isOccupied ? 'bg-blue-500' : 'bg-[#1F232C]'}`}></div>
                      <div className={`absolute -bottom-2 left-1/2 -translate-x-1/2 w-8 h-1.5 rounded-full ${isOccupied ? 'bg-blue-500' : 'bg-[#1F232C]'}`}></div>
                      {item.type === 'rect' && (
                        <>
                          <div className={`absolute top-1/2 -left-2 -translate-y-1/2 w-1.5 h-6 rounded-full ${isOccupied ? 'bg-blue-500' : 'bg-[#1F232C]'}`}></div>
                          <div className={`absolute top-1/2 -right-2 -translate-y-1/2 w-1.5 h-6 rounded-full ${isOccupied ? 'bg-blue-500' : 'bg-[#1F232C]'}`}></div>
                        </>
                      )}
                    </>
                  )}

                  {/* Reserved Time Label */}
                  {isReserved && (
                     <div className="absolute -top-6 bg-[#151921] px-2 py-0.5 rounded text-[9px] font-bold text-amber-500 border border-amber-500/30">
                        20:30
                     </div>
                  )}

                  {/* Calling Icon */}
                  {isCalling && (
                    <div className="absolute -top-2 -right-2 bg-red-500 text-white p-1 rounded-full shadow-lg">
                      <BellRing size={8} />
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Legend */}
          <div className="absolute bottom-8 right-8 flex flex-col gap-3 bg-[#151921]/90 p-4 rounded-2xl backdrop-blur-md border border-white/5">
             <div className="flex items-center gap-3"><div className="w-3 h-3 rounded-full border border-gray-600"></div><span className="text-[10px] font-bold uppercase text-gray-400 tracking-wider">Free</span></div>
             <div className="flex items-center gap-3"><div className="w-3 h-3 rounded-full bg-blue-600 border border-blue-400"></div><span className="text-[10px] font-bold uppercase text-gray-400 tracking-wider">Occupied</span></div>
             <div className="flex items-center gap-3"><div className="w-3 h-3 rounded-full border border-dashed border-amber-500"></div><span className="text-[10px] font-bold uppercase text-amber-500 tracking-wider">Reserved</span></div>
             <div className="flex items-center gap-3"><div className="w-3 h-3 rounded-full border border-red-500"></div><span className="text-[10px] font-bold uppercase text-red-500 tracking-wider">Calling</span></div>
          </div>
        </div>
      </div>

      {/* Right Sidebar */}
      <div className="w-[380px] bg-[#0F1218] border-l border-white/5 p-6 flex flex-col gap-6 shrink-0 z-20">
        
        {/* Real-Time Metrics */}
        <div className="bg-[#151921] rounded-3xl p-6 border border-white/5">
          <div className="flex items-center gap-2 mb-6">
            <LayoutGrid size={14} className="text-gray-500" />
            <span className="text-[10px] font-bold uppercase tracking-widest text-gray-500">Real-Time Metrics</span>
          </div>
          
          <div className="grid grid-cols-2 gap-8 mb-6">
            <div>
              <p className="text-[9px] font-bold uppercase text-gray-500 tracking-wider mb-1">Total Covers</p>
              <p className="text-3xl font-bold text-white">{totalCovers}</p>
            </div>
            <div>
              <p className="text-[9px] font-bold uppercase text-gray-500 tracking-wider mb-1">Waitlist</p>
              <p className="text-3xl font-bold text-amber-500">0{waitlistCount}</p>
            </div>
          </div>

          <div>
            <div className="flex justify-between text-[10px] font-bold uppercase text-gray-500 mb-2">
              <span>Occupancy Rate</span>
              <span className="text-blue-500">{occupancyRate}%</span>
            </div>
            <div className="h-2 bg-[#0B0E14] rounded-full overflow-hidden">
              <div className="h-full bg-blue-600 rounded-full transition-all duration-1000" style={{ width: `${occupancyRate}%` }}></div>
            </div>
          </div>
        </div>

        {/* Service Request Card */}
        {callingTable ? (
          <div className="bg-[#151921] rounded-3xl border border-red-500/20 overflow-hidden relative">
             <div className="absolute top-0 left-0 w-1 h-full bg-red-500"></div>
             <div className="p-4 bg-red-500/10 flex justify-between items-center border-b border-red-500/10">
                <div className="flex items-center gap-2 text-red-500">
                  <BellRing size={14} />
                  <span className="text-[10px] font-bold uppercase tracking-widest">Service Request</span>
                </div>
                <span className="text-[10px] font-mono text-red-400">00:45s</span>
             </div>
             <div className="p-6 flex justify-between items-center">
                <div>
                   <h3 className="text-lg font-bold text-white">Table {callingTable.label || callingTable.id}</h3>
                   <p className="text-xs text-gray-400 mt-1">{callingTable.zone} • {callingTable.seats || 4} Guests</p>
                   <div className="mt-3 inline-block px-3 py-1 rounded-full bg-[#0B0E14] border border-white/10 text-[10px] text-gray-400">
                      Sommelier Req
                   </div>
                </div>
                <button 
                  onClick={() => handleOpenTable(callingTable.id)}
                  className="w-10 h-10 rounded-full bg-red-500 flex items-center justify-center hover:bg-red-400 transition-colors shadow-lg shadow-red-900/20"
                >
                   <Check size={20} className="text-white" />
                </button>
             </div>
          </div>
        ) : (
          <div className="bg-[#151921] rounded-3xl border border-white/5 p-6 flex flex-col items-center justify-center text-center opacity-50">
             <BellRing size={24} className="text-gray-600 mb-3" />
             <p className="text-xs text-gray-500 font-bold uppercase tracking-widest">No Active Requests</p>
          </div>
        )}

        {/* Upcoming Reservations */}
        <div className="bg-[#151921] rounded-3xl p-6 border border-white/5 flex-1 flex flex-col">
          <div className="flex items-center gap-2 mb-6">
            <Calendar size={14} className="text-gray-500" />
            <span className="text-[10px] font-bold uppercase tracking-widest text-gray-500">Upcoming</span>
          </div>

          <div className="space-y-3 overflow-y-auto pr-2 custom-scrollbar flex-1">
            {dailyReservations.length > 0 ? dailyReservations.map((res, idx) => (
              <div key={res.id} className="group flex items-center justify-between p-4 rounded-2xl bg-[#0B0E14] border border-white/5 hover:border-white/10 transition-all">
                 <div className="flex items-center gap-4">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center text-[10px] font-bold ${idx === 0 ? 'bg-amber-500/10 text-amber-500 border border-amber-500/20' : 'bg-[#151921] text-gray-500 border border-white/5'}`}>
                       {new Date(res.reservation_time).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                    </div>
                    <div>
                       <h4 className="text-sm font-bold text-white">{res.customers?.name}</h4>
                       <p className="text-[10px] text-gray-500">{res.pax} Guests • {res.tables?.name || 'VIP Gold'}</p>
                    </div>
                 </div>
                 <span className="text-[10px] font-bold text-gray-600">{res.tables?.name || 'T-14'}</span>
              </div>
            )) : (
              <div className="text-center py-8 text-gray-600 text-xs">No upcoming reservations</div>
            )}
            
            {/* Mock Data for visual fidelity if empty */}
            {dailyReservations.length === 0 && (
              <>
                <div className="group flex items-center justify-between p-4 rounded-2xl bg-[#0B0E14] border border-white/5 hover:border-white/10 transition-all">
                   <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-full flex items-center justify-center text-[10px] font-bold bg-amber-500/10 text-amber-500 border border-amber-500/20">
                         20:00
                      </div>
                      <div>
                         <h4 className="text-sm font-bold text-white">Elena Fisher</h4>
                         <p className="text-[10px] text-gray-500">2 Guests • VIP Gold</p>
                      </div>
                   </div>
                   <span className="text-[10px] font-bold text-gray-400">T-14</span>
                </div>
                <div className="group flex items-center justify-between p-4 rounded-2xl bg-[#0B0E14] border border-white/5 hover:border-white/10 transition-all">
                   <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-full flex items-center justify-center text-[10px] font-bold bg-[#151921] text-gray-500 border border-white/5">
                         20:15
                      </div>
                      <div>
                         <h4 className="text-sm font-bold text-white">Tech Corp Event</h4>
                         <p className="text-[10px] text-gray-500">8 Guests • Main Lounge</p>
                      </div>
                   </div>
                   <span className="text-[10px] font-bold text-gray-600 italic">Unassigned</span>
                </div>
              </>
            )}
          </div>
        </div>

      </div>

      {/* Modal for Table Details */}
      {isModalOpen && selectedTable && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-8 animate-in fade-in backdrop-blur-sm bg-black/50">
           <div className="bg-[#151921] border border-white/10 rounded-3xl w-full max-w-md relative z-10 overflow-hidden shadow-2xl">
              <div className="p-6 border-b border-white/5 flex justify-between items-center">
                 <div>
                    <h3 className="text-xl font-bold text-white">Table {selectedTable.label || selectedTable.id}</h3>
                    <p className="text-xs text-gray-500 uppercase tracking-wider mt-1">{selectedTable.zone}</p>
                 </div>
                 <button onClick={() => setIsModalOpen(false)} className="p-2 hover:bg-white/5 rounded-full text-gray-400"><X size={20} /></button>
              </div>
              <div className="p-6 space-y-6">
                 <div className="grid grid-cols-2 gap-4">
                    <div className="bg-[#0B0E14] p-4 rounded-2xl border border-white/5">
                       <span className="text-[10px] text-gray-500 font-bold uppercase tracking-widest block mb-1">Status</span>
                       <span className={`text-sm font-bold uppercase ${selectedTable.status === 'free' ? 'text-green-500' : 'text-blue-500'}`}>{selectedTable.status}</span>
                    </div>
                    <div className="bg-[#0B0E14] p-4 rounded-2xl border border-white/5">
                       <span className="text-[10px] text-gray-500 font-bold uppercase tracking-widest block mb-1">Capacity</span>
                       <span className="text-sm font-bold text-white">{selectedTable.seats || 4} Guests</span>
                    </div>
                 </div>

                 {selectedTable.status === 'free' ? (
                    <button onClick={() => handleOpenTable(selectedTable.id)} className="w-full bg-blue-600 hover:bg-blue-500 py-4 rounded-xl text-xs font-bold uppercase tracking-widest text-white shadow-lg transition-all">
                       Seating Guests
                    </button>
                 ) : (
                    <div className="space-y-3">
                       <button className="w-full bg-[#0B0E14] border border-white/10 hover:bg-white/5 py-4 rounded-xl text-xs font-bold uppercase tracking-widest text-white transition-all">
                          View Order
                       </button>
                       <button onClick={() => handleOpenTable(selectedTable.id)} className="w-full bg-red-500/10 border border-red-500/20 hover:bg-red-500 hover:text-white py-4 rounded-xl text-xs font-bold uppercase tracking-widest text-red-500 transition-all">
                          Release Table
                       </button>
                    </div>
                 )}
              </div>
           </div>
        </div>
      )}
    </div>
  );
};

export default ReserveModule;
