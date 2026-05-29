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
    setPantallaFinal({ activa:true, mesa: cobro.mesa_num, total: cobro.total + (cobro.propina||0), metodo });
    showToast(`✓ Mesa ${cobro.mesa_num} cobrada · ${fmt(cobro.total + (cobro.propina||0))}`);
  };

  const rechazar = async (cobro: CobroPendiente) => {
    if (!confirm(`¿Cancelar el cobro de la mesa ${cobro.mesa_num}? Volverá al mesero para revisión.`)) return;
    await supabase.from('cobros_pendientes').update({ estado: 'cancelado' }).eq('id', cobro.id);
    setSelected(null);
    showToast(`Mesa ${cobro.mesa_num} devuelta al mesero`);
  };

  return (
    <div style={{height:'100%', display:'flex', flexDirection:'column', background:S.bg, color:S.t1, fontFamily:"'DM Sans',sans-serif", overflow:'hidden'}}>
      {toast && <div style={{position:'fixed', bottom:24, left:'50%', transform:'translateX(-50%)', background:S.bg4, border:`1px solid ${S.pink}`, color:S.t1, padding:'10px 28px', borderRadius:50, fontSize:13, fontWeight:700, zIndex:9999}}>{toast}</div>}

      {/* Pantalla de confirmación final */}
      {pantallaFinal?.activa && (
        <div style={{position:'fixed', inset:0, background:'#000', zIndex:8000, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', padding:24}}>
          <div style={{width:90, height:90, borderRadius:'50%', background:S.green, display:'flex', alignItems:'center', justifyContent:'center', fontSize:48, marginBottom:24}}>✓</div>
          <div style={{fontFamily:"'Syne',sans-serif", fontSize:32, fontWeight:900, marginBottom:8}}>Cobro completado</div>
          <div style={{fontSize:40, fontWeight:900, color:S.gold, marginBottom:6}}>{fmt(pantallaFinal.total)}</div>
          <div style={{fontSize:14, color:S.t2, marginBottom:6}}>Mesa {pantallaFinal.mesa} · {pantallaFinal.metodo}</div>
          <button onClick={() => setPantallaFinal(null)}
            style={{marginTop:24, padding:'12px 36px', borderRadius:12, border:'none', background:S.gold, color:'#000', fontSize:13, fontWeight:900, cursor:'pointer'}}>
            Siguiente cobro
          </button>
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

        {/* Panel derecho de proceso */}
        {selected && (
          <div style={{width:380, borderLeft:`1px solid ${S.border}`, background:S.bg2, display:'flex', flexDirection:'column', flexShrink:0}}>
            <div style={{padding:'16px 20px', borderBottom:`1px solid ${S.border}`, display:'flex', alignItems:'center', gap:10}}>
              <div style={{width:42, height:42, borderRadius:11, background:`linear-gradient(135deg,${S.gold},#d4943a)`, display:'flex', alignItems:'center', justifyContent:'center', color:'#000', fontWeight:900, fontFamily:"'Syne',sans-serif"}}>M{selected.mesa_num}</div>
              <div style={{flex:1}}>
                <div style={{fontFamily:"'Syne',sans-serif", fontSize:15, fontWeight:900}}>{selected.cliente_nombre || 'Cliente'}</div>
                <div style={{fontSize:10, color:S.t3}}>Atendido por {selected.mesero || '—'}</div>
              </div>
              <button onClick={()=>setSelected(null)} style={{width:30, height:30, borderRadius:8, border:`1px solid ${S.border2}`, background:'transparent', color:S.t3, cursor:'pointer'}}><X size={14}/></button>
            </div>

            <div style={{flex:1, overflowY:'auto', padding:16}}>
              <div style={{fontSize:10, color:S.t3, fontWeight:700, textTransform:'uppercase', marginBottom:8}}>Platos consumidos · {(selected.items||[]).length}</div>
              <div style={{display:'flex', flexDirection:'column', gap:6, marginBottom:18}}>
                {(selected.items||[]).map((it:any, i:number) => (
                  <div key={i} style={{display:'flex', justifyContent:'space-between', padding:'7px 10px', background:S.bg3, borderRadius:9, fontSize:12}}>
                    <span style={{flex:1}}>{it.emoji || '🍽️'} {it.nombre}</span>
                    <span style={{color:S.gold, fontWeight:700}}>{it.precio}</span>
                  </div>
                ))}
              </div>

              <div style={{padding:14, background:S.bg3, borderRadius:12, marginBottom:18}}>
                <div style={{display:'flex', justifyContent:'space-between', marginBottom:6}}>
                  <span style={{fontSize:12, color:S.t2}}>Subtotal</span>
                  <span style={{fontSize:13, color:S.t1, fontWeight:700}}>{fmt(selected.total)}</span>
                </div>
                {selected.propina > 0 && (
                  <div style={{display:'flex', justifyContent:'space-between', marginBottom:6}}>
                    <span style={{fontSize:12, color:S.t2}}>Propina sugerida</span>
                    <span style={{fontSize:13, color:S.purple, fontWeight:700}}>{fmt(selected.propina)}</span>
                  </div>
                )}
                <div style={{display:'flex', justifyContent:'space-between', borderTop:`1px solid ${S.border}`, paddingTop:8, marginTop:8}}>
                  <span style={{fontSize:14, color:S.t1, fontWeight:700}}>TOTAL A COBRAR</span>
                  <span style={{fontFamily:"'Syne',sans-serif", fontSize:22, fontWeight:900, color:S.gold}}>{fmt(selected.total + (selected.propina||0))}</span>
                </div>
              </div>

              <div style={{fontSize:10, color:S.t3, fontWeight:700, textTransform:'uppercase', marginBottom:8}}>Método de pago</div>
              <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:8}}>
                {[
                  { id:'efectivo' as const, label:'💵 Efectivo', icon: <Banknote size={18}/>, color:S.green },
                  { id:'datafono' as const, label:'💳 Datáfono', icon: <CreditCard size={18}/>, color:S.blue },
                  { id:'tarjeta' as const, label:'💎 Tarjeta', icon: <CreditCard size={18}/>, color:S.purple },
                  { id:'transferencia' as const, label:'📱 Transferencia', icon: <Smartphone size={18}/>, color:S.cyan },
                ].map(m => (
                  <button key={m.id} onClick={()=>procesarCobro(selected, m.id)} disabled={procesando}
                    style={{padding:'14px 10px', borderRadius:11, border:`1.5px solid ${m.color}40`, background:`${m.color}10`, color:m.color, fontSize:12, fontWeight:700, cursor:procesando?'not-allowed':'pointer', display:'flex', flexDirection:'column', alignItems:'center', gap:6}}>
                    <span style={{fontSize:24}}>{m.label.split(' ')[0]}</span>
                    <span>{m.label.split(' ').slice(1).join(' ')}</span>
                  </button>
                ))}
              </div>

              <button onClick={()=>rechazar(selected)} disabled={procesando}
                style={{width:'100%', marginTop:16, padding:'10px 14px', borderRadius:10, border:`1px solid ${S.red}40`, background:`${S.red}08`, color:S.red, fontSize:11, fontWeight:700, cursor:procesando?'not-allowed':'pointer'}}>
                ⚠ Devolver al mesero (rechazar)
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
