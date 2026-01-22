
import React, { useState, useEffect } from 'react';
import { 
  HeartPulse, 
  AlertTriangle, 
  MessageSquare, 
  Zap, 
  CheckCircle2, 
  TrendingUp, 
  ShieldAlert, 
  Timer,
  Users,
  Star,
  ChevronRight,
  Send,
  MoreVertical,
  XCircle,
  Coffee,
  Wine,
  Gift,
  PhoneCall
} from 'lucide-react';
import { ServiceIncident, Severity, NEXUS_COLORS } from '../types';
import { GoogleGenAI } from "@google/genai";

const CareModule: React.FC = () => {
  const [incidents, setIncidents] = useState<ServiceIncident[]>([
    { id: 'I1', tableId: 4, type: 'Tiempos Excedidos', severity: 'Alta', timeElapsed: 420, customerLTV: 4500000, status: 'active' },
    { id: 'I2', tableId: 1, type: 'Gesto de Ayuda', severity: 'Media', timeElapsed: 120, customerLTV: 1200000, status: 'active' },
    { id: 'I3', tableId: 8, type: 'Feedback Negativo', severity: 'Crítica', timeElapsed: 0, customerLTV: 8900000, status: 'active' },
  ]);

  const [selectedIncidentId, setSelectedIncidentId] = useState<string | null>(null);
  const [aiScript, setAiScript] = useState<string | null>(null);
  const [isGeneratingScript, setIsGeneratingScript] = useState(false);
  const [activeTab, setActiveTab] = useState<'live' | 'recovery'>('live');

  const selectedIncident = incidents.find(i => i.id === selectedIncidentId);

  const generateApologyScript = async (incident: ServiceIncident) => {
    setIsGeneratingScript(true);
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    try {
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: `Eres el Floor Manager de Seratta Gourmet. Mesa ${incident.tableId} ha tenido un incidente de '${incident.type}' con severidad '${incident.severity}'. El cliente es VIP (LTV: $${incident.customerLTV}). Escribe un guion corto y elegante para acercarte a la mesa, pedir disculpas y ofrecer una cortesía. Tono empático y profesional.`,
      });
      setAiScript(response.text || "");
    } catch (e) {
      setAiScript("Lamento mucho la demora. Estamos perfeccionando su plato ahora mismo. Como atención, me gustaría ofrecerles una ronda de cocteles autoría de la casa.");
    } finally {
      setIsGeneratingScript(false);
    }
  };

  useEffect(() => {
    if (selectedIncidentId && selectedIncident) {
      generateApologyScript(selectedIncident);
    }
  }, [selectedIncidentId]);

  return (
    <div className="space-y-8 animate-in fade-in duration-700">
      {/* Header Estratégico Care */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 border-b border-white/5 pb-8">
        <div className="flex items-center gap-4">
           <div className="w-12 h-12 bg-red-600 rounded-[1.5rem] flex items-center justify-center shadow-lg shadow-red-600/20">
              <HeartPulse size={28} className="text-white" />
           </div>
           <div>
              <h2 className="text-3xl font-black italic tracking-tighter uppercase">NEXUM Care</h2>
              <p className="text-gray-500 text-[10px] font-black uppercase tracking-[0.3em]">Guardianes de la Experiencia Seratta</p>
           </div>
        </div>
        <div className="flex bg-[#111114] p-1.5 rounded-2xl border border-white/5">
          <TabButton active={activeTab === 'live'} onClick={() => setActiveTab('live')} label="Incidentes Live" icon={<ShieldAlert size={14} />} />
          <TabButton active={activeTab === 'recovery'} onClick={() => setActiveTab('recovery')} label="Recuperación Post" icon={<MessageSquare size={14} />} />
        </div>
      </div>

      {activeTab === 'live' ? (
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          {/* Muro de Incidentes */}
          <div className="lg:col-span-3 space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {incidents.map(incident => (
                <div 
                  key={incident.id} 
                  onClick={() => setSelectedIncidentId(incident.id)}
                  className={`bg-[#111114] border-l-8 rounded-[2.5rem] p-8 shadow-2xl relative overflow-hidden transition-all hover:scale-[1.02] cursor-pointer ${
                    incident.severity === 'Crítica' ? 'border-red-500 bg-red-500/5' : 
                    incident.severity === 'Alta' ? 'border-orange-500' : 'border-blue-500'
                  } ${selectedIncidentId === incident.id ? 'ring-2 ring-white/20' : ''}`}
                >
                  <div className="flex justify-between items-start mb-6">
                     <div className="flex items-center gap-3">
                        <div className="bg-white/5 px-4 py-2 rounded-2xl font-black italic text-xl">
                          M{incident.tableId}
                        </div>
                        <div>
                           <span className="text-[10px] text-gray-500 font-black uppercase block">Tipo de Alerta</span>
                           <span className="text-xs font-black uppercase tracking-tight text-white">{incident.type}</span>
                        </div>
                     </div>
                     <div className="text-right">
                        <SeverityBadge severity={incident.severity} />
                     </div>
                  </div>

                  <div className="flex items-center justify-between mb-8">
                    <div className="flex items-center gap-2">
                       <Timer size={14} className="text-gray-500" />
                       <span className="text-sm font-black italic">{Math.floor(incident.timeElapsed / 60)}:{(incident.timeElapsed % 60).toString().padStart(2, '0')}</span>
                       <span className="text-[8px] text-gray-600 font-bold uppercase tracking-widest">En Rojo</span>
                    </div>
                    <div className="flex items-center gap-2">
                       <Users size={14} className="text-blue-500" />
                       <span className="text-[9px] font-black uppercase tracking-widest text-blue-400">LTV: ${(incident.customerLTV / 1000000).toFixed(1)}M</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                     <button className="flex-1 bg-white/5 hover:bg-white/10 py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all">
                        Detalles
                     </button>
                     <button className="flex-1 bg-red-600 hover:bg-red-500 py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all shadow-xl shadow-red-600/20">
                        INTERVENIR YA
                     </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Panel Lateral: IA Apology Agent */}
          <div className="space-y-8">
             {selectedIncident ? (
               <div className="bg-[#111114] border border-white/5 p-8 rounded-[3rem] shadow-2xl animate-in slide-in-from-right duration-500">
                  <div className="flex items-center gap-3 mb-6">
                     <Zap size={18} className="text-blue-500" />
                     <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-widest italic">AI Apology Script</h3>
                  </div>
                  
                  <div className="bg-blue-600/10 border border-blue-500/20 p-6 rounded-3xl mb-8 relative">
                     <div className="absolute top-4 right-4 text-blue-500">
                        <MessageSquare size={14} />
                     </div>
                     <p className="text-sm text-gray-300 italic leading-relaxed font-medium">
                        {isGeneratingScript ? "Generando guion de disculpas estratégico..." : `"${aiScript}"`}
                     </p>
                  </div>

                  <div className="space-y-4">
                     <h4 className="text-[9px] font-black text-gray-600 uppercase tracking-widest mb-2">Compensación Sugerida (IA)</h4>
                     <div className="grid grid-cols-2 gap-3">
                        <TreatButton icon={<Coffee size={14} />} label="Café/Té" cost="-$0" />
                        <TreatButton icon={<Gift size={14} />} label="Postre" cost="-$12k" />
                        <TreatButton icon={<Wine size={14} />} label="Vino/Coctel" cost="-$28k" />
                        <TreatButton icon={<Star size={14} />} label="Priority" cost="-$0" />
                     </div>
                  </div>

                  <button className="w-full mt-8 bg-blue-600 hover:bg-blue-500 py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all text-white shadow-xl shadow-blue-600/20">
                     NOTIFICAR RESOLUCIÓN
                  </button>
               </div>
             ) : (
               <div className="bg-[#111114] border border-white/5 p-8 rounded-[3rem] text-center opacity-30 h-64 flex flex-col items-center justify-center">
                  <AlertTriangle size={40} className="mb-4" />
                  <p className="text-[10px] font-black uppercase tracking-widest">Selecciona un incidente para ver el guion de disculpa</p>
               </div>
             )}

             {/* KPIs de Recuperación */}
             <div className="bg-[#111114] p-8 rounded-[3rem] border border-white/5">
                <div className="flex items-center justify-between mb-8">
                   <h4 className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Performance Care</h4>
                   <TrendingUp size={16} className="text-green-500" />
                </div>
                <div className="space-y-6">
                   <CareMetric label="Resuelto antes de salida" value="94%" />
                   <CareMetric label="Retención Post-Fallo" value="82%" />
                   <CareMetric label="Riesgo Review Negativa" value="4.2%" color="text-red-500" />
                </div>
             </div>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 animate-in slide-in-from-bottom duration-500">
           {/* WhatsApp AI Recovery Simulation */}
           <div className="lg:col-span-2 bg-[#111114] rounded-[3rem] border border-white/5 overflow-hidden flex flex-col min-h-[600px] shadow-2xl">
              <div className="p-8 border-b border-white/5 flex items-center justify-between bg-green-600/5">
                 <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-green-600 rounded-2xl flex items-center justify-center text-white">
                       <MessageSquare size={24} />
                    </div>
                    <div>
                       <h3 className="text-xl font-black italic uppercase italic tracking-tight">AI Recovery Agent</h3>
                       <span className="text-[9px] text-green-500 font-bold uppercase tracking-widest">Agente WhatsApp Activo</span>
                    </div>
                 </div>
                 <div className="flex items-center gap-2">
                    <span className="text-[10px] text-gray-500 font-bold uppercase">Casos Hoy: 12</span>
                    <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                 </div>
              </div>

              <div className="flex-1 p-8 space-y-6">
                 <ChatBubble type="ai" time="14:02" text="Hola Margarita Rosa, lamentamos mucho que tu experiencia en Seratta ayer no fuera 10/10. Vimos que los tiempos de tu plato fuerte excedieron nuestro estándar." />
                 <ChatBubble type="user" time="14:15" text="Sí, la comida estuvo rica pero esperamos casi 40 minutos por el Rodaballo. Me dio mucha pena con mis invitados." />
                 <ChatBubble type="ai" time="14:16" text="Entiendo perfectamente, el tiempo con tus invitados es sagrado. Para reivindicarnos, he cargado a tu perfil un 'Chef's Treat' (Cena Maridaje para 4) para tu próxima reserva. ¿Te gustaría que te ayude a agendarla para el próximo viernes?" />
                 <ChatBubble type="user" time="14:20" text="Oye, eso suena increíble. ¡Sí, por favor! Qué buen detalle." />
                 <div className="bg-blue-600/10 border border-blue-500/20 p-4 rounded-3xl text-center">
                    <span className="text-[10px] font-black text-blue-500 uppercase tracking-widest italic">ÉXITO: Cliente Recuperado. Reserva agendada (R-421)</span>
                 </div>
              </div>
           </div>

           {/* Feedback Stats */}
           <div className="space-y-8">
              <div className="bg-[#111114] p-8 rounded-[3rem] border border-white/5 shadow-2xl">
                 <h4 className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-6">Sentiment Analysis NLP</h4>
                 <div className="space-y-6">
                    <div className="flex items-center justify-between">
                       <span className="text-xs font-bold text-gray-300">Positivo</span>
                       <span className="text-sm font-black text-green-500 italic">88%</span>
                    </div>
                    <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
                       <div className="h-full bg-green-500" style={{ width: '88%' }}></div>
                    </div>
                    <div className="flex items-center justify-between">
                       <span className="text-xs font-bold text-gray-300">Negativo (Fricción)</span>
                       <span className="text-sm font-black text-red-500 italic">12%</span>
                    </div>
                    <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
                       <div className="h-full bg-red-500" style={{ width: '12%' }}></div>
                    </div>
                 </div>
              </div>

              <div className="bg-gradient-to-br from-purple-600/20 to-transparent p-8 rounded-[3rem] border border-purple-500/10">
                 <h4 className="text-[10px] font-black text-purple-400 uppercase tracking-widest mb-4">Risk Escallation</h4>
                 <p className="text-[10px] text-gray-400 italic mb-6">
                    2 casos críticos detectados con potencial de reseña de 1 estrella. Se ha alertado al Floor Captain vía WhatsApp para llamada directa.
                 </p>
                 <button className="w-full bg-purple-600 hover:bg-purple-500 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest text-white transition-all">
                    VER CASOS CRÍTICOS
                 </button>
              </div>
           </div>
        </div>
      )}
    </div>
  );
};

