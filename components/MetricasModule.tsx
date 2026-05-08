import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase.ts';

const S = {
  bg:'#08080f', bg2:'#0f0f1a', bg3:'#161624', bg4:'#1e1e2e',
  border:'rgba(255,255,255,0.07)', border2:'rgba(255,255,255,0.12)',
  t1:'#fff', t2:'#A0A0B8', t3:'#50506A',
  gold:'#FFB547', green:'#00E676', red:'#FF5252',
  blue:'#448AFF', purple:'#B388FF', cyan:'#22d3ee', neon:'#DFFF00',
};
const fmtMin = (n:number|null) => n ? `${Math.round(n)}min` : '—';
const fmtK   = (n:number) => n>=1000 ? `$${(n/1000).toFixed(0)}k` : `$${n}`;
const EST: Record<string,{emoji:string,color:string,objetivo:number}> = {
  cocina_caliente:{emoji:'🔥',color:'#FF5252',objetivo:8},
  cocina_fria:    {emoji:'🧊',color:'#22d3ee',objetivo:6},
  robata:         {emoji:'🥩',color:'#FF9800',objetivo:10},
  postres:        {emoji:'🍮',color:'#B388FF',objetivo:5},
  bar:            {emoji:'🍸',color:'#448AFF',objetivo:3},
  cava:           {emoji:'🍷',color:'#FFB547',objetivo:2},
};

type Periodo = 'dia' | 'semana' | 'mes';

