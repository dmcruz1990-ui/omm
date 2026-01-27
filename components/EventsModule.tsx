
import React, { useState, useEffect } from 'react';
import { 
  Calendar, 
  Ticket, 
  QrCode, 
  X, 
  Send, 
  Mail, 
  CheckCircle2, 
  Loader2, 
  Music, 
  GlassWater, 
  Utensils, 
  Sparkles,
  Phone,
  User,
  ChevronRight,
  Share2,
  AlertCircle
} from 'lucide-react';
// Importación externa con vinculación de React para evitar conflictos de instancia
import QRCodeLib from 'https://esm.sh/react-qr-code?external=react';
import { supabase } from '../lib/supabase';
import { OmmEvent } from '../types';

const EventsModule: React.FC = () => {
  const [events, setEvents] = useState<OmmEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedEvent, setSelectedEvent] = useState<OmmEvent | null>(null);
  const [isBuying, setIsBuying] = useState(false);
  const [isMounted, setIsMounted] = useState(false);
  
  // Formulario
  const [formData, setFormData] = useState({ name: '', phone: '', email: '' });
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [boughtTicket, setBoughtTicket] = useState<{ code: string; event: OmmEvent } | null>(null);

  useEffect(() => {
    setIsMounted(true);
    const fetchEvents = async () => {
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from('events')
          .select('*')
          .order('date', { ascending: true });

        if (error) throw error;
        setEvents(data || []);
      } catch (err) {
        console.error("Error al cargar eventos:", err);
        // Fallback demo data
        setEvents([
          { id: '1', title: 'Midnight DJ Set', description: 'Techno Zen & Mixología Japonesa.', date: '2025-06-15', price: 85000, category: 'DJ SET', image_url: 'https://images.unsplash.com/photo-1514525253361-bee8718a300a?q=80&w=2000' },
          { id: '2', title: 'Sakura Brunch', description: 'Omakase de fin de semana con mimosas ilimitadas.', date: '2025-06-18', price: 125000, category: 'BRUNCH', image_url: 'https://images.unsplash.com/photo-1533777857889-4be7c70b33f7?q=80&w=2000' },
          { id: '3', title: 'Masterclass: Sake Ritual', description: 'Cata privada con nuestro Sommelier residente.', date: '2025-06-22', price: 150000, category: 'CATA', image_url: 'https://images.unsplash.com/photo-1502404642581-7c94132410a5?q=80&w=2000' },
          { id: '4', title: 'Kaiseki Night', description: 'Cena de 12 pasos exclusiva en Cava VIP.', date: '2025-06-25', price: 280000, category: 'DINNER', image_url: 'https://images.unsplash.com/photo-1551632432-c735e8299bc2?q=80&w=2000' },
        ]);
      } finally {
        setLoading(false);
      }
    };

    fetchEvents();
  }, []);

  const handlePurchase = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedEvent) return;

    setIsProcessing(true);
    setErrorMessage(null);

    // TAREA: Generar código único con prefijo TKT
    const ticketCode = `TKT-${Date.now()}-${Math.random().toString(36).substr(2, 4).toUpperCase()}`;

    try {
      console.log(`[EVENTS] Iniciando transacción para boleto: ${ticketCode}`);
      
      // TAREA: Guardar en Supabase (event_tickets)
      const { error } = await supabase
        .from('event_tickets')
        .insert([{
          event_id: selectedEvent.id,
          customer_name: formData.name,
          customer_phone: formData.phone,
          customer_email: formData.email,
          ticket_code: ticketCode,
          is_paid: true
        }]);

      if (error) throw error;

      console.log("✅ [EVENTS] Boleto guardado exitosamente en DB");
      setBoughtTicket({ code: ticketCode, event: selectedEvent });
      setIsBuying(false);
      
      // Limpiar formulario para próxima compra
      setFormData({ name: '', phone: '', email: '' });

    } catch (err: any) {
      console.error("❌ [EVENTS] Error crítico al generar boleto:", err);
      setErrorMessage("No se pudo generar el boleto. Por favor, verifique su conexión e intente de nuevo.");
    } finally {
      setIsProcessing(false);
    }
  };

  const shareOnWhatsApp = () => {
    if (!boughtTicket) return;
    const text = encodeURIComponent(`¡Hola! Mi entrada para ${boughtTicket.event.title} en OMM es: ${boughtTicket.code}. Nos vemos allá! ⛩️`);
    window.open(`https://wa.me/?text=${text}`, '_blank');
  };

  const shareByEmail = () => {
    if (!boughtTicket) return;
    const subject = encodeURIComponent(`Mi Entrada OMM: ${boughtTicket.event.title}`);
    const body = encodeURIComponent(`Hola, este es mi código de entrada para el evento en OMM: ${boughtTicket.code}`);
    window.location.href = `mailto:?subject=${subject}&body=${body}`;
  };

  if (loading) return (
    <div className="flex flex-col items-center justify-center py-20 opacity-40">
      <Loader2 className="animate-spin text-blue-500 mb-4" size={32} />
      <p className="text-[10px] font-black uppercase tracking-widest">Sincronizando Cartelera...</p>
    </div>
  );

  return (
    <div className="space-y-12 animate-in fade-in duration-700">
      
      {/* Grilla de Eventos */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-8">
        {events.map((event) => (
          <div 
            key={event.id}
            className="bg-[#111114] border border-white/5 rounded-[3rem] overflow-hidden group hover:border-blue-500/30 transition-all flex flex-col shadow-2xl h-full"
          >
            <div className="aspect-[4/3] relative overflow-hidden">
               <img src={event.image_url} alt={event.title} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700 opacity-80" />
               <div className="absolute top-6 left-6 bg-black/60 backdrop-blur-md px-4 py-2 rounded-2xl border border-white/10 flex items-center gap-2">
                  <CategoryIcon category={event.category} />
                  <span className="text-[9px] font-black uppercase tracking-widest text-white">{event.category}</span>
               </div>
            </div>
            
            <div className="p-8 space-y-4 flex-1 flex flex-col justify-between">
               <div>
                  <h4 className="text-xl font-black italic uppercase tracking-tighter leading-tight mb-2 group-hover:text-blue-500 transition-colors">
                    {event.title}
                  </h4>
                  <div className="flex items-center gap-2 text-gray-500 text-[10px] font-bold uppercase mb-4 tracking-widest">
                     <Calendar size={14} className="text-blue-500" />
                     {new Date(event.date).toLocaleDateString('es-ES', { day: 'numeric', month: 'long' })}
                  </div>
                  <p className="text-[11px] text-gray-400 italic leading-relaxed line-clamp-2">
                    {event.description}
                  </p>
               </div>

               <div className="pt-6 border-t border-white/5 flex items-center justify-between">
                  <div className="flex flex-col">
                     <span className="text-[8px] text-gray-600 font-black uppercase">Cover</span>
                     <span className="text-lg font-black italic text-white">${event.price.toLocaleString()}</span>
                  </div>
                  <button 
                    onClick={() => { setSelectedEvent(event); setIsBuying(true); setErrorMessage(null); }}
                    className="bg-white/5 hover:bg-blue-600 hover:text-white px-6 py-3 rounded-2xl text-[9px] font-black uppercase tracking-widest border border-white/5 transition-all shadow-xl active:scale-95"
                  >
                    COMPRAR ENTRADA
                  </button>
               </div>
            </div>
          </div>
        ))}
      </div>

      {/* Modal de Compra */}
      {isBuying && selectedEvent && (
        <div className="fixed inset-0 z-[500] flex items-center justify-center p-6 animate-in fade-in backdrop-blur-2xl">
           <div className="absolute inset-0 bg-black/80" onClick={() => !isProcessing && setIsBuying(false)}></div>
           <div className="bg-[#0a0a0c] border border-white/10 rounded-[3.5rem] w-full max-w-xl relative z-10 overflow-hidden shadow-[0_0_120px_rgba(37,99,235,0.2)]">
              <div className="p-10 border-b border-white/5 flex justify-between items-center bg-gradient-to-r from-blue-600/10 to-transparent">
                 <div className="flex items-center gap-4">
                    <Ticket className="text-blue-500" size={28} />
                    <div>
                       <h3 className="text-2xl font-black italic uppercase tracking-tighter">Reserva tu Espacio</h3>
                       <p className="text-[9px] text-gray-500 font-black uppercase tracking-widest">{selectedEvent.title}</p>
                    </div>
                 </div>
                 <button onClick={() => setIsBuying(false)} disabled={isProcessing} className="text-gray-500 hover:text-white disabled:opacity-0"><X size={24} /></button>
              </div>

              <form onSubmit={handlePurchase} className="p-10 space-y-6">
                 <div className="space-y-4">
                    <InputField 
                       label="Nombre Completo" 
                       placeholder="Ej: Akira Kurosawa" 
                       icon={<User size={16} />} 
                       value={formData.name} 
                       disabled={isProcessing}
                       onChange={(v: string) => setFormData({...formData, name: v})}
                    />
                    <InputField 
                       label="Teléfono WhatsApp" 
                       placeholder="+57 300..." 
                       icon={<Phone size={16} />} 
                       value={formData.phone} 
                       disabled={isProcessing}
                       onChange={(v: string) => setFormData({...formData, phone: v})}
                    />
                    <InputField 
                       label="Correo Electrónico" 
                       placeholder="akira@omm.com" 
                       icon={<Mail size={16} />} 
                       value={formData.email} 
                       disabled={isProcessing}
                       onChange={(v: string) => setFormData({...formData, email: v})}
                    />
                 </div>

                 {errorMessage && (
                   <div className="bg-red-500/10 border border-red-500/30 p-4 rounded-2xl flex items-center gap-3 animate-in shake">
                      <AlertCircle className="text-red-500 shrink-0" size={18} />
                      <p className="text-[10px] text-red-500 font-black uppercase leading-tight">{errorMessage}</p>
                   </div>
                 )}

                 <div className="bg-white/5 p-6 rounded-3xl border border-white/5 flex justify-between items-center">
                    <div>
                       <span className="text-[10px] text-gray-500 font-black uppercase tracking-widest">Total a Pagar</span>
                       <h4 className="text-2xl font-black italic text-blue-500">${selectedEvent.price.toLocaleString()}</h4>
                    </div>
                    <button 
                       type="submit"
                       disabled={isProcessing || !formData.name || !formData.phone || !formData.email}
                       className="bg-blue-600 hover:bg-blue-500 disabled:opacity-30 disabled:hover:bg-blue-600 text-white px-8 py-4 rounded-2xl font-black text-[10px] uppercase tracking-widest flex items-center gap-3 transition-all shadow-xl"
                    >
                       {isProcessing ? (
                         <>
                            <Loader2 className="animate-spin" size={16} /> 
                            <span>PROCESANDO...</span>
                         </>
                       ) : (
                         <>
                            <Sparkles size={16} /> 
                            <span>CONFIRMAR PAGO</span>
                         </>
                       )}
                    </button>
                 </div>
              </form>
           </div>
        </div>
      )}

      {/* Pantalla de Boleto Generado */}
      {boughtTicket && (
        <div className="fixed inset-0 z-[600] flex items-center justify-center p-6 animate-in fade-in backdrop-blur-3xl bg-black/40">
           <div className="absolute inset-0 bg-black/60" onClick={() => setBoughtTicket(null)}></div>
           <div className="bg-[#111114] border-2 border-blue-500/30 rounded-[4rem] w-full max-w-lg relative z-10 overflow-hidden shadow-[0_0_150px_rgba(37,99,235,0.4)] flex flex-col items-center text-center p-12">
              
              <div className="w-20 h-20 bg-green-600 rounded-full flex items-center justify-center mb-8 shadow-green-600/20 shadow-2xl animate-in zoom-in duration-700">
                 <CheckCircle2 size={40} className="text-white" />
              </div>

              <h2 className="text-4xl font-black italic tracking-tighter uppercase mb-2">¡Entrada Lista!</h2>
              <p className="text-gray-500 text-[10px] font-black uppercase tracking-[0.4em] mb-10 italic">Tu acceso digital ha sido generado</p>

              {/* TAREA: Renderizado del código QR basado en ticketCode */}
              <div className="bg-white p-8 rounded-[3rem] shadow-2xl mb-10 border-[12px] border-blue-600/10">
                 {isMounted && QRCodeLib ? (
                    <QRCodeComponent code={boughtTicket.code} />
                 ) : (
                    <div className="w-[200px] h-[200px] flex items-center justify-center bg-gray-100 rounded-2xl">
                       <Loader2 className="animate-spin text-blue-600" />
                    </div>
                 )}
              </div>

              <div className="space-y-2 mb-10">
                 <span className="text-[9px] text-gray-500 font-black uppercase tracking-widest">Código de Boleto</span>
                 <div className="text-3xl font-black italic tracking-widest text-blue-500 font-mono">
                    {boughtTicket.code}
                 </div>
              </div>

              <div className="grid grid-cols-2 gap-4 w-full">
                 <button 
                  onClick={shareOnWhatsApp}
                  className="bg-[#25D366] hover:bg-[#128C7E] text-white py-4 rounded-2xl font-black text-[10px] uppercase tracking-widest flex items-center justify-center gap-3 transition-all shadow-xl"
                 >
                    <Send size={16} /> WHATSAPP
                 </button>
                 <button 
                  onClick={shareByEmail}
                  className="bg-white text-black hover:bg-blue-600 hover:text-white py-4 rounded-2xl font-black text-[10px] uppercase tracking-widest flex items-center justify-center gap-3 transition-all shadow-xl"
                 >
                    <Mail size={16} /> CORREO
                 </button>
              </div>

              <button 
                onClick={() => setBoughtTicket(null)}
                className="mt-8 text-gray-600 hover:text-white text-[9px] font-black uppercase tracking-widest transition-colors"
              >
                CERRAR TICKET
              </button>
           </div>
        </div>
      )}

    </div>
  );
};

