import React, { useState, useEffect } from 'react';
import { Flame, Zap, Wine, Clock, CheckCircle2, Monitor, Droplets, Activity, BarChart3, IceCream, Utensils, Beef, Play } from 'lucide-react';
import { supabase } from '../lib/supabase.ts';

const Martini = ({ size = 14 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M8 22h8M12 11v11M3 3l9 9 9-9H3z"/>
  </svg>
);

type Station = 'ALL' | 'CALIENTE' | 'FRIA' | 'ENSALADAS' | 'POSTRES' | 'CHARCUTERIA' | 'BAR' | 'CAVA';

interface FlowItem {
  id: string; order_id: string; status: 'pending' | 'preparing' | 'served';
  quantity: number; notes: string | null; created_at: string; updated_at: string;
  table_id: number | null; menu_name: string | null; category: string | null;
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

const inferStation = (text: string): Station => {
  const t = text.toUpperCase();
  if (t.includes('ROBATA') || t.includes('WOK') || t.includes('CALIENTE') || t.includes('COMPARTIR') || t.includes('SHITAKE') || t.includes('GYOSA') || t.includes('DUMPLING') || t.includes('BAO') || t.includes('DIM SUM') || t.includes('CEVICHE') || t.includes('TORI') || t.includes('TON KATSU') || t.includes('CAMARÓN') || t.includes('CAMARONES')) return 'CALIENTE';
  if (t.includes('MAKI') || t.includes('SUSHI') || t.includes('NIGIRI') || t.includes('SASHIMI') || t.includes('TEMAKI') || t.includes('GEISHA') || t.includes('TIRADITO') || t.includes('FRIA')) return 'FRIA';
  if (t.includes('ENSALADA')) return 'ENSALADAS';
  if (t.includes('POSTRE') || t.includes('KOUJUN') || t.includes('CHEESECAKE') || t.includes('YOROKOBI') || t.includes('KYOTO')) return 'POSTRES';
  if (t.includes('CHARCUTERIA') || t.includes('TABLA')) return 'CHARCUTERIA';
  if (t.includes('COCTEL') || t.includes('SAKE') || t.includes('CERVEZA') || t.includes('JUGO') || t.includes('CAFÉ') || t.includes('CAFE') || t.includes('TEQUILA') || t.includes('LIMONADA') || t.includes('AMERICANO') || t.includes('ESPRESSO') || t.includes('LATTE') || t.includes('HEINEKEN') || t.includes('CORONA') || t.includes('STELLA')) return 'BAR';
  if (t.includes('VINO') || t.includes('CAVA') || t.includes('COPA')) return 'CAVA';
  return 'CALIENTE';
};

export default function FlowModule() {
  const [activeStation, setActiveStation] = useState<Station>('ALL');
  const [items, setItems] = useState<FlowItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const fetchFlowData = async () => {
    try {
      // Paso 1: órdenes abiertas
      const { data: orders } = await supabase
        .from('orders').select('id, table_id').eq('status', 'open');
      if (!orders || orders.length === 0) { setItems([]); setLoading(false); return; }

      const orderIds = orders.map((o: any) => o.id);
      const tableMap: Record<string, number> = {};
      orders.forEach((o: any) => { tableMap[o.id] = o.table_id; });

      // Paso 2: items sin served — SIN join a menu_items
      const { data: raw } = await supabase
        .from('order_items')
        .select('id, order_id, status, quantity, notes, created_at, updated_at, menu_item_id')
        .in('order_id', orderIds)
        .neq('status', 'served')
        .order('created_at', { ascending: true });

      if (!raw) { setLoading(false); return; }

      // Paso 3: buscar nombres en menu_items para los que tienen menu_item_id
      const menuIds = [...new Set(raw.filter((i: any) => i.menu_item_id).map((i: any) => i.menu_item_id))];
      let menuMap: Record<string, { name: string; category: string }> = {};

      if (menuIds.length > 0) {
        const { data: menuItems } = await supabase
          .from('menu_items').select('id, name, category').in('id', menuIds);
        if (menuItems) {
          menuItems.forEach((m: any) => { menuMap[m.id] = { name: m.name, category: m.category }; });
        }
      }

      const enriched: FlowItem[] = raw.map((i: any) => ({
        id: i.id, order_id: i.order_id, status: i.status,
        quantity: i.quantity, notes: i.notes,
        created_at: i.created_at, updated_at: i.updated_at,
        table_id: tableMap[i.order_id] ?? null,
        menu_name: menuMap[i.menu_item_id]?.name ?? null,
        category: menuMap[i.menu_item_id]?.category ?? null,
      }));

      setItems(enriched);
    } catch (e) {
      console.error('Flow error:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFlowData();
    const ch = supabase.channel('flow-v4')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'order_items' }, fetchFlowData)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, fetchFlowData)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);

  const updateStatus = async (id: string, status: string) => {
    await supabase.from('order_items').update({ status, updated_at: new Date().toISOString() }).eq('id', id);
  };

  const getNombre = (item: FlowItem) => item.menu_name ?? item.notes ?? 'Plato';
  const getStation = (item: FlowItem): Station => inferStation(item.category ?? item.menu_name ?? item.notes ?? '');
  const filtered = activeStation === 'ALL' ? items : items.filter(i => getStation(i) === activeStation);
  const count = (s: Station) => s === 'ALL' ? items.length : items.filter(i => getStation(i) === s).length;

  return (
    <div style={{ height:'100%', display:'flex', flexDirection:'column', background:'#0a0a0c', color:'#fff', overflow:'hidden' }}>

      {/* Header + tabs */}
      <div style={{ padding:'14px 20px', borderBottom:'1px solid rgba(255,255,255,.06)', flexShrink:0 }}>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', flexWrap:'wrap', gap:10 }}>
          <div style={{ display:'flex', alignItems:'center', gap:12 }}>
            <div style={{ width:44, height:44, background:'#2563eb', borderRadius:'1rem', display:'flex', alignItems:'center', justifyContent:'center' }}>
              <Activity size={22} color="#fff" />
            </div>
            <div>
              <div style={{ fontWeight:900, fontSize:18, fontStyle:'italic', textTransform:'uppercase', letterSpacing:'-0.03em' }}>Command Flow</div>
              <div style={{ fontSize:10, color:'#6b7280', textTransform:'uppercase', letterSpacing:'0.25em' }}>Orquestación Multizona OMM</div>
            </div>
          </div>
          <div style={{ display:'flex', flexWrap:'wrap', gap:3, background:'#111114', padding:5, borderRadius:'2rem', border:'1px solid rgba(255,255,255,.05)' }}>
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
        </div>
      </div>

      {/* Contenido */}
      <div style={{ flex:1, display:'grid', gridTemplateColumns:'1fr 190px', overflow:'hidden' }}>

        {/* Grid */}
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
                return (
                  <div key={item.id} style={{ background:'#111114', border:`2px solid ${isAlert?'#dc2626':isPreparing?'rgba(59,130,246,.4)':'rgba(255,255,255,.05)'}`, borderRadius:'2.5rem', overflow:'hidden', display:'flex', flexDirection:'column' }}>
                    <div style={{ padding:'14px 18px', borderBottom:'1px solid rgba(255,255,255,.05)', background: isAlert ? 'rgba(220,38,38,.08)' : 'rgba(255,255,255,.02)', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                      <div style={{ display:'flex', alignItems:'center', gap:7 }}>
                        <span style={{ background:'rgba(255,255,255,.05)', padding:'2px 9px', borderRadius:8, fontWeight:900, fontStyle:'italic', fontSize:13, color:'#3b82f6' }}>M{item.table_id ?? '?'}</span>
                        <span style={{ fontSize:9, color:'#4b5563', textTransform:'uppercase', fontWeight:700 }}>{getStation(item)}</span>
                        {!item.menu_name && <span style={{ fontSize:9, color:'#f97316', background:'rgba(249,115,22,.1)', padding:'2px 6px', borderRadius:20, fontWeight:700 }}>POS</span>}
                      </div>
                      <div style={{ display:'flex', alignItems:'center', gap:4, fontFamily:'monospace', fontSize:12, fontWeight:900, color: isAlert ? '#ef4444' : isPreparing ? '#60a5fa' : '#6b7280' }}>
                        <Clock size={11}/> {mins}:{secs.toString().padStart(2,'0')}
                      </div>
                    </div>
                    <div style={{ padding:'16px 18px 10px', flex:1 }}>
                      <div style={{ fontSize:16, fontWeight:900, fontStyle:'italic', textTransform:'uppercase', color:'#fff', marginBottom:5 }}>
                        {item.quantity}x {getNombre(item)}
                      </div>
                      <div style={{ fontSize:10, color:'#4b5563', textTransform:'uppercase', display:'flex', alignItems:'center', gap:5 }}>
                        {item.category ?? getStation(item)}
                        <span style={{ width:3, height:3, borderRadius:'50%', background: isPreparing ? '#3b82f6' : '#374151', display:'inline-block' }}/>
                        <span style={{ color: isPreparing ? '#60a5fa' : '#374151' }}>{item.status}</span>
                      </div>
                    </div>
                    <div style={{ padding:'0 14px 14px' }}>
                      {!isPreparing
                        ? <button onClick={() => updateStatus(item.id,'preparing')} style={{ width:'100%', padding:'11px', borderRadius:13, background:'#fff', color:'#000', border:'none', fontSize:10, fontWeight:900, textTransform:'uppercase', letterSpacing:'0.07em', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', gap:5 }}>
                            <Play size={12} fill="currentColor"/> COMENZAR
                          </button>
                        : <button onClick={() => updateStatus(item.id,'served')} style={{ width:'100%', padding:'11px', borderRadius:13, background:'#2563eb', color:'#fff', border:'none', fontSize:10, fontWeight:900, textTransform:'uppercase', letterSpacing:'0.07em', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', gap:5 }}>
                            <CheckCircle2 size={12}/> LISTO PARA ENTREGA
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
    </div>
  );
}
