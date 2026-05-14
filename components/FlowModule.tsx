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
  status:'pending'|'preparing'|'ready'|'served';
  quantity:number; notes:string|null; nombre_plato?:string|null;
  created_at:string; updated_at:string; tiempo_inicio?:string|null;
  table_id:number|null; menu_name:string|null; category:string|null;
  mesero?:string|null; estacion?:string|null; cocinero?:string|null;
  duracion_seg?:number|null; price_at_time?:number|null;
}

// ── 20 COLORES POR MESA ───────────────────────────────────────────────
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
  13:{color:'#AD1457',bg:'rgba(173,20,87,0.18)'},
  14:{color:'#0277BD',bg:'rgba(2,119,189,0.18)'},
  15:{color:'#6D4C41',bg:'rgba(109,76,65,0.18)'},
  16:{color:'#37474F',bg:'rgba(55,71,79,0.18)'},
  17:{color:'#827717',bg:'rgba(130,119,23,0.18)'},
  18:{color:'#880E4F',bg:'rgba(136,14,79,0.18)'},
  19:{color:'#1A237E',bg:'rgba(26,35,126,0.18)'},
  20:{color:'#004D40',bg:'rgba(0,77,64,0.18)'},
};
const getMC = (id:number|null) => id && MESA_COLORES[id] ? MESA_COLORES[id] : {color:'#606060',bg:'rgba(96,96,96,0.12)'};

const getNombre  = (i:FlowItem) => i.nombre_plato ?? i.menu_name ?? i.notes ?? 'Sin nombre';
const getStation = (i:FlowItem) => i.estacion || (i as any).categoria || 'cocina_caliente';
const tsec       = (iso:string) => Math.floor((Date.now()-new Date(iso).getTime())/1000);
const fmtT = (s:number) => {
  if (!s || s <= 0) return '—';
  const m = Math.floor(s/60);
  return m === 0 ? '<1min' : `${m + (s%60 >= 30 ? 1 : 0)}min`;
};

