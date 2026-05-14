import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase.ts';
import { RefreshCw, X, Send, Star } from 'lucide-react';

// ── CONSTANTES ENCUESTA ───────────────────────────────────────────────
const TAGS_5 = ['🍽 Comida','🍸 Cócteles','🤵 Servicio','👨‍🍳 Chef','🎶 Ambiente','🕯 Experiencia completa'];
const TAGS_4 = ['⏱ Tiempo','🌡 Temperatura','🍽 Sabor','🍸 Balance','🤵 Atención','🎶 Ambiente'];
const MICRO_TAGS_COMIDA = ['🌡 Frío','⏱ Demora','🧂 Sabor','🍽 Presentación','📏 Porción','💬 Otro'];
const MICRO_TAGS_COCTEL  = ['🍸 Muy dulce','🍸 Muy fuerte','🌡 Temperatura','⏱ Demora','💬 Otro'];

const NIVEL_COLORS: Record<string,string> = { INICIADO:'#a0a0a0',REGULAR:'#448AFF',VIP:'#B388FF',CONSAGRADO:'#FF6B00',ÉLITE:'#FFD700' };
const NIVEL_EMOJI:  Record<string,string>  = { INICIADO:'⭐',REGULAR:'🌟',VIP:'💎',CONSAGRADO:'🔥',ÉLITE:'👑' };

