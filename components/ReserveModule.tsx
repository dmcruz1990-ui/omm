import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase.ts';
import { useAuth } from '../contexts/AuthContext';

// ══ CONSTANTES DEL PLANO — globales para todos los componentes ══
const PLANTA: Record<string,{num:number;zona:string;shape:'round'|'rect';cap:number;x:number;y:number;w:number;h:number}> = {
  T1:{num:1,zona:'Terraza',shape:'round',cap:2,x:5,y:4,w:8,h:8},
  T2:{num:2,zona:'Terraza',shape:'round',cap:2,x:15,y:4,w:8,h:8},
  T3:{num:3,zona:'Terraza',shape:'rect',cap:4,x:5,y:15,w:12,h:8},
  T4:{num:4,zona:'Terraza',shape:'rect',cap:6,x:20,y:15,w:14,h:8},
  S5:{num:5,zona:'Salón',shape:'round',cap:4,x:40,y:5,w:10,h:10},
  S6:{num:6,zona:'Salón',shape:'round',cap:4,x:53,y:5,w:10,h:10},
  S7:{num:7,zona:'Salón',shape:'round',cap:4,x:66,y:5,w:10,h:10},
  S8:{num:8,zona:'Salón',shape:'rect',cap:6,x:40,y:20,w:13,h:9},
  S9:{num:9,zona:'Salón',shape:'rect',cap:6,x:56,y:20,w:13,h:9},
  S10:{num:10,zona:'Salón',shape:'round',cap:2,x:72,y:20,w:8,h:8},
  S11:{num:11,zona:'Salón',shape:'rect',cap:8,x:40,y:33,w:18,h:9},
  S12:{num:12,zona:'Salón',shape:'round',cap:4,x:62,y:33,w:10,h:10},
  P13:{num:13,zona:'Privado',shape:'rect',cap:8,x:76,y:33,w:17,h:9},
  P14:{num:14,zona:'Privado',shape:'rect',cap:6,x:76,y:46,w:17,h:9},
  B15:{num:15,zona:'Barra',shape:'rect',cap:2,x:5,y:56,w:25,h:6},
  B16:{num:16,zona:'Barra',shape:'rect',cap:2,x:5,y:64,w:25,h:6},
};
const ZONA_COLORES: Record<string,{bg:string;border:string;label:string}> = {
  Terraza:{bg:'rgba(34,211,238,0.04)',border:'rgba(34,211,238,0.15)',label:'🌿 Terraza'},
  Salón:  {bg:'rgba(255,255,255,0.02)',border:'rgba(255,255,255,0.07)',label:'🪑 Salón'},
  Privado:{bg:'rgba(179,136,255,0.04)',border:'rgba(179,136,255,0.15)',label:'🔒 Privado'},
  Barra:  {bg:'rgba(68,139,255,0.04)',border:'rgba(68,139,255,0.15)',label:'🍸 Barra'},
};
const ZONA_AREAS: Record<string,{x:number;y:number;w:number;h:number}> = {
  Terraza:{x:2,y:1,w:36,h:28},
  Salón:  {x:38,y:1,w:40,h:46},
  Privado:{x:74,y:30,w:22,h:29},
  Barra:  {x:2,y:52,w:34,h:22},
};

const S = {
  bg:'#08080f',bg2:'#0f0f1a',bg3:'#161624',
  border:'rgba(255,255,255,0.07)',border2:'rgba(255,255,255,0.12)',
  t1:'#fff',t2:'#A0A0B8',t3:'#50506A',
  gold:'#FFB547',green:'#00E676',red:'#FF5252',
  blue:'#448AFF',purple:'#B388FF',pink:'#FF2D78',cyan:'#22d3ee',
};
const fmt = (d:string) => new Date(d+'T00:00:00').toLocaleDateString('es-CO',{weekday:'short',day:'numeric',month:'short'});
const ESTADOS:any = {
  pendiente: {c:'#FFB547',l:'⏳ Pendiente'},
  confirmada:{c:'#00E676',l:'✓ Confirmada'},
  sentada:   {c:'#448AFF',l:'🪑 Sentada'},
  completada:{c:'#B388FF',l:'✅ Completada'},
  cancelada: {c:'#FF5252',l:'✗ Cancelada'},
  no_show:   {c:'#50506A',l:'👻 No show'},
};
const OCASIONES = ['Cumpleaños','Aniversario','Negocio','Primera cita','Graduación','Despedida','Celebración','Sin ocasión especial'];

type Tab = 'mapa'|'lista'|'nueva'|'editor';

interface Reserva {
  id:number;cliente_nombre:string;cliente_email?:string;cliente_telefono?:string;
  fecha:string;hora:string;pax:number;ocasion?:string;notas?:string;
  estado:string;mesa_num?:number;restaurante_nombre?:string;origen?:string;
}

