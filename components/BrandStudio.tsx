
import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase.ts';
import { 
  Palette, 
  Image as ImageIcon, 
  Save, 
  Monitor, 
  Smartphone, 
  RefreshCcw, 
  Loader2, 
  CheckCircle2, 
  Type, 
  Layout,
  Zap,
  Globe,
  ChevronRight
} from 'lucide-react';
import { Brand } from '../types.ts';

const BrandStudio: React.FC = () => {
  const [brand, setBrand] = useState<Brand | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [previewDevice, setPreviewDevice] = useState<'desktop' | 'mobile'>('desktop');

  // Valores locales para edición fluida
  const [localBrand, setLocalBrand] = useState({
    name: '',
    logo_url: '',
    primary_color: '#0a0a0c',
    secondary_color: '#2563eb'
  });

  useEffect(() => {
    fetchBrand();
  }, []);

  const fetchBrand = async () => {
    setLoading(true);
    try {
      // Por defecto tomamos OMM (ID 1) o el primero disponible
      const { data, error } = await supabase
        .from('brands')
        .select('*')
        .limit(1)
        .maybeSingle();

      if (data) {
        setBrand(data);
        setLocalBrand({
          name: data.name,
          logo_url: data.logo_url || '',
          primary_color: data.primary_color || '#0a0a0c',
          secondary_color: data.secondary_color || '#2563eb'
        });
      } else {
        // Fallback demo
        setLocalBrand({
          name: 'OMM Bogotá',
          logo_url: 'https://placehold.co/200x200/2563eb/white?text=OMM',
          primary_color: '#0a0a0c',
          secondary_color: '#2563eb'
        });
      }
    } catch (err) {
      console.error("Error fetching brand:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!brand?.id) {
       // Si no hay ID (demo mode), simulamos guardado
       setSaving(true);
       setTimeout(() => {
         setSaving(false);
         setSuccess(true);
         setTimeout(() => setSuccess(false), 3000);
       }, 1500);
       return;
    }

    setSaving(true);
    try {
      const { error } = await supabase
        .from('brands')
        .update({
          name: localBrand.name,
          logo_url: localBrand.logo_url,
          primary_color: localBrand.primary_color,
          secondary_color: localBrand.secondary_color,
          settings: { last_updated: new Date().toISOString() }
        })
        .eq('id', brand.id);

      if (error) throw error;
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      console.error("Error updating brand:", err);
      alert("Error al guardar la configuración.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) return (
    <div className="flex flex-col items-center justify-center py-40 opacity-40">
      <Loader2 className="animate-spin text-blue-500 mb-4" size={32} />
      <p className="text-[10px] font-black uppercase tracking-widest italic">Cargando Motor de Diseño...</p>
    </div>
  );

  return (
    <div className="max-w-7xl mx-auto animate-in fade-in duration-700 pb-20 text-left">
      
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 border-b border-white/5 pb-10 mb-10">
        <div>
          <h2 className="text-4xl font-black italic tracking-tighter uppercase leading-none">Brand Studio</h2>
          <p className="text-gray-500 text-[10px] font-black uppercase tracking-[0.4em] mt-3 flex items-center gap-2">
            <Palette size={14} className="text-blue-500" /> Identity Management System
          </p>
        </div>
        
        <div className="flex items-center gap-4">
           <button 
             onClick={handleSave}
             disabled={saving}
             className="bg-blue-600 hover:bg-blue-500 text-white px-10 py-4 rounded-2xl font-black italic text-xs uppercase tracking-widest transition-all shadow-xl shadow-blue-600/20 flex items-center gap-3 active:scale-95 disabled:opacity-50"
           >
             {saving ? <Loader2 className="animate-spin" size={18} /> : success ? <CheckCircle2 size={18} /> : <Save size={18} />}
             {success ? 'GUARDADO' : 'PUBLICAR CAMBIOS'}
           </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">
        
        {/* Editor de Marca */}
        <div className="lg:col-span-4 space-y-8">
           <section className="bg-[#111114] border border-white/5 rounded-[3rem] p-8 space-y-8 shadow-2xl">
              <h3 className="text-xs font-black text-gray-500 uppercase tracking-widest flex items-center gap-2 border-b border-white/5 pb-4">
                <Layout size={14} /> Configuración Visual
              </h3>

              {/* Nombre de Marca */}
              <div className="space-y-3">
                 <label className="text-[10px] font-black text-gray-600 uppercase tracking-widest ml-1 flex items-center gap-2">
                   <Type size={12} /> Nombre Público
                 </label>
                 <input 
                   type="text" 
                   value={localBrand.name}
                   onChange={(e) => setLocalBrand({...localBrand, name: e.target.value})}
                   className="w-full bg-black border border-white/10 rounded-2xl py-4 px-6 text-sm font-bold italic outline-none focus:border-blue-500 transition-all"
                   placeholder="Ej: OMM Bogotá"
                 />
              </div>

              {/* Logo URL */}
              <div className="space-y-3">
                 <label className="text-[10px] font-black text-gray-600 uppercase tracking-widest ml-1 flex items-center gap-2">
                   <ImageIcon size={12} /> URL del Logo
                 </label>
                 <div className="flex gap-3">
                    <input 
                      type="text" 
                      value={localBrand.logo_url}
                      onChange={(e) => setLocalBrand({...localBrand, logo_url: e.target.value})}
                      className="flex-1 bg-black border border-white/10 rounded-2xl py-4 px-6 text-[11px] font-medium outline-none focus:border-blue-500 transition-all"
                      placeholder="https://tu-sitio.com/logo.png"
                    />
                 </div>
                 <p className="text-[8px] text-gray-700 font-bold uppercase tracking-widest">Dimensiones sugeridas: 512x512px (PNG Transparente)</p>
              </div>

              {/* Paleta de Colores */}
              <div className="grid grid-cols-2 gap-6">
                 <div className="space-y-3">
                    <label className="text-[10px] font-black text-gray-600 uppercase tracking-widest ml-1">Fondo Principal</label>
                    <div className="flex items-center gap-3 bg-black border border-white/10 rounded-2xl p-2 pr-4">
                       <input 
                         type="color" 
                         value={localBrand.primary_color}
                         onChange={(e) => setLocalBrand({...localBrand, primary_color: e.target.value})}
                         className="w-10 h-10 rounded-xl cursor-pointer border-none bg-transparent"
                       />
                       <span className="text-[10px] font-mono text-gray-400 uppercase">{localBrand.primary_color}</span>
                    </div>
                 </div>
                 <div className="space-y-3">
                    <label className="text-[10px] font-black text-gray-600 uppercase tracking-widest ml-1">Color de Acento</label>
                    <div className="flex items-center gap-3 bg-black border border-white/10 rounded-2xl p-2 pr-4">
                       <input 
                         type="color" 
                         value={localBrand.secondary_color}
                         onChange={(e) => setLocalBrand({...localBrand, secondary_color: e.target.value})}
                         className="w-10 h-10 rounded-xl cursor-pointer border-none bg-transparent"
                       />
                       <span className="text-[10px] font-mono text-gray-400 uppercase">{localBrand.secondary_color}</span>
                    </div>
                 </div>
              </div>

              <div className="pt-6 border-t border-white/5">
                 <button 
                   onClick={() => fetchBrand()}
                   className="w-full bg-white/5 hover:bg-white/10 text-gray-500 py-3 rounded-xl text-[9px] font-black uppercase tracking-widest flex items-center justify-center gap-2 transition-all"
                 >
                    <RefreshCcw size={12} /> RESTAURAR ORIGINAL
                 </button>
              </div>
           </section>
        </div>

        {/* Live Preview */}
        <div className="lg:col-span-8 space-y-6">
           <div className="flex items-center justify-between">
              <h3 className="text-xs font-black text-gray-500 uppercase tracking-widest flex items-center gap-2">
                 <Monitor size={14} className="text-blue-500" /> Previsualización en Vivo
              </h3>
              <div className="flex bg-[#111114] p-1 rounded-xl border border-white/5">
                 <button 
                   onClick={() => setPreviewDevice('desktop')}
                   className={`p-2 rounded-lg transition-all ${previewDevice === 'desktop' ? 'bg-blue-600 text-white shadow-lg' : 'text-gray-600 hover:text-gray-300'}`}
                 >
                    <Monitor size={16} />
                 </button>
                 <button 
                   onClick={() => setPreviewDevice('mobile')}
                   className={`p-2 rounded-lg transition-all ${previewDevice === 'mobile' ? 'bg-blue-600 text-white shadow-lg' : 'text-gray-600 hover:text-gray-300'}`}
                 >
                    <Smartphone size={16} />
                 </button>
              </div>
           </div>

           <div className={`mx-auto bg-black rounded-[4rem] border-8 border-[#1a1a1e] overflow-hidden shadow-[0_40px_100px_rgba(0,0,0,0.8)] transition-all duration-700 ${previewDevice === 'mobile' ? 'max-w-[380px] h-[650px]' : 'w-full aspect-video'}`}>
              <div 
                className="w-full h-full overflow-y-auto custom-scrollbar relative flex flex-col"
                style={{ backgroundColor: localBrand.primary_color }}
              >
                 {/* Header Mockup */}
                 <header className="h-16 px-6 flex items-center justify-between border-b border-white/5 shrink-0 backdrop-blur-md bg-black/20">
                    <div className="flex items-center gap-2">
                       <img src={localBrand.logo_url} alt="logo" className="h-6 w-auto opacity-90" />
                       <span className="text-xs font-black italic tracking-tighter text-white">{localBrand.name}</span>
                    </div>
                    <div className="flex gap-3">
                       <div className="w-2 h-2 rounded-full bg-white/10"></div>
                       <div className="w-2 h-2 rounded-full bg-white/10"></div>
                    </div>
                 </header>

                 {/* Hero Mockup */}
                 <div className="p-8 text-center space-y-6 pt-16">
                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/5 border border-white/10">
                       <Zap size={10} style={{ color: localBrand.secondary_color }} />
                       <span className="text-[8px] font-black uppercase text-gray-400">BIENVENIDO</span>
                    </div>
                    <h4 className="text-4xl font-black italic tracking-tighter uppercase leading-tight text-white">
                      Vive la experiencia <br/> 
                      <span style={{ color: localBrand.secondary_color }}>{localBrand.name}</span>
                    </h4>
                    <p className="text-[10px] text-gray-500 font-medium italic max-w-[240px] mx-auto opacity-70">
                      Gastronomía de ultra-lujo y sensaciones rituales.
                    </p>
                    
                    <button 
                      className="px-8 py-3 rounded-full text-[9px] font-black uppercase tracking-widest text-white shadow-xl transition-transform active:scale-95 mx-auto"
                      style={{ backgroundColor: localBrand.secondary_color, boxShadow: `0 10px 30px ${localBrand.secondary_color}40` }}
                    >
                      DISEÑAR MI NOCHE
                    </button>
                 </div>

                 {/* Event Card Mockup */}
                 <div className="px-8 mt-10">
                    <div className="bg-white/5 border border-white/10 rounded-[2.5rem] overflow-hidden mb-12">
                       <div className="aspect-video bg-gray-900 flex items-center justify-center relative">
                          <img src="https://images.unsplash.com/photo-1514525253361-bee8718a300a?q=80&w=400" className="w-full h-full object-cover opacity-40" />
                          <div className="absolute top-4 right-4 bg-black/60 px-3 py-1 rounded-full text-[7px] font-black uppercase">LIVE DJ</div>
                       </div>
                       <div className="p-6 space-y-3">
                          <h5 className="text-sm font-black italic uppercase text-white">Kaiseki Beats</h5>
                          <p className="text-[9px] text-gray-500 italic">Cada viernes en la Terraza OMM.</p>
                          <div className="h-[1px] w-full bg-white/5 my-2"></div>
                          <button className="text-[8px] font-black uppercase tracking-widest" style={{ color: localBrand.secondary_color }}>
                             Ver Detalles <ChevronRight size={10} className="inline ml-1" />
                          </button>
                       </div>
                    </div>
                 </div>

                 {/* Footer Mockup */}
                 <footer className="mt-auto p-10 text-center border-t border-white/5 bg-black/20">
                    <div className="w-8 h-8 rounded-full mx-auto mb-4" style={{ backgroundColor: localBrand.secondary_color }}></div>
                    <p className="text-[7px] text-gray-600 font-bold uppercase tracking-widest">© 2025 {localBrand.name} | Powered by Nexum</p>
                 </footer>
              </div>
           </div>

           <div className="bg-blue-600/5 border border-blue-500/20 p-6 rounded-3xl flex items-start gap-4">
              <Globe className="text-blue-500 shrink-0 mt-1" size={18} />
              <div>
                 <h5 className="text-xs font-black uppercase italic text-blue-400 mb-1">Impacto Global</h5>
                 <p className="text-[10px] text-gray-500 italic leading-relaxed">
                   Estos cambios se verán reflejados inmediatamente en la página pública <strong>"OH YEAH"</strong> y en todos los portales de reserva digitales asociados a la marca.
                 </p>
              </div>
           </div>
        </div>

      </div>
    </div>
  );
};

export default BrandStudio;
