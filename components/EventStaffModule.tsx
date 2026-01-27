
import React, { useState, useEffect, useRef } from 'react';
import { 
  Users, 
  Search, 
  CheckCircle2, 
  XCircle, 
  Loader2, 
  Scan, 
  UserCheck, 
  Ban, 
  Calendar, 
  ArrowRight,
  ShieldCheck,
  AlertTriangle,
  Clock,
  Ticket,
  RefreshCcw,
  Camera,
  CameraOff
} from 'lucide-react';
// Importación de librería para decodificar QR
import jsQR from 'https://esm.sh/jsqr';
import { supabase } from '../lib/supabase';
import { OmmEvent, EventTicket } from '../types';

const EventStaffModule: React.FC = () => {
  const [events, setEvents] = useState<OmmEvent[]>([]);
  const [selectedEventId, setSelectedEventId] = useState<string>('');
  const [tickets, setTickets] = useState<EventTicket[]>([]);
  const [loading, setLoading] = useState(true);
  const [scanInput, setScanInput] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);
  
  // Estados para Cámara
  const [isScanning, setIsScanning] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const scanFrameId = useRef<number | null>(null);

  const [verificationResult, setVerificationResult] = useState<{
    status: 'success' | 'error' | 'warning';
    message: string;
    customer?: string;
  } | null>(null);

  useEffect(() => {
    fetchEvents();
    return () => stopCamera();
  }, []);

  useEffect(() => {
    if (selectedEventId) {
      fetchTickets();
      
      const channel = supabase
        .channel(`tickets-sync-${selectedEventId}`)
        .on('postgres_changes', { 
          event: '*', 
          schema: 'public', 
          table: 'event_tickets',
          filter: `event_id=eq.${selectedEventId}`
        }, () => fetchTickets())
        .subscribe();

      return () => { supabase.removeChannel(channel); };
    }
  }, [selectedEventId]);

  const fetchEvents = async () => {
    try {
      const { data, error } = await supabase
        .from('events')
        .select('*')
        .order('date', { ascending: true });
      if (error) throw error;
      setEvents(data || []);
      if (data && data.length > 0) setSelectedEventId(data[0].id);
    } catch (err) {
      console.error("Error fetching events:", err);
    } finally {
      setLoading(false);
    }
  };

  const fetchTickets = async () => {
    if (!selectedEventId) return;
    try {
      const { data, error } = await supabase
        .from('event_tickets')
        .select('*')
        .eq('event_id', selectedEventId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      setTickets(data || []);
    } catch (err) {
      console.error("Error fetching tickets:", err);
    }
  };

  // --- Lógica de Cámara y QR ---
  const startCamera = async () => {
    setVerificationResult(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' } // Cámara trasera preferida
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        setIsScanning(true);
        // Iniciar bucle de detección
        requestAnimationFrame(tickScan);
      }
    } catch (err) {
      console.error("No se pudo acceder a la cámara:", err);
      alert("Error: No se pudo acceder a la cámara. Asegúrate de dar permisos.");
    }
  };

  const stopCamera = () => {
    setIsScanning(false);
    if (scanFrameId.current) cancelAnimationFrame(scanFrameId.current);
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach(track => track.stop());
      videoRef.current.srcObject = null;
    }
  };

  const tickScan = () => {
    if (!videoRef.current || !canvasRef.current || videoRef.current.readyState !== videoRef.current.HAVE_ENOUGH_DATA) {
      scanFrameId.current = requestAnimationFrame(tickScan);
      return;
    }

    const canvas = canvasRef.current;
    const video = videoRef.current;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });

    if (ctx) {
      canvas.height = video.videoHeight;
      canvas.width = video.videoWidth;
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const code = jsQR(imageData.data, imageData.width, imageData.height, {
        inversionAttempts: "dontInvert",
      });

      if (code) {
        console.log("QR Detectado:", code.data);
        stopCamera();
        setScanInput(code.data);
        // Validar inmediatamente
        handleVerifyTicket(undefined, code.data);
      } else {
        scanFrameId.current = requestAnimationFrame(tickScan);
      }
    }
  };

  const handleVerifyTicket = async (e?: React.FormEvent, directCode?: string) => {
    if (e) e.preventDefault();
    const codeToVerify = directCode || scanInput.trim();
    if (!codeToVerify || !selectedEventId) return;

    setIsVerifying(true);
    setVerificationResult(null);

    try {
      const { data, error } = await supabase
        .from('event_tickets')
        .select('*')
        .eq('ticket_code', codeToVerify)
        .eq('event_id', selectedEventId)
        .maybeSingle();

      if (error) throw error;

      if (!data) {
        setVerificationResult({ status: 'error', message: 'BOLETO INVÁLIDO O EVENTO INCORRECTO' });
      } else if (!data.is_paid) {
        setVerificationResult({ status: 'error', message: 'BOLETO ANULADO / SIN PAGO', customer: data.customer_name });
      } else if (data.checked_in) {
        setVerificationResult({ 
          status: 'warning', 
          message: `BOLETO YA UTILIZADO A LAS ${new Date(data.checked_in_at).toLocaleTimeString()}`, 
          customer: data.customer_name 
        });
      } else {
        // Registro exitoso
        const { error: updateError } = await supabase
          .from('event_tickets')
          .update({ 
            checked_in: true, 
            checked_in_at: new Date().toISOString() 
          })
          .eq('id', data.id);

        if (updateError) throw updateError;

        setVerificationResult({ 
          status: 'success', 
          message: 'ACCESO PERMITIDO', 
          customer: data.customer_name 
        });
        setScanInput('');
        fetchTickets();
      }
    } catch (err) {
      console.error("Verification error:", err);
      setVerificationResult({ status: 'error', message: 'ERROR EN EL SERVIDOR' });
    } finally {
      setIsVerifying(false);
      if (verificationResult?.status === 'success') {
        setTimeout(() => setVerificationResult(null), 3000);
      }
    }
  };

  const toggleVoidTicket = async (ticket: EventTicket) => {
    const confirm = window.confirm(`¿Estás seguro de que deseas ${ticket.is_paid ? 'ANULAR' : 'REACTIVAR'} la entrada de ${ticket.customer_name}?`);
    if (!confirm) return;

    try {
      const { error } = await supabase
        .from('event_tickets')
        .update({ is_paid: !ticket.is_paid })
        .eq('id', ticket.id);
      if (error) throw error;
      fetchTickets();
    } catch (err) {
      console.error("Error toggling ticket status:", err);
    }
  };

  if (loading) return (
    <div className="flex flex-col items-center justify-center py-20 opacity-40">
      <Loader2 className="animate-spin text-blue-500 mb-4" size={32} />
      <p className="text-[10px] font-black uppercase tracking-widest">Iniciando Nexus Staff Core...</p>
    </div>
  );

  return (
    <div className="space-y-10 animate-in fade-in duration-700 max-w-7xl mx-auto pb-20">
      
      {/* Header Staff */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-8 border-b border-white/5 pb-10">
        <div className="flex items-center gap-5">
           <div className="p-5 bg-[#111114] rounded-[2rem] border border-blue-500/30 shadow-2xl shadow-blue-600/10">
              <Scan className="text-blue-500" size={32} />
           </div>
           <div>
              <h2 className="text-4xl font-black italic tracking-tighter uppercase leading-none">Access Control</h2>
              <p className="text-gray-500 text-[10px] font-black uppercase tracking-[0.4em] mt-3 flex items-center gap-2">
                 <ShieldCheck size={14} className="text-blue-500" /> Staff Operational Node
              </p>
           </div>
        </div>

        <div className="relative min-w-[300px]">
           <select 
             value={selectedEventId}
             onChange={(e) => { setSelectedEventId(e.target.value); stopCamera(); }}
             className="w-full bg-[#111114] border border-white/10 rounded-2xl py-4 pl-6 pr-12 text-[10px] font-black uppercase tracking-widest outline-none focus:border-blue-500 transition-all appearance-none cursor-pointer"
           >
              {events.map(e => (
                <option key={e.id} value={e.id}>{e.title}</option>
              ))}
           </select>
           <Calendar className="absolute right-5 top-1/2 -translate-y-1/2 text-gray-600 pointer-events-none" size={18} />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
        
        {/* Lado Izquierdo: Scanner Real & Manual */}
        <div className="space-y-8">
           <div className="bg-[#111114] border border-white/5 rounded-[3.5rem] p-10 shadow-2xl relative overflow-hidden group">
              <div className="absolute top-0 right-0 p-8 opacity-5">
                 <Scan size={120} className="text-blue-500" />
              </div>

              <div className="relative z-10 space-y-8">
                 <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-blue-600/20 rounded-xl flex items-center justify-center text-blue-500">
                         <Ticket size={20} />
                      </div>
                      <div>
                         <h4 className="text-xs font-black uppercase tracking-widest italic leading-none">Verificación Live</h4>
                         <span className="text-[8px] text-blue-400 font-bold uppercase tracking-widest">Scanner or Manual</span>
                      </div>
                    </div>
                    {!isScanning ? (
                      <button onClick={startCamera} className="bg-blue-600/10 hover:bg-blue-600/20 p-3 rounded-xl text-blue-500 transition-all flex items-center gap-2 text-[8px] font-black uppercase">
                        <Camera size={14} /> ACTIVA CÁMARA
                      </button>
                    ) : (
                      <button onClick={stopCamera} className="bg-red-600/10 hover:bg-red-600/20 p-3 rounded-xl text-red-500 transition-all flex items-center gap-2 text-[8px] font-black uppercase">
                        <CameraOff size={14} /> APAGAR
                      </button>
                    )}
                 </div>

                 {/* Visor de Cámara */}
                 {isScanning && (
                   <div className="relative aspect-square rounded-[2rem] overflow-hidden border-2 border-blue-500/50 bg-black animate-in zoom-in duration-300">
                      <video ref={videoRef} autoPlay playsInline className="w-full h-full object-cover grayscale brightness-125 contrast-125" />
                      <canvas ref={canvasRef} className="hidden" />
                      
                      {/* Overlay Scanner UX */}
                      <div className="absolute inset-0 border-[40px] border-black/40"></div>
                      <div className="absolute top-1/2 left-0 right-0 h-[2px] bg-blue-500 shadow-[0_0_15px_rgba(59,130,246,0.8)] animate-[scan_2s_ease-in-out_infinite]"></div>
                      <style>{`
                        @keyframes scan {
                          0%, 100% { top: 20%; opacity: 0.2; }
                          50% { top: 80%; opacity: 1; }
                        }
                      `}</style>
                      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 text-[8px] font-black uppercase tracking-[0.3em] text-blue-400 bg-black/60 px-4 py-1.5 rounded-full backdrop-blur-md">
                        Buscando Código QR...
                      </div>
                   </div>
                 )}

                 <form onSubmit={handleVerifyTicket} className="space-y-4">
                    <div className="relative group">
                       <Scan className="absolute left-6 top-1/2 -translate-y-1/2 text-gray-600 group-focus-within:text-blue-500 transition-colors" size={20} />
                       <input 
                         type="text" 
                         placeholder="TKT-000-000"
                         value={scanInput}
                         onChange={(e) => setScanInput(e.target.value.toUpperCase())}
                         className="w-full bg-black/40 border border-white/5 rounded-3xl py-6 pl-16 pr-6 text-xl font-black italic tracking-widest uppercase outline-none focus:border-blue-500 transition-all placeholder:text-gray-800"
                       />
                    </div>
                    <button 
                      type="submit"
                      disabled={isVerifying || !scanInput}
                      className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-30 text-white py-6 rounded-3xl font-black text-xs uppercase tracking-widest shadow-xl shadow-blue-600/20 flex items-center justify-center gap-3 active:scale-95 transition-all"
                    >
                       {isVerifying ? <Loader2 className="animate-spin" /> : <><CheckCircle2 size={18} /> VALIDAR ACCESO</>}
                    </button>
                 </form>

                 <div className="pt-8 border-t border-white/5 space-y-4">
                    <div className="flex justify-between items-center text-[10px] font-black uppercase tracking-widest text-gray-500">
                       <span>Total Entradas</span>
                       <span className="text-white">{tickets.length}</span>
                    </div>
                    <div className="flex justify-between items-center text-[10px] font-black uppercase tracking-widest text-gray-500">
                       <span>Adentro / Fuera</span>
                       <span className="text-blue-500">
                          {tickets.filter(t => t.checked_in).length} / {tickets.filter(t => !t.checked_in).length}
                       </span>
                    </div>
                 </div>
              </div>
           </div>

           {/* Feedback del Scanner */}
           {verificationResult && (
             <div className={`p-8 rounded-[3rem] border-2 animate-in zoom-in duration-500 shadow-2xl ${
               verificationResult.status === 'success' ? 'bg-green-600/10 border-green-500/30' : 
               verificationResult.status === 'warning' ? 'bg-yellow-600/10 border-yellow-500/30' : 'bg-red-600/10 border-red-500/30'
             }`}>
                <div className="flex flex-col items-center text-center space-y-4">
                   {verificationResult.status === 'success' ? <UserCheck className="text-green-500" size={48} /> : 
                    verificationResult.status === 'warning' ? <AlertTriangle className="text-yellow-500" size={48} /> : <XCircle className="text-red-500" size={48} />}
                   
                   <div>
                      <h4 className={`text-2xl font-black italic uppercase tracking-tighter ${
                        verificationResult.status === 'success' ? 'text-green-500' : 
                        verificationResult.status === 'warning' ? 'text-yellow-500' : 'text-red-500'
                      }`}>
                         {verificationResult.message}
                      </h4>
                      {verificationResult.customer && (
                        <p className="text-xs font-black text-white uppercase mt-2">{verificationResult.customer}</p>
                      )}
                   </div>
                   
                   <button 
                     onClick={() => setVerificationResult(null)}
                     className="text-[9px] font-black uppercase tracking-widest text-gray-500 hover:text-white transition-colors"
                   >
                     CERRAR AVISO
                   </button>
                </div>
             </div>
           )}
        </div>

        {/* Lado Derecho: Guest List */}
        <div className="lg:col-span-2 space-y-8">
           <div className="bg-[#111114] border border-white/5 rounded-[3.5rem] overflow-hidden shadow-2xl flex flex-col">
              <div className="p-10 border-b border-white/5 flex items-center justify-between bg-white/5">
                 <div>
                    <h3 className="text-xl font-black italic uppercase tracking-tighter">Guest List</h3>
                    <p className="text-[9px] text-gray-500 font-black uppercase tracking-widest mt-1">Registros del evento en tiempo real</p>
                 </div>
                 <div className="bg-black/40 border border-white/10 px-6 py-3 rounded-2xl flex items-center gap-3">
                    <Users size={16} className="text-blue-500" />
                    <span className="text-[10px] font-black uppercase text-white">{tickets.length} ASISTENTES</span>
                 </div>
              </div>

              <div className="overflow-x-auto">
                 <table className="w-full text-left">
                    <thead>
                       <tr className="bg-black/20 text-[8px] font-black text-gray-600 uppercase tracking-[0.3em]">
                          <th className="px-8 py-6">Cliente</th>
                          <th className="px-8 py-6">Ticket Code</th>
                          <th className="px-8 py-6 text-center">Estado</th>
                          <th className="px-8 py-6 text-right">Acciones</th>
                       </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                       {tickets.map((ticket) => (
                          <tr key={ticket.id} className="group hover:bg-white/[0.02] transition-colors">
                             <td className="px-8 py-6">
                                <div className="flex flex-col">
                                   <span className="text-xs font-black uppercase italic text-white">{ticket.customer_name}</span>
                                   <span className="text-[9px] text-gray-600 font-bold">{ticket.customer_email}</span>
                                </div>
                             </td>
                             <td className="px-8 py-6">
                                <span className="text-[10px] font-black italic font-mono text-blue-500">{ticket.ticket_code}</span>
                             </td>
                             <td className="px-8 py-6 text-center">
                                {ticket.checked_in ? (
                                   <div className="inline-flex flex-col items-center">
                                      <div className="bg-green-600/10 text-green-500 px-3 py-1.5 rounded-xl border border-green-500/20 flex items-center gap-2">
                                         <UserCheck size={12} />
                                         <span className="text-[8px] font-black uppercase tracking-widest">ENTRÓ</span>
                                      </div>
                                      <span className="text-[7px] text-gray-600 font-bold mt-1 uppercase flex items-center gap-1">
                                         <Clock size={8} /> {new Date(ticket.checked_in_at!).toLocaleTimeString()}
                                      </span>
                                   </div>
                                ) : (
                                   <div className={`inline-flex px-3 py-1.5 rounded-xl border flex items-center gap-2 ${
                                     ticket.is_paid ? 'bg-blue-600/10 text-blue-500 border-blue-500/20' : 'bg-red-600/10 text-red-500 border-red-500/20'
                                   }`}>
                                      {ticket.is_paid ? <Ticket size={12} /> : <Ban size={12} />}
                                      <span className="text-[8px] font-black uppercase tracking-widest">
                                         {ticket.is_paid ? 'PENDIENTE' : 'ANULADO'}
                                      </span>
                                   </div>
                                )}
                             </td>
                             <td className="px-8 py-6 text-right">
                                <button 
                                  onClick={() => toggleVoidTicket(ticket)}
                                  className={`p-3 rounded-xl border transition-all ${
                                    ticket.is_paid ? 'border-white/5 text-gray-600 hover:text-red-500 hover:bg-red-500/10' : 'border-red-500/30 bg-red-500/10 text-red-500 hover:bg-red-500/20'
                                  }`}
                                  title={ticket.is_paid ? 'Anular Entrada' : 'Reactivar Entrada'}
                                >
                                   {ticket.is_paid ? <Ban size={16} /> : <RefreshCcw size={16} />}
                                </button>
                             </td>
                          </tr>
                       ))}
                       {tickets.length === 0 && (
                          <tr>
                             <td colSpan={4} className="px-8 py-20 text-center opacity-20">
                                <Users className="mx-auto mb-4" size={48} />
                                <h4 className="text-xl font-black italic uppercase">No hay registros para este evento</h4>
                             </td>
                          </tr>
                       )}
                    </tbody>
                 </table>
              </div>
           </div>
        </div>

      </div>

    </div>
  );
};

export default EventStaffModule;
