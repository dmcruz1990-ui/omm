import { useState, useCallback, useEffect } from 'react';
import { supabase } from '../lib/supabase.ts';
import {
  Shield, Star, TrendingUp, TrendingDown, AlertTriangle,
  Zap, BarChart2, MessageSquare, RefreshCw,
  CheckCircle, Bell, Brain, Award, ChevronRight,
  Heart, Users, Clock, Activity, Sparkles, Target
} from 'lucide-react';

type Severidad = 'critica' | 'alta' | 'media' | 'baja';
type Tab = 'live' | 'encuestas' | 'cim' | 'ohyeah' | 'dashboard' | 'entrenar';

interface Alerta {
  id: number; mesa: string; tipo: string; icono: string;
  severidad: Severidad; tiempo: string; minutos: number;
  descripcion: string; ltv: string; resuelta: boolean; guion?: string;
}

interface Encuesta {
  id: number; cliente: string; mesa: string; estrellas: number;
  tags: string[]; comentario: string; fecha: string;
  respondida: boolean; platos?: string[];
}

interface ClienteCIM {
  id: number; nombre: string; iniciales: string; visitas: number;
  ticket: string; mood: string; ritmo: string; propina: string;
  alerta: string; quejas: string[]; preferencias: string[]; score: number;
}

const ALERTAS: Alerta[] = [
  { id:1, mesa:'M4', tipo:'TIEMPOS EXCEDIDOS', icono:'⏱', severidad:'alta', tiempo:'7:00', minutos:7, ltv:'$4.5M', descripcion:'Plato principal lleva 38 min. Promesa: 25 min. Cliente VIP — alta probabilidad de reseña negativa.', resuelta:false, guion:'Me permite disculparme por la espera. El chef está dando los últimos toques a su plato. Como gesto, nos gustaría invitarle una copa mientras tanto.' },
  { id:2, mesa:'M1', tipo:'GESTO DE AYUDA', icono:'✋', severidad:'media', tiempo:'2:00', minutos:2, ltv:'$1.2M', descripcion:'Cliente ha levantado la mano 3 veces en los últimos 2 minutos. Mesero asignado en otra zona.', resuelta:false, guion:'Acercarse inmediatamente. "Disculpe la espera, ¿en qué le puedo ayudar?"' },
  { id:3, mesa:'M8', tipo:'FEEDBACK NEGATIVO', icono:'📉', severidad:'critica', tiempo:'0:00', minutos:0, ltv:'$8.9M', descripcion:'Cliente VIP recurrente. Propina 3% vs promedio histórico 22%. Posible experiencia insatisfactoria.', resuelta:false, guion:'Acercarse antes del pago. "Ha sido un placer tenerlos esta noche. ¿Hay algo que podamos mejorar para su próxima visita?"' },
  { id:4, mesa:'M12', tipo:'SIN POSTRE (PATRÓN VIP)', icono:'🚪', severidad:'baja', tiempo:'22:00', minutos:22, ltv:'$2.1M', descripcion:'Cliente habitual que en sus últimas 8 visitas siempre pide postre. Esta noche no lo solicitó.', resuelta:true, guion:'Ofrecer postre como sugerencia del chef.' },
];

const ENCUESTAS: Encuesta[] = [
  { id:1, cliente:'Valentina R.', mesa:'M4', estrellas:5, tags:['🍽 Comida','🤵 Servicio','🎶 Ambiente'], comentario:'Todo perfecto. El Pulpo Ton espectacular y el servicio de Mateo impecable.', fecha:'Hoy · 20:14', respondida:false },
  { id:2, cliente:'Carlos M.', mesa:'M8', estrellas:2, tags:['⏱ Tiempo','🌡 Temperatura'], comentario:'La sopa llegó fría y esperamos más de 40 minutos el plato fuerte.', fecha:'Hoy · 19:48', respondida:false, platos:['🍲 Burosu Shitake','🥩 Arroz Ginza Beef','🥗 Ceviche a la Roca'] },
  { id:3, cliente:'Andrés L.', mesa:'M3', estrellas:4, tags:['🍸 Cócteles','🎶 Ambiente'], comentario:'Los cócteles buenísimos. El servicio un poco lento al inicio pero se recuperó.', fecha:'Hoy · 19:22', respondida:true },
  { id:4, cliente:'María F.', mesa:'M9', estrellas:5, tags:['👨‍🍳 Chef','🍽 Comida','🕯 Experiencia completa'], comentario:'La mejor noche. La experiencia del chef ejecutivo fue impresionante.', fecha:'Hoy · 18:55', respondida:true },
  { id:5, cliente:'Roberto S.', mesa:'M6', estrellas:1, tags:['🤵 Atención','⏱ Tiempo'], comentario:'Nadie vino a nuestra mesa por 25 minutos. Tuvimos que levantarnos a buscar al mesero.', fecha:'Ayer · 21:30', respondida:false, platos:['🍸 Kimchi Sour','🥟 Dumplings de Cerdo x2'] },
];

const CLIENTES_CIM: ClienteCIM[] = [
  { id:1, nombre:'Valentina Rodríguez', iniciales:'VR', visitas:12, ticket:'$148.000', mood:'Ambiente íntimo', ritmo:'Sobremesa larga', propina:'22%', score:94, alerta:'🔔 Disfruta postre — ofrecerlo siempre antes del café', quejas:[], preferencias:['🍽 Comida','🎶 Ambiente','🕯 Experiencia'] },
  { id:2, nombre:'Carlos Mendoza', iniciales:'CM', visitas:5, ticket:'$89.000', mood:'Servicio ágil', ritmo:'Experiencia rápida', propina:'8%', score:61, alerta:'⚠ Sensible a demoras — priorizar atención inmediata', quejas:['⏱ Tiempo','🌡 Temperatura'], preferencias:['🍸 Cócteles'] },
  { id:3, nombre:'Andrés López', iniciales:'AL', visitas:8, ticket:'$112.000', mood:'Social / grupo', ritmo:'Mesa activa', propina:'18%', score:82, alerta:'🔔 Prefiere cócteles — sugerir novedades de barra', quejas:[], preferencias:['🍸 Cócteles','🎶 Ambiente','🤵 Servicio'] },
];

const IA_RESPONSES: Record<number,string> = {
  5:`Hola [nombre],\n\nNos encanta saber que tu experiencia fue increíble. Compartir momentos así es exactamente lo que nos inspira cada día.\n\nEsperamos verte pronto — será un placer superarlo.`,
  4:`Hola [nombre],\n\nGracias por tu visita y por tomarte el tiempo de compartir tu experiencia. Ya revisamos los detalles que mencionas y nuestro equipo está trabajando en los ajustes.\n\nTu próxima visita será atendida con especial cuidado.`,
  3:`Hola [nombre],\n\nGracias por confiar en nosotros hoy. Hemos revisado cuidadosamente tu experiencia y ya estamos ajustando los detalles que nos compartiste.\n\nSerá un honor recibirte nuevamente y demostrarte la diferencia.`,
  2:`Hola [nombre],\n\nTu experiencia es importante para nosotros. Nuestro equipo ya está trabajando internamente para que lo ocurrido no vuelva a suceder.\n\nSerá un honor recibirte nuevamente y sorprenderte desde el primer momento.`,
  1:`Hola [nombre],\n\nLo que nos compartiste merece toda nuestra atención. Hemos revisado cada detalle y ya tomamos acciones concretas con nuestro equipo.\n\nNos gustaría recibirte nuevamente para ofrecerte una experiencia completamente distinta y personalizada.`,
};

const QUEJAS_TOP = [
  { tag:'⏱ Tiempo de espera', count:7, pct:38, color:'#FF4444' },
  { tag:'🌡 Temperatura plato', count:4, pct:22, color:'#FF8C42' },
  { tag:'🤵 Atención lenta', count:3, pct:17, color:'#FFB347' },
  { tag:'🍸 Sabor cócteles', count:2, pct:11, color:'#4A8FD4' },
  { tag:'🎶 Nivel de ruido', count:2, pct:11, color:'#9b72ff' },
];

const SEV: Record<Severidad,{label:string;color:string;bg:string;border:string}> = {
  critica:{ label:'CRÍTICA', color:'#FF2244', bg:'rgba(255,34,68,.06)',   border:'rgba(255,34,68,.3)' },
  alta:   { label:'ALTA',    color:'#FF5C35', bg:'rgba(255,92,53,.06)',   border:'rgba(255,92,53,.3)' },
  media:  { label:'MEDIA',   color:'#FFB347', bg:'rgba(255,179,71,.06)',  border:'rgba(255,179,71,.3)' },
  baja:   { label:'BAJA',    color:'#4A8FD4', bg:'rgba(74,143,212,.06)', border:'rgba(74,143,212,.3)' },
};

const starC = (n:number) => n>=4?'#22D07A':n===3?'#FFB347':'#FF5C5C';
const scoreC = (n:number) => n>=80?'#22D07A':n>=60?'#FFB347':'#FF5C5C';

