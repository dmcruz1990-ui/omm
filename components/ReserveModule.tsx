import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase.ts';
import { useAuth } from '../contexts/AuthContext';

const S = {
  bg:'#08080f', bg2:'#0f0f1a', bg3:'#161624',
  border:'rgba(255,255,255,0.07)', border2:'rgba(255,255,255,0.12)',
  t1:'#fff', t2:'#A0A0B8', t3:'#50506A',
  gold:'#FFB547', green:'#00E676', red:'#FF5252',
  blue:'#448AFF', purple:'#B388FF', pink:'#FF2D78', cyan:'#22d3ee',
};

const fmt = (d:string) => new Date(d+'T00:00:00').toLocaleDateString('es-CO',{weekday:'short',day:'numeric',month:'short'});

interface Reserva {
  id:number; cliente_nombre:string; cliente_email?:string; cliente_telefono?:string;
  fecha:string; hora:string; pax:number; ocasion?:string; notas?:string;
  estado:string; mesa_num?:number; restaurante_nombre?:string; origen?:string;
}

interface Mesa {
  id:number; num:number; capacidad:number; zona:string; posicion_x:number;
  posicion_y:number; shape:string; status?:string; activa:boolean;
}

const ESTADOS = {
  pendiente:  {c:S.gold,   l:'⏳ Pendiente'},
  confirmada: {c:S.green,  l:'✓ Confirmada'},
  sentada:    {c:S.blue,   l:'🪑 Sentada'},
  completada: {c:S.purple, l:'✅ Completada'},
  cancelada:  {c:S.red,    l:'✗ Cancelada'},
  no_show:    {c:S.t3,     l:'👻 No show'},
};

const OCASIONES = ['Cumpleaños','Aniversario','Negocio','Primera cita','Graduación','Despedida','Celebración','Sin ocasión especial'];

