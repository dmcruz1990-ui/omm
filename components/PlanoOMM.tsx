import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '../lib/supabase.ts';

// ═══════════════════════════════════════════════════════════════════════
// PLANO OMM — Replica fiel del plano arquitectónico oficial (Nexum).
// Lee de la tabla `tables` (codigo en name, posicion_x/y, shape, capacidad,
// estado). Render SVG, realtime via canal Supabase, click → detalle de mesa.
// ═══════════════════════════════════════════════════════════════════════

const VW = 1400;   // viewport SVG
const VH = 950;

// Zonas: áreas de fondo (rect coloreado) y meta (color de borde / label)
type ZonaKey = 'Eterno'|'Mantra'|'Amatista'|'Barra Eterno'|'Barra Sushi'|'Barra Torre'|'Peluquería'|'SER';

const ZONAS: Record<ZonaKey, { area: {x:number;y:number;w:number;h:number}; fill: string; stroke: string; label: string; chipBg: string; }> = {
  'Eterno':       { area:{x:30,  y:110, w:460, h:380}, fill:'#FFF4D6', stroke:'#E5B23B', label:'ZONA ETERNO', chipBg:'#F2C75C' },
  'Mantra':       { area:{x:520, y:300, w:600, h:560}, fill:'#FCD9D9', stroke:'#C13B3B', label:'ZONA MANTRA', chipBg:'#D14545' },
  'Amatista':     { area:{x:240, y:520, w:300, h:380}, fill:'#D2D9F0', stroke:'#3F4F9E', label:'ZONA AMATISTA', chipBg:'#3F4F9E' },
  'Barra Eterno': { area:{x:40,  y:110, w:100, h:300}, fill:'#FFE9A6', stroke:'#C99629', label:'BARRA ETERNO', chipBg:'#C99629' },
  'Barra Sushi':  { area:{x:530, y:200, w:430, h:60},  fill:'#E0E0E0', stroke:'#888',    label:'BARRA SUSHI', chipBg:'#5A5A5A' },
  'Barra Torre':  { area:{x:990, y:480, w:60,  h:260}, fill:'#FCD9D9', stroke:'#C13B3B', label:'BARRA TORRE', chipBg:'#8B2E2E' },
  'Peluquería':   { area:{x:60,  y:680, w:200, h:90},  fill:'#F4D7F2', stroke:'#9B4699', label:'PELUQUERÍA',  chipBg:'#9B4699' },
  'SER':          { area:{x:60,  y:830, w:200, h:90},  fill:'#D5EBD5', stroke:'#4A8C4A', label:'SER / CLÍNICA', chipBg:'#4A8C4A' },
};

const COLOR_ESTADO: Record<string, { fill:string; stroke:string; text:string; chip:string }> = {
  libre:      { fill:'#FFFFFF', stroke:'#2E7D32', text:'#1B5E20', chip:'#00C853' },
  ocupada:    { fill:'#FFEBEE', stroke:'#C62828', text:'#B71C1C', chip:'#FF5252' },
  reservada:  { fill:'#FFF8E1', stroke:'#F9A825', text:'#5D4037', chip:'#FFB300' },
  bloqueada:  { fill:'#ECEFF1', stroke:'#546E7A', text:'#37474F', chip:'#78909C' },
  pendiente:  { fill:'#FFF8E1', stroke:'#F9A825', text:'#5D4037', chip:'#FFB300' },
};

interface MesaRow {
  id: number;
  name: string;          // código E20, M5, BS3...
  capacidad: number;
  zona: string;
  estado: string;
  shape: 'round'|'rect'|'square';
  posicion_x: number;
  posicion_y: number;
  mesero_nombre?: string;
  cliente_nombre?: string;
  pax_actual?: number;
  abierta_en?: string;
  vip?: boolean;
}

// Tamaño visual por tipo de zona/forma
const sizeFor = (m: MesaRow) => {
  if (m.zona.startsWith('Barra')) return { w: 34, h: 34 };
  if (m.zona === 'Peluquería' || m.zona === 'SER') return { w: 56, h: 56 };
  if (m.name === 'M5') return { w: 110, h: 180 };  // mesa larga 14 pax
  if (m.capacidad >= 6) return { w: 78, h: 78 };
  if (m.capacidad >= 4) return { w: 66, h: 66 };
  if (m.capacidad >= 3) return { w: 58, h: 58 };
  return { w: 50, h: 50 };
};

