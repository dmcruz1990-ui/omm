
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
  BellRing
} from 'lucide-react';
import { OperationalSettings, BusinessDNA, AIAgencyLevel } from '../types.ts';

const SettingsModule: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  
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
      const { data, error } = await supabase
        .from('operational_settings')
        .select('*')
        .maybeSingle();

      if (data) {
        setConfig(data);
      }
    } catch (err) {
      console.warn("Error fetching operational settings, using local defaults.");
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
      console.error("Save error:", err);
      alert("Error al guardar la configuración del Cerebro NEXUM.");
    } finally {
      setSaving(false);
    }
  };

  const updateDNA = (dna: BusinessDNA) => {
    // Ajustes inteligentes por defecto basados en el modelo de negocio
    const presets = {
      'FINE_DINING': { target_margin: 70, target_cogs: 25, target_labor: 22 },
      'BAR': { target_margin: 80, target_cogs: 18, target_labor: 12 },
      'CASUAL': { target_margin: 60, target_cogs: 32, target_labor: 15 }
    };
    setConfig({ ...config, business_dna: dna, ...presets[dna] });
  };

  if (loading) return (
    <div className="flex flex-col items-center justify-center h-[60vh] opacity-40">
      <Loader2 className="animate-spin text-blue-500 mb-4" size={32} />
      <p className="text-[10px] font-black uppercase tracking-widest italic">Accediendo al Núcleo de Configuración...</p>
    </div>
  );

  return (
    <div className="max-w-5xl mx-auto animate-in fade-in duration-700 text-left">
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
          className="bg-blue-600 hover:bg-blue-500 text-white px-10 py-4 rounded-2xl font-black italic text-xs uppercase tracking-widest transition-all shadow-xl shadow-blue-600/20 flex items-center gap-3 active:scale-95 disabled:opacity-50"
        >
          {saving ? <Loader2 className="animate-spin" size={18} /> : success ? <CheckCircle2 size={18} /> : <Save size={18} />}
          {success ? 'SINCRONIZADO' : 'APLICAR PARÁMETROS'}
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">
        
        {/* DNA del Negocio */}
        <div className="lg:col-span-7 space-y-12">
           <section className="bg-[#111114] border border-white/5 rounded-[3rem] p-10 space-y-8 shadow-2xl relative overflow-hidden">
              <div className="absolute top-0 right-0 p-10 opacity-5">
                 <BrainCircuit size={120} className="text-blue-500" />
              </div>
              
              <div className="relative z-10">
                <h3 className="text-xs font-black text-gray-400 uppercase tracking-widest flex items-center gap-3 mb-8">
                  <LayoutDashboard size={16} className="text-blue-500" /> ADN del Negocio
                </h3>
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                   <DNACard 
                    active={config.business_dna === 'FINE_DINING'} 
                    onClick={() => updateDNA('FINE_DINING')}
                    icon={<UtensilsCrossed size={20} />}
                    label="Fine Dining"
                    desc="Alta cocina, márgenes altos, servicio premium."
                   />
                   <DNACard 
                    active={config.business_dna === 'BAR'} 
                    onClick={() => updateDNA('BAR')}
                    icon={<Martini size={20} />}
                    label="Cocktail Bar"
                    desc="Volumen, mixología, foco en bebidas."
                   />
                   <DNACard 
                    active={config.business_dna === 'CASUAL'} 
                    onClick={() => updateDNA('CASUAL')}
                    icon={<Flame size={20} />}
                    label="Casual Dining"
                    desc="Rapidez, volumen alto, márgenes ajustados."
                   />
                </div>
              </div>

              <div className="pt-10 border-t border-white/5 space-y-10 relative z-10">
                 <h3 className="text-xs font-black text-gray-400 uppercase tracking-widest flex items-center gap-3">
                   <Target size={16} className="text-blue-500" /> Umbrales de Éxito
                 </h3>

                 <div className="space-y-10">
                    <ConfigSlider 
                      label="Objetivo de Margen Bruto" 
                      value={config.target_margin} 
                      suffix="%"
                      min={40} max={90}
                      onChange={(v) => setConfig({...config, target_margin: v})}
                      color="text-green-500"
                    />
                    <ConfigSlider 
                      label="Límite de COGS (Insumos)" 
                      value={config.target_cogs} 
                      suffix="%"
                      min={10} max={50}
                      onChange={(v) => setConfig({...config, target_cogs: v})}
                      color="text-orange-500"
                    />
                    <ConfigSlider 
                      label="Límite de Mano de Obra" 
                      value={config.target_labor} 
                      suffix="%"
                      min={10} max={40}
                      onChange={(v) => setConfig({...config, target_labor: v})}
                      color="text-blue-500"
                    />
                 </div>
              </div>
           </section>
        </div>

        {/* Gobernanza IA */}
        <div className="lg:col-span-5 space-y-8">
           <section className="bg-gradient-to-br from-blue-600/10 to-transparent border border-blue-500/20 rounded-[3rem] p-10 space-y-8 shadow-2xl">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-black text-white uppercase tracking-widest flex items-center gap-3">
                  <Zap size={16} className="text-blue-500" /> Gobernanza de IA
                </h3>
                <div className={`p-2 rounded-lg ${config.ai_agency_level === 'AUTONOMOUS' ? 'bg-red-500/20 text-red-500' : 'bg-green-500/20 text-green-500'}`}>
                   {config.ai_agency_level === 'AUTONOMOUS' ? <Lock size={14} /> : <Unlock size={14} />}
                </div>
              </div>

              <div className="space-y-4">
                 <AgencyLevel 
                    active={config.ai_agency_level === 'ADVISORY'} 
                    onClick={() => setConfig({...config, ai_agency_level: 'ADVISORY'})}
                    label="Modo Consultivo"
                    desc="NEXUM solo sugiere. El humano aprueba todo."
                 />
                 <AgencyLevel 
                    active={config.ai_agency_level === 'CO_PILOT'} 
                    onClick={() => setConfig({...config, ai_agency_level: 'CO_PILOT'})}
                    label="Modo Co-Piloto"
                    desc="IA redacta planes y solicita 'Un Clic' para ejecutar."
                 />
                 <AgencyLevel 
                    active={config.ai_agency_level === 'AUTONOMOUS'} 
                    onClick={() => setConfig({...config, ai_agency_level: 'AUTONOMOUS'})}
                    label="Modo Autonómico"
                    desc="IA ejecuta marketing y compras bajo los umbrales definidos."
                    danger
                 />
              </div>

              <div className="pt-8 border-t border-white/10 flex items-center justify-between">
                 <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-white/5 rounded-xl flex items-center justify-center text-blue-500">
                       <BellRing size={20} />
                    </div>
                    <span className="text-[10px] font-black uppercase tracking-widest text-gray-300">Alertas Críticas WhatsApp</span>
                 </div>
                 <button 
                  onClick={() => setConfig({...config, notifications_enabled: !config.notifications_enabled})}
                  className={`w-14 h-7 rounded-full relative transition-all ${config.notifications_enabled ? 'bg-blue-600' : 'bg-gray-800'}`}
                 >
                    <div className={`absolute top-1 w-5 h-5 rounded-full bg-white transition-all ${config.notifications_enabled ? 'left-8' : 'left-1'}`}></div>
                 </button>
              </div>
           </section>

           <div className="bg-[#111114] p-8 rounded-[2.5rem] border border-white/5 flex items-start gap-4">
              <ShieldCheck className="text-green-500 shrink-0 mt-1" size={18} />
              <div>
                 <h5 className="text-xs font-black uppercase italic text-white mb-1">Gobernanza Ética</h5>
                 <p className="text-[10px] text-gray-500 italic leading-relaxed">
                   Todos los cambios de parámetros quedan registrados en el log de auditoría. La IA no puede sobrepasar los límites de costo definidos por el Administrador.
                 </p>
              </div>
           </div>
        </div>

      </div>
    </div>
  );
};

