// ============================================================
// NEXUM — OhYeahAdmin.tsx
// Módulo admin de restaurantes para Oh Yeah!
// Gestiona restaurantes Seratta + externos curados
// src/components/OhYeahAdmin.tsx
// ============================================================

import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

const S = {
  bg:'#0a0a0a', bg2:'#141414', bg3:'#1c1c1c',
  border:'#2a2a2a', text1:'#f0f0f0', text2:'#a0a0a0', text3:'#606060',
  gold:'#d4943a', goldL:'#f0b45a', green:'#3dba6f',
  red:'#e05050', blue:'#4a8fd4', purple:'#9b72ff',
  pink:'#FF007F', yellow:'#DFFF00',
};

const MOODS = ['Primera Cita','Celebrar en Grande','Impresionar','Romanticón','Con Buena VIBRA!','Algo Diferente'];
const CATEGORIAS = ['fine-dining','casual','bar','coctelería','brunch','fusión','internacional'];
const NIVELES_CURADURIA = [
  { id:'top', label:'TOP 10', color:S.pink, desc:'Los mejores del ecosistema' },
  { id:'curado', label:'CURADO', color:S.goldL, desc:'Seleccionado por el equipo' },
  { id:'nuevo', label:'RECIÉN AGREGADO', color:S.yellow, desc:'Nuevo en la plataforma' },
  { id:'menu', label:'NUEVO MENÚ', color:S.purple, desc:'Menú actualizado recientemente' },
  { id:'privado', label:'PRIVADO', color:S.text3, desc:'Solo Gourmand Society' },
];

interface Restaurante {
  id: string;
  nombre: string;
  emoji: string;
  tipo: string;
  precio: string;
  estrellas: number;
  badge: string;
  descripcion: string;
  seratta: boolean;
  mood: string[];
  categoria: string;
  activo: boolean;
  orden: number;
  ciudad: string;
  direccion: string;
  instagram: string;
  telefono: string;
  nivel_curaduria: string;
  created_at?: string;
}

const RESTAURANTES_MOCK: Restaurante[] = [
  { id:'1', nombre:'OMM', emoji:'🍣', tipo:'Japonés · Coctelería', precio:'$$$$$', estrellas:5, badge:'top', descripcion:'Ritual gastronómico japonés en el corazón de Bogotá.', seratta:true, mood:['Romanticón','Impresionar','Algo Diferente'], categoria:'fine-dining', activo:true, orden:1, ciudad:'Bogotá', direccion:'Cra. 13 #85-35', instagram:'@ommbogota', telefono:'+57 1 234 5678', nivel_curaduria:'top' },
  { id:'2', nombre:'SELVATÍCO', emoji:'🍕', tipo:'Italiano', precio:'$$$', estrellas:4, badge:'top', descripcion:'Cucina italiana con alma salvaje.', seratta:false, mood:['Primera Cita','Con Buena VIBRA!'], categoria:'casual', activo:true, orden:2, ciudad:'Bogotá', direccion:'Calle 93 #14-22', instagram:'@selvatico.bog', telefono:'+57 1 345 6789', nivel_curaduria:'top' },
  { id:'3', nombre:'MAREA', emoji:'🦞', tipo:'Cocina de autor', precio:'$$$$', estrellas:4, badge:'new', descripcion:'Alta cocina con ingredientes del mar colombiano.', seratta:false, mood:['Impresionar','Romanticón'], categoria:'fine-dining', activo:true, orden:3, ciudad:'Bogotá', direccion:'Cra. 7 #71-52', instagram:'@marea.bog', telefono:'+57 1 456 7890', nivel_curaduria:'nuevo' },
];

type Tab = 'lista' | 'agregar' | 'stats';

const EMPTY_REST: Omit<Restaurante, 'id' | 'created_at'> = {
  nombre:'', emoji:'🍽️', tipo:'', precio:'$$$', estrellas:4, badge:'curado',
  descripcion:'', seratta:false, mood:[], categoria:'casual', activo:true,
  orden:99, ciudad:'Bogotá', direccion:'', instagram:'', telefono:'',
  nivel_curaduria:'curado',
};

