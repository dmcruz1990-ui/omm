import React, { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../lib/supabase.ts';
import { Table, RitualTask } from '../types.ts';
import { BellRing, Settings, MonitorPlay, MessageSquare, Sparkles, Receipt, X, ShoppingCart, Lock } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

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

// Términos de cocción disponibles
const TERMINOS_COCCION = ['3/4', 'Término Medio', 'Bien Cocido', 'Poco Cocido', 'Azul'];

const productos: Record<string, any[]> = {
  Compartir: [
    { nombre:'Burosu Shitake', precio:'$39.900', emoji:'🍜', badge:'recomendado' },
    { nombre:'Otosan de Kani x2', precio:'$33.600', emoji:'🦀', badge:'recomendado' },
    { nombre:'Ceviche a la Roca', precio:'$65.200', emoji:'🐟', badge:'gold' },
    { nombre:'Tori Surai', precio:'$42.600', emoji:'🍗', badge:'recomendado', carne: true },
    { nombre:'Ton Katsu', precio:'$44.800', emoji:'🥩', badge:'gold', carne: true },
    { nombre:'Camarones Kwaii', precio:'$53.200', emoji:'🦐', badge:'gold' },
    { nombre:'Dumplings de Cerdo x2', precio:'$27.400', emoji:'🥟', badge:'recomendado', carne: true },
    { nombre:'Gyosas de Res y Hongos x2', precio:'$32.200', emoji:'🥟', badge:'recomendado', carne: true },
    { nombre:'Dim Sum de Camarón x2', precio:'$29.700', emoji:'🦐', badge:'orange' },
    { nombre:'Bao de Pato Pekin x2', precio:'$95.600', emoji:'🦆', badge:'gold', carne: true },
  ],
  Robata: [
    { nombre:'Kanki Ribs x2', precio:'$46.200', emoji:'🍖', badge:'gold', carne: true },
    { nombre:'Ebi Buda x2', precio:'$49.900', emoji:'🦐', badge:'gold' },
    { nombre:'Otate al Fuego x2', precio:'$52.400', emoji:'🐚', badge:'gold', carne: true },
    { nombre:'Pulpo Ton', precio:'$56.800', emoji:'🐙', badge:'gold' },
    { nombre:'Yakitori', precio:'$42.600', emoji:'🍢', badge:'recomendado', carne: true },
  ],
  Wok: [
    { nombre:'Noodles de Camarón al Curry', precio:'$44.800', emoji:'🍜', badge:'recomendado' },
    { nombre:'Arroz Ginza Beef', precio:'$79.900', emoji:'🥩', badge:'gold', carne: true },
    { nombre:'Sake Ryoko', precio:'$82.200', emoji:'🐟', badge:'gold' },
    { nombre:'Tomahawk de Cerdo', precio:'$96.400', emoji:'🍖', badge:'gold', carne: true },
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
    { nombre:'Ibuka', precio:'$38.900', emoji:'🌯', badge:'gold', carne: true },
    { nombre:'Entraña x1', precio:'$35.800', emoji:'🌯', badge:'gold', carne: true },
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

const prodDescs: Record<string, { desc: string; salsas: string; cross: string[]; chef: string }> = {
  'Burosu Shitake':          { desc: 'Sopa de hongos shiitake con tataki de salmón y noodles salteados en dashi', salsas: 'Caldo dashi · Aceite de sésamo · Ponzu', cross: ['Sake Momokawa Diamond','Otosan de Kani x2'], chef: 'Ideal como entrada ligera para mesas grandes' },
  'Otosan de Kani x2':       { desc: 'Papa crujiente rellena de jaiba · Mayo de chile dulce · Furikake', salsas: 'Mayo dulce · Salsa tonkatsu · Cebollín', cross: ['Burosu Shitake','Yin Peng'], chef: 'El más pedido de la carta — gran para compartir' },
  'Ceviche a la Roca':       { desc: 'Atún fresco marinado en leche de tigre · Chips de papa nativa · Salsa huancaína', salsas: 'Leche de tigre · Huancaína · Ají amarillo', cross: ['Gin Ken','Sake G Joy'], chef: 'Alto ticket · Alta rentabilidad · Ofrece siempre' },
  'Tori Surai':              { desc: 'Cubos de pollo crujiente · Katsura de mango · Yogurt griego · Sriracha', salsas: 'Sriracha · Yogurt · Mango katsura', cross: ['Yakitori','Yin Peng'], chef: 'Muy popular con clientes nuevos' },
  'Ton Katsu':               { desc: 'Bondiola de cerdo apanada en panko japonés · Ensalada de col · Salsa Tonkatsu', salsas: 'Salsa Tonkatsu · Col rallada · Mostaza japonesa', cross: ['Arroz Ginza Beef','Heineken'], chef: 'Gran maridaje con sake o cerveza japonesa' },
  'Camarones Kwaii':         { desc: 'Camarones crujientes · Salsa de ajo confitado · Flor de jamaica · Limón', salsas: 'Ajo confitado · Jamaica · Mantequilla noisette', cross: ['Ebi Buda x2','Copa Malbec'], chef: 'Plato premium — excelente para clientes VIP' },
  'Dumplings de Cerdo x2':   { desc: 'Bondiola de cerdo al vapor · Leche de coco · Salsa de pimientos asados', salsas: 'Pimientos asados · Coco · Soja dulce', cross: ['Otosan de Kani x2','Sake G Joy'], chef: 'Perfectos para iniciar la experiencia' },
  'Gyosas de Res y Hongos x2':{ desc: 'Gyosas a la plancha · Res wagyu molida · Hongos porcini · Aceite de trufa', salsas: 'Salsa ponzu · Aceite de trufa · Kimchi', cross: ['Arroz Ginza Beef','Old Fashion'], chef: 'Recomendar con el plato principal de res' },
  'Dim Sum de Camarón x2':   { desc: 'Dim sum al vapor · Camarón y jengibre · Cebolla cambray · Aceite de sésamo', salsas: 'Soja clara · Jengibre · Aceite de sésamo', cross: ['Burosu Shitake','Copa Rosé'], chef: 'Ligero — ideal para acompañar la mesa completa' },
  'Bao de Pato Pekin x2':    { desc: 'Pan bao esponjoso · Pato Pekin confitado · Pepino · Salsa hoisin', salsas: 'Hoisin artesanal · Pepino encurtido · Cebollín', cross: ['Gin Ken','Copa Malbec'], chef: 'El plato más premium del menú — alto ticket' },
  'Pulpo Ton':               { desc: 'Pulpo asado en robata · Salsa tankatsu · Shitake salteado · Brócoli bimi', salsas: 'Tankatsu · Mantequilla de robata · Limón negro', cross: ['Copa Malbec','Sake Momokawa Diamond'], chef: 'Plato estrella — recomendar siempre' },
  'Yakitori':                { desc: 'Brochetas de pollo a la robata · Salsa teriyaki · Cebollines · Sésamo tostado', salsas: 'Teriyaki artesanal · Sésamo · Shichimi', cross: ['Arroz Ginza Beef','Heineken'], chef: 'Ideal para compartir — pedir doble porción' },
  'Arroz Ginza Beef':        { desc: 'Entraña Angus premium · Salsa de anguila y tamarindo · Trufa · Huevo pochado', salsas: 'Anguila · Tamarindo · Aceite de trufa', cross: ['Copa Malbec','Old Fashion'], chef: 'Mayor ticket — excelente para mesas de alto consumo' },
  'Kyoto Degustación':       { desc: 'Versión mini de todos los postres del chef · 5 elaboraciones en un solo plato', salsas: 'Variadas según temporada · Helado artesanal', cross: ['Espresso','Sake Momokawa Diamond'], chef: 'El postre de mayor ticket — cerrar siempre con este' },
  'Cheesecake Wagashi':      { desc: 'Torta de queso japonesa · Textura suflé · Helado de temporada · Coulis de frutos', salsas: 'Coulis de mora · Frambuesa · Miel de lavanda', cross: ['Espresso','Copa Rosé'], chef: 'Favorito de los clientes recurrentes' },
};

const clienteData: Record<number, any> = {
  1: {
    nombre: 'Sr. López', nombreCompleto: 'Andrés López',
    desc: 'Regular · Amante del Malbec', avatar: 'AL',
    ocasion: null,
    reserva: { origen: 'Reserve', hora: '8:00 PM', pax: 3, nota: 'Mesa preferida zona sur' },
    visitas: 7, ultimaVisita: 'Hace 12 días',
    tags: ['Sin mariscos', 'Prefiere vinos secos', 'No muy demandante ✓'],
    suggest: 'Ofrece un vino blanco mineral', alert: '',
    recs: [{ icon: '🐟', txt: 'Recomiéndale el Ceviche de Camarón como entrada ligera' }, { icon: '🍷', txt: 'Sugiérale un Malbec como vino premium' }, { icon: '🍫', txt: 'Promueva el "Volcán de Chocolate" para el postre' }]
  },
  2: {
    nombre: 'Sra. García', nombreCompleto: 'Patricia García',
    desc: 'VIP · Cliente frecuente', avatar: 'PG',
    ocasion: null,
    reserva: { origen: 'Reserve', hora: '7:30 PM', pax: 2, nota: 'Alérgica a frutos secos — avisar cocina' },
    visitas: 14, ultimaVisita: 'Hace 5 días',
    tags: ['Alérgica a nuez 🚨', 'Prefiere mesa tranquila', 'Le encanta el Rosé'],
    suggest: 'Evita nueces en todo su pedido', alert: 'Alergia a nuez — informar a cocina',
    recs: [{ icon: '🥗', txt: 'Recomienda la ensalada sin aderezo de nueces' }, { icon: '🍾', txt: 'Tiene su botella de Rosé favorita guardada' }, { icon: '🍰', txt: 'El cheesecake es su postre preferido' }]
  },
  3: {
    nombre: 'Cumpleaños', nombreCompleto: 'Carlos Mendoza',
    desc: 'Celebración especial · 6 personas', avatar: '🎂',
    ocasion: 'cumpleanos',
    reserva: { origen: 'Reserve', hora: '8:30 PM', pax: 6, nota: 'Sorpresa — no mencionar delante del homenajeado' },
    visitas: 1, ultimaVisita: 'Primera visita',
    tags: ['Grupo grande', 'Ocasión especial 🎂', 'Coordinar con cocina'],
    suggest: 'Preparar postre sorpresa con vela', alert: '',
    recs: [{ icon: '🎂', txt: 'Coordinar con cocina el postre especial de cumpleaños' }, { icon: '🥂', txt: 'Sugerir botella de champaña para el brindis' }, { icon: '📸', txt: 'Ofrecer foto del grupo como recuerdo' }]
  },
  4: {
    nombre: 'Sr. Martínez', nombreCompleto: 'Roberto Martínez',
    desc: 'Aniversario empresa · Clientes VIP', avatar: 'RM',
    ocasion: 'aniversario',
    reserva: { origen: 'Reserve', hora: '9:00 PM', pax: 4, nota: 'Aniversario corporativo — máxima atención' },
    visitas: 2, ultimaVisita: 'Hace 45 días',
    tags: ['Reunión de negocios', 'Aniversario empresa 🏆', 'Atención especial'],
    suggest: 'Menú degustación para impresionar', alert: '⚠️ Clientes corporativos — servicio impecable',
    recs: [{ icon: '🥃', txt: 'Recomendar whisky premium como aperitivo' }, { icon: '🍽️', txt: 'Sugerir menú degustación del chef' }, { icon: '🏆', txt: 'Ofrecer tabla de quesos como cierre' }]
  },
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

const ritualStepsAll = ['Agua','Coctel','Compartir','Robata/Wok','Postre','Recomendar','Pousse-café','Café/Té','Vino','Licor'];
const mesaRitualState: Record<number, string[]> = { 1: ['Agua'], 2: ['Agua', 'Aperitivo'], 3: ['Agua'], 4: [] };

// Mapeo categoría de producto → paso del ritual
const CAT_TO_RITUAL: Record<string, string> = {
  'Agua': 'Agua',
  'Coctel': 'Coctel',
  'Cocteles': 'Coctel',
  'Compartir': 'Compartir',
  'Robata': 'Robata/Wok',
  'Wok': 'Robata/Wok',
  'Robata/Wok': 'Robata/Wok',
  'Postres': 'Postre',
  'Postre': 'Postre',
  'Café': 'Café/Té',
  'Café/Té': 'Café/Té',
  'Vino': 'Vino',
  'Licor': 'Licor',
  'Sakes': 'Licor',
  'Cervezas': 'Licor',
};

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

// ── Componente independiente para la ruleta ───────────────
const PREMIOS_RULETA = [
  { emoji:'☕', label:'Café gratis',   color:'#cd853f', bg:'#3d2a1a', desc:'Un espresso en tu próxima visita' },
  { emoji:'🍷', label:'Copa de vino',  color:'#e91e8c', bg:'#3d0d25', desc:'Una copa de la casa' },
  { emoji:'💸', label:'10% OFF',       color:'#d4943a', bg:'#3d2a00', desc:'En tu próxima cuenta' },
  { emoji:'🍮', label:'Postre gratis', color:'#f0b45a', bg:'#3d2d00', desc:'El postre del chef' },
  { emoji:'🥂', label:'2x1 Coctel',    color:'#9b72ff', bg:'#1e1040', desc:'Dos por el precio de uno' },
  { emoji:'🎁', label:'20% OFF',       color:'#3dba6f', bg:'#0d3020', desc:'Descuento especial Seratta' },
];

const RuletaPremios: React.FC<{ onClose: () => void; mesaNum: number; rating: number }> = ({ onClose, mesaNum, rating }) => {
  const [spinning, setSpinning] = useState(false);
  const [selected, setSelected] = useState<number|null>(null);
  const [rotation, setRotation] = useState(0);
  const [particles, setParticles] = useState<{x:number;y:number;c:string;id:number;angle:number;dist:number}[]>([]);
  const [glowPulse, setGlowPulse] = useState(false);
  const pidRef = useRef(0);
  const segAngle = 360 / PREMIOS_RULETA.length;

  const spawnConfetti = () => {
    const colors = ['#FFB547','#FF2D78','#00E676','#448AFF','#B388FF','#FF5252','#FFD700','#fff'];
    const ps = Array.from({length:60},(_,i)=>({
      x:50+(Math.random()-0.5)*20, y:50+(Math.random()-0.5)*20,
      c:colors[i%colors.length], id:pidRef.current++,
      angle:Math.random()*360, dist:80+Math.random()*120,
    }));
    setParticles(ps);
    setTimeout(()=>setParticles([]),2000);
  };

  const girar = () => {
    if (spinning || selected !== null) return;
    setSpinning(true);
    setGlowPulse(true);
    const winner = Math.floor(Math.random() * PREMIOS_RULETA.length);
    const target = 8 * 360 + (360 - winner * segAngle - segAngle/2);
    setRotation(target);
    setTimeout(() => { setSpinning(false); setSelected(winner); setGlowPulse(false); spawnConfetti(); }, 7200);
  };

  const premio = selected !== null ? PREMIOS_RULETA[selected] : null;

  return (
    <div style={{ flex:1, overflowY:'auto', display:'flex', flexDirection:'column', alignItems:'center', padding:'24px 20px 32px', background: premio ? premio.bg : '#080810', transition:'background 1s', position:'relative', overflow:'hidden' }}>
      <style>{`
        @keyframes roulettePulse{0%,100%{box-shadow:0 0 40px #FF2D78,0 0 80px #FF2D7840}50%{box-shadow:0 0 80px #FF2D78,0 0 160px #FF2D7860}}
        @keyframes confettiFloat{0%{transform:translate(0,0) rotate(0deg) scale(1);opacity:1}100%{transform:translate(var(--tx),var(--ty)) rotate(var(--r)) scale(0);opacity:0}}
        @keyframes prizeReveal{0%{transform:scale(0) rotate(-10deg);opacity:0}60%{transform:scale(1.1) rotate(3deg)}100%{transform:scale(1) rotate(0deg);opacity:1}}
        @keyframes starsSpin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}
        @keyframes tickerBounce{0%,100%{transform:translateX(-50%) scaleY(1)}50%{transform:translateX(-50%) scaleY(1.3)}}
      `}</style>

      {/* Partículas confetti */}
      {particles.map(p=>(
        <div key={p.id} style={{
          position:'absolute', left:`${p.x}%`, top:`${p.y}%`,
          width:8, height:8, borderRadius:p.id%3===0?'50%':2,
          background:p.c, pointerEvents:'none', zIndex:20,
          animation:`confettiFloat 2s ease-out forwards`,
          '--tx':`${Math.cos(p.angle*Math.PI/180)*p.dist}px`,
          '--ty':`${Math.sin(p.angle*Math.PI/180)*p.dist}px`,
          '--r':`${p.angle*3}deg`,
        } as any}/>
      ))}

      {/* Header */}
      <div style={{ textAlign:'center', marginBottom:20, zIndex:5 }}>
        <div style={{ fontSize:11, color:'#FF2D78', fontWeight:900, letterSpacing:'.15em', textTransform:'uppercase' as const, marginBottom:8 }}>✦ OMM REWARDS</div>
        <div style={{ fontFamily:"'Syne',sans-serif", fontSize:26, fontWeight:900, color: premio ? premio.color : '#fff', transition:'color .8s', lineHeight:1.2 }}>
          {selected===null?(spinning?'✨ ¡Girando!...':'¡Gira y gana!'): `¡Ganaste!`}
        </div>
        <div style={{ fontSize:13, color:'rgba(255,255,255,.5)', marginTop:4 }}>
          {selected===null?'Premio por tu experiencia en OMM':premio!.desc}
        </div>
      </div>

      {/* Ruleta principal */}
      <div style={{ position:'relative', width:320, height:320, marginBottom:24, flexShrink:0, zIndex:5 }}>
        {/* Anillo exterior giratorio decorativo */}
        <div style={{ position:'absolute', inset:-16, borderRadius:'50%', border:'2px dashed rgba(255,45,120,0.3)', animation: spinning?'starsSpin 3s linear infinite':'none' }}>
          {[0,45,90,135,180,225,270,315].map(a=>(
            <div key={a} style={{ position:'absolute', top:'50%', left:'50%', width:8, height:8, borderRadius:'50%', background:'#FF2D78', transform:`translate(-50%,-50%) rotate(${a}deg) translateY(-${160+16}px)`, boxShadow:'0 0 6px #FF2D78' }}/>
          ))}
        </div>
        {/* Glow ring */}
        <div style={{ position:'absolute', inset:0, borderRadius:'50%', animation: glowPulse?'roulettePulse 0.8s ease-in-out infinite':'none', pointerEvents:'none' }}/>
        {/* Ticker */}
        <div style={{ position:'absolute', top:-20, left:'50%', zIndex:15, fontSize:0, animation:spinning?'tickerBounce 0.15s ease-in-out infinite':'none' }}>
          <svg width="28" height="36" viewBox="0 0 28 36" style={{ transform:'translateX(-50%)', filter:'drop-shadow(0 2px 8px rgba(255,45,120,0.8))' }}>
            <polygon points="14,2 26,34 14,26 2,34" fill="#FF2D78" stroke="#fff" strokeWidth="1.5"/>
          </svg>
        </div>
        {/* Centro */}
        <div style={{ position:'absolute', top:'50%', left:'50%', transform:'translate(-50%,-50%)', width:44, height:44, borderRadius:'50%', background:'linear-gradient(135deg,#FF2D78,#B388FF)', border:'3px solid #fff', zIndex:15, display:'flex', alignItems:'center', justifyContent:'center', fontSize:20, boxShadow:'0 0 20px rgba(255,45,120,0.8)' }}>✦</div>
        {/* SVG Ruleta */}
        <svg viewBox="0 0 320 320" width="320" height="320"
          style={{ transform:`rotate(${rotation}deg)`, transition: spinning?'transform 7s cubic-bezier(0.08,0.82,0.06,1.0)':'none', borderRadius:'50%', boxShadow:'0 12px 60px rgba(0,0,0,.6), inset 0 0 40px rgba(0,0,0,.3)', display:'block' }}>
          {PREMIOS_RULETA.map((p, i) => {
            const sa = i * segAngle - 90, ea = sa + segAngle;
            const r = 160, cx = 160, cy = 160;
            const x1 = cx + r * Math.cos(sa * Math.PI/180), y1 = cy + r * Math.sin(sa * Math.PI/180);
            const x2 = cx + r * Math.cos(ea * Math.PI/180), y2 = cy + r * Math.sin(ea * Math.PI/180);
            const ma = sa + segAngle/2;
            const tx = cx + r*0.58 * Math.cos(ma*Math.PI/180), ty = cy + r*0.58 * Math.sin(ma*Math.PI/180);
            const ex = cx + r*0.78 * Math.cos(ma*Math.PI/180), ey = cy + r*0.78 * Math.sin(ma*Math.PI/180);
            const darkColor = p.color + 'cc';
            return (
              <g key={i}>
                <defs>
                  <linearGradient id={`grad${i}`} x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor={p.color} stopOpacity="1"/>
                    <stop offset="100%" stopColor={darkColor} stopOpacity="1"/>
                  </linearGradient>
                </defs>
                <path d={`M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 0 1 ${x2} ${y2} Z`} fill={`url(#grad${i})`} stroke="rgba(255,255,255,0.15)" strokeWidth="1.5"/>
                <text x={tx} y={ty+4} textAnchor="middle" fontSize="11" fontWeight="900" fill="rgba(255,255,255,0.9)">{p.label}</text>
                <text x={ex} y={ey+8} textAnchor="middle" fontSize="20">{p.emoji}</text>
              </g>
            );
          })}
        </svg>
      </div>

      {/* Premio ganado */}
      {selected !== null && (
        <div style={{ background:`linear-gradient(135deg,${premio!.color}20,${premio!.color}08)`, border:`2px solid ${premio!.color}60`, borderRadius:24, padding:'24px 32px', textAlign:'center', marginBottom:20, animation:'prizeReveal .6s cubic-bezier(.34,1.56,.64,1) forwards', boxShadow:`0 8px 40px ${premio!.color}30`, zIndex:5 }}>
          <div style={{ fontSize:72, marginBottom:8, filter:`drop-shadow(0 0 20px ${premio!.color})` }}>{premio!.emoji}</div>
          <div style={{ fontFamily:"'Syne',sans-serif", fontSize:24, fontWeight:900, color:premio!.color, marginBottom:6 }}>{premio!.label}</div>
          <div style={{ fontSize:14, color:'rgba(255,255,255,.7)', marginBottom:10 }}>{premio!.desc}</div>
          <div style={{ fontSize:11, color:'rgba(255,255,255,.35)', background:'rgba(255,255,255,.05)', borderRadius:8, padding:'6px 12px', marginBottom:10 }}>Muéstrale esta pantalla a tu mesero · Válido 30 días</div>
          {/* Card para mesero */}
          <div style={{background:`linear-gradient(135deg,${premio!.color}30,${premio!.color}10)`,border:`2px dashed ${premio!.color}60`,borderRadius:14,padding:'14px 16px',marginBottom:12,textAlign:'center'}}>
            <div style={{fontSize:10,color:'rgba(255,255,255,.5)',fontWeight:700,textTransform:'uppercase',letterSpacing:'.1em',marginBottom:6}}>📲 Premio para el mesero</div>
            <div style={{fontSize:15,fontWeight:900,color:premio!.color}}>{premio!.emoji} {premio!.label}</div>
            <div style={{fontSize:11,color:'rgba(255,255,255,.6)',marginTop:4}}>{premio!.desc}</div>
          </div>
          {/* Enviar a correo Oh Yeah */}
          {!premioEnviado ? (
            <div style={{background:'rgba(255,255,255,0.04)',border:'1px solid rgba(255,255,255,0.08)',borderRadius:12,padding:'12px 14px',marginBottom:8}}>
              <div style={{fontSize:11,color:'rgba(255,255,255,.5)',marginBottom:8}}>📧 Recibe tu premio en Oh Yeah</div>
              <div style={{display:'flex',gap:8}}>
                <input value={correoEnvio} onChange={e=>setCorreoEnvio(e.target.value)}
                  placeholder="tu@correo.com"
                  style={{flex:1,background:'rgba(255,255,255,0.06)',border:'1px solid rgba(255,255,255,0.12)',borderRadius:9,padding:'9px 12px',color:'#fff',fontSize:12,outline:'none',fontFamily:"'DM Sans',sans-serif"}}/>
                <button onClick={async()=>{
                  if(!correoEnvio.includes('@')){return;}
                  await supabase.from('xcare_encuestas').update({
                    enviado_google:true,
                    respuesta_ia:`PREMIO:${premio!.label}|EMAIL:${correoEnvio}`
                  }).eq('mesa_numero',mesaNum).order('created_at',{ascending:false}).limit(1);
                  setPremioEnviado(true);
                }} style={{padding:'9px 14px',borderRadius:9,border:'none',background:`linear-gradient(135deg,${premio!.color},${premio!.color}cc)`,color:'#fff',fontSize:12,fontWeight:700,cursor:'pointer',whiteSpace:'nowrap'}}>
                  Enviar →
                </button>
              </div>
            </div>
          ):(
            <div style={{background:'rgba(0,230,118,0.1)',border:'1px solid rgba(0,230,118,0.3)',borderRadius:12,padding:'10px 14px',marginBottom:8,textAlign:'center',fontSize:13,color:'#00E676'}}>
              ✓ Premio enviado a {correoEnvio} — revisa tu Oh Yeah
            </div>
          )}
        </div>
      )}

      {/* Botón */}
      {selected===null ? (
        <button onClick={girar} disabled={spinning}
          style={{ padding:'16px 56px', borderRadius:50, background:spinning?'rgba(255,255,255,.1)':`linear-gradient(135deg,#FF2D78,#cc2260)`, color:'#fff', fontSize:18, fontWeight:900, border:'none', cursor:spinning?'not-allowed':'pointer', boxShadow:spinning?'none':'0 6px 30px rgba(255,45,120,0.5)', transition:'all .3s', fontFamily:"'Syne',sans-serif", letterSpacing:'.04em', zIndex:5, position:'relative' }}>
          {spinning ? '✨ ¡Girando!...' : '🎰 ¡GIRAR!'}
        </button>
      ) : (
        <button onClick={onClose}
          style={{ padding:'16px 56px', borderRadius:50, background:`linear-gradient(135deg,${premio!.color},${premio!.color}cc)`, color:'#fff', fontSize:17, fontWeight:900, border:'none', cursor:'pointer', boxShadow:`0 6px 30px ${premio!.color}60`, fontFamily:"'Syne',sans-serif", zIndex:5, position:'relative' }}>
          🎉 ¡Genial! Cerrar
        </button>
      )}
      {selected===null && !spinning && (
        <button onClick={onClose} style={{ background:'none', border:'none', fontSize:12, color:'rgba(255,255,255,.2)', cursor:'pointer', marginTop:14, zIndex:5, position:'relative' }}>
          Omitir ruleta
        </button>
      )}
    </div>
  );
};


const ServiceOSModule: React.FC<POSProps> = ({ tables, onUpdateTable, onOpenVisionAI }) => {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const { profile } = useAuth();
  const isGerencia = ['admin','gerencia','desarrollo'].includes(profile?.role || '');

  // PIN para ajustes gerente
  const [pinModal, setPinModal] = useState(false);
  const [pinInput, setPinInput] = useState('');
  const [pinError, setPinError] = useState('');
  const [pinUnlocked, setPinUnlocked] = useState(false);
  const [pinCallback, setPinCallback] = useState<(() => void) | null>(null);
  const PIN_GERENTE = '1234'; // En producción vendría de Supabase

  const requirePin = (cb: () => void) => {
    if (isGerencia || pinUnlocked) { cb(); return; }
    setPinCallback(() => cb);
    setPinInput('');
    setPinError('');
    setPinModal(true);
  };

  useEffect(() => {
    // Configurar viewport para tablet — evitar zoom accidental en inputs
    let metaViewport = document.querySelector('meta[name="viewport"]') as HTMLMetaElement;
    if (!metaViewport) {
      metaViewport = document.createElement('meta') as HTMLMetaElement;
      metaViewport.name = 'viewport';
      document.head.appendChild(metaViewport);
    }
    const origViewport = metaViewport.content;
    metaViewport.content = 'width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover';

    // Apple PWA meta tags para iPad Safari
    const setMeta = (name: string, content: string) => {
      let el = document.querySelector(`meta[name="${name}"]`) as HTMLMetaElement;
      if (!el) { el = document.createElement('meta') as HTMLMetaElement; el.name = name; document.head.appendChild(el); }
      el.setAttribute('content', content);
    };
    setMeta('apple-mobile-web-app-capable', 'yes');
    setMeta('apple-mobile-web-app-status-bar-style', 'black-translucent');
    setMeta('mobile-web-app-capable', 'yes');

    // Solo modificar el layout en tablet/móvil (ancho < 1024px)
    // En desktop el POS vive dentro del contenedor de Nexum sin tocar el sidebar
    const isTablet = window.innerWidth < 1024;

    const nexumHeader = document.querySelector('header') as HTMLElement;
    const origHeaderDisplay = nexumHeader?.style.display || '';
    // Ocultar header solo en tablet
    if (isTablet && nexumHeader) nexumHeader.style.display = 'none';

    const main = document.querySelector('main') as HTMLElement;
    const mainParent = main?.parentElement as HTMLElement;
    const contentDiv = document.querySelector('[class*="overflow-y-auto"][class*="p-6"]') as HTMLElement;

    const origMainOverflow = main?.style.overflow || '';
    const origParentOverflow = mainParent?.style.overflow || '';
    const origContentPadding = contentDiv?.style.padding || '';
    const origContentOverflow = contentDiv?.style.overflow || '';
    const origContentHeight = contentDiv?.style.height || '';

    // En desktop: solo quitar padding del contenedor para maximizar espacio
    // En tablet: expansión completa
    if (isTablet) {
      if (main) main.style.overflow = 'visible';
      if (mainParent) mainParent.style.overflow = 'visible';
    }
    if (contentDiv) {
      contentDiv.style.padding = '0';
      contentDiv.style.overflow = 'hidden';
      contentDiv.style.height = '100%';
    }

    return () => {
      if (metaViewport) metaViewport.content = origViewport;
      if (isTablet && nexumHeader) nexumHeader.style.display = origHeaderDisplay;
      if (isTablet) {
        if (main) main.style.overflow = origMainOverflow;
        if (mainParent) mainParent.style.overflow = origParentOverflow;
      }
      if (contentDiv) {
        contentDiv.style.padding = origContentPadding;
        contentDiv.style.overflow = origContentOverflow;
        contentDiv.style.height = origContentHeight;
      }
    };
  }, []);

  const [selectedTableId, setSelectedTableId] = useState<number>(1);
  const [currentCat, setCurrentCat] = useState('Compartir');
  const [rightTab, setRightTab] = useState<'IA' | 'Cuenta' | 'Chat' | 'Menú' | 'Intel'>('IA');
  // Ticket del día y cuentas por cobrar
  const [ticketDia, setTicketDia] = useState<{total_ventas:number;total_ordenes:number;total_items:number;mesas_atendidas:number}|null>(null);
  const [cuentasCobrar, setCuentasCobrar] = useState(0);
  // Notificaciones
  const [notifs, setNotifs] = useState<any[]>([]);
  const [notifsBadge, setNotifsBadge] = useState(0);
  const [showNotifPanel, setShowNotifPanel] = useState(false);
  // Stock 86 tips
  const [tipsVenta, setTipsVenta] = useState<any[]>([]);
  // Puntos
  const [puntosCliente, setPuntosCliente] = useState(0);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showOrderPanel, setShowOrderPanel] = useState(false);
  const [mostrarTraspaso, setMostrarTraspaso] = useState(false);
  const [mesaDestino, setMesaDestino] = useState<number | null>(null);
  const [tipoTraspaso, setTipoTraspaso] = useState<'mesa'|'barra'|'barra-a-mesa'>('mesa');
  const [miMenu, setMiMenu] = useState<any[]>([]);
  const [miMenuFormOpen, setMiMenuFormOpen] = useState(false);
  const [miMenuForm, setMiMenuForm] = useState({ nombre:'', precio:'', emoji:'🍽️', categoria:'Compartir', badge:'recomendado', carne: false });
  const [order, setOrder] = useState<OrderItem[]>([]);
  // Pedido pendiente de enviar a cocina (agregar a la orden)
  const [pendingOrder, setPendingOrder] = useState<OrderItem[]>([]);
  const [toast, setToast] = useState('');
  const [modal, setModal] = useState<POSModal>({ open: false, title: '', content: null });
  const [chatMessage, setChatMessage] = useState('');
  const [chatRol, setChatRol] = useState<'Mesero'|'Cocina'|'Host'|'Maître'>('Mesero');

  // ── Flow Store — sincronización con Book Flow ────────────
  const agregarPlatoFlow = (_data: any) => {}; // stub hasta que flowStore esté en el repo
  const flowMensaje = (_data: any) => {};
  const [chatHistory, setChatHistory] = useState([
    { sender: 'Cocina', msg: 'Mesa 4, marchando principales.', time: '19:45' },
    { sender: 'Host', msg: 'Mesa 2 VIP acaba de llegar.', time: '19:30' },
  ]);
  const [posDescuento, setPosDescuento] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [barraColapsada, setBarraColapsada] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [selectedPlato, setSelectedPlato] = useState<any>(null); // plato seleccionado para info IA
  const [stockFlow, setStockFlow] = useState<Record<string, number>>(() => {
    // Stock inicial: 10 unidades por plato
    const s: Record<string, number> = {};
    ['Burosu Shitake','Otosan de Kani x2','Ceviche a la Roca','Tori Surai','Ton Katsu',
     'Camarones Kwaii','Dumplings de Cerdo x2','Gyosas de Res y Hongos x2','Dim Sum de Camarón x2',
     'Bao de Pato Pekin x2','Kanki Ribs x2','Ebi Buda x2','Otate al Fuego x2','Pulpo Ton','Yakitori',
     'Noodles de Camarón al Curry','Arroz Ginza Beef','Kyoto Degustación','Cheesecake Wagashi',
     'Calamares Fritos','Tarta de Queso'].forEach(n => { s[n] = 10; });
    // pedidos NO bloquean — se notifica cuando supera 10 min
    return s;
  });

  useEffect(() => {
    const onChange = () => {
      setIsFullscreen(!!document.fullscreenElement || !!(document as any).webkitFullscreenElement);
    };
    document.addEventListener('fullscreenchange', onChange);
    document.addEventListener('webkitfullscreenchange', onChange);
    return () => {
      document.removeEventListener('fullscreenchange', onChange);
      document.removeEventListener('webkitfullscreenchange', onChange);
    };
  }, []);

  const toggleFullscreen = () => {
    const el = document.documentElement;
    const isFs = !!document.fullscreenElement || !!(document as any).webkitFullscreenElement;
    if (!isFs) {
      if (el.requestFullscreen) {
        el.requestFullscreen({ navigationUI: 'hide' } as any).catch(() => {});
      } else if ((el as any).webkitRequestFullscreen) {
        (el as any).webkitRequestFullscreen();
      }
    } else {
      if (document.exitFullscreen) document.exitFullscreen();
      else if ((document as any).webkitExitFullscreen) (document as any).webkitExitFullscreen();
    }
  };
  const [posCorte, setPosCorte] = useState(0);
  const [posCategDesc, setPosCategDesc] = useState('');
  const [posObsDesc, setPosObsDesc] = useState('');
  const [notasMesero, setNotasMesero] = useState<Record<number, string[]>>({});
  const [ritualState, setRitualState] = useState<Record<number, string[]>>(mesaRitualState);
  const [addedCards, setAddedCards] = useState<Set<string>>(new Set());
  const [pantallaConfirmacion, setPantallaConfirmacion] = useState<{
    activa: boolean; monto: number; metodo: string; facMsg: string; tableId: number;
  }>({ activa: false, monto: 0, metodo: '', facMsg: '', tableId: 0 });

  // ── Modal término de cocción ─────────────────────────────
  const [terminoModal, setTerminoModal] = useState<{ open: boolean; producto: any | null; modo: 'orden' | 'marchar' }>({ open: false, producto: null, modo: 'orden' });

  const abrirTermino = (p: any, modo: 'orden' | 'marchar') => {
    if (p.carne) {
      setTerminoModal({ open: true, producto: p, modo });
    } else {
      if (modo === 'orden') agregarAOrdenDirecto(p);
      else marcharAhoraDirecto(p);
    }
  };

  const displayTables = [
    { id: 1, num: 12, cliente: 'López', pax: 3, time: '00:45', ticket: 65, meta: 120, status: 'activa', vip: false, bday: false, alert: false },
    { id: 2, num: 8, cliente: 'Sra. García', pax: 2, time: '01:10', ticket: 140, meta: 100, status: 'activa', vip: true, bday: false, alert: false },
    { id: 3, num: 5, cliente: 'Cumpleaños', pax: 6, time: '00:50', ticket: 40, meta: 80, status: 'activa', vip: false, bday: true, alert: false },
    { id: 4, num: 4, cliente: 'Martínez', pax: 4, time: '00:55', ticket: 95, meta: 150, status: 'activa', vip: false, bday: false, alert: true },
  ];

  const selectedTable = displayTables.find(t => t.id === selectedTableId) || displayTables[0];
  const c = clienteData[selectedTable.id] || clienteData[1];
  const recs = iaRecsByCat[currentCat] || iaRecsByCat['Compartir'];

  // Cargar datos de inteligencia al montar
  useEffect(() => {
    const loadIntel = async () => {
      // Ticket del día
      const { data: td } = await supabase.from('vista_ticket_dia').select('*').single();
      if (td) setTicketDia(td as any);
      // Cuentas por cobrar (órdenes abiertas)
      const { data: ords } = await supabase.from('orders').select('id').eq('status','open');
      setCuentasCobrar(ords?.length||0);
      // Notificaciones no leídas
      const { data: nf } = await supabase.from('nexum_notificaciones').select('*').eq('leida',false).eq('restaurante_id',6).order('created_at',{ascending:false}).limit(20);
      if (nf) { setNotifs(nf); setNotifsBadge(nf.filter((n:any)=>!n.leida).length); }
      // Tips de venta — platos con stock alto o que hay que mover
      const { data: mi } = await supabase.from('menu_items').select('id,name,emoji,category,precio_venta,stock_actual,alerta_stock,disponible').eq('disponible',true).order('stock_actual',{ascending:false}).limit(6);
      if (mi) setTipsVenta(mi.filter((m:any)=>(m.stock_actual||0)>10||(m.alerta_stock)));
    };
    loadIntel();
    const ch = supabase.channel('intel-live')
      .on('postgres_changes',{event:'*',schema:'public',table:'nexum_notificaciones'},loadIntel)
      .on('postgres_changes',{event:'*',schema:'public',table:'orders'},loadIntel)
      .subscribe();
    return ()=>{ supabase.removeChannel(ch); };
  }, []);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(''), 2500);
  }, []);

  // Auto-marca el paso del ritual según la categoría del producto agregado
  const autoCheckRitual = (categoria: string | undefined) => {
    if (!categoria) return;
    const step = CAT_TO_RITUAL[categoria];
    if (!step) return;
    setRitualState(prev => {
      const current = prev[selectedTable.id] || [];
      if (current.includes(step)) return prev;
      return { ...prev, [selectedTable.id]: [...current, step] };
    });
  };

  const closeModal = () => setModal({ open: false, title: '', content: null });

  const addToOrder = (p: any) => {
    setOrder(prev => [...prev, { ...p, mesa: selectedTable.num }]);
    const key = `${p.nombre}-${Date.now()}`;
    setAddedCards(prev => new Set([...prev, p.nombre]));
    setTimeout(() => setAddedCards(prev => { const n = new Set(prev); n.delete(p.nombre); return n; }), 1200);
    showToast(`✓ ${p.nombre} agregado al pedido`);
    autoCheckRitual(p.categoria ?? currentCat);
  };

  // ── Insertar pedido en Supabase → Flow lo ve en tiempo real ──
  const insertarPedidoFlow = async (nombrePlato: string, categoria: string, mesaNum: number) => {
    try {
      // 1. Buscar orden abierta de esta mesa
      const { data: ordenes } = await supabase
        .from('orders')
        .select('id')
        .eq('table_id', mesaNum)
        .eq('status', 'open')
        .limit(1);

      let orderId: string;

      if (ordenes && ordenes.length > 0) {
        orderId = ordenes[0].id;
      } else {
        // Crear orden nueva si no existe
        const { data: nuevaOrden } = await supabase
          .from('orders')
          .insert({ table_id: mesaNum, status: 'open' })
          .select('id')
          .single();
        if (!nuevaOrden) return;
        orderId = nuevaOrden.id;
      }

      // 2. Buscar menu_item por nombre (si existe)
      const { data: menuItem } = await supabase
        .from('menu_items')
        .select('id')
        .ilike('name', `%${nombrePlato.split('(')[0].trim()}%`)
        .limit(1);

      // 3. Insertar en order_items con notes = nombre completo del plato
      await supabase.from('order_items').insert({
        order_id: orderId,
        menu_item_id: menuItem?.[0]?.id ?? null,
        quantity: 1,
        status: 'pending',
        notes: nombrePlato,
        price_at_time: 0,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });
    } catch (e) {
      console.error('Flow sync error:', e);
    }
  };

  // MARCHAR AHORA — va directo a cocina
  const marcharAhoraDirecto = (p: any, termino?: string) => {
    const productoFinal = termino ? { ...p, nombre: `${p.nombre} (${termino})` } : p;
    const newStock = Math.max(0, (stockFlow[p.nombre] ?? 10) - 1);
    setStockFlow(prev => ({ ...prev, [p.nombre]: newStock }));
    setAddedCards(prev => new Set([...prev, p.nombre + '_marchar']));
    const totalEnCocina = order.length + pendingOrder.length;
    if (totalEnCocina >= 10) {
      showToast(`⏱ ${productoFinal.nombre} → Cocina cargada (+10 pedidos) — posible demora`);
    } else {
      showToast(`🍽️ ${productoFinal.nombre} marchando → Cocina`);
    }
    // ── Sincronizar con Supabase → Flow lo ve en tiempo real ─
    insertarPedidoFlow(productoFinal.nombre, p.categoria ?? currentCat, selectedTable?.num ?? 0);
    // ── Sincronizar con flowStore (Book Flow) ─────────────────
    agregarPlatoFlow({
      mesa: selectedTable?.num ?? 0,
      plato: productoFinal.nombre,
      emoji: p.emoji ?? '🍽️',
      mesero: profile?.nombre_completo?.split(' ')[0] ?? 'Mesero',
      etapa: 'cocina',
      urgente: totalEnCocina >= 10,
      termino: termino,
    });
    autoCheckRitual(p.categoria ?? currentCat);
    setTimeout(() => setAddedCards(prev => { const n = new Set(prev); n.delete(p.nombre + '_marchar'); return n; }), 1500);
    setSelectedPlato(null);
  };

  const marcharAhora = (p: any) => abrirTermino(p, 'marchar');

  // AGREGAR A LA ORDEN
  const agregarAOrdenDirecto = (p: any, termino?: string) => {
    const productoFinal = termino ? { ...p, nombre: `${p.nombre} (${termino})` } : p;
    setPendingOrder(prev => [...prev, { ...productoFinal, mesa: selectedTable.num }]);
    setAddedCards(prev => new Set([...prev, p.nombre]));
    setTimeout(() => setAddedCards(prev => { const n = new Set(prev); n.delete(p.nombre); return n; }), 1200);
    showToast(`+ ${productoFinal.nombre} → orden Mesa ${selectedTable.num}`);
    autoCheckRitual(p.categoria ?? currentCat);
    setSelectedPlato(null);
  };

  const agregarAOrden = (p: any) => abrirTermino(p, 'orden');

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
              // ── Sincronizar cada ítem con Supabase → Flow ────
              pendingOrder
                .filter(o => o.mesa === selectedTable.num)
                .forEach(item => {
                  insertarPedidoFlow(item.nombre, item.categoria ?? currentCat, selectedTable.num);
                  agregarPlatoFlow({
                    mesa: selectedTable.num,
                    plato: item.nombre,
                    emoji: item.emoji ?? '🍽️',
                    mesero: profile?.nombre_completo?.split(' ')[0] ?? 'Mesero',
                    etapa: 'cocina',
                    urgente: false,
                  });
                });
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
    const impoconsumo = Math.round(subtotalNeto * 0.08); // Impoconsumo 8% — restaurantes no responsables IVA
    const propinaMonto = Math.round(subtotalNeto * 0.10);
    const total = subtotalNeto + impoconsumo;
    const totalConPropina = total + propinaMonto;
    const iva = impoconsumo; // alias para compatibilidad

    const procesarPago = (metodo: string, conPropina: boolean) => {
      const montoFinal = conPropina ? totalConPropina : total;
      // Abrir flujo de factura obligatorio antes de cerrar
      abrirFacturaModal(tableId, metodo, montoFinal);
    };

    // ── MODAL FACTURA OBLIGATORIO ──────────────────────────
    const abrirFacturaModal = (tid: number, metodo: string, monto: number) => {
      let tipoFac: 'electronica' | 'generica' | null = null;
      let facNombre = ''; let facId = ''; let facEmail = ''; let facRazon = '';
      let tipoId: 'CC' | 'NIT' | 'CE' = 'CC';
      let confirmado = false;

      const renderFac = (msg?: string) => {
        setModal({
          open: true, title: '',
          content: (
            <div className="font-['DM_Sans']">
              {/* Pantalla de selección tipo */}
              {!tipoFac ? (
                <>
                  <div className="font-['Syne'] text-[17px] font-bold mb-1">🧾 Tipo de factura</div>
                  <div className="text-[11px] text-[#a0a0a0] mb-5">Monto a cobrar: <span className="text-[#f0b45a] font-bold">${formatPrecio(monto)}</span> · {metodo}</div>
                  <div className="flex flex-col gap-3">
                    <button onClick={() => { tipoFac = 'electronica'; renderFac(); }}
                      className="w-full py-4 rounded-xl border border-[#2a2a2a] hover:border-[#4a8fd4] hover:bg-[#4a8fd4]/10 transition-all text-left px-4">
                      <div className="text-[13px] font-bold text-[#4a8fd4]">📱 Factura Electrónica DIAN</div>
                      <div className="text-[11px] text-[#606060] mt-1">Requiere nombre, documento e email del cliente</div>
                    </button>
                    <button onClick={() => { tipoFac = 'generica'; renderFac(); }}
                      className="w-full py-4 rounded-xl border border-[#2a2a2a] hover:border-[#a0a0a0] hover:bg-[#2a2a2a]/50 transition-all text-left px-4">
                      <div className="text-[13px] font-bold text-[#a0a0a0]">🖨️ Factura Impresa / Genérica</div>
                      <div className="text-[11px] text-[#606060] mt-1">Sin datos del cliente · Solo impresión</div>
                    </button>
                  </div>
                </>
              ) : tipoFac === 'generica' && !confirmado ? (
                <>
                  <div className="font-['Syne'] text-[17px] font-bold mb-1">🖨️ Factura Genérica</div>
                  <div className="text-[11px] text-[#a0a0a0] mb-6">Se imprimirá sin datos del cliente</div>
                  <div className="bg-[#0a0a0a] rounded-xl p-4 mb-6">
                    <div className="flex justify-between text-[12px] text-[#a0a0a0] mb-2"><span>Subtotal</span><span>${formatPrecio(subtotalNeto)}</span></div>
                    <div className="flex justify-between text-[12px] text-[#a0a0a0] mb-2"><span>Impoconsumo (8%)</span><span>${formatPrecio(impoconsumo)}</span></div>
                    <div className="flex justify-between text-[14px] font-bold border-t border-[#2a2a2a] pt-2 mt-2">
                      <span>Total</span><span className="text-[#f0b45a]">${formatPrecio(monto)}</span>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => { tipoFac = null; renderFac(); }} className="flex-1 py-2.5 rounded-xl border border-[#2a2a2a] text-[#606060] text-[11px]">← Volver</button>
                    <button onClick={() => {
                      confirmado = true;
                      abrirPantallaConfirmacion(tid, monto, '🖨️ Factura genérica impresa');
                    }} className="flex-[2] py-2.5 rounded-xl bg-[#a0a0a0] text-black text-[12px] font-bold hover:bg-white transition-all">
                      🖨️ Imprimir y cerrar
                    </button>
                  </div>
                </>
              ) : tipoFac === 'electronica' ? (
                <>
                  <div className="font-['Syne'] text-[17px] font-bold mb-1">📱 Factura Electrónica</div>
                  <div className="text-[11px] text-[#a0a0a0] mb-4">Datos obligatorios para la DIAN</div>
                  {msg && <div className={`text-[11px] font-bold mb-3 text-center ${msg.startsWith('✓')?'text-[#3dba6f]':'text-[#e05050]'}`}>{msg}</div>}

                  {/* Tipo de ID */}
                  <div className="flex gap-2 mb-3">
                    {(['CC','NIT','CE'] as const).map(t => (
                      <button key={t} onClick={() => { tipoId = t; renderFac(); }}
                        style={{ borderColor: tipoId===t?'#4a8fd4':'#2a2a2a', background: tipoId===t?'#4a8fd418':'transparent', color: tipoId===t?'#4a8fd4':'#606060' }}
                        className="flex-1 py-2 rounded-lg border text-[11px] font-bold transition-all">{t}</button>
                    ))}
                  </div>

                  <input autoFocus defaultValue={facNombre} onChange={e=>{facNombre=e.target.value;}}
                    placeholder="Nombre completo / Razón social *"
                    className="w-full bg-[#141414] border border-[#2a2a2a] focus:border-[#4a8fd4] rounded-lg px-3 py-2.5 text-[12px] text-[#f0f0f0] outline-none mb-2" />
                  <input defaultValue={facId} onChange={e=>{facId=e.target.value;}}
                    placeholder={`${tipoId} *`}
                    className="w-full bg-[#141414] border border-[#2a2a2a] focus:border-[#4a8fd4] rounded-lg px-3 py-2.5 text-[12px] text-[#f0f0f0] outline-none mb-2" />
                  <input defaultValue={facEmail} onChange={e=>{facEmail=e.target.value;}} type="email"
                    placeholder="Correo electrónico *"
                    className="w-full bg-[#141414] border border-[#2a2a2a] focus:border-[#4a8fd4] rounded-lg px-3 py-2.5 text-[12px] text-[#f0f0f0] outline-none mb-2" />
                  {tipoId === 'NIT' && (
                    <input defaultValue={facRazon} onChange={e=>{facRazon=e.target.value;}}
                      placeholder="Razón social *"
                      className="w-full bg-[#141414] border border-[#2a2a2a] focus:border-[#4a8fd4] rounded-lg px-3 py-2.5 text-[12px] text-[#f0f0f0] outline-none mb-2" />
                  )}

                  <div className="bg-[#0a0a0a] rounded-xl p-3 my-3">
                    <div className="flex justify-between text-[11px] text-[#a0a0a0] mb-1"><span>Subtotal</span><span>${formatPrecio(subtotalNeto)}</span></div>
                    <div className="flex justify-between text-[11px] text-[#a0a0a0] mb-1"><span>Impoconsumo (8%)</span><span>${formatPrecio(impoconsumo)}</span></div>
                    <div className="flex justify-between text-[13px] font-bold border-t border-[#2a2a2a] pt-2 mt-1">
                      <span>Total</span><span className="text-[#f0b45a]">${formatPrecio(monto)}</span>
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <button onClick={() => { tipoFac = null; renderFac(); }} className="flex-1 py-2.5 rounded-xl border border-[#2a2a2a] text-[#606060] text-[11px]">← Volver</button>
                    <button onClick={() => {
                      if (!facNombre.trim()) { renderFac('✗ El nombre es obligatorio'); return; }
                      if (!facId.trim()) { renderFac('✗ El documento es obligatorio'); return; }
                      if (!facEmail.trim() || !facEmail.includes('@')) { renderFac('✗ Email inválido'); return; }
                      abrirPantallaConfirmacion(tid, monto, `📱 Factura electrónica → ${facEmail}`);
                    }} style={{ background: '#4a8fd4' }}
                      className="flex-[2] py-2.5 rounded-xl text-white text-[12px] font-bold hover:opacity-90 transition-all">
                      📤 Emitir factura DIAN
                    </button>
                  </div>
                </>
              ) : null}
            </div>
          ),
        });
      };
      renderFac();
    };

    // ── PANTALLA NEGRA DE CONFIRMACIÓN ─────────────────────
    const abrirPantallaConfirmacion = (tid: number, monto: number, facMsg: string) => {
      setModal({ open: false, title: '', content: null });
      // Notificar al mesero responsable de la mesa
      const mesa = displayTables.find(x => x.id === tid);
      if (mesa) {
        showToast(`🔔 Mesa ${mesa.num} cerrada — notificando a ${mesa.mesero || 'mesero'}`);
      }
      setPantallaConfirmacion({ activa: true, monto, metodo, facMsg, tableId: tid });
    };

    // ── BONO / TARJETA REGALO ──
    const abrirBonoRegalo = (tid: number, totalBase: number) => {
      let tipoBono: 'tarjeta' | 'bono' | null = null;
      let codigoBono = '';
      let porcentajeBono = 0;
      const TARJETAS_VALIDAS: Record<string, number> = { 'SERATTA50': 50000, 'OMM100': 100000, 'VIP200': 200000 };
      const BONOS_VALIDOS: Record<string, number> = { 'BONO10': 10, 'BONO20': 20, 'BONO30': 30 };

      const render = (msg?: string) => {
        setModal({
          open: true, title: '',
          content: (
            <div className="font-['DM_Sans']">
              <div className="font-['Syne'] text-[17px] font-bold mb-1">🎁 Bono & Tarjeta Regalo</div>
              <div className="text-[11px] text-[#606060] mb-4">Ingresa el código que tiene el cliente</div>

              {/* Selector tipo */}
              <div className="flex gap-2 mb-4">
                {(['tarjeta', 'bono'] as const).map(t => (
                  <button key={t} onClick={() => { tipoBono = t; render(); }}
                    style={tipoBono === t ? { borderColor: '#9b72ff', background: '#9b72ff18', color: '#9b72ff' } : { borderColor: '#2a2a2a', color: '#606060' }}
                    className="flex-1 py-2.5 rounded-xl border text-[11px] font-bold transition-all">
                    {t === 'tarjeta' ? '💳 Tarjeta Regalo' : '🎟 Bono Descuento'}
                  </button>
                ))}
              </div>

              {tipoBono && (
                <>
                  <div className="text-[10px] text-[#606060] mb-1.5">
                    {tipoBono === 'tarjeta' ? 'Código de tarjeta regalo (ej: SERATTA50)' : 'Código de bono (ej: BONO20)'}
                  </div>
                  <input
                    autoFocus
                    defaultValue={codigoBono}
                    onChange={e => { codigoBono = e.target.value.toUpperCase().trim(); }}
                    placeholder={tipoBono === 'tarjeta' ? 'SERATTA50' : 'BONO20'}
                    className="w-full bg-[#0a0a0a] border border-[#2a2a2a] focus:border-[#9b72ff] rounded-xl px-3 py-2.5 text-[14px] font-bold text-[#f0f0f0] outline-none text-center tracking-widest mb-3"
                  />

                  {msg && (
                    <div className={`text-[11px] font-bold mb-3 text-center ${msg.startsWith('✓') ? 'text-[#3dba6f]' : 'text-[#e05050]'}`}>{msg}</div>
                  )}

                  <button onClick={() => {
                    if (tipoBono === 'tarjeta') {
                      const valor = TARJETAS_VALIDAS[codigoBono];
                      if (!valor) { render('✗ Código no válido'); return; }
                      const restante = Math.max(0, totalBase - valor);
                      if (restante === 0) {
                        closeModal();
                        showToast(`✓ Tarjeta ${codigoBono} — cubre todo — $${formatPrecio(totalBase)}`);
                        setTimeout(() => abrirEncuesta(tid), 400);
                      } else {
                        render(`✓ Tarjeta ${codigoBono} — quedan $${formatPrecio(restante)} por cobrar`);
                        setTimeout(() => { closeModal(); abrirPOS(tid); }, 1800);
                      }
                    } else {
                      const pct = BONOS_VALIDOS[codigoBono];
                      if (!pct) { render('✗ Código de bono no válido'); return; }
                      setPosDescuento(pct);
                      closeModal();
                      showToast(`✓ Bono ${codigoBono} aplicado — ${pct}% descuento`);
                      setTimeout(() => abrirPOS(tid), 300);
                    }
                  }}
                    className="w-full py-3 rounded-xl font-bold text-[13px] transition-all"
                    style={{ background: '#9b72ff', color: '#fff' }}>
                    Validar código
                  </button>
                </>
              )}

              <button onClick={() => abrirPOS(tid)} className="w-full mt-2 py-2.5 rounded-xl border border-[#2a2a2a] text-[#606060] text-[11px] font-semibold hover:border-[#a0a0a0] transition-all">
                ← Volver a cuenta
              </button>
            </div>
          ),
        });
      };
      render();
    };

    setModal({
      open: true, title: '',
      content: (
        <div className="font-['DM_Sans']">
          {/* Header */}
          <div className="flex items-center justify-between mb-3">
            <div>
              <div className="font-['Syne'] text-[17px] font-bold">🧾 Cuenta — Mesa {m.num}</div>
              <div className="text-[11px] text-[#a0a0a0] mt-0.5">{m.cliente} · {m.pax} personas · {m.time}</div>
            </div>
          </div>

          {/* Items */}
          <div className="bg-[#0a0a0a] rounded-[10px] overflow-hidden mb-3 max-h-[150px] overflow-y-auto">
            {m.ticket > 0 && (
              <div className="px-3 py-2 border-b border-[#2a2a2a] flex justify-between items-center">
                <span className="text-[12px]">📊 Consumo de mesa</span>
                <span className="text-[12px] text-[#d4943a] font-semibold">${formatPrecio(m.ticket)}</span>
              </div>
            )}
            {items.map((o, i) => (
              <div key={i} className="px-3 py-2 border-b border-[#2a2a2a] flex justify-between items-center gap-2">
                <span className="text-[12px] flex-1">{o.emoji} {o.nombre}</span>
                <span className="text-[12px] text-[#d4943a] font-semibold">{o.precio}</span>
                <button onClick={() => { removeOrder(order.indexOf(o)); abrirPOS(tableId); }} className="text-[#e05050] text-[12px]">✕</button>
              </div>
            ))}
          </div>

          {/* ── AJUSTES GERENTE — PIN para cajeros ── */}
          <div className="bg-[#0a0a0a] rounded-[10px] p-3 mb-3">
            <div className="flex items-center justify-between mb-2.5">
              <div className="text-[10px] text-[#d4943a] font-bold uppercase tracking-wider flex items-center gap-1.5">
                🔐 Ajustes Gerente
              </div>
              {!isGerencia && !pinUnlocked ? (
                <button onClick={() => requirePin(() => { abrirPOS(tableId); })}
                  className="flex items-center gap-1 px-2 py-1 rounded-lg bg-[#d4943a]/10 border border-[#d4943a]/30 text-[#d4943a] text-[9px] font-bold hover:bg-[#d4943a]/20 transition-all">
                  <Lock size={9}/> Desbloquear
                </button>
              ) : (
                <span className="text-[9px] text-[#3dba6f] font-bold">✓ Autorizado</span>
              )}
            </div>

            {(isGerencia || pinUnlocked) ? (
              <>
                {/* Categoría de descuento — obligatoria */}
                <div className="mb-2.5">
                  <div className="text-[10px] text-[#606060] mb-1.5">Categoría de descuento</div>
                  <div className="flex flex-col gap-1 mb-2">
                    {[
                      { id: 'prensa',    label: '📰 Prensa / Influencer',         color: '#9b72ff' },
                      { id: 'reivind',   label: '🙏 Reivindicación',              color: '#e05050' },
                      { id: 'fideliz',   label: '⭐ Fidelización',                color: '#f0b45a' },
                      { id: 'interno',   label: '🏠 Consumo interno',             color: '#4a8fd4' },
                      { id: 'empleado',  label: '👤 Descuento empleado',          color: '#3dba6f' },
                      { id: 'socio',     label: '🤝 Descuento socio',             color: '#d4943a' },
                    ].map(cat => (
                      <button key={cat.id}
                        onClick={() => { setPosCategDesc(posCategDesc === cat.id ? '' : cat.id); }}
                        style={posCategDesc === cat.id ? { borderColor: cat.color, background: cat.color + '18', color: cat.color } : {}}
                        className={`w-full px-3 py-2 rounded-lg border text-[10px] font-bold text-left transition-all ${posCategDesc === cat.id ? 'border-current' : 'border-[#2a2a2a] text-[#606060] hover:border-[#606060]'}`}>
                        {cat.label}
                      </button>
                    ))}
                  </div>

                  {/* Observación obligatoria */}
                  {posCategDesc && (
                    <div className="mb-2">
                      <div className="text-[10px] text-[#e05050] mb-1 font-bold">⚠ Observación obligatoria</div>
                      <textarea
                        value={posObsDesc}
                        onChange={e => setPosObsDesc(e.target.value)}
                        placeholder="Describe el motivo del descuento..."
                        rows={2}
                        className="w-full bg-[#141414] border border-[#e05050]/40 rounded-lg px-2 py-1.5 text-[11px] text-[#f0f0f0] outline-none focus:border-[#e05050] resize-none"
                      />
                    </div>
                  )}

                  {/* Monto descuento */}
                  {posCategDesc && (
                    <div className="flex flex-wrap gap-1 mb-1.5">
                      {[0, 5, 10, 15, 20, 25, 30, 50, 100].map(p => (
                        <button key={p} onClick={() => { setPosDescuento(p); }}
                          className={`px-2 py-1 rounded-md text-[10px] font-bold border transition-all ${posDescuento === p ? 'border-[#d4943a] bg-[#d4943a]/15 text-[#d4943a]' : 'border-[#2a2a2a] text-[#606060] hover:border-[#606060]'}`}>
                          {p === 0 ? '—' : p === 100 ? '100%' : `${p}%`}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Cortesía monto fijo */}
                <div>
                  <div className="text-[10px] text-[#606060] mb-1.5">Cortesía (monto fijo)</div>
                  <div className="flex flex-wrap gap-1 mb-1.5">
                    {[0, 5000, 15000, 30000, subtotal].map((v, i) => (
                      <button key={i} onClick={() => { setPosCorte(v); abrirPOS(tableId); }}
                        className={`px-2 py-1 rounded-md text-[10px] font-bold border transition-all ${posCorte === v ? 'border-[#3dba6f] bg-[#3dba6f]/15 text-[#3dba6f]' : 'border-[#2a2a2a] text-[#606060] hover:border-[#606060]'}`}>
                        {v === 0 ? '—' : v === subtotal ? '100%' : `$${formatPrecio(v)}`}
                      </button>
                    ))}
                  </div>
                  <div className="flex items-center gap-2">
                    <input type="number" min={0} placeholder="$ libre"
                      className="w-24 bg-[#141414] border border-[#2a2a2a] rounded-md px-2 py-1 text-[11px] text-[#f0f0f0] outline-none focus:border-[#3dba6f]"
                      onBlur={e => { const v = parseInt(e.target.value); if (!isNaN(v) && v >= 0) { setPosCorte(v); abrirPOS(tableId); } }}
                    />
                    <span className="text-[10px] text-[#606060]">= -{formatPrecio(posCorte)}</span>
                  </div>
                </div>
              </>
            ) : (
              <div className="flex items-center justify-center py-4 gap-2 text-[11px] text-[#404040]">
                <Lock size={13}/> Solo gerencia puede aplicar descuentos
              </div>
            )}
          </div>

          {/* Totales */}
          <div className="bg-[#0a0a0a] rounded-[10px] p-3 mb-3 flex flex-col gap-1.5">
            <div className="flex justify-between text-[12px] text-[#a0a0a0]"><span>Subtotal</span><span>${formatPrecio(subtotal)}</span></div>
            {posDescuento > 0 && posCategDesc && (
              <div className="flex justify-between text-[12px] text-[#3dba6f]">
                <span>Dto. {posCategDesc} ({posDescuento}%)</span>
                <span>-${formatPrecio(descuento)}</span>
              </div>
            )}
            {posCorte > 0 && <div className="flex justify-between text-[12px] text-[#3dba6f]"><span>Cortesía</span><span>-${formatPrecio(posCorte)}</span></div>}
            <div className="flex justify-between text-[12px] text-[#a0a0a0]"><span>Impoconsumo (8%)</span><span>${formatPrecio(iva)}</span></div>
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

          {/* Métodos de pago — completos */}
          <div className="text-[10px] text-[#606060] font-bold uppercase tracking-wider mb-2">Método de pago</div>
          <div className="grid grid-cols-2 gap-1.5 mb-2">
            {[
              { icon: '💳', label: 'Datafono',          color: '#4a8fd4', sub: '📟 El mesero trae el terminal' },
              { icon: '💵', label: 'Efectivo',           color: '#3dba6f', sub: '' },
              { icon: '🏦', label: 'Transferencia',      color: '#d4943a', sub: '' },
              { icon: '📱', label: 'QR Occidente',       color: '#3dba6f', sub: '⭐ Recomendado' },
              { icon: '🍎', label: 'Apple Pay',          color: '#f0f0f0', sub: '' },
              { icon: '💰', label: 'Anticipo Evento',    color: '#9b72ff', sub: 'Para eventos y reservas' },
              { icon: '👤', label: 'Cuenta Empleado',    color: '#f0b45a', sub: 'Descuento por nómina' },
            ].map(mp => (
              <div key={mp.label} className="border border-[#2a2a2a] rounded-xl p-2.5 hover:border-[#606060] transition-all">
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="text-[15px]">{mp.icon}</span>
                  <span className="text-[10px] font-semibold text-[#f0f0f0]">{mp.label}</span>
                </div>
                {mp.sub && <div className="text-[9px] text-[#606060] mb-1">{mp.sub}</div>}
                <div className="flex flex-col gap-1 mt-1">
                  <button onClick={() => procesarPago(mp.label, false)}
                    className="w-full py-1 rounded-lg border border-[#2a2a2a] text-[9px] font-semibold text-[#a0a0a0] hover:bg-[#2a2a2a] transition-all">
                    Sin propina — ${formatPrecio(total)}
                  </button>
                  <button onClick={() => procesarPago(mp.label, true)}
                    style={{ background: mp.color + '18', borderColor: mp.color + '50', color: mp.color }}
                    className="w-full py-1 rounded-lg border text-[9px] font-bold transition-all hover:opacity-90">
                    Con propina — ${formatPrecio(totalConPropina)}
                  </button>
                </div>
              </div>
            ))}
            {/* Bono + Tarjeta Regalo */}
            <div className="border border-[#9b72ff]/40 rounded-xl p-2.5">
              <div className="flex items-center gap-2 mb-1.5">
                <span className="text-[15px]">🎁</span>
                <span className="text-[10px] font-semibold text-[#9b72ff]">Bono / Regalo</span>
              </div>
              <button onClick={() => abrirBonoRegalo(tableId, total)}
                style={{ background: '#9b72ff18', borderColor: '#9b72ff50', color: '#9b72ff' }}
                className="w-full py-1.5 rounded-lg border text-[9px] font-bold transition-all hover:opacity-90">
                🎟 Canjear código
              </button>
            </div>
          </div>

          <button onClick={() => abrirDivision(tableId, totalConPropina, m.pax)}
            className="w-full py-2 rounded-xl border border-[#2a2a2a] text-[#a0a0a0] text-[12px] font-semibold hover:border-[#d4943a] hover:text-[#d4943a] transition-all flex items-center justify-center gap-2 mb-3">
            👥 Dividir entre {m.pax} personas — ${formatPrecio(Math.round(totalConPropina / m.pax))} c/u
          </button>

          <button onClick={() => abrirModoCliente(tableId)}
            className="w-full py-3 rounded-xl bg-[#d4943a] text-black font-bold text-[14px] hover:bg-[#f0b45a] active:bg-[#3dba6f] transition-all flex items-center justify-center gap-2">
            📲 Pasar tablet al cliente
          </button>
          <div className="text-[10px] text-[#606060] text-center mt-1">El cliente elige propina, paga y deja reseña</div>
        </div>
      ),
    });
  };

  // ========================
  // MODO CLIENTE — flujo Sunday completo
  // ========================
  const [clienteMode, setClienteMode] = useState(false);
  const [clientePaso, setClientePaso] = useState<'cuenta'|'propina'|'pago'|'encuesta'|'premio'|'bono'|'tarjeta'>('cuenta');
  const [clienteTableId, setClienteTableId] = useState<number>(1);
  const [clientePropina, setClientePropina] = useState<number>(10);
  const [clienteRating, setClienteRating] = useState<number>(0);
  const [clienteRatings, setClienteRatings] = useState({ comida: 0, servicio: 0, ambiente: 0 });
  // X-CARE estados
  const [xcareStep, setXcareStep] = useState<'rating'|'tags'|'platos'|'microtags'|'redes'|'done'>('rating');
  // Edición de cuenta con PIN Maître
  const [editCuenta, setEditCuenta] = useState(false);
  const [pinMaitre, setPinMaitre] = useState('');
  const [pinMaitreError, setPinMaitreError] = useState('');
  const [pinMaitreOk, setPinMaitreOk] = useState(false);
  const [itemsEliminados, setItemsEliminados] = useState<string[]>([]);
  const [motivoEdicion, setMotivoEdicion] = useState('');
  // Factura
  const [facturaCorreo, setFacturaCorreo] = useState('');
  const [facturaTipo, setFacturaTipo] = useState<'digital'|'correo'|'electronica'>('digital');
  // Pago mixto
  const [pagoMixto, setPagoMixto] = useState(false);
  const [pagoEfectivo, setPagoEfectivo] = useState(0);
  const [pagoTarjeta, setPagoTarjeta] = useState(0);
  const [xcareTags, setXcareTags] = useState<string[]>([]);
  const [xcarePlatos, setXcarePlatos] = useState<string[]>([]);
  const [xcareMicro, setXcareMicro] = useState<string[]>([]);
  const [xcareComentario, setXcareComentario] = useState('');

  const abrirModoCliente = (tableId: number) => {
    setClienteTableId(tableId);
    setClientePaso('cuenta');
    setClientePropina(10);
    setClienteRating(0);
    setClienteRatings({ comida: 0, servicio: 0, ambiente: 0 });
    setXcareStep('rating');
    setXcareTags([]); setXcarePlatos([]); setXcareMicro([]); setXcareComentario('');
    setEditCuenta(false); setPinMaitreOk(false); setPinMaitre(''); setItemsEliminados([]);
    setFacturaTipo('digital'); setFacturaCorreo(''); setPagoMixto(false);
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
    type MetodoPago = 'Datafono' | 'Efectivo' | 'Transferencia' | 'Bono' | null;
    let personasState: MetodoPago[] = new Array(pax).fill(null);
    // ── Monto personalizable por persona ─────────────────
    let montosState: number[] = new Array(pax).fill(porPersona);
    const metodos: { icon: string; label: MetodoPago; color: string }[] = [
      { icon: '💳', label: 'Datafono',     color: '#4a8fd4' },
      { icon: '💵', label: 'Efectivo',     color: '#3dba6f' },
      { icon: '🏦', label: 'Transferencia',color: '#d4943a' },
      { icon: '🎁', label: 'Bono',         color: '#9b72ff' },
    ];

    const totalCobrado = () => montosState.reduce((a, b) => a + b, 0);
    const diferencia = () => total - totalCobrado();

    const renderDiv = () => {
      const cobradas = personasState.filter(Boolean).length;
      const diff = diferencia();
      setModal({
        open: true, title: '',
        content: (
          <div>
            <div className="font-['Syne'] text-[17px] font-bold mb-1">👥 Dividir Cuenta</div>
            <div className="text-[12px] text-[#a0a0a0] mb-1">
              Total: <span className="text-[#d4943a] font-bold">${formatPrecio(total)}</span> ÷ {pax} personas
            </div>
            {/* Diferencia restante */}
            <div className={`text-[11px] font-bold mb-3 ${Math.abs(diff) < 100 ? 'text-[#3dba6f]' : diff > 0 ? 'text-[#f0b45a]' : 'text-[#e05050]'}`}>
              {Math.abs(diff) < 100 ? '✓ Montos cuadrados' : diff > 0 ? `Faltan $${formatPrecio(diff)} por asignar` : `Excede $${formatPrecio(Math.abs(diff))}`}
              <span className="text-[#606060] font-normal ml-2">{cobradas}/{pax} cobradas</span>
            </div>
            <div className="flex flex-col gap-2 mb-4 max-h-[320px] overflow-y-auto">
              {Array.from({ length: pax }, (_, i) => {
                const metodo = personasState[i];
                const pagado = metodo !== null;
                return (
                  <div key={i} style={{ background: pagado ? 'rgba(61,186,111,0.06)' : '#1c1c1c', borderColor: pagado ? 'rgba(61,186,111,0.3)' : '#2a2a2a' }}
                    className="rounded-xl border overflow-hidden">
                    <div className="flex justify-between items-center p-3 gap-2">
                      <span className="text-[13px] font-semibold shrink-0">
                        👤 Persona {i + 1}
                        {pagado && <span className="ml-2 text-[10px] text-[#3dba6f] font-bold">{metodo} ✓</span>}
                      </span>
                      {/* Input de monto personalizable */}
                      <div className="flex items-center gap-1 ml-auto">
                        <span className="text-[11px] text-[#606060]">$</span>
                        <input
                          type="number"
                          defaultValue={montosState[i]}
                          disabled={pagado}
                          onChange={e => {
                            montosState[i] = parseInt(e.target.value) || 0;
                            renderDiv();
                          }}
                          className="w-[90px] bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg px-2 py-1 text-[13px] font-bold text-[#f0b45a] text-right outline-none disabled:opacity-50"
                          style={{ border: pagado ? '1px solid #2a2a2a' : '1px solid #d4943a40' }}
                        />
                      </div>
                    </div>
                    {!pagado && (
                      <div className="flex gap-1 px-3 pb-3 flex-wrap">
                        {metodos.map(mp => (
                          <button key={mp.label} onClick={() => {
                            personasState[i] = mp.label;
                            showToast(`✅ Persona ${i+1} — ${mp.label} — $${formatPrecio(montosState[i])}`);
                            renderDiv();
                          }}
                            style={{ borderColor: mp.color+'40', color: mp.color, background: mp.color+'10' }}
                            className="flex items-center gap-1 px-2 py-1 rounded-lg border text-[10px] font-bold transition-all hover:opacity-80">
                            {mp.icon} {mp.label}
                          </button>
                        ))}
                      </div>
                    )}
                    {pagado && (
                      <button onClick={() => { personasState[i] = null; renderDiv(); }}
                        className="w-full text-[10px] text-[#606060] pb-2 hover:text-[#e05050] transition-all">
                        ↩ Cambiar
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
            {/* Botón dividir equitativamente */}
            <button onClick={() => {
              const eq = Math.round(total / pax);
              montosState = new Array(pax).fill(eq);
              // Ajustar último para cuadrar exacto
              montosState[pax-1] = total - eq * (pax-1);
              renderDiv();
            }} className="w-full py-2 mb-2 rounded-xl border border-[#2a2a2a] text-[#606060] text-[11px] font-semibold hover:border-[#a0a0a0] transition-all">
              ⚖️ Dividir equitativamente (${formatPrecio(porPersona)} c/u)
            </button>
            <div className="flex gap-2">
              <button onClick={() => abrirPOS(tableId)} className="flex-1 py-2.5 rounded-xl border border-[#2a2a2a] text-[#a0a0a0] text-[12px] font-semibold hover:border-[#a0a0a0] transition-all">← Volver</button>
              <button onClick={async () => {
                if (cobradas < pax) { showToast(`⚠️ Faltan ${pax - cobradas} persona(s) por cobrar`); return; }
                // Guardar split en Supabase
                try {
                  const { data: ord } = await supabase.from('orders').select('id').eq('table_id', m.num).eq('status','open').limit(1);
                  if (ord?.[0]) {
                    const splits = Array.from({length: pax}, (_,i) => ({
                      order_id: ord[0].id,
                      persona_numero: i+1,
                      monto: montosState[i],
                      metodo_pago: personasState[i] || 'Efectivo',
                      pagado: true,
                      pagado_at: new Date().toISOString(),
                    }));
                    await supabase.from('pagos_split').insert(splits);
                    await supabase.from('orders').update({
                      status: 'closed',
                      total_amount: total,
                      split_count: pax,
                      split_total: total,
                      metodo_pago: `Split ${pax} personas`,
                      closed_at: new Date().toISOString(),
                    }).eq('id', ord[0].id);
                  }
                } catch(e) { console.error(e); }
                closeModal();
                showToast(`✓ Cuenta dividida — ${pax} personas cobradas`);
                setTimeout(() => abrirEncuesta(tableId), 400);
              }} className={`flex-[2] py-2.5 rounded-xl text-[12px] font-bold transition-all ${cobradas === pax ? 'bg-[#d4943a] text-black hover:bg-[#f0b45a]' : 'bg-[#2a2a2a] text-[#606060] cursor-not-allowed'}`}>
                {cobradas === pax ? '✓ Finalizar cobro' : `Cobrar ${cobradas}/${pax}...`}
              </button>
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
  const nombreMesero = (clienteData as any)[mesaCliente?.id]?.nombre?.split(' ')[1] || 'tu mesero';

  // Colores Sunday: fondo beige cálido
  const S = {
    bg: '#F5F0E8',
    bg2: '#EDE8DF',
    text: '#1a1a1a',
    text2: '#6b6560',
    text3: '#9e9890',
    border: '#DDD8CF',
    black: '#111111',
    btnText: '#ffffff',
  };

  const StarRowCliente = ({ label, field }: { label: string; field: 'comida'|'servicio'|'ambiente' }) => (
    <div style={{ borderBottom: `1px solid ${S.border}` }} className="flex items-center justify-between py-4">
      <span style={{ color: S.text, fontSize: 16 }}>{label}</span>
      <div className="flex gap-1.5">
        {[1,2,3,4,5].map(s => (
          <button key={s} onClick={() => setClienteRatings(prev => ({ ...prev, [field]: s }))}
            style={{ fontSize: 28, opacity: clienteRatings[field] >= s ? 1 : 0.25, transition: 'all 0.15s' }}>⭐</button>
        ))}
      </div>
    </div>
  );

  if (clienteMode && mesaCliente) return (
    <>
      {/* Overlay oscuro detrás */}
      <div style={{ position: 'fixed', inset: 0, zIndex: 99998, background: 'rgba(0,0,0,0.75)' }} onClick={() => setClienteMode(false)} />
      {/* Panel cliente — centrado, max 480px, full height */}
      <div style={{
        position: 'fixed',
        top: 0, bottom: 0,
        left: '50%',
        transform: 'translateX(-50%)',
        width: '100%',
        maxWidth: '480px',
        zIndex: 99999,
        background: S.bg,
        fontFamily: "'DM Sans', sans-serif",
        color: S.text,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}>

      {/* Botón cerrar para mesero — discreto arriba derecha */}
      <button onClick={() => setClienteMode(false)}
        style={{ position: 'absolute', top: 16, right: 16, zIndex: 10, background: S.bg2, border: `1px solid ${S.border}`, color: S.text3, borderRadius: '50%', width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16 }}>✕</button>

      {/* Progress bar estilo Sunday — 2 segmentos */}
      {(clientePaso === 'propina' || clientePaso === 'pago') && (
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, display: 'flex', gap: 2, zIndex: 5 }}>
          <div style={{ flex: 1, background: clientePaso === 'pago' ? S.black : S.border, borderRadius: 2, transition: 'all 0.4s' }}></div>
          <div style={{ flex: 1, background: clientePaso === 'pago' ? S.black : S.border, borderRadius: 2, transition: 'all 0.4s' }}></div>
        </div>
      )}
      {(clientePaso === 'propina' || clientePaso === 'pago') && (
        <div style={{ paddingTop: 20, paddingLeft: 20, paddingRight: 20, paddingBottom: 8, display: 'flex', gap: 16, flexShrink: 0 }}>
          <button onClick={() => setClientePaso('propina')}
            style={{ fontSize: 13, color: clientePaso === 'propina' ? S.text : S.text3, display: 'flex', alignItems: 'center', gap: 4, fontWeight: clientePaso === 'propina' ? 600 : 400 }}>
            {clientePaso === 'pago' && <span style={{ color: '#3dba6f' }}>✓</span>} Propina {clientePaso === 'pago' && <span style={{ color: '#3dba6f' }}>✓</span>}
          </button>
          <span style={{ color: S.text3, fontSize: 13 }}>Pagar</span>
        </div>
      )}

      {/* ═══ PASO 1: CUENTA ═══ */}
      {clientePaso === 'cuenta' && (
        <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
          {/* Header con logo */}
          <div style={{ padding: '24px 20px 16px', display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0 }}>
            <div style={{ width: 64, height: 64, borderRadius: '50%', background: '#fff', border: `1px solid ${S.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
              <span style={{ fontWeight: 900, fontSize: 14, letterSpacing: -0.5, color: S.black }}>OMM</span>
            </div>
            <div style={{ fontSize: 13, color: S.text3, marginBottom: 2 }}>Mesa {mesaCliente.num}</div>
            <div style={{ fontSize: 32, fontWeight: 800, color: S.black, marginBottom: 4 }}>Por pagar</div>
            <div style={{ fontSize: 36, fontWeight: 900, color: S.black }}>${formatPrecio(baseCliente)}</div>
          </div>

          {/* Línea separadora */}
          <div style={{ height: 1, background: S.border, margin: '0 20px 8px' }}></div>

          {/* Trazabilidad — mesero y platos servidos */}
          <div style={{ padding: '0 20px 8px', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
            <span style={{ fontSize:11, color:S.text3 }}>Cobrado por: <b style={{color:S.text}}>{profile?.nombre_completo?.split(' ')[0]||'Mesero'}</b></span>
            <span style={{ fontSize:11, color:S.text3 }}>Platos: <b style={{color:S.text}}>{itemsCliente.length + (mesaCliente.ticket>0?1:0)}</b></span>
          </div>

          {/* Editar cuenta — requiere PIN Maître */}
          <div style={{ padding:'0 20px 8px' }}>
            {!editCuenta ? (
              <button onClick={()=>setEditCuenta(true)} style={{ width:'100%', padding:'10px', borderRadius:12, border:'1px dashed rgba(212,148,58,0.4)', background:'rgba(212,148,58,0.06)', color:'#d4943a', fontSize:12, fontWeight:700, cursor:'pointer' }}>
                ✏️ Editar platos · Requiere Maître
              </button>
            ) : !pinMaitreOk ? (
              <div style={{ background:'rgba(212,148,58,0.08)', border:'1px solid rgba(212,148,58,0.3)', borderRadius:14, padding:'14px' }}>
                <div style={{ fontSize:12, color:'#d4943a', fontWeight:700, marginBottom:8 }}>🔐 PIN Maître requerido</div>
                <div style={{ fontSize:11, color:'#888', marginBottom:8 }}>Flujo: Maître → Resuelve → Notifica → Caja revise</div>
                <input type="password" value={pinMaitre} onChange={e=>setPinMaitre(e.target.value)} placeholder="••••" maxLength={4}
                  style={{ width:'100%', padding:'10px', borderRadius:10, border:`1px solid ${pinMaitreError?'#e05050':'rgba(212,148,58,0.4)'}`, background:'#fff', fontSize:18, textAlign:'center', letterSpacing:6, outline:'none', marginBottom:6 }}/>
                {pinMaitreError && <div style={{ fontSize:11, color:'#e05050', marginBottom:6 }}>{pinMaitreError}</div>}
                <div style={{ display:'flex', gap:8 }}>
                  <button onClick={()=>{setEditCuenta(false);setPinMaitre('');setPinMaitreError('');}} style={{ flex:1, padding:'9px', borderRadius:10, border:'1px solid #ddd', background:'#fff', fontSize:12, cursor:'pointer' }}>Cancelar</button>
                  <button onClick={()=>{ if(pinMaitre==='1234'){setPinMaitreOk(true);setPinMaitreError('');}else{setPinMaitreError('PIN incorrecto');} }} style={{ flex:1, padding:'9px', borderRadius:10, border:'none', background:'#d4943a', color:'#fff', fontSize:12, fontWeight:700, cursor:'pointer' }}>Confirmar</button>
                </div>
              </div>
            ) : (
              <div style={{ background:'rgba(61,186,111,0.06)', border:'1px solid rgba(61,186,111,0.3)', borderRadius:14, padding:'12px 14px' }}>
                <div style={{ fontSize:11, color:'#3dba6f', fontWeight:700, marginBottom:8 }}>✓ Maître autorizado — Selecciona platos a eliminar</div>
                <div style={{ display:'flex', flexDirection:'column', gap:6, marginBottom:10 }}>
                  {itemsCliente.filter(i=>!itemsEliminados.includes(i.nombre)).map((item,i)=>(
                    <div key={i} style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'8px 10px', background:'#fff', borderRadius:8, border:'1px solid #eee' }}>
                      <span style={{ fontSize:13 }}>{item.nombre}</span>
                      <button onClick={()=>setItemsEliminados(p=>[...p,item.nombre])} style={{ background:'rgba(224,80,80,0.1)', border:'1px solid rgba(224,80,80,0.3)', color:'#e05050', fontSize:11, fontWeight:700, padding:'3px 10px', borderRadius:6, cursor:'pointer' }}>✕ Eliminar</button>
                    </div>
                  ))}
                  {itemsEliminados.length>0&&(
                    <div style={{ fontSize:11, color:'#e05050' }}>Eliminados: {itemsEliminados.join(', ')} — guardado en facturas pendientes</div>
                  )}
                </div>
                <input value={motivoEdicion} onChange={e=>setMotivoEdicion(e.target.value)} placeholder="Motivo de la edición..." style={{ width:'100%', padding:'8px 12px', borderRadius:8, border:'1px solid #ddd', fontSize:12, outline:'none', marginBottom:8 }}/>
                <button onClick={async()=>{
                  if(itemsEliminados.length&&motivoEdicion){
                    await supabase.from('cuenta_ediciones').insert({
                      restaurante_id:6, mesa_numero:mesaCliente.num, tipo:'eliminar_plato',
                      plato_nombre:itemsEliminados.join(', '), motivo:motivoEdicion,
                      autorizado_por:'Maître', mesero:profile?.nombre_completo||'Mesero', estado:'aprobado', notificado_caja:true,
                    });
                    showToast('✓ Editado — Guardado en facturas pendientes · Caja notificada');
                    setEditCuenta(false); setPinMaitreOk(false); setPinMaitre('');
                  }
                }} style={{ width:'100%', padding:'9px', borderRadius:10, border:'none', background:'#3dba6f', color:'#fff', fontSize:12, fontWeight:700, cursor:'pointer' }}>✓ Confirmar edición → Notificar Caja</button>
              </div>
            )}
          </div>

          {/* Items con indicadores estado */}
          <div style={{ padding: '0 20px', flexShrink: 0 }}>
            {mesaCliente.ticket > 0 && (
              <div style={{ display: 'flex', alignItems: 'center', padding: '14px 0', borderBottom: `1px solid ${S.border}` }}>
                <div style={{ width: 28, height: 28, borderRadius: '50%', background: S.bg2, border: `1px solid ${S.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, color: S.text3, flexShrink: 0, marginRight: 12 }}>📊</div>
                <span style={{ flex: 1, fontSize: 16, color: S.text2 }}>Consumo base mesa</span>
                <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                  <span style={{ fontSize:10, color:'#3dba6f', background:'rgba(61,186,111,0.1)', padding:'2px 8px', borderRadius:20, fontWeight:700 }}>✓ Entregado</span>
                  <span style={{ fontSize: 16, fontWeight: 600, color: S.text }}>${formatPrecio(mesaCliente.ticket)}</span>
                </div>
              </div>
            )}
            {itemsCliente.filter(i=>!itemsEliminados.includes(i.nombre)).map((item, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', padding: '14px 0', borderBottom: `1px solid ${S.border}`, opacity: itemsEliminados.includes(item.nombre) ? 0.3 : 1 }}>
                <div style={{ width: 28, height: 28, borderRadius: '50%', background: S.bg2, border: `1px solid ${S.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, flexShrink: 0, marginRight: 12 }}>{item.emoji||'🍽️'}</div>
                <span style={{ flex: 1, fontSize: 15, color: S.text }}>{item.nombre}</span>
                <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                  <span style={{ fontSize:10, padding:'2px 8px', borderRadius:20, fontWeight:700, background:'rgba(61,186,111,0.1)', color:'#3dba6f' }}>✓ Listo</span>
                  <span style={{ fontSize: 15, color: S.text }}>{item.precio}</span>
                </div>
              </div>
            ))}
            {/* IVA */}
            <div style={{ display: 'flex', alignItems: 'center', padding: '14px 0', borderBottom: `1px solid ${S.border}` }}>
              <div style={{ width: 28, height: 28, borderRadius: '50%', background: S.bg2, border: `1px solid ${S.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, color: S.text3, flexShrink: 0, marginRight: 12 }}>%</div>
              <span style={{ flex: 1, fontSize: 16, color: S.text2 }}>Impoconsumo (8%)</span>
              <span style={{ fontSize: 16, color: S.text2 }}>${formatPrecio(ivaCliente)}</span>
            </div>
          </div>

          {/* Factura */}
          <div style={{ padding:'12px 20px' }}>
            <div style={{ fontSize:11, color:S.text3, fontWeight:700, marginBottom:8, textTransform:'uppercase', letterSpacing:'.06em' }}>Factura</div>
            <div style={{ display:'flex', gap:6, marginBottom:10 }}>
              {([
                {id:'digital', l:'Digital', icon:'📱'},
                {id:'correo',  l:'Correo',  icon:'✉️'},
                {id:'electronica', l:'Electrónica', icon:'🏢'},
              ] as const).map(f=>(
                <button key={f.id} onClick={()=>setFacturaTipo(f.id)}
                  style={{ flex:1, padding:'8px 4px', borderRadius:10, border:`1px solid ${facturaTipo===f.id?S.black:'#ddd'}`, background:facturaTipo===f.id?S.black:'#fff', color:facturaTipo===f.id?'#fff':S.text2, fontSize:11, fontWeight:700, cursor:'pointer', textAlign:'center' }}>
                  <div>{f.icon}</div><div style={{marginTop:2}}>{f.l}</div>
                </button>
              ))}
            </div>
            {facturaTipo==='correo'&&(
              <input value={facturaCorreo} onChange={e=>setFacturaCorreo(e.target.value)} placeholder="correo@email.com" style={{ width:'100%', padding:'10px 14px', borderRadius:10, border:'1px solid #ddd', fontSize:13, outline:'none' }}/>
            )}
          </div>

          {/* Términos + botón */}
          <div style={{ padding: '16px 20px 32px', marginTop: 'auto', flexShrink: 0 }}>
            <p style={{ fontSize: 11, color: S.text3, textAlign: 'center', marginBottom: 16, lineHeight: 1.5 }}>
              Al continuar, aceptas nuestros <u>términos de uso</u> y tratamiento de datos.
            </p>
            <button onClick={() => setClientePaso('propina')}
              style={{ width: '100%', padding: '18px', borderRadius: 100, background: S.black, color: '#fff', fontSize: 17, fontWeight: 700, border: 'none', cursor: 'pointer' }}>
              Continuar al pago
            </button>
          </div>
        </div>
      )}

      {/* ═══ PASO 2: PROPINA ═══ */}
      {clientePaso === 'propina' && (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', padding: '32px 24px 32px' }}>
          {/* Título */}
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 28, fontWeight: 800, lineHeight: 1.2, color: S.black, marginBottom: 4 }}>
              ¿Deseas dejar propina<br/>a <span style={{ fontWeight: 900 }}>{nombreMesero}</span>?
            </div>
            <div style={{ fontSize:12, color:S.text3, marginBottom:8 }}>10% propina voluntaria · Colombia</div>
            {/* Badge legal Colombia */}
            <div style={{ display:'inline-flex', alignItems:'center', gap:5, background:'rgba(61,186,111,0.08)', border:'1px solid rgba(61,186,111,0.25)', borderRadius:20, padding:'4px 14px', fontSize:11, color:'#3dba6f', marginBottom:4 }}>
              ✓ 10% sugerido por ley · Ley 1258 Colombia
            </div>
          </div>

          {/* Botones de propina */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 10 }}>
            {[
              { pct: 0,  emoji: '—',  label:'Sin propina' },
              { pct: 10, emoji: '😊', label:'Legal', badge:'✓ Ley' },
              { pct: 20, emoji: '😘', label:'Generoso', popular: true },
              { pct: 30, emoji: '❤️', label:'Increíble' },
            ].map(({ pct, emoji, label, popular, badge }) => (
              <div key={pct} style={{ position: 'relative' }}>
                {popular && <div style={{ position: 'absolute', top:-10, left:'50%', transform:'translateX(-50%)', background:S.black, color:'#fff', fontSize:9, fontWeight:700, padding:'2px 8px', borderRadius:20, whiteSpace:'nowrap', zIndex:1 }}>POPULAR</div>}
                {badge && <div style={{ position: 'absolute', top:-10, left:'50%', transform:'translateX(-50%)', background:'#3dba6f', color:'#fff', fontSize:9, fontWeight:700, padding:'2px 8px', borderRadius:20, whiteSpace:'nowrap', zIndex:1 }}>{badge}</div>}
                <button onClick={() => setClientePropina(pct)}
                  style={{ width:'100%', aspectRatio:'1', borderRadius:20, border:`2px solid ${clientePropina===pct?S.black:S.border}`, background:clientePropina===pct?S.bg2:'#fff', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', cursor:'pointer', transition:'all 0.15s', gap:2 }}>
                  {clientePropina===pct&&<span style={{ fontSize:12, fontWeight:700, color:S.black }}>✓</span>}
                  <span style={{ fontSize:22, fontWeight:900, color:S.black }}>{pct}%</span>
                  <span style={{ fontSize:16 }}>{emoji}</span>
                  <span style={{ fontSize:9, color:S.text3 }}>{label}</span>
                </button>
              </div>
            ))}
          </div>
          {/* Botón modificar propina */}
          <button onClick={()=>{const v=prompt('Ingresa el porcentaje de propina (0-50):'); if(v!==null){const n=parseInt(v); if(!isNaN(n)&&n>=0&&n<=50)setClientePropina(n);}}}
            style={{ width:'100%', padding:'11px', borderRadius:50, border:'2px dashed rgba(212,148,58,0.4)', background:'rgba(212,148,58,0.04)', color:'#d4943a', fontSize:13, fontWeight:700, cursor:'pointer' }}>
            ✏️ Deseo modificar mi propina
          </button>

          {/* Total en vivo */}
          <div style={{ background: '#fff', borderRadius: 16, padding: '16px 20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 15, color: S.text2, marginBottom: 4 }}>
              <span>Importe de la propina:</span>
              <span style={{ fontWeight: 600, color: S.text }}>${formatPrecio(propinaCliente)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 15, color: S.text2 }}>
              <span>Estás pagando:</span>
              <span style={{ fontWeight: 700, color: S.black, fontSize: 17 }}>${formatPrecio(totalCliente)}</span>
            </div>
          </div>

          <button onClick={() => setClientePaso('pago')}
            style={{ width: '100%', padding: '18px', borderRadius: 100, background: S.black, color: '#fff', fontSize: 17, fontWeight: 700, border: 'none', cursor: 'pointer' }}>
            Confirmar
          </button>

          <button onClick={() => setClientePaso('cuenta')}
            style={{ background: 'none', border: 'none', fontSize: 13, color: S.text3, cursor: 'pointer', textDecoration: 'underline', textAlign: 'center' }}>
            Personalizar propina
          </button>
        </div>
      )}

      {/* ═══ PASO 3: MÉTODO DE PAGO ═══ */}
      {clientePaso === 'pago' && (
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px 32px', display: 'flex', flexDirection: 'column', gap: 12 }}>

          {/* Apple Pay */}
          <button onClick={() => setClientePaso('encuesta')}
            style={{ width: '100%', padding: '18px 20px', borderRadius: 16, border: `2px solid ${S.black}`, background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ width: 24, height: 24, borderRadius: '50%', background: S.black, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <span style={{ color: '#fff', fontSize: 12, fontWeight: 900 }}>✓</span>
              </div>
              <span style={{ fontSize: 17, fontWeight: 600, color: S.black }}>Apple Pay</span>
            </div>
            <div style={{ background: S.black, color: '#fff', fontSize: 13, fontWeight: 700, padding: '4px 10px', borderRadius: 6 }}>Pay</div>
          </button>

          {/* Tarjeta */}
          <button onClick={() => setClientePaso('tarjeta')}
            style={{ width: '100%', padding: '18px 20px', borderRadius: 16, border: `1px solid ${S.border}`, background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ width: 24, height: 24, borderRadius: '50%', border: `1.5px solid ${S.border}` }}></div>
              <span style={{ fontSize: 17, fontWeight: 600, color: S.text }}>Tarjeta de crédito</span>
            </div>
            <div style={{ display: 'flex', gap: 4, fontSize: 10, color: S.text3 }}>
              <span style={{ border: `1px solid ${S.border}`, borderRadius: 3, padding: '2px 5px', fontWeight: 700 }}>VISA</span>
              <span style={{ border: `1px solid ${S.border}`, borderRadius: 3, padding: '2px 5px', fontWeight: 700 }}>MC</span>
            </div>
          </button>

          {/* Datafono con mesero */}
          <button onClick={() => setClientePaso('encuesta')}
            style={{ width: '100%', padding: '18px 20px', borderRadius: 16, border: `1px solid ${S.border}`, background: '#fff', display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer' }}>
            <div style={{ width: 24, height: 24, borderRadius: '50%', border: `1.5px solid ${S.border}` }}></div>
            <div>
              <span style={{ fontSize: 17, fontWeight: 600, color: S.text, display: 'block' }}>Datafono</span>
              <span style={{ fontSize: 12, color: S.text3 }}>El mesero trae el terminal</span>
            </div>
            <span style={{ marginLeft: 'auto', fontSize: 18 }}>💳</span>
          </button>

          {/* Efectivo */}
          <button onClick={async()=>{
              await supabase.from('cobros_trazabilidad').insert({ restaurante_id:6, mesa_numero:mesaCliente.num, mesero:profile?.nombre_completo||'Mesero', total:totalCliente, propina:propinaCliente, propina_pct:clientePropina, metodo_pago:'Efectivo', platos_servidos:itemsCliente.length, factura_tipo:facturaTipo, factura_email:facturaCorreo||null });
              setClientePaso('encuesta');
            }} style={{ width: '100%', padding: '18px 20px', borderRadius: 16, border: `1px solid ${S.border}`, background: '#fff', display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer' }}>
            <div style={{ width: 24, height: 24, borderRadius: '50%', border: `1.5px solid ${S.border}` }}></div>
            <span style={{ fontSize: 17, fontWeight: 600, color: S.text }}>Efectivo</span>
            <span style={{ marginLeft: 'auto', fontSize: 13, color: S.text3 }}>con el mesero</span>
          </button>

          {/* Tarjeta regalo / Bono */}
          <button onClick={() => setClientePaso('bono')}
            style={{ width: '100%', padding: '18px 20px', borderRadius: 16, border: `1px solid rgba(155,114,255,.4)`, background: 'rgba(155,114,255,.04)', display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer' }}>
            <div style={{ width: 24, height: 24, borderRadius: '50%', border: `1.5px solid rgba(155,114,255,.4)` }}></div>
            <div>
              <span style={{ fontSize: 17, fontWeight: 600, color: S.text, display: 'block' }}>Tarjeta regalo / Bono</span>
              <span style={{ fontSize: 12, color: '#9b72ff' }}>Canjear código de descuento</span>
            </div>
            <span style={{ marginLeft: 'auto', fontSize: 18 }}>🎁</span>
          </button>

          {/* Pago mixto */}
          {!pagoMixto ? (
            <button onClick={()=>setPagoMixto(true)}
              style={{ width:'100%', padding:'18px 20px', borderRadius:16, border:`1px solid rgba(74,143,212,0.4)`, background:'rgba(74,143,212,0.04)', display:'flex', alignItems:'center', gap:12, cursor:'pointer' }}>
              <div style={{ width:24, height:24, borderRadius:'50%', border:`1.5px solid rgba(74,143,212,0.4)` }}/>
              <div>
                <span style={{ fontSize:17, fontWeight:600, color:S.text, display:'block' }}>Pago mixto</span>
                <span style={{ fontSize:12, color:'#4a8fd4' }}>Parte efectivo + parte tarjeta</span>
              </div>
              <span style={{ marginLeft:'auto', fontSize:18 }}>💳+💵</span>
            </button>
          ) : (
            <div style={{ background:'rgba(74,143,212,0.06)', border:`1px solid rgba(74,143,212,0.3)`, borderRadius:16, padding:'14px 16px' }}>
              <div style={{ fontSize:12, color:'#4a8fd4', fontWeight:700, marginBottom:10 }}>Pago mixto — Total: ${formatPrecio(totalCliente)}</div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginBottom:10 }}>
                <div>
                  <div style={{ fontSize:11, color:S.text3, marginBottom:4 }}>💵 Efectivo</div>
                  <input type="number" value={pagoEfectivo||''} onChange={e=>{const v=parseFloat(e.target.value)||0; setPagoEfectivo(v); setPagoTarjeta(Math.max(0,totalCliente-v));}} style={{ width:'100%', padding:'8px', borderRadius:8, border:'1px solid #ddd', fontSize:14, outline:'none' }} placeholder="$0"/>
                </div>
                <div>
                  <div style={{ fontSize:11, color:S.text3, marginBottom:4 }}>💳 Tarjeta</div>
                  <input type="number" value={pagoTarjeta||''} onChange={e=>{const v=parseFloat(e.target.value)||0; setPagoTarjeta(v); setPagoEfectivo(Math.max(0,totalCliente-v));}} style={{ width:'100%', padding:'8px', borderRadius:8, border:'1px solid #ddd', fontSize:14, outline:'none' }} placeholder="$0"/>
                </div>
              </div>
              <div style={{ fontSize:11, color:pagoEfectivo+pagoTarjeta===totalCliente?'#3dba6f':'#e05050', marginBottom:8 }}>
                {pagoEfectivo+pagoTarjeta===totalCliente?'✓ Montos correctos':`Falta: $${formatPrecio(totalCliente-pagoEfectivo-pagoTarjeta)}`}
              </div>
              <button onClick={()=>{ if(pagoEfectivo+pagoTarjeta===totalCliente) setClientePaso('encuesta'); else showToast('⚠️ Los montos no coinciden'); }}
                style={{ width:'100%', padding:'10px', borderRadius:12, border:'none', background:pagoEfectivo+pagoTarjeta===totalCliente?'#3dba6f':'#ccc', color:'#fff', fontSize:13, fontWeight:700, cursor:'pointer' }}>
                ✓ Confirmar pago mixto
              </button>
            </div>
          )}
          {/* Dividir */}
          <button onClick={() => { abrirDivision(clienteTableId, totalCliente, mesaCliente.pax); setClienteMode(false); }}
            style={{ width: '100%', padding: '18px 20px', borderRadius: 16, border: `1px solid ${S.border}`, background: '#fff', display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer' }}>
            <div style={{ width: 24, height: 24, borderRadius: '50%', border: `1.5px solid ${S.border}` }}></div>
            <span style={{ fontSize: 17, fontWeight: 600, color: S.text }}>Dividir la cuenta</span>
            <span style={{ marginLeft: 'auto', fontSize: 13, color: S.text3 }}>{mesaCliente.pax} personas</span>
          </button>

          {/* Resumen */}
          <div style={{ borderTop: `1px solid ${S.border}`, paddingTop: 16, display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 15, color: S.text2 }}><span>Subtotal (IVA incluido)</span><span>${formatPrecio(baseCliente)}</span></div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 15, color: S.text2 }}><span>Propina ({clientePropina}%)</span><span>${formatPrecio(propinaCliente)}</span></div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 17, fontWeight: 700, color: S.black, paddingTop: 8, borderTop: `1px solid ${S.border}` }}><span>Total</span><span>${formatPrecio(totalCliente)}</span></div>
          </div>

          <p style={{ fontSize: 11, color: S.text3, textAlign: 'center', lineHeight: 1.5 }}>
            Al pagar, aceptas nuestros <u>términos de uso</u> y <u>política de privacidad</u>.
          </p>
        </div>
      )}

      {/* ═══ PASO 3c: BONO / TARJETA REGALO ═══ */}
      {(clientePaso as string) === 'bono' && (
        <div style={{ flex: 1, overflowY: 'auto', padding: '24px 20px 32px', display: 'flex', flexDirection: 'column', gap: 16 }}>
          <button onClick={() => setClientePaso('pago')} style={{ background: 'none', border: 'none', fontSize: 22, color: S.text, cursor: 'pointer', textAlign: 'left' }}>←</button>
          
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 48, marginBottom: 8 }}>🎁</div>
            <div style={{ fontSize: 22, fontWeight: 800, color: S.black, marginBottom: 4 }}>Canjear código</div>
            <div style={{ fontSize: 14, color: S.text3 }}>Ingresa tu tarjeta regalo o código de bono</div>
          </div>

          <div style={{ background: '#fff', border: `2px solid #9b72ff`, borderRadius: 16, padding: '18px 20px' }}>
            <div style={{ fontSize: 13, color: '#9b72ff', fontWeight: 700, marginBottom: 8, textTransform: 'uppercase', letterSpacing: 1 }}>Código</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontSize: 20 }}>🎁</span>
              <span style={{ fontSize: 16, color: S.text3, letterSpacing: 3, fontFamily: 'monospace' }}>OMM-XXXX-XXXX</span>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ fontSize: 12, color: S.text3 }}>Tipos de código aceptados:</div>
            {[
              { icon: '☕', label: 'Café gratis', desc: 'Código de experiencia cliente' },
              { icon: '🍷', label: 'Copa de vino', desc: 'Premio de encuesta anterior' },
              { icon: '🎂', label: 'Descuento 10–20%', desc: 'Bono de fidelización' },
              { icon: '🍮', label: 'Postre gratis', desc: 'Premio ruleta' },
            ].map((b, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', background: '#fff', borderRadius: 10, border: `1px solid ${S.border}` }}>
                <span style={{ fontSize: 20 }}>{b.icon}</span>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 600, color: S.text }}>{b.label}</div>
                  <div style={{ fontSize: 12, color: S.text3 }}>{b.desc}</div>
                </div>
              </div>
            ))}
          </div>

          <div style={{ borderTop: `1px solid ${S.border}`, paddingTop: 16, display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 15, color: S.text2 }}><span>Total</span><span>${formatPrecio(totalCliente)}</span></div>
          </div>

          <button onClick={() => setClientePaso('encuesta')}
            style={{ width: '100%', padding: '18px', borderRadius: 100, background: '#9b72ff', color: '#fff', fontSize: 17, fontWeight: 700, border: 'none', cursor: 'pointer' }}>
            ✓ Aplicar y continuar
          </button>
        </div>
      )}

      {/* ═══ PASO 3b: TARJETA ═══ */}
      {(clientePaso as string) === 'tarjeta' && (
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px 32px', display: 'flex', flexDirection: 'column', gap: 12 }}>
          <button onClick={() => setClientePaso('pago')} style={{ background: 'none', border: 'none', fontSize: 22, color: S.text, cursor: 'pointer', textAlign: 'left', marginBottom: 8 }}>←</button>

          {/* Campo tarjeta */}
          <div style={{ background: '#fff', border: `2px solid ${S.black}`, borderRadius: 16, padding: '18px 20px' }}>
            <div style={{ fontSize: 13, color: S.text3, marginBottom: 8 }}>Número de tarjeta</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontSize: 20 }}>💳</span>
              <span style={{ fontSize: 16, color: S.text3, letterSpacing: 2 }}>0000 0000 0000 0000</span>
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div style={{ background: '#fff', border: `1px solid ${S.border}`, borderRadius: 16, padding: '18px 20px' }}>
              <div style={{ fontSize: 13, color: S.text3, marginBottom: 4 }}>Fecha de caducidad</div>
              <div style={{ fontSize: 16, color: S.text3 }}>mm/yy</div>
            </div>
            <div style={{ background: '#fff', border: `1px solid ${S.border}`, borderRadius: 16, padding: '18px 20px' }}>
              <div style={{ fontSize: 13, color: S.text3, marginBottom: 4 }}>CVC</div>
              <div style={{ fontSize: 16, color: S.text3 }}>•••</div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ width: 18, height: 18, border: `1.5px solid ${S.border}`, borderRadius: 4 }}></div>
            <span style={{ fontSize: 14, color: S.text2 }}>Guardar mi tarjeta</span>
          </div>

          <div style={{ marginTop: 'auto', borderTop: `1px solid ${S.border}`, paddingTop: 16, display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 15, color: S.text2 }}><span>Subtotal (IVA incluido)</span><span>${formatPrecio(baseCliente)}</span></div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 15, color: S.text2 }}><span>Propina</span><span>${formatPrecio(propinaCliente)}</span></div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 17, fontWeight: 700, color: S.black }}><span>Total</span><span>${formatPrecio(totalCliente)}</span></div>
          </div>

          <p style={{ fontSize: 11, color: S.text3, textAlign: 'center', lineHeight: 1.5 }}>
            Al pagar, aceptas nuestros <u>términos de uso</u> y <u>política de privacidad</u>.
          </p>

          <button onClick={() => setClientePaso('encuesta')}
            style={{ width: '100%', padding: '18px', borderRadius: 100, background: S.black, color: '#fff', fontSize: 17, fontWeight: 700, border: 'none', cursor: 'pointer' }}>
            Pagar ${formatPrecio(totalCliente)}
          </button>
        </div>
      )}

      {/* ═══ PASO 4: X-CARE™ ENCUESTA INTELIGENTE ═══ */}
      {clientePaso === 'encuesta' && (() => {
        const XC = {
          bg:'#06060f', bg2:'#0d0d1a', bg3:'#141425',
          pink:'#FF2D78', gold:'#FFB547', green:'#00E676',
          blue:'#448AFF', purple:'#B388FF', red:'#FF5252',
          t1:'#FFFFFF', t2:'#A0A0C0', t3:'#50507A',
        };
        const starColors = ['','#FF5252','#FF7043','#FFB547','#69F0AE','#00E676'];
        const starLabels = ['','Muy mala','Mala','Regular','Muy buena','¡Increíble!'];
        const TAGS5 = [{icon:'🍽️',l:'Comida'},{icon:'🍸',l:'Cócteles'},{icon:'🤵',l:'Servicio'},{icon:'👨‍🍳',l:'Chef'},{icon:'🎶',l:'Ambiente'},{icon:'🕯️',l:'Experiencia'}];
        const TAGS4 = [{icon:'⏱️',l:'Tiempo'},{icon:'🌡️',l:'Temperatura'},{icon:'🍽️',l:'Sabor'},{icon:'🍸',l:'Balance'},{icon:'🤵',l:'Atención'},{icon:'🎶',l:'Ambiente'}];
        const TAGS_NEG = [{icon:'🌡️',l:'Frío'},{icon:'⏱️',l:'Demora'},{icon:'🧂',l:'Sabor'},{icon:'🍸',l:'Muy dulce'},{icon:'🍸',l:'Muy fuerte'},{icon:'🤵',l:'Atención'},{icon:'🎶',l:'Ruido'},{icon:'💬',l:'Otro'}];
        const RESP_IA: Record<number,string> = {
          3:`Hola ${mesaCliente?.cliente?.split(' ')[0]||'amigo'},\n\nGracias por confiar en nosotros hoy. Hemos revisado tu experiencia y ya estamos ajustando los detalles.\n\nTu próxima visita será atendida con especial cuidado.`,
          2:`Hola ${mesaCliente?.cliente?.split(' ')[0]||'amigo'},\n\nTu experiencia es importante. Nuestro equipo ya trabaja para que no vuelva a ocurrir.\n\nSerá un honor recibirte nuevamente.`,
          1:`Hola ${mesaCliente?.cliente?.split(' ')[0]||'amigo'},\n\nLo que nos compartiste merece toda nuestra atención. Ya tomamos acciones concretas.\n\nNos gustaría recibirte para ofrecerte una experiencia completamente distinta.`,
        };
        // Separar platos y bebidas del pedido real
        const CATS_BEBIDA = ['Cocteles','Vinos','Sakes','Cervezas','Aguas','Café/Té'];
        const CATS_COMIDA  = ['Para Compartir','Robata/Wok','Sushi Frío','Ensaladas','Postres','Especiales'];
        const todosItems = order.filter(o=>o.mesa===mesaCliente?.num);
        const platosOrden   = todosItems.filter(o=>!CATS_BEBIDA.some(cb=>o.nombre.toLowerCase().includes(cb.toLowerCase()))).map(o=>o.nombre);
        const bebidasOrden  = todosItems.filter(o=>CATS_BEBIDA.some(cb=>o.nombre.toLowerCase().includes(cb.toLowerCase()))||['Gas','Espresso','Americano','Té','Sake','Heineken','Old','Malbec','Rosé','Blanco','Yin','Infinito','Gin'].some(k=>o.nombre.includes(k))).map(o=>o.nombre);
        const todosItemsNombres = todosItems.map(o=>o.nombre);
        const toggleT = (arr: string[], set: React.Dispatch<React.SetStateAction<string[]>>, v: string) => set(p=>p.includes(v)?p.filter(x=>x!==v):[...p,v]);
        const isPos = clienteRating===5, isMed = clienteRating===4, isNeg = clienteRating<=3&&clienteRating>0;
        const tags = isPos||isMed ? TAGS5 : TAGS4;
        const sc = starColors[clienteRating]||XC.gold;

        const guardarXCare = async () => {
          await supabase.from('xcare_encuestas').insert({
            restaurante_id:6, mesa_numero:mesaCliente?.num, nombre_cliente:mesaCliente?.cliente||null,
            estrellas:clienteRating, tags_positivos:isPos||isMed?xcareTags:null,
            tags_negativos:isNeg?[...xcareTags,...xcareMicro]:null,
            platos_problema:isNeg?xcarePlatos:null,
            comentario:xcareComentario||null,
            nps_score:clienteRating===5?10:clienteRating===4?8:clienteRating===3?6:clienteRating===2?3:1,
            alerta_gerente:clienteRating<=3,
          });
          if (clienteRating<=3) {
            await supabase.from('xcare_alertas').insert({
              restaurante_id:6, mesa_numero:mesaCliente?.num, tipo:'encuesta_negativa',
              descripcion:`${mesaCliente?.cliente||'Cliente'} — ${clienteRating}★ — ${xcareTags.join(', ')||'Sin tags'}`, activa:true,
            });
          }
        };

        return (
          <div style={{flex:1,overflowY:'auto',background:XC.bg,display:'flex',flexDirection:'column',alignItems:'center',padding:'28px 24px 32px',position:'relative',minHeight:'100%'}}>
            <style>{`
              @keyframes xcFadeUp{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:translateY(0)}}
              @keyframes xcBounce{0%{transform:scale(0)}60%{transform:scale(1.2)}100%{transform:scale(1)}}
              @keyframes xcPulse{0%,100%{opacity:1}50%{opacity:.6}}
            `}</style>

            {/* Header X-CARE */}
            <div style={{textAlign:'center',marginBottom:28,animation:'xcFadeUp .4s ease',width:'100%'}}>
              <div style={{display:'flex',alignItems:'center',justifyContent:'center',gap:8,marginBottom:12}}>
                <div style={{width:30,height:30,borderRadius:9,background:`linear-gradient(135deg,${XC.pink},${XC.purple})`,display:'flex',alignItems:'center',justifyContent:'center',fontSize:14,boxShadow:`0 0 14px rgba(255,45,120,0.4)`}}>✦</div>
                <span style={{fontSize:10,fontWeight:900,color:XC.pink,letterSpacing:'.18em',textTransform:'uppercase' as const}}>X-CARE™</span>
              </div>

              {/* PASO RATING */}
              {xcareStep==='rating' && (
                <div>
                  <div style={{fontFamily:"'Syne',sans-serif",fontSize:22,fontWeight:900,color:XC.t1,marginBottom:6,lineHeight:1.2}}>
                    {mesaCliente?.cliente?`¿Cómo estuvo tu experiencia
${mesaCliente.cliente.split(' ')[0]}?`:'¿Cómo se sintió tu experiencia hoy?'}
                  </div>
                  <div style={{fontSize:12,color:XC.t3}}>Tu opinión transforma nuestro servicio</div>
                </div>
              )}

              {/* PASO TAGS */}
              {xcareStep==='tags' && (
                <div>
                  {clienteRating>=4
                    ? <div style={{fontFamily:"'Syne',sans-serif",fontSize:20,fontWeight:900,color:XC.t1,lineHeight:1.3}}>{clienteRating===5?'🔥 Nos encanta saberlo.':'✨ Gracias.'}</div>
                    : <div style={{fontFamily:"'Syne',sans-serif",fontSize:20,fontWeight:900,color:XC.t1,lineHeight:1.3}}>🙏 Queremos hacerlo mejor.</div>
                  }
                  <div style={{fontSize:12,color:XC.t3,marginTop:4}}>
                    {clienteRating===5?'¿Qué fue lo que más destacarías?':clienteRating===4?'¿Qué faltó para que fuera perfecta?':'Ayúdanos a entender qué pasó.'}
                  </div>
                </div>
              )}

              {xcareStep==='platos' && <div style={{fontFamily:"'Syne',sans-serif",fontSize:20,fontWeight:900,color:XC.t1}}>🍽️ ¿Con qué plato tuviste el problema?</div>}
              {xcareStep==='microtags' && <div style={{fontFamily:"'Syne',sans-serif",fontSize:20,fontWeight:900,color:XC.t1}}>¿Qué tipo de problema fue?</div>}
              {xcareStep==='redes' && <div style={{fontFamily:"'Syne',sans-serif",fontSize:22,fontWeight:900,color:XC.t1}}>🌟 Tu experiencia puede inspirar a otros.</div>}
              {xcareStep==='done' && <div style={{fontFamily:"'Syne',sans-serif",fontSize:22,fontWeight:900,color:XC.t1}}>{clienteRating>=4?'¡Hasta pronto!':clienteRating===3?'Gracias por tu honestidad.':'Gracias por contarnos.'}</div>}
            </div>

            {/* RATING — Estrellas */}
            {xcareStep==='rating' && (
              <div style={{width:'100%',textAlign:'center',animation:'xcFadeUp .4s ease'}}>
                <div style={{display:'flex',justifyContent:'center',gap:10,marginBottom:14}}>
                  {[1,2,3,4,5].map(n=>(
                    <button key={n} onClick={()=>setClienteRating(n)}
                      style={{fontSize:clienteRating>=n?56:44,opacity:clienteRating>=n?1:0.2,transition:'all .2s cubic-bezier(.34,1.56,.64,1)',background:'none',border:'none',cursor:'pointer',transform:clienteRating>=n?'scale(1.1)':'scale(0.95)',filter:clienteRating>=n?`drop-shadow(0 0 10px ${starColors[n]})`:'none'}}>⭐</button>
                  ))}
                </div>
                <div style={{height:28,fontSize:15,fontWeight:900,fontFamily:"'Syne',sans-serif",color:clienteRating?starColors[clienteRating]:XC.t3,transition:'all .3s'}}>
                  {clienteRating?starLabels[clienteRating]:'Toca para calificar'}
                </div>
                {clienteRating>0&&(
                  <button onClick={()=>setXcareStep('tags')} style={{marginTop:20,padding:'13px 44px',borderRadius:50,border:'none',background:`linear-gradient(135deg,${XC.pink},#cc2260)`,color:'#fff',fontSize:15,fontWeight:900,cursor:'pointer',fontFamily:"'Syne',sans-serif",boxShadow:`0 6px 24px rgba(255,45,120,0.4)`}}>
                    Continuar →
                  </button>
                )}
              </div>
            )}

            {/* TAGS */}
            {xcareStep==='tags' && (
              <div style={{width:'100%',animation:'xcFadeUp .3s ease'}}>
                <div style={{display:'flex',gap:6,marginBottom:6,justifyContent:'center'}}>
                  {[1,2,3,4,5].map(n=><span key={n} style={{fontSize:16,opacity:n<=clienteRating?1:0.2,filter:n<=clienteRating?`drop-shadow(0 0 4px ${sc})`:'none'}}>⭐</span>)}
                </div>
                <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:8,marginBottom:14}}>
                  {tags.map(t=>{
                    const sel=xcareTags.includes(t.l);
                    return(
                      <button key={t.l} onClick={()=>toggleT(xcareTags,setXcareTags,t.l)}
                        style={{padding:'12px 8px',borderRadius:14,border:`2px solid ${sel?XC.pink:'rgba(255,255,255,0.08)'}`,background:sel?`rgba(255,45,120,0.12)`:'rgba(255,255,255,0.04)',color:sel?XC.pink:XC.t2,cursor:'pointer',textAlign:'center' as const,transition:'all .2s'}}>
                        <div style={{fontSize:26,marginBottom:4}}>{t.icon}</div>
                        <div style={{fontSize:11,fontWeight:700}}>{t.l}</div>
                      </button>
                    );
                  })}
                </div>
                <textarea style={{background:'rgba(255,255,255,0.05)',border:'1px solid rgba(255,255,255,0.1)',borderRadius:12,padding:'10px 14px',color:XC.t1,fontSize:13,outline:'none',width:'100%',minHeight:64,resize:'none' as const,marginBottom:12,fontFamily:"'DM Sans',sans-serif"}}
                  placeholder="Comentario opcional..." value={xcareComentario} onChange={e=>setXcareComentario(e.target.value)} />
                <button onClick={async()=>{
                  if(isNeg&&platosOrden.length>0){ setXcareStep('platos'); return; }
                  await guardarXCare();
                  if(clienteRating===5){setXcareStep('redes');}else{setXcareStep('done');}
                }} disabled={xcareTags.length===0}
                  style={{width:'100%',padding:'13px',borderRadius:14,border:'none',background:xcareTags.length?`linear-gradient(135deg,${XC.pink},#cc2260)`:'rgba(255,255,255,0.05)',color:'#fff',fontSize:14,fontWeight:900,cursor:xcareTags.length?'pointer':'not-allowed',fontFamily:"'Syne',sans-serif"}}>
                  {isNeg&&platosOrden.length>0?'Siguiente →':'Enviar ✓'}
                </button>
                <button onClick={()=>setXcareStep('rating')} style={{background:'none',border:'none',color:XC.t3,cursor:'pointer',fontSize:12,marginTop:8,width:'100%'}}>← Volver</button>
              </div>
            )}

            {/* PLATOS Y BEBIDAS PROBLEMA */}
            {xcareStep==='platos' && (
              <div style={{width:'100%',animation:'xcFadeUp .3s ease'}}>
                {platosOrden.length>0&&(
                  <div style={{marginBottom:14}}>
                    <div style={{fontSize:10,color:XC.t3,fontWeight:700,textTransform:'uppercase',letterSpacing:'.1em',marginBottom:8}}>🍽️ Comida</div>
                    <div style={{display:'flex',flexDirection:'column',gap:6}}>
                      {platosOrden.map(item=>{
                        const sel=xcarePlatos.includes(item);
                        return(
                          <button key={item} onClick={()=>toggleT(xcarePlatos,setXcarePlatos,item)}
                            style={{padding:'12px 16px',borderRadius:12,border:`2px solid ${sel?XC.red:'rgba(255,255,255,0.08)'}`,background:sel?'rgba(255,82,82,0.12)':'rgba(255,255,255,0.04)',color:sel?XC.red:XC.t2,cursor:'pointer',textAlign:'left',fontSize:13,fontWeight:sel?700:400,transition:'all .2s',display:'flex',alignItems:'center',gap:8}}>
                            <span style={{fontSize:18}}>🍽️</span>{sel?'✕ ':''}{item}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
                {bebidasOrden.length>0&&(
                  <div style={{marginBottom:14}}>
                    <div style={{fontSize:10,color:XC.t3,fontWeight:700,textTransform:'uppercase',letterSpacing:'.1em',marginBottom:8}}>🍸 Bebidas</div>
                    <div style={{display:'flex',flexDirection:'column',gap:6}}>
                      {bebidasOrden.map(item=>{
                        const sel=xcarePlatos.includes(item);
                        return(
                          <button key={item} onClick={()=>toggleT(xcarePlatos,setXcarePlatos,item)}
                            style={{padding:'12px 16px',borderRadius:12,border:`2px solid ${sel?XC.red:'rgba(255,255,255,0.08)'}`,background:sel?'rgba(255,82,82,0.12)':'rgba(255,255,255,0.04)',color:sel?XC.red:XC.t2,cursor:'pointer',textAlign:'left',fontSize:13,fontWeight:sel?700:400,transition:'all .2s',display:'flex',alignItems:'center',gap:8}}>
                            <span style={{fontSize:18}}>🍸</span>{sel?'✕ ':''}{item}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
                {todosItemsNombres.length===0&&(
                  <div style={{color:XC.t3,fontSize:13,textAlign:'center',padding:'20px 0'}}>No hay items registrados en esta mesa</div>
                )}
                <button onClick={()=>{if(xcarePlatos.length)setXcareStep('microtags');}} disabled={xcarePlatos.length===0}
                  style={{width:'100%',padding:'13px',borderRadius:14,border:'none',background:xcarePlatos.length?`linear-gradient(135deg,${XC.pink},#cc2260)`:'rgba(255,255,255,0.05)',color:'#fff',fontSize:14,fontWeight:900,cursor:xcarePlatos.length?'pointer':'not-allowed',fontFamily:"'Syne',sans-serif"}}>
                  Siguiente →
                </button>
                <button onClick={()=>setXcareStep('tags')} style={{background:'none',border:'none',color:XC.t3,cursor:'pointer',fontSize:12,marginTop:8,width:'100%'}}>← Volver</button>
              </div>
            )}

            {/* MICRO TAGS */}
            {xcareStep==='microtags' && (
              <div style={{width:'100%',animation:'xcFadeUp .3s ease'}}>
                <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8,marginBottom:14}}>
                  {[{icon:'🌡️',l:'Frío'},{icon:'⏱️',l:'Demora'},{icon:'🧂',l:'Sabor'},{icon:'🍸',l:'Muy dulce'},{icon:'🍸',l:'Muy fuerte'},{icon:'🤵',l:'Atención'},{icon:'🎶',l:'Ruido'},{icon:'💬',l:'Otro'}].map(t=>{
                    const sel=xcareMicro.includes(t.l);
                    return(
                      <button key={t.l} onClick={()=>toggleT(xcareMicro,setXcareMicro,t.l)}
                        style={{padding:'12px',borderRadius:12,border:`2px solid ${sel?XC.red:'rgba(255,255,255,0.08)'}`,background:sel?'rgba(255,82,82,0.12)':'rgba(255,255,255,0.04)',color:sel?XC.red:XC.t2,cursor:'pointer',display:'flex',alignItems:'center',gap:8,fontSize:13,fontWeight:sel?700:400,transition:'all .2s'}}>
                        <span style={{fontSize:20}}>{t.icon}</span>{t.l}
                      </button>
                    );
                  })}
                </div>
                <textarea style={{background:'rgba(255,255,255,0.05)',border:'1px solid rgba(255,255,255,0.1)',borderRadius:12,padding:'10px 14px',color:XC.t1,fontSize:13,outline:'none',width:'100%',minHeight:64,resize:'none' as const,marginBottom:12,fontFamily:"'DM Sans',sans-serif"}}
                  placeholder="Cuéntanos un poco más..." value={xcareComentario} onChange={e=>setXcareComentario(e.target.value)} />
                {RESP_IA[clienteRating]&&(
                  <div style={{background:'rgba(179,136,255,0.08)',border:'1px solid rgba(179,136,255,0.2)',borderRadius:12,padding:'12px 14px',marginBottom:12,fontSize:12,color:XC.purple,lineHeight:1.6}}>
                    {RESP_IA[clienteRating].split('\n').map((l,i)=><div key={i}>{l||' '}</div>)}
                  </div>
                )}
                <button onClick={async()=>{ await guardarXCare(); setXcareStep('done'); }}
                  style={{width:'100%',padding:'13px',borderRadius:14,border:'none',background:`linear-gradient(135deg,${XC.pink},#cc2260)`,color:'#fff',fontSize:14,fontWeight:900,cursor:'pointer',fontFamily:"'Syne',sans-serif"}}>
                  Enviar ✓
                </button>
                <button onClick={()=>setXcareStep('platos')} style={{background:'none',border:'none',color:XC.t3,cursor:'pointer',fontSize:12,marginTop:8,width:'100%'}}>← Volver</button>
              </div>
            )}

            {/* REDES (5 estrellas) */}
            {xcareStep==='redes' && (
              <div style={{width:'100%',textAlign:'center',animation:'xcFadeUp .4s ease'}}>
                <div style={{fontSize:13,color:XC.t2,marginBottom:24,lineHeight:1.6}}>Tu opinión ayuda a que más personas vivan momentos memorables en OMM.</div>
                <div style={{display:'flex',flexDirection:'column',gap:10,marginBottom:20}}>
                  <a href="https://g.page/r/review" target="_blank" style={{display:'block',padding:'14px',borderRadius:14,background:'linear-gradient(135deg,#4285F4,#0F9D58)',color:'#fff',fontSize:14,fontWeight:800,textDecoration:'none',fontFamily:"'Syne',sans-serif"}}>⭐ Opinar en Google</a>
                  <a href="https://tripadvisor.com" target="_blank" style={{display:'block',padding:'14px',borderRadius:14,background:'linear-gradient(135deg,#00AA6C,#007A4D)',color:'#fff',fontSize:14,fontWeight:800,textDecoration:'none',fontFamily:"'Syne',sans-serif"}}>🦉 Opinar en TripAdvisor</a>
                </div>
                <button onClick={()=>{ setClientePaso('premio'); }} style={{background:'none',border:'none',color:XC.t3,cursor:'pointer',fontSize:13,textDecoration:'underline'}}>Omitir por ahora →</button>
              </div>
            )}

            {/* DONE */}
            {xcareStep==='done' && (
              <div style={{textAlign:'center',animation:'xcFadeUp .4s ease'}}>
                <div style={{fontSize:72,marginBottom:16,animation:'xcBounce .6s ease',filter:`drop-shadow(0 0 24px ${clienteRating>=4?XC.green:XC.gold})`}}>{clienteRating>=4?'🎉':clienteRating===3?'🙏':'💎'}</div>
                <div style={{fontSize:14,color:XC.t2,lineHeight:1.6,maxWidth:280,margin:'0 auto',marginBottom:28}}>
                  {clienteRating>=4?'Fue un placer tenerte aquí. ¡Hasta pronto!':clienteRating===3?'Ya estamos trabajando en mejorarlo.':'Tu voz genera cambios reales en nuestro equipo.'}
                </div>
                <button onClick={()=>{ setClienteRating(clienteRating); setClientePaso('premio'); }}
                  style={{padding:'13px 44px',borderRadius:50,border:'none',background:`linear-gradient(135deg,${XC.pink},#cc2260)`,color:'#fff',fontSize:15,fontWeight:900,cursor:'pointer',fontFamily:"'Syne',sans-serif",boxShadow:`0 6px 24px rgba(255,45,120,0.4)`}}>
                  🎰 Ver mi premio →
                </button>
              </div>
            )}

            {/* Skip siempre visible */}
            {xcareStep==='rating' && (
              <button onClick={()=>{ setClienteMode(false); setOrder(prev=>prev.filter(o=>o.mesa!==mesaCliente?.num)); showToast(`Mesa ${mesaCliente?.num} cerrada`); }}
                style={{position:'absolute',bottom:16,background:'none',border:'none',fontSize:11,color:'rgba(255,255,255,0.15)',cursor:'pointer'}}>
                Omitir encuesta
              </button>
            )}
          </div>
        );
      })()}

      {/* ═══ PASO 5: RULETA DE PREMIOS ═══ */}
      {clientePaso === 'premio' && (
        <RuletaPremios
          onClose={() => { setClienteMode(false); setOrder(prev => prev.filter(o => o.mesa !== mesaCliente?.num)); showToast('¡Gracias! Mesa cerrada'); }}
          mesaNum={mesaCliente?.num ?? 0}
          rating={clienteRating}
        />
      )}
    </div>
    </>
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

      {/* PANTALLA NEGRA DE CONFIRMACIÓN — al cerrar cuenta */}
      {pantallaConfirmacion.activa && (
        <div className="fixed inset-0 bg-black z-[700] flex flex-col items-center justify-center"
          style={{ fontFamily: "'DM Sans', sans-serif" }}>
          <div className="text-center" style={{ animation: 'fadeIn .4s ease' }}>
            {/* Check animado */}
            <div style={{ width: 80, height: 80, borderRadius: '50%', background: '#3dba6f', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 24px', fontSize: 40 }}>
              ✓
            </div>
            <div style={{ fontFamily: "'Syne', sans-serif", fontSize: 28, fontWeight: 900, color: '#f0f0f0', marginBottom: 8 }}>
              Cuenta cerrada
            </div>
            <div style={{ fontSize: 36, fontWeight: 900, color: '#f0b45a', marginBottom: 8 }}>
              ${typeof pantallaConfirmacion.monto === 'number' ? new Intl.NumberFormat('es-CO').format(pantallaConfirmacion.monto) : pantallaConfirmacion.monto}
            </div>
            <div style={{ fontSize: 14, color: '#a0a0a0', marginBottom: 4 }}>
              {pantallaConfirmacion.metodo}
            </div>
            <div style={{ fontSize: 12, color: '#606060', marginBottom: 48 }}>
              {pantallaConfirmacion.facMsg}
            </div>
            <button
              onClick={() => {
                setPantallaConfirmacion({ activa: false, monto: 0, metodo: '', facMsg: '', tableId: 0 });
                showToast(`🔔 Mesa ${pantallaConfirmacion.tableId} cerrada — ${pantallaConfirmacion.metodo} · ${new Intl.NumberFormat('es-CO',{style:'currency',currency:'COP',maximumFractionDigits:0}).format(pantallaConfirmacion.monto)}`);
                setTimeout(() => abrirEncuesta(pantallaConfirmacion.tableId), 300);
              }}
              style={{ background: '#d4943a', color: '#000', border: 'none', padding: '14px 40px', borderRadius: 12, fontSize: 14, fontWeight: 900, cursor: 'pointer', marginBottom: 16 }}>
              📲 Pasar tablet al cliente
            </button>
            <div style={{ fontSize: 11, color: '#606060' }}>O toca para ir directo a la encuesta</div>
          </div>
        </div>
      )}

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

      {/* MODAL PIN GERENTE */}
      {pinModal && (
        <div className="fixed inset-0 bg-black/80 z-[600] flex items-center justify-center p-4">
          <div className="bg-[#1c1c1c] border border-[#d4943a]/30 rounded-2xl p-6 w-full max-w-[320px]">
            <div className="text-center mb-5">
              <div className="w-12 h-12 rounded-xl bg-[#d4943a]/10 border border-[#d4943a]/30 flex items-center justify-center mx-auto mb-3">
                <Lock size={22} className="text-[#d4943a]" />
              </div>
              <div className="font-['Syne'] text-[17px] font-bold">PIN Gerente</div>
              <div className="text-[11px] text-[#606060] mt-1">Solo gerencia puede aplicar descuentos</div>
            </div>

            {/* Display PIN */}
            <div className="flex justify-center gap-3 mb-4">
              {[0, 1, 2, 3].map(i => (
                <div key={i} className={`w-10 h-10 rounded-xl border flex items-center justify-center text-[20px] font-bold transition-all ${pinInput.length > i ? 'border-[#d4943a] bg-[#d4943a]/10 text-[#d4943a]' : 'border-[#2a2a2a] text-[#2a2a2a]'}`}>
                  {pinInput.length > i ? '●' : '○'}
                </div>
              ))}
            </div>

            {pinError && <div className="text-[11px] text-[#e05050] font-bold text-center mb-3">{pinError}</div>}

            {/* Teclado numérico */}
            <div className="grid grid-cols-3 gap-2 mb-4">
              {['1','2','3','4','5','6','7','8','9','','0','⌫'].map((k, i) => (
                <button key={i} onClick={() => {
                  if (k === '') return;
                  if (k === '⌫') { setPinInput(p => p.slice(0, -1)); setPinError(''); return; }
                  if (pinInput.length < 4) {
                    const next = pinInput + k;
                    setPinInput(next);
                    if (next.length === 4) setTimeout(() => { if (next === PIN_GERENTE) { setPinUnlocked(true); setPinModal(false); pinCallback?.(); } else { setPinError('PIN incorrecto'); setPinInput(''); } }, 200);
                  }
                }}
                  className={`py-3 rounded-xl border text-[17px] font-bold transition-all ${k === '' ? 'invisible' : 'border-[#2a2a2a] text-[#f0f0f0] hover:bg-[#2a2a2a] hover:border-[#606060] active:bg-[#d4943a]/20'}`}>
                  {k}
                </button>
              ))}
            </div>

            <button onClick={() => { setPinModal(false); setPinInput(''); setPinError(''); }}
              className="w-full py-2.5 rounded-xl border border-[#2a2a2a] text-[#606060] text-[11px] font-semibold hover:border-[#a0a0a0] transition-all">
              Cancelar
            </button>
          </div>
        </div>
      )}

      {/* MODAL TÉRMINO DE COCCIÓN */}
      {terminoModal.open && terminoModal.producto && (
        <div className="fixed inset-0 bg-black/80 z-[600] flex items-center justify-center p-4">
          <div className="bg-[#1c1c1c] border border-[#d4943a]/30 rounded-2xl p-6 w-full max-w-[320px]">
            <div className="text-center mb-5">
              <div className="text-[28px] mb-2">{terminoModal.producto.emoji}</div>
              <div className="font-['Syne'] text-[16px] font-bold">{terminoModal.producto.nombre}</div>
              <div className="text-[11px] text-[#606060] mt-1">¿Qué término de cocción?</div>
            </div>
            <div className="flex flex-col gap-2 mb-4">
              {TERMINOS_COCCION.map(t => (
                <button key={t}
                  onClick={() => {
                    const p = terminoModal.producto;
                    const modo = terminoModal.modo;
                    setTerminoModal({ open: false, producto: null, modo: 'orden' });
                    if (modo === 'orden') agregarAOrdenDirecto(p, t);
                    else marcharAhoraDirecto(p, t);
                  }}
                  className="w-full py-3 rounded-xl border border-[#2a2a2a] text-[13px] font-bold text-[#f0f0f0] hover:border-[#d4943a] hover:bg-[#d4943a]/10 hover:text-[#d4943a] transition-all">
                  {t}
                </button>
              ))}
            </div>
            <button onClick={() => setTerminoModal({ open: false, producto: null, modo: 'orden' })}
              className="w-full py-2.5 rounded-xl border border-[#2a2a2a] text-[#606060] text-[11px] font-semibold hover:border-[#a0a0a0] transition-all">
              Cancelar
            </button>
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

      {/* BOTÓN FULLSCREEN FLOTANTE — siempre visible en esquina superior derecha */}
      <button
        onClick={toggleFullscreen}
        title={isFullscreen ? 'Salir pantalla completa' : 'Pantalla completa (tablet)'}
        className={`fixed top-3 right-3 z-[9000] flex items-center gap-1.5 px-3 py-2 rounded-xl border font-semibold text-[12px] transition-all shadow-lg ${
          isFullscreen
            ? 'bg-[#d4943a] border-[#d4943a] text-black'
            : 'bg-[#1c1c1c] border-[#d4943a]/60 text-[#d4943a] hover:bg-[#d4943a] hover:text-black'
        }`}>
        {isFullscreen
          ? <><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M8 3v3a2 2 0 0 1-2 2H3m18 0h-3a2 2 0 0 1-2-2V3m0 18v-3a2 2 0 0 1 2-2h3M3 16h3a2 2 0 0 1 2 2v3"/></svg> Salir</>
          : <><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"/></svg> Pantalla completa</>
        }
      </button>

      {/* BOTÓN COLAPSAR SIDEBAR NEXUM — desplaza el nav izquierdo fuera de pantalla */}
      <button
        onClick={() => {
          setSidebarCollapsed(prev => {
            const next = !prev;
            // Colapsar/expandir el sidebar global de Nexum
            const nexumSidebar = document.querySelector('[class*="w-64"], [class*="sidebar"], nav.sidebar, [class*="left-sidebar"], aside') as HTMLElement;
            // Buscar el primer elemento nav o aside antes del main
            const sidebar = document.querySelector('body > div > div > nav, body > div > div > aside, [class*="flex"][class*="h-screen"] > [class*="w-"]:first-child') as HTMLElement;
            if (sidebar) {
              sidebar.style.transition = 'width 0.3s ease, opacity 0.3s ease';
              sidebar.style.width = next ? '0px' : '';
              sidebar.style.overflow = next ? 'hidden' : '';
              sidebar.style.opacity = next ? '0' : '';
            }
            return next;
          });
        }}
        title={sidebarCollapsed ? 'Mostrar navegación' : 'Ocultar navegación (más espacio)'}
        className={`fixed top-3 z-[9000] flex items-center gap-1.5 px-3 py-2 rounded-xl border font-semibold text-[12px] transition-all shadow-lg ${
          sidebarCollapsed
            ? 'bg-[#3dba6f] border-[#3dba6f] text-black'
            : 'bg-[#1c1c1c] border-[#3dba6f]/60 text-[#3dba6f] hover:bg-[#3dba6f] hover:text-black'
        }`} style={{ right: isFullscreen ? '110px' : '180px' }}>
        {sidebarCollapsed
          ? <><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 18l6-6-6-6"/></svg> Nav</>
          : <><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6"/></svg> Ocultar nav</>
        }
      </button>

      {/* LEFT PANEL */}
      <div className="bg-[#141414] border-r border-[#2a2a2a] flex flex-col shrink-0" style={{ width: 200 }}>
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

        <div className="flex-1 p-2 px-3 flex flex-col gap-2 overflow-y-auto">
          {/* Solo la mesa seleccionada — navegación con flechas */}
          {(() => {
            const idx = displayTables.findIndex(m => m.id === selectedTableId);
            const m = displayTables[idx];
            if (!m) return null;
            const pct = Math.min(100, Math.round((m.ticket / m.meta) * 100));
            const colorClass = pct >= 80 ? 'bg-[#3dba6f]' : pct >= 50 ? 'bg-[#d4943a]' : 'bg-[#e05050]';
            return (
              <>
                {/* Navegación entre mesas */}
                <div className="flex items-center justify-between mb-1">
                  <button onClick={() => { const prev = displayTables[idx - 1]; if (prev) setSelectedTableId(prev.id); }}
                    disabled={idx === 0}
                    className="w-7 h-7 rounded-lg bg-[#1c1c1c] border border-[#2a2a2a] flex items-center justify-center text-[#a0a0a0] disabled:opacity-30 hover:border-[#d4943a] hover:text-[#d4943a] transition-all text-[14px]">‹</button>
                  <span className="text-[11px] text-[#606060]">{idx + 1} de {displayTables.length} mesas</span>
                  <button onClick={() => { const next = displayTables[idx + 1]; if (next) setSelectedTableId(next.id); }}
                    disabled={idx === displayTables.length - 1}
                    className="w-7 h-7 rounded-lg bg-[#1c1c1c] border border-[#2a2a2a] flex items-center justify-center text-[#a0a0a0] disabled:opacity-30 hover:border-[#d4943a] hover:text-[#d4943a] transition-all text-[14px]">›</button>
                </div>

                {/* Card de la mesa activa — más grande */}
                <div className="bg-[#1c1c1c] border-2 border-[#d4943a] rounded-2xl p-4 px-4">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="font-['Syne'] text-[24px] font-black text-[#f0f0f0]">Mesa {m.num}</span>
                    <div className="flex gap-1 items-center ml-1">
                      {m.vip && <span className="text-[16px] text-[#ffd700]">⭐</span>}
                      {m.bday && <span className="text-[16px]">🎂</span>}
                      {m.alert && <span className="text-[15px] text-[#e07830]">⚠️</span>}
                    </div>
                    <div className="w-7 h-7 rounded-full bg-[#3dba6f] text-white text-[12px] font-bold flex items-center justify-center shrink-0 ml-auto">{m.pax}</div>
                  </div>
                  <div className="text-[14px] text-[#a0a0a0] mb-3">{m.cliente}</div>
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-[13px] text-[#606060] tabular-nums">{m.time}</span>
                    <span className="text-[13px] text-[#a0a0a0] ml-auto">${m.ticket} / ${m.meta}</span>
                  </div>
                  <div className="h-[5px] bg-[#2a2a2a] rounded-sm overflow-hidden">
                    <div className={`h-full rounded-sm transition-all duration-500 ${colorClass}`} style={{ width: `${pct}%` }}></div>
                  </div>
                  <div className="text-[12px] text-center mt-1.5" style={{ color: pct >= 80 ? '#3dba6f' : pct >= 50 ? '#d4943a' : '#e05050' }}>
                    {pct}% del objetivo
                  </div>
                </div>

                {/* Botones de acción de mesa */}
                <div className="grid grid-cols-2 gap-2">
                  <button onClick={() => { setRightTab('IA'); }}
                    className="py-3 rounded-xl border border-[#2a2a2a] text-[13px] font-semibold text-[#a0a0a0] hover:border-[#d4943a] hover:text-[#d4943a] active:bg-[#3dba6f]/20 active:border-[#3dba6f] active:text-[#3dba6f] transition-all">
                    🧠 Ver Brief
                  </button>
                  <button onClick={() => abrirModoCliente(m.id)}
                    className="py-3 rounded-xl bg-[#d4943a] text-black text-[13px] font-bold hover:bg-[#f0b45a] active:bg-[#3dba6f] active:text-white transition-all">
                    📲 Cobrar
                  </button>
                </div>

                {/* Mini lista de otras mesas */}
                <div className="mt-2">
                  <div className="text-[10px] text-[#606060] font-bold uppercase tracking-wider mb-1.5">Otras mesas</div>
                  <div className="flex flex-col gap-1">
                    {displayTables.filter(t => t.id !== selectedTableId).map(t => {
                      const tp = Math.min(100, Math.round((t.ticket / t.meta) * 100));
                      const tc = tp >= 80 ? 'bg-[#3dba6f]' : tp >= 50 ? 'bg-[#d4943a]' : 'bg-[#e05050]';
                      return (
                        <div key={t.id} onClick={() => setSelectedTableId(t.id)}
                          className="flex items-center gap-2 p-2 px-2.5 rounded-lg bg-[#1a1a1a] border border-[#2a2a2a] cursor-pointer hover:border-[#d4943a]/40 transition-all">
                          <span className="text-[12px] font-semibold text-[#f0f0f0]">M{t.num}</span>
                          <span className="text-[11px] text-[#606060] flex-1 truncate">{t.cliente}</span>
                          <div className="w-12 h-[3px] bg-[#2a2a2a] rounded-sm overflow-hidden shrink-0">
                            <div className={`h-full rounded-sm ${tc}`} style={{ width: `${tp}%` }}></div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* BRIEF — Stock en 86 — dinámico desde stockFlow */}
                <div className="mt-3 pt-3 border-t border-[#2a2a2a]">
                  <div className="text-[10px] font-semibold uppercase tracking-[0.8px] text-[#606060] mb-2 flex items-center gap-1.5">
                    En <span className="text-[#e05050] font-black">86</span> · Stock bajo
                  </div>
                  <div className="flex flex-col gap-1">
                    {Object.entries(stockFlow)
                      .filter(([, qty]) => qty <= 6)
                      .sort(([, a], [, b]) => a - b)
                      .map(([name, qty]) => (
                        <div key={name} className="flex items-center gap-2 py-1 border-b border-[#1a1a1a] last:border-0">
                          <div className="w-2 h-2 rounded-full shrink-0" style={{ background: qty <= 0 ? '#e05050' : qty <= 3 ? '#e05050' : '#f0b45a' }}></div>
                          <span className="flex-1 text-[10px] text-[#a0a0a0] truncate">{name}</span>
                          <span className="text-[10px] font-black shrink-0" style={{ color: qty <= 0 ? '#e05050' : '#f0b45a' }}>
                            {qty <= 0 ? '86' : qty}
                          </span>
                          <button onClick={() => { setStockFlow(prev => ({ ...prev, [name]: 10 })); showToast(`✓ ${name} repuesto`); }}
                            className="w-[20px] h-[20px] rounded-md bg-[#1a1a1a] border border-[#2a2a2a] flex items-center justify-center hover:bg-[#3dba6f] hover:text-black hover:border-[#3dba6f] transition-all text-[10px] shrink-0">+</button>
                        </div>
                    ))}
                    {Object.values(stockFlow).every(v => v > 6) && (
                      <div className="text-[10px] text-[#3dba6f]">✓ Todo disponible</div>
                    )}
                  </div>
                </div>

                {/* TRASPASO DE MESA */}
                <div className="mt-3 pt-3 border-t border-[#2a2a2a]">
                  <button onClick={() => setMostrarTraspaso(p => !p)}
                    className="w-full flex items-center justify-between text-[10px] font-bold text-[#606060] uppercase tracking-wider hover:text-[#d4943a] transition-all">
                    <span className="flex items-center gap-1.5">↔ Traspaso de mesa</span>
                    <span>{mostrarTraspaso ? '▲' : '▼'}</span>
                  </button>
                  {mostrarTraspaso && (
                    <div className="mt-2 flex flex-col gap-2">
                      <div className="flex gap-1">
                        {([
                          { id:'mesa',        label:'Mesa → Mesa',  color:'#4a8fd4' },
                          { id:'barra',        label:'Mesa → Barra', color:'#9b72ff' },
                          { id:'barra-a-mesa', label:'Barra → Mesa', color:'#d4943a' },
                        ] as const).map(t => (
                          <button key={t.id} onClick={() => setTipoTraspaso(t.id)}
                            style={{ borderColor: tipoTraspaso===t.id ? t.color : '#2a2a2a', background: tipoTraspaso===t.id ? t.color+'18' : 'transparent', color: tipoTraspaso===t.id ? t.color : '#606060' }}
                            className="flex-1 py-1.5 rounded-lg border text-[9px] font-bold transition-all">
                            {t.label}
                          </button>
                        ))}
                      </div>
                      <div className="text-[9px] text-[#606060]">
                        Origen: <span className="text-[#f0f0f0] font-bold">Mesa {m.num} — {m.cliente}</span>
                      </div>
                      {tipoTraspaso !== 'barra' && (
                        <div>
                          <div className="text-[9px] text-[#606060] mb-1">Destino:</div>
                          <div className="flex flex-wrap gap-1">
                            {displayTables.filter(t => t.id !== selectedTableId).map(t => (
                              <button key={t.id} onClick={() => setMesaDestino(mesaDestino === t.id ? null : t.id)}
                                style={{ borderColor: mesaDestino===t.id ? '#d4943a' : '#2a2a2a', background: mesaDestino===t.id ? '#d4943a18' : '#1a1a1a', color: mesaDestino===t.id ? '#d4943a' : '#a0a0a0' }}
                                className="px-2 py-1 rounded-lg border text-[10px] font-bold transition-all">
                                M{t.num}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                      {tipoTraspaso === 'barra' && (
                        <div className="text-[9px] text-[#9b72ff] bg-[#9b72ff]/10 border border-[#9b72ff]/20 rounded-lg px-2 py-1.5">
                          La cuenta pasa a nombre de barra — el mesero de barra continúa el servicio
                        </div>
                      )}
                      <button onClick={() => {
                        if (tipoTraspaso === 'barra') {
                          showToast(`↔ Mesa ${m.num} → Barra · ${m.cliente} traspasado`);
                        } else if (mesaDestino) {
                          const dest = displayTables.find(t => t.id === mesaDestino);
                          showToast(`↔ Mesa ${m.num} → Mesa ${dest?.num} · Traspaso confirmado`);
                          setSelectedTableId(mesaDestino);
                        } else {
                          showToast('⚠️ Selecciona mesa destino'); return;
                        }
                        setMostrarTraspaso(false); setMesaDestino(null);
                      }} className="w-full py-2 rounded-xl bg-[#d4943a] text-black text-[11px] font-bold hover:bg-[#f0b45a] transition-all">
                        ✓ Confirmar traspaso
                      </button>
                    </div>
                  )}
                </div>

                {/* ORDEN PENDIENTE — confirmación prominente */}
                {pendingOrder.filter(o => o.mesa === selectedTable.num).length > 0 && (
                  <div className="mt-3 pt-3 border-t border-[#d4943a]/40">
                    <div className="flex items-center justify-between mb-2">
                      <div className="text-[10px] font-bold text-[#d4943a] uppercase tracking-wider flex items-center gap-1">
                        🧾 Orden M{selectedTable.num}
                      </div>
                      <span className="text-[9px] bg-[#d4943a] text-black font-black px-1.5 py-0.5 rounded-full">
                        {pendingOrder.filter(o => o.mesa === selectedTable.num).length}
                      </span>
                    </div>
                    <div className="flex flex-col gap-1 mb-2 max-h-[120px] overflow-y-auto" style={{ scrollbarWidth: 'none' }}>
                      {pendingOrder.filter(o => o.mesa === selectedTable.num).map((item, i) => (
                        <div key={i} className="flex items-center gap-1.5 py-1 border-b border-[#1a1a1a] last:border-0">
                          <span className="text-[13px] shrink-0">{item.emoji}</span>
                          <span className="flex-1 text-[10px] text-[#f0f0f0] truncate">{item.nombre}</span>
                          <span className="text-[10px] text-[#d4943a] font-bold shrink-0">{item.precio}</span>
                          <button onClick={() => removePendingOrder(pendingOrder.findIndex((o, idx) => o.mesa === selectedTable.num && o.nombre === item.nombre && idx >= i))}
                            className="text-[#606060] hover:text-[#e05050] text-[9px] shrink-0">✕</button>
                        </div>
                      ))}
                    </div>
                    {/* Total */}
                    <div className="flex justify-between text-[11px] font-bold mb-2">
                      <span className="text-[#606060]">Total</span>
                      <span className="text-[#f0b45a]">${formatPrecio(pendingOrder.filter(o => o.mesa === selectedTable.num).reduce((s, o) => s + parsePrecio(o.precio), 0))}</span>
                    </div>
                    {/* Botones de acción */}
                    <div className="flex gap-1.5">
                      <button onClick={() => setPendingOrder(prev => prev.filter(o => o.mesa !== selectedTable.num))}
                        className="px-2 py-2 rounded-lg border border-[#2a2a2a] text-[9px] text-[#606060] hover:text-[#e05050] hover:border-[#e05050] transition-all">
                        Limpiar
                      </button>
                      <button onClick={() => {
                        const items = pendingOrder.filter(o => o.mesa === selectedTable.num);
                        items.forEach(item => setStockFlow(prev => ({ ...prev, [item.nombre]: Math.max(0, (prev[item.nombre] ?? 10) - 1) })));
                        setOrder(prev => [...prev, ...items]);
                        setPendingOrder(prev => prev.filter(o => o.mesa !== selectedTable.num));
                        showToast(`✓ Orden Mesa ${selectedTable.num} → Flow`);
                      }}
                        className="flex-1 py-2 rounded-lg bg-[#4a8fd4] text-white text-[10px] font-bold hover:bg-[#3dba6f] active:bg-[#3dba6f] transition-all">
                        🔥 Marchar todo
                      </button>
                      <button onClick={enviarOrdenPendiente}
                        className="flex-1 py-2 rounded-lg bg-[#d4943a] text-black text-[10px] font-bold hover:bg-[#f0b45a] active:bg-[#3dba6f] active:text-white transition-all">
                        ✓ Confirmar
                      </button>
                    </div>
                  </div>
                )}
              </>
            );
          })()}
        </div>
      </div>
      <div className="flex-1 flex flex-col bg-[#0a0a0a] min-w-0">
        {/* Category tabs + botones drawer */}
        <div className="bg-[#141414] border-b border-[#2a2a2a] px-3 flex items-center h-[44px] shrink-0">
          <div className="flex gap-0.5 overflow-x-auto h-full items-center" style={{ scrollbarWidth: 'none' }}>
            {categorias.map(cat => (
              <button key={cat} onClick={() => setCurrentCat(cat)}
                className={`px-4 py-2.5 rounded-md text-[14px] font-medium whitespace-nowrap border transition-all h-[40px] flex items-center ${currentCat === cat ? 'text-[#f0f0f0] bg-[#1c1c1c] border-[#2a2a2a] font-semibold border-b-2 border-b-[#d4943a]' : 'border-transparent text-[#a0a0a0] bg-transparent hover:text-[#f0f0f0] hover:bg-[#1c1c1c]'}`}>
                {cat}
              </button>
            ))}
          </div>
          {/* Botones panel derecho + carrito */}
          <div className="ml-auto flex items-center gap-1 shrink-0">
            {(['IA','Cuenta','Chat','Menú'] as const).map(tab => {
              const icons = { IA: <Sparkles size={15}/>, Cuenta: <Receipt size={15}/>, Chat: <MessageSquare size={15}/>, Menú: <ShoppingCart size={15}/> };
              return (
                <button key={tab} onClick={() => setRightTab(tab)}
                  className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg border text-[11px] font-bold transition-all ${rightTab === tab ? 'bg-[#d4943a]/15 border-[#d4943a] text-[#d4943a]' : 'bg-[#1c1c1c] border-[#2a2a2a] text-[#606060] hover:text-[#a0a0a0]'}`}>
                  {icons[tab]}<span className="hidden lg:inline">{tab}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Products grid */}
        <div className="flex-1 p-2 overflow-y-auto">
          <div className="flex items-center gap-2 text-[10px] text-[#606060] font-semibold uppercase tracking-[0.8px] mb-2">
            <div className="flex-1 h-px bg-[#2a2a2a]"></div>
            <span>{currentCat}</span>
            <div className="flex-1 h-px bg-[#2a2a2a]"></div>
          </div>
          <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(175px, 1fr))' }}>
            {(productos[currentCat] || []).map((p, i) => {
              const isAdded = addedCards.has(p.nombre);
              const isMarchando = addedCards.has(p.nombre + '_marchar');
              const isSelected = selectedPlato?.nombre === p.nombre;
              const stock = stockFlow[p.nombre] ?? 10;
              const stockColor = stock <= 0 ? '#e05050' : stock <= 3 ? '#e05050' : stock <= 6 ? '#f0b45a' : '#3dba6f';
              const stockLabel = stock <= 0 ? '86' : `${stock}`;
              const badgeColors: Record<string, string> = { green: 'bg-[#3dba6f]/15 text-[#3dba6f]', gold: 'bg-[#d4943a]/15 text-[#d4943a]', orange: 'bg-[#e07830]/15 text-[#e07830]' };
              return (
                <div key={i}
                  onClick={() => setSelectedPlato(isSelected ? null : p)}
                  className={`bg-[#1c1c1c] border rounded-xl overflow-hidden transition-all flex flex-col relative cursor-pointer
                    ${stock <= 0 ? 'opacity-50 border-[#e05050]/40' :
                      isSelected ? 'border-[#d4943a] ring-2 ring-[#d4943a]/30 -translate-y-0.5 shadow-lg shadow-[#d4943a]/10' :
                      isAdded ? 'border-[#3dba6f]' :
                      isMarchando ? 'border-[#4a8fd4]' :
                      'border-[#2a2a2a] hover:border-[#d4943a]/50'}`}>

                  {/* Stock badge */}
                  <div className="absolute top-1.5 right-1.5 z-10 flex items-center gap-0.5 px-2 py-1 rounded-full text-[9px] font-black"
                    style={{ background: stockColor + '25', color: stockColor, border: `1px solid ${stockColor}50` }}>
                    {stock <= 0 ? '86' : stock <= 6 ? `⚠ ${stock}` : stock}
                  </div>

                  <div className="w-full aspect-[4/3] bg-[#222] flex items-center justify-center text-[52px]">{p.emoji}</div>
                  <div className="p-3 flex flex-col gap-1.5 flex-1">
                    <div className="text-[14px] font-bold text-[#f0f0f0] leading-tight overflow-hidden text-ellipsis whitespace-nowrap pr-4">{p.nombre}</div>
                    <span className={`self-start text-[10px] font-semibold px-2 py-0.5 rounded-full ${badgeColors[getBadgeClass(p.badge)] || 'bg-[#3dba6f]/15 text-[#3dba6f]'}`}>{getBadgeLabel(p.badge)}</span>
                    <div className="text-[15px] font-bold text-[#d4943a]">{p.precio}</div>
                    {/* Botones */}
                    {stock > 0 && (
                      <div className="flex gap-2 mt-1.5">
                        <button
                          onClick={(e) => { e.stopPropagation(); marcharAhora(p); }}
                          className={`flex-1 py-2 rounded-xl text-[12px] font-bold transition-all ${isMarchando ? 'bg-[#3dba6f] text-white border border-[#3dba6f]' : 'bg-[#4a8fd4]/10 border border-[#4a8fd4]/30 text-[#4a8fd4] hover:bg-[#3dba6f] hover:text-white hover:border-[#3dba6f] active:bg-[#3dba6f]'}`}>
                          🔥 Marchar
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); agregarAOrden(p); }}
                          className={`flex-1 py-2 rounded-xl text-[12px] font-bold transition-all ${isAdded ? 'bg-[#3dba6f] text-white border border-[#3dba6f]' : 'bg-[#222] border border-[#2a2a2a] text-[#a0a0a0] hover:bg-[#3dba6f] hover:text-white hover:border-[#3dba6f] active:bg-[#3dba6f]'}`}>
                          + Orden
                        </button>
                      </div>
                    )}
                    {stock <= 0 && <div className="text-[10px] text-[#e05050] font-bold text-center mt-1">NO DISPONIBLE</div>}
                  </div>
                  {isAdded && <div className="absolute inset-0 bg-[#3dba6f]/10 pointer-events-none border-2 border-[#3dba6f] rounded-xl"></div>}
                </div>
              );
            })}
          </div>

          {/* PANEL INFO IA — aparece al seleccionar un plato */}
          {selectedPlato && (() => {
            const info = prodDescs[selectedPlato.nombre];
            const stock = stockFlow[selectedPlato.nombre] ?? 10;
            return (
              <div className="mt-3 bg-[#141414] border border-[#d4943a]/40 rounded-xl overflow-hidden animate-in">
                {/* Header del plato */}
                <div className="flex items-center gap-3 p-3 border-b border-[#2a2a2a]">
                  <span className="text-[32px]">{selectedPlato.emoji}</span>
                  <div className="flex-1 min-w-0">
                    <div className="font-['Syne'] text-[14px] font-black text-[#f0f0f0]">{selectedPlato.nombre}</div>
                    <div className="text-[12px] font-bold text-[#d4943a]">{selectedPlato.precio}</div>
                  </div>
                  <div className="flex flex-col items-center gap-0.5">
                    <div className="text-[11px] font-black" style={{ color: stock <= 3 ? '#e05050' : stock <= 6 ? '#f0b45a' : '#3dba6f' }}>
                      {stock <= 0 ? '86' : stock}
                    </div>
                    <div className="text-[8px] text-[#606060]">stock</div>
                  </div>
                  <button onClick={() => setSelectedPlato(null)} className="text-[#606060] hover:text-white text-[16px] ml-1">✕</button>
                </div>

                {info ? (
                  <div className="p-3 flex flex-col gap-2.5">
                    {/* Descripción */}
                    <div>
                      <div className="text-[9px] text-[#d4943a] font-bold uppercase tracking-wider mb-1">📋 Descripción</div>
                      <div className="text-[12px] text-[#ccc] leading-relaxed">{info.desc}</div>
                    </div>
                    {/* Salsas */}
                    <div>
                      <div className="text-[9px] text-[#9b72ff] font-bold uppercase tracking-wider mb-1">🫙 Salsas y Acompañamientos</div>
                      <div className="text-[11px] text-[#a0a0a0]">{info.salsas}</div>
                    </div>
                    {/* Tip del chef */}
                    <div className="bg-[#d4943a]/8 border border-[#d4943a]/20 rounded-lg p-2">
                      <div className="text-[9px] text-[#d4943a] font-bold mb-0.5">✦ Insight de venta</div>
                      <div className="text-[11px] text-[#f0b45a]">{info.chef}</div>
                    </div>
                    {/* Venta cruzada */}
                    <div>
                      <div className="text-[9px] text-[#3dba6f] font-bold uppercase tracking-wider mb-1.5">🔗 Recomendar también</div>
                      <div className="flex gap-1.5 flex-wrap">
                        {info.cross.map(nombre => {
                          const prod = Object.values(productos).flat().find((x: any) => x.nombre === nombre) as any;
                          return prod ? (
                            <button key={nombre}
                              onClick={() => agregarAOrden(prod)}
                              className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg bg-[#1c1c1c] border border-[#3dba6f]/30 hover:border-[#3dba6f] hover:bg-[#3dba6f]/10 active:bg-[#3dba6f]/25 transition-all">
                              <span className="text-[14px]">{prod.emoji}</span>
                              <div>
                                <div className="text-[10px] font-bold text-[#f0f0f0] whitespace-nowrap">{prod.nombre}</div>
                                <div className="text-[9px] text-[#3dba6f]">{prod.precio}</div>
                              </div>
                            </button>
                          ) : null;
                        })}
                      </div>
                    </div>
                    {/* Botones de acción */}
                    <div className="flex gap-2 pt-1 border-t border-[#2a2a2a]">
                      <button onClick={() => marcharAhora(selectedPlato)}
                        className="flex-1 py-2 rounded-lg bg-[#4a8fd4] text-white text-[11px] font-bold hover:bg-[#3dba6f] active:bg-[#3dba6f] transition-all">
                        🔥 Marchar ahora
                      </button>
                      <button onClick={() => agregarAOrden(selectedPlato)}
                        className="flex-1 py-2 rounded-lg bg-[#d4943a] text-black text-[11px] font-bold hover:bg-[#f0b45a] active:bg-[#3dba6f] active:text-white transition-all">
                        + Agregar a orden
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="p-3 flex gap-2">
                    <button onClick={() => marcharAhora(selectedPlato)} className="flex-1 py-2 rounded-lg bg-[#4a8fd4] text-white text-[11px] font-bold">🔥 Marchar</button>
                    <button onClick={() => agregarAOrden(selectedPlato)} className="flex-1 py-2 rounded-lg bg-[#d4943a] text-black text-[11px] font-bold">+ Orden</button>
                  </div>
                )}
              </div>
            );
          })()}
        </div>

        {/* BARRA INFERIOR COLAPSABLE */}
        <div className="bg-[#0a0a0a] border-t border-[#2a2a2a] flex flex-col shrink-0">

          {/* Toggle bar — siempre visible */}
          <div className="flex items-center justify-end px-3 py-1.5 border-b border-[#1a1a1a]">
            <button onClick={() => setBarraColapsada(p => !p)}
              className="shrink-0 flex items-center gap-1 px-2.5 py-1 rounded-md border border-[#2a2a2a] text-[10px] font-bold text-[#606060] hover:border-[#d4943a] hover:text-[#d4943a] transition-all">
              {barraColapsada ? '▲ Ver barra' : '▼ Ocultar'}
            </button>
          </div>

          {/* Contenido colapsable */}
          {!barraColapsada && (
            <>
              {/* FILA RITUAL — solo mesa activa */}
              <div className="border-b border-[#1a1a1a] overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
                <div className="flex items-center px-3 py-2 gap-1.5">
                  {/* Label mesa activa */}
                  <div className="flex items-center gap-1 shrink-0 mr-1">
                    <span className="text-[10px] font-black px-2 py-0.5 rounded bg-[#d4943a] text-black">M{selectedTable.num}</span>
                    <span className="text-[9px] text-[#606060] font-medium">{selectedTable.cliente}</span>
                  </div>
                  {/* Steps solo de la mesa activa */}
                  {ritualStepsAll.map((step) => {
                    const state = ritualState[selectedTable.id] || [];
                    const done = state.includes(step);
                    const stepEmojis: Record<string,string> = { 'Agua':'💧','Coctel':'🍹','Compartir':'🥟','Robata/Wok':'🔥','Postre':'🍮','Recomendar':'⭐','Pousse-café':'🥃','Café/Té':'☕','Vino':'🍷','Licor':'🥂' };
                    const stepColors: Record<string,[string,string]> = {
                      'Agua':['#4a8fd4','#1a2a3a'],'Coctel':['#9b72ff','#1e1a2e'],'Compartir':['#d4943a','#2a1e0a'],
                      'Robata/Wok':['#e05050','#2a1010'],'Postre':['#f0b45a','#2a200a'],'Recomendar':['#3dba6f','#0a2a16'],
                      'Pousse-café':['#3dba6f','#0a2a16'],'Café/Té':['#cd853f','#2a1800'],'Vino':['#e91e8c','#2a0a1a'],'Licor':['#ffd700','#2a2000'],
                    };
                    const [activeColor, activeBg] = stepColors[step] || ['#3dba6f','#0a2a16'];
                    const shortLabel = step === 'Robata/Wok' ? 'Rob' : step === 'Pousse-café' ? 'Pouss' : step === 'Recomendar' ? 'Rec' : step.split('/')[0];
                    return (
                      <button key={step} onClick={() => toggleRitualStep(selectedTable.id, step)} title={step}
                        style={done
                          ? { background: activeBg, borderColor: activeColor+'80', color: activeColor }
                          : { background: 'transparent', borderColor: '#1e1e1e', color: '#444' }}
                        className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg border text-[10px] font-bold whitespace-nowrap transition-all shrink-0 hover:opacity-90 active:scale-95">
                        <span style={{ fontSize: 15 }}>{done ? '✓' : stepEmojis[step]}</span>
                        <span style={{ fontSize: 10 }}>{shortLabel}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* QUICK-ADD */}
              <div className="border-b border-[#1a1a1a] overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
                <div className="flex items-stretch min-w-max">
                  {[
                    { cat:'Agua',emoji:'💧',color:'#4a8fd4',items:[{n:'Con Gas',p:'$3k',e:'💧'},{n:'Sin Gas',p:'$3k',e:'🫧'}]},
                    { cat:'Coctel',emoji:'🍹',color:'#9b72ff',items:[{n:'Yin Peng',p:'$50k',e:'🍹'},{n:'Infinito',p:'$55k',e:'🍍'},{n:'Gin Ken',p:'$56k',e:'🍸'}]},
                    { cat:'Compartir',emoji:'🥟',color:'#d4943a',items:[{n:'Otosan',p:'$34k',e:'🦀'},{n:'Dumplings',p:'$27k',e:'🥟'},{n:'Burosu',p:'$40k',e:'🍜'}]},
                    { cat:'Robata',emoji:'🔥',color:'#e05050',items:[{n:'Pulpo',p:'$57k',e:'🐙'},{n:'Yakitori',p:'$43k',e:'🍢'},{n:'Arroz',p:'$80k',e:'🥩'}]},
                    { cat:'Postre',emoji:'🍮',color:'#f0b45a',items:[{n:'Cheese',p:'$33k',e:'🍰'},{n:'Koujun',p:'$35k',e:'🍮'},{n:'Kyoto',p:'$84k',e:'🍱'}]},
                    { cat:'Café/Té',emoji:'☕',color:'#cd853f',items:[{n:'Espresso',p:'$8k',e:'☕'},{n:'Americano',p:'$9k',e:'☕'},{n:'Té',p:'$16k',e:'🍵'}]},
                    { cat:'Vino',emoji:'🍷',color:'#e91e8c',items:[{n:'Malbec',p:'$28k',e:'🍷'},{n:'Rosé',p:'$26k',e:'🥂'},{n:'Blanco',p:'$24k',e:'🍾'}]},
                    { cat:'Licor',emoji:'🥂',color:'#ffd700',items:[{n:'Sake',p:'$45k',e:'🍶'},{n:'Heineken',p:'$15k',e:'🍺'},{n:'Old F.',p:'$48k',e:'🥃'}]},
                  ].map(({ cat, emoji, color, items }) => (
                    <div key={cat} className="flex flex-col shrink-0 border-r border-[#1a1a1a] last:border-r-0">
                      <div className="flex items-center gap-1.5 px-2.5 py-1.5 border-b border-[#1a1a1a]" style={{ background: color+'12' }}>
                        <span style={{ fontSize: 13 }}>{emoji}</span>
                        <span style={{ fontSize: 10, color, fontWeight: 800, textTransform: 'uppercase', letterSpacing: 1, whiteSpace: 'nowrap' }}>{cat}</span>
                      </div>
                      <div className="flex gap-1 px-1.5 py-1.5">
                        {items.map(item => (
                          <button key={item.n} onClick={() => agregarAOrden({ nombre: item.n, precio: item.p, emoji: item.e, categoria: cat })}
                            className="flex flex-col items-center gap-0.5 px-2 py-1.5 rounded-lg border border-[#1a1a1a] bg-[#111] hover:border-[#3dba6f]/50 active:bg-[#3dba6f]/25 active:border-[#3dba6f] transition-all" style={{ minWidth: 54 }}>
                            <span style={{ fontSize: 22 }}>{item.e}</span>
                            <span style={{ fontSize: 9, color: '#888', whiteSpace: 'nowrap' }}>{item.n}</span>
                            <span style={{ fontSize: 9, color, fontWeight: 700 }}>{item.p}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* IA RECS */}
              <div className="flex items-center px-3 py-1.5 overflow-x-auto gap-2" style={{ scrollbarWidth: 'none', minHeight: 58 }}>
                <div className="flex flex-col items-center shrink-0 mr-1">
                  <span style={{ fontSize: 13, color: '#d4943a' }}>✦</span>
                  <span style={{ fontSize: 9, color: '#606060', fontWeight: 700, textTransform: 'uppercase' }}>IA</span>
                </div>
                {recs.map((r, i) => (
                  <button key={i} onClick={() => addToOrder({ nombre: r.name, precio: r.precio, emoji: r.emoji })}
                    className={`flex items-center gap-2 rounded-lg border px-2.5 py-1.5 shrink-0 hover:border-[#3dba6f]/50 active:bg-[#3dba6f]/20 transition-all ${r.top ? 'border-[#d4943a]/30 bg-[#d4943a]/5' : 'border-[#1a1a1a] bg-[#111]'}`} style={{ minWidth: 140 }}>
                    <span style={{ fontSize: 20 }}>{r.emoji}</span>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 11, fontWeight: 700, color: '#f0f0f0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 110 }}>{r.name}</div>
                      <div style={{ fontSize: 10, color: '#d4943a', fontWeight: 700 }}>{r.precio}</div>
                    </div>
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {/* RIGHT PANEL — FIJO SIEMPRE VISIBLE */}
      <div className="bg-[#141414] border-l border-[#2a2a2a] flex flex-col shrink-0" style={{ width: 300 }}>
        <div className="p-3 px-4 border-b border-[#2a2a2a] flex items-center gap-2.5 shrink-0">
          <div className="w-[34px] h-[34px] rounded-lg bg-gradient-to-br from-[#d4943a] to-[#b07820] flex items-center justify-center text-[16px] font-extrabold text-black font-['Syne']">N</div>
          <div className="flex-1">
            <div className="font-['Syne'] text-[14px] font-bold text-[#f0f0f0]">NEXUM</div>
            <div className="text-[11px] text-[#a0a0a0]">AI Asistente</div>
          </div>
          {/* Badge notificaciones */}
          <button onClick={()=>setShowNotifPanel(p=>!p)} style={{position:'relative',background:'none',border:'none',cursor:'pointer',padding:4}}>
            <span style={{fontSize:18}}>🔔</span>
            {notifsBadge>0&&<span style={{position:'absolute',top:0,right:0,background:'#e05050',color:'#fff',fontSize:9,fontWeight:900,borderRadius:'50%',width:14,height:14,display:'flex',alignItems:'center',justifyContent:'center'}}>{notifsBadge}</span>}
          </button>
          {/* Cuentas por cobrar */}
          <button onClick={()=>setRightTab('Intel')} style={{background:'rgba(212,148,58,0.15)',border:'1px solid rgba(212,148,58,0.3)',borderRadius:8,padding:'4px 8px',cursor:'pointer'}}>
            <div style={{fontSize:9,color:'#d4943a',fontWeight:700}}>💰 Por cobrar</div>
            <div style={{fontSize:12,fontWeight:900,color:'#f0b45a'}}>{cuentasCobrar}</div>
          </button>
        </div>
        {/* Panel notificaciones */}
        {showNotifPanel && (
          <div style={{position:'absolute',top:50,right:0,width:280,background:'#1c1c1c',border:'1px solid #2a2a2a',borderRadius:12,zIndex:200,maxHeight:320,overflowY:'auto',boxShadow:'0 8px 32px rgba(0,0,0,.4)'}}>
            <div style={{padding:'10px 14px',borderBottom:'1px solid #2a2a2a',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
              <span style={{fontSize:12,fontWeight:700,color:'#f0f0f0'}}>🔔 Notificaciones</span>
              <button onClick={async()=>{
                await supabase.from('nexum_notificaciones').update({leida:true}).eq('leida',false).eq('restaurante_id',6);
                setNotifsBadge(0); setNotifs(p=>p.map(n=>({...n,leida:true})));
              }} style={{fontSize:10,color:'#606060',background:'none',border:'none',cursor:'pointer'}}>Marcar leídas</button>
            </div>
            {notifs.length===0&&<div style={{padding:20,textAlign:'center',color:'#606060',fontSize:12}}>Sin notificaciones</div>}
            {notifs.map((n:any)=>(
              <div key={n.id} style={{padding:'10px 14px',borderBottom:'1px solid #1a1a1a',background:n.leida?'transparent':'rgba(212,148,58,0.05)'}}>
                <div style={{display:'flex',gap:8,alignItems:'flex-start'}}>
                  <span style={{fontSize:16,flexShrink:0}}>{n.tipo==='stock_86'?'⚠️':n.tipo==='alerta_patio'?'🏠':n.tipo==='maître'?'👔':'🔔'}</span>
                  <div>
                    <div style={{fontSize:12,fontWeight:700,color:'#f0f0f0'}}>{n.titulo}</div>
                    {n.mensaje&&<div style={{fontSize:11,color:'#a0a0a0',marginTop:2}}>{n.mensaje}</div>}
                    <div style={{fontSize:10,color:'#606060',marginTop:2}}>{new Date(n.created_at).toLocaleTimeString('es-CO',{hour:'2-digit',minute:'2-digit'})}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Tabs */}
        <div className="flex border-b border-[#2a2a2a] shrink-0">
          {(['IA', 'Cuenta', 'Chat', 'Menú', 'Intel'] as const).map(tab => {
            const icons = { IA: <Sparkles size={14} />, Cuenta: <Receipt size={14} />, Chat: <MessageSquare size={14} />, Menú: <ShoppingCart size={14} />, Intel: <Zap size={14} /> };
            const activeColors = { IA: 'text-[#d4943a] border-b-[#d4943a]', Cuenta: 'text-[#f0f0f0] border-b-[#f0f0f0]', Chat: 'text-[#3dba6f] border-b-[#3dba6f]', Menú: 'text-[#9b72ff] border-b-[#9b72ff]', Intel: 'text-[#22d3ee] border-b-[#22d3ee]' };
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
              {/* ══ INTELIGENCIA OPERACIONAL ══ */}
              {(tips86.length>0 || ticketDia.pendientes>4) && (
                <div className="bg-[#1c1c1c] border border-[#e05050]/25 rounded-xl overflow-hidden">
                  <div className="px-3 py-2 border-b border-[#2a2a2a] flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-[#e05050] animate-pulse inline-block"/>
                    <span className="text-[10px] font-bold text-[#e05050] uppercase tracking-wider">Centro de Notificaciones</span>
                  </div>
                  <div className="flex flex-col">
                    {ticketDia.pendientes>4 && (
                      <div className="flex items-start gap-2.5 px-3 py-2 border-b border-[#1a1a1a]">
                        <span className="text-[16px] mt-0.5">⚠️</span>
                        <div>
                          <div className="text-[11px] font-bold text-[#f0b45a]">Alta ocupación</div>
                          <div className="text-[10px] text-[#606060]">{ticketDia.pendientes} mesas abiertas — revisar tiempos</div>
                        </div>
                      </div>
                    )}
                    {tips86.slice(0,3).map((t,i)=>(
                      <div key={i} className="flex items-start gap-2.5 px-3 py-2 border-b border-[#1a1a1a] last:border-0">
                        <span className="text-[16px] mt-0.5">{t.emoji}</span>
                        <div>
                          <div className="text-[11px] font-bold text-[#e05050]">{t.name}</div>
                          <div className="text-[10px] text-[#606060]">{t.motivo} — sugiere alternativa al cliente</div>
                        </div>
                      </div>
                    ))}
                    {ticketDia.porCobrar>200000 && (
                      <div className="flex items-start gap-2.5 px-3 py-2">
                        <span className="text-[16px] mt-0.5">💰</span>
                        <div>
                          <div className="text-[11px] font-bold text-[#3dba6f]">Cuentas por cobrar</div>
                          <div className="text-[10px] text-[#606060]">${Math.round(ticketDia.porCobrar/1000)}k pendientes · Notificar caja</div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* ══ PERFIL CLIENTE — PRIMERO Y PROMINENTE ══ */}
              <div className="bg-[#1c1c1c] border border-[#2a2a2a] rounded-xl overflow-hidden">

                {/* Banner ocasión especial — solo si aplica */}
                {c.ocasion === 'cumpleanos' && (
                  <div className="flex items-center gap-2 px-3 py-2 bg-[#f0b45a]/10 border-b border-[#f0b45a]/25">
                    <span className="text-[16px]">🎂</span>
                    <span className="text-[11px] font-bold text-[#f0b45a]">¡CUMPLEAÑOS HOY! — Coordinar postre sorpresa</span>
                  </div>
                )}
                {c.ocasion === 'aniversario' && (
                  <div className="flex items-center gap-2 px-3 py-2 bg-[#9b72ff]/10 border-b border-[#9b72ff]/25">
                    <span className="text-[16px]">🏆</span>
                    <span className="text-[11px] font-bold text-[#9b72ff]">ANIVERSARIO EMPRESA — Servicio VIP</span>
                  </div>
                )}
                {selectedTable.vip && !c.ocasion && (
                  <div className="flex items-center gap-2 px-3 py-2 bg-[#ffd700]/10 border-b border-[#ffd700]/25">
                    <span className="text-[14px]">⭐</span>
                    <span className="text-[11px] font-bold text-[#ffd700]">CLIENTE VIP — Atención preferencial</span>
                  </div>
                )}

                {/* Header del perfil */}
                <div className="p-3 flex items-center gap-3">
                  <div className="w-12 h-12 rounded-full bg-gradient-to-br from-[#d4943a] to-[#b07820] flex items-center justify-center text-[14px] font-black text-black shrink-0 font-['Syne']">
                    {c.ocasion === 'cumpleanos' ? '🎂' : c.avatar}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-['Syne'] text-[16px] font-black text-[#f0f0f0] truncate">{c.nombreCompleto || c.nombre}</div>
                    <div className="text-[11px] text-[#a0a0a0] italic truncate">{c.desc}</div>
                  </div>
                </div>

                {/* Datos de la reserva — viene de Reserve */}
                <div className="mx-3 mb-2 bg-[#0a0a0a] rounded-lg p-2.5 border border-[#2a2a2a]">
                  <div className="text-[9px] text-[#d4943a] font-bold uppercase tracking-widest mb-1.5 flex items-center gap-1">
                    <span>📋</span> Reserva — {c.reserva?.origen}
                  </div>
                  <div className="grid grid-cols-2 gap-1 text-[10px]">
                    <div><span className="text-[#606060]">Hora:</span> <span className="text-[#f0f0f0] font-semibold">{c.reserva?.hora}</span></div>
                    <div><span className="text-[#606060]">Pax:</span> <span className="text-[#f0f0f0] font-semibold">{c.reserva?.pax} personas</span></div>
                    <div className="col-span-2"><span className="text-[#606060]">Nota:</span> <span className="text-[#a0a0a0]">{c.reserva?.nota}</span></div>
                  </div>
                </div>

                {/* Historial */}
                <div className="px-3 pb-2 flex items-center gap-3 text-[10px]">
                  <div className="flex items-center gap-1">
                    <span className="text-[#606060]">Visitas:</span>
                    <span className="text-[#3dba6f] font-bold">{c.visitas}x</span>
                  </div>
                  <div className="w-px h-3 bg-[#2a2a2a]"></div>
                  <div className="flex items-center gap-1">
                    <span className="text-[#606060]">Última:</span>
                    <span className="text-[#a0a0a0]">{c.ultimaVisita}</span>
                  </div>
                </div>

                {/* Tags de preferencias */}
                <div className="px-3 pb-3 flex flex-wrap gap-1">
                  {c.tags.map((t: string) => (
                    <span key={t} className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${t.includes('🚨') || t.includes('⚠️') ? 'bg-[#e05050]/15 text-[#e05050] border border-[#e05050]/30' : 'bg-[#2a2a2a] text-[#a0a0a0]'}`}>
                      {t}
                    </span>
                  ))}
                </div>
              </div>

              {/* Alerta si hay */}
              {c.alert && (
                <div className="bg-[#e05050]/10 border border-[#e05050]/25 rounded-xl p-2.5 flex items-start gap-2">
                  <span className="text-[14px] shrink-0">⚠️</span>
                  <div className="text-[11px] text-[#e05050] font-semibold leading-snug">{c.alert}</div>
                </div>
              )}

              {/* Mensaje IA contextual */}
              <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl p-3 relative">
                <span className="absolute -top-2 left-3 bg-[#141414] px-1 text-[9px] text-[#d4943a] font-bold">✦ NEXUM IA</span>
                <div className="text-[12px] text-[#f0f0f0] leading-[1.6]">
                  {c.ocasion === 'cumpleanos'
                    ? `Grupo de cumpleaños de ${c.reserva?.pax} personas. Coordinar con cocina el postre sorpresa 10 min antes del postre. Sugerir champaña para brindis.`
                    : c.ocasion === 'aniversario'
                    ? `Reunión corporativa importante. Priorizar tiempos, presentar el menú degustación y asegurar servicio impecable desde la bienvenida.`
                    : `${c.nombreCompleto || c.nombre}, ${c.visitas > 3 ? `cliente recurrente con ${c.visitas} visitas` : 'nueva visita'}. ${c.suggest}.`
                  }
                </div>
              </div>

              {/* Separador */}
              <div className="flex items-center gap-2">
                <div className="flex-1 h-px bg-[#2a2a2a]"></div>
                <span className="text-[9px] text-[#606060] font-bold uppercase tracking-wider flex items-center gap-1"><Sparkles size={9}/> Sugerencias IA</span>
                <div className="flex-1 h-px bg-[#2a2a2a]"></div>
              </div>

              {/* Sugerencias IA */}
              <div className="flex flex-col gap-1.5">
                {c.recs.map((r: any, i: number) => {
                  const anotado = (notasMesero[selectedTable.id] || []).includes(r.txt);
                  return (
                    <div key={i} onClick={() => useRec(r.txt)}
                      className={`flex items-start gap-2.5 p-2 px-2.5 rounded-lg border text-[12px] cursor-pointer transition-all active:bg-[#3dba6f]/20 ${anotado ? 'bg-[#3dba6f]/5 border-[#3dba6f]/25' : 'bg-[#1c1c1c] border-[#2a2a2a] hover:border-[#d4943a]/30 hover:bg-[#d4943a]/5'}`}>
                      <span className="text-[15px] shrink-0 mt-px">{r.icon}</span>
                      <span className={`leading-[1.4] flex-1 text-[11px] ${anotado ? 'line-through text-[#606060]' : 'text-[#a0a0a0]'}`}>{r.txt}</span>
                      {anotado && <span className="text-[10px] text-[#3dba6f] shrink-0">✓</span>}
                    </div>
                  );
                })}
              </div>
            </>
          )}

          {rightTab === 'Cuenta' && (
            <>
              {/* ══ TICKET DEL DÍA ══ */}
              <div className="bg-[#1c1c1c] border border-[#2a2a2a] rounded-xl overflow-hidden mb-3">
                <div className="flex items-center justify-between px-3 py-2 border-b border-[#2a2a2a]">
                  <div className="text-[10px] font-bold text-[#d4943a] uppercase tracking-wider flex items-center gap-1.5">📊 Ticket del día</div>
                  <button onClick={fetchTicketDia} className="text-[10px] text-[#606060] hover:text-[#d4943a] transition-all">↻</button>
                </div>
                <div className="grid grid-cols-2 gap-px bg-[#2a2a2a]">
                  {[
                    {l:'Ventas',     v:`$${Math.round(ticketDia.ventas/1000)}k`,       c:'#3dba6f'},
                    {l:'Cobros',     v:ticketDia.ordenes,                              c:'#4a8fd4'},
                    {l:'Abiertas',   v:ticketDia.pendientes,                           c:'#f0b45a'},
                    {l:'Por cobrar', v:`$${Math.round(ticketDia.porCobrar/1000)}k`,   c:'#e05050'},
                  ].map(k=>(
                    <div key={k.l} className="bg-[#141414] px-3 py-2">
                      <div className="text-[9px] text-[#606060] uppercase tracking-wider">{k.l}</div>
                      <div className="text-[16px] font-black" style={{fontFamily:"'Syne',sans-serif",color:k.c}}>{k.v}</div>
                    </div>
                  ))}
                </div>
                {/* Cuentas por cobrar botón */}
                <div className="px-3 py-2 border-t border-[#2a2a2a]">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] text-[#a0a0a0]">💰 Propina acumulada hoy</span>
                    <span className="text-[13px] font-bold text-[#3dba6f]">${Math.round(ticketDia.propinaTotal/1000)}k</span>
                  </div>
                </div>
              </div>

              {/* ══ TIPS 86 / STOCK ALTO ══ */}
              {tips86.length>0 && (
                <div className="bg-[#1c1c1c] border border-[#e05050]/30 rounded-xl overflow-hidden mb-3">
                  <div className="px-3 py-2 border-b border-[#2a2a2a] flex items-center gap-1.5">
                    <span className="text-[10px] font-bold text-[#e05050] uppercase tracking-wider">⚠️ 86 / Stock</span>
                    <span className="text-[9px] text-[#606060] ml-auto">Sugiere alternativas</span>
                  </div>
                  {tips86.map((t,i)=>(
                    <div key={i} className="flex items-center gap-2 px-3 py-2 border-b border-[#1a1a1a] last:border-0">
                      <span className="text-[16px]">{t.emoji}</span>
                      <div className="flex-1 min-w-0">
                        <div className="text-[11px] font-semibold text-[#f0f0f0] truncate">{t.name}</div>
                        <div className="text-[9px] text-[#e05050]">{t.motivo}</div>
                      </div>
                    </div>
                  ))}
                  {tips86.length===0&&<div className="px-3 py-2 text-[11px] text-[#3dba6f]">✓ Todo disponible</div>}
                </div>
              )}

              {/* ══ PUNTOS POR PEDIDO ══ */}
              <div className="bg-[#1c1c1c] border border-[#9b72ff]/30 rounded-xl overflow-hidden mb-3">
                <div className="px-3 py-2 border-b border-[#2a2a2a]">
                  <div className="text-[10px] font-bold text-[#9b72ff] uppercase tracking-wider">✦ Puntos acumulados</div>
                </div>
                <div className="px-3 py-3 flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-[#9b72ff]/20 flex items-center justify-center text-[20px]">⭐</div>
                  <div>
                    <div className="text-[18px] font-black text-[#9b72ff]" style={{fontFamily:"'Syne',sans-serif"}}>{calcularPuntos(selectedTable.ticket)} pts</div>
                    <div className="text-[10px] text-[#606060]">Mesa {selectedTable.num} · 1 pto por $10k</div>
                  </div>
                  <div className="ml-auto text-right">
                    <div className="text-[10px] text-[#606060]">Próximo nivel</div>
                    <div className="text-[11px] font-bold text-[#f0b45a]">{Math.max(0,50-calcularPuntos(selectedTable.ticket))} pts</div>
                  </div>
                </div>
              </div>


            <>
              <div className="flex items-center gap-2 text-[13px]">
                <div className="w-1.5 h-1.5 rounded-full bg-[#d4943a] shrink-0"></div>
                <span className="text-[#a0a0a0]">Ticket:</span>
                <span className="font-semibold text-[#f0f0f0]">${selectedTable.ticket}</span>
                <span className="text-[#606060] text-[11px]">/ ${selectedTable.meta} ({Math.round(selectedTable.ticket / selectedTable.meta * 100)}%)</span>
              </div>

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
                <button onClick={() => abrirPOS(selectedTableId)} className="flex-1 min-w-[80px] py-2 px-2.5 rounded-lg text-[12px] font-semibold border border-[#2a2a2a] text-[#a0a0a0] hover:border-[#a0a0a0] transition-all active:bg-[#3dba6f]/20 active:border-[#3dba6f]">🧾 Detalle</button>
                <button onClick={() => abrirPOS(selectedTableId)} className="flex-[2] min-w-[80px] py-2 px-2.5 rounded-lg text-[12px] font-semibold bg-[#d4943a] text-black border border-[#d4943a] hover:bg-[#f0b45a] transition-all active:bg-[#3dba6f] active:border-[#3dba6f]">💳 Cobrar</button>
              </div>
              <div className="flex gap-2 flex-wrap">
                <button onClick={() => showToast('↔ Transferir próximamente')} className="flex-1 min-w-[80px] py-2 px-2.5 rounded-lg text-[12px] font-semibold border border-[#2a2a2a] text-[#a0a0a0] hover:border-[#a0a0a0] transition-all active:bg-[#3dba6f]/20">↔ Transferir</button>
                <button onClick={() => { showToast(`Mesa ${selectedTable.num} cerrada`); setOrder(prev => prev.filter(o => o.mesa !== selectedTable.num)); }} className="flex-1 min-w-[80px] py-2 px-2.5 rounded-lg text-[12px] font-semibold bg-[#e05050]/15 border border-[#e05050]/30 text-[#e05050] hover:bg-[#e05050]/25 transition-all active:bg-[#3dba6f]/20 active:border-[#3dba6f] active:text-[#3dba6f]">Cerrar Mesa</button>
              </div>
            </>
          )}

          {rightTab === 'Menú' && (
            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <div className="text-[11px] font-bold text-[#9b72ff] uppercase tracking-wider">✦ Mi Menú personalizado</div>
                <button onClick={() => setMiMenuFormOpen(p => !p)}
                  className="px-2.5 py-1 rounded-lg bg-[#9b72ff]/15 border border-[#9b72ff]/30 text-[#9b72ff] text-[10px] font-bold hover:bg-[#9b72ff]/25 transition-all">
                  {miMenuFormOpen ? '✕ Cancelar' : '+ Agregar plato'}
                </button>
              </div>
              {miMenuFormOpen && (
                <div className="bg-[#1c1c1c] border border-[#9b72ff]/30 rounded-xl p-3 flex flex-col gap-2">
                  <input value={miMenuForm.nombre} onChange={e => setMiMenuForm(p => ({...p, nombre: e.target.value}))}
                    placeholder="Nombre del plato *"
                    className="w-full bg-[#141414] border border-[#2a2a2a] focus:border-[#9b72ff] rounded-lg px-3 py-2 text-[12px] text-[#f0f0f0] outline-none" />
                  <div className="flex gap-2">
                    <input value={miMenuForm.precio} onChange={e => setMiMenuForm(p => ({...p, precio: e.target.value}))}
                      placeholder="$00.000"
                      className="flex-1 bg-[#141414] border border-[#2a2a2a] focus:border-[#9b72ff] rounded-lg px-3 py-2 text-[12px] text-[#f0f0f0] outline-none" />
                    <select value={miMenuForm.categoria} onChange={e => setMiMenuForm(p => ({...p, categoria: e.target.value}))}
                      className="flex-1 bg-[#141414] border border-[#2a2a2a] rounded-lg px-2 py-2 text-[12px] text-[#f0f0f0] outline-none">
                      {categorias.map(c => <option key={c}>{c}</option>)}
                    </select>
                  </div>
                  <div>
                    <div className="text-[9px] text-[#606060] mb-1">Emoji</div>
                    <div className="flex flex-wrap gap-1">
                      {['🍣','🍜','🍱','🥩','🐙','🦐','🍹','🍷','🥗','🍮','☕','🍺','🍶','🥟','🌮'].map(e => (
                        <button key={e} onClick={() => setMiMenuForm(p => ({...p, emoji: e}))}
                          style={{ background: miMenuForm.emoji === e ? '#9b72ff20' : '#1a1a1a', border: `1px solid ${miMenuForm.emoji === e ? '#9b72ff' : '#2a2a2a'}` }}
                          className="w-8 h-8 rounded-lg flex items-center justify-center text-[18px] transition-all">
                          {e}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <select value={miMenuForm.badge} onChange={e => setMiMenuForm(p => ({...p, badge: e.target.value}))}
                      className="flex-1 bg-[#141414] border border-[#2a2a2a] rounded-lg px-2 py-2 text-[11px] text-[#f0f0f0] outline-none">
                      <option value="recomendado">Recomendado</option>
                      <option value="gold">Alta rentabilidad</option>
                      <option value="orange">Mover hoy</option>
                    </select>
                    <label className="flex items-center gap-1.5 text-[11px] text-[#a0a0a0] cursor-pointer">
                      <input type="checkbox" checked={miMenuForm.carne} onChange={e => setMiMenuForm(p => ({...p, carne: e.target.checked}))} className="w-3 h-3" />
                      Carne
                    </label>
                  </div>
                  <button onClick={() => {
                    if (!miMenuForm.nombre || !miMenuForm.precio) { showToast('⚠️ Nombre y precio obligatorios'); return; }
                    setMiMenu(prev => [...prev, { ...miMenuForm, id: Date.now() }]);
                    setMiMenuForm({ nombre:'', precio:'', emoji:'🍽️', categoria:'Compartir', badge:'recomendado', carne: false });
                    setMiMenuFormOpen(false);
                    showToast(`✓ ${miMenuForm.nombre} agregado a Mi Menú`);
                  }} className="w-full py-2.5 rounded-xl bg-[#9b72ff] text-white text-[12px] font-bold hover:opacity-90 transition-all">
                    ✓ Guardar plato
                  </button>
                </div>
              )}
              {miMenu.length === 0 && !miMenuFormOpen && (
                <div className="text-center py-8 text-[11px] text-[#606060]">
                  <div className="text-[32px] mb-2">🍽️</div>
                  Sin platos aún — crea tu menú personalizado
                </div>
              )}
              {miMenu.map(p => (
                <div key={p.id} className="bg-[#1c1c1c] border border-[#2a2a2a] rounded-xl p-2.5 flex items-center gap-2.5">
                  <span className="text-[22px]">{p.emoji}</span>
                  <div className="flex-1 min-w-0">
                    <div className="text-[12px] font-bold text-[#f0f0f0] truncate">{p.nombre}</div>
                    <div className="text-[10px] text-[#d4943a] font-bold">{p.precio} · {p.categoria}</div>
                  </div>
                  <div className="flex gap-1">
                    <button onClick={() => agregarAOrden({ ...p })} className="px-2 py-1.5 rounded-lg bg-[#d4943a]/15 border border-[#d4943a]/30 text-[#d4943a] text-[9px] font-bold hover:bg-[#d4943a]/25 transition-all">+ Orden</button>
                    <button onClick={() => marcharAhora({ ...p })} className="px-2 py-1.5 rounded-lg bg-[#4a8fd4]/15 border border-[#4a8fd4]/30 text-[#4a8fd4] text-[9px] font-bold hover:bg-[#4a8fd4]/25 transition-all">🔥</button>
                    <button onClick={() => { setMiMenu(prev => prev.filter(x => x.id !== p.id)); showToast('Plato eliminado'); }} className="px-2 py-1.5 rounded-lg bg-[#e05050]/10 border border-[#e05050]/20 text-[#e05050] text-[9px] font-bold hover:bg-[#e05050]/20 transition-all">✕</button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {rightTab === 'Intel' && (
            <div className="flex flex-col gap-3">

              {/* ══ TICKET DEL DÍA ══ */}
              <div className="bg-[#1c1c1c] border border-[#22d3ee]/30 rounded-xl overflow-hidden">
                <div className="px-3 py-2 flex items-center gap-2 border-b border-[#2a2a2a]">
                  <BarChart3 size={13} className="text-[#22d3ee]"/>
                  <span className="text-[10px] font-black text-[#22d3ee] uppercase tracking-wider">Ticket del Día</span>
                </div>
                <div className="p-3 grid grid-cols-2 gap-2">
                  {[
                    { l:'Ventas', v:`$${Math.round((ticketDia?.total_ventas||0)/1000)}k`, c:'#22d3ee' },
                    { l:'Órdenes', v:ticketDia?.total_ordenes||0, c:'#3dba6f' },
                    { l:'Items', v:ticketDia?.total_items||0, c:'#d4943a' },
                    { l:'Mesas', v:ticketDia?.mesas_atendidas||0, c:'#9b72ff' },
                  ].map(k=>(
                    <div key={k.l} style={{background:'#141414',borderRadius:8,padding:'8px 10px'}}>
                      <div style={{fontSize:9,color:'#606060',marginBottom:2,textTransform:'uppercase' as const}}>{k.l}</div>
                      <div style={{fontFamily:"'Syne',sans-serif",fontSize:18,fontWeight:900,color:k.c}}>{k.v}</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* ══ CUENTAS POR COBRAR ══ */}
              <div className="bg-[#1c1c1c] border border-[#d4943a]/30 rounded-xl overflow-hidden">
                <div className="px-3 py-2 flex items-center justify-between border-b border-[#2a2a2a]">
                  <div className="flex items-center gap-2">
                    <Receipt size={13} className="text-[#d4943a]"/>
                    <span className="text-[10px] font-black text-[#d4943a] uppercase tracking-wider">Cuentas por Cobrar</span>
                  </div>
                  <span style={{background:'rgba(212,148,58,0.15)',border:'1px solid rgba(212,148,58,0.3)',borderRadius:20,padding:'2px 10px',fontSize:11,fontWeight:900,color:'#f0b45a'}}>{cuentasCobrar} mesas</span>
                </div>
                <div className="p-3">
                  <div style={{fontFamily:"'Syne',sans-serif",fontSize:26,fontWeight:900,color:'#f0b45a',marginBottom:6}}>
                    ${(1455088).toLocaleString('es-CO')}
                  </div>
                  <div style={{fontSize:10,color:'#606060',marginBottom:10}}>Total acumulado órdenes abiertas</div>
                  {/* Mesas con orden abierta */}
                  <div className="flex flex-wrap gap-1.5">
                    {displayTables.filter(t=>t.estado==='ocupada'||t.ticket>0).map(t=>(
                      <div key={t.id} style={{background:'rgba(212,148,58,0.1)',border:'1px solid rgba(212,148,58,0.25)',borderRadius:8,padding:'4px 10px',fontSize:10,fontWeight:700,color:'#d4943a',cursor:'pointer'}}
                        onClick={()=>{ setSelectedTableId(t.id); setRightTab('Cuenta'); }}>
                        M{t.num} · ${Math.round(t.ticket/1000)}k
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* ══ TIPS DE VENTA — STOCK ALTO / 86 ══ */}
              <div className="bg-[#1c1c1c] border border-[#3dba6f]/30 rounded-xl overflow-hidden">
                <div className="px-3 py-2 flex items-center gap-2 border-b border-[#2a2a2a]">
                  <Sparkles size={13} className="text-[#3dba6f]"/>
                  <span className="text-[10px] font-black text-[#3dba6f] uppercase tracking-wider">Tips de Venta · Supply</span>
                </div>
                <div className="p-2 flex flex-col gap-1.5">
                  {tipsVenta.length===0&&(
                    <div style={{fontSize:11,color:'#606060',textAlign:'center',padding:'12px 0'}}>
                      ✓ Sin alertas de stock
                    </div>
                  )}
                  {/* Platos del stockFlow con poco stock */}
                  {Object.entries(stockFlow).filter(([,v])=>v<=6).slice(0,4).map(([name,qty])=>(
                    <div key={name} style={{display:'flex',alignItems:'center',gap:8,padding:'6px 8px',background:qty<=0?'rgba(224,80,80,0.08)':'rgba(240,180,90,0.08)',borderRadius:8,border:`1px solid ${qty<=0?'rgba(224,80,80,0.2)':'rgba(240,180,90,0.2)'}`}}>
                      <span style={{fontSize:14}}>{qty<=0?'🚫':'⚠️'}</span>
                      <div style={{flex:1,minWidth:0}}>
                        <div style={{fontSize:11,fontWeight:700,color:'#f0f0f0',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{name}</div>
                        <div style={{fontSize:9,color:qty<=0?'#e05050':'#f0b45a'}}>{qty<=0?'86 — No disponible':`Stock bajo: ${qty} unidades`}</div>
                      </div>
                      {qty>0&&<span style={{fontSize:10,color:'#3dba6f',background:'rgba(61,186,111,0.1)',padding:'2px 8px',borderRadius:10,fontWeight:700,cursor:'pointer',flexShrink:0}}
                        onClick={()=>{ addToOrder({nombre:name,precio:'$0',emoji:'🍽️'}); showToast(`✓ ${name} → vender hoy`); }}>
                        Sugerir
                      </span>}
                    </div>
                  ))}
                  {tipsVenta.slice(0,3).map((m:any)=>(
                    <div key={m.id} style={{display:'flex',alignItems:'center',gap:8,padding:'6px 8px',background:'rgba(61,186,111,0.06)',borderRadius:8,border:'1px solid rgba(61,186,111,0.15)'}}>
                      <span style={{fontSize:14}}>{m.emoji||'🍽️'}</span>
                      <div style={{flex:1,minWidth:0}}>
                        <div style={{fontSize:11,fontWeight:700,color:'#f0f0f0',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{m.name}</div>
                        <div style={{fontSize:9,color:'#3dba6f'}}>Mover hoy · Stock: {m.stock_actual}</div>
                      </div>
                      <span style={{fontSize:10,color:'#3dba6f',fontWeight:700,flexShrink:0}}>Recomendar</span>
                    </div>
                  ))}
                  {/* Botón crear alerta manual */}
                  <button onClick={async()=>{
                    const msg = prompt('Mensaje de alerta para el equipo:');
                    if(msg){
                      await supabase.from('nexum_notificaciones').insert({
                        restaurante_id:6,tipo:'operaciones',titulo:'Alerta de operaciones',
                        mensaje:msg,prioridad:'alta',creado_por:profile?.nombre_completo||'Staff'
                      });
                      showToast('✓ Alerta enviada al equipo');
                      setNotifsBadge(p=>p+1);
                    }
                  }} style={{width:'100%',padding:'8px',borderRadius:10,border:'1px dashed rgba(61,186,111,0.3)',background:'transparent',color:'#3dba6f',fontSize:10,fontWeight:700,cursor:'pointer',marginTop:4}}>
                    + Crear alerta para el equipo
                  </button>
                </div>
              </div>

              {/* ══ PUNTOS POR PEDIDO ══ */}
              <div className="bg-[#1c1c1c] border border-[#9b72ff]/30 rounded-xl overflow-hidden">
                <div className="px-3 py-2 flex items-center gap-2 border-b border-[#2a2a2a]">
                  <span style={{fontSize:12}}>⭐</span>
                  <span className="text-[10px] font-black text-[#9b72ff] uppercase tracking-wider">Puntos por Pedido</span>
                </div>
                <div className="p-3">
                  <div style={{fontSize:11,color:'#a0a0a0',marginBottom:10,lineHeight:1.5}}>
                    Cada plato suma <b style={{color:'#9b72ff'}}>10 puntos</b> al perfil del cliente.
                    Las bebidas suman <b style={{color:'#9b72ff'}}>5 puntos</b>.
                  </div>
                  <div style={{display:'flex',flexDirection:'column',gap:6}}>
                    {[
                      {icon:'🍽️',label:'Plato principal',pts:10,color:'#9b72ff'},
                      {icon:'🍸',label:'Cóctel / Bebida',pts:5,color:'#4a8fd4'},
                      {icon:'🍮',label:'Postre',pts:8,color:'#f0b45a'},
                      {icon:'⭐',label:'Plato especial',pts:20,color:'#d4943a'},
                    ].map(r=>(
                      <div key={r.label} style={{display:'flex',alignItems:'center',gap:8,padding:'6px 10px',background:'rgba(155,114,255,0.06)',borderRadius:8,border:'1px solid rgba(155,114,255,0.12)'}}>
                        <span style={{fontSize:16}}>{r.icon}</span>
                        <span style={{flex:1,fontSize:11,color:'#f0f0f0'}}>{r.label}</span>
                        <span style={{fontSize:11,fontWeight:900,color:r.color}}>+{r.pts} pts</span>
                      </div>
                    ))}
                  </div>
                  {/* Puntos mesa actual */}
                  {order.filter(o=>o.mesa===selectedTable.num).length>0&&(
                    <div style={{marginTop:10,background:'rgba(155,114,255,0.1)',border:'1px solid rgba(155,114,255,0.25)',borderRadius:10,padding:'8px 12px',textAlign:'center'}}>
                      <div style={{fontSize:10,color:'#9b72ff',marginBottom:2}}>Esta mesa generará</div>
                      <div style={{fontFamily:"'Syne',sans-serif",fontSize:20,fontWeight:900,color:'#b388ff'}}>
                        {order.filter(o=>o.mesa===selectedTable.num).length * 10} pts
                      </div>
                      <div style={{fontSize:9,color:'#606060'}}>para {selectedTable.cliente}</div>
                    </div>
                  )}
                </div>
              </div>

              {/* ══ ACCESO MAÎTRE ══ */}
              <div className="bg-[#1c1c1c] border border-[#e05050]/20 rounded-xl overflow-hidden">
                <div className="px-3 py-2 flex items-center justify-between border-b border-[#2a2a2a]">
                  <div className="flex items-center gap-2">
                    <ShieldCheck size={13} className="text-[#e05050]"/>
                    <span className="text-[10px] font-black text-[#e05050] uppercase tracking-wider">Acceso Maître</span>
                  </div>
                </div>
                <div className="p-3 flex flex-col gap-2">
                  {[
                    {label:'Editar cuenta activa',icon:'✏️',action:()=>{ setRightTab('Cuenta'); showToast('Ve al tab Cuenta para editar'); }},
                    {label:'Aplicar descuento',icon:'🎫',action:()=>requirePin(()=>showToast('✓ Descuento habilitado por Maître'))},
                    {label:'Cerrar mesa sin cobro',icon:'🔓',action:()=>requirePin(()=>showToast('✓ Mesa cerrada — registrado por Maître'))},
                    {label:'Enviar alerta a caja',icon:'📢',action:async()=>{
                      await supabase.from('nexum_notificaciones').insert({restaurante_id:6,tipo:'maître',titulo:'Aviso de Maître',mensaje:`Mesa ${selectedTable.num} requiere revisión`,prioridad:'alta',mesa_numero:selectedTable.num,creado_por:'Maître'});
                      showToast('✓ Caja notificada');
                    }},
                  ].map(a=>(
                    <button key={a.label} onClick={a.action}
                      style={{display:'flex',alignItems:'center',gap:8,padding:'8px 10px',background:'rgba(224,80,80,0.05)',border:'1px solid rgba(224,80,80,0.15)',borderRadius:8,cursor:'pointer',width:'100%',textAlign:'left' as const}}>
                      <span style={{fontSize:14}}>{a.icon}</span>
                      <span style={{fontSize:11,color:'#f0f0f0',fontWeight:600}}>{a.label}</span>
                      <span style={{marginLeft:'auto',fontSize:10,color:'#606060'}}>🔐 PIN</span>
                    </button>
                  ))}
                </div>
              </div>

            </div>
          )}

          {rightTab === 'Chat' && (
            <div className="flex flex-col h-full">
              <div className="flex gap-1.5 mb-3 flex-wrap">
                {(['Mesero','Cocina','Host','Maître'] as const).map(rol => {
                  const colors: Record<string,string> = { Mesero:'#4a8fd4', Cocina:'#e05050', Host:'#3dba6f', Maître:'#9b72ff' };
                  return (
                    <button key={rol} onClick={() => setChatRol(rol)}
                      style={{ borderColor: chatRol===rol ? colors[rol] : '#2a2a2a', background: chatRol===rol ? colors[rol]+'18' : 'transparent', color: chatRol===rol ? colors[rol] : '#606060' }}
                      className="flex-1 py-1 rounded-lg border text-[10px] font-bold transition-all">
                      {rol}
                    </button>
                  );
                })}
              </div>
              <div className="flex-1 overflow-y-auto flex flex-col gap-2 mb-3 pr-1">
                {chatHistory.map((msg, idx) => {
                  const colorMap: Record<string,string> = { Cocina:'#e05050', Host:'#3dba6f', Maître:'#9b72ff', Mesero:'#4a8fd4', Tú:'#4a8fd4' };
                  const c = colorMap[msg.sender] ?? '#a0a0a0';
                  const isMine = msg.sender === 'Tú' || msg.sender === 'Mesero';
                  return (
                    <div key={idx} className={`flex flex-col ${isMine ? 'items-end' : 'items-start'}`}>
                      <span className="text-[10px] mb-0.5" style={{ color: c+'99' }}>{msg.sender} • {msg.time}</span>
                      <div className="p-2 px-3 rounded-xl text-[12px] max-w-[90%]"
                        style={{ background: c+'12', border: `1px solid ${c}30`, color: '#f0f0f0', borderBottomRightRadius: isMine ? 4 : 12, borderBottomLeftRadius: isMine ? 12 : 4 }}>
                        {msg.msg}
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="mt-auto flex gap-2">
                <input type="text" value={chatMessage} onChange={e => setChatMessage(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter' && chatMessage.trim()) { setChatHistory(prev => [...prev, { sender: chatRol, msg: chatMessage, time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) }]); setChatMessage(''); } }}
                  placeholder={`Mensaje como ${chatRol}...`}
                  className="flex-1 bg-[#1c1c1c] border border-[#2a2a2a] rounded-lg px-3 py-2 text-[12px] text-[#f0f0f0] outline-none focus:border-[#4a8fd4]" />
                <button onClick={() => { if (chatMessage.trim()) { setChatHistory(prev => [...prev, { sender: chatRol, msg: chatMessage, time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) }]); setChatMessage(''); } }}
                  className="w-9 h-9 rounded-lg bg-[#4a8fd4] text-white flex items-center justify-center hover:bg-[#3d7fc4] transition-all active:scale-95">
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
