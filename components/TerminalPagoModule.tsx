import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase.ts';
import { useAuth } from '../contexts/AuthContext';
import { useRestaurant } from '../contexts/RestaurantContext';
import { CreditCard, Banknote, Smartphone, X, Search } from 'lucide-react';

const S = {
  bg:'#08080f', bg2:'#0f0f1a', bg3:'#161624', bg4:'#1e1e2e',
  border:'rgba(255,255,255,0.07)', border2:'rgba(255,255,255,0.12)',
  t1:'#fff', t2:'#A0A0B8', t3:'#50506A',
  gold:'#FFB547', green:'#00E676', red:'#FF5252',
  blue:'#448AFF', purple:'#B388FF', pink:'#FF2D78', cyan:'#22d3ee',
};

const fmt = (n:number) => `$${Math.round(n||0).toLocaleString('es-CO')}`;

interface CobroPendiente {
  id: number;
  restaurante_id: number;
  mesa_num: number;
  mesa_name?: string;
  cliente_nombre?: string;
  cliente_telefono?: string;
  total: number;
  propina: number;
  items: any[];
  mesero: string;
  estado: 'pendiente' | 'en_proceso' | 'cobrado' | 'cancelado';
  metodo_pago?: string;
  cobrado_por?: string;
  solicitado_at: string;
  cobrado_at?: string;
}