export default function OhYeahAdmin() {
  const [tab, setTab] = useState<Tab>('lista');
  const [restaurantes, setRestaurantes] = useState<Restaurante[]>(RESTAURANTES_MOCK);
  const [editando, setEditando] = useState<Restaurante | null>(null);
  const [form, setForm] = useState<Omit<Restaurante,'id'|'created_at'>>(EMPTY_REST);
  const [toast, setToast] = useState('');
  const [busqueda, setBusqueda] = useState('');
  const [filtroTipo, setFiltroTipo] = useState('todos');
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(''), 3000);
  };

  const set = (field: string, value: any) => setForm(prev => ({ ...prev, [field]: value }));
  const toggleMood = (m: string) => set('mood', form.mood.includes(m) ? form.mood.filter(x => x !== m) : [...form.mood, m]);

  const guardar = () => {
    if (!form.nombre) { showToast('⚠️ El nombre es obligatorio'); return; }
    if (editando) {
      setRestaurantes(prev => prev.map(r => r.id === editando.id ? { ...r, ...form } : r));
      showToast(`✓ ${form.nombre} actualizado`);
    } else {
      const nuevo: Restaurante = { ...form, id: Date.now().toString(), created_at: new Date().toISOString() };
      setRestaurantes(prev => [...prev, nuevo]);
      showToast(`✓ ${form.nombre} agregado a Oh Yeah!`);
    }
    setEditando(null);
    setForm(EMPTY_REST);
    setTab('lista');
  };

  const iniciarEdicion = (r: Restaurante) => {
    setEditando(r);
    const { id, created_at, ...rest } = r;
    setForm(rest);
    setTab('agregar');
  };

  const eliminar = (id: string) => {
    setRestaurantes(prev => prev.filter(r => r.id !== id));
    setConfirmDelete(null);
    showToast('Restaurante eliminado');
  };

  const toggleActivo = (id: string) => {
    setRestaurantes(prev => prev.map(r => r.id === id ? { ...r, activo: !r.activo } : r));
  };

  const restFiltrados = restaurantes.filter(r => {
    const matchBusq = r.nombre.toLowerCase().includes(busqueda.toLowerCase());
    const matchTipo = filtroTipo === 'todos' ? true : filtroTipo === 'seratta' ? r.seratta : filtroTipo === 'externos' ? !r.seratta : r.nivel_curaduria === filtroTipo;
    return matchBusq && matchTipo;
  });

  const inp = { background:S.bg2, border:`1px solid ${S.border}`, borderRadius:8, padding:'9px 14px', color:S.text1, fontSize:12, outline:'none', width:'100%' };
  const label = (text: string, req?: boolean) => (
    <div style={{ fontSize:10, color:S.text3, marginBottom:6, fontWeight:700, textTransform:'uppercase' as const, letterSpacing:'0.07em' }}>
      {text}{req && <span style={{ color:S.red }}> *</span>}
    </div>
  );

  return (
    <div style={{ display:'flex', flexDirection:'column', height:'100%', background:S.bg, color:S.text1, fontFamily:"'DM Sans', sans-serif" }}>

      {/* Toast */}
      {toast && (
        <div style={{ position:'fixed', bottom:24, left:'50%', transform:'translateX(-50%)', background:'#222', border:`1px solid ${S.border}`, color:S.text1, padding:'10px 20px', borderRadius:10, fontSize:13, zIndex:9999, whiteSpace:'nowrap' }}>
          {toast}
        </div>
      )}

      {/* Confirm delete */}
      {confirmDelete && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.8)', zIndex:600, display:'flex', alignItems:'center', justifyContent:'center', padding:20 }}>
          <div style={{ background:S.bg3, border:`1px solid ${S.red}40`, borderRadius:16, padding:28, maxWidth:380, width:'100%', textAlign:'center' }}>
            <div style={{ fontSize:32, marginBottom:12 }}>⚠️</div>
            <div style={{ fontSize:15, fontWeight:700, marginBottom:8 }}>¿Eliminar restaurante?</div>
            <div style={{ fontSize:12, color:S.text3, marginBottom:24 }}>Esta acción no se puede deshacer.</div>
            <div style={{ display:'flex', gap:10 }}>
              <button onClick={() => setConfirmDelete(null)} style={{ flex:1, padding:12, borderRadius:10, border:`1px solid ${S.border}`, background:'none', color:S.text2, fontSize:12, fontWeight:700, cursor:'pointer' }}>Cancelar</button>
              <button onClick={() => eliminar(confirmDelete)} style={{ flex:1, padding:12, borderRadius:10, border:'none', background:S.red, color:'#fff', fontSize:12, fontWeight:700, cursor:'pointer' }}>Eliminar</button>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div style={{ padding:'16px 24px', borderBottom:`1px solid ${S.border}`, display:'flex', alignItems:'center', justifyContent:'space-between', flexShrink:0 }}>
        <div style={{ display:'flex', alignItems:'center', gap:12 }}>
          <div style={{ width:36, height:36, borderRadius:10, background:'#FF007F', display:'flex', alignItems:'center', justifyContent:'center', fontSize:18 }}>✦</div>
          <div>
            <div style={{ fontFamily:"'Syne', sans-serif", fontSize:16, fontWeight:900 }}>OH YEAH! ADMIN</div>
            <div style={{ fontSize:11, color:S.text3 }}>Gestión de restaurantes curados</div>
          </div>
        </div>
        <div style={{ display:'flex', gap:8, alignItems:'center' }}>
          <div style={{ fontSize:12, color:S.text3 }}>
            <span style={{ color:S.green, fontWeight:700 }}>{restaurantes.filter(r=>r.activo).length}</span> activos · <span style={{ fontWeight:700 }}>{restaurantes.length}</span> total
          </div>
          <button onClick={() => { setEditando(null); setForm(EMPTY_REST); setTab('agregar'); }}
            style={{ background:S.pink, color:'#fff', border:'none', borderRadius:8, padding:'8px 16px', fontSize:12, fontWeight:700, cursor:'pointer', display:'flex', alignItems:'center', gap:6 }}>
            + Agregar restaurante
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display:'flex', borderBottom:`1px solid ${S.border}`, flexShrink:0 }}>
        {([{id:'lista',label:'📋 Lista'},{id:'agregar',label: editando ? '✏️ Editando' : '➕ Agregar'},{id:'stats',label:'📊 Stats'}] as const).map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            style={{ padding:'12px 20px', background:'none', border:'none', cursor:'pointer', fontSize:12, fontWeight:700, color: tab === t.id ? S.pink : S.text3, borderBottom:`2px solid ${tab === t.id ? S.pink : 'transparent'}`, transition:'all 0.15s' }}>
            {t.label}
          </button>
        ))}
      </div>

      <div style={{ flex:1, overflowY:'auto', padding:16 }}>

        {/* ── LISTA ── */}
        {tab === 'lista' && (
          <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
            {/* Filtros */}
            <div style={{ display:'flex', gap:10, flexWrap:'wrap', alignItems:'center' }}>
              <input value={busqueda} onChange={e => setBusqueda(e.target.value)}
                placeholder="🔍 Buscar restaurante..."
                style={{ ...inp, width:220, flexShrink:0 }} />
              {[{id:'todos',label:'Todos'},{id:'seratta',label:'🏠 Seratta'},{id:'externos',label:'🌐 Externos'},{id:'top',label:'TOP 10'},{id:'nuevo',label:'Nuevos'}].map(f => (
                <button key={f.id} onClick={() => setFiltroTipo(f.id)}
                  style={{ padding:'7px 14px', borderRadius:20, border:`1px solid ${filtroTipo === f.id ? S.pink : S.border}`, background: filtroTipo === f.id ? `${S.pink}18` : 'transparent', color: filtroTipo === f.id ? S.pink : S.text3, fontSize:11, fontWeight:700, cursor:'pointer', transition:'all .2s' }}>
                  {f.label}
                </button>
              ))}
            </div>

            {/* Tabla */}
            <div style={{ background:S.bg2, border:`1px solid ${S.border}`, borderRadius:14, overflow:'hidden' }}>
              <table style={{ width:'100%', borderCollapse:'collapse', fontSize:12 }}>
                <thead>
                  <tr style={{ background:S.bg3 }}>
                    {['','Restaurante','Tipo','Ciudad','Nivel','Moods','Estado','Acciones'].map(h => (
                      <th key={h} style={{ padding:'10px 12px', textAlign:'left', color:S.text3, fontWeight:700, fontSize:10, textTransform:'uppercase', letterSpacing:'0.06em', whiteSpace:'nowrap' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {restFiltrados.length === 0 ? (
                    <tr><td colSpan={8} style={{ padding:32, textAlign:'center', color:S.text3 }}>No hay restaurantes que coincidan</td></tr>
                  ) : restFiltrados.sort((a,b) => a.orden - b.orden).map(r => {
                    const nivel = NIVELES_CURADURIA.find(n => n.id === r.nivel_curaduria);
                    return (
                      <tr key={r.id} style={{ borderTop:`1px solid ${S.border}`, opacity: r.activo ? 1 : 0.5 }}>
                        <td style={{ padding:'10px 12px', fontSize:24 }}>{r.emoji}</td>
                        <td style={{ padding:'10px 12px' }}>
                          <div style={{ fontWeight:700, color:S.text1 }}>{r.nombre}</div>
                          <div style={{ fontSize:10, color:S.text3, marginTop:2 }}>
                            {r.seratta && <span style={{ background:`${S.pink}20`, color:S.pink, padding:'1px 6px', borderRadius:10, fontSize:9, fontWeight:700, marginRight:4 }}>SERATTA</span>}
                            {r.precio}
                          </div>
                        </td>
                        <td style={{ padding:'10px 12px', color:S.text2 }}>{r.tipo}</td>
                        <td style={{ padding:'10px 12px', color:S.text2 }}>{r.ciudad}</td>
                        <td style={{ padding:'10px 12px' }}>
                          {nivel && (
                            <span style={{ background:`${nivel.color}20`, color:nivel.color, padding:'3px 8px', borderRadius:10, fontSize:10, fontWeight:700, whiteSpace:'nowrap' }}>
                              {nivel.label}
                            </span>
                          )}
                        </td>
                        <td style={{ padding:'10px 12px' }}>
                          <div style={{ display:'flex', gap:4, flexWrap:'wrap' }}>
                            {r.mood.slice(0,2).map(m => (
                              <span key={m} style={{ background:`${S.border}`, color:S.text3, padding:'2px 6px', borderRadius:8, fontSize:9 }}>{m}</span>
                            ))}
                            {r.mood.length > 2 && <span style={{ color:S.text3, fontSize:9 }}>+{r.mood.length-2}</span>}
                          </div>
                        </td>
                        <td style={{ padding:'10px 12px' }}>
                          <div onClick={() => toggleActivo(r.id)} style={{ width:36, height:20, borderRadius:10, background: r.activo ? S.green : S.border, position:'relative', cursor:'pointer', transition:'background .2s' }}>
                            <div style={{ position:'absolute', top:2, left: r.activo ? 18 : 2, width:16, height:16, borderRadius:'50%', background:'#fff', transition:'left .2s' }}/>
                          </div>
                        </td>
                        <td style={{ padding:'10px 12px' }}>
                          <div style={{ display:'flex', gap:6 }}>
                            <button onClick={() => iniciarEdicion(r)}
                              style={{ background:S.bg3, border:`1px solid ${S.border}`, color:S.text2, padding:'5px 10px', borderRadius:8, fontSize:11, cursor:'pointer', transition:'all .2s' }}
                              onMouseEnter={e => { e.currentTarget.style.borderColor=S.gold; e.currentTarget.style.color=S.gold; }}
                              onMouseLeave={e => { e.currentTarget.style.borderColor=S.border; e.currentTarget.style.color=S.text2; }}>
                              ✏️ Editar
                            </button>
                            <button onClick={() => setConfirmDelete(r.id)}
                              style={{ background:S.bg3, border:`1px solid ${S.border}`, color:S.text3, padding:'5px 10px', borderRadius:8, fontSize:11, cursor:'pointer', transition:'all .2s' }}
                              onMouseEnter={e => { e.currentTarget.style.borderColor=S.red; e.currentTarget.style.color=S.red; }}
                              onMouseLeave={e => { e.currentTarget.style.borderColor=S.border; e.currentTarget.style.color=S.text3; }}>
                              🗑
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ── AGREGAR / EDITAR ── */}
        {tab === 'agregar' && (
          <div style={{ maxWidth:720, display:'flex', flexDirection:'column', gap:16 }}>
            {editando && (
              <div style={{ padding:12, background:`${S.gold}10`, border:`1px solid ${S.gold}30`, borderRadius:10, fontSize:12, color:S.goldL }}>
                ✏️ Editando: <strong>{editando.nombre}</strong>
                <button onClick={() => { setEditando(null); setForm(EMPTY_REST); }} style={{ marginLeft:12, background:'none', border:'none', color:S.text3, cursor:'pointer', fontSize:11 }}>Cancelar edición</button>
              </div>
            )}

            {/* Info básica */}
            <div style={{ background:S.bg2, border:`1px solid ${S.border}`, borderRadius:14, padding:18 }}>
              <div style={{ fontSize:11, color:S.pink, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.1em', marginBottom:14 }}>Información básica</div>
              <div style={{ display:'grid', gridTemplateColumns:'60px 1fr', gap:12, marginBottom:12 }}>
                <div>
                  {label('Emoji')}
                  <input style={{ ...inp, textAlign:'center', fontSize:24 }} value={form.emoji} onChange={e => set('emoji', e.target.value)} maxLength={2} />
                </div>
                <div>
                  {label('Nombre del restaurante', true)}
                  <input style={inp} value={form.nombre} onChange={e => set('nombre', e.target.value)} placeholder="Ej: SELVATÍCO" />
                </div>
              </div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, marginBottom:12 }}>
                <div>
                  {label('Tipo de cocina')}
                  <input style={inp} value={form.tipo} onChange={e => set('tipo', e.target.value)} placeholder="Ej: Japonés · Coctelería" />
                </div>
                <div>
                  {label('Rango de precios')}
                  <select style={{ ...inp }} value={form.precio} onChange={e => set('precio', e.target.value)}>
                    {['$','$$','$$$','$$$$','$$$$$'].map(p => <option key={p}>{p}</option>)}
                  </select>
                </div>
              </div>
              <div>
                {label('Descripción')}
                <textarea style={{ ...inp, minHeight:80, resize:'vertical' }} value={form.descripcion}
                  onChange={e => set('descripcion', e.target.value)}
                  placeholder="Describe el concepto, ambiente y propuesta gastronómica..." />
              </div>
            </div>

            {/* Ubicación */}
            <div style={{ background:S.bg2, border:`1px solid ${S.border}`, borderRadius:14, padding:18 }}>
              <div style={{ fontSize:11, color:S.goldL, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.1em', marginBottom:14 }}>Ubicación y contacto</div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, marginBottom:12 }}>
                <div>
                  {label('Ciudad')}
                  <select style={{ ...inp }} value={form.ciudad} onChange={e => set('ciudad', e.target.value)}>
                    {['Bogotá','Medellín','Cali','Cartagena','Barranquilla'].map(c => <option key={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  {label('Teléfono')}
                  <input style={inp} value={form.telefono} onChange={e => set('telefono', e.target.value)} placeholder="+57 1 234 5678" />
                </div>
              </div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
                <div>
                  {label('Dirección')}
                  <input style={inp} value={form.direccion} onChange={e => set('direccion', e.target.value)} placeholder="Cra. 13 #85-35" />
                </div>
                <div>
                  {label('Instagram')}
                  <input style={inp} value={form.instagram} onChange={e => set('instagram', e.target.value)} placeholder="@restaurante" />
                </div>
              </div>
            </div>

            {/* Curaduría */}
            <div style={{ background:S.bg2, border:`1px solid ${S.border}`, borderRadius:14, padding:18 }}>
              <div style={{ fontSize:11, color:S.purple, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.1em', marginBottom:14 }}>Curaduría Oh Yeah!</div>

              <div style={{ marginBottom:14 }}>
                {label('Nivel de curaduría')}
                <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
                  {NIVELES_CURADURIA.map(n => (
                    <button key={n.id} onClick={() => set('nivel_curaduria', n.id)}
                      style={{ padding:'8px 14px', borderRadius:20, border:`1px solid ${form.nivel_curaduria === n.id ? n.color : S.border}`, background: form.nivel_curaduria === n.id ? `${n.color}18` : 'transparent', color: form.nivel_curaduria === n.id ? n.color : S.text3, fontSize:11, fontWeight:700, cursor:'pointer', transition:'all .2s' }}>
                      {n.label}
                    </button>
                  ))}
                </div>
                {form.nivel_curaduria && (
                  <div style={{ fontSize:10, color:S.text3, marginTop:6 }}>
                    {NIVELES_CURADURIA.find(n => n.id === form.nivel_curaduria)?.desc}
                  </div>
                )}
              </div>

              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, marginBottom:14 }}>
                <div>
                  {label('Estrellas')}
                  <div style={{ display:'flex', gap:6 }}>
                    {[1,2,3,4,5].map(s => (
                      <button key={s} onClick={() => set('estrellas', s)}
                        style={{ width:36, height:36, borderRadius:8, border:`1px solid ${form.estrellas >= s ? '#DFFF00' : S.border}`, background: form.estrellas >= s ? '#DFFF00' : 'transparent', color: form.estrellas >= s ? '#000' : S.text3, fontSize:16, cursor:'pointer', transition:'all .2s' }}>
                        ★
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  {label('Orden en lista')}
                  <input style={inp} type="number" min={1} max={999} value={form.orden} onChange={e => set('orden', parseInt(e.target.value) || 99)} />
                </div>
              </div>

              {/* Categoría */}
              <div style={{ marginBottom:14 }}>
                {label('Categoría')}
                <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
                  {CATEGORIAS.map(c => (
                    <button key={c} onClick={() => set('categoria', c)}
                      style={{ padding:'6px 12px', borderRadius:16, border:`1px solid ${form.categoria === c ? S.blue : S.border}`, background: form.categoria === c ? `${S.blue}18` : 'transparent', color: form.categoria === c ? S.blue : S.text3, fontSize:11, fontWeight:700, cursor:'pointer', transition:'all .2s' }}>
                      {c}
                    </button>
                  ))}
                </div>
              </div>

              {/* Moods */}
              <div style={{ marginBottom:14 }}>
                {label('Moods compatibles')}
                <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
                  {MOODS.map(m => (
                    <button key={m} onClick={() => toggleMood(m)}
                      style={{ padding:'6px 12px', borderRadius:16, border:`1px solid ${form.mood.includes(m) ? S.pink : S.border}`, background: form.mood.includes(m) ? `${S.pink}18` : 'transparent', color: form.mood.includes(m) ? S.pink : S.text3, fontSize:11, fontWeight:700, cursor:'pointer', transition:'all .2s' }}>
                      {m}
                    </button>
                  ))}
                </div>
              </div>

              {/* Flags */}
              <div style={{ display:'flex', gap:16 }}>
                <label style={{ display:'flex', alignItems:'center', gap:8, cursor:'pointer', fontSize:12 }}>
                  <input type="checkbox" checked={form.seratta} onChange={e => set('seratta', e.target.checked)}
                    style={{ width:16, height:16, accentColor:S.pink, cursor:'pointer' }} />
                  <span style={{ color:S.text2 }}>Es restaurante Seratta</span>
                </label>
                <label style={{ display:'flex', alignItems:'center', gap:8, cursor:'pointer', fontSize:12 }}>
                  <input type="checkbox" checked={form.activo} onChange={e => set('activo', e.target.checked)}
                    style={{ width:16, height:16, accentColor:S.green, cursor:'pointer' }} />
                  <span style={{ color:S.text2 }}>Visible en Oh Yeah!</span>
                </label>
              </div>
            </div>

            {/* Preview */}
            <div style={{ background:S.bg2, border:`1px solid ${S.border}`, borderRadius:14, padding:18 }}>
              <div style={{ fontSize:11, color:S.text3, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.1em', marginBottom:14 }}>Preview en la app</div>
              <div style={{ display:'flex', gap:16, alignItems:'center' }}>
                <div style={{ width:80, height:80, background:'linear-gradient(135deg,#1a1a1a,#111)', borderRadius:12, display:'flex', alignItems:'center', justifyContent:'center', fontSize:36, flexShrink:0 }}>
                  {form.emoji}
                </div>
                <div>
                  <div style={{ fontFamily:"'Montserrat',sans-serif", fontSize:20, fontWeight:900, letterSpacing:'.5px' }}>{form.nombre || 'NOMBRE'}</div>
                  <div style={{ fontSize:11, color:'#999', marginTop:3 }}>
                    <span style={{ color:'#DFFF00' }}>{'★'.repeat(form.estrellas)}</span> {form.tipo || 'Tipo de cocina'} · {form.precio}
                  </div>
                  <div style={{ fontSize:10, color:S.text3, marginTop:6 }}>{form.descripcion.slice(0,80)}{form.descripcion.length > 80 ? '...' : ''}</div>
                </div>
              </div>
            </div>

            {/* Botones */}
            <div style={{ display:'flex', gap:10 }}>
              <button onClick={() => { setEditando(null); setForm(EMPTY_REST); setTab('lista'); }}
                style={{ flex:1, padding:14, borderRadius:12, border:`1px solid ${S.border}`, background:'none', color:S.text2, fontSize:13, fontWeight:700, cursor:'pointer' }}>
                Cancelar
              </button>
              <button onClick={guardar}
                style={{ flex:2, padding:14, borderRadius:12, border:'none', background:S.pink, color:'#fff', fontSize:13, fontWeight:900, cursor:'pointer', transition:'opacity .2s' }}
                onMouseEnter={e => e.currentTarget.style.opacity='.85'}
                onMouseLeave={e => e.currentTarget.style.opacity='1'}>
                {editando ? '✓ Guardar cambios' : '+ Publicar en Oh Yeah!'}
              </button>
            </div>
          </div>
        )}

        {/* ── STATS ── */}
        {tab === 'stats' && (
          <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:10 }}>
              {[
                { label:'Restaurantes activos',  value:restaurantes.filter(r=>r.activo).length,    color:S.green },
                { label:'Seratta',                value:restaurantes.filter(r=>r.seratta).length,   color:S.pink  },
                { label:'Externos curados',       value:restaurantes.filter(r=>!r.seratta).length,  color:S.blue  },
                { label:'TOP 10',                 value:restaurantes.filter(r=>r.nivel_curaduria==='top').length, color:S.goldL },
              ].map(kpi => (
                <div key={kpi.label} style={{ background:S.bg2, border:`1px solid ${S.border}`, borderRadius:12, padding:16 }}>
                  <div style={{ fontSize:10, color:S.text3, marginBottom:6 }}>{kpi.label}</div>
                  <div style={{ fontSize:28, fontWeight:900, color:kpi.color, fontFamily:"'Syne', sans-serif" }}>{kpi.value}</div>
                </div>
              ))}
            </div>

            {/* Por ciudad */}
            <div style={{ background:S.bg2, border:`1px solid ${S.border}`, borderRadius:14, padding:18 }}>
              <div style={{ fontSize:12, fontWeight:700, color:S.goldL, marginBottom:14 }}>DISTRIBUCIÓN POR CIUDAD</div>
              {['Bogotá','Medellín','Cali','Cartagena'].map(ciudad => {
                const count = restaurantes.filter(r => r.ciudad === ciudad).length;
                const pct = restaurantes.length > 0 ? (count / restaurantes.length) * 100 : 0;
                return count > 0 ? (
                  <div key={ciudad} style={{ marginBottom:10 }}>
                    <div style={{ display:'flex', justifyContent:'space-between', fontSize:12, marginBottom:4 }}>
                      <span style={{ color:S.text2 }}>{ciudad}</span>
                      <span style={{ color:S.text1, fontWeight:700 }}>{count}</span>
                    </div>
                    <div style={{ height:6, background:S.bg3, borderRadius:4, overflow:'hidden' }}>
                      <div style={{ height:'100%', width:`${pct}%`, background:S.pink, borderRadius:4, transition:'width .5s' }}/>
                    </div>
                  </div>
                ) : null;
              })}
            </div>

            {/* Por categoría */}
            <div style={{ background:S.bg2, border:`1px solid ${S.border}`, borderRadius:14, padding:18 }}>
              <div style={{ fontSize:12, fontWeight:700, color:S.goldL, marginBottom:14 }}>POR CATEGORÍA</div>
              <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:8 }}>
                {CATEGORIAS.map(cat => {
                  const count = restaurantes.filter(r => r.categoria === cat).length;
                  return count > 0 ? (
                    <div key={cat} style={{ background:S.bg3, borderRadius:10, padding:'10px 14px', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                      <span style={{ fontSize:11, color:S.text2 }}>{cat}</span>
                      <span style={{ fontSize:14, fontWeight:700, color:S.blue }}>{count}</span>
                    </div>
                  ) : null;
                })}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
