
import React, { useState, useEffect } from 'react';
import { 
  Package, 
  AlertTriangle, 
  ShoppingCart, 
  Zap, 
  Search, 
  RefreshCw,
  TrendingDown,
  TrendingUp,
  Box,
  AlertOctagon,
  CheckCircle2,
  Loader2,
  MinusCircle,
  Truck,
  FileText,
  Clock,
  ShieldCheck,
  ChevronRight,
  Martini,
  ShieldAlert,
  Atom,
  Store
} from 'lucide-react';
import { supabase } from '../lib/supabase.ts';
import { SupplyItem } from '../types.ts';
import RecipeManager from './RecipeManager.tsx';
import SupplyMarketplace from './SupplyMarketplace.tsx';

const SupplyModule: React.FC = () => {
  const [items, setItems] = useState<SupplyItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<'inventory' | 'receiving' | 'recipes' | 'marketplace'>('inventory');

  useEffect(() => {
    fetchInventory();
  }, []);

  const fetchInventory = async () => {
    setLoading(true);
    // Estos datos simulan los que vendrían de la DB, se mantienen para consistencia
    setItems([
      { id: '1', name: 'Atún Bluefin Premium', theoretical: 20, real: 18.5, unit: 'kg', category: 'Proteínas', costPerUnit: 185000, lastCostIncrease: 0, expirationDate: '', status: 'optimal', pending_invoice: true, received_quantity: 5 },
      { id: '2', name: 'Salmón Noruego', theoretical: 15, real: 4.2, unit: 'kg', category: 'Proteínas', costPerUnit: 85000, lastCostIncrease: 5, expirationDate: '', status: 'critical', pending_invoice: false },
      { id: '3', name: 'Sake Junmai Daijinjo', theoretical: 24, real: 12, unit: 'bot', category: 'Licores', costPerUnit: 250000, lastCostIncrease: 0, expirationDate: '', status: 'low', pending_invoice: false },
      { id: '4', name: 'Arroz Koshihikari', theoretical: 100, real: 85, unit: 'kg', category: 'Secos', costPerUnit: 14000, lastCostIncrease: 2, expirationDate: '', status: 'optimal', pending_invoice: false },
      { id: '5', name: 'Servilletas de Tela OMM', theoretical: 500, real: 420, unit: 'und', category: 'Aseo & Insumos', costPerUnit: 1200, lastCostIncrease: 0, expirationDate: '', status: 'optimal', pending_invoice: false },
      { id: '6', name: 'Limones Tahití', theoretical: 30, real: 8, unit: 'kg', category: 'Cocina', costPerUnit: 4500, lastCostIncrease: 10, expirationDate: '', status: 'low', pending_invoice: false },
      { id: '7', name: 'Detergente Industrial', theoretical: 10, real: 2, unit: 'gal', category: 'Aseo & Insumos', costPerUnit: 45000, lastCostIncrease: 0, expirationDate: '', status: 'critical', pending_invoice: false },
    ]);
    setLoading(false);
  };

  if (loading) return <div className="py-40 text-center opacity-40"><Loader2 className="animate-spin mx-auto mb-4" />Sincronizando Bodega Central...</div>;

  // Si estamos en modo Marketplace, devolvemos la vista a pantalla completa
  if (view === 'marketplace') {
    return <SupplyMarketplace items={items} onBack={() => setView('inventory')} />;
  }

  return (
    <div className="space-y-10 animate-in fade-in duration-700 max-w-7xl mx-auto pb-20 text-left">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 border-b border-white/5 pb-10">
        <div>
          <h2 className="text-4xl font-black italic tracking-tighter uppercase leading-none">Supply Core</h2>
          <p className="text-gray-500 text-[10px] font-black uppercase tracking-[0.4em] mt-3 italic">Vendor Flow & Fiscal Matching</p>
        </div>
        <div className="flex bg-[#111114] p-1.5 rounded-2xl border border-white/5 overflow-x-auto items-center">
           <button onClick={() => setView('inventory')} className={`px-6 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all shrink-0 ${view === 'inventory' ? 'bg-blue-600 text-white' : 'text-gray-500 hover:text-white'}`}>INVENTARIO LIVE</button>
           <button onClick={() => setView('receiving')} className={`px-6 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all shrink-0 ${view === 'receiving' ? 'bg-blue-600 text-white' : 'text-gray-500 hover:text-white'}`}>RECEPCIÓN</button>
           <button onClick={() => setView('recipes')} className={`px-6 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all shrink-0 flex items-center gap-2 ${view === 'recipes' ? 'bg-blue-600 text-white shadow-xl' : 'text-gray-500 hover:text-white'}`}>
             <Atom size={14} /> RECETAS
           </button>
           <div className="w-[1px] h-6 bg-white/10 mx-4"></div>
           <button 
            onClick={() => setView('marketplace')} 
            className="bg-blue-500 hover:bg-blue-400 text-white px-6 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all shrink-0 flex items-center gap-2 shadow-lg shadow-blue-500/20"
           >
             <Store size={14} /> HACER PEDIDO
           </button>
        </div>
      </div>

      {view === 'recipes' ? (
        <RecipeManager />
      ) : view === 'receiving' ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
           <div className="lg:col-span-2 space-y-6">
              <h3 className="text-xs font-black text-gray-500 uppercase tracking-widest flex items-center gap-2 mb-4 italic">
                 <Truck size={14} className="text-blue-500" /> Remisiones Pendientes de Factura
              </h3>
              {items.filter(i => i.pending_invoice).map(item => (
                <div key={item.id} className="bg-red-600/5 border-2 border-red-500/20 p-10 rounded-[3rem] shadow-2xl relative overflow-hidden group">
                   <div className="absolute top-0 right-0 p-8">
                      <div className="bg-red-600/10 px-4 py-2 rounded-full flex items-center gap-2">
                         <AlertTriangle size={12} className="text-red-500" />
                         <span className="text-[9px] font-black text-red-500 uppercase tracking-widest italic">Inventario sin soporte fiscal</span>
                      </div>
                   </div>
                   
                   <div className="flex items-center gap-8">
                      <div className="w-20 h-20 bg-black/40 rounded-3xl flex items-center justify-center text-gray-600 border border-white/5">
                         <Box size={40} />
                      </div>
                      <div className="flex-1">
                         <span className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">Proveedor: Pesquera del Mar</span>
                         <h4 className="text-3xl font-black italic uppercase text-white mb-2">{item.name}</h4>
                         <p className="text-[10px] text-gray-600 font-black uppercase tracking-widest italic">Recibido: {item.received_quantity} {item.unit} • Valor Est: $ {(item.costPerUnit * (item.received_quantity||0)).toLocaleString()}</p>
                      </div>
                      <button className="bg-blue-600 hover:bg-blue-500 text-white px-8 py-4 rounded-2xl font-black italic text-[10px] uppercase tracking-widest transition-all shadow-xl shadow-blue-600/20 flex items-center gap-3 active:scale-95">
                         VINCULAR FACTURA <ChevronRight size={16} />
                      </button>
                   </div>
                </div>
              ))}
           </div>
           <div className="space-y-8">
              <div className="bg-[#111114] p-8 rounded-[3rem] border border-white/5 shadow-2xl">
                 <h4 className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-6 italic">Bloqueo Fiscal (Cierre)</h4>
                 <div className="bg-black/40 border border-white/5 p-6 rounded-3xl mb-8">
                    <p className="text-[11px] text-gray-400 italic leading-relaxed">
                       "Tienes <span className="text-red-500 font-black italic">1 item</span> recibido sin factura vinculada. NEXUM bloqueará el cierre de mes si no se regulariza este soporte."
                    </p>
                 </div>
                 <div className="space-y-4">
                    <StatUnit label="Remisiones Activas" value="4" />
                    <StatUnit label="Match Factura OK" value="75%" />
                    <StatUnit label="Exposición Contable" value="High" color="text-red-500" />
                 </div>
              </div>
           </div>
        </div>
      ) : (
        <div className="space-y-12">
           <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              <StatCard label="Proteínas" value="88%" icon={<Box className="text-blue-500" />} />
              <StatCard label="Licores" value="94%" icon={<Martini className="text-purple-500" />} />
              <StatCard label="Mermas Live" value="3.2%" color="text-red-500" icon={<TrendingDown className="text-red-500" />} />
              <StatCard label="Ahorro Compras" value="+12%" color="text-green-500" icon={<TrendingUp className="text-green-500" />} />
           </div>

           <div className="bg-[#111114] border border-white/5 rounded-[4rem] overflow-hidden shadow-2xl">
              <table className="w-full text-left">
                 <thead>
                    <tr className="bg-black/20 text-[8px] font-black text-gray-600 uppercase tracking-[0.4em]">
                       <th className="px-10 py-6">Insumo</th>
                       <th className="px-10 py-6">Stock Actual</th>
                       <th className="px-10 py-6">Status Fiscal</th>
                       <th className="px-10 py-6 text-right">Tendencia</th>
                    </tr>
                 </thead>
                 <tbody className="divide-y divide-white/5">
                    {items.map(item => (
                       <tr key={item.id} className="hover:bg-white/[0.01]">
                          <td className="px-10 py-8">
                             <div className="flex flex-col">
                                <span className="text-sm font-black italic uppercase text-white leading-none mb-1">{item.name}</span>
                                <span className="text-[9px] text-gray-600 font-bold uppercase">{item.category}</span>
                             </div>
                          </td>
                          <td className="px-10 py-8">
                             <div className="flex items-center gap-2">
                                <span className={`text-xl font-black italic ${item.status === 'critical' ? 'text-red-500' : 'text-blue-500'}`}>{item.real}</span>
                                <span className="text-[9px] text-gray-500 uppercase font-black">{item.unit}</span>
                             </div>
                          </td>
                          <td className="px-10 py-8">
                             {item.pending_invoice ? (
                                <div className="bg-red-500/10 border border-red-500/30 px-4 py-1.5 rounded-full inline-flex items-center gap-2">
                                   <ShieldAlert size={12} className="text-red-500" />
                                   <span className="text-[8px] font-black text-red-500 uppercase italic">Sin Factura</span>
                                </div>
                             ) : (
                                <div className="bg-green-500/10 border border-green-500/30 px-4 py-1.5 rounded-full inline-flex items-center gap-2">
                                   <ShieldCheck size={12} className="text-green-500" />
                                   <span className="text-[8px] font-black text-green-500 uppercase italic">Soportado</span>
                                </div>
                             )}
                          </td>
                          <td className="px-10 py-8 text-right">
                             <span className="text-xs font-black italic text-gray-500">Normal</span>
                          </td>
                       </tr>
                    ))}
                 </tbody>
              </table>
           </div>
        </div>
      )}
    </div>
  );
};

const StatCard = ({ label, value, icon, color }: any) => (
  <div className="bg-[#111114] border border-white/5 p-8 rounded-[2.5rem] shadow-xl flex items-center justify-between">
    <div className="flex items-center gap-5">
      <div className="p-4 bg-white/5 rounded-2xl">{icon}</div>
      <div>
        <span className="text-[10px] text-gray-600 font-black uppercase tracking-widest">{label}</span>
        <div className={`text-2xl font-black italic ${color || 'text-white'}`}>{value}</div>
      </div>
    </div>
  </div>
);

const StatUnit = ({ label, value, color }: any) => (
  <div className="flex justify-between items-center border-b border-white/5 pb-3">
     <span className="text-[10px] text-gray-400 font-bold uppercase">{label}</span>
     <span className={`text-sm font-black italic ${color || 'text-white'}`}>{value}</span>
  </div>
);

export default SupplyModule;
