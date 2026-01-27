
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
  ArrowLeft
} from 'lucide-react';
import { GoogleGenAI } from "@google/genai";
import { MenuItem, OmmEvent } from '../types';

const OhYeahPage: React.FC = () => {
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

  useEffect(() => {
    const fetchPublicData = async () => {
      setLoading(true);
      const today = new Date().toISOString().split('T')[0];

      const { data: menuData } = await supabase.from('menu_items').select('*').order('category');
      const { data: eventData } = await supabase.from('events').select('*').gte('date', today).order('date');

      setMenu(menuData || []);
      setEvents(eventData || []);
      setLoading(false);
    };
    fetchPublicData();
  }, []);

  const handleDesignNight = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!celebration.trim()) return;

    setIsDesigning(true);
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    
    try {
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: `Eres el director de experiencias de OMM, un restaurante japonés de ultra-lujo. 
        El cliente quiere celebrar: "${celebration}". 
        Crea un paquete exclusivo. 
        Responde estrictamente en JSON con este formato: 
        { "title": "Nombre Creativo del Plan", "items": ["Plato 1", "Bebida 2", "Experiencia 3"], "gift": "Cortesia especial (ej: Postre de la casa, Copa de Sake)", "description": "Breve descripción seductora del plan" }`,
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
       <Zap className="text-blue-600 animate-pulse mb-4" size={48} />
       <p className="text-[10px] font-black uppercase tracking-[0.3em] text-gray-500">Preparando Experiencia OMM...</p>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#0a0a0c] text-white overflow-x-hidden pb-20">
      
      {/* Header Público */}
      <header className="fixed top-0 left-0 right-0 h-20 bg-[#0a0a0c]/80 backdrop-blur-xl border-b border-white/5 z-50 px-8 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-600/40">
             <Zap size={20} fill="white" />
          </div>
          <h1 className="text-2xl font-black italic tracking-tighter">OH YEAH <span className="text-blue-500">OMM</span></h1>
        </div>
        <button 
          onClick={() => window.location.hash = ''} 
          className="text-[10px] font-black uppercase tracking-widest text-gray-500 hover:text-white transition-all flex items-center gap-2"
        >
          <ArrowLeft size={14} /> ACCESO STAFF
        </button>
      </header>

      {/* Hero Section */}
      <section className="relative pt-40 pb-24 px-8 text-center overflow-hidden">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-blue-600/10 blur-[150px] -z-10"></div>
        <div className="max-w-4xl mx-auto space-y-6">
           <span className="text-blue-500 font-black uppercase tracking-[0.5em] text-[10px] animate-in fade-in slide-in-from-bottom-2">SENSACIONES JAPONESAS</span>
           <h2 className="text-7xl md:text-9xl font-black italic tracking-tighter leading-none animate-in fade-in slide-in-from-bottom-4 duration-700">VIVE OMM <br/><span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-500 to-indigo-400">OH YEAH.</span></h2>
           <p className="text-gray-500 text-lg max-w-xl mx-auto italic font-medium">Gastronomía, Ritmo y Espiritualidad en el corazón de Bogotá.</p>
        </div>
      </section>

      {/* IA experience Designer */}
      <section className="px-8 mb-32">
        <div className="max-w-4xl mx-auto bg-[#111114] border border-white/10 rounded-[4rem] p-12 relative overflow-hidden shadow-2xl">
           <div className="absolute top-0 right-0 p-12 opacity-5"><Sparkles size={160} className="text-blue-500" /></div>
           
           <div className="relative z-10 text-center mb-10">
              <h3 className="text-3xl font-black italic uppercase mb-2 tracking-tighter">Crea tu plan perfecto con IA</h3>
              <p className="text-gray-500 text-xs font-bold uppercase tracking-widest">Cuéntanos qué celebras y diseñaremos tu noche</p>
           </div>

           <form onSubmit={handleDesignNight} className="relative z-10 flex flex-col md:flex-row gap-4 max-w-2xl mx-auto mb-12">
              <input 
                type="text" 
                placeholder="Ej: Mi 5to Aniversario, Cena de Negocios..."
                value={celebration}
                onChange={(e) => setCelebration(e.target.value)}
                className="flex-1 bg-black border border-white/10 rounded-[2rem] px-8 py-5 text-sm font-bold italic outline-none focus:border-blue-500 transition-all"
              />
              <button 
                type="submit"
                disabled={isDesigning || !celebration}
                className="bg-blue-600 hover:bg-blue-500 text-white px-10 py-5 rounded-[2rem] font-black italic text-xs uppercase tracking-widest transition-all shadow-xl shadow-blue-600/20 flex items-center justify-center gap-3 active:scale-95 disabled:opacity-50"
              >
                {isDesigning ? <Loader2 className="animate-spin" /> : <><Sparkles size={18} /> DISEÑAR NOCHE</>}
              </button>
           </form>

           {aiPlan && (
             <div className="relative z-10 animate-in zoom-in duration-500 bg-gradient-to-br from-blue-600/20 to-indigo-600/5 border border-blue-500/30 rounded-[3rem] p-10 max-w-3xl mx-auto shadow-[0_0_50px_rgba(37,99,235,0.15)]">
                <div className="flex flex-col md:flex-row gap-10">
                   <div className="flex-1 space-y-6">
                      <div className="space-y-2">
                        <span className="text-blue-400 text-[10px] font-black uppercase tracking-widest">Recomendación Exclusiva</span>
                        <h4 className="text-4xl font-black italic tracking-tighter text-white uppercase">{aiPlan.title}</h4>
                      </div>
                      <p className="text-gray-400 italic text-sm leading-relaxed">"{aiPlan.description}"</p>
                      <div className="flex flex-wrap gap-2">
                         {aiPlan.items.map((it, i) => (
                           <span key={i} className="bg-white/5 border border-white/5 px-4 py-1.5 rounded-full text-[10px] font-bold text-gray-300 uppercase">{it}</span>
                         ))}
                      </div>
                   </div>
                   <div className="w-full md:w-64 space-y-6">
                      <div className="bg-blue-600 p-6 rounded-[2.5rem] text-center shadow-xl">
                         <Gift size={32} className="mx-auto mb-3 text-white" />
                         <span className="text-[9px] font-black uppercase text-blue-200 block mb-1">Regalo de la Casa</span>
                         <h5 className="text-lg font-black italic text-white uppercase leading-none">{aiPlan.gift}</h5>
                      </div>
                      <button className="w-full bg-white text-black py-4 rounded-[1.8rem] font-black italic text-xs uppercase tracking-widest hover:bg-blue-50 transition-all">
                        RESERVAR ESTE PLAN
                      </button>
                   </div>
                </div>
             </div>
           )}
        </div>
      </section>

      {/* Cartelera de Eventos */}
      <section className="px-8 mb-32">
        <div className="max-w-7xl mx-auto space-y-12">
           <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-white/5 rounded-2xl flex items-center justify-center text-blue-500 border border-white/5"><Music size={24} /></div>
              <h3 className="text-4xl font-black italic uppercase tracking-tighter">Eventos de la Semana</h3>
           </div>
           
           <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
              {events.map((ev) => (
                <div key={ev.id} className="bg-[#111114] border border-white/5 rounded-[3rem] overflow-hidden group hover:border-blue-500/40 transition-all shadow-xl h-full flex flex-col">
                  <div className="aspect-[4/3] overflow-hidden relative">
                    <img src={ev.image_url} alt={ev.title} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-1000 opacity-80" />
                    <div className="absolute top-4 right-4 bg-black/60 backdrop-blur-md px-3 py-1 rounded-full border border-white/10 text-[9px] font-black uppercase">{ev.category}</div>
                  </div>
                  <div className="p-8 flex-1 flex flex-col justify-between space-y-6">
                     <div className="space-y-3">
                        <div className="flex items-center gap-2 text-blue-400 text-[10px] font-black uppercase tracking-widest">
                           <Calendar size={12} />
                           {new Date(ev.date).toLocaleDateString('es-ES', { day: 'numeric', month: 'long' })}
                        </div>
                        <h4 className="text-2xl font-black italic uppercase tracking-tighter leading-none">{ev.title}</h4>
                        <p className="text-gray-500 text-xs italic line-clamp-2 leading-relaxed">{ev.description}</p>
                     </div>
                     <button className="w-full py-4 rounded-[1.5rem] border border-white/10 text-[10px] font-black uppercase tracking-widest hover:bg-white hover:text-black transition-all">
                        ADQUIRIR ENTRADA
                     </button>
                  </div>
                </div>
              ))}
           </div>
        </div>
      </section>

      {/* Menú del Día */}
      <section className="px-8">
        <div className="max-w-7xl mx-auto space-y-12 bg-[#0d0d0f] rounded-[5rem] border border-white/5 p-16">
           <div className="text-center space-y-4">
              <h3 className="text-5xl font-black italic uppercase tracking-tighter">Gastronomía Ritual</h3>
              <p className="text-gray-500 text-sm max-w-md mx-auto italic">Selecciones curadas de nuestro Itamae, ingredientes frescos importados cada semana.</p>
           </div>

           <div className="grid grid-cols-1 md:grid-cols-2 gap-x-20 gap-y-12">
              {/* Categorías Principales */}
              {Array.from(new Set(menu.map(m => m.category))).map(cat => (
                <div key={cat} className="space-y-8">
                   <div className="flex items-center gap-4 border-b border-white/5 pb-4">
                      <span className="text-blue-500 font-black italic text-xl tracking-widest uppercase">{cat}</span>
                      <div className="h-[1px] flex-1 bg-white/5"></div>
                   </div>
                   <div className="space-y-8">
                      {menu.filter(m => m.category === cat).map((item, idx) => (
                        <div key={idx} className="group cursor-default">
                           <div className="flex justify-between items-end mb-1">
                              <h5 className="text-lg font-black italic uppercase text-gray-200 group-hover:text-blue-400 transition-colors leading-none">{item.name}</h5>
                              <div className="h-[1px] flex-1 border-b border-dashed border-white/10 mx-4 mb-1"></div>
                              <span className="text-sm font-black italic text-white">${item.price.toLocaleString()}</span>
                           </div>
                           <p className="text-[10px] text-gray-600 font-medium uppercase tracking-wider">{item.note || 'Experience OMM ritual gastronomy'}</p>
                        </div>
                      ))}
                   </div>
                </div>
              ))}
           </div>
        </div>
      </section>

      <footer className="mt-32 text-center py-20 border-t border-white/5 bg-[#050505]">
         <div className="flex flex-col items-center gap-6">
            <Zap size={40} className="text-blue-600" fill="currentColor" />
            <div className="space-y-2">
               <h4 className="text-xl font-black italic tracking-tighter">OMM BOGOTÁ</h4>
               <p className="text-[10px] text-gray-600 font-black uppercase tracking-widest">Autopista Norte # 114 - 44 | Piso 11</p>
            </div>
            <div className="flex gap-8 mt-4 text-[10px] font-black uppercase tracking-widest text-gray-500">
               <a href="#" className="hover:text-blue-500 transition-colors">Instagram</a>
               <a href="#" className="hover:text-blue-500 transition-colors">WhatsApp</a>
               <a href="#" className="hover:text-blue-500 transition-colors">Menú Digital</a>
            </div>
            <p className="text-[8px] text-gray-800 font-bold uppercase tracking-widest mt-10">© 2025 Grupo Seratta | Powered by NEXUM V4</p>
         </div>
      </footer>
    </div>
  );
};

export default OhYeahPage;
