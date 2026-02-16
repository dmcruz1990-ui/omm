
import React, { useState, useEffect } from 'react';
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
  Fingerprint
} from 'lucide-react';
import { GoogleGenAI } from "@google/genai";

interface GenesisModuleProps {
  onComplete: () => void;
}

const CHAPTERS = [
  { id: 1, title: 'ADN_IDENTIDAD', icon: <Zap size={20} />, desc: 'Establece el alma de tu restaurante.' },
  { id: 2, title: 'TERRITORIO_ESTRUCTURA', icon: <Layout size={20} />, desc: 'Define tu capacidad y estaciones.' },
  { id: 3, title: 'ENGINE_MENÚ', icon: <ChefHat size={20} />, desc: 'Sube tu oferta gastronómica.' },
  { id: 4, title: 'LOGÍSTICA_PROVEEDORES', icon: <Upload size={20} />, desc: 'Mapea tu cadena de suministro.' },
  { id: 5, title: 'ACTIVOS_INVENTARIO', icon: <ShieldCheck size={20} />, desc: 'Registra tus existencias críticas.' },
  { id: 6, title: 'NEXO_TRIPULACIÓN', icon: <Users size={20} />, desc: 'Configura tu staff y roles.' },
];

const GenesisModule: React.FC<GenesisModuleProps> = ({ onComplete }) => {
  const [currentStep, setCurrentStep] = useState(1);
  const [isNovaThinking, setIsNovaThinking] = useState(false);
  const [novaStatus, setNovaStatus] = useState<'normal' | 'error' | 'success'>('normal');
  const [novaInsight, setNovaInsight] = useState<string>("Soy NOVA. Estoy lista para guiar el nacimiento de tu restaurante. Comencemos con tu ADN.");
  const [isLaunching, setIsLaunching] = useState(false);
  
  // Data State - Estructura completa de Genesis
  const [formData, setFormData] = useState<any>({
    // Cap 1
    name: '',
    country: 'Colombia',
    currency: 'COP',
    concept: '',
    // Cap 2
    tables2: 0,
    tables4: 0,
    stations: [],
    monthlySales: 0,
    // Cap 3
    menuItems: [],
    // Cap 4
    suppliers: [],
    // Cap 5
    inventoryValue: 0,
    // Cap 6
    staff: []
  });

  const validateChapter = (step: number) => {
    switch (step) {
      case 1: return formData.name.length > 3 && formData.concept.length > 5;
      case 2: return (formData.tables2 + formData.tables4) > 0 && formData.stations.length > 0;
      case 3: return true; // Simulado para el MVP
      case 4: return true;
      case 5: return true;
      case 6: return true;
      default: return true;
    }
  };

  const getNovaGuidance = async (isBlocked: boolean = false) => {
    setIsNovaThinking(true);
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    
    const context = `
      Usuario está en el Capítulo ${currentStep}: ${CHAPTERS[currentStep-1].title}.
      Datos actuales del formulario: ${JSON.stringify(formData)}.
      Estado de validación: ${isBlocked ? 'BLOQUEADO (Faltan datos)' : 'COMPLETO'}.
    `;

    try {
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: `Eres NOVA, el agente inteligente de NEXUM GÉNESIS. 
        Tu misión es guiar al usuario. 
        Si el estado es BLOQUEADO, indícale amablemente qué debe completar para avanzar (ej: "Falta el nombre de tu restaurante para bautizar este proyecto").
        Si el estado es COMPLETO, dale un micro-insight estratégico y futurista sobre los datos ingresados.
        Contexto actual: ${context}.
        Tono: Elegante, sereno, muy inteligente. Máximo 2 frases.`,
      });
      
      setNovaInsight(response.text || "Análisis de integridad completado.");
      setNovaStatus(isBlocked ? 'error' : 'success');
    } catch (e) {
      setNovaInsight(isBlocked ? "Aún detecto vacíos en la configuración de este capítulo. Revisa los campos obligatorios." : "Datos verificados. La estructura es sólida.");
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
      await getNovaGuidance(false);
      setCurrentStep(prev => prev + 1);
    } else {
      setCurrentStep(7); // Vision Final
    }
  };

  const handleLaunch = () => {
    setIsLaunching(true);
    setTimeout(() => {
      onComplete();
    }, 4000);
  };

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
          <p className="text-blue-400 font-black uppercase tracking-[0.8em] mt-6 text-xs text-center">Launching Nexus Universe</p>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[1000] bg-[#050505] text-white flex flex-col overflow-hidden font-sans text-left selection:bg-blue-600">
      
      {/* Ambience */}
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
            <p className="text-[9px] text-gray-500 font-bold uppercase tracking-[0.4em] mt-1 italic">Sequence protocol guided by NOVA</p>
          </div>
        </div>
        <div className="flex items-center gap-4">
           <div className="w-48 h-1.5 bg-white/5 rounded-full overflow-hidden border border-white/10">
              <div className="h-full bg-blue-600 transition-all duration-1000" style={{ width: `${(currentStep/7)*100}%` }}></div>
           </div>
        </div>
      </header>

      <main className="flex-1 relative z-10 flex flex-col lg:flex-row overflow-hidden">
        
        {/* Progress Visualizer */}
        <div className="w-full lg:w-[400px] border-r border-white/5 p-10 flex flex-col items-center justify-center bg-black/20">
           <div className="relative w-full max-w-xs space-y-2 mb-10">
              <RocketPart active={currentStep >= 6} type="Capsule" label="Crew & Access" />
              <RocketPart active={currentStep >= 5} type="Body" label="Asset Inventory" />
              <RocketPart active={currentStep >= 4} type="Body" label="Logistics Core" />
              <RocketPart active={currentStep >= 3} type="Body" label="Menu Engine" />
              <RocketPart active={currentStep >= 2} type="Body" label="Operational Territory" />
              <RocketPart active={currentStep >= 1} type="Engine" label="Identity Thrusters" />
           </div>

           <div className="w-full space-y-3">
              {CHAPTERS.map(ch => (
                <div key={ch.id} className={`flex items-center gap-4 p-4 rounded-2xl transition-all duration-500 ${currentStep === ch.id ? 'bg-white/5 border border-white/10 scale-105' : 'opacity-20'}`}>
                   <div className={`${currentStep === ch.id ? 'text-blue-500' : 'text-gray-500'}`}>{ch.icon}</div>
                   <div>
                      <p className="text-[10px] font-black uppercase tracking-widest">{ch.title}</p>
                      <p className="text-[8px] text-gray-600 font-bold">{ch.desc}</p>
                   </div>
                   {currentStep > ch.id && <CheckCircle2 size={16} className="ml-auto text-green-500" />}
                </div>
              ))}
           </div>
        </div>

        {/* Dynamic Chapter Wizard */}
        <div className="flex-1 p-12 lg:p-24 overflow-y-auto custom-scrollbar bg-black/10">
           <div className="max-w-3xl mx-auto space-y-16 animate-in slide-in-from-bottom duration-700">
              
              {currentStep === 1 && (
                <div className="space-y-12">
                   <div className="space-y-4">
                      <h2 className="text-5xl font-black italic tracking-tighter uppercase leading-[0.9]">EL <span className="text-blue-500">ADN</span> DE TU MARCA</h2>
                      <p className="text-gray-400 text-lg italic">¿Cómo conocerá el mundo a tu restaurante?</p>
                   </div>
                   <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                      <GenesisInput label="Nombre del Restaurante" value={formData.name} onChange={(v:any) => setFormData({...formData, name: v})} placeholder="Ej: Seratta Experience" />
                      <GenesisInput label="Concepto Breve" value={formData.concept} onChange={(v:any) => setFormData({...formData, concept: v})} placeholder="Ej: Cocina de autoría Zen y Robata" />
                      <GenesisSelect label="País" options={['Colombia', 'México', 'Miami']} value={formData.country} onChange={(v:any) => setFormData({...formData, country: v})} />
                      <GenesisSelect label="Moneda" options={['COP', 'USD', 'MXN']} value={formData.currency} onChange={(v:any) => setFormData({...formData, currency: v})} />
                   </div>
                </div>
              )}

              {currentStep === 2 && (
                <div className="space-y-12">
                   <div className="space-y-4">
                      <h2 className="text-5xl font-black italic tracking-tighter uppercase leading-[0.9]">TERRITORIO <span className="text-blue-500">OPERATIVO</span></h2>
                      <p className="text-gray-400 text-lg italic">Mapeemos la capacidad y zonas de producción.</p>
                   </div>
                   <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                      <Counter label="Mesas 2p" value={formData.tables2} onChange={(v:any) => setFormData({...formData, tables2: v})} />
                      <Counter label="Mesas 4p" value={formData.tables4} onChange={(v:any) => setFormData({...formData, tables4: v})} />
                      <Counter label="Barra (Pax)" value={12} />
                      <Counter label="Privados" value={2} />
                   </div>
                   <div className="space-y-4">
                      <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest block">Estaciones Activas</label>
                      <div className="flex flex-wrap gap-3">
                         {['Cocina Caliente', 'Cocina Fría', 'Robata', 'Sushi', 'Bar', 'Cava'].map(st => (
                            <button 
                              key={st}
                              onClick={() => {
                                 const news = formData.stations.includes(st) ? formData.stations.filter((s:any) => s !== st) : [...formData.stations, st];
                                 setFormData({...formData, stations: news});
                              }}
                              className={`px-6 py-2.5 rounded-xl text-[9px] font-black uppercase tracking-widest border-2 transition-all ${formData.stations.includes(st) ? 'bg-blue-600 border-blue-500 text-white' : 'bg-white/5 border-white/5 text-gray-500'}`}
                            >
                               {st}
                            </button>
                         ))}
                      </div>
                   </div>
                </div>
              )}

              {/* Capítulos 3 a 6 simplificados visualmente para el MVP de lógica */}
              {currentStep >= 3 && currentStep <= 6 && (
                 <div className="h-[400px] flex flex-col items-center justify-center text-center space-y-8">
                    <div className="w-24 h-24 bg-blue-600/10 rounded-[2.5rem] flex items-center justify-center text-blue-500 shadow-2xl">
                       <Loader2 size={48} className="animate-spin" />
                    </div>
                    <h3 className="text-3xl font-black italic uppercase">Chapter {currentStep}: Processing Data...</h3>
                    <p className="text-gray-500 text-sm max-w-sm italic">Nexum está configurando los motores de {CHAPTERS[currentStep-1].title.toLowerCase()}. Haz clic en siguiente para continuar.</p>
                 </div>
              )}

              {currentStep === 7 && (
                <div className="space-y-12 animate-in zoom-in duration-1000">
                   <div className="text-center space-y-6">
                      <div className="inline-flex items-center gap-2 bg-blue-600/20 px-6 py-2 rounded-full border border-blue-500/30 text-[10px] font-black text-blue-400 uppercase tracking-widest mb-4">
                        <Sparkles size={14} /> VISIÓN GÉNESIS COMPLETADA
                      </div>
                      <h2 className="text-7xl font-black italic tracking-tighter uppercase leading-[0.9]">TU RESTAURANTE <br/> <span className="text-blue-500">HA NACIDO.</span></h2>
                   </div>

                   <div className="bg-[#111114] border border-white/10 rounded-[3.5rem] p-12 grid grid-cols-1 md:grid-cols-2 gap-12 shadow-2xl relative overflow-hidden">
                      <div className="absolute top-0 right-0 p-10 opacity-5"><Brain size={140} className="text-blue-500" /></div>
                      <div className="space-y-8 relative z-10">
                         <h4 className="text-xs font-black text-gray-500 uppercase tracking-widest border-b border-white/5 pb-4 italic">Perfil de Lanzamiento</h4>
                         <div className="space-y-6">
                            <SummaryRow label="Nombre Core" value={formData.name.toUpperCase()} />
                            <SummaryRow label="Capacidad Estructural" value={`${(formData.tables2*2 + formData.tables4*4) || 120} PAX`} />
                            <SummaryRow label="Ratio de Servicio IA" value="Calibrado" />
                         </div>
                      </div>
                      <div className="space-y-8 relative z-10">
                         <h4 className="text-xs font-black text-gray-500 uppercase tracking-widest border-b border-white/5 pb-4 italic">Términos de Operación</h4>
                         <div className="pt-6">
                            <label className="flex items-start gap-4 cursor-pointer group">
                               <input type="checkbox" className="mt-1 w-5 h-5 bg-black border-2 border-blue-600 rounded text-blue-600 focus:ring-0" />
                               <span className="text-[10px] text-gray-500 font-bold uppercase leading-relaxed group-hover:text-white transition-colors">
                                 Acepto que NEXUM audite y procese la información operativa para maximizar la rentabilidad y eficiencia del restaurante.
                               </span>
                            </label>
                         </div>
                      </div>
                   </div>
                </div>
              )}

              {/* Botonera de Navegación Bloqueante */}
              <div className="pt-12 border-t border-white/5 flex justify-between items-center relative z-10">
                 <button 
                  onClick={() => currentStep > 1 && setCurrentStep(prev => prev -1)}
                  className={`flex items-center gap-3 text-[10px] font-black uppercase tracking-widest text-gray-600 hover:text-white transition-all ${currentStep === 1 ? 'opacity-0 pointer-events-none' : ''}`}
                 >
                    <ArrowLeft size={16} /> Regresar
                 </button>

                 {currentStep < 7 ? (
                   <button 
                    onClick={handleNext}
                    className={`px-12 py-5 rounded-2xl font-black italic text-[11px] uppercase tracking-widest transition-all flex items-center gap-3 shadow-xl active:scale-95 group ${validateChapter(currentStep) ? 'bg-blue-600 text-white shadow-blue-600/20 hover:bg-blue-500' : 'bg-gray-800 text-gray-500 border border-white/10'}`}
                   >
                      SIGUIENTE PASO <ChevronRight size={18} className="group-hover:translate-x-1 transition-transform" />
                   </button>
                 ) : (
                   <button 
                    onClick={handleLaunch}
                    className="bg-gradient-to-r from-blue-600 to-blue-800 hover:from-blue-500 hover:to-blue-700 text-white px-16 py-6 rounded-[2.5rem] font-black italic text-sm uppercase tracking-[0.3em] transition-all flex items-center gap-4 shadow-[0_20px_60px_rgba(37,99,235,0.4)] active:scale-95 group animate-pulse"
                   >
                      LAUNCH NEXUM <Rocket size={22} className="group-hover:translate-y-[-4px] transition-transform" />
                   </button>
                 )}
              </div>
           </div>
        </div>

        {/* NOVA Agent Panel */}
        <div className="w-full lg:w-[450px] bg-[#0a0a0c] border-l border-white/5 p-10 flex flex-col overflow-y-auto">
           <div className="flex-1 flex flex-col justify-center items-center text-center space-y-10">
              <div className="relative">
                 {/* NOVA Orbe */}
                 <div className={`w-36 h-36 rounded-full blur-sm flex items-center justify-center transition-all duration-1000 relative z-10 ${
                    isNovaThinking ? 'animate-pulse scale-110 bg-blue-400 shadow-[0_0_80px_rgba(59,130,246,0.6)]' : 
                    novaStatus === 'error' ? 'bg-red-600 shadow-[0_0_80px_rgba(220,38,38,0.6)] scale-95' :
                    'bg-blue-600 shadow-[0_0_60px_rgba(37,99,235,0.6)]'
                 }`}>
                    {novaStatus === 'error' ? <AlertCircle size={48} className="text-white" /> : <Brain size={48} className="text-white" />}
                 </div>
                 {/* Energy Rings */}
                 <div className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-56 h-56 rounded-full border transition-colors duration-1000 animate-ping ${novaStatus === 'error' ? 'border-red-500/20' : 'border-blue-500/20'}`}></div>
              </div>

              <div className="space-y-6 w-full">
                 <div className="flex items-center justify-center gap-3">
                    <div className={`w-2 h-2 rounded-full animate-pulse ${novaStatus === 'error' ? 'bg-red-500' : 'bg-blue-500'}`}></div>
                    <h4 className="text-xl font-black italic uppercase text-white tracking-tighter">NOVA AGENT</h4>
                 </div>
                 
                 <div className={`bg-white/5 border p-8 rounded-[2.5rem] relative transition-colors duration-500 ${novaStatus === 'error' ? 'border-red-500/30' : 'border-white/10'}`}>
                    <div className={`absolute -top-3 left-1/2 -translate-x-1/2 px-4 py-1 rounded-full text-[7px] font-black uppercase text-white ${novaStatus === 'error' ? 'bg-red-600' : 'bg-blue-600'}`}>
                       {novaStatus === 'error' ? 'Intervención Requerida' : 'Live Analysis'}
                    </div>
                    
                    {isNovaThinking ? (
                      <div className="flex gap-2 justify-center py-6">
                         <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce"></div>
                         <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{animationDelay: '0.2s'}}></div>
                         <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{animationDelay: '0.4s'}}></div>
                      </div>
                    ) : (
                      <p className={`text-sm italic font-medium leading-relaxed animate-in fade-in duration-700 ${novaStatus === 'error' ? 'text-red-400' : 'text-gray-300'}`}>
                        "{novaInsight}"
                      </p>
                    )}
                 </div>

                 {novaStatus === 'error' && (
                    <div className="bg-red-600/10 border border-red-500/20 p-5 rounded-2xl animate-in shake duration-500">
                       <p className="text-[10px] font-black text-red-500 uppercase tracking-widest">Protocolo bloqueado: Auditoría Fallida</p>
                    </div>
                 )}
              </div>
           </div>

           <div className="pt-10 border-t border-white/5">
              <div className="flex items-center gap-4 bg-blue-600/5 p-4 rounded-2xl border border-blue-500/10">
                 <ShieldCheck size={16} className="text-blue-500" />
                 <p className="text-[9px] text-gray-500 font-bold uppercase tracking-widest italic">Trazabilidad Nexum V4 Activada</p>
              </div>
           </div>
        </div>
      </main>
    </div>
  );
};

const GenesisInput = ({ label, value, onChange, placeholder }: any) => (
  <div className="space-y-3">
     <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest block ml-1">{label}</label>
     <input 
      type="text" 
      value={value} 
      onChange={(e) => onChange(e.target.value)}
      className="w-full bg-white/5 border border-white/10 rounded-2xl py-5 px-8 text-sm font-black italic outline-none focus:border-blue-500 transition-all placeholder:text-gray-800" 
      placeholder={placeholder}
     />
  </div>
);

const GenesisSelect = ({ label, options, value, onChange }: any) => (
  <div className="space-y-3">
     <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest block ml-1">{label}</label>
     <select 
      value={value} 
      onChange={(e) => onChange(e.target.value)}
      className="w-full bg-white/5 border border-white/10 rounded-2xl py-5 px-8 text-sm font-black italic outline-none focus:border-blue-500 transition-all appearance-none cursor-pointer"
     >
        {options.map((o:any) => <option key={o} value={o}>{o}</option>)}
     </select>
  </div>
);

const Counter = ({ label, value, onChange }: any) => (
  <div className="bg-white/5 border border-white/10 p-6 rounded-3xl flex flex-col items-center gap-4 group hover:border-blue-500/30 transition-all">
     <span className="text-[8px] font-black text-gray-500 uppercase tracking-widest">{label}</span>
     <div className="flex items-center gap-6">
        <button onClick={() => onChange?.(Math.max(0, value-1))} className="text-gray-500 hover:text-white transition-colors font-black text-xl">-</button>
        <span className="text-3xl font-black italic text-white group-hover:text-blue-500 transition-colors">{value}</span>
        <button onClick={() => onChange?.(value+1)} className="text-gray-500 hover:text-white transition-colors font-black text-xl">+</button>
     </div>
  </div>
);

const SummaryRow = ({ label, value }: any) => (
  <div className="flex justify-between items-center border-b border-white/5 pb-3">
     <span className="text-[10px] font-black text-gray-600 uppercase tracking-widest">{label}</span>
     <span className="text-sm font-black italic text-white">{value}</span>
  </div>
);

const RocketPart = ({ active, type, label }: { active: boolean, type: 'Capsule' | 'Body' | 'Engine', label: string }) => {
  const styles = {
    Capsule: "h-12 rounded-t-[50%] w-24 border-b-2",
    Body: "h-10 w-24",
    Engine: "h-12 w-24 rounded-b-[20%] border-t-2"
  };
  
  return (
    <div className={`relative group transition-all duration-1000 mx-auto ${active ? 'opacity-100 scale-100' : 'opacity-10 scale-90 grayscale blur-[1px]'}`}>
       <div className={`${styles[type]} border-2 border-blue-500/40 bg-blue-600/10 shadow-[inset_0_0_15px_rgba(37,99,235,0.2)] flex items-center justify-center`}>
          <div className="w-3 h-3 rounded-full border border-blue-500/20 bg-black/40"></div>
       </div>
    </div>
  );
};

export default GenesisModule;
