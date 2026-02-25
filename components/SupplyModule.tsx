
import React, { useState, useEffect } from 'react';
import { 
  AlertTriangle, 
  Zap, 
  RefreshCw,
  Loader2,
  Truck,
  Store,
  Search,
  TrendingUp,
  TrendingDown,
  Scale,
  Plus,
  Minus,
  FileSearch,
  AlertCircle,
  Database,
  FileUp,
  Activity,
  ShieldAlert,
  ClipboardCheck,
  Eye
} from 'lucide-react';
import { jsPDF } from 'https://esm.sh/jspdf';
import autoTable from 'https://esm.sh/jspdf-autotable';
import { SupplyItem } from '../types.ts';
import SupplyMarketplace from './SupplyMarketplace.tsx';
import { useAuth } from '../contexts/AuthContext.tsx';

interface TabItemProps {
  active: boolean;
  onClick: () => void;
  label: string;
  icon: React.ReactNode;
}

interface StatCardProps {
  label: string;
  value: string;
  status: string;
  icon: React.ReactNode;
  color?: string;
}

const SupplyModule: React.FC = () => {
  const { profile } = useAuth();
  const [items, setItems] = useState<SupplyItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<'inventory' | 'receiving' | 'marketplace' | 'pending' | 'history' | 'live_recon'>('inventory');
  
  // Recon States
  const [reconCounts, setReconCounts] = useState<Record<string, number>>({});
  const [isSyncingRecon, setIsSyncingRecon] = useState(false);

  const isAdmin = profile?.role === 'admin' || profile?.role === 'gerencia' || profile?.role === 'desarrollo';

  const fetchInventory = async () => {
    setLoading(true);
    // Simulación de datos con varianza calculada
    const mockItems: SupplyItem[] = [
      { id: '1', name: 'Atún Bluefin Premium', theoretical: 20, real: 18.5, unit: 'kg', category: 'Proteínas', pyg_category: 'Costo de alimentos', nature: 'COSTO', costPerUnit: 185000, lastCostIncrease: 0, expirationDate: '', status: 'optimal', pending_invoice: true, received_quantity: 5, confidence_score: 0.96, niif_mapping: 'IAS 2 Inventarios', last_recon_at: '2025-03-05T10:00:00Z', variance_pct: -7.5 },
      { id: '2', name: 'Salmón Noruego', theoretical: 15, real: 14.8, unit: 'kg', category: 'Proteínas', pyg_category: 'Costo de alimentos', nature: 'COSTO', costPerUnit: 85000, lastCostIncrease: 5, expirationDate: '2025-03-20', status: 'optimal', pending_invoice: false, confidence_score: 0.98, niif_mapping: 'IAS 2 Inventarios', last_recon_at: '2025-03-06T08:00:00Z', variance_pct: -1.3 },
      { id: '3', name: 'Aceite de Trufa OMM', theoretical: 12, real: 9.5, unit: 'L', category: 'Abarrotes Lujo', pyg_category: 'Costo de alimentos', nature: 'COSTO', costPerUnit: 120000, lastCostIncrease: 2, expirationDate: '2025-06-01', status: 'variance_alert', pending_invoice: false, confidence_score: 0.82, niif_mapping: 'IAS 2 Inventarios', last_recon_at: '2025-03-06T12:00:00Z', variance_pct: -20.8 },
      { id: '4', name: 'Gin Suntory Roku', theoretical: 24, real: 24, unit: 'bot', category: 'Licores', pyg_category: 'Costo de bebidas', nature: 'COSTO', costPerUnit: 145000, lastCostIncrease: 0, expirationDate: '', status: 'optimal', pending_invoice: false, confidence_score: 1.0, niif_mapping: 'IAS 2 Inventarios', last_recon_at: '2025-03-06T11:00:00Z', variance_pct: 0 },
    ];
    setItems(mockItems);
    setLoading(false);
  };

  useEffect(() => {
    fetchInventory();
  }, []);

  const downloadAuditPDF = (item: SupplyItem) => {
    // eslint-disable-next-line react-hooks/purity
    const timestamp = Date.now();
    const doc = new jsPDF();
    const date = new Date().toLocaleString();
    
    doc.setFillColor(10, 10, 12);
    doc.rect(0, 0, 210, 45, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(22);
    doc.setFont('helvetica', 'bold');
    doc.text('GRUPO SERATTA SAS', 20, 25);
    doc.setFontSize(9);
    doc.text('REPORTE DE VARIANZA CRÍTICA - AUDITORÍA INTERNA', 20, 33);
    
    doc.setTextColor(10, 10, 12);
    doc.setFontSize(12);
    doc.text(`PRODUCTO: ${item.name.toUpperCase()}`, 20, 60);
    doc.text(`FECHA RECONCILIACIÓN: ${date}`, 20, 68);
    doc.text(`PERSONAL RESPONSABLE: ${profile?.full_name}`, 20, 76);

    autoTable(doc, {
      startY: 90,
      head: [['MÉTRICA', 'VALOR', 'UNIDAD']],
      body: [
        ['Stock Teórico (Sistema)', item.theoretical, item.unit],
        ['Stock Real (Físico)', item.real, item.unit],
        ['Varianza Neta', (item.real - item.theoretical).toFixed(2), item.unit],
        ['% Desviación', `${item.variance_pct}%`, '-'],
        ['Impacto Financiero', `$ ${Math.abs((item.real - item.theoretical) * item.costPerUnit).toLocaleString()}`, 'COP']
      ],
      theme: 'grid',
      headStyles: { fillColor: [10, 10, 12] }
    });

    const finalY = (doc as any).lastAutoTable.finalY || 150;
    doc.setDrawColor(239, 68, 68);
    doc.setLineWidth(1);
    doc.rect(20, finalY + 10, 170, 30);
    doc.setTextColor(239, 68, 68);
    doc.setFontSize(10);
    doc.text('ALERTA DISPARADA: La desviación supera el umbral del 3% permitido.', 25, finalY + 20);
    doc.text('Requiere inspección de cámaras y revisión de mermas.', 25, finalY + 28);

    doc.save(`AUDIT_${item.id}_${timestamp}.pdf`);
  };

  const handleUpdateCount = (id: string, val: number) => {
    setReconCounts(prev => ({ ...prev, [id]: val }));
  };

  const syncRecon = async () => {
    setIsSyncingRecon(true);
    // Simular lógica de guardado y cálculo de varianza
    await new Promise(r => setTimeout(r, 1500));
    
    const updatedItems = items.map(item => {
      if (reconCounts[item.id] !== undefined) {
        const newReal = reconCounts[item.id];
        const newVariance = ((newReal - item.theoretical) / item.theoretical) * 100;
        return {
          ...item,
          real: newReal,
          variance_pct: Number(newVariance.toFixed(1)),
          status: (Math.abs(newVariance) > 5 ? 'variance_alert' : 'optimal') as SupplyItem['status'],
          last_recon_at: new Date().toISOString()
        };
      }
      return item;
    });

    setItems(updatedItems);
    setReconCounts({});
    setIsSyncingRecon(false);
    
    if (updatedItems.some(i => i.status === 'variance_alert')) {
      alert("⚠️ ALERTA: Se han detectado varianzas críticas. Los registros han sido enviados a Gerencia.");
    }
  };

  if (loading) return <div className="py-40 text-center opacity-40"><Loader2 className="animate-spin mx-auto mb-4" />Sincronizando Live Inventory...</div>;

  if (view === 'marketplace') {
    return <SupplyMarketplace items={items} onBack={() => setView('inventory')} />;
  }

  return (
    <div className="space-y-10 animate-in fade-in duration-700 max-w-7xl mx-auto pb-20 text-left">
      
      {/* Header Intelligence */}
      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-6 border-b border-white/5 pb-10">
        <div>
          <h2 className="text-4xl font-black italic tracking-tighter uppercase leading-none">Intelligence Supply</h2>
          <p className="text-gray-500 text-[10px] font-black uppercase tracking-[0.4em] mt-3 italic">Control Real vs Teórico V4</p>
        </div>
        <div className="flex bg-[#111114] p-1.5 rounded-2xl border border-white/5 items-center overflow-x-auto no-scrollbar">
           <TabItem active={view === 'inventory'} onClick={() => setView('inventory')} label="BODEGA" icon={<Database size={14} />} />
           <TabItem active={view === 'live_recon'} onClick={() => setView('live_recon')} label="INVENTARIO VIVO" icon={<ClipboardCheck size={14} />} />
           <TabItem active={view === 'receiving'} onClick={() => setView('receiving')} label="RECEPCIÓN IA" icon={<FileUp size={14} />} />
           <TabItem active={view === 'pending'} onClick={() => setView('pending')} label="PENDIENTES" icon={<Truck size={14} />} />
           <div className="w-[1px] h-6 bg-white/10 mx-4 shrink-0"></div>
           <button onClick={() => setView('marketplace')} className="bg-amber-500 hover:bg-amber-400 text-black px-6 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2 shadow-lg shrink-0">
             <Store size={14} fill="black" /> MARKETPLACE
           </button>
        </div>
      </div>

      {/* Alerta de Varianzas para Gerencia */}
      {isAdmin && items.some(i => i.status === 'variance_alert') && (
        <div className="bg-red-600/10 border-2 border-red-500/30 p-8 rounded-[3rem] flex flex-col md:flex-row items-center justify-between gap-6 animate-pulse">
           <div className="flex items-center gap-6">
              <div className="w-16 h-16 bg-red-600 rounded-2xl flex items-center justify-center text-white shadow-[0_0_40px_rgba(220,38,38,0.4)]">
                 <ShieldAlert size={32} />
              </div>
              <div>
                 <h4 className="text-xl font-black uppercase italic text-red-500">Alerta: Fuga de Inventario Detectada</h4>
                 <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest mt-1">Hay {items.filter(i => i.status === 'variance_alert').length} insumos con varianza crítica entre físico y sistema.</p>
              </div>
           </div>
           <div className="flex gap-4">
              <button className="bg-white/5 border border-white/10 text-white px-6 py-3 rounded-xl text-[9px] font-black uppercase tracking-widest">Ignorar</button>
              <button onClick={() => setView('live_recon')} className="bg-red-600 text-white px-8 py-3 rounded-xl text-[9px] font-black uppercase tracking-widest shadow-xl">INSPECCIONAR AHORA</button>
           </div>
        </div>
      )}

      {view === 'live_recon' && (
        <div className="space-y-10 animate-in slide-in-from-bottom-4 duration-500">
           <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              <div className="lg:col-span-2 bg-[#111114] border border-white/5 rounded-[4rem] overflow-hidden shadow-2xl">
                 <div className="p-10 bg-black/20 border-b border-white/5 flex justify-between items-center">
                    <div>
                       <h3 className="text-xl font-black italic uppercase tracking-tighter">Mesa de Conteo Directo</h3>
                       <p className="text-[9px] text-gray-500 font-bold uppercase tracking-widest mt-1 italic">Ingresa el stock físico actual de Cocina y Bar</p>
                    </div>
                    <button 
                      onClick={syncRecon}
                      disabled={isSyncingRecon || Object.keys(reconCounts).length === 0}
                      className="bg-blue-600 hover:bg-blue-500 disabled:opacity-30 text-white px-10 py-4 rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all flex items-center gap-3 shadow-xl active:scale-95"
                    >
                       {isSyncingRecon ? <Loader2 size={16} className="animate-spin" /> : <><RefreshCw size={16} /> SINCRONIZAR CONTEO</>}
                    </button>
                 </div>
                 
                 <div className="overflow-x-auto">
                    <table className="w-full text-left">
                       <thead>
                          <tr className="bg-black/20 text-[8px] font-black text-gray-600 uppercase tracking-[0.5em]">
                             <th className="px-10 py-6">INSUMO</th>
                             <th className="px-10 py-6 text-center">TEÓRICO (SYS)</th>
                             <th className="px-10 py-6 text-center w-48">CONTEO FÍSICO</th>
                             <th className="px-10 py-6 text-right">GAP VIVO</th>
                          </tr>
                       </thead>
                       <tbody className="divide-y divide-white/5">
                          {items.map(item => {
                            const count = reconCounts[item.id] !== undefined ? reconCounts[item.id] : item.real;
                            const variance = count - item.theoretical;
                            const isHighVariance = Math.abs((variance / item.theoretical) * 100) > 5;

                            return (
                               <tr key={item.id} className={`group transition-all ${isHighVariance ? 'bg-red-600/[0.02]' : 'hover:bg-white/[0.01]'}`}>
                                  <td className="px-10 py-8">
                                     <div className="flex flex-col">
                                        <span className="text-sm font-black italic uppercase text-white leading-none mb-2">{item.name}</span>
                                        <span className="text-[9px] text-gray-600 font-bold uppercase">{item.category}</span>
                                     </div>
                                  </td>
                                  <td className="px-10 py-8 text-center font-mono text-gray-500">
                                     {item.theoretical} {item.unit}
                                  </td>
                                  <td className="px-10 py-8">
                                     <div className="flex items-center gap-3 bg-black/40 border border-white/5 rounded-2xl p-1">
                                        <button onClick={() => handleUpdateCount(item.id, Math.max(0, count - 1))} className="w-10 h-10 bg-white/5 rounded-xl flex items-center justify-center text-gray-400 hover:bg-white/10 hover:text-white transition-all"><Minus size={14} /></button>
                                        <input 
                                          type="number" 
                                          value={count}
                                          onChange={(e) => handleUpdateCount(item.id, parseFloat(e.target.value) || 0)}
                                          className="w-full bg-transparent text-center font-black italic text-lg outline-none text-white"
                                        />
                                        <button onClick={() => handleUpdateCount(item.id, count + 1)} className="w-10 h-10 bg-white/5 rounded-xl flex items-center justify-center text-gray-400 hover:bg-white/10 hover:text-white transition-all"><Plus size={14} /></button>
                                     </div>
                                  </td>
                                  <td className="px-10 py-8 text-right">
                                     <div className={`flex flex-col items-end ${variance < 0 ? 'text-red-500' : variance > 0 ? 'text-blue-400' : 'text-green-500'}`}>
                                        <span className="text-lg font-black italic">{variance > 0 ? '+' : ''}{variance.toFixed(2)} {item.unit}</span>
                                        <span className="text-[8px] font-bold uppercase tracking-widest">Desviación</span>
                                     </div>
                                  </td>
                               </tr>
                            );
                          })}
                       </tbody>
                    </table>
                 </div>
              </div>

              <div className="space-y-8">
                 <div className="bg-[#111114] border border-white/5 p-8 rounded-[3rem] shadow-2xl relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-6 opacity-5"><Zap size={80} className="text-blue-500" /></div>
                    <div className="relative z-10 space-y-6">
                       <h4 className="text-xs font-black text-gray-500 uppercase tracking-widest flex items-center gap-2">
                          <Activity size={16} className="text-blue-500" /> Auditoría de Personal
                       </h4>
                       <div className="space-y-4">
                          <div className="flex justify-between items-center">
                             <span className="text-[10px] text-gray-400 font-bold uppercase">Último Recon</span>
                             <span className="text-xs font-black italic text-white">Hace 14 min</span>
                          </div>
                          <div className="flex justify-between items-center">
                             <span className="text-[10px] text-gray-400 font-bold uppercase">Responsable</span>
                             <span className="text-xs font-black italic text-blue-500">{profile?.full_name}</span>
                          </div>
                       </div>
                       <button className="w-full bg-white/5 hover:bg-white/10 border border-white/10 text-white py-4 rounded-2xl text-[9px] font-black uppercase tracking-widest flex items-center justify-center gap-3 transition-all">
                          <Fingerprint size={16} /> FIRMAR REGISTRO
                       </button>
                    </div>
                 </div>

                 <div className="bg-gradient-to-br from-red-600/20 to-transparent border border-red-500/20 p-10 rounded-[3rem] shadow-xl">
                    <h4 className="text-[10px] font-black text-red-500 uppercase tracking-widest mb-4 flex items-center gap-2 italic">
                       <AlertCircle size={14} /> Riesgo Financiero
                    </h4>
                    <p className="text-sm text-gray-400 italic leading-relaxed">
                      "La varianza actual representa una pérdida proyectada de **$1.8M COP** este turno si no se corrigen los gramajes en cocina."
                    </p>
                    <button onClick={() => {}} className="mt-8 w-full bg-red-600 text-white py-4 rounded-2xl font-black text-[9px] uppercase tracking-widest shadow-xl">GENERAR REPORTE CRÍTICO</button>
                 </div>
              </div>
           </div>
        </div>
      )}

      {view === 'inventory' && (
        <div className="space-y-12">
           <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              <StatCard label="Exactitud Inventario" value="92.8%" status="ALERTA" color="text-yellow-500" icon={<Scale className="text-yellow-500" />} />
              <StatCard label="Mermas Registradas" value="4.2%" status="BIEN" icon={<TrendingDown className="text-green-500" />} />
              <StatCard label="Items en Riesgo" value={items.filter(i => i.status === 'variance_alert').length.toString()} status="CRÍTICO" color="text-red-500" icon={<AlertTriangle className="text-red-500" />} />
              <StatCard label="Valor en Bodega" value="$148M" status="ÓPTIMO" color="text-green-500" icon={<TrendingUp className="text-green-500" />} />
           </div>

           <div className="bg-[#111114] border border-white/5 rounded-[4rem] overflow-hidden shadow-2xl">
              <div className="p-10 bg-black/20 border-b border-white/5 flex flex-col md:flex-row justify-between items-center gap-6">
                 <h3 className="text-xs font-black uppercase tracking-[0.4em] text-gray-500 italic">Maestro de Existencias OMM</h3>
                 <div className="relative w-full md:w-96">
                    <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-600" />
                    <input type="text" placeholder="Filtrar insumos..." className="w-full bg-black/40 border border-white/10 rounded-2xl py-4 pl-14 pr-6 text-[10px] font-black text-white uppercase outline-none focus:border-blue-500 transition-all" />
                 </div>
              </div>
              <table className="w-full text-left">
                 <thead>
                    <tr className="bg-black/20 text-[8px] font-black text-gray-600 uppercase tracking-[0.5em]">
                       <th className="px-12 py-8">Insumo</th>
                       <th className="px-12 py-8 text-center">Varianza %</th>
                       <th className="px-12 py-8">Mapeo NIIF</th>
                       <th className="px-12 py-8 text-right">Acciones</th>
                    </tr>
                 </thead>
                 <tbody className="divide-y divide-white/5">
                    {items.map(item => (
                       <tr key={item.id} className="hover:bg-white/[0.01] group transition-all">
                          <td className="px-12 py-10">
                             <div className="flex flex-col">
                                <span className="text-sm font-black italic uppercase text-white leading-none mb-2 tracking-tight group-hover:text-blue-400 transition-colors">{item.name}</span>
                                <span className="text-[9px] text-gray-600 font-bold uppercase tracking-widest">{item.pyg_category}</span>
                             </div>
                          </td>
                          <td className="px-12 py-10 text-center">
                             <div className="flex flex-col items-center gap-1.5">
                                <span className={`text-[10px] font-black italic ${Math.abs(item.variance_pct || 0) > 5 ? 'text-red-500' : 'text-green-500'}`}>
                                   {item.variance_pct}%
                                </span>
                                <div className="w-20 h-1 bg-white/5 rounded-full overflow-hidden">
                                   <div className={`h-full ${Math.abs(item.variance_pct || 0) > 5 ? 'bg-red-500' : 'bg-green-500'}`} style={{ width: `${Math.min(100, Math.abs(item.variance_pct || 0) * 4)}%` }}></div>
                                </div>
                             </div>
                          </td>
                          <td className="px-12 py-10">
                             <span className="text-[10px] font-bold text-gray-500 uppercase italic tracking-wider">{item.niif_mapping}</span>
                          </td>
                          <td className="px-12 py-10 text-right">
                             <div className="flex items-center justify-end gap-3">
                                {Math.abs(item.variance_pct || 0) > 5 && (
                                   <button 
                                      onClick={() => downloadAuditPDF(item)}
                                      className="p-3 bg-red-600/10 text-red-500 rounded-xl hover:bg-red-600 hover:text-white transition-all shadow-lg"
                                      title="Generar Reporte de Varianza"
                                   >
                                      <FileSearch size={18} />
                                   </button>
                                )}
                                <button className="p-3 bg-white/5 text-gray-500 hover:text-white hover:bg-blue-600 rounded-xl transition-all">
                                   <Eye size={18} />
                                </button>
                             </div>
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

const TabItem = ({ active, onClick, label, icon }: TabItemProps) => (
  <button 
    onClick={onClick}
    className={`px-6 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-3 shrink-0 relative ${
      active ? 'bg-blue-600 text-white shadow-xl' : 'text-gray-500 hover:text-white'
    }`}
  >
    {icon} 
    {label}
  </button>
);

const StatCard = ({ label, value, status, icon, color }: StatCardProps) => (
  <div className="bg-[#111114] border border-white/5 p-10 rounded-[3rem] shadow-2xl flex flex-col justify-between h-48 group hover:border-blue-500/20 transition-all">
    <div className="flex items-center justify-between">
      <div className="p-4 bg-white/5 rounded-2xl group-hover:bg-blue-600/10 transition-all shadow-xl">{icon}</div>
      <span className={`text-[8px] font-black px-3 py-1 rounded-full uppercase tracking-widest ${status === 'ÓPTIMO' || status === 'BIEN' ? 'bg-green-500/10 text-green-500' : 'bg-red-500/10 text-red-500'}`}>
         {status}
      </span>
    </div>
    <div>
      <span className="text-[9px] text-gray-600 font-black uppercase tracking-widest block mb-2">{label}</span>
      <div className={`text-3xl font-black italic tracking-tighter ${color || 'text-white'}`}>{value}</div>
    </div>
  </div>
);

export default SupplyModule;
