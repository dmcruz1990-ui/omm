
import React, { useState, useRef, useEffect, Suspense, lazy } from 'react';
import { 
  ShoppingCart, CalendarDays, Users, ChefHat, HeartPulse, 
  Truck, DollarSign, Globe, Zap, Settings, LogOut, Contact, 
  ShieldCheck, Compass, Loader2, MonitorPlay, Sparkles, Palette,
  ChevronDown, Layers, CameraOff, AlertTriangle, RefreshCw, Music,
  // Added missing Briefcase import
  Briefcase
} from 'lucide-react';
import { supabase } from './lib/supabase.ts';
import { AuthProvider, useAuth } from './contexts/AuthContext.tsx';
import { ModuleType, Table, RitualTask, UserRole } from './types.ts';
import { useMediaPipe } from './hooks/useMediaPipe.ts';
import Login from './components/Login.tsx';

const OhYeahPage = lazy(() => import('./components/OhYeahPage.tsx'));
const DiscoverModule = lazy(() => import('./components/DiscoverModule.tsx'));
const ReserveModule = lazy(() => import('./components/ReserveModule.tsx'));
const RelationshipModule = lazy(() => import('./components/RelationshipModule.tsx'));
const ServiceOSModule = lazy(() => import('./components/POSModule.tsx'));
const FlowModule = lazy(() => import('./components/FlowModule.tsx'));
const SupplyModule = lazy(() => import('./components/SupplyModule.tsx'));
const CareModule = lazy(() => import('./components/CareModule.tsx'));
const FinanceHub = lazy(() => import('./components/FinanceHub.tsx'));
const CommandModule = lazy(() => import('./components/CommandModule.tsx'));
const SurveillanceModule = lazy(() => import('./components/SurveillanceModule.tsx'));
const KitchenModule = lazy(() => import('./components/KitchenModule.tsx'));
const StaffHubModule = lazy(() => import('./components/StaffHubModule.tsx'));
const BrandStudio = lazy(() => import('./components/BrandStudio.tsx'));
const SettingsModule = lazy(() => import('./components/SettingsModule.tsx'));
const PayrollModule = lazy(() => import('./components/PayrollModule.tsx'));

const ModuleLoader = () => (
  <div className="flex flex-col items-center justify-center h-[60vh] opacity-50">
    <Loader2 className="text-blue-600 animate-spin mb-4" size={32} />
    <p className="text-[10px] font-black uppercase tracking-widest italic">Sincronizando Core...</p>
  </div>
);

