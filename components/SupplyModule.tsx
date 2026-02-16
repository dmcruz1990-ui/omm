
import React, { useState, useEffect } from 'react';
import { 
  Package, 
  AlertTriangle, 
  Zap, 
  RefreshCw,
  Box,
  Loader2,
  Truck,
  FileText,
  ShieldCheck,
  ChevronRight,
  Atom,
  Store,
  Upload,
  FileCode,
  CheckCircle,
  Eye,
  Search,
  TrendingUp,
  TrendingDown,
  Scale,
  Plus,
  FileSearch,
  DollarSign,
  AlertCircle,
  Database,
  XCircle,
  FileUp,
  Activity,
  ArrowLeft
} from 'lucide-react';
import { GoogleGenAI, Type } from "@google/genai";
import { supabase } from '../lib/supabase.ts';
import { SupplyItem, PYGCategory } from '../types.ts';
import SupplyMarketplace from './SupplyMarketplace.tsx';

const SupplyModule: React.FC = () => {
  const [items, setItems] = useState<SupplyItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<'inventory' | 'receiving' | 'marketplace'>('inventory');
  const [dragActive, setDragActive] = useState(false);
  
  // AI States
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [extractedData, setExtractedData] = useState<any>(null);
  const [uploadPreview, setUploadPreview] = useState<string | null>(null);
  const [extractionError, setExtractionError] = useState<string | null>(null);
  const [analysisStep, setAnalysisStep] = useState(0);

  useEffect(() => {
    fetchInventory();
  }, []);

  const fetchInventory = async () => {
    setLoading(true);
    // Mock de inventario inicial
    setItems([
      { id: '1', name: 'Atún Bluefin Premium', theoretical: 20, real: 18.5, unit: 'kg', category: 'Proteínas', pyg_category: 'Costo de alimentos', nature: 'COSTO', costPerUnit: 185000, lastCostIncrease: 0, expirationDate: '', status: 'optimal', pending_invoice: true, received_quantity: 5, cufe: '8b7f...3e21', confidence_score: 0.96, niif_mapping: 'IAS 2 Inventarios' },
      { id: '2', name: 'Salmón Noruego', theoretical: 15, real: 4.2, unit: 'kg', category: 'Proteínas', pyg_category: 'Costo de alimentos', nature: 'COSTO', costPerUnit: 85000, lastCostIncrease: 5, expirationDate: '2025-03-20', status: 'critical', pending_invoice: false, confidence_score: 0.98, niif_mapping: 'IAS 2 Inventarios' },
      { id: '5', name: 'Servilletas de Tela OMM', theoretical: 500, real: 420, unit: 'und', category: 'Aseo & Insumos', pyg_category: 'Empaques y desechables', nature: 'COSTO', costPerUnit: 1200, lastCostIncrease: 0, expirationDate: '', status: 'optimal', pending_invoice: false, confidence_score: 0.88, niif_mapping: 'Gasto por Consumo' },
      { id: '7', name: 'Detergente Industrial', theoretical: 10, real: 2, unit: 'gal', category: 'Aseo & Insumos', pyg_category: 'Aseo, mantenimiento y operación', nature: 'GASTO', costPerUnit: 45000, lastCostIncrease: 0, expirationDate: '', status: 'critical', pending_invoice: true, received_quantity: 2, cufe: 'PND...', confidence_score: 0.65, niif_mapping: 'IAS 1 Gasto Operativo' },
    ]);
    setLoading(false);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement> | React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    let file: File | undefined;
    
    // Detectar si viene de un input o de un drag and drop
    if ('dataTransfer' in e) {
      file = e.dataTransfer.files?.[0];
    } else if ('target' in e && e.target instanceof HTMLInputElement) {
      file = e.target.files?.[0];
    }

    if (!file) return;

    console.log("📂 Archivo detectado:", file.name);

    // Resetear estados y activar carga visual inmediatamente
    setExtractionError(null);
    setExtractedData(null);
    setIsAnalyzing(true);
    setAnalysisStep(1);

    // Generar vista previa
    const reader = new FileReader();
    reader.onload = (ev) => {
      setUploadPreview(ev.target?.result as string);
    };
    reader.readAsDataURL(file);

    // Procesar con la IA
    await processInvoiceWithAI(file);
  };

  const processInvoiceWithAI = async (file: File) => {
    console.log("🚀 Iniciando procesamiento Gemini...");
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    
    try {
      const base64Data = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve((reader.result as string).split(',')[1]);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });

      setAnalysisStep(2); // "Decodificando OCR..."
      
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: {
          parts: [
            {
              inlineData: {
                data: base64Data,
                mimeType: file.type
              }
            },
            {
              text: `Analiza esta factura de proveedor de alimentos. 
              Extrae con precisión:
              1. Proveedor: Nombre, NIT.
              2. Factura: Número y Fecha.
              3. Tabla de Items: nombre del producto, cantidad, precio_unitario, subtotal.
              4. Bloque Fiscal: Subtotal total, IVA, Total final.
              5. Inteligencia OMM: Clasifica cada ítem en categorías P&G (Costo de alimentos, Aseo, etc).
              6. Insight de Precio: Indica si el precio de cárnicos o embutidos es alto (>70,000 COP).
              Responde estrictamente en JSON.`
            }
          ]
        },
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              proveedor: { type: Type.STRING },
              nit: { type: Type.STRING },
              factura_nro: { type: Type.STRING },
              fecha: { type: Type.STRING },
              items: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    nombre: { type: Type.STRING },
                    cantidad: { type: Type.NUMBER },
                    precio: { type: Type.NUMBER },
                    categoria_pyg: { type: Type.STRING }
                  },
                  required: ["nombre", "cantidad", "precio"]
                }
              },
              analisis_fiscal: {
                type: Type.OBJECT,
                properties: {
                  subtotal: { type: Type.NUMBER },
                  iva: { type: Type.NUMBER },
                  total: { type: Type.NUMBER }
                },
                required: ["subtotal", "total"]
              },
              insight: { type: Type.STRING }
            },
            required: ["proveedor", "factura_nro", "items", "analisis_fiscal"]
          }
        }
      });

      setAnalysisStep(3); // "Validando cálculos..."
      const textResponse = response.text;
      if (!textResponse) throw new Error("La IA no devolvió ninguna respuesta legible.");
      
      const data = JSON.parse(textResponse);
      
      // Delay artificial para estética del escaneo
      setTimeout(() => {
        setExtractedData(data);
        setIsAnalyzing(false);
        setAnalysisStep(0);
      }, 1500);

    } catch (err: any) {
      console.error("❌ AI Error:", err);
      setExtractionError(err.message || "Error analizando el documento. Por favor, intente con otra imagen.");
      setIsAnalyzing(false);
    }
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") setDragActive(true);
    else if (e.type === "dragleave") setDragActive(false);
  };

  if (loading) return <div className="py-40 text-center opacity-40"><Loader2 className="animate-spin mx-auto mb-4" />Sincronizando Core Suministros...</div>;

  if (view === 'marketplace') {
    return <SupplyMarketplace items={items} onBack={() => setView('inventory')} />;
  }

  return (
    <div className="space-y-10 animate-in fade-in duration-700 max-w-7xl mx-auto pb-20 text-left">
      
      {/* Header Estilizado */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 border-b border-white/5 pb-10">
        <div>
          <h2 className="text-4xl font-black italic tracking-tighter uppercase leading-none">Intelligence Supply</h2>
          <p className="text-gray-500 text-[10px] font-black uppercase tracking-[0.4em] mt-3 italic">Gateway de Ingesta Fiscal V4</p>
        </div>
        <div className="flex bg-[#111114] p-1.5 rounded-2xl border border-white/5 items-center">
           <button onClick={() => setView('inventory')} className={`px-6 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${view === 'inventory' ? 'bg-blue-600 text-white' : 'text-gray-500 hover:text-white'}`}>INVENTARIO LIVE</button>
           <button onClick={() => { setView('receiving'); setExtractedData(null); setExtractionError(null); }} className={`px-6 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${view === 'receiving' ? 'bg-blue-600 text-white' : 'text-gray-500 hover:text-white'}`}>RECEPCIÓN IA</button>
           <div className="w-[1px] h-6 bg-white/10 mx-4"></div>
           <button onClick={() => setView('marketplace')} className="bg-amber-500 hover:bg-amber-400 text-black px-6 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2 shadow-lg">
             <Store size={14} fill="black" /> MARKETPLACE
           </button>
        </div>
      </div>

      {view === 'receiving' ? (
        <div className="space-y-12">
           {!extractedData && !isAnalyzing ? (
              <div 
                className={`border-4 border-dashed rounded-[4rem] p-24 text-center transition-all relative overflow-hidden group ${dragActive ? 'bg-blue-600/10 border-blue-500 scale-[0.99]' : 'bg-[#111114] border-white/5 hover:border-white/10'}`}
                onDragEnter={handleDrag}
                onDragLeave={handleDrag}
                onDragOver={handleDrag}
                onDrop={handleFileUpload}
              >
                 <div className="max-w-md mx-auto space-y-8 relative z-10">
                    <div className="w-24 h-24 bg-blue-600/20 rounded-[2.5rem] flex items-center justify-center text-blue-500 mx-auto shadow-2xl group-hover:scale-110 transition-transform">
                       <FileUp size={40} />
                    </div>
                    <div>
                       <h3 className="text-3xl font-black italic uppercase tracking-tighter text-white leading-none">Ingesta Digital de Proveedores</h3>
                       <p className="text-gray-500 text-sm font-medium italic mt-6 px-10">Sube la foto de la factura recibida. Nexum clasificará automáticamente COSTO vs GASTO.</p>
                    </div>
                    
                    <label className="inline-block bg-white text-black px-12 py-5 rounded-full font-black text-xs uppercase tracking-widest shadow-xl hover:bg-blue-600 hover:text-white transition-all cursor-pointer active:scale-95">
                       SELECCIONAR FACTURAS
                       <input type="file" className="hidden" onChange={handleFileUpload} accept="image/*,application/pdf" />
                    </label>

                    {extractionError && (
                      <div className="p-4 bg-red-600/10 border border-red-500/20 rounded-2xl flex items-center gap-3 text-red-500 text-[10px] font-black uppercase tracking-widest mt-6">
                         <XCircle size={16} /> {extractionError}
                      </div>
                    )}
                 </div>
              </div>
           ) : isAnalyzing ? (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 animate-in fade-in zoom-in duration-500">
                 <div className="bg-[#111114] border border-white/5 rounded-[4rem] p-12 flex flex-col items-center justify-center relative overflow-hidden aspect-square lg:aspect-auto">
                    {/* Efecto de Escaneo Láser */}
                    <div className="absolute inset-0 z-20 pointer-events-none overflow-hidden">
                       <div className="w-full h-1 bg-blue-500 shadow-[0_0_20px_rgba(59,130,246,0.8)] animate-[scan_2s_ease-in-out_infinite] relative top-0"></div>
                       <style>{`
                        @keyframes scan {
                          0% { top: 10%; opacity: 0; }
                          50% { opacity: 1; }
                          100% { top: 90%; opacity: 0; }
                        }
                       `}</style>
                    </div>
                    {uploadPreview && (
                      <img src={uploadPreview} className="w-full h-full object-contain opacity-40 grayscale blur-[1px]" alt="Scanning" />
                    )}
                    <div className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center p-12 text-center">
                       <div className="w-20 h-20 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mb-8"></div>
                       <h3 className="text-2xl font-black italic uppercase text-white">Analizando Estructura Fiscal...</h3>
                       <p className="text-[10px] font-black uppercase tracking-[0.4em] text-blue-400 mt-4 animate-pulse">
                          {analysisStep === 1 ? 'DETECTANDO PROVEEDOR...' : analysisStep === 2 ? 'EXTRAYENDO TABLA DE ITEMS...' : 'VALIDANDO RETENCIONES...'}
                       </p>
                    </div>
                 </div>
                 
                 <div className="bg-[#111114] border border-white/5 rounded-[4rem] p-12 space-y-10 flex flex-col justify-center">
                    <div className="space-y-4">
                       <div className="flex items-center gap-3">
                          <Activity size={24} className="text-blue-500" />
                          <h4 className="text-xl font-black italic uppercase tracking-tighter">Nexum Multimodal Node</h4>
                       </div>
                       <p className="text-gray-400 text-sm italic leading-relaxed">Gemini 3 Flash está decodificando la imagen para alimentar el libro mayor y el inventario en tiempo real.</p>
                    </div>
                    <div className="space-y-6">
                       <LoadingBar label="OCR RAW DATA" progress={75} />
                       <LoadingBar label="P&L CLASSIFICATION" progress={40} />
                       <LoadingBar label="FISCAL SYNC (DIAN)" progress={10} />
                    </div>
                 </div>
              </div>
           ) : (
              <div className="animate-in slide-in-from-bottom-6 duration-700 space-y-10">
                 <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
                    {/* Resumen IA */}
                    <div className="lg:col-span-8 space-y-8">
                       <div className="bg-[#111114] border border-white/5 rounded-[4rem] overflow-hidden shadow-2xl">
                          <div className="p-10 border-b border-white/5 flex flex-col md:flex-row justify-between gap-6 bg-blue-600/5">
                             <div>
                                <span className="text-[10px] font-black text-blue-500 uppercase block mb-1 tracking-widest">Proveedor Extraído</span>
                                <h3 className="text-4xl font-black italic uppercase text-white leading-none tracking-tighter">{extractedData.proveedor}</h3>
                                <div className="flex items-center gap-4 mt-4">
                                   <span className="text-xs font-bold text-gray-500 uppercase">NIT: {extractedData.nit}</span>
                                   <span className="w-1 h-1 bg-gray-700 rounded-full"></span>
                                   <span className="text-xs font-bold text-gray-500 uppercase">FACTURA: {extractedData.factura_nro}</span>
                                </div>
                             </div>
                             <div className="text-right">
                                <span className="text-[10px] font-black text-gray-500 uppercase block tracking-widest">Fecha Emisión</span>
                                <span className="text-2xl font-black italic text-white tracking-tighter">{extractedData.fecha}</span>
                             </div>
                          </div>

                          <div className="p-10">
                             <table className="w-full text-left">
                                <thead>
                                   <tr className="text-[9px] font-black text-gray-600 uppercase tracking-[0.3em] border-b border-white/5">
                                      <th className="pb-6">Descripción del Ítem</th>
                                      <th className="pb-6">Cant.</th>
                                      <th className="pb-6">V. Unitario</th>
                                      <th className="pb-6">Naturaleza P&G</th>
                                      <th className="pb-6 text-right">Subtotal</th>
                                   </tr>
                                </thead>
                                <tbody className="divide-y divide-white/5">
                                   {extractedData.items?.map((item: any, idx: number) => (
                                      <tr key={idx} className="group hover:bg-white/[0.01] transition-all">
                                         <td className="py-8 text-sm font-black italic text-white uppercase tracking-tight">{item.nombre}</td>
                                         <td className="py-8 text-xs font-mono text-gray-500">{item.cantidad}</td>
                                         <td className="py-8 text-xs font-mono text-gray-500">$ {item.precio.toLocaleString()}</td>
                                         <td className="py-8">
                                            <span className={`text-[8px] font-black px-3 py-1 rounded-full uppercase tracking-widest ${item.categoria_pyg?.includes('Costo') ? 'bg-blue-600/10 text-blue-500' : 'bg-purple-600/10 text-purple-500'}`}>
                                               {item.categoria_pyg || 'Clasificando...'}
                                            </span>
                                         </td>
                                         <td className="py-8 text-right font-black italic text-white tracking-tight">$ {(item.cantidad * item.precio).toLocaleString()}</td>
                                      </tr>
                                   ))}
                                </tbody>
                             </table>

                             <div className="mt-12 pt-10 border-t border-white/10 grid grid-cols-1 md:grid-cols-3 gap-10">
                                <div className="p-8 bg-black/40 rounded-[2.5rem] border border-white/5">
                                   <span className="text-[9px] text-gray-600 font-black uppercase block mb-2 tracking-widest">Base Imponible</span>
                                   <span className="text-2xl font-black italic text-white tracking-tighter">$ {extractedData.analisis_fiscal?.subtotal.toLocaleString()}</span>
                                </div>
                                <div className="p-8 bg-black/40 rounded-[2.5rem] border border-white/5">
                                   <span className="text-[9px] text-gray-600 font-black uppercase block mb-2 tracking-widest">IVA / Impuestos</span>
                                   <span className="text-2xl font-black italic text-blue-500 tracking-tighter">$ {extractedData.analisis_fiscal?.iva?.toLocaleString() || '0'}</span>
                                </div>
                                <div className="p-8 bg-blue-600 rounded-[2.5rem] shadow-2xl shadow-blue-600/30">
                                   <span className="text-[9px] text-white/60 font-black uppercase block mb-2 tracking-widest">Gran Total Fiscal</span>
                                   <span className="text-4xl font-black italic text-white tracking-tighter">$ {extractedData.analisis_fiscal?.total.toLocaleString()}</span>
                                </div>
                             </div>
                          </div>

                          <div className="p-10 bg-black/40 border-t border-white/5 flex gap-4">
                             <button 
                               onClick={() => { alert('Datos sincronizados con éxito.'); setExtractedData(null); }}
                               className="flex-1 bg-white text-black py-6 rounded-full font-black text-xs uppercase tracking-widest shadow-xl hover:bg-blue-600 hover:text-white transition-all active:scale-95 flex items-center justify-center gap-3"
                             >
                                <CheckCircle size={18} /> CONFIRMAR E INGRESAR
                             </button>
                             <button onClick={() => setExtractedData(null)} className="px-12 bg-white/5 hover:bg-red-600 text-gray-500 hover:text-white py-6 rounded-full font-black text-xs uppercase transition-all tracking-widest">DESCARTAR</button>
                          </div>
                       </div>
                    </div>

                    {/* Sidebar de Inteligencia */}
                    <div className="lg:col-span-4 space-y-8">
                       <div className="bg-amber-500 p-10 rounded-[3.5rem] shadow-2xl relative overflow-hidden group">
                          <div className="absolute top-0 right-0 p-8 opacity-10 group-hover:scale-110 transition-transform duration-700">
                             <TrendingUp size={120} fill="black" />
                          </div>
                          <div className="relative z-10 space-y-6">
                             <div className="flex items-center gap-3">
                                <Zap size={20} fill="black" />
                                <h4 className="text-[10px] font-black text-black uppercase tracking-widest">Price Guard Agent</h4>
                             </div>
                             <p className="text-sm text-black italic font-bold leading-relaxed">
                                {extractedData.insight || "No se detectaron fluctuaciones críticas en este pedido."}
                             </p>
                          </div>
                       </div>

                       <div className="bg-[#111114] border border-white/5 p-10 rounded-[3.5rem] shadow-2xl">
                          <h4 className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-10 flex items-center gap-2 italic">
                             <ShieldCheck size={16} className="text-blue-500" /> Auditoría Fiscal OMM
                          </h4>
                          <div className="space-y-8">
                             <AuditRow label="Match de Proveedor" status="PASS" />
                             <AuditRow label="Verificación NIT DIAN" status="PASS" />
                             <AuditRow label="Validación Matemática" status="PASS" />
                             <AuditRow label="Clasificación COGS" status="AUTO" />
                          </div>
                       </div>
                       
                       <button onClick={() => setExtractedData(null)} className="w-full flex items-center justify-center gap-3 text-[10px] font-black text-gray-600 uppercase tracking-widest hover:text-white transition-colors">
                          <ArrowLeft size={14} /> SUBIR OTRA FACTURA
                       </button>
                    </div>
                 </div>
              </div>
           )}
        </div>
      ) : (
        <div className="space-y-12">
           {/* Vista de Inventario Normal */}
           <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              <StatCard label="Food Cost Actual" value="32.4%" status="BIEN" icon={<TrendingDown className="text-green-500" />} />
              <StatCard label="Varianza Real vs Teórico" value="4.2%" status="ALERTA" color="text-yellow-500" icon={<Scale className="text-yellow-500" />} />
              <StatCard label="Mano de Obra" value="39.2%" status="ALTO" color="text-red-500" icon={<AlertTriangle className="text-red-500" />} />
              <StatCard label="EBITDA Proyectado" value="21.7%" status="ÓPTIMO" color="text-green-500" icon={<TrendingUp className="text-green-500" />} />
           </div>

           <div className="bg-[#111114] border border-white/5 rounded-[4rem] overflow-hidden shadow-2xl">
              <div className="p-10 bg-black/20 border-b border-white/5 flex flex-col md:flex-row justify-between items-center gap-6">
                 <h3 className="text-xs font-black uppercase tracking-[0.4em] text-gray-500 italic">Core de Suministros & Clasificación NIIF</h3>
                 <div className="relative w-full md:w-96">
                    <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-600" />
                    <input type="text" placeholder="Filtrar por insumo o categoría P&G..." className="w-full bg-black/40 border border-white/10 rounded-2xl py-4 pl-14 pr-6 text-[10px] font-black text-white uppercase outline-none focus:border-blue-500 transition-all" />
                 </div>
              </div>
              <table className="w-full text-left">
                 <thead>
                    <tr className="bg-black/20 text-[8px] font-black text-gray-600 uppercase tracking-[0.5em]">
                       <th className="px-12 py-8">Insumo / Clasificación P&L</th>
                       <th className="px-12 py-8">Naturaleza</th>
                       <th className="px-12 py-8">Mapeo NIIF</th>
                       <th className="px-12 py-8 text-right">Diagnóstico IA</th>
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
                          <td className="px-12 py-10">
                             <span className={`text-[10px] font-black uppercase tracking-widest ${item.nature === 'COSTO' ? 'text-blue-500' : 'text-purple-500'}`}>{item.nature}</span>
                          </td>
                          <td className="px-12 py-10">
                             <span className="text-[10px] font-bold text-gray-500 uppercase italic tracking-wider">{item.niif_mapping}</span>
                          </td>
                          <td className="px-12 py-10 text-right">
                             {item.status === 'critical' ? (
                                <div className="flex flex-col items-end gap-1.5 animate-pulse">
                                   <span className="text-[9px] font-black text-red-500 uppercase italic">CRÍTICO</span>
                                   <span className="text-[7px] text-gray-700 font-bold uppercase">Reponer en Marketplace</span>
                                </div>
                             ) : (
                                <span className="text-[9px] font-black text-green-500 uppercase italic">ÓPTIMO</span>
                             )}
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

const LoadingBar = ({ label, progress }: { label: string, progress: number }) => (
  <div className="space-y-3">
     <div className="flex justify-between items-center text-[9px] font-black uppercase tracking-widest">
        <span className="text-gray-500">{label}</span>
        <span className="text-blue-500">{progress}%</span>
     </div>
     <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden">
        <div className="h-full bg-blue-500 shadow-[0_0_10px_rgba(59,130,246,0.6)] transition-all duration-1000" style={{ width: `${progress}%` }}></div>
     </div>
  </div>
);

const AuditRow = ({ label, status }: { label: string, status: string }) => (
  <div className="flex justify-between items-center border-b border-white/5 pb-4">
     <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">{label}</span>
     <span className={`text-[10px] font-black italic ${status === 'PASS' ? 'text-green-500' : 'text-blue-500'}`}>{status}</span>
  </div>
);

const StatCard = ({ label, value, status, icon, color }: any) => (
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
