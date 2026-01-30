
import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase.ts';
import { 
  Settings, 
  Zap, 
  ShieldCheck, 
  Target, 
  Cpu, 
  Save, 
  Loader2, 
  CheckCircle2, 
  Flame, 
  Martini, 
  UtensilsCrossed,
  LayoutDashboard,
  BrainCircuit,
  Lock,
  Unlock,
  BellRing,
  Star,
  Sparkles,
  Info
  // Fix: Changed 'lucide-center' to correct package name 'lucide-react'
} from 'lucide-react';
import { OperationalSettings, BusinessDNA, AIAgencyLevel } from '../types.ts';

const SettingsModule: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [aiWelcome, setAiWelcome] = useState<string | null>(null);
  
  const [config, setConfig] = useState<OperationalSettings>({
    business_dna: 'FINE_DINING',
    target_margin: 66,
    target_cogs: 28,
    target_labor: 18,
    ai_agency_level: 'ADVISORY',
    notifications_enabled: true
  });

  useEffect(() => {
    fetchConfig();
  }, []);

  const fetchConfig = async () => {
    setLoading(true);
    try {
      const { data } = await supabase.from('operational_settings').select('*').maybeSingle();
      if (data) setConfig(data);
    } catch (err) {
      console.warn("Error fetching settings");
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const { error } = await supabase
        .from('operational_settings')
        .upsert({ ...config, id: config.id || undefined });
      if (error) throw error;
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      alert("Error al guardar configuración.");
    } finally {
      setSaving(false);
    }
  };

  const updateDNA = (dna: BusinessDNA) => {
    const presets: Record<string, any> = {
      'FINE_DINING': { target_margin: 70, target_cogs: 25, target_labor: 22, welcome: "Calibrando para el máximo estándar de hospitalidad." },
      'BAR_NIGHTLIFE': { target_margin: 80, target_cogs: 18, target_labor: 12, welcome: "Foco en rotación de licores y control de mermas de barra." },
      'CASUAL_DINING': { target_margin: 60, target_cogs: 32, target_labor: 15, welcome: "Operación de alto volumen activada." },
      'CASUAL_PREMIUM': { target_margin: 68, target_cogs: 32, target_labor: 28, welcome: "¡BIENVENIDO AL MODO CASUAL PREMIUM! Se han ajustado los semáforos para Service-Forward: Labor 28%, COGS 32% y Entretenimiento limitado al 3%. NEXUM ahora prioriza la experiencia del cliente sobre el volumen masivo." },
      'QSR_FAST_CASUAL': { target_margin: 70, target_cogs: 30, target_labor: 20, welcome: "Eficiencia extrema y velocidad de servicio configurada." }
    };
    const preset = presets[dna] || {};
    setConfig({ ...config, business_dna: dna, ...preset });
    setAiWelcome(preset.welcome);
    // Auto-limpiar el banner de bienvenida después de 10 segundos
    setTimeout(() => setAiWelcome(null), 10000);
  };

  if (loading) return (
    <div className="flex flex-col items-center justify-center h-[60vh] opacity-40">
      <Loader2 className="animate-spin text-blue-500 mb-4" size={32} />
      <p className="text-[10px] font-black uppercase tracking-widest italic">Accediendo al Núcleo...</p>
    </div>
  );

  return (
    <div className="max-w-6xl mx-auto animate-in fade-in duration-700 text-left pb-20">
      
      {/* Banner de Bienvenida IA Dinámico */}
      {aiWelcome && (
        <div className="mb-10 animate-in slide-in-from-top-4 duration-500">
           <div className="bg-blue-600 border-2 border-white/20 p-8 rounded-[3rem] shadow-[0_20px_50px_rgba(37,99,235,0.3)] flex items-center gap-8 relative overflow-hidden group">
              <div className="absolute top-0 right-0 p-10 opacity-10 group-hover:scale-110 transition-transform">
                 <Sparkles size={100} fill="white" />
              </div>
              <div className="w-16 h-16 bg-white/20 rounded-2xl flex items-center justify-center shrink-0 border border-white/30">
                 <Info className="text-white" size={32} />
              </div>
              <div className="relative z-10">
                 <span className="text-[10px] font-black text-white/70 uppercase tracking-widest block mb-2 italic">NEXUM_AI_COMMUNICATION_LINK</span>
                 <p className="text-lg font-black italic text-white leading-tight uppercase tracking-tight">{aiWelcome}</p>
              </div>
              <button onClick={() => setAiWelcome(null)} className="ml-auto text-white/50 hover:text-white transition-colors">
                 <CheckCircle2 size={24} />
              </button>
           </div>
        </div>
      )}

      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 border-b border-white/5 pb-10 mb-12">
        <div>
          <h2 className="text-4xl font-black italic tracking-tighter uppercase leading-none">Cerebro de Operaciones</h2>
          <p className="text-gray-500 text-[10px] font-black uppercase tracking-[0.4em] mt-3 flex items-center gap-2">
            <Cpu size={14} className="text-blue-500" /> NEXUM_GLOBAL_COORDINATOR_V4
          </p>
        </div>
        <button 
          onClick={handleSave}
          disabled={saving}
          className="bg-blue-600 hover:bg-blue-500 text-white px-10 py-4 rounded-2xl font-black italic text-xs uppercase tracking-widest transition-all shadow-xl shadow-blue-600/20 flex items-center gap-3 active:scale-95"
        >
          {saving ? <Loader2 className="animate-spin" size={18} /> : success ? <CheckCircle2 size={18} /> : <Save size={18} />}
          {success ? 'SINCRONIZADO' : 'APLICAR PARÁMETROS'}
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">
        
        <div className="lg:col-span-12">
           <section className="bg-[#111114] border border-white/5 rounded-[3.5rem] p-12 space-y-10 shadow-2xl relative overflow-hidden">
              <div className="absolute top-0 right-0 p-12 opacity-5">
                 <BrainCircuit size={150} className="text-blue-500" />
              </div>
              
              <div className="relative z-10">
                <div className="flex items-center justify-between mb-10">
                   <h3 className="text-[11px] font-black text-gray-500 uppercase tracking-widest flex items-center gap-3">
                     <LayoutDashboard size={18} className="text-blue-500" /> DNA ESTRATÉGICO DEL NEGOCIO
                   </h3>
                   <span className="text-[9px] font-black text-blue-500/50 uppercase tracking-[0.4em]">Selección de Preset Industrial</span>
                </div>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-6">
                   <DNACard 
                    active={config.business_dna === 'FINE_DINING'} 
                    onClick={() => updateDNA('FINE_DINING')}
                    icon={<UtensilsCrossed size={20} />}
                    label="Fine Dining"
                    desc="Márgenes 70%+, servicio VIP."
                   />
                   
                   {/* CASUAL PREMIUM RESALTADO */}
                   <DNACard 
                    active={config.business_dna === 'CASUAL_PREMIUM'} 
                    onClick={() => updateDNA('CASUAL_PREMIUM')}
                    icon={<Star size={24} className={config.business_dna === 'CASUAL_PREMIUM' ? 'text-white' : 'text-yellow-500'} />}
                    label="Casual Premium"
                    desc="Service-Forward, Mezcla de Lujo y Agilidad."
                    isHighlighted
                   />

                   <DNACard 
                    active={config.business_dna === 'BAR_NIGHTLIFE'} 
                    onClick={() => updateDNA('BAR_NIGHTLIFE')}
                    icon={<Martini size={20} />}
                    label="Cocktail Bar"
                    desc="Enfoque en bebida y volumen."
                   />
                   <DNACard 
                    active={config.business_dna === 'CASUAL_DINING'} 
                    onClick={() => updateDNA('CASUAL_DINING')}
                    icon={<Flame size={20} />}
                    label="Casual Dining"
                    desc="Masivo y eficiente."
                   />
                   <DNACard 
                    active={config.business_dna === 'QSR_FAST_CASUAL'} 
                    onClick={() => updateDNA('QSR_FAST_CASUAL')}
                    icon={<Zap size={20} />}
                    label="QSR / Fast"
                    desc="Velocidad y bajo costo."
                   />
                </div>
              </div>

              <div className="pt-12 border-t border-white/5 grid grid-cols-1 md:grid-cols-3 gap-12 relative z-10">
                 <ConfigSlider 
                    label="Objetivo de Margen Bruto" 
                    value={config.target_margin} 
                    suffix="%" min={40} max={90}
                    onChange={(v) => setConfig({...config, target_margin: v})}
                    color="text-green-500"
                 />
                 <ConfigSlider 
                    label="Límite de COGS" 
                    value={config.target_cogs} 
                    suffix="%" min={10} max={50}
                    onChange={(v) => setConfig({...config, target_cogs: v})}
                    color="text-orange-500"
                 />
                 <ConfigSlider 
                    label="Límite de Labor Cost" 
                    value={config.target_labor} 
                    suffix="%" min={10} max={40}
                    onChange={(v) => setConfig({...config, target_labor: v})}
                    color="text-blue-500"
                 />
              </div>
           </section>
        </div>

        <div className="lg:col-span-6">
           <section className="bg-gradient-to-br from-blue-600/10 to-transparent border border-blue-500/20 rounded-[3rem] p-10 space-y-8 shadow-2xl h-full">
              <h3 className="text-xs font-black text-white uppercase tracking-widest flex items-center gap-3">
                <Zap size={16} className="text-blue-500" /> Gobernanza de IA
              </h3>
              <div className="space-y-4">
                 <AgencyLevel active={config.ai_agency_level === 'ADVISORY'} onClick={() => setConfig({...config, ai_agency_level: 'ADVISORY'})} label="Modo Consultivo" desc="IA solo sugiere estrategias." />
                 <AgencyLevel active={config.ai_agency_level === 'CO_PILOT'} onClick={() => setConfig({...config, ai_agency_level: 'CO_PILOT'})} label="Modo Co-Piloto" desc="Un clic para autorizar IA." />
                 <AgencyLevel active={config.ai_agency_level === 'AUTONOMOUS'} onClick={() => setConfig({...config, ai_agency_level: 'AUTONOMOUS'})} label="Modo Autonómico" desc="IA decide bajo umbrales." danger />
              </div>
           </section>
        </div>

        <div className="lg:col-span-6">
           <div className="bg-[#111114] p-10 rounded-[3rem] border border-white/5 h-full flex flex-col justify-center">
              <div className="flex items-center justify-between mb-8">
                 <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-white/5 rounded-2xl flex items-center justify-center text-blue-500">
                       <BellRing size={24} />
                    </div>
                    <div>
                       <span className="text-xs font-black uppercase italic text-white">Alertas Críticas</span>
                       <p className="text-[10px] text-gray-500 uppercase font-bold">Notificaciones Live WhatsApp</p>
                    </div>
                 </div>
                 <button onClick={() => setConfig({...config, notifications_enabled: !config.notifications_enabled})} className={`w-16 h-8 rounded-full relative transition-all ${config.notifications_enabled ? 'bg-blue-600' : 'bg-gray-800'}`}>
                    <div className={`absolute top-1 w-6 h-6 rounded-full bg-white transition-all ${config.notifications_enabled ? 'left-9' : 'left-1'}`}></div>
                 </button>
              </div>
              <p className="text-[10px] text-gray-500 italic leading-relaxed text-center">
                Al activar las notificaciones, el sistema enviará reportes de cierre y alertas de anomalías financieras directamente a la gerencia registrada.
              </p>
           </div>
        </div>

      </div>
    </div>
  );
};

