
import React, { useState } from 'react';
import { 
  FileText, 
  TrendingUp, 
  PieChart, 
  History, 
  Scan, 
  Download,
  Brain,
  ArrowRightLeft
} from 'lucide-react';

const FinanceModule: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'pyg' | 'ledger' | 'reconciliation'>('pyg');

  return (
    <div className="space-y-10 animate-in fade-in duration-700 text-left">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 border-b border-white/5 pb-8">
        <div className="flex items-center gap-4">
           <div className="w-12 h-12 bg-green-600 rounded-[1.5rem] flex items-center justify-center shadow-lg shadow-green-600/20">
              <FileText size={28} className="text-white" />
           </div>
           <div>
              <h2 className="text-3xl font-black italic tracking-tighter uppercase leading-none">P&G Operativo V4</h2>
              <p className="text-gray-500 text-[10px] font-black uppercase tracking-[0.3em] mt-2 italic italic">Standard Financial Structure A-G</p>
        </div>
      </div>
      <div className="flex bg-[#111114] p-1.5 rounded-2xl border border-white/5">
          <TabButton active={activeTab === 'pyg'} onClick={() => setActiveTab('pyg')} label="Estructura Seratta" icon={<PieChart size={14} />} />
          <TabButton active={activeTab === 'ledger'} onClick={() => setActiveTab('ledger')} label="Transacciones" icon={<ArrowRightLeft size={14} />} />
          <TabButton active={activeTab === 'reconciliation'} onClick={() => setActiveTab('reconciliation')} label="Sync Fiscal" icon={<Scan size={14} />} />
        </div>
      </div>

      {activeTab === 'pyg' ? (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
           {/* Columna Principal: Estructura de P&G */}
           <div className="lg:col-span-8 space-y-6">
              <section className="bg-[#111114] border border-white/5 rounded-[3rem] overflow-hidden shadow-2xl">
                 <div className="p-8 bg-white/5 flex justify-between items-center border-b border-white/5">
                    <h3 className="text-xl font-black italic uppercase tracking-tighter">P&L Operativo Mensual</h3>
                    <div className="flex items-center gap-3">
                       <span className="text-[10px] font-black text-blue-500 uppercase tracking-widest italic italic">Base Ventas Netas: 100%</span>
                       <Download size={14} className="text-gray-600 cursor-pointer hover:text-white" />
                    </div>
                 </div>
                 
                 <div className="p-10 space-y-12">
                    {/* A. VENTAS */}
                    <div className="space-y-4">
                       <PGLINE label="A. VENTAS BRUTAS" value={124500000} isHeader />
                       <PGLINE label="(-) Descuentos / Promos" value={4200000} isNegative />
                       <PGLINE label="VENTAS NETAS" value={120300000} isSubtotal pct={100} />
                    </div>

                    {/* B. COGS (Desglose solicitado para Casual Premium) */}
                    <div className="space-y-4">
                       <PGLINE label="B. COSTO DE VENTAS (COGS)" value={38500000} isHeader pct={32} />
                       <div className="pl-6 space-y-2 border-l border-white/5">
                          <PGLINE label="Alimentos (Food Cost)" value={24800000} isSmall pct={20.6} />
                          <PGLINE label="Bebidas Alcohólicas" value={11200000} isSmall pct={9.3} />
                          <PGLINE label="Bebidas No Alcohólicas" value={1500000} isSmall pct={1.2} />
                          <PGLINE label="Empaques / Otros" value={950000} isSmall pct={0.8} />
                          <PGLINE label="Mermas (Limit: 1.5%)" value={1000000} isSmall isNegative pct={0.8} />
                       </div>
                    </div>

                    {/* C. MARGEN BRUTO */}
                    <div className="bg-blue-600/10 p-6 rounded-2xl border border-blue-500/20">
                       <PGLINE label="C. MARGEN BRUTO" value={81800000} isTotal pct={68} />
                    </div>

                    {/* D. LABOR (Desglose solicitado: Cocina, Servicio, Adm, Cargas) */}
                    <div className="space-y-4">
                       <PGLINE label="D. MANO DE OBRA (LABOR)" value={34200000} isHeader pct={28.4} />
                       <div className="pl-6 space-y-2 border-l border-white/5">
                          <PGLINE label="Nómina Cocina (12-15%)" value={16800000} isSmall pct={14} />
                          <PGLINE label="Nómina Servicio (8-11%)" value={10800000} isSmall pct={9} />
                          <PGLINE label="Adm / Gerencia (3-5%)" value={4200000} isSmall pct={3.5} />
                          <PGLINE label="Prestaciones / Cargas" value={2400000} isSmall pct={2.0} />
                       </div>
                    </div>

                    {/* E. OPEX (Desglose solicitado completo) */}
                    <div className="space-y-4">
                       <PGLINE label="E. GASTOS OPERATIVOS (OPEX)" value={21500000} isHeader pct={17.8} />
                       <div className="pl-6 grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-2 border-l border-white/5">
                          <PGLINE label="Arriendo / Adm (8-12%)" value={12000000} isSmall pct={10} />
                          <PGLINE label="Servicios Públicos (2.5-5%)" value={4200000} isSmall pct={3.5} />
                          <PGLINE label="Marketing (2-4%)" value={2400000} isSmall pct={2} />
                          <PGLINE label="Entretenimiento (0.5-2%)" value={1200000} isSmall pct={1} />
                          <PGLINE label="Mantenimiento" value={1200000} isSmall pct={1} />
                          <PGLINE label="Tecnología / SaaS" value={1000000} isSmall pct={0.8} />
                          <PGLINE label="Honorarios" value={1000000} isSmall pct={0.8} />
                          <PGLINE label="Otros / Imprevistos" value={500000} isSmall pct={0.4} />
                       </div>
                    </div>

                    {/* F. EBITDA */}
                    <div className="bg-green-600/10 p-8 rounded-3xl border border-green-500/30">
                       <PGLINE label="UTILIDAD OPERATIVA / EBITDA" value={26100000} isTotal pct={21.7} />
                    </div>

                    {/* G. FINAL P&L */}
                    <div className="space-y-4 border-t border-white/5 pt-8">
                       <PGLINE label="Depreciación / Amort." value={2500000} isSmall isNegative />
                       <PGLINE label="Intereses Bancarios" value={1200000} isSmall isNegative />
                       <PGLINE label="Impuestos de Renta" value={8600000} isSmall isNegative />
                       <div className="pt-4">
                          <PGLINE label="UTILIDAD NETA FINAL" value={13800000} isTotal pct={11.4} color="text-white" />
                       </div>
                    </div>
                 </div>
              </section>
           </div>

           {/* Sidebar: Mentoría IA & Benchmarks */}
           <div className="lg:col-span-4 space-y-8">
              <div className="bg-[#111114] p-8 rounded-[3rem] border border-white/5 shadow-2xl">
                 <h4 className="text-xs font-black text-gray-500 uppercase tracking-widest mb-8 flex items-center gap-2">
                    <TrendingUp size={16} className="text-blue-500" /> Rendimiento vs Perfil
                 </h4>
                 <div className="space-y-8">
                    <TargetMetric label="Margen Bruto" actual={68} target={66} />
                    <TargetMetric label="EBITDA" actual={21.7} target={10} />
                    <TargetMetric label="Labor Cost" actual={28.4} target={32} isInverse />
                 </div>
              </div>

              <div className="bg-blue-600 p-10 rounded-[3.5rem] relative overflow-hidden shadow-2xl shadow-blue-600/20 group">
                 <div className="absolute top-0 right-0 p-8 opacity-10 group-hover:scale-110 transition-transform">
                    <Brain size={100} fill="white" />
                 </div>
                 <h4 className="text-xs font-black text-white/80 uppercase tracking-widest mb-6 italic italic">CFO Virtual OMM</h4>
                 <p className="text-sm text-white italic font-medium leading-relaxed">
                   "Tu estructura Casual Premium es altamente eficiente. El labor cost está controlado. Sin embargo, vigila que el rubro de Entretenimiento no exceda el 3% para mantener el equilibrio del modelo."
                 </p>
                 <button className="w-full mt-10 bg-white text-blue-600 py-4 rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all hover:bg-blue-50">
                    GENERAR RECOMENDACIONES
                 </button>
              </div>
           </div>
        </div>
      ) : (
        <div className="py-40 text-center opacity-30">
           <History size={48} className="mx-auto mb-4" />
           <p className="text-sm font-black uppercase tracking-widest">Vista de transacciones live encriptada.</p>
        </div>
      )}
    </div>
  );
};