// ═══════════════════════════════════════════════════════════════════════
// TERMINAL DE PAGO — la cajera procesa los cobros enviados desde el POS.
// Solo aparecen cuentas en estado 'pendiente' o 'en_proceso'.
// ═══════════════════════════════════════════════════════════════════════
export default function TerminalPagoModule() {
  const { profile } = useAuth();
  const { activeId: restauranteId, activeRestaurant } = useRestaurant();
  const [cobros, setCobros] = useState<CobroPendiente[]>([]);
  const [selected, setSelected] = useState<CobroPendiente | null>(null);
  const [metodoElegido, setMetodoElegido] = useState<string | null>(null);
  const [filtroMesa, setFiltroMesa] = useState('');
  const [loading, setLoading] = useState(true);
  const [procesando, setProcesando] = useState(false);
  const [toast, setToast] = useState('');
  const [pantallaFinal, setPantallaFinal] = useState<{ activa:boolean; mesa:number; total:number; metodo:string } | null>(null);

  const cajeroNombre = profile?.nombre_completo || profile?.full_name || 'Cajera';

  const showToast = (m:string) => { setToast(m); setTimeout(()=>setToast(''), 3000); };

  const cargar = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase.from('cobros_pendientes')
      .select('*')
      .eq('restaurante_id', restauranteId)
      .in('estado', ['pendiente','en_proceso'])
      .order('solicitado_at', { ascending: false });
    setCobros((data||[]) as CobroPendiente[]);
    setLoading(false);
  }, [restauranteId]);

  useEffect(() => {
    cargar();
    const ch = supabase.channel(`terminal-pago-${restauranteId}`)
      .on('postgres_changes', { event:'*', schema:'public', table:'cobros_pendientes' }, () => cargar())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [cargar, restauranteId]);

  const cobrosFiltrados = cobros.filter(c =>
    !filtroMesa || String(c.mesa_num).includes(filtroMesa) || (c.cliente_nombre||'').toLowerCase().includes(filtroMesa.toLowerCase())
  );

  const totalEnEspera = cobros.reduce((s, c) => s + (c.total || 0), 0);
  const totalPropinas = cobros.reduce((s, c) => s + (c.propina || 0), 0);

  const procesarCobro = async (cobro: CobroPendiente, metodo: 'efectivo'|'tarjeta'|'datafono'|'transferencia'|'bono') => {
    setProcesando(true);
    const { error } = await supabase.from('cobros_pendientes').update({
      estado: 'cobrado',
      metodo_pago: metodo,
      cobrado_por: cajeroNombre,
      cobrado_at: new Date().toISOString(),
    }).eq('id', cobro.id);
    if (error) {
      showToast(`⚠ ${error.message}`);
      setProcesando(false);
      return;
    }
    // Registrar en cobros_trazabilidad para el dashboard
    await supabase.from('cobros_trazabilidad').insert({
      restaurante_id: restauranteId,
      mesa_numero: cobro.mesa_num,
      mesero: cobro.mesero,
      total: cobro.total,
      propina: cobro.propina || 0,
      propina_pct: 0,
      metodo_pago: metodo,
      platos_servidos: (cobro.items || []).length,
      factura_tipo: 'caja',
      factura_email: null,
    }).then(()=>{}, ()=>{});
    setProcesando(false);
    setSelected(null);
    setMetodoElegido(null);
    // PANTALLA 3 · ENCUESTA X-CARE COMPLETA — misma del modo cliente del
    // POS (caritas + ruta + platos de la cuenta + comentario).
    setEncuesta({ activa:true, mesa: cobro.mesa_num, total: cobro.total + (cobro.propina||0), metodo, telefono: cobro.cliente_telefono || '', items: cobro.items || [], cliente: cobro.cliente_nombre || '' });
    showToast(`✓ Mesa ${cobro.mesa_num} cobrada · ${fmt(cobro.total + (cobro.propina||0))}`);
  };

  // Encuesta X-CARE COMPLETA post-cobro — misma lógica que el modo cliente
  // del POS: caritas → categorías → platos de la cuenta → comentario.
  const [encuesta, setEncuesta] = useState<{ activa:boolean; mesa:number; total:number; metodo:string; telefono?:string; items:any[]; cliente?:string } | null>(null);
  const cerrarEncuesta = () => {
    if (!encuesta) return;
    setPantallaFinal({ activa:true, mesa: encuesta.mesa, total: encuesta.total, metodo: encuesta.metodo });
    setEncuesta(null);
  };

  const rechazar = async (cobro: CobroPendiente) => {
    if (!confirm(`¿Cancelar el cobro de la mesa ${cobro.mesa_num}? Volverá al mesero para revisión.`)) return;
    await supabase.from('cobros_pendientes').update({ estado: 'cancelado' }).eq('id', cobro.id);
    setSelected(null);
    setMetodoElegido(null);
    showToast(`Mesa ${cobro.mesa_num} devuelta al mesero`);
  };

  return (
    <div style={{height:'100%', display:'flex', flexDirection:'column', background:S.bg, color:S.t1, fontFamily:"'DM Sans',sans-serif", overflow:'hidden'}}>
      {toast && <div style={{position:'fixed', bottom:24, left:'50%', transform:'translateX(-50%)', background:S.bg4, border:`1px solid ${S.pink}`, color:S.t1, padding:'10px 28px', borderRadius:50, fontSize:13, fontWeight:700, zIndex:9999}}>{toast}</div>}

      {/* PANTALLA 3 · ENCUESTA X-CARE COMPLETA — caritas + ruta + platos */}
      {encuesta?.activa && (
        <EncuestaXCareCompleta
          mesa={encuesta.mesa}
          items={encuesta.items}
          cliente={encuesta.cliente}
          telefono={encuesta.telefono}
          restauranteId={restauranteId}
          restaurant={activeRestaurant as any}
          S={S}
          onDone={cerrarEncuesta}
        />
      )}

      {/* PANTALLA 4 · Confirmación final (con logo del restaurante + by NEXUM v4) */}
      {pantallaFinal?.activa && (
        <div style={{position:'fixed', inset:0, background:'linear-gradient(180deg, #0a0a10 0%, #000 100%)', zIndex:8000, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', padding:24}}>
          {/* Logo del restaurante arriba */}
          <div style={{position:'absolute',top:32,left:'50%',transform:'translateX(-50%)',display:'flex',flexDirection:'column',alignItems:'center',gap:6}}>
            <div style={{width:54,height:54,borderRadius:'50%',background:`linear-gradient(135deg, ${S.gold}, #B07820)`,display:'flex',alignItems:'center',justifyContent:'center',fontSize:28,boxShadow:`0 6px 24px ${S.gold}55`}}>
              {(activeRestaurant as any)?.emoji || '🏨'}
            </div>
            <div style={{fontFamily:"'Syne',serif",fontSize:14,fontWeight:900,letterSpacing:'.06em'}}>{(activeRestaurant as any)?.nombre || 'NEXUM'}</div>
          </div>
          {/* Check animado */}
          <div style={{width:120, height:120, borderRadius:'50%', background:`linear-gradient(135deg, ${S.green}, #00B050)`, display:'flex', alignItems:'center', justifyContent:'center', fontSize:60, marginBottom:24, boxShadow:`0 0 60px ${S.green}aa, inset 0 0 30px rgba(255,255,255,0.2)`, color:'#000'}}>✓</div>
          <div style={{fontFamily:"'Syne',serif", fontSize:34, fontWeight:900, marginBottom:6, letterSpacing:'-0.02em'}}>Cobro completado</div>
          <div style={{fontFamily:"'Syne',serif",fontSize:52, fontWeight:900, color:S.gold, marginBottom:8, letterSpacing:'-0.03em'}}>{fmt(pantallaFinal.total)}</div>
          <div style={{display:'flex',alignItems:'center',gap:12,padding:'8px 20px',background:`${S.gold}10`,border:`1px solid ${S.gold}33`,borderRadius:50,marginBottom:32}}>
            <span style={{fontFamily:"'Syne',serif",fontSize:14,fontWeight:900,color:S.gold}}>M{pantallaFinal.mesa}</span>
            <span style={{fontSize:11,color:S.t3}}>·</span>
            <span style={{fontSize:12, color:S.t1, fontWeight:600, textTransform:'capitalize'}}>{pantallaFinal.metodo}</span>
          </div>
          <button onClick={() => setPantallaFinal(null)}
            style={{padding:'14px 42px', borderRadius:50, border:'none', background:`linear-gradient(135deg, ${S.gold}, #B07820)`, color:'#000', fontSize:13, fontWeight:900, cursor:'pointer', letterSpacing:'.04em', boxShadow:`0 8px 30px ${S.gold}55`}}>
            Siguiente cobro →
          </button>
          {/* Footer */}
          <div style={{position:'absolute',bottom:24,left:0,right:0,display:'flex',alignItems:'center',justifyContent:'center',gap:8}}>
            <span style={{fontSize:10,color:S.t3,letterSpacing:'.22em',fontWeight:700,fontFamily:"'IBM Plex Mono', monospace",textTransform:'uppercase'}}>by NEXUM v4</span>
          </div>
        </div>
      )}

      {/* Header */}
      <div style={{padding:'14px 24px', borderBottom:`1px solid ${S.border}`, background:S.bg2, display:'flex', alignItems:'center', gap:14, flexShrink:0, flexWrap:'wrap'}}>
        <div style={{display:'flex', alignItems:'center', gap:12}}>
          <div style={{width:44, height:44, borderRadius:13, background:`linear-gradient(135deg,${S.green},#00B050)`, display:'flex', alignItems:'center', justifyContent:'center', fontSize:22}}>💳</div>
          <div>
            <div style={{fontFamily:"'Syne',sans-serif", fontSize:16, fontWeight:900}}>TERMINAL DE PAGO</div>
            <div style={{fontSize:10, color:S.t3, letterSpacing:'.1em', textTransform:'uppercase'}}>Caja · {activeRestaurant.nombre} · Cajera: {cajeroNombre}</div>
          </div>
        </div>
        <div style={{marginLeft:'auto', display:'flex', gap:14}}>
          <div style={{textAlign:'center'}}>
            <div style={{fontSize:9, color:S.t3, textTransform:'uppercase'}}>Cuentas por cobrar</div>
            <div style={{fontFamily:"'Syne',sans-serif", fontSize:18, fontWeight:900, color:cobros.length > 0 ? S.green : S.t2}}>{cobros.length}</div>
          </div>
          <div style={{textAlign:'center'}}>
            <div style={{fontSize:9, color:S.t3, textTransform:'uppercase'}}>Total esperando</div>
            <div style={{fontFamily:"'Syne',sans-serif", fontSize:18, fontWeight:900, color:S.gold}}>{fmt(totalEnEspera)}</div>
          </div>
          <div style={{textAlign:'center'}}>
            <div style={{fontSize:9, color:S.t3, textTransform:'uppercase'}}>Propinas</div>
            <div style={{fontFamily:"'Syne',sans-serif", fontSize:18, fontWeight:900, color:S.purple}}>{fmt(totalPropinas)}</div>
          </div>
        </div>
      </div>

      {/* Filtro */}
      <div style={{padding:'12px 24px', borderBottom:`1px solid ${S.border}`, display:'flex', gap:10, alignItems:'center', flexShrink:0}}>
        <Search size={16} color={S.t3}/>
        <input value={filtroMesa} onChange={e => setFiltroMesa(e.target.value)}
          placeholder="Buscar por número de mesa o cliente..."
          style={{flex:1, background:'transparent', border:'none', color:S.t1, fontSize:13, outline:'none'}}/>
        <button onClick={cargar} style={{padding:'6px 14px', borderRadius:9, border:`1px solid ${S.border2}`, background:'transparent', color:S.t2, fontSize:11, fontWeight:700, cursor:'pointer'}}>🔄 Refrescar</button>
      </div>

      {/* Contenido */}
      <div style={{flex:1, overflow:'hidden', display:'flex'}}>
        {/* Lista de cobros */}
        <div style={{flex:1, overflowY:'auto', padding:24}}>
          {loading && <div style={{padding:60, textAlign:'center', color:S.t3}}>Cargando cuentas...</div>}
          {!loading && cobrosFiltrados.length === 0 && (
            <div style={{padding:60, textAlign:'center', color:S.t3}}>
              <div style={{fontSize:60, marginBottom:14}}>💳</div>
              <div style={{fontSize:16, fontWeight:700, color:S.t2}}>Sin cuentas por cobrar</div>
              <div style={{fontSize:11, color:S.t3, marginTop:6}}>Cuando un mesero envíe una cuenta desde el POS aparecerá aquí.</div>
            </div>
          )}

          <div style={{display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(280px, 1fr))', gap:14}}>
            {cobrosFiltrados.map(cobro => {
              const isSelected = selected?.id === cobro.id;
              const tiempoEspera = Math.floor((Date.now() - new Date(cobro.solicitado_at).getTime()) / 60000);
              const tiempoColor = tiempoEspera >= 10 ? S.red : tiempoEspera >= 5 ? S.gold : S.green;
              return (
                <button key={cobro.id} onClick={() => setSelected(cobro)}
                  style={{
                    background:isSelected?`${S.green}10`:S.bg2,
                    border:`2px solid ${isSelected?S.green:S.border}`,
                    borderRadius:14, padding:16, cursor:'pointer', textAlign:'left' as const,
                    boxShadow: isSelected ? `0 0 16px ${S.green}40` : 'none',
                    transition:'all .15s',
                  }}>
                  <div style={{display:'flex', alignItems:'center', gap:10, marginBottom:10}}>
                    <div style={{width:42, height:42, borderRadius:10, background:`linear-gradient(135deg,${S.gold},#d4943a)`, display:'flex', alignItems:'center', justifyContent:'center', color:'#000', fontWeight:900, fontFamily:"'Syne',sans-serif", fontSize:16, flexShrink:0}}>
                      M{cobro.mesa_num}
                    </div>
                    <div style={{flex:1, minWidth:0}}>
                      <div style={{fontSize:13, fontWeight:700, color:S.t1, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap'}}>{cobro.cliente_nombre || 'Cliente sin nombre'}</div>
                      <div style={{fontSize:10, color:S.t3}}>👤 {cobro.mesero || '—'}</div>
                    </div>
                    <div style={{textAlign:'right'}}>
                      <div style={{fontSize:9, color:tiempoColor, fontWeight:700, textTransform:'uppercase'}}>{tiempoEspera<1?'AHORA':`${tiempoEspera}m`}</div>
                    </div>
                  </div>
                  <div style={{borderTop:`1px solid ${S.border}`, paddingTop:10}}>
                    <div style={{display:'flex', justifyContent:'space-between', marginBottom:4}}>
                      <span style={{fontSize:11, color:S.t3}}>Consumo</span>
                      <span style={{fontSize:13, fontWeight:700, color:S.t1}}>{fmt(cobro.total)}</span>
                    </div>
                    {cobro.propina > 0 && (
                      <div style={{display:'flex', justifyContent:'space-between', marginBottom:4}}>
                        <span style={{fontSize:11, color:S.t3}}>Propina</span>
                        <span style={{fontSize:12, color:S.purple}}>{fmt(cobro.propina)}</span>
                      </div>
                    )}
                    <div style={{display:'flex', justifyContent:'space-between', borderTop:`1px solid ${S.border}`, paddingTop:6, marginTop:6}}>
                      <span style={{fontSize:12, color:S.t1, fontWeight:700}}>Total</span>
                      <span style={{fontFamily:"'Syne',sans-serif", fontSize:18, fontWeight:900, color:S.gold}}>{fmt(cobro.total + (cobro.propina||0))}</span>
                    </div>
                    <div style={{fontSize:10, color:S.t3, marginTop:6}}>{(cobro.items||[]).length} {(cobro.items||[]).length === 1 ? 'plato' : 'platos'} · {new Date(cobro.solicitado_at).toLocaleTimeString('es-CO', {hour:'2-digit', minute:'2-digit'})}</div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* PANTALLA 2 · COBRO INMEDIATO — overlay fullscreen al darle click a la
            cuenta ("que aparezca de una el cobro" · pedido boss Jun-11).
            Misma UX que el modo cliente del POS: pantalla dedicada, métodos
            grandes, sin distracciones. */}
        {selected && (
          <div onClick={()=>{ setSelected(null); setMetodoElegido(null); }}
            style={{position:'fixed', inset:0, zIndex:7000, background:'rgba(0,0,0,0.82)', display:'flex', alignItems:'center', justifyContent:'center', padding:18}}>
          <div onClick={e=>e.stopPropagation()}
            style={{width:'100%', maxWidth:520, maxHeight:'94vh', borderRadius:22, overflow:'hidden', border:`1px solid ${S.gold}33`, boxShadow:`0 24px 80px rgba(0,0,0,0.8), 0 0 40px ${S.gold}15`, background:'linear-gradient(180deg, #0f0f15 0%, #0a0a10 100%)', display:'flex', flexDirection:'column'}}>
            {/* HEADER con logo del restaurante */}
            <div style={{padding:'20px 24px 16px', borderBottom:`1px solid ${S.border}`, display:'flex', flexDirection:'column', alignItems:'center', gap:6, position:'relative'}}>
              <button onClick={()=>setSelected(null)} style={{position:'absolute',top:14,right:14,width:30, height:30, borderRadius:8, border:`1px solid ${S.border2}`, background:'transparent', color:S.t3, cursor:'pointer'}}><X size={14}/></button>
              <div style={{width:58,height:58,borderRadius:'50%',background:`linear-gradient(135deg, ${S.gold}, #B07820)`,display:'flex',alignItems:'center',justifyContent:'center',fontSize:30,marginBottom:4,boxShadow:`0 8px 24px ${S.gold}33`}}>
                {(activeRestaurant as any)?.emoji || '🏨'}
              </div>
              <div style={{fontFamily:"'Syne',serif", fontSize:18, fontWeight:900, letterSpacing:'-0.01em'}}>{(activeRestaurant as any)?.nombre || 'NEXUM'}</div>
              <div style={{fontSize:10, color:S.t3, letterSpacing:'.16em', textTransform:'uppercase'}}>Cobro en proceso</div>
              <div style={{display:'flex',alignItems:'center',gap:10,marginTop:4,padding:'6px 14px',background:`${S.gold}10`,border:`1px solid ${S.gold}30`,borderRadius:50}}>
                <span style={{fontFamily:"'Syne',serif",fontSize:14,fontWeight:900,color:S.gold}}>M{selected.mesa_num}</span>
                <span style={{fontSize:11,color:S.t2}}>·</span>
                <span style={{fontSize:11,color:S.t1,fontWeight:600}}>{selected.cliente_nombre || 'Cliente'}</span>
              </div>
            </div>

            {/* CUERPO */}
            <div style={{flex:1, overflowY:'auto', padding:'18px 22px'}}>
              <div style={{fontSize:10, color:S.t3, fontWeight:800, textTransform:'uppercase', marginBottom:8, letterSpacing:'.14em'}}>🍽️ Platos · {(selected.items||[]).length}</div>
              <div style={{display:'flex', flexDirection:'column', gap:5, marginBottom:18}}>
                {(selected.items||[]).map((it:any, i:number) => (
                  <div key={i} style={{display:'flex', justifyContent:'space-between', alignItems:'center', padding:'8px 12px', background:S.bg3, borderRadius:9, fontSize:12}}>
                    <span style={{flex:1}}>{it.emoji || '🍽️'} {it.nombre}</span>
                    <span style={{color:S.gold, fontWeight:800}}>{it.precio}</span>
                  </div>
                ))}
              </div>

              <div style={{padding:'14px 16px', background:`linear-gradient(135deg, ${S.gold}10, transparent)`, border:`1px solid ${S.gold}33`, borderRadius:14, marginBottom:18}}>
                <div style={{display:'flex', justifyContent:'space-between', marginBottom:6, fontSize:12, color:S.t2}}>
                  <span>Subtotal</span><span style={{color:S.t1, fontWeight:700}}>{fmt(selected.total)}</span>
                </div>
                {selected.propina > 0 && (
                  <div style={{display:'flex', justifyContent:'space-between', marginBottom:6, fontSize:12, color:S.t2}}>
                    <span>Propina sugerida</span><span style={{color:S.purple, fontWeight:700}}>{fmt(selected.propina)}</span>
                  </div>
                )}
                <div style={{display:'flex', justifyContent:'space-between', borderTop:`1px solid ${S.gold}33`, paddingTop:10, marginTop:8, alignItems:'baseline'}}>
                  <span style={{fontSize:11, color:S.t3, textTransform:'uppercase', letterSpacing:'.12em', fontWeight:700}}>Total a cobrar</span>
                  <span style={{fontFamily:"'Syne',serif", fontSize:28, fontWeight:900, color:S.gold, letterSpacing:'-0.02em'}}>{fmt(selected.total + (selected.propina||0))}</span>
                </div>
              </div>

              <div style={{fontSize:10, color:S.t3, fontWeight:800, textTransform:'uppercase', marginBottom:10, letterSpacing:'.14em'}}>Método de pago</div>
              <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:10}}>
                {[
                  { id:'efectivo' as const,      emoji:'💵', label:'Efectivo',       color:S.green },
                  { id:'datafono' as const,      emoji:'💳', label:'Datáfono',       color:S.blue },
                  { id:'tarjeta' as const,       emoji:'💎', label:'Tarjeta',        color:S.purple },
                  { id:'transferencia' as const, emoji:'📱', label:'Transferencia',  color:S.cyan },
                ].map(m => (
                  <button key={m.id} onClick={()=>{ setMetodoElegido(m.id); setTimeout(()=>procesarCobro(selected, m.id), 350); }} disabled={procesando}
                    style={{
                      padding:'18px 12px', borderRadius:14,
                      border:`2px solid ${metodoElegido===m.id?m.color:`${m.color}40`}`,
                      background: metodoElegido===m.id ? `${m.color}30` : `${m.color}10`,
                      color:m.color, fontSize:12, fontWeight:800, cursor:procesando?'not-allowed':'pointer',
                      display:'flex', flexDirection:'column', alignItems:'center', gap:6,
                      transform: metodoElegido===m.id ? 'scale(0.96)' : 'scale(1)',
                      boxShadow: metodoElegido===m.id ? `0 0 24px ${m.color}80, inset 0 0 16px ${m.color}40` : 'none',
                      transition: 'all .18s cubic-bezier(.34,1.5,.64,1)',
                    }}>
                    <span style={{fontSize:28, lineHeight:1}}>{m.emoji}</span>
                    <span>{m.label}</span>
                    {metodoElegido===m.id && <span style={{fontSize:9,opacity:0.8}}>✓ Procesando…</span>}
                  </button>
                ))}
              </div>

              <button onClick={()=>rechazar(selected)} disabled={procesando}
                style={{width:'100%', marginTop:18, padding:'11px 14px', borderRadius:10, border:`1px solid ${S.red}40`, background:`${S.red}08`, color:S.red, fontSize:11, fontWeight:700, cursor:procesando?'not-allowed':'pointer'}}>
                ↩ Devolver al mesero
              </button>
            </div>

            {/* FOOTER · Salir by NEXUM v4 */}
            <div style={{padding:'12px 22px', borderTop:`1px solid ${S.border}`, display:'flex', alignItems:'center', justifyContent:'space-between', background:'#08080c'}}>
              <button onClick={()=>setSelected(null)}
                style={{padding:'6px 14px',borderRadius:50,border:'1px solid rgba(255,255,255,0.08)',background:'transparent',color:S.t2,fontSize:11,fontWeight:700,cursor:'pointer'}}>
                ← Salir
              </button>
              <span style={{fontSize:9,color:S.t3,letterSpacing:'.18em',fontWeight:600,fontFamily:"'IBM Plex Mono', monospace"}}>by NEXUM v4</span>
            </div>
          </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════
// ENCUESTA X-CARE COMPLETA · misma lógica del modo cliente del POS:
// caritas (sentimiento) → categorías → sub-pantallas por categoría
// (incluye los PLATOS de la cuenta) → comentario si fue negativa.
// Guarda en xcare_encuestas + xcare_alertas igual que el POS.
// ═════════════════════════════════════════════════════════════════════
function EncuestaXCareCompleta({ mesa, items, cliente, telefono, restauranteId, restaurant, S, onDone }:{
  mesa:number; items:any[]; cliente?:string; telefono?:string;
  restauranteId:number; restaurant:any; S:any; onDone:()=>void;
}) {
  const [step, setStep] = React.useState<'sentiment'|'cat'|'sub'|'comentario'|'done'>('sentiment');
  const [rating, setRating] = React.useState(0);
  const [tags, setTags] = React.useState<string[]>([]);
  const [subIdx, setSubIdx] = React.useState(0);
  const [sel, setSel] = React.useState<Record<string,string[]>>({});
  const [comentario, setComentario] = React.useState('');

  // ── Mismas caritas del POS ──
  const CARITAS = [
    {n:1, emoji:'😡', label:'Muy mala',   color:'#FF5252'},
    {n:2, emoji:'😕', label:'Mala',       color:'#FF7043'},
    {n:3, emoji:'😐', label:'Regular',    color:'#FFB547'},
    {n:4, emoji:'😊', label:'Muy buena',  color:'#69F0AE'},
    {n:5, emoji:'🤩', label:'Increíble',  color:'#00E676'},
  ];
  const isPositive = rating >= 4;
  const accent = rating>=4 ? '#00E676' : rating>0 ? '#FF5252' : S.pink;

  // ── Mismas categorías del POS ──
  const POS_CATS = [
    {e:'🍽️',l:'Comida'},{e:'🍸',l:'Bebidas'},{e:'💁',l:'Servicio'},
    {e:'🎵',l:'Ambiente'},{e:'⚡',l:'Rapidez'},
  ];
  const NEG_CATS = [
    {e:'🍽️',l:'Comida'},{e:'🍸',l:'Bebidas'},{e:'💁',l:'Servicio'},{e:'⏳',l:'Tiempo'},
  ];
  const cats = isPositive ? POS_CATS : NEG_CATS;
  const maxSel = isPositive ? 2 : 4;

  // ── Platos/bebidas de la cuenta cobrada ──
  const clasificar = (nombre:string):'comida'|'bebida' =>
    /coctel|cóctel|vino|cerveza|copa|gin|whisky|vodka|sake|tequila|mezcal|margarita|jugo|limonada|café|agua|jarra|soda|refresco/i.test(nombre) ? 'bebida' : 'comida';
  const nombres = (items||[]).map((it:any)=>String(it.nombre||'')).filter(Boolean);
  const platosOrden  = Array.from(new Set(nombres.filter(n=>clasificar(n)==='comida'))).slice(0,6);
  const bebidasOrden = Array.from(new Set(nombres.filter(n=>clasificar(n)==='bebida'))).slice(0,6);

  // ── Cola de sub-pantallas según categorías (idéntica al POS) ──
  const buildQueue = (tg:string[]):string[] => {
    const q:string[] = [];
    tg.forEach(c=>{
      if (isPositive) {
        if (c==='Comida' && platosOrden.length>0)  q.push('pos-comida');
        else if (c==='Bebidas' && bebidasOrden.length>0) q.push('pos-bebida');
        else if (c==='Ambiente') q.push('pos-ambiente');
        else if (c==='Rapidez')  q.push('pos-rapidez');
      } else {
        if (c==='Comida')  { q.push('neg-comida-que'); if(platosOrden.length>0) q.push('neg-comida-item'); }
        else if (c==='Bebidas') { q.push('neg-bebida-que'); if(bebidasOrden.length>0) q.push('neg-bebida-item'); }
        else if (c==='Servicio') q.push('neg-servicio-que');
        else if (c==='Tiempo')   q.push('neg-tiempo');
      }
    });
    return q;
  };
  const queue = buildQueue(tags);
  const subScreen = queue[subIdx];

  const SUBS: Record<string,{titulo:string;sub:string;opciones:{e?:string;l:string}[]}> = {
    'pos-comida':   {titulo:'¿Qué plato te encantó?', sub:'Toca tu favorito', opciones:platosOrden.map(p=>({e:'🍽️',l:p}))},
    'pos-bebida':   {titulo:'¿Qué bebida te gustó más?', sub:'Toca tu favorita', opciones:bebidasOrden.map(b=>({e:'🍸',l:b}))},
    'pos-ambiente': {titulo:'¿Qué fue lo que más te gustó?', sub:'Del ambiente', opciones:[{e:'🎵',l:'Música'},{e:'🛋️',l:'Decoración'},{e:'✨',l:'Energía'},{e:'🎭',l:'Shows'},{e:'💡',l:'Iluminación'}]},
    'pos-rapidez':  {titulo:'¿Qué estuvo más ágil?', sub:'Lo que más te sorprendió', opciones:[{e:'🤝',l:'Atención inicial'},{e:'🍸',l:'Bebidas'},{e:'🍽️',l:'Cocina'},{e:'💳',l:'La cuenta'}]},
    'neg-comida-que':  {titulo:'¿Qué pasó con la comida?', sub:'Toca los que apliquen', opciones:[{e:'🥩',l:'Sabor'},{e:'🔥',l:'Temperatura'},{e:'🍽️',l:'Calidad'},{e:'❌',l:'Otro'}]},
    'neg-comida-item': {titulo:'¿Con cuál plato?', sub:'Toca los que apliquen', opciones:platosOrden.map(p=>({e:'🍽️',l:p}))},
    'neg-bebida-que':  {titulo:'¿Qué pasó con la bebida?', sub:'Toca los que apliquen', opciones:[{e:'🍬',l:'Muy dulce'},{e:'🥃',l:'Muy fuerte'},{e:'❄️',l:'Temperatura'},{e:'❌',l:'Otro'}]},
    'neg-bebida-item': {titulo:'¿Cuál bebida fue?', sub:'Toca las que apliquen', opciones:bebidasOrden.map(b=>({e:'🍸',l:b}))},
    'neg-servicio-que':{titulo:'¿Qué pasó con el servicio?', sub:'Tu respuesta es confidencial', opciones:[{e:'😐',l:'Empatía'},{e:'🧠',l:'Capacitación'},{e:'⏳',l:'Demoras'},{e:'❌',l:'Otro'}]},
    'neg-tiempo':      {titulo:'¿Dónde hubo demora?', sub:'Lo que más te hizo esperar', opciones:[{e:'🍽️',l:'Cocina'},{e:'🍸',l:'Bebidas'},{e:'🪑',l:'En la mesa'},{e:'💳',l:'La cuenta'}]},
  };

  // ── Guardado idéntico al POS ──
  const guardar = async (coment?:string) => {
    const itemsSel:string[] = [];
    const detalles:string[] = [];
    Object.entries(sel).forEach(([sid,vals])=>{
      if (/item|pos-comida|pos-bebida/.test(sid)) itemsSel.push(...vals);
      else detalles.push(...vals);
    });
    await supabase.from('xcare_encuestas').insert({
      restaurante_id: restauranteId, mesa_numero: mesa,
      nombre_cliente: cliente || null,
      cliente_telefono: telefono || null,
      estrellas: rating,
      tags_positivos: isPositive ? tags : null,
      tags_negativos: !isPositive ? [...tags, ...detalles] : null,
      platos_problema: itemsSel.length ? itemsSel : null,
      comentario: (coment ?? comentario) || null,
      nps_score: rating===5?10:rating===4?8:rating===3?6:rating===2?3:1,
      alerta_gerente: !isPositive,
    }).then(()=>{}, ()=>{});
    if (!isPositive) {
      await supabase.from('xcare_alertas').insert({
        restaurante_id: restauranteId, mesa_numero: mesa, tipo:'experiencia_negativa',
        descripcion:`${cliente||'Cliente'} — ${CARITAS[rating-1]?.label||''} — ${tags.join(', ')||'Sin categoría'}${detalles.length?` · ${detalles.join(', ')}`:''}${itemsSel.length?` · ${itemsSel.join(', ')}`:''}${(coment??comentario)?` — "${coment??comentario}"`:''}`,
        activa:true,
      }).then(()=>{}, ()=>{});
    }
  };

  // ── Navegación (idéntica al POS) ──
  const finalizar = () => {
    if (rating>=4) { guardar(); setStep('done'); setTimeout(onDone, 1600); }
    else setStep('comentario');
  };
  const irADetalle = (tg:string[]) => {
    const q = buildQueue(tg);
    if (q.length===0) { setTags(tg); finalizar(); return; }
    setTags(tg); setSubIdx(0); setStep('sub');
  };
  const siguienteSub = () => {
    if (subIdx + 1 < queue.length) setSubIdx(i=>i+1);
    else finalizar();
  };
  const toggleSel = (sid:string, val:string) =>
    setSel(prev => {
      const cur = prev[sid]||[];
      return { ...prev, [sid]: cur.includes(val) ? cur.filter(v=>v!==val) : [...cur, val] };
    });

  const btnStyle = (active:boolean, color:string):React.CSSProperties => ({
    padding:'13px 16px', borderRadius:14, cursor:'pointer',
    border:`1.5px solid ${active?color:'rgba(255,255,255,0.12)'}`,
    background: active?`${color}1f`:'rgba(255,255,255,0.04)',
    color: active?color:'#d0d0d8', fontSize:14, fontWeight:700,
    display:'flex', alignItems:'center', gap:10, width:'100%',
    transition:'all .15s', textAlign:'left',
  });

  return (
    <div style={{position:'fixed', inset:0, background:'linear-gradient(180deg, #0a0a10 0%, #000 100%)', zIndex:8000, display:'flex', flexDirection:'column', alignItems:'center', padding:'70px 24px 60px', overflowY:'auto'}}>
      {/* Logo */}
      <div style={{position:'absolute',top:22,left:'50%',transform:'translateX(-50%)',display:'flex',flexDirection:'column',alignItems:'center',gap:5}}>
        <div style={{width:48,height:48,borderRadius:'50%',background:`linear-gradient(135deg, ${S.gold}, #B07820)`,display:'flex',alignItems:'center',justifyContent:'center',fontSize:24,boxShadow:`0 6px 24px ${S.gold}55`}}>
          {restaurant?.emoji || '🏨'}
        </div>
        <div style={{fontFamily:"'Syne',serif",fontSize:13,fontWeight:900,letterSpacing:'.06em'}}>{restaurant?.nombre || 'NEXUM'}</div>
      </div>

      <div style={{width:'100%',maxWidth:460,flex:1,display:'flex',flexDirection:'column',justifyContent:'center'}}>

        {/* PASO 1 · CARITAS */}
        {step==='sentiment' && (
          <div style={{textAlign:'center'}}>
            <div style={{fontFamily:"'Syne',serif",fontSize:26,fontWeight:900,lineHeight:1.2,marginBottom:8}}>
              {cliente ? `${String(cliente).split(' ')[0]}, ¿cómo estuvo tu experiencia?` : '¿Cómo estuvo tu experiencia hoy?'}
            </div>
            <div style={{fontSize:13,color:S.t2,marginBottom:42}}>Tu opinión mejora la experiencia ✨</div>
            <div style={{display:'flex',justifyContent:'center',gap:8}}>
              {CARITAS.map(c=>(
                <button key={c.n} onClick={()=>{ setRating(c.n); setStep('cat'); }}
                  style={{flex:1,background:'none',border:'none',cursor:'pointer',display:'flex',flexDirection:'column',alignItems:'center',gap:8,padding:'8px 2px'}}>
                  <span style={{fontSize:44,lineHeight:1}}>{c.emoji}</span>
                  <span style={{fontSize:10.5,fontWeight:700,color:S.t3}}>{c.label}</span>
                </button>
              ))}
            </div>
            <button onClick={onDone} style={{marginTop:48,background:'none',border:'none',fontSize:11.5,color:S.t3,cursor:'pointer'}}>Omitir</button>
          </div>
        )}

        {/* PASO 2 · CATEGORÍAS */}
        {step==='cat' && (
          <div style={{textAlign:'center'}}>
            <div style={{fontSize:38,marginBottom:8}}>{CARITAS[rating-1]?.emoji}</div>
            <div style={{fontFamily:"'Syne',serif",fontSize:22,fontWeight:900,marginBottom:6}}>
              {isPositive ? '¿Qué fue lo mejor?' : '¿Qué podemos mejorar?'}
            </div>
            <div style={{fontSize:12,color:S.t2,marginBottom:26}}>
              {isPositive ? `Elegí hasta ${maxSel}` : 'Toca todo lo que aplique'}
            </div>
            <div style={{display:'flex',flexDirection:'column',gap:8}}>
              {cats.map(c=>{
                const active = tags.includes(c.l);
                return (
                  <button key={c.l}
                    onClick={()=>setTags(p=> active ? p.filter(x=>x!==c.l) : (p.length<maxSel ? [...p,c.l] : p))}
                    style={btnStyle(active, accent)}>
                    <span style={{fontSize:20}}>{c.e}</span><span>{c.l}</span>
                    {active && <span style={{marginLeft:'auto',color:accent}}>✓</span>}
                  </button>
                );
              })}
            </div>
            <button onClick={()=>irADetalle(tags)} disabled={tags.length===0}
              style={{marginTop:22,width:'100%',padding:'14px',borderRadius:14,border:'none',background:tags.length?accent:'rgba(255,255,255,0.08)',color:tags.length?'#000':'#606060',fontSize:14,fontWeight:900,cursor:tags.length?'pointer':'not-allowed'}}>
              Continuar →
            </button>
            <button onClick={finalizar} style={{marginTop:12,background:'none',border:'none',fontSize:11,color:S.t3,cursor:'pointer'}}>Omitir detalle</button>
          </div>
        )}

        {/* PASO 3 · SUB-PANTALLAS (ruta + platos de la cuenta) */}
        {step==='sub' && subScreen && SUBS[subScreen] && (
          <div style={{textAlign:'center'}}>
            <div style={{fontSize:10,color:S.t3,letterSpacing:'.18em',textTransform:'uppercase',marginBottom:10}}>
              {subIdx+1} de {queue.length}
            </div>
            <div style={{fontFamily:"'Syne',serif",fontSize:22,fontWeight:900,marginBottom:4}}>{SUBS[subScreen].titulo}</div>
            <div style={{fontSize:12,color:S.t2,marginBottom:24}}>{SUBS[subScreen].sub}</div>
            <div style={{display:'flex',flexDirection:'column',gap:8,maxHeight:'46vh',overflowY:'auto'}}>
              {SUBS[subScreen].opciones.map(op=>{
                const active = (sel[subScreen]||[]).includes(op.l);
                return (
                  <button key={op.l} onClick={()=>toggleSel(subScreen, op.l)} style={btnStyle(active, accent)}>
                    {op.e && <span style={{fontSize:20}}>{op.e}</span>}<span style={{flex:1,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{op.l}</span>
                    {active && <span style={{color:accent}}>✓</span>}
                  </button>
                );
              })}
            </div>
            <button onClick={siguienteSub}
              style={{marginTop:22,width:'100%',padding:'14px',borderRadius:14,border:'none',background:accent,color:'#000',fontSize:14,fontWeight:900,cursor:'pointer'}}>
              {subIdx+1 < queue.length ? 'Siguiente →' : 'Continuar →'}
            </button>
          </div>
        )}

        {/* PASO 4 · COMENTARIO (solo experiencias negativas) */}
        {step==='comentario' && (
          <div style={{textAlign:'center'}}>
            <div style={{fontFamily:"'Syne',serif",fontSize:22,fontWeight:900,marginBottom:6}}>¿Algo más que contarnos?</div>
            <div style={{fontSize:12,color:S.t2,marginBottom:22}}>Tu mensaje llega directo a gerencia 🤝</div>
            <textarea value={comentario} onChange={e=>setComentario(e.target.value)} rows={4}
              placeholder="Escribí acá (opcional)…"
              style={{width:'100%',background:'rgba(255,255,255,0.05)',border:`1px solid rgba(255,255,255,0.15)`,borderRadius:14,padding:'14px 16px',color:'#fff',fontSize:14,outline:'none',resize:'none'}}/>
            <button onClick={async()=>{ await guardar(comentario); setStep('done'); setTimeout(onDone, 1600); }}
              style={{marginTop:18,width:'100%',padding:'14px',borderRadius:14,border:'none',background:accent,color:'#000',fontSize:14,fontWeight:900,cursor:'pointer'}}>
              Enviar ✓
            </button>
          </div>
        )}

        {/* PASO 5 · GRACIAS */}
        {step==='done' && (
          <div style={{textAlign:'center'}}>
            <div style={{fontSize:64,marginBottom:14}}>{isPositive?'🙌':'🤝'}</div>
            <div style={{fontFamily:"'Syne',serif",fontSize:26,fontWeight:900,marginBottom:8}}>¡Gracias por tu opinión!</div>
            <div style={{fontSize:13,color:S.t2}}>{isPositive?'Nos vemos pronto ✨':'Vamos a mejorar — gracias por contarnos.'}</div>
          </div>
        )}
      </div>

      <div style={{position:'absolute',bottom:20,left:0,right:0,display:'flex',alignItems:'center',justifyContent:'center'}}>
        <span style={{fontSize:10,color:S.t3,letterSpacing:'.22em',fontWeight:700,fontFamily:"'IBM Plex Mono', monospace",textTransform:'uppercase'}}>by NEXUM v4</span>
      </div>
    </div>
  );
}
