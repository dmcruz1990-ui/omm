
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase.ts';
import { 
  Zap, 
  Sparkles, 
  Calendar, 
  ChevronRight, 
  Star, 
  Loader2, 
  MessageCircle,
  Wine,
  Gift,
  Ticket,
  Users,
  Search,
  CheckCircle2,
  Trophy,
  Compass,
  Award,
  Briefcase,
  TrendingUp,
  BadgeCheck,
  UserCheck,
  Play,
  Info,
  ChevronLeft,
  Heart,
  Plus,
  LayoutDashboard,
  Coins,
  Crown,
  MapPin,
  Flame,
  // Fix: Added missing Clock and Lock icons to imports from lucide-react
  Clock,
  Lock
} from 'lucide-react';
import { OmmEvent, Brand } from '../types.ts';
import { useAuth } from '../contexts/AuthContext.tsx';

const OhYeahPage: React.FC = () => {
  const { profile } = useAuth();
  const [activeTab, setActiveTab] = useState<'discover' | 'profile' | 'social'>('discover');
  const [brands, setBrands] = useState<Brand[]>([]);
  const [events, setEvents] = useState<OmmEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [isScrolled, setIsScrolled] = useState(false);
  
  const userPoints = 2450; // Mock de puntos

  useEffect(() => {
    fetchGlobalData();
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 50);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const fetchGlobalData = async () => {
    setLoading(true);
    try {
      const { data: b } = await supabase.from('brands').select('*');
      const { data: e } = await supabase.from('events').select('*');
      setBrands(b || []);
      setEvents(e || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const isStaff = profile && ['admin', 'gerencia', 'mesero', 'chef', 'desarrollo'].includes(profile.role);

  if (loading) return (
    <div className="h-screen w-full bg-[#050505] flex flex-col items-center justify-center">
       <Loader2 className="text-blue-600 animate-spin mb-4" size={48} />
       <p className="text-[10px] font-black uppercase tracking-[0.3em] text-gray-500 italic">Iniciando Experiencia Netflix OMM...</p>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#050505] text-white font-sans selection:bg-blue-600">
      
      {/* Header Netflix Style */}
      <header className={`fixed top-0 left-0 right-0 h-20 z-[100] px-8 md:px-16 flex items-center justify-between transition-all duration-500 ${isScrolled ? 'bg-[#050505]' : 'bg-transparent'}`}>
        <div className="flex items-center gap-10">
           <div className="flex items-center gap-2 cursor-pointer" onClick={() => window.scrollTo({top: 0, behavior: 'smooth'})}>
              <Zap size={24} className="text-blue-600" fill="currentColor" />
              <h1 className="text-2xl font-black italic tracking-tighter uppercase leading-none">OH YEAH!</h1>
           </div>
           <nav className="hidden lg:flex items-center gap-6">
              <NavBtn active={activeTab === 'discover'} onClick={() => setActiveTab('discover')} label="Inicio" />
              <NavBtn active={activeTab === 'social'} onClick={() => setActiveTab('social')} label="Social Hub" />
              <NavBtn active={activeTab === 'profile'} onClick={() => setActiveTab('profile')} label="Mis Beneficios" />
           </nav>
        </div>

        <div className="flex items-center gap-6">
           {isStaff && (
             <button 
              onClick={() => window.location.hash = ''}
              className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest flex items-center gap-2 shadow-lg transition-all"
             >
                <LayoutDashboard size={14} /> 
                <span className="hidden sm:inline">REGRESAR AL SISTEMA</span>
             </button>
           )}
           <Search size={20} className="text-gray-400 cursor-pointer hover:text-white" />
           <div className="w-8 h-8 rounded bg-blue-600 flex items-center justify-center cursor-pointer">
              <Users size={16} />
           </div>
        </div>
      </header>

      <main className="pb-32">
        {activeTab === 'discover' && (
          <div className="animate-in fade-in duration-1000">
             <section className="relative h-[85vh] w-full flex flex-col justify-end px-8 md:px-16 pb-24 overflow-hidden">
                <div className="absolute inset-0 z-0">
                   <img src="https://images.unsplash.com/photo-1553621042-f6e147245754?q=80&w=2050&auto=format&fit=crop" className="w-full h-full object-cover" alt="Featured" />
                   <div className="absolute inset-0 bg-gradient-to-t from-[#050505] via-transparent to-transparent"></div>
                   <div className="absolute inset-0 bg-gradient-to-r from-[#050505]/60 via-transparent to-transparent"></div>
                </div>
                <div className="relative z-10 max-w-2xl space-y-6">
                   <div className="flex items-center gap-2 mb-4">
                      <Zap size={20} className="text-blue-500" fill="currentColor" />
                      <span className="text-sm font-black uppercase tracking-[0.3em] text-white">RECOMENDADO PARA TI</span>
                   </div>
                   <h2 className="text-6xl md:text-8xl font-black italic tracking-tighter uppercase leading-[0.9]">OMAKASE <br/> <span className="text-blue-600">RITUAL.</span></h2>
                   <p className="text-lg text-gray-200 font-medium italic leading-relaxed max-w-lg">Una inmersión de 12 pasos donde cada ingrediente cuenta una historia. Tu nivel CONSAGRADO te da 15% de puntos extra hoy.</p>
                   <div className="flex gap-4 pt-6">
                      <button className="bg-white text-black px-8 py-3 rounded-md font-black flex items-center gap-3 hover:bg-gray-200 transition-all"><Play size={20} fill="black" /> RESERVAR</button>
                      <button className="bg-gray-500/40 backdrop-blur-md text-white px-8 py-3 rounded-md font-black flex items-center gap-3 hover:bg-gray-500/60 transition-all border border-white/10"><Info size={20} /> MÁS INFO</button>
                   </div>
                </div>
             </section>

             <div className="relative z-20 -mt-20 space-y-12 pl-8 md:pl-16">
                <ContentRow title="Eventos de la Semana" items={events.slice(0, 5)} />
                <ContentRow title="NEXUM Inteligencia: Lo que amamos hoy" items={events.slice(2, 6)} />
             </div>
          </div>
        )}

        {activeTab === 'social' && (
           <div className="pt-32 px-8 md:px-16 animate-in slide-in-from-bottom-4 duration-700 space-y-16">
              {/* Perfil de Fidelización */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
                 <div className="lg:col-span-2 bg-gradient-to-br from-blue-900/40 to-blue-600/10 border border-blue-500/20 rounded-[3rem] p-12 relative overflow-hidden shadow-2xl">
                    <div className="absolute top-0 right-0 p-12 opacity-5"><Coins size={200} className="text-blue-400" /></div>
                    <div className="relative z-10 flex flex-col md:flex-row items-center gap-10">
                       <div className="relative">
                          <div className="w-32 h-32 rounded-full border-4 border-blue-500 p-1">
                             <img src="https://i.pravatar.cc/300?u=customer" className="w-full h-full rounded-full object-cover" alt="Avatar" />
                          </div>
                          <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 bg-blue-600 text-white px-3 py-1 rounded-full text-[8px] font-black uppercase tracking-widest">CONSAGRADO</div>
                       </div>
                       <div className="flex-1 text-center md:text-left space-y-4">
                          <h2 className="text-4xl font-black italic uppercase tracking-tighter">Bienvenido, {profile?.full_name || 'Invitado'}</h2>
                          <div className="flex flex-wrap justify-center md:justify-start gap-6">
                             <div>
                                <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest block mb-1">Puntos Seratta</span>
                                <span className="text-3xl font-black italic text-blue-500">{userPoints.toLocaleString()} PTS</span>
                             </div>
                             <div className="w-[1px] bg-white/10 hidden md:block"></div>
                             <div>
                                <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest block mb-1">Visitas del Mes</span>
                                <span className="text-3xl font-black italic text-white">04</span>
                             </div>
                          </div>
                       </div>
                       <div className="bg-black/40 p-6 rounded-3xl border border-white/5 text-center">
                          <p className="text-[9px] font-black text-blue-400 uppercase mb-3">Tu Siguiente Nivel</p>
                          <div className="w-32 h-2 bg-white/5 rounded-full overflow-hidden mb-2">
                             <div className="h-full bg-blue-500" style={{ width: '65%' }}></div>
                          </div>
                          <span className="text-[8px] text-gray-500 font-bold uppercase">A 550 pts de CATADOR</span>
                       </div>
                    </div>
                 </div>
                 
                 <div className="bg-[#111114] border border-white/5 rounded-[3rem] p-10 flex flex-col justify-center gap-6 shadow-2xl">
                    <h3 className="text-xl font-black italic uppercase tracking-tighter flex items-center gap-2">
                       <Flame size={20} className="text-orange-500" /> Hot Streak
                    </h3>
                    <p className="text-sm text-gray-400 italic">Has visitado <strong>OMM</strong> y <strong>Seratta</strong> 3 fines de semana seguidos. ¡Tienes un coctel de cortesía esperándote!</p>
                    <button className="w-full bg-orange-600 hover:bg-orange-500 text-white py-4 rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all">CANJEAR AHORA</button>
                 </div>
              </div>

              {/* Agenda Semanal */}
              <div className="space-y-8">
                 <div className="flex items-center justify-between border-b border-white/5 pb-6">
                    <h3 className="text-2xl font-black italic uppercase tracking-tighter flex items-center gap-3">
                       <Calendar size={24} className="text-blue-500" /> Agenda de la Semana
                    </h3>
                    <span className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Marzo 10 - Marzo 16</span>
                 </div>
                 <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
                    <WeeklyEvent day="VIE" title="KAISEKI BEATS" venue="Terraza OMM" time="08:00 PM" img="https://images.unsplash.com/photo-1514525253361-bee8718a300a?q=80&w=400" />
                    <WeeklyEvent day="SAB" title="SAKE TASTING" venue="Cava Privada" time="06:30 PM" img="https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?q=80&w=400" />
                    <WeeklyEvent day="DOM" title="BRUNCH RITUAL" venue="Main Hall" time="11:00 AM" img="https://images.unsplash.com/photo-1504674900247-0877df9cc836?q=80&w=400" />
                    <WeeklyEvent day="LUN" title="ZEN MONDAY" venue="All Venues" time="All Day" img="https://images.unsplash.com/photo-1519708227418-c8fd9a32b7a2?q=80&w=400" />
                 </div>
              </div>
           </div>
        )}

        {activeTab === 'profile' && (
           <div className="pt-32 px-8 md:px-16 animate-in fade-in duration-700 space-y-12">
              <div className="max-w-4xl mx-auto text-center space-y-4">
                 <h2 className="text-5xl font-black italic uppercase tracking-tighter">Seratta Elite <span className="text-blue-500">Benefits</span></h2>
                 <p className="text-gray-400 text-lg italic">Entre más vivas el ritual, más privilegios desbloqueas en nuestro ecosistema.</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                 <TierCard 
                    level="UMBRAL" 
                    points="0 - 1,000" 
                    perks={['Acumulación básica (1x)', 'Newsletter VIP', 'Acceso a eventos públicos']} 
                    status="completed"
                 />
                 <TierCard 
                    level="CONSAGRADO" 
                    points="1,000 - 5,000" 
                    perks={['Acumulación 1.5x', 'Mesa prioritaria', 'Coctel de bienvenida', '15% Off en eventos']} 
                    status="active"
                    current
                 />
                 <TierCard 
                    level="SUPREMO" 
                    points="5,000+" 
                    perks={['Acumulación 2x', 'Concierge Personalizado', 'Cenas en Cava sin costo base', 'Valet Parking cortesía']} 
                    status="locked"
                 />
              </div>

              <div className="bg-blue-600 p-12 rounded-[4rem] flex flex-col md:flex-row items-center justify-between gap-8 shadow-2xl relative overflow-hidden">
                 <div className="absolute top-0 right-0 p-12 opacity-10"><Crown size={150} fill="white" /></div>
                 <div className="relative z-10 space-y-2">
                    <h3 className="text-3xl font-black italic uppercase tracking-tighter leading-none">¿Tienes una celebración?</h3>
                    <p className="text-blue-100 italic">Tus beneficios CONSAGRADO te dan una torta de autoría y decoración zen gratis este mes.</p>
                 </div>
                 <button className="bg-white text-blue-600 px-12 py-4 rounded-full font-black uppercase tracking-widest text-xs shadow-xl transition-all hover:scale-105">RESERVAR CELEBRACIÓN</button>
              </div>
           </div>
        )}
      </main>

      <footer className="mt-20 px-8 md:px-16 py-12 border-t border-white/5 bg-[#050505]">
         <div className="flex flex-col md:flex-row justify-between items-center gap-8 opacity-40">
            <div className="flex items-center gap-2">
               <Zap size={20} className="text-blue-600" fill="currentColor" />
               <span className="text-[10px] font-black uppercase tracking-[0.3em]">SERATTA UNIVERSE © 2025</span>
            </div>
            <div className="flex gap-8 text-[10px] font-bold uppercase tracking-widest">
               <a href="#" className="hover:text-blue-500 transition-colors">Términos</a>
               <a href="#" className="hover:text-blue-500 transition-colors">Privacidad</a>
               <a href="#" className="hover:text-blue-500 transition-colors">Soporte</a>
            </div>
         </div>
      </footer>
    </div>
  );
};

const ContentRow = ({ title, items }: { title: string, items: any[] }) => {
  const scrollRef = useRef<HTMLDivElement>(null);
  const scroll = (direction: 'left' | 'right') => {
    if (scrollRef.current) {
      const { scrollLeft, clientWidth } = scrollRef.current;
      const scrollTo = direction === 'left' ? scrollLeft - clientWidth : scrollLeft + clientWidth;
      scrollRef.current.scrollTo({ left: scrollTo, behavior: 'smooth' });
    }
  };
  return (
    <div className="space-y-4 group/row">
      <h3 className="text-xl font-black italic tracking-tighter uppercase text-gray-200 group-hover/row:text-white transition-colors">{title}</h3>
      <div className="relative">
        <button onClick={() => scroll('left')} className="absolute left-0 top-0 bottom-0 z-40 bg-black/40 px-2 opacity-0 group-hover/row:opacity-100 transition-opacity hover:bg-black/60"><ChevronLeft size={32} /></button>
        <div ref={scrollRef} className="flex gap-4 overflow-x-auto scroll-smooth no-scrollbar snap-x snap-mandatory">
          {items.map((item, idx) => (
            <div key={idx} className="min-w-[300px] md:min-w-[350px] aspect-video relative rounded-md overflow-hidden snap-start group cursor-pointer transition-all duration-300 hover:scale-105 hover:z-30">
               <img src={item.image_url || 'https://images.unsplash.com/photo-1514525253361-bee8718a300a?q=80&w=400'} className="w-full h-full object-cover group-hover:brightness-50 transition-all" alt={item.title} />
               <div className="absolute inset-0 p-6 flex flex-col justify-end opacity-0 group-hover:opacity-100 transition-opacity bg-gradient-to-t from-black/80 to-transparent">
                  <div className="flex gap-2 mb-2">
                     <span className="text-[8px] font-black bg-blue-600 px-2 py-0.5 rounded uppercase">{item.category}</span>
                     <span className="text-[8px] font-black border border-white/40 px-2 py-0.5 rounded uppercase">Exclusive</span>
                  </div>
                  <h4 className="text-lg font-black italic uppercase leading-tight">{item.title}</h4>
               </div>
            </div>
          ))}
        </div>
        <button onClick={() => scroll('right')} className="absolute right-0 top-0 bottom-0 z-40 bg-black/40 px-2 opacity-0 group-hover/row:opacity-100 transition-opacity hover:bg-black/60"><ChevronRight size={32} /></button>
      </div>
    </div>
  );
};

const WeeklyEvent = ({ day, title, venue, time, img }: any) => (
  <div className="bg-[#111114] rounded-2xl overflow-hidden border border-white/5 group hover:border-blue-500/40 transition-all">
     <div className="h-32 overflow-hidden relative">
        <img src={img} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700 opacity-60" alt={title} />
        <div className="absolute top-4 left-4 bg-blue-600 text-white w-10 h-10 rounded-xl flex flex-col items-center justify-center font-black italic text-xs leading-none">
           <span>{day}</span>
        </div>
     </div>
     <div className="p-6 space-y-2">
        <h4 className="text-lg font-black italic uppercase text-white leading-tight">{title}</h4>
        <div className="flex items-center gap-2 text-[9px] font-bold text-gray-500 uppercase tracking-widest">
           <MapPin size={10} className="text-blue-500" /> {venue}
        </div>
        <div className="flex items-center gap-2 text-[9px] font-bold text-gray-500 uppercase tracking-widest">
           <Clock size={10} className="text-blue-500" /> {time}
        </div>
     </div>
  </div>
);

const TierCard = ({ level, points, perks, status, current }: any) => (
  <div className={`p-10 rounded-[3rem] border-2 transition-all flex flex-col justify-between min-h-[450px] ${
    current ? 'bg-blue-600/10 border-blue-500 shadow-2xl' : status === 'locked' ? 'bg-[#111114] border-white/5 opacity-40' : 'bg-[#111114] border-blue-500/20'
  }`}>
     <div className="space-y-8">
        <div className="flex justify-between items-start">
           <div>
              <span className="text-[10px] font-black text-blue-500 uppercase tracking-widest block mb-1">Rango SERATTA</span>
              <h4 className="text-3xl font-black italic uppercase tracking-tighter text-white leading-none">{level}</h4>
           </div>
           {status === 'completed' ? <CheckCircle2 className="text-green-500" size={24} /> : 
            status === 'locked' ? <Lock className="text-gray-700" size={24} /> : <Zap className="text-blue-500 animate-pulse" size={24} />}
        </div>
        
        <div className="space-y-4">
           {perks.map((p: string, idx: number) => (
             <div key={idx} className="flex items-center gap-3">
                <div className="w-1.5 h-1.5 rounded-full bg-blue-500"></div>
                <span className="text-[11px] font-medium italic text-gray-300">{p}</span>
             </div>
           ))}
        </div>
     </div>

     <div className="mt-10 pt-8 border-t border-white/5">
        <span className="text-[9px] font-black text-gray-500 uppercase block mb-1">{points} PTS</span>
        {current && (
           <div className="bg-blue-600 text-white py-3 rounded-2xl text-[9px] font-black uppercase text-center tracking-widest italic">NIVEL ACTUAL</div>
        )}
     </div>
  </div>
);

const NavBtn = ({ active, onClick, label }: any) => (
  <button onClick={onClick} className={`text-sm font-bold transition-all ${active ? 'text-white border-b-2 border-blue-600 pb-1' : 'text-gray-400 hover:text-gray-200'}`}>
    {label}
  </button>
);

export default OhYeahPage;
