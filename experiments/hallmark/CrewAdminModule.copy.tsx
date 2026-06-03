/* Hallmark · pre-emit critique: P4 H5 E4 S5 R5 V4
   Tema: Premium dark · editorial NEXUM
   Macroestructura: tabla-índice tipográfica · NO grid de cards · NO sidebar tabs
   Diferencial: KPIs como párrafo editorial, no como tarjetitas; tabs como
   números romanos (estilo capítulos de libro).
*/
import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../lib/supabase.ts';
import { useAuth } from '../../contexts/AuthContext';
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
  danger:    '#ff5d5d',
  fontDisplay: "'Syne', sans-serif",
  fontBody:    "'DM Sans', sans-serif",
  fontMono:    "'IBM Plex Mono', 'JetBrains Mono', monospace",
};

type Tab = 'empleados' | 'comunicados' | 'reconocimientos' | 'foro' | 'denuncias' | 'academia' | 'clima';

export default function CrewAdminCopy() {
  const { profile } = useAuth();
  const { activeId: restauranteId } = useRestaurant();
  const [tab, setTab] = useState<Tab>('empleados');
  const [kpis, setKpis] = useState({ empleados:0, sinLogin:0, comunicados:0, denuncias:0 });

  useEffect(() => {
    (async () => {
      const [emp, com, den] = await Promise.all([
        supabase.from('vista_empleados_crew').select('*'),
        supabase.from('crew_comunicados').select('id').eq('restaurante_id', restauranteId).eq('publicado', true),
        supabase.from('crew_denuncias').select('id').eq('restaurante_id', restauranteId).in('estado', ['recibido','revisando']),
      ]);
      const activos = (emp.data||[]).filter((e:any)=>e.activo);
      setKpis({
        empleados: activos.length,
        sinLogin: activos.filter((e:any)=>!e.tiene_login).length,
        comunicados: (com.data||[]).length,
        denuncias: (den.data||[]).length,
      });
    })();
  }, [restauranteId, tab]);

  const fecha = new Date().toLocaleDateString('es-CO', { weekday:'long', day:'numeric', month:'long' });

  return (
    <div style={{
      height:'100%',
      overflowY:'auto',
      background: T.bgBase,
      color: T.ink1,
      fontFamily: T.fontBody,
    }}>

      {/* ╔═══ HEADER EDITORIAL ═══╗
          KPIs como párrafo, no como tarjetas. */}
      <header style={{
        padding: '40px 48px 28px',
        borderBottom: `1px solid ${T.rule}`,
      }}>
        <div style={{
          display:'flex',
          alignItems:'baseline',
          gap: 14,
          marginBottom: 18,
        }}>
          <span style={{
            fontFamily: T.fontMono,
            fontSize: 10,
            color: T.accentNX,
            letterSpacing: '0.24em',
            textTransform: 'uppercase',
          }}>Capítulo III</span>
          <span style={{
            fontFamily: T.fontMono,
            fontSize: 10,
            color: T.ink3,
            letterSpacing: '0.16em',
            textTransform: 'uppercase',
          }}>{fecha}</span>
        </div>
        <h1 style={{
          fontFamily: T.fontDisplay,
          fontSize: 'clamp(34px, 4vw, 52px)',
          fontWeight: 800,
          letterSpacing: '-0.03em',
          lineHeight: 0.96,
          marginBottom: 28,
          maxWidth: 720,
        }}>
          El crew.<br/>
          <span style={{color: T.ink3}}>Empleados, voz, cuidado.</span>
        </h1>

        {/* KPIs como párrafo legible · no rectangulitos */}
        <p style={{
          fontSize: 18,
          color: T.ink2,
          lineHeight: 1.5,
          maxWidth: 780,
        }}>
          Hay{' '}
          <Stat n={kpis.empleados} color={T.accentNX} label="empleados activos"/>.
          De ellos,{' '}
          <Stat n={kpis.sinLogin} color={kpis.sinLogin>0 ? T.accentW : T.ok} label="aún no entran a la app"/>.
          Tienes{' '}
          <Stat n={kpis.comunicados} color={T.accentC} label="comunicados publicados"/>{' '}y{' '}
          <Stat n={kpis.denuncias} color={kpis.denuncias>0 ? T.danger : T.ok} label="denuncias abiertas"/>.
        </p>
      </header>

      {/* ╔═══ TABS COMO ÍNDICE ═══╗
          Roman numerals + nombre del capítulo, no botones pill. */}
      <nav style={{
        display:'flex',
        gap: 0,
        padding: '0 48px',
        borderBottom: `1px solid ${T.rule}`,
        overflowX: 'auto',
      }}>
        {([
          { id:'empleados',       roman:'I',   label:'Empleados' },
          { id:'comunicados',     roman:'II',  label:'Comunicados' },
          { id:'reconocimientos', roman:'III', label:'Reconocimientos' },
          { id:'foro',            roman:'IV',  label:'Foro' },
          { id:'denuncias',       roman:'V',   label:'Denuncias' },
          { id:'academia',        roman:'VI',  label:'Academia' },
          { id:'clima',           roman:'VII', label:'Clima' },
        ] as { id: Tab; roman: string; label: string }[]).map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            style={{
              padding: '20px 22px 18px',
              background: 'none',
              border: 'none',
              borderBottom: `2px solid ${tab===t.id ? T.ink1 : 'transparent'}`,
              cursor: 'pointer',
              fontFamily: T.fontBody,
              textAlign: 'left',
              transition: 'all .15s',
            }}>
            <div style={{
              fontFamily: T.fontMono,
              fontSize: 9,
              letterSpacing: '0.2em',
              color: tab===t.id ? T.accentNX : T.ink3,
              marginBottom: 4,
            }}>{t.roman}</div>
            <div style={{
              fontSize: 13,
              fontWeight: tab===t.id ? 700 : 500,
              color: tab===t.id ? T.ink1 : T.ink2,
              letterSpacing: '-0.005em',
            }}>{t.label}</div>
          </button>
        ))}
      </nav>

      {/* ╔═══ CONTENIDO ═══╗ */}
      <main style={{padding: '36px 48px 60px'}}>
        {tab === 'empleados' && <EmpleadosCopy restauranteId={restauranteId}/>}
        {tab !== 'empleados' && (
          <Placeholder tab={tab}/>
        )}
      </main>
    </div>
  );
}

