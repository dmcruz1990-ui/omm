// ============================================================
// NEXUM — ChatFlowModule.tsx  v2
// Chat Flow: mensajes en tiempo real entre sala, cocina y caja
// Book Flow: timeline de platos — lee del flowStore (datos reales del POS)
// Care Live: alertas de experiencia en sala
// ============================================================

import React, { useState, useEffect, useRef } from 'react';

// Tipos inline — no depende de flowStore para el build
type EtapaPlato = 'pedido' | 'cocina' | 'listo' | 'entregado';
interface PlatoFlow { id:string; mesa:number; plato:string; emoji:string; mesero:string; etapa:EtapaPlato; hora_pedido:string; hora_cocina?:string; hora_listo?:string; hora_entregado?:string; minutos_transcurridos:number; urgente:boolean; termino?:string; }
interface MensajeFlow { id:string; from:string; rol:'cocina'|'caja'|'mesero'|'maitre'|'sistema'; mesa?:number; texto:string; hora:string; leido:boolean; urgente?:boolean; }

const useChatFlowState = () => {
  const [platos, setPlatos] = useState<PlatoFlow[]>([]);
  const [mensajes, setMensajes] = useState<MensajeFlow[]>([
    { id:'sys1', from:'Sistema', rol:'sistema', texto:'Flow Center activo.', hora:'--:--', leido:true },
  ]);
  const avanzarEtapa = (id: string) => {
    const etapas: EtapaPlato[] = ['pedido','cocina','listo','entregado'];
    setPlatos(prev => prev.map(p => {
      if (p.id !== id) return p;
      const idx = etapas.indexOf(p.etapa);
      if (idx >= etapas.length-1) return p;
      return { ...p, etapa: etapas[idx+1] };
    }));
  };
  const agregarMensaje = (msg: Omit<MensajeFlow,'id'|'hora'|'leido'>) => {
    setMensajes(prev => [{ ...msg, id:Date.now().toString(), hora:new Date().toLocaleTimeString('es-CO',{hour:'2-digit',minute:'2-digit'}), leido:false }, ...prev]);
  };
  const marcarLeidos = () => setMensajes(prev => prev.map(m => ({...m, leido:true})));
  const tickMinutos = () => setPlatos(prev => prev.map(p => p.etapa!=='entregado' ? {...p, minutos_transcurridos: p.minutos_transcurridos+1, urgente: p.etapa==='cocina' && p.minutos_transcurridos>=12} : p));
  const limpiarEntregados = () => setPlatos(prev => prev.filter(p => p.etapa!=='entregado' || p.minutos_transcurridos<30));
  return { platos, mensajes, avanzarEtapa, agregarMensaje, marcarLeidos, tickMinutos, limpiarEntregados };
};

const S = {
  bg:'#0a0a0a', bg2:'#141414', bg3:'#1c1c1c',
  border:'#2a2a2a', text1:'#f0f0f0', text2:'#a0a0a0', text3:'#606060',
  gold:'#d4943a', goldL:'#f0b45a', green:'#3dba6f',
  red:'#e05050', blue:'#4a8fd4', purple:'#9b72ff',
};

type Tab = 'chat' | 'book' | 'care';

interface AlertaCare {
  id: string; mesa: number;
  tipo: 'demora' | 'solicitud' | 'queja' | 'felicitacion' | 'vip';
  mensaje: string; hora: string; atendida: boolean;
  prioridad: 'alta' | 'media' | 'baja';
}

const ALERTAS_INIT: AlertaCare[] = [
  { id:'a1', mesa:2,  tipo:'vip',       mensaje:'Cliente VIP Sr. Martínez — revisar preferencias. Última visita: tuvo demora en principales.', hora:'19:30', atendida:false, prioridad:'alta' },
  { id:'a2', mesa:6,  tipo:'solicitud', mensaje:'Mesa 6 solicita opciones vegetarianas — mesero necesita apoyo del chef.', hora:'19:38', atendida:false, prioridad:'media' },
  { id:'a3', mesa:1,  tipo:'felicitacion', mensaje:'Mesa 1 felicitó al mesero — calificó el servicio con 5 estrellas.', hora:'19:15', atendida:true, prioridad:'baja' },
];

