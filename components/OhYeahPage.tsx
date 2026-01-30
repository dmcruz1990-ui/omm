
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
  Compass,
  Eye,
  Crown,
  Key,
  ShieldCheck,
  Activity,
  History,
  X,
  HelpCircle,
  Info,
  Dna
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
  const [showSocietyInfo, setShowSocietyInfo] = useState(false);
  
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
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: `Analiza este mood de cliente: "${mood}". 
        Marcas disponibles: OMM (Kaiseki/Mantra), Seratta (Gourmet), Viva la Vida (Tapas). 
        Prioriza las mesas con "baja ocupación". 
        Genera un plan de noche en formato JSON: { "brand": "OMM", "plan": "Nombre del Plan", "reason": "Por qué es perfecto", "gift": "Cortesía sugerida" }`,
        config: { responseMimeType: "application/json" }
      });
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
      
      {/* Society Info Modal */}
      {showSocietyInfo && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-6 md:p-12 animate-in fade-in duration-500 backdrop-blur-3xl overflow-y-auto custom-scrollbar">
          <div className="absolute inset-0 bg-black/90" onClick={() => setShowSocietyInfo(false)}></div>
          <div className="bg-[#0d0d0f] border border-white/10 rounded-[3.5rem] w-full max-w-5xl relative z-10 overflow-hidden shadow-[0_0_100px_rgba(0,0,0,0.5)] flex flex-col">
            <div className="p-10 border-b border-white/5 flex justify-between items-center bg-gradient-to-r from-blue-600/10 to-transparent">
              <div className="flex items-center gap-4">
                <Trophy size={24} className="text-blue-500" />
                <h3 className="text-3xl font-black italic uppercase tracking-tighter">Gourmand Society</h3>
              </div>
              <button onClick={() => setShowSocietyInfo(false)} className="bg-white/5 p-3 rounded-full hover:bg-white/10 transition-all">
                <X size={24} />
              </button>
            </div>
            
            <div className="p-10 md:p-16 space-y-20 overflow-y-auto max-h-[75vh] custom-scrollbar">
              {/* Filosofía */}
              <section className="space-y-6">
                <h4 className="text-blue-500 text-[10px] font-black uppercase tracking-[0.4em] italic">La Filosofía</h4>
                <h2 className="text-5xl font-black italic uppercase tracking-tighter leading-none">¿Cómo funciona?</h2>
                <p className="text-gray-400 text-lg italic leading-relaxed max-w-2xl">
                  La Gourmand Society es nuestro sistema de reconocimiento para quienes viven nuestros venues con criterio, respeto y curiosidad. No es una membresía. No se compra. No se solicita. <span className="text-white font-bold">Se construye con cada experiencia.</span>
                </p>
              </section>

              {/* Los Niveles */}
              <section className="space-y-12">
                <h4 className="text-blue-500 text-[10px] font-black uppercase tracking-[0.4em] italic">Los Niveles</h4>
                <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                  <LevelStep name="UMBRAL" active />
                  <LevelStep name="CONSAGRADO" />
                  <LevelStep name="CATADOR" />
                  <LevelStep name="SUPREMO" />
                  <LevelStep name="ULTRA VIP" />
                </div>
              </section>

              {/* Cómo Subir */}
              <section className="bg-white/5 rounded-[3rem] p-12 border border-white/5 grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
                <div className="space-y-8">
                  <h3 className="text-3xl font-black italic uppercase tracking-tighter leading-none">¿Cómo subir de nivel?</h3>
                  <p className="text-gray-400 text-sm italic leading-relaxed">
                    Nuestros venues observan cómo vives la experiencia, no solo cuánto consumes. Subes cuando visitas con frecuencia, pruebas diversidad de platos y bebidas, respetas el ritual y recomiendas a otros.
                  </p>
                  <div className="bg-blue-600/20 border border-blue-500/20 px-6 py-4 rounded-2xl">
                    <p className="text-blue-400 text-[10px] font-black uppercase tracking-widest italic">Avance Sensorial</p>
                    <p className="text-white text-sm font-bold italic mt-1">No hay puntos visibles. El avance se siente.</p>
                  </div>
                </div>
                <div className="space-y-4">
                  <SocietyGoal label="Visitar con frecuencia" />
                  <SocietyGoal label="Diversidad de consumo" />
                  <SocietyGoal label="Respetar el Ritual" />
                  <SocietyGoal label="Traer invitados nuevos" />
                  <SocietyGoal label="Asistir a lanzamientos" />
                </div>
              </section>

              {/* Detalles por Nivel */}
              <section className="space-y-16">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                  <BenefitCard 
                    title="UMBRAL" 
                    subtitle="Has entrado al ecosistema." 
                    benefits={["Acceso a reservas estándar", "Invitaciones abiertas", "Detalles ocasionales"]}
                  />
                  <BenefitCard 
                    title="CONSAGRADO" 
                    subtitle="Nuestros venues ya te reconocen." 
                    benefits={["Acceso anticipado a reservas", "Mejores mesas cuando es posible", "Invitaciones selectas", "Flexibilidad ocasional"]}
                  />
                  <BenefitCard 
                    title="CATADOR" 
                    subtitle="Tu criterio importa." 
                    benefits={["Acceso a horarios no visibles", "Reservas con sistema lleno (lim)", "Invitaciones privadas", "Pruebas de platos/cócteles"]}
                  />
                  <BenefitCard 
                    title="SUPREMO" 
                    subtitle="Relación cercana con la casa." 
                    benefits={["Mesa garantizada en fechas clave", "Flexibilidad amplia", "Experiencias exclusivas", "Trato directo con gerencia"]}
                  />
                  <BenefitCard 
                    title="ULTRA VIP" 
                    subtitle="Existe. No se persigue." 
                    benefits={["Acceso total a todos los venues", "Mesa garantizada siempre", "Horarios especiales", "Experiencias personalizadas"]}
                    special
                  />
                </div>
              </section>

              {/* Reglas de Oro */}
              <section className="border-t border-white/5 pt-16 flex flex-col items-center text-center space-y-8">
                 <div className="w-16 h-16 bg-blue-600 rounded-2xl flex items-center justify-center shadow-xl shadow-blue-600/30">
                    <ShieldCheck size={32} className="text-white" />
                 </div>
                 <h3 className="text-3xl font-black italic uppercase tracking-tighter">Reglas de la Sociedad</h3>
                 <div className="flex flex-wrap justify-center gap-12 max-w-3xl">
                    <RuleItem text="Nadie puede pedir subir de nivel" />
                    <RuleItem text="Nadie puede comprar su estatus" />
                    <RuleItem text="No todos avanzan al mismo ritmo" />
                    <RuleItem text="Niveles superiores extremadamente limitados" />
                 </div>
                 <p className="text-blue-500 font-black italic text-xl uppercase tracking-tighter mt-12">
                   "Nuestros venues recuerdan a quienes saben vivirlos."
                 </p>
              </section>
            </div>
          </div>
        </div>
      )}

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
           <NavBtn active={activeTab === 'profile'} onClick={() => setActiveTab('profile')} label="GOURMAND SOCIETY" icon={<Trophy size={14} />} />
           <NavBtn active={activeTab === 'social'} onClick={() => setActiveTab('social')} label="SOCIAL HUB" icon={<Users size={14} />} />
        </nav>

        <div className="flex items-center gap-6">
           <div className="hidden md:flex flex-col items-end">
              <span className="text-[8px] text-gray-500 font-black uppercase tracking-widest leading-none mb-1">Estatus Gourmand</span>
              <div className="flex items-center gap-2">
                 <div className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse"></div>
                 <span className="text-xs font-black italic text-blue-500 uppercase tracking-tighter">{profile?.loyalty_level || 'UMBRAL'}</span>
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

             {/* Marcas Destacadas */}
             <section className="space-y-12">
                <div className="flex items-center justify-between">
                   <div>
                      <h3 className="text-2xl font-black italic uppercase tracking-tighter">Nuestras Casas</h3>
                      <p className="text-gray-500 text-[10px] font-black uppercase tracking-[0.4em] italic">Explora experiencias curadas</p>
                   </div>
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
          </div>
        )}

        {activeTab === 'profile' && (
          <div className="animate-in fade-in duration-700 space-y-16">
             <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
                
                {/* GOURMAND CARD */}
                <div className="bg-gradient-to-br from-[#1a1a1e] to-[#0a0a0c] border border-white/10 rounded-[4rem] p-12 shadow-2xl relative overflow-hidden h-[650px] flex flex-col justify-between group">
                   <div className="absolute top-0 right-0 p-12 opacity-10 group-hover:scale-110 transition-transform">
                      {profile?.loyalty_level === 'SUPREMO' ? <Crown size={180} /> : profile?.loyalty_level === 'CATADOR' ? <Eye size={180} /> : <Zap size={180} className="text-blue-500" fill="currentColor" />}
                   </div>
                   
                   <div className="space-y-8 relative z-10">
                      <div className="w-24 h-24 rounded-full border-4 border-blue-500 p-1">
                         <img src={`https://i.pravatar.cc/150?u=${profile?.id}`} className="w-full h-full rounded-full object-cover grayscale" />
                      </div>
                      <div className="flex flex-col items-start gap-4">
                         <div>
                            <h3 className="text-5xl font-black italic uppercase tracking-tighter leading-none mb-2">{profile?.full_name || 'Gourmand'}</h3>
                            <p className="text-gray-500 font-black uppercase tracking-[0.3em] text-[10px] italic">Societatem Gastronomicam Seratta</p>
                         </div>
                         <button 
                          onClick={() => setShowSocietyInfo(true)}
                          className="bg-blue-600/10 hover:bg-blue-600/20 text-blue-500 px-5 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest flex items-center gap-2 border border-blue-500/20 transition-all"
                         >
                            <HelpCircle size={14} /> ¿CÓMO FUNCIONA?
                         </button>
                      </div>
                   </div>

                   <div className="space-y-10 relative z-10">
                      <div>
                         <span className="text-[10px] font-black text-gray-600 uppercase tracking-widest block mb-4">Rango Actual</span>
                         <h2 className="text-6xl font-black italic uppercase tracking-tighter text-blue-500 leading-none">
                            {profile?.loyalty_level || 'UMBRAL'}
                         </h2>
                      </div>

                      <div className="bg-white/5 border border-white/10 p-6 rounded-3xl backdrop-blur-md">
                         <p className="text-sm text-gray-300 italic leading-relaxed">
                            "Has cruzado la puerta. La casa comienza a reconocer tu presencia. Tu relación con el ritual gastronómico está en evolución constante."
                         </p>
                      </div>

                      <div className="flex items-center gap-4 text-gray-500">
                         <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse"></div>
                         <span className="text-[10px] font-black uppercase tracking-widest italic">La casa observa tu progreso</span>
                      </div>
                   </div>
                </div>

                {/* Status Feedback */}
                <div className="lg:col-span-2 space-y-12">
                   <div className="flex items-center justify-between">
                      <h3 className="text-3xl font-black italic uppercase tracking-tighter">Estado de Reconocimiento</h3>
                      <Activity size={24} className="text-blue-500" />
                   </div>

                   <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                      <StatusFeedbackCard 
                        icon={<Key size={24} />} 
                        label="Acceso y Prioridad" 
                        status="Nivel 1 Activado" 
                        desc="Prioridad leve frente a walk-ins. Acceso a reservas estándar."
                      />
                      <StatusFeedbackCard 
                        icon={<Heart size={24} />} 
                        label="Gestos de la Casa" 
                        status="Activo" 
                        desc="Detalles ocasionales y saludos personalizados del equipo."
                      />
                      <StatusFeedbackCard 
                        icon={<Eye size={24} />} 
                        label="Criterio Valorado" 
                        status="Pendiente" 
                        desc="Tus feedbacks serán analizados por gerencia al llegar a Catador."
                        locked
                      />
                      <StatusFeedbackCard 
                        icon={<Crown size={24} />} 
                        label="Autoridad Supremo" 
                        status="Bloqueado" 
                        desc="Mesa garantizada y trato directo con directores del grupo."
                        locked
                      />
                   </div>

                   {/* Ritual History */}
                   <div className="space-y-8 pt-8">
                      <h3 className="text-xl font-black italic uppercase flex items-center gap-3">
                         <History size={20} className="text-gray-500" /> Hitos Rituales Recientes
                      </h3>
                      <div className="space-y-4">
                         <RitualRow venue="OMM" date="Ayer" detail="Cena Ritual Kaiseki" impact="Influencia de Rango +" />
                         <RitualRow venue="Seratta" date="Hace 2 semanas" detail="Cata de Vinos Clandestina" impact="Conocimiento Consagrado" />
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
                   <h3 className="text-4xl font-black italic uppercase tracking-tighter">Círculo Gastronómico</h3>
                   <p className="text-gray-500 text-xs font-black uppercase tracking-[0.3em] mt-2 italic">Traer invitados alimenta tu alma Gourmand</p>
                </div>
                <button className="bg-blue-600 hover:bg-blue-500 text-white px-10 py-5 rounded-3xl font-black italic text-[11px] uppercase tracking-widest flex items-center gap-3 transition-all shadow-xl shadow-blue-600/20 active:scale-95">
                   <Plus size={18} /> MAPEAR INVITADO
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
             </div>
          </div>
        )}

      </main>

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

