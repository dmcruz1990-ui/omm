
import React, { useState, useEffect, useRef } from 'react';
import { 
  Trophy, 
  Zap, 
  Timer, 
  Target, 
  TrendingUp, 
  Calendar, 
  Star, 
  Award,
  Loader2,
  ChevronRight,
  Sparkles,
  ShieldCheck,
  RefreshCcw,
  Scan,
  Ticket,
  Lock,
  Unlock,
  Users,
  Camera,
  CameraOff,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Clock,
  Ban
} from 'lucide-react';
import { GoogleGenAI } from "@google/genai";
import jsQR from 'https://esm.sh/jsqr';
import { supabase } from '../lib/supabase';
import { RitualTask, OmmEvent, EventTicket } from '../types';

interface StaffKPIs {
  staffId: string;
  name: string;
  tasksCompleted: number;
  avgSpeed: number; 
  aiAdvice?: string;
  weeklyPlan?: string[];
  isCoaching: boolean;
}

const StaffHubModule: React.FC = () => {
  const [activeView, setActiveView] = useState<'performance' | 'events'>('performance');
  const [loading, setLoading] = useState(true);
  const [staffStats, setStaffStats] = useState<StaffKPIs[]>([]);
  
  // Estados de Seguridad Eventos
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [pin, setPin] = useState('');
  const [pinError, setPinError] = useState(false);

  // Estados de Eventos
  const [events, setEvents] = useState<OmmEvent[]>([]);
  const [selectedEventId, setSelectedEventId] = useState<string>('');
  const [tickets, setTickets] = useState<EventTicket[]>([]);
  const [scanInput, setScanInput] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [verificationResult, setVerificationResult] = useState<{
    status: 'success' | 'error' | 'warning';
    message: string;
    customer?: string;
  } | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const scanFrameId = useRef<number | null>(null);

  useEffect(() => {
    if (activeView === 'performance') fetchStaffPerformance();
    else fetchEvents();
    return () => stopCamera();
  }, [activeView]);

  useEffect(() => {
    if (selectedEventId && activeView === 'events') {
      fetchTickets();
      const channel = supabase
        .channel(`staff-tickets-${selectedEventId}`)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'event_tickets', filter: `event_id=eq.${selectedEventId}` }, () => fetchTickets())
        .subscribe();
      return () => { supabase.removeChannel(channel); };
    }
  }, [selectedEventId, activeView]);

  const fetchStaffPerformance = async () => {
    setLoading(true);
    try {
      const { data: profiles } = await supabase.from('profiles').select('id, full_name, email').eq('role', 'mesero');
      const { data: tasks } = await supabase.from('ritual_tasks').select('*').eq('status', 'completed');
      if (!profiles) return;
      const performanceData = profiles.map(profile => {
        const staffTasks = (tasks || []).filter(t => t.staff_id === profile.id);
        const totalTasks = staffTasks.length;
        let totalMinutes = 0;
        staffTasks.forEach(t => {
          if (t.started_at && t.completed_at) {
            const start = new Date(t.started_at).getTime();
            const end = new Date(t.completed_at).getTime();
            totalMinutes += (end - start) / 60000;
          }
        });
        return {
          staffId: profile.id,
          name: profile.full_name || profile.email.split('@')[0],
          tasksCompleted: totalTasks,
          avgSpeed: parseFloat((totalTasks > 0 ? totalMinutes / totalTasks : 0).toFixed(1)),
          isCoaching: false
        };
      });
      performanceData.sort((a, b) => b.tasksCompleted - a.tasksCompleted);
      setStaffStats(performanceData);
    } finally { setLoading(false); }
  };

  const fetchEvents = async () => {
    setLoading(true);
    try {
      const { data } = await supabase.from('events').select('*').order('date', { ascending: true });
      setEvents(data || []);
      if (data && data.length > 0) setSelectedEventId(data[0].id);
    } finally { setLoading(false); }
  };

  const fetchTickets = async () => {
    if (!selectedEventId) return;
    const { data } = await supabase.from('event_tickets').select('*').eq('event_id', selectedEventId).order('created_at', { ascending: false });
    setTickets(data || []);
  };

  // --- Lógica de Seguridad ---
  const handlePinSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (pin === '8888') { // PIN Maestro OMM
      setIsAuthorized(true);
      setPinError(false);
    } else {
      setPinError(true);
      setPin('');
      setTimeout(() => setPinError(false), 2000);
    }
  };

  // --- Lógica de Cámara QR ---
  const startCamera = async () => {
    setVerificationResult(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        setIsScanning(true);
        requestAnimationFrame(tickScan);
      }
    } catch (err) { alert("Error de cámara: Permisos denegados."); }
  };

  const stopCamera = () => {
    setIsScanning(false);
    if (scanFrameId.current) cancelAnimationFrame(scanFrameId.current);
    if (videoRef.current && videoRef.current.srcObject) {
      (videoRef.current.srcObject as MediaStream).getTracks().forEach(t => t.stop());
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
      const code = jsQR(imageData.data, imageData.width, imageData.height, { inversionAttempts: "dontInvert" });
      if (code) {
        stopCamera();
        setScanInput(code.data);
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
    try {
      const { data, error } = await supabase.from('event_tickets').select('*').eq('ticket_code', codeToVerify).eq('event_id', selectedEventId).maybeSingle();
      if (!data) setVerificationResult({ status: 'error', message: 'BOLETO INVÁLIDO' });
      else if (!data.is_paid) setVerificationResult({ status: 'error', message: 'BOLETO SIN PAGO', customer: data.customer_name });
      else if (data.checked_in) setVerificationResult({ status: 'warning', message: `YA ENTRÓ: ${new Date(data.checked_in_at).toLocaleTimeString()}`, customer: data.customer_name });
      else {
        await supabase.from('event_tickets').update({ checked_in: true, checked_in_at: new Date().toISOString() }).eq('id', data.id);
        setVerificationResult({ status: 'success', message: 'ACCESO PERMITIDO', customer: data.customer_name });
        setScanInput('');
        fetchTickets();
      }
    } finally { setIsVerifying(false); }
  };

  const getAICoaching = async (index: number) => {
    const staff = staffStats[index];
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const newStats = [...staffStats];
    newStats[index].isCoaching = true;
    setStaffStats(newStats);
    try {
      const adviceResponse = await ai.models.generateContent({ model: 'gemini-3-flash-preview', contents: `Eres el coach de restaurante OMM. El mesero ${staff.name} hizo ${staff.tasksCompleted} tareas a ${staff.avgSpeed} min/paso. Consejo breve de 2 líneas.` });
      const planResponse = await ai.models.generateContent({ model: 'gemini-3-flash-preview', contents: `Plan táctico de 3 puntos para ${staff.name} esta semana (upselling, tiempos).` });
      const updatedStats = [...staffStats];
      updatedStats[index].aiAdvice = adviceResponse.text;
      updatedStats[index].weeklyPlan = planResponse.text?.split('\n').filter(p => p.trim() !== '');
      updatedStats[index].isCoaching = false;
      setStaffStats(updatedStats);
    } catch (err) {
      const updatedStats = [...staffStats];
      updatedStats[index].isCoaching = false;
      setStaffStats(updatedStats);
    }
  };

  if (loading) return (
    <div className="flex flex-col items-center justify-center py-40 opacity-40">
      <Loader2 className="animate-spin text-blue-500 mb-4" size={32} />
      <p className="text-[10px] font-black uppercase tracking-widest italic">Sincronizando Módulo OMM...</p>
    </div>
  );

  return (
    <div className="space-y-12 animate-in fade-in duration-700 max-w-7xl mx-auto pb-20">
      
      {/* Selector de Vista */}
      <div className="flex justify-center mb-8">
        <div className="bg-[#111114] p-2 rounded-[2rem] border border-white/5 flex gap-2">
           <button 
            onClick={() => setActiveView('performance')}
            className={`px-8 py-3.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-3 ${activeView === 'performance' ? 'bg-blue-600 text-white shadow-xl shadow-blue-600/20' : 'text-gray-500 hover:text-white'}`}
           >
             <Trophy size={14} /> RENDIMIENTO STAFF
           </button>
           <button 
            onClick={() => setActiveView('events')}
            className={`px-8 py-3.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-3 ${activeView === 'events' ? 'bg-blue-600 text-white shadow-xl shadow-blue-600/20' : 'text-gray-500 hover:text-white'}`}
           >
             <Scan size={14} /> CONTROL DE ACCESO
           </button>
        </div>
      </div>

      {activeView === 'performance' ? (
        <div className="space-y-12">
          {/* Header Performance */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-8 border-b border-white/5 pb-10">
            <div className="flex items-center gap-6">
               <div className="p-5 bg-blue-600 rounded-[2rem] shadow-2xl shadow-blue-600/20">
                  <Trophy className="text-white" size={32} />
               </div>
               <div>
                  <h2 className="text-4xl font-black italic tracking-tighter uppercase leading-none">Staff Ranking</h2>
                  <p className="text-gray-500 text-[10px] font-black uppercase tracking-[0.4em] mt-3">Elite Performance Monitor</p>
               </div>
            </div>
            <div className="flex gap-4">
               <StatMiniCard label="SLA Global" value="4.5m" icon={<Timer size={14} />} />
               <StatMiniCard label="Accuracy" value="98%" icon={<ShieldCheck size={14} />} />
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {staffStats.map((staff, idx) => (
              <div key={staff.staffId} className={`relative bg-[#111114] border rounded-[3.5rem] p-10 shadow-2xl transition-all group ${idx === 0 ? 'border-yellow-500/30' : 'border-white/5'}`}>
                <div className="relative z-10 flex flex-col gap-8">
                  <div className="flex justify-between items-start">
                    <div className="flex items-center gap-5">
                      <div className={`w-14 h-14 rounded-2xl flex items-center justify-center font-black italic text-xl ${idx === 0 ? 'bg-yellow-500 text-black' : 'bg-white/5 text-gray-500'}`}>{idx + 1}</div>
                      <div>
                        <h3 className="text-2xl font-black italic uppercase tracking-tighter">{staff.name}</h3>
                        <span className="text-[9px] text-gray-500 font-black uppercase">{idx === 0 ? '🥇 MVP DEL TURNO' : 'Staff OMM'}</span>
                      </div>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-6 py-6 border-y border-white/5">
                    <div className="flex items-center gap-3">
                       <Target className="text-blue-500" size={18} />
                       <div>
                          <span className="text-[8px] text-gray-600 font-black uppercase block">Tareas</span>
                          <span className="text-xl font-black italic">{staff.tasksCompleted}</span>
                       </div>
                    </div>
                    <div className="flex items-center gap-3">
                       <Timer className="text-purple-500" size={18} />
                       <div>
                          <span className="text-[8px] text-gray-600 font-black uppercase block">Promedio</span>
                          <span className="text-xl font-black italic">{staff.avgSpeed}m</span>
                       </div>
                    </div>
                  </div>
                  <div className="space-y-4">
                    {!staff.aiAdvice ? (
                      <button onClick={() => getAICoaching(idx)} disabled={staff.isCoaching} className="w-full bg-white text-black py-4 rounded-2xl font-black italic text-[9px] uppercase tracking-[0.2em] flex items-center justify-center gap-2">
                        {staff.isCoaching ? <Loader2 className="animate-spin" /> : <Sparkles size={14} />} ACTIVAR IA COACH
                      </button>
                    ) : (
                      <div className="space-y-4 animate-in slide-in-from-bottom duration-500">
                        <div className="bg-blue-600/10 border border-blue-500/20 p-5 rounded-2xl">
                           <p className="text-[10px] text-blue-100 italic leading-relaxed">"{staff.aiAdvice}"</p>
                        </div>
                        <button onClick={() => getAICoaching(idx)} className="text-[8px] font-black uppercase tracking-widest text-gray-600 flex items-center gap-2">
                          <RefreshCcw size={10} /> Recalcular
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="space-y-12">
          {/* Gate de Seguridad */}
          {!isAuthorized ? (
            <div className="max-w-md mx-auto py-20 text-center animate-in zoom-in duration-500">
               <div className="w-20 h-20 bg-[#111114] border border-white/5 rounded-[2.5rem] flex items-center justify-center mx-auto mb-8 shadow-2xl">
                  <Lock size={32} className="text-gray-600" />
               </div>
               <h3 className="text-2xl font-black italic uppercase tracking-tighter mb-4">Acceso Restringido</h3>
               <p className="text-gray-500 text-[10px] font-black uppercase tracking-[0.3em] mb-10">Solo personal autorizado de OMM</p>
               
               <form onSubmit={handlePinSubmit} className="space-y-6">
                  <input 
                    type="password" 
                    placeholder="INTRODUCIR PIN"
                    value={pin}
                    maxLength={4}
                    onChange={(e) => setPin(e.target.value)}
                    className={`w-full bg-[#111114] border-2 rounded-2xl py-6 text-center text-3xl font-black tracking-[1em] outline-none transition-all ${pinError ? 'border-red-500 animate-shake' : 'border-white/5 focus:border-blue-500'}`}
                  />
                  <button type="submit" className="w-full bg-blue-600 hover:bg-blue-500 text-white py-5 rounded-2xl font-black italic text-xs uppercase tracking-widest transition-all">
                    DESBLOQUEAR TERMINAL
                  </button>
               </form>
            </div>
          ) : (
            <div className="space-y-12 animate-in fade-in duration-700">
               {/* Terminal de Eventos Desbloqueada */}
               <div className="flex flex-col md:flex-row md:items-center justify-between gap-8 border-b border-white/5 pb-10">
                 <div className="flex items-center gap-5">
                    <div className="p-5 bg-green-600/10 rounded-[2rem] border border-green-500/30">
                       <Unlock className="text-green-500" size={32} />
                    </div>
                    <div>
                       <h2 className="text-4xl font-black italic tracking-tighter uppercase leading-none">Event Scanner</h2>
                       <div className="flex items-center gap-2 mt-3">
                          <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
                          <span className="text-[10px] font-black text-green-500 uppercase tracking-widest">Secure Access Point</span>
                       </div>
                    </div>
                 </div>

                 <select 
                   value={selectedEventId}
                   onChange={(e) => setSelectedEventId(e.target.value)}
                   className="bg-[#111114] border border-white/10 rounded-2xl py-4 px-8 text-[10px] font-black uppercase tracking-widest outline-none focus:border-blue-500"
                 >
                    {events.map(e => <option key={e.id} value={e.id}>{e.title}</option>)}
                 </select>
               </div>

               <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
                 {/* Scanner UI */}
                 <div className="space-y-8">
                    <div className="bg-[#111114] border border-white/5 rounded-[3.5rem] p-10 shadow-2xl relative overflow-hidden">
                       <div className="relative z-10 space-y-8">
                          <div className="flex items-center justify-between">
                             <h4 className="text-xs font-black uppercase tracking-widest italic">Live Verification</h4>
                             <button onClick={isScanning ? stopCamera : startCamera} className={`p-3 rounded-xl transition-all ${isScanning ? 'bg-red-600/10 text-red-500' : 'bg-blue-600/10 text-blue-500'}`}>
                                {isScanning ? <CameraOff size={18} /> : <Camera size={18} />}
                             </button>
                          </div>

                          {isScanning && (
                            <div className="relative aspect-square rounded-[2rem] overflow-hidden border-2 border-blue-500/50 bg-black">
                               <video ref={videoRef} autoPlay playsInline className="w-full h-full object-cover grayscale brightness-125" />
                               <canvas ref={canvasRef} className="hidden" />
                               <div className="absolute inset-0 border-[30px] border-black/40"></div>
                               <div className="absolute top-1/2 left-0 right-0 h-[2px] bg-blue-500 shadow-[0_0_15px_blue] animate-[scan_2s_ease-in-out_infinite]"></div>
                            </div>
                          )}

                          <form onSubmit={handleVerifyTicket} className="space-y-4">
                             <input 
                               type="text" 
                               placeholder="CÓDIGO MANUAL"
                               value={scanInput}
                               onChange={(e) => setScanInput(e.target.value.toUpperCase())}
                               className="w-full bg-black/40 border border-white/5 rounded-2xl py-5 px-8 text-lg font-black italic tracking-widest outline-none focus:border-blue-500"
                             />
                             <button disabled={isVerifying || !scanInput} className="w-full bg-blue-600 hover:bg-blue-500 text-white py-5 rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl flex items-center justify-center gap-3">
                                {isVerifying ? <Loader2 className="animate-spin" /> : <CheckCircle2 size={18} />} VALIDAR
                             </button>
                          </form>

                          {verificationResult && (
                            <div className={`p-6 rounded-2xl border-2 animate-in zoom-in ${verificationResult.status === 'success' ? 'bg-green-600/10 border-green-500/30' : 'bg-red-600/10 border-red-500/30'}`}>
                               <div className="flex flex-col items-center text-center">
                                  {verificationResult.status === 'success' ? <CheckCircle2 className="text-green-500 mb-2" size={32} /> : <XCircle className="text-red-500 mb-2" size={32} />}
                                  <h4 className="text-sm font-black uppercase italic">{verificationResult.message}</h4>
                                  {verificationResult.customer && <p className="text-[10px] text-white font-bold mt-1 uppercase">{verificationResult.customer}</p>}
                               </div>
                            </div>
                          )}
                       </div>
                    </div>
                 </div>

                 {/* List UI */}
                 <div className="lg:col-span-2">
                    <div className="bg-[#111114] border border-white/5 rounded-[3.5rem] overflow-hidden shadow-2xl">
                       <div className="p-10 border-b border-white/5 bg-white/5 flex justify-between items-center">
                          <h3 className="text-xl font-black italic uppercase">Guest List OMM</h3>
                          <div className="bg-black/40 px-6 py-2 rounded-xl border border-white/10 text-[10px] font-black uppercase text-blue-500">{tickets.length} ASISTENTES</div>
                       </div>
                       <div className="overflow-x-auto max-h-[600px] custom-scrollbar">
                          <table className="w-full text-left">
                             <thead className="bg-black/20 text-[8px] font-black text-gray-600 uppercase tracking-[0.3em]">
                                <tr>
                                   <th className="px-8 py-6">Cliente</th>
                                   <th className="px-8 py-6">Código</th>
                                   <th className="px-8 py-6 text-center">Status</th>
                                </tr>
                             </thead>
                             <tbody className="divide-y divide-white/5">
                                {tickets.map(t => (
                                   <tr key={t.id} className="hover:bg-white/[0.01]">
                                      <td className="px-8 py-6">
                                         <div className="flex flex-col">
                                            <span className="text-xs font-black uppercase text-white italic">{t.customer_name}</span>
                                            <span className="text-[8px] text-gray-600 font-bold uppercase">{t.customer_email}</span>
                                         </div>
                                      </td>
                                      <td className="px-8 py-6 font-mono text-[10px] text-blue-500">{t.ticket_code}</td>
                                      <td className="px-8 py-6 text-center">
                                         {t.checked_in ? (
                                           <span className="bg-green-600/10 text-green-500 px-3 py-1.5 rounded-xl text-[8px] font-black uppercase tracking-widest border border-green-500/20">Check-in OK</span>
                                         ) : (
                                           <span className="bg-blue-600/10 text-blue-500 px-3 py-1.5 rounded-xl text-[8px] font-black uppercase tracking-widest border border-blue-500/20">Pendiente</span>
                                         )}
                                      </td>
                                   </tr>
                                ))}
                             </tbody>
                          </table>
                       </div>
                    </div>
                 </div>
               </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

const StatMiniCard = ({ label, value, icon }: { label: string, value: string, icon: any }) => (
  <div className="bg-[#111114] border border-white/5 px-6 py-3 rounded-2xl flex items-center gap-3">
     <div className="text-blue-500">{icon}</div>
     <div>
        <span className="text-[8px] text-gray-600 font-black uppercase block">{label}</span>
        <span className="text-xs font-black italic">{value}</span>
     </div>
  </div>
);

export default StaffHubModule;
