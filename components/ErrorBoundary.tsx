import React from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface State {
  hasError: boolean;
  message: string;
}

interface Props {
  children: React.ReactNode;
  /** Nombre del módulo para mostrar en el mensaje de error */
  moduleName?: string;
}

export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, message: '' };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, message: error.message };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error(`[NEXUM ErrorBoundary] ${this.props.moduleName ?? 'Módulo'}:`, error, info.componentStack);
  }

  handleReset = () => {
    this.setState({ hasError: false, message: '' });
  };

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <div className="flex flex-col items-center justify-center h-[60vh] gap-8 text-center px-8">
        <div className="p-6 bg-red-600/10 rounded-[2rem] border border-red-500/20">
          <AlertTriangle className="text-red-500 mx-auto" size={40} />
        </div>
        <div className="space-y-3">
          <h3 className="text-lg font-black italic uppercase tracking-tighter text-white">
            Error en {this.props.moduleName ?? 'este módulo'}
          </h3>
          <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest max-w-sm">
            {this.state.message || 'Ocurrió un error inesperado. El equipo de desarrollo ha sido notificado.'}
          </p>
        </div>
        <button
          onClick={this.handleReset}
          className="flex items-center gap-3 px-8 py-4 bg-white/5 border border-white/10 hover:border-white/20 rounded-2xl text-[10px] font-black uppercase tracking-widest text-white transition-all hover:bg-white/10 active:scale-95"
        >
          <RefreshCw size={14} />
          Reintentar
        </button>
      </div>
    );
  }
}

export default ErrorBoundary;
