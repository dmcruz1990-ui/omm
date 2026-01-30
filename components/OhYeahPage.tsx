
import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase.ts';
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
  ChevronDown,
  User,
  Heart,
  Plus,
  Users,
  Search,
  CheckCircle2,
  Trophy,
  Flame,
  LayoutGrid,
  // Fix: Added missing Compass icon import
  Compass
} from 'lucide-react';
import { GoogleGenAI } from "@google/genai";
import { MenuItem, OmmEvent, Brand, SocialProfile, LoyaltyLevel } from '../types.ts';
import { useAuth } from '../contexts/AuthContext.tsx';

const OhYeahPage: React.FC = () => {
  const { profile } = useAuth();
  const [activeTab, setActiveTab] = useState<'discover' | 'profile' | 'social'>('discover');
  const [brands, setBrands] = useState<Brand[]>([]);
  const [menu, setMenu] = useState<MenuItem[]>([]);
  const [events, setEvents] = useState<OmmEvent[]>([]);
  const [loading, setLoading] = useState(true);
  
  // AI State
  const [mood, setMood] = useState('');
  const [isThinking, setIsThinking] = useState(false);
  const [recommendation, setRecommendation] = useState<any>(null);

  // Social State
  const [socialProfiles, setSocialProfiles] = useState<SocialProfile[]>([
    { id: '1', name: 'Connie', relation: 'Esposa', preferences: ['Sushi', 'Vino Blanco', 'Alergia: Nueces'] },
    { id: '2', name: 'Socio VIP', relation: 'Negocios', preferences: ['Carnes', 'Privacidad', 'Malta'] }
  ]);

  useEffect(() => {
    fetchGlobalData();
  }, []);

  const fetchGlobalData = async () => {
    setLoading(true);
    try {
      const { data: b } = await supabase.from('brands').select('*');
      const { data: m } = await supabase.from('menu_items').select('*');
      const { data: e } = await supabase.from('events').select('*');
      setBrands(b || []);
      setMenu(m || []);
      setEvents(e || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const getAIRecommendation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!mood.trim()) return;
    setIsThinking(true);
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    
    try {
      // Cruzamos mood con marcas disponibles y sus estados de ocupación (mocked rate)
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: `Analiza este mood de cliente: "${mood}". 
        Marcas disponibles: OMM (Kaiseki/Mantra), Seratta (Gourmet), Viva la Vida (Tapas). 
        Prioriza las mesas con "baja ocupación" (OMM tiene 30% ahora). 
        Genera un plan de noche en formato JSON: { "brand": "OMM", "plan": "Nombre del Plan", "reason": "Por qué es perfecto", "gift": "Cortesía sugerida" }`,
        config: { responseMimeType: "application/json" }
      });
      // Fix: Added safety check before parsing JSON from AI response
      if (response.text) {
        setRecommendation(JSON.parse(response.text));
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsThinking(false);
    }
  };

  if (loading) return (
    <div className="h-screen w-full bg-[#050505] flex flex-col items-center justify-center">
       <Loader2 className="text-blue-600 animate-spin mb-4" size={48} />
       <p className="text-[10px] font-black uppercase tracking-[0.3em] text-gray-500 italic">Sincronizando el Universo Seratta...</p>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#050505] text-white overflow-y-auto custom-scrollbar pb-32 font-sans selection:bg-blue-600">
      
      {/* Navegación B2C Superior */}
      <header className="fixed top-0 left-0 right-0 h-24 border-b border-white/5 z-[100] px-8 md:px-16 flex items-center justify-between backdrop-blur-2xl bg-black/40">
        <div className="flex items-center gap-4 cursor-pointer" onClick={() => window.location.hash = ''}>
           <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-600/30">
              <Zap size={20} fill="white" />
           </div>
           <h1 className="text-2xl font-black italic tracking-tighter uppercase leading-none">
             OH YEAH! <span className="text-blue-600 text-sm align-top ml-1 italic">EXPERIENCE</span>
           </h1>
        </div>

        <nav className="hidden lg:flex bg-white/5 border border-white/10 p-1.5 rounded-2xl">
           <NavBtn active={activeTab === 'discover'} onClick={() => setActiveTab('discover')} label="DESCUBRE" icon={<Compass size={14} />} />
           <NavBtn active={activeTab === 'profile'} onClick={() => setActiveTab('profile')} label="MI PERFIL" icon={<User size={14} />} />
           <NavBtn active={activeTab === 'social'} onClick={() => setActiveTab('social')} label="SOCIAL HUB" icon={<Users size={14} />} />
        </nav>

        <div className="flex items-center gap-6">
           <div className="hidden md:flex flex-col items-end">
              <span className="text-[8px] text-gray-500 font-black uppercase tracking-widest">Nivel de Socio</span>
              <div className="flex items-center gap-2">
                 <div className="w-2 h-2 rounded-full bg-yellow-500 animate-pulse"></div>
                 <span className="text-xs font-black italic text-yellow-500 uppercase">{profile?.loyalty_level || 'GOLD'}</span>
              </div>
           </div>
           <button className="bg-blue-600 p-3 rounded-xl hover:bg-blue-500 transition-all shadow-xl shadow-blue-600/20">
              <Ticket size={20} />
           </button>
        </div>
      </header>

      <main className="pt-40 px-8 md:px-16 max-w-7xl mx-auto space-y-24 text-left">
        
        {activeTab === 'discover' && (
          <div className="space-y-24 animate-in fade-in slide-in-from-bottom-4 duration-1000">
             
             {/* Hero AI Selector */}
             <section className="relative bg-[#0d0d0f] border border-white/5 rounded-[4rem] p-16 overflow-hidden shadow-2xl">
                <div className="absolute top-0 right-0 p-20 opacity-5 scale-150 rotate-12">
                   <Sparkles size={200} className="text-blue-500" />
                </div>
                
                <div className="relative z-10 max-w-3xl">
                   <span className="inline-flex items-center gap-2 bg-blue-600/10 border border-blue-500/20 px-4 py-1.5 rounded-full mb-8 text-[10px] font-black text-blue-400 uppercase tracking-widest italic">
                     <Sparkles size={12} /> Nexum Intelligence Recommendation
                   </span>
                   <h2 className="text-6xl md:text-8xl font-black italic tracking-tighter uppercase leading-[0.9] mb-8">
                     Diseña tu <br/> <span className="text-blue-600">noche ideal.</span>
                   </h2>
                   
                   <form onSubmit={getAIRecommendation} className="flex flex-col md:flex-row gap-4 mb-10">
                      <input 
                        type="text" 
                        value={mood}
                        onChange={(e) => setMood(e.target.value)}
                        placeholder="Ej: Cena romántica con música jazz y vino tinto..."
                        className="flex-1 bg-white/5 border border-white/10 rounded-3xl px-10 py-6 text-base font-bold italic outline-none focus:border-blue-500/50 transition-all placeholder:text-gray-700"
                      />
                      <button 
                        type="submit"
                        disabled={isThinking || !mood}
                        className="bg-blue-600 hover:bg-blue-500 px-12 py-6 rounded-3xl font-black italic text-xs uppercase tracking-widest transition-all shadow-2xl shadow-blue-600/20 flex items-center justify-center gap-3 active:scale-95 disabled:opacity-30"
                      >
                         {isThinking ? <Loader2 className="animate-spin" size={20} /> : <><MessageCircle size={20} /> RECOMENDAR</>}
                      </button>
                   </form>

                   {recommendation && (
                     <div className="bg-blue-600/20 border-2 border-blue-500/30 rounded-[2.5rem] p-8 animate-in zoom-in duration-500 flex flex-col md:flex-row gap-10 items-center">
                        <div className="w-full md:w-48 aspect-square bg-gray-900 rounded-3xl overflow-hidden border border-white/5 shadow-2xl">
                           <img src="https://images.unsplash.com/photo-1579871494447-9811cf80d66c?q=80&w=400" className="w-full h-full object-cover grayscale brightness-110" />
                        </div>
                        <div className="flex-1 space-y-4">
                           <div className="flex items-center justify-between">
                              <h4 className="text-3xl font-black italic uppercase tracking-tighter">{recommendation.brand}: {recommendation.plan}</h4>
                              <div className="bg-green-500 text-white px-3 py-1 rounded-full text-[8px] font-black uppercase">¡Invitación Especial!</div>
                           </div>
                           <p className="text-gray-400 italic text-sm leading-relaxed">"{recommendation.reason}"</p>
                           <div className="flex items-center gap-6 pt-4 border-t border-white/5">
                              <div className="flex flex-col">
                                 <span className="text-[8px] text-blue-400 font-black uppercase">Tu beneficio exclusivo</span>
                                 <span className="text-lg font-black italic text-white flex items-center gap-2"><Gift size={16} className="text-yellow-500" /> {recommendation.gift}</span>
                              </div>
                              <button className="bg-white text-black px-8 py-4 rounded-2xl font-black italic text-[10px] uppercase tracking-widest hover:bg-blue-600 hover:text-white transition-all">
                                 RESERVAR ESTE PLAN
                              </button>
                           </div>
                        </div>
                     </div>
                   )}
                </div>
             </section>

             {/* Marcas Destacadas (Lógica Mesas Muertas) */}
             <section className="space-y-12">
                <div className="flex items-center justify-between">
                   <div>
                      <h3 className="text-2xl font-black italic uppercase tracking-tighter">Nuestras Casas</h3>
                      <p className="text-gray-500 text-[10px] font-black uppercase tracking-[0.4em] italic">Explora experiencias curadas</p>
                   </div>
                   <button className="text-xs font-black uppercase text-blue-500 hover:text-white transition-colors">Ver todo el grupo</button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                   {brands.map(brand => (
                     <div key={brand.id} className="bg-[#111114] border border-white/5 rounded-[3.5rem] overflow-hidden group hover:border-blue-500/30 transition-all flex flex-col h-[500px] shadow-2xl">
                        <div className="relative h-64 overflow-hidden">
                           <img src="https://images.unsplash.com/photo-1551632432-c735e8299bc2?q=80&w=600" className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-1000 opacity-60" />
                           <div className="absolute inset-0 bg-gradient-to-t from-[#111114] to-transparent"></div>
                           <div className="absolute bottom-6 left-10">
                              <h4 className="text-4xl font-black italic uppercase tracking-tighter leading-none mb-1">{brand.name}</h4>
                              <p className="text-blue-500 text-[10px] font-black uppercase tracking-[0.3em] italic">OMM_OPERATIONAL_UNIT</p>
                           </div>
                        </div>
                        <div className="p-10 flex-1 flex flex-col justify-between">
                           <p className="text-gray-500 italic text-sm line-clamp-3 leading-relaxed">Alta gastronomía inspirada en el ritual de los sentidos. El lugar donde el tiempo se detiene.</p>
                           <div className="pt-6 border-t border-white/5 flex items-center justify-between">
                              <div className="flex gap-2">
                                 <CategoryBadge label="Zen" />
                                 <CategoryBadge label="Sushi" />
                              </div>
                              <button className="w-12 h-12 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center hover:bg-blue-600 transition-all group-hover:scale-110">
                                 <ChevronRight size={20} />
                              </button>
                           </div>
                        </div>
                     </div>
                   ))}
                </div>
             </section>

             {/* Events Carousel */}
             <section className="bg-[#111114] rounded-[4rem] p-16 border border-white/5 relative overflow-hidden">
                <div className="flex items-center justify-between mb-16">
                   <h3 className="text-5xl font-black italic uppercase tracking-tighter">Eventos <span className="text-blue-600">Rituales</span></h3>
                   <div className="flex gap-3">
                      <button className="p-4 bg-white/5 rounded-2xl border border-white/5 hover:bg-white/10 transition-all"><ArrowLeft size={20} /></button>
                      <button className="p-4 bg-white/5 rounded-2xl border border-white/5 hover:bg-white/10 transition-all"><ChevronRight size={20} /></button>
                   </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
                   {events.map(ev => (
                      <div key={ev.id} className="relative group cursor-pointer aspect-[3/4] rounded-[2.5rem] overflow-hidden border border-white/5 shadow-2xl">
                         <img src={ev.image_url} className="w-full h-full object-cover opacity-50 group-hover:scale-110 transition-transform duration-700" />
                         <div className="absolute inset-0 bg-gradient-to-t from-black via-black/20 to-transparent p-10 flex flex-col justify-end">
                            <span className="text-[10px] font-black text-blue-500 uppercase tracking-widest mb-3 italic">{ev.category}</span>
                            <h4 className="text-3xl font-black italic uppercase leading-none mb-4">{ev.title}</h4>
                            <div className="flex items-center gap-3 text-[10px] font-bold text-gray-400">
                               <Calendar size={14} className="text-blue-500" />
                               {new Date(ev.date).toLocaleDateString()}
                            </div>
                         </div>
                      </div>
                   ))}
                </div>
             </section>
          </div>
        )}

        {activeTab === 'profile' && (
          <div className="animate-in fade-in duration-700 space-y-12">
             <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
                
                {/* VIP Card */}
                <div className="bg-gradient-to-br from-[#111114] to-[#0a0a0c] border border-white/10 rounded-[4rem] p-12 shadow-2xl relative overflow-hidden h-[600px] flex flex-col justify-between group">
                   <div className="absolute top-0 right-0 p-12 opacity-10 group-hover:scale-110 transition-transform">
                      <Zap size={140} className="text-blue-500" fill="currentColor" />
                   </div>
                   
                   <div className="space-y-8 relative z-10">
                      <div className="w-24 h-24 rounded-full border-4 border-yellow-500 p-1">
                         <img src={`https://i.pravatar.cc/150?u=${profile?.id}`} className="w-full h-full rounded-full object-cover" />
                      </div>
                      <div>
                         <h3 className="text-5xl font-black italic uppercase tracking-tighter leading-none mb-2">{profile?.full_name || 'VIP Member'}</h3>
                         <p className="text-gray-500 font-black uppercase tracking-[0.3em] text-[10px] italic">Societatem Gastronomicam Seratta</p>
                      </div>
                   </div>

                   <div className="space-y-6 relative z-10">
                      <div className="flex justify-between items-end mb-2">
                         <span className="text-xs font-black uppercase text-blue-500">PUNTOS ACUMULADOS</span>
                         <span className="text-4xl font-black italic tracking-tighter">14,250 <span className="text-sm text-gray-600">ZEN</span></span>
                      </div>
                      <div className="h-2 w-full bg-white/5 rounded-full overflow-hidden">
                         <div className="h-full bg-blue-600 w-3/4 shadow-[0_0_15px_rgba(37,99,235,0.6)]"></div>
                      </div>
                      <div className="flex justify-between text-[8px] font-black uppercase text-gray-500 tracking-widest">
                         <span>NIVEL GOLD</span>
                         <span>PRÓXIMO NIVEL: VIP (2,750 pts)</span>
                      </div>
                   </div>
                </div>

                {/* Gastronomic DNA */}
                <div className="lg:col-span-2 space-y-8">
                   <h3 className="text-2xl font-black italic uppercase">Tu ADN Gastronómico</h3>
                   <div className="bg-[#111114] border border-white/5 rounded-[4rem] p-12 shadow-2xl">
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                         <DNAInput label="🍣 JAPONÉS" active />
                         <DNAInput label="🥩 CARNES" />
                         <DNAInput label="🌱 VEGGIE" />
                         <DNAInput label="🍸 COCTELERÍA" active />
                         <DNAInput label="🎶 DJ SETS" active />
                         <DNAInput label="🍷 VINOS" />
                         <DNAInput label="🤫 PRIVACIDAD" active />
                         <DNAInput label="🎂 EVENTOS" />
                      </div>
                      
                      <div className="mt-16 pt-12 border-t border-white/5 space-y-10">
                         <h4 className="text-xs font-black text-gray-500 uppercase tracking-widest flex items-center gap-3 italic">
                           <Trophy size={16} className="text-blue-500" /> Insignias de Experiencia
                         </h4>
                         <div className="flex flex-wrap gap-8">
                            <Badge icon={<Flame size={20} />} label="Fuego Ritual" color="text-orange-500" />
                            <Badge icon={<Wine size={20} />} label="Sumiller Elite" color="text-purple-500" />
                            <Badge icon={<Star size={20} />} label="Héroe OMM" color="text-yellow-500" />
                         </div>
                      </div>
                   </div>
                </div>
             </div>
          </div>
        )}

        {activeTab === 'social' && (
          <div className="animate-in fade-in duration-700 space-y-12">
             <div className="flex flex-col md:flex-row justify-between items-center gap-8 mb-12">
                <div>
                   <h3 className="text-4xl font-black italic uppercase tracking-tighter">Social Intelligence</h3>
                   <p className="text-gray-500 text-xs font-black uppercase tracking-[0.3em] mt-2 italic">Organiza tu círculo gastronómico</p>
                </div>
                <button className="bg-blue-600 hover:bg-blue-500 text-white px-10 py-5 rounded-3xl font-black italic text-[11px] uppercase tracking-widest flex items-center gap-3 transition-all shadow-xl shadow-blue-600/20 active:scale-95">
                   <Plus size={18} /> AÑADIR ACOMPAÑANTE
                </button>
             </div>

             <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                {socialProfiles.map(p => (
                   <div key={p.id} className="bg-[#111114] border border-white/5 rounded-[3.5rem] p-10 shadow-2xl hover:border-blue-500/20 transition-all group">
                      <div className="flex justify-between items-start mb-8">
                         <div className="w-16 h-16 bg-white/5 rounded-2xl flex items-center justify-center text-gray-500 border border-white/5 group-hover:bg-blue-600/10 group-hover:text-blue-500 transition-all">
                            <User size={32} />
                         </div>
                         <span className="text-[10px] font-black uppercase text-blue-500 bg-blue-600/10 px-4 py-1.5 rounded-full italic">{p.relation}</span>
                      </div>
                      <h4 className="text-3xl font-black italic uppercase tracking-tighter mb-4 leading-none">{p.name}</h4>
                      <div className="flex flex-wrap gap-2 mb-8 h-24 content-start overflow-hidden">
                         {p.preferences.map((pref, i) => (
                           <span key={i} className={`px-4 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-tight ${pref.includes('Alergia') ? 'bg-red-500/10 text-red-500' : 'bg-white/5 text-gray-400'}`}>
                              {pref}
                           </span>
                         ))}
                      </div>
                      <button className="w-full bg-white/5 border border-white/10 hover:bg-blue-600 hover:text-white py-4 rounded-2xl font-black text-[9px] uppercase tracking-widest transition-all">
                         DISEÑAR PLAN PARA {p.name.toUpperCase()}
                      </button>
                   </div>
                ))}
                
                {/* Empty State / Add New */}
                <div className="border-4 border-dashed border-white/5 rounded-[3.5rem] p-10 flex flex-col items-center justify-center text-center opacity-40 hover:opacity-100 transition-all cursor-pointer group">
                   <Plus size={48} className="text-gray-500 mb-4 group-hover:scale-110 transition-transform" />
                   <h4 className="text-xl font-black italic uppercase">Crea un Perfil <br/> Invitado</h4>
                   <p className="text-[9px] text-gray-600 font-bold uppercase mt-4 max-w-[180px]">Mapea los gustos de tus amigos para reservas más inteligentes</p>
                </div>
             </div>
          </div>
        )}

      </main>

      {/* Footer B2C Branding */}
      <footer className="mt-40 text-center py-20 border-t border-white/5 bg-black/40">
         <div className="flex flex-col items-center gap-6">
            <Zap size={32} className="text-blue-600" fill="currentColor" />
            <div className="text-[10px] font-black uppercase tracking-[0.5em] text-gray-700 italic">
               EXPERIENCE_OS_BY_NEXUM_CORE
            </div>
         </div>
      </footer>
    </div>
  );
};

