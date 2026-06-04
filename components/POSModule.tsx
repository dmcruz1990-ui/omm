import React, { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../lib/supabase.ts';
import { Table, RitualTask } from '../types.ts';
import { BellRing, Settings, MonitorPlay, MessageSquare, Sparkles, Receipt, X, ShoppingCart, Lock, Zap, BarChart3, ShieldCheck, Brain, ChevronDown, ChevronUp } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useRestaurant } from '../contexts/RestaurantContext';
import { ZONAS_POR_RESTAURANTE, VW_PLANO, VH_PLANO, sizeForMesa } from './PlanoOMM.tsx';

// ── Cerebro POS: persistencia de las 15 mesas ────────────────────────
// Conserva pedidos (enviados + pendientes), cliente y notas por mesa
// aunque se refresque la página o se cambie de módulo. Una mesa solo se
// limpia cuando se termina su cobro.
const POS_STATE_KEY = 'nexum_pos_state_v1';
const loadPosState = (): any => {
  try { return JSON.parse(localStorage.getItem(POS_STATE_KEY) || '{}') || {}; }
  catch { return {}; }
};
const savePosState = (data: any) => {
  try { localStorage.setItem(POS_STATE_KEY, JSON.stringify(data)); } catch {}
};

// ══ PLANTA OMM — constantes globales del mapa de mesas ══════════════
// ── PLANO OMM — layout fiel al plano arquitectónico ──────────────────────
// 15 mesas reales distribuidas en: Barra Sushi · Salón · Ventanal · Torre Bar
const PLANTA_OMM: Record<string,{num:number;zona:string;shape:'round'|'rect';cap:number;x:number;y:number;w:number;h:number}> = {
  // Barra Sushi — el counter, 2 tramos
  BS1:{num:1, zona:'Barra Sushi', shape:'rect', cap:7, x:35,y:27,w:15,h:7.5},
  BS2:{num:2, zona:'Barra Sushi', shape:'rect', cap:7, x:51,y:27,w:15,h:7.5},
  // Salón — cluster de redondas zona lounge
  S3:{num:3, zona:'Salón', shape:'round', cap:4, x:15,y:49,w:9,h:13},
  S4:{num:4, zona:'Salón', shape:'round', cap:4, x:26,y:49,w:9,h:13},
  S5:{num:5, zona:'Salón', shape:'round', cap:4, x:15,y:65,w:9,h:13},
  S6:{num:6, zona:'Salón', shape:'round', cap:2, x:27,y:66,w:8,h:11},
  // Salón centro
  S7:{num:7, zona:'Salón', shape:'round', cap:4, x:40,y:47,w:9.5,h:13},
  S8:{num:8, zona:'Salón', shape:'round', cap:4, x:52,y:47,w:9.5,h:13},
  // Mesa comunal — la mesa larga central
  C9:{num:9, zona:'Salón', shape:'rect', cap:12, x:40,y:63,w:22,h:14},
  S10:{num:10,zona:'Salón', shape:'round', cap:4, x:64,y:49,w:9.5,h:13},
  // Ventanal — 2-tops sobre el ventanal
  V11:{num:11,zona:'Ventanal', shape:'round', cap:2, x:40,y:84,w:7.5,h:11},
  V12:{num:12,zona:'Ventanal', shape:'round', cap:2, x:50,y:84,w:7.5,h:11},
  V13:{num:13,zona:'Ventanal', shape:'round', cap:2, x:60,y:84,w:7.5,h:11},
  // Torre Bar — lounge bar, 2 tramos
  TB14:{num:14,zona:'Torre Bar', shape:'rect', cap:6, x:74,y:61,w:11,h:11},
  TB15:{num:15,zona:'Torre Bar', shape:'rect', cap:6, x:74,y:74,w:11,h:11},
};
const ZONA_AREAS_OMM: Record<string,{x:number;y:number;w:number;h:number}> = {
  'Barra Sushi':{x:33,y:22,w:35,h:17},
  'Salón':      {x:11,y:43,w:64,h:38},
  'Ventanal':   {x:36,y:81,w:37,h:16},
  'Torre Bar':  {x:71,y:54,w:26,h:39},
};
const ZONA_COLS_OMM: Record<string,{bg:string;border:string;icon:string}> = {
  'Barra Sushi':{bg:'rgba(68,139,255,0.05)',border:'rgba(68,139,255,0.20)',icon:'🍣'},
  'Salón':      {bg:'rgba(255,255,255,0.02)',border:'rgba(255,255,255,0.07)',icon:'🪑'},
  'Ventanal':   {bg:'rgba(34,211,238,0.05)',border:'rgba(34,211,238,0.18)',icon:'🌅'},
  'Torre Bar':  {bg:'rgba(155,114,255,0.06)',border:'rgba(155,114,255,0.22)',icon:'🍸'},
};


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
  // Campos opcionales para semáforo de tiempos (verde/amarillo/rojo)
  // y alertas de bebidas. Se llenan cuando el plato se marcha.
  created_at?: string;       // ISO timestamp de cuando se envió a cocina
  estacion?: string;         // cocina_caliente|cocina_fria|bar|robata|postres|cava
  categoria?: string;        // categoría del menú (para mapear estación)
  tipo?: 'comida'|'bebida';  // alimenta alerta de bebida a los 40min
  carne?: boolean;
}

// Objetivos de tiempo por estación (en segundos). Mismo set que Flow.
// Se usan para pintar el semáforo en el panel izquierdo del POS.
const ESTACIONES_OBJETIVO: Record<string, number> = {
  cocina_caliente: 480, // 8 min
  cocina_fria:     360, // 6 min
  robata:          600, // 10 min
  postres:         300, // 5 min
  bar:             180, // 3 min
  cava:            120, // 2 min
};

// Inferir estación a partir del nombre y categoría. Cubre vocabulario
// OMM (japonés-latino) y Gallo Colorado (mexicano).
const inferirEstacionFromNombre = (nombre: string, cat: string): string => {
  const n = (nombre + ' ' + cat).toUpperCase();
  if (['ROBATA','YAKITORI','BRASA'].some(k => n.includes(k))) return 'robata';
  if (['COCTEL','CÓCTEL','GIN','RUM','WHISKY','VODKA','SAKE','CERVEZA','JUGO','LIMONADA','CAFÉ','LATTE','AMERICANO',
       'TEQUILA','MEZCAL','MARGARITA','MICHELADA','JARRA','MEZCALERÍA','PALOMA','CACTUS','AGUARDIENTE','RON ','BACARDI',
       'JAGERMEISTER','BAILEYS','FRANGELICO','AMARETTO','LIMONCELLO','JIMADOR','PATRÓN','MACALLAN','BUCHANANS','TANQUERAY','BOMBAY','HENDRICKS','SKYY','GREY GOOSE','PARCE','SANTA TERESA','DEWARS','JW ','JACK DANIELS','LICOR','AGUA DE'].some(k => n.includes(k))) return 'bar';
  if (['VINO','COPA','CAVA','CHAMPAGNE','PROSECCO'].some(k => n.includes(k))) return 'cava';
  if (['POSTRE','CHEESECAKE','MOCHI','HELADO','YOROKOBI','KYOTO','PIE','TARTA','FLAN','QUESADILLA DULCE','CHURRO'].some(k => n.includes(k))) return 'postres';
  if (['MAKI','SUSHI','NIGIRI','SASHIMI','TEMAKI','TIRADITO','CEVICHE','TATAKI','CARPACCIO',
       'GUACAMOLE','TOSTA','AGUACHILE','ENSALADA','DEL CAMPO'].some(k => n.includes(k))) return 'cocina_fria';
  return 'cocina_caliente';
};

// Devuelve el estado del semáforo: verde / amarillo / rojo.
//   verde  → menos del 70% del objetivo
//   amarillo → 70%-100% (o entre 5min y objetivo si objetivo<5min)
//   rojo  → supera el objetivo, o más de 5min sin avance estando en cola
const getSemaforo = (createdAtISO: string | undefined, estacion: string | undefined): 'verde'|'amarillo'|'rojo' => {
  if (!createdAtISO) return 'verde';
  const seg = Math.floor((Date.now() - new Date(createdAtISO).getTime()) / 1000);
  const objetivo = ESTACIONES_OBJETIVO[estacion || 'cocina_caliente'] || 480;
  if (seg >= objetivo) return 'rojo';
  if (seg >= Math.max(300, objetivo * 0.7)) return 'amarillo'; // 5min o 70% del objetivo
  return 'verde';
};

// Prefijo de mesa por zona — el mesero las identifica al instante:
//   Salón → M (Mesa 1, 2…)
//   Entrada → E   ·   Terraza → T   ·   Barra → B
//   VIP / Privado → V   ·   Eventos → X   ·   Sushi / Robata → S
const getPrefijoZona = (zona?: string): string => {
  if (!zona) return 'M';
  const z = zona.toLowerCase();
  if (z.includes('entrada') || z.includes('lobby')) return 'E';
  if (z.includes('terraza') || z.includes('jardín') || z.includes('jardin') || z.includes('exterior')) return 'T';
  if (z.includes('barra') || z.includes('bar ') || z === 'bar') return 'B';
  if (z.includes('vip') || z.includes('privado') || z.includes('reservad')) return 'V';
  if (z.includes('evento') || z.includes('salón privado') || z.includes('salon privado')) return 'X';
  if (z.includes('sushi') || z.includes('robata')) return 'S';
  if (z.includes('ventanal') || z.includes('ventana')) return 'W';
  return 'M';
};
const nombreMesa = (m: any): string => `${getPrefijoZona(m?.zona)}${m?.num ?? '?'}`;

// ── Tiempo desde la última marca de la mesa (en min)
//   Si nunca marchó, devuelve Infinity para que aparezca primero al ordenar
const minutosSinMarchar = (mesaNum: number, pedidosOrder: any[]): number => {
  const items = pedidosOrder.filter(o => o.mesa === mesaNum && o.created_at);
  if (items.length === 0) return Infinity;
  const ultimo = Math.max(...items.map(o => new Date(o.created_at).getTime()));
  return (Date.now() - ultimo) / 60000;
};

interface POSModal {
  open: boolean;
  title: string;
  content: React.ReactNode;
}

// Fallback OMM si BD no responde — el POS carga la carta dinámica
// desde menu_platos según el restaurante activo (ver useEffect cargarCarta).
const CATEGORIAS_OMM_FALLBACK = ['Compartir','Robata','Wok','Makis','Sashimis','Nigiris','Geishas','Temakis','Postres','Cocteles','Sin Alcohol','Jugos','Café','Cervezas','Sakes'];

// Términos de cocción disponibles
const TERMINOS_COCCION = ['3/4', 'Término Medio', 'Bien Cocido', 'Poco Cocido', 'Azul'];

// Tags rápidos para observaciones del plato (alergias y preferencias)
const TAGS_OBSERVACIONES = ['sin sal','sin leche','sin gluten','sin maní','sin cebolla','sin cilantro','sin azúcar','sin picante','extra picante','sin lácteos','vegano','vegetariano','sin mariscos','sin huevo','sin trigo','alergia'];

// Modal de término + observaciones · tags + texto libre
function TerminoObservModal({ producto, modo, onClose, onConfirm }:{
  producto:any; modo:'orden'|'marchar'; onClose:()=>void;
  onConfirm:(termino:string|undefined, observ:string, tags:string[])=>void;
}) {
  const [termino, setTermino] = React.useState<string|undefined>(undefined);
  const [tags, setTags] = React.useState<string[]>([]);
  const [observ, setObserv] = React.useState('');
  const requiereTermino = String(producto?.nombre||'').toLowerCase().match(/wagy|res|carne|pulpo|salm|atun|atún|filete|lomo|steak|tarta|chuleta|chuletón/);
  const toggleTag = (t:string) => setTags(p => p.includes(t) ? p.filter(x=>x!==t) : [...p, t]);
  const confirmar = () => {
    if (requiereTermino && !termino) { alert('Seleccioná un término de cocción'); return; }
    onConfirm(termino, observ.trim(), tags);
  };
  return (
    <div className="fixed inset-0 bg-black/80 z-[600] flex items-center justify-center p-4" onClick={onClose}>
      <div onClick={e=>e.stopPropagation()} className="bg-[#1c1c1c] border border-[#d4943a]/30 rounded-2xl p-5 w-full max-w-[440px] max-h-[92vh] overflow-y-auto">
        <div className="text-center mb-4">
          <div className="text-[28px] mb-1">{producto.emoji}</div>
          <div className="font-['Syne'] text-[16px] font-bold">{producto.nombre}</div>
          <div className="text-[10px] text-[#606060] mt-1 uppercase tracking-widest">{modo==='marchar'?'Marchar a cocina':'Agregar a orden'}</div>
        </div>
        {requiereTermino && (
          <>
            <div className="text-[10px] uppercase tracking-wider font-bold mb-2" style={{color:'#FF5C53'}}>Término de cocción *</div>
            <div className="grid grid-cols-3 gap-1.5 mb-4">
              {TERMINOS_COCCION.map(t => (
                <button key={t} onClick={()=>setTermino(t)}
                  className="py-2 px-2 rounded-lg text-[10px] font-bold transition-all"
                  style={{background: termino===t?'#FF5C5318':'#0d0d0d', border:`1px solid ${termino===t?'#FF5C53':'#2a2a2a'}`, color: termino===t?'#FF5C53':'#a0a0a0', cursor:'pointer'}}>
                  {t}
                </button>
              ))}
            </div>
          </>
        )}
        <div className="text-[10px] uppercase tracking-wider font-bold mb-2" style={{color:'#9b72ff'}}>⚠️ Alergias / preferencias (tags)</div>
        <div className="flex flex-wrap gap-1 mb-3">
          {TAGS_OBSERVACIONES.map(t => (
            <button key={t} onClick={()=>toggleTag(t)}
              className="px-2 py-1 rounded-md text-[9px] font-bold transition-all"
              style={{background: tags.includes(t)?'#9b72ff20':'#0d0d0d', border:`1px solid ${tags.includes(t)?'#9b72ff':'#2a2a2a'}`, color: tags.includes(t)?'#9b72ff':'#808080', cursor:'pointer'}}>
              {tags.includes(t)?'✓ ':''}{t}
            </button>
          ))}
        </div>
        <div className="text-[10px] uppercase tracking-wider font-bold mb-2" style={{color:'#3dba6f'}}>💬 Comentario (opcional)</div>
        <textarea value={observ} onChange={e=>setObserv(e.target.value)} rows={2}
          placeholder="Ej: bien dorado, sin guarnición de papas, mesa con niños..."
          className="w-full px-2 py-2 rounded-lg text-[12px] mb-4 resize-none"
          style={{background:'#0d0d0d',border:'1px solid #2a2a2a',color:'#f0f0f0',outline:'none'}}/>
        <div className="flex gap-2">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-[#2a2a2a] text-[#606060] text-[11px] font-semibold">Cancelar</button>
          <button onClick={confirmar} className="flex-[2] py-2.5 rounded-xl text-[12px] font-bold text-white"
            style={{background:'linear-gradient(135deg,#d4943a,#9b72ff)'}}>
            {modo==='marchar'?'🔥 Marchar a cocina':'+ Agregar a orden'}
          </button>
        </div>
      </div>
    </div>
  );
}

// Niveles de picante (Gallo Colorado). El nombre del plato se sufija para
// que cocina y bar lo vean en el KDS, ej: "Taco al Pastor 🌶️🌶️ Temible".
const NIVELES_PICANTE: { key: string; emoji: string; label: string; desc: string }[] = [
  { key: '🐣 Gallinita', emoji: '🐣', label: 'Gallinita', desc: 'Sin picante' },
  { key: '🌶️ Colorado',  emoji: '🌶️', label: 'Colorado',  desc: 'Picante suave' },
  { key: '🌶️🌶️ Temible', emoji: '🌶️🌶️', label: 'Temible',  desc: 'Picante fuerte' },
  { key: '🔥 Ardiente',  emoji: '🔥', label: 'Ardiente',  desc: 'Extremo · solo valientes' },
];
const CATEGORIAS_CON_PICANTE = new Set([
  'Sopas','Del Campo','Del Mar','Esquites','Nachos','Tacos','Fuertes',
]);

const PRODUCTOS_OMM_FALLBACK: Record<string, any[]> = {
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

// clienteData mock eliminado — el POS usa datos reales de la reserva (clientesPorMesa)

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

// ── Clasificador comida vs bebida usando el menú real ───────────
// Cubre categorías de OMM y Gallo Colorado.
const CATEGORIAS_BEBIDA = ['Cocteles','Sin Alcohol','Jugos','Café','Cervezas','Sakes',
  'Cocteles de Autor','Margaritas de Autor','Mezcalería','Micheladas','Jarras','Aguas Frescas',
  'Tequila y Mezcal','Blend & Bourbon','Vodka','Aguardiente','Gin','Single Malt','Ron','Otros Licores'];
const _ITEM_INDEX: Record<string, 'comida'|'bebida'> = (() => {
  const idx: Record<string, 'comida'|'bebida'> = {};
  Object.entries(PRODUCTOS_OMM_FALLBACK).forEach(([cat, items]) => {
    const tipo: 'comida'|'bebida' = CATEGORIAS_BEBIDA.includes(cat) ? 'bebida' : 'comida';
    (items as any[]).forEach(p => { idx[p.nombre.toLowerCase()] = tipo; });
  });
  return idx;
})();
const clasificarItem = (nombre: string): 'comida'|'bebida' => {
  const k = nombre.toLowerCase();
  if (_ITEM_INDEX[k]) return _ITEM_INDEX[k];
  // Fallback heurístico cuando el plato no está en el menú base
  const bebidaHints = ['cóctel','coctel','vino','copa','sake','cerveza','heineken','corona','stella','club colombia','café','espresso','americano','capuccino','latte','té ','limonada','jugo','agua','gin','whisky','old fashion','infinito','samhain','mojito','yin peng','moscow mule','flor de sakura','raito','haku',
    // Gallo Colorado: cocteles, tequila, mezcal, ron, etc.
    'tequila','mezcal','margarita','michelada','jarra','ron','vodka','aguardiente','jagermeister','baileys','frangelico','licor','amaretto','limoncello','jimador','patrón','jw ','dewars','buchanans','jack daniels','grey goose','skyy','bacardi','santa teresa','macallan','tanqueray','bombay','hendricks','paloma','pitaya','hibiscus','gulupa','penicilina','chipote','cántaro','cactus','gallo','agua de jamaica','agua de tamarindo','agua de mango'];
  return bebidaHints.some(h => k.includes(h)) ? 'bebida' : 'comida';
};

// ── Componente independiente para la ruleta ───────────────
const PREMIOS_RULETA = [
  { emoji:'☕', label:'Café gratis',   color:'#cd853f', bg:'#3d2a1a', desc:'Un espresso en tu próxima visita' },
  { emoji:'🍷', label:'Copa de vino',  color:'#e91e8c', bg:'#3d0d25', desc:'Una copa de la casa en tu próxima visita' },
  { emoji:'💸', label:'10% OFF',       color:'#d4943a', bg:'#3d2a00', desc:'10% descuento en tu próxima cuenta' },
  { emoji:'🍮', label:'Postre gratis', color:'#f0b45a', bg:'#3d2d00', desc:'El postre del chef — cortesía de OMM' },
  { emoji:'🥂', label:'2x1 Coctel',    color:'#9b72ff', bg:'#1e1040', desc:'Dos cócteles por el precio de uno' },
  { emoji:'🎁', label:'20% OFF',       color:'#3dba6f', bg:'#0d3020', desc:'Descuento especial OMM · Válido 30 días' },
  { emoji:'🥧', label:'Pie Central',   color:'#e07830', bg:'#3d1a00', desc:'Pie Central de cortesía — postre insignia' },
  { emoji:'🍸', label:'Cóctel Firma',  color:'#448AFF', bg:'#001440', desc:'Cóctel insignia OMM de cortesía' },
];

// Cartas especiales — nunca están en el pool de premios; solo salen al picar
// con probabilidad muy baja: pierde todo 0.01%, intenta otra vez 0.5%.
const PREMIO_PIERDE  = { emoji:'💀', label:'Pierde todo',      color:'#ff5252', bg:'#2a0808', desc:'Esta vez no hubo suerte — ¡vuelve pronto!', special:'pierde' as const };
const PREMIO_REINTENTO = { emoji:'🔄', label:'Intenta otra vez', color:'#FFB547', bg:'#2a1f00', desc:'¡Casi! Pica de nuevo', special:'reintento' as const };
const PROB_PIERDE = 0.0001;   // 0.01%
const PROB_REINTENTO = 0.005; // 0.5%

// Baraja una copia del arreglo (Fisher–Yates).
const barajar = <T,>(a: T[]): T[] => {
  const b = [...a];
  for (let i = b.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [b[i], b[j]] = [b[j], b[i]]; }
  return b;
};

const RuletaPremios: React.FC<{ onClose: () => void; mesaNum: number; rating: number }> = ({ onClose, mesaNum, rating }) => {
  const [spinning, setSpinning] = useState(false);
  const [selected, setSelected] = useState<number|null>(null);
  const [rotation, setRotation] = useState(0);
  const [particles, setParticles] = useState<{x:number;y:number;c:string;id:number;angle:number;dist:number}[]>([]);
  const [glowPulse, setGlowPulse] = useState(false);
  const [correoEnvio, setCorreoEnvio] = useState('');
  const [premioEnviado, setPremioEnviado] = useState(false);
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
    <div style={{ flex:1, overflowY:'auto', display:'flex', flexDirection:'column', alignItems:'center', padding:'60px 20px 32px', background: premio ? premio.bg : '#080810', transition:'background 1s', position:'relative', overflow:'hidden' }}>
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

// ── 6 CARTAS — mira los premios, se barajan, picas el tuyo ──
const CartasPremios: React.FC<{ onClose: () => void; mesaNum: number; rating: number }> = ({ onClose, mesaNum, rating }) => {
  const [cartas] = useState(() => [...PREMIOS_RULETA].sort(() => Math.random() - 0.5).slice(0, 6));
  // slots[posiciónEnGrid] = índice de carta — se baraja para que cambien de lugar
  const [slots, setSlots] = useState<number[]>(() => cartas.map((_, i) => i));
  // Fases: preview (premios visibles) → flip (voltear) → shuffle (barajar) → pick → done
  const [phase, setPhase] = useState<'preview'|'flip'|'shuffle'|'pick'|'done'>('preview');
  const [picked, setPicked] = useState<number|null>(null);
  const [resultado, setResultado] = useState<any>(null);
  const [offsets, setOffsets] = useState(()=>cartas.map(()=>({x:0,y:0,r:0,z:0})));
  const [particles, setParticles] = useState<{x:number;y:number;c:string;id:number;angle:number;dist:number}[]>([]);
  const [correoEnvio, setCorreoEnvio] = useState('');
  const [premioEnviado, setPremioEnviado] = useState(false);
  const pidRef = useRef(0);

  // Secuencia automática: ver premios → voltear → barajar → listo para picar
  useEffect(() => {
    const t: number[] = [];
    t.push(window.setTimeout(()=>setPhase('flip'), 2800));
    t.push(window.setTimeout(()=>setPhase('shuffle'), 3600));
    // 5 tandas de barajado: las cartas saltan de posición y, sobre todo,
    // intercambian su lugar real (slots) para que ya no se sepa cuál es cuál.
    [0,1,2,3,4].forEach(k=>{
      t.push(window.setTimeout(()=>{
        setSlots(prev => barajar(prev));
        setOffsets(cartas.map(()=> k===4
          ? {x:0,y:0,r:0,z:0}
          : {x:(Math.random()-0.5)*160, y:(Math.random()-0.5)*80, r:(Math.random()-0.5)*45, z:Math.floor(Math.random()*6)}));
      }, 3800 + k*430));
    });
    t.push(window.setTimeout(()=>setPhase('pick'), 3800 + 5*430));
    return ()=>t.forEach(clearTimeout);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const spawnConfetti = () => {
    const colors = ['#FFB547','#FF2D78','#00E676','#448AFF','#B388FF','#FF5252','#FFD700','#fff'];
    const ps = Array.from({length:50},(_,i)=>({
      x:50+(Math.random()-0.5)*30, y:45+(Math.random()-0.5)*20,
      c:colors[i%colors.length], id:pidRef.current++,
      angle:Math.random()*360, dist:80+Math.random()*120,
    }));
    setParticles(ps);
    setTimeout(()=>setParticles([]),2000);
  };

  const pickCard = (cardIdx: number) => {
    if (phase !== 'pick') return;
    // Tirada: cartas especiales con probabilidad baja, si no el premio de la carta.
    const r = Math.random();
    let outcome: any;
    if (r < PROB_PIERDE) outcome = PREMIO_PIERDE;
    else if (r < PROB_PIERDE + PROB_REINTENTO) outcome = PREMIO_REINTENTO;
    else outcome = cartas[cardIdx];
    setPicked(cardIdx);
    setResultado(outcome);
    setPhase('done');
    if (!outcome.special) setTimeout(spawnConfetti, 650);
  };

  // Volver a picar tras "Intenta otra vez".
  const reintentar = () => { setPicked(null); setResultado(null); setPhase('pick'); };

  const premio = resultado;
  const headerTxt = {
    preview: 'Estos son los premios',
    flip:    'Memoriza bien...',
    shuffle: '🔀 Barajando...',
    pick:    'Pica tu carta',
    done:    resultado?.special==='pierde' ? '¡Oh no!' : resultado?.special==='reintento' ? '¡Casi!' : '¡Ganaste!',
  }[phase];
  const headerSub = {
    preview: 'Míralos bien — en un momento se barajan',
    flip:    'Volteando las cartas',
    shuffle: 'Ya no sabes cuál es cuál...',
    pick:    'Tu intuición elige tu premio',
    done:    premio?.desc || '',
  }[phase];

  return (
    <div style={{ flex:1, overflowY:'auto', display:'flex', flexDirection:'column', alignItems:'center', padding:'60px 20px 32px', background: premio ? premio.bg : '#080810', transition:'background 1s', position:'relative', overflow:'hidden' }}>
      <style>{`
        @keyframes cardFloat{0%,100%{transform:translateY(0px)}50%{transform:translateY(-6px)}}
        @keyframes cardShine{0%{background-position:-200% 0}100%{background-position:200% 0}}
        @keyframes confettiFloat{0%{transform:translate(0,0) rotate(0deg) scale(1);opacity:1}100%{transform:translate(var(--tx),var(--ty)) rotate(var(--r)) scale(0);opacity:0}}
        @keyframes prizeReveal{0%{transform:scale(0) rotate(-10deg);opacity:0}60%{transform:scale(1.1) rotate(3deg)}100%{transform:scale(1) rotate(0deg);opacity:1}}
        @keyframes cardPickPulse{0%,100%{box-shadow:0 6px 24px rgba(255,45,120,0.35)}50%{box-shadow:0 6px 34px rgba(255,45,120,0.7)}}
      `}</style>

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
          {headerTxt}
        </div>
        <div style={{ fontSize:13, color:'rgba(255,255,255,.5)', marginTop:4 }}>
          {headerSub}
        </div>
      </div>

      {/* Grid 6 cartas */}
      <div style={{
        display:'grid',
        gridTemplateColumns:'repeat(3,1fr)',
        gap:14,
        width:'100%',
        maxWidth:340,
        marginBottom:24,
        zIndex:5,
      }}>
        {slots.map((cardIdx, pos) => {
          const c = cartas[cardIdx];
          // En la carta elegida y revelada se muestra el resultado (premio o especial).
          const face = (phase==='done' && picked===cardIdx && resultado) ? resultado : c;
          // Premio visible si: estamos en preview, o esta carta es la elegida ya revelada
          const showPrize = phase==='preview' || (phase==='done' && picked===cardIdx);
          const isOther = phase==='done' && picked!==cardIdx;
          const off = offsets[pos] || {x:0,y:0,r:0,z:0};
          return (
            <div key={cardIdx}
              onClick={() => pickCard(cardIdx)}
              style={{
                aspectRatio:'2/3',
                perspective:'1000px',
                cursor: phase==='pick' ? 'pointer' : 'default',
                opacity: isOther ? 0.2 : 1,
                zIndex: off.z,
                transform: `translate(${off.x}px,${off.y}px) rotate(${off.r}deg) scale(${isOther?0.9:1})`,
                transition: phase==='shuffle' ? 'transform .4s cubic-bezier(.5,.05,.5,.95)' : 'transform .45s ease, opacity .4s',
                animation: phase==='pick' ? `cardFloat 3s ease-in-out ${pos*0.2}s infinite` : 'none',
              }}>
              <div style={{
                position:'relative',
                width:'100%', height:'100%',
                transformStyle:'preserve-3d',
                transition:'transform 0.7s cubic-bezier(.34,1.56,.64,1)',
                transform: showPrize ? 'rotateY(180deg)' : 'rotateY(0deg)',
              }}>
                {/* Dorso */}
                <div style={{
                  position:'absolute', inset:0,
                  borderRadius:14,
                  background:'linear-gradient(135deg,#FF2D78 0%,#B388FF 100%)',
                  border:'2px solid rgba(255,255,255,0.2)',
                  boxShadow:'0 6px 24px rgba(255,45,120,0.35), inset 0 0 30px rgba(255,255,255,0.08)',
                  backfaceVisibility:'hidden',
                  display:'flex', alignItems:'center', justifyContent:'center',
                  overflow:'hidden',
                  animation: phase==='pick' ? 'cardPickPulse 1.8s ease-in-out infinite' : 'none',
                }}>
                  <div style={{
                    position:'absolute', inset:0,
                    background:'linear-gradient(110deg,transparent 35%,rgba(255,255,255,0.35) 50%,transparent 65%)',
                    backgroundSize:'200% 100%',
                    animation:'cardShine 2.5s linear infinite',
                  }}/>
                  <div style={{
                    fontFamily:"'Syne',sans-serif", fontSize:32, fontWeight:900,
                    color:'#fff', textShadow:'0 2px 12px rgba(0,0,0,0.4)',
                    letterSpacing:'.02em', zIndex:2,
                  }}>✦</div>
                </div>
                {/* Anverso (premio o resultado especial en la carta elegida) */}
                <div style={{
                  position:'absolute', inset:0,
                  borderRadius:14,
                  background:`linear-gradient(135deg,${face.color}40 0%,${face.color}15 100%)`,
                  border:`2px solid ${face.color}`,
                  boxShadow:`0 6px 24px ${face.color}50`,
                  backfaceVisibility:'hidden',
                  transform:'rotateY(180deg)',
                  display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center',
                  padding:6,
                }}>
                  <div style={{fontSize:42, filter:`drop-shadow(0 0 12px ${face.color})`, marginBottom:4}}>{face.emoji}</div>
                  <div style={{fontFamily:"'Syne',sans-serif", fontSize:12, fontWeight:900, color:face.color, textAlign:'center', lineHeight:1.1}}>{face.label}</div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Premio ganado */}
      {premio && phase==='done' && (
        <div style={{ background:`linear-gradient(135deg,${premio.color}20,${premio.color}08)`, border:`2px solid ${premio.color}60`, borderRadius:24, padding:'24px 32px', textAlign:'center', marginBottom:20, animation:'prizeReveal .6s cubic-bezier(.34,1.56,.64,1) forwards', boxShadow:`0 8px 40px ${premio.color}30`, zIndex:5 }}>
          <div style={{ fontSize:72, marginBottom:8, filter:`drop-shadow(0 0 20px ${premio.color})` }}>{premio.emoji}</div>
          <div style={{ fontFamily:"'Syne',sans-serif", fontSize:24, fontWeight:900, color:premio.color, marginBottom:6 }}>{premio.label}</div>
          <div style={{ fontSize:14, color:'rgba(255,255,255,.7)', marginBottom:10 }}>{premio.desc}</div>
          {!premio.special && (<>
          <div style={{ fontSize:11, color:'rgba(255,255,255,.35)', background:'rgba(255,255,255,.05)', borderRadius:8, padding:'6px 12px', marginBottom:10 }}>Muéstrale esta pantalla a tu mesero · Válido 30 días</div>
          {/* Card para mesero */}
          <div style={{background:`linear-gradient(135deg,${premio.color}30,${premio.color}10)`,border:`2px dashed ${premio.color}60`,borderRadius:14,padding:'14px 16px',marginBottom:12,textAlign:'center'}}>
            <div style={{fontSize:10,color:'rgba(255,255,255,.5)',fontWeight:700,textTransform:'uppercase',letterSpacing:'.1em',marginBottom:6}}>📲 Premio para el mesero</div>
            <div style={{fontSize:15,fontWeight:900,color:premio.color}}>{premio.emoji} {premio.label}</div>
            <div style={{fontSize:11,color:'rgba(255,255,255,.6)',marginTop:4}}>{premio.desc}</div>
          </div>
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
                    respuesta_ia:`PREMIO:${premio.label}|EMAIL:${correoEnvio}|JUEGO:cartas`
                  }).eq('mesa_numero',mesaNum).order('created_at',{ascending:false}).limit(1);
                  setPremioEnviado(true);
                }} style={{padding:'9px 14px',borderRadius:9,border:'none',background:`linear-gradient(135deg,${premio.color},${premio.color}cc)`,color:'#fff',fontSize:12,fontWeight:700,cursor:'pointer',whiteSpace:'nowrap'}}>
                  Enviar →
                </button>
              </div>
            </div>
          ):(
            <div style={{background:'rgba(0,230,118,0.1)',border:'1px solid rgba(0,230,118,0.3)',borderRadius:12,padding:'10px 14px',marginBottom:8,textAlign:'center',fontSize:13,color:'#00E676'}}>
              ✓ Premio enviado a {correoEnvio} — revisa tu Oh Yeah
            </div>
          )}
          </>)}
        </div>
      )}

      {/* Botones */}
      {phase==='done' && resultado?.special==='reintento' ? (
        <button onClick={reintentar}
          style={{ padding:'16px 56px', borderRadius:50, background:`linear-gradient(135deg,${premio!.color},${premio!.color}cc)`, color:'#fff', fontSize:17, fontWeight:900, border:'none', cursor:'pointer', boxShadow:`0 6px 30px ${premio!.color}60`, fontFamily:"'Syne',sans-serif", zIndex:5, position:'relative' }}>
          🔄 Volver a intentar
        </button>
      ) : phase==='done' ? (
        <button onClick={onClose}
          style={{ padding:'16px 56px', borderRadius:50, background:`linear-gradient(135deg,${premio!.color},${premio!.color}cc)`, color:'#fff', fontSize:17, fontWeight:900, border:'none', cursor:'pointer', boxShadow:`0 6px 30px ${premio!.color}60`, fontFamily:"'Syne',sans-serif", zIndex:5, position:'relative' }}>
          {resultado?.special==='pierde' ? 'Cerrar' : '🎉 ¡Genial! Cerrar'}
        </button>
      ) : (
        <button onClick={onClose} style={{ background:'none', border:'none', fontSize:12, color:'rgba(255,255,255,.2)', cursor:'pointer', marginTop:6, zIndex:5, position:'relative' }}>
          Omitir premio
        </button>
      )}
      {/* eslint-disable-next-line @typescript-eslint/no-unused-vars */}
      <div style={{display:'none'}}>{rating}</div>
    </div>
  );
};

// ── PICKER — elige entre ruleta o cartas ────────────────────
const PremioPicker: React.FC<{ onPick: (juego:'ruleta'|'cartas')=>void; onSkip: ()=>void; rating: number }> = ({ onPick, onSkip, rating }) => (
  <div style={{ flex:1, overflowY:'auto', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', padding:'60px 24px 32px', background:'#080810', position:'relative' }}>
    <style>{`
      @keyframes pulseGlow{0%,100%{box-shadow:0 0 30px rgba(255,45,120,0.4)}50%{box-shadow:0 0 60px rgba(255,45,120,0.7)}}
      @keyframes fadeUp{from{opacity:0;transform:translateY(20px)}to{opacity:1;transform:translateY(0)}}
    `}</style>
    <div style={{textAlign:'center', marginBottom:36, animation:'fadeUp .4s ease'}}>
      <div style={{fontSize:64, marginBottom:12, filter:'drop-shadow(0 0 24px rgba(255,45,120,0.6))'}}>🎁</div>
      <div style={{fontSize:11, color:'#FF2D78', fontWeight:900, letterSpacing:'.18em', textTransform:'uppercase', marginBottom:8}}>✦ OMM REWARDS</div>
      <div style={{fontFamily:"'Syne',sans-serif", fontSize:26, fontWeight:900, color:'#fff', marginBottom:6, lineHeight:1.2}}>
        {rating >= 4 ? '¡Gracias por tu visita!' : 'Un detalle por tu honestidad'}
      </div>
      <div style={{fontSize:13, color:'rgba(255,255,255,.55)', maxWidth:300, margin:'0 auto'}}>
        Elige cómo quieres descubrir tu premio
      </div>
    </div>
    <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:14, width:'100%', maxWidth:380, marginBottom:24, animation:'fadeUp .5s ease .1s both'}}>
      <button onClick={()=>onPick('ruleta')}
        style={{
          padding:'24px 16px',
          borderRadius:20,
          border:'2px solid rgba(255,45,120,0.4)',
          background:'linear-gradient(135deg,rgba(255,45,120,0.15) 0%,rgba(179,136,255,0.1) 100%)',
          color:'#fff',
          cursor:'pointer',
          textAlign:'center',
          animation:'pulseGlow 2.4s ease-in-out infinite',
          transition:'transform .2s',
        }}
        onMouseDown={e=>e.currentTarget.style.transform='scale(0.96)'}
        onMouseUp={e=>e.currentTarget.style.transform='scale(1)'}>
        <div style={{fontSize:54, marginBottom:8}}>🎰</div>
        <div style={{fontFamily:"'Syne',sans-serif", fontSize:16, fontWeight:900, color:'#fff', marginBottom:4}}>Ruleta</div>
        <div style={{fontSize:11, color:'rgba(255,255,255,.55)'}}>Gira y descubre</div>
      </button>
      <button onClick={()=>onPick('cartas')}
        style={{
          padding:'24px 16px',
          borderRadius:20,
          border:'2px solid rgba(68,138,255,0.4)',
          background:'linear-gradient(135deg,rgba(68,138,255,0.15) 0%,rgba(179,136,255,0.1) 100%)',
          color:'#fff',
          cursor:'pointer',
          textAlign:'center',
          animation:'pulseGlow 2.4s ease-in-out infinite .3s',
          transition:'transform .2s',
        }}
        onMouseDown={e=>e.currentTarget.style.transform='scale(0.96)'}
        onMouseUp={e=>e.currentTarget.style.transform='scale(1)'}>
        <div style={{fontSize:54, marginBottom:8}}>🃏</div>
        <div style={{fontFamily:"'Syne',sans-serif", fontSize:16, fontWeight:900, color:'#fff', marginBottom:4}}>6 Cartas</div>
        <div style={{fontSize:11, color:'rgba(255,255,255,.55)'}}>Pica tu suerte</div>
      </button>
    </div>
    <button onClick={onSkip} style={{background:'none', border:'none', fontSize:12, color:'rgba(255,255,255,.25)', cursor:'pointer', textDecoration:'underline'}}>
      Omitir premio
    </button>
  </div>
);


// Sanea hex color · módulo-nivel para usar también desde sub-componentes
function sanearHex(c?: string | null): string {
  if (!c) return '#FF2D78';
  const s = String(c).trim();
  if (/^#[0-9a-fA-F]{6}$/.test(s)) return s.toLowerCase();
  if (/^#[0-9a-fA-F]{3}$/.test(s)) return ('#' + s.slice(1).split('').map(ch=>ch+ch).join('')).toLowerCase();
  return '#FF2D78';
}

const ServiceOSModule: React.FC<POSProps> = ({ tables, onUpdateTable, onOpenVisionAI }) => {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const { profile } = useAuth();
  const { activeId: restauranteId, activeRestaurant, canSwitch, setActiveId, options: restaurantesDisponibles } = useRestaurant();
  const isGerencia = ['admin','gerencia','desarrollo'].includes(profile?.role || '');

  // ── Carta dinámica multi-restaurante.
  // OMM (id 6) usa la carta hardcoded como base, pero respeta overrides
  // de Mi Menú: activo=false → oculto del POS, disponible=false → 86 sombreado.
  // Gallo (id 23) y futuros restaurantes leen 100% de menu_platos.
  const [productos, setProductos] = useState<Record<string, any[]>>(
    restauranteId === 6 ? PRODUCTOS_OMM_FALLBACK : {}
  );
  const [menuOverrides, setMenuOverrides] = useState<Record<string,{activo:boolean;disponible:boolean}>>({});
  const categorias = React.useMemo(() => Object.keys(productos), [productos]);

  // Cargar overrides de Mi Menú (activo / disponible) por nombre — aplica para OMM.
  useEffect(() => {
    if (restauranteId !== 6) return;
    let alive = true;
    const load = async () => {
      const { data } = await supabase.from('menu_platos')
        .select('nombre,activo,disponible')
        .eq('restaurante_id', restauranteId);
      if (!alive) return;
      const map: Record<string,{activo:boolean;disponible:boolean}> = {};
      (data||[]).forEach((p:any) => {
        map[String(p.nombre||'').trim().toLowerCase()] = { activo: p.activo !== false, disponible: p.disponible !== false };
      });
      setMenuOverrides(map);
    };
    load();
    // Realtime: si en Mi Menú alguien cambia el ojo/86, se refleja en el POS al toque.
    const ch = supabase.channel('menu-overrides-pos')
      .on('postgres_changes', { event:'*', schema:'public', table:'menu_platos' }, load)
      .subscribe();
    return () => { alive=false; supabase.removeChannel(ch); };
  }, [restauranteId]);

  useEffect(() => {
    if (restauranteId === 6) {
      // OMM: aplicar overrides de Mi Menú sobre la carta base
      const filtrado: Record<string,any[]> = {};
      Object.entries(PRODUCTOS_OMM_FALLBACK).forEach(([cat, items]) => {
        const visibles = items
          .map((p:any) => {
            const ov = menuOverrides[String(p.nombre||'').trim().toLowerCase()];
            if (!ov) return p; // sin override → visible normal
            if (!ov.activo) return null; // oculto desde Mi Menú
            return { ...p, _en86: !ov.disponible }; // marcado como 86
          })
          .filter(Boolean) as any[];
        if (visibles.length > 0) filtrado[cat] = visibles;
      });
      setProductos(filtrado);
      return;
    }
    let alive = true;
    (async () => {
      const { data } = await supabase.from('menu_platos')
        .select('nombre,descripcion,categoria,estacion,emoji,precio_venta,disponible,featured,modificadores')
        .eq('restaurante_id', restauranteId).eq('activo', true)
        .order('categoria').order('nombre');
      if (!alive) return;
      if (!data || data.length === 0) {
        setProductos({});
        return;
      }
      const grouped: Record<string, any[]> = {};
      data.forEach((p: any) => {
        const cat = p.categoria || 'Otros';
        if (!grouped[cat]) grouped[cat] = [];
        grouped[cat].push({
          nombre: p.nombre,
          precio: `$${Number(p.precio_venta || 0).toLocaleString('es-CO')}`,
          emoji: p.emoji || '🍽️',
          badge: p.featured ? 'gold' : 'recomendado',
          descripcion: p.descripcion,
          estacion: p.estacion,
          categoria: cat,
          modificadores: Array.isArray(p.modificadores) ? p.modificadores : [],
          _en86: p.disponible === false, // sombreado si está en 86
        });
      });
      setProductos(grouped);
    })();
    return () => { alive = false; };
  }, [restauranteId]);

  // Los useEffect que tocan order/currentCat/stockFlow se declaran más
  // abajo, después de sus useState correspondientes, para evitar TDZ.

  // Identidad única del mesero — debe coincidir con lo que el Maître asigna
  // (profiles.nombre_completo, o full_name si el primero está vacío).
  const miNombre = profile?.nombre_completo || profile?.full_name || 'Mesero';

  // ── Retos NX activos (badges x2/x3/x4 en productos del POS) ──
  const [retosNXActivos, setRetosNXActivos] = useState<any[]>([]);
  useEffect(() => {
    const hoy = new Date().toISOString().split('T')[0];
    supabase.from('nx_retos').select('producto_nombre,multiplicador,emoji,motivacion_mesero')
      .eq('restaurante_id', restauranteId).eq('activo', true)
      .or(`hasta.is.null,hasta.gte.${hoy}`)
      .then(({ data }) => setRetosNXActivos(data || []));
  }, [restauranteId]);

  // ── Colores de los meseros (mapa visual: cada mesa toma el color de su mesero) ──
  const [coloresMeseros, setColoresMeseros] = useState<Record<string, string>>({});
  useEffect(() => {
    supabase.from('profiles').select('nombre_completo,full_name,color')
      .not('color', 'is', null)
      .then(({ data }) => {
        const map: Record<string, string> = {};
        (data || []).forEach((p:any) => {
          const k1 = p.nombre_completo || '';
          const k2 = p.full_name || '';
          if (k1 && p.color) map[k1] = p.color;
          if (k2 && k2 !== k1 && p.color) map[k2] = p.color;
        });
        setColoresMeseros(map);
      });
  }, [restauranteId]);
  const colorDeMesero = (nombre: string | null | undefined): string => {
    if (!nombre) return '#5a6472';
    const raw = coloresMeseros[nombre] || (nombre === miNombre ? profile?.color : null);
    return sanearHex(raw) || '#5a6472';
};
  const retoDePlato = useCallback((nombrePlato: string): any => {
    if (!nombrePlato) return null;
    const n = nombrePlato.toLowerCase();
    return retosNXActivos.find((r:any) => n.includes(String(r.producto_nombre).toLowerCase()));
  }, [retosNXActivos]);

  // ── Intel del día (modal con ⚡ rayo junto al nombre) ──
  const [intelOpen, setIntelOpen] = useState(false);
  const [intelData, setIntelData] = useState({ ventas:0, tickets:0, propinas:0, retosCumplidos:0, puntosOtorgados:0 });
  useEffect(() => {
    if (!intelOpen) return;
    (async () => {
      const hoy = new Date().toISOString().split('T')[0];
      const [cobros, retosT] = await Promise.all([
        supabase.from('cobros_trazabilidad').select('total,propina,mesero,items')
          .eq('restaurante_id', restauranteId).gte('created_at', hoy+'T00:00:00')
          .eq('mesero', miNombre),
        supabase.from('nx_retos').select('veces_vendido,puntos_otorgados')
          .eq('restaurante_id', restauranteId).eq('activo', true),
      ]);
      const ventas = (cobros.data||[]).reduce((s:number,c:any)=>s+Number(c.total||0),0);
      const propinas = (cobros.data||[]).reduce((s:number,c:any)=>s+Number(c.propina||0),0);
      const tickets = (cobros.data||[]).length;
      const retosCumplidos = (retosT.data||[]).reduce((s:number,r:any)=>s+Number(r.veces_vendido||0),0);
      const puntosOtorgados = (retosT.data||[]).reduce((s:number,r:any)=>s+Number(r.puntos_otorgados||0),0);
      setIntelData({ ventas, tickets, propinas, retosCumplidos, puntosOtorgados });
    })();
  }, [intelOpen, restauranteId, miNombre]);

  // ── Selector de color del mesero (al primer login) ──
  // Cada mesero elige UN color que se aplica como borde a sus mesas
  // en el mapa y en el card del POS. Solo aparece si profile.color es null.
  const [colorPickerAbierto, setColorPickerAbierto] = useState(false);
  const COLORES_MESERO = [
    { hex: '#3dba6f', label: 'Verde' },
    { hex: '#448AFF', label: 'Azul' },
    { hex: '#FF5252', label: 'Rojo' },
    { hex: '#FFB547', label: 'Naranja' },
    { hex: '#B388FF', label: 'Morado' },
    { hex: '#22d3ee', label: 'Cian' },
    { hex: '#FF2D78', label: 'Rosa' },
    { hex: '#FFE600', label: 'Amarillo' },
    { hex: '#00E676', label: 'Verde claro' },
    { hex: '#d4943a', label: 'Dorado' },
  ];
  useEffect(() => {
    if (profile && !profile.color && profile.role === 'mesero') setColorPickerAbierto(true);
  }, [profile]);
  const elegirMiColor = async (hex: string) => {
    if (!profile?.id) return;
    await supabase.from('profiles').update({ color: hex }).eq('id', profile.id);
    showToast(`✓ Color asignado · tus mesas se verán con este borde`);
    setColorPickerAbierto(false);
    // Forzar reload del profile
    setTimeout(() => window.location.reload(), 600);
  };
  // Acceso total al salón: ve y entra a TODAS las mesas y ve todas las
  // notificaciones (Maître, capitán, sommelier y gerencia). No otorga
  // poderes financieros de gerencia (eso sigue en isGerencia).
  const accesoSalon = isGerencia || ['maitre','maître','capitan','capitán','sommelier'].includes(profile?.role || '');

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
  // Datos reales del cliente sentado, por número de mesa (desde las reservas)
  const [clientesPorMesa, setClientesPorMesa] = useState<Record<number, any>>(() => loadPosState().clientesPorMesa || {});
  const [rightTab, setRightTab] = useState<'IA' | 'Cuenta' | 'Chat' | 'Intel'>('IA');
  // Ticket del día y cuentas por cobrar
  const [ticketDia, setTicketDia] = useState<any>({ ventas:0, ordenes:0, pendientes:0, porCobrar:0, propinaTotal:0, total_ventas:0, total_ordenes:0, total_items:0, mesas_atendidas:0 });
  const [cuentasCobrar, setCuentasCobrar] = useState(0);
  // Notificaciones
  const [notifs, setNotifs] = useState<any[]>([]);
  const [notifsBadge, setNotifsBadge] = useState(0);
  const [showNotifPanel, setShowNotifPanel] = useState(false);
  // Stock 86 tips
  const [tipsVenta, setTipsVenta] = useState<any[]>([]);
  const [tips86, setTips86] = useState<any[]>([]);
  // Puntos
  const [puntosCliente, setPuntosCliente] = useState(0);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showOrderPanel, setShowOrderPanel] = useState(false);
  const [mostrarTraspaso, setMostrarTraspaso] = useState(false);
  const [mostrarCompartir, setMostrarCompartir] = useState(false);
  const [mostrarEnProduccion, setMostrarEnProduccion] = useState(true);
  const [meserosTodas,   setMeserosTodas]   = useState<any[]>([]);
  const [mesaDestino, setMesaDestino] = useState<number | null>(null);
  const [tipoTraspaso, setTipoTraspaso] = useState<'mesa'|'barra'|'barra-a-mesa'>('mesa');
  const [miMenu, setMiMenu] = useState<any[]>([]);
  const [miMenuFormOpen, setMiMenuFormOpen] = useState(false);
  const [miMenuForm, setMiMenuForm] = useState({ nombre:'', precio:'', emoji:'🍽️', categoria:'Compartir', badge:'recomendado', carne: false });
  const [order, setOrder] = useState<OrderItem[]>(() => loadPosState().order || []);
  // Pedido pendiente de enviar a cocina (agregar a la orden)
  const [pendingOrder, setPendingOrder] = useState<OrderItem[]>(() => loadPosState().pendingOrder || []);
  const [toast, setToast] = useState('');
  const [modal, setModal] = useState<POSModal>({ open: false, title: '', content: null });
  const [chatMessage, setChatMessage] = useState('');
  const [chatRol, setChatRol] = useState<'Mesero'|'Cocina'|'Host'|'Maître'>('Mesero');
  // Rol de chat pre-determinado por perfil — se ajusta cuando carga el profile
  React.useEffect(() => {
    if (!profile?.role) return;
    const r = profile.role;
    if (r === 'cocina' || r === 'cocinero') setChatRol('Cocina');
    else if (r === 'host' || r === 'hostess') setChatRol('Host');
    else if (r === 'maitre' || r === 'gerencia') setChatRol('Maître');
    else setChatRol('Mesero');
  }, [profile?.role]);

  // ── Flow Store — sincronización con Book Flow ────────────
  const agregarPlatoFlow = (_data: any) => {}; // stub hasta que flowStore esté en el repo
  const flowMensaje = (_data: any) => {};
  const [chatHistory, setChatHistory] = useState([
    { sender: 'Cocina', msg: 'Mesa 4, marchando principales.', time: '19:45' },
    { sender: 'Host', msg: 'Mesa 2 VIP acaba de llegar.', time: '19:30' },
  ]);
  const [posDescuento, setPosDescuento] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
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
  const [notasMesero, setNotasMesero] = useState<Record<number, string[]>>(() => loadPosState().notasMesero || {});
  const [ritualState, setRitualState] = useState<Record<number, string[]>>(mesaRitualState);

  // ── Cerebro POS: guardar el estado de las mesas en cada cambio ──────
  useEffect(() => {
    savePosState({ order, pendingOrder, clientesPorMesa, notasMesero, selectedTableId });
  }, [order, pendingOrder, clientesPorMesa, notasMesero, selectedTableId]);

  // ── Progreso del ritual por mesa ─────────────────────────────────────
  const getRitualProgress = (mesaId: number): number => {
    const done = (ritualState[mesaId] || []).length;
    return Math.round((done / ritualStepsAll.length) * 100);
  };
  const [addedCards, setAddedCards] = useState<Set<string>>(new Set());

  // ── Reset de operación al cambiar de restaurante ──────────────────
  // Evita que una mesa/pedido de OMM quede "colgando" al cambiar a Gallo
  // (y viceversa). Solo dispara en cambios, no en el primer render.
  const prevRestauranteRef = useRef<number | null>(null);
  useEffect(() => {
    if (prevRestauranteRef.current === null) {
      prevRestauranteRef.current = restauranteId;
      return;
    }
    if (prevRestauranteRef.current !== restauranteId) {
      setOrder([]);
      setPendingOrder([]);
      setSelectedTableId(1);
      setSelectedPlato(null);
      setAddedCards(new Set());
      setStockFlow({});
      setShowOrderPanel(false);
      prevRestauranteRef.current = restauranteId;
    }
  }, [restauranteId]);

  // Cuando se carga una carta nueva, asegurar que currentCat sea válido
  useEffect(() => {
    const cats = Object.keys(productos);
    if (cats.length > 0 && !cats.includes(currentCat)) {
      setCurrentCat(cats[0]);
    }
  }, [productos, currentCat]);

  const [pantallaConfirmacion, setPantallaConfirmacion] = useState<{
    activa: boolean; monto: number; metodo: string; facMsg: string; tableId: number;
  }>({ activa: false, monto: 0, metodo: '', facMsg: '', tableId: 0 });

  // ── Modal término de cocción ─────────────────────────────
  const [terminoModal, setTerminoModal] = useState<{ open: boolean; producto: any | null; modo: 'orden' | 'marchar' }>({ open: false, producto: null, modo: 'orden' });

  // ── Modal nivel de picante (solo Gallo Colorado, categorías saladas) ──
  const [picanteModal, setPicanteModal] = useState<{ open: boolean; producto: any | null; modo: 'orden' | 'marchar' }>({ open: false, producto: null, modo: 'orden' });

  // ── Modal de modificadores (leche con/sin, azúcar, extras, hielo…) ──
  const [modifModal, setModifModal] = useState<{ open: boolean; producto: any | null; modo: 'orden' | 'marchar'; selecciones: Record<string, any> }>({ open: false, producto: null, modo: 'orden', selecciones: {} });

  const requierePicante = (p: any): boolean => {
    if (restauranteId !== 23) return false;
    const cat = p?.categoria ?? currentCat;
    return CATEGORIAS_CON_PICANTE.has(cat);
  };

  const tieneModificadores = (p: any) => Array.isArray(p?.modificadores) && p.modificadores.length > 0;

  const abrirTermino = (p: any, modo: 'orden' | 'marchar') => {
    // 1. Si el plato tiene modificadores definidos en BD → abre modal de modificadores primero
    if (tieneModificadores(p)) {
      setModifModal({ open: true, producto: p, modo, selecciones: {} });
      return;
    }
    if (requierePicante(p)) {
      setPicanteModal({ open: true, producto: p, modo });
      return;
    }
    if (p.carne) {
      setTerminoModal({ open: true, producto: p, modo });
    } else {
      if (modo === 'orden') agregarAOrdenDirecto(p);
      else marcharAhoraDirecto(p);
    }
  };

  // Tras elegir modificadores: encadena a picante/término o despacha directo
  const aplicarModificadores = () => {
    const p = modifModal.producto;
    const modo = modifModal.modo;
    const selecciones = modifModal.selecciones;
    setModifModal({ open: false, producto: null, modo: 'orden', selecciones: {} });
    if (!p) return;
    // Validar obligatorios
    for (const m of (p.modificadores || [])) {
      if (m.obligatorio && !selecciones[m.id]) {
        showToast(`⚠ ${m.label} es obligatorio`);
        setModifModal({ open: true, producto: p, modo, selecciones });
        return;
      }
    }
    // Construir sufijo y calcular extra
    const partes: string[] = [];
    let extraTotal = 0;
    for (const m of (p.modificadores || [])) {
      const sel = selecciones[m.id];
      if (!sel) continue;
      if (Array.isArray(sel)) {
        // multi: sel = array de ids
        const labels = sel.map((id:string) => {
          const op = m.opciones.find((o:any) => o.id === id);
          if (op) extraTotal += Number(op.extra || 0);
          return op?.label;
        }).filter(Boolean);
        if (labels.length) partes.push(`${m.label}: ${labels.join(', ')}`);
      } else {
        const op = m.opciones.find((o:any) => o.id === sel);
        if (op) {
          extraTotal += Number(op.extra || 0);
          partes.push(`${m.label}: ${op.label}`);
        }
      }
    }
    const sufijo = partes.length ? ` (${partes.join(' · ')})` : '';
    const precioBase = parsePrecio(p.precio || '0');
    const precioFinal = precioBase + extraTotal;
    const pConMod = {
      ...p,
      nombre: `${p.nombre}${sufijo}`,
      precio: extraTotal > 0 ? `$${precioFinal.toLocaleString('es-CO')}` : p.precio,
    };
    // Continuar con picante/término
    if (requierePicante(pConMod)) {
      setPicanteModal({ open: true, producto: pConMod, modo });
      return;
    }
    if (p.carne) {
      setTerminoModal({ open: true, producto: pConMod, modo });
    } else {
      if (modo === 'orden') agregarAOrdenDirecto(pConMod);
      else marcharAhoraDirecto(pConMod);
    }
  };

  // Tras elegir picante: si además es carne, continúa al modal de término;
  // si no, despacha directo con el sufijo de picante.
  const elegirPicante = (nivelKey: string) => {
    const p = picanteModal.producto;
    const modo = picanteModal.modo;
    setPicanteModal({ open: false, producto: null, modo: 'orden' });
    if (!p) return;
    const pConPicante = { ...p, nombre: `${p.nombre} ${nivelKey}` };
    if (p.carne) {
      setTerminoModal({ open: true, producto: pConPicante, modo });
    } else {
      if (modo === 'orden') agregarAOrdenDirecto(pConPicante);
      else marcharAhoraDirecto(pConPicante);
    }
  };

  // ── Mesas dinámicas — enriquecidas con platos locales en tiempo real ──
  // Fallback: si aún no llegan las mesas reales, se usa el plano OMM en
  // estado libre (sin clientes falsos), no datos de prueba.
  // Fallback de mesas cuando el wrapper aún no entregó `tables` (carga inicial).
  // OMM usa su plano hardcoded; Gallo y futuros usan un set genérico de 20
  // mesas para que la barra izquierda no se vea vacía mientras carga BD.
  const fallbackMesas = restauranteId === 6
    ? Object.values(PLANTA_OMM).map((p:any) => ({
        id: p.num, num: p.num, cliente: '', pax: 0, time: '00:00',
        ticket: 0, meta: 120, status: 'libre', vip: false, bday: false, alert: false,
        zona: p.zona,
      }))
    : Array.from({ length: 20 }, (_, i) => ({
        id: i + 1, num: i + 1, cliente: '', pax: 0, time: '00:00',
        ticket: 0, meta: 120, status: 'libre', vip: false, bday: false, alert: false,
        zona: 'Salón',
      }));
  const displayTablesAll = (tables && tables.length > 0 ? tables : fallbackMesas
  ).map((m: any) => {
    const mesaNum = m.num ?? m.numero ?? m.id;
    const platosLocales = [...pendingOrder, ...order].filter(o => o.mesa === mesaNum);
    const ticketLocal = platosLocales.reduce((s: number, o: any) => s + parsePrecio(o.precio), 0);
    const ticketBase = typeof m.ticket === 'number' ? m.ticket : (m.ticket_acumulado || 0);
    return {
      ...m,
      num: mesaNum,
      ticket: ticketBase + ticketLocal,
      cliente: m.cliente || m.cliente_nombre || m.nombre_cliente || 'Mesa',
      pax: m.pax || m.personas || 2,
      status: m.status || m.estado || 'activa',
      meta: m.meta || m.ticket_meta || 120,
      vip: m.vip || false,
      bday: m.bday || m.es_cumpleanos || false,
      alert: m.alert || (ticketLocal > 0 && platosLocales.some((p:any) => !p.marchado)),
    };
  });

  // El mesero solo ve SUS mesas: asignadas a él, compartidas, o abiertas por él
  // (tiene pedido local). Gerencia / Maître / capitanes ven todas (accesoSalon).
  const displayTables = accesoSalon ? displayTablesAll : displayTablesAll.filter((m:any) => {
    const mia = m.mesero_nombre === miNombre || (Array.isArray(m.meseros_compartidos) && m.meseros_compartidos.includes(miNombre));
    const tengoPedido = [...pendingOrder, ...order].some((o:any) => o.mesa === m.num);
    return mia || tengoPedido;
  });

  // Para el panel izquierdo: SIEMPRE solo las mesas que YO tengo abiertas,
  // sin importar el rol. Si no tengo ninguna, mostramos un CTA al Mapa.
  const misMesasAbiertas = displayTablesAll.filter((m:any) => {
    const mia = m.mesero_nombre === miNombre || (Array.isArray(m.meseros_compartidos) && m.meseros_compartidos.includes(miNombre));
    const tengoPedido = [...pendingOrder, ...order].some((o:any) => o.mesa === m.num);
    return mia || tengoPedido;
  });

  const selectedTable = displayTables.find((t: any) => t.id === selectedTableId) ?? displayTables[0];
  const recs = iaRecsByCat[currentCat] || iaRecsByCat['Compartir'];
  // Datos del cliente REAL sentado en la mesa seleccionada (de la reserva).
  // Si la mesa no tiene reserva asociada, se arma un perfil mínimo.
  const recsCliente = (iaRecsByCat[currentCat] || iaRecsByCat['Compartir'] || []).slice(0,3)
    .map((x:any)=>({icon:x.emoji, txt:`${x.name} — ${x.reason}`}));

  // Si selectedTableId no existe en displayTables (al cambiar de
  // restaurante las nuevas mesas tienen IDs distintos), saltar al
  // primer ID disponible — evita que el panel izquierdo se vea vacío.
  useEffect(() => {
    if (displayTables.length === 0) return;
    const existe = displayTables.some((t:any) => t.id === selectedTableId);
    if (!existe) setSelectedTableId(displayTables[0].id);
  }, [displayTables, selectedTableId]);

  // Tick cada 30s para re-renderizar el semáforo de tiempos
  // y disparar la alerta de bebida a los 40min.
  const [, setSemaforoTick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setSemaforoTick(x => x + 1), 30000);
    return () => clearInterval(t);
  }, []);

  // ── ALERTA BEBIDA 40min ────────────────────────────────────────────
  // Por mesa, calcula el tiempo desde la última bebida marchando.
  // Si pasa más de 40min y no hay bebidas más nuevas (ni pendientes),
  // dispara una notificación al mesero. Se reinicia al pedir otra.
  const ULTIMA_BEBIDA_ALERTADA = React.useRef<Record<number, number>>({});
  useEffect(() => {
    const revisar = () => {
      const ahora = Date.now();
      // Agrupar por mesa: cuál es la bebida más reciente y cuándo
      const ultimaPorMesa: Record<number, number> = {};
      [...order, ...pendingOrder].forEach((o:any) => {
        if (o.tipo !== 'bebida' || !o.created_at) return;
        const t = new Date(o.created_at).getTime();
        if (!ultimaPorMesa[o.mesa] || ultimaPorMesa[o.mesa] < t) ultimaPorMesa[o.mesa] = t;
      });
      Object.entries(ultimaPorMesa).forEach(([mesaStr, ts]) => {
        const mesa = Number(mesaStr);
        const minutos = (ahora - ts) / 60000;
        if (minutos < 40) return;
        // Si ya alertamos para este timestamp, no spamear
        if (ULTIMA_BEBIDA_ALERTADA.current[mesa] === ts) return;
        ULTIMA_BEBIDA_ALERTADA.current[mesa] = ts;
        showToast(`🥃 Mesa ${mesa}: 40min sin pedir bebida — ofrece otra ronda`);
        // Notificación persistente para el mesero
        supabase.from('nexum_notificaciones').insert({
          restaurante_id: restauranteId,
          tipo: 'bebida_40min',
          titulo: `🥃 Mesa ${mesa} — 40min sin bebida`,
          mensaje: `Ofrece una nueva ronda a la mesa ${mesa}.`,
          prioridad: 'normal',
          leida: false,
        }).then(()=>{}, ()=>{});
      });
    };
    revisar();
    const t = setInterval(revisar, 60000); // chequear cada 1 min
    return () => clearInterval(t);
  }, [order, pendingOrder, restauranteId]);
  const c = clientesPorMesa[selectedTable?.num] || {
    nombre: selectedTable?.cliente && !['mesa','cliente'].includes(String(selectedTable.cliente).toLowerCase()) ? selectedTable.cliente : 'Mesa sin reserva',
    nombreCompleto: selectedTable?.cliente || 'Cliente',
    desc: 'Walk-in — sin reserva registrada',
    avatar: (selectedTable?.cliente || '?').charAt(0).toUpperCase(),
    ocasion: null,
    reserva: { origen: 'Walk-in', hora: '—', pax: selectedTable?.pax || 2, nota: 'Sin notas de reserva' },
    visitas: 0, ultimaVisita: 'Sin historial',
    tags: [], alert: '', suggest: 'Atención de bienvenida',
    recs: recsCliente,
  };

  // Cargar datos de inteligencia al montar
  useEffect(() => {
    const loadIntel = async () => {
      try {
        // Ticket del día — usar limit(1) en vez de .single() para evitar crash
        const { data: td } = await supabase.from('vista_ticket_dia').select('*').limit(1);
        if (td && td.length > 0) setTicketDia((prev:any) => ({...prev, ...td[0]}));
        // Cuentas por cobrar
        const { data: ords } = await supabase.from('orders').select('id').eq('status','open');
        setCuentasCobrar(ords?.length||0);
        setTicketDia((prev:any) => ({...prev, pendientes: ords?.length||0}));
        // Notificaciones no leídas
        const { data: nf } = await supabase.from('nexum_notificaciones').select('*').eq('leida',false).eq('restaurante_id', restauranteId).order('created_at',{ascending:false}).limit(20);
        if (nf) { setNotifs(nf); setNotifsBadge(nf.length); }
        // Tips de venta
        const { data: mi } = await supabase.from('menu_items').select('id,name,emoji,category,precio_venta,stock_actual,alerta_stock,disponible').eq('disponible',true).order('stock_actual',{ascending:false}).limit(6);
        if (mi) setTipsVenta(mi.filter((m:any)=>(m.stock_actual||0)>10||(m.alerta_stock)));
      } catch(e) {
        console.warn('Intel load error:', e);
      }
    };
    loadIntel();
    const ch = supabase.channel('intel-live')
      .on('postgres_changes',{event:'*',schema:'public',table:'nexum_notificaciones'},loadIntel)
      .on('postgres_changes',{event:'*',schema:'public',table:'orders'},loadIntel)
      .subscribe();
    return ()=>{ supabase.removeChannel(ch); };
  }, []);

  // ── Flow alertas (platos listos) ─────────────────────────────────────
  const [flowAlertas, setFlowAlertas] = useState<any[]>([]);
  const [historialPedidos, setHistorialPedidos] = useState<any[]>([]);
  const [showHistorial, setShowHistorial] = useState(false);
  // 🛎️ Timbre real — 2.5 segundos, resonante como campana de hotel
  const playAlert = useCallback(() => {
    try {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      
      // Capa 1: tono fundamental 523Hz (Do5) — el "ding" principal
      const bell1 = () => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain); gain.connect(ctx.destination);
        osc.type = 'sine';
        osc.frequency.setValueAtTime(523, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(510, ctx.currentTime + 2.5);
        gain.gain.setValueAtTime(0, ctx.currentTime);
        gain.gain.linearRampToValueAtTime(0.55, ctx.currentTime + 0.01);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 2.5);
        osc.start(ctx.currentTime); osc.stop(ctx.currentTime + 2.5);
      };
      // Capa 2: armónico 1046Hz (Do6) — brillo del timbre
      const bell2 = () => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain); gain.connect(ctx.destination);
        osc.type = 'sine';
        osc.frequency.setValueAtTime(1046, ctx.currentTime);
        gain.gain.setValueAtTime(0, ctx.currentTime);
        gain.gain.linearRampToValueAtTime(0.3, ctx.currentTime + 0.005);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 1.5);
        osc.start(ctx.currentTime); osc.stop(ctx.currentTime + 1.5);
      };
      // Capa 3: sub-tono 261Hz — cuerpo/resonancia
      const bell3 = () => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain); gain.connect(ctx.destination);
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(261, ctx.currentTime);
        gain.gain.setValueAtTime(0, ctx.currentTime);
        gain.gain.linearRampToValueAtTime(0.2, ctx.currentTime + 0.01);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 2.0);
        osc.start(ctx.currentTime); osc.stop(ctx.currentTime + 2.0);
      };
      // Capa 4: segundo golpe a 0.6s (eco del timbre)
      const bell4 = () => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain); gain.connect(ctx.destination);
        osc.type = 'sine';
        osc.frequency.setValueAtTime(523, ctx.currentTime + 0.6);
        gain.gain.setValueAtTime(0, ctx.currentTime + 0.6);
        gain.gain.linearRampToValueAtTime(0.3, ctx.currentTime + 0.61);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 2.2);
        osc.start(ctx.currentTime + 0.6); osc.stop(ctx.currentTime + 2.5);
      };
      bell1(); bell2(); bell3(); bell4();
    } catch(e) {}
  }, []);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(''), 2500);
  }, []);

  // ── Ticket del día ─────────────────────────────────────
  // Puntos NX: 10 puntos por cada $10.000 de cuenta = 1 pt cada $1.000.
  // El cliente acumula en su wallet (puntos_nx) para canjear beneficios.
  const calcularPuntos = (monto: number) => Math.floor(monto / 1000);

  // ── Suscripción a alertas de platos listos (Flow → POS) ─────────────
  useEffect(() => {
    const fetchAlertas = async () => {
      const { data } = await supabase.from('flow_alertas')
        .select('*').eq('leida', false).eq('restaurante_id', restauranteId)
        .order('created_at', { ascending: false });
      if (data && data.length > 0) {
        const prevLen = flowAlertas.length;
        setFlowAlertas(data);
        if (data.length > prevLen && data.some((a:any)=>esMiaRef.current(a.mesa_num, a.mesero))) playAlert();
      } else {
        setFlowAlertas([]);
      }
    };

    // Estado real de las mesas en tiempo real (incluye posición, vip, forma — para el plano SVG)
    const fetchMesasEstado = async () => {
      const { data } = await supabase.from('tables')
        .select('id,name,seats,zona,estado,mesero_nombre,abierta_en,pax_actual,cliente_nombre,order_id_activo,capacidad,meseros_compartidos,posicion_x,posicion_y,vip,shape,restaurante_id,activa')
        .eq('restaurante_id', restauranteId)
        .order('name');
      if (data) setMesasEstado((data||[]).filter((m:any)=>m.activa!==false));
    };
    fetchMesasEstado();

    // Cliente real sentado por mesa — datos de la reserva + perfil CRM
    const fetchClientesMesas = async () => {
      const hoy = new Date().toISOString().split('T')[0];
      const [rv, oy, perfiles] = await Promise.all([
        supabase.from('reservations').select('*').eq('fecha',hoy).not('mesa_num','is',null),
        supabase.from('ohyeah_reservas').select('*').eq('date',hoy).not('mesa_num','is',null),
        supabase.from('nexum_clientes_ohyeah').select('*'),
      ]);
      const perfilDe = (email?:string, nombre?:string) => (perfiles.data||[]).find((p:any)=>
        (email && p.email && p.email.toLowerCase()===String(email).toLowerCase()) ||
        (nombre && p.nombre && p.nombre.toLowerCase()===String(nombre).toLowerCase()));
      const map: Record<number,any> = {};
      const armar = (mesa:number, nombre:string, email:string, _tel:string, pax:number, ocasion:string, nota:string, origen:string, extra:any={}) => {
        if (!mesa) return;
        const perfil = perfilDe(email, nombre);
        const restricciones = String(perfil?.restricciones||extra.restricciones||'').split(/[,;]/).map((s:string)=>s.trim()).filter(Boolean);
        const oc = (ocasion||'').toLowerCase();
        const visitas = perfil?.visitas || extra.visitCount || 0;
        const nivel = perfil?.nivel || '';
        map[mesa] = {
          nombre, nombreCompleto: nombre,
          email: email || '', telefono: _tel || '',
          desc: nivel ? `${nivel} · ${visitas} visita${visitas===1?'':'s'}` : (extra.primera ? 'Primera visita ★' : 'Cliente'),
          avatar: (nombre||'?').charAt(0).toUpperCase(),
          ocasion: oc.includes('cumple') ? 'cumpleanos' : oc.includes('aniversar') ? 'aniversario' : null,
          reserva: { origen, hora: extra.hora||'—', pax: pax||2, nota: nota||'Sin notas' },
          visitas,
          ultimaVisita: perfil?.ultima_reserva ? new Date(perfil.ultima_reserva).toLocaleDateString('es-CO',{day:'numeric',month:'short'}) : (extra.primera?'Primera visita':'—'),
          tags: [
            ...restricciones.map((r:string)=>`⚠️ ${r}`),
            ...(perfil?.notas ? [perfil.notas] : []),
            ...(extra.gourmand ? [extra.gourmand] : []),
            ...(extra.mood && extra.mood!=='Sin motivo especial' ? [`✨ ${extra.mood}`] : []),
          ],
          alert: restricciones.length ? `Restricción: ${restricciones.join(', ')} — informar a cocina` : '',
          suggest: extra.primera ? 'Primera visita — dale una bienvenida especial'
            : (nivel==='VIP'||nivel==='ÉLITE'||nivel==='CONSAGRADO') ? `Cliente ${nivel} — servicio preferencial`
            : 'Atención atenta y cercana',
        };
      };
      (rv.data||[]).forEach((r:any)=>armar(r.mesa_num, r.cliente_nombre, r.cliente_email, r.cliente_telefono, r.pax, r.ocasion, r.notas, r.origen==='ohyeah'?'Oh Yeah':'Reserve', {hora:r.hora}));
      (oy.data||[]).forEach((r:any)=>armar(r.mesa_num, r.guest_name, r.guest_email, r.guest_phone, r.pax, r.occasion, r.observations, 'Oh Yeah', {
        hora:r.time, gourmand:r.gourmand_level, primera:r.is_first_visit, visitCount:r.visit_count, mood:r.mood,
      }));
      setClientesPorMesa(map);
    };
    fetchClientesMesas();

    // Suscribir cambios de mesas en tiempo real
    const chMesas = supabase.channel('mesas-estado')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tables' }, () => {
        fetchMesasEstado();
        fetchClientesMesas();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'reservations' }, () => { fetchClientesMesas(); })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'ohyeah_reservas' }, () => { fetchClientesMesas(); })
      .subscribe();

    // Reservas Oh Yeah del día → badge en el POS
    // Platos del día desde Supabase (actualizados desde Flow)
    const fetchPlatosDia = async () => {
      const { data } = await supabase.from('platos_dia')
        .select('*').eq('restaurante_id', restauranteId).eq('activo',true)
        .eq('fecha', new Date().toISOString().split('T')[0])
        .order('created_at',{ascending:false});
      if (data) setPlatosDia(data);
    };
    fetchPlatosDia();

    // Realtime platos del día — cuando el chef activa o hace 86 un plato
    const chPlatos = supabase.channel('platos-dia-live')
      .on('postgres_changes',{event:'*',schema:'public',table:'platos_dia'},()=>{
        fetchPlatosDia();
      }).subscribe();

    // Meseros para traspaso
    supabase.from('staff_nexum').select('*').eq('restaurante_id', restauranteId).eq('activo',true).eq('rol','mesero')
      .then(({data})=>{ if(data) setMeserosTodas(data); });

    const fetchReservasOhYeah = async () => {
      const hoy = new Date().toISOString().split('T')[0];
      const { data } = await supabase
        .from('ohyeah_reservas')
        .select('id,guest_name,time,pax,status,restaurante_nombre,mesa_num')
        .eq('date', hoy)
        .in('status', ['pending','confirmed','seated'])
        .order('time');
      // Normaliza nombres de columna para el render existente
      if (data) setReservasHoy(data.map((r:any)=>({ ...r, cliente_nombre:r.guest_name, hora:r.time })));
    };

    fetchAlertas();
    fetchReservasOhYeah();

    const ch = supabase.channel('flow-alertas-pos')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'flow_alertas' }, (payload) => {
        const a = payload.new as any;
        setFlowAlertas(p => [a, ...p]);
        if (esMiaRef.current(a.mesa_num, a.mesero)) {
          playAlert();
          showToast(`🍽️ ${a.plato} — Mesa ${a.mesa_num} listo para entrega`);
        }
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'ohyeah_reservas' }, (payload) => {
        const r = payload.new as any;
        showToast(`🦉 Nueva reserva Oh Yeah: ${r.guest_name||r.cliente_nombre||'cliente'} — ${r.time||r.hora||''}`);
        fetchReservasOhYeah();
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [restauranteId]);

  // ── Historial de facturas del mesero ──────────────────────────────────
  const fetchHistorial = async () => {
    const { data } = await supabase.from('facturacion')
      .select('*').eq('restaurante_id', restauranteId)
      .order('cerrada_en', { ascending: false }).limit(50);
    if (data) setHistorialPedidos(data);
  };

  // ── Guardar factura en BD ────────────────────────────────────────────
  const cobrandoRef = useRef(false);
  const guardarFactura = async (metodoPago: string) => {
    if (cobrandoRef.current) return; // evita doble cobro por doble-tap
    cobrandoRef.current = true;
    try {
      const ahora = new Date();
      const itemsData = itemsCliente.map((it:any) => ({
        nombre: it.nombre, precio: it.precio, estado: it.estado
      }));
      // totalCliente ya incluye neto + IVA + propina (ver definición). No volver a sumar propina ni descuento.
      const totalFinal = totalCliente;
      const meseroNombre = miNombre;
      
      // Guardar datos de factura según tipo
      if (facturaTipo === 'electronica') {
        const n  = (window as any).__facEl_facElNombre  || mesaCliente?.nombre || '';
        const cc = (window as any).__facEl_facElNit     || '';
        const em = (window as any).__facEl_facElCorreo  || mesaCliente?.email || '';
        const tel= (window as any).__facEl_facElTel     || mesaCliente?.telefono || '';
        const dir= (window as any).__facEl_facElDir     || '';
        if (cc) {
          await supabase.from('facturas_electronicas').insert({
            restaurante_id: restauranteId, mesa_num:mesaCliente?.num??0,
            nombre:n, correo:em, cedula_nit:cc, telefono:tel, direccion:dir,
            total:Math.round(totalCliente),
            estado:'pendiente',
          }).then(()=>{}).catch(()=>{});
        }
      }
      if (facturaTipo === 'correo' && facturaCorreo) {
        // El envío por correo se despacha desde el backend cuando la factura se crea
        showToast(`📧 Factura enviada a ${facturaCorreo}`);
      }
      if (facturaTipo === 'fisica') {
        showToast('🖨️ Imprimiendo factura...');
        // window.print() o integración con impresora
      }

      // ══ NEXUM TIP NETWORK V5 — Motor autónomo ══
      // Registrar participante principal de la mesa
      if (propinaCliente > 0 && meseroNombre) {
        const facturaId = `fac_${Date.now()}_${selectedTableId}`;
        // 1. Registrar al mesero como participante principal de la factura
        await supabase.from('ticket_participants').insert({
          factura_id: facturaId,
          restaurante_id: restauranteId,
          empleado_nombre: meseroNombre,
          tag_code: 'MESA_OWNER',
          rol_en_factura: 'MESA_OWNER',
          contribution_pct: 100,
          venta_generada: Math.round(totalCliente),
          upselling_items: pendingOrder.filter(o=>o.mesa===mesaCliente?.num).length,
        }).then(()=>{}).catch(()=>{});

        // 2. Ejecutar el motor V5 — distribuye la propina en los 9 pools automáticamente
        await supabase.rpc('process_tip_event', {
          p_factura_id:  facturaId,
          p_restaurante: 6,
          p_tip_amount:  Math.round(propinaCliente),
          p_total:       Math.round(totalCliente),
          p_pct_propina: totalCliente > 0 ? Math.round(propinaCliente / totalCliente * 100) : 10,
          p_mesa_num:    mesaCliente?.num ?? null,
          p_turno:       new Date().getHours() < 16 ? 'mediodia' : 'noche',
          p_fecha:       new Date().toISOString().split('T')[0],
          p_hora:        new Date().toLocaleTimeString('es-CO',{hour:'2-digit',minute:'2-digit'}),
        }).then(()=>{}).catch(()=>{});

        // 3. Mantener compatibilidad con tabla propinas legacy
        await supabase.from('propinas').insert({
          restaurante_id: restauranteId,
          mesa_num:       mesaCliente?.num ?? 0,
          mesero_nombre:  meseroNombre,
          monto_cuenta:   Math.round(totalCliente),
          pct_propina:    totalCliente > 0 ? Math.round(propinaCliente / totalCliente * 100) : 10,
          monto_propina:  Math.round(propinaCliente),
          metodo_pago:    metodoPago || 'efectivo',
          turno:          new Date().getHours() < 16 ? 'mediodia' : 'noche',
          fecha:          new Date().toISOString().split('T')[0],
          hora:           new Date().toLocaleTimeString('es-CO',{hour:'2-digit',minute:'2-digit'}),
        }).then(()=>{}).catch(()=>{});
      }

      // Guardar en facturacion — no debe bloquear el cierre de mesa si falla
      try {
        await supabase.from('facturacion').insert({
          restaurante_id: restauranteId,
          mesa_num: mesaCliente?.num ?? 0,
          mesero: meseroNombre,
          items: itemsData,
          subtotal: Math.round(netoCliente),
          iva: Math.round(ivaCliente),
          propina: Math.round(propinaCliente),
          descuento: descuentoCliente,
          total: Math.round(totalFinal),
          metodo_pago: metodoPago,
          factura_tipo: facturaTipo,
          cliente_email: facturaCorreo || null,
          puntos_generados: calcularPuntos(totalFinal),
          cerrada_en: ahora.toISOString(),
          fecha: ahora.toISOString().split('T')[0],
          hora: ahora.toLocaleTimeString('es-CO', { hour:'2-digit', minute:'2-digit' }),
        });
      } catch (e) { console.error('facturacion insert error:', e); }

      // ── Acreditar puntos NX al wallet del cliente (10 pts cada $10.000)
      // Aplica multiplicador de retos si alguno de los items está activo.
      try {
        const customerId = c?.id || mesaCliente?.customer_id;
        if (customerId) {
          // Buscar retos activos para multiplicar
          const { data: retosActivos } = await supabase.from('nx_retos')
            .select('id,producto_nombre,multiplicador,puntos_otorgados,veces_vendido')
            .eq('restaurante_id', restauranteId).eq('activo', true)
            .or(`hasta.is.null,hasta.gte.${ahora.toISOString().split('T')[0]}`);
          const itemsCl = itemsData || [];
          let puntosBase = calcularPuntos(totalFinal);
          let puntosBonus = 0;
          (retosActivos || []).forEach((reto:any) => {
            const matchItem = itemsCl.find((it:any) =>
              String(it.nombre||'').toLowerCase().includes(String(reto.producto_nombre).toLowerCase())
            );
            if (matchItem) {
              const valorPlato = Number(String(matchItem.precio || '0').replace(/[^\d.-]/g,'')) || 0;
              const extras = calcularPuntos(valorPlato) * (reto.multiplicador - 1);
              puntosBonus += extras;
              // Tracking del reto
              supabase.from('nx_retos').update({
                veces_vendido: (reto.veces_vendido||0) + 1,
                puntos_otorgados: (reto.puntos_otorgados||0) + extras,
              }).eq('id', reto.id).then(()=>{}, ()=>{});
            }
          });
          const totalPuntos = puntosBase + puntosBonus;
          if (totalPuntos > 0) {
            const { data: cliCustomer } = await supabase.from('customers').select('puntos').eq('id', customerId).maybeSingle();
            const saldoActual = cliCustomer?.puntos || 0;
            const nuevoSaldo = saldoActual + totalPuntos;
            await supabase.from('customers').update({ puntos: nuevoSaldo }).eq('id', customerId);
            await supabase.from('nx_wallet_movimientos').insert({
              restaurante_id: restauranteId,
              customer_id: String(customerId),
              cliente_nombre: c?.nombreCompleto || c?.nombre,
              tipo: 'gana',
              puntos: totalPuntos,
              saldo_resultante: nuevoSaldo,
              mesa_num: mesaCliente?.num,
              mesero: meseroNombre,
              motivo: puntosBonus > 0 ? `Consumo $${Math.round(totalFinal).toLocaleString('es-CO')} + bono retos +${puntosBonus} pts` : `Consumo $${Math.round(totalFinal).toLocaleString('es-CO')}`,
            });
          }
        }
      } catch (e) { console.error('puntos nx error:', e); }

      // Cerrar la orden en Supabase
      const { data: ordenes } = await supabase.from('orders').select('id')
        .eq('table_id', mesaCliente?.num ?? 0).eq('status','open').limit(1);
      if (ordenes?.[0]) {
        await supabase.from('orders').update({ status:'closed' }).eq('id', ordenes[0].id);
        await supabase.from('order_items').update({ status:'served' })
          .eq('order_id', ordenes[0].id).neq('status','cancelled');
      }
      // Liberar la mesa: estado 'libre' + cierre de orden (RPC cerrar_mesa)
      if (mesaCliente?.num != null) {
        await supabase.rpc('cerrar_mesa', { p_mesa_name: String(mesaCliente.name ?? mesaCliente.num) });
      }
    } catch(e) { console.error('guardarFactura error:', e); }
    finally { cobrandoRef.current = false; }
  };

  // ── ABRIR MESA — llama la función de Supabase ──────────────────────
  const abrirMesaDB = async (mesa: any, pax: number, clienteNombre?: string, extra?: { telefono?: string; email?: string; vip?: boolean }) => {
    const meseroActivo = miNombre;
    const { data, error } = await supabase.rpc('abrir_mesa', {
      p_mesa_name: mesa.name,
      p_mesero_nombre: meseroActivo,
      p_pax: pax,
      p_cliente_nombre: clienteNombre || null,
    });
    if (error || !data?.ok) {
      showToast(`⚠️ ${data?.error || 'Error al abrir mesa'}`);
      return false;
    }
    // Guardar datos del cliente walk-in (teléfono, email, VIP) para rastreo
    if (extra && (extra.telefono || extra.email || extra.vip)) {
      try {
        await supabase.from('tables').update({
          cliente_telefono: extra.telefono || null,
          cliente_email: extra.email || null,
          vip: !!extra.vip,
        }).eq('name', String(mesa.name));
      } catch (e) { console.error('walk-in datos error:', e); }
    }
    // Seleccionar la mesa en el POS
    const mesaEnDisplay = displayTables.find((t:any) => String(t.num) === String(mesa.name));
    if (mesaEnDisplay) setSelectedTableId(mesaEnDisplay.id);
    setShowMapaMesas(false);
    setFormAbrirMesa(null);
    showToast(`🪑 Mesa ${mesa.name} — cliente sentado`);
    return true;
  };

  // ── TOMAR MESA ASIGNADA (verde → ocupada, bloqueada al mesero) ────────
  const tomarMesaAsignada = async (mesa: any, est: any) => {
    const meseroActivo = miNombre;
    const { data, error } = await supabase.rpc('abrir_mesa', {
      p_mesa_name: String(mesa.num),
      p_mesero_nombre: meseroActivo,
      p_pax: est?.pax_actual || mesa.cap || 2,
      p_cliente_nombre: est?.cliente_nombre || null,
    });
    if (error || !data?.ok) {
      showToast(`⚠️ ${data?.error || 'Error al tomar la mesa'}`);
      return;
    }
    const mesaEnDisplay = displayTables.find((t:any) => String(t.num) === String(mesa.num));
    if (mesaEnDisplay) setSelectedTableId(mesaEnDisplay.id);
    setShowMapaMesas(false);
    showToast(`✓ Tomaste la mesa ${mesa.num}${est?.cliente_nombre?` — ${est.cliente_nombre}`:''}`);
  };

  // ── COMPARTIR MESA con otro mesero ───────────────────────────────────
  const compartirMesaCon = async (mesaNum: number, meseroNombre: string) => {
    const est = mesasEstado.find((m:any)=>String(m.name)===String(mesaNum));
    const actuales: string[] = Array.isArray(est?.meseros_compartidos) ? est.meseros_compartidos : [];
    const yaEsta = actuales.includes(meseroNombre);
    const next = yaEsta ? actuales.filter(x=>x!==meseroNombre) : [...actuales, meseroNombre];
    await supabase.from('tables').update({ meseros_compartidos: next }).eq('name', String(mesaNum));
    showToast(yaEsta ? `Mesa ${mesaNum} ya no compartida con ${meseroNombre}` : `✓ Mesa ${mesaNum} compartida con ${meseroNombre}`);
  };

  // ── CERRAR MESA ──────────────────────────────────────────────────────
  const cerrarMesaDB = async (mesaName: string) => {
    await supabase.rpc('cerrar_mesa', { p_mesa_name: mesaName });
    showToast(`✓ Mesa ${mesaName} cerrada`);
  };

  // ── 34. Guardar feedback interno del servicio ─────────────────────────
  const guardarFeedback = async () => {
    if (!feedbackMesa.trim() || !mesaCliente) return;
    try {
      await supabase.from('feedback_servicio').insert({
        restaurante_id: restauranteId,
        mesa_num: mesaCliente.num,
        mesero: miNombre,
        tipo: feedbackTipo,
        comentario: feedbackMesa,
        fecha: new Date().toISOString().split('T')[0],
      });
      // Agregar al historial del cliente si existe
      if (mesaCliente?.clienteId) {
        const { data: cust } = await supabase.from('customers').select('historial_feedback').eq('id', mesaCliente.clienteId).single();
        if (cust) {
          const hist = cust.historial_feedback || [];
          await supabase.from('customers').update({
            historial_feedback: [...hist, {
              fecha: new Date().toISOString().split('T')[0],
              tipo: feedbackTipo,
              comentario: feedbackMesa,
              mesa: mesaCliente.num,
              mesero: miNombre,
            }]
          }).eq('id', mesaCliente.clienteId);
        }
      }
      setFeedbackMesa('');
    } catch(e) { console.error('feedback error:', e); }
  };

  const fetchTicketDia = async () => {
    try {
      const { data: cobros } = await supabase.from('cobros_trazabilidad').select('total,propina').eq('restaurante_id', restauranteId);
      const { data: ordAbiertas } = await supabase.from('orders').select('id,table_id').eq('status','open');
      const { data: ois } = await supabase.from('order_items').select('price_at_time,quantity,order_id').neq('status','cancelled');
      const ventasTotal = cobros?.reduce((a:number,cc:any)=>a+Number(cc.total||0),0)||0;
      const propinaTotal = cobros?.reduce((a:number,cc:any)=>a+Number(cc.propina||0),0)||0;
      const porCobrar = ois?.filter((i:any)=>ordAbiertas?.some((o:any)=>o.id===i.order_id)).reduce((a:number,i:any)=>a+Number(i.price_at_time||0)*Number(i.quantity||1),0)||0;
      setTicketDia((prev:any) => ({ ...prev, ventas:ventasTotal, ordenes:cobros?.length||0, pendientes:ordAbiertas?.length||0, porCobrar, propinaTotal, total_ventas:ventasTotal, total_ordenes:cobros?.length||0, total_items:ois?.length||0, mesas_atendidas:cobros?.length||0 }));
      setCuentasCobrar(ordAbiertas?.length||0);
    } catch(e) { console.warn('fetchTicketDia error:', e); }
  };

  // Auto-marca el paso del ritual según la categoría del producto agregado
  const autoCheckRitual = (categoria: string | undefined) => {
    if (!categoria || !selectedTable) return;
    const step = CAT_TO_RITUAL[categoria];
    if (!step) return;
    const mesaId = selectedTable.id ?? selectedTableId;
    setRitualState(prev => {
      const current = prev[mesaId] || [];
      if (current.includes(step)) return prev;
      showToast(`✦ Ritual: ${step} — Mesa ${selectedTable.num}`);
      return { ...prev, [mesaId]: [...current, step] };
    });
  };

  const closeModal = () => setModal({ open: false, title: '', content: null });

  const addToOrder = (p: any) => {
    const cat = p.categoria || currentCat;
    const est = inferirEstacionFromNombre(p.nombre, cat);
    setOrder(prev => [...prev, {
      ...p,
      mesa: selectedTable.num,
      created_at: p.created_at || new Date().toISOString(),
      estacion: p.estacion || est,
      categoria: cat,
      tipo: (est === 'bar' || est === 'cava') ? 'bebida' as const : 'comida' as const,
    }]);
    setAddedCards(prev => new Set([...prev, p.nombre]));
    setTimeout(() => setAddedCards(prev => { const n = new Set(prev); n.delete(p.nombre); return n; }), 1200);
    showToast(`✓ ${p.nombre} agregado al pedido`);
    // Sync to Supabase → Flow (KDS) lo ve en tiempo real
    insertarPedidoFlow(p.nombre, p.categoria ?? currentCat, selectedTable.num, p.precio ? parsePrecio(p.precio) : 0, p._observ || '', p._tags || []);
    agregarPlatoFlow({
      mesa: selectedTable.num,
      plato: p.nombre,
      emoji: p.emoji ?? '🍽️',
      mesero: miNombre,
      etapa: 'cocina',
      urgente: false,
    });
    autoCheckRitual(p.categoria ?? currentCat);
  };

  // ── Insertar pedido en Supabase → Flow lo ve en tiempo real ──
  const insertarPedidoFlow = async (nombrePlato: string, categoria: string, mesaNum: number, precio?: number, observaciones?: string, tags?: string[]) => {
    try {
      const meseroActivo = miNombre;

      // Reusa el clasificador definido a nivel de módulo (mismo set
      // que el semáforo del panel izquierdo y el ruteo a Flow).
      const inferirEstacion = inferirEstacionFromNombre;

      // Cocinero por estación (depende del restaurante activo)
      const COCINEROS_POR_REST: Record<number, Record<string, string>> = {
        6: {
          cocina_caliente: 'Chef Pablo Gómez',
          cocina_fria:     'Chef Ricardo Soto',
          robata:          'Chef María Castro',
          postres:         'Chef Jorge Suárez',
          bar:             'Bartender Mateo Díaz',
          cava:            'Somelier Juan Reyes',
        },
        23: {
          cocina_caliente: 'Chef Parrillero Gallo',
          cocina_fria:     'Chef Frío Gallo',
          postres:         'Chef Pastelería Gallo',
          bar:             'Bartender Gallo',
        },
      };
      const COCINEROS = COCINEROS_POR_REST[restauranteId] || COCINEROS_POR_REST[6];

      const estacion = inferirEstacion(nombrePlato, categoria);
      const cocinero = COCINEROS[estacion] || 'Chef Pablo Gómez';

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
        // Actualizar mesero_nombre si no tiene
        await supabase.from('orders').update({ mesero_nombre: meseroActivo }).eq('id', orderId).is('mesero_nombre', null);
      } else {
        const { data: nuevaOrden } = await supabase
          .from('orders')
          .insert({ table_id: mesaNum, status: 'open', mesero_nombre: meseroActivo, restaurante_id: restauranteId })
          .select('id')
          .single();
        if (!nuevaOrden) return;
        orderId = nuevaOrden.id;
      }

      // 2. Buscar menu_item por nombre
      const { data: menuItem } = await supabase
        .from('menu_items')
        .select('id,price')
        .ilike('name', `%${nombrePlato.split('(')[0].trim()}%`)
        .limit(1);

      const precioFinal = precio || Number(menuItem?.[0]?.price) || 0;

      // 3. Insertar en order_items con TODOS los campos
      await supabase.from('order_items').insert({
        order_id:        orderId,
        menu_item_id:    menuItem?.[0]?.id ?? null,
        quantity:        1,
        status:          'pending',
        notes:           observaciones ? `${nombrePlato} · ${observaciones}` : nombrePlato,
        nombre_plato:    nombrePlato,
        categoria:       categoria,
        estacion:        estacion,
        mesero:          meseroActivo,
        cocinero:        cocinero,
        price_at_time:   precioFinal,
        restaurante_id:  restauranteId,
        observaciones:   observaciones || null,
        tags:            tags && tags.length > 0 ? tags : null,
        created_at:      new Date().toISOString(),
        updated_at:      new Date().toISOString(),
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
    insertarPedidoFlow(productoFinal.nombre, p.categoria ?? currentCat, selectedTable?.num ?? 0, p.precio ? parsePrecio(p.precio) : 0, p._observ || '', p._tags || []);
    // ── Sincronizar con flowStore (Book Flow) ─────────────────
    agregarPlatoFlow({
      mesa: selectedTable?.num ?? 0,
      plato: productoFinal.nombre,
      emoji: p.emoji ?? '🍽️',
      mesero: miNombre,
      etapa: 'cocina',
      urgente: totalEnCocina >= 10,
      termino: termino,
    });
    // ── CRÍTICO: agregar al order para que sume al total de mesa ──
    // Incluimos created_at + estacion + tipo para que el panel izquierdo
    // pinte el semáforo y la alerta de bebida de 40min sepa qué contar.
    const catFinal = p.categoria ?? currentCat;
    const estFinal = inferirEstacionFromNombre(productoFinal.nombre, catFinal);
    const tipoFinal: 'comida'|'bebida' = (estFinal === 'bar' || estFinal === 'cava') ? 'bebida' : 'comida';
    setOrder(prev => [...prev, {
      nombre: productoFinal.nombre,
      precio: p.precio,
      emoji: p.emoji ?? '🍽️',
      mesa: selectedTable?.num ?? 0,
      created_at: new Date().toISOString(),
      estacion: estFinal,
      categoria: catFinal,
      tipo: tipoFinal,
    }]);
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
                    mesero: miNombre,
                    etapa: 'cocina',
                    urgente: false,
                  });
                });
              // Enriquecer cada item con timestamp + estación para el semáforo
              const ahora = new Date().toISOString();
              const pendingEnriched = pendingOrder.map(o => {
                const cat = (o as any).categoria || currentCat;
                const est = inferirEstacionFromNombre(o.nombre, cat);
                return {
                  ...o,
                  created_at: o.created_at || ahora,
                  estacion: o.estacion || est,
                  categoria: cat,
                  tipo: (est === 'bar' || est === 'cava') ? 'bebida' as const : 'comida' as const,
                };
              });
              setOrder(prev => [...prev, ...pendingEnriched]);
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
    // Los rituales son bebidas (agua de bienvenida, té de cortesía).
    setOrder(prev => [...prev, {
      nombre: name, precio: price, emoji: '💧', mesa: selectedTable.num,
      created_at: new Date().toISOString(), estacion: 'bar', tipo: 'bebida',
    }]);
    showToast(`✓ ${name} agregado — Ritual de Servicio`);
  };

  // Regla: el mesero solo puede eliminar un plato del order MIENTRAS
  // cocina no haya comenzado a prepararlo (status='pending' en
  // flow_order_items). Si ya está 'preparing'/'almost'/'ready'/'served',
  // se bloquea con un toast explicando.
  // Si se permite eliminar, también se borra del flow_order_items para
  // que cocina no lo siga preparando.
  const removeOrder = async (i: number) => {
    const item = order[i];
    if (!item) return;
    // Pedir motivo de cancelación (queda en trazabilidad y notifica a Flow)
    const motivo = prompt(`¿Por qué cancelas "${item.nombre}"?\n(error, cliente cambió de opinión, 86, etc.)`);
    if (motivo === null) return; // canceló el prompt
    const desdeIso = item.created_at || new Date(Date.now() - 60_000).toISOString();
    const { data: matches } = await supabase
      .from('flow_order_items')
      .select('id,status,nombre_plato,table_id,created_at')
      .eq('restaurante_id', restauranteId)
      .eq('table_id', item.mesa)
      .eq('nombre_plato', item.nombre)
      .gte('created_at', new Date(new Date(desdeIso).getTime() - 5000).toISOString())
      .order('created_at', { ascending: false })
      .limit(1);
    const flowItem = matches?.[0];
    if (flowItem && flowItem.status !== 'pending') {
      // Cocina ya empezó — marca cancelado pero NO borra (mantiene historial)
      await supabase.from('flow_order_items').update({
        status: 'cancelled', cancelled_at: new Date().toISOString(), cancel_reason: motivo,
      }).eq('id', flowItem.id);
      // Notificar al puesto de cocina en vivo
      await supabase.from('flow_alertas').insert({
        restaurante_id: restauranteId, mesa_num: item.mesa,
        plato: item.nombre, mesero: miNombre, tipo: 'cancelacion',
        motivo, severidad: 'alta', leida: false,
      }).then(()=>{},()=>{});
      showToast(`🚫 ${item.nombre} cancelado · cocina notificada (${motivo})`);
    } else if (flowItem) {
      // Pending — se puede cancelar limpio pero registramos motivo en historial
      await supabase.from('flow_order_items').update({
        status: 'cancelled', cancelled_at: new Date().toISOString(), cancel_reason: motivo,
      }).eq('id', flowItem.id);
      showToast(`🗑️ ${item.nombre} eliminado · motivo: ${motivo}`);
    }
    setOrder(prev => prev.filter((_, idx) => idx !== i));
  };

  const clearOrder = () => { setOrder([]); showToast('Pedido limpiado'); };

  // Limpia por completo una mesa tras cerrar su cobro (cerebro POS).
  const limpiarMesaCerrada = async (num?: number | null) => {
    if (num == null) return;
    setOrder(prev => prev.filter(o => o.mesa !== num));
    setPendingOrder(prev => prev.filter(o => o.mesa !== num));
    setClientesPorMesa(prev => { const n = { ...prev }; delete n[num]; return n; });
    setNotasMesero(prev => { const n = { ...prev }; delete n[num]; return n; });
    // Liberar la mesa en DB y finalizar su reserva del día → desaparece de
    // "Mesas en servicio" y la reserva pasa al historial (reservas anteriores).
    try {
      await supabase.from('tables').update({
        estado: 'libre', mesero_nombre: null, cliente_nombre: null,
        cliente_telefono: null, cliente_email: null, pax_actual: 0,
        order_id_activo: null, abierta_en: null, meseros_compartidos: [],
      }).eq('name', String(num));
      await supabase.from('reservations').update({ estado: 'completada' })
        .eq('mesa_num', num)
        .eq('fecha', new Date().toISOString().split('T')[0])
        .neq('estado', 'completada');
    } catch (e) { console.warn('liberar mesa error', e); }
    // Volver al Home de Mesas (mapa)
    setShowMapaMesas(true);
  };

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
    // m.ticket ya incluye el pedido local (ver displayTables); no re-sumar items.
    const subtotal = m.ticket;
    const descuento = Math.round(subtotal * (posDescuento / 100));
    const subtotalNeto = Math.max(0, subtotal - descuento - posCorte);
    const impoconsumo = Math.round(subtotalNeto * 0.08); // Impoconsumo 8% — restaurantes no responsables IVA
    const propinaMonto = Math.round(subtotalNeto * 0.10);
    const total = subtotalNeto + impoconsumo;
    const totalConPropina = total + propinaMonto;
    const iva = impoconsumo; // alias para compatibilidad

    const procesarPago = (metodo: string, conPropina: boolean) => {
      const montoFinal = conPropina ? totalConPropina : total;
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
      // La encuesta X-CARE se dispara desde "Pasar tablet al cliente" (cliente mode).
      // No abrimos el modal legacy para evitar dos encuestas simultáneas.
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

                  <button onClick={async () => {
                    // Validar primero en Supabase (tabla bonos_regalo)
                    const { data: bonoDb } = await supabase
                      .from('bonos_regalo')
                      .select('*')
                      .eq('codigo', codigoBono)
                      .eq('activo', true)
                      .single();

                    if (bonoDb) {
                      // Verificar usos
                      if (bonoDb.usos_actuales >= bonoDb.usos_maximos) {
                        render('✗ Este código ya fue utilizado'); return;
                      }
                      // Verificar vencimiento
                      if (bonoDb.vence_en && new Date(bonoDb.vence_en) < new Date()) {
                        render('✗ Código vencido'); return;
                      }
                      // Aplicar según tipo
                      if (bonoDb.tipo === 'descuento_fijo') {
                        const restante = Math.max(0, totalBase - bonoDb.valor);
                        await supabase.from('bonos_regalo').update({ usos_actuales: bonoDb.usos_actuales+1, canjeado_en: new Date().toISOString(), canjeado_por: profile?.nombre_completo||'Staff' }).eq('id', bonoDb.id);
                        closeModal();
                        showToast(`✓ ${bonoDb.descripcion} — ${restante===0?'cubre todo':formatPrecio(restante)+' restante'}`);
                        if (restante === 0) { setTimeout(() => abrirEncuesta(tid), 400); }
                        else { setTimeout(() => abrirPOS(tid), 300); }
                      } else if (bonoDb.tipo === 'descuento_pct') {
                        setPosDescuento(bonoDb.pct_descuento);
                        await supabase.from('bonos_regalo').update({ usos_actuales: bonoDb.usos_actuales+1, canjeado_en: new Date().toISOString() }).eq('id', bonoDb.id);
                        closeModal();
                        showToast(`✓ ${bonoDb.descripcion} — ${bonoDb.pct_descuento}% descuento aplicado`);
                        setTimeout(() => abrirPOS(tid), 300);
                      } else {
                        // cafe_gratis, copa_vino, postre_gratis
                        await supabase.from('bonos_regalo').update({ usos_actuales: bonoDb.usos_actuales+1, canjeado_en: new Date().toISOString() }).eq('id', bonoDb.id);
                        closeModal();
                        showToast(`✓ ${bonoDb.descripcion} — Notificado a cocina`);
                        setTimeout(() => abrirPOS(tid), 300);
                      }
                      return;
                    }

                    // Fallback: validación local hardcoded
                    if (tipoBono === 'tarjeta') {
                      const valor = TARJETAS_VALIDAS[codigoBono];
                      if (!valor) { render('✗ Código no válido'); return; }
                      const restante = Math.max(0, totalBase - valor);
                      closeModal();
                      showToast(`✓ Tarjeta ${codigoBono} — ${restante===0?'cubre todo':formatPrecio(restante)+' restante'}`);
                      if (restante === 0) setTimeout(() => abrirEncuesta(tid), 400);
                      else setTimeout(() => abrirPOS(tid), 300);
                    } else {
                      const pct = BONOS_VALIDOS[codigoBono];
                      if (!pct) { render('✗ Código de bono no válido'); return; }
                      setPosDescuento(pct);
                      closeModal();
                      showToast(`✓ Bono ${codigoBono} — ${pct}% descuento`);
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
                      {[0, 10, 20, 30, 50, 100].map(p => (
                        <button key={p} onClick={() => { setPosDescuento(p); }}
                          className={`flex-1 py-2 rounded-lg text-[11px] font-black border transition-all ${posDescuento === p ? 'border-[#d4943a] bg-[#d4943a]/15 text-[#d4943a]' : 'border-[#2a2a2a] text-[#606060] hover:border-[#606060]'}`}>
                          {p === 0 ? '—' : p === 100 ? '🆓 100%' : `${p}%`}
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
              { icon: '💳', label: 'Datafono',       color: '#4a8fd4', sub: '📟 El mesero trae el terminal' },
              { icon: '💵', label: 'Efectivo',        color: '#3dba6f', sub: '' },
              { icon: '💰', label: 'Anticipo Evento', color: '#9b72ff', sub: 'Para eventos y reservas' },
              { icon: '👤', label: 'Cuenta Empleado', color: '#f0b45a', sub: 'Descuento por nómina' },
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

          {/* 🧮 Calculadora de cuenta — selector 2-10 personas */}
          <div className="rounded-xl border border-[#2a2a2a] overflow-hidden mb-3">
            <div className="px-3 py-2 bg-[#1c1c1c] flex items-center justify-between">
              <span className="text-[11px] text-[#a0a0a0] font-bold">👥 Dividir cuenta</span>
              {dividirPax > 1 && (
                <span className="text-[10px] text-[#d4943a] font-black">
                  {dividirPax} personas · ${formatPrecio(Math.round(totalConPropina / dividirPax))} c/u
                </span>
              )}
            </div>
            <div className="grid grid-cols-5 gap-px bg-[#2a2a2a]">
              {[2,3,4,5,6,7,8,9,10].map(n => (
                <button key={n} onClick={() => setDividirPax(n)}
                  className={`py-2.5 text-[13px] font-black transition-all ${dividirPax === n ? 'bg-[#d4943a] text-black' : 'bg-[#141414] text-[#606060] hover:bg-[#1c1c1c] hover:text-[#f0f0f0]'}`}>
                  {n}
                </button>
              ))}
              <button onClick={() => setDividirPax(1)}
                className={`py-2.5 text-[10px] font-bold transition-all ${dividirPax === 1 ? 'bg-[#1c1c1c] text-[#606060]' : 'bg-[#141414] text-[#606060] hover:bg-[#1c1c1c]'}`}>
                ✕
              </button>
            </div>
            {dividirPax > 1 && (
              <div className="px-3 py-3 bg-[#0f0f0f]">
                {/* Resumen visual de división */}
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] text-[#606060]">Total con propina</span>
                  <span className="text-[11px] font-bold text-[#f0f0f0]">${formatPrecio(totalConPropina)}</span>
                </div>
                <div className="h-px bg-[#2a2a2a] mb-2"/>
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-[#606060]">Cada persona paga</span>
                  <span className="text-[16px] font-black text-[#d4943a]">
                    ${formatPrecio(Math.round(totalConPropina / dividirPax))}
                  </span>
                </div>
                {/* Chips por persona */}
                <div className="flex flex-wrap gap-1 mt-2">
                  {Array.from({length:dividirPax},(_,i)=>(
                    <span key={i} className="text-[10px] bg-[#d4943a]/10 text-[#d4943a] border border-[#d4943a]/20 px-2 py-0.5 rounded-full font-bold">
                      P{i+1} · ${formatPrecio(Math.round(totalConPropina/dividirPax))}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>

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
  const [juegoPremio, setJuegoPremio] = useState<'ruleta'|'cartas'|null>(null);
  const [clienteTableId, setClienteTableId] = useState<number>(1);
  const [clientePropina, setClientePropina] = useState<number>(10);
  const [clienteRating, setClienteRating] = useState<number>(0);
  const [clienteRatings, setClienteRatings] = useState({ comida: 0, servicio: 0, ambiente: 0 });
  // X-CARE / NEXUM Feedback estados
  const [xcareStep, setXcareStep] = useState<'sentiment'|'cat'|'sub'|'comentario'|'done'>('sentiment');
  const [xcareSubIdx, setXcareSubIdx] = useState(0);
  const [xcareSel, setXcareSel] = useState<Record<string,string[]>>({});
  const encTimerRef = useRef<number|null>(null);
  const [feedbackMesa, setFeedbackMesa] = useState('');
  const [feedbackTipo, setFeedbackTipo] = useState<'nota'|'alerta'|'felicitacion'>('nota');
  const [showPropCustom, setShowPropCustom] = useState(false);
  const [customPropina, setCustomPropina] = useState(0);
  const [propinaSubStep, setPropinaSubStep] = useState<'legal'|'reconocimiento'>('legal');
  const [propinaIntent, setPropinaIntent] = useState<'aceptar'|'otro'>('aceptar');
  const [divClientePax, setDivClientePax] = useState(1);
  const [platosDia, setPlatosDia]         = useState<any[]>([]);
  const [reservasHoy, setReservasHoy] = useState<any[]>([]);

  // ── Cobro Xpress — modal rápido: total + propina + método → cobra y cierra ──
  const [xpressOpen, setXpressOpen]       = useState(false);
  const [xpressMetodo, setXpressMetodo]   = useState<'Datafono'|'Efectivo'|'Transferencia'|'Tarjeta'>('Datafono');
  const [xpressPropPct, setXpressPropPct] = useState<0|10>(10);
  const [xpressProcesando, setXpressProcesando] = useState(false);

  // ── Cobro Gerencia — ventana propia (PIN → descuentos hasta 100% + bonos) ──
  const [gerOpen, setGerOpen] = useState(false);
  const [gerPinOk, setGerPinOk] = useState(false);
  const [gerPin, setGerPin] = useState('');
  const [gerPinErr, setGerPinErr] = useState('');
  const [gerDescPct, setGerDescPct] = useState(0);
  const [gerDescMotivo, setGerDescMotivo] = useState('');
  const [gerBonoCode, setGerBonoCode] = useState('');
  const [gerBono, setGerBono] = useState<any>(null);
  const [gerBonoMsg, setGerBonoMsg] = useState('');
  const [gerMetodo, setGerMetodo] = useState('Datafono');
  // Historial del cliente para el Cobro Gerencia: gasto total, ticket promedio
  // y última encuesta (estrellas). Clave para decidir cortesías/descuentos.
  const [gerCliente, setGerCliente] = useState<any>(null);
  useEffect(() => {
    if (!gerOpen || !gerPinOk) { setGerCliente(null); return; }
    const num = selectedTable?.num;
    const tel = String((selectedTable as any)?.cliente_telefono || clientesPorMesa[num as number]?.telefono || '').trim();
    const nombre = String((selectedTable as any)?.cliente_nombre || clientesPorMesa[num as number]?.nombreCompleto || selectedTable?.cliente || '').trim();
    (async () => {
      try {
        let cust:any = null;
        if (tel.length >= 7) {
          const { data } = await supabase.from('customers').select('id,name,total_visits,total_spent,promedio_ticket,score,vip_status').eq('phone', tel).limit(1).maybeSingle();
          cust = data;
        }
        if (!cust && nombre && !['mesa','cliente','mesa sin reserva'].includes(nombre.toLowerCase())) {
          const { data } = await supabase.from('customers').select('id,name,total_visits,total_spent,promedio_ticket,score,vip_status').ilike('name', nombre).limit(1).maybeSingle();
          cust = data;
        }
        if (!cust) { setGerCliente(null); return; }
        let estrellas:any = null, comentario = '';
        if (tel.length >= 7) {
          const { data: enc } = await supabase.from('xcare_encuestas').select('estrellas,comentario,created_at').eq('cliente_telefono', tel).order('created_at',{ascending:false}).limit(1).maybeSingle();
          if (enc) { estrellas = enc.estrellas; comentario = enc.comentario || ''; }
        }
        const ticketProm = cust.promedio_ticket || (cust.total_visits ? Math.round((cust.total_spent||0)/cust.total_visits) : 0);
        setGerCliente({ ...cust, ticketProm, ultimaEstrellas: estrellas, ultimoComentario: comentario });
      } catch { setGerCliente(null); }
    })();
  }, [gerOpen, gerPinOk, selectedTable?.num]);

  // ── Bandeja de Cobros Pendientes (pasar la cuenta a otra tablet/caja) ──
  const [cobrosPendientes, setCobrosPendientes] = useState<any[]>([]);
  const [showCaja, setShowCaja] = useState(false);
  const [cajaCobro, setCajaCobro] = useState<any>(null);
  const [cajaMetodo, setCajaMetodo] = useState('Datafono');
  useEffect(() => {
    const fetchPend = async () => {
      const { data } = await supabase.from('cobros_pendientes')
        .select('*').eq('restaurante_id', restauranteId).eq('estado','pendiente')
        .order('solicitado_at',{ascending:false});
      setCobrosPendientes(data || []);
    };
    fetchPend();
    const ch = supabase.channel('cobros-pendientes-live')
      .on('postgres_changes',{event:'*',schema:'public',table:'cobros_pendientes'}, fetchPend)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);

  // Mesero envía la cuenta a caja: toma una foto de la cuenta y la comparte.
  const enviarACaja = async () => {
    const num = selectedTable?.num;
    if (num == null) { showToast('Selecciona una mesa'); return; }
    const items = [...pendingOrder, ...order].filter((o:any)=>o.mesa===num).map((o:any)=>({ nombre:o.nombre, precio:o.precio, emoji:o.emoji||'🍽️' }));
    if (items.length === 0 && !mesaSubtotal) { showToast('⚠️ La cuenta está vacía'); return; }
    const cli = clientesPorMesa[num as number];
    try {
      await supabase.from('cobros_pendientes').update({ estado:'cancelado' }).eq('restaurante_id', restauranteId).eq('mesa_num',num).eq('estado','pendiente');
      await supabase.from('cobros_pendientes').insert({
        restaurante_id: restauranteId, mesa_num:num, mesa_name:String((selectedTable as any)?.name ?? num),
        cliente_nombre: (selectedTable as any)?.cliente_nombre || cli?.nombreCompleto || selectedTable?.cliente || '',
        cliente_telefono: (selectedTable as any)?.cliente_telefono || cli?.telefono || '',
        total: mesaSubtotal + Math.round(mesaSubtotal*0.08),
        propina: Math.round(mesaSubtotal*0.10),
        items, mesero: miNombre, estado:'pendiente', solicitado_at: new Date().toISOString(),
      });
      showToast(`📤 Cuenta de Mesa ${num} enviada a caja`);
    } catch(e){ console.error('enviar a caja', e); showToast('Error al enviar a caja'); }
  };

  // Caja cobra una cuenta pendiente desde otra tablet.
  const cobrarPendiente = async (p:any, metodo:string) => {
    try {
      await supabase.from('cobros_trazabilidad').insert({ restaurante_id: restauranteId, mesa_numero:p.mesa_num, mesero:miNombre, total:p.total, propina:p.propina||0, propina_pct:0, metodo_pago:metodo, platos_servidos:(p.items||[]).length, factura_tipo:'caja', factura_email:null }).then(()=>{}).catch(()=>{});
      await supabase.from('cobros_pendientes').update({ estado:'cobrado', cobrado_por:miNombre, metodo_pago:metodo, cobrado_at:new Date().toISOString() }).eq('id', p.id);
      const mesaName = String(p.mesa_name ?? p.mesa_num ?? '');
      if (mesaName) { try { await supabase.rpc('cerrar_mesa', { p_mesa_name: mesaName }); } catch {} }
      await limpiarMesaCerrada(p.mesa_num);
      setCajaCobro(null);
      showToast(`✓ Mesa ${p.mesa_num} cobrada en caja · $${formatPrecio(p.total)} · ${metodo}`);
    } catch(e){ console.error('cobrar pendiente', e); showToast('Error al cobrar'); }
  };

  const abrirGerencia = (tableId: number) => {
    setSelectedTableId(tableId);
    setGerOpen(true); setGerPinOk(false); setGerPin(''); setGerPinErr('');
    setGerDescPct(0); setGerDescMotivo(''); setGerBonoCode(''); setGerBono(null); setGerBonoMsg(''); setGerMetodo('Datafono');
  };

  // ── Cobro Xpress — rápido sin survey: 1 método + propina + cerrar ──────
  const abrirXpress = (tableId: number) => {
    setSelectedTableId(tableId);
    setXpressMetodo('Datafono'); setXpressPropPct(10); setXpressProcesando(false);
    setXpressOpen(true);
  };

  const procesarXpress = async () => {
    if (xpressProcesando) return;
    const mesa = displayTables.find(x => x.id === selectedTableId);
    const num  = mesa?.num;
    if (num == null) { showToast('⚠️ Mesa inválida'); return; }
    setXpressProcesando(true);
    try {
      const items   = order.filter(o => o.mesa === num);
      const subtotal = mesa?.ticket || 0;
      const iva      = Math.round(subtotal * 0.08);
      const neto     = subtotal;
      const propina  = Math.round(subtotal * (xpressPropPct/100));
      const total    = neto + iva + propina;
      const ahora    = new Date();
      const meseroNombre = miNombre;
      const facturaId    = `fac_xp_${Date.now()}_${num}`;

      // 1) Facturación — registro principal
      await supabase.from('facturacion').insert({
        restaurante_id: restauranteId,
        mesa_num: num,
        mesero: meseroNombre,
        items: items.map((it:any)=>({nombre:it.nombre, precio:it.precio, estado:it.estado})),
        subtotal: neto,
        iva,
        propina,
        descuento: 0,
        total,
        metodo_pago: xpressMetodo,
        factura_tipo: 'xpress',
        cliente_email: null,
        puntos_generados: 0,
        cerrada_en: ahora.toISOString(),
        fecha: ahora.toISOString().split('T')[0],
        hora:  ahora.toLocaleTimeString('es-CO',{hour:'2-digit',minute:'2-digit'}),
      }).then(()=>{}, e=>console.error('xpress facturacion', e));

      // 2) Trazabilidad para dashboard de cobros
      await supabase.from('cobros_trazabilidad').insert({
        restaurante_id: restauranteId,
        mesa_numero: num,
        mesero: meseroNombre,
        total, propina, propina_pct: xpressPropPct,
        metodo_pago: xpressMetodo,
        platos_servidos: items.length,
        factura_tipo: 'xpress',
        factura_email: null,
      }).then(()=>{}, ()=>{});

      // 3) Propina → motor NEXUM TIP NETWORK V5
      if (propina > 0 && meseroNombre) {
        await supabase.from('ticket_participants').insert({
          factura_id: facturaId,
          restaurante_id: restauranteId,
          empleado_nombre: meseroNombre,
          tag_code: 'MESA_OWNER',
          rol_en_factura: 'MESA_OWNER',
          contribution_pct: 100,
          venta_generada: total,
          upselling_items: 0,
        }).then(()=>{}, ()=>{});
        await supabase.rpc('process_tip_event', {
          p_factura_id:  facturaId,
          p_restaurante: restauranteId,
          p_tip_amount:  propina,
          p_total:       total,
          p_pct_propina: xpressPropPct,
          p_mesa_num:    num,
          p_turno:       ahora.getHours() < 16 ? 'mediodia' : 'noche',
          p_fecha:       ahora.toISOString().split('T')[0],
          p_hora:        ahora.toLocaleTimeString('es-CO',{hour:'2-digit',minute:'2-digit'}),
        }).then(()=>{}, ()=>{});
        await supabase.from('propinas').insert({
          restaurante_id: restauranteId,
          mesa_num: num,
          mesero_nombre: meseroNombre,
          monto_cuenta: total,
          pct_propina: xpressPropPct,
          monto_propina: propina,
          metodo_pago: xpressMetodo,
          turno: ahora.getHours() < 16 ? 'mediodia' : 'noche',
          fecha: ahora.toISOString().split('T')[0],
          hora:  ahora.toLocaleTimeString('es-CO',{hour:'2-digit',minute:'2-digit'}),
        }).then(()=>{}, ()=>{});
      }

      // 4) Cerrar orden + mesa
      const { data: ordenes } = await supabase.from('orders').select('id')
        .eq('table_id', num).eq('status','open').limit(1);
      if (ordenes?.[0]) {
        await supabase.from('orders').update({ status:'closed' }).eq('id', ordenes[0].id);
        await supabase.from('order_items').update({ status:'served' }).eq('order_id', ordenes[0].id).neq('status','cancelled');
      }
      const mesaName = String((mesa as any)?.name ?? num);
      try { await supabase.rpc('cerrar_mesa', { p_mesa_name: mesaName }); } catch {}
      limpiarMesaCerrada(num);
      setXpressOpen(false);
      showToast(`⚡ Mesa ${num} cobrada Xpress · $${formatPrecio(total)} · ${xpressMetodo}`);
    } catch (e) {
      console.error('xpress', e);
      showToast('Error al cobrar');
    } finally {
      setXpressProcesando(false);
    }
  };

  const validarBonoGer = async () => {
    const code = gerBonoCode.trim().toUpperCase();
    if (!code) return;
    const { data } = await supabase.from('bonos_regalo').select('*').eq('codigo', code).eq('activo', true).eq('usado', false).limit(1);
    const b = data?.[0];
    if (!b) { setGerBonoMsg('❌ Bono no válido o ya usado'); setGerBono(null); return; }
    const texto = `${b.beneficio || ''} ${b.descripcion || ''}`;
    const pctM = texto.match(/(\d{1,3})\s*%/);
    const montoM = texto.match(/\$\s*([\d.,]+)/);
    const pct = pctM ? Math.min(100, parseInt(pctM[1])) : 0;
    const monto = !pct && montoM ? parseInt(montoM[1].replace(/[.,]/g, '')) : 0;
    setGerBono({ ...b, pct, monto });
    setGerBonoMsg(`✓ ${b.beneficio || b.descripcion || 'Bono aplicado'}`);
  };

  // ── Mapa de mesas ──────────────────────────────────────────────────────
  const [showMapaMesas, setShowMapaMesas] = useState(false);
  const [chatIAOpen, setChatIAOpen]       = useState(false);
  const [mesasEstado, setMesasEstado] = useState<any[]>([]);
  // Auto-abrir el mapa al loguearse un mesero (queda guardado en sessionStorage
  // para que no se vuelva a abrir si el mesero lo cierra manualmente)
  useEffect(() => {
    if (profile?.role !== 'mesero') return;
    try {
      const key = `nx_mesero_abierto_${profile?.id || 'u'}`;
      if (sessionStorage.getItem(key)) return;
      sessionStorage.setItem(key, '1');
      setShowMapaMesas(true);
    } catch { setShowMapaMesas(true); }
  }, [profile?.id, profile?.role]);

  // ── Filtrado de notificaciones por mesero ────────────────────────────
  // Cada mesero solo ve lo de SUS mesas/pedidos; gerencia ve todo; los
  // avisos sin mesa (chat, generales, 86) son broadcast para todo el equipo.
  const esMiaNotif = useCallback((mesaNum:any, meseroField:any) => {
    if (accesoSalon) return true;
    const yo = String(profile?.nombre_completo || profile?.full_name || '').trim().toLowerCase();
    if (!yo) return false;
    const yoCorto = yo.split(' ')[0];
    const coincide = (v:any) => {
      const s = String(v||'').trim().toLowerCase();
      if (!s) return false;
      return s === yo || s === yoCorto || s.split(' ')[0] === yoCorto;
    };
    if (coincide(meseroField)) return true;
    if (mesaNum != null && mesaNum !== '') {
      const mesa = mesasEstado.find((m:any)=>String(m.name)===String(mesaNum));
      if (mesa) {
        if (coincide(mesa.mesero_nombre)) return true;
        const comp = Array.isArray(mesa.meseros_compartidos) ? mesa.meseros_compartidos : [];
        if (comp.some(coincide)) return true;
      }
    }
    return false;
  }, [accesoSalon, profile, mesasEstado]);
  const esMiaRef = useRef(esMiaNotif);
  useEffect(() => { esMiaRef.current = esMiaNotif; }, [esMiaNotif]);
  // Home del mesero: al entrar al POS abre el mapa con sus mesas asignadas.
  const homeAbiertoRef = useRef(false);
  useEffect(() => {
    if (homeAbiertoRef.current || !profile?.role) return;
    homeAbiertoRef.current = true;
    if (!accesoSalon) setShowMapaMesas(true);
  }, [profile?.role, accesoSalon]);
  // Platos listos: siempre tienen mesa/mesero → solo el dueño + gerencia
  const flowAlertasVisibles = flowAlertas.filter((a:any)=> (a.mesa_num==null && !a.mesero) ? true : esMiaNotif(a.mesa_num, a.mesero));
  // Notificaciones: con mesa → dueño + gerencia; sin mesa → broadcast a todos
  const notifsVisibles = notifs.filter((n:any)=> n.mesa_numero == null ? true : esMiaNotif(n.mesa_numero, n.creado_por));

  const [formAbrirMesa, setFormAbrirMesa] = useState<{mesa:any,pax:number,cliente:string,telefono:string,email:string,vip:boolean}|null>(null);
  const [clienteCRM, setClienteCRM] = useState<any>(null);
  const [pinDesbloqueo, setPinDesbloqueo] = useState('');
  const [mesaDesbloquear, setMesaDesbloquear] = useState<any>(null);
  const [dividirPax, setDividirPax] = useState(1);
  // Edición de cuenta con PIN Maître
  const [editCuenta, setEditCuenta] = useState(false);
  const [pinMaitre, setPinMaitre] = useState('');
  const [pinMaitreError, setPinMaitreError] = useState('');
  const [pinMaitreOk, setPinMaitreOk] = useState(false);
  // Índices (en itemsCliente) de los platos eliminados — por instancia, no por nombre,
  // para que al borrar 1 de 10 platos iguales solo se elimine ese.
  const [itemsEliminados, setItemsEliminados] = useState<number[]>([]);
  const [motivoEdicion, setMotivoEdicion] = useState('');
  // Factura
  const [facturaCorreo, setFacturaCorreo] = useState('');
  const [facturaCorreoOculto, setFacturaCorreoOculto] = useState(false);
  const [facturaTipo, setFacturaTipo] = useState<'digital'|'correo'|'electronica'>('digital');
  // Pago mixto
  const [pagoMixto, setPagoMixto] = useState(false);
  const [pagoEfectivo, setPagoEfectivo] = useState(0);
  const [pagoTarjeta, setPagoTarjeta] = useState(0);
  const [xcareTags, setXcareTags] = useState<string[]>([]);
  const [xcarePlatos, setXcarePlatos] = useState<string[]>([]);
  const [xcareMicro, setXcareMicro] = useState<string[]>([]);
  const [xcareComentario, setXcareComentario] = useState('');

  const abrirModoCliente = async (tableId: number) => {
    setClienteTableId(tableId);
    setClientePaso('cuenta');
    setClientePropina(10);
    setClienteRating(0);
    setClienteRatings({ comida: 0, servicio: 0, ambiente: 0 });
    setXcareStep('sentiment'); setXcareSubIdx(0); setXcareSel({});
    setXcareTags([]); setXcarePlatos([]); setXcareMicro([]); setXcareComentario('');
    setJuegoPremio(null);
    setEditCuenta(false); setPinMaitreOk(false); setPinMaitre(''); setItemsEliminados([]);
    setFacturaTipo('correo'); setFacturaCorreo(''); setPagoMixto(false);
    setPropinaSubStep('legal'); setCustomPropina(0); setShowPropCustom(false);
    setPropinaIntent('aceptar'); setClientePropina(10);
    setClienteMode(true);
    closeModal();

    // Pre-cargar datos del cliente sentado en esta mesa (factura por correo)
    const mesa = displayTables.find(x => x.id === tableId);
    const mesaNum = mesa?.num;
    if (!mesaNum) return;
    // 1) Fuente primaria: cliente ya cargado en memoria para la mesa.
    const cliMem = clientesPorMesa[mesaNum];
    if (cliMem?.email) { setFacturaCorreo(cliMem.email); return; }
    // 2) Respaldo: consultar reservas si no hay email en memoria.
    const hoy = new Date().toISOString().split('T')[0];
    try {
      const [{ data: rv }, { data: oy }] = await Promise.all([
        supabase.from('reservations').select('cliente_email,cliente_nombre,cliente_telefono')
          .eq('restaurante_id', restauranteId).eq('fecha',hoy).eq('mesa_num',mesaNum)
          .in('estado',['sentada','confirmada']).limit(1),
        supabase.from('ohyeah_reservas').select('guest_email,guest_name,guest_phone')
          .eq('date',hoy).in('status',['seated','sentada','confirmed','confirmada'])
          .limit(20),
      ]);
      const email = rv?.[0]?.cliente_email
        || oy?.find((r:any)=> r.guest_name && mesa?.cliente && r.guest_name.toLowerCase().includes(String(mesa.cliente).toLowerCase().split(' ')[0]))?.guest_email
        || '';
      if (email) setFacturaCorreo(email);
    } catch { /* sin email registrado, el campo queda vacío */ }
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

  const anotarRecomendacion = (txt: string) => {
    setNotasMesero(prev => {
      const notes = prev[selectedTable.id] || [];
      if (notes.includes(txt)) { showToast('Ya anotado anteriormente'); return prev; }
      showToast(`📝 Anotado para Mesa ${selectedTable.num}`);
      return { ...prev, [selectedTable.id]: [...notes, txt] };
    });
  };

  const mesaCliente = displayTables.find(x => x.id === clienteTableId) || displayTables[0];
  // Datos del cliente sentado en la mesa (para la factura).
  const clienteSentado = clientesPorMesa[mesaCliente?.num] || {};
  const emailClienteSentado = clienteSentado.email || '';
  const itemsCliente = order.filter(o => o.mesa === mesaCliente?.num);
  // mesaCliente.ticket ya incluye el pedido local (ver displayTables); no re-sumar.
  // Restar los platos que el Maître haya eliminado de la cuenta.
  const totalEliminadoCliente = itemsCliente
    .filter((_, idx) => itemsEliminados.includes(idx))
    .reduce((s, i) => s + parsePrecio(i.precio), 0);
  const subtotalCliente = Math.max(0, (mesaCliente?.ticket || 0) - totalEliminadoCliente);
  const descuentoCliente = Math.round(subtotalCliente * (posDescuento / 100));
  const corteCliente = posCorte;
  const netoCliente = Math.max(0, subtotalCliente - descuentoCliente - corteCliente);
  const ivaCliente = Math.round(netoCliente * 0.08);
  const baseCliente = netoCliente + ivaCliente;
  const propinaCliente = customPropina > 0 && clientePropina === 0
    ? customPropina
    : Math.round(baseCliente * (clientePropina / 100));
  const totalCliente = baseCliente + propinaCliente;
  const nombreMesero = profile?.nombre_completo?.split(' ')[0] || 'tu mesero';

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
          <div style={{ padding: '56px 20px 16px', display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0 }}>
            <div style={{ width: 64, height: 64, borderRadius: '50%', background: '#fff', border: `1px solid ${S.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 16, boxShadow: '0 2px 12px rgba(0,0,0,0.06)' }}>
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
                  {itemsCliente.map((item,idx)=> itemsEliminados.includes(idx) ? null : (
                    <div key={idx} style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'8px 10px', background:'#fff', borderRadius:8, border:'1px solid #eee' }}>
                      <span style={{ fontSize:13 }}>{item.nombre}</span>
                      <button onClick={()=>setItemsEliminados(p=>[...p,idx])} style={{ background:'rgba(224,80,80,0.1)', border:'1px solid rgba(224,80,80,0.3)', color:'#e05050', fontSize:11, fontWeight:700, padding:'3px 10px', borderRadius:6, cursor:'pointer' }}>✕ Eliminar</button>
                    </div>
                  ))}
                  {itemsEliminados.length>0&&(
                    <div style={{ fontSize:11, color:'#e05050' }}>Eliminados: {itemsEliminados.map(idx=>itemsCliente[idx]?.nombre).filter(Boolean).join(', ')} — guardado en facturas pendientes</div>
                  )}
                </div>
                <input value={motivoEdicion} onChange={e=>setMotivoEdicion(e.target.value)} placeholder="Motivo de la edición..." style={{ width:'100%', padding:'8px 12px', borderRadius:8, border:'1px solid #ddd', fontSize:12, outline:'none', marginBottom:8 }}/>
                <button onClick={async()=>{
                  if(itemsEliminados.length&&motivoEdicion){
                    await supabase.from('cuenta_ediciones').insert({
                      restaurante_id: restauranteId, mesa_numero:mesaCliente.num, tipo:'eliminar_plato',
                      plato_nombre:itemsEliminados.map(idx=>itemsCliente[idx]?.nombre).filter(Boolean).join(', '), motivo:motivoEdicion,
                      autorizado_por:'Maître', mesero:miNombre, estado:'aprobado', notificado_caja:true,
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
                  <span style={{ fontSize:10, color:'#3dba6f', background:'rgba(61,186,111,0.12)', padding:'2px 8px', borderRadius:20, fontWeight:700, border:'1px solid rgba(61,186,111,0.25)' }}>✓ Entregado</span>
                  <span style={{ fontSize: 16, fontWeight: 600, color: S.text }}>${formatPrecio(mesaCliente.ticket)}</span>
                </div>
              </div>
            )}
            {itemsCliente.map((item, i) => itemsEliminados.includes(i) ? null : (
              <div key={i} style={{ display: 'flex', alignItems: 'center', padding: '14px 0', borderBottom: `1px solid ${S.border}` }}>
                <div style={{ width: 28, height: 28, borderRadius: '50%', background: S.bg2, border: `1px solid ${S.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, flexShrink: 0, marginRight: 12 }}>{item.emoji||'🍽️'}</div>
                <span style={{ flex: 1, fontSize: 15, color: S.text }}>{item.nombre}</span>
                <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                  <span style={{ fontSize:9, padding:'2px 8px', borderRadius:20, fontWeight:700, background:item.estado==='serving'?'rgba(0,230,118,0.15)':item.estado==='preparing'?'rgba(255,181,71,0.15)':'rgba(255,255,255,0.06)', color:item.estado==='serving'?'#00E676':item.estado==='preparing'?'#FFB547':'#606060' }}>
                    {item.estado==='serving'?'✅ Entregado':item.estado==='preparing'?'🍳 Preparando':'⏳ Pendiente'}
                  </span>
                  <span style={{ display:'none', fontSize:10, padding:'2px 8px', borderRadius:20, fontWeight:700, background:'rgba(61,186,111,0.12)', color:'#3dba6f', border:'1px solid rgba(61,186,111,0.25)' }}>✓ Listo</span>
                  <span style={{ fontSize: 15, color: S.text }}>{item.precio}</span>
                </div>
              </div>
            ))}
            {/* IVA */}
            <div style={{ display: 'flex', alignItems: 'center', padding: '14px 0', borderBottom: `1px solid ${S.border}` }}>
              <div style={{ width: 28, height: 28, borderRadius: '50%', background: S.bg2, border: `1px solid ${S.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, color: S.text3, flexShrink: 0, marginRight: 12 }}>%</div>
              <span style={{ flex: 1, fontSize: 16, color: S.text2 }}>Impoconsumo</span>
                <span style={{ fontSize:9, background:'rgba(255,181,71,0.15)', color:'#FFB547', padding:'2px 6px', borderRadius:20, fontWeight:700, marginRight:6 }}>8%</span>
              <span style={{ fontSize: 16, color: S.text2 }}>${formatPrecio(ivaCliente)}</span>
            </div>
          </div>

          {/* Factura */}
          <div style={{ padding:'12px 20px' }}>
            <div style={{ fontSize:11, color:S.text3, fontWeight:700, marginBottom:8, textTransform:'uppercase', letterSpacing:'.06em' }}>Tipo de factura</div>
            <div style={{ display:'flex', gap:6, marginBottom:12 }}>
              {([
                {id:'fisica',     l:'Física',       icon:'🖨️', desc:'Impresión en caja'},
                {id:'correo',     l:'Por correo',   icon:'✉️',  desc:'Al email registrado'},
                {id:'electronica',l:'Electrónica',  icon:'🏢',  desc:'Para empresa / NIT'},
              ] as const).map(f=>(
                <button key={f.id} onClick={()=>setFacturaTipo(f.id)}
                  style={{ flex:1, padding:'8px 6px', borderRadius:10, border:`1px solid ${facturaTipo===f.id?S.black:'#ddd'}`, background:facturaTipo===f.id?S.black:'#fff', color:facturaTipo===f.id?'#fff':S.text2, fontSize:10, fontWeight:700, cursor:'pointer', textAlign:'center' }}>
                  <div style={{fontSize:18,marginBottom:2}}>{f.icon}</div>
                  <div>{f.l}</div>
                  <div style={{fontSize:9,opacity:.6,marginTop:1}}>{f.desc}</div>
                </button>
              ))}
            </div>

            {/* ── FÍSICA — solo aviso de impresión ── */}
            {facturaTipo==='fisica' && (
              <div style={{padding:'10px 14px',background:'rgba(61,186,111,0.08)',border:'1px solid rgba(61,186,111,0.2)',borderRadius:10,display:'flex',alignItems:'center',gap:8}}>
                <span style={{fontSize:20}}>🖨️</span>
                <div>
                  <div style={{fontSize:12,fontWeight:700,color:'#3dba6f'}}>Factura física</div>
                  <div style={{fontSize:10,color:'#888'}}>Se imprimirá automáticamente al cobrar</div>
                </div>
              </div>
            )}

            {/* ── CORREO — jalar email del cliente ── */}
            {facturaTipo==='correo' && (
              <div>
                <div style={{fontSize:10,color:S.text3,fontWeight:700,marginBottom:5}}>Email del cliente</div>
                <div style={{position:'relative'}}>
                  <input value={facturaCorreo} onChange={e=>setFacturaCorreo(e.target.value)}
                    placeholder={emailClienteSentado || 'correo@email.com'}
                    type={facturaCorreoOculto?'password':'email'}
                    style={{ width:'100%', padding:'10px 44px 10px 14px', borderRadius:10, border:'1px solid #ddd', fontSize:13, outline:'none' }}/>
                  <button onClick={()=>setFacturaCorreoOculto(p=>!p)} style={{position:'absolute',right:10,top:'50%',transform:'translateY(-50%)',background:'none',border:'none',cursor:'pointer',fontSize:16}}>
                    {facturaCorreoOculto?'👁️':'🙈'}
                  </button>
                </div>
                {emailClienteSentado && !facturaCorreo && (
                  <button onClick={()=>setFacturaCorreo(emailClienteSentado)}
                    style={{marginTop:6,fontSize:10,color:'#448AFF',background:'none',border:'none',cursor:'pointer',padding:0}}>
                    ↳ Usar email registrado: {emailClienteSentado}
                  </button>
                )}
                <div style={{fontSize:11,color:'#999',marginTop:6,display:'flex',alignItems:'center',gap:6}}>
                  <input type="checkbox" checked={facturaCorreoOculto} onChange={e=>setFacturaCorreoOculto(e.target.checked)} style={{cursor:'pointer'}}/>
                  Ocultar correo (protección de datos)
                </div>
              </div>
            )}

            {/* ── ELECTRÓNICA — formulario completo ── */}
            {facturaTipo==='electronica' && (
              <div style={{display:'flex',flexDirection:'column',gap:8}}>
                <div style={{fontSize:10,color:'#888',marginBottom:2}}>
                  Completa los datos para la factura electrónica DIAN
                </div>
                {[
                  {k:'facElNombre',   l:'Nombre / Razón social *', ph: clienteSentado.nombre || 'Empresa o persona natural'},
                  {k:'facElNit',      l:'Cédula o NIT *',          ph:'123456789-0'},
                  {k:'facElCorreo',   l:'Correo electrónico',       ph: emailClienteSentado || 'facturacion@empresa.com'},
                  {k:'facElTel',      l:'Teléfono',                 ph: clienteSentado.telefono || '+57 300 000 0000'},
                  {k:'facElDir',      l:'Dirección',                ph:'Calle 123 # 45-67, Bogotá'},
                ].map(f=>(
                  <div key={f.k}>
                    <div style={{fontSize:10,color:S.text3,fontWeight:600,marginBottom:3}}>{f.l}</div>
                    <input
                      value={(window as any)[`__facEl_${f.k}`] || ''}
                      onChange={e=>{(window as any)[`__facEl_${f.k}`]=e.target.value;}}
                      placeholder={f.ph}
                      style={{width:'100%',padding:'8px 12px',borderRadius:8,border:'1px solid #ddd',fontSize:12,outline:'none'}}/>
                  </div>
                ))}
              </div>
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

      {/* ═══ PASO 2: PROPINA — diseño Nexum, 2 pantallas (legal + reconocimiento) ═══ */}
      {clientePaso === 'propina' && (() => {
        // Paleta Nexum
        const N = {
          bg:'#FFFFFF', ink:'#1A1A2E', ink2:'#4A4A5E', ink3:'#8A8AA0',
          violet:'#7C3AED', violetD:'#5B21B6', violetL:'#F3EEFE',
          violetXL:'#FAF7FF', border:'#EDE9F6',
          yellow:'#FFF6E8', yellowI:'#F59E0B',
          green:'#E8F8EE', greenI:'#10B981',
          blue:'#EEF2FE', blueI:'#3B82F6',
        };
        const baseDiez = Math.round(baseCliente * 0.10);
        const pctActual = customPropina>0 && clientePropina===0
          ? Math.round((customPropina / Math.max(baseCliente,1)) * 100)
          : clientePropina;

        // ── Logo Nexum + mesa que se está cobrando ───────────────────
        const NexumMascot = () => (
          <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:12 }}>
            {/* Logo NEXUM oficial */}
            <div style={{ fontFamily:"'Syne',sans-serif", fontSize:42, fontWeight:900, color:N.ink, letterSpacing:'-0.02em', display:'flex', alignItems:'center', gap:1 }}>
              NE<span style={{ display:'inline-flex', alignItems:'center', justifyContent:'center', width:40, height:40 }}>
                <svg width="40" height="40" viewBox="0 0 22 22" fill="none"><path d="M3 4 L11 11 L3 18 M19 4 L11 11 L19 18" stroke={N.violet} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"/></svg>
              </span>UM
            </div>
            {/* Mesa que se está cobrando */}
            <div style={{ display:'inline-flex', alignItems:'center', gap:7, padding:'6px 16px', borderRadius:50, background:N.violetL, border:`1px solid ${N.border}` }}>
              <span style={{ fontSize:13 }}>🪑</span>
              <span style={{ fontSize:12.5, fontWeight:800, color:N.violet, letterSpacing:'0.02em' }}>Cobrando · Mesa {mesaCliente?.num ?? '—'}</span>
            </div>
          </div>
        );

        // ── Header común (logo NEXUM + back) ─────────────────────────
        const HeaderNexum = ({ onBack }: { onBack: ()=>void }) => (
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'12px 6px 6px', minHeight:40 }}>
            <button onClick={onBack} style={{ background:'transparent', border:'none', cursor:'pointer', padding:8, color:N.ink, display:'flex', alignItems:'center', justifyContent:'center', width:36, height:36 }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M15 6 L9 12 L15 18" stroke={N.ink} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/></svg>
            </button>
            <div style={{ fontFamily:"'Syne',sans-serif", fontSize:22, fontWeight:900, color:N.ink, letterSpacing:'-0.01em', display:'flex', alignItems:'center', gap:1 }}>
              NE<span style={{ display:'inline-flex', alignItems:'center', justifyContent:'center', width:22, height:22 }}>
                <svg width="22" height="22" viewBox="0 0 22 22" fill="none"><path d="M3 4 L11 11 L3 18 M19 4 L11 11 L19 18" stroke={N.violet} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"/></svg>
              </span>UM
            </div>
            <div style={{ width:36 }}/>
          </div>
        );

        // ── Card opción (radio list-style) ───────────────────────────
        const OpcionCard = ({ icon, iconBg, iconColor, title, subtitle, badge, badgeColor, selected, onClick }: {
          icon: React.ReactNode; iconBg: string; iconColor: string; title: string; subtitle: string;
          badge?: string; badgeColor?: string; selected: boolean; onClick: ()=>void;
        }) => (
          <button onClick={onClick}
            style={{
              width:'100%', display:'flex', alignItems:'center', gap:14,
              padding:'16px 18px', borderRadius:18,
              border:`2px solid ${selected?N.violet:N.border}`,
              background: selected? N.violetL : N.bg,
              cursor:'pointer', textAlign:'left', transition:'all 0.18s', outline:'none',
            }}>
            <div style={{ width:48, height:48, borderRadius:'50%', background:iconBg, display:'flex', alignItems:'center', justifyContent:'center', color:iconColor, fontSize:22, flexShrink:0 }}>
              {icon}
            </div>
            <div style={{ flex:1, minWidth:0 }}>
              <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:2 }}>
                <span style={{ fontFamily:"'Syne',sans-serif", fontSize:17, fontWeight:800, color:N.ink, letterSpacing:'-0.01em' }}>{title}</span>
                {badge && <span style={{ fontSize:10, fontWeight:700, color:'#fff', background:badgeColor||N.violet, padding:'3px 9px', borderRadius:20, letterSpacing:'.02em' }}>{badge}</span>}
              </div>
              <div style={{ fontSize:12, color:N.ink3, lineHeight:1.4 }}>{subtitle}</div>
            </div>
            <div style={{ width:22, height:22, borderRadius:'50%', border:`2px solid ${selected?N.violet:'#D5D2E0'}`, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, background:N.bg }}>
              {selected && <div style={{ width:12, height:12, borderRadius:'50%', background:N.violet }}/>}
            </div>
          </button>
        );

        // ── Banner informativo distribución de propina ───────────────
        const InfoCadena = () => (
          <div style={{ display:'flex', alignItems:'center', gap:12, padding:'14px 16px', background:N.violetL, borderRadius:14, border:`1px solid ${N.border}` }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" style={{flexShrink:0}}>
              <path d="M12 3 L20 7 V12 C20 16.5 16.5 20.5 12 22 C7.5 20.5 4 16.5 4 12 V7 Z" stroke={N.violet} strokeWidth="1.8" fill="none"/>
              <text x="12" y="15" fill={N.violet} fontSize="11" fontWeight="900" textAnchor="middle">i</text>
            </svg>
            <span style={{ fontSize:11.5, color:N.ink2, lineHeight:1.5, flex:1 }}>
              La propina se distribuye entre las personas que hacen parte de la cadena de servicio.
            </span>
            <svg width="34" height="22" viewBox="0 0 40 24" fill="none" style={{flexShrink:0}}>
              <circle cx="12" cy="9" r="4" stroke={N.violet} strokeWidth="1.6"/>
              <path d="M4 22 c0 -5 4 -8 8 -8 s8 3 8 8" stroke={N.violet} strokeWidth="1.6" fill="none"/>
              <circle cx="28" cy="9" r="4" stroke={N.violet} strokeWidth="1.6"/>
              <path d="M20 22 c0 -5 4 -8 8 -8 s8 3 8 8" stroke={N.violet} strokeWidth="1.6" fill="none"/>
              <path d="M28 4 l1.2 2 l2 .5 l-1.6 1.5 l.4 2.2 l-2 -1 l-2 1 l.4 -2.2 l-1.6 -1.5 l2 -.5 z" fill={N.violet}/>
            </svg>
          </div>
        );

        // ── Teclado numérico (estilo Nexum) ──────────────────────────
        const Teclado = ({ onConfirm, onCancel, sugeridos, title }: { onConfirm: ()=>void; onCancel: ()=>void; sugeridos: number[]; title:string }) => (
          <div style={{ background: N.violetXL, borderRadius: 18, padding: '18px', border: `1px solid ${N.border}` }}>
            <div style={{ fontSize: 11, color: N.ink3, marginBottom: 6, fontWeight: 700, textTransform:'uppercase', letterSpacing:'.06em' }}>{title}</div>
            <div style={{ textAlign:'center', fontSize:34, fontWeight:900, color:N.ink, marginBottom:14, minHeight:44, letterSpacing:'-0.02em', fontFamily:"'Syne',sans-serif" }}>
              {customPropina > 0 ? `$${customPropina.toLocaleString('es-CO')}` : '$ —'}
            </div>
            {/* % sugeridos — arriba */}
            <div style={{ fontSize:10, color:N.ink3, marginBottom:6, fontWeight:700, textTransform:'uppercase', letterSpacing:'.06em' }}>Sugerencias</div>
            <div style={{ display:'flex', gap:6, marginBottom:14 }}>
              {sugeridos.map(p=>(
                <button key={p} onClick={()=>setCustomPropina(Math.round(baseCliente*p/100))}
                  style={{ flex:1, padding:'11px 8px', borderRadius:12, border:`1px solid ${N.violet}30`, background:N.violetL, fontSize:11, fontWeight:700, color:N.violet, cursor:'pointer', outline:'none' }}>
                  {p}% · ${Math.round(baseCliente*p/100).toLocaleString('es-CO')}
                </button>
              ))}
            </div>
            {/* Calculadora — abajo */}
            <div style={{ fontSize:10, color:N.ink3, marginBottom:6, fontWeight:700, textTransform:'uppercase', letterSpacing:'.06em' }}>Monto manual</div>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:8, marginBottom:12 }}>
              {['1','2','3','4','5','6','7','8','9','000','0','⌫'].map(k=>(
                <button key={k} onClick={()=>{
                  if (k==='⌫') { setCustomPropina(p=>Math.floor(p/10)); return; }
                  setCustomPropina(p=>{ const n=p*(k==='000'?1000:10)+(k==='000'?0:parseInt(k)); return n<=9999999?n:p; });
                }}
                  style={{ padding:'16px 8px', borderRadius:12, border:`1px solid ${k==='⌫'?'rgba(239,68,68,0.3)':N.border}`, background:k==='⌫'?'rgba(239,68,68,0.06)':'#fff', fontSize:18, fontWeight:800, cursor:'pointer', color:k==='⌫'?'#ef4444':N.ink, outline:'none' }}>
                  {k}
                </button>
              ))}
            </div>
            <div style={{ display:'flex', gap:8 }}>
              <button onClick={onCancel}
                style={{ flex:1, padding:'13px', borderRadius:14, border:`1px solid ${N.border}`, background:'#fff', fontSize:13, fontWeight:700, color:N.ink2, cursor:'pointer', outline:'none' }}>
                Cancelar
              </button>
              <button onClick={onConfirm}
                disabled={customPropina<=0}
                style={{ flex:2, padding:'13px', borderRadius:14, border:'none', background:customPropina>0?N.violet:'#D5D2E0', color:'#fff', fontSize:14, fontWeight:800, cursor:customPropina>0?'pointer':'not-allowed', outline:'none', fontFamily:"'Syne',sans-serif" }}>
                Confirmar ${(customPropina||0).toLocaleString('es-CO')}
              </button>
            </div>
          </div>
        );

        // ╔═══════════════════════════════════════════════════════════╗
        // ║  PANTALLA 1 — Legal                                       ║
        // ╚═══════════════════════════════════════════════════════════╝
        if (propinaSubStep === 'legal') {
          const selAceptar = propinaIntent === 'aceptar';
          const selOtro    = propinaIntent === 'otro';
          return (
            <div style={{ flex:1, overflowY:'auto', background:N.bg, display:'flex', flexDirection:'column', padding:'8px 18px 24px' }}>
              <HeaderNexum onBack={()=>setClientePaso('cuenta')}/>

              <div style={{ display:'flex', justifyContent:'center', marginTop:8, marginBottom:14 }}>
                <NexumMascot/>
              </div>

              <div style={{ textAlign:'center', marginBottom:18 }}>
                <h1 style={{ fontFamily:"'Syne',sans-serif", fontSize:26, fontWeight:900, color:N.ink, lineHeight:1.1, margin:'0 0 12px', letterSpacing:'-0.02em' }}>
                  ¿Deseas incluir la<br/>propina sugerida?
                </h1>
                <p style={{ fontSize:13, color:N.ink2, lineHeight:1.55, margin:'0 auto', maxWidth:340 }}>
                  La propina es voluntaria según la Ley 1935 de 2018.<br/>
                  Este establecimiento sugiere el 10% del valor del servicio.<br/>
                  Puedes aceptarla, elegir otra cuantía o no incluirla libremente.
                </p>
              </div>

              {showPropCustom ? (
                <Teclado sugeridos={[10,15,20]} title="Propina personalizada"
                  onCancel={()=>{ setCustomPropina(0); setShowPropCustom(false); }}
                  onConfirm={()=>{ setClientePropina(0); setShowPropCustom(false); setPropinaIntent('otro'); setPropinaSubStep('reconocimiento'); }}/>
              ) : (
                <div style={{ display:'flex', flexDirection:'column', gap:12, marginBottom:18 }}>
                  <OpcionCard
                    icon={<span>🙂</span>} iconBg={N.violetL} iconColor={N.violet}
                    title="Aceptar 10%" subtitle="Incluir 10% de propina voluntaria"
                    badge="Sugerida" badgeColor={N.violet}
                    selected={selAceptar}
                    onClick={()=>{ setPropinaIntent('aceptar'); setCustomPropina(0); setClientePropina(10); }}/>
                  <OpcionCard
                    icon={<svg width="22" height="22" viewBox="0 0 24 24" fill="none"><path d="M14 4 l6 6 l-10 10 H4 v-6 l10 -10 z" stroke={N.violet} strokeWidth="2" strokeLinejoin="round"/></svg>}
                    iconBg={N.violetL} iconColor={N.violet}
                    title="Elegir otro valor" subtitle="Selecciona una cuantía diferente"
                    selected={selOtro}
                    onClick={()=>{ setPropinaIntent('otro'); }}/>
                </div>
              )}

              {!showPropCustom && <InfoCadena/>}

              {!showPropCustom && (
                <div style={{ marginTop:'auto', paddingTop:24, display:'flex', flexDirection:'column', gap:6 }}>
                  <button onClick={()=>{
                    if (propinaIntent === 'otro') { setShowPropCustom(true); setClientePropina(0); return; }
                    setCustomPropina(0); setClientePropina(10); setPropinaSubStep('reconocimiento');
                  }}
                    style={{ width:'100%', padding:'18px', borderRadius:50, border:'none', background:N.violet, color:'#fff', fontFamily:"'Syne',sans-serif", fontSize:16, fontWeight:800, cursor:'pointer', boxShadow:'0 8px 24px rgba(124,58,237,0.25)', outline:'none' }}>
                    Continuar
                  </button>
                  <button onClick={()=>{ setCustomPropina(0); setClientePropina(0); setClientePaso('pago'); }}
                    style={{ width:'100%', padding:'12px', background:'transparent', border:'none', color:N.violet, fontWeight:700, fontSize:14, cursor:'pointer', outline:'none' }}>
                    No incluir
                  </button>
                </div>
              )}
            </div>
          );
        }

        // ╔═══════════════════════════════════════════════════════════╗
        // ║  PANTALLA 2 — Reconocimiento adicional                    ║
        // ╚═══════════════════════════════════════════════════════════╝
        const isCustom = customPropina>0 && clientePropina===0;
        return (
          <div style={{ flex:1, overflowY:'auto', background:N.bg, display:'flex', flexDirection:'column', padding:'8px 18px 24px' }}>
            <HeaderNexum onBack={()=>{ setShowPropCustom(false); setPropinaSubStep('legal'); }}/>

            <div style={{ display:'flex', justifyContent:'center', marginTop:8, marginBottom:14 }}>
              <NexumMascot/>
            </div>

            <div style={{ textAlign:'center', marginBottom:18 }}>
              <h1 style={{ fontFamily:"'Syne',sans-serif", fontSize:24, fontWeight:900, color:N.ink, lineHeight:1.15, margin:'0 0 12px', letterSpacing:'-0.02em' }}>
                ¿Deseas dejar un<br/>reconocimiento adicional<br/>al equipo?
              </h1>
              <p style={{ fontSize:13, color:N.ink2, lineHeight:1.55, margin:'0 auto', maxWidth:360 }}>
                Si lo deseas, puedes aumentar voluntariamente el valor total de tu propina. Tú decides el porcentaje final como una muestra adicional de agradecimiento.
              </p>
            </div>

            {showPropCustom ? (
              <Teclado sugeridos={[15,20,25]} title="Porcentaje personalizado"
                onCancel={()=>{ setShowPropCustom(false); }}
                onConfirm={()=>{ setClientePropina(0); setShowPropCustom(false); }}/>
            ) : (
              <div style={{ display:'flex', flexDirection:'column', gap:12, marginBottom:18 }}>
                <OpcionCard
                  icon={<span>🙂</span>} iconBg={N.violetL} iconColor={N.violet}
                  title={pctActual && pctActual!==15 && pctActual!==20 ? `Mantener ${pctActual}%` : 'Mantener 10%'}
                  subtitle="Continuar con la propina ya seleccionada"
                  badge="Actual" badgeColor={N.violet}
                  selected={!isCustom && (pctActual===10 || (pctActual!==15 && pctActual!==20 && pctActual!==25))}
                  onClick={()=>{ setCustomPropina(0); setClientePropina(pctActual||10); }}/>
                <OpcionCard
                  icon={<span>😍</span>} iconBg={N.yellow} iconColor={N.yellowI}
                  title="15% total" subtitle="Un reconocimiento adicional al equipo"
                  selected={!isCustom && pctActual===15}
                  onClick={()=>{ setCustomPropina(0); setClientePropina(15); }}/>
                <OpcionCard
                  icon={<span>🤩</span>} iconBg={N.green} iconColor={N.greenI}
                  title="20% total" subtitle="Para una experiencia excepcional"
                  selected={!isCustom && pctActual===20}
                  onClick={()=>{ setCustomPropina(0); setClientePropina(20); }}/>
                <OpcionCard
                  icon={<svg width="22" height="22" viewBox="0 0 24 24" fill="none"><path d="M14 4 l6 6 l-10 10 H4 v-6 l10 -10 z" stroke={N.blueI} strokeWidth="2" strokeLinejoin="round"/></svg>}
                  iconBg={N.blue} iconColor={N.blueI}
                  title="Otro valor" subtitle="Ingresa el porcentaje total que deseas dejar"
                  selected={isCustom}
                  onClick={()=>setShowPropCustom(true)}/>
              </div>
            )}

            {!showPropCustom && <InfoCadena/>}

            {!showPropCustom && (
              <div style={{ marginTop:'auto', paddingTop:24, display:'flex', flexDirection:'column', gap:6 }}>
                <button onClick={()=>setClientePaso('pago')}
                  style={{ width:'100%', padding:'18px', borderRadius:50, border:'none', background:N.violet, color:'#fff', fontFamily:"'Syne',sans-serif", fontSize:16, fontWeight:800, cursor:'pointer', boxShadow:'0 8px 24px rgba(124,58,237,0.25)', outline:'none' }}>
                  Confirmar propina
                </button>
                <button onClick={()=>{ setShowPropCustom(false); setPropinaSubStep('legal'); }}
                  style={{ width:'100%', padding:'12px', background:'transparent', border:'none', color:N.violet, fontWeight:700, fontSize:14, cursor:'pointer', outline:'none' }}>
                  Volver
                </button>
              </div>
            )}
          </div>
        );
      })()}

      {/* ═══ PASO 3: MÉTODO DE PAGO ═══ */}
      {clientePaso === 'pago' && (
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px 32px', display: 'flex', flexDirection: 'column', gap: 12 }}>

          {/* Datafono con mesero */}
          <button onClick={async()=>{
              await supabase.from('cobros_trazabilidad').insert({ restaurante_id: restauranteId, mesa_numero:mesaCliente.num, mesero:miNombre, total:totalCliente, propina:propinaCliente, propina_pct:clientePropina, metodo_pago:'Datafono', platos_servidos:itemsCliente.length, factura_tipo:facturaTipo, factura_email:facturaCorreo||null }).then(()=>{}).catch(()=>{});
              await guardarFactura('Datafono');
              setClientePaso('encuesta');
            }}
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
              await supabase.from('cobros_trazabilidad').insert({ restaurante_id: restauranteId, mesa_numero:mesaCliente.num, mesero:miNombre, total:totalCliente, propina:propinaCliente, propina_pct:clientePropina, metodo_pago:'Efectivo', platos_servidos:itemsCliente.length, factura_tipo:facturaTipo, factura_email:facturaCorreo||null });
              await guardarFactura('Efectivo');
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
              <button onClick={()=>{ if(pagoEfectivo+pagoTarjeta===totalCliente){ guardarFactura('Mixto').then(()=>setClientePaso('encuesta')); } else showToast('⚠️ Los montos no coinciden'); }}
                style={{ width:'100%', padding:'10px', borderRadius:12, border:'none', background:pagoEfectivo+pagoTarjeta===totalCliente?'#3dba6f':'#ccc', color:'#fff', fontSize:13, fontWeight:700, cursor:'pointer' }}>
                ✓ Confirmar pago mixto
              </button>
            </div>
          )}
          {/* Dividir la cuenta — selector 2-10 */}
          <div style={{ background: '#f5f0e8', borderRadius: 16, border: `1px solid #e0d8cc`, overflow: 'hidden' }}>
            <div style={{ padding: '12px 16px', borderBottom: '1px solid #e0d8cc', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ width: 24, height: 24, borderRadius: '50%', border: `1.5px solid ${S.border}` }}/>
                <span style={{ fontSize: 16, fontWeight: 600, color: S.text }}>👥 Dividir cuenta</span>
              </div>
              {divClientePax > 1 && <span style={{ fontSize: 13, fontWeight: 900, color: '#d4943a' }}>${(totalCliente / divClientePax).toLocaleString('es-CO', {maximumFractionDigits:0})} c/u</span>}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: 1, background: '#e0d8cc' }}>
              {[2,3,4,5,6,7,8,9,10].map((n:number)=>(
                <button key={n} onClick={()=>setDivClientePax(n)}
                  style={{ padding: '12px 0', fontSize: 14, fontWeight: 900, border: 'none', cursor: 'pointer', background: divClientePax===n ? '#1a1a1a' : '#f5f0e8', color: divClientePax===n ? '#FFE600' : '#888', transition: 'all .15s' }}>
                  {n}
                </button>
              ))}
              <button onClick={()=>setDivClientePax(1)}
                style={{ padding: '12px 0', fontSize: 12, fontWeight: 700, border: 'none', cursor: 'pointer', background: '#f5f0e8', color: '#bbb' }}>
                ✕
              </button>
            </div>
            {divClientePax > 1 && (
              <div style={{ padding: '10px 16px', textAlign: 'center', fontSize: 13, color: S.text3 }}>
                ${totalCliente.toLocaleString('es-CO',{maximumFractionDigits:0})} ÷ {divClientePax} = <span style={{ fontWeight: 900, color: '#d4943a', fontSize: 16 }}>${(totalCliente/divClientePax).toLocaleString('es-CO',{maximumFractionDigits:0})}</span> por persona
              </div>
            )}
          </div>

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

          <button onClick={async()=>{
              await supabase.from('cobros_trazabilidad').insert({ restaurante_id: restauranteId, mesa_numero:mesaCliente.num, mesero:miNombre, total:totalCliente, propina:propinaCliente, propina_pct:clientePropina, metodo_pago:'Bono', platos_servidos:itemsCliente.length, factura_tipo:facturaTipo, factura_email:facturaCorreo||null }).then(()=>{}).catch(()=>{});
              await guardarFactura('Bono');
              setClientePaso('encuesta');
            }}
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

          <button onClick={async()=>{
              await supabase.from('cobros_trazabilidad').insert({ restaurante_id: restauranteId, mesa_numero:mesaCliente.num, mesero:miNombre, total:totalCliente, propina:propinaCliente, propina_pct:clientePropina, metodo_pago:'Tarjeta', platos_servidos:itemsCliente.length, factura_tipo:facturaTipo, factura_email:facturaCorreo||null }).then(()=>{}).catch(()=>{});
              await guardarFactura('Tarjeta');
              setClientePaso('encuesta');
            }}
            style={{ width: '100%', padding: '18px', borderRadius: 100, background: S.black, color: '#fff', fontSize: 17, fontWeight: 700, border: 'none', cursor: 'pointer' }}>
            Pagar ${formatPrecio(totalCliente)}
          </button>
        </div>
      )}

      {/* ═══ PASO 4: NEXUM FEEDBACK — emociones operativas en tiempo real ═══ */}
      {clientePaso === 'encuesta' && (() => {
        const XC = {
          bg:'#06060f', bg2:'#0d0d1a', card:'rgba(255,255,255,0.045)',
          cardSel:'rgba(255,255,255,0.10)', line:'rgba(255,255,255,0.09)',
          pink:'#FF2D78', gold:'#FFB547', green:'#00E676',
          blue:'#448AFF', purple:'#B388FF', red:'#FF6B5B',
          t1:'#FFFFFF', t2:'#A8A8C0', t3:'#5A5A78',
        };
        const nombreReal = (() => {
          const c = String(mesaCliente?.cliente || '').trim();
          if (!c || ['mesa','cliente','invitado'].includes(c.toLowerCase())) return '';
          return c.split(' ')[0];
        })();

        // ── Sentimiento (sin números visibles — internamente 1-5) ──
        const CARITAS = [
          {n:1, emoji:'😡', label:'Muy mala',   color:'#FF5252'},
          {n:2, emoji:'😕', label:'Mala',       color:'#FF7043'},
          {n:3, emoji:'😐', label:'Regular',    color:'#FFB547'},
          {n:4, emoji:'😊', label:'Muy buena',  color:'#69F0AE'},
          {n:5, emoji:'🤩', label:'Increíble',  color:'#00E676'},
        ];
        const isPositive = clienteRating >= 4;
        const accent = clienteRating>=4 ? XC.green : clienteRating>0 ? XC.red : XC.pink;

        // ── Categorías ──
        const POS_CATS = [
          {e:'🍽️',l:'Comida'},{e:'🍸',l:'Bebidas'},{e:'💁',l:'Servicio'},
          {e:'🎵',l:'Ambiente'},{e:'⚡',l:'Rapidez'},
        ];
        const NEG_CATS = [
          {e:'🍽️',l:'Comida'},{e:'🍸',l:'Bebidas'},{e:'💁',l:'Servicio'},{e:'⏳',l:'Tiempo'},
        ];
        const cats = isPositive ? POS_CATS : NEG_CATS;
        const maxSel = isPositive ? 2 : 4;

        // ── Platos y bebidas consumidos (desde el POS) ──
        const todosItems = order.filter(o=>o.mesa===mesaCliente?.num);
        const platosOrden  = Array.from(new Set(todosItems.filter(o=>clasificarItem(o.nombre)==='comida').map(o=>o.nombre))).slice(0,6);
        const bebidasOrden = Array.from(new Set(todosItems.filter(o=>clasificarItem(o.nombre)==='bebida').map(o=>o.nombre))).slice(0,6);
        // Lista por instancia: si hay 10 platos iguales, el cliente elige cuáles
        // (Sushi #1 … Sushi #10) en vez de un solo botón agrupado.
        const instanciasDe = (tipo:'comida'|'bebida'):string[] => {
          const conteo:Record<string,number> = {};
          todosItems.filter(o=>clasificarItem(o.nombre)===tipo).forEach(o=>{ conteo[o.nombre]=(conteo[o.nombre]||0)+1; });
          return Object.entries(conteo).flatMap(([n,q]) => q>1 ? Array.from({length:q},(_,k)=>`${n} #${k+1}`) : [n]).slice(0,20);
        };
        const platosInstancias  = instanciasDe('comida');
        const bebidasInstancias = instanciasDe('bebida');

        // ── Cola de sub-pantallas según categorías elegidas ──
        const buildQueue = (tags:string[]):string[] => {
          const q:string[] = [];
          tags.forEach(c=>{
            if (isPositive) {
              if (c==='Comida' && platosOrden.length>0)  q.push('pos-comida');
              else if (c==='Bebidas' && bebidasOrden.length>0) q.push('pos-bebida');
              else if (c==='Ambiente') q.push('pos-ambiente');
              else if (c==='Rapidez')  q.push('pos-rapidez');
              // Servicio: 1 mesero principal → asociación automática, sin pantalla
            } else {
              if (c==='Comida')  { q.push('neg-comida-que'); if(platosOrden.length>0) q.push('neg-comida-item'); }
              else if (c==='Bebidas') { q.push('neg-bebida-que'); if(bebidasOrden.length>0) q.push('neg-bebida-item'); }
              else if (c==='Servicio') q.push('neg-servicio-que'); // ¿quién? → auto-asociado
              else if (c==='Tiempo')   q.push('neg-tiempo');
            }
          });
          return q;
        };
        const queue = buildQueue(xcareTags);
        const subScreen = queue[xcareSubIdx];

        // ── Definición de cada sub-pantalla ──
        const SUBS: Record<string,{titulo:string;sub:string;opciones:{e?:string;l:string}[]}> = {
          'pos-comida':   {titulo:'¿Qué plato te encantó?', sub:'Toca tu favorito', opciones:platosOrden.map(p=>({e:'🍽️',l:p}))},
          'pos-bebida':   {titulo:'¿Qué bebida te gustó más?', sub:'Toca tu favorita', opciones:bebidasOrden.map(b=>({e:'🍸',l:b}))},
          'pos-ambiente': {titulo:'¿Qué fue lo que más te gustó?', sub:'Del ambiente', opciones:[{e:'🎵',l:'Música'},{e:'🛋️',l:'Decoración'},{e:'✨',l:'Energía'},{e:'🎭',l:'Shows'},{e:'💡',l:'Iluminación'}]},
          'pos-rapidez':  {titulo:'¿Qué estuvo más ágil?', sub:'Lo que más te sorprendió', opciones:[{e:'🤝',l:'Atención inicial'},{e:'🍸',l:'Bebidas'},{e:'🍽️',l:'Cocina'},{e:'💳',l:'La cuenta'}]},
          'neg-comida-que':  {titulo:'¿Qué pasó con la comida?', sub:'Toca los que apliquen', opciones:[{e:'🥩',l:'Sabor'},{e:'🔥',l:'Temperatura'},{e:'🍽️',l:'Calidad'},{e:'❌',l:'Otro'}]},
          'neg-comida-item': {titulo:'¿Con cuál plato?', sub:'Toca los que apliquen', opciones:platosInstancias.map(p=>({e:'🍽️',l:p}))},
          'neg-bebida-que':  {titulo:'¿Qué pasó con la bebida?', sub:'Toca los que apliquen', opciones:[{e:'🍬',l:'Muy dulce'},{e:'🥃',l:'Muy fuerte'},{e:'❄️',l:'Temperatura'},{e:'❌',l:'Otro'}]},
          'neg-bebida-item': {titulo:'¿Cuál bebida fue?', sub:'Toca las que apliquen', opciones:bebidasInstancias.map(b=>({e:'🍸',l:b}))},
          'neg-servicio-que':{titulo:'¿Qué pasó con el servicio?', sub:'Tu respuesta es confidencial', opciones:[{e:'😐',l:'Empatía'},{e:'🧠',l:'Capacitación'},{e:'⏳',l:'Demoras'},{e:'❌',l:'Otro'}]},
          'neg-tiempo':      {titulo:'¿Dónde hubo demora?', sub:'Lo que más te hizo esperar', opciones:[{e:'🍽️',l:'Cocina'},{e:'🍸',l:'Bebidas'},{e:'🪑',l:'En la mesa'},{e:'💳',l:'La cuenta'}]},
        };

        // ── Guardado ──
        const guardarNexum = async () => {
          const items:string[] = [];
          const detalles:string[] = [];
          Object.entries(xcareSel).forEach(([sid,vals])=>{
            if (/item|pos-comida|pos-bebida/.test(sid)) items.push(...vals);
            else detalles.push(...vals);
          });
          await supabase.from('xcare_encuestas').insert({
            restaurante_id: restauranteId, mesa_numero:mesaCliente?.num, nombre_cliente:mesaCliente?.cliente||null,
            estrellas:clienteRating,
            tags_positivos:isPositive?xcareTags:null,
            tags_negativos:!isPositive?[...xcareTags,...detalles]:null,
            platos_problema:items.length?items:null,
            comentario:xcareComentario||null,
            nps_score:clienteRating===5?10:clienteRating===4?8:clienteRating===3?6:clienteRating===2?3:1,
            alerta_gerente:!isPositive,
          }).then(()=>{}).catch(()=>{});
          if (!isPositive) {
            await supabase.from('xcare_alertas').insert({
              restaurante_id: restauranteId, mesa_numero:mesaCliente?.num, tipo:'experiencia_negativa',
              descripcion:`${mesaCliente?.cliente||'Cliente'} — ${CARITAS[clienteRating-1]?.label||''} — ${xcareTags.join(', ')||'Sin categoría'}${detalles.length?` · ${detalles.join(', ')}`:''}${items.length?` · ${items.join(', ')}`:''}${xcareComentario?` — "${xcareComentario}"`:''}`,
              activa:true,
            }).then(()=>{}).catch(()=>{});
          }
        };

        // ── Navegación ──
        const finalizar = (tags:string[]) => {
          if (clienteRating>=4) { guardarNexum(); setXcareStep('done'); }
          else { setXcareStep('comentario'); }
        };
        const irADetalle = (tags:string[]) => {
          const q = buildQueue(tags);
          if (q.length===0) { finalizar(tags); return; }
          setXcareSubIdx(0); setXcareStep('sub');
        };
        const siguienteSub = () => {
          if (xcareSubIdx+1 < queue.length) setXcareSubIdx(xcareSubIdx+1);
          else finalizar(xcareTags);
        };

        // ── Interacción ──
        const elegirSentimiento = (n:number) => {
          setClienteRating(n);
          if (encTimerRef.current) clearTimeout(encTimerRef.current);
          encTimerRef.current = window.setTimeout(()=>setXcareStep('cat'), 340);
        };
        const tapCat = (cat:string) => {
          const has = xcareTags.includes(cat);
          const next = has ? xcareTags.filter(x=>x!==cat)
                           : (xcareTags.length<maxSel ? [...xcareTags,cat] : xcareTags);
          setXcareTags(next);
          if (encTimerRef.current) clearTimeout(encTimerRef.current);
          if (isPositive) {
            if (next.length===0) return;
            const delay = next.length>=maxSel ? 420 : 1500;
            encTimerRef.current = window.setTimeout(()=>irADetalle(next), delay);
          }
        };
        // Multi-selección en sub-pantallas: alterna el valor, sin auto-avanzar
        // (el cliente confirma con el botón Continuar).
        const tapSubMulti = (value:string) => {
          if (encTimerRef.current) clearTimeout(encTimerRef.current);
          setXcareSel(prev=>{
            const cur = prev[subScreen]||[];
            const next = cur.includes(value) ? cur.filter(v=>v!==value) : [...cur, value];
            return {...prev, [subScreen]: next};
          });
        };
        const omitir = () => {
          if (encTimerRef.current) clearTimeout(encTimerRef.current);
          setClienteMode(false);
          limpiarMesaCerrada(mesaCliente?.num);
          showToast(`Mesa ${mesaCliente?.num} cerrada`);
        };

        return (
          <div style={{flex:1,overflowY:'auto',background:`radial-gradient(ellipse at 50% 0%,${XC.bg2} 0%,${XC.bg} 60%)`,display:'flex',flexDirection:'column',alignItems:'center',padding:'70px 24px 36px',position:'relative',minHeight:'100%'}}>
            <style>{`
              @keyframes nxFade{from{opacity:0;transform:translateY(18px)}to{opacity:1;transform:translateY(0)}}
              @keyframes nxPop{0%{transform:scale(.6)}55%{transform:scale(1.18)}100%{transform:scale(1)}}
              @keyframes nxGlow{0%,100%{opacity:.4}50%{opacity:.85}}
            `}</style>

            {/* Marca NEXUM */}
            <div style={{display:'flex',alignItems:'center',gap:7,marginBottom:30,animation:'nxFade .4s ease'}}>
              <div style={{width:28,height:28,borderRadius:8,background:`linear-gradient(135deg,${XC.pink},${XC.purple})`,display:'flex',alignItems:'center',justifyContent:'center',fontSize:13,boxShadow:`0 0 16px rgba(255,45,120,0.45)`}}>✦</div>
              <span style={{fontSize:10,fontWeight:900,color:XC.t2,letterSpacing:'.22em',textTransform:'uppercase'}}>NEXUM Feedback</span>
            </div>

            {/* ── PANTALLA 1 · SENTIMIENTO ── */}
            {xcareStep==='sentiment' && (
              <div style={{width:'100%',flex:1,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',textAlign:'center',animation:'nxFade .4s ease',paddingBottom:30}}>
                <div style={{fontFamily:"'Syne',sans-serif",fontSize:27,fontWeight:900,color:XC.t1,lineHeight:1.18,letterSpacing:'-0.02em',marginBottom:10}}>
                  {nombreReal ? `${nombreReal}, ¿cómo estuvo\ntu experiencia hoy?` : '¿Cómo estuvo tu\nexperiencia hoy?'}
                </div>
                <div style={{fontSize:13,color:XC.t2,marginBottom:48}}>Tu opinión mejora la experiencia ✨</div>

                <div style={{display:'flex',justifyContent:'center',gap:6,width:'100%',maxWidth:380}}>
                  {CARITAS.map((c,i)=>(
                    <button key={c.n} onClick={()=>elegirSentimiento(c.n)}
                      style={{flex:1,background:'none',border:'none',cursor:'pointer',display:'flex',flexDirection:'column',alignItems:'center',gap:8,padding:'8px 2px',
                        transition:'transform .2s cubic-bezier(.34,1.56,.64,1)',
                        transform: clienteRating===c.n?'scale(1.12)':'scale(1)',
                        opacity: clienteRating && clienteRating!==c.n ? 0.45 : 1,
                        animation:`nxFade .4s ease ${i*0.06}s both`}}>
                      <span style={{fontSize:46,lineHeight:1,filter:clienteRating===c.n?`drop-shadow(0 4px 16px ${c.color}cc)`:'none'}}>{c.emoji}</span>
                      <span style={{fontSize:10.5,fontWeight:700,color:clienteRating===c.n?c.color:XC.t3,transition:'color .2s'}}>{c.label}</span>
                    </button>
                  ))}
                </div>

                <button onClick={omitir} style={{marginTop:54,background:'none',border:'none',fontSize:11.5,color:XC.t3,cursor:'pointer'}}>
                  Omitir
                </button>
              </div>
            )}

            {/* ── PANTALLA 2 · CATEGORÍAS ── */}
            {xcareStep==='cat' && (
              <div style={{width:'100%',flex:1,display:'flex',flexDirection:'column',animation:'nxFade .35s ease',maxWidth:420,margin:'0 auto'}}>
                <div style={{textAlign:'center',marginBottom:28}}>
                  <div style={{fontSize:38,marginBottom:10}}>{CARITAS[clienteRating-1]?.emoji}</div>
                  <div style={{fontFamily:"'Syne',sans-serif",fontSize:23,fontWeight:900,color:XC.t1,lineHeight:1.2,letterSpacing:'-0.01em',marginBottom:6}}>
                    {isPositive ? '¿Qué fue lo mejor de tu experiencia?' : 'Queremos mejorar tu experiencia'}
                  </div>
                  <div style={{fontSize:12.5,color:XC.t2}}>
                    {isPositive ? 'Selecciona máximo 2 ✨' : '¿Qué salió mal?'}
                  </div>
                </div>

                <div style={{display:'flex',flexDirection:'column',gap:11}}>
                  {cats.map((c,i)=>{
                    const sel = xcareTags.includes(c.l);
                    const blocked = !sel && xcareTags.length>=maxSel;
                    return (
                      <button key={c.l} disabled={blocked} onClick={()=>tapCat(c.l)}
                        style={{display:'flex',alignItems:'center',gap:15,padding:'17px 20px',borderRadius:18,
                          border:`2px solid ${sel?accent:XC.line}`,
                          background:sel?XC.cardSel:XC.card,
                          cursor:blocked?'not-allowed':'pointer',opacity:blocked?0.35:1,
                          transition:'all .18s',textAlign:'left',outline:'none',
                          animation:`nxFade .3s ease ${i*0.05}s both`}}>
                        <span style={{fontSize:30}}>{c.e}</span>
                        <span style={{flex:1,fontFamily:"'Syne',sans-serif",fontSize:17,fontWeight:800,color:XC.t1}}>{c.l}</span>
                        <span style={{width:24,height:24,borderRadius:8,border:`2px solid ${sel?accent:XC.t3}`,background:sel?accent:'transparent',display:'flex',alignItems:'center',justifyContent:'center',fontSize:14,color:'#000',fontWeight:900}}>
                          {sel?'✓':''}
                        </span>
                      </button>
                    );
                  })}
                </div>

                {/* Positivo: auto-avance. Negativo: botón continuar */}
                {!isPositive && (
                  <button onClick={()=>irADetalle(xcareTags)} disabled={xcareTags.length===0}
                    style={{marginTop:'auto',width:'100%',padding:'17px',borderRadius:50,border:'none',
                      background:xcareTags.length?`linear-gradient(135deg,${XC.red},#d4493b)`:'rgba(255,255,255,0.06)',
                      color:'#fff',fontFamily:"'Syne',sans-serif",fontSize:15,fontWeight:900,
                      cursor:xcareTags.length?'pointer':'not-allowed'}}>
                    Continuar →
                  </button>
                )}
                {isPositive && xcareTags.length>0 && (
                  <div style={{marginTop:18,textAlign:'center',fontSize:11.5,color:XC.t3,animation:'nxGlow 1.8s ease-in-out infinite'}}>
                    {xcareTags.length>=maxSel ? 'Perfecto, continuando…' : 'Toca otra opción o espera…'}
                  </div>
                )}
              </div>
            )}

            {/* ── SUB-PANTALLAS · drill-down ── */}
            {xcareStep==='sub' && subScreen && SUBS[subScreen] && (
              <div style={{width:'100%',flex:1,display:'flex',flexDirection:'column',animation:'nxFade .3s ease',maxWidth:420,margin:'0 auto'}}>
                <div style={{textAlign:'center',marginBottom:24}}>
                  <div style={{fontSize:11,color:XC.t3,fontWeight:700,letterSpacing:'.06em',marginBottom:8}}>
                    PASO {xcareSubIdx+1} DE {queue.length}
                  </div>
                  <div style={{fontFamily:"'Syne',sans-serif",fontSize:22,fontWeight:900,color:XC.t1,lineHeight:1.2,letterSpacing:'-0.01em',marginBottom:6}}>
                    {SUBS[subScreen].titulo}
                  </div>
                  <div style={{fontSize:12.5,color:XC.t2}}>{SUBS[subScreen].sub}</div>
                </div>

                <div style={{display:'flex',flexDirection:'column',gap:10}}>
                  {SUBS[subScreen].opciones.map((op,i)=>{
                    const sel = (xcareSel[subScreen]||[]).includes(op.l);
                    return (
                      <button key={op.l} onClick={()=>tapSubMulti(op.l)}
                        style={{display:'flex',alignItems:'center',gap:14,padding:'16px 20px',borderRadius:16,
                          border:`2px solid ${sel?accent:XC.line}`,background:sel?XC.cardSel:XC.card,
                          cursor:'pointer',transition:'all .16s',textAlign:'left',outline:'none',
                          animation:`nxFade .28s ease ${i*0.04}s both`}}>
                        {op.e && <span style={{fontSize:24}}>{op.e}</span>}
                        <span style={{flex:1,fontFamily:"'Syne',sans-serif",fontSize:15.5,fontWeight:800,color:XC.t1}}>{op.l}</span>
                        <span style={{width:24,height:24,borderRadius:8,border:`2px solid ${sel?accent:XC.t3}`,background:sel?accent:'transparent',display:'flex',alignItems:'center',justifyContent:'center',fontSize:14,color:'#000',fontWeight:900}}>{sel?'✓':''}</span>
                      </button>
                    );
                  })}
                </div>

                <button onClick={siguienteSub} disabled={(xcareSel[subScreen]||[]).length===0}
                  style={{marginTop:'auto',width:'100%',padding:'17px',borderRadius:50,border:'none',
                    background:(xcareSel[subScreen]||[]).length?`linear-gradient(135deg,${accent},${accent}cc)`:'rgba(255,255,255,0.06)',
                    color:'#fff',fontFamily:"'Syne',sans-serif",fontSize:15,fontWeight:900,
                    cursor:(xcareSel[subScreen]||[]).length?'pointer':'not-allowed'}}>
                  {xcareSubIdx+1<queue.length ? 'Continuar →' : 'Finalizar'}
                </button>
                <button onClick={()=>{ if(xcareSubIdx>0) setXcareSubIdx(xcareSubIdx-1); else setXcareStep('cat'); }}
                  style={{marginTop:12,background:'none',border:'none',color:XC.t3,cursor:'pointer',fontSize:12,alignSelf:'center'}}>
                  ← Volver
                </button>
              </div>
            )}

            {/* ── COMENTARIO LIBRE (flujo negativo) ── */}
            {xcareStep==='comentario' && (
              <div style={{width:'100%',flex:1,display:'flex',flexDirection:'column',animation:'nxFade .35s ease',maxWidth:420,margin:'0 auto'}}>
                <div style={{textAlign:'center',marginBottom:24}}>
                  <div style={{fontSize:36,marginBottom:10}}>💬</div>
                  <div style={{fontFamily:"'Syne',sans-serif",fontSize:22,fontWeight:900,color:XC.t1,lineHeight:1.2,marginBottom:6}}>
                    ¿Quieres contarnos algo más?
                  </div>
                  <div style={{fontSize:12.5,color:XC.t2}}>Opcional · nos ayuda a entender mejor</div>
                </div>
                <textarea autoFocus value={xcareComentario} onChange={e=>setXcareComentario(e.target.value)}
                  placeholder="Cuéntanos qué pasó…"
                  style={{width:'100%',minHeight:130,background:XC.card,border:`1px solid ${XC.line}`,borderRadius:16,padding:'16px',color:XC.t1,fontSize:14,outline:'none',resize:'none',fontFamily:"'DM Sans',sans-serif",lineHeight:1.5}}/>
                <button onClick={()=>{ guardarNexum(); setXcareStep('done'); }}
                  style={{marginTop:'auto',width:'100%',padding:'17px',borderRadius:50,border:'none',background:`linear-gradient(135deg,${XC.red},#d4493b)`,color:'#fff',fontFamily:"'Syne',sans-serif",fontSize:15,fontWeight:900,cursor:'pointer'}}>
                  Enviar
                </button>
                <button onClick={()=>{ guardarNexum(); setXcareStep('done'); }}
                  style={{marginTop:8,background:'none',border:'none',color:XC.t3,cursor:'pointer',fontSize:12.5,alignSelf:'center'}}>
                  Omitir comentario
                </button>
              </div>
            )}

            {/* ── PANTALLA FINAL ── */}
            {xcareStep==='done' && (
              <div style={{width:'100%',flex:1,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',textAlign:'center',animation:'nxFade .4s ease',paddingBottom:20}}>
                <div style={{fontSize:74,marginBottom:18,animation:'nxPop .55s ease',filter:`drop-shadow(0 6px 26px ${accent}aa)`}}>
                  {isPositive?'🎉':'🤝'}
                </div>
                <div style={{fontFamily:"'Syne',sans-serif",fontSize:24,fontWeight:900,color:XC.t1,lineHeight:1.2,marginBottom:10}}>
                  {isPositive?'¡Gracias por tu visita!':'Gracias por ayudarnos a mejorar'}
                </div>
                <div style={{fontSize:13.5,color:XC.t2,lineHeight:1.6,maxWidth:300,marginBottom:30}}>
                  {isPositive
                    ? 'Nos encanta saber que la pasaste bien. ¡Te esperamos pronto!'
                    : 'Nuestro equipo revisará personalmente tu experiencia. Gracias por tu confianza.'}
                </div>

                {/* Reseña pública SOLO en flujo positivo */}
                {isPositive && (
                  <a href="https://g.page/r/review" target="_blank" rel="noreferrer"
                    style={{display:'block',width:'100%',maxWidth:320,padding:'14px',borderRadius:14,background:'rgba(255,255,255,0.06)',border:`1px solid ${XC.line}`,color:XC.t1,fontSize:13,fontWeight:800,textDecoration:'none',fontFamily:"'Syne',sans-serif",marginBottom:14}}>
                    ⭐ Compartir mi experiencia en Google
                  </a>
                )}

                <button onClick={()=>setClientePaso('premio')}
                  style={{padding:'15px 50px',borderRadius:50,border:'none',background:`linear-gradient(135deg,${XC.pink},#cc2260)`,color:'#fff',fontSize:15,fontWeight:900,cursor:'pointer',fontFamily:"'Syne',sans-serif",boxShadow:`0 8px 28px rgba(255,45,120,0.45)`}}>
                  🎁 Ver mi premio →
                </button>

                {/* Nota interna del mesero (no visible al cliente en producción) */}
                <div style={{width:'100%',maxWidth:360,background:XC.card,borderRadius:16,padding:'14px',marginTop:26,border:`1px solid ${XC.line}`,textAlign:'left'}}>
                  <div style={{fontSize:11,fontWeight:700,color:XC.t3,marginBottom:8}}>📝 Nota interna del mesero</div>
                  <div style={{display:'flex',gap:6,marginBottom:8}}>
                    {[{id:'nota',l:'📝 Nota'},{id:'alerta',l:'⚠️ Alerta'},{id:'felicitacion',l:'🌟 Éxito'}].map(t=>(
                      <button key={t.id} onClick={()=>setFeedbackTipo(t.id as any)}
                        style={{flex:1,padding:'6px',borderRadius:8,border:`1px solid ${feedbackTipo===t.id?accent:XC.line}`,background:feedbackTipo===t.id?`${accent}22`:'transparent',color:feedbackTipo===t.id?accent:XC.t3,fontSize:10,fontWeight:700,cursor:'pointer'}}>
                        {t.l}
                      </button>
                    ))}
                  </div>
                  <textarea value={feedbackMesa} onChange={e=>setFeedbackMesa(e.target.value)}
                    placeholder="Ej: cliente VIP primera visita, solicitó postre especial…"
                    style={{width:'100%',padding:'10px',borderRadius:8,border:`1px solid ${XC.line}`,background:'rgba(255,255,255,0.03)',color:XC.t1,fontSize:12,outline:'none',resize:'vertical',minHeight:54,fontFamily:"'DM Sans',sans-serif"}}/>
                  {feedbackMesa && (
                    <button onClick={guardarFeedback}
                      style={{marginTop:8,padding:'8px 20px',borderRadius:8,border:'none',background:accent,color:'#000',fontSize:12,fontWeight:800,cursor:'pointer'}}>
                      ✓ Guardar nota
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        );
      })()}

      {/* ═══ PASO 5: PREMIO — picker entre Ruleta y 6 Cartas ═══ */}
      {clientePaso === 'premio' && (() => {
        const cerrarMesa = async () => {
          const mesaName = String(mesaCliente?.name ?? mesaCliente?.num ?? '');
          if (mesaName) {
            try { await supabase.rpc('cerrar_mesa', { p_mesa_name: mesaName }); }
            catch (e) { console.error('cerrar_mesa error:', e); }
          }
          setClienteMode(false);
          limpiarMesaCerrada(mesaCliente?.num);
          setClientePaso('cuenta');
          setXcareStep('sentiment');
          setJuegoPremio(null);
          showToast(`✓ Mesa ${mesaCliente?.num} cerrada — ¡Gracias!`);
        };
        if (juegoPremio === null) {
          return <PremioPicker rating={clienteRating} onPick={setJuegoPremio} onSkip={cerrarMesa} />;
        }
        if (juegoPremio === 'ruleta') {
          return <RuletaPremios onClose={cerrarMesa} mesaNum={mesaCliente?.num ?? 0} rating={clienteRating} />;
        }
        return <CartasPremios onClose={cerrarMesa} mesaNum={mesaCliente?.num ?? 0} rating={clienteRating} />;
      })()}
    </div>
    </>
  );


  // Todos los platos de la mesa: pendientes + ya marchados
  const mesaOrderItems = [...pendingOrder, ...order].filter((o:any) => o.mesa === selectedTable.num);
  // Ticket base de Supabase + platos locales aún no cerrados
  const ticketBase = (tables && tables.length > 0)
    ? (tables.find((m:any) => (m.num ?? m.numero ?? m.id) === selectedTable.num)?.ticket_acumulado || 0)
    : selectedTable.ticket;
  const mesaSubtotal = ticketBase + mesaOrderItems.reduce((s:number, o:any) => s + parsePrecio(o.precio), 0);

  return (
    <div ref={wrapperRef} className="flex bg-[#0a0a0a] text-[#f0f0f0]" style={{
      fontFamily: "'DM Sans', sans-serif",
      width: '100%',
      height: '100%',
      maxHeight: '100%',
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

      {/* ═══ BANDEJA DE COBROS PENDIENTES — cuentas enviadas a caja ═══ */}
      {showCaja && (
        <div className="fixed inset-0 bg-black/80 z-[640] flex items-center justify-center p-4" onClick={(e)=>{ if(e.target===e.currentTarget) setShowCaja(false); }}>
          <div className="bg-[#1c1c1c] border border-[#3dba6f]/30 rounded-2xl w-full max-w-[440px] max-h-[88vh] overflow-y-auto">
            <div className="p-4 border-b border-[#2a2a2a] flex items-center justify-between sticky top-0 bg-[#1c1c1c]">
              <div className="flex items-center gap-2">
                <span className="text-[16px]">💳</span>
                <div className="font-['Syne'] text-[15px] font-black">Cobros pendientes</div>
                {cobrosPendientes.length>0 && <span className="bg-[#3dba6f] text-black text-[10px] font-black px-1.5 rounded-full">{cobrosPendientes.length}</span>}
              </div>
              <button onClick={()=>setShowCaja(false)} className="w-8 h-8 rounded-full bg-[#0a0a0a] border border-[#2a2a2a] text-[#909090] flex items-center justify-center"><X size={16}/></button>
            </div>
            <div className="p-3 flex flex-col gap-2">
              {cobrosPendientes.length===0 && (
                <div className="text-center py-12 text-[#606060] text-[12px]">No hay cuentas enviadas a caja.</div>
              )}
              {cobrosPendientes.map((p:any)=>(
                <button key={p.id} onClick={()=>{ setCajaCobro(p); setCajaMetodo('Datafono'); }}
                  className="text-left bg-[#141414] border border-[#2a2a2a] rounded-xl p-3 hover:border-[#3dba6f]/50 transition-all active:scale-[0.99]">
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-['Syne'] text-[16px] font-black text-[#f0b45a]">M{p.mesa_num}</span>
                    <span className="text-[15px] font-black text-[#3dba6f]">${formatPrecio(Number(p.total||0))}</span>
                  </div>
                  <div className="text-[11px] text-[#a0a0a0] truncate">{p.cliente_nombre || 'Mesa'} · {(p.items||[]).length} ítem(s)</div>
                  <div className="text-[10px] text-[#606060] mt-0.5">👤 {p.mesero||'—'} · {p.solicitado_at ? new Date(p.solicitado_at).toLocaleTimeString('es-CO',{hour:'2-digit',minute:'2-digit'}) : ''}</div>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Modal de cobro de una cuenta pendiente (caja) */}
      {cajaCobro && (
        <div className="fixed inset-0 bg-black/85 z-[660] flex items-center justify-center p-4" onClick={(e)=>{ if(e.target===e.currentTarget) setCajaCobro(null); }}>
          <div className="bg-[#1c1c1c] border border-[#3dba6f]/40 rounded-2xl w-full max-w-[400px] max-h-[90vh] overflow-y-auto p-5">
            <div className="flex items-center justify-between mb-3">
              <div>
                <div className="text-[15px] font-black text-[#f0f0f0]">💳 Cobrar Mesa {cajaCobro.mesa_num}</div>
                <div className="text-[11px] text-[#909090]">{cajaCobro.cliente_nombre || 'Mesa'} · enviada por {cajaCobro.mesero||'—'}</div>
              </div>
              <button onClick={()=>setCajaCobro(null)} className="w-8 h-8 rounded-full bg-[#0a0a0a] border border-[#2a2a2a] text-[#909090] flex items-center justify-center"><X size={16}/></button>
            </div>
            <div className="bg-[#0a0a0a] rounded-xl p-3 mb-3 max-h-[200px] overflow-y-auto flex flex-col gap-1">
              {(cajaCobro.items||[]).map((it:any,i:number)=>(
                <div key={i} className="flex justify-between text-[12px] py-1 border-b border-[#1f1f1f] last:border-0">
                  <span className="text-[#d0d0d0]">{it.emoji||'🍽️'} {it.nombre}</span>
                  <span className="text-[#d4943a] font-semibold">{it.precio}</span>
                </div>
              ))}
              {(cajaCobro.items||[]).length===0 && <div className="text-[11px] text-[#606060] text-center py-2">Sin detalle de ítems</div>}
            </div>
            <div className="flex justify-between text-[17px] font-black mb-3">
              <span className="text-[#f0f0f0]">Total</span><span className="text-[#f0b45a]">${formatPrecio(Number(cajaCobro.total||0))}</span>
            </div>
            <div className="text-[10px] text-[#606060] font-bold uppercase tracking-wider mb-2">Método de pago</div>
            <div className="flex gap-2 mb-4">
              {['Datafono','Efectivo','Tarjeta'].map(m=>(
                <button key={m} onClick={()=>setCajaMetodo(m)}
                  className={`flex-1 py-2 rounded-lg text-[11px] font-bold border transition-all ${cajaMetodo===m ? 'border-[#3dba6f] bg-[#3dba6f]/15 text-[#3dba6f]' : 'border-[#2a2a2a] text-[#909090]'}`}>
                  {m}
                </button>
              ))}
            </div>
            <button onClick={()=>cobrarPendiente(cajaCobro, cajaMetodo)}
              className="w-full py-3 rounded-xl bg-[#3dba6f] text-black text-[13px] font-black hover:bg-[#4dca7f] active:scale-95 transition-all">
              ✓ Cobrar ${formatPrecio(Number(cajaCobro.total||0))} y cerrar mesa
            </button>
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

      {/* ═══ COBRO XPRESS — modal rápido: método + propina → cierra mesa ═══ */}
      {xpressOpen && (() => {
        const mesa = displayTables.find(x => x.id === selectedTableId);
        const num  = mesa?.num;
        const subtotal = mesa?.ticket || 0;
        const iva      = Math.round(subtotal * 0.08);
        const propina  = Math.round(subtotal * (xpressPropPct/100));
        const total    = subtotal + iva + propina;
        const fmtP = (n:number) => formatPrecio(n);
        const metodos = [
          { id:'Datafono' as const,      emoji:'💳', label:'Datáfono',      color:'#448AFF' },
          { id:'Efectivo' as const,      emoji:'💵', label:'Efectivo',      color:'#3dba6f' },
          { id:'Tarjeta' as const,       emoji:'💎', label:'Tarjeta',       color:'#b388ff' },
          { id:'Transferencia' as const, emoji:'📱', label:'Transferencia', color:'#22d3ee' },
        ];
        return (
          <div className="fixed inset-0 bg-black/80 z-[650] flex items-center justify-center p-4">
            <div className="bg-[#1c1c1c] border border-[#3dba6f]/40 rounded-2xl w-full max-w-[420px]">
              <div className="p-5">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <div className="text-[15px] font-black text-[#f0f0f0]">⚡ Cobro Xpress</div>
                    <div className="text-[11px] text-[#909090]">Mesa {num} · Cierre rápido</div>
                  </div>
                  <button onClick={()=>setXpressOpen(false)} disabled={xpressProcesando}
                    className="w-8 h-8 rounded-full bg-[#0a0a0a] border border-[#2a2a2a] text-[#909090] flex items-center justify-center">
                    <X size={16}/>
                  </button>
                </div>

                {/* Totales */}
                <div className="bg-[#0a0a0a] rounded-xl p-3 mb-3">
                  <div className="flex justify-between text-[12px] text-[#a0a0a0] mb-1.5"><span>Subtotal</span><span>${fmtP(subtotal)}</span></div>
                  <div className="flex justify-between text-[12px] text-[#a0a0a0] mb-1.5"><span>Impoconsumo (8%)</span><span>${fmtP(iva)}</span></div>
                  {propina>0 && <div className="flex justify-between text-[12px] text-[#b388ff] mb-1.5"><span>Propina ({xpressPropPct}%)</span><span>${fmtP(propina)}</span></div>}
                  <div className="flex justify-between text-[18px] font-black pt-2 border-t border-[#2a2a2a] mt-1">
                    <span className="text-[#f0f0f0]">Total</span>
                    <span className="text-[#f0b45a]" style={{fontFamily:"'Syne',sans-serif"}}>${fmtP(total)}</span>
                  </div>
                </div>

                {/* Propina */}
                <div className="text-[10px] text-[#606060] font-bold uppercase tracking-wider mb-2">Propina</div>
                <div className="grid grid-cols-2 gap-2 mb-3">
                  {([0,10] as const).map(p => (
                    <button key={p} onClick={()=>setXpressPropPct(p)} disabled={xpressProcesando}
                      className={`py-2.5 rounded-lg text-[12px] font-bold border transition-all ${xpressPropPct===p?'border-[#b388ff] bg-[#9b72ff]/15 text-[#b388ff]':'border-[#2a2a2a] text-[#909090]'}`}>
                      {p===0?'Sin propina':`${p}% sugerida`}
                    </button>
                  ))}
                </div>

                {/* Método */}
                <div className="text-[10px] text-[#606060] font-bold uppercase tracking-wider mb-2">Método de pago</div>
                <div className="grid grid-cols-2 gap-2 mb-4">
                  {metodos.map(m => (
                    <button key={m.id} onClick={()=>setXpressMetodo(m.id)} disabled={xpressProcesando}
                      style={{
                        padding:'14px 10px',borderRadius:12,
                        border:`2px solid ${xpressMetodo===m.id?m.color:`${m.color}40`}`,
                        background: xpressMetodo===m.id?`${m.color}22`:`${m.color}08`,
                        color:m.color,fontWeight:800,fontSize:12,cursor:xpressProcesando?'not-allowed':'pointer',
                        display:'flex',flexDirection:'column',alignItems:'center',gap:5,
                        transform: xpressMetodo===m.id?'scale(0.97)':'scale(1)',
                        boxShadow: xpressMetodo===m.id?`0 0 16px ${m.color}80, inset 0 0 12px ${m.color}30`:'none',
                        transition:'all .18s cubic-bezier(.34,1.5,.64,1)',
                      }}>
                      <span style={{fontSize:22,lineHeight:1}}>{m.emoji}</span>
                      <span>{m.label}</span>
                    </button>
                  ))}
                </div>

                <button onClick={procesarXpress} disabled={xpressProcesando}
                  className="w-full py-3.5 rounded-xl bg-[#3dba6f] text-black text-[14px] font-black hover:bg-[#4dca7f] disabled:opacity-60 disabled:cursor-not-allowed transition-all">
                  {xpressProcesando ? '⏳ Procesando…' : `Cobrar $${fmtP(total)} y cerrar mesa`}
                </button>
                <div className="text-[9px] text-[#606060] text-center mt-3 tracking-widest uppercase">⚡ XPRESS · sin encuesta · cierra al instante</div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* ═══ COBRO GERENCIA — ventana propia: PIN → descuentos 100% + bonos ═══ */}
      {gerOpen && (() => {
        const items = order.filter(o => o.mesa === selectedTable?.num);
        const subtotal = selectedTable?.ticket || 0;
        const descMonto = Math.round(subtotal * gerDescPct / 100);
        const baseTrasDesc = Math.max(0, subtotal - descMonto);
        const bonoMonto = gerBono ? (gerBono.pct ? Math.round(baseTrasDesc * gerBono.pct / 100) : Math.min(gerBono.monto || 0, baseTrasDesc)) : 0;
        const neto = Math.max(0, baseTrasDesc - bonoMonto);
        const iva = Math.round(neto * 0.08);
        const total = neto + iva;
        const fmt = (n: number) => new Intl.NumberFormat('es-CO').format(n);
        const cobrar = async () => {
          const ahora = new Date();
          const gerNombre = profile?.nombre_completo || profile?.full_name || 'Gerencia';
          // 1) Facturación oficial — sin esto no aparece en dashboards de ventas
          await supabase.from('facturacion').insert({
            restaurante_id: restauranteId,
            mesa_num: selectedTable?.num ?? 0,
            mesero: gerNombre,
            items: items.map((it:any)=>({nombre:it.nombre, precio:it.precio, estado:it.estado})),
            subtotal: neto,
            iva,
            propina: 0,
            descuento: descMonto + bonoMonto,
            total,
            metodo_pago: gerMetodo,
            factura_tipo: 'gerencia',
            cliente_email: null,
            puntos_generados: 0,
            cerrada_en: ahora.toISOString(),
            fecha: ahora.toISOString().split('T')[0],
            hora:  ahora.toLocaleTimeString('es-CO',{hour:'2-digit',minute:'2-digit'}),
          }).then(()=>{}, e=>console.error('ger facturacion', e));
          // 2) Trazabilidad para dashboard de cobros
          await supabase.from('cobros_trazabilidad').insert({ restaurante_id: restauranteId, mesa_numero:selectedTable?.num, mesero:gerNombre, total, propina:0, propina_pct:0, metodo_pago:gerMetodo, platos_servidos:items.length, factura_tipo:'gerencia', factura_email:null }).then(()=>{}).catch(()=>{});
          // 3) Audit de descuento si aplica
          if (gerDescPct>0 || gerBono) {
            await supabase.from('cuenta_ediciones').insert({ restaurante_id: restauranteId, mesa_numero:selectedTable?.num, tipo:'descuento_gerencia', plato_nombre:`Descuento ${gerDescPct}%${gerBono?` + bono ${gerBono.codigo}`:''}`, motivo:gerDescMotivo||'Cobro gerencia', autorizado_por:gerNombre, mesero:gerNombre, estado:'aprobado', notificado_caja:true }).then(()=>{}).catch(()=>{});
          }
          // 4) Marcar bono como usado
          if (gerBono?.id) { await supabase.from('bonos_regalo').update({ usado:true, usado_at:ahora.toISOString(), usado_por:'gerencia' }).eq('id', gerBono.id).then(()=>{}).catch(()=>{}); }
          // 5) Cerrar orden + mesa
          const { data: ordenes } = await supabase.from('orders').select('id').eq('table_id', selectedTable?.num ?? 0).eq('status','open').limit(1);
          if (ordenes?.[0]) {
            await supabase.from('orders').update({ status:'closed' }).eq('id', ordenes[0].id);
            await supabase.from('order_items').update({ status:'served' }).eq('order_id', ordenes[0].id).neq('status','cancelled');
          }
          const mesaName = String((selectedTable as any)?.name ?? selectedTable?.num ?? '');
          if (mesaName) { try { await supabase.rpc('cerrar_mesa', { p_mesa_name: mesaName }); } catch {} }
          limpiarMesaCerrada(selectedTable?.num);
          setGerOpen(false);
          showToast(`✓ Mesa ${selectedTable?.num} cobrada (gerencia) · $${fmt(total)}`);
        };
        return (
          <div className="fixed inset-0 bg-black/80 z-[650] flex items-center justify-center p-4">
            <div className="bg-[#1c1c1c] border border-[#d4943a]/40 rounded-2xl w-full max-w-[420px] max-h-[92vh] overflow-y-auto">
              {!gerPinOk ? (
                /* ── Fase 1: PIN de gerencia ── */
                <div className="p-6">
                  <div className="text-center mb-5">
                    <div className="w-12 h-12 rounded-xl bg-[#d4943a]/10 border border-[#d4943a]/30 flex items-center justify-center mx-auto mb-3">
                      <Lock size={22} className="text-[#d4943a]" />
                    </div>
                    <div className="text-[16px] font-black text-[#f0f0f0]">Cobro Gerencia</div>
                    <div className="text-[12px] text-[#909090] mt-1">Mesa {selectedTable?.num} · Ingresa el PIN de gerencia</div>
                  </div>
                  <input type="password" value={gerPin} maxLength={4} autoFocus
                    onChange={e => { setGerPin(e.target.value.replace(/\D/g,'')); setGerPinErr(''); }}
                    onKeyDown={e => { if (e.key==='Enter') { if (gerPin===PIN_GERENTE) setGerPinOk(true); else { setGerPinErr('PIN incorrecto'); setGerPin(''); } } }}
                    placeholder="••••"
                    className="w-full bg-[#0a0a0a] border border-[#2a2a2a] rounded-xl px-4 py-3 text-center text-[24px] tracking-[8px] text-[#f0f0f0] outline-none focus:border-[#d4943a]" />
                  {gerPinErr && <div className="text-[11px] text-[#e05050] text-center mt-2">{gerPinErr}</div>}
                  <div className="flex gap-2 mt-5">
                    <button onClick={() => setGerOpen(false)} className="flex-1 py-3 rounded-xl border border-[#2a2a2a] text-[#909090] text-[13px] font-bold">Cancelar</button>
                    <button onClick={() => { if (gerPin===PIN_GERENTE) setGerPinOk(true); else { setGerPinErr('PIN incorrecto'); setGerPin(''); } }}
                      className="flex-1 py-3 rounded-xl bg-[#d4943a] text-black text-[13px] font-black">Entrar</button>
                  </div>
                </div>
              ) : (
                /* ── Fase 2: cobro con ajustes de gerencia ── */
                <div className="p-5">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <div className="text-[15px] font-black text-[#f0f0f0]">👔 Cobro Gerencia</div>
                      <div className="text-[11px] text-[#909090]">Mesa {selectedTable?.num} · {items.length} ítem{items.length===1?'':'s'}</div>
                    </div>
                    <button onClick={() => setGerOpen(false)} className="w-8 h-8 rounded-full bg-[#0a0a0a] border border-[#2a2a2a] text-[#909090] flex items-center justify-center"><X size={16}/></button>
                  </div>

                  {/* Historial del cliente — gasto total, ticket promedio, última encuesta */}
                  {gerCliente && (
                    <div className="bg-[#0a0a0a] border border-[#3dba6f]/30 rounded-xl p-3 mb-3">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-[16px]">{gerCliente.vip_status?'⭐':'✓'}</span>
                        <div className="flex-1 min-w-0">
                          <div className="text-[12px] font-bold text-[#3dba6f] truncate">{gerCliente.name}{gerCliente.vip_status?' · VIP':''}</div>
                          <div className="text-[10px] text-[#909090]">{gerCliente.total_visits||0} visita(s)</div>
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        <span className="text-[10px] font-bold bg-[#3dba6f]/15 text-[#3dba6f] px-2 py-0.5 rounded-md">💰 Gasto total ${fmt(Number(gerCliente.total_spent||0))}</span>
                        <span className="text-[10px] font-bold bg-[#4a8fd4]/15 text-[#4a8fd4] px-2 py-0.5 rounded-md">🎟️ Ticket prom. ${fmt(Number(gerCliente.ticketProm||0))}</span>
                        {gerCliente.ultimaEstrellas!=null && <span className="text-[10px] font-bold bg-[#d4943a]/15 text-[#d4943a] px-2 py-0.5 rounded-md">{'★'.repeat(gerCliente.ultimaEstrellas)}{'☆'.repeat(Math.max(0,5-gerCliente.ultimaEstrellas))} última encuesta</span>}
                        {gerCliente.score>0 && <span className="text-[10px] font-bold bg-[#3dba6f]/15 text-[#3dba6f] px-2 py-0.5 rounded-md">📊 Score {gerCliente.score}</span>}
                      </div>
                      {gerCliente.ultimaEstrellas!=null && gerCliente.ultimoComentario && (
                        <div className="text-[10px] text-[#808080] italic mt-1.5">"{gerCliente.ultimoComentario}"</div>
                      )}
                    </div>
                  )}

                  {/* Descuento por gerencia / influencer — hasta 100% */}
                  <div className="bg-[#0a0a0a] rounded-xl p-3 mb-3">
                    <div className="text-[10px] text-[#606060] font-bold uppercase tracking-wider mb-2">Descuento (hasta 100%)</div>
                    <div className="flex flex-wrap gap-1.5 mb-2">
                      {[0,10,25,50,100].map(p => (
                        <button key={p} onClick={() => setGerDescPct(p)}
                          className={`px-3 py-1.5 rounded-lg text-[11px] font-bold border transition-all ${gerDescPct===p ? 'border-[#3dba6f] bg-[#3dba6f]/15 text-[#3dba6f]' : 'border-[#2a2a2a] text-[#909090]'}`}>
                          {p===0?'—':`${p}%`}
                        </button>
                      ))}
                      <button onClick={() => { setGerDescPct(100); setGerDescMotivo('Influencer'); }}
                        className={`px-3 py-1.5 rounded-lg text-[11px] font-bold border transition-all ${gerDescPct===100 && gerDescMotivo==='Influencer' ? 'border-[#9b72ff] bg-[#9b72ff]/15 text-[#b388ff]' : 'border-[#2a2a2a] text-[#909090]'}`}>
                        ⭐ Influencer 100%
                      </button>
                    </div>
                    <div className="flex items-center gap-2">
                      <input type="number" min={0} max={100} value={gerDescPct||''} placeholder="% manual"
                        onChange={e => { const v = Math.max(0, Math.min(100, parseInt(e.target.value)||0)); setGerDescPct(v); }}
                        className="w-20 bg-[#141414] border border-[#2a2a2a] rounded-md px-2 py-1.5 text-[12px] text-[#f0f0f0] outline-none focus:border-[#d4943a]" />
                      <input value={gerDescMotivo} onChange={e => setGerDescMotivo(e.target.value)} placeholder="Motivo (influencer, cortesía…)"
                        className="flex-1 bg-[#141414] border border-[#2a2a2a] rounded-md px-2 py-1.5 text-[12px] text-[#f0f0f0] outline-none focus:border-[#d4943a]" />
                    </div>
                  </div>

                  {/* Bono */}
                  <div className="bg-[#0a0a0a] rounded-xl p-3 mb-3">
                    <div className="text-[10px] text-[#606060] font-bold uppercase tracking-wider mb-2">Aplicar bono</div>
                    <div className="flex gap-2">
                      <input value={gerBonoCode} onChange={e => setGerBonoCode(e.target.value.toUpperCase())} placeholder="CÓDIGO"
                        className="flex-1 bg-[#141414] border border-[#2a2a2a] rounded-md px-2 py-1.5 text-[12px] text-[#f0f0f0] outline-none focus:border-[#9b72ff] uppercase" />
                      <button onClick={validarBonoGer} className="px-3 py-1.5 rounded-md bg-[#9b72ff] text-white text-[12px] font-bold">Validar</button>
                    </div>
                    {gerBonoMsg && <div className={`text-[11px] mt-2 ${gerBono?'text-[#3dba6f]':'text-[#e05050]'}`}>{gerBonoMsg}</div>}
                  </div>

                  {/* Totales */}
                  <div className="bg-[#0a0a0a] rounded-xl p-3 mb-3 flex flex-col gap-1.5">
                    <div className="flex justify-between text-[12px] text-[#a0a0a0]"><span>Subtotal</span><span>${fmt(subtotal)}</span></div>
                    {gerDescPct>0 && <div className="flex justify-between text-[12px] text-[#3dba6f]"><span>Descuento ({gerDescPct}%){gerDescMotivo?` · ${gerDescMotivo}`:''}</span><span>-${fmt(descMonto)}</span></div>}
                    {bonoMonto>0 && <div className="flex justify-between text-[12px] text-[#b388ff]"><span>Bono {gerBono?.codigo}</span><span>-${fmt(bonoMonto)}</span></div>}
                    <div className="flex justify-between text-[12px] text-[#a0a0a0]"><span>Impoconsumo (8%)</span><span>${fmt(iva)}</span></div>
                    <div className="flex justify-between text-[17px] font-black pt-2 border-t border-[#2a2a2a] mt-1"><span className="text-[#f0f0f0]">Total</span><span className="text-[#f0b45a]">${fmt(total)}</span></div>
                  </div>

                  {/* Método de pago */}
                  <div className="text-[10px] text-[#606060] font-bold uppercase tracking-wider mb-2">Método de pago</div>
                  <div className="grid grid-cols-3 gap-1.5 mb-4">
                    {['Datafono','Efectivo','Transferencia','Bono','Cortesía','Empleado'].map(m => (
                      <button key={m} onClick={() => setGerMetodo(m)}
                        className={`py-2 rounded-lg text-[11px] font-bold border transition-all ${gerMetodo===m ? 'border-[#d4943a] bg-[#d4943a]/15 text-[#f0b45a]' : 'border-[#2a2a2a] text-[#909090]'}`}>
                        {m}
                      </button>
                    ))}
                  </div>

                  <button onClick={cobrar}
                    className="w-full py-3.5 rounded-xl bg-[#3dba6f] text-black text-[14px] font-black hover:bg-[#4dca7f] transition-all">
                    Cobrar ${fmt(total)} y cerrar mesa
                  </button>
                </div>
              )}
            </div>
          </div>
        );
      })()}

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
        <TerminoObservModal
          producto={terminoModal.producto}
          modo={terminoModal.modo}
          onClose={() => setTerminoModal({ open: false, producto: null, modo: 'orden' })}
          onConfirm={(termino, observ, tags) => {
            const p = { ...terminoModal.producto, _observ: observ, _tags: tags };
            const modo = terminoModal.modo;
            setTerminoModal({ open: false, producto: null, modo: 'orden' });
            if (modo === 'orden') agregarAOrdenDirecto(p, termino);
            else marcharAhoraDirecto(p, termino);
          }}
        />
      )}

      {/* MODAL SELECTOR DE COLOR DEL MESERO — al primer login */}
      {colorPickerAbierto && (
        <div className="fixed inset-0 bg-black/90 z-[700] flex items-center justify-center p-4">
          <div className="bg-[#1c1c1c] border border-[#2a2a2a] rounded-2xl p-7 w-full max-w-[440px]">
            <div className="text-center mb-5">
              <div className="text-[40px] mb-3">🎨</div>
              <div className="font-['Syne'] text-[20px] font-black text-[#f0f0f0] mb-1">Bienvenido, {miNombre.split(' ')[0]}</div>
              <div className="text-[12px] text-[#a0a0a0]">Elige tu color. Tus mesas tendrán este borde en el mapa para que las reconozcas al instante.</div>
            </div>
            <div className="grid grid-cols-5 gap-3 mb-4">
              {COLORES_MESERO.map(c => (
                <button key={c.hex} onClick={() => elegirMiColor(c.hex)}
                  title={c.label}
                  className="aspect-square rounded-xl border-2 transition-all hover:scale-110 active:scale-95"
                  style={{ background: c.hex, borderColor: c.hex }}>
                  <span className="sr-only">{c.label}</span>
                </button>
              ))}
            </div>
            <div className="text-[10px] text-[#606060] text-center">Este color se guarda y solo se elige una vez.</div>
          </div>
        </div>
      )}

      {/* MODAL NIVEL DE PICANTE — Gallo Colorado */}
      {/* MODAL ⚡ INTEL DEL DÍA — resumen rápido del mesero */}
      {intelOpen && (
        <div className="fixed inset-0 bg-black/85 z-[700] flex items-center justify-center p-4" onClick={() => setIntelOpen(false)}>
          <div className="bg-[#0f0f1a] border border-[#9b72ff]/40 rounded-2xl p-7 w-full max-w-[460px]" onClick={e => e.stopPropagation()}>
            <div className="flex items-center gap-3 mb-5">
              <div className="w-12 h-12 rounded-2xl flex items-center justify-center text-[28px]"
                style={{ background:'linear-gradient(135deg,#9b72ff,#7c5ac7)' }}>⚡</div>
              <div className="flex-1">
                <div className="font-['Syne'] text-[20px] font-black text-[#f0f0f0]">Intel del día</div>
                <div className="text-[11px] text-[#a0a0a0]">{miNombre} · {new Date().toLocaleDateString('es-CO',{weekday:'long',day:'numeric',month:'long'})}</div>
              </div>
              <button onClick={() => setIntelOpen(false)} className="w-8 h-8 rounded-lg border border-[#2a2a2a] text-[#606060] hover:text-white text-[14px]">✕</button>
            </div>

            {/* KPIs */}
            <div className="grid grid-cols-2 gap-3 mb-5">
              <div className="rounded-xl p-3" style={{ background:'rgba(61,186,111,0.08)', border:'1px solid rgba(61,186,111,0.25)' }}>
                <div className="text-[9px] text-[#7a8499] uppercase tracking-wider mb-1">💰 Mis ventas hoy</div>
                <div className="font-['Syne'] text-[22px] font-black text-[#3dba6f]">${Math.round(intelData.ventas).toLocaleString('es-CO')}</div>
                <div className="text-[10px] text-[#7a8499] mt-1">{intelData.tickets} cuenta{intelData.tickets!==1?'s':''} cerrada{intelData.tickets!==1?'s':''}</div>
              </div>
              <div className="rounded-xl p-3" style={{ background:'rgba(212,148,58,0.08)', border:'1px solid rgba(212,148,58,0.25)' }}>
                <div className="text-[9px] text-[#7a8499] uppercase tracking-wider mb-1">💵 Mis propinas</div>
                <div className="font-['Syne'] text-[22px] font-black text-[#d4943a]">${Math.round(intelData.propinas).toLocaleString('es-CO')}</div>
                <div className="text-[10px] text-[#7a8499] mt-1">{intelData.ventas > 0 ? Math.round((intelData.propinas / intelData.ventas) * 100) : 0}% del total</div>
              </div>
              <div className="rounded-xl p-3" style={{ background:'rgba(155,114,255,0.08)', border:'1px solid rgba(155,114,255,0.25)' }}>
                <div className="text-[9px] text-[#7a8499] uppercase tracking-wider mb-1">🎯 Retos hoy</div>
                <div className="font-['Syne'] text-[22px] font-black text-[#9b72ff]">{intelData.retosCumplidos}</div>
                <div className="text-[10px] text-[#7a8499] mt-1">platos vendidos con multiplicador</div>
              </div>
              <div className="rounded-xl p-3" style={{ background:'rgba(34,211,238,0.08)', border:'1px solid rgba(34,211,238,0.25)' }}>
                <div className="text-[9px] text-[#7a8499] uppercase tracking-wider mb-1">✦ Pts NX bonus</div>
                <div className="font-['Syne'] text-[22px] font-black text-[#22d3ee]">+{intelData.puntosOtorgados.toLocaleString('es-CO')}</div>
                <div className="text-[10px] text-[#7a8499] mt-1">pts extra por retos</div>
              </div>
            </div>

            {/* Retos activos del día */}
            {retosNXActivos.length > 0 && (
              <div className="mb-2">
                <div className="text-[10px] text-[#7a8499] uppercase tracking-wider font-bold mb-2">🎯 Retos vigentes — recomienda estos platos</div>
                <div className="flex flex-col gap-1.5 max-h-[180px] overflow-y-auto">
                  {retosNXActivos.map((r:any, i:number) => {
                    const multiColor = r.multiplicador===2?'#22d3ee':r.multiplicador===3?'#FFB547':r.multiplicador===4?'#FF2D78':'#9b72ff';
                    return (
                      <div key={i} className="flex items-center gap-3 px-3 py-2 rounded-lg" style={{ background:'rgba(255,255,255,0.03)', border:`1px solid ${multiColor}30` }}>
                        <span style={{ fontSize: 24 }}>{r.emoji || '🍽️'}</span>
                        <div className="flex-1 min-w-0">
                          <div className="text-[12px] font-bold text-[#f0f0f0] truncate">{r.producto_nombre}</div>
                          {r.motivacion_mesero && <div className="text-[10px] truncate" style={{ color: multiColor }}>{r.motivacion_mesero}</div>}
                        </div>
                        <div className="font-['Syne'] font-black text-[18px]" style={{ color: multiColor }}>x{r.multiplicador}</div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* MODAL DE MODIFICADORES — bebidas, agregar/quitar, hielo, leche, etc. */}
      {modifModal.open && modifModal.producto && (
        <div className="fixed inset-0 bg-black/80 z-[600] flex items-center justify-center p-4">
          <div className="bg-[#1c1c1c] border border-[#9b72ff]/40 rounded-2xl p-6 w-full max-w-[420px] max-h-[88vh] overflow-y-auto">
            <div className="text-center mb-5">
              <div className="text-[28px] mb-2">{modifModal.producto.emoji}</div>
              <div className="font-['Syne'] text-[16px] font-bold">{modifModal.producto.nombre}</div>
              <div className="text-[10px] text-[#9b72ff] mt-1">Configura los detalles del pedido</div>
            </div>
            <div className="flex flex-col gap-4 mb-4">
              {modifModal.producto.modificadores.map((m: any) => (
                <div key={m.id}>
                  <div className="text-[11px] font-bold text-[#a0a0a0] mb-2 uppercase tracking-wider flex items-center gap-1">
                    {m.label}
                    {m.obligatorio && <span className="text-[#e05050]">*</span>}
                    {m.tipo === 'multi' && <span className="text-[9px] text-[#606060] normal-case font-normal tracking-normal">· puedes elegir varios</span>}
                  </div>
                  <div className="flex flex-col gap-1.5">
                    {m.opciones.map((op: any) => {
                      const sel = modifModal.selecciones[m.id];
                      const activo = m.tipo === 'multi' ? Array.isArray(sel) && sel.includes(op.id) : sel === op.id;
                      return (
                        <button key={op.id}
                          onClick={() => {
                            setModifModal(prev => {
                              const next = { ...prev.selecciones };
                              if (m.tipo === 'multi') {
                                const arr = Array.isArray(next[m.id]) ? [...next[m.id]] : [];
                                const i = arr.indexOf(op.id);
                                if (i >= 0) arr.splice(i, 1); else arr.push(op.id);
                                next[m.id] = arr;
                              } else {
                                next[m.id] = next[m.id] === op.id ? undefined : op.id;
                              }
                              return { ...prev, selecciones: next };
                            });
                          }}
                          className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-xl border transition-all text-left ${activo ? 'border-[#9b72ff] bg-[#9b72ff]/15 text-[#9b72ff]' : 'border-[#2a2a2a] bg-transparent text-[#a0a0a0] hover:border-[#9b72ff]/40'}`}>
                          <span className={`w-3 h-3 ${m.tipo === 'multi' ? 'rounded' : 'rounded-full'} border ${activo ? 'bg-[#9b72ff] border-[#9b72ff]' : 'border-[#606060]'} flex items-center justify-center text-[8px] text-white`}>
                            {activo && '✓'}
                          </span>
                          <span className="flex-1 text-[12px] font-bold">{op.label}</span>
                          {op.extra > 0 && <span className="text-[11px] text-[#d4943a]">+${Number(op.extra).toLocaleString('es-CO')}</span>}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
            <div className="flex gap-2">
              <button onClick={() => setModifModal({ open: false, producto: null, modo: 'orden', selecciones: {} })}
                className="flex-1 py-2.5 rounded-xl border border-[#2a2a2a] text-[#606060] text-[11px] font-semibold hover:border-[#a0a0a0] transition-all">
                Cancelar
              </button>
              <button onClick={aplicarModificadores}
                className="flex-[2] py-2.5 rounded-xl bg-[#9b72ff] text-white text-[12px] font-bold hover:bg-[#7c5ac7] transition-all">
                ✓ Confirmar pedido
              </button>
            </div>
          </div>
        </div>
      )}

      {picanteModal.open && picanteModal.producto && (
        <div className="fixed inset-0 bg-black/80 z-[600] flex items-center justify-center p-4">
          <div className="bg-[#1c1c1c] border border-[#c63a2a]/40 rounded-2xl p-6 w-full max-w-[360px]">
            <div className="text-center mb-5">
              <div className="text-[28px] mb-2">{picanteModal.producto.emoji}</div>
              <div className="font-['Syne'] text-[16px] font-bold">{picanteModal.producto.nombre}</div>
              <div className="text-[11px] text-[#a0a0a0] mt-1">¿Qué nivel de picante quiere el comensal?</div>
            </div>
            <div className="flex flex-col gap-2 mb-4">
              {NIVELES_PICANTE.map(n => (
                <button key={n.key}
                  onClick={() => elegirPicante(n.key)}
                  className="w-full flex items-center gap-3 px-4 py-3 rounded-xl border border-[#2a2a2a] hover:border-[#c63a2a] hover:bg-[#c63a2a]/10 transition-all text-left">
                  <span className="text-[26px]">{n.emoji}</span>
                  <div className="flex-1 min-w-0">
                    <div className="text-[13px] font-bold text-[#f0f0f0] leading-tight">{n.label}</div>
                    <div className="text-[10px] text-[#a0a0a0]">{n.desc}</div>
                  </div>
                </button>
              ))}
            </div>
            <button onClick={() => setPicanteModal({ open: false, producto: null, modo: 'orden' })}
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
        className={`fixed top-2 right-2 z-[9000] flex items-center justify-center w-8 h-8 rounded-lg border font-semibold transition-all shadow-lg ${
          isFullscreen
            ? 'bg-[#d4943a] border-[#d4943a] text-black'
            : 'bg-[#1c1c1c] border-[#d4943a]/60 text-[#d4943a] hover:bg-[#d4943a] hover:text-black'
        }`}>
        {isFullscreen
          ? <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M8 3v3a2 2 0 0 1-2 2H3m18 0h-3a2 2 0 0 1-2-2V3m0 18v-3a2 2 0 0 1 2-2h3M3 16h3a2 2 0 0 1 2 2v3"/></svg>
          : <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"/></svg>
        }
      </button>

      {/* LEFT PANEL */}
      <div className="bg-[#141414] border-r border-[#2a2a2a] flex flex-col shrink-0" style={{ width: 200 }}>
        <div className="p-2 px-3 pb-2 flex items-center gap-2 border-b border-[#2a2a2a] shrink-0 relative">
          {/* Botón Mesas — acción principal del POS (ocupa todo el ancho).
              El ⚡ Brief se movió al lado del nombre del cliente (header). */}
          <button onClick={() => setShowMapaMesas(true)}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-[#d4943a]/15 border border-[#d4943a]/40 text-[#d4943a] text-[13px] font-black hover:bg-[#d4943a]/25 active:scale-95 transition-all">
            <span style={{display:'inline-flex',alignItems:'center',justifyContent:'center',width:18,height:18,borderRadius:'50%',border:'1.5px solid #d4943a',fontSize:10,fontWeight:900}}>M</span>
            <span>Mesas</span>
          </button>
          <div className="flex gap-1.5 ml-auto shrink-0">
            {/* Cerebro */}
            <div onClick={() => { setRightTab('IA'); onOpenVisionAI?.(); }}
              className="w-[28px] h-[28px] rounded-lg bg-[#1c1c1c] border border-[#2a2a2a] flex items-center justify-center cursor-pointer text-[#a0a0a0] hover:text-[#d4943a] hover:border-[#d4943a] transition-all"
              title="Cerebro Nexum IA">
              <Sparkles size={13} />
            </div>
            {/* Campana Flow — alertas platos listos */}
            <div onClick={() => setShowNotifications(!showNotifications)}
              className={`w-[28px] h-[28px] rounded-lg border flex items-center justify-center cursor-pointer transition-all relative ${flowAlertasVisibles.length > 0 ? 'bg-[#3dba6f]/15 border-[#3dba6f] text-[#3dba6f] animate-pulse' : showNotifications ? 'bg-[#d4943a]/10 border-[#d4943a] text-[#d4943a]' : 'bg-[#1c1c1c] border-[#2a2a2a] text-[#a0a0a0] hover:text-[#3dba6f] hover:border-[#3dba6f]'}`}
              title="Alertas platos listos">
              <BellRing size={13} />
              {flowAlertasVisibles.length > 0 && <div className="absolute -top-1 -right-1 w-[14px] h-[14px] rounded-full bg-[#3dba6f] flex items-center justify-center text-[8px] font-black text-black">{flowAlertasVisibles.length}</div>}
            </div>
          </div>
          {showNotifications && (
            <div className="absolute top-[44px] left-2 w-[310px] bg-[#1c1c1c] border border-[#2a2a2a] rounded-xl shadow-2xl z-50 overflow-hidden" style={{maxHeight:420,overflowY:'auto'}}>
              <div className="p-3 border-b border-[#2a2a2a] flex justify-between items-center bg-[#141414]">
                <div className="flex items-center gap-2">
                  <span className={`w-2 h-2 rounded-full inline-block ${flowAlertasVisibles.length>0?'bg-[#3dba6f] animate-pulse':'bg-[#606060]'}`}/>
                  <span className="font-['Syne'] text-[12px] font-bold">🍽️ Platos Listos para Entrega</span>
                  {flowAlertasVisibles.length>0 && <span className="bg-[#3dba6f] text-black text-[9px] font-black px-1.5 rounded-full">{flowAlertasVisibles.length}</span>}
                </div>
                <div className="flex gap-2 items-center">
                  <button onClick={async()=>{
                    const idsFlow = flowAlertasVisibles.map((a:any)=>a.id);
                    const idsNotif = notifsVisibles.filter((n:any)=>!n.leida).map((n:any)=>n.id);
                    if (idsFlow.length) await supabase.from('flow_alertas').update({leida:true}).in('id', idsFlow);
                    if (idsNotif.length) await supabase.from('nexum_notificaciones').update({leida:true}).in('id', idsNotif);
                    setFlowAlertas((p:any[])=>p.filter((a:any)=>!idsFlow.includes(a.id)));
                    setNotifsBadge(0);
                    setNotifs((p:any[])=>p.map((n:any)=>idsNotif.includes(n.id)?{...n,leida:true}:n));
                    setShowNotifications(false);
                    showToast('✓ Todo leído');
                  }} className="text-[9px] text-[#3dba6f] hover:underline cursor-pointer font-bold">✓ Todo leído</button>
                  <span onClick={() => setShowNotifications(false)} className="text-[10px] text-[#606060] cursor-pointer hover:text-white">✕</span>
                </div>
              </div>
              {/* Platos listos de Flow */}
              {flowAlertasVisibles.length === 0 && (
                <div className="p-5 text-center text-[11px] text-[#606060]">
                  <div className="text-2xl mb-2">✅</div>
                  <div>Todas las entregas al día</div>
                </div>
              )}
              {flowAlertasVisibles.map((a:any) => (
                <div key={a.id} className="p-3 border-b border-[#1a1a1a] hover:bg-[#222] cursor-pointer flex gap-2.5"
                  style={{background:'rgba(61,186,111,0.04)'}}>
                  <span className="text-[18px] shrink-0">🍽️</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between gap-2">
                      <span className="text-[12px] font-bold text-[#3dba6f] truncate">{a.plato}</span>
                      <span className="text-[10px] font-black text-[#3dba6f] shrink-0">M{a.mesa_num}</span>
                    </div>
                    <div className="text-[10px] text-[#a0a0a0] mt-0.5">
                      👤 {a.mesero||'—'} · 👨‍🍳 {a.cocinero||'—'}
                    </div>
                    <div className="text-[9px] text-[#606060] mt-0.5">
                      {new Date(a.created_at).toLocaleTimeString('es-CO',{hour:'2-digit',minute:'2-digit'})} · {a.estacion||'—'}
                    </div>
                  </div>
                  <button onClick={async(e)=>{ e.stopPropagation(); await supabase.from('flow_alertas').update({leida:true}).eq('id',a.id); setFlowAlertas((prev:any[])=>prev.filter((x:any)=>x.id!==a.id)); setFlowAlertas(p=>p.filter((x:any)=>x.id!==a.id)); }}
                    className="text-[10px] text-[#606060] hover:text-[#3dba6f] px-1 self-start mt-1">✓</button>
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
          {/* CTA cuando el mesero no tiene mesas abiertas */}
          {misMesasAbiertas.length === 0 && (
            <button onClick={() => setShowMapaMesas(true)}
              className="mt-4 p-6 rounded-2xl border-2 border-dashed text-center transition-all hover:scale-[1.02]"
              style={{
                borderColor: sanearHex(profile?.color) + '60',
                background: sanearHex(profile?.color) + '08',
              }}>
              <div className="text-[40px] mb-2">🗺️</div>
              <div className="font-['Syne'] text-[14px] font-black mb-1" style={{ color: sanearHex(profile?.color) }}>Aún no tienes mesas</div>
              <div className="text-[11px] text-[#a0a0a0]">Toca para abrir el Mapa y tomar un cliente</div>
            </button>
          )}

          {/* Solo la mesa seleccionada — navegación con flechas (solo entre MIS mesas) */}
          {misMesasAbiertas.length > 0 && (() => {
            const idxMia = misMesasAbiertas.findIndex(m => m.id === selectedTableId);
            const idx = idxMia >= 0 ? idxMia : 0;
            const m = misMesasAbiertas[idx];
            if (!m) return null;
            const pct = Math.min(100, Math.round((mesaSubtotal / ((m.meta||120)*1000)) * 100));
            const colorClass = pct >= 80 ? 'bg-[#3dba6f]' : pct >= 50 ? 'bg-[#d4943a]' : 'bg-[#e05050]';
            return (
              <>
                {/* Navegación entre MIS mesas */}
                <div className="flex items-center justify-between mb-1">
                  <button onClick={() => { const prev = misMesasAbiertas[idx - 1]; if (prev) setSelectedTableId(prev.id); }}
                    disabled={idx === 0}
                    className="w-7 h-7 rounded-lg bg-[#1c1c1c] border border-[#2a2a2a] flex items-center justify-center text-[#a0a0a0] disabled:opacity-30 hover:border-[#d4943a] hover:text-[#d4943a] transition-all text-[14px]">‹</button>
                  <span className="text-[11px] text-[#606060]">{idx + 1} de {misMesasAbiertas.length} mías</span>
                  <button onClick={() => { const next = misMesasAbiertas[idx + 1]; if (next) setSelectedTableId(next.id); }}
                    disabled={idx === misMesasAbiertas.length - 1}
                    className="w-7 h-7 rounded-lg bg-[#1c1c1c] border border-[#2a2a2a] flex items-center justify-center text-[#a0a0a0] disabled:opacity-30 hover:border-[#d4943a] hover:text-[#d4943a] transition-all text-[14px]">›</button>
                </div>

                {/* Card de la mesa activa — diseño compacto (200px) */}
                <div className="rounded-xl overflow-hidden"
                  style={{ border: `1.5px solid ${sanearHex(profile?.color)}55`, background:'#1c1c1c' }}>

                  {/* HEADER — número compacto + zona en UNA fila */}
                  <div className="px-2.5 pt-2 pb-1.5">
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-baseline gap-1">
                        <span className="font-['Syne'] font-black text-[20px] leading-none"
                          style={{ color: sanearHex(profile?.color) }}>{nombreMesa(m)}</span>
                        <span className="text-[9px] text-[#a0a0a0] font-bold">{m.pax}p</span>
                      </div>
                      <div className="flex items-center gap-1">
                        {m.vip  && <span className="text-[11px]" title="VIP">⭐</span>}
                        {m.bday && <span className="text-[11px]" title="Cumpleaños">🎂</span>}
                        {m.alert && <span className="text-[11px]" title="Alerta">⚠️</span>}
                      </div>
                    </div>

                    {/* Zona + cliente · línea fina */}
                    <div className="flex items-center gap-1.5 text-[9px]" style={{color:'#808080'}}>
                      <span className="shrink-0">📍 {((m as any).zona || 'Salón').slice(0,14)}</span>
                      {m.cliente && (
                        <>
                          <span style={{color:'#3a3a3a'}}>·</span>
                          <span className="truncate" style={{color:'#a0a0a0',fontWeight:600}}>{m.cliente}</span>
                        </>
                      )}
                    </div>
                  </div>

                  {/* OBJETIVO TICKET — card interna con su propio fondo */}
                  <div className="mx-2 mb-2 rounded-lg" style={{background:'#0e0e14', border:'1px solid #1e1e24'}}>
                    <div className="px-3 pt-2 pb-1 flex items-center justify-between">
                      <span className="text-[8.5px] font-black uppercase" style={{color:'#5a5a5a', letterSpacing:'.14em'}}>Objetivo</span>
                      <span className="text-[10px] tabular-nums" style={{color:'#6a6a6a'}}>{m.time}</span>
                    </div>
                    <div className="px-3 pb-1.5">
                      <div className="flex items-baseline gap-1 mb-1">
                        <span className="font-['Syne'] text-[17px] font-black tabular-nums" style={{color: pct >= 80 ? '#3dba6f' : pct >= 50 ? '#d4943a' : '#e05050', lineHeight:1}}>
                          ${formatPrecio(mesaSubtotal)}
                        </span>
                        <span className="text-[10px] tabular-nums" style={{color:'#5a5a5a'}}>/ ${formatPrecio(m.meta*1000)}</span>
                      </div>
                      <div className="h-[4px] bg-[#1e1e24] rounded-full overflow-hidden">
                        <div className={`h-full rounded-full transition-all duration-500 ${colorClass}`} style={{ width: `${Math.min(pct,100)}%` }}></div>
                      </div>
                      <div className="text-[9px] mt-1 font-bold tabular-nums" style={{ color: pct >= 80 ? '#3dba6f' : pct >= 50 ? '#d4943a' : '#e05050' }}>
                        {pct}% {pct>=100?'✓':''}
                      </div>
                    </div>
                  </div>
                </div>

{/* Botón Brief → chat IA */}

                {/* Mini lista de otras mesas — ordenadas por más tiempo sin marchar */}
                {misMesasAbiertas.length > 1 && (
                  <div className="mt-2">
                    <div className="text-[10px] text-[#606060] font-bold uppercase tracking-wider mb-1.5">⏱ Más demoradas sin marchar</div>
                    <div className="flex flex-col gap-1">
                      {misMesasAbiertas
                        .filter((t:any) => t.id !== selectedTableId)
                        .map((t:any) => ({ t, min: minutosSinMarchar(t.num, order) }))
                        .sort((a, b) => b.min - a.min)
                        .slice(0, 5)
                        .map(({ t, min }) => {
                          const tp = Math.min(100, Math.round((t.ticket / (t.meta||120)) * 100));
                          const tc = tp >= 80 ? 'bg-[#3dba6f]' : tp >= 50 ? 'bg-[#d4943a]' : 'bg-[#e05050]';
                          const minColor = min === Infinity ? '#606060' : min >= 30 ? '#e05050' : min >= 15 ? '#d4943a' : '#3dba6f';
                          const minTexto = min === Infinity ? 'sin marca' : min < 1 ? '<1m' : `${Math.floor(min)}m`;
                          return (
                            <div key={t.id} onClick={() => setSelectedTableId(t.id)}
                              className="flex items-center gap-2 p-1.5 px-2 rounded-lg bg-[#1a1a1a] border cursor-pointer hover:border-[#d4943a]/40 transition-all"
                              style={{ borderColor: `${profile?.color || '#2a2a2a'}30` }}>
                              <span className="text-[11px] font-bold shrink-0" style={{ color: sanearHex(profile?.color) }}>{nombreMesa(t)}</span>
                              <span className="text-[10px] text-[#606060] flex-1 truncate min-w-0">{t.cliente}</span>
                              <span className="text-[9px] font-bold tabular-nums shrink-0" style={{ color: minColor }} title="Minutos sin marchar">{minTexto}</span>
                              <div className="w-8 h-[3px] bg-[#2a2a2a] rounded-sm overflow-hidden shrink-0">
                                <div className={`h-full rounded-sm ${tc}`} style={{ width: `${tp}%` }}></div>
                              </div>
                            </div>
                          );
                        })}
                    </div>
                  </div>
                )}


                {/* COMPARTIR MESA — habilita a otro mesero a entrar */}
                {(() => {
                  const estMesa = mesasEstado.find((mm:any)=>String(mm.name)===String(m.num));
                  const compartidos: string[] = Array.isArray(estMesa?.meseros_compartidos) ? estMesa.meseros_compartidos : [];
                  const owner = estMesa?.mesero_nombre || miNombre;
                  return (
                    <div className="mt-3 pt-3 border-t border-[#2a2a2a]">
                      <button onClick={() => setMostrarCompartir(p => !p)}
                        className="w-full flex items-center justify-between text-[10px] font-bold text-[#606060] uppercase tracking-wider hover:text-[#3dba6f] transition-all">
                        <span className="flex items-center gap-1.5">👥 Compartir mesa{compartidos.length>0?` · ${compartidos.length}`:''}</span>
                        <span>{mostrarCompartir ? '▲' : '▼'}</span>
                      </button>
                      {mostrarCompartir && (
                        <div className="mt-2 flex flex-col gap-2">
                          <div className="text-[9px] text-[#606060]">
                            Mesa de <span className="text-[#d4943a] font-bold">{owner}</span>. Toca un mesero para darle acceso.
                          </div>
                          <div className="flex flex-wrap gap-1">
                            {meserosTodas.filter((ms:any)=>(ms.nombre_completo||ms.nombre)!==owner).map((ms:any)=>{
                              const nombre = ms.nombre_completo || ms.nombre || '—';
                              const activo = compartidos.includes(nombre);
                              return (
                                <button key={ms.id||nombre} onClick={()=>compartirMesaCon(m.num, nombre)}
                                  style={{ borderColor: activo ? '#3dba6f' : '#2a2a2a', background: activo ? '#3dba6f18' : '#1a1a1a', color: activo ? '#3dba6f' : '#a0a0a0' }}
                                  className="px-2 py-1 rounded-lg border text-[10px] font-bold transition-all">
                                  {activo?'✓ ':''}{nombre.split(' ')[0]}
                                </button>
                              );
                            })}
                            {meserosTodas.length===0 && (
                              <div className="text-[9px] text-[#606060]">No hay otros meseros activos</div>
                            )}
                          </div>
                          {compartidos.length>0 && (
                            <div className="text-[9px] text-[#3dba6f] bg-[#3dba6f]/10 border border-[#3dba6f]/20 rounded-lg px-2 py-1.5">
                              Comparten esta mesa: {compartidos.join(', ')}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })()}

                {/* EN PRODUCCIÓN — semáforo de tiempos por plato (verde/amarillo/rojo)
                    Igual lógica que Flow: verde<70%, amarillo<obj, rojo≥obj
                    Colapsable como 'Compartir mesa' · sin botones de leyenda */}
                {order.filter(o => o.mesa === selectedTable.num).length > 0 && (
                  <div className="mt-3 pt-3 border-t border-[#3dba6f]/30">
                    <button onClick={() => setMostrarEnProduccion(p => !p)}
                      className="w-full flex items-center justify-between text-[10px] font-bold text-[#3dba6f] uppercase tracking-wider hover:text-[#5dd88f] transition-all">
                      <span className="flex items-center gap-1.5">
                        🔥 En producción · M{selectedTable.num}
                        <span className="text-[9px] bg-[#3dba6f] text-black font-black px-1.5 py-0.5 rounded-full">
                          {order.filter(o => o.mesa === selectedTable.num).length}
                        </span>
                        <span className="text-[8px] text-[#606060] font-normal normal-case ml-1">↔ Flow</span>
                      </span>
                      <span>{mostrarEnProduccion ? '▲' : '▼'}</span>
                    </button>
                    {mostrarEnProduccion && (
                      <div className="flex flex-col gap-1 mt-2 max-h-[160px] overflow-y-auto" style={{ scrollbarWidth: 'none' }}>
                        {order.filter(o => o.mesa === selectedTable.num).map((item, i) => {
                          const semaforo = getSemaforo(item.created_at, item.estacion);
                          const sColor = semaforo === 'rojo' ? '#e05050' : semaforo === 'amarillo' ? '#FFB547' : '#3dba6f';
                          const sBg = semaforo === 'rojo' ? 'rgba(224,80,80,0.08)' : semaforo === 'amarillo' ? 'rgba(255,181,71,0.06)' : 'rgba(61,186,111,0.04)';
                          const minTranscurridos = item.created_at ? Math.floor((Date.now() - new Date(item.created_at).getTime()) / 60000) : 0;
                          return (
                            <div key={i} className="flex items-center gap-1.5 py-1 px-1.5 rounded-md"
                              style={{ background: sBg, borderLeft: `3px solid ${sColor}` }}>
                              <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: sColor, boxShadow: semaforo === 'rojo' ? `0 0 6px ${sColor}` : 'none' }}/>
                              <span className="text-[13px] shrink-0">{item.emoji}</span>
                              <span className="flex-1 text-[10px] text-[#f0f0f0] truncate">{item.nombre}</span>
                              {item.created_at && (
                                <span className="text-[10px] font-black tabular-nums shrink-0" style={{ color: sColor }}>
                                  {minTranscurridos < 1 ? '<1 min' : `${minTranscurridos} min`}
                                </span>
                              )}
                              <span className="text-[10px] text-[#d4943a] font-bold shrink-0">{item.precio}</span>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}

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
                        items.forEach(item => {
                          setStockFlow(prev => ({ ...prev, [item.nombre]: Math.max(0, (prev[item.nombre] ?? 10) - 1) }));
                          insertarPedidoFlow(item.nombre, item.categoria ?? currentCat, selectedTable.num, item.precio ? parsePrecio(item.precio) : 0);
                          agregarPlatoFlow({
                            mesa: selectedTable.num,
                            plato: item.nombre,
                            emoji: item.emoji ?? '🍽️',
                            mesero: miNombre,
                            etapa: 'cocina',
                            urgente: items.length >= 10,
                          });
                        });
                        // Enriquecer cada item marchando con timestamp + estación
                        const ahora = new Date().toISOString();
                        const itemsMarcando = items.map(it => {
                          const cat = (it as any).categoria || currentCat;
                          const est = inferirEstacionFromNombre(it.nombre, cat);
                          return {
                            ...it,
                            created_at: it.created_at || ahora,
                            estacion: it.estacion || est,
                            categoria: cat,
                            tipo: (est === 'bar' || est === 'cava') ? 'bebida' as const : 'comida' as const,
                          };
                        });
                        setOrder(prev => [...prev, ...itemsMarcando]);
                        setPendingOrder(prev => prev.filter(o => o.mesa !== selectedTable.num));
                        showToast(`🔥 ${items.length} plato${items.length!==1?'s':''} marchando → Flow`);
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
          {/* Botones panel derecho — eliminados de aquí, solo quedan en el right panel */}
        </div>

        {/* Products grid */}
        <div className="flex-1 p-2 overflow-y-auto min-h-0">
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
              const flowStock = stockFlow[p.nombre] ?? 99;
              // Estado 86 = Mi Menú lo marcó como no-disponible O Flow reporta stock 0
              const en86 = (p as any)._en86 === true || flowStock <= 0;
              const stock = en86 ? 0 : flowStock;
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

                  {/* Reto NX badge (x2 / x3 / x4) */}
                  {(() => {
                    const reto = retoDePlato(p.nombre);
                    if (!reto) return null;
                    const multiColor = reto.multiplicador===2?'#22d3ee':reto.multiplicador===3?'#FFB547':reto.multiplicador===4?'#FF2D78':'#9b72ff';
                    return (
                      <div className="absolute top-1.5 left-1.5 z-20 px-2 py-1 rounded-full text-[10px] font-black flex items-center gap-0.5"
                        style={{ background: multiColor, color:'#000', boxShadow:`0 0 12px ${multiColor}60` }}
                        title={reto.motivacion_mesero || 'Reto NX activo'}>
                        ✦ x{reto.multiplicador}
                      </div>
                    );
                  })()}

                  {/* Estado: solo mostramos 86 (no disponible) — los tiempos
                      de producción los muestra Flow por estación, no hace falta
                      ver un contador numérico en cada plato. */}
                  {stock <= 0 && (
                    <div className="absolute top-1.5 right-1.5 z-10 px-2 py-1 rounded-full text-[10px] font-black"
                      style={{ background:'#e0505022', color:'#e05050', border:'1px solid #e0505080', letterSpacing:'.1em' }}>
                      86
                    </div>
                  )}

                  <div className="w-full aspect-[4/3] bg-[#222] flex items-center justify-center text-[52px]">{p.emoji}</div>
                  <div className="p-3 flex flex-col gap-1.5 flex-1">
                    <div className="text-[14px] font-bold text-[#f0f0f0] leading-tight overflow-hidden text-ellipsis whitespace-nowrap pr-4">{p.nombre}</div>
                    <div className="flex items-center gap-1 flex-wrap">
                      <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${badgeColors[getBadgeClass(p.badge)] || 'bg-[#3dba6f]/15 text-[#3dba6f]'}`}>{getBadgeLabel(p.badge)}</span>
                      {requierePicante(p) && (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#c63a2a]/15 text-[#e07060] border border-[#c63a2a]/30" title="Pide nivel de picante al agregar">🌶️ picante</span>
                      )}
                    </div>
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

        {/* ══ BARRA INFERIOR · solo QUICK-ADD (filas ritual + IA recs removidas) ══
            Cuando se agrega un item, parpadea un ✓ verde como confirmación. */}
        {selectedTable && (
          <div className="bg-[#141414] border-t-2 border-[#4a8fd4]/30 flex flex-col shrink-0">
            {!barraColapsada ? (
              <div className="border-b border-[#1a1a1a] overflow-x-auto relative" style={{ scrollbarWidth: 'none' }}>
                {/* Botón colapsar a la izquierda absoluto */}
                <button onClick={() => setBarraColapsada(true)} title="Ocultar barra interior"
                  className="absolute left-0 top-0 z-10 w-6 h-full flex items-center justify-center text-[11px] font-bold"
                  style={{background:'linear-gradient(90deg, #141414, transparent)', color:'#a0a0a0', border:'none', cursor:'pointer'}}>▼</button>
                <div className="flex items-stretch min-w-max pl-6">
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
                      <div className="flex items-center gap-1 px-2 py-0.5 border-b border-[#1a1a1a]" style={{ background: color+'12' }}>
                        <span style={{ fontSize: 11 }}>{emoji}</span>
                        <span style={{ fontSize: 9, color, fontWeight: 800, textTransform: 'uppercase', letterSpacing: 1, whiteSpace: 'nowrap' }}>{cat}</span>
                      </div>
                      <div className="flex gap-1 px-1 py-1">
                        {items.map(item => {
                          const itemKey = `${cat}-${item.n}`;
                          const justAdded = addedCards.has(itemKey);
                          return (
                            <button key={item.n}
                              onClick={() => {
                                agregarAOrden({ nombre: item.n, precio: item.p, emoji: item.e, categoria: cat });
                                // Feedback visual de confirmación · chulito verde 1.4s
                                setAddedCards((p:any) => { const s = new Set(p); s.add(itemKey); return s; });
                                setTimeout(() => {
                                  setAddedCards((p:any) => { const s = new Set(p); s.delete(itemKey); return s; });
                                }, 1400);
                              }}
                              className="relative flex flex-col items-center gap-0 px-1.5 py-1 rounded-md border bg-[#111] transition-all"
                              style={{
                                minWidth: 48,
                                borderColor: justAdded ? '#22D07A' : '#1a1a1a',
                                background: justAdded ? 'rgba(34,208,122,0.15)' : '#111',
                                boxShadow: justAdded ? `0 0 12px ${color}55` : 'none',
                              }}>
                              {justAdded && (
                                <span style={{
                                  position:'absolute', top:-6, right:-6, width:18, height:18, borderRadius:'50%',
                                  background:'#22D07A', color:'#000', fontSize:11, fontWeight:900,
                                  display:'flex', alignItems:'center', justifyContent:'center',
                                  boxShadow:'0 0 10px #22D07A88',
                                }}>✓</span>
                              )}
                              <span style={{ fontSize: 15 }}>{item.e}</span>
                              <span style={{ fontSize: 8, color: justAdded?'#22D07A':'#888', whiteSpace: 'nowrap', fontWeight: justAdded?700:400 }}>{item.n}</span>
                              <span style={{ fontSize: 8, color, fontWeight: 700 }}>{item.p}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-center px-3" style={{height:32}}>
                <button onClick={() => setBarraColapsada(false)} title="Mostrar quick-add"
                  className="px-4 py-1 rounded-full text-[11px] font-bold flex items-center gap-1.5"
                  style={{background:'#4a8fd4', color:'#fff', border:'none', cursor:'pointer'}}>
                  ▲ Mostrar quick-add
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* RIGHT PANEL — FIJO SIEMPRE VISIBLE */}
      <div className="bg-[#141414] border-l border-[#2a2a2a] flex flex-col shrink-0" style={{ width: 300 }}>
        {/* ── Barra usuario arriba derecha ── */}
        <div className="px-3 py-2.5 border-b border-[#2a2a2a] flex items-center gap-2.5 shrink-0 bg-[#0d0d0d]">
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#d4943a] to-[#b07820] flex items-center justify-center text-[13px] font-black text-black shrink-0">
            {(profile?.nombre_completo || profile?.full_name || 'U').charAt(0).toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-[12px] font-bold text-[#f0f0f0] truncate">{profile?.nombre_completo || profile?.full_name || 'Usuario'}</div>
            <div className="text-[9px] text-[#d4943a] font-bold uppercase">{profile?.role === 'admin' ? 'Admin' : profile?.role === 'gerencia' ? 'Gerencia' : profile?.role === 'desarrollo' ? 'Dev' : 'Mesero'}</div>
          </div>
          {/* ⚡ Brief — resumen IA del día (movido desde el header izquierdo, entre nombre e historial) */}
          <button onClick={() => setIntelOpen(true)}
            title={`Brief del día · ${miNombre}`}
            className="w-[26px] h-[26px] rounded-lg flex items-center justify-center cursor-pointer transition-all"
            style={{ background:'rgba(155,114,255,0.12)', border:'1px solid rgba(155,114,255,0.40)', color:'#9b72ff' }}>
            ⚡
          </button>
          <button onClick={() => { setShowHistorial(true); fetchHistorial(); }}
            className="w-[26px] h-[26px] rounded-lg bg-[#1c1c1c] border border-[#2a2a2a] flex items-center justify-center cursor-pointer hover:bg-[#2a2a2a] transition-all"
            title="Historial de pedidos">
            <Receipt size={11}/>
          </button>
        </div>
        {/* Panel notificaciones */}
        {showNotifPanel && (
          <div style={{position:'absolute',top:50,right:0,width:280,background:'#1c1c1c',border:'1px solid #2a2a2a',borderRadius:12,zIndex:200,maxHeight:320,overflowY:'auto',boxShadow:'0 8px 32px rgba(0,0,0,.4)'}}>
            <div style={{padding:'10px 14px',borderBottom:'1px solid #2a2a2a',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
              <span style={{fontSize:12,fontWeight:700,color:'#f0f0f0'}}>🔔 Notificaciones</span>
              <button onClick={async()=>{
                const idsNotif = notifsVisibles.filter((n:any)=>!n.leida).map((n:any)=>n.id);
                const idsFlow = flowAlertasVisibles.map((a:any)=>a.id);
                if (idsNotif.length) await supabase.from('nexum_notificaciones').update({leida:true}).in('id', idsNotif);
                if (idsFlow.length) await supabase.from('flow_alertas').update({leida:true}).in('id', idsFlow);
                setNotifsBadge(0); setNotifs(p=>p.map(n=>idsNotif.includes(n.id)?{...n,leida:true}:n)); setFlowAlertas((p:any[])=>p.filter((a:any)=>!idsFlow.includes(a.id)));
              }} style={{fontSize:10,color:'#606060',background:'none',border:'none',cursor:'pointer'}}>Marcar leídas</button>
            </div>
            {notifsVisibles.length===0&&<div style={{padding:20,textAlign:'center',color:'#606060',fontSize:12}}>Sin notificaciones</div>}
            {notifsVisibles.map((n:any)=>(
              <div key={n.id} style={{padding:'10px 14px',borderBottom:'1px solid #1a1a1a',background:n.leida?'transparent':'rgba(212,148,58,0.05)'}}>
                <div style={{display:'flex',gap:8,alignItems:'flex-start'}}>
                  <span style={{fontSize:16,flexShrink:0}}>{n.tipo==='stock_86'?'⚠️':n.tipo==='alerta_patio'?'🏠':n.tipo==='maître'?'👔':'🛎️'}</span>
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
          {(['IA', 'Cuenta', 'Chat', 'Intel'] as const).map(tab => {
            const icons:any = { IA: <Sparkles size={14} />, Cuenta: <Receipt size={14} />, Chat: <MessageSquare size={14} />, Intel: <Brain size={14} /> };
            const labels:any = { IA: 'IA', Cuenta: 'Cuenta', Chat: 'Chat', Intel: 'Brief' };
            const activeColors:any = { IA: 'text-[#d4943a] border-b-[#d4943a]', Cuenta: 'text-[#f0f0f0] border-b-[#f0f0f0]', Chat: 'text-[#3dba6f] border-b-[#3dba6f]', Intel: 'text-[#9b72ff] border-b-[#9b72ff]' };
            return (
              <button key={tab} onClick={() => setRightTab(tab)}
                className={`flex-1 py-2.5 text-[11px] font-bold uppercase tracking-widest flex items-center justify-center gap-1.5 transition-all border-b-2 ${rightTab === tab ? `${activeColors[tab]} bg-[#1c1c1c]` : 'text-[#606060] border-b-transparent hover:text-[#a0a0a0] hover:bg-[#1a1a1a]'}`}>
                {icons[tab]} {labels[tab]}
              </button>
            );
          })}
        </div>

        {/* ══ TICKET DEL DÍA — GLOBAL, siempre visible ══ */}
        <div className="border-b border-[#2a2a2a] bg-[#0d0d0d] px-3 py-2 flex items-center gap-2 shrink-0">
          <button onClick={fetchTicketDia} className="text-[9px] text-[#d4943a] font-bold uppercase tracking-wider flex items-center gap-1 hover:opacity-80">📊 Jornada ↻</button>
          <div className="flex gap-3 ml-2 flex-1 overflow-x-auto" style={{scrollbarWidth:'none'}}>
            {[
              {l:'Ventas', v:`$${Math.round((ticketDia?.ventas||0)/1000)}k`, c:'#3dba6f'},
              {l:'Cobros', v:ticketDia?.ordenes||0,                         c:'#4a8fd4'},
              {l:'Abiertas',v:ticketDia?.pendientes||0,                     c:'#f0b45a'},
                            {l:'Propinas',v:`$${Math.round((ticketDia?.propinaTotal||0)/1000)}k`, c:'#9b72ff'},
            ].map(k=>(
              <div key={k.l} className="flex items-center gap-1 shrink-0">
                <span className="text-[9px] text-[#606060]">{k.l}</span>
                <span className="text-[11px] font-black" style={{color:k.c}}>{k.v}</span>
              </div>
            ))}
          </div>
        </div>
        <div className={`flex-1 p-3 px-3.5 flex flex-col gap-2.5 min-h-0 ${rightTab==='Chat' ? 'overflow-hidden' : 'overflow-y-auto'}`} style={{scrollbarWidth:"thin",scrollbarColor:"#2a2a2a transparent"}}>

          {rightTab === 'IA' && (
            <>
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

                {/* Alergias destacadas — crítico */}
                {c.tags.some((t:string) => t.includes('⚠️') || t.includes('🚨') || t.includes('Sin ') || t.includes('Alérgico')) && (
                  <div className="mx-3 mb-2 bg-[#e05050]/10 border border-[#e05050]/30 rounded-lg p-2">
                    <div className="text-[8px] text-[#e05050] font-black uppercase tracking-wider mb-1.5">⚠️ Restricciones alimentarias</div>
                    <div className="flex flex-wrap gap-1">
                      {c.tags.filter((t:string)=>t.includes('⚠️')||t.includes('🚨')||t.includes('Sin ')||t.includes('Alérgico')).map((t:string)=>(
                        <span key={t} className="text-[10px] bg-[#e05050]/15 text-[#e05050] border border-[#e05050]/30 px-2 py-0.5 rounded-full font-bold">{t}</span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Preferencias y tags positivos */}
                <div className="px-3 pb-2 flex flex-wrap gap-1">
                  {c.tags.filter((t:string)=>!t.includes('⚠️')&&!t.includes('🚨')&&!t.includes('Sin ')&&!t.includes('Alérgico')).map((t: string) => (
                    <span key={t} className="text-[10px] px-2 py-0.5 rounded-full font-medium bg-[#2a2a2a] text-[#a0a0a0]">{t}</span>
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

              {/* Separador Sugerencias */}
              <div className="flex items-center gap-2">
                <div className="flex-1 h-px bg-[#2a2a2a]"></div>
                <span className="text-[9px] text-[#d4943a] font-bold uppercase tracking-wider flex items-center gap-1"><Sparkles size={9}/> Hospitality Intelligence</span>
                <div className="flex-1 h-px bg-[#2a2a2a]"></div>
              </div>

              {/* Sugerencias IA — cross-selling: agregar a la orden de la izquierda */}
              <div className="flex flex-col gap-1.5">
                {recsCliente.map((r: any, i: number) => {
                  const anotado = (notasMesero[selectedTable.id] || []).includes(r.txt);
                  const esBebida = r.txt.toLowerCase().includes('vino') || r.txt.toLowerCase().includes('coctel') || r.txt.toLowerCase().includes('sake') || r.txt.toLowerCase().includes('malbec');
                  const esPostre = r.txt.toLowerCase().includes('postre') || r.txt.toLowerCase().includes('volcán') || r.txt.toLowerCase().includes('chocolate');
                  const tagColor = esBebida ? '#4a8fd4' : esPostre ? '#9b72ff' : '#d4943a';
                  const tagLabel = esBebida ? '🍷 Bebida' : esPostre ? '🍮 Postre' : '🍽️ Plato';
                  // Buscar el producto real en la carta para ordenarlo correctamente
                  const buscarPlato = () => {
                    const lower = r.txt.toLowerCase();
                    for (const cat of Object.keys(productos)) {
                      const found = (productos[cat] || []).find((p:any) =>
                        lower.includes(String(p.nombre||'').toLowerCase()) ||
                        String(p.nombre||'').toLowerCase().split(' ').some((w:string) => w.length>3 && lower.includes(w))
                      );
                      if (found) return found;
                    }
                    return null;
                  };
                  const pedirAhora = (e:React.MouseEvent) => {
                    e.stopPropagation();
                    const plato = buscarPlato();
                    if (plato) {
                      agregarAOrden(plato);
                      anotarRecomendacion(r.txt);
                      showToast(`✓ ${plato.nombre} agregado a la orden de M${selectedTable.num}`);
                    } else {
                      // Si no está en la carta, lo anotamos como sugerencia
                      anotarRecomendacion(r.txt);
                      showToast(`💡 Sugerencia anotada: ${r.txt.slice(0,40)}...`);
                    }
                  };
                  return (
                    <div key={i}
                      className={`flex items-start gap-2.5 p-2 px-2.5 rounded-lg border transition-all ${anotado ? 'bg-[#3dba6f]/5 border-[#3dba6f]/25' : 'bg-[#1c1c1c] border-[#2a2a2a]'}`}>
                      <span className="text-[15px] shrink-0 mt-px">{r.icon}</span>
                      <div className="flex-1 min-w-0">
                        <div className={`text-[11px] leading-[1.4] ${anotado ? 'line-through text-[#606060]' : 'text-[#f0f0f0]'}`}>{r.txt}</div>
                        <span style={{color:tagColor}} className="text-[9px] font-bold mt-0.5 inline-block">{tagLabel}</span>
                      </div>
                      {anotado ? (
                        <span className="text-[11px] text-[#3dba6f] shrink-0 mt-px font-black">✓</span>
                      ) : (
                        <button onClick={pedirAhora}
                          className="shrink-0 px-2.5 py-1 rounded-md border text-[9px] font-black uppercase tracking-wider hover:bg-[#3dba6f]/15 active:scale-95 transition-all"
                          style={{borderColor:'#3dba6f80', background:'#3dba6f15', color:'#3dba6f'}}
                          title="Agregar a la orden">
                          + Pedir
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>



            </>
          )}

          {rightTab === 'Cuenta' && (
            <div className="flex flex-col gap-2">
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

              {/* ══ PUNTOS NX (Wallet) ══ */}
              <div className="bg-[#1c1c1c] border border-[#9b72ff]/30 rounded-xl overflow-hidden mb-3">
                <div className="px-3 py-2 border-b border-[#2a2a2a]">
                  <div className="text-[10px] font-bold text-[#9b72ff] uppercase tracking-wider flex items-center gap-1.5">
                    <span>✦ Puntos NX</span>
                    <span className="text-[9px] text-[#606060] normal-case font-normal tracking-normal">10 pts cada $10.000</span>
                  </div>
                </div>
                <div className="px-3 py-3 flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-[#9b72ff]/20 flex items-center justify-center text-[20px]">⭐</div>
                  <div>
                    <div className="text-[18px] font-black text-[#9b72ff]" style={{fontFamily:"'Syne',sans-serif"}}>+{calcularPuntos(mesaSubtotal)} pts NX</div>
                    <div className="text-[10px] text-[#606060]">Mesa {selectedTable.num} · Se suman al wallet</div>
                  </div>
                  <div className="ml-auto text-right">
                    <div className="text-[10px] text-[#606060]">Próximo nivel</div>
                    <div className="text-[11px] font-bold text-[#f0b45a]">{Math.max(0,100-calcularPuntos(mesaSubtotal))} pts</div>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 text-[13px]">
                <div className="w-1.5 h-1.5 rounded-full bg-[#d4943a] shrink-0"></div>
                <span className="text-[#a0a0a0]">Ticket:</span>
                <span className="font-semibold text-[#f0f0f0]">${formatPrecio(mesaSubtotal)}</span>
                <span className="text-[#606060] text-[11px]">/ ${selectedTable.meta} ({Math.min(100,Math.round(mesaSubtotal / (selectedTable.meta||120) * 100))}%)</span>
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
                        <button onClick={() => {
                          const idxOrder = order.indexOf(o);
                          const idxPending = pendingOrder.indexOf(o);
                          if (idxOrder >= 0) removeOrder(idxOrder);
                          else if (idxPending >= 0) setPendingOrder(p => p.filter((_,j) => j !== idxPending));
                        }} className="text-[#606060] hover:text-[#e05050] text-[12px]">✕</button>
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

              <div className="flex flex-col gap-1.5 mt-auto">
                {/* Cobrar Gerencia — ventana propia: PIN → descuentos hasta 100% + bonos */}
                <button onClick={() => abrirGerencia(selectedTableId)}
                  className="w-full py-2.5 rounded-xl text-[12px] font-black transition-all bg-[#d4943a] text-black hover:bg-[#f0b45a] active:bg-[#3dba6f] flex items-center justify-center gap-2">
                  🔐 Cobrar Gerencia
                </button>
                {/* Cobrar Xpress — flujo rápido en 1 paso (requiere PIN si no es gerencia) */}
                <button onClick={() => {
                    if (isGerencia || pinUnlocked) { abrirXpress(selectedTableId); }
                    else { requirePin(() => abrirXpress(selectedTableId)); }
                  }}
                  className="w-full py-2.5 rounded-xl text-[12px] font-black transition-all bg-[#3dba6f] text-black hover:bg-[#4dca7f] active:bg-[#d4943a] flex items-center justify-center gap-2">
                  {isGerencia || pinUnlocked ? '⚡ Cobrar Xpress' : '🔐 Cobrar Xpress'}
                </button>
                {/* Modo Cliente (encuesta completa) — usuario decide entre Xpress o flujo completo */}
                <button onClick={() => {
                    if (isGerencia || pinUnlocked) { abrirModoCliente(selectedTableId); }
                    else { requirePin(() => abrirModoCliente(selectedTableId)); }
                  }}
                  className="w-full py-2 rounded-xl text-[11px] font-bold transition-all bg-transparent border border-[#9b72ff]/40 text-[#b388ff] hover:bg-[#9b72ff]/10 flex items-center justify-center gap-2">
                  ✨ Modo Cliente (con encuesta)
                </button>
                {/* Pasar la cuenta a otra tablet / caja */}
                <button onClick={enviarACaja}
                  className="w-full py-2.5 rounded-xl text-[12px] font-black transition-all bg-[#4a8fd4]/15 border border-[#4a8fd4]/40 text-[#4a8fd4] hover:bg-[#4a8fd4]/25 active:scale-95 flex items-center justify-center gap-2">
                  📤 Enviar a caja (otra tablet)
                </button>
              </div>
              {/* Traspaso de mesa y Cerrar mesa salieron del panel derecho de
                  "Cuenta". El traspaso vive en el panel izquierdo (colapsable
                  bajo el card de la mesa). El cierre de mesa lo hace la cajera
                  desde el Terminal de Pago al procesar el cobro. */}
              <div className="hidden">
              </div>
            </div>
          )}

          {/* Tab Menú eliminado */}

        {rightTab === 'Intel' && (
          <div className="flex flex-col gap-3">

            {/* ══ 86 EN VIVO ══ */}
            <div className="bg-[#1c1c1c] border border-[#e05050]/30 rounded-xl overflow-hidden">
              <div className="px-3 py-2 flex items-center gap-2 border-b border-[#2a2a2a]">
                <span style={{fontSize:11,width:6,height:6,borderRadius:'50%',background:'#e05050',display:'inline-block',animation:'pulse 1s infinite'}}/>
                <span className="text-[10px] font-black text-[#e05050] uppercase tracking-wider">🚫 86 en vivo — No ofrecer</span>
              </div>
              <div className="p-2 flex flex-col gap-1">
                {tips86.length === 0 && (
                  <div style={{fontSize:11,color:'#606060',textAlign:'center',padding:'12px 0'}}>✓ Todo el menú disponible</div>
                )}
                {tips86.slice(0,6).map((t:any,i:number)=>(
                  <div key={i} style={{display:'flex',alignItems:'center',gap:8,padding:'6px 8px',borderRadius:8,background:'rgba(224,80,80,0.06)'}}>
                    <span style={{fontSize:16}}>{t.emoji||'🚫'}</span>
                    <div style={{flex:1,minWidth:0}}>
                      <div style={{fontSize:11,fontWeight:700,color:'#f0f0f0',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{t.nombre||t.name}</div>
                      <div style={{fontSize:9,color:'#e05050',fontWeight:700}}>86 — {t.motivo||'Agotado'}</div>
                    </div>
                    <span style={{fontSize:9,fontWeight:900,color:'#fff',background:'#e05050',padding:'2px 6px',borderRadius:6,flexShrink:0}}>86</span>
                  </div>
                ))}
                {/* Stock bajo */}
                {Object.entries(stockFlow).filter(([,v])=>(v as number)<=4&&(v as number)>0).slice(0,3).map(([name,qty])=>(
                  <div key={name} style={{display:'flex',alignItems:'center',gap:8,padding:'6px 8px',borderRadius:8,background:'rgba(240,180,90,0.06)'}}>
                    <span style={{fontSize:14}}>⚠️</span>
                    <div style={{flex:1}}><div style={{fontSize:11,color:'#f0f0f0'}}>{name}</div><div style={{fontSize:9,color:'#f0b45a'}}>Stock bajo: {qty as number} uds</div></div>
                  </div>
                ))}
              </div>
            </div>

            {/* ══ MENSAJE MOTIVACIONAL ══ */}
            {(() => {
              const hr = new Date().getHours();
              const ventas = ticketDia?.ventas||0;
              const mesas = ticketDia?.pendientes||0;
              const msgs = [
                ventas > 2000000  ? { ico:'🔥', txt:`¡Noche increíble! $${Math.round(ventas/1000)}k en ventas. El equipo lo está dando todo.` } : null,
                mesas >= 8        ? { ico:'🎯', txt:`${mesas} mesas activas. Alta ocupación — coordina con Flow para sincronizar tiempos.` } : null,
                hr >= 20          ? { ico:'🌙', txt:'Servicio nocturno en curso. Cada detalle cuenta para el cierre perfecto.' } : null,
                hr >= 12&&hr<16   ? { ico:'☀️', txt:'Almuerzo activo. Velocidad y precisión — los clientes valoran el tiempo.' } : null,
                tips86.length > 2 ? { ico:'📋', txt:`${tips86.length} items en 86. Guía al equipo para evitar friciones en mesa.` } : null,
                { ico:'✨', txt:`${profile?.full_name?.split(' ')[0]||'Equipo'}, cada mesa es una experiencia única. Hazla memorable.` }
              ].filter(Boolean);
              const msg = msgs[0] || msgs[msgs.length-1];
              return msg ? (
                <div style={{background:'linear-gradient(135deg,rgba(212,148,58,0.08),rgba(155,114,255,0.06))',border:'1px solid rgba(212,148,58,0.2)',borderRadius:12,padding:'12px 14px'}}>
                  <div style={{fontSize:20,marginBottom:6}}>{(msg as any).ico}</div>
                  <div style={{fontSize:12,color:'#f0f0f0',lineHeight:1.5}}>{(msg as any).txt}</div>
                </div>
              ) : null;
            })()}

            {/* ══ BRIEF DEL DÍA · Próximas reservas + Frase inspiradora ══ */}
            <BriefDelDia profile={profile} miNombre={miNombre} restauranteId={restauranteId}/>

            {/* ══ RESUMEN DEL DÍA ══ */}
            <div className="bg-[#1c1c1c] border border-[#9b72ff]/30 rounded-xl overflow-hidden">
              <div className="px-3 py-2 flex items-center gap-2 border-b border-[#2a2a2a]">
                <Brain size={13} className="text-[#9b72ff]"/>
                <span className="text-[10px] font-black text-[#9b72ff] uppercase tracking-wider">Resumen operativo</span>
                <button onClick={fetchTicketDia} style={{marginLeft:'auto',fontSize:9,color:'#606060',background:'none',border:'none',cursor:'pointer'}}>↻</button>
              </div>
              <div className="p-3 grid grid-cols-2 gap-2">
                {[
                  {l:'Ventas',  v:`$${Math.round((ticketDia?.ventas||0)/1000)}k`,     c:'#22d3ee'},
                  {l:'Cobros',  v:ticketDia?.ordenes||0,                              c:'#3dba6f'},
                  {l:'Abiertas',v:ticketDia?.pendientes||0,                           c:'#f0b45a'},
                  {l:'Propinas',v:`$${Math.round((ticketDia?.propinaTotal||0)/1000)}k`,c:'#9b72ff'},
                ].map(k=>(
                  <div key={k.l} style={{background:'#141414',borderRadius:8,padding:'8px 10px'}}>
                    <div style={{fontSize:9,color:'#606060',marginBottom:2,textTransform:'uppercase',letterSpacing:'.06em'}}>{k.l}</div>
                    <div style={{fontFamily:"'Syne',sans-serif",fontSize:18,fontWeight:900,color:k.c}}>{k.v}</div>
                  </div>
                ))}
              </div>
              {/* Mesas activas */}
              {displayTables.filter(t=>t.estado==='ocupada').length > 0 && (
                <div style={{padding:'0 12px 10px'}}>
                  <div style={{fontSize:9,color:'#606060',marginBottom:6,fontWeight:700,textTransform:'uppercase'}}>Mesas activas</div>
                  <div style={{display:'flex',flexWrap:'wrap',gap:4}}>
                    {displayTables.filter(t=>t.estado==='ocupada').map(t=>(
                      <button key={t.id} onClick={()=>{ setSelectedTableId(t.id); setRightTab('Cuenta'); }}
                        style={{background:'rgba(212,148,58,0.1)',border:'1px solid rgba(212,148,58,0.3)',borderRadius:6,padding:'3px 8px',fontSize:10,color:'#f0b45a',fontWeight:700,cursor:'pointer'}}>
                        M{t.num}{t.ticket>0?` · $${Math.round(t.ticket/1000)}k`:''}
                      </button>
                    ))}
                  </div>
                </div>
              )}
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
                  {label:'Editar cuenta activa',  icon:'✏️', action:()=>{ setRightTab('Cuenta'); showToast('Modo edición'); }},
                  {label:'Aplicar descuento',     icon:'🎫', action:()=>requirePin(()=>showToast('✓ Descuento aplicado'))},
                  {label:'Cerrar mesa sin cobro', icon:'🔓', action:()=>requirePin(()=>showToast('✓ Mesa cerrada'))},
                ].map(a=>(
                  <button key={a.label} onClick={a.action}
                    style={{display:'flex',alignItems:'center',gap:8,padding:'8px 10px',background:'rgba(224,80,80,0.05)',border:'1px solid rgba(224,80,80,0.15)',borderRadius:8,cursor:'pointer',width:'100%',textAlign:'left'}}>
                    <span style={{fontSize:14}}>{a.icon}</span>
                    <span style={{fontSize:11,color:'#f0f0f0',fontWeight:600}}>{a.label}</span>
                    <span style={{marginLeft:'auto',fontSize:10,color:'#606060'}}>🔐</span>
                  </button>
                ))}
              </div>
            </div>

          </div>
        )}

          {rightTab === 'Chat' && (
            <div className="flex flex-col h-full min-h-0">
              {/* 86s al inicio del chat — shrink-0 (no scroll, fijo arriba) */}
              {tips86.length > 0 && (
                <div className="bg-[#e05050]/10 border border-[#e05050]/30 rounded-xl overflow-hidden mb-2 shrink-0">
                  <div className="px-3 py-1.5 flex items-center gap-2 border-b border-[#e05050]/20">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#e05050] animate-pulse inline-block"/>
                    <span className="text-[10px] font-black text-[#e05050] uppercase tracking-wider">⚠️ En 86 — Informar al equipo</span>
                  </div>
                  <div className="flex flex-col px-3 py-1.5 gap-1 max-h-[80px] overflow-y-auto">
                    {tips86.slice(0,5).map((t:any,i:number)=>(
                      <div key={i} className="flex items-center gap-2">
                        <span className="text-[13px]">{t.emoji||'🔴'}</span>
                        <span className="flex-1 text-[10px] text-[#f0f0f0] font-semibold">{t.nombre||t.name}</span>
                        <span className="text-[9px] font-black text-[#e05050]">{(t.stock_actual||t.qty||0)<=0?'86':'Bajo'}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              <div className="flex gap-1.5 mb-2 flex-wrap shrink-0">
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
              <div className="flex-1 overflow-y-auto flex flex-col gap-2 mb-2 pr-1 min-h-0">
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
              <div className="flex gap-2 shrink-0">
                <input type="text" value={chatMessage} onChange={e => setChatMessage(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter' && chatMessage.trim()) {
                      const msg = chatMessage.trim();
                      setChatHistory(prev => [...prev, { sender: chatRol, msg, time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) }]);
                      setChatMessage(''); playAlert();
                      supabase.from('nexum_notificaciones').insert({ restaurante_id: restauranteId, tipo:'chat_mensaje', titulo:`💬 ${chatRol}:`, mensaje:msg.length>80?msg.substring(0,80)+'...':msg, prioridad:['fuego','urgente','86'].some(k=>msg.toLowerCase().includes(k))?'alta':'normal', leida:false }).then(()=>{});
                    }
                  }}
                  placeholder={`Mensaje como ${chatRol}...`}
                  className="flex-1 bg-[#1c1c1c] border border-[#2a2a2a] rounded-lg px-3 py-2 text-[12px] text-[#f0f0f0] outline-none focus:border-[#4a8fd4]" />
                <button onClick={() => {
                  if (chatMessage.trim()) {
                    const msg = chatMessage.trim();
                    setChatHistory(prev => [...prev, { sender: chatRol, msg, time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) }]);
                    setChatMessage(''); playAlert();
                    supabase.from('nexum_notificaciones').insert({ restaurante_id: restauranteId, tipo:'chat_mensaje', titulo:`💬 ${chatRol}:`, mensaje:msg.length>80?msg.substring(0,80)+'...':msg, prioridad:['fuego','urgente','86'].some(k=>msg.toLowerCase().includes(k))?'alta':'normal', leida:false }).then(()=>{});
                  }}}
                  className="w-9 h-9 rounded-lg bg-[#4a8fd4] text-white flex items-center justify-center hover:bg-[#3d7fc4] transition-all active:scale-95">
                  <MessageSquare size={14} />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ══ MODAL HISTORIAL DE PEDIDOS ══ */}
      {showHistorial && (
        <div className="fixed inset-0 bg-black/70 z-[300] flex items-center justify-center p-4">
          <div className="bg-[#141414] border border-[#2a2a2a] rounded-2xl w-full max-w-2xl max-h-[85vh] flex flex-col overflow-hidden">
            <div className="p-4 border-b border-[#2a2a2a] flex items-center justify-between">
              <div>
                <div className="font-['Syne'] text-[15px] font-black">📋 Historial de Pedidos</div>
                <div className="text-[10px] text-[#606060] mt-0.5">{historialPedidos.length} cierres registrados</div>
              </div>
              <button onClick={() => setShowHistorial(false)} className="w-8 h-8 rounded-lg bg-[#1c1c1c] border border-[#2a2a2a] flex items-center justify-center text-[#606060] hover:text-white transition-all">✕</button>
            </div>
            <div className="flex-1 overflow-y-auto">
              {historialPedidos.length === 0 && (
                <div className="p-12 text-center text-[#606060]">
                  <div className="text-4xl mb-3">📋</div>
                  <div className="text-[13px]">Sin pedidos cerrados aún</div>
                </div>
              )}
              {historialPedidos.map((f:any) => (
                <div key={f.id} className="p-4 border-b border-[#1a1a1a] hover:bg-[#1c1c1c] transition-all">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-[11px] font-black text-[#d4943a] bg-[#d4943a]/10 px-2 py-0.5 rounded-full">Mesa {f.mesa_num}</span>
                        <span className="text-[10px] text-[#606060]">👤 {f.mesero}</span>
                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${f.metodo_pago==='Efectivo'?'bg-[#3dba6f]/10 text-[#3dba6f]':f.metodo_pago==='Datafono'?'bg-[#4a8fd4]/10 text-[#4a8fd4]':'bg-[#9b72ff]/10 text-[#9b72ff]'}`}>{f.metodo_pago}</span>
                      </div>
                      {/* Items */}
                      <div className="flex flex-wrap gap-1 mb-2">
                        {(f.items||[]).slice(0,4).map((it:any,i:number) => (
                          <span key={i} className="text-[9px] bg-[#1c1c1c] border border-[#2a2a2a] px-2 py-0.5 rounded-full text-[#a0a0a0]">{it.nombre}</span>
                        ))}
                        {(f.items||[]).length > 4 && <span className="text-[9px] text-[#606060]">+{f.items.length-4} más</span>}
                      </div>
                      <div className="flex gap-4 text-[10px] text-[#606060]">
                        <span>Subtotal: <span className="text-[#f0f0f0]">${(f.subtotal||0).toLocaleString('es-CO')}</span></span>
                        {f.descuento > 0 && <span>Desc: <span className="text-[#e05050]">-${(f.descuento||0).toLocaleString('es-CO')}</span></span>}
                        <span>Propina: <span className="text-[#3dba6f]">${(f.propina||0).toLocaleString('es-CO')}</span></span>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="font-['Syne'] text-[16px] font-black text-[#f0f0f0]">${(f.total||0).toLocaleString('es-CO')}</div>
                      <div className="text-[9px] text-[#606060] mt-0.5">{f.hora} · {f.fecha}</div>
                      {f.puntos_generados > 0 && <div className="text-[9px] text-[#9b72ff] mt-0.5">✦ +{f.puntos_generados} pts</div>}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ═══ MAPA DE MESAS ═══ */}
      {showMapaMesas && (
        <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.88)',zIndex:9998,display:'flex',alignItems:'center',justifyContent:'center',padding:16}}>
          <div style={{background:'#141414',border:'1px solid #2a2a2a',borderRadius:20,width:'100%',maxWidth:820,maxHeight:'90vh',display:'flex',flexDirection:'column',overflow:'hidden'}}>
            <div style={{padding:'16px 20px',borderBottom:'1px solid #2a2a2a',display:'flex',alignItems:'center',justifyContent:'space-between',flexShrink:0}}>
              <div>
                <div style={{fontFamily:"'Syne',sans-serif",fontSize:16,fontWeight:900}}>🗺️ Mapa de Mesas</div>
                <div style={{fontSize:10,color:'#606060',marginTop:2}}>{mesasEstado.filter((m:any)=>m.estado==='ocupada').length} ocupadas · {mesasEstado.filter((m:any)=>m.estado==='asignada').length} sentadas · {mesasEstado.filter((m:any)=>!m.estado||m.estado==='libre').length} libres</div>
              </div>
              <div style={{display:'flex',gap:14,alignItems:'center'}}>
                {/* Leyenda compacta — solo 3 estados clave */}
                <div style={{display:'flex',alignItems:'center',gap:5,fontSize:10,color:'#a0a0a0'}}>
                  <span style={{width:7,height:7,borderRadius:'50%',background:'#3dba6f',display:'inline-block'}}/>Disponible
                </div>
                <div style={{display:'flex',alignItems:'center',gap:5,fontSize:10,color:'#a0a0a0'}}>
                  <span style={{width:7,height:7,borderRadius:'50%',background:profile?.color||'#FF2D78',display:'inline-block'}}/>Mía
                </div>
                <div style={{display:'flex',alignItems:'center',gap:5,fontSize:10,color:'#a0a0a0'}}>
                  <span style={{width:7,height:7,borderRadius:'50%',background:'#5a6472',display:'inline-block'}}/>No disponible
                </div>
                <button onClick={()=>setShowMapaMesas(false)} style={{width:28,height:28,borderRadius:8,border:'1px solid #2a2a2a',background:'#1c1c1c',color:'#a0a0a0',cursor:'pointer',fontSize:14}}>✕</button>
              </div>
            </div>
            {/* ── HOME DEL MESERO: mis mesas + libres para tomar ── */}
            {(() => {
              const meseroActual = miNombre;
              const esMiaMesa = (m:any) => m.mesero_nombre===meseroActual || (Array.isArray(m.meseros_compartidos)&&m.meseros_compartidos.includes(meseroActual));
              const misMesas = mesasEstado.filter((m:any)=>(m.estado==='asignada'||m.estado==='ocupada') && (accesoSalon ? true : esMiaMesa(m)));
              const libres   = mesasEstado.filter((m:any)=>m.estado==='asignada' && !m.mesero_nombre);
              if (misMesas.length===0 && libres.length===0) return null;
              const irAMesa = (m:any) => {
                const num = m.name;
                if (m.estado==='ocupada') {
                  const enDisplay = displayTables.find((t:any)=>String(t.num)===String(num));
                  if (enDisplay) { setSelectedTableId(enDisplay.id); setShowMapaMesas(false); }
                } else {
                  const mesaPlano:any = Object.values(PLANTA_OMM).find((p:any)=>String(p.num)===String(num)) || {num:Number(num),cap:m.pax_actual||2};
                  tomarMesaAsignada(mesaPlano, m);
                }
              };
              const Card = ({m,libre}:{m:any,libre:boolean}) => {
                const cli = (clientesPorMesa as any)[Number(m.name)];
                const col = libre ? '#3dba6f' : (m.estado==='ocupada' ? '#d4943a' : '#3dba6f');
                return (
                  <div onClick={()=>irAMesa(m)} style={{minWidth:128,background:`${col}12`,border:`1px solid ${col}55`,borderRadius:12,padding:'9px 11px',cursor:'pointer',flexShrink:0}}>
                    <div style={{display:'flex',alignItems:'center',justifyContent:'space-between'}}>
                      <span style={{fontFamily:"'Syne',sans-serif",fontSize:16,fontWeight:900,color:col}}>M{m.name}</span>
                      <span style={{fontSize:8,fontWeight:800,color:col,textTransform:'uppercase',background:`${col}22`,padding:'1px 6px',borderRadius:8}}>{libre?'Tomar':m.estado==='ocupada'?'Abrir':'Mía'}</span>
                    </div>
                    <div style={{fontSize:11,color:'#f0f0f0',fontWeight:700,marginTop:4,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{m.cliente_nombre||cli?.nombre||'Mesa'}</div>
                    <div style={{fontSize:9,color:'#a0a0a0',marginTop:1}}>👥 {m.pax_actual||cli?.reserva?.pax||2}{cli?.reserva?.hora?` · 🕐 ${cli.reserva.hora}`:''}</div>
                  </div>
                );
              };
              return (
                <div style={{padding:'12px 16px',borderBottom:'1px solid #2a2a2a',flexShrink:0}}>
                  {misMesas.length>0 && (<>
                    <div style={{fontSize:10,color:'#d4943a',fontWeight:800,textTransform:'uppercase',letterSpacing:'.08em',marginBottom:7}}>🪑 {accesoSalon?'Mesas en servicio':'Mis mesas'} ({misMesas.length})</div>
                    <div style={{display:'flex',gap:8,overflowX:'auto',paddingBottom:4,marginBottom:libres.length>0?12:0}}>
                      {misMesas.map((m:any)=><Card key={m.name} m={m} libre={false}/>)}
                    </div>
                  </>)}
                  {libres.length>0 && (<>
                    <div style={{fontSize:10,color:'#3dba6f',fontWeight:800,textTransform:'uppercase',letterSpacing:'.08em',marginBottom:7}}>🟢 Libres para tomar ({libres.length})</div>
                    <div style={{display:'flex',gap:8,overflowX:'auto',paddingBottom:4}}>
                      {libres.map((m:any)=><Card key={m.name} m={m} libre={true}/>)}
                    </div>
                  </>)}
                </div>
              );
            })()}
            {/* ── PLANO SVG · mismo que Reserve/Sala · realtime ── */}
            <PlanoPOSSala
              mesasEstado={mesasEstado}
              restauranteId={restauranteId}
              miNombre={miNombre}
              accesoSalon={accesoSalon}
              profile={profile}
              colorDeMesero={colorDeMesero}
              displayTables={displayTables}
              onLibre={(mesa:any)=>setFormAbrirMesa({mesa:{...mesa,name:String(mesa.name)},pax:mesa.capacidad||4,cliente:'',telefono:'',email:'',vip:!!mesa.vip})}
              onAsignada={(mesa:any,est:any)=>tomarMesaAsignada({num:Number(mesa.name),zona:mesa.zona,shape:mesa.shape,cap:mesa.capacidad,x:mesa.posicion_x,y:mesa.posicion_y,w:0,h:0}, est)}
              onOcupada={(enDisplay:any)=>{ setSelectedTableId(enDisplay.id); setShowMapaMesas(false); }}
              onBloqueada={(est:any)=>setMesaDesbloquear(est)}
              showToast={showToast}
            />
          </div>
        </div>
      )}

      {/* ═══ MODAL ABRIR MESA ═══ */}
      {formAbrirMesa && (
        <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.88)',zIndex:9999,display:'flex',alignItems:'center',justifyContent:'center',padding:16}}>
          <div style={{background:'#1c1c1c',border:'1px solid #2a2a2a',borderRadius:20,width:'100%',maxWidth:380,padding:24,maxHeight:'92vh',overflowY:'auto'}}>
            <div style={{fontFamily:"'Syne',sans-serif",fontSize:18,fontWeight:900,marginBottom:3}}>🪑 Sentar — Mesa {formAbrirMesa.mesa.name}</div>
            <div style={{fontSize:11,color:'#606060',marginBottom:18}}>{formAbrirMesa.mesa.zona||formAbrirMesa.mesa.zone||'Salón'} · máx {formAbrirMesa.mesa.capacidad||formAbrirMesa.mesa.seats}p</div>

            <div style={{fontSize:10,color:'#606060',fontWeight:700,marginBottom:6,textTransform:'uppercase'}}>👥 Número de personas</div>
            <div style={{display:'grid',gridTemplateColumns:'repeat(5,1fr)',gap:6,marginBottom:16}}>
              {[1,2,3,4,5,6,7,8,10,12].map(n=>(
                <button key={n} onClick={()=>setFormAbrirMesa((p:any)=>p?{...p,pax:n}:null)}
                  style={{padding:'9px 4px',borderRadius:8,border:`1px solid ${formAbrirMesa.pax===n?'#d4943a':'#2a2a2a'}`,background:formAbrirMesa.pax===n?'rgba(212,148,58,0.15)':'#141414',color:formAbrirMesa.pax===n?'#d4943a':'#606060',fontSize:13,fontWeight:700,cursor:'pointer'}}>{n}</button>
              ))}
            </div>

            <div style={{fontSize:10,color:'#d4943a',fontWeight:700,marginBottom:6,textTransform:'uppercase'}}>📱 Celular del cliente *</div>
            <input value={formAbrirMesa.telefono}
              onChange={e=>setFormAbrirMesa((p:any)=>p?{...p,telefono:e.target.value}:null)}
              onBlur={async e=>{
                const t = e.target.value.trim();
                if (t.length < 7) { setClienteCRM(null); return; }
                const { data } = await supabase.from('customers').select('id,name,email,vip_status,total_visits,total_spent,score,puntos').eq('phone', t).limit(1).maybeSingle();
                if (data) {
                  setClienteCRM(data);
                  setFormAbrirMesa((p:any) => p ? { ...p, cliente: p.cliente || data.name || '', email: p.email || data.email || '', vip: p.vip || !!data.vip_status } : null);
                } else setClienteCRM(null);
              }}
              placeholder="3001234567" inputMode="tel" autoFocus
              style={{width:'100%',padding:'12px 14px',borderRadius:10,border:`1px solid ${formAbrirMesa.telefono?'#d4943a':'#2a2a2a'}`,background:'rgba(255,255,255,0.05)',color:'#fff',fontSize:14,fontWeight:600,outline:'none',marginBottom:10}}/>

            {clienteCRM && (() => {
              // PDF NEXUM § Roadmap 5/6 — Client Score™ y proxy No-show Score
              const score = Number(clienteCRM.score || 0);
              const visitas = Number(clienteCRM.total_visits || 0);
              const ticket = Number(clienteCRM.total_spent || 0);
              const ticketProm = visitas > 0 ? Math.round(ticket / visitas) : 0;
              const sCol = score >= 70 ? '#00E676' : score >= 40 ? '#FFB547' : '#a0a0a0';
              // No-show Score proxy: si nunca ha venido pero tiene reservas históricas (no implementado a fondo).
              // Para demo: derivamos riesgo según puntos y visitas — pocos puntos + sin visitas = riesgo alto.
              const noShowRisk = visitas === 0 ? 'medio' : (Number(clienteCRM.puntos || 0) < 50 ? 'bajo' : 'muy bajo');
              const nsCol = noShowRisk === 'medio' ? '#FFB547' : '#00E676';
              return (
                <div style={{background:'rgba(0,230,118,0.08)',border:'1px solid rgba(0,230,118,0.3)',borderRadius:10,padding:'10px 14px',marginBottom:12,display:'flex',flexDirection:'column',gap:6}}>
                  <div style={{display:'flex',alignItems:'center',gap:10}}>
                    <span style={{fontSize:20}}>{clienteCRM.vip_status?'⭐':'✓'}</span>
                    <div style={{flex:1,minWidth:0}}>
                      <div style={{fontSize:12,fontWeight:700,color:'#00E676'}}>Cliente conocido{clienteCRM.vip_status?' · VIP':''}</div>
                      <div style={{fontSize:10,color:'#a0a0a0'}}>{clienteCRM.name} · {visitas} visita(s){ticketProm>0?` · ticket prom $${ticketProm.toLocaleString('es-CO')}`:''}</div>
                    </div>
                  </div>
                  <div style={{display:'flex',gap:6,flexWrap:'wrap'}}>
                    <span style={{fontSize:9,background:`${sCol}1f`,color:sCol,border:`1px solid ${sCol}55`,padding:'2px 8px',borderRadius:8,fontWeight:800}} title="Client Score™ del cliente">📊 Score {score}</span>
                    <span style={{fontSize:9,background:`${nsCol}1f`,color:nsCol,border:`1px solid ${nsCol}55`,padding:'2px 8px',borderRadius:8,fontWeight:800}} title="No-show Score (estimado)">👤 No-show: {noShowRisk}</span>
                  </div>
                </div>
              );
            })()}

            <div style={{fontSize:10,color:'#d4943a',fontWeight:700,marginBottom:6,textTransform:'uppercase'}}>Nombre *</div>
            <input value={formAbrirMesa.cliente}
              onChange={e=>setFormAbrirMesa((p:any)=>p?{...p,cliente:e.target.value}:null)}
              placeholder="Nombre del cliente"
              style={{width:'100%',padding:'10px 14px',borderRadius:10,border:'1px solid #2a2a2a',background:'rgba(255,255,255,0.05)',color:'#fff',fontSize:13,outline:'none',marginBottom:10}}/>

            <div style={{fontSize:10,color:'#606060',fontWeight:700,marginBottom:6,textTransform:'uppercase'}}>Email (opcional)</div>
            <input value={formAbrirMesa.email}
              onChange={e=>setFormAbrirMesa((p:any)=>p?{...p,email:e.target.value}:null)}
              placeholder="correo@ejemplo.com" inputMode="email"
              style={{width:'100%',padding:'10px 14px',borderRadius:10,border:'1px solid #2a2a2a',background:'rgba(255,255,255,0.05)',color:'#fff',fontSize:13,outline:'none',marginBottom:12}}/>

            <button onClick={()=>setFormAbrirMesa((p:any)=>p?{...p,vip:!p.vip}:null)}
              style={{width:'100%',padding:'10px 14px',borderRadius:10,marginBottom:16,cursor:'pointer',fontSize:12,fontWeight:700,display:'flex',alignItems:'center',gap:8,
                border:`1px solid ${formAbrirMesa.vip?'#d4943a':'#2a2a2a'}`,
                background:formAbrirMesa.vip?'rgba(212,148,58,0.15)':'#141414',
                color:formAbrirMesa.vip?'#d4943a':'#606060'}}>
              <span style={{fontSize:14}}>{formAbrirMesa.vip?'⭐':'☆'}</span>
              {formAbrirMesa.vip?'Cliente VIP — marcado':'Marcar como cliente VIP'}
            </button>

            <div style={{display:'flex',gap:10}}>
              <button onClick={()=>{ setFormAbrirMesa(null); setClienteCRM(null); }} style={{flex:1,padding:'11px',borderRadius:10,border:'1px solid #2a2a2a',background:'transparent',color:'#606060',cursor:'pointer',fontSize:13}}>Cancelar</button>
              <button onClick={()=>{
                  if (!formAbrirMesa.cliente.trim() || !formAbrirMesa.telefono.trim()) {
                    showToast('⚠️ Nombre y celular son obligatorios'); return;
                  }
                  abrirMesaDB(formAbrirMesa.mesa,formAbrirMesa.pax,formAbrirMesa.cliente,{telefono:formAbrirMesa.telefono,email:formAbrirMesa.email,vip:formAbrirMesa.vip});
                  setClienteCRM(null);
                }}
                style={{flex:2,padding:'11px',borderRadius:10,border:'none',background:'linear-gradient(135deg,#d4943a,#b07820)',color:'#000',fontWeight:700,cursor:'pointer',fontSize:13}}>
                ✓ Sentar en Mesa {formAbrirMesa.mesa.name}
              </button>
            </div>
            {isGerencia && (
              <button onClick={async()=>{
                  const mn = String(formAbrirMesa.mesa.name);
                  try { await supabase.from('tables').update({estado:'bloqueada',status:'blocked'}).eq('name',mn); } catch(e){ console.error('bloquear mesa:',e); }
                  showToast(`🔒 Mesa ${mn} bloqueada`);
                  setFormAbrirMesa(null); setClienteCRM(null);
                }}
                style={{width:'100%',marginTop:10,padding:'9px',borderRadius:10,border:'1px solid #e05050',background:'transparent',color:'#e05050',cursor:'pointer',fontSize:12,fontWeight:700}}>
                🔒 Bloquear esta mesa (gerencia)
              </button>
            )}
          </div>
        </div>
      )}

      {/* ═══ MODAL DESBLOQUEO PIN GERENTE ═══ */}
      {mesaDesbloquear && (
        <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.88)',zIndex:9999,display:'flex',alignItems:'center',justifyContent:'center',padding:16}}>
          <div style={{background:'#1c1c1c',border:'1px solid #e05050',borderRadius:20,width:'100%',maxWidth:320,padding:24}}>
            <div style={{fontFamily:"'Syne',sans-serif",fontSize:18,fontWeight:900,color:'#e05050',marginBottom:4}}>🔒 Mesa {mesaDesbloquear.name}</div>
            <div style={{fontSize:11,color:'#606060',marginBottom:20}}>Ingresa el PIN de gerencia para desbloquear.</div>
            <div style={{textAlign:'center',letterSpacing:10,fontSize:24,color:'#d4943a',marginBottom:16}}>
              {'●'.repeat(pinDesbloqueo.length)}{'○'.repeat(4-pinDesbloqueo.length)}
            </div>
            <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:8,marginBottom:14}}>
              {[1,2,3,4,5,6,7,8,9,'⌫',0,'✓'].map((k:any,i:number)=>(
                <button key={i} onClick={()=>{
                    if (k==='⌫') { setPinDesbloqueo((p:string)=>p.slice(0,-1)); return; }
                    if (k==='✓') {
                      if (pinDesbloqueo==='1234') {
                        supabase.from('tables').update({estado:'libre',mesero_nombre:null,abierta_en:null,pax_actual:0}).eq('id',mesaDesbloquear.id);
                        setFormAbrirMesa({mesa:mesaDesbloquear,pax:2,cliente:'',telefono:'',email:'',vip:false});
                        setMesaDesbloquear(null); setPinDesbloqueo('');
                      } else { showToast('⚠️ PIN incorrecto'); setPinDesbloqueo(''); }
                      return;
                    }
                    if (pinDesbloqueo.length<4) setPinDesbloqueo((p:string)=>p+k);
                  }}
                  style={{padding:'13px',borderRadius:10,border:'1px solid #2a2a2a',background:k==='✓'?'#3dba6f':k==='⌫'?'#1c1c1c':'#141414',color:k==='✓'?'#000':'#f0f0f0',fontSize:16,fontWeight:700,cursor:'pointer'}}>
                  {k}
                </button>
              ))}
            </div>
            <button onClick={()=>{setMesaDesbloquear(null);setPinDesbloqueo('');}} style={{width:'100%',padding:'10px',borderRadius:10,border:'1px solid #2a2a2a',background:'transparent',color:'#606060',cursor:'pointer',fontSize:13}}>Cancelar</button>
          </div>
        </div>
      )}

    </div>
  );
};

export default ServiceOSModule;

// ═════════════════════════════════════════════════════════════════════
// BRIEF DEL DÍA · Próximas reservas + clientes que vienen + inspiración
// Lee reservations + ohyeah_reservas en tiempo real para el restaurante.
// ═════════════════════════════════════════════════════════════════════
function BriefDelDia({ profile, miNombre, restauranteId }:{ profile:any; miNombre:string; restauranteId:number }) {
  const [proximas, setProximas] = React.useState<any[]>([]);
  const [vipsHoy, setVipsHoy] = React.useState<any[]>([]);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    const hoy = new Date().toISOString().split('T')[0];
    const load = async () => {
      const [rv, oy] = await Promise.all([
        supabase.from('reservations').select('id,cliente_nombre,hora,pax,ocasion,gourmand_level,mesa_num,estado,notas')
          .eq('fecha', hoy).eq('restaurante_id', restauranteId)
          .in('estado',['confirmada','pendiente']).order('hora'),
        supabase.from('ohyeah_reservas').select('id,guest_name,time,pax,occasion,gourmand_level,mesa_num,status,observations')
          .eq('date', hoy).in('status',['confirmed','confirmada','pending','pendiente']).order('time'),
      ]);
      const ahoraMin = new Date().getHours()*60 + new Date().getMinutes();
      const map = (r:any, esOh:boolean) => ({
        id: r.id,
        nombre: esOh ? r.guest_name : r.cliente_nombre,
        hora: (esOh ? r.time : r.hora || '').slice(0,5),
        pax: r.pax,
        ocasion: esOh ? r.occasion : r.ocasion,
        nivel: r.gourmand_level,
        mesa: r.mesa_num,
        notas: esOh ? r.observations : r.notas,
        esOh,
      });
      const todas = [
        ...(rv.data||[]).map((r:any)=>map(r,false)),
        ...(oy.data||[]).map((r:any)=>map(r,true)),
      ].filter((r:any) => {
        const [h,m] = (r.hora||'00:00').split(':').map(Number);
        return (h*60+m) >= ahoraMin - 15; // próximas + cualquiera de hace <15min
      }).sort((a:any,b:any)=>(a.hora||'').localeCompare(b.hora||''));
      const VIP_TIERS = ['VIP','CONSAGRADO','ÉLITE','ELITE','GRAND GOURMAND','LA CREME'];
      setProximas(todas.slice(0, 5));
      setVipsHoy(todas.filter((r:any)=> VIP_TIERS.includes(String(r.nivel||'').toUpperCase())).slice(0,3));
      setLoading(false);
    };
    load();
    const ch = supabase.channel('brief-del-dia')
      .on('postgres_changes',{event:'*',schema:'public',table:'reservations'}, load)
      .on('postgres_changes',{event:'*',schema:'public',table:'ohyeah_reservas'}, load)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [restauranteId]);

  // Frase inspiradora (rotativa según día del año + hora)
  const FRASES = [
    'El servicio impecable nace de los detalles invisibles. Hoy somos esos detalles.',
    'Cada cliente que entra es una historia. Nuestra cocina es donde la contamos.',
    'La excelencia no es un acto, es un hábito. Hoy lo cultivamos juntos.',
    'El cliente recordará no solo lo que comió, sino cómo lo hicimos sentir.',
    'Cuidamos los segundos: el tiempo perfecto convierte una comida en experiencia.',
    'Equipo unido, servicio fluido. Hoy nadie está solo en su estación.',
    'Cada plato sale como si fuera el último. Cada mesa atendida como si fuera la primera.',
    'No vendemos comida, creamos memorias. Hoy creamos memorables.',
  ];
  const nombre = (profile?.full_name || profile?.nombre_completo || miNombre || '').split(' ')[0] || 'Equipo';
  const idx = ((new Date()).getDate() + (new Date()).getHours()) % FRASES.length;
  const frase = FRASES[idx];

  return (
    <div style={{background:'linear-gradient(135deg,rgba(155,114,255,0.10),rgba(212,148,58,0.06))',border:'1px solid rgba(155,114,255,0.3)',borderRadius:12,overflow:'hidden'}}>
      <div style={{padding:'10px 14px',display:'flex',alignItems:'center',gap:8,borderBottom:'1px solid rgba(155,114,255,0.15)'}}>
        <Brain size={14} style={{color:'#9b72ff'}}/>
        <span style={{fontSize:10,fontWeight:900,color:'#9b72ff',letterSpacing:'.16em',textTransform:'uppercase'}}>Brief del día</span>
        <span style={{marginLeft:'auto',fontSize:9,color:'#606060'}}>Live · IA</span>
      </div>
      <div style={{padding:'12px 14px',display:'flex',flexDirection:'column',gap:10}}>
        {loading && <div style={{fontSize:11,color:'#606060',textAlign:'center'}}>Cargando reservas…</div>}

        {/* PRÓXIMAS RESERVAS */}
        {!loading && (
          <div>
            <div style={{fontSize:9,fontWeight:800,color:'#d4943a',textTransform:'uppercase',letterSpacing:'.12em',marginBottom:6}}>
              ⏭ Próximas reservas {proximas.length>0 && `(${proximas.length})`}
            </div>
            {proximas.length === 0 ? (
              <div style={{fontSize:11,color:'#606060',padding:'6px 0'}}>Sin reservas próximas.</div>
            ) : (
              <div style={{display:'flex',flexDirection:'column',gap:5}}>
                {proximas.map((r:any) => (
                  <div key={`${r.esOh?'oy':'rv'}-${r.id}`} style={{display:'flex',alignItems:'center',gap:8,padding:'7px 9px',background:'rgba(0,0,0,0.25)',borderRadius:8,borderLeft:`3px solid ${r.esOh?'#FFE600':'#d4943a'}`}}>
                    <span style={{fontFamily:"'Syne',sans-serif",fontSize:14,fontWeight:900,color:r.esOh?'#FFE600':'#d4943a',minWidth:42}}>{r.hora}</span>
                    <div style={{flex:1,minWidth:0}}>
                      <div style={{fontSize:11,fontWeight:700,color:'#f0f0f0',display:'flex',alignItems:'center',gap:4,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>
                        {r.nombre}{r.esOh && <span style={{fontSize:9}}>🦉</span>}
                        {r.nivel && ['VIP','CONSAGRADO','ÉLITE','ELITE','GRAND GOURMAND','LA CREME'].includes(String(r.nivel).toUpperCase()) && <span style={{fontSize:9}}>⭐</span>}
                      </div>
                      <div style={{fontSize:9,color:'#a0a0a0'}}>{r.pax}p{r.mesa?` · M${r.mesa}`:''}{r.ocasion && r.ocasion!=='Sin ocasión especial'?` · 🎉 ${r.ocasion}`:''}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* VIPs */}
        {vipsHoy.length > 0 && (
          <div style={{paddingTop:8,borderTop:'1px solid rgba(155,114,255,0.15)'}}>
            <div style={{fontSize:9,fontWeight:800,color:'#FFD700',textTransform:'uppercase',letterSpacing:'.12em',marginBottom:5}}>⭐ VIPs hoy</div>
            <div style={{fontSize:11,color:'#f0f0f0',lineHeight:1.5}}>
              {vipsHoy.map((v:any) => v.nombre).join(' · ')}
            </div>
          </div>
        )}

        {/* INSPIRACIÓN */}
        <div style={{paddingTop:10,borderTop:'1px solid rgba(155,114,255,0.15)'}}>
          <div style={{fontSize:9,fontWeight:800,color:'#9b72ff',textTransform:'uppercase',letterSpacing:'.12em',marginBottom:5}}>✨ Para {nombre}</div>
          <div style={{fontSize:11,color:'#f0f0f0',lineHeight:1.6,fontStyle:'italic'}}>"{frase}"</div>
        </div>
      </div>
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════
// PLANO POS · SALA — mismo SVG que Reserve/Sala, con la lógica POS
// Realtime: lee `mesasEstado` (que se refresca por subscription a tables).
// Color por mesero, libre/asignada/ocupada/bloqueada, click contextual.
// ═════════════════════════════════════════════════════════════════════
function PlanoPOSSala({ mesasEstado, restauranteId, miNombre, accesoSalon, profile, colorDeMesero, displayTables, onLibre, onAsignada, onOcupada, onBloqueada, showToast }:any) {
  const conf = ZONAS_POR_RESTAURANTE[restauranteId];
  const zonas = conf?.zonas || {};
  const orden = conf?.orden || [];

  // Paleta neon suave (igual que Sala) — pero el borde toma el color del mesero
  const NEON = {
    bgOuter:'#0e0e18', bgInner:'#13131f',
    grid:'rgba(120,120,180,0.05)',
    libreFill:'#162621', libreStroke:'#3DBE8B', libreText:'#D8F4E5',
    reservadaFill:'#241B10', reservadaText:'#F4E2C5',
    ocupadaFill:'#241218', ocupadaText:'#F4D0DC',
    bloqueadaFill:'#1d1d28', bloqueadaStroke:'#5C6470', bloqueadaText:'#9CA3AF',
    vip:'#D4AF3D',
  };

  const visibles = (mesasEstado||[]).filter((m:any)=>m.activa!==false && m.posicion_x!=null && m.posicion_y!=null);

  return (
    <div style={{flex:1,overflow:'auto',padding:16,background:NEON.bgOuter}}>
      <svg viewBox={`0 0 ${VW_PLANO} ${VH_PLANO}`} width="100%"
        style={{display:'block',background:`radial-gradient(circle at 50% 30%, #1a1a2a 0%, ${NEON.bgInner} 70%)`,borderRadius:14,boxShadow:'inset 0 0 60px rgba(0,0,0,0.6)'}}>
        <defs>
          <pattern id="posGrid" width="40" height="40" patternUnits="userSpaceOnUse">
            <path d="M 40 0 L 0 0 0 40" fill="none" stroke={NEON.grid} strokeWidth="1"/>
          </pattern>
        </defs>
        <rect x={0} y={0} width={VW_PLANO} height={VH_PLANO} fill="url(#posGrid)"/>

        {/* Zonas */}
        {orden.map(z => {
          const zona = zonas[z]; if (!zona) return null;
          return (
            <g key={z}>
              <rect x={zona.area.x} y={zona.area.y} width={zona.area.w} height={zona.area.h}
                rx={14} fill={zona.chipBg} fillOpacity={0.04}
                stroke={zona.chipBg} strokeWidth={1.2} strokeDasharray="8 6" strokeOpacity={0.4}/>
              <g transform={`translate(${zona.area.x+12}, ${zona.area.y+12})`}>
                <rect width={zona.label.length*8.4+20} height={24} rx={4} fill="none" stroke={zona.chipBg} strokeWidth={1.2} strokeOpacity={0.7}/>
                <text x={10} y={16} fill={zona.chipBg} fontSize={11} fontWeight={800}
                  fontFamily="'IBM Plex Mono', monospace" letterSpacing="0.18em" opacity={0.85}>
                  {zona.label}
                </text>
              </g>
            </g>
          );
        })}

        {/* Mesas */}
        {visibles.map((m:any) => {
          const estado = m.estado || 'libre';
          const libre = estado==='libre';
          const asignada = estado==='asignada';
          const ocupada = estado==='ocupada';
          const bloqueada = estado==='bloqueada';
          const compartida = Array.isArray(m.meseros_compartidos) && m.meseros_compartidos.includes(miNombre);
          const meseroDeMesa = m.mesero_nombre || '';
          const asignadaMia = asignada && (meseroDeMesa===miNombre || compartida);
          const asignadaPool = asignada && !meseroDeMesa;
          const asignadaDeOtro = asignada && !!meseroDeMesa && meseroDeMesa!==miNombre && !compartida;
          const esMia = (ocupada || asignada) && (!meseroDeMesa || meseroDeMesa===miNombre || compartida);
          const puedeEntrar = esMia || accesoSalon;
          const colorMesero = colorDeMesero(meseroDeMesa || (asignadaMia ? miNombre : ''));
          // COLORES POS:
          // · Admin/Gerencia: TODAS las mesas en su color (fucsia) — ven todo como suyo
          // · Mesero: mi color en las mías · verde en pool · gris en las ajenas
          const esAdmin = ['admin','gerencia','desarrollo'].includes(String(profile?.role||'').toLowerCase());
          const GRIS_NO_PUEDO = '#5a6472';
          const miColor = sanearHex(profile?.color);
          const stroke = bloqueada ? NEON.bloqueadaStroke
            : esAdmin && (asignada || ocupada) ? miColor                     // ADMIN: todo en fucsia
            : asignadaMia ? miColor
            : asignadaPool ? '#3DBE8B'                                       // verde · libre para tomar
            : asignadaDeOtro ? (accesoSalon ? colorMesero : GRIS_NO_PUEDO)
            : ocupada ? (puedeEntrar ? colorMesero : GRIS_NO_PUEDO)
            : NEON.libreStroke;
          const fill = bloqueada ? NEON.bloqueadaFill
            : ocupada ? NEON.ocupadaFill
            : asignada ? NEON.reservadaFill
            : NEON.libreFill;
          const text = bloqueada ? NEON.bloqueadaText
            : ocupada ? NEON.ocupadaText
            : asignada ? NEON.reservadaText
            : NEON.libreText;
          const { w, h } = sizeForMesa({ zona:m.zona||'', capacidad:m.capacidad||m.seats||4, name:m.name });
          const isRound = (m.shape||'round')==='round' || (m.zona||'').startsWith('Barra');
          const cx = m.posicion_x, cy = m.posicion_y;
          const enDisplay = (displayTables||[]).find((t:any)=>String(t.num)===String(m.name));

          const click = () => {
            if (bloqueada) onBloqueada(m);
            else if (asignada) {
              if (asignadaDeOtro && !accesoSalon) { showToast(`🔒 Mesa ${m.name} asignada a ${meseroDeMesa}`); return; }
              onAsignada(m, m);
            }
            else if (libre) onLibre(m);
            else if (ocupada && enDisplay) {
              if (!puedeEntrar) { showToast(`🔒 Mesa ${m.name} la atiende ${meseroDeMesa} — pídele compartir`); return; }
              onOcupada(enDisplay);
            }
          };

          return (
            <g key={m.id} style={{cursor:'pointer'}} onClick={click}>
              {isRound
                ? <circle cx={cx} cy={cy} r={w/2} fill={fill} stroke={m.vip?NEON.vip:stroke} strokeWidth={m.vip?2.5:1.8}/>
                : <rect x={cx-w/2} y={cy-h/2} width={w} height={h} rx={8} fill={fill} stroke={m.vip?NEON.vip:stroke} strokeWidth={m.vip?2.5:1.8}/>}

              {/* Indicador VIP */}
              {m.vip && (
                <>
                  <circle cx={cx-w/2+9} cy={cy-h/2+9} r={10} fill={NEON.bgInner} stroke={NEON.vip} strokeWidth={1.5}/>
                  <text x={cx-w/2+9} y={cy-h/2+13} textAnchor="middle" fontSize={12} fontWeight={800} fill={NEON.vip}>★</text>
                </>
              )}

              {/* Iniciales del mesero (esquina sup-der) cuando ocupada/asignada */}
              {!libre && meseroDeMesa && (
                <>
                  <circle cx={cx+w/2-9} cy={cy-h/2+9} r={10} fill="#1a1a2e" stroke={stroke} strokeWidth={1.4}/>
                  <text x={cx+w/2-9} y={cy-h/2+13} textAnchor="middle" fontSize={9} fontWeight={800} fill="#fff">
                    {meseroDeMesa.split(' ').slice(0,2).map((s:string)=>s[0]).join('').toUpperCase()}
                  </text>
                </>
              )}

              {/* Punto verde si la mesa está asignada esperando ser tomada */}
              {asignadaPool && (
                <circle cx={cx+w/2-6} cy={cy+h/2-6} r={5} fill="#3DBE8B">
                  <animate attributeName="opacity" values="0.4;1;0.4" dur="1.4s" repeatCount="indefinite"/>
                </circle>
              )}

              <text x={cx} y={cy-2} fill={text} fontSize={14} fontWeight={900} textAnchor="middle"
                fontFamily="'Syne', serif" pointerEvents="none">M{m.name}</text>
              <text x={cx} y={cy+12} fill={text} fontSize={9} fontWeight={700} textAnchor="middle" opacity={0.9}
                fontFamily="'IBM Plex Mono', monospace" pointerEvents="none">
                {(asignada||ocupada) && m.cliente_nombre
                  ? String(m.cliente_nombre).split(' ')[0].slice(0,9).toUpperCase()
                  : `${m.capacidad||m.seats||4}P`}
              </text>
            </g>
          );
        })}

        {visibles.length===0 && (
          <text x={VW_PLANO/2} y={VH_PLANO/2} textAnchor="middle" fill="#666" fontSize={16}
            fontFamily="'IBM Plex Mono', monospace" letterSpacing="0.2em">
            SIN PLANO CARGADO · CONFIGURAR DESDE RESERVE → EDITOR DE PLANTA
          </text>
        )}
      </svg>
    </div>
  );
}