const DNACard = ({ active, onClick, icon, label, desc }: any) => (
  <button 
    onClick={onClick}
    className={`p-6 rounded-[2rem] border-2 transition-all text-left flex flex-col gap-4 ${
      active 
        ? 'bg-blue-600 border-blue-400 text-white shadow-xl shadow-blue-600/20 scale-105' 
        : 'bg-black border-white/5 text-gray-500 hover:border-white/10'
    }`}
  >
    <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${active ? 'bg-white/20' : 'bg-white/5'}`}>
       {icon}
    </div>
    <div>
       <span className="text-xs font-black uppercase italic leading-none">{label}</span>
       <p className={`text-[8px] font-bold uppercase mt-2 leading-relaxed opacity-60`}>{desc}</p>
    </div>
  </button>
);

const AgencyLevel = ({ active, onClick, label, desc, danger }: any) => (
  <button 
    onClick={onClick}
    className={`w-full p-5 rounded-2xl border-2 transition-all text-left flex flex-col gap-1 ${
      active 
        ? (danger ? 'bg-red-600 border-red-400 text-white' : 'bg-white border-white text-black shadow-xl scale-[1.02]')
        : 'bg-black/40 border-white/5 text-gray-500 hover:bg-white/5'
    }`}
  >
    <span className="text-[10px] font-black uppercase tracking-widest">{label}</span>
    <span className="text-[8px] font-bold uppercase opacity-60 italic">{desc}</span>
  </button>
);

const ConfigSlider = ({ label, value, suffix, min, max, onChange, color }: any) => (
  <div className="space-y-4">
     <div className="flex justify-between items-center">
        <span className="text-[10px] font-black text-gray-500 uppercase tracking-widest">{label}</span>
        <span className={`text-lg font-black italic ${color}`}>{value}{suffix}</span>
     </div>
     <input 
        type="range" min={min} max={max} value={value} 
        onChange={(e) => onChange(parseInt(e.target.value))}
        className="w-full h-1 bg-gray-800 rounded-lg appearance-none cursor-pointer accent-blue-500"
     />
  </div>
);

export default SettingsModule;