const NavBtn = ({ active, onClick, label, icon }: any) => (
  <button 
    onClick={onClick}
    className={`px-8 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-3 ${
      active ? 'bg-blue-600 text-white shadow-xl shadow-blue-600/20' : 'text-gray-500 hover:text-white'
    }`}
  >
    {icon} {label}
  </button>
);

const CategoryBadge = ({ label }: any) => (
  <span className="bg-white/5 border border-white/10 px-4 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest text-gray-400">
    {label}
  </span>
);

const DNAInput = ({ label, active }: any) => (
  <button className={`p-5 rounded-[1.8rem] border-2 transition-all text-left flex flex-col gap-2 ${
    active ? 'bg-blue-600 border-blue-400 text-white shadow-lg' : 'bg-black/40 border-white/5 text-gray-500 hover:border-white/10'
  }`}>
     <span className="text-[10px] font-black uppercase italic leading-none">{label}</span>
  </button>
);

const Badge = ({ icon, label, color }: any) => (
  <div className="flex flex-col items-center gap-3 group cursor-help">
     <div className={`w-14 h-14 bg-[#1a1a1e] border border-white/5 rounded-2xl flex items-center justify-center ${color} group-hover:scale-110 transition-transform shadow-xl`}>
        {icon}
     </div>
     <span className="text-[8px] font-black uppercase text-gray-500 tracking-widest">{label}</span>
  </div>
);

export default OhYeahPage;
