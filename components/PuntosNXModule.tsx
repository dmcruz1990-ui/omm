import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { supabase } from '../lib/supabase.ts';
import { useAuth } from '../contexts/AuthContext';
import { useRestaurant } from '../contexts/RestaurantContext';

// ═══════════════════════════════════════════════════════════════════════
// PUNTOS NX — Wallet de clientes, beneficios canjeables, retos x2/x3/x4,
// solicitudes con flujo aprobar/rechazar/canjeado, historial completo.
// ═══════════════════════════════════════════════════════════════════════

const S = {
  bg:'#08080f', bg2:'#0f0f1a', bg3:'#161624', bg4:'#1e1e2e',
  border:'rgba(255,255,255,0.07)', border2:'rgba(255,255,255,0.12)',
  t1:'#fff', t2:'#A0A0B8', t3:'#50506A',
  gold:'#FFB547', green:'#00E676', red:'#FF5252',
  blue:'#448AFF', purple:'#B388FF', pink:'#FF2D78', cyan:'#22d3ee',
  nx:'#9b72ff',
};

const fmtCOP = (n:number) => `$${Math.round(n||0).toLocaleString('es-CO')}`;
const fmtPts = (n:number) => `${(n||0).toLocaleString('es-CO')} pts`;

type Tab = 'beneficios' | 'retos' | 'solicitudes' | 'historial' | 'admin';

export default function PuntosNXModule() {
  const { profile } = useAuth();
  const { activeId: restauranteId, activeRestaurant } = useRestaurant();
  const isGerencia = ['admin','gerencia','desarrollo'].includes(profile?.role || '');
  const miNombre = profile?.nombre_completo || profile?.full_name || 'Cajero';
  const [tab, setTab] = useState<Tab>('beneficios');
  const [toast, setToast] = useState('');
  const showToast = (m:string) => { setToast(m); setTimeout(()=>setToast(''), 3500); };

  // KPIs del header
  const [kpis, setKpis] = useState({ beneficios:0, retosActivos:0, solicPendientes:0, puntosCirculando:0, canjesMes:0 });
  useEffect(() => {
    (async () => {
      const mesStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0];
      const [b, r, s, m, p] = await Promise.all([
        supabase.from('nx_beneficios').select('id', { count:'exact', head:true }).eq('restaurante_id', restauranteId).eq('activo', true),
        supabase.from('nx_retos').select('id', { count:'exact', head:true }).eq('restaurante_id', restauranteId).eq('activo', true),
        supabase.from('nx_solicitudes').select('id', { count:'exact', head:true }).eq('restaurante_id', restauranteId).eq('estado','pendiente'),
        supabase.from('nx_solicitudes').select('id', { count:'exact', head:true }).eq('restaurante_id', restauranteId).eq('estado','canjeada').gte('canjeada_en', mesStart),
        supabase.from('customers').select('puntos').gt('puntos', 0),
      ]);
      setKpis({
        beneficios: b.count || 0,
        retosActivos: r.count || 0,
        solicPendientes: s.count || 0,
        canjesMes: m.count || 0,
        puntosCirculando: (p.data || []).reduce((sum, x:any) => sum + Number(x.puntos||0), 0),
      });
    })();
  }, [restauranteId, tab]);

  return (
    <div style={{height:'100%', display:'flex', flexDirection:'column', background:S.bg, color:S.t1, fontFamily:"'DM Sans',sans-serif", overflow:'hidden'}}>
      {toast && <div style={{position:'fixed', bottom:24, left:'50%', transform:'translateX(-50%)', background:S.bg4, border:`1px solid ${S.nx}`, color:S.t1, padding:'10px 28px', borderRadius:50, fontSize:13, fontWeight:700, zIndex:9999}}>{toast}</div>}

      {/* Header */}
      <div style={{padding:'14px 24px', borderBottom:`1px solid ${S.border}`, background:S.bg2, display:'flex', alignItems:'center', gap:14, flexShrink:0, flexWrap:'wrap'}}>
        <div style={{display:'flex', alignItems:'center', gap:12}}>
          <div style={{width:44, height:44, borderRadius:13, background:`linear-gradient(135deg,${S.nx},#7c5ac7)`, display:'flex', alignItems:'center', justifyContent:'center', fontSize:22}}>✦</div>
          <div>
            <div style={{fontFamily:"'Syne',sans-serif", fontSize:16, fontWeight:900}}>PUNTOS NX</div>
            <div style={{fontSize:10, color:S.t3, letterSpacing:'.1em', textTransform:'uppercase'}}>Wallet · Beneficios · Retos · Canjes · {activeRestaurant.nombre}</div>
          </div>
        </div>
        <div style={{marginLeft:'auto', display:'flex', gap:16}}>
          <Kpi label="Beneficios"   value={String(kpis.beneficios)}        color={S.nx}/>
          <Kpi label="Retos"        value={String(kpis.retosActivos)}      color={S.gold}/>
          <Kpi label="Pendientes"   value={String(kpis.solicPendientes)}   color={kpis.solicPendientes>0?S.red:S.t2} pulse={kpis.solicPendientes>0}/>
          <Kpi label="Canjes mes"   value={String(kpis.canjesMes)}         color={S.green}/>
          <Kpi label="Pts circulando" value={fmtPts(kpis.puntosCirculando)} color={S.cyan}/>
        </div>
      </div>

      {/* Tabs */}
      <div style={{display:'flex', borderBottom:`1px solid ${S.border}`, background:S.bg2, padding:'0 24px', flexShrink:0, overflowX:'auto'}}>
        {[
          {id:'beneficios'  as const, label:'💎 Beneficios'},
          {id:'retos'       as const, label:'🎯 Retos'},
          {id:'solicitudes' as const, label:`📥 Solicitudes${kpis.solicPendientes>0?` · ${kpis.solicPendientes}`:''}`},
          {id:'historial'   as const, label:'📜 Historial'},
          ...(isGerencia ? [{id:'admin' as const, label:'⚙️ Admin'}] : []),
        ].map(t => (
          <button key={t.id} onClick={()=>setTab(t.id)}
            style={{padding:'12px 18px', background:'none', border:'none', borderBottom:`2px solid ${tab===t.id?S.nx:'transparent'}`, color:tab===t.id?S.nx:S.t3, fontSize:12, fontWeight:700, cursor:'pointer', whiteSpace:'nowrap'}}>
            {t.label}
          </button>
        ))}
      </div>

      <div style={{flex:1, overflow:'hidden'}}>
        {tab==='beneficios'  && <BeneficiosTab restauranteId={restauranteId} isGerencia={isGerencia} showToast={showToast}/>}
        {tab==='retos'       && <RetosTab restauranteId={restauranteId} isGerencia={isGerencia} showToast={showToast}/>}
        {tab==='solicitudes' && <SolicitudesTab restauranteId={restauranteId} isGerencia={isGerencia} miNombre={miNombre} showToast={showToast}/>}
        {tab==='historial'   && <HistorialTab restauranteId={restauranteId}/>}
        {tab==='admin'       && isGerencia && <AdminTab restauranteId={restauranteId} showToast={showToast}/>}
      </div>
    </div>
  );
}

function Kpi({label, value, color, pulse}: {label:string, value:string, color:string, pulse?:boolean}) {
  return (
    <div style={{textAlign:'center', minWidth:70}}>
      <div style={{fontSize:9, color:S.t3, textTransform:'uppercase'}}>{label}</div>
      <div style={{fontFamily:"'Syne',sans-serif", fontSize:16, fontWeight:900, color, animation: pulse?'pulse 1.5s ease-in-out infinite':'none'}}>{value}</div>
    </div>
  );
}