const fmtElapsed = (iso?: string|null) => {
  if (!iso) return '';
  const min = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime())/60000));
  return min < 60 ? `${min}m` : `${Math.floor(min/60)}h ${min%60}m`;
};

export default function PlanoOMM() {
  const [mesas, setMesas]   = useState<MesaRow[]>([]);
  const [loading, setLoad]  = useState(true);
  const [sel, setSel]       = useState<MesaRow|null>(null);
  const [filterZona, setFilterZona] = useState<string|null>(null);
  const [tick, setTick]     = useState(0);

  const fetchMesas = useCallback(async () => {
    const { data } = await supabase
      .from('tables')
      .select('id,name,capacidad,zona,estado,shape,posicion_x,posicion_y,mesero_nombre,cliente_nombre,pax_actual,abierta_en,vip')
      .order('name');
    setMesas((data||[]) as MesaRow[]);
    setLoad(false);
  }, []);

  useEffect(() => { fetchMesas(); }, [fetchMesas]);

  // Realtime
  useEffect(() => {
    const ch = supabase.channel('plano-omm-live')
      .on('postgres_changes', { event:'*', schema:'public', table:'tables' }, () => fetchMesas())
      .subscribe();
    const t = setInterval(() => setTick(x => x+1), 30000); // refresca tiempos abiertas
    return () => { supabase.removeChannel(ch); clearInterval(t); };
  }, [fetchMesas]);

  // Estadísticas en vivo
  const stats = useMemo(() => {
    const z: Record<string, { total:number; libre:number; ocupada:number; reservada:number; cap:number }> = {};
    for (const m of mesas) {
      const k = m.zona;
      if (!z[k]) z[k] = { total:0, libre:0, ocupada:0, reservada:0, cap:0 };
      z[k].total++;
      z[k].cap += (m.capacidad||0);
      const s = (m.estado||'libre');
      if (s === 'libre') z[k].libre++;
      else if (s === 'ocupada' || s === 'open') z[k].ocupada++;
      else z[k].reservada++;
    }
    const totals = mesas.reduce((acc, m) => {
      acc.cap += (m.capacidad||0);
      const s = (m.estado||'libre');
      if (s === 'libre') acc.libre++;
      else if (s === 'ocupada' || s === 'open') acc.ocupada++;
      else acc.reservada++;
      return acc;
    }, { cap:0, libre:0, ocupada:0, reservada:0 });
    return { z, totals, total: mesas.length };
  }, [mesas, tick]);

  if (loading) return (
    <div style={{minHeight:'100vh',background:'#08080f',color:'#fff',display:'flex',alignItems:'center',justifyContent:'center',fontFamily:"'Inter',sans-serif"}}>
      <div style={{textAlign:'center'}}>
        <div style={{fontSize:32,marginBottom:12}}>🍱</div>
        <div style={{color:'#A0A0B8'}}>Cargando plano de mesas…</div>
      </div>
    </div>
  );

  const renderShape = (m: MesaRow, c: typeof COLOR_ESTADO['libre']) => {
    const { w, h } = sizeFor(m);
    const cx = m.posicion_x, cy = m.posicion_y;
    const isBarra = m.zona.startsWith('Barra');
    const isVIP = m.name === 'M5' || m.vip;
    if (m.shape === 'round' || isBarra) {
      return <circle cx={cx} cy={cy} r={w/2}
                fill={isVIP ? '#8B0000' : c.fill}
                stroke={c.stroke} strokeWidth={2}/>;
    }
    return <rect x={cx-w/2} y={cy-h/2} width={w} height={h} rx={6}
              fill={isVIP ? '#8B0000' : c.fill}
              stroke={c.stroke} strokeWidth={2}/>;
  };

  return (
    <div style={{minHeight:'100vh',background:'#08080f',color:'#fff',fontFamily:"'Inter',sans-serif",padding:'18px 24px'}}>
      {/* ── Header tipo PDF ─────────────────────────────────────────── */}
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:18,flexWrap:'wrap',gap:12}}>
        <div style={{display:'flex',alignItems:'center',gap:18}}>
          <div style={{fontFamily:"'Syne',sans-serif",fontWeight:900,fontSize:26,letterSpacing:'-0.02em'}}>OMM</div>
          <div style={{paddingLeft:18,borderLeft:'1px solid rgba(255,255,255,0.15)'}}>
            <div style={{fontFamily:"'Syne',sans-serif",fontWeight:800,fontSize:18,letterSpacing:'.02em'}}>PLANO OFICIAL DE MESAS</div>
            <div style={{fontSize:11,color:'#A0A0B8',letterSpacing:'.1em',marginTop:2}}>DISTRIBUCIÓN POR ZONA — <span style={{color:'#448AFF'}}>NEXUM</span></div>
          </div>
        </div>
        <div style={{display:'flex',gap:14,alignItems:'center',fontSize:11,color:'#A0A0B8'}}>
          <Legend swatch="#fff" label={`${stats.totals.libre} libres`} accent="#00C853"/>
          <Legend swatch="#FFEBEE" label={`${stats.totals.ocupada} ocupadas`} accent="#FF5252"/>
          <Legend swatch="#FFF8E1" label={`${stats.totals.reservada} reservadas`} accent="#FFB300"/>
          <div style={{padding:'6px 12px',borderRadius:9,background:'rgba(0,200,83,0.10)',border:'1px solid rgba(0,200,83,0.30)'}}>
            <span style={{color:'#A0A0B8',fontSize:10}}>CAPACIDAD</span>
            <span style={{color:'#fff',marginLeft:8,fontWeight:800,fontSize:14}}>{stats.totals.cap} pax</span>
          </div>
        </div>
      </div>

      {/* ── Lienzo principal: SVG + resumen lateral ─────────────────── */}
      <div style={{display:'grid',gridTemplateColumns:'1fr 260px',gap:18,alignItems:'start'}}>
        {/* SVG Plano */}
        <div style={{background:'#fff',borderRadius:18,padding:14,boxShadow:'0 18px 60px rgba(0,0,0,0.55)'}}>
          <svg viewBox={`0 0 ${VW} ${VH}`} width="100%" style={{display:'block',background:'#FAFAFA',borderRadius:12}}>
            {/* Fondo: áreas de zonas */}
            {Object.entries(ZONAS).map(([k, z]) => (
              <g key={k}>
                <rect x={z.area.x} y={z.area.y} width={z.area.w} height={z.area.h}
                  fill={z.fill} stroke={z.stroke} strokeWidth={2} rx={10}
                  opacity={filterZona && filterZona !== k ? 0.25 : 1}/>
                {/* Chip nombre de zona, esquina sup izq del área */}
                <g transform={`translate(${z.area.x+12}, ${z.area.y+12})`}
                   opacity={filterZona && filterZona !== k ? 0.4 : 1}>
                  <rect x={0} y={0} width={k.length*9.5+20} height={26} rx={6} fill={z.chipBg}/>
                  <text x={10} y={18} fill="#fff" fontSize={12} fontWeight={800} letterSpacing="0.06em">{z.label}</text>
                </g>
              </g>
            ))}

            {/* Indicador mesas combinables (línea punteada A12↔M7, A11↔M8) */}
            {[['A12','M7'], ['A11','M8']].map(([a,b]) => {
              const ma = mesas.find(m => m.name === a);
              const mb = mesas.find(m => m.name === b);
              if (!ma || !mb) return null;
              return (
                <line key={`${a}-${b}`} x1={ma.posicion_x} y1={ma.posicion_y} x2={mb.posicion_x} y2={mb.posicion_y}
                  stroke="#9B72FF" strokeWidth={2} strokeDasharray="6 4" opacity={0.6}/>
              );
            })}

            {/* Mesas */}
            {mesas.map(m => {
              const estado = (m.estado||'libre').toLowerCase();
              const c = COLOR_ESTADO[estado] || COLOR_ESTADO.libre;
              const { h } = sizeFor(m);
              const dim = filterZona && filterZona !== m.zona ? 0.25 : 1;
              return (
                <g key={m.id} onClick={() => setSel(m)} style={{cursor:'pointer'}} opacity={dim}>
                  {renderShape(m, c)}
                  {/* Código mesa */}
                  <text x={m.posicion_x} y={m.posicion_y - 3} textAnchor="middle"
                    fontSize={m.name === 'M5' ? 18 : (m.zona.startsWith('Barra') ? 10 : 13)}
                    fontWeight={900} fill={c.text} letterSpacing="0.02em" pointerEvents="none">
                    {m.name}
                  </text>
                  {/* Capacidad */}
                  <text x={m.posicion_x} y={m.posicion_y + 12} textAnchor="middle"
                    fontSize={m.zona.startsWith('Barra') ? 8 : 10}
                    fill={c.text} pointerEvents="none">
                    {m.capacidad} pax
                  </text>
                  {/* Indicador de estado en esquina (dot) */}
                  {estado !== 'libre' && !m.zona.startsWith('Barra') && (
                    <circle cx={m.posicion_x + sizeFor(m).w/2 - 8} cy={m.posicion_y - h/2 + 8} r={5} fill={c.chip}/>
                  )}
                </g>
              );
            })}

            {/* Norte y leyenda inferior */}
            <g transform="translate(1280, 880)">
              <text fontSize={11} fill="#666" fontWeight={800}>N ↑</text>
            </g>
            <g transform="translate(30, 30)">
              <text fontSize={11} fill="#999" fontWeight={700} letterSpacing=".1em">— · — Mesas combinables (A12+M7, A11+M8)</text>
            </g>
          </svg>
        </div>

        {/* Panel lateral resumen */}
        <div style={{display:'flex',flexDirection:'column',gap:10}}>
          <div style={{background:'#0f0f1a',border:'1px solid rgba(255,255,255,0.08)',borderRadius:14,padding:14}}>
            <div style={{fontFamily:"'Syne',sans-serif",fontSize:11,letterSpacing:'.12em',color:'#A0A0B8',marginBottom:10}}>RESUMEN CAPACIDAD</div>
            {(['Eterno','Mantra','Amatista','Barra Eterno','Barra Sushi','Barra Torre','Peluquería','SER'] as ZonaKey[]).map(k => {
              const s = stats.z[k]; if (!s) return null;
              const active = filterZona === k;
              return (
                <button key={k} onClick={() => setFilterZona(active ? null : k)}
                  style={{display:'flex',justifyContent:'space-between',alignItems:'center',width:'100%',
                    padding:'8px 10px',borderRadius:8,marginBottom:4,background: active ? 'rgba(68,138,255,0.15)' : 'transparent',
                    border:`1px solid ${active ? 'rgba(68,138,255,0.4)' : 'transparent'}`,color:'#fff',cursor:'pointer',fontSize:12}}>
                  <span style={{display:'flex',alignItems:'center',gap:8}}>
                    <span style={{width:10,height:10,borderRadius:3,background:ZONAS[k].chipBg}}/>
                    {k}
                  </span>
                  <span style={{color:'#A0A0B8'}}>{s.cap} pax</span>
                </button>
              );
            })}
            <div style={{borderTop:'1px solid rgba(255,255,255,0.08)',marginTop:8,paddingTop:10,display:'flex',justifyContent:'space-between',fontSize:13,fontWeight:800}}>
              <span>TOTAL GENERAL</span>
              <span style={{color:'#FFB547'}}>{stats.totals.cap} pax</span>
            </div>
          </div>

          {/* Estado en vivo */}
          <div style={{background:'#0f0f1a',border:'1px solid rgba(255,255,255,0.08)',borderRadius:14,padding:14}}>
            <div style={{fontFamily:"'Syne',sans-serif",fontSize:11,letterSpacing:'.12em',color:'#A0A0B8',marginBottom:10}}>ESTADO EN VIVO</div>
            <RowStat label="Libres" value={stats.totals.libre} chip="#00C853"/>
            <RowStat label="Ocupadas" value={stats.totals.ocupada} chip="#FF5252"/>
            <RowStat label="Reservadas" value={stats.totals.reservada} chip="#FFB300"/>
            <RowStat label="Mesas totales" value={stats.total} chip="#448AFF"/>
            <div style={{fontSize:10,color:'#50506A',marginTop:8,textAlign:'center'}}>Sincronizado en tiempo real</div>
          </div>

          <button onClick={() => setFilterZona(null)} disabled={!filterZona}
            style={{padding:'10px',background:filterZona?'#448AFF':'rgba(255,255,255,0.05)',color:'#fff',
              border:'none',borderRadius:10,cursor:filterZona?'pointer':'not-allowed',
              opacity:filterZona?1:0.4,fontWeight:700,fontSize:12}}>
            Quitar filtro de zona
          </button>
        </div>
      </div>

      {/* ── Modal detalle de mesa ──────────────────────────────────── */}
      {sel && (() => {
        const estado = (sel.estado||'libre').toLowerCase();
        const c = COLOR_ESTADO[estado] || COLOR_ESTADO.libre;
        const zonaMeta = ZONAS[sel.zona as ZonaKey];
        return (
          <div onClick={()=>setSel(null)}
            style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.82)',zIndex:9999,display:'flex',alignItems:'center',justifyContent:'center',padding:20}}>
            <div onClick={e=>e.stopPropagation()}
              style={{background:'#0f0f1a',border:'1px solid rgba(255,255,255,0.12)',borderRadius:18,width:'100%',maxWidth:440,overflow:'hidden'}}>
              <div style={{padding:'18px 22px',background:zonaMeta?.chipBg||'#1a1a2e',display:'flex',alignItems:'center',gap:14}}>
                <div style={{width:52,height:52,borderRadius:10,background:'rgba(255,255,255,0.18)',display:'flex',alignItems:'center',justifyContent:'center',
                  fontFamily:"'Syne',sans-serif",fontWeight:900,fontSize:18,color:'#fff',letterSpacing:'.04em'}}>{sel.name}</div>
                <div style={{flex:1}}>
                  <div style={{fontFamily:"'Syne',sans-serif",fontWeight:900,fontSize:16}}>{sel.zona}</div>
                  <div style={{fontSize:11,opacity:0.85}}>{sel.capacidad} pax · {sel.shape}</div>
                </div>
                <span style={{padding:'5px 10px',background:c.chip,color:'#000',borderRadius:8,fontWeight:800,fontSize:11,textTransform:'uppercase'}}>{estado}</span>
              </div>
              <div style={{padding:20}}>
                {estado === 'libre' ? (
                  <div style={{textAlign:'center',padding:'10px 0 16px'}}>
                    <div style={{fontSize:38,marginBottom:6}}>🪑</div>
                    <div style={{color:'#A0A0B8',fontSize:13}}>Mesa libre — lista para asignar</div>
                  </div>
                ) : (
                  <div style={{display:'flex',flexDirection:'column',gap:10,fontSize:13}}>
                    {sel.cliente_nombre && <Field label="Cliente" value={sel.cliente_nombre}/>}
                    {sel.mesero_nombre && <Field label="Mesero" value={sel.mesero_nombre}/>}
                    {sel.pax_actual ? <Field label="Pax actual" value={String(sel.pax_actual)}/> : null}
                    {sel.abierta_en && <Field label="Abierta hace" value={fmtElapsed(sel.abierta_en)}/>}
                  </div>
                )}
                <button onClick={()=>setSel(null)}
                  style={{marginTop:18,width:'100%',padding:'12px',background:'rgba(255,255,255,0.05)',color:'#fff',border:'1px solid rgba(255,255,255,0.10)',borderRadius:10,cursor:'pointer',fontWeight:600}}>
                  Cerrar
                </button>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}

function Legend({swatch, label, accent}:{swatch:string;label:string;accent:string}) {
  return (
    <div style={{display:'flex',alignItems:'center',gap:6}}>
      <span style={{width:14,height:14,background:swatch,border:`2px solid ${accent}`,borderRadius:4,display:'inline-block'}}/>
      <span style={{fontSize:11,color:'#A0A0B8'}}>{label}</span>
    </div>
  );
}

function RowStat({label, value, chip}:{label:string;value:number|string;chip:string}) {
  return (
    <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'5px 0',fontSize:12}}>
      <span style={{display:'flex',alignItems:'center',gap:8,color:'#A0A0B8'}}>
        <span style={{width:8,height:8,borderRadius:'50%',background:chip}}/>{label}
      </span>
      <span style={{color:'#fff',fontWeight:700}}>{value}</span>
    </div>
  );
}

function Field({label, value}:{label:string;value:string}) {
  return (
    <div style={{display:'flex',justifyContent:'space-between',padding:'8px 0',borderBottom:'1px solid rgba(255,255,255,0.06)'}}>
      <span style={{color:'#A0A0B8',fontSize:11,textTransform:'uppercase',letterSpacing:'.06em'}}>{label}</span>
      <span style={{color:'#fff',fontWeight:600}}>{value}</span>
    </div>
  );
}
