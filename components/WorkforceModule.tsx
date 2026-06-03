import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import { useRestaurant } from '../contexts/RestaurantContext';
import {
  Calendar, Clock, Users, CheckCircle2, AlertTriangle, FileText, DollarSign,
  Plus, X, Check, ChevronLeft, ChevronRight, LogIn, LogOut, Loader2, ShieldCheck, Ban, Sparkles
} from 'lucide-react';

/* ──────────────────────────────────────────────────────────────────────────
   NEXUM · Workforce Intelligence
   Ciclo operativo: Horario → Asistencia → Novedades → Preliquidación → Auditoría
   Conectado a: empleados, turnos, attendance, workforce_novedades, workforce_audit
   ────────────────────────────────────────────────────────────────────────── */

// REST_ID y COMPLEJO_ID se leen del RestaurantContext (multi-restaurante)
const COMPLEJO_POR_RESTAURANTE: Record<number, number> = { 6: 2, 23: 3 };

// Policy laboral (parametrizable — PRD §10). Colombia, valores demo.
const HORAS_MES = 230;
const RECARGO_NOCTURNO = 0.35;
const RECARGO_DOMINICAL = 0.75;
const RECARGO_EXTRA = 0.25;
const NOCHE_INICIO = 19; // 7:00 p.m. (reforma vigente)
const NOCHE_FIN = 6;
const FESTIVOS_2026 = new Set([
  '2026-01-01','2026-01-12','2026-03-23','2026-04-02','2026-04-03','2026-05-01',
  '2026-05-18','2026-06-08','2026-06-15','2026-06-29','2026-07-20','2026-08-07',
  '2026-08-17','2026-10-12','2026-11-02','2026-11-16','2026-12-08','2026-12-25',
]);

const TIPOS_TURNO = [
  { id:'apertura',   label:'Apertura sala', color:'#4a8fd4' },
  { id:'produccion', label:'Producción cocina', color:'#d4943a' },
  { id:'mise',       label:'Mise en place bar', color:'#9b6dd4' },
  { id:'servicio',   label:'Servicio activo', color:'#3dba6f' },
  { id:'refuerzo',   label:'Refuerzo pico', color:'#e0a050' },
  { id:'cierre',     label:'Cierre', color:'#e05050' },
  { id:'partido',    label:'Turno partido', color:'#50b0e0' },
  { id:'training',   label:'Entrenamiento', color:'#808080' },
];
const tipoMeta = (id?:string) => TIPOS_TURNO.find(t=>t.id===id) || { id:'servicio', label:'Servicio', color:'#3dba6f' };

const TIPOS_NOVEDAD = [
  { id:'incapacidad',     label:'Incapacidad',      impacto:'ausencia' },
  { id:'permiso_pago',    label:'Permiso con pago', impacto:'pago' },
  { id:'permiso_no_pago', label:'Permiso sin pago', impacto:'descuento' },
  { id:'ausencia',        label:'Ausencia injustificada', impacto:'descuento' },
  { id:'vacaciones',      label:'Vacaciones',       impacto:'ausencia' },
  { id:'cambio_turno',    label:'Cambio de turno',  impacto:'ninguno' },
  { id:'hora_extra',      label:'Horas extra',      impacto:'pago' },
  { id:'bonificacion',    label:'Bonificación',     impacto:'pago' },
];
const novedadMeta = (id?:string) => TIPOS_NOVEDAD.find(t=>t.id===id) || { id:'', label:id||'', impacto:'ninguno' };

const DIAS = ['Lun','Mar','Mié','Jue','Vie','Sáb','Dom'];

// ── helpers de fecha/hora ──
const ymd = (d:Date) => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
const startOfWeek = (base:Date) => { const x=new Date(base); const off=(x.getDay()+6)%7; x.setDate(x.getDate()-off); x.setHours(0,0,0,0); return x; };
const addDays = (d:Date,n:number)=>{ const x=new Date(d); x.setDate(x.getDate()+n); return x; };
const toMin = (t?:string)=>{ if(!t) return 0; const [h,m]=t.split(':'); return Number(h)*60+Number(m||0); };
const hhmm = (t?:string)=> t? t.slice(0,5) : '';
const nowHHMMSS = ()=>{ const d=new Date(); return `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}:00`; };
const shiftHours = (ini?:string, fin?:string)=>{ if(!ini||!fin) return 0; let s=toMin(ini), e=toMin(fin); if(e<=s) e+=1440; return (e-s)/60; };
const nightFraction = (ini?:string, fin?:string)=>{ if(!ini||!fin) return 0; let s=toMin(ini), e=toMin(fin); if(e<=s) e+=1440; let night=0,total=0; for(let m=s;m<e;m+=15){ const h=Math.floor((m%1440)/60); total+=15; if(h>=NOCHE_INICIO||h<NOCHE_FIN) night+=15; } return total? night/total : 0; };
const esFestivo = (fecha:string)=> { const d=new Date(fecha+'T12:00:00'); return d.getDay()===0 || FESTIVOS_2026.has(fecha); };
const cop = (n:number)=> '$'+Math.round(n||0).toLocaleString('es-CO');

// ── colores tema ──
const C = {
  bg:'#0a0a0a', card:'#141414', card2:'#1c1c1c', border:'#2a2a2a',
  gold:'#d4943a', goldL:'#f0b45a', green:'#3dba6f', red:'#e05050', blue:'#4a8fd4',
  t1:'#f0f0f0', t2:'#a0a0a0', t3:'#606060',
};

type Tab = 'resumen'|'horarios'|'asistencia'|'novedades'|'preliquidacion'|'ia';

