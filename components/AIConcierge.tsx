
import React, { useState, useRef, useEffect } from 'react';
import { 
  Send, 
  Zap, 
  Loader2, 
  User, 
  Sparkles, 
  ChevronLeft, 
  CheckCircle, 
  RefreshCcw, 
  Table as TableIcon, 
  AlertCircle, 
  Users,
  Ticket,
  QrCode
} from 'lucide-react';
import { askNexumAI } from '../lib/ai/brain';
import { supabase } from '../lib/supabase';
import { OmmEvent } from '../types';

interface Message {
  role: 'user' | 'model';
  text: string;
}

interface AIConciergeProps {
  onBack?: () => void;
}

const AIConcierge: React.FC<AIConciergeProps> = ({ onBack }) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [events, setEvents] = useState<OmmEvent[]>([]);
  const [bookingStatus, setBookingStatus] = useState<'idle' | 'processing' | 'success' | 'waitlist' | 'event_success' | 'error'>('idle');
  const [reservationDetails, setReservationDetails] = useState<any>(null);
  const [debugInfo, setDebugInfo] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchEvents();
  }, []);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, loading]);

  const fetchEvents = async () => {
    const { data } = await supabase.from('events').select('*').order('date', { ascending: true });
    if (data) setEvents(data);
  };

  const getEventContext = () => {
    if (events.length === 0) return "No hay eventos programados.";
    return events.map(e => `- ID: ${e.id}, Título: ${e.title}, Fecha: ${e.date}, Precio: $${e.price}, Categoría: ${e.category}`).join('\n');
  };

  const resetChat = () => {
    setMessages([]);
    setInput('');
    setBookingStatus('idle');
    setReservationDetails(null);
    setDebugInfo(null);
  };

  const processTransaction = async (responseText: string) => {
    // Caso 1: Reserva de Mesa
    if (responseText.includes("CONFIRMAR_RESERVA")) {
      await processTableReservation(responseText);
    } 
    // Caso 2: Compra de Evento
    else if (responseText.includes("CONFIRMAR_EVENTO")) {
      await processEventTicket(responseText);
    }
  };

  const processEventTicket = async (responseText: string) => {
    setBookingStatus('processing');
    try {
      const startIndex = responseText.indexOf("CONFIRMAR_EVENTO");
      const segment = responseText.substring(startIndex).split('\n')[0];
      const [_, id, name, phone, email, qty] = segment.split(",").map(s => s.trim().replace("CONFIRMAR_EVENTO:", ""));

      const ticketCode = `TKT-AI-${Date.now()}`;
      const selectedEvent = events.find(e => e.id === id) || events[0];

      const { error } = await supabase
        .from('event_tickets')
        .insert([{
          event_id: selectedEvent.id,
          customer_name: name,
          customer_phone: phone,
          customer_email: email,
          ticket_code: ticketCode,
          is_paid: true
        }]);

      if (error) throw error;

      setReservationDetails({
        code: ticketCode,
        event: selectedEvent.title,
        name,
        qty: qty || "1",
        type: 'EVENTO'
      });
      setBookingStatus('event_success');
      setMessages(prev => [...prev, { role: 'model', text: `¡Listo! He generado tus entradas para ${selectedEvent.title}. Tu código de acceso es ${ticketCode}.` }]);

    } catch (err: any) {
      setBookingStatus('error');
      setDebugInfo(err.message);
    }
  };

  const processTableReservation = async (responseText: string) => {
    setBookingStatus('processing');
    try {
      const startIndex = responseText.indexOf("CONFIRMAR_RESERVA");
      const segment = responseText.substring(startIndex).split('\n')[0];
      const dataArray = segment.split(",").map(s => s.trim());
      
      const name = dataArray[0].replace("CONFIRMAR_RESERVA:", "").trim();
      const phone = dataArray[1];
      const dateInfo = dataArray[2];
      const numPax = parseInt(dataArray[3], 10) || 2;
      const zone = dataArray[4];

      // Buscar o Crear Cliente
      let { data: customer } = await supabase.from('customers').select('id').eq('phone', phone).maybeSingle();
      let customerId;
      if (!customer) {
        const { data: newCust } = await supabase.from('customers').insert([{ name, phone }]).select('id').single();
        customerId = newCust?.id;
      } else {
        customerId = customer.id;
      }

      // Buscar Mesa
      const { data: table } = await supabase.from('tables').select('id, zone').eq('status', 'free').gte('seats', numPax).limit(1).maybeSingle();

      const isWaitlist = !table;
      
      await supabase.from('reservations').insert([{
        customer_id: customerId,
        table_id: table ? table.id : null,
        reservation_time: new Date().toISOString(), 
        pax: numPax,
        plan: zone,
        status: isWaitlist ? 'waiting_list' : 'confirmed'
      }]);

      if (table) await supabase.from('tables').update({ status: 'reserved' }).eq('id', table.id);

      setReservationDetails({
        id: table ? table.id : 'Waitlist',
        zone: table ? table.zone : 'Fila Virtual',
        name,
        time: dateInfo,
        pax: numPax,
        isWaitlist,
        type: 'MESA'
      });
      setBookingStatus(isWaitlist ? 'waitlist' : 'success');

    } catch (error: any) {
      setBookingStatus('error');
      setDebugInfo(error.message);
    }
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || loading || bookingStatus !== 'idle') return;

    const userText = input.trim();
    setInput('');
    setMessages(prev => [...prev, { role: 'user', text: userText }]);
    setLoading(true);

    try {
      const response = await askNexumAI(userText, messages, getEventContext());
      setMessages(prev => [...prev, { role: 'model', text: response }]);
      
      if (response.includes("CONFIRMAR_RESERVA") || response.includes("CONFIRMAR_EVENTO")) {
        await processTransaction(response);
      }
    } catch (error) {
      setMessages(prev => [...prev, { role: 'model', text: "Error de conexión." }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-3xl mx-auto bg-[#111114] border border-white/5 rounded-[3.5rem] overflow-hidden flex flex-col h-[700px] shadow-2xl relative animate-in zoom-in duration-500">
      
      {/* HUD de Éxito de Evento */}
      {bookingStatus === 'event_success' && reservationDetails && (
        <div className="absolute inset-0 z-[100] bg-black/95 backdrop-blur-2xl flex flex-col items-center justify-center p-12 text-center animate-in fade-in duration-500">
           <div className="bg-blue-600 p-8 rounded-full shadow-[0_0_60px_rgba(37,99,235,0.4)] mb-8 animate-in zoom-in duration-700">
              <Ticket size={64} className="text-white" />
           </div>
           <h2 className="text-4xl font-black italic tracking-tighter uppercase mb-2">¡Entrada Generada!</h2>
           <p className="text-gray-400 text-xs font-black uppercase tracking-[0.3em] mb-10 italic">NEXUM Event Ticketing System</p>
           
           <div className="bg-white/5 border border-white/10 rounded-[2.5rem] p-8 w-full mb-12 space-y-4">
              <div className="flex justify-between items-center border-b border-white/5 pb-4">
                 <span className="text-[10px] text-gray-500 font-black uppercase">Evento</span>
                 <span className="text-lg font-black italic text-blue-500">{reservationDetails.event}</span>
              </div>
              <div className="flex justify-between items-center border-b border-white/5 pb-4">
                 <span className="text-[10px] text-gray-500 font-black uppercase">Código QR</span>
                 <span className="text-lg font-black italic font-mono text-white">{reservationDetails.code}</span>
              </div>
              <div className="flex justify-between items-center">
                 <span className="text-[10px] text-gray-500 font-black uppercase">Titular / Cant.</span>
                 <span className="text-sm font-black italic">{reservationDetails.name} • {reservationDetails.qty} Entradas</span>
              </div>
           </div>

           <div className="flex gap-4">
             <button onClick={onBack} className="bg-white/5 hover:bg-white/10 text-white px-8 py-4 rounded-2xl font-black italic text-xs uppercase tracking-widest transition-all">Salir</button>
             <button onClick={resetChat} className="bg-blue-600 hover:bg-blue-500 text-white px-10 py-4 rounded-2xl font-black italic text-xs uppercase tracking-widest transition-all shadow-xl flex items-center gap-3">
               <RefreshCcw size={16} /> Otra Gestión
             </button>
           </div>
        </div>
      )}

      {/* Reutilización de HUD de Reservas Estándar */}
      {['success', 'waitlist'].includes(bookingStatus) && reservationDetails && (
        <div className="absolute inset-0 z-[100] bg-black/95 backdrop-blur-2xl flex flex-col items-center justify-center p-12 text-center animate-in fade-in duration-500">
           <div className={`${reservationDetails.isWaitlist ? 'bg-amber-500' : 'bg-green-600'} p-8 rounded-full shadow-[0_0_60px_rgba(34,197,94,0.3)] mb-8 animate-in zoom-in duration-700`}>
              {reservationDetails.isWaitlist ? <Users size={64} className="text-white" /> : <CheckCircle size={64} className="text-white" />}
           </div>
           <h2 className="text-4xl font-black italic tracking-tighter uppercase mb-2">
             {reservationDetails.isWaitlist ? '¡En Lista de Espera!' : '¡Reserva Confirmada!'}
           </h2>
           <p className="text-gray-400 text-xs font-black uppercase tracking-[0.3em] mb-10 italic">NEXUM Cloud Sync Complete</p>
           
           <div className="bg-white/5 border border-white/10 rounded-[2.5rem] p-8 w-full mb-12 space-y-4">
              <div className="flex justify-between items-center border-b border-white/5 pb-4">
                 <span className="text-[10px] text-gray-500 font-black uppercase">Estado</span>
                 <span className={`text-xl font-black italic ${reservationDetails.isWaitlist ? 'text-amber-500' : 'text-blue-500'}`}>
                   {reservationDetails.isWaitlist ? 'STANDBY' : `M-${reservationDetails.id}`}
                 </span>
              </div>
              <div className="flex justify-between items-center">
                 <span className="text-[10px] text-gray-500 font-black uppercase">Pax / Hora</span>
                 <span className="text-sm font-black italic">{reservationDetails.pax} Personas • {reservationDetails.time}</span>
              </div>
           </div>

           <div className="flex gap-4">
             <button onClick={onBack} className="bg-white/5 hover:bg-white/10 text-white px-8 py-4 rounded-2xl font-black italic text-xs uppercase tracking-widest transition-all">Salir</button>
             <button onClick={resetChat} className="bg-blue-600 hover:bg-blue-500 text-white px-10 py-4 rounded-2xl font-black italic text-xs uppercase tracking-widest transition-all shadow-xl flex items-center gap-3">
               <RefreshCcw size={16} /> Nueva Gestión
             </button>
           </div>
        </div>
      )}

      {/* Header */}
      <div className="p-6 bg-blue-600/10 border-b border-white/10 flex justify-between items-center shrink-0">
        <div className="flex items-center gap-4">
          <button onClick={onBack} className="p-2 hover:bg-white/5 rounded-xl text-gray-400 hover:text-white transition-all flex items-center gap-2 text-[10px] font-black uppercase tracking-widest">
            <ChevronLeft size={16} /> Volver
          </button>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-600 rounded-2xl flex items-center justify-center shadow-lg shadow-blue-600/20">
              <Zap size={20} fill="white" className="text-white" />
            </div>
            <div>
              <span className="text-xs font-black uppercase tracking-widest italic block">NEXUM CONCIERGE</span>
              <span className="text-[8px] text-blue-400 font-bold uppercase tracking-widest">Events & Tables AI</span>
            </div>
          </div>
        </div>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-8 space-y-6 custom-scrollbar flex flex-col bg-fixed">
        {messages.length === 0 && (
          <div className="flex-1 flex flex-col items-center justify-center text-center opacity-40 space-y-6 py-10">
            <Sparkles size={48} className="text-blue-500 animate-pulse" />
            <p className="text-xs font-black uppercase tracking-[0.3em] max-w-xs leading-relaxed">Bienvenido a OMM. Puedo ayudarte con una reserva de mesa o entradas para nuestros eventos.</p>
          </div>
        )}
        {messages.map((msg, idx) => (
          <div key={idx} className={`flex w-full ${msg.role === 'user' ? 'justify-end' : 'justify-start'} animate-in slide-in-from-bottom-2`}>
            <div className={`flex gap-3 max-w-[85%] ${msg.role === 'user' ? 'flex-row-reverse' : 'items-end'}`}>
              <div className={`w-8 h-8 rounded-xl shrink-0 flex items-center justify-center shadow-lg ${msg.role === 'user' ? 'bg-blue-600' : 'bg-[#1a1a1e] border border-white/10'}`}>
                {msg.role === 'user' ? <User size={14} className="text-white" /> : <Zap size={14} className="text-blue-500" />}
              </div>
              <div className={`px-6 py-4 rounded-[2rem] text-[11px] font-medium leading-relaxed italic shadow-2xl ${msg.role === 'user' ? 'bg-blue-600 text-white rounded-tr-none' : 'bg-[#1a1a1e] text-gray-300 border border-white/5 rounded-bl-none'}`}>
                {msg.text.includes("CONFIRMAR_") ? "Procesando tu solicitud..." : msg.text}
              </div>
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex justify-start animate-in fade-in">
             <div className="flex gap-3 items-end">
                <div className="w-8 h-8 rounded-xl bg-[#1a1a1e] flex items-center justify-center"><Zap size={14} className="text-blue-500 animate-pulse" /></div>
                <div className="bg-[#1a1a1e] px-6 py-4 rounded-2xl rounded-bl-none border border-white/5 flex items-center gap-3">
                   <Loader2 size={14} className="animate-spin text-blue-500" />
                   <span className="text-[9px] text-gray-500 font-black uppercase italic">NEXUM analizando...</span>
                </div>
             </div>
          </div>
        )}
      </div>

      {/* Input */}
      <form onSubmit={handleSend} className="p-8 bg-black/60 border-t border-white/10 shrink-0 backdrop-blur-xl">
        <div className="relative group flex gap-3">
          <input 
            type="text" 
            value={input}
            onChange={(e) => setInput(e.target.value)}
            disabled={loading || bookingStatus !== 'idle'}
            placeholder={bookingStatus !== 'idle' ? "Gestión completada." : "Pregúntame por eventos o reserva una mesa..."}
            className="flex-1 bg-white/5 border border-white/5 rounded-[1.8rem] py-5 px-8 text-[11px] font-black italic text-white outline-none focus:border-blue-500 transition-all placeholder:text-gray-700 disabled:opacity-30"
          />
          <button type="submit" disabled={!input.trim() || loading || bookingStatus !== 'idle'} className="bg-blue-600 hover:bg-blue-500 text-white p-5 rounded-2xl transition-all shadow-xl flex items-center justify-center shrink-0 disabled:opacity-50">
            <Send size={20} />
          </button>
        </div>
      </form>
    </div>
  );
};

export default AIConcierge;
