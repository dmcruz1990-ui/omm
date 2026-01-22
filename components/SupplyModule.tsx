
import React, { useState } from 'react';
import { 
  Package, 
  TrendingUp, 
  AlertTriangle, 
  ShoppingCart, 
  Zap, 
  Search, 
  ArrowUpRight, 
  ArrowDownRight,
  RefreshCw,
  FileText,
  DollarSign,
  Calendar,
  CheckCircle,
  BarChart3,
  HelpCircle
} from 'lucide-react';
import { SupplyItem, PurchaseOrder } from '../types';

const SupplyModule: React.FC = () => {
  const [activeSurvey, setActiveSurvey] = useState(false);
  const [surveyValue, setSurveyValue] = useState('');
  const [surveyStatus, setSurveyStatus] = useState<'idle' | 'success' | 'alert'>('idle');

  const [items] = useState<SupplyItem[]>([
    { id: '1', name: 'Salmón Fresco', theoretical: 14.5, real: 14.2, unit: 'kg', category: 'Proteínas', costPerUnit: 85000, lastCostIncrease: 12, expirationDate: '2025-05-28', status: 'waste_risk' },
    { id: '2', name: 'Solomito Angus', theoretical: 22.0, real: 21.8, unit: 'kg', category: 'Proteínas', costPerUnit: 92000, lastCostIncrease: 2, expirationDate: '2025-06-05', status: 'optimal' },
    { id: '3', name: 'Vino Malbec Res.', theoretical: 48, real: 42, unit: 'bot', category: 'Licores', costPerUnit: 120000, lastCostIncrease: 0, expirationDate: '2030-01-01', status: 'low' },
    { id: '4', name: 'Queso Parmesano', theoretical: 5.4, real: 3.1, unit: 'kg', category: 'Lácteos', costPerUnit: 145000, lastCostIncrease: 18, expirationDate: '2025-06-12', status: 'critical' },
  ]);

  const [orders] = useState<PurchaseOrder[]>([
    { id: 'PO-982', provider: 'Atlantic Foods', total: 4250000, itemsCount: 12, status: 'approved', aiSuggested: true },
    { id: 'PO-983', provider: 'Cava Seratta', total: 12800000, itemsCount: 48, status: 'pending', aiSuggested: false },
  ]);

  const handleSurveySubmit = () => {
    // Simulación de validación de auditoría flash
    if (parseFloat(surveyValue) === 14.5 || parseFloat(surveyValue) === 14.2) {
      setSurveyStatus('success');
    } else {
      setSurveyStatus('alert');
    }
    setTimeout(() => {
      setActiveSurvey(false);
      setSurveyStatus('idle');
      setSurveyValue('');
    }, 3000);
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-700">
      {/* Dashboard de KPIs Supply */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
         <StatCard label="Food Cost Actual" value="28.4%" icon={<TrendingUp className="text-blue-500" />} trend="-1.2%" />
         <StatCard label="Valor de Mermas" value="$1.2M" icon={<AlertTriangle className="text-red-500" />} trend="+5%" />
         <StatCard label="Discrepancia Inv." value="4.2%" icon={<RefreshCw className="text-yellow-500" />} trend="Mejorado" />
         <StatCard label="Forecast Ahorro" value="$8.5M" icon={<DollarSign className="text-green-500" />} trend="Sugerido" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Tabla de Inventario Inteligente */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-[#111114] border border-white/5 rounded-[3rem] p-8 shadow-2xl">
            <div className="flex items-center justify-between mb-8">
               <h3 className="text-xs font-black text-gray-500 uppercase tracking-widest flex items-center gap-2">
                  <Package size={14} className="text-blue-500" /> Control de Stock Predictivo
               </h3>
               <div className="relative">
                  <Search size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-600" />
                  <input 
                    type="text" 
                    placeholder="BUSCAR INSUMO..." 
                    className="bg-black/40 border border-white/10 rounded-2xl py-3 pl-10 pr-6 text-[10px] font-black uppercase tracking-widest focus:border-blue-500 transition-all outline-none w-64"
                  />
               </div>
            </div>

            <div className="space-y-4">
               {items.map(item => (
                 <div key={item.id} className="bg-[#16161a] border border-white/5 rounded-3xl p-6 hover:border-blue-500/40 transition-all group">
                    <div className="flex flex-col md:flex-row md:items-center gap-6">
                       <div className="flex items-center gap-4 min-w-[200px]">
                          <div className={`w-12 h-12 rounded-2xl flex items-center justify-center font-black italic text-sm ${
                            item.status === 'critical' ? 'bg-red-500/20 text-red-500' : 'bg-white/5 text-gray-500'
                          }`}>
                            {item.name.charAt(0)}
                          </div>
                          <div>
                             <h4 className="font-black uppercase text-sm">{item.name}</h4>
                             <span className="text-[9px] text-gray-600 font-bold uppercase">{item.category}</span>
                          </div>
                       </div>

                       <div className="flex-1 grid grid-cols-3 gap-4">
                          <div>
                             <span className="text-[8px] text-gray-600 font-black uppercase block mb-1">Teórico (POS)</span>
                             <span className="text-xs font-black italic">{item.theoretical} {item.unit}</span>
                          </div>
                          <div>
                             <span className="text-[8px] text-gray-600 font-black uppercase block mb-1">Real (Actual)</span>
                             <span className={`text-xs font-black italic ${Math.abs(item.theoretical - item.real) > 1 ? 'text-red-500' : 'text-green-500'}`}>
                               {item.real} {item.unit}
                             </span>
                          </div>
                          <div>
                             <span className="text-[8px] text-gray-600 font-black uppercase block mb-1">Vencimiento</span>
                             <span className={`text-xs font-black italic ${item.status === 'waste_risk' ? 'text-orange-500' : 'text-gray-400'}`}>
                               {new Date(item.expirationDate).toLocaleDateString()}
                             </span>
                          </div>
                       </div>

                       <div className="flex items-center gap-3">
                          {item.lastCostIncrease > 5 && (
                            <div className="bg-red-500/10 px-3 py-1 rounded-full border border-red-500/20 flex items-center gap-1">
                               <ArrowUpRight size={10} className="text-red-500" />
                               <span className="text-[9px] font-black text-red-500">{item.lastCostIncrease}% Costo</span>
                            </div>
                          )}
                          <button className="p-3 bg-white/5 hover:bg-blue-600/20 rounded-xl transition-all text-gray-500 hover:text-blue-500">
                             <RefreshCw size={16} />
                          </button>
                       </div>
                    </div>
                 </div>
               ))}
            </div>
          </div>

          {/* Gestión de Compras Automatizada */}
          <div className="bg-[#111114] border border-white/5 rounded-[3rem] p-8 shadow-2xl">
             <div className="flex items-center justify-between mb-8">
                <h3 className="text-xs font-black text-gray-500 uppercase tracking-widest flex items-center gap-2">
                   <ShoppingCart size={14} className="text-blue-500" /> Órdenes de Compra (AI Orchestrated)
                </h3>
             </div>
             <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {orders.map(order => (
                  <div key={order.id} className="bg-[#16161a] border border-white/5 rounded-3xl p-6 relative overflow-hidden group">
                     {order.aiSuggested && (
                       <div className="absolute top-0 right-0 p-4">
                          <div className="bg-blue-600 text-[8px] font-black uppercase px-3 py-1 rounded-full text-white animate-pulse">
                             Sugerido por IA
                          </div>
                       </div>
                     )}
                     <span className="text-[9px] text-gray-600 font-black uppercase block mb-1">{order.id}</span>
                     <h4 className="text-lg font-black italic uppercase mb-4">{order.provider}</h4>
                     <div className="flex items-center justify-between mb-6">
                        <div className="flex flex-col">
                           <span className="text-[8px] text-gray-500 uppercase font-bold">Total Inversión</span>
                           <span className="text-lg font-black text-blue-500 italic">$ {(order.total / 1000000).toFixed(1)}M</span>
                        </div>
                        <div className="flex flex-col text-right">
                           <span className="text-[8px] text-gray-500 uppercase font-bold">Insumos</span>
                           <span className="text-sm font-black italic text-gray-300">{order.itemsCount} SKU</span>
                        </div>
                     </div>
                     <button className={`w-full py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all ${
                       order.status === 'pending' ? 'bg-blue-600 hover:bg-blue-500 text-white shadow-xl shadow-blue-600/20' : 'bg-green-600/10 text-green-500 border border-green-500/20 pointer-events-none'
                     }`}>
                        {order.status === 'pending' ? 'APROBAR Y ENVIAR' : 'RECIBIDO EXITOSAMENTE'}
                     </button>
                  </div>
                ))}
             </div>
          </div>
        </div>

        {/* Sidebar: AI Waste Prevention & Smart Check */}
        <div className="space-y-8">
           {/* Smart Supply Survey (Detección de Fugas) */}
           <div className={`bg-[#111114] rounded-[2.5rem] border p-8 shadow-2xl transition-all duration-500 ${
             activeSurvey ? 'border-blue-500/40 bg-blue-500/5' : 'border-white/5'
           }`}>
              {!activeSurvey ? (
                <div className="flex flex-col items-center text-center space-y-6 py-4">
                   <div className="bg-blue-600/20 w-16 h-16 rounded-[1.5rem] flex items-center justify-center text-blue-500">
                      <HelpCircle size={32} />
                   </div>
                   <div>
                      <h4 className="text-xs font-black uppercase tracking-widest italic mb-2">Auditoría Flash IA</h4>
                      <p className="text-[10px] text-gray-500 font-medium leading-relaxed">
                         El sistema detecta una posible anomalía en Proteínas. Inicia un chequeo rápido para confirmar stock real.
                      </p>
                   </div>
                   <button 
                    onClick={() => setActiveSurvey(true)}
                    className="w-full bg-blue-600 hover:bg-blue-500 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all text-white"
                   >
                      INICIAR SMART CHECK
                   </button>
                </div>
              ) : (
                <div className="space-y-6">
                   <div className="flex items-center gap-3">
                      <Zap className="text-blue-500 animate-pulse" size={18} />
                      <h4 className="text-[10px] font-black uppercase tracking-widest italic">Smart Survey Activo</h4>
                   </div>
                   
                   {surveyStatus === 'idle' ? (
                     <div className="space-y-4">
                        <p className="text-xs font-bold text-gray-300">¿Cuántos kg de <span className="text-blue-500 italic">Salmón Fresco</span> hay en Cava 02?</p>
                        <input 
                          type="number" 
                          placeholder="0.00 kg"
                          className="w-full bg-black/60 border border-white/10 rounded-2xl py-4 px-6 text-xl font-black italic text-center outline-none focus:border-blue-500 transition-all"
                          value={surveyValue}
                          onChange={(e) => setSurveyValue(e.target.value)}
                        />
                        <button 
                          onClick={handleSurveySubmit}
                          className="w-full bg-white text-black py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all"
                        >
                           CONFIRMAR CONTEO
                        </button>
                     </div>
                   ) : surveyStatus === 'success' ? (
                     <div className="text-center py-8 space-y-4 animate-in zoom-in">
                        <CheckCircle className="mx-auto text-green-500" size={48} />
                        <p className="text-sm font-black italic uppercase text-green-500">Stock Sincronizado</p>
                        <p className="text-[10px] text-gray-500">No se detectan fugas de inventario.</p>
                     </div>
                   ) : (
                     <div className="text-center py-8 space-y-4 animate-in shake">
                        <AlertTriangle className="mx-auto text-red-500" size={48} />
                        <p className="text-sm font-black italic uppercase text-red-500">Discrepancia Crítica</p>
                        <p className="text-[10px] text-gray-500 italic leading-relaxed">
                           Diferencia de 2.4kg detectada. Se ha enviado una alerta de auditoría total al Gerente General.
                        </p>
                     </div>
                   )}
                </div>
              )}
           </div>

           {/* Waste Prevention (AI Sugerencia de Venta) */}
           <div className="bg-[#111114] rounded-[2.5rem] border border-orange-500/10 p-8 shadow-2xl relative overflow-hidden">
              <div className="absolute top-0 right-0 p-8 opacity-5">
                 <AlertTriangle size={120} className="text-orange-500" />
              </div>
              <div className="relative z-10 space-y-6">
                 <div className="flex items-center gap-3">
                    <div className="bg-orange-600/20 w-12 h-12 rounded-2xl flex items-center justify-center text-orange-500">
                       <Zap size={20} />
                    </div>
                    <div>
                       <h4 className="text-xs font-black uppercase tracking-widest italic">Waste Prevention AI</h4>
                       <span className="text-[9px] text-orange-400 font-bold uppercase tracking-widest">Protección de Margen</span>
                    </div>
                 </div>

                 <div className="bg-black/40 p-5 rounded-3xl border border-white/5 space-y-4">
                    <p className="text-[11px] text-gray-300 italic leading-relaxed">
                      "14.5kg de Salmón Fresco vencen en 48h. Sugiero lanzar un <span className="text-blue-400 font-bold">Plato Especial del Chef</span> en el Service OS para agotar stock hoy."
                    </p>
                    <div className="flex items-center justify-between pt-4 border-t border-white/5">
                       <span className="text-[9px] text-gray-500 font-black uppercase">Impacto: <span className="text-green-500 italic">Recuperación $1.2M</span></span>
                       <button className="bg-orange-600 hover:bg-orange-500 px-4 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest text-white transition-all">
                          PUSH TO POS
                       </button>
                    </div>
                 </div>

                 <div className="space-y-3">
                    <h5 className="text-[10px] font-black text-gray-600 uppercase tracking-widest">Insumos Críticos</h5>
                    <div className="space-y-2">
                       <CriticalItem label="Tomate Cherry" days={2} color="text-red-500" />
                       <CriticalItem label="Leche de Coco" days={4} color="text-orange-500" />
                    </div>
                 </div>
              </div>
           </div>

           {/* Forecast Accuracy */}
           <div className="bg-[#111114] p-8 rounded-[3rem] border border-white/5">
              <div className="flex items-center gap-2 mb-6">
                 <BarChart3 className="text-blue-500" size={18} />
                 <h4 className="text-xs font-black uppercase tracking-widest">Forecast de Compras</h4>
              </div>
              <div className="flex justify-between items-end h-32 gap-2 mb-4">
                 {[40, 60, 85, 45, 90, 70, 95].map((h, i) => (
                   <div key={i} className="flex-1 bg-white/5 rounded-t-lg relative group">
                      <div 
                        className={`absolute bottom-0 left-0 right-0 rounded-t-lg transition-all duration-1000 ${i === 6 ? 'bg-blue-600' : 'bg-white/10 group-hover:bg-blue-500/40'}`} 
                        style={{ height: `${h}%` }}
                      ></div>
                   </div>
                 ))}
              </div>
              <p className="text-[9px] text-gray-500 text-center font-bold uppercase tracking-widest">Tendencia Semanal (Precisión: 96%)</p>
           </div>
        </div>
      </div>
    </div>
  );
};

const StatCard = ({ label, value, icon, trend }: { label: string, value: string, icon: any, trend: string }) => (
  <div className="bg-[#111114] border border-white/5 p-6 rounded-[2.5rem] relative overflow-hidden group">
     <div className="flex justify-between items-start mb-4 relative z-10">
        <div className="p-3 bg-white/5 rounded-2xl">{icon}</div>
        <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${trend?.includes('+') ? 'bg-red-500/10 text-red-500' : 'bg-green-500/10 text-green-500'}`}>
          {trend}
        </span>
     </div>
     <div className="text-2xl font-black italic relative z-10 mb-1 tracking-tighter">{value}</div>
     <div className="text-[9px] text-gray-500 font-bold uppercase tracking-widest relative z-10">{label}</div>
  </div>
);

const CriticalItem = ({ label, days, color }: { label: string, days: number, color: string }) => (
  <div className="flex justify-between items-center bg-black/40 p-3 rounded-2xl border border-white/5">
     <span className="text-[10px] font-black text-gray-400 uppercase">{label}</span>
     <span className={`text-[9px] font-black uppercase ${color}`}>{days} DÍAS REST.</span>
  </div>
);

export default SupplyModule;
