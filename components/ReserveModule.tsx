import React, { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../lib/supabase.ts';

// ── Design tokens ──────────────────────────────────────────────────────────
const C = {
  bg:     '#080810',
  bg2:    '#0f0f1a',
  bg3:    '#161624',
  bg4:    '#1e1e2e',
  glass:  'rgba(255,255,255,0.03)',
  border: 'rgba(255,255,255,0.07)',
  border2:'rgba(255,255,255,0.12)',
  pink:   '#FF2D78',
  pinkD:  '#cc2260',
  pinkG:  'rgba(255,45,120,0.12)',
  gold:   '#FFB547',
  green:  '#00E676',
  blue:   '#448AFF',
  purple: '#B388FF',
  red:    '#FF5252',
  t1:     '#FFFFFF',
  t2:     '#A0A0B8',
  t3:     '#50506A',
};

const HORAS = ['12:00','12:30','13:00','13:30','14:00','14:30','15:00','19:00','19:30','20:00','20:30','21:00','21:30','22:00','22:30','23:00'];
const OCASIONES = ['Cumpleaños','Aniversario','Negocio','Primera Cita','Celebración','Graduación','Despedida','Otro'];
const ORIGENES  = ['web','whatsapp','instagram','oh_yeah','telefono','walk-in'];
const MOTIVOS_BLOQUEO = ['Mantenimiento','Evento privado','Daño en mobiliario','Limpieza','VIP exclusivo','Otro'];

const hoy = () => new Date().toISOString().split('T')[0];
const fmtHora = (h:string) => h?.slice(0,5) ?? '';
const fmtFecha = (f:string) => {
  if (!f) return '';
  const d = new Date(f + 'T00:00:00');
  return d.toLocaleDateString('es-CO', { weekday:'short', day:'numeric', month:'short' });
};
const diasSemana = () => {
  const dias = [];
  for (let i = -1; i <= 5; i++) {
    const d = new Date();
    d.setDate(d.getDate() + i);
    dias.push({
      iso: d.toISOString().split('T')[0],
      dia: ['D','L','M','M','J','V','S'][d.getDay()],
      num: d.getDate(),
      esHoy: i === 0,
    });
  }
  return dias;
};

interface Mesa { id:number; numero:number; capacidad:number; zona:string; estado:string; bloqueada?:boolean; bloqueo_motivo?:string; }
interface Reserva { id:number; mesa_id:number; nombre_cliente:string; telefono?:string; email?:string; pax:number; fecha:string; hora:string; duracion_min?:number; ocasion?:string; nota?:string; estado:string; origen?:string; customer_id?:number; mesa_numero?:number; mesa_zona?:string; vip_status?:boolean; total_visits?:number; total_spent?:number; alergias?:string[]; preferencias?:string[]; }
interface Customer { id:number; name:string; apellido?:string; phone?:string; email?:string; vip_status?:boolean; total_visits?:number; total_spent?:number; alergias?:string[]; preferencias?:string[]; }

const ZONA_COLOR: Record<string,string> = { Principal:C.blue, Barra:C.purple, Terraza:C.green, VIP:C.gold };
const ESTADO_CFG: Record<string,{c:string;label:string}> = {
  libre:     { c:C.green,  label:'Libre'     },
  ocupada:   { c:C.red,    label:'Ocupada'   },
  reservada: { c:C.gold,   label:'Reservada' },
  bloqueada: { c:C.t3,     label:'Bloqueada' },
};
const RES_CFG: Record<string,{c:string;icon:string;label:string}> = {
  pendiente:  { c:C.gold,   icon:'⏳', label:'Pendiente'  },
  confirmada: { c:C.blue,   icon:'✓',  label:'Confirmada' },
  'llegó':    { c:C.green,  icon:'●',  label:'Llegó'      },
  cancelada:  { c:C.red,    icon:'✕',  label:'Cancelada'  },
  no_show:    { c:C.t3,     icon:'—',  label:'No Show'    },
};

// ── Estilos base ───────────────────────────────────────────────────────────
const inp: React.CSSProperties = {
  background: 'rgba(255,255,255,0.05)',
  border: `1px solid ${C.border2}`,
  borderRadius: 10,
  padding: '10px 14px',
  color: C.t1,
  fontSize: 13,
  outline: 'none',
  width: '100%',
  fontFamily: "'DM Sans', sans-serif",
};

export default function ReserveModule() {
  const [mesas, setMesas]       = useState<Mesa[]>([]);
  const [reservas, setReservas] = useState<Reserva[]>([]);
  const [clientes, setClientes] = useState<Customer[]>([]);
  const [fecha, setFecha]       = useState(hoy());
  const [busqueda, setBusqueda] = useState('');
  const [vistaTab, setVistaTab] = useState<'mapa'|'lista'|'timeline'>('mapa');
  const [zonaFiltro, setZonaFiltro] = useState('Todas');
  const [panelMesa, setPanelMesa]   = useState<Mesa|null>(null);
  const [panelReserva, setPanelReserva] = useState<Reserva|null>(null);
  const [modalNueva, setModalNueva] = useState(false);
  const [modalBloqueo, setModalBloqueo] = useState<Mesa|null>(null);
  const [bloqueoMotivo, setBloqueoMotivo] = useState('');
  const [bloqueoHasta, setBloqueoHasta]   = useState('');
  const [toast, setToast]       = useState('');
  const [form, setForm]         = useState({ nombre:'', telefono:'', email:'', pax:2, fecha:hoy(), hora:'20:00', duracion:90, mesa_id:0, ocasion:'', nota:'', origen:'whatsapp' });
  const [buscandoCliente, setBuscandoCliente] = useState(false);
  const [clienteSugerido, setClienteSugerido] = useState<Customer|null>(null);

  const showToast = useCallback((m:string) => { setToast(m); setTimeout(()=>setToast(''), 3000); }, []);
  const setF = (k:string,v:any) => setForm(p=>({...p,[k]:v}));

  // ── Fetch ────────────────────────────────────────────────────────────────
  const fetchData = async () => {
    const [{ data:m },{ data:r },{ data:c }] = await Promise.all([
      supabase.from('mesas').select('*').eq('restaurante_id',6).order('numero'),
      supabase.from('vista_reservas').select('*').order('hora'),
      supabase.from('customers').select('id,name,apellido,phone,email,vip_status,total_visits,total_spent,alergias,preferencias').order('name'),
    ]);
    if (m) setMesas(m);
    if (r) setReservas(r as Reserva[]);
    if (c) setClientes(c);
  };

  useEffect(() => {
    fetchData();
    const ch = supabase.channel('reserve-v4')
      .on('postgres_changes',{event:'*',schema:'public',table:'reservas'},fetchData)
      .on('postgres_changes',{event:'*',schema:'public',table:'mesas'},fetchData)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);

  // ── Buscar cliente por teléfono ──────────────────────────────────────────
  useEffect(() => {
    if (form.telefono.length >= 7) {
      const c = clientes.find(c => c.phone?.includes(form.telefono) || form.telefono.includes(c.phone?.slice(-7)||'xxxxx'));
      setClienteSugerido(c||null);
      if (c && !form.nombre) setF('nombre', `${c.name}${c.apellido?' '+c.apellido:''}`);
    } else setClienteSugerido(null);
  }, [form.telefono]);

  // ── Datos filtrados ──────────────────────────────────────────────────────
  const resHoy = reservas.filter(r => r.fecha === fecha);
  const resFiltradas = (() => {
    if (!busqueda.trim()) return resHoy;
    const q = busqueda.toLowerCase();
    return reservas.filter(r =>
      r.nombre_cliente?.toLowerCase().includes(q) ||
      r.telefono?.includes(q) ||
      r.email?.toLowerCase().includes(q)
    );
  })();

  const mesasFiltradas = zonaFiltro === 'Todas' ? mesas : mesas.filter(m=>m.zona===zonaFiltro);
  const zonas = ['Todas', ...Array.from(new Set(mesas.map(m=>m.zona)))];

  const kpis = [
    { l:'Reservas', v:resHoy.length,                                                  c:C.pink   },
    { l:'Confirmadas', v:resHoy.filter(r=>r.estado==='confirmada').length,            c:C.blue   },
    { l:'Pax esperados', v:resHoy.filter(r=>['confirmada','pendiente'].includes(r.estado)).reduce((a,r)=>a+r.pax,0), c:C.gold },
    { l:'Mesas libres', v:mesas.filter(m=>m.estado==='libre'&&!m.bloqueada).length,  c:C.green  },
    { l:'Ocupación', v:`${Math.round(mesas.filter(m=>m.estado!=='libre').length/Math.max(mesas.length,1)*100)}%`, c:C.purple },
  ];

  // ── Acciones ─────────────────────────────────────────────────────────────
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
    setModalNueva(false);
    setForm({nombre:'',telefono:'',email:'',pax:2,fecha:hoy(),hora:'20:00',duracion:90,mesa_id:0,ocasion:'',nota:'',origen:'whatsapp'});
    fetchData();
  };

  const cambiarEstado = async (id:number, estado:string, mesa_id:number) => {
    await supabase.from('reservas').update({estado}).eq('id',id);
    if (estado==='llegó') await supabase.from('mesas').update({estado:'ocupada'}).eq('id',mesa_id);
    if (['cancelada','no_show'].includes(estado)) await supabase.from('mesas').update({estado:'libre'}).eq('id',mesa_id);
    showToast(`✓ ${RES_CFG[estado]?.label}`);
    setPanelReserva(null);
    fetchData();
  };

  const bloquearMesa = async () => {
    if (!modalBloqueo) return;
    await supabase.from('mesas').update({ estado:'bloqueada', bloqueada:true, bloqueo_motivo:bloqueoMotivo||null, bloqueo_hasta:bloqueoHasta||null }).eq('id',modalBloqueo.id);
    showToast(`🔒 Mesa ${modalBloqueo.numero} bloqueada`);
    setModalBloqueo(null); setBloqueoMotivo(''); setBloqueoHasta('');
    fetchData();
  };

  const desbloquearMesa = async (m:Mesa) => {
    await supabase.from('mesas').update({estado:'libre',bloqueada:false,bloqueo_motivo:null}).eq('id',m.id);
    showToast(`🔓 Mesa ${m.numero} desbloqueada`);
    fetchData();
  };

  // ── RENDER ────────────────────────────────────────────────────────────────
  return (
    <div style={{height:'100%',display:'flex',flexDirection:'column',background:C.bg,color:C.t1,fontFamily:"'DM Sans',sans-serif",overflow:'hidden'}}>

      {/* Toast */}
      {toast && (
        <div style={{position:'fixed',bottom:28,left:'50%',transform:'translateX(-50%)',background:C.bg4,border:`1px solid ${C.pink}`,color:C.t1,padding:'10px 24px',borderRadius:50,fontSize:13,zIndex:9999,backdropFilter:'blur(20px)',whiteSpace:'nowrap',boxShadow:`0 0 30px ${C.pinkG}`}}>
          {toast}
        </div>
      )}

      {/* Modal bloqueo */}
      {modalBloqueo && (
        <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.85)',zIndex:800,display:'flex',alignItems:'center',justifyContent:'center',backdropFilter:'blur(8px)'}}>
          <div style={{background:C.bg3,border:`1px solid ${C.border2}`,borderRadius:20,padding:28,width:400,boxShadow:`0 0 60px rgba(255,82,82,0.2)`}}>
            <div style={{fontSize:18,fontWeight:900,fontFamily:"'Syne',sans-serif",marginBottom:4}}>🔒 Bloquear M{modalBloqueo.numero}</div>
            <div style={{fontSize:12,color:C.t3,marginBottom:20}}>La mesa no estará disponible</div>
            <div style={{fontSize:10,color:C.t3,marginBottom:6,fontWeight:700,textTransform:'uppercase' as const}}>Motivo</div>
            <select style={{...inp,marginBottom:12}} value={bloqueoMotivo} onChange={e=>setBloqueoMotivo(e.target.value)}>
              <option value="">Sin especificar</option>
              {MOTIVOS_BLOQUEO.map(m=><option key={m}>{m}</option>)}
            </select>
            <div style={{fontSize:10,color:C.t3,marginBottom:6,fontWeight:700,textTransform:'uppercase' as const}}>Bloqueada hasta</div>
            <input type="datetime-local" style={{...inp,marginBottom:20}} value={bloqueoHasta} onChange={e=>setBloqueoHasta(e.target.value)} />
            <div style={{display:'flex',gap:10}}>
              <button onClick={()=>setModalBloqueo(null)} style={{flex:1,padding:11,borderRadius:10,border:`1px solid ${C.border2}`,background:'transparent',color:C.t3,cursor:'pointer',fontSize:13,fontWeight:700}}>Cancelar</button>
              <button onClick={bloquearMesa} style={{flex:2,padding:11,borderRadius:10,border:'none',background:C.red,color:'#fff',cursor:'pointer',fontSize:13,fontWeight:700}}>Confirmar bloqueo</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal nueva reserva */}
      {modalNueva && (
        <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.9)',zIndex:700,display:'flex',alignItems:'center',justifyContent:'center',backdropFilter:'blur(12px)',padding:20}}>
          <div style={{background:C.bg3,border:`1px solid ${C.border2}`,borderRadius:24,padding:28,width:'100%',maxWidth:560,maxHeight:'90vh',overflowY:'auto',boxShadow:`0 0 80px ${C.pinkG}`}}>
            {/* Header modal */}
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:24}}>
              <div>
                <div style={{fontFamily:"'Syne',sans-serif",fontSize:20,fontWeight:900}}>Nueva reserva</div>
                <div style={{fontSize:12,color:C.t3,marginTop:2}}>{fmtFecha(form.fecha)}</div>
              </div>
              <button onClick={()=>setModalNueva(false)} style={{background:C.bg4,border:`1px solid ${C.border}`,color:C.t2,width:36,height:36,borderRadius:10,cursor:'pointer',fontSize:18,display:'flex',alignItems:'center',justifyContent:'center'}}>✕</button>
            </div>

            {/* Cliente */}
            <div style={{marginBottom:14}}>
              <div style={{fontSize:10,color:C.pink,fontWeight:700,textTransform:'uppercase' as const,letterSpacing:'.1em',marginBottom:10}}>Cliente</div>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10,marginBottom:10}}>
                <div>
                  <div style={{fontSize:10,color:C.t3,marginBottom:4}}>Teléfono / WhatsApp</div>
                  <input style={inp} placeholder="+57 310..." value={form.telefono} onChange={e=>setF('telefono',e.target.value)} />
                  {clienteSugerido && (
                    <div style={{marginTop:6,background:`${C.green}10`,border:`1px solid ${C.green}30`,borderRadius:8,padding:'6px 10px',fontSize:11,color:C.green,cursor:'pointer'}}
                      onClick={()=>{ setF('nombre',`${clienteSugerido.name}${clienteSugerido.apellido?' '+clienteSugerido.apellido:''}`); setF('email',clienteSugerido.email||''); }}>
                      ✓ {clienteSugerido.name} — {clienteSugerido.total_visits} visitas
                    </div>
                  )}
                </div>
                <div>
                  <div style={{fontSize:10,color:C.t3,marginBottom:4}}>Nombre completo *</div>
                  <input style={inp} placeholder="Nombre..." value={form.nombre} onChange={e=>setF('nombre',e.target.value)} />
                </div>
              </div>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}>
                <div>
                  <div style={{fontSize:10,color:C.t3,marginBottom:4}}>Email</div>
                  <input style={inp} placeholder="email@..." value={form.email} onChange={e=>setF('email',e.target.value)} />
                </div>
                <div>
                  <div style={{fontSize:10,color:C.t3,marginBottom:4}}>Personas</div>
                  <select style={inp} value={form.pax} onChange={e=>setF('pax',parseInt(e.target.value))}>
                    {[1,2,3,4,5,6,7,8,10,12,15,20].map(n=><option key={n}>{n}</option>)}
                  </select>
                </div>
              </div>
            </div>

            {/* Fecha hora */}
            <div style={{marginBottom:14}}>
              <div style={{fontSize:10,color:C.pink,fontWeight:700,textTransform:'uppercase' as const,letterSpacing:'.1em',marginBottom:10}}>Fecha y hora</div>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:10}}>
                <div>
                  <div style={{fontSize:10,color:C.t3,marginBottom:4}}>Fecha *</div>
                  <input type="date" style={inp} value={form.fecha} onChange={e=>setF('fecha',e.target.value)} />
                </div>
                <div>
                  <div style={{fontSize:10,color:C.t3,marginBottom:4}}>Hora *</div>
                  <select style={inp} value={form.hora} onChange={e=>setF('hora',e.target.value)}>
                    {HORAS.map(h=><option key={h}>{h}</option>)}
                  </select>
                </div>
                <div>
                  <div style={{fontSize:10,color:C.t3,marginBottom:4}}>Duración</div>
                  <select style={inp} value={form.duracion} onChange={e=>setF('duracion',parseInt(e.target.value))}>
                    {[60,90,120,150,180].map(d=><option key={d} value={d}>{d}m</option>)}
                  </select>
                </div>
              </div>
            </div>

            {/* Mesa */}
            <div style={{marginBottom:14}}>
              <div style={{fontSize:10,color:C.pink,fontWeight:700,textTransform:'uppercase' as const,letterSpacing:'.1em',marginBottom:10}}>Mesa *</div>
              <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(64px,1fr))',gap:8}}>
                {mesas.filter(m=>!m.bloqueada&&m.estado==='libre').map(m=>(
                  <div key={m.id} onClick={()=>setF('mesa_id',m.id)}
                    style={{background:form.mesa_id===m.id?`${C.pink}20`:C.bg4,border:`2px solid ${form.mesa_id===m.id?C.pink:C.border}`,borderRadius:12,padding:'10px 6px',textAlign:'center' as const,cursor:'pointer',transition:'all .15s'}}>
                    <div style={{fontFamily:"'Syne',sans-serif",fontSize:18,fontWeight:900,color:form.mesa_id===m.id?C.pink:C.t1}}>{m.numero}</div>
                    <div style={{fontSize:9,color:C.t3}}>{m.capacidad}p</div>
                    <div style={{fontSize:9,color:ZONA_COLOR[m.zona]||C.t3}}>{m.zona.slice(0,4)}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Detalles */}
            <div style={{marginBottom:20}}>
              <div style={{fontSize:10,color:C.pink,fontWeight:700,textTransform:'uppercase' as const,letterSpacing:'.1em',marginBottom:10}}>Detalles</div>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10,marginBottom:10}}>
                <div>
                  <div style={{fontSize:10,color:C.t3,marginBottom:4}}>Ocasión</div>
                  <select style={inp} value={form.ocasion} onChange={e=>setF('ocasion',e.target.value)}>
                    <option value="">Sin ocasión</option>
                    {OCASIONES.map(o=><option key={o}>{o}</option>)}
                  </select>
                </div>
                <div>
                  <div style={{fontSize:10,color:C.t3,marginBottom:4}}>Origen</div>
                  <select style={inp} value={form.origen} onChange={e=>setF('origen',e.target.value)}>
                    {ORIGENES.map(o=><option key={o}>{o}</option>)}
                  </select>
                </div>
              </div>
              <textarea style={{...inp,minHeight:64,resize:'vertical' as const}} placeholder="Nota para el equipo..." value={form.nota} onChange={e=>setF('nota',e.target.value)} />
            </div>

            <button onClick={crearReserva} style={{width:'100%',padding:14,borderRadius:14,border:'none',background:`linear-gradient(135deg,${C.pink},${C.pinkD})`,color:'#fff',fontSize:15,fontWeight:900,cursor:'pointer',fontFamily:"'Syne',sans-serif",boxShadow:`0 4px 30px ${C.pinkG}`}}>
              ✓ Confirmar reserva
            </button>
          </div>
        </div>
      )}

      {/* Panel slide — detalle reserva */}
      {panelReserva && (
        <div style={{position:'fixed',inset:0,zIndex:600,display:'flex'}}>
          <div style={{flex:1,background:'rgba(0,0,0,0.6)',backdropFilter:'blur(4px)'}} onClick={()=>setPanelReserva(null)}/>
          <div style={{width:380,background:C.bg3,borderLeft:`1px solid ${C.border2}`,display:'flex',flexDirection:'column',animation:'slideIn .2s ease'}}>
            <style>{`@keyframes slideIn{from{transform:translateX(100%)}to{transform:translateX(0)}}`}</style>
            <div style={{padding:'20px 24px',borderBottom:`1px solid ${C.border}`}}>
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:12}}>
                <div>
                  <div style={{fontFamily:"'Syne',sans-serif",fontSize:20,fontWeight:900}}>{panelReserva.nombre_cliente}</div>
                  <div style={{fontSize:12,color:C.t3,marginTop:2,display:'flex',gap:8}}>
                    {panelReserva.vip_status && <span style={{color:C.gold}}>⭐ VIP</span>}
                    {panelReserva.total_visits ? <span>{panelReserva.total_visits} visitas</span> : null}
                    {panelReserva.total_spent ? <span style={{color:C.gold}}>${Math.round(Number(panelReserva.total_spent)).toLocaleString('es-CO')}</span> : null}
                  </div>
                </div>
                <button onClick={()=>setPanelReserva(null)} style={{background:C.bg4,border:`1px solid ${C.border}`,color:C.t2,width:36,height:36,borderRadius:10,cursor:'pointer',fontSize:18}}>✕</button>
              </div>
              {/* Estado badge */}
              {(() => {
                const cfg = RES_CFG[panelReserva.estado] || RES_CFG.pendiente;
                return <span style={{background:`${cfg.c}15`,color:cfg.c,border:`1px solid ${cfg.c}30`,padding:'4px 14px',borderRadius:50,fontSize:11,fontWeight:700}}>{cfg.icon} {cfg.label}</span>;
              })()}
            </div>

            <div style={{flex:1,overflowY:'auto',padding:'20px 24px'}}>
              {/* Alergias CRM */}
              {panelReserva.alergias?.length && (
                <div style={{background:`${C.red}10`,border:`1px solid ${C.red}30`,borderRadius:12,padding:'10px 14px',marginBottom:14}}>
                  <div style={{fontSize:10,color:C.red,fontWeight:700,marginBottom:4}}>⚠️ ALERGIAS</div>
                  <div style={{fontSize:12,color:C.t2}}>{panelReserva.alergias.join(', ')}</div>
                </div>
              )}
              {panelReserva.preferencias?.length && (
                <div style={{background:`${C.green}08`,border:`1px solid ${C.green}20`,borderRadius:12,padding:'10px 14px',marginBottom:14}}>
                  <div style={{fontSize:10,color:C.green,fontWeight:700,marginBottom:4}}>✓ PREFERENCIAS</div>
                  <div style={{fontSize:12,color:C.t2}}>{panelReserva.preferencias.join(', ')}</div>
                </div>
              )}

              {/* Info grid */}
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8,marginBottom:16}}>
                {[
                  {l:'Mesa',    v:`#${panelReserva.mesa_numero} — ${panelReserva.mesa_zona}`},
                  {l:'Personas', v:`${panelReserva.pax} pax`},
                  {l:'Fecha',   v:fmtFecha(panelReserva.fecha)},
                  {l:'Hora',    v:fmtHora(panelReserva.hora)},
                  {l:'Duración',v:`${panelReserva.duracion_min||90} min`},
                  {l:'Origen',  v:panelReserva.origen||'—'},
                ].map(x=>(
                  <div key={x.l} style={{background:C.bg4,borderRadius:10,padding:'10px 12px'}}>
                    <div style={{fontSize:9,color:C.t3,marginBottom:3,textTransform:'uppercase' as const,letterSpacing:'.06em'}}>{x.l}</div>
                    <div style={{fontSize:13,fontWeight:600}}>{x.v}</div>
                  </div>
                ))}
              </div>

              {panelReserva.ocasion && (
                <div style={{background:`${C.purple}12`,border:`1px solid ${C.purple}25`,borderRadius:10,padding:'8px 14px',marginBottom:10,fontSize:12,color:C.purple}}>🎉 {panelReserva.ocasion}</div>
              )}
              {panelReserva.nota && (
                <div style={{background:C.bg4,borderRadius:10,padding:'8px 14px',marginBottom:14,fontSize:12,color:C.t2}}>📝 {panelReserva.nota}</div>
              )}

              {/* Contacto */}
              <div style={{display:'flex',gap:8,marginBottom:16}}>
                {panelReserva.telefono && (
                  <a href={`https://wa.me/${panelReserva.telefono.replace(/\D/g,'')}`} target="_blank"
                    style={{flex:1,padding:10,borderRadius:10,background:'#25D36615',border:'1px solid #25D36640',color:'#25D366',fontSize:11,fontWeight:700,textAlign:'center' as const,textDecoration:'none',display:'block'}}>
                    💬 WhatsApp
                  </a>
                )}
                {panelReserva.telefono && (
                  <a href={`tel:${panelReserva.telefono}`}
                    style={{flex:1,padding:10,borderRadius:10,background:`${C.blue}15`,border:`1px solid ${C.blue}40`,color:C.blue,fontSize:11,fontWeight:700,textAlign:'center' as const,textDecoration:'none',display:'block'}}>
                    📞 Llamar
                  </a>
                )}
              </div>

              {/* Cambiar estado */}
              <div style={{fontSize:10,color:C.t3,fontWeight:700,textTransform:'uppercase' as const,letterSpacing:'.08em',marginBottom:8}}>Cambiar estado</div>
              <div style={{display:'flex',gap:6,flexWrap:'wrap'}}>
                {(['confirmada','llegó','cancelada','no_show'] as const).map(e=>{
                  const cfg = RES_CFG[e];
                  const active = panelReserva.estado === e;
                  return (
                    <button key={e} onClick={()=>cambiarEstado(panelReserva.id,e,panelReserva.mesa_id)}
                      style={{padding:'7px 16px',borderRadius:50,border:`1px solid ${active?cfg.c:C.border}`,background:active?`${cfg.c}20`:'transparent',color:active?cfg.c:C.t3,fontSize:11,fontWeight:700,cursor:'pointer',transition:'all .15s'}}>
                      {cfg.icon} {cfg.label}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── HEADER ── */}
      <div style={{padding:'14px 24px',display:'flex',alignItems:'center',justifyContent:'space-between',flexShrink:0,borderBottom:`1px solid ${C.border}`,background:C.bg2}}>
        <div style={{display:'flex',alignItems:'center',gap:14}}>
          <div style={{width:38,height:38,borderRadius:12,background:`linear-gradient(135deg,${C.pink},#ff6b9d)`,display:'flex',alignItems:'center',justifyContent:'center',fontSize:18,boxShadow:`0 0 20px ${C.pinkG}`}}>📅</div>
          <div>
            <div style={{fontFamily:"'Syne',sans-serif",fontSize:16,fontWeight:900,letterSpacing:'-0.02em'}}>RESERVE</div>
            <div style={{fontSize:10,color:C.t3,letterSpacing:'.1em',textTransform:'uppercase' as const}}>OMM · Seratta</div>
          </div>
        </div>

        {/* Navegación semanal */}
        <div style={{display:'flex',alignItems:'center',gap:2,background:C.bg3,border:`1px solid ${C.border}`,borderRadius:14,padding:'4px 6px'}}>
          <button onClick={()=>{const d=new Date(fecha+'T12:00:00');d.setDate(d.getDate()-1);setFecha(d.toISOString().split('T')[0]);}}
            style={{background:'none',border:'none',color:C.t3,cursor:'pointer',fontSize:16,padding:'4px 8px',borderRadius:8}}>‹</button>
          {diasSemana().map(d=>(
            <button key={d.iso} onClick={()=>setFecha(d.iso)}
              style={{display:'flex',flexDirection:'column',alignItems:'center',padding:'6px 10px',borderRadius:10,border:`1px solid ${fecha===d.iso?C.pink:'transparent'}`,background:fecha===d.iso?`${C.pink}20`:'transparent',cursor:'pointer',transition:'all .15s',minWidth:40}}>
              <span style={{fontSize:9,color:d.esHoy?C.pink:C.t3,fontWeight:700,textTransform:'uppercase' as const}}>{d.dia}</span>
              <span style={{fontFamily:"'Syne',sans-serif",fontSize:14,fontWeight:900,color:fecha===d.iso?C.pink:C.t1}}>{d.num}</span>
            </button>
          ))}
          <button onClick={()=>{const d=new Date(fecha+'T12:00:00');d.setDate(d.getDate()+1);setFecha(d.toISOString().split('T')[0]);}}
            style={{background:'none',border:'none',color:C.t3,cursor:'pointer',fontSize:16,padding:'4px 8px',borderRadius:8}}>›</button>
        </div>

        <div style={{display:'flex',gap:8,alignItems:'center'}}>
          {/* Buscador */}
          <div style={{position:'relative'}}>
            <input placeholder="🔍 Buscar reserva..." value={busqueda} onChange={e=>setBusqueda(e.target.value)}
              style={{...inp,width:220,padding:'8px 14px',fontSize:12,background:C.bg3}} />
            {busqueda && <button onClick={()=>setBusqueda('')} style={{position:'absolute',right:10,top:'50%',transform:'translateY(-50%)',background:'none',border:'none',color:C.t3,cursor:'pointer'}}>✕</button>}
          </div>
          <button onClick={()=>setModalNueva(true)}
            style={{padding:'9px 20px',borderRadius:12,border:'none',background:`linear-gradient(135deg,${C.pink},${C.pinkD})`,color:'#fff',fontSize:12,fontWeight:800,cursor:'pointer',whiteSpace:'nowrap',boxShadow:`0 4px 20px ${C.pinkG}`,fontFamily:"'Syne',sans-serif"}}>
            + Nueva
          </button>
        </div>
      </div>

      {/* ── KPIs ── */}
      <div style={{display:'flex',gap:0,padding:'0',flexShrink:0,borderBottom:`1px solid ${C.border}`,background:C.bg2}}>
        {kpis.map((k,i)=>(
          <div key={k.l} style={{flex:1,padding:'12px 20px',borderRight:i<kpis.length-1?`1px solid ${C.border}`:'none'}}>
            <div style={{fontSize:9,color:C.t3,fontWeight:700,textTransform:'uppercase' as const,letterSpacing:'.1em',marginBottom:4}}>{k.l}</div>
            <div style={{fontFamily:"'Syne',sans-serif",fontSize:22,fontWeight:900,color:k.c}}>{k.v}</div>
          </div>
        ))}
      </div>

      {/* ── TABS ── */}
      <div style={{display:'flex',gap:0,borderBottom:`1px solid ${C.border}`,flexShrink:0,background:C.bg2,padding:'0 24px'}}>
        {([
          {id:'mapa',     l:'Mapa de mesas'},
          {id:'lista',    l:`Reservas (${busqueda?resFiltradas.length:resHoy.length})`},
          {id:'timeline', l:'Timeline'},
        ] as const).map(t=>(
          <button key={t.id} onClick={()=>setVistaTab(t.id)}
            style={{padding:'12px 20px',background:'none',border:'none',borderBottom:`2px solid ${vistaTab===t.id?C.pink:'transparent'}`,color:vistaTab===t.id?C.pink:C.t3,fontSize:12,fontWeight:700,cursor:'pointer',whiteSpace:'nowrap',transition:'all .15s',letterSpacing:'.04em'}}>
            {t.l}
          </button>
        ))}
        {/* Zona filtro */}
        <div style={{marginLeft:'auto',display:'flex',gap:6,alignItems:'center',paddingBottom:4}}>
          {zonas.map(z=>(
            <button key={z} onClick={()=>setZonaFiltro(z)}
              style={{padding:'4px 14px',borderRadius:50,border:`1px solid ${zonaFiltro===z?(ZONA_COLOR[z]||C.pink):C.border}`,background:zonaFiltro===z?`${ZONA_COLOR[z]||C.pink}15`:'transparent',color:zonaFiltro===z?(ZONA_COLOR[z]||C.pink):C.t3,fontSize:10,fontWeight:700,cursor:'pointer',transition:'all .15s'}}>
              {z}
            </button>
          ))}
        </div>
      </div>

      {/* ── CONTENIDO ── */}
      <div style={{flex:1,overflow:'hidden',position:'relative'}}>

        {/* MAPA */}
        {vistaTab==='mapa' && (
          <div style={{height:'100%',overflowY:'auto',padding:20}}>
            {Array.from(new Set(mesasFiltradas.map(m=>m.zona))).map(zona=>{
              const mesasZona = mesasFiltradas.filter(m=>m.zona===zona);
              const zc = ZONA_COLOR[zona] || C.t2;
              return (
                <div key={zona} style={{marginBottom:28}}>
                  {/* Zona header */}
                  <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:14}}>
                    <div style={{width:6,height:6,borderRadius:'50%',background:zc}}/>
                    <span style={{fontSize:11,fontWeight:700,color:zc,textTransform:'uppercase' as const,letterSpacing:'.12em'}}>{zona}</span>
                    <div style={{flex:1,height:1,background:`linear-gradient(90deg,${zc}30,transparent)`}}/>
                    <span style={{fontSize:10,color:C.t3}}>{mesasZona.length} mesas</span>
                  </div>
                  <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(150px,1fr))',gap:12}}>
                    {mesasZona.map(mesa=>{
                      const efectivo = mesa.bloqueada ? 'bloqueada' : mesa.estado;
                      const cfg = ESTADO_CFG[efectivo as keyof typeof ESTADO_CFG] || ESTADO_CFG.libre;
                      const resaMesa = resHoy.find(r=>r.mesa_id===mesa.id&&['confirmada','pendiente'].includes(r.estado));
                      const ocuMesa  = resHoy.find(r=>r.mesa_id===mesa.id&&r.estado==='llegó');
                      return (
                        <div key={mesa.id}
                          onClick={()=>{ if (resaMesa) setPanelReserva(resaMesa); else if(ocuMesa) setPanelReserva(ocuMesa); else setPanelMesa(mesa); }}
                          style={{background:C.bg3,border:`1.5px solid ${cfg.c}30`,borderRadius:18,padding:16,cursor:'pointer',transition:'all .2s',position:'relative',overflow:'hidden'}}
                          onMouseEnter={e=>{ (e.currentTarget as HTMLDivElement).style.borderColor=cfg.c; (e.currentTarget as HTMLDivElement).style.boxShadow=`0 0 20px ${cfg.c}15`; }}
                          onMouseLeave={e=>{ (e.currentTarget as HTMLDivElement).style.borderColor=`${cfg.c}30`; (e.currentTarget as HTMLDivElement).style.boxShadow='none'; }}>

                          {/* Glow dot estado */}
                          <div style={{position:'absolute',top:12,right:12,width:8,height:8,borderRadius:'50%',background:cfg.c,boxShadow:`0 0 8px ${cfg.c}`}}/>

                          <div style={{fontFamily:"'Syne',sans-serif",fontSize:28,fontWeight:900,color:C.t1,marginBottom:2}}>{mesa.numero}</div>
                          <div style={{fontSize:10,color:cfg.c,fontWeight:700,marginBottom:6}}>{cfg.label.toUpperCase()}</div>
                          <div style={{fontSize:10,color:C.t3,marginBottom:resaMesa?8:0}}>👥 {mesa.capacidad} · {zona}</div>

                          {resaMesa && (
                            <div style={{background:`${C.pink}10`,border:`1px solid ${C.pink}20`,borderRadius:8,padding:'6px 8px',marginTop:6}}>
                              <div style={{fontSize:11,fontWeight:700,color:C.pink,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{resaMesa.nombre_cliente.split(' ')[0]}</div>
                              <div style={{fontSize:10,color:C.t3}}>{fmtHora(resaMesa.hora)} · {resaMesa.pax}p</div>
                            </div>
                          )}

                          {mesa.bloqueada && (
                            <div style={{fontSize:10,color:C.t3,marginTop:4}}>🔒 {mesa.bloqueo_motivo||'Bloqueada'}</div>
                          )}

                          {/* Acciones hover */}
                          <div style={{display:'flex',gap:6,marginTop:10}}>
                            {mesa.estado==='libre'&&!mesa.bloqueada && (
                              <button onClick={e=>{e.stopPropagation();setF('mesa_id',mesa.id);setModalNueva(true);}}
                                style={{flex:1,padding:'5px',borderRadius:8,border:`1px solid ${C.pink}40`,background:`${C.pink}10`,color:C.pink,fontSize:9,fontWeight:700,cursor:'pointer'}}>
                                + Reservar
                              </button>
                            )}
                            {!mesa.bloqueada
                              ? <button onClick={e=>{e.stopPropagation();setModalBloqueo(mesa);}}
                                  style={{padding:'5px 8px',borderRadius:8,border:`1px solid ${C.red}30`,background:`${C.red}08`,color:C.red,fontSize:10,cursor:'pointer'}}>🔒</button>
                              : <button onClick={e=>{e.stopPropagation();desbloquearMesa(mesa);}}
                                  style={{padding:'5px 8px',borderRadius:8,border:`1px solid ${C.green}30`,background:`${C.green}08`,color:C.green,fontSize:10,cursor:'pointer'}}>🔓</button>
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

        {/* LISTA */}
        {vistaTab==='lista' && (
          <div style={{height:'100%',overflowY:'auto',padding:20}}>
            {busqueda && <div style={{fontSize:11,color:C.t3,marginBottom:12}}>{resFiltradas.length} resultado{resFiltradas.length!==1?'s':''} para "{busqueda}"</div>}
            {resFiltradas.length===0 && (
              <div style={{textAlign:'center',padding:60,color:C.t3}}>
                <div style={{fontSize:40,marginBottom:12}}>📅</div>
                <div style={{fontSize:15,fontWeight:700}}>{busqueda?'Sin resultados':'Sin reservas para este día'}</div>
              </div>
            )}
            <div style={{display:'flex',flexDirection:'column',gap:8}}>
              {resFiltradas.map(r=>{
                const cfg = RES_CFG[r.estado] || RES_CFG.pendiente;
                return (
                  <div key={r.id} onClick={()=>setPanelReserva(r)}
                    style={{background:C.bg3,border:`1px solid ${r.estado==='llegó'?C.green+'30':C.border}`,borderRadius:16,padding:'14px 18px',cursor:'pointer',display:'flex',alignItems:'center',gap:14,transition:'all .15s'}}
                    onMouseEnter={e=>(e.currentTarget as HTMLDivElement).style.borderColor=`${C.pink}40`}
                    onMouseLeave={e=>(e.currentTarget as HTMLDivElement).style.borderColor=r.estado==='llegó'?`${C.green}30`:C.border}>

                    {/* Hora */}
                    <div style={{textAlign:'center',minWidth:52,flexShrink:0}}>
                      <div style={{fontFamily:"'Syne',sans-serif",fontSize:16,fontWeight:900,color:C.gold}}>{fmtHora(r.hora)}</div>
                      <div style={{fontSize:9,color:C.t3}}>{r.duracion_min||90}m</div>
                    </div>

                    {/* Mesa badge */}
                    <div style={{width:40,height:40,borderRadius:10,background:C.bg4,border:`1px solid ${C.border2}`,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',flexShrink:0}}>
                      <div style={{fontSize:9,color:C.t3}}>M</div>
                      <div style={{fontFamily:"'Syne',sans-serif",fontSize:15,fontWeight:900}}>{r.mesa_numero}</div>
                    </div>

                    {/* Info */}
                    <div style={{flex:1,minWidth:0}}>
                      <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:3}}>
                        <span style={{fontSize:14,fontWeight:700,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{r.nombre_cliente}</span>
                        {r.vip_status && <span style={{fontSize:10,color:C.gold,flexShrink:0}}>⭐</span>}
                        {r.ocasion && <span style={{fontSize:10,background:`${C.purple}15`,color:C.purple,padding:'1px 8px',borderRadius:50,flexShrink:0}}>{r.ocasion}</span>}
                        {r.alergias?.length && <span style={{fontSize:10,background:`${C.red}15`,color:C.red,padding:'1px 8px',borderRadius:50,flexShrink:0}}>⚠️</span>}
                      </div>
                      <div style={{fontSize:11,color:C.t3}}>
                        {r.pax}p · {r.mesa_zona} · {r.origen||'—'}
                        {r.total_visits ? ` · ${r.total_visits} visitas` : ''}
                      </div>
                    </div>

                    {/* Estado */}
                    <span style={{background:`${cfg.c}15`,color:cfg.c,border:`1px solid ${cfg.c}30`,padding:'5px 14px',borderRadius:50,fontSize:11,fontWeight:700,flexShrink:0}}>
                      {cfg.icon} {cfg.label}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* TIMELINE */}
        {vistaTab==='timeline' && (
          <div style={{height:'100%',overflowY:'auto',padding:'20px 24px'}}>
            <div style={{fontSize:12,color:C.t3,marginBottom:20}}>{fmtFecha(fecha)}</div>
            {HORAS.map(hora=>{
              const rs = resHoy.filter(r=>fmtHora(r.hora)===hora);
              const isServicio = parseInt(hora) >= 19;
              return (
                <div key={hora} style={{display:'flex',gap:14,marginBottom:6,alignItems:'stretch'}}>
                  {/* Hora label */}
                  <div style={{minWidth:52,display:'flex',flexDirection:'column',alignItems:'flex-end',paddingTop:12}}>
                    <span style={{fontFamily:"'Syne',sans-serif",fontSize:13,fontWeight:700,color:isServicio?C.pink:C.t3}}>{hora}</span>
                  </div>
                  {/* Línea vertical */}
                  <div style={{display:'flex',flexDirection:'column',alignItems:'center',width:2}}>
                    <div style={{width:2,flex:1,background:`linear-gradient(180deg,${isServicio?C.pink:C.t3}40,transparent)`,minHeight:48,borderRadius:2}}/>
                  </div>
                  {/* Reservas */}
                  <div style={{flex:1,display:'flex',gap:8,flexWrap:'wrap',paddingTop:4,paddingBottom:10}}>
                    {rs.length > 0 ? rs.map(r=>{
                      const cfg = RES_CFG[r.estado]||RES_CFG.pendiente;
                      return (
                        <div key={r.id} onClick={()=>setPanelReserva(r)}
                          style={{background:`${cfg.c}10`,border:`1px solid ${cfg.c}30`,borderRadius:12,padding:'10px 16px',cursor:'pointer',minWidth:180,transition:'all .15s'}}
                          onMouseEnter={e=>(e.currentTarget as HTMLDivElement).style.borderColor=cfg.c}
                          onMouseLeave={e=>(e.currentTarget as HTMLDivElement).style.borderColor=`${cfg.c}30`}>
                          <div style={{fontSize:13,fontWeight:700}}>{r.nombre_cliente.split(' ')[0]}</div>
                          <div style={{fontSize:10,color:C.t3}}>Mesa {r.mesa_numero} · {r.pax}p · {cfg.label}</div>
                          {r.ocasion && <div style={{fontSize:10,color:C.purple,marginTop:3}}>🎉 {r.ocasion}</div>}
                        </div>
                      );
                    }) : (
                      <div style={{padding:'10px 16px',border:`1px dashed ${C.border}`,borderRadius:12,fontSize:11,color:C.t3}}>Disponible</div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