function getRegalo(enc:Encuesta):string|null {
  if(enc.estrellas>2) return null;
  if(enc.tags.some(t=>t.includes('Cóctel')||t.includes('Balance'))) return '🍸 Cóctel de cortesía en próxima visita';
  if(enc.tags.some(t=>t.includes('Comida')||t.includes('Sabor')||t.includes('Temperatura'))) return '🍽 El mismo plato, ejecutado perfecto';
  return '🍷 Copa de vino seleccionada por el sommelier';
}

function PanelAlerta({alerta,onClose,onResolve}:{alerta:Alerta;onClose:()=>void;onResolve:(id:number)=>void}) {
  const s = SEV[alerta.severidad];
  return (
    <div style={{position:'fixed',inset:0,zIndex:1000,background:'rgba(0,0,0,.8)',display:'flex',alignItems:'flex-end',justifyContent:'center'}} onClick={onClose}>
      <div style={{background:'#0d0d0d',border:'1px solid #1e1e1e',borderTop:`2px solid ${s.color}`,borderRadius:'20px 20px 0 0',padding:24,width:'100%',maxWidth:560,maxHeight:'85vh',overflowY:'auto'}} onClick={e=>e.stopPropagation()}>
        <div style={{width:40,height:4,borderRadius:2,background:'#2a2a2a',margin:'0 auto 20px'}}/>
        <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:16}}>
          <span style={{fontSize:28}}>{alerta.icono}</span>
          <div style={{flex:1}}>
            <div style={{fontFamily:'Syne,sans-serif',fontSize:16,fontWeight:900,color:'#f0f0f0'}}>{alerta.tipo}</div>
            <div style={{fontSize:12,color:'#606060'}}>Mesa {alerta.mesa} · {alerta.tiempo} en rojo</div>
          </div>
          <div style={{padding:'4px 12px',borderRadius:20,fontSize:10,fontWeight:800,background:s.bg,color:s.color,border:`1px solid ${s.border}`}}>{s.label}</div>
        </div>
        <div style={{background:'rgba(212,148,58,.06)',border:'1px solid rgba(212,148,58,.2)',borderRadius:10,padding:'10px 14px',marginBottom:14,display:'flex',justifyContent:'space-between',alignItems:'center'}}>
          <span style={{fontSize:11,color:'#606060'}}>LTV del cliente</span>
          <span style={{fontFamily:'Syne,sans-serif',fontSize:18,fontWeight:900,color:'#d4943a'}}>{alerta.ltv}</span>
        </div>
        <div style={{background:'#111',border:'1px solid #1a1a1a',borderRadius:10,padding:14,marginBottom:14,fontSize:13,color:'#a0a0a0',lineHeight:1.7}}>{alerta.descripcion}</div>
        {alerta.guion&&(
          <div style={{background:'rgba(155,114,255,.06)',border:'1px solid rgba(155,114,255,.2)',borderRadius:10,padding:14,marginBottom:20}}>
            <div style={{fontSize:10,color:'#9b72ff',fontWeight:700,letterSpacing:'1px',textTransform:'uppercase',marginBottom:8,display:'flex',alignItems:'center',gap:6}}><Brain size={12}/> Guión X-CARE™</div>
            <div style={{fontSize:13,color:'#c0a0ff',fontStyle:'italic',lineHeight:1.7}}>"{alerta.guion}"</div>
          </div>
        )}
        {!alerta.resuelta&&(
          <div style={{display:'flex',gap:10}}>
            <button onClick={onClose} style={{flex:1,padding:14,borderRadius:12,border:'1px solid #1e1e1e',background:'transparent',color:'#606060',fontSize:13,fontWeight:600,cursor:'pointer'}}>Cerrar</button>
            <button onClick={()=>{onResolve(alerta.id);onClose();}} style={{flex:2,padding:14,borderRadius:12,border:'none',background:`linear-gradient(135deg,${s.color},${s.color}cc)`,color:'#fff',fontSize:14,fontWeight:800,cursor:'pointer',fontFamily:'Syne,sans-serif'}}>✓ Intervenir — Resuelta</button>
          </div>
        )}
      </div>
    </div>
      {/* ══ TAB OH YEAH — CLIENTES EN TIEMPO REAL ══ */}
      {activeTab === 'ohyeah' && (
        <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4">

          {/* Header con stats */}
          <div className="grid grid-cols-4 gap-3">
            {[
              { l:'Total clientes', v:ohyeahClientes.length,                                                    c:'#FFB547' },
              { l:'ÉLITE',          v:ohyeahClientes.filter(c=>c.nivel==='ÉLITE').length,                       c:'#FFD700' },
              { l:'VIP',            v:ohyeahClientes.filter(c=>c.nivel==='VIP').length,                         c:'#B388FF' },
              { l:'Nuevos hoy',     v:ohyeahClientes.filter(c=>c.created_at?.startsWith(new Date().toISOString().split('T')[0])).length, c:'#00E676' },
            ].map(k=>(
              <div key={k.l} className="bg-[#0f0f1a] border rounded-xl p-3 text-center" style={{borderColor:`${k.c}20`}}>
                <div className="text-[9px] text-[#50506A] uppercase mb-1">{k.l}</div>
                <div className="font-['Syne'] text-[22px] font-black" style={{color:k.c}}>{k.v}</div>
              </div>
            ))}
          </div>

          {/* Filtros y búsqueda */}
          <div className="flex gap-3 flex-wrap items-center">
            <div className="flex-1 flex items-center gap-2 bg-[#0f0f1a] border border-white/10 rounded-lg px-3 py-2">
              <span className="text-[12px] text-[#50506A]">🔍</span>
              <input value={busquedaOY} onChange={e=>setBusquedaOY(e.target.value)}
                placeholder="Buscar por nombre, email o ciudad..."
                className="flex-1 bg-transparent text-[12px] text-white outline-none placeholder-[#50506A]"/>
              {busquedaOY && <button onClick={()=>setBusquedaOY('')} className="text-[#50506A] text-[11px]">✕</button>}
            </div>
            <div className="flex gap-2 flex-wrap">
              {['todos','INICIADO','REGULAR','VIP','ÉLITE'].map(n=>{
                const colors: Record<string,string> = {todos:'#606060',INICIADO:'#a0a0a0',REGULAR:'#448AFF',VIP:'#B388FF',ÉLITE:'#FFD700'};
                return (
                  <button key={n} onClick={()=>setFiltroNivel(n)}
                    className="px-3 py-1.5 rounded-full text-[10px] font-bold transition-all"
                    style={{border:`1px solid ${filtroNivel===n?colors[n]:'rgba(255,255,255,0.1)'}`,background:filtroNivel===n?`${colors[n]}15`:'transparent',color:filtroNivel===n?colors[n]:'#606060'}}>
                    {n === 'todos' ? '🔵 Todos' : n}
                  </button>
                );
              })}
            </div>
            <button onClick={fetchOhYeahClientes} className="text-[11px] text-[#50506A] hover:text-white flex items-center gap-1">
              <RefreshCw size={12}/> Actualizar
            </button>
          </div>

          {/* Lista de clientes */}
          {ohyeahLoading ? (
            <div className="text-center py-10 text-[#50506A]">Cargando clientes...</div>
          ) : (
            <div className="flex flex-col gap-3">
              {ohyeahClientes
                .filter(cl => {
                  const busq = busquedaOY.toLowerCase();
                  const matchBusq = !busq || cl.nombre?.toLowerCase().includes(busq) || cl.email?.toLowerCase().includes(busq) || cl.ciudad?.toLowerCase().includes(busq);
                  const matchNivel = filtroNivel === 'todos' || cl.nivel === filtroNivel;
                  return matchBusq && matchNivel;
                })
                .map(cl => {
                  const NIVEL_COLORS: Record<string,string> = {INICIADO:'#a0a0a0',REGULAR:'#448AFF',VIP:'#B388FF',ÉLITE:'#FFD700'};
                  const NIVEL_EMOJI: Record<string,string>  = {INICIADO:'⭐',REGULAR:'🌟',VIP:'💎',ÉLITE:'👑'};
                  const nc = NIVEL_COLORS[cl.nivel] || '#606060';
                  const diasSinVisitar = cl.dias_sin_visitar;
                  return (
                    <div key={cl.id} className="bg-[#0f0f1a] border border-white/7 rounded-xl p-4 hover:border-white/15 transition-all">
                      <div className="flex items-start gap-3">
                        {/* Avatar */}
                        <div className="w-10 h-10 rounded-full flex items-center justify-center text-[16px] font-black shrink-0"
                          style={{background:`${nc}20`,border:`2px solid ${nc}40`,color:nc}}>
                          {cl.nombre?.charAt(0).toUpperCase()}
                        </div>
                        {/* Info principal */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1 flex-wrap">
                            <span className="font-bold text-[13px] text-white">{cl.nombre}</span>
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{background:`${nc}15`,color:nc,border:`1px solid ${nc}30`}}>
                              {NIVEL_EMOJI[cl.nivel]} {cl.nivel}
                            </span>
                            {diasSinVisitar !== null && diasSinVisitar > 30 && (
                              <span className="text-[9px] bg-[#FF5252]/15 text-[#FF5252] border border-[#FF5252]/30 px-2 py-0.5 rounded-full font-bold">
                                ⚠️ {diasSinVisitar}d sin visitar
                              </span>
                            )}
                          </div>
                          <div className="flex gap-4 flex-wrap">
                            {cl.email    && <span className="text-[10px] text-[#50506A]">✉️ {cl.email}</span>}
                            {cl.telefono && <span className="text-[10px] text-[#50506A]">📱 {cl.telefono}</span>}
                            {cl.ciudad   && <span className="text-[10px] text-[#50506A]">📍 {cl.ciudad}</span>}
                          </div>
                        </div>
                        {/* Métricas */}
                        <div className="flex gap-3 shrink-0">
                          {[
                            {l:'Visitas',   v:cl.visitas||0,       c:'#FFB547'},
                            {l:'Puntos',    v:cl.puntos||0,        c:nc},
                            {l:'Reservas',  v:cl.total_reservas||0,c:'#448AFF'},
                          ].map(m=>(
                            <div key={m.l} className="text-center">
                              <div className="font-['Syne'] text-[16px] font-black" style={{color:m.c}}>{m.v}</div>
                              <div className="text-[8px] text-[#50506A]">{m.l}</div>
                            </div>
                          ))}
                        </div>
                      </div>
                      {/* Última visita */}
                      {cl.ultima_reserva && (
                        <div className="mt-2 pt-2 border-t border-white/5 text-[10px] text-[#50506A] flex gap-4">
                          <span>Última reserva: {new Date(cl.ultima_reserva).toLocaleDateString('es-CO',{day:'numeric',month:'short',year:'numeric'})}</span>
                          <span>Login: {new Date(cl.last_login).toLocaleDateString('es-CO',{day:'numeric',month:'short'})}</span>
                        </div>
                      )}
                    </div>
                  );
                })}
              {ohyeahClientes.filter(cl => {
                const busq = busquedaOY.toLowerCase();
                return (!busq || cl.nombre?.toLowerCase().includes(busq) || cl.email?.toLowerCase().includes(busq)) && (filtroNivel==='todos'||cl.nivel===filtroNivel);
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

  );
}

function PanelRespuesta({enc,onClose,onSend}:{enc:Encuesta;onClose:()=>void;onSend:()=>void}) {
  const nombre = enc.cliente.split(' ')[0];
  const [texto,setTexto] = useState(IA_RESPONSES[enc.estrellas]?.replace('[nombre]',nombre)||'');
  const c = starC(enc.estrellas);
  const reg = getRegalo(enc);
  return (
    <div style={{position:'fixed',inset:0,zIndex:1000,background:'rgba(0,0,0,.8)',display:'flex',alignItems:'flex-end',justifyContent:'center'}} onClick={onClose}>
      <div style={{background:'#0d0d0d',border:'1px solid #1e1e1e',borderRadius:'20px 20px 0 0',padding:24,width:'100%',maxWidth:560,maxHeight:'88vh',overflowY:'auto'}} onClick={e=>e.stopPropagation()}>
        <div style={{width:40,height:4,borderRadius:2,background:'#2a2a2a',margin:'0 auto 20px'}}/>
        <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:14}}>
          <div style={{display:'flex',gap:2}}>{[1,2,3,4,5].map(s=><Star key={s} size={16} fill={s<=enc.estrellas?c:'transparent'} color={s<=enc.estrellas?c:'#2a2a2a'}/>)}</div>
          <span style={{fontFamily:'Syne,sans-serif',fontWeight:800,fontSize:15,color:'#f0f0f0',flex:1}}>{enc.cliente}</span>
          <span style={{fontSize:10,color:'#404040'}}>Mesa {enc.mesa}</span>
        </div>
        <div style={{background:'#111',border:'1px solid #1a1a1a',borderRadius:10,padding:12,marginBottom:14,fontSize:13,color:'#808080',fontStyle:'italic',lineHeight:1.6}}>"{enc.comentario}"</div>
        {enc.platos&&enc.estrellas<=3&&(
          <div style={{marginBottom:14}}>
            <div style={{fontSize:10,color:'#606060',fontWeight:700,textTransform:'uppercase',letterSpacing:'1px',marginBottom:8}}>Platos de la visita</div>
            <div style={{display:'flex',gap:6,flexWrap:'wrap'}}>{enc.platos.map(p=><span key={p} style={{padding:'4px 10px',borderRadius:20,fontSize:11,background:'#141414',border:'1px solid #1e1e1e',color:'#808080'}}>{p}</span>)}</div>
          </div>
        )}
        <div style={{display:'flex',gap:5,flexWrap:'wrap',marginBottom:14}}>{enc.tags.map(tag=><span key={tag} style={{padding:'3px 10px',borderRadius:20,fontSize:10,fontWeight:600,background:`${c}12`,color:c,border:`1px solid ${c}25`}}>{tag}</span>)}</div>
        {reg&&(
          <div style={{background:'rgba(155,114,255,.06)',border:'1px solid rgba(155,114,255,.2)',borderRadius:10,padding:12,marginBottom:14}}>
            <div style={{fontSize:10,color:'#9b72ff',fontWeight:700,letterSpacing:'1px',textTransform:'uppercase',marginBottom:4}}>✦ Sugerencia interna — solo gerencia</div>
            <div style={{fontSize:13,color:'#c0a0ff',marginBottom:4}}>{reg}</div>
            <div style={{fontSize:11,color:'#606060'}}>Comunicar como: "Será un placer sorprenderte."</div>
          </div>
        )}
        <div style={{marginBottom:16}}>
          <div style={{fontSize:10,color:'#404040',fontWeight:700,letterSpacing:'1px',textTransform:'uppercase',marginBottom:8,display:'flex',alignItems:'center',gap:6}}><Brain size={12} color="#9b72ff"/> Respuesta X-CARE™ · Nivel Ritz Carlton</div>
          <textarea value={texto} onChange={e=>setTexto(e.target.value)} rows={7} style={{width:'100%',background:'#111',border:'1px solid #1e1e1e',borderRadius:10,padding:14,color:'#d0d0d0',fontSize:13,lineHeight:1.7,outline:'none',resize:'none',fontFamily:'DM Sans,sans-serif',boxSizing:'border-box'}}/>
        </div>
        <div style={{display:'flex',gap:10}}>
          <button onClick={onClose} style={{flex:1,padding:14,borderRadius:12,background:'transparent',border:'1px solid #1e1e1e',color:'#606060',fontSize:13,fontWeight:600,cursor:'pointer'}}>Cancelar</button>
          <button onClick={onSend} style={{flex:2,padding:14,borderRadius:12,border:'none',background:'linear-gradient(135deg,#9b72ff,#7b52df)',color:'#fff',fontSize:14,fontWeight:800,cursor:'pointer',fontFamily:'Syne,sans-serif'}}>📩 Enviar respuesta</button>
        </div>
      </div>
    </div>
      {/* ══ TAB OH YEAH — CLIENTES EN TIEMPO REAL ══ */}
      {activeTab === 'ohyeah' && (
        <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4">

          {/* Header con stats */}
          <div className="grid grid-cols-4 gap-3">
            {[
              { l:'Total clientes', v:ohyeahClientes.length,                                                    c:'#FFB547' },
              { l:'ÉLITE',          v:ohyeahClientes.filter(c=>c.nivel==='ÉLITE').length,                       c:'#FFD700' },
              { l:'VIP',            v:ohyeahClientes.filter(c=>c.nivel==='VIP').length,                         c:'#B388FF' },
              { l:'Nuevos hoy',     v:ohyeahClientes.filter(c=>c.created_at?.startsWith(new Date().toISOString().split('T')[0])).length, c:'#00E676' },
            ].map(k=>(
              <div key={k.l} className="bg-[#0f0f1a] border rounded-xl p-3 text-center" style={{borderColor:`${k.c}20`}}>
                <div className="text-[9px] text-[#50506A] uppercase mb-1">{k.l}</div>
                <div className="font-['Syne'] text-[22px] font-black" style={{color:k.c}}>{k.v}</div>
              </div>
            ))}
          </div>

          {/* Filtros y búsqueda */}
          <div className="flex gap-3 flex-wrap items-center">
            <div className="flex-1 flex items-center gap-2 bg-[#0f0f1a] border border-white/10 rounded-lg px-3 py-2">
              <span className="text-[12px] text-[#50506A]">🔍</span>
              <input value={busquedaOY} onChange={e=>setBusquedaOY(e.target.value)}
                placeholder="Buscar por nombre, email o ciudad..."
                className="flex-1 bg-transparent text-[12px] text-white outline-none placeholder-[#50506A]"/>
              {busquedaOY && <button onClick={()=>setBusquedaOY('')} className="text-[#50506A] text-[11px]">✕</button>}
            </div>
            <div className="flex gap-2 flex-wrap">
              {['todos','INICIADO','REGULAR','VIP','ÉLITE'].map(n=>{
                const colors: Record<string,string> = {todos:'#606060',INICIADO:'#a0a0a0',REGULAR:'#448AFF',VIP:'#B388FF',ÉLITE:'#FFD700'};
                return (
                  <button key={n} onClick={()=>setFiltroNivel(n)}
                    className="px-3 py-1.5 rounded-full text-[10px] font-bold transition-all"
                    style={{border:`1px solid ${filtroNivel===n?colors[n]:'rgba(255,255,255,0.1)'}`,background:filtroNivel===n?`${colors[n]}15`:'transparent',color:filtroNivel===n?colors[n]:'#606060'}}>
                    {n === 'todos' ? '🔵 Todos' : n}
                  </button>
                );
              })}
            </div>
            <button onClick={fetchOhYeahClientes} className="text-[11px] text-[#50506A] hover:text-white flex items-center gap-1">
              <RefreshCw size={12}/> Actualizar
            </button>
          </div>

          {/* Lista de clientes */}
          {ohyeahLoading ? (
            <div className="text-center py-10 text-[#50506A]">Cargando clientes...</div>
          ) : (
            <div className="flex flex-col gap-3">
              {ohyeahClientes
                .filter(cl => {
                  const busq = busquedaOY.toLowerCase();
                  const matchBusq = !busq || cl.nombre?.toLowerCase().includes(busq) || cl.email?.toLowerCase().includes(busq) || cl.ciudad?.toLowerCase().includes(busq);
                  const matchNivel = filtroNivel === 'todos' || cl.nivel === filtroNivel;
                  return matchBusq && matchNivel;
                })
                .map(cl => {
                  const NIVEL_COLORS: Record<string,string> = {INICIADO:'#a0a0a0',REGULAR:'#448AFF',VIP:'#B388FF',ÉLITE:'#FFD700'};
                  const NIVEL_EMOJI: Record<string,string>  = {INICIADO:'⭐',REGULAR:'🌟',VIP:'💎',ÉLITE:'👑'};
                  const nc = NIVEL_COLORS[cl.nivel] || '#606060';
                  const diasSinVisitar = cl.dias_sin_visitar;
                  return (
                    <div key={cl.id} className="bg-[#0f0f1a] border border-white/7 rounded-xl p-4 hover:border-white/15 transition-all">
                      <div className="flex items-start gap-3">
                        {/* Avatar */}
                        <div className="w-10 h-10 rounded-full flex items-center justify-center text-[16px] font-black shrink-0"
                          style={{background:`${nc}20`,border:`2px solid ${nc}40`,color:nc}}>
                          {cl.nombre?.charAt(0).toUpperCase()}
                        </div>
                        {/* Info principal */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1 flex-wrap">
                            <span className="font-bold text-[13px] text-white">{cl.nombre}</span>
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{background:`${nc}15`,color:nc,border:`1px solid ${nc}30`}}>
                              {NIVEL_EMOJI[cl.nivel]} {cl.nivel}
                            </span>
                            {diasSinVisitar !== null && diasSinVisitar > 30 && (
                              <span className="text-[9px] bg-[#FF5252]/15 text-[#FF5252] border border-[#FF5252]/30 px-2 py-0.5 rounded-full font-bold">
                                ⚠️ {diasSinVisitar}d sin visitar
                              </span>
                            )}
                          </div>
                          <div className="flex gap-4 flex-wrap">
                            {cl.email    && <span className="text-[10px] text-[#50506A]">✉️ {cl.email}</span>}
                            {cl.telefono && <span className="text-[10px] text-[#50506A]">📱 {cl.telefono}</span>}
                            {cl.ciudad   && <span className="text-[10px] text-[#50506A]">📍 {cl.ciudad}</span>}
                          </div>
                        </div>
                        {/* Métricas */}
                        <div className="flex gap-3 shrink-0">
                          {[
                            {l:'Visitas',   v:cl.visitas||0,       c:'#FFB547'},
                            {l:'Puntos',    v:cl.puntos||0,        c:nc},
                            {l:'Reservas',  v:cl.total_reservas||0,c:'#448AFF'},
                          ].map(m=>(
                            <div key={m.l} className="text-center">
                              <div className="font-['Syne'] text-[16px] font-black" style={{color:m.c}}>{m.v}</div>
                              <div className="text-[8px] text-[#50506A]">{m.l}</div>
                            </div>
                          ))}
                        </div>
                      </div>
                      {/* Última visita */}
                      {cl.ultima_reserva && (
                        <div className="mt-2 pt-2 border-t border-white/5 text-[10px] text-[#50506A] flex gap-4">
                          <span>Última reserva: {new Date(cl.ultima_reserva).toLocaleDateString('es-CO',{day:'numeric',month:'short',year:'numeric'})}</span>
                          <span>Login: {new Date(cl.last_login).toLocaleDateString('es-CO',{day:'numeric',month:'short'})}</span>
                        </div>
                      )}
                    </div>
                  );
                })}
              {ohyeahClientes.filter(cl => {
                const busq = busquedaOY.toLowerCase();
                return (!busq || cl.nombre?.toLowerCase().includes(busq) || cl.email?.toLowerCase().includes(busq)) && (filtroNivel==='todos'||cl.nivel===filtroNivel);
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

  );
}

// ── INTERFAZ CLIENTE OH YEAH ──────────────────────────────────────
interface OhYeahCliente {
  id: number; nombre: string; email: string; telefono: string;
  ciudad: string; nivel: string; puntos: number; visitas: number;
  last_login: string; created_at: string; notas: string | null;
  tags: string[]; total_reservas: number; ultima_reserva: string | null;
  dias_sin_visitar: number | null;
}

export default function CareModule() {
  const [tab,setTab] = useState<Tab>('live');
  const [alertas,setAlertas]   = useState<Alerta[]>(ALERTAS);
  const [encuestas,setEncuestas] = useState<Encuesta[]>(ENCUESTAS);
  const [loading, setLoading]   = useState(false);

  // Cargar encuestas reales desde Supabase
  // ── FETCH CLIENTES OH YEAH ──────────────────────────────────────
  const fetchOhYeahClientes = useCallback(async () => {
    setOhyeahLoading(true);
    const { data } = await supabase
      .from('nexum_clientes_ohyeah')
      .select('*');
    if (data) setOhyeahClientes(data as OhYeahCliente[]);
    setOhyeahLoading(false);
  }, []);

  useEffect(() => {
    fetchOhYeahClientes();
    // Realtime — nuevo cliente aparece instantáneamente
    const ch = supabase.channel('ohyeah-clientes')
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'ohyeah_clientes'
      }, (payload) => {
        setOhyeahClientes(prev => [payload.new as OhYeahCliente, ...prev]);
      })
      .on('postgres_changes', {
        event: 'UPDATE', schema: 'public', table: 'ohyeah_clientes'
      }, () => { fetchOhYeahClientes(); })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [fetchOhYeahClientes]);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        // Encuestas X-Care
        const { data: enc } = await supabase
          .from('xcare_encuestas')
          .select('*')
          .eq('restaurante_id', 6)
          .order('created_at', { ascending: false })
          .limit(50);

        if (enc && enc.length > 0) {
          const mapped: Encuesta[] = enc.map((e: any) => ({
            id: e.id,
            cliente: e.cliente_nombre || e.nombre_cliente || 'Cliente',
            mesa: e.mesa_num ? `Mesa ${e.mesa_num}` : '—',
            estrellas: e.rating_general || e.estrellas_servicio || 0,
            tags: e.tags || [],
            comentario: e.comentario || '',
            fecha: new Date(e.created_at).toLocaleDateString('es-CO'),
            respondida: !!e.comentario,
            platos: e.platos || [],
          }));
          setEncuestas(mapped);
        }

        // Feedback de servicio como alertas
        const { data: fb } = await supabase
          .from('feedback_servicio')
          .select('*')
          .eq('restaurante_id', 6)
          .eq('tipo', 'alerta')
          .order('created_at', { ascending: false })
          .limit(20);

        if (fb && fb.length > 0) {
          const mapped: Alerta[] = fb.map((f: any, i: number) => ({
            id: f.id,
            mesa: f.mesa_num ? `Mesa ${f.mesa_num}` : '—',
            tipo: 'Feedback servicio',
            icono: '⚠️',
            severidad: 'media' as Severidad,
            tiempo: new Date(f.created_at).toLocaleTimeString('es-CO', { hour:'2-digit', minute:'2-digit' }),
            minutos: 0,
            descripcion: f.comentario,
            ltv: '—',
            resuelta: false,
          }));
          setAlertas(prev => [...mapped, ...prev.slice(0, 10)]);
        }
      } catch(e) { console.error('Care fetch error:', e); }
      setLoading(false);
    };
    fetchData();
  }, []);

  // Guardar encuesta de satisfacción
  const guardarEncuesta = useCallback(async (data: {
    mesa_num: number; cliente_nombre: string; rating: number;
    comentario: string; tags: string[];
  }) => {
    await supabase.from('xcare_encuestas').insert({
      restaurante_id: 6,
      mesa_num: data.mesa_num,
      cliente_nombre: data.cliente_nombre,
      rating_general: data.rating,
      comentario: data.comentario,
      tags: data.tags,
      created_at: new Date().toISOString(),
    });
  }, []);
  const [alertaSel,setAlertaSel] = useState<Alerta|null>(null);
  const [encSel,setEncSel] = useState<Encuesta|null>(null);
  const [filterStars,setFilterStars] = useState<number|null>(null);
  const [dashFilterStars,setDashFilterStars] = useState<number|null>(null);
  const [dashFecha,setDashFecha] = useState<'hoy'|'semana'|'mes'|'personalizado'>('hoy');

  const resolverAlerta = useCallback((id:number)=>{ setAlertas(prev=>prev.map(a=>a.id===id?{...a,resuelta:true}:a)); },[]);
  const enviarRespuesta = useCallback(()=>{ if(!encSel)return; setEncuestas(prev=>prev.map(e=>e.id===encSel.id?{...e,respondida:true}:e)); setEncSel(null); },[encSel]);

  const activas = alertas.filter(a=>!a.resuelta);
  const pendientes = encuestas.filter(e=>!e.respondida);
  const filtradas = filterStars?encuestas.filter(e=>e.estrellas===filterStars):encuestas;
  const promStars = (encuestas.reduce((s,e)=>s+e.estrellas,0)/encuestas.length).toFixed(1);
  const nps = 74;

  const TABS = [
    {id:'live',      icon:Zap,      label:`Live${activas.length>0?' · '+activas.length:''}`},
    {id:'encuestas', icon:Star,     label:`Encuestas${pendientes.length>0?' · '+pendientes.length:''}`},
    {id:'cim',       icon:Brain,    label:'CIM™'},
    {id:'dashboard', icon:BarChart2,label:'Dashboard'},
    {id:'entrenar',  icon:Award,    label:'Entrenar'},
  ] as const;

  return (
    <div style={{minHeight:'100vh',background:'#080808',color:'#f0f0f0',fontFamily:'DM Sans,system-ui,sans-serif'}}>
      {/* HEADER */}
      <div style={{background:'linear-gradient(180deg,#0d0d0d,#080808)',borderBottom:'1px solid #141414',padding:'20px 20px 0',position:'sticky',top:0,zIndex:100}}>
        <div style={{display:'flex',alignItems:'center',gap:12,marginBottom:16}}>
          <div style={{width:38,height:38,borderRadius:10,background:'linear-gradient(135deg,#FF4444,#FF8C42)',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
            <Shield size={20} color="#fff"/>
          </div>
          <div style={{flex:1}}>
            <div style={{fontFamily:'Syne,sans-serif',fontSize:19,fontWeight:900,letterSpacing:'-.3px',lineHeight:1}}>X-CARE™</div>
            <div style={{fontSize:9,color:'#404040',letterSpacing:'1.5px',textTransform:'uppercase',marginTop:2}}>Experience Intelligence Engine · Powered by Nexum</div>
          </div>
          {activas.length>0&&(
            <div style={{display:'flex',alignItems:'center',gap:6,background:'rgba(255,68,68,.1)',border:'1px solid rgba(255,68,68,.3)',borderRadius:20,padding:'5px 12px'}}>
              <div style={{width:6,height:6,borderRadius:'50%',background:'#FF4444',animation:'xpulse 1.5s infinite'}}/>
              <span style={{fontSize:11,fontWeight:700,color:'#FF4444'}}>{activas.length} alerta{activas.length>1?'s':''} activa{activas.length>1?'s':''}</span>
            </div>
          )}
        </div>
        <div style={{display:'flex',gap:2,overflowX:'auto',scrollbarWidth:'none'}}>
          {TABS.map(t=>{
            const active=tab===t.id;
            return (
              <button key={t.id} onClick={()=>setTab(t.id as Tab)} style={{display:'flex',alignItems:'center',gap:5,padding:'10px 16px',borderRadius:'10px 10px 0 0',border:'none',cursor:'pointer',fontSize:12,fontWeight:700,whiteSpace:'nowrap',flexShrink:0,transition:'all .15s',background:active?'#0f0f0f':'transparent',color:active?'#f0f0f0':'#505050',borderBottom:active?'2px solid #FF4444':'2px solid transparent'}}>
                <t.icon size={12} color={active?'#FF4444':'#505050'}/>
                {t.label}
              </button>
            );
          })}
        </div>
      </div>

      <div style={{padding:'16px 16px 80px'}}>

        {/* ── LIVE ─────────────────────────────────────────────────────────── */}
        {tab==='live'&&(
          <>
            <div style={{background:'#0d0d0d',border:'1px solid #141414',borderRadius:14,padding:16,marginBottom:14,display:'flex',gap:0}}>
              {[
                {label:'Resuelto antes salida',val:'94%',color:'#22D07A'},
                {label:'Retención post-fallo',val:'82%',color:'#4A8FD4'},
                {label:'Riesgo review negativa',val:'4.2%',color:'#FF4444'},
              ].map((s,i,arr)=>(
                <div key={i} style={{flex:1,textAlign:'center',padding:'0 12px',borderRight:i<arr.length-1?'1px solid #1a1a1a':'none'}}>
                  <div style={{fontFamily:'Syne,sans-serif',fontSize:22,fontWeight:900,color:s.color}}>{s.val}</div>
                  <div style={{fontSize:9,color:'#404040',fontWeight:700,textTransform:'uppercase',letterSpacing:'.6px',marginTop:4,lineHeight:1.3}}>{s.label}</div>
                </div>
              ))}
            </div>
            {activas.length===0?(
              <div style={{textAlign:'center',padding:48}}>
                <div style={{fontSize:40,marginBottom:12}}>✅</div>
                <div style={{fontFamily:'Syne,sans-serif',fontSize:16,fontWeight:800,color:'#22D07A'}}>Sin alertas activas</div>
                <div style={{fontSize:12,color:'#404040',marginTop:4}}>Todas las mesas en orden</div>
              </div>
            ):(
              <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(300px,1fr))',gap:10}}>
                {alertas.map(a=>{
                  const s=SEV[a.severidad];
                  return (
                    <div key={a.id} style={{background:a.resuelta?'#0a0a0a':s.bg,border:`1px solid ${a.resuelta?'#141414':s.border}`,borderLeft:`3px solid ${a.resuelta?'#1e1e1e':s.color}`,borderRadius:14,padding:18,opacity:a.resuelta?.45:1,transition:'all .2s'}}>
                      <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:12}}>
                        <div style={{fontFamily:'Syne,sans-serif',fontSize:20,fontWeight:900,color:'#f0f0f0',background:'#141414',border:'1px solid #1e1e1e',borderRadius:8,padding:'4px 10px',lineHeight:1}}>{a.mesa}</div>
                        <div style={{flex:1}}>
                          <div style={{fontSize:9,color:s.color,fontWeight:800,textTransform:'uppercase',letterSpacing:'1px'}}>Tipo de alerta</div>
                          <div style={{fontFamily:'Syne,sans-serif',fontSize:14,fontWeight:900,color:'#f0f0f0',marginTop:2}}>{a.tipo}</div>
                        </div>
                        <div style={{padding:'3px 10px',borderRadius:20,fontSize:9,fontWeight:800,background:s.bg,color:s.color,border:`1px solid ${s.border}`}}>{s.label}</div>
                      </div>
                      <div style={{display:'flex',gap:10,marginBottom:12}}>
                        <div style={{display:'flex',alignItems:'center',gap:5,fontSize:12,color:a.resuelta?'#404040':'#808080'}}>
                          <Clock size={12}/>
                          <span style={{fontFamily:'Syne,sans-serif',fontWeight:700,color:a.resuelta?'#404040':s.color}}>{a.tiempo}</span>
                          <span style={{fontSize:10,color:'#404040'}}>en rojo</span>
                        </div>
                        <div style={{marginLeft:'auto',display:'flex',alignItems:'center',gap:5,fontSize:12,color:'#606060'}}>
                          <Users size={12}/>
                          <span>LTV: <strong style={{color:'#d4943a'}}>{a.ltv}</strong></span>
                        </div>
                      </div>
                      {!a.resuelta?(
                        <div style={{display:'flex',gap:8}}>
                          <button onClick={()=>setAlertaSel(a)} style={{flex:1,padding:'9px 0',borderRadius:9,background:'#141414',border:'1px solid #1e1e1e',color:'#a0a0a0',fontSize:12,fontWeight:700,cursor:'pointer'}}>Detalles</button>
                          <button onClick={()=>setAlertaSel(a)} style={{flex:2,padding:'9px 0',borderRadius:9,border:'none',background:`linear-gradient(135deg,${s.color},${s.color}bb)`,color:'#fff',fontSize:12,fontWeight:800,cursor:'pointer',fontFamily:'Syne,sans-serif'}}>⚡ Intervenir ya</button>
                        </div>
                      ):(
                        <div style={{textAlign:'center',fontSize:12,color:'#22D07A',fontWeight:700}}>✓ Resuelta</div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}

        {/* ── ENCUESTAS ─────────────────────────────────────────────────── */}
        {tab==='encuestas'&&(
          <>
            <div style={{display:'flex',gap:8,marginBottom:14,overflowX:'auto',scrollbarWidth:'none'}}>
              {[{label:'Promedio ⭐',val:promStars,color:'#FFB347'},{label:'Hoy',val:'18',color:'#4A8FD4'},{label:'Respondidas',val:`${encuestas.filter(e=>e.respondida).length}`,color:'#22D07A'},{label:'Pendientes',val:`${pendientes.length}`,color:'#FF4444'}].map((k,i)=>(
                <div key={i} style={{background:'#0d0d0d',border:'1px solid #141414',borderRadius:12,padding:'12px 16px',flexShrink:0}}>
                  <div style={{fontFamily:'Syne,sans-serif',fontSize:20,fontWeight:900,color:k.color}}>{k.val}</div>
                  <div style={{fontSize:9,color:'#404040',fontWeight:700,textTransform:'uppercase',letterSpacing:'.6px'}}>{k.label}</div>
                </div>
              ))}
            </div>
            <div style={{display:'flex',gap:6,marginBottom:14,overflowX:'auto',scrollbarWidth:'none'}}>
              {[null,5,4,3,2,1].map(s=>(
                <button key={s??'todas'} onClick={()=>setFilterStars(s)} style={{padding:'6px 14px',borderRadius:20,border:'none',cursor:'pointer',fontSize:12,fontWeight:700,flexShrink:0,background:filterStars===s?(s?starC(s):'#FF4444'):'#141414',color:filterStars===s?(s&&s<=3?'#fff':'#000'):'#606060'}}>
                  {s?'⭐'.repeat(s):'Todas'}
                </button>
              ))}
            </div>
            {filtradas.map(enc=>{
              const c=starC(enc.estrellas);
              return (
                <div key={enc.id} style={{background:'#0d0d0d',border:`1px solid ${enc.respondida?'#141414':c+'25'}`,borderRadius:14,padding:16,marginBottom:10,cursor:enc.respondida?'default':'pointer',opacity:enc.respondida?.6:1}} onClick={()=>!enc.respondida&&setEncSel(enc)}>
                  <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:10}}>
                    <div style={{display:'flex',gap:2}}>{[1,2,3,4,5].map(s=><Star key={s} size={14} fill={s<=enc.estrellas?c:'transparent'} color={s<=enc.estrellas?c:'#2a2a2a'}/>)}</div>
                    <span style={{fontFamily:'Syne,sans-serif',fontSize:13,fontWeight:700,color:'#f0f0f0',flex:1}}>{enc.cliente}</span>
                    <span style={{fontSize:10,color:'#404040'}}>Mesa {enc.mesa}</span>
                    <span style={{padding:'2px 8px',borderRadius:20,fontSize:9,fontWeight:700,background:enc.respondida?'rgba(34,208,122,.1)':`${c}15`,color:enc.respondida?'#22D07A':c}}>{enc.respondida?'✓ Respondida':'Pendiente'}</span>
                  </div>
                  <div style={{display:'flex',gap:5,flexWrap:'wrap',marginBottom:8}}>{enc.tags.map(tag=><span key={tag} style={{padding:'2px 8px',borderRadius:20,fontSize:10,fontWeight:600,background:'#141414',color:'#606060',border:'1px solid #1e1e1e'}}>{tag}</span>)}</div>
                  <div style={{fontSize:12,color:'#606060',fontStyle:'italic',lineHeight:1.5}}>"{enc.comentario}"</div>
                  {!enc.respondida&&<div style={{fontSize:11,color:c,marginTop:8,fontWeight:600}}>Toca para responder con IA →</div>}
                </div>
              );
            })}
          </>
        )}

        {/* ── CIM™ ─────────────────────────────────────────────────────── */}
        {tab==='cim'&&(
          <>
            <div style={{background:'linear-gradient(135deg,#0d0d18,#0a0a14)',border:'1px solid rgba(155,114,255,.2)',borderRadius:16,padding:18,marginBottom:14}}>
              <div style={{fontFamily:'Syne,sans-serif',fontSize:16,fontWeight:900,marginBottom:4}}>CIM™</div>
              <div style={{fontSize:12,color:'#9b72ff',fontWeight:600,marginBottom:8}}>Customer Intelligence Management</div>
              <div style={{fontSize:12,color:'#606060',lineHeight:1.7}}>No es CRM. Es inteligencia emocional acumulada. El host recibe alertas antes de que el cliente llegue a la mesa.</div>
            </div>
            {CLIENTES_CIM.map(cli=>{
              const c=scoreC(cli.score);
              return (
                <div key={cli.id} style={{background:'#0d0d0d',border:`1px solid ${c}18`,borderRadius:14,padding:18,marginBottom:10}}>
                  <div style={{display:'flex',alignItems:'center',gap:12,marginBottom:14}}>
                    <div style={{width:46,height:46,borderRadius:12,background:`${c}15`,border:`1px solid ${c}30`,display:'flex',alignItems:'center',justifyContent:'center',fontFamily:'Syne,sans-serif',fontWeight:900,fontSize:15,color:'#f0f0f0'}}>{cli.iniciales}</div>
                    <div style={{flex:1}}>
                      <div style={{fontWeight:700,fontSize:14,marginBottom:2}}>{cli.nombre}</div>
                      <div style={{fontSize:11,color:'#404040'}}>{cli.visitas} visitas · Ticket {cli.ticket}</div>
                    </div>
                    <div style={{textAlign:'right'}}>
                      <div style={{fontFamily:'Syne,sans-serif',fontSize:22,fontWeight:900,color:c}}>{cli.score}</div>
                      <div style={{fontSize:9,color:'#404040',textTransform:'uppercase'}}>score</div>
                    </div>
                  </div>
                  <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:6,marginBottom:12}}>
                    {[{k:'Mood',v:cli.mood},{k:'Ritmo',v:cli.ritmo},{k:'Propina prom.',v:cli.propina},{k:'Ticket prom.',v:cli.ticket}].map((f,i)=>(
                      <div key={i} style={{background:'#111',borderRadius:8,padding:'8px 10px'}}>
                        <div style={{fontSize:9,color:'#404040',fontWeight:700,textTransform:'uppercase',letterSpacing:'.5px'}}>{f.k}</div>
                        <div style={{fontSize:12,fontWeight:600,color:'#d0d0d0',marginTop:2}}>{f.v}</div>
                      </div>
                    ))}
                  </div>
                  <div style={{display:'flex',gap:5,flexWrap:'wrap',marginBottom:10}}>{cli.preferencias.map(p=><span key={p} style={{padding:'2px 8px',borderRadius:20,fontSize:10,background:`${c}10`,color:c,border:`1px solid ${c}20`}}>{p}</span>)}</div>
                  <div style={{background:`${c}08`,border:`1px solid ${c}20`,borderRadius:8,padding:'8px 12px',fontSize:12,color:c,lineHeight:1.5}}>{cli.alerta}</div>
                  {cli.quejas.length>0&&<div style={{marginTop:10,display:'flex',gap:5,flexWrap:'wrap'}}>{cli.quejas.map(q=><span key={q} style={{padding:'2px 8px',borderRadius:20,fontSize:10,background:'rgba(255,68,68,.08)',color:'#FF6666',border:'1px solid rgba(255,68,68,.2)'}}>{q}</span>)}</div>}
                </div>
              );
            })}
          </>
        )}

        {/* ── DASHBOARD ─────────────────────────────────────────────────── */}
        {tab==='dashboard'&&(
          <>
            {/* Filtros — estrellas y fechas */}
            <div style={{display:'flex',gap:8,marginBottom:14,flexWrap:'wrap',alignItems:'center'}}>
              <div style={{display:'flex',gap:4,background:'#0d0d0d',border:'1px solid #1e1e1e',borderRadius:24,padding:4}}>
                {(['hoy','semana','mes'] as const).map(f=>(
                  <button key={f} onClick={()=>setDashFecha(f)}
                    style={{padding:'5px 14px',borderRadius:20,border:'none',cursor:'pointer',fontSize:11,fontWeight:700,background:dashFecha===f?'#1e1e1e':'transparent',color:dashFecha===f?'#f0f0f0':'#404040',transition:'all .15s'}}>
                    {f==='hoy'?'Hoy':f==='semana'?'Esta semana':'Este mes'}
                  </button>
                ))}
              </div>
              <div style={{display:'flex',gap:4}}>
                {[null,5,4,3,2,1].map(s=>(
                  <button key={s??'t'} onClick={()=>setDashFilterStars(dashFilterStars===s?null:s)}
                    style={{padding:'5px 10px',borderRadius:20,border:'none',cursor:'pointer',fontSize:11,fontWeight:700,background:dashFilterStars===s?(s?starC(s):'#FF4444'):'#141414',color:dashFilterStars===s?(s&&s<=3?'#fff':'#000'):'#606060',transition:'all .15s'}}>
                    {s?'⭐'.repeat(s):'Todas'}
                  </button>
                ))}
              </div>
            </div>
            {/* Badge filtro activo */}
            {(dashFilterStars||dashFecha!=='hoy')&&(
              <div style={{display:'flex',gap:6,marginBottom:10,flexWrap:'wrap'}}>
                {dashFecha!=='hoy'&&<span style={{padding:'3px 10px',borderRadius:20,fontSize:10,fontWeight:700,background:'rgba(74,143,212,.12)',color:'#4A8FD4',border:'1px solid rgba(74,143,212,.25)'}}>📅 {dashFecha==='semana'?'Esta semana':'Este mes'}</span>}
                {dashFilterStars&&<span style={{padding:'3px 10px',borderRadius:20,fontSize:10,fontWeight:700,background:`${starC(dashFilterStars)}12`,color:starC(dashFilterStars),border:`1px solid ${starC(dashFilterStars)}25`}}>{'⭐'.repeat(dashFilterStars)} solamente</span>}
                <button onClick={()=>{setDashFilterStars(null);setDashFecha('hoy');}} style={{padding:'3px 10px',borderRadius:20,fontSize:10,fontWeight:700,background:'#141414',color:'#606060',border:'none',cursor:'pointer'}}>✕ Limpiar</button>
              </div>
            )}
            <div style={{background:'linear-gradient(135deg,#0d0d0d,#111)',border:'1px solid #1e1e1e',borderRadius:16,padding:20,marginBottom:12}}>
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:16}}>
                <div>
                  <div style={{fontSize:10,color:'#404040',fontWeight:700,textTransform:'uppercase',letterSpacing:'1px',marginBottom:6}}>Net Promoter Score</div>
                  <div style={{display:'flex',alignItems:'baseline',gap:10}}>
                    <span style={{fontFamily:'Syne,sans-serif',fontSize:52,fontWeight:900,color:'#22D07A',lineHeight:1}}>{nps}</span>
                    <span style={{fontSize:13,color:'#22D07A',fontWeight:700}}>↑ +8 pts esta semana</span>
                  </div>
                </div>
                <div style={{textAlign:'right'}}>
                  <div style={{fontSize:10,color:'#404040',marginBottom:6}}>⭐ Promedio</div>
                  <div style={{fontFamily:'Syne,sans-serif',fontSize:32,fontWeight:900,color:'#FFB347'}}>{promStars}</div>
                </div>
              </div>
              <div style={{background:'#141414',borderRadius:100,height:8,overflow:'hidden'}}>
                <div style={{width:`${nps}%`,height:'100%',background:'linear-gradient(90deg,#22D07A,#4A8FD4)',borderRadius:100}}/>
              </div>
              <div style={{display:'flex',justifyContent:'space-between',fontSize:9,color:'#303030',marginTop:4}}>
                <span>0 · Crítico</span><span>50 · Bueno</span><span>100 · Elite</span>
              </div>
            </div>
            <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:8,marginBottom:12}}>
              {[{label:'Encuestas hoy',val:'18',sub:'14 completadas',color:'#4A8FD4'},{label:'Riesgo fuga',val:'12%',sub:'−3% vs ayer',color:'#FF4444'},{label:'Recuperaciones',val:'3',sub:'clientes salvados',color:'#22D07A'}].map((k,i)=>(
                <div key={i} style={{background:'#0d0d0d',border:'1px solid #141414',borderRadius:12,padding:14}}>
                  <div style={{fontFamily:'Syne,sans-serif',fontSize:22,fontWeight:900,color:k.color}}>{k.val}</div>
                  <div style={{fontSize:9,color:'#404040',fontWeight:700,textTransform:'uppercase',letterSpacing:'.5px',marginTop:4}}>{k.label}</div>
                  <div style={{fontSize:10,color:'#22D07A',marginTop:4}}>{k.sub}</div>
                </div>
              ))}
            </div>
            <div style={{background:'#0d0d0d',border:'1px solid #141414',borderRadius:14,padding:18,marginBottom:12}}>
              <div style={{fontFamily:'Syne,sans-serif',fontWeight:700,fontSize:14,marginBottom:4}}>⚠ Top quejas recurrentes</div>
              <div style={{fontSize:11,color:'#404040',marginBottom:14}}>Control inmediato gerente · últimos 30 días</div>
              {QUEJAS_TOP.map((q,i)=>(
                <div key={i} style={{marginBottom:12}}>
                  <div style={{display:'flex',justifyContent:'space-between',fontSize:12,marginBottom:5}}>
                    <span style={{color:'#d0d0d0'}}>{q.tag}</span>
                    <span style={{color:q.color,fontWeight:800}}>{q.count}×</span>
                  </div>
                  <div style={{background:'#141414',borderRadius:100,height:5}}>
                    <div style={{width:`${q.pct}%`,height:'100%',background:q.color,borderRadius:100,opacity:.85}}/>
                  </div>
                </div>
              ))}
            </div>
            <div style={{background:'#0d0d0d',border:'1px solid #141414',borderRadius:14,padding:18}}>
              <div style={{fontFamily:'Syne,sans-serif',fontWeight:700,fontSize:14,marginBottom:14}}>📈 Comparativo semanal</div>
              {[{label:'% encuestas completadas',esta:'78%',ant:'71%'},{label:'NPS promedio',esta:'74',ant:'66'},{label:'Tiempo respuesta alerta',esta:'3.2m',ant:'5.1m'},{label:'% riesgo fuga',esta:'12%',ant:'18%'}].map((r,i)=>(
                <div key={i} style={{display:'flex',alignItems:'center',gap:10,padding:'10px 0',borderBottom:i<3?'1px solid #141414':'none'}}>
                  <span style={{flex:1,fontSize:12,color:'#808080'}}>{r.label}</span>
                  <span style={{fontFamily:'Syne,sans-serif',fontSize:14,fontWeight:800,color:'#22D07A'}}>{r.esta}</span>
                  <span style={{fontSize:10,color:'#404040'}}>vs {r.ant}</span>
                  <span style={{fontSize:12,color:'#22D07A'}}>↑</span>
                </div>
              ))}
            </div>
          </>
        )}

        {/* ── ENTRENAR ──────────────────────────────────────────────────── */}
        {tab==='entrenar'&&(
          <>
            <div style={{fontSize:12,color:'#404040',marginBottom:14}}>Entrenamiento automático basado en feedback real de clientes</div>
            <div style={{marginBottom:20}}>
              <div style={{fontSize:11,fontWeight:700,color:'#22D07A',textTransform:'uppercase',letterSpacing:'1px',marginBottom:10}}>✦ Destacados hoy</div>
              {[{quien:'Santiago León · Bartender',msg:'4 clientes destacaron sus cócteles hoy.',sub:'Kimchi Sour y Negroni Seratta — los más mencionados'},{quien:'Mateo Herrera · Mesero Senior',msg:'3 menciones por atención impecable.',sub:'"El mejor servicio que hemos tenido aquí"'}].map((n,i)=>(
                <div key={i} style={{background:'rgba(34,208,122,.04)',border:'1px solid rgba(34,208,122,.15)',borderRadius:12,padding:14,marginBottom:8}}>
                  <div style={{fontWeight:700,fontSize:13,marginBottom:4,color:'#f0f0f0'}}>{n.quien}</div>
                  <div style={{fontSize:13,color:'#d0d0d0',marginBottom:4}}>{n.msg}</div>
                  <div style={{fontSize:11,color:'#22D07A',fontStyle:'italic'}}>{n.sub}</div>
                </div>
              ))}
            </div>
            <div style={{marginBottom:20}}>
              <div style={{fontSize:11,fontWeight:700,color:'#FFB347',textTransform:'uppercase',letterSpacing:'1px',marginBottom:10}}>📋 Micro manuales enviados</div>
              {[{quien:'Santiago León · Bartender',trigger:'🍸 Muy dulce — 2 reportes',color:'#FFB347',pasos:['Ajustar proporción jarabe en Kimchi Sour','Revisar receta estándar vs ejecución actual','Confirmar balance antes de servir']},{quien:'Carlos Méndez · Cocinero',trigger:'🌡 Temperatura — 2 reportes',color:'#FF4444',pasos:['Verificar temperatura de salida en el pase','No dejar platos más de 90 seg bajo lámpara','Comunicar al maître si hay demora en cocina']}].map((m,i)=>(
                <div key={i} style={{background:`${m.color}06`,border:`1px solid ${m.color}20`,borderRadius:12,padding:14,marginBottom:10}}>
                  <div style={{fontWeight:700,fontSize:13,marginBottom:4,color:'#f0f0f0'}}>{m.quien}</div>
                  <div style={{fontSize:11,color:m.color,marginBottom:10,fontWeight:600}}>Trigger: {m.trigger}</div>
                  {m.pasos.map((p,j)=><div key={j} style={{display:'flex',alignItems:'flex-start',gap:8,fontSize:12,color:'#d0d0d0',marginBottom:6}}><span style={{color:m.color,fontWeight:700,flexShrink:0}}>✔</span><span>{p}</span></div>)}
                </div>
              ))}
            </div>
            <div style={{background:'linear-gradient(135deg,#0d0d18,#0a0a14)',border:'1px solid rgba(155,114,255,.2)',borderRadius:14,padding:18}}>
              <div style={{fontSize:11,color:'#9b72ff',fontWeight:700,textTransform:'uppercase',letterSpacing:'1px',marginBottom:14}}>📊 Resumen gerente — hoy</div>
              {[{label:'Alertas enviadas',val:'5',color:'#FF4444'},{label:'Corregidas',val:'3',color:'#22D07A'},{label:'En seguimiento',val:'1',color:'#FFB347'},{label:'Micro manuales',val:'2',color:'#9b72ff'},{label:'Respuestas IA sent.',val:'4',color:'#4A8FD4'}].map((s,i,arr)=>(
                <div key={i} style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'10px 0',borderBottom:i<arr.length-1?'1px solid #141414':'none'}}>
                  <span style={{fontSize:12,color:'#808080'}}>{s.label}</span>
                  <span style={{fontFamily:'Syne,sans-serif',fontSize:18,fontWeight:900,color:s.color}}>{s.val}</span>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {alertaSel&&<PanelAlerta alerta={alertaSel} onClose={()=>setAlertaSel(null)} onResolve={resolverAlerta}/>}
      {encSel&&<PanelRespuesta enc={encSel} onClose={()=>setEncSel(null)} onSend={enviarRespuesta}/>}
      <style>{`@keyframes xpulse{0%,100%{opacity:1}50%{opacity:.35}}`}</style>
    </div>
      {/* ══ TAB OH YEAH — CLIENTES EN TIEMPO REAL ══ */}
      {activeTab === 'ohyeah' && (
        <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4">

          {/* Header con stats */}
          <div className="grid grid-cols-4 gap-3">
            {[
              { l:'Total clientes', v:ohyeahClientes.length,                                                    c:'#FFB547' },
              { l:'ÉLITE',          v:ohyeahClientes.filter(c=>c.nivel==='ÉLITE').length,                       c:'#FFD700' },
              { l:'VIP',            v:ohyeahClientes.filter(c=>c.nivel==='VIP').length,                         c:'#B388FF' },
              { l:'Nuevos hoy',     v:ohyeahClientes.filter(c=>c.created_at?.startsWith(new Date().toISOString().split('T')[0])).length, c:'#00E676' },
            ].map(k=>(
              <div key={k.l} className="bg-[#0f0f1a] border rounded-xl p-3 text-center" style={{borderColor:`${k.c}20`}}>
                <div className="text-[9px] text-[#50506A] uppercase mb-1">{k.l}</div>
                <div className="font-['Syne'] text-[22px] font-black" style={{color:k.c}}>{k.v}</div>
              </div>
            ))}
          </div>

          {/* Filtros y búsqueda */}
          <div className="flex gap-3 flex-wrap items-center">
            <div className="flex-1 flex items-center gap-2 bg-[#0f0f1a] border border-white/10 rounded-lg px-3 py-2">
              <span className="text-[12px] text-[#50506A]">🔍</span>
              <input value={busquedaOY} onChange={e=>setBusquedaOY(e.target.value)}
                placeholder="Buscar por nombre, email o ciudad..."
                className="flex-1 bg-transparent text-[12px] text-white outline-none placeholder-[#50506A]"/>
              {busquedaOY && <button onClick={()=>setBusquedaOY('')} className="text-[#50506A] text-[11px]">✕</button>}
            </div>
            <div className="flex gap-2 flex-wrap">
              {['todos','INICIADO','REGULAR','VIP','ÉLITE'].map(n=>{
                const colors: Record<string,string> = {todos:'#606060',INICIADO:'#a0a0a0',REGULAR:'#448AFF',VIP:'#B388FF',ÉLITE:'#FFD700'};
                return (
                  <button key={n} onClick={()=>setFiltroNivel(n)}
                    className="px-3 py-1.5 rounded-full text-[10px] font-bold transition-all"
                    style={{border:`1px solid ${filtroNivel===n?colors[n]:'rgba(255,255,255,0.1)'}`,background:filtroNivel===n?`${colors[n]}15`:'transparent',color:filtroNivel===n?colors[n]:'#606060'}}>
                    {n === 'todos' ? '🔵 Todos' : n}
                  </button>
                );
              })}
            </div>
            <button onClick={fetchOhYeahClientes} className="text-[11px] text-[#50506A] hover:text-white flex items-center gap-1">
              <RefreshCw size={12}/> Actualizar
            </button>
          </div>

          {/* Lista de clientes */}
          {ohyeahLoading ? (
            <div className="text-center py-10 text-[#50506A]">Cargando clientes...</div>
          ) : (
            <div className="flex flex-col gap-3">
              {ohyeahClientes
                .filter(cl => {
                  const busq = busquedaOY.toLowerCase();
                  const matchBusq = !busq || cl.nombre?.toLowerCase().includes(busq) || cl.email?.toLowerCase().includes(busq) || cl.ciudad?.toLowerCase().includes(busq);
                  const matchNivel = filtroNivel === 'todos' || cl.nivel === filtroNivel;
                  return matchBusq && matchNivel;
                })
                .map(cl => {
                  const NIVEL_COLORS: Record<string,string> = {INICIADO:'#a0a0a0',REGULAR:'#448AFF',VIP:'#B388FF',ÉLITE:'#FFD700'};
                  const NIVEL_EMOJI: Record<string,string>  = {INICIADO:'⭐',REGULAR:'🌟',VIP:'💎',ÉLITE:'👑'};
                  const nc = NIVEL_COLORS[cl.nivel] || '#606060';
                  const diasSinVisitar = cl.dias_sin_visitar;
                  return (
                    <div key={cl.id} className="bg-[#0f0f1a] border border-white/7 rounded-xl p-4 hover:border-white/15 transition-all">
                      <div className="flex items-start gap-3">
                        {/* Avatar */}
                        <div className="w-10 h-10 rounded-full flex items-center justify-center text-[16px] font-black shrink-0"
                          style={{background:`${nc}20`,border:`2px solid ${nc}40`,color:nc}}>
                          {cl.nombre?.charAt(0).toUpperCase()}
                        </div>
                        {/* Info principal */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1 flex-wrap">
                            <span className="font-bold text-[13px] text-white">{cl.nombre}</span>
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{background:`${nc}15`,color:nc,border:`1px solid ${nc}30`}}>
                              {NIVEL_EMOJI[cl.nivel]} {cl.nivel}
                            </span>
                            {diasSinVisitar !== null && diasSinVisitar > 30 && (
                              <span className="text-[9px] bg-[#FF5252]/15 text-[#FF5252] border border-[#FF5252]/30 px-2 py-0.5 rounded-full font-bold">
                                ⚠️ {diasSinVisitar}d sin visitar
                              </span>
                            )}
                          </div>
                          <div className="flex gap-4 flex-wrap">
                            {cl.email    && <span className="text-[10px] text-[#50506A]">✉️ {cl.email}</span>}
                            {cl.telefono && <span className="text-[10px] text-[#50506A]">📱 {cl.telefono}</span>}
                            {cl.ciudad   && <span className="text-[10px] text-[#50506A]">📍 {cl.ciudad}</span>}
                          </div>
                        </div>
                        {/* Métricas */}
                        <div className="flex gap-3 shrink-0">
                          {[
                            {l:'Visitas',   v:cl.visitas||0,       c:'#FFB547'},
                            {l:'Puntos',    v:cl.puntos||0,        c:nc},
                            {l:'Reservas',  v:cl.total_reservas||0,c:'#448AFF'},
                          ].map(m=>(
                            <div key={m.l} className="text-center">
                              <div className="font-['Syne'] text-[16px] font-black" style={{color:m.c}}>{m.v}</div>
                              <div className="text-[8px] text-[#50506A]">{m.l}</div>
                            </div>
                          ))}
                        </div>
                      </div>
                      {/* Última visita */}
                      {cl.ultima_reserva && (
                        <div className="mt-2 pt-2 border-t border-white/5 text-[10px] text-[#50506A] flex gap-4">
                          <span>Última reserva: {new Date(cl.ultima_reserva).toLocaleDateString('es-CO',{day:'numeric',month:'short',year:'numeric'})}</span>
                          <span>Login: {new Date(cl.last_login).toLocaleDateString('es-CO',{day:'numeric',month:'short'})}</span>
                        </div>
                      )}
                    </div>
                  );
                })}
              {ohyeahClientes.filter(cl => {
                const busq = busquedaOY.toLowerCase();
                return (!busq || cl.nombre?.toLowerCase().includes(busq) || cl.email?.toLowerCase().includes(busq)) && (filtroNivel==='todos'||cl.nivel===filtroNivel);
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

  );
}
