
import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { 
  Zap, 
  Sparkles, 
  Calendar, 
  ChevronRight, 
  Utensils, 
  Music, 
  Star, 
  Loader2, 
  MessageCircle,
  Wine,
  Gift,
  MapPin,
  ArrowLeft,
  Ticket,
  ChevronDown
} from 'lucide-react';
import { GoogleGenAI } from "@google/genai";
import { MenuItem, OmmEvent, Brand } from '../types';

const OhYeahPage: React.FC = () => {
  const [brand, setBrand] = useState<Brand | null>(null);
  const [menu, setMenu] = useState<MenuItem[]>([]);
  const [events, setEvents] = useState<OmmEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [celebration, setCelebration] = useState('');
  const [isDesigning, setIsDesigning] = useState(false);
  const [aiPlan, setAiPlan] = useState<{
    title: string;
    items: string[];
    gift: string;
    description: string;
  } | null>(null);

  // Parsear el slug de la marca desde el hash (ej: #/oh-yeah?brand=omm)
  const getBrandSlug = () => {
    const hash = window.location.hash;
    const queryString = hash.includes('?') ? hash.split('?')[1] : '';
    const params = new URLSearchParams(queryString);
    return params.get('brand') || 'omm';
  };

  useEffect(() => {
    const fetchBrandAndData = async () => {
      setLoading(true);
      const slug = getBrandSlug();
      const today = new Date().toISOString().split('T')[0];

      try {
        // 1. Obtener datos de la marca
        const { data: brandData, error: brandError } = await supabase
          .from('brands')
          .select('*')
          .eq('slug', slug)
          .maybeSingle();

        if (brandError || !brandData) {
          // Fallback seguro si la marca no existe
          const fallback: Brand = {
            id: 'default',
            name: 'OMM BOGOTÁ',
            logo_url: '',
            primary_color: '#0a0a0c',
            secondary_color: '#2563eb'
          };
          setBrand(fallback);
          // Cargar datos genéricos
          const { data: m } = await supabase.from('menu_items').select('*').order('category');
          const { data: e } = await supabase.from('events').select('*').gte('date', today).order('date');
          setMenu(m || []);
          setEvents(e || []);
        } else {
          setBrand(brandData);
          
          // 2. Cargar Menú filtrado por brand_id
          const { data: menuData } = await supabase
            .from('menu_items')
            .select('*')
            .eq('brand_id', brandData.id)
            .order('category');
          
          // 3. Cargar Eventos filtrados por brand_id
          const { data: eventData } = await supabase
            .from('events')
            .select('*')
            .eq('brand_id', brandData.id)
            .gte('date', today)
            .order('date');

          setMenu(menuData || []);
          setEvents(eventData || []);
        }
      } catch (err) {
        console.error("Error en carga dinámica multi-marca:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchBrandAndData();
    window.addEventListener('hashchange', fetchBrandAndData);
    return () => window.removeEventListener('hashchange', fetchBrandAndData);
  }, []);

  const handleDesignNight = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!celebration.trim() || !brand) return;

    setIsDesigning(true);
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    
    try {
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: `Eres el director de hospitalidad de ${brand.name}. Un cliente quiere celebrar: "${celebration}". 
        Crea un paquete de experiencia exclusivo que encaje con el ADN de la marca. 
        Responde estrictamente en JSON: 
        { "title": "Nombre del Plan", "items": ["Item 1", "Item 2"], "gift": "Cortesía sugerida", "description": "Resumen seductor" }`,
        config: { responseMimeType: "application/json" }
      });
      
      setAiPlan(JSON.parse(response.text));
    } catch (err) {
      console.error(err);
    } finally {
      setIsDesigning(false);
    }
  };

  if (loading) return (
    <div className="h-screen w-full bg-[#0a0a0c] flex flex-col items-center justify-center">
       <Loader2 className="text-blue-600 animate-spin mb-4" size={48} />
       <p className="text-[10px] font-black uppercase tracking-[0.3em] text-gray-500 italic">Sincronizando Identidad de Marca...</p>
    </div>
  );

  if (!brand) return null;

  const accentColor = brand.secondary_color;
  const bgColor = brand.primary_color;

  return (
    <div 
      className="min-h-screen text-white overflow-x-hidden pb-20 transition-colors duration-1000"
      style={{ backgroundColor: bgColor }}
    >
      {/* Header Estilo Publicitario */}
      <header 
        className="fixed top-0 left-0 right-0 h-24 border-b border-white/5 z-50 px-8 md:px-16 flex items-center justify-between backdrop-blur-2xl"
        style={{ backgroundColor: `${bgColor}E6` }}
      >
        <div className="flex items-center gap-4">
          {brand.logo_url ? (
            <img src={brand.logo_url} alt={brand.name} className="h-12 w-auto object-contain" />
          ) : (
            <div className="w-12 h-12 rounded-2xl flex items-center justify-center shadow-2xl" style={{ backgroundColor: accentColor }}>
               <Zap size={24} fill="white" />
            </div>
          )}
          <h1 className="text-3xl font-black italic tracking-tighter uppercase leading-none">
            {brand.name.split(' ')[0]} <span style={{ color: accentColor }}>{brand.name.split(' ').slice(1).join(' ')}</span>
          </h1>
        </div>
        <div className="flex items-center gap-8">
           <button 
             onClick={() => window.location.hash = ''} 
             className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-500 hover:text-white transition-all flex items-center gap-2"
           >
             <ArrowLeft size={14} /> STAFF ACCESS
           </button>
           <button 
             className="hidden md:block px-8 py-3 rounded-full font-black italic text-[10px] uppercase tracking-widest text-white shadow-xl transition-all active:scale-95"
             style={{ backgroundColor: accentColor }}
           >
             RESERVAR AHORA
           </button>
        </div>
      </header>

      {/* Hero Section Dinámico */}
      <section className="relative pt-52 pb-32 px-8 text-center overflow-hidden">
        <div 
          className="absolute top-0 left-1/2 -translate-x-1/2 w-[1000px] h-[500px] blur-[180px] -z-10 opacity-30 animate-pulse"
          style={{ backgroundColor: accentColor }}
        ></div>
        <div className="max-w-5xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-8 duration-1000">
           <span className="font-black uppercase tracking-[0.6em] text-[11px] block" style={{ color: accentColor }}>DESTINO GASTRONÓMICO DE LUJO</span>
           <h2 className="text-8xl md:text-[10rem] font-black italic tracking-tighter leading-[0.85] uppercase">
             VIVE LA <br/>
             <span className="text-transparent bg-clip-text bg-gradient-to-r" style={{ backgroundImage: `linear-gradient(to right, ${accentColor}, #ffffff)` }}>EXPERIENCIA {brand.name.split(' ')[0]}.</span>
           </h2>
           <p className="text-gray-400 text-xl max-w-2xl mx-auto italic font-medium leading-relaxed">
             Donde la alta cocina se encuentra con el alma de la ciudad. Reserva hoy tu lugar en el ritual.
           </p>
           <div className="pt-8">
              <ChevronDown className="mx-auto animate-bounce text-gray-700" size={32} />
           </div>
        </div>
      </section>

      {/* IA Experience Designer (Dynamic Styles) */}
      <section className="px-8 mb-40">
        <div className="max-w-4xl mx-auto bg-white/[0.03] border border-white/10 rounded-[4rem] p-16 relative overflow-hidden shadow-2xl backdrop-blur-md">
           <div className="absolute top-0 right-0 p-16 opacity-5">
             <Sparkles size={200} style={{ color: accentColor }} />
           </div>
           
           <div className="relative z-10 text-center mb-12">
              <h3 className="text-4xl font-black italic uppercase mb-3 tracking-tighter">Diseña tu noche perfecta</h3>
              <p className="text-gray-500 text-xs font-bold uppercase tracking-[0.3em]">Nuestra IA creará una propuesta exclusiva en {brand.name}</p>
           </div>

           <form onSubmit={handleDesignNight} className="relative z-10 flex flex-col md:flex-row gap-4 max-w-2xl mx-auto mb-16">
              <input 
                type="text" 
                placeholder="¿Qué celebramos hoy? (Ej: Aniversario, Ascenso...)"
                value={celebration}
                onChange={(e) => setCelebration(e.target.value)}
                className="flex-1 bg-black/50 border border-white/10 rounded-full px-10 py-6 text-sm font-bold italic outline-none focus:border-white/30 transition-all placeholder:text-gray-700"
              />
              <button 
                type="submit"
                disabled={isDesigning || !celebration}
                className="text-white px-12 py-6 rounded-full font-black italic text-xs uppercase tracking-widest transition-all shadow-2xl flex items-center justify-center gap-3 active:scale-95 disabled:opacity-50"
                style={{ backgroundColor: accentColor, boxShadow: `0 15px 40px ${accentColor}40` }}
              >
                {isDesigning ? <Loader2 className="animate-spin" /> : <><Sparkles size={18} /> DISEÑAR PLAN</>}
              </button>
           </form>

           {aiPlan && (
             <div 
               className="relative z-10 animate-in zoom-in duration-700 border-2 rounded-[3.5rem] p-12 max-w-3xl mx-auto shadow-[0_0_80px_rgba(0,0,0,0.5)]"
               style={{ borderColor: `${accentColor}33`, backgroundColor: `${bgColor}80` }}
             >
                <div className="flex flex-col md:flex-row gap-12">
                   <div className="flex-1 space-y-8">
                      <div className="space-y-3">
                        <span className="text-[10px] font-black uppercase tracking-[0.4em]" style={{ color: accentColor }}>RECOMENDACIÓN DEL CONCIERGE</span>
                        <h4 className="text-5xl font-black italic tracking-tighter text-white uppercase leading-none">{aiPlan.title}</h4>
                      </div>
                      <p className="text-gray-400 italic text-base leading-relaxed">"{aiPlan.description}"</p>
                      <div className="flex flex-wrap gap-3">
                         {aiPlan.items.map((it, i) => (
                           <span key={i} className="bg-white/5 border border-white/5 px-5 py-2 rounded-full text-[10px] font-bold text-gray-300 uppercase tracking-widest">{it}</span>
                         ))}
                      </div>
                   </div>
                   <div className="w-full md:w-72 space-y-6">
                      <div className="p-8 rounded-[2.5rem] text-center shadow-2xl relative overflow-hidden" style={{ backgroundColor: accentColor }}>
                         <div className="absolute inset-0 bg-gradient-to-b from-white/20 to-transparent pointer-events-none"></div>
                         <Gift size={40} className="mx-auto mb-4 text-white" />
                         <span className="text-[10px] font-black uppercase text-white/60 block mb-1 tracking-widest">Atención Especial</span>
                         <h5 className="text-xl font-black italic text-white uppercase leading-tight">{aiPlan.gift}</h5>
                      </div>
                      <button className="w-full bg-white text-black py-5 rounded-[1.8rem] font-black italic text-[10px] uppercase tracking-[0.2em] hover:bg-gray-100 transition-all shadow-xl active:scale-95">
                        SOLICITAR ESTE PLAN
                      </button>
                   </div>
                </div>
             </div>
           )}
        </div>
      </section>

      {/* Cartelera de Eventos (Filtrado por Marca) */}
      {events.length > 0 && (
        <section className="px-8 md:px-16 mb-40">
          <div className="max-w-7xl mx-auto space-y-16">
             <div className="flex items-center gap-6">
                <div className="w-16 h-16 bg-white/5 rounded-3xl flex items-center justify-center border border-white/5 shadow-xl" style={{ color: accentColor }}>
                  <Music size={32} />
                </div>
                <div>
                   <h3 className="text-5xl font-black italic uppercase tracking-tighter">Eventos {brand.name.split(' ')[0]}</h3>
                   <p className="text-gray-500 font-bold uppercase tracking-[0.3em] text-xs mt-1">La agenda cultural del ritual</p>
                </div>
             </div>
             
             <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-10">
                {events.map((ev) => (
                  <div key={ev.id} className="bg-white/[0.02] border border-white/5 rounded-[3.5rem] overflow-hidden group hover:border-white/20 transition-all shadow-2xl h-full flex flex-col hover:-translate-y-2 duration-500">
                    <div className="aspect-[4/3] overflow-hidden relative">
                      <img src={ev.image_url} alt={ev.title} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-1000 opacity-70" />
                      <div className="absolute top-6 right-6 bg-black/60 backdrop-blur-xl px-4 py-2 rounded-2xl border border-white/10 text-[10px] font-black uppercase tracking-widest text-white">{ev.category}</div>
                    </div>
                    <div className="p-10 flex-1 flex flex-col justify-between space-y-8">
                       <div className="space-y-4">
                          <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em]" style={{ color: accentColor }}>
                             <Calendar size={14} />
                             {new Date(ev.date).toLocaleDateString('es-ES', { day: 'numeric', month: 'long' })}
                          </div>
                          <h4 className="text-3xl font-black italic uppercase tracking-tighter leading-none group-hover:text-white transition-colors">{ev.title}</h4>
                          <p className="text-gray-500 text-sm italic line-clamp-3 leading-relaxed">{ev.description}</p>
                       </div>
                       <button 
                        className="w-full py-5 rounded-[1.5rem] border-2 font-black italic text-[10px] uppercase tracking-widest transition-all hover:bg-white hover:text-black shadow-xl"
                        style={{ borderColor: `${accentColor}66` }}
                       >
                          ADQUIRIR ACCESO
                       </button>
                    </div>
                  </div>
                ))}
             </div>
          </div>
        </section>
      )}

      {/* Menú Gastronómico (Filtrado por Marca) */}
      <section className="px-8 md:px-16">
        <div className="max-w-7xl mx-auto bg-white/[0.02] rounded-[6rem] border border-white/5 p-16 md:p-24 shadow-inner">
           <div className="text-center space-y-4 mb-24">
              <h3 className="text-6xl font-black italic uppercase tracking-tighter leading-none">Propuesta Ritual</h3>
              <p className="text-gray-500 text-base max-w-md mx-auto italic leading-relaxed">
                Selección curada por nuestro Itamae. Ingredientes de origen para una experiencia {brand.name}.
              </p>
           </div>

           <div className="grid grid-cols-1 lg:grid-cols-2 gap-x-24 gap-y-16">
              {Array.from(new Set(menu.map(m => m.category))).map(cat => (
                <div key={cat} className="space-y-10">
                   <div className="flex items-center gap-6 border-b border-white/10 pb-6">
                      <span className="font-black italic text-2xl tracking-[0.2em] uppercase" style={{ color: accentColor }}>{cat}</span>
                      <div className="h-[1px] flex-1 bg-white/5"></div>
                   </div>
                   <div className="space-y-10">
                      {menu.filter(m => m.category === cat).map((item, idx) => (
                        <div key={idx} className="group cursor-default">
                           <div className="flex justify-between items-end mb-2">
                              <h5 className="text-xl font-black italic uppercase text-gray-200 group-hover:text-white transition-colors leading-none tracking-tight">{item.name}</h5>
                              <div className="h-[1px] flex-1 border-b border-dashed border-white/20 mx-6 mb-1 opacity-50"></div>
                              <span className="text-lg font-black italic text-white font-mono">${item.price.toLocaleString()}</span>
                           </div>
                           <p className="text-[11px] text-gray-600 font-bold uppercase tracking-widest italic">{item.note || 'Selección Premium OMM'}</p>
                        </div>
                      ))}
                   </div>
                </div>
              ))}
           </div>
        </div>
      </section>

      {/* Footer Dinámico */}
      <footer className="mt-40 text-center py-32 border-t border-white/5 bg-black/40 relative overflow-hidden">
         <div className="absolute inset-0 bg-gradient-to-b from-transparent to-black/80 pointer-events-none"></div>
         <div className="relative z-10 flex flex-col items-center gap-8">
            <div className="p-6 rounded-full bg-white/5 border border-white/10 shadow-2xl" style={{ color: accentColor }}>
               <Zap size={48} fill="currentColor" />
            </div>
            <div className="space-y-3">
               <h4 className="text-2xl font-black italic tracking-tighter uppercase">{brand.name}</h4>
               <p className="text-[11px] text-gray-500 font-black uppercase tracking-[0.4em] italic">Experience Intelligence by NEXUM V4</p>
            </div>
            <div className="flex flex-wrap justify-center gap-12 mt-6 text-[10px] font-black uppercase tracking-[0.3em] text-gray-500">
               <a href="#" className="hover:text-white transition-colors">Instagram</a>
               <a href="#" className="hover:text-white transition-colors">WhatsApp Concierge</a>
               <a href="#" className="hover:text-white transition-colors">Políticas Privacidad</a>
            </div>
            <p className="text-[9px] text-gray-800 font-bold uppercase tracking-widest mt-16">
              © 2025 {brand.name} • Grupo Seratta • Bogotá, Colombia
            </p>
         </div>
      </footer>
    </div>
  );
};

export default OhYeahPage;
