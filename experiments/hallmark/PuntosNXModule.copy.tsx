/* Hallmark · pre-emit critique: P5 H5 E4 S5 R5 V5
   Tema: Premium dark · editorial NEXUM
   Macroestructura: vitrina vertical · primer pliegue = WALLET CARD grande
   con tipografía monumental, después beneficios en galería editorial
   (1 grande + 2 chicos) · NO grid uniforme de cards iguales.
   Diferencial: el saldo es la pieza central como en una tarjeta física,
   no un KPI más entre otros.
*/
import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase.ts';
import { useRestaurant } from '../../contexts/RestaurantContext';

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
  fontDisplay: "'Syne', sans-serif",
  fontBody:    "'DM Sans', sans-serif",
  fontMono:    "'IBM Plex Mono', 'JetBrains Mono', monospace",
};

const fmtPts = (n: number) => (n || 0).toLocaleString('es-CO');
const fmtCOP = (n: number) => `$${Math.round(n || 0).toLocaleString('es-CO')}`;

export default function PuntosNXCopy() {
  const { activeId: restauranteId } = useRestaurant();
  const [beneficios, setBeneficios] = useState<any[]>([]);
  const [retos, setRetos] = useState<any[]>([]);
  const [stats, setStats] = useState({ totalPts: 0, canjesMes: 0 });

  useEffect(() => {
    (async () => {
      const hoy = new Date().toISOString().split('T')[0];
      const mesStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString();
      const [b, r, c, m] = await Promise.all([
        supabase.from('nx_beneficios').select('*').eq('restaurante_id', restauranteId).eq('activo', true).order('destacado', { ascending: false }).order('costo_puntos'),
        supabase.from('nx_retos').select('*').eq('restaurante_id', restauranteId).eq('activo', true).or(`hasta.is.null,hasta.gte.${hoy}`),
        supabase.from('customers').select('puntos').gt('puntos', 0),
        supabase.from('nx_solicitudes').select('id').eq('restaurante_id', restauranteId).eq('estado', 'canjeada').gte('canjeada_en', mesStart),
      ]);
      setBeneficios(b.data || []);
      setRetos(r.data || []);
      setStats({
        totalPts: (c.data || []).reduce((s: number, x: any) => s + Number(x.puntos || 0), 0),
        canjesMes: (m.data || []).length,
      });
    })();
  }, [restauranteId]);

  // Macroestructura intencional: hero card + galería 1-grande-2-chicos + retos como tickets
  const destacado = beneficios.find(b => b.destacado) || beneficios[0];
  const restoBeneficios = beneficios.filter(b => b.id !== destacado?.id).slice(0, 8);

  return (
    <div style={{
      height: '100%',
      overflowY: 'auto',
      background: T.bgBase,
      color: T.ink1,
      fontFamily: T.fontBody,
    }}>

      {/* ╔═══ PLIEGUE 1 · WALLET CARD COMO PIEZA FÍSICA ═══╗ */}
      <section style={{
        padding: '48px 48px 56px',
        borderBottom: `1px solid ${T.rule}`,
        display: 'grid',
        gridTemplateColumns: '1.3fr 1fr',
        gap: 56,
        alignItems: 'end',
        position: 'relative',
        overflow: 'hidden',
      }}>
        {/* Halo de marca · suave, no decoración disco */}
        <div aria-hidden style={{
          position: 'absolute', top: -180, left: '50%', width: 600, height: 600,
          borderRadius: '50%',
          background: `radial-gradient(circle, ${T.accentNX}14, transparent 60%)`,
          pointerEvents: 'none',
        }}/>

        <div style={{zIndex:1}}>
          <div style={{
            fontFamily: T.fontMono,
            fontSize: 10,
            color: T.accentNX,
            letterSpacing: '0.24em',
            textTransform: 'uppercase',
            marginBottom: 14,
          }}>Programa NX · {restauranteId === 6 ? 'OMM' : 'Gallo Colorado'}</div>

          <h1 style={{
            fontFamily: T.fontDisplay,
            fontSize: 'clamp(56px, 7vw, 96px)',
            fontWeight: 800,
            letterSpacing: '-0.045em',
            lineHeight: 0.9,
            marginBottom: 24,
          }}>
            {fmtPts(stats.totalPts)}
            <span style={{
              fontFamily: T.fontBody,
              fontSize: '0.35em',
              fontWeight: 400,
              color: T.ink3,
              letterSpacing: 0,
              marginLeft: 12,
            }}>pts en circulación</span>
          </h1>

          <p style={{
            fontSize: 17,
            color: T.ink2,
            lineHeight: 1.55,
            maxWidth: 520,
          }}>
            Los clientes acumulan 1 punto cada $1.000 consumidos. Los retos
            del menú multiplican x2, x3 o x4. Canjean por la vitrina de
            abajo con aprobación del cajero.
          </p>
        </div>

        {/* Tickets de stats · metadata real, sin métrica inventada */}
        <div style={{zIndex:1}}>
          <StatTicket label="Beneficios activos" value={String(beneficios.length)} accent={T.accentC}/>
          <StatTicket label="Retos vigentes"     value={String(retos.length)}      accent={T.accentW}/>
          <StatTicket label="Canjes este mes"    value={String(stats.canjesMes)}   accent={T.ok}/>
        </div>
      </section>

      {/* ╔═══ PLIEGUE 2 · BENEFICIO DESTACADO + GALERÍA ASIMÉTRICA ═══╗ */}
      {beneficios.length > 0 && (
        <section style={{padding: '52px 48px', borderBottom: `1px solid ${T.rule}`}}>
          <SectionHead num="01" titulo="Vitrina" subtitulo="Lo que el cliente puede canjear"/>

          {/* Layout asimétrico: 1 grande + grid 2x4 chicos */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: '1.4fr 1fr',
            gap: 24,
            alignItems: 'stretch',
          }}>
            {/* Hero card */}
            {destacado && <BeneficioHero b={destacado}/>}

            {/* Mini-grid de los demás */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(2, 1fr)',
              gap: 14,
            }}>
              {restoBeneficios.map(b => <BeneficioMini key={b.id} b={b}/>)}
            </div>
          </div>
        </section>
      )}

      {/* ╔═══ PLIEGUE 3 · RETOS COMO LISTA EDITORIAL ═══╗ */}
      {retos.length > 0 && (
        <section style={{padding: '52px 48px'}}>
          <SectionHead num="02" titulo="Retos del menú" subtitulo="Platos que multiplican puntos para el cliente"/>

          {retos.map((r, i) => (
            <RetoRow key={r.id} reto={r} ultimo={i === retos.length - 1}/>
          ))}
        </section>
      )}
    </div>
  );
}

