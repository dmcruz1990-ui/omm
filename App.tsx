
import React, { useState, useRef, useEffect, Suspense, lazy } from 'react';
import { 
  ShoppingCart, CalendarDays, Users, ChefHat, HeartPulse, 
  Truck, DollarSign, Globe, Zap, Settings, LogOut, Contact, 
  ShieldCheck, Compass, Loader2, MonitorPlay, Sparkles, Palette,
  BarChart4, LayoutDashboard
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

const ModuleLoader = () => (
  <div className="flex flex-col items-center justify-center h-[60vh] opacity-50">
    <Loader2 className="text-blue-600 animate-spin mb-4" size={32} />
    <p className="text-[10px] font-black uppercase tracking-widest italic">Cargando Módulo Inteligente...</p>
  </div>
);

const Dashboard: React.FC = () => {
  const { user, profile, signOut } = useAuth();
  const [activeModule, setActiveModule] = useState<ModuleType>(ModuleType.DISCOVER);
  const [tables, setTables] = useState<any[]>([]);
  const [ritualTasks, setRitualTasks] = useState<RitualTask[]>([]);
  const [dashboardLoading, setDashboardLoading] = useState(true);
  const [activeStation, setActiveStation] = useState(1);

  const videoRef = useRef<HTMLVideoElement>(null);
  const { isCameraReady, lastResultsRef } = useMediaPipe(videoRef, activeModule === ModuleType.SERVICE_OS);

  // Definición de permisos por Rol
  const getVisibleModules = (role: UserRole = 'mesero'): ModuleType[] => {
    switch (role) {
      case 'admin':
      case 'desarrollo':
        return Object.values(ModuleType);
      case 'gerencia':
        // Gerencia ve todo excepto los dos principales de configuración crítica
        return Object.values(ModuleType).filter(m => m !== ModuleType.COMMAND && m !== ModuleType.BRAND_STUDIO);
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
    // Si el módulo por defecto no está permitido para este rol, cambiar al primero disponible
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

      const { data: tasksData } = await supabase
        .from('ritual_tasks')
        .select('*')
        .eq('status', 'active');
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

  const allModulesMetadata = [
    { type: ModuleType.DISCOVER, label: 'DESCUBRE OMM', sub: 'WEB & PLANES', icon: <Compass size={22} /> },
    { type: ModuleType.SERVICE_OS, label: 'SERVICE OS', sub: 'POS & RITUALES', icon: <ShoppingCart size={22} /> },
    { type: ModuleType.KITCHEN_KDS, label: 'KITCHEN KDS', sub: 'ESTACIÓN COCINA', icon: <MonitorPlay size={22} /> },
    { type: ModuleType.RESERVE, label: 'RESERVE', sub: 'MAPA & AGENDA', icon: <CalendarDays size={22} /> },
    { type: ModuleType.FINANCE_HUB, label: 'FINANCE HUB', sub: 'DINERO & KPI', icon: <DollarSign size={22} /> },
    { type: ModuleType.COMMAND, label: 'COMMAND', sub: 'ESTRATEGIA IA', icon: <Globe size={22} /> },
    { type: ModuleType.RELATIONSHIP, label: 'CLIENTES', sub: 'CRM & VIP', icon: <Users size={22} /> },
    { type: ModuleType.STAFF_HUB, label: 'STAFF HUB', sub: 'RANKING & COACH', icon: <Contact size={22} /> },
    { type: ModuleType.FLOW, label: 'FLOW', sub: 'ESTACIONES', icon: <ChefHat size={22} /> },
    { type: ModuleType.SUPPLY, label: 'SUPPLY', sub: 'STOCK IA', icon: <Truck size={22} /> },
    { type: ModuleType.CARE, label: 'CARE', sub: 'SOPORTE CX', icon: <HeartPulse size={22} /> },
    { type: ModuleType.BRAND_STUDIO, label: 'BRAND STUDIO', sub: 'DISEÑO CMS', icon: <Palette size={22} /> }
  ];

  if (dashboardLoading) return (
    <div className="h-screen w-full bg-[#0a0a0c] flex flex-col items-center justify-center">
       <Zap className="text-blue-600 animate-pulse mb-4" size={48} />
       <p className="text-[10px] font-black uppercase tracking-[0.3em] text-gray-500 italic">Sincronizando Perfil de Usuario...</p>
    </div>
  );

  return (
    <div className="flex h-screen w-full overflow-hidden bg-[#0a0a0c] text-white font-sans text-left">
      <nav className="w-[280px] bg-[#0a0a0c] border-r border-white/5 flex flex-col px-6 py-8 z-50 overflow-y-auto custom-scrollbar">
        <div className="flex items-center gap-4 mb-12">
          <div className="w-12 h-12 bg-blue-600 rounded-2xl flex items-center justify-center shadow-lg shadow-blue-600/30">
            <Zap className="text-white" size={24} fill="currentColor" />
          </div>
          <div>
            <h1 className="text-2xl font-black tracking-tighter italic leading-none">NEXUM <span className="text-blue-600">V4</span></h1>
            <p className="text-[9px] text-gray-500 font-bold uppercase tracking-[0.2em] mt-1">OMM INTELLIGENCE</p>
          </div>
        </div>

        <div className="mb-6">
          <p className="text-[10px] text-gray-600 font-black uppercase tracking-[0.2em] mb-6">MÓDULOS PERMITIDOS</p>
          <div className="flex flex-col gap-2">
            {allModulesMetadata.filter(m => visibleModulesList.includes(m.type)).map((m) => (
              <button
                key={m.type}
                onClick={() => setActiveModule(m.type)}
                className={`flex items-center gap-5 w-full px-5 py-4 rounded-[1.4rem] transition-all duration-300 group ${
                  activeModule === m.type 
                    ? 'bg-blue-600 text-white shadow-xl' 
                    : 'text-gray-500 hover:bg-white/5 hover:text-white'
                }`}
              >
                <div className={`${activeModule === m.type ? 'text-white' : 'text-gray-600 group-hover:text-white'}`}>{m.icon}</div>
                <div className="text-left">
                  <p className="text-xs font-black tracking-widest leading-none mb-1">{m.label}</p>
                  <p className={`text-[8px] font-bold uppercase tracking-wider ${activeModule === m.type ? 'text-blue-100' : 'text-gray-600'}`}>{m.sub}</p>
                </div>
              </button>
            ))}
          </div>
        </div>

        <div className="mt-auto pt-8 border-t border-white/5">
          <div className="bg-[#111114] rounded-[1.8rem] p-5 flex items-center justify-between border border-white/5 mb-6 group">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-xl bg-blue-600/10 flex items-center justify-center text-sm font-black text-blue-500 uppercase">{profile?.role?.charAt(0)}</div>
              <div>
                <p className="text-[8px] text-blue-500 font-black uppercase tracking-widest mb-0.5">{profile?.role}</p>
                <p className="text-xs font-black italic truncate max-w-[100px]">{user?.email?.split('@')[0]}</p>
              </div>
            </div>
          </div>
          <button onClick={signOut} className="flex items-center gap-3 px-6 text-gray-600 hover:text-red-500 transition-all text-[10px] font-black uppercase tracking-widest w-full">
            <LogOut size={16} /> SALIR DEL SISTEMA
          </button>
        </div>
      </nav>

      <main className="flex-1 flex flex-col overflow-hidden relative">
        <header className="h-20 border-b border-white/5 flex items-center justify-between px-12 z-40 bg-[#0a0a0c]/80 backdrop-blur-xl shrink-0">
          <div className="flex items-center gap-4">
             <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
             <h2 className="text-[10px] font-black text-gray-500 uppercase tracking-[0.4em] italic">OMM_OPERATIONAL_NODE_{profile?.role?.toUpperCase()}</h2>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto custom-scrollbar p-12 relative z-10 text-left">
          <Suspense fallback={<ModuleLoader />}>
            {activeModule === ModuleType.DISCOVER && <DiscoverModule />}
            {activeModule === ModuleType.SERVICE_OS && (
              <div className="space-y-12">
                <SurveillanceModule videoRef={videoRef} isCameraReady={isCameraReady} resultsRef={lastResultsRef} tables={tables} onCheckService={async(id) => handleUpdateTable(id, {status: 'occupied'})} activeStation={activeStation} setActiveStation={setActiveStation} onManualTrigger={async(id) => handleUpdateTable(id, {status: 'calling'})} />
                <ServiceOSModule tables={tables} onUpdateTable={handleUpdateTable} tasks={ritualTasks} />
              </div>
            )}
            {activeModule === ModuleType.KITCHEN_KDS && <KitchenModule />}
            {activeModule === ModuleType.RESERVE && <ReserveModule />}
            {activeModule === ModuleType.FINANCE_HUB && <FinanceHub />}
            {activeModule === ModuleType.COMMAND && <CommandModule onSimulateEvent={() => {}} />}
            {activeModule === ModuleType.RELATIONSHIP && <RelationshipModule />}
            {activeModule === ModuleType.STAFF_HUB && <StaffHubModule />}
            {activeModule === ModuleType.FLOW && <FlowModule orders={[]} tasks={ritualTasks} onCompleteTask={async(id) => {}} />}
            {activeModule === ModuleType.SUPPLY && <SupplyModule />}
            {activeModule === ModuleType.CARE && <CareModule />}
            {activeModule === ModuleType.BRAND_STUDIO && <BrandStudio />}
          </Suspense>
        </div>
      </main>
      <video ref={videoRef} className="absolute opacity-0 pointer-events-none" playsInline muted autoPlay />
    </div>
  );
};

const Main: React.FC = () => {
  const { session, loading } = useAuth();
  if (loading) return <div className="h-screen w-full bg-[#0a0a0c]" />;
  if (!session) return <Login />;
  return <Dashboard />;
};

const App: React.FC = () => (
  <AuthProvider>
    <Main />
  </AuthProvider>
);

export default App;