const ETAPAS: EtapaPlato[] = ['pedido','cocina','listo','entregado'];
const ETAPA_LABEL: Record<string,string> = { pedido:'Pedido', cocina:'En cocina', listo:'Listo ✅', entregado:'Entregado' };
const ETAPA_COLOR: Record<string,string> = { pedido:S.text3, cocina:S.gold, listo:S.green, entregado:S.blue };
const ETAPA_ICON: Record<string,string>  = { pedido:'📝', cocina:'🔥', listo:'✅', entregado:'🍽️' };
const ROLES_COLOR: Record<string,string> = { cocina:S.red, caja:S.gold, mesero:S.blue, maitre:S.purple, sistema:S.text3 };

export default function ChatFlowModule() {
  const [tab, setTab] = useState<Tab>('book');
  const [alertas, setAlertas] = useState<AlertaCare[]>(ALERTAS_INIT);
  const [nuevoMsg, setNuevoMsg] = useState('');
  const [rolEmisor, setRolEmisor] = useState<'mesero'|'cocina'|'caja'|'maitre'>('mesero');
  const [mesaFiltro, setMesaFiltro] = useState<number|null>(null);
  const [toast, setToast] = useState('');

  // ── Datos en tiempo real del POS via flowStore ───────────
  const { platos, mensajes, avanzarEtapa, agregarMensaje, marcarLeidos, tickMinutos, limpiarEntregados } = useChatFlowState();

  const showToast = (m: string) => { setToast(m); setTimeout(() => setToast(''), 2800); };

  // Ticker de minutos — actualiza tiempos transcurridos
  useEffect(() => {
    const interval = setInterval(() => {
      tickMinutos();
      limpiarEntregados();
    }, 60000);
    return () => clearInterval(interval);
  }, []);

  const enviarMensaje = () => {
    if (!nuevoMsg.trim()) return;
    agregarMensaje({ from: rolEmisor === 'mesero' ? 'Yo' : rolEmisor, rol: rolEmisor, texto: nuevoMsg, urgente: false });
    setNuevoMsg('');
    showToast('Mensaje enviado');
  };

  const atenderAlerta = (id: string) => {
    setAlertas(prev => prev.map(a => a.id === id ? { ...a, atendida: true } : a));
    showToast('Alerta atendida');
  };

  const noLeidos      = mensajes.filter(m => !m.leido).length;
  const platosUrgentes = platos.filter(p => p.urgente && p.etapa !== 'entregado').length;
  const alertasActivas = alertas.filter(a => !a.atendida).length;
  const platosActivos  = platos.filter(p => p.etapa !== 'entregado');

  // Mesas únicas con platos activos (para filtro)
  const mesasActivas = [...new Set(platosActivos.map(p => p.mesa))].sort((a,b)=>a-b);

  const inp = {
    background: S.bg2, border: `1px solid ${S.border}`, borderRadius: 10,
    padding: '9px 14px', color: S.text1, fontSize: 13, outline: 'none', flex: 1 as const,
  };

  return (
    <div style={{ display:'flex', flexDirection:'column', height:'100%', background:S.bg, color:S.text1, fontFamily:"'DM Sans',sans-serif" }}>

      {toast && (
        <div style={{ position:'fixed', bottom:24, left:'50%', transform:'translateX(-50%)', background:'#222', border:`1px solid ${S.border}`, color:S.text1, padding:'10px 20px', borderRadius:10, fontSize:13, zIndex:9999, whiteSpace:'nowrap' }}>
          {toast}
        </div>
      )}

      {/* Header */}
      <div style={{ padding:'14px 20px', borderBottom:`1px solid ${S.border}`, display:'flex', alignItems:'center', justifyContent:'space-between', flexShrink:0 }}>
        <div style={{ display:'flex', alignItems:'center', gap:12 }}>
          <div style={{ width:36, height:36, borderRadius:10, background:`linear-gradient(135deg,${S.blue},#2a5fa0)`, display:'flex', alignItems:'center', justifyContent:'center', fontSize:18 }}>💬</div>
          <div>
            <div style={{ fontFamily:"'Syne',sans-serif", fontSize:15, fontWeight:900 }}>FLOW CENTER</div>
            <div style={{ fontSize:11, color:S.text3 }}>Chat · Book · Care Live — datos en tiempo real</div>
          </div>
        </div>
        <div style={{ display:'flex', gap:6, alignItems:'center' }}>
          {platosActivos.length > 0 && (
            <span style={{ background:`${S.gold}20`, color:S.goldL, border:`1px solid ${S.gold}40`, padding:'4px 10px', borderRadius:20, fontSize:11, fontWeight:700 }}>
              🔥 {platosActivos.length} en curso
            </span>
          )}
          {platosUrgentes > 0 && (
            <span style={{ background:`${S.red}20`, color:S.red, border:`1px solid ${S.red}40`, padding:'4px 10px', borderRadius:20, fontSize:11, fontWeight:700 }}>
              ⚠️ {platosUrgentes} urgentes
            </span>
          )}
          {noLeidos > 0 && (
            <span style={{ background:`${S.blue}20`, color:S.blue, border:`1px solid ${S.blue}40`, padding:'4px 10px', borderRadius:20, fontSize:11, fontWeight:700 }}>
              💬 {noLeidos}
            </span>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display:'flex', borderBottom:`1px solid ${S.border}`, flexShrink:0 }}>
        {([
          { id:'book', label:`📋 Book Flow${platosUrgentes > 0 ? ` · ⚠️ ${platosUrgentes}` : platosActivos.length > 0 ? ` · ${platosActivos.length}` : ''}` },
          { id:'chat', label:`💬 Chat Flow${noLeidos > 0 ? ` · ${noLeidos}` : ''}` },
          { id:'care', label:`🛟 Care Live${alertasActivas > 0 ? ` · ${alertasActivas}` : ''}` },
        ] as const).map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            style={{ padding:'10px 20px', background:'none', border:'none', cursor:'pointer', fontSize:12, fontWeight:700, whiteSpace:'nowrap', color:tab===t.id?S.blue:S.text3, borderBottom:`2px solid ${tab===t.id?S.blue:'transparent'}`, transition:'all .15s' }}>
            {t.label}
          </button>
        ))}
      </div>

      <div style={{ flex:1, overflowY:'auto', padding:16, display:'flex', flexDirection:'column', gap:10 }}>

        {/* ── BOOK FLOW — datos reales del POS ── */}
        {tab === 'book' && (
          <>
            {/* KPIs de etapas */}
            <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:8 }}>
              {ETAPAS.map(e => {
                const count = platos.filter(p => p.etapa === e).length;
                return (
                  <div key={e} style={{ background:S.bg2, border:`1px solid ${ETAPA_COLOR[e]}30`, borderRadius:12, padding:'10px 12px', textAlign:'center' }}>
                    <div style={{ fontSize:18, marginBottom:4 }}>{ETAPA_ICON[e]}</div>
                    <div style={{ fontSize:20, fontWeight:900, color:ETAPA_COLOR[e] }}>{count}</div>
                    <div style={{ fontSize:10, color:S.text3 }}>{ETAPA_LABEL[e]}</div>
                  </div>
                );
              })}
            </div>

            {/* Filtro por mesa */}
            {mesasActivas.length > 0 && (
              <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
                <button onClick={() => setMesaFiltro(null)}
                  style={{ padding:'4px 12px', borderRadius:20, border:`1px solid ${mesaFiltro===null?S.blue:S.border}`, background:mesaFiltro===null?`${S.blue}15`:'transparent', color:mesaFiltro===null?S.blue:S.text3, fontSize:11, fontWeight:700, cursor:'pointer' }}>
                  Todas
                </button>
                {mesasActivas.map(m => (
                  <button key={m} onClick={() => setMesaFiltro(mesaFiltro===m?null:m)}
                    style={{ padding:'4px 12px', borderRadius:20, border:`1px solid ${mesaFiltro===m?S.gold:S.border}`, background:mesaFiltro===m?`${S.gold}15`:'transparent', color:mesaFiltro===m?S.goldL:S.text3, fontSize:11, fontWeight:700, cursor:'pointer' }}>
                    Mesa {m}
                  </button>
                ))}
              </div>
            )}

            {/* Estado vacío */}
            {platos.length === 0 && (
              <div style={{ background:S.bg2, border:`1px solid ${S.border}`, borderRadius:14, padding:40, textAlign:'center' }}>
                <div style={{ fontSize:48, marginBottom:16 }}>🍽️</div>
                <div style={{ fontSize:16, fontWeight:700, marginBottom:8 }}>Sin pedidos en curso</div>
                <div style={{ fontSize:13, color:S.text3 }}>
                  Los pedidos aparecen aquí automáticamente cuando el mesero presiona<br/>
                  <span style={{ color:S.gold, fontWeight:700 }}>🔥 Marchar</span> o <span style={{ color:S.blue, fontWeight:700 }}>+ Orden</span> en el POS
                </div>
              </div>
            )}

            {/* Timeline de platos */}
            {platos
              .filter(p => mesaFiltro === null || p.mesa === mesaFiltro)
              .sort((a, b) => {
                // Urgentes primero, luego por etapa (listo > cocina > pedido > entregado)
                if (a.urgente && !b.urgente) return -1;
                if (!a.urgente && b.urgente) return 1;
                const order = { listo:0, cocina:1, pedido:2, entregado:3 };
                return order[a.etapa] - order[b.etapa];
              })
              .map(plato => {
                const ec = ETAPA_COLOR[plato.etapa];
                const esUrgente = plato.urgente && plato.etapa !== 'entregado';
                const esListo = plato.etapa === 'listo';
                const puedeAvanzar = plato.etapa !== 'entregado';
                return (
                  <div key={plato.id} style={{
                    background: esListo ? `${S.green}08` : esUrgente ? `${S.red}08` : S.bg2,
                    border: `1px solid ${esListo ? S.green+'50' : esUrgente ? S.red+'40' : S.border}`,
                    borderRadius: 14, padding: 14,
                    animation: esListo ? 'none' : undefined,
                  }}>
                    <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:10 }}>
                      <span style={{ fontSize:28 }}>{plato.emoji}</span>
                      <div style={{ flex:1 }}>
                        <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:2 }}>
                          <span style={{ fontSize:14, fontWeight:700, color:S.text1 }}>{plato.plato}</span>
                          {esListo && <span style={{ fontSize:10, background:`${S.green}20`, color:S.green, padding:'1px 6px', borderRadius:10, fontWeight:700 }}>🔔 LISTO — SALE YA</span>}
                          {esUrgente && !esListo && <span style={{ fontSize:10, background:`${S.red}20`, color:S.red, padding:'1px 6px', borderRadius:10, fontWeight:700 }}>⚠️ DEMORA</span>}
                        </div>
                        <div style={{ fontSize:11, color:S.text3 }}>
                          Mesa {plato.mesa} · {plato.mesero}
                          {plato.termino && <span style={{ marginLeft:6, color:S.gold }}> · {plato.termino}</span>}
                          {' · '}{plato.minutos_transcurridos} min
                        </div>
                      </div>
                      <span style={{ background:`${ec}15`, color:ec, border:`1px solid ${ec}40`, padding:'3px 10px', borderRadius:20, fontSize:11, fontWeight:700, flexShrink:0 }}>
                        {ETAPA_ICON[plato.etapa]} {ETAPA_LABEL[plato.etapa]}
                      </span>
                    </div>

                    {/* Barra de progreso entre etapas */}
                    <div style={{ display:'flex', gap:4, marginBottom:10 }}>
                      {ETAPAS.map((e, i) => {
                        const eIdx = ETAPAS.indexOf(plato.etapa);
                        const done = i <= eIdx;
                        return (
                          <div key={e} style={{ flex:1 }}>
                            <div style={{ height:4, borderRadius:4, background: done ? ETAPA_COLOR[e] : S.bg3, transition:'background .3s' }}/>
                            <div style={{ fontSize:9, color: done ? ETAPA_COLOR[e] : S.text3, marginTop:3, textAlign:'center' }}>{ETAPA_ICON[e]}</div>
                          </div>
                        );
                      })}
                    </div>

                    {/* Horarios */}
                    <div style={{ display:'flex', gap:16, marginBottom: puedeAvanzar ? 10 : 0 }}>
                      {[
                        { label:'Pedido',    hora:plato.hora_pedido },
                        { label:'Cocina',    hora:plato.hora_cocina },
                        { label:'Listo',     hora:plato.hora_listo },
                        { label:'Entregado', hora:plato.hora_entregado },
                      ].filter(h => h.hora).map(h => (
                        <div key={h.label} style={{ fontSize:10 }}>
                          <span style={{ color:S.text3 }}>{h.label}: </span>
                          <span style={{ color:S.text2, fontWeight:600 }}>{h.hora}</span>
                        </div>
                      ))}
                    </div>

                    {puedeAvanzar && (
                      <button onClick={() => { avanzarEtapa(plato.id); showToast(`${plato.plato} → ${ETAPA_LABEL[ETAPAS[ETAPAS.indexOf(plato.etapa)+1]]}`); }}
                        style={{ width:'100%', padding:'9px', borderRadius:9, border:`1px solid ${ec}50`, background: esListo ? S.green : `${ec}15`, color: esListo ? '#fff' : ec, fontSize:12, fontWeight:700, cursor:'pointer', transition:'all .2s' }}>
                        {esListo ? `🍽️ Marcar entregado → Mesa ${plato.mesa}` : `Avanzar → ${ETAPA_LABEL[ETAPAS[ETAPAS.indexOf(plato.etapa)+1]]}`}
                      </button>
                    )}
                  </div>
                );
              })}

            {/* Entregados recientes (colapsados) */}
            {platos.filter(p=>p.etapa==='entregado').length > 0 && (
              <div style={{ background:S.bg2, border:`1px solid ${S.border}`, borderRadius:12, padding:'10px 14px' }}>
                <div style={{ fontSize:11, color:S.text3, fontWeight:700 }}>
                  ✓ {platos.filter(p=>p.etapa==='entregado').length} platos entregados en este servicio
                </div>
              </div>
            )}
          </>
        )}

        {/* ── CHAT FLOW ── */}
        {tab === 'chat' && (
          <>
            <div style={{ background:S.bg2, border:`1px solid ${S.border}`, borderRadius:14, padding:14 }}>
              <div style={{ fontSize:11, color:S.text3, marginBottom:8, fontWeight:700, textTransform:'uppercase' as const }}>Enviar mensaje</div>
              <div style={{ display:'flex', gap:6, marginBottom:8 }}>
                {(['mesero','cocina','caja','maitre'] as const).map(r => (
                  <button key={r} onClick={() => setRolEmisor(r)}
                    style={{ padding:'5px 12px', borderRadius:20, border:`1px solid ${rolEmisor===r?ROLES_COLOR[r]+'60':S.border}`, background:rolEmisor===r?ROLES_COLOR[r]+'15':'transparent', color:rolEmisor===r?ROLES_COLOR[r]:S.text3, fontSize:11, fontWeight:700, cursor:'pointer', transition:'all .2s', textTransform:'capitalize' as const }}>
                    {r}
                  </button>
                ))}
              </div>
              <div style={{ display:'flex', gap:8 }}>
                <input style={inp} placeholder="Mensaje al equipo..." value={nuevoMsg} onChange={e => setNuevoMsg(e.target.value)}
                  onKeyDown={e => e.key==='Enter' && enviarMensaje()} />
                <button onClick={enviarMensaje} style={{ background:S.blue, color:'#fff', border:'none', padding:'9px 18px', borderRadius:10, fontSize:12, fontWeight:700, cursor:'pointer' }}>Enviar</button>
              </div>
            </div>

            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
              <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
                <button onClick={() => { setMesaFiltro(null); marcarLeidos(); }}
                  style={{ padding:'4px 12px', borderRadius:20, border:`1px solid ${mesaFiltro===null?S.blue:S.border}`, background:mesaFiltro===null?`${S.blue}15`:'transparent', color:mesaFiltro===null?S.blue:S.text3, fontSize:11, fontWeight:700, cursor:'pointer' }}>
                  Todos
                </button>
                {mesasActivas.map(m => (
                  <button key={m} onClick={() => setMesaFiltro(mesaFiltro===m?null:m)}
                    style={{ padding:'4px 12px', borderRadius:20, border:`1px solid ${mesaFiltro===m?S.gold:S.border}`, background:mesaFiltro===m?`${S.gold}15`:'transparent', color:mesaFiltro===m?S.goldL:S.text3, fontSize:11, fontWeight:700, cursor:'pointer' }}>
                    Mesa {m}
                  </button>
                ))}
              </div>
              <span style={{ fontSize:10, color:S.text3 }}>{mensajes.length} mensajes</span>
            </div>

            <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
              {mensajes
                .filter(m => mesaFiltro===null || m.mesa===mesaFiltro)
                .map(msg => {
                  const rc = ROLES_COLOR[msg.rol];
                  return (
                    <div key={msg.id} style={{ background:msg.leido?S.bg2:`${rc}08`, border:`1px solid ${msg.leido?S.border:rc+'30'}`, borderRadius:12, padding:'10px 14px', borderLeft:`3px solid ${rc}` }}>
                      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:4 }}>
                        <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                          <span style={{ fontSize:12, fontWeight:700, color:rc, textTransform:'capitalize' as const }}>{msg.from}</span>
                          {msg.mesa && <span style={{ fontSize:10, background:`${S.gold}20`, color:S.goldL, padding:'1px 6px', borderRadius:10, fontWeight:700 }}>Mesa {msg.mesa}</span>}
                          {msg.urgente && <span style={{ fontSize:10, background:`${S.red}20`, color:S.red, padding:'1px 6px', borderRadius:10, fontWeight:700 }}>⚠️ URGENTE</span>}
                          {!msg.leido && <div style={{ width:7, height:7, borderRadius:'50%', background:S.blue }}/>}
                        </div>
                        <span style={{ fontSize:10, color:S.text3 }}>{msg.hora}</span>
                      </div>
                      <div style={{ fontSize:13, color:S.text1, lineHeight:1.5 }}>{msg.texto}</div>
                    </div>
                  );
                })}
            </div>
          </>
        )}

        {/* ── CARE LIVE ── */}
        {tab === 'care' && (
          <>
            <div style={{ padding:14, background:`${S.purple}10`, border:`1px solid ${S.purple}30`, borderRadius:12, fontSize:12, color:S.purple }}>
              🛟 <strong>Care Live activo</strong> — {alertasActivas > 0 ? `${alertasActivas} alertas pendientes` : 'Sin alertas activas · Todo bajo control'}
            </div>
            {alertas
              .sort((a,b) => {
                if (a.atendida && !b.atendida) return 1;
                if (!a.atendida && b.atendida) return -1;
                const p = { alta:0, media:1, baja:2 };
                return p[a.prioridad]-p[b.prioridad];
              })
              .map(alerta => {
                const colores = { alta:S.red, media:S.gold, baja:S.green };
                const iconos  = { demora:'⏱️', solicitud:'📋', queja:'😟', felicitacion:'🌟', vip:'⭐' };
                const c = colores[alerta.prioridad];
                return (
                  <div key={alerta.id} style={{ background:alerta.atendida?S.bg2:`${c}08`, border:`1px solid ${alerta.atendida?S.border:c+'40'}`, borderRadius:14, padding:16, opacity:alerta.atendida?0.6:1 }}>
                    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:8 }}>
                      <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                        <span style={{ fontSize:20 }}>{iconos[alerta.tipo]}</span>
                        <div>
                          <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                            <span style={{ fontSize:13, fontWeight:700, color:S.text1 }}>Mesa {alerta.mesa}</span>
                            <span style={{ fontSize:10, background:`${c}20`, color:c, padding:'2px 8px', borderRadius:20, fontWeight:700, textTransform:'capitalize' as const }}>{alerta.prioridad}</span>
                            {alerta.atendida && <span style={{ fontSize:10, background:`${S.green}20`, color:S.green, padding:'2px 8px', borderRadius:20, fontWeight:700 }}>✓ Atendida</span>}
                          </div>
                          <div style={{ fontSize:10, color:S.text3, marginTop:2 }}>{alerta.hora}</div>
                        </div>
                      </div>
                    </div>
                    <div style={{ fontSize:13, color:S.text2, lineHeight:1.55, marginBottom:alerta.atendida?0:12 }}>{alerta.mensaje}</div>
                    {!alerta.atendida && (
                      <div style={{ display:'flex', gap:8 }}>
                        <button onClick={() => atenderAlerta(alerta.id)}
                          style={{ flex:2, padding:'8px', borderRadius:9, border:'none', background:S.green, color:'#fff', fontSize:12, fontWeight:700, cursor:'pointer' }}>
                          ✓ Marcar atendida
                        </button>
                        <button onClick={() => showToast('Notificación enviada al gerente')}
                          style={{ flex:1, padding:'8px', borderRadius:9, border:`1px solid ${S.purple}40`, background:`${S.purple}15`, color:S.purple, fontSize:12, fontWeight:700, cursor:'pointer' }}>
                          🔔 Escalar
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
          </>
        )}

      </div>
    </div>
  );
}
