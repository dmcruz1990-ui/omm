import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { supabase } from '../lib/supabase.ts';
import { useAuth } from '../contexts/AuthContext';
import { useRestaurant } from '../contexts/RestaurantContext';

// ═══════════════════════════════════════════════════════════════════════
// PLANO SALA v4 — Multi-restaurante. Lee del RestaurantContext y carga
// las zonas/mesas del restaurante activo. Drag&drop reservas, POS, etc.
// ═══════════════════════════════════════════════════════════════════════

const POS_STATE_KEY = 'nexum_pos_state_v1';
const VW = 1280, VH = 920;

type ZonaArea = { area:{x:number;y:number;w:number;h:number}; fill:string; stroke:string; chipBg:string; label:string; };

// ── Mapas de zonas por restaurante ──────────────────────────────
const ZONAS_OMM: Record<string, ZonaArea> = {
  'Eterno':       { area:{x:30,  y:90,  w:470, h:430}, fill:'#FFF4D6', stroke:'#E5B23B', chipBg:'#E5B23B', label:'ETERNO' },
  'Mantra':       { area:{x:530, y:170, w:610, h:680}, fill:'#FCD9D9', stroke:'#D14545', chipBg:'#D14545', label:'MANTRA' },
  'Amatista':     { area:{x:240, y:540, w:280, h:340}, fill:'#D2D9F0', stroke:'#3F4F9E', chipBg:'#3F4F9E', label:'AMATISTA' },
  'Barra Eterno': { area:{x:35,  y:95,  w:80,  h:280}, fill:'rgba(255,210,90,0.30)', stroke:'#C99629', chipBg:'#C99629', label:'BE' },
  'Barra Sushi':  { area:{x:540, y:200, w:430, h:60},  fill:'#3A3A3A', stroke:'#222',    chipBg:'#1a1a1a', label:'BARRA SUSHI' },
  'Barra Torre':  { area:{x:980, y:480, w:60,  h:280}, fill:'rgba(209,69,69,0.30)', stroke:'#8B2E2E', chipBg:'#8B2E2E', label:'BT' },
};
const ZONAS_GALLO: Record<string, ZonaArea> = {
  'Salón Principal': { area:{x:30,  y:90,  w:730, h:560}, fill:'#FFE4D6', stroke:'#C13B3B', chipBg:'#C13B3B', label:'SALÓN PRINCIPAL' },
  'Terraza':         { area:{x:790, y:90,  w:380, h:380}, fill:'#D5EBD5', stroke:'#4A8C4A', chipBg:'#4A8C4A', label:'TERRAZA' },
  'VIP':             { area:{x:790, y:500, w:380, h:240}, fill:'#F4D7F2', stroke:'#9B4699', chipBg:'#9B4699', label:'VIP' },
  'Barra Gallo':     { area:{x:130, y:730, w:440, h:80},  fill:'rgba(193,59,59,0.30)', stroke:'#8B2E2E', chipBg:'#8B2E2E', label:'BARRA' },
};
const ZONAS_POR_RESTAURANTE: Record<number, { zonas: Record<string,ZonaArea>; orden: string[] }> = {
  6: { zonas: ZONAS_OMM, orden: ['Eterno','Mantra','Amatista','Barra Eterno','Barra Sushi','Barra Torre'] },
  23:{ zonas: ZONAS_GALLO, orden: ['Salón Principal','Terraza','VIP','Barra Gallo'] },
};

const ST = {
  libre:     { bg:'#FFFFFF', border:'#22C55E', text:'#15803D', chip:'#22C55E', label:'LIBRE' },
  ocupada:   { bg:'#FEE2E2', border:'#DC2626', text:'#7F1D1D', chip:'#EF4444', label:'OCUPADA' },
  reservada: { bg:'#FEF3C7', border:'#D97706', text:'#78350F', chip:'#F59E0B', label:'RESERVADA' },
  bloqueada: { bg:'#E5E7EB', border:'#6B7280', text:'#374151', chip:'#9CA3AF', label:'BLOQUEADA' },
};

interface MesaRow {
  id:number; name:string; capacidad:number; zona:string; estado:string;
  shape:'round'|'rect'|'square';
  posicion_x:number; posicion_y:number;
  mesero_nombre?:string; cliente_nombre?:string; pax_actual?:number;
  abierta_en?:string; vip?:boolean; order_id_activo?:string;
}
interface ReservaRow {
  id:number|string; origen:'nexum'|'ohyeah';
  cliente_nombre:string; cliente_telefono?:string; cliente_email?:string;
  hora:string; pax:number; estado:string; mesa_num?:string|number|null;
  ocasion?:string; notas?:string; gourmand_level?:string;
  vip?:boolean; visit_count?:number;
}

const sizeFor = (m: MesaRow) => {
  if (m.zona.startsWith('Barra')) return { w:38, h:38 };
  if (m.name === 'M5') return { w:120, h:200 };
  if (m.capacidad >= 6) return { w:84, h:84 };
  if (m.capacidad >= 4) return { w:72, h:72 };
  if (m.capacidad >= 3) return { w:62, h:62 };
  return { w:54, h:54 };
};
const minutesSince = (iso?:string|null) => iso ? Math.max(0, Math.floor((Date.now()-new Date(iso).getTime())/60000)) : 0;
const fmtElapsed = (min:number) => min<60 ? `${min}m` : `${Math.floor(min/60)}h ${min%60}m`;
const initials = (n?:string) => (n||'').split(' ').slice(0,2).map(s=>s[0]).join('').toUpperCase() || '·';
const VIP_LEVELS = ['VIP','CONSAGRADO','ÉLITE','ELITE','GRAND GOURMAND','LA CREME'];

type FilterKey = 'todas'|'libres'|'ocupadas'|'reservadas'|'criticas'|'mias';
type SideTab = 'reservas'|'meseros'|'alertas';

interface Props { onOpenPOS?: () => void; }

