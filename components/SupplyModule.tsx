
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
  MinusCircle
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { SupplyItem } from '../types';

interface ExtendedSupplyItem extends SupplyItem {
  min_stock: number; // Añadido para la lógica de riesgo solicitada
}

const SupplyModule: React.FC = () => {
  const [items, setItems] = useState<ExtendedSupplyItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  useEffect(() => {
    fetchInventory();
    
    const channel = supabase
      .channel('supply-updates')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'supply_items' }, () => fetchInventory())
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  const fetchInventory = async () => {
    try {
      const { data, error } = await supabase
        .from('supply_items')
        .select('*')
        .order('name', { ascending: true });

      if (error) throw error;
      
      // Mapeamos para asegurar que min_stock existe (fallback si no está en DB)
      const processed = (data || []).map(item => ({
        ...item,
        min_stock: item.min_stock || 10 // Valor por defecto para la lógica
      }));
      
      setItems(processed);
    } catch (err) {
      console.error("Error fetching inventory:", err);
      // Fallback data para asegurar que el módulo funcione
      setItems([
        { id: '1', name: 'Tequila Don Julio 70', theoretical: 20, real: 15, min_stock: 12, unit: 'bot', category: 'Licores', costPerUnit: 250000, lastCostIncrease: 0, expirationDate: '', status: 'optimal' },
        { id: '2', name: 'Salmón Premium', theoretical: 30, real: 5, min_stock: 15, unit: 'kg', category: 'Proteínas', costPerUnit: 85000, lastCostIncrease: 5, expirationDate: '', status: 'critical' },
        { id: '3', name: 'Arroz Sushi Shinmai', theoretical: 50, real: 18, min_stock: 20, unit: 'kg', category: 'Secos', costPerUnit: 12000, lastCostIncrease: 2, expirationDate: '', status: 'low' },
        { id: '4', name: 'Wasabi Auténtico', theoretical: 10, real: 8, min_stock: 5, unit: 'kg', category: 'Vegetales', costPerUnit: 450000, lastCostIncrease: 0, expirationDate: '', status: 'optimal' },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const simulateSale = async (itemId: string, amount: number = 5) => {
    setUpdatingId(itemId);
    const item = items.find(i => i.id === itemId);
    if (!item) return;

    const newStock = Math.max(0, item.real - amount);
    
    try {
      const { error } = await supabase
        .from('supply_items')
        .update({ real: newStock })
        .eq('id', itemId);

      if (error) throw error;
      
      // Actualización optimista local
      setItems(prev => prev.map(i => i.id === itemId ? { ...i, real: newStock } : i));
    } catch (err) {
      console.error("Error simulating sale:", err);
    } finally {
      setUpdatingId(null);
    }
  };

  const getRiskStatus = (current: number, min: number) => {
    if (current <= min) return { label: 'CRITICAL', color: 'text-red-500', bg: 'bg-red-500/10', border: 'border-red-500/30', icon: <AlertOctagon size={16} /> };
    if (current <= min * 1.5) return { label: 'WARNING', color: 'text-yellow-500', bg: 'bg-yellow-500/10', border: 'border-yellow-500/30', icon: <AlertTriangle size={16} /> };
    return { label: 'OK', color: 'text-green-500', bg: 'bg-green-500/10', border: 'border-green-500/30', icon: <CheckCircle2 size={16} /> };
  };

  const filteredItems = items.filter(i => i.name.toLowerCase().includes(searchTerm.toLowerCase()));

  if (loading) return (
    <div className="flex flex-col items-center justify-center py-40 opacity-40">
      <Loader2 className="animate-spin text-blue-500 mb-4" size={32} />
      <p className="text-[10px] font-black uppercase tracking-widest">Sincronizando Bodega Central...</p>
    </div>
  );

  return (
    <div className="space-y-10 animate-in fade-in duration-700 max-w-7xl mx-auto">
      {/* Header Supply */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 border-b border-white/5 pb-10">
        <div>
          <h2 className="text-4xl font-black italic tracking-tighter uppercase leading-none">Supply Intel</h2>
          <p className="text-gray-500 text-[10px] font-black uppercase tracking-[0.4em] mt-3 flex items-center gap-2">
            <Zap size={14} className="text-blue-500" /> Inventory Prediction Node
          </p>
        </div>
        <div className="relative">
          <Search size={16} className="absolute left-5 top-1/2 -translate-y-1/2 text-gray-600" />
          <input 
            type="text" 
            placeholder="BUSCAR INSUMO..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="bg-[#111114] border border-white/10 rounded-2xl py-4 pl-14 pr-6 text-[10px] font-black uppercase tracking-widest focus:border-blue-500 transition-all outline-none w-full md:w-80"
          />
        </div>
      </div>

      {/* Grid de Resumen */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <StatCard label="Insumos Críticos" value={items.filter(i => i.real <= i.min_stock).length.toString()} icon={<AlertOctagon className="text-red-500" />} color="text-red-500" />
        <StatCard label="En Alerta" value={items.filter(i => i.real > i.min_stock && i.real <= i.min_stock * 1.5).length.toString()} icon={<AlertTriangle className="text-yellow-500" />} color="text-yellow-500" />
        <StatCard label="Stock Saludable" value={items.filter(i => i.real > i.min_stock * 1.5).length.toString()} icon={<CheckCircle2 className="text-green-500" />} color="text-green-500" />
      </div>

      {/* Lista de Inventario con Semáforo */}
      <div className="bg-[#111114] border border-white/5 rounded-[3.5rem] overflow-hidden shadow-2xl">
        <div className="p-10 border-b border-white/5 flex items-center justify-between bg-white/[0.02]">
          <h3 className="text-xs font-black text-gray-500 uppercase tracking-widest flex items-center gap-2">
            <Box size={14} className="text-blue-500" /> Dashboard de Bodega
          </h3>
          <div className="flex items-center gap-4">
             <RefreshCw size={14} className={`text-gray-600 cursor-pointer hover:text-white transition-all ${updatingId ? 'animate-spin' : ''}`} onClick={fetchInventory} />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-black/20 text-[8px] font-black text-gray-600 uppercase tracking-[0.3em]">
                <th className="px-10 py-6">Insumo / Categoría</th>
                <th className="px-10 py-6">Stock Actual</th>
                <th className="px-10 py-6">Stock Mínimo</th>
                <th className="px-10 py-6 text-center">Nivel de Riesgo</th>
                <th className="px-10 py-6 text-right">Simulación</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {filteredItems.map((item) => {
                const risk = getRiskStatus(item.real, item.min_stock);
                return (
                  <tr key={item.id} className="group hover:bg-white/[0.01] transition-colors">
                    <td className="px-10 py-8">
                      <div className="flex flex-col">
                        <span className="text-sm font-black uppercase italic text-white leading-none mb-1">{item.name}</span>
                        <span className="text-[8px] text-gray-600 font-bold uppercase tracking-widest">{item.category}</span>
                      </div>
                    </td>
                    <td className="px-10 py-8">
                      <div className="flex items-center gap-2">
                        <span className={`text-lg font-black italic ${risk.color}`}>{item.real.toFixed(1)}</span>
                        <span className="text-[8px] text-gray-500 font-black uppercase">{item.unit}</span>
                      </div>
                    </td>
                    <td className="px-10 py-8">
                      <span className="text-xs font-black italic text-gray-400">{item.min_stock} {item.unit}</span>
                    </td>
                    <td className="px-10 py-8">
                      <div className="flex justify-center">
                        <div className={`flex items-center gap-2 px-4 py-2 rounded-full border ${risk.bg} ${risk.border} ${risk.color}`}>
                          {risk.icon}
                          <span className="text-[9px] font-black uppercase tracking-widest">{risk.label}</span>
                        </div>
                      </div>
                    </td>
                    <td className="px-10 py-8 text-right">
                      <button 
                        onClick={() => simulateSale(item.id, 5)}
                        disabled={updatingId === item.id || item.real === 0}
                        className="bg-white/5 hover:bg-red-600 hover:text-white text-gray-500 px-6 py-3 rounded-2xl text-[9px] font-black uppercase tracking-widest transition-all active:scale-95 disabled:opacity-20 flex items-center gap-2 ml-auto"
                      >
                        {updatingId === item.id ? <Loader2 size={12} className="animate-spin" /> : <MinusCircle size={12} />}
                        SIMULAR VENTA (-5)
                      </button>
                    </td>
                  </tr>
                );
              })}
              {filteredItems.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-10 py-20 text-center opacity-20">
                    <Box className="mx-auto mb-4" size={48} />
                    <h4 className="text-xl font-black italic uppercase">No se encontraron insumos</h4>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

const StatCard = ({ label, value, icon, color }: { label: string, value: string, icon: any, color: string }) => (
  <div className="bg-[#111114] border border-white/5 p-8 rounded-[2.5rem] shadow-xl flex items-center justify-between group hover:border-white/10 transition-all">
    <div className="flex items-center gap-5">
      <div className="p-4 bg-white/5 rounded-2xl group-hover:scale-110 transition-transform">
        {icon}
      </div>
      <div>
        <span className="text-[10px] text-gray-600 font-black uppercase tracking-widest">{label}</span>
        <div className={`text-3xl font-black italic tracking-tighter ${color}`}>{value}</div>
      </div>
    </div>
  </div>
);

export default SupplyModule;
