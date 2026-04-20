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

interface FlowItem {
  id: string;
  order_id: string;
  status: 'pending' | 'preparing' | 'served';
  quantity: number;
  notes: string | null;
  created_at: string;
  updated_at: string;
  table_id: number | null;
  menu_name: string | null;
  category: string | null;
}

const FlowModule: React.FC = () => {
  const [activeStation, setActiveStation] = useState<Station>('ALL');
  const [items, setItems] = useState<FlowItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [now, setNow] = useState(Date.now());
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const fetchFlowData = async () => {
    try {
      setError(null);
      // Query directa con join — más simple y confiable
      const { data, error: err } = await supabase.rpc('get_flow_items');
      
      if (err) {
        // Fallback: query manual si el RPC no existe
        const { data: rawItems, error: err2 } = await supabase
          .from('order_items')
          .select('id, order_id, status, quantity, notes, created_at, updated_at, menu_items(name, category), orders(table_id, status)')
          .neq('status', 'served')
          .order('created_at', { ascending: true });

        if (err2) {
          setError('Error cargando pedidos: ' + err2.message);
          setLoading(false);
          return;
        }

        if (rawItems) {
          const filtered = rawItems
            .filter((i: any) => i.orders?.status === 'open')
            .map((i: any) => ({
              id: i.id,
              order_id: i.order_id,
              status: i.status,
              quantity: i.quantity,
              notes: i.notes,
              created_at: i.created_at,
              updated_at: i.updated_at,
              table_id: i.orders?.table_id ?? null,
              menu_name: i.menu_items?.name ?? null,
              category: i.menu_items?.category ?? null,
            }));
          setItems(filtered);
        }
      } else if (data) {
        setItems(data);
      }
    } catch (e: any) {
      setError('Error: ' + e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFlowData();
    const channel = supabase.channel('flow-live-v3')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'order_items' }, fetchFlowData)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, fetchFlowData)
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  const updateStatus = async (id: string, status: string) => {
    await supabase.from('order_items').update({ status, updated_at: new Date().toISOString() }).eq('id', id);
  };

  const getNombre = (item: FlowItem) => item.menu_name ?? item.notes ?? 'Plato';

  const inferStation = (item: FlowItem): Station => {
    const cat = (item.category ?? item.notes ?? '').toUpperCase();
    if (cat.includes('ROBATA') || cat.includes('WOK') || cat.includes('CALIENTE') || cat.includes('COMPARTIR')) return 'CALIENTE';
    if (cat.includes('SUSHI') || cat.includes('FRIA') || cat.includes('MAKI') || cat.includes('NIGIRI') || cat.includes('SASHIMI') || cat.includes('TIRADITO')) return 'FRIA';
    if (cat.includes('ENSALADA')) return 'ENSALADAS';
    if (cat.includes('POSTRE')) return 'POSTRES';
    if (cat.includes('CHARCUTERIA') || cat.includes('TABLA')) return 'CHARCUTERIA';
    if (cat.includes('COCTEL') || cat.includes('SAKE') || cat.includes('CERVEZA') || cat.includes('JUGO') || cat.includes('CAFÉ') || cat.includes('TEQUILA') || cat.includes('CAFE')) return 'BAR';
    if (cat.includes('VINO') || cat.includes('CAVA')) return 'CAVA';
    return 'CALIENTE';
  };

  const filtered = activeStation === 'ALL' ? items : items.filter(i => inferStation(i) === activeStation);
  const count = (s: Station) => s === 'ALL' ? items.length : items.filter(i => inferStation(i) === s).length;

  const STATIONS = [
    { id: 'ALL',         label: 'GLOBAL',      icon: <Monitor size={13}/>,   color: '' },
    { id: 'CALIENTE',    label: 'CALIENTE',    icon: <Flame size={13}/>,     color: 'text-orange-500' },
    { id: 'FRIA',        label: 'FRÍA',        icon: <Droplets size={13}/>,  color: 'text-blue-400' },
    { id: 'ENSALADAS',   label: 'ENSALADAS',   icon: <Utensils size={13}/>,  color: 'text-green-500' },
    { id: 'POSTRES',     label: 'POSTRES',     icon: <IceCream size={13}/>,  color: 'text-pink-500' },
    { id: 'CHARCUTERIA', label: 'CHARCUTERÍA', icon: <Beef size={13}/>,      color: 'text-amber-600' },
    { id: 'BAR',         label: 'BAR',         icon: <Martini size={13}/>,   color: 'text-purple-500' },
    { id: 'CAVA',        label: 'CAVA',        icon: <Wine size={13}/>,      color: 'text-red-400' },
  ] as const;

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: '#0a0a0c', color: '#fff', overflow: 'hidden' }}>

      {/* Header */}
      <div style={{ padding: '16px 24px', borderBottom: '1px solid rgba(255,255,255,0.06)', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{ width: 48, height: 48, background: '#2563eb', borderRadius: '1.2rem', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 0 20px rgba(37,99,235,.3)' }}>
              <Activity size={24} color="#fff" />
            </div>
            <div>
              <div style={{ fontWeight: 900, fontSize: 20, fontStyle: 'italic', textTransform: 'uppercase', letterSpacing: '-0.03em' }}>Command Flow</div>
              <div style={{ fontSize: 10, color: '#6b7280', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.3em' }}>Orquestación Multizona OMM</div>
            </div>
          </div>
          {/* Tabs estaciones */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, background: '#111114', padding: 6, borderRadius: '2rem', border: '1px solid rgba(255,255,255,.05)' }}>
            {STATIONS.map(({ id, label, icon, color }) => {
              const c = count(id as Station);
              const active = activeStation === id;
              return (
                <button key={id} onClick={() => setActiveStation(id as Station)}
                  style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px', borderRadius: '9999px', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', border: 'none', cursor: 'pointer', transition: 'all .2s', background: active ? '#fff' : 'transparent', color: active ? '#000' : '#6b7280' }}>
                  {icon}
                  {label}
                  {c > 0 && <span style={{ padding: '1px 6px', borderRadius: '9999px', fontSize: 9, background: active ? '#000' : 'rgba(255,255,255,.07)', color: active ? '#fff' : '#6b7280' }}>{c}</span>}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Contenido */}
      <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '1fr 200px', overflow: 'hidden' }}>

        {/* Grid pedidos */}
        <div style={{ padding: 16, overflowY: 'auto' }}>

          {/* Error */}
          {error && (
            <div style={{ background: 'rgba(220,38,38,.1)', border: '1px solid rgba(220,38,38,.3)', borderRadius: 12, padding: 16, marginBottom: 16, color: '#ef4444', fontSize: 13 }}>
              ⚠️ {error}
              <button onClick={fetchFlowData} style={{ marginLeft: 12, background: '#ef4444', color: '#fff', border: 'none', padding: '4px 12px', borderRadius: 6, cursor: 'pointer', fontSize: 11 }}>Reintentar</button>
            </div>
          )}

          {/* Loading */}
          {loading && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px,1fr))', gap: 14 }}>
              {[1,2,3].map(i => <div key={i} style={{ background: '#111114', borderRadius: '2rem', height: 200, opacity: 0.5 }} />)}
            </div>
          )}

          {/* Vacío */}
          {!loading && filtered.length === 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '50vh', opacity: 0.15 }}>
              <Zap size={72} color="#3b82f6" style={{ marginBottom: 20 }} />
              <div style={{ fontSize: 28, fontWeight: 900, fontStyle: 'italic', textTransform: 'uppercase' }}>Estación Despejada</div>
              <div style={{ fontSize: 13, color: '#6b7280', marginTop: 12 }}>No hay pedidos pendientes en {activeStation}</div>
              <button onClick={fetchFlowData} style={{ marginTop: 16, background: '#1f2937', color: '#9ca3af', border: '1px solid #374151', padding: '8px 20px', borderRadius: 8, cursor: 'pointer', fontSize: 12 }}>
                🔄 Refrescar
              </button>
            </div>
          )}

          {/* Cards */}
          {!loading && filtered.length > 0 && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px,1fr))', gap: 14 }}>
              {filtered.map(item => {
                const isPreparing = item.status === 'preparing';
                const t = new Date(isPreparing ? item.updated_at : item.created_at).getTime();
                const diff = Math.floor((now - t) / 1000);
                const mins = Math.floor(diff / 60);
                const secs = diff % 60;
                const isAlert = mins >= (inferStation(item) === 'CALIENTE' ? 12 : 8);
                const fromPOS = !item.menu_name;
                return (
                  <div key={item.id} style={{
                    background: '#111114',
                    border: `2px solid ${isAlert ? '#dc2626' : isPreparing ? 'rgba(59,130,246,.4)' : 'rgba(255,255,255,.05)'}`,
                    borderRadius: '2.5rem', overflow: 'hidden',
                    display: 'flex', flexDirection: 'column',
                  }}>
                    {/* Header */}
                    <div style={{ padding: '16px 20px', borderBottom: `1px solid ${isAlert ? 'rgba(220,38,38,.2)' : 'rgba(255,255,255,.05)'}`, background: isAlert ? 'rgba(220,38,38,.08)' : 'rgba(255,255,255,.02)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ background: 'rgba(255,255,255,.05)', padding: '3px 10px', borderRadius: 10, fontWeight: 900, fontStyle: 'italic', fontSize: 14, color: '#3b82f6' }}>M{item.table_id ?? '?'}</span>
                        <span style={{ fontSize: 9, fontWeight: 700, color: '#4b5563', textTransform: 'uppercase' }}>{inferStation(item)}</span>
                        {fromPOS && <span style={{ fontSize: 9, fontWeight: 700, color: '#f97316', background: 'rgba(249,115,22,.1)', padding: '2px 7px', borderRadius: 20 }}>POS</span>}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontFamily: 'monospace', fontSize: 13, fontWeight: 900, color: isAlert ? '#ef4444' : isPreparing ? '#60a5fa' : '#6b7280' }}>
                        <Clock size={12} /> {mins}:{secs.toString().padStart(2,'0')}
                      </div>
                    </div>
                    {/* Body */}
                    <div style={{ padding: '20px 20px 12px', flex: 1 }}>
                      <div style={{ fontSize: 17, fontWeight: 900, fontStyle: 'italic', textTransform: 'uppercase', color: '#fff', marginBottom: 6 }}>
                        {item.quantity}x {getNombre(item)}
                      </div>
                      <div style={{ fontSize: 10, color: '#4b5563', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: 6 }}>
                        {item.category ?? inferStation(item)}
                        <span style={{ width: 3, height: 3, borderRadius: '50%', background: isPreparing ? '#3b82f6' : '#374151', display: 'inline-block' }} />
                        <span style={{ color: isPreparing ? '#60a5fa' : '#374151' }}>{item.status}</span>
                      </div>
                    </div>
                    {/* Botón */}
                    <div style={{ padding: '0 16px 16px' }}>
                      {!isPreparing ? (
                        <button onClick={() => updateStatus(item.id, 'preparing')}
                          style={{ width: '100%', padding: '12px', borderRadius: 14, background: '#fff', color: '#000', border: 'none', fontSize: 10, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.08em', cursor: 'pointer' }}>
                          <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}><Play size={13} fill="currentColor" /> COMENZAR</span>
                        </button>
                      ) : (
                        <button onClick={() => updateStatus(item.id, 'served')}
                          style={{ width: '100%', padding: '12px', borderRadius: 14, background: '#2563eb', color: '#fff', border: 'none', fontSize: 10, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.08em', cursor: 'pointer' }}>
                          <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}><CheckCircle2 size={13} /> LISTO PARA ENTREGA</span>
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
        <div style={{ borderLeft: '1px solid rgba(255,255,255,.05)', padding: '16px 14px', display: 'flex', flexDirection: 'column', gap: 14, overflowY: 'auto' }}>
          <div style={{ background: '#111114', border: '1px solid rgba(255,255,255,.05)', padding: 16, borderRadius: '1.5rem' }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.1em', display: 'flex', alignItems: 'center', gap: 6, fontStyle: 'italic', marginBottom: 16 }}>
              <BarChart3 size={13} color="#3b82f6" /> Live
            </div>
            {[
              { label: 'Activos',    value: items.length,                              color: '#fff' },
              { label: 'En fuego',   value: items.filter(i=>i.status==='preparing').length, color: '#f59e0b' },
              { label: 'Pendientes', value: items.filter(i=>i.status==='pending').length,   color: '#9ca3af' },
            ].map(m => (
              <div key={m.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(255,255,255,.05)', paddingBottom: 10, marginBottom: 10 }}>
                <span style={{ fontSize: 10, color: '#6b7280', fontWeight: 700, textTransform: 'uppercase' }}>{m.label}</span>
                <span style={{ fontSize: 18, fontWeight: 900, fontStyle: 'italic', color: m.color }}>{m.value}</span>
              </div>
            ))}
            <button onClick={fetchFlowData} style={{ width: '100%', padding: '8px', borderRadius: 10, background: 'rgba(37,99,235,.15)', border: '1px solid rgba(37,99,235,.3)', color: '#60a5fa', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>
              🔄 Refrescar
            </button>
          </div>
          <div style={{ background: 'linear-gradient(135deg, rgba(37,99,235,.15), transparent)', padding: 16, borderRadius: '1.5rem', border: '1px solid rgba(37,99,235,.1)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
              <Zap size={16} color="#3b82f6" fill="#3b82f6" />
              <span style={{ fontSize: 10, fontWeight: 700, color: '#fff', textTransform: 'uppercase', letterSpacing: '0.08em', fontStyle: 'italic' }}>Nexum IA</span>
            </div>
            <p style={{ fontSize: 12, color: '#9ca3af', fontStyle: 'italic', lineHeight: 1.6, margin: 0 }}>
              {items.filter(i=>i.status==='pending').length > 5
                ? `Alta demanda — ${items.filter(i=>i.status==='pending').length} pedidos. Priorizar salida.`
                : items.length === 0
                ? 'Cocina despejada.'
                : `${items.filter(i=>i.status==='preparing').length} platos en preparación.`}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default FlowModule;
