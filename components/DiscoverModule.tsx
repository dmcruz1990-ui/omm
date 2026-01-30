
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
  Calendar,
  Smartphone,
  Share2
} from 'lucide-react';
import AIConcierge from './AIConcierge.tsx';
import EventsModule from './EventsModule.tsx';

const DiscoverModule: React.FC = () => {
    const [showConcierge, setShowConcierge] = useState(false);
    const [view, setView] = useState<'home' | 'events'>('home');

    if (showConcierge) {
        return (
            <div className="h-full flex flex-col items-center justify-center animate-in fade-in duration-700">
                <div className="mb-10 text-center">
                    <h2 className="text-4xl font-black italic tracking-tighter uppercase mb-2">
                        Diseña tu noche en <span className="text-blue-500">OMM</span>
                    </h2>
                    <p className="text-gray-500 text-[10px] font-black uppercase tracking-[0.3em]">
                        Nexum Intelligence Concierge System
                    </p>
                </div>
                <AIConcierge onBack={() => setShowConcierge(false)} />
            </div>
        );
    }

    return (
        <div className="space-y-16 max-w-7xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-1000 pb-20 text-left">
            
            {/* CTA a Oh Yeah! B2C para el Staff */}
            <section className="bg-blue-600 p-10 rounded-[3.5rem] shadow-2xl shadow-blue-600/20 relative overflow-hidden flex flex-col md:flex-row items-center justify-between gap-8 group">
               <div className="absolute top-0 right-0 p-10 opacity-10 group-hover:scale-110 transition-transform">
                  <Smartphone size={150} fill="white" />
               </div>
               <div className="relative z-10 space-y-4 max-w-xl">
                  <div className="inline-flex items-center gap-2 bg-white/20 px-3 py-1 rounded-full text-[9px] font-black uppercase text-white italic">
                     <Zap size={12} fill="white" /> Herramienta de Venta Live
                  </div>
                  <h2 className="text-4xl font-black italic uppercase tracking-tighter leading-none text-white">Impulsa el Ticket con Oh Yeah!</h2>
                  <p className="text-sm text-blue-100 italic leading-relaxed">
                    Muestra el catálogo B2C a tus clientes para descubrir planes curados por IA y fidelizar su círculo social.
                  </p>
               </div>
               <button 
                 onClick={() => window.location.hash = '/oh-yeah'}
                 className="bg-white text-blue-600 px-10 py-5 rounded-[2rem] font-black italic text-[11px] uppercase tracking-widest flex items-center gap-3 transition-all hover:scale-105 shadow-xl"
               >
                  <Share2 size={18} /> VER VISTA CLIENTE
               </button>
            </section>

            <section className="relative h-[400px] flex flex-col items-center justify-center text-center overflow-hidden rounded-[4rem] border border-white/5 bg-[#0d0d0f]">
                <div className="absolute top-0 left-0 w-full h-full">
                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-blue-600/10 blur-[120px] rounded-full"></div>
                    <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-[0.03] pointer-events-none"></div>
                </div>
                <div className="relative z-10 px-6">
                    <div className="inline-flex items-center gap-2 bg-blue-600/10 border border-blue-500/20 px-4 py-1.5 rounded-full mb-8">
                        <Sparkles size={14} className="text-blue-500" />
                        <span className="text-[10px] font-black uppercase tracking-[0.2em] text-blue-400 italic">NEXUM DISCOVERY PLATFORM</span>
                    </div>
                    <h1 className="text-7xl md:text-8xl font-black italic tracking-tighter uppercase mb-4 leading-none">
                        Gestión <span className="text-blue-500">Discovery</span>
                    </h1>
                </div>
            </section>

            <div className="flex justify-center">
                <div className="bg-[#111114] p-2 rounded-2xl border border-white/5 flex gap-2">
                    <button 
                        onClick={() => setView('home')} 
                        className={`px-8 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${view === 'home' ? 'bg-blue-600 text-white' : 'text-gray-500 hover:text-white'}`}
                    >
                        CURACIÓN HOME
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
                    <section className="space-y-8">
                        <h3 className="text-[10px] font-black text-gray-600 uppercase tracking-[0.4em] flex items-center gap-3 px-2">
                            <Star size={14} className="text-yellow-500" /> Experiencia Exclusiva (Empujada por IA)
                        </h3>
                        <div className="group relative bg-[#111114] border border-white/5 rounded-[3.5rem] p-10 overflow-hidden flex flex-col lg:flex-row items-center gap-12 transition-all hover:border-blue-500/30 shadow-2xl">
                            <div className="w-full lg:w-1/2 aspect-video bg-gray-900 rounded-[2.5rem] overflow-hidden relative shadow-2xl border border-white/5">
                                <img src="https://images.unsplash.com/photo-1579871494447-9811cf80d66c?q=80&w=2070&auto=format&fit=crop" alt="OMM Omakase" className="w-full h-full object-cover opacity-80 group-hover:scale-105 transition-transform duration-700" />
                                <div className="absolute top-6 left-6 bg-green-500 text-white px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest flex items-center gap-2 shadow-lg">
                                    <div className="w-1.5 h-1.5 bg-white rounded-full animate-pulse"></div>
                                    Boosted Visibility
                                </div>
                            </div>
                            <div className="flex-1 space-y-8 text-left">
                                <div>
                                    <h2 className="text-4xl font-black italic tracking-tighter uppercase mb-2">Master Experience</h2>
                                    <h4 className="text-2xl font-black italic text-blue-500 tracking-tight">Degustando JAPÓN</h4>
                                </div>
                                <div className="bg-black/40 p-6 rounded-3xl border border-white/5 space-y-4">
                                    <p className="text-sm text-gray-400 leading-relaxed font-medium italic">El sistema OH YEAH! está priorizando esta experiencia hoy para aumentar el ticket medio.</p>
                                </div>
                                <div className="flex items-center justify-between pt-4 border-t border-white/5">
                                    <div className="flex flex-col">
                                       <span className="text-[10px] text-gray-600 font-black uppercase tracking-widest">Conversión</span>
                                       <span className="text-2xl font-black italic text-white">8.4% <span className="text-[8px] text-green-500">(+1.2%)</span></span>
                                    </div>
                                    <button className="bg-white/5 hover:bg-white/10 text-white px-8 py-4 rounded-2xl font-black italic text-xs uppercase tracking-widest flex items-center gap-3 transition-all border border-white/10">
                                        EDITAR LANZAMIENTO
                                    </button>
                                </div>
                            </div>
                        </div>
                    </section>
                </>
            ) : (
                <section className="space-y-8">
                    <h3 className="text-[10px] font-black text-gray-600 uppercase tracking-[0.4em] flex items-center gap-3 px-2">
                        <Calendar size={14} className="text-blue-500" /> Próximos Eventos en Venta
                    </h3>
                    <EventsModule />
                </section>
            )}
        </div>
    );
};

export default DiscoverModule;
