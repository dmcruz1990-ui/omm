
import React, { useState } from 'react';
import { Table, ServiceRecord, MenuItem, RitualTask } from '../types';
import { 
  Sparkles, 
  UtensilsCrossed, 
  Plus, 
  Clock, 
  Zap, 
  Wine,
  BarChart3,
  FileText,
  ChevronRight,
  UserCheck,
  GlassWater,
  Flame,
  Coffee,
  Gem,
  CheckCircle2,
  Activity,
  GlassWater as Bottle,
  Martini,
  Search,
  Receipt,
  Eye,
  Filter,
  MapPin,
  FastForward,
  // Fix: added missing Info icon import
  Info
} from 'lucide-react';
import { GoogleGenAI } from "@google/genai";

interface POSProps {
  tables: Table[];
  onUpdateTable: (tableId: number, updates: Partial<Table>) => void;
  serviceRecords: ServiceRecord[];
  onAddTask: (task: RitualTask) => void;
  tasks: RitualTask[];
}

const RitualSteps = [
  { id: 0, label: 'AGUA', icon: <Bottle size={18} />, responsible: 'MESERO' as const },
  { id: 1, label: 'APERITIVO', icon: <UtensilsCrossed size={18} />, responsible: 'COCINA' as const },
  { id: 2, label: 'COCTEL', icon: <Martini size={18} />, responsible: 'BAR' as const },
  { id: 3, label: 'VINO', icon: <Wine size={18} />, responsible: 'SOMMELIER' as const },
  { id: 4, label: 'FUERTE', icon: <Flame size={18} />, responsible: 'COCINA' as const },
  { id: 5, label: 'POSTRE', icon: <Sparkles size={18} />, responsible: 'COCINA' as const },
  { id: 6, label: 'CAFÉ', icon: <Coffee size={18} />, responsible: 'BAR' as const },
  { id: 7, label: 'CUENTA', icon: <Receipt size={18} />, responsible: 'MESERO' as const },
];

const OmmMenu: MenuItem[] = [
  { id: 'c1', name: 'Margarita', price: 39200, category: 'Coctelería', description: 'Equilibrio perfecto de tequila y cítricos.' },
  { id: 'c2', name: 'Aperol Spritz', price: 44400, category: 'Coctelería', description: 'Refrescante con notas de naranja y prosecco.' },
  { id: 'c3', name: 'Old Fashion', price: 48400, category: 'Coctelería', description: 'Clásico robusto con bourbon y amargos.' },
  { id: 'c4', name: 'Gin Tonic', price: 52800, category: 'Coctelería', description: 'Selección premium con botánicos frescos.' },
  { id: 'c5', name: 'Mojito', price: 49800, category: 'Coctelería', description: 'Menta fresca y ron de alta calidad.' },
  { id: 'c6', name: 'Moscow Ketel', price: 54800, category: 'Coctelería', description: 'Vodka Ketel One con ginger beer artesanal.' },
  { id: 'wb1', name: 'La Maldita Garnacha Blanca', price: 234500, category: 'Vinos', description: 'DOCa Rioja. Garnacha blanca con carácter y frescura.' },
  { id: 'wb4', name: 'Pago de Otazu Chardonnay', price: 555600, category: 'Vinos', description: 'DOP Pago de Otazu. Chardonnay con crianza premium.' },
  { id: 'rb2', name: 'Vivanco Reserva', price: 351000, category: 'Vinos', description: 'DOCa Rioja. Complejidad y elegancia en cada copa.' },
  { id: 'rb8', name: 'Valduero Una Cepa', price: 680900, category: 'Vinos', description: 'DO Ribera del Duero. Selección de uva única.' },
  { id: 'p1', name: 'Koujun', price: 32800, category: 'Postres', description: 'Experiencia dulce sobre tronco zen.' },
  { id: 'f1', name: 'Kaori Lobster', price: 112500, category: 'Fuertes', description: 'Langosta insignia con aroma místico.' },
  { id: 'f4', name: 'Dento-Teki', price: 158600, category: 'Fuertes', description: 'Corte de autor con técnica ancestral.' },
  { id: 's1', name: 'Nigiri Ren x2', price: 38600, category: 'Sushi', description: 'Nigiri de autor con topping místico.' },
  { id: 's6', name: 'Salmón Toro Hideki x2', price: 48900, category: 'Sushi', description: 'Corte ventresca flambeado.' },
];

