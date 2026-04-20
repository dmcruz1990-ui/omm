// ============================================================
// NEXUM — ReserveModule.tsx  v2
// Sistema completo de reservas — estilo OpenTable / Resy
// Mapa de mesas visual, CRM integrado, Realtime, WhatsApp
// ============================================================

import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase.ts';

const S = {
  bg:'#0a0a0a', bg2:'#141414', bg3:'#1c1c1c',
  border:'#2a2a2a', text1:'#f0f0f0', text2:'#a0a0a0', text3:'#606060',
  gold:'#d4943a', goldL:'#f0b45a', green:'#3dba6f',
  red:'#e05050', blue:'#4a8fd4', purple:'#9b72ff',
};

type Tab = 'mapa' | 'lista' | 'nueva' | 'timeline';
type EstadoMesa = 'libre' | 'ocupada' | 'reservada' | 'bloqueada';
type EstadoReserva = 'pendiente' | 'confirmada' | 'llegó' | 'cancelada' | 'no_show';

interface Mesa {
  id: number;
  numero: number;
  capacidad: number;
  zona: string;
  estado: EstadoMesa;
  activa: boolean;
}

interface Reserva {
  id: number;
  mesa_id: number;
  nombre_cliente: string;
  telefono: string;
  email: string;
  pax: number;
  fecha: string;
  hora: string;
  duracion_min: number;
  ocasion: string;
  nota: string;
  estado: EstadoReserva;
  origen: string;
  // join
  mesa_numero?: number;
  mesa_zona?: string;
  mesa_capacidad?: number;
  customer_name?: string;
  vip_status?: boolean;
  total_visits?: number;
}

const ESTADO_CFG: Record<EstadoMesa, { color: string; bg: string; label: string }> = {
  libre:     { color: S.green,  bg: `${S.green}20`,  label: 'Libre' },
  ocupada:   { color: S.red,    bg: `${S.red}20`,    label: 'Ocupada' },
  reservada: { color: S.gold,   bg: `${S.gold}20`,   label: 'Reservada' },
  bloqueada: { color: S.text3,  bg: `${S.text3}20`,  label: 'Bloqueada' },
};

const RESERVA_CFG: Record<EstadoReserva, { color: string; label: string; icon: string }> = {
  pendiente:  { color: S.gold,   label: 'Pendiente',  icon: '⏳' },
  confirmada: { color: S.blue,   label: 'Confirmada', icon: '✓' },
  'llegó':    { color: S.green,  label: 'Llegó',      icon: '🟢' },
  cancelada:  { color: S.red,    label: 'Cancelada',  icon: '✕' },
  no_show:    { color: S.text3,  label: 'No Show',    icon: '👻' },
};

const ZONAS_COLOR: Record<string, string> = {
  'Principal': '#1a1a2e', 'Terraza': '#0d1f0d', 'VIP': '#1f1a0d',
  'Barra': '#1a0d1f', 'Salón': '#0d1a1f', 'default': '#141414',
};

const OCASIONES = ['Cumpleaños', 'Aniversario', 'Negocio', 'Primera Cita', 'Celebración', 'Despedida', 'Graduación', 'Otro'];
const ORIGENES = ['web', 'telefono', 'whatsapp', 'oh_yeah', 'walk-in', 'instagram'];

const hoy = () => new Date().toISOString().split('T')[0];
const formatHora = (h: string) => h?.slice(0, 5) ?? '';
const formatFecha = (f: string) => {
  if (!f) return '';
  const d = new Date(f + 'T00:00:00');
  return d.toLocaleDateString('es-CO', { weekday:'short', day:'numeric', month:'short' });
};

