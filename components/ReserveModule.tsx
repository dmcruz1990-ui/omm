
import React, { useState, useEffect, useRef } from 'react';
import {
  CalendarDays, Clock, LayoutGrid, X, Users,
  Loader2, ChevronRight, BellRing, CheckCircle2,
  RefreshCcw, AlertCircle
} from 'lucide-react';
import { supabase } from '../lib/supabase.ts';
import { useAuth } from '../contexts/AuthContext.tsx';

// ─── Tipos ────────────────────────────────────────────────────────────────────
type TableStatus = 'free' | 'occupied' | 'calling' | 'reserved' | 'seated' | 'waiting_list';

interface DBTable {
  id: number;
  status: TableStatus;
  seats: number;
  zone: string;
  name?: string;
  welcome_timer_start?: string | null;
  ritual_step?: number;
  reservations?: { id: number; reservation_time: string; pax: number; status: string; customers: { name: string } | null }[];
}

// ─── Config zonas ─────────────────────────────────────────────────────────────
const ZONES = [
  { id: 'mantra',      name: 'MANTRA AMATISTA', sub: 'ZEN · INTERIOR',    color: '#f59e0b', x: 10,  y: 10,  w: 198, h: 218, rx: 14 },
  { id: 'lounge',      name: 'MESA APOYO',       sub: 'LOUNGE',            color: '#a855f7', x: 10,  y: 238, w: 198, h: 312, rx: 14 },
  { id: 'salon',       name: 'SALÓN',            sub: 'INTERIOR',          color: '#3b82f6', x: 218, y: 10,  w: 398, h: 240, rx: 14 },
  { id: 'eterno',      name: 'ETERNO',           sub: 'TERRAZA · VIBRANTE',color: '#ef4444', x: 218, y: 260, w: 398, h: 290, rx: 14 },
  { id: 'barra-sushi', name: 'BARRA SUSHI',      sub: 'BAR COUNTER',       color: '#10b981', x: 626, y: 10,  w: 244, h: 155, rx: 14 },
  { id: 'torre-bar',   name: 'TORRE BAR',        sub: 'COCKTAILS',         color: '#f97316', x: 626, y: 175, w: 244, h: 375, rx: 14 },
];

// ─── Posiciones de mesas en el SVG ────────────────────────────────────────────
interface TableDef {
  mapId: number;
  cx: number; cy: number; r: number;
  seats: number;
  zone: string;
  isVip?: boolean;
  isBar?: boolean;
}

