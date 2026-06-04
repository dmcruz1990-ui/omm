import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '../lib/supabase';

// ── Tipos ──────────────────────────────────────────────────────────────
interface Supply {
  id: string; nombre: string; categoria: string | null; unidad: string;
  precio_unidad: number; stock_actual: number; stock_minimo: number;
  proveedor: string | null; activo: boolean;
}
interface FoodCostRow {
  id: string; nombre: string; categoria: string | null; estacion: string;
  emoji: string; precio_venta: number; activo: boolean; disponible: boolean;
  costo_total: number; food_cost_pct: number;
  tag?: string | null;
  foto_url?: string | null;
  descripcion?: string | null;
  tiempo_preparacion_min?: number | null;
  ingredientes_count?: number | null;
}
interface RecetaItem {
  id: string; plato_id: string; supply_id: string; cantidad: number;
  unidad: string | null; notas: string | null; supply?: Supply;
}
interface IngForm {
  supply_id: string; nombre: string; cantidad: number; unidad: string; precio_unidad: number;
}

// ── Estilo ─────────────────────────────────────────────────────────────
const C = {
  bg: '#08080f', s1: '#0f0f1a', s2: '#1c1c1c', t1: '#fff', t2: '#9a9ab0',
  t3: '#50506A', border: 'rgba(255,255,255,0.07)', gold: '#FFB547',
  green: '#00E676', red: '#FF5252', blue: '#448AFF', purple: '#B388FF',
};
const CATEGORIAS = ['entrada', 'principal', 'postre', 'coctel', 'bebida', 'otros'];
const ESTACIONES = ['cocina_caliente', 'cocina_fria', 'bar', 'cava', 'robata', 'postres'];
const UNIDADES = ['gr', 'ml', 'kg', 'lt', 'unidad'];
const SUPPLY_CATS = ['carnes', 'pescados', 'vegetales', 'lacteos', 'licores', 'secos', 'otros'];
const EMOJIS = ['🍽️', '🥩', '🍣', '🍤', '🦞', '🐙', '🍜', '🍝', '🥗', '🍲', '🍱', '🍛', '🧀', '🍰', '🍮', '🍦', '🍷', '🍸', '🍹', '🍵', '☕', '🥃', '🐟', '🦐', '🌮', '🥟'];
const CAT_EMOJI: Record<string, string> = { carnes: '🥩', pescados: '🐟', vegetales: '🥬', lacteos: '🧀', licores: '🍾', secos: '🌾', otros: '📦' };

const fmt = (n: number) => '$' + Math.round(n || 0).toLocaleString('es-CO');
const titulo = (s: string) => (s || '').replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
const fcColor = (pct: number) => pct <= 0 ? C.t3 : pct < 30 ? C.green : pct <= 40 ? C.gold : C.red;