export default function ReserveModule() {
  const { profile } = useAuth();
  const [tab, setTab]           = useState<'mapa'|'lista'|'nueva'>('lista');
  const [reservas, setReservas] = useState<Reserva[]>([]);
  const [mesas, setMesas]       = useState<Mesa[]>([]);
  const [loading, setLoading]   = useState(true);
  const [toast, setToast]       = useState('');
  const [fechaFiltro, setFechaFiltro] = useState(new Date().toISOString().split('T')[0]);
  const [selected, setSelected] = useState<Reserva|null>(null);
  const [saving, setSaving]     = useState(false);
  const [form, setForm]         = useState({
    cliente_nombre:'', cliente_email:'', cliente_telefono:'',
    fecha:new Date().toISOString().split('T')[0], hora:'20:00',
    pax:2, ocasion:'Sin ocasión especial', notas:'', mesa_num:0,
  });

  const show = (m:string) => { setToast(m); setTimeout(()=>setToast(''),3000); };
  const setF = (k:string,v:any) => setForm(p=>({...p,[k]:v}));

  const fetchData = useCallback(async () => {
    setLoading(true);
    const [rv, ms, ohyeah] = await Promise.all([
      supabase.from('reservations').select('*').eq('restaurante_id',6).gte('fecha',fechaFiltro).order('fecha').order('hora'),
      supabase.from('tables').select('*').eq('restaurante_id',6).order('num'),
      supabase.from('ohyeah_reservas').select('*').gte('fecha',fechaFiltro).eq('estado','confirmada').order('fecha').order('hora'),
    ]);
    const todas = [
      ...(rv.data||[]).map((r:any)=>({...r,origen:'nexum'})),
      ...(ohyeah.data||[]).map((r:any)=>({...r,origen:'ohyeah',id:r.id+100000})),
    ].sort((a,b)=>a.fecha.localeCompare(b.fecha)||a.hora.localeCompare(b.hora));
    setReservas(todas);
    if (ms.data) setMesas(ms.data as Mesa[]);
    setLoading(false);
  }, [fechaFiltro]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Suscripción Realtime a Oh Yeah reservas
  useEffect(() => {
    const ch = supabase.channel('reserve-live')
      .on('postgres_changes',{event:'INSERT',schema:'public',table:'ohyeah_reservas'},(p) => {
        show(`🦉 Nueva reserva Oh Yeah: ${(p.new as any).cliente_nombre}`);
        fetchData();
      }).subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [fetchData]);

  const guardar = async () => {
    if (!form.cliente_nombre) { show('⚠️ Nombre requerido'); return; }
    if (!form.fecha||!form.hora) { show('⚠️ Fecha y hora requeridas'); return; }
    setSaving(true);
    const payload = { ...form, restaurante_id:6, estado:'confirmada', mesa_num:form.mesa_num||null };
    if (selected?.id) {
      await supabase.from('reservations').update(payload).eq('id',selected.id);
      show('✓ Reserva actualizada');
    } else {
      await supabase.from('reservations').insert(payload);
      show('✓ Reserva creada');
    }
    setSaving(false); setTab('lista'); fetchData();
  };

  const cambiarEstado = async (id:number, estado:string, esOhYeah:boolean=false) => {
    const tabla = esOhYeah ? 'ohyeah_reservas' : 'reservations';
    const idReal = esOhYeah ? id-100000 : id;
    await supabase.from(tabla).update({estado}).eq('id',idReal);
    show(`✓ Estado actualizado: ${(ESTADOS as any)[estado]?.l||estado}`);
    fetchData();
  };

  const asignarMesa = async (reservaId:number, mesaNum:number) => {
    await supabase.from('reservations').update({mesa_num:mesaNum, estado:'sentada'}).eq('id',reservaId);
    show(`✓ Mesa ${mesaNum} asignada`);
    fetchData();
  };

  const hoy = new Date().toISOString().split('T')[0];
  const reservasHoy = reservas.filter(r=>r.fecha===hoy);
  const paxEsperados = reservasHoy.reduce((s,r)=>s+(r.pax||0),0);
  const ocupacion = mesas.length ? Math.round(reservasHoy.filter(r=>r.estado==='sentada').length/mesas.length*100) : 0;

  return (
    <div style={{height:'100%',display:'flex',flexDirection:'column',background:S.bg,color:S.t1,fontFamily:"'DM Sans',sans-serif",overflow:'hidden'}}>
      {toast && <div style={{position:'fixed',bottom:24,left:'50%',transform:'translateX(-50%)',background:'#1e1e2e',border:`1px solid ${S.pink}`,color:'#fff',padding:'10px 28px',borderRadius:50,fontSize:13,fontWeight:700,zIndex:9999}}>{toast}</div>}

      {/* Header */}
      <div style={{padding:'14px 24px',borderBottom:`1px solid ${S.border}`,background:S.bg2,display:'flex',alignItems:'center',gap:14,flexShrink:0,flexWrap:'wrap'}}>
        <div style={{display:'flex',alignItems:'center',gap:12}}>
          <div style={{width:44,height:44,borderRadius:13,background:`linear-gradient(135deg,${S.purple},${S.blue})`,display:'flex',alignItems:'center',justifyContent:'center',fontSize:22}}>📅</div>
          <div>
            <div style={{fontFamily:"'Syne',sans-serif",fontSize:16,fontWeight:900}}>RESERVE</div>
            <div style={{fontSize:10,color:S.t3,letterSpacing:'.1em',textTransform:'uppercase'}}>Mapa · Reservas · Oh Yeah</div>
          </div>
        </div>
        {/* KPIs */}
        {[
          {l:'Hoy',      v:`${reservasHoy.length} reservas`, c:S.blue},
          {l:'Pax esperados',v:`${paxEsperados} personas`, c:S.purple},
          {l:'Ocupación', v:`${ocupacion}%`, c:ocupacion>80?S.red:ocupacion>50?S.gold:S.green},
          {l:'Oh Yeah',   v:`${reservas.filter(r=>r.origen==='ohyeah').length}`, c:S.gold},
        ].map(k=>(
          <div key={k.l} style={{textAlign:'center',padding:'4px 14px',background:'rgba(255,255,255,0.04)',borderRadius:10}}>
            <div style={{fontSize:9,color:S.t3,textTransform:'uppercase'}}>{k.l}</div>
            <div style={{fontSize:14,fontWeight:700,color:k.c}}>{k.v}</div>
          </div>
        ))}
        <div style={{marginLeft:'auto',display:'flex',gap:8,alignItems:'center'}}>
          <input type="date" value={fechaFiltro} onChange={e=>setFechaFiltro(e.target.value)}
            style={{background:'rgba(255,255,255,0.05)',border:`1px solid ${S.border2}`,borderRadius:8,padding:'7px 12px',color:'#fff',fontSize:12,outline:'none'}}/>
          <button onClick={()=>{setSelected(null);setForm({cliente_nombre:'',cliente_email:'',cliente_telefono:'',fecha:hoy,hora:'20:00',pax:2,ocasion:'Sin ocasión especial',notas:'',mesa_num:0});setTab('nueva');}}
            style={{padding:'8px 20px',borderRadius:10,border:'none',background:`linear-gradient(135deg,${S.purple},${S.blue})`,color:'#fff',fontSize:12,fontWeight:700,cursor:'pointer'}}>
            + Nueva reserva
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div style={{display:'flex',borderBottom:`1px solid ${S.border}`,background:S.bg2,padding:'0 24px',flexShrink:0}}>
        {[{id:'lista',l:'📋 Lista'},{id:'mapa',l:'🗺️ Mapa de mesas'},{id:'nueva',l:'✦ Nueva / Editar'}].map(t=>(
          <button key={t.id} onClick={()=>setTab(t.id as any)}
            style={{padding:'11px 16px',background:'none',border:'none',borderBottom:`2px solid ${tab===t.id?S.purple:'transparent'}`,color:tab===t.id?S.purple:S.t3,fontSize:12,fontWeight:700,cursor:'pointer',whiteSpace:'nowrap',transition:'all .15s'}}>
            {t.l}
          </button>
        ))}
      </div>

      {/* ── LISTA ── */}
      {tab==='lista' && (
        <div style={{flex:1,overflowY:'auto'}}>
          {loading && <div style={{textAlign:'center',padding:40,color:S.t3}}>Cargando reservas...</div>}
          {!loading && reservas.length===0 && (
            <div style={{textAlign:'center',padding:60,color:S.t3}}>
              <div style={{fontSize:48,marginBottom:12}}>📅</div>
              <div>Sin reservas para esta fecha</div>
            </div>
          )}
          <table style={{width:'100%',borderCollapse:'collapse',fontSize:13}}>
            <thead>
              <tr style={{background:S.bg2,position:'sticky',top:0,zIndex:5}}>
                {['Cliente','Fecha · Hora','Pax','Ocasión','Mesa','Estado','Origen','Acciones'].map(h=>(
                  <th key={h} style={{padding:'9px 14px',textAlign:'left',fontSize:10,color:S.t3,fontWeight:700,textTransform:'uppercase',letterSpacing:'.06em',borderBottom:`1px solid ${S.border}`,whiteSpace:'nowrap'}}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {reservas.map((r,i)=>{
                const est = (ESTADOS as any)[r.estado]||{c:S.t3,l:r.estado};
                const esOhYeah = r.origen==='ohyeah';
                return (
                  <tr key={r.id} style={{background:i%2===0?S.bg:S.bg2,borderBottom:'1px solid rgba(255,255,255,0.03)'}}>
                    <td style={{padding:'10px 14px'}}>
                      <div style={{fontWeight:700,display:'flex',alignItems:'center',gap:6}}>
                        {r.cliente_nombre}
                        {esOhYeah && <span style={{fontSize:9,background:`${S.gold}20`,color:S.gold,padding:'1px 6px',borderRadius:10}}>🦉 Oh Yeah</span>}
                      </div>
                      <div style={{fontSize:10,color:S.t3}}>{r.cliente_email||''} {r.cliente_telefono?`· ${r.cliente_telefono}`:''}</div>
                    </td>
                    <td style={{padding:'10px 14px'}}>
                      <div style={{fontWeight:600}}>{fmt(r.fecha)}</div>
                      <div style={{fontSize:11,color:S.gold,fontWeight:700}}>{r.hora}</div>
                    </td>
                    <td style={{padding:'10px 14px',textAlign:'center'}}>
                      <span style={{fontFamily:"'Syne',sans-serif",fontSize:18,fontWeight:900,color:S.blue}}>{r.pax}</span>
                    </td>
                    <td style={{padding:'10px 14px'}}>
                      {r.ocasion&&r.ocasion!=='Sin ocasión especial' ? (
                        <span style={{fontSize:11,background:`${S.purple}15`,color:S.purple,padding:'2px 8px',borderRadius:20}}>{r.ocasion}</span>
                      ) : <span style={{color:S.t3,fontSize:11}}>—</span>}
                    </td>
                    <td style={{padding:'10px 14px'}}>
                      {r.mesa_num ? (
                        <span style={{fontSize:12,fontWeight:700,background:`${S.blue}15`,color:S.blue,padding:'3px 10px',borderRadius:20}}>M{r.mesa_num}</span>
                      ) : r.estado==='confirmada' ? (
                        <select onChange={e=>asignarMesa(r.id,Number(e.target.value))} defaultValue=""
                          style={{background:S.bg3,border:`1px solid ${S.border}`,borderRadius:6,padding:'4px 8px',color:S.t2,fontSize:11,cursor:'pointer'}}>
                          <option value="" disabled>Asignar...</option>
                          {mesas.filter(m=>m.activa).map(m=><option key={m.id} value={m.num}>Mesa {m.num} ({m.capacidad}p)</option>)}
                        </select>
                      ) : <span style={{color:S.t3,fontSize:11}}>—</span>}
                    </td>
                    <td style={{padding:'10px 14px'}}>
                      <span style={{fontSize:10,background:`${est.c}15`,color:est.c,border:`1px solid ${est.c}30`,padding:'3px 10px',borderRadius:50,fontWeight:700,whiteSpace:'nowrap'}}>{est.l}</span>
                    </td>
                    <td style={{padding:'10px 14px'}}>
                      <span style={{fontSize:10,color:S.t3}}>{r.origen==='ohyeah'?'🦉 Oh Yeah':'Nexum'}</span>
                    </td>
                    <td style={{padding:'10px 14px'}}>
                      <div style={{display:'flex',gap:6,flexWrap:'wrap'}}>
                        {r.estado==='pendiente'&&<button onClick={()=>cambiarEstado(r.id,'confirmada',esOhYeah)} style={{padding:'4px 10px',borderRadius:8,border:`1px solid ${S.green}40`,background:`${S.green}10`,color:S.green,fontSize:10,fontWeight:700,cursor:'pointer'}}>✓ Confirmar</button>}
                        {r.estado==='confirmada'&&<button onClick={()=>cambiarEstado(r.id,'sentada',esOhYeah)} style={{padding:'4px 10px',borderRadius:8,border:`1px solid ${S.blue}40`,background:`${S.blue}10`,color:S.blue,fontSize:10,fontWeight:700,cursor:'pointer'}}>🪑 Sentar</button>}
                        {r.estado==='sentada'&&<button onClick={()=>cambiarEstado(r.id,'completada',esOhYeah)} style={{padding:'4px 10px',borderRadius:8,border:`1px solid ${S.purple}40`,background:`${S.purple}10`,color:S.purple,fontSize:10,fontWeight:700,cursor:'pointer'}}>✅ Cerrar</button>}
                        {!['cancelada','completada'].includes(r.estado)&&<button onClick={()=>cambiarEstado(r.id,'cancelada',esOhYeah)} style={{padding:'4px 10px',borderRadius:8,border:`1px solid ${S.red}40`,background:'transparent',color:S.red,fontSize:10,cursor:'pointer'}}>✗</button>}
                        {!esOhYeah&&<button onClick={()=>{setSelected(r);setForm({...r,mesa_num:r.mesa_num||0});setTab('nueva');}} style={{padding:'4px 10px',borderRadius:8,border:`1px solid ${S.border}`,background:'transparent',color:S.t2,fontSize:10,cursor:'pointer'}}>✏️</button>}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* ── MAPA INTERACTIVO ── */}
      {tab==='mapa' && <MapaInteractivo reservasHoy={reservasHoy} fechaFiltro={fechaFiltro} onAsignarMesa={asignarMesa} onCambiarEstado={cambiarEstado} S={S} ESTADOS={ESTADOS} />}

      {/* ── NUEVA / EDITAR ── */}
      {tab==='nueva' && (
        <div style={{flex:1,overflowY:'auto',padding:24}}>
          <div style={{maxWidth:680,margin:'0 auto'}}>
            <div style={{fontFamily:"'Syne',sans-serif",fontSize:16,fontWeight:900,marginBottom:20}}>{selected?'Editar reserva':'Nueva reserva'}</div>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:14}}>
              <div style={{gridColumn:'1/-1'}}>
                <div style={{fontSize:10,color:S.t3,fontWeight:700,marginBottom:5}}>NOMBRE DEL CLIENTE *</div>
                <input style={{background:'rgba(255,255,255,0.05)',border:`1px solid ${S.border2}`,borderRadius:10,padding:'10px 14px',color:'#fff',fontSize:13,outline:'none',width:'100%'}} value={form.cliente_nombre} onChange={e=>setF('cliente_nombre',e.target.value)} placeholder="Nombre completo"/>
              </div>
              <div>
                <div style={{fontSize:10,color:S.t3,fontWeight:700,marginBottom:5}}>EMAIL</div>
                <input style={{background:'rgba(255,255,255,0.05)',border:`1px solid ${S.border2}`,borderRadius:10,padding:'10px 14px',color:'#fff',fontSize:13,outline:'none',width:'100%'}} value={form.cliente_email} onChange={e=>setF('cliente_email',e.target.value)} placeholder="correo@email.com"/>
              </div>
              <div>
                <div style={{fontSize:10,color:S.t3,fontWeight:700,marginBottom:5}}>TELÉFONO</div>
                <input style={{background:'rgba(255,255,255,0.05)',border:`1px solid ${S.border2}`,borderRadius:10,padding:'10px 14px',color:'#fff',fontSize:13,outline:'none',width:'100%'}} value={form.cliente_telefono} onChange={e=>setF('cliente_telefono',e.target.value)} placeholder="+57 300 000 0000"/>
              </div>
              <div>
                <div style={{fontSize:10,color:S.t3,fontWeight:700,marginBottom:5}}>FECHA *</div>
                <input type="date" style={{background:'rgba(255,255,255,0.05)',border:`1px solid ${S.border2}`,borderRadius:10,padding:'10px 14px',color:'#fff',fontSize:13,outline:'none',width:'100%'}} value={form.fecha} onChange={e=>setF('fecha',e.target.value)}/>
              </div>
              <div>
                <div style={{fontSize:10,color:S.t3,fontWeight:700,marginBottom:5}}>HORA *</div>
                <input type="time" style={{background:'rgba(255,255,255,0.05)',border:`1px solid ${S.border2}`,borderRadius:10,padding:'10px 14px',color:'#fff',fontSize:13,outline:'none',width:'100%'}} value={form.hora} onChange={e=>setF('hora',e.target.value)}/>
              </div>
              <div>
                <div style={{fontSize:10,color:S.t3,fontWeight:700,marginBottom:5}}>PERSONAS</div>
                <div style={{display:'flex',gap:8}}>
                  {[1,2,3,4,5,6,7,8,10,12].map(n=>(
                    <button key={n} onClick={()=>setF('pax',n)} style={{flex:1,padding:'10px 4px',borderRadius:8,border:`1px solid ${form.pax===n?S.blue:S.border2}`,background:form.pax===n?`${S.blue}15`:'transparent',color:form.pax===n?S.blue:S.t3,fontSize:12,fontWeight:700,cursor:'pointer'}}>
                      {n}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <div style={{fontSize:10,color:S.t3,fontWeight:700,marginBottom:5}}>MESA ASIGNADA</div>
                <select style={{background:'rgba(255,255,255,0.05)',border:`1px solid ${S.border2}`,borderRadius:10,padding:'10px 14px',color:'#fff',fontSize:13,outline:'none',width:'100%'}} value={form.mesa_num} onChange={e=>setF('mesa_num',Number(e.target.value))}>
                  <option value={0}>Sin asignar aún</option>
                  {[1,2,3,4,5,6,7,8,9,10,11,12,13,14,15].map(n=><option key={n} value={n}>Mesa {n}</option>)}
                </select>
              </div>
              <div>
                <div style={{fontSize:10,color:S.t3,fontWeight:700,marginBottom:5}}>OCASIÓN</div>
                <select style={{background:'rgba(255,255,255,0.05)',border:`1px solid ${S.border2}`,borderRadius:10,padding:'10px 14px',color:'#fff',fontSize:13,outline:'none',width:'100%'}} value={form.ocasion} onChange={e=>setF('ocasion',e.target.value)}>
                  {OCASIONES.map(o=><option key={o}>{o}</option>)}
                </select>
              </div>
              <div style={{gridColumn:'1/-1'}}>
                <div style={{fontSize:10,color:S.t3,fontWeight:700,marginBottom:5}}>NOTAS INTERNAS</div>
                <textarea style={{background:'rgba(255,255,255,0.05)',border:`1px solid ${S.border2}`,borderRadius:10,padding:'10px 14px',color:'#fff',fontSize:13,outline:'none',width:'100%',height:70,resize:'vertical'}} value={form.notas} onChange={e=>setF('notas',e.target.value)} placeholder="Alergias, preferencias, solicitudes especiales..."/>
              </div>
            </div>
            <div style={{display:'flex',gap:10,marginTop:16}}>
              <button onClick={()=>setTab('lista')} style={{flex:1,padding:12,borderRadius:10,border:`1px solid ${S.border2}`,background:'transparent',color:S.t2,cursor:'pointer',fontSize:13}}>Cancelar</button>
              <button onClick={guardar} disabled={saving} style={{flex:2,padding:12,borderRadius:10,border:'none',background:saving?S.bg3:`linear-gradient(135deg,${S.purple},${S.blue})`,color:'#fff',cursor:'pointer',fontSize:13,fontWeight:700}}>
                {saving?'Guardando...':(selected?'✓ Actualizar':'✓ Crear reserva')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════
// MAPA INTERACTIVO DE MESAS — Planta real con zonas
// ══════════════════════════════════════════════════════════════════════

// Layout de planta — posición relativa en % del canvas
const PLANTA: Record<string, {
  num:number; zona:string; shape:'round'|'rect'; cap:number; x:number; y:number; w:number; h:number;
}> = {
  // ── TERRAZA (parte superior izquierda) ──────────────────────────────
  T1: { num:1,  zona:'Terraza', shape:'round', cap:2, x:5,  y:4,  w:8, h:8 },
  T2: { num:2,  zona:'Terraza', shape:'round', cap:2, x:15, y:4,  w:8, h:8 },
  T3: { num:3,  zona:'Terraza', shape:'rect',  cap:4, x:5,  y:15, w:12,h:8 },
  T4: { num:4,  zona:'Terraza', shape:'rect',  cap:6, x:20, y:15, w:14,h:8 },
  // ── SALÓN PRINCIPAL (centro) ─────────────────────────────────────────
  S5: { num:5,  zona:'Salón',   shape:'round', cap:4, x:40, y:5,  w:10,h:10 },
  S6: { num:6,  zona:'Salón',   shape:'round', cap:4, x:53, y:5,  w:10,h:10 },
  S7: { num:7,  zona:'Salón',   shape:'round', cap:4, x:66, y:5,  w:10,h:10 },
  S8: { num:8,  zona:'Salón',   shape:'rect',  cap:6, x:40, y:20, w:13,h:9 },
  S9: { num:9,  zona:'Salón',   shape:'rect',  cap:6, x:56, y:20, w:13,h:9 },
  S10:{ num:10, zona:'Salón',   shape:'round', cap:2, x:72, y:20, w:8, h:8 },
  S11:{ num:11, zona:'Salón',   shape:'rect',  cap:8, x:40, y:33, w:18,h:9 },
  S12:{ num:12, zona:'Salón',   shape:'round', cap:4, x:62, y:33, w:10,h:10},
  // ── PRIVADO (esquina derecha) ─────────────────────────────────────────
  P13:{ num:13, zona:'Privado', shape:'rect',  cap:8, x:76, y:33, w:17,h:9 },
  P14:{ num:14, zona:'Privado', shape:'rect',  cap:6, x:76, y:46, w:17,h:9 },
  // ── BARRA (parte inferior) ────────────────────────────────────────────
  B15:{ num:15, zona:'Barra',   shape:'rect',  cap:2, x:5,  y:56, w:25,h:6 },
  B16:{ num:16, zona:'Barra',   shape:'rect',  cap:2, x:5,  y:64, w:25,h:6 },
};

const ZONA_COLORES: Record<string,{bg:string;border:string;label:string}> = {
  Terraza: { bg:'rgba(34,211,238,0.04)', border:'rgba(34,211,238,0.15)', label:'🌿 Terraza' },
  Salón:   { bg:'rgba(255,255,255,0.02)', border:'rgba(255,255,255,0.07)', label:'🪑 Salón' },
  Privado: { bg:'rgba(179,136,255,0.04)', border:'rgba(179,136,255,0.15)', label:'🔒 Privado' },
  Barra:   { bg:'rgba(68,139,255,0.04)',  border:'rgba(68,139,255,0.15)',  label:'🍸 Barra'  },
};

const ZONA_AREAS: Record<string,{x:number;y:number;w:number;h:number}> = {
  Terraza: { x:2,  y:1,  w:36, h:28 },
  Salón:   { x:38, y:1,  w:40, h:46 },
  Privado: { x:74, y:30, w:22, h:29 },
  Barra:   { x:2,  y:52, w:34, h:22 },
};

function MapaInteractivo({ reservasHoy, fechaFiltro, onAsignarMesa, onCambiarEstado, S, ESTADOS }: any) {
  const [mesaSel, setMesaSel] = React.useState<any>(null);
  const [hoverId, setHoverId] = React.useState<string|null>(null);
  const [vistaZona, setVistaZona] = React.useState<string|null>(null);

  const fmt = (d:string) => new Date(d+'T00:00:00').toLocaleDateString('es-CO',{weekday:'short',day:'numeric',month:'short'});

  const getMesaColor = (num:number) => {
    const r = reservasHoy.find((rv:any)=>rv.mesa_num===num);
    if (!r) return { color:'#3dba6f', label:'Libre', reserva:null };
    const c = r.estado==='sentada'?'#FFB547':r.estado==='confirmada'?'#448AFF':r.estado==='completada'?'#606060':r.estado==='cancelada'?'#FF5252':'#FFB547';
    return { color:c, label:(ESTADOS as any)[r.estado]?.l||r.estado, reserva:r };
  };

  const mesasFiltradas = vistaZona
    ? Object.entries(PLANTA).filter(([,m])=>m.zona===vistaZona)
    : Object.entries(PLANTA);

  const stats = {
    total:   Object.keys(PLANTA).length,
    libres:  Object.values(PLANTA).filter(m=>!reservasHoy.find((r:any)=>r.mesa_num===m.num)).length,
    ocupadas:reservasHoy.filter((r:any)=>r.estado==='sentada').length,
    reservadas:reservasHoy.filter((r:any)=>r.estado==='confirmada').length,
  };

  return (
    <div style={{flex:1,display:'flex',flexDirection:'column',overflow:'hidden',background:S.bg}}>

      {/* Toolbar */}
      <div style={{padding:'10px 20px',borderBottom:`1px solid ${S.border}`,display:'flex',alignItems:'center',gap:12,flexShrink:0,flexWrap:'wrap',background:S.bg2}}>
        <div style={{fontSize:12,color:S.t2}}>
          Planta · <span style={{color:S.gold,fontWeight:700}}>{fmt(fechaFiltro)}</span>
        </div>

        {/* Stats rápidos */}
        <div style={{display:'flex',gap:8,marginLeft:8}}>
          {[
            {v:stats.libres,    l:'Libres',   c:'#3dba6f'},
            {v:stats.ocupadas,  l:'Sentadas', c:'#FFB547'},
            {v:stats.reservadas,l:'Reservadas',c:'#448AFF'},
          ].map(s=>(
            <span key={s.l} style={{fontSize:11,color:s.c,fontWeight:700,background:`${s.c}15`,padding:'2px 10px',borderRadius:20}}>
              {s.v} {s.l}
            </span>
          ))}
        </div>

        <div style={{marginLeft:'auto',display:'flex',gap:6}}>
          {/* Filtro por zona */}
          {['Todas',...Object.keys(ZONA_COLORES)].map(z=>(
            <button key={z} onClick={()=>setVistaZona(z==='Todas'?null:z)}
              style={{padding:'4px 12px',borderRadius:20,border:`1px solid ${vistaZona===(z==='Todas'?null:z)?'#d4943a':'rgba(255,255,255,0.1)'}`,background:vistaZona===(z==='Todas'?null:z)?'rgba(212,148,58,0.15)':'transparent',color:vistaZona===(z==='Todas'?null:z)?'#d4943a':'#606060',fontSize:10,fontWeight:700,cursor:'pointer',transition:'all .15s'}}>
              {z==='Todas'?'🗺️ Todas':ZONA_COLORES[z]?.label||z}
            </button>
          ))}
        </div>
      </div>

      <div style={{flex:1,overflow:'hidden',display:'flex',gap:0}}>

        {/* ── CANVAS DEL PLANO ── */}
        <div style={{flex:1,overflow:'auto',padding:16,position:'relative'}}>
          <div style={{
            position:'relative',
            width:'100%',
            paddingBottom:'75%', // ratio 4:3
            background:'#0a0a12',
            borderRadius:16,
            border:`1px solid rgba(255,255,255,0.06)`,
            overflow:'hidden',
          }}>
            <div style={{position:'absolute',inset:0}}>

              {/* Zonas de fondo */}
              {(vistaZona ? [[vistaZona, ZONA_AREAS[vistaZona]]] : Object.entries(ZONA_AREAS)).map(([zona, area]:any)=>(
                <div key={zona} style={{
                  position:'absolute',
                  left:`${area.x}%`, top:`${area.y}%`,
                  width:`${area.w}%`, height:`${area.h}%`,
                  background:ZONA_COLORES[zona]?.bg||'transparent',
                  border:`1px solid ${ZONA_COLORES[zona]?.border||'transparent'}`,
                  borderRadius:12,
                }}>
                  <div style={{position:'absolute',top:6,left:10,fontSize:9,color:'rgba(255,255,255,0.25)',fontWeight:700,textTransform:'uppercase',letterSpacing:'.1em',userSelect:'none'}}>
                    {ZONA_COLORES[zona]?.label||zona}
                  </div>
                </div>
              ))}

              {/* Mesas */}
              {mesasFiltradas.map(([key, mesa])=>{
                const { color, label, reserva } = getMesaColor(mesa.num);
                const isHovered = hoverId===key;
                const isSelected = mesaSel?.key===key;
                const libre = !reserva;

                return (
                  <div key={key}
                    style={{
                      position:'absolute',
                      left:`${mesa.x}%`, top:`${mesa.y}%`,
                      width:`${mesa.w}%`, height:`${mesa.h}%`,
                      borderRadius: mesa.shape==='round'?'50%':10,
                      background:`${color}${isSelected?'35':isHovered?'25':'15'}`,
                      border:`2px solid ${color}${isSelected?'':isHovered?'aa':'60'}`,
                      cursor:'pointer',
                      transition:'all .18s',
                      display:'flex',
                      flexDirection:'column',
                      alignItems:'center',
                      justifyContent:'center',
                      boxShadow: isSelected?`0 0 16px ${color}60`:isHovered?`0 0 8px ${color}40`:'none',
                      zIndex: isSelected||isHovered?2:1,
                    }}
                    onMouseEnter={()=>setHoverId(key)}
                    onMouseLeave={()=>setHoverId(null)}
                    onClick={()=>setMesaSel(mesaSel?.key===key?null:{key,...mesa,color,label,reserva})}
                  >
                    <div style={{fontFamily:"'Syne',sans-serif",fontSize:'clamp(8px,1.2vw,14px)',fontWeight:900,color,lineHeight:1}}>
                      M{mesa.num}
                    </div>
                    {mesa.shape!=='round' && (
                      <div style={{fontSize:'clamp(6px,0.8vw,9px)',color:`${color}aa`,marginTop:2}}>
                        {mesa.cap}p
                      </div>
                    )}
                    {/* Punto pulsante si ocupada */}
                    {reserva?.estado==='sentada' && (
                      <div style={{position:'absolute',top:3,right:3,width:6,height:6,borderRadius:'50%',background:'#FFB547',animation:'pulse 1.5s infinite'}}/>
                    )}
                  </div>
                );
              })}

              {/* ══ ELEMENTOS FIJOS — Cocina, Barra y Cava ══ */}

              {/* COCINA — parte inferior derecha */}
              <div style={{position:'absolute',left:'73%',top:'54%',width:'25%',height:'43%',background:'linear-gradient(135deg,rgba(255,82,82,0.08),rgba(255,82,82,0.03))',border:'1.5px solid rgba(255,82,82,0.3)',borderRadius:10,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',gap:4}}>
                <div style={{fontSize:'clamp(14px,2vw,24px)'}}>🔥</div>
                <div style={{fontSize:'clamp(7px,1vw,11px)',color:'rgba(255,82,82,0.8)',fontWeight:900,textTransform:'uppercase',letterSpacing:'.1em',textAlign:'center'}}>Cocina</div>
                {/* Ventanilla de despacho */}
                <div style={{position:'absolute',top:'-5%',left:'10%',width:'80%',height:'7%',background:'rgba(255,82,82,0.25)',borderRadius:'4px 4px 0 0',display:'flex',alignItems:'center',justifyContent:'center'}}>
                  <div style={{fontSize:'clamp(5px,0.65vw,8px)',color:'rgba(255,82,82,0.7)',fontWeight:700,letterSpacing:'.05em'}}>DESPACHO</div>
                </div>
              </div>

              {/* BARRA — banda inferior izquierda */}
              <div style={{position:'absolute',left:'2%',top:'76%',width:'68%',height:'12%',background:'linear-gradient(90deg,rgba(68,139,255,0.08),rgba(68,139,255,0.04))',border:'1.5px solid rgba(68,139,255,0.3)',borderRadius:10,display:'flex',alignItems:'center',padding:'0 2%',gap:'1.5%',overflow:'hidden'}}>
                {[0,1,2,3,4,5,6,7,8].map(i=>(
                  <div key={i} style={{width:'clamp(5px,1.2vw,14px)',height:'clamp(5px,1.2vw,14px)',borderRadius:'50%',background:'rgba(68,139,255,0.2)',border:'1px solid rgba(68,139,255,0.4)',flexShrink:0}}/>
                ))}
                <div style={{flex:1}}/>
                <div style={{fontSize:'clamp(8px,1.2vw,14px)'}}>🍸</div>
                <div style={{fontSize:'clamp(7px,0.9vw,11px)',color:'rgba(68,139,255,0.8)',fontWeight:900,textTransform:'uppercase',letterSpacing:'.08em',marginRight:4}}>Barra</div>
              </div>

              {/* CAVA — pequeño recuadro junto a la barra */}
              <div style={{position:'absolute',left:'36%',top:'76%',width:'33%',height:'10%',background:'linear-gradient(135deg,rgba(255,181,71,0.07),rgba(255,181,71,0.02))',border:'1.5px solid rgba(255,181,71,0.25)',borderRadius:8,display:'flex',alignItems:'center',justifyContent:'center',gap:6}}>
                <div style={{fontSize:'clamp(8px,1.2vw,14px)'}}>🍷</div>
                <div style={{fontSize:'clamp(6px,0.8vw,10px)',color:'rgba(255,181,71,0.7)',fontWeight:700,textTransform:'uppercase',letterSpacing:'.06em'}}>Cava</div>
              </div>

              {/* ENTRADA PRINCIPAL */}
              <div style={{position:'absolute',bottom:'1%',left:'40%',display:'flex',alignItems:'center',gap:4}}>
                <div style={{width:'clamp(18px,3vw,36px)',height:2,background:'rgba(255,255,255,0.12)',borderRadius:1}}/>
                <div style={{fontSize:'clamp(6px,0.75vw,9px)',color:'rgba(255,255,255,0.18)',fontWeight:700}}>↑ ENTRADA</div>
                <div style={{width:'clamp(18px,3vw,36px)',height:2,background:'rgba(255,255,255,0.12)',borderRadius:1}}/>
              </div>

              {/* Marca */}
              <div style={{position:'absolute',bottom:'1%',right:'2%',fontSize:'clamp(6px,0.75vw,9px)',color:'rgba(255,255,255,0.12)',fontWeight:700}}>OMM · Bogotá</div>
            </div>
          </div>
        </div>

        {/* ── PANEL LATERAL — detalle de la mesa seleccionada ── */}
        <div style={{width:260,borderLeft:`1px solid ${S.border}`,display:'flex',flexDirection:'column',flexShrink:0,background:S.bg2}}>

          {!mesaSel ? (
            <div style={{flex:1,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',padding:20,color:S.t3,textAlign:'center'}}>
              <div style={{fontSize:36,marginBottom:12}}>🗺️</div>
              <div style={{fontSize:12,fontWeight:700,marginBottom:6}}>Selecciona una mesa</div>
              <div style={{fontSize:11,lineHeight:1.6}}>Toca cualquier mesa en el plano para ver su estado y gestionar la reserva</div>
            </div>
          ) : (
            <div style={{flex:1,overflowY:'auto',padding:16}}>
              {/* Header mesa */}
              <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:14}}>
                <div style={{width:48,height:48,borderRadius:mesaSel.shape==='round'?'50%':12,background:`${mesaSel.color}20`,border:`2px solid ${mesaSel.color}`,display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
                  <span style={{fontFamily:"'Syne',sans-serif",fontSize:16,fontWeight:900,color:mesaSel.color}}>M{mesaSel.num}</span>
                </div>
                <div>
                  <div style={{fontSize:14,fontWeight:700}}>{mesaSel.zona}</div>
                  <div style={{fontSize:10,color:mesaSel.color,fontWeight:700}}>{mesaSel.label}</div>
                  <div style={{fontSize:10,color:S.t3}}>Capacidad: {mesaSel.cap} personas</div>
                </div>
              </div>

              {/* Sin reserva */}
              {!mesaSel.reserva ? (
                <div>
                  <div style={{padding:'12px 14px',background:`${S.bg3}`,border:`1px solid ${S.border}`,borderRadius:10,marginBottom:12}}>
                    <div style={{fontSize:11,color:'#3dba6f',fontWeight:700,marginBottom:4}}>✓ Mesa libre</div>
                    <div style={{fontSize:10,color:S.t3}}>Sin reserva para {fmt(fechaFiltro)}</div>
                  </div>
                  <button onClick={()=>setMesaSel(null)}
                    style={{width:'100%',padding:'10px',borderRadius:10,border:'none',background:`linear-gradient(135deg,${S.purple},${S.blue})`,color:'#fff',fontSize:12,fontWeight:700,cursor:'pointer'}}>
                    + Crear reserva aquí
                  </button>
                </div>
              ) : (
                <div>
                  {/* Info reserva */}
                  <div style={{background:S.bg3,border:`1px solid ${mesaSel.color}25`,borderRadius:10,padding:'12px 14px',marginBottom:12}}>
                    <div style={{fontSize:14,fontWeight:700,marginBottom:3}}>{mesaSel.reserva.cliente_nombre}</div>
                    <div style={{display:'flex',gap:10,flexWrap:'wrap',marginBottom:6}}>
                      <span style={{fontSize:11,color:S.gold,fontWeight:700}}>🕐 {mesaSel.reserva.hora}</span>
                      <span style={{fontSize:11,color:S.blue}}>👥 {mesaSel.reserva.pax}p</span>
                    </div>
                    {mesaSel.reserva.ocasion && mesaSel.reserva.ocasion!=='Sin ocasión especial' && (
                      <span style={{fontSize:10,background:`${S.purple}15`,color:S.purple,padding:'2px 8px',borderRadius:20}}>{mesaSel.reserva.ocasion}</span>
                    )}
                    {mesaSel.reserva.notas && (
                      <div style={{fontSize:10,color:S.t2,marginTop:6,fontStyle:'italic'}}>{mesaSel.reserva.notas}</div>
                    )}
                  </div>

                  {/* Acciones */}
                  <div style={{display:'flex',flexDirection:'column',gap:7}}>
                    {mesaSel.reserva.estado==='pendiente'&&(
                      <button onClick={()=>onCambiarEstado(mesaSel.reserva.id,'confirmada',mesaSel.reserva.origen==='ohyeah')}
                        style={{width:'100%',padding:'9px',borderRadius:9,border:`1px solid ${S.green}40`,background:`${S.green}10`,color:S.green,fontSize:12,fontWeight:700,cursor:'pointer'}}>
                        ✓ Confirmar
                      </button>
                    )}
                    {mesaSel.reserva.estado==='confirmada'&&(
                      <button onClick={()=>{onCambiarEstado(mesaSel.reserva.id,'sentada',mesaSel.reserva.origen==='ohyeah');setMesaSel(null);}}
                        style={{width:'100%',padding:'9px',borderRadius:9,border:`1px solid ${S.blue}40`,background:`${S.blue}10`,color:S.blue,fontSize:12,fontWeight:700,cursor:'pointer'}}>
                        🪑 Sentar ahora
                      </button>
                    )}
                    {mesaSel.reserva.estado==='sentada'&&(
                      <button onClick={()=>{onCambiarEstado(mesaSel.reserva.id,'completada',false);setMesaSel(null);}}
                        style={{width:'100%',padding:'9px',borderRadius:9,border:`1px solid ${S.purple}40`,background:`${S.purple}10`,color:S.purple,fontSize:12,fontWeight:700,cursor:'pointer'}}>
                        ✅ Cerrar mesa
                      </button>
                    )}
                    {!['cancelada','completada'].includes(mesaSel.reserva.estado)&&(
                      <button onClick={()=>{onCambiarEstado(mesaSel.reserva.id,'cancelada',false);setMesaSel(null);}}
                        style={{width:'100%',padding:'8px',borderRadius:9,border:`1px solid ${S.red}30`,background:'transparent',color:S.red,fontSize:11,cursor:'pointer'}}>
                        ✗ Cancelar reserva
                      </button>
                    )}
                  </div>
                </div>
              )}

              {/* Origen Oh Yeah */}
              {mesaSel.reserva?.origen==='ohyeah' && (
                <div style={{marginTop:12,padding:'8px 12px',background:`${S.gold}08`,border:`1px solid ${S.gold}20`,borderRadius:8,display:'flex',alignItems:'center',gap:6}}>
                  <span style={{fontSize:16}}>🦉</span>
                  <span style={{fontSize:10,color:S.gold}}>Reserva desde Oh Yeah</span>
                </div>
              )}
            </div>
          )}

          {/* Leyenda en el pie */}
          <div style={{padding:'10px 14px',borderTop:`1px solid ${S.border}`,display:'flex',flexWrap:'wrap',gap:8,flexShrink:0}}>
            {[
              {c:'#3dba6f',l:'Libre'},
              {c:'#448AFF',l:'Confirmada'},
              {c:'#FFB547',l:'Sentada'},
              {c:'#B388FF',l:'Completada'},
              {c:'#FF5252',l:'Cancelada'},
            ].map(s=>(
              <div key={s.l} style={{display:'flex',alignItems:'center',gap:4,fontSize:9,color:'#606060'}}>
                <span style={{width:6,height:6,borderRadius:'50%',background:s.c,display:'inline-block'}}/>
                {s.l}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