// ── Helper para subir fotos al bucket ohyeah-fotos ──
async function subirFotoNX(file: File, restauranteId: number, sub: string): Promise<string|null> {
  const ext = file.name.split('.').pop() || 'jpg';
  const path = `nx/${sub}/${restauranteId}/${Date.now()}-${Math.random().toString(36).slice(2,8)}.${ext}`;
  const { error } = await supabase.storage.from('ohyeah-fotos').upload(path, file, { upsert:false, contentType: file.type });
  if (error) return null;
  const { data: pub } = supabase.storage.from('ohyeah-fotos').getPublicUrl(path);
  return pub?.publicUrl || null;
}

// ═══════════════════════════════════════════════════════════════════════
// TAB 1 · BENEFICIOS — catálogo canjeable
// ═══════════════════════════════════════════════════════════════════════
function BeneficiosTab({ restauranteId, isGerencia, showToast }: any) {
  const [data, setData] = useState<any[]>([]);
  const [editing, setEditing] = useState<any|null>(null);
  const [subiendo, setSubiendo] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const cargar = useCallback(async () => {
    const { data } = await supabase.from('nx_beneficios')
      .select('*').eq('restaurante_id', restauranteId)
      .order('destacado', { ascending: false }).order('costo_puntos');
    setData(data || []);
  }, [restauranteId]);
  useEffect(() => { cargar(); }, [cargar]);

  const TIPOS = [
    { id:'cortesia',    label:'☕ Cortesía',    color:S.green },
    { id:'descuento',   label:'%  Descuento',   color:S.blue },
    { id:'plato',       label:'🍽️ Plato',       color:S.gold },
    { id:'bebida',      label:'🍷 Bebida',      color:S.purple },
    { id:'postre',      label:'🍰 Postre',      color:S.pink },
    { id:'combo',       label:'🍱 Combo',       color:S.cyan },
    { id:'experiencia', label:'✨ Experiencia', color:S.nx },
    { id:'servicio',    label:'🎯 Servicio',    color:S.t2 },
  ];

  const nuevo = () => setEditing({ restaurante_id:restauranteId, nombre:'', tipo:'cortesia', costo_puntos:100, emoji:'🎁', activo:true, para_descargar:true });
  const guardar = async () => {
    if (!editing.nombre) { showToast('⚠ Nombre requerido'); return; }
    if (!editing.costo_puntos || editing.costo_puntos < 1) { showToast('⚠ Costo en puntos inválido'); return; }
    setSubiendo(true);
    const payload = { ...editing, updated_at: new Date().toISOString() };
    if (payload.id) {
      await supabase.from('nx_beneficios').update(payload).eq('id', payload.id);
    } else {
      await supabase.from('nx_beneficios').insert(payload);
    }
    setSubiendo(false);
    setEditing(null);
    cargar();
    showToast('✓ Beneficio guardado');
  };
  const eliminar = async () => {
    if (!editing?.id) { setEditing(null); return; }
    if (!confirm(`¿Eliminar "${editing.nombre}"? No se podrá recuperar.`)) return;
    await supabase.from('nx_beneficios').delete().eq('id', editing.id);
    setEditing(null);
    cargar();
    showToast('Beneficio eliminado');
  };
  const onFile = async (file: File) => {
    setSubiendo(true);
    const url = await subirFotoNX(file, restauranteId, 'beneficios');
    if (url) setEditing((e:any)=>({...e, foto_url:url}));
    else showToast('⚠ Error subiendo foto');
    setSubiendo(false);
  };

  return (
    <div style={{height:'100%', overflowY:'auto', padding:24}}>
      <div style={{display:'flex', alignItems:'center', marginBottom:18, gap:12}}>
        <div>
          <div style={{fontFamily:"'Syne',sans-serif", fontSize:16, fontWeight:900}}>💎 Catálogo de beneficios</div>
          <div style={{fontSize:11, color:S.t3}}>Los clientes los ven en su app para canjear puntos</div>
        </div>
        {isGerencia && <button onClick={nuevo} style={{marginLeft:'auto', padding:'9px 18px', borderRadius:10, border:'none', background:`linear-gradient(135deg,${S.nx},#7c5ac7)`, color:'#fff', fontSize:12, fontWeight:900, cursor:'pointer'}}>+ Nuevo beneficio</button>}
      </div>

      {data.length === 0 && <div style={{padding:60, textAlign:'center', color:S.t3}}><div style={{fontSize:50, marginBottom:12}}>💎</div><div style={{fontSize:14, fontWeight:700}}>Aún sin beneficios</div><div style={{fontSize:11, color:S.t3, marginTop:6}}>Crea uno para empezar a recibir canjes.</div></div>}

      <div style={{display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(240px, 1fr))', gap:14}}>
        {data.map(b => {
          const tipo = TIPOS.find(t => t.id === b.tipo) || TIPOS[7];
          return (
            <button key={b.id} onClick={()=>isGerencia && setEditing(b)}
              style={{background:S.bg2, border:`1px solid ${b.destacado?S.gold:tipo.color+'30'}`, borderRadius:14, overflow:'hidden', cursor:isGerencia?'pointer':'default', textAlign:'left' as const, padding:0}}>
              <div style={{height:140, background: b.foto_url ? `url(${b.foto_url}) center/cover` : `linear-gradient(135deg,${tipo.color}30,${S.bg3})`, position:'relative'}}>
                <div style={{position:'absolute', top:8, left:8, background:tipo.color, color:'#000', fontSize:10, fontWeight:900, padding:'3px 9px', borderRadius:50}}>{tipo.label}</div>
                {!b.activo && <div style={{position:'absolute', inset:0, background:'rgba(0,0,0,0.6)', display:'flex', alignItems:'center', justifyContent:'center', color:S.red, fontWeight:900}}>INACTIVO</div>}
                {b.destacado && <div style={{position:'absolute', top:8, right:8, fontSize:18}}>⭐</div>}
                {!b.foto_url && <div style={{position:'absolute', inset:0, display:'flex', alignItems:'center', justifyContent:'center', fontSize:50, opacity:0.4}}>{b.emoji}</div>}
              </div>
              <div style={{padding:'12px 14px'}}>
                <div style={{fontSize:14, fontWeight:700, color:S.t1, marginBottom:4}}>{b.nombre}</div>
                {b.descripcion && <div style={{fontSize:11, color:S.t2, marginBottom:6, lineHeight:1.4}}>{b.descripcion.length>60?b.descripcion.slice(0,60)+'…':b.descripcion}</div>}
                <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginTop:6}}>
                  <span style={{fontFamily:"'Syne',sans-serif", fontSize:18, fontWeight:900, color:S.nx}}>{fmtPts(b.costo_puntos)}</span>
                  {b.veces_canjeado>0 && <span style={{fontSize:10, color:S.t3}}>{b.veces_canjeado}× canjeado</span>}
                </div>
                {b.valor_estimado && <div style={{fontSize:10, color:S.gold, marginTop:3}}>≈ {fmtCOP(b.valor_estimado)}</div>}
              </div>
            </button>
          );
        })}
      </div>

      {/* Modal edición */}
      {editing && (
        <div onClick={()=>setEditing(null)} style={{position:'fixed', inset:0, background:'rgba(0,0,0,0.85)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:200, padding:20}}>
          <div onClick={e=>e.stopPropagation()} style={{background:'#0f0f1a', border:'1px solid rgba(255,255,255,0.1)', borderRadius:18, width:'100%', maxWidth:440, padding:24, maxHeight:'90vh', overflowY:'auto'}}>
            <div style={{fontFamily:"'Syne',sans-serif", fontSize:16, fontWeight:900, marginBottom:14, color:S.nx}}>{editing.id?'Editar':'Nuevo'} beneficio</div>
            <input type="file" accept="image/*" ref={fileRef} onChange={e=>e.target.files?.[0] && onFile(e.target.files[0])} style={{display:'none'}}/>
            <div onClick={()=>fileRef.current?.click()} style={{height:160, borderRadius:12, marginBottom:14, cursor:'pointer', background:editing.foto_url?`url(${editing.foto_url}) center/cover`:'rgba(255,255,255,0.03)', border:`1px dashed ${editing.foto_url?'transparent':S.border2}`, display:'flex', alignItems:'center', justifyContent:'center', color:S.t2, fontSize:13}}>
              {subiendo ? '⌛ Subiendo...' : (editing.foto_url ? '🔄 Cambiar foto' : '📷 Foto del beneficio (opcional)')}
            </div>
            <Field label="Nombre"><input value={editing.nombre||''} onChange={e=>setEditing((p:any)=>({...p, nombre:e.target.value}))} placeholder="Ej: Postre del chef de cortesía" style={inp}/></Field>
            <Field label="Descripción"><textarea value={editing.descripcion||''} onChange={e=>setEditing((p:any)=>({...p, descripcion:e.target.value}))} rows={2} style={{...inp, resize:'vertical'}}/></Field>
            <Field label="Tipo">
              <div style={{display:'flex', flexWrap:'wrap', gap:6}}>
                {TIPOS.map(t => (
                  <button key={t.id} onClick={()=>setEditing((p:any)=>({...p, tipo:t.id}))} style={{padding:'6px 12px', borderRadius:8, border:`1px solid ${editing.tipo===t.id?t.color:S.border2}`, background:editing.tipo===t.id?`${t.color}20`:'transparent', color:editing.tipo===t.id?t.color:S.t2, fontSize:11, fontWeight:700, cursor:'pointer'}}>{t.label}</button>
                ))}
              </div>
            </Field>
            <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:10}}>
              <Field label="Costo (puntos) *"><input type="number" value={editing.costo_puntos||0} onChange={e=>setEditing((p:any)=>({...p, costo_puntos:Number(e.target.value)}))} style={inp}/></Field>
              <Field label="Valor COP estimado"><input type="number" value={editing.valor_estimado||''} onChange={e=>setEditing((p:any)=>({...p, valor_estimado:Number(e.target.value)}))} placeholder="0" style={inp}/></Field>
            </div>
            <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:10}}>
              <Field label="Emoji"><input value={editing.emoji||'🎁'} onChange={e=>setEditing((p:any)=>({...p, emoji:e.target.value}))} style={{...inp, fontSize:18, textAlign:'center'}}/></Field>
              <Field label="Stock mensual"><input type="number" value={editing.stock_mensual||''} onChange={e=>setEditing((p:any)=>({...p, stock_mensual:Number(e.target.value)}))} placeholder="∞" style={inp}/></Field>
            </div>
            <Field label="Condiciones"><input value={editing.condiciones||''} onChange={e=>setEditing((p:any)=>({...p, condiciones:e.target.value}))} placeholder='"1 por mesa", "no aplica fines de semana"' style={inp}/></Field>
            <div style={{display:'flex', gap:14, marginBottom:14, marginTop:6}}>
              <label style={{display:'flex', alignItems:'center', gap:6, color:S.t2, fontSize:12, cursor:'pointer'}}>
                <input type="checkbox" checked={!!editing.destacado} onChange={e=>setEditing((p:any)=>({...p, destacado:e.target.checked}))}/>
                ⭐ Destacado
              </label>
              <label style={{display:'flex', alignItems:'center', gap:6, color:S.t2, fontSize:12, cursor:'pointer'}}>
                <input type="checkbox" checked={!!editing.activo} onChange={e=>setEditing((p:any)=>({...p, activo:e.target.checked}))}/>
                ✓ Activo
              </label>
              <label style={{display:'flex', alignItems:'center', gap:6, color:S.t2, fontSize:12, cursor:'pointer'}}>
                <input type="checkbox" checked={!!editing.para_descargar} onChange={e=>setEditing((p:any)=>({...p, para_descargar:e.target.checked}))}/>
                📲 Visible en app
              </label>
            </div>
            <div style={{display:'flex', gap:8}}>
              {editing.id && <button onClick={eliminar} style={{padding:'10px 14px', borderRadius:9, border:'1px solid rgba(255,82,82,0.4)', background:'rgba(255,82,82,0.1)', color:S.red, fontSize:12, fontWeight:700, cursor:'pointer'}}>Eliminar</button>}
              <button onClick={()=>setEditing(null)} style={{flex:1, padding:'10px 14px', borderRadius:9, border:`1px solid ${S.border2}`, background:'transparent', color:S.t2, fontSize:12, fontWeight:700, cursor:'pointer'}}>Cancelar</button>
              <button onClick={guardar} disabled={subiendo} style={{flex:2, padding:'10px 14px', borderRadius:9, border:'none', background:`linear-gradient(135deg,${S.nx},#7c5ac7)`, color:'#fff', fontSize:12, fontWeight:900, cursor:'pointer'}}>{subiendo?'...':'✓ Guardar'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════
// TAB 2 · RETOS — productos con multiplicador
// ═══════════════════════════════════════════════════════════════════════
function RetosTab({ restauranteId, isGerencia, showToast }: any) {
  const [data, setData] = useState<any[]>([]);
  const [menuPlatos, setMenuPlatos] = useState<any[]>([]);
  const [editing, setEditing] = useState<any|null>(null);
  const [subiendo, setSubiendo] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const cargar = useCallback(async () => {
    const [r, mp] = await Promise.all([
      supabase.from('nx_retos').select('*').eq('restaurante_id', restauranteId).order('activo', { ascending: false }).order('multiplicador', { ascending: false }),
      supabase.from('menu_platos').select('id,nombre,emoji,categoria,precio_venta').eq('restaurante_id', restauranteId).eq('activo', true).order('nombre'),
    ]);
    setData(r.data || []);
    setMenuPlatos(mp.data || []);
  }, [restauranteId]);
  useEffect(() => { cargar(); }, [cargar]);

  const nuevo = () => setEditing({ restaurante_id:restauranteId, producto_nombre:'', emoji:'🍽️', multiplicador:2, activo:true, desde: new Date().toISOString().split('T')[0] });
  const guardar = async () => {
    if (!editing.producto_nombre) { showToast('⚠ Producto requerido'); return; }
    setSubiendo(true);
    const payload = { ...editing, updated_at: new Date().toISOString() };
    if (payload.id) {
      await supabase.from('nx_retos').update(payload).eq('id', payload.id);
    } else {
      await supabase.from('nx_retos').insert(payload);
    }
    setSubiendo(false);
    setEditing(null);
    cargar();
    showToast('✓ Reto guardado');
  };
  const eliminar = async () => {
    if (!editing?.id) { setEditing(null); return; }
    if (!confirm(`¿Eliminar el reto de "${editing.producto_nombre}"?`)) return;
    await supabase.from('nx_retos').delete().eq('id', editing.id);
    setEditing(null);
    cargar();
    showToast('Reto eliminado');
  };
  const onFile = async (file: File) => {
    setSubiendo(true);
    const url = await subirFotoNX(file, restauranteId, 'retos');
    if (url) setEditing((e:any)=>({...e, foto_url:url}));
    setSubiendo(false);
  };
  const elegirPlato = (p:any) => {
    setEditing((prev:any)=>({ ...prev, menu_plato_id: p.id, producto_nombre: p.nombre, emoji: p.emoji || '🍽️' }));
  };

  const MULTIS = [
    { v:2, label:'x2', color:S.cyan },
    { v:3, label:'x3', color:S.gold },
    { v:4, label:'x4', color:S.pink },
    { v:5, label:'x5', color:S.nx },
  ];

  return (
    <div style={{height:'100%', overflowY:'auto', padding:24}}>
      <div style={{display:'flex', alignItems:'center', marginBottom:18, gap:12}}>
        <div>
          <div style={{fontFamily:"'Syne',sans-serif", fontSize:16, fontWeight:900}}>🎯 Retos · Multiplicadores</div>
          <div style={{fontSize:11, color:S.t3}}>Platos que dan x2/x3/x4 puntos para que los meseros los recomienden</div>
        </div>
        {isGerencia && <button onClick={nuevo} style={{marginLeft:'auto', padding:'9px 18px', borderRadius:10, border:'none', background:`linear-gradient(135deg,${S.gold},#d4943a)`, color:'#000', fontSize:12, fontWeight:900, cursor:'pointer'}}>+ Nuevo reto</button>}
      </div>

      {data.length === 0 && <div style={{padding:60, textAlign:'center', color:S.t3}}><div style={{fontSize:50, marginBottom:12}}>🎯</div><div style={{fontSize:14, fontWeight:700}}>Aún sin retos activos</div><div style={{fontSize:11, color:S.t3, marginTop:6}}>Elige un plato del menú y dale x2, x3 o x4 puntos para impulsar la venta.</div></div>}

      <div style={{display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(240px, 1fr))', gap:14}}>
        {data.map(r => {
          const multi = MULTIS.find(m => m.v === r.multiplicador) || MULTIS[0];
          const venceEn = r.hasta ? Math.ceil((new Date(r.hasta+'T23:59:59').getTime() - Date.now()) / 86400000) : null;
          const expirado = venceEn !== null && venceEn < 0;
          return (
            <button key={r.id} onClick={()=>isGerencia && setEditing(r)}
              style={{background:S.bg2, border:`2px solid ${expirado?S.t3:r.activo?multi.color:S.border}`, borderRadius:14, overflow:'hidden', cursor:isGerencia?'pointer':'default', textAlign:'left' as const, padding:0, opacity:expirado?0.5:1}}>
              <div style={{height:130, background: r.foto_url ? `url(${r.foto_url}) center/cover` : `linear-gradient(135deg,${multi.color}30,${S.bg3})`, position:'relative'}}>
                <div style={{position:'absolute', top:8, left:8, background:multi.color, color:'#000', fontFamily:"'Syne',sans-serif", fontSize:20, fontWeight:900, padding:'4px 12px', borderRadius:50}}>{multi.label}</div>
                {!r.foto_url && <div style={{position:'absolute', inset:0, display:'flex', alignItems:'center', justifyContent:'center', fontSize:50, opacity:0.4}}>{r.emoji}</div>}
                {!r.activo && <div style={{position:'absolute', inset:0, background:'rgba(0,0,0,0.65)', display:'flex', alignItems:'center', justifyContent:'center', color:S.red, fontWeight:900}}>INACTIVO</div>}
                {expirado && <div style={{position:'absolute', inset:0, background:'rgba(0,0,0,0.55)', display:'flex', alignItems:'center', justifyContent:'center', color:S.red, fontWeight:900}}>EXPIRADO</div>}
                {r.destacado && <div style={{position:'absolute', top:8, right:8, fontSize:18}}>⭐</div>}
              </div>
              <div style={{padding:'12px 14px'}}>
                <div style={{fontSize:14, fontWeight:700, color:S.t1, marginBottom:4}}>{r.producto_nombre}</div>
                {r.motivacion_mesero && <div style={{fontSize:11, color:multi.color, marginBottom:6, fontStyle:'italic'}}>💪 {r.motivacion_mesero}</div>}
                <div style={{display:'flex', justifyContent:'space-between', fontSize:10, color:S.t3, marginTop:4}}>
                  <span>{r.veces_vendido||0} vendidos</span>
                  {venceEn !== null && <span style={{color:venceEn<3?S.red:S.t3}}>{venceEn<0?'expirado':venceEn===0?'vence hoy':`${venceEn}d restantes`}</span>}
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {editing && (
        <div onClick={()=>setEditing(null)} style={{position:'fixed', inset:0, background:'rgba(0,0,0,0.85)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:200, padding:20}}>
          <div onClick={e=>e.stopPropagation()} style={{background:'#0f0f1a', border:'1px solid rgba(255,255,255,0.1)', borderRadius:18, width:'100%', maxWidth:480, padding:24, maxHeight:'90vh', overflowY:'auto'}}>
            <div style={{fontFamily:"'Syne',sans-serif", fontSize:16, fontWeight:900, marginBottom:14, color:S.gold}}>{editing.id?'Editar':'Nuevo'} reto</div>
            <input type="file" accept="image/*" ref={fileRef} onChange={e=>e.target.files?.[0] && onFile(e.target.files[0])} style={{display:'none'}}/>
            <div onClick={()=>fileRef.current?.click()} style={{height:140, borderRadius:12, marginBottom:14, cursor:'pointer', background:editing.foto_url?`url(${editing.foto_url}) center/cover`:'rgba(255,255,255,0.03)', border:`1px dashed ${editing.foto_url?'transparent':S.border2}`, display:'flex', alignItems:'center', justifyContent:'center', color:S.t2, fontSize:13}}>{editing.foto_url?'🔄 Cambiar foto':'📷 Foto del producto (opcional)'}</div>

            <Field label="Elige del menú">
              <select value={editing.menu_plato_id||''} onChange={e=>{ const p = menuPlatos.find(x => x.id === Number(e.target.value)); if (p) elegirPlato(p); }} style={{...inp, colorScheme:'dark'}}>
                <option value="" style={{background:S.bg4}}>— Producto libre (escribir abajo) —</option>
                {menuPlatos.map((p:any) => <option key={p.id} value={p.id} style={{background:S.bg4}}>{p.emoji||'🍽️'} {p.nombre} · {p.categoria} · {fmtCOP(p.precio_venta||0)}</option>)}
              </select>
            </Field>
            <Field label="Nombre del producto"><input value={editing.producto_nombre||''} onChange={e=>setEditing((p:any)=>({...p, producto_nombre:e.target.value}))} style={inp}/></Field>
            <Field label="Multiplicador">
              <div style={{display:'flex', gap:8}}>
                {MULTIS.map(m => (
                  <button key={m.v} onClick={()=>setEditing((p:any)=>({...p, multiplicador:m.v}))} style={{flex:1, padding:'14px', borderRadius:10, border:`2px solid ${editing.multiplicador===m.v?m.color:S.border2}`, background:editing.multiplicador===m.v?`${m.color}20`:'transparent', color:editing.multiplicador===m.v?m.color:S.t2, fontFamily:"'Syne',sans-serif", fontSize:22, fontWeight:900, cursor:'pointer'}}>{m.label}</button>
                ))}
              </div>
            </Field>
            <Field label="Motivación para meseros"><input value={editing.motivacion_mesero||''} onChange={e=>setEditing((p:any)=>({...p, motivacion_mesero:e.target.value}))} placeholder='"Top del mes", "Vende 5 y gana premio"' style={inp}/></Field>
            <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:10}}>
              <Field label="Desde"><input type="date" value={editing.desde||''} onChange={e=>setEditing((p:any)=>({...p, desde:e.target.value}))} style={{...inp, colorScheme:'dark'}}/></Field>
              <Field label="Hasta (opcional)"><input type="date" value={editing.hasta||''} onChange={e=>setEditing((p:any)=>({...p, hasta:e.target.value}))} style={{...inp, colorScheme:'dark'}}/></Field>
            </div>
            <div style={{display:'flex', gap:14, marginBottom:14, marginTop:6}}>
              <label style={{display:'flex', alignItems:'center', gap:6, color:S.t2, fontSize:12, cursor:'pointer'}}>
                <input type="checkbox" checked={!!editing.destacado} onChange={e=>setEditing((p:any)=>({...p, destacado:e.target.checked}))}/>⭐ Destacado
              </label>
              <label style={{display:'flex', alignItems:'center', gap:6, color:S.t2, fontSize:12, cursor:'pointer'}}>
                <input type="checkbox" checked={!!editing.activo} onChange={e=>setEditing((p:any)=>({...p, activo:e.target.checked}))}/>✓ Activo
              </label>
            </div>
            <div style={{display:'flex', gap:8}}>
              {editing.id && <button onClick={eliminar} style={{padding:'10px 14px', borderRadius:9, border:'1px solid rgba(255,82,82,0.4)', background:'rgba(255,82,82,0.1)', color:S.red, fontSize:12, fontWeight:700, cursor:'pointer'}}>Eliminar</button>}
              <button onClick={()=>setEditing(null)} style={{flex:1, padding:'10px 14px', borderRadius:9, border:`1px solid ${S.border2}`, background:'transparent', color:S.t2, fontSize:12, fontWeight:700, cursor:'pointer'}}>Cancelar</button>
              <button onClick={guardar} disabled={subiendo} style={{flex:2, padding:'10px 14px', borderRadius:9, border:'none', background:`linear-gradient(135deg,${S.gold},#d4943a)`, color:'#000', fontSize:12, fontWeight:900, cursor:'pointer'}}>{subiendo?'...':'✓ Guardar'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════
// TAB 3 · SOLICITUDES — aprobar/rechazar/canjear
// ═══════════════════════════════════════════════════════════════════════
function SolicitudesTab({ restauranteId, isGerencia, miNombre, showToast }: any) {
  const [data, setData] = useState<any[]>([]);
  const [filtroEstado, setFiltroEstado] = useState<string>('pendiente');
  const [loading, setLoading] = useState(true);
  const [accionando, setAccionando] = useState<number|null>(null);
  // Nueva solicitud manual
  const [creando, setCreando] = useState(false);
  const [nueva, setNueva] = useState<any>({});
  const [beneficios, setBeneficios] = useState<any[]>([]);
  const [clientes, setClientes] = useState<any[]>([]);

  const cargar = useCallback(async () => {
    setLoading(true);
    let q: any = supabase.from('nx_solicitudes').select('*').eq('restaurante_id', restauranteId);
    if (filtroEstado !== 'todas') q = q.eq('estado', filtroEstado);
    q = q.order('solicitada_en', { ascending: false }).limit(200);
    const { data } = await q;
    setData(data || []);
    setLoading(false);
  }, [restauranteId, filtroEstado]);

  useEffect(() => {
    cargar();
    const ch = supabase.channel(`nx-solic-${restauranteId}`)
      .on('postgres_changes', { event:'*', schema:'public', table:'nx_solicitudes' }, () => cargar())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [cargar, restauranteId]);

  const abrirNueva = async () => {
    const [b, c] = await Promise.all([
      supabase.from('nx_beneficios').select('id,nombre,emoji,costo_puntos').eq('restaurante_id', restauranteId).eq('activo', true).order('costo_puntos'),
      supabase.from('customers').select('id,name,apellido,phone,puntos').gt('puntos', 0).order('puntos', { ascending: false }).limit(200),
    ]);
    setBeneficios(b.data || []);
    setClientes(c.data || []);
    setNueva({ restaurante_id: restauranteId, origen: 'pos', estado: 'pendiente' });
    setCreando(true);
  };
  const enviarNueva = async () => {
    if (!nueva.cliente_nombre) { showToast('⚠ Cliente requerido'); return; }
    if (!nueva.beneficio_id) { showToast('⚠ Elige beneficio'); return; }
    const b = beneficios.find(x => x.id === Number(nueva.beneficio_id));
    if (!b) return;
    const cli = clientes.find(x => String(x.id) === String(nueva.customer_id));
    const payload = {
      restaurante_id: restauranteId,
      customer_id: nueva.customer_id || null,
      cliente_nombre: nueva.cliente_nombre,
      cliente_telefono: nueva.cliente_telefono || cli?.phone || null,
      beneficio_id: b.id,
      beneficio_nombre: b.nombre,
      beneficio_emoji: b.emoji,
      costo_puntos: b.costo_puntos,
      puntos_disponibles: cli?.puntos || null,
      mesa_num: nueva.mesa_num || null,
      mesero: miNombre,
      origen: 'pos',
      estado: 'pendiente',
    };
    await supabase.from('nx_solicitudes').insert(payload);
    setCreando(false);
    setNueva({});
    showToast('✓ Solicitud creada · pendiente de aprobación');
  };

  const aprobar = async (s:any) => {
    setAccionando(s.id);
    await supabase.from('nx_solicitudes').update({ estado:'aprobada', aprobada_por: miNombre, aprobada_en: new Date().toISOString() }).eq('id', s.id);
    setAccionando(null);
    showToast(`✓ Aprobada · ${s.cliente_nombre}`);
  };
  const rechazar = async (s:any) => {
    const motivo = prompt(`¿Por qué rechazas la solicitud de ${s.cliente_nombre}?`);
    if (!motivo) return;
    setAccionando(s.id);
    await supabase.from('nx_solicitudes').update({ estado:'rechazada', aprobada_por: miNombre, aprobada_en: new Date().toISOString(), motivo_rechazo: motivo }).eq('id', s.id);
    setAccionando(null);
    showToast('Rechazada con motivo');
  };
  const canjear = async (s:any) => {
    if (!confirm(`¿Marcar como CANJEADO el beneficio "${s.beneficio_nombre}" para ${s.cliente_nombre}? Esto descontará ${fmtPts(s.costo_puntos)} de su wallet.`)) return;
    setAccionando(s.id);
    // 1. Update solicitud
    await supabase.from('nx_solicitudes').update({ estado:'canjeada', canjeada_en: new Date().toISOString() }).eq('id', s.id);
    // 2. Descontar puntos del cliente
    if (s.customer_id) {
      const { data: c } = await supabase.from('customers').select('puntos').eq('id', s.customer_id).maybeSingle();
      const saldoActual = c?.puntos || 0;
      const nuevoSaldo = Math.max(0, saldoActual - s.costo_puntos);
      await supabase.from('customers').update({ puntos: nuevoSaldo }).eq('id', s.customer_id);
      // 3. Registrar movimiento en wallet
      await supabase.from('nx_wallet_movimientos').insert({
        restaurante_id: restauranteId,
        customer_id: String(s.customer_id),
        cliente_nombre: s.cliente_nombre,
        tipo: 'canjea',
        puntos: -s.costo_puntos,
        saldo_resultante: nuevoSaldo,
        solicitud_id: s.id,
        mesa_num: s.mesa_num,
        mesero: s.mesero,
        motivo: `Canjeó: ${s.beneficio_nombre}`,
        aprobado_por: miNombre,
      });
      // 4. Incrementar veces_canjeado en el beneficio
      if (s.beneficio_id) {
        await supabase.rpc('increment_veces_canjeado', { p_beneficio_id: s.beneficio_id }).then(()=>{}, async () => {
          // Fallback si no hay RPC: read-modify-write
          const { data: b } = await supabase.from('nx_beneficios').select('veces_canjeado').eq('id', s.beneficio_id).maybeSingle();
          await supabase.from('nx_beneficios').update({ veces_canjeado: (b?.veces_canjeado||0) + 1 }).eq('id', s.beneficio_id);
        });
      }
    }
    setAccionando(null);
    showToast(`✅ Canjeado · ${s.beneficio_emoji||'🎁'} ${s.beneficio_nombre}`);
  };

  const ESTADOS = [
    { id:'pendiente', label:'Pendientes', color:S.gold },
    { id:'aprobada',  label:'Aprobadas',  color:S.green },
    { id:'canjeada',  label:'Canjeadas',  color:S.nx },
    { id:'rechazada', label:'Rechazadas', color:S.red },
    { id:'todas',     label:'Todas',      color:S.t2 },
  ];

  return (
    <div style={{height:'100%', overflowY:'auto', padding:24}}>
      <div style={{display:'flex', alignItems:'center', marginBottom:14, gap:12, flexWrap:'wrap'}}>
        <div>
          <div style={{fontFamily:"'Syne',sans-serif", fontSize:16, fontWeight:900}}>📥 Solicitudes de canje</div>
          <div style={{fontSize:11, color:S.t3}}>Clientes piden → cajero aprueba → se descuenta de la cuenta del wallet</div>
        </div>
        <button onClick={abrirNueva} style={{marginLeft:'auto', padding:'9px 18px', borderRadius:10, border:'none', background:`linear-gradient(135deg,${S.nx},#7c5ac7)`, color:'#fff', fontSize:12, fontWeight:900, cursor:'pointer'}}>+ Nueva solicitud</button>
      </div>

      <div style={{display:'flex', gap:6, marginBottom:14, flexWrap:'wrap'}}>
        {ESTADOS.map(e => (
          <button key={e.id} onClick={()=>setFiltroEstado(e.id)}
            style={{padding:'7px 14px', borderRadius:9, border:`1px solid ${filtroEstado===e.id?e.color:S.border2}`, background:filtroEstado===e.id?`${e.color}18`:'transparent', color:filtroEstado===e.id?e.color:S.t2, fontSize:11, fontWeight:700, cursor:'pointer'}}>
            {e.label}
          </button>
        ))}
      </div>

      {loading && <div style={{padding:40, textAlign:'center', color:S.t3}}>Cargando...</div>}
      {!loading && data.length === 0 && (
        <div style={{padding:60, textAlign:'center', color:S.t3}}>
          <div style={{fontSize:50, marginBottom:12}}>📭</div>
          <div style={{fontSize:14, fontWeight:700}}>Sin solicitudes {filtroEstado!=='todas'?`en "${filtroEstado}"`:''}</div>
        </div>
      )}

      <div style={{display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(320px, 1fr))', gap:12}}>
        {data.map(s => {
          const estadoColor = s.estado==='pendiente'?S.gold:s.estado==='aprobada'?S.green:s.estado==='canjeada'?S.nx:S.red;
          const horas = Math.floor((Date.now() - new Date(s.solicitada_en).getTime()) / 3600000);
          const puedeCanjear = (s.puntos_disponibles ?? Infinity) >= s.costo_puntos;
          return (
            <div key={s.id} style={{background:S.bg2, border:`1px solid ${estadoColor}30`, borderRadius:12, padding:14}}>
              <div style={{display:'flex', alignItems:'center', gap:10, marginBottom:10}}>
                <div style={{width:38, height:38, borderRadius:'50%', background:`${estadoColor}25`, color:estadoColor, display:'flex', alignItems:'center', justifyContent:'center', fontWeight:900, fontFamily:"'Syne',sans-serif"}}>{(s.cliente_nombre||'?').charAt(0).toUpperCase()}</div>
                <div style={{flex:1, minWidth:0}}>
                  <div style={{fontSize:13, fontWeight:700, color:S.t1}}>{s.cliente_nombre}</div>
                  <div style={{fontSize:10, color:S.t3}}>{s.cliente_telefono && `📱 ${s.cliente_telefono} · `}Hace {horas<1?'<1h':`${horas}h`} · {s.origen}</div>
                </div>
                <span style={{fontSize:9, padding:'3px 8px', borderRadius:50, background:`${estadoColor}20`, color:estadoColor, fontWeight:900, textTransform:'uppercase'}}>{s.estado}</span>
              </div>
              <div style={{padding:'10px 12px', background:S.bg3, borderRadius:10, marginBottom:10, display:'flex', alignItems:'center', gap:10}}>
                <span style={{fontSize:30}}>{s.beneficio_emoji || '🎁'}</span>
                <div style={{flex:1, minWidth:0}}>
                  <div style={{fontSize:12, fontWeight:700, color:S.t1}}>{s.beneficio_nombre}</div>
                  <div style={{fontSize:10, color:S.nx, fontWeight:700}}>Costo: {fmtPts(s.costo_puntos)}</div>
                  {s.puntos_disponibles !== null && (
                    <div style={{fontSize:10, color: puedeCanjear?S.green:S.red}}>
                      Wallet: {fmtPts(s.puntos_disponibles)} {puedeCanjear?'✓ Suficiente':'✗ Insuficiente'}
                    </div>
                  )}
                </div>
              </div>
              {s.mesa_num && <div style={{fontSize:10, color:S.t2, marginBottom:8}}>🪑 Mesa {s.mesa_num} · {s.mesero}</div>}
              {s.motivo_rechazo && <div style={{fontSize:11, color:S.red, marginBottom:8, padding:'6px 10px', background:'rgba(224,80,80,0.08)', borderRadius:8}}>⚠ Rechazada: {s.motivo_rechazo}</div>}

              {isGerencia && s.estado === 'pendiente' && (
                <div style={{display:'flex', gap:6}}>
                  <button onClick={()=>rechazar(s)} disabled={accionando===s.id} style={{flex:1, padding:'8px', borderRadius:9, border:'1px solid rgba(224,80,80,0.4)', background:'rgba(224,80,80,0.1)', color:S.red, fontSize:11, fontWeight:700, cursor:'pointer'}}>Rechazar</button>
                  <button onClick={()=>aprobar(s)} disabled={accionando===s.id || !puedeCanjear} style={{flex:2, padding:'8px', borderRadius:9, border:'none', background:puedeCanjear?'linear-gradient(135deg,#3dba6f,#00B050)':S.t3, color:'#fff', fontSize:11, fontWeight:900, cursor:puedeCanjear?'pointer':'not-allowed'}} title={puedeCanjear?'':'Insuficientes puntos'}>{accionando===s.id?'...':'✓ Aprobar'}</button>
                </div>
              )}
              {isGerencia && s.estado === 'aprobada' && (
                <button onClick={()=>canjear(s)} disabled={accionando===s.id} style={{width:'100%', padding:'9px', borderRadius:9, border:'none', background:`linear-gradient(135deg,${S.nx},#7c5ac7)`, color:'#fff', fontSize:11, fontWeight:900, cursor:'pointer'}}>{accionando===s.id?'...':'✅ Marcar como canjeado'}</button>
              )}
              {s.estado === 'canjeada' && s.canjeada_en && <div style={{fontSize:10, color:S.nx, textAlign:'center'}}>Canjeado {new Date(s.canjeada_en).toLocaleDateString('es-CO',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'})}</div>}
            </div>
          );
        })}
      </div>

      {/* Modal nueva solicitud */}
      {creando && (
        <div onClick={()=>setCreando(false)} style={{position:'fixed', inset:0, background:'rgba(0,0,0,0.85)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:200, padding:20}}>
          <div onClick={e=>e.stopPropagation()} style={{background:'#0f0f1a', border:'1px solid rgba(255,255,255,0.1)', borderRadius:18, width:'100%', maxWidth:440, padding:24, maxHeight:'90vh', overflowY:'auto'}}>
            <div style={{fontFamily:"'Syne',sans-serif", fontSize:16, fontWeight:900, marginBottom:14, color:S.nx}}>+ Nueva solicitud de canje</div>
            <Field label="Cliente registrado (opcional)">
              <select value={nueva.customer_id||''} onChange={e=>{ const cli = clientes.find(c => String(c.id) === e.target.value); setNueva({...nueva, customer_id:e.target.value, cliente_nombre: cli ? `${cli.name||''} ${cli.apellido||''}`.trim() : nueva.cliente_nombre, cliente_telefono: cli?.phone||'' }); }} style={{...inp, colorScheme:'dark'}}>
                <option value="" style={{background:S.bg4}}>— Cliente walk-in / sin registro —</option>
                {clientes.map((c:any) => <option key={c.id} value={c.id} style={{background:S.bg4}}>{c.name} {c.apellido||''} · {fmtPts(c.puntos)}</option>)}
              </select>
            </Field>
            <Field label="Nombre cliente *"><input value={nueva.cliente_nombre||''} onChange={e=>setNueva({...nueva, cliente_nombre:e.target.value})} style={inp}/></Field>
            <Field label="Teléfono"><input value={nueva.cliente_telefono||''} onChange={e=>setNueva({...nueva, cliente_telefono:e.target.value})} style={inp}/></Field>
            <Field label="Beneficio *">
              <select value={nueva.beneficio_id||''} onChange={e=>setNueva({...nueva, beneficio_id:e.target.value})} style={{...inp, colorScheme:'dark'}}>
                <option value="" style={{background:S.bg4}}>— Elige beneficio —</option>
                {beneficios.map((b:any) => <option key={b.id} value={b.id} style={{background:S.bg4}}>{b.emoji} {b.nombre} · {fmtPts(b.costo_puntos)}</option>)}
              </select>
            </Field>
            <Field label="Mesa (si aplica)"><input type="number" value={nueva.mesa_num||''} onChange={e=>setNueva({...nueva, mesa_num:Number(e.target.value)||null})} style={inp}/></Field>
            <div style={{display:'flex', gap:8, marginTop:6}}>
              <button onClick={()=>setCreando(false)} style={{flex:1, padding:'10px 14px', borderRadius:9, border:`1px solid ${S.border2}`, background:'transparent', color:S.t2, fontSize:12, fontWeight:700, cursor:'pointer'}}>Cancelar</button>
              <button onClick={enviarNueva} style={{flex:2, padding:'10px 14px', borderRadius:9, border:'none', background:`linear-gradient(135deg,${S.nx},#7c5ac7)`, color:'#fff', fontSize:12, fontWeight:900, cursor:'pointer'}}>✓ Crear solicitud</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════
// TAB 4 · HISTORIAL — movimientos reales completos
// ═══════════════════════════════════════════════════════════════════════
function HistorialTab({ restauranteId }: any) {
  const [movs, setMovs] = useState<any[]>([]);
  const [solics, setSolics] = useState<any[]>([]);
  const [vista, setVista] = useState<'movimientos'|'solicitudes'>('movimientos');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const [m, s] = await Promise.all([
        supabase.from('nx_wallet_movimientos').select('*').eq('restaurante_id', restauranteId).order('created_at', { ascending: false }).limit(500),
        supabase.from('nx_solicitudes').select('*').eq('restaurante_id', restauranteId).in('estado', ['canjeada','rechazada']).order('canjeada_en', { ascending: false, nullsFirst: false }).limit(500),
      ]);
      setMovs(m.data || []);
      setSolics(s.data || []);
      setLoading(false);
    })();
  }, [restauranteId]);

  const totales = useMemo(() => {
    const ganados = movs.filter(m => m.puntos > 0).reduce((s,m) => s + m.puntos, 0);
    const canjeados = movs.filter(m => m.puntos < 0).reduce((s,m) => s + Math.abs(m.puntos), 0);
    return { ganados, canjeados, balance: ganados - canjeados };
  }, [movs]);

  return (
    <div style={{height:'100%', overflowY:'auto', padding:24}}>
      <div style={{display:'flex', alignItems:'center', marginBottom:16, gap:12, flexWrap:'wrap'}}>
        <div>
          <div style={{fontFamily:"'Syne',sans-serif", fontSize:16, fontWeight:900}}>📜 Historial completo</div>
          <div style={{fontSize:11, color:S.t3}}>Movimientos del wallet + solicitudes cerradas</div>
        </div>
        <div style={{marginLeft:'auto', display:'flex', gap:14}}>
          <Kpi label="Ganados"   value={fmtPts(totales.ganados)}   color={S.green}/>
          <Kpi label="Canjeados" value={fmtPts(totales.canjeados)} color={S.nx}/>
          <Kpi label="Balance"   value={fmtPts(totales.balance)}   color={S.gold}/>
        </div>
      </div>

      <div style={{display:'flex', gap:6, marginBottom:14}}>
        {[
          { id:'movimientos' as const, label:`💸 Movimientos wallet (${movs.length})` },
          { id:'solicitudes' as const, label:`📋 Solicitudes cerradas (${solics.length})` },
        ].map(t => (
          <button key={t.id} onClick={()=>setVista(t.id)} style={{padding:'7px 14px', borderRadius:9, border:`1px solid ${vista===t.id?S.nx:S.border2}`, background:vista===t.id?`${S.nx}18`:'transparent', color:vista===t.id?S.nx:S.t2, fontSize:11, fontWeight:700, cursor:'pointer'}}>{t.label}</button>
        ))}
      </div>

      {loading && <div style={{padding:40, textAlign:'center', color:S.t3}}>Cargando...</div>}

      {vista === 'movimientos' && (
        <div style={{background:S.bg2, border:`1px solid ${S.border}`, borderRadius:12, overflow:'hidden'}}>
          {movs.length === 0 ? (
            <div style={{padding:60, textAlign:'center', color:S.t3}}>Sin movimientos aún</div>
          ) : (
            movs.map((m, i) => {
              const positivo = m.puntos > 0;
              const tipoColor = m.tipo==='gana'?S.green:m.tipo==='canjea'?S.nx:m.tipo==='bono'?S.cyan:m.tipo.includes('ajuste_pos')?S.gold:S.red;
              return (
                <div key={m.id} style={{padding:'12px 18px', borderBottom: i===movs.length-1?'none':`1px solid ${S.border}`, display:'flex', alignItems:'center', gap:12}}>
                  <div style={{width:36, height:36, borderRadius:9, background:`${tipoColor}20`, color:tipoColor, display:'flex', alignItems:'center', justifyContent:'center', fontWeight:900, fontSize:14, flexShrink:0}}>{positivo?'+':'−'}</div>
                  <div style={{flex:1, minWidth:0}}>
                    <div style={{fontSize:13, color:S.t1, fontWeight:700}}>{m.cliente_nombre || '(cliente)'} · <span style={{color:tipoColor, textTransform:'uppercase', fontSize:10}}>{m.tipo}</span></div>
                    {m.motivo && <div style={{fontSize:11, color:S.t2}}>{m.motivo}</div>}
                    <div style={{fontSize:10, color:S.t3}}>{new Date(m.created_at).toLocaleString('es-CO', {day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit'})}{m.mesa_num?` · Mesa ${m.mesa_num}`:''}{m.mesero?` · ${m.mesero}`:''}</div>
                  </div>
                  <div style={{textAlign:'right'}}>
                    <div style={{fontFamily:"'Syne',sans-serif", fontSize:16, fontWeight:900, color:tipoColor}}>{positivo?'+':''}{m.puntos.toLocaleString('es-CO')}</div>
                    {m.saldo_resultante !== null && <div style={{fontSize:10, color:S.t3}}>Saldo: {fmtPts(m.saldo_resultante)}</div>}
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {vista === 'solicitudes' && (
        <div style={{background:S.bg2, border:`1px solid ${S.border}`, borderRadius:12, overflow:'hidden'}}>
          {solics.length === 0 ? (
            <div style={{padding:60, textAlign:'center', color:S.t3}}>Sin solicitudes cerradas</div>
          ) : (
            solics.map((s, i) => {
              const color = s.estado==='canjeada'?S.nx:S.red;
              const fecha = s.canjeada_en || s.aprobada_en || s.solicitada_en;
              return (
                <div key={s.id} style={{padding:'12px 18px', borderBottom: i===solics.length-1?'none':`1px solid ${S.border}`, display:'flex', alignItems:'center', gap:12}}>
                  <span style={{fontSize:24}}>{s.beneficio_emoji||'🎁'}</span>
                  <div style={{flex:1, minWidth:0}}>
                    <div style={{fontSize:13, color:S.t1, fontWeight:700}}>{s.cliente_nombre} · {s.beneficio_nombre}</div>
                    <div style={{fontSize:10, color:S.t3}}>{new Date(fecha).toLocaleString('es-CO',{day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit'})} · {s.aprobada_por || s.mesero || '—'}</div>
                  </div>
                  <div style={{textAlign:'right'}}>
                    <span style={{fontSize:9, padding:'3px 8px', borderRadius:50, background:`${color}20`, color, fontWeight:900, textTransform:'uppercase'}}>{s.estado}</span>
                    <div style={{fontFamily:"'Syne',sans-serif", fontSize:13, color, fontWeight:900, marginTop:3}}>{fmtPts(s.costo_puntos)}</div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════
// TAB 5 · ADMIN — config global del programa
// ═══════════════════════════════════════════════════════════════════════
function AdminTab({ restauranteId, showToast }: any) {
  const [topClientes, setTop] = useState<any[]>([]);
  useEffect(() => {
    (async () => {
      const { data } = await supabase.from('customers').select('id,name,apellido,phone,puntos,total_visits').gt('puntos', 0).order('puntos', { ascending:false }).limit(20);
      setTop(data || []);
    })();
  }, [restauranteId]);

  return (
    <div style={{height:'100%', overflowY:'auto', padding:24}}>
      <div style={{fontFamily:"'Syne',sans-serif", fontSize:16, fontWeight:900, marginBottom:6}}>⚙️ Administración del programa</div>
      <div style={{fontSize:11, color:S.t3, marginBottom:18}}>Configuración general · Top wallets · Acceso a APIs externas</div>

      {/* Regla de ganancia */}
      <div style={{background:S.bg2, border:`1px solid ${S.border}`, borderRadius:12, padding:16, marginBottom:16}}>
        <div style={{fontFamily:"'Syne',sans-serif", fontSize:13, fontWeight:900, color:S.nx, marginBottom:6}}>📐 Regla de acumulación</div>
        <div style={{fontSize:12, color:S.t2, lineHeight:1.6}}>
          Cada $1.000 consumidos = <strong style={{color:S.t1}}>1 punto NX</strong>. Una cuenta de $50.000 acumula 50 pts; $100.000 = 100 pts.
          <br/>
          Los puntos se otorgan al CERRAR la cuenta y quedan registrados en el wallet del cliente.
          <br/>
          Los productos del tab "Retos" multiplican x2/x3/x4/x5 los puntos sobre su valor de venta.
        </div>
      </div>

      {/* Top wallets */}
      <div style={{background:S.bg2, border:`1px solid ${S.border}`, borderRadius:12, overflow:'hidden'}}>
        <div style={{padding:'12px 18px', borderBottom:`1px solid ${S.border}`, display:'flex', alignItems:'center', justifyContent:'space-between'}}>
          <div style={{fontFamily:"'Syne',sans-serif", fontSize:13, fontWeight:900, color:S.nx}}>👑 Top 20 wallets</div>
          <span style={{fontSize:10, color:S.t3}}>Clientes con más puntos acumulados</span>
        </div>
        {topClientes.length === 0 ? (
          <div style={{padding:30, textAlign:'center', color:S.t3, fontSize:11}}>Aún sin clientes con puntos</div>
        ) : (
          topClientes.map((c, i) => (
            <div key={c.id} style={{padding:'10px 18px', borderTop:i===0?'none':`1px solid ${S.border}`, display:'flex', alignItems:'center', gap:12}}>
              <div style={{width:24, fontSize:11, color: i<3?S.gold:S.t3, fontWeight:900, textAlign:'center'}}>#{i+1}</div>
              <div style={{flex:1}}>
                <div style={{fontSize:12, color:S.t1, fontWeight:700}}>{c.name} {c.apellido||''}</div>
                <div style={{fontSize:10, color:S.t3}}>{c.phone||'—'} · {c.total_visits||0} visitas</div>
              </div>
              <div style={{fontFamily:"'Syne',sans-serif", fontSize:14, fontWeight:900, color:S.nx}}>{fmtPts(c.puntos)}</div>
            </div>
          ))
        )}
      </div>

      <div style={{marginTop:18, padding:'12px 16px', background:'rgba(68,138,255,0.06)', border:`1px solid ${S.blue}25`, borderRadius:10, fontSize:11, color:S.t2}}>
        <strong style={{color:S.blue}}>ℹ Próximas funciones de admin:</strong> Endpoint público para la app Seratta del cliente (lectura wallet + envío solicitudes), expiración automática de puntos a los N meses, niveles de membresía (Iniciado → La Crème), exportar movimientos a CSV.
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════
// Estilos compartidos
// ═══════════════════════════════════════════════════════════════════════
const inp: React.CSSProperties = {
  width:'100%', padding:'10px 12px', borderRadius:9,
  border:'1px solid rgba(255,255,255,0.12)', background:'rgba(255,255,255,0.04)',
  color:'#fff', fontSize:13, outline:'none',
};

function Field({ label, children }: { label:string; children: React.ReactNode }) {
  return (
    <div style={{marginBottom:10}}>
      <div style={{fontSize:10, color:S.t3, fontWeight:700, marginBottom:4, textTransform:'uppercase', letterSpacing:'.05em'}}>{label}</div>
      {children}
    </div>
  );
}
