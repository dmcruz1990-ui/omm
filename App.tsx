
import React, { useState, useRef, useEffect, Suspense, lazy } from 'react';
import { 
  ShoppingCart, CalendarDays, Users, ChefHat, HeartPulse, 
  Truck, DollarSign, Globe, Zap, Settings, LogOut, Contact, 
  ShieldCheck, Compass, Loader2, MonitorPlay, Sparkles, Palette
} from 'lucide-react';
import { supabase } from './lib/supabase';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ModuleType, Table, RitualTask } from './types';
import { useMediaPipe } from './hooks/useMediaPipe';
import Login from './components/Login';

const OhYeahPage = lazy(() => import('./components/OhYeahPage'));
const DiscoverModule = lazy(() => import('./components/DiscoverModule'));
const ReserveModule = lazy(() => import('./components/ReserveModule'));
const RelationshipModule = lazy(() => import('./components/RelationshipModule'));
const ServiceOSModule = lazy(() => import('./components/POSModule'));
const FlowModule = lazy(() => import('./components/FlowModule'));
const SupplyModule = lazy(() => import('./components/SupplyModule'));
const CareModule = lazy(() => import('./components/CareModule'));
const FinanceModule = lazy(() => import('./components/FinanceModule'));
const CommandModule = lazy(() => import('./components/CommandModule'));
const SurveillanceModule = lazy(() => import('./components/SurveillanceModule'));
const KitchenModule = lazy(() => import('./components/KitchenModule'));
const StaffHubModule = lazy(() => import('./components/StaffHubModule'));
const BrandStudio = lazy(() => import('./components/BrandStudio'));

const ModuleLoader = () => (
  <div className="flex flex-col items-center justify-center h-[60vh] opacity-50">
    <Loader2 className="text-blue-600 animate-spin mb-4" size={32} />
    <p className="text-[10px] font-black uppercase tracking-widest italic">Cargando Módulo Inteligente...</p>
  </div>
);

