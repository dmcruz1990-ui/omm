import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase.ts';

// ── ESTACIONES KDS ────────────────────────────────────────────────────
const ESTACIONES: Record<string,{color:string;emoji:string;objetivo:number}> = {
  cocina_caliente: { color:'#FF6B00', emoji:'🔥', objetivo:480 },
  cocina_fria:     { color:'#22d3ee', emoji:'🧊', objetivo:360 },
  robata:          { color:'#FF9800', emoji:'🥩', objetivo:600 },
  postres:         { color:'#B388FF', emoji:'🍮', objetivo:300 },
  bar:             { color:'#448AFF', emoji:'🍸', objetivo:180 },
  cava:            { color:'#FFB547', emoji:'🍷', objetivo:120 },
};

interface FlowItem {
  id:string; order_id:string;
  status:'pending'|'preparing'|'almost'|'ready'|'served';
  quantity:number; notes:string|null; nombre_plato?:string|null;
  created_at:string; updated_at:string; tiempo_inicio?:string|null;
  table_id:number|null; mesero?:string|null; estacion?:string|null;
  cocinero?:string|null; duracion_seg?:number|null; price_at_time?:number|null;
  categoria?:string|null;
}

// ── COLORES MESA ──────────────────────────────────────────────────────
const MESA_COLORES: Record<number,{color:string;bg:string}> = {
  1:{color:'#1565C0',bg:'rgba(21,101,192,0.18)'},
  2:{color:'#D81B60',bg:'rgba(216,27,96,0.18)'},
  3:{color:'#2E7D32',bg:'rgba(46,125,50,0.18)'},
  4:{color:'#F9A825',bg:'rgba(249,168,37,0.18)'},
  5:{color:'#6A1B9A',bg:'rgba(106,27,154,0.18)'},
  6:{color:'#00838F',bg:'rgba(0,131,143,0.18)'},
  7:{color:'#BF360C',bg:'rgba(191,54,12,0.18)'},
  8:{color:'#1976D2',bg:'rgba(25,118,210,0.18)'},
  9:{color:'#558B2F',bg:'rgba(85,139,47,0.18)'},
  10:{color:'#E65100',bg:'rgba(230,81,0,0.18)'},
  11:{color:'#4527A0',bg:'rgba(69,39,160,0.18)'},
  12:{color:'#00695C',bg:'rgba(0,105,92,0.18)'},
};
const getMC = (id:number|null) => id && MESA_COLORES[id] ? MESA_COLORES[id] : {color:'#606060',bg:'rgba(96,96,96,0.12)'};

const getNombre  = (i:FlowItem) => i.nombre_plato ?? i.notes ?? 'Sin nombre';
const getStation = (i:FlowItem) => i.estacion || i.categoria || 'cocina_caliente';
const tsec       = (iso:string) => Math.floor((Date.now()-new Date(iso).getTime())/1000);
const fmtT = (s:number) => {
  if (!s || s<=0) return '—';
  const m = Math.floor(s/60);
  return m===0 ? '<1min' : `${m}min`;
};
const fmtHora = (iso:string) => new Date(iso).toLocaleTimeString('es-CO',{hour:'2-digit',minute:'2-digit'});

