import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase.ts';

// ── Tokens ─────────────────────────────────────────────────────────────────
const C = {
  bg:'#06060f', bg2:'#0d0d1a', bg3:'#141425', bg4:'#1c1c30',
  pink:'#FF2D78', pinkD:'#cc2260', pinkG:'rgba(255,45,120,0.15)',
  gold:'#FFB547', green:'#00E676', blue:'#448AFF', purple:'#B388FF',
  red:'#FF5252', cyan:'#22d3ee', t1:'#FFFFFF', t2:'#A0A0C0', t3:'#50507A',
  border:'rgba(255,255,255,0.08)',
};

interface XCareProps {
  orderId?: string;
  mesaNumero?: number;
  nombreCliente?: string;
  platosConsumidos?: string[];
  bebidasConsumidas?: string[];
  onClose: () => void;
  onComplete?: (data:any) => void;
}

const TAGS_5 = [
  {icon:'🍽️',label:'Comida'},
  {icon:'🍸',label:'Cócteles'},
  {icon:'🤵',label:'Servicio'},
  {icon:'👨‍🍳',label:'Chef'},
  {icon:'🎶',label:'Ambiente'},
  {icon:'🕯️',label:'Experiencia'},
];
const TAGS_4 = [
  {icon:'⏱️',label:'Tiempo'},
  {icon:'🌡️',label:'Temperatura'},
  {icon:'🍽️',label:'Sabor'},
  {icon:'🍸',label:'Balance'},
  {icon:'🤵',label:'Atención'},
  {icon:'🎶',label:'Ambiente'},
];
const TAGS_NEG = [
  {icon:'🌡️',label:'Frío'},
  {icon:'⏱️',label:'Demora'},
  {icon:'🧂',label:'Sabor'},
  {icon:'🍸',label:'Muy dulce'},
  {icon:'🍸',label:'Muy fuerte'},
  {icon:'🤵',label:'Atención'},
  {icon:'🎶',label:'Ruido'},
  {icon:'💬',label:'Otro'},
];

const MSG: Record<number,{titulo:string;sub:string}> = {
  5: { titulo:'🔥 Nos encanta saberlo.', sub:'¿Qué fue lo que más destacarías?' },
  4: { titulo:'✨ Gracias.', sub:'¿Qué faltó para que fuera perfecta?' },
  3: { titulo:'🙏 Queremos hacerlo mejor.', sub:'Ayúdanos a entender qué pasó.' },
  2: { titulo:'🙏 Queremos hacerlo mejor.', sub:'Ayúdanos a entender qué pasó.' },
  1: { titulo:'🙏 Queremos hacerlo mejor.', sub:'Ayúdanos a entender qué pasó.' },
};

const RESPUESTAS_IA: Record<number,string> = {
  5: '',
  4: '',
  3: `Hola {{nombre}},\n\nGracias por confiar en nosotros hoy. Hemos revisado cuidadosamente tu experiencia y ya estamos ajustando los detalles que nos compartiste.\n\nTu próxima visita será atendida personalmente con especial cuidado.`,
  2: `Hola {{nombre}},\n\nTu experiencia es importante para nosotros. Nuestro equipo ya está trabajando internamente para que lo ocurrido no vuelva a suceder.\n\nSerá un honor recibirte nuevamente y sorprenderte desde el primer momento.`,
  1: `Hola {{nombre}},\n\nLo que nos compartiste merece toda nuestra atención. Hemos revisado cada detalle y ya tomamos acciones concretas con nuestro equipo.\n\nNos gustaría recibirte nuevamente para ofrecerte una experiencia completamente distinta y personalizada.`,
};