export default function PlanoOMM({ onOpenPOS }: Props) {
  const { profile } = useAuth();
  const { activeId: restauranteId, activeRestaurant } = useRestaurant();
  const miNombre = profile?.nombre_completo || profile?.full_name || '';
  const esMesero = profile?.role === 'mesero';
  const esMaitre = ['maitre','admin','gerencia','desarrollo'].includes(profile?.role||'');

  // Zonas del restaurante activo
  const cfgRest = ZONAS_POR_RESTAURANTE[restauranteId] || ZONAS_POR_RESTAURANTE[6];
  const ZONAS = cfgRest.zonas;
  const ZONAS_ORDEN = cfgRest.orden;
  const ZONAS_VISIBLES = ZONAS_ORDEN;
  type ZonaKey = string;

  const [mesas, setMesas]       = useState<MesaRow[]>([]);
  const [reservas, setReservas] = useState<ReservaRow[]>([]);
  const [meseros, setMeseros]   = useState<{id:string;nombre:string;role:string}[]>([]);
  const [loading, setLoad]      = useState(true);
  const [sel, setSel]           = useState<MesaRow|null>(null);
  const [hover, setHover]       = useState<MesaRow|null>(null);
  const [mouse, setMouse]       = useState({x:0, y:0});
  const [filter, setFilter]     = useState<FilterKey>('todas');
  const [zonaFiltro, setZonaFiltro] = useState<ZonaKey|null>(null);
  const [sideTab, setSideTab]   = useState<SideTab>('reservas');
  const [draggingRes, setDraggingRes] = useState<ReservaRow|null>(null);
  const [hoverMesa, setHoverMesa] = useState<number|null>(null);
  const [confirmar, setConfirmar] = useState<{ reserva:ReservaRow; mesa:MesaRow }|null>(null);
  const [meseroAsignar, setMeseroAsignar] = useState<string>('');
  const [walkin, setWalkin]     = useState<MesaRow|null>(null);
  const [tick, setTick]         = useState(0);
  const [flashIds, setFlashIds] = useState<Set<number>>(new Set());
  const [toast, setToast]       = useState('');
  const svgRef = useRef<SVGSVGElement>(null);

  const showToast = (m:string) => { setToast(m); setTimeout(()=>setToast(''), 3000); };

  // ── Cargar datos ──────────────────────────────────────────────
  const fetchAll = useCallback(async () => {
    const hoy = new Date().toISOString().split('T')[0];
    const [tb, rs, oy, ms] = await Promise.all([
      supabase.from('tables')
        .select('id,name,capacidad,zona,estado,shape,posicion_x,posicion_y,mesero_nombre,cliente_nombre,pax_actual,abierta_en,vip,order_id_activo,restaurante_id')
        .eq('restaurante_id', restauranteId).eq('activa', true).order('name'),
      supabase.from('reservations').select('*').eq('restaurante_id',restauranteId).eq('fecha',hoy)
        .in('estado',['pendiente','confirmada','sentada']).order('hora'),
      supabase.from('ohyeah_reservas').select('*').eq('date',hoy)
        .in('status',['pending','pendiente','confirmed','confirmada','seated','sentada']).order('time'),
      supabase.from('profiles').select('id,nombre_completo,full_name,role,activo,restaurante_id').eq('role','mesero').eq('activo',true).eq('restaurante_id', restauranteId),
    ]);
    setMesas((tb.data||[]) as MesaRow[]);
    const allRes: ReservaRow[] = [
      ...(rs.data||[]).map((r:any)=>({
        id:r.id, origen:'nexum' as const,
        cliente_nombre:r.cliente_nombre, cliente_telefono:r.cliente_telefono, cliente_email:r.cliente_email,
        hora:r.hora, pax:r.pax, estado:r.estado, mesa_num:r.mesa_num,
        ocasion:r.ocasion, notas:r.notas, gourmand_level:r.gourmand_level,
        vip: VIP_LEVELS.includes(String(r.gourmand_level||'').toUpperCase()),
      })),
      ...(oy.data||[]).map((r:any)=>({
        id:r.id, origen:'ohyeah' as const,
        cliente_nombre:r.guest_name, cliente_telefono:r.guest_phone, cliente_email:r.guest_email,
        hora:r.time, pax:r.pax,
        estado: ['confirmed','confirmada'].includes(r.status) ? 'confirmada'
              : ['seated','sentada'].includes(r.status) ? 'sentada'
              : 'pendiente',
        mesa_num:r.mesa_num,
        ocasion:r.occasion, notas:r.observations,
        gourmand_level:r.gourmand_level, visit_count:r.visit_count,
        vip: VIP_LEVELS.includes(String(r.gourmand_level||'').toUpperCase()),
      })),
    ].sort((a,b)=>a.hora.localeCompare(b.hora));
    setReservas(allRes);
    setMeseros((ms.data||[])
      .map((m:any)=>({ id:m.id, nombre:m.nombre_completo||m.full_name||'', role:m.role }))
      .filter(m=>m.nombre));
    setLoad(false);
  }, [restauranteId]);

  useEffect(() => { setLoad(true); fetchAll(); }, [fetchAll]);

  // ── Realtime ──────────────────────────────────────────────────
  useEffect(() => {
    const ch = supabase.channel('plano-omm-v3')
      .on('postgres_changes', { event:'*', schema:'public', table:'tables' }, (p:any) => {
        const id = p?.new?.id ?? p?.old?.id;
        if (id) {
          setFlashIds(s => new Set(s).add(id));
          setTimeout(()=>setFlashIds(s=>{ const n=new Set(s); n.delete(id); return n; }), 1200);
        }
        fetchAll();
      })
      .on('postgres_changes', { event:'*', schema:'public', table:'reservations' }, () => fetchAll())
      .on('postgres_changes', { event:'*', schema:'public', table:'ohyeah_reservas' }, () => fetchAll())
      .subscribe();
    const t = setInterval(()=>setTick(x=>x+1), 30000);
    return ()=>{ supabase.removeChannel(ch); clearInterval(t); };
  }, [fetchAll]);

  // ── Mesas aptas para la reserva arrastrada ───────────────────
  const aptaParaReserva = (m: MesaRow, r: ReservaRow) => {
    if ((m.estado||'libre').toLowerCase() !== 'libre') return false;
    if (m.zona.startsWith('Barra')) return r.pax === 1;
    const maxComb = m.name === 'A11' || m.name === 'A12' || m.name === 'M7' || m.name === 'M8' ? 10 : m.capacidad;
    return r.pax >= 1 && r.pax <= maxComb;
  };

  // ── Filtrado y vista por rol ──────────────────────────────────
  const visibles = useMemo(() => mesas.filter(m => {
    if (zonaFiltro) {
      // Las barras se agrupan con su zona principal (Barra Eterno con Eterno, etc.)
      const matches = m.zona === zonaFiltro
        || (zonaFiltro==='Eterno' && m.zona==='Barra Eterno')
        || (zonaFiltro==='Mantra' && (m.zona==='Barra Sushi'||m.zona==='Barra Torre'))
        || (zonaFiltro==='Salón Principal' && m.zona==='Barra Gallo');
      if (!matches) return false;
    }
    const e = (m.estado||'libre').toLowerCase();
    if (filter==='libres' && e!=='libre') return false;
    if (filter==='ocupadas' && !['ocupada','open'].includes(e)) return false;
    if (filter==='reservadas' && !['reservada','pendiente'].includes(e)) return false;
    if (filter==='criticas') {
      if (!['ocupada','open'].includes(e) || minutesSince(m.abierta_en) < 90) return false;
    }
    if (filter==='mias' && (m.mesero_nombre||'').toLowerCase() !== miNombre.toLowerCase()) return false;
    return true;
  }), [mesas, filter, zonaFiltro, miNombre]);

  // ── KPIs ──────────────────────────────────────────────────────
  const kpi = useMemo(() => {
    const ocupadas = mesas.filter(m => ['ocupada','open'].includes((m.estado||'').toLowerCase()));
    const reservadasZ = mesas.filter(m => ['reservada','pendiente'].includes((m.estado||'').toLowerCase()));
    const libres = mesas.filter(m => (m.estado||'libre').toLowerCase()==='libre');
    const pct = mesas.length ? Math.round((ocupadas.length/mesas.length)*100) : 0;
    const criticas = ocupadas.filter(m => minutesSince(m.abierta_en) >= 90).length;
    const totalCap = mesas.reduce((a,m)=>a+(m.capacidad||0),0);
    const mias = mesas.filter(m => (m.mesero_nombre||'').toLowerCase() === miNombre.toLowerCase()).length;
    return { ocupadas:ocupadas.length, reservadas:reservadasZ.length, libres:libres.length, pct, criticas, totalCap, mias };
  }, [mesas, tick, miNombre]);

  const reservasPendientes = reservas.filter(r => r.estado !== 'sentada');

  // ── Mesas que pertenecen a otros meseros (para dim) ──────────
  const otraMesa = (m:MesaRow) => esMesero && m.mesero_nombre && m.mesero_nombre.toLowerCase() !== miNombre.toLowerCase();

  // ════════════════════════════════════════════════════════════
  // SENTAR — operación central que conecta plano + POS + reservas
  // ════════════════════════════════════════════════════════════
  const sentarEnMesa = async (params:{
    mesa: MesaRow;
    cliente_nombre: string;
    cliente_telefono?: string;
    cliente_email?: string;
    pax: number;
    mesero: string;
    reservaId?: number|string;
    reservaOrigen?: 'nexum'|'ohyeah';
    gourmand_level?: string;
    notas?: string;
    redirigir: boolean;
  }) => {
    const { mesa, cliente_nombre, cliente_telefono, cliente_email, pax, mesero, reservaId, reservaOrigen, gourmand_level, notas, redirigir } = params;
    const nowIso = new Date().toISOString();
    const esVip = VIP_LEVELS.includes(String(gourmand_level||'').toUpperCase());

    // 1) Update mesa
    await supabase.from('tables').update({
      estado:'ocupada', status:'open',
      abierta_en: nowIso,
      cliente_nombre,
      cliente_telefono: cliente_telefono||null,
      cliente_email: cliente_email||null,
      mesero_nombre: mesero,
      pax_actual: pax,
      vip: esVip,
    }).eq('id', mesa.id);

    // 2) Update reserva si viene de una
    if (reservaId && reservaOrigen) {
      if (reservaOrigen === 'ohyeah') {
        await supabase.from('ohyeah_reservas').update({
          status:'seated', mesa_num: mesa.name, mesa_asignada_at: nowIso
        }).eq('id', reservaId);
      } else {
        await supabase.from('reservations').update({
          estado:'sentada', mesa_num: mesa.name, sentado_at: nowIso
        }).eq('id', reservaId);
      }
    }

    // 3) Crear orden abierta en POS
    const { data: ord } = await supabase.from('orders').insert({
      table_id: mesa.id, status:'open',
      mesero_nombre: mesero, restaurante_id: restauranteId, restaurant_id: restauranteId,
      opened_at: nowIso,
    }).select('id').single();

    if (ord?.id) {
      await supabase.from('tables').update({ order_id_activo: ord.id }).eq('id', mesa.id);
    }

    // 4) Persistir POS state para que se auto-abra en esta mesa
    try {
      const st = JSON.parse(localStorage.getItem(POS_STATE_KEY) || '{}');
      const clientesPorMesa = st.clientesPorMesa || {};
      const numKey = Number(mesa.name) || mesa.id;
      clientesPorMesa[numKey] = {
        nombre: cliente_nombre.split(' ')[0] || cliente_nombre,
        nombreCompleto: cliente_nombre,
        telefono: cliente_telefono || '',
        email: cliente_email || '',
        gourmand_level: gourmand_level || '',
        vip: esVip,
        avatar: (cliente_nombre || '?').charAt(0).toUpperCase(),
        reserva: {
          origen: reservaOrigen || 'walkin',
          hora: new Date().toLocaleTimeString('es-CO',{hour:'2-digit',minute:'2-digit'}),
          pax, nota: notas || ''
        }
      };
      localStorage.setItem(POS_STATE_KEY, JSON.stringify({
        ...st,
        selectedTableId: mesa.id,
        clientesPorMesa,
      }));
    } catch {}

    showToast(`✅ ${cliente_nombre} sentado en ${mesa.name} · mesero ${mesero}`);
    setConfirmar(null); setWalkin(null); setSel(null); setDraggingRes(null);
    await fetchAll();

    // 5) Redirigir si corresponde
    if (redirigir && onOpenPOS) {
      setTimeout(()=>onOpenPOS(), 400);
    }
  };

  // ── DnD handlers ──────────────────────────────────────────────
  const handleDropOnMesa = (e:React.DragEvent, mesa:MesaRow) => {
    e.preventDefault();
    setHoverMesa(null);
    if (!draggingRes) return;
    if (!aptaParaReserva(mesa, draggingRes)) {
      showToast(`⚠ Mesa ${mesa.name} no apta para ${draggingRes.pax}p`);
      setDraggingRes(null); return;
    }
    setMeseroAsignar(esMesero ? miNombre : '');
    setConfirmar({ reserva: draggingRes, mesa });
  };

  if (loading) return (
    <div style={{minHeight:'100vh',background:'#08080f',color:'#fff',display:'flex',alignItems:'center',justifyContent:'center',fontFamily:"'Inter',sans-serif"}}>
      <div style={{textAlign:'center'}}>
        <div style={{fontSize:38,marginBottom:14}}>🍱</div>
        <div style={{color:'#A0A0B8'}}>Cargando plano interactivo…</div>
      </div>
    </div>
  );

  return (
    <div style={{minHeight:'100vh',background:'#08080f',color:'#fff',fontFamily:"'Inter',sans-serif",padding:'14px 18px'}}>
      <style>{`
        @keyframes pulse-critical { 0%,100%{filter:drop-shadow(0 0 0 rgba(220,38,38,0));transform:scale(1);} 50%{filter:drop-shadow(0 0 12px rgba(220,38,38,0.85));transform:scale(1.06);} }
        @keyframes flash-evt { 0%{filter:drop-shadow(0 0 0 #FFF);} 50%{filter:drop-shadow(0 0 18px #FFF);} 100%{filter:drop-shadow(0 0 0 #FFF);} }
        @keyframes slide-in { from{transform:translateX(40px);opacity:0;} to{transform:translateX(0);opacity:1;} }
        @keyframes apta-glow { 0%,100%{filter:drop-shadow(0 0 0 #22C55E);} 50%{filter:drop-shadow(0 0 14px #22C55E);} }
        .mesa-g { transition: transform 0.18s, filter 0.18s; cursor:pointer; }
        .mesa-g:hover { transform: scale(1.08); filter: drop-shadow(0 0 14px rgba(68,138,255,0.7)); }
        .mesa-critical { animation: pulse-critical 1.6s infinite; }
        .mesa-flash    { animation: flash-evt 1.2s ease-out; }
        .mesa-apta     { animation: apta-glow 1.4s infinite; }
        .mesa-hover-drop { stroke-width: 4 !important; }
        .panel-side { animation: slide-in 0.25s; }
        .reserva-card { transition: all 0.15s; cursor:grab; }
        .reserva-card:hover { transform: translateX(-2px); border-color: rgba(68,138,255,0.6) !important; }
        .reserva-card:active { cursor:grabbing; }
        .reserva-card.drag-source { opacity: 0.4; }
      `}</style>

      {/* ─── Header ─────────────────────────────────────────────── */}
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:10,flexWrap:'wrap',gap:10}}>
        <div style={{display:'flex',alignItems:'center',gap:18}}>
          <div style={{fontFamily:"'Syne',sans-serif",fontWeight:900,fontSize:26,display:'flex',alignItems:'center',gap:8}}>
            <span style={{fontSize:30}}>{activeRestaurant.emoji}</span>
            {activeRestaurant.nombre.toUpperCase()}
          </div>
          <div style={{paddingLeft:18,borderLeft:'1px solid rgba(255,255,255,0.15)'}}>
            <div style={{fontFamily:"'Syne',sans-serif",fontWeight:800,fontSize:16}}>SALA OPERATIVA</div>
            <div style={{fontSize:10,color:'#A0A0B8',letterSpacing:'.12em',marginTop:2}}>
              {esMesero ? `Mesero: ${miNombre} · ${kpi.mias} mesa${kpi.mias===1?'':'s'} tuya${kpi.mias===1?'':'s'}` : `Rol: ${(profile?.role||'').toUpperCase()}`}
            </div>
          </div>
        </div>
        <div style={{display:'flex',gap:8}}>
          <Kpi label="OCUP." value={`${kpi.pct}%`} color="#448AFF"/>
          <Kpi label="LIBRES" value={kpi.libres} color="#22C55E"/>
          <Kpi label="OCUP." value={kpi.ocupadas} color="#EF4444"/>
          <Kpi label="RESERV." value={kpi.reservadas} color="#F59E0B"/>
          <Kpi label="CRÍT." value={kpi.criticas} alert={kpi.criticas>0} color="#DC2626"/>
          <Kpi label="CAP." value={`${kpi.totalCap}p`} color="#9B72FF"/>
        </div>
      </div>

      {/* ─── Filtros ────────────────────────────────────────────── */}
      <div style={{display:'flex',gap:6,marginBottom:10,flexWrap:'wrap'}}>
        {([
          {k:'todas',l:'Todas',c:'#fff'},
          ...(esMesero ? [{k:'mias' as FilterKey,l:'⭐ Mis mesas',c:'#448AFF'}] : []),
          {k:'libres',l:'Libres',c:'#22C55E'},
          {k:'ocupadas',l:'Ocupadas',c:'#EF4444'},
          {k:'reservadas',l:'Reservadas',c:'#F59E0B'},
          {k:'criticas',l:'⚠ +90m',c:'#DC2626'},
        ] as {k:FilterKey;l:string;c:string}[]).map(f => (
          <button key={f.k} onClick={()=>setFilter(f.k)}
            style={{padding:'6px 12px',borderRadius:99,fontSize:11,fontWeight:600,cursor:'pointer',
              background: filter===f.k ? f.c : 'rgba(255,255,255,0.05)',
              color: filter===f.k ? '#000' : '#A0A0B8',
              border: `1px solid ${filter===f.k ? f.c : 'rgba(255,255,255,0.08)'}`}}>{f.l}</button>
        ))}
        <div style={{flex:1}}/>
        {ZONAS_ORDEN.filter(z => !z.startsWith('Barra')).map(z => (
          <button key={z} onClick={()=>setZonaFiltro(zonaFiltro===z?null:z)}
            style={{padding:'6px 12px',borderRadius:99,fontSize:11,fontWeight:600,cursor:'pointer',
              background: zonaFiltro===z ? ZONAS[z].chipBg : 'rgba(255,255,255,0.05)',
              color: zonaFiltro===z ? '#fff' : '#A0A0B8',
              border:`1px solid ${zonaFiltro===z ? ZONAS[z].chipBg : 'rgba(255,255,255,0.08)'}`}}>{z}</button>
        ))}
      </div>

      {/* ═══ Grid principal: Plano + Sidebar ═══════════════════════════ */}
      <div style={{display:'grid',gridTemplateColumns: sel ? '1fr 340px 320px' : '1fr 320px',gap:12,alignItems:'start'}}>

        {/* ── PLANO SVG ──────────────────────────────────────────── */}
        <div style={{background:'#fff',borderRadius:18,padding:12,boxShadow:'0 20px 70px rgba(0,0,0,0.6)',position:'relative'}}
          onMouseMove={(e)=>{ const r=svgRef.current?.getBoundingClientRect(); if(r) setMouse({x:e.clientX-r.left, y:e.clientY-r.top}); }}>
          <svg ref={svgRef} viewBox={`0 0 ${VW} ${VH}`} width="100%" style={{display:'block',background:'#FAFAFA',borderRadius:12}}>
            {/* Áreas de zona */}
            {ZONAS_ORDEN.map(k => {
              const z = ZONAS[k]; if (!z) return null;
              return (
                <g key={k}>
                  <rect x={z.area.x} y={z.area.y} width={z.area.w} height={z.area.h}
                    fill={z.fill} stroke={z.stroke} strokeWidth={2.5} rx={14}/>
                  {!k.startsWith('Barra') && (
                    <text x={z.area.x + z.area.w/2} y={z.area.y + 36} textAnchor="middle"
                      fontSize={32} fontWeight={900} fill={z.chipBg} opacity={0.18}
                      letterSpacing="0.12em" pointerEvents="none">{z.label}</text>
                  )}
                  <g transform={`translate(${z.area.x+14}, ${z.area.y+14})`} pointerEvents="none">
                    <rect width={z.label.length*8.2+18} height={24} rx={6} fill={z.chipBg}/>
                    <text x={9} y={16.5} fill="#fff" fontSize={11} fontWeight={800} letterSpacing="0.08em">{z.label}</text>
                  </g>
                </g>
              );
            })}

            {/* Líneas combinables */}
            {[['A12','M7'],['A11','M8']].map(([a,b]) => {
              const ma = mesas.find(m=>m.name===a); const mb = mesas.find(m=>m.name===b);
              if (!ma || !mb) return null;
              return <line key={`${a}-${b}`} x1={ma.posicion_x} y1={ma.posicion_y} x2={mb.posicion_x} y2={mb.posicion_y}
                stroke="#9B72FF" strokeWidth={2.5} strokeDasharray="6 5" opacity={0.55}/>;
            })}

            {/* Mesas */}
            {visibles.map(m => {
              const estado = (m.estado||'libre').toLowerCase();
              const c = ST[estado as keyof typeof ST] || ST.libre;
              const { w, h } = sizeFor(m);
              const isVIP = m.name==='M5' || m.vip;
              const isBarra = m.zona.startsWith('Barra');
              const min = minutesSince(m.abierta_en);
              const critical = ['ocupada','open'].includes(estado) && min >= 90;
              const flashing = flashIds.has(m.id);
              const isSel = sel?.id === m.id;
              const apta = !!draggingRes && aptaParaReserva(m, draggingRes);
              const hoverDrop = hoverMesa === m.id;
              const otroMesero = otraMesa(m);
              const cls = `mesa-g ${critical?'mesa-critical':''} ${flashing?'mesa-flash':''} ${apta?'mesa-apta':''} ${hoverDrop?'mesa-hover-drop':''}`;

              return (
                <g key={m.id} className={cls}
                   opacity={otroMesero ? 0.32 : (draggingRes && !apta ? 0.35 : 1)}
                   onClick={()=>{ if (otroMesero) return; setSel(m); }}
                   onDragOver={(e)=>{ if (estado==='libre') { e.preventDefault(); setHoverMesa(m.id); } }}
                   onDragLeave={()=>setHoverMesa(h=>h===m.id?null:h)}
                   onDrop={(e)=>handleDropOnMesa(e, m)}
                   onMouseEnter={()=>setHover(m)}
                   onMouseLeave={()=>setHover(h=>h?.id===m.id?null:h)}>
                  {isSel && (
                    <circle cx={m.posicion_x} cy={m.posicion_y} r={Math.max(w,h)/2+10} fill="none" stroke="#448AFF" strokeWidth={3} strokeDasharray="4 4">
                      <animate attributeName="stroke-dashoffset" from="0" to="16" dur="0.6s" repeatCount="indefinite"/>
                    </circle>
                  )}
                  {(m.shape==='round' || isBarra) ? (
                    <circle cx={m.posicion_x} cy={m.posicion_y} r={w/2}
                      fill={isVIP ? '#7C1D1D' : c.bg} stroke={hoverDrop ? '#22C55E' : c.border} strokeWidth={hoverDrop ? 4 : 2.5}/>
                  ) : (
                    <rect x={m.posicion_x-w/2} y={m.posicion_y-h/2} width={w} height={h} rx={7}
                      fill={isVIP ? '#7C1D1D' : c.bg} stroke={hoverDrop ? '#22C55E' : c.border} strokeWidth={hoverDrop ? 4 : 2.5}/>
                  )}
                  {!isBarra && estado!=='libre' && m.mesero_nombre && (
                    <g pointerEvents="none">
                      <circle cx={m.posicion_x+w/2-8} cy={m.posicion_y-h/2+8} r={11} fill="#1a1a2e" stroke="#fff" strokeWidth={1.5}/>
                      <text x={m.posicion_x+w/2-8} y={m.posicion_y-h/2+12} textAnchor="middle" fontSize={9} fontWeight={800} fill="#fff">{initials(m.mesero_nombre)}</text>
                    </g>
                  )}
                  {critical && (
                    <circle cx={m.posicion_x-w/2+9} cy={m.posicion_y-h/2+9} r={6} fill="#DC2626">
                      <animate attributeName="opacity" values="0.4;1;0.4" dur="1.2s" repeatCount="indefinite"/>
                    </circle>
                  )}
                  <text x={m.posicion_x} y={m.posicion_y - 2} textAnchor="middle" pointerEvents="none"
                    fontSize={isBarra ? 11 : (m.name==='M5' ? 22 : 14)}
                    fontWeight={900} fill={isVIP ? '#fff' : c.text}>{m.name}</text>
                  {!isBarra && (
                    <text x={m.posicion_x} y={m.posicion_y + 14} textAnchor="middle" pointerEvents="none"
                      fontSize={10} fontWeight={600} fill={isVIP ? 'rgba(255,255,255,0.85)' : c.text}>
                      {estado==='libre' ? `${m.capacidad}p` : `${m.pax_actual||m.capacidad}p · ${fmtElapsed(min)}`}
                    </text>
                  )}
                </g>
              );
            })}
          </svg>

          {/* Tooltip hover */}
          {hover && !sel && !draggingRes && (
            <div style={{position:'absolute',left:mouse.x+14,top:mouse.y+14,background:'#0f0f1a',color:'#fff',
              padding:'10px 14px',borderRadius:10,pointerEvents:'none',fontSize:12,
              border:'1px solid rgba(255,255,255,0.15)',boxShadow:'0 10px 40px rgba(0,0,0,0.5)',minWidth:160,zIndex:50}}>
              <div style={{fontFamily:"'Syne',sans-serif",fontWeight:900,fontSize:14}}>{hover.name}</div>
              <div style={{color:'#A0A0B8',fontSize:10,letterSpacing:'.06em'}}>{hover.zona.toUpperCase()} · {hover.capacidad}p</div>
              <div style={{marginTop:6}}>
                <span style={{padding:'2px 8px',borderRadius:6,background:(ST[(hover.estado||'libre') as keyof typeof ST] || ST.libre).chip,color:'#000',fontWeight:700,fontSize:10}}>
                  {(ST[(hover.estado||'libre') as keyof typeof ST] || ST.libre).label}
                </span>
              </div>
              {hover.cliente_nombre && <div style={{marginTop:6,fontSize:11,color:'#A0A0B8'}}>👤 {hover.cliente_nombre}</div>}
              {hover.mesero_nombre && <div style={{fontSize:11,color:'#A0A0B8'}}>🍽 {hover.mesero_nombre}</div>}
              {hover.abierta_en && <div style={{fontSize:11,color:'#FFB547'}}>⏱ {fmtElapsed(minutesSince(hover.abierta_en))}</div>}
            </div>
          )}
        </div>

        {/* ── PANEL LATERAL — Detalle mesa ──────────────────────── */}
        {sel && <PanelMesa mesa={sel} onClose={()=>setSel(null)}
                  meseros={meseros} miNombre={miNombre} esMesero={esMesero}
                  zonaMeta={ZONAS[sel.zona]}
                  onWalkin={()=>setWalkin(sel)}
                  onOpenPOS={onOpenPOS}
                  onAccion={async (accion) => {
                    if (accion==='bloquear') await supabase.from('tables').update({estado:'bloqueada'}).eq('id',sel.id);
                    if (accion==='liberar') await supabase.from('tables').update({estado:'libre',status:'free',abierta_en:null,cliente_nombre:null,mesero_nombre:null,pax_actual:0,order_id_activo:null}).eq('id',sel.id);
                    if (accion==='ir_pos') {
                      const st = JSON.parse(localStorage.getItem(POS_STATE_KEY) || '{}');
                      localStorage.setItem(POS_STATE_KEY, JSON.stringify({...st, selectedTableId: sel.id}));
                      onOpenPOS?.();
                    }
                    setSel(null); fetchAll();
                  }}/>}

        {/* ── SIDEBAR DERECHA — Reservas / Meseros / Alertas ────── */}
        <div style={{background:'#0f0f1a',border:'1px solid rgba(255,255,255,0.08)',borderRadius:14,overflow:'hidden',position:'sticky',top:14}}>
          {/* Tabs */}
          <div style={{display:'flex',borderBottom:'1px solid rgba(255,255,255,0.08)'}}>
            {([
              {k:'reservas' as SideTab, l:`📅 Reservas`, n:reservasPendientes.length},
              {k:'meseros' as SideTab,  l:`🍽 Meseros`,  n:meseros.length},
              {k:'alertas' as SideTab,  l:`⚠ Alertas`, n:kpi.criticas},
            ]).map(t => (
              <button key={t.k} onClick={()=>setSideTab(t.k)}
                style={{flex:1,padding:'12px 8px',background: sideTab===t.k ? 'rgba(68,138,255,0.10)' : 'transparent',
                  border:'none',borderBottom: sideTab===t.k ? '2px solid #448AFF' : '2px solid transparent',
                  color: sideTab===t.k ? '#fff' : '#A0A0B8',cursor:'pointer',fontSize:11,fontWeight:700}}>
                {t.l} {t.n>0 && <span style={{background:'#448AFF',color:'#fff',padding:'1px 6px',borderRadius:8,fontSize:10,marginLeft:4}}>{t.n}</span>}
              </button>
            ))}
          </div>

          <div style={{padding:12,maxHeight:'calc(100vh - 220px)',overflowY:'auto'}}>
            {sideTab==='reservas' && (
              <div style={{display:'flex',flexDirection:'column',gap:8}}>
                <div style={{fontSize:10,color:'#A0A0B8',letterSpacing:'.1em',fontWeight:700,marginBottom:4}}>
                  RESERVAS DE HOY · arrastra a una mesa
                </div>
                {reservasPendientes.length === 0 && (
                  <div style={{textAlign:'center',padding:20,color:'#50506A',fontSize:12}}>No hay reservas pendientes</div>
                )}
                {reservasPendientes.map(r => (
                  <div key={`${r.origen}-${r.id}`} className="reserva-card"
                    draggable
                    onDragStart={(e)=>{ e.dataTransfer.setData('text/plain', String(r.id)); setDraggingRes(r); }}
                    onDragEnd={()=>{ setDraggingRes(null); setHoverMesa(null); }}
                    style={{padding:'10px 12px',background:'rgba(255,255,255,0.03)',borderRadius:10,
                      border: r.vip ? '1px solid rgba(255,181,71,0.45)' : '1px solid rgba(255,255,255,0.08)'}}>
                    <div style={{display:'flex',alignItems:'center',gap:10}}>
                      <div style={{width:38,height:38,borderRadius:10,background: r.vip?'#FFB54720':'#448AFF20',
                        border: r.vip?'1px solid #FFB547':'1px solid #448AFF40',display:'flex',alignItems:'center',justifyContent:'center',
                        fontFamily:"'Syne',sans-serif",fontWeight:900,fontSize:13,color: r.vip?'#FFB547':'#448AFF'}}>
                        {initials(r.cliente_nombre)}
                      </div>
                      <div style={{flex:1,minWidth:0}}>
                        <div style={{display:'flex',alignItems:'center',gap:6}}>
                          <span style={{fontSize:13,fontWeight:700,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{r.cliente_nombre}</span>
                          {r.vip && <span style={{fontSize:10,color:'#FFB547'}}>⭐</span>}
                        </div>
                        <div style={{fontSize:11,color:'#A0A0B8',marginTop:1}}>
                          {r.hora} · {r.pax}p {r.origen==='ohyeah' && <span style={{color:'#9B72FF'}}>· 🦉</span>}
                        </div>
                        {r.ocasion && r.ocasion !== 'Sin ocasión especial' && (
                          <div style={{fontSize:10,color:'#F59E0B',marginTop:2}}>🎉 {r.ocasion}</div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {sideTab==='meseros' && (
              <div style={{display:'flex',flexDirection:'column',gap:6}}>
                <div style={{fontSize:10,color:'#A0A0B8',letterSpacing:'.1em',fontWeight:700,marginBottom:6}}>
                  MESEROS ACTIVOS
                </div>
                {meseros.map(m => {
                  const cuantas = mesas.filter(x => (x.mesero_nombre||'').toLowerCase() === m.nombre.toLowerCase()).length;
                  const yo = m.nombre.toLowerCase() === miNombre.toLowerCase();
                  return (
                    <div key={m.id} style={{display:'flex',alignItems:'center',gap:10,padding:'10px 12px',
                      background: yo ? 'rgba(68,138,255,0.10)' : 'rgba(255,255,255,0.03)',
                      borderRadius:10,border: yo ? '1px solid rgba(68,138,255,0.4)' : '1px solid transparent'}}>
                      <div style={{width:36,height:36,borderRadius:'50%',background:'#1a1a2e',
                        display:'flex',alignItems:'center',justifyContent:'center',fontWeight:800,fontSize:12,color:'#fff'}}>
                        {initials(m.nombre)}
                      </div>
                      <div style={{flex:1}}>
                        <div style={{fontSize:12,fontWeight:600}}>{m.nombre.split(' ').slice(0,2).join(' ')}{yo && ' · TÚ'}</div>
                        <div style={{fontSize:10,color:'#A0A0B8'}}>{cuantas} mesa{cuantas===1?'':'s'}</div>
                      </div>
                      {cuantas>0 && <div style={{padding:'3px 8px',background:'#22C55E20',color:'#22C55E',borderRadius:6,fontSize:10,fontWeight:700}}>ACTIVO</div>}
                    </div>
                  );
                })}
                {meseros.length === 0 && <div style={{textAlign:'center',color:'#50506A',fontSize:12,padding:16}}>No hay meseros activos</div>}
              </div>
            )}

            {sideTab==='alertas' && (
              <div style={{display:'flex',flexDirection:'column',gap:8}}>
                <div style={{fontSize:10,color:'#A0A0B8',letterSpacing:'.1em',fontWeight:700,marginBottom:4}}>
                  ALERTAS · mesas que requieren atención
                </div>
                {mesas.filter(m=>['ocupada','open'].includes((m.estado||'').toLowerCase()) && minutesSince(m.abierta_en)>=90).map(m=>(
                  <div key={m.id} onClick={()=>setSel(m)} style={{cursor:'pointer',padding:'10px 12px',
                    background:'rgba(220,38,38,0.08)',border:'1px solid rgba(220,38,38,0.3)',borderRadius:10}}>
                    <div style={{fontSize:13,fontWeight:800,color:'#DC2626'}}>⚠ Mesa {m.name}</div>
                    <div style={{fontSize:11,color:'#A0A0B8',marginTop:2}}>
                      {m.cliente_nombre || 'Cliente'} · {fmtElapsed(minutesSince(m.abierta_en))} abierta
                    </div>
                  </div>
                ))}
                {kpi.criticas===0 && (
                  <div style={{textAlign:'center',padding:20,color:'#22C55E',fontSize:12}}>✓ Sin alertas</div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Modal confirmación al soltar reserva ────────────────── */}
      {confirmar && (
        <div onClick={()=>setConfirmar(null)} style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.82)',zIndex:9999,display:'flex',alignItems:'center',justifyContent:'center',padding:20}}>
          <div onClick={e=>e.stopPropagation()} style={{background:'#0f0f1a',border:'1px solid rgba(255,255,255,0.12)',borderRadius:18,width:'100%',maxWidth:460,overflow:'hidden'}}>
            <div style={{padding:'18px 22px',background:'#22C55E',color:'#000'}}>
              <div style={{fontFamily:"'Syne',sans-serif",fontWeight:900,fontSize:18}}>Sentar reserva</div>
              <div style={{fontSize:11,opacity:0.85,marginTop:2}}>
                {confirmar.reserva.cliente_nombre} ({confirmar.reserva.pax}p) → Mesa {confirmar.mesa.name} · {confirmar.mesa.zona}
              </div>
            </div>
            <div style={{padding:22}}>
              {confirmar.reserva.vip && (
                <div style={{padding:'8px 12px',background:'rgba(255,181,71,0.10)',border:'1px solid rgba(255,181,71,0.3)',borderRadius:8,marginBottom:14,fontSize:12,color:'#FFB547'}}>
                  ⭐ Cliente VIP — {confirmar.reserva.gourmand_level}
                </div>
              )}
              <div style={{marginBottom:14}}>
                <div style={{fontSize:11,color:'#A0A0B8',letterSpacing:'.06em',marginBottom:6}}>MESERO A CARGO</div>
                <select value={meseroAsignar} onChange={e=>setMeseroAsignar(e.target.value)}
                  style={{width:'100%',padding:'10px 12px',background:'rgba(255,255,255,0.05)',color:'#fff',border:'1px solid rgba(255,255,255,0.10)',borderRadius:8,fontSize:13}}>
                  <option value="">— Sin asignar —</option>
                  {meseros.map(m=>(<option key={m.id} value={m.nombre}>{m.nombre}{m.nombre.toLowerCase()===miNombre.toLowerCase()?' (TÚ)':''}</option>))}
                </select>
                {esMesero && !meseroAsignar && (
                  <button onClick={()=>setMeseroAsignar(miNombre)} style={{marginTop:6,fontSize:11,color:'#448AFF',background:'none',border:'none',cursor:'pointer'}}>
                    → Tomarla yo ({miNombre})
                  </button>
                )}
              </div>
              {confirmar.reserva.notas && (
                <div style={{padding:'10px 12px',background:'rgba(68,138,255,0.06)',border:'1px solid rgba(68,138,255,0.20)',borderRadius:8,marginBottom:14,fontSize:12}}>
                  <div style={{fontSize:10,color:'#448AFF',marginBottom:4}}>NOTAS</div>
                  {confirmar.reserva.notas}
                </div>
              )}
              <div style={{display:'flex',gap:8}}>
                <button onClick={()=>setConfirmar(null)} style={{flex:1,padding:'12px',background:'rgba(255,255,255,0.05)',color:'#fff',border:'1px solid rgba(255,255,255,0.10)',borderRadius:10,cursor:'pointer',fontWeight:600}}>Cancelar</button>
                <button onClick={()=>sentarEnMesa({
                  mesa: confirmar.mesa,
                  cliente_nombre: confirmar.reserva.cliente_nombre,
                  cliente_telefono: confirmar.reserva.cliente_telefono,
                  cliente_email: confirmar.reserva.cliente_email,
                  pax: confirmar.reserva.pax,
                  mesero: meseroAsignar || miNombre || '—',
                  reservaId: confirmar.reserva.id,
                  reservaOrigen: confirmar.reserva.origen,
                  gourmand_level: confirmar.reserva.gourmand_level,
                  notas: confirmar.reserva.notas,
                  redirigir: (meseroAsignar||miNombre).toLowerCase() === miNombre.toLowerCase() && !!onOpenPOS,
                })} style={{flex:2,padding:'12px',background:'#22C55E',color:'#000',border:'none',borderRadius:10,cursor:'pointer',fontWeight:800}}>
                  ✅ Sentar y abrir POS
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal Walk-in ───────────────────────────────────────── */}
      {walkin && <ModalWalkin mesa={walkin} meseros={meseros} miNombre={miNombre} esMesero={esMesero}
        onCancel={()=>setWalkin(null)}
        onConfirm={(data)=>sentarEnMesa({
          mesa: walkin, cliente_nombre: data.nombre, cliente_telefono: data.telefono, cliente_email: data.email,
          pax: data.pax, mesero: data.mesero || miNombre || '—',
          redirigir: (data.mesero||miNombre).toLowerCase() === miNombre.toLowerCase() && !!onOpenPOS,
        })}/>}

      {/* Toast */}
      {toast && (
        <div style={{position:'fixed',bottom:24,left:'50%',transform:'translateX(-50%)',background:'#0f0f1a',color:'#fff',
          padding:'12px 22px',borderRadius:12,border:'1px solid rgba(34,197,94,0.4)',fontSize:13,fontWeight:600,zIndex:10000}}>
          {toast}
        </div>
      )}
    </div>
  );
}

// ═══ Subcomponentes ═══════════════════════════════════════════════

function Kpi({label,value,color,alert}:{label:string;value:string|number;color:string;alert?:boolean}) {
  return (
    <div style={{background:alert?`${color}20`:'rgba(255,255,255,0.04)',border:`1px solid ${alert?color:'rgba(255,255,255,0.07)'}`,borderRadius:10,padding:'7px 12px',minWidth:70,animation: alert ? 'pulse-critical 2s infinite' : undefined}}>
      <div style={{fontSize:9,color:'#A0A0B8',letterSpacing:'.08em',fontWeight:700}}>{label}</div>
      <div style={{fontSize:16,fontWeight:900,color,marginTop:1}}>{value}</div>
    </div>
  );
}

function PanelMesa({mesa, meseros, miNombre, esMesero, zonaMeta, onClose, onWalkin, onAccion, onOpenPOS}:{
  mesa:MesaRow; meseros:any[]; miNombre:string; esMesero:boolean;
  zonaMeta?: ZonaArea;
  onClose:()=>void; onWalkin:()=>void; onAccion:(a:string)=>void; onOpenPOS?:()=>void;
}) {
  const estado = (mesa.estado||'libre').toLowerCase();
  const c = ST[estado as keyof typeof ST] || ST.libre;
  const min = minutesSince(mesa.abierta_en);
  const esTuya = (mesa.mesero_nombre||'').toLowerCase() === miNombre.toLowerCase();

  return (
    <div className="panel-side" style={{background:'#0f0f1a',border:'1px solid rgba(255,255,255,0.10)',borderRadius:18,overflow:'hidden',position:'sticky',top:14}}>
      <div style={{padding:'18px 22px',background:zonaMeta?.chipBg||'#1a1a2e',display:'flex',alignItems:'center',gap:14,position:'relative'}}>
        <button onClick={onClose} style={{position:'absolute',top:12,right:12,width:28,height:28,borderRadius:8,border:'none',background:'rgba(0,0,0,0.25)',color:'#fff',cursor:'pointer',fontSize:13}}>✕</button>
        <div style={{width:64,height:64,borderRadius:14,background:'rgba(255,255,255,0.20)',display:'flex',alignItems:'center',justifyContent:'center',fontFamily:"'Syne',sans-serif",fontWeight:900,fontSize:22,color:'#fff'}}>{mesa.name}</div>
        <div>
          <div style={{fontFamily:"'Syne',sans-serif",fontWeight:900,fontSize:18}}>{mesa.zona}</div>
          <div style={{fontSize:11,opacity:0.9,marginTop:2}}>{mesa.capacidad} pax · {mesa.shape}</div>
          <span style={{marginTop:8,display:'inline-block',padding:'4px 10px',background:c.chip,color:'#000',borderRadius:6,fontWeight:800,fontSize:11}}>{c.label}</span>
        </div>
      </div>
      <div style={{padding:18,maxHeight:'calc(100vh - 240px)',overflowY:'auto'}}>
        {estado==='libre' ? (
          <>
            <div style={{textAlign:'center',padding:'4px 0 14px'}}>
              <div style={{fontSize:38,marginBottom:6}}>🪑</div>
              <div style={{color:'#A0A0B8',fontSize:12}}>Mesa libre · lista para asignar</div>
            </div>
            <div style={{fontSize:10,color:'#A0A0B8',letterSpacing:'.1em',fontWeight:700,marginBottom:6}}>ACCIONES</div>
            <div style={{display:'grid',gap:6}}>
              <ActionBtn icon="🚶" label="Walk-in (sin reserva)" color="#22C55E" onClick={onWalkin}/>
              <ActionBtn icon="🚫" label="Bloquear mesa" color="#6B7280" onClick={()=>onAccion('bloquear')}/>
            </div>
            <div style={{marginTop:14,padding:10,fontSize:11,color:'#A0A0B8',background:'rgba(68,138,255,0.06)',border:'1px solid rgba(68,138,255,0.20)',borderRadius:8}}>
              💡 Para sentar una reserva, arrástrala desde la sidebar derecha hasta esta mesa.
            </div>
          </>
        ) : (
          <>
            <div style={{display:'flex',flexDirection:'column',gap:6,marginBottom:14}}>
              {mesa.cliente_nombre && <Field icon="👤" label="Cliente" value={mesa.cliente_nombre}/>}
              {mesa.mesero_nombre && <Field icon="🍽" label="Mesero" value={mesa.mesero_nombre + (esTuya?' (TÚ)':'')}/>}
              {mesa.pax_actual ? <Field icon="👥" label="Pax actual" value={String(mesa.pax_actual)}/> : null}
              {mesa.abierta_en && <Field icon="⏱" label="Abierta hace" value={fmtElapsed(min)} alert={min>=90}/>}
            </div>
            <div style={{fontSize:10,color:'#A0A0B8',letterSpacing:'.1em',fontWeight:700,marginBottom:6}}>ACCIONES</div>
            <div style={{display:'grid',gap:6}}>
              {(esTuya || !esMesero) && <ActionBtn icon="💵" label="Ir al POS de esta mesa" color="#448AFF" onClick={()=>onAccion('ir_pos')}/>}
              {!esMesero && <ActionBtn icon="✅" label="Cerrar y liberar" color="#22C55E" onClick={()=>onAccion('liberar')}/>}
            </div>
          </>
        )}
        {(['A12','A11','M7','M8'].includes(mesa.name)) && (
          <div style={{marginTop:14,padding:10,background:'rgba(155,114,255,0.08)',border:'1px solid rgba(155,114,255,0.25)',borderRadius:8}}>
            <div style={{fontSize:10,color:'#9B72FF',fontWeight:800,letterSpacing:'.08em',marginBottom:4}}>🔗 COMBINABLE</div>
            <div style={{fontSize:11}}>
              {mesa.name==='A12' && 'Sofá compartido con M7 · combinada máx 10 pax'}
              {mesa.name==='M7'  && 'Sofá compartido con A12 · combinada máx 10 pax'}
              {mesa.name==='A11' && 'Combinable con M8 · máx 10 pax'}
              {mesa.name==='M8'  && 'Combinable con A11 · máx 10 pax'}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function ModalWalkin({mesa, meseros, miNombre, esMesero, onCancel, onConfirm}:{
  mesa:MesaRow; meseros:any[]; miNombre:string; esMesero:boolean;
  onCancel:()=>void;
  onConfirm:(d:{nombre:string;pax:number;telefono?:string;email?:string;mesero:string})=>void;
}) {
  const [data, setData] = useState({nombre:'',pax: Math.min(mesa.capacidad,2), telefono:'',email:'', mesero: esMesero ? miNombre : ''});
  const puedeConfirmar = data.nombre.trim().length > 1 && data.pax > 0;
  return (
    <div onClick={onCancel} style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.82)',zIndex:9999,display:'flex',alignItems:'center',justifyContent:'center',padding:20}}>
      <div onClick={e=>e.stopPropagation()} style={{background:'#0f0f1a',border:'1px solid rgba(255,255,255,0.12)',borderRadius:18,width:'100%',maxWidth:440,overflow:'hidden'}}>
        <div style={{padding:'18px 22px',background:'#448AFF',color:'#fff'}}>
          <div style={{fontFamily:"'Syne',sans-serif",fontWeight:900,fontSize:18}}>🚶 Walk-in</div>
          <div style={{fontSize:11,opacity:0.85,marginTop:2}}>Mesa {mesa.name} · {mesa.zona} · cap {mesa.capacidad}p</div>
        </div>
        <div style={{padding:22,display:'flex',flexDirection:'column',gap:12}}>
          <Input label="NOMBRE" value={data.nombre} onChange={v=>setData(p=>({...p,nombre:v}))} placeholder="Nombre del cliente"/>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}>
            <Input label="PAX" type="number" value={String(data.pax)} onChange={v=>setData(p=>({...p,pax:Number(v)||1}))}/>
            <Input label="TELÉFONO (opc)" value={data.telefono} onChange={v=>setData(p=>({...p,telefono:v}))}/>
          </div>
          <Input label="EMAIL (opc)" value={data.email} onChange={v=>setData(p=>({...p,email:v}))}/>
          <div>
            <div style={{fontSize:11,color:'#A0A0B8',letterSpacing:'.06em',marginBottom:6}}>MESERO</div>
            <select value={data.mesero} onChange={e=>setData(p=>({...p,mesero:e.target.value}))}
              style={{width:'100%',padding:'10px 12px',background:'rgba(255,255,255,0.05)',color:'#fff',border:'1px solid rgba(255,255,255,0.10)',borderRadius:8,fontSize:13}}>
              <option value="">— Sin asignar —</option>
              {meseros.map((m:any)=>(<option key={m.id} value={m.nombre}>{m.nombre}{m.nombre.toLowerCase()===miNombre.toLowerCase()?' (TÚ)':''}</option>))}
            </select>
          </div>
          <div style={{display:'flex',gap:8,marginTop:6}}>
            <button onClick={onCancel} style={{flex:1,padding:'12px',background:'rgba(255,255,255,0.05)',color:'#fff',border:'1px solid rgba(255,255,255,0.10)',borderRadius:10,cursor:'pointer',fontWeight:600}}>Cancelar</button>
            <button disabled={!puedeConfirmar} onClick={()=>onConfirm(data)}
              style={{flex:2,padding:'12px',background: puedeConfirmar?'#22C55E':'rgba(34,197,94,0.3)',color:'#000',border:'none',borderRadius:10,cursor:puedeConfirmar?'pointer':'not-allowed',fontWeight:800}}>
              ✅ Sentar y abrir POS
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function Field({icon,label,value,alert}:{icon:string;label:string;value:string;alert?:boolean}) {
  return (
    <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'9px 11px',background:'rgba(255,255,255,0.03)',borderRadius:8,border:alert ? '1px solid rgba(220,38,38,0.4)' : '1px solid transparent'}}>
      <span style={{display:'flex',gap:8,alignItems:'center',color:'#A0A0B8',fontSize:11}}><span style={{fontSize:13}}>{icon}</span>{label}</span>
      <span style={{color:alert ? '#DC2626' : '#fff',fontWeight:700,fontSize:12}}>{value}</span>
    </div>
  );
}

function ActionBtn({icon,label,color,onClick}:{icon:string;label:string;color:string;onClick:()=>void}) {
  return (
    <button onClick={onClick}
      style={{display:'flex',alignItems:'center',gap:8,padding:'11px 12px',background:`${color}15`,border:`1px solid ${color}40`,color:'#fff',borderRadius:9,cursor:'pointer',fontWeight:600,fontSize:12,transition:'all 0.15s'}}
      onMouseEnter={e=>{(e.currentTarget as HTMLButtonElement).style.background=`${color}30`;}}
      onMouseLeave={e=>{(e.currentTarget as HTMLButtonElement).style.background=`${color}15`;}}>
      <span style={{fontSize:16}}>{icon}</span>{label}
    </button>
  );
}

function Input({label,value,onChange,type='text',placeholder}:{label:string;value:string;onChange:(v:string)=>void;type?:string;placeholder?:string}) {
  return (
    <div>
      <div style={{fontSize:11,color:'#A0A0B8',letterSpacing:'.06em',marginBottom:6}}>{label}</div>
      <input type={type} value={value} placeholder={placeholder} onChange={e=>onChange(e.target.value)}
        style={{width:'100%',padding:'10px 12px',background:'rgba(255,255,255,0.05)',color:'#fff',border:'1px solid rgba(255,255,255,0.10)',borderRadius:8,fontSize:13,outline:'none'}}/>
    </div>
  );
}