const StatusFeedbackCard = ({ icon, label, status, desc, locked }: any) => (
  <div className={`p-8 rounded-[2.5rem] border-2 transition-all flex flex-col gap-6 ${locked ? 'bg-black/40 border-white/5 opacity-40' : 'bg-[#111114] border-blue-500/20 shadow-xl shadow-blue-900/5'}`}>
     <div className={`w-14 h-14 rounded-2xl flex items-center justify-center ${locked ? 'bg-white/5 text-gray-600' : 'bg-blue-600 text-white'}`}>
        {icon}
     </div>
     <div>
        <div className="flex items-center justify-between mb-1">
           <span className="text-xs font-black uppercase tracking-widest">{label}</span>
           {!locked && <CheckCircle2 size={14} className="text-green-500" />}
        </div>
        <span className={`text-[9px] font-black uppercase italic ${locked ? 'text-gray-600' : 'text-blue-400'}`}>{status}</span>
        <p className="text-[11px] text-gray-500 font-medium italic leading-relaxed mt-4">{desc}</p>
     </div>
  </div>
);

const RitualRow = ({ venue, date, detail, impact }: any) => (
  <div className="bg-white/5 border border-white/5 p-6 rounded-3xl flex flex-col md:flex-row justify-between items-center gap-4 group hover:bg-white/10 transition-all">
     <div className="flex items-center gap-6">
        <div className="w-12 h-12 bg-black rounded-2xl flex items-center justify-center text-blue-500 font-black italic">
           {venue[0]}
        </div>
        <div>
           <h4 className="text-sm font-black uppercase italic text-white leading-none">{detail}</h4>
           <span className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">{venue} • {date}</span>
        </div>
     </div>
     <div className="bg-blue-600/10 px-4 py-1.5 rounded-full border border-blue-500/20">
        <span className="text-[8px] font-black text-blue-400 uppercase tracking-widest">{impact}</span>
     </div>
  </div>
);