// ── COMPONENTE PRINCIPAL ───────────────────────────────────────────────
export default function FlowModule() {
  const [items,      setItems]      = useState<FlowItem[]>([]);
  const [diasItems,  setDiasItems]  = useState<FlowItem[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [activeTab,  setActiveTab]  = useState<'live'|'dia'|'platos'|'metricas'>('live');
  const [filtroEst,  setFiltroEst]  = useState<string>('all');
  const [statsHoy,   setStatsHoy]   = useState<any>(null);
  const [careMetrics,setCareMetrics] = useState<any>(null);
  const [careByMesa, setCareByMesa] = useState<Record<number,any>>({});
  const [tick,       setTick]       = useState(0);

  useEffect(() => {
    const t = setInterval(() => setTick(p=>p+1), 10000);
    return () => clearInterval(t);
  }, []);

  // ── FETCH ─────────────────────────────────────────────────────────
  const fetchLive = useCallback(async () => {
    const { data } = await supabase
      .from('flow_order_items')
      .select('*')
      .in('status', ['pending','preparing','almost','ready'])
      .order('created_at');
    if (data) setItems(data as FlowItem[]);
    setLoading(false);
  }, []);

  const fetchDia = useCallback(async () => {
    const hoy = new Date().toISOString().split('T')[0];
    const { data } = await supabase
      .from('flow_order_items')
      .select('*')
      .gte('created_at', hoy+'T00:00:00')
      .order('created_at', {ascending:false});
    if (data) {
      setDiasItems(data as FlowItem[]);
      const served  = data.filter(i=>i.status==='served');
      const tiempos = served.filter(i=>i.duracion_seg&&i.duracion_seg>0).map(i=>i.duracion_seg as number);
      const avgT    = tiempos.length ? Math.round(tiempos.reduce((a,b)=>a+b,0)/tiempos.length) : 0;
      const totalT  = tiempos.reduce((a,b)=>a+b,0);
      setStatsHoy({
        total:    data.length,
        served:   served.length,
        pending:  data.filter(i=>i.status==='pending').length,
        prep:     data.filter(i=>i.status==='preparing').length,
        ready:    data.filter(i=>i.status==='ready').length,
        avgTiempo: avgT,
        totalTiempo: totalT,
        estaciones: Object.entries(
          data.reduce((acc:any,i) => {
            const est = getStation(i);
            if (!acc[est]) acc[est]={platos:0,tiempo:0,count:0};
            acc[est].platos++;
            if (i.duracion_seg) {acc[est].tiempo+=i.duracion_seg; acc[est].count++;}
            return acc;
          }, {})
        ).map(([est,v]:any) => ({est, platos:v.platos, avgT:v.count?Math.round(v.tiempo/v.count):0})),
      });
    }
  }, []);

  const fetchCareMetrics = useCallback(async () => {
    const { data } = await supabase
      .from('flow_care_metricas')
      .select('*')
      .limit(7);
    if (data && data.length > 0) setCareMetrics(data[0]);
  }, []);

  // Ratings X-CARE por mesa (último de hoy) — se pinta en cada tarjeta del live
  const fetchCareByMesa = useCallback(async () => {
    const hoy = new Date().toISOString().split('T')[0];
    const { data } = await supabase
      .from('xcare_encuestas')
      .select('id,mesa_numero,estrellas,tags_negativos,tags_positivos,platos_problema,comentario,gestion_conflicto,created_at')
      .gte('created_at', hoy+'T00:00:00')
      .order('created_at', {ascending:false});
    if (!data) return;
    const map: Record<number,any> = {};
    data.forEach((d:any) => {
      if (d.mesa_numero == null) return;
      if (!map[d.mesa_numero]) {
        map[d.mesa_numero] = {
          id: d.id,
          stars: d.estrellas || 0,
          tags_negativos: d.tags_negativos || [],
          tags_positivos: d.tags_positivos || [],
          platos_problema: d.platos_problema || [],
          comentario: d.comentario || '',
          gestion_conflicto: Array.isArray(d.gestion_conflicto) ? d.gestion_conflicto : [],
          created_at: d.created_at,
        };
      }
    });
    setCareByMesa(map);
  }, []);

  // Registrar una acción de gestión de conflicto en la encuesta
  const registrarGestion = useCallback(async (encuestaId:any, accion:string) => {
    if (!encuestaId) return;
    const { data } = await supabase.from('xcare_encuestas').select('gestion_conflicto').eq('id',encuestaId).maybeSingle();
    const actuales = Array.isArray(data?.gestion_conflicto) ? data!.gestion_conflicto : [];
    const next = [...actuales, { accion, at: new Date().toISOString() }];
    await supabase.from('xcare_encuestas').update({
      gestion_conflicto: next,
      alerta_resuelta: accion==='Resuelto' ? true : undefined,
    }).eq('id', encuestaId);
    fetchCareByMesa();
  }, [fetchCareByMesa]);

  useEffect(() => { fetchLive(); fetchDia(); fetchCareMetrics(); fetchCareByMesa(); }, [fetchLive, fetchDia, fetchCareMetrics, fetchCareByMesa]);
  useEffect(() => { const t = setInterval(fetchLive, 15000); return () => clearInterval(t); }, [fetchLive]);

  useEffect(() => {
    const ch = supabase.channel('flow-kds')
      .on('postgres_changes',{event:'*',schema:'public',table:'order_items'},()=>{fetchLive();fetchDia();})
      .on('postgres_changes',{event:'*',schema:'public',table:'orders'},()=>{fetchLive();fetchDia();})
      .on('postgres_changes',{event:'*',schema:'public',table:'xcare_encuestas'},()=>{fetchCareByMesa();fetchCareMetrics();})
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [fetchLive, fetchDia, fetchCareByMesa, fetchCareMetrics]);

  // ── UPDATE STATUS ─────────────────────────────────────────────────
  const updateStatus = async (id:string, status:FlowItem['status']) => {
    const item = items.find(i=>i.id===id);
    const updates:any = {status, updated_at:new Date().toISOString()};
    if (status==='preparing') updates.tiempo_inicio = new Date().toISOString();
    if (status==='served' && item?.tiempo_inicio)
      updates.duracion_seg = tsec(item.tiempo_inicio);
    await supabase.from('order_items').update(updates).eq('id',id);
    if (status==='ready'||status==='served') {
      if (item) {
        const msg = status==='ready'
          ? `⏰ ${getNombre(item)} casi listo — 2 minutos`
          : `✅ ${getNombre(item)} LISTO para entrega`;
        await supabase.from('nexum_notificaciones').insert({
          restaurante_id:6, tipo:status==='ready'?'plato_casi_listo':'plato_listo',
          titulo:msg,
          mensaje:`Mesa ${item.table_id} · ${fmtT(item.tiempo_inicio?tsec(item.tiempo_inicio):0)} producción`,
          urgente:status==='served', leida:false, destinatario_nombre:item.mesero||null,
        }).then(()=>{}).catch(()=>{});
        if (status==='served') {
          await supabase.from('flow_alertas').insert({
            restaurante_id:6, mesa_num:item.table_id, plato:getNombre(item),
            mesero:item.mesero||null, cocinero:item.cocinero||null,
            estacion:getStation(item), leida:false,
          }).then(()=>{}).catch(()=>{});
        }
      }
    }
    fetchLive();
  };

  // ── SEMÁFORO PROPAGADO ────────────────────────────────────────────
  const mesasConRetraso = new Set(
    items.filter(i=>{
      if (i.status==='served'||i.status==='ready') return false;
      const est = ESTACIONES[getStation(i)]||ESTACIONES.cocina_caliente;
      const tp  = tsec(i.created_at);
      const pp  = i.tiempo_inicio?tsec(i.tiempo_inicio):0;
      return getStation(i)==='cocina_caliente'&&((i.status==='pending'&&tp>est.objetivo*1.5)||(i.status==='preparing'&&pp>est.objetivo));
    }).map(i=>i.table_id)
  );

  const estaciones = ['all',...Array.from(new Set(items.map(i=>getStation(i))))];
  const itemsFiltrados = filtroEst==='all'?items:items.filter(i=>getStation(i)===filtroEst);

  // Agrupar por pedido (order_id) — no por mesa
  const porPedido = itemsFiltrados.reduce((acc:any, i) => {
    const k = i.order_id||i.id;
    if (!acc[k]) acc[k]={order_id:k, table_id:i.table_id, mesero:i.mesero, items:[], created_at:i.created_at};
    acc[k].items.push(i);
    return acc;
  }, {});

  // Ordenar pedidos por orden de llegada
  const pedidosOrdenados = Object.values(porPedido)
    .sort((a:any,b:any)=>new Date(a.created_at).getTime()-new Date(b.created_at).getTime());

  const S = {
    bg:'#08080f', bg2:'#0f0f1a', bg3:'#161624',
    border:'rgba(255,255,255,0.07)',
    t1:'#fff', t2:'#A0A0B8', t3:'#50506A',
    gold:'#FFB547', green:'#00E676', red:'#FF5252', blue:'#448AFF',
  };

  return (
    <div style={{height:'100%',display:'flex',flexDirection:'column',background:S.bg,color:S.t1,fontFamily:"'DM Sans',sans-serif",overflow:'hidden'}}>

      {/* ── HEADER ── */}
      <div style={{padding:'10px 20px',borderBottom:`1px solid ${S.border}`,background:S.bg2,display:'flex',alignItems:'center',gap:14,flexShrink:0,flexWrap:'wrap'}}>
        <div style={{display:'flex',alignItems:'center',gap:10}}>
          <div style={{width:40,height:40,borderRadius:12,background:'linear-gradient(135deg,#FF6B00,#d4943a)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:20}}>🔥</div>
          <div>
            <div style={{fontFamily:"'Syne',sans-serif",fontSize:15,fontWeight:900}}>COMMAND FLOW <span style={{color:S.gold,fontSize:11}}>KDS</span></div>
            <div style={{fontSize:9,color:S.t3,textTransform:'uppercase',letterSpacing:'.08em'}}>Kitchen Display · Semáforo · Care</div>
          </div>
        </div>
        {/* KPIs header */}
        <div style={{display:'flex',gap:8,marginLeft:'auto',flexWrap:'wrap'}}>
          {[
            {l:'Pedidos vivos', v:pedidosOrdenados.length,        c:'#FF6B00'},
            {l:'Items vivos',   v:items.length,                   c:S.gold},
            {l:'Servidos hoy',  v:statsHoy?.served||0,            c:S.green},
            {l:'Avg prod.',     v:fmtT(statsHoy?.avgTiempo||0),   c:S.t2},
            {l:'Total prod.',   v:fmtT(statsHoy?.totalTiempo||0), c:S.blue},
          ].map(k=>(
            <div key={k.l} style={{textAlign:'center',padding:'4px 10px',background:'rgba(255,255,255,0.04)',borderRadius:10,border:`1px solid ${k.c}20`}}>
              <div style={{fontSize:8,color:S.t3,textTransform:'uppercase'}}>{k.l}</div>
              <div style={{fontFamily:"'Syne',sans-serif",fontSize:15,fontWeight:900,color:k.c}}>{k.v}</div>
            </div>
          ))}
        </div>
      </div>

      {/* ── TABS ── */}
      <div style={{display:'flex',borderBottom:`1px solid ${S.border}`,background:S.bg2,padding:'0 20px',flexShrink:0}}>
        {([
          {id:'live',     l:'🔴 En vivo'},
          {id:'dia',      l:'📋 Pedidos del día'},
          {id:'platos',   l:'🍽️ Mi Menú'},
          {id:'metricas', l:'📊 Métricas + Care'},
        ] as {id:typeof activeTab,l:string}[]).map(t=>(
          <button key={t.id} onClick={()=>setActiveTab(t.id)}
            style={{padding:'9px 14px',background:'none',border:'none',borderBottom:`2px solid ${activeTab===t.id?S.gold:'transparent'}`,color:activeTab===t.id?S.gold:S.t3,fontSize:11,fontWeight:700,cursor:'pointer',whiteSpace:'nowrap'}}>
            {t.l}
          </button>
        ))}
      </div>

      <div style={{flex:1,overflow:'hidden',display:'flex',flexDirection:'column'}}>

        {/* ══ EN VIVO — por pedido en orden de llegada ══ */}
        {activeTab==='live' && (
          <div style={{flex:1,display:'flex',flexDirection:'column',overflow:'hidden'}}>
            {/* Filtro estaciones */}
            <div style={{padding:'6px 16px',borderBottom:`1px solid ${S.border}`,background:S.bg2,display:'flex',gap:6,flexWrap:'wrap',flexShrink:0,alignItems:'center'}}>
              {estaciones.map(est=>{
                const meta = ESTACIONES[est];
                const cnt  = est==='all'?items.length:items.filter(i=>getStation(i)===est).length;
                return (
                  <button key={est} onClick={()=>setFiltroEst(est)}
                    style={{padding:'3px 10px',borderRadius:20,border:`1px solid ${filtroEst===est?(meta?.color||S.gold):'rgba(255,255,255,0.1)'}`,background:filtroEst===est?`${meta?.color||S.gold}15`:'transparent',color:filtroEst===est?(meta?.color||S.gold):S.t3,fontSize:10,fontWeight:700,cursor:'pointer'}}>
                    {meta?`${meta.emoji} ${est.replace('_',' ')}`:'🔴 Todas'} ({cnt})
                  </button>
                );
              })}
              {items.filter(i=>i.status==='ready').length>0 && (
                <div style={{marginLeft:'auto',background:'rgba(0,230,118,0.12)',border:'1px solid rgba(0,230,118,0.4)',borderRadius:20,padding:'3px 12px',fontSize:10,color:S.green,fontWeight:700,animation:'pulse 1.5s infinite'}}>
                  🟢 {items.filter(i=>i.status==='ready').length} listo{items.filter(i=>i.status==='ready').length>1?'s':''} para entrega
                </div>
              )}
            </div>

            {/* Cards CUADRADAS por pedido, orden de llegada FIFO — grid responsive */}
            <div style={{flex:1,overflowY:'auto',padding:12}}>
              {loading && <div style={{textAlign:'center',padding:40,color:S.t3}}>Cargando...</div>}
              {!loading && pedidosOrdenados.length===0 && (
                <div style={{textAlign:'center',padding:60,color:S.t3}}>
                  <div style={{fontSize:48,marginBottom:12}}>✅</div>
                  <div style={{fontSize:14,fontWeight:700}}>Cocina al día</div>
                </div>
              )}
              <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(340px,1fr))',gap:12}}>
              {pedidosOrdenados.map((pedido:any) => {
                const mc = getMC(pedido.table_id);
                const careRating = pedido.table_id != null ? careByMesa[pedido.table_id] : null;
                const platosQuejados = new Set(careRating?.platos_problema || []);
                const careColor = careRating ? (careRating.stars>=4?S.green:careRating.stars>=3?S.gold:S.red) : null;
                return (
                  <div key={pedido.order_id} style={{background:S.bg2,border:`1px solid ${mc.color}30`,borderLeft:`5px solid ${mc.color}`,borderRadius:14,overflow:'hidden',display:'flex',flexDirection:'column'}}>
                    {/* Header pedido — letras grandes */}
                    <div style={{padding:'10px 14px',background:`${mc.color}10`,display:'flex',alignItems:'center',gap:10,borderBottom:`1px solid ${mc.color}20`,flexWrap:'wrap'}}>
                      <span style={{fontFamily:"'Syne',sans-serif",fontSize:22,fontWeight:900,color:mc.color,lineHeight:1}}>
                        M{pedido.table_id||'?'}
                      </span>
                      <div style={{display:'flex',flexDirection:'column',gap:2,minWidth:0,flex:1}}>
                        <div style={{display:'flex',gap:8,alignItems:'center',flexWrap:'wrap'}}>
                          <span style={{fontSize:12,color:S.t2,fontWeight:700}}>{pedido.items.length} item{pedido.items.length>1?'s':''}</span>
                          <span style={{fontSize:11,color:S.t3}}>🕐 {fmtHora(pedido.created_at)}</span>
                        </div>
                        {pedido.mesero && <span style={{fontSize:11,color:S.t3}}>👤 {pedido.mesero.split(' ')[0]}</span>}
                      </div>
                      {/* Badges de estado */}
                      <div style={{display:'flex',gap:4}}>
                        {(['pending','preparing','ready'] as const).map(s=>{
                          const n = pedido.items.filter((i:FlowItem)=>i.status===s).length;
                          const colors:any={pending:S.t3,preparing:'#FFB547',ready:S.green};
                          const labels:any={pending:'esp',preparing:'prep',ready:'lst'};
                          return n>0?<span key={s} style={{fontSize:10,color:colors[s],background:`${colors[s]}15`,padding:'2px 7px',borderRadius:10,fontWeight:800}}>{n} {labels[s]}</span>:null;
                        })}
                      </div>
                    </div>

                    {/* Rating X-CARE + platos calificados + trazabilidad de conflicto */}
                    <div style={{borderBottom:`1px solid ${S.border}`,background:careRating ? `${careColor}08` : 'rgba(255,255,255,0.02)'}}>
                      <div style={{padding:'8px 14px',display:'flex',alignItems:'center',gap:10}}>
                        <span style={{fontSize:10,color:S.t3,fontWeight:700,textTransform:'uppercase',letterSpacing:'.08em'}}>X-Care</span>
                        <span style={{fontSize:16,letterSpacing:1,color: careRating?(careColor||S.gold):S.t3,fontWeight:900}}>
                          {careRating ? `${'★'.repeat(careRating.stars)}${'☆'.repeat(Math.max(0,5-careRating.stars))}` : '☆☆☆☆☆'}
                        </span>
                        <span style={{fontSize:11,color:careRating?(careColor||S.t2):S.t3,marginLeft:'auto',fontWeight:700}}>
                          {careRating ? `${careRating.stars}/5` : 'Sin encuesta'}
                        </span>
                      </div>

                      {/* Platos calificados — para que el chef vea qué gustó / qué falló */}
                      {careRating && (careRating.platos_problema?.length>0) && (
                        <div style={{padding:'0 14px 8px',display:'flex',flexWrap:'wrap',gap:4,alignItems:'center'}}>
                          {careRating.stars>=4 ? (
                            <>
                              <span style={{fontSize:10,fontWeight:800,color:S.green}}>❤️ Le encantó:</span>
                              {careRating.platos_problema.map((p:string,i:number)=>(
                                <span key={i} style={{fontSize:10,padding:'2px 7px',borderRadius:8,background:`${S.green}15`,border:`1px solid ${S.green}35`,color:S.green,fontWeight:700}}>{p}</span>
                              ))}
                            </>
                          ) : (
                            <>
                              <span style={{fontSize:10,fontWeight:800,color:S.red}}>⚠ Falló:</span>
                              {careRating.platos_problema.map((p:string,i:number)=>(
                                <span key={i} style={{fontSize:10,padding:'2px 7px',borderRadius:8,background:`${S.red}15`,border:`1px solid ${S.red}35`,color:S.red,fontWeight:700}}>{p}</span>
                              ))}
                            </>
                          )}
                        </div>
                      )}

                      {/* Caja de trazabilidad — sólo en 1·2·3 estrellas */}
                      {careRating && careRating.stars>0 && careRating.stars<=3 && (
                        <div style={{margin:'0 12px 10px',padding:'9px 11px',background:`${S.red}0c`,border:`1px solid ${S.red}30`,borderRadius:10}}>
                          <div style={{fontSize:9,fontWeight:900,color:S.red,textTransform:'uppercase',letterSpacing:'.08em',marginBottom:6}}>
                            🛠 Gestión del conflicto
                          </div>
                          {/* Acciones rápidas */}
                          <div style={{display:'flex',flexWrap:'wrap',gap:4,marginBottom:(careRating.gestion_conflicto?.length>0)?7:0}}>
                            {['📞 Llamé al cliente','🎁 Re-invitado','👨‍🍳 Receta corregida','🤵 Gerente intervino','✅ Resuelto'].map(a=>{
                              const accion = a.replace(/^\S+\s/,'');
                              const yaHecha = (careRating.gestion_conflicto||[]).some((g:any)=>g.accion===accion);
                              return (
                                <button key={a} onClick={()=>!yaHecha && registrarGestion(careRating.id, accion)}
                                  disabled={yaHecha}
                                  style={{fontSize:9.5,padding:'4px 8px',borderRadius:7,cursor:yaHecha?'default':'pointer',fontWeight:700,
                                    border:`1px solid ${yaHecha?S.green+'50':'rgba(255,255,255,0.14)'}`,
                                    background:yaHecha?`${S.green}15`:'rgba(255,255,255,0.04)',
                                    color:yaHecha?S.green:S.t2}}>
                                  {yaHecha?'✓ ':''}{a}
                                </button>
                              );
                            })}
                          </div>
                          {/* Bitácora de acciones */}
                          {careRating.gestion_conflicto?.length>0 && (
                            <div style={{display:'flex',flexDirection:'column',gap:3}}>
                              {careRating.gestion_conflicto.map((g:any,i:number)=>(
                                <div key={i} style={{display:'flex',gap:6,fontSize:9.5,color:S.t2}}>
                                  <span style={{color:S.green}}>●</span>
                                  <span style={{fontWeight:700}}>{g.accion}</span>
                                  <span style={{color:S.t3,marginLeft:'auto'}}>{g.at?new Date(g.at).toLocaleTimeString('es-CO',{hour:'2-digit',minute:'2-digit'}):''}</span>
                                </div>
                              ))}
                            </div>
                          )}
                          {(!careRating.gestion_conflicto||careRating.gestion_conflicto.length===0) && (
                            <div style={{fontSize:9,color:S.t3,marginTop:2}}>Registra cómo se gestionó la queja del cliente.</div>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Items del pedido */}
                    <div style={{padding:'10px 12px',display:'flex',flexDirection:'column',gap:8,flex:1,overflowY:'auto'}}>
                      {pedido.items.map((item:FlowItem) => {
                        const est   = ESTACIONES[getStation(item)]||ESTACIONES.cocina_caliente;
                        const tp    = tsec(item.created_at);
                        const pp    = item.tiempo_inicio?tsec(item.tiempo_inicio):0;
                        const isPending   = item.status==='pending';
                        const isPreparing = item.status==='preparing' || item.status==='almost';
                        const isReady     = item.status==='ready';
                        const pct = isPreparing?Math.min(100,Math.round(pp/est.objetivo*100)):isPending?Math.min(100,Math.round(tp/(est.objetivo*1.5)*100)):100;
                        const esRetrasado = (isPending&&tp>est.objetivo*1.5)||(isPreparing&&pp>est.objetivo);
                        const esAmarillo  = !esRetrasado&&((isPending&&tp>est.objetivo*0.8)||(isPreparing&&pp>est.objetivo*0.7)||mesasConRetraso.has(item.table_id));
                        const sColor = esRetrasado?S.red:esAmarillo?'#FFB547':S.green;
                        return (
                          <div key={item.id} style={{background:esRetrasado?'rgba(255,82,82,0.07)':esAmarillo?'rgba(255,181,71,0.05)':'rgba(255,255,255,0.03)',border:`1px solid ${esRetrasado?'rgba(255,82,82,0.35)':esAmarillo?'rgba(255,181,71,0.25)':'rgba(255,255,255,0.07)'}`,borderLeft:`4px solid ${sColor}`,borderRadius:10,padding:'10px 12px'}}>
                            <div style={{display:'flex',alignItems:'flex-start',gap:10,marginBottom:isPending||isPreparing?8:0}}>
                              <span style={{fontSize:22,lineHeight:1}}>{est.emoji}</span>
                              <div style={{flex:1,minWidth:0}}>
                                <div style={{fontSize:15,fontWeight:800,color:S.t1,lineHeight:1.2}}>{item.quantity>1?`${item.quantity}× `:''}{getNombre(item)}</div>
                                <div style={{display:'flex',gap:6,marginTop:4,flexWrap:'wrap',alignItems:'center'}}>
                                  <span style={{fontSize:11,color:est.color,fontWeight:600}}>{getStation(item).replace('_',' ')}</span>
                                  {item.cocinero && <span style={{fontSize:11,color:S.t3}}>👨‍🍳 {item.cocinero.split(' ').slice(-1)[0]}</span>}
                                  {isReady && <span style={{fontSize:10,background:'rgba(0,230,118,0.15)',color:S.green,padding:'2px 6px',borderRadius:8,fontWeight:800}}>✅ LISTO</span>}
                                  {esRetrasado && <span style={{fontSize:14}}>🔥</span>}
                                  {platosQuejados.has(getNombre(item)) && <span title="Plato con queja Care en esta mesa" style={{fontSize:10,color:S.red,background:`${S.red}15`,border:`1px solid ${S.red}40`,padding:'2px 6px',borderRadius:8,fontWeight:800}}>⚠ Care</span>}
                                </div>
                                {item.notes && item.notes!==getNombre(item) && <div style={{fontSize:11,color:'#FFB547',marginTop:4,fontStyle:'italic'}}>📝 {item.notes}</div>}
                              </div>
                              {/* Tiempo grande */}
                              <div style={{textAlign:'right',flexShrink:0}}>
                                <div style={{fontFamily:"'Syne',sans-serif",fontSize:22,fontWeight:900,color:sColor,lineHeight:1}}>
                                  {isPreparing?fmtT(pp):isPending?fmtT(tp):fmtT(item.duracion_seg||0)}
                                </div>
                                <div style={{fontSize:10,color:S.t3,marginTop:2,fontWeight:600}}>{isPreparing?'producción':isPending?'en espera':'total'}</div>
                              </div>
                            </div>
                            {/* Barra progreso */}
                            {(isPending||isPreparing) && (
                              <div style={{height:4,background:'rgba(255,255,255,0.06)',borderRadius:2,overflow:'hidden',marginBottom:8}}>
                                <div style={{height:'100%',width:`${pct}%`,background:`linear-gradient(90deg,${est.color},${sColor})`,borderRadius:2,transition:'width 1s'}}/>
                              </div>
                            )}
                            {/* ── 3 BOTONES DE FLUJO — más grandes ── */}
                            <div style={{display:'flex',gap:6}}>
                              {isPending && (
                                <button onClick={()=>updateStatus(item.id,'preparing')}
                                  style={{flex:1,padding:'10px 8px',borderRadius:10,border:`1px solid ${est.color}70`,background:`${est.color}20`,color:est.color,fontSize:13,fontWeight:800,cursor:'pointer'}}>
                                  🍳 Comenzar preparación
                                </button>
                              )}
                              {isPreparing && (
                                <button onClick={()=>updateStatus(item.id,'ready')}
                                  style={{flex:1,padding:'10px 8px',borderRadius:10,border:'1px solid rgba(255,181,71,0.6)',background:'rgba(255,181,71,0.15)',color:'#FFB547',fontSize:13,fontWeight:800,cursor:'pointer'}}>
                                  ⏰ Casi listo (2 min)
                                </button>
                              )}
                              {isReady && (
                                <button onClick={()=>updateStatus(item.id,'served')}
                                  style={{flex:1,padding:'10px 8px',borderRadius:10,border:`1px solid ${S.green}70`,background:`${S.green}15`,color:S.green,fontSize:14,fontWeight:900,cursor:'pointer',boxShadow:`0 0 10px ${S.green}25`}}>
                                  ✅ Listo para entrega
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
              </div>
            </div>
          </div>
        )}

        {/* ══ PEDIDOS DEL DÍA ══ */}
        {activeTab==='dia' && (
          <div style={{flex:1,overflowY:'auto',padding:16}}>
            {/* Totales de tiempo arriba */}
            {statsHoy && (
              <div style={{display:'flex',gap:8,marginBottom:14,flexWrap:'wrap'}}>
                {[
                  {l:'Total servidos',   v:statsHoy.served,                 c:S.green},
                  {l:'Tiempo prom.',     v:fmtT(statsHoy.avgTiempo),        c:S.gold},
                  {l:'Tiempo total prod.',v:fmtT(statsHoy.totalTiempo),     c:S.blue},
                  {l:'Pendientes',       v:statsHoy.pending,                c:S.red},
                ].map(k=>(
                  <div key={k.l} style={{padding:'6px 14px',background:S.bg2,borderRadius:10,border:`1px solid ${k.c}20`}}>
                    <div style={{fontSize:8,color:S.t3,textTransform:'uppercase'}}>{k.l}</div>
                    <div style={{fontFamily:"'Syne',sans-serif",fontSize:18,fontWeight:900,color:k.c}}>{k.v}</div>
                  </div>
                ))}
              </div>
            )}
            <table style={{width:'100%',borderCollapse:'collapse',fontSize:12}}>
              <thead>
                <tr style={{background:S.bg2}}>
                  {['Plato','Mesa','Estación','Estado','⏱ Inicio','⏱ Final','⏱ Total','Responsable área'].map(h=>(
                    <th key={h} style={{padding:'7px 10px',textAlign:'left',fontSize:9,color:S.t3,fontWeight:700,textTransform:'uppercase',borderBottom:`1px solid ${S.border}`}}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {diasItems.map((i,idx)=>{
                  const est = ESTACIONES[getStation(i)]||ESTACIONES.cocina_caliente;
                  const mc  = getMC(i.table_id);
                  const statusColors:any={pending:S.t3,preparing:'#FFB547',almost:'#eab308',ready:S.green,served:'#404060'};
                  // Detectar retrasado
                  const durTotal = i.duracion_seg||0;
                  const esRetrasado = i.status==='served' && durTotal > est.objetivo * 1.5;
                  const esCorrecto  = i.status==='served' && durTotal <= est.objetivo;
                  const rowBg = esRetrasado?'rgba(255,82,82,0.04)':esCorrecto?'rgba(0,230,118,0.03)':idx%2===0?S.bg:S.bg2;
                  const tiempoColor = esRetrasado?S.red:esCorrecto?S.green:S.t2;
                  return (
                    <tr key={i.id} style={{background:rowBg,borderBottom:'1px solid rgba(255,255,255,0.03)'}}>
                      <td style={{padding:'7px 10px',fontWeight:600,color:S.t1}}>{i.quantity>1?`${i.quantity}× `:''}{getNombre(i)}</td>
                      <td style={{padding:'7px 10px'}}>
                        {i.table_id?<span style={{color:mc.color,fontWeight:700,fontSize:11}}>M{i.table_id}</span>:<span style={{color:S.t3}}>—</span>}
                      </td>
                      <td style={{padding:'7px 10px'}}>
                        <span style={{color:est.color,fontSize:10}}>{est.emoji} {getStation(i).replace('_',' ')}</span>
                      </td>
                      <td style={{padding:'7px 10px'}}>
                        <span style={{fontSize:9,color:statusColors[i.status],background:`${statusColors[i.status]}15`,padding:'2px 7px',borderRadius:20,fontWeight:700}}>{i.status}</span>
                      </td>
                      {/* ⏱ Inicio */}
                      <td style={{padding:'7px 10px',color:S.t3,fontSize:10}}>{fmtHora(i.created_at)}</td>
                      {/* ⏱ Final */}
                      <td style={{padding:'7px 10px',color:S.t3,fontSize:10}}>
                        {i.status==='served'?fmtHora(i.updated_at):'—'}
                      </td>
                      {/* ⏱ Total — rojo si retrasado, verde si a tiempo */}
                      <td style={{padding:'7px 10px',fontFamily:"'Syne',sans-serif",fontWeight:700,color:tiempoColor}}>
                        {i.duracion_seg?fmtT(i.duracion_seg):i.tiempo_inicio?fmtT(tsec(i.tiempo_inicio)):'—'}
                        {esRetrasado && <span style={{fontSize:8,marginLeft:4}}>🔴</span>}
                        {esCorrecto  && <span style={{fontSize:8,marginLeft:4}}>🟢</span>}
                      </td>
                      {/* Responsable área (antes cocinero) */}
                      <td style={{padding:'7px 10px',color:S.t3,fontSize:10}}>{i.cocinero||'—'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {diasItems.length===0&&<div style={{textAlign:'center',padding:40,color:S.t3}}>Sin pedidos hoy</div>}
          </div>
        )}

        {/* ══ MI MENÚ (Platos del día) ══ */}
        {activeTab==='platos' && <PlatosDia />}

        {/* ══ MÉTRICAS + CARE ══ */}
        {activeTab==='metricas' && (
          <div style={{flex:1,overflowY:'auto',padding:16}}>
            <div style={{fontFamily:"'Syne',sans-serif",fontSize:15,fontWeight:900,marginBottom:14}}>📊 Métricas del día</div>

            {statsHoy && (
              <div style={{display:'flex',flexDirection:'column',gap:14}}>
                {/* KPIs producción */}
                <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(130px,1fr))',gap:8}}>
                  {[
                    {l:'Total pedidos',   v:statsHoy.total,              c:'#FFB547'},
                    {l:'Servidos',        v:statsHoy.served,             c:S.green},
                    {l:'En prep.',        v:statsHoy.prep,               c:'#FF6B00'},
                    {l:'Listos',          v:statsHoy.ready,              c:S.green},
                    {l:'Pendientes',      v:statsHoy.pending,            c:S.t3},
                    {l:'Tiempo prom.',    v:fmtT(statsHoy.avgTiempo),    c:S.gold},
                    {l:'Tiempo total',    v:fmtT(statsHoy.totalTiempo),  c:S.blue},
                  ].map(k=>(
                    <div key={k.l} style={{background:S.bg2,border:`1px solid ${k.c}20`,borderRadius:10,padding:'10px 12px'}}>
                      <div style={{fontSize:8,color:S.t3,textTransform:'uppercase',marginBottom:3}}>{k.l}</div>
                      <div style={{fontFamily:"'Syne',sans-serif",fontSize:20,fontWeight:900,color:k.c}}>{k.v}</div>
                    </div>
                  ))}
                </div>

                {/* Por estación */}
                <div style={{background:S.bg2,border:`1px solid ${S.border}`,borderRadius:14,padding:14}}>
                  <div style={{fontSize:11,fontWeight:700,marginBottom:10}}>Por estación</div>
                  {statsHoy.estaciones.map((e:any)=>{
                    const meta = ESTACIONES[e.est]||ESTACIONES.cocina_caliente;
                    const maxPlatos = Math.max(...statsHoy.estaciones.map((x:any)=>x.platos));
                    return (
                      <div key={e.est} style={{display:'flex',alignItems:'center',gap:10,marginBottom:8}}>
                        <span style={{fontSize:16,flexShrink:0}}>{meta.emoji}</span>
                        <div style={{flex:1}}>
                          <div style={{fontSize:10,fontWeight:600,marginBottom:2}}>{e.est.replace('_',' ')}</div>
                          <div style={{height:4,background:'rgba(255,255,255,0.06)',borderRadius:2,overflow:'hidden'}}>
                            <div style={{height:'100%',width:`${Math.min(100,e.platos/maxPlatos*100)}%`,background:meta.color,borderRadius:2}}/>
                          </div>
                        </div>
                        <div style={{textAlign:'right',flexShrink:0}}>
                          <div style={{fontSize:13,fontWeight:700,color:meta.color}}>{e.platos}</div>
                          <div style={{fontSize:9,color:S.t3}}>{fmtT(e.avgT)} avg</div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* ══ REPORTE X-CARE™ CONECTADO ══ */}
            <div style={{marginTop:20,fontFamily:"'Syne',sans-serif",fontSize:13,fontWeight:900,marginBottom:12,display:'flex',alignItems:'center',gap:8}}>
              ❤️ Reporte X-CARE™
              <span style={{fontSize:10,color:S.t3,fontFamily:"'DM Sans',sans-serif",fontWeight:400}}>Platos con quejas y felicitaciones del día</span>
            </div>

            {careMetrics ? (
              <div style={{display:'flex',flexDirection:'column',gap:10}}>
                {/* KPIs Care */}
                <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:8}}>
                  {[
                    {l:'Encuestas',  v:careMetrics.total_encuestas||0, c:'#FFB547'},
                    {l:'Promedio ★', v:`${careMetrics.promedio_estrellas||0}★`, c:'#FFD700'},
                    {l:'Positivas',  v:`${careMetrics.positivas||0}`, c:S.green},
                    {l:'Negativas',  v:`${careMetrics.negativas||0}`, c:S.red},
                  ].map(k=>(
                    <div key={k.l} style={{background:S.bg2,border:`1px solid ${k.c}20`,borderRadius:10,padding:'8px 10px',textAlign:'center'}}>
                      <div style={{fontSize:8,color:S.t3,textTransform:'uppercase'}}>{k.l}</div>
                      <div style={{fontFamily:"'Syne',sans-serif",fontSize:18,fontWeight:900,color:k.c}}>{k.v}</div>
                    </div>
                  ))}
                </div>

                {/* Platos con quejas */}
                {careMetrics.platos_con_quejas?.length > 0 && (
                  <div style={{background:`rgba(255,82,82,0.05)`,border:`1px solid rgba(255,82,82,0.25)`,borderRadius:12,padding:14}}>
                    <div style={{fontSize:11,fontWeight:700,color:S.red,marginBottom:8}}>🚨 Se quejaron de estos platos hoy</div>
                    <div style={{display:'flex',flexWrap:'wrap',gap:6}}>
                      {careMetrics.platos_con_quejas.map((p:string,i:number)=>(
                        <span key={i} style={{fontSize:11,background:`rgba(255,82,82,0.1)`,color:S.red,border:`1px solid rgba(255,82,82,0.3)`,padding:'3px 10px',borderRadius:20}}>
                          ⚠️ {p}
                        </span>
                      ))}
                    </div>
                    {careMetrics.micro_tags_quejas?.length > 0 && (
                      <div style={{marginTop:8,display:'flex',flexWrap:'wrap',gap:4}}>
                        {careMetrics.micro_tags_quejas.map((t:string,i:number)=>(
                          <span key={i} style={{fontSize:10,background:'rgba(255,255,255,0.05)',color:S.t3,padding:'2px 7px',borderRadius:10}}>{t}</span>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Tags positivos */}
                {careMetrics.tags_positivos_dia?.length > 0 && (
                  <div style={{background:`rgba(0,230,118,0.04)`,border:`1px solid rgba(0,230,118,0.2)`,borderRadius:12,padding:14}}>
                    <div style={{fontSize:11,fontWeight:700,color:S.green,marginBottom:8}}>🏆 Felicitaron esto hoy</div>
                    <div style={{display:'flex',flexWrap:'wrap',gap:6}}>
                      {careMetrics.tags_positivos_dia.map((t:string,i:number)=>(
                        <span key={i} style={{fontSize:11,background:`rgba(0,230,118,0.1)`,color:S.green,border:`1px solid rgba(0,230,118,0.25)`,padding:'3px 10px',borderRadius:20}}>
                          ✓ {t}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Sin datos de Care aún */}
                {!careMetrics.platos_con_quejas?.length && !careMetrics.tags_positivos_dia?.length && (
                  <div style={{textAlign:'center',padding:30,color:S.t3,background:S.bg2,borderRadius:12}}>
                    <div style={{fontSize:24,marginBottom:8}}>❤️</div>
                    <div style={{fontSize:12}}>Sin encuestas completadas hoy aún</div>
                    <div style={{fontSize:10,marginTop:4}}>Aparecen automáticamente al confirmar el pago</div>
                  </div>
                )}

                {careMetrics.meseros_alertas?.length > 0 && (
                  <div style={{background:`rgba(255,181,71,0.05)`,border:`1px solid rgba(255,181,71,0.2)`,borderRadius:12,padding:12}}>
                    <div style={{fontSize:10,color:'#FFB547',fontWeight:700,marginBottom:6}}>⚠️ Alertas de mesero hoy (≤2★)</div>
                    <div style={{display:'flex',gap:6,flexWrap:'wrap'}}>
                      {careMetrics.meseros_alertas.map((m:string,i:number)=>(
                        <span key={i} style={{fontSize:11,color:'#FFB547',background:'rgba(255,181,71,0.1)',padding:'2px 8px',borderRadius:10}}>{m}</span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div style={{textAlign:'center',padding:30,color:S.t3}}>Cargando datos de X-CARE...</div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ══ MI MENÚ (Platos del día) ══════════════════════════════════════════
function PlatosDia() {
  const [platos, setPlatos] = useState<any[]>([]);
  const [form,   setForm]   = useState({nombre:'',emoji:'🍽️',precio:'',estacion:'cocina_caliente',rentable:true});
  const S = {bg:'#08080f',bg2:'#0f0f1a',border:'rgba(255,255,255,0.08)',t1:'#fff',t2:'#a0a0a0',t3:'#50506A',gold:'#FFB547'};
  const EMOJIS = ['🍽️','🥩','🍜','🐟','🦐','🥗','🍱','🍣','🍷','🍸','🎂','🫁','🦀','🥟'];
  const ESTS: Record<string,string> = {
    cocina_caliente:'🔥 Cocina caliente', cocina_fria:'🧊 Cocina fría',
    bar:'🍸 Bar', cava:'🍷 Cava', robata:'🥩 Robata', postres:'🎂 Postres',
  };

  const fetch = async () => {
    const {data} = await supabase.from('platos_dia').select('*')
      .eq('restaurante_id',6).eq('activo',true)
      .eq('fecha',new Date().toISOString().split('T')[0])
      .order('created_at',{ascending:false});
    if (data) setPlatos(data);
  };
  useEffect(()=>{fetch();},[]);

  const agregar = async () => {
    if (!form.nombre) return;
    await supabase.from('platos_dia').insert({
      restaurante_id:6, nombre:form.nombre, emoji:form.emoji,
      precio:form.precio, estacion:form.estacion, rentable:form.rentable,
      disponible:true, fecha:new Date().toISOString().split('T')[0],
    });
    setForm({nombre:'',emoji:'🍽️',precio:'',estacion:'cocina_caliente',rentable:true});
    fetch();
  };
  const toggle86 = async (id:string,disp:boolean) => {await supabase.from('platos_dia').update({disponible:!disp}).eq('id',id);fetch();};
  const eliminar = async (id:string) => {await supabase.from('platos_dia').update({activo:false}).eq('id',id);fetch();};

  const inp:React.CSSProperties = {width:'100%',padding:'8px 12px',borderRadius:8,border:`1px solid ${S.border}`,background:'rgba(255,255,255,0.05)',color:S.t1,fontSize:13,outline:'none'};

  return (
    <div style={{flex:1,overflowY:'auto',padding:'14px 20px'}}>
      <div style={{fontFamily:"'Syne',sans-serif",fontSize:15,fontWeight:900,marginBottom:4}}>🍽️ Mi Menú — Platos del día</div>
      <div style={{fontSize:11,color:S.t3,marginBottom:14}}>Los platos activos aparecen en el panel IA del POS. El 86 los tacha en tiempo real.</div>
      {/* Formulario */}
      <div style={{background:S.bg2,border:`1px solid ${S.border}`,borderRadius:14,padding:14,marginBottom:14}}>
        <div style={{fontSize:12,fontWeight:700,marginBottom:10}}>+ Agregar plato del Chef</div>
        <div style={{display:'flex',gap:4,flexWrap:'wrap',marginBottom:8}}>
          {EMOJIS.map(e=>(
            <button key={e} onClick={()=>setForm(p=>({...p,emoji:e}))}
              style={{width:30,height:30,borderRadius:7,border:`1px solid ${form.emoji===e?S.gold:'rgba(255,255,255,0.1)'}`,background:form.emoji===e?`${S.gold}20`:'transparent',fontSize:16,cursor:'pointer'}}>
              {e}
            </button>
          ))}
        </div>
        <div style={{display:'flex',gap:8,marginBottom:8,flexWrap:'wrap'}}>
          <input value={form.nombre} onChange={e=>setForm(p=>({...p,nombre:e.target.value}))}
            placeholder="Nombre del plato *" style={{...inp,flex:2,minWidth:140}}/>
          <input value={form.precio} onChange={e=>setForm(p=>({...p,precio:e.target.value}))}
            placeholder="Precio ej: $185k" style={{...inp,flex:1,minWidth:80}}/>
        </div>
        <div style={{display:'flex',gap:8,alignItems:'center',flexWrap:'wrap'}}>
          <select value={form.estacion} onChange={e=>setForm(p=>({...p,estacion:e.target.value}))}
            style={{...inp,flex:1}}>
            {Object.entries(ESTS).map(([k,v])=><option key={k} value={k}>{v}</option>)}
          </select>
          <label style={{display:'flex',alignItems:'center',gap:6,fontSize:11,color:S.t2,cursor:'pointer'}}>
            <input type="checkbox" checked={form.rentable} onChange={e=>setForm(p=>({...p,rentable:e.target.checked}))}/>
            Alta rentabilidad
          </label>
          <button onClick={agregar}
            style={{padding:'8px 16px',borderRadius:8,border:'none',background:`linear-gradient(135deg,${S.gold},#d4943a)`,color:'#000',fontSize:12,fontWeight:700,cursor:'pointer'}}>
            ✓ Agregar
          </button>
        </div>
      </div>
      {/* Lista */}
      {platos.length===0 ? (
        <div style={{textAlign:'center',padding:40,color:S.t3}}>
          <div style={{fontSize:40,marginBottom:10}}>🍽️</div><div>Sin platos activos hoy</div>
        </div>
      ) : (
        <div style={{display:'flex',flexDirection:'column',gap:7}}>
          {platos.map(p=>(
            <div key={p.id} style={{display:'flex',alignItems:'center',gap:10,background:p.disponible?'rgba(255,255,255,0.03)':'rgba(255,82,82,0.05)',border:`1px solid ${p.disponible?'rgba(255,255,255,0.07)':'rgba(255,82,82,0.25)'}`,borderRadius:10,padding:'9px 12px'}}>
              <span style={{fontSize:20}}>{p.emoji||'🍽️'}</span>
              <div style={{flex:1}}>
                <div style={{fontSize:12,fontWeight:700,color:p.disponible?S.t1:'#606060',textDecoration:p.disponible?'none':'line-through'}}>{p.nombre}</div>
                <div style={{display:'flex',gap:6,marginTop:1}}>
                  {p.precio&&<span style={{fontSize:10,color:S.gold}}>{p.precio}</span>}
                  <span style={{fontSize:9,color:S.t3}}>{ESTS[p.estacion]||p.estacion}</span>
                  {p.rentable&&<span style={{fontSize:9,color:'#3dba6f',background:'rgba(61,186,111,0.1)',padding:'1px 5px',borderRadius:8}}>● Rentable</span>}
                </div>
              </div>
              {!p.disponible&&<span style={{fontSize:9,color:'#FF5252',fontWeight:700,background:'rgba(255,82,82,0.1)',padding:'2px 7px',borderRadius:8}}>86</span>}
              <div style={{display:'flex',gap:5,flexShrink:0}}>
                <button onClick={()=>toggle86(p.id,p.disponible)}
                  style={{padding:'4px 9px',borderRadius:7,border:`1px solid ${p.disponible?'rgba(255,82,82,0.35)':'rgba(61,186,111,0.35)'}`,background:'transparent',color:p.disponible?'#FF5252':'#3dba6f',fontSize:10,fontWeight:700,cursor:'pointer'}}>
                  {p.disponible?'86':'✓ Ok'}
                </button>
                <button onClick={()=>eliminar(p.id)}
                  style={{padding:'4px 8px',borderRadius:7,border:'1px solid rgba(255,255,255,0.08)',background:'transparent',color:S.t3,fontSize:10,cursor:'pointer'}}>🗑</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
