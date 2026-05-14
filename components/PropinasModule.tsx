import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase.ts';
import { useAuth } from '../contexts/AuthContext';

// ══ PALETA ══
const S = {
  bg:'#08080f', bg2:'#0f0f1a', bg3:'#161624', bg4:'#1e1e2e',
  border:'rgba(255,255,255,0.07)', border2:'rgba(255,255,255,0.12)',
  t1:'#fff', t2:'#A0A0B8', t3:'#50506A',
  gold:'#FFB547', green:'#00E676', red:'#FF5252',
  blue:'#448AFF', purple:'#B388FF', cyan:'#22d3ee', neon:'#DFFF00',
};
const fmt  = (n:number) => `$${Math.round(n).toLocaleString('es-CO')}`;
const fmtPct = (n:number) => `${(n*100).toFixed(2)}%`;

// ══ POOLS V5 — espejo exacto del documento ══
const POOLS_V5 = [
  {code:'DIRECT_TABLE_SERVICE',          pct:0.2300, name:'Servicio directo de mesa',         emoji:'🧑‍💼', color:'#FFB547', visible:true},
  {code:'SERVICE_LEADERSHIP_EXPERIENCE', pct:0.0500, name:'Liderazgo y experiencia',           emoji:'👔', color:'#B388FF', visible:true},
  {code:'SALES_ACCELERATOR',             pct:0.0480, name:'Acelerador de ventas',              emoji:'📈', color:'#00E676', visible:true},
  {code:'FOOD_PRODUCTION',               pct:0.1600, name:'Producción de cocina',              emoji:'🔥', color:'#FF5252', visible:true},
  {code:'BAR_MIXOLOGY_PRODUCTION',       pct:0.0700, name:'Bar y mixología',                   emoji:'🍸', color:'#448AFF', visible:true},
  {code:'PRODUCTION_SUPPORT',            pct:0.0400, name:'Apoyo operativo',                   emoji:'⚙️', color:'#22d3ee', visible:true},
  {code:'QUALITY_TIMING_BONUS',          pct:0.0474, name:'Calidad y tiempos',                 emoji:'⭐', color:'#DFFF00', visible:true},
  {code:'BACK_SUPPORT',                  pct:0.0893, name:'Soporte back-office',               emoji:'🏢', color:'#606060', visible:false},
  {code:'ADMIN_SERVICE_BACKBONE',        pct:0.2652, name:'Bolsa corporativa administrativa',  emoji:'🏦', color:'#404040', visible:false},
];

const WALLET_ESTADOS: Record<string,{c:string,l:string}> = {
  GENERATED:  {c:'#FFB547', l:'⏳ Generado'},
  ESTIMATED:  {c:'#22d3ee', l:'📊 Estimado'},
  CONFIRMED:  {c:'#00E676', l:'✓ Confirmado'},
  AVAILABLE:  {c:'#00E676', l:'💳 Disponible'},
  REQUESTED:  {c:'#B388FF', l:'🔄 Solicitado'},
  PROCESSING: {c:'#FFB547', l:'⚙️ Procesando'},
  PAID:       {c:'#3dba6f', l:'✅ Pagado'},
  ADJUSTED:   {c:'#FF9800', l:'🔧 Ajustado'},
  HELD:       {c:'#FF5252', l:'🔒 Retenido'},
};

type Tab = 'bolsa'|'wallet'|'ranking'|'equipo'|'config'|'backoffice'|'admin';

