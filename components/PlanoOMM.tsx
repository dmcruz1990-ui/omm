import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { supabase } from '../lib/supabase.ts';

// ═══════════════════════════════════════════════════════════════════════
// PLANO OMM v2 — Interactivo. Solo 3 zonas: Eterno, Mantra, Amatista
// (con sus barras: BE, BS, BT). Excluye Peluquería y SER del plano.
// Lee de `tables`, realtime, panel lateral, hover effects, animations.
// ═══════════════════════════════════════════════════════════════════════

const VW = 1280, VH = 920;

// Solo las zonas que entran al plano (las otras quedan ocultas)
const ZONAS_VISIBLES = ['Eterno','Mantra','Amatista','Barra Eterno','Barra Sushi','Barra Torre'];

type ZonaKey = 'Eterno'|'Mantra'|'Amatista'|'Barra Eterno'|'Barra Sushi'|'Barra Torre';

const ZONAS: Record<ZonaKey, { area:{x:number;y:number;w:number;h:number}; fill:string; stroke:string; chipBg:string; label:string; }> = {
  'Eterno':       { area:{x:30,  y:90,  w:470, h:430}, fill:'#FFF4D6', stroke:'#E5B23B', chipBg:'#E5B23B', label:'ETERNO' },
  'Mantra':       { area:{x:530, y:170, w:610, h:680}, fill:'#FCD9D9', stroke:'#D14545', chipBg:'#D14545', label:'MANTRA' },
  'Amatista':     { area:{x:240, y:540, w:280, h:340}, fill:'#D2D9F0', stroke:'#3F4F9E', chipBg:'#3F4F9E', label:'AMATISTA' },
  'Barra Eterno': { area:{x:35,  y:95,  w:80,  h:280}, fill:'rgba(255,210,90,0.30)', stroke:'#C99629', chipBg:'#C99629', label:'BE' },
  'Barra Sushi':  { area:{x:540, y:200, w:430, h:60},  fill:'#3A3A3A', stroke:'#222',    chipBg:'#1a1a1a', label:'BARRA SUSHI' },
  'Barra Torre':  { area:{x:980, y:480, w:60,  h:280}, fill:'rgba(209,69,69,0.30)', stroke:'#8B2E2E', chipBg:'#8B2E2E', label:'BT' },
};

// Estados con paleta más rica
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
  abierta_en?:string; vip?:boolean;
}

const sizeFor = (m: MesaRow) => {
  if (m.zona.startsWith('Barra')) return { w:38, h:38 };
  if (m.name === 'M5') return { w:120, h:200 };
  if (m.capacidad >= 6) return { w:84, h:84 };
  if (m.capacidad >= 4) return { w:72, h:72 };
  if (m.capacidad >= 3) return { w:62, h:62 };
  return { w:54, h:54 };
};

const minutesSince = (iso?:string|null) => {
  if (!iso) return 0;
  return Math.max(0, Math.floor((Date.now()-new Date(iso).getTime())/60000));
};
const fmtElapsed = (min:number) => min<60 ? `${min}m` : `${Math.floor(min/60)}h ${min%60}m`;
const initials = (n?:string) => (n||'').split(' ').slice(0,2).map(s=>s[0]).join('').toUpperCase() || '·';

type FilterKey = 'todas'|'libres'|'ocupadas'|'reservadas'|'criticas'|'vip';

