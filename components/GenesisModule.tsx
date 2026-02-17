
import React, { useState, useEffect, useRef } from 'react';
import { 
  Rocket, 
  Sparkles, 
  ChevronRight, 
  Zap, 
  Upload, 
  Layout, 
  ChefHat, 
  Users, 
  CheckCircle2, 
  ArrowLeft,
  Loader2,
  ShieldCheck,
  Brain,
  Info,
  AlertCircle,
  FileText,
  Shield,
  Lock,
  CheckCircle,
  Target,
  TrendingUp,
  Fingerprint,
  DollarSign,
  PieChart,
  BarChart3,
  FileSearch,
  CheckSquare,
  X
} from 'lucide-react';
import { GoogleGenAI } from "@google/genai";
import { GenesisSignalScore, GenesisInternalReport } from '../types.ts';

interface GenesisModuleProps {
  onComplete: () => void;
  onExit?: () => void;
}

const CHAPTERS = [
  { id: 1, title: 'ADN_IDENTIDAD', icon: <Zap size={20} />, desc: 'Establece el alma de tu restaurante.' },
  { id: 2, title: 'TERRITORIO_ESTRUCTURA', icon: <Layout size={20} />, desc: 'Define tu capacidad y estaciones.' },
  { id: 3, title: 'ENGINE_MENÚ', icon: <ChefHat size={20} />, desc: 'Sube tu oferta gastronómica.' },
  { id: 4, title: 'LOGÍSTICA_PROVEEDORES', icon: <Upload size={20} />, desc: 'Mapea tu cadena de suministro.' },
  { id: 5, title: 'ACTIVOS_INVENTARIO', icon: <ShieldCheck size={20} />, desc: 'Registra tus existencias críticas.' },
  { id: 6, title: 'NEXO_TRIPULACIÓN', icon: <Users size={20} />, desc: 'Configura tu staff y roles.' },
];

