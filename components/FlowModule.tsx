import React, { useState, useEffect } from 'react';
import { 
  Flame, Zap, Wine, Clock, CheckCircle2, Monitor,
  Droplets, Activity, BarChart3, IceCream, Utensils, Beef, Play
} from 'lucide-react';
import { supabase } from '../lib/supabase.ts';

const Martini = ({ size = 14 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M8 22h8M12 11v11M3 3l9 9 9-9H3z"/>
  </svg>
);

type Station = 'ALL' | 'CALIENTE' | 'FRIA' | 'ENSALADAS' | 'POSTRES' | 'CHARCUTERIA' | 'BAR' | 'CAVA';

interface FlowOrderItem {
  id: string;
  order_id: string;
  status: 'pending' | 'preparing' | 'served';
  quantity: number;
  notes?: string;
  created_at: string;
  updated_at: string;
  table_id?: number;
  menu_items: { name: string; category: string; } | null;
}

const FlowModule: React.FC = () => {
  const [activeStation, setActiveStation] = useState<Station>('ALL');
  const [items, setItems] = useState<FlowOrderItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  const fetchFlowData = async () => {
    try {
      // Query en 2 pasos — más compatible y robusta
      const { data: ordersData } = await supabase
        .from('orders')
        .select('id, table_id')
        .eq('status', 'open');

      if (!ordersData || ordersData.length === 0) {
        setItems([]);
        setLoading(false);
        return;
      }

      const orderIds = ordersData.map((o: any) => o.id);

      const { data: itemsData } = await supabase
        .from('order_items')
        .select('*, menu_items(name, category)')
        .in('order_id', orderIds)
        .neq('status', 'served')
        .order('created_at', { ascending: true });

      if (itemsData) {
        const enriched = itemsData.map((item: any) => ({
          ...item,
          table_id: ordersData.find((o: any) => o.id === item.order_id)?.table_id,
          menu_items: item.menu_items ?? null,
        }));
        setItems(enriched);
      }
    } catch (e) {
      console.error('Flow error:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFlowData();
    const channel = supabase.channel('flow-live-v2')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'order_items' }, fetchFlowData)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, fetchFlowData)
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  const updateItemStatus = async (itemId: string, newStatus: string) => {
    await supabase.from('order_items').update({
      status: newStatus,
      updated_at: new Date().toISOString()
    }).eq('id', itemId);
  };

  const getNombre = (item: FlowOrderItem) =>
    item.menu_items?.name ?? item.notes ?? 'Plato';

  const inferirCategoria = (nombre: string) => {
    const n = nombre.toUpperCase();
    if (n.includes('ROBATA') || n.includes('WOK') || n.includes('CALIENTE')) return 'ROBATA';
    if (n.includes('MAKI') || n.includes('SUSHI') || n.includes('NIGIRI') || n.includes('SASHIMI') || n.includes('TEMAKI') || n.includes('GEISHA') || n.includes('TIRADITO')) return 'SUSHI';
    if (n.includes('ENSALADA')) return 'ENSALADA';
    if (n.includes('POSTRE')) return 'POSTRE';
    if (n.includes('CHARCUTERIA') || n.includes('TABLA')) return 'CHARCUTERIA';
    if (n.includes('COCTEL') || n.includes('SAKE') || n.includes('CERVEZA') || n.includes('JUGO') || n.includes('CAFÉ') || n.includes('AGUA')) return 'COCTEL';
    if (n.includes('VINO') || n.includes('CAVA') || n.includes('COPA')) return 'VINO';
    return 'ROBATA';
  };

  const getStationForItem = (item: FlowOrderItem): Station => {
    const cat = (item.menu_items?.category ?? inferirCategoria(item.notes ?? '')).toUpperCase();
    if (cat.includes('ROBATA') || cat.includes('CALIENTE') || cat.includes('WOK') || cat.includes('COMPARTIR') || cat.includes('PARA COMPARTIR')) return 'CALIENTE';
    if (cat.includes('SUSHI') || cat.includes('FRIA') || cat.includes('MAKI') || cat.includes('NIGIRI') || cat.includes('SASHIMI') || cat.includes('ENTRADAS')) return 'FRIA';
    if (cat.includes('ENSALADA')) return 'ENSALADAS';
    if (cat.includes('POSTRE')) return 'POSTRES';
    if (cat.includes('CHARCUTERIA') || cat.includes('TABLA')) return 'CHARCUTERIA';
    if (cat.includes('COCTEL') || cat.includes('BEBIDA') || cat.includes('SAKE') || cat.includes('CERVEZA') || cat.includes('TEQUILA') || cat.includes('JUGO') || cat.includes('CAFÉ')) return 'BAR';
    if (cat.includes('VINO') || cat.includes('CAVA')) return 'CAVA';
    return 'CALIENTE';
  };

  const filteredItems = activeStation === 'ALL'
    ? items
    : items.filter(i => getStationForItem(i) === activeStation);

  const getCount = (s: Station) => s === 'ALL' ? items.length : items.filter(i => getStationForItem(i) === s).length;

  return (
    <div style={{ height:'100%', display:'flex', flexDirection:'column', background:'#0a0a0c', color:'#fff', overflow:'hidden' }}>

      {/* Header */}
      <div style={{ padding:'20px 28px 16px', borderBottom:'1px solid rgba(255,255,255,0.05)', flexShrink:0 }}>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:16, flexWrap:'wrap' }}>
          <div style={{ display:'flex', alignItems:'center', gap:16 }}>
            <div style={{ width:56, height:56, background:'#2563eb', borderRadius:'1.5rem', display:'flex', alignItems:'center', justifyContent:'center', boxShadow:'0 0 24px rgba(37,99,235,0.3)' }}>
              <Activity size={28} className="text-white" />
            </div>
            <div>
              <h2 style={{ fontFamily:'sans-serif', fontSize:28, fontWeight:900, fontStyle:'italic', letterSpacing:'-0.05em', margin:0, textTransform:'uppercase' }}>Command Flow</h2>
              <p style={{ fontSize:10, color:'#6b7280', fontWeight:700, textTransform:'uppercase', letterSpacing:'0.3em', margin:'6px 0 0' }}>Orquestación Multizona OMM</p>
            </div>
          </div>

          {/* Tabs estaciones */}
          <div style={{ display:'flex', flexWrap:'wrap', gap:6, background:'#111114', padding:8, borderRadius:'2.5rem', border:'1px solid rgba(255,255,255,0.05)' }}>
            {([
              { s:'ALL',         label:'GLOBAL',      icon:<Monitor size={13}/>,   color:'' },
              { s:'CALIENTE',    label:'CALIENTE',    icon:<Flame size={13}/>,     color:'text-orange-500' },
              { s:'FRIA',        label:'FRÍA',        icon:<Droplets size={13}/>,  color:'text-blue-400' },
              { s:'ENSALADAS',   label:'ENSALADAS',   icon:<Utensils size={13}/>,  color:'text-green-500' },
              { s:'POSTRES',     label:'POSTRES',     icon:<IceCream size={13}/>,  color:'text-pink-500' },
              { s:'CHARCUTERIA', label:'CHARCUTERÍA', icon:<Beef size={13}/>,      color:'text-amber-600' },
              { s:'BAR',         label:'BAR',         icon:<Martini size={13}/>,   color:'text-purple-500' },
              { s:'CAVA',        label:'CAVA',        icon:<Wine size={13}/>,      color:'text-red-400' },
            ] as const).map(({ s, label, icon, color }) => {
              const count = getCount(s as Station);
              const active = activeStation === s;
              return (
                <button key={s} onClick={() => setActiveStation(s as Station)}
                  style={{ display:'flex', alignItems:'center', gap:8, padding:'8px 14px', borderRadius:'9999px', fontSize:10, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.08em', border:'none', cursor:'pointer', transition:'all 0.2s', background: active ? '#fff' : 'transparent', color: active ? '#000' : '#6b7280', transform: active ? 'scale(1.05)' : 'scale(1)' }}>
                  <span style={{ color: active ? '#000' : undefined }}>{icon}</span>
                  {label}
                  {count > 0 && <span style={{ padding:'1px 7px', borderRadius:'9999px', fontSize:9, background: active ? '#000' : 'rgba(255,255,255,0.05)', color: active ? '#fff' : '#6b7280' }}>{count}</span>}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Contenido */}
      <div style={{ flex:1, overflowY:'auto', display:'grid', gridTemplateColumns:'1fr auto', gap:0 }}>

        {/* Cards de pedidos */}
        <div style={{ padding:'20px 24px', overflowY:'auto' }}>
          {loading ? (
            <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(280px,1fr))', gap:16 }}>
              {[1,2,3].map(i => (
                <div key={i} style={{ background:'#111114', border:'2px solid rgba(255,255,255,0.05)', borderRadius:'2rem', height:220, animation:'pulse 2s infinite' }} />
              ))}
            </div>
          ) : filteredItems.length === 0 ? (
            <div style={{ display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', height:'50vh', opacity:0.1 }}>
              <Zap size={80} style={{ color:'#3b82f6', marginBottom:24 }} />
              <h4 style={{ fontSize:32, fontWeight:900, fontStyle:'italic', textTransform:'uppercase', letterSpacing:'0.2em', margin:0 }}>Estación Despejada</h4>
              <p style={{ fontSize:13, fontWeight:700, textTransform:'uppercase', marginTop:16, color:'#6b7280' }}>No hay pedidos pendientes en {activeStation}</p>
            </div>
          ) : (
            <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(280px,1fr))', gap:16 }}>
              {filteredItems.map(item => {
                const isPreparing = item.status === 'preparing';
                const station = getStationForItem(item);
                const startTime = new Date(isPreparing ? item.updated_at : item.created_at).getTime();
                const diff = Math.floor((now - startTime) / 1000);
                const mins = Math.floor(diff / 60);
                const secs = diff % 60;
                const isAlert = mins >= (station === 'CALIENTE' ? 12 : 8);
                const nombre = getNombre(item);
                const fromPOS = !item.menu_items;

                return (
                  <div key={item.id} style={{
                    background:'#111114', borderRadius:'2.5rem', overflow:'hidden',
                    display:'flex', flexDirection:'column',
                    border: `2px solid ${isAlert ? '#dc2626' : isPreparing ? 'rgba(59,130,246,0.4)' : 'rgba(255,255,255,0.05)'}`,
                    boxShadow: isAlert ? '0 0 20px rgba(220,38,38,0.2)' : 'none',
                    animation: isAlert ? 'pulse 2s infinite' : 'none',
                    transition:'all 0.3s',
                  }}>
                    {/* Header card */}
                    <div style={{ padding:'20px 24px', borderBottom:`1px solid ${isAlert ? 'rgba(220,38,38,0.2)' : 'rgba(255,255,255,0.05)'}`, background: isAlert ? 'rgba(220,38,38,0.1)' : 'rgba(255,255,255,0.02)', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                      <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                        <div style={{ background:'rgba(255,255,255,0.05)', padding:'4px 12px', borderRadius:12, fontWeight:900, fontStyle:'italic', fontSize:14, color:'#3b82f6' }}>
                          M{item.table_id}
                        </div>
                        <span style={{ fontSize:9, fontWeight:700, color:'#4b5563', textTransform:'uppercase', letterSpacing:'0.1em' }}>{station}</span>
                        {fromPOS && <span style={{ fontSize:9, fontWeight:700, color:'#f97316', background:'rgba(249,115,22,0.1)', padding:'2px 8px', borderRadius:20 }}>POS</span>}
                      </div>
                      <div style={{ display:'flex', alignItems:'center', gap:6, fontFamily:'monospace', fontSize:13, fontWeight:900, fontStyle:'italic', color: isAlert ? '#ef4444' : isPreparing ? '#60a5fa' : '#6b7280' }}>
                        <Clock size={13} />
                        {mins}:{secs.toString().padStart(2,'0')}
                      </div>
                    </div>

                    {/* Body */}
                    <div style={{ padding:'24px 24px 16px', flex:1 }}>
                      <h4 style={{ fontSize:18, fontWeight:900, fontStyle:'italic', textTransform:'uppercase', lineHeight:1.2, color:'#fff', margin:'0 0 8px' }}>
                        {item.quantity}x {nombre}
                      </h4>
                      <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                        <span style={{ fontSize:10, fontWeight:700, color:'#4b5563', textTransform:'uppercase' }}>{item.menu_items?.category ?? inferirCategoria(nombre)}</span>
                        <div style={{ width:4, height:4, borderRadius:'50%', background: isPreparing ? '#3b82f6' : '#374151' }} />
                        <span style={{ fontSize:10, fontWeight:700, textTransform:'uppercase', color: isPreparing ? '#3b82f6' : '#374151' }}>{item.status}</span>
                      </div>
                    </div>

                    {/* Botón acción */}
                    <div style={{ padding:'0 20px 20px' }}>
                      {!isPreparing ? (
                        <button onClick={() => updateItemStatus(item.id, 'preparing')}
                          style={{ width:'100%', padding:'14px', borderRadius:16, background:'#fff', color:'#000', border:'none', fontSize:10, fontWeight:900, textTransform:'uppercase', letterSpacing:'0.1em', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', gap:8, transition:'all 0.2s' }}
                          onMouseEnter={e => { e.currentTarget.style.background='#2563eb'; e.currentTarget.style.color='#fff'; }}
                          onMouseLeave={e => { e.currentTarget.style.background='#fff'; e.currentTarget.style.color='#000'; }}>
                          <Play size={14} fill="currentColor" /> COMENZAR
                        </button>
                      ) : (
                        <button onClick={() => updateItemStatus(item.id, 'served')}
                          style={{ width:'100%', padding:'14px', borderRadius:16, background:'#2563eb', color:'#fff', border:'none', fontSize:10, fontWeight:900, textTransform:'uppercase', letterSpacing:'0.1em', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', gap:8, transition:'all 0.2s' }}
                          onMouseEnter={e => e.currentTarget.style.background='#16a34a'}
                          onMouseLeave={e => e.currentTarget.style.background='#2563eb'}>
                          <CheckCircle2 size={14} /> LISTO PARA ENTREGA
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div style={{ width:220, padding:'20px 16px', borderLeft:'1px solid rgba(255,255,255,0.05)', display:'flex', flexDirection:'column', gap:16, overflowY:'auto', flexShrink:0 }}>
          <div style={{ background:'#111114', border:'1px solid rgba(255,255,255,0.05)', padding:20, borderRadius:'2rem' }}>
            <h3 style={{ fontSize:10, fontWeight:700, color:'#6b7280', textTransform:'uppercase', letterSpacing:'0.1em', display:'flex', alignItems:'center', gap:8, fontStyle:'italic', marginBottom:24 }}>
              <BarChart3 size={14} style={{ color:'#3b82f6' }} /> Rendimiento Live
            </h3>
            <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
              {[
                { label:'Items Activos',  value: items.length.toString() },
                { label:'En Fuego',       value: items.filter(i=>i.status==='preparing').length.toString() },
                { label:'Pendientes',     value: items.filter(i=>i.status==='pending').length.toString(), color:'#f59e0b' },
              ].map(m => (
                <div key={m.label} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', borderBottom:'1px solid rgba(255,255,255,0.05)', paddingBottom:12 }}>
                  <span style={{ fontSize:10, color:'#6b7280', fontWeight:700, textTransform:'uppercase', letterSpacing:'-0.02em' }}>{m.label}</span>
                  <span style={{ fontSize:14, fontWeight:900, fontStyle:'italic', color: m.color ?? '#fff' }}>{m.value}</span>
                </div>
              ))}
            </div>
          </div>

          <div style={{ background:'linear-gradient(135deg, rgba(37,99,235,0.2), transparent)', padding:24, borderRadius:'2rem', border:'1px solid rgba(37,99,235,0.1)' }}>
            <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:12 }}>
              <Zap size={18} style={{ color:'#3b82f6' }} fill="#3b82f6" />
              <h4 style={{ fontSize:10, fontWeight:700, color:'#fff', textTransform:'uppercase', letterSpacing:'0.1em', fontStyle:'italic', margin:0 }}>Predictivo Nexum</h4>
            </div>
            <p style={{ fontSize:12, color:'#9ca3af', fontStyle:'italic', lineHeight:1.6, margin:0 }}>
              {items.filter(i=>i.status==='pending').length > 5
                ? `Alta demanda — ${items.filter(i=>i.status==='pending').length} pedidos pendientes. Priorizar salida.`
                : items.length === 0
                ? 'Cocina despejada. Servicio fluido.'
                : `${items.filter(i=>i.status==='preparing').length} platos en preparación activa.`}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default FlowModule;
