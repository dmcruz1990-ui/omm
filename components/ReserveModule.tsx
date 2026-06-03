import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase.ts';
import { useAuth } from '../contexts/AuthContext';
import { useRestaurant } from '../contexts/RestaurantContext';
import { ZONAS_POR_RESTAURANTE, VW_PLANO, VH_PLANO, ST_MESA, sizeForMesa } from './PlanoOMM.tsx';

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

type Tab = 'home'|'lista'|'dashboard'|'nueva'|'editor';

interface Reserva {
  id:number;cliente_nombre:string;cliente_email?:string;cliente_telefono?:string;
  fecha:string;hora:string;pax:number;ocasion?:string;notas?:string;
  estado:string;mesa_num?:number;restaurante_nombre?:string;origen?:string;
}

export default function ReserveModule() {
  const { profile } = useAuth();
  const { activeId: restauranteIdActivo, setActiveId, canSwitch, options: restaurantesDisponibles } = useRestaurant();
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
  const [franjaModalOpen, setFranjaModalOpen] = useState(false);
  const [franjasBloqueadas, setFranjasBloqueadas] = useState<any[]>([]);
  // Modal "asignar mesa" tiene dos pestañas: ficha del cliente + selector de mesa.
  const [modalTab, setModalTab] = useState<'info'|'mesa'>('info');
  const [asignandoInfo, setAsignandoInfo] = useState<any>(null);
  useEffect(() => {
    setModalTab('info');
    setAsignandoInfo(null);
    if (!asignandoMesa) return;
    // Cargar datos del CRM cuando se abre el modal — sin bloquear el render.
    const tel = String((asignandoMesa as any).cliente_telefono || '').trim();
    if (!tel) { setAsignandoInfo({ noTel:true }); return; }
    (async () => {
      const [c1, c2, encUlt, encExtrema] = await Promise.all([
        supabase.from('customers').select('id,name,email,vip_status,total_visits,total_spent,promedio_ticket,score,alergias,preferencias,ultima_visita').eq('phone', tel).limit(1).maybeSingle(),
        supabase.from('nexum_clientes_ohyeah').select('id,nombre,nivel,visitas,preferencias,restricciones,notas').eq('telefono', tel).limit(1).maybeSingle(),
        supabase.from('xcare_encuestas').select('estrellas,comentario,created_at').eq('cliente_telefono', tel).order('created_at',{ascending:false}).limit(3),
        supabase.from('xcare_encuestas').select('estrellas,comentario,created_at').eq('cliente_telefono', tel).or('estrellas.eq.1,estrellas.eq.5').order('created_at',{ascending:false}).limit(1).maybeSingle(),
      ]);
      const base = c1.data || (c2.data ? { name:c2.data.nombre, total_visits:c2.data.visitas, vip_status:String(c2.data.nivel||'').toUpperCase()==='VIP', alergias:c2.data.restricciones, preferencias:c2.data.preferencias, nivel:c2.data.nivel } : null);
      const ultimas3 = (encUlt.data||[]).map((e:any)=>Math.round(e.estrellas||0)).filter((n:number)=>n>0);
      setAsignandoInfo({
        base,
        ultimas3,
        comentarioRelevante: encExtrema.data ? { estrellas: encExtrema.data.estrellas, texto: encExtrema.data.comentario||'' } : null,
      });
    })();
  }, [asignandoMesa]);
  useEffect(()=>{ const t=setInterval(()=>setNow(Date.now()),30000); return ()=>clearInterval(t); },[]);
  const [form, setForm]         = useState<any>({
    cliente_nombre:'',cliente_email:'',cliente_telefono:'',
    fecha:new Date().toISOString().split('T')[0],hora:'20:00',
    pax:2,ocasion:'Sin ocasión especial',notas:'',mesa_num:0, canal:'',
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
    const [c1, c2, encUlt, encExtrema] = await Promise.all([
      supabase.from('customers').select('id,name,email,vip_status,total_visits,total_spent,promedio_ticket,score,puntos,origen_captacion,alergias,preferencias').eq('phone', t).limit(1).maybeSingle(),
      supabase.from('nexum_clientes_ohyeah').select('id,nombre,email,nivel,visitas,total_reservas,preferencias,restricciones,notas').eq('telefono', t).limit(1).maybeSingle(),
      supabase.from('xcare_encuestas').select('estrellas,comentario,created_at').eq('cliente_telefono', t).order('created_at',{ascending:false}).limit(3),
      supabase.from('xcare_encuestas').select('estrellas,comentario,created_at').eq('cliente_telefono', t).or('estrellas.eq.1,estrellas.eq.5').order('created_at',{ascending:false}).limit(1).maybeSingle(),
    ]);
    const base = c1.data || (c2.data ? { name:c2.data.nombre, email:c2.data.email, total_visits:c2.data.visitas, total_spent:0, nivel:c2.data.nivel, vip_status:String(c2.data.nivel||'').toUpperCase()==='VIP', origen_captacion:'oh_yeah', alergias:c2.data.restricciones, preferencias:c2.data.preferencias } : null);
    if (!base) {
      // CLIENTE NUEVO — no descartamos, sino que mostramos tag distintivo
      setReservaCRM({ isNew:true, telefono:t });
      show('🆕 Cliente nuevo — completá los datos para crearlo');
      return;
    }
    const ticketProm = base.promedio_ticket || (base.total_visits ? Math.round((base.total_spent||0)/base.total_visits) : 0);
    const ultimasEstrellas = (encUlt.data||[]).map((e:any)=>e.estrellas).filter((n:any)=>typeof n==='number');
    // Tomar comentario relevante: el más reciente con 1 o 5 estrellas (sea de comida o bebida)
    const comentarioRelevante = encExtrema.data ? { estrellas: encExtrema.data.estrellas, texto: encExtrema.data.comentario||'' } : null;
    // Mezclar preferencias y alergias del CRM principal y de Oh Yeah
    const alergias = base.alergias || c2.data?.restricciones || '';
    const preferencias = base.preferencias || c2.data?.preferencias || '';
    setReservaCRM({ ...base, ticketProm, ultimasEstrellas, comentarioRelevante, alergias, preferencias, isNew:false });
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
      { restaurante_id: restauranteIdActivo, sobreventa_pct:safe, updated_at:new Date().toISOString() },
      { onConflict:'restaurante_id' });
    show(safe>0 ? `⭐ Sobreventa VIP: ${safe}% (hard stop 110%)` : '✓ Sobreventa VIP desactivada');
  };
  const setF = (k:string,v:any) => setForm(p=>({...p,[k]:v}));

  const fetchData = useCallback(async () => {
    setLoading(true);
    const { data: planta } = await supabase.from('planta_mesas').select('*').eq('restaurante_id',restauranteIdActivo).eq('activa',true).order('num');
    if (planta && planta.length > 0) setPlantaDB(planta);
    supabase.from('reservas_config').select('sobreventa_pct').eq('restaurante_id',restauranteIdActivo).maybeSingle()
      .then(({data})=>{ if(data) setSobreventa(Math.min(10, data.sobreventa_pct||0)); });
    const [rv, ms, ohyeah] = await Promise.all([
      supabase.from('reservations').select('*').eq('restaurante_id',restauranteIdActivo).eq('fecha',fechaFiltro).order('hora'),
      supabase.from('tables').select('*').eq('restaurante_id',restauranteIdActivo).order('name'),
      supabase.from('ohyeah_reservas').select('*').eq('date',fechaFiltro).in('status',['pending','pendiente','confirmed','confirmada','seated','sentada']).order('time'),
    ]);
    const todas = [
      ...(rv.data||[]).map((r:any)=>({...r,origen:'nexum'})),
      ...(ohyeah.data||[]).map((r:any)=>({
        id:r.id, cliente_nombre:r.guest_name, cliente_email:r.guest_email,
        cliente_telefono:r.guest_phone, fecha:r.date, hora:r.time, pax:r.pax,
        estado:(['confirmed','confirmada'].includes(r.status))?'confirmada':r.status==='cancelled'||r.status==='cancelada'?'cancelada':r.status==='seated'||r.status==='sentada'?'sentada':'confirmada',
        ocasion:r.occasion, notas:r.observations, mesa_num:r.mesa_num||null, restaurante_id: restauranteIdActivo,
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
    supabase.from('profiles').select('id,nombre_completo,full_name,role,restaurante_id,color').eq('role','mesero').eq('restaurante_id', restauranteIdActivo)
      .then(({data})=>{ if(data) setMeserosLista((data||[]).filter((m:any)=>m.nombre_completo||m.full_name)); });
    // Franjas bloqueadas para la fecha activa — afectan Oh Yeah / Google
    supabase.from('reservas_franjas_bloqueadas').select('*').eq('restaurante_id',restauranteIdActivo).eq('fecha',fechaFiltro)
      .then(({data})=>setFranjasBloqueadas(data||[]));
    setLoading(false);
  },[fechaFiltro, restauranteIdActivo]);

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
    restaurante_id: restauranteIdActivo, tipo: 'reserva_cancelada',
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
    // Bloqueo por franjas: si la hora cae dentro de una franja bloqueada, avisar
    const horaForm = (form.hora||'').slice(0,5);
    const franjaBloqueada = (franjasBloqueadas||[]).find((f:any) =>
      form.fecha === fechaFiltro && horaForm >= f.hora_desde.slice(0,5) && horaForm < f.hora_hasta.slice(0,5)
    );
    if (franjaBloqueada) {
      if (!confirm(`🚫 La hora ${horaForm} está en una franja bloqueada (${franjaBloqueada.hora_desde.slice(0,5)}–${franjaBloqueada.hora_hasta.slice(0,5)}${franjaBloqueada.motivo?' · '+franjaBloqueada.motivo:''}). ¿Crear igual? (las reservas manuales pueden sobreescribir el bloqueo)`)) return;
    }
    setSaving(true);
    const payload = {...form,restaurante_id: restauranteIdActivo,estado:'confirmada',mesa_num:form.mesa_num||null};
    if (selected?.id) {
      await supabase.from('reservations').update(payload).eq('id',selected.id);
      show('✓ Reserva actualizada');
    } else {
      await supabase.from('reservations').insert(payload);
      show('✓ Reserva creada');
    }
    // Sincronizar el CRM: si el maitre cambia/agrega datos, los persistimos
    // en customers (origen_captacion=reserva). Idempotente — upsert por phone.
    if (form.cliente_telefono?.trim()) {
      try {
        const existe = await supabase.from('customers').select('id,name,email').eq('phone', form.cliente_telefono.trim()).maybeSingle();
        if (existe.data) {
          const cambios:any = {};
          if (form.cliente_nombre && form.cliente_nombre !== existe.data.name) cambios.name = form.cliente_nombre;
          if (form.cliente_email && form.cliente_email !== existe.data.email) cambios.email = form.cliente_email;
          if (Object.keys(cambios).length > 0) {
            await supabase.from('customers').update(cambios).eq('id', existe.data.id);
          }
        } else {
          await supabase.from('customers').insert({
            name: form.cliente_nombre,
            email: form.cliente_email || null,
            phone: form.cliente_telefono.trim(),
            origen_captacion: 'reserva_maitre',
            activo: true,
          });
        }
      } catch (e) { console.warn('No se pudo sincronizar customer:', e); }
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
    restaurante_id: restauranteIdActivo, cliente_nombre:walkin.nombre, cliente_email:walkin.email||'', cliente_telefono:walkin.telefono,
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

      {/* ── MODAL FRANJA BLOQUEADA ── */}
      {franjaModalOpen && (
        <FranjaBloqueoModal
          fecha={fechaFiltro}
          restauranteId={restauranteIdActivo}
          franjas={franjasBloqueadas}
          onClose={()=>setFranjaModalOpen(false)}
          onChange={async ()=>{
            const { data } = await supabase.from('reservas_franjas_bloqueadas').select('*').eq('restaurante_id',restauranteIdActivo).eq('fecha',fechaFiltro);
            setFranjasBloqueadas(data||[]);
          }}
          show={show}
          S={S}
        />
      )}

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
        // ── Fuente PRINCIPAL: planta_mesas (la planta real del restaurante).
        // tables (estado en vivo) es complemento opcional.
        // Cruzamos con reservations del día para detectar conflictos de horario.
        const horaReserva = (r.hora || '00:00').slice(0,5);
        const minutoReserva = Number(horaReserva.split(':')[0]) * 60 + Number(horaReserva.split(':')[1]);
        const VENTANA_CONFLICTO_MIN = 120; // 2 horas de buffer
        const fuente = plantaDB.length > 0
          ? plantaDB
          : Object.values(PLANTA).map((p:any) => ({ num:p.num, capacidad:p.cap, zona:p.zona, shape:p.shape, x:p.x, y:p.y, w:p.w, h:p.h }));
        const tablesList = fuente.map((p:any) => {
          const num = Number(p.num);
          // Estado en vivo desde tables (si existe)
          const tEnVivo = mesas.find((m:any) => Number(m.name) === num);
          // Conflictos con OTRAS reservas del día asignadas a esta mesa
          const conflicto = (reservas || []).find((res:any) => {
            if (res.id === r.id) return false;
            if (Number(res.mesa_num) !== num) return false;
            const h = (res.hora || '00:00').slice(0,5);
            const m = Number(h.split(':')[0]) * 60 + Number(h.split(':')[1]);
            return Math.abs(m - minutoReserva) <= VENTANA_CONFLICTO_MIN;
          });
          return {
            num,
            estado: tEnVivo?.estado || (conflicto ? 'reservada' : 'libre'),
            cap: p.capacidad || p.cap || tEnVivo?.capacidad || 4,
            zona: p.zona || tEnVivo?.zona || 'Salón',
            cliente: tEnVivo?.cliente_nombre || (conflicto?.cliente_nombre || ''),
            vip: tEnVivo?.vip === true || p.vip === true,
            conflicto,
            // Datos para mini-mapa visual
            x: p.x, y: p.y, w: p.w || 10, h: p.h || 10, shape: p.shape || 'round',
          };
        }).filter((t:any) => !isNaN(t.num)).sort((a:any,b:any) => a.num - b.num);
        const zonas = Array.from(new Set(tablesList.map((t:any) => t.zona)));
        const libres = tablesList.filter((t:any) => t.estado === 'libre' || !t.estado);
        const tieneCoordsXY = tablesList.some((t:any) => typeof t.x === 'number' && typeof t.y === 'number');
        return (
          <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.85)',zIndex:9998,display:'flex',alignItems:'center',justifyContent:'center',padding:16}} onClick={()=>setAsignandoMesa(null)}>
            <div onClick={e=>e.stopPropagation()} style={{background:S.bg2,border:`1px solid ${S.border}`,borderRadius:20,width:'100%',maxWidth:560,maxHeight:'88vh',display:'flex',flexDirection:'column',overflow:'hidden'}}>
              {/* Header del modal */}
              <div style={{padding:'18px 22px',borderBottom:`1px solid ${S.border}`,display:'flex',alignItems:'center',gap:12}}>
                <div style={{width:44,height:44,borderRadius:'50%',background:`${S.blue}20`,border:`2px solid ${S.blue}40`,display:'flex',alignItems:'center',justifyContent:'center',fontFamily:"'Syne',sans-serif",fontSize:18,fontWeight:900,color:S.blue}}>
                  {(r.cliente_nombre||'?').charAt(0).toUpperCase()}
                </div>
                <div style={{flex:1}}>
                  <div style={{fontFamily:"'Syne',sans-serif",fontSize:17,fontWeight:900}}>{r.cliente_nombre}</div>
                  <div style={{fontSize:11,color:S.t2}}>{r.hora} · <span style={{color:S.blue,fontWeight:700}}>{pax} {pax===1?'persona':'personas'}</span>{r.mesa_num?` · M${r.mesa_num}`:''}</div>
                </div>
                <button onClick={()=>setAsignandoMesa(null)} style={{width:30,height:30,borderRadius:9,border:`1px solid ${S.border2}`,background:'transparent',color:S.t3,cursor:'pointer',fontSize:14}}>✕</button>
              </div>
              {/* Pestañas: Info cliente / Asignar mesa */}
              <div style={{display:'flex',borderBottom:`1px solid ${S.border}`,background:S.bg3}}>
                {([{id:'info',l:'👤 Ficha del cliente'},{id:'mesa',l:'🗺️ Asignar mesa'}] as const).map(t=>(
                  <button key={t.id} onClick={()=>setModalTab(t.id)}
                    style={{flex:1,padding:'12px 10px',background:'transparent',border:'none',borderBottom:`2px solid ${modalTab===t.id?S.purple:'transparent'}`,color:modalTab===t.id?S.purple:S.t3,fontSize:12,fontWeight:800,cursor:'pointer',transition:'all .15s'}}>
                    {t.l}
                  </button>
                ))}
              </div>
              {/* Cuerpo */}
              <div style={{flex:1,overflowY:'auto',padding:'16px 22px'}}>
                {modalTab==='info' && (() => {
                  const info = asignandoInfo;
                  const base = info?.base;
                  return (
                    <div style={{display:'flex',flexDirection:'column',gap:14}}>
                      {/* Datos de la reserva */}
                      <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:8}}>
                        <InfoChip label="Hora"   v={(r.hora||'').slice(0,5)} c={S.gold}/>
                        <InfoChip label="Pax"    v={String(pax)} c={S.blue}/>
                        <InfoChip label="Mesa"   v={r.mesa_num?`M${r.mesa_num}`:'Sin'} c={r.mesa_num?S.green:S.red}/>
                      </div>
                      {r.ocasion && r.ocasion!=='Sin ocasión especial' && (
                        <div style={{background:`${S.purple}10`,border:`1px solid ${S.purple}40`,borderRadius:10,padding:'10px 14px',fontSize:12,color:S.purple,fontWeight:700}}>
                          🎉 Ocasión especial: <b>{r.ocasion}</b>
                        </div>
                      )}
                      {r.notas && (
                        <div style={{background:S.bg3,border:`1px solid ${S.border}`,borderRadius:10,padding:'10px 14px'}}>
                          <div style={{fontSize:9,color:S.t3,fontWeight:800,textTransform:'uppercase',letterSpacing:'.12em',marginBottom:4}}>Notas de la reserva</div>
                          <div style={{fontSize:12,color:S.t1,lineHeight:1.5}}>{r.notas}</div>
                        </div>
                      )}
                      {/* Contacto */}
                      <div style={{background:S.bg3,border:`1px solid ${S.border}`,borderRadius:10,padding:'10px 14px',display:'flex',flexDirection:'column',gap:6}}>
                        <div style={{fontSize:9,color:S.t3,fontWeight:800,textTransform:'uppercase',letterSpacing:'.12em'}}>Contacto</div>
                        {r.cliente_telefono && <div style={{fontSize:12,color:S.t1}}>📱 {r.cliente_telefono}</div>}
                        {r.cliente_email && <div style={{fontSize:12,color:S.t1}}>✉ {r.cliente_email}</div>}
                        {r.origen==='ohyeah' && <span style={{alignSelf:'flex-start',fontSize:10,color:'#FFE600',background:'rgba(255,230,0,0.12)',border:'1px solid rgba(255,230,0,0.3)',padding:'2px 8px',borderRadius:8,fontWeight:700}}>🦉 Reserva Oh Yeah</span>}
                      </div>
                      {/* CRM */}
                      {!info && <div style={{textAlign:'center',color:S.t3,fontSize:11,padding:10}}>Cargando ficha CRM…</div>}
                      {info?.noTel && <div style={{textAlign:'center',color:S.t3,fontSize:11,padding:10}}>Sin teléfono para buscar en CRM</div>}
                      {info && !info.noTel && !base && (
                        <div style={{background:`${S.purple}10`,border:`2px solid ${S.purple}`,borderRadius:12,padding:'12px 14px',display:'flex',alignItems:'center',gap:10}}>
                          <span style={{fontSize:24}}>🆕</span>
                          <div>
                            <div style={{fontSize:13,fontWeight:900,color:S.purple,textTransform:'uppercase',letterSpacing:'.04em'}}>Cliente nuevo</div>
                            <div style={{fontSize:11,color:S.t2,marginTop:2}}>Sin historial · primera visita registrada</div>
                          </div>
                        </div>
                      )}
                      {base && (
                        <div style={{background:`${S.green}0a`,border:`1px solid ${S.green}33`,borderRadius:12,padding:'12px 14px',display:'flex',flexDirection:'column',gap:8}}>
                          <div style={{display:'flex',alignItems:'center',gap:10}}>
                            <span style={{fontSize:22}}>{base.vip_status?'⭐':'✓'}</span>
                            <div style={{flex:1}}>
                              <div style={{fontSize:13,fontWeight:800,color:S.green}}>Cliente conocido{base.vip_status?' · VIP':''}{base.nivel?` · ${base.nivel}`:''}</div>
                              <div style={{fontSize:11,color:S.t3}}>{base.total_visits||0} visita{(base.total_visits||0)===1?'':'s'}{base.ultima_visita?` · última ${new Date(base.ultima_visita).toLocaleDateString('es-CO',{day:'numeric',month:'short'})}`:''}</div>
                            </div>
                          </div>
                          <div style={{display:'flex',gap:6,flexWrap:'wrap'}}>
                            {base.promedio_ticket > 0 && <span style={{fontSize:10,background:`${S.blue}1f`,color:S.blue,padding:'3px 9px',borderRadius:8,fontWeight:800}}>🎟️ Ticket prom. ${Number(base.promedio_ticket).toLocaleString('es-CO')}</span>}
                            {info.ultimas3?.length > 0 && (
                              <span style={{fontSize:10,background:`${S.gold}1f`,color:S.gold,padding:'3px 9px',borderRadius:8,fontWeight:800}}>
                                ⭐ Últimas: {info.ultimas3.map((s:number)=>'★'.repeat(s)).join(' · ')}
                              </span>
                            )}
                            {base.alergias && <span style={{fontSize:10,background:`${S.red}1f`,color:S.red,padding:'3px 9px',borderRadius:8,fontWeight:800}}>🚫 Alergias: {Array.isArray(base.alergias)?base.alergias.join(', '):base.alergias}</span>}
                            {base.preferencias && <span style={{fontSize:10,background:`${S.purple}1f`,color:S.purple,padding:'3px 9px',borderRadius:8,fontWeight:800}}>💜 {Array.isArray(base.preferencias)?base.preferencias.join(', '):base.preferencias}</span>}
                          </div>
                          {info.comentarioRelevante && (
                            <div style={{fontSize:11,color:info.comentarioRelevante.estrellas===5?S.green:S.red,fontStyle:'italic',borderLeft:`3px solid ${info.comentarioRelevante.estrellas===5?S.green:S.red}`,paddingLeft:10}}>
                              {info.comentarioRelevante.estrellas===5?'💚':'❤️‍🩹'} {'★'.repeat(info.comentarioRelevante.estrellas)} — "{info.comentarioRelevante.texto}"
                            </div>
                          )}
                        </div>
                      )}
                      {/* CTAs */}
                      <div style={{display:'flex',gap:8,marginTop:4}}>
                        <button onClick={()=>setModalTab('mesa')}
                          style={{flex:1,padding:'12px',borderRadius:10,border:'none',background:`linear-gradient(135deg,${S.purple},${S.blue})`,color:'#fff',fontSize:13,fontWeight:800,cursor:'pointer'}}>
                          🗺️ Asignar mesa →
                        </button>
                        <button onClick={()=>{ setAsignandoMesa(null); setTab('home'); }}
                          style={{padding:'12px 16px',borderRadius:10,border:`1px solid ${S.border2}`,background:'transparent',color:S.t2,fontSize:12,fontWeight:700,cursor:'pointer'}}>
                          Ver en Sala
                        </button>
                      </div>
                    </div>
                  );
                })()}

                {modalTab==='mesa' && (<>
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
                    style={{width:'100%',background:S.bg4,border:`1px solid ${S.border2}`,borderRadius:10,padding:'10px 12px',color:'#fff',fontSize:13,outline:'none',colorScheme:'dark'}}>
                    <option value="" style={{background:S.bg4,color:'#fff'}}>Sin asignar — libre para tomar</option>
                    {meserosLista.map((ms:any)=>{
                      const nombre = ms.nombre_completo || ms.full_name || '';
                      return <option key={ms.id||nombre} value={nombre} style={{background:S.bg4,color:'#fff'}}>{nombre}</option>;
                    })}
                  </select>
                  <div style={{fontSize:10,color:S.t3,marginTop:6}}>
                    {meseroAsignar ? `La mesa aparecerá en el home de ${meseroAsignar}.` : 'Cualquier mesero podrá tomarla desde su home.'}
                  </div>
                </div>
                {(() => {
                  // Solo mostramos mesas disponibles (libres + aptas para el pax).
                  // El arrastre desde el timeline al plano sigue funcionando para
                  // forzar asignaciones (sobreescribir o resolver conflictos).
                  const disponiblesPax = tablesList.filter((t:any) => {
                    const libre = t.estado === 'libre' || !t.estado;
                    const rg = rangoMesa(t.cap);
                    return libre && pax >= rg.min && pax <= rg.max;
                  });
                  return (
                    <div style={{fontSize:11,color:S.t3,marginBottom:14,display:'flex',flexWrap:'wrap',gap:8,alignItems:'center'}}>
                      <span><strong style={{color:S.green,fontSize:13}}>{disponiblesPax.length}</strong> {disponiblesPax.length===1?'mesa disponible':'mesas disponibles'} para {pax}p</span>
                      <span style={{color:S.gold,marginLeft:8}}>⭐ VIP</span>
                      {clienteVip && <span style={{color:S.gold,fontWeight:700,marginLeft:'auto'}}>Cliente VIP — prioriza las ⭐</span>}
                      <span style={{flexBasis:'100%',fontSize:10,color:S.t3,marginTop:4}}>💡 Para forzar otra mesa, arrastrá la reserva desde el timeline al plano de Sala.</span>
                    </div>
                  );
                })()}

                {/* Mini-mapa visual del salón — sólo mesas disponibles */}
                {tieneCoordsXY && (
                  <div style={{marginBottom:18, padding:12, background:S.bg3, borderRadius:12, border:`1px solid ${S.border}`}}>
                    <div style={{fontSize:10,color:S.t2,fontWeight:700,textTransform:'uppercase',letterSpacing:'.08em',marginBottom:8}}>🗺️ Plano · solo mesas disponibles</div>
                    <div style={{position:'relative',width:'100%',paddingBottom:'52%',background:S.bg,borderRadius:10,border:`1px solid ${S.border}`,overflow:'hidden'}}>
                      {tablesList.filter((t:any)=>{
                        const libre = t.estado === 'libre' || !t.estado;
                        const rg = rangoMesa(t.cap);
                        return libre && pax >= rg.min && pax <= rg.max;
                      }).map((t:any) => {
                        const col = t.vip ? S.gold : S.green;
                        const xPos = typeof t.x === 'number' ? t.x : 50;
                        const yPos = typeof t.y === 'number' ? t.y : 50;
                        const wSize = typeof t.w === 'number' && t.w > 0 ? t.w : 9;
                        const hSize = typeof t.h === 'number' && t.h > 0 ? t.h : 9;
                        return (
                          <button key={t.num}
                            onClick={() => { asignarMesa(r.id, t.num, meseroAsignar); setAsignandoMesa(null); setMeseroAsignar(''); }}
                            title={`M${t.num} · ${t.cap}p · ${t.zona}`}
                            style={{
                              position:'absolute',
                              left: `${xPos}%`, top: `${yPos}%`,
                              width: `${wSize}%`, height: `${hSize}%`,
                              borderRadius: t.shape === 'round' ? '50%' : 8,
                              border: `2px solid ${col}`,
                              background: `${col}22`,
                              cursor: 'pointer',
                              display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',gap:1,
                              transition:'all .15s',padding: 0,
                              boxShadow: t.vip ? `0 0 10px ${S.gold}55` : 'none',
                            }}>
                            {t.vip && <span style={{position:'absolute',top:0,right:1,fontSize:8}}>⭐</span>}
                            <span style={{fontFamily:"'Syne',sans-serif",fontSize:'clamp(8px,1.1vw,12px)',fontWeight:900,color:col,lineHeight:1}}>{t.num}</span>
                            <span style={{fontSize:'clamp(5px,0.7vw,8px)',color:S.t2,fontWeight:600,lineHeight:1}}>{t.cap}p</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
                {zonas.map((zona:any)=>{
                  const delZona = tablesList.filter((t:any)=>{
                    if (t.zona !== zona) return false;
                    const libre = t.estado === 'libre' || !t.estado;
                    const rg = rangoMesa(t.cap);
                    return libre && pax >= rg.min && pax <= rg.max;
                  });
                  if (delZona.length === 0) return null;
                  return (
                    <div key={zona} style={{marginBottom:18}}>
                      <div style={{fontSize:10,color:S.t2,fontWeight:700,textTransform:'uppercase',letterSpacing:'.08em',marginBottom:8}}>
                        {ZONA_COLORES[zona]?.label || zona}
                      </div>
                      <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(78px,1fr))',gap:8}}>
                        {delZona.map((t:any)=>{
                          const rg = rangoMesa(t.cap);
                          const col = t.vip ? S.gold : S.green;
                          return (
                            <button key={t.num}
                              onClick={()=>{ asignarMesa(r.id, t.num, meseroAsignar); setAsignandoMesa(null); setMeseroAsignar(''); }}
                              style={{
                                padding:'12px 6px',borderRadius:12,position:'relative',
                                border:`2px solid ${col}`,
                                background:`${col}${t.vip?'1f':'12'}`,
                                cursor:'pointer',
                                display:'flex',flexDirection:'column',alignItems:'center',gap:2,transition:'all .15s',
                                boxShadow: t.vip ? `0 0 10px ${S.gold}55` : 'none',
                              }}>
                              {t.vip && <span style={{position:'absolute',top:3,right:5,fontSize:11}}>⭐</span>}
                              <span style={{fontFamily:"'Syne',sans-serif",fontSize:18,fontWeight:900,color:col}}>M{t.num}</span>
                              <span style={{fontSize:9,color:S.t2,fontWeight:600}}>{rg.min}-{rg.max} pers.</span>
                              <span style={{fontSize:8,color:col,fontWeight:700,textTransform:'uppercase'}}>
                                {t.vip ? (clienteVip ? 'VIP ⭐ ideal' : 'VIP') : 'Disponible'}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
                {(() => {
                  const dispCount = tablesList.filter((t:any) => {
                    const libre = t.estado === 'libre' || !t.estado;
                    const rg = rangoMesa(t.cap);
                    return libre && pax >= rg.min && pax <= rg.max;
                  }).length;
                  return dispCount === 0 ? (
                    <div style={{textAlign:'center',color:S.t3,padding:30,background:`${S.red}08`,borderRadius:12,border:`1px dashed ${S.red}33`}}>
                      <div style={{fontSize:30,marginBottom:6}}>🚫</div>
                      <div style={{fontSize:13,fontWeight:700,color:S.red,marginBottom:4}}>No hay mesas disponibles para {pax}p</div>
                      <div style={{fontSize:11,color:S.t3}}>Arrastrá la reserva desde el timeline al plano para forzar una asignación.</div>
                    </div>
                  ) : null;
                })()}
                </>)}
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
        {/* ═══ NAVEGADOR DE FECHA · arrows + calendar + total ═══ */}
        <NavegadorFecha
          fecha={fechaFiltro}
          setFecha={setFechaFiltro}
          totalReservas={reservasHoy.length}
        />

        {[
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

          {/* Modo dinámico, Sobreventa VIP y Shift Pacing se gestionan desde el Cerebro. */}
          <button onClick={()=>setFranjaModalOpen(true)}
            style={{padding:'8px 14px',borderRadius:10,border:`1px solid ${S.red}55`,background:`${S.red}12`,color:S.red,fontSize:12,fontWeight:700,cursor:'pointer'}}>
            🚫 Franja
          </button>
          <button onClick={()=>setWalkin({nombre:'',pax:2,mesa:0,telefono:'',email:'',vip:false})}
            style={{padding:'8px 16px',borderRadius:10,border:`1px solid ${S.green}`,background:`${S.green}18`,color:S.green,fontSize:12,fontWeight:700,cursor:'pointer'}}>
            🚶 Walk-in
          </button>
          <button onClick={()=>{setSelected(null);setReservaCRM(null);setForm({cliente_nombre:'',cliente_email:'',cliente_telefono:'',fecha:hoy,hora:'20:00',pax:2,ocasion:'Sin ocasión especial',notas:'',mesa_num:0,canal:''});setTab('nueva');}}
            style={{padding:'8px 20px',borderRadius:10,border:'none',background:`linear-gradient(135deg,${S.purple},${S.blue})`,color:'#fff',fontSize:12,fontWeight:700,cursor:'pointer'}}>
            + Nueva reserva
          </button>
        </div>
      </div>

      {/* Shift Pacing y Sobreventa VIP movidos al Cerebro (Settings). */}

      {/* Tabs */}
      <div style={{display:'flex',borderBottom:`1px solid ${S.border}`,background:S.bg2,padding:'0 24px',flexShrink:0}}>
        {([
          {id:'home',l:'✦ Sala'},
          {id:'lista',l:'📋 Lista completa'},
          {id:'nueva',l:'+ Nueva reserva'},
          {id:'editor',l:'⚙️ Editor de planta'},
          {id:'dashboard',l:'📊 Dashboard'},
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
{tab==='home' && (() => {
  // ── Sala unificada: timeline reservas + plano interactivo + KPIs al pie ──
  // Drag de una reserva → drop en una mesa = asigna y, si está confirmada,
  // sienta al cliente automáticamente.
  const activas = reservasHoy.filter((r:any) => !['completada','cancelada'].includes(r.estado));
  const sinMesa = activas.filter((r:any) => !r.mesa_num).length;
  const sentadas = activas.filter((r:any) => r.estado === 'sentada').length;
  const paxTotal = activas.reduce((s:number, r:any) => s + (r.pax || 0), 0);
  const ohYeahCnt = activas.filter((r:any) => r.origen === 'ohyeah').length;

  // Mesas del plano para el drop-area
  const fuente = plantaDB.length > 0 ? plantaDB : Object.values(PLANTA).map((p:any) => ({ num:p.num, capacidad:p.cap, zona:p.zona, shape:p.shape, x:p.x, y:p.y, w:p.w, h:p.h }));
  const mesasPlano = fuente.map((p:any) => {
    const num = Number(p.num);
    const tEnVivo = mesas.find((m:any) => Number(m.name) === num);
    const reservaEnMesa = activas.find((r:any) => Number(r.mesa_num) === num);
    return {
      num,
      cap: p.capacidad || p.cap || 4,
      zona: p.zona || 'Salón',
      x: p.x, y: p.y, w: p.w || 9, h: p.h || 9,
      shape: p.shape || 'round',
      vip: tEnVivo?.vip === true,
      reserva: reservaEnMesa,
      estado: tEnVivo?.estado || (reservaEnMesa ? 'reservada' : 'libre'),
    };
  }).filter((m:any) => !isNaN(m.num));

  return (
    <div style={{flex:1,display:'flex',flexDirection:'column',overflow:'hidden',background:S.bg}}>

      {/* ─── Cuerpo principal: split timeline + plano ─── */}
      <div style={{flex:1,display:'grid',gridTemplateColumns:'minmax(360px, 1fr) 1.4fr',gap:0,overflow:'hidden',background:S.bg}}>

        {/* ═══ IZQUIERDA · Timeline de reservas (draggable) ═══ */}
        <aside style={{borderRight:`1px solid ${S.border}`,display:'flex',flexDirection:'column',overflow:'hidden',background:S.bg}}>
          <div style={{padding:'16px 20px 12px',borderBottom:`1px solid ${S.border}`,display:'flex',alignItems:'baseline',gap:10}}>
            <span style={{fontFamily:"'IBM Plex Mono', monospace",fontSize:10,color:S.gold,letterSpacing:'0.22em',textTransform:'uppercase'}}>{activas.length === 1 ? 'Reserva hoy' : 'Reservas hoy'}</span>
            <span style={{fontFamily:"'Syne',sans-serif",fontSize:22,fontWeight:900,letterSpacing:'-0.02em'}}>{activas.length}</span>
          </div>

          <div style={{flex:1,overflowY:'auto',padding:'8px 16px 16px'}}>
            {loading && <div style={{textAlign:'center',padding:30,color:S.t3,fontSize:12}}>Cargando…</div>}
            {!loading && activas.length === 0 && (
              <div style={{textAlign:'center',padding:50,color:S.t3}}>
                <div style={{fontSize:38,marginBottom:8}}>🗓️</div>
                <div style={{fontSize:13,fontWeight:700,marginBottom:4}}>Sin reservas para hoy</div>
                <div style={{fontSize:11,color:S.t3}}>Crea una desde "+ Nueva" o espera Oh Yeah.</div>
              </div>
            )}

            <div style={{display:'flex',flexDirection:'column',gap:6}}>
              {activas.map((r:any) => {
                const est = ESTADOS[r.estado] || {c:S.t3,l:r.estado};
                const esOhYeah = r.origen === 'ohyeah';
                const sin = !r.mesa_num;
                const NIVEL_C: Record<string,string> = {ÉLITE:'#FFD700',VIP:'#B388FF',REGULAR:'#448AFF',INICIADO:'#a0a0a0'};
                const nc = NIVEL_C[r.gourmand_level||''] || S.t3;
                return (
                  <div key={r.id}
                    draggable
                    onDragStart={(e) => { e.dataTransfer.setData('text/reserva', String(r.id)); e.dataTransfer.effectAllowed = 'move'; }}
                    onClick={() => setAsignandoMesa(r)}
                    title={`Arrastra a una mesa del plano para asignar`}
                    style={{
                      background:S.bg2,
                      border:`1px solid ${sin?`${S.red}45`:esOhYeah?`${S.gold}30`:S.border}`,
                      borderLeft:`3px solid ${sin?S.red:esOhYeah?S.gold:est.c}`,
                      borderRadius:10,
                      padding:'10px 12px',
                      cursor:'grab',
                      display:'flex',alignItems:'center',gap:10,
                      transition:'transform .12s, box-shadow .12s',
                    }}
                    onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.transform = 'translateX(2px)'; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.transform = 'translateX(0)'; }}>

                    {/* Hora gigante a la izquierda */}
                    <div style={{textAlign:'center',minWidth:50}}>
                      <div style={{fontFamily:"'Syne',sans-serif",fontSize:20,fontWeight:800,color:S.gold,letterSpacing:'-0.02em',lineHeight:1}}>{(r.hora||'').slice(0,5)}</div>
                      <div style={{fontFamily:"'IBM Plex Mono', monospace",fontSize:9,color:S.t3,letterSpacing:'.08em',marginTop:2}}>{r.pax}p</div>
                    </div>

                    {/* Nombre y badges */}
                    <div style={{flex:1,minWidth:0}}>
                      <div style={{display:'flex',alignItems:'center',gap:5,flexWrap:'wrap',marginBottom:2}}>
                        <span style={{fontSize:12,fontWeight:700,color:S.t1}}>{r.cliente_nombre}</span>
                        {esOhYeah && <span style={{fontSize:8,background:`${S.gold}25`,color:S.gold,padding:'1px 6px',borderRadius:50,fontWeight:700}}>🦉</span>}
                        {r.gourmand_level && esOhYeah && <span style={{fontSize:8,color:nc,fontWeight:700}}>{r.gourmand_level}</span>}
                      </div>
                      <div style={{fontSize:10,color:S.t3,display:'flex',gap:8,flexWrap:'wrap'}}>
                        {r.ocasion && r.ocasion !== 'Sin ocasión especial' && <span style={{color:S.purple}}>🎉 {r.ocasion}</span>}
                        {r.cliente_telefono && <span>📱 {r.cliente_telefono.slice(-10)}</span>}
                      </div>
                    </div>

                    {/* Mesa asignada o "Arrastra" */}
                    <div style={{textAlign:'right',minWidth:64}}>
                      {r.mesa_num ? (
                        <>
                          <div style={{fontFamily:"'Syne',sans-serif",fontSize:18,fontWeight:900,color:S.blue,lineHeight:1}}>M{r.mesa_num}</div>
                          {r.estado === 'sentada' && r.sentado_at
                            ? <div style={{fontSize:9,color:S.green,fontWeight:700,marginTop:2}}>🪑 {fmtElapsed(r.sentado_at)}</div>
                            : <div style={{fontSize:9,color:S.t3,marginTop:2}}>asignada</div>}
                        </>
                      ) : (
                        <div style={{fontSize:9,color:S.gold,fontWeight:700,letterSpacing:'.05em'}}>↗ ARRASTRA<br/>A MESA</div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </aside>

        {/* ═══ DERECHA · Plano interactivo con drop-receivers ═══ */}
        <section style={{display:'flex',flexDirection:'column',overflow:'hidden',background:S.bg2}}>
          <div style={{padding:'16px 20px 12px',borderBottom:`1px solid ${S.border}`,display:'flex',alignItems:'baseline',gap:10,flexWrap:'wrap'}}>
            <span style={{fontFamily:"'IBM Plex Mono', monospace",fontSize:10,color:S.blue,letterSpacing:'0.22em',textTransform:'uppercase'}}>Plano del salón</span>
            <span style={{fontFamily:"'Syne',sans-serif",fontSize:22,fontWeight:900,letterSpacing:'-0.02em'}}>{mesasPlano.length}<span style={{fontSize:12,fontWeight:400,color:S.t3,marginLeft:6}}>mesas</span></span>
            <div style={{marginLeft:'auto',display:'flex',gap:8,fontSize:10,color:S.t3,letterSpacing:'.05em',flexWrap:'wrap'}}>
              <span><span style={{display:'inline-block',width:8,height:8,borderRadius:'50%',background:S.green,marginRight:4,verticalAlign:'middle'}}/>libre</span>
              <span><span style={{display:'inline-block',width:8,height:8,borderRadius:'50%',background:'#FFB547',marginRight:4,verticalAlign:'middle'}}/>reservada</span>
              <span><span style={{display:'inline-block',width:8,height:8,borderRadius:'50%',background:S.red,marginRight:4,verticalAlign:'middle'}}/>ocupada</span>
              <span><span style={{display:'inline-block',width:8,height:8,borderRadius:'50%',background:S.gold,marginRight:4,verticalAlign:'middle'}}/>VIP</span>
            </div>
          </div>

          <PlanoSalaSVG
            mesas={mesas}
            activas={activas}
            restauranteId={restauranteIdActivo}
            asignarMesa={asignarMesa}
            setAsignandoMesa={setAsignandoMesa}
            onToggleVip={async(mesaId:number, vip:boolean)=>{
              await supabase.from('tables').update({ vip }).eq('id', mesaId);
              show(vip?'⭐ Mesa marcada VIP':'Mesa ya no es VIP');
              fetchData();
            }}
            onNuevaConMesa={(mesaNum:number)=>{
              // Maitre/Admin/Host pueden clickear una mesa vacía para crear reserva.
              setSelected(null);
              setReservaCRM(null);
              setForm({
                cliente_nombre:'',cliente_email:'',cliente_telefono:'',
                fecha:fechaFiltro,hora:'20:00',pax:2,
                ocasion:'Sin ocasión especial',notas:'',mesa_num:mesaNum,canal:''
              });
              setTab('nueva');
            }}
          />
        </section>
      </div>

      {/* ═══ KPIs al PIE (no en el header, como pediste) ═══ */}
      <footer style={{padding:'12px 24px',borderTop:`1px solid ${S.border}`,background:S.bg2,display:'flex',gap:28,alignItems:'center',flexWrap:'wrap'}}>
        <span style={{fontFamily:"'IBM Plex Mono', monospace",fontSize:9,color:S.t3,letterSpacing:'.22em',textTransform:'uppercase'}}>
          {new Date(fechaFiltro+'T12:00:00').toLocaleDateString('es-CO',{weekday:'long',day:'numeric',month:'long'})}
        </span>
        <FooterStat label={activas.length === 1 ? 'Reserva hoy' : 'Reservas hoy'} v={activas.length}  c={S.gold}/>
        <FooterStat label="Oh Yeah"      v={ohYeahCnt}       c="#FFE600"/>
        <FooterStat label="Sentadas"     v={sentadas}        c={S.green}/>
        <FooterStat label="Sin mesa"     v={sinMesa}         c={sinMesa>0?S.red:S.t2}/>
        <FooterStat label="Pax total"    v={paxTotal}        c={S.blue}/>
        <span style={{marginLeft:'auto',fontSize:10,color:S.t3,letterSpacing:'.06em'}}>💡 Arrastra una reserva al plano para asignar mesa</span>
      </footer>
    </div>
  );
})()}

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

      {/* ── DASHBOARD · vista 360° del team de reservas ── */}
      {tab==='dashboard' && (
        <DashboardReservas
          reservas={reservas}
          reservasHoy={reservasHoy}
          mesas={mesas}
          meserosLista={meserosLista}
          franjasBloqueadas={franjasBloqueadas}
          fechaFiltro={fechaFiltro}
          S={S}
        />
      )}

      {/* ── EDITOR DE PLANTA · SVG con mismas zonas que Sala ── */}
      {tab==='editor' && (
        <EditorPlanta
          editMesa={editMesa}
          setEditMesa={setEditMesa}
          show={show}
          mesas={mesas}
          restauranteId={restauranteIdActivo}
          onRefresh={fetchData}
        />
      )}

      {/* ── NUEVA / EDITAR ── */}
      {tab==='nueva' && (
        <div style={{flex:1,overflowY:'auto',padding:24}}>
          <div style={{maxWidth:680,margin:'0 auto'}}>
            <div style={{fontFamily:"'Syne',sans-serif",fontSize:16,fontWeight:900,marginBottom:20}}>{selected?'Editar reserva':'Nueva reserva'}</div>

            {/* ── CANAL DE RESERVA · cómo llegó el cliente ── */}
            <div style={{marginBottom:18,padding:14,background:`${S.cyan}0a`,border:`1px solid ${S.cyan}33`,borderRadius:12}}>
              <div style={{fontSize:10,color:S.cyan,fontWeight:800,marginBottom:8,textTransform:'uppercase',letterSpacing:'.16em'}}>📡 Canal de reserva</div>
              <div style={{display:'grid',gridTemplateColumns:'repeat(4, 1fr)',gap:8}}>
                {[
                  {v:'whatsapp', l:'WhatsApp',  ico:'💬', col:'#25D366'},
                  {v:'telefono', l:'Teléfono',  ico:'📞', col:S.blue},
                  {v:'walk_in',  l:'Walk-in',   ico:'🚶', col:S.green},
                  {v:'conserje', l:'Conserje',  ico:'🛎️', col:S.purple},
                ].map(c=>{
                  const sel = form.canal === c.v;
                  return (
                    <button key={c.v} type="button" onClick={()=>setF('canal', sel?'':c.v)}
                      style={{
                        padding:'12px 10px',
                        borderRadius:10,
                        border:`1.5px solid ${sel?c.col:S.border2}`,
                        background: sel?`${c.col}18`:'transparent',
                        color: sel?c.col:S.t2,
                        fontSize:12,fontWeight:800,cursor:'pointer',
                        display:'flex',flexDirection:'column',alignItems:'center',gap:4,
                        transition:'all .15s',
                      }}>
                      <span style={{fontSize:20}}>{c.ico}</span>
                      <span>{c.l}</span>
                    </button>
                  );
                })}
              </div>
              {form.canal && (
                <div style={{fontSize:10,color:S.t3,marginTop:6}}>Se registrará para reporte de captación · podés cambiarlo después.</div>
              )}
            </div>

            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:14}}>
              {/* CELULAR primero — carga datos del sistema (CRM + última encuesta) */}
              <div style={{gridColumn:'1/-1'}}>
                <div style={{fontSize:10,color:S.gold,fontWeight:700,marginBottom:5,textTransform:'uppercase'}}>📱 Teléfono — busca en el sistema</div>
                <div style={{display:'flex',gap:8}}>
                  <input style={{flex:1,background:'rgba(255,255,255,0.05)',border:`1px solid ${form.cliente_telefono?S.gold:S.border2}`,borderRadius:10,padding:'10px 14px',color:'#fff',fontSize:13,outline:'none'}} value={form.cliente_telefono} onChange={e=>setF('cliente_telefono',e.target.value)} onBlur={e=>{const t=e.target.value.trim(); if(t.length>=7) buscarClienteReserva(t);}} placeholder="+57 300 000 0000" inputMode="tel"/>
                  <button type="button" onClick={()=>buscarClienteReserva()} style={{whiteSpace:'nowrap',padding:'10px 16px',borderRadius:10,border:`1px solid ${S.blue}`,background:`${S.blue}18`,color:S.blue,fontSize:12,fontWeight:800,cursor:'pointer'}}>🔎 Cargar datos</button>
                </div>
              </div>
              {reservaCRM?.isNew && (
                <div style={{gridColumn:'1/-1',background:`${S.purple}15`,border:`2px solid ${S.purple}`,borderRadius:12,padding:'14px 16px',display:'flex',alignItems:'center',gap:12}}>
                  <span style={{fontSize:26}}>🆕</span>
                  <div style={{flex:1}}>
                    <div style={{fontSize:14,fontWeight:900,color:S.purple,letterSpacing:'.02em',textTransform:'uppercase'}}>Cliente Nuevo</div>
                    <div style={{fontSize:11,color:S.t2,marginTop:2}}>Sin historial · se creará en el CRM al guardar la reserva</div>
                  </div>
                </div>
              )}
              {reservaCRM && !reservaCRM.isNew && (
                <div style={{gridColumn:'1/-1',background:`${S.green}10`,border:`1px solid ${S.green}40`,borderRadius:12,padding:'12px 16px',display:'flex',flexDirection:'column',gap:8}}>
                  <div style={{display:'flex',alignItems:'center',gap:10}}>
                    <span style={{fontSize:22}}>{reservaCRM.vip_status?'⭐':reservaCRM.origen_captacion==='oh_yeah'?'🦉':'✓'}</span>
                    <div style={{flex:1,minWidth:0}}>
                      <div style={{fontSize:13,fontWeight:800,color:S.green}}>Cliente conocido{reservaCRM.vip_status?' · VIP':''}{reservaCRM.origen_captacion==='oh_yeah'?' · Oh Yeah':''}</div>
                      <div style={{fontSize:11,color:S.t3}}>{reservaCRM.name} · {reservaCRM.total_visits||0} visita(s)</div>
                    </div>
                  </div>
                  <div style={{display:'flex',gap:6,flexWrap:'wrap'}}>
                    <span style={{fontSize:10,background:`${S.blue}1f`,color:S.blue,padding:'3px 9px',borderRadius:8,fontWeight:800}}>🎟️ Ticket prom. ${Number(reservaCRM.ticketProm||0).toLocaleString('es-CO')}</span>
                    {reservaCRM.ultimasEstrellas?.length > 0 && (
                      <span style={{fontSize:10,background:`${S.gold}1f`,color:S.gold,padding:'3px 9px',borderRadius:8,fontWeight:800}}>
                        ⭐ Últimas visitas: {reservaCRM.ultimasEstrellas.map((s:number)=>'★'.repeat(s)).join(' · ')}
                      </span>
                    )}
                    {reservaCRM.alergias && <span style={{fontSize:10,background:`${S.red}1f`,color:S.red,padding:'3px 9px',borderRadius:8,fontWeight:800}}>🚫 Alergias: {reservaCRM.alergias}</span>}
                    {reservaCRM.preferencias && <span style={{fontSize:10,background:`${S.purple}1f`,color:S.purple,padding:'3px 9px',borderRadius:8,fontWeight:800}}>🦉 Oh Yeah · {reservaCRM.preferencias}</span>}
                    {reservaCRM.score>0 && <span style={{fontSize:10,background:`${S.green}1f`,color:S.green,padding:'3px 9px',borderRadius:8,fontWeight:800}}>📊 Score {reservaCRM.score}</span>}
                  </div>
                  {reservaCRM.comentarioRelevante && (
                    <div style={{fontSize:11,color:reservaCRM.comentarioRelevante.estrellas===5?S.green:S.red,fontStyle:'italic',borderLeft:`3px solid ${reservaCRM.comentarioRelevante.estrellas===5?S.green:S.red}`,paddingLeft:10}}>
                      {reservaCRM.comentarioRelevante.estrellas===5?'💚':'❤️‍🩹'} {'★'.repeat(reservaCRM.comentarioRelevante.estrellas)} — "{reservaCRM.comentarioRelevante.texto}"
                    </div>
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
function EditorPlanta({ editMesa, setEditMesa, show, mesas, restauranteId, onRefresh }:any) {
  // Editor de planta SVG · misma estética que la Sala (zonas + posiciones en
  // pixeles 1280×920). Edita directamente la tabla `tables`.
  const conf = ZONAS_POR_RESTAURANTE[restauranteId];
  const zonas = conf?.zonas || {};
  const orden = conf?.orden || [];
  const svgRef = React.useRef<SVGSVGElement>(null);
  const dragRef = React.useRef<{ id:any; offX:number; offY:number; moved:boolean } | null>(null);
  const [dragging, setDragging] = React.useState<any>(null);
  const [localMesas, setLocalMesas] = React.useState<any[]>(mesas||[]);
  React.useEffect(()=>setLocalMesas(mesas||[]), [mesas]);

  const inp: React.CSSProperties = {width:'100%',padding:'7px 10px',borderRadius:7,border:'1px solid rgba(255,255,255,0.12)',background:'rgba(255,255,255,0.04)',color:'#fff',fontSize:12,outline:'none'};

  const svgPoint = (clientX:number, clientY:number) => {
    const svg = svgRef.current; if (!svg) return { x:0, y:0 };
    const pt = svg.createSVGPoint(); pt.x = clientX; pt.y = clientY;
    const ctm = svg.getScreenCTM(); if (!ctm) return { x:0, y:0 };
    const p = pt.matrixTransform(ctm.inverse());
    return { x: Math.round(p.x), y: Math.round(p.y) };
  };

  const inferZona = (x:number, y:number):string => {
    for (const z of orden) {
      const a = zonas[z]?.area; if (!a) continue;
      if (x>=a.x && x<=a.x+a.w && y>=a.y && y<=a.y+a.h) return z;
    }
    return orden[0] || 'Salón';
  };

  const agregarMesaEn = async (px:number, py:number) => {
    // Calcular el siguiente número libre
    const usados = (localMesas||[]).map((m:any)=>parseInt(m.name,10)).filter((n:number)=>!isNaN(n));
    const newNum = (usados.length?Math.max(...usados):0) + 1;
    const zona = inferZona(px, py);
    const payload = {
      restaurante_id: restauranteId,
      name: String(newNum),
      capacidad: 4,
      zona,
      shape: 'round',
      posicion_x: px,
      posicion_y: py,
      activa: true,
      estado: 'libre',
      vip: false,
    };
    const { data, error } = await supabase.from('tables').insert(payload).select().single();
    if (error) { show(`⚠ ${error.message}`); return; }
    if (data) {
      setLocalMesas(p=>[...p, data]);
      setEditMesa({ ...data });
      show(`✓ Mesa ${newNum} agregada en ${zona}`);
      onRefresh && onRefresh();
    }
  };

  const onMesaMouseDown = (e: React.MouseEvent, mesa: any) => {
    e.stopPropagation();
    const p = svgPoint(e.clientX, e.clientY);
    dragRef.current = { id: mesa.id, offX: p.x - mesa.posicion_x, offY: p.y - mesa.posicion_y, moved: false };
    setDragging(mesa.id);
    e.preventDefault();
  };

  React.useEffect(() => {
    const onMove = (e: MouseEvent) => {
      const d = dragRef.current; if (!d) return;
      const p = svgPoint(e.clientX, e.clientY);
      const nx = Math.max(20, Math.min(VW_PLANO-20, p.x - d.offX));
      const ny = Math.max(20, Math.min(VH_PLANO-20, p.y - d.offY));
      d.moved = true;
      setLocalMesas(prev => prev.map(m => m.id===d.id ? { ...m, posicion_x: Math.round(nx), posicion_y: Math.round(ny) } : m));
      if (editMesa?.id === d.id) setEditMesa((p:any) => ({ ...p, posicion_x: Math.round(nx), posicion_y: Math.round(ny) }));
    };
    const onUp = async () => {
      const d = dragRef.current; if (!d) return;
      const moved = d.moved; const id = d.id;
      dragRef.current = null; setDragging(null);
      if (moved) {
        const m = localMesas.find(x => x.id === id);
        if (m) {
          await supabase.from('tables').update({ posicion_x: m.posicion_x, posicion_y: m.posicion_y, zona: inferZona(m.posicion_x, m.posicion_y) }).eq('id', id);
        }
      }
    };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
    return () => { document.removeEventListener('mousemove', onMove); document.removeEventListener('mouseup', onUp); };
  }, [localMesas, editMesa]);

  const toggleVip = async (mesa:any, vipNuevo:boolean) => {
    await supabase.from('tables').update({ vip: vipNuevo }).eq('id', mesa.id);
    setLocalMesas(p=>p.map(m=>m.id===mesa.id?{...m, vip:vipNuevo}:m));
    if (editMesa?.id===mesa.id) setEditMesa((p:any)=>({...p, vip:vipNuevo}));
    show(vipNuevo?`⭐ ${mesa.name} VIP`:`Mesa ${mesa.name} sin VIP`);
    onRefresh && onRefresh();
  };

  const guardarMesa = async () => {
    const { id, name, capacidad, shape, zona, vip, posicion_x, posicion_y } = editMesa;
    await supabase.from('tables').update({ name, capacidad, shape, zona, vip, posicion_x, posicion_y }).eq('id', id);
    setLocalMesas(p=>p.map(m=>m.id===id?{...m, name, capacidad, shape, zona, vip, posicion_x, posicion_y}:m));
    setEditMesa(null);
    show('✓ Mesa actualizada');
    onRefresh && onRefresh();
  };

  const eliminarMesa = async () => {
    if (!confirm(`¿Eliminar la mesa ${editMesa.name}? No se puede deshacer.`)) return;
    await supabase.from('tables').update({ activa: false }).eq('id', editMesa.id);
    setLocalMesas(p=>p.filter(m=>m.id!==editMesa.id));
    const nm = editMesa.name;
    setEditMesa(null);
    show(`Mesa ${nm} eliminada`);
    onRefresh && onRefresh();
  };

  // ── Render del SVG (misma paleta neon suave que PlanoSalaSVG) ──
  const NEON = {
    bgOuter:'#0e0e18', bgInner:'#13131f',
    grid:'rgba(120,120,180,0.05)',
    libre:    { fill:'#162621', stroke:'#3DBE8B', text:'#D8F4E5' },
    vip:      { stroke:'#D4AF3D' },
  };

  const visibles = localMesas.filter((m:any)=>m.activa!==false && m.posicion_x!=null && m.posicion_y!=null);

  return (
    <div style={{flex:1,overflow:'hidden',display:'flex',flexDirection:'column'}}>
      {/* Toolbar */}
      <div style={{padding:'10px 20px',borderBottom:'1px solid rgba(255,255,255,0.07)',background:'#0f0f1a',display:'flex',gap:10,alignItems:'center',flexShrink:0,flexWrap:'wrap'}}>
        <div style={{fontSize:12,color:'#A0A0B8',fontWeight:700}}>⚙️ Editor de planta — mismo plano que Sala</div>
        <div style={{fontSize:11,color:'#50506A'}}>Click vacío para agregar · Click mesa para editar · Arrastra para mover · ★ marca VIP</div>
        <button onClick={()=>{
            // Si no hay zonas configuradas, ponemos la mesa en el centro
            const cx = VW_PLANO/2, cy = VH_PLANO/2;
            agregarMesaEn(cx, cy);
          }}
          style={{marginLeft:'auto',padding:'7px 16px',borderRadius:9,border:'none',background:'linear-gradient(135deg,#3DBE8B,#1d8a5d)',color:'#000',fontSize:12,fontWeight:700,cursor:'pointer'}}>
          + Agregar mesa
        </button>
      </div>

      <div style={{flex:1,overflow:'hidden',display:'flex'}}>
        {/* Canvas SVG */}
        <div style={{flex:1,overflow:'auto',padding:18,background:NEON.bgOuter}}>
          <svg ref={svgRef} viewBox={`0 0 ${VW_PLANO} ${VH_PLANO}`} width="100%"
            style={{display:'block',background:`radial-gradient(circle at 50% 30%, #1a1a2a 0%, ${NEON.bgInner} 70%)`,borderRadius:14,boxShadow:'inset 0 0 60px rgba(0,0,0,0.6)',cursor: dragging?'grabbing':'crosshair',userSelect:'none'}}
            onDoubleClick={(e)=>{
              if ((e.target as Element).tagName === 'svg' || (e.target as Element).tagName === 'rect') {
                const p = svgPoint(e.clientX, e.clientY);
                agregarMesaEn(p.x, p.y);
              }
            }}>
            <defs>
              <pattern id="editorGrid" width="40" height="40" patternUnits="userSpaceOnUse">
                <path d="M 40 0 L 0 0 0 40" fill="none" stroke={NEON.grid} strokeWidth="1"/>
              </pattern>
            </defs>

            <rect x={0} y={0} width={VW_PLANO} height={VH_PLANO} fill="url(#editorGrid)"/>

            {/* Zonas */}
            {orden.map(z => {
              const zona = zonas[z]; if (!zona) return null;
              return (
                <g key={z}>
                  <rect x={zona.area.x} y={zona.area.y} width={zona.area.w} height={zona.area.h}
                    rx={14} fill={zona.chipBg} fillOpacity={0.04}
                    stroke={zona.chipBg} strokeWidth={1.2} strokeDasharray="8 6" strokeOpacity={0.4}/>
                  <g transform={`translate(${zona.area.x+12}, ${zona.area.y+12})`}>
                    <rect width={zona.label.length*8.4+20} height={24} rx={4} fill="none" stroke={zona.chipBg} strokeWidth={1.2} strokeOpacity={0.7}/>
                    <text x={10} y={16} fill={zona.chipBg} fontSize={11} fontWeight={800}
                      fontFamily="'IBM Plex Mono', monospace" letterSpacing="0.18em" opacity={0.85}>
                      {zona.label}
                    </text>
                  </g>
                </g>
              );
            })}

            {/* Mesas */}
            {visibles.map((m:any) => {
              const { w, h } = sizeForMesa({ zona:m.zona||'', capacidad:m.capacidad||4, name:m.name });
              const isRound = (m.shape||'round') === 'round' || (m.zona||'').startsWith('Barra');
              const isEditing = editMesa?.id === m.id;
              const isDragging = dragging === m.id;
              const stroke = isEditing ? '#d4943a' : m.vip ? NEON.vip.stroke : NEON.libre.stroke;
              const cx = m.posicion_x, cy = m.posicion_y;
              return (
                <g key={m.id}
                   style={{cursor: isDragging?'grabbing':'grab'}}
                   onMouseDown={(e)=>onMesaMouseDown(e, m)}
                   onClick={(e)=>{
                     e.stopPropagation();
                     if (dragRef.current?.moved) { dragRef.current.moved = false; return; }
                     setEditMesa(isEditing ? null : {...m});
                   }}>
                  {isRound
                    ? <circle cx={cx} cy={cy} r={w/2} fill={NEON.libre.fill} stroke={stroke} strokeWidth={isEditing?3:m.vip?2.5:1.8}/>
                    : <rect x={cx-w/2} y={cy-h/2} width={w} height={h} rx={8} fill={NEON.libre.fill} stroke={stroke} strokeWidth={isEditing?3:m.vip?2.5:1.8}/>}

                  {/* Estrella VIP toggle */}
                  <g onMouseDown={(e)=>e.stopPropagation()}
                     onClick={(e)=>{ e.stopPropagation(); toggleVip(m, !m.vip); }}
                     style={{cursor:'pointer'}}>
                    <circle cx={cx-w/2+9} cy={cy-h/2+9} r={10}
                      fill={NEON.bgInner}
                      stroke={m.vip?NEON.vip.stroke:'rgba(255,255,255,0.22)'} strokeWidth={m.vip?1.8:1}/>
                    <text x={cx-w/2+9} y={cy-h/2+13} textAnchor="middle" fontSize={12} fontWeight={800}
                      fill={m.vip?NEON.vip.stroke:'rgba(255,255,255,0.4)'}>
                      {m.vip?'★':'☆'}
                    </text>
                  </g>

                  <text x={cx} y={cy-2} fill={NEON.libre.text} fontSize={14} fontWeight={900} textAnchor="middle"
                    fontFamily="'Syne', serif" pointerEvents="none">M{m.name}</text>
                  <text x={cx} y={cy+12} fill={NEON.libre.text} fontSize={9} fontWeight={700} textAnchor="middle" opacity={0.9}
                    fontFamily="'IBM Plex Mono', monospace" pointerEvents="none">{m.capacidad}P</text>
                </g>
              );
            })}

            {visibles.length === 0 && (
              <text x={VW_PLANO/2} y={VH_PLANO/2} textAnchor="middle" fill="#666" fontSize={16}
                fontFamily="'IBM Plex Mono', monospace" letterSpacing="0.2em">
                DOBLE CLICK PARA AGREGAR LA PRIMERA MESA
              </text>
            )}
          </svg>
          <div style={{marginTop:8,fontSize:10,color:'#50506A',textAlign:'center'}}>
            Doble click sobre el plano para agregar mesa en esa posición — la zona se infiere automáticamente.
          </div>
        </div>

        {/* Panel edición */}
        <div style={{width:280,borderLeft:'1px solid rgba(255,255,255,0.07)',background:'#0f0f1a',display:'flex',flexDirection:'column',flexShrink:0}}>
          {!editMesa?(
            <div style={{flex:1,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',padding:24,color:'#50506A',textAlign:'center'}}>
              <div style={{fontSize:40,marginBottom:12}}>✏️</div>
              <div style={{fontSize:12,fontWeight:700,marginBottom:6}}>Selecciona una mesa</div>
              <div style={{fontSize:11,lineHeight:1.6}}>Click en cualquier mesa para editar · doble-click vacío para agregar</div>
            </div>
          ):(
            <div style={{flex:1,overflowY:'auto',padding:16}}>
              <div style={{fontFamily:"'Syne',sans-serif",fontSize:14,fontWeight:900,marginBottom:14,color:'#f0f0f0'}}>Mesa {editMesa.name}</div>

              <div style={{marginBottom:12}}>
                <div style={{fontSize:10,color:'#50506A',fontWeight:700,marginBottom:4,textTransform:'uppercase'}}>Nombre / Número</div>
                <input style={inp} value={editMesa.name} onChange={e=>setEditMesa((p:any)=>({...p,name:e.target.value}))}/>
              </div>

              <div style={{marginBottom:12}}>
                <div style={{fontSize:10,color:'#50506A',fontWeight:700,marginBottom:6,textTransform:'uppercase'}}>Zona</div>
                <div style={{display:'flex',gap:5,flexWrap:'wrap'}}>
                  {orden.map(z=>(
                    <button key={z} onClick={()=>setEditMesa((p:any)=>({...p,zona:z}))}
                      style={{padding:'5px 10px',borderRadius:8,border:`1px solid ${editMesa.zona===z?(zonas[z]?.chipBg||'#FFB547'):'rgba(255,255,255,0.12)'}`,background:editMesa.zona===z?`${zonas[z]?.chipBg||'#FFB547'}22`:'transparent',color:editMesa.zona===z?(zonas[z]?.chipBg||'#FFB547'):'#50506A',fontSize:11,cursor:'pointer'}}>
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
                      style={{padding:'6px 8px',borderRadius:7,border:`1px solid ${editMesa.capacidad===n?'#3DBE8B':'rgba(255,255,255,0.12)'}`,background:editMesa.capacidad===n?'rgba(61,190,139,0.15)':'transparent',color:editMesa.capacidad===n?'#3DBE8B':'#50506A',fontSize:12,fontWeight:700,cursor:'pointer',minWidth:32}}>
                      {n}
                    </button>
                  ))}
                </div>
              </div>

              <div style={{marginBottom:12}}>
                <div style={{fontSize:10,color:'#50506A',fontWeight:700,marginBottom:6,textTransform:'uppercase'}}>Mesa VIP</div>
                <button onClick={()=>toggleVip(editMesa, !editMesa.vip)}
                  style={{width:'100%',padding:'9px',borderRadius:9,cursor:'pointer',fontSize:12,fontWeight:700,
                    border:`1px solid ${editMesa.vip?'#D4AF3D':'rgba(255,255,255,0.12)'}`,
                    background:editMesa.vip?'rgba(212,175,61,0.15)':'transparent',
                    color:editMesa.vip?'#D4AF3D':'#A0A0B8'}}>
                  {editMesa.vip?'⭐ Mesa VIP — quitar estrella':'☆ Marcar como mesa VIP'}
                </button>
              </div>

              <div style={{marginBottom:14}}>
                <div style={{fontSize:10,color:'#50506A',fontWeight:700,marginBottom:6,textTransform:'uppercase'}}>Posición en el plano (px)</div>
                <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8}}>
                  {[{l:'X (horizontal)',k:'posicion_x',max:VW_PLANO},{l:'Y (vertical)',k:'posicion_y',max:VH_PLANO}].map(f=>(
                    <div key={f.k}>
                      <div style={{fontSize:9,color:'#50506A',marginBottom:3}}>{f.l}</div>
                      <input type="number" min={0} max={f.max} style={inp} value={editMesa[f.k]||0} onChange={e=>setEditMesa((p:any)=>({...p,[f.k]:Number(e.target.value)}))}/>
                    </div>
                  ))}
                </div>
              </div>

              <div style={{display:'flex',flexDirection:'column',gap:7}}>
                <button onClick={guardarMesa} style={{width:'100%',padding:'10px',borderRadius:9,border:'none',background:'linear-gradient(135deg,#D4AF3D,#a48530)',color:'#000',fontSize:12,fontWeight:700,cursor:'pointer'}}>
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


function FooterStat({ label, v, c }:{ label:string; v:number|string; c:string }) {
  return (
    <div style={{display:'flex',flexDirection:'column',gap:2}}>
      <span style={{fontFamily:"'IBM Plex Mono', monospace",fontSize:9,color:'#6E6E84',letterSpacing:'.18em',textTransform:'uppercase'}}>{label}</span>
      <span style={{fontFamily:"'Syne', serif",fontSize:22,fontWeight:700,color:c,lineHeight:1}}>{v}</span>
    </div>
  );
}

function InfoChip({ label, v, c }:{ label:string; v:string; c:string }) {
  return (
    <div style={{padding:'10px 12px',borderRadius:10,border:`1px solid ${c}33`,background:`${c}10`,textAlign:'center'}}>
      <div style={{fontSize:9,color:c,fontWeight:800,textTransform:'uppercase',letterSpacing:'.14em'}}>{label}</div>
      <div style={{fontFamily:"'Syne',serif",fontSize:17,fontWeight:900,color:c,lineHeight:1.1,marginTop:2}}>{v}</div>
    </div>
  );
}

// ══ NAVEGADOR DE FECHA — flechas ‹ › + calendario + total reservas (25px) ══
function NavegadorFecha({ fecha, setFecha, totalReservas }:{ fecha:string; setFecha:(f:string)=>void; totalReservas:number }) {
  const [picker, setPicker] = React.useState(false);
  const d = new Date(fecha+'T12:00:00');
  const hoy = new Date().toISOString().split('T')[0];
  const esHoy = fecha === hoy;
  const dia = d.toLocaleDateString('es-CO',{weekday:'short',day:'numeric',month:'short'});
  const shiftDay = (delta:number) => {
    const nd = new Date(fecha+'T12:00:00');
    nd.setDate(nd.getDate()+delta);
    setFecha(nd.toISOString().split('T')[0]);
  };
  const labelReservas = totalReservas === 1 ? 'reserva' : 'reservas';
  return (
    <div style={{display:'flex',alignItems:'center',gap:6,background:'rgba(255,255,255,0.04)',border:'1px solid rgba(255,255,255,0.08)',borderRadius:12,padding:'4px 6px',position:'relative'}}>
      <button onClick={()=>shiftDay(-1)} title="Día anterior"
        style={{width:30,height:30,borderRadius:8,border:'none',background:'rgba(255,255,255,0.06)',color:'#fff',cursor:'pointer',fontSize:16,fontWeight:800}}>‹</button>
      <button onClick={()=>setPicker(p=>!p)} title="Abrir calendario"
        style={{minWidth:130,padding:'4px 10px',borderRadius:8,border:'none',background:'transparent',color:'#fff',cursor:'pointer',display:'flex',flexDirection:'column',alignItems:'flex-start',gap:1}}>
        <span style={{fontSize:9,color:esHoy?'#FFD700':'#a8a8b8',letterSpacing:'.18em',textTransform:'uppercase',fontWeight:700}}>{esHoy?'Hoy · ':''}{dia}</span>
        <span style={{display:'flex',alignItems:'baseline',gap:5}}>
          <span style={{fontFamily:"'Syne', serif",fontSize:25,fontWeight:900,color:'#fff',lineHeight:1}}>{totalReservas}</span>
          <span style={{fontSize:10,color:'#a8a8b8',letterSpacing:'.06em'}}>{labelReservas}</span>
        </span>
      </button>
      <button onClick={()=>shiftDay(1)} title="Día siguiente"
        style={{width:30,height:30,borderRadius:8,border:'none',background:'rgba(255,255,255,0.06)',color:'#fff',cursor:'pointer',fontSize:16,fontWeight:800}}>›</button>
      {picker && (
        <div style={{position:'absolute',top:'calc(100% + 6px)',left:0,zIndex:100,background:'linear-gradient(135deg, #2a1430 0%, #1f0d24 100%)',border:'1px solid rgba(216, 73, 158, 0.45)',borderRadius:10,padding:10,boxShadow:'0 12px 30px rgba(216, 73, 158, 0.25), 0 0 0 1px rgba(216,73,158,0.15)'}}>
          <input type="date" value={fecha} autoFocus
            onChange={e=>{ setFecha(e.target.value); setPicker(false); }}
            onBlur={()=>setTimeout(()=>setPicker(false),120)}
            style={{background:'rgba(216, 73, 158, 0.08)',border:'1px solid rgba(216, 73, 158, 0.3)',borderRadius:8,padding:'8px 12px',color:'#fff',fontSize:13,outline:'none',colorScheme:'dark',accentColor:'#D8499E'}}/>
        </div>
      )}
    </div>
  );
}

// ══ MODAL FRANJA BLOQUEADA — bloquea horas para Oh Yeah / Google ══
function FranjaBloqueoModal({ fecha, restauranteId, franjas, onClose, onChange, show, S }:{
  fecha:string; restauranteId:number; franjas:any[];
  onClose:()=>void; onChange:()=>void; show:(m:string)=>void; S:any;
}) {
  const [horaDesde, setHoraDesde] = React.useState('12:00');
  const [horaHasta, setHoraHasta] = React.useState('15:00');
  const [motivo, setMotivo] = React.useState('');
  const [bloqueaOh, setBloqueaOh] = React.useState(true);
  const [bloqueaGoogle, setBloqueaGoogle] = React.useState(true);
  const [saving, setSaving] = React.useState(false);

  // Calcular duración total de la franja en formato Xh Ym (ej. 2h 30m)
  const calcDuracion = (desde:string, hasta:string) => {
    const [h1,m1] = desde.split(':').map(Number);
    const [h2,m2] = hasta.split(':').map(Number);
    const totalMin = (h2*60+m2) - (h1*60+m1);
    if (totalMin <= 0) return '—';
    const h = Math.floor(totalMin/60), m = totalMin%60;
    return h>0 && m>0 ? `${h}h ${m}min` : h>0 ? `${h}h` : `${m}min`;
  };
  const duracion = calcDuracion(horaDesde, horaHasta);
  const horasTotalesHoy = franjas.reduce((acc:number, f:any) => {
    const [h1,m1] = f.hora_desde.split(':').map(Number);
    const [h2,m2] = f.hora_hasta.split(':').map(Number);
    return acc + Math.max(0, (h2*60+m2)-(h1*60+m1));
  }, 0);

  const guardar = async () => {
    if (horaDesde >= horaHasta) { show('⚠️ La hora de inicio debe ser menor a la de fin'); return; }
    // Detectar solapamientos con franjas existentes
    const solapa = franjas.find((f:any) =>
      !(horaHasta <= f.hora_desde.slice(0,5) || horaDesde >= f.hora_hasta.slice(0,5))
    );
    if (solapa && !confirm(`⚠️ Se solapa con la franja ${solapa.hora_desde.slice(0,5)}–${solapa.hora_hasta.slice(0,5)}. ¿Continuar?`)) return;
    setSaving(true);
    const { error } = await supabase.from('reservas_franjas_bloqueadas').insert({
      restaurante_id: restauranteId, fecha,
      hora_desde: horaDesde, hora_hasta: horaHasta,
      motivo: motivo || null,
      bloquea_oh_yeah: bloqueaOh, bloquea_google: bloqueaGoogle,
    });
    setSaving(false);
    if (error) { show('✗ '+error.message); return; }
    show(`✓ ${duracion} bloqueados`);
    onChange();
    setMotivo('');
  };
  const eliminar = async (id:string) => {
    if (!confirm('¿Eliminar este bloqueo? Las nuevas reservas Oh Yeah / Google volverán a entrar.')) return;
    await supabase.from('reservas_franjas_bloqueadas').delete().eq('id', id);
    show('✓ Bloqueo eliminado');
    onChange();
  };

  return (
    <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.85)',zIndex:9998,display:'flex',alignItems:'center',justifyContent:'center',padding:16}} onClick={onClose}>
      <div onClick={e=>e.stopPropagation()} style={{background:S.bg2,border:`1px solid ${S.border}`,borderRadius:18,width:'100%',maxWidth:560,padding:24,maxHeight:'92vh',overflowY:'auto',color:'#fff'}}>
        <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:6}}>
          <span style={{fontSize:22}}>🚫</span>
          <div style={{flex:1}}>
            <div style={{fontFamily:"'Syne',serif",fontSize:18,fontWeight:900}}>Bloquear franja horaria</div>
            <div style={{fontSize:11,color:S.t3}}>No se borran reservas existentes — solo evita el ingreso de nuevas reservas Oh Yeah / Google.</div>
          </div>
          <button onClick={onClose} style={{background:'transparent',border:'none',color:S.t3,fontSize:22,cursor:'pointer'}}>×</button>
        </div>

        <div style={{fontSize:10,color:S.gold,fontWeight:800,textTransform:'uppercase',letterSpacing:'.16em',marginTop:14}}>📅 {new Date(fecha+'T12:00:00').toLocaleDateString('es-CO',{weekday:'long',day:'numeric',month:'long',year:'numeric'})}</div>

        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr auto',gap:10,marginTop:12,alignItems:'end'}}>
          <div>
            <div style={{fontSize:10,color:S.t3,fontWeight:700,marginBottom:4}}>DESDE</div>
            <input type="time" value={horaDesde} onChange={e=>setHoraDesde(e.target.value)}
              style={{width:'100%',background:'rgba(255,255,255,0.05)',border:`1px solid ${S.border2}`,borderRadius:10,padding:'10px 12px',color:'#fff',fontSize:13,outline:'none',colorScheme:'dark'}}/>
          </div>
          <div>
            <div style={{fontSize:10,color:S.t3,fontWeight:700,marginBottom:4}}>HASTA</div>
            <input type="time" value={horaHasta} onChange={e=>setHoraHasta(e.target.value)}
              style={{width:'100%',background:'rgba(255,255,255,0.05)',border:`1px solid ${S.border2}`,borderRadius:10,padding:'10px 12px',color:'#fff',fontSize:13,outline:'none',colorScheme:'dark'}}/>
          </div>
          <div title="Duración de esta franja" style={{padding:'10px 14px',borderRadius:10,background:`${S.red}18`,border:`1px solid ${S.red}55`,textAlign:'center',minWidth:80}}>
            <div style={{fontSize:9,color:S.red,fontWeight:800,textTransform:'uppercase',letterSpacing:'.1em'}}>Total</div>
            <div style={{fontFamily:"'Syne',serif",fontSize:15,fontWeight:900,color:S.red,lineHeight:1.1,marginTop:2}}>{duracion}</div>
          </div>
        </div>
        {/* Atajos rápidos */}
        <div style={{display:'flex',gap:5,marginTop:8,flexWrap:'wrap'}}>
          {[
            {l:'Almuerzo',d:'12:00',h:'15:00'},
            {l:'Tarde',d:'15:00',h:'18:00'},
            {l:'Cena',d:'19:00',h:'22:30'},
            {l:'Día completo',d:'10:00',h:'23:30'},
          ].map(p=>(
            <button key={p.l} onClick={()=>{ setHoraDesde(p.d); setHoraHasta(p.h); }}
              style={{padding:'4px 10px',borderRadius:7,border:`1px solid ${S.border2}`,background:'transparent',color:S.t3,fontSize:10,fontWeight:700,cursor:'pointer'}}>
              {p.l}
            </button>
          ))}
        </div>

        <div style={{marginTop:12}}>
          <div style={{fontSize:10,color:S.t3,fontWeight:700,marginBottom:4}}>MOTIVO (opcional)</div>
          <input value={motivo} onChange={e=>setMotivo(e.target.value)} placeholder="Evento privado, mantenimiento, cierre…"
            style={{width:'100%',background:'rgba(255,255,255,0.05)',border:`1px solid ${S.border2}`,borderRadius:10,padding:'10px 12px',color:'#fff',fontSize:13,outline:'none'}}/>
        </div>

        <div style={{display:'flex',gap:8,marginTop:12,flexWrap:'wrap'}}>
          <button onClick={()=>setBloqueaOh(!bloqueaOh)}
            style={{padding:'7px 12px',borderRadius:8,border:`1px solid ${bloqueaOh?S.gold:S.border2}`,background:bloqueaOh?`${S.gold}18`:'transparent',color:bloqueaOh?S.gold:S.t3,fontSize:11,fontWeight:700,cursor:'pointer'}}>
            🦉 Oh Yeah {bloqueaOh?'✓':''}
          </button>
          <button onClick={()=>setBloqueaGoogle(!bloqueaGoogle)}
            style={{padding:'7px 12px',borderRadius:8,border:`1px solid ${bloqueaGoogle?S.blue:S.border2}`,background:bloqueaGoogle?`${S.blue}18`:'transparent',color:bloqueaGoogle?S.blue:S.t3,fontSize:11,fontWeight:700,cursor:'pointer'}}>
            🔎 Google {bloqueaGoogle?'✓':''}
          </button>
        </div>

        <button onClick={guardar} disabled={saving}
          style={{width:'100%',marginTop:16,padding:'12px',borderRadius:10,border:'none',background:saving?S.bg3:`linear-gradient(135deg,${S.red},#8E1F36)`,color:'#fff',fontSize:13,fontWeight:800,cursor:'pointer'}}>
          {saving?'Guardando…':'🚫 Bloquear franja'}
        </button>

        {/* Lista de franjas ya bloqueadas */}
        {franjas.length > 0 && (
          <div style={{marginTop:18,borderTop:`1px solid ${S.border}`,paddingTop:14}}>
            <div style={{display:'flex',alignItems:'baseline',gap:10,marginBottom:8}}>
              <div style={{fontSize:10,color:S.t3,fontWeight:800,textTransform:'uppercase',letterSpacing:'.12em'}}>Bloqueos activos hoy</div>
              <div style={{marginLeft:'auto',fontSize:10,color:S.red,fontWeight:800}}>
                Total bloqueado: <span style={{fontFamily:"'Syne',serif",fontSize:14,fontWeight:900}}>{Math.floor(horasTotalesHoy/60)}h {horasTotalesHoy%60}min</span>
              </div>
            </div>
            <div style={{display:'flex',flexDirection:'column',gap:6}}>
              {franjas.map((f:any)=>{
                const dur = calcDuracion(f.hora_desde.slice(0,5), f.hora_hasta.slice(0,5));
                return (
                  <div key={f.id} style={{display:'flex',alignItems:'center',gap:10,padding:'8px 12px',background:`${S.red}10`,border:`1px solid ${S.red}33`,borderRadius:10}}>
                    <span style={{fontFamily:"'Syne',serif",fontSize:14,fontWeight:800,color:S.red}}>{f.hora_desde.slice(0,5)} → {f.hora_hasta.slice(0,5)}</span>
                    <span style={{fontSize:10,color:S.red,fontWeight:700,background:`${S.red}22`,padding:'2px 7px',borderRadius:6}}>⏱ {dur}</span>
                    <span style={{fontSize:11,color:S.t2,flex:1}}>{f.motivo||'Sin motivo'}</span>
                    <span style={{fontSize:9,color:S.t3,display:'flex',gap:4}}>
                      {f.bloquea_oh_yeah && <span title="Bloquea Oh Yeah">🦉</span>}
                      {f.bloquea_google && <span title="Bloquea Google">🔎</span>}
                    </span>
                    <button onClick={()=>eliminar(f.id)} style={{background:'transparent',border:'none',color:S.t3,cursor:'pointer',fontSize:14}}>🗑</button>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════
// DASHBOARD DE RESERVAS · vista 360° del team con datos reales
// ═════════════════════════════════════════════════════════════════════
function DashboardReservas(props:{
  reservas?:any[]; reservasHoy?:any[]; mesas?:any[]; meserosLista?:any[];
  franjasBloqueadas?:any[]; fechaFiltro:string; S:any;
}) {
  const { fechaFiltro, S } = props;
  // Defaults defensivos para evitar crashes si algún array llega null en el primer render
  const reservas = props.reservas || [];
  const reservasHoy = props.reservasHoy || [];
  const mesas = props.mesas || [];
  const meserosLista = props.meserosLista || [];
  const franjasBloqueadas = props.franjasBloqueadas || [];
  // ── Métricas globales del día ────────────────────────────────────
  const activas = reservasHoy.filter((r:any) => !['cancelada'].includes(r.estado));
  const sentadas = activas.filter((r:any)=>r.estado==='sentada').length;
  const confirmadas = activas.filter((r:any)=>r.estado==='confirmada').length;
  const completadas = activas.filter((r:any)=>r.estado==='completada').length;
  const canceladas = reservasHoy.filter((r:any)=>r.estado==='cancelada').length;
  const sinMesa = activas.filter((r:any)=>!r.mesa_num).length;
  const paxTotal = activas.reduce((s:number,r:any)=>s+(r.pax||0), 0);
  const paxPromedio = activas.length ? (paxTotal/activas.length).toFixed(1) : '0';
  const ohYeahCnt = activas.filter((r:any)=>r.origen==='ohyeah').length;
  const nexumCnt = activas.filter((r:any)=>r.origen!=='ohyeah').length;
  const vipCnt = activas.filter((r:any)=>{
    const tier = String(r.gourmand_level||'').toUpperCase();
    return ['VIP','CONSAGRADO','ÉLITE','ELITE','GRAND GOURMAND','LA CREME'].includes(tier);
  }).length;

  // ── Distribución por hora ────────────────────────────────────────
  const porHora: Record<string, number> = {};
  activas.forEach((r:any) => {
    const h = (r.hora||'').slice(0,2);
    if (h) porHora[h] = (porHora[h]||0) + 1;
  });
  const horasOrden = Object.keys(porHora).sort();
  const maxPorHora = Math.max(1, ...Object.values(porHora));

  // ── Asignación por mesero ────────────────────────────────────────
  // Cruzamos reservas asignadas con mesas en vivo para saber quién atiende qué
  const statsPorMesero = meserosLista.map((ms:any) => {
    const nombre = ms.nombre_completo || ms.full_name || '';
    if (!nombre) return null;
    // Mesas en vivo asignadas a este mesero
    const susMesasEnVivo = mesas.filter((m:any) => m.mesero_nombre === nombre || (Array.isArray(m.meseros_compartidos) && m.meseros_compartidos.includes(nombre)));
    const numerosMesa = new Set(susMesasEnVivo.map((m:any) => Number(m.name)));
    // Reservas del día que caen en esas mesas
    const susReservas = activas.filter((r:any) => r.mesa_num && numerosMesa.has(Number(r.mesa_num)));
    const susPax = susReservas.reduce((s:number,r:any)=>s+(r.pax||0), 0);
    const susSentadas = susReservas.filter((r:any)=>r.estado==='sentada').length;
    return { nombre, color: ms.color || '#5a6472', mesasAtendidas: susMesasEnVivo.length, reservasAsignadas: susReservas.length, paxTotal: susPax, sentadas: susSentadas };
  }).filter(Boolean).sort((a:any,b:any) => b.paxTotal - a.paxTotal);

  // ── Tendencia de los últimos 7 días ──────────────────────────────
  const semana: { fecha:string; total:number }[] = [];
  for (let i=6; i>=0; i--) {
    const d = new Date(fechaFiltro+'T12:00:00');
    d.setDate(d.getDate()-i);
    const k = d.toISOString().split('T')[0];
    const count = reservas.filter((r:any)=>r.fecha===k).length;
    semana.push({ fecha: k, total: count });
  }
  const maxSem = Math.max(1, ...semana.map(d=>d.total));

  // ── Próximas reservas (siguientes 3 horas) ───────────────────────
  const ahora = new Date();
  const nowMin = ahora.getHours()*60 + ahora.getMinutes();
  const proximas = activas.filter((r:any) => {
    if (r.estado === 'sentada' || r.estado === 'completada') return false;
    if (r.fecha !== new Date().toISOString().split('T')[0]) return false;
    const [h,m] = (r.hora||'00:00').split(':').map(Number);
    const rmin = h*60+m;
    return rmin >= nowMin && rmin <= nowMin+180;
  }).sort((a:any,b:any)=>(a.hora||'').localeCompare(b.hora||'')).slice(0,8);

  // ── Top clientes recurrentes del día ─────────────────────────────
  const topVips = activas.filter((r:any) => r.visit_count && r.visit_count >= 3)
    .sort((a:any,b:any)=>(b.visit_count||0) - (a.visit_count||0)).slice(0,5);

  // ── Card helper ───────────────────────────────────────────────────
  const Card = ({title, value, sub, color, icon}:any) => (
    <div style={{background:S.bg2,border:`1px solid ${S.border}`,borderRadius:14,padding:'14px 16px',display:'flex',alignItems:'flex-start',gap:12}}>
      <div style={{width:38,height:38,borderRadius:10,background:`${color}18`,border:`1px solid ${color}40`,display:'flex',alignItems:'center',justifyContent:'center',fontSize:18,flexShrink:0}}>{icon}</div>
      <div style={{flex:1,minWidth:0}}>
        <div style={{fontSize:9,color:S.t3,letterSpacing:'.16em',fontWeight:800,textTransform:'uppercase'}}>{title}</div>
        <div style={{fontFamily:"'Syne',serif",fontSize:26,fontWeight:900,color,lineHeight:1.05,marginTop:2}}>{value}</div>
        {sub && <div style={{fontSize:10,color:S.t3,marginTop:2}}>{sub}</div>}
      </div>
    </div>
  );

  return (
    <div style={{flex:1,overflowY:'auto',padding:'18px 22px',background:S.bg,color:S.t1}}>
      {/* KPIs principales */}
      <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit, minmax(180px, 1fr))',gap:12,marginBottom:18}}>
        <Card title="Reservas activas" value={activas.length} sub={`${confirmadas} confirmadas · ${sentadas} sentadas`} color={S.gold} icon="🗓️"/>
        <Card title="Pax total" value={paxTotal} sub={`Promedio ${paxPromedio} pax / reserva`} color={S.blue} icon="👥"/>
        <Card title="Sin mesa asignada" value={sinMesa} sub={sinMesa>0?'Acción requerida':'Todo en orden'} color={sinMesa>0?S.red:S.green} icon="🪑"/>
        <Card title="Oh Yeah hoy" value={ohYeahCnt} sub={`${nexumCnt} manuales`} color="#FFE600" icon="🦉"/>
        <Card title="Clientes VIP" value={vipCnt} sub={vipCnt>0?'Prioridad alta':'Sin VIPs hoy'} color={S.purple} icon="⭐"/>
        <Card title="Canceladas" value={canceladas} sub={`${completadas} completadas`} color={canceladas>3?S.red:S.t2} icon="✕"/>
      </div>

      {/* Equipo de meseros */}
      <div style={{background:S.bg2,border:`1px solid ${S.border}`,borderRadius:14,padding:16,marginBottom:18}}>
        <div style={{display:'flex',alignItems:'baseline',gap:10,marginBottom:12}}>
          <div style={{fontFamily:"'Syne',serif",fontSize:14,fontWeight:900,color:S.t1}}>👥 Team del turno</div>
          <div style={{fontSize:10,color:S.t3,letterSpacing:'.1em',textTransform:'uppercase'}}>{statsPorMesero.length} meseros · datos en vivo</div>
        </div>
        {statsPorMesero.length === 0 ? (
          <div style={{padding:20,textAlign:'center',color:S.t3,fontSize:12}}>Sin meseros registrados en este restaurante.</div>
        ) : (
          <div style={{overflowX:'auto'}}>
            <table style={{width:'100%',borderCollapse:'collapse',fontSize:12,minWidth:560}}>
              <thead>
                <tr style={{borderBottom:`1px solid ${S.border}`}}>
                  {['Mesero','Mesas en vivo','Reservas','Sentadas','Pax atendidos'].map(h=>(
                    <th key={h} style={{textAlign:'left',padding:'8px 12px',fontSize:9,color:S.t3,fontWeight:800,letterSpacing:'.1em',textTransform:'uppercase'}}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {statsPorMesero.map((s:any,i:number)=>(
                  <tr key={s.nombre} style={{borderBottom:`1px solid ${S.border}`,background:i%2===0?'transparent':`${S.bg}55`}}>
                    <td style={{padding:'10px 12px'}}>
                      <div style={{display:'flex',alignItems:'center',gap:8}}>
                        <span style={{width:9,height:9,borderRadius:'50%',background:s.color,display:'inline-block',boxShadow:`0 0 8px ${s.color}99`}}/>
                        <span style={{fontWeight:700,color:S.t1}}>{s.nombre}</span>
                      </div>
                    </td>
                    <td style={{padding:'10px 12px'}}>
                      <span style={{fontFamily:"'Syne',serif",fontSize:15,fontWeight:900,color:s.mesasAtendidas>0?S.green:S.t3}}>{s.mesasAtendidas}</span>
                    </td>
                    <td style={{padding:'10px 12px'}}>
                      <span style={{fontFamily:"'Syne',serif",fontSize:15,fontWeight:900,color:S.gold}}>{s.reservasAsignadas}</span>
                    </td>
                    <td style={{padding:'10px 12px'}}>
                      <span style={{fontFamily:"'Syne',serif",fontSize:15,fontWeight:900,color:s.sentadas>0?S.green:S.t3}}>{s.sentadas}</span>
                    </td>
                    <td style={{padding:'10px 12px'}}>
                      <span style={{fontFamily:"'Syne',serif",fontSize:15,fontWeight:900,color:S.blue}}>{s.paxTotal}</span>
                      <span style={{fontSize:10,color:S.t3,marginLeft:4}}>p</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Distribución por hora + Tendencia semanal */}
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:14,marginBottom:18}}>
        {/* Por hora */}
        <div style={{background:S.bg2,border:`1px solid ${S.border}`,borderRadius:14,padding:16}}>
          <div style={{fontFamily:"'Syne',serif",fontSize:13,fontWeight:900,marginBottom:14,color:S.t1}}>⏱ Reservas por hora · hoy</div>
          {horasOrden.length === 0 ? (
            <div style={{textAlign:'center',color:S.t3,fontSize:11,padding:20}}>Sin reservas hoy</div>
          ) : (
            <div style={{display:'flex',gap:6,alignItems:'flex-end',height:120}}>
              {horasOrden.map(h=>{
                const v = porHora[h];
                const pct = (v/maxPorHora)*100;
                return (
                  <div key={h} style={{flex:1,display:'flex',flexDirection:'column',alignItems:'center',gap:4,minWidth:0}}>
                    <div style={{fontSize:10,fontWeight:800,color:S.gold}}>{v}</div>
                    <div style={{width:'100%',height:`${pct}%`,minHeight:4,background:`linear-gradient(180deg, ${S.gold}, ${S.gold}55)`,borderRadius:'4px 4px 0 0'}}/>
                    <div style={{fontSize:9,color:S.t3,fontFamily:"'IBM Plex Mono',monospace"}}>{h}h</div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Semana */}
        <div style={{background:S.bg2,border:`1px solid ${S.border}`,borderRadius:14,padding:16}}>
          <div style={{fontFamily:"'Syne',serif",fontSize:13,fontWeight:900,marginBottom:14,color:S.t1}}>📈 Tendencia · últimos 7 días</div>
          <div style={{display:'flex',gap:6,alignItems:'flex-end',height:120}}>
            {semana.map(d=>{
              const dia = new Date(d.fecha+'T12:00:00').toLocaleDateString('es-CO',{weekday:'short'});
              const pct = (d.total/maxSem)*100;
              const esHoy = d.fecha === fechaFiltro;
              return (
                <div key={d.fecha} style={{flex:1,display:'flex',flexDirection:'column',alignItems:'center',gap:4,minWidth:0}}>
                  <div style={{fontSize:10,fontWeight:800,color:esHoy?S.gold:S.blue}}>{d.total}</div>
                  <div style={{width:'100%',height:`${pct}%`,minHeight:4,background:esHoy?`linear-gradient(180deg, ${S.gold}, ${S.gold}55)`:`linear-gradient(180deg, ${S.blue}, ${S.blue}55)`,borderRadius:'4px 4px 0 0'}}/>
                  <div style={{fontSize:9,color:esHoy?S.gold:S.t3,fontFamily:"'IBM Plex Mono',monospace",fontWeight:esHoy?800:500}}>{dia}</div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Próximas reservas + Top VIPs + Franjas bloqueadas */}
      <div style={{display:'grid',gridTemplateColumns:'1.4fr 1fr',gap:14}}>
        {/* Próximas 3h */}
        <div style={{background:S.bg2,border:`1px solid ${S.border}`,borderRadius:14,padding:16}}>
          <div style={{fontFamily:"'Syne',serif",fontSize:13,fontWeight:900,marginBottom:12,color:S.t1}}>⏭ Próximas 3 horas</div>
          {proximas.length === 0 ? (
            <div style={{textAlign:'center',color:S.t3,fontSize:11,padding:20}}>Sin reservas próximas</div>
          ) : (
            <div style={{display:'flex',flexDirection:'column',gap:6}}>
              {proximas.map((r:any)=>{
                const esOh = r.origen === 'ohyeah';
                return (
                  <div key={r.id} style={{display:'flex',alignItems:'center',gap:10,padding:'9px 12px',background:S.bg,borderRadius:10,border:`1px solid ${esOh?`${S.gold}30`:S.border}`}}>
                    <span style={{fontFamily:"'Syne',serif",fontSize:18,fontWeight:900,color:S.gold,minWidth:55}}>{(r.hora||'').slice(0,5)}</span>
                    <div style={{flex:1,minWidth:0}}>
                      <div style={{fontSize:12,fontWeight:700,color:S.t1}}>{r.cliente_nombre} {esOh && <span style={{fontSize:9,color:S.gold,marginLeft:5}}>🦉</span>}</div>
                      <div style={{fontSize:10,color:S.t3}}>{r.pax}p · {r.ocasion||'reserva'} {r.mesa_num?`· Mesa M${r.mesa_num}`:`· `}<span style={{color:!r.mesa_num?S.red:S.t3,fontWeight:700}}>{!r.mesa_num?'⚠ Sin mesa':''}</span></div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Top VIPs */}
        <div style={{background:S.bg2,border:`1px solid ${S.border}`,borderRadius:14,padding:16}}>
          <div style={{fontFamily:"'Syne',serif",fontSize:13,fontWeight:900,marginBottom:12,color:S.t1}}>⭐ Clientes top hoy</div>
          {topVips.length === 0 ? (
            <div style={{textAlign:'center',color:S.t3,fontSize:11,padding:20}}>Sin clientes recurrentes</div>
          ) : (
            <div style={{display:'flex',flexDirection:'column',gap:6}}>
              {topVips.map((r:any)=>(
                <div key={r.id} style={{display:'flex',alignItems:'center',gap:8,padding:'8px 10px',background:`${S.purple}10`,border:`1px solid ${S.purple}30`,borderRadius:10}}>
                  <div style={{width:30,height:30,borderRadius:'50%',background:`${S.purple}30`,display:'flex',alignItems:'center',justifyContent:'center',fontWeight:900,color:S.purple,fontSize:11}}>{(r.cliente_nombre||'?').charAt(0).toUpperCase()}</div>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{fontSize:11,fontWeight:700,color:S.t1,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{r.cliente_nombre}</div>
                    <div style={{fontSize:9,color:S.purple,fontWeight:700}}>{r.visit_count} visitas{r.gourmand_level?` · ${r.gourmand_level}`:''}</div>
                  </div>
                  <span style={{fontSize:11,color:S.gold,fontWeight:800}}>{(r.hora||'').slice(0,5)}</span>
                </div>
              ))}
            </div>
          )}

          {/* Franjas bloqueadas */}
          {franjasBloqueadas.length > 0 && (
            <div style={{marginTop:16,paddingTop:14,borderTop:`1px solid ${S.border}`}}>
              <div style={{fontSize:10,color:S.red,fontWeight:800,textTransform:'uppercase',letterSpacing:'.1em',marginBottom:8}}>🚫 Franjas bloqueadas</div>
              <div style={{display:'flex',flexDirection:'column',gap:5}}>
                {franjasBloqueadas.map((f:any)=>(
                  <div key={f.id} style={{display:'flex',gap:8,fontSize:11,color:S.t2,alignItems:'center'}}>
                    <span style={{fontFamily:"'Syne',serif",fontWeight:800,color:S.red}}>{f.hora_desde.slice(0,5)}–{f.hora_hasta.slice(0,5)}</span>
                    <span style={{color:S.t3,flex:1}}>{f.motivo||'Sin motivo'}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════
// PLANO SALA · SVG NEON · misma organización que PlanoOMM (zonas + mesas)
// Fondo oscuro + glow neón sobre dark, drop targets activos.
// ═════════════════════════════════════════════════════════════════════
function PlanoSalaSVG({ mesas, activas, restauranteId, asignarMesa, setAsignandoMesa, onNuevaConMesa, onToggleVip }:{
  mesas:any[]; activas:any[]; restauranteId:number;
  asignarMesa:(id:any,num:number)=>void;
  setAsignandoMesa:(r:any)=>void;
  onNuevaConMesa?:(mesaNum:number)=>void;
  onToggleVip?:(mesaId:number, vip:boolean)=>void;
}) {
  const conf = ZONAS_POR_RESTAURANTE[restauranteId];
  const zonas = conf?.zonas || {};
  const orden = conf?.orden || [];
  const [hoverMesa, setHoverMesa] = React.useState<number|null>(null);

  // Paleta neon · TONO SUAVE para que el texto sea legible
  const NEON = {
    bgOuter: '#0e0e18',
    bgInner: '#13131f',
    grid: 'rgba(120,120,180,0.05)',
    libre:    { fill:'#162621', stroke:'#3DBE8B', glow:'#3DBE8B', text:'#D8F4E5' },
    reservada:{ fill:'#241B10', stroke:'#C99245', glow:'#C99245', text:'#F4E2C5' },
    ocupada:  { fill:'#241218', stroke:'#C04464', glow:'#C04464', text:'#F4D0DC' },
    vip:      { stroke:'#D4AF3D', glow:'#D4AF3D' },
  };

  return (
    <div style={{flex:1,overflow:'auto',padding:18,background:NEON.bgOuter}}>
      <svg viewBox={`0 0 ${VW_PLANO} ${VH_PLANO}`} width="100%"
        style={{display:'block',background:`radial-gradient(circle at 50% 30%, #1a1a2a 0%, ${NEON.bgInner} 70%)`,borderRadius:14,boxShadow:'inset 0 0 60px rgba(0,0,0,0.6)'}}>
        <defs>
          {/* glow filter suave para mesas */}
          <filter id="neonGlow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="1.2" result="blur"/>
            <feMerge>
              <feMergeNode in="blur"/>
              <feMergeNode in="SourceGraphic"/>
            </feMerge>
          </filter>
          <filter id="strongGlow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="3" result="blur"/>
            <feMerge>
              <feMergeNode in="blur"/>
              <feMergeNode in="SourceGraphic"/>
            </feMerge>
          </filter>
          <pattern id="gridPattern" width="40" height="40" patternUnits="userSpaceOnUse">
            <path d="M 40 0 L 0 0 0 40" fill="none" stroke={NEON.grid} strokeWidth="1"/>
          </pattern>
        </defs>

        {/* Grid sutil */}
        <rect x={0} y={0} width={VW_PLANO} height={VH_PLANO} fill="url(#gridPattern)"/>

        {/* ── ZONAS · borde tenue ── */}
        {orden.map(z => {
          const zona = zonas[z]; if (!zona) return null;
          return (
            <g key={z}>
              <rect x={zona.area.x} y={zona.area.y} width={zona.area.w} height={zona.area.h}
                rx={14}
                fill={zona.chipBg} fillOpacity={0.04}
                stroke={zona.chipBg} strokeWidth={1.2} strokeDasharray="8 6" strokeOpacity={0.4}/>
              <g transform={`translate(${zona.area.x+12}, ${zona.area.y+12})`}>
                <rect width={zona.label.length*8.4+20} height={24} rx={4}
                  fill="none" stroke={zona.chipBg} strokeWidth={1.2} strokeOpacity={0.7}/>
                <text x={10} y={16} fill={zona.chipBg} fontSize={11} fontWeight={800}
                  fontFamily="'IBM Plex Mono', monospace" letterSpacing="0.18em" opacity={0.85}>
                  {zona.label}
                </text>
              </g>
            </g>
          );
        })}

        {/* ── MESAS NEON SUAVE ── */}
        {mesas.filter((m:any)=>m.posicion_x!=null && m.posicion_y!=null).map((m:any) => {
          const reserva = activas.find((r:any) => Number(r.mesa_num) === Number(m.name) || String(r.mesa_num)===String(m.name));
          const ocupada = ['ocupada','asignada','sentada'].includes(m.estado);
          const tieneReserva = !!reserva;
          const tone = ocupada ? NEON.ocupada : tieneReserva ? NEON.reservada : NEON.libre;
          const strokeCol = m.vip ? NEON.vip.stroke : tone.stroke;
          const glowCol = m.vip ? NEON.vip.glow : tone.glow;
          const { w, h } = sizeForMesa({ zona:m.zona||'', capacidad:m.capacidad||4, name:m.name });
          const isHover = hoverMesa === m.id;
          const isRound = (m.shape||'round') === 'round' || (m.zona||'').startsWith('Barra');
          const cx = m.posicion_x, cy = m.posicion_y;
          return (
            <g key={m.id} style={{cursor:'pointer'}}
               onDragOver={(e)=>{ e.preventDefault(); setHoverMesa(m.id); }}
               onDragLeave={()=>setHoverMesa(null)}
               onDrop={(e)=>{
                 e.preventDefault();
                 const id = e.dataTransfer.getData('text/reserva');
                 setHoverMesa(null);
                 if (!id) return;
                 if (reserva && String(reserva.id)!==id) {
                   if (!confirm(`La mesa ${m.name} ya tiene a ${reserva.cliente_nombre} (${reserva.hora}). ¿Reemplazar?`)) return;
                 }
                 asignarMesa(id, Number(m.name));
               }}
               onClick={()=>{
                 if (reserva) setAsignandoMesa(reserva);
                 else if (onNuevaConMesa) onNuevaConMesa(Number(m.name));
               }}>
              {/* Halo de hover */}
              {isHover && (
                <circle cx={cx} cy={cy} r={Math.max(w,h)/2+14} fill="none"
                  stroke="#5BC0E8" strokeWidth={2} strokeDasharray="6 4" opacity={0.85} filter="url(#strongGlow)">
                  <animate attributeName="stroke-dashoffset" from="0" to="20" dur="0.6s" repeatCount="indefinite"/>
                </circle>
              )}

              {/* Cuerpo mesa */}
              {isRound
                ? <circle cx={cx} cy={cy} r={w/2}
                    fill={tone.fill}
                    stroke={strokeCol} strokeWidth={m.vip?2.5:1.8}/>
                : <rect x={cx-w/2} y={cy-h/2} width={w} height={h} rx={8}
                    fill={tone.fill}
                    stroke={strokeCol} strokeWidth={m.vip?2.5:1.8}/>}

              {/* Estrella VIP / no-VIP — toggle */}
              <g onClick={(e)=>{ e.stopPropagation(); onToggleVip && onToggleVip(m.id, !m.vip); }} style={{cursor:'pointer'}}>
                <circle cx={cx+w/2-9} cy={cy-h/2+9} r={11}
                  fill={NEON.bgInner} stroke={m.vip?NEON.vip.stroke:'rgba(255,255,255,0.18)'}
                  strokeWidth={m.vip?2:1}/>
                <text x={cx+w/2-9} y={cy-h/2+13} fill={m.vip?NEON.vip.stroke:'rgba(255,255,255,0.35)'}
                  fontSize={13} fontWeight={800} textAnchor="middle">{m.vip?'★':'☆'}</text>
              </g>

              {/* Nombre mesa · texto limpio sin glow exagerado */}
              <text x={cx} y={cy-3} fill={tone.text} fontSize={14} fontWeight={900} textAnchor="middle"
                fontFamily="'Syne', serif">
                {m.name}
              </text>

              {/* Capacidad o nombre del cliente */}
              <text x={cx} y={cy+12} fill={tone.text} fontSize={9} fontWeight={700} textAnchor="middle" opacity={0.9}
                fontFamily="'IBM Plex Mono', monospace" letterSpacing="0.08em">
                {tieneReserva ? (reserva.cliente_nombre||'').split(' ')[0]?.slice(0,9).toUpperCase() : `${m.capacidad}P`}
              </text>

              {tieneReserva && (
                <text x={cx} y={cy+24} fill={glowCol} fontSize={9} fontWeight={800} textAnchor="middle"
                  fontFamily="'IBM Plex Mono', monospace">
                  {(reserva.hora||'').slice(0,5)}
                </text>
              )}
            </g>
          );
        })}

        {mesas.length===0 && (
          <text x={VW_PLANO/2} y={VH_PLANO/2} textAnchor="middle" fill="#666" fontSize={18}
            fontFamily="'IBM Plex Mono', monospace" letterSpacing="0.2em">
            SIN PLANO CARGADO · EDITOR DE PLANTA
          </text>
        )}
      </svg>
    </div>
  );
}
