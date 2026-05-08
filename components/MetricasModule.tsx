import React, { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../lib/supabase.ts';

// ── KDS Avanzado — Multiestación con tiempos y alertas ──────────────────────

const ESTACIONES: Record<string, {color:string; emoji:string; objetivo:number}> = {
  cocina_caliente: { color:'#FF5252', emoji:'🔥', objetivo:480 },
  cocina_fria:     { color:'#22d3ee', emoji:'🧊', objetivo:360 },
  robata:          { color:'#FF9800', emoji:'🥩', objetivo:600 },
  postres:         { color:'#B388FF', emoji:'🍮', objetivo:300 },
  bar:             { color:'#448AFF', emoji:'🍸', objetivo:180 },
  cava:            { color:'#FFB547', emoji:'🍷', objetivo:120 },
};

interface FlowItem {
  id:string; order_id:string;
  status:'pending'|'preparing'|'served';
  quantity:number; notes:string|null; nombre_plato?:string|null;
  created_at:string; updated_at:string; tiempo_inicio?:string|null;
  table_id:number|null; menu_name:string|null; category:string|null;
  mesero?:string|null; estacion?:string|null; cocinero?:string|null;
}

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
  const [activeTab, setActiveTab] = useState<'live'|'dia'>('live');
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
      .select('id,order_id,status,quantity,notes,nombre_plato,created_at,updated_at,tiempo_inicio,mesero,estacion,cocinero,precio_unitario:price_at_time')
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
      .select('id,order_id,status,quantity,notes,nombre_plato,created_at,updated_at,tiempo_inicio,mesero,estacion,cocinero,precio_unitario:price_at_time')
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
    const updates:any = { status, updated_at:now_ts };
    if (status==='preparing') updates.tiempo_inicio = now_ts;
    if (status==='served') {
      updates.tiempo_listo = now_ts;
      const item = items.find(i=>i.id===id);
      if (item?.tiempo_inicio) {
        const dur = Math.floor((new Date(now_ts).getTime()-new Date(item.tiempo_inicio).getTime())/1000);
        updates.duracion_seg = dur>0?dur:null;
      }
    }
    await supabase.from('order_items').update(updates).eq('id',id);

    if (status==='served') {
      const item = items.find(i=>i.id===id);
      if (item) {
        await supabase.from('flow_alertas').insert({
          restaurante_id:6, mesa_num:item.table_id,
          plato:getNombre(item), mesero:item.mesero||null,
          cocinero:item.cocinero||null, estacion:item.estacion||getStation(item), leida:false,
        });
      }
    }
  };

  // Agrupar por estación
  const byEstacion = Object.keys(ESTACIONES).reduce((acc, est) => {
    acc[est] = items.filter(i => getStation(i)===est && (!filtroEstacion||filtroEstacion===est));
    return acc;
  }, {} as Record<string,FlowItem[]>);

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
        {[{id:'live',l:'🔴 En vivo'},{id:'dia',l:'📋 Pedidos del día'}].map(t=>(
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
                    const esAmarillo = !esEnFuego && (
                                       (isPending   && tiempoPedido>objetivoSeg*0.8)
                                    || (isPreparing && tiempoProd>objetivoSeg*0.7));
                    const sColor = esEnFuego ? '#FF5252' : esAmarillo ? '#FFB547' : isPreparing ? '#00E676' : est.color;
                    const barColor = pct>=100?'#FF5252':pct>=70?'#FFB547':est.color;
                    const tiempoVisible = isPreparing ? tiempoProd : tiempoPedido;
                    const tiempoLabel   = isPreparing ? 'producción' : 'en espera';

                    return (
                      <div key={item.id} style={{
                        margin:8,
                        background: esEnFuego?'rgba(255,82,82,0.08)':esAmarillo?'rgba(255,181,71,0.06)':'rgba(255,255,255,0.03)',
                        border:`1px solid ${esEnFuego?'rgba(255,82,82,0.45)':esAmarillo?'rgba(255,181,71,0.35)':isPreparing?`${est.color}40`:'rgba(255,255,255,0.07)'}`,
                        borderLeft:`3px solid ${sColor}`,
                        borderRadius:10,padding:'10px 12px',
                      }}>
                        <div style={{display:'flex',alignItems:'flex-start',justifyContent:'space-between',gap:8,marginBottom:6}}>
                          <div style={{flex:1,minWidth:0}}>
                            <div style={{fontSize:13,fontWeight:700,color:'#f0f0f0',display:'flex',alignItems:'center',gap:6,flexWrap:'wrap'}}>
                              {esEnFuego && <span>🔥</span>}
                              {esAmarillo && !esEnFuego && <span>⚠️</span>}
                              <span style={{flex:1}}>{getNombre(item)}</span>
                              {item.quantity>1 && <span style={{fontSize:10,background:'rgba(255,255,255,0.1)',padding:'1px 6px',borderRadius:10}}>×{item.quantity}</span>}
                            </div>
                            <div style={{display:'flex',gap:6,marginTop:3,flexWrap:'wrap'}}>
                              {item.table_id && <span style={{fontSize:10,background:`${est.color}20`,color:est.color,padding:'1px 7px',borderRadius:20,fontWeight:700}}>M{item.table_id}</span>}
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

                        {/* Botones */}
                        <div style={{display:'flex',gap:6}}>
                          {isPending && (
                            <button onClick={()=>updateStatus(item.id,'preparing')}
                              style={{flex:1,padding:'7px',borderRadius:8,border:`1px solid ${est.color}50`,background:`${est.color}15`,color:est.color,fontSize:11,fontWeight:700,cursor:'pointer'}}>
                              🍳 Comenzar
                            </button>
                          )}
                          {isPreparing && (
                            <button onClick={()=>updateStatus(item.id,'served')}
                              style={{flex:1,padding:'7px',borderRadius:8,border:'1px solid rgba(0,230,118,0.5)',background:'rgba(0,230,118,0.15)',color:'#00E676',fontSize:11,fontWeight:700,cursor:'pointer'}}>
                              ✅ ¡Listo! — {fmtTime(tiempoProd)}
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
                  {['Plato','Mesa','Estación','Mesero','Cocinero','Estado','Pedido','Producción','Tiempo real'].map(h=>(
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

                  // ── Tiempos en vivo usando estado `now` (se actualiza cada 1s) ──
                  const tiempoPedidoSeg = Math.floor((now - new Date(item.created_at).getTime()) / 1000);
                  const tiempoProdSeg   = item.tiempo_inicio
                    ? Math.floor((now - new Date(item.tiempo_inicio).getTime()) / 1000)
                    : 0;
                  const tiempoFinalSeg  = (item as any).duracion_seg || 0;

                  // Producción: si ya terminó → tiempo real guardado; si está en curso → cronómetro vivo
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

                  return (
                    <tr key={item.id} style={{background:idx%2===0?'#08080f':'#0f0f1a',borderBottom:'1px solid rgba(255,255,255,0.03)'}}>
                      <td style={{padding:'9px 12px',fontWeight:600,color:'#f0f0f0'}}>{getNombre(item)}</td>
                      <td style={{padding:'9px 12px'}}>
                        {item.table_id ? <span style={{background:`${est?.color||'#448AFF'}20`,color:est?.color||'#448AFF',padding:'2px 8px',borderRadius:20,fontSize:10,fontWeight:700}}>M{item.table_id}</span> : '—'}
                      </td>
                      <td style={{padding:'9px 12px'}}>
                        <span style={{fontSize:11,color:est?.color||'#a0a0a0'}}>{est?.emoji||'🍽️'} {getStation(item).replace('_',' ')}</span>
                      </td>
                      <td style={{padding:'9px 12px',color:'#a0a0a0',fontSize:11}}>{item.mesero||'—'}</td>
                      <td style={{padding:'9px 12px',color:'#a0a0a0',fontSize:11}}>{item.cocinero||'—'}</td>
                      <td style={{padding:'9px 12px'}}>
                        <span style={{fontSize:10,background:item.status==='served'?'rgba(0,230,118,0.15)':item.status==='preparing'?`${est?.color||'#448AFF'}20`:'rgba(255,255,255,0.05)',color:item.status==='served'?'#00E676':item.status==='preparing'?(est?.color||'#448AFF'):'#6b7280',padding:'2px 8px',borderRadius:20,fontWeight:700}}>
                          {item.status==='served'?'✅ Listo':item.status==='preparing'?'🍳 Prep.':'⏳ Pendiente'}
                        </span>
                      </td>
                      <td style={{padding:'9px 12px',color:'#606060',fontSize:11}}>
                        {new Date(item.created_at).toLocaleTimeString('es-CO',{hour:'2-digit',minute:'2-digit',hour12:true})}
                      </td>

                      {/* PRODUCCIÓN — cronómetro vivo o tiempo final */}
                      <td style={{padding:'9px 12px'}}>
                        <span style={{
                          fontSize:12, fontWeight:700, color:colorProd,
                          background:`${colorProd}12`,
                          padding:'2px 10px', borderRadius:20,
                          display:'inline-flex', alignItems:'center', gap:4,
                        }}>
                          {esVivo && <span style={{width:5,height:5,borderRadius:'50%',background:colorProd,display:'inline-block',animation:'pulse 1s infinite'}}/>}
                          {produccionSeg > 0 ? fmtTime(produccionSeg) : '—'}
                        </span>
                      </td>

                      {/* TIEMPO REAL — solo si ya terminó, con objetivo */}
                      <td style={{padding:'9px 12px'}}>
                        {tiempoFinalSeg > 0 ? (
                          <div style={{display:'flex',alignItems:'center',gap:6}}>
                            <span style={{fontSize:12,fontWeight:700,color:colorProd}}>{fmtTime(tiempoFinalSeg)}</span>
                            <span style={{fontSize:9,color:'#50506A'}}>/ {fmtTime(objetivo)}</span>
                          </div>
                        ) : item.status === 'preparing' ? (
                          <span style={{fontSize:11,color:'#FFB547',fontWeight:600}}>⏳ en curso</span>
                        ) : (
                          <span style={{fontSize:11,color:'#50506A'}}>—</span>
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
    </div>
  );
}