// ── RULETA ─────────────────────────────────────────────────────────────────
function RuletaEstrellas({ value, onChange }: { value:number; onChange:(n:number)=>void }) {
  const [hover, setHover] = useState(0);
  const [animating, setAnimating] = useState(false);
  const [particles, setParticles] = useState<{x:number;y:number;c:string;s:number;id:number}[]>([]);
  const pid = useRef(0);

  const spawnParticles = (n:number) => {
    const colors = [C.gold,'#FFD700','#FFF',C.pink,'#FFB347'];
    const ps = Array.from({length:n*4+8},(_,i)=>({
      x: 50 + (Math.random()-0.5)*60,
      y: 40 + (Math.random()-0.5)*40,
      c: colors[Math.floor(Math.random()*colors.length)],
      s: Math.random()*8+4,
      id: pid.current++,
    }));
    setParticles(ps);
    setTimeout(()=>setParticles([]),1200);
  };

  const handleClick = (n:number) => {
    onChange(n);
    setAnimating(true);
    spawnParticles(n);
    setTimeout(()=>setAnimating(false),600);
  };

  const active = hover || value;
  const starLabels = ['','Muy mala','Mala','Regular','Muy buena','Increíble'];
  const starColors = ['','#FF5252','#FF7043','#FFB547','#69F0AE','#00E676'];

  return (
    <div style={{textAlign:'center',userSelect:'none',position:'relative'}}>
      {/* Glow de fondo */}
      {active > 0 && (
        <div style={{position:'absolute',top:'50%',left:'50%',transform:'translate(-50%,-50%)',width:300,height:300,borderRadius:'50%',background:`radial-gradient(circle,${starColors[active]}15 0%,transparent 70%)`,pointerEvents:'none',transition:'all .4s'}}/>
      )}

      {/* Partículas */}
      {particles.map(p=>(
        <div key={p.id} style={{position:'absolute',left:`${p.x}%`,top:`${p.y}%`,width:p.s,height:p.s,borderRadius:'50%',background:p.c,pointerEvents:'none',animation:'particle 1.2s ease-out forwards',zIndex:10}}>
          <style>{`@keyframes particle{0%{transform:translate(0,0) scale(1);opacity:1}100%{transform:translate(${(Math.random()-0.5)*120}px,${-60-Math.random()*80}px) scale(0);opacity:0}}`}</style>
        </div>
      ))}

      {/* Estrellas */}
      <div style={{display:'flex',justifyContent:'center',gap:12,marginBottom:16,position:'relative',zIndex:5}}>
        {[1,2,3,4,5].map(n=>{
          const filled = n <= active;
          const isHover = n <= hover;
          const sc = starColors[hover||value] || C.gold;
          return (
            <div key={n}
              onClick={()=>handleClick(n)}
              onMouseEnter={()=>setHover(n)}
              onMouseLeave={()=>setHover(0)}
              style={{
                cursor:'pointer',
                fontSize: filled ? 52 : 44,
                filter: filled ? `drop-shadow(0 0 12px ${sc}) drop-shadow(0 0 24px ${sc}80)` : 'grayscale(1) opacity(0.3)',
                transform: filled ? `scale(${n===active&&animating?1.35:1.1}) rotate(${n===active?'8deg':'0deg'})` : 'scale(1)',
                transition: 'all .25s cubic-bezier(.34,1.56,.64,1)',
                display:'inline-block',
              }}>
              ⭐
            </div>
          );
        })}
      </div>

      {/* Label */}
      <div style={{
        height:32,
        display:'flex',alignItems:'center',justifyContent:'center',
        fontSize:16,fontWeight:900,fontFamily:"'Syne',sans-serif",
        color:active?starColors[active]:C.t3,
        transition:'all .3s',
        letterSpacing:'-0.02em',
      }}>
        {active ? starLabels[active] : 'Toca para calificar'}
      </div>
    </div>
  );
}

