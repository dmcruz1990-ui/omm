/* Preview efímero para las copias Hallmark.
   Se activa SOLO si la URL trae ?preview=hallmark — los usuarios
   normales jamás llegan aquí. Cuando aprobemos/descartemos las
   copias, este archivo y el guard en App.tsx se borran. */
import React, { useState } from 'react';
import LoginCopy from './LoginScreen.copy';
import CrewAdminCopy from './CrewAdminModule.copy';
import PuntosNXCopy from './PuntosNXModule.copy';

type Vista = 'login' | 'crew' | 'puntos';

export default function HallmarkPreview() {
  const [vista, setVista] = useState<Vista>('login');

  const VIEWS = [
    { id:'login'  as const, label:'A · Login',       roman:'I'   },
    { id:'crew'   as const, label:'B · Crew Admin',  roman:'II'  },
    { id:'puntos' as const, label:'C · Puntos NX',   roman:'III' },
  ];

  return (
    <div style={{minHeight:'100vh', background:'#06060c'}}>
      {/* Barra de control del sandbox — flotante, no interfiere con la copia */}
      <nav style={{
        position:'fixed',
        top: 16, left: '50%', transform:'translateX(-50%)',
        zIndex: 9999,
        background: 'rgba(6,6,12,0.9)',
        backdropFilter: 'blur(12px)',
        border: '1px solid rgba(255,255,255,0.12)',
        borderRadius: 999,
        padding: '6px',
        display: 'flex',
        gap: 4,
        fontFamily: "'IBM Plex Mono', monospace",
      }}>
        <span style={{
          padding:'7px 14px',
          fontSize: 10,
          color: '#b896ff',
          letterSpacing: '0.18em',
          textTransform: 'uppercase',
          borderRight: '1px solid rgba(255,255,255,0.08)',
          marginRight: 4,
        }}>Hallmark · sandbox</span>
        {VIEWS.map(v => (
          <button key={v.id} onClick={()=>setVista(v.id)}
            style={{
              padding: '7px 14px',
              background: vista===v.id ? '#ffffff' : 'transparent',
              color: vista===v.id ? '#06060c' : '#a8a8b8',
              border: 'none',
              borderRadius: 999,
              fontFamily: "'IBM Plex Mono', monospace",
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: '0.04em',
              cursor: 'pointer',
              transition: 'all .12s',
            }}>
            {v.label}
          </button>
        ))}
        <a href="?" style={{
          padding: '7px 12px',
          color: '#565664',
          textDecoration: 'none',
          fontSize: 10,
          letterSpacing: '0.16em',
          textTransform: 'uppercase',
          borderLeft: '1px solid rgba(255,255,255,0.08)',
          marginLeft: 4,
        }}>← salir</a>
      </nav>

      {vista === 'login'  && <LoginCopy />}
      {vista === 'crew'   && <WithMockProviders><CrewAdminCopy /></WithMockProviders>}
      {vista === 'puntos' && <WithMockProviders><PuntosNXCopy /></WithMockProviders>}
    </div>
  );
}

// Las copias de Crew y Puntos usan useRestaurant. Para que funcionen
// sin estar logueado, envolvemos en un mock provider que devuelve OMM.
import { RestaurantProvider } from '../../contexts/RestaurantContext';
import { AuthProvider } from '../../contexts/AuthContext';

function WithMockProviders({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <RestaurantProvider>
        {children}
      </RestaurantProvider>
    </AuthProvider>
  );
}
