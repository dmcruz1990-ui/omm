import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase.ts';
import { useAuth } from '../contexts/AuthContext';

// ══ PLANO OMM — fiel al plano arquitectónico (mismo layout que el POS) ══
const PLANTA: Record<string,{num:number;zona:string;shape:'round'|'rect';cap:number;x:number;y:number;w:number;h:number}> = {
  BS1:{num:1, zona:'Barra Sushi', shape:'rect', cap:7, x:35,y:27,w:15,h:7.5},
  BS2:{num:2, zona:'Barra Sushi', shape:'rect', cap:7, x:51,y:27,w:15,h:7.5},
  S3:{num:3, zona:'Salón', shape:'round', cap:4, x:15,y:49,w:9,h:13},
  S4:{num:4, zona:'Salón', shape:'round', cap:4, x:26,y:49,w:9,h:13},
  S5:{num:5, zona:'Salón', shape:'round', cap:4, x:15,y:65,w:9,h:13},
  S6:{num:6, zona:'Salón', shape:'round', cap:2, x:27,y:66,w:8,h:11},
  S7:{num:7, zona:'Salón', shape:'round', cap:4, x:40,y:47,w:9.5,h:13},
  S8:{num:8, zona:'Salón', shape:'round', cap:4, x:52,y:47,w:9.5,h:13},
  C9:{num:9, zona:'Salón', shape:'rect', cap:12, x:40,y:63,w:22,h:14},
  S10:{num:10,zona:'Salón', shape:'round', cap:4, x:64,y:49,w:9.5,h:13},
  V11:{num:11,zona:'Ventanal', shape:'round', cap:2, x:40,y:84,w:7.5,h:11},
  V12:{num:12,zona:'Ventanal', shape:'round', cap:2, x:50,y:84,w:7.5,h:11},
  V13:{num:13,zona:'Ventanal', shape:'round', cap:2, x:60,y:84,w:7.5,h:11},
  TB14:{num:14,zona:'Torre Bar', shape:'rect', cap:6, x:74,y:61,w:11,h:11},
  TB15:{num:15,zona:'Torre Bar', shape:'rect', cap:6, x:74,y:74,w:11,h:11},
};
const ZONA_COLORES: Record<string,{bg:string;border:string;label:string}> = {
  'Barra Sushi':{bg:'rgba(68,139,255,0.05)',border:'rgba(68,139,255,0.20)',label:'🍣 Barra Sushi'},
  'Salón':      {bg:'rgba(255,255,255,0.02)',border:'rgba(255,255,255,0.07)',label:'🪑 Salón'},
  'Ventanal':   {bg:'rgba(34,211,238,0.05)',border:'rgba(34,211,238,0.18)',label:'🌅 Ventanal'},
  'Torre Bar':  {bg:'rgba(155,114,255,0.06)',border:'rgba(155,114,255,0.22)',label:'🍸 Torre Bar'},
};
const ZONA_AREAS: Record<string,{x:number;y:number;w:number;h:number}> = {
  'Barra Sushi':{x:33,y:22,w:35,h:17},
  'Salón':      {x:11,y:43,w:64,h:38},
  'Ventanal':   {x:36,y:81,w:37,h:16},
  'Torre Bar':  {x:71,y:54,w:26,h:39},
};
// Lógica de mesas — rango de personas válido por capacidad de mesa
const RANGO_MESA: Record<number,{min:number;max:number}> = {
  2:{min:1,max:2}, 3:{min:2,max:3}, 4:{min:2,max:4}, 5:{min:2,max:5}, 6:{min:2,max:6},
  7:{min:4,max:7}, 8:{min:4,max:8}, 9:{min:5,max:9}, 10:{min:6,max:10}, 11:{min:6,max:11},
  12:{min:8,max:12}, 13:{min:10,max:13}, 14:{min:10,max:14}, 15:{min:10,max:15}, 16:{min:12,max:16},
};
const rangoMesa = (cap:number) => RANGO_MESA[cap] || { min: Math.max(1, Math.floor(cap*0.6)), max: cap };
// Más de 16 personas → reservar por evento escribiendo al restaurante
const MAX_PAX_RESERVA = 16;

const S = {
  bg:'#08080f',bg2:'#0f0f1a',bg3:'#161624',
  border:'rgba(255,255,255,0.07)',border2:'rgba(255,255,255,0.12)',
  t1:'#fff',t2:'#A0A0B8',t3:'#50506A',
  gold:'#FFB547',green:'#00E676',red:'#FF5252',
  blue:'#448AFF',purple:'#B388FF',pink:'#FF2D78',cyan:'#22d3ee',
};
const fmt = (d:string) => new Date(d+'T00:00:00').toLocaleDateString('es-CO',{weekday:'short',day:'numeric',month:'short'});
const fmtElapsed = (iso?:string|null) => {
  if (!iso) return '';
  const min = Math.max(0, Math.floor((Date.now()-new Date(iso).getTime())/60000));
  return min<60 ? `${min} min` : `${Math.floor(min/60)}h ${min%60}m`;
};
const ESTADOS:any = {
  pendiente: {c:'#FFB547',l:'⏳ Pendiente'},
  confirmada:{c:'#00E676',l:'✓ Confirmada'},
  sentada:   {c:'#448AFF',l:'🪑 Sentada'},
  completada:{c:'#B388FF',l:'✅ Completada'},
  cancelada: {c:'#FF5252',l:'✗ Cancelada'},
  no_show:   {c:'#50506A',l:'👻 No show'},
};
const OCASIONES = ['Cumpleaños','Aniversario','Negocio','Primera cita','Graduación','Despedida','Celebración','Sin ocasión especial'];

type Tab = 'home'|'mapa'|'lista'|'nueva'|'editor';

interface Reserva {
  id:number;cliente_nombre:string;cliente_email?:string;cliente_telefono?:string;
  fecha:string;hora:string;pax:number;ocasion?:string;notas?:string;
  estado:string;mesa_num?:number;restaurante_nombre?:string;origen?:string;
}

