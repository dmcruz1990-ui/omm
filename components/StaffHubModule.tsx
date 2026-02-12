
import React, { useState, useEffect } from 'react';
import { 
  Trophy, 
  Zap, 
  Target, 
  TrendingUp, 
  Star, 
  Award, 
  Loader2, 
  Sparkles, 
  ShieldCheck, 
  Users, 
  Clock, 
  Brain,
  ChevronRight,
  CheckCircle2,
  Medal,
  Users2,
  Calculator,
  AlertTriangle,
  ArrowRight,
  UserCheck
} from 'lucide-react';
import { MicroCredential, OperationalSettings } from '../types.ts';
import { supabase } from '../lib/supabase.ts';
import { GoogleGenAI } from "@google/genai";

const StaffHubModule: React.FC = () => {
  const [activeView, setActiveView] = useState<'performance' | 'credentials' | 'matching' | 'planner' | 'maestros'>('performance');
  const [loading, setLoading] = useState(true);
  const [config, setConfig] = useState<OperationalSettings | null>(null);

  // Estados para el Planeador IA
  const [projectedGuests, setProjectedGuests] = useState(120);
  const [currentWaiters, setCurrentWaiters] = useState(8);
  const [aiAnalysis, setAiAnalysis] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  // Catálogo de micro-credenciales
  const availableCredentials: MicroCredential[] = [
    { id: 'm1', name: 'Mesero Nivel 1 (Fundamentos)', level: 1, category: 'FOH', status: 'earned' },
    { id: 'm2', name: 'Mesero Nivel 2 (Alto Volumen)', level: 2, category: 'FOH', status: 'in_progress' },
    { id: 'b1', name: 'Cocinero Commis (BOH L1)', level: 1, category: 'BOH', status: 'not_started' },
    { id: 'ba1', name: 'Bartender N1 (Speed & Accuracy)', level: 1, category: 'BAR', status: 'earned' },
  ];

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    const { data } = await supabase.from('operational_settings').select('*').maybeSingle();
    setConfig(data);
    setTimeout(() => setLoading(false), 800);
  };

  const generateStaffRecommendation = async () => {
    setIsAnalyzing(true);
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    
    const dna = config?.business_dna || 'FINE_DINING';
    const ratio = dna === 'FINE_DINING' ? 10 : 18;
    const recommendedWaiters = Math.ceil(projectedGuests / ratio);

    try {
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: `Actúa como un experto en eficiencia operativa de restaurantes. 
        Contexto: Restaurante tipo ${dna}. 
        Regla de oro: 1 mesero cada ${ratio} clientes.
        Datos Actuales: ${projectedGuests} clientes proyectados, ${currentWaiters} meseros en nómina.
        Calcula la brecha, el impacto en el servicio y sugiere una estructura óptima (meseros, runners, capitanes). 
        Tono: Ejecutivo, directo, enfocado en ROI.`,
      });
      setAiAnalysis(response.text || "");
    } catch (e) {
      setAiAnalysis("Error en el análisis. Basado en reglas estándar, para 120 clientes en Fine Dining deberías tener 12 meseros. Tienes un déficit de 4 personas.");
    } finally {
      setIsAnalyzing(false);
    }
  };

  if (loading) return <div className="py-40 text-center opacity-40"><Loader2 className="animate-spin mx-auto mb-4" />Sincronizando Employment OS...</div>;

  return (
    <div className="space-y-12 animate-in fade-in duration-700 max-w-7xl mx-auto pb-20 text-left">
      
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-8 border-b border-white/5 pb-10">
        <div className="flex items-center gap-6">
           <div className="p-5 bg-blue-600 rounded-[2rem] shadow-2xl shadow-blue-600/20">
              <Star size={32} className="text-white" fill="white" />
           </div>
           <div>
              <h2 className="text-4xl font-black italic tracking-tighter uppercase leading-none">Intelligence Staff</h2>
              <p className="text-gray-500 text-[10px] font-black uppercase tracking-[0.4em] mt-3 italic">Verified Skills & AI Workforce Planner</p>
           </div>
        </div>
        <div className="flex bg-[#111114] p-2 rounded-2xl border border-white/5 overflow-x-auto">
           <TabBtn active={activeView === 'performance'} onClick={() => setActiveView('performance')} icon={<TrendingUp size={14} />} label="RANKING LIVE" />
           <TabBtn active={activeView === 'credentials'} onClick={() => setActiveView('credentials')} icon={<Award size={14} />} label="CREDENTIALS" />
           <TabBtn active={activeView === 'matching'} onClick={() => setActiveView('matching')} icon={<Brain size={14} />} label="SJT QUIZ" />
           <TabBtn active={activeView === 'planner'} onClick={() => setActiveView('planner')} icon={<Calculator size={14} />} label="AI PLANNER" />
           <TabBtn active={activeView === 'maestros'} onClick={() => setActiveView('maestros')} icon={<UserCheck size={14} />} label="MAESTROS" />
        </div>
      </div>

      {activeView === 'maestros' && (
        <div className="space-y-10 animate-in slide-in-from-bottom-4 duration-700">
           <div className="bg-[#111114] border border-white/5 p-12 rounded-[4rem] relative overflow-hidden shadow-2xl">
              <div className="absolute top-0 right-0 p-12 opacity-5"><UserCheck size={180} className="text-blue-500" /></div>
              <div className="relative z-10 max-w-2xl space-y-6">
                 <h2 className="text-5xl font-black italic tracking-tighter uppercase leading-none text-white">Maestros del Ritual</h2>
                 <p className="text-gray-400 text-lg italic leading-relaxed">
                   Reconocimiento a los embajadores de marca que han alcanzado el Nivel 4 y 5 de credenciales OMM. Estos son los perfiles a seguir.
                 </p>
              </div>
           </div>

           <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-10">
              <StaffBioCard name="Andrés Gaviria" role="Sommelier N2" img="https://i.pravatar.cc/300?u=1" tags={['Vino', 'Zen']} bio="Experto en maridaje con 5 años en el grupo. Lidera el ritual de cava en OMM Bogotá." />
              <StaffBioCard name="Sofia Ruiz" role="Captain" img="https://i.pravatar.cc/300?u=2" tags={['Ritual', 'CX']} bio="Especialista en atención VIP y resolución de conflictos. Embajadora de 'Customer Care'." />
              <StaffBioCard name="Carlos Silva" role="Itamae" img="https://i.pravatar.cc/300?u=3" tags={['Sushi', 'Knife']} bio="Maestro de la robata y el corte tradicional japonés. Certificado en BOH Nivel 5." />
           </div>
        </div>
      )}

      {activeView === 'planner' && (
        <div className="space-y-10 animate-in slide-in-from-bottom-4 duration-700">
           <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              {/* Input de Control de Nómina */}
              <div className="lg:col-span-1 bg-[#111114] border border-white/5 p-10 rounded-[3rem] shadow-2xl space-y-10">
                 <h3 className="text-xs font-black text-gray-500 uppercase tracking-widest flex items-center gap-2 italic">
                    <Calculator size={16} className="text-blue-500" /> Parámetros de Turno
                 </h3>
                 
                 <div className="space-y-6">
                    <div className="space-y-4">
                       <div className="flex justify-between">
                          <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Clientes Proyectados</span>
                          <span className="text-lg font-black italic text-white">{projectedGuests}</span>
                       </div>
                       <input type="range" min="20" max="500" value={projectedGuests} onChange={(e) => setProjectedGuests(parseInt(e.target.value))} className="w-full h-1 bg-white/5 rounded-full appearance-none accent-blue-500 cursor-pointer" />
                    </div>

                    <div className="space-y-4">
                       <div className="flex justify-between">
                          <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Meseros Actuales</span>
                          <span className="text-lg font-black italic text-white">{currentWaiters}</span>
                       </div>
                       <input type="range" min="1" max="50" value={currentWaiters} onChange={(e) => setCurrentWaiters(parseInt(e.target.value))} className="w-full h-1 bg-white/5 rounded-full appearance-none accent-blue-500 cursor-pointer" />
                    </div>
                 </div>

                 <div className="bg-blue-600/5 border border-blue-500/20 p-6 rounded-2xl">
                    <span className="text-[8px] font-black text-blue-400 uppercase block mb-1">Regla DNA: {config?.business_dna}</span>
                    <p className="text-[11px] text-gray-500 italic">
                      {config?.business_dna === 'FINE_DINING' ? '1 Mesero : 10 Clientes' : '1 Mesero : 18 Clientes'}
                    </p>
                 </div>

                 <button 
                  onClick={generateStaffRecommendation}
                  disabled={isAnalyzing}
                  className="w-full bg-blue-600 hover:bg-blue-500 text-white py-5 rounded-2xl font-black italic text-xs uppercase tracking-widest shadow-xl flex items-center justify-center gap-3 transition-all active:scale-95 disabled:opacity-50"
                 >
                    {isAnalyzing ? <Loader2 size={18} className="animate-spin" /> : <><Brain size={18} /> GENERAR ESTRUCTURA IA</>}
                 </button>
              </div>

              {/* Resultado del Análisis IA */}
              <div className="lg:col-span-2 space-y-8">
                 {!aiAnalysis ? (
                    <div className="h-full flex flex-col items-center justify-center border-4 border-dashed border-white/5 rounded-[4rem] opacity-20 text-center p-20">
                       <Users2 size={64} className="mb-6" />
                       <h4 className="text-2xl font-black italic uppercase tracking-tighter">Analizador de Nómina V4</h4>
                       <p className="text-sm font-bold uppercase tracking-widest mt-4">Configura los parámetros para auditar tu nómina</p>
                    </div>
                 ) : (
                    <div className="space-y-8 animate-in fade-in zoom-in duration-500">
                       <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                          <StatusCard 
                            label="Estado Servicio" 
                            value={currentWaiters < (projectedGuests / (config?.business_dna === 'FINE_DINING' ? 10 : 18)) ? 'CRÍTICO' : 'ÓPTIMO'} 
                            color={currentWaiters < (projectedGuests / (config?.business_dna === 'FINE_DINING' ? 10 : 18)) ? 'text-red-500' : 'text-green-500'}
                          />
                          <StatusCard 
                            label="Recomendado" 
                            value={Math.ceil(projectedGuests / (config?.business_dna === 'FINE_DINING' ? 10 : 18)).toString()} 
                            color="text-blue-500"
                          />
                          <StatusCard 
                            label="Gap Operativo" 
                            value={(currentWaiters - Math.ceil(projectedGuests / (config?.business_dna === 'FINE_DINING' ? 10 : 18))).toString()} 
                            color="text-orange-500"
                          />
                       </div>

                       <div className="bg-[#111114] border border-white/5 p-12 rounded-[4rem] shadow-2xl relative overflow-hidden">
                          <div className="absolute top-0 right-0 p-12 opacity-5">
                             <Sparkles size={140} className="text-blue-500" />
                          </div>
                          <div className="relative z-10 space-y-8">
                             <div className="flex items-center gap-3 border-b border-white/5 pb-6">
                                <Brain size={24} className="text-blue-500" />
                                <h3 className="text-2xl font-black italic uppercase tracking-tighter text-white">Reporte de Estructura Sugerida</h3>
                             </div>
                             <p className="text-lg text-gray-400 italic font-medium leading-relaxed whitespace-pre-wrap">
                                {aiAnalysis}
                             </p>
                             <div className="pt-6 border-t border-white/5 flex gap-4">
                                <button className="bg-white/5 hover:bg-white/10 text-[9px] font-black uppercase tracking-widest px-6 py-3 rounded-xl transition-all">Exportar a PDF</button>
                                <button className="bg-blue-600/10 text-blue-500 text-[9px] font-black uppercase tracking-widest px-6 py-3 rounded-xl border border-blue-500/20">Aplicar a Turno</button>
                             </div>
                          </div>
                       </div>
                    </div>
                 )}
              </div>
           </div>
        </div>
      )}

      {activeView === 'credentials' && (
        <div className="space-y-10 animate-in slide-in-from-bottom-4 duration-700">
           <div className="bg-[#111114] border border-white/5 p-12 rounded-[4rem] relative overflow-hidden shadow-2xl">
              <div className="absolute top-0 right-0 p-12 opacity-5"><Award size={180} className="text-blue-500" /></div>
              <div className="relative z-10 max-w-2xl space-y-6">
                 <div className="inline-flex items-center gap-2 bg-blue-600/10 px-4 py-1.5 rounded-full text-[10px] font-black text-blue-400 uppercase tracking-widest italic">
                    <Sparkles size={12} /> Basado en Open Badges 3.0
                 </div>
                 <h2 className="text-5xl font-black italic tracking-tighter uppercase leading-none text-white">Verified Skills Passport</h2>
                 <p className="text-gray-400 text-lg italic leading-relaxed">
                   Tus habilidades certificadas por prueba práctica in-situ. Credenciales portables con evidencia digital y validación antifraude.
                 </p>
              </div>
           </div>

           <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
              {availableCredentials.map(cred => (
                <div key={cred.id} className={`bg-[#111114] border-2 rounded-[3.5rem] p-10 flex flex-col justify-between h-[350px] shadow-2xl transition-all hover:scale-[1.02] ${cred.status === 'earned' ? 'border-blue-500/40 bg-blue-500/5' : 'border-white/5 opacity-60'}`}>
                   <div className="space-y-6">
                      <div className={`w-16 h-16 rounded-2xl flex items-center justify-center shadow-xl ${cred.status === 'earned' ? 'bg-blue-600 text-white' : 'bg-white/5 text-gray-600'}`}>
                         <Medal size={32} />
                      </div>
                      <div>
                         <span className="text-[8px] font-black text-blue-500 uppercase tracking-widest block mb-2">Nivel {cred.level} • {cred.category}</span>
                         <h4 className="text-xl font-black italic uppercase text-white leading-tight">{cred.name}</h4>
                      </div>
                   </div>
                   
                   <div className="pt-8 border-t border-white/5">
                      {cred.status === 'earned' ? (
                         <div className="flex items-center justify-between">
                            <span className="text-[9px] font-black text-green-500 uppercase flex items-center gap-1 italic"><CheckCircle2 size={12} /> VERIFICADO</span>
                            <ChevronRight size={16} className="text-gray-600" />
                         </div>
                      ) : (
                         <button className="w-full bg-white/5 hover:bg-white text-gray-500 hover:text-black py-3 rounded-2xl text-[9px] font-black uppercase tracking-widest transition-all italic">INICIAR PRUEBA</button>
                      )}
                   </div>
                </div>
              ))}
           </div>
        </div>
      )}

      {activeView === 'matching' && (
        <div className="max-w-4xl mx-auto space-y-12 animate-in zoom-in duration-500">
           <div className="bg-gradient-to-br from-blue-600/20 to-transparent border-2 border-blue-500/30 rounded-[4rem] p-16 text-center space-y-8 shadow-2xl">
              <Brain size={64} className="text-blue-500 mx-auto" />
              <h3 className="text-4xl font-black italic uppercase tracking-tighter">Situational Judgment Quiz</h3>
              <p className="text-gray-400 text-lg italic leading-relaxed max-w-xl mx-auto">
                No medimos personalidad, medimos <span className="text-white font-bold">Fit Operativo</span>. Enfréntate a 4 escenarios reales de servicio OMM para definir tu ruta de aprendizaje.
              </p>
              <button className="bg-blue-600 hover:bg-blue-500 text-white px-16 py-6 rounded-[2.5rem] font-black italic text-sm uppercase tracking-widest shadow-2xl transition-all active:scale-95">
                 INICIAR EVALUACIÓN SJT
              </button>
           </div>
           
           <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="bg-[#111114] p-8 rounded-[3rem] border border-white/5">
                 <h4 className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-6 italic">Constructos Evaluados</h4>
                 <div className="space-y-4">
                    <SkillItem label="Atención al Detalle" pct={95} />
                    <SkillItem label="Manejo de Stress (High Volume)" pct={74} />
                    <SkillItem label="Protocolo Zen (FOH)" pct={88} />
                 </div>
              </div>
              <div className="bg-[#111114] p-8 rounded-[3rem] border border-white/5 flex flex-col justify-center">
                 <p className="text-sm text-gray-500 italic leading-relaxed text-center">
                    "Tu perfil actual tiene alta compatibilidad con el cargo <strong className="text-white uppercase">Cocinero Demi</strong>. Sugerimos completar la micro-credencial BOH Nivel 2."
                 </p>
              </div>
           </div>
        </div>
      )}

      {activeView === 'performance' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
           <div className="lg:col-span-2 space-y-8">
              <h3 className="text-xs font-black text-gray-500 uppercase tracking-widest italic">Hall of Fame - Staff Performance</h3>
              <div className="bg-[#111114] border border-white/5 rounded-[4rem] p-12 shadow-2xl">
                 <div className="space-y-10">
                    <RankingRow rank={1} name="JUAN PÉREZ" score={98} role="Sommelier" />
                    <RankingRow rank={2} name="MARÍA LÓPEZ" score={94} role="Captain" />
                    <RankingRow rank={3} name="ANDRÉS G." score={92} role="Runner" />
                 </div>
              </div>
           </div>

           <div className="space-y-8">
              <div className="bg-blue-600 p-10 rounded-[3.5rem] shadow-2xl relative overflow-hidden group">
                 <div className="absolute top-0 right-0 p-10 opacity-10 group-hover:scale-110 transition-transform"><Trophy size={120} fill="white" /></div>
                 <h4 className="text-xs font-black text-blue-100 uppercase tracking-widest mb-6 italic">Copa del Mes</h4>
                 <span className="text-5xl font-black italic text-white tracking-tighter leading-none">JUAN PÉREZ</span>
                 <p className="text-[9px] text-blue-200 font-bold uppercase mt-6 tracking-widest">Insignia: Guardian del Ritual</p>
              </div>
              
              <div className="bg-[#111114] border border-white/5 p-8 rounded-[3rem] shadow-2xl">
                 <h4 className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-6 italic">SLA de Formación</h4>
                 <div className="space-y-6">
                    <SkillItem label="Cursos Food Safety" pct={100} />
                    <SkillItem label="Micro-Learning OMM" pct={82} />
                 </div>
              </div>
           </div>
        </div>
      )}
    </div>
  );
};

