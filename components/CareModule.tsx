import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase.ts';
import { Brain, Users, Star, MessageSquare, RefreshCw, X, Send, ChevronDown, ChevronUp } from 'lucide-react';

// ── TIPOS ─────────────────────────────────────────────────────────────
type Tab = 'live' | 'encuestas' | 'cim' | 'ohyeah' | 'dashboard';

interface Encuesta {
  id: number; cliente: string; mesa: string; fecha: string;
  estrellas: number; categorias: string[]; comentario: string;
  estado: 'pendiente' | 'respondida' | 'resuelta'; mesero?: string;
  restaurante?: string;
}

interface Alerta {
  id: number; tipo: string; mensaje: string; mesa: string;
  urgente: boolean; leida: boolean; created_at: string;
}

interface OhYeahCliente {
  id: string; nombre: string; email: string; telefono: string | null;
  ciudad: string | null; nivel: string; visitas: number;
  last_login: string | null; registro_at: string;
  notas: string | null; restricciones: string | null; preferencias: string | null;
  total_reservas: number; ultima_reserva: string | null;
  dias_sin_visitar: number | null;
}

// ── HELPERS ───────────────────────────────────────────────────────────
const starC = (n: number) => n >= 4 ? '#00E676' : n === 3 ? '#FFB547' : '#FF5252';
const fmtDate = (s: string) => new Date(s).toLocaleDateString('es-CO', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

const IA_RESPONSES: Record<number, string> = {
  5: 'Estimado/a [nombre], ¡muchas gracias por su calificación perfecta! Es un honor para nosotros.',
  4: 'Estimado/a [nombre], gracias por su visita y su valoración positiva.',
  3: 'Estimado/a [nombre], agradecemos su retroalimentación y trabajaremos en mejorar su experiencia.',
  2: 'Estimado/a [nombre], lamentamos no haber cumplido sus expectativas. Nos comunicaremos pronto.',
  1: 'Estimado/a [nombre], pedimos disculpas por la experiencia. Un gerente se contactará en breve.',
};

const NIVEL_COLORS: Record<string, string> = {
  INICIADO: '#a0a0a0', REGULAR: '#448AFF', VIP: '#B388FF', CONSAGRADO: '#FF6B00', ÉLITE: '#FFD700',
};
const NIVEL_EMOJI: Record<string, string> = {
  INICIADO: '⭐', REGULAR: '🌟', VIP: '💎', CONSAGRADO: '🔥', ÉLITE: '👑',
};

// ── COMPONENTE PANEL ALERTA ───────────────────────────────────────────
function PanelAlerta({ alerta, onClose, onResolve }: { alerta: Alerta; onClose: () => void; onResolve: () => void }) {
  return (
    <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-[#1c1c1c] border border-[#2a2a2a] rounded-2xl p-6 max-w-md w-full" onClick={e => e.stopPropagation()}>
        <div className="flex items-start gap-3 mb-4">
          <span className="text-2xl">{alerta.urgente ? '🚨' : '⚠️'}</span>
          <div className="flex-1">
            <div className="font-bold text-[15px] text-white mb-1">{alerta.tipo}</div>
            <div className="text-[12px] text-[#a0a0a0]">{alerta.mesa} · {fmtDate(alerta.created_at)}</div>
          </div>
          <button onClick={onClose} className="text-[#606060] hover:text-white"><X size={16} /></button>
        </div>
        <div className="bg-[#141414] rounded-xl p-3 text-[13px] text-white mb-4">{alerta.mensaje}</div>
        <div className="flex gap-3">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-lg border border-[#2a2a2a] text-[#606060] text-[12px]">Cerrar</button>
          <button onClick={onResolve} className="flex-2 py-2.5 px-4 rounded-lg bg-[#00E676] text-black font-bold text-[12px]">✓ Resolver</button>
        </div>
      </div>
    </div>
  );
}

// ── COMPONENTE PANEL RESPUESTA ────────────────────────────────────────
function PanelRespuesta({ enc, onClose, onSend }: { enc: Encuesta; onClose: () => void; onSend: () => void }) {
  const nombre = enc.cliente.split(' ')[0];
  const [texto, setTexto] = useState(IA_RESPONSES[enc.estrellas]?.replace('[nombre]', nombre) || '');
  const c = starC(enc.estrellas);
  return (
    <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-[#1c1c1c] border border-[#2a2a2a] rounded-2xl p-6 max-w-lg w-full" onClick={e => e.stopPropagation()}>
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-full flex items-center justify-center font-black text-[16px]"
            style={{ background: `${c}20`, color: c }}>
            {enc.cliente.charAt(0)}
          </div>
          <div className="flex-1">
            <div className="font-bold text-white">{enc.cliente}</div>
            <div className="flex gap-1">{Array.from({ length: 5 }, (_, i) => (
              <span key={i} style={{ color: i < enc.estrellas ? c : '#333' }}>★</span>
            ))}</div>
          </div>
          <button onClick={onClose} className="text-[#606060] hover:text-white"><X size={16} /></button>
        </div>
        {enc.comentario && (
          <div className="bg-[#141414] rounded-xl p-3 text-[12px] text-[#a0a0a0] mb-4 italic">"{enc.comentario}"</div>
        )}
        <div className="text-[10px] text-[#606060] font-bold uppercase mb-2">✦ Respuesta IA sugerida</div>
        <textarea value={texto} onChange={e => setTexto(e.target.value)} rows={5}
          className="w-full bg-[#141414] border border-[#2a2a2a] rounded-xl p-3 text-[13px] text-white outline-none resize-none mb-4" />
        <div className="flex gap-3">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-lg border border-[#2a2a2a] text-[#606060] text-[12px]">Cancelar</button>
          <button onClick={onSend} className="flex-2 py-2.5 px-4 rounded-lg bg-gradient-to-r from-purple-600 to-blue-600 text-white font-bold text-[12px] flex items-center gap-2">
            <Send size={13} /> Enviar respuesta
          </button>
        </div>
      </div>
    </div>
  );
}

// ── COMPONENTE PRINCIPAL ──────────────────────────────────────────────
export default function CareModule() {
  const [activeTab, setActiveTab] = useState<Tab>('live');
  const [encuestas, setEncuestas] = useState<Encuesta[]>([]);
  const [alertas,   setAlertas]   = useState<Alerta[]>([]);
  const [loading,   setLoading]   = useState(false);
  const [alertaSel, setAlertaSel] = useState<Alerta | null>(null);
  const [encSel,    setEncSel]    = useState<Encuesta | null>(null);
  // Oh Yeah
  const [ohyeahClientes, setOhyeahClientes] = useState<OhYeahCliente[]>([]);
  const [ohyeahLoading,  setOhyeahLoading]  = useState(false);
  const [busquedaOY,     setBusquedaOY]     = useState('');
  const [filtroNivel,    setFiltroNivel]     = useState('todos');

  // ── Fetch encuestas y alertas ──────────────────────────────────────
  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const { data: enc } = await supabase.from('xcare_encuestas').select('*')
        .eq('restaurante_id', 6).order('created_at', { ascending: false }).limit(50);
      if (enc && enc.length > 0) {
        setEncuestas(enc.map((e: any) => ({
          id: e.id, cliente: e.cliente_nombre || 'Cliente',
          mesa: e.mesa_num ? `Mesa ${e.mesa_num}` : '—',
          fecha: e.created_at, estrellas: e.estrellas || 5,
          categorias: e.categorias || [], comentario: e.comentario || '',
          estado: e.estado || 'pendiente', mesero: e.mesero_nombre,
          restaurante: e.restaurante_nombre,
        })));
      }
      const { data: alt } = await supabase.from('nexum_notificaciones').select('*')
        .eq('restaurante_id', 6).eq('leida', false).order('created_at', { ascending: false }).limit(20);
      if (alt) {
        setAlertas(alt.map((a: any) => ({
          id: a.id, tipo: a.titulo || a.tipo, mensaje: a.mensaje,
          mesa: a.mesa_num ? `Mesa ${a.mesa_num}` : '—',
          urgente: a.urgente || false, leida: a.leida, created_at: a.created_at,
        })));
      }
    } catch (e) { /* silencioso */ }
    setLoading(false);
  }, []);

  // ── Fetch clientes Oh Yeah ─────────────────────────────────────────
  const fetchOhYeahClientes = useCallback(async () => {
    setOhyeahLoading(true);
    const { data } = await supabase.from('nexum_clientes_ohyeah').select('*');
    if (data) setOhyeahClientes(data as OhYeahCliente[]);
    setOhyeahLoading(false);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  useEffect(() => {
    fetchOhYeahClientes();
    const ch = supabase.channel('ohyeah-clientes')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'ohyeah_clientes' },
        (payload) => { setOhyeahClientes(prev => [payload.new as OhYeahCliente, ...prev]); })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'ohyeah_clientes' },
        () => { fetchOhYeahClientes(); })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [fetchOhYeahClientes]);

  useEffect(() => {
    const ch = supabase.channel('care-live')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'xcare_encuestas' }, () => fetchData())
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'nexum_notificaciones' }, () => fetchData())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [fetchData]);

  // ── Acciones ───────────────────────────────────────────────────────
  const resolverAlerta = async () => {
    if (!alertaSel) return;
    await supabase.from('nexum_notificaciones').update({ leida: true }).eq('id', alertaSel.id);
    setAlertas(prev => prev.filter(a => a.id !== alertaSel.id));
    setAlertaSel(null);
  };

  const enviarRespuesta = async () => {
    if (!encSel) return;
    await supabase.from('xcare_encuestas').update({ estado: 'respondida' }).eq('id', encSel.id);
    setEncuestas(prev => prev.map(e => e.id === encSel.id ? { ...e, estado: 'respondida' as const } : e));
    setEncSel(null);
  };

  const pendientes  = alertas.filter(a => !a.leida);
  const urgentes    = alertas.filter(a => a.urgente && !a.leida);
  const hoy         = new Date().toISOString().split('T')[0];

  // ── RENDER ─────────────────────────────────────────────────────────
  return (
    <div className="h-full flex flex-col bg-[#08080f] text-white font-['DM_Sans'] overflow-hidden">
      {/* Panels */}
      {alertaSel && <PanelAlerta alerta={alertaSel} onClose={() => setAlertaSel(null)} onResolve={resolverAlerta} />}
      {encSel    && <PanelRespuesta enc={encSel} onClose={() => setEncSel(null)} onSend={enviarRespuesta} />}

      {/* Header */}
      <div className="px-6 py-4 border-b border-white/7 bg-[#0f0f1a] flex items-center gap-4 flex-wrap shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-[13px] bg-gradient-to-br from-pink-600 to-purple-700 flex items-center justify-center text-xl">❤️</div>
          <div>
            <div className="font-['Syne'] text-[16px] font-black">X-CARE <span className="text-pink-400">360°</span></div>
            <div className="text-[9px] text-[#50506A] uppercase tracking-widest">Encuestas · Alertas · Clientes Oh Yeah</div>
          </div>
        </div>
        <div className="flex gap-3 ml-auto flex-wrap">
          {[
            { l: 'Alertas', v: pendientes.length,  c: urgentes.length > 0 ? '#FF5252' : '#FFB547' },
            { l: 'Urgentes', v: urgentes.length,   c: '#FF5252' },
            { l: 'Encuestas', v: encuestas.length, c: '#448AFF' },
            { l: 'Clientes', v: ohyeahClientes.length, c: '#FFD700' },
          ].map(k => (
            <div key={k.l} className="text-center px-3 py-1.5 rounded-xl border" style={{ borderColor: `${k.c}20` }}>
              <div className="text-[8px] text-[#50506A] uppercase">{k.l}</div>
              <div className="font-['Syne'] text-[18px] font-black" style={{ color: k.c }}>{k.v}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-white/7 bg-[#0f0f1a] px-6 shrink-0 overflow-x-auto">
        {([
          { id: 'live',      l: '🔴 Alertas en vivo' },
          { id: 'encuestas', l: '⭐ Encuestas' },
          { id: 'cim',       l: '🧠 CIM' },
          { id: 'ohyeah',    l: '🦉 Oh Yeah!' },
          { id: 'dashboard', l: '📊 Dashboard' },
        ] as { id: Tab; l: string }[]).map(t => (
          <button key={t.id} onClick={() => setActiveTab(t.id)}
            className="py-3 px-4 text-[11px] font-bold whitespace-nowrap transition-all border-b-2"
            style={{
              borderColor: activeTab === t.id ? '#FFB547' : 'transparent',
              color: activeTab === t.id ? '#FFB547' : '#50506A',
              background: 'none', cursor: 'pointer',
            }}>
            {t.l}
          </button>
        ))}
      </div>

      {/* ── ALERTAS EN VIVO ── */}
      {activeTab === 'live' && (
        <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3">
          {loading && <div className="text-center py-10 text-[#50506A]">Cargando...</div>}
          {!loading && pendientes.length === 0 && (
            <div className="text-center py-16 text-[#50506A]">
              <div className="text-[48px] mb-3">✅</div>
              <div className="text-[14px] font-bold">Sin alertas pendientes</div>
              <div className="text-[12px] mt-1">El sistema está funcionando bien</div>
            </div>
          )}
          {pendientes.map(a => (
            <div key={a.id} onClick={() => setAlertaSel(a)}
              className="bg-[#0f0f1a] border rounded-xl p-4 cursor-pointer hover:border-white/20 transition-all"
              style={{ borderColor: a.urgente ? 'rgba(255,82,82,0.4)' : 'rgba(255,181,71,0.25)' }}>
              <div className="flex items-start gap-3">
                <span className="text-[20px]">{a.urgente ? '🚨' : '⚠️'}</span>
                <div className="flex-1">
                  <div className="font-bold text-[13px] text-white mb-1">{a.tipo}</div>
                  <div className="text-[11px] text-[#a0a0a0] mb-2">{a.mensaje}</div>
                  <div className="flex gap-3 text-[10px] text-[#606060]">
                    <span>{a.mesa}</span>
                    <span>{fmtDate(a.created_at)}</span>
                    {a.urgente && <span className="text-[#FF5252] font-bold">URGENTE</span>}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── ENCUESTAS ── */}
      {activeTab === 'encuestas' && (
        <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3">
          <div className="flex items-center justify-between mb-1">
            <div className="font-['Syne'] text-[15px] font-black">Encuestas X-Care</div>
            <button onClick={fetchData} className="text-[#50506A] hover:text-white flex items-center gap-1 text-[11px]">
              <RefreshCw size={12} /> Actualizar
            </button>
          </div>
          {loading && <div className="text-center py-10 text-[#50506A]">Cargando...</div>}
          {!loading && encuestas.length === 0 && (
            <div className="text-center py-16 text-[#50506A]">
              <div className="text-[48px] mb-3">⭐</div>
              <div className="text-[14px] font-bold">Sin encuestas aún</div>
              <div className="text-[12px] mt-1">Aparecen aquí cuando los clientes califican su experiencia</div>
            </div>
          )}
          {encuestas.map(enc => {
            const c = starC(enc.estrellas);
            return (
              <div key={enc.id} className="bg-[#0f0f1a] border border-white/7 rounded-xl p-4 hover:border-white/15 transition-all">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-full flex items-center justify-center font-black text-[16px] shrink-0"
                    style={{ background: `${c}20`, color: c }}>
                    {enc.cliente.charAt(0)}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-bold text-[13px]">{enc.cliente}</span>
                      <span className="text-[10px] text-[#606060]">{enc.mesa}</span>
                    </div>
                    <div className="flex gap-0.5 mb-2">
                      {Array.from({ length: 5 }, (_, i) => (
                        <span key={i} style={{ color: i < enc.estrellas ? c : '#333', fontSize: 14 }}>★</span>
                      ))}
                    </div>
                    {enc.comentario && (
                      <div className="text-[11px] text-[#a0a0a0] italic mb-2">"{enc.comentario}"</div>
                    )}
                    <div className="flex gap-2 flex-wrap">
                      {enc.categorias.map((cat, i) => (
                        <span key={i} className="text-[9px] px-2 py-0.5 rounded-full bg-white/5 text-[#a0a0a0]">{cat}</span>
                      ))}
                    </div>
                  </div>
                  <div className="flex flex-col gap-2 shrink-0">
                    <span className="text-[9px] px-2 py-1 rounded-full font-bold"
                      style={{ background: enc.estado === 'respondida' ? 'rgba(0,230,118,0.1)' : 'rgba(255,181,71,0.1)', color: enc.estado === 'respondida' ? '#00E676' : '#FFB547' }}>
                      {enc.estado}
                    </span>
                    {enc.estado === 'pendiente' && (
                      <button onClick={() => setEncSel(enc)}
                        className="text-[9px] px-2 py-1 rounded-full border border-purple-500/40 text-purple-400 font-bold flex items-center gap-1">
                        <Send size={9} /> Responder
                      </button>
                    )}
                  </div>
                </div>
                <div className="mt-2 text-[9px] text-[#606060]">{fmtDate(enc.fecha)}</div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── CIM ── */}
      {activeTab === 'cim' && (
        <div className="flex-1 overflow-y-auto p-6 flex flex-col items-center justify-center text-[#50506A]">
          <div className="text-[48px] mb-4">🧠</div>
          <div className="font-['Syne'] text-[16px] font-black text-white mb-2">Customer Intelligence Module</div>
          <div className="text-[12px] text-center max-w-xs">
            Integra con Oh Yeah! para ver el perfil completo de cada cliente — historial, preferencias y nivel Gourmand.
          </div>
        </div>
      )}

      {/* ── OH YEAH! CLIENTES ── */}
      {activeTab === 'ohyeah' && (
        <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4">
          {/* Stats */}
          <div className="grid grid-cols-4 gap-3">
            {[
              { l: 'Total', v: ohyeahClientes.length, c: '#FFB547' },
              { l: 'CONSAGRADO', v: ohyeahClientes.filter(c => c.nivel === 'CONSAGRADO').length, c: '#FF6B00' },
              { l: 'ÉLITE', v: ohyeahClientes.filter(c => c.nivel === 'ÉLITE').length, c: '#FFD700' },
              { l: 'VIP',   v: ohyeahClientes.filter(c => c.nivel === 'VIP').length,   c: '#B388FF' },
              { l: 'Nuevos hoy', v: ohyeahClientes.filter(c => c.registro_at?.startsWith(hoy)).length, c: '#00E676' },
            ].map(k => (
              <div key={k.l} className="bg-[#0f0f1a] border rounded-xl p-3 text-center" style={{ borderColor: `${k.c}20` }}>
                <div className="text-[9px] text-[#50506A] uppercase mb-1">{k.l}</div>
                <div className="font-['Syne'] text-[22px] font-black" style={{ color: k.c }}>{k.v}</div>
              </div>
            ))}
          </div>

          {/* Búsqueda y filtros */}
          <div className="flex gap-3 flex-wrap items-center">
            <div className="flex-1 flex items-center gap-2 bg-[#0f0f1a] border border-white/10 rounded-lg px-3 py-2">
              <span className="text-[12px] text-[#50506A]">🔍</span>
              <input value={busquedaOY} onChange={e => setBusquedaOY(e.target.value)}
                placeholder="Buscar nombre, email o ciudad..."
                className="flex-1 bg-transparent text-[12px] text-white outline-none placeholder-[#50506A]" />
              {busquedaOY && <button onClick={() => setBusquedaOY('')} className="text-[#50506A] text-[11px]">✕</button>}
            </div>
            <div className="flex gap-2 flex-wrap">
              {['todos', 'INICIADO', 'REGULAR', 'VIP', 'CONSAGRADO', 'ÉLITE'].map(n => (
                <button key={n} onClick={() => setFiltroNivel(n)}
                  className="px-3 py-1.5 rounded-full text-[10px] font-bold transition-all"
                  style={{
                    border: `1px solid ${filtroNivel === n ? (NIVEL_COLORS[n] || '#606060') : 'rgba(255,255,255,0.1)'}`,
                    background: filtroNivel === n ? `${NIVEL_COLORS[n] || '#606060'}15` : 'transparent',
                    color: filtroNivel === n ? (NIVEL_COLORS[n] || '#606060') : '#606060',
                    cursor: 'pointer',
                  }}>
                  {n === 'todos' ? 'Todos' : n}
                </button>
              ))}
            </div>
            <button onClick={fetchOhYeahClientes} className="text-[11px] text-[#50506A] hover:text-white flex items-center gap-1">
              <RefreshCw size={12} /> Actualizar
            </button>
          </div>

          {/* Lista */}
          {ohyeahLoading ? (
            <div className="text-center py-10 text-[#50506A]">Cargando clientes...</div>
          ) : (
            <div className="flex flex-col gap-3">
              {ohyeahClientes
                .filter(cl => {
                  const busq = busquedaOY.toLowerCase();
                  const matchB = !busq || cl.nombre?.toLowerCase().includes(busq) || cl.email?.toLowerCase().includes(busq) || cl.ciudad?.toLowerCase().includes(busq);
                  const matchN = filtroNivel === 'todos' || cl.nivel === filtroNivel;
                  return matchB && matchN;
                })
                .map(cl => {
                  const nc = NIVEL_COLORS[cl.nivel] || '#606060';
                  return (
                    <div key={cl.id} className="bg-[#0f0f1a] border border-white/7 rounded-xl p-4 hover:border-white/15 transition-all">
                      <div className="flex items-start gap-3">
                        <div className="w-10 h-10 rounded-full flex items-center justify-center font-black text-[16px] shrink-0"
                          style={{ background: `${nc}20`, border: `2px solid ${nc}40`, color: nc }}>
                          {cl.nombre?.charAt(0).toUpperCase()}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1 flex-wrap">
                            <span className="font-bold text-[13px] text-white">{cl.nombre}</span>
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                              style={{ background: `${nc}15`, color: nc, border: `1px solid ${nc}30` }}>
                              {NIVEL_EMOJI[cl.nivel]} {cl.nivel}
                            </span>
                            {cl.dias_sin_visitar !== null && cl.dias_sin_visitar > 30 && (
                              <span className="text-[9px] px-2 py-0.5 rounded-full font-bold bg-red-500/15 text-red-400 border border-red-500/30">
                                ⚠️ {cl.dias_sin_visitar}d sin visitar
                              </span>
                            )}
                          </div>
                          <div className="flex gap-4 flex-wrap">
                            {cl.email    && <span className="text-[10px] text-[#50506A]">✉️ {cl.email}</span>}
                            {cl.telefono && <span className="text-[10px] text-[#50506A]">📱 {cl.telefono}</span>}
                            {cl.ciudad   && <span className="text-[10px] text-[#50506A]">📍 {cl.ciudad}</span>}
                          </div>
                          {cl.restricciones && (
                            <div className="mt-1 text-[10px] text-orange-400">⚠️ {cl.restricciones}</div>
                          )}
                        </div>
                        <div className="flex gap-3 shrink-0">
                          {[
                            { l: 'Visitas',  v: cl.visitas || 0,        c: '#FFB547' },
                            { l: 'Reservas', v: cl.total_reservas || 0, c: '#448AFF' },
                          ].map(m => (
                            <div key={m.l} className="text-center">
                              <div className="font-['Syne'] text-[16px] font-black" style={{ color: m.c }}>{m.v}</div>
                              <div className="text-[8px] text-[#50506A]">{m.l}</div>
                            </div>
                          ))}
                        </div>
                      </div>
                      {cl.ultima_reserva && (
                        <div className="mt-2 pt-2 border-t border-white/5 text-[10px] text-[#50506A]">
                          Última reserva: {new Date(cl.ultima_reserva).toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: 'numeric' })}
                        </div>
                      )}
                    </div>
                  );
                })}
              {ohyeahClientes.filter(cl => {
                const busq = busquedaOY.toLowerCase();
                return (!busq || cl.nombre?.toLowerCase().includes(busq) || cl.email?.toLowerCase().includes(busq)) && (filtroNivel === 'todos' || cl.nivel === filtroNivel);
              }).length === 0 && (
                <div className="text-center py-10 text-[#50506A]">
                  <div className="text-[40px] mb-2">🦉</div>
                  <div>Sin clientes que coincidan</div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── DASHBOARD ── */}
      {activeTab === 'dashboard' && (
        <div className="flex-1 overflow-y-auto p-6">
          <div className="font-['Syne'] text-[15px] font-black mb-4">📊 Dashboard de satisfacción</div>
          <div className="grid grid-cols-2 gap-4 mb-6">
            {[
              { l: 'Promedio estrellas', v: encuestas.length ? (encuestas.reduce((s, e) => s + e.estrellas, 0) / encuestas.length).toFixed(1) : '—', c: '#FFB547', e: '⭐' },
              { l: 'Respondidas',        v: encuestas.filter(e => e.estado === 'respondida').length, c: '#00E676', e: '✅' },
              { l: 'Pendientes',         v: encuestas.filter(e => e.estado === 'pendiente').length,  c: '#FF5252', e: '⏳' },
              { l: 'Total encuestas',    v: encuestas.length, c: '#448AFF', e: '📊' },
            ].map(k => (
              <div key={k.l} className="bg-[#0f0f1a] border rounded-xl p-4" style={{ borderColor: `${k.c}20` }}>
                <div className="text-[20px] mb-2">{k.e}</div>
                <div className="text-[9px] text-[#50506A] uppercase mb-1">{k.l}</div>
                <div className="font-['Syne'] text-[28px] font-black" style={{ color: k.c }}>{k.v}</div>
              </div>
            ))}
          </div>
          {encuestas.length === 0 && (
            <div className="text-center py-10 text-[#50506A]">Sin datos suficientes aún</div>
          )}
        </div>
      )}
    </div>
  );
}