interface PGLINEProps {
  label: string;
  value: number;
  isHeader?: boolean;
  isNegative?: boolean;
  isSubtotal?: boolean;
  isTotal?: boolean;
  isSmall?: boolean;
  pct?: number;
  color?: string;
}

const PGLINE = ({ label, value, isHeader, isNegative, isTotal, isSmall, pct, color }: PGLINEProps) => (
  <div className={`flex items-center justify-between ${isTotal ? (color || 'text-white') : 'text-gray-400'} ${isHeader ? 'border-b border-white/5 pb-2 mb-2' : ''}`}>
     <div className="flex items-center gap-3">
        <span className={`${isTotal ? 'text-2xl' : isHeader ? 'text-base' : isSmall ? 'text-[11px]' : 'text-sm'} font-black italic uppercase tracking-tight`}>
           {label}
        </span>
        {pct !== undefined && (
          <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${pct > 100 ? 'bg-red-500 text-white' : 'bg-blue-600/20 text-blue-500'}`}>
            {pct}%
          </span>
        )}
     </div>
     <div className="flex flex-col items-end">
        <span className={`${isTotal ? 'text-2xl text-white' : isHeader ? 'text-lg text-white' : 'text-sm'} font-black italic font-mono`}>
          {isNegative && '-'}$ {value.toLocaleString()}
        </span>
     </div>
  </div>
);

interface TargetMetricProps {
  label: string;
  actual: number;
  target: number;
  isInverse?: boolean;
}

const TargetMetric = ({ label, actual, target, isInverse }: TargetMetricProps) => {
  const isBetter = isInverse ? actual < target : actual > target;
  return (
    <div className="space-y-2">
       <div className="flex justify-between items-center text-[10px] font-black uppercase tracking-widest">
          <span className="text-gray-500">{label}</span>
          <span className={isBetter ? 'text-green-500' : 'text-red-500'}>{actual}% / {target}%</span>
       </div>
       <div className="h-1 w-full bg-white/5 rounded-full overflow-hidden">
          <div 
            className={`h-full ${isBetter ? 'bg-green-500' : 'bg-red-500'} transition-all duration-1000`} 
            style={{ width: `${Math.min(100, (actual/target)*100)}%` }}
          ></div>
       </div>
    </div>
  );
};

const TabButton = ({ active, onClick, icon, label }: { active: boolean, onClick: () => void, icon: React.ReactNode, label: string }) => (
  <button 
    onClick={onClick}
    className={`flex items-center gap-2 px-8 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
      active ? 'bg-green-600 text-white shadow-lg' : 'text-gray-500 hover:text-white'
    }`}
  >
    {icon} {label}
  </button>
);

export default FinanceModule;