const TabBtn = ({ active, onClick, icon, label }: any) => (
  <button onClick={onClick} className={`px-8 py-3.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-3 shrink-0 ${active ? 'bg-blue-600 text-white shadow-xl shadow-blue-600/20' : 'text-gray-500 hover:text-white'}`}>
    {icon} {label}
  </button>
);

const SkillItem = ({ label, pct }: any) => (
  <div className="space-y-2">
     <div className="flex justify-between items-center text-[9px] font-black uppercase tracking-widest">
        <span className="text-gray-600">{label}</span>
        <span className="text-white">{pct}%</span>
     </div>
     <div className="h-1 w-full bg-white/5 rounded-full overflow-hidden">
        <div className="h-full bg-blue-500 transition-all duration-1000" style={{ width: `${pct}%` }}></div>
     </div>
  </div>
);

const RankingRow = ({ rank, name, score, role }: any) => (
  <div className="flex items-center justify-between group">
     <div className="flex items-center gap-8">
        <span className="text-5xl font-black italic text-white/5 group-hover:text-blue-600/20 transition-all">{rank}</span>
        <div>
           <h4 className="text-xl font-black italic uppercase text-white leading-none mb-1">{name}</h4>
           <span className="text-[10px] text-gray-600 font-black uppercase tracking-widest">{role}</span>
        </div>
     </div>
     <div className="text-right">
        <span className="text-[9px] text-blue-500 font-black uppercase block tracking-widest">Reputation</span>
        <span className="text-2xl font-black italic text-white">{score}</span>
     </div>
  </div>
);