const DNACard = ({ active, onClick, icon, label, desc, isHighlighted }: any) => (
  <button 
    onClick={onClick}
    className={`p-6 rounded-[2.5rem] border-2 transition-all text-left flex flex-col gap-4 relative group ${
      active 
        ? (isHighlighted ? 'bg-white border-white text-black scale-105 shadow-[0_0_50px_rgba(255,255,255,0.2)]' : 'bg-blue-600 border-blue-400 text-white scale-105 shadow-xl shadow-blue-600/20')
        : 'bg-black/40 border-white/5 text-gray-500 hover:border-white/10'
    }`}
  >
    {isHighlighted && !active && (
      <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-yellow-500 text-black text-[7px] font-black px-3 py-1 rounded-full uppercase tracking-widest shadow-lg animate-bounce">
        RECOMENDADO
      </div>
    )}
    <div className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-transform group-hover:scale-110 ${active ? (isHighlighted ? 'bg-black/5' : 'bg-white/20') : 'bg-white/5'}`}>
       {icon}
    </div>
    <div>
       <span className="text-xs font-black uppercase italic leading-none block">{label}</span>
       <p className={`text-[8px] font-bold uppercase mt-2 leading-tight opacity-60`}>{desc}</p>
    </div>
  </button>
);

const AgencyLevel = ({ active, onClick, label, desc, danger }: any) => (
  <button onClick={onClick} className={`w-full p-6 rounded-2xl border-2 transition-all text-left flex flex-col ${active ? (danger ? 'bg-red-600 border-red-400 text-white' : 'bg-white border-white text-black shadow-xl') : 'bg-black/40 border-white/5 text-gray-500 hover:bg-white/5'}`}>
    <span className="text-[10px] font-black uppercase tracking-widest">{label}</span>
    <span className="text-[8px] font-bold uppercase opacity-60 italic">{desc}</span>
  </button>
);

const ConfigSlider = ({ label, value, suffix, min, max, onChange, color }: any) => (
  <div className="space-y-4">
     <div className="flex justify-between items-center">
        <span className="text-[10px] font-black text-gray-600 uppercase tracking-widest italic">{label}</span>
        <span className={`text-xl font-black italic ${color}`}>{value}{suffix}</span>
     </div>
     <input type="range" min={min} max={max} value={value} onChange={(e) => onChange(parseInt(e.target.value))} className="w-full h-1 bg-gray-800 rounded-lg appearance-none cursor-pointer accent-blue-500" />
  </div>
);

export default SettingsModule;