const TABLE_DEFS: TableDef[] = [
  // MANTRA AMATISTA
  { mapId: 1,  cx: 92,  cy: 108, r: 42, seats: 8,  zone: 'mantra',      isVip: true },
  { mapId: 2,  cx: 178, cy: 73,  r: 22, seats: 4,  zone: 'mantra' },
  { mapId: 3,  cx: 178, cy: 148, r: 22, seats: 4,  zone: 'mantra' },
  // LOUNGE
  { mapId: 4,  cx: 63,  cy: 296, r: 26, seats: 4,  zone: 'lounge' },
  { mapId: 5,  cx: 155, cy: 286, r: 21, seats: 4,  zone: 'lounge' },
  { mapId: 6,  cx: 63,  cy: 368, r: 26, seats: 4,  zone: 'lounge' },
  { mapId: 7,  cx: 155, cy: 362, r: 21, seats: 4,  zone: 'lounge' },
  { mapId: 8,  cx: 63,  cy: 444, r: 26, seats: 4,  zone: 'lounge' },
  { mapId: 9,  cx: 155, cy: 438, r: 21, seats: 4,  zone: 'lounge' },
  // SALÓN PRINCIPAL – 3 filas
  { mapId: 10, cx: 262, cy: 76,  r: 24, seats: 4,  zone: 'salon' },
  { mapId: 11, cx: 338, cy: 76,  r: 24, seats: 4,  zone: 'salon' },
  { mapId: 12, cx: 415, cy: 76,  r: 24, seats: 4,  zone: 'salon' },
  { mapId: 13, cx: 491, cy: 76,  r: 24, seats: 4,  zone: 'salon' },
  { mapId: 14, cx: 568, cy: 76,  r: 24, seats: 4,  zone: 'salon' },
  { mapId: 15, cx: 262, cy: 155, r: 24, seats: 4,  zone: 'salon' },
  { mapId: 16, cx: 338, cy: 155, r: 24, seats: 4,  zone: 'salon' },
  { mapId: 17, cx: 415, cy: 155, r: 24, seats: 4,  zone: 'salon' },
  { mapId: 18, cx: 491, cy: 155, r: 24, seats: 4,  zone: 'salon' },
  { mapId: 19, cx: 568, cy: 155, r: 24, seats: 4,  zone: 'salon' },
  { mapId: 20, cx: 262, cy: 228, r: 24, seats: 4,  zone: 'salon' },
  { mapId: 21, cx: 352, cy: 228, r: 24, seats: 4,  zone: 'salon' },
  // ETERNO – terraza
  { mapId: 22, cx: 262, cy: 316, r: 24, seats: 4,  zone: 'eterno' },
  { mapId: 23, cx: 342, cy: 316, r: 24, seats: 4,  zone: 'eterno' },
  { mapId: 24, cx: 415, cy: 316, r: 24, seats: 4,  zone: 'eterno' },
  { mapId: 25, cx: 498, cy: 316, r: 24, seats: 4,  zone: 'eterno' },
  { mapId: 26, cx: 575, cy: 316, r: 24, seats: 4,  zone: 'eterno' },
  { mapId: 27, cx: 415, cy: 405, r: 38, seats: 8,  zone: 'eterno',  isVip: true },
  { mapId: 28, cx: 262, cy: 494, r: 24, seats: 4,  zone: 'eterno' },
  { mapId: 29, cx: 348, cy: 494, r: 24, seats: 4,  zone: 'eterno' },
  { mapId: 30, cx: 575, cy: 480, r: 24, seats: 4,  zone: 'eterno' },
  // BARRA SUSHI
  { mapId: 31, cx: 657, cy: 106, r: 19, seats: 2,  zone: 'barra-sushi', isBar: true },
  { mapId: 32, cx: 706, cy: 106, r: 19, seats: 2,  zone: 'barra-sushi', isBar: true },
  { mapId: 33, cx: 755, cy: 106, r: 19, seats: 2,  zone: 'barra-sushi', isBar: true },
  { mapId: 34, cx: 804, cy: 106, r: 19, seats: 2,  zone: 'barra-sushi', isBar: true },
  { mapId: 35, cx: 853, cy: 106, r: 19, seats: 2,  zone: 'barra-sushi', isBar: true },
  // TORRE BAR
  { mapId: 36, cx: 700, cy: 254, r: 22, seats: 4,  zone: 'torre-bar' },
  { mapId: 37, cx: 798, cy: 254, r: 22, seats: 4,  zone: 'torre-bar' },
  { mapId: 38, cx: 750, cy: 342, r: 32, seats: 6,  zone: 'torre-bar', isVip: true },
  { mapId: 39, cx: 700, cy: 438, r: 22, seats: 4,  zone: 'torre-bar' },
  { mapId: 40, cx: 798, cy: 438, r: 22, seats: 4,  zone: 'torre-bar' },
];

// ─── Colores por estado ────────────────────────────────────────────────────────
const STATUS_COLORS: Record<TableStatus, { fill: string; stroke: string; glow: string; label: string }> = {
  free:         { fill: 'rgba(16,185,129,0.18)',  stroke: '#10b981', glow: '#10b981', label: 'LIBRE' },
  occupied:     { fill: 'rgba(239,68,68,0.18)',   stroke: '#ef4444', glow: '#ef4444', label: 'OCUPADA' },
  calling:      { fill: 'rgba(239,68,68,0.30)',   stroke: '#ef4444', glow: '#ef4444', label: 'LLAMANDO' },
  reserved:     { fill: 'rgba(245,158,11,0.18)',  stroke: '#f59e0b', glow: '#f59e0b', label: 'RESERVADA' },
  seated:       { fill: 'rgba(59,130,246,0.18)',  stroke: '#3b82f6', glow: '#3b82f6', label: 'SENTADA' },
  waiting_list: { fill: 'rgba(107,114,128,0.18)', stroke: '#6b7280', glow: '#6b7280', label: 'EN ESPERA' },
};
const NO_DB_STYLE = { fill: 'rgba(255,255,255,0.05)', stroke: 'rgba(255,255,255,0.15)', glow: 'transparent' };

