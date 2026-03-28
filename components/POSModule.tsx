import React, { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../lib/supabase.ts';
import { Table, RitualTask } from '../types.ts';
import { BellRing, Settings, MonitorPlay, MessageSquare, Sparkles, Receipt, X, ShoppingCart } from 'lucide-react';

interface POSProps {
  tables: any[];
  onUpdateTable: (tableId: number, updates: Partial<Table>) => void;
  tasks: RitualTask[];
  onOpenVisionAI?: () => void;
}

interface OrderItem {
  nombre: string;
  precio: string;
  emoji: string;
  mesa: number;
}

interface POSModal {
  open: boolean;
  title: string;
  content: React.ReactNode;
}

const categorias = ['Compartir','Robata','Wok','Makis','Sashimis','Nigiris','Geishas','Temakis','Postres','Cocteles','Sin Alcohol','Jugos','Café','Cervezas','Sakes'];

const productos: Record<string, any[]> = {
  Compartir: [
    { nombre:'Burosu Shitake', precio:'$39.900', emoji:'🍜', badge:'recomendado' },
    { nombre:'Otosan de Kani x2', precio:'$33.600', emoji:'🦀', badge:'recomendado' },
    { nombre:'Ceviche a la Roca', precio:'$65.200', emoji:'🐟', badge:'gold' },
    { nombre:'Tori Surai', precio:'$42.600', emoji:'🍗', badge:'recomendado' },
    { nombre:'Ton Katsu', precio:'$44.800', emoji:'🥩', badge:'gold' },
    { nombre:'Camarones Kwaii', precio:'$53.200', emoji:'🦐', badge:'gold' },
    { nombre:'Dumplings de Cerdo x2', precio:'$27.400', emoji:'🥟', badge:'recomendado' },
    { nombre:'Gyosas de Res y Hongos x2', precio:'$32.200', emoji:'🥟', badge:'recomendado' },
    { nombre:'Dim Sum de Camarón x2', precio:'$29.700', emoji:'🦐', badge:'orange' },
    { nombre:'Bao de Pato Pekin x2', precio:'$95.600', emoji:'🦆', badge:'gold' },
  ],
  Robata: [
    { nombre:'Kanki Ribs x2', precio:'$46.200', emoji:'🍖', badge:'gold' },
    { nombre:'Ebi Buda x2', precio:'$49.900', emoji:'🦐', badge:'gold' },
    { nombre:'Otate al Fuego x2', precio:'$52.400', emoji:'🐚', badge:'gold' },
    { nombre:'Pulpo Ton', precio:'$56.800', emoji:'🐙', badge:'gold' },
    { nombre:'Yakitori', precio:'$42.600', emoji:'🍢', badge:'recomendado' },
  ],
  Wok: [
    { nombre:'Noodles de Camarón al Curry', precio:'$44.800', emoji:'🍜', badge:'recomendado' },
    { nombre:'Arroz Ginza Beef', precio:'$79.900', emoji:'🥩', badge:'gold' },
    { nombre:'Sake Ryoko', precio:'$82.200', emoji:'🐟', badge:'gold' },
    { nombre:'Tomahawk de Cerdo', precio:'$96.400', emoji:'🍖', badge:'gold' },
  ],
  Makis: [
    { nombre:'Acevichado Kochi', precio:'$57.400', emoji:'🍣', badge:'gold' },
    { nombre:'Otaku', precio:'$54.800', emoji:'🍣', badge:'recomendado' },
    { nombre:'Akito', precio:'$55.200', emoji:'🍣', badge:'recomendado' },
    { nombre:'Tempura Miyako', precio:'$63.400', emoji:'🍣', badge:'gold' },
    { nombre:'Mangō Kani', precio:'$58.900', emoji:'🍣', badge:'orange' },
  ],
  Sashimis: [
    { nombre:'Sake / Salmón', precio:'$54.700', emoji:'🐟', badge:'recomendado' },
    { nombre:'Ebi / Langostino', precio:'$62.400', emoji:'🦐', badge:'gold' },
    { nombre:'Maguro / Atún', precio:'$74.800', emoji:'🐟', badge:'gold' },
    { nombre:'Unagui / Anguila', precio:'$79.800', emoji:'🐟', badge:'gold' },
  ],
  Nigiris: [
    { nombre:'Salmón Toryufu', precio:'$42.800', emoji:'🍱', badge:'gold' },
    { nombre:'Cangrejo Tartufato Yudai', precio:'$38.900', emoji:'🦀', badge:'gold' },
    { nombre:'Shuto', precio:'$42.800', emoji:'🍱', badge:'gold' },
    { nombre:'Ren', precio:'$38.900', emoji:'🍱', badge:'recomendado' },
  ],
  Geishas: [
    { nombre:'Miyagi de Salmón x5', precio:'$54.700', emoji:'🌀', badge:'recomendado' },
    { nombre:'Una Noche en Tokyo x4', precio:'$72.400', emoji:'🌀', badge:'gold' },
    { nombre:'Salmón Toro Hideki x2', precio:'$74.800', emoji:'🌀', badge:'gold' },
  ],
  Temakis: [
    { nombre:'Ibuka', precio:'$38.900', emoji:'🌯', badge:'gold' },
    { nombre:'Entraña x1', precio:'$35.800', emoji:'🌯', badge:'gold' },
    { nombre:'Salmón x1', precio:'$29.400', emoji:'🌯', badge:'recomendado' },
  ],
  Postres: [
    { nombre:'Yorokobi de Sábila', precio:'$28.400', emoji:'🍮', badge:'recomendado' },
    { nombre:'Sin Miedo al Coco', precio:'$30.800', emoji:'🥥', badge:'recomendado' },
    { nombre:'Cheesecake Wagashi', precio:'$32.500', emoji:'🍰', badge:'gold' },
    { nombre:'Koujun', precio:'$34.800', emoji:'🍮', badge:'gold' },
    { nombre:'Kyoto Degustación', precio:'$84.400', emoji:'🍱', badge:'gold' },
  ],
  Cocteles: [
    { nombre:'Yin Peng', precio:'$49.900', emoji:'🍹', badge:'gold' },
    { nombre:'Infinito', precio:'$54.800', emoji:'🍍', badge:'gold' },
    { nombre:'Samhain', precio:'$52.400', emoji:'🍸', badge:'orange' },
    { nombre:'Gin Ken', precio:'$56.400', emoji:'🍸', badge:'gold' },
    { nombre:'Mojito de Lulo', precio:'$44.800', emoji:'🍹', badge:'recomendado' },
    { nombre:'Moscow Mule', precio:'$47.200', emoji:'🍺', badge:'recomendado' },
  ],
  'Sin Alcohol': [
    { nombre:'Raito Amarillo', precio:'$18.600', emoji:'🌼', badge:'recomendado' },
    { nombre:'Haku', precio:'$18.400', emoji:'🍵', badge:'recomendado' },
    { nombre:'Sol de Verano', precio:'$18.400', emoji:'☀️', badge:'recomendado' },
    { nombre:'Flor de Sakura', precio:'$18.600', emoji:'🌸', badge:'gold' },
  ],
  Jugos: [
    { nombre:'Limonada Natural', precio:'$10.800', emoji:'🍋', badge:'recomendado' },
    { nombre:'Limonada de Coco', precio:'$18.800', emoji:'🥥', badge:'recomendado' },
    { nombre:'Limonada de Mango Biche', precio:'$17.600', emoji:'🥭', badge:'gold' },
    { nombre:'Limonada de Lychee', precio:'$18.900', emoji:'🍈', badge:'gold' },
    { nombre:'Jugo de Naranja', precio:'$14.800', emoji:'🍊', badge:'recomendado' },
  ],
  Café: [
    { nombre:'Americano', precio:'$9.200', emoji:'☕', badge:'recomendado' },
    { nombre:'Capuccino', precio:'$13.800', emoji:'☕', badge:'recomendado' },
    { nombre:'Espresso', precio:'$7.600', emoji:'☕', badge:'recomendado' },
    { nombre:'Espresso Doble', precio:'$13.600', emoji:'☕', badge:'gold' },
    { nombre:'Latte', precio:'$14.200', emoji:'🥛', badge:'gold' },
    { nombre:'Té Verde', precio:'$15.600', emoji:'🍵', badge:'orange' },
  ],
  Cervezas: [
    { nombre:'Heineken', precio:'$15.400', emoji:'🍺', badge:'recomendado' },
    { nombre:'Corona Extra', precio:'$14.800', emoji:'🍺', badge:'recomendado' },
    { nombre:'Stella Artois', precio:'$18.400', emoji:'🍺', badge:'gold' },
    { nombre:'Club Colombia Dorada', precio:'$12.800', emoji:'🍺', badge:'recomendado' },
  ],
  Sakes: [
    { nombre:'Sake de Pistacho Pearl', precio:'$43.300', emoji:'🍶', badge:'gold' },
    { nombre:'Sake de Durazno', precio:'$44.600', emoji:'🍶', badge:'recomendado' },
    { nombre:'Sake Momokawa Diamond', precio:'$54.600', emoji:'🍶', badge:'gold' },
    { nombre:'Sake G Joy', precio:'$65.700', emoji:'🍶', badge:'gold' },
  ],
};

const prodDescs: Record<string, string> = {
  'Burosu Shitake': 'Sopa de hongos · Tataki de salmón · Noodles salteados',
  'Otosan de Kani x2': 'Papa crujiente camarón · Jaiba · Mayo de chile dulce',
  'Ceviche a la Roca': 'Atún fresco · Salsa huancaína · Chips de nativos',
  'Tori Surai': 'Cubos de pollo crujientes · Katsura de mango · Yogurt griego',
  'Ton Katsu': 'Bondiola de cerdo apanado · Panko japonés · Salsa Ton Katsu',
  'Camarones Kwaii': 'Camarones crujientes · Salsa ajo confitado · Flor de jamaica',
  'Dumplings de Cerdo x2': 'Bondiola de cerdo · Leche de coco · Salsa de pimientos',
  'Pulpo Ton': 'Pulpo asado robata · Salsa tankatsu · Shitake · Brócoli',
  'Yakitori': 'Pollo Asado robata · Salsa teriyaki · Vegetales · Arroz Ginza',
  'Arroz Ginza Beef': 'Entraña Angus · Salsa anguila y tamarindo · Trufa · Huevo pochado',
  'Kyoto Degustación': 'Versión mini de todos los postres',
  'Cheesecake Wagashi': 'Torta de queso japonesa · Helado de temporada',
};

const clienteData: Record<number, any> = {
  1: { nombre: 'Sr. López', desc: 'Regular y amante de Malbec', avatar: 'L', tags: ['Sin mariscos', 'Prefiere vinos secos', 'No muy demandante ✓'], suggest: 'Ofrece un vino blanco mineral', alert: '', recs: [{ icon: '🐟', txt: 'Recomiéndale el Ceviche de Camarón como entrada ligera' }, { icon: '🍷', txt: 'Sugiérale un Malbec como vino premium' }, { icon: '🍫', txt: 'Promueva el "Volcán de Chocolate" para el postre' }] },
  2: { nombre: 'Sra. García', desc: 'VIP — Visita frecuente', avatar: 'G', tags: ['Prefiere mesa tranquila', 'Alérgica a nuez 🚨', 'Le encanta el Rosé'], suggest: 'Evita nueces en todo su pedido', alert: 'Alergia a nuez', recs: [{ icon: '🥗', txt: 'Recomienda la ensalada sin aderezo de nueces' }, { icon: '🍾', txt: 'Tiene su botella de Rosé favorita guardada' }, { icon: '🍰', txt: 'El cheesecake es su postre preferido' }] },
  3: { nombre: 'Mesa Cumpleaños', desc: 'Grupo especial — 6 personas', avatar: '🎂', tags: ['Pedir cortesía de cumpleaños', 'Sugerir para compartir', 'Budget alto'], suggest: 'Sugiere tabla para compartir y postre sorpresa', alert: '', recs: [{ icon: '🧆', txt: 'Tabla Ibérica para compartir como aperitivo' }, { icon: '🍾', txt: 'Prosecco para brindar' }, { icon: '🎂', txt: 'Coordinar postre sorpresa con cocina' }] },
  4: { nombre: 'Sr. Martínez', desc: 'Primera visita', avatar: 'M', tags: ['Llegó molesto — requiere atención', 'Revisar tiempos de espera', 'Posible queja'], suggest: 'Atención prioritaria, ofrecer amuse-bouche', alert: 'Tiempo de espera excedido', recs: [{ icon: '🍅', txt: 'Ofrecer Bruschetta de cortesía por la espera' }, { icon: '⏱', txt: 'Avisar a cocina que tiene prioridad' }, { icon: '💬', txt: 'Presentarte y disculparte por el tiempo' }] },
};

const iaRecsByCat: Record<string, any[]> = {
  Compartir: [{ emoji: '🦀', name: 'Otosan de Kani x2', reason: 'el más pedido', precio: '$33.600', pct: 93, top: true }, { emoji: '🐟', name: 'Ceviche a la Roca', reason: 'alta rentabilidad', precio: '$65.200', pct: 88, top: true }, { emoji: '🥟', name: 'Dumplings de Cerdo x2', reason: 'ideal para grupos', precio: '$27.400', pct: 76, top: false }],
  Robata: [{ emoji: '🐙', name: 'Pulpo Ton', reason: 'plato estrella', precio: '$56.800', pct: 91, top: true }, { emoji: '🦐', name: 'Ebi Buda x2', reason: 'alta rentabilidad', precio: '$49.900', pct: 85, top: true }, { emoji: '🍢', name: 'Yakitori', reason: 'fácil de vender', precio: '$42.600', pct: 74, top: false }],
  Wok: [{ emoji: '🥩', name: 'Arroz Ginza Beef', reason: 'plato Premium', precio: '$79.900', pct: 90, top: true }, { emoji: '🐟', name: 'Sake Ryoko', reason: 'alta rentabilidad', precio: '$82.200', pct: 85, top: true }, { emoji: '🍜', name: 'Noodles de Camarón al Curry', reason: 'favorito recurrente', precio: '$44.800', pct: 77, top: false }],
  Makis: [{ emoji: '🍣', name: 'Tempura Miyako', reason: 'alta rentabilidad', precio: '$63.400', pct: 92, top: true }, { emoji: '🍣', name: 'Acevichado Kochi', reason: 'el más pedido', precio: '$57.400', pct: 87, top: true }, { emoji: '🍣', name: 'Mangō Kani', reason: 'mover hoy', precio: '$58.900', pct: 79, top: false }],
  Postres: [{ emoji: '🍱', name: 'Kyoto Degustación', reason: 'mayor ticket', precio: '$84.400', pct: 95, top: true }, { emoji: '🍮', name: 'Koujun', reason: 'alta rentabilidad', precio: '$34.800', pct: 86, top: true }, { emoji: '🍰', name: 'Cheesecake Wagashi', reason: 'favorito recurrente', precio: '$32.500', pct: 80, top: false }],
  Cocteles: [{ emoji: '🍍', name: 'Infinito', reason: 'especial del chef', precio: '$54.800', pct: 93, top: true }, { emoji: '🍹', name: 'Yin Peng', reason: 'especial del chef', precio: '$49.900', pct: 88, top: true }, { emoji: '🍸', name: 'Gin Ken', reason: 'alta rentabilidad', precio: '$56.400', pct: 80, top: false }],
  'Sin Alcohol': [{ emoji: '🌸', name: 'Flor de Sakura', reason: 'alta rentabilidad', precio: '$18.600', pct: 88, top: true }, { emoji: '🌼', name: 'Raito Amarillo', reason: 'el más pedido', precio: '$18.600', pct: 82, top: true }],
  Jugos: [{ emoji: '🥭', name: 'Limonada de Mango Biche', reason: 'alta rentabilidad', precio: '$17.600', pct: 90, top: true }, { emoji: '🍈', name: 'Limonada de Lychee', reason: 'exótico y popular', precio: '$18.900', pct: 84, top: true }],
  Café: [{ emoji: '☕', name: 'Espresso Doble', reason: 'alta rentabilidad', precio: '$13.600', pct: 91, top: true }, { emoji: '🥛', name: 'Latte', reason: 'el más vendido', precio: '$14.200', pct: 85, top: true }],
  Cervezas: [{ emoji: '🍺', name: 'Stella Artois', reason: 'alta rentabilidad', precio: '$18.400', pct: 89, top: true }, { emoji: '🍺', name: 'Corona Extra', reason: 'muy solicitada', precio: '$14.800', pct: 82, top: true }],
  Sakes: [{ emoji: '🍶', name: 'Sake Momokawa Diamond', reason: 'premium recomendado', precio: '$54.600', pct: 92, top: true }, { emoji: '🍶', name: 'Sake G Joy', reason: 'mayor ticket', precio: '$65.700', pct: 86, top: true }],
  Sashimis: [{ emoji: '🐟', name: 'Unagui / Anguila', reason: 'alta rentabilidad', precio: '$79.800', pct: 88, top: true }, { emoji: '🐟', name: 'Maguro / Atún', reason: 'plato Premium', precio: '$74.800', pct: 83, top: true }],
  Nigiris: [{ emoji: '🍱', name: 'Salmón Toryufu', reason: 'plato estrella', precio: '$42.800', pct: 90, top: true }, { emoji: '🍱', name: 'Shuto', reason: 'alta rentabilidad', precio: '$42.800', pct: 84, top: true }],
  Geishas: [{ emoji: '🌀', name: 'Salmón Toro Hideki x2', reason: 'plato Premium', precio: '$74.800', pct: 91, top: true }, { emoji: '🌀', name: 'Una Noche en Tokyo x4', reason: 'alta rentabilidad', precio: '$72.400', pct: 85, top: true }],
  Temakis: [{ emoji: '🌯', name: 'Ibuka', reason: 'alta rentabilidad', precio: '$38.900', pct: 89, top: true }, { emoji: '🌯', name: 'Entraña x1', reason: 'plato Premium', precio: '$35.800', pct: 82, top: true }],
};

const ritualStepsAll = ['Agua', 'Coctel', 'Compartir', 'Robata/Wok', 'Postre'];
const mesaRitualState: Record<number, string[]> = { 1: ['Agua'], 2: ['Agua', 'Aperitivo'], 3: ['Agua'], 4: [] };

const notifications = [
  { id: 1, type: 'alert', title: 'Mesa 4 - Demora', desc: 'Tiempo de espera excedido en principales (>25m)', time: 'Hace 2 min' },
  { id: 2, type: 'request', title: 'Mesa 2 - Petición', desc: 'Cliente solicita la cuenta', time: 'Hace 5 min' },
  { id: 3, type: 'info', title: 'Cocina', desc: '86 Calamares Fritos', time: 'Hace 10 min' },
];

function parsePrecio(p: string): number {
  return parseFloat(String(p).replace(/[$\s.]/g, '').replace(',', '.')) || 0;
}
function formatPrecio(n: number): string {
  return Math.round(n).toLocaleString('es-CO');
}
function getBadgeClass(b: string): string {
  return { recomendado: 'green', gold: 'gold', orange: 'orange', red: 'red' }[b] || 'green';
}
function getBadgeLabel(b: string): string {
  return { recomendado: 'Recomendado', gold: 'Alta rentable', orange: 'Mover Hoy', red: 'Urgente' }[b] || b;
}

const ServiceOSModule: React.FC<POSProps> = ({ tables, onUpdateTable, onOpenVisionAI }) => {
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Remover overflow-hidden de MAIN y su padre para que el módulo ocupe todo
    const main = document.querySelector('main') as HTMLElement;
    const mainParent = main?.parentElement as HTMLElement;
    const contentDiv = document.querySelector('[class*="overflow-y-auto"][class*="p-6"]') as HTMLElement;

    const origMainOverflow = main?.style.overflow || '';
    const origParentOverflow = mainParent?.style.overflow || '';
    const origContentPadding = contentDiv?.style.padding || '';
    const origContentOverflow = contentDiv?.style.overflow || '';
    const origContentHeight = contentDiv?.style.height || '';

    if (main) { main.style.overflow = 'visible'; }
    if (mainParent) { mainParent.style.overflow = 'visible'; }
    if (contentDiv) {
      contentDiv.style.padding = '0';
      contentDiv.style.overflow = 'hidden';
      contentDiv.style.height = '100%';
    }

    return () => {
      // Restaurar al desmontar
      if (main) main.style.overflow = origMainOverflow;
      if (mainParent) mainParent.style.overflow = origParentOverflow;
      if (contentDiv) {
        contentDiv.style.padding = origContentPadding;
        contentDiv.style.overflow = origContentOverflow;
        contentDiv.style.height = origContentHeight;
      }
    };
  }, []);

  const [selectedTableId, setSelectedTableId] = useState<number>(1);
  const [currentCat, setCurrentCat] = useState('Compartir');
  const [rightTab, setRightTab] = useState<'IA' | 'Cuenta' | 'Chat'>('IA');
  const [showNotifications, setShowNotifications] = useState(false);
  const [showOrderPanel, setShowOrderPanel] = useState(false);
  const [order, setOrder] = useState<OrderItem[]>([]);
  // Pedido pendiente de enviar a cocina (agregar a la orden)
  const [pendingOrder, setPendingOrder] = useState<OrderItem[]>([]);
  const [toast, setToast] = useState('');
  const [modal, setModal] = useState<POSModal>({ open: false, title: '', content: null });
  const [chatMessage, setChatMessage] = useState('');
  const [chatHistory, setChatHistory] = useState([
    { sender: 'Cocina', msg: 'Mesa 4, marchando principales.', time: '19:45' },
    { sender: 'Host', msg: 'Mesa 2 VIP acaba de llegar.', time: '19:30' },
  ]);
  const [posDescuento, setPosDescuento] = useState(0);
  const [posCorte, setPosCorte] = useState(0);
  const [notasMesero, setNotasMesero] = useState<Record<number, string[]>>({});
  const [ritualState, setRitualState] = useState<Record<number, string[]>>(mesaRitualState);
  const [addedCards, setAddedCards] = useState<Set<string>>(new Set());

  const displayTables = [
    { id: 1, num: 12, cliente: 'López', pax: 3, time: '00:45', ticket: 65, meta: 120, status: 'activa', vip: false, bday: false, alert: false },
    { id: 2, num: 8, cliente: 'Sra. García', pax: 2, time: '01:10', ticket: 140, meta: 100, status: 'activa', vip: true, bday: false, alert: false },
    { id: 3, num: 5, cliente: 'Cumpleaños', pax: 6, time: '00:50', ticket: 40, meta: 80, status: 'activa', vip: false, bday: true, alert: false },
    { id: 4, num: 4, cliente: 'Martínez', pax: 4, time: '00:55', ticket: 95, meta: 150, status: 'activa', vip: false, bday: false, alert: true },
  ];

  const selectedTable = displayTables.find(t => t.id === selectedTableId) || displayTables[0];
  const c = clienteData[selectedTable.id] || clienteData[1];
  const recs = iaRecsByCat[currentCat] || iaRecsByCat['Compartir'];

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(''), 2500);
  }, []);

  const closeModal = () => setModal({ open: false, title: '', content: null });

  const addToOrder = (p: any) => {
    setOrder(prev => [...prev, { ...p, mesa: selectedTable.num }]);
    const key = `${p.nombre}-${Date.now()}`;
    setAddedCards(prev => new Set([...prev, p.nombre]));
    setTimeout(() => setAddedCards(prev => { const n = new Set(prev); n.delete(p.nombre); return n; }), 1200);
    showToast(`✓ ${p.nombre} agregado al pedido`);
  };

  // MARCHAR AHORA — va directo a cocina sin pasar por orden
  const marcharAhora = (p: any) => {
    showToast(`🍽️ ${p.nombre} marchando ahora → Cocina`);
    setAddedCards(prev => new Set([...prev, p.nombre + '_marchar']));
    setTimeout(() => setAddedCards(prev => { const n = new Set(prev); n.delete(p.nombre + '_marchar'); return n; }), 1500);
  };

  // AGREGAR A LA ORDEN — va al pendingOrder para revisión antes de enviar
  const agregarAOrden = (p: any) => {
    setPendingOrder(prev => [...prev, { ...p, mesa: selectedTable.num }]);
    setAddedCards(prev => new Set([...prev, p.nombre]));
    setTimeout(() => setAddedCards(prev => { const n = new Set(prev); n.delete(p.nombre); return n; }), 1200);
    showToast(`+ ${p.nombre} → orden Mesa ${selectedTable.num}`);
  };

  const enviarOrdenPendiente = () => {
    if (pendingOrder.length === 0) { showToast('⚠️ La orden está vacía'); return; }
    const mesaItems = pendingOrder.filter(o => o.mesa === selectedTable.num);
    setModal({
      open: true, title: '',
      content: (
        <div>
          <div className="font-['Syne'] text-[17px] font-bold mb-1">🍽️ Enviar Orden — Mesa {selectedTable.num}</div>
          <div className="text-[11px] text-[#a0a0a0] mb-4">{c.nombre} · {selectedTable.pax} personas</div>
          <div className="mb-4 max-h-[240px] overflow-y-auto flex flex-col gap-1">
            {mesaItems.map((item, i) => (
              <div key={i} className="flex justify-between py-2 border-b border-[#2a2a2a] text-[13px] items-center">
                <span>{item.emoji} {item.nombre}</span>
                <div className="flex items-center gap-2">
                  <span className="text-[#d4943a] font-semibold">{item.precio}</span>
                  <button onClick={() => setPendingOrder(prev => prev.filter((_, idx) => idx !== i))}
                    className="text-[#606060] hover:text-[#e05050] text-[11px]">✕</button>
                </div>
              </div>
            ))}
          </div>
          <div className="bg-[#0a0a0a] rounded-lg p-3 mb-4 flex justify-between items-center">
            <span className="text-[13px] text-[#a0a0a0]">Total orden</span>
            <span className="text-[16px] font-bold text-[#d4943a]">${formatPrecio(mesaItems.reduce((s, o) => s + parsePrecio(o.precio), 0))}</span>
          </div>
          <div className="flex gap-2">
            <button onClick={closeModal} className="flex-1 py-2.5 rounded-xl border border-[#2a2a2a] text-[#a0a0a0] text-[13px] font-semibold hover:border-[#a0a0a0] transition-all">Cancelar</button>
            <button onClick={() => {
              closeModal();
              setOrder(prev => [...prev, ...pendingOrder]);
              setPendingOrder([]);
              showToast('🍽️ Orden enviada a cocina exitosamente');
            }} className="flex-[2] py-2.5 rounded-xl bg-[#d4943a] text-black text-[13px] font-bold hover:bg-[#f0b45a] transition-all">
              ✓ Enviar a Cocina
            </button>
          </div>
        </div>
      ),
    });
  };

  const removePendingOrder = (i: number) => {
    setPendingOrder(prev => prev.filter((_, idx) => idx !== i));
  };

  const addRitual = (name: string, price: string) => {
    setOrder(prev => [...prev, { nombre: name, precio: price, emoji: '💧', mesa: selectedTable.num }]);
    showToast(`✓ ${name} agregado — Ritual de Servicio`);
  };

  const removeOrder = (i: number) => {
    setOrder(prev => prev.filter((_, idx) => idx !== i));
  };

  const clearOrder = () => { setOrder([]); showToast('Pedido limpiado'); };

  const sendOrder = () => {
    if (order.length === 0) { showToast('⚠️ Agrega productos primero'); return; }
    const mesaItems = order.filter(o => o.mesa === selectedTable.num);
    setModal({
      open: true,
      title: '',
      content: (
        <div>
          <div className="font-['Syne'] text-[17px] font-bold mb-1">🧾 Confirmar Pedido — Mesa {selectedTable.num}</div>
          <div className="text-[11px] text-[#a0a0a0] mb-4">{c.nombre} · {selectedTable.pax} personas</div>
          <div className="mb-4 max-h-[200px] overflow-y-auto flex flex-col gap-1">
            {mesaItems.map((item, i) => (
              <div key={i} className="flex justify-between py-1.5 border-b border-[#2a2a2a] text-[13px]">
                <span>{item.emoji} {item.nombre}</span>
                <span className="text-[#d4943a] font-semibold">{item.precio}</span>
              </div>
            ))}
          </div>
          <div className="flex gap-2 mt-4">
            <button onClick={closeModal} className="flex-1 py-2 rounded-lg border border-[#2a2a2a] text-[#a0a0a0] text-[13px] font-semibold hover:border-[#a0a0a0] transition-all">Cancelar</button>
            <button onClick={() => {
              closeModal();
              showToast('🍽️ Pedido enviado a cocina exitosamente');
              setOrder(prev => prev.filter(o => o.mesa !== selectedTable.num));
              setShowOrderPanel(false);
            }} className="flex-[2] py-2 rounded-lg bg-[#d4943a] text-black text-[13px] font-bold hover:bg-[#f0b45a] transition-all">✓ Confirmar envío</button>
          </div>
        </div>
      ),
    });
  };

  const abrirPOS = (tableId: number) => {
    const m = displayTables.find(x => x.id === tableId);
    if (!m) return;
    const items = order.filter(o => o.mesa === m.num);
    const subtotal = m.ticket + items.reduce((s, o) => s + parsePrecio(o.precio), 0);
    const descuento = Math.round(subtotal * (posDescuento / 100));
    const subtotalNeto = Math.max(0, subtotal - descuento - posCorte);
    const iva = Math.round(subtotalNeto * 0.08);
    const propinaOpts = [0, 5, 10, 15];
    const [propinaIdx, setPropinaIdx] = [10, (v: number) => {}]; // default 10%
    const propinaMonto = Math.round(subtotalNeto * 0.10);
    const total = subtotalNeto + iva;
    const totalConPropina = total + propinaMonto;

    const procesarPago = (metodo: string, conPropina: boolean) => {
      closeModal();
      const montoFinal = conPropina ? totalConPropina : total;
      showToast(`✓ Pago procesado — ${metodo} — $${formatPrecio(montoFinal)}`);
      // Mostrar encuesta para tablet
      setTimeout(() => abrirEncuesta(tableId), 400);
    };

    setModal({
      open: true, title: '',
      content: (
        <div className="font-['DM_Sans']">
          {/* Header */}
          <div className="flex items-center justify-between mb-4">
            <div>
              <div className="font-['Syne'] text-[17px] font-bold">🧾 Cuenta — Mesa {m.num}</div>
              <div className="text-[11px] text-[#a0a0a0] mt-0.5">{m.cliente} · {m.pax} personas · {m.time}</div>
            </div>
          </div>

          {/* Items */}
          <div className="bg-[#0a0a0a] rounded-[10px] overflow-hidden mb-3 max-h-[180px] overflow-y-auto">
            <div className="px-3 py-2 bg-[#222] text-[10px] text-[#606060] font-bold uppercase tracking-wider grid grid-cols-[1fr,auto,auto] gap-2">
              <span>Producto</span><span className="text-right">Precio</span><span></span>
            </div>
            {m.ticket > 0 && (
              <div className="px-3 py-2 border-b border-[#2a2a2a] grid grid-cols-[1fr,auto,auto] gap-2 items-center">
                <span className="text-[12px]">📊 Consumo de mesa</span>
                <span className="text-[12px] text-[#d4943a] font-semibold text-right">${formatPrecio(m.ticket)}</span>
                <span></span>
              </div>
            )}
            {items.map((o, i) => (
              <div key={i} className="px-3 py-2 border-b border-[#2a2a2a] grid grid-cols-[1fr,auto,auto] gap-2 items-center">
                <span className="text-[12px]">{o.emoji} {o.nombre}</span>
                <span className="text-[12px] text-[#d4943a] font-semibold text-right">{o.precio}</span>
                <button onClick={() => removeOrder(order.indexOf(o))} className="text-[#e05050] text-[12px]">✕</button>
              </div>
            ))}
          </div>

          {/* Descuentos */}
          <div className="bg-[#0a0a0a] rounded-[10px] p-3 mb-3">
            <div className="text-[10px] text-[#606060] font-bold uppercase tracking-wider mb-2">Ajustes Gerente</div>
            <div className="flex items-center gap-2 mb-2">
              <span className="text-[12px] text-[#a0a0a0] flex-1">Descuento</span>
              <div className="flex gap-1">
                {[0, 5, 10, 15, 20].map(p => (
                  <button key={p} onClick={() => { setPosDescuento(p); abrirPOS(tableId); }}
                    className={`px-2 py-1 rounded-md text-[11px] font-semibold border transition-all ${posDescuento === p ? 'border-[#d4943a] bg-[#d4943a]/15 text-[#d4943a]' : 'border-[#2a2a2a] text-[#606060] hover:border-[#606060]'}`}>
                    {p}%
                  </button>
                ))}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[12px] text-[#a0a0a0] flex-1">Cortesía</span>
              <div className="flex gap-1">
                {[0, 5000, 10000, 20000].map(v => (
                  <button key={v} onClick={() => { setPosCorte(v); abrirPOS(tableId); }}
                    className={`px-2 py-1 rounded-md text-[11px] font-semibold border transition-all ${posCorte === v ? 'border-[#d4943a] bg-[#d4943a]/15 text-[#d4943a]' : 'border-[#2a2a2a] text-[#606060] hover:border-[#606060]'}`}>
                    {v === 0 ? '—' : `$${formatPrecio(v)}`}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Totales */}
          <div className="bg-[#0a0a0a] rounded-[10px] p-3 mb-3 flex flex-col gap-1.5">
            <div className="flex justify-between text-[12px] text-[#a0a0a0]"><span>Subtotal</span><span>${formatPrecio(subtotal)}</span></div>
            {posDescuento > 0 && <div className="flex justify-between text-[12px] text-[#3dba6f]"><span>Descuento ({posDescuento}%)</span><span>-${formatPrecio(descuento)}</span></div>}
            {posCorte > 0 && <div className="flex justify-between text-[12px] text-[#3dba6f]"><span>Cortesía</span><span>-${formatPrecio(posCorte)}</span></div>}
            <div className="flex justify-between text-[12px] text-[#a0a0a0]"><span>IVA (8%)</span><span>${formatPrecio(iva)}</span></div>
            <div className="flex justify-between text-[13px] font-bold pt-2 border-t border-[#2a2a2a] mt-1">
              <span>Total sin propina</span><span className="text-[#f0f0f0]">${formatPrecio(total)}</span>
            </div>
            <div className="flex justify-between text-[12px] text-[#606060]">
              <span>+ Propina sugerida (10%)</span><span>+${formatPrecio(propinaMonto)}</span>
            </div>
            <div className="flex justify-between text-[17px] font-bold pt-2 border-t border-[#2a2a2a] mt-1">
              <span>Total con propina</span><span className="text-[#f0b45a]">${formatPrecio(totalConPropina)}</span>
            </div>
          </div>

          {/* Métodos de pago */}
          <div className="text-[10px] text-[#606060] font-bold uppercase tracking-wider mb-2">Método de pago</div>
          <div className="grid grid-cols-2 gap-2 mb-3">
            {[
              { icon: '💵', label: 'Efectivo', color: '#3dba6f' },
              { icon: '💳', label: 'Tarjeta', color: '#4a8fd4' },
              { icon: '📱', label: 'Nequi / QR', color: '#9b72ff' },
              { icon: '🏦', label: 'Transferencia', color: '#d4943a' },
            ].map(mp => (
              <div key={mp.label} className="border border-[#2a2a2a] rounded-xl p-3 cursor-pointer hover:border-[#606060] transition-all">
                <div className="text-[20px] mb-1.5">{mp.icon}</div>
                <div className="text-[12px] font-semibold text-[#f0f0f0] mb-2">{mp.label}</div>
                <div className="flex flex-col gap-1">
                  <button onClick={() => procesarPago(mp.label, false)}
                    className="w-full py-1.5 rounded-lg border border-[#2a2a2a] text-[10px] font-semibold text-[#a0a0a0] hover:bg-[#2a2a2a] transition-all">
                    Sin propina — ${formatPrecio(total)}
                  </button>
                  <button onClick={() => procesarPago(mp.label, true)}
                    style={{ background: mp.color + '18', borderColor: mp.color + '50', color: mp.color }}
                    className="w-full py-1.5 rounded-lg border text-[10px] font-bold transition-all hover:opacity-90">
                    Con propina — ${formatPrecio(totalConPropina)}
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Dividir cuenta */}
          <button onClick={() => abrirDivision(tableId, totalConPropina, m.pax)}
            className="w-full py-2.5 rounded-xl border border-[#2a2a2a] text-[#a0a0a0] text-[13px] font-semibold hover:border-[#d4943a] hover:text-[#d4943a] transition-all flex items-center justify-center gap-2">
            👥 Dividir entre {m.pax} personas — ${formatPrecio(Math.round(totalConPropina / m.pax))} c/u
          </button>

          {/* Separador */}
          <div className="flex items-center gap-3 my-3">
            <div className="flex-1 h-px bg-[#2a2a2a]"></div>
            <span className="text-[10px] text-[#606060] uppercase tracking-wider">o</span>
            <div className="flex-1 h-px bg-[#2a2a2a]"></div>
          </div>

          {/* Botón modo cliente */}
          <button onClick={() => abrirModoCliente(tableId)}
            className="w-full py-3 rounded-xl bg-[#d4943a] text-black font-bold text-[14px] hover:bg-[#f0b45a] transition-all flex items-center justify-center gap-2">
            📲 Pasar tablet al cliente
          </button>
          <div className="text-[10px] text-[#606060] text-center mt-1.5">El cliente elige propina, paga y deja reseña</div>
        </div>
      ),
    });
    // Make modal wider
    setTimeout(() => {
      const box = document.querySelector('[class*="max-w-\\[520px\\]"]') as HTMLElement;
      if (box) box.style.maxWidth = '560px';
    }, 50);
  };

  // ========================
  // MODO CLIENTE — flujo Sunday completo
  // ========================
  const [clienteMode, setClienteMode] = useState(false);
  const [clientePaso, setClientePaso] = useState<'cuenta'|'propina'|'pago'|'encuesta'|'premio'>('cuenta');
  const [clienteTableId, setClienteTableId] = useState<number>(1);
  const [clientePropina, setClientePropina] = useState<number>(10);
  const [clienteRating, setClienteRating] = useState<number>(0);
  const [clienteRatings, setClienteRatings] = useState({ comida: 0, servicio: 0, ambiente: 0 });

  const abrirModoCliente = (tableId: number) => {
    setClienteTableId(tableId);
    setClientePaso('cuenta');
    setClientePropina(10);
    setClienteRating(0);
    setClienteRatings({ comida: 0, servicio: 0, ambiente: 0 });
    setClienteMode(true);
    closeModal();
  };

  const abrirEncuesta = (tableId: number) => {
    abrirModoCliente(tableId);
  };

  const abrirDivision = (tableId: number, total: number, pax: number) => {
    const m = displayTables.find(x => x.id === tableId);
    if (!m) return;
    const porPersona = Math.round(total / pax);
    const pagados = new Array(pax).fill(false);
    let pagadosState = [...pagados];

    const renderDiv = () => {
      setModal({
        open: true, title: '',
        content: (
          <div>
            <div className="font-['Syne'] text-[17px] font-bold mb-1">👥 Dividir Cuenta</div>
            <div className="text-[12px] text-[#a0a0a0] mb-4">
              Total: <span className="text-[#d4943a] font-bold">${formatPrecio(total)}</span> ÷ {pax} personas = <span className="text-[#f0b45a] font-bold">${formatPrecio(porPersona)}</span> c/u
            </div>
            <div className="flex flex-col gap-2 mb-4 max-h-[240px] overflow-y-auto">
              {Array.from({ length: pax }, (_, i) => (
                <div key={i} style={{ background: pagadosState[i] ? 'rgba(61,186,111,0.08)' : 'var(--card, #1c1c1c)', borderColor: pagadosState[i] ? 'rgba(61,186,111,0.3)' : '#2a2a2a' }}
                  className="flex justify-between items-center p-3 rounded-xl border">
                  <span className="text-[13px]">👤 Persona {i + 1}</span>
                  <span className="text-[#d4943a] font-bold text-[13px]">${formatPrecio(porPersona)}</span>
                  <button onClick={() => {
                    pagadosState[i] = !pagadosState[i];
                    showToast(`${pagadosState[i] ? '✅' : '↩'} Persona ${i + 1} — $${formatPrecio(porPersona)}`);
                    renderDiv();
                  }}
                    className={`px-3 py-1.5 rounded-lg text-[11px] font-semibold border transition-all ${pagadosState[i] ? 'border-[#3dba6f]/40 bg-[#3dba6f]/15 text-[#3dba6f]' : 'border-[#2a2a2a] text-[#a0a0a0] hover:border-[#d4943a] hover:text-[#d4943a]'}`}>
                    {pagadosState[i] ? '✓ Pagado' : 'Cobrar'}
                  </button>
                </div>
              ))}
            </div>
            <div className="flex gap-2">
              <button onClick={() => abrirPOS(tableId)} className="flex-1 py-2.5 rounded-xl border border-[#2a2a2a] text-[#a0a0a0] text-[12px] font-semibold hover:border-[#a0a0a0] transition-all">← Volver</button>
              <button onClick={() => {
                closeModal();
                showToast(`✓ Cuenta dividida y cobrada — Mesa ${m.num}`);
                setTimeout(() => abrirEncuesta(tableId), 400);
              }} className="flex-[2] py-2.5 rounded-xl bg-[#d4943a] text-black text-[12px] font-bold hover:bg-[#f0b45a] transition-all">✓ Finalizar cobro</button>
            </div>
          </div>
        ),
      });
    };
    renderDiv();
  };

  const toggleRitualStep = (mesaId: number, step: string) => {
    setRitualState(prev => {
      const current = prev[mesaId] || [];
      const has = current.includes(step);
      return { ...prev, [mesaId]: has ? current.filter(s => s !== step) : [...current, step] };
    });
    showToast(`✓ ${step} marcado`);
  };

  const useRec = (txt: string) => {
    setNotasMesero(prev => {
      const notes = prev[selectedTable.id] || [];
      if (notes.includes(txt)) { showToast('Ya anotado anteriormente'); return prev; }
      showToast(`📝 Anotado para Mesa ${selectedTable.num}`);
      return { ...prev, [selectedTable.id]: [...notes, txt] };
    });
  };

  const mesaCliente = displayTables.find(x => x.id === clienteTableId) || displayTables[0];
  const itemsCliente = order.filter(o => o.mesa === mesaCliente?.num);
  const subtotalCliente = (mesaCliente?.ticket || 0) + itemsCliente.reduce((s, o) => s + parsePrecio(o.precio), 0);
  const descuentoCliente = Math.round(subtotalCliente * (posDescuento / 100));
  const corteCliente = posCorte;
  const netoCliente = Math.max(0, subtotalCliente - descuentoCliente - corteCliente);
  const ivaCliente = Math.round(netoCliente * 0.08);
  const baseCliente = netoCliente + ivaCliente;
  const propinaCliente = Math.round(baseCliente * (clientePropina / 100));
  const totalCliente = baseCliente + propinaCliente;

  const StarRow = ({ label, field }: { label: string, field: 'comida'|'servicio'|'ambiente' }) => (
    <div className="flex items-center justify-between py-3 border-b border-[#1a1a1a]">
      <span className="text-[16px] text-[#ccc]">{label}</span>
      <div className="flex gap-2">
        {[1,2,3,4,5].map(s => (
          <button key={s} onClick={() => setClienteRatings(prev => ({ ...prev, [field]: s }))}
            className={`text-[24px] transition-all ${clienteRatings[field] >= s ? 'opacity-100' : 'opacity-25'}`}>⭐</button>
        ))}
      </div>
    </div>
  );

  if (clienteMode && mesaCliente) return (
    <div className="fixed inset-0 z-[9999] flex flex-col" style={{ background: '#0d0d0d', fontFamily: "'DM Sans', sans-serif" }}>

      {/* Header con logo + cerrar (solo para mesero) */}
      <div className="flex items-center justify-between px-6 pt-6 pb-4 shrink-0">
        <div className="text-center flex-1">
          <div className="font-['Syne'] text-[22px] font-black tracking-[-0.5px] text-white">OMM</div>
          <div className="text-[11px] text-[#606060] tracking-wider uppercase">Hospitality Intelligence</div>
        </div>
        <button onClick={() => setClienteMode(false)}
          className="w-9 h-9 rounded-full bg-[#1a1a1a] border border-[#2a2a2a] text-[#606060] hover:text-white flex items-center justify-center text-[14px] transition-all shrink-0">✕</button>
      </div>

      {/* Progress bar */}
      <div className="px-6 mb-6 shrink-0">
        <div className="flex gap-1.5">
          {(['cuenta','propina','pago','encuesta'] as const).map((paso, i) => (
            <div key={paso} className={`flex-1 h-1 rounded-full transition-all duration-500 ${
              paso === clientePaso ? 'bg-[#d4943a]' :
              ['cuenta','propina','pago','encuesta'].indexOf(clientePaso) > i ? 'bg-[#3dba6f]' : 'bg-[#2a2a2a]'
            }`}></div>
          ))}
        </div>
      </div>

      {/* PASO 1: CUENTA */}
      {clientePaso === 'cuenta' && (
        <div className="flex-1 overflow-y-auto px-6 pb-6">
          <div className="text-[13px] text-[#606060] mb-1">Mesa {mesaCliente.num}</div>
          <div className="flex items-baseline justify-between mb-6">
            <div className="font-['Syne'] text-[32px] font-black text-white">Por pagar</div>
            <div className="font-['Syne'] text-[32px] font-black text-[#d4943a]">${formatPrecio(baseCliente)}</div>
          </div>

          {/* Lista de items */}
          <div className="flex flex-col gap-0 mb-6">
            {mesaCliente.ticket > 0 && (
              <div className="flex items-center gap-3 py-3 border-b border-[#1a1a1a]">
                <div className="w-7 h-7 rounded-full bg-[#1a1a1a] border border-[#2a2a2a] flex items-center justify-center text-[11px] text-[#606060] shrink-0">📊</div>
                <span className="flex-1 text-[15px] text-[#ccc]">Consumo base mesa</span>
                <span className="text-[15px] font-semibold text-white">${formatPrecio(mesaCliente.ticket)}</span>
              </div>
            )}
            {itemsCliente.map((item, i) => (
              <div key={i} className="flex items-center gap-3 py-3 border-b border-[#1a1a1a]">
                <div className="w-7 h-7 rounded-full bg-[#1a1a1a] border border-[#2a2a2a] flex items-center justify-center text-[14px] shrink-0">{item.emoji}</div>
                <span className="flex-1 text-[15px] text-[#ccc]">{item.nombre}</span>
                <span className="text-[15px] font-semibold text-white">{item.precio}</span>
              </div>
            ))}
            {/* IVA */}
            <div className="flex items-center gap-3 py-3 border-b border-[#1a1a1a]">
              <div className="w-7 h-7 rounded-full bg-[#1a1a1a] border border-[#2a2a2a] flex items-center justify-center text-[11px] text-[#606060] shrink-0">%</div>
              <span className="flex-1 text-[15px] text-[#606060]">IVA (8%)</span>
              <span className="text-[15px] text-[#606060]">${formatPrecio(ivaCliente)}</span>
            </div>
          </div>

          <button onClick={() => setClientePaso('propina')}
            className="w-full py-4 rounded-2xl bg-[#d4943a] text-black font-bold text-[17px] hover:bg-[#f0b45a] transition-all">
            Pagar o dividir la cuenta →
          </button>
        </div>
      )}

      {/* PASO 2: PROPINA */}
      {clientePaso === 'propina' && (
        <div className="flex-1 flex flex-col justify-center px-6 pb-6">
          <div className="text-center mb-10">
            <div className="font-['Syne'] text-[28px] font-black text-white mb-2">Da las gracias</div>
            <div className="font-['Syne'] text-[28px] font-black text-[#d4943a] mb-2">con una propina</div>
            <div className="text-[14px] text-[#606060]">100% va a tu mesero</div>
          </div>

          <div className="grid grid-cols-3 gap-4 mb-8">
            {[10, 15, 20].map(pct => (
              <button key={pct} onClick={() => setClientePropina(pct)}
                className={`aspect-square rounded-3xl border-2 flex flex-col items-center justify-center transition-all ${
                  clientePropina === pct
                    ? 'border-[#d4943a] bg-[#d4943a]/15'
                    : 'border-[#2a2a2a] bg-[#1a1a1a] hover:border-[#606060]'
                }`}>
                {clientePropina === pct && <span className="text-[#d4943a] text-[20px] mb-1">✓</span>}
                <span className={`text-[28px] font-black font-['Syne'] ${clientePropina === pct ? 'text-[#d4943a]' : 'text-white'}`}>{pct}%</span>
              </button>
            ))}
          </div>

          <div className="text-center mb-8 text-[#606060]">
            <div className="text-[14px]">Propina: <span className="text-[#d4943a] font-bold">${formatPrecio(propinaCliente)}</span></div>
            <div className="text-[14px]">Total con propina: <span className="text-white font-bold">${formatPrecio(totalCliente)}</span></div>
          </div>

          <div className="flex flex-col gap-3">
            <button onClick={() => setClientePaso('pago')}
              className="w-full py-4 rounded-2xl bg-[#d4943a] text-black font-bold text-[17px] hover:bg-[#f0b45a] transition-all">
              Confirmar →
            </button>
            <button onClick={() => setClientePaso('cuenta')}
              className="text-[13px] text-[#606060] hover:text-[#a0a0a0] underline text-center transition-all">← Volver</button>
          </div>
        </div>
      )}

      {/* PASO 3: MÉTODO DE PAGO */}
      {clientePaso === 'pago' && (
        <div className="flex-1 overflow-y-auto px-6 pb-6">
          <div className="font-['Syne'] text-[26px] font-black text-white mb-1">¿Cómo pagas?</div>
          <div className="text-[14px] text-[#606060] mb-8">Total: <span className="text-[#d4943a] font-bold text-[18px]">${formatPrecio(totalCliente)}</span></div>

          <div className="flex flex-col gap-3 mb-8">
            {[
              { icon: '💵', label: 'Efectivo', sub: 'Paga en caja o con tu mesero', color: '#3dba6f' },
              { icon: '💳', label: 'Tarjeta débito / crédito', sub: 'Visa, Mastercard, Amex', color: '#4a8fd4' },
              { icon: '📱', label: 'Nequi / Daviplata', sub: 'Escanea el QR en tu app', color: '#9b72ff' },
              { icon: '👥', label: 'Dividir la cuenta', sub: `${mesaCliente.pax} personas · $${formatPrecio(Math.round(totalCliente / mesaCliente.pax))} c/u`, color: '#d4943a' },
            ].map(mp => (
              <button key={mp.label}
                onClick={() => {
                  closeModal();
                  if (mp.label === 'Dividir la cuenta') {
                    abrirDivision(clienteTableId, totalCliente, mesaCliente.pax);
                    setClienteMode(false);
                  } else {
                    setClientePaso('encuesta');
                    showToast(`✓ Pago con ${mp.label} registrado`);
                  }
                }}
                className="flex items-center gap-4 p-4 rounded-2xl border border-[#2a2a2a] bg-[#1a1a1a] hover:border-[#3a3a3a] active:scale-[0.98] transition-all text-left">
                <span className="text-[28px]">{mp.icon}</span>
                <div className="flex-1">
                  <div className="text-[16px] font-semibold text-white">{mp.label}</div>
                  <div className="text-[12px] text-[#606060]">{mp.sub}</div>
                </div>
                <span className="text-[#606060] text-[18px]">›</span>
              </button>
            ))}
          </div>

          {/* Subtotales */}
          <div className="bg-[#1a1a1a] rounded-2xl p-4 mb-6 flex flex-col gap-2">
            <div className="flex justify-between text-[13px] text-[#606060]"><span>Subtotal</span><span>${formatPrecio(netoCliente)}</span></div>
            <div className="flex justify-between text-[13px] text-[#606060]"><span>IVA (8%)</span><span>${formatPrecio(ivaCliente)}</span></div>
            <div className="flex justify-between text-[13px] text-[#606060]"><span>Propina ({clientePropina}%)</span><span>${formatPrecio(propinaCliente)}</span></div>
            <div className="flex justify-between text-[16px] font-bold text-white pt-2 border-t border-[#2a2a2a] mt-1"><span>Total</span><span>${formatPrecio(totalCliente)}</span></div>
          </div>

          <button onClick={() => setClientePaso('propina')}
            className="text-[13px] text-[#606060] hover:text-[#a0a0a0] underline text-center w-full transition-all">← Cambiar propina</button>
        </div>
      )}

      {/* PASO 4: ENCUESTA estilo Google */}
      {clientePaso === 'encuesta' && (
        <div className="flex-1 overflow-y-auto px-6 pb-6">
          <div className="text-center mb-8">
            <div className="text-[48px] mb-3">🙏</div>
            <div className="font-['Syne'] text-[24px] font-black text-white mb-2">¡Gracias por visitarnos!</div>
            <div className="text-[14px] text-[#606060]">¿Cómo fue tu experiencia en OMM?</div>
          </div>

          {/* Rating general */}
          <div className="flex justify-center gap-3 mb-8">
            {[1,2,3,4,5].map(s => (
              <button key={s} onClick={() => setClienteRating(s)}
                className={`text-[40px] transition-all duration-200 ${clienteRating >= s ? 'scale-110' : 'opacity-30 scale-90'}`}>⭐</button>
            ))}
          </div>

          {/* Ratings por categoría */}
          <div className="bg-[#1a1a1a] rounded-2xl px-4 mb-8">
            <StarRow label="Comida" field="comida" />
            <StarRow label="Servicio" field="servicio" />
            <StarRow label="Ambiente" field="ambiente" />
          </div>

          {/* Premio */}
          <div className="flex items-center gap-4 bg-[#d4943a]/10 border border-[#d4943a]/30 rounded-2xl p-4 mb-8">
            <span className="text-[36px]">🎁</span>
            <div>
              <div className="font-bold text-[#d4943a] text-[15px]">¡Gana un premio!</div>
              <div className="text-[12px] text-[#a0a0a0]">Comparte tu reseña en Google y obtén<br/>10% OFF en tu próxima visita</div>
            </div>
          </div>

          <div className="flex flex-col gap-3">
            <button onClick={() => {
              if (clienteRating > 0) {
                setClientePaso('premio');
              } else {
                showToast('⭐ Selecciona tu calificación primero');
              }
            }}
              className="w-full py-4 rounded-2xl bg-[#d4943a] text-black font-bold text-[16px] hover:bg-[#f0b45a] transition-all">
              Enviar y ver mi premio →
            </button>
            <button onClick={() => {
              setClienteMode(false);
              setOrder(prev => prev.filter(o => o.mesa !== mesaCliente.num));
              showToast(`✓ Mesa ${mesaCliente.num} cerrada · Gracias`);
            }}
              className="text-[13px] text-[#606060] hover:text-[#a0a0a0] underline text-center">
              Omitir encuesta
            </button>
          </div>
        </div>
      )}

      {/* PASO 5: PREMIO */}
      {clientePaso === 'premio' && (
        <div className="flex-1 flex flex-col items-center justify-center px-6 pb-6 text-center">
          <div className="text-[80px] mb-6 animate-bounce">🎉</div>
          <div className="font-['Syne'] text-[30px] font-black text-white mb-2">¡Eres increíble!</div>
          <div className="text-[15px] text-[#a0a0a0] mb-8">Tu opinión nos ayuda a mejorar cada día</div>

          {/* Cupón */}
          <div className="w-full bg-[#d4943a]/10 border-2 border-dashed border-[#d4943a]/50 rounded-3xl p-6 mb-8">
            <div className="text-[48px] mb-3">🏷️</div>
            <div className="font-['Syne'] text-[36px] font-black text-[#d4943a]">10% OFF</div>
            <div className="text-[14px] text-[#a0a0a0] mt-1">en tu próxima visita a OMM</div>
            <div className="mt-4 bg-[#0d0d0d] rounded-xl px-4 py-2 inline-block">
              <span className="text-[16px] font-mono font-bold text-white tracking-[4px]">OMM-{String(clienteTableId).padStart(3,'0')}-{Math.floor(Math.random()*9000+1000)}</span>
            </div>
            <div className="text-[11px] text-[#606060] mt-2">Válido por 30 días · Muéstralo al mesero</div>
          </div>

          {/* Link Google */}
          <a href="https://g.page/r/review" target="_blank" rel="noopener noreferrer"
            className="w-full py-4 rounded-2xl bg-white text-black font-bold text-[15px] flex items-center justify-center gap-2 mb-4 hover:bg-[#f0f0f0] transition-all">
            <span className="text-[20px]">📝</span> Dejar reseña en Google
          </a>

          <button onClick={() => {
            setClienteMode(false);
            setOrder(prev => prev.filter(o => o.mesa !== mesaCliente.num));
            showToast(`⭐ Mesa ${mesaCliente.num} cerrada · ¡Hasta pronto!`);
          }}
            className="w-full py-4 rounded-2xl bg-[#d4943a] text-black font-bold text-[16px] hover:bg-[#f0b45a] transition-all">
            ✓ Finalizar · Cerrar mesa
          </button>
        </div>
      )}
    </div>
  );

  const mesaOrderItems = order.filter(o => o.mesa === selectedTable.num);
  const mesaSubtotal = selectedTable.ticket + mesaOrderItems.reduce((s, o) => s + parsePrecio(o.precio), 0);

  return (
    <div ref={wrapperRef} className="flex bg-[#0a0a0a] text-[#f0f0f0]" style={{ 
      fontFamily: "'DM Sans', sans-serif",
      width: '100%',
      height: '100%',
      minHeight: '100vh',
      overflow: 'hidden'
    }}>

      {/* TOAST */}
      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-[#222] border border-[#2a2a2a] text-[#f0f0f0] px-5 py-2.5 rounded-lg text-[13px] z-[9999] whitespace-nowrap shadow-2xl">
          {toast}
        </div>
      )}

      {/* MODAL */}
      {modal.open && (
        <div className="fixed inset-0 bg-black/70 z-[500] flex items-center justify-center p-4" onClick={(e) => { if (e.target === e.currentTarget) closeModal(); }}>
          <div className="bg-[#1c1c1c] border border-[#2a2a2a] rounded-2xl p-6 w-full max-w-[520px] max-h-[90vh] overflow-y-auto relative">
            <button onClick={closeModal} className="absolute top-4 right-4 text-[#a0a0a0] hover:text-white text-[20px] leading-none">✕</button>
            {modal.content}
          </div>
        </div>
      )}

      {/* ORDER PANEL */}
      {showOrderPanel && (
        <div className="fixed right-0 top-0 h-full w-[300px] bg-[#141414] border-l border-[#2a2a2a] z-[400] flex flex-col shadow-2xl">
          <div className="p-4 border-b border-[#2a2a2a] flex items-center justify-between shrink-0">
            <h3 className="font-['Syne'] text-[15px] font-bold">🧾 Pedido — Mesa {selectedTable.num}</h3>
            <button onClick={() => setShowOrderPanel(false)} className="w-8 h-8 rounded-lg bg-[#1c1c1c] border border-[#2a2a2a] flex items-center justify-center text-[#a0a0a0] hover:text-white"><X size={14} /></button>
          </div>
          <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-1.5">
            {order.length === 0
              ? <p className="text-[12px] text-[#606060] text-center py-8">Sin productos aún</p>
              : order.map((item, i) => (
                <div key={i} className="flex items-center gap-2 py-2 border-b border-[#2a2a2a]">
                  <span className="text-[16px]">{item.emoji}</span>
                  <span className="flex-1 text-[12px] text-[#f0f0f0]">{item.nombre}</span>
                  <span className="text-[12px] text-[#d4943a] font-bold">{item.precio}</span>
                  <button onClick={() => removeOrder(i)} className="text-[#606060] hover:text-[#e05050] text-[12px] ml-1">✕</button>
                </div>
              ))}
          </div>
          <div className="p-3 border-t border-[#2a2a2a] shrink-0">
            <div className="flex justify-between text-[14px] font-bold mb-3">
              <span>Total</span>
              <span className="text-[#d4943a]">${formatPrecio(order.reduce((s, i) => s + parsePrecio(i.precio), 0))}</span>
            </div>
            <div className="flex gap-2">
              <button onClick={clearOrder} className="flex-1 py-2 rounded-lg border border-[#2a2a2a] text-[#a0a0a0] text-[12px] font-semibold hover:border-[#a0a0a0] transition-all">Limpiar</button>
              <button onClick={sendOrder} className="flex-[2] py-2 rounded-lg bg-[#d4943a] text-black text-[12px] font-bold hover:bg-[#f0b45a] transition-all">Enviar Pedido</button>
            </div>
          </div>
        </div>
      )}

      {/* LEFT PANEL */}
      <div className="w-[270px] bg-[#141414] border-r border-[#2a2a2a] flex flex-col shrink-0">
        <div className="p-3.5 px-4 pb-2.5 flex items-center gap-2.5 border-b border-[#2a2a2a] shrink-0 relative">
          <span>🪑</span>
          <h2 className="font-['Syne'] text-[15px] font-bold flex-1">Mis Mesas</h2>
          <div className="flex gap-2">
            <div onClick={onOpenVisionAI} className="w-[34px] h-[34px] rounded-lg bg-[#1c1c1c] border border-[#2a2a2a] flex items-center justify-center cursor-pointer text-[#a0a0a0] hover:text-[#d4943a] hover:border-[#d4943a] transition-all" title="Vision AI">
              <MonitorPlay size={16} />
            </div>
            <div onClick={() => setShowNotifications(!showNotifications)}
              className={`w-[34px] h-[34px] rounded-lg border flex items-center justify-center cursor-pointer transition-all relative ${showNotifications ? 'bg-[#d4943a]/10 border-[#d4943a] text-[#d4943a]' : 'bg-[#1c1c1c] border-[#2a2a2a] text-[#a0a0a0] hover:text-[#d4943a] hover:border-[#d4943a]'}`}>
              <BellRing size={16} />
              <div className="absolute top-1.5 right-1.5 w-[7px] h-[7px] rounded-full bg-[#e05050] border-[1.5px] border-[#141414]"></div>
            </div>
          </div>
          {showNotifications && (
            <div className="absolute top-[60px] right-4 w-[280px] bg-[#1c1c1c] border border-[#2a2a2a] rounded-xl shadow-2xl z-50 overflow-hidden">
              <div className="p-3 border-b border-[#2a2a2a] flex justify-between items-center bg-[#141414]">
                <span className="font-['Syne'] text-[13px] font-bold">Notificaciones</span>
                <span onClick={() => setShowNotifications(false)} className="text-[10px] text-[#d4943a] cursor-pointer hover:underline">Cerrar</span>
              </div>
              {notifications.map(n => (
                <div key={n.id} className="p-3 border-b border-[#2a2a2a] hover:bg-[#222] cursor-pointer flex gap-3">
                  <span className="text-[14px] mt-0.5">{n.type === 'alert' ? '⚠️' : n.type === 'request' ? '🛎️' : 'ℹ️'}</span>
                  <div className="flex-1">
                    <div className="flex justify-between mb-0.5">
                      <span className={`text-[12px] font-bold ${n.type === 'alert' ? 'text-[#e05050]' : 'text-[#f0f0f0]'}`}>{n.title}</span>
                      <span className="text-[9px] text-[#606060]">{n.time}</span>
                    </div>
                    <div className="text-[11px] text-[#a0a0a0]">{n.desc}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <select className="mx-3 my-2.5 bg-[#1c1c1c] border border-[#2a2a2a] text-[#f0f0f0] rounded-lg px-3 py-2 text-[13px] outline-none focus:border-[#d4943a] shrink-0">
          <option>M1 — Zona Principal</option>
          <option>M2 — Terraza</option>
          <option>M3 — Bar</option>
        </select>

        <div className="flex-1 p-2 px-3 flex flex-col gap-1.5 overflow-y-auto">
          {displayTables.map(m => {
            const pct = Math.min(100, Math.round((m.ticket / m.meta) * 100));
            const colorClass = pct >= 80 ? 'bg-[#3dba6f]' : pct >= 50 ? 'bg-[#d4943a]' : 'bg-[#e05050]';
            const isSelected = selectedTableId === m.id;
            return (
              <div key={m.id} onClick={() => setSelectedTableId(m.id)}
                className={`bg-[#1c1c1c] border rounded-[10px] p-2.5 px-3 cursor-pointer transition-all ${isSelected ? 'border-[#d4943a] bg-[#d4943a]/5' : 'border-[#2a2a2a] hover:border-[#d4943a]/40'}`}>
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

        <div className="p-2.5 px-3 shrink-0 border-t border-[#2a2a2a]">
          <div className="text-[11px] font-semibold uppercase tracking-[0.8px] text-[#606060] mb-2">
            Producto en <span className="text-[#e05050]">86</span> unidades
          </div>
          <div className="flex flex-col gap-1">
            {[{ icon: '🦑', name: 'Calamares Fritos' }, { icon: '🧀', name: 'Tarta de Queso' }].map(item => (
              <div key={item.name} className="flex items-center gap-2 py-1.5 border-b border-[#2a2a2a] text-[12px] text-[#a0a0a0] last:border-b-0">
                <span className="text-[14px]">{item.icon}</span>
                <span className="flex-1">{item.name}</span>
                <button onClick={() => showToast(`📋 ${item.name} reportado a stock`)}
                  className="w-[22px] h-[22px] rounded-md bg-[#222] border border-[#2a2a2a] flex items-center justify-center hover:bg-[#d4943a] hover:text-black hover:border-[#d4943a] transition-all text-[14px]">+</button>
              </div>
            ))}
          </div>
        </div>

        <div className="flex items-center justify-between p-2 px-3 text-[13px] text-[#3dba6f] cursor-pointer border-t border-[#2a2a2a] shrink-0 hover:bg-[#3dba6f]/5"
          onClick={() => showToast('🟢 Mesas libres: 5, 7, 9')}>
          <span>🟢 Libre 3 mesas</span>
          <span>›</span>
        </div>

        {/* VISTA PREVIA DEL PEDIDO PENDIENTE */}
        {pendingOrder.filter(o => o.mesa === selectedTable.num).length > 0 && (
          <div className="border-t border-[#d4943a]/30 bg-[#d4943a]/5 shrink-0">
            <div className="px-3 pt-2.5 pb-1 flex items-center justify-between">
              <span className="text-[11px] font-bold text-[#d4943a] uppercase tracking-wider">
                🧾 Orden Mesa {selectedTable.num}
              </span>
              <span className="text-[10px] text-[#606060]">
                {pendingOrder.filter(o => o.mesa === selectedTable.num).length} item(s)
              </span>
            </div>
            <div className="px-3 flex flex-col gap-1 max-h-[130px] overflow-y-auto pb-1" style={{ scrollbarWidth: 'none' }}>
              {pendingOrder.filter(o => o.mesa === selectedTable.num).map((item, i) => (
                <div key={i} className="flex items-center gap-1.5 py-1 border-b border-[#2a2a2a]/60 last:border-b-0">
                  <span className="text-[13px]">{item.emoji}</span>
                  <span className="flex-1 text-[11px] text-[#f0f0f0] truncate">{item.nombre}</span>
                  <span className="text-[11px] text-[#d4943a] font-semibold shrink-0">{item.precio}</span>
                  <button onClick={() => removePendingOrder(pendingOrder.findIndex((o, idx) => o.mesa === selectedTable.num && o.nombre === item.nombre && idx >= i))}
                    className="text-[#606060] hover:text-[#e05050] text-[10px] ml-0.5 shrink-0">✕</button>
                </div>
              ))}
            </div>
            <div className="px-3 pb-3 pt-2 flex items-center gap-2">
              <span className="text-[12px] font-bold text-[#f0b45a] flex-1">
                ${formatPrecio(pendingOrder.filter(o => o.mesa === selectedTable.num).reduce((s, o) => s + parsePrecio(o.precio), 0))}
              </span>
              <button onClick={() => setPendingOrder(prev => prev.filter(o => o.mesa !== selectedTable.num))}
                className="px-2 py-1.5 rounded-lg border border-[#2a2a2a] text-[10px] text-[#606060] hover:text-[#e05050] hover:border-[#e05050] transition-all">
                Limpiar
              </button>
              <button onClick={enviarOrdenPendiente}
                className="flex-1 py-1.5 rounded-lg bg-[#d4943a] text-black text-[11px] font-bold hover:bg-[#f0b45a] transition-all">
                🍽️ Enviar Orden
              </button>
            </div>
          </div>
        )}
      </div>

      {/* CENTER PANEL */}
      <div className="flex-1 flex flex-col bg-[#0a0a0a] min-w-0">
        {/* Category tabs */}
        <div className="bg-[#141414] border-b border-[#2a2a2a] px-3 flex items-center h-[44px] shrink-0">
          <div className="flex gap-0.5 overflow-x-auto h-full items-center" style={{ scrollbarWidth: 'none' }}>
            {categorias.map(cat => (
              <button key={cat} onClick={() => setCurrentCat(cat)}
                className={`px-3.5 py-1.5 rounded-md text-[13px] font-medium whitespace-nowrap border transition-all h-[32px] flex items-center ${currentCat === cat ? 'text-[#f0f0f0] bg-[#1c1c1c] border-[#2a2a2a] font-semibold border-b-2 border-b-[#d4943a]' : 'border-transparent text-[#a0a0a0] bg-transparent hover:text-[#f0f0f0] hover:bg-[#1c1c1c]'}`}>
                {cat}
              </button>
            ))}
          </div>
          {/* Cart button */}
          <button onClick={() => setShowOrderPanel(!showOrderPanel)}
            className={`ml-auto shrink-0 w-9 h-9 rounded-lg border flex items-center justify-center relative transition-all ${order.length > 0 ? 'bg-[#d4943a]/10 border-[#d4943a] text-[#d4943a]' : 'bg-[#1c1c1c] border-[#2a2a2a] text-[#a0a0a0] hover:text-[#d4943a]'}`}>
            <ShoppingCart size={16} />
            {order.length > 0 && (
              <span className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-[#d4943a] text-black text-[9px] font-bold flex items-center justify-center">{order.length}</span>
            )}
          </button>
        </div>

        {/* Products grid */}
        <div className="flex-1 p-3.5 overflow-y-auto">
          <div className="flex items-center gap-2.5 text-[10px] text-[#606060] font-semibold uppercase tracking-[0.8px] mb-3"
            style={{ display: 'flex', alignItems: 'center' }}>
            <div className="flex-1 h-px bg-[#2a2a2a]"></div>
            <span>{currentCat}</span>
            <div className="flex-1 h-px bg-[#2a2a2a]"></div>
          </div>
          <div className="grid gap-2.5" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(148px, 1fr))' }}>
            {(productos[currentCat] || []).map((p, i) => {
              const desc = prodDescs[p.nombre] || '';
              const isAdded = addedCards.has(p.nombre);
              const isMarchando = addedCards.has(p.nombre + '_marchar');
              const badgeColors: Record<string, string> = { green: 'bg-[#3dba6f]/15 text-[#3dba6f]', gold: 'bg-[#d4943a]/15 text-[#d4943a]', orange: 'bg-[#e07830]/15 text-[#e07830]' };
              return (
                <div key={i}
                  className={`bg-[#1c1c1c] border rounded-xl overflow-hidden transition-all flex flex-col relative ${isAdded ? 'border-[#3dba6f]' : isMarchando ? 'border-[#4a8fd4]' : 'border-[#2a2a2a] hover:border-[#d4943a]/50 hover:-translate-y-0.5'}`}>
                  <div className="w-full aspect-[4/3] bg-[#222] flex items-center justify-center text-[44px]">{p.emoji}</div>
                  <div className="p-2.5 flex flex-col gap-1 flex-1">
                    <div className="text-[12px] font-bold text-[#f0f0f0] leading-tight overflow-hidden text-ellipsis whitespace-nowrap">{p.nombre}</div>
                    {desc && <div className="text-[10px] text-[#606060] leading-snug flex-1 line-clamp-2">{desc}</div>}
                    <span className={`self-start text-[9px] font-semibold px-1.5 py-0.5 rounded-full ${badgeColors[getBadgeClass(p.badge)] || 'bg-[#3dba6f]/15 text-[#3dba6f]'}`}>{getBadgeLabel(p.badge)}</span>
                    <div className="text-[13px] font-bold text-[#d4943a] mt-0.5">{p.precio}</div>
                    {/* DOS BOTONES */}
                    <div className="flex gap-1 mt-1">
                      <button
                        onClick={(e) => { e.stopPropagation(); marcharAhora(p); }}
                        className="flex-1 py-1.5 rounded-lg bg-[#4a8fd4]/10 border border-[#4a8fd4]/30 text-[10px] font-bold text-[#4a8fd4] hover:bg-[#4a8fd4] hover:text-white hover:border-[#4a8fd4] transition-all">
                        🔥 Marchar
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); agregarAOrden(p); }}
                        className="flex-1 py-1.5 rounded-lg bg-[#222] border border-[#2a2a2a] text-[10px] font-bold text-[#a0a0a0] hover:bg-[#d4943a] hover:text-black hover:border-[#d4943a] transition-all">
                        + Orden
                      </button>
                    </div>
                  </div>
                  {isAdded && (
                    <div className="absolute inset-0 bg-[#3dba6f]/15 flex items-center justify-center text-[36px] pointer-events-none">✓</div>
                  )}
                  {isMarchando && (
                    <div className="absolute inset-0 bg-[#4a8fd4]/15 flex items-center justify-center text-[28px] pointer-events-none">🔥</div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Bottom bar: Rituales + IA Recs */}
        <div className="bg-[#141414] border-t border-[#2a2a2a] flex flex-col shrink-0">
          {/* Ritual row */}
          <div className="flex items-center gap-0 px-3 py-1.5 border-b border-[#2a2a2a] overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
            {displayTables.map(m => {
              const state = ritualState[m.id] || [];
              return (
                <div key={m.id} className="flex items-center gap-1 shrink-0 mr-3.5 pr-3.5 border-r border-[#2a2a2a] last:border-r-0 last:mr-0">
                  <span className="text-[9px] font-bold text-[#606060] tracking-[0.5px] mr-1 whitespace-nowrap">M{m.num}</span>
                  {ritualStepsAll.map((step, i) => {
                    const done = state.includes(step);
                    const cur = !done && i === state.length;
                    let cls = "border-[#2a2a2a] bg-transparent text-[#606060] hover:text-[#a0a0a0]";
                    if (done) cls = "bg-[#3dba6f]/10 border-[#3dba6f]/35 text-[#3dba6f]";
                    else if (cur) cls = "bg-[#d4943a]/10 border-[#d4943a]/30 text-[#d4943a]";
                    return (
                      <div key={step} onClick={() => toggleRitualStep(m.id, step)}
                        className={`flex items-center gap-1 px-2 py-0.5 rounded-xl text-[10px] font-semibold cursor-pointer whitespace-nowrap border transition-all shrink-0 ${cls}`}>
                        {done ? '✓ ' : ''}{step}
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>

          {/* IA Recs row */}
          <div className="flex items-center gap-0 px-3 py-2 min-h-[72px] overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
            <div className="text-[9px] font-bold text-[#606060] tracking-[0.6px] uppercase whitespace-nowrap mr-2.5 shrink-0 flex flex-col gap-0.5 items-center">
              <span className="text-[14px]">✦</span>IA
            </div>
            {recs.map((r, i) => (
              <div key={i} onClick={() => addToOrder({ nombre: r.name, precio: r.precio, emoji: r.emoji })}
                className={`flex items-center gap-2.5 bg-[#1c1c1c] border rounded-[10px] p-2 px-3 min-w-[170px] max-w-[200px] shrink-0 cursor-pointer transition-all mr-2 relative hover:bg-[#d4943a]/5 hover:border-[#d4943a]/45 ${r.top ? 'border-[#d4943a]/30' : 'border-[#2a2a2a]'}`}>
                <span className="text-[24px] shrink-0">{r.emoji}</span>
                <div className="flex-1 min-w-0">
                  <div className="text-[12px] font-bold text-[#f0f0f0] overflow-hidden text-ellipsis whitespace-nowrap">{r.name}</div>
                  <div className="text-[10px] text-[#606060] mt-px">{r.reason}</div>
                  <div className="text-[11px] text-[#d4943a] font-bold mt-px">{r.precio}</div>
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
          {(['IA', 'Cuenta', 'Chat'] as const).map(tab => {
            const icons = { IA: <Sparkles size={14} />, Cuenta: <Receipt size={14} />, Chat: <MessageSquare size={14} /> };
            const activeColors = { IA: 'text-[#d4943a] border-b-[#d4943a]', Cuenta: 'text-[#f0f0f0] border-b-[#f0f0f0]', Chat: 'text-[#3dba6f] border-b-[#3dba6f]' };
            return (
              <button key={tab} onClick={() => setRightTab(tab)}
                className={`flex-1 py-2.5 text-[11px] font-bold uppercase tracking-widest flex items-center justify-center gap-1.5 transition-all border-b-2 ${rightTab === tab ? `${activeColors[tab]} bg-[#1c1c1c]` : 'text-[#606060] border-b-transparent hover:text-[#a0a0a0] hover:bg-[#1a1a1a]'}`}>
                {icons[tab]} {tab}
              </button>
            );
          })}
        </div>

        <div className="flex-1 p-3 px-3.5 flex flex-col gap-2.5 overflow-y-auto">

          {rightTab === 'IA' && (
            <>
              <div className="bg-[#1c1c1c] border border-[#2a2a2a] rounded-xl p-3.5">
                <div className="flex items-center gap-3 mb-2.5">
                  <div className="w-12 h-12 rounded-full bg-[#1a1a1a] border-2 border-[#2a2a2a] flex items-center justify-center text-[20px] font-bold text-[#d4943a] font-['Syne'] shrink-0">{c.avatar}</div>
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
                <div className="text-[12px] text-[#a0a0a0] mt-2 pt-2 border-t border-[#2a2a2a]">
                  <b className="text-[#f0b45a]">Sugiere:</b> {c.suggest}
                </div>
              </div>

              <div className="bg-[#222] border border-[#2a2a2a] rounded-xl p-3 px-3.5 text-[13px] leading-[1.6] text-[#f0f0f0] relative">
                <span className="absolute -top-2 left-3.5 bg-[#141414] px-1 text-[10px] text-[#d4943a]">✦</span>
                {selectedTable.id % 2 === 0
                  ? `El tiempo en mesa es de ${selectedTable.time}. Buen momento para sugerir postres o café. Ticket: $${selectedTable.ticket}.`
                  : `${c.nombre.split(' ')[1] || c.nombre}, para complementar su pedido tengo una recomendación especial. ¿Le traigo la carta de vinos?`}
              </div>

              {c.alert && (
                <div className="bg-[#e05050]/10 border border-[#e05050]/25 rounded-[10px] p-2.5 px-3">
                  <div className="text-[12px] font-bold text-[#e05050] mb-1">⚠️ Alerta</div>
                  <div className="text-[12px] text-[#a0a0a0]">{c.alert}</div>
                </div>
              )}

              {/* Ritual de servicio */}
              <div className="bg-[#1c1c1c] border border-[#2a2a2a] rounded-xl p-3">
                <div className="text-[11px] text-[#a0a0a0] font-bold mb-2 flex items-center gap-1.5">
                  <span className="text-[#d4943a] italic" style={{ fontFamily: 'Georgia, serif' }}>Ritual</span> de Servicio
                </div>
                <div className="grid grid-cols-4 gap-1.5">
                  {[{ emoji: '💧', name: 'Con Gas', price: '$3.000' }, { emoji: '🫧', name: 'Sin Gas', price: '$3.000' }, { emoji: '🍞', name: 'Pan de Mesa', price: '$2.000' }, { emoji: '🫒', name: 'Aceite Oliva', price: '$4.000' }].map(r => (
                    <div key={r.name} onClick={() => addRitual(r.name, r.price)}
                      className="bg-[#141414] border border-[#2a2a2a] rounded-lg p-2 text-center cursor-pointer hover:border-[#d4943a] transition-all">
                      <div className="text-[20px] mb-1">{r.emoji}</div>
                      <div className="text-[9px] text-[#a0a0a0]">{r.name}</div>
                      <div className="text-[10px] text-[#d4943a] font-bold">{r.price}</div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="text-[11px] text-[#606060] font-semibold uppercase tracking-[0.8px]">Sugerencias IA</div>
              <div className="flex flex-col gap-1.5">
                {c.recs.map((r: any, i: number) => {
                  const anotado = (notasMesero[selectedTable.id] || []).includes(r.txt);
                  return (
                    <div key={i} onClick={() => useRec(r.txt)}
                      className={`flex items-start gap-2.5 p-2 px-2.5 rounded-lg border text-[12px] cursor-pointer transition-all ${anotado ? 'bg-[#3dba6f]/5 border-[#3dba6f]/25' : 'bg-[#1c1c1c] border-[#2a2a2a] hover:border-[#d4943a]/30 hover:bg-[#d4943a]/5'}`}>
                      <span className="text-[16px] shrink-0 mt-[1px]">{r.icon}</span>
                      <span className={`leading-[1.4] flex-1 ${anotado ? 'line-through text-[#606060]' : 'text-[#a0a0a0]'}`}>{r.txt}</span>
                      {anotado && <span className="text-[10px] text-[#3dba6f] shrink-0">✓</span>}
                    </div>
                  );
                })}
              </div>
            </>
          )}

          {rightTab === 'Cuenta' && (
            <>
              <div className="flex flex-col gap-1.5 mb-1">
                <div className="flex items-center gap-2 text-[13px]">
                  <div className="w-1.5 h-1.5 rounded-full bg-[#d4943a] shrink-0"></div>
                  <span className="text-[#a0a0a0]">Ticket:</span>
                  <span className="font-semibold text-[#f0f0f0]">${selectedTable.ticket}</span>
                  <span className="text-[#606060] text-[11px]">/ ${selectedTable.meta} ({Math.round(selectedTable.ticket / selectedTable.meta * 100)}%)</span>
                </div>
              </div>

              {/* Items en cuenta */}
              <div className="bg-[#1c1c1c] border border-[#2a2a2a] rounded-xl overflow-hidden">
                <div className="px-3 py-2 border-b border-[#2a2a2a] flex items-center justify-between bg-[#141414]">
                  <span className="font-['Syne'] text-[12px] font-bold">🧾 Cuenta — Mesa {selectedTable.num}</span>
                  <span className="text-[10px] text-[#606060]">{selectedTable.pax} pers · {selectedTable.time}</span>
                </div>
                <div className="max-h-[180px] overflow-y-auto">
                  {mesaOrderItems.length === 0
                    ? <p className="text-[11px] text-[#606060] text-center py-4">Sin productos agregados aún</p>
                    : mesaOrderItems.map((o, i) => (
                      <div key={i} className="flex items-center gap-2 px-3 py-2 border-b border-[#2a2a2a]">
                        <span className="text-[14px]">{o.emoji}</span>
                        <span className="flex-1 text-[12px]">{o.nombre}</span>
                        <span className="text-[12px] text-[#d4943a] font-bold">{o.precio}</span>
                        <button onClick={() => removeOrder(order.indexOf(o))} className="text-[#606060] hover:text-[#e05050] text-[12px]">✕</button>
                      </div>
                    ))}
                </div>
                <div className="p-3 border-t border-[#2a2a2a] flex flex-col gap-1">
                  <div className="flex justify-between text-[11px] text-[#a0a0a0]"><span>Subtotal</span><span>${formatPrecio(mesaSubtotal)}</span></div>
                  <div className="flex justify-between text-[11px] text-[#a0a0a0]"><span>IVA (8%)</span><span>${formatPrecio(Math.round(mesaSubtotal * 0.08))}</span></div>
                  <div className="flex justify-between text-[11px] text-[#606060]"><span>Propina (10%)</span><span>${formatPrecio(Math.round(mesaSubtotal * 0.10))}</span></div>
                  <div className="flex justify-between text-[15px] font-bold pt-2 border-t border-[#2a2a2a] mt-1">
                    <span>Total</span><span className="text-[#f0b45a]">${formatPrecio(mesaSubtotal + Math.round(mesaSubtotal * 0.08))}</span>
                  </div>
                </div>
              </div>

              <div className="flex gap-2 flex-wrap mt-auto">
                <button onClick={() => abrirPOS(selectedTableId)} className="flex-1 min-w-[80px] py-2 px-2.5 rounded-lg text-[12px] font-semibold border border-[#2a2a2a] text-[#a0a0a0] hover:border-[#a0a0a0] hover:text-[#f0f0f0] transition-all">🧾 Detalle</button>
                <button onClick={() => abrirPOS(selectedTableId)} className="flex-[2] min-w-[80px] py-2 px-2.5 rounded-lg text-[12px] font-semibold bg-[#d4943a] text-black border border-[#d4943a] hover:bg-[#f0b45a] transition-all">💳 Cobrar</button>
              </div>
              <div className="flex gap-2 flex-wrap">
                <button onClick={() => showToast('↔ Función de transferencia próximamente')} className="flex-1 min-w-[80px] py-2 px-2.5 rounded-lg text-[12px] font-semibold border border-[#2a2a2a] text-[#a0a0a0] hover:border-[#a0a0a0] transition-all">↔ Transferir</button>
                <button onClick={() => { showToast(`Mesa ${selectedTable.num} cerrada`); setOrder(prev => prev.filter(o => o.mesa !== selectedTable.num)); }} className="flex-1 min-w-[80px] py-2 px-2.5 rounded-lg text-[12px] font-semibold bg-[#e05050]/15 border border-[#e05050]/30 text-[#e05050] hover:bg-[#e05050]/25 transition-all">Cerrar Mesa</button>
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
                <input type="text" value={chatMessage} onChange={e => setChatMessage(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter' && chatMessage.trim()) { setChatHistory(prev => [...prev, { sender: 'Tú', msg: chatMessage, time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) }]); setChatMessage(''); } }}
                  placeholder="Mensaje a cocina/host..."
                  className="flex-1 bg-[#1c1c1c] border border-[#2a2a2a] rounded-lg px-3 py-2 text-[12px] text-[#f0f0f0] outline-none focus:border-[#3dba6f]" />
                <button onClick={() => { if (chatMessage.trim()) { setChatHistory(prev => [...prev, { sender: 'Tú', msg: chatMessage, time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) }]); setChatMessage(''); } }}
                  className="w-9 h-9 rounded-lg bg-[#3dba6f] text-black flex items-center justify-center hover:bg-[#4ade80] transition-all">
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