const GenesisModule: React.FC<GenesisModuleProps> = ({ onComplete, onExit }) => {
  const [currentStep, setCurrentStep] = useState(0); 
  const [isNovaThinking, setIsNovaThinking] = useState(false);
  const [novaStatus, setNovaStatus] = useState<'normal' | 'error' | 'success'>('normal');
  const [novaInsight, setNovaInsight] = useState<string>("Para que tu restaurante trascienda a la dimensión de la inteligencia, debemos establecer las bases de nuestra alianza estratégica.");
  const [isLaunching, setIsLaunching] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [showInternalReport, setShowInternalReport] = useState(false);
  
  // Scoring Analytics
  const [startTime] = useState(Date.now());
  const [internalScore, setInternalScore] = useState<GenesisSignalScore | null>(null);

  // Data State
  const [formData, setFormData] = useState<any>({
    name: '',
    country: 'Colombia',
    currency: 'COP',
    concept: '',
    type: 'CASUAL_PREMIUM',
    tables2: 0,
    tables4: 0,
    stations: [],
    monthlySales: 0,
    staffCount: 0,
    menuItemsCount: 0,
    hasRecipes: false,
    hasSuppliers: false,
    hasInventory: false,
    inventoryValue: 0,
    payrollValue: 0
  });

  const calculateSignalScore = (): GenesisSignalScore => {
    const totalPax = (formData.tables2 * 2) + (formData.tables4 * 4);
    let size = 0;
    if (totalPax > 80) size = 25;
    else if (totalPax > 50) size = 20;
    else if (totalPax > 25) size = 15;
    else if (totalPax > 10) size = 8;
    else size = 3;

    const theoreticalCap = totalPax * 2.5 * 30 * 80000;
    let revenueScore = 0;
    if (formData.monthlySales > 0) {
        const gap = theoreticalCap / formData.monthlySales;
        if (gap > 2) revenueScore = 25;
        else if (gap > 1.5) revenueScore = 18;
        else revenueScore = 10;
    } else { revenueScore = 5; }

    let complexity = 0;
    complexity += (formData.stations.length * 2);
    complexity += formData.menuItemsCount > 50 ? 8 : formData.menuItemsCount > 20 ? 5 : 2;
    complexity = Math.min(20, complexity);

    let maturity = 0;
    if (formData.hasRecipes) maturity += 5;
    if (formData.hasSuppliers) maturity += 5;
    if (formData.inventoryValue > 0) maturity += 5;

    let strategy = 0;
    if (formData.type === 'FINE_DINING') strategy = 15;
    else if (formData.type === 'CASUAL_PREMIUM') strategy = 12;
    else strategy = 8;

    const total = size + revenueScore + complexity + maturity + strategy;
    
    let classification: any = 'MICRO';
    if (total > 80) classification = 'PREMIUM';
    else if (total > 60) classification = 'INTERESTING';
    else if (total > 30) classification = 'MEDIUM';

    return { size, revenue: revenueScore, complexity, dataMaturity: maturity, strategicValue: strategy, total, classification, insights: [] };
  };

  const getNovaGuidance = async (isBlocked: boolean = false) => {
    setIsNovaThinking(true);
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const context = `Capítulo ${currentStep}. Datos: ${JSON.stringify(formData)}.`;

    try {
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: `Eres NOVA de NEXUM GÉNESIS.
        ${isBlocked ? "Indica qué falta exactamente para avanzar." : "Da un insight estratégico futurista y motivador."}
        Contexto: ${context}. Tono: Elegante, sereno, inteligente. Máximo 2 frases.`,
      });
      setNovaInsight(response.text || "Protocolo validado.");
      setNovaStatus(isBlocked ? 'error' : 'success');
    } catch (e) {
      setNovaInsight(isBlocked ? "Aún hay vacíos en el protocolo." : "Estructura sólida detectada.");
    } finally {
      setIsNovaThinking(false);
    }
  };

  const handleNext = async () => {
    const isValid = validateChapter(currentStep);
    if (!isValid) {
      setNovaStatus('error');
      await getNovaGuidance(true);
      return;
    }
    if (currentStep < 6) {
      setCurrentStep(prev => prev + 1);
      await getNovaGuidance(false);
    } else {
      const finalScore = calculateSignalScore();
      setInternalScore(finalScore);
      setCurrentStep(7); 
    }
  };

  const validateChapter = (step: number) => {
    switch (step) {
      case 0: return termsAccepted;
      case 1: return formData.name.length > 3 && formData.concept.length > 5;
      case 2: return (formData.tables2 + formData.tables4) > 0 && formData.stations.length > 0;
      case 3: return formData.menuItemsCount > 0;
      case 4: return formData.hasSuppliers;
      case 5: return formData.inventoryValue > 0;
      case 6: return formData.staffCount > 0;
      default: return true;
    }
  };

  const handleLaunch = () => {
    setIsLaunching(true);
    setTimeout(() => {
        setIsLaunching(false);
        setShowInternalReport(true);
    }, 4000);
  };

  // PANTALLA DE REPORTE INTERNO (SCORING)
  if (showInternalReport && internalScore) {
     return (
        <div className="fixed inset-0 z-[3000] bg-[#050505] text-white flex flex-col overflow-y-auto custom-scrollbar p-10 md:p-20 text-left animate-in fade-in duration-700">
           <div className="max-w-5xl mx-auto space-y-12">
              <div className="flex justify-between items-center border-b border-white/10 pb-8">
                 <div className="flex items-center gap-6">
                    <div className="w-16 h-16 bg-blue-600 rounded-3xl flex items-center justify-center shadow-2xl">
                       <Fingerprint size={32} />
                    </div>
                    <div>
                       <h2 className="text-4xl font-black italic uppercase tracking-tighter leading-none">Internal Genesis <span className="text-blue-500">Signal Report</span></h2>
                       <p className="text-[10px] text-gray-500 font-bold uppercase tracking-[0.4em] mt-3">Priority Detection Engine v4.0</p>
                    </div>
                 </div>
                 <div className="text-right">
                    <span className="text-[9px] text-gray-600 font-black uppercase block">Ref Code</span>
                    <span className="text-lg font-black italic text-white font-mono">GEN-{Math.floor(Math.random()*99999)}</span>
                 </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
                 {/* Score Radar */}
                 <div className="lg:col-span-1 bg-[#111114] border border-white/5 p-10 rounded-[3.5rem] flex flex-col items-center justify-center text-center space-y-6 shadow-2xl relative overflow-hidden">
                    <div className="absolute inset-0 bg-blue-600/5 blur-[80px] rounded-full"></div>
                    <div className="relative z-10">
                       <span className="text-[10px] font-black text-gray-500 uppercase tracking-widest block mb-4">Génesis Signal Score</span>
                       <div className="text-8xl font-black italic text-blue-500 tracking-tighter leading-none">{internalScore.total}</div>
                       <span className="text-xs font-black uppercase text-gray-400 mt-4 block">pts / 100</span>
                    </div>
                    <div className={`relative z-10 px-6 py-2 rounded-full font-black text-[10px] uppercase tracking-widest ${
                       internalScore.classification === 'PREMIUM' ? 'bg-red-600 text-white shadow-[0_0_20px_rgba(220,38,38,0.5)]' :
                       internalScore.classification === 'INTERESTING' ? 'bg-blue-600 text-white shadow-[0_0_20px_rgba(37,99,235,0.5)]' :
                       'bg-gray-800 text-gray-400'
                    }`}>
                       {internalScore.classification} LEAD
                    </div>
                 </div>

                 {/* Desglose de Atributos */}
                 <div className="lg:col-span-2 space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                       <ScoreBar label="Size & Structure" value={internalScore.size} max={25} />
                       <ScoreBar label="Revenue Potential" value={internalScore.revenue} max={25} />
                       <ScoreBar label="Operational Complexity" value={internalScore.complexity} max={20} />
                       <ScoreBar label="Data Maturity" value={internalScore.dataMaturity} max={15} />
                       <ScoreBar label="Strategic Value" value={internalScore.strategicValue} max={15} />
                       <div className="bg-blue-600/10 border border-blue-500/20 p-6 rounded-[2rem] flex justify-between items-center">
                          <span className="text-[9px] font-black uppercase text-gray-400 italic">Lead Intent behavior</span>
                          <span className="text-lg font-black italic text-blue-500">{Math.min(100, Math.floor((Date.now() - startTime) / 8000))}%</span>
                       </div>
                    </div>
                 </div>
              </div>

              {/* Insights para el Equipo Comercial */}
              <div className="bg-white/5 border border-white/10 rounded-[3.5rem] p-12 space-y-8">
                 <h3 className="text-xl font-black italic uppercase flex items-center gap-3">
                    <Brain size={24} className="text-blue-500" /> Executive Sales Insights (AI Generated)
                 </h3>
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <InsightNote 
                      icon={<TrendingUp size={18} />} 
                      title="Oportunidad de Upsell" 
                      text={`El restaurante tiene un ticket potencial alto dado su perfil ${formData.type}. Se recomienda plan Premium con módulo de Cava.`} 
                    />
                    <InsightNote 
                      icon={<AlertCircle size={18} />} 
                      title="Riesgo Operativo" 
                      text={`Gap alto entre capacidad teórica y venta real detectado. La eficiencia de rotación de mesas es el primer "pain point" a atacar.`} 
                    />
                 </div>
              </div>

              <div className="pt-10 flex flex-col items-center gap-6">
                 <button 
                  onClick={onComplete}
                  className="bg-white text-black px-16 py-6 rounded-[2.5rem] font-black italic text-sm uppercase tracking-[0.3em] shadow-2xl hover:bg-blue-600 hover:text-white transition-all active:scale-95 flex items-center gap-4"
                 >
                    ENTRAR AL SISTEMA REAL <Rocket size={20} />
                 </button>
                 <p className="text-[8px] text-gray-600 font-bold uppercase tracking-widest text-center italic">Este reporte es solo para uso interno de la administración de NEXUM. <br/> El usuario final no tiene acceso a esta visualización.</p>
              </div>
           </div>
        </div>
     );
  }

  if (isLaunching) {
    return (
      <div className="fixed inset-0 z-[2000] bg-[#050505] flex flex-col items-center justify-center overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-tr from-blue-900/20 via-black to-purple-900/20"></div>
        <div className="relative z-10 flex flex-col items-center animate-out fade-out duration-[3500ms]">
          <div className="rocket-animation mb-12">
            <Rocket size={120} className="text-blue-500 animate-bounce fill-blue-500/20" />
            <div className="w-1 h-32 bg-gradient-to-b from-blue-500 to-transparent mx-auto mt-4 blur-sm animate-pulse"></div>
          </div>
          <h2 className="text-6xl font-black italic tracking-tighter uppercase text-white animate-pulse">IGNICIÓN</h2>
          <p className="text-blue-400 font-black uppercase tracking-[0.8em] mt-6 text-xs text-center">Finalizing Genesis Sequence</p>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[1000] bg-[#050505] text-white flex flex-col overflow-hidden font-sans text-left selection:bg-blue-600">
      
      {/* Background Ambience */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className={`absolute top-1/4 left-1/4 w-[600px] h-[600px] blur-[150px] rounded-full transition-colors duration-1000 ${novaStatus === 'error' ? 'bg-red-600/10' : 'bg-blue-600/5'}`}></div>
        <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-[0.02]"></div>
      </div>

      <header className="relative z-10 px-12 py-8 flex justify-between items-center border-b border-white/5 bg-black/40 backdrop-blur-xl">
        <div className="flex items-center gap-6">
          <div className="w-12 h-12 bg-blue-600 rounded-2xl flex items-center justify-center shadow-lg shadow-blue-600/30">
            <Rocket className="text-white" size={24} />
          </div>
          <div>
            <h1 className="text-3xl font-black italic tracking-tighter uppercase leading-none">NEXUM <span className="text-blue-500">GÉNESIS</span></h1>
            <p className="text-[9px] text-gray-500 font-bold uppercase tracking-[0.4em] mt-1 italic">Setup protocol guided by NOVA</p>
          </div>
        </div>

        <div className="flex items-center gap-8">
           {onExit && (
             <button 
              onClick={onExit}
              className="bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white px-6 py-2.5 rounded-xl text-[9px] font-black uppercase tracking-widest flex items-center gap-2 transition-all border border-white/5 shadow-lg backdrop-blur-md"
             >
                <ArrowLeft size={14} /> SALIR AL CORE
             </button>
           )}
           <div className="w-48 h-1.5 bg-white/5 rounded-full overflow-hidden border border-white/10">
              <div className="h-full bg-blue-600 transition-all duration-1000" style={{ width: `${(currentStep/7)*100}%` }}></div>
           </div>
        </div>
      </header>

      <main className="flex-1 relative z-10 flex flex-col lg:flex-row overflow-hidden">
        
        {/* Progress Sidebar */}
        <div className="w-full lg:w-[400px] border-r border-white/5 p-10 flex flex-col items-center justify-center bg-black/20 shrink-0">
           <div className="relative w-full max-w-xs space-y-2 mb-10">
              <RocketPart active={currentStep >= 6} type="Capsule" label="Crew & Access" />
              <RocketPart active={currentStep >= 5} type="Body" label="Inventory Tank" />
              <RocketPart active={currentStep >= 4} type="Body" label="Supply Core" />
              <RocketPart active={currentStep >= 3} type="Body" label="Menu Engine" />
              <RocketPart active={currentStep >= 2} type="Body" label="Operational Territory" />
              <RocketPart active={currentStep >= 1} type="Engine" label="Identity Thrusters" />
           </div>

           <div className="w-full space-y-3">
              <div className={`flex items-center gap-4 p-4 rounded-2xl transition-all duration-500 ${currentStep === 0 ? 'bg-white/5 border border-white/10 scale-105' : 'opacity-20'}`}>
                 <div className={`${currentStep === 0 ? 'text-blue-500' : 'text-gray-500'}`}><Shield size={20} /></div>
                 <div>
                    <p className="text-[10px] font-black uppercase tracking-widest">ALIANZA ESTRATÉGICA</p>
                    <p className="text-[8px] text-gray-600 font-bold uppercase tracking-tighter">LEGAL_PROTOCOL_V4</p>
                 </div>
                 {currentStep > 0 && <CheckCircle2 size={16} className="ml-auto text-green-500" />}
              </div>
              {CHAPTERS.map(ch => (
                <div key={ch.id} className={`flex items-center gap-4 p-4 rounded-2xl transition-all duration-500 ${currentStep === ch.id ? 'bg-white/5 border border-white/10 scale-105' : 'opacity-20'}`}>
                   <div className={`${currentStep === ch.id ? 'text-blue-500' : 'text-gray-500'}`}>{ch.icon}</div>
                   <div>
                      <p className="text-[10px] font-black uppercase tracking-widest">{ch.title}</p>
                      <p className="text-[8px] text-gray-600 font-bold uppercase">{ch.desc}</p>
                   </div>
                   {currentStep > ch.id && <CheckCircle2 size={16} className="ml-auto text-green-500" />}
                </div>
              ))}
           </div>
        </div>

        {/* Dynamic Chapter Wizard */}
        <div className="flex-1 p-12 lg:p-24 overflow-y-auto custom-scrollbar bg-black/10">
           <div className="max-w-3xl mx-auto space-y-16 animate-in slide-in-from-bottom duration-700">
              
              {currentStep === 0 && (
                <div className="space-y-12 animate-in fade-in duration-1000 text-left">
                   <div className="space-y-4">
                      <div className="inline-flex items-center gap-2 bg-blue-600/20 px-4 py-1 rounded-full border border-blue-500/30 text-[10px] font-black text-blue-400 uppercase tracking-widest mb-2">
                        <Lock size={12} /> PROTOCOLO DE PRIVACIDAD V4
                      </div>
                      <h2 className="text-5xl font-black italic tracking-tighter uppercase leading-[0.9]">ALIANZA <br/> <span className="text-blue-500">ESTRATÉGICA.</span></h2>
                   </div>
                   <div className="bg-white/[0.03] border border-white/10 rounded-[2.5rem] p-10 h-[400px] overflow-y-auto custom-scrollbar text-gray-400 text-xs leading-relaxed space-y-8 font-medium">
                      <p>NEXUM es una plataforma SaaS diseñada para estructurar y optimizar la operación gastronómica. Al utilizar NEXUM, el Usuario autoriza expresamente el procesamiento de su información operativa para entrenar modelos de IA y mejorar el ecosistema global de la plataforma.</p>
                      <p>El Usuario conserva la titularidad de su información, pero otorga licencia a NEXUM para generar análisis comparativos anonimizados.</p>
                   </div>
                   <div className="pt-6">
                      <label className="flex items-center gap-6 cursor-pointer group bg-white/5 p-6 rounded-3xl border border-white/10 hover:border-blue-500/40 transition-all">
                         <div className="relative">
                            <input type="checkbox" checked={termsAccepted} onChange={(e) => setTermsAccepted(e.target.checked)} className="peer sr-only" />
                            <div className="w-8 h-8 bg-black border-2 border-white/20 rounded-xl peer-checked:bg-blue-600 peer-checked:border-blue-400 transition-all flex items-center justify-center">
                               {termsAccepted && <CheckCircle size={18} className="text-white" />}
                            </div>
                         </div>
                         <span className="text-[11px] font-black uppercase tracking-widest text-gray-500 group-hover:text-white transition-colors">Acepto los Términos de Uso y la Política de Datos de NEXUM.</span>
                      </label>
                   </div>
                </div>
              )}

              {currentStep === 1 && (
                <div className="space-y-12 animate-in slide-in-from-right duration-700">
                   <div className="space-y-4">
                      <h2 className="text-5xl font-black italic tracking-tighter uppercase leading-[0.9]">EL <span className="text-blue-500">ADN</span> DE TU MARCA</h2>
                      <p className="text-gray-400 text-lg italic leading-relaxed text-left">¿Cómo conocerá el mundo a tu restaurante?</p>
                   </div>
                   <div className="grid grid-cols-1 md:grid-cols-2 gap-8 text-left">
                      <GenesisInput label="Nombre del Restaurante" value={formData.name} onChange={(v:any) => setFormData({...formData, name: v})} placeholder="Ej: Seratta Experience" />
                      <GenesisInput label="Concepto Breve" value={formData.concept} onChange={(v:any) => setFormData({...formData, concept: v})} placeholder="Ej: Cocina de autoría Zen" />
                      <GenesisSelect label="Tipo de Negocio" options={['FINE_DINING', 'CASUAL_PREMIUM', 'BAR_NIGHTLIFE', 'QSR_FAST_CASUAL']} value={formData.type} onChange={(v:any) => setFormData({...formData, type: v})} />
                      <GenesisSelect label="Moneda Core" options={['COP', 'USD', 'MXN', 'EUR']} value={formData.currency} onChange={(v:any) => setFormData({...formData, currency: v})} />
                   </div>
                </div>
              )}

              {currentStep === 2 && (
                <div className="space-y-12 animate-in slide-in-from-right duration-700">
                   <div className="space-y-4">
                      <h2 className="text-5xl font-black italic tracking-tighter uppercase leading-[0.9]">TERRITORIO <span className="text-blue-500">OPERATIVO</span></h2>
                      <p className="text-gray-400 text-lg italic leading-relaxed text-left">Mapeemos la capacidad física y el performance base.</p>
                   </div>
                   <div className="grid grid-cols-2 md:grid-cols-4 gap-6 text-left">
                      <Counter label="Mesas 2p" value={formData.tables2} onChange={(v:any) => setFormData({...formData, tables2: v})} />
                      <Counter label="Mesas 4p" value={formData.tables4} onChange={(v:any) => setFormData({...formData, tables4: v})} />
                      <Counter label="Barra (Pax)" value={12} />
                      <Counter label="Privados" value={2} />
                   </div>
                   <div className="space-y-8 text-left">
                      <GenesisInput label={`Venta Mensual Promedio (${formData.currency})`} value={formData.monthlySales} onChange={(v:any) => setFormData({...formData, monthlySales: parseInt(v) || 0})} placeholder="Ej: 150000000" />
                      <div className="space-y-4">
                         <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest block ml-1">Estaciones Activas</label>
                         <div className="flex flex-wrap gap-3">
                            {['Cocina Caliente', 'Cocina Fría', 'Robata', 'Sushi', 'Bar', 'Cava'].map(st => (
                               <button key={st} onClick={() => {
                                    const news = formData.stations.includes(st) ? formData.stations.filter((s:any) => s !== st) : [...formData.stations, st];
                                    setFormData({...formData, stations: news});
                               }} className={`px-6 py-3 rounded-xl text-[9px] font-black uppercase tracking-widest border-2 transition-all ${formData.stations.includes(st) ? 'bg-blue-600 border-blue-400 text-white shadow-xl' : 'bg-white/5 border-white/5 text-gray-500'}`}>{st}</button>
                            ))}
                         </div>
                      </div>
                   </div>
                </div>
              )}

              {currentStep === 3 && (
                <div className="space-y-12 animate-in slide-in-from-right duration-700">
                   <div className="space-y-4">
                      <h2 className="text-5xl font-black italic tracking-tighter uppercase leading-[0.9]">MENÚ <span className="text-blue-500">ENGINE</span></h2>
                      <p className="text-gray-400 text-lg italic leading-relaxed text-left">Carga tu oferta gastronómica para entrenar al POS IA.</p>
                   </div>
                   <div className="bg-[#111114] border-2 border-dashed border-white/10 rounded-[3.5rem] p-12 text-center group hover:border-blue-500 transition-all cursor-pointer">
                      <div className="w-20 h-20 bg-blue-600/10 rounded-3xl flex items-center justify-center text-blue-500 mx-auto mb-6 group-hover:scale-110 transition-transform">
                         <ChefHat size={40} />
                      </div>
                      <h4 className="text-xl font-black uppercase italic">Arrastra tu Menú PDF</h4>
                      <p className="text-xs text-gray-600 mt-2 font-bold uppercase">NEXUM extraerá platos, precios e insumos automáticamente.</p>
                   </div>
                   <div className="grid grid-cols-1 md:grid-cols-2 gap-8 text-left">
                      <GenesisInput label="Items totales en Carta" value={formData.menuItemsCount} onChange={(v:any) => setFormData({...formData, menuItemsCount: parseInt(v) || 0})} placeholder="Ej: 45" />
                      <div className="flex items-center gap-6 p-6 bg-white/5 rounded-3xl border border-white/10 mt-6">
                         <div className="flex-1">
                            <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest block mb-1">Recetas Estándar</span>
                            <span className="text-[8px] text-gray-600 font-bold uppercase leading-tight italic">¿Tienes costeo de platos actualizado?</span>
                         </div>
                         <button onClick={() => setFormData({...formData, hasRecipes: !formData.hasRecipes})} className={`w-14 h-8 rounded-full relative transition-all ${formData.hasRecipes ? 'bg-blue-600' : 'bg-gray-800'}`}>
                            <div className={`absolute top-1 w-6 h-6 bg-white rounded-full transition-all ${formData.hasRecipes ? 'left-7' : 'left-1'}`}></div>
                         </button>
                      </div>
                   </div>
                </div>
              )}

              {currentStep === 4 && (
                 <div className="space-y-12 animate-in slide-in-from-right duration-700">
                    <div className="space-y-4">
                       <h2 className="text-5xl font-black italic tracking-tighter uppercase leading-[0.9]">SUPPLY <span className="text-blue-500">CORE</span></h2>
                       <p className="text-gray-400 text-lg italic leading-relaxed text-left">Mapea tus proveedores para el motor de inventario.</p>
                    </div>
                    <div className="bg-[#111114] border-2 border-dashed border-white/10 rounded-[3.5rem] p-12 text-center group hover:border-blue-500 transition-all cursor-pointer" onClick={() => setFormData({...formData, hasSuppliers: true})}>
                       <div className="w-20 h-20 bg-blue-600/10 rounded-3xl flex items-center justify-center text-blue-500 mx-auto mb-6">
                          <Upload size={40} />
                       </div>
                       <h4 className="text-xl font-black uppercase italic">Sube 3 Facturas de Insumos</h4>
                       <p className="text-xs text-gray-600 mt-2 font-bold uppercase">NEXUM identificará variaciones de precio y proveedores clave.</p>
                       {formData.hasSuppliers && <div className="mt-6 flex items-center justify-center gap-3 text-green-500 animate-in zoom-in"><CheckCircle2 size={20} /><span className="text-[10px] font-black uppercase">DATA EXTRACTED_OK</span></div>}
                    </div>
                 </div>
              )}

              {currentStep === 5 && (
                 <div className="space-y-12 animate-in slide-in-from-right duration-700 text-left">
                    <div className="space-y-4">
                       <h2 className="text-5xl font-black italic tracking-tighter uppercase leading-[0.9]">ASSET <span className="text-blue-500">INVENTORY</span></h2>
                       <p className="text-gray-400 text-lg italic leading-relaxed">Valoración actual de bodega y cobertura.</p>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                       <GenesisInput label={`Valor Total en Bodega (${formData.currency})`} value={formData.inventoryValue} onChange={(v:any) => setFormData({...formData, inventoryValue: parseInt(v) || 0})} placeholder="Ej: 45000000" />
                       <GenesisSelect label="Disciplina de Inventario" options={['Diario', 'Semanal', 'Mensual', 'Nunca']} value="Semanal" />
                    </div>
                 </div>
              )}

              {currentStep === 6 && (
                 <div className="space-y-12 animate-in slide-in-from-right duration-700 text-left">
                    <div className="space-y-4">
                       <h2 className="text-5xl font-black italic tracking-tighter uppercase leading-[0.9]">NEXO <span className="text-blue-500">TRIPULACIÓN</span></h2>
                       <p className="text-gray-400 text-lg italic leading-relaxed">Estructura organizacional y costos de nómina.</p>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                       <GenesisInput label="Número de Empleados" value={formData.staffCount} onChange={(v:any) => setFormData({...formData, staffCount: parseInt(v) || 0})} placeholder="Ej: 12" />
                       <GenesisInput label={`Nómina Mensual Base (${formData.currency})`} value={formData.payrollValue} onChange={(v:any) => setFormData({...formData, payrollValue: parseInt(v) || 0})} placeholder="Ej: 18000000" />
                    </div>
                 </div>
              )}

              {currentStep === 7 && internalScore && (
                <div className="space-y-12 animate-in zoom-in duration-1000">
                   <div className="text-center space-y-6">
                      <div className="inline-flex items-center gap-2 bg-blue-600/20 px-6 py-2 rounded-full border border-blue-500/30 text-[10px] font-black text-blue-400 uppercase tracking-widest mb-4">
                        <Sparkles size={14} /> VISIÓN GÉNESIS COMPLETADA
                      </div>
                      <h2 className="text-7xl font-black italic tracking-tighter uppercase leading-[0.9]">ESTÁS LISTO <br/> <span className="text-blue-500">PARA EL LANZAMIENTO.</span></h2>
                   </div>
                   <div className="bg-[#111114] border border-white/10 rounded-[3.5rem] p-12 grid grid-cols-1 md:grid-cols-2 gap-12 shadow-2xl relative overflow-hidden text-left">
                      <div className="absolute top-0 right-0 p-10 opacity-5"><Brain size={140} className="text-blue-500" /></div>
                      <div className="space-y-8 relative z-10">
                         <h4 className="text-xs font-black text-gray-500 uppercase tracking-widest border-b border-white/5 pb-4 italic">Perfil de Activación</h4>
                         <div className="space-y-6">
                            <SummaryRow label="Capacidad Teórica" value={`${(formData.tables2*2 + formData.tables4*4)} PAX`} />
                            <SummaryRow label="Estatus Operativo" value={formData.type.replace('_', ' ')} />
                            <SummaryRow label="Nivel de Inteligencia" value="CALIBRADO" color="text-blue-500" />
                         </div>
                      </div>
                      <div className="space-y-8 relative z-10">
                         <h4 className="text-xs font-black text-gray-500 uppercase tracking-widest border-b border-white/5 pb-4 italic">Insights de NOVA</h4>
                         <div className="space-y-4">
                            <p className="text-xs text-gray-400 italic leading-relaxed">✓ Sistema POS estructurado.</p>
                            <p className="text-xs text-gray-400 italic leading-relaxed">✓ Flujo de cocina mapeado a {formData.stations.length} estaciones.</p>
                         </div>
                      </div>
                   </div>
                </div>
              )}

              {/* Botones de Navegación */}
              <div className="pt-12 border-t border-white/5 flex justify-between items-center relative z-10">
                 <button onClick={() => currentStep > 0 && setCurrentStep(prev => prev -1)} className={`flex items-center gap-3 text-[10px] font-black uppercase tracking-widest text-gray-600 hover:text-white transition-all ${currentStep === 0 ? 'opacity-0 pointer-events-none' : ''}`}><ArrowLeft size={16} /> Regresar</button>
                 {currentStep < 7 ? (
                   <button onClick={handleNext} className={`px-12 py-5 rounded-2xl font-black italic text-[11px] uppercase tracking-widest transition-all flex items-center gap-3 shadow-xl active:scale-95 group ${validateChapter(currentStep) ? 'bg-blue-600 text-white shadow-blue-600/20 hover:bg-blue-500' : 'bg-gray-800 text-gray-500 border border-white/10'}`}>
                      {currentStep === 0 ? 'ACEPTAR Y COMENZAR' : 'SIGUIENTE PASO'} <ChevronRight size={18} />
                   </button>
                 ) : (
                   <button onClick={handleLaunch} className="bg-gradient-to-r from-blue-600 to-blue-800 hover:from-blue-500 hover:to-blue-700 text-white px-16 py-6 rounded-[2.5rem] font-black italic text-sm uppercase tracking-[0.3em] transition-all flex items-center gap-4 shadow-[0_20px_60px_rgba(37,99,235,0.4)] active:scale-95 group animate-pulse">LAUNCH NEXUM <Rocket size={22} /></button>
                 )}
              </div>
           </div>
        </div>

        {/* NOVA Agent Panel */}
        <div className="w-full lg:w-[450px] bg-[#0a0a0c] border-l border-white/5 p-10 flex flex-col overflow-y-auto shrink-0">
           <div className="flex-1 flex flex-col justify-center items-center text-center space-y-10">
              <div className="relative">
                 <div className={`w-36 h-36 rounded-full blur-sm flex items-center justify-center transition-all duration-1000 relative z-10 ${isNovaThinking ? 'animate-pulse scale-110 bg-blue-400 shadow-[0_0_80px_rgba(59,130,246,0.6)]' : novaStatus === 'error' ? 'bg-red-600 shadow-[0_0_80px_rgba(220,38,38,0.6)] scale-95' : 'bg-blue-600 shadow-[0_0_60px_rgba(37,99,235,0.6)]'}`}>
                    {novaStatus === 'error' ? <AlertCircle size={48} className="text-white" /> : <Brain size={48} className="text-white" />}
                 </div>
                 <div className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-56 h-56 rounded-full border transition-colors duration-1000 animate-ping ${novaStatus === 'error' ? 'border-red-500/20' : 'border-blue-500/20'}`}></div>
              </div>
              <div className="space-y-6 w-full">
                 <div className="flex items-center justify-center gap-3"><div className={`w-2.5 h-2.5 rounded-full animate-pulse ${novaStatus === 'error' ? 'bg-red-500' : 'bg-blue-500'}`}></div><h4 className="text-xl font-black italic uppercase text-white tracking-tighter">NOVA AGENT</h4></div>
                 <div className={`bg-white/5 border p-8 rounded-[2.5rem] relative transition-colors duration-500 ${novaStatus === 'error' ? 'border-red-500/30' : 'border-white/10'}`}>
                    <div className={`absolute -top-3 left-1/2 -translate-x-1/2 px-5 py-1 rounded-full text-[7px] font-black uppercase text-white shadow-lg ${novaStatus === 'error' ? 'bg-red-600' : 'bg-blue-600'}`}>{novaStatus === 'error' ? 'Protocolo Bloqueado' : 'Live Analysis'}</div>
                    {isNovaThinking ? <div className="flex gap-2 justify-center py-6"><div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce"></div><div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{animationDelay:'0.2s'}}></div><div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{animationDelay:'0.4s'}}></div></div> : <p className={`text-sm italic font-medium leading-relaxed animate-in fade-in duration-700 ${novaStatus === 'error' ? 'text-red-400' : 'text-gray-300'}`}>"{novaInsight}"</p>}
                 </div>
              </div>
           </div>
           <div className="pt-10 border-t border-white/5 space-y-4"><div className="flex items-center gap-4 bg-blue-600/5 p-4 rounded-2xl border border-blue-500/10"><ShieldCheck size={16} className="text-blue-500" /><p className="text-[9px] text-gray-500 font-bold uppercase tracking-widest italic">Signal Score Active</p></div></div>
        </div>
      </main>
    </div>
  );
};

const GenesisInput = ({ label, value, onChange, placeholder }: any) => (
  <div className="space-y-3">
     <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest block ml-1">{label}</label>
     <input type="text" value={value} onChange={(e) => onChange(e.target.value)} className="w-full bg-white/5 border border-white/10 rounded-2xl py-5 px-8 text-sm font-black italic outline-none focus:border-blue-500 transition-all placeholder:text-gray-800 text-white" placeholder={placeholder} />
  </div>
);

const GenesisSelect = ({ label, options, value, onChange }: any) => (
  <div className="space-y-3">
     <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest block ml-1">{label}</label>
     <select value={value} onChange={(e) => onChange(e.target.value)} className="w-full bg-white/5 border border-white/10 rounded-2xl py-5 px-8 text-sm font-black italic outline-none focus:border-blue-500 transition-all appearance-none cursor-pointer uppercase text-white"><option className="bg-black" value="">Seleccionar...</option>{options.map((o:any) => <option key={o} value={o} className="bg-black">{o.replace('_', ' ')}</option>)}</select>
  </div>
);

const Counter = ({ label, value, onChange }: any) => (
  <div className="bg-white/5 border border-white/10 p-6 rounded-3xl flex flex-col items-center gap-4 group hover:border-blue-500/30 transition-all">
     <span className="text-[8px] font-black text-gray-600 uppercase tracking-widest text-center h-4">{label}</span>
     <div className="flex items-center gap-6">
        <button onClick={() => onChange?.(Math.max(0, value-1))} className="text-gray-500 hover:text-white transition-colors font-black text-xl">-</button>
        <span className="text-3xl font-black italic text-white group-hover:text-blue-500 transition-colors">{value}</span>
        <button onClick={() => onChange?.(value+1)} className="text-gray-500 hover:text-white transition-colors font-black text-xl">+</button>
     </div>
  </div>
);

const SummaryRow = ({ label, value, color }: any) => (
  <div className="flex justify-between items-center border-b border-white/5 pb-3">
     <span className="text-[10px] font-black text-gray-600 uppercase tracking-widest">{label}</span>
     <span className={`text-sm font-black italic ${color || 'text-white'}`}>{value}</span>
  </div>
);

const ScoreBar = ({ label, value, max }: { label: string, value: number, max: number }) => (
  <div className="bg-white/5 border border-white/10 p-6 rounded-[2rem] space-y-3">
     <div className="flex justify-between items-center text-[10px] font-black uppercase tracking-widest">
        <span className="text-gray-500">{label}</span>
        <span className="text-blue-500">{value} / {max}</span>
     </div>
     <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden">
        <div className="h-full bg-blue-600 transition-all duration-1000" style={{ width: `${(value/max)*100}%` }}></div>
     </div>
  </div>
);

const InsightNote = ({ icon, title, text }: any) => (
  <div className="bg-black/40 border border-white/5 p-8 rounded-3xl space-y-4">
     <div className="flex items-center gap-3 text-blue-500">
        {icon}
        <h4 className="text-xs font-black uppercase tracking-widest">{title}</h4>
     </div>
     <p className="text-xs text-gray-400 italic leading-relaxed">{text}</p>
  </div>
);

const RocketPart = ({ active, type, label }: { active: boolean, type: 'Capsule' | 'Body' | 'Engine', label: string }) => {
  const styles = { Capsule: "h-12 rounded-t-[50%] w-24 border-b-2", Body: "h-10 w-24", Engine: "h-12 w-24 rounded-b-[20%] border-t-2" };
  return (
    <div className={`relative group transition-all duration-1000 mx-auto ${active ? 'opacity-100 scale-100' : 'opacity-10 scale-90 grayscale blur-[1px]'}`}>
       <div className={`${styles[type]} border-2 border-blue-500/40 bg-blue-600/10 shadow-[inset_0_0_15px_rgba(37,99,235,0.2)] flex items-center justify-center`}><div className="w-3 h-3 rounded-full border border-blue-500/20 bg-black/40"></div></div>
    </div>
  );
};

export default GenesisModule;