const Dashboard: React.FC = () => {
  const { user, profile, signOut } = useAuth();
  const [activeModule, setActiveModule] = useState<ModuleType>(ModuleType.DISCOVER);
  const [tables, setTables] = useState<any[]>([]);
  const [ritualTasks, setRitualTasks] = useState<RitualTask[]>([]);
  const [dashboardLoading, setDashboardLoading] = useState(true);
  const [activeStation, setActiveStation] = useState(1);
  const [isClientView, setIsClientView] = useState(false);

  useEffect(() => {
    const checkView = () => {
      setIsClientView(window.location.hash.includes('/oh-yeah'));
    };
    checkView();
    window.addEventListener('hashchange', checkView);
    return () => window.removeEventListener('hashchange', checkView);
  }, []);

  const videoRef = useRef<HTMLVideoElement>(null);
  const { isCameraReady, lastResultsRef, error: cameraError, retry: retryCamera } = useMediaPipe(videoRef, activeModule === ModuleType.SERVICE_OS);

  const getVisibleModules = (role: UserRole = 'mesero'): ModuleType[] => {
    switch (role) {
      case 'admin':
      case 'desarrollo':
        return Object.values(ModuleType);
      case 'gerencia':
        return Object.values(ModuleType).filter(m => m !== ModuleType.COMMAND && m !== ModuleType.CONFIG);
      case 'mesero':
        return [ModuleType.DISCOVER, ModuleType.SERVICE_OS, ModuleType.RESERVE, ModuleType.RELATIONSHIP, ModuleType.STAFF_HUB];
      case 'chef':
        return [ModuleType.KITCHEN_KDS, ModuleType.FLOW, ModuleType.SUPPLY];
      default:
        return [ModuleType.DISCOVER];
    }
  };

  const visibleModulesList = getVisibleModules(profile?.role);

  useEffect(() => {
    if (!visibleModulesList.includes(activeModule)) {
      setActiveModule(visibleModulesList[0]);
    }
  }, [profile?.role]);

  const fetchData = async () => {
    try {
      const { data: tablesData } = await supabase
        .from('tables')
        .select(`*, reservations(id, status, customer_id, customers(name))`)
        .order('id', { ascending: true });

      const processedTables = tablesData?.map(table => {
        const activeRes = table.reservations?.find((r: any) => 
          r.status === 'confirmed' || r.status === 'reserved' || r.status === 'seated'
        );
        return {
          ...table,
          active_customer: activeRes?.customers?.name || null,
          active_reservation_id: activeRes?.id || null
        };
      });

      setTables(processedTables || []);
      const { data: tasksData } = await supabase.from('ritual_tasks').select('*').eq('status', 'active');
      setRitualTasks(tasksData || []);
    } catch (err) {
      console.warn("Sync Error");
    } finally {
      setDashboardLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    const channel = supabase.channel('main-sync')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tables' }, () => fetchData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'ritual_tasks' }, () => fetchData())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  const handleUpdateTable = async (tableId: number, updates: Partial<Table>) => {
    await supabase.from('tables').update(updates).eq('id', tableId);
  };

  if (dashboardLoading) return (
    <div className="h-screen w-full bg-[#0a0a0c] flex flex-col items-center justify-center">
       <Zap className="text-blue-600 animate-pulse mb-4" size={48} />
       <p className="text-[10px] font-black uppercase tracking-[0.3em] text-gray-500 italic">Sincronizando Core Intelligence...</p>
    </div>
  );

  if (isClientView) {
    return (
      <div className="h-screen w-full overflow-hidden">
        <Suspense fallback={<ModuleLoader />}>
          <OhYeahPage />
        </Suspense>
      </div>
    );
  }

  const modulePackages = [
    {
      id: 'marketing',
      label: 'PAQUETE MARKETING',
      icon: <Sparkles size={14} className="text-blue-500" />,
      modules: [
        { type: ModuleType.DISCOVER, label: 'DESCUBRE OMM', sub: 'WEB & PLANES', icon: <Compass size={18} /> },
        { type: ModuleType.RESERVE, label: 'RESERVE', sub: 'MAPA & AGENDA', icon: <CalendarDays size={18} /> },
        { type: ModuleType.RELATIONSHIP, label: 'CLIENTES', sub: 'CRM & VIP', icon: <Users size={18} /> },
      ]
    },
    {
      id: 'operaciones',
      label: 'PAQUETE OPERACIONES',
      icon: <Layers size={14} className="text-orange-500" />,
      modules: [
        { type: ModuleType.SERVICE_OS, label: 'SERVICE OS', sub: 'POS & RITUALES', icon: <ShoppingCart size={18} /> },
        { type: ModuleType.KITCHEN_KDS, label: 'KITCHEN KDS', sub: 'ESTACIÓN COCINA', icon: <MonitorPlay size={18} /> },
        { type: ModuleType.FLOW, label: 'FLOW', sub: 'ESTACIONES', icon: <ChefHat size={18} /> },
      ]
    },
    {
      id: 'control',
      label: 'CONTROL & SUMINISTROS',
      icon: <ShieldCheck size={14} className="text-green-500" />,
      modules: [
        { type: ModuleType.SUPPLY, label: 'SUPPLY', sub: 'STOCK IA', icon: <Truck size={18} /> },
        { type: ModuleType.CARE, label: 'CARE', sub: 'SOPORTE CX', icon: <HeartPulse size={18} /> },
        { type: ModuleType.STAFF_HUB, label: 'STAFF HUB', sub: 'RANKING & COACH', icon: <Contact size={18} /> },
      ]
    },
    {
      id: 'estrategia',
      label: 'ESTRATEGIA & ADMIN',
      icon: <Globe size={14} className="text-purple-500" />,
      modules: [
        { type: ModuleType.COMMAND, label: 'COMMAND', sub: 'ESTRATEGIA IA', icon: <Globe size={18} /> },
        { type: ModuleType.FINANCE_HUB, label: 'FINANCE HUB', sub: 'DINERO & KPI', icon: <DollarSign size={18} /> },
        // Fix: icon now uses imported Briefcase
        { type: ModuleType.PAYROLL, label: 'NÓMINA DIAN', sub: 'INTELIGENCIA LABORAL', icon: <Briefcase size={18} /> },
        { type: ModuleType.BRAND_STUDIO, label: 'BRAND STUDIO', sub: 'DISEÑO CMS', icon: <Palette size={18} /> },
        { type: ModuleType.CONFIG, label: 'CEREBRO', sub: 'ADN & IA', icon: <Settings size={18} /> }
      ]
    }
  ];

  return (
    <div className="flex h-screen w-full overflow-hidden bg-[#0a0a0c] text-white font-sans text-left">
      <nav className="w-[300px] bg-[#0a0a0c] border-r border-white/5 flex flex-col px-6 py-8 z-50 overflow-y-auto custom-scrollbar">
        <div className="flex items-center gap-4 mb-12 px-2">
          <div className="w-12 h-12 bg-blue-600 rounded-2xl flex items-center justify-center shadow-lg shadow-blue-600/30">
            <Zap className="text-white" size={24} fill="currentColor" />
          </div>
          <div>
            <h1 className="text-2xl font-black tracking-tighter italic leading-none">NEXUM <span className="text-blue-600">V4</span></h1>
            <p className="text-[9px] text-gray-500 font-bold uppercase tracking-[0.2em] mt-1">OPERATIONAL CORE</p>
          </div>
        </div>

        <div className="space-y-10 mb-10">
          {modulePackages.map((pkg) => {
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
                    <button
                      key={m.type}
                      onClick={() => setActiveModule(m.type)}
                      className={`flex items-center gap-4 w-full px-4 py-3.5 rounded-2xl transition-all duration-300 group ${
                        activeModule === m.type 
                          ? 'bg-white/5 border border-white/10 text-white shadow-xl' 
                          : 'text-gray-500 hover:bg-white/5 hover:text-white border border-transparent'
                      }`}
                    >
                      <div className={`${activeModule === m.type ? 'text-blue-500' : 'text-gray-600 group-hover:text-blue-400'} transition-colors`}>{m.icon}</div>
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
           <button 
            onClick={() => window.location.hash = '/oh-yeah'} 
            className="w-full bg-blue-600/5 border border-blue-500/20 rounded-[1.8rem] p-5 flex flex-col gap-2 mb-6 group hover:bg-blue-600 transition-all shadow-lg shadow-blue-900/10"
           >
              <div className="flex items-center gap-3">
                 <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center text-white group-hover:bg-white group-hover:text-blue-600 shadow-lg">
                    <Sparkles size={16} />
                 </div>
                 <span className="text-[10px] font-black uppercase tracking-widest text-white">Ir a OH YEAH!</span>
              </div>
              <p className="text-[8px] text-gray-500 group-hover:text-blue-100 font-bold uppercase tracking-widest text-left">VISTA CLIENTE B2C</p>
           </button>
          <button onClick={signOut} className="flex items-center gap-3 px-6 text-gray-600 hover:text-red-500 transition-all text-[10px] font-black uppercase tracking-widest w-full">
            <LogOut size={16} /> CERRAR SESIÓN
          </button>
        </div>
      </nav>

      <main className="flex-1 flex flex-col overflow-hidden relative">
        <header className="h-20 border-b border-white/5 flex items-center justify-between px-12 z-40 bg-[#0a0a0c]/80 backdrop-blur-xl shrink-0">
          <div className="flex items-center gap-4">
             <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
             <h2 className="text-[10px] font-black text-gray-500 uppercase tracking-[0.4em] italic">OMM_OPERATIONAL_NODE_{profile?.role?.toUpperCase()}</h2>
          </div>
          
          {cameraError && (
             <div className="flex items-center gap-4 bg-red-600/10 border border-red-500/30 px-4 py-2 rounded-xl animate-pulse">
                <AlertTriangle size={14} className="text-red-500" />
                <span className="text-[9px] font-black text-red-500 uppercase italic">{cameraError}</span>
                <button onClick={retryCamera} className="bg-red-600 text-white p-1 rounded hover:bg-red-500 transition-all">
                   <RefreshCw size={12} />
                </button>
             </div>
          )}

          <div className="flex items-center gap-6">
             <div className="text-right">
                <span className="text-[8px] text-gray-600 font-black uppercase block leading-none">Usuario Activo</span>
                <span className="text-[10px] font-bold italic text-white">{profile?.full_name}</span>
             </div>
             <div className="w-10 h-10 rounded-full bg-blue-600/20 border border-blue-500/30 flex items-center justify-center">
                <Users size={18} className="text-blue-500" />
             </div>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto custom-scrollbar p-12 relative z-10 text-left">
          <Suspense fallback={<ModuleLoader />}>
            {activeModule === ModuleType.DISCOVER && <DiscoverModule />}
            {activeModule === ModuleType.SERVICE_OS && (
              <div className="space-y-12">
                <SurveillanceModule 
                  videoRef={videoRef} 
                  isCameraReady={isCameraReady} 
                  resultsRef={lastResultsRef} 
                  tables={tables} 
                  onCheckService={async(id) => handleUpdateTable(id, {status: 'occupied'})} 
                  activeStation={activeStation} 
                  setActiveStation={setActiveStation} 
                  onManualTrigger={async(id) => handleUpdateTable(id, {status: 'calling'})} 
                  cameraError={cameraError}
                  onRetryCamera={retryCamera}
                />
                <ServiceOSModule tables={tables} onUpdateTable={handleUpdateTable} tasks={ritualTasks} />
              </div>
            )}
            {activeModule === ModuleType.KITCHEN_KDS && <KitchenModule />}
            {activeModule === ModuleType.RESERVE && <ReserveModule />}
            {activeModule === ModuleType.FINANCE_HUB && <FinanceHub />}
            {activeModule === ModuleType.PAYROLL && <PayrollModule />}
            {activeModule === ModuleType.COMMAND && <CommandModule onSimulateEvent={() => {}} />}
            {activeModule === ModuleType.RELATIONSHIP && <RelationshipModule />}
            {activeModule === ModuleType.STAFF_HUB && <StaffHubModule />}
            {activeModule === ModuleType.FLOW && <FlowModule orders={[]} tasks={ritualTasks} onCompleteTask={async(id) => {}} />}
            {activeModule === ModuleType.SUPPLY && <SupplyModule />}
            {activeModule === ModuleType.CARE && <CareModule />}
            {activeModule === ModuleType.BRAND_STUDIO && <BrandStudio />}
            {activeModule === ModuleType.CONFIG && <SettingsModule />}
          </Suspense>
        </div>
      </main>
      <video ref={videoRef} className="absolute opacity-0 pointer-events-none" playsInline muted autoPlay />
    </div>
  );
};

const Main: React.FC = () => {
  const { session, loading } = useAuth();
  const [internalLoading, setInternalLoading] = useState(true);

  // Asegurar que el estado de carga termine incluso si hay errores de red
  useEffect(() => {
    if (!loading) {
      setInternalLoading(false);
    } else {
      const timeout = setTimeout(() => setInternalLoading(false), 5000);
      return () => clearTimeout(timeout);
    }
  }, [loading]);

  if (internalLoading) return (
    <div className="h-screen w-full bg-[#0a0a0c] flex flex-col items-center justify-center">
       <Loader2 className="text-blue-600 animate-spin mb-4" size={48} />
       <p className="text-[10px] font-black uppercase tracking-[0.3em] text-gray-500 italic">Iniciando Núcleo NEXUM...</p>
    </div>
  );
  
  if (!session) return <Login />;
  return <Dashboard />;
};

const App: React.FC = () => (
  <AuthProvider>
    <Main />
  </AuthProvider>
);

export default App;
