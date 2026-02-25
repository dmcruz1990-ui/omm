
import React, { useState, useEffect } from 'react';
import { 
  Calendar, 
  X, 
  Mail, 
  Loader2, 
  Phone,
  User
} from 'lucide-react';
import { supabase } from '../lib/supabase.ts';
import { OmmEvent } from '../types.ts';

const EventsModule: React.FC = () => {
  const [events, setEvents] = useState<OmmEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedEvent, setSelectedEvent] = useState<OmmEvent | null>(null);
  const [isBuying, setIsBuying] = useState(false);
  
  const [formData, setFormData] = useState({ name: '', phone: '', email: '' });
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
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
    const ticketCode = `TKT-${Date.now()}-${Math.random().toString(36).substr(2, 4).toUpperCase()}`;
    try {
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
      setIsBuying(false);
      setFormData({ name: '', phone: '', email: '' });
    } catch {
      // ignore
    } finally {
      setIsProcessing(false);
    }
  };

  if (loading) return (
    <div className="flex flex-col items-center justify-center py-20 opacity-40">
      <Loader2 className="animate-spin text-blue-500 mb-4" size={32} />
      <p className="text-[10px] font-black uppercase tracking-widest">Sincronizando Cartelera...</p>
    </div>
  );

  return (
    <div className="space-y-12 animate-in fade-in duration-700">
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-8">
        {events.map((event) => (
          <div key={event.id} className="bg-[#111114] border border-white/5 rounded-[3rem] overflow-hidden group hover:border-blue-500/30 transition-all flex flex-col shadow-2xl h-full">
            <div className="aspect-[4/3] relative overflow-hidden">
               <img src={event.image_url} alt={event.title} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700 opacity-80" />
               <div className="absolute top-6 left-6 bg-black/60 backdrop-blur-md px-4 py-2 rounded-2xl border border-white/10 flex items-center gap-2">
                  <span className="text-[9px] font-black uppercase tracking-widest text-white">{event.category}</span>
               </div>
            </div>
            <div className="p-8 space-y-4 flex-1 flex flex-col justify-between">
               <div>
                  <h4 className="text-xl font-black italic uppercase tracking-tighter leading-tight mb-2">{event.title}</h4>
                  <div className="flex items-center gap-2 text-gray-500 text-[10px] font-bold uppercase mb-4 tracking-widest">
                     <Calendar size={14} className="text-blue-500" />
                     {new Date(event.date).toLocaleDateString()}
                  </div>
               </div>
               <div className="pt-6 border-t border-white/5 flex items-center justify-between">
                  <span className="text-lg font-black italic text-white">${event.price.toLocaleString()}</span>
                  <button onClick={() => { setSelectedEvent(event); setIsBuying(true); }} className="bg-white/5 hover:bg-blue-600 hover:text-white px-6 py-3 rounded-2xl text-[9px] font-black uppercase tracking-widest border border-white/5 transition-all">COMPRAR</button>
               </div>
            </div>
          </div>
        ))}
      </div>
      {isBuying && selectedEvent && (
        <div className="fixed inset-0 z-[500] flex items-center justify-center p-6 animate-in fade-in backdrop-blur-2xl">
           <div className="absolute inset-0 bg-black/80" onClick={() => setIsBuying(false)}></div>
           <div className="bg-[#0a0a0c] border border-white/10 rounded-[3.5rem] w-full max-w-xl relative z-10 overflow-hidden shadow-2xl">
              <div className="p-10 border-b border-white/5 flex justify-between items-center bg-gradient-to-r from-blue-600/10 to-transparent">
                 <h3 className="text-2xl font-black italic uppercase tracking-tighter">Reserva tu Espacio</h3>
                 <button onClick={() => setIsBuying(false)} className="text-gray-500 hover:text-white"><X size={24} /></button>
              </div>
              <form onSubmit={handlePurchase} className="p-10 space-y-6">
                 <InputField label="Nombre" placeholder="Tu nombre" icon={<User size={16} />} value={formData.name} onChange={(v: string) => setFormData({...formData, name: v})} />
                 <InputField label="Teléfono" placeholder="+57" icon={<Phone size={16} />} value={formData.phone} onChange={(v: string) => setFormData({...formData, phone: v})} />
                 <InputField label="Correo" placeholder="mail@omm.com" icon={<Mail size={16} />} value={formData.email} onChange={(v: string) => setFormData({...formData, email: v})} />
                 <button type="submit" disabled={isProcessing} className="w-full bg-blue-600 text-white py-4 rounded-2xl font-black text-[10px] uppercase transition-all">
                    {isProcessing ? 'PROCESANDO...' : 'CONFIRMAR PAGO'}
                 </button>
              </form>
           </div>
        </div>
      )}
    </div>
  );
};

interface InputFieldProps {
  label: string;
  placeholder: string;
  icon: React.ReactNode;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}

const InputField = ({ label, placeholder, icon, value, onChange, disabled }: InputFieldProps) => (
  <div className="space-y-2 text-left group">
     <label className="text-[10px] font-black text-gray-600 uppercase ml-1">{label}</label>
     <div className="relative">
        <div className="absolute left-5 top-1/2 -translate-y-1/2 text-gray-600">{icon}</div>
        <input type="text" placeholder={placeholder} value={value} disabled={disabled} onChange={(e) => onChange(e.target.value)} className="w-full bg-white/5 border border-white/5 rounded-2xl py-5 pl-14 pr-6 text-[11px] font-black italic text-white outline-none focus:border-blue-500 transition-all" />
     </div>
  </div>
);

export default EventsModule;
