
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.tsx';
import './index.css';

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
  }
  render() {
    if (this.state.error) {
      return (
        <div style={{ minHeight: '100vh', background: '#0a0a0c', color: '#fff', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 32, fontFamily: 'Inter, system-ui, sans-serif', textAlign: 'center' }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>⚠️</div>
          <h1 style={{ fontSize: 20, fontWeight: 900, marginBottom: 8 }}>La aplicación tuvo un error al cargar</h1>
          <p style={{ fontSize: 13, color: '#888', marginBottom: 16, maxWidth: 520 }}>
            Toma una foto de este mensaje, envíalo a soporte y luego recarga la página.
          </p>
          <pre style={{ fontSize: 11, color: '#ff6b6b', background: '#1a1a1f', padding: '12px 16px', borderRadius: 12, maxWidth: 560, maxHeight: 260, overflow: 'auto', textAlign: 'left', whiteSpace: 'pre-wrap' }}>
            {this.state.error.message}{'\n\n'}{this.state.error.stack}
          </pre>
          <button onClick={() => window.location.reload()} style={{ marginTop: 20, padding: '12px 28px', borderRadius: 14, border: 'none', background: '#2563eb', color: '#fff', fontWeight: 800, fontSize: 13, cursor: 'pointer' }}>
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
