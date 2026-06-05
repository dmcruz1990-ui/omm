import React, { useState, useRef, useEffect, Suspense, lazy } from 'react';
import { 
  ShoppingCart, CalendarDays, Users, ChefHat, HeartPulse, 
  Truck, DollarSign, Globe, Zap, Settings, LogOut, Contact, 
  Layers, Briefcase,
  LayoutPanelLeft,
  Smartphone,
  BellRing,
  X,
  Brain,
  BarChart3,
  Receipt,
  Store,
  Loader2,
  ShieldCheck,
  Sparkles,
  Eye,
} from 'lucide-react';
import { supabase } from './lib/supabase.ts';
import { AuthProvider, useAuth } from './contexts/AuthContext.tsx';
import { RestaurantProvider, useRestaurant } from './contexts/RestaurantContext.tsx';
import { ModuleType, Table, RitualTask, UserRole } from './types.ts';
import { useMediaPipe } from './hooks/useMediaPipe.ts';
import Login from './components/Login.tsx';

const OhYeahPage = lazy(() => import('./components/OhYeahPage.tsx'));
const OhYeahCombined = lazy(() => import('./components/OhYeahCombined.tsx'));
const MobileManagerApp = lazy(() => import('./components/MobileManagerApp.tsx'));
const ReserveModule = lazy(() => import('./components/ReserveModule.tsx'));
const MenuModule = lazy(() => import('./components/MenuModule.tsx'));
const RelationshipModule = lazy(() => import('./components/RelationshipModule.tsx'));
const ServiceOSModule = lazy(() => import('./components/POSModule.tsx'));
const FlowModule = lazy(() => import('./components/FlowModule.tsx'));
const TerminalPagoModule = lazy(() => import('./components/TerminalPagoModule.tsx'));
const PuntosNXModule = lazy(() => import('./components/PuntosNXModule.tsx'));
const CrewAdminModule = lazy(() => import('./components/CrewAdminModule.tsx'));
const SupplyModule = lazy(() => import('./components/SupplyModule.tsx')); // Supply IA real
const MarketplaceModule = lazy(() => import('./components/MarketplaceModule.tsx'));
const PropinasModule = lazy(() => import('./components/PropinasModule.tsx'));
const MetricasModule = lazy(() => import('./components/MetricasModule.tsx'));
const FoodIntelligenceModule = lazy(() => import('./components/FoodIntelligenceModule.tsx'));
const CareModule = lazy(() => import('./components/CareModule.tsx'));
const FinanceHub = lazy(() => import('./components/FinanceHub.tsx'));
const CommandModule = lazy(() => import('./components/CommandModule.tsx'));
const SurveillanceModule = lazy(() => import('./components/SurveillanceModule.tsx'));
// ── CAMBIO 1: StaffHubModule → TeamIQ ──────────────────────────────────────
const TeamIQ = lazy(() => import('./components/TeamIQ.tsx'));
const SettingsModule = lazy(() => import('./components/SettingsModule.tsx'));
const PayrollModule = lazy(() => import('./components/PayrollModule.tsx'));
const WorkforceModule = lazy(() => import('./components/WorkforceModule.tsx'));
const ExecutiveCockpit = lazy(() => import('./components/ExecutiveCockpit.tsx'));
const DIANModule = lazy(() => import('./components/DIANModule.tsx'));
const ContabilidadModule = lazy(() => import('./components/ContabilidadModule.tsx'));
const PlanoOMM = lazy(() => import('./components/PlanoOMM.tsx'));
// OhYeahAdmin legacy removido — usar OhYeahAdminModule

const ModuleLoader = () => (
  <div className="flex flex-col items-center justify-center h-[60vh] opacity-50">
    <Loader2 className="text-blue-600 animate-spin mb-4" size={32} />
    <p className="text-[10px] font-black uppercase tracking-widest italic text-white">Sincronizando Core...</p>
  </div>
);

