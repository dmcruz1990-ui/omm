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
                      <div style={{display:'flex',gap:6',flexWrap:'wrap'}}>
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

      {/* ── MAPA ── */}
      {tab==='mapa' && (
        <div style={{flex:1,overflowY:'auto',padding:24}}>
          <div style={{marginBottom:16,display:'flex',gap:12,alignItems:'center'}}>
            <div style={{fontSize:13,color:S.t2}}>Mapa de mesas — <span style={{color:S.gold,fontWeight:700}}>{fmt(fechaFiltro)}</span></div>
            <div style={{display:'flex',gap:8}}>
              {[{c:S.green,l:'Libre'},{c:S.blue,l:'Reservada'},{c:S.red,l:'Ocupada'},{c:S.gold,l:'Sentada'}].map(s=>(
                <span key={s.l} style={{fontSize:10,display:'flex',alignItems:'center',gap:4}}><span style={{width:8,height:8,borderRadius:'50%',background:s.c,display:'inline-block'}}/>{s.l}</span>
              ))}
            </div>
          </div>

          {mesas.length===0 && (
            <div style={{textAlign:'center',padding:60,color:S.t3}}>
              <div style={{fontSize:40,marginBottom:12}}>🪑</div>
              <div>Las mesas se configuran en el módulo de ajustes</div>
            </div>
          )}

          {/* Grid de mesas */}
          <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(120px,1fr))',gap:12}}>
            {[1,2,3,4,5,6,7,8,9,10,11,12,13,14,15].map(num => {
              const reservaHoy = reservasHoy.find(r=>r.mesa_num===num);
              const colorMesa = reservaHoy?.estado==='sentada'?S.gold:reservaHoy?.estado==='confirmada'?S.blue:S.green;
              return (
                <div key={num} style={{background:S.bg2,border:`2px solid ${colorMesa}40`,borderRadius:14,padding:'16px 12px',textAlign:'center',cursor:'pointer',transition:'all .2s'}}
                  onMouseEnter={e=>(e.currentTarget as HTMLDivElement).style.borderColor=colorMesa}
                  onMouseLeave={e=>(e.currentTarget as HTMLDivElement).style.borderColor=`${colorMesa}40`}>
                  <div style={{fontFamily:"'Syne',sans-serif",fontSize:22,fontWeight:900,color:colorMesa}}>M{num}</div>
                  {reservaHoy ? (
                    <>
                      <div style={{fontSize:11,color:S.t2,marginTop:4,fontWeight:600,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{reservaHoy.cliente_nombre}</div>
                      <div style={{fontSize:10,color:colorMesa,fontWeight:700}}>{reservaHoy.hora} · {reservaHoy.pax}p</div>
                      <div style={{fontSize:9,color:colorMesa,marginTop:2}}>{(ESTADOS as any)[reservaHoy.estado]?.l}</div>
                    </>
                  ) : (
                    <div style={{fontSize:10,color:S.t3,marginTop:4}}>Libre</div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

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
                <div style={{display:'flex',gap:8'}}>
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