const starC = (n:number) => n>=4?'#00E676':n===3?'#FFB547':'#FF5252';
const fmtDate = (s:string) => new Date(s).toLocaleDateString('es-CO',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'});

const IA_RESPONSES: Record<number,string> = {
  5: 'Hola [nombre], nos alegra saber que tu experiencia fue increíble. Es exactamente lo que buscamos crear cada día. Tu visita inspira a nuestro equipo.',
  4: 'Hola [nombre], gracias por tu visita. Hemos tomado nota de lo que faltó para que fuera perfecta y ya estamos trabajando en ello.',
  3: 'Hola [nombre], gracias por confiar en nosotros. Hemos revisado tu experiencia y ajustaremos los detalles que mencionaste. Tu próxima visita tendrá atención especial.',
  2: 'Hola [nombre], tu experiencia es importante para nosotros. Ya estamos trabajando para que lo ocurrido no vuelva a suceder. Será un honor recibirte nuevamente.',
  1: 'Hola [nombre], lo que nos compartiste merece toda nuestra atención. Ya tomamos acciones concretas. Nos gustaría recibirte para ofrecerte una experiencia completamente distinta.',
};

// ── MODAL ENCUESTA X-CARE™ ────────────────────────────────────────────
function EncuestaXCare({
  mesaNum, meseroNombre, itemsConsumidos, totalCuenta, propinaPct, propinaMonto,
  clienteNombre, clienteEmail, clienteTelefono, facturaId,
  onClose, onGuardar
}: {
  mesaNum: number|null; meseroNombre: string|null; itemsConsumidos: any[];
  totalCuenta: number; propinaPct: number; propinaMonto: number;
  clienteNombre: string; clienteEmail: string; clienteTelefono: string;
  facturaId: string; onClose: ()=>void; onGuardar: (data:any)=>void;
}) {
  const [paso, setPaso] = useState<'estrellas'|'tags'|'platos'|'microtags'|'comentario'|'gracias'>('estrellas');
  const [estrellas, setEstrellas] = useState(0);
  const [tagsSeleccionados, setTagsSel] = useState<string[]>([]);
  const [platosSeleccionados, setPlatosSel] = useState<string[]>([]);
  const [microTagsSel, setMicroTagsSel] = useState<string[]>([]);
  const [comentario, setComentario] = useState('');
  const [tipoProblem, setTipoProblem] = useState<'comida'|'coctel'|null>(null);

  // Separar platos y cócteles del consumo
  const platos  = itemsConsumidos.filter(i=>!['bar','cava'].includes(i.estacion||''));
  const cocteles = itemsConsumidos.filter(i=>['bar','cava'].includes(i.estacion||''));

  const handleEstrellas = (n:number) => {
    setEstrellas(n);
    setTimeout(()=>setPaso('tags'), 300);
  };

  const handleTags = () => {
    if (estrellas <= 3) {
      // Determinar si hay cócteles o platos para la siguiente pantalla
      if (cocteles.length > 0 && tagsSeleccionados.some(t=>t.includes('Cóctel')||t.includes('🍸'))) {
        setTipoProblem('coctel');
      } else {
        setTipoProblem('comida');
      }
      setPaso('platos');
    } else {
      setPaso('comentario');
    }
  };

  const handleGuardar = async () => {
    const data = {
      restaurante_id: 6,
      mesa_num: mesaNum,
      mesero_nombre: meseroNombre,
      factura_id: facturaId,
      cliente_nombre: clienteNombre || null,
      cliente_email: clienteEmail || null,
      cliente_telefono: clienteTelefono || null,
      estrellas,
      tags_positivos: estrellas >= 4 ? tagsSeleccionados : null,
      tags_negativos: estrellas < 4  ? tagsSeleccionados : null,
      platos_problema: platosSeleccionados.length > 0 ? platosSeleccionados : null,
      micro_tags: microTagsSel.length > 0 ? microTagsSel : null,
      comentario: comentario || null,
      estado: 'pendiente',
      items_consumidos: itemsConsumidos,
      total_cuenta: totalCuenta,
      propina_monto: propinaMonto,
      propina_pct: propinaPct,
      alerta_preventiva: estrellas <= 2,
      respuesta_ia: IA_RESPONSES[estrellas]?.replace('[nombre]', clienteNombre?.split(' ')[0] || 'cliente'),
    };
    await supabase.from('xcare_encuestas').insert(data);
    // Si estrellas bajas → crear alerta preventiva
    if (estrellas <= 2) {
      await supabase.from('xcare_alertas').insert({
        restaurante_id: 6,
        mesa_num: mesaNum,
        mesero_nombre: meseroNombre,
        senales: platosSeleccionados.length > 0 ? platosSeleccionados : ['Experiencia negativa'],
        nivel_riesgo: estrellas === 1 ? 'critico' : 'alto',
        descripcion: `${estrellas}★ — ${tagsSeleccionados.join(', ')}${comentario?` — "${comentario}"`: ''}`,
      });
    }
    onGuardar(data);
    setPaso('gracias');
  };

  const S = { bg:'#08080f', bg2:'#0f0f1a', gold:'#FFB547', green:'#00E676', red:'#FF5252', t1:'#fff', t2:'#A0A0B8', t3:'#50506A' };

  return (
    <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.92)',zIndex:10000,display:'flex',alignItems:'center',justifyContent:'center',padding:16}}>
      <div style={{background:S.bg2,borderRadius:24,width:'100%',maxWidth:480,maxHeight:'90vh',overflowY:'auto',border:'1px solid rgba(255,255,255,0.1)'}}>

        {/* Header */}
        <div style={{padding:'20px 24px 16px',borderBottom:'1px solid rgba(255,255,255,0.07)',display:'flex',alignItems:'center',justifyContent:'space-between'}}>
          <div>
            <div style={{fontFamily:"'Syne',sans-serif",fontSize:16,fontWeight:900,color:S.gold}}>X-CARE™</div>
            <div style={{fontSize:10,color:S.t3}}>Experience Intelligence Engine</div>
          </div>
          <button onClick={onClose} style={{background:'none',border:'none',color:S.t3,cursor:'pointer',fontSize:18}}>✕</button>
        </div>

        <div style={{padding:'24px'}}>

          {/* ── PASO 1: ESTRELLAS ── */}
          {paso === 'estrellas' && (
            <div style={{textAlign:'center'}}>
              <div style={{fontSize:28,marginBottom:8}}>✨</div>
              <div style={{fontFamily:"'Syne',sans-serif",fontSize:18,fontWeight:900,marginBottom:6}}>¿Cómo se sintió tu experiencia hoy?</div>
              <div style={{fontSize:12,color:S.t2,marginBottom:28}}>Mesa {mesaNum} · {clienteNombre || 'Cliente'}</div>
              <div style={{display:'flex',justifyContent:'center',gap:12,marginBottom:8}}>
                {[1,2,3,4,5].map(n=>(
                  <button key={n} onClick={()=>handleEstrellas(n)}
                    style={{background:'none',border:'none',cursor:'pointer',transition:'transform .2s',transform:estrellas>=n?'scale(1.2)':'scale(1)'}}>
                    <span style={{fontSize:44,filter:estrellas>=n?'none':'grayscale(1)',opacity:estrellas>=n?1:0.35}}>★</span>
                  </button>
                ))}
              </div>
              <div style={{display:'flex',justifyContent:'center',gap:20,fontSize:11,color:S.t3}}>
                <span>Muy mala</span><span style={{flex:1}}/>
                <span>Increíble</span>
              </div>
            </div>
          )}

          {/* ── PASO 2: TAGS ── */}
          {paso === 'tags' && (
            <div>
              <div style={{fontSize:15,fontWeight:700,marginBottom:4,textAlign:'center'}}>
                {estrellas >= 4 ? '🔥 ¿Qué fue lo que más destacarías?' : estrellas === 3 ? '✨ ¿Qué faltó para que fuera perfecta?' : '🙏 Ayúdanos a entender qué pasó'}
              </div>
              <div style={{display:'flex',justifyContent:'center',marginBottom:20}}>
                {[1,2,3,4,5].map(n=><span key={n} style={{fontSize:20,opacity:estrellas>=n?1:0.2}}>★</span>)}
              </div>
              <div style={{display:'flex',flexWrap:'wrap',gap:8,justifyContent:'center',marginBottom:20}}>
                {(estrellas >= 4 ? TAGS_5 : TAGS_4).map(tag=>{
                  const sel = tagsSeleccionados.includes(tag);
                  return (
                    <button key={tag} onClick={()=>setTagsSel(p=>sel?p.filter(t=>t!==tag):[...p,tag])}
                      style={{padding:'8px 14px',borderRadius:50,border:`1px solid ${sel?starC(estrellas):'rgba(255,255,255,0.15)'}`,background:sel?`${starC(estrellas)}15`:'transparent',color:sel?starC(estrellas):S.t2,fontSize:12,cursor:'pointer',fontWeight:sel?700:400,transition:'all .15s'}}>
                      {tag}
                    </button>
                  );
                })}
              </div>
              {/* Comentario opcional */}
              <textarea value={comentario} onChange={e=>setComentario(e.target.value)}
                placeholder={estrellas >= 4 ? "Comentario adicional (opcional)..." : "Cuéntanos un poco más..."}
                rows={2}
                style={{width:'100%',padding:'10px 12px',borderRadius:10,border:'1px solid rgba(255,255,255,0.12)',background:'rgba(255,255,255,0.05)',color:S.t1,fontSize:12,outline:'none',resize:'none',marginBottom:16}}/>
              <button onClick={handleTags}
                style={{width:'100%',padding:14,borderRadius:12,border:'none',background:`linear-gradient(135deg,${starC(estrellas)},${starC(estrellas)}aa)`,color:estrellas>=4?'#000':S.t1,fontSize:13,fontWeight:700,cursor:'pointer'}}>
                {estrellas >= 4 ? 'Continuar →' : 'Siguiente →'}
              </button>
            </div>
          )}

          {/* ── PASO 3: PLATOS/CÓCTELES PROBLEMÁTICOS (1-3 estrellas) ── */}
          {paso === 'platos' && (
            <div>
              <div style={{fontSize:14,fontWeight:700,marginBottom:4,textAlign:'center'}}>
                {tipoProblem === 'coctel' ? '🍸 ¿Cuál bebida tuvo el problema?' : '🍽 ¿Cuál plato tuvo el problema?'}
              </div>
              <div style={{fontSize:11,color:S.t3,textAlign:'center',marginBottom:20}}>Toca para seleccionar</div>
              <div style={{display:'flex',flexDirection:'column',gap:8,marginBottom:20}}>
                {(tipoProblem==='coctel' ? cocteles : platos).map((item:any,i:number)=>{
                  const nombre = item.nombre_plato||item.menu_name||item.notes||'Plato';
                  const sel = platosSeleccionados.includes(nombre);
                  return (
                    <button key={i} onClick={()=>setPlatosSel(p=>sel?p.filter(x=>x!==nombre):[...p,nombre])}
                      style={{display:'flex',alignItems:'center',gap:10,padding:'12px 14px',borderRadius:12,border:`1px solid ${sel?S.red:'rgba(255,255,255,0.1)'}`,background:sel?`${S.red}10`:'rgba(255,255,255,0.03)',cursor:'pointer',textAlign:'left',transition:'all .15s'}}>
                      <span style={{fontSize:20}}>{item.emoji||'🍽'}</span>
                      <span style={{fontSize:13,fontWeight:600,color:S.t1}}>{nombre}</span>
                      {sel && <span style={{marginLeft:'auto',color:S.red,fontSize:16}}>✓</span>}
                    </button>
                  );
                })}
                {(tipoProblem==='coctel' ? cocteles : platos).length === 0 && (
                  <div style={{textAlign:'center',padding:20,color:S.t3,fontSize:12}}>
                    No hay items registrados en esta mesa
                  </div>
                )}
              </div>
              <button onClick={()=>setPaso('microtags')}
                style={{width:'100%',padding:14,borderRadius:12,background:`${S.red}20`,color:S.red,fontSize:13,fontWeight:700,cursor:'pointer',border:`1px solid ${S.red}40`,outline:'none'}}>
                Siguiente →
              </button>
            </div>
          )}

          {/* ── PASO 4: MICRO-TAGS ── */}
          {paso === 'microtags' && (
            <div>
              <div style={{fontSize:14,fontWeight:700,marginBottom:4,textAlign:'center'}}>¿Qué tuvo el problema?</div>
              <div style={{fontSize:11,color:S.t3,textAlign:'center',marginBottom:20}}>Puedes seleccionar varios</div>
              <div style={{display:'flex',flexWrap:'wrap',gap:8,justifyContent:'center',marginBottom:20}}>
                {(tipoProblem==='coctel' ? MICRO_TAGS_COCTEL : MICRO_TAGS_COMIDA).map(tag=>{
                  const sel = microTagsSel.includes(tag);
                  return (
                    <button key={tag} onClick={()=>setMicroTagsSel(p=>sel?p.filter(t=>t!==tag):[...p,tag])}
                      style={{padding:'8px 14px',borderRadius:50,border:`1px solid ${sel?S.red:'rgba(255,255,255,0.15)'}`,background:sel?`${S.red}15`:'transparent',color:sel?S.red:S.t2,fontSize:12,cursor:'pointer',fontWeight:sel?700:400}}>
                      {tag}
                    </button>
                  );
                })}
              </div>
              <textarea value={comentario} onChange={e=>setComentario(e.target.value)}
                placeholder="Cuéntanos un poco más..." rows={2} required
                style={{width:'100%',padding:'10px 12px',borderRadius:10,border:'1px solid rgba(255,255,255,0.12)',background:'rgba(255,255,255,0.05)',color:S.t1,fontSize:12,outline:'none',resize:'none',marginBottom:16}}/>
              <button onClick={()=>setPaso('comentario')}
                style={{width:'100%',padding:14,borderRadius:12,background:`${S.red}20`,color:S.red,fontSize:13,fontWeight:700,cursor:'pointer',border:`1px solid ${S.red}40`,outline:'none'}}>
                Finalizar →
              </button>
            </div>
          )}

          {/* ── PASO 5: COMENTARIO FINAL + GOOGLE ── */}
          {paso === 'comentario' && (
            <div style={{textAlign:'center'}}>
              {estrellas >= 4 && (
                <div style={{marginBottom:24}}>
                  <div style={{fontSize:24,marginBottom:8}}>{estrellas===5?'🔥':'✨'}</div>
                  <div style={{fontSize:15,fontWeight:700,marginBottom:4}}>
                    {estrellas===5?'¡Increíble!':'¡Gracias!'}
                  </div>
                  <div style={{fontSize:12,color:S.t2,marginBottom:20}}>
                    Tu experiencia puede inspirar a otros.
                  </div>
                  <button onClick={()=>window.open('https://search.google.com/local/writereview','_blank')}
                    style={{width:'100%',padding:14,borderRadius:12,border:'none',background:'#4285F4',color:'#fff',fontSize:13,fontWeight:700,cursor:'pointer',marginBottom:10}}>
                    ⭐ Dejar reseña en Google
                  </button>
                  <div style={{fontSize:10,color:S.t3,marginBottom:20}}>Tu opinión ayuda a que más personas vivan momentos memorables.</div>
                </div>
              )}
              <button onClick={handleGuardar}
                style={{width:'100%',padding:14,borderRadius:12,border:'none',background:`linear-gradient(135deg,${S.gold},#d4943a)`,color:'#000',fontSize:13,fontWeight:700,cursor:'pointer'}}>
                Enviar experiencia ✓
              </button>
            </div>
          )}

          {/* ── PASO 6: GRACIAS ── */}
          {paso === 'gracias' && (
            <div style={{textAlign:'center',padding:'20px 0'}}>
              <div style={{fontSize:48,marginBottom:16}}>
                {estrellas>=4?'🙏':'💙'}
              </div>
              <div style={{fontFamily:"'Syne',sans-serif",fontSize:20,fontWeight:900,marginBottom:8}}>
                {estrellas>=4?'¡Gracias por tu visita!':'Gracias por tu honestidad'}
              </div>
              <div style={{fontSize:12,color:S.t2,lineHeight:1.6,marginBottom:24}}>
                {IA_RESPONSES[estrellas]?.replace('[nombre]', clienteNombre?.split(' ')[0]||'cliente')}
              </div>
              {estrellas<=2 && (
                <div style={{padding:'12px 16px',background:`${S.red}10`,border:`1px solid ${S.red}20`,borderRadius:12,fontSize:11,color:S.red,marginBottom:16}}>
                  🔔 Hemos notificado a nuestro equipo. Recibirás atención personalizada en tu próxima visita.
                </div>
              )}
              <button onClick={onClose}
                style={{padding:'12px 32px',borderRadius:50,border:'none',background:S.gold,color:'#000',fontSize:13,fontWeight:700,cursor:'pointer'}}>
                Cerrar
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}


// ── TIPOS ─────────────────────────────────────────────────────────────
type Tab = 'live' | 'encuestas' | 'cim' | 'ohyeah' | 'dashboard';

interface XCareEncuesta {
  id: string; created_at: string; restaurante_id: number;
  mesa_num: number | null; mesero_nombre: string | null;
  cliente_nombre: string | null; cliente_email: string | null;
  estrellas: number; tags_positivos: string[] | null;
  tags_negativos: string[] | null; micro_tags: string[] | null;
  platos_problema: any | null; bebidas_problema: any | null;
  comentario: string | null; estado: string;
  respuesta_ia: string | null; alerta_preventiva: boolean;
  items_consumidos: any | null; propina_pct: number | null;
}

interface XCareAlerta {
  id: string; created_at: string; mesa_num: number | null;
  mesero_nombre: string | null; senales: string[] | null;
  nivel_riesgo: string; descripcion: string | null; resuelta: boolean;
}

interface OhYeahCliente {
  id: string; nombre: string; email: string; telefono: string | null;
  ciudad: string | null; nivel: string; visitas: number;
  last_login: string | null; registro_at: string;
  notas: string | null; restricciones: string | null;
  total_reservas: number; ultima_reserva: string | null;
  dias_sin_visitar: number | null;
}

// EncuestaXCare y constantes — ver XCareEncuesta.tsx
// ── PANEL RESPUESTA ────────────────────────────────────────────────────
function PanelRespuesta({ enc, onClose, onSend }: { enc: XCareEncuesta; onClose:()=>void; onSend:()=>void }) {
  const nombre = enc.cliente_nombre?.split(' ')[0] || 'cliente';
  const [texto, setTexto] = useState(IA_RESPONSES[enc.estrellas]?.replace('[nombre]', nombre) || '');
  const c = starC(enc.estrellas);
  return (
    <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-[#1c1c1c] border border-[#2a2a2a] rounded-2xl p-6 max-w-lg w-full" onClick={e=>e.stopPropagation()}>
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-full flex items-center justify-center font-black text-[16px]"
            style={{background:`${c}20`,color:c}}>
            {enc.cliente_nombre?.charAt(0)||'?'}
          </div>
          <div className="flex-1">
            <div className="font-bold text-white">{enc.cliente_nombre||'Cliente'}</div>
            <div className="flex gap-0.5">{Array.from({length:5},(_,i)=><span key={i} style={{color:i<enc.estrellas?c:'#333',fontSize:14}}>★</span>)}</div>
          </div>
          <button onClick={onClose} className="text-[#606060] hover:text-white"><X size={16}/></button>
        </div>
        {enc.comentario && <div className="bg-[#141414] rounded-xl p-3 text-[12px] text-[#a0a0a0] mb-4 italic">"{enc.comentario}"</div>}
        <div className="text-[10px] text-[#606060] font-bold uppercase mb-2">✦ Respuesta IA — Nivel Ritz Carlton</div>
        <textarea value={texto} onChange={e=>setTexto(e.target.value)} rows={5}
          className="w-full bg-[#141414] border border-[#2a2a2a] rounded-xl p-3 text-[13px] text-white outline-none resize-none mb-4"/>
        <div className="flex gap-3">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-lg border border-[#2a2a2a] text-[#606060] text-[12px]">Cancelar</button>
          <button onClick={onSend} className="flex-2 py-2.5 px-4 rounded-lg bg-gradient-to-r from-purple-600 to-blue-600 text-white font-bold text-[12px] flex items-center gap-2">
            <Send size={13}/> Enviar respuesta
          </button>
        </div>
      </div>
    </div>
  );
}

// ── COMPONENTE PRINCIPAL ──────────────────────────────────────────────
export default function CareModule() {
  const [activeTab, setActiveTab] = useState<Tab>('live');
  const [encuestas, setEncuestas] = useState<XCareEncuesta[]>([]);
  const [alertas,   setAlertas]   = useState<XCareAlerta[]>([]);
  const [loading,   setLoading]   = useState(false);
  const [encSel,    setEncSel]    = useState<XCareEncuesta|null>(null);
  const [dashboard, setDashboard] = useState<any>(null);
  // Oh Yeah
  const [ohyeahClientes, setOhyeahClientes] = useState<OhYeahCliente[]>([]);
  const [ohyeahLoading,  setOhyeahLoading]  = useState(false);
  const [busquedaOY,     setBusquedaOY]     = useState('');
  const [filtroNivel,    setFiltroNivel]     = useState('todos');

  const fetchData = useCallback(async () => {
    setLoading(true);
    const [enc, alt, dash] = await Promise.all([
      supabase.from('xcare_encuestas').select('*').eq('restaurante_id',6).order('created_at',{ascending:false}).limit(50),
      supabase.from('xcare_alertas').select('*').eq('restaurante_id',6).eq('resuelta',false).order('created_at',{ascending:false}).limit(20),
      supabase.from('xcare_dashboard').select('*').eq('restaurante_id',6).maybeSingle(),
    ]);
    if (enc.data)  setEncuestas(enc.data as XCareEncuesta[]);
    if (alt.data)  setAlertas(alt.data as XCareAlerta[]);
    if (dash.data) setDashboard(dash.data);
    setLoading(false);
  }, []);

  const fetchOhYeahClientes = useCallback(async () => {
    setOhyeahLoading(true);
    const { data } = await supabase.from('nexum_clientes_ohyeah').select('*');
    if (data) setOhyeahClientes(data as OhYeahCliente[]);
    setOhyeahLoading(false);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  useEffect(() => {
    fetchOhYeahClientes();
    const ch = supabase.channel('care-ohyeah')
      .on('postgres_changes',{event:'INSERT',schema:'public',table:'ohyeah_clientes'},()=>fetchOhYeahClientes())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [fetchOhYeahClientes]);

  useEffect(() => {
    const ch = supabase.channel('care-live')
      .on('postgres_changes',{event:'INSERT',schema:'public',table:'xcare_encuestas'},()=>fetchData())
      .on('postgres_changes',{event:'INSERT',schema:'public',table:'xcare_alertas'},()=>fetchData())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [fetchData]);

  const resolverAlerta = async (id:string) => {
    await supabase.from('xcare_alertas').update({resuelta:true,resuelta_at:new Date().toISOString()}).eq('id',id);
    setAlertas(prev => prev.filter(a=>a.id!==id));
  };

  const enviarRespuesta = async () => {
    if (!encSel) return;
    await supabase.from('xcare_encuestas').update({estado:'respondida',respuesta_enviada:true,respuesta_at:new Date().toISOString()}).eq('id',encSel.id);
    setEncuestas(prev=>prev.map(e=>e.id===encSel.id?{...e,estado:'respondida'}:e));
    setEncSel(null);
  };

  const hoy = new Date().toISOString().split('T')[0];
  const pendientesUrgentes = alertas.filter(a=>!a.resuelta&&(a.nivel_riesgo==='critico'||a.nivel_riesgo==='alto'));

  return (
    <div className="h-full flex flex-col bg-[#08080f] text-white font-['DM_Sans'] overflow-hidden">
      {encSel && <PanelRespuesta enc={encSel} onClose={()=>setEncSel(null)} onSend={enviarRespuesta}/>}

      {/* Header */}
      <div className="px-6 py-4 border-b border-white/7 bg-[#0f0f1a] flex items-center gap-4 flex-wrap shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-[13px] flex items-center justify-center text-xl"
            style={{background:'linear-gradient(135deg,#FF2D78,#B388FF)'}}>❤️</div>
          <div>
            <div className="font-['Syne'] text-[16px] font-black">X-CARE™</div>
            <div className="text-[9px] text-[#50506A] uppercase tracking-widest">Experience Intelligence Engine · Powered by OH-YEAH</div>
          </div>
        </div>
        <div className="flex gap-3 ml-auto flex-wrap">
          {[
            {l:'Alertas urgentes', v:pendientesUrgentes.length,          c:'#FF5252'},
            {l:'Encuestas hoy',    v:encuestas.filter(e=>e.created_at?.startsWith(hoy)).length, c:'#FFB547'},
            {l:'Promedio',         v:dashboard?.promedio_estrellas ? `${dashboard.promedio_estrellas}★` : '—', c:'#00E676'},
            {l:'Clientes',         v:ohyeahClientes.length,              c:'#FFD700'},
          ].map(k=>(
            <div key={k.l} className="text-center px-3 py-1.5 rounded-xl border" style={{borderColor:`${k.c}20`}}>
              <div className="text-[8px] text-[#50506A] uppercase">{k.l}</div>
              <div className="font-['Syne'] text-[18px] font-black" style={{color:k.c}}>{k.v}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-white/7 bg-[#0f0f1a] px-6 shrink-0 overflow-x-auto">
        {([
          {id:'live',      l:'🚨 Alertas en vivo'},
          {id:'encuestas', l:'⭐ Encuestas'},
          {id:'cim',       l:'🧠 CIM™'},
          {id:'ohyeah',    l:'🦉 Oh Yeah!'},
          {id:'dashboard', l:'📊 Dashboard'},
        ] as {id:Tab,l:string}[]).map(t=>(
          <button key={t.id} onClick={()=>setActiveTab(t.id)}
            className="py-3 px-4 text-[11px] font-bold whitespace-nowrap transition-all border-b-2"
            style={{borderColor:activeTab===t.id?'#FF2D78':'transparent',color:activeTab===t.id?'#FF2D78':'#50506A',background:'none',cursor:'pointer'}}>
            {t.l}
            {t.id==='live' && pendientesUrgentes.length>0 && (
              <span className="ml-1.5 bg-[#FF5252] text-white text-[8px] font-black px-1.5 py-0.5 rounded-full">
                {pendientesUrgentes.length}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* ── ALERTAS EN VIVO ── */}
      {activeTab==='live' && (
        <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3">
          {loading && <div className="text-center py-10 text-[#50506A]">Cargando...</div>}
          {!loading && alertas.length===0 && (
            <div className="text-center py-16 text-[#50506A]">
              <div className="text-[48px] mb-3">✅</div>
              <div className="text-[14px] font-bold">Sin alertas activas</div>
              <div className="text-[12px] mt-1">El sistema está monitoreando en tiempo real</div>
            </div>
          )}
          {alertas.map(a=>(
            <div key={a.id} className="bg-[#0f0f1a] border rounded-xl p-4"
              style={{borderColor:a.nivel_riesgo==='critico'?'rgba(255,82,82,0.5)':a.nivel_riesgo==='alto'?'rgba(255,82,82,0.3)':'rgba(255,181,71,0.3)'}}>
              <div className="flex items-start gap-3">
                <span className="text-[20px]">{a.nivel_riesgo==='critico'?'🚨':a.nivel_riesgo==='alto'?'⚠️':'🔔'}</span>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-bold text-[13px] text-white">Mesa {a.mesa_num||'—'}</span>
                    <span className="text-[9px] px-2 py-0.5 rounded-full font-bold"
                      style={{background:a.nivel_riesgo==='critico'?'rgba(255,82,82,0.2)':'rgba(255,181,71,0.2)',color:a.nivel_riesgo==='critico'?'#FF5252':'#FFB547'}}>
                      {a.nivel_riesgo.toUpperCase()}
                    </span>
                  </div>
                  <div className="text-[11px] text-[#a0a0a0] mb-2">{a.descripcion||'Experiencia negativa detectada'}</div>
                  {a.senales && a.senales.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {a.senales.map((s,i)=>(
                        <span key={i} className="text-[9px] px-2 py-0.5 rounded-full bg-white/5 text-[#a0a0a0]">{s}</span>
                      ))}
                    </div>
                  )}
                  <div className="text-[9px] text-[#606060] mt-2">{fmtDate(a.created_at)}</div>
                </div>
                <button onClick={()=>resolverAlerta(a.id)}
                  className="px-3 py-1.5 rounded-lg text-[10px] font-bold shrink-0"
                  style={{background:'rgba(0,230,118,0.1)',border:'1px solid rgba(0,230,118,0.3)',color:'#00E676'}}>
                  ✓ Resolver
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── ENCUESTAS ── */}
      {activeTab==='encuestas' && (
        <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3">
          <div className="flex items-center justify-between mb-1">
            <div className="font-['Syne'] text-[15px] font-black">Encuestas X-CARE™</div>
            <button onClick={fetchData} className="text-[#50506A] hover:text-white flex items-center gap-1 text-[11px]">
              <RefreshCw size={12}/> Actualizar
            </button>
          </div>
          {loading && <div className="text-center py-10 text-[#50506A]">Cargando...</div>}
          {!loading && encuestas.length===0 && (
            <div className="text-center py-16 text-[#50506A]">
              <div className="text-[48px] mb-3">⭐</div>
              <div className="text-[14px] font-bold">Sin encuestas aún</div>
              <div className="text-[12px] mt-1">Aparecen automáticamente al confirmar el pago</div>
            </div>
          )}
          {encuestas.map(enc=>{
            const c = starC(enc.estrellas);
            return (
              <div key={enc.id} className="bg-[#0f0f1a] border border-white/7 rounded-xl p-4 hover:border-white/15 transition-all">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-full flex items-center justify-center font-black text-[16px] shrink-0"
                    style={{background:`${c}20`,color:c}}>
                    {enc.cliente_nombre?.charAt(0)||'?'}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span className="font-bold text-[13px]">{enc.cliente_nombre||'Cliente'}</span>
                      {enc.mesa_num && <span className="text-[10px] text-[#606060]">Mesa {enc.mesa_num}</span>}
                      {enc.alerta_preventiva && (
                        <span className="text-[9px] px-2 py-0.5 rounded-full bg-[#FF5252]/15 text-[#FF5252] font-bold">🚨 Alerta</span>
                      )}
                    </div>
                    <div className="flex gap-0.5 mb-2">
                      {Array.from({length:5},(_,i)=><span key={i} style={{color:i<enc.estrellas?c:'#333',fontSize:14}}>★</span>)}
                    </div>
                    {/* Tags */}
                    <div className="flex flex-wrap gap-1 mb-2">
                      {[...(enc.tags_positivos||[]),...(enc.tags_negativos||[])].slice(0,4).map((t,i)=>(
                        <span key={i} className="text-[9px] px-2 py-0.5 rounded-full bg-white/5 text-[#a0a0a0]">{t}</span>
                      ))}
                      {enc.micro_tags?.slice(0,3).map((t,i)=>(
                        <span key={`m${i}`} className="text-[9px] px-2 py-0.5 rounded-full bg-[#FF5252]/10 text-[#FF5252]">{t}</span>
                      ))}
                    </div>
                    {enc.comentario && <div className="text-[11px] text-[#a0a0a0] italic mb-2">"{enc.comentario}"</div>}
                    <div className="text-[9px] text-[#606060]">{fmtDate(enc.created_at)}</div>
                  </div>
                  <div className="flex flex-col gap-2 shrink-0">
                    <span className="text-[9px] px-2 py-1 rounded-full font-bold"
                      style={{background:enc.estado==='respondida'?'rgba(0,230,118,0.1)':'rgba(255,181,71,0.1)',color:enc.estado==='respondida'?'#00E676':'#FFB547'}}>
                      {enc.estado}
                    </span>
                    {enc.estado==='pendiente' && (
                      <button onClick={()=>setEncSel(enc)}
                        className="text-[9px] px-2 py-1 rounded-full border border-purple-500/40 text-purple-400 font-bold flex items-center gap-1">
                        <Send size={9}/> Responder
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── CIM™ ── */}
      {activeTab==='cim' && (
        <div className="flex-1 overflow-y-auto p-6">
          <div className="font-['Syne'] text-[16px] font-black mb-2">🧠 CIM™</div>
          <div className="text-[11px] text-[#50506A] mb-6">Customer Intelligence Management — No es CRM. Es gestión de inteligencia emocional.</div>
          <div className="grid grid-cols-2 gap-4 mb-6">
            {[
              {e:'🧠',t:'Mood preferido',       d:'Detectado automáticamente por historial de visitas y encuestas'},
              {e:'⏱',t:'Ritmo de consumo',     d:'Rápido · Normal · Sobremesa larga'},
              {e:'🎫',t:'Ticket promedio',      d:'Calculado en cada visita registrada'},
              {e:'🍸',t:'Preferencias bebida',  d:'Aprendidas de encuestas y órdenes anteriores'},
              {e:'💰',t:'Nivel de propina',     d:'Alto · Normal · Bajo · Nunca'},
              {e:'⚡',t:'Sensibilidad demora',  d:'Alta · Normal · Baja — según reacciones pasadas'},
              {e:'🔄',t:'Prob. retorno',        d:'% calculado según frecuencia y calificaciones'},
              {e:'🚪',t:'Prob. fuga',           d:'Se activa cuando calificaciones bajan'},
            ].map(i=>(
              <div key={i.t} className="bg-[#0f0f1a] border border-white/7 rounded-xl p-4">
                <div className="text-[20px] mb-2">{i.e}</div>
                <div className="text-[12px] font-bold text-white mb-1">{i.t}</div>
                <div className="text-[10px] text-[#50506A]">{i.d}</div>
              </div>
            ))}
          </div>
          <div className="bg-gradient-to-r from-[#FF2D78]/5 to-[#B388FF]/5 border border-[#FF2D78]/20 rounded-xl p-4">
            <div className="text-[11px] text-[#FF2D78] font-bold mb-2">🔔 Ejemplo de alerta host</div>
            <div className="text-[12px] text-white mb-1">"Prefiere experiencia ágil."</div>
            <div className="text-[12px] text-white">"Disfruta sobremesa y postre."</div>
            <div className="text-[10px] text-[#50506A] mt-2">Eso es lujo invisible.</div>
          </div>
        </div>
      )}

      {/* ── OH YEAH! ── */}
      {activeTab==='ohyeah' && (
        <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4">
          <div className="grid grid-cols-4 gap-3">
            {[
              {l:'Total',      v:ohyeahClientes.length,                                              c:'#FFB547'},
              {l:'ÉLITE',      v:ohyeahClientes.filter(c=>c.nivel==='ÉLITE').length,                c:'#FFD700'},
              {l:'VIP',        v:ohyeahClientes.filter(c=>c.nivel==='VIP').length,                  c:'#B388FF'},
              {l:'Nuevos hoy', v:ohyeahClientes.filter(c=>c.registro_at?.startsWith(hoy)).length,   c:'#00E676'},
            ].map(k=>(
              <div key={k.l} className="bg-[#0f0f1a] border rounded-xl p-3 text-center" style={{borderColor:`${k.c}20`}}>
                <div className="text-[9px] text-[#50506A] uppercase mb-1">{k.l}</div>
                <div className="font-['Syne'] text-[22px] font-black" style={{color:k.c}}>{k.v}</div>
              </div>
            ))}
          </div>
          <div className="flex gap-3 flex-wrap items-center">
            <div className="flex-1 flex items-center gap-2 bg-[#0f0f1a] border border-white/10 rounded-lg px-3 py-2">
              <span className="text-[12px] text-[#50506A]">🔍</span>
              <input value={busquedaOY} onChange={e=>setBusquedaOY(e.target.value)}
                placeholder="Buscar nombre, email o ciudad..."
                className="flex-1 bg-transparent text-[12px] text-white outline-none placeholder-[#50506A]"/>
              {busquedaOY && <button onClick={()=>setBusquedaOY('')} className="text-[#50506A] text-[11px]">✕</button>}
            </div>
            <div className="flex gap-2 flex-wrap">
              {['todos','INICIADO','REGULAR','VIP','CONSAGRADO','ÉLITE'].map(n=>(
                <button key={n} onClick={()=>setFiltroNivel(n)}
                  className="px-3 py-1.5 rounded-full text-[10px] font-bold transition-all"
                  style={{border:`1px solid ${filtroNivel===n?(NIVEL_COLORS[n]||'#606060'):'rgba(255,255,255,0.1)'}`,background:filtroNivel===n?`${NIVEL_COLORS[n]||'#606060'}15`:'transparent',color:filtroNivel===n?(NIVEL_COLORS[n]||'#606060'):'#606060',cursor:'pointer'}}>
                  {n==='todos'?'Todos':n}
                </button>
              ))}
            </div>
            <button onClick={fetchOhYeahClientes} className="text-[11px] text-[#50506A] hover:text-white flex items-center gap-1">
              <RefreshCw size={12}/> Actualizar
            </button>
          </div>
          {ohyeahLoading ? (
            <div className="text-center py-10 text-[#50506A]">Cargando clientes...</div>
          ) : (
            <div className="flex flex-col gap-3">
              {ohyeahClientes.filter(cl=>{
                const b=busquedaOY.toLowerCase();
                return (!b||cl.nombre?.toLowerCase().includes(b)||cl.email?.toLowerCase().includes(b)||cl.ciudad?.toLowerCase().includes(b))&&(filtroNivel==='todos'||cl.nivel===filtroNivel);
              }).map(cl=>{
                const nc=NIVEL_COLORS[cl.nivel]||'#606060';
                return (
                  <div key={cl.id} className="bg-[#0f0f1a] border border-white/7 rounded-xl p-4 hover:border-white/15 transition-all">
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 rounded-full flex items-center justify-center font-black text-[16px] shrink-0"
                        style={{background:`${nc}20`,border:`2px solid ${nc}40`,color:nc}}>
                        {cl.nombre?.charAt(0).toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <span className="font-bold text-[13px] text-white">{cl.nombre}</span>
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{background:`${nc}15`,color:nc,border:`1px solid ${nc}30`}}>
                            {NIVEL_EMOJI[cl.nivel]} {cl.nivel}
                          </span>
                          {cl.dias_sin_visitar!==null&&cl.dias_sin_visitar>30&&(
                            <span className="text-[9px] px-2 py-0.5 rounded-full font-bold bg-red-500/15 text-red-400 border border-red-500/30">
                              ⚠️ {cl.dias_sin_visitar}d sin visitar
                            </span>
                          )}
                        </div>
                        <div className="flex gap-4 flex-wrap">
                          {cl.email&&<span className="text-[10px] text-[#50506A]">✉️ {cl.email}</span>}
                          {cl.telefono&&<span className="text-[10px] text-[#50506A]">📱 {cl.telefono}</span>}
                          {cl.ciudad&&<span className="text-[10px] text-[#50506A]">📍 {cl.ciudad}</span>}
                        </div>
                        {cl.restricciones&&<div className="mt-1 text-[10px] text-orange-400">⚠️ {cl.restricciones}</div>}
                      </div>
                      <div className="flex gap-3 shrink-0">
                        {[{l:'Visitas',v:cl.visitas||0,c:'#FFB547'},{l:'Reservas',v:cl.total_reservas||0,c:'#448AFF'}].map(m=>(
                          <div key={m.l} className="text-center">
                            <div className="font-['Syne'] text-[16px] font-black" style={{color:m.c}}>{m.v}</div>
                            <div className="text-[8px] text-[#50506A]">{m.l}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                    {cl.ultima_reserva&&(
                      <div className="mt-2 pt-2 border-t border-white/5 text-[10px] text-[#50506A]">
                        Última reserva: {new Date(cl.ultima_reserva).toLocaleDateString('es-CO',{day:'numeric',month:'short',year:'numeric'})}
                      </div>
                    )}
                  </div>
                );
              })}
              {ohyeahClientes.filter(cl=>{const b=busquedaOY.toLowerCase();return(!b||cl.nombre?.toLowerCase().includes(b))&&(filtroNivel==='todos'||cl.nivel===filtroNivel);}).length===0&&(
                <div className="text-center py-10 text-[#50506A]"><div className="text-[40px] mb-2">🦉</div><div>Sin clientes que coincidan</div></div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── DASHBOARD ── */}
      {activeTab==='dashboard' && (
        <div className="flex-1 overflow-y-auto p-6">
          <div className="font-['Syne'] text-[15px] font-black mb-4">📊 Dashboard X-CARE™</div>
          <div className="grid grid-cols-3 gap-4 mb-6">
            {[
              {e:'📈',l:'NPS diario',          v:dashboard?.promedio_estrellas?`${dashboard.promedio_estrellas}★`:'—',     c:'#00E676'},
              {e:'📋',l:'Encuestas completadas',v:dashboard?.total_encuestas||0,                                            c:'#448AFF'},
              {e:'📉',l:'% riesgo fuga',       v:dashboard?.pct_negativas?`${dashboard.pct_negativas}%`:'0%',              c:'#FF5252'},
              {e:'🚨',l:'Alertas activadas',   v:dashboard?.alertas_activadas||0,                                          c:'#FFB547'},
              {e:'✅',l:'Recuperaciones',       v:dashboard?.recuperaciones||0,                                             c:'#00E676'},
              {e:'📅',l:'Esta semana',          v:dashboard?.encuestas_semana||0,                                           c:'#B388FF'},
            ].map(k=>(
              <div key={k.l} className="bg-[#0f0f1a] border rounded-xl p-4" style={{borderColor:`${k.c}20`}}>
                <div className="text-[20px] mb-2">{k.e}</div>
                <div className="text-[9px] text-[#50506A] uppercase mb-1">{k.l}</div>
                <div className="font-['Syne'] text-[24px] font-black" style={{color:k.c}}>{k.v}</div>
              </div>
            ))}
          </div>
          {encuestas.length===0&&<div className="text-center py-10 text-[#50506A]">Sin datos suficientes aún</div>}
        </div>
      )}
    </div>
  );
}

// ── EXPORTAR MODAL PARA EL POS ─────────────────────────────────────────
export { EncuestaXCare };