// ── Components ────────────────────────────────────────────────────────

function StatTicket({ label, value, accent }: { label: string; value: string; accent: string }) {
  return (
    <div style={{
      display: 'flex',
      alignItems: 'baseline',
      gap: 14,
      padding: '14px 0',
      borderBottom: `1px solid ${T.rule}`,
    }}>
      <span style={{
        fontFamily: T.fontDisplay,
        fontSize: 28,
        fontWeight: 800,
        color: accent,
        letterSpacing: '-0.02em',
        minWidth: 70,
      }}>{value}</span>
      <span style={{
        fontFamily: T.fontMono,
        fontSize: 11,
        color: T.ink3,
        letterSpacing: '0.1em',
        textTransform: 'uppercase',
      }}>{label}</span>
    </div>
  );
}

function SectionHead({ num, titulo, subtitulo }: { num: string; titulo: string; subtitulo: string }) {
  return (
    <div style={{marginBottom: 32, display: 'flex', alignItems: 'baseline', gap: 18}}>
      <span style={{
        fontFamily: T.fontMono,
        fontSize: 11,
        color: T.accentNX,
        letterSpacing: '0.24em',
        textTransform: 'uppercase',
      }}>{num}</span>
      <div>
        <h2 style={{
          fontFamily: T.fontDisplay,
          fontSize: 32,
          fontWeight: 800,
          letterSpacing: '-0.025em',
          lineHeight: 1,
          margin: 0,
        }}>{titulo}</h2>
        <div style={{
          fontFamily: T.fontMono,
          fontSize: 11,
          color: T.ink3,
          letterSpacing: '0.06em',
          marginTop: 6,
        }}>{subtitulo}</div>
      </div>
    </div>
  );
}

function BeneficioHero({ b }: { b: any }) {
  const tipoColor = b.tipo === 'experiencia' ? T.accentW : b.tipo === 'descuento' ? T.accentC : T.accentNX;
  return (
    <article style={{
      background: T.bgCard,
      border: `1px solid ${T.rule}`,
      padding: 0,
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden',
      minHeight: 380,
    }}>
      {/* Imagen / placeholder con emoji gigante */}
      <div style={{
        flex: 1,
        background: b.foto_url
          ? `url(${b.foto_url}) center/cover no-repeat`
          : `linear-gradient(135deg, ${tipoColor}22, transparent), ${T.bgCard}`,
        position: 'relative',
        display: 'flex',
        alignItems: 'flex-end',
        padding: 24,
        minHeight: 220,
      }}>
        {!b.foto_url && (
          <div aria-hidden style={{
            position:'absolute', inset:0, display:'flex', alignItems:'center', justifyContent:'center',
            fontSize: 140, opacity: 0.18,
          }}>{b.emoji || '🎁'}</div>
        )}
        <div style={{
          fontFamily: T.fontMono,
          fontSize: 10,
          color: tipoColor,
          background: `${tipoColor}20`,
          letterSpacing: '0.18em',
          textTransform: 'uppercase',
          padding: '6px 12px',
          zIndex: 1,
        }}>{b.tipo || 'cortesia'}</div>
      </div>
      <div style={{padding: '22px 26px 26px', borderTop: `1px solid ${T.rule}`}}>
        <h3 style={{
          fontFamily: T.fontDisplay,
          fontSize: 26,
          fontWeight: 800,
          letterSpacing: '-0.02em',
          lineHeight: 1.05,
          marginBottom: 8,
        }}>{b.nombre}</h3>
        {b.descripcion && (
          <p style={{
            color: T.ink2,
            fontSize: 14,
            lineHeight: 1.5,
            marginBottom: 18,
          }}>{b.descripcion}</p>
        )}
        <div style={{
          display:'flex',
          alignItems:'baseline',
          justifyContent:'space-between',
          paddingTop: 14,
          borderTop: `1px solid ${T.rule}`,
        }}>
          <span style={{
            fontFamily: T.fontDisplay,
            fontSize: 30,
            fontWeight: 800,
            color: T.accentNX,
            letterSpacing: '-0.02em',
          }}>{fmtPts(b.costo_puntos)} <span style={{fontSize:14,color:T.ink3,fontWeight:400}}>pts</span></span>
          {b.valor_estimado && (
            <span style={{
              fontFamily: T.fontMono,
              fontSize: 11,
              color: T.ink3,
              letterSpacing: '0.06em',
            }}>≈ {fmtCOP(b.valor_estimado)}</span>
          )}
        </div>
      </div>
    </article>
  );
}