// ── COMPONENTE PRINCIPAL ───────────────────────────────────────────────
export default function FlowModule() {
  const [items,     setItems]     = useState<FlowItem[]>([]);
  const [diasItems, setDiasItems] = useState<FlowItem[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [activeTab, setActiveTab] = useState<'live'|'dia'|'platos'|'metricas'>('live');
  const [filtroEst, setFiltroEst] = useState<string>('all');
  const [statsHoy,  setStatsHoy]  = useState<any>(null);
  const [tick,      setTick]      = useState(0);

  // Reloj para cronómetros
  useEffect(() => {
    const t = setInterval(() => setTick(p => p+1), 10000);
    return () => clearInterval(t);
  }, []);

  // ── FETCH ─────────────────────────────────────────────────────────
  const fetchLive = useCallback(async () => {
    const { data } = await supabase
      .from('flow_order_items')
      .select('*')
      .in('status', ['pending','preparing','ready'])
      .order('created_at');
    if (data) setItems(data as FlowItem[]);
    setLoading(false);
  }, []);

  const fetchDia = useCallback(async () => {
    const hoy = new Date().toISOString().split('T')[0];
    const { data } = await supabase
      .from('flow_order_items')
      .select('*')
      .gte('created_at', hoy + 'T00:00:00')
      .order('created_at', { ascending: false });
    if (data) {
      setDiasItems(data as FlowItem[]);
      // Calcular stats
      const served  = data.filter(i => i.status === 'served');
      const tiempos = served.filter(i => i.duracion_seg && i.duracion_seg > 0).map(i => i.duracion_seg as number);
      const avgT    = tiempos.length ? Math.round(tiempos.reduce((a,b)=>a+b,0)/tiempos.length) : 0;
      const ventas  = served.reduce((s,i) => s + (i.price_at_time||0) * (i.quantity||1), 0);
      setStatsHoy({
        total:    data.length,
        served:   served.length,
        pending:  data.filter(i => i.status === 'pending').length,
        prep:     data.filter(i => i.status === 'preparing').length,
        ready:    data.filter(i => i.status === 'ready').length,
        avgTiempo: avgT,
        ventas,
        estaciones: Object.entries(
          data.reduce((acc:any,i) => {
            const est = getStation(i);
            if (!acc[est]) acc[est] = {platos:0,tiempo:0,count:0};
            acc[est].platos++;
            if (i.duracion_seg) { acc[est].tiempo += i.duracion_seg; acc[est].count++; }
            return acc;
          }, {})
        ).map(([est,v]:any) => ({est, platos:v.platos, avgT: v.count ? Math.round(v.tiempo/v.count) : 0})),
      });
    }
  }, []);

  useEffect(() => { fetchLive(); fetchDia(); }, [fetchLive, fetchDia]);
  useEffect(() => { const t = setInterval(fetchLive, 15000); return () => clearInterval(t); }, [fetchLive]);

  // Realtime
  useEffect(() => {
    const ch = supabase.channel('flow-kds')
      .on('postgres_changes', { event:'*', schema:'public', table:'order_items' }, () => {
        fetchLive(); fetchDia();
      }).subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [fetchLive, fetchDia]);

  // ── UPDATE STATUS ─────────────────────────────────────────────────
  const updateStatus = async (id:string, status:FlowItem['status']) => {
    const updates: any = { status, updated_at: new Date().toISOString() };
    if (status === 'preparing') updates.tiempo_inicio = new Date().toISOString();
    if (status === 'served')    updates.duracion_seg  = tsec(
      items.find(i => i.id === id)?.tiempo_inicio || new Date().toISOString()
    );
    await supabase.from('order_items').update(updates).eq('id', id);
    // Notificar al mesero cuando está listo
    if (status === 'ready' || status === 'served') {
      const item = items.find(i => i.id === id);
      if (item) {
        const titulo = status === 'ready'
          ? `🟡 ${getNombre(item)} casi listo`
          : `✅ ${getNombre(item)} LISTO para entrega`;
        const urgente = status === 'served';
        await supabase.from('nexum_notificaciones').insert({
          restaurante_id:6, tipo: urgente ? 'plato_listo' : 'plato_casi_listo',
          titulo, mensaje:`Mesa ${item.table_id} — ${fmtT(tsec(item.tiempo_inicio||item.created_at))} producción`,
          urgente, leida:false, destinatario_nombre: item.mesero||null,
        }).then(()=>{}).catch(()=>{});
        if (urgente) {
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
    items.filter(i => {
      if (i.status==='served'||i.status==='ready') return false;
      const est = ESTACIONES[getStation(i)] || ESTACIONES.cocina_caliente;
      const tp  = tsec(i.created_at);
      const pp  = i.tiempo_inicio ? tsec(i.tiempo_inicio) : 0;
      const esCal = getStation(i) === 'cocina_caliente';
      return esCal && ((i.status==='pending'&&tp>est.objetivo*1.5)||(i.status==='preparing'&&pp>est.objetivo));
    }).map(i => i.table_id)
  );

  // Filtrar items
  const estaciones = ['all', ...Array.from(new Set(items.map(i => getStation(i))))];
  const itemsFiltrados = filtroEst === 'all' ? items : items.filter(i => getStation(i) === filtroEst);

  // Agrupar por mesa
  const porMesa = itemsFiltrados.reduce((acc:any, i) => {
    const k = i.table_id ?? 0;
    if (!acc[k]) acc[k] = [];
    acc[k].push(i);
    return acc;
  }, {});

  const S = {
    bg:'#08080f', bg2:'#0f0f1a', bg3:'#161624',
    border:'rgba(255,255,255,0.07)',
    t1:'#fff', t2:'#A0A0B8', t3:'#50506A',
    gold:'#FFB547', green:'#00E676', red:'#FF5252',
  };

  return (
    <div style={{height:'100%',display:'flex',flexDirection:'column',background:S.bg,color:S.t1,fontFamily:"'DM Sans',sans-serif",overflow:'hidden'}}>

      {/* ── HEADER ── */}
      <div style={{padding:'12px 20px',borderBottom:`1px solid ${S.border}`,background:S.bg2,display:'flex',alignItems:'center',gap:14,flexShrink:0,flexWrap:'wrap'}}>
        <div style={{display:'flex',alignItems:'center',gap:10}}>
          <div style={{width:42,height:42,borderRadius:12,background:'linear-gradient(135deg,#FF6B00,#d4943a)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:20}}>🔥</div>
          <div>
            <div style={{fontFamily:"'Syne',sans-serif",fontSize:15,fontWeight:900}}>COMMAND FLOW <span style={{color:S.gold,fontSize:11}}>KDS</span></div>
            <div style={{fontSize:9,color:S.t3,textTransform:'uppercase',letterSpacing:'.08em'}}>Kitchen Display · Semáforo · Tiempos</div>
          </div>
        </div>
        {/* KPIs */}
        <div style={{display:'flex',gap:8,marginLeft:'auto',flexWrap:'wrap'}}>
          {[
            {l:'En vivo', v:items.length,           c:'#FF6B00'},
            {l:'Hoy',     v:statsHoy?.total||0,      c:S.gold},
            {l:'Servidos',v:statsHoy?.served||0,     c:S.green},
            {l:'Avg',     v:fmtT(statsHoy?.avgTiempo||0), c:S.t2},
          ].map(k=>(
            <div key={k.l} style={{textAlign:'center',padding:'4px 12px',background:'rgba(255,255,255,0.04)',borderRadius:10,border:`1px solid ${k.c}20`}}>
              <div style={{fontSize:8,color:S.t3,textTransform:'uppercase'}}>{k.l}</div>
              <div style={{fontFamily:"'Syne',sans-serif",fontSize:16,fontWeight:900,color:k.c}}>{k.v}</div>
            </div>
          ))}
        </div>
      </div>

      {/* ── TABS ── */}
      <div style={{display:'flex',borderBottom:`1px solid ${S.border}`,background:S.bg2,padding:'0 20px',flexShrink:0}}>
        {([
          {id:'live',    l:'🔴 En vivo'},
          {id:'dia',     l:'📋 Pedidos del día'},
          {id:'platos',  l:'🍽️ Platos del día'},
          {id:'metricas',l:'📊 Métricas'},
        ] as {id:typeof activeTab,l:string}[]).map(t=>(
          <button key={t.id} onClick={()=>setActiveTab(t.id)}
            style={{padding:'10px 14px',background:'none',border:'none',borderBottom:`2px solid ${activeTab===t.id?S.gold:'transparent'}`,color:activeTab===t.id?S.gold:S.t3,fontSize:11,fontWeight:700,cursor:'pointer',whiteSpace:'nowrap',transition:'all .15s'}}>
            {t.l}
          </button>
        ))}
      </div>

      <div style={{flex:1,overflow:'hidden',display:'flex',flexDirection:'column'}}>

        {/* ══ EN VIVO ══ */}
        {activeTab==='live' && (
          <div style={{flex:1,display:'flex',flexDirection:'column',overflow:'hidden'}}>
            {/* Filtro estaciones */}
            <div style={{padding:'8px 16px',borderBottom:`1px solid ${S.border}`,background:S.bg2,display:'flex',gap:6,flexWrap:'wrap',flexShrink:0,alignItems:'center'}}>
              {items.filter(i=>i.status==='ready').length > 0 && (
                <div style={{marginLeft:'auto',background:'rgba(0,230,118,0.12)',border:'1px solid rgba(0,230,118,0.4)',borderRadius:20,padding:'3px 12px',fontSize:10,color:'#00E676',fontWeight:700,animation:'pulse 1.5s infinite'}}>
                  🟢 {items.filter(i=>i.status==='ready').length} listo{items.filter(i=>i.status==='ready').length>1?'s':''} para entrega
                </div>
              )}
              {estaciones.map(est=>{
                const meta = ESTACIONES[est];
                return (
                  <button key={est} onClick={()=>setFiltroEst(est)}
                    style={{padding:'4px 12px',borderRadius:20,border:`1px solid ${filtroEst===est?(meta?.color||S.gold):'rgba(255,255,255,0.1)'}`,background:filtroEst===est?`${meta?.color||S.gold}15`:'transparent',color:filtroEst===est?(meta?.color||S.gold):S.t3,fontSize:10,fontWeight:700,cursor:'pointer',display:'flex',alignItems:'center',gap:4}}>
                    {meta ? `${meta.emoji} ${est.replace('_',' ')}` : '🔴 Todas'}
                    {est!=='all' && <span style={{fontSize:9,opacity:.7}}>({items.filter(i=>getStation(i)===est).length})</span>}
                  </button>
                );
              })}
            </div>

            {/* Cards */}
            <div style={{flex:1,overflowY:'auto',padding:12}}>
              {loading && <div style={{textAlign:'center',padding:40,color:S.t3}}>Cargando...</div>}
              {!loading && items.length===0 && (
                <div style={{textAlign:'center',padding:60,color:S.t3}}>
                  <div style={{fontSize:48,marginBottom:12}}>✅</div>
                  <div style={{fontSize:14,fontWeight:700}}>Cocina al día</div>
                  <div style={{fontSize:12,marginTop:4}}>Sin pedidos pendientes</div>
                </div>
              )}
              {Object.entries(porMesa).map(([mesaId, mesaItems]:any) => {
                const mc = getMC(Number(mesaId));
                return (
                  <div key={mesaId} style={{background:S.bg2,border:`2px solid ${mc.color}30`,borderLeft:`4px solid ${mc.color}`,borderRadius:14,marginBottom:12,overflow:'hidden'}}>
                    {/* Header mesa */}
                    <div style={{padding:'8px 14px',background:`${mc.color}10`,display:'flex',alignItems:'center',gap:8,borderBottom:`1px solid ${mc.color}20`}}>
                      <span style={{fontFamily:"'Syne',sans-serif",fontSize:16,fontWeight:900,color:mc.color}}>Mesa {mesaId}</span>
                      <span style={{fontSize:10,color:S.t3}}>{mesaItems.length} item{mesaItems.length!==1?'s':''}</span>
                      <div style={{marginLeft:'auto',display:'flex',gap:4}}>
                        {['pending','preparing','ready'].map(s=>{
                          const n = mesaItems.filter((i:FlowItem)=>i.status===s).length;
                          const colors:any = {pending:S.t3,preparing:'#FFB547',ready:S.green};
                          return n>0 ? <span key={s} style={{fontSize:9,fontWeight:700,color:colors[s],background:`${colors[s]}15`,padding:'1px 6px',borderRadius:10}}>{n} {s}</span> : null;
                        })}
                      </div>
                    </div>
                    {/* Items */}
                    <div style={{padding:10,display:'flex',flexDirection:'column',gap:6}}>
                      {mesaItems.map((item:FlowItem) => {
                        const est   = ESTACIONES[getStation(item)] || ESTACIONES.cocina_caliente;
                        const tp    = tsec(item.created_at);
                        const pp    = item.tiempo_inicio ? tsec(item.tiempo_inicio) : 0;
                        const isPending   = item.status==='pending';
                        const isPreparing = item.status==='preparing';
                        const isReady     = item.status==='ready';
                        const pct = isPreparing ? Math.min(100,Math.round(pp/est.objetivo*100)) : isPending ? Math.min(100,Math.round(tp/(est.objetivo*1.5)*100)) : 100;
                        const esEnFuego  = (isPending&&tp>est.objetivo*1.5)||(isPreparing&&pp>est.objetivo);
                        const mesaRet    = !!(item.table_id&&mesasConRetraso.has(item.table_id)&&getStation(item)!=='cocina_caliente');
                        const esAmarillo = !esEnFuego&&((isPending&&tp>est.objetivo*0.8)||(isPreparing&&pp>est.objetivo*0.7)||mesaRet);
                        const sColor     = esEnFuego?S.red:esAmarillo?'#FFB547':S.green;
                        return (
                          <div key={item.id} style={{background:esEnFuego?'rgba(255,82,82,0.08)':esAmarillo?'rgba(255,181,71,0.06)':'rgba(255,255,255,0.03)',border:`1px solid ${esEnFuego?'rgba(255,82,82,0.35)':esAmarillo?'rgba(255,181,71,0.25)':'rgba(255,255,255,0.07)'}`,borderLeft:`4px solid ${sColor}`,borderRadius:10,padding:'10px 12px'}}>
                            {/* Fila superior */}
                            <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:6}}>
                              <span style={{fontSize:18}}>{est.emoji}</span>
                              <div style={{flex:1}}>
                                <div style={{fontSize:13,fontWeight:700,color:S.t1}}>{item.quantity > 1 ? `${item.quantity}x ` : ''}{getNombre(item)}</div>
                                <div style={{display:'flex',gap:6,marginTop:2,flexWrap:'wrap'}}>
                                  {item.table_id && <span style={{fontSize:10,background:mc.bg,color:mc.color,border:`1px solid ${mc.color}30`,padding:'1px 7px',borderRadius:20,fontWeight:700}}>M{item.table_id}</span>}
                                  {item.mesero   && <span style={{fontSize:9,color:S.t3}}>👤 {item.mesero.split(' ')[0]}</span>}
                                  {item.cocinero && <span style={{fontSize:9,color:est.color}}>👨‍🍳 {item.cocinero.split(' ').slice(-1)[0]}</span>}
                                  {isReady && <span style={{fontSize:10,background:'rgba(0,230,118,0.15)',color:S.green,padding:'1px 6px',borderRadius:10,fontWeight:700}}>🟢 LISTO</span>}
                                  {esEnFuego && <span style={{fontSize:11}}>🔥</span>}
                                  {mesaRet && !esEnFuego && <span title="Cocina caliente retrasada" style={{fontSize:11}}>🍳⚠️</span>}
                                  {esAmarillo && !esEnFuego && !mesaRet && <span style={{fontSize:11}}>⚠️</span>}
                                </div>
                              </div>
                              {/* Tiempo */}
                              <div style={{textAlign:'right',flexShrink:0}}>
                                <div style={{fontFamily:"'Syne',sans-serif",fontSize:16,fontWeight:900,color:sColor}}>
                                  {isPreparing ? fmtT(pp) : isPending ? fmtT(tp) : fmtT(item.duracion_seg||0)}
                                </div>
                                <div style={{fontSize:9,color:S.t3}}>{isPreparing?'producción':isPending?'en espera':'total'}</div>
                              </div>
                            </div>
                            {/* Barra progreso */}
                            {(isPending||isPreparing) && (
                              <div style={{height:3,background:'rgba(255,255,255,0.06)',borderRadius:2,overflow:'hidden',marginBottom:8}}>
                                <div style={{height:'100%',width:`${pct}%`,background:`linear-gradient(90deg,${est.color},${sColor})`,borderRadius:2,transition:'width 1s'}}/>
                              </div>
                            )}
                            {/* Notas */}
                            {item.notes && <div style={{fontSize:10,color:'#FFB547',marginBottom:8,fontStyle:'italic'}}>📝 {item.notes}</div>}
                            {/* Botones 3 pasos */}
                            <div style={{display:'flex',gap:6}}>
                              {isPending && (
                                <button onClick={()=>updateStatus(item.id,'preparing')}
                                  style={{flex:1,padding:'8px 6px',borderRadius:9,border:`1px solid ${est.color}60`,background:`${est.color}18`,color:est.color,fontSize:11,fontWeight:700,cursor:'pointer'}}>
                                  🍳 Comenzar preparación
                                </button>
                              )}
                              {isPreparing && (
                                <button onClick={()=>updateStatus(item.id,'ready')}
                                  style={{flex:1,padding:'8px 6px',borderRadius:9,border:'1px solid rgba(255,181,71,0.5)',background:'rgba(255,181,71,0.12)',color:'#FFB547',fontSize:11,fontWeight:700,cursor:'pointer'}}>
                                  🟡 Prepárate para venir
                                </button>
                              )}
                              {isReady && (
                                <button onClick={()=>updateStatus(item.id,'served')}
                                  style={{flex:1,padding:'8px 6px',borderRadius:9,border:`1px solid ${S.green}60`,background:`${S.green}12`,color:S.green,fontSize:12,fontWeight:900,cursor:'pointer',boxShadow:`0 0 8px ${S.green}20`}}>
                                  ✅ Listo para entrega · {fmtT(pp)}
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
        )}

        {/* ══ PEDIDOS DEL DÍA ══ */}
        {activeTab==='dia' && (
          <div style={{flex:1,overflowY:'auto',padding:16}}>
            <div style={{fontFamily:"'Syne',sans-serif",fontSize:15,fontWeight:900,marginBottom:16}}>📋 Pedidos del día</div>
            <table style={{width:'100%',borderCollapse:'collapse',fontSize:12}}>
              <thead>
                <tr style={{background:S.bg2}}>
                  {['Plato','Mesa','Estación','Estado','⏱ Inicio','⏱ Final','⏱ Total','Cocinero'].map(h=>(
                    <th key={h} style={{padding:'8px 12px',textAlign:'left',fontSize:10,color:S.t3,fontWeight:700,textTransform:'uppercase',borderBottom:`1px solid ${S.border}`}}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {diasItems.map((i,idx)=>{
                  const est = ESTACIONES[getStation(i)] || ESTACIONES.cocina_caliente;
                  const mc  = getMC(i.table_id);
                  const statusColors:any = {pending:S.t3,preparing:'#FFB547',ready:S.green,served:'#606060'};
                  return (
                    <tr key={i.id} style={{background:idx%2===0?S.bg:S.bg2,borderBottom:'1px solid rgba(255,255,255,0.03)'}}>
                      <td style={{padding:'8px 12px',fontWeight:600,color:S.t1}}>{i.quantity>1?`${i.quantity}x `:''}{getNombre(i)}</td>
                      <td style={{padding:'8px 12px'}}>
                        {i.table_id ? <span style={{color:mc.color,fontWeight:700,fontSize:11}}>M{i.table_id}</span> : <span style={{color:S.t3}}>—</span>}
                      </td>
                      <td style={{padding:'8px 12px'}}>
                        <span style={{color:est.color,fontSize:11}}>{est.emoji} {getStation(i).replace('_',' ')}</span>
                      </td>
                      <td style={{padding:'8px 12px'}}>
                        <span style={{fontSize:10,color:statusColors[i.status],background:`${statusColors[i.status]}15`,padding:'2px 8px',borderRadius:20,fontWeight:700}}>{i.status}</span>
                      </td>
                      <td style={{padding:'8px 12px',color:S.t3,fontSize:11}}>
                        {i.created_at ? new Date(i.created_at).toLocaleTimeString('es-CO',{hour:'2-digit',minute:'2-digit'}) : '—'}
                      </td>
                      <td style={{padding:'8px 12px',color:S.t3,fontSize:11}}>
                        {i.updated_at && i.status==='served' ? new Date(i.updated_at).toLocaleTimeString('es-CO',{hour:'2-digit',minute:'2-digit'}) : '—'}
                      </td>
                      <td style={{padding:'8px 12px',color:S.t2,fontFamily:"'Syne',sans-serif",fontWeight:700}}>
                        {i.duracion_seg ? fmtT(i.duracion_seg) : i.tiempo_inicio ? fmtT(tsec(i.tiempo_inicio)) : '—'}
                      </td>
                      <td style={{padding:'8px 12px',color:S.t3,fontSize:11}}>{i.cocinero||'—'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {diasItems.length===0&&<div style={{textAlign:'center',padding:40,color:S.t3}}>Sin pedidos hoy</div>}
          </div>
        )}

        {/* ══ PLATOS DEL DÍA ══ */}
        {activeTab==='platos' && <PlatosDia />}

        {/* ══ MÉTRICAS ══ */}
        {activeTab==='metricas' && (
          <div style={{flex:1,overflowY:'auto',padding:16}}>
            <div style={{fontFamily:"'Syne',sans-serif",fontSize:15,fontWeight:900,marginBottom:16}}>📊 Métricas del día</div>
            {statsHoy ? (
              <div style={{display:'flex',flexDirection:'column',gap:14}}>
                {/* KPIs */}
                <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(140px,1fr))',gap:10}}>
                  {[
                    {l:'Total pedidos',  v:statsHoy.total,                  c:'#FFB547'},
                    {l:'Servidos',       v:statsHoy.served,                 c:S.green},
                    {l:'En preparación', v:statsHoy.prep,                   c:'#FF6B00'},
                    {l:'Listos',         v:statsHoy.ready,                  c:S.green},
                    {l:'Pendientes',     v:statsHoy.pending,                c:S.t3},
                    {l:'Tiempo promedio',v:fmtT(statsHoy.avgTiempo),        c:S.gold},
                  ].map(k=>(
                    <div key={k.l} style={{background:S.bg2,border:`1px solid ${k.c}20`,borderRadius:12,padding:'12px 14px'}}>
                      <div style={{fontSize:9,color:S.t3,textTransform:'uppercase',marginBottom:4}}>{k.l}</div>
                      <div style={{fontFamily:"'Syne',sans-serif",fontSize:22,fontWeight:900,color:k.c}}>{k.v}</div>
                    </div>
                  ))}
                </div>
                {/* Por estación */}
                <div style={{background:S.bg2,border:`1px solid ${S.border}`,borderRadius:14,padding:16}}>
                  <div style={{fontSize:12,fontWeight:700,marginBottom:12}}>Por estación</div>
                  {statsHoy.estaciones.map((e:any)=>{
                    const meta = ESTACIONES[e.est] || ESTACIONES.cocina_caliente;
                    return (
                      <div key={e.est} style={{display:'flex',alignItems:'center',gap:12,marginBottom:10}}>
                        <span style={{fontSize:18,flexShrink:0}}>{meta.emoji}</span>
                        <div style={{flex:1}}>
                          <div style={{fontSize:11,fontWeight:600,marginBottom:3}}>{e.est.replace('_',' ')}</div>
                          <div style={{height:4,background:'rgba(255,255,255,0.06)',borderRadius:2,overflow:'hidden'}}>
                            <div style={{height:'100%',width:`${Math.min(100,e.platos/Math.max(...statsHoy.estaciones.map((x:any)=>x.platos))*100)}%`,background:meta.color,borderRadius:2}}/>
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
            ) : (
              <div style={{textAlign:'center',padding:40,color:S.t3}}>Sin datos hoy</div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ══ PLATOS DEL DÍA — componente separado limpio ════════════════════════
function PlatosDia() {
  const [platos, setPlatos] = useState<any[]>([]);
  const [form,   setForm]   = useState({nombre:'',emoji:'🍽️',precio:'',estacion:'cocina_caliente',rentable:true});

  const EMOJIS = ['🍽️','🥩','🍜','🐟','🦐','🥗','🍱','🍣','🍷','🍸','🎂'];
  const ESTS: Record<string,string> = {
    cocina_caliente:'🔥 Cocina caliente', cocina_fria:'🧊 Cocina fría',
    bar:'🍸 Bar', cava:'🍷 Cava', robata:'🥩 Robata', postres:'🎂 Postres',
  };

  const fetchPlatos = async () => {
    const { data } = await supabase.from('platos_dia').select('*')
      .eq('restaurante_id',6).eq('activo',true)
      .eq('fecha', new Date().toISOString().split('T')[0])
      .order('created_at', { ascending: false });
    if (data) setPlatos(data);
  };
  useEffect(() => { fetchPlatos(); }, []);

  const agregar = async () => {
    if (!form.nombre) return;
    await supabase.from('platos_dia').insert({
      restaurante_id:6, nombre:form.nombre, emoji:form.emoji,
      precio:form.precio, estacion:form.estacion,
      rentable:form.rentable, disponible:true,
      fecha: new Date().toISOString().split('T')[0],
    });
    setForm({nombre:'',emoji:'🍽️',precio:'',estacion:'cocina_caliente',rentable:true});
    fetchPlatos();
  };
  const toggle86  = async (id:string, disp:boolean) => { await supabase.from('platos_dia').update({disponible:!disp}).eq('id',id); fetchPlatos(); };
  const eliminar  = async (id:string) => { await supabase.from('platos_dia').update({activo:false}).eq('id',id); fetchPlatos(); };

  return (
    <div style={{flex:1,overflowY:'auto',padding:'16px 20px'}}>
      <div style={{fontFamily:"'Syne',sans-serif",fontSize:15,fontWeight:900,marginBottom:4}}>🍽️ Platos del día</div>
      <div style={{fontSize:11,color:'#50506A',marginBottom:16}}>Los platos activos aparecen en el panel IA del POS. El 86 los tacha en tiempo real.</div>
      {/* Formulario */}
      <div style={{background:'#0f0f1a',border:'1px solid rgba(255,255,255,0.08)',borderRadius:14,padding:14,marginBottom:16}}>
        <div style={{fontSize:12,fontWeight:700,marginBottom:10,color:'#f0f0f0'}}>+ Agregar plato del Chef</div>
        <div style={{display:'flex',gap:4,flexWrap:'wrap',marginBottom:8}}>
          {EMOJIS.map(e=>(
            <button key={e} onClick={()=>setForm(p=>({...p,emoji:e}))}
              style={{width:32,height:32,borderRadius:8,border:`1px solid ${form.emoji===e?'#d4943a':'rgba(255,255,255,0.1)'}`,background:form.emoji===e?'rgba(212,148,58,0.2)':'transparent',fontSize:18,cursor:'pointer'}}>
              {e}
            </button>
          ))}
        </div>
        <div style={{display:'flex',gap:8,marginBottom:8,flexWrap:'wrap'}}>
          <input value={form.nombre} onChange={e=>setForm(p=>({...p,nombre:e.target.value}))}
            placeholder="Nombre del plato *"
            style={{flex:2,padding:'9px 12px',borderRadius:8,border:'1px solid rgba(255,255,255,0.12)',background:'rgba(255,255,255,0.05)',color:'#fff',fontSize:13,outline:'none',minWidth:140}}/>
          <input value={form.precio} onChange={e=>setForm(p=>({...p,precio:e.target.value}))}
            placeholder="Precio ej: $185k"
            style={{flex:1,padding:'9px 12px',borderRadius:8,border:'1px solid rgba(255,255,255,0.12)',background:'rgba(255,255,255,0.05)',color:'#fff',fontSize:13,outline:'none',minWidth:80}}/>
        </div>
        <div style={{display:'flex',gap:8,alignItems:'center',flexWrap:'wrap'}}>
          <select value={form.estacion} onChange={e=>setForm(p=>({...p,estacion:e.target.value}))}
            style={{flex:1,padding:'9px 12px',borderRadius:8,border:'1px solid rgba(255,255,255,0.12)',background:'rgba(255,255,255,0.05)',color:'#fff',fontSize:12,outline:'none'}}>
            {Object.entries(ESTS).map(([k,v])=><option key={k} value={k}>{v}</option>)}
          </select>
          <label style={{display:'flex',alignItems:'center',gap:6,fontSize:11,color:'#a0a0a0',cursor:'pointer'}}>
            <input type="checkbox" checked={form.rentable} onChange={e=>setForm(p=>({...p,rentable:e.target.checked}))}/>
            Alta rentabilidad
          </label>
          <button onClick={agregar}
            style={{padding:'9px 18px',borderRadius:8,border:'none',background:'linear-gradient(135deg,#d4943a,#b07820)',color:'#000',fontSize:12,fontWeight:700,cursor:'pointer'}}>
            ✓ Agregar
          </button>
        </div>
      </div>
      {/* Lista */}
      {platos.length === 0 ? (
        <div style={{textAlign:'center',padding:40,color:'#50506A'}}>
          <div style={{fontSize:40,marginBottom:10}}>🍽️</div>
          <div>Sin platos activos hoy</div>
        </div>
      ) : (
        <div style={{display:'flex',flexDirection:'column',gap:8}}>
          {platos.map(p=>(
            <div key={p.id} style={{display:'flex',alignItems:'center',gap:10,background:p.disponible?'rgba(255,255,255,0.03)':'rgba(255,82,82,0.06)',border:`1px solid ${p.disponible?'rgba(255,255,255,0.08)':'rgba(255,82,82,0.3)'}`,borderRadius:10,padding:'10px 14px'}}>
              <span style={{fontSize:22}}>{p.emoji||'🍽️'}</span>
              <div style={{flex:1}}>
                <div style={{fontSize:13,fontWeight:700,color:p.disponible?'#f0f0f0':'#606060',textDecoration:p.disponible?'none':'line-through'}}>{p.nombre}</div>
                <div style={{display:'flex',gap:8,marginTop:2,flexWrap:'wrap'}}>
                  {p.precio && <span style={{fontSize:10,color:'#d4943a'}}>{p.precio}</span>}
                  <span style={{fontSize:10,color:'#606060'}}>{ESTS[p.estacion]||p.estacion}</span>
                  {p.rentable && <span style={{fontSize:9,color:'#3dba6f',background:'rgba(61,186,111,0.12)',padding:'1px 6px',borderRadius:10}}>● Rentable</span>}
                </div>
              </div>
              {!p.disponible && <span style={{fontSize:10,color:'#FF5252',fontWeight:700,background:'rgba(255,82,82,0.12)',padding:'2px 8px',borderRadius:10}}>86</span>}
              <div style={{display:'flex',gap:6,flexShrink:0}}>
                <button onClick={()=>toggle86(p.id,p.disponible)}
                  style={{padding:'5px 10px',borderRadius:7,border:`1px solid ${p.disponible?'rgba(255,82,82,0.4)':'rgba(61,186,111,0.4)'}`,background:'transparent',color:p.disponible?'#FF5252':'#3dba6f',fontSize:10,fontWeight:700,cursor:'pointer'}}>
                  {p.disponible?'86':'✓ Ok'}
                </button>
                <button onClick={()=>eliminar(p.id)}
                  style={{padding:'5px 8px',borderRadius:7,border:'1px solid rgba(255,255,255,0.1)',background:'transparent',color:'#606060',fontSize:10,cursor:'pointer'}}>
                  🗑
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