const TabButton = ({ active, onClick, icon, label }: { active: boolean, onClick: () => void, icon: any, label: string }) => (
  <button 
    onClick={onClick}
    className={`flex items-center gap-2 px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
      active ? 'bg-red-600 text-white shadow-lg' : 'text-gray-500 hover:text-gray-300'
    }`}
  >
    {icon} {label}
  </button>
);

const SeverityBadge = ({ severity }: { severity: Severity }) => {
  const colors = {
    'Crítica': 'bg-red-500 text-white',
    'Alta': 'bg-orange-500 text-white',
    'Media': 'bg-yellow-500 text-black',
    'Baja': 'bg-blue-500 text-white'
  };
  return (
    <span className={`text-[8px] font-black uppercase tracking-widest px-3 py-1 rounded-full ${colors[severity]}`}>
      {severity}
    </span>
  );
};

const TreatButton = ({ icon, label, cost }: { icon: any, label: string, cost: string }) => (
  <button className="flex flex-col items-center gap-2 p-4 bg-white/5 border border-white/5 rounded-2xl hover:bg-blue-600 group transition-all">
     <div className="text-blue-500 group-hover:text-white transition-colors">{icon}</div>
     <span className="text-[8px] font-black uppercase tracking-widest group-hover:text-white">{label}</span>
     <span className="text-[7px] text-gray-600 font-bold group-hover:text-white/60">{cost}</span>
  </button>
);

const CareMetric = ({ label, value, color }: { label: string, value: string, color?: string }) => (
  <div className="flex justify-between items-center border-b border-white/5 pb-3">
     <span className="text-[10px] text-gray-400 font-bold uppercase">{label}</span>
     <span className={`text-sm font-black italic ${color || 'text-white'}`}>{value}</span>
  </div>
);

const ChatBubble = ({ type, text, time }: { type: 'ai' | 'user', text: string, time: string }) => (
  <div className={`flex flex-col ${type === 'ai' ? 'items-start' : 'items-end'}`}>
     <div className={`max-w-[80%] p-5 rounded-[2rem] text-xs leading-relaxed ${
       type === 'ai' ? 'bg-white/5 text-gray-300 rounded-bl-none border border-white/10' : 'bg-green-600/10 text-green-400 border border-green-500/10 rounded-br-none'
     }`}>
        {text}
     </div>
     <span className="text-[8px] text-gray-600 font-bold mt-2 uppercase tracking-widest">{time}</span>
  </div>
);

export default CareModule;