export default function PropinasModule() {
  const { profile } = useAuth();
  const isGerencia = ['admin','gerencia','desarrollo'].includes(profile?.role||'');

  const [tab, setTab]                   = useState<Tab>('bolsa');
  const [fechaFiltro, setFechaFiltro]   = useState(new Date().toISOString().split('T')[0]);
  const [loading, setLoading]           = useState(false);
  const [toast, setToast]               = useState('');
  // Datos
  const [resumenDia, setResumenDia]     = useState<any>(null);
  const [wallet, setWallet]             = useState<any[]>([]);
  const [ranking, setRanking]           = useState<any[]>([]);
  const [distribuciones, setDistrib]    = useState<any[]>([]);
  const [equipo, setEquipo]             = useState<any[]>([]);
  const [tags, setTags]                 = useState<any[]>([]);
  const [config, setConfig]             = useState<any>(null);
  const [backoffice, setBackoffice]     = useState<any[]>([]);
  const [confirmandoTurno, setConfirm]  = useState(false);
  // Admin equipo
  const [staff, setStaff]               = useState<any[]>([]);
  const [staffForm, setStaffForm]       = useState<any>({nombre:'',rol:'mesero',turno:'noche',restaurante_id:6,activo:true,turno_partido:false});
  const [editingStaff, setEditingStaff] = useState<any>(null);
  const [staffTab, setStaffTab]         = useState<'activos'|'inactivos'|'nuevo'>('activos');
  const [fotoPreview, setFotoPreview]   = useState<string>('');
  const [retiroMonto, setRetiroMonto]   = useState(0);
  const [retiroEmpleado, setRetiroEmp]  = useState('');

  const show = (m:string) => { setToast(m); setTimeout(()=>setToast(''),3500); };

  const fetchAll = useCallback(async () => {
    setLoading(true);
    const [rd, wl, rk, eq, tg, cfg, bo] = await Promise.all([
      supabase.from('vista_tipnetwork_dia').select('*').eq('fecha', fechaFiltro).maybeSingle(),
      supabase.from('vista_wallet_empleado').select('*').eq('restaurante_id', 6).order('saldo_actual', {ascending:false}),
      supabase.from('vista_ranking_period').select('*').eq('fecha', fechaFiltro).order('total_ganado', {ascending:false}).limit(50),
      supabase.from('employee_functional_tags').select('*,functional_tags(tag_name,categoria,pool_codes)').eq('restaurante_id', 6).eq('activo', true),
      supabase.from('functional_tags').select('*').eq('restaurante_id', 6).eq('activo', true).order('categoria'),
      supabase.from('tip_policies').select('*,tip_policy_pools(*)').eq('restaurante_id', 6).eq('activa', true).maybeSingle(),
      supabase.from('backoffice_settlements').select('*').eq('restaurante_id', 6).order('created_at', {ascending:false}).limit(30),
    ]);
    if (rd.data)   setResumenDia(rd.data);
    if (wl.data)   setWallet(wl.data);
    if (rk.data)   setRanking(rk.data);
    if (eq.data)   setEquipo(eq.data);
    if (tg.data)   setTags(tg.data);
    if (cfg.data)  setConfig(cfg.data);
    if (bo.data)   setBackoffice(bo.data);
    // Staff completo para admin
    const st = await supabase.from('staff_nexum').select('*').eq('restaurante_id',6).order('nombre');
    if (st.data) setStaff(st.data);
    setLoading(false);
  }, [fechaFiltro]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  // Realtime — llega propina nueva
  useEffect(() => {
    const ch = supabase.channel('tip-network-live')
      .on('postgres_changes', { event:'INSERT', schema:'public', table:'tip_events' }, () => {
        fetchAll(); show('💰 Nueva propina distribuida automáticamente');
      }).subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [fetchAll]);

  // Confirmar turno — libera wallets a AVAILABLE
  const confirmarTurno = async () => {
    setConfirm(true);
    const {data} = await supabase.rpc('confirmar_wallet_turno', {
      p_fecha: fechaFiltro, p_turno:'noche', p_restaurante:6
    });
    if (data?.ok) { show(`✓ ${data.registros_liberados} wallets liberados`); fetchAll(); }
    else show('⚠️ Error al confirmar turno');
    setConfirm(false);
  };

  // Solicitar retiro
  const solicitarRetiro = async () => {
    if (!retiroEmpleado || retiroMonto < 200000) { show('⚠️ Mínimo $200.000 COP'); return; }
    const {data} = await supabase.rpc('solicitar_retiro_wallet', {
      p_empleado:retiroEmpleado, p_restaurante:6, p_monto:retiroMonto
    });
    if (data?.ok) { show(`✓ Retiro solicitado: ${fmt(retiroMonto)}`); fetchAll(); setRetiroMonto(0); setRetiroEmpleado(''); }
    else show(data?.error || 'Error al solicitar retiro');
  };

  return (
    <div style={{height:'100%',display:'flex',flexDirection:'column',background:S.bg,color:S.t1,fontFamily:"'DM Sans',sans-serif",overflow:'hidden'}}>
      {toast&&<div style={{position:'fixed',bottom:24,left:'50%',transform:'translateX(-50%)',background:'#1e1e2e',border:`1px solid ${S.gold}`,color:'#fff',padding:'10px 28px',borderRadius:50,fontSize:13,fontWeight:700,zIndex:9999,whiteSpace:'nowrap'}}>{toast}</div>}

      {/* ── HEADER ── */}
      <div style={{padding:'12px 24px',borderBottom:`1px solid ${S.border}`,background:S.bg2,display:'flex',alignItems:'center',gap:14,flexShrink:0,flexWrap:'wrap'}}>
        <div style={{display:'flex',alignItems:'center',gap:12}}>
          <div style={{width:48,height:48,borderRadius:14,background:`linear-gradient(135deg,${S.gold},#d4943a)`,display:'flex',alignItems:'center',justifyContent:'center',fontSize:24,boxShadow:`0 0 24px ${S.gold}40`}}>💰</div>
          <div>
            <div style={{fontFamily:"'Syne',sans-serif",fontSize:16,fontWeight:900}}>NEXUM <span style={{color:S.gold}}>TIP NETWORK</span> <span style={{fontSize:11,color:S.t3}}>V5</span></div>
            <div style={{fontSize:9,color:S.t3,letterSpacing:'.1em',textTransform:'uppercase'}}>Policy Engine Autónomo · 9 Pools · Score por Contribución Real</div>
          </div>
        </div>

        {/* KPIs del día */}
        {resumenDia && (
          <div style={{display:'flex',gap:10,marginLeft:'auto',flexWrap:'wrap'}}>
            {[
              {l:'Bolsa hoy',   v:fmt(resumenDia.bolsa_total||0),    c:S.gold,   e:'💰'},
              {l:'Eventos',     v:resumenDia.total_eventos||0,         c:S.blue,   e:'🧾'},
              {l:'% Promedio',  v:`${resumenDia.pct_promedio||0}%`,   c:S.green,  e:'📊'},
              {l:'Sin asignar', v:fmt(resumenDia.total_unassigned||0),c:resumenDia.total_unassigned>0?S.red:S.green, e:'⚠️'},
            ].map(k=>(
              <div key={k.l} style={{textAlign:'center',padding:'5px 12px',background:'rgba(255,255,255,0.04)',border:`1px solid ${k.c}20`,borderRadius:10}}>
                <div style={{fontSize:10,marginBottom:1}}>{k.e}</div>
                <div style={{fontSize:8,color:S.t3,textTransform:'uppercase'}}>{k.l}</div>
                <div style={{fontFamily:"'Syne',sans-serif",fontSize:16,fontWeight:900,color:k.c}}>{k.v}</div>
              </div>
            ))}
          </div>
        )}
        <input type="date" value={fechaFiltro} onChange={e=>setFechaFiltro(e.target.value)}
          style={{background:'rgba(255,255,255,0.05)',border:`1px solid ${S.border2}`,borderRadius:8,padding:'7px 12px',color:'#fff',fontSize:12,outline:'none'}}/>
      </div>

      {/* ── TABS ── */}
      <div style={{display:'flex',borderBottom:`1px solid ${S.border}`,background:S.bg2,padding:'0 24px',flexShrink:0,overflowX:'auto'}}>
        {([
          {id:'bolsa',      l:'💰 Bolsa del día'},
          {id:'wallet',     l:'💳 Wallet'},
          {id:'ranking',    l:'🏆 Ranking'},
          ...(isGerencia ? [
            {id:'equipo',   l:'👥 Equipo & Tags'},
            {id:'config',   l:'⚙️ Política V5'},
            {id:'backoffice',l:'🏢 Backoffice'},
          ] : []),
        ] as {id:Tab,l:string}[]).map(t=>(
          <button key={t.id} onClick={()=>setTab(t.id)}
            style={{padding:'10px 16px',background:'none',border:'none',borderBottom:`2px solid ${tab===t.id?S.gold:'transparent'}`,color:tab===t.id?S.gold:S.t3,fontSize:11,fontWeight:700,cursor:'pointer',whiteSpace:'nowrap',transition:'all .15s'}}>
            {t.l}
          </button>
        ))}
      </div>

      <div style={{flex:1,overflow:'hidden',display:'flex'}}>

        {/* ══ BOLSA DEL DÍA ══ */}
        {tab==='bolsa' && (
          <div style={{flex:1,overflowY:'auto',padding:24}}>

            {/* Los 9 pools visualizados */}
            <div style={{fontFamily:"'Syne',sans-serif",fontSize:15,fontWeight:900,marginBottom:4}}>
              Los 9 pools — Distribución de <span style={{color:S.gold}}>{fmt(resumenDia?.bolsa_total||0)}</span>
            </div>
            <div style={{fontSize:11,color:S.t2,marginBottom:20}}>
              Cada propina se separa automáticamente en 9 pools. Los pools con wallet visible aparecen en la app del mesero en tiempo real.
            </div>

            <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(220px,1fr))',gap:12,marginBottom:24}}>
              {POOLS_V5.map(pool=>{
                const montoPool = resumenDia ? Math.round((resumenDia.bolsa_total||0)*pool.pct) : 0;
                const poolData = resumenDia ? (resumenDia as any)[`pool_${pool.code.toLowerCase().replace('_production','').replace('_service','').replace('_mixology','').replace('service','servicio').replace('bar_','bar').replace('back_support','').replace('admin_service_backbone','').replace('quality_timing_bonus','calidad').replace('production_support','apoyo').replace('sales_accelerator','ventas').replace('service_leadership_experience','liderazgo').replace('direct_table_','').replace('food_','cocina')}` ] : 0;
                return (
                  <div key={pool.code} style={{background:pool.visible?S.bg2:`${S.bg3}99`,border:`1px solid ${pool.color}${pool.visible?'40':'20'}`,borderRadius:14,padding:'14px 16px',opacity:pool.visible?1:0.75}}>
                    <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:8}}>
                      <span style={{fontSize:20}}>{pool.emoji}</span>
                      <div style={{flex:1,minWidth:0}}>
                        <div style={{fontSize:11,fontWeight:700,color:pool.color,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{pool.code.replace(/_/g,' ')}</div>
                        <div style={{fontSize:9,color:S.t3}}>{pool.name}</div>
                      </div>
                      {!pool.visible && <span style={{fontSize:8,color:S.t3,background:S.bg4,padding:'2px 6px',borderRadius:10,whiteSpace:'nowrap'}}>Backoffice</span>}
                    </div>
                    <div style={{fontFamily:"'Syne',sans-serif",fontSize:22,fontWeight:900,color:pool.color,marginBottom:4}}>
                      {fmt(montoPool)}
                    </div>
                    <div style={{display:'flex',justifyContent:'space-between',fontSize:10,color:S.t3,marginBottom:6}}>
                      <span>{fmtPct(pool.pct)} de la propina</span>
                    </div>
                    <div style={{height:4,background:S.bg4,borderRadius:2,overflow:'hidden'}}>
                      <div style={{height:'100%',width:`${pool.pct*100}%`,background:pool.color,borderRadius:2}}/>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Fórmula del documento */}
            <div style={{background:S.bg2,border:`1px solid ${S.border}`,borderRadius:16,padding:18,marginBottom:20}}>
              <div style={{fontFamily:"'Syne',sans-serif",fontSize:13,fontWeight:900,marginBottom:10,color:S.cyan}}>
                📐 Fórmula universal del motor V5
              </div>
              <div style={{fontFamily:'monospace',fontSize:11,color:S.t2,lineHeight:1.8,background:S.bg3,padding:'12px 14px',borderRadius:10}}>
                <span style={{color:S.gold}}>pool_amount</span> = ticket.tip × pool_percentage<br/>
                <span style={{color:S.gold}}>employee_score</span> = eligibility × presence_multiplier × contribution_score × performance_multiplier × quality_multiplier × penalty_multiplier<br/>
                <span style={{color:S.gold}}>employee_amount</span> = pool_amount × <span style={{color:S.cyan}}>employee_score / sum(all_eligible_scores)</span><br/>
                <span style={{color:S.t3}}>// Si sum(scores) = 0 → UNASSIGNED_POOL → fallback automático</span>
              </div>
            </div>

            {/* Confirmar turno — gerencia */}
            {isGerencia && (
              <div style={{background:`${S.green}08`,border:`1px solid ${S.green}20`,borderRadius:14,padding:16,display:'flex',alignItems:'center',gap:14}}>
                <div style={{flex:1}}>
                  <div style={{fontSize:13,fontWeight:700,marginBottom:3}}>✓ Confirmar cierre del turno</div>
                  <div style={{fontSize:11,color:S.t3}}>
                    Libera los wallets de GENERATED → AVAILABLE. El equipo puede solicitar retiro después de esto. SLA: máximo 2 días.
                  </div>
                </div>
                <button onClick={confirmarTurno} disabled={confirmandoTurno}
                  style={{padding:'10px 20px',borderRadius:10,border:'none',background:confirmandoTurno?S.bg3:`linear-gradient(135deg,${S.green},#009944)`,color:'#000',fontSize:12,fontWeight:700,cursor:'pointer',whiteSpace:'nowrap'}}>
                  {confirmandoTurno ? '⏳ Procesando...' : '⚡ Confirmar turno'}
                </button>
              </div>
            )}
          </div>
        )}

        {/* ══ WALLET ══ */}
        {tab==='wallet' && (
          <div style={{flex:1,overflowY:'auto',padding:24}}>
            <div style={{fontFamily:"'Syne',sans-serif",fontSize:15,fontWeight:900,marginBottom:4}}>💳 Wallets del equipo</div>
            <div style={{fontSize:11,color:S.t2,marginBottom:20}}>
              Cada persona ve su acumulado: ganado hoy, pendiente por cierre y disponible para retiro. Mínimo de retiro: {fmt(200000)}.
            </div>

            {/* Solicitar retiro */}
            {isGerencia && (
              <div style={{background:S.bg2,border:`1px solid ${S.border}`,borderRadius:14,padding:16,marginBottom:20}}>
                <div style={{fontSize:12,fontWeight:700,marginBottom:10}}>Procesar retiro</div>
                <div style={{display:'flex',gap:10,flexWrap:'wrap'}}>
                  <select value={retiroEmpleado} onChange={e=>setRetiroEmp(e.target.value)}
                    style={{flex:1,padding:'9px 12px',borderRadius:8,border:`1px solid ${S.border}`,background:S.bg3,color:'#fff',fontSize:12,outline:'none',minWidth:140}}>
                    <option value="">Selecciona empleado...</option>
                    {wallet.map(w=><option key={w.empleado_nombre} value={w.empleado_nombre}>{w.empleado_nombre} ({fmt(w.disponible_retiro||0)})</option>)}
                  </select>
                  <input type="number" placeholder="Monto (min $200.000)" value={retiroMonto||''} onChange={e=>setRetiroMonto(Number(e.target.value))}
                    style={{flex:1,padding:'9px 12px',borderRadius:8,border:`1px solid ${S.border}`,background:S.bg3,color:'#fff',fontSize:12,outline:'none',minWidth:160}}/>
                  <button onClick={solicitarRetiro}
                    style={{padding:'9px 18px',borderRadius:8,border:'none',background:S.purple,color:'#fff',fontSize:12,fontWeight:700,cursor:'pointer',whiteSpace:'nowrap'}}>
                    Procesar retiro
                  </button>
                </div>
              </div>
            )}

            {/* Cards de wallet por persona */}
            {wallet.length === 0 && !loading && (
              <div style={{textAlign:'center',padding:60,color:S.t3}}>
                <div style={{fontSize:48,marginBottom:12}}>💳</div>
                <div>Sin datos de wallet para esta fecha</div>
              </div>
            )}
            <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(280px,1fr))',gap:14}}>
              {wallet.map(w=>(
                <div key={w.empleado_nombre} style={{background:S.bg2,border:`1px solid ${w.puede_retirar?`${S.green}40`:S.border}`,borderRadius:16,padding:18}}>
                  <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:14}}>
                    <div style={{width:42,height:42,borderRadius:'50%',background:`linear-gradient(135deg,${S.gold},#d4943a)`,display:'flex',alignItems:'center',justifyContent:'center',fontSize:18,fontWeight:900,color:'#000',flexShrink:0}}>
                      {(w.empleado_nombre||'?').charAt(0)}
                    </div>
                    <div style={{flex:1}}>
                      <div style={{fontSize:14,fontWeight:700}}>{w.empleado_nombre}</div>
                      {w.puede_retirar && <span style={{fontSize:9,background:`${S.green}15`,color:S.green,border:`1px solid ${S.green}30`,padding:'1px 8px',borderRadius:20,fontWeight:700}}>💳 Puede retirar</span>}
                    </div>
                    <div style={{textAlign:'right'}}>
                      <div style={{fontSize:9,color:S.t3}}>Saldo actual</div>
                      <div style={{fontFamily:"'Syne',sans-serif",fontSize:20,fontWeight:900,color:S.gold}}>{fmt(w.saldo_actual||0)}</div>
                    </div>
                  </div>

                  <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8}}>
                    {[
                      {l:'Ganado hoy',        v:fmt(w.ganado_hoy||0),          c:S.gold},
                      {l:'Pendiente cierre',  v:fmt(w.pendiente_cierre||0),     c:'#FFB547'},
                      {l:'Disponible retiro', v:fmt(w.disponible_retiro||0),    c:S.green},
                      {l:'Total histórico',   v:fmt(w.total_historico||0),      c:S.blue},
                    ].map(m=>(
                      <div key={m.l} style={{background:S.bg3,borderRadius:8,padding:'8px 10px'}}>
                        <div style={{fontSize:8,color:S.t3,marginBottom:2,textTransform:'uppercase'}}>{m.l}</div>
                        <div style={{fontSize:13,fontWeight:700,color:m.c}}>{m.v}</div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ══ RANKING ══ */}
        {tab==='ranking' && (
          <div style={{flex:1,overflowY:'auto',padding:24}}>
            <div style={{fontFamily:"'Syne',sans-serif",fontSize:15,fontWeight:900,marginBottom:4}}>🏆 Ranking por pool</div>
            <div style={{fontSize:11,color:S.t2,marginBottom:20}}>
              Quién generó más en cada pool. Los que trabajan más y mejor, ganan más. Sin excepción.
            </div>

            {/* Agrupar por pool */}
            {[...new Set(ranking.map(r=>r.pool_code))].map(poolCode=>{
              const pool = POOLS_V5.find(p=>p.code===poolCode);
              const rows = ranking.filter(r=>r.pool_code===poolCode).slice(0,5);
              return (
                <div key={poolCode} style={{background:S.bg2,border:`1px solid ${pool?.color||S.border}20`,borderRadius:14,marginBottom:16,overflow:'hidden'}}>
                  <div style={{padding:'10px 16px',background:`${pool?.color||S.border}10`,borderBottom:`1px solid ${pool?.color||S.border}20`,display:'flex',alignItems:'center',gap:10}}>
                    <span style={{fontSize:18}}>{pool?.emoji||'💰'}</span>
                    <div style={{flex:1}}>
                      <div style={{fontSize:12,fontWeight:700,color:pool?.color||S.t1}}>{poolCode.replace(/_/g,' ')}</div>
                      <div style={{fontSize:9,color:S.t3}}>{pool?.name} · {fmtPct(pool?.pct||0)}</div>
                    </div>
                    <div style={{fontSize:11,color:S.t3}}>{rows.length} persona{rows.length!==1?'s':''}</div>
                  </div>
                  {rows.map((r,i)=>(
                    <div key={r.empleado_nombre} style={{display:'flex',alignItems:'center',gap:12,padding:'9px 16px',borderBottom:`1px solid rgba(255,255,255,0.03)`}}>
                      <div style={{width:24,height:24,borderRadius:8,background:i===0?`${pool?.color}30`:S.bg4,display:'flex',alignItems:'center',justifyContent:'center',fontSize:11,fontWeight:900,color:i===0?pool?.color:S.t3,flexShrink:0}}>
                        {i===0?'🥇':i===1?'🥈':i===2?'🥉':`${i+1}`}
                      </div>
                      <div style={{flex:1,fontSize:13,fontWeight:600}}>{r.empleado_nombre}</div>
                      <div style={{textAlign:'right'}}>
                        <div style={{fontFamily:"'Syne',sans-serif",fontSize:15,fontWeight:900,color:pool?.color||S.gold}}>{fmt(r.total_ganado||0)}</div>
                        <div style={{fontSize:9,color:S.t3}}>{r.pct_del_pool}% del pool · score {parseFloat(r.score_promedio||0).toFixed(3)}</div>
                      </div>
                      <div style={{width:60,height:4,background:S.bg4,borderRadius:2,overflow:'hidden',flexShrink:0}}>
                        <div style={{height:'100%',width:`${r.pct_del_pool}%`,background:pool?.color||S.gold,borderRadius:2}}/>
                      </div>
                    </div>
                  ))}
                </div>
              );
            })}
            {ranking.length === 0 && !loading && (
              <div style={{textAlign:'center',padding:60,color:S.t3}}>
                <div style={{fontSize:48,marginBottom:12}}>🏆</div>
                <div>Sin eventos de propina para esta fecha</div>
                <div style={{fontSize:11,marginTop:6}}>Los rankings se generan automáticamente al cobrar cuentas con propina en el POS</div>
              </div>
            )}
          </div>
        )}

        {/* ══ EQUIPO & TAGS ══ */}
        {tab==='equipo' && isGerencia && (
          <div style={{flex:1,overflow:'hidden',display:'flex'}}>
            {/* Tags disponibles */}
            <div style={{width:280,borderRight:`1px solid ${S.border}`,padding:16,overflowY:'auto',flexShrink:0}}>
              <div style={{fontFamily:"'Syne',sans-serif",fontSize:13,fontWeight:900,marginBottom:12}}>Tags funcionales</div>
              <div style={{fontSize:10,color:S.t3,marginBottom:12}}>Sin cargos quemados en código. Cada restaurante configura sus propios roles.</div>
              {tags.map(t=>(
                <div key={t.tag_code} style={{background:S.bg2,border:`1px solid ${S.border}`,borderRadius:10,padding:'10px 12px',marginBottom:8}}>
                  <div style={{fontSize:11,fontWeight:700,color:S.t1,marginBottom:2}}>{t.tag_code}</div>
                  <div style={{fontSize:10,color:S.t3,marginBottom:4}}>{t.tag_name}</div>
                  <div style={{fontSize:9,color:S.blue,background:`${S.blue}10`,padding:'2px 8px',borderRadius:20,display:'inline-block'}}>{t.categoria}</div>
                  <div style={{marginTop:4,display:'flex',flexWrap:'wrap',gap:3}}>
                    {(t.pool_codes||[]).map((p:string)=>(
                      <span key={p} style={{fontSize:8,color:POOLS_V5.find(x=>x.code===p)?.color||S.t3,background:`${POOLS_V5.find(x=>x.code===p)?.color||S.t3}10`,padding:'1px 6px',borderRadius:10}}>
                        {p.replace(/_/g,' ')}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
            {/* Asignaciones de equipo */}
            <div style={{flex:1,overflowY:'auto',padding:20}}>
              <div style={{fontFamily:"'Syne',sans-serif",fontSize:13,fontWeight:900,marginBottom:12}}>Equipo asignado</div>
              <div style={{display:'flex',flexDirection:'column',gap:8}}>
                {equipo.map(e=>(
                  <div key={e.id} style={{background:S.bg2,border:`1px solid ${S.border}`,borderRadius:10,padding:'10px 14px',display:'flex',alignItems:'center',gap:10}}>
                    <div style={{width:36,height:36,borderRadius:'50%',background:`linear-gradient(135deg,${S.purple},${S.blue})`,display:'flex',alignItems:'center',justifyContent:'center',fontSize:16,fontWeight:900,color:'#fff',flexShrink:0}}>
                      {(e.empleado_nombre||'?').charAt(0)}
                    </div>
                    <div style={{flex:1}}>
                      <div style={{fontSize:12,fontWeight:700}}>{e.empleado_nombre}</div>
                      <div style={{display:'flex',gap:4,flexWrap:'wrap',marginTop:2}}>
                        <span style={{fontSize:9,color:S.gold,background:`${S.gold}10`,padding:'1px 7px',borderRadius:10}}>{e.tag_code}</span>
                        {e.has_external_commission && <span style={{fontSize:9,color:S.red,background:`${S.red}10`,padding:'1px 7px',borderRadius:10}}>Sin SALES_ACCELERATOR</span>}
                      </div>
                    </div>
                    <div style={{fontSize:10,color:S.t3}}>{e.vigencia_desde}</div>
                  </div>
                ))}
              </div>
              {equipo.length === 0 && (
                <div style={{textAlign:'center',padding:40,color:S.t3}}>
                  <div style={{fontSize:40,marginBottom:10}}>👥</div>
                  <div>Sin asignaciones de equipo</div>
                  <div style={{fontSize:11,marginTop:6}}>Agrega colaboradores desde Supabase → employee_functional_tags</div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ══ POLÍTICA V5 ══ */}
        {tab==='config' && isGerencia && (
          <div style={{flex:1,overflowY:'auto',padding:24}}>
            <div style={{fontFamily:"'Syne',sans-serif",fontSize:15,fontWeight:900,marginBottom:4}}>⚙️ Política activa — NEXUM TIP NETWORK V5</div>
            {config && (
              <div>
                <div style={{background:S.bg2,border:`1px solid ${S.green}30`,borderRadius:14,padding:16,marginBottom:16,display:'flex',gap:12,alignItems:'center',flexWrap:'wrap'}}>
                  <div style={{width:12,height:12,borderRadius:'50%',background:S.green,boxShadow:`0 0 8px ${S.green}`,flexShrink:0}}/>
                  <div style={{flex:1}}>
                    <div style={{fontSize:13,fontWeight:700}}>{config.policy_name}</div>
                    <div style={{fontSize:10,color:S.t3,marginTop:2}}>{config.policy_code || 'NEXUM_TIP_NETWORK_V5_AUTONOMOUS'} · v{config.version} · vigente desde {config.vigencia_desde}</div>
                    <div style={{display:'flex',gap:6,marginTop:4,flexWrap:'wrap'}}>
                      <span style={{fontSize:9,color:S.cyan,background:`${S.cyan}10`,padding:'2px 8px',borderRadius:20}}>Ranking: {config.ranking_metric || 'SALES_GENERATED'}</span>
                      <span style={{fontSize:9,color:S.purple,background:`${S.purple}10`,padding:'2px 8px',borderRadius:20}}>Idempotencia: 1 factura = 1 tip_event</span>
                      <span style={{fontSize:9,color:S.green,background:`${S.green}10`,padding:'2px 8px',borderRadius:20}}>Audit log inmutable</span>
                    </div>
                  </div>
                  <div style={{marginLeft:'auto',textAlign:'right'}}>
                    <div style={{fontSize:10,color:S.t3}}>Retiro mínimo</div>
                    <div style={{fontSize:14,fontWeight:700,color:S.gold}}>{fmt(config.min_withdrawal)}</div>
                  </div>
                  <div style={{textAlign:'right'}}>
                    <div style={{fontSize:10,color:S.t3}}>SLA pago</div>
                    <div style={{fontSize:14,fontWeight:700,color:S.blue}}>{config.payout_sla_days} días</div>
                  </div>
                </div>

                <div style={{fontFamily:"'Syne',sans-serif",fontSize:13,fontWeight:900,marginBottom:10}}>Pools configurados</div>
                <div style={{display:'flex',flexDirection:'column',gap:8}}>
                  {(config.tip_policy_pools||[]).sort((a:any,b:any)=>a.sort_order-b.sort_order).map((pool:any)=>{
                    const meta = POOLS_V5.find(p=>p.code===pool.pool_code);
                    return (
                      <div key={pool.pool_code} style={{background:S.bg2,border:`1px solid ${meta?.color||S.border}20`,borderRadius:10,padding:'10px 14px',display:'flex',alignItems:'center',gap:10}}>
                        <span style={{fontSize:18}}>{meta?.emoji||'💰'}</span>
                        <div style={{flex:1}}>
                          <div style={{fontSize:11,fontWeight:700,color:meta?.color||S.t1}}>{pool.pool_code.replace(/_/g,' ')}</div>
                          <div style={{fontSize:9,color:S.t3}}>{pool.pool_name}</div>
                        </div>
                        <div style={{textAlign:'center',minWidth:60}}>
                          <div style={{fontFamily:"'Syne',sans-serif",fontSize:18,fontWeight:900,color:meta?.color||S.gold}}>{(pool.percentage*100).toFixed(2)}%</div>
                        </div>
                        <div style={{display:'flex',gap:4}}>
                          {pool.wallet_enabled && <span style={{fontSize:8,color:S.green,background:`${S.green}10`,padding:'2px 6px',borderRadius:10}}>Wallet</span>}
                          {pool.app_visible    && <span style={{fontSize:8,color:S.blue,background:`${S.blue}10`,padding:'2px 6px',borderRadius:10}}>App</span>}
                          {!pool.app_visible   && <span style={{fontSize:8,color:S.t3,background:S.bg4,padding:'2px 6px',borderRadius:10}}>Backoffice</span>}
                        </div>
                      </div>
                    );
                  })}
                </div>
                <div style={{marginTop:12,padding:'8px 14px',background:`${S.green}08`,border:`1px solid ${S.green}20`,borderRadius:10,fontSize:10,color:S.green,textAlign:'center'}}>
                  ✓ Total: {((config.tip_policy_pools||[]).reduce((s:number,p:any)=>s+parseFloat(p.percentage),0)*100).toFixed(4)}% — Suma correcta (el 0.01% es redondeo decimal normal)
                </div>

                {/* Antifraude y control */}
                <div style={{marginTop:16,background:S.bg2,border:`1px solid ${S.red}20`,borderRadius:14,padding:14}}>
                  <div style={{fontFamily:"'Syne',sans-serif",fontSize:12,fontWeight:900,marginBottom:10,color:S.red}}>🛡️ Antifraude y control</div>
                  {[
                    {e:'🔑', t:'Idempotencia obligatoria',       d:'Una factura/pago solo puede generar UN tip_event. Si se intenta duplicar, el motor devuelve DUPLICATE y no procesa.'},
                    {e:'📋', t:'Audit log inmutable',              d:'Todo ajuste posterior se registra como nuevo movimiento de ledger. Nunca se borra el movimiento original.'},
                    {e:'⚠️', t:'Monto UNASSIGNED',                d:'Si sum(scores) = 0 en un pool, el monto va a UNASSIGNED_POOL y requiere revisión de configuración de tags.'},
                    {e:'🚫', t:'Comisión externa = sin SALES_ACC', d:'Roles con has_external_commission=true se excluyen del pool SALES_ACCELERATOR o se limitan a base neutra.'},
                    {e:'🔗', t:'Cadena de servicio',              d:'La bolsa ADMIN_SERVICE_BACKBONE (26.52%) requiere validación de cadena de servicio antes de liquidar.'},
                  ].map(a=>(
                    <div key={a.t} style={{display:'flex',gap:8,padding:'6px 0',borderBottom:`1px solid rgba(255,255,255,0.04)`}}>
                      <span style={{fontSize:16,flexShrink:0}}>{a.e}</span>
                      <div>
                        <div style={{fontSize:11,fontWeight:700,color:S.t1,marginBottom:1}}>{a.t}</div>
                        <div style={{fontSize:10,color:S.t3,lineHeight:1.5}}>{a.d}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ══ BACKOFFICE ══ */}
        {tab==='backoffice' && isGerencia && (
          <div style={{flex:1,overflowY:'auto',padding:24}}>
            <div style={{fontFamily:"'Syne',sans-serif",fontSize:15,fontWeight:900,marginBottom:4}}>🏢 Backoffice Settlements</div>
            <div style={{fontSize:11,color:S.t2,marginBottom:20}}>
              Pools BACK_SUPPORT (8.93%) y ADMIN_SERVICE_BACKBONE (26.52%). Sin app, sin wallet. Liquidación por período con validación de cadena de servicio.
            </div>
            {backoffice.length === 0 ? (
              <div style={{textAlign:'center',padding:60,color:S.t3}}>
                <div style={{fontSize:48,marginBottom:10}}>🏢</div>
                <div>Sin liquidaciones pendientes</div>
              </div>
            ) : (
              <div style={{display:'flex',flexDirection:'column',gap:8}}>
                {backoffice.map(b=>(
                  <div key={b.id} style={{background:S.bg2,border:`1px solid ${b.estado==='liquidado'?S.green:S.border}`,borderRadius:12,padding:'12px 16px',display:'flex',alignItems:'center',gap:12}}>
                    <div style={{flex:1}}>
                      <div style={{fontSize:11,fontWeight:700,color:S.t1}}>{b.pool_code.replace(/_/g,' ')}</div>
                      <div style={{fontSize:10,color:S.t3}}>{b.periodo_inicio} → {b.periodo_fin}</div>
                      {b.empleado_nombre && <div style={{fontSize:10,color:S.t2,marginTop:2}}>{b.empleado_nombre}</div>}
                    </div>
                    <div style={{textAlign:'right'}}>
                      <div style={{fontFamily:"'Syne',sans-serif",fontSize:16,fontWeight:900,color:S.gold}}>{fmt(b.monto_total||0)}</div>
                      <div style={{fontSize:9,padding:'2px 8px',borderRadius:20,display:'inline-block',marginTop:2,background:b.estado==='liquidado'?`${S.green}15`:`${S.gold}10`,color:b.estado==='liquidado'?S.green:S.gold}}>
                        {b.estado}
                      </div>
                    </div>
                    {isGerencia && b.estado !== 'liquidado' && (
                      <button onClick={async()=>{
                        await supabase.from('backoffice_settlements').update({estado:'liquidado'}).eq('id',b.id);
                        show('✓ Marcado como liquidado');
                        fetchAll();
                      }} style={{padding:'6px 12px',borderRadius:8,border:`1px solid ${S.green}40`,background:`${S.green}10`,color:S.green,fontSize:10,fontWeight:700,cursor:'pointer',whiteSpace:'nowrap'}}>
                        ✓ Liquidar
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

        {/* ══════════════════════════════════════════════
            TAB ADMIN EQUIPO — Solo Gerencia
        ════════════════════════════════════════════════ */}
        {tab==='admin' && isGerencia && (
          <div style={{flex:1,overflow:'hidden',display:'flex',flexDirection:'column'}}>

            {/* Sub-tabs */}
            <div style={{display:'flex',gap:0,borderBottom:`1px solid ${S.border}`,flexShrink:0,background:S.bg2,padding:'0 20px'}}>
              {[
                {id:'activos',   l:`👥 Activos (${staff.filter(s=>s.activo!==false).length})`},
                {id:'inactivos', l:`📁 Ex-empleados (${staff.filter(s=>s.activo===false).length})`},
                {id:'nuevo',     l:'➕ Agregar colaborador'},
              ].map(t=>(
                <button key={t.id} onClick={()=>setStaffTab(t.id as any)}
                  style={{padding:'10px 16px',background:'none',border:'none',borderBottom:`2px solid ${staffTab===t.id?S.gold:'transparent'}`,color:staffTab===t.id?S.gold:S.t3,fontSize:11,fontWeight:700,cursor:'pointer',whiteSpace:'nowrap'}}>
                  {t.l}
                </button>
              ))}
            </div>

            {/* ── Activos ── */}
            {staffTab==='activos' && (
              <div style={{flex:1,overflowY:'auto',padding:20}}>
                <div style={{display:'flex',flexDirection:'column',gap:10}}>
                  {staff.filter(s=>s.activo!==false).map(s=>(
                    <div key={s.id} style={{background:S.bg2,border:`1px solid ${S.border}`,borderRadius:14,padding:'14px 16px',display:'flex',alignItems:'center',gap:12}}>
                      {/* Foto o inicial */}
                      <div style={{width:48,height:48,borderRadius:'50%',flexShrink:0,overflow:'hidden',border:`2px solid ${S.border}`,background:`linear-gradient(135deg,${S.purple},${S.blue})`}}>
                        {s.foto_base64
                          ? <img src={s.foto_base64} alt={s.nombre} style={{width:'100%',height:'100%',objectFit:'cover'}}/>
                          : <div style={{width:'100%',height:'100%',display:'flex',alignItems:'center',justifyContent:'center',fontSize:18,fontWeight:900,color:'#fff'}}>{s.nombre?.charAt(0)}</div>
                        }
                      </div>
                      {/* Info */}
                      <div style={{flex:1}}>
                        <div style={{fontSize:13,fontWeight:700,color:S.t1,marginBottom:2}}>{s.nombre}</div>
                        <div style={{display:'flex',gap:6,flexWrap:'wrap'}}>
                          <span style={{fontSize:10,color:S.gold,background:`${S.gold}10`,padding:'1px 8px',borderRadius:20}}>{s.rol}</span>
                          <span style={{fontSize:10,color:S.blue,background:`${S.blue}10`,padding:'1px 8px',borderRadius:20}}>{s.turno}</span>
                          {s.turno_partido && <span style={{fontSize:10,color:S.purple,background:`${S.purple}10`,padding:'1px 8px',borderRadius:20}}>⏰ Turno partido</span>}
                          {s.telefono && <span style={{fontSize:10,color:S.t3}}>📱 {s.telefono}</span>}
                        </div>
                      </div>
                      {/* Acciones */}
                      <div style={{display:'flex',gap:6,flexShrink:0}}>
                        <button onClick={()=>{ setEditingStaff(s); setStaffForm({...s}); setFotoPreview(s.foto_base64||''); setStaffTab('nuevo'); }}
                          style={{padding:'6px 12px',borderRadius:8,border:`1px solid ${S.border}`,background:'transparent',color:S.t2,fontSize:11,cursor:'pointer',fontWeight:700}}>
                          ✏️ Editar
                        </button>
                        <button onClick={()=>desactivarStaff(s.id,s.nombre)}
                          style={{padding:'6px 10px',borderRadius:8,border:`1px solid ${S.red}30`,background:`${S.red}08`,color:S.red,fontSize:11,cursor:'pointer'}}>
                          Desactivar
                        </button>
                      </div>
                    </div>
                  ))}
                  {staff.filter(s=>s.activo!==false).length===0 && (
                    <div style={{textAlign:'center',padding:40,color:S.t3}}>
                      <div style={{fontSize:40,marginBottom:10}}>👥</div>
                      <div>Sin colaboradores activos</div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* ── Ex-empleados ── */}
            {staffTab==='inactivos' && (
              <div style={{flex:1,overflowY:'auto',padding:20}}>
                <div style={{fontSize:11,color:S.t3,marginBottom:14}}>Historial de ex-colaboradores. Sus registros se conservan en Supabase.</div>
                <div style={{display:'flex',flexDirection:'column',gap:8}}>
                  {staff.filter(s=>s.activo===false).map(s=>(
                    <div key={s.id} style={{background:S.bg2,border:`1px solid ${S.border}`,borderRadius:12,padding:'12px 16px',display:'flex',alignItems:'center',gap:12,opacity:0.7}}>
                      <div style={{width:40,height:40,borderRadius:'50%',background:S.bg3,display:'flex',alignItems:'center',justifyContent:'center',fontSize:16,color:S.t3,flexShrink:0}}>
                        {s.nombre?.charAt(0)}
                      </div>
                      <div style={{flex:1}}>
                        <div style={{fontSize:12,fontWeight:700,color:S.t2}}>{s.nombre}</div>
                        <div style={{fontSize:10,color:S.t3}}>{s.rol} · Salió: {s.fecha_salida||'—'}</div>
                      </div>
                      <button onClick={async()=>{ await supabase.from('staff_nexum').update({activo:true,fecha_salida:null}).eq('id',s.id); show('✓ Reactivado'); fetchAll(); }}
                        style={{padding:'5px 10px',borderRadius:8,border:`1px solid ${S.green}30`,background:`${S.green}08`,color:S.green,fontSize:10,cursor:'pointer',fontWeight:700}}>
                        Reactivar
                      </button>
                    </div>
                  ))}
                  {staff.filter(s=>s.activo===false).length===0 && (
                    <div style={{textAlign:'center',padding:40,color:S.t3}}>Sin ex-colaboradores</div>
                  )}
                </div>
              </div>
            )}

            {/* ── Formulario nuevo / editar ── */}
            {staffTab==='nuevo' && (
              <div style={{flex:1,overflowY:'auto',padding:20}}>
                <div style={{maxWidth:600,margin:'0 auto'}}>
                  <div style={{fontFamily:"'Syne',sans-serif",fontSize:16,fontWeight:900,marginBottom:20}}>
                    {editingStaff ? `Editar: ${editingStaff.nombre}` : '+ Nuevo colaborador'}
                  </div>

                  {/* Foto */}
                  <div style={{display:'flex',alignItems:'center',gap:16,marginBottom:20,padding:16,background:S.bg2,borderRadius:14,border:`1px solid ${S.border}`}}>
                    <div style={{width:72,height:72,borderRadius:'50%',overflow:'hidden',background:S.bg3,border:`2px solid ${S.border}`,flexShrink:0}}>
                      {fotoPreview
                        ? <img src={fotoPreview} alt="foto" style={{width:'100%',height:'100%',objectFit:'cover'}}/>
                        : <div style={{width:'100%',height:'100%',display:'flex',alignItems:'center',justifyContent:'center',fontSize:24,color:S.t3}}>👤</div>
                      }
                    </div>
                    <div>
                      <div style={{fontSize:12,fontWeight:700,marginBottom:6}}>Foto del colaborador</div>
                      <label style={{padding:'7px 14px',borderRadius:8,border:`1px solid ${S.border}`,background:S.bg3,color:S.t2,fontSize:11,cursor:'pointer',fontWeight:700}}>
                        📷 Cargar imagen
                        <input type="file" accept="image/*" onChange={handleFoto} style={{display:'none'}}/>
                      </label>
                      <div style={{fontSize:9,color:S.t3,marginTop:4}}>JPG/PNG hasta 2MB — se convierte a código automáticamente</div>
                    </div>
                  </div>

                  {/* Campos */}
                  <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12,marginBottom:16}}>
                    {[
                      {k:'nombre',      l:'Nombre completo *',    type:'text'},
                      {k:'telefono',    l:'📱 Teléfono',          type:'tel'},
                      {k:'email',       l:'Email',                 type:'email'},
                      {k:'documento',   l:'Documento',             type:'text'},
                      {k:'fecha_ingreso',l:'Fecha de ingreso',    type:'date'},
                      {k:'salario_base', l:'Salario base',        type:'number'},
                    ].map(f=>(
                      <div key={f.k}>
                        <div style={{fontSize:10,color:S.t3,marginBottom:4}}>{f.l}</div>
                        <input type={f.type} value={(staffForm as any)[f.k]||''} onChange={e=>setStaffForm((p:any)=>({...p,[f.k]:e.target.value}))}
                          style={{width:'100%',padding:'9px 12px',borderRadius:8,border:`1px solid ${S.border}`,background:'rgba(255,255,255,0.05)',color:S.t1,fontSize:13,outline:'none'}}/>
                      </div>
                    ))}
                    <div>
                      <div style={{fontSize:10,color:S.t3,marginBottom:4}}>Rol</div>
                      <select value={staffForm.rol||'mesero'} onChange={e=>setStaffForm((p:any)=>({...p,rol:e.target.value}))}
                        style={{width:'100%',padding:'9px 12px',borderRadius:8,border:`1px solid ${S.border}`,background:'rgba(255,255,255,0.05)',color:S.t1,fontSize:13,outline:'none'}}>
                        {['mesero','bartender','cocinero','capitan','maitre','host','cajero','gerencia','admin','soporte'].map(r=><option key={r} value={r}>{r}</option>)}
                      </select>
                    </div>
                    <div>
                      <div style={{fontSize:10,color:S.t3,marginBottom:4}}>Turno</div>
                      <select value={staffForm.turno||'noche'} onChange={e=>setStaffForm((p:any)=>({...p,turno:e.target.value}))}
                        style={{width:'100%',padding:'9px 12px',borderRadius:8,border:`1px solid ${S.border}`,background:'rgba(255,255,255,0.05)',color:S.t1,fontSize:13,outline:'none'}}>
                        {['mediodia','noche','partido','abierto','especial'].map(t=><option key={t} value={t}>{t}</option>)}
                      </select>
                    </div>
                  </div>

                  {/* Turno partido */}
                  <div style={{marginBottom:16,padding:'12px 16px',background:S.bg2,borderRadius:12,border:`1px solid ${S.border}`}}>
                    <label style={{display:'flex',alignItems:'center',gap:10,cursor:'pointer'}}>
                      <input type="checkbox" checked={staffForm.turno_partido||false} onChange={e=>setStaffForm((p:any)=>({...p,turno_partido:e.target.checked}))}
                        style={{width:16,height:16}}/>
                      <div>
                        <div style={{fontSize:13,fontWeight:700,color:S.purple}}>⏰ Horario especial / Turno partido</div>
                        <div style={{fontSize:11,color:S.t3}}>El colaborador trabaja en dos franjas horarias en el día</div>
                      </div>
                    </label>
                    {staffForm.turno_partido && (
                      <div style={{marginTop:12,display:'grid',gridTemplateColumns:'1fr 1fr',gap:8}}>
                        {['entrada_1','salida_1','entrada_2','salida_2'].map(k=>(
                          <div key={k}>
                            <div style={{fontSize:10,color:S.t3,marginBottom:3}}>{k.replace('_',' ').replace(/\w/g,l=>l.toUpperCase())}</div>
                            <input type="time" value={(staffForm.turno_partido_info?.[k]||'')} onChange={e=>setStaffForm((p:any)=>({...p,turno_partido_info:{...(p.turno_partido_info||{}),[k]:e.target.value}}))}
                              style={{width:'100%',padding:'7px 10px',borderRadius:8,border:`1px solid ${S.border}`,background:'rgba(255,255,255,0.05)',color:S.t1,fontSize:12,outline:'none'}}/>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Notas RRHH */}
                  <div style={{marginBottom:20}}>
                    <div style={{fontSize:10,color:S.t3,marginBottom:4}}>Notas RRHH</div>
                    <textarea value={staffForm.notas_rrhh||''} onChange={e=>setStaffForm((p:any)=>({...p,notas_rrhh:e.target.value}))} rows={3}
                      style={{width:'100%',padding:'9px 12px',borderRadius:8,border:`1px solid ${S.border}`,background:'rgba(255,255,255,0.05)',color:S.t1,fontSize:12,outline:'none',resize:'none'}}
                      placeholder="Observaciones internas (solo visible para gerencia)"/>
                  </div>

                  <div style={{display:'flex',gap:10}}>
                    <button onClick={()=>{ setEditingStaff(null); setStaffTab('activos'); setFotoPreview(''); setStaffForm({nombre:'',rol:'mesero',turno:'noche',restaurante_id:6,activo:true}); }}
                      style={{flex:1,padding:12,borderRadius:10,border:`1px solid ${S.border}`,background:'transparent',color:S.t3,cursor:'pointer',fontSize:13}}>
                      Cancelar
                    </button>
                    <button onClick={guardarStaff}
                      style={{flex:2,padding:12,borderRadius:10,border:'none',background:`linear-gradient(135deg,${S.gold},#d4943a)`,color:'#000',cursor:'pointer',fontSize:13,fontWeight:700}}>
                      {editingStaff ? '✓ Actualizar colaborador' : '✓ Agregar colaborador'}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

    </div>
  );
}
