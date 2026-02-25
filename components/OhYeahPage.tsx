
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import React, { useState, useEffect, useRef } from 'react';
import { 
  MapPin, 
  User, 
  CalendarDays, 
  Bell, 
  Diamond, 
  Search,
  ChevronDown,
  Clock,
  Users
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext.tsx';

interface OhYeahPageProps {
  onExit?: () => void;
}

const OhYeahPage: React.FC<OhYeahPageProps> = ({ onExit }) => {
  const { profile } = useAuth();
  const [isScrolled, setIsScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 50);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const handleExit = () => {
    if (onExit) {
      onExit();
    } else {
      window.location.hash = '';
    }
  };

  return (
    <div className="min-h-screen bg-black text-white font-sans selection:bg-[#ec008c] overflow-x-hidden">
      
      {/* Top Bar */}
      <div className="bg-[#1a1a1a] text-[#a0a0a0] text-[10px] md:text-xs py-2 px-6 flex justify-between items-center font-medium tracking-wider">
        <div className="flex-1 text-center md:text-left">
          <span className="text-[#ccff00] italic mr-1">Los mejores restaurantes, eventos y experiencias.</span> Aquí
        </div>
        <div className="hidden md:flex items-center gap-4">
          <a href="#" className="hover:text-white transition-colors">Preguntas frecuentes</a>
          <div className="flex items-center gap-1 cursor-pointer hover:text-white transition-colors">
            ES <ChevronDown size={12} />
          </div>
        </div>
      </div>

      {/* Header */}
      <header className={`sticky top-0 z-[100] px-6 py-4 flex items-center justify-between transition-all duration-300 ${isScrolled ? 'bg-black/90 backdrop-blur-md border-b border-white/10' : 'bg-transparent'}`}>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1 cursor-pointer text-[#ec008c] hover:text-[#ff1493] transition-colors">
            <MapPin size={24} strokeWidth={1.5} />
            <ChevronDown size={14} className="mt-2" />
          </div>
          <div className="cursor-pointer" onClick={() => window.scrollTo({top: 0, behavior: 'smooth'})}>
            {/* Custom Oh Yeah! Logo Text */}
            <h1 className="text-4xl md:text-5xl font-black italic tracking-tighter text-[#ec008c]" style={{ textShadow: '2px 2px 0px #ccff00' }}>
              Oh Yeah!
            </h1>
          </div>
        </div>

        <div className="flex items-center gap-4 md:gap-6">
          <div className="hidden md:flex items-center gap-4">
            <button className="text-xs font-bold tracking-widest uppercase hover:text-[#ec008c] transition-colors">INICIAR SESIÓN</button>
            <button className="border border-[#ccff00] text-[#ccff00] px-4 py-1.5 rounded-full text-[10px] font-black tracking-widest uppercase flex items-center gap-2 hover:bg-[#ccff00] hover:text-black transition-all">
              GOURMAND SOCIETY <div className="w-1.5 h-4 bg-current rounded-full"></div>
            </button>
          </div>
          
          <div className="flex items-center gap-3">
            <button className="w-8 h-8 rounded-full border border-white/20 flex items-center justify-center text-[#ec008c] hover:bg-white/10 transition-colors">
              <User size={16} />
            </button>
            <button className="w-8 h-8 rounded-full border border-white/20 flex items-center justify-center text-[#4169e1] hover:bg-white/10 transition-colors">
              <CalendarDays size={16} />
            </button>
            <button className="w-8 h-8 rounded-full border border-white/20 flex items-center justify-center text-[#ccff00] hover:bg-white/10 transition-colors">
              <Bell size={16} />
            </button>
            <button className="w-8 h-8 rounded-full border border-white/20 flex items-center justify-center text-[#ec008c] hover:bg-white/10 transition-colors">
              <Diamond size={16} />
            </button>
            <div className="w-[1px] h-6 bg-white/20 mx-1"></div>
            <button className="text-[#ccff00] hover:scale-110 transition-transform">
              <Search size={24} strokeWidth={2.5} />
            </button>
          </div>
        </div>
      </header>

      {/* Search/Filter Bar */}
      <div className="flex justify-center -mt-4 relative z-50 px-4">
        <div className="bg-black border border-[#ccff00]/30 rounded-full flex flex-wrap md:flex-nowrap items-center p-1 shadow-[0_0_20px_rgba(204,255,0,0.1)]">
          <div className="flex items-center gap-2 px-4 py-2 bg-[#ccff00] text-black rounded-full font-black text-xs md:text-sm cursor-pointer">
            <CalendarDays size={16} /> FEB 16
          </div>
          <div className="flex items-center gap-2 px-4 py-2 text-[#ccff00] font-black text-xs md:text-sm cursor-pointer border-r border-white/10">
            <Clock size={16} /> 7:00 PM
          </div>
          <div className="flex items-center gap-2 px-4 py-2 text-[#ccff00] font-black text-xs md:text-sm cursor-pointer border-r border-white/10">
            <Users size={16} /> 2 PERSONAS
          </div>
          <div className="flex items-center justify-between gap-4 px-4 py-2 text-[#a0a0a0] font-medium text-xs md:text-sm cursor-pointer min-w-[150px]">
            <div className="flex items-center gap-2">
              <Search size={16} className="text-[#ccff00]" /> Elige tu mood
            </div>
            <ChevronDown size={14} />
          </div>
          <button className="bg-[#ec008c] text-white px-6 py-2 rounded-full font-black text-xs md:text-sm tracking-widest hover:bg-[#ff1493] transition-colors ml-auto md:ml-2">
            RESERVAR
          </button>
        </div>
      </div>

      <main className="pb-20">
        {/* Hero Section */}
        <section className="px-6 md:px-12 mt-8 mb-16 flex flex-col lg:flex-row gap-6">
          <div className="flex-1 rounded-[2rem] overflow-hidden relative min-h-[400px]">
            <img src="https://images.unsplash.com/photo-1555396273-367ea4eb4db5?q=80&w=1600&auto=format&fit=crop" className="absolute inset-0 w-full h-full object-cover" alt="Hero" />
            <div className="absolute inset-0 bg-gradient-to-r from-black/80 via-black/40 to-transparent"></div>
            <div className="absolute bottom-12 left-12">
              <h2 className="text-4xl md:text-6xl font-black text-white leading-tight mb-4">
                Bienvenido <br/> al mundo de
              </h2>
              <div className="flex items-center gap-4">
                <div className="flex">
                  <div className="w-12 h-12 rounded-full bg-[#eb001b] mix-blend-screen"></div>
                  <div className="w-12 h-12 rounded-full bg-[#f79e1b] mix-blend-screen -ml-4"></div>
                </div>
                <span className="text-3xl font-medium tracking-wide">priceless</span>
              </div>
            </div>
          </div>
          
          <div className="w-full lg:w-[350px] rounded-[2rem] border border-[#ec008c]/30 p-1 relative overflow-hidden flex flex-col items-center justify-center min-h-[400px]">
             <div className="absolute inset-0 bg-gradient-to-b from-transparent to-[#ec008c]/10"></div>
             <div className="bg-white text-black p-8 rounded-3xl w-[85%] text-center relative z-10 shadow-2xl">
                <div className="w-16 h-16 bg-[#ec008c] rounded-full mx-auto -mt-16 mb-4 flex items-center justify-center text-white font-black italic text-xl shadow-lg">
                  Oh Yeah!
                </div>
                <h3 className="font-black italic text-xl mb-2">Concierge</h3>
                <p className="font-bold text-sm leading-tight">¿Qué estas buscando<br/>es día de hoy?</p>
             </div>
             <img src="https://images.unsplash.com/photo-1576092762791-dd9e2220c9d8?q=80&w=400&auto=format&fit=crop" className="absolute bottom-0 right-0 w-48 opacity-80 mix-blend-luminosity" alt="Hand" style={{ maskImage: 'linear-gradient(to top, black, transparent)' }} />
          </div>
        </section>

        {/* Horizontal Scroll Sections */}
        <div className="space-y-16">
          <ScrollSection 
            title={<>Basados en tus gustos <span className="text-[#a0a0a0] font-normal text-sm md:text-base">(Se activa al iniciar sesión)</span></>}
            items={[1,2,3,4,5,6]} 
            showTopBadge 
          />

          {/* Top 10 Section */}
          <section className="px-6 md:px-12">
            <h3 className="text-xl md:text-2xl font-black tracking-wide mb-6">Los 10 restaurantes que están marcando conversación</h3>
            <div className="flex gap-4 overflow-x-auto no-scrollbar pb-8 snap-x">
               {[1,2,3,4,5,6].map((num) => (
                 <div key={num} className="min-w-[280px] md:min-w-[320px] h-[400px] relative snap-start flex-shrink-0 group cursor-pointer">
                    <div className="absolute inset-0 flex items-center justify-center z-10 pointer-events-none">
                       <span className="text-[250px] font-black text-transparent stroke-text leading-none group-hover:text-[#ec008c]/20 transition-colors" style={{ WebkitTextStroke: '2px #ec008c' }}>{num}</span>
                    </div>
                    <div className="absolute inset-x-4 inset-y-12 rounded-xl overflow-hidden z-0">
                       <img src={`https://images.unsplash.com/photo-1514933651103-005eec06c04b?q=80&w=600&auto=format&fit=crop&sig=${num}`} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" alt="Restaurant" />
                       <div className="absolute inset-0 bg-black/40 group-hover:bg-black/20 transition-colors"></div>
                    </div>
                    {num === 1 && <div className="absolute bottom-8 left-8 z-20 bg-[#ccff00] text-black text-[10px] font-black px-3 py-1 uppercase">RECIÉN AGREGADO</div>}
                    {num === 3 && (
                      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-20 flex flex-col items-center">
                        <div className="bg-[#ccff00] text-black text-[10px] font-black px-3 py-1 uppercase mb-1">NUEVO MENÚ</div>
                        <div className="bg-white text-black text-[10px] font-bold px-3 py-1 rounded-full cursor-pointer hover:bg-gray-200">Ver ahora</div>
                      </div>
                    )}
                 </div>
               ))}
            </div>
          </section>

          <ScrollSection title="Los que todos están hablando" items={[1,2,3,4,5,6]} />

          {/* Banner */}
          <section className="w-full h-[300px] md:h-[400px] relative overflow-hidden my-12">
             <img src="https://images.unsplash.com/photo-1514888286974-6c03e2ca1dba?q=80&w=2000&auto=format&fit=crop" className="w-full h-full object-cover" alt="Cats Banner" style={{ filter: 'hue-rotate(280deg) saturate(2)' }} />
             <div className="absolute inset-0 bg-[#ec008c]/20 mix-blend-overlay"></div>
             <div className="absolute bottom-0 left-0 right-0 h-1/2 bg-gradient-to-t from-black to-transparent"></div>
             <div className="absolute bottom-8 w-full text-center">
                <h2 className="text-6xl md:text-9xl font-black italic tracking-tighter text-[#ccff00]" style={{ textShadow: '4px 4px 0px #ec008c' }}>Oh Yeah!</h2>
             </div>
          </section>

          <ScrollSection title="Experiencias privadas" items={[1,2,3,4,5,6]} vertical />
          
          <ScrollSection title="Top 5 de los más reservados hoy" items={[1,2,3,4,5,6]} />

          {/* Reviews Section */}
          <section className="px-6 md:px-12">
            <h3 className="text-xl md:text-2xl font-black tracking-wide mb-2">Algunos lugares recuerdan a quienes saben vivirlos.</h3>
            <p className="text-[#a0a0a0] text-sm mb-6">Memoria viva</p>
            <div className="flex gap-6 overflow-x-auto no-scrollbar pb-8 snap-x">
               {[
                 { name: 'Sofía Sanmartín', rating: 5, text: 'Excelente sabor de los platos, entradas muy recomendas y excelente atencion' },
                 { name: 'Samantha Leal', rating: 5, text: 'Excelente sabor de los platos, entradas muy recomendas y excelente atencion' },
                 { name: 'Olga Cardenas', rating: 5, text: 'Excelente sabor de los platos, entradas muy recomendas y excelente atencion' }
               ].map((review, idx) => (
                 <div key={idx} className="min-w-[300px] md:min-w-[400px] snap-start flex-shrink-0">
                    <div className="flex gap-4 mb-4">
                       <div className="w-16 h-16 rounded-lg overflow-hidden shrink-0">
                          <img src={`https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?q=80&w=200&auto=format&fit=crop&sig=${idx}`} className="w-full h-full object-cover" alt="Restaurant" />
                       </div>
                       <div>
                          <h4 className="font-black text-lg italic">{review.name}</h4>
                          <div className="flex text-[#ec008c] text-xs my-1">{'★'.repeat(review.rating)}</div>
                          <p className="text-xs text-[#a0a0a0] leading-tight">{review.text}</p>
                          <p className="text-[8px] text-[#666] mt-1">Comida 5 Servicio 5 Ambiente 5 Valor 5</p>
                       </div>
                    </div>
                    <div className="bg-[#ccff00] text-black p-3 flex justify-between items-center rounded-sm">
                       <div>
                          <h5 className="font-black text-sm leading-none">Seratta</h5>
                          <p className="text-[9px] font-bold mt-1">$$$$$ • Mediterraneo • Bogotá • ★ 4.5</p>
                       </div>
                       <div className="w-4 h-6 border-2 border-black border-b-0 relative">
                          <div className="absolute -bottom-2 left-0 right-0 border-t-[8px] border-t-black border-l-[8px] border-l-transparent border-r-[8px] border-r-transparent"></div>
                       </div>
                    </div>
                 </div>
               ))}
            </div>
          </section>

          {/* Info Section */}
          <section className="px-6 md:px-12 py-12 flex flex-col lg:flex-row gap-12 border-t border-white/10">
             <div className="flex-1">
                <h3 className="text-sm font-bold mb-12">Preguntas frecuentes</h3>
                <div className="max-w-md">
                   <h2 className="text-6xl font-black italic tracking-tighter text-[#ccff00] mb-4" style={{ textShadow: '2px 2px 0px #ec008c' }}>Oh Yeah!</h2>
                   <p className="text-xl font-bold mb-2">No te ayuda a buscar restaurantes.</p>
                   <p className="text-xl font-black bg-[#ec008c] inline-block px-2 py-1">Te guía hacia grandes experiencias.</p>
                </div>
             </div>
             <div className="flex-1 text-sm text-[#d0d0d0] space-y-6 max-w-2xl">
                <p>Explora una selección curada de restaurantes, eventos y rituales gastronómicos que realmente valen la pena. No somos un catálogo infinito lleno de lugares random. Somos un ecosistema vivo de espacios que saben recibir, sorprender... y dejar huella.</p>
                <p><strong>Aquí no eliges solo por disponibilidad. Eliges por vibra. Por mood. Por lo que quieres sentir esa noche.</strong><br/>¿Cena íntima? ¿Ritual de celebración? ¿Apertura secreta? ¿Viaje con mesa imprescindible? Filtra por ambiente, ocasión o tipo de experiencia y deja que OH YEAH! te muestre lo que está alineado contigo — no solo lo que está libre.</p>
                <p>Porque una mesa es logística. Una experiencia es memoria.</p>
                <ul className="list-disc pl-4 space-y-1">
                   <li>La reserva es solo el comienzo.</li>
                   <li>La experiencia se construye con el tiempo.</li>
                   <li>Y nosotros conectamos los puntos.</li>
                </ul>
                <p className="font-bold text-white">No busques mesa. Encuentra tu próxima gran experiencia.</p>
                <p className="font-black text-white text-xs">OH YEAH!<br/>Feel it. Book it. Live it.</p>
             </div>
          </section>

          {/* How it works */}
          <section className="px-6 md:px-12 pb-16">
             <h3 className="text-xl font-black tracking-wide mb-12">¿Cómo funciona Oh yeah!?</h3>
             <div className="grid grid-cols-1 md:grid-cols-3 gap-8 text-center">
                <div className="flex flex-col items-center">
                   <div className="text-[#4169e1] mb-4">
                      <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2"/><path d="M7 2v20"/><path d="M21 15V2v0a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3Zm0 0v7"/></svg>
                   </div>
                   <p className="text-sm font-medium px-4">Descubre el restaurante ideal para cada ocasión</p>
                </div>
                <div className="flex flex-col items-center">
                   <div className="text-[#ec008c] mb-4">
                      <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/></svg>
                   </div>
                   <p className="text-sm font-medium px-4">Consulta la disponibilidad rápidamente y recibe notificaciones oportunas</p>
                </div>
                <div className="flex flex-col items-center">
                   <div className="text-[#ccff00] mb-4">
                      <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect width="14" height="20" x="5" y="2" rx="2" ry="2"/><path d="M12 18h.01"/></svg>
                   </div>
                   <p className="text-sm font-medium px-4">Administra fácilmente tus reservaciones</p>
                </div>
             </div>
          </section>
        </div>
      </main>

      {/* Footer */}
      <footer className="bg-[#ec008c] text-white pt-16 pb-8 px-6 md:px-12">
         <div className="flex flex-col md:flex-row justify-between items-start gap-12 mb-16">
            <h2 className="text-5xl md:text-7xl font-black italic tracking-tighter text-[#ccff00]" style={{ textShadow: '2px 2px 0px rgba(0,0,0,0.2)' }}>Oh Yeah!</h2>
            
            <div className="flex flex-col md:flex-row gap-12 md:gap-24 font-bold text-sm tracking-widest uppercase">
               <div className="space-y-3">
                  <p className="cursor-pointer hover:text-[#ccff00]">RESTAURANTES AFILIADOS</p>
                  <p className="cursor-pointer hover:text-[#ccff00]">GOURMAND SOCIETY</p>
                  <p className="cursor-pointer hover:text-[#ccff00]">REVISTA GOURMAND SOCIETY</p>
                  <p className="cursor-pointer hover:text-[#ccff00]">TENGO UN RESTAURANTE</p>
               </div>
               <div className="space-y-3 font-medium normal-case tracking-normal text-base">
                  <p className="cursor-pointer hover:text-[#ccff00]">Curaduría</p>
                  <p className="cursor-pointer hover:text-[#ccff00]">Estatus</p>
                  <p className="cursor-pointer hover:text-[#ccff00]">Miembro de una sociedad</p>
                  <p className="cursor-pointer hover:text-[#ccff00]">Memoria viva</p>
               </div>
            </div>
         </div>
         
         <div className="flex flex-col md:flex-row justify-between items-center gap-6 pt-8 border-t border-white/20 text-sm font-bold tracking-widest">
            <a href="#" className="hover:text-[#ccff00] border-b border-transparent hover:border-[#ccff00] pb-1">Términos y condiciones</a>
            <a href="#" className="hover:text-[#ccff00]">Política de datos</a>
            <a href="#" className="hover:text-[#ccff00]">Contacto</a>
         </div>
      </footer>
    </div>
  );
};

const ScrollSection = ({ title, items, showTopBadge, vertical }: any) => (
  <section className="px-6 md:px-12">
    <h3 className="text-xl md:text-2xl font-black tracking-wide mb-6">{title}</h3>
    <div className="flex gap-4 overflow-x-auto no-scrollbar pb-8 snap-x">
       {items.map((item: any, idx: number) => (
         <div key={idx} className={`snap-start flex-shrink-0 group cursor-pointer ${vertical ? 'w-[200px] md:w-[240px]' : 'w-[280px] md:w-[320px]'}`}>
            <div className={`relative rounded-xl overflow-hidden mb-3 ${vertical ? 'aspect-[3/4]' : 'aspect-[4/3]'}`}>
               <img src={`https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?q=80&w=600&auto=format&fit=crop&sig=${idx + (vertical ? 10 : 0)}`} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" alt="Restaurant" />
               <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent"></div>
               
               {showTopBadge && (
                 <div className="absolute top-0 right-4 bg-[#4169e1] text-white text-[10px] font-black px-2 py-3 rounded-b-md flex flex-col items-center leading-none">
                    <span>TOP</span>
                    <span className="text-sm">10</span>
                 </div>
               )}
               
               <div className="absolute bottom-4 left-4 right-4">
                  <h4 className="text-2xl font-black italic uppercase text-white mb-1" style={{ textShadow: '2px 2px 0px rgba(0,0,0,0.5)' }}>SELVATÍCO</h4>
                  <p className="text-[8px] font-bold text-[#ccff00] tracking-widest uppercase mb-1">ITALIANO • $ 31.000 A $ 50.000 •</p>
                  <p className="text-[8px] text-gray-300 leading-tight line-clamp-2">Lorem ipsum dolor sit amet, consectetuer adipiscing elit, Lorem ipsum dolor sit amet, consectetuer adipiscing elit,</p>
               </div>
            </div>
         </div>
       ))}
    </div>
  </section>
);

export default OhYeahPage;
