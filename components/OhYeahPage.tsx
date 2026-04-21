// ============================================================
// OH YEAH! — OhYeahPage.tsx
// Refactorizado con diseño completo del HTML original
// Fuentes: Permanent Marker + Montserrat (via @import)
// ============================================================

import React, { useState, useEffect, useRef } from 'react';

interface OhYeahProps {
  onExit?: () => void;
}

// ── Tipos ────────────────────────────────────────────────────
interface Restaurante {
  id: string;
  nombre: string;
  emoji: string;
  tipo: string;
  precio: string;
  estrellas: number;
  badge?: 'top' | 'new' | 'menu' | '';
  descripcion: string;
  seratta: boolean;
  mood: string[];
  categoria: string;
}

// ── Datos mock — en producción viene de Supabase / OhYeahAdmin ──
const RESTAURANTES: Restaurante[] = [
  { id:'1', nombre:'OMM', emoji:'🍣', tipo:'Japonés · Coctelería', precio:'$$$$$', estrellas:5, badge:'top', descripcion:'Ritual gastronómico japonés en el corazón de Bogotá. Robata, makis de autor y cocteles que cuentan historias.', seratta:true, mood:['Romanticón','Impresionar','Algo Diferente'], categoria:'fine-dining' },
  { id:'2', nombre:'SELVATÍCO', emoji:'🍕', tipo:'Italiano · $31k–$50k', precio:'$$$', estrellas:4, badge:'top', descripcion:'Cucina italiana con alma salvaje. Pastas frescas, pizzas de leña y una bodega que te sorprenderá.', seratta:false, mood:['Primera Cita','Con Buena VIBRA!'], categoria:'casual' },
  { id:'3', nombre:'MAREA', emoji:'🦞', tipo:'Cocina de autor · $50k+', precio:'$$$$', estrellas:4, badge:'new', descripcion:'Alta cocina con ingredientes del mar colombiano. El chef lleva la mesa al océano cada noche.', seratta:false, mood:['Impresionar','Romanticón','Algo Diferente'], categoria:'fine-dining' },
  { id:'4', nombre:'KŌBE', emoji:'🥩', tipo:'Carnes · $50k+', precio:'$$$$', estrellas:5, badge:'', descripcion:'Cortes premium y wagyu japonés en un ambiente minimalista. Para los que entienden la carne como arte.', seratta:false, mood:['Celebrar en Grande','Impresionar'], categoria:'fine-dining' },
  { id:'5', nombre:'VERDE', emoji:'🌿', tipo:'Orgánico · $20k–$31k', precio:'$$', estrellas:4, badge:'menu', descripcion:'Cocina de mercado, 100% local y de temporada. Menú que cambia cada semana según la cosecha.', seratta:false, mood:['Algo Diferente','Con Buena VIBRA!'], categoria:'casual' },
  { id:'6', nombre:'BABEL', emoji:'🍸', tipo:'Coctelería · $20k–$31k', precio:'$$', estrellas:4, badge:'', descripcion:'Bar de cocteles de autor con cocina de barra. El lugar donde los sabores se mezclan como idiomas.', seratta:false, mood:['Con Buena VIBRA!','Primera Cita'], categoria:'bar' },
];

const MOODS = [
  { emoji:'💕', label:'Primera Cita', desc:'Ese lugar donde todo importa. Luz correcta. Música correcta. Mesa correcta.' },
  { emoji:'🎉', label:'Celebrar en Grande', desc:'Cumpleaños, ascensos, "me lo merezco". DJ, cocteles protagonistas, energía alta.' },
  { emoji:'⭐', label:'Impresionar', desc:'Socios, clientes, suegros. Diseño wow. Servicio impecable. Tu reputación también se reserva.' },
  { emoji:'🕯️', label:'Romanticón', desc:'Íntimo, sensorial, memorable. Perfecto para aniversarios o "te tengo algo especial".' },
  { emoji:'🔥', label:'Con Buena VIBRA!', desc:'Ambiente animado, risas, barra potente. Plan espontáneo que termina siendo legendario.' },
  { emoji:'✨', label:'Algo Diferente', desc:'Rituales, conceptos únicos, aperturas especiales. Para los que no quieren lo típico.' },
];

const LEVELS = [
  { id:'in', badge:'🏠 INICIADO', color:'#FF007F', bg:'rgba(255,0,127,.12)', border:'rgba(255,0,127,.3)', sub:'Estado automático al registrarse', acceso:['Reservas normales.','Perfil básico.','Registro de experiencia.'], subir:['3 visitas confirmadas','Sin no-shows','Interacción positiva'] },
  { id:'co', badge:'🔥 CONSAGRADO', color:'#FF7A00', bg:'rgba(255,122,0,.12)', border:'rgba(255,122,0,.3)', sub:'Beneficios desbloqueados', acceso:['Promociones privadas.','Early access a eventos.','Newsletter exclusiva Gourmand Society.'], subir:['10 visitas acumuladas','Ticket promedio saludable','Explorar 3+ restaurantes del ecosistema'] },
  { id:'lc', badge:'🔍 LA CRÈME', color:'#7BA4FF', bg:'rgba(123,164,255,.12)', border:'rgba(123,164,255,.3)', sub:'Beneficios desbloqueados', acceso:['Acceso a reservas en horarios estratégicos.','Opciones no visibles al público.','Prioridad en lista de espera.'], subir:['15 visitas acumuladas','Explorar 5+ restaurantes','Participar en 2 eventos del ecosistema'] },
  { id:'ca', badge:'🏆 CATADOR', color:'#C87EFF', bg:'rgba(200,126,255,.12)', border:'rgba(200,126,255,.3)', sub:'Beneficios desbloqueados', acceso:['Acceso a experiencias inéditas.','Pruebas fuera de carta.','Invitaciones a aperturas.'], subir:['20 visitas acumuladas','Ticket premium promedio','Participar en aperturas especiales'] },
  { id:'su', badge:'💫 SUPREMO', color:'#DFFF00', bg:'rgba(223,255,0,.08)', border:'rgba(200,255,0,.3)', sub:'Beneficios desbloqueados', acceso:['Tu noche está diseñada.','La gerencia dejó nota para cuidarte.','Acceso prioritario absoluto.'], subir:['30 visitas acumuladas','Historial impecable','Referidos verificados'] },
];

const FAQS = [
  { q:'¿OH YEAH! es solo para reservar mesa?', a:'No. OH YEAH! no nació para ayudarte a buscar restaurantes. Nació para ayudarte a elegir experiencias. Reservar es una acción logística. Elegir dónde vivir una noche que recuerdes es otra cosa. Aquí seleccionas cómo quieres sentirte — y nosotros conectamos esa intención con el lugar correcto.' },
  { q:'¿Cómo elige OH YEAH! los restaurantes que aparecen aquí?', a:'No todo entra. OH YEAH! funciona como un ecosistema curado. Evaluamos diseño, concepto, energía, consistencia, servicio y capacidad de sorprender. Buscamos lugares que sepan recibir. Que cuiden los detalles. No es cantidad. Es criterio.' },
  { q:'¿Qué es Gourmand Society?', a:'Gourmand Society es nuestro círculo interno. No es un programa de puntos. No es un club de descuentos. Es acceso. Es prioridad. Es reconocimiento. A medida que exploras, reservas y participas, tu nivel evoluciona.' },
  { q:'¿Qué significa "Elige tu Mood"?', a:'Significa que no empiezas por el restaurante. Empiezas por tu intención. ¿Primera cita? ¿Celebrar en grande? ¿Impresionar a alguien importante? Seleccionas cómo quieres que se sienta la noche y el sistema te muestra opciones alineadas contigo.' },
];