// ─── Componente principal ──────────────────────────────────────────────────────
const ReserveModule: React.FC = () => {
  const { profile } = useAuth();
  const [activeTab, setActiveTab] = useState<'floorplan' | 'agenda'>('floorplan');
  const [loading, setLoading] = useState(true);
  const [tables, setTables] = useState<DBTable[]>([]);
  const [dailyReservations, setDailyReservations] = useState<any[]>([]);
  const [selectedTable, setSelectedTable] = useState<{ def: TableDef; db: DBTable | null } | null>(null);
  const [hoveredId, setHoveredId] = useState<number | null>(null);
  const [openingId, setOpeningId] = useState<number | null>(null);
  const [filterZone, setFilterZone] = useState<string | null>(null);
  const [pulseFrame, setPulseFrame] = useState(0);

  // Pulso para mesas CALLING
  useEffect(() => {
    const t = setInterval(() => setPulseFrame(f => f + 1), 700);
    return () => clearInterval(t);
  }, []);

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
    const channel = supabase.channel('reserve-sync-v2')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tables' }, fetchData)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'reservations' }, fetchData)
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  const handleOpenTable = async (tableId: number) => {
    setOpeningId(tableId);
    try {
      await supabase.from('tables').update({ status: 'occupied', welcome_timer_start: null }).eq('id', tableId);
      setSelectedTable(null);
      fetchData();
    } catch (err) { console.error(err); }
    finally { setOpeningId(null); }
  };

  const handleFreeTable = async (tableId: number) => {
    setOpeningId(tableId);
    try {
      await supabase.from('tables').update({ status: 'free', welcome_timer_start: null }).eq('id', tableId);
      setSelectedTable(null);
      fetchData();
    } catch (err) { console.error(err); }
    finally { setOpeningId(null); }
  };

  // stats rápidas
  const stats = {
    free: tables.filter(t => t.status === 'free').length,
    occupied: tables.filter(t => t.status === 'occupied' || t.status === 'seated').length,
    reserved: tables.filter(t => t.status === 'reserved').length,
    calling: tables.filter(t => t.status === 'calling').length,
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-700">

      {/* ── Header ── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 border-b border-white/5 pb-8">
        <div className="flex items-center gap-5">
          <div className="p-5 bg-blue-600 rounded-[2rem] shadow-2xl">
            <CalendarDays className="text-white" size={30} />
          </div>
          <div>
            <h2 className="text-4xl font-black italic tracking-tighter uppercase leading-none">NEXUM RESERVE</h2>
            <p className="text-gray-500 text-[10px] font-black uppercase tracking-[0.4em] mt-2 italic">Floorplan Intelligence · Grupo OMM</p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <button onClick={fetchData} className="p-3 rounded-xl bg-white/5 hover:bg-white/10 transition-all border border-white/5">
            <RefreshCcw size={16} className={loading ? 'animate-spin' : ''} />
          </button>
          <div className="flex bg-[#111114] p-2 rounded-2xl border border-white/5">
            <TabBtn active={activeTab === 'floorplan'} onClick={() => setActiveTab('floorplan')} icon={<LayoutGrid size={15} />} label="Planta" />
            <TabBtn active={activeTab === 'agenda'} onClick={() => setActiveTab('agenda')} icon={<Clock size={15} />} label={`Agenda (${dailyReservations.length})`} />
          </div>
        </div>
      </div>

      {/* ── Estadísticas rápidas ── */}
      <div className="grid grid-cols-4 gap-3">
        {[
          { label: 'LIBRES',    count: stats.free,     color: '#10b981', bg: 'rgba(16,185,129,0.1)' },
          { label: 'OCUPADAS',  count: stats.occupied,  color: '#ef4444', bg: 'rgba(239,68,68,0.1)' },
          { label: 'RESERVADAS',count: stats.reserved,  color: '#f59e0b', bg: 'rgba(245,158,11,0.1)' },
          { label: 'LLAMANDO',  count: stats.calling,   color: '#ef4444', bg: 'rgba(239,68,68,0.1)' },
        ].map(s => (
          <div key={s.label} className="rounded-2xl border border-white/5 p-4 flex flex-col gap-1" style={{ background: s.bg }}>
            <span className="text-3xl font-black italic" style={{ color: s.color }}>{s.count}</span>
            <span className="text-[9px] font-black uppercase tracking-widest text-gray-500">{s.label}</span>
          </div>
        ))}
      </div>

      {activeTab === 'floorplan' ? (
        <>
          {/* ── Filtro de zonas ── */}
          <div className="flex gap-2 flex-wrap">
            <button
              onClick={() => setFilterZone(null)}
              className={`px-4 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all border ${!filterZone ? 'bg-white text-black border-white' : 'border-white/10 text-gray-500 hover:border-white/30'}`}
            >
              TODAS
            </button>
            {ZONES.map(z => (
              <button
                key={z.id}
                onClick={() => setFilterZone(filterZone === z.id ? null : z.id)}
                className="px-4 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all border"
                style={{
                  borderColor: filterZone === z.id ? z.color : 'rgba(255,255,255,0.1)',
                  background: filterZone === z.id ? z.color + '22' : 'transparent',
                  color: filterZone === z.id ? z.color : '#6b7280',
                }}
              >
                {z.name}
              </button>
            ))}
          </div>

          {/* ── SVG Mapa ── */}
          <div className="w-full rounded-[2rem] overflow-hidden border border-white/5 bg-[#080809] relative">
            {loading && (
              <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/60 backdrop-blur-sm rounded-[2rem]">
                <Loader2 size={40} className="animate-spin text-blue-500" />
              </div>
            )}
            <svg
              viewBox="0 0 880 560"
              className="w-full h-auto"
              style={{ fontFamily: 'Inter, sans-serif' }}
            >
              <defs>
                {/* Glow filters por color */}
                {['#10b981','#ef4444','#f59e0b','#3b82f6','#a855f7','#f97316','#6b7280'].map(c => (
                  <filter key={c} id={`glow-${c.slice(1)}`} x="-50%" y="-50%" width="200%" height="200%">
                    <feGaussianBlur stdDeviation="4" result="blur" />
                    <feMerge>
                      <feMergeNode in="blur" />
                      <feMergeNode in="SourceGraphic" />
                    </feMerge>
                  </filter>
                ))}
                {/* Grid pattern */}
                <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
                  <path d="M 40 0 L 0 0 0 40" fill="none" stroke="rgba(255,255,255,0.025)" strokeWidth="0.5" />
                </pattern>
              </defs>

              {/* Background */}
              <rect width="880" height="560" fill="#08080a" />
              <rect width="880" height="560" fill="url(#grid)" />

              {/* ── Zonas ── */}
              {ZONES.map(z => {
                const dimmed = filterZone !== null && filterZone !== z.id;
                return (
                  <g key={z.id} style={{ opacity: dimmed ? 0.25 : 1, transition: 'opacity 0.3s' }}>
                    {/* Área zona */}
                    <rect
                      x={z.x} y={z.y} width={z.w} height={z.h} rx={z.rx}
                      fill={z.color + '10'} stroke={z.color + '60'} strokeWidth="1.5"
                    />
                    {/* Label zona */}
                    <text
                      x={z.x + z.w / 2} y={z.y + 24}
                      textAnchor="middle" fill={z.color}
                      fontSize="9" fontWeight="900" letterSpacing="3"
                      style={{ textTransform: 'uppercase', fontStyle: 'italic' }}
                    >
                      {z.name}
                    </text>
                    {z.sub && (
                      <text
                        x={z.x + z.w / 2} y={z.y + 36}
                        textAnchor="middle" fill={z.color + '70'}
                        fontSize="6.5" fontWeight="700" letterSpacing="2"
                        style={{ textTransform: 'uppercase' }}
                      >
                        {z.sub}
                      </text>
                    )}
                  </g>
                );
              })}

              {/* Barra counter SUSHI – mostrador físico */}
              <rect x="636" y="57" width="228" height="38" rx="6"
                fill="rgba(16,185,129,0.12)" stroke="rgba(16,185,129,0.45)" strokeWidth="1.5" />
              <text x="750" y="81" textAnchor="middle" fill="rgba(16,185,129,0.7)"
                fontSize="7.5" fontWeight="800" letterSpacing="3">BAR COUNTER</text>

              {/* Stage TORRE BAR */}
              <ellipse cx="750" cy="342" rx="42" ry="22"
                fill="rgba(249,115,22,0.08)" stroke="rgba(249,115,22,0.3)" strokeWidth="1" strokeDasharray="4 3" />
              <text x="750" y="345" textAnchor="middle" fill="rgba(249,115,22,0.5)"
                fontSize="6" fontWeight="800" letterSpacing="2">STAGE</text>

              {/* ── Mesas ── */}
              {TABLE_DEFS.map(def => {
                const dbTable = tables.find(t => t.id === def.mapId) ?? null;
                const status  = dbTable?.status ?? null;
                const style   = status ? STATUS_COLORS[status] : NO_DB_STYLE;
                const isCalling = status === 'calling';
                const isHovered = hoveredId === def.mapId;
                const zoneObj   = ZONES.find(z => z.id === def.zone)!;
                const dimmed    = filterZone !== null && filterZone !== def.zone;

                // Pulso animado en mesas CALLING
                const pulseR = isCalling ? def.r + (pulseFrame % 2 === 0 ? 6 : 0) : def.r;

                return (
                  <g
                    key={def.mapId}
                    style={{ cursor: 'pointer', opacity: dimmed ? 0.2 : 1, transition: 'opacity 0.3s' }}
                    onClick={() => { if (!dimmed) setSelectedTable({ def, db: dbTable }); }}
                    onMouseEnter={() => setHoveredId(def.mapId)}
                    onMouseLeave={() => setHoveredId(null)}
                  >
                    {/* Glow exterior para mesas con estado */}
                    {status && (
                      <circle
                        cx={def.cx} cy={def.cy}
                        r={pulseR + 4}
                        fill="none"
                        stroke={style.glow}
                        strokeWidth={isCalling ? 2 : 1}
                        opacity={isCalling ? (pulseFrame % 2 === 0 ? 0.6 : 0.2) : 0.25}
                        style={{ transition: 'opacity 0.4s' }}
                      />
                    )}
                    {/* Círculo principal */}
                    <circle
                      cx={def.cx} cy={def.cy}
                      r={isHovered ? def.r + 3 : def.r}
                      fill={style.fill}
                      stroke={isHovered ? zoneObj.color : style.stroke}
                      strokeWidth={isHovered ? 2 : 1.5}
                      style={{ transition: 'r 0.15s, stroke 0.15s' }}
                    />
                    {/* VIP ring */}
                    {def.isVip && (
                      <circle
                        cx={def.cx} cy={def.cy} r={def.r - 5}
                        fill="none" stroke={style.stroke + '50'} strokeWidth="1" strokeDasharray="3 3"
                      />
                    )}
                    {/* Número de mesa */}
                    <text
                      x={def.cx} y={def.cy + (def.isVip ? -4 : 1)}
                      textAnchor="middle" dominantBaseline="middle"
                      fill="white" fontSize={def.r > 30 ? '12' : '9'}
                      fontWeight="900" fontStyle="italic"
                    >
                      {def.mapId}
                    </text>
                    {/* Pax */}
                    {def.isVip && (
                      <text
                        x={def.cx} y={def.cy + 10}
                        textAnchor="middle" fill="rgba(255,255,255,0.4)"
                        fontSize="7" fontWeight="700"
                      >
                        {def.seats} PAX
                      </text>
                    )}
                    {/* Indicador de estado debajo del número */}
                    {status && (
                      <text
                        x={def.cx} y={def.cy + (def.r > 30 ? 16 : 13)}
                        textAnchor="middle" fill={style.stroke}
                        fontSize="5.5" fontWeight="800" letterSpacing="1"
                      >
                        {status === 'calling' ? '● LLAMA' : status === 'free' ? '● LIBRE' : status === 'reserved' ? '● RES' : '●'}
                      </text>
                    )}
                  </g>
                );
              })}

              {/* ── Tooltip en hover ── */}
              {hoveredId && (() => {
                const def = TABLE_DEFS.find(d => d.mapId === hoveredId)!;
                const db = tables.find(t => t.id === hoveredId);
                const status = db?.status;
                const style = status ? STATUS_COLORS[status] : NO_DB_STYLE;
                const tipX = def.cx > 700 ? def.cx - 100 : def.cx + def.r + 8;
                const tipY = def.cy - 22;
                return (
                  <g pointerEvents="none">
                    <rect x={tipX} y={tipY} width="95" height="44" rx="6"
                      fill="#111116" stroke="rgba(255,255,255,0.12)" strokeWidth="1" />
                    <text x={tipX + 8} y={tipY + 14} fill="white" fontSize="9" fontWeight="900" fontStyle="italic">
                      MESA {def.mapId}
                    </text>
                    <text x={tipX + 8} y={tipY + 25} fill="rgba(255,255,255,0.5)" fontSize="7" fontWeight="700">
                      {def.seats} PAX · {ZONES.find(z => z.id === def.zone)?.name}
                    </text>
                    <text x={tipX + 8} y={tipY + 37} fill={status ? style.stroke : '#6b7280'} fontSize="7" fontWeight="900" letterSpacing="1">
                      {status ? STATUS_COLORS[status as TableStatus].label : 'NO REGISTRADA'}
                    </text>
                  </g>
                );
              })()}
            </svg>
          </div>

          {/* ── Leyenda ── */}
          <div className="flex flex-wrap gap-4 justify-center">
            {Object.entries(STATUS_COLORS).map(([status, s]) => (
              <div key={status} className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full" style={{ background: s.stroke }} />
                <span className="text-[9px] font-black uppercase tracking-widest text-gray-400">{s.label}</span>
              </div>
            ))}
          </div>
        </>
      ) : (
        /* ── AGENDA ── */
        <div className="space-y-4">
          {dailyReservations.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-24 gap-4 text-gray-600">
              <CalendarDays size={48} />
              <p className="text-[11px] font-black uppercase tracking-widest">Sin reservas para hoy</p>
            </div>
          ) : dailyReservations.map(res => (
            <div key={res.id} className="bg-[#111114] p-6 rounded-3xl border border-white/5 flex justify-between items-center hover:border-white/10 transition-all">
              <div className="flex items-center gap-5">
                <div className="w-1.5 h-12 rounded-full bg-amber-500" />
                <div>
                  <h4 className="text-lg font-black italic uppercase">{res.customers?.name}</h4>
                  <p className="text-[9px] text-gray-500 font-bold uppercase tracking-widest mt-1">
                    {res.pax} PAX · {res.tables?.zone ?? '—'}
                  </p>
                </div>
              </div>
              <div className="text-right">
                <span className="text-2xl font-black italic text-blue-500">
                  {new Date(res.reservation_time).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })}
                </span>
                <p className="text-[9px] text-gray-600 font-bold uppercase tracking-widest mt-1">HOY</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Modal de mesa ── */}
      {selectedTable && (
        <TableModal
          def={selectedTable.def}
          db={selectedTable.db}
          onClose={() => setSelectedTable(null)}
          onOpen={handleOpenTable}
          onFree={handleFreeTable}
          openingId={openingId}
        />
      )}
    </div>
  );
};

// ─── Modal de mesa ─────────────────────────────────────────────────────────────
const TableModal: React.FC<{
  def: TableDef;
  db: DBTable | null;
  onClose: () => void;
  onOpen: (id: number) => void;
  onFree: (id: number) => void;
  openingId: number | null;
}> = ({ def, db, onClose, onOpen, onFree, openingId }) => {
  const zone = ZONES.find(z => z.id === def.zone)!;
  const status = db?.status ?? null;
  const style = status ? STATUS_COLORS[status] : null;

  const nextReservation = db?.reservations?.[0] ?? null;

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-6 animate-in fade-in duration-200">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-xl" onClick={onClose} />
      <div className="bg-[#0d0d10] border border-white/10 rounded-[3rem] w-full max-w-md relative z-10 overflow-hidden shadow-2xl">

        {/* Header con color de zona */}
        <div className="p-8 border-b border-white/5" style={{ background: `linear-gradient(135deg, ${zone.color}15, transparent)` }}>
          <div className="flex justify-between items-start">
            <div>
              <div className="text-[9px] font-black uppercase tracking-widest mb-2" style={{ color: zone.color }}>
                {zone.name}
              </div>
              <h3 className="text-5xl font-black italic">MESA {def.mapId}</h3>
              <p className="text-gray-500 text-[10px] font-black uppercase tracking-widest mt-2">
                {def.seats} PERSONAS · {def.isVip ? 'VIP' : def.isBar ? 'BAR' : 'STANDARD'}
              </p>
            </div>
            <div className="flex flex-col items-end gap-3">
              {style && (
                <div className="px-3 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest"
                  style={{ background: style.fill, color: style.stroke, border: `1px solid ${style.stroke}40` }}>
                  {style.label}
                </div>
              )}
              <button onClick={onClose} className="p-2 rounded-xl bg-white/5 hover:bg-white/10 transition-all">
                <X size={18} />
              </button>
            </div>
          </div>
        </div>

        {/* Próxima reserva */}
        {nextReservation && (
          <div className="mx-6 mt-5 p-4 rounded-2xl bg-amber-500/10 border border-amber-500/20">
            <p className="text-[9px] font-black uppercase tracking-widest text-amber-400 mb-1">PRÓXIMA RESERVA</p>
            <p className="font-black italic text-white text-sm">{nextReservation.customers?.name}</p>
            <p className="text-[10px] text-gray-400 mt-0.5">
              {new Date(nextReservation.reservation_time).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })}
              {' · '}{nextReservation.pax} pax
            </p>
          </div>
        )}

        {/* Acciones */}
        <div className="p-6 space-y-3">
          {(!status || status === 'free' || status === 'reserved') && (
            <button
              onClick={() => onOpen(def.mapId)}
              disabled={openingId === def.mapId}
              className="w-full py-5 rounded-[1.5rem] text-xs font-black uppercase tracking-widest text-white transition-all flex items-center justify-center gap-3"
              style={{ background: 'linear-gradient(135deg, #2563eb, #3b82f6)' }}
            >
              {openingId === def.mapId ? <Loader2 size={16} className="animate-spin" /> : <Users size={16} />}
              SENTAR CLIENTE
            </button>
          )}
          {(status === 'occupied' || status === 'seated' || status === 'calling') && (
            <button
              onClick={() => onFree(def.mapId)}
              disabled={openingId === def.mapId}
              className="w-full py-5 rounded-[1.5rem] text-xs font-black uppercase tracking-widest text-white transition-all flex items-center justify-center gap-3 bg-white/5 hover:bg-white/10 border border-white/10"
            >
              {openingId === def.mapId ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle2 size={16} />}
              LIBERAR MESA
            </button>
          )}
          {!db && (
            <div className="flex items-center gap-3 p-4 rounded-2xl bg-gray-800/30 border border-white/5">
              <AlertCircle size={16} className="text-gray-500" />
              <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">Mesa no registrada en BD</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// ─── Tab helper ───────────────────────────────────────────────────────────────
const TabBtn = ({ active, onClick, icon, label }: { active: boolean; onClick: () => void; icon: React.ReactNode; label: string }) => (
  <button
    onClick={onClick}
    className={`flex items-center gap-2 px-6 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${active ? 'bg-blue-600 text-white shadow-lg' : 'text-gray-500 hover:text-white'}`}
  >
    {icon} {label}
  </button>
);

export default ReserveModule;
