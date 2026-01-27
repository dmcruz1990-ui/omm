
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
  Ticket
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

  // Obtener el slug de la marca desde la URL (ej: #/oh-yeah?brand=omm)
  const getBrandSlug = () => {
    const params = new URLSearchParams(window.location.hash.split('?')[1]);
    return params.get('brand') || 'omm';
  };

  useEffect(() => {
    const fetchBrandAndData = async () => {
      setLoading(true);
      const slug = getBrandSlug();
      const today = new Date().toISOString().split('T')[0];

      try {
        // 1. Cargar Configuración de Marca
        const { data: brandData, error: brandError } = await supabase
          .from('brands')
          .select('*')
          .eq('slug', slug)
          .maybeSingle();

        if (brandError || !brandData) {
          // Fallback por si la tabla no está poblada o falla
          const fallbackBrand: Brand = {
            id: 'default',
            name: 'OMM BOGOTÁ',
            logo_url: '',
            primary_color: '#0a0a0c',
            secondary_color: '#2563eb',
            settings: {}
          };
          setBrand(fallbackBrand);
          
          // Carga datos genéricos en fallback
          const { data: menuData } = await supabase.from('menu_items').select('*').order('category');
          const { data: eventData } = await supabase.from('events').select('*').gte('date', today).order('date');
          setMenu(menuData || []);
          setEvents(eventData || []);
        } else {
          setBrand(brandData);
          
          // 2. Cargar Menú filtrado por Brand ID (Asumiendo columna brand_id)
          const { data: menuData } = await supabase
            .from('menu_items')
            .select('*')
            .eq('brand_id', brandData.id)
            .order('category');
          
          // 3. Cargar Eventos filtrados por Brand ID
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
        console.error("❌ Error en carga multi-marca:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchBrandAndData();
    
    // Escuchar cambios en el hash para re-cargar si cambia la marca en la URL
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
        contents: `Eres el director de experiencias de ${brand.name}, un restaurante de ultra-lujo. 
        El cliente quiere celebrar: "${celebration}". 
        Crea un paquete exclusivo acorde al ADN de la marca. 
        Responde estrictamente en JSON con este formato: 
        { "title": "Nombre Creativo del Plan", "items": ["Plato 1", "Bebida 2", "Experiencia 3"], "gift": "Cortesia especial", "description": "Breve descripción seductora del plan" }`,
        config: { responseMimeType: "application/json" }
      });
      
      const plan = JSON.parse(response.text);
      setAiPlan(plan);
    } catch (err) {
      console.error(err);
    } finally {
      setIsDesigning(false);
    }
  };

  if (loading) return (
    <div className="h-screen w-full bg-[#0a0a0c] flex flex-col items-center justify-center">
       <Loader2 className="text-blue-600 animate-spin mb-4" size={48} />
       <p className="text-[10px] font-black uppercase tracking-[0.3em] text-gray-500">Sincronizando Identidad...</p>
    </div>
  );

  if (!brand) return null;

  const accentColor = brand.secondary_color || '#2563eb';
  const bgColor = brand.primary_color || '#0a0a0c';

  return (
    <div 
      className="min-h-screen text-white overflow-x-hidden pb-20 transition-colors duration-1000"
      style={{ backgroundColor: bgColor }}
    >
      {/* Header Dinámico */}
      <header 
        className="fixed top-0 left-0 right-0 h-20 bg-opacity-80 backdrop-blur-xl border-b border-white/5 z-50 px-8 flex items-center justify-between"
        style={{ backgroundColor: `${bgColor}CC` }}
      >
        <div className="flex items-center gap-3">
          {brand.logo_url ? (
            <img src={brand.logo_url} alt={brand.name} className="h-10 w-auto" />
          ) : (
            <div className="w-10 h-10 rounded-xl flex items-center justify-center shadow-lg" style={{ backgroundColor: accentColor }}>
               <Zap size={20} fill="white" />
            </div>
          )}
          <h1 className="text-2xl font-black italic tracking-tighter uppercase">
            {brand.name.split(' ')[0]} <span style={{ color: accentColor }}>{brand.name.split(' ').slice(1).join(' ')}</span>
          </h1>
        </div>
        <button 
          onClick={() => window.location.hash = ''} 
          className="text-[10px] font-black uppercase tracking-widest text-gray-500 hover:text-white transition-all flex items-center gap-2"
        >
          <ArrowLeft size={14} /> STAFF HUB
        </button>
      </header>

      {/* Hero Section */}
      <section className="relative pt-40 pb-24 px-8 text-center overflow-hidden">
        <div 
          className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] blur-[150px] -z-10 opacity-20"
          style={{ backgroundColor: accentColor }}
        ></div>
        <div className="max-w-4xl mx-auto space-y-6">
           <span className="font-black uppercase tracking-[0.5em] text-[10px] animate-in fade-in slide-in-from-bottom-2" style={{ color: accentColor }}>EXPERIENCIAS PREMIUM</span>
           <h2 className="text-7xl md:text-9xl font-black italic tracking-tighter leading-none animate-in fade-in slide-in-from-bottom-4 duration-700 uppercase">
             VIVE <br/>
             <span className="text-transparent bg-clip-text bg-gradient-to-r" style={{ backgroundImage: `linear-gradient(to right, ${accentColor}, #ffffff)` }}>{brand.name}.</span>
           </h2>
           <p className="text-gray-400 text-lg max-w-xl mx-auto italic font-medium">
             Gastronomía, Arte y Sensaciones en el corazón de la ciudad.
           </p>
        </div>
      </section>

      {/* IA Experience Designer */}
      <section className="px-8 mb-32">
        <div className="max-w-4xl mx-auto bg-white/5 border border-white/10 rounded-[4rem] p-12 relative overflow-hidden shadow-2xl">
           <div className="absolute top-0 right-0 p-12 opacity-5">
             <Sparkles size={160} style={{ color: accentColor }} />
           </div>
           
           <div className="relative z-10 text-center mb-10">
              <h3 className="text-3xl font-black italic uppercase mb-2 tracking-tighter">Crea tu plan perfecto</h3>
              <p className="text-gray-500 text-xs font-bold uppercase tracking-widest">Dinos qué celebras y nuestra IA diseñará tu noche en {brand.name}</p>
           </div>

           <form onSubmit={handleDesignNight} className="relative z-10 flex flex-col md:flex-row gap-4 max-w-2xl mx-auto mb-12">
              <input 
                type="text" 
                placeholder="Ej: Mi Aniversario, Cena con amigos..."
                value={celebration}
                onChange={(e) => setCelebration(e.target.value)}
                className="flex-1 bg-black/40 border border-white/10 rounded-[2rem] px-8 py-5 text-sm font-bold italic outline-none focus:border-white/30 transition-all"
              />
              <button 
                type="submit"
                disabled={isDesigning || !celebration}
                className="text-white px-10 py-5 rounded-[2rem] font-black italic text-xs uppercase tracking-widest transition-all shadow-xl flex items-center justify-center gap-3 active:scale-95 disabled:opacity-50"
                style={{ backgroundColor: accentColor, boxShadow: `0 10px 30px ${accentColor}40` }}
              >
                {isDesigning ? <Loader2 className="animate-spin" /> : <><Sparkles size={18} /> DISEÑAR NOCHE</>}
              </button>
           </form>

           {aiPlan && (
             <div 
               className="relative z-10 animate-in zoom-in duration-500 border rounded-[3rem] p-10 max-w-3xl mx-auto shadow-2xl"
               style={{ borderColor: `${accentColor}40`, backgroundColor: `${accentColor}10` }}
             >
                <div className="flex flex-col md:flex-row gap-10">
                   <div className="flex-1 space-y-6">
                      <div className="space-y-2">
                        <span className="text-[10px] font-black uppercase tracking-widest" style={{ color: accentColor }}>Propuesta Exclusiva</span>
                        <h4 className="text-4xl font-black italic tracking-tighter text-white uppercase leading-none">{aiPlan.title}</h4>
                      </div>
                      <p className="text-gray-400 italic text-sm leading-relaxed">"{aiPlan.description}"</p>
                      <div className="flex flex-wrap gap-2">
                         {aiPlan.items.map((it, i) => (
                           <span key={i} className="bg-white/5 border border-white/5 px-4 py-1.5 rounded-full text-[10px] font-bold text-gray-300 uppercase">{it}</span>
                         ))}
                      </div>
                   </div>
                   <div className="w-full md:w-64 space-y-6">
                      <div className="p-6 rounded-[2.5rem] text-center shadow-xl" style={{ backgroundColor: accentColor }}>
                         <Gift size={32} className="mx-auto mb-3 text-white" />
                         <span className="text-[9px] font-black uppercase text-white/60 block mb-1">Cortesía de {brand.name}</span>
                         <h5 className="text-lg font-black italic text-white uppercase leading-none">{aiPlan.gift}</h5>
                      </div>
                      <button className="w-full bg-white text-black py-4 rounded-[1.8rem] font-black italic text-xs uppercase tracking-widest hover:opacity-90 transition-all">
                        RESERVAR ESTE PLAN
                      </button>
                   </div>
                </div>
             </div>
           )}
        </div>
      </section>

      {/* Cartelera de Eventos */}
      {events.length > 0 && (
        <section className="px-8 mb-32">
          <div className="max-w-7xl mx-auto space-y-12">
             <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-white/5 rounded-2xl flex items-center justify-center border border-white/5" style={{ color: accentColor }}>
                  <Music size={24} />
                </div>
                <h3 className="text-4xl font-black italic uppercase tracking-tighter">Eventos de la Semana</h3>
             </div>
             
             <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
                {events.map((ev) => (
                  <div key={ev.id} className="bg-[#111114] border border-white/5 rounded-[3rem] overflow-hidden group hover:border-white/20 transition-all shadow-xl h-full flex flex-col">
                    <div className="aspect-[4/3] overflow-hidden relative">
                      <img src={ev.image_url} alt={ev.title} className="w-full h-full object-cover group-hover:scale-110