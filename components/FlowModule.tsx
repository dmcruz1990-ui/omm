import React, { useState, useEffect } from 'react';
import { Flame, Zap, Wine, Clock, CheckCircle2, Monitor, Droplets, Activity, BarChart3, IceCream, Utensils, Beef, Play, List } from 'lucide-react';
import { supabase } from '../lib/supabase.ts';

const Martini = ({ size = 14 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M8 22h8M12 11v11M3 3l9 9 9-9H3z"/>
  </svg>
);

type Station = 'ALL' | 'CALIENTE' | 'FRIA' | 'ENSALADAS' | 'POSTRES' | 'CHARCUTERIA' | 'BAR' | 'CAVA';
type MainTab = 'live' | 'historial';

interface FlowItem {
  id: string; order_id: string; status: 'pending' | 'preparing' | 'served';
  quantity: number; notes: string | null; nombre_plato?: string | null;
  created_at: string; updated_at: string; tiempo_inicio?: string | null;
  table_id: number | null; menu_name: string | null; category: string | null;
  mesero?: string | null; estacion?: string | null; cocinero?: string | null;
}

interface PedidoDia {
  id: string;
  mesa: number | null;
  plato: string | null;
  estacion: string;
  mesero: string | null;
  status: string;
  quantity: number;
  hora_pedido: string;
  hora_fmt: string;
  fecha_fmt: string;
  duracion_real_seg: number | null;
  tiempo_inicio: string | null;
  tiempo_listo: string | null;
}

const STATIONS = [
  { id: 'ALL',         label: 'GLOBAL',      icon: <Monitor size={13}/>,   color: '' },
  { id: 'CALIENTE',    label: 'CALIENTE',    icon: <Flame size={13}/>,     color: '#f97316' },
  { id: 'FRIA',        label: 'FRÍA',        icon: <Droplets size={13}/>,  color: '#60a5fa' },
  { id: 'ENSALADAS',   label: 'ENSALADAS',   icon: <Utensils size={13}/>,  color: '#4ade80' },
  { id: 'POSTRES',     label: 'POSTRES',     icon: <IceCream size={13}/>,  color: '#f472b6' },
  { id: 'CHARCUTERIA', label: 'CHARCUTERÍA', icon: <Beef size={13}/>,      color: '#d97706' },
  { id: 'BAR',         label: 'BAR',         icon: <Martini size={13}/>,   color: '#a78bfa' },
  { id: 'CAVA',        label: 'CAVA',        icon: <Wine size={13}/>,      color: '#f87171' },
] as const;

const ESTACION_COLOR: Record<string, string> = {
  'CALIENTE': '#f97316', 'FRIA': '#60a5fa', 'ENSALADAS': '#4ade80',
  'POSTRES': '#f472b6', 'BAR': '#a78bfa', 'CAVA': '#f87171',
  'CHARCUTERIA': '#d97706', 'Cocina': '#f97316', 'Bar': '#a78bfa',
};

const inferStation = (text: string): Station => {
  const t = text.toUpperCase();
  if (t.includes('ROBATA') || t.includes('WOK') || t.includes('CALIENTE') || t.includes('COMPARTIR') || t.includes('SHITAKE') || t.includes('GYOSA') || t.includes('DUMPLING') || t.includes('BAO') || t.includes('DIM SUM') || t.includes('CEVICHE') || t.includes('TORI') || t.includes('TON KATSU') || t.includes('CAMARÓN') || t.includes('CAMARONES')) return 'CALIENTE';
  if (t.includes('MAKI') || t.includes('SUSHI') || t.includes('NIGIRI') || t.includes('SASHIMI') || t.includes('TEMAKI') || t.includes('GEISHA') || t.includes('TIRADITO') || t.includes('FRIA')) return 'FRIA';
  if (t.includes('ENSALADA')) return 'ENSALADAS';
  if (t.includes('POSTRE') || t.includes('KOUJUN') || t.includes('CHEESECAKE') || t.includes('YOROKOBI') || t.includes('KYOTO')) return 'POSTRES';
  if (t.includes('CHARCUTERIA') || t.includes('TABLA')) return 'CHARCUTERIA';
  if (t.includes('COCTEL') || t.includes('SAKE') || t.includes('CERVEZA') || t.includes('JUGO') || t.includes('CAFÉ') || t.includes('CAFE') || t.includes('LIMONADA') || t.includes('AMERICANO') || t.includes('ESPRESSO') || t.includes('LATTE') || t.includes('HEINEKEN') || t.includes('CORONA') || t.includes('STELLA')) return 'BAR';
  if (t.includes('VINO') || t.includes('CAVA') || t.includes('COPA')) return 'CAVA';
  return 'CALIENTE';
};

const fmtDuracion = (seg: number | null) => {
  if (!seg) return '—';
  if (seg < 60) return `${seg}s`;
  return `${Math.floor(seg/60)}m ${seg%60}s`;
};

const STATUS_CFG: Record<string, {c:string;label:string}> = {
  pending:    { c:'#ef4444', label:'Pendiente' },
  preparing:  { c:'#3b82f6', label:'Preparando' },
  served:     { c:'#22c55e', label:'Servido' },
  cancelled:  { c:'#6b7280', label:'Cancelado' },
};

export default function FlowModule() {
  const [mainTab, setMainTab] = useState<MainTab>('live');
  const [activeStation, setActiveStation] = useState<Station>('ALL');
  const [items, setItems] = useState<FlowItem[]>([]);
  const [pedidosDia, setPedidosDia] = useState<PedidoDia[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingHistorial, setLoadingHistorial] = useState(false);
  const [now, setNow] = useState(Date.now());
  // Filtros historial
  const [filtroEstacion, setFiltroEstacion] = useState('TODAS');
  const [filtroMesero, setFiltroMesero] = useState('');
  const [filtroStatus, setFiltroStatus] = useState('TODOS');

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const fetchFlowData = async () => {
    try {
      const { data: orders } = await supabase
        .from('orders').select('id,table_id').eq('status','open');
      if (!orders?.length) { setItems([]); setLoading(false); return; }

      const { data: ois } = await supabase
        .from('order_items')
        .select('id,order_id,status,quantity,notes,nombre_plato,created_at,updated_at,tiempo_inicio,mesero,estacion,cocinero,precio_unitario:price_at_time')
        .in('order_id', orders.map(o => o.id))
        .neq('status','cancelled')
        .order('created_at', { ascending: false });

      if (!ois) { setLoading(false); return; }

      const enriched = ois.map((oi: any) => ({
        ...oi,
        table_id: orders.find(o => o.id === oi.order_id)?.table_id ?? null,
        menu_name: null, category: null,
      }));
      setItems(enriched);
    } catch(e) { console.warn('FlowModule fetch error:', e); }
    setLoading(false);
  };

  const fetchPedidosDia = async () => {
    setLoadingHistorial(true);
    try {
      const { data } = await supabase
        .from('vista_pedidos_dia')
        .select('*')
        .order('hora_pedido', { ascending: false });
      if (data) setPedidosDia(data as PedidoDia[]);
    } catch(e) { console.warn('Historial error:', e); }
    setLoadingHistorial(false);
  };

  useEffect(() => {
    fetchFlowData();
    const ch = supabase.channel('flow-v4')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'order_items' }, fetchFlowData)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, fetchFlowData)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);

  useEffect(() => {
    if (mainTab === 'historial') fetchPedidosDia();
  }, [mainTab]);

  const updateStatus = async (id: string, status: string) => {
    const now_ts = new Date().toISOString();
    const updates: any = { status, updated_at: now_ts };
    if (status === 'preparing') updates.tiempo_inicio = now_ts;
    if (status === 'served') {
      updates.tiempo_listo = now_ts;
      // Calcular duración real
      const item = items.find(i => i.id === id);
      if (item?.updated_at && status === 'served') {
        const startTime = item.tiempo_inicio || item.updated_at;
        const dur = Math.floor((new Date(now_ts).getTime() - new Date(startTime).getTime()) / 1000);
        updates.duracion_seg = dur > 0 ? dur : null;
      }
    }
    await supabase.from('order_items').update(updates).eq('id', id);
    
    // Cuando listo → insertar alerta en flow_alertas para el POS
    if (status === 'served') {
      const item = items.find(i => i.id === id);
      if (item) {
        await supabase.from('flow_alertas').insert({
          restaurante_id: 6,
          mesa_num: item.table_id,
          plato: getNombre(item),
          mesero: item.mesero || null,
          cocinero: item.cocinero || null,
          estacion: item.estacion || getStation(item),
          leida: false,
        });
      }
      fetchPedidosDia();
    }
  };

  const getNombre = (item: FlowItem) => item.nombre_plato ?? item.menu_name ?? item.notes ?? 'Plato';
  const getStation = (item: FlowItem): Station => inferStation(item.estacion ?? item.category ?? item.menu_name ?? item.notes ?? '');
  const filtered = activeStation === 'ALL' ? items : items.filter(i => getStation(i) === activeStation);
  const count = (s: Station) => s === 'ALL' ? items.length : items.filter(i => getStation(i) === s).length;

  // Filtrar historial
  const pedidosFiltrados = pedidosDia.filter(p => {
    if (filtroEstacion !== 'TODAS' && p.estacion !== filtroEstacion) return false;
    if (filtroMesero && !p.mesero?.toLowerCase().includes(filtroMesero.toLowerCase())) return false;
    if (filtroStatus !== 'TODOS' && p.status !== filtroStatus) return false;
    return true;
  });

  // Stats del historial
  const totalDia = pedidosDia.length;
  const servidos = pedidosDia.filter(p => p.status === 'served').length;
  const tiempoPromedio = (() => {
    const conTiempo = pedidosDia.filter(p => p.duracion_real_seg);
    if (!conTiempo.length) return null;
    return Math.round(conTiempo.reduce((a,p) => a + (p.duracion_real_seg||0), 0) / conTiempo.length);
  })();
  const meseros = [...new Set(pedidosDia.map(p => p.mesero).filter(Boolean))];
  const estaciones = [...new Set(pedidosDia.map(p => p.estacion).filter(Boolean))];

  return (
    <div style={{ height:'100%', display:'flex', flexDirection:'column', background:'#0a0a0c', color:'#fff', overflow:'hidden' }}>

      {/* Header */}
      <div style={{ padding:'14px 20px 0', borderBottom:'1px solid rgba(255,255,255,.06)', flexShrink:0 }}>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:14 }}>
          <div style={{ display:'flex', alignItems:'center', gap:12 }}>
            <div style={{ width:44, height:44, background:'#2563eb', borderRadius:'1rem', display:'flex', alignItems:'center', justifyContent:'center' }}>
              <Activity size={22} color="#fff" />
            </div>
            <div>
              <div style={{ fontWeight:900, fontSize:18, fontStyle:'italic', textTransform:'uppercase', letterSpacing:'-0.03em' }}>Command Flow</div>
              <div style={{ fontSize:10, color:'#6b7280', textTransform:'uppercase', letterSpacing:'0.25em' }}>Orquestación Multizona · OMM</div>
            </div>
          </div>
          {/* Tabs principales */}
          <div style={{ display:'flex', gap:4, background:'#111114', padding:4, borderRadius:'1rem', border:'1px solid rgba(255,255,255,.06)' }}>
            <button onClick={() => setMainTab('live')}
              style={{ display:'flex', alignItems:'center', gap:6, padding:'6px 16px', borderRadius:'0.75rem', fontSize:11, fontWeight:700, textTransform:'uppercase', border:'none', cursor:'pointer', background: mainTab==='live' ? '#fff' : 'transparent', color: mainTab==='live' ? '#000' : '#6b7280', transition:'all .2s' }}>
              <Activity size={12}/> En vivo
            </button>
            <button onClick={() => setMainTab('historial')}
              style={{ display:'flex', alignItems:'center', gap:6, padding:'6px 16px', borderRadius:'0.75rem', fontSize:11, fontWeight:700, textTransform:'uppercase', border:'none', cursor:'pointer', background: mainTab==='historial' ? '#fff' : 'transparent', color: mainTab==='historial' ? '#000' : '#6b7280', transition:'all .2s' }}>
              <List size={12}/> Pedidos del día
              {totalDia > 0 && <span style={{ background: mainTab==='historial'?'#000':'rgba(255,255,255,.1)', color: mainTab==='historial'?'#fff':'#9ca3af', padding:'1px 6px', borderRadius:9999, fontSize:9 }}>{totalDia}</span>}
            </button>
          </div>
        </div>

        {/* Sub-tabs estaciones (solo en live) */}
        {mainTab === 'live' && (
          <div style={{ display:'flex', flexWrap:'wrap', gap:3, background:'#111114', padding:5, borderRadius:'2rem', border:'1px solid rgba(255,255,255,.05)', marginBottom:0 }}>
            {STATIONS.map(({ id, label, icon, color }) => {
              const c = count(id as Station);
              const active = activeStation === id;
              return (
                <button key={id} onClick={() => setActiveStation(id as Station)}
                  style={{ display:'flex', alignItems:'center', gap:5, padding:'5px 11px', borderRadius:'9999px', fontSize:10, fontWeight:700, textTransform:'uppercase', border:'none', cursor:'pointer', transition:'all .2s', background: active ? '#fff' : 'transparent', color: active ? '#000' : color || '#6b7280' }}>
                  {icon} {label}
                  {c > 0 && <span style={{ padding:'1px 5px', borderRadius:'9999px', fontSize:9, background: active ? '#000' : 'rgba(255,255,255,.07)', color: active ? '#fff' : '#6b7280' }}>{c}</span>}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* ══ LIVE ══ */}
      {mainTab === 'live' && (
        <div style={{ flex:1, display:'grid', gridTemplateColumns:'1fr 190px', overflow:'hidden' }}>
          <div style={{ padding:14, overflowY:'auto' }}>
            {loading && (
              <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(260px,1fr))', gap:12 }}>
                {[1,2,3].map(i => <div key={i} style={{ background:'#111114', borderRadius:'2rem', height:180, opacity:.4 }}/>)}
              </div>
            )}
            {!loading && filtered.length === 0 && (
              <div style={{ display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', height:'50vh', opacity:.15 }}>
                <Zap size={64} color="#3b82f6" style={{ marginBottom:16 }}/>
                <div style={{ fontSize:24, fontWeight:900, fontStyle:'italic', textTransform:'uppercase' }}>Estación Despejada</div>
                <div style={{ fontSize:13, color:'#6b7280', marginTop:10 }}>No hay pedidos en {activeStation}</div>
              </div>
            )}
            {!loading && filtered.length > 0 && (
              <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(260px,1fr))', gap:12 }}>
                {filtered.map(item => {
                  const isPreparing = item.status === 'preparing';
                  const diff = Math.floor((now - new Date(isPreparing ? item.updated_at : item.created_at).getTime()) / 1000);
                  const mins = Math.floor(diff / 60), secs = diff % 60;
                  const isAlert = mins >= (getStation(item) === 'CALIENTE' ? 12 : 8);
                  const stationLabel = item.estacion || getStation(item);
                  return (
                    <div key={item.id} style={{ background:'#111114', border:`2px solid ${isAlert?'#dc2626':isPreparing?'rgba(59,130,246,.4)':'rgba(255,255,255,.05)'}`, borderRadius:'2.5rem', overflow:'hidden', display:'flex', flexDirection:'column' }}>
                      <div style={{ padding:'14px 18px', borderBottom:'1px solid rgba(255,255,255,.05)', background: isAlert ? 'rgba(220,38,38,.08)' : 'rgba(255,255,255,.02)', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                        <div style={{ display:'flex', alignItems:'center', gap:7 }}>
                          <span style={{ background:'rgba(255,255,255,.05)', padding:'2px 9px', borderRadius:8, fontWeight:900, fontStyle:'italic', fontSize:13, color:'#3b82f6' }}>M{item.table_id ?? '?'}</span>
                          <span style={{ fontSize:9, color: ESTACION_COLOR[stationLabel] || '#4b5563', textTransform:'uppercase', fontWeight:700 }}>{stationLabel}</span>
                          {item.mesero && <span style={{ fontSize:9, color:'#6b7280', background:'rgba(255,255,255,.05)', padding:'2px 6px', borderRadius:20 }}>👤 {item.mesero}</span>}
                          {item.cocinero && <span style={{ fontSize:9, color: ESTACION_COLOR[getStation(item)] || '#9ca3af', background:'rgba(255,255,255,.04)', padding:'2px 6px', borderRadius:20 }}>👨‍🍳 {item.cocinero.split(' ').slice(-2).join(' ')}</span>}
                        </div>
                        <div style={{ display:'flex', alignItems:'center', gap:4, fontFamily:'monospace', fontSize:12, fontWeight:900, color: isAlert ? '#ef4444' : isPreparing ? '#60a5fa' : '#6b7280' }}>
                          <Clock size={11}/> {mins}:{secs.toString().padStart(2,'0')}
                        </div>
                      </div>
                      <div style={{ padding:'16px 18px 10px', flex:1 }}>
                        <div style={{ fontSize:16, fontWeight:900, fontStyle:'italic', textTransform:'uppercase', color:'#fff', marginBottom:5 }}>
                          {item.quantity}x {getNombre(item)}
                        </div>
                        {/* Hora real del pedido */}
                        <div style={{ fontSize:10, color:'#4b5563', display:'flex', alignItems:'center', gap:6, flexWrap:'wrap' }}>
                          <span style={{ display:'flex', alignItems:'center', gap:3 }}>
                            <Clock size={9}/> Pedido: {new Date(item.created_at).toLocaleTimeString('es-CO', { hour:'2-digit', minute:'2-digit', hour12:true })}
                          </span>
                          {item.tiempo_inicio && (
                            <span style={{ display:'flex', alignItems:'center', gap:3, color: isPreparing ? '#f59e0b' : '#6b7280' }}>
                              🍳 Prod: {Math.floor((now - new Date(item.tiempo_inicio).getTime())/60000)}m {Math.floor(((now - new Date(item.tiempo_inicio).getTime())%60000)/1000)}s
                            </span>
                          )}
                          <span style={{ marginLeft:'auto', color: isPreparing ? '#60a5fa' : item.status==='served'?'#22c55e':'#374151', fontWeight:700, fontSize:9, textTransform:'uppercase' }}>{item.status==='pending'?'⏳ Pendiente':item.status==='preparing'?'🔥 Prep.':'✅ Listo'}</span>
                        </div>
                      </div>
                      <div style={{ padding:'0 14px 14px', display:'flex', gap:6 }}>
                        {!isPreparing
                          ? <button onClick={() => updateStatus(item.id,'preparing')} style={{ flex:1, padding:'11px', borderRadius:13, background:'#fff', color:'#000', border:'none', fontSize:10, fontWeight:900, textTransform:'uppercase', letterSpacing:'0.07em', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', gap:5 }}>
                              <Play size={11}/> Comenzar
                            </button>
                          : <button onClick={() => updateStatus(item.id,'served')} style={{ flex:1, padding:'11px', borderRadius:13, background:'rgba(59,130,246,.15)', color:'#60a5fa', border:'1px solid rgba(59,130,246,.3)', fontSize:10, fontWeight:900, textTransform:'uppercase', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', gap:5 }}>
                              <CheckCircle2 size={11}/> Listo
                            </button>
                        }
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Sidebar */}
          <div style={{ borderLeft:'1px solid rgba(255,255,255,.05)', padding:'14px 12px', display:'flex', flexDirection:'column', gap:12, overflowY:'auto' }}>
            <div style={{ background:'#111114', border:'1px solid rgba(255,255,255,.05)', padding:14, borderRadius:'1.5rem' }}>
              <div style={{ fontSize:10, fontWeight:700, color:'#6b7280', textTransform:'uppercase', letterSpacing:'0.08em', display:'flex', alignItems:'center', gap:5, marginBottom:14 }}>
                <BarChart3 size={12} color="#3b82f6"/> Live
              </div>
              {[
                { label:'Activos',    value:items.length },
                { label:'En fuego',   value:items.filter(i=>i.status==='preparing').length, color:'#f59e0b' },
                { label:'Pendientes', value:items.filter(i=>i.status==='pending').length },
              ].map(m => (
                <div key={m.label} style={{ display:'flex', justifyContent:'space-between', borderBottom:'1px solid rgba(255,255,255,.05)', paddingBottom:8, marginBottom:8 }}>
                  <span style={{ fontSize:10, color:'#6b7280', fontWeight:700, textTransform:'uppercase' }}>{m.label}</span>
                  <span style={{ fontSize:17, fontWeight:900, fontStyle:'italic', color: m.color ?? '#fff' }}>{m.value}</span>
                </div>
              ))}
            </div>
            <div style={{ background:'linear-gradient(135deg,rgba(37,99,235,.15),transparent)', padding:14, borderRadius:'1.5rem', border:'1px solid rgba(37,99,235,.1)' }}>
              <div style={{ display:'flex', alignItems:'center', gap:7, marginBottom:8 }}>
                <Zap size={14} color="#3b82f6" fill="#3b82f6"/>
                <span style={{ fontSize:10, fontWeight:700, color:'#fff', textTransform:'uppercase', letterSpacing:'0.07em', fontStyle:'italic' }}>Nexum IA</span>
              </div>
              <p style={{ fontSize:12, color:'#9ca3af', fontStyle:'italic', lineHeight:1.6, margin:0 }}>
                {items.filter(i=>i.status==='pending').length > 5
                  ? `Alta demanda — ${items.filter(i=>i.status==='pending').length} pedidos pendientes.`
                  : items.length === 0 ? 'Cocina despejada.'
                  : `${items.filter(i=>i.status==='preparing').length} en preparación.`}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ══ PEDIDOS DEL DÍA ══ */}
      {mainTab === 'historial' && (
        <div style={{ flex:1, display:'flex', flexDirection:'column', overflow:'hidden' }}>

          {/* KPIs del día */}
          <div style={{ display:'flex', gap:0, borderBottom:'1px solid rgba(255,255,255,.06)', flexShrink:0 }}>
            {[
              { l:'Total pedidos', v:totalDia,                           c:'#3b82f6' },
              { l:'Servidos',      v:servidos,                           c:'#22c55e' },
              { l:'Pendientes',    v:totalDia-servidos,                  c:'#f59e0b' },
              { l:'Tiempo prom',   v:tiempoPromedio ? fmtDuracion(tiempoPromedio) : '—', c:'#a78bfa' },
              { l:'Meseros activos',v:meseros.length,                    c:'#60a5fa' },
            ].map((k,i) => (
              <div key={k.l} style={{ flex:1, padding:'10px 14px', borderRight:i<4?'1px solid rgba(255,255,255,.06)':'none' }}>
                <div style={{ fontSize:9, color:'#6b7280', textTransform:'uppercase', letterSpacing:'.08em', marginBottom:3 }}>{k.l}</div>
                <div style={{ fontFamily:"'Syne',sans-serif", fontSize:20, fontWeight:900, color:k.c }}>{k.v}</div>
              </div>
            ))}
          </div>

          {/* Filtros */}
          <div style={{ display:'flex', gap:8, padding:'10px 16px', borderBottom:'1px solid rgba(255,255,255,.06)', flexShrink:0, flexWrap:'wrap', alignItems:'center' }}>
            <div style={{ fontSize:10, color:'#6b7280', fontWeight:700, textTransform:'uppercase' }}>Filtrar:</div>
            {/* Estación */}
            <select value={filtroEstacion} onChange={e=>setFiltroEstacion(e.target.value)}
              style={{ background:'#111114', border:'1px solid rgba(255,255,255,.1)', borderRadius:8, padding:'5px 10px', color:'#fff', fontSize:11, cursor:'pointer', outline:'none' }}>
              <option value="TODAS">Todas estaciones</option>
              {estaciones.map(e=><option key={e} value={e}>{e}</option>)}
            </select>
            {/* Status */}
            <select value={filtroStatus} onChange={e=>setFiltroStatus(e.target.value)}
              style={{ background:'#111114', border:'1px solid rgba(255,255,255,.1)', borderRadius:8, padding:'5px 10px', color:'#fff', fontSize:11, cursor:'pointer', outline:'none' }}>
              <option value="TODOS">Todos los estados</option>
              <option value="pending">Pendiente</option>
              <option value="preparing">Preparando</option>
              <option value="served">Servido</option>
            </select>
            {/* Mesero */}
            <select value={filtroMesero} onChange={e=>setFiltroMesero(e.target.value)}
              style={{ background:'#111114', border:'1px solid rgba(255,255,255,.1)', borderRadius:8, padding:'5px 10px', color:'#fff', fontSize:11, cursor:'pointer', outline:'none' }}>
              <option value="">Todos los meseros</option>
              {meseros.map(m=><option key={m} value={m!}>{m}</option>)}
            </select>
            <button onClick={fetchPedidosDia}
              style={{ marginLeft:'auto', background:'rgba(37,99,235,.2)', border:'1px solid rgba(37,99,235,.4)', color:'#60a5fa', padding:'5px 14px', borderRadius:8, fontSize:11, fontWeight:700, cursor:'pointer' }}>
              ↻ Actualizar
            </button>
            <span style={{ fontSize:10, color:'#4b5563' }}>{pedidosFiltrados.length} registros</span>
          </div>

          {/* Tabla de pedidos */}
          <div style={{ flex:1, overflowY:'auto' }}>
            {loadingHistorial && (
              <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'40vh', color:'#6b7280', fontSize:14 }}>
                Cargando pedidos del día...
              </div>
            )}
            {!loadingHistorial && pedidosFiltrados.length === 0 && (
              <div style={{ display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', height:'40vh', opacity:.2 }}>
                <List size={48} color="#6b7280" style={{ marginBottom:12 }}/>
                <div style={{ fontSize:18, fontWeight:700, fontStyle:'italic', textTransform:'uppercase' }}>Sin pedidos registrados</div>
              </div>
            )}
            {!loadingHistorial && pedidosFiltrados.length > 0 && (
              <table style={{ width:'100%', borderCollapse:'collapse', fontSize:12 }}>
                <thead style={{ position:'sticky', top:0, background:'#0f0f12', zIndex:10 }}>
                  <tr>
                    {['Hora', 'Fecha', 'Mesa', 'Plato', 'Cant.', 'Estación', 'Mesero', 'Estado', 'Inicio prep.', 'Listo', 'Duración'].map(h=>(
                      <th key={h} style={{ padding:'10px 12px', textAlign:'left', fontSize:9, color:'#6b7280', fontWeight:700, textTransform:'uppercase', letterSpacing:'.08em', borderBottom:'1px solid rgba(255,255,255,.06)', whiteSpace:'nowrap' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {pedidosFiltrados.map((p,i)=>{
                    const sc = STATUS_CFG[p.status] || STATUS_CFG.pending;
                    const ec = ESTACION_COLOR[p.estacion] || '#6b7280';
                    return (
                      <tr key={p.id} style={{ background:i%2===0?'#0a0a0c':'#111114', borderBottom:'1px solid rgba(255,255,255,.03)' }}
                        onMouseEnter={e=>(e.currentTarget as HTMLTableRowElement).style.background='rgba(37,99,235,.08)'}
                        onMouseLeave={e=>(e.currentTarget as HTMLTableRowElement).style.background=i%2===0?'#0a0a0c':'#111114'}>
                        {/* Hora */}
                        <td style={{ padding:'9px 12px', fontFamily:'monospace', fontWeight:700, color:'#3b82f6', whiteSpace:'nowrap' }}>
                          {p.hora_fmt}
                        </td>
                        {/* Fecha */}
                        <td style={{ padding:'9px 12px', color:'#6b7280', fontSize:11, whiteSpace:'nowrap' }}>
                          {p.fecha_fmt}
                        </td>
                        {/* Mesa */}
                        <td style={{ padding:'9px 12px' }}>
                          <span style={{ background:'rgba(37,99,235,.15)', color:'#60a5fa', padding:'2px 8px', borderRadius:6, fontWeight:900, fontSize:11 }}>
                            M{p.mesa ?? '?'}
                          </span>
                        </td>
                        {/* Plato */}
                        <td style={{ padding:'9px 12px', fontWeight:700, color:'#f0f0f0', maxWidth:200, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                          {p.plato || '—'}
                        </td>
                        {/* Cantidad */}
                        <td style={{ padding:'9px 12px', textAlign:'center', fontWeight:900, color:'#fff' }}>
                          {p.quantity}
                        </td>
                        {/* Estación */}
                        <td style={{ padding:'9px 12px' }}>
                          <span style={{ background:`${ec}20`, color:ec, padding:'2px 8px', borderRadius:20, fontSize:10, fontWeight:700 }}>
                            {p.estacion}
                          </span>
                        </td>
                        {/* Mesero */}
                        <td style={{ padding:'9px 12px', color:'#9ca3af', fontSize:11 }}>
                          {p.mesero || <span style={{ color:'#374151' }}>—</span>}
                        </td>
                        {/* Estado */}
                        <td style={{ padding:'9px 12px' }}>
                          <span style={{ background:`${sc.c}20`, color:sc.c, border:`1px solid ${sc.c}40`, padding:'2px 10px', borderRadius:20, fontSize:10, fontWeight:700 }}>
                            {sc.label}
                          </span>
                        </td>
                        {/* Inicio prep */}
                        <td style={{ padding:'9px 12px', color:'#6b7280', fontSize:11, fontFamily:'monospace', whiteSpace:'nowrap' }}>
                          {p.tiempo_inicio
                            ? new Date(p.tiempo_inicio).toLocaleTimeString('es-CO',{hour:'2-digit',minute:'2-digit',second:'2-digit',hour12:true})
                            : <span style={{color:'#374151'}}>—</span>}
                        </td>
                        {/* Listo */}
                        <td style={{ padding:'9px 12px', color:'#22c55e', fontSize:11, fontFamily:'monospace', whiteSpace:'nowrap' }}>
                          {p.tiempo_listo
                            ? new Date(p.tiempo_listo).toLocaleTimeString('es-CO',{hour:'2-digit',minute:'2-digit',second:'2-digit',hour12:true})
                            : <span style={{color:'#374151'}}>—</span>}
                        </td>
                        {/* Duración */}
                        <td style={{ padding:'9px 12px', fontFamily:'monospace', fontWeight:700, color: p.duracion_real_seg ? (p.duracion_real_seg > 720 ? '#ef4444' : p.duracion_real_seg > 480 ? '#f59e0b' : '#22c55e') : '#374151' }}>
                          {fmtDuracion(p.duracion_real_seg)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
