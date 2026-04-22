import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase.ts';

const S = {
  bg:'#0a0a0a', bg2:'#141414', bg3:'#1c1c1c',
  border:'#2a2a2a', text1:'#f0f0f0', text2:'#a0a0a0', text3:'#606060',
  gold:'#d4943a', goldL:'#f0b45a', green:'#3dba6f',
  red:'#e05050', blue:'#4a8fd4', purple:'#9b72ff',
};

type Tab = 'mapa' | 'lista' | 'nueva' | 'timeline' | 'clientes';
type EstadoMesa = 'libre' | 'ocupada' | 'reservada' | 'bloqueada';
type EstadoReserva = 'pendiente' | 'confirmada' | 'llegó' | 'cancelada' | 'no_show';

interface Mesa { id:number; numero:number; capacidad:number; zona:string; estado:EstadoMesa; activa:boolean; bloqueada?:boolean; bloqueo_motivo?:string; bloqueo_hasta?:string; }
interface Customer { id:number; name:string; apellido?:string; phone?:string; email?:string; notes?:string; vip_status?:boolean; total_visits?:number; total_spent?:number; alergias?:string[]; preferencias?:string[]; ultima_visita?:string; score?:number; tags?:string[]; }
interface Reserva { id:number; mesa_id:number; nombre_cliente:string; telefono?:string; email?:string; pax:number; fecha:string; hora:string; duracion_min?:number; ocasion?:string; nota?:string; estado:EstadoReserva; origen?:string; customer_id?:number; mesa_numero?:number; mesa_zona?:string; mesa_capacidad?:number; customer_name?:string; vip_status?:boolean; total_visits?:number; total_spent?:number; alergias?:string[]; preferencias?:string[]; score?:number; }

const ESTADO_CFG: Record<EstadoMesa,{color:string;bg:string;label:string}> = {
  libre:     { color:S.green,  bg:`${S.green}20`,  label:'Libre'    },
  ocupada:   { color:S.red,    bg:`${S.red}20`,    label:'Ocupada'  },
  reservada: { color:S.gold,   bg:`${S.gold}20`,   label:'Reservada'},
  bloqueada: { color:S.text3,  bg:`${S.text3}20`,  label:'Bloqueada'},
};
const RESERVA_CFG: Record<EstadoReserva,{color:string;label:string;icon:string}> = {
  pendiente:  { color:S.gold,  label:'Pendiente',  icon:'⏳' },
  confirmada: { color:S.blue,  label:'Confirmada', icon:'✓'  },
  'llegó':    { color:S.green, label:'Llegó',      icon:'🟢' },
  cancelada:  { color:S.red,   label:'Cancelada',  icon:'✕'  },
  no_show:    { color:S.text3, label:'No Show',    icon:'👻' },
};
const OCASIONES = ['Cumpleaños','Aniversario','Negocio','Primera Cita','Celebración','Despedida','Graduación','Otro'];
const ORIGENES  = ['web','telefono','whatsapp','oh_yeah','walk-in','instagram'];
const hoy = () => new Date().toISOString().split('T')[0];
const formatHora = (h:string) => h?.slice(0,5) ?? '';
const formatFecha = (f:string) => { if(!f) return ''; const d = new Date(f+'T00:00:00'); return d.toLocaleDateString('es-CO',{weekday:'short',day:'numeric',month:'short'}); };
const inp = { background:S.bg3, border:`1px solid ${S.border}`, borderRadius:8, padding:'9px 14px', color:S.text1, fontSize:13, outline:'none', width:'100%' } as React.CSSProperties;

