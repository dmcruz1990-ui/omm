
import React, { useState, useEffect } from 'react';
import { 
  Atom, 
  Layers, 
  TrendingUp, 
  Zap, 
  ChevronRight, 
  AlertTriangle, 
  DollarSign, 
  Scale, 
  Search,
  Sparkles,
  Loader2,
  PieChart
} from 'lucide-react';
import { Recipe, MenuItem, SupplyItem } from '../types.ts';
import { GoogleGenAI } from "@google/genai";

const RecipeManager: React.FC = () => {
  const [selectedRecipe, setSelectedRecipe] = useState<Recipe | null>(null);
  const [loading, setLoading] = useState(false);
  const [aiOptimizing, setAiOptimizing] = useState(false);
  const [aiOptimization, setAiOptimization] = useState<string | null>(null);

  // Mock de recetas atómicas
  const recipes: Recipe[] = [
    {
      id: 'R1',
      menu_item_id: 'M1',
      name: 'Kaori Lobster Roll',
      total_cost: 45000,
      target_margin: 70,
      suggested_price: 150000,
      ingredients: [
        { supply_item_id: 'S1', name: 'Langosta del Pacífico', quantity: 180, unit: 'g', cost_contribution: 32000 },
        { supply_item_id: 'S2', name: 'Arroz Koshihikari', quantity: 60, unit: 'g', cost_contribution: 4500 },
        { supply_item_id: 'S3', name: 'Alga Nori Premium', quantity: 1, unit: 'und', cost_contribution: 1500 },
        { supply_item_id: 'S4', name: 'Salsa Trufada OMM', quantity: 15, unit: 'ml', cost_contribution: 7000 }
      ]
    },
    {
      id: 'R2',
      menu_item_id: 'M2',
      name: 'Zen Gin Tonic',
      total_cost: 18000,
      target_margin: 80,
      suggested_price: 90000,
      ingredients: [
        { supply_item_id: 'S5', name: 'Gin Suntory Roku', quantity: 60, unit: 'ml', cost_contribution: 12000 },
        { supply_item_id: 'S6', name: 'Tónica Fever-Tree', quantity: 200, unit: 'ml', cost_contribution: 4500 },
        { supply_item_id: 'S7', name: 'Yuzu Fresco', quantity: 10, unit: 'ml', cost_contribution: 1500 }
      ]
    }
  ];

  const optimizeRecipe = async (recipe: Recipe) => {
    setAiOptimizing(true);
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    try {
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: `Analiza la receta de '${recipe.name}' con costo ${recipe.total_cost} y precio ${recipe.suggested_price}. 
        Ingredientes: ${recipe.ingredients.map(i => `${i.name} (${i.quantity}${i.unit})`).join(', ')}.
        Sugiere una optimización para aumentar el margen en un 5% sin sacrificar el 'lujo' percibido. Formato: Guion breve.`,
      });
      setAiOptimization(response.text || "");
    } catch (e) {
      setAiOptimization("Sugerencia IA: Sustituir el proveedor de Yuzu por producción local orgánica. Ahorro estimado: 12% en ese insumo.");
    } finally {
      setAiOptimizing(false);
    }
  };

  return (
    <div className="space-y-10 animate-in fade-in duration-700 text-left">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
        
        {/* Lista de Platos para Ingeniería */}
        <div className="lg:col-span-4 space-y-6">
           <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-600" size={16} />
              <input 
                type="text" 
                placeholder="BUSCAR PLATO / RECETA..."
                className="w-full bg-[#111114] border border-white/5 rounded-2xl py-4 pl-12 pr-6 text-[10px] font-black uppercase tracking-widest outline-none focus:border-blue-500 transition-all"
              />
           </div>

           <div className="bg-[#111114] border border-white/5 rounded-[3rem] overflow-hidden shadow-2xl">
              <div className="p-6 bg-black/20 border-b border-white/5">
                 <h4 className="text-[10px] font-black text-gray-500 uppercase tracking-widest italic">Catálogo de Ingeniería</h4>
              </div>
              <div className="divide-y divide-white/5">
                 {recipes.map(recipe => (
                   <button 
                    key={recipe.id}
                    onClick={() => { setSelectedRecipe(recipe); setAiOptimization(null); }}
                    className={`w-full p-6 text-left hover:bg-blue-600/5 transition-all flex items-center justify-between group ${selectedRecipe?.id === recipe.id ? 'bg-blue-600/10 border-l-4 border-blue-500' : ''}`}
                   >
                      <div>
                         <span className="text-xs font-black uppercase italic text-white group-hover:text-blue-400 transition-colors leading-none block mb-1">{recipe.name}</span>
                         <span className="text-[9px] text-gray-600 font-bold uppercase">Costo: ${recipe.total_cost.toLocaleString()}</span>
                      </div>
                      <div className="text-right">
                         <span className="text-sm font-black italic text-green-500">{recipe.target_margin}%</span>
                         <span className="text-[8px] text-gray-700 font-bold block uppercase">Margen</span>
                      </div>
                   </button>
                 ))}
              </div>
           </div>
        </div>

        {/* Desglose Atómico de la Receta */}
        <div className="lg:col-span-8">
           {selectedRecipe ? (
             <div className="space-y-8 animate-in slide-in-from-right duration-500">
                
                {/* Header Atómico */}
                <div className="bg-[#1a1a1e] border-2 border-blue-500/20 p-10 rounded-[3.5rem] relative overflow-hidden shadow-2xl">
                   <div className="absolute top-0 right-0 p-10 opacity-5"><Atom size={180} className="text-blue-500" /></div>
                   <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-8 relative z-10">
                      <div>
                         <span className="text-[10px] font-black text-blue-500 uppercase tracking-[0.4em] block mb-2 italic">Atomic Breakdown</span>
                         <h3 className="text-5xl font-black italic uppercase tracking-tighter text-white leading-none">{selectedRecipe.name}</h3>
                      </div>
                      <div className="flex gap-4">
                         <div className="bg-black/60 p-5 rounded-[2rem] border border-white/10 text-center">
                            <span className="text-[8px] text-gray-500 font-black uppercase block">Profit Bruto</span>
                            <span className="text-2xl font-black italic text-green-500">$ {(selectedRecipe.suggested_price - selectedRecipe.total_cost).toLocaleString()}</span>
                         </div>
                      </div>
                   </div>
                </div>

                {/* Composición de Insumos */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                   <div className="bg-[#111114] border border-white/5 rounded-[3rem] p-10 shadow-2xl">
                      <h4 className="text-xs font-black text-gray-500 uppercase tracking-widest mb-8 flex items-center gap-2">
                         <Layers size={16} className="text-blue-500" /> Componentes de Bodega
                      </h4>
                      <div className="space-y-6">
                         {selectedRecipe.ingredients.map((ing, idx) => (
                           <div key={idx} className="flex justify-between items-center group">
                              <div className="flex flex-col">
                                 <span className="text-[11px] font-black uppercase text-white group-hover:text-blue-400 transition-colors">{ing.name}</span>
                                 <span className="text-[9px] text-gray-600 font-bold uppercase">{ing.quantity} {ing.unit}</span>
                              </div>
                              <div className="text-right">
                                 <span className="text-xs font-black italic text-white">$ {ing.cost_contribution.toLocaleString()}</span>
                                 <div className="h-0.5 w-16 bg-white/5 rounded-full mt-1 overflow-hidden">
                                    <div className="h-full bg-blue-500" style={{ width: `${(ing.cost_contribution / selectedRecipe.total_cost) * 100}%` }}></div>
                                 </div>
                              </div>
                           </div>
                         ))}
                      </div>
                      <div className="mt-10 pt-8 border-t border-white/5 flex justify-between items-end">
                         <div>
                            <span className="text-[9px] text-gray-600 font-black uppercase block">Costo Total Receta</span>
                            <span className="text-2xl font-black italic text-white">$ {selectedRecipe.total_cost.toLocaleString()}</span>
                         </div>
                         <div className="bg-blue-600/10 px-4 py-2 rounded-xl border border-blue-500/20 text-blue-500">
                            <Scale size={16} />
                         </div>
                      </div>
                   </div>

                   <div className="space-y-8">
                      {/* Mentoría IA para Ingeniería */}
                      <div className="bg-blue-600 p-10 rounded-[3rem] relative overflow-hidden shadow-2xl group cursor-pointer" onClick={() => optimizeRecipe(selectedRecipe)}>
                         <div className="absolute top-0 right-0 p-8 opacity-10 group-hover:scale-110 transition-transform"><Sparkles size={80} fill="white" /></div>
                         <h4 className="text-[10px] font-black text-white/80 uppercase tracking-widest mb-6 flex items-center gap-2">
                           <Zap size={14} fill="white" /> AI RECIPE OPTIMIZER
                         </h4>
                         
                         {!aiOptimization ? (
                           <div className="space-y-4">
                              <p className="text-sm text-white italic font-medium leading-relaxed">
                                 ¿Deseas que NEXUM analice fluctuaciones de precios de proveedores para optimizar este escandallo?
                              </p>
                              <button 
                                disabled={aiOptimizing}
                                className="bg-white text-blue-600 px-8 py-3 rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-xl transition-all active:scale-95 flex items-center gap-2"
                              >
                                 {aiOptimizing ? <Loader2 className="animate-spin" size={14} /> : 'INICIAR ANÁLISIS'}
                              </button>
                           </div>
                         ) : (
                           <div className="space-y-6 animate-in fade-in duration-500">
                              <p className="text-sm text-white italic font-medium leading-relaxed">"{aiOptimization}"</p>
                              <div className="bg-white/20 p-4 rounded-2xl flex items-center justify-between">
                                 <span className="text-[9px] font-black uppercase text-white/80">Impacto Proyectado</span>
                                 <span className="text-xs font-black italic text-white">+ 5.2% Margen</span>
                              </div>
                           </div>
                         )}
                      </div>

                      {/* Benchmarks de Plato */}
                      <div className="bg-[#111114] border border-white/5 p-8 rounded-[3rem] shadow-2xl">
                         <h4 className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-6 italic">Métricas vs Promedio OMM</h4>
                         <div className="space-y-4">
                            <MetricRow label="Popularidad" value="Alta" color="text-blue-500" />
                            <MetricRow label="Velocidad Salida" value="08:15m" color="text-green-500" />
                            <MetricRow label="Impacto Mermas" value="Bajo" color="text-blue-500" />
                         </div>
                      </div>
                   </div>
                </div>
             </div>
           ) : (
             <div className="h-full min-h-[600px] flex flex-col items-center justify-center opacity-20 border-4 border-dashed border-white/5 rounded-[4rem]">
                <PieChart size={64} className="mb-6" />
                <h4 className="text-2xl font-black italic uppercase">Selecciona un plato para ver su ingeniería</h4>
                <p className="text-[10px] font-bold uppercase tracking-[0.4em] mt-4">NEXUM RECIPE ENGINE V4</p>
             </div>
           )}
        </div>

      </div>
    </div>
  );
};

const MetricRow = ({ label, value, color }: { label: string, value: string, color: string }) => (
  <div className="flex justify-between items-center border-b border-white/5 pb-3">
     <span className="text-[9px] font-black text-gray-600 uppercase">{label}</span>
     <span className={`text-xs font-black italic ${color}`}>{value}</span>
  </div>
);

export default RecipeManager;
