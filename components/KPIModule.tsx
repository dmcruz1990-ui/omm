
import React from 'react';
import { InventoryItem, NEXUS_COLORS } from '../types.ts';
import { Package, TrendingUp, DollarSign, FileCheck, ArrowDownRight } from 'lucide-react';

interface KPIProps {
  inventory: InventoryItem[];
}

const KPIModule: React.FC<KPIProps> = ({ inventory }) => {
  return (
    <div className="space-y-8 text-left">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard title="Ventas Hoy" value="$12,450,000" sub="COP" icon={<DollarSign className="text-green-500" />} trend="+18.4%" />
        <StatCard title="Costos Inv." value="$4,200,000" sub="COP" icon={<Package className="text-blue-500" />} trend="-2.1%" />
        <StatCard title="Tickets DIAN" value="142" sub="Emitidos" icon={<FileCheck className="text-purple-500" />} trend="100% OK" />
        <StatCard title="Margen Bruto" value="62.4%" sub="Neto" icon={<TrendingUp className="text-yellow-500" />} trend="+4.2%" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="bg-[#16161a] p-8 rounded-3xl border border-white/5">
          <h3 className="text-lg font-bold mb-6 flex items-center gap-2 text-white">
            <Package size={20} className="text-blue-500" /> Control de Inventario Automático
          </h3>
          <div className="space-y-4">
            {inventory.map((item, i) => (
              <div key={i} className="flex flex-col gap-2">
                <div className="flex justify-between text-sm">
                  <span className="font-medium text-gray-300">{item.name}</span>
                  <span className={item.current < item.minStock ? 'text-red-500 font-bold' : 'text-gray-500'}>
                    {item.current.toFixed(2)} {item.unit}
                  </span>
                </div>
                <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
                  <div 
                    className={`h-full transition-all duration-500 ${item.current < item.minStock ? 'bg-red-500' : 'bg-blue-600'}`}
                    style={{ width: `${Math.min(100, (item.current / (item.minStock * 2.5)) * 100)}%` }}
                  ></div>
                </div>
                {item.current < item.minStock && (
                  <p className="text-[10px] text-red-500 flex items-center gap-1">
                    <ArrowDownRight size={10} /> Stock crítico: Reabastecimiento sugerido
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="bg-gradient-to-br from-purple-900/10 to-transparent p-8 rounded-3xl border border-white/5 flex flex-col justify-between">
          <div>
            <h3 className="text-lg font-bold mb-4 text-white">Estado Contable Zeus-DIAN</h3>
            <p className="text-sm text-gray-400 leading-relaxed mb-6">
              Todas las operaciones están sincronizadas con el servidor de la DIAN. El inventario se deprecia en tiempo real basado en el escandallo.
            </p>
            <div className="space-y-3">
              <div className="flex items-center gap-3 text-xs bg-white/5 p-3 rounded-xl border border-white/5 text-gray-300">
                <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                Sincronización de Costos: EXITOSA (0.012ms)
              </div>
              <div className="flex items-center gap-3 text-xs bg-white/5 p-3 rounded-xl border border-white/5 text-gray-300">
                <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                Libro Mayor Automatizado: AL DÍA
              </div>
            </div>
          </div>
          <button className="mt-8 bg-purple-600 hover:bg-purple-500 text-white font-bold py-3 rounded-2xl transition-all">
            Generar Reporte Mensual
          </button>
        </div>
      </div>
    </div>
  );
};

const StatCard = ({ title, value, sub, icon, trend }: { title: string, value: string, sub: string, icon: any, trend: string }) => (
  <div className="bg-[#16161a] p-6 rounded-2xl border border-white/5">
    <div className="flex justify-between items-start mb-4">
      <div className="p-2 bg-white/5 rounded-lg">{icon}</div>
      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${trend?.includes('+') ? 'bg-green-500/10 text-green-500' : 'bg-red-500/10 text-red-500'}`}>
        {trend}
      </span>
    </div>
    <div className="text-2xl font-black mb-1 tracking-tight italic text-white">{value}</div>
    <div className="text-[10px] text-gray-500 uppercase font-bold tracking-widest">{title} <span className="text-gray-700">| {sub}</span></div>
  </div>
);

export default KPIModule;