export default function ReserveModule() {
  const { profile } = useAuth();
  const [tab, setTab]           = useState<Tab>('home');
  const [reservas, setReservas] = useState<Reserva[]>([]);
  const [mesas, setMesas]       = useState<any[]>([]);
  const [loading, setLoading]   = useState(true);
  const [toast, setToast]       = useState('');
  const [fechaFiltro, setFechaFiltro] = useState(new Date().toISOString().split('T')[0]);
  const [selected, setSelected]         = useState<Reserva|null>(null);
  const [asignandoMesa, setAsignandoMesa] = useState<Reserva|null>(null);
  const [saving, setSaving]     = useState(false);
  const [plantaDB, setPlantaDB] = useState<any[]>([]);
  const [editMesa, setEditMesa] = useState<any|null>(null);
  const [busquedaMesa, setBusquedaMesa] = useState('');
  const [meserosLista, setMeserosLista] = useState<any[]>([]);
  const [meseroAsignar, setMeseroAsignar] = useState('');
  const [now, setNow] = useState(Date.now());
  useEffect(()=>{ const t=setInterval(()=>setNow(Date.now()),30000); return ()=>clearInterval(t); },[]);
  const [form, setForm]         = useState({
    cliente_nombre:'',cliente_email:'',cliente_telefono:'',
    fecha:new Date().toISOString().split('T')[0],hora:'20:00',
    pax:2,ocasion:'Sin ocasión especial',notas:'',mesa_num:0,
  });
  const [walkin, setWalkin] = useState<{nombre:string;pax:number;mesa:number;telefono:string;email:string;vip:boolean}|null>(null);
  const [walkinCRM, setWalkinCRM] = useState<any>(null);
  // Cliente del sistema cargado en "Nueva reserva" (por celular):
  // gasto total, ticket promedio y última encuesta (estrellas) — clave para
  // la atención y para el pago por gerencia.
  const [reservaCRM, setReservaCRM] = useState<any>(null);
  const buscarClienteReserva = async (telRaw?:string) => {
    const t = (telRaw ?? form.cliente_telefono).trim();
    if (t.length < 7) { setReservaCRM(null); show('Ingresa un celular válido (mín. 7 dígitos)'); return; }
    const [c1, c2, enc] = await Promise.all([
      supabase.from('customers').select('id,name,email,vip_status,total_visits,total_spent,promedio_ticket,score,puntos,origen_captacion').eq('phone', t).limit(1).maybeSingle(),
      supabase.from('nexum_clientes_ohyeah').select('id,nombre,email,nivel,visitas,total_reservas').eq('telefono', t).limit(1).maybeSingle(),
      supabase.from('xcare_encuestas').select('estrellas,comentario,created_at').eq('cliente_telefono', t).order('created_at',{ascending:false}).limit(1).maybeSingle(),
    ]);
    const base = c1.data || (c2.data ? { name:c2.data.nombre, email:c2.data.email, total_visits:c2.data.visitas, total_spent:0, nivel:c2.data.nivel, vip_status:String(c2.data.nivel||'').toUpperCase()==='VIP', origen_captacion:'oh_yeah' } : null);
    if (!base) { setReservaCRM(null); show('Cliente nuevo — no está en el sistema'); return; }
    const ticketProm = base.promedio_ticket || (base.total_visits ? Math.round((base.total_spent||0)/base.total_visits) : 0);
    setReservaCRM({ ...base, ticketProm, ultimaEstrellas: enc.data?.estrellas ?? null, ultimoComentario: enc.data?.comentario || '' });
    setForm(p=>({ ...p, cliente_nombre: p.cliente_nombre || base.name || '', cliente_email: p.cliente_email || base.email || '' }));
    show(`✓ Datos cargados: ${base.name||'cliente'}`);
  };
  const [sugerenciasHora, setSugerenciasHora] = useState<{hora:string,libres:number}[]>([]);
  const [sobreventa, setSobreventa] = useState(0);
  // PDF NEXUM § Roadmap 1 — Modos dinámicos (Base / Smart Peak / Evento Especial)
  const [modoDinamico, setModoDinamico] = useState<'base'|'smart_peak'|'evento'>(() => {
    try { return (localStorage.getItem('omm_modo_dinamico') as any) || 'base'; } catch { return 'base'; }
  });
  const cambiarModo = (m:'base'|'smart_peak'|'evento') => {
    setModoDinamico(m);
    try { localStorage.setItem('omm_modo_dinamico', m); } catch {}
    const labels:any = { base:'Base', smart_peak:'⚡ Smart Peak', evento:'🎉 Evento Especial' };
    show(`Modo: ${labels[m]}`);
  };

  const show = (m:string) => { setToast(m); setTimeout(()=>setToast(''),3000); };

  // Sobreventa VIP — máx 10% (hard stop al 110%). Solo La Crème, Grand Gourmand,
  // socios y clientes estratégicos pueden tomar el cupo extra.
  const cambiarSobreventa = async (pct:number) => {
    const safe = Math.max(0, Math.min(10, pct));
    setSobreventa(safe);
    await supabase.from('reservas_config').upsert(
      { restaurante_id:6, sobreventa_pct:safe, updated_at:new Date().toISOString() },
      { onConflict:'restaurante_id' });
    show(safe>0 ? `⭐ Sobreventa VIP: ${safe}% (hard stop 110%)` : '✓ Sobreventa VIP desactivada');
  };
  const setF = (k:string,v:any) => setForm(p=>({...p,[k]:v}));

  const fetchData = useCallback(async () => {
    setLoading(true);
    const { data: planta } = await supabase.from('planta_mesas').select('*').eq('restaurante_id',6).eq('activa',true).order('num');
    if (planta && planta.length > 0) setPlantaDB(planta);
    supabase.from('reservas_config').select('sobreventa_pct').eq('restaurante_id',6).maybeSingle()
      .then(({data})=>{ if(data) setSobreventa(Math.min(10, data.sobreventa_pct||0)); });
    const [rv, ms, ohyeah] = await Promise.all([
      supabase.from('reservations').select('*').eq('restaurante_id',6).eq('fecha',fechaFiltro).order('hora'),
      supabase.from('tables').select('*').order('name'),
      supabase.from('ohyeah_reservas').select('*').eq('date',fechaFiltro).in('status',['pending','pendiente','confirmed','confirmada','seated','sentada']).order('time'),
    ]);
    const todas = [
      ...(rv.data||[]).map((r:any)=>({...r,origen:'nexum'})),
      ...(ohyeah.data||[]).map((r:any)=>({
        id:r.id, cliente_nombre:r.guest_name, cliente_email:r.guest_email,
        cliente_telefono:r.guest_phone, fecha:r.date, hora:r.time, pax:r.pax,
        estado:(['confirmed','confirmada'].includes(r.status))?'confirmada':r.status==='cancelled'||r.status==='cancelada'?'cancelada':r.status==='seated'||r.status==='sentada'?'sentada':'confirmada',
        ocasion:r.occasion, notas:r.observations, mesa_num:r.mesa_num||null, restaurante_id:6,
        sentado_at:r.mesa_asignada_at||null,
        gourmand_level:r.gourmand_level, is_first_visit:r.is_first_visit,
        visit_count:r.visit_count, mood:r.mood, nexum_brief:r.nexum_brief,
        bono_aplicado:r.bono_aplicado, origen:'ohyeah',
      })),
    ].sort((a:any,b:any)=>(a.fecha||'').localeCompare(b.fecha||'')||(a.hora||'').localeCompare(b.hora||''));
    setReservas(todas);
    if (ms.data) setMesas(ms.data);
    // Meseros = usuarios reales que hacen login (profiles role='mesero').
    // La identidad debe coincidir con la del POS: nombre_completo || full_name.
    supabase.from('profiles').select('id,nombre_completo,full_name,role').eq('role','mesero')
      .then(({data})=>{ if(data) setMeserosLista((data||[]).filter((m:any)=>m.nombre_completo||m.full_name)); });
    setLoading(false);
  },[fechaFiltro]);

  useEffect(()=>{ fetchData(); },[fetchData]);

  useEffect(()=>{
    const ch = supabase.channel('reserve-live')
      .on('postgres_changes',{event:'INSERT',schema:'public',table:'ohyeah_reservas'},(p)=>{
        show(`🦉 Nueva reserva Oh Yeah: ${(p.new as any).guest_name || 'cliente'} — ${(p.new as any).time}`);
        fetchData();
      }).subscribe();
    return ()=>{ supabase.removeChannel(ch); };
  },[fetchData]);

  // ── Cancelar reserva Oh Yeah con notificación ──────────────────
const cancelarOhYeah = async (id:string, guestName:string) => {
  await supabase.from('ohyeah_reservas').update({ status: 'cancelled' }).eq('id', id);
  await supabase.from('nexum_notificaciones').insert({
    restaurante_id: 6, tipo: 'reserva_cancelada',
    titulo: `❌ Reserva cancelada — ${guestName}`,
    mensaje: `La reserva de ${guestName} fue cancelada desde NEXUM`,
    prioridad: 'normal', leida: false,
  }).then(()=>{}).catch(()=>{});
  show(`✓ Reserva de ${guestName} cancelada`);
  fetchData();
};

// ── Confirmar reserva pendiente Oh Yeah ─────────────────────────
const confirmarOhYeah = async (id:string) => {
  await supabase.from('ohyeah_reservas').update({ status: 'confirmed' }).eq('id', id);
  show('✓ Reserva confirmada');
  fetchData();
};

const guardar = async () => {
    if (!form.cliente_nombre) { show('⚠️ Nombre requerido'); return; }
    // Más de 16 personas → evento privado, escribir al restaurante
    if ((form.pax||0) > MAX_PAX_RESERVA) {
      show(`🎉 Grupos de +${MAX_PAX_RESERVA} se reservan por evento — el cliente debe escribir al restaurante`);
      return;
    }
    // Capacidad: si la franja está llena, NO bloqueamos — Soft Denial™ del PDF NEXUM:
    // sugerimos horarios alternativos cercanos con disponibilidad real.
    if (!selected?.id) {
      const { data: disp } = await supabase.rpc('franja_disponibilidad', { p_fecha: form.fecha, p_hora: form.hora });
      if (disp && disp.disponible === false) {
        const addMin = (hhmm:string, d:number) => {
          const [h,m] = hhmm.split(':').map(Number);
          const total = Math.max(0, Math.min(23*60+45, h*60+m+d));
          return `${String(Math.floor(total/60)).padStart(2,'0')}:${String(total%60).padStart(2,'0')}`;
        };
        const deltas = [-60,-45,-30,-15,15,30,45,60];
        const candidatos = deltas.map(d => addMin(form.hora, d));
        const checks = await Promise.all(candidatos.map(h =>
          supabase.rpc('franja_disponibilidad', { p_fecha: form.fecha, p_hora: h })
            .then((r:any) => ({ hora: h, libres: r.data?.disponible ? Math.max(0, (r.data.mesas_total||0) - (r.data.ocupadas||0)) : 0 }))
            .catch(() => ({ hora: h, libres: 0 }))
        ));
        const sug = checks.filter(c => c.libres > 0).sort((a,b)=>b.libres-a.libres).slice(0, 4);
        setSugerenciasHora(sug);
        show(sug.length
          ? `🌟 Recomendamos otra hora — ${sug.length} opciones disponibles`
          : `⚠️ Sin disponibilidad cercana — prueba otra fecha o la lista prioritaria`);
        return;
      }
    }
    setSugerenciasHora([]);
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

const cambiarEstado = async (id:any, estado:string, esOhYeah:boolean=false) => {
  if (esOhYeah) {
    const statusMap: Record<string,string> = {
      confirmada:'confirmed', sentada:'seated',
      completada:'completed', cancelada:'cancelled', pendiente:'pending',
    };
    await supabase.from('ohyeah_reservas').update({ status: statusMap[estado]||estado }).eq('id',id);
  } else {
    await supabase.from('reservations').update({ estado }).eq('id',id);
  }
  show(`✓ ${ESTADOS[estado]?.l||estado}`);
  fetchData();
};

// ── WALK-IN — sentar cliente sin reserva previa ──────────────────
const sentarWalkin = async () => {
  if (!walkin) return;
  if (!walkin.nombre.trim()) { show('⚠️ Nombre requerido'); return; }
  if (!walkin.telefono.trim()) { show('⚠️ Celular requerido'); return; }
  if (!walkin.mesa) { show('⚠️ Selecciona una mesa'); return; }
  if (walkin.pax > MAX_PAX_RESERVA) { show(`🎉 Grupos de +${MAX_PAX_RESERVA} se gestionan como evento`); return; }
  const mesaSel = mesas.find((m:any)=>Number(m.name)===walkin.mesa);
  const rg = rangoMesa(mesaSel?.capacidad || mesaSel?.seats || 4);
  if (walkin.pax < rg.min || walkin.pax > rg.max) {
    show(`⚠️ La mesa ${walkin.mesa} admite ${rg.min}-${rg.max} personas`); return;
  }
  const ahora = new Date();
  const hh = ahora.getHours().toString().padStart(2,'0')+':'+ahora.getMinutes().toString().padStart(2,'0');
  // §2 del doc: el walk-in NO se bloquea por la franja — toma capacidad residual.
  // Registro de la visita walk-in
  await supabase.from('reservations').insert({
    restaurante_id:6, cliente_nombre:walkin.nombre, cliente_email:walkin.email||'', cliente_telefono:walkin.telefono,
    fecha:ahora.toISOString().split('T')[0], hora:hh, pax:walkin.pax, ocasion:'Walk-in', notas:'Walk-in — sentado en sala',
    estado:'sentada', mesa_num:walkin.mesa, sentado_at:new Date().toISOString(),
  }).then(()=>{}).catch(()=>{});
  // Persistir/actualizar el cliente en el CRM (customers) para tener su historial
  if (walkinCRM?.id) {
    await supabase.from('customers').update({
      total_visits: (Number(walkinCRM.total_visits)||0) + 1,
      ultima_visita: ahora.toISOString().split('T')[0],
      ...(walkin.vip && !walkinCRM.vip_status ? { vip_status: true } : {}),
    }).eq('id', walkinCRM.id).then(()=>{}).catch(()=>{});
  } else {
    await supabase.from('customers').insert({
      name: walkin.nombre, phone: walkin.telefono, email: walkin.email || null,
      origen_captacion: 'walk-in', vip_status: !!walkin.vip,
      total_visits: 1, ultima_visita: ahora.toISOString().split('T')[0],
      score: 0, puntos: 0, activo: true,
    }).then(()=>{}).catch(()=>{});
  }
  // La mesa queda VERDE (asignada) en el mapa del POS — con datos del cliente
  await supabase.from('tables').update({
    estado:'asignada', cliente_nombre:walkin.nombre, pax_actual:walkin.pax,
    cliente_telefono:walkin.telefono, cliente_email:walkin.email||null, vip:!!walkin.vip,
    mesero_nombre:null, meseros_compartidos:[], abierta_en:new Date().toISOString(),
  }).eq('name', String(walkin.mesa));
  show(`✓ Walk-in sentado en mesa ${walkin.mesa} — registrado en CRM`);
  setWalkin(null); setWalkinCRM(null);
  fetchData();
};

const asignarMesa = async (reservaId:any, mesaNum:number, meseroNombre?:string) => {
  const esOhYeah = typeof reservaId === 'string' && reservaId.includes('-');
  const reserva = reservas.find((r:any)=>String(r.id)===String(reservaId));
  const mesero = (meseroNombre||'').trim() || null;
  if (esOhYeah) {
    await supabase.from('ohyeah_reservas')
      .update({ status:'seated', mesa_num:mesaNum, mesa_asignada_at:new Date().toISOString(), mesa_asignada_por: mesero })
      .eq('id',reservaId);
  } else {
    await supabase.from('reservations').update({ mesa_num:mesaNum, estado:'sentada', sentado_at:new Date().toISOString() }).eq('id',reservaId);
  }
  // Sentar al cliente: la mesa queda VERDE (asignada) en el mapa del POS.
  // Si el Maître eligió mesero, queda dirigida a él (aparece en SU home);
  // si no, queda en el pool para que cualquier mesero la tome.
  await supabase.from('tables').update({
    estado:'asignada',
    cliente_nombre: reserva?.cliente_nombre || null,
    pax_actual: reserva?.pax || 0,
    mesero_nombre: mesero,
    abierta_en: new Date().toISOString(),
  }).eq('name', String(mesaNum));
  show(mesero ? `✓ Mesa ${mesaNum} asignada a ${mesero}` : `✓ Mesa ${mesaNum} asignada — libre para tomar`);
  fetchData();
};

  const hoy = new Date().toISOString().split('T')[0];
  // reservas ya viene filtrado por la fecha seleccionada (fechaFiltro).
  // No re-filtrar por "hoy" — eso vaciaba la pestaña al cambiar de día.
  const reservasHoy = reservas;
  // Walk-ins NO afectan ocupación esperada (PDF NEXUM § 4 — son capacidad residual)
  const esWalkin = (r:any) => r.ocasion === 'Walk-in' || String(r.notas || '').toLowerCase().includes('walk-in');
  const reservasReales = reservasHoy.filter((r:any) => !esWalkin(r));
  const walkinsCount = reservasHoy.filter(esWalkin).length;
  const ocupacion = mesas.length?Math.round(reservasReales.filter(r=>r.estado==='sentada').length/mesas.length*100):0;

  // PDF NEXUM § Roadmap 2 — Demand Score™
  // Variables: ocupación reservada + histórico + velocidad reservas + fecha especial + hora premium + clima.
  // Clima requiere API externa; el resto se aproxima con datos locales.
  const demandScore = (() => {
    let s = 0;
    s += Math.min(50, ocupacion * 0.5); // ocupación esperada (0-50)
    const dow = new Date(fechaFiltro + 'T00:00:00').getDay(); // 0=dom
    if ([0,4,5,6].includes(dow)) s += 15; // jue-dom = días premium
    const confirmadas = reservasReales.filter((r:any)=>r.estado==='confirmada' || r.estado==='sentada').length;
    s += Math.min(15, confirmadas * 1.5); // velocidad/volumen reservas
    if (modoDinamico === 'smart_peak') s += 10;
    if (modoDinamico === 'evento') s += 20;
    if (sobreventa > 0) s += 5; // presión de demanda
    return Math.min(100, Math.round(s));
  })();
  const demandLabel = demandScore < 30 ? 'Baja' : demandScore < 60 ? 'Media' : demandScore < 85 ? 'Alta' : 'Pico';
  const demandColor = demandScore < 30 ? S.green : demandScore < 60 ? S.gold : demandScore < 85 ? '#FF6B00' : S.red;

  // PDF NEXUM § Roadmap 7 — Shift Pacing Intelligence™
  // Saturación por bloque de hora: agrupa reservas reales por hora HH y muestra picos.
  const horaActual = new Date().toTimeString().slice(0,2);
  const pacingHoraActual = reservasReales.filter((r:any)=>String(r.hora||'').startsWith(horaActual)).length;
  const pacingPico = Math.max(1, ...Array.from({length:24}, (_,h) => {
    const hh = String(h).padStart(2,'0');
    return reservasReales.filter((r:any)=>String(r.hora||'').startsWith(hh)).length;
  }));
  const cocinaSat = mesas.length ? Math.min(100, Math.round(pacingHoraActual / Math.max(1, mesas.length) * 200)) : 0;
  const barraSat = Math.min(100, cocinaSat + (walkinsCount * 10)); // barra incluye walkins
  const servicioSat = ocupacion;

  // PDF NEXUM § Roadmap 4 — Liberación progresiva (mesas reservadas que se aproximan)
  const ahoraTs = Date.now();
  const liberacionesProximas = reservasReales.filter((r:any) => {
    if (r.estado !== 'confirmada' || r.mesa_num) return false;
    const t = new Date(`${r.fecha}T${r.hora || '20:00'}:00`).getTime();
    const horas = (t - ahoraTs) / 3600000;
    return horas > 0 && horas <= 6; // próximas 6 horas sin mesa asignada
  }).length;

  return (
    <div style={{height:'100%',display:'flex',flexDirection:'column',background:S.bg,color:S.t1,fontFamily:"'DM Sans',sans-serif",overflow:'hidden'}}>
      {toast&&<div style={{position:'fixed',bottom:24,left:'50%',transform:'translateX(-50%)',background:'#1e1e2e',border:`1px solid ${S.pink}`,color:'#fff',padding:'10px 28px',borderRadius:50,fontSize:13,fontWeight:700,zIndex:9999}}>{toast}</div>}

      {/* ── MODAL WALK-IN ── */}
      {walkin && (
        <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.85)',zIndex:9998,display:'flex',alignItems:'center',justifyContent:'center',padding:16}} onClick={()=>{setWalkin(null);setWalkinCRM(null);}}>
          <div onClick={e=>e.stopPropagation()} style={{background:S.bg2,border:`1px solid ${S.border}`,borderRadius:20,width:'100%',maxWidth:400,padding:24,maxHeight:'92vh',overflowY:'auto'}}>
            <div style={{fontFamily:"'Syne',sans-serif",fontSize:18,fontWeight:900,marginBottom:3}}>🚶 Sentar Walk-in</div>
            <div style={{fontSize:11,color:S.t3,marginBottom:18}}>Cliente sin reserva — buscamos en CRM antes de sentarlo y queda registrado.</div>

            {/* Celular primero — dispara búsqueda en customers + nexum_clientes_ohyeah */}
            <div style={{fontSize:10,color:S.gold,fontWeight:700,marginBottom:6,textTransform:'uppercase'}}>📱 Celular *</div>
            <input value={walkin.telefono}
              onChange={e=>setWalkin(w=>w?{...w,telefono:e.target.value}:w)}
              onBlur={async e=>{
                const t = e.target.value.trim();
                if (t.length < 7) { setWalkinCRM(null); return; }
                const [c1, c2] = await Promise.all([
                  supabase.from('customers').select('id,name,email,vip_status,total_visits,total_spent,score,puntos,origen_captacion').eq('phone', t).limit(1).maybeSingle(),
                  supabase.from('nexum_clientes_ohyeah').select('id,nombre,email,nivel,visitas,total_reservas,dias_sin_visitar').eq('telefono', t).limit(1).maybeSingle(),
                ]);
                const c = c1.data || (c2.data ? { ...c2.data, name:c2.data.nombre, total_visits:c2.data.visitas, score:0, vip_status:String(c2.data.nivel||'').toUpperCase()==='VIP', origen_captacion:'oh_yeah' } : null);
                if (c) {
                  setWalkinCRM(c);
                  setWalkin(w => w ? { ...w, nombre: w.nombre || c.name || '', email: w.email || c.email || '', vip: w.vip || !!c.vip_status } : w);
                } else setWalkinCRM(null);
              }}
              placeholder="3001234567" inputMode="tel" autoFocus
              style={{width:'100%',padding:'12px 14px',borderRadius:10,border:`1px solid ${walkin.telefono?S.gold:S.border2}`,background:'rgba(255,255,255,0.05)',color:'#fff',fontSize:14,fontWeight:600,outline:'none',marginBottom:10}}/>

            {walkinCRM && (
              <div style={{background:`${S.green}10`,border:`1px solid ${S.green}40`,borderRadius:10,padding:'10px 14px',marginBottom:12,display:'flex',flexDirection:'column',gap:6}}>
                <div style={{display:'flex',alignItems:'center',gap:10}}>
                  <span style={{fontSize:20}}>{walkinCRM.vip_status?'⭐':walkinCRM.origen_captacion==='oh_yeah'?'🦉':'✓'}</span>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{fontSize:12,fontWeight:700,color:S.green}}>
                      Cliente conocido{walkinCRM.vip_status?' · VIP':''}{walkinCRM.origen_captacion==='oh_yeah'?' · Oh Yeah':''}
                    </div>
                    <div style={{fontSize:10,color:S.t3}}>{walkinCRM.name} · {walkinCRM.total_visits||0} visita(s)</div>
                  </div>
                </div>
                {(walkinCRM.score>0 || walkinCRM.nivel) && (
                  <div style={{display:'flex',gap:6,flexWrap:'wrap'}}>
                    {walkinCRM.score>0 && <span style={{fontSize:9,background:`${S.green}1f`,color:S.green,padding:'2px 8px',borderRadius:8,fontWeight:800}}>📊 Score {walkinCRM.score}</span>}
                    {walkinCRM.nivel && <span style={{fontSize:9,background:`${S.gold}1f`,color:S.gold,padding:'2px 8px',borderRadius:8,fontWeight:800}}>🦉 {walkinCRM.nivel}</span>}
                  </div>
                )}
              </div>
            )}

            <div style={{fontSize:10,color:S.gold,fontWeight:700,marginBottom:6,textTransform:'uppercase'}}>Nombre *</div>
            <input value={walkin.nombre} onChange={e=>setWalkin(w=>w?{...w,nombre:e.target.value}:w)}
              placeholder="Ej: Sr. Pérez, Familia López..."
              style={{width:'100%',padding:'10px 14px',borderRadius:10,border:`1px solid ${S.border2}`,background:'rgba(255,255,255,0.05)',color:'#fff',fontSize:13,outline:'none',marginBottom:10}}/>

            <div style={{fontSize:10,color:S.t3,fontWeight:700,marginBottom:6,textTransform:'uppercase'}}>Email (opcional)</div>
            <input value={walkin.email} onChange={e=>setWalkin(w=>w?{...w,email:e.target.value}:w)}
              placeholder="correo@ejemplo.com" inputMode="email"
              style={{width:'100%',padding:'10px 14px',borderRadius:10,border:`1px solid ${S.border2}`,background:'rgba(255,255,255,0.05)',color:'#fff',fontSize:13,outline:'none',marginBottom:12}}/>

            <button onClick={()=>setWalkin(w=>w?{...w,vip:!w.vip}:w)}
              style={{width:'100%',padding:'10px 14px',borderRadius:10,marginBottom:14,cursor:'pointer',fontSize:12,fontWeight:700,display:'flex',alignItems:'center',gap:8,
                border:`1px solid ${walkin.vip?S.gold:S.border2}`,
                background:walkin.vip?`${S.gold}22`:'transparent',
                color:walkin.vip?S.gold:S.t3}}>
              <span style={{fontSize:14}}>{walkin.vip?'⭐':'☆'}</span>
              {walkin.vip?'Cliente VIP — marcado':'Marcar como VIP'}
            </button>

            <div style={{fontSize:10,color:S.t3,fontWeight:700,marginBottom:6,textTransform:'uppercase'}}>Personas</div>
            <div style={{display:'grid',gridTemplateColumns:'repeat(6,1fr)',gap:6,marginBottom:14}}>
              {[1,2,3,4,5,6,7,8,10,12].map(n=>(
                <button key={n} onClick={()=>setWalkin(w=>w?{...w,pax:n}:w)}
                  style={{padding:'8px 0',borderRadius:8,border:`1px solid ${walkin.pax===n?S.purple:S.border2}`,background:walkin.pax===n?`${S.purple}22`:'transparent',color:walkin.pax===n?S.purple:S.t3,fontSize:12,fontWeight:700,cursor:'pointer'}}>{n}</button>
              ))}
            </div>

            <div style={{fontSize:10,color:S.t3,fontWeight:700,marginBottom:6,textTransform:'uppercase'}}>Mesa libre</div>
            <div style={{display:'flex',flexWrap:'wrap',gap:6,marginBottom:18,maxHeight:120,overflowY:'auto'}}>
              {mesas.filter((m:any)=>!m.estado||m.estado==='libre').sort((a:any,b:any)=>Number(a.name)-Number(b.name)).map((m:any)=>(
                <button key={m.id} onClick={()=>setWalkin(w=>w?{...w,mesa:Number(m.name)}:w)}
                  style={{padding:'7px 12px',borderRadius:8,border:`1px solid ${walkin.mesa===Number(m.name)?S.green:S.border2}`,background:walkin.mesa===Number(m.name)?`${S.green}22`:'transparent',color:walkin.mesa===Number(m.name)?S.green:S.t2,fontSize:12,fontWeight:700,cursor:'pointer'}}>
                  M{m.name}
                </button>
              ))}
              {mesas.filter((m:any)=>!m.estado||m.estado==='libre').length===0 && (
                <div style={{fontSize:11,color:S.t3}}>No hay mesas libres</div>
              )}
            </div>

            <div style={{display:'flex',gap:10}}>
              <button onClick={()=>{setWalkin(null);setWalkinCRM(null);}} style={{flex:1,padding:'11px',borderRadius:10,border:`1px solid ${S.border2}`,background:'transparent',color:S.t3,cursor:'pointer',fontSize:13}}>Cancelar</button>
              <button onClick={sentarWalkin} style={{flex:2,padding:'11px',borderRadius:10,border:'none',background:`linear-gradient(135deg,${S.green},#2a9d5a)`,color:'#fff',fontWeight:700,cursor:'pointer',fontSize:13}}>✓ Sentar walk-in</button>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL SELECTOR DE MESA ── */}
      {asignandoMesa && (() => {
        const r = asignandoMesa;
        const pax = r.pax || 2;
        // Cliente VIP — score alto (VIP / Consagrado / Élite)
        const VIP_TIERS = ['VIP','CONSAGRADO','ÉLITE','ELITE','GRAND GOURMAND','LA CREME'];
        const clienteVip = VIP_TIERS.includes(String(r.gourmand_level||'').toUpperCase());
        const tablesList = mesas.map((m:any)=>{
          const num = Number(m.name);
          const planta = Object.values(PLANTA).find(p=>p.num===num);
          return {
            num,
            estado: m.estado || 'libre',
            cap: m.capacidad || m.seats || planta?.cap || 4,
            zona: m.zona || m.zone || planta?.zona || 'Salón',
            cliente: m.cliente_nombre || '',
            vip: m.vip === true,
          };
        }).filter((t:any)=>!isNaN(t.num)).sort((a:any,b:any)=>a.num-b.num);
        const zonas = Array.from(new Set(tablesList.map((t:any)=>t.zona)));
        const libres = tablesList.filter((t:any)=>!t.estado||t.estado==='libre');
        return (
          <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.85)',zIndex:9998,display:'flex',alignItems:'center',justifyContent:'center',padding:16}} onClick={()=>setAsignandoMesa(null)}>
            <div onClick={e=>e.stopPropagation()} style={{background:S.bg2,border:`1px solid ${S.border}`,borderRadius:20,width:'100%',maxWidth:560,maxHeight:'88vh',display:'flex',flexDirection:'column',overflow:'hidden'}}>
              {/* Header del modal */}
              <div style={{padding:'18px 22px',borderBottom:`1px solid ${S.border}`,display:'flex',alignItems:'center',gap:12}}>
                <div style={{width:44,height:44,borderRadius:'50%',background:`${S.blue}20`,border:`2px solid ${S.blue}40`,display:'flex',alignItems:'center',justifyContent:'center',fontFamily:"'Syne',sans-serif",fontSize:18,fontWeight:900,color:S.blue}}>
                  {(r.cliente_nombre||'?').charAt(0).toUpperCase()}
                </div>
                <div style={{flex:1}}>
                  <div style={{fontFamily:"'Syne',sans-serif",fontSize:17,fontWeight:900}}>Asignar mesa</div>
                  <div style={{fontSize:11,color:S.t2}}>{r.cliente_nombre} · <span style={{color:S.blue,fontWeight:700}}>{pax} {pax===1?'persona':'personas'}</span> · {r.hora}</div>
                </div>
                <button onClick={()=>setAsignandoMesa(null)} style={{width:30,height:30,borderRadius:9,border:`1px solid ${S.border2}`,background:'transparent',color:S.t3,cursor:'pointer',fontSize:14}}>✕</button>
              </div>
              {/* Cuerpo: mesas por zona */}
              <div style={{flex:1,overflowY:'auto',padding:'16px 22px'}}>
                {pax > MAX_PAX_RESERVA ? (
                  <div style={{textAlign:'center',padding:'30px 10px'}}>
                    <div style={{fontSize:40,marginBottom:10}}>🎉</div>
                    <div style={{fontFamily:"'Syne',sans-serif",fontSize:15,fontWeight:900,marginBottom:6}}>Grupo de {pax} personas</div>
                    <div style={{fontSize:12,color:S.t2,lineHeight:1.6,maxWidth:340,margin:'0 auto'}}>
                      Las reservas de más de {MAX_PAX_RESERVA} personas se gestionan como <b style={{color:S.gold}}>evento privado</b>.
                      El cliente debe escribir directamente al restaurante para coordinarlo.
                    </div>
                  </div>
                ) : (<>
                {/* Maître elige el mesero que atenderá la mesa */}
                <div style={{marginBottom:16,padding:'12px 14px',borderRadius:12,background:`${S.blue}0d`,border:`1px solid ${S.blue}30`}}>
                  <div style={{fontSize:10,color:S.blue,fontWeight:800,textTransform:'uppercase',letterSpacing:'.08em',marginBottom:7}}>👤 Mesero a cargo</div>
                  <select value={meseroAsignar} onChange={e=>setMeseroAsignar(e.target.value)}
                    style={{width:'100%',background:'rgba(255,255,255,0.05)',border:`1px solid ${S.border2}`,borderRadius:10,padding:'10px 12px',color:'#fff',fontSize:13,outline:'none'}}>
                    <option value="">Sin asignar — libre para tomar</option>
                    {meserosLista.map((ms:any)=>{
                      const nombre = ms.nombre_completo || ms.full_name || '';
                      return <option key={ms.id||nombre} value={nombre}>{nombre}</option>;
                    })}
                  </select>
                  <div style={{fontSize:10,color:S.t3,marginTop:6}}>
                    {meseroAsignar ? `La mesa aparecerá en el home de ${meseroAsignar}.` : 'Cualquier mesero podrá tomarla desde su home.'}
                  </div>
                </div>
                <div style={{fontSize:11,color:S.t3,marginBottom:14}}>
                  {libres.length} mesa{libres.length===1?'':'s'} libre{libres.length===1?'':'s'} ·
                  <span style={{color:S.green,marginLeft:5}}>● apta para {pax}p</span>
                  <span style={{color:S.gold,marginLeft:10}}>⭐ mesa VIP</span>
                  {clienteVip && <span style={{color:S.gold,marginLeft:10,fontWeight:700}}>· Cliente VIP — prioriza las ⭐</span>}
                </div>
                {zonas.map((zona:any)=>{
                  const delZona = tablesList.filter((t:any)=>t.zona===zona);
                  return (
                    <div key={zona} style={{marginBottom:18}}>
                      <div style={{fontSize:10,color:S.t2,fontWeight:700,textTransform:'uppercase',letterSpacing:'.08em',marginBottom:8}}>
                        {ZONA_COLORES[zona]?.label || zona}
                      </div>
                      <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(78px,1fr))',gap:8}}>
                        {delZona.map((t:any)=>{
                          const libre = !t.estado || t.estado==='libre';
                          const rg = rangoMesa(t.cap);
                          const apta = libre && pax>=rg.min && pax<=rg.max;
                          const motivo = pax<rg.min ? `mín ${rg.min}` : pax>rg.max ? `máx ${rg.max}` : '';
                          const seleccionable = libre && apta;
                          // VIP no aptas para cliente normal: igual seleccionable (soft), pero avisa
                          const vipReservada = t.vip && !clienteVip;
                          const col = !libre ? S.t3 : t.vip ? S.gold : apta ? S.green : '#FFB547';
                          return (
                            <button key={t.num} disabled={!seleccionable}
                              onClick={()=>{ asignarMesa(r.id, t.num, meseroAsignar); setAsignandoMesa(null); setMeseroAsignar(''); }}
                              style={{
                                padding:'12px 6px',borderRadius:12,position:'relative',
                                border:`2px solid ${seleccionable?col:'rgba(255,255,255,0.06)'}`,
                                background:seleccionable?`${col}${t.vip?'1f':'12'}`:'rgba(255,255,255,0.02)',
                                cursor:seleccionable?'pointer':'not-allowed',opacity:seleccionable?1:0.4,
                                display:'flex',flexDirection:'column',alignItems:'center',gap:2,transition:'all .15s',
                                boxShadow: t.vip&&seleccionable ? `0 0 10px ${S.gold}40` : 'none',
                              }}>
                              {t.vip && <span style={{position:'absolute',top:3,right:5,fontSize:11}}>⭐</span>}
                              <span style={{fontFamily:"'Syne',sans-serif",fontSize:18,fontWeight:900,color:col}}>M{t.num}</span>
                              <span style={{fontSize:9,color:S.t2,fontWeight:600}}>{rg.min}-{rg.max} pers.</span>
                              <span style={{fontSize:8,color:col,fontWeight:700,textTransform:'uppercase'}}>
                                {!libre ? (t.estado==='ocupada'?'Ocupada':t.estado==='asignada'?'Sentada':'No disp.')
                                  : !apta ? `No apta · ${motivo}`
                                  : t.vip ? (clienteVip ? 'VIP ⭐ ideal' : 'VIP · guárdala')
                                  : 'Apta'}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
                {tablesList.length===0 && <div style={{textAlign:'center',color:S.t3,padding:30}}>No hay mesas configuradas</div>}
                </>)}
              </div>
            </div>
          </div>
        );
      })()}

      {/* Header */}
      <div style={{padding:'14px 24px',borderBottom:`1px solid ${S.border}`,background:S.bg2,display:'flex',alignItems:'center',gap:14,flexShrink:0,flexWrap:'wrap'}}>
        <div style={{display:'flex',alignItems:'center',gap:12}}>
          <div style={{width:44,height:44,borderRadius:13,background:`linear-gradient(135deg,${S.purple},${S.blue})`,display:'flex',alignItems:'center',justifyContent:'center',fontSize:22}}>🗓️</div>
          <div>
            <div style={{fontFamily:"'Syne',sans-serif",fontSize:16,fontWeight:900}}>RESERVE</div>
            <div style={{fontSize:10,color:S.t3,letterSpacing:'.1em',textTransform:'uppercase'}}>Mapa · Reservas · Oh Yeah</div>
          </div>
        </div>
        {[
          {l:'Hoy',v:`${reservasHoy.length} reservas`,c:S.blue},
          {l:'Pax',v:`${reservasReales.reduce((s,r)=>s+(r.pax||0),0)}p`,c:S.purple},
          {l:'Walk-ins',v:`${walkinsCount}`,c:S.cyan},
          {l:'Ocupación',v:`${ocupacion}%`,c:ocupacion>80?S.red:ocupacion>50?S.gold:S.green},
          {l:'Oh Yeah',v:`${reservas.filter(r=>r.origen==='ohyeah').length}`,c:S.gold},
        ].map(k=>(
          <div key={k.l} style={{textAlign:'center',padding:'4px 14px',background:'rgba(255,255,255,0.04)',borderRadius:10}}>
            <div style={{fontSize:9,color:S.t3,textTransform:'uppercase'}}>{k.l}</div>
            <div style={{fontSize:14,fontWeight:700,color:k.c}}>{k.v}</div>
          </div>
        ))}
        <div style={{marginLeft:'auto',display:'flex',gap:8,alignItems:'center',flexWrap:'wrap'}}>
          {/* Modo dinámico (PDF NEXUM Roadmap 1) */}
          <div title="Modo operativo del motor de reservas — afecta Demand Score y políticas de pacing" style={{display:'flex',alignItems:'center',gap:4,background:'rgba(255,255,255,0.04)',border:`1px solid ${modoDinamico!=='base'?S.purple:S.border2}`,borderRadius:10,padding:'3px 6px 3px 10px'}}>
            <span style={{fontSize:10,color:modoDinamico!=='base'?S.purple:S.t3,fontWeight:700,textTransform:'uppercase'}}>🎚️ Modo</span>
            {(['base','smart_peak','evento'] as const).map(m=>{
              const lbl = m==='base'?'Base':m==='smart_peak'?'⚡ Peak':'🎉 Evento';
              const sel = modoDinamico===m;
              return (
                <button key={m} onClick={()=>cambiarModo(m)}
                  style={{padding:'4px 8px',borderRadius:7,border:'none',cursor:'pointer',fontSize:11,fontWeight:800,
                    background:sel?(m==='base'?S.t3:m==='smart_peak'?'#FF6B00':S.purple):'transparent',
                    color:sel?'#000':S.t3}}>{lbl}</button>
              );
            })}
          </div>

          {/* Demand Score™ (PDF NEXUM Roadmap 2) */}
          <div title={`Demand Score — ${demandLabel} (${demandScore}/100). Combina ocupación, día premium, velocidad de reservas y modo dinámico.`}
            style={{display:'flex',alignItems:'center',gap:6,background:`${demandColor}10`,border:`1px solid ${demandColor}44`,borderRadius:10,padding:'4px 10px'}}>
            <span style={{fontSize:10,color:demandColor,fontWeight:800,textTransform:'uppercase'}}>📊 Demand</span>
            <span style={{fontSize:13,color:demandColor,fontWeight:900,letterSpacing:'.02em'}}>{demandScore}</span>
            <span style={{fontSize:9,color:demandColor,fontWeight:700}}>· {demandLabel}</span>
          </div>

          {/* Liberación progresiva (PDF NEXUM Roadmap 4) */}
          {liberacionesProximas > 0 && (
            <div title="Mesas reservadas en las próximas 6h sin asignar — riesgo de no-show o demora"
              style={{display:'flex',alignItems:'center',gap:5,background:`${S.gold}15`,border:`1px solid ${S.gold}55`,borderRadius:10,padding:'4px 10px',cursor:'help'}}>
              <span style={{fontSize:11}}>⏳</span>
              <span style={{fontSize:10,color:S.gold,fontWeight:800,textTransform:'uppercase'}}>Por asignar</span>
              <span style={{fontSize:12,color:S.gold,fontWeight:900}}>{liberacionesProximas}</span>
            </div>
          )}

          {/* Sobreventa VIP y Shift Pacing se configuran/ven en el Cerebro. */}
          <input type="date" value={fechaFiltro} onChange={e=>setFechaFiltro(e.target.value)}
            style={{background:'rgba(255,255,255,0.05)',border:`1px solid ${S.border2}`,borderRadius:8,padding:'7px 12px',color:'#fff',fontSize:12,outline:'none'}}/>
          <button onClick={()=>setWalkin({nombre:'',pax:2,mesa:0,telefono:'',email:'',vip:false})}
            style={{padding:'8px 16px',borderRadius:10,border:`1px solid ${S.green}`,background:`${S.green}18`,color:S.green,fontSize:12,fontWeight:700,cursor:'pointer'}}>
            🚶 Walk-in
          </button>
          <button onClick={()=>{setSelected(null);setReservaCRM(null);setForm({cliente_nombre:'',cliente_email:'',cliente_telefono:'',fecha:hoy,hora:'20:00',pax:2,ocasion:'Sin ocasión especial',notas:'',mesa_num:0});setTab('nueva');}}
            style={{padding:'8px 20px',borderRadius:10,border:'none',background:`linear-gradient(135deg,${S.purple},${S.blue})`,color:'#fff',fontSize:12,fontWeight:700,cursor:'pointer'}}>
            + Nueva reserva
          </button>
        </div>
      </div>

      {/* Shift Pacing y Sobreventa VIP movidos al Cerebro (Settings). */}

      {/* Tabs */}
      <div style={{display:'flex',borderBottom:`1px solid ${S.border}`,background:S.bg2,padding:'0 24px',flexShrink:0}}>
        {([
          {id:'home',l:'🏠 Hoy'},{id:'lista',l:'📋 Lista'},
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
      
{/* ══════════════════════════════════════════════════
    TAB HOME — Dashboard del día con asignación de mesa
═══════════════════════════════════════════════════════ */}
{tab==='home' && (
  <div style={{flex:1,overflowY:'auto',display:'flex',flexDirection:'column',gap:0}}>

    {/* ── KPIs del día ── */}
    <div style={{display:'flex',gap:10,padding:'14px 16px',background:S.bg2,borderBottom:`1px solid ${S.border}`,flexWrap:'wrap'}}>
      {[
        {l:'Total hoy',      v:reservasHoy.length,                                                      c:S.gold},
        {l:'Oh Yeah',        v:reservasHoy.filter((r:any)=>r.origen==='ohyeah').length,                c:'#FFE600'},
        {l:'Confirmadas',    v:reservasHoy.filter((r:any)=>r.estado==='confirmada').length,            c:S.green},
        {l:'Sin mesa',       v:reservasHoy.filter((r:any)=>!r.mesa_num&&r.estado!=='cancelada').length,c:S.red},
        {l:'Pax total',      v:reservasHoy.reduce((s:number,r:any)=>s+(r.pax||0),0),                   c:S.blue},
      ].map(k=>(
        <div key={k.l} style={{textAlign:'center',padding:'8px 14px',background:S.bg3,borderRadius:12,border:`1px solid ${k.c}20`,flex:'1 1 80px'}}>
          <div style={{fontSize:8,color:S.t3,textTransform:'uppercase',marginBottom:2}}>{k.l}</div>
          <div style={{fontFamily:"'Syne',sans-serif",fontSize:22,fontWeight:900,color:k.c}}>{k.v}</div>
        </div>
      ))}
    </div>

    {/* ── Lista de reservas del día como cards ── */}
    <div style={{flex:1,overflowY:'auto',padding:14}}>
      {loading && <div style={{textAlign:'center',padding:40,color:S.t3}}>Cargando...</div>}
      {!loading && reservasHoy.length===0 && (
        <div style={{textAlign:'center',padding:60,color:S.t3}}>
          <div style={{fontSize:48,marginBottom:12}}>🗓️</div>
          <div style={{fontSize:14,fontWeight:700}}>Sin reservas para hoy</div>
          <button onClick={()=>setTab('nueva')} style={{marginTop:16,padding:'10px 24px',borderRadius:10,border:'none',background:`linear-gradient(135deg,${S.gold},#d4943a)`,color:'#000',fontWeight:700,fontSize:13,cursor:'pointer'}}>
            + Crear reserva
          </button>
        </div>
      )}
      <div style={{display:'flex',flexDirection:'column',gap:8}}>
        {reservasHoy.filter((r:any)=>!['completada','cancelada'].includes(r.estado)).map((r:any)=>{
          const est     = ESTADOS[r.estado]||{c:S.t3,l:r.estado};
          const esOhYeah = r.origen==='ohyeah';
          const sinMesa  = !r.mesa_num && r.estado!=='cancelada' && r.estado!=='completada';
          const NIVEL_C: Record<string,string> = {ÉLITE:'#FFD700',VIP:'#B388FF',REGULAR:'#448AFF',INICIADO:'#a0a0a0'};
          const nc = NIVEL_C[r.gourmand_level||''] || S.t3;
          return (
            <div key={r.id} style={{
              background:S.bg2,
              border:`1px solid ${sinMesa?`${S.red}40`:esOhYeah?`${S.gold}30`:S.border}`,
              borderLeft:`4px solid ${sinMesa?S.red:esOhYeah?S.gold:est.c}`,
              borderRadius:14,padding:'12px 16px',
              display:'flex',alignItems:'center',gap:12,flexWrap:'wrap',
            }}>
              {/* Avatar */}
              <div style={{width:42,height:42,borderRadius:'50%',background:`${est.c}20`,border:`2px solid ${est.c}40`,display:'flex',alignItems:'center',justifyContent:'center',fontFamily:"'Syne',sans-serif",fontSize:18,fontWeight:900,color:est.c,flexShrink:0}}>
                {(r.cliente_nombre||'?').charAt(0).toUpperCase()}
              </div>

              {/* Info principal */}
              <div style={{flex:1,minWidth:160}}>
                <div style={{display:'flex',alignItems:'center',gap:6,flexWrap:'wrap',marginBottom:3}}>
                  <span style={{fontWeight:700,fontSize:13,color:S.t1}}>{r.cliente_nombre}</span>
                  {esOhYeah && <span style={{fontSize:9,background:`${S.gold}20`,color:S.gold,border:`1px solid ${S.gold}30`,padding:'1px 7px',borderRadius:20,fontWeight:700}}>🦉 Oh Yeah</span>}
                  {r.gourmand_level && esOhYeah && <span style={{fontSize:9,background:`${nc}15`,color:nc,padding:'1px 6px',borderRadius:20,fontWeight:700}}>{r.gourmand_level}</span>}
                  {r.is_first_visit && esOhYeah && <span style={{fontSize:9,color:S.green,fontWeight:700}}>★ Primera visita</span>}
                </div>
                <div style={{display:'flex',gap:10,flexWrap:'wrap'}}>
                  <span style={{fontSize:11,color:S.gold,fontWeight:700}}>🕐 {r.hora}</span>
                  <span style={{fontSize:11,color:S.blue,fontWeight:700}}>👥 {r.pax} pax</span>
                  {r.ocasion && r.ocasion!=='Sin ocasión especial' && <span style={{fontSize:10,color:S.purple}}>🎉 {r.ocasion}</span>}
                  {(r.mood||'Sin motivo') !== 'Sin motivo especial' && r.mood && <span style={{fontSize:10,color:'#B388FF'}}>✨ {r.mood}</span>}
                  {r.cliente_telefono && <span style={{fontSize:10,color:S.t3}}>📱 {r.cliente_telefono}</span>}
                </div>
              </div>

              {/* Mesa asignada o botón asignar */}
              <div style={{display:'flex',flexDirection:'column',alignItems:'center',gap:4,flexShrink:0}}>
                {r.mesa_num ? (
                  <button onClick={()=>setAsignandoMesa(r)} style={{textAlign:'center',background:'none',border:'none',cursor:'pointer'}}>
                    <div style={{fontFamily:"'Syne',sans-serif",fontSize:24,fontWeight:900,color:S.blue,lineHeight:1}}>M{r.mesa_num}</div>
                    {r.estado==='sentada' && r.sentado_at
                      ? <div style={{fontSize:9,color:S.green,fontWeight:700}}>🪑 {fmtElapsed(r.sentado_at)}</div>
                      : <div style={{fontSize:9,color:S.t3}}>asignada · cambiar</div>}
                  </button>
                ) : (
                  <button
                    onClick={()=>setAsignandoMesa(r)}
                    style={{
                      padding:'8px 14px',borderRadius:10,border:`2px solid ${S.gold}`,
                      background:`${S.gold}15`,color:S.gold,fontSize:11,fontWeight:700,
                      cursor:'pointer',whiteSpace:'nowrap',
                      animation: sinMesa ? 'pulse 2s infinite' : 'none',
                    }}>
                    🪑 Asignar mesa
                  </button>
                )}
              </div>

              {/* Estado + acciones */}
              <div style={{display:'flex',flexDirection:'column',gap:4,alignItems:'flex-end',flexShrink:0}}>
                <span style={{fontSize:10,background:`${est.c}15`,color:est.c,border:`1px solid ${est.c}30`,padding:'2px 10px',borderRadius:20,fontWeight:700}}>{est.l}</span>
                <div style={{display:'flex',gap:4}}>
                  {r.estado==='pendiente'   && <button onClick={()=>cambiarEstado(r.id,'confirmada',esOhYeah)} style={{fontSize:10,padding:'3px 8px',borderRadius:6,border:`1px solid ${S.green}40`,background:`${S.green}10`,color:S.green,cursor:'pointer',fontWeight:700}}>✓ Confirmar</button>}
                  {r.estado==='confirmada'  && <button onClick={()=>setAsignandoMesa(r)}
                    style={{fontSize:10,padding:'3px 8px',borderRadius:6,border:`1px solid ${S.blue}40`,background:`${S.blue}10`,color:S.blue,cursor:'pointer',fontWeight:700}}>🪑 Sentar → Mesa</button>}
                  {r.estado==='sentada'     && <button onClick={()=>cambiarEstado(r.id,'completada',esOhYeah)} style={{fontSize:10,padding:'3px 8px',borderRadius:6,border:`1px solid ${S.green}40`,background:`${S.green}10`,color:S.green,cursor:'pointer',fontWeight:700}}>✅ Completar</button>}
                  {!['cancelada','completada'].includes(r.estado) && <button onClick={()=>esOhYeah?cancelarOhYeah(r.id,r.cliente_nombre):cambiarEstado(r.id,'cancelada',false)} style={{fontSize:10,padding:'3px 8px',borderRadius:6,border:`1px solid ${S.red}40`,background:`${S.red}10`,color:S.red,cursor:'pointer',fontWeight:700}}>✗ Cancelar</button>}
                  {esOhYeah && r.estado==='confirmada' && !r.mesa_num && (
                    <span style={{fontSize:9,color:S.gold,background:`${S.gold}10`,padding:'2px 6px',borderRadius:6}}>Sin mesa</span>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  </div>
)}

{tab==='lista' && (()=>{
        const activas = reservas.filter((r:any)=>!['completada','cancelada'].includes(r.estado));
        const anteriores = reservas.filter((r:any)=>['completada','cancelada'].includes(r.estado));
        const ordenadas = [...activas, ...anteriores];
        return (
        <div style={{flex:1,overflowY:'auto'}}>
          {loading&&<div style={{textAlign:'center',padding:40,color:S.t3}}>Cargando...</div>}
          {!loading&&reservas.length===0&&<div style={{textAlign:'center',padding:60,color:S.t3}}><div style={{fontSize:48,marginBottom:12}}>🗓️</div><div>Sin reservas para esta fecha</div></div>}
          <table style={{width:'100%',borderCollapse:'collapse',fontSize:13}}>
            <thead>
              <tr style={{background:S.bg2,position:'sticky',top:0,zIndex:5}}>
                {['Cliente','⏰ Hora','Pax','Ocasión','Mesa','Estado','Origen','Acciones'].map(h=>(
                  <th key={h} style={{padding:'9px 14px',textAlign:'left',fontSize:10,color:S.t3,fontWeight:700,textTransform:'uppercase',letterSpacing:'.06em',borderBottom:`1px solid ${S.border}`,whiteSpace:'nowrap'}}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {ordenadas.map((r,i)=>{
                const est = ESTADOS[r.estado]||{c:S.t3,l:r.estado};
                const esOhYeah = r.origen==='ohyeah';
                const mostrarDivisor = anteriores.length>0 && i===activas.length;
                return (
                  <React.Fragment key={r.id}>
                  {mostrarDivisor && (
                    <tr><td colSpan={8} style={{padding:'10px 14px',background:S.bg2,color:S.t3,fontSize:10,fontWeight:800,textTransform:'uppercase',letterSpacing:'.08em',borderTop:`1px solid ${S.border}`,borderBottom:`1px solid ${S.border}`}}>📁 Reservas anteriores ({anteriores.length})</td></tr>
                  )}
                  <tr style={{background:i%2===0?S.bg:S.bg2,borderBottom:'1px solid rgba(255,255,255,0.03)',opacity:['completada','cancelada'].includes(r.estado)?0.6:1}}>
                    <td style={{padding:'10px 14px'}}>
                      <div style={{fontWeight:700,display:'flex',alignItems:'center',gap:6}}>
                        {r.cliente_nombre}
                        {esOhYeah&&<span style={{fontSize:9,background:`${S.gold}20`,color:S.gold,padding:'1px 6px',borderRadius:10}}>🦉</span>}
                      </div>
                      <div style={{fontSize:10,color:S.t3}}>{r.cliente_email||''}</div>
                    </td>
                    <td style={{padding:'10px 14px'}}>
                      <div style={{fontSize:17,fontWeight:900,color:S.gold,letterSpacing:'.02em'}}>{r.hora}</div>
                      {r.fecha !== hoy && <div style={{fontSize:10,color:S.t3,marginTop:2}}>{fmt(r.fecha)}</div>}
                    </td>
                    <td style={{padding:'10px 14px',textAlign:'center'}}>
                      <span style={{fontFamily:"'Syne',sans-serif",fontSize:18,fontWeight:900,color:S.blue}}>{r.pax}</span>
                    </td>
                    <td style={{padding:'10px 14px'}}>
                      {r.ocasion&&r.ocasion!=='Sin ocasión especial'?<span style={{fontSize:11,background:`${S.purple}15`,color:S.purple,padding:'2px 8px',borderRadius:20}}>{r.ocasion}</span>:<span style={{color:S.t3,fontSize:11}}>—</span>}
                    </td>
                    <td style={{padding:'10px 14px'}}>
                      {r.mesa_num ? (
                        <button onClick={()=>setAsignandoMesa(r)} style={{display:'flex',alignItems:'center',gap:6,background:'none',border:'none',cursor:'pointer'}}>
                          <span style={{fontSize:12,fontWeight:700,background:`${S.blue}15`,color:S.blue,padding:'3px 10px',borderRadius:20}}>M{r.mesa_num}</span>
                          {r.estado==='sentada' && r.sentado_at && (
                            <span style={{fontSize:10,color:S.green,fontWeight:700}}>🪑 {fmtElapsed(r.sentado_at)}</span>
                          )}
                        </button>
                      ) : ['confirmada','pendiente'].includes(r.estado) ? (
                        <button onClick={()=>setAsignandoMesa(r)}
                          style={{background:`${S.gold}15`,border:`1px solid ${S.gold}40`,borderRadius:7,padding:'4px 10px',color:S.gold,fontSize:10,fontWeight:700,cursor:'pointer'}}>
                          🪑 Asignar
                        </button>
                      ) : <span style={{color:S.t3,fontSize:11}}>—</span>}
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
                        {r.estado==='confirmada'&&<button onClick={()=>setAsignandoMesa(r)} style={{padding:'4px 8px',borderRadius:7,border:`1px solid ${S.blue}40`,background:`${S.blue}10`,color:S.blue,fontSize:10,fontWeight:700,cursor:'pointer'}}>🪑 Sentar</button>}
                        {r.estado==='sentada'&&<button onClick={()=>cambiarEstado(r.id,'completada',esOhYeah)} style={{padding:'4px 8px',borderRadius:7,border:`1px solid ${S.purple}40`,background:`${S.purple}10`,color:S.purple,fontSize:10,fontWeight:700,cursor:'pointer'}}>✅ Cerrar</button>}
                        {!['cancelada','completada'].includes(r.estado)&&<button onClick={()=>cambiarEstado(r.id,'cancelada',esOhYeah)} style={{padding:'4px 8px',borderRadius:7,border:`1px solid ${S.red}40`,background:'transparent',color:S.red,fontSize:10,cursor:'pointer'}}>✗</button>}
                        {!esOhYeah&&<button onClick={()=>{setSelected(r);setForm({...r,mesa_num:r.mesa_num||0});setTab('nueva');}} style={{padding:'4px 8px',borderRadius:7,border:`1px solid ${S.border}`,background:'transparent',color:S.t2,fontSize:10,cursor:'pointer'}}>✏️</button>}
                      </div>
                    </td>
                  </tr>
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
        );
      })()}

      {/* ── MAPA ── */}
      {tab==='mapa' && (
        <>
        {asignandoMesa && (
          <div style={{padding:'10px 16px',background:'rgba(255,181,71,0.12)',borderBottom:'2px solid rgba(255,181,71,0.4)',display:'flex',alignItems:'center',gap:10,flexShrink:0}}>
            <span style={{fontSize:18}}>🗺️</span>
            <div style={{flex:1}}>
              <div style={{fontSize:12,fontWeight:700,color:'#FFB547'}}>Asignando mesa — {asignandoMesa.cliente_nombre}</div>
              <div style={{fontSize:10,color:'#a0a0a0'}}>🕐 {asignandoMesa.hora} · 👥 {asignandoMesa.pax} pax · Toca una mesa libre</div>
            </div>
            <button onClick={()=>{setAsignandoMesa(null);setTab('home');}}
              style={{padding:'4px 12px',borderRadius:8,border:'1px solid rgba(255,181,71,0.4)',background:'transparent',color:'#FFB547',fontSize:11,cursor:'pointer',fontWeight:700}}>
              ✕ Cancelar
            </button>
          </div>
        )}
        <MapaInteractivo
          reservasHoy={reservasHoy}
          fechaFiltro={fechaFiltro}
          onAsignarMesa={(id:any,mesa:number)=>{asignarMesa(id,mesa);setAsignandoMesa(null);setTab('home');}}
          onCambiarEstado={cambiarEstado}
          plantaDB={plantaDB}
          mesas={mesas}
          onToggleVip={async(num:number,vip:boolean)=>{ await supabase.from('tables').update({vip}).eq('name',String(num)); show(vip?`⭐ Mesa ${num} marcada VIP`:`Mesa ${num} ya no es VIP`); fetchData(); }}
          now={now}
          busquedaMesa={busquedaMesa}
          setBusquedaMesa={setBusquedaMesa}
        />
        </>
      )}

      {/* ── EDITOR DE PLANTA ── */}
      {tab==='editor' && (
        <EditorPlanta
          plantaDB={plantaDB}
          setPlantaDB={setPlantaDB}
          editMesa={editMesa}
          setEditMesa={setEditMesa}
          show={show}
          mesas={mesas}
          onToggleVip={async(num:number,vip:boolean)=>{ await supabase.from('tables').update({vip}).eq('name',String(num)); show(vip?`⭐ Mesa ${num} marcada VIP`:`Mesa ${num} ya no es VIP`); fetchData(); }}
        />
      )}

      {/* ── NUEVA / EDITAR ── */}
      {tab==='nueva' && (
        <div style={{flex:1,overflowY:'auto',padding:24}}>
          <div style={{maxWidth:680,margin:'0 auto'}}>
            <div style={{fontFamily:"'Syne',sans-serif",fontSize:16,fontWeight:900,marginBottom:20}}>{selected?'Editar reserva':'Nueva reserva'}</div>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:14}}>
              {/* CELULAR primero — carga datos del sistema (CRM + última encuesta) */}
              <div style={{gridColumn:'1/-1'}}>
                <div style={{fontSize:10,color:S.gold,fontWeight:700,marginBottom:5,textTransform:'uppercase'}}>📱 Teléfono — busca en el sistema</div>
                <div style={{display:'flex',gap:8}}>
                  <input style={{flex:1,background:'rgba(255,255,255,0.05)',border:`1px solid ${form.cliente_telefono?S.gold:S.border2}`,borderRadius:10,padding:'10px 14px',color:'#fff',fontSize:13,outline:'none'}} value={form.cliente_telefono} onChange={e=>setF('cliente_telefono',e.target.value)} onBlur={e=>{const t=e.target.value.trim(); if(t.length>=7) buscarClienteReserva(t);}} placeholder="+57 300 000 0000" inputMode="tel"/>
                  <button type="button" onClick={()=>buscarClienteReserva()} style={{whiteSpace:'nowrap',padding:'10px 16px',borderRadius:10,border:`1px solid ${S.blue}`,background:`${S.blue}18`,color:S.blue,fontSize:12,fontWeight:800,cursor:'pointer'}}>🔎 Cargar datos</button>
                </div>
              </div>
              {reservaCRM && (
                <div style={{gridColumn:'1/-1',background:`${S.green}10`,border:`1px solid ${S.green}40`,borderRadius:12,padding:'12px 16px',display:'flex',flexDirection:'column',gap:8}}>
                  <div style={{display:'flex',alignItems:'center',gap:10}}>
                    <span style={{fontSize:22}}>{reservaCRM.vip_status?'⭐':reservaCRM.origen_captacion==='oh_yeah'?'🦉':'✓'}</span>
                    <div style={{flex:1,minWidth:0}}>
                      <div style={{fontSize:13,fontWeight:800,color:S.green}}>Cliente conocido{reservaCRM.vip_status?' · VIP':''}{reservaCRM.origen_captacion==='oh_yeah'?' · Oh Yeah':''}</div>
                      <div style={{fontSize:11,color:S.t3}}>{reservaCRM.name} · {reservaCRM.total_visits||0} visita(s)</div>
                    </div>
                  </div>
                  <div style={{display:'flex',gap:6,flexWrap:'wrap'}}>
                    <span style={{fontSize:10,background:`${S.green}1f`,color:S.green,padding:'3px 9px',borderRadius:8,fontWeight:800}}>💰 Gasto total ${Number(reservaCRM.total_spent||0).toLocaleString('es-CO')}</span>
                    <span style={{fontSize:10,background:`${S.blue}1f`,color:S.blue,padding:'3px 9px',borderRadius:8,fontWeight:800}}>🎟️ Ticket prom. ${Number(reservaCRM.ticketProm||0).toLocaleString('es-CO')}</span>
                    {reservaCRM.ultimaEstrellas!=null && <span style={{fontSize:10,background:`${S.gold}1f`,color:S.gold,padding:'3px 9px',borderRadius:8,fontWeight:800}}>{'★'.repeat(reservaCRM.ultimaEstrellas)}{'☆'.repeat(Math.max(0,5-reservaCRM.ultimaEstrellas))} última encuesta</span>}
                    {reservaCRM.score>0 && <span style={{fontSize:10,background:`${S.green}1f`,color:S.green,padding:'3px 9px',borderRadius:8,fontWeight:800}}>📊 Score {reservaCRM.score}</span>}
                  </div>
                  {reservaCRM.ultimaEstrellas!=null && reservaCRM.ultimoComentario && (
                    <div style={{fontSize:10,color:S.t3,fontStyle:'italic'}}>"{reservaCRM.ultimoComentario}"</div>
                  )}
                </div>
              )}
              <div style={{gridColumn:'1/-1'}}>
                <div style={{fontSize:10,color:S.t3,fontWeight:700,marginBottom:5}}>NOMBRE *</div>
                <input style={{background:'rgba(255,255,255,0.05)',border:`1px solid ${S.border2}`,borderRadius:10,padding:'10px 14px',color:'#fff',fontSize:13,outline:'none',width:'100%'}} value={form.cliente_nombre} onChange={e=>setF('cliente_nombre',e.target.value)} placeholder="Nombre completo"/>
              </div>
              <div style={{gridColumn:'1/-1'}}>
                <div style={{fontSize:10,color:S.t3,fontWeight:700,marginBottom:5}}>EMAIL</div>
                <input style={{background:'rgba(255,255,255,0.05)',border:`1px solid ${S.border2}`,borderRadius:10,padding:'10px 14px',color:'#fff',fontSize:13,outline:'none',width:'100%'}} value={form.cliente_email} onChange={e=>setF('cliente_email',e.target.value)} placeholder="correo@email.com"/>
              </div>
              <div>
                <div style={{fontSize:10,color:S.t3,fontWeight:700,marginBottom:5}}>FECHA *</div>
                <input type="date" style={{background:'rgba(255,255,255,0.05)',border:`1px solid ${S.border2}`,borderRadius:10,padding:'10px 14px',color:'#fff',fontSize:13,outline:'none',width:'100%'}} value={form.fecha} onChange={e=>setF('fecha',e.target.value)}/>
              </div>
              <div>
                <div style={{fontSize:10,color:S.t3,fontWeight:700,marginBottom:5}}>HORA *</div>
                <input type="time" style={{background:'rgba(255,255,255,0.05)',border:`1px solid ${S.border2}`,borderRadius:10,padding:'10px 14px',color:'#fff',fontSize:13,outline:'none',width:'100%'}} value={form.hora} onChange={e=>{ setF('hora',e.target.value); setSugerenciasHora([]); }}/>
                {sugerenciasHora.length > 0 && (
                  <div style={{marginTop:8,display:'flex',gap:5,flexWrap:'wrap',alignItems:'center'}}>
                    <span style={{fontSize:9,color:S.gold,fontWeight:800,textTransform:'uppercase',letterSpacing:'.08em'}}>🌟 Mejor disponibilidad:</span>
                    {sugerenciasHora.map(s=>(
                      <button key={s.hora} type="button" onClick={()=>{ setF('hora',s.hora); setSugerenciasHora([]); }}
                        style={{padding:'4px 10px',borderRadius:8,border:`1px solid ${S.gold}55`,background:`${S.gold}18`,color:S.gold,fontSize:11,fontWeight:700,cursor:'pointer'}}>
                        {s.hora} <span style={{color:S.green,marginLeft:3}}>· {s.libres} libres</span>
                      </button>
                    ))}
                  </div>
                )}
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
function MapaInteractivo({ reservasHoy, fechaFiltro, onCambiarEstado, plantaDB, mesas, onToggleVip, now, busquedaMesa, setBusquedaMesa }:any) {
  const vipPorNum = new Set((mesas||[]).filter((m:any)=>m.vip).map((m:any)=>Number(m.name)));
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
    if (!reserva?.sentado_at) return null;
    const desde = new Date(reserva.sentado_at).getTime();
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
          <div style={{position:'relative',width:'100%',paddingBottom:'70%',background:'#0a0a12',borderRadius:18,border:'1px solid rgba(255,255,255,0.07)',overflow:'hidden',boxShadow:'inset 0 0 80px rgba(0,0,0,0.6)'}}>
            {/* grid digital de fondo */}
            <div style={{position:'absolute',inset:0,backgroundImage:'linear-gradient(rgba(255,255,255,0.025) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,0.025) 1px,transparent 1px)',backgroundSize:'5% 7%',pointerEvents:'none'}}/>
            <div style={{position:'absolute',inset:0}}>
              {/* Zonas de fondo */}
              {Object.entries(ZONA_AREAS).filter(([z])=>!vistaZona||z===vistaZona).map(([zona,area])=>(
                <div key={zona} style={{position:'absolute',left:`${area.x}%`,top:`${area.y}%`,width:`${area.w}%`,height:`${area.h}%`,background:ZONA_COLORES[zona]?.bg,border:`1px solid ${ZONA_COLORES[zona]?.border}`,borderRadius:14,zIndex:0}}>
                  <div style={{position:'absolute',top:6,left:9,fontSize:8,color:'rgba(255,255,255,0.28)',fontWeight:800,textTransform:'uppercase',letterSpacing:'.1em'}}>{ZONA_COLORES[zona]?.label}</div>
                </div>
              ))}
              {/* COCINA — arriba derecha */}
              <div style={{position:'absolute',left:'69%',top:'7%',width:'29%',height:'33%',background:'linear-gradient(135deg,rgba(255,82,82,0.09),rgba(255,82,82,0.03))',border:'1.5px solid rgba(255,82,82,0.3)',borderRadius:12,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',gap:2,zIndex:0}}>
                <div style={{fontSize:'clamp(11px,1.8vw,20px)'}}>🔥</div>
                <div style={{fontSize:'clamp(6px,0.9vw,10px)',color:'rgba(255,82,82,0.85)',fontWeight:900,textTransform:'uppercase',letterSpacing:'.12em'}}>Cocina</div>
                <div style={{position:'absolute',bottom:'-4%',left:'15%',width:'70%',height:'7%',background:'rgba(255,82,82,0.22)',borderRadius:'0 0 4px 4px',display:'flex',alignItems:'center',justifyContent:'center'}}>
                  <div style={{fontSize:'clamp(4px,0.6vw,7px)',color:'rgba(255,82,82,0.75)',fontWeight:700,letterSpacing:'.1em'}}>DESPACHO</div>
                </div>
              </div>
              {/* HOST — podio */}
              <div style={{position:'absolute',left:'17%',top:'8%',width:'18%',height:'7%',background:'rgba(255,181,71,0.10)',border:'1.5px solid rgba(255,181,71,0.35)',borderRadius:40,display:'flex',alignItems:'center',justifyContent:'center',gap:4,zIndex:0}}>
                <span style={{fontSize:'clamp(7px,1vw,12px)'}}>🛎️</span>
                <span style={{fontSize:'clamp(6px,0.8vw,9px)',color:'rgba(255,181,71,0.85)',fontWeight:900,textTransform:'uppercase',letterSpacing:'.12em'}}>Host</span>
              </div>
              {/* SAKE EXP — vitrina vertical */}
              <div style={{position:'absolute',left:'2%',top:'10%',width:'6%',height:'27%',background:'rgba(179,136,255,0.06)',border:'1.5px solid rgba(179,136,255,0.22)',borderRadius:10,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'space-around',padding:'8px 0',zIndex:0}}>
                {[0,1,2,3,4].map(i=><div key={i} style={{width:'clamp(4px,0.9vw,10px)',height:'clamp(4px,0.9vw,10px)',borderRadius:'50%',background:'rgba(179,136,255,0.25)',border:'1px solid rgba(179,136,255,0.4)'}}/>)}
                <div style={{fontSize:'clamp(4px,0.55vw,7px)',color:'rgba(179,136,255,0.7)',fontWeight:800,writingMode:'vertical-rl',letterSpacing:'.1em'}}>SAKE EXP</div>
              </div>
              {/* CAVA */}
              <div style={{position:'absolute',left:'2%',top:'39%',width:'9%',height:'9%',background:'rgba(255,181,71,0.06)',border:'1.5px solid rgba(255,181,71,0.25)',borderRadius:10,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',gap:1,zIndex:0}}>
                <div style={{fontSize:'clamp(7px,1vw,13px)'}}>🍷</div>
                <div style={{fontSize:'clamp(5px,0.7vw,9px)',color:'rgba(255,181,71,0.75)',fontWeight:800,textTransform:'uppercase'}}>Cava</div>
              </div>
              {/* MESA APOYO */}
              <div style={{position:'absolute',left:'27%',top:'44%',width:'10%',height:'4.5%',background:'rgba(255,255,255,0.04)',border:'1px dashed rgba(255,255,255,0.18)',borderRadius:7,display:'flex',alignItems:'center',justifyContent:'center',zIndex:0}}>
                <div style={{fontSize:'clamp(4px,0.6vw,8px)',color:'rgba(255,255,255,0.35)',fontWeight:700,textTransform:'uppercase',letterSpacing:'.06em'}}>Mesa apoyo</div>
              </div>
              {/* BARRA SUSHI — asientos numerados */}
              <div style={{position:'absolute',left:'34%',top:'24.5%',width:'33%',height:'2.4%',display:'flex',gap:'1.4%',alignItems:'center',justifyContent:'center',zIndex:0}}>
                {[1,2,3,4,5,6,7,8,9,10].map(n=>(
                  <div key={n} style={{flex:1,aspectRatio:'1',maxWidth:14,borderRadius:'50%',background:'rgba(68,139,255,0.18)',border:'1px solid rgba(68,139,255,0.45)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:'clamp(3px,0.55vw,7px)',color:'rgba(120,170,255,0.9)',fontWeight:900}}>{n}</div>
                ))}
              </div>
              {/* TORRE BAR — torre central */}
              <div style={{position:'absolute',left:'80%',top:'70%',width:'8%',height:'14%',background:'linear-gradient(135deg,rgba(155,114,255,0.18),rgba(155,114,255,0.06))',border:'1.5px solid rgba(155,114,255,0.45)',borderRadius:10,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',zIndex:0}}>
                <div style={{fontSize:'clamp(8px,1.3vw,16px)'}}>🍸</div>
                <div style={{fontSize:'clamp(4px,0.55vw,7px)',color:'rgba(155,114,255,0.9)',fontWeight:900,textTransform:'uppercase',letterSpacing:'.08em'}}>Torre</div>
              </div>
              {/* VENTANAL */}
              <div style={{position:'absolute',left:'2%',bottom:'2.2%',width:'96%',height:2,background:'repeating-linear-gradient(90deg,rgba(34,211,238,0.3) 0 14px,transparent 14px 22px)',zIndex:0}}/>
              <div style={{position:'absolute',left:'4%',bottom:'3%',fontSize:'clamp(4px,0.6vw,8px)',color:'rgba(34,211,238,0.35)',fontWeight:700,letterSpacing:'.1em'}}>VENTANAL</div>
              {/* ACCESO */}
              <div style={{position:'absolute',top:'1%',left:'40%',display:'flex',alignItems:'center',gap:3,zIndex:0}}>
                <div style={{width:'clamp(16px,2.5vw,32px)',height:1,background:'rgba(255,255,255,0.12)'}}/>
                <div style={{fontSize:'clamp(5px,0.65vw,8px)',color:'rgba(255,255,255,0.2)',fontWeight:700}}>↑ ACCESO</div>
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
                    style={{position:'absolute',left:`${mesa.x}%`,top:`${mesa.y}%`,width:`${mesa.w}%`,height:`${mesa.h}%`,
                      borderRadius:mesa.shape==='round'?'50%':12,
                      background:`radial-gradient(circle at 50% 35%, ${mesaColor}${isSelected?'40':'22'}, ${mesaColor}0d)`,
                      border:`2px solid ${mesaColor}${isSelected?'':'70'}`,
                      cursor:'pointer',display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',
                      transition:'all .18s cubic-bezier(.34,1.4,.64,1)',
                      boxShadow:enAlerta?`0 0 16px ${mesaColor}90, inset 0 0 12px ${mesaColor}30`
                        :isSelected?`0 0 20px ${mesaColor}70, inset 0 0 14px ${mesaColor}25`
                        :`0 2px 10px rgba(0,0,0,0.4), inset 0 1px 0 ${mesaColor}25`,
                      transform:isSelected?'scale(1.06)':'scale(1)',
                      zIndex:isSelected?3:2}}
                    onClick={()=>setMesaSel(mesaSel?.key===key?null:{key,...mesa,color:mesaColor,label,reserva})}
                  >
                    <div style={{fontFamily:"'Syne',sans-serif",fontSize:'clamp(8px,1.2vw,15px)',fontWeight:900,color:'#fff',lineHeight:1,textShadow:`0 1px 6px ${mesaColor}`}}>M{mesa.num}</div>
                    <div style={{fontSize:'clamp(4px,0.62vw,8px)',color:`${mesaColor}`,fontWeight:700,marginTop:1,background:`${mesaColor}22`,padding:'0 5px',borderRadius:8}}>{mesa.cap||mesa.capacidad}p</div>
                    {/* Cronómetro de estancia */}
                    {mins !== null && (
                      <div style={{fontSize:'clamp(4px,0.6vw,8px)',color:mesaColor,fontWeight:700,marginTop:1}}>
                        {mins < 60 ? `${mins}m` : `${Math.floor(mins/60)}h${mins%60}m`}
                      </div>
                    )}
                    {/* Punto pulsante */}
                    {reserva?.estado==='sentada' && <div style={{position:'absolute',top:2,right:2,width:6,height:6,borderRadius:'50%',background:mesaColor,boxShadow:enAlerta?`0 0 6px ${mesaColor}`:'none'}}/>}
                    {enAlerta && <div style={{position:'absolute',top:-4,left:'50%',transform:'translateX(-50%)',fontSize:9,whiteSpace:'nowrap'}}>⚠️</div>}
                    {/* Indicador VIP (solo lectura — la mesa se marca VIP en el Editor de planta) */}
                    {vipPorNum.has(mesa.num) && (
                      <div title={`Mesa ${mesa.num} · VIP`}
                        style={{position:'absolute',top:-7,left:-5,width:18,height:18,display:'flex',alignItems:'center',justifyContent:'center',
                          background:'rgba(255,181,71,0.95)',border:'1.5px solid #FFB547',borderRadius:'50%',
                          fontSize:'clamp(7px,0.9vw,11px)',color:'#000',boxShadow:'0 0 8px rgba(255,181,71,0.7)',zIndex:4}}>⭐</div>
                    )}
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
                  <div style={{fontSize:14,fontWeight:700}}>{mesaSel.zona}{vipPorNum.has(mesaSel.num)&&<span style={{color:'#FFB547',marginLeft:5}}>⭐ VIP</span>}</div>
                  <div style={{fontSize:10,color:mesaSel.color,fontWeight:700}}>{mesaSel.label}</div>
                  <div style={{fontSize:10,color:'#50506A'}}>{mesaSel.cap||mesaSel.capacidad} personas</div>
                </div>
              </div>
              {/* VIP se marca en el Editor de planta — aquí solo se muestra el estado */}
              {vipPorNum.has(mesaSel.num) && (
                <div style={{width:'100%',marginBottom:12,padding:'9px',borderRadius:9,fontSize:12,fontWeight:700,textAlign:'center',
                  border:'1px solid #FFB547',background:'rgba(255,181,71,0.15)',color:'#FFB547'}}>
                  ⭐ Mesa VIP
                </div>
              )}
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
                    {mesaSel.reserva.estado==='sentada'&&<button onClick={()=>{onCambiarEstado(mesaSel.reserva.id,'completada',mesaSel.reserva.origen==='ohyeah');setMesaSel(null);}} style={{width:'100%',padding:'9px',borderRadius:9,border:'1px solid rgba(179,136,255,0.4)',background:'rgba(179,136,255,0.1)',color:'#B388FF',fontSize:12,fontWeight:700,cursor:'pointer'}}>✅ Cerrar mesa</button>}
                    {!['cancelada','completada'].includes(mesaSel.reserva.estado)&&<button onClick={()=>{onCambiarEstado(mesaSel.reserva.id,'cancelada',mesaSel.reserva.origen==='ohyeah');setMesaSel(null);}} style={{width:'100%',padding:'8px',borderRadius:9,border:'1px solid rgba(255,82,82,0.3)',background:'transparent',color:'#FF5252',fontSize:11,cursor:'pointer'}}>✗ Cancelar</button>}
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
function EditorPlanta({ plantaDB, setPlantaDB, editMesa, setEditMesa, show, mesas, onToggleVip }:any) {
  const esVip = editMesa ? (mesas||[]).some((m:any)=>Number(m.name)===Number(editMesa.num) && m.vip) : false;
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

              <div style={{marginBottom:12}}>
                <div style={{fontSize:10,color:'#50506A',fontWeight:700,marginBottom:6,textTransform:'uppercase'}}>Mesa VIP</div>
                <button onClick={()=>onToggleVip && onToggleVip(editMesa.num, !esVip)}
                  style={{width:'100%',padding:'9px',borderRadius:9,cursor:'pointer',fontSize:12,fontWeight:700,
                    border:`1px solid ${esVip?'#FFB547':'rgba(255,255,255,0.12)'}`,
                    background:esVip?'rgba(255,181,71,0.15)':'transparent',
                    color:esVip?'#FFB547':'#A0A0B8'}}>
                  {esVip?'⭐ Mesa VIP — quitar estrella':'☆ Marcar como mesa VIP'}
                </button>
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
