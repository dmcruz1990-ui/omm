
import React, { useState, useRef, useEffect } from 'react';
import { Send, Zap, Loader2, User, Sparkles, ChevronLeft, CheckCircle, RefreshCcw, Table as TableIcon, AlertCircle, Users } from 'lucide-react';
import { askNexumAI } from '../lib/ai/brain';
import { supabase } from '../lib/supabase';

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
  const [bookingStatus, setBookingStatus] = useState<'idle' | 'processing' | 'success' | 'waitlist' | 'error'>('idle');
  const [reservationDetails, setReservationDetails] = useState<any>(null);
  const [debugInfo, setDebugInfo] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, loading]);

  const resetChat = () => {
    setMessages([]);
    setInput('');
    setBookingStatus('idle');
    setReservationDetails(null);
    setDebugInfo(null);
  };

  const processReservationTransaction = async (responseText: string) => {
    if (!responseText.includes("CONFIRMAR_RESERVA")) return;

    setBookingStatus('processing');
    setDebugInfo(null);

    try {
      // 1. Extraer la línea o segmento de confirmación
      const startIndex = responseText.indexOf("CONFIRMAR_RESERVA");
      const confirmSegment = responseText.substring(startIndex).split('\n')[0];
      
      // 2. Split por comas como solicita la tarea (5 partes totales esperadas)
      const dataArray = confirmSegment.split(",").map(s => s.trim().replace(/[\[\]]/g, ''));

      if (dataArray.length < 5) {
        throw new Error(`Formato insuficiente: se detectaron ${dataArray.length} partes, se requieren 5.`);
      }

      /**
       * Mapeo según Instrucción:
       * dataArray[0] -> "CONFIRMAR_RESERVA: Nombre"
       * dataArray[1] -> Telefono
       * dataArray[2] -> Fecha y Hora (Juntas)
       * dataArray[3] -> Personas (Parse Int)
       * dataArray[4] -> Plan
       */

      // Extraer nombre del primer segmento (limpiando el prefijo)
      const namePart = dataArray[0];
      const name = namePart.includes(":") ? namePart.split(":")[1].trim() : namePart.replace("CONFIRMAR_RESERVA", "").trim();
      
      const phone = dataArray[1];
      const dateInfo = dataArray[2];
      const paxStr = dataArray[3];
      const plan = dataArray[4];
      
      const numPax = parseInt(paxStr) || 2;

      // A. Buscar o Crear Cliente
      let { data: customer } = await supabase
        .from('customers')
        .select('id')
        .eq('phone', phone)
        .maybeSingle();

      let customerId;
      if (!customer) {
        const { data: newCust, error: custCreateError } = await supabase
          .from('customers')
          .insert([{ name, phone, vip_status: false }])
          .select('id')
          .single();
        
        if (custCreateError) throw custCreateError;
        customerId = newCust.id;
      } else {
        customerId = customer.id;
      }

      // B. Buscar Mesa Libre con Capacidad (Lógica: capacity >= numPax)
      const { data: table } = await supabase
        .from('tables')
        .select('id, zone')
        .eq('status', 'free')
        .gte('capacity', numPax)
        .order('capacity', { ascending: true })
        .limit(1)
        .maybeSingle();

      // C. Guardar Reserva (Mesa encontrada vs Lista de Espera)
      const isWaitlist = !table;
      
      const { data: reservation, error: resError } = await supabase
        .from('reservations')
        .insert([{
          customer_id: customerId,
          table_id: table ? table.id : null,
          reservation_time: dateInfo,
          pax: numPax,
          plan: plan,
          status: isWaitlist ? 'waiting_list' : 'confirmed',
          type: (plan || "").toLowerCase().includes('master') ? 'VIP' : 'Normal'
        }])
        .select()
        .single();

      if (resError) throw resError;

      // D. Actualizar Estado de Mesa (Solo si se asignó)
      if (table) {
        await supabase.from('tables').update({ status: 'reserved' }).eq('id', table.id);
      }

      // E. Éxito
      setReservationDetails({
        id: table ? table.id : 'Waitlist',
        zone: table ? table.zone : 'Fila Virtual',
        name,
        time: dateInfo,
        pax: numPax,
        isWaitlist
      });
      setBookingStatus(isWaitlist ? 'waitlist' : 'success');

      const finalMsg = isWaitlist 
        ? "He registrado tus datos en nuestra Lista de Espera prioritaria ya que no tenemos mesas disponibles de inmediato. Te notificaremos en cuanto se libere un espacio."
        : "¡Excelente! He confirmado tu reserva y asignado una mesa. Aquí tienes los detalles.";
      
      setMessages(prev => [...prev, { role: 'model', text: finalMsg }]);

    } catch (error: any) {
      console.error("Critical Reservation Error:", error);
      setBookingStatus('error');
      setDebugInfo(`${error.message} | Segmento: ${responseText.substring(responseText.indexOf("CONFIRMAR_RESERVA"))}`);
    }
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || loading || ['success', 'waitlist'].includes(bookingStatus)) return;

    const userText = input.trim();
    setInput('');
    setDebugInfo(null);
    
    const currentHistory = [...messages];
    setMessages(prev => [...prev, { role: 'user', text: userText }]);
    setLoading(true);

    try {
      const response = await askNexumAI(userText, currentHistory);
      setMessages(prev => [...prev, { role: 'model', text: response }]);
      
      if (response.includes("CONFIRMAR_RESERVA")) {
        await processReservationTransaction(response);
      }
    } catch (error) {
      console.error("Chat Error:", error);
      setMessages(prev => [...prev, { role: 'model', text: "Lo siento, tuve problemas de conexión. ¿Podrías intentar de nuevo?" }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-3xl mx-auto bg-[#111114] border border-white/5 rounded-[3.5rem] overflow-hidden flex flex-col h-[700px] shadow-2xl relative animate-in zoom-in duration-500">
      
      {/* HUD de Éxito / Lista de Espera */}
      {['success', 'waitlist'].includes(bookingStatus) && reservationDetails && (
        <div className="absolute inset-0 z-[100] bg-black/95 backdrop-blur-2xl flex flex-col items-center justify-center p-12 text-center animate-in fade-in duration-500">
           <div className={`${reservationDetails.isWaitlist ? 'bg-amber-500' : 'bg-green-600'} p-8 rounded-full shadow-[0_0_60px_rgba(34,197,94,0.3)] mb-8 animate-in zoom-in duration-700`}>
              {reservationDetails.isWaitlist ? <Users size={64} className="text-white" /> : <CheckCircle size={64} className="text-white" />}
           </div>
           
           <h2 className="text-4xl font-black italic tracking-tighter uppercase mb-2">
             {reservationDetails.isWaitlist ? '¡En Lista de Espera!' : '¡Reserva Confirmada!'}
           </h2>
           <p className="text-gray-400 text-xs font-black uppercase tracking-[0.3em] mb-10 italic">
             {reservationDetails.isWaitlist ? 'NEXUM Queue Management' : 'NEXUM Cloud Sync Complete'}
           </p>
           
           <div className="bg-white/5 border border-white/10 rounded-[2.5rem] p-8 w-full max-w-sm mb-12 space-y-4">
              <div className="flex justify-between items-center border-b border-white/5 pb-4">
                 <span className="text-[10px] text-gray-500 font-black uppercase">Estado</span>
                 <span className={`text-xl font-black italic ${reservationDetails.isWaitlist ? 'text-amber-500' : 'text-blue-500'}`}>
                   {reservationDetails.isWaitlist ? 'STANDBY' : `M-${reservationDetails.id}`}
                 </span>
              </div>
              <div className="flex justify-between items-center border-b border-white/5 pb-4">
                 <span className="text-[10px] text-gray-500 font-black uppercase">Zona</span>
                 <span className="text-sm font-black italic">{reservationDetails.zone}</span>
              </div>
              <div className="flex justify-between items-center">
                 <span className="text-[10px] text-gray-500 font-black uppercase">Pax / Hora</span>
                 <span className="text-sm font-black italic">{reservationDetails.pax} Personas • {reservationDetails.time}</span>
              </div>
           </div>

           <div className="flex gap-4">
             <button onClick={onBack} className="bg-white/5 hover:bg-white/10 text-white px-8 py-4 rounded-2xl font-black italic text-xs uppercase tracking-widest transition-all">Salir</button>
             <button onClick={resetChat} className="bg-blue-600 hover:bg-blue-500 text-white px-10 py-4 rounded-2xl font-black italic text-xs uppercase tracking-widest transition-all shadow-xl shadow-blue-600/30 flex items-center gap-3">
               <RefreshCcw size={16} /> Nueva Reserva
             </button>
           </div>
        </div>
      )}

      {/* Header */}
      <div className="p-6 bg-blue-600/10 border-b border-white/10 flex justify-between items-center shrink-0">
        <div className="flex items-center gap-4">
          {onBack && (
            <button onClick={onBack} className="p-2 hover:bg-white/5 rounded-xl text-gray-400 hover:text-white transition-all flex items-center gap-2 text-[10px] font-black uppercase tracking-widest">
              <ChevronLeft size={16} /> Volver
            </button>
          )}
          <div className="h-8 w-[1px] bg-white/10 mx-2 hidden md:block"></div>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-600 rounded-2xl flex items-center justify-center shadow-lg shadow-blue-600/20">
              <Zap size={20} fill="white" className="text-white" />
            </div>
            <div>
              <span className="text-xs font-black uppercase tracking-widest italic block">NEXUM CONCIERGE</span>
              <span className="text-[8px] text-blue-400 font-bold uppercase tracking-widest leading-none">Automated Booking AI</span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
           <div className={`w-2 h-2 rounded-full animate-pulse ${['processing'].includes(bookingStatus) ? 'bg-yellow-500' : 'bg-green-500'}`}></div>
           <span className="text-[9px] text-gray-500 font-black uppercase tracking-[0.2em]">DB Connected</span>
        </div>
      </div>

      {/* Messages */}
      <div 
        ref={scrollRef} 
        className="flex-1 overflow-y-auto p-8 space-y-6 custom-scrollbar flex flex-col scroll-smooth bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] bg-fixed"
      >
        {messages.length === 0 && (
          <div className="flex-1 flex flex-col items-center justify-center text-center opacity-40 space-y-6 py-10">
            <div className="w-16 h-16 bg-white/5 rounded-3xl flex items-center justify-center border border-white/10">
                <Sparkles size={32} className="text-blue-500" />
            </div>
            <div className="space-y-2">
                <p className="text-xs font-black uppercase tracking-[0.3em] max-w-xs leading-relaxed">Bienvenido a OMM. ¿Qué tipo de experiencia buscas hoy?</p>
                <p className="text-[10px] text-gray-600 font-bold italic">Reserva en segundos con nuestro asistente.</p>
            </div>
          </div>
        )}
        
        {messages.map((msg, idx) => (
          <div key={idx} className={`flex w-full ${msg.role === 'user' ? 'justify-end' : 'justify-start'} animate-in slide-in-from-bottom-2 duration-300`}>
            <div className={`flex gap-3 max-w-[85%] ${msg.role === 'user' ? 'flex-row-reverse' : 'items-end'}`}>
              <div className={`w-8 h-8 rounded-xl shrink-0 flex items-center justify-center shadow-lg ${msg.role === 'user' ? 'bg-blue-600' : 'bg-[#1a1a1e] border border-white/10'}`}>
                {msg.role === 'user' ? <User size={14} className="text-white" /> : <Zap size={14} className="text-blue-500" />}
              </div>
              <div className={`px-6 py-4 rounded-[2rem] text-[11px] font-medium leading-relaxed italic shadow-2xl ${msg.role === 'user' ? 'bg-blue-600 text-white rounded-tr-none' : 'bg-[#1a1a1e] text-gray-300 border border-white/5 rounded-bl-none'}`}>
                {msg.text.includes("CONFIRMAR_RESERVA") ? "Procesando la confirmación de tu reserva..." : msg.text}
              </div>
            </div>
          </div>
        ))}
        
        {loading && (
          <div className="flex justify-start animate-in fade-in duration-300">
             <div className="flex gap-3 max-w-[85%] items-end">
                <div className="w-8 h-8 rounded-xl bg-[#1a1a1e] border border-white/10 flex items-center justify-center">
                  <Zap size={14} className="text-blue-500 animate-pulse" />
                </div>
                <div className="bg-[#1a1a1e] px-6 py-4 rounded-[2rem] rounded-bl-none border border-white/5 flex items-center gap-3">
                   <Loader2 size={14} className="animate-spin text-blue-500" />
                   <span className="text-[9px] text-gray-500 font-black uppercase tracking-widest italic">NEXUM está procesando...</span>
                </div>
             </div>
          </div>
        )}

        {/* Panel de Debug (Error de Formato) */}
        {debugInfo && bookingStatus === 'error' && (
           <div className="p-6 bg-red-600/20 border border-red-500/40 rounded-3xl animate-in zoom-in duration-300">
              <div className="flex items-center gap-3 text-red-500 mb-4">
                 <AlertCircle size={18} />
                 <span className="text-[10px] font-black uppercase tracking-widest">Error del Sistema</span>
              </div>
              <p className="text-[10px] text-red-400 font-medium leading-relaxed italic bg-black/40 p-4 rounded-2xl border border-red-500/10">
                 {debugInfo}
              </p>
              <button onClick={() => { setBookingStatus('idle'); setDebugInfo(null); }} className="mt-4 text-[9px] font-black uppercase text-red-400 underline tracking-widest">Reintentar</button>
           </div>
        )}

        {bookingStatus === 'processing' && !debugInfo && (
           <div className="flex justify-center py-4 animate-in fade-in scale-in duration-500">
             <div className="bg-blue-600/10 border border-blue-500/20 px-8 py-4 rounded-[2rem] flex items-center gap-4">
                <TableIcon size={20} className="text-blue-500 animate-pulse" />
                <span className="text-[10px] font-black uppercase tracking-[0.2em] italic text-blue-400">Verificando disponibilidad en tiempo real...</span>
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
            disabled={loading || ['processing', 'success', 'waitlist'].includes(bookingStatus)}
            placeholder={['success', 'waitlist'].includes(bookingStatus) ? "Reserva completada." : "Responde a Nexum..."}
            className="flex-1 bg-white/5 border border-white/5 rounded-[1.8rem] py-5 px-8 text-[11px] font-black italic text-white outline-none focus:border-blue-500 transition-all placeholder:text-gray-700 shadow-inner disabled:opacity-30"
          />
          <button type="submit" disabled={!input.trim() || loading || ['processing', 'success', 'waitlist'].includes(bookingStatus)} className="bg-blue-600 hover:bg-blue-500 disabled:bg-gray-800 disabled:opacity-50 text-white p-5 rounded-2xl transition-all active:scale-95 shadow-xl shadow-blue-600/30 flex items-center justify-center shrink-0">
            <Send size={20} />
          </button>
        </div>
        <p className="text-[8px] text-gray-700 font-black uppercase tracking-[0.2em] text-center mt-6 italic">Hospitality Intelligence Assistant • Robust Logic Enabled</p>
      </form>
    </div>
  );
};

export default AIConcierge;