export default function ReserveModule() {
  const [tab, setTab] = useState<Tab>('mapa');
  const [mesas, setMesas] = useState<Mesa[]>([]);
  const [reservas, setReservas] = useState<Reserva[]>([]);
  const [loading, setLoading] = useState(true);
  const [fechaFiltro, setFechaFiltro] = useState(hoy());
  const [zonaFiltro, setZonaFiltro] = useState('Todas');
  const [mesaSeleccionada, setMesaSeleccionada] = useState<Mesa | null>(null);
  const [reservaDetalle, setReservaDetalle] = useState<Reserva | null>(null);
  const [toast, setToast] = useState('');

  // Form nueva reserva
  const [form, setForm] = useState({
    nombre: '', telefono: '', email: '', pax: 2,
    fecha: hoy(), hora: '20:00', duracion: 90,
    mesa_id: 0, ocasion: '', nota: '', origen: 'web',
  });

  const showToast = (m: string) => { setToast(m); setTimeout(() => setToast(''), 3000); };
  const setF = (k: string, v: any) => setForm(p => ({ ...p, [k]: v }));

  // Cargar datos
  const fetchData = async () => {
    const [{ data: mesasData }, { data: reservasData }] = await Promise.all([
      supabase.from('mesas').select('*').order('numero'),
      supabase.from('vista_reservas').select('*').gte('fecha', fechaFiltro).order('hora'),
    ]);
    if (mesasData) setMesas(mesasData);
    if (reservasData) setReservas(reservasData as Reserva[]);
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, [fechaFiltro]);

  // Realtime
  useEffect(() => {
    const ch = supabase.channel('reservas-live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'reservas' }, fetchData)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'mesas' }, fetchData)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);

  const crearReserva = async () => {
    if (!form.nombre || !form.mesa_id || !form.fecha || !form.hora) {
      showToast('⚠️ Completa nombre, mesa, fecha y hora'); return;
    }
    const { error } = await supabase.from('reservas').insert({
      restaurante_id: 6,
      mesa_id: form.mesa_id,
      nombre_cliente: form.nombre,
      telefono: form.telefono,
      email: form.email,
      pax: form.pax,
      fecha: form.fecha,
      hora: form.hora,
      duracion_min: form.duracion,
      ocasion: form.ocasion || null,
      nota: form.nota || null,
      estado: 'confirmada',
      origen: form.origen,
    });
    if (error) { showToast(`✗ Error: ${error.message}`); return; }
    // Marcar mesa como reservada
    await supabase.from('mesas').update({ estado: 'reservada' }).eq('id', form.mesa_id);
    showToast(`✓ Reserva confirmada — ${form.nombre}`);
    setForm({ nombre:'', telefono:'', email:'', pax:2, fecha:hoy(), hora:'20:00', duracion:90, mesa_id:0, ocasion:'', nota:'', origen:'web' });
    setTab('lista');
    fetchData();
  };

  const cambiarEstadoReserva = async (id: number, estado: EstadoReserva) => {
    await supabase.from('reservas').update({ estado }).eq('id', id);
    if (estado === 'llegó') {
      const r = reservas.find(x => x.id === id);
      if (r) await supabase.from('mesas').update({ estado: 'ocupada' }).eq('id', r.mesa_id);
    }
    if (estado === 'cancelada' || estado === 'no_show') {
      const r = reservas.find(x => x.id === id);
      if (r) await supabase.from('mesas').update({ estado: 'libre' }).eq('id', r.mesa_id);
    }
    showToast(`✓ Estado actualizado: ${RESERVA_CFG[estado].label}`);
    setReservaDetalle(null);
    fetchData();
  };

  const zonas = ['Todas', ...Array.from(new Set(mesas.map(m => m.zona)))];
  const mesasFiltradas = mesas.filter(m => zonaFiltro === 'Todas' || m.zona === zonaFiltro);
  const reservasHoy = reservas.filter(r => r.fecha === fechaFiltro);

  const inp = {
    background: S.bg2, border: `1px solid ${S.border}`,
    borderRadius: 8, padding: '9px 14px', color: S.text1,
    fontSize: 13, outline: 'none', width: '100%',
  };

  const kpis = [
    { label: 'Reservas hoy',   value: reservasHoy.length,                                           color: S.blue   },
    { label: 'Confirmadas',    value: reservasHoy.filter(r=>r.estado==='confirmada').length,        color: S.green  },
    { label: 'Mesas libres',   value: mesas.filter(m=>m.estado==='libre').length,                  color: S.goldL  },
    { label: 'Pax esperados',  value: reservasHoy.filter(r=>['confirmada','pendiente'].includes(r.estado)).reduce((a,r)=>a+r.pax,0), color: S.purple },
  ];

  return (
    <div style={{ display:'flex', flexDirection:'column', height:'100%', background:S.bg, color:S.text1, fontFamily:"'DM Sans',sans-serif" }}>

      {toast && <div style={{ position:'fixed', bottom:24, left:'50%', transform:'translateX(-50%)', background:'#222', border:`1px solid ${S.border}`, color:S.text1, padding:'10px 20px', borderRadius:10, fontSize:13, zIndex:9999, whiteSpace:'nowrap' }}>{toast}</div>}

      {/* Modal detalle reserva */}
      {reservaDetalle && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.8)', zIndex:600, display:'flex', alignItems:'center', justifyContent:'center', padding:20 }}>
          <div style={{ background:S.bg3, border:`1px solid ${S.border}`, borderRadius:16, padding:28, maxWidth:460, width:'100%' }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:20 }}>
              <div>
                <div style={{ fontFamily:"'Syne',sans-serif", fontSize:18, fontWeight:900 }}>{reservaDetalle.nombre_cliente}</div>
                <div style={{ fontSize:12, color:S.text3, marginTop:2 }}>
                  {reservaDetalle.vip_status && <span style={{ color:S.gold, marginRight:6 }}>⭐ VIP</span>}
                  {reservaDetalle.total_visits && <span>{reservaDetalle.total_visits} visitas</span>}
                </div>
              </div>
              <button onClick={()=>setReservaDetalle(null)} style={{ background:'none', border:'none', color:S.text3, fontSize:20, cursor:'pointer' }}>✕</button>
            </div>

            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginBottom:16 }}>
              {[
                { l:'Mesa', v:`#${reservaDetalle.mesa_numero} — ${reservaDetalle.mesa_zona}` },
                { l:'Pax', v:`${reservaDetalle.pax} personas` },
                { l:'Fecha', v:formatFecha(reservaDetalle.fecha) },
                { l:'Hora', v:formatHora(reservaDetalle.hora) },
                { l:'Duración', v:`${reservaDetalle.duracion_min} min` },
                { l:'Origen', v:reservaDetalle.origen },
              ].map(x => (
                <div key={x.l} style={{ background:S.bg2, borderRadius:8, padding:'8px 12px' }}>
                  <div style={{ fontSize:10, color:S.text3, marginBottom:2 }}>{x.l}</div>
                  <div style={{ fontSize:13, fontWeight:600 }}>{x.v}</div>
                </div>
              ))}
            </div>

            {reservaDetalle.ocasion && (
              <div style={{ background:`${S.purple}15`, border:`1px solid ${S.purple}30`, borderRadius:8, padding:'8px 12px', marginBottom:12, fontSize:12, color:S.purple }}>
                🎉 {reservaDetalle.ocasion}
              </div>
            )}
            {reservaDetalle.nota && (
              <div style={{ background:S.bg2, borderRadius:8, padding:'8px 12px', marginBottom:16, fontSize:12, color:S.text2 }}>
                📝 {reservaDetalle.nota}
              </div>
            )}

            {/* Contacto */}
            <div style={{ display:'flex', gap:8, marginBottom:16 }}>
              {reservaDetalle.telefono && (
                <a href={`https://wa.me/${reservaDetalle.telefono.replace(/\D/g,'')}`} target="_blank"
                  style={{ flex:1, padding:'8px', borderRadius:8, background:'#25D36615', border:'1px solid #25D36640', color:'#25D366', fontSize:11, fontWeight:700, textAlign:'center', textDecoration:'none' }}>
                  💬 WhatsApp
                </a>
              )}
              {reservaDetalle.telefono && (
                <a href={`tel:${reservaDetalle.telefono}`}
                  style={{ flex:1, padding:'8px', borderRadius:8, background:`${S.blue}15`, border:`1px solid ${S.blue}40`, color:S.blue, fontSize:11, fontWeight:700, textAlign:'center', textDecoration:'none' }}>
                  📞 Llamar
                </a>
              )}
            </div>

            {/* Acciones de estado */}
            <div style={{ fontSize:10, color:S.text3, marginBottom:8, fontWeight:700, textTransform:'uppercase' as const }}>Cambiar estado</div>
            <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
              {(['confirmada','llegó','cancelada','no_show'] as EstadoReserva[]).map(e => {
                const cfg = RESERVA_CFG[e];
                const active = reservaDetalle.estado === e;
                return (
                  <button key={e} onClick={() => cambiarEstadoReserva(reservaDetalle.id, e)}
                    style={{ padding:'7px 14px', borderRadius:20, border:`1px solid ${active?cfg.color:S.border}`, background:active?`${cfg.color}20`:'transparent', color:active?cfg.color:S.text3, fontSize:11, fontWeight:700, cursor:'pointer', transition:'all .2s' }}>
                    {cfg.icon} {cfg.label}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div style={{ padding:'14px 20px', borderBottom:`1px solid ${S.border}`, display:'flex', alignItems:'center', justifyContent:'space-between', flexShrink:0 }}>
        <div style={{ display:'flex', alignItems:'center', gap:12 }}>
          <div style={{ width:36, height:36, borderRadius:10, background:`linear-gradient(135deg,${S.purple},#6040b0)`, display:'flex', alignItems:'center', justifyContent:'center', fontSize:18 }}>📅</div>
          <div>
            <div style={{ fontFamily:"'Syne',sans-serif", fontSize:15, fontWeight:900 }}>RESERVE</div>
            <div style={{ fontSize:11, color:S.text3 }}>Gestión central de reservas — OMM</div>
          </div>
        </div>
        <div style={{ display:'flex', gap:8, alignItems:'center' }}>
          <input type="date" value={fechaFiltro} onChange={e=>setFechaFiltro(e.target.value)}
            style={{ ...inp, width:'auto', fontSize:12, padding:'6px 12px' }} />
          <button onClick={()=>{setTab('nueva');}} style={{ background:S.purple, color:'#fff', border:'none', padding:'8px 16px', borderRadius:8, fontSize:12, fontWeight:700, cursor:'pointer' }}>
            + Nueva reserva
          </button>
        </div>
      </div>

      {/* KPIs */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:10, padding:'12px 20px', borderBottom:`1px solid ${S.border}`, flexShrink:0 }}>
        {kpis.map(k => (
          <div key={k.label} style={{ background:S.bg2, border:`1px solid ${S.border}`, borderRadius:10, padding:'10px 14px' }}>
            <div style={{ fontSize:10, color:S.text3, marginBottom:2 }}>{k.label}</div>
            <div style={{ fontFamily:"'Syne',sans-serif", fontSize:22, fontWeight:900, color:k.color }}>{k.value}</div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div style={{ display:'flex', borderBottom:`1px solid ${S.border}`, flexShrink:0 }}>
        {([
          { id:'mapa',     label:'🗺️ Mapa de mesas' },
          { id:'lista',    label:`📋 Reservas (${reservasHoy.length})` },
          { id:'timeline', label:'⏱️ Timeline' },
          { id:'nueva',    label:'➕ Nueva reserva' },
        ] as const).map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            style={{ padding:'10px 18px', background:'none', border:'none', cursor:'pointer', fontSize:12, fontWeight:700, whiteSpace:'nowrap', color:tab===t.id?S.purple:S.text3, borderBottom:`2px solid ${tab===t.id?S.purple:'transparent'}`, transition:'all .15s' }}>
            {t.label}
          </button>
        ))}
      </div>

      <div style={{ flex:1, overflowY:'auto', padding:16 }}>

        {/* ── MAPA DE MESAS ── */}
        {tab === 'mapa' && (
          <div>
            {/* Filtro zona */}
            <div style={{ display:'flex', gap:8, marginBottom:16, flexWrap:'wrap' }}>
              {zonas.map(z => (
                <button key={z} onClick={() => setZonaFiltro(z)}
                  style={{ padding:'5px 14px', borderRadius:20, border:`1px solid ${zonaFiltro===z?S.purple:S.border}`, background:zonaFiltro===z?`${S.purple}15`:'transparent', color:zonaFiltro===z?S.purple:S.text3, fontSize:11, fontWeight:700, cursor:'pointer' }}>
                  {z}
                </button>
              ))}
            </div>

            {/* Leyenda */}
            <div style={{ display:'flex', gap:12, marginBottom:16, flexWrap:'wrap' }}>
              {Object.entries(ESTADO_CFG).map(([k,v]) => (
                <div key={k} style={{ display:'flex', alignItems:'center', gap:6, fontSize:11, color:S.text2 }}>
                  <div style={{ width:10, height:10, borderRadius:'50%', background:v.color }}/>
                  {v.label}
                </div>
              ))}
            </div>

            {/* Grid de mesas por zona */}
            {Array.from(new Set(mesasFiltradas.map(m => m.zona))).map(zona => {
              const mesasZona = mesasFiltradas.filter(m => m.zona === zona);
              return (
                <div key={zona} style={{ marginBottom:20 }}>
                  <div style={{ fontSize:11, color:S.text3, fontWeight:700, textTransform:'uppercase' as const, letterSpacing:'.08em', marginBottom:10 }}>
                    {zona} — {mesasZona.length} mesas
                  </div>
                  <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(120px, 1fr))', gap:10 }}>
                    {mesasZona.map(mesa => {
                      const cfg = ESTADO_CFG[mesa.estado];
                      const reservasMesa = reservasHoy.filter(r => r.mesa_id === mesa.id && ['confirmada','pendiente'].includes(r.estado));
                      return (
                        <div key={mesa.id}
                          onClick={() => { setMesaSeleccionada(mesa); if (mesa.estado === 'libre') { setF('mesa_id', mesa.id); setTab('nueva'); } }}
                          style={{ background:cfg.bg, border:`2px solid ${cfg.color}50`, borderRadius:14, padding:14, cursor:'pointer', transition:'all .2s', textAlign:'center' }}
                          onMouseEnter={e => e.currentTarget.style.borderColor=cfg.color}
                          onMouseLeave={e => e.currentTarget.style.borderColor=`${cfg.color}50`}>
                          <div style={{ fontFamily:"'Syne',sans-serif", fontSize:22, fontWeight:900, color:S.text1 }}>{mesa.numero}</div>
                          <div style={{ fontSize:10, color:cfg.color, fontWeight:700, marginTop:2 }}>{cfg.label}</div>
                          <div style={{ fontSize:10, color:S.text3, marginTop:2 }}>👥 {mesa.capacidad}</div>
                          {reservasMesa.length > 0 && (
                            <div style={{ marginTop:6, fontSize:10, color:S.goldL, background:`${S.gold}15`, borderRadius:6, padding:'2px 6px' }}>
                              {formatHora(reservasMesa[0].hora)} · {reservasMesa[0].nombre_cliente.split(' ')[0]}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* ── LISTA DE RESERVAS ── */}
        {tab === 'lista' && (
          <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
            {reservasHoy.length === 0 && (
              <div style={{ background:S.bg2, border:`1px solid ${S.border}`, borderRadius:14, padding:40, textAlign:'center' }}>
                <div style={{ fontSize:48, marginBottom:12 }}>📅</div>
                <div style={{ fontSize:15, fontWeight:700, marginBottom:8 }}>Sin reservas para este día</div>
                <button onClick={()=>setTab('nueva')} style={{ background:S.purple, color:'#fff', border:'none', padding:'10px 24px', borderRadius:10, fontSize:13, fontWeight:700, cursor:'pointer', marginTop:8 }}>
                  + Crear reserva
                </button>
              </div>
            )}
            {reservasHoy
              .sort((a,b) => a.hora.localeCompare(b.hora))
              .map(r => {
                const cfg = RESERVA_CFG[r.estado];
                return (
                  <div key={r.id} onClick={() => setReservaDetalle(r)}
                    style={{ background:S.bg2, border:`1px solid ${r.estado==='llegó'?S.green+'40':S.border}`, borderRadius:14, padding:16, cursor:'pointer', transition:'all .2s', display:'flex', alignItems:'center', gap:14 }}
                    onMouseEnter={e => e.currentTarget.style.borderColor=S.purple+'50'}
                    onMouseLeave={e => e.currentTarget.style.borderColor=r.estado==='llegó'?S.green+'40':S.border}>

                    {/* Hora */}
                    <div style={{ textAlign:'center', minWidth:50 }}>
                      <div style={{ fontFamily:"'Syne',sans-serif", fontSize:16, fontWeight:900, color:S.goldL }}>{formatHora(r.hora)}</div>
                      <div style={{ fontSize:10, color:S.text3 }}>{r.duracion_min}m</div>
                    </div>

                    {/* Número mesa */}
                    <div style={{ width:40, height:40, borderRadius:10, background:S.bg3, border:`1px solid ${S.border}`, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                      <div style={{ fontSize:9, color:S.text3 }}>MESA</div>
                      <div style={{ fontFamily:"'Syne',sans-serif", fontSize:15, fontWeight:900 }}>{r.mesa_numero}</div>
                    </div>

                    {/* Info principal */}
                    <div style={{ flex:1 }}>
                      <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:3 }}>
                        <span style={{ fontSize:14, fontWeight:700 }}>{r.nombre_cliente}</span>
                        {r.vip_status && <span style={{ fontSize:10, color:S.gold }}>⭐ VIP</span>}
                        {r.ocasion && <span style={{ fontSize:10, background:`${S.purple}15`, color:S.purple, padding:'1px 6px', borderRadius:10 }}>{r.ocasion}</span>}
                      </div>
                      <div style={{ fontSize:11, color:S.text3 }}>
                        👥 {r.pax} personas · {r.mesa_zona} · {r.origen}
                        {r.total_visits && <span style={{ marginLeft:6 }}>· {r.total_visits} visitas</span>}
                      </div>
                      {r.nota && <div style={{ fontSize:11, color:S.text2, marginTop:3 }}>📝 {r.nota}</div>}
                    </div>

                    {/* Estado */}
                    <span style={{ background:`${cfg.color}20`, color:cfg.color, border:`1px solid ${cfg.color}40`, padding:'4px 12px', borderRadius:20, fontSize:11, fontWeight:700, flexShrink:0 }}>
                      {cfg.icon} {cfg.label}
                    </span>
                  </div>
                );
              })}
          </div>
        )}

        {/* ── TIMELINE ── */}
        {tab === 'timeline' && (
          <div>
            <div style={{ fontSize:12, color:S.text3, marginBottom:16 }}>Vista de disponibilidad por hora — {formatFecha(fechaFiltro)}</div>
            {/* Horas de servicio */}
            {['12:00','13:00','14:00','15:00','19:00','20:00','21:00','22:00','23:00'].map(hora => {
              const reservasHora = reservasHoy.filter(r => formatHora(r.hora) === hora);
              return (
                <div key={hora} style={{ display:'flex', gap:10, marginBottom:8, alignItems:'flex-start' }}>
                  <div style={{ minWidth:50, fontSize:12, fontWeight:700, color:S.goldL, paddingTop:10 }}>{hora}</div>
                  <div style={{ flex:1, display:'flex', gap:8, flexWrap:'wrap' }}>
                    {reservasHora.length > 0 ? reservasHora.map(r => {
                      const cfg = RESERVA_CFG[r.estado];
                      return (
                        <div key={r.id} onClick={() => setReservaDetalle(r)}
                          style={{ background:`${cfg.color}15`, border:`1px solid ${cfg.color}40`, borderRadius:10, padding:'8px 14px', cursor:'pointer', minWidth:160 }}>
                          <div style={{ fontSize:13, fontWeight:700 }}>{r.nombre_cliente.split(' ')[0]}</div>
                          <div style={{ fontSize:10, color:S.text3 }}>Mesa {r.mesa_numero} · {r.pax}pax · {cfg.label}</div>
                        </div>
                      );
                    }) : (
                      <div style={{ background:S.bg2, border:`1px dashed ${S.border}`, borderRadius:10, padding:'8px 14px', fontSize:11, color:S.text3 }}>
                        Disponible
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* ── NUEVA RESERVA ── */}
        {tab === 'nueva' && (
          <div style={{ maxWidth:600, display:'flex', flexDirection:'column', gap:14 }}>

            {/* Info cliente */}
            <div style={{ background:S.bg2, border:`1px solid ${S.border}`, borderRadius:14, padding:18 }}>
              <div style={{ fontSize:11, color:S.purple, fontWeight:700, textTransform:'uppercase' as const, letterSpacing:'.08em', marginBottom:14 }}>Cliente</div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
                <div>
                  <div style={{ fontSize:10, color:S.text3, marginBottom:4 }}>Nombre *</div>
                  <input style={inp} placeholder="Nombre completo" value={form.nombre} onChange={e=>setF('nombre',e.target.value)} />
                </div>
                <div>
                  <div style={{ fontSize:10, color:S.text3, marginBottom:4 }}>Personas *</div>
                  <select style={inp} value={form.pax} onChange={e=>setF('pax',parseInt(e.target.value))}>
                    {[1,2,3,4,5,6,7,8,10,12,15,20].map(n=><option key={n}>{n}</option>)}
                  </select>
                </div>
                <div>
                  <div style={{ fontSize:10, color:S.text3, marginBottom:4 }}>Teléfono / WhatsApp</div>
                  <input style={inp} placeholder="+57 310 000 0000" value={form.telefono} onChange={e=>setF('telefono',e.target.value)} />
                </div>
                <div>
                  <div style={{ fontSize:10, color:S.text3, marginBottom:4 }}>Email</div>
                  <input style={inp} placeholder="email@correo.com" value={form.email} onChange={e=>setF('email',e.target.value)} />
                </div>
              </div>
            </div>

            {/* Fecha, hora, mesa */}
            <div style={{ background:S.bg2, border:`1px solid ${S.border}`, borderRadius:14, padding:18 }}>
              <div style={{ fontSize:11, color:S.goldL, fontWeight:700, textTransform:'uppercase' as const, letterSpacing:'.08em', marginBottom:14 }}>Reserva</div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:10, marginBottom:12 }}>
                <div>
                  <div style={{ fontSize:10, color:S.text3, marginBottom:4 }}>Fecha *</div>
                  <input type="date" style={inp} value={form.fecha} onChange={e=>setF('fecha',e.target.value)} />
                </div>
                <div>
                  <div style={{ fontSize:10, color:S.text3, marginBottom:4 }}>Hora *</div>
                  <select style={inp} value={form.hora} onChange={e=>setF('hora',e.target.value)}>
                    {['12:00','12:30','13:00','13:30','14:00','14:30','15:00','19:00','19:30','20:00','20:30','21:00','21:30','22:00','22:30'].map(h=><option key={h}>{h}</option>)}
                  </select>
                </div>
                <div>
                  <div style={{ fontSize:10, color:S.text3, marginBottom:4 }}>Duración</div>
                  <select style={inp} value={form.duracion} onChange={e=>setF('duracion',parseInt(e.target.value))}>
                    {[60,90,120,150,180].map(d=><option key={d} value={d}>{d} min</option>)}
                  </select>
                </div>
              </div>

              {/* Selector de mesa visual */}
              <div style={{ fontSize:10, color:S.text3, marginBottom:8, fontWeight:700, textTransform:'uppercase' as const }}>Mesa * — haz clic para seleccionar</div>
              <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(70px, 1fr))', gap:8 }}>
                {mesas.map(m => {
                  const cfg = ESTADO_CFG[m.estado];
                  const selected = form.mesa_id === m.id;
                  const disponible = m.estado === 'libre';
                  return (
                    <div key={m.id}
                      onClick={() => disponible && setF('mesa_id', m.id)}
                      style={{ background:selected?`${S.purple}20`:cfg.bg, border:`2px solid ${selected?S.purple:cfg.color+'40'}`, borderRadius:10, padding:'8px', textAlign:'center', cursor:disponible?'pointer':'not-allowed', opacity:disponible?1:0.5, transition:'all .2s' }}>
                      <div style={{ fontFamily:"'Syne',sans-serif", fontSize:16, fontWeight:900, color:selected?S.purple:S.text1 }}>{m.numero}</div>
                      <div style={{ fontSize:9, color:S.text3 }}>{m.capacidad}p</div>
                      <div style={{ fontSize:9, color:cfg.color }}>{m.zona.slice(0,5)}</div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Ocasión y notas */}
            <div style={{ background:S.bg2, border:`1px solid ${S.border}`, borderRadius:14, padding:18 }}>
              <div style={{ fontSize:11, color:S.text3, fontWeight:700, textTransform:'uppercase' as const, letterSpacing:'.08em', marginBottom:14 }}>Detalles</div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginBottom:10 }}>
                <div>
                  <div style={{ fontSize:10, color:S.text3, marginBottom:4 }}>Ocasión</div>
                  <select style={inp} value={form.ocasion} onChange={e=>setF('ocasion',e.target.value)}>
                    <option value="">Sin ocasión especial</option>
                    {OCASIONES.map(o=><option key={o}>{o}</option>)}
                  </select>
                </div>
                <div>
                  <div style={{ fontSize:10, color:S.text3, marginBottom:4 }}>Origen</div>
                  <select style={inp} value={form.origen} onChange={e=>setF('origen',e.target.value)}>
                    {ORIGENES.map(o=><option key={o}>{o}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <div style={{ fontSize:10, color:S.text3, marginBottom:4 }}>Nota para el equipo</div>
                <textarea style={{ ...inp, minHeight:70, resize:'vertical' as const }} placeholder="Ej: Mesa con vista, champagne de bienvenida, cliente VIP..." value={form.nota} onChange={e=>setF('nota',e.target.value)} />
              </div>
            </div>

            <button onClick={crearReserva}
              style={{ width:'100%', padding:14, borderRadius:12, border:'none', background:S.purple, color:'#fff', fontSize:14, fontWeight:900, cursor:'pointer', fontFamily:"'Syne',sans-serif" }}
              onMouseEnter={e=>e.currentTarget.style.opacity='.85'}
              onMouseLeave={e=>e.currentTarget.style.opacity='1'}>
              ✓ Confirmar reserva
            </button>
          </div>
        )}

      </div>
    </div>
  );
}
