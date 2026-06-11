import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase.ts';
import { useAuth } from '../contexts/AuthContext';
import { useRestaurant } from '../contexts/RestaurantContext';
import { ZONAS_POR_RESTAURANTE, VW_PLANO, VH_PLANO, ST_MESA, sizeForMesa } from './PlanoOMM.tsx';
import { ModuleType } from '../types';

// Roles que pueden asignar mesas en Reserve (Host / Admin / Gerencia / Desarrollo).
// Los meseros NO pueden asignar — sólo el equipo de salón gestiona la planta.
// Roles que pueden asignar mesas en Reserve.
// Incluye meseros para que puedan tomar mesas reales desde su vista y
// se conecten directo a Supabase al sentar al cliente — sin pasos extra.
const ROLES_ASIGNAR_MESA = new Set([
  'admin','gerencia','desarrollo','host','hostess','maitre','maître',
  'mesero','capitan','capitán','sommelier',
]);

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
const MAX_PAX_RESERVA = 500;        // tope total — eventos privados grandes
const MAX_PAX_MODIFICACION = 10;    // sólo grupos pequeños se editan inline

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
// Compara mesa_num (int) con name (text). Maneja "M4", "A10", "4", etc.
// Estrae los dígitos del name y compara: así "M4" coincide con mesa_num=4.
const mismaMesa = (mesaNum:any, mesaName:any): boolean => {
  if (mesaNum == null || mesaName == null) return false;
  const numStr = String(mesaNum).trim();
  const nameStr = String(mesaName).trim();
  if (!numStr || !nameStr) return false;
  if (nameStr === numStr) return true;
  // Si name tiene prefijo letras (M4, A10, BE1), extraemos los dígitos finales
  const digits = nameStr.match(/(\d+)$/)?.[1] || '';
  return digits === numStr;
};
// Frase corta del mánager según la ocasión — contexto humano de un vistazo
// ("ya pronto su celebración…"), pedido del jefe para la lista de confirmaciones.
const fraseManager = (r:any): string => {
  const o = String(r.ocasion||'').toLowerCase();
  if (o.includes('cumple'))     return '🎂 Cumpleaños — alistar postre y detalle';
  if (o.includes('aniversario'))return '💞 Aniversario — mesa especial y brindis';
  if (o.includes('negocio'))    return '💼 Cena de negocios — servicio discreto';
  if (o.includes('despedida'))  return '🥂 Despedida — coordinar brindis del grupo';
  if (o.includes('pedida') || o.includes('compromiso')) return '💍 Compromiso — máxima coordinación con sala';
  if (o && !o.includes('sin ocasión')) return `✨ ${r.ocasion} — preparar la experiencia`;
  return '';
};

const ESTADOS:any = {
  pendiente:       {c:'#FFB547',l:'⏳ Por confirmar'},
  por_confirmar:   {c:'#FFB547',l:'⏳ Por confirmar'},
  confirmada_wp:   {c:'#25D366',l:'💬 WhatsApp ✓'},
  confirmada_tel:  {c:'#00BFFF',l:'📞 Teléfono ✓'},
  no_contesta:     {c:'#FF6B35',l:'📵 No contesta'},
  confirmada:      {c:'#00E676',l:'✓ Confirmada'},
  sentada:         {c:'#448AFF',l:'🪑 Sentada'},
  completada:      {c:'#B388FF',l:'✅ Completada'},
  cancelada:       {c:'#FF5252',l:'✗ Cancelada'},
  no_show:         {c:'#50506A',l:'👻 No-show'},
};
const OCASIONES = ['Cumpleaños','Aniversario','Negocio','Primera cita','Graduación','Despedida','Celebración','Sin ocasión especial'];
// Mismos datos pero con emoji para los chips de la nueva reserva
const OCASIONES_CHIPS: { val:string; emoji:string }[] = [
  { val:'Cumpleaños',           emoji:'🎂' },
  { val:'Aniversario',          emoji:'💍' },
  { val:'Negocio',              emoji:'💼' },
  { val:'Primera cita',         emoji:'💕' },
  { val:'Graduación',           emoji:'🎓' },
  { val:'Despedida',            emoji:'👋' },
  { val:'Celebración',          emoji:'🎉' },
  { val:'Sin ocasión especial', emoji:'✦'  },
];

type Tab = 'home'|'lista'|'dashboard'|'nueva'|'editor'|'historial';

interface Reserva {
  id:number;cliente_nombre:string;cliente_email?:string;cliente_telefono?:string;
  fecha:string;hora:string;pax:number;ocasion?:string;notas?:string;
  estado:string;mesa_num?:number;restaurante_nombre?:string;origen?:string;
}

export default function ReserveModule() {
  const { profile } = useAuth();
  const { activeId: restauranteIdActivo, setActiveId, canSwitch, options: restaurantesDisponibles } = useRestaurant();
  // "En vivo" abre por defecto — pedido del jefe: lo primero son las reservas
  // que están llegando, el Dashboard queda como pestaña de análisis.
  const [tab, setTab]           = useState<Tab>('home');
  const [reservas, setReservas] = useState<Reserva[]>([]);
  const [mesas, setMesas]       = useState<any[]>([]);
  const [loading, setLoading]   = useState(true);
  const [toast, setToast]       = useState('');
  const [fechaFiltro, setFechaFiltro] = useState(new Date().toISOString().split('T')[0]);
  const [selected, setSelected]         = useState<Reserva|null>(null);
  const [asignandoMesa, setAsignandoMesa] = useState<Reserva|null>(null);
  // Popup flotante de acciones rápidas en la lista de Confirmaciones
  // (sólo: ✓ Confirmar · 📵 No contesta · ✗ Cancelar). Reemplaza la
  // columna inline que estorba en pantallas pequeñas.
  const [accionesPopup, setAccionesPopup] = useState<Reserva|null>(null);
  const puedeAsignarMesa = ROLES_ASIGNAR_MESA.has(String(profile?.role||'').toLowerCase());
  const [saving, setSaving]     = useState(false);
  const [plantaDB, setPlantaDB] = useState<any[]>([]);
  const [editMesa, setEditMesa] = useState<any|null>(null);
  const [busquedaMesa, setBusquedaMesa] = useState('');
  // Buscador de la lista de Confirmaciones (por nombre o teléfono)
  const [busquedaCliente, setBusquedaCliente] = useState('');
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

  // ── Auto NO-SHOW ─────────────────────────────────────────────────
  // Si una reserva confirmada pasa de su hora + 30 min sin haberse
  // sentado, el sistema la marca automáticamente como 'no_show'.
  // Esto libera la mesa para walk-ins y mejora la métrica del Dashboard.
  const GRACIA_NO_SHOW_MIN = 30;
  const CONSUMO_RESERVA_MIN = 120; // 2 horas por reserva → libera la mesa
  // Auto-completar reservas SENTADAS hace > 2 horas (libera la mesa para próxima)
  useEffect(() => {
    const hoyIso = new Date().toISOString().split('T')[0];
    if (fechaFiltro !== hoyIso) return;
    const candidatos = reservas.filter((r:any) => {
      if (r.estado !== 'sentada' || !r.sentado_at) return false;
      const minSentada = (Date.now() - new Date(r.sentado_at).getTime()) / 60000;
      return minSentada > CONSUMO_RESERVA_MIN;
    });
    if (candidatos.length === 0) return;
    (async () => {
      for (const r of candidatos) {
        try {
          await supabase.from('reservations').update({ estado:'completada' }).eq('id', r.id);
          // Liberar la mesa en tables si estaba marcada
          if (r.mesa_num) {
            await supabase.from('tables').update({ estado:'libre', mesero_nombre:null, abierta_en:null, pax_actual:0, cliente_nombre:null })
              .eq('name', String(r.mesa_num)).eq('restaurante_id', restauranteIdActivo);
          }
        } catch (e) { console.warn('auto completar 2h:', e); }
      }
      show(`✓ ${candidatos.length} mesa${candidatos.length===1?'':'s'} liberada${candidatos.length===1?'':'s'} (consumo >${CONSUMO_RESERVA_MIN/60}h)`);
      fetchData();
    })();
  }, [now, fechaFiltro, reservas, restauranteIdActivo]);
  useEffect(() => {
    const hoyIso = new Date().toISOString().split('T')[0];
    if (fechaFiltro !== hoyIso) return; // solo para reservas de hoy
    const ahora = new Date();
    const ahoraMin = ahora.getHours()*60 + ahora.getMinutes();
    const candidatos = reservas.filter((r:any) => {
      if (r.estado !== 'confirmada' && r.estado !== 'pendiente') return false;
      if (r.origen === 'ohyeah') return false; // Oh Yeah tiene su propia lógica
      const [hh,mm] = (r.hora||'00:00').split(':').map(Number);
      const rmin = hh*60+mm;
      return rmin + GRACIA_NO_SHOW_MIN < ahoraMin;
    });
    if (candidatos.length === 0) return;
    // Actualizar en BD sin bloquear UI
    (async () => {
      const VIP_TIERS = ['VIP','CONSAGRADO','ÉLITE','ELITE','GRAND GOURMAND','LA CREME'];
      const vipNoShow:any[] = [];
      for (const r of candidatos) {
        try {
          await supabase.from('reservations').update({ estado:'no_show' }).eq('id', r.id);
          if (VIP_TIERS.includes(String(r.gourmand_level||'').toUpperCase())) {
            vipNoShow.push(r);
          }
        } catch (e) { console.warn('auto no-show:', e); }
      }
      // Notificar al panel de demand si hay no-show de VIPs (impacta forecast)
      if (vipNoShow.length > 0) {
        try {
          await supabase.from('nexum_notificaciones').insert(vipNoShow.map((r:any)=>({
            tipo: 'vip_no_show', titulo: `⭐ VIP no-show · ${r.cliente_nombre}`,
            mensaje: `Cliente VIP no llegó (${r.hora}) — liberá ${r.mesa_num?`M${r.mesa_num}`:'su asignación'}. Considerar follow-up.`,
            leida: false,
          })));
        } catch (e) { console.warn('vip notif:', e); }
      }
      if (candidatos.length >= 1) {
        const txt = vipNoShow.length > 0
          ? `👻 ${candidatos.length} no-show (>${GRACIA_NO_SHOW_MIN}min) · ⭐ ${vipNoShow.length} VIP — revisar en Dashboard`
          : `👻 ${candidatos.length} no-show automático${candidatos.length===1?'':'s'} (>${GRACIA_NO_SHOW_MIN}min sin llegar)`;
        show(txt);
      }
      fetchData();
    })();
  }, [now, fechaFiltro, reservas]);
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
  const buscarClienteReserva = async (input?:string) => {
    // Acepta teléfono o email — autodetecta por '@'
    const raw = (input ?? form.cliente_telefono ?? '').trim();
    const esEmail = raw.includes('@');
    const t = raw;
    if (!t || (esEmail ? !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(t) : t.length < 7)) {
      setReservaCRM(null);
      show(esEmail ? 'Email inválido' : 'Ingresa un celular válido (mín. 7 dígitos)');
      return;
    }
    // Si es email busca por email, si no por teléfono — en ambas tablas
    const q1 = esEmail
      ? supabase.from('customers').select('id,name,email,phone,vip_status,total_visits,total_spent,promedio_ticket,score,puntos,origen_captacion,alergias,preferencias').ilike('email', t).limit(1).maybeSingle()
      : supabase.from('customers').select('id,name,email,phone,vip_status,total_visits,total_spent,promedio_ticket,score,puntos,origen_captacion,alergias,preferencias').eq('phone', t).limit(1).maybeSingle();
    const q2 = esEmail
      ? supabase.from('nexum_clientes_ohyeah').select('id,nombre,email,telefono,nivel,visitas,total_reservas,preferencias,restricciones,notas').ilike('email', t).limit(1).maybeSingle()
      : supabase.from('nexum_clientes_ohyeah').select('id,nombre,email,telefono,nivel,visitas,total_reservas,preferencias,restricciones,notas').eq('telefono', t).limit(1).maybeSingle();
    const q3 = esEmail
      ? supabase.from('xcare_encuestas').select('estrellas,comentario,created_at').eq('cliente_email', t).order('created_at',{ascending:false}).limit(3)
      : supabase.from('xcare_encuestas').select('estrellas,comentario,created_at').eq('cliente_telefono', t).order('created_at',{ascending:false}).limit(3);
    const q4 = esEmail
      ? supabase.from('xcare_encuestas').select('estrellas,comentario,created_at').eq('cliente_email', t).or('estrellas.eq.1,estrellas.eq.5').order('created_at',{ascending:false}).limit(1).maybeSingle()
      : supabase.from('xcare_encuestas').select('estrellas,comentario,created_at').eq('cliente_telefono', t).or('estrellas.eq.1,estrellas.eq.5').order('created_at',{ascending:false}).limit(1).maybeSingle();
    const [c1, c2, encUlt, encExtrema] = await Promise.all([q1, q2, q3, q4]);
    const base = c1.data || (c2.data ? { name:c2.data.nombre, email:c2.data.email, phone:c2.data.telefono, total_visits:c2.data.visitas, total_spent:0, nivel:c2.data.nivel, vip_status:String(c2.data.nivel||'').toUpperCase()==='VIP', origen_captacion:'oh_yeah', alergias:c2.data.restricciones, preferencias:c2.data.preferencias } : null);
    if (!base) {
      // CLIENTE NUEVO — no descartamos, sino que mostramos tag distintivo
      setReservaCRM({ isNew:true, telefono: esEmail ? '' : t, email: esEmail ? t : '' });
      show('🆕 Cliente nuevo — completá los datos para crearlo');
      // Pre-rellenar el campo del que vino la búsqueda
      setForm(p=>({
        ...p,
        cliente_email: esEmail ? t : p.cliente_email,
        cliente_telefono: !esEmail ? t : p.cliente_telefono,
      }));
      return;
    }
    const ticketProm = base.promedio_ticket || (base.total_visits ? Math.round((base.total_spent||0)/base.total_visits) : 0);
    const ultimasEstrellas = (encUlt.data||[]).map((e:any)=>e.estrellas).filter((n:any)=>typeof n==='number');
    const comentarioRelevante = encExtrema.data ? { estrellas: encExtrema.data.estrellas, texto: encExtrema.data.comentario||'' } : null;
    const alergias = base.alergias || c2.data?.restricciones || '';
    const preferencias = base.preferencias || c2.data?.preferencias || '';
    setReservaCRM({ ...base, ticketProm, ultimasEstrellas, comentarioRelevante, alergias, preferencias, isNew:false });
    setForm(p=>({
      ...p,
      cliente_nombre:    p.cliente_nombre    || base.name  || '',
      cliente_email:     p.cliente_email     || base.email || '',
      cliente_telefono:  p.cliente_telefono  || base.phone || '',
    }));
    show(`✓ Datos cargados: ${base.name||'cliente'}`);
  };
  const [sugerenciasHora, setSugerenciasHora] = useState<{hora:string,libres:number}[]>([]);
  const [sobreventa, setSobreventa] = useState(0);
  // Config del Cerebro — duración estancia, sugerir franja, auto-bloqueo,
  // horario de reservas y pax_max_modificacion
  const [cerebroCfg, setCerebroCfg] = useState<{
    duracion_estancia_min:number;
    auto_bloqueo_lleno:boolean;
    sugerir_franja_pax:number;
    sugerir_franja_offset_min:number;
    horario_apertura:string;
    horario_cierre:string;
    dias_operacion:string[];
    pax_max_modificacion:number;
  }>({
    duracion_estancia_min:120, auto_bloqueo_lleno:true,
    sugerir_franja_pax:30, sugerir_franja_offset_min:15,
    horario_apertura:'12:00', horario_cierre:'23:00',
    dias_operacion:['lun','mar','mie','jue','vie','sab','dom'],
    pax_max_modificacion: MAX_PAX_MODIFICACION,
  });
  const [cerebroOpen, setCerebroOpen] = useState(false);
  const [fechasEspecialesOpen, setFechasEspecialesOpen] = useState(false);
  // Dropdown de ocasiones especiales del día (al lado del KPI Oh Yeah)
  const [ocasionesOpen, setOcasionesOpen] = useState(false);
  const [fechasEspeciales, setFechasEspeciales] = useState<any[]>([]);
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
    supabase.from('reservas_config').select('sobreventa_pct,duracion_estancia_min,auto_bloqueo_lleno,sugerir_franja_pax,sugerir_franja_offset_min,horario_apertura,horario_cierre,dias_operacion,pax_max_modificacion').eq('restaurante_id',restauranteIdActivo).maybeSingle()
      .then(({data})=>{ if(data) {
        setSobreventa(Math.min(10, data.sobreventa_pct||0));
        setCerebroCfg(prev => ({
          ...prev,
          duracion_estancia_min: data.duracion_estancia_min || 120,
          auto_bloqueo_lleno:    data.auto_bloqueo_lleno ?? true,
          sugerir_franja_pax:    data.sugerir_franja_pax || 30,
          sugerir_franja_offset_min: data.sugerir_franja_offset_min || 15,
          horario_apertura:      String(data.horario_apertura||'12:00').slice(0,5),
          horario_cierre:        String(data.horario_cierre||'23:00').slice(0,5),
          dias_operacion:        Array.isArray(data.dias_operacion) ? data.dias_operacion : ['lun','mar','mie','jue','vie','sab','dom'],
          pax_max_modificacion:  data.pax_max_modificacion || MAX_PAX_MODIFICACION,
        }));
      }});
    supabase.from('reservas_fechas_especiales').select('*').eq('restaurante_id',restauranteIdActivo).order('fecha')
      .then(({data})=>{ if(data) setFechasEspeciales(data); });
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

    // ── Enriquecer con datos del CRM para insights: total_visits, alergias,
    // preferencias, vip, ultima_visita. Busqueda por teléfono o email.
    const telefonos = todas.map((r:any) => (r.cliente_telefono||'').trim()).filter(Boolean);
    const emails    = todas.map((r:any) => (r.cliente_email||'').trim().toLowerCase()).filter(Boolean);
    let customers:any[] = [];
    if (telefonos.length > 0 || emails.length > 0) {
      const orParts:string[] = [];
      if (telefonos.length > 0) orParts.push(`phone.in.(${telefonos.map(t=>`"${t.replace(/"/g,'')}"`).join(',')})`);
      if (emails.length > 0)    orParts.push(`email.in.(${emails.map(e=>`"${e.replace(/"/g,'')}"`).join(',')})`);
      const { data: cs } = await supabase.from('customers')
        .select('id,name,phone,email,vip_status,total_visits,ultima_visita,alergias,preferencias')
        .or(orParts.join(','));
      customers = cs || [];
    }
    const byPhone = new Map(customers.filter(c=>c.phone).map(c=>[String(c.phone).trim(), c]));
    const byEmail = new Map(customers.filter(c=>c.email).map(c=>[String(c.email).trim().toLowerCase(), c]));
    const enriquecidas = todas.map((r:any) => {
      const c = (r.cliente_telefono && byPhone.get(r.cliente_telefono.trim()))
             || (r.cliente_email && byEmail.get(r.cliente_email.trim().toLowerCase()));
      return c ? {
        ...r,
        vip: c.vip_status || r.vip,
        total_visits: c.total_visits ?? r.total_visits,
        ultima_visita: c.ultima_visita ?? r.ultima_visita,
        alergias: c.alergias ?? r.alergias,
        preferencias: c.preferencias ?? r.preferencias,
      } : r;
    });
    setReservas(enriquecidas);
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
      })
      // Suscribirse también a tables — cuando el POS cambia el estado de
      // una mesa (abre/cierra/comparte), el plano de Reserve refresca al
      // instante. Antes quedaba desactualizado hasta el próximo fetch manual.
      .on('postgres_changes',{event:'*',schema:'public',table:'tables'}, () => fetchData())
      // Reservations: refresca cuando otro módulo cambia estado de reserva
      .on('postgres_changes',{event:'*',schema:'public',table:'reservations'}, () => fetchData())
      .subscribe();
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
    if (saving) return; // anti doble-click: un solo submit a la vez
    if (!form.cliente_nombre) { show('⚠️ Nombre requerido'); return; }
    // Más de 16 personas → evento privado, escribir al restaurante
    if ((form.pax||0) > MAX_PAX_RESERVA) {
      show(`🎉 Grupos de +${MAX_PAX_RESERVA} se reservan por evento — el cliente debe escribir al restaurante`);
      return;
    }
    // Bloquear el botón ANTES de los chequeos remotos (la RPC tarda y cada
    // click extra creaba una reserva duplicada).
    setSaving(true);
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
        setSaving(false);
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
      if (!confirm(`🚫 La hora ${horaForm} está en una franja bloqueada (${franjaBloqueada.hora_desde.slice(0,5)}–${franjaBloqueada.hora_hasta.slice(0,5)}${franjaBloqueada.motivo?' · '+franjaBloqueada.motivo:''}). ¿Crear igual? (las reservas manuales pueden sobreescribir el bloqueo)`)) { setSaving(false); return; }
    }
    // Las nuevas reservas manuales (teléfono/WhatsApp) entran POR CONFIRMAR;
    // al editar no se pisa el estado actual de la reserva.
    const payload:any = {...form,restaurante_id: restauranteIdActivo,mesa_num:form.mesa_num||null};
    delete payload.invitar_ohyeah; // flag de UI — no es columna de reservations
    let errorBD:any = null;
    if (selected?.id) {
      delete payload.estado;
      ({ error: errorBD } = await supabase.from('reservations').update(payload).eq('id',selected.id));
      if (!errorBD) show('✓ Reserva actualizada');
    } else {
      payload.estado = 'pendiente';
      ({ error: errorBD } = await supabase.from('reservations').insert(payload));
      if (!errorBD) show('✓ Reserva creada — queda Por confirmar');
    }
    if (errorBD) {
      show(`✗ No se pudo guardar: ${errorBD.message}`);
      setSaving(false);
      return;
    }
    // Sincronizar el CRM: si el maitre cambia/agrega datos, los persistimos
    // en customers (origen_captacion=reserva). Idempotente — upsert por phone.
    // CRM e invitación corren en segundo plano — la reserva ya quedó guardada
    // y el maitre no debe esperar estas sincronizaciones para seguir operando.
    (async () => {
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
      // Encolar invitación a Oh Yeah si el maitre marcó el opt-in del cliente
      if (form.invitar_ohyeah && form.cliente_email?.trim()) {
        try {
          await supabase.from('ohyeah_invitaciones').upsert({
            restaurante_id: restauranteIdActivo,
            cliente_nombre: form.cliente_nombre,
            cliente_email: form.cliente_email.trim(),
            cliente_telefono: form.cliente_telefono?.trim() || null,
            origen: 'reserva_maitre',
            estado: 'pendiente',
          }, { onConflict: 'restaurante_id,cliente_email' });
          show(`🦉 Invitación a Oh Yeah encolada para ${form.cliente_email}`);
        } catch (e) { console.warn('No se pudo encolar invitación Oh Yeah:', e); }
      }
    })();
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