export default function WorkforceModule({ userName = 'Gerencia' }: { userName?: string }) {
  const { activeId: REST_ID, activeRestaurant } = useRestaurant();
  const COMPLEJO_ID = COMPLEJO_POR_RESTAURANTE[REST_ID] || 2;
  const [tab, setTab] = useState<Tab>('resumen');
  const [loading, setLoading] = useState(true);
  const [empleados, setEmpleados] = useState<any[]>([]);
  const [turnos, setTurnos] = useState<any[]>([]);
  const [asistencia, setAsistencia] = useState<any[]>([]);
  const [novedades, setNovedades] = useState<any[]>([]);
  const [weekBase, setWeekBase] = useState<Date>(startOfWeek(new Date()));
  const [toast, setToast] = useState('');
  const showToast = (m:string)=>{ setToast(m); setTimeout(()=>setToast(''), 2600); };

  const weekStart = useMemo(()=>startOfWeek(weekBase), [weekBase]);
  const weekDays = useMemo(()=>Array.from({length:7},(_,i)=>addDays(weekStart,i)), [weekStart]);
  const weekStartStr = ymd(weekStart);
  const weekEndStr = ymd(addDays(weekStart,6));
  const hoy = ymd(new Date());

  const logAudit = useCallback((accion:string, objeto:string, despues:any, motivo='')=>{
    supabase.from('workforce_audit').insert({ restaurante_id:REST_ID, actor:userName, accion, objeto, despues, motivo }).then(()=>{},()=>{});
  }, [userName]);

  const cargar = useCallback(async ()=>{
    const [emp, tur, asi, nov] = await Promise.all([
      supabase.from('empleados').select('*').eq('restaurante_id',REST_ID).order('nombre_completo'),
      supabase.from('turnos').select('*').gte('fecha',weekStartStr).lte('fecha',weekEndStr),
      supabase.from('attendance').select('*').eq('fecha',hoy),
      supabase.from('workforce_novedades').select('*').eq('restaurante_id',REST_ID).order('created_at',{ascending:false}),
    ]);
    setEmpleados(emp.data||[]);
    setTurnos(tur.data||[]);
    setAsistencia(asi.data||[]);
    setNovedades(nov.data||[]);
    setLoading(false);
  }, [weekStartStr, weekEndStr, hoy, REST_ID]);

  useEffect(()=>{ cargar(); }, [cargar]);
  useEffect(()=>{
    const ch = supabase.channel('workforce-live')
      .on('postgres_changes',{event:'*',schema:'public',table:'turnos'}, cargar)
      .on('postgres_changes',{event:'*',schema:'public',table:'attendance'}, cargar)
      .on('postgres_changes',{event:'*',schema:'public',table:'workforce_novedades'}, cargar)
      .subscribe();
    return ()=>{ supabase.removeChannel(ch); };
  }, [cargar]);

  const empById = useMemo(()=>{ const m:Record<number,any>={}; empleados.forEach(e=>m[e.id]=e); return m; }, [empleados]);
  const valorHora = (emp:any)=> (Number(emp?.salario_base)||0)/HORAS_MES;

  // ─────────────── KPIs del día ───────────────
  const turnosHoy = turnos.filter(t=>t.fecha===hoy);
  const presentes = asistencia.filter(a=>a.estado==='presente'||a.estado==='tarde').length;
  const tarde = asistencia.filter(a=>a.estado==='tarde').length;
  const ausentes = Math.max(0, turnosHoy.length - asistencia.filter(a=>a.estado!=='no_show').length);
  const novPendientes = novedades.filter(n=>n.estado==='enviada').length;
  const costoSemana = useMemo(()=> turnos.reduce((acc,t)=>{ const e=empById[t.empleado_id]; if(!e) return acc; return acc + shiftHours(t.hora_inicio,t.hora_fin)*valorHora(e); },0), [turnos, empById]);
  const coberturaHoy = turnosHoy.length? Math.round((asistencia.filter(a=>a.estado==='presente'||a.estado==='tarde').length/turnosHoy.length)*100) : 0;

  // ─────────────── Preliquidación (periodo = semana visible) ───────────────
  const preliq = useMemo(()=>{
    return empleados.map(e=>{
      const ts = turnos.filter(t=>t.empleado_id===e.id);
      let hOrd=0, hNoct=0, hDom=0;
      ts.forEach(t=>{ const h=shiftHours(t.hora_inicio,t.hora_fin); hOrd+=h; hNoct+=h*nightFraction(t.hora_inicio,t.hora_fin); if(esFestivo(t.fecha)) hDom+=h; });
      const vh = valorHora(e);
      let extrasVal=0, deducc=0, bonos=0;
      novedades.filter(n=>n.estado==='aprobada' && n.empleado_id===e.id && (!n.fecha_inicio || (n.fecha_inicio<=weekEndStr && (!n.fecha_fin || n.fecha_fin>=weekStartStr)))).forEach(n=>{
        if(n.tipo==='hora_extra') extrasVal += (Number(n.horas)||0)*vh*(1+RECARGO_EXTRA);
        else if(n.tipo==='ausencia'||n.tipo==='permiso_no_pago') deducc += (Number(n.dias)||0)*((Number(e.salario_base)||0)/30);
        else if(n.tipo==='bonificacion') bonos += (Number(n.valor)||0);
      });
      const valNoct = hNoct*vh*RECARGO_NOCTURNO;
      const valDom = hDom*vh*RECARGO_DOMINICAL;
      const devengado = hOrd*vh + valNoct + valDom + extrasVal + bonos - deducc;
      return { emp:e, hOrd, hNoct, hDom, valNoct, valDom, extrasVal, bonos, deducc, devengado, turnos:ts.length };
    }).filter(r=>r.turnos>0 || r.devengado!==0);
  }, [empleados, turnos, novedades, weekStartStr, weekEndStr]);
  const costoPeriodo = preliq.reduce((a,r)=>a+r.devengado,0);

  // ─────────────── Acciones ───────────────
  const [shiftModal, setShiftModal] = useState<{empId:number, fecha:string}|null>(null);
  const [novModal, setNovModal] = useState(false);

  const eliminarTurno = async (t:any)=>{
    await supabase.from('turnos').delete().eq('id',t.id);
    logAudit('turno.eliminado','turnos',{id:t.id, empleado_id:t.empleado_id, fecha:t.fecha});
    showToast('Turno eliminado');
  };
  const toggleConfirmar = async (t:any)=>{
    await supabase.from('turnos').update({ confirmado:!t.confirmado }).eq('id',t.id);
  };
  const publicarSemana = async ()=>{
    const ids = turnos.map(t=>t.id);
    if(ids.length===0){ showToast('No hay turnos en la semana'); return; }
    await supabase.from('turnos').update({ publicado:true, estado:'publicado' }).in('id',ids);
    logAudit('horario.publicado','turnos',{semana:weekStartStr, turnos:ids.length});
    showToast(`✓ Horario publicado · ${ids.length} turnos · notificado a empleados`);
  };

  // Check-in / Check-out (kiosk)
  const checkIn = async (t:any)=>{
    const e = empById[t.empleado_id]; if(!e) return;
    const ahora = nowHHMMSS();
    const minTarde = Math.max(0, toMin(ahora)-toMin(t.hora_inicio));
    await supabase.from('attendance').insert({
      restaurante_id:REST_ID, staff_id:e.staff_nexum_id, empleado_nombre:e.nombre_completo, fecha:hoy,
      turno:`${hhmm(t.hora_inicio)}–${hhmm(t.hora_fin)}`, hora_entrada_esperada:t.hora_inicio, hora_entrada_real:ahora,
      hora_salida_esperada:t.hora_fin, minutos_tarde:minTarde, estado: minTarde>5?'tarde':'presente', presence_multiplier:1,
    });
    logAudit('checkin','attendance',{empleado:e.nombre_completo, hora:ahora, minutos_tarde:minTarde});
    showToast(`✓ Check-in ${e.nombre_completo}${minTarde>5?` · ${minTarde} min tarde`:''}`);
  };
  const checkOut = async (a:any)=>{
    const ahora = nowHHMMSS();
    let s=toMin(a.hora_entrada_real), en=toMin(ahora); if(en<=s) en+=1440;
    const horas = Math.round(((en-s)/60)*100)/100;
    await supabase.from('attendance').update({ hora_salida_real:ahora, horas_reales:horas }).eq('id',a.id);
    logAudit('checkout','attendance',{empleado:a.empleado_nombre, hora:ahora, horas});
    showToast(`✓ Check-out ${a.empleado_nombre} · ${horas} h`);
  };
  const marcarNoShow = async (t:any)=>{
    const e = empById[t.empleado_id]; if(!e) return;
    await supabase.from('attendance').insert({ restaurante_id:REST_ID, staff_id:e.staff_nexum_id, empleado_nombre:e.nombre_completo, fecha:hoy, turno:`${hhmm(t.hora_inicio)}–${hhmm(t.hora_fin)}`, hora_entrada_esperada:t.hora_inicio, estado:'no_show', presence_multiplier:0 });
    logAudit('no_show','attendance',{empleado:e.nombre_completo, turno:t.id});
    showToast(`⚠️ No-show registrado · ${e.nombre_completo}`);
  };

  const aprobarNovedad = async (n:any, aprobar:boolean)=>{
    await supabase.from('workforce_novedades').update({ estado: aprobar?'aprobada':'rechazada', aprobado_por:userName, aprobado_at:new Date().toISOString() }).eq('id',n.id);
    logAudit(aprobar?'novedad.aprobada':'novedad.rechazada','workforce_novedades',{id:n.id, tipo:n.tipo, empleado:n.empleado_nombre});
    showToast(aprobar?`✓ Novedad aprobada`:`Novedad rechazada`);
  };

  // ─────────────── Render ───────────────
  const TABS:{id:Tab,label:string,icon:any,badge?:number}[] = [
    { id:'resumen', label:'Resumen', icon:ShieldCheck },
    { id:'horarios', label:'Horarios', icon:Calendar },
    { id:'asistencia', label:'Asistencia', icon:Clock },
    { id:'novedades', label:'Novedades', icon:FileText, badge:novPendientes },
    { id:'preliquidacion', label:'Preliquidación', icon:DollarSign },
    { id:'ia', label:'IA · Turno óptimo', icon:Sparkles },
  ];

  if (loading) return <div className="flex items-center justify-center h-[60vh] text-[#a0a0a0]"><Loader2 className="animate-spin mr-2" size={20}/> Cargando workforce…</div>;

  return (
    <div className="text-left" style={{color:C.t1}}>
      {/* Header */}
      <div className="flex items-center gap-3 mb-1">
        <Users size={22} className="text-[#d4943a]"/>
        <h1 className="font-['Syne'] text-[22px] font-black tracking-tight">NEXUM Workforce Intelligence</h1>
      </div>
      <p className="text-[11px] uppercase tracking-[0.2em] text-[#606060] mb-4">Horario → Asistencia → Novedades → Preliquidación → Auditoría</p>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-[#2a2a2a] mb-5 overflow-x-auto">
        {TABS.map(t=>(
          <button key={t.id} onClick={()=>setTab(t.id)}
            className="relative flex items-center gap-2 px-4 py-2.5 text-[12px] font-bold whitespace-nowrap transition-all"
            style={{ borderBottom:`2px solid ${tab===t.id?C.gold:'transparent'}`, color: tab===t.id?C.goldL:C.t3 }}>
            <t.icon size={14}/> {t.label}
            {!!t.badge && t.badge>0 && <span className="ml-0.5 min-w-[16px] h-[16px] px-1 rounded-full bg-[#e05050] text-white text-[9px] font-black flex items-center justify-center">{t.badge}</span>}
          </button>
        ))}
      </div>

      {/* ════════ RESUMEN ════════ */}
      {tab==='resumen' && (
        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            {[
              { l:'Programados hoy', v:turnosHoy.length, c:C.blue },
              { l:'Presentes', v:presentes, c:C.green },
              { l:'Llegadas tarde', v:tarde, c:C.gold },
              { l:'Ausentes', v:ausentes, c:C.red },
              { l:'Cobertura hoy', v:`${coberturaHoy}%`, c:C.green },
              { l:'Novedades pend.', v:novPendientes, c:C.gold },
            ].map((k,i)=>(
              <div key={i} className="rounded-xl p-3 border" style={{background:C.card, borderColor:C.border}}>
                <div className="text-[10px] uppercase tracking-wider" style={{color:C.t3}}>{k.l}</div>
                <div className="font-['Syne'] text-[26px] font-black" style={{color:k.c}}>{k.v}</div>
              </div>
            ))}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="rounded-xl p-4 border" style={{background:C.card, borderColor:C.border}}>
              <div className="text-[11px] uppercase tracking-wider mb-1" style={{color:C.t3}}>Costo laboral · semana visible</div>
              <div className="font-['Syne'] text-[28px] font-black" style={{color:C.goldL}}>{cop(costoSemana)}</div>
              <div className="text-[11px] mt-1" style={{color:C.t2}}>{turnos.length} turnos programados · {empleados.length} empleados activos</div>
            </div>
            <div className="rounded-xl p-4 border" style={{background:C.card, borderColor:C.border}}>
              <div className="text-[11px] uppercase tracking-wider mb-2" style={{color:C.t3}}>Estado del ciclo (PRD)</div>
              <div className="flex flex-col gap-1.5 text-[12px]">
                <CicloRow ok label="Horarios + publicación + versión"/>
                <CicloRow ok label="Asistencia (check-in/out tablet kiosk)"/>
                <CicloRow ok label="Novedades con aprobación + auditoría"/>
                <CicloRow ok label="Preliquidación (ordinarias, recargos, extras)"/>
                <CicloRow label="Forecast IA + optimizador (fase avanzada)"/>
                <CicloRow label="Biometría real + multipaís (fase avanzada)"/>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ════════ HORARIOS ════════ */}
      {tab==='horarios' && (
        <div>
          <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <button onClick={()=>setWeekBase(addDays(weekStart,-7))} className="w-8 h-8 rounded-lg border flex items-center justify-center" style={{borderColor:C.border,color:C.t2}}><ChevronLeft size={16}/></button>
              <div className="text-[13px] font-bold px-2">{weekStart.toLocaleDateString('es-CO',{day:'2-digit',month:'short'})} – {addDays(weekStart,6).toLocaleDateString('es-CO',{day:'2-digit',month:'short'})}</div>
              <button onClick={()=>setWeekBase(addDays(weekStart,7))} className="w-8 h-8 rounded-lg border flex items-center justify-center" style={{borderColor:C.border,color:C.t2}}><ChevronRight size={16}/></button>
              <button onClick={()=>setWeekBase(startOfWeek(new Date()))} className="text-[11px] px-2 py-1 rounded-lg border" style={{borderColor:C.border,color:C.t2}}>Hoy</button>
            </div>
            <button onClick={publicarSemana} className="px-3 py-2 rounded-lg text-[12px] font-black flex items-center gap-2" style={{background:C.gold,color:'#000'}}>
              <CheckCircle2 size={15}/> Publicar semana
            </button>
          </div>
          <div className="overflow-x-auto rounded-xl border" style={{borderColor:C.border}}>
            <table className="w-full border-collapse" style={{minWidth:900}}>
              <thead>
                <tr style={{background:C.card2}}>
                  <th className="text-left text-[10px] uppercase p-2 sticky left-0 z-10" style={{color:C.t3, background:C.card2, minWidth:160}}>Empleado</th>
                  {weekDays.map((d,i)=>(
                    <th key={i} className="text-[10px] uppercase p-2 text-center" style={{color: ymd(d)===hoy?C.goldL:C.t3, minWidth:110}}>
                      {DIAS[i]} <span style={{color:C.t3}}>{d.getDate()}</span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {empleados.map(e=>(
                  <tr key={e.id} style={{borderTop:`1px solid ${C.border}`}}>
                    <td className="p-2 sticky left-0 z-10" style={{background:C.card}}>
                      <div className="text-[12px] font-bold" style={{color:C.t1}}>{e.nombre_completo}</div>
                      <div className="text-[10px]" style={{color:C.t3}}>{e.cargo_display||e.rol}</div>
                    </td>
                    {weekDays.map((d,i)=>{
                      const fecha=ymd(d);
                      const cell=turnos.filter(t=>t.empleado_id===e.id && t.fecha===fecha);
                      return (
                        <td key={i} className="p-1 align-top" style={{background:C.bg, height:64}}>
                          <div className="flex flex-col gap-1">
                            {cell.map(t=>{ const m=tipoMeta(t.tipo_turno); return (
                              <button key={t.id} onClick={()=>eliminarTurno(t)} title="Click para eliminar"
                                className="text-left rounded-md px-1.5 py-1 group" style={{background:`${m.color}1f`, border:`1px solid ${m.color}55`}}>
                                <div className="text-[10px] font-bold flex items-center justify-between" style={{color:m.color}}>
                                  <span>{hhmm(t.hora_inicio)}–{hhmm(t.hora_fin)}</span>
                                  {t.confirmado && <Check size={10}/>}
                                </div>
                                <div className="text-[8px] truncate" style={{color:C.t2}}>{m.label}{t.publicado?'':' ·draft'}</div>
                              </button>
                            ); })}
                            <button onClick={()=>setShiftModal({empId:e.id, fecha})} className="text-[10px] rounded-md py-0.5 opacity-40 hover:opacity-100" style={{border:`1px dashed ${C.border}`, color:C.t2}}>+ turno</button>
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex flex-wrap gap-2 mt-3">
            {TIPOS_TURNO.map(t=>(<span key={t.id} className="text-[9px] px-2 py-0.5 rounded-full" style={{background:`${t.color}1f`,color:t.color,border:`1px solid ${t.color}55`}}>{t.label}</span>))}
          </div>
        </div>
      )}

      {/* ════════ ASISTENCIA (kiosk) ════════ */}
      {tab==='asistencia' && (
        <div>
          <div className="rounded-xl border p-3 mb-4 flex items-center gap-3" style={{borderColor:C.border, background:C.card}}>
            <Clock size={18} className="text-[#3dba6f]"/>
            <div>
              <div className="text-[12px] font-bold">Tablet Kiosk · {new Date().toLocaleDateString('es-CO',{weekday:'long',day:'2-digit',month:'long'})}</div>
              <div className="text-[10px]" style={{color:C.t3}}>Registro de entrada/salida del roster de hoy. Cada evento queda auditado.</div>
            </div>
          </div>
          {turnosHoy.length===0 && <div className="text-center py-12 text-[12px]" style={{color:C.t3}}>No hay turnos programados para hoy en esta semana.</div>}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {turnosHoy.map(t=>{
              const e=empById[t.empleado_id]; if(!e) return null;
              const a=asistencia.find(x=>x.staff_id===e.staff_nexum_id);
              const m=tipoMeta(t.tipo_turno);
              return (
                <div key={t.id} className="rounded-xl border p-3 flex items-center gap-3" style={{borderColor:C.border, background:C.card}}>
                  <div className="w-9 h-9 rounded-full flex items-center justify-center text-[11px] font-black" style={{background:`${m.color}22`,color:m.color}}>{e.avatar_iniciales||e.nombre_completo?.slice(0,2)}</div>
                  <div className="flex-1 min-w-0">
                    <div className="text-[12px] font-bold truncate">{e.nombre_completo}</div>
                    <div className="text-[10px]" style={{color:C.t3}}>{hhmm(t.hora_inicio)}–{hhmm(t.hora_fin)} · {m.label}</div>
                    {a && <AsisChip a={a}/>}
                  </div>
                  {!a && (
                    <div className="flex gap-1">
                      <button onClick={()=>checkIn(t)} className="px-2.5 py-2 rounded-lg text-[11px] font-bold flex items-center gap-1" style={{background:`${C.green}22`,color:C.green,border:`1px solid ${C.green}55`}}><LogIn size={13}/> Entrada</button>
                      <button onClick={()=>marcarNoShow(t)} className="px-2 py-2 rounded-lg text-[11px] font-bold" style={{background:`${C.red}18`,color:C.red,border:`1px solid ${C.red}44`}} title="No-show"><Ban size={13}/></button>
                    </div>
                  )}
                  {a && !a.hora_salida_real && a.estado!=='no_show' && (
                    <button onClick={()=>checkOut(a)} className="px-2.5 py-2 rounded-lg text-[11px] font-bold flex items-center gap-1" style={{background:`${C.blue}22`,color:C.blue,border:`1px solid ${C.blue}55`}}><LogOut size={13}/> Salida</button>
                  )}
                  {a && a.hora_salida_real && <span className="text-[11px] font-bold" style={{color:C.green}}>{a.horas_reales}h ✓</span>}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ════════ NOVEDADES ════════ */}
      {tab==='novedades' && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <div className="text-[12px]" style={{color:C.t2}}>{novedades.length} novedades · {novPendientes} pendientes de aprobación</div>
            <button onClick={()=>setNovModal(true)} className="px-3 py-2 rounded-lg text-[12px] font-black flex items-center gap-2" style={{background:C.gold,color:'#000'}}><Plus size={15}/> Nueva novedad</button>
          </div>
          <div className="flex flex-col gap-2">
            {novedades.length===0 && <div className="text-center py-12 text-[12px]" style={{color:C.t3}}>Sin novedades registradas.</div>}
            {novedades.map(n=>{
              const meta=novedadMeta(n.tipo);
              const estC = n.estado==='aprobada'?C.green : n.estado==='rechazada'?C.red : C.gold;
              return (
                <div key={n.id} className="rounded-xl border p-3 flex items-center gap-3" style={{borderColor:C.border, background:C.card}}>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-[12px] font-bold">{n.empleado_nombre||'—'}</span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full" style={{background:`${C.blue}1f`,color:C.blue}}>{meta.label}</span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full uppercase" style={{background:`${estC}1f`,color:estC}}>{n.estado}</span>
                    </div>
                    <div className="text-[10px] mt-0.5" style={{color:C.t3}}>
                      {n.fecha_inicio||''}{n.fecha_fin&&n.fecha_fin!==n.fecha_inicio?` → ${n.fecha_fin}`:''}
                      {n.dias?` · ${n.dias} día(s)`:''}{n.horas?` · ${n.horas} h`:''}{n.valor?` · ${cop(n.valor)}`:''}
                      {n.motivo?` · ${n.motivo}`:''}
                    </div>
                  </div>
                  {n.estado==='enviada' && (
                    <div className="flex gap-1">
                      <button onClick={()=>aprobarNovedad(n,true)} className="px-2.5 py-1.5 rounded-lg text-[11px] font-bold flex items-center gap-1" style={{background:`${C.green}22`,color:C.green}}><Check size={13}/> Aprobar</button>
                      <button onClick={()=>aprobarNovedad(n,false)} className="px-2.5 py-1.5 rounded-lg text-[11px] font-bold flex items-center gap-1" style={{background:`${C.red}18`,color:C.red}}><X size={13}/> Rechazar</button>
                    </div>
                  )}
                  {n.estado!=='enviada' && <span className="text-[10px]" style={{color:C.t3}}>{n.aprobado_por||''}</span>}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ════════ PRELIQUIDACIÓN ════════ */}
      {tab==='preliquidacion' && (
        <div>
          <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
            <div className="text-[12px]" style={{color:C.t2}}>Periodo: {weekStart.toLocaleDateString('es-CO',{day:'2-digit',month:'short'})} – {addDays(weekStart,6).toLocaleDateString('es-CO',{day:'2-digit',month:'short'})} · valor hora = salario / {HORAS_MES}h</div>
            <div className="text-[13px] font-black" style={{color:C.goldL}}>Costo periodo: {cop(costoPeriodo)}</div>
          </div>
          <div className="overflow-x-auto rounded-xl border" style={{borderColor:C.border}}>
            <table className="w-full border-collapse text-[12px]" style={{minWidth:760}}>
              <thead><tr style={{background:C.card2, color:C.t3}}>
                {['Empleado','H. ord','Recargo noct','Recargo dom/fest','Extras','Deducciones','Devengado est.'].map((h,i)=>(
                  <th key={i} className={`p-2 text-[10px] uppercase ${i===0?'text-left':'text-right'}`}>{h}</th>
                ))}
              </tr></thead>
              <tbody>
                {preliq.map(r=>(
                  <tr key={r.emp.id} style={{borderTop:`1px solid ${C.border}`}}>
                    <td className="p-2"><div className="font-bold">{r.emp.nombre_completo}</div><div className="text-[10px]" style={{color:C.t3}}>{r.emp.cargo_display||r.emp.rol}</div></td>
                    <td className="p-2 text-right">{r.hOrd.toFixed(1)}h</td>
                    <td className="p-2 text-right">{r.hNoct>0?<span style={{color:C.gold}}>{cop(r.valNoct)}</span>:<span style={{color:C.t3}}>—</span>}</td>
                    <td className="p-2 text-right">{r.hDom>0?<span style={{color:C.gold}}>{cop(r.valDom)}</span>:<span style={{color:C.t3}}>—</span>}</td>
                    <td className="p-2 text-right">{r.extrasVal>0?<span style={{color:C.green}}>{cop(r.extrasVal)}</span>:<span style={{color:C.t3}}>—</span>}</td>
                    <td className="p-2 text-right">{r.deducc>0?<span style={{color:C.red}}>-{cop(r.deducc)}</span>:<span style={{color:C.t3}}>—</span>}</td>
                    <td className="p-2 text-right font-black" style={{color:C.goldL}}>{cop(r.devengado)}</td>
                  </tr>
                ))}
                {preliq.length===0 && <tr><td colSpan={7} className="p-8 text-center" style={{color:C.t3}}>Sin turnos en el periodo. Programa horarios para ver la preliquidación.</td></tr>}
              </tbody>
            </table>
          </div>
          <p className="text-[10px] mt-2" style={{color:C.t3}}>Cálculo demo trazable a turnos + novedades aprobadas. Recargos parametrizables (noct {Math.round(RECARGO_NOCTURNO*100)}% · dom/fest {Math.round(RECARGO_DOMINICAL*100)}% · extra {Math.round(RECARGO_EXTRA*100)}%). No reemplaza revisión laboral formal.</p>
        </div>
      )}

      {tab==='ia' && <IATurnoOptimo restauranteId={REST_ID} empleados={empleados} turnos={turnos}/>}

      {/* Modal nuevo turno */}
      {shiftModal && <ShiftModal empleado={empById[shiftModal.empId]} fecha={shiftModal.fecha} complejoId={COMPLEJO_ID} onClose={()=>setShiftModal(null)} onSaved={(msg)=>{ setShiftModal(null); showToast(msg); logAudit('turno.creado','turnos',{empleado_id:shiftModal.empId, fecha:shiftModal.fecha}); cargar(); }} />}
      {/* Modal nueva novedad */}
      {novModal && <NovedadModal empleados={empleados} userName={userName} onClose={()=>setNovModal(false)} onSaved={(msg)=>{ setNovModal(false); showToast(msg); }} />}

      {toast && <div className="fixed bottom-6 left-1/2 -translate-x-1/2 px-5 py-2.5 rounded-lg text-[13px] z-[9999] shadow-2xl" style={{background:'#222',border:`1px solid ${C.border}`,color:C.t1}}>{toast}</div>}
    </div>
  );
}

function CicloRow({label, ok}:{label:string, ok?:boolean}){
  return (
    <div className="flex items-center gap-2">
      {ok ? <CheckCircle2 size={14} className="text-[#3dba6f]"/> : <Clock size={14} className="text-[#606060]"/>}
      <span style={{color: ok?'#d0d0d0':'#606060'}}>{label}</span>
    </div>
  );
}

function AsisChip({a}:{a:any}){
  const map:any = { presente:{c:'#3dba6f',l:'Presente'}, tarde:{c:'#d4943a',l:`Tarde ${a.minutos_tarde}m`}, no_show:{c:'#e05050',l:'No-show'} };
  const m = map[a.estado]||{c:'#606060',l:a.estado};
  return <span className="inline-block text-[9px] mt-0.5 px-1.5 py-0.5 rounded-full" style={{background:`${m.c}1f`,color:m.c}}>{m.l}{a.hora_entrada_real?` · ${a.hora_entrada_real.slice(0,5)}`:''}</span>;
}

// ── Modal: crear turno ──
function ShiftModal({empleado, fecha, complejoId, onClose, onSaved}:{empleado:any, fecha:string, complejoId:number, onClose:()=>void, onSaved:(m:string)=>void}){
  const [ini,setIni]=useState('17:00');
  const [fin,setFin]=useState('23:00');
  const [tipo,setTipo]=useState('servicio');
  const [nota,setNota]=useState('');
  const [saving,setSaving]=useState(false);
  const [error,setError]=useState<string|null>(null);
  const guardar = async ()=>{
    setSaving(true);
    setError(null);
    try {
      const horas = shiftHours(ini+':00', fin+':00');
      const { error: insErr } = await supabase.from('turnos').insert({ empleado_id:empleado.id, complejo_id:complejoId, fecha, hora_inicio:ini+':00', hora_fin:fin+':00', estado:'programado', tipo_turno:tipo, horas_trabajadas:horas, nota, confirmado:false, publicado:false });
      if (insErr) throw insErr;
      onSaved(`✓ Turno ${ini}–${fin} · ${empleado.nombre_completo}`);
    } catch (e:any) {
      setError(e?.message || 'No se pudo guardar el turno');
    } finally {
      setSaving(false);
    }
  };
  return (
    <div className="fixed inset-0 bg-black/80 z-[700] flex items-center justify-center p-4" onClick={e=>{ if(e.target===e.currentTarget) onClose(); }}>
      <div className="rounded-2xl w-full max-w-[380px] p-5" style={{background:C.card2, border:`1px solid ${C.border}`}}>
        <div className="flex items-center justify-between mb-3">
          <div><div className="text-[14px] font-black">Nuevo turno</div><div className="text-[11px]" style={{color:C.t2}}>{empleado?.nombre_completo} · {fecha}</div></div>
          <button onClick={onClose} className="w-8 h-8 rounded-full flex items-center justify-center" style={{background:C.bg,border:`1px solid ${C.border}`,color:C.t2}}><X size={16}/></button>
        </div>
        <div className="flex gap-2 mb-3">
          <label className="flex-1 text-[11px]" style={{color:C.t2}}>Inicio<input type="time" value={ini} onChange={e=>setIni(e.target.value)} className="w-full mt-1 px-2 py-2 rounded-lg text-[13px]" style={{background:C.bg,border:`1px solid ${C.border}`,color:C.t1}}/></label>
          <label className="flex-1 text-[11px]" style={{color:C.t2}}>Fin<input type="time" value={fin} onChange={e=>setFin(e.target.value)} className="w-full mt-1 px-2 py-2 rounded-lg text-[13px]" style={{background:C.bg,border:`1px solid ${C.border}`,color:C.t1}}/></label>
        </div>
        <div className="text-[11px] mb-1" style={{color:C.t2}}>Tipo de turno</div>
        <div className="grid grid-cols-2 gap-1.5 mb-3">
          {TIPOS_TURNO.map(t=>(
            <button key={t.id} onClick={()=>setTipo(t.id)} className="px-2 py-1.5 rounded-lg text-[10px] font-bold text-left" style={{background: tipo===t.id?`${t.color}22`:C.bg, border:`1px solid ${tipo===t.id?t.color:C.border}`, color: tipo===t.id?t.color:C.t2}}>{t.label}</button>
          ))}
        </div>
        <input value={nota} onChange={e=>setNota(e.target.value)} placeholder="Nota (opcional)" className="w-full px-2 py-2 rounded-lg text-[12px] mb-3" style={{background:C.bg,border:`1px solid ${C.border}`,color:C.t1}}/>
        {error && <div className="text-[11px] mb-2 px-3 py-2 rounded-lg" style={{background:'rgba(255,82,82,0.12)',border:'1px solid rgba(255,82,82,0.30)',color:'#ff7878'}}>⚠ {error}</div>}
        <button onClick={guardar} disabled={saving} className="w-full py-2.5 rounded-xl text-[13px] font-black flex items-center justify-center gap-2" style={{background:C.gold,color:'#000'}}>{saving?<Loader2 size={15} className="animate-spin"/>:<Plus size={15}/>} Crear turno</button>
      </div>
    </div>
  );
}

// ── Modal: crear novedad ──
function NovedadModal({empleados, userName, onClose, onSaved}:{empleados:any[], userName:string, onClose:()=>void, onSaved:(m:string)=>void}){
  const [empId,setEmpId]=useState<number|''>('');
  const [tipo,setTipo]=useState('incapacidad');
  const [ini,setIni]=useState('');
  const [fin,setFin]=useState('');
  const [horas,setHoras]=useState('');
  const [valor,setValor]=useState('');
  const [motivo,setMotivo]=useState('');
  const [saving,setSaving]=useState(false);
  const meta = novedadMeta(tipo);
  const usaHoras = tipo==='hora_extra';
  const usaValor = tipo==='bonificacion';
  const usaDias = !usaHoras && !usaValor;
  const guardar = async ()=>{
    if(!empId){ return; }
    setSaving(true);
    const emp = empleados.find(e=>e.id===empId);
    let dias:number|null=null;
    if(usaDias && ini && fin){ const d=(new Date(fin+'T12:00').getTime()-new Date(ini+'T12:00').getTime())/86400000; dias=Math.max(1,Math.round(d)+1); }
    else if(usaDias && ini){ dias=1; }
    await supabase.from('workforce_novedades').insert({
      restaurante_id:REST_ID, empleado_id:empId, empleado_nombre:emp?.nombre_completo, tipo, impacto_pago:meta.impacto,
      fecha_inicio:ini||null, fecha_fin:fin||ini||null, dias, horas:usaHoras?Number(horas)||null:null, valor:usaValor?Number(valor)||null:null,
      estado:'enviada', motivo, creado_por:userName,
    });
    setSaving(false);
    onSaved('✓ Novedad enviada para aprobación');
  };
  return (
    <div className="fixed inset-0 bg-black/80 z-[700] flex items-center justify-center p-4" onClick={e=>{ if(e.target===e.currentTarget) onClose(); }}>
      <div className="rounded-2xl w-full max-w-[400px] p-5" style={{background:C.card2, border:`1px solid ${C.border}`}}>
        <div className="flex items-center justify-between mb-3">
          <div className="text-[14px] font-black">Nueva novedad laboral</div>
          <button onClick={onClose} className="w-8 h-8 rounded-full flex items-center justify-center" style={{background:C.bg,border:`1px solid ${C.border}`,color:C.t2}}><X size={16}/></button>
        </div>
        <div className="text-[11px] mb-1" style={{color:C.t2}}>Empleado</div>
        <select value={empId} onChange={e=>setEmpId(e.target.value?Number(e.target.value):'')} className="w-full px-2 py-2 rounded-lg text-[13px] mb-3" style={{background:C.bg,border:`1px solid ${C.border}`,color:C.t1}}>
          <option value="">Selecciona…</option>
          {empleados.map(e=><option key={e.id} value={e.id}>{e.nombre_completo}</option>)}
        </select>
        <div className="text-[11px] mb-1" style={{color:C.t2}}>Tipo</div>
        <div className="grid grid-cols-2 gap-1.5 mb-3">
          {TIPOS_NOVEDAD.map(t=>(<button key={t.id} onClick={()=>setTipo(t.id)} className="px-2 py-1.5 rounded-lg text-[10px] font-bold text-left" style={{background:tipo===t.id?`${C.blue}22`:C.bg,border:`1px solid ${tipo===t.id?C.blue:C.border}`,color:tipo===t.id?C.blue:C.t2}}>{t.label}</button>))}
        </div>
        {usaDias && (
          <div className="flex gap-2 mb-3">
            <label className="flex-1 text-[11px]" style={{color:C.t2}}>Desde<input type="date" value={ini} onChange={e=>setIni(e.target.value)} className="w-full mt-1 px-2 py-2 rounded-lg text-[13px]" style={{background:C.bg,border:`1px solid ${C.border}`,color:C.t1}}/></label>
            <label className="flex-1 text-[11px]" style={{color:C.t2}}>Hasta<input type="date" value={fin} onChange={e=>setFin(e.target.value)} className="w-full mt-1 px-2 py-2 rounded-lg text-[13px]" style={{background:C.bg,border:`1px solid ${C.border}`,color:C.t1}}/></label>
          </div>
        )}
        {usaHoras && <label className="block text-[11px] mb-3" style={{color:C.t2}}>Horas extra<input type="number" value={horas} onChange={e=>setHoras(e.target.value)} className="w-full mt-1 px-2 py-2 rounded-lg text-[13px]" style={{background:C.bg,border:`1px solid ${C.border}`,color:C.t1}}/></label>}
        {usaValor && <label className="block text-[11px] mb-3" style={{color:C.t2}}>Valor bonificación<input type="number" value={valor} onChange={e=>setValor(e.target.value)} className="w-full mt-1 px-2 py-2 rounded-lg text-[13px]" style={{background:C.bg,border:`1px solid ${C.border}`,color:C.t1}}/></label>}
        <input value={motivo} onChange={e=>setMotivo(e.target.value)} placeholder="Motivo / soporte" className="w-full px-2 py-2 rounded-lg text-[12px] mb-3" style={{background:C.bg,border:`1px solid ${C.border}`,color:C.t1}}/>
        <button onClick={guardar} disabled={saving||!empId} className="w-full py-2.5 rounded-xl text-[13px] font-black flex items-center justify-center gap-2 disabled:opacity-40" style={{background:C.gold,color:'#000'}}>{saving?<Loader2 size={15} className="animate-spin"/>:<FileText size={15}/>} Enviar novedad</button>
        <p className="text-[10px] mt-2" style={{color:C.t3}}>Queda en estado “enviada”. No impacta nómina hasta ser aprobada (PRD §8).</p>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════
// IA · TURNO ÓPTIMO
// Analiza los últimos 90 días de cobros_trazabilidad y ranking de meseros
// para sugerir cuántas personas necesitas por día/hora y a quién asignar.
// ═══════════════════════════════════════════════════════════════════════
function IATurnoOptimo({ restauranteId, empleados, turnos }: { restauranteId: number; empleados: any[]; turnos: any[] }) {
  const [loading, setLoading] = React.useState(true);
  const [datos, setDatos] = React.useState<{
    porDia: Record<number, { vol: number; tickets: number }>;
    porHora: Record<string, number>;
    topMeseros: { nombre: string; ventas: number; tickets: number; ticketProm: number }[];
    diasAnalizados: number;
  }>({ porDia: {}, porHora: {}, topMeseros: [], diasAnalizados: 0 });

  React.useEffect(() => {
    (async () => {
      setLoading(true);
      const hace90 = new Date(Date.now() - 90 * 86400000).toISOString();
      const { data } = await supabase.from('cobros_trazabilidad')
        .select('total,mesero,created_at')
        .eq('restaurante_id', restauranteId)
        .gte('created_at', hace90);
      const rows = data || [];
      const porDia: Record<number, { vol: number; tickets: number }> = {};
      const porHora: Record<string, number> = {};
      const porMesero: Record<string, { ventas: number; tickets: number }> = {};
      const fechasUnicas = new Set<string>();
      rows.forEach((r:any) => {
        const d = new Date(r.created_at);
        const dia = d.getDay(); // 0=domingo, 6=sábado
        const hora = `${String(d.getHours()).padStart(2,'0')}:00`;
        const total = Number(r.total || 0);
        if (!porDia[dia]) porDia[dia] = { vol: 0, tickets: 0 };
        porDia[dia].vol += total;
        porDia[dia].tickets++;
        porHora[hora] = (porHora[hora] || 0) + total;
        fechasUnicas.add(d.toISOString().split('T')[0]);
        if (r.mesero) {
          if (!porMesero[r.mesero]) porMesero[r.mesero] = { ventas: 0, tickets: 0 };
          porMesero[r.mesero].ventas += total;
          porMesero[r.mesero].tickets++;
        }
      });
      const topMeseros = Object.entries(porMesero)
        .map(([nombre, v]) => ({ nombre, ventas: v.ventas, tickets: v.tickets, ticketProm: v.tickets > 0 ? v.ventas / v.tickets : 0 }))
        .sort((a, b) => b.ventas - a.ventas).slice(0, 10);
      setDatos({ porDia, porHora, topMeseros, diasAnalizados: fechasUnicas.size });
      setLoading(false);
    })();
  }, [restauranteId]);

  const DIAS = ['Dom','Lun','Mar','Mié','Jue','Vie','Sáb'];
  const fmt = (n: number) => `$${Math.round(n).toLocaleString('es-CO')}`;
  const fmtK = (n: number) => n >= 1000000 ? `$${(n/1000000).toFixed(1)}M` : n >= 1000 ? `$${Math.round(n/1000)}K` : `$${Math.round(n)}`;

  // Recomendación de staff por día: 1 mesero cada $300k de venta promedio diaria
  const ventaPromDiaria = (dia: number): number => {
    const d = datos.porDia[dia];
    if (!d) return 0;
    // dividir por número de veces que apareció ese día en 90 días (≈13 semanas)
    return d.vol / Math.max(1, Math.floor(datos.diasAnalizados / 7));
  };
  const recomMeseros = (dia: number): number => Math.max(2, Math.ceil(ventaPromDiaria(dia) / 300000));

  const maxVolDia = Math.max(...Object.values(datos.porDia).map(d => d.vol), 1);
  const horasOrdenadas = Object.entries(datos.porHora).sort((a,b) => a[0].localeCompare(b[0]));
  const maxVolHora = Math.max(...Object.values(datos.porHora), 1);

  // Detectar 3 horas pico
  const horasPico = [...horasOrdenadas].sort((a,b) => b[1] - a[1]).slice(0, 3).map(h => h[0]);

  if (loading) {
    return <div className="flex items-center justify-center py-16 text-[#a0a0a0]"><Loader2 className="animate-spin mr-2" size={20}/> Analizando 90 días de operación…</div>;
  }

  if (datos.diasAnalizados === 0) {
    return (
      <div className="text-center py-16">
        <Sparkles className="mx-auto mb-3 text-[#d4943a]" size={36}/>
        <div className="font-['Syne'] text-[16px] font-black mb-2">Sin data suficiente</div>
        <div className="text-[12px] text-[#a0a0a0] max-w-[400px] mx-auto">
          La IA necesita al menos unas cuentas cerradas en cobros_trazabilidad para
          calcular días-tipo y horas pico. Vuelve cuando el POS tenga algunos días
          de operación.
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-baseline gap-3 mb-2">
        <Sparkles size={22} className="text-[#d4943a]"/>
        <div>
          <h2 className="font-['Syne'] text-[18px] font-black tracking-tight">Recomendación de turno óptimo</h2>
          <p className="text-[11px] text-[#606060]">Basada en <strong className="text-white">{datos.diasAnalizados} días</strong> de operación · {Object.values(datos.porDia).reduce((s,d)=>s+d.tickets,0)} cuentas analizadas</p>
        </div>
      </div>

      {/* Recomendación por día de semana */}
      <div className="bg-[#1c1c24] border border-[#2a2a2a] rounded-2xl p-5">
        <div className="text-[10px] font-bold uppercase tracking-wider text-[#a0a0a0] mb-4">📅 Personal recomendado por día</div>
        <div className="grid grid-cols-7 gap-2">
          {DIAS.map((d, i) => {
            const vol = ventaPromDiaria(i);
            const n = recomMeseros(i);
            const pct = (vol / (maxVolDia / Math.max(1, Math.floor(datos.diasAnalizados / 7)))) * 100;
            const color = n >= 6 ? '#e05050' : n >= 4 ? '#FFB547' : '#3dba6f';
            return (
              <div key={i} className="bg-[#0f0f14] border border-[#2a2a2a] rounded-xl p-3 text-center">
                <div className="text-[10px] text-[#7a7a8c] font-bold uppercase mb-1">{d}</div>
                <div className="font-['Syne'] text-[26px] font-black leading-none" style={{color}}>{n}</div>
                <div className="text-[9px] text-[#7a7a8c] mt-0.5">meseros</div>
                <div className="h-1 rounded-full bg-[#1a1a24] mt-2 overflow-hidden">
                  <div style={{width:`${Math.min(pct,100)}%`,height:'100%',background:color}}/>
                </div>
                <div className="text-[10px] text-[#a0a0a0] mt-2">{fmtK(vol)}</div>
              </div>
            );
          })}
        </div>
        <div className="text-[10px] text-[#606060] mt-3">
          ⚙️ Regla: 1 mesero por cada $300.000 de venta promedio · mínimo 2.
        </div>
      </div>

      {/* Horas pico */}
      <div className="bg-[#1c1c24] border border-[#2a2a2a] rounded-2xl p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="text-[10px] font-bold uppercase tracking-wider text-[#a0a0a0]">⏰ Distribución por hora</div>
          <div className="text-[10px] text-[#FFB547]">Pico: {horasPico.join(' · ')}</div>
        </div>
        <div className="flex items-end gap-1 h-[120px]">
          {horasOrdenadas.map(([h, v]) => {
            const pct = (v / maxVolHora) * 100;
            const esPico = horasPico.includes(h);
            return (
              <div key={h} className="flex-1 flex flex-col items-center justify-end" title={`${h} — ${fmt(v)}`}>
                <div className="text-[9px] text-[#7a7a8c] mb-1">{fmtK(v)}</div>
                <div style={{
                  width:'100%',
                  height:`${pct}%`,
                  background: esPico ? 'linear-gradient(to top, #FFB547, #d4943a)' : '#2a2a3a',
                  borderRadius:'4px 4px 0 0',
                  minHeight: 3,
                  transition:'all .3s',
                }}/>
                <div className="text-[9px] text-[#a0a0a0] mt-1">{h.slice(0,2)}</div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Top meseros con recomendación de asignación */}
      <div className="bg-[#1c1c24] border border-[#2a2a2a] rounded-2xl p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="text-[10px] font-bold uppercase tracking-wider text-[#a0a0a0]">🏆 Top meseros · asignación recomendada</div>
          <div className="text-[10px] text-[#606060]">Ordenados por venta total 90d</div>
        </div>
        <div className="space-y-1.5">
          {datos.topMeseros.map((m, i) => {
            const empMatch = empleados.find((e:any) => (e.nombre_completo || '').toLowerCase().includes(m.nombre.toLowerCase().split(' ')[0]));
            const recom = i < 2 ? '🌟 Asignar a viernes/sábado noche'
              : i < 5 ? '✓ Núcleo regular del turno'
              : '🎯 Refuerzo o entrenamiento';
            return (
              <div key={m.nombre} className="flex items-center gap-3 px-3 py-2.5 rounded-lg bg-[#0f0f14] border border-[#1a1a24]">
                <div className="w-7 h-7 rounded-lg flex items-center justify-center font-['Syne'] font-black text-[12px]"
                  style={{background: i<2?'#FFB54720':i<5?'#22d3ee20':'#5a5a6420', color: i<2?'#FFB547':i<5?'#22d3ee':'#a0a0a0'}}>
                  {i+1}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-[13px] font-bold truncate">{empMatch?.nombre_completo || m.nombre}</div>
                  <div className="text-[10px] text-[#606060]">{m.tickets} cuentas · Ticket prom {fmt(m.ticketProm)}</div>
                </div>
                <div className="text-right">
                  <div className="font-['Syne'] text-[14px] font-black text-[#3dba6f]">{fmtK(m.ventas)}</div>
                  <div className="text-[9px] text-[#a0a0a0]">{recom}</div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Resumen ejecutivo */}
      <div className="rounded-2xl p-5" style={{background:'linear-gradient(135deg, rgba(155,114,255,0.08), rgba(74,158,255,0.04))', border:'1px solid rgba(155,114,255,0.25)'}}>
        <div className="flex items-baseline gap-2 mb-3">
          <Sparkles size={14} className="text-[#9b72ff]"/>
          <div className="text-[11px] font-bold uppercase tracking-wider text-[#9b72ff]">Plan de la semana</div>
        </div>
        <ul className="space-y-2 text-[12px] text-[#e0e0e0]">
          <li>• Días más fuertes: <strong>{DIAS.filter((_,i)=>recomMeseros(i)>=5).join(', ') || 'ninguno destacado'}</strong> → reforzar sala con {Math.max(...DIAS.map((_,i)=>recomMeseros(i)))} meseros.</li>
          <li>• Días más calmos: <strong>{DIAS.filter((_,i)=>recomMeseros(i)<=2 && (datos.porDia[i]?.vol || 0) > 0).join(', ') || 'distribución pareja'}</strong> → 2 meseros suficientes, evitar sobre-staff.</li>
          <li>• Horas pico: <strong>{horasPico.join(', ')}</strong> → tener todo el equipo en piso, evitar pausas largas.</li>
          {datos.topMeseros[0] && <li>• Top venta: <strong className="text-[#3dba6f]">{datos.topMeseros[0].nombre}</strong> ({fmtK(datos.topMeseros[0].ventas)}) → cuidar su retención y ofrecer mejores turnos.</li>}
        </ul>
      </div>
    </div>
  );
}