const LevelStep = ({ name, active }: { name: string, active?: boolean }) => (
  <div className={`p-4 rounded-2xl border flex flex-col items-center gap-3 transition-all ${active ? 'bg-blue-600 border-blue-400 shadow-xl' : 'bg-white/5 border-white/10 opacity-40'}`}>
     <div className={`w-2 h-2 rounded-full ${active ? 'bg-white animate-pulse' : 'bg-gray-600'}`}></div>
     <span className="text-[9px] font-black uppercase italic text-center">{name}</span>
  </div>
);

const SocietyGoal = ({ label }: { label: string }) => (
  <div className="flex items-center gap-4 group">
     <div className="w-6 h-6 rounded-full bg-blue-600/20 border border-blue-500/30 flex items-center justify-center group-hover:bg-blue-600 transition-all">
        <CheckCircle2 size={12} className="text-blue-500 group-hover:text-white" />
     </div>
     <span className="text-sm font-bold italic text-gray-300 uppercase tracking-tight">{label}</span>
  </div>
);

const BenefitCard = ({ title, subtitle, benefits, special }: any) => (
  <div className={`p-10 rounded-[3rem] border-2 transition-all flex flex-col gap-6 ${special ? 'bg-gradient-to-br from-blue-600/20 to-purple-600/20 border-blue-500/30 shadow-2xl' : 'bg-white/5 border-white/5'}`}>
     <div>
        <h5 className="text-2xl font-black italic uppercase tracking-tighter text-white mb-2">{title}</h5>
        <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">{subtitle}</p>
     </div>
     <ul className="space-y-3">
        {benefits.map((b: string, i: number) => (
           <li key={i} className="flex items-center gap-3 text-xs italic text-gray-300">
              <div className="w-1 h-1 bg-blue-500 rounded-full"></div>
              {b}
           </li>
        ))}
     </ul>
  </div>
);

const RuleItem = ({ text }: { text: string }) => (
  <div className="flex items-center gap-3">
     <Info size={14} className="text-gray-600" />
     <span className="text-[10px] font-black uppercase text-gray-500 tracking-widest">{text}</span>
  </div>
);

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

export default OhYeahPage;