// ════════════════════════════════════════════════════════════════════════
export default function MenuModule() {
  const [tab, setTab] = useState<'carta' | 'nuevo' | 'recetas' | 'supply' | 'analisis'>('carta');
  const [platos, setPlatos] = useState<FoodCostRow[]>([]);
  const [supplies, setSupplies] = useState<Supply[]>([]);
  const [careCount, setCareCount] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState('');

  const showToast = (m: string) => { setToast(m); window.setTimeout(() => setToast(''), 2800); };

  // ── Fetch ──
  const fetchPlatos = useCallback(async () => {
    const { data } = await supabase.from('menu_food_cost').select('*');
    if (data) setPlatos(data as FoodCostRow[]);
  }, []);
  const fetchSupplies = useCallback(async () => {
    const { data } = await supabase.from('supply').select('*').order('categoria').order('nombre');
    if (data) setSupplies(data as Supply[]);
  }, []);
  const fetchCare = useCallback(async () => {
    const hace = new Date(Date.now() - 14 * 86400000).toISOString();
    const { data } = await supabase.from('xcare_encuestas').select('platos_problema').gte('created_at', hace);
    const map: Record<string, number> = {};
    (data || []).forEach((e: any) => (e.platos_problema || []).forEach((p: string) => {
      const k = String(p).toLowerCase().trim();
      if (k) map[k] = (map[k] || 0) + 1;
    }));
    setCareCount(map);
  }, []);

  useEffect(() => {
    (async () => {
      await Promise.all([fetchPlatos(), fetchSupplies(), fetchCare()]);
      setLoading(false);
    })();
  }, [fetchPlatos, fetchSupplies, fetchCare]);

  useEffect(() => {
    const ch = supabase.channel('mi-menu-rt')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'supply' }, () => { fetchSupplies(); fetchPlatos(); })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'menu_platos' }, () => fetchPlatos())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'menu_recetas' }, () => fetchPlatos())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [fetchSupplies, fetchPlatos]);

  const careFor = (nombre: string) => {
    const n = (nombre || '').toLowerCase();
    let tot = 0;
    Object.entries(careCount).forEach(([k, v]) => { if (k && (n.includes(k) || k.includes(n))) tot += v; });
    return tot;
  };

  // ════════ TAB 1 — CARTA ════════
  const [fCat, setFCat] = useState('all');
  const [fEst, setFEst] = useState('all');
  const [busca, setBusca] = useState('');
  const [sel, setSel] = useState<FoodCostRow | null>(null);
  const [selRecetas, setSelRecetas] = useState<RecetaItem[]>([]);
  // Edición de ingredientes en el panel de receta (panel lateral)
  const [editIngSup, setEditIngSup]  = useState('');
  const [editIngCant, setEditIngCant] = useState<number>(0);
  const [editIngUnidad, setEditIngUnidad] = useState('gr');
  const [editP, setEditP] = useState<Partial<FoodCostRow> | null>(null);

  const platosFiltrados = useMemo(() => platos.filter(p =>
    (fCat === 'all' || p.categoria === fCat) &&
    (fEst === 'all' || p.estacion === fEst) &&
    (p.nombre || '').toLowerCase().includes(busca.toLowerCase())
  ), [platos, fCat, fEst, busca]);

  const abrirPlato = async (p: FoodCostRow) => {
    setSel(p); setEditP({ ...p }); setSelRecetas([]);
    const { data } = await supabase.from('menu_recetas').select('*, supply(*)').eq('plato_id', p.id);
    if (data) setSelRecetas(data as RecetaItem[]);
  };
  // ── Receta · agregar/quitar ingrediente desde el panel de edición ──
  const agregarIngEdit = async () => {
    if (!sel) return;
    const sup = supplies.find(s => s.id === editIngSup);
    if (!sup || editIngCant <= 0) { showToast('⚠️ Elige insumo y cantidad'); return; }
    const { error } = await supabase.from('menu_recetas').insert({
      plato_id: sel.id, supply_id: sup.id,
      cantidad: editIngCant, unidad: editIngUnidad,
    });
    if (error) { showToast('✗ No se pudo agregar: ' + error.message); return; }
    setEditIngSup(''); setEditIngCant(0);
    const { data } = await supabase.from('menu_recetas').select('*, supply(*)').eq('plato_id', sel.id);
    if (data) setSelRecetas(data as RecetaItem[]);
    showToast(`✓ ${sup.nombre} agregado a la receta`);
    fetchPlatos();
  };
  const quitarIngEdit = async (id: string) => {
    if (!sel) return;
    if (!confirm('¿Quitar este ingrediente de la receta?')) return;
    await supabase.from('menu_recetas').delete().eq('id', id);
    setSelRecetas(prev => prev.filter(x => x.id !== id));
    showToast('Ingrediente quitado');
    fetchPlatos();
  };

  const toggleDisponible = async (p: FoodCostRow) => {
    await supabase.from('menu_platos').update({ disponible: !p.disponible }).eq('id', p.id);
    showToast(!p.disponible ? `✓ ${p.nombre} disponible` : `86 — ${p.nombre} agotado`);
    fetchPlatos();
  };
  const guardarEdicion = async () => {
    if (!editP?.id) return;
    await supabase.from('menu_platos').update({
      nombre: editP.nombre, categoria: editP.categoria, estacion: editP.estacion,
      precio_venta: Number(editP.precio_venta) || 0,
      tag: (editP.tag || '').toString().trim() || null,
      foto_url: (editP.foto_url || '').toString().trim() || null,
      descripcion: (editP.descripcion || '').toString().trim() || null,
      tiempo_preparacion_min: editP.tiempo_preparacion_min != null && Number(editP.tiempo_preparacion_min) > 0
        ? Math.round(Number(editP.tiempo_preparacion_min))
        : null,
    }).eq('id', editP.id);
    showToast('✓ Plato actualizado');
    setSel(null); fetchPlatos();
  };
  const eliminarPlato = async (id: string) => {
    await supabase.from('menu_platos').delete().eq('id', id);
    showToast('Plato eliminado');
    setSel(null); fetchPlatos();
  };

  // ════════ TAB 2 — NUEVO PLATO ════════
  const vacio = { emoji: '🍽️', nombre: '', descripcion: '', categoria: 'principal', estacion: 'cocina_caliente', precio_venta: 0 };
  const [nuevo, setNuevo] = useState({ ...vacio });
  const [ings, setIngs] = useState<IngForm[]>([]);
  const [supSel, setSupSel] = useState('');
  const [cant, setCant] = useState<number>(0);
  const [unidadIng, setUnidadIng] = useState('gr');
  const [guardando, setGuardando] = useState(false);

  const costoNuevo = useMemo(() => ings.reduce((s, i) => s + i.cantidad * i.precio_unidad, 0), [ings]);
  const fcNuevo = nuevo.precio_venta > 0 ? (costoNuevo / nuevo.precio_venta) * 100 : 0;

  const agregarIng = () => {
    const sup = supplies.find(s => s.id === supSel);
    if (!sup || cant <= 0) { showToast('⚠️ Elige insumo y cantidad'); return; }
    setIngs(prev => [...prev, { supply_id: sup.id, nombre: sup.nombre, cantidad: cant, unidad: unidadIng, precio_unidad: sup.precio_unidad }]);
    setSupSel(''); setCant(0);
  };
  const guardarPlato = async () => {
    if (!nuevo.nombre.trim()) { showToast('⚠️ El nombre es obligatorio'); return; }
    if (nuevo.precio_venta <= 0) { showToast('⚠️ El precio de venta es obligatorio'); return; }
    setGuardando(true);
    const { data: plato, error } = await supabase.from('menu_platos').insert({
      restaurante_id: 6, nombre: nuevo.nombre.trim(), descripcion: nuevo.descripcion || null,
      categoria: nuevo.categoria, estacion: nuevo.estacion, emoji: nuevo.emoji,
      precio_venta: Number(nuevo.precio_venta) || 0,
    }).select('id').single();
    if (error || !plato) { showToast('✗ Error al guardar el plato'); setGuardando(false); return; }
    if (ings.length > 0) {
      await supabase.from('menu_recetas').insert(ings.map(i => ({
        plato_id: plato.id, supply_id: i.supply_id, cantidad: i.cantidad, unidad: i.unidad,
      })));
    }
    showToast('✓ Plato creado');
    setNuevo({ ...vacio }); setIngs([]); setGuardando(false);
    await fetchPlatos();
    setTab('carta');
  };

  // ════════ TAB 3 — SUPPLY ════════
  const supVacio = { nombre: '', categoria: 'carnes', unidad: 'gr', precio_unidad: 0, stock_actual: 0, stock_minimo: 0, proveedor: '' };
  const [nuevoSup, setNuevoSup] = useState({ ...supVacio });
  const [formSupOpen, setFormSupOpen] = useState(false);

  const guardarSupply = async () => {
    if (!nuevoSup.nombre.trim()) { showToast('⚠️ Nombre del insumo requerido'); return; }
    const { error } = await supabase.from('supply').insert({
      restaurante_id: 6, nombre: nuevoSup.nombre.trim(), categoria: nuevoSup.categoria,
      unidad: nuevoSup.unidad, precio_unidad: Number(nuevoSup.precio_unidad) || 0,
      stock_actual: Number(nuevoSup.stock_actual) || 0, stock_minimo: Number(nuevoSup.stock_minimo) || 0,
      proveedor: nuevoSup.proveedor || null,
    });
    if (error) { showToast('✗ Error al guardar insumo'); return; }
    showToast('✓ Insumo agregado');
    setNuevoSup({ ...supVacio }); setFormSupOpen(false);
    fetchSupplies();
  };
  const actualizarSupply = async (id: string, campo: 'precio_unidad' | 'stock_actual', valor: number) => {
    await supabase.from('supply').update({ [campo]: valor }).eq('id', id);
    fetchSupplies(); fetchPlatos();
  };

  // ════════ TAB 4 — ANÁLISIS ════════
  const analisis = useMemo(() => {
    const conReceta = platos.filter(p => p.costo_total > 0 && p.precio_venta > 0);
    const fcProm = conReceta.length ? conReceta.reduce((s, p) => s + p.food_cost_pct, 0) / conReceta.length : 0;
    const altaRent = conReceta.filter(p => p.food_cost_pct < 25).length;
    const criticos = conReceta.filter(p => p.food_cost_pct > 40).length;
    const activos = platos.filter(p => p.activo).length;
    const topRent = [...conReceta].sort((a, b) => a.food_cost_pct - b.food_cost_pct).slice(0, 5);
    const topMalo = [...conReceta].sort((a, b) => b.food_cost_pct - a.food_cost_pct).slice(0, 5);
    const stockBajo = supplies.filter(s => Number(s.stock_actual) < Number(s.stock_minimo));
    const porCat: Record<string, { sum: number; n: number }> = {};
    conReceta.forEach(p => {
      const k = p.categoria || 'otros';
      if (!porCat[k]) porCat[k] = { sum: 0, n: 0 };
      porCat[k].sum += p.food_cost_pct; porCat[k].n++;
    });
    const distrib = Object.entries(porCat).map(([cat, v]) => ({ cat, pct: v.sum / v.n }));
    return { fcProm, altaRent, criticos, activos, topRent, topMalo, stockBajo, distrib };
  }, [platos, supplies]);

  // ── UI helpers ──
  const TabBtn = ({ id, label }: { id: typeof tab; label: string }) => (
    <button onClick={() => setTab(id)}
      style={{
        padding: '8px 16px', borderRadius: 10, fontSize: 12, fontWeight: 700, cursor: 'pointer',
        border: `1px solid ${tab === id ? C.gold : C.border}`,
        background: tab === id ? `${C.gold}1a` : 'transparent',
        color: tab === id ? C.gold : C.t2, fontFamily: "'DM Sans',sans-serif",
      }}>{label}</button>
  );
  const inp: React.CSSProperties = {
    width: '100%', background: C.bg, border: `1px solid ${C.border}`, borderRadius: 8,
    padding: '8px 10px', color: C.t1, fontSize: 13, outline: 'none',
  };
  const card: React.CSSProperties = { background: C.s1, border: `1px solid ${C.border}`, borderRadius: 14, padding: 16 };

  if (loading) return (
    <div style={{ height: '100%', background: C.bg, color: C.t2, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13 }}>
      Cargando Mi Menú…
    </div>
  );

  return (
    <div style={{ height: '100%', overflowY: 'auto', background: C.bg, color: C.t1, fontFamily: "'DM Sans',sans-serif", padding: 24 }}>
      {toast && (
        <div style={{ position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)', background: C.s2, border: `1px solid ${C.gold}`, color: C.t1, padding: '10px 24px', borderRadius: 50, fontSize: 13, fontWeight: 700, zIndex: 9999 }}>{toast}</div>
      )}

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 18, flexWrap: 'wrap' }}>
        <div>
          <h1 style={{ fontFamily: "'Syne',sans-serif", fontSize: 24, fontWeight: 800, margin: 0 }}>🍽️ Mi Menú</h1>
          <p style={{ fontSize: 11, color: C.t3, margin: '2px 0 0' }}>Carta · Recetas · Food Cost · Supply</p>
        </div>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <TabBtn id="carta" label="📋 Carta" />
          <TabBtn id="nuevo" label="➕ Nuevo plato" />
          <TabBtn id="recetas" label="📖 Recetas" />
          <TabBtn id="supply" label="🥩 Supply" />
          <TabBtn id="analisis" label="📊 Análisis" />
        </div>
      </div>

      {/* ════ TAB CARTA ════ */}
      {tab === 'carta' && (
        <div>
          <div style={{ display: 'flex', gap: 10, marginBottom: 14, flexWrap: 'wrap' }}>
            <input placeholder="Buscar plato…" value={busca} onChange={e => setBusca(e.target.value)} style={{ ...inp, width: 220 }} />
            <select value={fCat} onChange={e => setFCat(e.target.value)} style={{ ...inp, width: 170 }}>
              <option value="all">Todas las categorías</option>
              {CATEGORIAS.map(c => <option key={c} value={c}>{titulo(c)}</option>)}
            </select>
            <select value={fEst} onChange={e => setFEst(e.target.value)} style={{ ...inp, width: 180 }}>
              <option value="all">Todas las estaciones</option>
              {ESTACIONES.map(e => <option key={e} value={e}>{titulo(e)}</option>)}
            </select>
            <span style={{ marginLeft: 'auto', fontSize: 12, color: C.t3, alignSelf: 'center' }}>{platosFiltrados.length} platos</span>
          </div>

          {platos.length === 0 && (
            <div style={{ ...card, textAlign: 'center', color: C.t3, padding: 40 }}>
              Aún no hay platos en la carta. Ve a "➕ Nuevo plato" para crear el primero.
            </div>
          )}

          {platos.length > 0 && (
            <div style={{ ...card, padding: 0, overflow: 'hidden' }}>
              <div style={{ display: 'flex', gap: 12, padding: '8px 16px', fontSize: 9, color: C.t3, textTransform: 'uppercase', letterSpacing: 1, borderBottom: `1px solid ${C.border}` }}>
                <span style={{ width: 22 }} /><span style={{ flex: 1 }}>Plato</span>
                <span style={{ width: 70, textAlign: 'center' }}>Ingred.</span>
                <span style={{ width: 70, textAlign: 'center' }}>⏱ Tiempo</span>
                <span style={{ width: 90, textAlign: 'right' }}>Precio</span>
                <span style={{ width: 90, textAlign: 'right' }}>Costo</span>
                <span style={{ width: 70, textAlign: 'right' }}>Food cost</span>
                <span style={{ width: 70, textAlign: 'center' }}>Disp.</span>
              </div>
              {platosFiltrados.map((p, i) => {
                const quejas = careFor(p.nombre);
                const tMin = p.tiempo_preparacion_min || 0;
                const tCol = tMin === 0 ? C.t3 : tMin <= 8 ? C.green : tMin <= 15 ? C.gold : C.red;
                return (
                  <div key={p.id} onClick={() => abrirPlato(p)}
                    style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', borderTop: i ? `1px solid ${C.border}` : 'none', cursor: 'pointer' }}>
                    <span style={{ fontSize: 22, width: 22 }}>{p.emoji}</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                        {p.nombre}
                        {p.food_cost_pct > 0 && p.food_cost_pct < 25 && <span style={{ fontSize: 9, color: C.purple }}>Alta rentabilidad 💎</span>}
                        {quejas > 0 && <span style={{ fontSize: 9, background: `${C.red}22`, color: C.red, padding: '1px 6px', borderRadius: 6 }}>⚠️ Care {quejas}</span>}
                      </div>
                      <div style={{ fontSize: 10, color: C.t3 }}>{titulo(p.categoria || '')} · {titulo(p.estacion)}</div>
                    </div>
                    <div style={{ width: 70, textAlign: 'center', fontSize: 12, color: (p.ingredientes_count||0)>0?C.t1:C.t3, fontWeight: 700 }}>
                      {p.ingredientes_count != null && p.ingredientes_count > 0 ? `${p.ingredientes_count} 🥬` : '—'}
                    </div>
                    <div style={{ width: 70, textAlign: 'center', fontSize: 13, fontWeight: 800, color: tCol }}>
                      {tMin > 0 ? `${tMin}'` : '—'}
                    </div>
                    <div style={{ width: 90, textAlign: 'right', fontSize: 12, color: C.t2 }}>{fmt(p.precio_venta)}</div>
                    <div style={{ width: 90, textAlign: 'right', fontSize: 12, color: C.t3 }}>{fmt(p.costo_total)}</div>
                    <div style={{ width: 70, textAlign: 'right', fontSize: 13, fontWeight: 800, color: fcColor(p.food_cost_pct) }}>
                      {p.food_cost_pct > 0 ? p.food_cost_pct + '%' : '—'}
                    </div>
                    <button onClick={e => { e.stopPropagation(); toggleDisponible(p); }}
                      style={{ width: 70, padding: '4px 0', borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: 10, fontWeight: 700, background: p.disponible ? `${C.green}22` : `${C.red}22`, color: p.disponible ? C.green : C.red }}>
                      {p.disponible ? 'Disp.' : '86'}
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ════ TAB NUEVO PLATO ════ */}
      {tab === 'nuevo' && (
        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
          {/* Sección 1 */}
          <div style={{ ...card, flex: 1, minWidth: 320 }}>
            <h3 style={{ fontFamily: "'Syne',sans-serif", fontSize: 15, margin: '0 0 14px' }}>1 · Datos del plato</h3>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
              {EMOJIS.map(e => (
                <button key={e} onClick={() => setNuevo({ ...nuevo, emoji: e })}
                  style={{ fontSize: 18, padding: 4, borderRadius: 8, cursor: 'pointer', background: nuevo.emoji === e ? `${C.gold}22` : 'transparent', border: `1px solid ${nuevo.emoji === e ? C.gold : C.border}` }}>{e}</button>
              ))}
            </div>
            <label style={{ fontSize: 10, color: C.t3 }}>Nombre del plato *</label>
            <input value={nuevo.nombre} onChange={e => setNuevo({ ...nuevo, nombre: e.target.value })} style={{ ...inp, marginBottom: 10 }} />
            <label style={{ fontSize: 10, color: C.t3 }}>Descripción</label>
            <input value={nuevo.descripcion} onChange={e => setNuevo({ ...nuevo, descripcion: e.target.value })} style={{ ...inp, marginBottom: 10 }} />
            <div style={{ display: 'flex', gap: 10, marginBottom: 10 }}>
              <div style={{ flex: 1 }}>
                <label style={{ fontSize: 10, color: C.t3 }}>Categoría</label>
                <select value={nuevo.categoria} onChange={e => setNuevo({ ...nuevo, categoria: e.target.value })} style={inp}>
                  {CATEGORIAS.map(c => <option key={c} value={c}>{titulo(c)}</option>)}
                </select>
              </div>
              <div style={{ flex: 1 }}>
                <label style={{ fontSize: 10, color: C.t3 }}>Estación KDS</label>
                <select value={nuevo.estacion} onChange={e => setNuevo({ ...nuevo, estacion: e.target.value })} style={inp}>
                  {ESTACIONES.map(es => <option key={es} value={es}>{titulo(es)}</option>)}
                </select>
              </div>
            </div>
            <label style={{ fontSize: 10, color: C.t3 }}>Precio de venta *</label>
            <input type="number" value={nuevo.precio_venta || ''} onChange={e => setNuevo({ ...nuevo, precio_venta: parseFloat(e.target.value) || 0 })} style={inp} />
          </div>

          {/* Sección 2 */}
          <div style={{ ...card, flex: 1, minWidth: 320 }}>
            <h3 style={{ fontFamily: "'Syne',sans-serif", fontSize: 15, margin: '0 0 14px' }}>2 · Receta / Ingredientes</h3>
            <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
              <select value={supSel} onChange={e => {
                setSupSel(e.target.value);
                const s = supplies.find(x => x.id === e.target.value);
                if (s) setUnidadIng(s.unidad);
              }} style={{ ...inp, flex: 2 }}>
                <option value="">Insumo…</option>
                {supplies.map(s => <option key={s.id} value={s.id}>{s.nombre} ({s.unidad})</option>)}
              </select>
              <input type="number" placeholder="Cant." value={cant || ''} onChange={e => setCant(parseFloat(e.target.value) || 0)} style={{ ...inp, flex: 1 }} />
              <select value={unidadIng} onChange={e => setUnidadIng(e.target.value)} style={{ ...inp, width: 80 }}>
                {UNIDADES.map(u => <option key={u} value={u}>{u}</option>)}
              </select>
            </div>
            <button onClick={agregarIng} style={{ width: '100%', padding: '8px', borderRadius: 8, border: `1px solid ${C.blue}`, background: `${C.blue}1a`, color: C.blue, fontSize: 12, fontWeight: 700, cursor: 'pointer', marginBottom: 12 }}>
              + Agregar ingrediente
            </button>
            {ings.map((ig, idx) => (
              <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0', borderBottom: `1px solid ${C.border}`, fontSize: 12 }}>
                <span style={{ flex: 1 }}>{ig.nombre}</span>
                <span style={{ color: C.t3 }}>{ig.cantidad} {ig.unidad}</span>
                <span style={{ color: C.t2, width: 70, textAlign: 'right' }}>{fmt(ig.cantidad * ig.precio_unidad)}</span>
                <button onClick={() => setIngs(ings.filter((_, i) => i !== idx))} style={{ background: 'none', border: 'none', color: C.red, cursor: 'pointer' }}>✕</button>
              </div>
            ))}
            <div style={{ marginTop: 14, padding: 12, borderRadius: 10, background: C.bg, border: `1px solid ${fcColor(fcNuevo)}` }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: C.t2 }}>
                <span>Costo receta</span><span>{fmt(costoNuevo)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 15, fontWeight: 800, marginTop: 4 }}>
                <span>Food Cost</span><span style={{ color: fcColor(fcNuevo) }}>{fcNuevo.toFixed(1)}%</span>
              </div>
            </div>
            <button onClick={guardarPlato} disabled={guardando}
              style={{ width: '100%', marginTop: 12, padding: '11px', borderRadius: 10, border: 'none', background: C.gold, color: '#000', fontSize: 13, fontWeight: 800, cursor: 'pointer', opacity: guardando ? 0.5 : 1 }}>
              {guardando ? 'Guardando…' : '✓ Guardar plato'}
            </button>
          </div>
        </div>
      )}

      {/* ════ TAB SUPPLY ════ */}
      {tab === 'supply' && (
        <div>
          <div style={{ display: 'flex', marginBottom: 12 }}>
            <button onClick={() => setFormSupOpen(o => !o)}
              style={{ marginLeft: 'auto', padding: '8px 16px', borderRadius: 10, border: `1px solid ${C.blue}`, background: `${C.blue}1a`, color: C.blue, fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
              {formSupOpen ? '✕ Cerrar' : '+ Agregar insumo'}
            </button>
          </div>
          {formSupOpen && (
            <div style={{ ...card, marginBottom: 14, display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'flex-end' }}>
              <div style={{ flex: 2, minWidth: 160 }}>
                <label style={{ fontSize: 10, color: C.t3 }}>Nombre</label>
                <input value={nuevoSup.nombre} onChange={e => setNuevoSup({ ...nuevoSup, nombre: e.target.value })} style={inp} />
              </div>
              <div style={{ width: 130 }}>
                <label style={{ fontSize: 10, color: C.t3 }}>Categoría</label>
                <select value={nuevoSup.categoria} onChange={e => setNuevoSup({ ...nuevoSup, categoria: e.target.value })} style={inp}>
                  {SUPPLY_CATS.map(c => <option key={c} value={c}>{titulo(c)}</option>)}
                </select>
              </div>
              <div style={{ width: 80 }}>
                <label style={{ fontSize: 10, color: C.t3 }}>Unidad</label>
                <select value={nuevoSup.unidad} onChange={e => setNuevoSup({ ...nuevoSup, unidad: e.target.value })} style={inp}>
                  {UNIDADES.map(u => <option key={u} value={u}>{u}</option>)}
                </select>
              </div>
              <div style={{ width: 110 }}>
                <label style={{ fontSize: 10, color: C.t3 }}>Precio/unidad</label>
                <input type="number" value={nuevoSup.precio_unidad || ''} onChange={e => setNuevoSup({ ...nuevoSup, precio_unidad: parseFloat(e.target.value) || 0 })} style={inp} />
              </div>
              <div style={{ width: 100 }}>
                <label style={{ fontSize: 10, color: C.t3 }}>Stock actual</label>
                <input type="number" value={nuevoSup.stock_actual || ''} onChange={e => setNuevoSup({ ...nuevoSup, stock_actual: parseFloat(e.target.value) || 0 })} style={inp} />
              </div>
              <div style={{ width: 100 }}>
                <label style={{ fontSize: 10, color: C.t3 }}>Stock mínimo</label>
                <input type="number" value={nuevoSup.stock_minimo || ''} onChange={e => setNuevoSup({ ...nuevoSup, stock_minimo: parseFloat(e.target.value) || 0 })} style={inp} />
              </div>
              <div style={{ flex: 1, minWidth: 130 }}>
                <label style={{ fontSize: 10, color: C.t3 }}>Proveedor</label>
                <input value={nuevoSup.proveedor} onChange={e => setNuevoSup({ ...nuevoSup, proveedor: e.target.value })} style={inp} />
              </div>
              <button onClick={guardarSupply} style={{ padding: '8px 18px', borderRadius: 8, border: 'none', background: C.gold, color: '#000', fontSize: 12, fontWeight: 800, cursor: 'pointer' }}>Guardar</button>
            </div>
          )}
          <div style={{ ...card, padding: 0, overflow: 'hidden' }}>
            {supplies.length === 0 && <div style={{ padding: 30, textAlign: 'center', color: C.t3, fontSize: 12 }}>Sin insumos. Agrega el primero.</div>}
            {supplies.map((s, i) => {
              const bajo = Number(s.stock_actual) < Number(s.stock_minimo);
              return (
                <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 16px', borderTop: i ? `1px solid ${C.border}` : 'none', background: bajo ? `${C.red}12` : 'transparent' }}>
                  <span style={{ fontSize: 18 }}>{CAT_EMOJI[s.categoria || 'otros'] || '📦'}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 700 }}>{s.nombre} {bajo && <span style={{ fontSize: 9, color: C.red }}>⚠️ Stock bajo</span>}</div>
                    <div style={{ fontSize: 10, color: C.t3 }}>{titulo(s.categoria || '')} · {s.proveedor || 'Sin proveedor'}</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <label style={{ fontSize: 8, color: C.t3, display: 'block' }}>Precio/{s.unidad}</label>
                    <input type="number" defaultValue={s.precio_unidad}
                      onBlur={e => { const v = parseFloat(e.target.value) || 0; if (v !== Number(s.precio_unidad)) actualizarSupply(s.id, 'precio_unidad', v); }}
                      style={{ ...inp, width: 90, padding: '4px 6px', textAlign: 'right' }} />
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <label style={{ fontSize: 8, color: C.t3, display: 'block' }}>Stock ({s.unidad})</label>
                    <input type="number" defaultValue={s.stock_actual}
                      onBlur={e => { const v = parseFloat(e.target.value) || 0; if (v !== Number(s.stock_actual)) actualizarSupply(s.id, 'stock_actual', v); }}
                      style={{ ...inp, width: 90, padding: '4px 6px', textAlign: 'right', color: bajo ? C.red : C.t1 }} />
                  </div>
                  <div style={{ width: 70, textAlign: 'right', fontSize: 10, color: C.t3 }}>mín {s.stock_minimo}</div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ════ TAB ANÁLISIS ════ */}
      {tab === 'analisis' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12 }}>
            {[
              { l: 'Food cost promedio', v: analisis.fcProm.toFixed(1) + '%', c: fcColor(analisis.fcProm) },
              { l: 'Alta rentabilidad (<25%)', v: String(analisis.altaRent), c: C.purple },
              { l: 'Platos críticos (>40%)', v: String(analisis.criticos), c: C.red },
              { l: 'Platos activos', v: String(analisis.activos), c: C.blue },
            ].map(k => (
              <div key={k.l} style={card}>
                <div style={{ fontSize: 10, color: C.t3, textTransform: 'uppercase', letterSpacing: 1 }}>{k.l}</div>
                <div style={{ fontSize: 26, fontWeight: 900, color: k.c, marginTop: 4 }}>{k.v}</div>
              </div>
            ))}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <div style={card}>
              <h3 style={{ fontFamily: "'Syne',sans-serif", fontSize: 14, margin: '0 0 10px', color: C.green }}>💎 Top 5 más rentables</h3>
              {analisis.topRent.map(p => (
                <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0', borderBottom: `1px solid ${C.border}`, fontSize: 12 }}>
                  <span>{p.emoji}</span><span style={{ flex: 1 }}>{p.nombre}</span>
                  <span style={{ color: C.t3 }}>{fmt(p.precio_venta)}</span>
                  <span style={{ fontWeight: 800, color: fcColor(p.food_cost_pct), width: 48, textAlign: 'right' }}>{p.food_cost_pct}%</span>
                </div>
              ))}
              {analisis.topRent.length === 0 && <div style={{ color: C.t3, fontSize: 12 }}>Sin recetas cargadas todavía.</div>}
            </div>
            <div style={card}>
              <h3 style={{ fontFamily: "'Syne',sans-serif", fontSize: 14, margin: '0 0 10px', color: C.red }}>⚠️ Top 5 menos rentables</h3>
              {analisis.topMalo.map(p => (
                <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0', borderBottom: `1px solid ${C.border}`, fontSize: 12 }}>
                  <span>{p.emoji}</span><span style={{ flex: 1 }}>{p.nombre}</span>
                  {p.food_cost_pct > 40 && <span style={{ fontSize: 9, color: C.gold }}>↑ revisar precio</span>}
                  <span style={{ fontWeight: 800, color: fcColor(p.food_cost_pct), width: 48, textAlign: 'right' }}>{p.food_cost_pct}%</span>
                </div>
              ))}
              {analisis.topMalo.length === 0 && <div style={{ color: C.t3, fontSize: 12 }}>Sin recetas cargadas todavía.</div>}
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <div style={card}>
              <h3 style={{ fontFamily: "'Syne',sans-serif", fontSize: 14, margin: '0 0 10px', color: C.gold }}>📦 Insumos con stock bajo</h3>
              {analisis.stockBajo.map(s => (
                <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0', borderBottom: `1px solid ${C.border}`, fontSize: 12 }}>
                  <span>{CAT_EMOJI[s.categoria || 'otros']}</span><span style={{ flex: 1 }}>{s.nombre}</span>
                  <span style={{ color: C.red }}>{s.stock_actual} / {s.stock_minimo} {s.unidad}</span>
                </div>
              ))}
              {analisis.stockBajo.length === 0 && <div style={{ color: C.green, fontSize: 12 }}>✓ Todo el stock está sobre el mínimo.</div>}
            </div>
            <div style={card}>
              <h3 style={{ fontFamily: "'Syne',sans-serif", fontSize: 14, margin: '0 0 10px' }}>📊 Food cost por categoría</h3>
              {analisis.distrib.map(d => (
                <div key={d.cat} style={{ marginBottom: 8 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, marginBottom: 3 }}>
                    <span>{titulo(d.cat)}</span><span style={{ color: fcColor(d.pct), fontWeight: 700 }}>{d.pct.toFixed(1)}%</span>
                  </div>
                  <div style={{ height: 8, background: C.bg, borderRadius: 4, overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: Math.min(100, d.pct) + '%', background: fcColor(d.pct) }} />
                  </div>
                </div>
              ))}
              {analisis.distrib.length === 0 && <div style={{ color: C.t3, fontSize: 12 }}>Sin datos todavía.</div>}
            </div>
          </div>
        </div>
      )}

      {/* ════ TAB RECETAS — galería de fichas técnicas ════ */}
      {tab === 'recetas' && (
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16, flexWrap: 'wrap' as const }}>
            <div>
              <h3 style={{ fontFamily: "'Syne',sans-serif", fontSize: 16, fontWeight: 800, margin: 0 }}>📖 Recetas · Ficha técnica del equipo</h3>
              <p style={{ fontSize: 11, color: C.t3, margin: '3px 0 0' }}>
                Estas fichas alimentan Flow: cuando un mesero toca un plato en cocina, el chef ve foto + descripción + ingredientes.
              </p>
            </div>
            <input placeholder="🔎 Buscar receta..." value={busca} onChange={e => setBusca(e.target.value)}
              style={{ ...inp, width: 240, marginLeft: 'auto' }} />
          </div>

          {/* Grid por categorías */}
          {(() => {
            const cats = Array.from(new Set(platosFiltrados.map(p => p.categoria || 'otros')));
            if (platosFiltrados.length === 0) return (
              <div style={{ textAlign: 'center' as const, color: C.t3, padding: 60, fontSize: 13 }}>
                Sin platos. Creá uno desde "➕ Nuevo plato".
              </div>
            );
            return cats.map(cat => {
              const delaCat = platosFiltrados.filter(p => (p.categoria || 'otros') === cat);
              return (
                <div key={cat} style={{ marginBottom: 24 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                    <span style={{ fontSize: 11, color: C.gold, fontWeight: 800, textTransform: 'uppercase' as const, letterSpacing: '.14em' }}>
                      {titulo(cat)}
                    </span>
                    <span style={{ flex: 1, height: 1, background: C.border }}/>
                    <span style={{ fontSize: 10, color: C.t3 }}>{delaCat.length} plato{delaCat.length === 1 ? '' : 's'}</span>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 14 }}>
                    {delaCat.map(p => (
                      <div key={p.id} onClick={() => abrirPlato(p)}
                        style={{ background: C.s1, border: `1px solid ${C.border}`, borderRadius: 14, overflow: 'hidden', cursor: 'pointer', transition: 'all .15s', display: 'flex', flexDirection: 'column' as const }}
                        onMouseEnter={e => (e.currentTarget.style.borderColor = C.gold)}
                        onMouseLeave={e => (e.currentTarget.style.borderColor = C.border)}>
                        {/* Foto del plato */}
                        <div style={{ aspectRatio: '4/3', background: C.bg, position: 'relative', overflow: 'hidden' }}>
                          {p.foto_url ? (
                            <img src={p.foto_url} alt={p.nombre} loading="lazy"
                              style={{ width: '100%', height: '100%', objectFit: 'cover' as const, display: 'block' }}/>
                          ) : (
                            <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 60 }}>
                              {p.emoji || '🍽️'}
                            </div>
                          )}
                          <div style={{ position: 'absolute' as const, top: 8, right: 8, padding: '3px 9px', borderRadius: 50, fontSize: 10, fontWeight: 800, background: fcColor(p.food_cost_pct) + '33', color: fcColor(p.food_cost_pct), border: `1px solid ${fcColor(p.food_cost_pct)}55` }}>
                            FC {p.food_cost_pct || 0}%
                          </div>
                          {!p.disponible && (
                            <div style={{ position: 'absolute' as const, top: 8, left: 8, padding: '3px 9px', borderRadius: 50, fontSize: 10, fontWeight: 800, background: 'rgba(224,80,80,0.85)', color: '#fff' }}>86</div>
                          )}
                        </div>
                        <div style={{ padding: 12, flex: 1, display: 'flex', flexDirection: 'column' as const, gap: 6 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <span style={{ fontSize: 18 }}>{p.emoji}</span>
                            <span style={{ fontFamily: "'Syne',sans-serif", fontSize: 13, fontWeight: 800, color: C.t1, flex: 1 }}>{p.nombre}</span>
                          </div>
                          {p.tag && <div style={{ fontSize: 10, color: '#b388ff', fontWeight: 700 }}>{p.tag}</div>}
                          {p.descripcion && (
                            <div style={{ fontSize: 11, color: C.t3, lineHeight: 1.4, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' as any, overflow: 'hidden' }}>
                              {p.descripcion}
                            </div>
                          )}
                          <div style={{ display: 'flex', gap: 8, marginTop: 'auto', paddingTop: 6, borderTop: `1px solid ${C.border}`, alignItems: 'center' }}>
                            <span style={{ fontSize: 11, color: C.gold, fontWeight: 700 }}>{fmt(p.precio_venta)}</span>
                            {p.tiempo_preparacion_min ? (
                              <span style={{ fontSize: 10, color: '#b388ff', fontWeight: 700, padding: '2px 7px', borderRadius: 50, background: 'rgba(155,114,255,0.12)' }}>⏱ {p.tiempo_preparacion_min}'</span>
                            ) : null}
                            <span style={{ fontSize: 10, color: C.t3, marginLeft: 'auto' as const }}>
                              {p.ingredientes_count != null && p.ingredientes_count > 0 ? `${p.ingredientes_count} 🥬 · ` : ''}{fmt(p.costo_total)}
                            </span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            });
          })()}
        </div>
      )}

      {/* ════ PANEL LATERAL — RECETA ════ */}
      {sel && editP && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 9000, display: 'flex', justifyContent: 'flex-end' }}>
          <div onClick={() => setSel(null)} style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.6)' }} />
          <div style={{ position: 'relative', width: 380, maxWidth: '90vw', height: '100%', background: C.s1, borderLeft: `1px solid ${C.border}`, padding: 22, overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <span style={{ fontSize: 32 }}>{sel.emoji}</span>
              <button onClick={() => setSel(null)} style={{ background: 'none', border: 'none', color: C.t3, fontSize: 18, cursor: 'pointer' }}>✕</button>
            </div>
            <label style={{ fontSize: 10, color: C.t3 }}>Nombre</label>
            <input value={editP.nombre || ''} onChange={e => setEditP({ ...editP, nombre: e.target.value })} style={{ ...inp, marginBottom: 10 }} />
            <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
              <div style={{ flex: 1 }}>
                <label style={{ fontSize: 10, color: C.t3 }}>Categoría</label>
                <select value={editP.categoria || ''} onChange={e => setEditP({ ...editP, categoria: e.target.value })} style={inp}>
                  {CATEGORIAS.map(c => <option key={c} value={c}>{titulo(c)}</option>)}
                </select>
              </div>
              <div style={{ flex: 1 }}>
                <label style={{ fontSize: 10, color: C.t3 }}>Estación</label>
                <select value={editP.estacion || ''} onChange={e => setEditP({ ...editP, estacion: e.target.value })} style={inp}>
                  {ESTACIONES.map(es => <option key={es} value={es}>{titulo(es)}</option>)}
                </select>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
              <div style={{ flex: 1 }}>
                <label style={{ fontSize: 10, color: C.t3 }}>Precio de venta</label>
                <input type="number" value={editP.precio_venta || ''} onChange={e => setEditP({ ...editP, precio_venta: parseFloat(e.target.value) || 0 })} style={inp} />
              </div>
              <div style={{ width: 130 }}>
                <label style={{ fontSize: 10, color: C.t3 }}>⏱ Tiempo prep. (min)</label>
                <input type="number" min={1} max={120} value={editP.tiempo_preparacion_min || ''}
                  onChange={e => setEditP({ ...editP, tiempo_preparacion_min: parseInt(e.target.value) || null as any })}
                  placeholder="12" style={inp} />
              </div>
            </div>

            <label style={{ fontSize: 10, color: C.t3 }}>🏷️ Tag (sale debajo del nombre en POS)</label>
            <input value={editP.tag || ''} maxLength={28} onChange={e => setEditP({ ...editP, tag: e.target.value })}
              placeholder="Ej: Recomendado · Nuevo · Promo 2x1 · Sin gluten"
              style={{ ...inp, marginBottom: 10 }} />

            <label style={{ fontSize: 10, color: C.t3 }}>📸 Foto del plato (URL)</label>
            <input value={editP.foto_url || ''} onChange={e => setEditP({ ...editP, foto_url: e.target.value })}
              placeholder="https://images.unsplash.com/..."
              style={{ ...inp, marginBottom: 6 }} />
            {editP.foto_url && (
              <div style={{ marginBottom: 10, borderRadius: 10, overflow: 'hidden', border: `1px solid ${C.border}` }}>
                <img src={editP.foto_url} alt="vista previa" style={{ width: '100%', maxHeight: 140, objectFit: 'cover', display: 'block' }}/>
              </div>
            )}

            <label style={{ fontSize: 10, color: C.t3 }}>📝 Descripción (visible en ficha técnica de Flow)</label>
            <textarea value={editP.descripcion || ''} maxLength={280} onChange={e => setEditP({ ...editP, descripcion: e.target.value })}
              placeholder="Descripción breve del plato: técnicas, origen, presentación..."
              rows={3}
              style={{ ...inp, marginBottom: 14, resize: 'vertical' as const, fontFamily: 'inherit' }} />
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: -8, marginBottom: 14 }}>
              {['🔥 Nuevo','⭐ Recomendado','💎 Premium','🌱 Veggie','🌶 Picante','🆕 De temporada','🎁 Promo'].map(t => (
                <button key={t} type="button" onClick={() => setEditP({ ...editP, tag: t })}
                  style={{ padding: '3px 9px', borderRadius: 50, border: `1px solid ${editP?.tag === t ? C.purple : C.border}`, background: editP?.tag === t ? `${C.purple}15` : 'transparent', color: editP?.tag === t ? C.purple : C.t3, fontSize: 10, fontWeight: 700, cursor: 'pointer' }}>
                  {t}
                </button>
              ))}
            </div>

            <div style={{ padding: 12, borderRadius: 10, background: C.bg, border: `1px solid ${fcColor(sel.food_cost_pct)}`, marginBottom: 14 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: C.t2 }}><span>Costo receta</span><span>{fmt(sel.costo_total)}</span></div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, fontWeight: 800, marginTop: 3 }}><span>Food Cost</span><span style={{ color: fcColor(sel.food_cost_pct) }}>{sel.food_cost_pct}%</span></div>
            </div>

            <h4 style={{ fontFamily: "'Syne',sans-serif", fontSize: 13, margin: '0 0 8px' }}>📖 Receta · Ingredientes</h4>
            {selRecetas.length === 0 && <div style={{ fontSize: 12, color: C.t3, marginBottom: 10 }}>Este plato no tiene receta cargada. Agregá los ingredientes desde abajo.</div>}
            {selRecetas.map(r => (
              <div key={r.id} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, padding: '5px 0', borderBottom: `1px solid ${C.border}` }}>
                <span style={{ flex: 1 }}>{r.supply?.nombre || 'Insumo'}</span>
                <span style={{ color: C.t3 }}>{r.cantidad} {r.unidad || r.supply?.unidad}</span>
                <span style={{ color: C.gold, fontWeight: 700, minWidth: 70, textAlign: 'right' as const }}>{fmt(r.cantidad * (r.supply?.precio_unidad || 0))}</span>
                <button onClick={() => quitarIngEdit(r.id)}
                  title="Quitar ingrediente"
                  style={{ background: 'transparent', border: `1px solid ${C.red}55`, color: C.red, borderRadius: 6, padding: '1px 7px', fontSize: 11, cursor: 'pointer' }}>✕</button>
              </div>
            ))}

            {/* Agregar nuevo ingrediente al plato */}
            <div style={{ marginTop: 10, padding: 10, background: C.bg, borderRadius: 8, border: `1px dashed ${C.border}` }}>
              <div style={{ fontSize: 10, color: C.t3, fontWeight: 700, textTransform: 'uppercase', marginBottom: 6 }}>+ Agregar ingrediente</div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' as const }}>
                <select value={editIngSup} onChange={e => setEditIngSup(e.target.value)} style={{ ...inp, flex: 2, minWidth: 140 }}>
                  <option value="">Seleccionar insumo…</option>
                  {supplies.filter(s => s.activo !== false).map(s => (
                    <option key={s.id} value={s.id}>{s.nombre} · {fmt(s.precio_unidad)}/{s.unidad}</option>
                  ))}
                </select>
                <input type="number" min={0} step="any" placeholder="Cant." value={editIngCant || ''}
                  onChange={e => setEditIngCant(parseFloat(e.target.value) || 0)}
                  style={{ ...inp, width: 70 }} />
                <select value={editIngUnidad} onChange={e => setEditIngUnidad(e.target.value)} style={{ ...inp, width: 70 }}>
                  {['gr','kg','ml','l','und','porc'].map(u => <option key={u}>{u}</option>)}
                </select>
                <button onClick={agregarIngEdit}
                  disabled={!editIngSup || editIngCant <= 0}
                  style={{ padding: '8px 14px', borderRadius: 8, border: 'none', background: C.green, color: '#000', fontSize: 12, fontWeight: 800, cursor: editIngSup && editIngCant > 0 ? 'pointer' : 'not-allowed', opacity: editIngSup && editIngCant > 0 ? 1 : 0.5 }}>
                  + Agregar
                </button>
              </div>
            </div>

            <div style={{ display: 'flex', gap: 8, marginTop: 18 }}>
              <button onClick={guardarEdicion} style={{ flex: 1, padding: '10px', borderRadius: 10, border: 'none', background: C.gold, color: '#000', fontSize: 12, fontWeight: 800, cursor: 'pointer' }}>Guardar cambios</button>
              <button onClick={() => eliminarPlato(sel.id)} style={{ padding: '10px 16px', borderRadius: 10, border: `1px solid ${C.red}`, background: 'transparent', color: C.red, fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>Eliminar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