// Error boundary — un fallo en un módulo ya no tumba toda la app (sin pantalla negra)
class ModuleErrorBoundary extends React.Component<{children: React.ReactNode}, {error: Error|null}> {
  constructor(props: {children: React.ReactNode}) { super(props); this.state = { error: null }; }
  static getDerivedStateFromError(error: Error) { return { error }; }
  componentDidCatch(error: Error) { console.error('Módulo crasheó:', error); }
  render() {
    if (this.state.error) {
      return (
        <div className="flex flex-col items-center justify-center h-[70vh] text-center px-8">
          <div className="text-5xl mb-4">⚠️</div>
          <div className="text-lg font-black text-white mb-2">Este módulo tuvo un problema</div>
          <div className="text-[12px] text-gray-500 mb-6 max-w-md">
            El resto del sistema sigue funcionando. Recarga o cambia de módulo.
          </div>
          <button onClick={() => this.setState({ error: null })}
            className="px-6 py-2.5 rounded-xl bg-blue-600 text-white text-[12px] font-bold">
            Reintentar
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

const Dashboard: React.FC = () => {
  const { profile, signOut } = useAuth();
  const { activeId: restauranteActivoId } = useRestaurant();
  const [activeModule, setActiveModule] = useState<ModuleType>(ModuleType.SERVICE_OS);
  const [tables, setTables] = useState<Table[]>([]);
  const [ritualTasks, setRitualTasks] = useState<RitualTask[]>([]);
  const [dashboardLoading, setDashboardLoading] = useState(true);
  const [isClientView, setIsClientView] = useState(false);
  const [isCockpitOpen, setIsCockpitOpen] = useState(false);
  
  const [isVisionAIOpen, setIsVisionAIOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true); // abierto por defecto

  const isAdmin = profile?.role === 'admin' || profile?.role === 'gerencia' || profile?.role === 'desarrollo';

  // ── Listener global de navegación entre módulos (CustomEvent)
  // Permite que cualquier módulo dispare nx_open_module con un detail
  // { module: ModuleType, payload?: any } para saltar a otro módulo.
  useEffect(() => {
    const onOpen = (e: any) => {
      const m = e?.detail?.module;
      if (m != null && Object.values(ModuleType).includes(m)) {
        setActiveModule(m);
        if (e.detail.payload) {
          (window as any).__nx_module_payload = e.detail.payload;
        }
      }
    };
    window.addEventListener('nx_open_module', onOpen);
    return () => window.removeEventListener('nx_open_module', onOpen);
  }, []);

  useEffect(() => {
    const checkView = () => {
      const isOhYeah = window.location.hash.includes('/oh-yeah');
      if (isOhYeah && !isAdmin) {
        window.location.hash = '';
        setIsClientView(false);
      } else {
        setIsClientView(isOhYeah);
      }
    };
    checkView();
    window.addEventListener('hashchange', checkView);
    return () => window.removeEventListener('hashchange', checkView);
  }, [isAdmin]);

  const videoRef = useRef<HTMLVideoElement>(null);
  // Cámara se activa cuando el modal de Vision AI está abierto O cuando
  // el módulo VISION_AI del sidebar está activo. En cualquier otro caso
  // queda apagada para no pedir permiso al cargar la app ni gastar
  // batería con MediaPipe en background.
  const visionAIActivo = isVisionAIOpen || activeModule === ModuleType.VISION_AI;
  const { isCameraReady, lastResultsRef } = useMediaPipe(videoRef, visionAIActivo);

  const getVisibleModules = (role: UserRole = 'mesero'): ModuleType[] => {
    switch (role) {
      case 'admin':
      case 'desarrollo':
        return Object.values(ModuleType);
      case 'gerencia':
        return [
          ModuleType.RESERVE,
          ModuleType.PLANO,
          ModuleType.RELATIONSHIP,
          ModuleType.SERVICE_OS,
          ModuleType.CARE,
          ModuleType.FINANCE_HUB,
          ModuleType.COMMAND,
          ModuleType.STAFF_HUB,
          ModuleType.WORKFORCE,
          ModuleType.PAYROLL,
          ModuleType.SUPPLY,
          ModuleType.MENU,
          ModuleType.MARKETPLACE,
          ModuleType.FOOD_INTELLIGENCE,
          ModuleType.FLOW,
          ModuleType.TERMINAL_PAGO,
          ModuleType.VISION_AI,
          ModuleType.PUNTOS_NX,
          ModuleType.CREW_ADMIN,
          ModuleType.MOBILE_MGR,
          ModuleType.OH_YEAH
        ];
      case 'maitre':
        return [
          ModuleType.SERVICE_OS,
          ModuleType.RESERVE,
          ModuleType.PLANO,
          ModuleType.RELATIONSHIP,
          ModuleType.CARE,
        ];
      case 'mesero':
        return [
          ModuleType.SERVICE_OS,
          ModuleType.RESERVE,
          ModuleType.RELATIONSHIP,
          ModuleType.MENU,
          ModuleType.MARKETPLACE,
          ModuleType.FOOD_INTELLIGENCE,
          ModuleType.STAFF_HUB,
          ModuleType.PUNTOS_NX,
          ModuleType.OH_YEAH
        ];
      case 'cocina':
        return [
          ModuleType.FLOW, 
          ModuleType.SUPPLY,
          ModuleType.STAFF_HUB
        ];
      default:
        return [ModuleType.SERVICE_OS];
    }
  };

  // useMemo evita que la lista se recree en cada render y dispare el effect
  // en loop (estaba causando oscilación de activeModule en algunos roles).
  const visibleModulesList = React.useMemo(
    () => getVisibleModules(profile?.role),
    [profile?.role]
  );

  useEffect(() => {
    if (visibleModulesList.length > 0 && !visibleModulesList.includes(activeModule)) {
      setActiveModule(visibleModulesList[0]);
    }
  }, [activeModule, visibleModulesList]);

  const fetchData = async () => {
    try {
      const { data: tablesData } = await supabase
        .from('tables')
        .select(`*`)
        .eq('restaurante_id', restauranteActivoId)
        .order('id', { ascending: true });

      setTables(tablesData || []);
      
      const { data: tasksData } = await supabase.from('ritual_tasks').select('*').eq('status', 'active');
      setRitualTasks(tasksData || []);
    } catch {
      console.warn("Sync Error");
    } finally {
      setDashboardLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    const channel = supabase.channel(`main-sync-${restauranteActivoId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tables' }, () => fetchData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'ritual_tasks' }, () => fetchData())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [restauranteActivoId]);

  const handleUpdateTable = async (tableId: number, updates: Partial<Table>) => {
    await supabase.from('tables').update(updates).eq('id', tableId);
  };

  if (dashboardLoading) return (
    <div className="h-screen w-full bg-[#0a0a0c] flex flex-col items-center justify-center">
       <Zap className="text-blue-600 animate-pulse mb-4" size={48} />
       <p className="text-[10px] font-black uppercase tracking-[0.3em] text-gray-500 italic text-white">Sincronizando Core Intelligence...</p>
    </div>
  );

  if ((isClientView || activeModule === ModuleType.OH_YEAH)) return (
    <Suspense fallback={<ModuleLoader />}>
      <OhYeahPage onExit={() => setActiveModule(ModuleType.SERVICE_OS)} />
    </Suspense>
  );

  if (activeModule === ModuleType.MOBILE_MGR && isAdmin) {
    return (
      <Suspense fallback={<ModuleLoader />}>
        <MobileManagerApp onExit={() => setActiveModule(ModuleType.SERVICE_OS)} />
      </Suspense>
    );
  }

  // Ruta /crew — SerattaCrewPage vive en el repo separado seratta-crew, no aquí

  return (
    <div className="flex h-screen w-full overflow-hidden bg-[#0a0a0c] text-white font-sans text-left">
      <nav className={`bg-[#0a0a0c] border-r border-white/5 flex flex-col z-50 overflow-y-auto overflow-x-hidden transition-all duration-300 shrink-0 ${sidebarOpen ? 'w-[300px] px-6 py-8 opacity-100' : 'w-0 px-0 py-0 opacity-0 pointer-events-none'}`} style={{minWidth:sidebarOpen?300:0}}>
        <div className="flex items-center gap-4 mb-12 px-2 whitespace-nowrap">
          <div className="w-12 h-12 bg-blue-600 rounded-2xl flex items-center justify-center shadow-lg shadow-blue-600/30">
            <Zap className="text-white" size={24} fill="currentColor" />
          </div>
          <div>
            <h1 className="text-2xl font-black tracking-tighter italic leading-none">NEXUM <span className="text-blue-600">V4</span></h1>
            <p className="text-[9px] text-gray-500 font-bold uppercase tracking-[0.2em] mt-1">OPERATIONAL CORE</p>
          </div>
        </div>

        <div className="mb-6 px-4 space-y-2">
           <div className="bg-white/5 border border-white/10 rounded-xl px-4 py-2 flex items-center justify-between">
              <span className="text-[8px] font-black text-gray-500 uppercase tracking-widest">Rol:</span>
              <span className="text-[9px] font-black text-blue-500 uppercase italic">{profile?.role}</span>
           </div>
           <RestaurantSelector />
        </div>

        {/* Botones grandes NEXUM COPILOT + MODO ANDROID ocultados a pedido
            de Dale. ExecutiveCockpit y MobileManagerApp siguen montados
            (se pueden invocar por código si hace falta) pero no aparecen
            como botones top en el sidebar. */}

        <div className="space-y-10 mb-10">
          {[
            {
              id: 'guesthub', label: 'GUESTHUB',
              icon: <Sparkles size={14} className="text-blue-500" />,
              modules: [
                { type: ModuleType.RESERVE,        label: 'RESERVE',       sub: 'MAPA & AGENDA',      icon: <CalendarDays size={18} /> },
                { type: ModuleType.RELATIONSHIP,   label: 'CLIENTES',      sub: 'CRM & VIP',          icon: <Users size={18} /> },
                { type: ModuleType.OH_YEAH_ADMIN,  label: 'OH YEAH',       sub: 'PLATAFORMA · ADMIN & REG', icon: <span style={{fontSize:18}}>😎</span> },
              ]
            },
            {
              id: 'showtime', label: 'SHOWTIME',
              modules: [
                { type: ModuleType.SERVICE_OS,    label: 'SMART POS',         sub: 'POS & RITUALES',   icon: <ShoppingCart size={18} /> },
                { type: ModuleType.FLOW,          label: 'FLOW',              sub: 'ESTACIONES · TIEMPOS', icon: <ChefHat size={18} /> },
                { type: ModuleType.VISION_AI,     label: 'VISION AI',         sub: 'CÁMARAS · IA TIEMPO REAL', icon: <Eye size={18} /> },
                { type: ModuleType.TERMINAL_PAGO, label: 'TERMINAL DE PAGO',  sub: 'CAJA · CUENTAS POR COBRAR', icon: <Receipt size={18} /> },
              ]
            },
            {
              id: 'teamcore', label: 'TEAM CORE',
              icon: <Brain size={14} className="text-orange-500" />,
              modules: [
                { type: ModuleType.STAFF_HUB,   label: 'TEAM IQ™',   sub: 'HUMAN PERFORMANCE', icon: <Brain size={18} /> },
                { type: ModuleType.WORKFORCE,   label: 'WORKFORCE',  sub: 'HORARIOS · ASISTENCIA · NÓMINA', icon: <CalendarDays size={18} /> },
                { type: ModuleType.PROPINAS,    label: 'PROPINAS',   sub: 'Bolsa del turno',   icon: <DollarSign size={18} /> },
                { type: ModuleType.PUNTOS_NX,   label: 'PUNTOS NX',  sub: 'Wallet · Beneficios · Retos · Canjes', icon: <span style={{fontSize:18,color:'#9b72ff'}}>✦</span> },
                { type: ModuleType.CREW_ADMIN,  label: 'CREW ADMIN', sub: 'Backoffice app Seratta Crew', icon: <span style={{fontSize:16,color:'#FF5C35'}}>📱</span> },
              ]
            },
            {
              id: 'control', label: 'CONTROL & SUMINISTROS',
              icon: <ShieldCheck size={14} className="text-green-500" />,
              modules: [
                { type: ModuleType.SUPPLY,    label: 'SUPPLY IA', sub: 'Abastecimiento', icon: <Truck size={18} /> },
                { type: ModuleType.FOOD_INTELLIGENCE, label: 'FOOD INTEL™', sub: 'IA Gastronómica', icon: <Zap size={18} /> },
                { type: ModuleType.MENU,      label: 'MI MENÚ',   sub: 'Carta · Recetas · Food Cost · Supply', icon: <span style={{ fontSize: 16 }}>🍽️</span> },
                { type: ModuleType.MARKETPLACE, label: 'MARKETPLACE', sub: 'Tienda', icon: <Store size={18} /> },
                { type: ModuleType.CARE,      label: 'CARE',      sub: 'SOPORTE CX',        icon: <HeartPulse size={18} /> },
              ]
            },
            {
              id: 'estrategia', label: 'ESTRATEGIA & ADMIN',
              icon: <Globe size={14} className="text-purple-500" />,
              modules: [
                { type: ModuleType.COMMAND,       label: 'COMANDANTE',   sub: 'ESTRATEGIA IA',        icon: <Globe size={18} /> },
                { type: ModuleType.FINANCE_HUB,  label: 'FINANCE HUB',  sub: 'DINERO & KPI',         icon: <DollarSign size={18} /> },
                { type: ModuleType.PAYROLL,       label: 'NÓMINA DIAN',  sub: 'INTELIGENCIA LABORAL', icon: <Briefcase size={18} /> },
                { type: ModuleType.DIAN,          label: 'FACTURACIÓN',  sub: 'DIAN · UBL 2.1',       icon: <Receipt size={18} /> },
                { type: ModuleType.CONTABILIDAD,  label: 'CONTABILIDAD', sub: 'P&G · CIERRE · KPI',   icon: <BarChart3 size={18} /> },
                { type: ModuleType.CONFIG,        label: 'CEREBRO',      sub: 'ADN & IA',             icon: <Settings size={18} /> }
              ]
            }
          ].map((pkg) => {
            const visiblePkgModules = pkg.modules.filter(m => visibleModulesList.includes(m.type));
            if (visiblePkgModules.length === 0) return null;
            return (
              <div key={pkg.id} className="space-y-4">
                <div className="flex items-center gap-3 px-4 py-1">
                  <div className="opacity-60">{pkg.icon}</div>
                  <span className="text-[9px] font-black text-gray-500 uppercase tracking-[0.3em] italic">{pkg.label}</span>
                </div>
                <div className="flex flex-col gap-1">
                  {visiblePkgModules.map((m) => (
                    <button key={m.type} onClick={() => setActiveModule(m.type)}
                      className={`flex items-center gap-4 w-full px-4 py-3.5 rounded-2xl transition-all duration-300 group ${
                        activeModule === m.type
                          ? 'bg-white/5 border border-white/10 text-white shadow-xl'
                          : 'text-gray-500 hover:bg-white/5 hover:text-white border border-transparent'
                      }`}>
                      <div className={`${activeModule === m.type ? 'text-blue-500' : 'text-gray-600 group-hover:text-blue-400'}`}>{m.icon}</div>
                      <div className="text-left">
                        <p className={`text-[10px] font-black tracking-widest leading-none mb-1 ${activeModule === m.type ? 'text-white' : 'text-gray-400 group-hover:text-white'}`}>{m.label}</p>
                        <p className={`text-[7px] font-bold uppercase tracking-wider ${activeModule === m.type ? 'text-blue-400' : 'text-gray-600'}`}>{m.sub}</p>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
        </div>

        <div className="mt-auto pt-8 border-t border-white/5">
           <button onClick={signOut} className="flex items-center gap-3 px-6 text-gray-600 hover:text-red-500 transition-all text-[10px] font-black uppercase tracking-widest w-full">
             <LogOut size={16} /> CERRAR SESIÓN
           </button>
        </div>
      </nav>

      {/* Botón flotante para mostrar/ocultar sidebar — siempre visible (sobrevive al header oculto del POS en tablet) */}
      <button
        onClick={() => setSidebarOpen(p=>!p)}
        title={sidebarOpen ? 'Ocultar menú Nexum' : 'Mostrar menú Nexum'}
        className="fixed top-2 z-[9500] w-8 h-8 rounded-lg bg-[#1a1d24] border border-blue-500/40 text-blue-400 hover:bg-blue-500/20 hover:text-white transition-all flex items-center justify-center shadow-lg"
        style={{left: sidebarOpen ? 308 : 8}}>
        <LayoutPanelLeft size={14} />
      </button>

      <main className="flex-1 flex flex-col overflow-hidden relative bg-[#0f1115]">
        <header className="h-10 border-b border-white/5 flex items-center justify-between px-4 z-40 bg-[#0a0a0c] shrink-0">
          {/* Izquierda: nombre (botón sidebar movido a flotante arriba del header) */}
          <div className="flex items-center gap-2 ml-10">
            <div className="flex items-center gap-2 px-3 py-1 rounded-lg bg-white/5 border border-white/5">
              <div className="w-5 h-5 rounded-full bg-blue-900/40 border border-blue-500/40 flex items-center justify-center text-blue-400 text-[9px] font-black">
                {(profile?.nombre_completo || profile?.full_name || 'U').charAt(0).toUpperCase()}
              </div>
              <span className="text-[10px] font-bold text-white">
                {profile?.nombre_completo?.split(' ')[0] || profile?.full_name?.split(' ')[0] || 'Usuario'}
              </span>
              <span className="text-[8px] font-bold text-blue-400 uppercase tracking-wider px-1.5 py-0.5 bg-blue-500/10 rounded">
                {profile?.role === 'admin' ? 'Admin' : profile?.role === 'gerencia' ? 'Gerencia' : profile?.role === 'desarrollo' ? 'Dev' : 'Mesero'}
              </span>
              <button onClick={signOut} className="ml-1 text-gray-600 hover:text-red-400 transition-colors" title="Cerrar sesión">
                <LogOut size={11} />
              </button>
            </div>
          </div>

          {/* Derecha: indicador del sistema */}
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" title="System Online"/>
          </div>
        </header>

        <div className="flex-1 overflow-hidden relative z-10">
          <ModuleErrorBoundary key={activeModule}>
          <Suspense fallback={<ModuleLoader />}>
            {activeModule === ModuleType.SERVICE_OS && (
              <div className="h-full flex flex-col">
                <ServiceOSModule tables={tables} onUpdateTable={handleUpdateTable} tasks={ritualTasks} onOpenVisionAI={() => setIsVisionAIOpen(true)} />
                {isVisionAIOpen && (
                  <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-8">
                    <div className="bg-[#0f1115] border border-white/10 rounded-2xl w-full max-w-6xl h-[80vh] flex flex-col overflow-hidden shadow-2xl relative">
                      <div className="flex justify-between items-center p-4 border-b border-white/10 bg-[#1a1d24]">
                        <h2 className="text-lg font-bold text-white flex items-center gap-2">Vision AI - Monitoreo en Vivo</h2>
                        <button onClick={() => setIsVisionAIOpen(false)} className="text-gray-400 hover:text-white transition-colors"><X size={24} /></button>
                      </div>
                      <div className="flex-1 overflow-y-auto p-6">
                        <SurveillanceModule videoRef={videoRef} isCameraReady={isCameraReady} resultsRef={lastResultsRef} tables={tables} onManualTrigger={async(id) => handleUpdateTable(id, {status: 'calling'})} />
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
            {activeModule === ModuleType.FLOW && (
              <div className="h-full">
                <FlowModule />
              </div>
            )}
            {activeModule === ModuleType.TERMINAL_PAGO && (
              <div className="h-full">
                <TerminalPagoModule />
              </div>
            )}
            {activeModule === ModuleType.PUNTOS_NX && (
              <div className="h-full">
                <PuntosNXModule />
              </div>
            )}
            {activeModule === ModuleType.CREW_ADMIN && (
              <div className="h-full">
                <CrewAdminModule />
              </div>
            )}
            {activeModule === ModuleType.VISION_AI && (
              <div className="h-full overflow-y-auto custom-scrollbar p-6 text-left">
                <SurveillanceModule
                  videoRef={videoRef}
                  isCameraReady={isCameraReady}
                  resultsRef={lastResultsRef}
                  tables={tables}
                  onManualTrigger={async(id) => handleUpdateTable(id, { status: 'calling' })}
                />
              </div>
            )}
            {activeModule !== ModuleType.SERVICE_OS && activeModule !== ModuleType.FLOW && activeModule !== ModuleType.VISION_AI && activeModule !== ModuleType.TERMINAL_PAGO && activeModule !== ModuleType.PUNTOS_NX && activeModule !== ModuleType.CREW_ADMIN && (
              <div className="h-full overflow-y-auto custom-scrollbar p-6 text-left">
                {activeModule === ModuleType.RESERVE       && <ReserveModule />}
                {activeModule === ModuleType.PLANO         && <PlanoOMM onOpenPOS={() => setActiveModule(ModuleType.SERVICE_OS)} />}
                {activeModule === ModuleType.FINANCE_HUB   && <FinanceHub />}
                {activeModule === ModuleType.PAYROLL        && <PayrollModule />}
                {activeModule === ModuleType.WORKFORCE      && <WorkforceModule />}
                {activeModule === ModuleType.COMMAND        && <CommandModule onSimulateEvent={() => {}} />}
                {activeModule === ModuleType.RELATIONSHIP   && <RelationshipModule />}
                {activeModule === ModuleType.SUPPLY        && <SupplyModule />}
                {activeModule === ModuleType.STAFF_HUB      && <TeamIQ />}
                {activeModule === ModuleType.SUPPLY         && <SupplyModule />}
                {activeModule === ModuleType.CARE           && <CareModule />}
                {activeModule === ModuleType.DIAN           && <DIANModule />}
                {activeModule === ModuleType.CONTABILIDAD   && <ContabilidadModule />}
                {/* Oh Yeah B2B (Admin / Registro Externo) ocultos del sidebar pero el código sigue disponible */}
                {(activeModule === ModuleType.OH_YEAH_ADMIN || activeModule === ModuleType.OH_YEAH_RESTAURANTE) && <OhYeahCombined />}
                {activeModule === ModuleType.CONFIG         && <SettingsModule />}
                {activeModule === ModuleType.MARKETPLACE    && <MarketplaceModule />}
                {activeModule === ModuleType.FOOD_INTELLIGENCE && <FoodIntelligenceModule />}
                {activeModule === ModuleType.METRICAS && <MetricasModule />}
                {activeModule === ModuleType.MENU && <MenuModule />}
                {activeModule === ModuleType.PROPINAS && <PropinasModule />}
              </div>
            )}
          </Suspense>
          </ModuleErrorBoundary>
        </div>
      </main>

      <Suspense fallback={null}>
        {(profile?.role === 'admin' || profile?.role === 'gerencia' || profile?.role === 'desarrollo') &&
          <ExecutiveCockpit isOpen={isCockpitOpen} onClose={() => setIsCockpitOpen(false)} />
        }
      </Suspense>
      <video ref={videoRef} className="absolute opacity-0 pointer-events-none" playsInline muted autoPlay />
    </div>
  );
};

const AppContent: React.FC = () => {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <div className="h-screen w-full bg-[#0a0a0c] flex flex-col items-center justify-center">
         <Zap className="text-blue-600 animate-pulse mb-4" size={48} />
         <p className="text-[10px] font-black uppercase tracking-[0.3em] text-gray-500 italic text-white">Sincronizando Core Intelligence...</p>
      </div>
    );
  }
  return user ? <Dashboard /> : <Login />;
};

// Preview Hallmark — solo visible si la URL trae ?preview=hallmark
const HallmarkPreview = lazy(() => import('./experiments/hallmark/HallmarkPreview'));

const App: React.FC = () => {
  // Guard: si está activo el preview, saltarse el flujo normal.
  // Los usuarios sin la query string jamás llegan al sandbox.
  if (typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('preview') === 'hallmark') {
    return (
      <Suspense fallback={<div style={{minHeight:'100vh',background:'#06060c'}}/>}>
        <HallmarkPreview />
      </Suspense>
    );
  }
  return (
    <AuthProvider>
      <RestaurantProvider>
        <AppContent />
      </RestaurantProvider>
    </AuthProvider>
  );
};

// ── Selector de restaurante (solo visible para admin/gerencia/desarrollo) ──
const RestaurantSelector: React.FC = () => {
  const { activeId, activeRestaurant, canSwitch, setActiveId, options } = useRestaurant();
  const [open, setOpen] = useState(false);
  if (!canSwitch) {
    // Mesero/cocina: solo lectura
    return (
      <div className="bg-white/5 border border-white/10 rounded-xl px-4 py-2 flex items-center justify-between">
        <span className="text-[8px] font-black text-gray-500 uppercase tracking-widest">Restaurante:</span>
        <span className="text-[10px] font-black text-white">{activeRestaurant.emoji} {activeRestaurant.nombre}</span>
      </div>
    );
  }
  // Flechas ‹ › para saltar al restaurante anterior/siguiente en la lista.
  const idx = options.findIndex(o => o.id === activeId);
  const irPrev = () => setActiveId(options[(idx - 1 + options.length) % options.length].id);
  const irNext = () => setActiveId(options[(idx + 1) % options.length].id);
  const hayMas = options.length > 1;

  return (
    <div className="relative">
      <div className="w-full bg-gradient-to-br from-purple-700/30 to-blue-700/30 border border-purple-500/40 rounded-xl flex items-stretch">
        {/* Flecha izquierda */}
        <button onClick={irPrev} disabled={!hayMas}
          aria-label="Restaurante anterior"
          className="px-2.5 flex items-center justify-center text-purple-200 hover:text-white hover:bg-white/10 transition-all disabled:opacity-30 rounded-l-xl border-r border-white/10">
          <span className="text-base font-bold leading-none">‹</span>
        </button>

        {/* Centro: abre dropdown completo */}
        <button onClick={() => setOpen(v => !v)}
          className="flex-1 px-2 py-2.5 flex items-center gap-2 hover:bg-white/5 transition-all">
          <span className="text-lg">{activeRestaurant.emoji}</span>
          <div className="text-left flex-1 min-w-0">
            <div className="text-[11px] font-black text-white uppercase tracking-wide truncate">{activeRestaurant.nombre}</div>
            <div className="text-[8px] text-purple-200 truncate">{activeRestaurant.categoria}</div>
          </div>
          <span className="text-[7px] text-purple-300">▼</span>
        </button>

        {/* Flecha derecha */}
        <button onClick={irNext} disabled={!hayMas}
          aria-label="Restaurante siguiente"
          className="px-2.5 flex items-center justify-center text-purple-200 hover:text-white hover:bg-white/10 transition-all disabled:opacity-30 rounded-r-xl border-l border-white/10">
          <span className="text-base font-bold leading-none">›</span>
        </button>
      </div>

      {open && (
        <div className="absolute top-full mt-1 left-0 right-0 bg-[#0f0f1a] border border-white/15 rounded-xl overflow-hidden z-50 shadow-2xl">
          {options.map(o => (
            <button key={o.id} onClick={() => { setActiveId(o.id); setOpen(false); }}
              className={`w-full px-4 py-2.5 flex items-center gap-2 hover:bg-white/10 transition-all ${o.id === activeId ? 'bg-blue-600/20' : ''}`}>
              <span className="text-lg">{o.emoji}</span>
              <div className="text-left flex-1">
                <div className="text-[11px] font-black text-white uppercase">{o.nombre}</div>
                <div className="text-[9px] text-gray-400">{o.categoria}</div>
              </div>
              {o.id === activeId && <span className="text-[9px] text-blue-400">●</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default App;
