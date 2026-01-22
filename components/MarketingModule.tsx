
import React, { useState, useEffect } from 'react';
import { GoogleGenAI } from "@google/genai";
import { 
  TrendingUp, 
  MapPin, 
  Zap, 
  Bell, 
  Target, 
  BarChart, 
  Info, 
  ChevronRight,
  Sparkles,
  CloudRain,
  Users,
  AlertTriangle,
  Send,
  CheckCircle,
  Clock
} from 'lucide-react';
import { Opportunity, MarketingAction, NEXUS_COLORS } from '../types';

const MarketingModule: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [activeAction, setActiveAction] = useState<string | null>(null);

  useEffect(() => {
    const generateOpportunities = async () => {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      // Prompt específico para los 3 motores de oportunidad de Grupo Seratta
      const systemPrompt = `
        Actúa como un CTO y Product Lead especializado en Hospitality Stack para Grupo Seratta.
        Infiere 3 oportunidades accionables cruzando:
        1. Yield Management: Bajas reservas los Martes + Tag CRM "Business".
        2. Churn Prevention: Cliente VIP ausente >30 días + Tag CRM "Vino".
        3. Inventory Push: Exceso de Langosta + Tráfico Geo Alto.
        
        Variables actuales: Jueves noche, lluvia ligera, Tráfico peatonal +10%.
        Genera un JSON con 3 oportunidades: id (ej: yield-01, churn-01, inv-01), title, type (TRAFFIC, EVENT, COMPETITOR, WEATHER), score (0-100), description, potentialRevenue, aiReasoning.
      `;

      try {
        const response = await ai.models.generateContent({
          model: 'gemini-3-flash-preview',
          contents: systemPrompt,
          config: { responseMimeType: "application/json" }
        });
        
        const data = JSON.parse(response.text || "[]");
        setOpportunities(data);
      } catch (e) {
        console.error("AI Insight Error:", e);
        setOpportunities([
          {
            id: 'yield-01',
            title: 'Yield Management: Jueves de Negocios',
            type: 'EVENT',
            score: 88,
            description: 'Reservas < 30%. Sincronización con SevenRooms detecta 400 perfiles "Business" en la zona.',
            potentialRevenue: 4500000,
            aiReasoning: 'Activar "Power Hour" aumentará el ticket promedio de las mesas ociosas.'
          },
          {
            id: 'churn-01',
            title: 'Churn Prevention: Retorno VIP',
            type: 'TRAFFIC',
            score: 95,
            description: '12 Clientes VIP con gasto >$1.5M no han visitado en 40 días.',
            potentialRevenue: 12000000,
            aiReasoning: 'El coste de adquisición de un nuevo cliente es 5x mayor que recuperar estos perfiles.'
          },
          {
            id: 'inv-01',
            title: 'Inventory Push: Langosta del Pacífico',
            type: 'TRAFFIC',
            score: 74,
            description: 'Stock crítico detectado en POS Seratta. Tráfico peatonal en 1km es excepcionalmente alto hoy.',
            potentialRevenue: 2800000,
            aiReasoning: 'Una oferta flash vía Geo-Fence Ads agotará el stock antes de que expire.'
          }
        ]);
      } finally {
        setLoading(false);
      }
    };

    generateOpportunities();
  }, []);

  const handleAction = (id: string) => {
    setActiveAction(id);
    setTimeout(() => setActiveAction(null), 3500);
  };

  return (
    <div className="space-y-8 max-w-7xl mx-auto animate-in fade-in duration-700">
      {/* Header Estratégico Grupo Seratta */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-white/5 pb-8">
        <div>
          <h2 className="text-3xl font-black italic tracking-tighter flex items-center gap-3">
            <Sparkles className="text-blue-500" /> CENTRO DE COMANDO ESTRATÉGICO
          </h2>
          <p className="text-gray-500 text-xs font-bold mt-2 uppercase tracking-[0.3em]">Integración Middleware: <span className="text-blue-400">POS Seratta + SevenRooms</span></p>
        </div>
        <div className="flex items-center gap-4">
          <div className="bg-blue-600/5 px-6 py-3 rounded-2xl border border-blue-500/20 flex flex-col items-end">
            <span className="text-[10px] text-gray-500 font-bold uppercase">Revenue Incremental Proyectado</span>
            <span className="text-xl font-black text-blue-500 italic">$18.5M COP</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
        {/* Panel de Tarjetas de Oportunidad */}
        <div className="lg:col-span-2 space-y-8">
          <div className="flex items-center justify-between">
            <h3 className="text-[10px] font-black text-gray-500 uppercase tracking-[0.4em] flex items-center gap-2">
              <Zap size={14} className="text-yellow-500" /> Oportunidades Detectadas
            </h3>
            <span className="text-[10px] bg-white/5 px-3 py-1 rounded-full text-gray-500 font-bold italic">Actualizado hace 2m</span>
          </div>

          {loading ? (
            <div className="space-y-6">
              {[1, 2, 3].map(i => (
                <div key={i} className="h-48 bg-white/5 animate-pulse rounded-[2.5rem]"></div>
              ))}
            </div>
          ) : (
            <div className="space-y-6">
              {opportunities.map((opp, idx) => (
                <div key={idx} className="bg-[#16161a] border border-white/5 rounded-[2.5rem] p-8 relative overflow-hidden group hover:border-blue-500/40 transition-all shadow-2xl">
                  {/* Badge de Score Dinámico */}
                  <div className="absolute top-0 right-0 p-8">
                    <div className="bg-black/60 backdrop-blur-md px-4 py-2 rounded-2xl border border-white/10 flex flex-col items-center">
                       <span className="text-[8px] text-gray-500 font-black uppercase">Oportunidad</span>
                       <span className={`text-xl font-black ${opp.score > 90 ? 'text-blue-500' : 'text-yellow-500'}`}>{opp.score}%</span>
                    </div>
                  </div>

                  <div className="flex flex-col md:flex-row gap-8">
                    <div className={`w-16 h-16 rounded-[1.5rem] flex items-center justify-center shrink-0 shadow-lg ${
                      opp.id?.includes('yield') ? 'bg-blue-600/20 text-blue-500 shadow-blue-500/10' : 
                      opp.id?.includes('churn') ? 'bg-purple-600/20 text-purple-500 shadow-purple-500/10' : 'bg-green-600/20 text-green-500 shadow-green-500/10'
                    }`}>
                      {opp.id?.includes('yield') && <BarChart size={32} />}
                      {opp.id?.includes('churn') && <Users size={32} />}
                      {opp.id?.includes('inv') && <Zap size={32} />}
                    </div>

                    <div className="flex-1">
                      <div className="mb-4">
                        <h4 className="text-2xl font-black italic tracking-tight mb-2 uppercase">{opp.title}</h4>
                        <div className="flex items-center gap-3 text-xs text-gray-500">
                          <span className="flex items-center gap-1 font-bold"><AlertTriangle size={12} className="text-yellow-500" /> Problema Detectado</span>
                          <span className="w-1 h-1 bg-gray-800 rounded-full"></span>
                          <p>{opp.description}</p>
                        </div>
                      </div>
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                         <div className="bg-black/40 p-4 rounded-2xl border border-white/5">
                            <span className="text-[9px] text-blue-400 font-black uppercase block mb-1">Solución Propuesta IA</span>
                            <p className="text-xs text-gray-500 leading-relaxed font-medium italic">"{opp.aiReasoning}"</p>
                         </div>
                         <div className="bg-blue-600/5 p-4 rounded-2xl border border-blue-500/10 flex flex-col justify-center">
                            <span className="text-[9px] text-gray-400 font-black uppercase block mb-1">Revenue Estimado</span>
                            <span className="text-lg font-black text-blue-500 italic">+${(opp.potentialRevenue / 1000000).toFixed(1)}M COP</span>
                         </div>
                      </div>

                      <div className="flex flex-wrap gap-3 pt-4 border-t border-white/5">
                        <button 
                          onClick={() => handleAction(`exec-${idx}`)}
                          className="bg-blue-600 hover:bg-blue-500 text-white text-[10px] font-black px-8 py-3 rounded-2xl transition-all flex items-center gap-2 uppercase tracking-widest shadow-xl shadow-blue-600/20 group/btn"
                        >
                          {activeAction === `exec-${idx}` ? 
                            <><CheckCircle size={14} className="animate-in zoom-in" /> EJECUTADO CON ÉXITO</> : 
                            <><Send size={14} className="group-hover/btn:translate-x-1 group-hover/btn:-translate-y-1 transition-transform" /> EJECUTAR CAMPAÑA</>
                          }
                        </button>
                        <button className="bg-white/5 hover:bg-white/10 text-white text-[10px] font-black px-8 py-3 rounded-2xl border border-white/5 transition-all uppercase tracking-widest">
                          Ignorar
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Barra Lateral: Stack de Datos & ROI Real-time */}
        <div className="space-y-8">
          <div className="bg-[#16161a] p-8 rounded-[3rem] border border-white/5 shadow-2xl sticky top-24">
            <h3 className="text-xs font-black text-gray-500 uppercase tracking-[0.3em] mb-8 flex items-center gap-2">
               <Target className="text-blue-500" /> Hospitality Stack
            </h3>
            
            <div className="space-y-5">
              <StackStatus label="POS Transaccional" provider="Toast API" status="Synced" delay="0.02ms" />
              <StackStatus label="CRM Gastronómico" provider="SevenRooms" status="Connected" delay="12ms" />
              <StackStatus label="Geo-Analytics" provider="Nexus Sensors" status="Live" delay="Real-time" />
            </div>

            <div className="mt-10 pt-8 border-t border-white/5">
               <div className="flex items-center justify-between mb-6">
                 <div className="flex flex-col">
                   <span className="text-[10px] text-gray-500 font-black uppercase">ROI Campañas Mes</span>
                   <span className="text-3xl font-black italic text-green-500">+142%</span>
                 </div>
                 <div className="p-3 bg-green-500/10 rounded-2xl text-green-500">
                    <TrendingUp size={24} />
                 </div>
               </div>
               <button className="w-full bg-white text-black font-black text-[10px] py-4 rounded-2xl uppercase tracking-[0.2em] hover:bg-blue-600 hover:text-white transition-all shadow-xl">
                 Ver Reporte Detallado
               </button>
            </div>
          </div>

          <div className="bg-gradient-to-br from-blue-600/10 to-transparent p-8 rounded-[3rem] border border-blue-500/10">
             <div className="flex items-center gap-2 mb-4">
                <Clock className="text-blue-500" size={16} />
                <span className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Últimas Acciones</span>
             </div>
             <div className="space-y-4">
                <p className="text-[10px] text-gray-400 border-l-2 border-blue-500 pl-3 leading-relaxed">
                   <span className="text-white font-bold uppercase">Meta Ads Flash</span> lanzado a las 18:42 para Mesa 01 - 05.
                </p>
                <p className="text-[10px] text-gray-400 border-l-2 border-gray-800 pl-3 leading-relaxed">
                   <span className="text-white font-bold uppercase">Push SevenRooms</span> enviada a 12 clientes VIP.
                </p>
             </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const StackStatus = ({ label, provider, status, delay }: { label: string, provider: string, status: string, delay: string }) => (
  <div className="flex items-center justify-between group">
    <div>
      <div className="text-[10px] font-black text-gray-300 uppercase tracking-wider mb-0.5">{label}</div>
      <div className="text-[8px] text-gray-600 font-bold uppercase">{provider}</div>
    </div>
    <div className="flex flex-col items-end">
      <div className="flex items-center gap-1.5">
        <div className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse"></div>
        <span className="text-[9px] font-black text-green-500 uppercase">{status}</span>
      </div>
      <span className="text-[8px] text-gray-700 font-mono mt-0.5">{delay}</span>
    </div>
  </div>
);

export default MarketingModule;