// ── Stat inline editorial ──────────────────────────────────────────────
function Stat({ n, color, label }: { n: number; color: string; label: string }) {
  return (
    <span style={{display:'inline-flex', alignItems:'baseline', gap:6}}>
      <span style={{
        fontFamily: T.fontDisplay,
        fontWeight: 800,
        fontSize: '1.3em',
        color,
        letterSpacing: '-0.02em',
      }}>{n}</span>
      <span style={{color: T.ink3}}>{label}</span>
    </span>
  );
}

// ── EMPLEADOS · tabla tipográfica minimalista ──────────────────────────
function EmpleadosCopy({ restauranteId }: { restauranteId: number }) {
  const [emp, setEmp] = useState<any[]>([]);
  const [filtroRol, setFiltroRol] = useState('todos');
  const [busca, setBusca] = useState('');

  const cargar = useCallback(async () => {
    const { data } = await supabase.from('vista_empleados_crew').select('*').order('nombre_completo');
    setEmp(data || []);
  }, []);
  useEffect(() => { cargar(); }, [cargar]);

  const roles = Array.from(new Set(emp.map((e:any) => e.rol).filter(Boolean))) as string[];
  const filtrados = emp
    .filter(e => filtroRol === 'todos' || e.rol === filtroRol)
    .filter(e => !busca || (e.nombre_completo||'').toLowerCase().includes(busca.toLowerCase()));

  return (
    <>
      {/* Toolbar inline — sin caja envolvente */}
      <div style={{
        display:'flex',
        alignItems:'center',
        gap: 20,
        marginBottom: 28,
        paddingBottom: 20,
        borderBottom: `1px solid ${T.rule}`,
      }}>
        <input value={busca} onChange={e=>setBusca(e.target.value)}
          placeholder="Buscar empleado…"
          style={{
            flex: 1, maxWidth: 320,
            background: 'transparent',
            border: 'none',
            borderBottom: `1px solid ${T.rule}`,
            padding: '8px 0',
            color: T.ink1,
            fontFamily: T.fontBody,
            fontSize: 14,
            outline: 'none',
          }}/>
        <div style={{display:'flex', gap: 4, marginLeft: 'auto'}}>
          {['todos', ...roles].slice(0, 7).map(r => (
            <button key={r} onClick={() => setFiltroRol(r)}
              style={{
                padding: '6px 12px',
                background: 'transparent',
                border: 'none',
                color: filtroRol===r ? T.ink1 : T.ink3,
                fontFamily: T.fontMono,
                fontSize: 10,
                letterSpacing: '0.12em',
                textTransform: 'uppercase',
                cursor: 'pointer',
                borderBottom: `1px solid ${filtroRol===r ? T.accentNX : 'transparent'}`,
                paddingBottom: 4,
              }}>{r}</button>
          ))}
        </div>
        <span style={{
          fontFamily: T.fontMono,
          fontSize: 10,
          color: T.ink3,
          letterSpacing: '0.12em',
          textTransform: 'uppercase',
        }}>{filtrados.length} / {emp.length}</span>
      </div>

      {/* Tabla tipográfica · primera columna grande, resto fino */}
      <table style={{width:'100%', borderCollapse:'collapse'}}>
        <thead>
          <tr style={{borderBottom: `1px solid ${T.rule}`}}>
            <Th>Empleado</Th>
            <Th align="right">Rol</Th>
            <Th align="right">App</Th>
            <Th align="right">NX</Th>
            <Th align="right">Vacaciones</Th>
            <Th align="right" small>Acción</Th>
          </tr>
        </thead>
        <tbody>
          {filtrados.map((e, i) => (
            <tr key={e.id} style={{borderBottom: `1px solid ${T.rule}`}}>
              <td style={{padding: '20px 0', verticalAlign:'top'}}>
                <div style={{display:'flex', alignItems:'baseline', gap:14}}>
                  <span style={{
                    fontFamily: T.fontMono,
                    fontSize: 11,
                    color: T.ink3,
                    width: 24,
                  }}>{String(i+1).padStart(2,'0')}</span>
                  <div>
                    <div style={{
                      fontFamily: T.fontDisplay,
                      fontSize: 17,
                      fontWeight: 700,
                      letterSpacing:'-0.01em',
                      marginBottom: 2,
                    }}>{e.nombre_completo || '—'}</div>
                    <div style={{
                      fontFamily: T.fontMono,
                      fontSize: 10,
                      color: T.ink3,
                      letterSpacing:'0.04em',
                    }}>{e.email || 'sin correo'}</div>
                  </div>
                </div>
              </td>
              <Td>{e.cargo_display || e.rol || '—'}</Td>
              <Td color={e.tiene_login ? T.ok : T.accentW}>
                {e.tiene_login ? '● activo' : '○ pendiente'}
              </Td>
              <Td mono color={T.accentNX} bold>
                {(e.nx_saldo || 0).toLocaleString('es-CO')}
              </Td>
              <Td mono>{e.vacaciones_dias ?? 0}d</Td>
              <Td>
                <button style={{
                  background: 'transparent',
                  border: 'none',
                  color: T.ink1,
                  fontFamily: T.fontMono,
                  fontSize: 10,
                  letterSpacing: '0.16em',
                  textTransform: 'uppercase',
                  cursor: 'pointer',
                  borderBottom: `1px solid ${T.ink1}`,
                  padding: '2px 0',
                }}>Ver →</button>
              </Td>
            </tr>
          ))}
        </tbody>
      </table>
      {filtrados.length === 0 && (
        <div style={{
          padding: 60,
          textAlign: 'center',
          color: T.ink3,
          fontFamily: T.fontMono,
          fontSize: 11,
          letterSpacing: '0.1em',
          textTransform: 'uppercase',
        }}>Sin coincidencias</div>
      )}
    </>
  );
}

