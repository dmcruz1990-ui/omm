import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import { useRestaurant } from '../contexts/RestaurantContext';
import { useAuth } from '../contexts/AuthContext';
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

// ══════════════════════════════════════════════════════════════════
// Policy laboral Colombia 2026 (reforma vigente + guía Díaz Jurídico)
// 42h/sem · 168h/mes · base $7.959 hora ordinaria (SMMLV 2026)
// Multiplicadores oficiales sobre hora ordinaria
// ══════════════════════════════════════════════════════════════════
const HORAS_SEMANA_LEGAL = 42;   // semana laboral max (reforma 2024)
const HORAS_MES = 168;            // 42 × 4 — base para valor hora
const HORA_ALMUERZO = 1;          // obligatoria
const JORNADA_NORMAL = 8;         // total en planta (7 trab + 1 alm)
const MAX_EXTRAS_SEMANA = 12;
const SIMULADOR_MAX_DIAS = 15;
// Multiplicadores sobre valor hora ordinaria
const RECARGO_NOCTURNO   = 0.35;   // solo recargo
const RECARGO_DOMINICAL  = 0.80;   // solo recargo (actualizado a 2026)
const RECARGO_EXTRA      = 0.25;   // hora extra diurna sobre ordinaria
const MULT_NOCTURNA_FULL = 1.35;
const MULT_DOMINICAL     = 1.80;
const MULT_EXTRA_DIURNA  = 1.25;
const MULT_EXTRA_NOCTURNA= 1.75;
const MULT_EXTRA_DOM_DIU = 2.05;   // 80% + 25%
const MULT_EXTRA_DOM_NOC = 2.55;   // 80% + 75%

