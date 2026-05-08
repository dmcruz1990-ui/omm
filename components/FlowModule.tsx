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
const fmtTime = (s:number) => s<60?`${s}s`:`${Math.floor(s/60)}m ${s%60}s`;

export default function FlowModule() {
  const [items, setItems] = useState<FlowItem[]>([]);
  const [pedidosDia, setPedidosDia] = useState<FlowItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [now, setNow] = useState(Date.now());
  const [activeTab, setActiveTab] = useState<'live'|'dia'>('live');
  const [filtroEstacion, setFiltroEstacion] = useState<string|null>(null);
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
                    const isPending  = item.status==='pending';
                    const isPreparing= item.status==='preparing';
                    const tiempoPedido = tseconds(item.created_at);
                    const tiempoProd  = item.tiempo_inicio ? tseconds(item.tiempo_inicio) : 0;
                    const objetivoSeg = est.objetivo;
                    const pct = item.tiempo_inicio ? Math.min(100,Math.round(tiempoProd/objetivoSeg*100)) : 0;
                    const esEnFuego = (isPending && tiempoPedido>objetivoSeg*1.5) || (isPreparing && tiempoProd>objetivoSeg);
                    const barColor  = pct>=100?'#FF5252':pct>=70?'#FFB547':est.color;

                    return (
                      <div key={item.id} style={{margin:8,background:esEnFuego?'rgba(255,82,82,0.07)':'rgba(255,255,255,0.03)',border:`1px solid ${esEnFuego?'rgba(255,82,82,0.4)':isPreparing?`${est.color}40`:'rgba(255,255,255,0.07)'}`,borderRadius:10,padding:'10px 12px'}}>
                        <div style={{display:'flex',alignItems:'flex-start',justifyContent:'space-between',gap:8,marginBottom:6}}>
                          <div style={{flex:1}}>
                            <div style={{fontSize:13,fontWeight:700,color:'#f0f0f0',display:'flex',alignItems:'center',gap:6}}>
                              {esEnFuego && <span style={{fontSize:14}}>🔥</span>}
                              {getNombre(item)}
                              {item.quantity>1 && <span style={{fontSize:10,background:'rgba(255,255,255,0.1)',padding:'1px 6px',borderRadius:10}}>×{item.quantity}</span>}
                            </div>
                            {/* Mesa + mesero */}
                            <div style={{display:'flex',gap:6,marginTop:3,flexWrap:'wrap'}}>
                              {item.table_id && <span style={{fontSize:10,background:`${est.color}20`,color:est.color,padding:'1px 7px',borderRadius:20,fontWeight:700}}>M{item.table_id}</span>}
                              {item.mesero && <span style={{fontSize:9,color:'#6b7280'}}>👤 {item.mesero.split(' ')[0]}</span>}
                              {item.cocinero && <span style={{fontSize:9,color:est.color}}>👨‍🍳 {item.cocinero.split(' ').slice(-1)[0]}</span>}
                            </div>
                          </div>
                          {/* Status badge */}
                          <span style={{fontSize:9,fontWeight:700,padding:'3px 8px',borderRadius:20,background:isPending?'rgba(255,255,255,0.05)':isPreparing?`${est.color}20`:'rgba(0,230,118,0.15)',color:isPending?'#6b7280':isPreparing?est.color:'#00E676',whiteSpace:'nowrap'}}>
                            {isPending?'⏳ Pendiente':isPreparing?'🍳 Preparando':'✅ Listo'}
                          </span>
                        </div>

                        {/* Tiempos */}
                        <div style={{display:'flex',gap:8,marginBottom:8,flexWrap:'wrap'}}>
                          <span style={{fontSize:10,color:'#6b7280',display:'flex',alignItems:'center',gap:3}}>
                            🕐 {fmtTime(tiempoPedido)}
                          </span>
                          {item.tiempo_inicio && (
                            <span style={{fontSize:10,color:barColor,fontWeight:700,display:'flex',alignItems:'center',gap:3}}>
                              🍳 {fmtTime(tiempoProd)} / {fmtTime(objetivoSeg)}
                            </span>
                          )}
                        </div>

                        {/* Barra de progreso */}
                        {item.tiempo_inicio && (
                          <div style={{height:3,background:'rgba(255,255,255,0.06)',borderRadius:2,overflow:'hidden',marginBottom:8}}>
                            <div style={{height:'100%',width:`${pct}%`,background:barColor,borderRadius:2,transition:'width 1s linear'}}/>
                          </div>
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
                              ✅ ¡Listo!
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
                  const tiempoProd = (item as any).duracion_seg ? fmtTime((item as any).duracion_seg) : item.tiempo_inicio&&item.status!=='served'?fmtTime(tseconds(item.tiempo_inicio)):'—';
                  return (
                    <tr key={item.id} style={{background:idx%2===0?'#08080f':'#0f0f1a',borderBottom:'1px solid rgba(255,255,255,0.03)'}}>
                      <td style={{padding:'9px 12px',fontWeight:600,color:'#f0f0f0'}}>{getNombre(item)}</td>
                      <td style={{padding:'9px 12px'}}>
                        {item.table_id ? <span style={{background:`${est?.color||'#448AFF'}20`,color:est?.color||'#448AFF',padding:'2px 8px',borderRadius:20,fontSize:10,fontWeight:700}}>M{item.table_id}</span> : '—'}
                      </td>
                      <td style={{padding:'9px 12px'}}><span style={{fontSize:11,color:est?.color||'#a0a0a0'}}>{est?.emoji||'🍽️'} {getStation(item).replace('_',' ')}</span></td>
                      <td style={{padding:'9px 12px',color:'#a0a0a0',fontSize:11}}>{item.mesero||'—'}</td>
                      <td style={{padding:'9px 12px',color:'#a0a0a0',fontSize:11}}>{item.cocinero||'—'}</td>
                      <td style={{padding:'9px 12px'}}>
                        <span style={{fontSize:10,background:item.status==='served'?'rgba(0,230,118,0.15)':item.status==='preparing'?`${est?.color||'#448AFF'}20`:'rgba(255,255,255,0.05)',color:item.status==='served'?'#00E676':item.status==='preparing'?(est?.color||'#448AFF'):'#6b7280',padding:'2px 8px',borderRadius:20,fontWeight:700}}>
                          {item.status==='served'?'✅ Listo':item.status==='preparing'?'🍳 Prep.':'⏳ Pendiente'}
                        </span>
                      </td>
                      <td style={{padding:'9px 12px',color:'#606060',fontSize:11}}>{new Date(item.created_at).toLocaleTimeString('es-CO',{hour:'2-digit',minute:'2-digit'})}</td>
                      <td style={{padding:'9px 12px',color:est?.color||'#a0a0a0',fontSize:11,fontWeight:600}}>{tiempoProd}</td>
                      <td style={{padding:'9px 12px',color:'#606060',fontSize:11}}>{(item as any).duracion_seg?fmtTime((item as any).duracion_seg):'En curso'}</td>
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
