import React, { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../lib/supabase.ts';

// ── KDS Avanzado — Multiestación con tiempos y alertas ──────────────────────

const ESTACIONES: Record<string, {color:string; emoji:string; objetivo:number}> = {
  cocina_caliente: { color:'#FF6B00', emoji:'🔥', objetivo:480 },
  cocina_fria:     { color:'#22d3ee', emoji:'🧊', objetivo:360 },
  robata:          { color:'#FF9800', emoji:'🥩', objetivo:600 },
  postres:         { color:'#B388FF', emoji:'🍮', objetivo:300 },
  bar:             { color:'#448AFF', emoji:'🍸', objetivo:180 },
  cava:            { color:'#FFB547', emoji:'🍷', objetivo:120 },
};

interface FlowItem {
  id:string; order_id:string;
  status:'pending'|'preparing'|'ready'|'served';
  quantity:number; notes:string|null; nombre_plato?:string|null;
  created_at:string; updated_at:string; tiempo_inicio?:string|null;
  table_id:number|null; menu_name:string|null; category:string|null;
  mesero?:string|null; estacion?:string|null; cocinero?:string|null;
}

// ── 20 COLORES ÚNICOS POR MESA ─────────────────────────────────────
const MESA_COLORES: Record<number,{color:string;bg:string;label:string}> = {
  1:  { color:'#1565C0', bg:'rgba(21,101,192,0.15)',  label:'Azul marino'    },
  2:  { color:'#D81B60', bg:'rgba(216,27,96,0.15)',   label:'Fucsia'         },
  3:  { color:'#2E7D32', bg:'rgba(46,125,50,0.15)',   label:'Verde bosque'   },
  4:  { color:'#F9A825', bg:'rgba(249,168,37,0.15)',  label:'Ámbar'          },
  5:  { color:'#6A1B9A', bg:'rgba(106,27,154,0.15)',  label:'Violeta'        },
  6:  { color:'#00838F', bg:'rgba(0,131,143,0.15)',   label:'Teal'           },
  7:  { color:'#BF360C', bg:'rgba(191,54,12,0.15)',   label:'Terracota'      },
  8:  { color:'#1976D2', bg:'rgba(25,118,210,0.15)',  label:'Azul cobalto'   },
  9:  { color:'#558B2F', bg:'rgba(85,139,47,0.15)',   label:'Verde oliva'    },
  10: { color:'#E65100', bg:'rgba(230,81,0,0.15)',    label:'Naranja quemado'},
  11: { color:'#4527A0', bg:'rgba(69,39,160,0.15)',   label:'Índigo'         },
  12: { color:'#00695C', bg:'rgba(0,105,92,0.15)',    label:'Verde esmeralda'},
  13: { color:'#AD1457', bg:'rgba(173,20,87,0.15)',   label:'Rosa oscuro'    },
  14: { color:'#0277BD', bg:'rgba(2,119,189,0.15)',   label:'Azul cielo'     },
  15: { color:'#6D4C41', bg:'rgba(109,76,65,0.15)',   label:'Café'           },
  16: { color:'#37474F', bg:'rgba(55,71,79,0.15)',    label:'Gris pizarra'   },
  17: { color:'#827717', bg:'rgba(130,119,23,0.15)',  label:'Oliva dorado'   },
  18: { color:'#880E4F', bg:'rgba(136,14,79,0.15)',   label:'Burdeos'        },
  19: { color:'#1A237E', bg:'rgba(26,35,126,0.15)',   label:'Azul noche'     },
  20: { color:'#004D40', bg:'rgba(0,77,64,0.15)',     label:'Verde oscuro'   },
};
const getMesaColor = (tableId:number|null) =>
  tableId && MESA_COLORES[tableId] ? MESA_COLORES[tableId] : { color:'#606060', bg:'rgba(96,96,96,0.1)', label:`M${tableId}` };

const getNombre = (item:FlowItem) => item.nombre_plato ?? item.menu_name ?? item.notes ?? 'Plato';
const getStation = (item:FlowItem): string => item.estacion || item.category || 'cocina_caliente';
const tseconds = (iso:string) => Math.floor((Date.now()-new Date(iso).getTime())/1000);
// Formato tiempo — siempre en minutos, sin segundos sueltos (JP Boss request)
const fmtTime = (s:number) => {
  if (!s || s <= 0) return '—';
  const min = Math.floor(s / 60);
  const seg = Math.round(s % 60);
  if (min === 0) return `<1min`;           // menos de 1 min → no mostrar segundos
  if (seg < 30) return `${min}min`;        // redondear hacia abajo
  return `${min + 1}min`;                  // redondear hacia arriba si ≥30s
};
const fmtMin = (min:number) => {
  if (!min || min <= 0) return '—';
  return `${Math.round(min)}min`;
};

export default function FlowModule() {
  const [items, setItems] = useState<FlowItem[]>([]);
  const [pedidosDia, setPedidosDia] = useState<FlowItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [now, setNow] = useState(Date.now());
  const [activeTab, setActiveTab] = useState<'live'|'dia'|'platos'>('live');
  const [filtroEstacion, setFiltroEstacion] = useState<string|null>(null);
  const [tiemposMetrica, setTiemposMetrica] = useState<any[]>([]);
  const [filtroStatus, setFiltroStatus] = useState<string>('all');
  const channelRef = useRef<any>(null);

  // Tick cada segundo para actualizar tiempos
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  const fetchPedidosDia = useCallback(async () => {
    // Pedidos del día desde vista_pedidos_dia o order_items directamente
    const today = new Date().toLocaleDateString('es-CO',{timeZone:'America/Bogota'}).split('/').reverse().join('-');
    const { data: ordenes } = await supabase.from('orders').select('id,table_id,mesero_nombre')
      .eq('restaurante_id', 6).gte('opened_at', `${today}T00:00:00`);

    if (!ordenes?.length) { setPedidosDia([]); return; }
    const { data:ois } = await supabase.from('order_items')
      .select('id,order_id,status,quantity,notes,nombre_plato,created_at,updated_at,tiempo_inicio,tiempo_listo,duracion_seg,mesero,estacion,cocinero,precio_unitario:price_at_time')
      .in('order_id', ordenes.map(o=>o.id))
      .neq('status','cancelled')
      .order('created_at',{ascending:false});

    if (!ois) return;
    const enriched = ois.map((oi:any) => {
      const orden = ordenes.find(o=>o.id===oi.order_id);
      return { ...oi, table_id:orden?.table_id??null, menu_name:oi.nombre_plato??oi.notes, category:oi.estacion??null };
    });
    setPedidosDia(enriched as FlowItem[]);

    // Cargar métricas de tiempo del día
    const { data: metricas } = await supabase.from('vista_tiempos_dia').select('*');
    if (metricas) setTiemposMetrica(metricas);
  }, []);

  const fetchLive = useCallback(async () => {
    const { data: ordenes } = await supabase.from('orders').select('id,table_id,mesero_nombre')
      .eq('restaurante_id',6).eq('status','open');

    if (!ordenes?.length) { setItems([]); setLoading(false); return; }
    const { data:ois } = await supabase.from('order_items')
      .select('id,order_id,status,quantity,notes,nombre_plato,created_at,updated_at,tiempo_inicio,tiempo_listo,duracion_seg,mesero,estacion,cocinero,precio_unitario:price_at_time')
      .in('order_id', ordenes.map(o=>o.id))
      .neq('status','cancelled')
      .neq('status','served')
      .order('created_at',{ascending:true});

    if (!ois) { setLoading(false); return; }
    const enriched = ois.map((oi:any) => {
      const orden = ordenes.find(o=>o.id===oi.order_id);
      return { ...oi, table_id:orden?.table_id??null, menu_name:oi.nombre_plato??oi.notes, category:oi.estacion??null };
    });
    setItems(enriched as FlowItem[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchLive(); fetchPedidosDia();

    // Suscripción Realtime
    channelRef.current = supabase.channel('flow-live')
      .on('postgres_changes',{event:'*',schema:'public',table:'order_items'},(payload) => {
        fetchLive(); fetchPedidosDia();
      }).subscribe();

    return () => { if(channelRef.current) supabase.removeChannel(channelRef.current); };
  }, [fetchLive, fetchPedidosDia]);

  const updateStatus = async (id:string, status:string) => {
    const now_ts = new Date().toISOString();
    const updates:any = { status, updated_at: now_ts };

    // Inicio de producción
    if (status === 'preparing') {
      updates.tiempo_inicio = now_ts;
    }

    // Plato listo — guardar tiempo_listo
    // El trigger de Supabase calcula duracion_seg automáticamente
    if (status === 'served') {
      updates.tiempo_listo = now_ts;
      // Si no tenía tiempo_inicio (pending→served directo), calculamos aquí también
      const item = items.find(i => i.id === id);
      if (item && !item.tiempo_inicio) {
        updates.tiempo_inicio = item.created_at; // el trigger lo usará para calcular duración
      }
    }

    await supabase.from('order_items').update(updates).eq('id', id);

    // Notificar al mesero — notificación en nexum_notificaciones
    if (status === 'served') {
      const item = items.find(i => i.id === id);
      if (item) {
        // Insertar alerta de plato listo
        await supabase.from('flow_alertas').insert({
          restaurante_id: 6,
          mesa_num:  item.table_id,
          plato:     getNombre(item),
          mesero:    item.mesero || null,
          cocinero:  item.cocinero || null,
          estacion:  item.estacion || getStation(item),
          leida:     false,
        });
        // Notificación push al mesero en nexum_notificaciones
        await supabase.from('nexum_notificaciones').insert({
          restaurante_id: 6,
          tipo:    'plato_listo',
          titulo:  `🍽️ ${getNombre(item)} listo`,
          mensaje: `Mesa ${item.table_id} · ${fmtTime(updates.duracion_seg||0)} de producción`,
          urgente: false,
          leida:   false,
          destinatario_nombre: item.mesero || null,
        }).then(()=>{}).catch(()=>{});
      }
    }
  };

  // Agrupar por estación
  const byEstacion = Object.keys(ESTACIONES).reduce((acc, est) => {
    acc[est] = items.filter(i => getStation(i)===est && (!filtroEstacion||filtroEstacion===est));
    return acc;
  }, {} as Record<string,FlowItem[]>);

  // ── SEMÁFORO PROPAGADO: si cocina caliente se retrasa, advertir otros platos de la misma mesa ──
  const mesasConRetraso = new Set(
    items.filter(i => {
      if (i.status === 'served' || i.status === 'cancelled') return false;
      const est2 = ESTACIONES[i.estacion || getStation(i)] || ESTACIONES['cocina_caliente'];
      const tp2 = tseconds(i.created_at);
      const pp2 = i.tiempo_inicio ? tseconds(i.tiempo_inicio) : 0;
      const esCal = (i.estacion || getStation(i)) === 'cocina_caliente';
      return esCal && ((i.status==='pending' && tp2>est2.objetivo*1.5)||(i.status==='preparing' && pp2>est2.objetivo));
    }).map(i => i.table_id)
  );


  const enFuego = items.filter(i => {
    if (i.status==='pending') {
      const t = tseconds(i.created_at);
      const obj = ESTACIONES[getStation(i)]?.objetivo || 480;
      return t > obj;
    }
    if (i.status==='preparing' && i.tiempo_inicio) {
      const t = tseconds(i.tiempo_inicio);
      const obj = ESTACIONES[getStation(i)]?.objetivo || 480;
      return t > obj;
    }
    return false;
  });

  const statsHoy = {
    total: pedidosDia.length,
    pendiente: pedidosDia.filter(i=>i.status==='pending').length,
    preparando: pedidosDia.filter(i=>i.status==='preparing').length,
    listo: pedidosDia.filter(i=>i.status==='served').length,
    promTiempo: (() => {
      const conTiempo = pedidosDia.filter(i=>(i as any).duracion_seg);
      if (!conTiempo.length) return 0;
      return Math.round(conTiempo.reduce((s,i)=>s+((i as any).duracion_seg||0),0)/conTiempo.length);
    })(),
  };

  return (
    <div style={{height:'100%',display:'flex',flexDirection:'column',background:'#08080f',color:'#f0f0f0',fontFamily:"'DM Sans',sans-serif",overflow:'hidden'}}>

      {/* Header */}
      <div style={{padding:'12px 20px',borderBottom:'1px solid rgba(255,255,255,0.08)',background:'#0f0f1a',display:'flex',alignItems:'center',gap:12,flexShrink:0,flexWrap:'wrap'}}>
        <div style={{fontFamily:"'Syne',sans-serif",fontSize:16,fontWeight:900}}>⚡ FLOW <span style={{color:'#22d3ee'}}>KDS</span></div>

        {/* KPIs */}
        {[
          {l:'En fuego 🔥', v:enFuego.length, c:'#FF5252'},
          {l:'Preparando', v:items.filter(i=>i.status==='preparing').length, c:'#FFB547'},
          {l:'Pendientes', v:items.filter(i=>i.status==='pending').length, c:'#50506A'},
          {l:'Hoy listos',  v:statsHoy.listo, c:'#00E676'},
          {l:'T. prom.',    v:statsHoy.promTiempo>0?fmtTime(statsHoy.promTiempo):'—', c:'#B388FF'},
        ].map(kpi=>(
          <div key={kpi.l} style={{textAlign:'center',padding:'4px 12px',background:'rgba(255,255,255,0.04)',borderRadius:8}}>
            <div style={{fontSize:9,color:'#50506A',textTransform:'uppercase'}}>{kpi.l}</div>
            <div style={{fontFamily:"'Syne',sans-serif",fontSize:16,fontWeight:900,color:kpi.c}}>{kpi.v}</div>
          </div>
        ))}

        <div style={{marginLeft:'auto',display:'flex',gap:4,flexWrap:'wrap'}}>
          {/* Filtro estación */}
          {Object.entries(ESTACIONES).map(([slug,est])=>(
            <button key={slug} onClick={()=>setFiltroEstacion(filtroEstacion===slug?null:slug)}
              title={slug.replace('_',' ')}
              style={{
                padding: filtroEstacion===slug ? '5px 12px' : '5px 10px',
                borderRadius:8,
                border:`1px solid ${filtroEstacion===slug?est.color:'rgba(255,255,255,0.1)'}`,
                background:filtroEstacion===slug?`${est.color}25`:'transparent',
                color:filtroEstacion===slug?est.color:'#606060',
                fontSize:filtroEstacion===slug?11:16,
                fontWeight:700,
                cursor:'pointer',
                transition:'all .15s',
                display:'flex',
                alignItems:'center',
                gap:5,
                boxShadow: filtroEstacion===slug ? `0 0 10px ${est.color}40` : 'none',
              }}>
              <span style={{fontSize:16}}>{est.emoji}</span>
              {filtroEstacion===slug && (
                <span style={{fontSize:10,textTransform:'uppercase',letterSpacing:'.05em',whiteSpace:'nowrap'}}>
                  {slug.replace('_',' ')} ✕
                </span>
              )}
            </button>
          ))}
          {filtroEstacion && (
            <button onClick={()=>setFiltroEstacion(null)}
              style={{padding:'5px 10px',borderRadius:8,border:'1px solid rgba(255,255,255,0.15)',background:'rgba(255,255,255,0.05)',color:'#a0a0a0',fontSize:10,fontWeight:700,cursor:'pointer'}}>
              Ver todas
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div style={{display:'flex',borderBottom:'1px solid rgba(255,255,255,0.07)',background:'#0f0f1a',padding:'0 20px',flexShrink:0}}>
        {[{id:'live',l:'🔴 En vivo'},{id:'dia',l:'📋 Pedidos del día'},{id:'platos',l:'🍽️ Activar platos'}].map(t=>(
          <button key={t.id} onClick={()=>setActiveTab(t.id as any)}
            style={{padding:'10px 16px',background:'none',border:'none',borderBottom:`2px solid ${activeTab===t.id?'#22d3ee':'transparent'}`,color:activeTab===t.id?'#22d3ee':'#50506A',fontSize:12,fontWeight:700,cursor:'pointer',whiteSpace:'nowrap'}}>
            {t.l}
          </button>
        ))}
      </div>

      {/* ── EN VIVO ── */}
      {activeTab==='live' && (
        <div style={{flex:1,overflowY:'auto',padding:16}}>
          {loading && <div style={{textAlign:'center',padding:40,color:'#606060'}}>Cargando pedidos...</div>}

          {/* Alerta en fuego */}
          {enFuego.length>0 && (
            <div style={{background:'rgba(255,82,82,0.1)',border:'1px solid rgba(255,82,82,0.3)',borderRadius:12,padding:'10px 14px',marginBottom:12,display:'flex',alignItems:'center',gap:10}}>
              <span style={{fontSize:20}}>🔥</span>
              <div style={{flex:1}}>
                <div style={{fontSize:12,fontWeight:700,color:'#FF5252'}}>¡{enFuego.length} pedido{enFuego.length>1?'s':''} fuera de tiempo!</div>
                <div style={{fontSize:10,color:'#a0a0a0'}}>{enFuego.map(i=>`${getNombre(i)} (M${i.table_id})`).join(' · ')}</div>
              </div>
            </div>
          )}

          {!loading && items.length===0 && (
            <div style={{textAlign:'center',padding:60,color:'#606060'}}>
              <div style={{fontSize:48,marginBottom:12}}>✅</div>
              <div style={{fontSize:15,fontWeight:700}}>Cocina al día</div>
              <div style={{fontSize:12,marginTop:4}}>Sin pedidos activos en este momento</div>
            </div>
          )}

          {/* Grid por estación */}
          <div style={{display:'grid',gridTemplateColumns: filtroEstacion ? '1fr' : 'repeat(auto-fill,minmax(280px,1fr))',gap:12}}>
            {Object.entries(ESTACIONES).map(([slug,est])=>{
              // Si hay filtro activo, solo mostrar la estación seleccionada
              if (filtroEstacion && filtroEstacion !== slug) return null;
              const estItems = items.filter(i => getStation(i) === slug);
              return (
                <div key={slug} style={{background:'#0f0f1a',border:`1px solid rgba(255,255,255,0.07)`,borderRadius:14,overflow:'hidden'}}>
                  {/* Header estación */}
                  <div style={{padding:'8px 12px',borderBottom:`1px solid ${est.color}30`,background:`${est.color}10`,display:'flex',alignItems:'center',gap:8}}>
                    <span style={{fontSize:18}}>{est.emoji}</span>
                    <span style={{fontSize:12,fontWeight:700,color:est.color,textTransform:'uppercase'}}>{slug.replace('_',' ')}</span>
                    <span style={{marginLeft:'auto',fontSize:10,background:`${est.color}20`,color:est.color,padding:'2px 8px',borderRadius:20,fontWeight:700}}>{estItems.length} pedido{estItems.length!==1?'s':''}</span>
                  </div>

                  {estItems.length===0 && (
                    <div style={{padding:'16px',textAlign:'center',color:'#50506A',fontSize:11}}>Sin pedidos activos</div>
                  )}

                  {/* Cards de pedidos */}
                  {estItems.map(item=>{
                    const isPending   = item.status==='pending';
                    const isPreparing = item.status==='preparing';
                    const tiempoPedido = tseconds(item.created_at);
                    const tiempoProd   = item.tiempo_inicio ? tseconds(item.tiempo_inicio) : 0;
                    const objetivoSeg  = est.objetivo;
                    const pct          = item.tiempo_inicio ? Math.min(100,Math.round(tiempoProd/objetivoSeg*100)) : 0;

                    // ── Semáforo verde/amarillo/rojo ──
                    const esEnFuego  = (isPending && tiempoPedido>objetivoSeg*1.5)
                                    || (isPreparing && tiempoProd>objetivoSeg);
                    const mesaEnRetraso = !!(item.table_id && mesasConRetraso.has(item.table_id) && (item.estacion||getStation(item)) !== 'cocina_caliente');
                    const esAmarillo = !esEnFuego && ((isPending && tiempoPedido>objetivoSeg*0.8)||(isPreparing && tiempoProd>objetivoSeg*0.7)||mesaEnRetraso);
                    const barColor = pct>=100?'#FF5252':pct>=70?'#FFB547':est.color;
                    const tiempoVisible = isPreparing ? tiempoProd : tiempoPedido;
                    const tiempoLabel   = isPreparing ? 'producción' : 'en espera';

                    return (
                      <div key={item.id} style={{
                        margin:8,
                        background: esEnFuego?'rgba(255,82,82,0.08)':esAmarillo?'rgba(255,181,71,0.06)':'rgba(255,255,255,0.03)',
                        border:`1px solid ${esEnFuego?'rgba(255,82,82,0.45)':esAmarillo?'rgba(255,181,71,0.35)':isPreparing?`${est.color}40`:'rgba(255,255,255,0.07)'}`,
                        borderLeft:`4px solid ${esEnFuego||esAmarillo?sColor:getMesaColor(item.table_id).color}`,
                        borderRadius:10,padding:'10px 12px',
                      }}>
                        <div style={{display:'flex',alignItems:'flex-start',justifyContent:'space-between',gap:8,marginBottom:6}}>
                          <div style={{flex:1,minWidth:0}}>
                            <div style={{fontSize:13,fontWeight:700,color:'#f0f0f0',display:'flex',alignItems:'center',gap:6,flexWrap:'wrap'}}>
                              {esEnFuego && <span>🔥</span>}
        {item.status==='ready' && !esEnFuego && <span style={{fontSize:11,background:'rgba(0,230,118,0.15)',color:'#00E676',padding:'1px 6px',borderRadius:10,fontWeight:700}}>🟢 LISTO</span>}
                    {mesaEnRetraso && !esEnFuego && <span title='Cocina caliente retrasada en esta mesa' style={{fontSize:11}}>🍳⚠️</span>}
                              {esAmarillo && !esEnFuego && <span>⚠️</span>}
                              <span style={{flex:1}}>{getNombre(item)}</span>
                              {item.quantity>1 && <span style={{fontSize:10,background:'rgba(255,255,255,0.1)',padding:'1px 6px',borderRadius:10}}>×{item.quantity}</span>}
                            </div>
                            <div style={{display:'flex',gap:6,marginTop:3,flexWrap:'wrap'}}>
                              {item.table_id && (() => { const mc = getMesaColor(item.table_id); return <span style={{fontSize:10,background:mc.bg,color:mc.color,border:`1px solid ${mc.color}40`,padding:'1px 7px',borderRadius:20,fontWeight:700}}>M{item.table_id}</span>}
                              {item.mesero   && <span style={{fontSize:9,color:'#6b7280'}}>👤 {item.mesero.split(' ')[0]}</span>}
                              {item.cocinero && <span style={{fontSize:9,color:est.color}}>👨‍🍳 {item.cocinero.split(' ').slice(-1)[0]}</span>}
                            </div>
                          </div>

                          {/* CRONÓMETRO PROMINENTE */}
                          <div style={{flexShrink:0,textAlign:'center',background:`${sColor}15`,border:`1px solid ${sColor}40`,borderRadius:10,padding:'5px 10px',minWidth:58}}>
                            <div style={{fontFamily:"'Syne',sans-serif",fontSize:22,fontWeight:900,color:sColor,lineHeight:1}}>
                              {fmtTime(tiempoVisible)}
                            </div>
                            <div style={{fontSize:8,color:'#6b7280',marginTop:1,textTransform:'uppercase',letterSpacing:'.05em'}}>
                              {tiempoLabel}
                            </div>
                          </div>
                        </div>

                        {/* Barra progreso vs objetivo */}
                        {item.tiempo_inicio && (
                          <>
                            <div style={{display:'flex',justifyContent:'space-between',fontSize:8,color:'#50506A',marginBottom:2}}>
                              <span>Objetivo {fmtTime(objetivoSeg)}</span>
                              <span style={{color:barColor,fontWeight:700}}>{pct}%</span>
                            </div>
                            <div style={{height:4,background:'rgba(255,255,255,0.06)',borderRadius:2,overflow:'hidden',marginBottom:8}}>
                              <div style={{height:'100%',width:`${pct}%`,background:`linear-gradient(90deg,${est.color},${barColor})`,borderRadius:2,transition:'width 1s linear'}}/>
                            </div>
                          </>
                        )}
        {/* ── BOTONES 3 PASOS ── */}
        <div style={{display:'flex',gap:6,marginTop:6}}>
        {isPending && (
          <button onClick={async()=>{
            await updateStatus(item.id,'preparing');
            supabase.from('nexum_notificaciones').insert({restaurante_id:6,tipo:'preparacion_iniciada',titulo:`🍳 ${getNombre(item)} en preparación`,mensaje:`Mesa ${item.table_id} — ${getStation(item)} — Iniciado`,urgente:false,leida:false,destinatario_nombre:item.mesero||null}).then(()=>{}).catch(()=>{});
          }}
          style={{flex:1,padding:'8px 6px',borderRadius:9,border:`1px solid ${est.color}60`,background:`${est.color}18`,color:est.color,fontSize:11,fontWeight:700,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',gap:4}}>
            🍳 Comenzar preparación
          </button>
        )}
        {item.status==='preparing' && (
          <button onClick={async()=>{
            await updateStatus(item.id,'ready');
            supabase.from('nexum_notificaciones').insert({restaurante_id:6,tipo:'plato_casi_listo',titulo:`🟡 ${getNombre(item)} casi listo`,mensaje:`Mesa ${item.table_id} — Prepárate para retirar en ~2min`,urgente:false,leida:false,destinatario_nombre:item.mesero||null}).then(()=>{}).catch(()=>{});
          }}
          style={{flex:1,padding:'8px 6px',borderRadius:9,border:'1px solid rgba(255,181,71,0.6)',background:'rgba(255,181,71,0.15)',color:'#FFB547',fontSize:11,fontWeight:700,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',gap:4}}>
            🟡 Prepárate para venir
          </button>
        )}
        {item.status==='ready' && (
          <button onClick={async()=>{
            await updateStatus(item.id,'served');
            supabase.from('nexum_notificaciones').insert({restaurante_id:6,tipo:'plato_listo',titulo:`✅ ${getNombre(item)} LISTO para entrega`,mensaje:`Mesa ${item.table_id} — ${fmtTime(tiempoProd)} producción — RETIRAR YA`,urgente:true,leida:false,destinatario_nombre:item.mesero||null}).then(()=>{}).catch(()=>{});
            supabase.from('flow_alertas').insert({restaurante_id:6,mesa_num:item.table_id,plato:getNombre(item),mesero:item.mesero||null,cocinero:item.cocinero||null,estacion:getStation(item),leida:false}).then(()=>{}).catch(()=>{});
          }}
          style={{flex:1,padding:'8px 6px',borderRadius:9,border:'1px solid rgba(0,230,118,0.6)',background:'rgba(0,230,118,0.15)',color:'#00E676',fontSize:12,fontWeight:900,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',gap:4,boxShadow:'0 0 10px rgba(0,230,118,0.2)'}}>
            ✅ Listo para entrega · {fmtTime(tiempoProd)}
          </button>
        )}
        </div>
                      </div>
                    );
                  })}
                </div>
              );
            }).filter(Boolean)}
          </div>
        </div>
      )}

      {/* ── PEDIDOS DEL DÍA ── */}
      {activeTab==='dia' && (
        <div style={{flex:1,overflow:'hidden',display:'flex',flexDirection:'column'}}>
          {/* Filtro status */}
          {/* ── MÉTRICAS DE TIEMPO DEL DÍA ── */}
          <div style={{padding:'12px 16px',borderBottom:'1px solid rgba(255,255,255,0.07)',flexShrink:0,background:'#0a0a14'}}>
            <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:10}}>
              <span style={{fontSize:11,fontWeight:700,color:'#22d3ee',textTransform:'uppercase',letterSpacing:'.08em'}}>⏱ Tiempos de producción — hoy</span>
              <span style={{fontSize:9,color:'#50506A',marginLeft:'auto'}}>
                {tiemposMetrica.length > 0 ? `${tiemposMetrica.reduce((s:number,m:any)=>s+(m.pedidos_dia||0),0)} platos medidos` : 'Se llenan al marcar ✅ Listo'}
              </span>
            </div>

            <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:8}}>
              {(tiemposMetrica.length > 0 ? tiemposMetrica : [
                {categoria:'Cocina',   estacion:'cocina_caliente', pedidos_dia:0, promedio_min:null, minimo_min:null, maximo_min:null, platos_ultima_hora:0},
                {categoria:'Entradas', estacion:'cocina_fria',     pedidos_dia:0, promedio_min:null, minimo_min:null, maximo_min:null, platos_ultima_hora:0},
                {categoria:'Bebidas',  estacion:'bar',             pedidos_dia:0, promedio_min:null, minimo_min:null, maximo_min:null, platos_ultima_hora:0},
                {categoria:'Postres',  estacion:'postres',         pedidos_dia:0, promedio_min:null, minimo_min:null, maximo_min:null, platos_ultima_hora:0},
              ]).map((m:any)=>{
                const sinDatos   = !m.promedio_min || m.pedidos_dia === 0;
                const prom       = m.promedio_min ? Math.round(m.promedio_min) : null;
                const colorProm  = sinDatos ? '#404040' : prom! <= 5 ? '#00E676' : prom! <= 10 ? '#FFB547' : '#FF5252';
                const EST_EMOJIS: Record<string,string> = {cocina_caliente:'🔥',cocina_fria:'🧊',robata:'🥩',bar:'🍸',cava:'🍷',postres:'🍮'};
                const CAT_EMOJIS: Record<string,string> = {Cocina:'🔥',Entradas:'🥗',Bebidas:'🍸',Postres:'🍮'};
                const emoji = EST_EMOJIS[m.estacion] || CAT_EMOJIS[m.categoria] || '🍽️';
                return (
                  <div key={m.estacion||m.categoria} style={{
                    background:'rgba(255,255,255,0.03)',
                    border:`1px solid ${colorProm}25`,
                    borderRadius:12, padding:'10px 11px',
                  }}>
                    {/* Header */}
                    <div style={{display:'flex',alignItems:'center',gap:5,marginBottom:7}}>
                      <span style={{fontSize:14}}>{emoji}</span>
                      <span style={{fontSize:9,color:'#a0a0a0',fontWeight:700,textTransform:'uppercase',letterSpacing:'.04em',whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>
                        {m.categoria}
                      </span>
                    </div>

                    {/* PROMEDIO — número grande */}
                    <div style={{marginBottom:7}}>
                      <div style={{fontSize:8,color:'#50506A',marginBottom:1,textTransform:'uppercase',letterSpacing:'.06em'}}>Promedio</div>
                      <div style={{fontFamily:"'Syne',sans-serif",fontSize:22,fontWeight:900,color:colorProm,lineHeight:1}}>
                        {sinDatos ? '—' : `${prom}`}
                        {!sinDatos && <span style={{fontSize:11,fontWeight:400,color:'#50506A',marginLeft:2}}>min</span>}
                      </div>
                    </div>

                    {/* MIN / MAX */}
                    <div style={{display:'flex',gap:6,marginBottom:7}}>
                      <div style={{flex:1}}>
                        <div style={{fontSize:7,color:'#50506A',textTransform:'uppercase',letterSpacing:'.05em'}}>Mín</div>
                        <div style={{fontSize:12,fontWeight:700,color:'#00E676'}}>
                          {sinDatos ? '—' : `${Math.round(m.minimo_min||0)}min`}
                        </div>
                      </div>
                      <div style={{flex:1}}>
                        <div style={{fontSize:7,color:'#50506A',textTransform:'uppercase',letterSpacing:'.05em'}}>Máx</div>
                        <div style={{fontSize:12,fontWeight:700,color:'#FF5252'}}>
                          {sinDatos ? '—' : `${Math.round(m.maximo_min||0)}min`}
                        </div>
                      </div>
                    </div>

                    {/* PLATOS DÍA / PLATOS HORA */}
                    <div style={{borderTop:'1px solid rgba(255,255,255,0.05)',paddingTop:6,display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                      <div>
                        <div style={{fontSize:7,color:'#50506A',textTransform:'uppercase',letterSpacing:'.04em'}}>Día</div>
                        <div style={{fontSize:13,fontWeight:900,color:'#a0a0a0',fontFamily:"'Syne',sans-serif"}}>{m.pedidos_dia||0}</div>
                      </div>
                      <div style={{textAlign:'right'}}>
                        <div style={{fontSize:7,color:'#50506A',textTransform:'uppercase',letterSpacing:'.04em'}}>Últ. hora</div>
                        <div style={{fontSize:13,fontWeight:900,color:'#22d3ee',fontFamily:"'Syne',sans-serif"}}>
                          {m.platos_ultima_hora||0}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div style={{padding:'10px 16px',borderBottom:'1px solid rgba(255,255,255,0.07)',display:'flex',gap:6,flexShrink:0}}>
            {[{v:'all',l:'Todos'},{v:'pending',l:'⏳ Pendiente'},{v:'preparing',l:'🍳 Prep.'},{v:'served',l:'✅ Listos'}].map(f=>(
              <button key={f.v} onClick={()=>setFiltroStatus(f.v)}
                style={{padding:'5px 12px',borderRadius:20,border:`1px solid ${filtroStatus===f.v?'#22d3ee':'rgba(255,255,255,0.1)'}`,background:filtroStatus===f.v?'rgba(34,211,238,0.1)':'transparent',color:filtroStatus===f.v?'#22d3ee':'#50506A',fontSize:11,fontWeight:700,cursor:'pointer'}}>
                {f.l}
              </button>
            ))}
            <span style={{marginLeft:'auto',fontSize:11,color:'#50506A',alignSelf:'center'}}>{pedidosDia.length} pedidos hoy</span>
          </div>

          <div style={{flex:1,overflowY:'auto'}}>
            <table style={{width:'100%',borderCollapse:'collapse',fontSize:12}}>
              <thead>
                <tr style={{background:'#0f0f1a',position:'sticky',top:0,zIndex:5}}>
                  {['Plato','Mesa','Estación','Mesero','Estado','🕐 Pedido','▶ Inicio','✅ Listo','⏱ Producción'].map(h=>(
                    <th key={h} style={{padding:'8px 12px',textAlign:'left',fontSize:10,color:'#50506A',fontWeight:700,textTransform:'uppercase',letterSpacing:'.06em',borderBottom:'1px solid rgba(255,255,255,0.07)',whiteSpace:'nowrap'}}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {pedidosDia.filter(i=>filtroStatus==='all'||i.status===filtroStatus).map((item,idx)=>{
                  const est = ESTACIONES[getStation(item)];
                  const objetivo = est?.objetivo || 480;

                  // Tiempos en vivo
                  const tiempoPedidoSeg = Math.floor((now - new Date(item.created_at).getTime()) / 1000);
                  const tiempoProdSeg   = item.tiempo_inicio
                    ? Math.floor((now - new Date(item.tiempo_inicio).getTime()) / 1000)
                    : 0;
                  const tiempoFinalSeg  = (item as any).duracion_seg || 0;

                  const produccionSeg = tiempoFinalSeg > 0 ? tiempoFinalSeg
                                      : item.status === 'preparing' && tiempoProdSeg > 0 ? tiempoProdSeg
                                      : item.status === 'pending' ? tiempoPedidoSeg
                                      : 0;

                  const colorProd = tiempoFinalSeg > 0
                    ? (tiempoFinalSeg <= objetivo ? '#00E676' : tiempoFinalSeg <= objetivo*1.3 ? '#FFB547' : '#FF5252')
                    : item.status === 'preparing'
                    ? (tiempoProdSeg <= objetivo*0.7 ? est?.color||'#22d3ee' : tiempoProdSeg <= objetivo ? '#FFB547' : '#FF5252')
                    : '#606060';

                  const esVivo = tiempoFinalSeg === 0 && item.status !== 'served';

                  const fmtHora = (iso:string|null|undefined) => {
                    if (!iso) return '—';
                    return new Date(iso).toLocaleTimeString('es-CO',{hour:'2-digit',minute:'2-digit',second:'2-digit',hour12:false});
                  };

                  return (
                    <tr key={item.id} style={{background:idx%2===0?'#08080f':'#0f0f1a',borderBottom:'1px solid rgba(255,255,255,0.03)'}}>
                      <td style={{padding:'9px 12px',fontWeight:600,color:'#f0f0f0',maxWidth:160,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{getNombre(item)}</td>
                      <td style={{padding:'9px 12px'}}>
                        {item.table_id ? <span style={{background:`${est?.color||'#448AFF'}20`,color:est?.color||'#448AFF',padding:'2px 8px',borderRadius:20,fontSize:10,fontWeight:700}}>M{item.table_id}</span> : '—'}
                      </td>
                      <td style={{padding:'9px 12px'}}>
                        <span style={{fontSize:11,color:est?.color||'#a0a0a0'}}>{est?.emoji||'🍽️'} {getStation(item).replace('_',' ')}</span>
                      </td>
                      <td style={{padding:'9px 12px',color:'#a0a0a0',fontSize:11}}>{item.mesero||'—'}</td>
                      <td style={{padding:'9px 12px'}}>
                        <span style={{fontSize:10,background:item.status==='served'?'rgba(0,230,118,0.15)':item.status==='preparing'?`${est?.color||'#448AFF'}20`:'rgba(255,255,255,0.05)',color:item.status==='served'?'#00E676':item.status==='preparing'?(est?.color||'#448AFF'):'#6b7280',padding:'2px 8px',borderRadius:20,fontWeight:700}}>
                          {item.status==='served'?'✅':item.status==='preparing'?'🍳':'⏳'}
                        </span>
                      </td>

                      {/* 🕐 HORA PEDIDO */}
                      <td style={{padding:'9px 12px'}}>
                        <div style={{fontSize:11,color:'#a0a0a0',fontFamily:'monospace'}}>{fmtHora(item.created_at)}</div>
                      </td>

                      {/* ▶ HORA INICIO PRODUCCIÓN */}
                      <td style={{padding:'9px 12px'}}>
                        {item.tiempo_inicio ? (
                          <div style={{fontSize:11,color:est?.color||'#22d3ee',fontFamily:'monospace'}}>{fmtHora(item.tiempo_inicio)}</div>
                        ) : (
                          <span style={{fontSize:11,color:'#404040'}}>—</span>
                        )}
                      </td>

                      {/* ✅ HORA LISTO */}
                      <td style={{padding:'9px 12px'}}>
                        {(item as any).tiempo_listo ? (
                          <div style={{fontSize:11,color:'#00E676',fontFamily:'monospace'}}>{fmtHora((item as any).tiempo_listo)}</div>
                        ) : esVivo ? (
                          <span style={{fontSize:11,color:'#FFB547',display:'inline-flex',alignItems:'center',gap:3}}>
                            <span style={{width:5,height:5,borderRadius:'50%',background:'#FFB547',display:'inline-block'}}/>
                            {fmtTime(produccionSeg)}
                          </span>
                        ) : (
                          <span style={{fontSize:11,color:'#404040'}}>—</span>
                        )}
                      </td>

                      {/* ⏱ PRODUCCIÓN TOTAL */}
                      <td style={{padding:'9px 12px'}}>
                        {tiempoFinalSeg > 0 ? (
                          <div style={{display:'flex',alignItems:'center',gap:5}}>
                            <span style={{fontSize:12,fontWeight:900,color:colorProd,background:`${colorProd}15`,padding:'2px 10px',borderRadius:20}}>
                              {fmtTime(tiempoFinalSeg)}
                            </span>
                            <span style={{fontSize:9,color:'#50506A'}}>/{fmtTime(objetivo)}</span>
                          </div>
                        ) : esVivo ? (
                          <span style={{fontSize:12,fontWeight:700,color:colorProd,background:`${colorProd}12`,padding:'2px 10px',borderRadius:20,display:'inline-flex',alignItems:'center',gap:4}}>
                            <span style={{width:5,height:5,borderRadius:'50%',background:colorProd,animation:'pulse 1s infinite',display:'inline-block'}}/>
                            {fmtTime(produccionSeg)}
                          </span>
                        ) : (
                          <span style={{fontSize:11,color:'#404040'}}>—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {pedidosDia.filter(i=>filtroStatus==='all'||i.status===filtroStatus).length===0 && (
              <div style={{textAlign:'center',padding:40,color:'#606060'}}>Sin pedidos para este filtro</div>
            )}
          </div>
        </div>
      )}

      {/* ── TAB PLATOS DEL DÍA ── */}
      {activeTab==='platos' && (
        <div style={{flex:1,overflowY:'auto'}}>
          <PlatosDiaManager />
        </div>
      )}

    </div>
  );
}

// ══ GESTOR DE PLATOS DEL DÍA ══════════════════════════════════════════
import { supabase as _sb } from '../lib/supabase.ts';
function PlatosDiaManager() {
  const [platos, setPlatos] = React.useState<any[]>([]);
  const [form, setForm] = React.useState({nombre:'',emoji:'🍽️',precio:'',estacion:'cocina_caliente',rentable:true});
  const EMOJIS = ['🍽️','🥩','🍜','🐟','🦐','🥗','🍱','🍣','🍷','🍸','🎂'];
  const ESTS: Record<string,string> = {
    cocina_caliente:'🔥 Cocina caliente',cocina_fria:'🧊 Cocina fría',
    bar:'🍸 Bar',cava:'🍷 Cava',robata:'🥩 Robata',postres:'🎂 Postres',
  };

  const fetchPlatos = async () => {
    const { data } = await _sb.from('platos_dia').select('*').eq('restaurante_id',6).eq('activo',true).eq('fecha',new Date().toISOString().split('T')[0]).order('created_at',{ascending:false});
    if (data) setPlatos(data);
  };
  React.useEffect(()=>{ fetchPlatos(); },[]);

  const agregar = async () => {
    if (!form.nombre) return;
    await _sb.from('platos_dia').insert({restaurante_id:6,nombre:form.nombre,emoji:form.emoji,precio:form.precio,estacion:form.estacion,rentable:form.rentable,disponible:true,fecha:new Date().toISOString().split('T')[0]});
    setForm({nombre:'',emoji:'🍽️',precio:'',estacion:'cocina_caliente',rentable:true});
    fetchPlatos();
  };
  const toggle86 = async (id:string,disp:boolean) => { await _sb.from('platos_dia').update({disponible:!disp}).eq('id',id); fetchPlatos(); };
  const eliminar = async (id:string) => { await _sb.from('platos_dia').update({activo:false}).eq('id',id); fetchPlatos(); };

  return (
    <div style={{padding:'16px 20px',flex:1,overflowY:'auto'}}>
      <div style={{fontFamily:"'Syne',sans-serif",fontSize:15,fontWeight:900,marginBottom:4}}>🍽️ Platos del día</div>
      <div style={{fontSize:11,color:'#50506A',marginBottom:16}}>Los platos activos aparecen en el panel IA del POS en tiempo real. El 86 los tacha para todos los meseros.</div>
      {/* Formulario */}
      <div style={{background:'rgba(255,255,255,0.03)',border:'1px solid rgba(255,255,255,0.08)',borderRadius:14,padding:14,marginBottom:16}}>
        <div style={{fontSize:12,fontWeight:700,marginBottom:10,color:'#f0f0f0'}}>+ Agregar plato del Chef</div>
        <div style={{display:'flex',gap:4,flexWrap:'wrap',marginBottom:8}}>
          {EMOJIS.map(e=><button key={e} onClick={()=>setForm(p=>({...p,emoji:e}))} style={{width:32,height:32,borderRadius:8,border:`1px solid ${form.emoji===e?'#d4943a':'rgba(255,255,255,0.1)'}`,background:form.emoji===e?'rgba(212,148,58,0.2)':'transparent',fontSize:18,cursor:'pointer'}}>{e}</button>)}
        </div>
        <div style={{display:'flex',gap:8,marginBottom:8,flexWrap:'wrap'}}>
          <input value={form.nombre} onChange={e=>setForm(p=>({...p,nombre:e.target.value}))} placeholder="Nombre del plato *" style={{flex:2,padding:'9px 12px',borderRadius:8,border:'1px solid rgba(255,255,255,0.12)',background:'rgba(255,255,255,0.05)',color:'#fff',fontSize:13,outline:'none',minWidth:140}}/>
          <input value={form.precio} onChange={e=>setForm(p=>({...p,precio:e.target.value}))} placeholder="Ej: $185k" style={{flex:1,padding:'9px 12px',borderRadius:8,border:'1px solid rgba(255,255,255,0.12)',background:'rgba(255,255,255,0.05)',color:'#fff',fontSize:13,outline:'none',minWidth:80}}/>
        </div>
        <div style={{display:'flex',gap:8,alignItems:'center',flexWrap:'wrap'}}>
          <select value={form.estacion} onChange={e=>setForm(p=>({...p,estacion:e.target.value}))} style={{flex:1,padding:'9px 12px',borderRadius:8,border:'1px solid rgba(255,255,255,0.12)',background:'rgba(255,255,255,0.05)',color:'#fff',fontSize:12,outline:'none'}}>
            {Object.entries(ESTS).map(([k,v])=><option key={k} value={k}>{v}</option>)}
          </select>
          <label style={{display:'flex',alignItems:'center',gap:6,fontSize:11,color:'#a0a0a0',cursor:'pointer'}}>
            <input type="checkbox" checked={form.rentable} onChange={e=>setForm(p=>({...p,rentable:e.target.checked}))}/> Alta rentabilidad
          </label>
          <button onClick={agregar} style={{padding:'9px 18px',borderRadius:8,border:'none',background:'linear-gradient(135deg,#d4943a,#b07820)',color:'#000',fontSize:12,fontWeight:700,cursor:'pointer'}}>✓ Agregar</button>
        </div>
      </div>
      {/* Lista */}
      {platos.length === 0 ? (
        <div style={{textAlign:'center',padding:40,color:'#50506A'}}><div style={{fontSize:40,marginBottom:10}}>🍽️</div><div>Sin platos activos hoy</div><div style={{fontSize:11,marginTop:6}}>Agrega los especiales del Chef arriba</div></div>
      ) : (
        <div style={{display:'flex',flexDirection:'column',gap:8}}>
          {platos.map((p:any)=>(
            <div key={p.id} style={{display:'flex',alignItems:'center',gap:10,background:p.disponible?'rgba(255,255,255,0.03)':'rgba(255,82,82,0.06)',border:`1px solid ${p.disponible?'rgba(255,255,255,0.08)':'rgba(255,82,82,0.3)'}`,borderRadius:10,padding:'10px 14px'}}>
              <span style={{fontSize:22}}>{p.emoji||'🍽️'}</span>
              <div style={{flex:1}}>
                <div style={{fontSize:13,fontWeight:700,color:p.disponible?'#f0f0f0':'#606060',textDecoration:p.disponible?'none':'line-through'}}>{p.nombre}</div>
                <div style={{display:'flex',gap:8,marginTop:2,flexWrap:'wrap'}}>
                  {p.precio&&<span style={{fontSize:10,color:'#d4943a'}}>{p.precio}</span>}
                  <span style={{fontSize:10,color:'#606060'}}>{ESTS[p.estacion]||p.estacion}</span>
                  {p.rentable&&<span style={{fontSize:9,color:'#3dba6f',background:'rgba(61,186,111,0.12)',padding:'1px 6px',borderRadius:10}}>● Rentable</span>}
                </div>
              </div>
              {!p.disponible&&<span style={{fontSize:10,color:'#FF5252',fontWeight:700,background:'rgba(255,82,82,0.12)',padding:'2px 8px',borderRadius:10}}>86</span>}
              <div style={{display:'flex',gap:6,flexShrink:0}}>
                <button onClick={()=>toggle86(p.id,p.disponible)} style={{padding:'5px 10px',borderRadius:7,border:`1px solid ${p.disponible?'rgba(255,82,82,0.4)':'rgba(61,186,111,0.4)'}`,background:'transparent',color:p.disponible?'#FF5252':'#3dba6f',fontSize:10,fontWeight:700,cursor:'pointer'}}>{p.disponible?'86':'✓ Ok'}</button>
                <button onClick={()=>eliminar(p.id)} style={{padding:'5px 8px',borderRadius:7,border:'1px solid rgba(255,255,255,0.1)',background:'transparent',color:'#606060',fontSize:10,cursor:'pointer'}}>🗑</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