function Th({ children, align='left', small }: { children: React.ReactNode; align?: 'left'|'right'; small?: boolean }) {
  return (
    <th style={{
      textAlign: align,
      padding: '12px 0',
      fontFamily: T.fontMono,
      fontSize: 10,
      fontWeight: 600,
      color: T.ink3,
      letterSpacing: '0.18em',
      textTransform: 'uppercase',
      width: small ? 80 : undefined,
    }}>{children}</th>
  );
}

function Td({ children, mono, color, bold }: { children: React.ReactNode; mono?: boolean; color?: string; bold?: boolean }) {
  return (
    <td style={{
      padding: '20px 0',
      textAlign: 'right',
      verticalAlign: 'top',
      fontFamily: mono ? T.fontMono : T.fontBody,
      fontSize: mono ? 12 : 13,
      fontWeight: bold ? 700 : 400,
      color: color || T.ink2,
      letterSpacing: mono ? '0.04em' : undefined,
    }}>{children}</td>
  );
}

// ── Placeholder tipográfico para tabs sin contenido aún en esta copia ──
function Placeholder({ tab }: { tab: string }) {
  return (
    <div style={{
      padding: '100px 0',
      textAlign: 'center',
      maxWidth: 520,
      margin: '0 auto',
    }}>
      <div style={{
        fontFamily: T.fontMono,
        fontSize: 11,
        color: T.accentNX,
        letterSpacing: '0.24em',
        textTransform: 'uppercase',
        marginBottom: 18,
      }}>Sandbox</div>
      <h2 style={{
        fontFamily: T.fontDisplay,
        fontSize: 32,
        fontWeight: 800,
        letterSpacing: '-0.025em',
        lineHeight: 1.1,
        marginBottom: 16,
      }}>{tab.charAt(0).toUpperCase() + tab.slice(1)} pendiente de rediseño.</h2>
      <p style={{
        color: T.ink2,
        fontSize: 15,
        lineHeight: 1.6,
      }}>
        Esta vista existe en producción. La copia Hallmark se enfocó primero
        en <strong style={{color: T.ink1}}>Empleados</strong> como prueba de
        macroestructura editorial. Si te gusta, replicamos el patrón a las
        otras pestañas.
      </p>
    </div>
  );
}
