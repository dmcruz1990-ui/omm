
import React, { useState, useRef, useEffect } from 'react';
import { 
  ShoppingCart, 
  CalendarDays, 
  Users, 
  ChefHat, 
  HeartPulse, 
  Truck, 
  DollarSign, 
  Globe, 
  Zap,
  Settings,
  Bell,
  Search,
  LogOut,
  Sparkles,
  LayoutDashboard,
  Activity,
  History,
  Contact
} from 'lucide-react';
import DiscoverModule from './components/DiscoverModule'; 
import ReserveModule from './components/ReserveModule';
import RelationshipModule from './components/RelationshipModule';
import ServiceOSModule from './components/POSModule'; 
import FlowModule from './components/FlowModule';
import SupplyModule from './components/SupplyModule';
import CareModule from './components/CareModule';
import FinanceModule from './components/FinanceModule';
import CommandModule from './components/CommandModule';
import PersonalModule from './components/PersonalModule';
import SurveillanceModule from './components/SurveillanceModule';
import { ModuleType, Table, User, ServiceRecord, RitualTask } from './types';
import { useMediaPipe } from './hooks/useMediaPipe';

const App: React.FC = () => {
  const [activeModule, setActiveModule] = useState(ModuleType.COMMAND);
  
  const [tables, setTables] = useState<Table[]>(
    Array.from({ length: 12 }, (_, i) => ({ 
      id: i + 1, 
      status: i < 5 ? 'occupied' : 'free', 
      capacity: i % 2 === 0 ? 2 : 4, 
      ritualStep: i < 5 ? (i % 6) : 0,
      zone: i < 4 ? 'Cava VIP' : i < 8 ? 'Salón Principal' : 'Terraza'
    }))
  );

  const [serviceRecords, setServiceRecords] = useState<ServiceRecord[]>([]);
  const [ritualTasks, setRitualTasks] = useState<RitualTask[]>([]);
  const [iaTargetTable, setIaTargetTable] = useState<number>(1);
  const [handRaiseTimer, setHandRaiseTimer] = useState(0);

  const videoRef = useRef<HTMLVideoElement>(null);
  const { isCameraReady, lastResultsRef } = useMediaPipe(videoRef);

  const triggerTableAlert = (tableId: number) => {
    setTables(prev => {
      const table = prev.find(t => t.id === tableId);
      if (table && table.status !== 'calling') {
        return prev.map(t => 
          t.id === tableId ? { ...t, status: 'calling', welcomeTimerStart: Date.now() } : t
        );
      }
      return prev;
    });
  };

  useEffect(() => {
    const interval = setInterval(() => {
      if (lastResultsRef.current?.landmarks && lastResultsRef.current.landmarks.length > 0) {
        const isHandUp = lastResultsRef.current.landmarks.some(hand => hand[8].y < 0.35);
        if (isHandUp) setHandRaiseTimer(prev => prev + 0.1);
        else setHandRaiseTimer(0);
      } else setHandRaiseTimer(0);
    }, 100);
    return () => clearInterval(interval);
  }, [lastResultsRef]);

  const handleUpdateTable = (tableId: number, updates: Partial<Table>) => {
    setTables(prev => prev.map(t => t.id === tableId ? { ...t, ...updates } : t));
  };

  const handleAddTask = (task: RitualTask) => {
    setRitualTasks(prev => [...prev, task]);
  };

  const handleCompleteTask = (taskId: string) => {
    setRitualTasks(prev => prev.map(t => t.id === taskId ? { ...t, status: 'completed' } : t));
  };

  const handleCheckService = (tableId: number) => {
    setTables(prev => {
      const table = prev.find(t => t.id === tableId);
      if (table && table.welcomeTimerStart) {
        const duration = Math.floor((Date.now() - table.welcomeTimerStart) / 1000);
        const newRecord: ServiceRecord = {
          tableId: table.id,
          type: 'welcome',
          durationSeconds: duration,
          timestamp: Date.now(),
          staffId: 'OMM-ST-01'
        };
        setServiceRecords(current => [...current, newRecord]);
      }
      return prev.map(t => t.id === tableId ? { ...t, status: 'occupied', welcomeTimerStart: undefined } : t);
    });
  };

  const modules = [
    { type: ModuleType.COMMAND, label: 'COMMAND CENTER', sub: 'ESTRATEGIA & PRUEBAS', icon: <Globe size={22} /> },
    { type: ModuleType.DISCOVER, label: 'DISCOVER', sub: 'REMARKETING & TRÁFICO', icon: <Zap size={22} /> },
    { type: ModuleType.RESERVE, label: 'RESERVE', sub: 'GESTIÓN DE RESERVAS', icon: <CalendarDays size={22} /> },
    { type: ModuleType.RELATIONSHIP, label: 'RELATIONSHIP', sub: 'CRM & CLIENTES', icon: <Users size={22} /> },
    { type: ModuleType.STAFF_HUB, label: 'STAFF HUB', sub: 'LISTA DE TRABAJO', icon: <Contact size={22} /> },
    { type: ModuleType.SERVICE_OS, label: 'SERVICE OS', sub: 'POS & RITUALES', icon: <ShoppingCart size={22} /> },
    { type: ModuleType.FLOW, label: 'FLOW', sub: 'COCINA & BAR', icon: <ChefHat size={22} /> },
    { type: ModuleType.SUPPLY, label: 'SUPPLY INTEL', sub: 'INVENTARIO IA', icon: <Truck size={22} /> },
    { type: ModuleType.CARE, label: 'CARE', sub: 'RECUPERACIÓN CX', icon: <HeartPulse size={22} /> },
    { type: ModuleType.FINANCE, label: 'FINANCE PILOT', sub: 'CONTABILIDAD LIVE', icon: <DollarSign size={22} /> },
  ];

  return (
    <div className="flex h-screen w-full overflow-hidden bg-[#0a0a0c] text-white font-sans">
      <nav className="w-[280px] bg-[#0a0a0c] border-r border-white/5 flex flex-col px-6 py-8 z-50 overflow-y-auto custom-scrollbar">
        <div className="flex items-center gap-4 mb-12">
          <div className="w-12 h-12 bg-[#2563eb] rounded-2xl flex items-center justify-center shadow-[0_0_20px_rgba(37,99,235,0.4)] transition-transform hover:scale-105">
            <Zap className="text-white" size={24} fill="currentColor" />
          </div>
          <div>
            <h1 className="text-2xl font-black tracking-tighter italic leading-none flex items-center gap-1">
              NEXUM <span className="text-[#2563eb]">V4</span>
            </h1>
            <p className="text-[10px] text-gray-500 font-bold uppercase tracking-[0.2em] mt-1">OMM SIMPLE</p>
          </div>
        </div>

        <div className="mb-6">
          <p className="text-[10px] text-gray-600 font-black uppercase tracking-[0.2em] mb-8">ECOSISTEMA INTELIGENTE</p>
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
                <div className={`${activeModule === m.type ? 'text-white' : 'text-gray-600 group-hover:text-white'} transition-colors`}>
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
          <div className="bg-[#16161a] rounded-[1.8rem] p-5 flex items-center justify-between border border-white/5 mb-6 group cursor-pointer hover:border-white/10 transition-all">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#6366f1] to-[#2563eb] flex items-center justify-center text-sm font-black italic shadow-lg">AS</div>
              <div>
                <p className="text-[8px] text-gray-500 font-black uppercase tracking-widest mb-0.5">MASTER ADMIN</p>
                <p className="text-sm font-black italic tracking-tight">Admin Seratta</p>
              </div>
            </div>
            <Settings size={18} className="text-gray-600 group-hover:text-white transition-colors" />
          </div>

          <button className="flex items-center gap-3 px-6 text-gray-600 hover:text-red-500 transition-all text-[10px] font-black uppercase tracking-[0.2em] w-full">
            <LogOut size={16} />
            CERRAR SESIÓN
          </button>
        </div>
      </nav>

      <main className="flex-1 flex flex-col overflow-hidden relative">
        <header className="h-24 border-b border-white/5 flex items-center justify-between px-12 z-40 bg-[#0a0a0c]/80 backdrop-blur-xl">
          <div className="flex items-center gap-4">
             <div className="w-2.5 h-2.5 rounded-full bg-[#22c55e] animate-pulse"></div>
             <h2 className="text-[10px] font-black text-gray-400 uppercase tracking-[0.5em] italic">
               OMM | OPERATIONAL_INTEL_SYSTEM_V4
             </h2>
          </div>
          <div className="flex items-center gap-10">
            <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-600" size={16} />
              <input type="text" placeholder="BUSCAR EN EL ECOSISTEMA..." className="bg-white/5 border border-white/10 rounded-2xl py-3 pl-12 pr-6 text-[10px] font-bold tracking-widest w-72 outline-none focus:border-[#2563eb] transition-all" />
            </div>
            <div className="flex items-center gap-6">
              <Bell size={20} className="text-gray-500 hover:text-white cursor-pointer transition-colors" />
              <div className="h-8 w-px bg-white/5"></div>
              <div className="flex items-center gap-4">
                <span className="text-[10px] font-black text-gray-500 uppercase">Status: <span className="text-blue-500 italic">OPTIMAL</span></span>
              </div>
            </div>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto custom-scrollbar p-12 relative z-10">
          {activeModule === ModuleType.COMMAND && (
            <CommandModule 
              onSimulateEvent={(type) => {
                if (type === 'hand') triggerTableAlert(Math.floor(Math.random() * 3) + 1);
                if (type === 'task') {
                  handleAddTask({
                    id: `sim-${Date.now()}`,
                    tableId: 5,
                    ritualLabel: 'COCTEL',
                    responsible: 'BAR',
                    startTime: Date.now(),
                    status: 'pending'
                  });
                }
              }} 
            />
          )}
          {activeModule === ModuleType.DISCOVER && <DiscoverModule />}
          {activeModule === ModuleType.RESERVE && <ReserveModule />}
          {activeModule === ModuleType.RELATIONSHIP && <RelationshipModule />}
          {activeModule === ModuleType.STAFF_HUB && <PersonalModule serviceRecords={serviceRecords} tasks={ritualTasks} onCompleteTask={handleCompleteTask} />}
          {activeModule === ModuleType.SERVICE_OS && (
            <div className="space-y-12">
              <SurveillanceModule 
                videoRef={videoRef} 
                isCameraReady={isCameraReady} 
                resultsRef={lastResultsRef}
                tables={tables}
                onCheckService={handleCheckService}
                activeStation={iaTargetTable}
                setActiveStation={setIaTargetTable}
                onManualTrigger={triggerTableAlert}
              />
              <ServiceOSModule 
                tables={tables} 
                onUpdateTable={handleUpdateTable}
                serviceRecords={serviceRecords}
                onAddTask={handleAddTask}
                tasks={ritualTasks}
              />
            </div>
          )}
          {activeModule === ModuleType.FLOW && <FlowModule orders={[]} tasks={ritualTasks} onCompleteTask={handleCompleteTask} />}
          {activeModule === ModuleType.SUPPLY && <SupplyModule />}
          {activeModule === ModuleType.CARE && <CareModule />}
          {activeModule === ModuleType.FINANCE && <FinanceModule />}
        </div>
      </main>

      <video ref={videoRef} className="absolute opacity-0 pointer-events-none" playsInline muted autoPlay />
    </div>
  );
};

export default App;
