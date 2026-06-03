
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// Detecta errores de chunks viejos tras un redeploy (HTML cacheado apunta
// a assets que ya no existen) y recarga UNA sola vez. Evita la pantalla
// del error fatal y deja al usuario en la nueva versión.
const isChunkLoadError = (msg: string) =>
  /Failed to fetch dynamically imported module|Loading chunk \d+ failed|ChunkLoadError|Importing a module script failed/i.test(msg);

const tryReloadOnce = () => {
  try {
    const key = 'nx_reload_once';
    if (sessionStorage.getItem(key)) return false;
    sessionStorage.setItem(key, String(Date.now()));
    window.location.reload();
    return true;
  } catch { return false; }
};

// Errores globales no manejados (script tags, etc.)
window.addEventListener('error', (ev) => {
  const m = String(ev?.message || ev?.error?.message || '');
  if (isChunkLoadError(m)) tryReloadOnce();
});
window.addEventListener('unhandledrejection', (ev:any) => {
  const m = String(ev?.reason?.message || ev?.reason || '');
  if (isChunkLoadError(m)) tryReloadOnce();
});

// Error boundary global — un crash en el arranque ya no deja pantalla negra,
// muestra el error en pantalla para poder diagnosticarlo.
class RootErrorBoundary extends React.Component<{ children: React.ReactNode }, { error: Error | null }> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { error: null };
  }
  static getDerivedStateFromError(error: Error) { return { error }; }
  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('App crash:', error, info);
    // Si el crash es por un chunk viejo (deploy fresh), recargar una vez.
    if (isChunkLoadError(error?.message || '')) tryReloadOnce();
  }
  render() {
    if (this.state.error) {
      const stale = isChunkLoadError(this.state.error.message || '');
      return (
        <div style={{ minHeight: '100vh', background: '#0a0a0c', color: '#fff', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 32, fontFamily: 'Inter, system-ui, sans-serif', textAlign: 'center' }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>{stale ? '🔄' : '⚠️'}</div>
          <h1 style={{ fontSize: 20, fontWeight: 900, marginBottom: 8 }}>
            {stale ? 'Hay una versión nueva disponible' : 'La aplicación tuvo un error al cargar'}
          </h1>
          <p style={{ fontSize: 13, color: '#888', marginBottom: 16, maxWidth: 520 }}>
            {stale
              ? 'Vamos a recargar para traerte la última versión. Si esto se queda atascado, hacé Ctrl+Shift+R (hard reload).'
              : 'Toma una foto de este mensaje, envíalo a soporte y luego recarga la página.'}
          </p>
          {!stale && (
            <pre style={{ fontSize: 11, color: '#ff6b6b', background: '#1a1a1f', padding: '12px 16px', borderRadius: 12, maxWidth: 560, maxHeight: 260, overflow: 'auto', textAlign: 'left', whiteSpace: 'pre-wrap' }}>
              {this.state.error.message}{'\n\n'}{this.state.error.stack}
            </pre>
          )}
          <button onClick={() => { try { sessionStorage.removeItem('nx_reload_once'); } catch {} ; window.location.reload(); }}
            style={{ marginTop: 20, padding: '12px 28px', borderRadius: 14, border: 'none', background: '#2563eb', color: '#fff', fontWeight: 800, fontSize: 13, cursor: 'pointer' }}>
            Recargar
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <RootErrorBoundary>
    <App />
  </RootErrorBoundary>
);