export default function PlanoOMM() {
  const [mesas, setMesas]   = useState<MesaRow[]>([]);
  const [loading, setLoad]  = useState(true);
  const [sel, setSel]       = useState<MesaRow|null>(null);
  const [hover, setHover]   = useState<MesaRow|null>(null);
  const [mouse, setMouse]   = useState({x:0, y:0});
  const [filter, setFilter] = useState<FilterKey>('todas');
  const [zonaFiltro, setZonaFiltro] = useState<ZonaKey|null>(null);
  const [tick, setTick]     = useState(0);
  const [flashIds, setFlashIds] = useState<Set<number>>(new Set());
  const svgRef = useRef<SVGSVGElement>(null);

  const fetchMesas = useCallback(async () => {
    const { data } = await supabase
      .from('tables')
      .select('id,name,capacidad,zona,estado,shape,posicion_x,posicion_y,mesero_nombre,cliente_nombre,pax_actual,abierta_en,vip')
      .in('zona', ZONAS_VISIBLES)
      .order('name');
    setMesas((data||[]) as MesaRow[]);
    setLoad(false);
  }, []);

  useEffect(() => { fetchMesas(); }, [fetchMesas]);

  // Realtime + tick para tiempos vivos
  useEffect(() => {
    const ch = supabase.channel('plano-omm-v2')
      .on('postgres_changes', { event:'*', schema:'public', table:'tables' }, (p:any) => {
        const id = p?.new?.id ?? p?.old?.id;
        if (id) {
          setFlashIds(s => new Set(s).add(id));
          setTimeout(() => setFlashIds(s => { const n = new Set(s); n.delete(id); return n; }), 1200);
        }
        fetchMesas();
      })
      .subscribe();
    const t = setInterval(() => setTick(x => x+1), 30000);
    return () => { supabase.removeChannel(ch); clearInterval(t); };
  }, [fetchMesas]);

  // Filtrado
  const visibles = useMemo(() => mesas.filter(m => {
    if (zonaFiltro && m.zona !== zonaFiltro && !m.zona.startsWith(zonaFiltro.split(' ')[0]==='Barra'?'':zonaFiltro)) {
      // permitir barras del mismo bloque (Eterno+Barra Eterno, etc.)
      const zonaBase = zonaFiltro;
      const barrasOk = (zonaBase==='Eterno' && m.zona==='Barra Eterno')
                     || (zonaBase==='Mantra' && (m.zona==='Barra Sushi' || m.zona==='Barra Torre'));
      if (!barrasOk) return false;
    }
    const e = (m.estado||'libre').toLowerCase();
    if (filter==='libres' && e!=='libre') return false;
    if (filter==='ocupadas' && e!=='ocupada' && e!=='open') return false;
    if (filter==='reservadas' && e!=='reservada' && e!=='pendiente') return false;
    if (filter==='criticas') {
      const min = minutesSince(m.abierta_en);
      if (!(e==='ocupada' || e==='open') || min < 90) return false;
    }
    if (filter==='vip' && !m.vip && m.name!=='M5') return false;
    return true;
  }), [mesas, filter, zonaFiltro]);

  // KPIs
  const kpi = useMemo(() => {
    const totalCap = mesas.reduce((a,m)=>a+(m.capacidad||0),0);
    const ocupadas = mesas.filter(m => ['ocupada','open'].includes((m.estado||'').toLowerCase()));
    const reservadas = mesas.filter(m => ['reservada','pendiente'].includes((m.estado||'').toLowerCase()));
    const libres = mesas.filter(m => (m.estado||'libre').toLowerCase()==='libre');
    const pct = mesas.length ? Math.round((ocupadas.length/mesas.length)*100) : 0;
    const criticas = ocupadas.filter(m => minutesSince(m.abierta_en) >= 90).length;
    return { totalCap, ocupadas:ocupadas.length, reservadas:reservadas.length, libres:libres.length, pct, criticas };
  }, [mesas, tick]);

  if (loading) return (
    <div style={{minHeight:'100vh',background:'#08080f',color:'#fff',display:'flex',alignItems:'center',justifyContent:'center',fontFamily:"'Inter',sans-serif"}}>
      <div style={{textAlign:'center'}}>
        <div style={{fontSize:38,marginBottom:14}}>🍱</div>
        <div style={{color:'#A0A0B8'}}>Cargando plano de mesas…</div>
      </div>
    </div>
  );

  return (
    <div style={{minHeight:'100vh',background:'#08080f',color:'#fff',fontFamily:"'Inter',sans-serif",padding:'16px 20px'}}>
      {/* ═══ CSS animations ═══ */}
      <style>{`
        @keyframes pulse-critical {
          0%, 100% { filter: drop-shadow(0 0 0 rgba(220,38,38,0)); transform: scale(1); }
          50% { filter: drop-shadow(0 0 12px rgba(220,38,38,0.85)); transform: scale(1.06); }
        }
        @keyframes flash-evt {
          0% { filter: drop-shadow(0 0 0 #FFF); }
          50% { filter: drop-shadow(0 0 18px #FFF); }
          100% { filter: drop-shadow(0 0 0 #FFF); }
        }
        @keyframes slide-in {
          from { transform: translateX(100%); opacity:0; }
          to   { transform: translateX(0);    opacity:1; }
        }
        .mesa-g { transition: transform 0.18s cubic-bezier(0.4,0,0.2,1), filter 0.18s; cursor:pointer; }
        .mesa-g:hover { transform: scale(1.08); filter: drop-shadow(0 0 14px rgba(68,138,255,0.7)); }
        .mesa-critical { animation: pulse-critical 1.6s infinite; }
        .mesa-flash    { animation: flash-evt 1.2s ease-out; }
        .panel-side { animation: slide-in 0.25s cubic-bezier(0.4,0,0.2,1); }
        .chip-btn { transition: all 0.15s; }
        .chip-btn:hover { transform: translateY(-1px); }
      `}</style>

      {/* ═══ Header tipo PDF ═══ */}
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:14,flexWrap:'wrap',gap:12}}>
        <div style={{display:'flex',alignItems:'center',gap:18}}>
          <div style={{fontFamily:"'Syne',sans-serif",fontWeight:900,fontSize:28,letterSpacing:'-0.02em'}}>OMM</div>
          <div style={{paddingLeft:18,borderLeft:'1px solid rgba(255,255,255,0.15)'}}>
            <div style={{fontFamily:"'Syne',sans-serif",fontWeight:800,fontSize:17}}>PLANO INTERACTIVO</div>
            <div style={{fontSize:10,color:'#A0A0B8',letterSpacing:'.12em',marginTop:2}}>ETERNO · MANTRA · AMATISTA — <span style={{color:'#448AFF'}}>NEXUM</span></div>
          </div>
        </div>
        {/* KPIs en vivo */}
        <div style={{display:'flex',gap:10}}>
          <Kpi label="OCUPACIÓN"  value={`${kpi.pct}%`}        color="#448AFF"/>
          <Kpi label="LIBRES"     value={kpi.libres}            color="#22C55E"/>
          <Kpi label="OCUPADAS"   value={kpi.ocupadas}          color="#EF4444"/>
          <Kpi label="RESERVADAS" value={kpi.reservadas}        color="#F59E0B"/>
          <Kpi label="CRÍTICAS"   value={kpi.criticas} alert={kpi.criticas>0} color="#DC2626"/>
          <Kpi label="CAPACIDAD"  value={`${kpi.totalCap}p`}    color="#9B72FF"/>
        </div>
      </div>

      {/* ═══ Filter chips ═══ */}
      <div style={{display:'flex',gap:8,marginBottom:12,flexWrap:'wrap'}}>
        {([
          {k:'todas',     l:'Todas',      c:'#fff'},
          {k:'libres',    l:'Libres',     c:'#22C55E'},
          {k:'ocupadas',  l:'Ocupadas',   c:'#EF4444'},
          {k:'reservadas',l:'Reservadas', c:'#F59E0B'},
          {k:'criticas',  l:'⚠ Críticas +90m', c:'#DC2626'},
          {k:'vip',       l:'⭐ VIP',     c:'#FFB547'},
        ] as {k:FilterKey;l:string;c:string}[]).map(f => (
          <button key={f.k} onClick={()=>setFilter(f.k)} className="chip-btn"
            style={{padding:'7px 14px',borderRadius:99,fontSize:12,fontWeight:600,cursor:'pointer',
              background: filter===f.k ? f.c : 'rgba(255,255,255,0.06)',
              color: filter===f.k ? '#000' : '#A0A0B8',
              border: `1px solid ${filter===f.k ? f.c : 'rgba(255,255,255,0.08)'}`}}>
            {f.l}
          </button>
        ))}
        <div style={{flex:1}}/>
        {(['Eterno','Mantra','Amatista'] as ZonaKey[]).map(z => (
          <button key={z} onClick={()=>setZonaFiltro(zonaFiltro===z?null:z)} className="chip-btn"
            style={{padding:'7px 14px',borderRadius:99,fontSize:12,fontWeight:600,cursor:'pointer',
              background: zonaFiltro===z ? ZONAS[z].chipBg : 'rgba(255,255,255,0.06)',
              color: zonaFiltro===z ? '#fff' : '#A0A0B8',
              border:`1px solid ${zonaFiltro===z ? ZONAS[z].chipBg : 'rgba(255,255,255,0.08)'}`}}>
            {z}
          </button>
        ))}
      </div>

      {/* ═══ Lienzo + panel lateral ═══ */}
      <div style={{display:'grid',gridTemplateColumns: sel ? '1fr 360px' : '1fr',gap:14,alignItems:'start',transition:'grid-template-columns 0.25s'}}>
        <div style={{background:'#fff',borderRadius:18,padding:14,boxShadow:'0 20px 70px rgba(0,0,0,0.6)',position:'relative'}}
          onMouseMove={(e)=>{ const r=svgRef.current?.getBoundingClientRect(); if(r) setMouse({x:e.clientX-r.left, y:e.clientY-r.top}); }}>
          <svg ref={svgRef} viewBox={`0 0 ${VW} ${VH}`} width="100%" style={{display:'block',background:'#FAFAFA',borderRadius:12}}>
            {/* Áreas de zona */}
            {(['Eterno','Mantra','Amatista','Barra Eterno','Barra Sushi','Barra Torre'] as ZonaKey[]).map(k => {
              const z = ZONAS[k];
              const dim = (zonaFiltro && k.split(' ')[0]!=='Barra' && k !== zonaFiltro) ? 0.18 : 1;
              const dimBarra = (zonaFiltro==='Eterno' && k==='Barra Eterno') ? 1
                            : (zonaFiltro==='Mantra' && (k==='Barra Sushi'||k==='Barra Torre')) ? 1
                            : (zonaFiltro && k.startsWith('Barra')) ? 0.18 : dim;
              return (
                <g key={k} opacity={dimBarra}>
                  <rect x={z.area.x} y={z.area.y} width={z.area.w} height={z.area.h}
                    fill={z.fill} stroke={z.stroke} strokeWidth={2.5} rx={14}/>
                  {!k.startsWith('Barra') && (
                    <text x={z.area.x + z.area.w/2} y={z.area.y + 36} textAnchor="middle"
                      fontSize={32} fontWeight={900} fill={z.chipBg} opacity={0.18}
                      letterSpacing="0.12em" pointerEvents="none">
                      {z.label}
                    </text>
                  )}
                  {/* Chip nombre */}
                  <g transform={`translate(${z.area.x+14}, ${z.area.y+14})`} pointerEvents="none">
                    <rect width={z.label.length*8.2+18} height={24} rx={6} fill={z.chipBg}/>
                    <text x={9} y={16.5} fill="#fff" fontSize={11} fontWeight={800} letterSpacing="0.08em">{z.label}</text>
                  </g>
                </g>
              );
            })}

            {/* Línea combinables */}
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
              const critical = (estado==='ocupada' || estado==='open') && min >= 90;
              const flashing = flashIds.has(m.id);
              const isSel = sel?.id === m.id;
              const cls = `mesa-g ${critical?'mesa-critical':''} ${flashing?'mesa-flash':''}`;
              return (
                <g key={m.id} className={cls} onClick={()=>setSel(m)}
                   onMouseEnter={()=>setHover(m)} onMouseLeave={()=>setHover(h=>h?.id===m.id?null:h)}>
                  {/* Glow ring si está seleccionada */}
                  {isSel && (
                    <circle cx={m.posicion_x} cy={m.posicion_y} r={Math.max(w,h)/2+10}
                      fill="none" stroke="#448AFF" strokeWidth={3} strokeDasharray="4 4">
                      <animate attributeName="stroke-dashoffset" from="0" to="16" dur="0.6s" repeatCount="indefinite"/>
                    </circle>
                  )}
                  {/* Shape */}
                  {(m.shape==='round' || isBarra) ? (
                    <circle cx={m.posicion_x} cy={m.posicion_y} r={w/2}
                      fill={isVIP ? '#7C1D1D' : c.bg} stroke={c.border} strokeWidth={2.5}/>
                  ) : (
                    <rect x={m.posicion_x-w/2} y={m.posicion_y-h/2} width={w} height={h} rx={7}
                      fill={isVIP ? '#7C1D1D' : c.bg} stroke={c.border} strokeWidth={2.5}/>
                  )}
                  {/* Avatar mesero en esquina sup-der si ocupada */}
                  {!isBarra && estado!=='libre' && m.mesero_nombre && (
                    <g pointerEvents="none">
                      <circle cx={m.posicion_x+w/2-8} cy={m.posicion_y-h/2+8} r={11} fill="#1a1a2e" stroke="#fff" strokeWidth={1.5}/>
                      <text x={m.posicion_x+w/2-8} y={m.posicion_y-h/2+12} textAnchor="middle"
                        fontSize={9} fontWeight={800} fill="#fff">{initials(m.mesero_nombre)}</text>
                    </g>
                  )}
                  {/* Dot crítico */}
                  {critical && (
                    <circle cx={m.posicion_x-w/2+9} cy={m.posicion_y-h/2+9} r={6} fill="#DC2626">
                      <animate attributeName="opacity" values="0.4;1;0.4" dur="1.2s" repeatCount="indefinite"/>
                    </circle>
                  )}
                  {/* Texto: código + capacidad/tiempo */}
                  <text x={m.posicion_x} y={m.posicion_y - 2} textAnchor="middle" pointerEvents="none"
                    fontSize={isBarra ? 11 : (m.name==='M5' ? 22 : 14)}
                    fontWeight={900} fill={isVIP ? '#fff' : c.text}>{m.name}</text>
                  {isBarra ? null : (
                    <text x={m.posicion_x} y={m.posicion_y + 14} textAnchor="middle" pointerEvents="none"
                      fontSize={10} fontWeight={600} fill={isVIP ? 'rgba(255,255,255,0.85)' : c.text}>
                      {estado==='libre' ? `${m.capacidad}p` : `${m.pax_actual||m.capacidad}p · ${fmtElapsed(min)}`}
                    </text>
                  )}
                </g>
              );
            })}
          </svg>

          {/* Tooltip flotante (hover) */}
          {hover && !sel && (
            <div style={{position:'absolute',left:mouse.x+14,top:mouse.y+14,background:'#0f0f1a',color:'#fff',
              padding:'10px 14px',borderRadius:10,pointerEvents:'none',fontSize:12,
              border:'1px solid rgba(255,255,255,0.15)',boxShadow:'0 10px 40px rgba(0,0,0,0.5)',
              minWidth:160,zIndex:50}}>
              <div style={{fontFamily:"'Syne',sans-serif",fontWeight:900,fontSize:14,marginBottom:2}}>{hover.name}</div>
              <div style={{color:'#A0A0B8',fontSize:10,letterSpacing:'.06em'}}>{hover.zona.toUpperCase()} · {hover.capacidad}p</div>
              <div style={{marginTop:6,fontSize:11}}>
                <span style={{padding:'2px 8px',borderRadius:6,background: (ST[(hover.estado||'libre') as keyof typeof ST] || ST.libre).chip,color:'#000',fontWeight:700}}>
                  {(ST[(hover.estado||'libre') as keyof typeof ST] || ST.libre).label}
                </span>
              </div>
              {hover.cliente_nombre && <div style={{marginTop:6,fontSize:11,color:'#A0A0B8'}}>👤 {hover.cliente_nombre}</div>}
              {hover.mesero_nombre && <div style={{fontSize:11,color:'#A0A0B8'}}>🍽 {hover.mesero_nombre}</div>}
              {hover.abierta_en && <div style={{fontSize:11,color:'#FFB547'}}>⏱ {fmtElapsed(minutesSince(hover.abierta_en))}</div>}
            </div>
          )}
        </div>

        {/* ═══ PANEL LATERAL — Acciones rápidas ═══ */}
        {sel && (
          <div className="panel-side" style={{background:'#0f0f1a',border:'1px solid rgba(255,255,255,0.10)',
            borderRadius:18,overflow:'hidden',position:'sticky',top:18}}>
            {(() => {
              const estado = (sel.estado||'libre').toLowerCase();
              const c = ST[estado as keyof typeof ST] || ST.libre;
              const zonaMeta = ZONAS[sel.zona as ZonaKey];
              const min = minutesSince(sel.abierta_en);
              return (
                <>
                  <div style={{padding:'18px 22px',background:zonaMeta?.chipBg||'#1a1a2e',
                    display:'flex',alignItems:'center',gap:14,position:'relative'}}>
                    <button onClick={()=>setSel(null)} style={{position:'absolute',top:12,right:12,
                      width:28,height:28,borderRadius:8,border:'none',background:'rgba(0,0,0,0.25)',color:'#fff',cursor:'pointer',fontSize:13}}>✕</button>
                    <div style={{width:64,height:64,borderRadius:14,background:'rgba(255,255,255,0.20)',
                      display:'flex',alignItems:'center',justifyContent:'center',
                      fontFamily:"'Syne',sans-serif",fontWeight:900,fontSize:22,color:'#fff'}}>{sel.name}</div>
                    <div>
                      <div style={{fontFamily:"'Syne',sans-serif",fontWeight:900,fontSize:18}}>{sel.zona}</div>
                      <div style={{fontSize:11,opacity:0.9,marginTop:2}}>{sel.capacidad} pax · {sel.shape}</div>
                      <span style={{marginTop:8,display:'inline-block',padding:'4px 10px',background:c.chip,color:'#000',
                        borderRadius:6,fontWeight:800,fontSize:11}}>{c.label}</span>
                    </div>
                  </div>

                  <div style={{padding:20,maxHeight:'calc(100vh - 240px)',overflowY:'auto'}}>
                    {estado==='libre' ? (
                      <div style={{textAlign:'center',padding:'10px 0 18px'}}>
                        <div style={{fontSize:42,marginBottom:8}}>🪑</div>
                        <div style={{color:'#A0A0B8',fontSize:13,marginBottom:18}}>Mesa libre — lista para asignar</div>
                      </div>
                    ) : (
                      <div style={{display:'flex',flexDirection:'column',gap:8,marginBottom:18}}>
                        {sel.cliente_nombre && <Field icon="👤" label="Cliente" value={sel.cliente_nombre}/>}
                        {sel.mesero_nombre && <Field icon="🍽" label="Mesero" value={sel.mesero_nombre}/>}
                        {sel.pax_actual ? <Field icon="👥" label="Pax actual" value={String(sel.pax_actual)}/> : null}
                        {sel.abierta_en && <Field icon="⏱" label="Abierta hace" value={fmtElapsed(min)} alert={min>=90}/>}
                      </div>
                    )}

                    {/* Acciones rápidas */}
                    <div style={{fontSize:10,color:'#A0A0B8',letterSpacing:'.1em',fontWeight:700,marginBottom:8}}>ACCIONES</div>
                    <div style={{display:'grid',gap:8}}>
                      {estado==='libre' ? (
                        <>
                          <ActionBtn icon="➕" label="Abrir cuenta" color="#22C55E"
                            onClick={async () => {
                              await supabase.from('tables').update({estado:'ocupada',status:'open',abierta_en:new Date().toISOString()}).eq('id',sel.id);
                              setSel(null);
                            }}/>
                          <ActionBtn icon="📅" label="Crear reserva" color="#448AFF"
                            onClick={async () => {
                              await supabase.from('tables').update({estado:'reservada',status:'reserved'}).eq('id',sel.id);
                              setSel(null);
                            }}/>
                          <ActionBtn icon="🚫" label="Bloquear mesa" color="#6B7280"
                            onClick={async () => {
                              await supabase.from('tables').update({estado:'bloqueada'}).eq('id',sel.id);
                              setSel(null);
                            }}/>
                        </>
                      ) : (
                        <>
                          <ActionBtn icon="💵" label="Ver cuenta" color="#FFB547" onClick={()=>{}}/>
                          <ActionBtn icon="🔄" label="Cambiar mesero" color="#448AFF" onClick={()=>{}}/>
                          <ActionBtn icon="✅" label="Cerrar y liberar" color="#22C55E"
                            onClick={async () => {
                              await supabase.from('tables').update({estado:'libre',status:'free',abierta_en:null,
                                cliente_nombre:null,mesero_nombre:null,pax_actual:0}).eq('id',sel.id);
                              setSel(null);
                            }}/>
                        </>
                      )}
                    </div>

                    {/* Combinable */}
                    {(['A12','A11','M7','M8'].includes(sel.name)) && (
                      <div style={{marginTop:18,padding:12,background:'rgba(155,114,255,0.08)',
                        border:'1px solid rgba(155,114,255,0.25)',borderRadius:10}}>
                        <div style={{fontSize:10,color:'#9B72FF',fontWeight:800,letterSpacing:'.08em',marginBottom:4}}>🔗 MESA COMBINABLE</div>
                        <div style={{fontSize:12}}>
                          {sel.name==='A12' && 'Comparte sofá con M7. Combinada: máx 10 pax.'}
                          {sel.name==='M7'  && 'Comparte sofá con A12. Combinada: máx 10 pax.'}
                          {sel.name==='A11' && 'Combinable con M8. Combinada: máx 10 pax.'}
                          {sel.name==='M8'  && 'Combinable con A11. Combinada: máx 10 pax.'}
                        </div>
                      </div>
                    )}
                  </div>
                </>
              );
            })()}
          </div>
        )}
      </div>
    </div>
  );
}