export default function MetricasModule() {
  const [periodo, setPeriodo]       = useState<Periodo>('dia');
  const [tab, setTab]               = useState<'produccion'|'ventas'|'quejas'>('produccion');
  const [datos, setDatos]           = useState<any[]>([]);
  const [quejas, setQuejas]         = useState<any[]>([]);
  const [resumen, setResumen]       = useState<any>({});
  const [loading, setLoading]       = useState(false);
  const [estFiltro, setEstFiltro]   = useState<string|null>(null);

  const fetchDatos = useCallback(async () => {
    setLoading(true);
    const hoy = new Date().toISOString().split('T')[0];
    const desde = periodo==='dia' ? hoy
                : periodo==='semana' ? new Date(Date.now()-7*86400000).toISOString().split('T')[0]
                : new Date(Date.now()-30*86400000).toISOString().split('T')[0];

    // Datos de producción desde la vista
    const { data: prod } = await supabase
      .from('vista_metricas_produccion')
      .select('*')
      .gte('fecha', desde)
      .order('fecha', {ascending:false});

    // Agrupar por estación
    if (prod) {
      const agrupado: Record<string,any> = {};
      prod.forEach((r:any) => {
        const k = r.estacion;
        if (!agrupado[k]) agrupado[k] = {
          estacion:k, categoria:r.categoria,
          total_platos:0, con_tiempo:0,
          suma_prom:0, count_prom:0,
          minimo_min:null, maximo_min:null,
          dentro_objetivo:0, fuera_tiempo:0,
          dias: new Set(),
        };
        agrupado[k].total_platos     += r.total_platos||0;
        agrupado[k].con_tiempo       += r.con_tiempo||0;
        agrupado[k].dentro_objetivo  += r.dentro_objetivo||0;
        agrupado[k].fuera_tiempo     += r.fuera_tiempo||0;
        agrupado[k].dias.add(r.fecha);
        if (r.promedio_min) { agrupado[k].suma_prom += r.promedio_min; agrupado[k].count_prom++; }
        if (r.minimo_min && (agrupado[k].minimo_min===null || r.minimo_min<agrupado[k].minimo_min)) agrupado[k].minimo_min = r.minimo_min;
        if (r.maximo_min && (agrupado[k].maximo_min===null || r.maximo_min>agrupado[k].maximo_min)) agrupado[k].maximo_min = r.maximo_min;
      });
      const arr = Object.values(agrupado).map((r:any)=>({
        ...r,
        promedio_min: r.count_prom>0 ? Math.round(r.suma_prom/r.count_prom) : null,
        platos_por_dia: r.dias.size>0 ? Math.round(r.total_platos/r.dias.size) : r.total_platos,
        pct_objetivo: r.con_tiempo>0 ? Math.round(r.dentro_objetivo/r.con_tiempo*100) : 0,
      })).sort((a,b)=>(b.total_platos)-(a.total_platos));
      setDatos(arr);
      setResumen({
        totalPlatos: arr.reduce((s:number,r:any)=>s+r.total_platos,0),
        promedioGeneral: arr.filter((r:any)=>r.promedio_min).length
          ? Math.round(arr.filter((r:any)=>r.promedio_min).reduce((s:number,r:any)=>s+r.promedio_min,0)/arr.filter((r:any)=>r.promedio_min).length)
          : null,
        enFuego: arr.reduce((s:number,r:any)=>s+r.fuera_tiempo,0),
        mejorEstacion: arr.filter((r:any)=>r.promedio_min).sort((a:any,b:any)=>a.promedio_min-b.promedio_min)[0]?.estacion,
      });
    }

    // Quejas de feedback_servicio
    const { data: qdata } = await supabase
      .from('feedback_servicio')
      .select('*')
      .gte('created_at', desde+'T00:00:00')
      .in('tipo',['alerta','nota'])
      .order('created_at',{ascending:false})
      .limit(50);
    if (qdata) setQuejas(qdata);

    setLoading(false);
  }, [periodo]);

  useEffect(()=>{ fetchDatos(); },[fetchDatos]);

  const datosVis = estFiltro ? datos.filter(d=>d.estacion===estFiltro) : datos;

  return (
    <div style={{height:'100%',display:'flex',flexDirection:'column',background:S.bg,color:S.t1,fontFamily:"'DM Sans',sans-serif",overflow:'hidden'}}>

      {/* Header */}
      <div style={{padding:'14px 24px',borderBottom:`1px solid ${S.border}`,background:S.bg2,display:'flex',alignItems:'center',gap:14,flexShrink:0,flexWrap:'wrap'}}>
        <div style={{width:44,height:44,borderRadius:13,background:`linear-gradient(135deg,${S.cyan},#0e9ab5)`,display:'flex',alignItems:'center',justifyContent:'center',fontSize:22}}>📊</div>
        <div>
          <div style={{fontFamily:"'Syne',sans-serif",fontSize:16,fontWeight:900}}>MÉTRICAS <span style={{color:S.cyan}}>OPERATIVAS</span></div>
          <div style={{fontSize:10,color:S.t3,letterSpacing:'.1em',textTransform:'uppercase'}}>Producción · Tiempos · Quejas · Tendencias</div>
        </div>

        {/* Selector período */}
        <div style={{display:'flex',gap:4,background:'rgba(255,255,255,0.05)',padding:4,borderRadius:10,marginLeft:'auto'}}>
          {([['dia','Hoy'],['semana','7 días'],['mes','30 días']] as const).map(([id,l])=>(
            <button key={id} onClick={()=>setPeriodo(id)}
              style={{padding:'6px 14px',borderRadius:8,border:'none',background:periodo===id?S.cyan:'transparent',color:periodo===id?'#000':S.t3,fontSize:11,fontWeight:700,cursor:'pointer',transition:'all .15s'}}>
              {l}
            </button>
          ))}
        </div>
        <button onClick={fetchDatos} style={{padding:'8px 14px',borderRadius:8,border:`1px solid ${S.border}`,background:'transparent',color:S.t3,fontSize:11,cursor:'pointer'}}>↻</button>
      </div>

      {/* KPIs resumen */}
      <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:12,padding:'16px 24px',borderBottom:`1px solid ${S.border}`,flexShrink:0,background:S.bg2}}>
        {[
          {l:'Total platos',        v:resumen.totalPlatos||0,                          c:S.cyan,   e:'🍽️'},
          {l:'Tiempo promedio',     v:fmtMin(resumen.promedioGeneral||null),           c:resumen.promedioGeneral<=8?S.green:resumen.promedioGeneral<=12?S.gold:S.red, e:'⏱'},
          {l:'En fuego / retrasados',v:resumen.enFuego||0,                            c:resumen.enFuego>5?S.red:resumen.enFuego>0?S.gold:S.green, e:'🔥'},
          {l:'Quejas registradas',  v:quejas.length,                                   c:quejas.length>3?S.red:quejas.length>0?S.gold:S.green, e:'💬'},
        ].map(k=>(
          <div key={k.l} style={{background:S.bg3,border:`1px solid ${S.border}`,borderRadius:14,padding:'14px 16px'}}>
            <div style={{fontSize:18,marginBottom:6}}>{k.e}</div>
            <div style={{fontSize:9,color:S.t3,textTransform:'uppercase',letterSpacing:'.07em',marginBottom:3}}>{k.l}</div>
            <div style={{fontFamily:"'Syne',sans-serif",fontSize:22,fontWeight:900,color:k.c}}>{k.v}</div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div style={{display:'flex',borderBottom:`1px solid ${S.border}`,background:S.bg2,padding:'0 24px',flexShrink:0}}>
        {[
          {id:'produccion',l:'⏱ Tiempos de producción'},
          {id:'quejas',    l:'💬 Quejas · Feedback'},
        ].map(t=>(
          <button key={t.id} onClick={()=>setTab(t.id as any)}
            style={{padding:'10px 18px',background:'none',border:'none',borderBottom:`2px solid ${tab===t.id?S.cyan:'transparent'}`,color:tab===t.id?S.cyan:S.t3,fontSize:12,fontWeight:700,cursor:'pointer',whiteSpace:'nowrap'}}>
            {t.l}
          </button>
        ))}

        {/* Filtro estación */}
        <div style={{marginLeft:'auto',display:'flex',gap:4,alignSelf:'center'}}>
          {Object.entries(EST).map(([slug,e])=>(
            <button key={slug} onClick={()=>setEstFiltro(estFiltro===slug?null:slug)} title={slug.replace('_',' ')}
              style={{padding:'4px 8px',borderRadius:8,border:`1px solid ${estFiltro===slug?e.color:'rgba(255,255,255,0.08)'}`,background:estFiltro===slug?`${e.color}20`:'transparent',fontSize:14,cursor:'pointer',transition:'all .15s'}}>
              {e.emoji}
            </button>
          ))}
        </div>
      </div>

      {/* ── PRODUCCIÓN ── */}
      {tab==='produccion' && (
        <div style={{flex:1,overflowY:'auto',padding:24}}>
          {loading && <div style={{textAlign:'center',padding:40,color:S.t3}}>Cargando datos...</div>}

          {!loading && datosVis.length===0 && (
            <div style={{textAlign:'center',padding:60,color:S.t3}}>
              <div style={{fontSize:48,marginBottom:12}}>📊</div>
              <div style={{fontSize:14,fontWeight:700}}>Sin datos de producción</div>
              <div style={{fontSize:12,marginTop:6}}>Los datos aparecen cuando se marcan platos como ✅ Listo en Flow KDS</div>
            </div>
          )}

          <div style={{display:'flex',flexDirection:'column',gap:12}}>
            {datosVis.map((d:any)=>{
              const est = EST[d.estacion] || {emoji:'🍽️',color:S.t2,objetivo:8};
              const colorProm = !d.promedio_min ? S.t3
                              : d.promedio_min <= est.objetivo ? S.green
                              : d.promedio_min <= est.objetivo*1.3 ? S.gold
                              : S.red;
              const pctObj = d.pct_objetivo;

              return (
                <div key={d.estacion} style={{background:S.bg2,border:`1px solid ${colorProm}20`,borderRadius:16,overflow:'hidden'}}>
                  {/* Header estación */}
                  <div style={{padding:'12px 18px',borderBottom:`1px solid ${S.border}`,display:'flex',alignItems:'center',gap:10,background:`${est.color}08`}}>
                    <span style={{fontSize:24}}>{est.emoji}</span>
                    <div style={{flex:1}}>
                      <div style={{fontSize:14,fontWeight:700,color:S.t1,textTransform:'capitalize'}}>{d.estacion.replace('_',' ')}</div>
                      <div style={{fontSize:10,color:S.t3}}>{d.categoria} · Objetivo: {est.objetivo}min</div>
                    </div>
                    {/* Semáforo */}
                    <div style={{display:'flex',alignItems:'center',gap:6,padding:'6px 14px',background:`${colorProm}15`,border:`1px solid ${colorProm}30`,borderRadius:20}}>
                      <span style={{width:8,height:8,borderRadius:'50%',background:colorProm,display:'inline-block',boxShadow:`0 0 6px ${colorProm}`}}/>
                      <span style={{fontFamily:"'Syne',sans-serif",fontSize:20,fontWeight:900,color:colorProm}}>
                        {fmtMin(d.promedio_min)}
                      </span>
                      <span style={{fontSize:9,color:S.t3}}>prom.</span>
                    </div>
                  </div>

                  {/* Métricas grid */}
                  <div style={{display:'grid',gridTemplateColumns:'repeat(5,1fr)',gap:0}}>
                    {[
                      {l:'Mínimo',     v:fmtMin(d.minimo_min),     c:S.green},
                      {l:'Máximo',     v:fmtMin(d.maximo_min),     c:S.red},
                      {l:'Platos día', v:d.platos_por_dia||0,      c:S.t1, suffix:''},
                      {l:'Total',      v:d.total_platos||0,         c:S.cyan,suffix:''},
                      {l:'% Objetivo', v:`${pctObj}%`,              c:pctObj>=80?S.green:pctObj>=60?S.gold:S.red},
                    ].map((m,i)=>(
                      <div key={m.l} style={{padding:'12px 14px',borderRight:i<4?`1px solid ${S.border}`:'none',textAlign:'center'}}>
                        <div style={{fontSize:9,color:S.t3,textTransform:'uppercase',letterSpacing:'.06em',marginBottom:4}}>{m.l}</div>
                        <div style={{fontFamily:"'Syne',sans-serif",fontSize:18,fontWeight:900,color:m.c}}>{m.v}</div>
                      </div>
                    ))}
                  </div>

                  {/* Barra de cumplimiento */}
                  <div style={{padding:'8px 18px 12px'}}>
                    <div style={{display:'flex',justifyContent:'space-between',fontSize:9,color:S.t3,marginBottom:3}}>
                      <span>Dentro del objetivo</span>
                      <span style={{color:pctObj>=80?S.green:pctObj>=60?S.gold:S.red,fontWeight:700}}>{pctObj}% de {d.con_tiempo} platos</span>
                    </div>
                    <div style={{height:6,background:'rgba(255,255,255,0.05)',borderRadius:3,overflow:'hidden'}}>
                      <div style={{height:'100%',width:`${pctObj}%`,background:pctObj>=80?S.green:pctObj>=60?S.gold:S.red,borderRadius:3,transition:'width .5s'}}/>
                    </div>
                    {d.fuera_tiempo > 0 && (
                      <div style={{fontSize:10,color:S.red,marginTop:5}}>
                        🔥 {d.fuera_tiempo} plato{d.fuera_tiempo>1?'s':''} fuera de tiempo en este período
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── QUEJAS ── */}
      {tab==='quejas' && (
        <div style={{flex:1,overflowY:'auto',padding:24}}>
          {quejas.length===0 && !loading && (
            <div style={{textAlign:'center',padding:60,color:S.t3}}>
              <div style={{fontSize:48,marginBottom:12}}>✅</div>
              <div style={{fontSize:14,fontWeight:700,color:S.green}}>Sin quejas registradas</div>
              <div style={{fontSize:12,marginTop:6}}>Las notas del equipo en el POS aparecen aquí</div>
            </div>
          )}

          <div style={{display:'flex',flexDirection:'column',gap:8}}>
            {quejas.map(q=>{
              const tipoColor = q.tipo==='alerta'?S.red:q.tipo==='felicitacion'?S.green:S.gold;
              const tipoEmoji = q.tipo==='alerta'?'⚠️':q.tipo==='felicitacion'?'🌟':'📝';
              return (
                <div key={q.id} style={{background:S.bg2,border:`1px solid ${tipoColor}20`,borderRadius:12,padding:'12px 16px'}}>
                  <div style={{display:'flex',alignItems:'flex-start',gap:10}}>
                    <span style={{fontSize:18,flexShrink:0}}>{tipoEmoji}</span>
                    <div style={{flex:1}}>
                      <div style={{fontSize:13,color:S.t1,lineHeight:1.5}}>{q.comentario}</div>
                      <div style={{display:'flex',gap:12,marginTop:6,flexWrap:'wrap'}}>
                        {q.mesa_num && <span style={{fontSize:10,color:S.blue}}>Mesa {q.mesa_num}</span>}
                        {q.mesero   && <span style={{fontSize:10,color:S.t3}}>👤 {q.mesero}</span>}
                        <span style={{fontSize:10,color:S.t3}}>{new Date(q.created_at).toLocaleDateString('es-CO',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'})}</span>
                      </div>
                    </div>
                    <span style={{fontSize:10,background:`${tipoColor}15`,color:tipoColor,padding:'2px 10px',borderRadius:20,fontWeight:700,whiteSpace:'nowrap',flexShrink:0}}>
                      {q.tipo}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