type Page = 'home' | 'restaurantes' | 'restaurante' | 'reservar' | 'perfil' | 'faq' | 'terminos';

export default function OhYeahPage({ onExit }: OhYeahProps) {
  const [page, setPage] = useState<Page>('home');
  const [loggedIn, setLoggedIn] = useState(false);
  const [showLogin, setShowLogin] = useState(false);
  const [showSignup, setShowSignup] = useState(false);
  const [showTerms, setShowTerms] = useState(false);
  const [moodOpen, setMoodOpen] = useState(false);
  const [selectedMood, setSelectedMood] = useState('');
  const [selectedRest, setSelectedRest] = useState<Restaurante | null>(null);
  const [toast, setToast] = useState('');
  const [profileTab, setProfileTab] = useState('historial');
  const [filtroTipo, setFiltroTipo] = useState('todos');
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const [openLevel, setOpenLevel] = useState<string | null>('in');
  const [curPos, setCurPos] = useState({ x: -100, y: -100 });
  const [curBig, setCurBig] = useState(false);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(''), 3200);
  };

  // Cursor personalizado
  useEffect(() => {
    const move = (e: MouseEvent) => setCurPos({ x: e.clientX, y: e.clientY });
    window.addEventListener('mousemove', move);
    return () => window.removeEventListener('mousemove', move);
  }, []);

  const restFiltrados = RESTAURANTES.filter(r => {
    if (filtroTipo === 'seratta') return r.seratta;
    if (filtroTipo === 'externos') return !r.seratta;
    if (selectedMood) return r.mood.includes(selectedMood);
    return true;
  });

  const goPage = (p: Page) => { setPage(p); window.scrollTo(0,0); };

  // ── Estilos base ─────────────────────────────────────────
  const css = `
    @import url('https://fonts.googleapis.com/css2?family=Montserrat:ital,wght@0,400;0,700;0,800;0,900;1,400&family=Permanent+Marker&display=swap');
    .oy-root * { box-sizing: border-box; margin: 0; padding: 0; }
    .oy-root { font-family: 'Montserrat', sans-serif; background: #000; color: #fff; min-height: 100vh; cursor: none; overflow-x: hidden; }
    .oy-root a, .oy-root button { font-family: 'Montserrat', sans-serif; cursor: none; }
    .oy-logo { font-family: 'Permanent Marker', cursive; font-size: 34px; line-height: 1; letter-spacing: -1px; display: flex; align-items: baseline; }
    .oy-logo .lo { color: #FF007F; text-shadow: 0 0 20px rgba(255,0,127,.5); }
    .oy-logo .ly { color: #fff; }
    .oy-logo .lx { color: #DFFF00; text-shadow: 0 0 16px rgba(223,255,0,.4); }
    .oy-cursor { width: 15px; height: 15px; background: #DFFF00; border-radius: 50%; position: fixed; pointer-events: none; z-index: 99999; mix-blend-mode: difference; transform: translate(-50%,-50%); transition: width .18s, height .18s; }
    .oy-cursor.big { width: 36px; height: 36px; }
    .oy-rc { flex-shrink: 0; width: 196px; border-radius: 12px; background: #111; overflow: hidden; cursor: none; position: relative; transition: transform .2s, box-shadow .2s; }
    .oy-rc:hover { transform: translateY(-3px); box-shadow: 0 12px 32px rgba(0,0,0,.5); }
    .oy-t10 { flex-shrink: 0; width: 158px; height: 200px; border-radius: 12px; position: relative; overflow: hidden; cursor: none; background: #111; transition: transform .2s; }
    .oy-t10:hover { transform: translateY(-3px); }
    .oy-wc { flex-shrink: 0; width: 280px; border-radius: 12px; background: #111; overflow: hidden; cursor: none; transition: transform .2s; }
    .oy-wc:hover { transform: translateY(-3px); }
    .oy-row { display: flex; gap: 12px; overflow-x: auto; padding-bottom: 6px; }
    .oy-row::-webkit-scrollbar { display: none; }
    .oy-pill { background: #1a1a1a; border: 1px solid #222; border-radius: 24px; padding: 8px 14px; display: flex; align-items: center; gap: 6px; font-size: 12px; cursor: none; white-space: nowrap; flex-shrink: 0; transition: border-color .2s; }
    .oy-pill:hover { border-color: #FF007F; }
    .oy-mi { padding: 13px 17px; display: flex; align-items: flex-start; gap: 13px; border-bottom: 1px solid #1a1a1a; cursor: none; transition: background .15s; }
    .oy-mi:hover { background: #1a1a1a; }
    .oy-overlay { position: fixed; inset: 0; background: rgba(0,0,0,.85); z-index: 1000; display: flex; align-items: center; justify-content: center; padding: 20px; }
    .oy-modal { background: #0a0a0a; border: 1px solid #1a1a1a; border-radius: 20px; padding: 36px; width: 100%; max-width: 460px; position: relative; max-height: 90vh; overflow-y: auto; }
    .oy-fi { background: #111; border: 1px solid #1a1a1a; border-radius: 10px; padding: 12px 16px; color: #fff; font-size: 13px; width: 100%; outline: none; margin-bottom: 12px; }
    .oy-fi::placeholder { color: #666; }
    .oy-fi:focus { border-color: #FF007F; }
    .oy-btn-pk { background: #FF007F; color: #fff; padding: 7px 18px; border-radius: 22px; font-size: 11px; font-weight: 700; letter-spacing: .05em; border: none; transition: box-shadow .15s, transform .15s; }
    .oy-btn-pk:hover { box-shadow: 0 0 24px rgba(255,0,127,.5); transform: scale(1.04); }
    .oy-btn-yw { background: #DFFF00; color: #000; font-size: 12px; font-weight: 800; letter-spacing: .08em; padding: 10px 26px; border-radius: 24px; border: none; transition: box-shadow .2s, transform .15s; }
    .oy-btn-yw:hover { box-shadow: 0 0 24px rgba(223,255,0,.5); transform: scale(1.03); }
    .oy-btn-out { border: 1.5px solid #FF007F; color: #FF007F; padding: 7px 18px; border-radius: 22px; font-size: 11px; font-weight: 700; background: none; transition: all .2s; }
    .oy-btn-out:hover { background: #FF007F; color: #fff; box-shadow: 0 0 20px rgba(255,0,127,.4); }
    .faq-body { display: none; padding: 0 0 16px; font-size: 12px; color: #999; line-height: 1.7; }
    .faq-body.open { display: block; }
    @keyframes oy-float { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-10px)} }
    @keyframes oy-fade { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:translateY(0)} }
  `;

  const NavBar = () => (
    <nav style={{ background:'#000', borderBottom:'1px solid #111', height:56, display:'flex', alignItems:'center', justifyContent:'space-between', padding:'0 28px', position:'sticky', top:33, zIndex:299 }}>
      <div style={{ display:'flex', alignItems:'center', gap:14 }}>
        <div style={{ display:'flex', alignItems:'center', gap:5, fontSize:12, color:'#666', cursor:'none' }}
          onClick={() => showToast('📍 Cambiando ubicación...')}>
          📍 Bogotá ▾
        </div>
        <div className="oy-logo" style={{ cursor:'none' }} onClick={() => goPage('home')}>
          <span className="lo">Oh</span><span className="ly">Yeah</span><span className="lx">!</span>
        </div>
      </div>
      {!loggedIn ? (
        <div style={{ display:'flex', gap:8 }}>
          <button className="oy-btn-out" onClick={() => setShowLogin(true)}>INICIAR SESIÓN</button>
          <button className="oy-btn-pk" style={{ display:'flex', alignItems:'center', gap:6 }} onClick={() => setShowLogin(true)}>🗝 GOURMAND SOCIETY</button>
        </div>
      ) : (
        <div style={{ display:'flex', alignItems:'center', gap:8 }}>
          <button className="oy-btn-pk" style={{ display:'flex', alignItems:'center', gap:6 }} onClick={() => goPage('home')}>🗝 GOURMAND SOCIETY</button>
          {[{ico:'👤', action:()=>goPage('perfil')},{ico:'📅', action:()=>{goPage('perfil');setProfileTab('historial');}},{ico:'🔔', action:()=>{}},{ico:'💎', action:()=>{goPage('perfil');setProfileTab('guardados');}},{ico:'🔍', action:()=>{}}].map((n,i) => (
            <div key={i} onClick={n.action} style={{ width:32, height:32, borderRadius:'50%', border:'1.5px solid #222', display:'flex', alignItems:'center', justifyContent:'center', fontSize:13, cursor:'none', transition:'border-color .2s' }}
              onMouseEnter={e => (e.currentTarget.style.borderColor='#FF007F')}
              onMouseLeave={e => (e.currentTarget.style.borderColor='#222')}>
              {n.ico}
            </div>
          ))}
          {onExit && (
            <button onClick={onExit} style={{ background:'#1a1a1a', border:'1px solid #2a2a2a', color:'#666', padding:'6px 12px', borderRadius:8, fontSize:11, marginLeft:8 }}>
              ← Nexum
            </button>
          )}
        </div>
      )}
    </nav>
  );

  const TopBar = () => (
    <div style={{ background:'#080808', borderBottom:'1px solid #1a1a1a', height:33, display:'flex', alignItems:'center', justifyContent:'space-between', padding:'0 28px', fontSize:11, letterSpacing:'.05em', position:'sticky', top:0, zIndex:300 }}>
      <div style={{ color:'#999' }}>Los mejores restaurantes, eventos y experiencias. <span style={{ color:'#DFFF00', fontWeight:600, cursor:'none' }}>Aquí</span></div>
      <div style={{ display:'flex', gap:16 }}>
        <span style={{ color:'#666', cursor:'none', transition:'color .2s' }} onClick={() => goPage('faq')}
          onMouseEnter={e => (e.currentTarget.style.color='#DFFF00')}
          onMouseLeave={e => (e.currentTarget.style.color='#666')}>
          Preguntas frecuentes
        </span>
        <span style={{ background:'#1a1a1a', border:'1px solid #222', color:'#fff', padding:'3px 8px', borderRadius:4, fontSize:11, fontWeight:600, cursor:'none' }}>ES ▾</span>
      </div>
    </div>
  );

  const Footer = () => (
    <>
      <footer style={{ background:'#0a0a0a', borderTop:'1px solid #111', padding:'40px 28px 20px' }}>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:40, maxWidth:900 }}>
          <div>
            <div className="oy-logo" style={{ fontSize:48, cursor:'none' }}>
              <span className="lo">Oh</span><span className="ly">Yeah</span><span className="lx">!</span>
            </div>
          </div>
          <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
            {['RESTAURANTES AFILIADOS','GOURMAND SOCIETY','REVISTA GOURMAND SOCIETY','TENGO UN RESTAURANTE'].map(l => (
              <span key={l} style={{ fontSize:11, color:'#666', cursor:'none', fontWeight:600, letterSpacing:'.06em', transition:'color .2s' }}
                onMouseEnter={e => (e.currentTarget.style.color='#DFFF00')}
                onMouseLeave={e => (e.currentTarget.style.color='#666')}>
                {l}
              </span>
            ))}
          </div>
          <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
            {['Curaduría','Estatus','Miembro de una sociedad','Memoria viva'].map(l => (
              <span key={l} style={{ fontSize:11, color:'#666', cursor:'none', transition:'color .2s' }}
                onMouseEnter={e => (e.currentTarget.style.color='#fff')}
                onMouseLeave={e => (e.currentTarget.style.color='#666')}>
                {l}
              </span>
            ))}
          </div>
        </div>
      </footer>
      <div style={{ background:'#000', borderTop:'1px solid #111', padding:'12px 28px', display:'flex', gap:24 }}>
        {['Términos y condiciones','Política de datos','Contacto'].map(l => (
          <span key={l} style={{ fontSize:11, color:'#444', cursor:'none', transition:'color .2s' }}
            onClick={() => l === 'Términos y condiciones' && goPage('terminos')}
            onMouseEnter={e => (e.currentTarget.style.color='#fff')}
            onMouseLeave={e => (e.currentTarget.style.color='#444')}>
            {l}
          </span>
        ))}
      </div>
    </>
  );

  const RestCard = ({ r, onClick }: { r: Restaurante; onClick: () => void }) => (
    <div className="oy-rc" onClick={onClick}>
      {r.badge === 'top' && <div style={{ position:'absolute', top:9, left:9, zIndex:5, background:'rgba(8,8,8,.85)', border:'1.5px solid #FF007F', color:'#FF007F', fontFamily:"'Montserrat',sans-serif", fontSize:14, padding:'1px 7px', borderRadius:5, lineHeight:1.4, display:'flex', flexDirection:'column', alignItems:'center' }}><small style={{ fontSize:7, letterSpacing:'.1em' }}>TOP</small>10</div>}
      {r.badge === 'new' && <div style={{ position:'absolute', top:9, left:9, zIndex:5, background:'#DFFF00', color:'#000', fontSize:9, fontWeight:700, padding:'3px 8px', borderRadius:5 }}>RECIÉN AGREGADO</div>}
      {r.badge === 'menu' && <div style={{ position:'absolute', top:9, left:9, zIndex:5, background:'#FF007F', color:'#fff', fontSize:9, fontWeight:700, padding:'3px 8px', borderRadius:5 }}>NUEVO MENÚ</div>}
      <div style={{ width:'100%', height:128, background:'linear-gradient(135deg,#1a1a1a,#111)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:42, position:'relative', overflow:'hidden' }}>
        {r.emoji}
        <div style={{ position:'absolute', inset:0, background:'linear-gradient(to top,rgba(0,0,0,.6) 0%,transparent 50%)' }}/>
      </div>
      <div style={{ padding:'10px 13px 13px' }}>
        <div style={{ fontFamily:"'Montserrat',sans-serif", fontSize:18, fontWeight:900, letterSpacing:'.5px', lineHeight:1.1 }}>{r.nombre}</div>
        <div style={{ display:'flex', alignItems:'center', gap:5, marginTop:3, fontSize:10, color:'#999' }}>
          <span style={{ color:'#DFFF00' }}>{'★'.repeat(r.estrellas)}</span> {r.tipo}
        </div>
      </div>
    </div>
  );

  // ── HOME ─────────────────────────────────────────────────
  if (page === 'home') return (
    <div className="oy-root">
      <style>{css}</style>
      <div className={`oy-cursor${curBig ? ' big' : ''}`} style={{ left: curPos.x, top: curPos.y }} />
      {toast && <div style={{ position:'fixed', bottom:28, right:28, background:'#DFFF00', color:'#000', padding:'14px 24px', borderRadius:12, fontWeight:700, fontSize:14, zIndex:9999, boxShadow:'0 8px 32px rgba(0,0,0,.5)', animation:'oy-fade .3s ease' }}>{toast}</div>}

      <TopBar />
      <NavBar />

      {/* Search bar */}
      <div style={{ background:'#080808', borderBottom:'1px solid #1a1a1a', padding:'10px 28px', display:'flex', alignItems:'center', gap:10, overflowX:'auto' }}>
        {[{icon:'📅', label:'FEB 16'},{icon:'🕐', label:'7:00 PM'},{icon:'👥', label:'2 PERSONAS'}].map(p => (
          <div key={p.label} className="oy-pill" onClick={() => showToast('Próximamente')}
            onMouseEnter={() => setCurBig(true)} onMouseLeave={() => setCurBig(false)}>
            {p.icon} <span style={{ fontWeight:700, color:'#DFFF00', fontSize:13 }}>{p.label}</span>
          </div>
        ))}
        {/* Mood selector */}
        <div style={{ position:'relative', flex:1, minWidth:200 }}>
          <div className="oy-pill" style={{ width:'100%', justifyContent:'space-between' }}
            onClick={() => setMoodOpen(!moodOpen)}
            onMouseEnter={() => setCurBig(true)} onMouseLeave={() => setCurBig(false)}>
            🔍 <span style={{ flex:1 }}>{selectedMood || 'Elige tu mood'}</span> <span style={{ fontSize:10 }}>▾</span>
          </div>
          {moodOpen && (
            <div style={{ position:'absolute', top:'calc(100% + 8px)', left:0, width:380, maxWidth:'95vw', background:'#111', border:'1px solid #1a1a1a', borderRadius:14, overflow:'hidden', zIndex:400 }}>
              {MOODS.map(m => (
                <div key={m.label} className="oy-mi" onClick={() => { setSelectedMood(m.label); setMoodOpen(false); }}
                  onMouseEnter={() => setCurBig(true)} onMouseLeave={() => setCurBig(false)}>
                  <span style={{ fontSize:20, flexShrink:0, marginTop:1 }}>{m.emoji}</span>
                  <div>
                    <h4 style={{ fontSize:13, fontWeight:700, color:'#DFFF00', marginBottom:2 }}>{m.label}</h4>
                    <p style={{ fontSize:11, color:'#999', lineHeight:1.4 }}>{m.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
        <button className="oy-btn-yw" onClick={() => goPage('restaurantes')}
          onMouseEnter={() => setCurBig(true)} onMouseLeave={() => setCurBig(false)}>
          RESERVAR
        </button>
      </div>

      {/* Hero */}
      <div style={{ display:'grid', gridTemplateColumns:'1fr 320px', minHeight:360 }}>
        <div style={{ position:'relative', overflow:'hidden', background:'linear-gradient(150deg,#1A0B0B 0%,#2A1020 40%,#0C1720 100%)', display:'flex', alignItems:'flex-end', padding:'36px 28px' }}>
          <div style={{ position:'absolute', bottom:-80, left:-80, width:400, height:400, borderRadius:'50%', background:'radial-gradient(circle,rgba(255,45,120,.18) 0%,transparent 70%)', pointerEvents:'none' }}/>
          <div style={{ position:'relative', zIndex:2 }}>
            <p style={{ fontSize:32, fontWeight:300, lineHeight:1.15, color:'rgba(255,255,255,.92)' }}>Bienvenido<br/>al mundo de</p>
            <div style={{ display:'flex', alignItems:'center', gap:10, marginTop:10 }}>
              <div style={{ display:'flex' }}>
                <span style={{ width:30, height:30, borderRadius:'50%', background:'#EB001B', marginRight:-10, display:'block' }}/>
                <span style={{ width:30, height:30, borderRadius:'50%', background:'#F79E1B', display:'block' }}/>
              </div>
              <span style={{ fontFamily:"'Montserrat',sans-serif", fontSize:30, letterSpacing:3 }}>priceless</span>
            </div>
          </div>
        </div>
        <div style={{ background:'#080808', borderLeft:'1px solid #1a1a1a', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', padding:'32px 24px', textAlign:'center' }}>
          <span style={{ background:'#FF007F', color:'#fff', fontSize:10, fontWeight:700, letterSpacing:'.1em', padding:'4px 14px', borderRadius:20, marginBottom:18, display:'inline-block' }}>CONCIERGE</span>
          <div style={{ background:'#fff', borderRadius:'18px 18px 18px 4px', padding:'22px 20px', maxWidth:230, boxShadow:'0 8px 32px rgba(0,0,0,.4)' }}>
            <div style={{ width:28, height:28, borderRadius:'50%', background:'#FF007F', margin:'0 auto 10px', display:'flex', alignItems:'center', justifyContent:'center', fontSize:12, color:'#fff' }}>✦</div>
            <h3 style={{ fontFamily:"'Montserrat',sans-serif", fontSize:15, fontWeight:700, color:'#000', lineHeight:1.35 }}>¿Qué estás buscando<br/>ese día de hoy?</h3>
          </div>
          <div style={{ fontSize:60, marginTop:18, animation:'oy-float 3s ease-in-out infinite' }}>🤌</div>
        </div>
      </div>

      {/* Sección: Para tus gustos */}
      <div style={{ padding:'32px 28px 20px' }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-end', marginBottom:18 }}>
          <div>
            <div style={{ fontFamily:"'Montserrat',sans-serif", fontSize:17, fontWeight:800, letterSpacing:'-.3px' }}>Para tus gustos</div>
            <div style={{ fontSize:11, color:'#666', marginTop:3 }}>Curado especialmente para ti</div>
          </div>
          <span style={{ fontSize:12, color:'#FF007F', fontWeight:600, cursor:'none' }} onClick={() => goPage('restaurantes')}>Ver todos →</span>
        </div>
        <div className="oy-row">
          {RESTAURANTES.map(r => (
            <RestCard key={r.id} r={r} onClick={() => { setSelectedRest(r); goPage('restaurante'); }} />
          ))}
        </div>
      </div>

      {/* Top 10 */}
      <div style={{ padding:'16px 28px 20px' }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-end', marginBottom:18 }}>
          <div>
            <div style={{ fontFamily:"'Montserrat',sans-serif", fontSize:17, fontWeight:800 }}>TOP 10</div>
            <div style={{ fontSize:11, color:'#666', marginTop:3 }}>Los más reservados este mes</div>
          </div>
        </div>
        <div style={{ display:'flex', gap:8, overflowX:'auto', paddingBottom:6 }}>
          {RESTAURANTES.concat(RESTAURANTES).slice(0,8).map((r, i) => (
            <div key={i} className="oy-t10" onClick={() => { setSelectedRest(r); goPage('restaurante'); }}>
              <div style={{ fontFamily:"'Montserrat',sans-serif", fontSize:120, color:'#FF007F', position:'absolute', bottom:-22, left:-4, lineHeight:1, zIndex:2, textShadow:'0 0 40px rgba(255,45,120,.4)' }}>{i+1}</div>
              <div style={{ position:'absolute', right:6, top:6, left:'38%', bottom:0, borderRadius:10, overflow:'hidden' }}>
                <div style={{ width:'100%', height:'100%', background:'linear-gradient(135deg,#1a1a1a,#111)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:36 }}>{r.emoji}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* OH YEAH Banner */}
      <div style={{ position:'relative', overflow:'hidden', background:'linear-gradient(135deg,#180010 0%,#2A0020 50%,#180010 100%)', padding:'56px 28px', textAlign:'center', margin:'8px 0' }}>
        <div style={{ position:'absolute', inset:0, background:'radial-gradient(ellipse at 50% 120%,rgba(255,45,120,.25) 0%,transparent 60%)' }}/>
        <div style={{ fontSize:72, display:'flex', justifyContent:'center', marginBottom:10, position:'relative', zIndex:2 }}>🍽️🥂🎭🌙🍾</div>
        <div className="oy-logo" style={{ fontSize:80, justifyContent:'center', position:'relative', zIndex:2 }}>
          <span className="lo">Oh</span><span className="ly">Yeah</span><span className="lx">!</span>
        </div>
      </div>

      {/* Experiencias Privadas */}
      <div style={{ padding:'32px 28px 20px' }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-end', marginBottom:18 }}>
          <div>
            <div style={{ fontFamily:"'Montserrat',sans-serif", fontSize:17, fontWeight:800 }}>Experiencias privadas</div>
            <div style={{ fontSize:11, color:'#666', marginTop:3 }}>Solo para Gourmand Society</div>
          </div>
        </div>
        <div className="oy-row">
          {['🕯️','🌙','🍾','🎭','🌺','🔮'].map((ico, i) => (
            <div key={i} className="oy-wc" onClick={() => showToast('🗝 Acceso exclusivo Gourmand Society')}>
              <div style={{ width:'100%', height:160, background:'linear-gradient(135deg,#1a1a1a,#111)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:52, position:'relative' }}>
                {ico}
                <div style={{ position:'absolute', inset:0, background:'linear-gradient(to top,rgba(0,0,0,.6) 0%,transparent 50%)' }}/>
              </div>
              <div style={{ padding:'12px 14px 14px' }}>
                <div style={{ fontFamily:"'Montserrat',sans-serif", fontSize:24, letterSpacing:1 }}>SELVATÍCO</div>
                <div style={{ fontSize:10, color:'#999', marginTop:2 }}><span style={{ color:'#DFFF00' }}>★★★★</span> Italiano · <span style={{ color:'#DFFF00', fontWeight:700 }}>$$$$$</span></div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* FAQ preview */}
      <div style={{ padding:'32px 28px', background:'#080808' }}>
        <div style={{ marginBottom:24 }}>
          <div style={{ fontFamily:"'Montserrat',sans-serif", fontSize:17, fontWeight:800 }}>Preguntas frecuentes</div>
        </div>
        {FAQS.slice(0,3).map((f, i) => (
          <div key={i} style={{ borderBottom:'1px solid #1a1a1a' }}>
            <div style={{ padding:'15px 0', display:'flex', alignItems:'center', justifyContent:'space-between', cursor:'none', gap:12 }}
              onClick={() => setOpenFaq(openFaq === i ? null : i)}>
              <span style={{ fontSize:13, fontWeight:700 }}>{f.q}</span>
              <span style={{ color:'#666', fontSize:16, transition:'transform .25s', transform: openFaq === i ? 'rotate(180deg)' : 'none', flexShrink:0 }}>▾</span>
            </div>
            {openFaq === i && <div style={{ paddingBottom:16, fontSize:12, color:'#999', lineHeight:1.7 }}>{f.a}</div>}
          </div>
        ))}
      </div>

      <Footer />

      {/* Login Modal */}
      {showLogin && (
        <div className="oy-overlay" onClick={e => e.target === e.currentTarget && setShowLogin(false)}>
          <div className="oy-modal">
            <button style={{ position:'absolute', top:16, right:16, background:'none', border:'none', color:'#666', fontSize:18, cursor:'none' }} onClick={() => setShowLogin(false)}>✕</button>
            <div className="oy-logo" style={{ justifyContent:'center', marginBottom:20 }}><span className="lo">Oh</span><span className="ly">Yeah</span><span className="lx">!</span></div>
            <div style={{ fontSize:20, fontWeight:800, textAlign:'center', marginBottom:6 }}>Bienvenido de vuelta</div>
            <div style={{ fontSize:12, color:'#666', textAlign:'center', marginBottom:24 }}>Inicia sesión para acceder a tu mundo de experiencias</div>
            <input className="oy-fi" placeholder="Correo o celular" />
            <input className="oy-fi" type="password" placeholder="••••••••" />
            <button className="oy-btn-yw" style={{ width:'100%', padding:13, marginBottom:16 }}
              onClick={() => { setLoggedIn(true); setShowLogin(false); showToast('¡Bienvenida, Samantha Leal! 🎉'); goPage('perfil'); }}>
              INICIAR SESIÓN
            </button>
            <div style={{ display:'flex', alignItems:'center', gap:12, margin:'0 0 16px', color:'#444', fontSize:12 }}>
              <div style={{ flex:1, height:1, background:'#1a1a1a' }}/> o <div style={{ flex:1, height:1, background:'#1a1a1a' }}/>
            </div>
            <button className="oy-btn-pk" style={{ width:'100%', padding:13, justifyContent:'center', display:'flex', gap:6 }}
              onClick={() => { setShowLogin(false); setShowSignup(true); }}>
              🗝 Crear cuenta en Gourmand Society
            </button>
            <div style={{ textAlign:'center', marginTop:14, fontSize:12, color:'#666' }}>
              ¿No tienes cuenta? <span style={{ color:'#FF007F', cursor:'none' }} onClick={() => { setShowLogin(false); setShowSignup(true); }}>Regístrate</span>
            </div>
          </div>
        </div>
      )}

      {/* Signup Modal */}
      {showSignup && (
        <div className="oy-overlay" onClick={e => e.target === e.currentTarget && setShowSignup(false)}>
          <div className="oy-modal" style={{ maxWidth:560 }}>
            <button style={{ position:'absolute', top:16, right:16, background:'none', border:'none', color:'#666', fontSize:18, cursor:'none' }} onClick={() => setShowSignup(false)}>✕</button>
            <div style={{ fontSize:20, fontWeight:800, marginBottom:6 }}>Crear cuenta</div>
            <div style={{ fontSize:12, color:'#666', marginBottom:20 }}>La información que ingreses aquí se compartirá con los restaurantes cuando hagas una reservación.</div>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, marginBottom:0 }}>
              <input className="oy-fi" placeholder="Nombre" style={{ marginBottom:0 }}/>
              <input className="oy-fi" placeholder="Apellidos" style={{ marginBottom:0 }}/>
            </div>
            <input className="oy-fi" placeholder="Restricciones alimentarias" style={{ marginTop:12 }}/>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
              <input className="oy-fi" placeholder="Correo" style={{ marginBottom:0 }}/>
              <input className="oy-fi" placeholder="Teléfono" style={{ marginBottom:0 }}/>
            </div>
            <select className="oy-fi" style={{ marginTop:12 }}>
              <option>Elige tu ubicación principal</option>
              <option>Bogotá</option><option>Medellín</option><option>Cali</option><option>Cartagena</option>
            </select>
            <button className="oy-btn-yw" style={{ width:'100%', padding:13, marginTop:8 }}
              onClick={() => { setShowSignup(false); setShowTerms(true); }}>
              CREAR CUENTA
            </button>
            <div style={{ textAlign:'center', marginTop:12, fontSize:11, color:'#444', lineHeight:1.6 }}>
              Al seleccionar <strong style={{ color:'#fff' }}>"Crear una cuenta"</strong>, aceptas los <span style={{ color:'#FF007F' }}>Términos de uso</span> y la <span style={{ color:'#FF007F' }}>Política de privacidad</span>
            </div>
          </div>
        </div>
      )}

      {/* Terms Modal */}
      {showTerms && (
        <div className="oy-overlay" onClick={e => e.target === e.currentTarget && setShowTerms(false)}>
          <div className="oy-modal" style={{ maxWidth:480, padding:0, overflow:'hidden' }}>
            <button style={{ position:'absolute', top:10, right:10, background:'rgba(0,0,0,.3)', border:'none', color:'#fff', fontSize:16, zIndex:5, cursor:'none', borderRadius:'50%', width:28, height:28 }} onClick={() => setShowTerms(false)}>✕</button>
            <div style={{ padding:'32px 28px 24px', borderBottom:'1px solid #1a1a1a' }}>
              <div className="oy-logo" style={{ justifyContent:'center', marginBottom:12 }}><span className="lo">Oh</span><span className="ly">Yeah</span><span className="lx">!</span></div>
              <div style={{ fontSize:12, color:'#666', textAlign:'center', marginBottom:16 }}>Personaliza tu experiencia y reconoce tu relación con nuestros venues.</div>
              <div style={{ fontSize:12, color:'#999', lineHeight:1.75, marginBottom:16 }}>
                <p>Al continuar aceptas:</p><br/>
                <p>* Los Términos y Condiciones y la Política de Tratamiento de Datos</p>
                <p>* El tratamiento de tus datos para personalización y análisis interno</p>
                <p>* Que el estatus dentro de Gourmand Society es dinámico y no constituye un derecho adquirido</p>
              </div>
              <div style={{ fontSize:13, fontStyle:'italic', color:'#666', textAlign:'center', marginBottom:20 }}>Nuestros venues recuerdan a quienes saben vivirlos.</div>
            </div>
            <div style={{ padding:'20px 28px' }}>
              <button style={{ width:'100%', padding:14, border:'2px solid #DFFF00', color:'#DFFF00', background:'none', borderRadius:9, fontSize:13, fontWeight:700, letterSpacing:'.05em', cursor:'none', transition:'all .2s' }}
                onMouseEnter={e => { e.currentTarget.style.background='#fff'; e.currentTarget.style.color='#000'; }}
                onMouseLeave={e => { e.currentTarget.style.background='none'; e.currentTarget.style.color='#DFFF00'; }}
                onClick={() => { setShowTerms(false); setLoggedIn(true); showToast('¡Bienvenida a Gourmand Society! 🗝'); goPage('perfil'); }}>
                [ ACEPTAR TÉRMINOS Y CONTINUAR ]
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  // ── RESTAURANTES ─────────────────────────────────────────
  if (page === 'restaurantes') return (
    <div className="oy-root">
      <style>{css}</style>
      <div className={`oy-cursor${curBig ? ' big' : ''}`} style={{ left: curPos.x, top: curPos.y }} />
      {toast && <div style={{ position:'fixed', bottom:28, right:28, background:'#DFFF00', color:'#000', padding:'14px 24px', borderRadius:12, fontWeight:700, fontSize:14, zIndex:9999 }}>{toast}</div>}
      <TopBar />
      <NavBar />
      <div style={{ padding:'28px 28px 0' }}>
        <div style={{ fontFamily:"'Montserrat',sans-serif", fontSize:28, fontWeight:900, letterSpacing:'-.5px', marginBottom:20 }}>
          {selectedMood ? `${selectedMood}` : 'Todos los restaurantes'}
        </div>
        {/* Filtros */}
        <div style={{ display:'flex', gap:10, marginBottom:24, flexWrap:'wrap' }}>
          {[{id:'todos',label:'Todos'},{id:'seratta',label:'🏠 Seratta'},{id:'externos',label:'🌐 Externos'},{id:'fine-dining',label:'Fine Dining'},{id:'casual',label:'Casual'},{id:'bar',label:'Bar'}].map(f => (
            <button key={f.id}
              onClick={() => { setFiltroTipo(f.id); setSelectedMood(''); }}
              style={{ padding:'8px 16px', borderRadius:24, border:`1px solid ${filtroTipo === f.id ? '#FF007F' : '#222'}`, background: filtroTipo === f.id ? 'rgba(255,0,127,.12)' : 'transparent', color: filtroTipo === f.id ? '#FF007F' : '#666', fontSize:12, fontWeight:700, cursor:'none', transition:'all .2s' }}>
              {f.label}
            </button>
          ))}
        </div>
        {/* Grid */}
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(196px, 1fr))', gap:16, paddingBottom:40 }}>
          {restFiltrados.map(r => (
            <RestCard key={r.id} r={r} onClick={() => { setSelectedRest(r); goPage('restaurante'); }} />
          ))}
        </div>
      </div>
      <Footer />
    </div>
  );

  // ── RESTAURANTE DETALLE ───────────────────────────────────
  if (page === 'restaurante' && selectedRest) return (
    <div className="oy-root">
      <style>{css}</style>
      <div className={`oy-cursor${curBig ? ' big' : ''}`} style={{ left: curPos.x, top: curPos.y }} />
      {toast && <div style={{ position:'fixed', bottom:28, right:28, background:'#DFFF00', color:'#000', padding:'14px 24px', borderRadius:12, fontWeight:700, fontSize:14, zIndex:9999 }}>{toast}</div>}
      <TopBar />
      <NavBar />
      <div style={{ padding:'0 28px 40px' }}>
        {/* Header restaurante */}
        <div style={{ position:'relative', height:300, background:'linear-gradient(135deg,#1a1a1a,#111)', borderRadius:'0 0 20px 20px', overflow:'hidden', display:'flex', alignItems:'center', justifyContent:'center', fontSize:100, marginBottom:32 }}>
          {selectedRest.emoji}
          <div style={{ position:'absolute', inset:0, background:'linear-gradient(to top,rgba(0,0,0,.8) 0%,transparent 50%)' }}/>
          <div style={{ position:'absolute', bottom:24, left:28, right:28 }}>
            <div style={{ fontFamily:"'Montserrat',sans-serif", fontSize:40, fontWeight:900, letterSpacing:1 }}>{selectedRest.nombre}</div>
            <div style={{ fontSize:13, color:'#999', marginTop:4 }}>
              <span style={{ color:'#DFFF00' }}>{'★'.repeat(selectedRest.estrellas)}</span> {selectedRest.tipo} · {selectedRest.precio}
              {selectedRest.seratta && <span style={{ marginLeft:12, background:'rgba(255,0,127,.2)', color:'#FF007F', padding:'2px 8px', borderRadius:12, fontSize:10, fontWeight:700 }}>SERATTA</span>}
            </div>
          </div>
        </div>

        <div style={{ display:'grid', gridTemplateColumns:'1fr 320px', gap:32 }}>
          <div>
            <p style={{ fontSize:15, color:'#ccc', lineHeight:1.7, marginBottom:24 }}>{selectedRest.descripcion}</p>
            {/* Tabs */}
            <div style={{ display:'flex', gap:0, borderBottom:'1px solid #1a1a1a', marginBottom:24 }}>
              {['MENÚ','EVENTOS','FOTOS','RESEÑAS'].map(t => (
                <button key={t} style={{ padding:'12px 20px', background:'none', border:'none', fontSize:12, fontWeight:700, letterSpacing:'.06em', cursor:'pointer', borderBottom: t === 'MENÚ' ? '2px solid #FF007F' : '2px solid transparent', color: t === 'MENÚ' ? '#fff' : '#666' }}>{t}</button>
              ))}
            </div>
            <div style={{ background:'#080808', borderRadius:14, padding:24, textAlign:'center' }}>
              <div style={{ fontSize:48, marginBottom:12 }}>🍽️</div>
              <div style={{ fontSize:14, fontWeight:700, color:'#999' }}>Menú disponible próximamente</div>
              <div style={{ fontSize:12, color:'#444', marginTop:8 }}>Conéctalo desde el módulo Admin de Oh Yeah en Nexum</div>
            </div>
          </div>

          {/* Panel reserva */}
          <div>
            <div style={{ background:'#080808', border:'1px solid #1a1a1a', borderRadius:16, padding:24, position:'sticky', top:100 }}>
              <div style={{ fontSize:16, fontWeight:800, marginBottom:20 }}>Hacer una reserva</div>
              <input className="oy-fi" placeholder="📅 Fecha" />
              <input className="oy-fi" placeholder="🕐 Hora" />
              <input className="oy-fi" placeholder="👥 Personas" />
              <select className="oy-fi">
                <option>🔍 Elige tu mood</option>
                {MOODS.map(m => <option key={m.label}>{m.emoji} {m.label}</option>)}
              </select>
              <button className="oy-btn-yw" style={{ width:'100%', padding:13, marginTop:4 }}
                onClick={() => { showToast('¡Reservación confirmada! 🎉'); goPage('perfil'); setProfileTab('historial'); }}>
                RESERVAR AHORA
              </button>
              <div style={{ textAlign:'center', marginTop:12, fontSize:11, color:'#444' }}>Confirmación inmediata · Sin cargos adicionales</div>
            </div>
          </div>
        </div>
      </div>
      <Footer />
    </div>
  );

  // ── PERFIL ────────────────────────────────────────────────
  if (page === 'perfil') return (
    <div className="oy-root">
      <style>{css}</style>
      <div className={`oy-cursor${curBig ? ' big' : ''}`} style={{ left: curPos.x, top: curPos.y }} />
      {toast && <div style={{ position:'fixed', bottom:28, right:28, background:'#DFFF00', color:'#000', padding:'14px 24px', borderRadius:12, fontWeight:700, fontSize:14, zIndex:9999 }}>{toast}</div>}
      <TopBar />
      <NavBar />

      {/* Header perfil */}
      <div style={{ padding:'30px 28px 22px' }}>
        <div style={{ display:'flex', alignItems:'center', gap:18 }}>
          <div style={{ width:82, height:82, borderRadius:'50%', background:'#DFFF00', flexShrink:0, display:'flex', alignItems:'center', justifyContent:'center', fontSize:28, fontWeight:800, color:'#000', position:'relative' }}>
            SL
            <div style={{ position:'absolute', bottom:2, right:2, width:24, height:24, borderRadius:'50%', background:'#1a1a1a', border:'1.5px solid #222', display:'flex', alignItems:'center', justifyContent:'center', fontSize:11, cursor:'none' }}>📷</div>
          </div>
          <div>
            <div style={{ fontFamily:"'Montserrat',sans-serif", fontSize:22, fontWeight:800, letterSpacing:'.02em', lineHeight:1.1 }}>Samantha Leal</div>
            <div style={{ fontSize:12, color:'#666', marginTop:3 }}>Miembro desde febrero 2026</div>
            <div style={{ display:'inline-flex', alignItems:'center', gap:7, padding:'5px 14px', borderRadius:24, fontSize:11, fontWeight:700, letterSpacing:'.05em', marginTop:10, background:'rgba(255,0,127,.12)', color:'#FF007F', border:'1px solid rgba(255,0,127,.35)' }}>
              🏠 INICIADO
            </div>
          </div>
        </div>
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'220px 1fr' }}>
        {/* Sidebar perfil */}
        <div style={{ borderRight:'1px solid #111', padding:'22px 0', minHeight:500 }}>
          {[{id:'historial',label:'HISTORIAL'},{id:'guardados',label:'GUARDADOS'},{id:'beneficios',label:'BENEFICIOS'},{id:'gourmand',label:'GOURMAND SOCIETY'},{id:'pagos',label:'MÉTODOS DE PAGO'}].map(m => (
            <div key={m.id} onClick={() => setProfileTab(m.id)}
              style={{ display:'block', padding:'10px 28px', fontSize:11, fontWeight:700, letterSpacing:'.08em', color: profileTab === m.id ? '#DFFF00' : '#666', cursor:'none', transition:'color .2s, background .2s', background: profileTab === m.id ? '#111' : 'transparent', borderRight: profileTab === m.id ? '2px solid #DFFF00' : '2px solid transparent', borderBottom:'1px solid #080808' }}>
              {m.label}
            </div>
          ))}
        </div>

        {/* Contenido perfil */}
        <div style={{ padding:'26px 28px', minHeight:500 }}>
          {profileTab === 'historial' && (
            <div style={{ background:'#0a0a0a', borderRadius:14, padding:32, textAlign:'center' }}>
              <h3 style={{ fontSize:14, color:'#999', marginBottom:20 }}>Aún no tienes reservaciones confirmadas</h3>
              <div style={{ display:'flex', gap:8, justifyContent:'center', flexWrap:'wrap', marginBottom:16 }}>
                {MOODS.slice(0,4).map(m => (
                  <button key={m.label} className="oy-btn-out" style={{ fontSize:11 }} onClick={() => goPage('restaurantes')}>{m.emoji} {m.label}</button>
                ))}
              </div>
              <button className="oy-btn-yw" onClick={() => goPage('restaurantes')}>EXPLORAR RESTAURANTES</button>
            </div>
          )}

          {profileTab === 'gourmand' && (
            <div>
              <div style={{ background:'#FF007F', borderRadius:10, padding:'14px 20px', textAlign:'center', fontFamily:"'Montserrat',sans-serif", fontSize:15, fontWeight:700, color:'#DFFF00', marginBottom:18 }}>GOURMAND SOCIETY 🗝</div>
              <div style={{ marginBottom:20 }}>
                {LEVELS.map(lv => (
                  <div key={lv.id} style={{ borderBottom:'1px solid #1a1a1a' }}>
                    <div style={{ padding:'15px 0', display:'flex', alignItems:'center', gap:12, cursor:'none' }} onClick={() => setOpenLevel(openLevel === lv.id ? null : lv.id)}>
                      <div style={{ padding:'5px 14px', borderRadius:22, fontSize:11, fontWeight:700, letterSpacing:'.05em', background:lv.bg, color:lv.color, border:`1px solid ${lv.border}`, flexShrink:0 }}>{lv.badge}</div>
                      <div style={{ fontSize:11, color:'#666' }}>{lv.sub}</div>
                      <div style={{ marginLeft:'auto', color:'#666', fontSize:16, transition:'transform .25s', transform: openLevel === lv.id ? 'rotate(180deg)' : 'none', flexShrink:0 }}>▾</div>
                    </div>
                    {openLevel === lv.id && (
                      <div style={{ paddingBottom:18 }}>
                        <div style={{ marginBottom:12 }}>
                          <div style={{ fontSize:10, fontWeight:700, letterSpacing:'.08em', color:'#7BA4FF', marginBottom:8 }}>ACCESO:</div>
                          <div style={{ borderRadius:9, padding:'12px 15px', fontSize:12, lineHeight:1.65, background:'rgba(123,164,255,.1)', color:'#7BA4FF' }}>{lv.acceso.join('\n')}</div>
                        </div>
                        <div>
                          <div style={{ fontSize:10, fontWeight:700, letterSpacing:'.08em', color:'#FF007F', marginBottom:8 }}>PARA SUBIR:</div>
                          <div style={{ borderRadius:9, padding:'12px 15px', fontSize:12, lineHeight:1.65, background:'rgba(255,45,120,.08)', color:'rgba(255,45,120,.9)' }}>{lv.subir.join('\n')}</div>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {profileTab === 'pagos' && (
            <div style={{ background:'#0a0a0a', borderRadius:14, padding:36, textAlign:'center' }}>
              <h3 style={{ fontSize:16, fontWeight:700, color:'#DFFF00', marginBottom:10 }}>No has agregado métodos de pago</h3>
              <p style={{ fontSize:13, color:'#999', lineHeight:1.6, marginBottom:20 }}>Agrega tarjetas a tu cuenta para confirmar las reservaciones y para pagar más rápido.</p>
              <button className="oy-btn-yw" style={{ padding:'11px 28px' }} onClick={() => showToast('Próximamente 💳')}>+ AGREGAR TARJETA</button>
            </div>
          )}

          {(profileTab === 'guardados' || profileTab === 'beneficios') && (
            <div style={{ background:'#0a0a0a', borderRadius:14, padding:32, textAlign:'center' }}>
              <div style={{ fontSize:48, marginBottom:16 }}>{profileTab === 'guardados' ? '💎' : '🗝'}</div>
              <h3 style={{ fontSize:14, color:'#999' }}>Próximamente</h3>
            </div>
          )}
        </div>
      </div>
      <Footer />
    </div>
  );

  // ── FAQ ───────────────────────────────────────────────────
  if (page === 'faq') return (
    <div className="oy-root">
      <style>{css}</style>
      <div className={`oy-cursor${curBig ? ' big' : ''}`} style={{ left: curPos.x, top: curPos.y }} />
      <TopBar />
      <NavBar />
      <div style={{ padding:'48px 28px', flex:1 }}>
        <h1 style={{ fontFamily:"'Montserrat',sans-serif", fontSize:44, fontWeight:900, letterSpacing:2, color:'#DFFF00', marginBottom:8 }}>PREGUNTAS FRECUENTES</h1>
        <div style={{ marginTop:24 }}>
          {FAQS.map((f, i) => (
            <div key={i} style={{ borderBottom:'1px solid #1a1a1a' }}>
              <div style={{ padding:'15px 0', display:'flex', alignItems:'center', justifyContent:'space-between', cursor:'none', gap:12 }}
                onClick={() => setOpenFaq(openFaq === i ? null : i)}>
                <span style={{ fontSize:14, fontWeight:700 }}>{f.q}</span>
                <span style={{ color:'#666', fontSize:16, transition:'transform .25s', transform: openFaq === i ? 'rotate(180deg)' : 'none', flexShrink:0 }}>▾</span>
              </div>
              {openFaq === i && <div style={{ paddingBottom:20, fontSize:13, color:'#999', lineHeight:1.75 }}>{f.a}</div>}
            </div>
          ))}
        </div>
      </div>
      <Footer />
    </div>
  );

  // ── TÉRMINOS ──────────────────────────────────────────────
  if (page === 'terminos') return (
    <div className="oy-root">
      <style>{css}</style>
      <div className={`oy-cursor${curBig ? ' big' : ''}`} style={{ left: curPos.x, top: curPos.y }} />
      <TopBar />
      <NavBar />
      <div style={{ padding:'48px 28px', flex:1 }}>
        <h1 style={{ fontFamily:"'Montserrat',sans-serif", fontSize:40, letterSpacing:2, color:'#DFFF00' }}>TÉRMINOS Y CONDICIONES</h1>
        <h2 style={{ fontFamily:"'Montserrat',sans-serif", fontSize:30, letterSpacing:1, color:'#FF007F', margin:'16px 0 28px' }}>OH YEAH + GOURMAND SOCIETY</h2>
        <div style={{ maxWidth:700 }}>
          {[
            ['1. ACEPTACIÓN','Al crear una cuenta o iniciar sesión en OH YEAH, el usuario declara que ha leído, entiende y acepta de manera libre, expresa e informada los presentes Términos y Condiciones.'],
            ['2. NATURALEZA DEL SISTEMA','OH YEAH y GOURMAND SOCIETY: No constituyen una membresía · No garantizan beneficios permanentes · No otorgan derechos adquiridos. El estatus es un reconocimiento dinámico, no un derecho exigible.'],
            ['3. AUTORIZACIÓN DE DATOS','Conforme a Ley 1581 de 2012. El usuario autoriza el tratamiento de datos de identificación, contacto, historial de reservas, consumo, preferencias gastronómicas e interacciones dentro del ecosistema.'],
            ['4. BENEFICIOS Y DISPONIBILIDAD','Todos los beneficios están sujetos a disponibilidad operativa, no son transferibles y no constituyen obligación contractual permanente.'],
            ['5. JURISDICCIÓN','Estos términos se rigen por la legislación de la República de Colombia.'],
          ].map(([h,p]) => (
            <div key={h} style={{ marginBottom:24 }}>
              <h3 style={{ fontSize:13, fontWeight:700, color:'#DFFF00', marginBottom:8, letterSpacing:'.04em' }}>{h}</h3>
              <p style={{ fontSize:13, color:'#999', lineHeight:1.75 }}>{p}</p>
            </div>
          ))}
        </div>
      </div>
      <Footer />
    </div>
  );

  return null;
}