const ServiceOSModule: React.FC<POSProps> = ({ tables, onUpdateTable, serviceRecords, onAddTask, tasks }) => {
  const [selectedTableId, setSelectedTableId] = useState<number>(1);
  const [activeTab, setActiveTab] = useState<'copilot' | 'menu' | 'precuenta'>('copilot');
  const [menuFilter, setMenuFilter] = useState<string>('All');
  const [zoneFilter, setZoneFilter] = useState<string>('All');

  const selectedTable = tables.find(t => t.id === selectedTableId) || tables[0];

  const nextStep = () => {
    if (selectedTable.ritualStep < RitualSteps.length - 1) {
      const nextIdx = selectedTable.ritualStep + 1;
      const step = RitualSteps[nextIdx];
      
      onUpdateTable(selectedTableId, { ritualStep: nextIdx });

      // Generar tarea ritual para el equipo responsable
      const newTask: RitualTask = {
        id: `task-${Date.now()}-${selectedTableId}`,
        tableId: selectedTableId,
        ritualLabel: step.label,
        responsible: step.responsible,
        startTime: Date.now(),
        status: 'pending'
      };
      onAddTask(newTask);
    }
  };

  const filteredMenu = menuFilter === 'All' 
    ? OmmMenu 
    : OmmMenu.filter(item => item.category === menuFilter);

  const filteredTables = zoneFilter === 'All'
    ? tables
    : tables.filter(t => t.zone === zoneFilter);

  const categories = ['All', 'Sushi', 'Fuertes', 'Vinos', 'Coctelería', 'Postres'];
  const zones = ['All', 'Cava VIP', 'Salón Principal', 'Terraza'];

  return (
    <div className="flex flex-col lg:flex-row gap-6 h-full animate-in fade-in duration-700">
      
      {/* 1. LEFT SIDEBAR: ESTACIONES ACTIVAS */}
      <div className="w-full lg:w-[280px] flex flex-col gap-4">
        <div className="flex justify-between items-center mb-2 px-2">
          <h3 className="text-[10px] font-black text-gray-500 uppercase tracking-[0.2em]">ESTACIONES OMM</h3>
          <span className="text-[10px] font-black text-blue-500">{tables.filter(t => t.status !== 'free').length} / 12</span>
        </div>

        <div className="flex flex-wrap gap-1 mb-2 bg-black/40 p-1 rounded-xl border border-white/5">
           {zones.map(z => (
             <button 
              key={z} 
              onClick={() => setZoneFilter(z)}
              className={`flex-1 py-1.5 rounded-lg text-[7px] font-black uppercase tracking-tighter transition-all ${
                zoneFilter === z ? 'bg-blue-600 text-white' : 'text-gray-600 hover:text-white'
              }`}
             >
               {z.replace(' Principal', '')}
             </button>
           ))}
        </div>

        <div className="grid grid-cols-2 gap-3 overflow-y-auto custom-scrollbar pr-1 max-h-[calc(100vh-320px)]">
          {filteredTables.map(table => (
            <button
              key={table.id}
              onClick={() => setSelectedTableId(table.id)}
              className={`group p-5 rounded-[1.8rem] border-2 transition-all flex flex-col items-center gap-1 relative ${
                selectedTableId === table.id 
                  ? 'bg-[#2563eb] border-[#2563eb] text-white shadow-[0_10px_25px_rgba(37,99,235,0.3)]' 
                  : 'bg-[#111114] border-white/5 text-gray-500 hover:border-white/10 shadow-lg'
              }`}
            >
              <span className={`text-[7px] font-black uppercase tracking-widest ${selectedTableId === table.id ? 'text-blue-100' : 'text-gray-700'}`}>
                {table.zone.split(' ')[0]}
              </span>
              <span className="text-3xl font-black italic tracking-tighter leading-none">{table.id.toString().padStart(2, '0')}</span>
              <div className="flex gap-1 mt-2">
                {Array.from({ length: 8 }).map((_, i) => (
                  <div key={i} className={`w-1 h-1 rounded-full ${i < table.ritualStep ? (selectedTableId === table.id ? 'bg-white' : 'bg-blue-500') : 'bg-white/10'}`}></div>
                ))}
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* 2. CENTER AREA: RITUAL MOTOR + TABS */}
      <div className="flex-1 flex flex-col gap-6">
        
        <div className="bg-[#111114] rounded-[2.5rem] border border-white/5 p-8 shadow-2xl relative overflow-hidden">
          {/* Info Badge para pruebas */}
          <div className="absolute top-4 right-8 bg-blue-600/10 px-3 py-1 rounded-full border border-blue-500/20 flex items-center gap-2">
             <Info size={10} className="text-blue-500" />
             <span className="text-[7px] text-gray-500 font-black uppercase">POS Modo Prueba</span>
          </div>

          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 bg-blue-600/20 rounded-xl flex items-center justify-center text-blue-500">
                <Zap size={20} fill="currentColor" />
              </div>
              <div>
                <h4 className="text-[11px] font-black uppercase tracking-widest leading-none">MOTOR DE RITUAL | {selectedTable.zone}</h4>
                <p className="text-[9px] text-gray-500 font-bold uppercase mt-1">SINCRO DE TIEMPOS COCINA / BAR / SALÓN</p>
              </div>
            </div>
          </div>

          <div className="flex justify-between items-center relative px-4">
            <div className="absolute top-1/2 left-10 right-10 h-[2px] bg-white/5 -translate-y-1/2"></div>
            {RitualSteps.map((step, idx) => (
              <div key={idx} className="relative z-10 flex flex-col items-center gap-3">
                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center border-2 transition-all duration-500 ${
                  selectedTable.ritualStep === idx 
                    ? 'bg-blue-600/20 border-blue-500 text-blue-500 shadow-[0_0_20px_rgba(37,99,235,0.2)]' 
                    : idx < selectedTable.ritualStep 
                    ? 'bg-blue-600 border-blue-600 text-white' 
                    : 'bg-[#16161a] border-white/5 text-gray-700'
                }`}>
                  {step.icon}
                </div>
                <span className={`text-[8px] font-black uppercase tracking-tighter ${
                  selectedTable.ritualStep === idx ? 'text-blue-400' : 'text-gray-600'
                }`}>
                  {step.label}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="flex-1 bg-[#111114] rounded-[3rem] border border-white/5 overflow-hidden flex flex-col shadow-2xl">
          <div className="flex bg-black/30 p-2 border-b border-white/5">
            <TabButton active={activeTab === 'copilot'} onClick={() => setActiveTab('copilot')} icon={<Sparkles size={14} />} label="COPILOT IA" />
            <TabButton active={activeTab === 'menu'} onClick={() => setActiveTab('menu')} icon={<Plus size={14} />} label="MENÚ RÁPIDO" />
            <TabButton active={activeTab === 'precuenta'} onClick={() => setActiveTab('precuenta')} icon={<Receipt size={14} />} label="PRE-CUENTA" />
          </div>

          <div className="p-8 flex-1 overflow-y-auto custom-scrollbar flex flex-col gap-6 max-h-[500px]">
            {activeTab === 'menu' && (
              <div className="grid grid-cols-2 gap-4">
                {filteredMenu.map(item => (
                  <div key={item.id} className="bg-white/5 p-6 rounded-[2rem] border border-white/5 hover:border-blue-500/40 transition-all cursor-pointer group">
                    <div className="flex justify-between items-start mb-2">
                      <span className="text-[8px] text-blue-500 font-black uppercase tracking-tighter">{item.category}</span>
                      <span className="text-sm font-black italic tracking-tighter">$ {item.price.toLocaleString()}</span>
                    </div>
                    <h4 className="text-base font-black italic uppercase leading-tight group-hover:text-blue-400">{item.name}</h4>
                  </div>
                ))}
              </div>
            )}
            {activeTab === 'copilot' && (
               <div className="text-center py-20 opacity-30 italic">
                 Analizando comportamiento de mesa para sugerir upsell...
               </div>
            )}
          </div>

          <div className="p-8 pt-0 mt-auto flex gap-4">
            <button 
              onClick={nextStep}
              className="flex-1 bg-[#2563eb] hover:bg-blue-500 text-white py-6 rounded-[2rem] font-black italic text-sm uppercase tracking-widest flex items-center justify-center gap-4 transition-all shadow-xl shadow-blue-600/20 active:scale-95"
            >
              ACTIVAR TAREA: {RitualSteps[Math.min(selectedTable.ritualStep + 1, RitualSteps.length - 1)].label} 
              <ChevronRight size={20} />
            </button>
            {/* Quick Test Button */}
            <button 
              onClick={() => {
                for(let i=0; i<3; i++) nextStep();
              }}
              className="bg-white/5 hover:bg-white/10 p-6 rounded-[2rem] border border-white/10 text-blue-500 transition-all"
              title="Avanzar 3 etapas para pruebas rápidas"
            >
              <FastForward size={24} />
            </button>
          </div>
        </div>
      </div>

      <div className="w-full lg:w-[320px] flex flex-col gap-6">
        <div className="bg-[#111114] rounded-[2rem] border border-white/5 p-6 shadow-xl">
          <div className="flex items-center gap-3 mb-4">
            <Activity className="text-blue-500" size={16} />
            <h4 className="text-[10px] font-black uppercase tracking-widest">PENDIENTES LIVE</h4>
          </div>
          <div className="space-y-3">
             {tasks.filter(t => t.status === 'pending').slice(0, 3).map(t => (
               <div key={t.id} className="bg-white/5 p-3 rounded-xl border border-white/5 flex justify-between items-center">
                 <div>
                   <span className="text-[7px] text-blue-500 font-black uppercase block">MESA {t.tableId}</span>
                   <span className="text-[9px] font-black uppercase">{t.ritualLabel}</span>
                 </div>
                 <span className="text-[8px] text-gray-600 font-mono">0:00</span>
               </div>
             ))}
          </div>
        </div>

        <div className="bg-[#111114] rounded-[3rem] border border-white/5 p-10 flex flex-col items-center text-center shadow-xl">
          <h4 className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-8">RITUAL PERFORMANCE</h4>
          <div className="relative w-40 h-40 flex items-center justify-center">
            <svg className="w-full h-full transform -rotate-90">
              <circle cx="80" cy="80" r="70" fill="transparent" stroke="rgba(255,255,255,0.05)" strokeWidth="12" />
              <circle cx="80" cy="80" r="70" fill="transparent" stroke="#2563eb" strokeWidth="12" strokeDasharray="440" strokeDashoffset="40" strokeLinecap="round" />
            </svg>
            <div className="absolute flex flex-col">
              <span className="text-4xl font-black italic tracking-tighter leading-none">94%</span>
              <span className="text-[8px] font-black text-blue-500 uppercase mt-1">EFICIENCIA</span>
            </div>
          </div>
        </div>
      </div>

    </div>
  );
};

const TabButton = ({ active, onClick, icon, label }: { active: boolean, onClick: () => void, icon: any, label: string }) => (
  <button onClick={onClick} className={`flex-1 flex items-center justify-center gap-3 py-4 rounded-[1.2rem] text-[10px] font-black uppercase tracking-widest transition-all ${
    active ? 'bg-white/5 text-white' : 'text-gray-600 hover:text-white'
  }`}>
    {icon} {label}
  </button>
);

export default ServiceOSModule;