// ── COMPONENTE PRINCIPAL ────────────────────────────────────────────────────
export default function XCareEncuesta({ orderId, mesaNumero, nombreCliente='', platosConsumidos=[], bebidasConsumidas=[], onClose, onComplete }: XCareProps) {
  const [step, setStep] = useState<'rating'|'tags'|'platos'|'microtags'|'comentario'|'redes'|'done'>('rating');
  const [estrellas, setEstrellas] = useState(0);
  const [tagsSelected, setTagsSelected] = useState<string[]>([]);
  const [platosSelected, setPlatosSelected] = useState<string[]>([]);
  const [microtagsSelected, setMicrotagsSelected] = useState<string[]>([]);
  const [comentario, setComentario] = useState('');
  const [guardando, setGuardando] = useState(false);

  const isPositivo = estrellas === 5;
  const isMedio    = estrellas === 4;
  const isNegativo = estrellas <= 3 && estrellas > 0;

  const toggleTag = (arr:string[], set:React.Dispatch<React.SetStateAction<string[]>>, v:string) => {
    set(p => p.includes(v) ? p.filter(x=>x!==v) : [...p,v]);
  };

  const guardar = async () => {
    setGuardando(true);
    const respIA = RESPUESTAS_IA[estrellas]?.replace('{{nombre}}', nombreCliente.split(' ')[0]||'cliente') || '';
    await supabase.from('xcare_encuestas').insert({
      restaurante_id:6,
      order_id:orderId||null,
      mesa_numero:mesaNumero||null,
      nombre_cliente:nombreCliente||null,
      estrellas,
      tags_positivos:isPositivo||isMedio?tagsSelected:null,
      tags_negativos:isNegativo?[...tagsSelected,...microtagsSelected]:null,
      platos_problema:isNegativo?platosSelected:null,
      comentario:comentario||null,
      nps_score:estrellas===5?10:estrellas===4?8:estrellas===3?6:estrellas===2?3:1,
      alerta_gerente:estrellas<=3,
      respuesta_ia:respIA||null,
    });
    if (estrellas<=3) {
      await supabase.from('xcare_alertas').insert({
        restaurante_id:6, mesa_numero:mesaNumero||null,
        tipo:'encuesta_negativa',
        descripcion:`${nombreCliente||'Cliente'} — ${estrellas}★ — ${tagsSelected.join(', ')||'Sin tags'}`,
        activa:true,
      });
    }
    setGuardando(false);
    setStep(isPositivo?'redes':'done');
    onComplete?.({estrellas,tags:tagsSelected,comentario});
  };

  // ── Pantalla done ────────────────────────────────────────────────────────
  if (step==='done') return (
    <EncuestaShell onClose={onClose}>
      <div style={{textAlign:'center',padding:'20px 0'}}>
        <div style={{fontSize:80,marginBottom:16,animation:'bounceIn .6s ease',filter:`drop-shadow(0 0 30px ${estrellas>=4?C.green:C.gold})`}}>
          {estrellas>=4?'🎉':estrellas===3?'🙏':'💎'}
        </div>
        <style>{`@keyframes bounceIn{0%{transform:scale(0)}60%{transform:scale(1.2)}100%{transform:scale(1)}}`}</style>
        <div style={{fontFamily:"'Syne',sans-serif",fontSize:24,fontWeight:900,marginBottom:8}}>
          {estrellas>=4?'¡Hasta pronto!':estrellas===3?'Gracias por tu honestidad':'Gracias por contarnos'}
        </div>
        <div style={{fontSize:14,color:C.t2,lineHeight:1.6,maxWidth:300,margin:'0 auto',marginBottom:24}}>
          {estrellas>=4?'Fue un placer tenerte. Vuelve pronto.':
           estrellas===3?'Ya estamos trabajando en mejorarlo para tu próxima visita.':
           'Tu voz genera cambios reales en nuestro equipo.'}
        </div>
        {estrellas<=3 && (
          <div style={{background:`${C.purple}15`,border:`1px solid ${C.purple}30`,borderRadius:16,padding:'14px 20px',maxWidth:340,margin:'0 auto',marginBottom:20,fontSize:13,color:C.purple,lineHeight:1.6,textAlign:'left'}}>
            {RESPUESTAS_IA[estrellas]?.replace('{{nombre}}',nombreCliente.split(' ')[0]||'cliente').split('\n').map((l,i)=><div key={i} style={{marginBottom:l?4:0}}>{l}</div>)}
          </div>
        )}
        <button onClick={onClose} style={{padding:'12px 36px',borderRadius:14,border:'none',background:`linear-gradient(135deg,${C.pink},${C.pinkD})`,color:'#fff',fontSize:15,fontWeight:900,cursor:'pointer',fontFamily:"'Syne',sans-serif"}}>
          Cerrar
        </button>
      </div>
    </EncuestaShell>
  );

  // ── Pantalla redes ───────────────────────────────────────────────────────
  if (step==='redes') return (
    <EncuestaShell onClose={onClose}>
      <div style={{textAlign:'center'}}>
        <div style={{fontSize:64,marginBottom:12}}>🌟</div>
        <div style={{fontFamily:"'Syne',sans-serif",fontSize:22,fontWeight:900,marginBottom:8}}>Tu experiencia puede inspirar a otros.</div>
        <div style={{fontSize:13,color:C.t2,marginBottom:28,lineHeight:1.6}}>
          Tu opinión ayuda a que más personas vivan momentos memorables en OMM.
        </div>
        <div style={{display:'flex',flexDirection:'column',gap:10,marginBottom:24}}>
          <a href="https://g.page/r/review" target="_blank"
            style={{display:'block',padding:'14px',borderRadius:14,border:'none',background:'linear-gradient(135deg,#4285F4,#0F9D58)',color:'#fff',fontSize:14,fontWeight:800,cursor:'pointer',textDecoration:'none',fontFamily:"'Syne',sans-serif"}}>
            ⭐ Opinar en Google
          </a>
          <a href="https://tripadvisor.com" target="_blank"
            style={{display:'block',padding:'14px',borderRadius:14,border:'none',background:'linear-gradient(135deg,#00AA6C,#007A4D)',color:'#fff',fontSize:14,fontWeight:800,cursor:'pointer',textDecoration:'none',fontFamily:"'Syne',sans-serif"}}>
            🦉 Opinar en TripAdvisor
          </a>
        </div>
        <button onClick={()=>setStep('done')} style={{background:'none',border:'none',color:C.t3,cursor:'pointer',fontSize:13,textDecoration:'underline'}}>
          Omitir por ahora
        </button>
      </div>
    </EncuestaShell>
  );

  return (
    <EncuestaShell onClose={onClose}>

      {/* PASO 1 — Rating */}
      {step==='rating' && (
        <div>
          <div style={{textAlign:'center',marginBottom:32}}>
            <div style={{fontSize:12,color:C.pink,fontWeight:700,textTransform:'uppercase',letterSpacing:'.15em',marginBottom:12}}>X-CARE™ · Experience Intelligence</div>
            <div style={{fontFamily:"'Syne',sans-serif",fontSize:26,fontWeight:900,marginBottom:6,lineHeight:1.2}}>
              {nombreCliente ? `¿Cómo estuvo tu experiencia${nombreCliente?' '+nombreCliente.split(' ')[0]:''}?` : '¿Cómo se sintió tu experiencia hoy?'}
            </div>
            <div style={{fontSize:13,color:C.t3}}>Tu opinión transforma nuestro servicio</div>
          </div>

          <RuletaEstrellas value={estrellas} onChange={n=>{setEstrellas(n);}} />

          {estrellas > 0 && (
            <div style={{marginTop:28,textAlign:'center',animation:'fadeUp .3s ease'}}>
              <style>{`@keyframes fadeUp{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)}}`}</style>
              <button onClick={()=>setStep('tags')}
                style={{padding:'13px 48px',borderRadius:14,border:'none',background:`linear-gradient(135deg,${C.pink},${C.pinkD})`,color:'#fff',fontSize:15,fontWeight:900,cursor:'pointer',fontFamily:"'Syne',sans-serif",boxShadow:`0 6px 30px ${C.pinkG}`}}>
                Continuar →
              </button>
            </div>
          )}
        </div>
      )}

      {/* PASO 2 — Tags */}
      {step==='tags' && (
        <div>
          <StepHeader estrellas={estrellas} msg={MSG[estrellas]} onBack={()=>{setStep('rating');setTagsSelected([]);}} />
          <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:10,marginBottom:24}}>
            {(isPositivo||isMedio?TAGS_5:TAGS_4).map(t=>{
              const sel = tagsSelected.includes(t.label);
              return (
                <button key={t.label} onClick={()=>toggleTag(tagsSelected,setTagsSelected,t.label)}
                  style={{padding:'14px 8px',borderRadius:14,border:`2px solid ${sel?C.pink:C.border}`,background:sel?`${C.pink}15`:C.bg4,color:sel?C.pink:C.t2,cursor:'pointer',textAlign:'center',transition:'all .2s',fontFamily:"'DM Sans',sans-serif"}}>
                  <div style={{fontSize:28,marginBottom:4}}>{t.icon}</div>
                  <div style={{fontSize:11,fontWeight:700}}>{t.label}</div>
                </button>
              );
            })}
          </div>
          {/* Comentario siempre activo */}
          <textarea style={{background:'rgba(255,255,255,0.05)',border:`1px solid ${C.border}`,borderRadius:12,padding:'12px 14px',color:C.t1,fontSize:13,outline:'none',width:'100%',minHeight:70,resize:'none',marginBottom:16,fontFamily:"'DM Sans',sans-serif"}}
            placeholder="Comentario opcional..." value={comentario} onChange={e=>setComentario(e.target.value)} />
          <div style={{display:'flex',gap:10}}>
            {isNegativo && (platosConsumidos.length > 0 || bebidasConsumidas.length > 0) ? (
              <button onClick={()=>setStep('platos')} disabled={tagsSelected.length===0}
                style={{flex:1,padding:'13px',borderRadius:14,border:'none',background:tagsSelected.length?`linear-gradient(135deg,${C.pink},${C.pinkD})`:`${C.t3}20`,color:'#fff',fontSize:14,fontWeight:900,cursor:tagsSelected.length?'pointer':'not-allowed',fontFamily:"'Syne',sans-serif"}}>
                Siguiente →
              </button>
            ) : (
              <button onClick={guardar} disabled={tagsSelected.length===0||guardando}
                style={{flex:1,padding:'13px',borderRadius:14,border:'none',background:tagsSelected.length?`linear-gradient(135deg,${C.pink},${C.pinkD})`:`${C.t3}20`,color:'#fff',fontSize:14,fontWeight:900,cursor:tagsSelected.length?'pointer':'not-allowed',fontFamily:"'Syne',sans-serif"}}>
                {guardando?'Enviando...':'Enviar ✓'}
              </button>
            )}
          </div>
        </div>
      )}

      {/* PASO 3 — Platos problema (solo negativo) */}
      {step==='platos' && isNegativo && (
        <div>
          <StepHeader estrellas={estrellas} msg={{titulo:'🍽️ ¿Con qué plato o bebida tuviste el problema?',sub:'Toca todo lo que aplique'}} onBack={()=>setStep('tags')} />
          <div style={{display:'flex',flexDirection:'column',gap:8,marginBottom:20}}>
            {[...platosConsumidos,...bebidasConsumidas].map(item=>{
              const sel = platosSelected.includes(item);
              return (
                <button key={item} onClick={()=>toggleTag(platosSelected,setPlatosSelected,item)}
                  style={{padding:'12px 16px',borderRadius:12,border:`2px solid ${sel?C.red:C.border}`,background:sel?`${C.red}15`:C.bg4,color:sel?C.red:C.t2,cursor:'pointer',textAlign:'left',transition:'all .2s',fontSize:13,fontWeight:sel?700:400}}>
                  {sel?'✕ ':''}{item}
                </button>
              );
            })}
          </div>
          <button onClick={()=>setStep('microtags')} disabled={platosSelected.length===0}
            style={{width:'100%',padding:'13px',borderRadius:14,border:'none',background:platosSelected.length?`linear-gradient(135deg,${C.pink},${C.pinkD})`:`${C.t3}20`,color:'#fff',fontSize:14,fontWeight:900,cursor:platosSelected.length?'pointer':'not-allowed',fontFamily:"'Syne',sans-serif"}}>
            Siguiente →
          </button>
        </div>
      )}

      {/* PASO 4 — Micro tags (solo negativo) */}
      {step==='microtags' && isNegativo && (
        <div>
          <StepHeader estrellas={estrellas} msg={{titulo:'¿Qué tipo de problema fue?',sub:'Precisión para mejorar más rápido'}} onBack={()=>setStep('platos')} />
          <div style={{display:'grid',gridTemplateColumns:'repeat(2,1fr)',gap:8,marginBottom:20}}>
            {TAGS_NEG.map(t=>{
              const sel = microtagsSelected.includes(t.label);
              return (
                <button key={t.label} onClick={()=>toggleTag(microtagsSelected,setMicrotagsSelected,t.label)}
                  style={{padding:'12px',borderRadius:12,border:`2px solid ${sel?C.red:C.border}`,background:sel?`${C.red}15`:C.bg4,color:sel?C.red:C.t2,cursor:'pointer',transition:'all .2s',display:'flex',alignItems:'center',gap:8,fontSize:13,fontWeight:sel?700:400}}>
                  <span style={{fontSize:20}}>{t.icon}</span>{t.label}
                </button>
              );
            })}
          </div>
          <textarea style={{background:'rgba(255,255,255,0.05)',border:`1px solid ${C.border}`,borderRadius:12,padding:'12px 14px',color:C.t1,fontSize:13,outline:'none',width:'100%',minHeight:70,resize:'none',marginBottom:14,fontFamily:"'DM Sans',sans-serif"}}
            placeholder="Cuéntanos un poco más..." value={comentario} onChange={e=>setComentario(e.target.value)} />
          <button onClick={guardar} disabled={guardando}
            style={{width:'100%',padding:'13px',borderRadius:14,border:'none',background:`linear-gradient(135deg,${C.pink},${C.pinkD})`,color:'#fff',fontSize:14,fontWeight:900,cursor:'pointer',fontFamily:"'Syne',sans-serif"}}>
            {guardando?'Enviando...':'Enviar ✓'}
          </button>
        </div>
      )}
    </EncuestaShell>
  );
}

