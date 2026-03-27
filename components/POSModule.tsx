import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase.ts';
import { Table, RitualTask } from '../types.ts';
import { BellRing, Settings, MonitorPlay, MessageSquare, Sparkles, Receipt } from 'lucide-react';
import MenuGrid from './MenuGrid.tsx';
import OrderTicket from './OrderTicket.tsx';

interface POSProps {
  tables: any[]; 
  onUpdateTable: (tableId: number, updates: Partial<Table>) => void;
  tasks: RitualTask[];
  onOpenVisionAI?: () => void;
}

const ServiceOSModule: React.FC<POSProps> = ({ tables, onUpdateTable, onOpenVisionAI }) => {
  const [selectedTableId, setSelectedTableId] = useState<number | null>(1);
  const [currentCat, setCurrentCat] = useState('Compartir');
  const [rightTab, setRightTab] = useState<'IA' | 'Cuenta' | 'Chat'>('IA');
  const [showNotifications, setShowNotifications] = useState(false);
  const [chatMessage, setChatMessage] = useState('');
  const [chatHistory, setChatHistory] = useState([
    { sender: 'Cocina', msg: 'Mesa 4, marchando principales.', time: '19:45' },
    { sender: 'Host', msg: 'Mesa 2 VIP acaba de llegar.', time: '19:30' }
  ]);
  
  const notifications = [
    { id: 1, type: 'alert', title: 'Mesa 4 - Demora', desc: 'Tiempo de espera excedido en principales (>25m)', time: 'Hace 2 min' },
    { id: 2, type: 'request', title: 'Mesa 2 - Petición', desc: 'Cliente solicita la cuenta', time: 'Hace 5 min' },
    { id: 3, type: 'info', title: 'Cocina', desc: '86 Calamares Fritos', time: 'Hace 10 min' }
  ];
  
  const categorias = ['Compartir','Robata','Wok','Makis','Sashimis','Nigiris','Geishas','Temakis','Postres','Cocteles','Sin Alcohol','Jugos','Café','Cervezas','Sakes'];

  // Mock tables for UI
  const displayTables = [
    { id: 1, num: 12, cliente: 'López', pax: 3, time: '00:45', ticket: 65, meta: 120, status: 'activa', vip: false, bday: false, alert: false },
    { id: 2, num: 8,  cliente: 'Sra. García', pax: 2, time: '01:10', ticket: 140, meta: 100, status: 'activa', vip: true, bday: false, alert: false },
    { id: 3, num: 5,  cliente: 'Cumpleaños', pax: 6, time: '00:50', ticket: 40, meta: 80, status: 'activa', vip: false, bday: true, alert: false },
    { id: 4, num: 4,  cliente: 'Martínez', pax: 4, time: '00:55', ticket: 95, meta: 150, status: 'activa', vip: false, bday: false, alert: true },
  ];

  const selectedTable = displayTables.find(t => t.id === selectedTableId) || displayTables[0];

  const clienteData: Record<number, any> = {
    1: { nombre:'Sr. López', desc:'Regular y amante de Malbec', avatar:'L', tags:['Sin mariscos','Prefiere vinos secos','No muy demandante ✓'], suggest:'Ofrece un vino blanco mineral', alert:'', recs:[{icon:'🐟',txt:'Recomiéndale el Ceviche de Camarón como entrada ligera'},{icon:'🍷',txt:'Sugiérale un Malbec como vino premium'},{icon:'🍫',txt:'Promueva el "Volcán de Chocolate" para el postre'}] },
    2: { nombre:'Sra. García', desc:'VIP — Visita frecuente', avatar:'G', tags:['Prefiere mesa tranquila','Alérgica a nuez 🚨','Le encanta el Rosé'], suggest:'Evita nueces en todo su pedido', alert:'Alergia a nuez', recs:[{icon:'🥗',txt:'Recomienda la ensalada sin aderezo de nueces'},{icon:'🍾',txt:'Tiene su botella de Rosé favorita guardada'},{icon:'🍰',txt:'El cheesecake es su postre preferido'}] },
    3: { nombre:'Mesa Cumpleaños', desc:'Grupo especial — 6 personas', avatar:'🎂', tags:['Pedir cortesía de cumpleaños','Sugerir para compartir','Buget alto'], suggest:'Sugiere tabla para compartir y postre sorpresa', alert:'', recs:[{icon:'🧆',txt:'Tabla Ibérica para compartir como aperitivo'},{icon:'🍾',txt:'Prosecco para brindar'},{icon:'🎂',txt:'Coordinar postre sorpresa con cocina'}] },
    4: { nombre:'Sr. Martínez', desc:'Primera visita', avatar:'M', tags:['Llegó molesto — requiere atención','Revisar tiempos de espera','Posible queja'], suggest:'Atención prioritaria, ofrecer amuse-bouche', alert:'Tiempo de espera excedido', recs:[{icon:'🍅',txt:'Ofrecer Bruschetta de cortesía por la espera'},{icon:'⏱',txt:'Avisar a cocina que tiene prioridad'},{icon:'💬',txt:'Presentarte y disculparte por el tiempo'}] },
  };

  const c = clienteData[selectedTable.id];

  const ritualStepsAll = ['Agua','Coctel','Compartir','Robata/Wok','Postre'];
  const mesaRitualState: Record<number, string[]> = { 1:['Agua'], 2:['Agua','Aperitivo'], 3:['Agua'], 4:[] };

  const iaRecsByCat: Record<string, any[]> = {
    Compartir:    [{emoji:'🦀',name:'Otosan de Kani x2',reason:'el más pedido',precio:'$33.600',pct:93,top:true},{emoji:'🐟',name:'Ceviche a la Roca',reason:'alta rentabilidad',precio:'$65.200',pct:88,top:true},{emoji:'🥟',name:'Dumplings de Cerdo x2',reason:'ideal para grupos',precio:'$27.400',pct:76,top:false}],
    Robata:       [{emoji:'🐙',name:'Pulpo Ton',reason:'plato estrella',precio:'$56.800',pct:91,top:true},{emoji:'🦐',name:'Ebi Buda x2',reason:'alta rentabilidad',precio:'$49.900',pct:85,top:true},{emoji:'🍢',name:'Yakitori',reason:'fácil de vender',precio:'$42.600',pct:74,top:false}],
    Wok:          [{emoji:'🥩',name:'Arroz Ginza Beef',reason:'plato Premium',precio:'$79.900',pct:90,top:true},{emoji:'🐟',name:'Sake Ryoko',reason:'alta rentabilidad',precio:'$82.200',pct:85,top:true},{emoji:'🍜',name:'Noodles de Camarón al Curry',reason:'favorito recurrente',precio:'$44.800',pct:77,top:false}],
    Makis:        [{emoji:'🍣',name:'Tempura Miyako',reason:'alta rentabilidad',precio:'$63.400',pct:92,top:true},{emoji:'🍣',name:'Acevichado Kochi',reason:'el más pedido',precio:'$57.400',pct:87,top:true},{emoji:'🍣',name:'Mangō Kani',reason:'mover hoy',precio:'$58.900',pct:79,top:false}],
    Sashimis:     [{emoji:'🐟',name:'Unagui / Anguila',reason:'alta rentabilidad',precio:'$79.800',pct:88,top:true},{emoji:'🐟',name:'Maguro / Atún',reason:'plato Premium',precio:'$74.800',pct:83,top:true},{emoji:'🐟',name:'Sake / Salmón',reason:'el más pedido',precio:'$54.700',pct:75,top:false}],
    Nigiris:      [{emoji:'🍱',name:'Salmón Toryufu',reason:'plato estrella',precio:'$42.800',pct:90,top:true},{emoji:'🍱',name:'Shuto',reason:'alta rentabilidad',precio:'$42.800',pct:84,top:true},{emoji:'🦀',name:'Cangrejo Tartufato Yudai',reason:'muy solicitado',precio:'$38.900',pct:78,top:false}],
    Geishas:      [{emoji:'🌀',name:'Salmón Toro Hideki x2',reason:'plato Premium',precio:'$74.800',pct:91,top:true},{emoji:'🌀',name:'Una Noche en Tokyo x4',reason:'alta rentabilidad',precio:'$72.400',pct:85,top:true},{emoji:'🌀',name:'Miyagi de Salmón x5',reason:'para grupos',precio:'$54.700',pct:76,top:false}],
    Temakis:      [{emoji:'🌯',name:'Ibuka',reason:'alta rentabilidad',precio:'$38.900',pct:89,top:true},{emoji:'🌯',name:'Entraña x1',reason:'plato Premium',precio:'$35.800',pct:82,top:true},{emoji:'🌯',name:'Salmón x1',reason:'el más vendido',precio:'$29.400',pct:74,top:false}],
    Postres:      [{emoji:'🍱',name:'Kyoto Degustación',reason:'mayor ticket',precio:'$84.400',pct:95,top:true},{emoji:'🍮',name:'Koujun',reason:'alta rentabilidad',precio:'$34.800',pct:86,top:true},{emoji:'🍰',name:'Cheesecake Wagashi',reason:'favorito recurrente',precio:'$32.500',pct:80,top:false}],
    Cocteles:     [{emoji:'🍍',name:'Infinito',reason:'especial del chef',precio:'$54.800',pct:93,top:true},{emoji:'🍹',name:'Yin Peng',reason:'especial del chef',precio:'$49.900',pct:88,top:true},{emoji:'🍸',name:'Gin Ken',reason:'alta rentabilidad',precio:'$56.400',pct:80,top:false}],
    'Sin Alcohol':[{emoji:'🌸',name:'Flor de Sakura',reason:'alta rentabilidad',precio:'$18.600',pct:88,top:true},{emoji:'🌼',name:'Raito Amarillo',reason:'el más pedido',precio:'$18.600',pct:82,top:true},{emoji:'☀️',name:'Sol de Verano',reason:'refrescante',precio:'$18.400',pct:74,top:false}],
    Jugos:        [{emoji:'🥭',name:'Limonada de Mango Biche',reason:'alta rentabilidad',precio:'$17.600',pct:90,top:true},{emoji:'🍈',name:'Limonada de Lychee',reason:'exótico y popular',precio:'$18.900',pct:84,top:true},{emoji:'🥥',name:'Limonada de Coco',reason:'favorito recurrente',precio:'$18.800',pct:77,top:false}],
    Café:         [{emoji:'☕',name:'Espresso Doble',reason:'alta rentabilidad',precio:'$13.600',pct:91,top:true},{emoji:'🥛',name:'Latte',reason:'el más vendido',precio:'$14.200',pct:85,top:true},{emoji:'☕',name:'Capuccino',reason:'cierre ideal',precio:'$13.800',pct:79,top:false}],
    Cervezas:     [{emoji:'🍺',name:'Stella Artois',reason:'alta rentabilidad',precio:'$18.400',pct:89,top:true},{emoji:'🍺',name:'Corona Extra',reason:'muy solicitada',precio:'$14.800',pct:82,top:true},{emoji:'🍺',name:'Heineken',reason:'favorita',precio:'$15.400',pct:76,top:false}],
    Sakes:        [{emoji:'🍶',name:'Sake Momokawa Diamond',reason:'premium recomendado',precio:'$54.600',pct:92,top:true},{emoji:'🍶',name:'Sake G Joy',reason:'mayor ticket',precio:'$65.700',pct:86,top:true},{emoji:'🍶',name:'Sake de Durazno',reason:'el más pedido',precio:'$44.600',pct:78,top:false}],
  };

  const recs = iaRecsByCat[currentCat] || iaRecsByCat['Compartir'];

  return (
    <div className="flex h-full w-full bg-[#0a0a0a] text-[#f0f0f0] font-['DM_Sans'] overflow-hidden -m-12">
      {/* LEFT PANEL */}
      <div className="w-[270px] bg-[#141414] border-r border-[#2a2a2a] flex flex-col shrink-0">
        <div className="p-3.5 px-4 pb-2.5 flex items-center gap-2.5 border-b border-[#2a2a2a] shrink-0 relative">
          <span>🪑</span>
          <h2 className="font-['Syne'] text-[15px] font-bold flex-1">Mis Mesas</h2>
          <div className="flex gap-2">
            <div onClick={onOpenVisionAI} className="w-[34px] h-[34px] rounded-lg bg-[#1c1c1c] border border-[#2a2a2a] flex items-center justify-center cursor-pointer text-[#a0a0a0] hover:text-[#d4943a] hover:border-[#d4943a] transition-all relative" title="Vision AI">
              <MonitorPlay size={16} />
            </div>
            <div 
              onClick={() => setShowNotifications(!showNotifications)}
              className={`w-[34px] h-[34px] rounded-lg border flex items-center justify-center cursor-pointer transition-all relative ${showNotifications ? 'bg-[#d4943a]/10 border-[#d4943a] text-[#d4943a]' : 'bg-[#1c1c1c] border-[#2a2a2a] text-[#a0a0a0] hover:text-[#d4943a] hover:border-[#d4943a]'}`} 
              title="Notificaciones"
            >
              <BellRing size={16} />
              <div className="absolute top-1.5 right-1.5 w-[7px] h-[7px] rounded-full bg-[#e05050] border-[1.5px] border-[#141414]"></div>
            </div>
          </div>

          {/* Notifications Dropdown */}
          {showNotifications && (
            <div className="absolute top-[60px] right-4 w-[280px] bg-[#1c1c1c] border border-[#2a2a2a] rounded-xl shadow-2xl z-50 overflow-hidden flex flex-col">
              <div className="p-3 border-b border-[#2a2a2a] flex justify-between items-center bg-[#141414]">
                <span className="font-['Syne'] text-[13px] font-bold text-[#f0f0f0]">Notificaciones</span>
                <span className="text-[10px] text-[#d4943a] cursor-pointer hover:underline">Marcar leídas</span>
              </div>
              <div className="max-h-[300px] overflow-y-auto custom-scrollbar flex flex-col">
                {notifications.map(n => (
                  <div key={n.id} className="p-3 border-b border-[#2a2a2a] hover:bg-[#222222] cursor-pointer transition-all flex gap-3">
                    <div className="mt-0.5">
                      {n.type === 'alert' ? <span className="text-[14px]">⚠️</span> : n.type === 'request' ? <span className="text-[14px]">🛎️</span> : <span className="text-[14px]">ℹ️</span>}
                    </div>
                    <div className="flex-1">
                      <div className="flex justify-between items-start mb-1">
                        <span className={`text-[12px] font-bold ${n.type === 'alert' ? 'text-[#e05050]' : 'text-[#f0f0f0]'}`}>{n.title}</span>
                        <span className="text-[9px] text-[#606060]">{n.time}</span>
                      </div>
                      <div className="text-[11px] text-[#a0a0a0] leading-snug">{n.desc}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
        
        <select className="mx-3 my-2.5 bg-[#1c1c1c] border border-[#2a2a2a] text-[#f0f0f0] rounded-lg px-3 py-2 text-[13px] outline-none focus:border-[#d4943a] shrink-0">
          <option>M1 — $3 — Zona Principal</option>
          <option>M2 — $2 — Terraza</option>
          <option>M3 — $1 — Bar</option>
        </select>

        <div className="flex-1 p-2 px-3 flex flex-col gap-1.5 overflow-y-auto custom-scrollbar">
          {displayTables.map(m => {
            const pct = Math.min(100, Math.round((m.ticket / m.meta) * 100));
            const colorClass = pct >= 80 ? 'bg-[#3dba6f]' : pct >= 50 ? 'bg-[#d4943a]' : 'bg-[#e05050]';
            const isSelected = selectedTableId === m.id;
            
            return (
              <div 
                key={m.id}
                onClick={() => setSelectedTableId(m.id)}
                className={`bg-[#1c1c1c] border rounded-[10px] p-2.5 px-3 cursor-pointer transition-all relative ${isSelected ? 'border-[#d4943a] bg-[#d4943a]/5' : 'border-[#2a2a2a] hover:border-[#d4943a]/40'}`}
              >
                <div className="flex items-center gap-1.5 mb-1">
                  <span className="font-semibold text-[13px]">Mesa {m.num}</span>
                  <span className="text-[#a0a0a0] text-[12px] flex-1">{m.cliente}</span>
                  <div className="flex gap-1 items-center">
                    {m.vip && <span className="text-[13px] text-[#ffd700]">⭐</span>}
                    {m.bday && <span className="text-[13px]">🎂</span>}
                    {m.alert && <span className="text-[12px] text-[#e07830]">⚠️</span>}
                  </div>
                  <div className="w-5 h-5 rounded-full bg-[#3dba6f] text-white text-[10px] font-bold flex items-center justify-center shrink-0">{m.pax}</div>
                </div>
                <div className="flex items-center gap-2 mb-1.5">
                  <span className="text-[11px] text-[#606060] tabular-nums">{m.time}</span>
                  <span className="text-[11px] text-[#a0a0a0] ml-auto">${m.ticket} / ${m.meta}</span>
                </div>
                <div className="h-[3px] bg-[#2a2a2a] rounded-sm overflow-hidden">
                  <div className={`h-full rounded-sm transition-all duration-500 ${colorClass}`} style={{ width: `${pct}%` }}></div>
                </div>
              </div>
            );
          })}
        </div>

        <div className="p-2.5 px-3 pt-2.5 shrink-0">
          <div className="text-[11px] font-semibold uppercase tracking-[0.8px] text-[#606060] mb-2">
            Producto en <span className="text-[#e05050]">86</span> unidades
          </div>
          <div className="flex flex-col">
            <div className="flex items-center gap-2 py-1.5 border-b border-[#2a2a2a] text-[12px] text-[#a0a0a0]">
              <span className="text-[14px]">🦑</span>
              <span className="flex-1">Calamares Fritos</span>
              <button className="w-[22px] h-[22px] rounded-md bg-[#222222] border border-[#2a2a2a] flex items-center justify-center hover:bg-[#d4943a] hover:text-black hover:border-[#d4943a] transition-all">+</button>
            </div>
            <div className="flex items-center gap-2 py-1.5 text-[12px] text-[#a0a0a0]">
              <span className="text-[14px]">🧀</span>
              <span className="flex-1">Tarta de Queso</span>
              <button className="w-[22px] h-[22px] rounded-md bg-[#222222] border border-[#2a2a2a] flex items-center justify-center hover:bg-[#d4943a] hover:text-black hover:border-[#d4943a] transition-all">+</button>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between p-2 px-3 text-[13px] text-[#3dba6f] cursor-pointer border-t border-[#2a2a2a] shrink-0 hover:bg-[#3dba6f]/5">
          <span>🟢 Libre 3 mesas</span>
          <span>›</span>
        </div>
      </div>

      {/* CENTER PANEL */}
      <div className="flex-1 flex flex-col bg-[#0a0a0a] min-w-0">
        <div className="bg-[#141414] border-b border-[#2a2a2a] px-3 flex items-center h-[44px] shrink-0">
          <div className="flex gap-0.5 overflow-x-auto no-scrollbar h-full items-center">
            {categorias.map(cat => (
              <button 
                key={cat}
                onClick={() => setCurrentCat(cat)}
                className={`px-3.5 py-1.5 rounded-md text-[13px] font-medium whitespace-nowrap border transition-all h-[32px] flex items-center ${currentCat === cat ? 'text-[#f0f0f0] bg-[#1c1c1c] border-[#2a2a2a] font-semibold border-b-2 border-b-[#d4943a]' : 'border-transparent text-[#a0a0a0] bg-transparent hover:text-[#f0f0f0] hover:bg-[#1c1c1c]'}`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        <div className="flex-1 p-3.5 pt-3.5 overflow-y-auto custom-scrollbar">
          <div className="mb-3">
            <div className="flex items-center gap-2.5 text-[10px] text-[#606060] font-semibold uppercase tracking-[0.8px] mb-2.5 before:content-[''] before:flex-1 before:h-[1px] before:bg-[#2a2a2a] after:content-[''] after:flex-1 after:h-[1px] after:bg-[#2a2a2a]">
              {currentCat}
            </div>
            <MenuGrid selectedTableId={selectedTableId || 0} currentCat={currentCat} />
          </div>
        </div>

        <div className="bg-[#141414] border-t border-[#2a2a2a] flex flex-col shrink-0">
          {/* Ritual Row */}
          <div className="flex items-center gap-0 px-3 py-1.5 border-b border-[#2a2a2a] overflow-x-auto no-scrollbar">
            {displayTables.map(m => {
              const state = mesaRitualState[m.id] || [];
              return (
                <div key={m.id} className="flex items-center gap-1 shrink-0 mr-3.5 pr-3.5 border-r border-[#2a2a2a] last:border-r-0 last:mr-0">
                  <span className="text-[9px] font-bold text-[#606060] tracking-[0.5px] mr-1 whitespace-nowrap">M{m.num}</span>
                  {ritualStepsAll.map((step, i) => {
                    const done = state.includes(step);
                    const cur = !done && i === state.length;
                    let pillClass = "border-[#2a2a2a] bg-transparent text-[#606060] hover:text-[#a0a0a0]";
                    if (done) pillClass = "bg-[#3dba6f]/10 border-[#3dba6f]/35 text-[#3dba6f]";
                    else if (cur) pillClass = "bg-[#d4943a]/10 border-[#d4943a]/30 text-[#d4943a]";
                    
                    return (
                      <div key={step} className={`flex items-center gap-1 px-2 py-0.5 rounded-xl text-[10px] font-semibold cursor-pointer whitespace-nowrap border transition-all shrink-0 ${pillClass}`}>
                        {done ? '✓ ' : ''}{step}
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
          
          {/* IA Recs Row */}
          <div className="flex items-center gap-0 px-3 py-2 min-h-[72px] overflow-x-auto no-scrollbar">
            <div className="text-[9px] font-bold text-[#606060] tracking-[0.6px] uppercase whitespace-nowrap mr-2.5 shrink-0 flex flex-col gap-0.5 items-center">
              <span className="text-[14px]">✦</span>IA
            </div>
            {recs.map((r, i) => (
              <div key={i} className={`flex items-center gap-2.5 bg-[#1c1c1c] border rounded-[10px] p-2 px-3 min-w-[170px] max-w-[200px] shrink-0 cursor-pointer transition-all mr-2 relative hover:bg-[#d4943a]/5 hover:border-[#d4943a]/45 ${r.top ? 'border-[#d4943a]/30' : 'border-[#2a2a2a]'}`}>
                <span className="text-[24px] shrink-0">{r.emoji}</span>
                <div className="flex-1 min-w-0">
                  <div className="text-[12px] font-bold text-[#f0f0f0] whitespace-nowrap overflow-hidden text-ellipsis">{r.name}</div>
                  <div className="text-[10px] text-[#606060] mt-[1px]">{r.reason}</div>
                  <div className="text-[11px] text-[#d4943a] font-bold mt-[3px]">{r.precio}</div>
                </div>
                <span className="absolute top-1.5 right-2 text-[9px] text-[#d4943a] font-bold">{r.pct}%</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* RIGHT PANEL */}
      <div className="w-[310px] bg-[#141414] border-l border-[#2a2a2a] flex flex-col shrink-0">
        <div className="p-3 px-4 border-b border-[#2a2a2a] flex items-center gap-2.5 shrink-0">
          <div className="w-[34px] h-[34px] rounded-lg bg-gradient-to-br from-[#d4943a] to-[#b07820] flex items-center justify-center text-[16px] font-extrabold text-black font-['Syne']">N</div>
          <div>
            <div className="font-['Syne'] text-[14px] font-bold text-[#f0f0f0]">NEXUM</div>
            <div className="text-[11px] text-[#a0a0a0]">AI Asistente</div>
          </div>
          <div className="ml-auto w-[34px] h-[34px] rounded-lg bg-[#1c1c1c] border border-[#2a2a2a] flex items-center justify-center cursor-pointer text-[#a0a0a0] hover:text-[#d4943a] hover:border-[#d4943a] transition-all">
            <Settings size={16} />
          </div>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-[#2a2a2a] shrink-0">
          <button 
            onClick={() => setRightTab('IA')}
            className={`flex-1 py-2.5 text-[11px] font-bold uppercase tracking-widest flex items-center justify-center gap-1.5 transition-all ${rightTab === 'IA' ? 'text-[#d4943a] border-b-2 border-[#d4943a] bg-[#1c1c1c]' : 'text-[#606060] hover:text-[#a0a0a0] hover:bg-[#1a1a1a]'}`}
          >
            <Sparkles size={14} /> IA
          </button>
          <button 
            onClick={() => setRightTab('Cuenta')}
            className={`flex-1 py-2.5 text-[11px] font-bold uppercase tracking-widest flex items-center justify-center gap-1.5 transition-all ${rightTab === 'Cuenta' ? 'text-[#f0f0f0] border-b-2 border-[#f0f0f0] bg-[#1c1c1c]' : 'text-[#606060] hover:text-[#a0a0a0] hover:bg-[#1a1a1a]'}`}
          >
            <Receipt size={14} /> Cuenta
          </button>
          <button 
            onClick={() => setRightTab('Chat')}
            className={`flex-1 py-2.5 text-[11px] font-bold uppercase tracking-widest flex items-center justify-center gap-1.5 transition-all ${rightTab === 'Chat' ? 'text-[#3dba6f] border-b-2 border-[#3dba6f] bg-[#1c1c1c]' : 'text-[#606060] hover:text-[#a0a0a0] hover:bg-[#1a1a1a]'}`}
          >
            <MessageSquare size={14} /> Chat
          </button>
        </div>

        <div className="flex-1 p-3 px-3.5 flex flex-col gap-2.5 overflow-y-auto custom-scrollbar">
          
          {rightTab === 'IA' && (
            <>
              <div className="bg-[#1c1c1c] border border-[#2a2a2a] rounded-xl p-3.5">
                <div className="flex items-center gap-3 mb-2.5">
                  <div className="w-12 h-12 rounded-full bg-gradient-to-br from-[#3a3a3a] to-[#1a1a1a] flex items-center justify-center text-[20px] font-bold text-[#d4943a] font-['Syne'] border-2 border-[#2a2a2a] shrink-0">
                    {c.avatar}
                  </div>
                  <div>
                    <div className="font-['Syne'] text-[16px] font-bold text-[#f0f0f0]">{c.nombre}</div>
                    <div className="text-[11px] text-[#a0a0a0] italic">{c.desc}</div>
                  </div>
                </div>
                <div className="flex flex-col gap-1 mb-2">
                  <div className="text-[10px] text-[#606060] font-bold uppercase tracking-widest">Preferencias</div>
                  <div className="flex flex-wrap gap-1">
                    {c.tags.map((t: string) => <span key={t} className="text-[10px] bg-[#2a2a2a] text-[#a0a0a0] px-2 py-0.5 rounded-full">{t}</span>)}
                  </div>
                </div>
                <div className="flex flex-col gap-1">
                  <div className="text-[10px] text-[#606060] font-bold uppercase tracking-widest">Historial Reciente</div>
                  <div className="text-[11px] text-[#a0a0a0]">Última visita: Hace 2 semanas. Pidió: <span className="text-[#f0f0f0]">Ceviche a la Roca, Malbec</span>.</div>
                </div>
                <div className="text-[12px] text-[#a0a0a0] mt-2 pt-2 border-t border-[#2a2a2a]">
                  <b className="text-[#f0b45a]">Sugiere:</b> {c.suggest}
                </div>
              </div>

              <div className="bg-[#222222] border border-[#2a2a2a] rounded-xl p-3 px-3.5 text-[13px] leading-[1.6] text-[#f0f0f0] relative">
                <span className="absolute -top-2 left-3.5 bg-[#141414] px-1 text-[10px] text-[#d4943a]">✦</span>
                {selectedTable.id % 2 === 0 ? 
                  `El tiempo en mesa es de ${selectedTable.time}. Un buen momento para sugerir los postres o el café. Ticket actual: $${selectedTable.ticket}.` : 
                  `${c.nombre.split(' ')[1] || c.nombre}, para complementar su pedido, tengo una recomendación especial que encaja perfectamente con sus preferencias. ¿Le traigo la carta de vinos?`
                }
              </div>

              {c.alert && (
                <div className="bg-[#e05050]/10 border border-[#e05050]/25 rounded-[10px] p-2.5 px-3">
                  <div className="text-[12px] font-bold text-[#e05050] mb-1">⚠️ Alerta</div>
                  <div className="text-[12px] text-[#a0a0a0]">{c.alert}</div>
                </div>
              )}

              <div className="text-[11px] text-[#606060] font-semibold uppercase tracking-[0.8px] mt-2">Sugerencias IA</div>
              <div className="flex flex-col gap-1.5">
                {c.recs.map((r: any, i: number) => (
                  <div key={i} className="flex items-start gap-2.5 p-2 px-2.5 rounded-lg bg-[#1c1c1c] border border-[#2a2a2a] text-[12px] cursor-pointer transition-all hover:border-[#d4943a]/30 hover:bg-[#d4943a]/5">
                    <span className="text-[16px] shrink-0 mt-[1px]">{r.icon}</span>
                    <span className="text-[#a0a0a0] leading-[1.4]">{r.txt}</span>
                  </div>
                ))}
              </div>
            </>
          )}

          {rightTab === 'Cuenta' && (
            <>
              <div className="flex flex-col gap-1 mb-2">
                <div className="flex items-center gap-2 text-[13px]">
                  <div className="w-1.5 h-1.5 rounded-full bg-[#d4943a] shrink-0"></div>
                  <span className="text-[#a0a0a0]">Ticket:</span>
                  <span className="font-semibold text-[#f0f0f0]">${selectedTable.ticket}</span>
                  <span className="text-[#606060] text-[11px]">/ ${selectedTable.meta} meta ({Math.round(selectedTable.ticket/selectedTable.meta*100)}%)</span>
                </div>
                <div className="flex items-center gap-2 text-[13px]">
                  <div className="w-1.5 h-1.5 rounded-full bg-[#3dba6f] shrink-0"></div>
                  <span className="text-[#a0a0a0]">Postre:</span>
                  <span className="font-semibold text-[#f0f0f0]">85%</span>
                  <span className="text-[#606060] text-[11px]">Probable</span>
                </div>
              </div>

              {/* POS: CUENTA EN VIVO */}
              <OrderTicket table={selectedTable as any} onUpdateTable={onUpdateTable} />

              <div className="mt-auto pt-4 flex flex-col gap-2">
                <div className="flex gap-2 flex-wrap">
                  <button className="flex-1 min-w-[80px] py-2 px-2.5 rounded-lg font-['DM_Sans'] text-[12px] font-semibold cursor-pointer border border-[#2a2a2a] bg-transparent text-[#a0a0a0] hover:border-[#a0a0a0] hover:text-[#f0f0f0] transition-all text-center">
                    🧾 Ver Detalle
                  </button>
                  <button className="flex-1 min-w-[80px] py-2 px-2.5 rounded-lg font-['DM_Sans'] text-[12px] font-semibold cursor-pointer border border-[#d4943a] bg-[#d4943a] text-black hover:bg-[#f0b45a] hover:border-[#f0b45a] transition-all text-center">
                    Cobrar
                  </button>
                </div>
                <div className="flex gap-2 flex-wrap">
                  <button className="flex-1 min-w-[80px] py-2 px-2.5 rounded-lg font-['DM_Sans'] text-[12px] font-semibold cursor-pointer border border-[#2a2a2a] bg-transparent text-[#a0a0a0] hover:border-[#a0a0a0] hover:text-[#f0f0f0] transition-all text-center">
                    ↔ Transferir
                  </button>
                  <button className="flex-1 min-w-[80px] py-2 px-2.5 rounded-lg font-['DM_Sans'] text-[12px] font-semibold cursor-pointer border border-[#e05050]/30 bg-[#e05050]/15 text-[#e05050] hover:bg-[#e05050]/25 transition-all text-center">
                    Cerrar Mesa
                  </button>
                </div>
              </div>
            </>
          )}

          {rightTab === 'Chat' && (
            <div className="flex flex-col h-full">
              <div className="flex-1 overflow-y-auto flex flex-col gap-3 mb-3 pr-1">
                {chatHistory.map((msg, idx) => (
                  <div key={idx} className={`flex flex-col ${msg.sender === 'Cocina' ? 'items-start' : 'items-end'}`}>
                    <span className="text-[10px] text-[#606060] mb-0.5">{msg.sender} • {msg.time}</span>
                    <div className={`p-2 px-3 rounded-lg text-[12px] max-w-[85%] ${msg.sender === 'Cocina' ? 'bg-[#1c1c1c] border border-[#2a2a2a] text-[#f0f0f0]' : 'bg-[#3dba6f]/10 border border-[#3dba6f]/30 text-[#3dba6f]'}`}>
                      {msg.msg}
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-auto flex gap-2">
                <input 
                  type="text" 
                  value={chatMessage}
                  onChange={(e) => setChatMessage(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && chatMessage.trim()) {
                      setChatHistory([...chatHistory, { sender: 'Tú', msg: chatMessage, time: new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) }]);
                      setChatMessage('');
                    }
                  }}
                  placeholder="Mensaje a cocina/host..." 
                  className="flex-1 bg-[#1c1c1c] border border-[#2a2a2a] rounded-lg px-3 py-2 text-[12px] text-[#f0f0f0] outline-none focus:border-[#3dba6f]"
                />
                <button 
                  onClick={() => {
                    if (chatMessage.trim()) {
                      setChatHistory([...chatHistory, { sender: 'Tú', msg: chatMessage, time: new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) }]);
                      setChatMessage('');
                    }
                  }}
                  className="w-9 h-9 rounded-lg bg-[#3dba6f] text-black flex items-center justify-center hover:bg-[#4ade80] transition-all"
                >
                  <MessageSquare size={14} />
                </button>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
};

export default ServiceOSModule;