const Dashboard: React.FC = () => {
  const { user, profile, signOut } = useAuth();
  const [activeModule, setActiveModule] = useState(ModuleType.DISCOVER);
  const [tables, setTables] = useState<any[]>([]);
  const [ritualTasks, setRitualTasks] = useState<RitualTask[]>([]);
  const [dashboardLoading, setDashboardLoading] = useState(true);
  
  const [activeStation, setActiveStation] = useState(1);

  const videoRef = useRef<HTMLVideoElement>(null);
  const { isCameraReady, lastResultsRef } = useMediaPipe(videoRef, activeModule === ModuleType.SERVICE_OS);

  const fetchData = async () => {
    try {
      const { data: tablesData, error } = await supabase
        .from('tables')
        .select(`
          *,
          reservations(id, status, customer_id, customers(name))
        `)
        .order('id', { ascending: true });

      if (error) throw error;
      
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
    } catch (err) {
      console.warn("Supabase fetch fallback.");
    } finally {
      setDashboardLoading(false);
    }
  };

  useEffect(() => {
    fetchData();

    const channel = supabase
      .channel('schema-db-changes-v5')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tables' }, () => fetchData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'reservations' }, () => fetchData())
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  const handleUpdateTable = async (tableId: number, updates: Partial<Table>) => {
    try { 
      await supabase.from('tables').update(updates).eq('id', tableId); 
    } catch (err) {
      console.error(err);
    }
  };

  const handleCheckService = async (tableId: number) => {
    await handleUpdateTable(tableId, { status: 'occupied', welcome_timer_start: null });
  };

  const triggerTableAlert = async (tableId: number) => {
    if (!tableId) return;
    await handleUpdateTable(tableId, { status: 'calling', welcome_timer_start: new Date().toISOString() });
  };

  const modules = [
    { type: ModuleType.DISCOVER, label: 'DESCUBRE OMM', sub: 'SHOWCASE & PLANES', icon: <Compass size={22} /> },
    { type: ModuleType.COMMAND, label: 'COMMAND CENTER', sub: 'ESTRATEGIA & PRUEBAS', icon: <Globe size={22} /> },
    { type: ModuleType.SERVICE_OS, label: 'SERVICE OS', sub: 'POS & RITUALES', icon: <ShoppingCart size={22} /> },
    { type: ModuleType.KITCHEN_KDS, label: 'KITCHEN KDS', sub: 'PANTALLA DE COCINA', icon: <MonitorPlay size={22} /> },
    { type: ModuleType.RESERVE, label: 'RESERVE', sub: 'GESTIÓN DE RESERVAS', icon: <CalendarDays size={22} /> },
    { type: ModuleType.RELATIONSHIP, label: 'RELATIONSHIP', sub: 'CRM & CLIENTES', icon: <Users size={22} /> },
    { type: ModuleType.STAFF_HUB, label: 'STAFF HUB', sub: 'INTELIGENCIA DE EQUIPO', icon: <Contact size={22} /> },
    { type: ModuleType.FLOW, label: 'FLOW', sub: 'COCINA & BAR', icon: <ChefHat size={22} /> },
    { type: ModuleType.SUPPLY, label: 'SUPPLY INTEL', sub: 'INVENTARIO IA', icon: <Truck size={22} /> },
    { type: ModuleType.CARE, label: 'CARE', sub: 'RECUPERACIÓN CX', icon: <HeartPulse size={22} /> },
    { type: ModuleType.FINANCE, label: 'FINANCE PILOT', sub: 'CONTABILIDAD LIVE', icon: <DollarSign size={22} /> },
    { type: ModuleType.BRAND_STUDIO, label: 'BRAND STUDIO', sub: 'CMS DE DISEÑO', icon: <Palette size={22} /> },
  ];

  if (dashboardLoading) return (
    <div className="h-screen w-full bg-[#0a0a0c] flex flex-col items-center justify-center">
       <Zap className="text-blue-600 animate-pulse mb-4" size={48} />
       <p className="text-[10px] font-black uppercase tracking-[0.3em] text-gray-500">Iniciando Ecosistema Nexum...</p>
    </div>
  );

  return (
    <div className="flex h-screen w-full overflow-hidden bg-[#0a0a0c] text-white font-sans text-left">
      <nav className="w-[280px] bg-[#0a0a0c] border-r border-white/5 flex flex-col px-6 py-8 z-50 overflow-y-auto custom-scrollbar">
        <div className="flex items-center gap-4 mb-12">
          <div className="w-12 h-12 bg-[#2563eb] rounded-2xl flex items-center justify-center shadow-[0_0_20px_rgba(37,99,235,0.4)]">
            <Zap className="text-white" size={24} fill="currentColor" />
          </div>
          <div>
            <h1 className="text-2xl font-black tracking-tighter italic leading-none flex items-center gap-1">
              NEXUM <span className="text-[#2563eb]">V4</span>
            </h1>
            <p className="text-[10px] text-gray-500 font-bold uppercase tracking-[0.2em] mt-1 text-left">Hospitality OS</p>
          </div>
        </div>

        <div className="mb-6">
          <p className="text-[10px] text-gray-600 font-black uppercase tracking-[0.2em] mb-8 text-left">MENÚ DEL SISTEMA</p>
          <div className="flex flex-col gap-2">
            {modules.map((m) => (
              <button
                key={m.type}
                onClick={() => setActiveModule(m.type)}
                className={`flex items-center gap-5 w-full px-5 py-4 rounded-[1.4rem] transition-all duration-300 group ${
                  activeModule === m.type 
                    ? 'bg-[#2563eb] text-white shadow-[0_10px_30px_rgba(37,99,235,0.25)]' 
                    : 'text-gray-500 hover:bg-white/5 hover:text-white'
                }`}
              >
                <div className={`${activeModule === m.type ? 'text-white' : 'text-gray-600 group-hover:text-white'}`}>
                  {m.icon}
                </div>
                <div className="text-left">
                  <p className="text-xs font-black tracking-widest leading-none mb-1">{m.label}</p>
                  <p className={`text-[8px] font-bold uppercase tracking-wider ${activeModule === m.type ? 'text-blue-100' : 'text-gray-600'}`}>
                    {m.sub}
                  </p>
                </div>
              </button>
            ))}
          </div>
        </div>

        <div className="mt-auto pt-8 border-t border-white/5">
          <button 
            onClick={() => window.location.hash = '#/oh-yeah'}
            className="w-full bg-blue-600/10 hover:bg-blue-600/20 text-blue-500 py-4 rounded-2xl font-black italic text-[10px] uppercase tracking-widest mb-6 flex items-center justify-center gap-2 border border-blue-500/20"
          >
            <Sparkles size={14} /> VER WEB PÚBLICA
          </button>
          
          <div className="bg-[#111114] rounded-[1.8rem] p-5 flex items-center justify-between border border-white/5 mb-6 group cursor-pointer hover:border-white/10 transition-all">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#6366f1] to-[#2563eb] flex items-center justify-center text-sm font-black italic shadow-lg uppercase">{profile?.role?.charAt(0) || user?.email?.charAt(0)}</div>
              <div>
                <p className="text-[8px] text-gray-500 font-black uppercase tracking-widest mb-0.5 text-left">{profile?.role || 'User'}</p>
                <p className="text-xs font-black italic tracking-tight truncate max-w-[120px] text-left">{user?.email?.split('@')[0]}</p>
              </div>
            </div>
            <Settings size={18} className="text-gray-600 group-hover:text-white transition-colors" />
          </div>
          <button onClick={signOut} className="flex items-center gap-3 px-6 text-gray-600 hover:text-red-500 transition-all text-[10px] font-black uppercase tracking-[0.2em] w-full text-left">
            <LogOut size={16} /> CERRAR SESIÓN
          </button>
        </div>
      </nav>

      <main className="flex-1 flex flex-col overflow-hidden relative">
        <header className="h-24 border-b border-white/5 flex items-center justify-between px-12 z-40 bg-[#0a0a0c]/80 backdrop-blur-xl shrink-0">
          <div className="flex items-center gap-4">
             <div className="w-2.5 h-2.5 rounded-full bg-[#22c55e] animate-pulse"></div>
             <h2 className="text-[10px] font-black text-gray-400 uppercase tracking-[0.5em] italic">OMM | OPERATIONAL_INTEL_NODE</h2>
          </div>
          <div className="flex items-center gap-10">
            <div className="bg-white/5 border border-white/10 px-6 py-3 rounded-2xl flex items-center gap-4">
               <div className="flex flex-col items-end">
                  <span className="text-[8px] text-gray-500 font-black uppercase tracking-widest">Operator Active</span>
                  <span className="text-[10px] font-black italic text-blue-500">{user?.email}</span>
               </div>
               <div className="w-10 h-10 bg-blue-600/10 rounded-xl flex items-center justify-center text-blue-500 border border-blue-500/20"><ShieldCheck size={20} /></div>
            </div>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto custom-scrollbar p-12 relative z-10 text-left">
          <Suspense fallback={<ModuleLoader />}>
            {activeModule === ModuleType.COMMAND && (
              <CommandModule onSimulateEvent={(type) => { if (type === 'hand') triggerTableAlert(activeStation); }} />
            )}
            {activeModule === ModuleType.DISCOVER && <DiscoverModule />}
            {activeModule === ModuleType.RESERVE && <ReserveModule />}
            {activeModule === ModuleType.RELATIONSHIP && <RelationshipModule />}
            {activeModule === ModuleType.SERVICE_OS && (
              <div className="space-y-12">
                <SurveillanceModule 
                  videoRef={videoRef} 
                  isCameraReady={isCameraReady} 
                  resultsRef={lastResultsRef} 
                  tables={tables} 
                  onCheckService={handleCheckService} 
                  activeStation={activeStation} 
                  setActiveStation={setActiveStation} 
                  onManualTrigger={triggerTableAlert} 
                />
                <ServiceOSModule tables={tables} onUpdateTable={handleUpdateTable} tasks={ritualTasks} />
              </div>
            )}
            {activeModule === ModuleType.KITCHEN_KDS && <KitchenModule />}
            {activeModule === ModuleType.FLOW && <FlowModule orders={[]} tasks={ritualTasks} onCompleteTask={()=>{}} />}
            {activeModule === ModuleType.SUPPLY && <SupplyModule />}
            {activeModule === ModuleType.CARE && <CareModule />}
            {activeModule === ModuleType.FINANCE && <FinanceModule />}
            {activeModule === ModuleType.STAFF_HUB && <StaffHubModule />}
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
  const [route, setRoute] = useState(window.location.hash);

  useEffect(() => {
    const handleHashChange = () => setRoute(window.location.hash);
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  if (route === '#/oh-yeah') {
    return (
      <Suspense fallback={<ModuleLoader />}>
        <OhYeahPage />
      </Suspense>
    );
  }

  if (loading) return (
    <div className="h-screen w-full bg-[#0a0a0c] flex flex-col items-center justify-center">
      <Zap className="text-blue-600 animate-pulse mb-4" size={48} />
      <p className="text-[10px] font-black uppercase tracking-[0.3em] text-gray-500">Validando Credenciales...</p>
    </div>
  );
  if (!session) return <Login />;
  return <Dashboard />;
};

const App: React.FC = () => {
  return (
    <AuthProvider>
      <Main />
    </AuthProvider>
  );
};

export default App;