// ── Shell modal ─────────────────────────────────────────────────────────────
function EncuestaShell({ children, onClose }: { children:React.ReactNode; onClose:()=>void }) {
  return (
    <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.95)',zIndex:9000,display:'flex',alignItems:'center',justifyContent:'center',padding:20,backdropFilter:'blur(20px)'}}>
      {/* Glow background */}
      <div style={{position:'absolute',top:'30%',left:'50%',transform:'translate(-50%,-50%)',width:500,height:500,borderRadius:'50%',background:`radial-gradient(circle,${C.pinkG} 0%,transparent 70%)`,pointerEvents:'none'}}/>
      <div style={{background:C.bg2,border:`1px solid rgba(255,45,120,0.2)`,borderRadius:28,padding:32,width:'100%',maxWidth:480,maxHeight:'92vh',overflowY:'auto',position:'relative',boxShadow:`0 0 80px rgba(255,45,120,0.15),inset 0 0 40px rgba(255,45,120,0.03)`}}>
        <button onClick={onClose} style={{position:'absolute',top:16,right:16,background:'rgba(255,255,255,0.06)',border:`1px solid ${C.border}`,color:C.t3,width:32,height:32,borderRadius:10,cursor:'pointer',fontSize:16,display:'flex',alignItems:'center',justifyContent:'center'}}>✕</button>
        {/* Logo X-CARE */}
        <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:24}}>
          <div style={{width:32,height:32,borderRadius:10,background:`linear-gradient(135deg,${C.pink},${C.purple})`,display:'flex',alignItems:'center',justifyContent:'center',fontSize:16,boxShadow:`0 0 16px ${C.pinkG}`}}>✦</div>
          <div style={{fontSize:11,fontWeight:900,color:C.pink,letterSpacing:'.15em',textTransform:'uppercase'}}>X-CARE™</div>
        </div>
        {children}
      </div>
    </div>
  );
}

// ── Step header ─────────────────────────────────────────────────────────────
function StepHeader({ estrellas, msg, onBack }:{ estrellas:number; msg:{titulo:string;sub:string}; onBack:()=>void }) {
  const sc = ['','#FF5252','#FF7043','#FFB547','#69F0AE','#00E676'][estrellas];
  return (
    <div style={{marginBottom:24}}>
      <button onClick={onBack} style={{background:'none',border:'none',color:C.t3,cursor:'pointer',fontSize:12,marginBottom:12,padding:0}}>← Volver</button>
      <div style={{display:'flex',gap:6,marginBottom:10}}>
        {[1,2,3,4,5].map(n=>(
          <span key={n} style={{fontSize:20,filter:n<=estrellas?`drop-shadow(0 0 6px ${sc})`:'grayscale(1) opacity(0.3)',transition:'all .2s'}}>{n<=estrellas?'⭐':'☆'}</span>
        ))}
      </div>
      <div style={{fontFamily:"'Syne',sans-serif",fontSize:18,fontWeight:900,marginBottom:4,lineHeight:1.3}}>{msg.titulo}</div>
      <div style={{fontSize:13,color:C.t3}}>{msg.sub}</div>
    </div>
  );
}
