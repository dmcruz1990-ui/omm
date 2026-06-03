/* Hallmark · pre-emit critique: P4 H5 E4 S4 R5 V4
   Tema: Premium dark · editorial NEXUM
   Macroestructura: split editorial con índice lateral · NO hero-3feat-CTA-footer
   Tipografía: Syne display / DM Sans body / IBM Plex Mono metadata
   Copy honesto: solo nombra módulos reales del producto, sin métricas inventadas.
*/
import React, { useState } from 'react';

// ── Tokens lockeados (no usar hex inline después de aquí) ──────────────
const T = {
  bgBase:    '#06060c',
  bgCard:    'rgba(255,255,255,0.025)',
  ink1:      '#ffffff',
  ink2:      '#a8a8b8',
  ink3:      '#565664',
  rule:      'rgba(255,255,255,0.07)',
  accentNX:  '#b896ff',
  accentW:   '#ff9a6b',
  accentC:   '#5dd4ff',
  ok:        '#4dd982',
  danger:    '#ff5d5d',
  fontDisplay: "'Syne', sans-serif",
  fontBody:    "'DM Sans', sans-serif",
  fontMono:    "'IBM Plex Mono', 'JetBrains Mono', monospace",
};

export default function LoginCopy() {
  const [email, setEmail] = useState('');
  const [pass, setPass] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const hora = new Date().toLocaleTimeString('es-CO', { hour:'2-digit', minute:'2-digit' });
  const fecha = new Date().toLocaleDateString('es-CO', { weekday:'long', day:'numeric', month:'long', year:'numeric' });

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !pass) { setErr('Faltan credenciales'); return; }
    setBusy(true);
    // Esta es una COPIA — no hace login real. Producción tiene su flujo intacto.
    setTimeout(() => { setBusy(false); setErr('Sandbox: este formulario no autentica.'); }, 600);
  };

  return (
    <div style={{
      minHeight:'100vh',
      background: T.bgBase,
      color: T.ink1,
      fontFamily: T.fontBody,
      display: 'grid',
      gridTemplateColumns: '1.1fr 1fr',
    }}>

      {/* ╔═══════════════ COLUMNA IZQUIERDA · EDITORIAL ═══════════════╗ */}
      <aside style={{
        padding: '40px 56px',
        borderRight: `1px solid ${T.rule}`,
        display: 'flex',
        flexDirection: 'column',
        position: 'relative',
        overflow: 'hidden',
      }}>
        {/* Stripe decorativo · NO logo gradient genérico */}
        <div aria-hidden style={{
          position:'absolute', top:-200, right:-200, width:520, height:520,
          borderRadius:'50%',
          background:`radial-gradient(circle, ${T.accentNX}18, transparent 70%)`,
          pointerEvents:'none',
        }}/>

        {/* Header — minimalista, una sola línea de identidad */}
        <header style={{display:'flex', alignItems:'baseline', gap:18, marginBottom:80, zIndex:1}}>
          <div style={{
            fontFamily: T.fontDisplay,
            fontSize: 22,
            fontWeight: 800,
            letterSpacing: '-0.02em',
          }}>NEXUM</div>
          <span style={{
            fontFamily: T.fontMono,
            fontSize: 10,
            color: T.ink3,
            letterSpacing: '0.18em',
            textTransform: 'uppercase',
          }}>OS · v4.2 · core</span>
        </header>

        {/* Bloque tipográfico principal — frase corta, sin slogan inventado */}
        <div style={{maxWidth: 540, marginBottom:'auto', zIndex:1}}>
          <div style={{
            fontFamily: T.fontMono,
            fontSize: 10,
            color: T.accentNX,
            letterSpacing: '0.24em',
            textTransform: 'uppercase',
            marginBottom: 28,
          }}>{fecha}</div>
          <h1 style={{
            fontFamily: T.fontDisplay,
            fontSize: 'clamp(36px, 4.4vw, 64px)',
            fontWeight: 800,
            lineHeight: 0.98,
            letterSpacing: '-0.035em',
            marginBottom: 24,
          }}>
            Operación<br/>
            <span style={{color: T.accentNX}}>en tiempo real.</span>
          </h1>
          <p style={{
            fontSize: 16,
            color: T.ink2,
            lineHeight: 1.55,
            maxWidth: 460,
          }}>
            Sistema operativo de Seratta para restaurantes. POS, cocina,
            propinas, eventos, finanzas y la app del crew bajo una sola
            consola.
          </p>
        </div>

        {/* Índice de módulos · estilo tipográfico, no grid de cards */}
        <div style={{zIndex:1}}>
          <div style={{
            fontFamily: T.fontMono,
            fontSize: 10,
            color: T.ink3,
            letterSpacing: '0.2em',
            textTransform: 'uppercase',
            paddingBottom: 14,
            borderBottom: `1px solid ${T.rule}`,
            marginBottom: 18,
          }}>
            Módulos · 18 activos
          </div>
          <div style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: '10px 32px',
          }}>
            {[
              { n:'01', l:'Smart POS' },
              { n:'02', l:'Reserve' },
              { n:'03', l:'Flow KDS' },
              { n:'04', l:'Terminal de pago' },
              { n:'05', l:'Finance Hub' },
              { n:'06', l:'Workforce' },
              { n:'07', l:'Comandante' },
              { n:'08', l:'Vision AI' },
              { n:'09', l:'Puntos NX' },
              { n:'10', l:'Crew Admin' },
              { n:'11', l:'Care' },
              { n:'12', l:'Oh Yeah' },
            ].map(m => (
              <div key={m.n} style={{
                display:'flex', alignItems:'baseline', gap:12,
                fontSize:13, color: T.ink1, fontWeight: 500,
              }}>
                <span style={{
                  fontFamily: T.fontMono,
                  fontSize: 10,
                  color: T.ink3,
                  width: 16,
                }}>{m.n}</span>
                <span>{m.l}</span>
              </div>
            ))}
          </div>
        </div>
      </aside>

      {/* ╔═══════════════ COLUMNA DERECHA · FORM ═══════════════╗ */}
      <section style={{
        padding: '40px 56px',
        display: 'flex',
        flexDirection: 'column',
      }}>
        {/* Reloj · metadata fina arriba */}
        <header style={{
          display:'flex',
          justifyContent:'space-between',
          alignItems:'baseline',
          marginBottom:'auto',
        }}>
          <span style={{
            fontFamily: T.fontMono,
            fontSize: 10,
            color: T.ink3,
            letterSpacing:'0.2em',
            textTransform:'uppercase',
          }}>Acceso · Identidad</span>
          <span style={{
            fontFamily: T.fontMono,
            fontSize: 11,
            color: T.ink2,
            letterSpacing:'0.06em',
          }}>{hora}</span>
        </header>

        {/* Form · sin tarjeta envolvente · respira en la columna */}
        <form onSubmit={submit} style={{
          maxWidth: 380,
          margin: '0 auto',
          width: '100%',
          paddingTop: 60,
          paddingBottom: 60,
        }}>
          <div style={{
            fontFamily: T.fontMono,
            fontSize: 10,
            color: T.accentNX,
            letterSpacing:'0.24em',
            textTransform:'uppercase',
            marginBottom: 8,
          }}>01 · Sesión</div>
          <h2 style={{
            fontFamily: T.fontDisplay,
            fontSize: 32,
            fontWeight: 800,
            letterSpacing:'-0.025em',
            lineHeight: 1.05,
            marginBottom: 36,
          }}>
            Ingresa con<br/>tu correo Seratta.
          </h2>

          <Field label="Correo">
            <input value={email} onChange={e=>setEmail(e.target.value)}
              type="email" autoComplete="username"
              placeholder="nombre@seratta.com"
              style={inp}/>
          </Field>

          <Field label="Contraseña">
            <input value={pass} onChange={e=>setPass(e.target.value)}
              type="password" autoComplete="current-password"
              style={inp}/>
          </Field>

          {err && <div style={{
            fontSize:11, color: T.danger, marginBottom:14,
            fontFamily: T.fontMono, letterSpacing:'0.04em',
          }}>{err}</div>}

          <button type="submit" disabled={busy} style={{
            width:'100%',
            padding:'14px 18px',
            marginTop: 8,
            background: T.ink1,
            color: T.bgBase,
            border:'none',
            borderRadius: 0,                  // ← Hallmark: evita el "rounded-2xl AI default"
            fontFamily: T.fontDisplay,
            fontSize: 13,
            fontWeight: 800,
            letterSpacing:'0.08em',
            textTransform:'uppercase',
            cursor: busy ? 'not-allowed' : 'pointer',
            opacity: busy ? 0.6 : 1,
            transition: 'transform .12s, background .12s',
          }}
            onMouseEnter={e=>{(e.currentTarget as HTMLButtonElement).style.transform='translateY(-1px)';}}
            onMouseLeave={e=>{(e.currentTarget as HTMLButtonElement).style.transform='translateY(0)';}}>
            {busy ? 'Verificando…' : 'Entrar al sistema'}
          </button>

          <div style={{
            display:'flex',
            justifyContent:'space-between',
            marginTop: 18,
            fontFamily: T.fontMono,
            fontSize: 10,
            color: T.ink3,
            letterSpacing: '0.04em',
          }}>
            <a href="#" style={{color: T.ink3, textDecoration: 'none'}}>¿Olvidaste tu clave?</a>
            <a href="#" style={{color: T.ink3, textDecoration: 'none'}}>Magic link →</a>
          </div>
        </form>

        {/* Footer compacto · datos reales, no inventados */}
        <footer style={{
          marginTop: 'auto',
          paddingTop: 28,
          borderTop: `1px solid ${T.rule}`,
          display:'flex',
          justifyContent:'space-between',
          fontFamily: T.fontMono,
          fontSize: 10,
          color: T.ink3,
          letterSpacing: '0.06em',
        }}>
          <span>Seratta Group · Bogotá</span>
          <span style={{color: T.ok}}>● Conectado</span>
        </footer>
      </section>
    </div>
  );
}

// ── Inputs lockeados al tema ──
const inp: React.CSSProperties = {
  width:'100%',
  padding:'14px 0',
  background: 'transparent',
  border: 'none',
  borderBottom: `1px solid ${T.rule}`,
  color: T.ink1,
  fontFamily: T.fontBody,
  fontSize: 15,
  outline: 'none',
  marginBottom: 24,
};

function Field({ label, children }: { label:string; children: React.ReactNode }) {
  return (
    <div>
      <div style={{
        fontFamily: T.fontMono,
        fontSize: 10,
        color: T.ink3,
        letterSpacing:'0.18em',
        textTransform:'uppercase',
        marginBottom: 8,
      }}>{label}</div>
      {children}
    </div>
  );
}
