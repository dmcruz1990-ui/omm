
import React, { useState } from 'react';
import { 
  Sparkles, 
  Heart, 
  Briefcase, 
  Zap, 
  ChevronRight,
  MapPin,
  Star,
  UtensilsCrossed,
  MessageSquare,
  Calendar
} from 'lucide-react';
import AIConcierge from './AIConcierge';
import EventsModule from './EventsModule';

const DiscoverModule: React.FC = () => {
  const [showConcierge, setShowConcierge] = useState(false);
  const [view, setView] = useState<'home' | 'events'>('home');

  if (showConcierge) {
    return (
      <div className="h-full flex flex-col items-center justify-center animate-in fade-in duration-700">
        <div className="mb-10 text-center">
          <h2 className="text-4xl font-black italic tracking-tighter uppercase mb-2">Diseña tu noche en <span className="text-blue-500">OMM</span></h2>
          <p className="text-gray-500 text-[10px] font-black uppercase tracking-[0.3em]">Nexum Intelligence Concierge System</p>
        </div>
        <AIConcierge onBack={() => setShowConcierge(false)} />
      </div>
    );
  }

  return (
    <div className="space-y-16 max-w-7xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-1000 pb-20">
      
      {/* --- HERO SECTION --- */}
      <section className="relative h-[450px] flex flex-col items-center justify-center text-center overflow-hidden rounded-[4rem] border border-white/5 bg-[#0d0d0f]">
        <div className="absolute top-0 left-0 w-full h-full">
           <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-blue-600/10 blur-[120px] rounded-full"></div>
           <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-[0.03] pointer-events-none"></div>
        </div>

        <div className="relative z-10 px-6">
          <div className="inline-flex items-center gap-2 bg-blue-600/10 border border-blue-500/20 px-4 py-1.5 rounded-full mb-8">
            <Sparkles size={14} className="text-blue-500" />
            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-blue-400 italic">NEXUM DISCOVER</span>
          </div>
          <h1 className="text-7xl md:text-8xl font-black italic tracking-tighter uppercase mb-4 leading-none">
            Descubre <span className="text-blue-500">OMM</span>
          </h1>
          <p className="text-gray-400 text-lg md:text-xl font-medium max-w-2xl mx-auto leading-relaxed italic">
            Gastronomía Japonesa, Vinos y Ritmo.
          </p>
        </div>
      </section>

      {/* Navegación Interna */}
      <div className="flex justify-center">
         <div className="bg-[#111114] p-2 rounded-2xl border border-white/5 flex gap-2">
            <button 
              onClick={() => setView('home')}
              className={`px-8 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${view === 'home' ? 'bg-blue-600 text-white' : 'text-gray-500 hover:text-white'}`}
            >
               EXPLORAR
            </button>
            <button 
              onClick={() => setView('events')}
              className={`px-8 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${view === 'events' ? 'bg-blue-600 text-white' : 'text-gray-500 hover:text-white'}`}
            >
               EVENTOS PRÓXIMOS
            </button>
         </div>
      </div>

      {view === 'home' ? (
        <>
          {/* --- MASTER EXPERIENCE SECTION --- */}
          <section className="space-y-8">
            <h3 className="text-[10px] font-black text-gray-600 uppercase tracking-[0.4em] flex items-center gap-3 px-2">
              <Star size={14} className="text-yellow-500" /> Experiencia Exclusiva
            </h3>
            
            <div className="group relative bg-[#111114] border border-white/5 rounded-[3.5rem] p-10 overflow-hidden flex flex-col lg:flex-row items-center gap-12 transition-all hover:border-blue-500/30 shadow-2xl">
              <div className="w-full lg:w-1/2 aspect-video bg-gray-900 rounded-[2.5rem] overflow-hidden relative shadow-2xl border border-white/5">
                <img 
                  src="https://images.unsplash.com/photo-1579871494447-9811cf80d66c?q=80&w=2070&auto=format&fit=crop" 
                  alt="OMM Omakase" 
                  className="w-full h-full object-cover opacity-80 group-hover:scale-105 transition-transform duration-700"
                />
                <div className="absolute top-6 left-6 bg-green-500 text-white px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest flex items-center gap-2 shadow-lg">
                  <div className="w-1.5 h-1.5 bg-white rounded-full animate-pulse"></div>
                  Disponible Hoy
                </div>
              </div>

              <div className="flex-1 space-y-8 text-left">
                <div>
                  <h2 className="text-4xl font-black italic tracking-tighter uppercase mb-2">Master Experience</h2>
                  <h4 className="text-2xl font-black italic text-blue-500 tracking-tight">Degustando JAPÓN</h4>
                </div>

                <div className="bg-black/40 p-6 rounded-3xl border border-white/5 space-y-4">
                  <p className="text-sm text-gray-400 leading-relaxed font-medium italic">
                    Menú Omakase de 12 pasos + Maridaje. Mínimo 2 pers.
                  </p>
                  <div className="flex items-center gap-4 text-[10px] text-gray-500 font-bold uppercase tracking-widest">
                    <span className="flex items-center gap-1.5"><MapPin size={14} className="text-blue-500" /> Barra de Sushi (Autopista Norte # 114 - 44)</span>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-4 border-t border-white/5">
                  <div className="flex flex-col">
                    <span className="text-[9px] text-gray-600 font-black uppercase tracking-widest">Inversión</span>
                    <span className="text-3xl font-black italic text-white">$ 284.400 <span className="text-sm text-gray-500">/ persona</span></span>
                  </div>
                  <button className="bg-blue-600 hover:bg-blue-500 text-white px-8 py-4 rounded-2xl font-black italic text-xs uppercase tracking-widest flex items-center gap-3 transition-all shadow-xl shadow-blue-600/20 active:scale-95">
                    RESERVAR <ChevronRight size={16} />
                  </button>
                </div>
              </div>
            </div>
          </section>

          {/* --- CURATED PLANS SECTION --- */}
          <section className="space-y-8">
            <h3 className="text-[10px] font-black text-gray-600 uppercase tracking-[0.4em] flex items-center gap-3 px-2">
              <Zap size={14} className="text-blue-500" /> Planes Curados para Ti
            </h3>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              <CuratedCard 
                icon={<Heart size={28} className="text-red-500" />}
                title="Velada Intima"
                subtitle="Plan Romántico"
                details="Mesa en zona tranquila, carta de vinos, postre compartido y ambiente bajo."
                color="hover:border-red-500/30"
              />
              <CuratedCard 
                icon={<Briefcase size={28} className="text-blue-500" />}
                title="Ejecutivo & Networking"
                subtitle="Plan Negocios"
                details="Menú ejecutivo, conexión WiFi, área de bar para charlar y cócteles rápidos."
                color="hover:border-blue-500/30"
              />
              <CuratedCard 
                icon={<UtensilsCrossed size={28} className="text-green-500" />}
                title="Omakase Express"
                subtitle="Plan Foodie Lover"
                details="Degustación de 7 tiempos en barra chef, sake pairing y sorpresa del chef."
                color="hover:border-green-500/30"
              />
            </div>
          </section>
        </>
      ) : (
        <section className="space-y-8">
          <h3 className="text-[10px] font-black text-gray-600 uppercase tracking-[0.4em] flex items-center gap-3 px-2">
            <Calendar size={14} className="text-blue-500" /> Próximos Eventos OMM
          </h3>
          <EventsModule />
        </section>
      )}

      {/* --- AI CONCIERGE CALL TO ACTION --- */}
      <section className="relative">
        <div className="bg-[#111114] border border-white/5 p-8 md:p-16 rounded-[4rem] flex flex-col items-center justify-center text-center shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-full bg-blue-600/5 blur-[120px] rounded-full"></div>
          
          <div className="relative z-10 space-y-8 max-w-xl animate-in fade-in zoom-in duration-700">
            <div className="w-20 h-20 bg-blue-600/20 rounded-[2rem] flex items-center justify-center mx-auto border border-blue-500/20">
              <MessageSquare size={32} className="text-blue-500" />
            </div>
            <div className="space-y-4">
              <h2 className="text-4xl font-black italic tracking-tighter uppercase leading-none">¿No sabes qué elegir?</h2>
              <p className="text-gray-500 text-sm md:text-base font-medium italic leading-relaxed">
                Nuestro Concierge Inteligente te ayudará a diseñar la noche perfecta en OMM según tus gustos, presupuesto u ocasión especial.
              </p>
            </div>
            <button 
              onClick={() => setShowConcierge(true)}
              className="bg-white text-black hover:bg-blue-600 hover:text-white px-12 py-5 rounded-[2.5rem] font-black italic text-xs uppercase tracking-[0.2em] transition-all shadow-2xl flex items-center gap-4 mx-auto group active:scale-95"
            >
              HABLAR CON NEXUM <ChevronRight size={18} className="group-hover:translate-x-1 transition-transform" />
            </button>
          </div>
        </div>
      </section>
    </div>
  );
};

const CuratedCard = ({ icon, title, subtitle, details, color }: { icon: any, title: string, subtitle: string, details: string, color: string }) => (
  <div className={`bg-[#111114] border border-white/5 p-10 rounded-[3rem] text-left transition-all group ${color} hover:bg-white/5 shadow-xl`}>
    <div className="bg-black/40 w-16 h-16 rounded-3xl flex items-center justify-center mb-8 shadow-xl border border-white/5">
      {icon}
    </div>
    <div className="space-y-2 mb-6">
      <span className="text-[9px] text-blue-500 font-black uppercase tracking-widest">{subtitle}</span>
      <h4 className="text-2xl font-black italic uppercase tracking-tighter leading-none group-hover:text-blue-400 transition-colors">
        {title}
      </h4>
    </div>
    <p className="text-[11px] text-gray-500 font-medium leading-relaxed italic border-t border-white/5 pt-6">
      {details}
    </p>
  </div>
);

export default DiscoverModule;