export default function ReserveModule() {
  const [tab, setTab]               = useState<Tab>('mapa');
  const [mesas, setMesas]           = useState<Mesa[]>([]);
  const [reservas, setReservas]     = useState<Reserva[]>([]);
  const [clientes, setClientes]     = useState<Customer[]>([]);
  const [loading, setLoading]       = useState(true);
  const [fechaFiltro, setFechaFiltro] = useState(hoy());
  const [zonaFiltro, setZonaFiltro] = useState('Todas');
  const [busqueda, setBusqueda]     = useState('');
  const [reservaDetalle, setReservaDetalle] = useState<Reserva|null>(null);
  const [clienteDetalle, setClienteDetalle] = useState<Customer|null>(null);
  const [bloqueoModal, setBloqueoModal] = useState<Mesa|null>(null);
  const [bloqueoMotivo, setBloqueoMotivo] = useState('');
  const [bloqueoHasta, setBloqueoHasta] = useState('');
  const [toast, setToast] = useState('');
  const [form, setForm] = useState({ nombre:'', telefono:'', email:'', pax:2, fecha:hoy(), hora:'20:00', duracion:90, mesa_id:0, ocasion:'', nota:'', origen:'web' });

  const showToast = useCallback((m:string) => { setToast(m); setTimeout(()=>setToast(''),3000); },[]);
  const setF = (k:string,v:any) => setForm(p=>({...p,[k]:v}));

  const fetchData = async () => {
    const [{ data: mesasData }, { data: reservasData }, { data: clientesData }] = await Promise.all([
      supabase.from('mesas').select('*').order('numero'),
      supabase.from('vista_reservas').select('*').gte('fecha', fechaFiltro).order('hora'),
      supabase.from('customers').select('*').order('name'),
    ]);
    if (mesasData) setMesas(mesasData);
    if (reservasData) setReservas(reservasData as Reserva[]);
    if (clientesData) setClientes(clientesData);
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, [fechaFiltro]);

  useEffect(() => {
    const ch = supabase.channel('reserve-live')
      .on('postgres_changes',{event:'*',schema:'public',table:'reservas'}, fetchData)
      .on('postgres_changes',{event:'*',schema:'public',table:'mesas'}, fetchData)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);

  // ── Búsqueda en tiempo real ──────────────────────────────
  const reservasFiltradas = (() => {
    let base = reservas.filter(r => r.fecha === fechaFiltro);
    if (busqueda.trim()) {
      const q = busqueda.toLowerCase();
      base = reservas.filter(r =>
        r.nombre_cliente?.toLowerCase().includes(q) ||
        r.email?.toLowerCase().includes(q) ||
        r.telefono?.includes(q) ||
        r.customer_name?.toLowerCase().includes(q)
      );
    }
    return base.sort((a,b) => a.hora.localeCompare(b.hora));
  })();

  const clientesFiltrados = busqueda.trim()
    ? clientes.filter(c => {
        const q = busqueda.toLowerCase();
        return c.name?.toLowerCase().includes(q) || c.apellido?.toLowerCase().includes(q) || c.email?.toLowerCase().includes(q) || c.phone?.includes(q);
      })
    : clientes;

  // ── Acciones ─────────────────────────────────────────────
  const crearReserva = async () => {
    if (!form.nombre || !form.mesa_id || !form.fecha || !form.hora) { showToast('⚠️ Completa nombre, mesa, fecha y hora'); return; }
    const { error } = await supabase.from('reservas').insert({
      restaurante_id:6, mesa_id:form.mesa_id, nombre_cliente:form.nombre,
      telefono:form.telefono||null, email:form.email||null, pax:form.pax,
      fecha:form.fecha, hora:form.hora, duracion_min:form.duracion,
      ocasion:form.ocasion||null, nota:form.nota||null, estado:'confirmada', origen:form.origen,
    });
    if (error) { showToast(`✗ ${error.message}`); return; }
    await supabase.from('mesas').update({estado:'reservada'}).eq('id',form.mesa_id);
    showToast(`✓ Reserva confirmada — ${form.nombre}`);
    setForm({nombre:'',telefono:'',email:'',pax:2,fecha:hoy(),hora:'20:00',duracion:90,mesa_id:0,ocasion:'',nota:'',origen:'web'});
    setTab('lista'); fetchData();
  };

  const cambiarEstadoReserva = async (id:number, estado:EstadoReserva) => {
    await supabase.from('reservas').update({estado}).eq('id',id);
    const r = reservas.find(x=>x.id===id);
    if (r) {
      if (estado==='llegó') await supabase.from('mesas').update({estado:'ocupada'}).eq('id',r.mesa_id);
      if (estado==='cancelada'||estado==='no_show') await supabase.from('mesas').update({estado:'libre'}).eq('id',r.mesa_id);
    }
    showToast(`✓ ${RESERVA_CFG[estado].label}`);
    setReservaDetalle(null); fetchData();
  };

  const bloquearMesa = async () => {
    if (!bloqueoModal) return;
    await supabase.from('mesas').update({ estado:'bloqueada', bloqueada:true, bloqueo_motivo:bloqueoMotivo||null, bloqueo_hasta:bloqueoHasta||null }).eq('id',bloqueoModal.id);
    showToast(`🔒 Mesa ${bloqueoModal.numero} bloqueada`);
    setBloqueoModal(null); setBloqueoMotivo(''); setBloqueoHasta(''); fetchData();
  };

  const desbloquearMesa = async (mesa:Mesa) => {
    await supabase.from('mesas').update({ estado:'libre', bloqueada:false, bloqueo_motivo:null, bloqueo_hasta:null }).eq('id',mesa.id);
    showToast(`🔓 Mesa ${mesa.numero} desbloqueada`);
    fetchData();
  };

  const zonas = ['Todas',...Array.from(new Set(mesas.map(m=>m.zona)))];
  const mesasFiltradas = mesas.filter(m=>zonaFiltro==='Todas'||m.zona===zonaFiltro);
  const reservasHoy = reservas.filter(r=>r.fecha===fechaFiltro);
  const kpis = [
    { label:'Reservas hoy', value:reservasHoy.length,                                            color:S.blue   },
    { label:'Confirmadas',  value:reservasHoy.filter(r=>r.estado==='confirmada').length,          color:S.green  },
    { label:'Mesas libres', value:mesas.filter(m=>m.estado==='libre').length,                     color:S.goldL  },
    { label:'Pax esperados',value:reservasHoy.filter(r=>['confirmada','pendiente'].includes(r.estado)).reduce((a,r)=>a+r.pax,0), color:S.purple },
  ];

  return (
    <div style={{display:'flex',flexDirection:'column',height:'100%',background:S.bg,color:S.text1,fontFamily:"'DM Sans',sans-serif"}}>

      {/* Toast */}
      {toast && <div style={{position:'fixed',bottom:24,left:'50%',transform:'translateX(-50%)',background:'#222',border:`1px solid ${S.border}`,color:S.text1,padding:'10px 20px',borderRadius:10,fontSize:13,zIndex:9999,whiteSpace:'nowrap'}}>{toast}</div>}

      {/* Modal bloqueo */}
      {bloqueoModal && (
        <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,.8)',zIndex:700,display:'flex',alignItems:'center',justifyContent:'center',padding:20}}>
          <div style={{background:S.bg3,border:`2px solid ${S.red}40`,borderRadius:16,padding:28,maxWidth:400,width:'100%'}}>
            <div style={{fontFamily:"'Syne',sans-serif",fontSize:16,fontWeight:900,marginBottom:4}}>🔒 Bloquear Mesa {bloqueoModal.numero}</div>
            <div style={{fontSize:12,color:S.text3,marginBottom:16}}>La mesa no estará disponible para reservas</div>
            <div style={{fontSize:10,color:S.text3,marginBottom:4}}>Motivo del bloqueo</div>
            <select style={{...inp,marginBottom:10}} value={bloqueoMotivo} onChange={e=>setBloqueoMotivo(e.target.value)}>
              <option value="">Sin motivo especificado</option>
              {['Mantenimiento','Reservado para evento privado','Daño en mobiliario','Limpieza profunda','VIP — sin disponibilidad','Otro'].map(o=><option key={o}>{o}</option>)}
            </select>
            <div style={{fontSize:10,color:S.text3,marginBottom:4}}>Bloqueada hasta (opcional)</div>
            <input type="datetime-local" style={{...inp,marginBottom:16}} value={bloqueoHasta} onChange={e=>setBloqueoHasta(e.target.value)} />
            <div style={{display:'flex',gap:8}}>
              <button onClick={()=>{setBloqueoModal(null);setBloqueoMotivo('');setBloqueoHasta('');}} style={{flex:1,padding:'10px',borderRadius:10,border:`1px solid ${S.border}`,background:'transparent',color:S.text3,cursor:'pointer',fontSize:12,fontWeight:700}}>Cancelar</button>
              <button onClick={bloquearMesa} style={{flex:2,padding:'10px',borderRadius:10,border:'none',background:S.red,color:'#fff',cursor:'pointer',fontSize:12,fontWeight:700}}>🔒 Confirmar bloqueo</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal detalle reserva */}
      {reservaDetalle && (
        <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,.8)',zIndex:600,display:'flex',alignItems:'center',justifyContent:'center',padding:20}}>
          <div style={{background:S.bg3,border:`1px solid ${S.border}`,borderRadius:16,padding:28,maxWidth:480,width:'100%',maxHeight:'85vh',overflowY:'auto'}}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:16}}>
              <div>
                <div style={{fontFamily:"'Syne',sans-serif",fontSize:18,fontWeight:900}}>{reservaDetalle.nombre_cliente}</div>
                <div style={{fontSize:12,color:S.text3,marginTop:2,display:'flex',gap:8,flexWrap:'wrap'}}>
                  {reservaDetalle.vip_status && <span style={{color:S.gold}}>⭐ VIP</span>}
                  {reservaDetalle.total_visits && <span>{reservaDetalle.total_visits} visitas</span>}
                  {reservaDetalle.total_spent && <span>${Math.round(Number(reservaDetalle.total_spent)).toLocaleString('es-CO')} acumulado</span>}
                </div>
              </div>
              <button onClick={()=>setReservaDetalle(null)} style={{background:'none',border:'none',color:S.text3,fontSize:20,cursor:'pointer'}}>✕</button>
            </div>

            {/* Info del cliente desde CRM */}
            {(reservaDetalle.alergias?.length || reservaDetalle.preferencias?.length) && (
              <div style={{background:`${S.purple}10`,border:`1px solid ${S.purple}30`,borderRadius:10,padding:'10px 14px',marginBottom:12}}>
                <div style={{fontSize:10,color:S.purple,fontWeight:700,marginBottom:6}}>🧠 DATOS DEL CRM</div>
                {reservaDetalle.alergias?.length && (
                  <div style={{fontSize:11,color:S.red,marginBottom:4}}>⚠️ Alergias: {reservaDetalle.alergias.join(', ')}</div>
                )}
                {reservaDetalle.preferencias?.length && (
                  <div style={{fontSize:11,color:S.text2}}>⭐ Preferencias: {reservaDetalle.preferencias.join(', ')}</div>
                )}
              </div>
            )}

            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8,marginBottom:14}}>
              {[
                {l:'Mesa', v:`#${reservaDetalle.mesa_numero} — ${reservaDetalle.mesa_zona}`},
                {l:'Pax',  v:`${reservaDetalle.pax} personas`},
                {l:'Fecha',v:formatFecha(reservaDetalle.fecha)},
                {l:'Hora', v:formatHora(reservaDetalle.hora)},
                {l:'Duración',v:`${reservaDetalle.duracion_min||90} min`},
                {l:'Origen',v:reservaDetalle.origen||'—'},
              ].map(x=>(
                <div key={x.l} style={{background:S.bg2,borderRadius:8,padding:'8px 12px'}}>
                  <div style={{fontSize:10,color:S.text3,marginBottom:2}}>{x.l}</div>
                  <div style={{fontSize:13,fontWeight:600}}>{x.v}</div>
                </div>
              ))}
            </div>

            {reservaDetalle.ocasion && <div style={{background:`${S.purple}15`,border:`1px solid ${S.purple}30`,borderRadius:8,padding:'8px 12px',marginBottom:10,fontSize:12,color:S.purple}}>🎉 {reservaDetalle.ocasion}</div>}
            {reservaDetalle.nota    && <div style={{background:S.bg2,borderRadius:8,padding:'8px 12px',marginBottom:14,fontSize:12,color:S.text2}}>📝 {reservaDetalle.nota}</div>}

            <div style={{display:'flex',gap:8,marginBottom:14}}>
              {reservaDetalle.telefono && <a href={`https://wa.me/${reservaDetalle.telefono.replace(/\D/g,'')}`} target="_blank" style={{flex:1,padding:'8px',borderRadius:8,background:'#25D36615',border:'1px solid #25D36640',color:'#25D366',fontSize:11,fontWeight:700,textAlign:'center',textDecoration:'none'}}>💬 WhatsApp</a>}
              {reservaDetalle.telefono && <a href={`tel:${reservaDetalle.telefono}`} style={{flex:1,padding:'8px',borderRadius:8,background:`${S.blue}15`,border:`1px solid ${S.blue}40`,color:S.blue,fontSize:11,fontWeight:700,textAlign:'center',textDecoration:'none'}}>📞 Llamar</a>}
            </div>

            <div style={{fontSize:10,color:S.text3,marginBottom:8,fontWeight:700,textTransform:'uppercase' as const}}>Cambiar estado</div>
            <div style={{display:'flex',gap:6,flexWrap:'wrap'}}>
              {(['confirmada','llegó','cancelada','no_show'] as EstadoReserva[]).map(e=>{
                const cfg = RESERVA_CFG[e]; const active = reservaDetalle.estado===e;
                return <button key={e} onClick={()=>cambiarEstadoReserva(reservaDetalle.id,e)} style={{padding:'7px 14px',borderRadius:20,border:`1px solid ${active?cfg.color:S.border}`,background:active?`${cfg.color}20`:'transparent',color:active?cfg.color:S.text3,fontSize:11,fontWeight:700,cursor:'pointer'}}>{cfg.icon} {cfg.label}</button>;
              })}
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div style={{padding:'12px 20px',borderBottom:`1px solid ${S.border}`,display:'flex',alignItems:'center',justifyContent:'space-between',flexShrink:0,flexWrap:'wrap',gap:10}}>
        <div style={{display:'flex',alignItems:'center',gap:12}}>
          <div style={{width:36,height:36,borderRadius:10,background:`linear-gradient(135deg,${S.purple},#6040b0)`,display:'flex',alignItems:'center',justifyContent:'center',fontSize:18}}>📅</div>
          <div>
            <div style={{fontFamily:"'Syne',sans-serif",fontSize:15,fontWeight:900}}>RESERVE</div>
            <div style={{fontSize:11,color:S.text3}}>Gestión central de reservas — OMM</div>
          </div>
        </div>
        <div style={{display:'flex',gap:8,alignItems:'center',flexWrap:'wrap'}}>
          {/* Buscador global */}
          <div style={{position:'relative'}}>
            <input placeholder="🔍 Buscar por nombre, email, teléfono..." value={busqueda} onChange={e=>setBusqueda(e.target.value)}
              style={{...inp,width:260,paddingLeft:14,fontSize:12}} />
            {busqueda && <button onClick={()=>setBusqueda('')} style={{position:'absolute',right:10,top:'50%',transform:'translateY(-50%)',background:'none',border:'none',color:S.text3,cursor:'pointer',fontSize:14}}>✕</button>}
          </div>
          <input type="date" value={fechaFiltro} onChange={e=>setFechaFiltro(e.target.value)} style={{...inp,width:'auto',fontSize:12,padding:'6px 12px'}} />
          <button onClick={()=>setTab('nueva')} style={{background:S.purple,color:'#fff',border:'none',padding:'8px 16px',borderRadius:8,fontSize:12,fontWeight:700,cursor:'pointer'}}>+ Nueva</button>
        </div>
      </div>

      {/* KPIs */}
      <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:8,padding:'10px 20px',borderBottom:`1px solid ${S.border}`,flexShrink:0}}>
        {kpis.map(k=>(
          <div key={k.label} style={{background:S.bg2,border:`1px solid ${S.border}`,borderRadius:10,padding:'8px 14px'}}>
            <div style={{fontSize:10,color:S.text3,marginBottom:2}}>{k.label}</div>
            <div style={{fontFamily:"'Syne',sans-serif",fontSize:22,fontWeight:900,color:k.color}}>{k.value}</div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div style={{display:'flex',borderBottom:`1px solid ${S.border}`,flexShrink:0}}>
        {([
          {id:'mapa',     label:'🗺️ Mapa'},
          {id:'lista',    label:`📋 Reservas${busqueda?' (búsqueda)':` (${reservasHoy.length})`}`},
          {id:'timeline', label:'⏱️ Timeline'},
          {id:'clientes', label:`👥 Clientes (${clientes.length})`},
          {id:'nueva',    label:'➕ Nueva'},
        ] as const).map(t=>(
          <button key={t.id} onClick={()=>setTab(t.id)}
            style={{padding:'10px 16px',background:'none',border:'none',cursor:'pointer',fontSize:12,fontWeight:700,whiteSpace:'nowrap',color:tab===t.id?S.purple:S.text3,borderBottom:`2px solid ${tab===t.id?S.purple:'transparent'}`,transition:'all .15s'}}>
            {t.label}
          </button>
        ))}
      </div>

      <div style={{flex:1,overflowY:'auto',padding:16}}>

        {/* ── MAPA ── */}
        {tab==='mapa' && (
          <div>
            <div style={{display:'flex',gap:8,marginBottom:14,flexWrap:'wrap',alignItems:'center'}}>
              {zonas.map(z=>(
                <button key={z} onClick={()=>setZonaFiltro(z)}
                  style={{padding:'5px 14px',borderRadius:20,border:`1px solid ${zonaFiltro===z?S.purple:S.border}`,background:zonaFiltro===z?`${S.purple}15`:'transparent',color:zonaFiltro===z?S.purple:S.text3,fontSize:11,fontWeight:700,cursor:'pointer'}}>
                  {z}
                </button>
              ))}
              {/* Leyenda */}
              <div style={{marginLeft:'auto',display:'flex',gap:12}}>
                {Object.entries(ESTADO_CFG).map(([k,v])=>(
                  <div key={k} style={{display:'flex',alignItems:'center',gap:5,fontSize:10,color:S.text2}}>
                    <div style={{width:8,height:8,borderRadius:'50%',background:v.color}}/>
                    {v.label}
                  </div>
                ))}
              </div>
            </div>
            {Array.from(new Set(mesasFiltradas.map(m=>m.zona))).map(zona=>{
              const mesasZona = mesasFiltradas.filter(m=>m.zona===zona);
              return (
                <div key={zona} style={{marginBottom:20}}>
                  <div style={{fontSize:11,color:S.text3,fontWeight:700,textTransform:'uppercase' as const,letterSpacing:'.08em',marginBottom:10}}>{zona} — {mesasZona.length} mesas</div>
                  <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(130px,1fr))',gap:10}}>
                    {mesasZona.map(mesa=>{
                      const efectivo = mesa.bloqueada ? 'bloqueada' : mesa.estado;
                      const cfg = ESTADO_CFG[efectivo as EstadoMesa];
                      const reservaMesa = reservasHoy.find(r=>r.mesa_id===mesa.id&&['confirmada','pendiente'].includes(r.estado));
                      return (
                        <div key={mesa.id} style={{background:cfg.bg,border:`2px solid ${cfg.color}50`,borderRadius:14,padding:12,cursor:'pointer',transition:'all .2s',position:'relative'}}
                          onMouseEnter={e=>e.currentTarget.style.borderColor=cfg.color}
                          onMouseLeave={e=>e.currentTarget.style.borderColor=`${cfg.color}50`}>
                          <div style={{fontFamily:"'Syne',sans-serif",fontSize:22,fontWeight:900,color:S.text1}}>{mesa.numero}</div>
                          <div style={{fontSize:10,color:cfg.color,fontWeight:700,marginTop:2}}>{cfg.label}</div>
                          <div style={{fontSize:10,color:S.text3}}>👥 {mesa.capacidad}</div>
                          {reservaMesa && <div style={{marginTop:5,fontSize:10,color:S.goldL,background:`${S.gold}15`,borderRadius:6,padding:'2px 6px'}}>{formatHora(reservaMesa.hora)} · {reservaMesa.nombre_cliente.split(' ')[0]}</div>}
                          {mesa.bloqueada && mesa.bloqueo_motivo && <div style={{fontSize:9,color:S.text3,marginTop:4}}>🔒 {mesa.bloqueo_motivo}</div>}
                          {/* Acciones */}
                          <div style={{display:'flex',gap:4,marginTop:8}}>
                            {mesa.estado==='libre' && !mesa.bloqueada && (
                              <button onClick={()=>{setForm(p=>({...p,mesa_id:mesa.id}));setTab('nueva');}}
                                style={{flex:1,padding:'4px',borderRadius:6,border:`1px solid ${S.green}40`,background:`${S.green}10`,color:S.green,fontSize:9,fontWeight:700,cursor:'pointer'}}>
                                + Reservar
                              </button>
                            )}
                            {!mesa.bloqueada
                              ? <button onClick={()=>setBloqueoModal(mesa)} style={{flex:1,padding:'4px',borderRadius:6,border:`1px solid ${S.red}30`,background:`${S.red}08`,color:S.red,fontSize:9,fontWeight:700,cursor:'pointer'}}>🔒</button>
                              : <button onClick={()=>desbloquearMesa(mesa)} style={{flex:1,padding:'4px',borderRadius:6,border:`1px solid ${S.green}40`,background:`${S.green}10`,color:S.green,fontSize:9,fontWeight:700,cursor:'pointer'}}>🔓</button>
                            }
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* ── LISTA RESERVAS ── */}
        {tab==='lista' && (
          <div style={{display:'flex',flexDirection:'column',gap:8}}>
            {busqueda && <div style={{fontSize:11,color:S.text3,marginBottom:4}}>{reservasFiltradas.length} resultado{reservasFiltradas.length!==1?'s':''} para "{busqueda}"</div>}
            {reservasFiltradas.length===0 && (
              <div style={{background:S.bg2,border:`1px solid ${S.border}`,borderRadius:14,padding:40,textAlign:'center'}}>
                <div style={{fontSize:32,marginBottom:12}}>📅</div>
                <div style={{fontSize:14,fontWeight:700}}>{busqueda ? 'Sin resultados para esa búsqueda' : 'Sin reservas para este día'}</div>
              </div>
            )}
            {reservasFiltradas.map(r=>{
              const cfg = RESERVA_CFG[r.estado];
              return (
                <div key={r.id} onClick={()=>setReservaDetalle(r)}
                  style={{background:S.bg2,border:`1px solid ${r.estado==='llegó'?S.green+'40':S.border}`,borderRadius:14,padding:14,cursor:'pointer',display:'flex',alignItems:'center',gap:12,transition:'all .2s'}}
                  onMouseEnter={e=>e.currentTarget.style.borderColor=S.purple+'50'}
                  onMouseLeave={e=>e.currentTarget.style.borderColor=r.estado==='llegó'?S.green+'40':S.border}>
                  <div style={{textAlign:'center',minWidth:48}}>
                    <div style={{fontFamily:"'Syne',sans-serif",fontSize:15,fontWeight:900,color:S.goldL}}>{formatHora(r.hora)}</div>
                    <div style={{fontSize:10,color:S.text3}}>{r.duracion_min||90}m</div>
                  </div>
                  <div style={{width:38,height:38,borderRadius:10,background:S.bg3,border:`1px solid ${S.border}`,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',flexShrink:0}}>
                    <div style={{fontSize:9,color:S.text3}}>M</div>
                    <div style={{fontFamily:"'Syne',sans-serif",fontSize:14,fontWeight:900}}>{r.mesa_numero}</div>
                  </div>
                  <div style={{flex:1}}>
                    <div style={{display:'flex',alignItems:'center',gap:7,marginBottom:2}}>
                      <span style={{fontSize:14,fontWeight:700}}>{r.nombre_cliente}</span>
                      {r.vip_status && <span style={{fontSize:10,color:S.gold}}>⭐ VIP</span>}
                      {r.ocasion && <span style={{fontSize:10,background:`${S.purple}15`,color:S.purple,padding:'1px 6px',borderRadius:10}}>{r.ocasion}</span>}
                      {r.alergias?.length && <span style={{fontSize:10,background:`${S.red}15`,color:S.red,padding:'1px 6px',borderRadius:10}}>⚠️ Alergias</span>}
                    </div>
                    <div style={{fontSize:11,color:S.text3}}>
                      👥 {r.pax}p · {r.mesa_zona} · {r.origen||'—'}
                      {r.total_visits && <span style={{marginLeft:6}}>· {r.total_visits} visitas</span>}
                      {r.total_spent && <span style={{marginLeft:6,color:S.goldL}}>· ${Math.round(Number(r.total_spent)).toLocaleString('es-CO')}</span>}
                    </div>
                  </div>
                  <span style={{background:`${cfg.color}20`,color:cfg.color,border:`1px solid ${cfg.color}40`,padding:'4px 12px',borderRadius:20,fontSize:11,fontWeight:700,flexShrink:0}}>
                    {cfg.icon} {cfg.label}
                  </span>
                </div>
              );
            })}
          </div>
        )}

        {/* ── TIMELINE ── */}
        {tab==='timeline' && (
          <div>
            <div style={{fontSize:12,color:S.text3,marginBottom:14}}>{formatFecha(fechaFiltro)} — disponibilidad por franja horaria</div>
            {['12:00','13:00','14:00','15:00','19:00','19:30','20:00','20:30','21:00','21:30','22:00','22:30','23:00'].map(hora=>{
              const rs = reservasHoy.filter(r=>formatHora(r.hora)===hora);
              return (
                <div key={hora} style={{display:'flex',gap:10,marginBottom:8,alignItems:'flex-start'}}>
                  <div style={{minWidth:46,fontSize:12,fontWeight:700,color:S.goldL,paddingTop:10}}>{hora}</div>
                  <div style={{flex:1,display:'flex',gap:8,flexWrap:'wrap'}}>
                    {rs.length>0 ? rs.map(r=>{
                      const cfg=RESERVA_CFG[r.estado];
                      return (
                        <div key={r.id} onClick={()=>setReservaDetalle(r)}
                          style={{background:`${cfg.color}15`,border:`1px solid ${cfg.color}40`,borderRadius:10,padding:'8px 14px',cursor:'pointer',minWidth:160}}>
                          <div style={{fontSize:13,fontWeight:700}}>{r.nombre_cliente.split(' ')[0]}</div>
                          <div style={{fontSize:10,color:S.text3}}>Mesa {r.mesa_numero} · {r.pax}p · {cfg.label}</div>
                        </div>
                      );
                    }) : (
                      <div style={{background:S.bg2,border:`1px dashed ${S.border}`,borderRadius:10,padding:'8px 14px',fontSize:11,color:S.text3}}>Disponible</div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* ── CLIENTES ── */}
        {tab==='clientes' && (
          <div>
            {busqueda && <div style={{fontSize:11,color:S.text3,marginBottom:10}}>{clientesFiltrados.length} cliente{clientesFiltrados.length!==1?'s':''} encontrado{clientesFiltrados.length!==1?'s':''}</div>}
            {clientesFiltrados.length===0 && (
              <div style={{background:S.bg2,border:`1px solid ${S.border}`,borderRadius:14,padding:40,textAlign:'center'}}>
                <div style={{fontSize:32,marginBottom:12}}>👥</div>
                <div style={{fontSize:14,fontWeight:700}}>{busqueda?'Sin resultados':'Sin clientes aún'}</div>
              </div>
            )}
            <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(280px,1fr))',gap:12}}>
              {clientesFiltrados.map(c=>(
                <div key={c.id} onClick={()=>setClienteDetalle(c)}
                  style={{background:S.bg2,border:`1px solid ${c.vip_status?S.gold+'40':S.border}`,borderRadius:14,padding:16,cursor:'pointer',transition:'all .2s'}}
                  onMouseEnter={e=>e.currentTarget.style.borderColor=S.purple+'50'}
                  onMouseLeave={e=>e.currentTarget.style.borderColor=c.vip_status?S.gold+'40':S.border}>
                  <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:10}}>
                    <div style={{width:40,height:40,borderRadius:10,background:`linear-gradient(135deg,${S.purple},#4030a0)`,display:'flex',alignItems:'center',justifyContent:'center',fontFamily:"'Syne',sans-serif",fontSize:16,fontWeight:900,color:'#fff',flexShrink:0}}>
                      {c.name.charAt(0).toUpperCase()}
                    </div>
                    <div style={{flex:1,minWidth:0}}>
                      <div style={{fontSize:14,fontWeight:700,display:'flex',alignItems:'center',gap:6}}>
                        {c.name} {c.apellido}
                        {c.vip_status && <span style={{fontSize:10,color:S.gold}}>⭐ VIP</span>}
                      </div>
                      <div style={{fontSize:11,color:S.text3}}>{c.email||c.phone||'Sin contacto'}</div>
                    </div>
                  </div>
                  <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:6}}>
                    <div style={{background:S.bg3,borderRadius:8,padding:'6px 10px'}}>
                      <div style={{fontSize:9,color:S.text3}}>Visitas</div>
                      <div style={{fontSize:16,fontWeight:900,color:S.blue}}>{c.total_visits||0}</div>
                    </div>
                    <div style={{background:S.bg3,borderRadius:8,padding:'6px 10px'}}>
                      <div style={{fontSize:9,color:S.text3}}>Gastado</div>
                      <div style={{fontSize:14,fontWeight:900,color:S.goldL}}>${(c.total_spent||0).toLocaleString('es-CO')}</div>
                    </div>
                  </div>
                  {c.alergias?.length && <div style={{marginTop:8,fontSize:10,color:S.red,background:`${S.red}10`,borderRadius:6,padding:'4px 8px'}}>⚠️ {c.alergias.join(', ')}</div>}
                  {c.notes && <div style={{marginTop:6,fontSize:11,color:S.text2}}>{c.notes}</div>}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── NUEVA RESERVA ── */}
        {tab==='nueva' && (
          <div style={{maxWidth:600,display:'flex',flexDirection:'column',gap:14}}>

            {/* Cliente */}
            <div style={{background:S.bg2,border:`1px solid ${S.border}`,borderRadius:14,padding:18}}>
              <div style={{fontSize:11,color:S.purple,fontWeight:700,textTransform:'uppercase' as const,letterSpacing:'.08em',marginBottom:14}}>Cliente</div>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}>
                <div>
                  <div style={{fontSize:10,color:S.text3,marginBottom:4}}>Nombre *</div>
                  <input style={inp} placeholder="Nombre completo" value={form.nombre} onChange={e=>setF('nombre',e.target.value)} />
                </div>
                <div>
                  <div style={{fontSize:10,color:S.text3,marginBottom:4}}>Personas *</div>
                  <select style={inp} value={form.pax} onChange={e=>setF('pax',parseInt(e.target.value))}>
                    {[1,2,3,4,5,6,7,8,10,12,15,20].map(n=><option key={n}>{n}</option>)}
                  </select>
                </div>
                <div>
                  <div style={{fontSize:10,color:S.text3,marginBottom:4}}>Teléfono / WhatsApp</div>
                  <input style={inp} placeholder="+57 310 000 0000" value={form.telefono} onChange={e=>setF('telefono',e.target.value)} />
                </div>
                <div>
                  <div style={{fontSize:10,color:S.text3,marginBottom:4}}>Email</div>
                  <input style={inp} placeholder="email@correo.com" value={form.email} onChange={e=>setF('email',e.target.value)} />
                </div>
              </div>
            </div>

            {/* Fecha, hora, mesa */}
            <div style={{background:S.bg2,border:`1px solid ${S.border}`,borderRadius:14,padding:18}}>
              <div style={{fontSize:11,color:S.goldL,fontWeight:700,textTransform:'uppercase' as const,letterSpacing:'.08em',marginBottom:14}}>Fecha y mesa</div>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:10,marginBottom:12}}>
                <div>
                  <div style={{fontSize:10,color:S.text3,marginBottom:4}}>Fecha *</div>
                  <input type="date" style={inp} value={form.fecha} onChange={e=>setF('fecha',e.target.value)} />
                </div>
                <div>
                  <div style={{fontSize:10,color:S.text3,marginBottom:4}}>Hora *</div>
                  <select style={inp} value={form.hora} onChange={e=>setF('hora',e.target.value)}>
                    {['12:00','12:30','13:00','13:30','14:00','14:30','15:00','19:00','19:30','20:00','20:30','21:00','21:30','22:00','22:30','23:00'].map(h=><option key={h}>{h}</option>)}
                  </select>
                </div>
                <div>
                  <div style={{fontSize:10,color:S.text3,marginBottom:4}}>Duración</div>
                  <select style={inp} value={form.duracion} onChange={e=>setF('duracion',parseInt(e.target.value))}>
                    {[60,90,120,150,180].map(d=><option key={d} value={d}>{d} min</option>)}
                  </select>
                </div>
              </div>
              {/* Selector visual de mesas */}
              <div style={{fontSize:10,color:S.text3,marginBottom:8,fontWeight:700,textTransform:'uppercase' as const}}>Mesa * — toca para seleccionar</div>
              <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(70px,1fr))',gap:8}}>
                {mesas.filter(m=>!m.bloqueada).map(m=>{
                  const disp = m.estado==='libre';
                  const sel = form.mesa_id===m.id;
                  const cfg = ESTADO_CFG[m.estado as EstadoMesa];
                  return (
                    <div key={m.id} onClick={()=>disp&&setF('mesa_id',m.id)}
                      style={{background:sel?`${S.purple}20`:cfg.bg,border:`2px solid ${sel?S.purple:cfg.color+'40'}`,borderRadius:10,padding:'8px',textAlign:'center',cursor:disp?'pointer':'not-allowed',opacity:disp?1:0.5,transition:'all .2s'}}>
                      <div style={{fontFamily:"'Syne',sans-serif",fontSize:16,fontWeight:900,color:sel?S.purple:S.text1}}>{m.numero}</div>
                      <div style={{fontSize:9,color:S.text3}}>{m.capacidad}p</div>
                      <div style={{fontSize:9,color:cfg.color}}>{m.zona.slice(0,5)}</div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Detalles */}
            <div style={{background:S.bg2,border:`1px solid ${S.border}`,borderRadius:14,padding:18}}>
              <div style={{fontSize:11,color:S.text3,fontWeight:700,textTransform:'uppercase' as const,letterSpacing:'.08em',marginBottom:14}}>Detalles</div>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10,marginBottom:10}}>
                <div>
                  <div style={{fontSize:10,color:S.text3,marginBottom:4}}>Ocasión</div>
                  <select style={inp} value={form.ocasion} onChange={e=>setF('ocasion',e.target.value)}>
                    <option value="">Sin ocasión especial</option>
                    {OCASIONES.map(o=><option key={o}>{o}</option>)}
                  </select>
                </div>
                <div>
                  <div style={{fontSize:10,color:S.text3,marginBottom:4}}>Origen</div>
                  <select style={inp} value={form.origen} onChange={e=>setF('origen',e.target.value)}>
                    {ORIGENES.map(o=><option key={o}>{o}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <div style={{fontSize:10,color:S.text3,marginBottom:4}}>Nota para el equipo</div>
                <textarea style={{...inp,minHeight:70,resize:'vertical' as const}} placeholder="Ej: Mesa con vista, champagne de bienvenida..." value={form.nota} onChange={e=>setF('nota',e.target.value)} />
              </div>
            </div>

            <button onClick={crearReserva}
              style={{width:'100%',padding:14,borderRadius:12,border:'none',background:S.purple,color:'#fff',fontSize:14,fontWeight:900,cursor:'pointer',fontFamily:"'Syne',sans-serif"}}>
              ✓ Confirmar reserva
            </button>
          </div>
        )}

      </div>
    </div>
  );
}