function Kpi({label,value,color,alert}:{label:string;value:string|number;color:string;alert?:boolean}) {
  return (
    <div style={{background:alert?`${color}20`:'rgba(255,255,255,0.04)',
      border:`1px solid ${alert?color:'rgba(255,255,255,0.07)'}`,
      borderRadius:10,padding:'8px 14px',minWidth:78,
      animation: alert ? 'pulse-critical 2s infinite' : undefined}}>
      <div style={{fontSize:9,color:'#A0A0B8',letterSpacing:'.1em',fontWeight:700}}>{label}</div>
      <div style={{fontSize:18,fontWeight:900,color,marginTop:2}}>{value}</div>
    </div>
  );
}

function Field({icon,label,value,alert}:{icon:string;label:string;value:string;alert?:boolean}) {
  return (
    <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'10px 12px',
      background:'rgba(255,255,255,0.03)',borderRadius:9,
      border:alert ? '1px solid rgba(220,38,38,0.4)' : '1px solid transparent'}}>
      <span style={{display:'flex',gap:8,alignItems:'center',color:'#A0A0B8',fontSize:11,letterSpacing:'.04em'}}>
        <span style={{fontSize:14}}>{icon}</span>{label}
      </span>
      <span style={{color:alert ? '#DC2626' : '#fff',fontWeight:700,fontSize:13}}>{value}</span>
    </div>
  );
}

function ActionBtn({icon,label,color,onClick}:{icon:string;label:string;color:string;onClick:()=>void}) {
  return (
    <button onClick={onClick}
      style={{display:'flex',alignItems:'center',gap:10,padding:'12px 14px',background:`${color}15`,
        border:`1px solid ${color}40`,color:'#fff',borderRadius:10,cursor:'pointer',fontWeight:600,fontSize:13,
        transition:'all 0.15s'}}
      onMouseEnter={e=>{(e.currentTarget as HTMLButtonElement).style.background=`${color}30`;}}
      onMouseLeave={e=>{(e.currentTarget as HTMLButtonElement).style.background=`${color}15`;}}>
      <span style={{fontSize:18}}>{icon}</span>{label}
    </button>
  );
}