/**
 * Componente interno para manejar el renderizado del QR de forma aislada
 */
const QRCodeComponent = ({ code }: { code: string }) => {
   const QR: any = (QRCodeLib as any).default || QRCodeLib;
   
   if (typeof QR !== 'function' && typeof QR !== 'object') {
     return <div className="text-3xl font-black font-mono text-black">{code}</div>;
   }

   try {
     return <QR value={code} size={200} bgColor="#ffffff" fgColor="#000000" />;
   } catch (e) {
     return <div className="text-3xl font-black font-mono text-black">{code}</div>;
   }
};

const CategoryIcon = ({ category }: { category: string }) => {
  switch(category) {
    case 'DJ SET': return <Music size={12} className="text-blue-500" />;
    case 'BRUNCH': return <Utensils size={12} className="text-orange-500" />;
    case 'CATA': return <GlassWater size={12} className="text-purple-500" />;
    case 'DINNER': return <Sparkles size={12} className="text-yellow-500" />;
    default: return <Ticket size={12} className="text-gray-500" />;
  }
};

const InputField = ({ label, placeholder, icon, value, onChange, disabled }: any) => (
  <div className="space-y-2 text-left group">
     <label className="text-[10px] font-black text-gray-600 uppercase tracking-widest ml-1">{label}</label>
     <div className="relative">
        <div className="absolute left-5 top-1/2 -translate-y-1/2 text-gray-600 group-focus-within:text-blue-500 transition-colors">
           {icon}
        </div>
        <input 
          type="text" 
          placeholder={placeholder}
          value={value}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value)}
          required
          className="w-full bg-white/5 border border-white/5 rounded-2xl py-5 pl-14 pr-6 text-[11px] font-black tracking-widest outline-none focus:border-blue-500 disabled:opacity-30 transition-all placeholder:text-gray-800"
        />
     </div>
  </div>
);

export default EventsModule;