export default function ReserveModule() {
  const { profile } = useAuth();
  const [tab, setTab]           = useState<Tab>('lista');
  const [reservas, setReservas] = useState<Reserva[]>([]);
  const [mesas, setMesas]       = useState<any[]>([]);
  const [loading, setLoading]   = useState(true);
  const [toast, setToast]       = useState('');
  const [fechaFiltro, setFechaFiltro] = useState(new Date().toISOString().split('T')[0]);
  const [selected, setSelected] = useState<Reserva|null>(null);
  const [saving, setSaving]     = useState(false);
  const [plantaDB, setPlantaDB] = useState<any[]>([]);
  const [editMesa, setEditMesa] = useState<any|null>(null);
  const [busquedaMesa, setBusquedaMesa] = useState('');
  const [now, setNow] = useState(Date.now());
  useEffect(()=>{ const t=setInterval(()=>setNow(Date.now()),30000); return ()=>clearInterval(t); },[]);
  const [form, setForm]         = useState({
    cliente_nombre:'',cliente_email:'',cliente_telefono:'',
    fecha:new Date().toISOString().split('T')[0],hora:'20:00',
    pax:2,ocasion:'Sin ocasión especial',notas:'',mesa_num:0,
  });

  const show = (m:string) => { setToast(m); setTimeout(()=>setToast(''),3000); };
  const setF = (k:string,v:any) => setForm(p=>({...p,[k]:v}));

  const fetchData = useCallback(async () => {
    setLoading(true);
    const { data: planta } = await supabase.from('planta_mesas').select('*').eq('restaurante_id',6).eq('activa',true).order('num');
    if (planta && planta.length > 0) setPlantaDB(planta);
    const [rv, ms, ohyeah] = await Promise.all([
      supabase.from('reservations').select('*').eq('restaurante_id',6).eq('fecha',fechaFiltro).order('hora'),
      supabase.from('tables').select('*').eq('restaurante_id',6).order('name'),
      supabase.from('ohyeah_reservas').select('*').gte('fecha',fechaFiltro).eq('estado','confirmada').order('fecha').order('hora'),
    ]);
    const todas = [
      ...(rv.data||[]).map((r:any)=>({...r,origen:'nexum'})),
      ...(ohyeah.data||[]).map((r:any)=>({...r,origen:'ohyeah',id:r.id+100000})),
    ].sort((a,b)=>a.fecha.localeCompare(b.fecha)||a.hora.localeCompare(b.hora));
    setReservas(todas);
    if (ms.data) setMesas(ms.data);
    setLoading(false);
  },[fechaFiltro]);

  useEffect(()=>{ fetchData(); },[fetchData]);

  useEffect(()=>{
    const ch = supabase.channel('reserve-live')
      .on('postgres_changes',{event:'INSERT',schema:'public',table:'ohyeah_reservas'},(p)=>{
        show(`🦉 Nueva reserva Oh Yeah: ${(p.new as any).cliente_nombre}`);
        fetchData();
      }).subscribe();
    return ()=>{ supabase.removeChannel(ch); };
  },[fetchData]);

  const guardar = async () => {
    if (!form.cliente_nombre) { show('⚠️ Nombre requerido'); return; }
    setSaving(true);
    const payload = {...form,restaurante_id:6,estado:'confirmada',mesa_num:form.mesa_num||null};
    if (selected?.id) {
      await supabase.from('reservations').update(payload).eq('id',selected.id);
      show('✓ Reserva actualizada');
    } else {
      await supabase.from('reservations').insert(payload);
      show('✓ Reserva creada');
    }
    setSaving(false); setTab('lista'); fetchData();
  };

  const cambiarEstado = async (id:number,estado:string,esOhYeah:boolean=false) => {
    const tabla = esOhYeah?'ohyeah_reservas':'reservations';
    const idReal = esOhYeah?id-100000:id;
    await supabase.from(tabla).update({estado}).eq('id',idReal);
    show(`✓ ${ESTADOS[estado]?.l||estado}`);
    fetchData();
  };

  const asignarMesa = async (reservaId:number,mesaNum:number) => {
    await supabase.from('reservations').update({mesa_num:mesaNum,estado:'sentada'}).eq('id',reservaId);
    show(`✓ Mesa ${mesaNum} asignada`);
    fetchData();
  };

  const hoy = new Date().toISOString().split('T')[0];
  const reservasHoy = reservas.filter(r=>r.fecha===hoy);
  const ocupacion = mesas.length?Math.round(reservasHoy.filter(r=>r.estado==='sentada').length/mesas.length*100):0;

  return (
    <div style={{height:'100%',display:'flex',flexDirection:'column',background:S.bg,color:S.t1,fontFamily:"'DM Sans',sans-serif",overflow:'hidden'}}>
      {toast&&<div style={{position:'fixed',bottom:24,left:'50%',transform:'translateX(-50%)',background:'#1e1e2e',border:`1px solid ${S.pink}`,color:'#fff',padding:'10px 28px',borderRadius:50,fontSize:13,fontWeight:700,zIndex:9999}}>{toast}</div>}

      {/* Header */}
      <div style={{padding:'14px 24px',borderBottom:`1px solid ${S.border}`,background:S.bg2,display:'flex',alignItems:'center',gap:14,flexShrink:0,flexWrap:'wrap'}}>
        <div style={{display:'flex',alignItems:'center',gap:12}}>
          <div style={{width:44,height:44,borderRadius:13,background:`linear-gradient(135deg,${S.purple},${S.blue})`,display:'flex',alignItems:'center',justifyContent:'center',fontSize:22}}>📅</div>
          <div>
            <div style={{fontFamily:"'Syne',sans-serif",fontSize:16,fontWeight:900}}>RESERVE</div>
            <div style={{fontSize:10,color:S.t3,letterSpacing:'.1em',textTransform:'uppercase'}}>Mapa · Reservas · Oh Yeah</div>
          </div>
        </div>
        {[
          {l:'Hoy',v:`${reservasHoy.length} reservas`,c:S.blue},
          {l:'Pax',v:`${reservasHoy.reduce((s,r)=>s+(r.pax||0),0)}p`,c:S.purple},
          {l:'Ocupación',v:`${ocupacion}%`,c:ocupacion>80?S.red:ocupacion>50?S.gold:S.green},
          {l:'Oh Yeah',v:`${reservas.filter(r=>r.origen==='ohyeah').length}`,c:S.gold},
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
        {([
          {id:'lista',l:'📋 Lista'},
          {id:'mapa',l:'🗺️ Mapa de mesas'},
          {id:'editor',l:'⚙️ Editor de planta'},
          {id:'nueva',l:'✦ Nueva / Editar'},
        ] as const).map(t=>(
          <button key={t.id} onClick={()=>setTab(t.id)}
            style={{padding:'11px 16px',background:'none',border:'none',borderBottom:`2px solid ${tab===t.id?S.purple:'transparent'}`,color:tab===t.id?S.purple:S.t3,fontSize:12,fontWeight:700,cursor:'pointer',whiteSpace:'nowrap',transition:'all .15s'}}>
            {t.l}
          </button>
        ))}
      </div>

      {/* ── LISTA ── */}
      {tab==='lista' && (
        <div style={{flex:1,overflowY:'auto'}}>
          {loading&&<div style={{textAlign:'center',padding:40,color:S.t3}}>Cargando...</div>}
          {!loading&&reservas.length===0&&<div style={{textAlign:'center',padding:60,color:S.t3}}><div style={{fontSize:48,marginBottom:12}}>📅</div><div>Sin reservas para esta fecha</div></div>}
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
                const est = ESTADOS[r.estado]||{c:S.t3,l:r.estado};
                const esOhYeah = r.origen==='ohyeah';
                return (
                  <tr key={r.id} style={{background:i%2===0?S.bg:S.bg2,borderBottom:'1px solid rgba(255,255,255,0.03)'}}>
                    <td style={{padding:'10px 14px'}}>
                      <div style={{fontWeight:700,display:'flex',alignItems:'center',gap:6}}>
                        {r.cliente_nombre}
                        {esOhYeah&&<span style={{fontSize:9,background:`${S.gold}20`,color:S.gold,padding:'1px 6px',borderRadius:10}}>🦉</span>}
                      </div>
                      <div style={{fontSize:10,color:S.t3}}>{r.cliente_email||''}</div>
                    </td>
                    <td style={{padding:'10px 14px'}}>
                      <div style={{fontWeight:600}}>{fmt(r.fecha)}</div>
                      <div style={{fontSize:11,color:S.gold,fontWeight:700}}>{r.hora}</div>
                    </td>
                    <td style={{padding:'10px 14px',textAlign:'center'}}>
                      <span style={{fontFamily:"'Syne',sans-serif",fontSize:18,fontWeight:900,color:S.blue}}>{r.pax}</span>
                    </td>
                    <td style={{padding:'10px 14px'}}>
                      {r.ocasion&&r.ocasion!=='Sin ocasión especial'?<span style={{fontSize:11,background:`${S.purple}15`,color:S.purple,padding:'2px 8px',borderRadius:20}}>{r.ocasion}</span>:<span style={{color:S.t3,fontSize:11}}>—</span>}
                    </td>
                    <td style={{padding:'10px 14px'}}>
                      {r.mesa_num?<span style={{fontSize:12,fontWeight:700,background:`${S.blue}15`,color:S.blue,padding:'3px 10px',borderRadius:20}}>M{r.mesa_num}</span>:
                        r.estado==='confirmada'?(
                          <select onChange={e=>asignarMesa(r.id,Number(e.target.value))} defaultValue=""
                            style={{background:S.bg3,border:`1px solid ${S.border}`,borderRadius:6,padding:'4px 8px',color:S.t2,fontSize:11,cursor:'pointer'}}>
                            <option value="" disabled>Asignar...</option>
                            {[...Array(16)].map((_,n)=><option key={n+1} value={n+1}>Mesa {n+1}</option>)}
                          </select>
                        ):<span style={{color:S.t3,fontSize:11}}>—</span>}
                    </td>
                    <td style={{padding:'10px 14px'}}>
                      <span style={{fontSize:10,background:`${est.c}15`,color:est.c,border:`1px solid ${est.c}30`,padding:'3px 10px',borderRadius:50,fontWeight:700,whiteSpace:'nowrap'}}>{est.l}</span>
                    </td>
                    <td style={{padding:'10px 14px'}}>
                      <span style={{fontSize:10,color:S.t3}}>{esOhYeah?'🦉 Oh Yeah':'Nexum'}</span>
                    </td>
                    <td style={{padding:'10px 14px'}}>
                      <div style={{display:'flex',gap:5,flexWrap:'wrap'}}>
                        {r.estado==='pendiente'&&<button onClick={()=>cambiarEstado(r.id,'confirmada',esOhYeah)} style={{padding:'4px 8px',borderRadius:7,border:`1px solid ${S.green}40`,background:`${S.green}10`,color:S.green,fontSize:10,fontWeight:700,cursor:'pointer'}}>✓ Confirmar</button>}
                        {r.estado==='confirmada'&&<button onClick={()=>cambiarEstado(r.id,'sentada',esOhYeah)} style={{padding:'4px 8px',borderRadius:7,border:`1px solid ${S.blue}40`,background:`${S.blue}10`,color:S.blue,fontSize:10,fontWeight:700,cursor:'pointer'}}>🪑 Sentar</button>}
                        {r.estado==='sentada'&&<button onClick={()=>cambiarEstado(r.id,'completada',esOhYeah)} style={{padding:'4px 8px',borderRadius:7,border:`1px solid ${S.purple}40`,background:`${S.purple}10`,color:S.purple,fontSize:10,fontWeight:700,cursor:'pointer'}}>✅ Cerrar</button>}
                        {!['cancelada','completada'].includes(r.estado)&&<button onClick={()=>cambiarEstado(r.id,'cancelada',esOhYeah)} style={{padding:'4px 8px',borderRadius:7,border:`1px solid ${S.red}40`,background:'transparent',color:S.red,fontSize:10,cursor:'pointer'}}>✗</button>}
                        {!esOhYeah&&<button onClick={()=>{setSelected(r);setForm({...r,mesa_num:r.mesa_num||0});setTab('nueva');}} style={{padding:'4px 8px',borderRadius:7,border:`1px solid ${S.border}`,background:'transparent',color:S.t2,fontSize:10,cursor:'pointer'}}>✏️</button>}
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
        <MapaInteractivo
          reservasHoy={reservasHoy}
          fechaFiltro={fechaFiltro}
          onAsignarMesa={asignarMesa}
          onCambiarEstado={cambiarEstado}
          plantaDB={plantaDB}
          now={now}
          busquedaMesa={busquedaMesa}
          setBusquedaMesa={setBusquedaMesa}
        />
      )}

      {/* ── EDITOR DE PLANTA ── */}
      {tab==='editor' && (
        <EditorPlanta
          plantaDB={plantaDB}
          setPlantaDB={setPlantaDB}
          editMesa={editMesa}
          setEditMesa={setEditMesa}
          show={show}
        />
      )}

      {/* ── NUEVA / EDITAR ── */}
      {tab==='nueva' && (
        <div style={{flex:1,overflowY:'auto',padding:24}}>
          <div style={{maxWidth:680,margin:'0 auto'}}>
            <div style={{fontFamily:"'Syne',sans-serif",fontSize:16,fontWeight:900,marginBottom:20}}>{selected?'Editar reserva':'Nueva reserva'}</div>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:14}}>
              <div style={{gridColumn:'1/-1'}}>
                <div style={{fontSize:10,color:S.t3,fontWeight:700,marginBottom:5}}>NOMBRE *</div>
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
                <div style={{display:'flex',gap:6,flexWrap:'wrap'}}>
                  {[1,2,3,4,5,6,7,8,10,12].map(n=>(
                    <button key={n} onClick={()=>setF('pax',n)} style={{padding:'8px 10px',borderRadius:8,border:`1px solid ${form.pax===n?S.blue:S.border2}`,background:form.pax===n?`${S.blue}15`:'transparent',color:form.pax===n?S.blue:S.t3,fontSize:12,fontWeight:700,cursor:'pointer'}}>
                      {n}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <div style={{fontSize:10,color:S.t3,fontWeight:700,marginBottom:5}}>MESA</div>
                <select style={{background:'rgba(255,255,255,0.05)',border:`1px solid ${S.border2}`,borderRadius:10,padding:'10px 14px',color:'#fff',fontSize:13,outline:'none',width:'100%'}} value={form.mesa_num} onChange={e=>setF('mesa_num',Number(e.target.value))}>
                  <option value={0}>Sin asignar</option>
                  {[...Array(16)].map((_,n)=><option key={n+1} value={n+1}>Mesa {n+1}</option>)}
                </select>
              </div>
              <div>
                <div style={{fontSize:10,color:S.t3,fontWeight:700,marginBottom:5}}>OCASIÓN</div>
                <select style={{background:'rgba(255,255,255,0.05)',border:`1px solid ${S.border2}`,borderRadius:10,padding:'10px 14px',color:'#fff',fontSize:13,outline:'none',width:'100%'}} value={form.ocasion} onChange={e=>setF('ocasion',e.target.value)}>
                  {OCASIONES.map(o=><option key={o}>{o}</option>)}
                </select>
              </div>
              <div style={{gridColumn:'1/-1'}}>
                <div style={{fontSize:10,color:S.t3,fontWeight:700,marginBottom:5}}>NOTAS</div>
                <textarea style={{background:'rgba(255,255,255,0.05)',border:`1px solid ${S.border2}`,borderRadius:10,padding:'10px 14px',color:'#fff',fontSize:13,outline:'none',width:'100%',height:70,resize:'vertical'}} value={form.notas} onChange={e=>setF('notas',e.target.value)} placeholder="Alergias, solicitudes especiales..."/>
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

// ═══════════════════════════════════════════════════════════════════════
// MAPA INTERACTIVO
// ═══════════════════════════════════════════════════════════════════════
function MapaInteractivo({ reservasHoy, fechaFiltro, onCambiarEstado, plantaDB, now, busquedaMesa, setBusquedaMesa }:any) {
  const [mesaSel, setMesaSel] = React.useState<any>(null);
  const [vistaZona, setVistaZona] = React.useState<string|null>(null);
  const nowMs = now || Date.now();

  const fmt2 = (d:string) => new Date(d+'T00:00:00').toLocaleDateString('es-CO',{weekday:'short',day:'numeric',month:'short'});

  const plantaActiva = (plantaDB && plantaDB.length > 0)
    ? plantaDB.reduce((acc:any,m:any)=>{acc[m.mesa_key]=m;return acc;},{})
    : PLANTA;

  const getMesaColor = (num:number) => {
    const r = reservasHoy.find((rv:any)=>rv.mesa_num===num);
    if (!r) return {color:'#3dba6f',label:'Libre',reserva:null};
    const c = r.estado==='sentada'?'#FFB547':r.estado==='confirmada'?'#448AFF':r.estado==='completada'?'#606060':r.estado==='cancelada'?'#FF5252':'#FFB547';
    return {color:c,label:ESTADOS[r.estado]?.l||r.estado,reserva:r};
  };

  // Cronómetro de estancia
  const tiempoEstancia = (reserva:any) => {
    if (!reserva?.sentada_en && !reserva?.updated_at) return null;
    const desde = new Date(reserva.sentada_en || reserva.updated_at).getTime();
    const mins = Math.floor((nowMs - desde) / 60000);
    return mins;
  };

  // Contadores por zona
  const contadoresZona = Object.entries(ZONA_AREAS).reduce((acc:any, [zona]:any) => {
    const mesasZona = Object.values(plantaActiva).filter((m:any)=>m.zona===zona);
    const ocupadas = mesasZona.filter((m:any)=>reservasHoy.find((r:any)=>r.mesa_num===m.num&&r.estado==='sentada')).length;
    acc[zona] = { total: mesasZona.length, ocupadas, pct: mesasZona.length ? Math.round(ocupadas/mesasZona.length*100) : 0 };
    return acc;
  }, {});

  // Filtro por búsqueda
  const busqLower = (busquedaMesa||'').toLowerCase();
  const mesasFiltradas = Object.entries(plantaActiva).filter(([,m]:any) => {
    const zonaOk = !vistaZona || m.zona === vistaZona;
    if (!busqLower) return zonaOk;
    const r = reservasHoy.find((rv:any)=>rv.mesa_num===m.num);
    const clienteMatch = r?.cliente_nombre?.toLowerCase().includes(busqLower);
    const numMatch = String(m.num).includes(busqLower);
    return zonaOk && (clienteMatch || numMatch);
  });

  const stats = {
    libres:    Object.values(plantaActiva).filter((m:any)=>!reservasHoy.find((r:any)=>r.mesa_num===m.num)).length,
    ocupadas:  reservasHoy.filter((r:any)=>r.estado==='sentada').length,
    reservadas:reservasHoy.filter((r:any)=>r.estado==='confirmada').length,
  };

  return (
    <div style={{flex:1,display:'flex',flexDirection:'column',overflow:'hidden'}}>
      {/* Toolbar */}
      <div style={{padding:'10px 20px',borderBottom:`1px solid rgba(255,255,255,0.07)`,background:'#0f0f1a',display:'flex',alignItems:'center',gap:12,flexShrink:0,flexWrap:'wrap'}}>
        <div style={{fontSize:12,color:'#A0A0B8'}}>Planta · <span style={{color:'#FFB547',fontWeight:700}}>{fmt2(fechaFiltro)}</span></div>

        {/* KPIs */}
        <div style={{display:'flex',gap:8}}>
          {[{v:stats.libres,l:'Libres',c:'#3dba6f'},{v:stats.ocupadas,l:'Sentadas',c:'#FFB547'},{v:stats.reservadas,l:'Confirmadas',c:'#448AFF'}].map(s=>(
            <span key={s.l} style={{fontSize:11,color:s.c,fontWeight:700,background:`${s.c}15`,padding:'2px 10px',borderRadius:20}}>{s.v} {s.l}</span>
          ))}
        </div>

        {/* Buscador on-the-go */}
        <div style={{display:'flex',alignItems:'center',gap:6,background:'rgba(255,255,255,0.05)',border:'1px solid rgba(255,255,255,0.1)',borderRadius:8,padding:'5px 10px',flex:1,maxWidth:200}}>
          <span style={{fontSize:12,color:'#606060'}}>🔍</span>
          <input value={busquedaMesa||''} onChange={e=>setBusquedaMesa(e.target.value)}
            placeholder="Buscar cliente o mesa..."
            style={{background:'transparent',border:'none',outline:'none',color:'#f0f0f0',fontSize:11,flex:1,minWidth:0}}/>
          {busquedaMesa && <button onClick={()=>setBusquedaMesa('')} style={{background:'none',border:'none',color:'#606060',cursor:'pointer',fontSize:12,padding:0}}>✕</button>}
        </div>

        {/* Filtros de zona con % ocupación */}
        <div style={{marginLeft:'auto',display:'flex',gap:5,flexWrap:'wrap'}}>
          <button onClick={()=>setVistaZona(null)}
            style={{padding:'4px 10px',borderRadius:20,border:`1px solid ${!vistaZona?'#d4943a':'rgba(255,255,255,0.1)'}`,background:!vistaZona?'rgba(212,148,58,0.15)':'transparent',color:!vistaZona?'#d4943a':'#606060',fontSize:10,fontWeight:700,cursor:'pointer'}}>
            🗺️ Todas
          </button>
          {Object.entries(ZONA_COLORES).map(([zona]:any)=>{
            const cnt = contadoresZona[zona];
            const pctColor = !cnt ? '#606060' : cnt.pct >= 80 ? '#FF5252' : cnt.pct >= 50 ? '#FFB547' : '#3dba6f';
            return (
              <button key={zona} onClick={()=>setVistaZona(vistaZona===zona?null:zona)}
                style={{padding:'4px 10px',borderRadius:20,border:`1px solid ${vistaZona===zona?'#d4943a':'rgba(255,255,255,0.1)'}`,background:vistaZona===zona?'rgba(212,148,58,0.15)':'transparent',color:vistaZona===zona?'#d4943a':'#606060',fontSize:10,fontWeight:700,cursor:'pointer',display:'flex',alignItems:'center',gap:4}}>
                {ZONA_COLORES[zona]?.label||zona}
                {cnt && <span style={{fontSize:9,color:pctColor,fontWeight:900}}>{cnt.pct}%</span>}
              </button>
            );
          })}
        </div>
      </div>

      <div style={{flex:1,overflow:'hidden',display:'flex'}}>
        {/* Canvas */}
        <div style={{flex:1,overflow:'auto',padding:16}}>
          <div style={{position:'relative',width:'100%',paddingBottom:'75%',background:'#0a0a12',borderRadius:16,border:'1px solid rgba(255,255,255,0.06)',overflow:'hidden'}}>
            <div style={{position:'absolute',inset:0}}>
              {/* Zonas de fondo */}
              {Object.entries(ZONA_AREAS).filter(([z])=>!vistaZona||z===vistaZona).map(([zona,area])=>(
                <div key={zona} style={{position:'absolute',left:`${area.x}%`,top:`${area.y}%`,width:`${area.w}%`,height:`${area.h}%`,background:ZONA_COLORES[zona]?.bg,border:`1px solid ${ZONA_COLORES[zona]?.border}`,borderRadius:12}}>
                  <div style={{position:'absolute',top:5,left:8,fontSize:8,color:'rgba(255,255,255,0.2)',fontWeight:700,textTransform:'uppercase',letterSpacing:'.08em'}}>{ZONA_COLORES[zona]?.label}</div>
                </div>
              ))}
              {/* COCINA */}
              <div style={{position:'absolute',left:'73%',top:'54%',width:'25%',height:'43%',background:'rgba(255,82,82,0.08)',border:'1.5px solid rgba(255,82,82,0.3)',borderRadius:10,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',gap:3}}>
                <div style={{fontSize:'clamp(14px,2vw,22px)'}}>🔥</div>
                <div style={{fontSize:'clamp(6px,0.9vw,10px)',color:'rgba(255,82,82,0.8)',fontWeight:900,textTransform:'uppercase'}}>Cocina</div>
                <div style={{position:'absolute',top:'-5%',left:'10%',width:'80%',height:'7%',background:'rgba(255,82,82,0.25)',borderRadius:'3px 3px 0 0',display:'flex',alignItems:'center',justifyContent:'center'}}>
                  <div style={{fontSize:'clamp(4px,0.6vw,7px)',color:'rgba(255,82,82,0.7)',fontWeight:700}}>DESPACHO</div>
                </div>
              </div>
              {/* BARRA */}
              <div style={{position:'absolute',left:'2%',top:'76%',width:'68%',height:'12%',background:'rgba(68,139,255,0.08)',border:'1.5px solid rgba(68,139,255,0.3)',borderRadius:10,display:'flex',alignItems:'center',padding:'0 2%',gap:'1.2%',overflow:'hidden'}}>
                {[0,1,2,3,4,5,6,7,8].map(i=><div key={i} style={{width:'clamp(4px,1.1vw,13px)',height:'clamp(4px,1.1vw,13px)',borderRadius:'50%',background:'rgba(68,139,255,0.2)',border:'1px solid rgba(68,139,255,0.4)',flexShrink:0}}/>)}
                <div style={{flex:1}}/><div style={{fontSize:'clamp(7px,1.1vw,13px)'}}>🍸</div>
                <div style={{fontSize:'clamp(6px,0.85vw,10px)',color:'rgba(68,139,255,0.8)',fontWeight:900,textTransform:'uppercase',marginRight:4}}>Barra</div>
              </div>
              {/* CAVA */}
              <div style={{position:'absolute',left:'36%',top:'76%',width:'33%',height:'10%',background:'rgba(255,181,71,0.06)',border:'1.5px solid rgba(255,181,71,0.25)',borderRadius:8,display:'flex',alignItems:'center',justifyContent:'center',gap:5}}>
                <div style={{fontSize:'clamp(7px,1.1vw,13px)'}}>🍷</div>
                <div style={{fontSize:'clamp(6px,0.75vw,9px)',color:'rgba(255,181,71,0.7)',fontWeight:700,textTransform:'uppercase'}}>Cava</div>
              </div>
              {/* ENTRADA */}
              <div style={{position:'absolute',bottom:'1%',left:'40%',display:'flex',alignItems:'center',gap:3}}>
                <div style={{width:'clamp(16px,2.5vw,32px)',height:1,background:'rgba(255,255,255,0.12)'}}/>
                <div style={{fontSize:'clamp(5px,0.65vw,8px)',color:'rgba(255,255,255,0.15)',fontWeight:700}}>↑ ENTRADA</div>
                <div style={{width:'clamp(16px,2.5vw,32px)',height:1,background:'rgba(255,255,255,0.12)'}}/>
              </div>
              {/* Mesas */}
              {mesasFiltradas.map(([key,mesa]:any)=>{
                const {color,label,reserva} = getMesaColor(mesa.num);
                const isSelected = mesaSel?.key===key;
                const mins = reserva?.estado==='sentada' ? tiempoEstancia(reserva) : null;
                // Alerta si supera 90 min
                const enAlerta = mins !== null && mins > 90;
                const mesaColor = enAlerta ? '#FF5252' : color;
                return (
                  <div key={key}
                    style={{position:'absolute',left:`${mesa.x}%`,top:`${mesa.y}%`,width:`${mesa.w}%`,height:`${mesa.h}%`,borderRadius:mesa.shape==='round'?'50%':10,background:`${mesaColor}${isSelected?'35':'15'}`,border:`2px solid ${mesaColor}${isSelected?'':'60'}`,cursor:'pointer',display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',transition:'all .18s',boxShadow:enAlerta?`0 0 12px ${mesaColor}80`:isSelected?`0 0 16px ${mesaColor}60`:'none',zIndex:isSelected?2:1}}
                    onClick={()=>setMesaSel(mesaSel?.key===key?null:{key,...mesa,color:mesaColor,label,reserva})}
                  >
                    <div style={{fontFamily:"'Syne',sans-serif",fontSize:'clamp(7px,1.1vw,13px)',fontWeight:900,color:mesaColor,lineHeight:1}}>M{mesa.num}</div>
                    {mesa.shape!=='round'&&<div style={{fontSize:'clamp(5px,0.7vw,9px)',color:`${mesaColor}aa`}}>{mesa.cap||mesa.capacidad}p</div>}
                    {/* Cronómetro de estancia */}
                    {mins !== null && (
                      <div style={{fontSize:'clamp(4px,0.6vw,8px)',color:mesaColor,fontWeight:700,marginTop:1}}>
                        {mins < 60 ? `${mins}m` : `${Math.floor(mins/60)}h${mins%60}m`}
                      </div>
                    )}
                    {/* Punto pulsante */}
                    {reserva?.estado==='sentada' && <div style={{position:'absolute',top:2,right:2,width:6,height:6,borderRadius:'50%',background:mesaColor,boxShadow:enAlerta?`0 0 6px ${mesaColor}`:'none'}}/>}
                    {enAlerta && <div style={{position:'absolute',top:-4,left:'50%',transform:'translateX(-50%)',fontSize:9,whiteSpace:'nowrap'}}>⚠️</div>}
                  </div>
                );
              })}
              <div style={{position:'absolute',bottom:'1%',right:'2%',fontSize:'clamp(6px,0.75vw,9px)',color:'rgba(255,255,255,0.1)',fontWeight:700}}>OMM · Bogotá</div>
            </div>
          </div>
        </div>

        {/* Panel lateral */}
        <div style={{width:260,borderLeft:'1px solid rgba(255,255,255,0.07)',display:'flex',flexDirection:'column',flexShrink:0,background:'#0f0f1a'}}>
          {!mesaSel?(
            <div style={{flex:1,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',padding:20,color:'#50506A',textAlign:'center'}}>
              <div style={{fontSize:36,marginBottom:12}}>🗺️</div>
              <div style={{fontSize:12,fontWeight:700,marginBottom:6}}>Selecciona una mesa</div>
              <div style={{fontSize:11,lineHeight:1.6}}>Toca cualquier mesa en el plano para ver su estado</div>
            </div>
          ):(
            <div style={{flex:1,overflowY:'auto',padding:16}}>
              <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:14}}>
                <div style={{width:48,height:48,borderRadius:mesaSel.shape==='round'?'50%':12,background:`${mesaSel.color}20`,border:`2px solid ${mesaSel.color}`,display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
                  <span style={{fontFamily:"'Syne',sans-serif",fontSize:16,fontWeight:900,color:mesaSel.color}}>M{mesaSel.num}</span>
                </div>
                <div>
                  <div style={{fontSize:14,fontWeight:700}}>{mesaSel.zona}</div>
                  <div style={{fontSize:10,color:mesaSel.color,fontWeight:700}}>{mesaSel.label}</div>
                  <div style={{fontSize:10,color:'#50506A'}}>{mesaSel.cap||mesaSel.capacidad} personas</div>
                </div>
              </div>
              {!mesaSel.reserva?(
                <div style={{padding:'12px 14px',background:'rgba(255,255,255,0.03)',border:'1px solid rgba(255,255,255,0.07)',borderRadius:10}}>
                  <div style={{fontSize:11,color:'#3dba6f',fontWeight:700,marginBottom:4}}>✓ Mesa libre</div>
                  <div style={{fontSize:10,color:'#50506A'}}>Sin reserva para {fmt2(fechaFiltro)}</div>
                </div>
              ):(
                <div>
                  <div style={{background:'rgba(255,255,255,0.03)',border:`1px solid ${mesaSel.color}25`,borderRadius:10,padding:'12px 14px',marginBottom:12}}>
                    <div style={{fontSize:14,fontWeight:700,marginBottom:3}}>{mesaSel.reserva.cliente_nombre}</div>
                    <div style={{display:'flex',gap:10,marginBottom:6}}>
                      <span style={{fontSize:11,color:'#FFB547',fontWeight:700}}>🕐 {mesaSel.reserva.hora}</span>
                      <span style={{fontSize:11,color:'#448AFF'}}>👥 {mesaSel.reserva.pax}p</span>
                    </div>
                    {mesaSel.reserva.ocasion&&mesaSel.reserva.ocasion!=='Sin ocasión especial'&&(
                      <span style={{fontSize:10,background:'rgba(179,136,255,0.15)',color:'#B388FF',padding:'2px 8px',borderRadius:20}}>{mesaSel.reserva.ocasion}</span>
                    )}
                  </div>
                  <div style={{display:'flex',flexDirection:'column',gap:7}}>
                    {mesaSel.reserva.estado==='pendiente'&&<button onClick={()=>onCambiarEstado(mesaSel.reserva.id,'confirmada',mesaSel.reserva.origen==='ohyeah')} style={{width:'100%',padding:'9px',borderRadius:9,border:'1px solid rgba(0,230,118,0.4)',background:'rgba(0,230,118,0.1)',color:'#00E676',fontSize:12,fontWeight:700,cursor:'pointer'}}>✓ Confirmar</button>}
                    {mesaSel.reserva.estado==='confirmada'&&<button onClick={()=>{onCambiarEstado(mesaSel.reserva.id,'sentada',mesaSel.reserva.origen==='ohyeah');setMesaSel(null);}} style={{width:'100%',padding:'9px',borderRadius:9,border:'1px solid rgba(68,139,255,0.4)',background:'rgba(68,139,255,0.1)',color:'#448AFF',fontSize:12,fontWeight:700,cursor:'pointer'}}>🪑 Sentar</button>}
                    {mesaSel.reserva.estado==='sentada'&&<button onClick={()=>{onCambiarEstado(mesaSel.reserva.id,'completada',false);setMesaSel(null);}} style={{width:'100%',padding:'9px',borderRadius:9,border:'1px solid rgba(179,136,255,0.4)',background:'rgba(179,136,255,0.1)',color:'#B388FF',fontSize:12,fontWeight:700,cursor:'pointer'}}>✅ Cerrar mesa</button>}
                    {!['cancelada','completada'].includes(mesaSel.reserva.estado)&&<button onClick={()=>{onCambiarEstado(mesaSel.reserva.id,'cancelada',false);setMesaSel(null);}} style={{width:'100%',padding:'8px',borderRadius:9,border:'1px solid rgba(255,82,82,0.3)',background:'transparent',color:'#FF5252',fontSize:11,cursor:'pointer'}}>✗ Cancelar</button>}
                  </div>
                  {mesaSel.reserva.origen==='ohyeah'&&<div style={{marginTop:12,padding:'8px 12px',background:'rgba(255,181,71,0.08)',border:'1px solid rgba(255,181,71,0.2)',borderRadius:8,display:'flex',alignItems:'center',gap:6}}><span style={{fontSize:16}}>🦉</span><span style={{fontSize:10,color:'#FFB547'}}>Reserva desde Oh Yeah</span></div>}
                </div>
              )}
            </div>
          )}
          <div style={{padding:'10px 14px',borderTop:'1px solid rgba(255,255,255,0.07)',display:'flex',flexWrap:'wrap',gap:8,flexShrink:0}}>
            {[{c:'#3dba6f',l:'Libre'},{c:'#448AFF',l:'Confirmada'},{c:'#FFB547',l:'Sentada'},{c:'#B388FF',l:'Completada'},{c:'#FF5252',l:'Cancelada'}].map(s=>(
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

// ═══════════════════════════════════════════════════════════════════════
// EDITOR DE PLANTA
// ═══════════════════════════════════════════════════════════════════════
function EditorPlanta({ plantaDB, setPlantaDB, editMesa, setEditMesa, show }:any) {
  const inp: React.CSSProperties = {width:'100%',padding:'7px 10px',borderRadius:7,border:'1px solid rgba(255,255,255,0.12)',background:'rgba(255,255,255,0.04)',color:'#fff',fontSize:12,outline:'none'};

  const agregarMesa = async () => {
    const newNum = Math.max(...(plantaDB.map((m:any)=>m.num)||[0]),0)+1;
    const newMesa = {restaurante_id:6,mesa_key:`X${newNum}`,num:newNum,zona:'Salón',shape:'round',capacidad:4,x:45,y:45,w:10,h:10,activa:true};
    const {data} = await supabase.from('planta_mesas').insert(newMesa).select().single();
    if (data) setPlantaDB((p:any)=>[...p,data]);
    show(`✓ Mesa ${newNum} agregada`);
  };

  const guardarMesa = async () => {
    await supabase.from('planta_mesas').update({
      num:editMesa.num,zona:editMesa.zona,shape:editMesa.shape,
      capacidad:editMesa.capacidad,x:editMesa.x,y:editMesa.y,
      w:editMesa.w,h:editMesa.h,updated_at:new Date().toISOString()
    }).eq('id',editMesa.id);
    setPlantaDB((p:any)=>p.map((m:any)=>m.id===editMesa.id?{...m,...editMesa}:m));
    setEditMesa(null);
    show('✓ Mesa actualizada');
  };

  const eliminarMesa = async () => {
    await supabase.from('planta_mesas').update({activa:false}).eq('id',editMesa.id);
    setPlantaDB((p:any)=>p.filter((m:any)=>m.id!==editMesa.id));
    const num = editMesa.num;
    setEditMesa(null);
    show(`Mesa ${num} eliminada`);
  };

  const plantaVis = plantaDB.length > 0 ? plantaDB : Object.values(PLANTA);

  return (
    <div style={{flex:1,overflow:'hidden',display:'flex',flexDirection:'column'}}>
      {/* Toolbar */}
      <div style={{padding:'10px 20px',borderBottom:'1px solid rgba(255,255,255,0.07)',background:'#0f0f1a',display:'flex',gap:10,alignItems:'center',flexShrink:0,flexWrap:'wrap'}}>
        <div style={{fontSize:12,color:'#A0A0B8',fontWeight:700}}>⚙️ Editor de planta · OMM</div>
        <div style={{fontSize:11,color:'#50506A'}}>Toca una mesa para editar · Los cambios se guardan en Supabase</div>
        <button onClick={agregarMesa} style={{marginLeft:'auto',padding:'7px 16px',borderRadius:9,border:'none',background:'linear-gradient(135deg,#00E676,#009944)',color:'#000',fontSize:12,fontWeight:700,cursor:'pointer'}}>
          + Agregar mesa
        </button>
      </div>

      <div style={{flex:1,overflow:'hidden',display:'flex'}}>
        {/* Canvas */}
        <div style={{flex:1,overflow:'auto',padding:16}}>
          <div style={{position:'relative',width:'100%',paddingBottom:'70%',background:'#0a0a12',borderRadius:16,border:'1px solid rgba(255,255,255,0.08)',overflow:'hidden',userSelect:'none'}}>
            <div style={{position:'absolute',inset:0}}>
              {Object.entries(ZONA_AREAS).map(([zona,area])=>(
                <div key={zona} style={{position:'absolute',left:`${area.x}%`,top:`${area.y}%`,width:`${area.w}%`,height:`${area.h}%`,background:ZONA_COLORES[zona]?.bg,border:`1px dashed ${ZONA_COLORES[zona]?.border}`,borderRadius:12}}>
                  <div style={{position:'absolute',top:5,left:8,fontSize:8,color:'rgba(255,255,255,0.2)',fontWeight:700,textTransform:'uppercase'}}>{ZONA_COLORES[zona]?.label}</div>
                </div>
              ))}
              {/* Cocina + Barra simples en modo editor */}
              <div style={{position:'absolute',left:'73%',top:'54%',width:'25%',height:'43%',background:'rgba(255,82,82,0.06)',border:'1px dashed rgba(255,82,82,0.2)',borderRadius:10,display:'flex',alignItems:'center',justifyContent:'center',flexDirection:'column',gap:4}}>
                <div>🔥</div><div style={{fontSize:9,color:'rgba(255,82,82,0.5)',fontWeight:700}}>Cocina</div>
              </div>
              <div style={{position:'absolute',left:'2%',top:'76%',width:'68%',height:'12%',background:'rgba(68,139,255,0.05)',border:'1px dashed rgba(68,139,255,0.2)',borderRadius:10,display:'flex',alignItems:'center',justifyContent:'center',gap:8}}>
                <div>🍸</div><div style={{fontSize:9,color:'rgba(68,139,255,0.5)',fontWeight:700}}>Barra</div>
              </div>
              {/* Mesas editables */}
              {plantaVis.filter((m:any)=>m.activa!==false).map((mesa:any)=>{
                const isEditing = editMesa?.id===mesa.id;
                const key = mesa.mesa_key || `M${mesa.num}`;
                return (
                  <div key={key}
                    style={{position:'absolute',left:`${mesa.x}%`,top:`${mesa.y}%`,width:`${mesa.w||10}%`,height:`${mesa.h||10}%`,borderRadius:mesa.shape==='round'?'50%':10,background:isEditing?'rgba(212,148,58,0.25)':'rgba(255,255,255,0.07)',border:`2px solid ${isEditing?'#d4943a':'rgba(255,255,255,0.25)'}`,cursor:'pointer',display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',boxShadow:isEditing?'0 0 12px rgba(212,148,58,0.4)':'none',zIndex:isEditing?3:1,transition:'all .15s'}}
                    onClick={()=>setEditMesa(isEditing?null:{...mesa})}
                  >
                    <div style={{fontFamily:"'Syne',sans-serif",fontSize:'clamp(7px,1.1vw,13px)',fontWeight:900,color:isEditing?'#d4943a':'rgba(255,255,255,0.8)',lineHeight:1}}>M{mesa.num}</div>
                    {mesa.shape!=='round'&&<div style={{fontSize:'clamp(5px,0.7vw,9px)',color:'rgba(255,255,255,0.4)'}}>{mesa.capacidad||mesa.cap}p</div>}
                    {isEditing&&<div style={{position:'absolute',top:-2,right:-2,width:8,height:8,borderRadius:'50%',background:'#d4943a'}}/>}
                  </div>
                );
              })}
            </div>
          </div>
          <div style={{marginTop:8,fontSize:10,color:'#50506A',textAlign:'center'}}>Toca una mesa para editar en el panel derecho</div>
        </div>

        {/* Panel edición */}
        <div style={{width:280,borderLeft:'1px solid rgba(255,255,255,0.07)',background:'#0f0f1a',display:'flex',flexDirection:'column',flexShrink:0}}>
          {!editMesa?(
            <div style={{flex:1,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',padding:24,color:'#50506A',textAlign:'center'}}>
              <div style={{fontSize:40,marginBottom:12}}>✏️</div>
              <div style={{fontSize:12,fontWeight:700,marginBottom:6}}>Selecciona una mesa</div>
              <div style={{fontSize:11,lineHeight:1.6}}>Toca cualquier mesa en el canvas para editar sus propiedades o eliminarla</div>
            </div>
          ):(
            <div style={{flex:1,overflowY:'auto',padding:16}}>
              <div style={{fontFamily:"'Syne',sans-serif",fontSize:14,fontWeight:900,marginBottom:14,color:'#f0f0f0'}}>Mesa {editMesa.num}</div>

              <div style={{marginBottom:12}}>
                <div style={{fontSize:10,color:'#50506A',fontWeight:700,marginBottom:4,textTransform:'uppercase'}}>Número de mesa</div>
                <input type="number" style={inp} value={editMesa.num} onChange={e=>setEditMesa((p:any)=>({...p,num:Number(e.target.value)}))}/>
              </div>

              <div style={{marginBottom:12}}>
                <div style={{fontSize:10,color:'#50506A',fontWeight:700,marginBottom:6,textTransform:'uppercase'}}>Zona</div>
                <div style={{display:'flex',gap:5,flexWrap:'wrap'}}>
                  {['Terraza','Salón','Privado','Barra'].map(z=>(
                    <button key={z} onClick={()=>setEditMesa((p:any)=>({...p,zona:z}))}
                      style={{padding:'5px 10px',borderRadius:8,border:`1px solid ${editMesa.zona===z?'#FFB547':'rgba(255,255,255,0.12)'}`,background:editMesa.zona===z?'rgba(255,181,71,0.15)':'transparent',color:editMesa.zona===z?'#FFB547':'#50506A',fontSize:11,cursor:'pointer'}}>
                      {z}
                    </button>
                  ))}
                </div>
              </div>

              <div style={{marginBottom:12}}>
                <div style={{fontSize:10,color:'#50506A',fontWeight:700,marginBottom:6,textTransform:'uppercase'}}>Forma</div>
                <div style={{display:'flex',gap:6}}>
                  {[{v:'round',l:'⭕ Redonda'},{v:'rect',l:'▭ Rectangular'}].map(f=>(
                    <button key={f.v} onClick={()=>setEditMesa((p:any)=>({...p,shape:f.v}))}
                      style={{flex:1,padding:'7px',borderRadius:8,border:`1px solid ${editMesa.shape===f.v?'#448AFF':'rgba(255,255,255,0.12)'}`,background:editMesa.shape===f.v?'rgba(68,139,255,0.15)':'transparent',color:editMesa.shape===f.v?'#448AFF':'#50506A',fontSize:11,cursor:'pointer'}}>
                      {f.l}
                    </button>
                  ))}
                </div>
              </div>

              <div style={{marginBottom:12}}>
                <div style={{fontSize:10,color:'#50506A',fontWeight:700,marginBottom:6,textTransform:'uppercase'}}>Capacidad (personas)</div>
                <div style={{display:'flex',gap:5,flexWrap:'wrap'}}>
                  {[1,2,3,4,5,6,7,8,10,12].map(n=>(
                    <button key={n} onClick={()=>setEditMesa((p:any)=>({...p,capacidad:n}))}
                      style={{padding:'6px 8px',borderRadius:7,border:`1px solid ${editMesa.capacidad===n?'#00E676':'rgba(255,255,255,0.12)'}`,background:editMesa.capacidad===n?'rgba(0,230,118,0.15)':'transparent',color:editMesa.capacidad===n?'#00E676':'#50506A',fontSize:12,fontWeight:700,cursor:'pointer',minWidth:32}}>
                      {n}
                    </button>
                  ))}
                </div>
              </div>

              <div style={{marginBottom:14}}>
                <div style={{fontSize:10,color:'#50506A',fontWeight:700,marginBottom:6,textTransform:'uppercase'}}>Posición en el plano (%)</div>
                <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8}}>
                  {[{l:'X (horizontal)',k:'x'},{l:'Y (vertical)',k:'y'},{l:'Ancho',k:'w'},{l:'Alto',k:'h'}].map(f=>(
                    <div key={f.k}>
                      <div style={{fontSize:9,color:'#50506A',marginBottom:3}}>{f.l}</div>
                      <input type="number" min={1} max={95} style={inp} value={editMesa[f.k]} onChange={e=>setEditMesa((p:any)=>({...p,[f.k]:Number(e.target.value)}))}/>
                    </div>
                  ))}
                </div>
              </div>

              <div style={{display:'flex',flexDirection:'column',gap:7}}>
                <button onClick={guardarMesa} style={{width:'100%',padding:'10px',borderRadius:9,border:'none',background:'linear-gradient(135deg,#FFB547,#d4943a)',color:'#000',fontSize:12,fontWeight:700,cursor:'pointer'}}>
                  ✓ Guardar cambios
                </button>
                <button onClick={eliminarMesa} style={{width:'100%',padding:'9px',borderRadius:9,border:'1px solid rgba(255,82,82,0.4)',background:'transparent',color:'#FF5252',fontSize:12,cursor:'pointer'}}>
                  🗑 Eliminar mesa
                </button>
                <button onClick={()=>setEditMesa(null)} style={{width:'100%',padding:'8px',borderRadius:9,border:'1px solid rgba(255,255,255,0.1)',background:'transparent',color:'#50506A',fontSize:12,cursor:'pointer'}}>
                  Cancelar
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
