import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase.ts';
import { useAuth } from '../contexts/AuthContext';

const S = {
  bg:'#08080f', bg2:'#0f0f1a', bg3:'#161624', bg4:'#1e1e2e',
  border:'rgba(255,255,255,0.07)', border2:'rgba(255,255,255,0.12)',
  t1:'#fff', t2:'#A0A0B8', t3:'#50506A',
  gold:'#FFB547', green:'#00E676', red:'#FF5252',
  blue:'#448AFF', purple:'#B388FF', pink:'#FF2D78', cyan:'#22d3ee',
};
const fmt  = (n:number) => `$${Math.round(n).toLocaleString('es-CO')}`;
const pct  = (v:number, total:number) => total > 0 ? Math.round(v / total * 100) : 0;
const inp: React.CSSProperties = {
  background:'rgba(255,255,255,0.05)', border:`1px solid rgba(255,255,255,0.12)`,
  borderRadius:10, padding:'9px 13px', color:'#fff', fontSize:13, outline:'none', width:'100%',
};

type Tab = 'bolsa' | 'mis_propinas' | 'config' | 'historial';

export default function PropinasModule() {
  const { profile } = useAuth();
  const isGerencia = ['admin','gerencia','desarrollo'].includes(profile?.role||'');

  const [tab, setTab]             = useState<Tab>('bolsa');
  const [bolsa, setBolsa]         = useState<any[]>([]);       // por mesero hoy
  const [bolsaGlobal, setBolsaGlobal] = useState<any>(null);  // totales del día
  const [historial, setHistorial] = useState<any[]>([]);
  const [config, setConfig]       = useState<any>({ pct_meseros:70, pct_cocina:20, pct_host:10, modo:'turno', pct_sugerido:10 });
  const [guardandoConfig, setGuardandoConfig] = useState(false);
  const [loading, setLoading]     = useState(true);
  const [toast, setToast]         = useState('');
  const [fechaFiltro, setFechaFiltro] = useState(new Date().toISOString().split('T')[0]);

  const show = (m:string) => { setToast(m); setTimeout(()=>setToast(''),3500); };

  // ── FETCH DATOS ──────────────────────────────────────────────────────
  const fetchData = useCallback(async () => {
    setLoading(true);
    const [bolsaData, globalData, cfgData, histData] = await Promise.all([
      supabase.from('vista_propinas_dia').select('*').eq('fecha', fechaFiltro).order('total_propina', { ascending: false }),
      supabase.from('vista_bolsa_dia').select('*').eq('fecha', fechaFiltro).single(),
      supabase.from('propinas_config').select('*').eq('restaurante_id', 6).single(),
      supabase.from('vista_propinas_dia').select('*').gte('fecha', new Date(Date.now()-30*86400000).toISOString().split('T')[0]).order('fecha', { ascending: false }).limit(60),
    ]);
    if (bolsaData.data) setBolsa(bolsaData.data);
    if (globalData.data) setBolsaGlobal(globalData.data);
    if (cfgData.data) setConfig(cfgData.data);
    if (histData.data) setHistorial(histData.data);
    setLoading(false);
  }, [fechaFiltro]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Suscribir propinas en tiempo real
  useEffect(() => {
    const ch = supabase.channel('propinas-live')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'propinas' }, () => {
        fetchData();
        show('💰 Nueva propina registrada');
      }).subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [fetchData]);

  // Distribución calculada según config
  const distribucion = bolsaGlobal ? {
    meseros: Math.round((bolsaGlobal.bolsa_total || 0) * config.pct_meseros / 100),
    cocina:  Math.round((bolsaGlobal.bolsa_total || 0) * config.pct_cocina  / 100),
    host:    Math.round((bolsaGlobal.bolsa_total || 0) * config.pct_host    / 100),
  } : { meseros:0, cocina:0, host:0 };

  // Por mesero: su parte proporcional
  const totalPropinasMeseros = bolsa.reduce((s,b)=>s+(b.total_propina||0), 0);

  return (
    <div style={{height:'100%',display:'flex',flexDirection:'column',background:S.bg,color:S.t1,fontFamily:"'DM Sans',sans-serif",overflow:'hidden'}}>
      {toast && <div style={{position:'fixed',bottom:24,left:'50%',transform:'translateX(-50%)',background:S.bg4,border:`1px solid ${S.gold}`,color:S.t1,padding:'10px 28px',borderRadius:50,fontSize:13,fontWeight:700,zIndex:9999}}>{toast}</div>}

      {/* ── HEADER ── */}
      <div style={{padding:'14px 24px',borderBottom:`1px solid ${S.border}`,background:S.bg2,display:'flex',alignItems:'center',gap:14,flexShrink:0,flexWrap:'wrap'}}>
        <div style={{width:48,height:48,borderRadius:14,background:`linear-gradient(135deg,${S.gold},#d4943a)`,display:'flex',alignItems:'center',justifyContent:'center',fontSize:24,boxShadow:`0 0 20px ${S.gold}40`}}>💰</div>
        <div>
          <div style={{fontFamily:"'Syne',sans-serif",fontSize:17,fontWeight:900}}>PROPINAS <span style={{color:S.gold}}>SERATTA</span></div>
          <div style={{fontSize:10,color:S.t3,letterSpacing:'.1em',textTransform:'uppercase'}}>Bolsa del turno · Distribución en tiempo real</div>
        </div>

        {/* KPIs del día */}
        <div style={{display:'flex',gap:10,marginLeft:'auto',flexWrap:'wrap'}}>
          {[
            {l:'Bolsa total hoy',   v: fmt(bolsaGlobal?.bolsa_total||0),       c:S.gold,  e:'💰'},
            {l:'Cuentas cobradas',  v: bolsaGlobal?.total_cuentas||0,           c:S.blue,  e:'🧾'},
            {l:'Promedio propina',  v: `${bolsaGlobal?.pct_promedio||0}%`,      c:S.green, e:'📊'},
            {l:'Meseros activos',   v: bolsaGlobal?.meseros_activos||0,          c:S.purple,e:'👤'},
          ].map(k=>(
            <div key={k.l} style={{textAlign:'center',padding:'6px 14px',background:'rgba(255,255,255,0.04)',border:`1px solid ${k.c}20`,borderRadius:12}}>
              <div style={{fontSize:10,marginBottom:2}}>{k.e}</div>
              <div style={{fontSize:9,color:S.t3,textTransform:'uppercase',letterSpacing:'.06em'}}>{k.l}</div>
              <div style={{fontFamily:"'Syne',sans-serif",fontSize:18,fontWeight:900,color:k.c}}>{k.v}</div>
            </div>
          ))}
        </div>

        <input type="date" value={fechaFiltro} onChange={e=>setFechaFiltro(e.target.value)}
          style={{background:'rgba(255,255,255,0.05)',border:`1px solid ${S.border2}`,borderRadius:8,padding:'7px 12px',color:'#fff',fontSize:12,outline:'none'}}/>
      </div>

      {/* ── TABS ── */}
      <div style={{display:'flex',borderBottom:`1px solid ${S.border}`,background:S.bg2,padding:'0 24px',flexShrink:0}}>
        {([
          {id:'bolsa',       l:'💰 Bolsa del turno'},
          {id:'mis_propinas',l:'👤 Por mesero'},
          {id:'historial',   l:'📅 Historial 30 días'},
          ...(isGerencia?[{id:'config',l:'⚙️ Configuración'}]:[]),
        ] as {id:Tab,l:string}[]).map(t=>(
          <button key={t.id} onClick={()=>setTab(t.id)}
            style={{padding:'11px 16px',background:'none',border:'none',borderBottom:`2px solid ${tab===t.id?S.gold:'transparent'}`,color:tab===t.id?S.gold:S.t3,fontSize:12,fontWeight:700,cursor:'pointer',whiteSpace:'nowrap',transition:'all .15s'}}>
            {t.l}
          </button>
        ))}
      </div>

      <div style={{flex:1,overflow:'hidden',display:'flex'}}>

        {/* ══ BOLSA DEL TURNO ══ */}
        {tab==='bolsa' && (
          <div style={{flex:1,overflowY:'auto',padding:24}}>

            {/* Distribución visual */}
            <div style={{background:S.bg2,border:`1px solid ${S.gold}30`,borderRadius:16,padding:20,marginBottom:20}}>
              <div style={{fontFamily:"'Syne',sans-serif",fontSize:16,fontWeight:900,marginBottom:4}}>
                💰 Bolsa total: <span style={{color:S.gold}}>{fmt(bolsaGlobal?.bolsa_total||0)}</span>
              </div>
              <div style={{fontSize:11,color:S.t3,marginBottom:16}}>
                Distribución según configuración · {config.modo==='turno'?'Por turno':'Por cuentas'}
              </div>

              <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:14,marginBottom:16}}>
                {[
                  {label:'🧑‍💼 Meseros',   v:distribucion.meseros, pct:config.pct_meseros, c:S.gold},
                  {label:'👨‍🍳 Cocina',    v:distribucion.cocina,  pct:config.pct_cocina,  c:S.red},
                  {label:'🎩 Host / Apoyo',v:distribucion.host,  pct:config.pct_host,    c:S.blue},
                ].map(d=>(
                  <div key={d.label} style={{background:S.bg3,border:`1px solid ${d.c}20`,borderRadius:14,padding:'16px 18px'}}>
                    <div style={{fontSize:13,color:S.t2,marginBottom:8}}>{d.label}</div>
                    <div style={{fontFamily:"'Syne',sans-serif",fontSize:24,fontWeight:900,color:d.c,marginBottom:4}}>
                      {fmt(d.v)}
                    </div>
                    <div style={{fontSize:11,color:S.t3,marginBottom:8}}>{d.pct}% de la bolsa</div>
                    {/* Barra */}
                    <div style={{height:5,background:S.bg4,borderRadius:3,overflow:'hidden'}}>
                      <div style={{height:'100%',width:`${d.pct}%`,background:d.c,borderRadius:3}}/>
                    </div>
                  </div>
                ))}
              </div>

              {/* Distribución por mesero individualmente */}
              {bolsa.length > 0 && config.modo !== 'igualitario' && (
                <div style={{background:S.bg3,borderRadius:12,padding:14}}>
                  <div style={{fontSize:11,color:S.t3,fontWeight:700,marginBottom:10,textTransform:'uppercase',letterSpacing:'.06em'}}>
                    Desglose por mesero ({config.pct_meseros}% de cada quien)
                  </div>
                  <div style={{display:'flex',flexDirection:'column',gap:8}}>
                    {bolsa.map(b=>{
                      // Cada mesero se lleva el % de sus propias cuentas
                      const suParte = Math.round((b.total_propina||0) * config.pct_meseros / 100);
                      const participacion = pct(b.total_propina, totalPropinasMeseros);
                      return (
                        <div key={b.mesero_nombre} style={{display:'flex',alignItems:'center',gap:12}}>
                          <div style={{width:34,height:34,borderRadius:'50%',background:`linear-gradient(135deg,${S.gold},#d4943a)`,display:'flex',alignItems:'center',justifyContent:'center',fontSize:14,fontWeight:900,color:'#000',flexShrink:0}}>
                            {(b.mesero_nombre||'?').charAt(0)}
                          </div>
                          <div style={{flex:1}}>
                            <div style={{fontSize:13,fontWeight:700}}>{b.mesero_nombre}</div>
                            <div style={{fontSize:10,color:S.t3}}>{b.cuentas} cuenta{b.cuentas!==1?'s':''} · {b.pct_promedio}% promedio</div>
                            <div style={{height:3,background:S.bg4,borderRadius:2,marginTop:4,overflow:'hidden'}}>
                              <div style={{height:'100%',width:`${participacion}%`,background:S.gold,borderRadius:2}}/>
                            </div>
                          </div>
                          <div style={{textAlign:'right'}}>
                            <div style={{fontFamily:"'Syne',sans-serif",fontSize:16,fontWeight:900,color:S.gold}}>{fmt(suParte)}</div>
                            <div style={{fontSize:9,color:S.t3}}>propina base</div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Modo igualitario */}
              {config.modo === 'igualitario' && bolsa.length > 0 && (
                <div style={{background:S.bg3,borderRadius:12,padding:14}}>
                  <div style={{fontSize:11,color:S.t3,fontWeight:700,marginBottom:8}}>🤝 MODO IGUALITARIO — División entre {bolsa.length} meseros</div>
                  <div style={{fontFamily:"'Syne',sans-serif",fontSize:22,fontWeight:900,color:S.gold,marginBottom:4}}>
                    {fmt(Math.round(distribucion.meseros / bolsa.length))} por mesero
                  </div>
                  <div style={{fontSize:11,color:S.t3}}>{fmt(distribucion.meseros)} total ÷ {bolsa.length} meseros</div>
                </div>
              )}
            </div>

            {loading && <div style={{textAlign:'center',padding:40,color:S.t3}}>Cargando datos...</div>}
            {!loading && !bolsaGlobal && (
              <div style={{textAlign:'center',padding:60,color:S.t3}}>
                <div style={{fontSize:48,marginBottom:12}}>💰</div>
                <div style={{fontSize:14,fontWeight:700}}>Sin propinas registradas hoy</div>
                <div style={{fontSize:12,marginTop:6}}>Las propinas se registran automáticamente al cobrar cuentas en el POS</div>
              </div>
            )}
          </div>
        )}

        {/* ══ POR MESERO ══ */}
        {tab==='mis_propinas' && (
          <div style={{flex:1,overflowY:'auto',padding:24}}>
            <div style={{fontFamily:"'Syne',sans-serif",fontSize:16,fontWeight:900,marginBottom:20}}>
              👤 Propinas por mesero — {new Date(fechaFiltro+'T00:00:00').toLocaleDateString('es-CO',{weekday:'long',day:'numeric',month:'long'})}
            </div>
            {bolsa.length === 0 && (
              <div style={{textAlign:'center',padding:60,color:S.t3}}>
                <div style={{fontSize:48,marginBottom:12}}>👤</div>
                <div>Sin datos para esta fecha</div>
              </div>
            )}
            <div style={{display:'flex',flexDirection:'column',gap:12}}>
              {bolsa.map((b,i)=>{
                const suParte = config.modo==='igualitario'
                  ? Math.round(distribucion.meseros / Math.max(bolsa.length,1))
                  : Math.round((b.total_propina||0) * config.pct_meseros / 100);
                const rank = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `#${i+1}`;
                return (
                  <div key={b.mesero_nombre} style={{background:S.bg2,border:`1px solid ${i===0?`${S.gold}40`:S.border}`,borderRadius:16,padding:20}}>
                    <div style={{display:'flex',alignItems:'center',gap:14,marginBottom:14}}>
                      {/* Avatar */}
                      <div style={{width:52,height:52,borderRadius:'50%',background:`linear-gradient(135deg,${S.gold},#d4943a)`,display:'flex',alignItems:'center',justifyContent:'center',fontSize:20,fontWeight:900,color:'#000',flexShrink:0}}>
                        {(b.mesero_nombre||'?').charAt(0)}
                      </div>
                      <div style={{flex:1}}>
                        <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:2}}>
                          <span style={{fontFamily:"'Syne',sans-serif",fontSize:16,fontWeight:900}}>{b.mesero_nombre}</span>
                          <span style={{fontSize:16}}>{rank}</span>
                        </div>
                        <div style={{fontSize:11,color:S.t3}}>{b.cuentas} cuentas cobradas · {b.pct_promedio}% propina promedio</div>
                      </div>
                      <div style={{textAlign:'right'}}>
                        <div style={{fontSize:10,color:S.t3,marginBottom:2}}>Su parte</div>
                        <div style={{fontFamily:"'Syne',sans-serif",fontSize:22,fontWeight:900,color:S.gold}}>{fmt(suParte)}</div>
                      </div>
                    </div>

                    {/* Métricas */}
                    <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:10}}>
                      {[
                        {l:'Ventas cobradas', v:fmt(b.total_ventas||0), c:S.blue},
                        {l:'Propina total',   v:fmt(b.total_propina||0), c:S.gold},
                        {l:'% promedio',      v:`${b.pct_promedio}%`, c:S.green},
                        {l:'En efectivo',     v:fmt(b.propina_efectivo||0), c:S.cyan},
                      ].map(m=>(
                        <div key={m.l} style={{background:S.bg3,borderRadius:10,padding:'10px 12px'}}>
                          <div style={{fontSize:9,color:S.t3,marginBottom:3,textTransform:'uppercase',letterSpacing:'.05em'}}>{m.l}</div>
                          <div style={{fontSize:14,fontWeight:700,color:m.c}}>{m.v}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ══ HISTORIAL 30 DÍAS ══ */}
        {tab==='historial' && (
          <div style={{flex:1,overflowY:'auto',padding:24}}>
            <div style={{fontFamily:"'Syne',sans-serif",fontSize:16,fontWeight:900,marginBottom:20}}>📅 Historial — últimos 30 días</div>

            {/* Agrupar por fecha */}
            {Object.entries(
              historial.reduce((acc:any, h:any) => {
                if (!acc[h.fecha]) acc[h.fecha] = [];
                acc[h.fecha].push(h);
                return acc;
              }, {})
            ).map(([fecha, meseros]:any) => {
              const totalDia = meseros.reduce((s:number,m:any)=>s+(m.total_propina||0), 0);
              return (
                <div key={fecha} style={{background:S.bg2,border:`1px solid ${S.border}`,borderRadius:14,padding:'14px 18px',marginBottom:10}}>
                  <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:10}}>
                    <div>
                      <div style={{fontSize:13,fontWeight:700}}>{new Date(fecha+'T00:00:00').toLocaleDateString('es-CO',{weekday:'long',day:'numeric',month:'long'})}</div>
                      <div style={{fontSize:10,color:S.t3}}>{meseros.length} mesero{meseros.length!==1?'s':''} · {meseros.reduce((s:number,m:any)=>s+(m.cuentas||0),0)} cuentas</div>
                    </div>
                    <div style={{fontFamily:"'Syne',sans-serif",fontSize:20,fontWeight:900,color:S.gold}}>{fmt(totalDia)}</div>
                  </div>
                  <div style={{display:'flex',gap:6,flexWrap:'wrap'}}>
                    {meseros.map((m:any)=>(
                      <div key={m.mesero_nombre} style={{display:'flex',alignItems:'center',gap:6,padding:'4px 10px',background:S.bg3,borderRadius:20}}>
                        <span style={{width:6,height:6,borderRadius:'50%',background:S.gold,display:'inline-block'}}/>
                        <span style={{fontSize:11,color:S.t2}}>{m.mesero_nombre}</span>
                        <span style={{fontSize:11,fontWeight:700,color:S.gold}}>{fmt(m.total_propina||0)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
            {historial.length === 0 && (
              <div style={{textAlign:'center',padding:60,color:S.t3}}>
                <div style={{fontSize:48,marginBottom:12}}>📅</div>
                <div>Sin historial disponible</div>
              </div>
            )}
          </div>
        )}

        {/* ══ CONFIGURACIÓN (solo gerencia) ══ */}
        {tab==='config' && isGerencia && (
          <div style={{flex:1,overflowY:'auto',padding:24}}>
            <div style={{maxWidth:600,margin:'0 auto'}}>
              <div style={{fontFamily:"'Syne',sans-serif",fontSize:16,fontWeight:900,marginBottom:4}}>⚙️ Configuración de propinas</div>
              <div style={{fontSize:12,color:S.t2,marginBottom:24}}>Define cómo se distribuye la bolsa y qué porcentaje se sugiere al cliente.</div>

              {/* Porcentaje sugerido al cliente */}
              <div style={{background:S.bg2,border:`1px solid ${S.border}`,borderRadius:14,padding:18,marginBottom:16}}>
                <div style={{fontSize:13,fontWeight:700,marginBottom:12}}>💳 Propina sugerida al cliente</div>
                <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
                  {[0,8,10,12,15,20].map(p=>(
                    <button key={p} onClick={()=>setConfig((c:any)=>({...c,pct_sugerido:p}))}
                      style={{padding:'10px 18px',borderRadius:10,border:`1px solid ${config.pct_sugerido===p?S.gold:S.border}`,background:config.pct_sugerido===p?`${S.gold}15`:'transparent',color:config.pct_sugerido===p?S.gold:S.t3,fontSize:13,fontWeight:700,cursor:'pointer'}}>
                      {p}%{p===10?' (Ley)':p===0?' (Voluntaria)':''}
                    </button>
                  ))}
                </div>
                <div style={{fontSize:10,color:S.t3,marginTop:8}}>
                  ℹ️ Ley 1393 de 2010 — La propina es 100% voluntaria en Colombia. Se sugiere 10%.
                </div>
              </div>

              {/* Modo de distribución */}
              <div style={{background:S.bg2,border:`1px solid ${S.border}`,borderRadius:14,padding:18,marginBottom:16}}>
                <div style={{fontSize:13,fontWeight:700,marginBottom:12}}>📊 Modo de distribución</div>
                <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
                  {[
                    {v:'turno',       l:'Por turno',        d:'Cada mesero se lleva % de sus propias cuentas'},
                    {v:'igualitario', l:'Igualitario',       d:'Se divide en partes iguales entre todos'},
                  ].map(m=>(
                    <button key={m.v} onClick={()=>setConfig((c:any)=>({...c,modo:m.v}))}
                      style={{flex:1,padding:'12px 16px',borderRadius:12,border:`1px solid ${config.modo===m.v?S.blue:S.border}`,background:config.modo===m.v?`${S.blue}10`:'transparent',textAlign:'left',cursor:'pointer'}}>
                      <div style={{fontSize:12,fontWeight:700,color:config.modo===m.v?S.blue:S.t1,marginBottom:3}}>{m.l}</div>
                      <div style={{fontSize:10,color:S.t3}}>{m.d}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Distribución por rol */}
              <div style={{background:S.bg2,border:`1px solid ${S.border}`,borderRadius:14,padding:18,marginBottom:20}}>
                <div style={{fontSize:13,fontWeight:700,marginBottom:4}}>🔀 Distribución por rol</div>
                <div style={{fontSize:11,color:S.t3,marginBottom:14}}>
                  Total: <span style={{color:config.pct_meseros+config.pct_cocina+config.pct_host===100?S.green:S.red,fontWeight:700}}>
                    {config.pct_meseros+config.pct_cocina+config.pct_host}%
                  </span> {config.pct_meseros+config.pct_cocina+config.pct_host!==100?' ⚠️ Debe sumar 100%':'✓ Correcto'}
                </div>

                {[
                  {k:'pct_meseros',l:'🧑‍💼 Meseros',    c:S.gold},
                  {k:'pct_cocina', l:'👨‍🍳 Cocina',     c:S.red},
                  {k:'pct_host',   l:'🎩 Host / Apoyo', c:S.blue},
                ].map(f=>(
                  <div key={f.k} style={{marginBottom:14}}>
                    <div style={{display:'flex',justifyContent:'space-between',marginBottom:6}}>
                      <span style={{fontSize:12,color:S.t2}}>{f.l}</span>
                      <span style={{fontSize:13,fontWeight:700,color:f.c}}>{config[f.k]}%</span>
                    </div>
                    <input type="range" min={0} max={100} value={config[f.k]}
                      onChange={e=>setConfig((c:any)=>({...c,[f.k]:Number(e.target.value)}))}
                      style={{width:'100%',accentColor:f.c}}/>
                    <div style={{height:4,background:S.bg3,borderRadius:2,marginTop:4,overflow:'hidden'}}>
                      <div style={{height:'100%',width:`${config[f.k]}%`,background:f.c,borderRadius:2,transition:'width .2s'}}/>
                    </div>
                  </div>
                ))}
              </div>

              <button onClick={async()=>{
                setGuardandoConfig(true);
                await supabase.from('propinas_config').update({
                  pct_meseros:config.pct_meseros,
                  pct_cocina:config.pct_cocina,
                  pct_host:config.pct_host,
                  modo:config.modo,
                  pct_sugerido:config.pct_sugerido,
                  updated_at:new Date().toISOString()
                }).eq('restaurante_id',6);
                setGuardandoConfig(false);
                show('✓ Configuración guardada');
              }} disabled={guardandoConfig || config.pct_meseros+config.pct_cocina+config.pct_host!==100}
                style={{width:'100%',padding:'13px',borderRadius:12,border:'none',background:guardandoConfig||config.pct_meseros+config.pct_cocina+config.pct_host!==100?S.bg3:`linear-gradient(135deg,${S.gold},#d4943a)`,color:'#000',fontSize:13,fontWeight:700,cursor:'pointer'}}>
                {guardandoConfig?'Guardando...':'✓ Guardar configuración'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