// asignarMesa ahora acepta el NOMBRE de la mesa (string "A10") o el número
// directo. Resuelve internamente:
//   · mesaName (string) para .eq('name', ...) en tables
//   · mesaNum (int)     para reservations.mesa_num
// Bug previo: Number("A10") = NaN → mesa_num quedaba NULL y tables no
// actualizaba ninguna fila porque eq('name','NaN') no matchea.
const asignarMesa = async (reservaId:any, mesaInput:number|string, meseroNombre?:string) => {
  const esOhYeah = typeof reservaId === 'string' && reservaId.includes('-');
  const reserva = reservas.find((r:any)=>String(r.id)===String(reservaId));
  const mesero = (meseroNombre||'').trim() || null;

  // 1) Resolver mesa: buscar en mesas[] por name o num exactos
  const inputStr = String(mesaInput);
  const mesaDestino:any = mesas.find((m:any) =>
    String(m.name) === inputStr || String(m.num) === inputStr
  ) || mesas.find((m:any) => {
    // Fallback: comparar la parte numérica
    const mNum = parseInt(String(m.name||'').replace(/\D/g,''),10);
    return !isNaN(mNum) && mNum === parseInt(inputStr.replace(/\D/g,''),10);
  });
  if (!mesaDestino) {
    show(`⚠️ Mesa "${inputStr}" no encontrada en el plano`);
    console.error('asignarMesa: mesa no encontrada', { mesaInput, namesDisponibles: mesas.map((m:any)=>m.name) });
    return;
  }
  const mesaName = String(mesaDestino.name);
  const mesaNumInt = parseInt(mesaName.replace(/\D/g,''), 10) || Number(mesaDestino.num) || 0;

  // 2) Regla: un cliente no puede estar sentado en dos mesas a la vez.
  if (reserva?.cliente_telefono) {
    const yaSentado = reservas.find((r:any) =>
      String(r.id)!==String(reservaId) && r.estado==='sentada' &&
      String(r.cliente_telefono||'')===String(reserva.cliente_telefono));
    if (yaSentado) {
      show(`⚠️ ${reserva.cliente_nombre} ya está sentado en la mesa ${yaSentado.mesa_num} — libérala primero`);
      return;
    }
  }
  // 3) Capacidad — confirmación si excede
  const capMax = Number(mesaDestino?.capacidad ?? mesaDestino?.capacity ?? 0);
  if (capMax > 0 && (reserva?.pax||0) > capMax) {
    if (!confirm(`⚠️ La mesa ${mesaName} es para ${capMax} personas y el grupo es de ${reserva?.pax}. ¿Sentarlos igual (modo manual)?`)) return;
  }

  // 4) Update reservas — usando el ENTERO real (mesa_num es int en BD)
  let upErr: any = null;
  if (esOhYeah) {
    const r = await supabase.from('ohyeah_reservas')
      .update({ status:'seated', mesa_num: mesaNumInt, mesa_asignada_at:new Date().toISOString(), mesa_asignada_por: mesero })
      .eq('id', reservaId);
    upErr = r.error;
  } else {
    const r = await supabase.from('reservations').update({
      mesa_num: mesaNumInt,
      estado:'sentada',
      sentado_at: new Date().toISOString(),
    }).eq('id', reservaId);
    upErr = r.error;
  }
  if (upErr) {
    console.error('asignarMesa · update reserva falló:', upErr);
    show(`✗ No se pudo actualizar la reserva: ${upErr.message||'error'}`);
    return;
  }

  // 5) Update tables — usando el NOMBRE EXACTO ("A10", "S3", etc.)
  // status (col legacy inglés) también se actualiza: el POS la lee primero
  // en su map (m.status || m.estado) — sin esto la mesa quedaba 'free' allá.
  const { error: tblErr } = await supabase.from('tables').update({
    estado:'ocupada',
    status:'occupied',
    cliente_nombre: reserva?.cliente_nombre || null,
    pax_actual: reserva?.pax || 0,
    mesero_nombre: mesero,
    abierta_en: new Date().toISOString(),
  }).eq('name', mesaName);
  if (tblErr) {
    console.error('asignarMesa · update tables falló:', tblErr);
    show(`⚠ Reserva actualizada pero la mesa no se marcó ocupada: ${tblErr.message||'error'}`);
    return;
  }

  show(mesero ? `✓ Mesa ${mesaName} asignada a ${mesero}` : `✓ Mesa ${mesaName} asignada — libre para tomar`);
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
          userName={profile?.nombre_completo || profile?.full_name || 'Host'}
        />
      )}

      {/* ── MODAL CEREBRO de RESERVA · duración + auto-bloqueo + sugerir franja ── */}
      {cerebroOpen && (
        <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.85)',zIndex:9998,display:'flex',alignItems:'center',justifyContent:'center',padding:16}} onClick={()=>setCerebroOpen(false)}>
          <div onClick={e=>e.stopPropagation()} style={{background:S.bg2,border:`2px solid ${S.purple}`,borderRadius:20,width:'100%',maxWidth:440,padding:24,maxHeight:'92vh',overflowY:'auto'}}>
            <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:18}}>
              <span style={{fontSize:26}}>🧠</span>
              <div>
                <div style={{fontFamily:"'Syne',sans-serif",fontSize:17,fontWeight:900}}>Cerebro de Reserva</div>
                <div style={{fontSize:11,color:S.t3}}>Reglas operativas que aplica el sistema en automático.</div>
              </div>
            </div>

            <div style={{display:'flex',flexDirection:'column',gap:14}}>
              {/* Duración estancia */}
              <div style={{background:S.bg3,borderRadius:12,padding:14,border:`1px solid ${S.border}`}}>
                <div style={{fontSize:11,color:S.gold,fontWeight:800,marginBottom:4,textTransform:'uppercase',letterSpacing:'.1em'}}>⏱ Duración promedio mesa</div>
                <div style={{fontSize:10,color:S.t3,marginBottom:8,lineHeight:1.4}}>Minutos que el sistema reserva una mesa al sentarla. Tras este tiempo la libera para próximos turnos.</div>
                <div style={{display:'flex',gap:8,alignItems:'center'}}>
                  <input type="number" min={45} max={240} value={cerebroCfg.duracion_estancia_min}
                    onChange={e=>setCerebroCfg(c=>({...c,duracion_estancia_min: parseInt(e.target.value)||120}))}
                    style={{width:90,background:S.bg,border:`1px solid ${S.gold}55`,borderRadius:8,padding:'8px 12px',color:S.gold,fontSize:14,fontWeight:800,outline:'none',textAlign:'center'}}/>
                  <span style={{fontSize:12,color:S.t2}}>minutos · default 120</span>
                </div>
              </div>

              {/* Auto-bloqueo */}
              <div style={{background:S.bg3,borderRadius:12,padding:14,border:`1px solid ${S.border}`}}>
                <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',gap:10}}>
                  <div style={{flex:1}}>
                    <div style={{fontSize:11,color:S.red,fontWeight:800,textTransform:'uppercase',letterSpacing:'.1em'}}>🚫 Auto-bloqueo cuando lleno</div>
                    <div style={{fontSize:10,color:S.t3,marginTop:3,lineHeight:1.4}}>Si todas las mesas están reservadas/sentadas, la franja completa se bloquea por {cerebroCfg.duracion_estancia_min} min y no acepta más reservas.</div>
                  </div>
                  <button onClick={()=>setCerebroCfg(c=>({...c,auto_bloqueo_lleno:!c.auto_bloqueo_lleno}))}
                    style={{width:48,height:26,borderRadius:50,border:'none',background:cerebroCfg.auto_bloqueo_lleno?S.green:S.bg4,position:'relative',cursor:'pointer',flexShrink:0,transition:'all .15s'}}>
                    <div style={{width:20,height:20,borderRadius:'50%',background:'#fff',position:'absolute',top:3,left:cerebroCfg.auto_bloqueo_lleno?25:3,transition:'all .15s'}}/>
                  </button>
                </div>
              </div>

              {/* Sugerir franja */}
              <div style={{background:S.bg3,borderRadius:12,padding:14,border:`1px solid ${S.border}`}}>
                <div style={{fontSize:11,color:S.cyan,fontWeight:800,marginBottom:4,textTransform:'uppercase',letterSpacing:'.1em'}}>⏰ Sugerir franja al saturar</div>
                <div style={{fontSize:10,color:S.t3,marginBottom:8,lineHeight:1.4}}>Cuando llegan más de N pax al mismo horario, sugerir ±M min para no saturar cocina.</div>
                <div style={{display:'flex',gap:10,alignItems:'center',flexWrap:'wrap'}}>
                  <div>
                    <div style={{fontSize:9,color:S.t3,marginBottom:3}}>Umbral pax</div>
                    <input type="number" min={10} max={80} value={cerebroCfg.sugerir_franja_pax}
                      onChange={e=>setCerebroCfg(c=>({...c,sugerir_franja_pax: parseInt(e.target.value)||30}))}
                      style={{width:70,background:S.bg,border:`1px solid ${S.cyan}55`,borderRadius:8,padding:'6px 10px',color:S.cyan,fontSize:13,fontWeight:800,outline:'none',textAlign:'center'}}/>
                  </div>
                  <div>
                    <div style={{fontSize:9,color:S.t3,marginBottom:3}}>Offset ±min</div>
                    <input type="number" min={5} max={60} value={cerebroCfg.sugerir_franja_offset_min}
                      onChange={e=>setCerebroCfg(c=>({...c,sugerir_franja_offset_min: parseInt(e.target.value)||15}))}
                      style={{width:70,background:S.bg,border:`1px solid ${S.cyan}55`,borderRadius:8,padding:'6px 10px',color:S.cyan,fontSize:13,fontWeight:800,outline:'none',textAlign:'center'}}/>
                  </div>
                </div>
              </div>

              {/* Horario de reservas */}
              <div style={{background:S.bg3,borderRadius:12,padding:14,border:`1px solid ${S.border}`}}>
                <div style={{fontSize:11,color:S.green,fontWeight:800,marginBottom:4,textTransform:'uppercase',letterSpacing:'.1em'}}>🕐 Horario de reservas</div>
                <div style={{fontSize:10,color:S.t3,marginBottom:8,lineHeight:1.4}}>Rango horario en que se aceptan reservas y días que opera el restaurante.</div>
                <div style={{display:'flex',gap:8,alignItems:'flex-end',flexWrap:'wrap',marginBottom:10}}>
                  <div>
                    <div style={{fontSize:9,color:S.t3,marginBottom:3}}>Apertura</div>
                    <input type="time" value={cerebroCfg.horario_apertura}
                      onChange={e=>setCerebroCfg(c=>({...c,horario_apertura:e.target.value}))}
                      style={{background:S.bg,border:`1px solid ${S.green}55`,borderRadius:8,padding:'8px 12px',color:S.green,fontSize:14,fontWeight:800,outline:'none',colorScheme:'dark'}}/>
                  </div>
                  <div>
                    <div style={{fontSize:9,color:S.t3,marginBottom:3}}>Cierre</div>
                    <input type="time" value={cerebroCfg.horario_cierre}
                      onChange={e=>setCerebroCfg(c=>({...c,horario_cierre:e.target.value}))}
                      style={{background:S.bg,border:`1px solid ${S.green}55`,borderRadius:8,padding:'8px 12px',color:S.green,fontSize:14,fontWeight:800,outline:'none',colorScheme:'dark'}}/>
                  </div>
                </div>
                <div style={{fontSize:9,color:S.t3,marginBottom:5}}>Días que opera</div>
                <div style={{display:'flex',gap:4,flexWrap:'wrap'}}>
                  {[
                    {k:'lun',l:'Lun'},{k:'mar',l:'Mar'},{k:'mie',l:'Mié'},
                    {k:'jue',l:'Jue'},{k:'vie',l:'Vie'},{k:'sab',l:'Sáb'},{k:'dom',l:'Dom'},
                  ].map(d => {
                    const sel = cerebroCfg.dias_operacion.includes(d.k);
                    return (
                      <button key={d.k} type="button"
                        onClick={()=>setCerebroCfg(c=>({...c, dias_operacion: sel ? c.dias_operacion.filter(x=>x!==d.k) : [...c.dias_operacion, d.k] }))}
                        style={{padding:'5px 11px',borderRadius:7,border:`1px solid ${sel?S.green:S.border}`,background:sel?`${S.green}18`:'transparent',color:sel?S.green:S.t3,fontSize:11,fontWeight:700,cursor:'pointer'}}>
                        {d.l}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Fechas especiales — botón que abre modal */}
              <div style={{background:`linear-gradient(135deg,${S.gold}10,${S.purple}06)`,borderRadius:12,padding:14,border:`1px solid ${S.gold}40`}}>
                <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',gap:10,marginBottom:8}}>
                  <div style={{flex:1}}>
                    <div style={{fontSize:11,color:S.gold,fontWeight:800,textTransform:'uppercase',letterSpacing:'.1em'}}>✦ Fechas especiales</div>
                    <div style={{fontSize:10,color:S.t3,marginTop:3,lineHeight:1.4}}>Días puntuales (San Valentín, Navidad, Madre, etc.) con horario libre — habilitan reservas aunque el día no opere normalmente.</div>
                  </div>
                  <span style={{fontSize:11,color:S.gold,fontWeight:900,background:`${S.gold}20`,padding:'4px 10px',borderRadius:50,whiteSpace:'nowrap'}}>{fechasEspeciales.length}</span>
                </div>
                <button type="button" onClick={()=>{ setCerebroOpen(false); setFechasEspecialesOpen(true); }}
                  style={{width:'100%',padding:'10px',borderRadius:10,border:`1px solid ${S.gold}55`,background:`${S.gold}15`,color:S.gold,fontSize:12,fontWeight:800,cursor:'pointer'}}>
                  📅 Configurar fechas especiales →
                </button>
              </div>

              {/* Pax máximo para modificación inline */}
              <div style={{background:S.bg3,borderRadius:12,padding:14,border:`1px solid ${S.border}`}}>
                <div style={{fontSize:11,color:S.blue,fontWeight:800,marginBottom:4,textTransform:'uppercase',letterSpacing:'.1em'}}>✏️ Pax máx. modificación</div>
                <div style={{fontSize:10,color:S.t3,marginBottom:8,lineHeight:1.4}}>Grupos hasta N pax se editan inline. Más grandes requieren reabrir como evento.</div>
                <div style={{display:'flex',gap:8,alignItems:'center'}}>
                  <input type="number" min={2} max={50} value={cerebroCfg.pax_max_modificacion}
                    onChange={e=>setCerebroCfg(c=>({...c,pax_max_modificacion: parseInt(e.target.value)||10}))}
                    style={{width:90,background:S.bg,border:`1px solid ${S.blue}55`,borderRadius:8,padding:'8px 12px',color:S.blue,fontSize:14,fontWeight:800,outline:'none',textAlign:'center'}}/>
                  <span style={{fontSize:12,color:S.t2}}>pax · default 10</span>
                </div>
              </div>

              {/* Sobreventa (ya existía) */}
              <div style={{background:S.bg3,borderRadius:12,padding:14,border:`1px solid ${S.border}`}}>
                <div style={{fontSize:11,color:S.purple,fontWeight:800,marginBottom:4,textTransform:'uppercase',letterSpacing:'.1em'}}>📈 Sobreventa VIP</div>
                <div style={{fontSize:10,color:S.t3,marginBottom:8,lineHeight:1.4}}>% de reservas extra sobre la capacidad (apuesta a no-shows). Máx 10%.</div>
                <div style={{display:'flex',gap:8,alignItems:'center'}}>
                  <input type="number" min={0} max={10} value={sobreventa}
                    onChange={e=>setSobreventa(Math.max(0,Math.min(10, parseInt(e.target.value)||0)))}
                    style={{width:80,background:S.bg,border:`1px solid ${S.purple}55`,borderRadius:8,padding:'8px 12px',color:S.purple,fontSize:14,fontWeight:800,outline:'none',textAlign:'center'}}/>
                  <span style={{fontSize:12,color:S.t2}}>%</span>
                </div>
              </div>
            </div>

            <button onClick={async()=>{
                await supabase.from('reservas_config').upsert({
                  restaurante_id: restauranteIdActivo,
                  sobreventa_pct: sobreventa,
                  duracion_estancia_min: cerebroCfg.duracion_estancia_min,
                  auto_bloqueo_lleno: cerebroCfg.auto_bloqueo_lleno,
                  sugerir_franja_pax: cerebroCfg.sugerir_franja_pax,
                  sugerir_franja_offset_min: cerebroCfg.sugerir_franja_offset_min,
                  horario_apertura: cerebroCfg.horario_apertura,
                  horario_cierre: cerebroCfg.horario_cierre,
                  dias_operacion: cerebroCfg.dias_operacion,
                  pax_max_modificacion: cerebroCfg.pax_max_modificacion,
                  updated_at: new Date().toISOString(),
                });
                show('✓ Cerebro actualizado');
                setCerebroOpen(false);
              }}
              style={{width:'100%',marginTop:18,padding:'12px',borderRadius:12,border:'none',background:`linear-gradient(135deg,${S.purple},${S.blue})`,color:'#fff',fontSize:13,fontWeight:900,cursor:'pointer'}}>
              💾 Guardar reglas del Cerebro
            </button>
          </div>
        </div>
      )}

      {/* ── MODAL FECHAS ESPECIALES · días puntuales con horario libre ── */}
      {fechasEspecialesOpen && (
        <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.85)',zIndex:9998,display:'flex',alignItems:'center',justifyContent:'center',padding:16}} onClick={()=>setFechasEspecialesOpen(false)}>
          <div onClick={e=>e.stopPropagation()} style={{background:S.bg2,border:`2px solid ${S.gold}`,borderRadius:20,width:'100%',maxWidth:540,maxHeight:'90vh',overflowY:'auto',padding:24}}>
            <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:18}}>
              <span style={{fontSize:26}}>✦</span>
              <div style={{flex:1}}>
                <div style={{fontFamily:"'Syne',sans-serif",fontSize:17,fontWeight:900}}>Fechas especiales</div>
                <div style={{fontSize:11,color:S.t3}}>Habilitan reservas en días puntuales con horario libre, aunque el restaurante no opere normalmente ese día.</div>
              </div>
              <button onClick={()=>setFechasEspecialesOpen(false)} style={{width:32,height:32,borderRadius:9,border:`1px solid ${S.border2}`,background:'transparent',color:S.t3,fontSize:15,cursor:'pointer'}}>✕</button>
            </div>

            {/* Form agregar fecha especial */}
            <FechaEspecialForm
              restauranteId={restauranteIdActivo}
              onCreated={(nueva) => setFechasEspeciales(p => [...p, nueva].sort((a:any,b:any)=>String(a.fecha).localeCompare(b.fecha)))}
              S={S}
            />

            {/* Lista */}
            <div style={{marginTop:16,fontSize:10,color:S.t3,fontWeight:800,textTransform:'uppercase',letterSpacing:'.14em',marginBottom:8}}>
              Fechas registradas · {fechasEspeciales.length}
            </div>
            {fechasEspeciales.length === 0 ? (
              <div style={{textAlign:'center',padding:30,color:S.t3,fontSize:12,background:S.bg3,borderRadius:10,border:`1px dashed ${S.border}`}}>
                Sin fechas especiales todavía. Agregá una arriba.
              </div>
            ) : (
              <div style={{display:'flex',flexDirection:'column',gap:6}}>
                {fechasEspeciales.map((fe:any) => {
                  const d = new Date(fe.fecha+'T12:00:00');
                  const yaPaso = d < new Date(new Date().toISOString().split('T')[0]+'T12:00:00');
                  return (
                    <div key={fe.id} style={{display:'flex',alignItems:'center',gap:10,padding:'10px 12px',background:fe.habilitada?S.bg3:'rgba(255,82,82,0.04)',borderRadius:10,border:`1px solid ${fe.habilitada?S.gold+'33':S.border}`,opacity:yaPaso?0.5:1}}>
                      <div style={{textAlign:'center',minWidth:50}}>
                        <div style={{fontFamily:"'Syne',serif",fontSize:18,fontWeight:900,color:S.gold,lineHeight:1}}>{d.getDate()}</div>
                        <div style={{fontSize:9,color:S.t3,textTransform:'uppercase'}}>{d.toLocaleDateString('es-CO',{month:'short'})}</div>
                      </div>
                      <div style={{flex:1,minWidth:0}}>
                        <div style={{fontSize:13,fontWeight:700,color:S.t1}}>{fe.titulo}</div>
                        <div style={{fontSize:10,color:S.t3,display:'flex',gap:6,flexWrap:'wrap'}}>
                          <span>🕐 {String(fe.hora_inicio||'00:00').slice(0,5)} – {String(fe.hora_fin||'23:59').slice(0,5)}</span>
                          {fe.cupo_pax && <span>· 🪑 cupo {fe.cupo_pax}p</span>}
                          {fe.override_horario && <span style={{color:S.gold}}>· libre</span>}
                        </div>
                      </div>
                      <button onClick={async()=>{
                          await supabase.from('reservas_fechas_especiales').update({ habilitada: !fe.habilitada }).eq('id', fe.id);
                          setFechasEspeciales(p => p.map((x:any) => x.id===fe.id ? {...x, habilitada: !fe.habilitada} : x));
                        }}
                        style={{width:48,height:24,borderRadius:50,border:'none',background:fe.habilitada?S.green:S.bg4,position:'relative',cursor:'pointer',flexShrink:0,transition:'all .15s'}}>
                        <div style={{width:18,height:18,borderRadius:'50%',background:'#fff',position:'absolute',top:3,left:fe.habilitada?27:3,transition:'all .15s'}}/>
                      </button>
                      <button onClick={async()=>{
                          if (!confirm(`Eliminar "${fe.titulo}" del ${fe.fecha}?`)) return;
                          await supabase.from('reservas_fechas_especiales').delete().eq('id', fe.id);
                          setFechasEspeciales(p => p.filter((x:any) => x.id !== fe.id));
                        }}
                        style={{padding:'5px 9px',borderRadius:7,border:`1px solid ${S.red}40`,background:'transparent',color:S.red,fontSize:11,fontWeight:700,cursor:'pointer'}}>
                        ✕
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
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
          // Estado en vivo desde tables (si existe). mismaMesa normaliza prefijos como "M4"/"A10"
          const tEnVivo = mesas.find((m:any) => mismaMesa(num, m.name));
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
            x: p.x, y: p.y, w: p.w || 10, h: p.h || 10, shape: p.shape || 'round',
          };
        }).filter((t:any) => !isNaN(t.num))
          // Las barras NO entran en reservas — van en el POS
          .filter((t:any) => !String(t.zona||'').toLowerCase().startsWith('barra'))
          .sort((a:any,b:any) => a.num - b.num);
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
                {/* ── IA · SUGERENCIA INTELIGENTE DE MESA ── */}
                {(() => {
                  // Score por mesa: cuanto mayor mejor.
                  // Penaliza waste (mesa de 6 para 2 pax) y prioriza VIP en mesas VIP.
                  const scoreMesa = (t:any) => {
                    const libre = t.estado === 'libre' || !t.estado;
                    if (!libre) return -1;
                    const rg = rangoMesa(t.cap);
                    if (pax < rg.min || pax > rg.max) return -1;
                    let score = 100;
                    // Eficiencia: capacidad usada / total. Menos waste = mejor
                    const eficiencia = pax / t.cap;
                    score += eficiencia * 30;
                    // VIP cliente → prioriza VIP table
                    if (clienteVip && t.vip) score += 40;
                    // Cliente no-VIP en mesa VIP = penaliza (reserva para VIPs futuros)
                    if (!clienteVip && t.vip) score -= 25;
                    // Zona elegante para ocasiones especiales (proxy: zonas no-barra)
                    if (r.ocasion && r.ocasion !== 'Sin ocasión especial' && !String(t.zona||'').toLowerCase().startsWith('barra')) score += 8;
                    return score;
                  };
                  const sugerencias = tablesList
                    .map((t:any) => ({ ...t, ia_score: scoreMesa(t) }))
                    .filter((t:any) => t.ia_score >= 0)
                    .sort((a:any,b:any) => b.ia_score - a.ia_score);
                  // REGLA DE ORO — las sugerencias deben ser mesas DISTINTAS
                  // (cada mesa aparece sólo una vez). Tomamos las 3 mejores
                  // por número de mesa único, priorizando ajuste de pax.
                  const yaVistas = new Set<number>();
                  const topDistintas = sugerencias.filter((t:any) => {
                    if (yaVistas.has(t.num)) return false;
                    yaVistas.add(t.num);
                    return true;
                  }).slice(0, 3);
                  const top = topDistintas[0];
                  // Combinaciones: si no hay mesa suficiente para 6+, combinar 2 mesas adyacentes
                  const combinaciones: any[] = [];
                  if (sugerencias.length === 0 && pax >= 4) {
                    const libres = tablesList.filter((t:any)=>(t.estado==='libre'||!t.estado));
                    for (let i=0;i<libres.length;i++) {
                      for (let j=i+1;j<libres.length;j++) {
                        const capCombo = libres[i].cap + libres[j].cap;
                        const mismaZona = libres[i].zona === libres[j].zona;
                        if (mismaZona && capCombo >= pax && capCombo <= pax + 2) {
                          combinaciones.push({ m1: libres[i], m2: libres[j], cap: capCombo });
                        }
                      }
                    }
                  }
                  return (
                    <>
                      {top ? (
                        <div style={{marginBottom:14,padding:'14px 16px',borderRadius:14,background:`linear-gradient(135deg, ${top.vip?S.gold:S.green}18, ${S.purple}08)`,border:`2px solid ${top.vip?S.gold:S.green}55`,position:'relative',overflow:'hidden'}}>
                          <div style={{position:'absolute',top:0,right:0,padding:'3px 10px',background:`${top.vip?S.gold:S.green}30`,borderRadius:'0 0 0 10px',fontSize:9,fontWeight:800,color:top.vip?S.gold:S.green,textTransform:'uppercase',letterSpacing:'.12em'}}>
                            ✦ IA NEXUM
                          </div>
                          <div style={{fontSize:10,color:top.vip?S.gold:S.green,fontWeight:800,textTransform:'uppercase',letterSpacing:'.16em',marginBottom:6}}>Mejor mesa sugerida</div>
                          <div style={{display:'flex',alignItems:'baseline',gap:10,flexWrap:'wrap'}}>
                            <span style={{fontFamily:"'Syne',serif",fontSize:30,fontWeight:900,color:top.vip?S.gold:S.green,letterSpacing:'-0.02em'}}>M{top.num}</span>
                            <span style={{fontSize:12,color:S.t2,fontWeight:700}}>{top.cap}p · {top.zona}{top.vip?' · ⭐ VIP':''}</span>
                            <span style={{marginLeft:'auto',fontSize:10,color:S.t3}}>score IA: <strong style={{color:S.t1}}>{Math.round(top.ia_score)}</strong></span>
                          </div>
                          <div style={{fontSize:11,color:S.t2,marginTop:6,lineHeight:1.5}}>
                            {clienteVip && top.vip && '⭐ Cliente VIP en mesa VIP — match perfecto. '}
                            {!clienteVip && !top.vip && `Eficiencia ${Math.round((pax/top.cap)*100)}% — pax/capacidad ideal. `}
                            {r.ocasion && r.ocasion !== 'Sin ocasión especial' && '🎉 Zona apta para la ocasión. '}
                            La IA priorizó por VIP, eficiencia y ambiente.
                          </div>
                          <button onClick={()=>{ asignarMesa(r.id, top.num, meseroAsignar); setAsignandoMesa(null); setMeseroAsignar(''); }}
                            style={{marginTop:10,width:'100%',padding:'10px',borderRadius:10,border:'none',background:top.vip?`linear-gradient(135deg, ${S.gold}, ${S.gold}aa)`:`linear-gradient(135deg, ${S.green}, ${S.green}aa)`,color:'#000',fontSize:12,fontWeight:900,cursor:'pointer'}}>
                            ✓ Asignar a M{top.num} (sugerencia IA)
                          </button>
                          {/* Mesa sugerida SOLO 1 — el host decide rápido sin distracción.
                              Si quiere ver alternativas, abajo está el zona-por-zona completo. */}
                        </div>
                      ) : combinaciones.length > 0 ? (
                        <div style={{marginBottom:14,padding:'14px 16px',borderRadius:14,background:`${S.purple}10`,border:`2px solid ${S.purple}55`}}>
                          <div style={{fontSize:10,color:S.purple,fontWeight:800,textTransform:'uppercase',letterSpacing:'.16em',marginBottom:8}}>✦ IA · Combinar mesas</div>
                          <div style={{fontSize:11,color:S.t2,marginBottom:8}}>No hay mesa de {pax}p libre. Sugerencia: combinar dos mesas en la misma zona.</div>
                          {combinaciones.slice(0,2).map((c:any,i:number)=>(
                            <div key={i} style={{padding:'10px 12px',background:S.bg3,border:`1px solid ${S.border}`,borderRadius:10,marginBottom:6,display:'flex',alignItems:'center',gap:10}}>
                              <span style={{fontFamily:"'Syne',serif",fontSize:18,fontWeight:900,color:S.purple}}>M{c.m1.num} + M{c.m2.num}</span>
                              <span style={{fontSize:10,color:S.t3,flex:1}}>{c.cap}p · {c.m1.zona}</span>
                              <button onClick={async ()=>{
                                  // Registrar la unión en mesas_combinadas (para que POS y plano
                                  // sepan que M{m1} y M{m2} están físicamente juntas hoy)
                                  await supabase.from('mesas_combinadas').insert({
                                    restaurante_id: restauranteIdActivo,
                                    fecha: r.fecha || hoy,
                                    mesa_principal: c.m1.num,
                                    mesa_secundaria: c.m2.num,
                                    pax_total: pax,
                                    unida_por: profile?.nombre_completo || profile?.full_name || 'Sistema',
                                  });
                                  await asignarMesa(r.id, c.m1.num, meseroAsignar);
                                  setAsignandoMesa(null);
                                  setMeseroAsignar('');
                                  show(`✓ M${c.m1.num} + M${c.m2.num} unidas · ${pax}p sentados en M${c.m1.num}. M${c.m2.num} queda bloqueada para esta franja.`);
                                }}
                                style={{padding:'5px 10px',borderRadius:7,border:'none',background:S.purple,color:'#fff',fontSize:10,fontWeight:700,cursor:'pointer'}}>
                                🔗 Unir
                              </button>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div style={{marginBottom:14,padding:'14px',borderRadius:12,background:`${S.red}10`,border:`1px dashed ${S.red}55`,textAlign:'center'}}>
                          <div style={{fontSize:24,marginBottom:4}}>🚫</div>
                          <div style={{fontSize:12,color:S.red,fontWeight:700}}>Sin mesas disponibles para {pax}p</div>
                          <div style={{fontSize:10,color:S.t3,marginTop:4}}>Probá cambiar la hora o sugerí otra fecha al cliente.</div>
                        </div>
                      )}
                      <div style={{fontSize:11,color:S.t3,marginBottom:14,display:'flex',flexWrap:'wrap',gap:8,alignItems:'center'}}>
                        <span><strong style={{color:S.green,fontSize:13}}>{sugerencias.length}</strong> opciones disponibles para {pax}p</span>
                        <span style={{color:S.gold,marginLeft:8}}>⭐ VIP</span>
                        {clienteVip && <span style={{color:S.gold,fontWeight:700,marginLeft:'auto'}}>Cliente VIP — la IA prioriza mesas ⭐</span>}
                      </div>
                    </>
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

        {/* Reloj en vivo · sólo cuando viendo HOY */}
        {fechaFiltro === hoy && <RelojEnVivo S={S}/>}

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

        {/* 🎉 OCASIONES ESPECIALES · ventana desplegable al lado de Oh Yeah */}
        {(() => {
          const ocasionesHoy: Record<string, {n:number; reservas:any[]}> = {};
          reservasReales
            .filter((r:any) => !['cancelada','no_show'].includes(r.estado) && r.ocasion && r.ocasion !== 'Sin ocasión especial' && r.ocasion !== 'Walk-in')
            .forEach((r:any) => {
              if (!ocasionesHoy[r.ocasion]) ocasionesHoy[r.ocasion] = { n:0, reservas:[] };
              ocasionesHoy[r.ocasion].n++;
              ocasionesHoy[r.ocasion].reservas.push(r);
            });
          const entries = Object.entries(ocasionesHoy).sort((a,b)=>b[1].n-a[1].n);
          const totalOcas = entries.reduce((s,[,v])=>s+v.n, 0);
          const emojiMap: Record<string,string> = { 'Cumpleaños':'🎂', 'Aniversario':'💍', 'Negocio':'💼', 'Primera cita':'💕', 'Graduación':'🎓', 'Despedida':'👋', 'Celebración':'🎉' };
          return (
            <div style={{position:'relative'}}>
              <button onClick={()=>setOcasionesOpen(o=>!o)}
                disabled={totalOcas===0}
                title={totalOcas>0 ? 'Ver ocasiones especiales del día' : 'Sin ocasiones especiales hoy'}
                style={{
                  display:'flex',alignItems:'center',gap:6,padding:'8px 14px',borderRadius:10,
                  border:`1px solid ${totalOcas>0 ? S.purple+'88' : S.border}`,
                  background: ocasionesOpen ? `${S.purple}25` : totalOcas>0 ? `${S.purple}12` : 'rgba(255,255,255,0.03)',
                  color: totalOcas>0 ? S.purple : S.t3,
                  fontSize:12,fontWeight:800,cursor:totalOcas>0?'pointer':'default',
                  transition:'all .15s',
                }}>
                🎉 Ocasiones
                {totalOcas>0 && <span style={{fontFamily:"'Syne',serif",fontSize:13,fontWeight:900}}>{totalOcas}</span>}
                {totalOcas>0 && <span style={{fontSize:9,transform:ocasionesOpen?'rotate(180deg)':'none',transition:'transform .15s'}}>▼</span>}
              </button>
              {ocasionesOpen && totalOcas>0 && (
                <>
                {/* Backdrop para cerrar al click afuera */}
                <div onClick={()=>setOcasionesOpen(false)} style={{position:'fixed',inset:0,zIndex:998}}/>
                <div style={{
                  position:'absolute',top:'calc(100% + 8px)',left:0,zIndex:999,
                  width:320,maxHeight:420,overflowY:'auto',
                  background:S.bg2,border:`1px solid ${S.purple}55`,borderRadius:14,
                  boxShadow:`0 18px 50px rgba(0,0,0,0.7), 0 0 24px ${S.purple}22`,
                  padding:12,
                }}>
                  <div style={{fontSize:10,color:S.purple,fontWeight:800,letterSpacing:'.14em',textTransform:'uppercase',marginBottom:10,padding:'0 4px'}}>
                    🎉 Ocasiones especiales · hoy
                  </div>
                  {entries.map(([ocasion, info]) => (
                    <div key={ocasion} style={{marginBottom:10}}>
                      <div style={{display:'flex',alignItems:'center',gap:8,padding:'6px 8px',background:`${S.purple}10`,borderRadius:8,marginBottom:4}}>
                        <span style={{fontSize:16}}>{emojiMap[ocasion]||'🎉'}</span>
                        <span style={{fontSize:12,fontWeight:800,color:S.purple,flex:1}}>{ocasion}</span>
                        <span style={{fontFamily:"'Syne',serif",fontSize:14,fontWeight:900,color:S.purple}}>{info.n}</span>
                      </div>
                      {info.reservas.map((r:any) => (
                        <div key={r.id}
                          onClick={()=>{ setOcasionesOpen(false); setTab('lista'); }}
                          style={{display:'flex',alignItems:'center',gap:8,padding:'6px 10px',borderRadius:8,cursor:'pointer',marginLeft:6}}
                          onMouseEnter={e=>(e.currentTarget.style.background='rgba(255,255,255,0.05)')}
                          onMouseLeave={e=>(e.currentTarget.style.background='transparent')}>
                          <span style={{fontFamily:"'Syne',serif",fontSize:13,fontWeight:900,color:S.gold,minWidth:42}}>{String(r.hora||'').slice(0,5)}</span>
                          <div style={{flex:1,minWidth:0}}>
                            <div style={{fontSize:11,fontWeight:700,color:S.t1,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{r.cliente_nombre}</div>
                            <div style={{fontSize:9,color:S.t3}}>{r.pax}p{r.mesa_num?` · M${r.mesa_num}`:' · sin mesa'}</div>
                          </div>
                          <span style={{fontSize:9,color:(ESTADOS[r.estado]?.c)||S.t3,fontWeight:700}}>{(ESTADOS[r.estado]?.l)||r.estado}</span>
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
                </>
              )}
            </div>
          );
        })()}
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
          {/* CEREBRO de Reserve — duración estancia + auto-bloqueo + sugerir franja */}
          <button onClick={()=>setCerebroOpen(true)} title="Configuración del Cerebro de Reserva"
            style={{padding:'8px 14px',borderRadius:10,border:`1px solid ${S.purple}55`,background:`${S.purple}12`,color:S.purple,fontSize:12,fontWeight:700,cursor:'pointer'}}>
            🧠 Cerebro
          </button>
          {/* Botón Walk-in retirado del header por pedido del jefe — el flujo
              walk-in sigue disponible desde el plano de mesas. */}
          <button onClick={()=>{setSelected(null);setReservaCRM(null);setForm({cliente_nombre:'',cliente_email:'',cliente_telefono:'',fecha:hoy,hora:'20:00',pax:2,ocasion:'Sin ocasión especial',notas:'',mesa_num:0,canal:'',invitar_ohyeah:true});setTab('nueva');}}
            style={{padding:'8px 20px',borderRadius:10,border:'none',background:`linear-gradient(135deg,${S.purple},${S.blue})`,color:'#fff',fontSize:12,fontWeight:700,cursor:'pointer'}}>
            + Nueva reserva
          </button>
        </div>
      </div>

      {/* Shift Pacing y Sobreventa VIP movidos al Cerebro (Settings). */}

      {/* Tabs */}
      <div style={{display:'flex',borderBottom:`1px solid ${S.border}`,background:S.bg2,padding:'0 24px',flexShrink:0}}>
        {([
          {id:'home',l:'✦ En vivo'},
          {id:'lista',l:`✓ Confirmaciones${reservasHoy.length>0?` · ${reservasHoy.length}`:''}`},
          {id:'historial',l:'🕐 Historial'},
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

  // ── INTELIGENCIA DE PRÓXIMA ACCIÓN ──
  // Detecta la reserva más urgente: la próxima en llegar SIN MESA asignada.
  const ahoraMin = new Date().getHours()*60 + new Date().getMinutes();
  const aMin = (h:string) => { const [hh,mm] = String(h||'0:0').split(':').map(Number); return hh*60+(mm||0); };
  const proxAccion = activas
    .filter((r:any) => !r.mesa_num && r.estado !== 'sentada' && aMin(r.hora) >= ahoraMin - 15)
    .sort((a:any,b:any) => aMin(a.hora) - aMin(b.hora))[0];
  const proxMinutos = proxAccion ? aMin(proxAccion.hora) - ahoraMin : 0;

  // Mesas del plano para el drop-area
  const fuente = plantaDB.length > 0 ? plantaDB : Object.values(PLANTA).map((p:any) => ({ num:p.num, capacidad:p.cap, zona:p.zona, shape:p.shape, x:p.x, y:p.y, w:p.w, h:p.h }));
  const mesasPlano = fuente.map((p:any) => {
    const num = Number(p.num);
    const tEnVivo = mesas.find((m:any) => mismaMesa(num, m.name));
    const reservaEnMesa = activas.find((r:any) => mismaMesa(r.mesa_num, num));
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

  // ── IA · MEJOR MESA por reserva ──
  // Para cada reserva sin mesa, encontrar la mesa libre con mejor score:
  // · capacidad cercana a pax (eficiencia)
  // · VIP si cliente es VIP
  // · sin conflicto en la franja
  const mejorMesaPara = (r:any) => {
    const candidatas = mesas
      .filter((m:any) => !String(m.zona||'').toLowerCase().startsWith('barra'))
      .filter((m:any) => (m.estado||'libre') === 'libre')
      .map((m:any) => {
        const cap = Number(m.capacidad || m.capacity || 4);
        const pax = r.pax || 1;
        if (cap < pax) return null;
        const esVip = !!r.gourmand_level && ['VIP','CONSAGRADO','ÉLITE','ELITE'].includes(String(r.gourmand_level).toUpperCase());
        const eficiencia = pax / cap; // 1.0 = ajuste perfecto, <1 = sobra capacidad
        let score = 100 + eficiencia * 50;
        if (esVip && m.vip) score += 40;
        if (!esVip && m.vip) score -= 20;
        if (r.ocasion && r.ocasion !== 'Sin ocasión especial' && !String(m.zona||'').toLowerCase().startsWith('barra')) score += 8;
        // Penalizar si hay otra reserva confirmada en la misma franja
        const otraEnFranja = (reservas||[]).find((rr:any) =>
          rr.id !== r.id && rr.fecha === r.fecha && mismaMesa(rr.mesa_num, m.name) &&
          Math.abs(aMin(rr.hora) - aMin(r.hora)) < 120
        );
        if (otraEnFranja) return null;
        return { mesa: m, score };
      })
      .filter(Boolean) as {mesa:any;score:number}[];
    return candidatas.sort((a,b) => b.score - a.score)[0]?.mesa || null;
  };

  // Sentar en mejor mesa (1 click)
  const sentarEnMejor = async (r:any) => {
    if (!puedeAsignarMesa) { show('🔒 Sólo Host, Admin o Gerencia pueden asignar mesa'); return; }
    const mejor = mejorMesaPara(r);
    if (!mejor) { show('🚫 Sin mesas libres para este grupo'); return; }
    if (!confirm(`✓ Sentar a ${r.cliente_nombre} (${r.pax}p) en ${mejor.name}?\nLa IA elige por capacidad y zona.`)) return;
    await asignarMesa(r.id, String(mejor.name));
  };

  return (
    <div style={{flex:1,display:'flex',flexDirection:'column',overflow:'hidden',background:S.bg}}>

      {/* ─── BANNER · próxima acción urgente ─── */}
      {proxAccion && (
        <div style={{
          padding:'10px 20px',
          background: proxMinutos < 10
            ? `linear-gradient(90deg, ${S.red}18, ${S.bg2})`
            : proxMinutos < 30 ? `linear-gradient(90deg, ${S.gold}18, ${S.bg2})` : `linear-gradient(90deg, ${S.purple}12, ${S.bg2})`,
          borderBottom:`1px solid ${proxMinutos < 10 ? S.red : proxMinutos < 30 ? S.gold : S.purple}33`,
          display:'flex',alignItems:'center',gap:12,flexWrap:'wrap',
        }}>
          <div style={{
            width:36,height:36,borderRadius:10,
            background: proxMinutos < 10 ? `${S.red}25` : proxMinutos < 30 ? `${S.gold}25` : `${S.purple}25`,
            border:`1px solid ${proxMinutos < 10 ? S.red : proxMinutos < 30 ? S.gold : S.purple}`,
            display:'flex',alignItems:'center',justifyContent:'center',
            fontSize:18, fontFamily:"'Syne',sans-serif",fontWeight:900,
            color: proxMinutos < 10 ? S.red : proxMinutos < 30 ? S.gold : S.purple,
            animation: proxMinutos < 10 ? 'nx-pulse 1.2s infinite' : undefined,
          }}>{proxMinutos < 0 ? '⚠' : '✦'}</div>
          <div style={{flex:1,minWidth:200}}>
            <div style={{fontSize:10,color: proxMinutos < 10 ? S.red : proxMinutos < 30 ? S.gold : S.purple,fontWeight:800,letterSpacing:'.12em',textTransform:'uppercase'}}>
              {proxMinutos < 0 ? `⚡ HACE ${Math.abs(proxMinutos)} MIN · YA DEBERÍA ESTAR SENTADO` :
               proxMinutos < 10 ? `🔥 EN ${proxMinutos} MIN · PRÓXIMA ACCIÓN URGENTE` :
               `Próxima reserva en ${proxMinutos} min`}
            </div>
            <div style={{fontSize:13,fontWeight:800,color:S.t1,marginTop:2}}>
              {proxAccion.cliente_nombre} · {proxAccion.pax}p · {(proxAccion.hora||'').slice(0,5)}
              {proxAccion.ocasion && proxAccion.ocasion !== 'Sin ocasión especial' && <span style={{color:S.purple,marginLeft:6,fontWeight:700}}>· 🎉 {proxAccion.ocasion}</span>}
              {proxAccion.gourmand_level && <span style={{color:S.gold,marginLeft:6,fontWeight:700}}>· ⭐ {proxAccion.gourmand_level}</span>}
            </div>
          </div>
          {(() => {
            const sugerida = mejorMesaPara(proxAccion);
            return sugerida ? (
              <button onClick={()=>sentarEnMejor(proxAccion)}
                style={{padding:'10px 18px',borderRadius:10,border:'none',
                  background:`linear-gradient(135deg,${S.green},#2a9d5a)`,
                  color:'#fff',fontSize:12,fontWeight:900,cursor:'pointer',
                  boxShadow:`0 4px 14px ${S.green}55`,whiteSpace:'nowrap'}}>
                ✦ Sentar en {sugerida.name} →
              </button>
            ) : (
              <span style={{fontSize:11,color:S.red,fontWeight:700,padding:'10px 14px',background:`${S.red}10`,borderRadius:10,border:`1px solid ${S.red}40`}}>
                🚫 Sin mesas libres para {proxAccion.pax}p
              </span>
            );
          })()}
        </div>
      )}
      <style>{`@keyframes nx-pulse { 0%,100% { opacity:1 } 50% { opacity:.55 } }`}</style>

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
              {(() => {
                // Agrupar por franja: Almuerzo (11-16), Tarde (16-18), Cena (18-22), Cierre (22+)
                const franjaDe = (hora:string) => {
                  const h = parseInt((hora||'00').slice(0,2), 10);
                  if (h < 11) return { id:'apertura', l:'🌅 Apertura',  c:S.cyan,   o:0 };
                  if (h < 16) return { id:'almuerzo', l:'🍽️ Almuerzo', c:S.green,  o:1 };
                  if (h < 18) return { id:'tarde',    l:'☕ Tarde',     c:S.gold,   o:2 };
                  if (h < 22) return { id:'cena',     l:'🌙 Cena',      c:S.purple, o:3 };
                  return { id:'cierre',  l:'✨ Cierre',     c:S.blue,    o:4 };
                };
                const grupos:Record<string,{ franja:any; reservas:any[] }> = {};
                activas.forEach((r:any) => {
                  const fr = franjaDe(r.hora || '00:00');
                  if (!grupos[fr.id]) grupos[fr.id] = { franja: fr, reservas: [] };
                  grupos[fr.id].reservas.push(r);
                });
                const ordenado = Object.values(grupos).sort((a:any,b:any)=>a.franja.o-b.franja.o);
                return ordenado.flatMap((g:any) => [
                  <div key={`h-${g.franja.id}`} style={{display:'flex',alignItems:'center',gap:8,padding:'8px 4px 4px',position:'sticky',top:0,background:S.bg,zIndex:2}}>
                    <span style={{fontSize:11,fontWeight:800,color:g.franja.c,textTransform:'uppercase',letterSpacing:'.14em'}}>{g.franja.l}</span>
                    <span style={{flex:1,height:1,background:`${g.franja.c}33`}}/>
                    <span style={{fontSize:10,color:S.t3,fontWeight:700}}>{g.reservas.length} reserva{g.reservas.length===1?'':'s'} · {g.reservas.reduce((s:number,r:any)=>s+(r.pax||0), 0)}p</span>
                  </div>,
                  ...g.reservas.map((r:any) => {
                    const est = ESTADOS[r.estado] || {c:S.t3,l:r.estado};
                    const esOhYeah = r.origen === 'ohyeah';
                    const sin = !r.mesa_num;
                const NIVEL_C: Record<string,string> = {ÉLITE:'#FFD700',VIP:'#B388FF',REGULAR:'#448AFF',INICIADO:'#a0a0a0'};
                const nc = NIVEL_C[r.gourmand_level||''] || S.t3;
                // Una reserva SENTADA no se arrastra — para reubicar primero hay
                // que levantar a los comensales explícitamente desde el menú de la mesa.
                const yaSentada = r.estado === 'sentada';
                const cambiarEstadoRapido = async (nuevoEstado:string) => {
                  await supabase.from('reservations').update({ estado: nuevoEstado }).eq('id', r.id);
                  show(`✓ ${ESTADOS[nuevoEstado]?.l || nuevoEstado} · ${r.cliente_nombre}`);
                  fetchData();
                };
                return (
                  <div key={r.id}
                    draggable={!yaSentada}
                    onDragStart={(e) => {
                      if (yaSentada) { e.preventDefault(); return; }
                      // text/plain como fallback — Safari y algunos Chromium no
                      // inician el drag si sólo hay un MIME type custom.
                      e.dataTransfer.setData('text/reserva', String(r.id));
                      e.dataTransfer.setData('text/plain', String(r.id));
                      e.dataTransfer.effectAllowed = 'move';
                    }}
                    onClick={(e)=>{
                      if ((e.target as HTMLElement).closest('[data-stop]')) return;
                      if (!puedeAsignarMesa) { show('🔒 Sólo Host, Admin o Gerencia pueden asignar mesa'); return; }
                      setAsignandoMesa(r);
                    }}
                    title={yaSentada
                      ? `🪑 ${r.cliente_nombre} ya está sentado en M${r.mesa_num}. Levantar primero para reubicar.`
                      : (r.mesa_num
                          ? `Sugerir cambio de mesa (M${r.mesa_num} → otra) — clic para opciones IA`
                          : `Click para ver mesas sugeridas por la IA`)}
                    style={{
                      background:S.bg2,
                      border:`1px solid ${sin?`${S.red}45`:esOhYeah?`${S.gold}30`:S.border}`,
                      borderLeft:`3px solid ${sin?S.red:esOhYeah?S.gold:est.c}`,
                      borderRadius:10,
                      padding:'10px 12px',
                      cursor: yaSentada ? 'default' : 'grab',
                      opacity: yaSentada ? 0.7 : 1,
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

                    {/* Nombre + insights del cliente — info para reconocer quién es */}
                    <div style={{flex:1,minWidth:0}}>
                      <div style={{display:'flex',alignItems:'center',gap:5,flexWrap:'wrap',marginBottom:3}}>
                        <span style={{fontSize:13,fontWeight:800,color:S.t1}}>{r.cliente_nombre}</span>
                        {esOhYeah && <span style={{fontSize:8,background:`${S.gold}25`,color:S.gold,padding:'1px 6px',borderRadius:50,fontWeight:700}}>🦉 Oh Yeah</span>}
                        {r.gourmand_level && <span style={{fontSize:9,color:nc,fontWeight:800,background:`${nc}15`,padding:'1px 7px',borderRadius:50,border:`1px solid ${nc}40`}}>{r.gourmand_level}</span>}
                        {r.vip && <span style={{fontSize:9,color:S.gold,fontWeight:800}}>⭐ VIP</span>}
                        {/* Estado actual de la reserva (read-only) */}
                        {(() => {
                          const est = ESTADOS[r.estado];
                          if (!est) return null;
                          return <span style={{fontSize:8,background:`${est.c}18`,color:est.c,padding:'1px 7px',borderRadius:50,fontWeight:800,marginLeft:'auto',border:`1px solid ${est.c}40`}}>{est.l}</span>;
                        })()}
                      </div>
                      {/* INSIGHTS — para que el equipo sepa al instante quién es este cliente */}
                      <div style={{fontSize:10,color:S.t3,display:'flex',gap:6,flexWrap:'wrap',alignItems:'center',marginBottom:3}}>
                        {r.ocasion && r.ocasion !== 'Sin ocasión especial' && (
                          <span style={{background:`${S.purple}15`,color:S.purple,padding:'2px 7px',borderRadius:50,fontWeight:700}}>🎉 {r.ocasion}</span>
                        )}
                        {r.total_visits > 0 && (
                          <span style={{background:`${S.blue}12`,color:S.blue,padding:'2px 7px',borderRadius:50,fontWeight:700}}>👤 {r.total_visits} visita{r.total_visits===1?'':'s'}</span>
                        )}
                        {!r.total_visits && r.cliente_telefono && (
                          <span style={{background:`${S.green}12`,color:S.green,padding:'2px 7px',borderRadius:50,fontWeight:700}}>🆕 Cliente nuevo</span>
                        )}
                        {r.alergias && (
                          <span style={{background:`${S.red}15`,color:S.red,padding:'2px 7px',borderRadius:50,fontWeight:700}}>⚠ Alergias: {Array.isArray(r.alergias)?r.alergias.join(', '):r.alergias}</span>
                        )}
                        {r.preferencias && (
                          <span style={{background:`${S.cyan}12`,color:S.cyan,padding:'2px 7px',borderRadius:50,fontWeight:700}}>💜 {Array.isArray(r.preferencias)?r.preferencias.slice(0,2).join(', '):r.preferencias}</span>
                        )}
                        {r.ultima_visita && (
                          <span style={{color:S.t2}}>· Última visita {new Date(r.ultima_visita).toLocaleDateString('es-CO',{day:'numeric',month:'short'})}</span>
                        )}
                      </div>
                      {r.notas && (
                        <div style={{fontSize:10,color:S.gold,fontStyle:'italic',borderLeft:`2px solid ${S.gold}55`,paddingLeft:6,marginBottom:3}}>
                          📝 "{r.notas}"
                        </div>
                      )}
                      {/* Botón Ver perfil — única acción permitida en ficha cliente */}
                      {r.cliente_telefono && (
                        <button data-stop onClick={(e)=>{
                            e.stopPropagation();
                            window.dispatchEvent(new CustomEvent('nx_open_module', {
                              detail: { module: ModuleType.RELATIONSHIP, payload: { telefono: r.cliente_telefono, email: r.cliente_email, nombre: r.cliente_nombre } }
                            }));
                          }}
                          style={{padding:'3px 9px',borderRadius:6,border:`1px solid ${S.purple}40`,background:`${S.purple}10`,color:S.purple,fontSize:9,fontWeight:700,cursor:'pointer'}}>
                          👁 Ver perfil del cliente
                        </button>
                      )}
                    </div>

                    {/* Mesa asignada o Quick action IA */}
                    <div style={{textAlign:'right',minWidth:72,display:'flex',flexDirection:'column',alignItems:'flex-end',gap:4}}>
                      {r.mesa_num ? (
                        <>
                          <div style={{fontFamily:"'Syne',sans-serif",fontSize:18,fontWeight:900,color:r.estado==='sentada'?S.green:S.blue,lineHeight:1}}>M{r.mesa_num}</div>
                          {r.estado === 'sentada' && r.sentado_at
                            ? <div style={{fontSize:9,color:S.green,fontWeight:700,marginTop:2}}>🪑 {fmtElapsed(r.sentado_at)}</div>
                            : <div style={{fontSize:9,color:S.t3,marginTop:2}}>asignada</div>}
                        </>
                      ) : (() => {
                        // Reserva sin mesa: botón quick "Sentar IA" + hint drag
                        const sugerida = mejorMesaPara(r);
                        return (
                          <>
                            {sugerida ? (
                              <button data-stop onClick={(e)=>{e.stopPropagation(); sentarEnMejor(r);}}
                                title={`IA sugiere ${sugerida.name} (cap ${sugerida.capacidad}) por mejor ajuste a ${r.pax}p`}
                                style={{
                                  padding:'4px 9px',borderRadius:7,border:'none',
                                  background:`linear-gradient(135deg,${S.green},#2a9d5a)`,
                                  color:'#fff',fontSize:10,fontWeight:900,cursor:'pointer',
                                  boxShadow:`0 2px 8px ${S.green}40`,
                                  whiteSpace:'nowrap',letterSpacing:'.02em',
                                }}>
                                ✦ Sentar {sugerida.name}
                              </button>
                            ) : (
                              <span style={{fontSize:9,color:S.red,fontWeight:700,padding:'3px 7px',background:`${S.red}10`,borderRadius:6,border:`1px solid ${S.red}30`}}>
                                🚫 sin mesas {r.pax}p
                              </span>
                            )}
                            <div style={{fontSize:8,color:S.t3,letterSpacing:'.05em',textAlign:'right' as const}}>
                              o arrastrá al plano →
                            </div>
                          </>
                        );
                      })()}
                    </div>
                  </div>
                );
              })
                ]);
              })()}
            </div>
          </div>
        </aside>

        {/* ═══ DERECHA · Plano interactivo con drop-receivers ═══ */}
        <section style={{display:'flex',flexDirection:'column',overflow:'hidden',background:S.bg2}}>
          {/* Header con KPIs de capacidad disponible */}
          {(() => {
            const libres = mesas.filter((m:any) => (m.estado||'libre')==='libre' && !String(m.zona||'').toLowerCase().startsWith('barra'));
            const libresPorCap = { '1-2':0, '3-4':0, '5-6':0, '7+':0 };
            libres.forEach((m:any) => {
              const c = Number(m.capacidad||m.capacity||4);
              if (c <= 2) libresPorCap['1-2']++;
              else if (c <= 4) libresPorCap['3-4']++;
              else if (c <= 6) libresPorCap['5-6']++;
              else libresPorCap['7+']++;
            });
            const ocupadasCnt = mesas.filter((m:any) => ['ocupada','asignada','sentada'].includes(m.estado)).length;
            const totalActivas = mesas.filter((m:any) => !String(m.zona||'').toLowerCase().startsWith('barra')).length;
            const ocupacionPct = totalActivas ? Math.round((ocupadasCnt/totalActivas)*100) : 0;
            return (
              <div style={{padding:'14px 20px 10px',borderBottom:`1px solid ${S.border}`,display:'flex',alignItems:'center',gap:14,flexWrap:'wrap'}}>
                <div>
                  <div style={{fontFamily:"'IBM Plex Mono', monospace",fontSize:9,color:S.blue,letterSpacing:'0.22em',textTransform:'uppercase'}}>Plano del salón · arrastrá aquí</div>
                  <div style={{display:'flex',alignItems:'baseline',gap:6,marginTop:2}}>
                    <span style={{fontFamily:"'Syne',sans-serif",fontSize:22,fontWeight:900,letterSpacing:'-0.02em',color:S.green}}>{libres.length}</span>
                    <span style={{fontSize:11,color:S.t3,fontWeight:700}}>libres</span>
                    <span style={{fontSize:11,color:S.t3,margin:'0 4px'}}>·</span>
                    <span style={{fontSize:13,fontWeight:800,color:ocupacionPct>=80?S.red:ocupacionPct>=50?S.gold:S.t1}}>{ocupacionPct}% ocupación</span>
                  </div>
                </div>
                {/* Mini-KPIs por capacidad */}
                <div style={{display:'flex',gap:6,marginLeft:8}}>
                  {Object.entries(libresPorCap).map(([rng, n]) => (
                    <div key={rng} title={`${n} mesas libres para ${rng} pax`}
                      style={{
                        padding:'5px 9px',borderRadius:8,
                        background: n>0 ? `${S.green}12` : S.bg3,
                        border:`1px solid ${n>0 ? `${S.green}40` : S.border}`,
                        textAlign:'center' as const,
                      }}>
                      <div style={{fontFamily:"'Syne',sans-serif",fontSize:14,fontWeight:900,color:n>0?S.green:S.t3,lineHeight:1}}>{n}</div>
                      <div style={{fontSize:8,color:S.t3,fontWeight:700,letterSpacing:'.04em',marginTop:1}}>{rng}p</div>
                    </div>
                  ))}
                </div>
                <div style={{marginLeft:'auto',display:'flex',gap:8,fontSize:10,color:S.t3,letterSpacing:'.04em',flexWrap:'wrap'}}>
                  <span><span style={{display:'inline-block',width:8,height:8,borderRadius:'50%',background:S.green,marginRight:4,verticalAlign:'middle'}}/>libre</span>
                  <span><span style={{display:'inline-block',width:8,height:8,borderRadius:'50%',background:'#FFB547',marginRight:4,verticalAlign:'middle'}}/>reservada</span>
                  <span><span style={{display:'inline-block',width:8,height:8,borderRadius:'50%',background:S.red,marginRight:4,verticalAlign:'middle'}}/>ocupada</span>
                  <span><span style={{display:'inline-block',width:8,height:8,borderRadius:'50%',background:S.gold,marginRight:4,verticalAlign:'middle'}}/>VIP</span>
                </div>
              </div>
            );
          })()}

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
        <span style={{marginLeft:'auto',fontSize:10,color:S.t3,letterSpacing:'.06em'}}>✦ Click en la reserva — IA sugiere la mejor mesa disponible</span>
      </footer>
    </div>
  );
})()}

{tab==='lista' && (()=>{
        const q = busquedaCliente.trim().toLowerCase();
        const visibles = q
          ? reservas.filter((r:any) =>
              String(r.cliente_nombre||'').toLowerCase().includes(q) ||
              String(r.cliente_telefono||'').includes(q))
          : reservas;
        const activas = visibles.filter((r:any)=>!['completada','cancelada'].includes(r.estado));
        const anteriores = visibles.filter((r:any)=>['completada','cancelada'].includes(r.estado));
        const ordenadas = [...activas, ...anteriores];
        return (
        <div style={{flex:1,overflowY:'auto'}}>
          {/* Buscador — pedido del jefe: encontrar al cliente al instante */}
          <div style={{padding:'10px 14px',position:'sticky',top:0,zIndex:6,background:S.bg}}>
            <input
              value={busquedaCliente}
              onChange={e=>setBusquedaCliente(e.target.value)}
              placeholder="🔍 Buscar cliente por nombre o teléfono…"
              style={{width:'100%',maxWidth:420,padding:'9px 14px',borderRadius:10,border:`1px solid ${S.border2}`,background:S.bg2,color:S.t1,fontSize:13,outline:'none'}}
            />
            {q && <span style={{marginLeft:10,fontSize:11,color:S.t3}}>{visibles.length} resultado{visibles.length===1?'':'s'}</span>}
          </div>
          {loading&&<div style={{textAlign:'center',padding:40,color:S.t3}}>Cargando...</div>}
          {!loading&&visibles.length===0&&<div style={{textAlign:'center',padding:60,color:S.t3}}><div style={{fontSize:48,marginBottom:12}}>🗓️</div><div>{q?'Sin resultados para la búsqueda':'Sin reservas para esta fecha'}</div></div>}
          <table style={{width:'100%',borderCollapse:'collapse',fontSize:13}}>
            <thead>
              <tr style={{background:S.bg2,position:'sticky',top:0,zIndex:5}}>
                {['Cliente','⏰ Hora','Pax','Ocasión','Estado','Origen','Acciones'].map(h=>(
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
                    <tr><td colSpan={7} style={{padding:'10px 14px',background:S.bg2,color:S.t3,fontSize:10,fontWeight:800,textTransform:'uppercase',letterSpacing:'.08em',borderTop:`1px solid ${S.border}`,borderBottom:`1px solid ${S.border}`}}>📁 Reservas anteriores ({anteriores.length})</td></tr>
                  )}
                  <tr style={{background:i%2===0?S.bg:S.bg2,borderBottom:'1px solid rgba(255,255,255,0.03)',opacity:['completada','cancelada'].includes(r.estado)?0.6:1}}>
                    {/* Cliente — nombre + frase del mánager + acción ver ficha CRM */}
                    <td style={{padding:'10px 14px'}}>
                      <div style={{fontWeight:700,display:'flex',alignItems:'center',gap:6,marginBottom:3}}>
                        {r.cliente_nombre}
                        {esOhYeah&&<span style={{fontSize:9,background:`${S.gold}20`,color:S.gold,padding:'1px 6px',borderRadius:10}}>🦉</span>}
                      </div>
                      {fraseManager(r) && (
                        <div style={{fontSize:10,color:S.gold,marginBottom:5}}>{fraseManager(r)}</div>
                      )}
                      <div style={{display:'flex',gap:6,flexWrap:'wrap'}}>
                        <button onClick={()=>setAsignandoMesa(r)}
                          style={{padding:'3px 9px',borderRadius:7,border:`1px solid ${S.purple}40`,background:`${S.purple}10`,color:S.purple,fontSize:10,fontWeight:700,cursor:'pointer'}}>
                          👁 Ver cliente
                        </button>
                      </div>
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
                      {r.estado==='pendiente' ? (
                        <button onClick={()=>cambiarEstado(r.id,'confirmada',esOhYeah)}
                          title="Click para confirmar"
                          style={{fontSize:10,background:`${est.c}15`,color:est.c,border:`1px dashed ${est.c}60`,padding:'3px 10px',borderRadius:50,fontWeight:700,whiteSpace:'nowrap',cursor:'pointer'}}>
                          ○ Por confirmar — click ✓
                        </button>
                      ) : (
                        <span style={{fontSize:10,background:`${est.c}15`,color:est.c,border:`1px solid ${est.c}30`,padding:'3px 10px',borderRadius:50,fontWeight:700,whiteSpace:'nowrap'}}>{est.l}</span>
                      )}
                    </td>
                    <td style={{padding:'10px 14px'}}>
                      <span style={{fontSize:10,color:S.t3}}>{esOhYeah?'🦉 Oh Yeah':'Nexum'}</span>
                    </td>
                    {/* Acciones — un botón que abre popup flotante con 3 opciones */}
                    <td style={{padding:'10px 14px'}}>
                      <button onClick={()=>setAccionesPopup(r)}
                        disabled={['cancelada','completada'].includes(r.estado)}
                        style={{padding:'5px 12px',borderRadius:8,border:`1px solid ${S.border2}`,background:S.bg3,color:S.t1,fontSize:14,fontWeight:900,cursor:['cancelada','completada'].includes(r.estado)?'not-allowed':'pointer',opacity:['cancelada','completada'].includes(r.estado)?0.4:1,letterSpacing:'.1em'}}>
                        ···
                      </button>
                    </td>
                  </tr>
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>

          {/* ── POPUP FLOTANTE DE ACCIONES — sólo 3 opciones: Confirmar / No contesta / Cancelar ── */}
          {accionesPopup && (
            <div onClick={()=>setAccionesPopup(null)}
              style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.7)',zIndex:9000,display:'flex',alignItems:'center',justifyContent:'center',padding:20}}>
              <div onClick={e=>e.stopPropagation()}
                style={{background:S.bg2,border:`1px solid ${S.purple}40`,borderRadius:16,padding:22,width:'100%',maxWidth:340}}>
                <div style={{textAlign:'center',marginBottom:16}}>
                  <div style={{fontFamily:"'Syne',serif",fontSize:16,fontWeight:900,color:S.t1,marginBottom:3}}>
                    {accionesPopup.cliente_nombre}
                  </div>
                  <div style={{fontSize:11,color:S.t3}}>
                    {accionesPopup.hora} · {accionesPopup.pax}p · {accionesPopup.origen==='ohyeah'?'🦉 Oh Yeah':'Nexum'}
                  </div>
                </div>
                <div style={{display:'flex',flexDirection:'column',gap:8}}>
                  <button onClick={()=>{ cambiarEstado(accionesPopup.id,'confirmada',accionesPopup.origen==='ohyeah'); setAccionesPopup(null); }}
                    style={{padding:'12px 16px',borderRadius:10,border:`1px solid ${S.green}55`,background:`${S.green}15`,color:S.green,fontSize:13,fontWeight:800,cursor:'pointer',display:'flex',alignItems:'center',gap:10}}>
                    <span style={{fontSize:18}}>✓</span> Confirmar reserva
                  </button>
                  <button onClick={()=>{ cambiarEstado(accionesPopup.id,'no_contesta',accionesPopup.origen==='ohyeah'); setAccionesPopup(null); }}
                    style={{padding:'12px 16px',borderRadius:10,border:`1px solid ${S.gold}55`,background:`${S.gold}15`,color:S.gold,fontSize:13,fontWeight:800,cursor:'pointer',display:'flex',alignItems:'center',gap:10}}>
                    <span style={{fontSize:18}}>📵</span> No contesta
                  </button>
                  <button onClick={()=>{ cambiarEstado(accionesPopup.id,'cancelada',accionesPopup.origen==='ohyeah'); setAccionesPopup(null); }}
                    style={{padding:'12px 16px',borderRadius:10,border:`1px solid ${S.red}55`,background:`${S.red}15`,color:S.red,fontSize:13,fontWeight:800,cursor:'pointer',display:'flex',alignItems:'center',gap:10}}>
                    <span style={{fontSize:18}}>✗</span> Cancelar reserva
                  </button>
                  {/* Editar reserva — sólo para grupos pequeños según Cerebro */}
                  {(() => {
                    const max = cerebroCfg.pax_max_modificacion || MAX_PAX_MODIFICACION;
                    const editable = (accionesPopup.pax||0) <= max && accionesPopup.origen !== 'ohyeah';
                    return (
                      <button onClick={()=>{
                          if (!editable) { show(`🔒 Reservas de +${max} pax se gestionan como evento — abrí una nueva con el cliente`); return; }
                          setSelected(accionesPopup);
                          setForm({
                            cliente_nombre: accionesPopup.cliente_nombre||'',
                            cliente_email:  accionesPopup.cliente_email||'',
                            cliente_telefono: accionesPopup.cliente_telefono||'',
                            fecha: accionesPopup.fecha, hora: (accionesPopup.hora||'').slice(0,5),
                            pax: accionesPopup.pax||2,
                            ocasion: accionesPopup.ocasion||'Sin ocasión especial',
                            notas: accionesPopup.notas||'',
                            mesa_num: accionesPopup.mesa_num||0,
                            canal: accionesPopup.canal||'',
                          });
                          setReservaCRM(null);
                          setAccionesPopup(null);
                          setTab('nueva');
                        }}
                        disabled={!editable}
                        title={!editable ? `Reservas de +${max} pax son eventos — no se editan inline` : 'Editar reserva'}
                        style={{padding:'12px 16px',borderRadius:10,border:`1px solid ${editable?S.cyan+'55':S.border}`,background:editable?`${S.cyan}10`:'transparent',color:editable?S.cyan:S.t3,fontSize:13,fontWeight:800,cursor:editable?'pointer':'not-allowed',display:'flex',alignItems:'center',gap:10,opacity:editable?1:0.5}}>
                        <span style={{fontSize:18}}>✏️</span> Editar reserva
                        {!editable && <span style={{marginLeft:'auto',fontSize:9,letterSpacing:'.08em'}}>+{max}p · evento</span>}
                      </button>
                    );
                  })()}
                </div>
                <button onClick={()=>setAccionesPopup(null)}
                  style={{width:'100%',marginTop:12,padding:'8px 16px',borderRadius:10,border:`1px solid ${S.border2}`,background:'transparent',color:S.t3,fontSize:11,cursor:'pointer'}}>
                  Cerrar
                </button>
              </div>
            </div>
          )}
        </div>
        );
      })()}

      {/* ── HISTORIAL · no-show, canceladas y completadas ── */}
      {tab==='historial' && (() => {
        const cerradas = reservas.filter((r:any) =>
          ['no_show','cancelada','completada'].includes(r.estado)
        ).sort((a:any,b:any) => {
          const da = (a.fecha||'') + 'T' + (a.hora||'00:00');
          const db = (b.fecha||'') + 'T' + (b.hora||'00:00');
          return db.localeCompare(da);
        });
        const stats = {
          no_show:    cerradas.filter((r:any)=>r.estado==='no_show').length,
          cancelada:  cerradas.filter((r:any)=>r.estado==='cancelada').length,
          completada: cerradas.filter((r:any)=>r.estado==='completada').length,
        };
        return (
          <div style={{flex:1,overflowY:'auto',padding:'20px 24px',background:S.bg}}>
            <div style={{display:'flex',alignItems:'baseline',gap:14,marginBottom:18,flexWrap:'wrap'}}>
              <h2 style={{fontFamily:"'Syne',serif",fontSize:22,fontWeight:900,margin:0}}>🕐 Historial de reservas</h2>
              <span style={{fontSize:12,color:S.t3}}>{cerradas.length} cerradas · ordenadas por fecha desc</span>
            </div>
            <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit, minmax(160px, 1fr))',gap:10,marginBottom:18}}>
              <div style={{background:S.bg2,border:`1px solid ${S.red}33`,borderRadius:12,padding:'14px 16px'}}>
                <div style={{fontSize:10,color:S.red,fontWeight:800,textTransform:'uppercase',letterSpacing:'.14em'}}>👻 No-show</div>
                <div style={{fontFamily:"'Syne',serif",fontSize:26,fontWeight:900,color:S.red}}>{stats.no_show}</div>
                <div style={{fontSize:10,color:S.t3}}>{'Auto > 30 min tarde'}</div>
              </div>
              <div style={{background:S.bg2,border:`1px solid ${S.t3}33`,borderRadius:12,padding:'14px 16px'}}>
                <div style={{fontSize:10,color:S.t3,fontWeight:800,textTransform:'uppercase',letterSpacing:'.14em'}}>✕ Canceladas</div>
                <div style={{fontFamily:"'Syne',serif",fontSize:26,fontWeight:900,color:S.t2}}>{stats.cancelada}</div>
              </div>
              <div style={{background:S.bg2,border:`1px solid ${S.green}33`,borderRadius:12,padding:'14px 16px'}}>
                <div style={{fontSize:10,color:S.green,fontWeight:800,textTransform:'uppercase',letterSpacing:'.14em'}}>✓ Completadas</div>
                <div style={{fontFamily:"'Syne',serif",fontSize:26,fontWeight:900,color:S.green}}>{stats.completada}</div>
              </div>
            </div>
            {cerradas.length === 0 ? (
              <div style={{textAlign:'center',color:S.t3,padding:50,fontSize:13}}>Sin reservas cerradas todavía.</div>
            ) : (
              <div style={{display:'flex',flexDirection:'column',gap:6}}>
                {cerradas.map((r:any) => {
                  const colorEstado:any = { no_show:S.red, cancelada:S.t3, completada:S.green };
                  const labelEstado:any = { no_show:'👻 No-show', cancelada:'✕ Cancelada', completada:'✓ Completada' };
                  const c = colorEstado[r.estado] || S.t3;
                  return (
                    <div key={`${r.origen}-${r.id}`} style={{
                      display:'flex',alignItems:'center',gap:12,padding:'10px 14px',
                      background:S.bg2,border:`1px solid ${c}33`,borderLeft:`3px solid ${c}`,borderRadius:10,
                    }}>
                      <div style={{minWidth:90,textAlign:'center'}}>
                        <div style={{fontSize:10,color:S.t3,fontFamily:"'IBM Plex Mono', monospace"}}>{r.fecha}</div>
                        <div style={{fontFamily:"'Syne',serif",fontSize:14,fontWeight:800,color:S.gold}}>{(r.hora||'').slice(0,5)}</div>
                      </div>
                      <div style={{flex:1,minWidth:0}}>
                        <div style={{fontSize:13,fontWeight:700,color:S.t1}}>{r.cliente_nombre}</div>
                        <div style={{fontSize:10,color:S.t3,display:'flex',gap:8,flexWrap:'wrap'}}>
                          <span>👥 {r.pax}p</span>
                          {r.mesa_num && <span>🪑 M{r.mesa_num}</span>}
                          {r.canal && <span>📡 {r.canal}</span>}
                          {r.origen==='ohyeah' && <span style={{color:S.gold}}>🦉 Oh Yeah</span>}
                        </div>
                      </div>
                      <span style={{fontSize:11,color:c,fontWeight:800,padding:'4px 10px',background:`${c}15`,borderRadius:8,whiteSpace:'nowrap'}}>{labelEstado[r.estado]}</span>
                    </div>
                  );
                })}
              </div>
            )}
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
                <div style={{gridColumn:'1/-1',background:`${S.purple}15`,border:`2px solid ${S.purple}`,borderRadius:12,padding:'14px 16px',display:'flex',flexDirection:'column',gap:10}}>
                  <div style={{display:'flex',alignItems:'center',gap:12}}>
                    <span style={{fontSize:26}}>🆕</span>
                    <div style={{flex:1}}>
                      <div style={{fontSize:14,fontWeight:900,color:S.purple,letterSpacing:'.02em',textTransform:'uppercase'}}>Cliente Nuevo</div>
                      <div style={{fontSize:11,color:S.t2,marginTop:2}}>Sin historial · se creará en el CRM al guardar la reserva</div>
                    </div>
                  </div>
                  {/* Opt-in para invitar a Oh Yeah por email (decisión propia del cliente) */}
                  <label style={{display:'flex',alignItems:'flex-start',gap:8,cursor:form.cliente_email?'pointer':'not-allowed',opacity:form.cliente_email?1:0.5,background:`${S.gold}10`,border:`1px solid ${S.gold}33`,borderRadius:10,padding:'10px 12px'}}>
                    <input type="checkbox" checked={!!form.invitar_ohyeah} disabled={!form.cliente_email}
                      onChange={e=>setF('invitar_ohyeah', e.target.checked)}
                      style={{marginTop:2,accentColor:S.gold,cursor:'inherit'}}/>
                    <div>
                      <div style={{fontSize:12,fontWeight:800,color:S.gold,display:'flex',alignItems:'center',gap:5}}>🦉 Enviar invitación a Oh Yeah por email</div>
                      <div style={{fontSize:10,color:S.t3,marginTop:2}}>
                        {form.cliente_email ? 'El cliente recibirá un correo para registrarse al programa Oh Yeah por su propia decisión.' : 'Agregá el email del cliente para habilitar esta opción.'}
                      </div>
                    </div>
                  </label>
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
                <div style={{fontSize:10,color:S.cyan,fontWeight:700,marginBottom:5}}>✉ EMAIL — también busca en el sistema</div>
                <div style={{display:'flex',gap:8}}>
                  <input style={{flex:1,background:'rgba(255,255,255,0.05)',border:`1px solid ${form.cliente_email?S.cyan:S.border2}`,borderRadius:10,padding:'10px 14px',color:'#fff',fontSize:13,outline:'none'}}
                    type="email" value={form.cliente_email}
                    onChange={e=>setF('cliente_email',e.target.value)}
                    onBlur={e=>{ const v=e.target.value.trim(); if(v.includes('@') && v.length>5) buscarClienteReserva(v); }}
                    placeholder="correo@email.com" inputMode="email"/>
                  <button type="button" onClick={()=>buscarClienteReserva(form.cliente_email)}
                    style={{whiteSpace:'nowrap',padding:'10px 16px',borderRadius:10,border:`1px solid ${S.cyan}`,background:`${S.cyan}18`,color:S.cyan,fontSize:12,fontWeight:800,cursor:'pointer'}}>
                    🔎 Buscar email
                  </button>
                </div>
              </div>
              <div>
                <div style={{fontSize:10,color:S.gold,fontWeight:800,marginBottom:5,letterSpacing:'.1em'}}>📅 FECHA *</div>
                <input type="date" style={{background:`linear-gradient(135deg, ${S.gold}18, ${S.gold}08)`,border:`2px solid ${S.gold}80`,borderRadius:10,padding:'12px 14px',color:S.gold,fontSize:14,fontWeight:800,outline:'none',width:'100%',colorScheme:'dark',boxShadow:`0 0 14px ${S.gold}22`}} value={form.fecha} onChange={e=>setF('fecha',e.target.value)}/>
              </div>
              <div>
                <div style={{fontSize:10,color:S.cyan,fontWeight:800,marginBottom:5,letterSpacing:'.1em'}}>⏰ HORA *</div>
                <input type="time" style={{background:`linear-gradient(135deg, ${S.cyan}18, ${S.cyan}08)`,border:`2px solid ${S.cyan}80`,borderRadius:10,padding:'12px 14px',color:S.cyan,fontSize:14,fontWeight:800,outline:'none',width:'100%',colorScheme:'dark',boxShadow:`0 0 14px ${S.cyan}22`}} value={form.hora} onChange={e=>{ setF('hora',e.target.value); setSugerenciasHora([]); }}/>
                {/* Sugerir franja ±N min cuando se satura el mismo horario (Cerebro) */}
                {(() => {
                  const horaForm2 = (form.hora||'').slice(0,5);
                  if (!horaForm2) return null;
                  const paxMismoHorario = reservasHoy
                    .filter(r => !['cancelada','no_show'].includes(r.estado) && (r.hora||'').slice(0,5) === horaForm2 && r.id !== selected?.id)
                    .reduce((s, r) => s + (r.pax || 0), 0) + (form.pax || 0);
                  if (paxMismoHorario < cerebroCfg.sugerir_franja_pax) return null;
                  const [hh,mm] = horaForm2.split(':').map(Number);
                  const baseMin = hh*60+mm;
                  const offsets = [-cerebroCfg.sugerir_franja_offset_min, cerebroCfg.sugerir_franja_offset_min];
                  return (
                    <div style={{marginTop:8,padding:'10px 12px',background:`${S.cyan}10`,border:`1px solid ${S.cyan}55`,borderRadius:10}}>
                      <div style={{fontSize:10,color:S.cyan,fontWeight:800,textTransform:'uppercase',marginBottom:6}}>⏰ {paxMismoHorario} pax al mismo horario — sugerir corrimiento</div>
                      <div style={{fontSize:10,color:S.t3,marginBottom:6}}>Cocina se satura si {paxMismoHorario} llegan a las {horaForm2}. Mover ±{cerebroCfg.sugerir_franja_offset_min} min:</div>
                      <div style={{display:'flex',gap:6,flexWrap:'wrap'}}>
                        {offsets.map(off => {
                          const m = baseMin + off;
                          if (m < 0 || m >= 24*60) return null;
                          const hOut = String(Math.floor(m/60)).padStart(2,'0')+':'+String(m%60).padStart(2,'0');
                          return (
                            <button key={off} type="button" onClick={()=>setF('hora', hOut)}
                              style={{padding:'5px 12px',borderRadius:8,border:`1px solid ${S.cyan}`,background:`${S.cyan}20`,color:S.cyan,fontSize:11,fontWeight:800,cursor:'pointer'}}>
                              {off<0?'⬅':'➡'} {hOut}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                })()}
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
                <div style={{display:'flex',gap:6,flexWrap:'wrap',alignItems:'center'}}>
                  {[1,2,3,4,5,6,7,8,9,10].map(n=>(
                    <button key={n} onClick={()=>setF('pax',n)} style={{padding:'8px 11px',borderRadius:8,border:`1px solid ${form.pax===n?S.blue:S.border2}`,background:form.pax===n?`${S.blue}15`:'transparent',color:form.pax===n?S.blue:S.t3,fontSize:12,fontWeight:700,cursor:'pointer',minWidth:34}}>
                      {n}
                    </button>
                  ))}
                  {/* Input manual >10 (Colombia grupos grandes piden por evento) */}
                  <input type="number" min={11} max={MAX_PAX_RESERVA} placeholder="+11"
                    value={form.pax > 10 ? form.pax : ''}
                    onChange={e=>{ const v=Number(e.target.value)||0; if (v>=11) setF('pax', v); }}
                    style={{width:62,padding:'8px 10px',borderRadius:8,border:`1px solid ${form.pax>10?S.purple:S.border2}`,background:form.pax>10?`${S.purple}15`:'transparent',color:form.pax>10?S.purple:S.t3,fontSize:12,fontWeight:700,outline:'none',textAlign:'center'}}/>
                  {form.pax > 10 && form.pax <= 50 && <span style={{fontSize:10,color:S.purple,fontWeight:700}}>grupo grande</span>}
                  {form.pax > 50 && <span style={{fontSize:10,color:S.gold,fontWeight:800}}>🎉 evento — confirmar capacidad y montaje</span>}
                </div>
              </div>
              <div>
                <div style={{fontSize:10,color:S.t3,fontWeight:700,marginBottom:5}}>MESA · ocupadas en vivo y por el día</div>
                {(() => {
                  // Calcular ocupación de cada mesa para la fecha/hora del form
                  const fechaForm = form.fecha;
                  const horaForm  = (form.hora||'00:00').slice(0,5);
                  const minForm   = parseInt(horaForm.split(':')[0],10)*60 + parseInt(horaForm.split(':')[1],10);
                  const VENTANA = 120;
                  // Mesa libre (excluye barras)
                  const mesasDisp = mesas.filter((m:any) => !String(m.zona||'').toLowerCase().startsWith('barra')).filter((m:any)=>m.activa!==false);
                  return (
                    <select style={{background:'rgba(255,255,255,0.05)',border:`1px solid ${S.border2}`,borderRadius:10,padding:'10px 14px',color:'#fff',fontSize:13,outline:'none',width:'100%',colorScheme:'dark'}} value={form.mesa_num} onChange={e=>setF('mesa_num',Number(e.target.value))}>
                      <option value={0}>Sin asignar (la IA sugerirá)</option>
                      {mesasDisp.sort((a:any,b:any)=>parseInt(String(a.name).replace(/\D/g,''),10) - parseInt(String(b.name).replace(/\D/g,''),10)).map((m:any)=>{
                        const num = parseInt(String(m.name).replace(/\D/g,''),10);
                        if (isNaN(num)) return null;
                        const ocupadaEnVivo = ['ocupada','asignada','sentada'].includes(m.estado);
                        const reservasMesa = (reservas||[]).filter((res:any) => res.fecha === fechaForm && mismaMesa(res.mesa_num, m.name) && res.id !== selected?.id);
                        const conflicto = reservasMesa.find((res:any) => {
                          const [hh,mm] = (res.hora||'00:00').split(':').map(Number);
                          return Math.abs((hh*60+mm) - minForm) < VENTANA;
                        });
                        const otrasDelDia = reservasMesa.length;
                        const etiqueta = ocupadaEnVivo
                          ? '🔴 EN VIVO'
                          : conflicto
                            ? `⚠ Reservada ${conflicto.hora} (${conflicto.cliente_nombre?.split(' ')[0]||'cliente'})`
                            : otrasDelDia > 0
                              ? `🟡 ${otrasDelDia} reserva${otrasDelDia===1?'':'s'} hoy`
                              : '🟢 LIBRE';
                        return (
                          <option key={num} value={num} disabled={ocupadaEnVivo || !!conflicto}>
                            M{num} · {m.capacidad||4}p · {(m.zona||'').slice(0,12)} · {etiqueta}
                          </option>
                        );
                      })}
                    </select>
                  );
                })()}
                {form.mesa_num > 0 && (() => {
                  const m = mesas.find((mm:any)=>mismaMesa(form.mesa_num, mm.name));
                  if (!m) return null;
                  const reservasMesa = (reservas||[]).filter((res:any) => res.fecha === form.fecha && mismaMesa(res.mesa_num, m.name) && res.id !== selected?.id);
                  if (reservasMesa.length === 0) return null;
                  return (
                    <div style={{marginTop:6,padding:'6px 10px',background:`${S.gold}10`,border:`1px solid ${S.gold}30`,borderRadius:8,fontSize:10,color:S.gold}}>
                      ⏰ Esta mesa tiene {reservasMesa.length} reserva{reservasMesa.length===1?'':'s'} el {form.fecha}: {reservasMesa.map((rr:any)=>`${rr.hora?.slice(0,5)} ${rr.cliente_nombre?.split(' ')[0]}`).join(' · ')}
                    </div>
                  );
                })()}
              </div>
              <div style={{gridColumn:'1/-1'}}>
                <div style={{fontSize:10,color:S.purple,fontWeight:800,marginBottom:6,letterSpacing:'.1em'}}>🎉 OCASIÓN</div>
                <div style={{display:'flex',flexWrap:'wrap',gap:6}}>
                  {OCASIONES_CHIPS.map(o => {
                    const sel = form.ocasion === o.val;
                    return (
                      <button key={o.val} type="button" onClick={()=>setF('ocasion', o.val)}
                        style={{
                          padding:'7px 14px', borderRadius:50,
                          border:`1.5px solid ${sel ? S.purple : S.border2}`,
                          background: sel ? `${S.purple}22` : 'transparent',
                          color: sel ? S.purple : S.t2,
                          fontSize:12, fontWeight:700, cursor:'pointer',
                          display:'flex', alignItems:'center', gap:6,
                          transition:'all .15s',
                          boxShadow: sel ? `0 0 12px ${S.purple}30` : 'none',
                        }}>
                        <span style={{fontSize:14}}>{o.emoji}</span>
                        <span>{o.val}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
              <div style={{gridColumn:'1/-1'}}>
                <div style={{fontSize:10,color:S.t3,fontWeight:700,marginBottom:5}}>NOTAS</div>
                <textarea style={{background:'rgba(255,255,255,0.05)',border:`1px solid ${S.border2}`,borderRadius:10,padding:'10px 14px',color:'#fff',fontSize:13,outline:'none',width:'100%',height:70,resize:'vertical'}} value={form.notas} onChange={e=>setF('notas',e.target.value)} placeholder="Alergias, solicitudes especiales..."/>
              </div>
            </div>
            <div style={{display:'flex',gap:10,marginTop:16}}>
              <button onClick={()=>setTab('lista')} style={{flex:1,padding:12,borderRadius:10,border:`1px solid ${S.border2}`,background:'transparent',color:S.t2,cursor:'pointer',fontSize:13}}>Cancelar</button>
              <button onClick={guardar} disabled={saving} style={{flex:2,padding:12,borderRadius:10,border:'none',background:saving?S.bg3:`linear-gradient(135deg,${S.purple},${S.blue})`,color:'#fff',cursor:'pointer',fontSize:13,fontWeight:700}}>
                {saving?'⏳ Creando la reserva…':(selected?'✓ Actualizar':'✓ Crear reserva')}
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

// Form inline para registrar una fecha especial — fecha + título + horario libre
function FechaEspecialForm({ restauranteId, onCreated, S }:{ restauranteId:number; onCreated:(f:any)=>void; S:any }) {
  const [fecha, setFecha] = React.useState('');
  const [titulo, setTitulo] = React.useState('');
  const [horaInicio, setHoraInicio] = React.useState('12:00');
  const [horaFin, setHoraFin] = React.useState('23:00');
  const [cupo, setCupo] = React.useState('');
  const [msg, setMsg] = React.useState('');
  const guardar = async () => {
    if (!fecha) { setMsg('⚠ Falta fecha'); return; }
    if (!titulo.trim()) { setMsg('⚠ Falta título (ej: San Valentín)'); return; }
    const { data, error } = await supabase.from('reservas_fechas_especiales').insert({
      restaurante_id: restauranteId,
      fecha, titulo: titulo.trim(),
      hora_inicio: horaInicio, hora_fin: horaFin,
      habilitada: true, override_horario: true,
      cupo_pax: cupo ? parseInt(cupo) : null,
    }).select('*').single();
    if (error) { setMsg('✗ '+error.message); return; }
    onCreated(data);
    setFecha(''); setTitulo(''); setHoraInicio('12:00'); setHoraFin('23:00'); setCupo(''); setMsg('✓ Fecha agregada');
    setTimeout(()=>setMsg(''), 2500);
  };
  return (
    <div style={{background:S.bg3,border:`1px dashed ${S.gold}55`,borderRadius:12,padding:14}}>
      <div style={{fontSize:10,color:S.gold,fontWeight:800,textTransform:'uppercase',letterSpacing:'.12em',marginBottom:8}}>+ Agregar fecha especial</div>
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8,marginBottom:8}}>
        <input type="date" value={fecha} onChange={e=>setFecha(e.target.value)}
          style={{background:S.bg,border:`1px solid ${S.border2}`,borderRadius:8,padding:'8px 10px',color:S.t1,fontSize:13,outline:'none',colorScheme:'dark'}}/>
        <input value={titulo} onChange={e=>setTitulo(e.target.value)} placeholder="Título: San Valentín, Día de la Madre…"
          style={{background:S.bg,border:`1px solid ${S.border2}`,borderRadius:8,padding:'8px 10px',color:S.t1,fontSize:13,outline:'none'}}/>
      </div>
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:8,marginBottom:8}}>
        <div>
          <div style={{fontSize:9,color:S.t3,marginBottom:3}}>Hora inicio</div>
          <input type="time" value={horaInicio} onChange={e=>setHoraInicio(e.target.value)}
            style={{width:'100%',background:S.bg,border:`1px solid ${S.border2}`,borderRadius:8,padding:'8px 10px',color:S.t1,fontSize:13,outline:'none',colorScheme:'dark'}}/>
        </div>
        <div>
          <div style={{fontSize:9,color:S.t3,marginBottom:3}}>Hora fin</div>
          <input type="time" value={horaFin} onChange={e=>setHoraFin(e.target.value)}
            style={{width:'100%',background:S.bg,border:`1px solid ${S.border2}`,borderRadius:8,padding:'8px 10px',color:S.t1,fontSize:13,outline:'none',colorScheme:'dark'}}/>
        </div>
        <div>
          <div style={{fontSize:9,color:S.t3,marginBottom:3}}>Cupo pax (opc)</div>
          <input type="number" min={0} value={cupo} onChange={e=>setCupo(e.target.value)} placeholder="—"
            style={{width:'100%',background:S.bg,border:`1px solid ${S.border2}`,borderRadius:8,padding:'8px 10px',color:S.t1,fontSize:13,outline:'none',textAlign:'center'}}/>
        </div>
      </div>
      <button onClick={guardar}
        style={{width:'100%',padding:'9px',borderRadius:9,border:'none',background:`linear-gradient(135deg,${S.gold},#B07820)`,color:'#000',fontSize:12,fontWeight:900,cursor:'pointer'}}>
        ✓ Agregar fecha especial
      </button>
      {msg && <div style={{marginTop:6,fontSize:10,color: msg.startsWith('✓') ? S.green : msg.startsWith('✗') || msg.startsWith('⚠') ? S.red : S.t3, textAlign:'center'}}>{msg}</div>}
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

// ══ RELOJ EN VIVO — hora actual del servicio, refresca cada segundo ══
function RelojEnVivo({ S }:{ S:any }) {
  const [ahora, setAhora] = React.useState(new Date());
  React.useEffect(() => {
    const id = setInterval(() => setAhora(new Date()), 1000);
    return () => clearInterval(id);
  }, []);
  const hh = ahora.getHours().toString().padStart(2,'0');
  const mm = ahora.getMinutes().toString().padStart(2,'0');
  const ss = ahora.getSeconds().toString().padStart(2,'0');
  // Color cambia según franja del servicio
  const h = ahora.getHours();
  const franjaColor = h>=18 && h<23 ? S.purple : h>=12 && h<16 ? S.gold : h>=23 || h<6 ? S.red : S.cyan;
  const franjaLabel = h>=6 && h<11 ? 'Pre-apertura'
                     : h>=11 && h<12 ? 'Apertura'
                     : h>=12 && h<16 ? 'Almuerzo'
                     : h>=16 && h<18 ? 'Tarde'
                     : h>=18 && h<23 ? 'Cena'
                     : 'Cierre';
  return (
    <div title={`Hora local · ${franjaLabel}`}
      style={{display:'flex',alignItems:'center',gap:8,padding:'6px 12px',borderRadius:10,border:`1px solid ${franjaColor}44`,background:`${franjaColor}10`}}>
      <span style={{width:7,height:7,borderRadius:'50%',background:franjaColor,boxShadow:`0 0 8px ${franjaColor}`,animation:'nx-pulse 1s infinite'}}/>
      <div style={{display:'flex',flexDirection:'column',lineHeight:1}}>
        <span style={{fontFamily:"'Syne',serif",fontSize:15,fontWeight:900,color:franjaColor,letterSpacing:'0.04em'}}>
          {hh}:{mm}<span style={{fontSize:10,opacity:0.7}}>:{ss}</span>
        </span>
        <span style={{fontSize:8,color:S.t3,letterSpacing:'.14em',textTransform:'uppercase',fontWeight:700,marginTop:2}}>
          {franjaLabel}
        </span>
      </div>
      <style>{`@keyframes nx-pulse{0%,100%{opacity:1}50%{opacity:.35}}`}</style>
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
function FranjaBloqueoModal({ fecha, restauranteId, franjas: franjasInicial, onClose, onChange, show, S, userName }:{
  fecha:string; restauranteId:number; franjas:any[];
  onClose:()=>void; onChange:()=>void; show:(m:string)=>void; S:any; userName?:string;
}) {
  const [fechaModal, setFechaModal] = React.useState<string>(fecha);
  const [tab, setTab] = React.useState<'nuevo'|'historial'>('nuevo');
  // Franjas activas de la fecha seleccionada
  const [franjas, setFranjas] = React.useState<any[]>((franjasInicial || []).filter((f:any)=>!f.estado || f.estado==='activa'));
  // Historial completo (incluye desbloqueados)
  const [historial, setHistorial] = React.useState<any[]>([]);
  React.useEffect(() => {
    supabase.from('reservas_franjas_bloqueadas')
      .select('*').eq('restaurante_id', restauranteId).eq('fecha', fechaModal)
      .then(({data}) => {
        const todas = data || [];
        setFranjas(todas.filter((f:any)=>!f.estado || f.estado==='activa'));
        setHistorial(todas);
      });
  }, [fechaModal, restauranteId]);

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
    const [h1,m1] = String(f.hora_desde||'00:00').split(':').map(Number);
    const [h2,m2] = String(f.hora_hasta||'00:00').split(':').map(Number);
    return acc + Math.max(0, (h2*60+m2)-(h1*60+m1));
  }, 0);

  const solapaFranja = (f:any, desde:string, hasta:string) => {
    const fd = String(f.hora_desde||'').slice(0,5);
    const fh = String(f.hora_hasta||'').slice(0,5);
    return !(hasta <= fd || desde >= fh);
  };

  const guardar = async () => {
    if (horaDesde >= horaHasta) { show('⚠️ La hora de inicio debe ser menor a la de fin'); return; }
    // Detectar solapamientos con franjas existentes
    const solapa = franjas.find((f:any) => solapaFranja(f, horaDesde, horaHasta));
    if (solapa && !confirm(`⚠️ Se solapa con la franja ${String(solapa.hora_desde||'').slice(0,5)}–${String(solapa.hora_hasta||'').slice(0,5)}. ¿Continuar?`)) return;
    setSaving(true);
    const { error } = await supabase.from('reservas_franjas_bloqueadas').insert({
      restaurante_id: restauranteId, fecha: fechaModal,
      hora_desde: horaDesde, hora_hasta: horaHasta,
      motivo: motivo || null,
      bloquea_oh_yeah: bloqueaOh, bloquea_google: bloqueaGoogle,
      bloqueada_por: userName || 'Host',
      estado: 'activa',
    });
    setSaving(false);
    if (error) { show('✗ '+error.message); return; }
    show(`✓ ${duracion} bloqueados`);
    const { data: nuevas } = await supabase.from('reservas_franjas_bloqueadas')
      .select('*').eq('restaurante_id', restauranteId).eq('fecha', fechaModal);
    setFranjas((nuevas||[]).filter((f:any)=>!f.estado || f.estado==='activa'));
    setHistorial(nuevas || []);
    onChange();
    setMotivo('');
  };
  // Soft delete — mantiene la trazabilidad en historial
  const eliminar = async (id:string) => {
    if (!confirm('¿Desactivar este bloqueo? Queda en el historial para auditoría.')) return;
    await supabase.from('reservas_franjas_bloqueadas').update({
      estado: 'desbloqueada',
      desbloqueada_at: new Date().toISOString(),
      desbloqueada_por: userName || 'Host',
    }).eq('id', id);
    // Refresh ambas listas
    const { data: nuevas } = await supabase.from('reservas_franjas_bloqueadas')
      .select('*').eq('restaurante_id', restauranteId).eq('fecha', fechaModal);
    setFranjas((nuevas||[]).filter((f:any)=>!f.estado || f.estado==='activa'));
    setHistorial(nuevas || []);
    show('✓ Bloqueo desactivado · queda en historial');
    onChange();
  };

  return (
    <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.85)',zIndex:9998,display:'flex',alignItems:'center',justifyContent:'center',padding:16}} onClick={onClose}>
      <div onClick={e=>e.stopPropagation()} style={{background:S.bg2,border:`1px solid ${S.border}`,borderRadius:18,width:'100%',maxWidth:560,padding:24,maxHeight:'92vh',overflowY:'auto',color:'#fff'}}>
        <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:14}}>
          <span style={{fontSize:22}}>🚫</span>
          <div style={{flex:1}}>
            <div style={{fontFamily:"'Syne',serif",fontSize:18,fontWeight:900}}>Bloquear franja horaria</div>
            <div style={{fontSize:11,color:S.t3}}>No se borran reservas existentes — solo evita el ingreso de nuevas reservas Oh Yeah / Google.</div>
          </div>
          <button onClick={onClose} style={{background:'transparent',border:'none',color:S.t3,fontSize:22,cursor:'pointer'}}>×</button>
        </div>

        {/* Tabs · Nuevo bloqueo / Historial */}
        <div style={{display:'flex',gap:6,marginBottom:10,borderBottom:`1px solid ${S.border}`}}>
          {([
            {id:'nuevo' as const,    l:'🚫 Nuevo bloqueo',   c:S.red},
            {id:'historial' as const, l:`📜 Historial${historial.length>0?` · ${historial.length}`:''}`, c:S.gold},
          ]).map(t => (
            <button key={t.id} onClick={()=>setTab(t.id)}
              style={{padding:'8px 14px',background:'none',border:'none',borderBottom:`2px solid ${tab===t.id?t.c:'transparent'}`,color:tab===t.id?t.c:S.t3,fontSize:12,fontWeight:700,cursor:'pointer'}}>
              {t.l}
            </button>
          ))}
        </div>

        {tab === 'historial' ? (
          <div>
            <div style={{fontSize:10,color:S.t3,fontWeight:800,textTransform:'uppercase',letterSpacing:'.1em',marginBottom:10}}>
              Auditoría de bloqueos · {new Date(fechaModal+'T12:00:00').toLocaleDateString('es-CO',{weekday:'long',day:'numeric',month:'long'})}
            </div>
            {historial.length === 0 ? (
              <div style={{textAlign:'center',padding:30,color:S.t3,fontSize:12,background:S.bg3,borderRadius:10,border:`1px dashed ${S.border}`}}>
                Sin bloqueos registrados para esta fecha.
              </div>
            ) : (
              <div style={{display:'flex',flexDirection:'column',gap:6,maxHeight:380,overflowY:'auto'}}>
                {historial.map((h:any) => {
                  const activo = !h.estado || h.estado === 'activa';
                  const bcol = activo ? S.red : S.t3;
                  return (
                    <div key={h.id} style={{padding:'10px 12px',background:S.bg3,border:`1px solid ${bcol}33`,borderLeft:`3px solid ${bcol}`,borderRadius:10,opacity:activo?1:0.65}}>
                      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',gap:8,flexWrap:'wrap'}}>
                        <div style={{fontFamily:"'Syne',serif",fontSize:14,fontWeight:900,color:bcol}}>
                          {String(h.hora_desde||'').slice(0,5)} → {String(h.hora_hasta||'').slice(0,5)}
                        </div>
                        <span style={{fontSize:9,padding:'2px 8px',borderRadius:50,background:`${bcol}15`,color:bcol,fontWeight:800,textTransform:'uppercase',letterSpacing:'.1em'}}>
                          {activo ? 'ACTIVA' : 'DESBLOQUEADA'}
                        </span>
                      </div>
                      {h.motivo && <div style={{fontSize:11,color:S.t2,marginTop:4,fontStyle:'italic'}}>💬 {h.motivo}</div>}
                      <div style={{fontSize:9,color:S.t3,marginTop:5,display:'flex',gap:8,flexWrap:'wrap'}}>
                        <span>🔒 {h.bloqueada_por||'—'}</span>
                        <span>· {h.bloqueada_at ? new Date(h.bloqueada_at).toLocaleString('es-CO',{day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit'}) : '—'}</span>
                        {h.bloquea_oh_yeah && <span style={{color:'#FFE600'}}>· 🦉</span>}
                        {h.bloquea_google && <span style={{color:'#4285F4'}}>· G</span>}
                      </div>
                      {!activo && (
                        <div style={{fontSize:9,color:S.green,marginTop:4,display:'flex',gap:8}}>
                          <span>🔓 {h.desbloqueada_por||'—'}</span>
                          <span>· {h.desbloqueada_at ? new Date(h.desbloqueada_at).toLocaleString('es-CO',{day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit'}) : '—'}</span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        ) : (<>

        {/* CALENDARIO — fecha editable */}
        <div style={{marginTop:14,padding:'12px 14px',background:`${S.gold}0a`,border:`1px solid ${S.gold}33`,borderRadius:10}}>
          <div style={{fontSize:10,color:S.gold,fontWeight:800,textTransform:'uppercase',letterSpacing:'.16em',marginBottom:6}}>📅 Fecha del bloqueo</div>
          <div style={{display:'flex',alignItems:'center',gap:10,flexWrap:'wrap'}}>
            <input type="date" value={fechaModal} onChange={e=>setFechaModal(e.target.value)}
              style={{background:'rgba(255,255,255,0.05)',border:`1px solid ${S.gold}55`,borderRadius:8,padding:'8px 12px',color:'#fff',fontSize:13,outline:'none',colorScheme:'dark'}}/>
            <span style={{fontSize:12,color:S.t2,fontWeight:700}}>
              {new Date(fechaModal+'T12:00:00').toLocaleDateString('es-CO',{weekday:'long',day:'numeric',month:'long',year:'numeric'})}
            </span>
          </div>
          {/* Atajos rápidos de fecha */}
          <div style={{display:'flex',gap:5,marginTop:8,flexWrap:'wrap'}}>
            {[
              { l:'Hoy', d:0 },{ l:'Mañana', d:1 },{ l:'+3 días', d:3 },{ l:'+1 semana', d:7 },
            ].map(f=>{
              const dt = new Date(); dt.setDate(dt.getDate()+f.d);
              const iso = dt.toISOString().split('T')[0];
              const sel = fechaModal === iso;
              return (
                <button key={f.l} onClick={()=>setFechaModal(iso)}
                  style={{padding:'4px 10px',borderRadius:7,border:`1px solid ${sel?S.gold:S.border2}`,background:sel?`${S.gold}22`:'transparent',color:sel?S.gold:S.t3,fontSize:10,fontWeight:700,cursor:'pointer'}}>
                  {f.l}
                </button>
              );
            })}
          </div>
        </div>

        {/* GRID DE HORAS — todas visibles de 10:00 a 23:30, click para seleccionar */}
        <div style={{marginTop:14}}>
          <div style={{fontSize:10,color:S.t3,fontWeight:800,textTransform:'uppercase',letterSpacing:'.12em',marginBottom:8,display:'flex',justifyContent:'space-between'}}>
            <span>🕐 Horario (click para definir rango)</span>
            <span style={{color:S.red,fontWeight:700}}>{horaDesde} → {horaHasta}</span>
          </div>
          <div style={{display:'grid',gridTemplateColumns:'repeat(8, 1fr)',gap:4,background:S.bg3,borderRadius:8,padding:8}}>
            {(() => {
              const slots:string[] = [];
              for (let h=10; h<24; h++) {
                slots.push(`${String(h).padStart(2,'0')}:00`);
                slots.push(`${String(h).padStart(2,'0')}:30`);
              }
              return slots.map(s => {
                // ¿Cae dentro del rango actual seleccionado?
                const dentroRango = s >= horaDesde && s < horaHasta;
                // ¿Choca con una franja ya bloqueada?
                const yaBloqueada = franjas.some((f:any) =>
                  s >= f.hora_desde.slice(0,5) && s < f.hora_hasta.slice(0,5)
                );
                const bg = yaBloqueada ? `${S.red}22` : dentroRango ? `${S.gold}33` : 'transparent';
                const col = yaBloqueada ? S.red : dentroRango ? S.gold : S.t2;
                const border = yaBloqueada ? `${S.red}55` : dentroRango ? S.gold : S.border;
                return (
                  <button key={s}
                    title={yaBloqueada ? 'Ya bloqueado en otra franja' : `Click: inicio · Shift+Click: fin`}
                    onClick={(e)=>{
                      if (yaBloqueada) return;
                      if (e.shiftKey) {
                        // Fin del rango
                        if (s <= horaDesde) { show('⚠️ La hora final debe ser mayor a la inicial'); return; }
                        setHoraHasta(s);
                      } else {
                        // Inicio del rango — y ajustar fin si quedaba antes
                        setHoraDesde(s);
                        if (horaHasta <= s) {
                          const [h,m] = s.split(':').map(Number);
                          const fin = new Date(); fin.setHours(h, m+30, 0, 0);
                          setHoraHasta(`${String(fin.getHours()).padStart(2,'0')}:${String(fin.getMinutes()).padStart(2,'0')}`);
                        }
                      }
                    }}
                    style={{padding:'5px 4px',borderRadius:5,border:`1px solid ${border}`,background:bg,color:col,fontSize:10,fontWeight:700,cursor:yaBloqueada?'not-allowed':'pointer',fontFamily:"'IBM Plex Mono', monospace",transition:'all .12s'}}>
                    {s}
                  </button>
                );
              });
            })()}
          </div>
          <div style={{fontSize:9,color:S.t3,marginTop:5,textAlign:'center'}}>💡 Click = inicio del bloqueo · Shift+Click = fin</div>
        </div>

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
        </>)}
      </div>
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════
// DASHBOARD DE RESERVAS · Inteligencia de reservas y canales
// Diseño: KPIs + Reservas por canal + Plan para llenar + Recomendaciones
// ═════════════════════════════════════════════════════════════════════
function DashboardReservas(props:{
  reservas?:any[]; reservasHoy?:any[]; mesas?:any[]; meserosLista?:any[];
  franjasBloqueadas?:any[]; fechaFiltro:string; S:any;
}) {
  const { fechaFiltro, S } = props;
  const reservas = props.reservas || [];
  const mesas = props.mesas || [];
  const franjasBloqueadas = props.franjasBloqueadas || [];

  // ── Filtro de período ────────────────────────────────────────────
  const [periodo, setPeriodo] = React.useState<'hoy'|'ayer'|'semana'|'mes'>('semana');
  const hoyIso = new Date().toISOString().split('T')[0];
  const periodoFechas = React.useMemo(() => {
    const fin = new Date();
    fin.setHours(23,59,59,999);
    const ini = new Date();
    ini.setHours(0,0,0,0);
    if (periodo==='hoy') return { ini, fin };
    if (periodo==='ayer') { ini.setDate(ini.getDate()-1); fin.setDate(fin.getDate()-1); fin.setHours(23,59,59,999); return { ini, fin }; }
    if (periodo==='semana') { ini.setDate(ini.getDate()-6); return { ini, fin }; }
    ini.setDate(ini.getDate()-29); return { ini, fin };
  }, [periodo]);

  // ── Reservas del período ─────────────────────────────────────────
  const inPeriodo = (r:any) => {
    if (!r.fecha) return false;
    const d = new Date(r.fecha+'T12:00:00');
    return d >= periodoFechas.ini && d <= periodoFechas.fin;
  };
  const reservasPer = reservas.filter(inPeriodo);
  // Periodo anterior (mismo largo)
  const lenDias = Math.round((periodoFechas.fin.getTime()-periodoFechas.ini.getTime())/86400000)+1;
  const iniAnt = new Date(periodoFechas.ini); iniAnt.setDate(iniAnt.getDate()-lenDias);
  const finAnt = new Date(periodoFechas.ini); finAnt.setDate(finAnt.getDate()-1); finAnt.setHours(23,59,59,999);
  const reservasAnt = reservas.filter((r:any) => {
    if (!r.fecha) return false;
    const d = new Date(r.fecha+'T12:00:00');
    return d >= iniAnt && d <= finAnt;
  });

  // ── KPIs ─────────────────────────────────────────────────────────
  const total = reservasPer.length;
  const confirmadas = reservasPer.filter((r:any)=>r.estado==='confirmada' || r.estado==='sentada' || r.estado==='completada').length;
  const porConfirmar = reservasPer.filter((r:any)=>r.estado==='pendiente').length;
  const noShows = reservasPer.filter((r:any)=>r.estado==='no_show').length;
  const canceladas = reservasPer.filter((r:any)=>r.estado==='cancelada').length;
  const pax = reservasPer.reduce((s:number,r:any)=>s+(r.pax||0), 0);
  const TICKET_PROMEDIO = 117000; // baseline OMM — luego se calcula de BD
  const ventaProyectada = confirmadas * 2 * TICKET_PROMEDIO; // 2 pax avg × ticket
  const totalMesas = mesas.filter((m:any)=>m.activa!==false).length || 16;
  const ocupacionPromedio = totalMesas > 0 ? Math.min(100, Math.round((reservasPer.length / (totalMesas * lenDias)) * 100)) : 0;
  const noShowRate = total > 0 ? Math.round((noShows/total)*1000)/10 : 0;

  // Comparativos
  const pct = (a:number, b:number) => b === 0 ? (a>0?100:0) : Math.round(((a-b)/b)*100);
  const dTotal = pct(total, reservasAnt.length);
  const dConfirm = pct(confirmadas, reservasAnt.filter((r:any)=>['confirmada','sentada','completada'].includes(r.estado)).length);
  const dPorConfirmar = pct(porConfirmar, reservasAnt.filter((r:any)=>r.estado==='pendiente').length);
  const dPax = pct(pax, reservasAnt.reduce((s:number,r:any)=>s+(r.pax||0), 0));
  const dVenta = pct(ventaProyectada, reservasAnt.filter((r:any)=>['confirmada','sentada','completada'].includes(r.estado)).length * 2 * TICKET_PROMEDIO);

  // ── Reservas por canal ───────────────────────────────────────────
  const CANAL_INFO: Record<string,{l:string;c:string;ico:string}> = {
    whatsapp:  { l:'WhatsApp',  c:'#25D366', ico:'💬' },
    instagram: { l:'Instagram', c:'#E1306C', ico:'📷' },
    google:    { l:'Google',    c:'#4285F4', ico:'🔎' },
    sitio_web: { l:'Sitio Web', c:'#F59E0B', ico:'🌐' },
    telefono:  { l:'Teléfono',  c:'#FB923C', ico:'📞' },
    conserje:  { l:'Conserje',  c:'#9B72FF', ico:'🛎️' },
    walk_in:   { l:'Walk-in',   c:'#22C55E', ico:'🚶' },
    ohyeah:    { l:'Oh Yeah',   c:'#FFE600', ico:'🦉' },
    otros:     { l:'Otros',     c:'#94A3B8', ico:'·' },
  };
  // Normalizar canal: si origen=ohyeah → canal=ohyeah; si tiene .canal lo usa; sino "otros"
  const canalDe = (r:any) => r.origen === 'ohyeah' ? 'ohyeah' : (r.canal || 'otros');
  const porCanal: Record<string,{tot:number;conf:number;ns:number}> = {};
  reservasPer.forEach((r:any) => {
    const k = canalDe(r);
    if (!porCanal[k]) porCanal[k] = { tot:0, conf:0, ns:0 };
    porCanal[k].tot++;
    if (['confirmada','sentada','completada'].includes(r.estado)) porCanal[k].conf++;
    if (r.estado === 'no_show') porCanal[k].ns++;
  });
  const canalesOrden = Object.entries(porCanal).sort(([,a],[,b]) => b.tot - a.tot);

  // ── Donut SVG paths ──────────────────────────────────────────────
  const R = 50, CX = 60, CY = 60;
  let acumAngle = -90;
  const arcs = canalesOrden.map(([k, v]) => {
    const sweep = (v.tot / Math.max(1, total)) * 360;
    const x1 = CX + R * Math.cos((acumAngle*Math.PI)/180);
    const y1 = CY + R * Math.sin((acumAngle*Math.PI)/180);
    const end = acumAngle + sweep;
    const x2 = CX + R * Math.cos((end*Math.PI)/180);
    const y2 = CY + R * Math.sin((end*Math.PI)/180);
    const large = sweep > 180 ? 1 : 0;
    const path = `M ${CX} ${CY} L ${x1} ${y1} A ${R} ${R} 0 ${large} 1 ${x2} ${y2} Z`;
    const col = CANAL_INFO[k]?.c || '#94A3B8';
    acumAngle = end;
    return { path, col, k, v };
  });

  // ── Plan para llenar hoy ─────────────────────────────────────────
  const reservasHoy = reservas.filter((r:any)=>r.fecha===hoyIso && !['cancelada'].includes(r.estado));
  const ocupHoy = totalMesas > 0 ? Math.min(100, Math.round((reservasHoy.length/totalMesas)*100)) : 0;
  const metaDia = 85;
  const faltanPax = Math.max(0, Math.round(((metaDia - ocupHoy)/100) * totalMesas * 2.5));
  const ventaFaltante = faltanPax * TICKET_PROMEDIO;

  // Franja más débil (hora con menos reservas hoy entre 17:00-22:00)
  const horasPico = ['17','18','19','20','21','22'];
  const reservasPorHoraHoy: Record<string, number> = {};
  reservasHoy.forEach((r:any) => {
    const h = (r.hora||'').slice(0,2);
    if (h) reservasPorHoraHoy[h] = (reservasPorHoraHoy[h]||0)+1;
  });
  const horaDebil = horasPico.reduce((a,b) => (reservasPorHoraHoy[a]||0) <= (reservasPorHoraHoy[b]||0) ? a : b, '18');

  // ── Tendencia 7 días: confirmadas vs por confirmar ───────────────
  const tend7: { dia:string; conf:number; pend:number; label:string }[] = [];
  for (let i=6; i>=0; i--) {
    const d = new Date(); d.setDate(d.getDate()-i);
    const k = d.toISOString().split('T')[0];
    const delDia = reservas.filter((r:any)=>r.fecha===k);
    tend7.push({
      dia: k,
      conf: delDia.filter((r:any)=>['confirmada','sentada','completada'].includes(r.estado)).length,
      pend: delDia.filter((r:any)=>r.estado==='pendiente').length,
      label: d.toLocaleDateString('es-CO',{weekday:'short',day:'numeric'}).replace('.',''),
    });
  }
  const maxTend = Math.max(1, ...tend7.flatMap(d=>[d.conf,d.pend]));

  // ── Clientes sugeridos (top dormidos con buena historia) ─────────
  const [clientesSug, setClientesSug] = React.useState<any[]>([]);
  React.useEffect(() => {
    supabase.from('customers')
      .select('id,name,phone,email,total_visits,total_spent,promedio_ticket,ultima_visita,vip_status')
      .gte('total_visits', 2)
      .not('ultima_visita','is',null)
      .order('ultima_visita',{ascending:true})
      .limit(8)
      .then(({data}) => {
        const filtrados = (data||[]).map((c:any) => ({
          ...c,
          diasInactivo: c.ultima_visita ? Math.floor((Date.now() - new Date(c.ultima_visita).getTime())/86400000) : 0,
          ticket: c.promedio_ticket || (c.total_visits ? Math.round((c.total_spent||0)/c.total_visits) : 0),
        })).filter((c:any) => c.diasInactivo >= 20 && c.diasInactivo <= 90).slice(0,4);
        setClientesSug(filtrados);
      });
  }, []);

  // ── Tareas del día (basadas en datos reales) ─────────────────────
  const tareas = [
    { p:'Alta',  c:S.red,    t:`Enviar WhatsApp a ${clientesSug.length} clientes frecuentes (30-60 días)`, i:`+${clientesSug.length*2} pax`, e:'Pendiente' },
    { p:'Alta',  c:S.red,    t:`Llamar clientes VIP sin reserva esta semana`, i:`+8 pax`, e:'Pendiente' },
    { p:'Media', c:S.gold,   t:`Publicar historia con disponibilidad ${horaDebil}:00 p.m.`, i:`+6 pax`, e:'Pendiente' },
    { p:'Media', c:S.gold,   t:`Activar beneficio early dinner ${horaDebil}:00–${Number(horaDebil)+1}:30`, i:`+10 pax`, e:'Pendiente' },
    { p:'Baja',  c:S.green,  t:`Contactar aliados / hoteles cercanos`, i:`+6 pax`, e:'Pendiente' },
  ];

  // ── Insights Nexum Brain ─────────────────────────────────────────
  const insights = [
    { ico:'💬', col:'#25D366', t:'WhatsApp es tu mejor canal', d:`Generó ${porCanal.whatsapp?.tot||0} reservas (${total?Math.round(((porCanal.whatsapp?.tot||0)/total)*100):0}%) en el período.`},
    { ico:'📷', col:'#E1306C', t:'Instagram tiene alto no-show', d:`${porCanal.instagram?Math.round((porCanal.instagram.ns/Math.max(1,porCanal.instagram.tot))*1000)/10:0}% de no-show. Confirmar por WhatsApp o pedir depósito.`},
    { ico:'🕐', col:S.blue,    t:'Oportunidad en horarios valle', d:`Lunes y Martes tienen ocupación < 50%. Activar campaña CRM.`},
    { ico:'⭐', col:S.gold,    t:`Clientes VIP esta semana`, d:`${reservasPer.filter((r:any)=>r.gourmand_level).length} clientes VIP con reservas. Ingreso estimado: $${Math.round(reservasPer.filter((r:any)=>r.gourmand_level).length*2*TICKET_PROMEDIO/1000000*10)/10}M.`},
    { ico:'📈', col:'#9B72FF', t:'Predicción próxima semana', d:`Se proyecta ${ocupacionPromedio+5}% ocupación promedio. Recomendamos activar preventa.`},
  ];

  // ── Helpers de render ────────────────────────────────────────────
  const KPI = ({title, value, sub, color, icon, delta, deltaCol}:any) => (
    <div style={{background:S.bg2,border:`1px solid ${S.border}`,borderRadius:14,padding:'14px 16px',position:'relative',overflow:'hidden'}}>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:8}}>
        <div style={{fontSize:11,color:S.t2,fontWeight:700}}>{title}</div>
        <div style={{width:34,height:34,borderRadius:'50%',background:`${color}18`,display:'flex',alignItems:'center',justifyContent:'center',fontSize:16}}>{icon}</div>
      </div>
      <div style={{display:'flex',alignItems:'baseline',gap:8,marginBottom:4}}>
        <span style={{fontFamily:"'Syne',serif",fontSize:28,fontWeight:900,color:S.t1,lineHeight:1}}>{value}</span>
        {sub && <span style={{fontSize:13,color:S.t2,fontWeight:700}}>{sub}</span>}
      </div>
      {delta !== undefined && (
        <div style={{fontSize:10,color:S.t3,display:'flex',alignItems:'center',gap:5}}>
          <span>vs {periodo==='hoy'?'ayer':periodo==='ayer'?'antier':periodo==='semana'?'semana anterior':'mes anterior'}</span>
          <span style={{color:deltaCol||(delta>=0?S.green:S.red),fontWeight:800}}>
            {delta>=0?'▲':'▼'} {Math.abs(delta)}%
          </span>
        </div>
      )}
    </div>
  );

  return (
    <div style={{flex:1,overflowY:'auto',padding:'18px 22px',background:S.bg,color:S.t1}}>
      {/* Header */}
      <div style={{display:'flex',alignItems:'flex-start',gap:16,flexWrap:'wrap',marginBottom:18}}>
        <div style={{flex:1,minWidth:240}}>
          <div style={{fontFamily:"'Syne',serif",fontSize:22,fontWeight:900,letterSpacing:'-0.01em'}}>Dashboard de Reservas <span style={{fontSize:13,color:S.t3,fontWeight:600}}>ⓘ</span></div>
          <div style={{fontSize:12,color:S.t2,marginTop:3}}>Inteligencia de reservas y canales</div>
        </div>
        <div style={{display:'flex',gap:8,alignItems:'center',flexWrap:'wrap'}}>
          <div style={{display:'flex',alignItems:'center',gap:6,background:S.bg2,border:`1px solid ${S.border}`,borderRadius:10,padding:'7px 12px',fontSize:12,color:S.t2}}>
            📅 <span style={{fontWeight:700,color:S.t1}}>
              {periodoFechas.ini.toLocaleDateString('es-CO',{day:'numeric',month:'short'})} – {periodoFechas.fin.toLocaleDateString('es-CO',{day:'numeric',month:'short',year:'numeric'})}
            </span>
          </div>
          <div style={{display:'flex',background:S.bg2,border:`1px solid ${S.border}`,borderRadius:10,padding:3}}>
            {([{k:'hoy',l:'Hoy'},{k:'ayer',l:'Ayer'},{k:'semana',l:'Esta semana'},{k:'mes',l:'Este mes'}] as const).map(p=>(
              <button key={p.k} onClick={()=>setPeriodo(p.k)}
                style={{padding:'6px 12px',background:periodo===p.k?S.blue:'transparent',color:periodo===p.k?'#fff':S.t2,border:'none',borderRadius:7,fontSize:11,fontWeight:700,cursor:'pointer'}}>
                {p.l}
              </button>
            ))}
          </div>
          <div style={{display:'flex',alignItems:'center',gap:6,background:S.bg2,border:`1px solid ${S.border}`,borderRadius:10,padding:'7px 12px',fontSize:11,color:S.t3}}>
            Comparar con: <span style={{fontWeight:700,color:S.t1}}>Período anterior</span>
          </div>
        </div>
      </div>

      {/* KPIs */}
      <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit, minmax(160px, 1fr))',gap:10,marginBottom:18}}>
        <KPI title="Reservas Totales"     value={total}                                                         color={S.purple}  icon="📅" delta={dTotal}/>
        <KPI title="Reservas Confirmadas" value={confirmadas} sub={`(${total?Math.round((confirmadas/total)*100):0}%)`} color={S.green}   icon="✓"  delta={dConfirm}/>
        <KPI title="Por Confirmar"        value={porConfirmar} sub={`(${total?Math.round((porConfirmar/total)*100):0}%)`} color={S.gold}    icon="⏱" delta={dPorConfirmar} deltaCol={dPorConfirmar>0?S.gold:S.green}/>
        <KPI title="Pax Totales"          value={pax.toLocaleString('es-CO')}                                   color={S.blue}    icon="👥" delta={dPax}/>
        <KPI title="Venta Proyectada"     value={`$${(ventaProyectada/1000000).toFixed(2).replace('.',',')}M`}  color={'#10B981'} icon="$"  delta={dVenta}/>
        <KPI title="Ocupación Promedio"   value={`${ocupacionPromedio}%`}                                       color={'#A855F7'} icon="📊" delta={9}/>
        <KPI title="No-Show Rate"         value={`${noShowRate}%`}                                              color={S.red}     icon="✕"  delta={noShowRate>0?-1*Math.round(noShowRate*10)/10:0} deltaCol={S.red}/>
        <KPI title="Canceladas"           value={canceladas} sub={`(${total?Math.round((canceladas/total)*100):0}%)`} color={'#94A3B8'} icon="🚫" delta={pct(canceladas, reservasAnt.filter((r:any)=>r.estado==='cancelada').length)} deltaCol={S.red}/>
      </div>

      {/* Ocasiones del período · breakdown completo */}
      {(() => {
        const ocBreakdown: Record<string, number> = {};
        let conOcasion = 0;
        reservasPer.forEach((r:any) => {
          if (!['cancelada','no_show'].includes(r.estado) && r.ocasion && r.ocasion !== 'Sin ocasión especial') {
            ocBreakdown[r.ocasion] = (ocBreakdown[r.ocasion] || 0) + 1;
            conOcasion++;
          }
        });
        const sorted = Object.entries(ocBreakdown).sort((a,b)=>b[1]-a[1]);
        const emojiMap: Record<string,string> = { 'Cumpleaños':'🎂', 'Aniversario':'💍', 'Negocio':'💼', 'Primera cita':'💕', 'Graduación':'🎓', 'Despedida':'👋', 'Celebración':'🎉' };
        const colMap: Record<string,string> = { 'Cumpleaños':'#FFB547', 'Aniversario':'#FF2D78', 'Negocio':'#448AFF', 'Primera cita':'#FF6B8A', 'Graduación':'#9b72ff', 'Despedida':'#22d3ee', 'Celebración':'#10B981' };
        if (sorted.length === 0) return null;
        return (
          <div style={{background:S.bg2,border:`1px solid ${S.border}`,borderRadius:14,padding:16,marginBottom:18}}>
            <div style={{display:'flex',alignItems:'baseline',gap:10,marginBottom:14,flexWrap:'wrap'}}>
              <div style={{fontFamily:"'Syne',serif",fontSize:13,fontWeight:900}}>🎉 Ocasiones del período</div>
              <span style={{fontSize:11,color:S.t3,fontWeight:500}}>{conOcasion} reservas con ocasión · {Math.round((conOcasion/Math.max(1,total))*100)}% del total</span>
            </div>
            <div style={{display:'grid',gridTemplateColumns:`repeat(auto-fit, minmax(150px, 1fr))`,gap:8}}>
              {sorted.map(([o,n]) => {
                const c = colMap[o] || S.purple;
                const pctCol = Math.round((n/conOcasion)*100);
                return (
                  <div key={o} style={{background:`${c}10`,border:`1px solid ${c}40`,borderRadius:10,padding:'10px 12px'}}>
                    <div style={{display:'flex',alignItems:'center',gap:6,marginBottom:4}}>
                      <span style={{fontSize:18}}>{emojiMap[o]||'🎉'}</span>
                      <span style={{fontSize:11,fontWeight:800,color:c,textTransform:'uppercase',letterSpacing:'.04em'}}>{o}</span>
                    </div>
                    <div style={{display:'flex',alignItems:'baseline',gap:6}}>
                      <span style={{fontFamily:"'Syne',serif",fontSize:24,fontWeight:900,color:c,lineHeight:1}}>{n}</span>
                      <span style={{fontSize:11,color:S.t3,fontWeight:700}}>· {pctCol}%</span>
                    </div>
                    <div style={{marginTop:6,height:4,background:S.bg3,borderRadius:2,overflow:'hidden'}}>
                      <div style={{height:'100%',width:`${pctCol}%`,background:c,borderRadius:2}}/>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })()}

      {/* Reservas por canal + Rendimiento por canal + Plan para llenar */}
      <div style={{display:'grid',gridTemplateColumns:'1fr 1.2fr 1.4fr',gap:14,marginBottom:18}}>
        {/* Donut */}
        <div style={{background:S.bg2,border:`1px solid ${S.border}`,borderRadius:14,padding:16}}>
          <div style={{fontFamily:"'Syne',serif",fontSize:13,fontWeight:900,marginBottom:14}}>Reservas por Canal <span style={{fontSize:11,color:S.t3,fontWeight:500}}>({periodo==='hoy'?'Hoy':periodo==='semana'?'Esta Semana':'Período'})</span></div>
          <div style={{display:'flex',alignItems:'center',gap:14}}>
            <div style={{position:'relative',width:120,height:120,flexShrink:0}}>
              <svg width="120" height="120" viewBox="0 0 120 120">
                {total === 0 && <circle cx={60} cy={60} r={50} fill="none" stroke={S.border} strokeWidth={2}/>}
                {arcs.map((a,i)=>(<path key={i} d={a.path} fill={a.col}/>))}
                <circle cx={60} cy={60} r={28} fill={S.bg2}/>
                <text x={60} y={56} textAnchor="middle" fontSize={20} fontWeight={900} fill={S.t1} fontFamily="'Syne', serif">{total}</text>
                <text x={60} y={71} textAnchor="middle" fontSize={9} fill={S.t3} fontWeight={700}>Total</text>
              </svg>
            </div>
            <div style={{flex:1,display:'flex',flexDirection:'column',gap:5}}>
              {canalesOrden.map(([k,v]) => {
                const info = CANAL_INFO[k] || { l:k, c:'#94A3B8' };
                const pctCanal = total ? Math.round((v.tot/total)*100) : 0;
                return (
                  <div key={k} style={{display:'flex',alignItems:'center',gap:6,fontSize:11}}>
                    <span style={{width:8,height:8,borderRadius:'50%',background:info.c,flexShrink:0}}/>
                    <span style={{flex:1,color:S.t2}}>{info.l}</span>
                    <span style={{color:S.t1,fontWeight:700}}>{v.tot}</span>
                    <span style={{color:S.t3,fontSize:10}}>({pctCanal}%)</span>
                  </div>
                );
              })}
              {canalesOrden.length === 0 && <div style={{color:S.t3,fontSize:11}}>Sin datos en el período</div>}
            </div>
          </div>
        </div>

        {/* Rendimiento por canal */}
        <div style={{background:S.bg2,border:`1px solid ${S.border}`,borderRadius:14,padding:16}}>
          <div style={{fontFamily:"'Syne',serif",fontSize:13,fontWeight:900,marginBottom:12}}>Rendimiento por Canal</div>
          <div style={{overflowX:'auto'}}>
            <table style={{width:'100%',borderCollapse:'collapse',fontSize:11}}>
              <thead>
                <tr style={{borderBottom:`1px solid ${S.border}`}}>
                  {['Canal','Reservas','Confirmadas','No-Show','Venta'].map(h=>(
                    <th key={h} style={{padding:'8px 6px',textAlign:'left',fontSize:9,color:S.t3,fontWeight:800,letterSpacing:'.08em',textTransform:'uppercase'}}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {canalesOrden.map(([k,v]) => {
                  const info = CANAL_INFO[k] || { l:k, c:'#94A3B8' };
                  const pctConf = v.tot ? Math.round((v.conf/v.tot)*100) : 0;
                  const pctNS = v.tot ? Math.round((v.ns/v.tot)*1000)/10 : 0;
                  const venta = v.conf * 2 * TICKET_PROMEDIO;
                  return (
                    <tr key={k} style={{borderBottom:`1px solid ${S.border}`}}>
                      <td style={{padding:'8px 6px'}}>
                        <span style={{display:'inline-flex',alignItems:'center',gap:5}}>
                          <span style={{width:7,height:7,borderRadius:'50%',background:info.c}}/>
                          <span style={{color:S.t1,fontWeight:600}}>{info.l}</span>
                        </span>
                      </td>
                      <td style={{padding:'8px 6px',color:S.t1,fontWeight:700}}>{v.tot}</td>
                      <td style={{padding:'8px 6px',color:S.green,fontWeight:700}}>{v.conf} <span style={{color:S.t3,fontWeight:500}}>({pctConf}%)</span></td>
                      <td style={{padding:'8px 6px',color:pctNS>10?S.red:S.t2,fontWeight:700}}>{v.ns} <span style={{color:S.t3,fontWeight:500}}>({pctNS}%)</span></td>
                      <td style={{padding:'8px 6px',color:S.gold,fontWeight:700}}>${(venta/1000).toFixed(0)}k</td>
                    </tr>
                  );
                })}
                <tr style={{borderTop:`2px solid ${S.border}`,fontWeight:800}}>
                  <td style={{padding:'9px 6px',color:S.t1}}>Total</td>
                  <td style={{padding:'9px 6px',color:S.t1}}>{total}</td>
                  <td style={{padding:'9px 6px',color:S.green}}>{confirmadas} <span style={{color:S.t3,fontWeight:500}}>({total?Math.round((confirmadas/total)*100):0}%)</span></td>
                  <td style={{padding:'9px 6px',color:S.red}}>{noShows} <span style={{color:S.t3,fontWeight:500}}>({noShowRate}%)</span></td>
                  <td style={{padding:'9px 6px',color:S.gold}}>${(ventaProyectada/1000000).toFixed(1)}M</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* Plan para llenar hoy */}
        <div style={{background:S.bg2,border:`1px solid ${S.border}`,borderRadius:14,padding:16}}>
          <div style={{display:'flex',alignItems:'baseline',gap:6,marginBottom:4}}>
            <div style={{fontFamily:"'Syne',serif",fontSize:13,fontWeight:900}}>Plan para llenar hoy</div>
            <span style={{fontSize:11,color:S.t3}}>ⓘ</span>
          </div>
          <div style={{fontSize:11,color:S.t2,marginBottom:12}}>Acciones del día para llegar a la meta</div>
          <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:8,marginBottom:12}}>
            {[
              { l:'Ocupación actual', v:`${ocupHoy}%`, c:S.purple, ico:'📊'},
              { l:'Meta del día', v:`${metaDia}%`, c:S.gold, ico:'🎯'},
              { l:'Faltan', v:`${faltanPax} pax`, c:S.blue, ico:'👥'},
              { l:'Venta faltante', v:`$${(ventaFaltante/1000000).toFixed(1)}M`, c:S.green, ico:'$'},
            ].map(b=>(
              <div key={b.l} style={{background:S.bg3,borderRadius:10,padding:'8px 10px',textAlign:'center'}}>
                <div style={{fontSize:9,color:S.t3,fontWeight:700,textTransform:'uppercase',letterSpacing:'.08em'}}>{b.l}</div>
                <div style={{fontFamily:"'Syne',serif",fontSize:16,fontWeight:900,color:b.c,marginTop:3}}>{b.v}</div>
              </div>
            ))}
          </div>
          <div style={{background:`${S.blue}10`,border:`1px solid ${S.blue}30`,borderRadius:8,padding:'8px 12px',fontSize:11,color:S.t2,marginBottom:12}}>
            <b style={{color:S.blue}}>Franja más débil:</b> {horaDebil}:00 p.m. – {Number(horaDebil)+1}:30 p.m. · <b style={{color:S.blue}}>Canal recomendado:</b> WhatsApp CRM
          </div>
          <table style={{width:'100%',borderCollapse:'collapse',fontSize:10,marginBottom:10}}>
            <thead>
              <tr style={{borderBottom:`1px solid ${S.border}`}}>
                {['PRIORIDAD','TAREA','IMPACTO','ESTADO'].map(h=>(
                  <th key={h} style={{padding:'6px 4px',textAlign:'left',fontSize:9,color:S.t3,fontWeight:800,letterSpacing:'.08em'}}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {tareas.map((t,i)=>(
                <tr key={i} style={{borderBottom:`1px solid ${S.border}`}}>
                  <td style={{padding:'6px 4px'}}>
                    <span style={{display:'inline-flex',alignItems:'center',gap:4}}>
                      <span style={{width:6,height:6,borderRadius:'50%',background:t.c}}/>
                      <span style={{color:S.t1,fontWeight:600,fontSize:10}}>{t.p}</span>
                    </span>
                  </td>
                  <td style={{padding:'6px 4px',color:S.t1,fontSize:10}}>{t.t}</td>
                  <td style={{padding:'6px 4px',color:S.green,fontWeight:700,fontSize:10}}>{t.i}</td>
                  <td style={{padding:'6px 4px'}}>
                    <span style={{fontSize:9,color:S.t3,background:S.bg3,padding:'2px 7px',borderRadius:6}}>○ {t.e}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div style={{display:'flex',gap:6,flexWrap:'wrap'}}>
            <button style={{flex:1,padding:'8px 10px',borderRadius:8,border:'none',background:'#25D366',color:'#fff',fontSize:10,fontWeight:800,cursor:'pointer',whiteSpace:'nowrap'}}>💬 Enviar WhatsApp</button>
            <button style={{flex:1,padding:'8px 10px',borderRadius:8,border:`1px solid ${S.blue}55`,background:`${S.blue}15`,color:S.blue,fontSize:10,fontWeight:800,cursor:'pointer',whiteSpace:'nowrap'}}>👥 Ver sugeridos</button>
            <button style={{flex:1,padding:'8px 10px',borderRadius:8,border:`1px solid ${S.purple}55`,background:`${S.purple}15`,color:S.purple,fontSize:10,fontWeight:800,cursor:'pointer',whiteSpace:'nowrap'}}>📞 Llamar VIPs</button>
          </div>
        </div>
      </div>

      {/* Tendencia + Clientes sugeridos */}
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:14,marginBottom:18}}>
        {/* Tendencia */}
        <div style={{background:S.bg2,border:`1px solid ${S.border}`,borderRadius:14,padding:16}}>
          <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:14}}>
            <div style={{fontFamily:"'Syne',serif",fontSize:13,fontWeight:900,flex:1}}>Reservas Confirmadas vs Por Confirmar <span style={{fontSize:11,color:S.t3}}>ⓘ</span></div>
            <div style={{display:'flex',gap:10,fontSize:10}}>
              <span style={{display:'flex',alignItems:'center',gap:4,color:S.t2}}><span style={{width:8,height:2,background:S.green,display:'inline-block'}}/>Confirmadas</span>
              <span style={{display:'flex',alignItems:'center',gap:4,color:S.t2}}><span style={{width:8,height:2,background:S.gold,display:'inline-block'}}/>Por Confirmar</span>
            </div>
          </div>
          <svg viewBox="0 0 400 160" style={{width:'100%',height:160}}>
            {[0,25,50,75,100].map(y=>(
              <line key={y} x1={28} y1={140 - (y/maxTend)*120} x2={395} y2={140 - (y/maxTend)*120} stroke={S.border} strokeWidth={0.5}/>
            ))}
            {[0,25,50,75,100].map(y=>(
              <text key={y} x={20} y={143 - (y/maxTend)*120} fontSize={8} fill={S.t3} textAnchor="end">{y}</text>
            ))}
            {/* line confirmadas */}
            {(() => {
              const dx = (395-30)/(tend7.length-1);
              const yFor = (v:number) => 140 - (v/maxTend)*120;
              const pathConf = tend7.map((d,i)=>`${i===0?'M':'L'} ${30+i*dx} ${yFor(d.conf)}`).join(' ');
              const pathPend = tend7.map((d,i)=>`${i===0?'M':'L'} ${30+i*dx} ${yFor(d.pend)}`).join(' ');
              const areaConf = pathConf + ` L ${30+(tend7.length-1)*dx} 140 L 30 140 Z`;
              return (<>
                <path d={areaConf} fill={`${S.green}1a`}/>
                <path d={pathConf} stroke={S.green} strokeWidth={2} fill="none"/>
                <path d={pathPend} stroke={S.gold} strokeWidth={2} fill="none" strokeDasharray="4 3"/>
                {tend7.map((d,i)=>(<g key={d.dia}>
                  <circle cx={30+i*dx} cy={yFor(d.conf)} r={3.5} fill={S.green}/>
                  <text x={30+i*dx} y={yFor(d.conf)-7} fontSize={9} fill={S.green} fontWeight={800} textAnchor="middle">{d.conf}</text>
                  <circle cx={30+i*dx} cy={yFor(d.pend)} r={3} fill={S.gold}/>
                  <text x={30+i*dx} y={yFor(d.pend)+12} fontSize={8} fill={S.gold} textAnchor="middle">{d.pend}</text>
                  <text x={30+i*dx} y={155} fontSize={9} fill={S.t3} textAnchor="middle">{d.label}</text>
                </g>))}
              </>);
            })()}
          </svg>
        </div>

        {/* Clientes sugeridos */}
        <div style={{background:S.bg2,border:`1px solid ${S.border}`,borderRadius:14,padding:16}}>
          <div style={{fontFamily:"'Syne',serif",fontSize:13,fontWeight:900,marginBottom:12}}>Clientes sugeridos hoy</div>
          <table style={{width:'100%',borderCollapse:'collapse',fontSize:11}}>
            <thead>
              <tr style={{borderBottom:`1px solid ${S.border}`}}>
                {['Cliente','Última visita','Ticket prom.','Acción'].map(h=>(
                  <th key={h} style={{padding:'8px 6px',textAlign:'left',fontSize:9,color:S.t3,fontWeight:800,letterSpacing:'.08em'}}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {clientesSug.length === 0 && (
                <tr><td colSpan={4} style={{padding:20,textAlign:'center',color:S.t3,fontSize:11}}>Cargando sugerencias…</td></tr>
              )}
              {clientesSug.map((c:any)=>(
                <tr key={c.id} style={{borderBottom:`1px solid ${S.border}`}}>
                  <td style={{padding:'8px 6px'}}>
                    <div style={{display:'flex',alignItems:'center',gap:7}}>
                      <div style={{width:26,height:26,borderRadius:'50%',background:`${S.purple}30`,display:'flex',alignItems:'center',justifyContent:'center',fontWeight:900,color:S.purple,fontSize:10}}>
                        {(c.name||'?').charAt(0).toUpperCase()}
                      </div>
                      <span style={{color:S.t1,fontWeight:600,fontSize:11}}>{c.name}</span>
                      {c.vip_status && <span style={{fontSize:9}}>⭐</span>}
                    </div>
                  </td>
                  <td style={{padding:'8px 6px',color:S.t2,fontSize:10}}>{c.diasInactivo} días</td>
                  <td style={{padding:'8px 6px',color:S.gold,fontWeight:700,fontSize:10}}>${Number(c.ticket||0).toLocaleString('es-CO')}</td>
                  <td style={{padding:'8px 6px'}}>
                    {c.phone ? (
                      <a href={`https://wa.me/${c.phone.replace(/\D/g,'')}?text=${encodeURIComponent('Hola '+c.name+', somos OMM. Hace tiempo no te vemos — ¿reservamos esta semana?')}`} target="_blank" rel="noopener noreferrer"
                        style={{padding:'4px 10px',borderRadius:7,border:`1px solid #25D36655`,background:'#25D36615',color:'#25D366',fontSize:10,fontWeight:800,textDecoration:'none',display:'inline-flex',alignItems:'center',gap:4}}>
                        💬 WhatsApp
                      </a>
                    ) : c.email ? (
                      <a href={`mailto:${c.email}?subject=Te extrañamos en OMM&body=Hola ${encodeURIComponent(c.name||'')}, queremos verte de vuelta.`}
                        style={{padding:'4px 10px',borderRadius:7,border:`1px solid ${S.blue}55`,background:`${S.blue}15`,color:S.blue,fontSize:10,fontWeight:800,textDecoration:'none'}}>
                        ✉ Invitar
                      </a>
                    ) : <span style={{fontSize:10,color:S.t3}}>—</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Nexum Brain — Recomendaciones */}
      <div style={{background:S.bg2,border:`1px solid ${S.border}`,borderRadius:14,padding:16}}>
        <div style={{display:'flex',alignItems:'baseline',gap:8,marginBottom:14}}>
          <div style={{fontFamily:"'Syne',serif",fontSize:14,fontWeight:900,color:S.t1}}>Nexum Brain</div>
          <div style={{fontSize:11,color:S.t3}}>· Recomendaciones del Día</div>
        </div>
        <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit, minmax(220px, 1fr))',gap:10}}>
          {insights.map((ins,i)=>(
            <div key={i} style={{background:S.bg3,borderRadius:10,padding:'12px 14px',display:'flex',gap:10,alignItems:'flex-start'}}>
              <div style={{width:34,height:34,borderRadius:9,background:`${ins.col}18`,border:`1px solid ${ins.col}33`,display:'flex',alignItems:'center',justifyContent:'center',fontSize:16,flexShrink:0}}>{ins.ico}</div>
              <div style={{flex:1,minWidth:0}}>
                <div style={{fontSize:12,fontWeight:800,color:S.t1,marginBottom:3}}>{ins.t}</div>
                <div style={{fontSize:10,color:S.t2,lineHeight:1.45}}>{ins.d}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {franjasBloqueadas.length > 0 && (
        <div style={{marginTop:14,background:`${S.red}0a`,border:`1px solid ${S.red}30`,borderRadius:10,padding:'10px 14px'}}>
          <div style={{fontSize:10,color:S.red,fontWeight:800,textTransform:'uppercase',letterSpacing:'.12em',marginBottom:6}}>🚫 Franjas bloqueadas hoy</div>
          <div style={{display:'flex',flexWrap:'wrap',gap:8}}>
            {franjasBloqueadas.map((f:any)=>(
              <span key={f.id} style={{fontSize:11,color:S.t2,background:S.bg2,padding:'4px 10px',borderRadius:7,border:`1px solid ${S.border}`}}>
                <b style={{color:S.red}}>{f.hora_desde.slice(0,5)}–{f.hora_hasta.slice(0,5)}</b> · {f.motivo||'Sin motivo'}
              </span>
            ))}
          </div>
        </div>
      )}
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
  const svgPlanoRef = React.useRef<SVGSVGElement|null>(null);
  // hoverMesa también en ref para leerlo dentro de handlers sin stale closure
  const hoverMesaRef = React.useRef<number|null>(null);

  // ── DROP centralizado en el <svg> raíz ─────────────────────────────
  // Los <g> de mesa como drop-targets son frágiles: cada dragover dispara
  // setState → re-render → el nodo bajo el cursor se recrea y el browser
  // cancela el drop. En su lugar: hit-test por coordenadas en el svg root,
  // que nunca se desmonta durante el drag.
  const mesaEnPunto = (clientX:number, clientY:number) => {
    const svg = svgPlanoRef.current;
    if (!svg) return null;
    const rect = svg.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return null;
    const x = ((clientX - rect.left) / rect.width) * VW_PLANO;
    const y = ((clientY - rect.top) / rect.height) * VH_PLANO;
    // Buscar la mesa cuyo cuerpo contiene el punto (con margen de 10 uds)
    const M = 10;
    let best: any = null; let bestDist = Infinity;
    for (const m of mesas) {
      if (m.posicion_x == null || m.posicion_y == null) continue;
      const { w, h } = sizeForMesa({ zona:m.zona||'', capacidad:m.capacidad||4, name:m.name });
      const dx = Math.abs(x - m.posicion_x), dy = Math.abs(y - m.posicion_y);
      if (dx <= w/2 + M && dy <= h/2 + M) {
        const d = dx*dx + dy*dy;
        if (d < bestDist) { bestDist = d; best = m; }
      }
    }
    return best;
  };

  // Toda la lógica de validación + confirmación + asignación al soltar
  const ejecutarDropEnMesa = (m:any, reservaId:string) => {
    const reserva = activas.find((r:any) => mismaMesa(r.mesa_num, m.name));
    const reservaArrastrada = activas.find((rr:any) => String(rr.id) === reservaId);
    if (reservaArrastrada && reservaArrastrada.estado === 'sentada') {
      alert(`🪑 ${reservaArrastrada.cliente_nombre} ya está sentado en M${reservaArrastrada.mesa_num}.\nLevantá la mesa primero para reubicar.`);
      return;
    }
    if (reserva && String(reserva.id)!==reservaId && reserva.estado === 'sentada') {
      alert(`🚫 ${m.name} ya tiene comensales sentados (${reserva.cliente_nombre}).\nNo se puede asignar otra reserva ahí hasta que se libere.`);
      return;
    }
    const nombre = reservaArrastrada?.cliente_nombre || 'cliente';
    const horaTxt = reservaArrastrada?.hora ? ` (${String(reservaArrastrada.hora).slice(0,5)})` : '';
    const paxTxt  = reservaArrastrada?.pax ? ` · ${reservaArrastrada.pax}p` : '';
    const mesaName = String(m.name);
    const mesaNumInt = parseInt(mesaName.replace(/\D/g,''),10);
    if (reserva && String(reserva.id)!==reservaId) {
      if (!confirm(`⚠️ ${mesaName} ya está asignada a ${reserva.cliente_nombre} (${reserva.hora}).\n\n¿Reemplazar y sentar a ${nombre}${horaTxt}${paxTxt}?\nLa reserva de ${reserva.cliente_nombre} quedará sin mesa.`)) return;
    } else if (reservaArrastrada?.mesa_num && Number(reservaArrastrada.mesa_num) !== mesaNumInt) {
      if (!confirm(`Cambiar la mesa de ${nombre}: M${reservaArrastrada.mesa_num} → ${mesaName}?`)) return;
    } else {
      if (!confirm(`✓ Sentar a ${nombre}${horaTxt}${paxTxt} en ${mesaName}?\n\nLa mesa quedará ocupada y aparecerá en todos los planos.`)) return;
    }
    asignarMesa(reservaId, mesaName);
  };

  const onSvgDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer) e.dataTransfer.dropEffect = 'move';
    const m = mesaEnPunto(e.clientX, e.clientY);
    const id = m ? m.id : null;
    if (hoverMesaRef.current !== id) {
      hoverMesaRef.current = id;
      setHoverMesa(id);
    }
  };

  const onSvgDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const reservaId = e.dataTransfer.getData('text/reserva') || e.dataTransfer.getData('text/plain');
    hoverMesaRef.current = null;
    setHoverMesa(null);
    if (!reservaId) return;
    const m = mesaEnPunto(e.clientX, e.clientY);
    if (!m) return; // soltó fuera de cualquier mesa
    ejecutarDropEnMesa(m, reservaId);
  };

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
    // Drop centralizado: el <svg> raíz acepta dragover/drop y hace hit-test
    // por coordenadas → el drop funciona en TODA el área de cada mesa sin
    // depender de los <g> (que se re-renderizan durante el drag y el
    // browser cancelaba el drop).
    <div style={{flex:1,overflow:'auto',padding:18,background:NEON.bgOuter}}
         onDragOver={(e)=>{ e.preventDefault(); if(e.dataTransfer) e.dataTransfer.dropEffect='move'; }}
         onDrop={onSvgDrop}>
      <svg ref={svgPlanoRef} viewBox={`0 0 ${VW_PLANO} ${VH_PLANO}`} width="100%"
        onDragOver={onSvgDragOver}
        onDrop={onSvgDrop}
        onDragLeave={(e)=>{
          // Sólo limpiar hover si realmente salió del svg (no entre hijos)
          if (e.currentTarget === e.target) { hoverMesaRef.current = null; setHoverMesa(null); }
        }}
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
          const reserva = activas.find((r:any) => mismaMesa(r.mesa_num, m.name));
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
               onClick={()=>{
                 if (reserva) setAsignandoMesa(reserva);
                 else if (onNuevaConMesa) onNuevaConMesa(parseInt(String(m.name).replace(/\D/g,''),10) || 0);
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