// Deducciones y parafiscales (Colombia)
const APORTE_SALUD_EMP     = 0.04;  // 4% del trabajador
const APORTE_PENSION_EMP   = 0.04;  // 4% del trabajador
const APORTE_SALUD_PATRON  = 0.085;
const APORTE_PENSION_PATRON= 0.12;
const ARL_NIVEL_II         = 0.00522;
const CESANTIAS_FACTOR     = 0.0833;
const INT_CESANTIAS_FACTOR = 0.01;
const PRIMA_FACTOR         = 0.0833;
const VACACIONES_FACTOR    = 0.0417;
const CAJA_COMPENSACION    = 0.04;
const SENA                 = 0.02;  // exonerado para algunos
const ICBF                 = 0.03;  // exonerado para algunos
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
  { id:'memorando',       label:'📋 Memorando',     impacto:'ninguno' },
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
// Horas EFECTIVAS de trabajo (descuenta la hora de alimentación si el turno >= 6h)
const horasEfectivas = (ini?:string, fin?:string) => {
  const total = shiftHours(ini, fin);
  return total >= 6 ? Math.max(0, total - HORA_ALMUERZO) : total;
};
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
  const { profile } = useAuth();
  const userRole = profile?.role || 'mesero';
  const userNombre = profile?.nombre_completo || profile?.full_name || userName;
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
      supabase.from('empleados').select('*').eq('restaurante_id',REST_ID).eq('activo',true).order('nombre_completo'),
      supabase.from('turnos').select('*').eq('complejo_id', COMPLEJO_ID).gte('fecha',weekStartStr).lte('fecha',weekEndStr),
      supabase.from('attendance').select('*').eq('fecha',hoy),
      supabase.from('workforce_novedades').select('*').eq('restaurante_id',REST_ID).order('created_at',{ascending:false}),
    ]);
    setEmpleados(emp.data||[]);
    setTurnos(tur.data||[]);
    setAsistencia(asi.data||[]);
    setNovedades(nov.data||[]);
    setLoading(false);
  }, [weekStartStr, weekEndStr, hoy, REST_ID, COMPLEJO_ID]);

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

  // ─────────────── Horas semanales por empleado (vs 42 legales) ───────
  // efectivas = total en planta - 1h almuerzo. Lo que pase de 42 = extra.
  const horasPorEmp = useMemo(() => {
    const map: Record<string|number, { planta:number; efectivas:number; base:number; extras:number; faltan:number; nTurnos:number }> = {};
    empleados.forEach(e => { map[e.id] = { planta:0, efectivas:0, base:0, extras:0, faltan:HORAS_SEMANA_LEGAL, nTurnos:0 }; });
    turnos.forEach(t => {
      if (!map[t.empleado_id]) return;
      map[t.empleado_id].planta    += shiftHours(t.hora_inicio, t.hora_fin);
      map[t.empleado_id].efectivas += horasEfectivas(t.hora_inicio, t.hora_fin);
      map[t.empleado_id].nTurnos++;
    });
    Object.values(map).forEach((s:any) => {
      s.base    = Math.min(HORAS_SEMANA_LEGAL, s.efectivas);
      s.extras  = Math.max(0, s.efectivas - HORAS_SEMANA_LEGAL);
      s.faltan  = Math.max(0, HORAS_SEMANA_LEGAL - s.efectivas);
    });
    return map;
  }, [empleados, turnos]);

  // ── Preliquidación (semana visible) + acumulado mensual ─────────
  // Desglose por tipo de recargo según guía Colombia 2026.
  const preliq = useMemo(()=>{
    return empleados.map(e=>{
      const ts = turnos.filter(t=>t.empleado_id===e.id);
      let hOrd=0, hNoct=0, hDom=0, hDomNoct=0;
      ts.forEach(t=>{
        const h = horasEfectivas(t.hora_inicio,t.hora_fin);
        const frNoct = nightFraction(t.hora_inicio, t.hora_fin);
        const esDom = esFestivo(t.fecha);
        if (esDom) {
          hDomNoct += h * frNoct;
          hDom     += h * (1 - frNoct);
        } else {
          hNoct += h * frNoct;
          hOrd  += h * (1 - frNoct);
        }
      });
      const vh = valorHora(e);
      let extrasVal=0, deducc=0, bonos=0;
      novedades.filter(n=>n.estado==='aprobada' && n.empleado_id===e.id && (!n.fecha_inicio || (n.fecha_inicio<=weekEndStr && (!n.fecha_fin || n.fecha_fin>=weekStartStr)))).forEach(n=>{
        if(n.tipo==='hora_extra') extrasVal += (Number(n.horas)||0)*vh*MULT_EXTRA_DIURNA;
        else if(n.tipo==='ausencia'||n.tipo==='permiso_no_pago') deducc += (Number(n.dias)||0)*((Number(e.salario_base)||0)/30);
        else if(n.tipo==='bonificacion') bonos += (Number(n.valor)||0);
      });
      // Valores monetarios por recargo
      const valOrd     = hOrd     * vh;
      const valNoct    = hNoct    * vh * MULT_NOCTURNA_FULL;
      const valDom     = hDom     * vh * MULT_DOMINICAL;
      const valDomNoct = hDomNoct * vh * (MULT_DOMINICAL + RECARGO_NOCTURNO);
      const totalHoras = hOrd + hNoct + hDom + hDomNoct;
      const devengado  = valOrd + valNoct + valDom + valDomNoct + extrasVal + bonos - deducc;
      // Deducciones empleado (4% salud + 4% pensión sobre devengado base)
      const baseAportes = Math.max(0, devengado - bonos);
      const deducSalud   = baseAportes * APORTE_SALUD_EMP;
      const deducPension = baseAportes * APORTE_PENSION_EMP;
      const netoEmpleado = devengado - deducSalud - deducPension;
      // Costo total empleador (devengado + parafiscales + prestaciones)
      const aportesPatrono = baseAportes * (APORTE_SALUD_PATRON + APORTE_PENSION_PATRON + ARL_NIVEL_II + CAJA_COMPENSACION);
      const provPrestaciones = baseAportes * (CESANTIAS_FACTOR + INT_CESANTIAS_FACTOR + PRIMA_FACTOR + VACACIONES_FACTOR);
      const costoEmpleador = devengado + aportesPatrono + provPrestaciones;
      return {
        emp:e,
        hOrd, hNoct, hDom, hDomNoct, totalHoras,
        valOrd, valNoct, valDom, valDomNoct,
        extrasVal, bonos, deducc,
        deducSalud, deducPension,
        devengado, netoEmpleado, costoEmpleador,
        aportesPatrono, provPrestaciones,
        turnos:ts.length
      };
    }).filter(r=>r.turnos>0 || r.devengado!==0);
  }, [empleados, turnos, novedades, weekStartStr, weekEndStr]);
  const costoPeriodo  = preliq.reduce((a,r)=>a+r.devengado,0);
  const costoPatronal = preliq.reduce((a,r)=>a+r.costoEmpleador, 0);
  const totalDeducc   = preliq.reduce((a,r)=>a+r.deducSalud+r.deducPension, 0);

  // Mensual estimado (4 semanas)
  const preliqMensual = useMemo(() => {
    return preliq.map(r => ({
      ...r,
      devengado_mes:        r.devengado * 4,
      neto_mes:             r.netoEmpleado * 4,
      costo_empleador_mes:  r.costoEmpleador * 4,
      deduc_mes:            (r.deducSalud + r.deducPension) * 4,
      cesantias_mes:        r.emp.salario_base ? r.emp.salario_base * CESANTIAS_FACTOR : 0,
      prima_mes:            r.emp.salario_base ? r.emp.salario_base * PRIMA_FACTOR : 0,
      vacac_mes:            r.emp.salario_base ? r.emp.salario_base * VACACIONES_FACTOR : 0,
    }));
  }, [preliq]);

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
    const warnings:string[] = [];
    const errors:string[] = [];
    empleados.forEach((e:any) => {
      const h = (horasPorEmp as any)[e.id];
      if (!h || h.nTurnos === 0) return;
      if (h.efectivas > HORAS_SEMANA_LEGAL + MAX_EXTRAS_SEMANA) {
        errors.push(`🚫 ${e.nombre_completo}: ${h.efectivas.toFixed(1)}h excede el tope (${HORAS_SEMANA_LEGAL}+${MAX_EXTRAS_SEMANA}h)`);
      } else if (h.extras > 0) {
        warnings.push(`⚠️ ${e.nombre_completo}: ${h.extras.toFixed(1)}h extras (requieren autorización en novedades)`);
      } else if (h.efectivas < HORAS_SEMANA_LEGAL && h.faltan > 8) {
        warnings.push(`ℹ️ ${e.nombre_completo}: ${h.faltan.toFixed(1)}h sin cubrir bajo el contrato`);
      }
    });
    const porEmpFecha:Record<string, any[]> = {};
    turnos.forEach(t => { const k=`${t.empleado_id}-${t.fecha}`; (porEmpFecha[k]=porEmpFecha[k]||[]).push(t); });
    Object.values(porEmpFecha).forEach(ts => {
      if (ts.length < 2) return;
      const sorted = [...ts].sort((a,b)=> (a.hora_inicio||'').localeCompare(b.hora_inicio||''));
      for (let i=0;i<sorted.length-1;i++) {
        if (toMin(sorted[i].hora_fin) > toMin(sorted[i+1].hora_inicio)) {
          const emp = empById[sorted[i].empleado_id];
          errors.push(`🚫 Solape en ${emp?.nombre_completo||'empleado'} (${sorted[i].fecha})`);
        }
      }
    });
    if (errors.length > 0) {
      alert(`No se puede publicar todavía:\n\n${errors.join('\n')}\n\nResolvé los conflictos primero.`);
      return;
    }
    const aviso = warnings.length > 0
      ? `Se publicarán ${ids.length} turnos con ${warnings.length} avisos:\n\n${warnings.slice(0,8).join('\n')}${warnings.length>8?`\n…y ${warnings.length-8} más`:''}\n\n¿Publicar y enviar a los empleados?`
      : `¿Publicar ${ids.length} turnos de la semana ${weekStartStr} y notificar a los empleados?`;
    if (!confirm(aviso)) return;
    await supabase.from('turnos').update({ publicado:true, estado:'publicado' }).in('id',ids);
    logAudit('horario.publicado','turnos',{semana:weekStartStr, turnos:ids.length, warnings:warnings.length});
    showToast(`✓ Horario publicado · ${ids.length} turnos · ${warnings.length} avisos`);
  };

  // Check-in / Check-out (kiosk)
  const checkIn = async (t:any)=>{
    const e = empById[t.empleado_id]; if(!e) return;
    const ahora = nowHHMMSS();
    const min = toMin(ahora) - toMin(t.hora_inicio);
    // Ventana de check-in: -15 min (anticipado) a +30 min (descuento)
    // 0-10 min late = en hora · 10-20 min = retardo · 20-30 min = retardo grave (descuenta 1h) · >30 = no-show
    let estado:'presente'|'tarde'|'no_show' = 'presente';
    let descuentoHora = 0; // horas descontadas del turno
    let etiquetaTarde = '';
    if (min > 30) {
      // Más de 30 min de tardanza → tratar como no-show (debería marcarse a mano si llega)
      estado = 'no_show';
      descuentoHora = 1;
      etiquetaTarde = '🚫 >30 min — no-show';
    } else if (min > 20) {
      estado = 'tarde';
      descuentoHora = 1; // descuento de 1 hora del salario
      etiquetaTarde = `⚠️ ${min} min — descuenta 1h`;
    } else if (min >= 10) {
      estado = 'tarde';
      etiquetaTarde = `⏱ ${min} min — retardo formal`;
    } else if (min > 0) {
      etiquetaTarde = `${min} min — en hora (margen 10 min)`;
    } else if (min < -15) {
      etiquetaTarde = `${Math.abs(min)} min de anticipación`;
    }
    const minTarde = Math.max(0, min);
    await supabase.from('attendance').insert({
      restaurante_id:REST_ID, staff_id:e.staff_nexum_id, empleado_nombre:e.nombre_completo, fecha:hoy,
      turno:`${hhmm(t.hora_inicio)}–${hhmm(t.hora_fin)}`, hora_entrada_esperada:t.hora_inicio, hora_entrada_real:ahora,
      hora_salida_esperada:t.hora_fin, minutos_tarde:minTarde, estado, presence_multiplier: descuentoHora>0?0.875:1,
    });
    // Si descuenta hora, encolarse como novedad de descuento automático
    if (descuentoHora > 0) {
      await supabase.from('workforce_novedades').insert({
        restaurante_id:REST_ID, empleado_id:e.id, tipo:'permiso_no_pago',
        fecha_inicio:hoy, fecha_fin:hoy, horas:descuentoHora, dias:0,
        motivo:`Descuento automático · llegó ${min} min tarde (>${20})`,
        estado:'pendiente', valor:0,
      });
    }
    logAudit('checkin','attendance',{empleado:e.nombre_completo, hora:ahora, minutos_tarde:minTarde, descuento:descuentoHora});
    showToast(`✓ Check-in ${e.nombre_completo.split(' ')[0]}${etiquetaTarde?` · ${etiquetaTarde}`:''}`);
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
    { id:'novedades', label:'Novedades', icon:FileText, badge:novPendientes },
    { id:'ia', label:'IA · Turno óptimo', icon:Sparkles },
    { id:'horarios', label:'Horarios', icon:Calendar },
    { id:'preliquidacion', label:'Preliquidación', icon:DollarSign },
    { id:'asistencia', label:'Asistencia', icon:Clock },
  ];

  if (loading) return <div className="flex items-center justify-center h-[60vh] text-[#a0a0a0]"><Loader2 className="animate-spin mr-2" size={20}/> Cargando workforce…</div>;

  return (
    <div className="text-left" style={{color:C.t1}}>
      {/* ══ HEADER · gradient hero con stats vivos ══ */}
      <div className="rounded-2xl p-5 mb-5 relative overflow-hidden" style={{
        background:'linear-gradient(135deg, rgba(212,148,58,0.14) 0%, rgba(155,114,255,0.10) 50%, rgba(74,158,255,0.06) 100%)',
        border:'1px solid rgba(212,148,58,0.25)',
      }}>
        <div className="absolute top-0 right-0 w-64 h-64 rounded-full opacity-20"
          style={{background:'radial-gradient(circle, rgba(212,148,58,0.6) 0%, transparent 70%)', filter:'blur(40px)'}}/>
        <div className="flex items-start gap-4 relative z-10 flex-wrap">
          <div className="w-14 h-14 rounded-2xl flex items-center justify-center" style={{background:'rgba(212,148,58,0.18)', border:'1px solid rgba(212,148,58,0.4)'}}>
            <Users size={26} className="text-[#d4943a]"/>
          </div>
          <div className="flex-1 min-w-[200px]">
            <h1 className="font-['Syne'] text-[24px] font-black tracking-tight">Workforce Intelligence</h1>
            <p className="text-[11px] uppercase tracking-[0.22em] mt-1" style={{color:'#a0a0a0'}}>
              {activeRestaurant?.name || 'OMM'} · Horarios · Asistencia · Nómina
            </p>
          </div>
          <div className="flex gap-2 flex-wrap">
            <div className="px-3 py-2 rounded-xl border flex items-baseline gap-2" style={{background:'rgba(0,0,0,0.3)',borderColor:'rgba(255,255,255,0.06)'}}>
              <span className="text-[9px] uppercase tracking-wider font-bold" style={{color:C.t3}}>Equipo</span>
              <span className="font-['Syne'] text-[18px] font-black" style={{color:C.goldL}}>{empleados.length}</span>
            </div>
            <div className="px-3 py-2 rounded-xl border flex items-baseline gap-2" style={{background:'rgba(0,0,0,0.3)',borderColor:'rgba(255,255,255,0.06)'}}>
              <span className="text-[9px] uppercase tracking-wider font-bold" style={{color:C.t3}}>Turnos sem.</span>
              <span className="font-['Syne'] text-[18px] font-black" style={{color:C.blue}}>{turnos.length}</span>
            </div>
            <div className="px-3 py-2 rounded-xl border flex items-baseline gap-2" style={{background:'rgba(0,0,0,0.3)',borderColor:'rgba(255,255,255,0.06)'}}>
              <span className="text-[9px] uppercase tracking-wider font-bold" style={{color:C.t3}}>Cobertura</span>
              <span className="font-['Syne'] text-[18px] font-black" style={{color: coberturaHoy>=80?C.green:coberturaHoy>=50?C.gold:C.red}}>{coberturaHoy}%</span>
            </div>
          </div>
        </div>
      </div>

      {/* ══ TABS · píldoras con icono + count ══ */}
      <div className="flex gap-2 mb-5 overflow-x-auto pb-1" style={{scrollbarWidth:'none'}}>
        {TABS.map(t=>{
          const active = tab===t.id;
          return (
            <button key={t.id} onClick={()=>setTab(t.id)}
              className="relative flex items-center gap-2 px-4 py-2.5 text-[12px] font-bold whitespace-nowrap rounded-xl transition-all"
              style={{
                background: active ? 'rgba(212,148,58,0.18)' : 'rgba(255,255,255,0.03)',
                border: `1px solid ${active ? 'rgba(212,148,58,0.5)' : 'rgba(255,255,255,0.06)'}`,
                color: active ? C.goldL : C.t2,
                boxShadow: active ? '0 4px 14px rgba(212,148,58,0.18)' : 'none',
              }}>
              <t.icon size={14}/> {t.label}
              {!!t.badge && t.badge>0 && <span className="ml-0.5 min-w-[18px] h-[18px] px-1.5 rounded-full bg-[#e05050] text-white text-[9px] font-black flex items-center justify-center">{t.badge}</span>}
            </button>
          );
        })}
      </div>

      {/* ════════ RESUMEN ════════ */}
      {tab==='resumen' && (
        <div className="flex flex-col gap-4">
          {/* KPIs · cards con icono lateral, color tonal y delta visual */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            {[
              { l:'Programados hoy', v:turnosHoy.length,        c:C.blue,  ico:'📅', sub:`de ${empleados.length} activos` },
              { l:'Presentes',       v:presentes,                c:C.green, ico:'✅', sub:'check-in registrado' },
              { l:'Llegadas tarde',  v:tarde,                    c:C.gold,  ico:'⏰', sub:'> 5 min late' },
              { l:'Ausentes',        v:ausentes,                 c:C.red,   ico:'❌', sub:'sin novedad aún' },
              { l:'Cobertura hoy',   v:`${coberturaHoy}%`,       c:coberturaHoy>=80?C.green:C.gold,  ico:'📊', sub:'meta 85%' },
              { l:'Novedades pend.', v:novPendientes,            c:C.gold,  ico:'📋', sub:'esperan aprobación' },
            ].map((k,i)=>(
              <div key={i} className="rounded-2xl p-3.5 border relative overflow-hidden" style={{background:C.card, borderColor:`${k.c}25`}}>
                <div className="absolute top-2 right-2 text-[18px] opacity-25">{k.ico}</div>
                <div className="text-[9px] uppercase tracking-[0.14em] font-bold" style={{color:C.t3}}>{k.l}</div>
                <div className="font-['Syne'] text-[28px] font-black mt-1" style={{color:k.c, lineHeight:1.05}}>{k.v}</div>
                <div className="text-[9px] mt-1" style={{color:C.t3}}>{k.sub}</div>
                <div className="absolute bottom-0 left-0 right-0 h-[3px]" style={{background:`linear-gradient(90deg, ${k.c}, transparent)`}}/>
              </div>
            ))}
          </div>

          {/* Costo + Ciclo · cards premium */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="rounded-2xl p-5 border relative overflow-hidden"
              style={{background:'linear-gradient(135deg, rgba(212,148,58,0.10), rgba(212,148,58,0.02))', borderColor:'rgba(212,148,58,0.25)'}}>
              <div className="flex items-baseline gap-2 mb-2">
                <DollarSign size={14} className="text-[#d4943a]"/>
                <div className="text-[10px] uppercase tracking-[0.16em] font-bold" style={{color:C.gold}}>Costo laboral · semana</div>
              </div>
              <div className="font-['Syne'] text-[32px] font-black" style={{color:C.goldL, lineHeight:1}}>{cop(costoSemana)}</div>
              <div className="text-[11px] mt-2 flex items-center gap-3 flex-wrap" style={{color:C.t2}}>
                <span>📅 {turnos.length} turnos programados</span>
                <span>👥 {empleados.length} empleados activos</span>
              </div>
              <div className="mt-3 flex items-center gap-2 text-[10px]" style={{color:C.t3}}>
                <span>Promedio / turno:</span>
                <span className="font-bold" style={{color:C.goldL}}>{turnos.length > 0 ? cop(costoSemana/turnos.length) : '—'}</span>
              </div>
            </div>

            <div className="rounded-2xl p-5 border" style={{background:C.card, borderColor:C.border}}>
              <div className="flex items-baseline gap-2 mb-3">
                <ShieldCheck size={14} className="text-[#3dba6f]"/>
                <div className="text-[10px] uppercase tracking-[0.16em] font-bold" style={{color:C.green}}>Madurez del módulo</div>
              </div>
              <div className="flex flex-col gap-2 text-[12px]">
                <CicloRow ok label="Horarios + publicación + versión"/>
                <CicloRow ok label="Asistencia (check-in/out tablet kiosk)"/>
                <CicloRow ok label="Novedades con aprobación + auditoría"/>
                <CicloRow ok label="Preliquidación (recargos noche/dominical/extra)"/>
                <CicloRow ok label="🤖 Simulador IA de turnos"/>
                <CicloRow label="Biometría real + multipaís (próximamente)"/>
              </div>
            </div>
          </div>

          {/* CTA rápido al simulador IA */}
          <div onClick={()=>setTab('ia')} className="rounded-2xl p-4 cursor-pointer transition-all hover:scale-[1.005]"
            style={{
              background:'linear-gradient(135deg, rgba(155,114,255,0.12), rgba(74,158,255,0.06))',
              border:'1px solid rgba(155,114,255,0.3)',
            }}>
            <div className="flex items-center gap-4 flex-wrap">
              <div className="w-12 h-12 rounded-xl flex items-center justify-center" style={{background:'rgba(155,114,255,0.2)', border:'1px solid rgba(155,114,255,0.4)'}}>
                <Sparkles size={22} className="text-[#9b72ff]"/>
              </div>
              <div className="flex-1 min-w-[200px]">
                <div className="font-['Syne'] text-[15px] font-black" style={{color:'#9b72ff'}}>Simulador IA de turnos · semana</div>
                <div className="text-[11px]" style={{color:C.t2}}>Analiza 90 días de operación y arma el horario completo con un click.</div>
              </div>
              <button className="px-4 py-2 rounded-xl text-[12px] font-bold" style={{background:'#9b72ff', color:'#fff'}}>
                Abrir simulador →
              </button>
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
          <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
            <div className="text-[12px]" style={{color:C.t2}}>
              <span className="font-bold" style={{color:'#FF2D78'}}>{novedades.length}</span> novedades ·
              <span className="font-bold ml-1" style={{color:C.gold}}>{novPendientes}</span> pendientes
            </div>
            <button onClick={()=>setNovModal(true)}
              className="px-4 py-2 rounded-xl text-[12px] font-black flex items-center gap-2"
              style={{background:'linear-gradient(135deg,#FF2D78,#B388FF)',color:'#fff',boxShadow:'0 6px 16px rgba(255,45,120,0.35)'}}>
              <Plus size={15}/> Nueva novedad
            </button>
          </div>
          <div className="flex flex-col gap-2">
            {novedades.length===0 && <div className="text-center py-12 text-[12px]" style={{color:C.t3}}>Sin novedades registradas.</div>}
            {novedades.map(n=>{
              const meta=novedadMeta(n.tipo);
              const estC = n.estado==='aprobada'?C.green : n.estado==='rechazada'?C.red : '#FF2D78';
              const esExtra = n.tipo === 'hora_extra';
              const esDeduccion = ['ausencia','permiso_no_pago'].includes(n.tipo);
              return (
                <div key={n.id} className="rounded-xl border p-3 flex items-center gap-3"
                  style={{borderColor: esExtra?'#FF2D7833':esDeduccion?`${C.red}33`:C.border, background:C.card}}>
                  <div className="w-9 h-9 rounded-lg flex items-center justify-center text-[16px] shrink-0"
                    style={{background: esExtra?'rgba(255,45,120,0.12)':esDeduccion?`${C.red}18`:`${C.blue}1f`, border:`1px solid ${esExtra?'#FF2D7855':esDeduccion?`${C.red}44`:`${C.blue}44`}`}}>
                    {esExtra?'⚡':esDeduccion?'➖':'📋'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-[12px] font-bold">{n.empleado_nombre||'—'}</span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full font-bold" style={{background: esExtra?'rgba(255,45,120,0.15)':esDeduccion?`${C.red}18`:`${C.blue}1f`, color: esExtra?'#FF2D78':esDeduccion?C.red:C.blue}}>{meta.label}</span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full uppercase font-bold" style={{background:`${estC}1f`,color:estC}}>{n.estado}</span>
                    </div>
                    <div className="text-[10px] mt-0.5" style={{color:C.t3}}>
                      📅 {n.fecha_inicio||'—'}{n.fecha_fin&&n.fecha_fin!==n.fecha_inicio?` → ${n.fecha_fin}`:''}
                      {n.dias?` · ${n.dias} día(s)`:''}{n.horas?` · ${n.horas}h`:''}{n.valor?` · ${cop(n.valor)}`:''}
                    </div>
                    {n.motivo && <div className="text-[10px] mt-0.5" style={{color:C.t2}}>💬 {n.motivo}</div>}
                    {(n.creado_por || n.aprobado_por) && (
                      <div className="text-[9px] mt-1 flex gap-2" style={{color:C.t3}}>
                        {n.creado_por && <span>👤 Creado por: <strong>{n.creado_por}</strong></span>}
                        {n.aprobado_por && <span>✓ {n.estado === 'aprobada'?'Aprobado':'Revisado'} por: <strong>{n.aprobado_por}</strong></span>}
                      </div>
                    )}
                  </div>
                  {n.estado==='enviada' && (
                    <div className="flex gap-1 shrink-0">
                      <button onClick={()=>aprobarNovedad(n,true)} className="px-2.5 py-1.5 rounded-lg text-[11px] font-bold flex items-center gap-1" style={{background:`${C.green}22`,color:C.green,border:`1px solid ${C.green}55`}}><Check size={13}/> Aprobar</button>
                      <button onClick={()=>aprobarNovedad(n,false)} className="px-2.5 py-1.5 rounded-lg text-[11px] font-bold flex items-center gap-1" style={{background:`${C.red}18`,color:C.red,border:`1px solid ${C.red}44`}}><X size={13}/> Rechazar</button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ════════ PRELIQUIDACIÓN ════════ */}
      {tab==='preliquidacion' && (
        <div className="space-y-4">
          {/* Header con totales */}
          <div className="rounded-2xl p-5"
            style={{background:'linear-gradient(135deg, rgba(212,148,58,0.12), rgba(155,114,255,0.06))', border:'1px solid rgba(212,148,58,0.30)'}}>
            <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
              <div>
                <div className="text-[10px] uppercase tracking-[0.16em]" style={{color:C.gold}}>📊 Preliquidación</div>
                <div className="font-['Syne'] text-[18px] font-black mt-0.5">{weekStart.toLocaleDateString('es-CO',{day:'2-digit',month:'short'})} – {addDays(weekStart,6).toLocaleDateString('es-CO',{day:'2-digit',month:'short'})}</div>
                <div className="text-[10px] mt-1" style={{color:C.t3}}>
                  Valor hora = salario base ÷ {HORAS_MES}h ({HORAS_SEMANA_LEGAL}h × 4 sem) · Guía Colombia 2026
                </div>
              </div>
              <div className="flex gap-2 flex-wrap">
                <KPIBox label="Devengado semana" v={cop(costoPeriodo)} c={C.goldL}/>
                <KPIBox label="× 4 mensual" v={cop(costoPeriodo*4)} c={C.green}/>
                <KPIBox label="Costo patronal" v={cop(costoPatronal*4)} c="#9b72ff"/>
                <KPIBox label="Deduc empleados" v={cop(totalDeducc*4)} c={C.red}/>
              </div>
            </div>

            {/* Multiplicadores oficiales — referencia visual */}
            <div className="grid grid-cols-3 md:grid-cols-5 gap-1.5 mt-4 pt-4 border-t" style={{borderColor:C.border}}>
              <RecargoChip label="Ordinaria" mult="×1.00" c="#4a8fd4"/>
              <RecargoChip label="Recargo noct" mult="+35%" c="#9b72ff"/>
              <RecargoChip label="Nocturna full" mult="×1.35" c="#9b6dd4"/>
              <RecargoChip label="Recargo dom" mult="+80%" c="#FFB547"/>
              <RecargoChip label="Dominical" mult="×1.80" c="#d4943a"/>
              <RecargoChip label="Extra diurna" mult="×1.25" c="#e0a050"/>
              <RecargoChip label="Extra nocturna" mult="×1.75" c="#e05050"/>
              <RecargoChip label="Extra dom diu" mult="×2.05" c="#FF6B6B"/>
              <RecargoChip label="Extra dom noc" mult="×2.55" c="#FF2D78"/>
            </div>
          </div>

          {/* Tabla detalle por empleado */}
          <div className="overflow-x-auto rounded-2xl border" style={{borderColor:C.border, background:C.card}}>
            <table className="w-full border-collapse text-[11px]" style={{minWidth:980}}>
              <thead>
                <tr style={{background:C.card2, color:C.t3}}>
                  {['Empleado','Total horas','Ordinaria','Nocturna','Dominical','Dom.Noct','Extras','Bonos','Deducc','Devengado','Salud 4%','Pensión 4%','Neto','× 4 mes'].map((h,i)=>(
                    <th key={i} className={`p-2 text-[9px] uppercase font-bold ${i===0?'text-left':'text-right'}`}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {preliq.map(r=>(
                  <tr key={r.emp.id} style={{borderTop:`1px solid ${C.border}`}}>
                    <td className="p-2">
                      <div className="font-bold text-[12px]">{r.emp.nombre_completo}</div>
                      <div className="text-[9px]" style={{color:C.t3}}>{r.emp.cargo_display || r.emp.rol}</div>
                      <div className="text-[9px]" style={{color:C.t3}}>Hora: {cop(r.emp.salario_base ? r.emp.salario_base/HORAS_MES : 0)}</div>
                    </td>
                    <td className="p-2 text-right tabular-nums">
                      <div className="font-bold" style={{color:r.totalHoras > HORAS_SEMANA_LEGAL?C.gold:C.t1}}>{r.totalHoras.toFixed(1)}h</div>
                      <div className="text-[9px]" style={{color:C.t3}}>/ {HORAS_SEMANA_LEGAL}h</div>
                    </td>
                    <td className="p-2 text-right tabular-nums">{r.hOrd>0?<div><div>{r.hOrd.toFixed(1)}h</div><div className="text-[9px]" style={{color:C.t3}}>{cop(r.valOrd)}</div></div>:<span style={{color:C.t3}}>—</span>}</td>
                    <td className="p-2 text-right tabular-nums">{r.hNoct>0?<div><div style={{color:'#9b72ff'}}>{r.hNoct.toFixed(1)}h</div><div className="text-[9px]" style={{color:C.t3}}>{cop(r.valNoct)}</div></div>:<span style={{color:C.t3}}>—</span>}</td>
                    <td className="p-2 text-right tabular-nums">{r.hDom>0?<div><div style={{color:C.gold}}>{r.hDom.toFixed(1)}h</div><div className="text-[9px]" style={{color:C.t3}}>{cop(r.valDom)}</div></div>:<span style={{color:C.t3}}>—</span>}</td>
                    <td className="p-2 text-right tabular-nums">{r.hDomNoct>0?<div><div style={{color:'#FF2D78'}}>{r.hDomNoct.toFixed(1)}h</div><div className="text-[9px]" style={{color:C.t3}}>{cop(r.valDomNoct)}</div></div>:<span style={{color:C.t3}}>—</span>}</td>
                    <td className="p-2 text-right tabular-nums">{r.extrasVal>0?<span style={{color:C.green}}>{cop(r.extrasVal)}</span>:<span style={{color:C.t3}}>—</span>}</td>
                    <td className="p-2 text-right tabular-nums">{r.bonos>0?<span style={{color:C.green}}>{cop(r.bonos)}</span>:<span style={{color:C.t3}}>—</span>}</td>
                    <td className="p-2 text-right tabular-nums">{r.deducc>0?<span style={{color:C.red}}>-{cop(r.deducc)}</span>:<span style={{color:C.t3}}>—</span>}</td>
                    <td className="p-2 text-right font-black tabular-nums" style={{color:C.goldL}}>{cop(r.devengado)}</td>
                    <td className="p-2 text-right tabular-nums" style={{color:C.red}}>-{cop(r.deducSalud)}</td>
                    <td className="p-2 text-right tabular-nums" style={{color:C.red}}>-{cop(r.deducPension)}</td>
                    <td className="p-2 text-right font-bold tabular-nums" style={{color:C.green}}>{cop(r.netoEmpleado)}</td>
                    <td className="p-2 text-right font-black tabular-nums" style={{color:'#9b72ff'}}>{cop(r.netoEmpleado*4)}</td>
                  </tr>
                ))}
                {preliq.length===0 && <tr><td colSpan={14} className="p-8 text-center" style={{color:C.t3}}>Sin turnos en el periodo. Programa horarios para ver la preliquidación.</td></tr>}
              </tbody>
            </table>
          </div>

          {/* Parafiscales y prestaciones (resumen) */}
          {preliq.length > 0 && (
            <div className="rounded-2xl p-4 border" style={{background:C.card, borderColor:C.border}}>
              <div className="text-[10px] font-bold uppercase tracking-wider mb-3" style={{color:'#9b72ff'}}>💼 Aportes patronales + prestaciones (estimado mensual)</div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-[12px]">
                <div><div className="text-[9px]" style={{color:C.t3}}>Salud 8.5% patrono</div><div className="font-bold">{cop(costoPeriodo*4*APORTE_SALUD_PATRON)}</div></div>
                <div><div className="text-[9px]" style={{color:C.t3}}>Pensión 12% patrono</div><div className="font-bold">{cop(costoPeriodo*4*APORTE_PENSION_PATRON)}</div></div>
                <div><div className="text-[9px]" style={{color:C.t3}}>ARL Riesgo II 0.52%</div><div className="font-bold">{cop(costoPeriodo*4*ARL_NIVEL_II)}</div></div>
                <div><div className="text-[9px]" style={{color:C.t3}}>Caja Compensación 4%</div><div className="font-bold">{cop(costoPeriodo*4*CAJA_COMPENSACION)}</div></div>
                <div><div className="text-[9px]" style={{color:C.t3}}>Cesantías 8.33%</div><div className="font-bold">{cop(costoPeriodo*4*CESANTIAS_FACTOR)}</div></div>
                <div><div className="text-[9px]" style={{color:C.t3}}>Int. Cesantías 1%</div><div className="font-bold">{cop(costoPeriodo*4*INT_CESANTIAS_FACTOR)}</div></div>
                <div><div className="text-[9px]" style={{color:C.t3}}>Prima servicios 8.33%</div><div className="font-bold">{cop(costoPeriodo*4*PRIMA_FACTOR)}</div></div>
                <div><div className="text-[9px]" style={{color:C.t3}}>Vacaciones 4.17%</div><div className="font-bold">{cop(costoPeriodo*4*VACACIONES_FACTOR)}</div></div>
              </div>
              <div className="mt-3 pt-3 border-t flex items-center justify-between text-[14px] font-bold" style={{borderColor:C.border}}>
                <span style={{color:C.t2}}>TOTAL COSTO EMPLEADOR (mes estimado)</span>
                <span className="font-['Syne'] text-[20px] font-black" style={{color:'#9b72ff'}}>{cop(costoPatronal*4)}</span>
              </div>
            </div>
          )}

          <p className="text-[10px]" style={{color:C.t3}}>
            ⚠️ Cálculo trazable basado en turnos efectivos (descontada 1h de alimentación) + novedades aprobadas. Multiplicadores conforme Guía Salarial Colombia 2026. No reemplaza revisión laboral formal. Mensual = semana × 4.
          </p>
        </div>
      )}

      {tab==='ia' && <IATurnoOptimo restauranteId={REST_ID} complejoId={COMPLEJO_ID} empleados={empleados} turnos={turnos} weekBase={weekBase} onAplicar={(creados:number)=>{ showToast(`✨ ${creados} turnos creados por IA`); logAudit('ia.simulacion','turnos',{creados}); cargar(); }}/>}

      {/* Modal nuevo turno */}
      {shiftModal && <ShiftModal empleado={empById[shiftModal.empId]} fecha={shiftModal.fecha} complejoId={COMPLEJO_ID} horasSemana={(horasPorEmp as any)[shiftModal.empId]?.efectivas || 0} onClose={()=>setShiftModal(null)} onSaved={(msg)=>{ setShiftModal(null); showToast(msg); logAudit('turno.creado','turnos',{empleado_id:shiftModal.empId, fecha:shiftModal.fecha}); cargar(); }} />}
      {/* Modal nueva novedad */}
      {novModal && <NovedadModal empleados={empleados} userName={userNombre} userRole={userRole} onClose={()=>setNovModal(false)} onSaved={(msg)=>{ setNovModal(false); showToast(msg); cargar(); }} />}

      {toast && <div className="fixed bottom-6 left-1/2 -translate-x-1/2 px-5 py-2.5 rounded-lg text-[13px] z-[9999] shadow-2xl" style={{background:'#222',border:`1px solid ${C.border}`,color:C.t1}}>{toast}</div>}
    </div>
  );
}

function KPIBox({label, v, c}:{label:string; v:string; c:string}) {
  return (
    <div className="px-3 py-2 rounded-xl border" style={{background:'rgba(0,0,0,0.3)', borderColor:`${c}33`}}>
      <div className="text-[9px] uppercase tracking-wider font-bold" style={{color:C.t3}}>{label}</div>
      <div className="font-['Syne'] text-[16px] font-black" style={{color:c}}>{v}</div>
    </div>
  );
}

function RecargoChip({label, mult, c}:{label:string; mult:string; c:string}) {
  return (
    <div className="px-2 py-1.5 rounded-lg text-center" style={{background:`${c}12`, border:`1px solid ${c}33`}}>
      <div className="text-[8px] uppercase font-bold" style={{color:c}}>{label}</div>
      <div className="text-[11px] font-black tabular-nums" style={{color:c}}>{mult}</div>
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
function ShiftModal({empleado, fecha, complejoId, horasSemana, onClose, onSaved}:{empleado:any, fecha:string, complejoId:number, horasSemana?:number, onClose:()=>void, onSaved:(m:string)=>void}){
  const [ini,setIni]=useState('17:00');
  const [fin,setFin]=useState('23:00');
  const [tipo,setTipo]=useState('servicio');
  const [nota,setNota]=useState('');
  const [partido,setPartido]=useState(false);
  const [ini2,setIni2]=useState('19:00');
  const [fin2,setFin2]=useState('23:00');
  const [autoExtras,setAutoExtras]=useState(false);
  const [saving,setSaving]=useState(false);
  const [error,setError]=useState<string|null>(null);

  // Cálculo dinámico de horas con almuerzo + extras
  const turnoMain = horasEfectivas(ini+':00', fin+':00');
  const turnoExtra = partido ? horasEfectivas(ini2+':00', fin2+':00') : 0;
  const horasTurnoTotal = turnoMain + turnoExtra;
  const horasYaSemana = horasSemana || 0;
  const horasFinal = horasYaSemana + horasTurnoTotal;
  const sobreLegal = Math.max(0, horasFinal - HORAS_SEMANA_LEGAL);
  const requiereExtras = sobreLegal > 0;
  const finDeSemana = (() => {
    const d = new Date(fecha+'T12:00:00').getDay();
    return d === 0 || d === 6; // sábado o domingo
  })();

  const guardar = async ()=>{
    if (requiereExtras && !autoExtras) {
      setError(`Este turno excede ${HORAS_SEMANA_LEGAL}h legales por ${sobreLegal.toFixed(1)}h. Confirmá horas extras autorizadas.`);
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const horas1 = shiftHours(ini+':00', fin+':00');
      const horasEf1 = horasEfectivas(ini+':00', fin+':00');
      const nota1 = `${nota||''}${horasEf1>=7?' · +1h almuerzo':''}${finDeSemana?' · FIN DE SEMANA':''}${requiereExtras?` · EXTRAS +${sobreLegal.toFixed(1)}h`:''}`.trim();
      const inserts:any[] = [{
        empleado_id:empleado.id, complejo_id:complejoId, fecha,
        hora_inicio:ini+':00', hora_fin:fin+':00',
        estado:'programado', tipo_turno: partido?'partido':tipo,
        horas_trabajadas:horas1, nota:nota1,
        confirmado:false, publicado:false,
      }];
      if (partido) {
        const horas2 = shiftHours(ini2+':00', fin2+':00');
        inserts.push({
          empleado_id:empleado.id, complejo_id:complejoId, fecha,
          hora_inicio:ini2+':00', hora_fin:fin2+':00',
          estado:'programado', tipo_turno:'partido',
          horas_trabajadas:horas2, nota:`Partido bloque 2${requiereExtras?` · EXTRAS`:''}`,
          confirmado:false, publicado:false,
        });
      }
      const { error: insErr } = await supabase.from('turnos').insert(inserts);
      if (insErr) throw insErr;
      // Si autorizó horas extras, crear novedad de hora extra en el día siguiente
      if (requiereExtras && autoExtras) {
        const proxDia = new Date(fecha+'T12:00:00'); proxDia.setDate(proxDia.getDate()+1);
        await supabase.from('workforce_novedades').insert({
          empleado_id:empleado.id, empleado_nombre:empleado.nombre_completo, tipo:'hora_extra',
          fecha_inicio: proxDia.toISOString().split('T')[0],
          fecha_fin: proxDia.toISOString().split('T')[0],
          horas: sobreLegal, motivo: `Hora extra autorizada por turno del ${fecha} (excede ${HORAS_SEMANA_LEGAL}h semanales)`,
          estado:'enviada', impacto_pago:'pago',
        });
      }
      onSaved(`✓ ${partido?'Turno partido':'Turno'} ${ini}–${fin}${partido?` / ${ini2}–${fin2}`:''} · ${empleado.nombre_completo}${requiereExtras?` · +${sobreLegal.toFixed(1)}h extras`:''}`);
    } catch (e:any) {
      setError(e?.message || 'No se pudo guardar el turno');
    } finally {
      setSaving(false);
    }
  };
  return (
    <div className="fixed inset-0 bg-black/80 z-[700] flex items-center justify-center p-4" onClick={e=>{ if(e.target===e.currentTarget) onClose(); }}>
      <div className="rounded-2xl w-full max-w-[420px] p-5 max-h-[92vh] overflow-y-auto" style={{background:C.card2, border:`1px solid ${C.border}`}}>
        <div className="flex items-center justify-between mb-3">
          <div>
            <div className="text-[14px] font-black">Nuevo turno</div>
            <div className="text-[11px]" style={{color:C.t2}}>{empleado?.nombre_completo} · {fecha}{finDeSemana && <span className="ml-2" style={{color:C.gold}}>· Fin de semana</span>}</div>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-full flex items-center justify-center" style={{background:C.bg,border:`1px solid ${C.border}`,color:C.t2}}><X size={16}/></button>
        </div>

        {/* Toggle turno partido */}
        <button onClick={()=>setPartido(p=>!p)}
          className="w-full px-3 py-2 rounded-lg text-[11px] font-bold mb-3 flex items-center justify-between"
          style={{background: partido?'#4a8fd418':C.bg, border:`1px solid ${partido?'#4a8fd4':C.border}`, color: partido?'#4a8fd4':C.t2}}>
          <span>↕ Turno partido (dos bloques)</span>
          <span className="text-[14px]">{partido?'●':'○'}</span>
        </button>

        <div className="flex gap-2 mb-3">
          <label className="flex-1 text-[11px]" style={{color:C.t2}}>Inicio {partido && '· bloque 1'}<input type="time" value={ini} onChange={e=>setIni(e.target.value)} className="w-full mt-1 px-2 py-2 rounded-lg text-[13px]" style={{background:C.bg,border:`1px solid ${C.border}`,color:C.t1}}/></label>
          <label className="flex-1 text-[11px]" style={{color:C.t2}}>Fin {partido && '· bloque 1'}<input type="time" value={fin} onChange={e=>setFin(e.target.value)} className="w-full mt-1 px-2 py-2 rounded-lg text-[13px]" style={{background:C.bg,border:`1px solid ${C.border}`,color:C.t1}}/></label>
        </div>

        {partido && (
          <div className="flex gap-2 mb-3 p-2 rounded-lg" style={{background:'rgba(74,143,212,0.06)',border:'1px solid rgba(74,143,212,0.25)'}}>
            <label className="flex-1 text-[11px]" style={{color:'#4a8fd4'}}>Inicio · bloque 2<input type="time" value={ini2} onChange={e=>setIni2(e.target.value)} className="w-full mt-1 px-2 py-2 rounded-lg text-[13px]" style={{background:C.bg,border:`1px solid ${C.border}`,color:C.t1}}/></label>
            <label className="flex-1 text-[11px]" style={{color:'#4a8fd4'}}>Fin · bloque 2<input type="time" value={fin2} onChange={e=>setFin2(e.target.value)} className="w-full mt-1 px-2 py-2 rounded-lg text-[13px]" style={{background:C.bg,border:`1px solid ${C.border}`,color:C.t1}}/></label>
          </div>
        )}

        {/* Cálculo en vivo */}
        <div className="rounded-lg p-3 mb-3 text-[11px]" style={{background:C.bg, border:`1px solid ${C.border}`}}>
          <div className="flex items-center justify-between mb-1">
            <span style={{color:C.t3}}>Horas efectivas (planta − 1h alm.)</span>
            <span className="font-bold" style={{color:C.goldL}}>{horasTurnoTotal.toFixed(1)} h</span>
          </div>
          <div className="flex items-center justify-between mb-1">
            <span style={{color:C.t3}}>Acumuladas en la semana</span>
            <span className="font-bold" style={{color: horasFinal > HORAS_SEMANA_LEGAL?C.gold:C.t1}}>{horasFinal.toFixed(1)} / {HORAS_SEMANA_LEGAL} h</span>
          </div>
          {requiereExtras && (
            <div className="flex items-center justify-between mt-2 pt-2 border-t" style={{borderColor:C.border}}>
              <span style={{color:C.red,fontWeight:700}}>⚠ Excede {HORAS_SEMANA_LEGAL}h</span>
              <span className="font-black" style={{color:C.red}}>+{sobreLegal.toFixed(1)} h extras</span>
            </div>
          )}
        </div>

        {requiereExtras && (
          <button onClick={()=>setAutoExtras(p=>!p)}
            className="w-full px-3 py-2.5 rounded-lg text-[11px] font-bold mb-3 flex items-center justify-between"
            style={{background: autoExtras?'#e0505018':C.bg, border:`1px solid ${autoExtras?'#e05050':'#e0505055'}`, color: autoExtras?'#e05050':C.t2}}>
            <span>✓ Autorizo {sobreLegal.toFixed(1)}h extras (se crea novedad próximo día)</span>
            <span className="text-[14px]">{autoExtras?'●':'○'}</span>
          </button>
        )}

        {!partido && (
          <>
            <div className="text-[11px] mb-1" style={{color:C.t2}}>Tipo de turno</div>
            <div className="grid grid-cols-2 gap-1.5 mb-3">
              {TIPOS_TURNO.map(t=>(
                <button key={t.id} onClick={()=>setTipo(t.id)} className="px-2 py-1.5 rounded-lg text-[10px] font-bold text-left" style={{background: tipo===t.id?`${t.color}22`:C.bg, border:`1px solid ${tipo===t.id?t.color:C.border}`, color: tipo===t.id?t.color:C.t2}}>{t.label}</button>
              ))}
            </div>
          </>
        )}
        <input value={nota} onChange={e=>setNota(e.target.value)} placeholder="Nota (opcional)" className="w-full px-2 py-2 rounded-lg text-[12px] mb-3" style={{background:C.bg,border:`1px solid ${C.border}`,color:C.t1}}/>
        {error && <div className="text-[11px] mb-2 px-3 py-2 rounded-lg" style={{background:'rgba(255,82,82,0.12)',border:'1px solid rgba(255,82,82,0.30)',color:'#ff7878'}}>⚠ {error}</div>}
        <button onClick={guardar} disabled={saving} className="w-full py-2.5 rounded-xl text-[13px] font-black flex items-center justify-center gap-2" style={{background:C.gold,color:'#000'}}>{saving?<Loader2 size={15} className="animate-spin"/>:<Plus size={15}/>} Crear turno</button>
      </div>
    </div>
  );
}

// ── Modal: crear novedad ──
function NovedadModal({empleados, userName, userRole, onClose, onSaved}:{empleados:any[], userName:string, userRole?:string, onClose:()=>void, onSaved:(m:string)=>void}){
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
  // Solo admin/gerencia/dev pueden crear novedad de hora_extra
  const puedeExtras = ['admin','gerencia','desarrollo','gerente'].includes(String(userRole||'').toLowerCase());
  const restringido = usaHoras && !puedeExtras;

  // Filtrar tipos según permisos (extras solo para admin/gerente)
  const tiposVisibles = TIPOS_NOVEDAD.filter(t => t.id !== 'hora_extra' || puedeExtras);

  const guardar = async ()=>{
    if(!empId){ return; }
    if (restringido) return;
    setSaving(true);
    const emp = empleados.find(e=>e.id===empId);
    let dias:number|null=null;
    if(usaDias && ini && fin){ const d=(new Date(fin+'T12:00').getTime()-new Date(ini+'T12:00').getTime())/86400000; dias=Math.max(1,Math.round(d)+1); }
    else if(usaDias && ini){ dias=1; }
    await supabase.from('workforce_novedades').insert({
      empleado_id:empId, empleado_nombre:emp?.nombre_completo, tipo, impacto_pago:meta.impacto,
      fecha_inicio:ini||null, fecha_fin:fin||ini||null, dias, horas:usaHoras?Number(horas)||null:null, valor:usaValor?Number(valor)||null:null,
      estado:'enviada', motivo, creado_por:userName,
    });
    setSaving(false);
    onSaved('✓ Novedad enviada para aprobación');
  };
  return (
    <div className="fixed inset-0 bg-black/80 z-[700] flex items-center justify-center p-4" onClick={e=>{ if(e.target===e.currentTarget) onClose(); }}>
      <div className="rounded-2xl w-full max-w-[440px] p-5 max-h-[92vh] overflow-y-auto"
        style={{background:C.card2, border:'2px solid rgba(255,45,120,0.4)', boxShadow:'0 20px 60px rgba(255,45,120,0.2)'}}>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center"
              style={{background:'rgba(255,45,120,0.18)', border:'1px solid rgba(255,45,120,0.5)'}}>
              <FileText size={20} className="text-[#FF2D78]"/>
            </div>
            <div>
              <div className="font-['Syne'] text-[16px] font-black" style={{color:'#fff'}}>Nueva novedad laboral</div>
              <div className="text-[10px]" style={{color:C.t3}}>Creada por <strong style={{color:'#FF2D78'}}>{userName}</strong> {userRole && <span>· {userRole}</span>}</div>
            </div>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-full flex items-center justify-center" style={{background:C.bg,border:`1px solid ${C.border}`,color:C.t2}}><X size={16}/></button>
        </div>

        {/* Categorías visuales (extras / deducciones / otros) */}
        <div className="text-[10px] uppercase tracking-wider font-bold mb-2" style={{color:'#FF2D78'}}>Categoría</div>
        <div className="flex gap-1.5 mb-3 flex-wrap">
          {(['extras','deducciones','otros'] as const).map(cat => {
            const map:any = { extras:['hora_extra','bonificacion'], deducciones:['ausencia','permiso_no_pago','incapacidad'], otros:['permiso_pago','vacaciones','cambio_turno'] };
            const tipos = (map[cat] as string[]);
            const esActiva = tipos.includes(tipo);
            return (
              <button key={cat} onClick={()=>{ const primero = tipos.find(id => tiposVisibles.find(t=>t.id===id)); if (primero) setTipo(primero); }}
                className="px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider"
                style={{
                  background: esActiva?'rgba(255,45,120,0.18)':'transparent',
                  border: `1px solid ${esActiva?'#FF2D78':C.border}`,
                  color: esActiva?'#FF2D78':C.t3,
                }}>
                {cat === 'extras' ? '⚡ Extras y bonos' : cat === 'deducciones' ? '➖ Deducciones' : '📋 Otros'}
              </button>
            );
          })}
        </div>

        <div className="text-[11px] mb-1" style={{color:C.t2}}>👤 Empleado</div>
        <select value={empId} onChange={e=>setEmpId(e.target.value?Number(e.target.value):'')} className="w-full px-2 py-2 rounded-lg text-[13px] mb-3" style={{background:C.bg,border:`1px solid ${C.border}`,color:C.t1, colorScheme:'dark'}}>
          <option value="">Selecciona empleado…</option>
          {empleados.map(e=><option key={e.id} value={e.id}>{e.nombre_completo} {e.cargo_display?`· ${e.cargo_display}`:''}</option>)}
        </select>

        <div className="text-[11px] mb-1" style={{color:C.t2}}>Tipo de novedad</div>
        <div className="grid grid-cols-2 gap-1.5 mb-3">
          {tiposVisibles.map(t=>{
            const esExtra = t.id==='hora_extra';
            const esDeduc = ['ausencia','permiso_no_pago'].includes(t.id);
            const col = esExtra?'#FF2D78':esDeduc?C.red:C.blue;
            return (
              <button key={t.id} onClick={()=>setTipo(t.id)} className="px-2 py-1.5 rounded-lg text-[10px] font-bold text-left"
                style={{background:tipo===t.id?`${col}22`:C.bg,border:`1px solid ${tipo===t.id?col:C.border}`,color:tipo===t.id?col:C.t2}}>
                {esExtra?'⚡ ':esDeduc?'➖ ':''}{t.label}
              </button>
            );
          })}
        </div>
        {!puedeExtras && (
          <div className="text-[10px] p-2 rounded-lg mb-3" style={{background:'rgba(212,148,58,0.1)', border:'1px solid rgba(212,148,58,0.3)', color:'#d4943a'}}>
            🔒 Las horas extras solo pueden crearlas perfiles de admin / gerencia.
          </div>
        )}

        {/* CALENDARIO — adjunto siempre visible para todos los tipos */}
        <div className="rounded-lg p-3 mb-3" style={{background:'rgba(255,45,120,0.05)', border:'1px solid rgba(255,45,120,0.2)'}}>
          <div className="text-[10px] uppercase tracking-wider font-bold mb-2" style={{color:'#FF2D78'}}>📅 Calendario · fechas afectadas</div>
          <div className="flex gap-2">
            <label className="flex-1 text-[10px]" style={{color:C.t2}}>Desde
              <input type="date" value={ini} onChange={e=>setIni(e.target.value)} className="w-full mt-1 px-2 py-2 rounded-lg text-[13px]"
                style={{background:C.bg,border:`1px solid ${C.border}`,color:C.t1, colorScheme:'dark', accentColor:'#FF2D78'}}/>
            </label>
            <label className="flex-1 text-[10px]" style={{color:C.t2}}>Hasta {usaHoras?'(día del extra)':'(opcional)'}
              <input type="date" value={fin} onChange={e=>setFin(e.target.value)} className="w-full mt-1 px-2 py-2 rounded-lg text-[13px]"
                style={{background:C.bg,border:`1px solid ${C.border}`,color:C.t1, colorScheme:'dark', accentColor:'#FF2D78'}}/>
            </label>
          </div>
          <div className="text-[9px] mt-2" style={{color:C.t3}}>
            {empId ? `⚡ Esta novedad afectará los turnos de ${empleados.find(e=>e.id===empId)?.nombre_completo?.split(' ')[0]||'el empleado'} en las fechas seleccionadas.` : 'Selecciona un empleado para previsualizar el impacto.'}
          </div>
        </div>

        {usaHoras && (
          <label className="block text-[11px] mb-3" style={{color:'#FF2D78'}}>
            ⚡ Horas extras a autorizar
            <input type="number" step="0.5" value={horas} onChange={e=>setHoras(e.target.value)} placeholder="1.0"
              className="w-full mt-1 px-2 py-2 rounded-lg text-[13px]"
              style={{background:C.bg,border:'1px solid #FF2D78',color:C.t1}}/>
          </label>
        )}
        {usaValor && (
          <label className="block text-[11px] mb-3" style={{color:'#FF2D78'}}>
            💰 Valor bonificación (COP)
            <input type="number" value={valor} onChange={e=>setValor(e.target.value)} placeholder="100000"
              className="w-full mt-1 px-2 py-2 rounded-lg text-[13px]"
              style={{background:C.bg,border:'1px solid #FF2D78',color:C.t1}}/>
          </label>
        )}
        <textarea value={motivo} onChange={e=>setMotivo(e.target.value)} placeholder="Motivo / soporte (obligatorio para auditoría)" rows={2}
          className="w-full px-2 py-2 rounded-lg text-[12px] mb-3 resize-none"
          style={{background:C.bg,border:`1px solid ${C.border}`,color:C.t1}}/>

        <button onClick={guardar} disabled={saving||!empId||restringido}
          className="w-full py-3 rounded-xl text-[13px] font-black flex items-center justify-center gap-2 disabled:opacity-40"
          style={{background:'linear-gradient(135deg,#FF2D78,#B388FF)', color:'#fff', boxShadow:'0 6px 18px rgba(255,45,120,0.35)'}}>
          {saving?<Loader2 size={15} className="animate-spin"/>:<FileText size={15}/>}
          Enviar novedad
        </button>
        <p className="text-[10px] mt-2 text-center" style={{color:C.t3}}>Queda en estado <strong style={{color:'#FF2D78'}}>enviada</strong>. No impacta nómina hasta ser <strong style={{color:C.green}}>aprobada</strong> por gerencia.</p>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════
// IA · TURNO ÓPTIMO
// Analiza los últimos 90 días de cobros_trazabilidad y ranking de meseros
// para sugerir cuántas personas necesitas por día/hora y a quién asignar.
// ═══════════════════════════════════════════════════════════════════════
function IATurnoOptimo({ restauranteId, complejoId, empleados, turnos, weekBase, onAplicar }: { restauranteId: number; complejoId: number; empleados: any[]; turnos: any[]; weekBase: Date; onAplicar:(creados:number)=>void }) {
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

      {/* SIMULACIÓN DE TURNOS POR IA */}
      <SimuladorTurnos
        complejoId={complejoId}
        empleados={empleados}
        turnos={turnos}
        weekBase={weekBase}
        recomMeseros={recomMeseros}
        horasPico={horasPico}
        onAplicar={onAplicar}
      />
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════
// SIMULADOR DE TURNOS · genera un horario semanal con asignaciones por
// rol basado en la recomendación del análisis IA. Permite aplicar con
// un click — crea los registros en `turnos` (estado='programado').
// ═════════════════════════════════════════════════════════════════════
function SimuladorTurnos({ complejoId, empleados, turnos, weekBase, recomMeseros, horasPico, onAplicar }:{
  complejoId:number; empleados:any[]; turnos:any[]; weekBase:Date;
  recomMeseros:(d:number)=>number; horasPico:string[]; onAplicar:(n:number)=>void;
}) {
  // Roles agrupados por función operativa
  const ROL_GRUPOS = {
    meseros:  ['mesero','capitan','maitre','host','runner'],
    cocina:   ['chef','sous_chef','auxiliar_cocina','cocinero'],
    barra:    ['bartender','barback','auxiliar_barra'],
    soporte:  ['cajero','call_center','administrativo'],
  };
  const grupoDe = (rol?:string) => {
    const r = (rol||'').toLowerCase();
    for (const [k,arr] of Object.entries(ROL_GRUPOS)) if ((arr as string[]).some(x => r.includes(x))) return k;
    return 'soporte';
  };
  const empleadosPorGrupo = React.useMemo(() => {
    const groups: Record<string, any[]> = { meseros:[], cocina:[], barra:[], soporte:[] };
    empleados.forEach((e:any) => {
      if (!e.activo && e.activo !== undefined) return;
      const g = grupoDe(e.rol);
      groups[g].push(e);
    });
    return groups;
  }, [empleados]);

  // Ventanas operativas
  const VENTANAS = {
    almuerzo: { ini:'11:00', fin:'16:00', tipo:'servicio', label:'Almuerzo' },
    cena:     { ini:'17:30', fin:'23:30', tipo:'servicio', label:'Cena' },
    apertura: { ini:'09:00', fin:'13:00', tipo:'apertura', label:'Apertura cocina' },
    cierre:   { ini:'21:00', fin:'01:00', tipo:'cierre',   label:'Cierre' },
  };

  // Generar la simulación: para cada día de la semana base, decide qué
  // turnos abrir y a quién asignar.
  const ymdLocal = (d:Date) => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  // Tope simulador: 7 (semana) o hasta 15 días para planificar quincena
  const [diasSimulacion, setDiasSimulacion] = React.useState(7);
  const simulacion = React.useMemo(() => {
    const semana:{ fecha:string; dia:number; turnos:{ grupo:string; ventana:string; empleado:any; ini:string; fin:string; tipo:string; label:string }[] }[] = [];
    const dias = Math.min(SIMULADOR_MAX_DIAS, Math.max(1, diasSimulacion));
    for (let i=0;i<dias;i++) {
      const d = new Date(weekBase); d.setDate(d.getDate()+i);
      const fecha = ymdLocal(d);
      const diaSemana = d.getDay(); // 0=dom, 6=sab
      const nMeseros = recomMeseros(diaSemana);
      const fuerte = nMeseros >= 5;
      const turnosDia:any[] = [];

      // Asignar meseros (mitad almuerzo, mitad cena en días fuertes; cena solo en suaves)
      const meseros = [...empleadosPorGrupo.meseros];
      const nAlmuerzo = fuerte ? Math.ceil(nMeseros/2) : Math.max(1, Math.floor(nMeseros/3));
      const nCena     = nMeseros - nAlmuerzo;
      for (let k=0;k<nAlmuerzo && meseros.length>0;k++) {
        const e = meseros.shift();
        turnosDia.push({ grupo:'meseros', ventana:'almuerzo', empleado:e, ini:VENTANAS.almuerzo.ini, fin:VENTANAS.almuerzo.fin, tipo:VENTANAS.almuerzo.tipo, label:VENTANAS.almuerzo.label });
      }
      for (let k=0;k<nCena && meseros.length>0;k++) {
        const e = meseros.shift();
        turnosDia.push({ grupo:'meseros', ventana:'cena', empleado:e, ini:VENTANAS.cena.ini, fin:VENTANAS.cena.fin, tipo:VENTANAS.cena.tipo, label:VENTANAS.cena.label });
      }
      // Asignar cocina (apertura + cierre)
      const cocina = [...empleadosPorGrupo.cocina];
      const nCocina = Math.max(2, Math.ceil(nMeseros*0.7));
      for (let k=0;k<nCocina && cocina.length>0;k++) {
        const e = cocina.shift();
        const ventana = k < Math.ceil(nCocina/2) ? 'apertura' : 'cierre';
        const v = VENTANAS[ventana as 'apertura'|'cierre'];
        turnosDia.push({ grupo:'cocina', ventana, empleado:e, ini:v.ini, fin:v.fin, tipo:v.tipo, label:v.label });
      }
      // Asignar barra (siempre 1, en fuerte 2)
      const barra = [...empleadosPorGrupo.barra];
      const nBarra = fuerte ? 2 : 1;
      for (let k=0;k<nBarra && barra.length>0;k++) {
        const e = barra.shift();
        turnosDia.push({ grupo:'barra', ventana:'cena', empleado:e, ini:VENTANAS.cena.ini, fin:VENTANAS.cena.fin, tipo:'servicio', label:'Barra cena' });
      }
      semana.push({ fecha, dia:diaSemana, turnos:turnosDia });
    }
    return semana;
  }, [empleadosPorGrupo, recomMeseros, weekBase, diasSimulacion]);

  const totalSugeridos = simulacion.reduce((s,d) => s + d.turnos.length, 0);

  // ¿Cuáles de los sugeridos colisionan con un turno ya existente?
  const yaExiste = (fecha:string, empleadoId:any, ini:string) => turnos.some((t:any) =>
    t.fecha === fecha && t.empleado_id === empleadoId && t.hora_inicio?.slice(0,5) === ini
  );
  const nuevos = simulacion.flatMap(d => d.turnos.filter(t => !yaExiste(d.fecha, t.empleado.id, t.ini)).map(t => ({...t, fecha:d.fecha})));

  const [aplicando, setAplicando] = React.useState(false);
  const aplicar = async () => {
    if (nuevos.length === 0) { onAplicar(0); return; }
    if (!confirm(`¿Crear ${nuevos.length} turnos sugeridos por la IA en la semana del ${ymdLocal(weekBase)}? Quedarán en estado 'programado' y podés editarlos antes de publicar.`)) return;
    setAplicando(true);
    try {
      const insertRows = nuevos.map((t:any) => ({
        empleado_id: t.empleado.id,
        complejo_id: complejoId,
        fecha: t.fecha,
        hora_inicio: t.ini+':00',
        hora_fin: t.fin+':00',
        estado: 'programado',
        tipo_turno: t.tipo,
        horas_trabajadas: ((toMin(t.fin+':00') + (toMin(t.fin+':00')<=toMin(t.ini+':00')?1440:0) - toMin(t.ini+':00'))/60),
        nota: '🤖 IA · simulación',
        confirmado: false,
        publicado: false,
      }));
      const { error } = await supabase.from('turnos').insert(insertRows);
      if (error) throw error;
      onAplicar(insertRows.length);
    } catch (e:any) {
      alert('Error: '+(e?.message||'No se pudo aplicar la simulación'));
    } finally {
      setAplicando(false);
    }
  };

  const colorGrupo = { meseros:'#3dba6f', cocina:'#d4943a', barra:'#9b72ff', soporte:'#4a8fd4' } as Record<string,string>;
  const iconoGrupo = { meseros:'🪑', cocina:'🔥', barra:'🍸', soporte:'🛟' } as Record<string,string>;

  return (
    <div className="rounded-2xl p-5 mt-5" style={{background:'linear-gradient(135deg, rgba(212,148,58,0.1), rgba(155,114,255,0.06))', border:'2px solid rgba(212,148,58,0.4)'}}>
      <div className="flex items-center justify-between mb-3 flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#d4943a]/20 border border-[#d4943a]/50 flex items-center justify-center">
            <Sparkles size={20} className="text-[#d4943a]"/>
          </div>
          <div>
            <div className="font-['Syne'] text-[16px] font-black text-white">Simulación de turnos · IA</div>
            <div className="text-[11px] text-[#a0a0a0]">Distribución sugerida desde <strong className="text-[#d4943a]">{ymdLocal(weekBase)}</strong> · {diasSimulacion} días (máx {SIMULADOR_MAX_DIAS})</div>
          </div>
        </div>
        {/* Selector de días a simular (1 semana / 10 / 15 días) */}
        <div className="flex gap-1 p-1 rounded-xl" style={{background:'rgba(0,0,0,0.3)', border:'1px solid rgba(255,255,255,0.06)'}}>
          {[7,10,SIMULADOR_MAX_DIAS].map(n => (
            <button key={n} onClick={()=>setDiasSimulacion(n)}
              className="px-3 py-1.5 rounded-lg text-[11px] font-bold transition-all"
              style={{background: diasSimulacion===n ? 'rgba(212,148,58,0.2)':'transparent', color: diasSimulacion===n ? '#d4943a':'#a0a0a0'}}>
              {n}d
            </button>
          ))}
        </div>
        <button onClick={aplicar} disabled={aplicando || nuevos.length === 0}
          className="px-5 py-2.5 rounded-xl font-bold text-[13px] disabled:opacity-40 disabled:cursor-not-allowed"
          style={{background:'linear-gradient(135deg,#d4943a,#9b72ff)', color:'#fff', boxShadow:'0 6px 18px rgba(212,148,58,0.35)'}}>
          {aplicando ? '⏳ Aplicando…' : nuevos.length === 0 ? '✓ Ya aplicada esta semana' : `✨ Crear ${nuevos.length} turnos`}
        </button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-4">
        <SimStat label="Turnos sugeridos" v={totalSugeridos} c="#d4943a"/>
        <SimStat label="Nuevos a crear" v={nuevos.length} c="#3dba6f"/>
        <SimStat label="Empleados disponibles" v={empleados.length} c="#4a8fd4"/>
        <SimStat label="Horas pico" v={horasPico.join(', ')||'—'} c="#9b72ff"/>
      </div>

      {/* Grid de días — adaptable a 7/10/15 días */}
      <div className="grid gap-1.5" style={{gridTemplateColumns: `repeat(${Math.min(7, diasSimulacion)}, minmax(0,1fr))`}}>
        {simulacion.map((d) => {
          const fecha = new Date(d.fecha+'T12:00:00');
          const diaTxt = fecha.toLocaleDateString('es-CO',{weekday:'short'}).replace('.','');
          const dayNum = fecha.getDate();
          const fuerte = d.turnos.length >= 6;
          return (
            <div key={d.fecha} className="bg-[#0f0f14] border rounded-xl p-2"
              style={{borderColor: fuerte?'#d4943a55':'#2a2a3a', boxShadow: fuerte?'inset 0 0 18px rgba(212,148,58,0.08)':'none'}}>
              <div className="flex items-baseline justify-between mb-2">
                <div>
                  <div className="text-[9px] text-[#7a7a8c] font-bold uppercase">{diaTxt}</div>
                  <div className="font-['Syne'] text-[16px] font-black text-white">{dayNum}</div>
                </div>
                <span className="text-[10px] font-bold" style={{color: fuerte?'#d4943a':'#7a7a8c'}}>{d.turnos.length}t</span>
              </div>
              <div className="space-y-1">
                {d.turnos.length === 0 && (
                  <div className="text-[9px] text-[#5a5a64] text-center py-2">—</div>
                )}
                {d.turnos.map((t,i)=>(
                  <div key={i} className="text-[8.5px] px-1.5 py-1 rounded-md"
                    style={{background:`${colorGrupo[t.grupo]}15`, borderLeft:`2px solid ${colorGrupo[t.grupo]}`}}
                    title={`${t.empleado.nombre_completo} · ${t.ini}–${t.fin} · ${t.label}`}>
                    <div className="flex items-center gap-1">
                      <span>{iconoGrupo[t.grupo]}</span>
                      <span className="font-bold truncate" style={{color:colorGrupo[t.grupo]}}>{(t.empleado.nombre_completo||'').split(' ')[0]}</span>
                    </div>
                    <div className="text-[7.5px] text-[#a0a0a0]">{t.ini.slice(0,5)}–{t.fin.slice(0,5)}</div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {/* Leyenda */}
      <div className="flex flex-wrap gap-3 mt-3 text-[10px]">
        {Object.entries(colorGrupo).map(([k,c])=>(
          <span key={k} className="flex items-center gap-1.5">
            <span style={{width:7,height:7,borderRadius:'50%',background:c,display:'inline-block'}}/>
            <span style={{color:c,textTransform:'capitalize',fontWeight:700}}>{iconoGrupo[k]} {k}</span>
          </span>
        ))}
      </div>
    </div>
  );
}

function SimStat({ label, v, c }:{ label:string; v:any; c:string }) {
  return (
    <div className="bg-[#0f0f14] border border-[#1a1a24] rounded-lg p-2.5">
      <div className="text-[9px] text-[#7a7a8c] font-bold uppercase tracking-wider">{label}</div>
      <div className="font-['Syne'] text-[16px] font-black mt-0.5" style={{color:c}}>{v}</div>
    </div>
  );
}