const StaffBioCard = ({ name, role, img, tags, bio }: any) => (
  <div className="bg-[#111114] rounded-[2.5rem] overflow-hidden group border border-white/5 hover:border-blue-500/50 transition-all p-8 flex flex-col gap-6">
     <div className="flex items-center gap-6">
        <div className="w-20 h-20 rounded-2xl overflow-hidden shrink-0">
           <img src={img} className="w-full h-full object-cover grayscale group-hover:grayscale-0 transition-all duration-700" alt={name} />
        </div>
        <div>
           <h4 className="text-xl font-black italic uppercase text-white">{name}</h4>
           <p className="text-blue-500 text-[10px] font-black uppercase tracking-widest mt-1">{role}</p>
        </div>
     </div>
     <p className="text-gray-400 text-xs italic leading-relaxed">{bio}</p>
     <div className="flex gap-2 mt-auto">
        {tags.map((t: string) => (
           <span key={t} className="text-[8px] font-black bg-white/5 border border-white/10 px-3 py-1 rounded-full uppercase">{t}</span>
        ))}
     </div>
  </div>
);

const StatusCard = ({ label, value, color }: { label: string, value: string, color: string }) => (
  <div className="bg-[#111114] border border-white/5 p-6 rounded-3xl flex flex-col items-center justify-center text-center shadow-xl">
     <span className="text-[8px] font-black text-gray-600 uppercase tracking-widest mb-1">{label}</span>
     <span className={`text-xl font-black italic ${color}`}>{value}</span>
  </div>
);

export default StaffHubModule;