function BeneficioMini({ b }: { b: any }) {
  const tipoColor = b.tipo === 'experiencia' ? T.accentW : b.tipo === 'descuento' ? T.accentC : T.accentNX;
  return (
    <article style={{
      background: T.bgCard,
      border: `1px solid ${T.rule}`,
      padding: 16,
      display:'flex',
      flexDirection:'column',
      justifyContent:'space-between',
      minHeight: 175,
      position:'relative',
      overflow:'hidden',
    }}>
      <div style={{position:'absolute', top:-12, right:-12, fontSize: 64, opacity: 0.18}}>{b.emoji || '🎁'}</div>
      <div style={{zIndex:1}}>
        <span style={{
          fontFamily: T.fontMono,
          fontSize: 9,
          color: tipoColor,
          background: `${tipoColor}18`,
          padding: '3px 8px',
          letterSpacing: '0.14em',
          textTransform: 'uppercase',
        }}>{b.tipo || 'cortesia'}</span>
        <div style={{
          fontFamily: T.fontDisplay,
          fontSize: 15,
          fontWeight: 700,
          letterSpacing: '-0.01em',
          marginTop: 10,
          lineHeight: 1.2,
        }}>{b.nombre}</div>
      </div>
      <div style={{
        fontFamily: T.fontDisplay,
        fontSize: 20,
        fontWeight: 800,
        color: T.accentNX,
        letterSpacing: '-0.02em',
        zIndex:1,
      }}>{fmtPts(b.costo_puntos)} <span style={{fontSize:11,color:T.ink3,fontWeight:400}}>pts</span></div>
    </article>
  );
}

function RetoRow({ reto, ultimo }: { reto: any; ultimo: boolean }) {
  const color = reto.multiplicador === 2 ? T.accentC
              : reto.multiplicador === 3 ? T.accentW
              : reto.multiplicador === 4 ? '#ff5d99'
              : T.accentNX;
  const vence = reto.hasta ? Math.ceil((new Date(reto.hasta + 'T23:59:59').getTime() - Date.now()) / 86400000) : null;

  return (
    <div style={{
      display:'grid',
      gridTemplateColumns: '60px 1fr auto auto',
      gap: 24,
      alignItems: 'center',
      padding: '22px 0',
      borderBottom: ultimo ? 'none' : `1px solid ${T.rule}`,
    }}>
      <div style={{
        fontFamily: T.fontDisplay,
        fontSize: 36,
        fontWeight: 800,
        color,
        letterSpacing: '-0.04em',
        textAlign: 'center',
        lineHeight: 1,
      }}>×{reto.multiplicador}</div>

      <div>
        <h4 style={{
          fontFamily: T.fontDisplay,
          fontSize: 18,
          fontWeight: 700,
          letterSpacing: '-0.015em',
          margin: 0,
          marginBottom: 4,
        }}>{reto.emoji} {reto.producto_nombre}</h4>
        {reto.motivacion_mesero && (
          <div style={{
            fontFamily: T.fontMono,
            fontSize: 11,
            color: T.ink3,
            letterSpacing: '0.04em',
          }}>“{reto.motivacion_mesero}”</div>
        )}
      </div>

      <div style={{
        fontFamily: T.fontMono,
        fontSize: 11,
        color: T.ink3,
        letterSpacing: '0.06em',
        textAlign: 'right',
      }}>
        {vence !== null
          ? <>vence en <strong style={{color: vence < 7 ? T.accentW : T.ink2}}>{vence}d</strong></>
          : <>vigente</>}
      </div>

      <div style={{
        fontFamily: T.fontMono,
        fontSize: 11,
        color: T.ink3,
        letterSpacing: '0.06em',
        minWidth: 90,
        textAlign:'right',
      }}>
        {reto.veces_vendido || 0} vendidos
      </div>
    </div>
  );
}
