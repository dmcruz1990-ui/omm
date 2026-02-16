
import React, { useState, useMemo, useEffect } from 'react';
import { 
  Search, 
  ShoppingCart, 
  ChevronLeft, 
  Box, 
  Plus, 
  Minus, 
  Trash2, 
  CheckCircle,
  Filter,
  X,
  PackageCheck,
  Zap,
  ArrowLeft,
  Truck,
  Building2,
  Brain,
  AlertTriangle,
  TrendingDown,
  DollarSign,
  ChevronRight,
  Sparkles,
  Calendar,
  Layers,
  Store,
  Clock,
  ShieldCheck,
  BadgePercent
} from 'lucide-react';
import { SupplyItem, PYGCategory } from '../types.ts';

interface MarketplaceProps {
  items: SupplyItem[];
  onBack: () => void;
}

interface VendorOffer {
  vendorId: string;
  vendorName: string;
  price: number;
  deliveryDays: number;
  availableStock: number;
}

interface SmartSupplyItem extends SupplyItem {
  offers: VendorOffer[];
  bestPrice?: number;
  isExpiringSoon?: boolean;
}

interface CartItem extends SmartSupplyItem {
  cartQuantity: number;
  selectedVendor: VendorOffer;
}

const SupplyMarketplace: React.FC<MarketplaceProps> = ({ items, onBack }) => {
  const [mode, setMode] = useState<'internal' | 'external'>('external');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [orderComplete, setOrderComplete] = useState(false);
  const [selectedVendorMap, setSelectedVendorMap] = useState<Record<string, string>>({});

  const categories: PYGCategory[] = [
    'Costo de alimentos',
    'Costo de bebidas',
    'Empaques y desechables',
    'Comisiones y plataformas',
    'Aseo, mantenimiento y operación'
  ];

  const enrichedItems: SmartSupplyItem[] = useMemo(() => {
    return items.map(item => {
      // Mock de proveedores dinámico por ítem
      const offers: VendorOffer[] = [
        { vendorId: 'v1', vendorName: 'Distribuidora Seratta', price: item.costPerUnit * 0.92, deliveryDays: 1, availableStock: 450 },
        { vendorId: 'v2', vendorName: 'Macro Proveedores', price: item.costPerUnit, deliveryDays: 2, availableStock: 1200 },
        { vendorId: 'v3', vendorName: 'Disto Express', price: item.costPerUnit * 1.05, deliveryDays: 0, availableStock: 25 },
      ];

      return {
        ...item,
        offers,
        bestPrice: Math.min(...offers.map(o => o.price)),
        isExpiringSoon: item.status === 'low'
      };
    });
  }, [items]);

  // Inicializar mapa de selección al proveedor más barato
  useEffect(() => {
    const initialMap: Record<string, string> = {};
    enrichedItems.forEach(item => {
      const cheapest = item.offers.reduce((prev, curr) => prev.price < curr.price ? prev : curr);
      initialMap[item.id] = cheapest.vendorId;
    });
    setSelectedVendorMap(initialMap);
  }, [enrichedItems]);

  const filteredItems = useMemo(() => {
    return enrichedItems.filter(item => {
      const matchesSearch = item.name.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesCategory = selectedCategory ? (item.pyg_category === selectedCategory || item.category === selectedCategory) : true;
      return matchesSearch && matchesCategory;
    });
  }, [enrichedItems, searchTerm, selectedCategory]);

  const addToCart = (item: SmartSupplyItem) => {
    const vendorId = selectedVendorMap[item.id];
    const vendor = item.offers.find(o => o.vendorId === vendorId) || item.offers[0];
    
    setCart(prev => {
      const cartId = `${item.id}-${vendor.vendorId}`;
      const existing = prev.find(i => `${i.id}-${i.selectedVendor.vendorId}` === cartId);
      
      if (existing) {
        return prev.map(i => `${i.id}-${i.selectedVendor.vendorId}` === cartId 
          ? { ...i, cartQuantity: i.cartQuantity + 1 } 
          : i
        );
      }
      return [...prev, { ...item, cartQuantity: 1, selectedVendor: vendor }];
    });
  };

  const removeFromCart = (cartId: string) => {
    setCart(prev => prev.filter(i => `${i.id}-${i.selectedVendor.vendorId}` !== cartId));
  };

  const cartTotalAmount = cart.reduce((sum, item) => sum + (item.selectedVendor.price * item.cartQuantity), 0);

  if (orderComplete) {
    return (
      <div className="fixed inset-0 z-[500] bg-white flex flex-col items-center justify-center p-6 text-black animate-in fade-in zoom-in duration-500">
        <div className="w-24 h-24 bg-green-500 rounded-full flex items-center justify-center mb-8 shadow-2xl">
          <CheckCircle size={48} className="text-white" />
        </div>
        <h2 className="text-4xl font-black uppercase italic tracking-tighter mb-4">Sincronización Exitosa</h2>
        <p className="text-gray-500 text-lg font-medium text-center max-w-md italic">
          Las órdenes de compra han sido enviadas. Se ha generado el CUFE temporal para conciliación.
        </p>
        <button onClick={onBack} className="mt-12 bg-black text-white px-12 py-5 rounded-full font-black text-[10px] uppercase tracking-[0.3em] shadow-xl hover:scale-105 transition-all">
          VOLVER AL DASHBOARD
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f3f4f6] text-black font-sans flex flex-col animate-in fade-in duration-500 text-left">
      
      {/* Header Estilo B2B Marketplace */}
      <header className="bg-[#0a0a0c] text-white py-4 px-6 md:px-12 flex items-center justify-between gap-8 sticky top-0 z-[100] shadow-2xl">
        <div className="flex items-center gap-6">
          <button onClick={onBack} className="hover:text-blue-400 transition-colors flex items-center gap-2 text-[9px] font-black uppercase tracking-widest">
            <ArrowLeft size={16} /> SALIR
          </button>
          <div className="w-[1px] h-6 bg-white/10"></div>
          <h1 className="text-2xl font-black italic tracking-tighter leading-none">NEXUM <span className="text-blue-500 uppercase text-[10px] align-top ml-1">E-COMPRA</span></h1>
        </div>

        <div className="flex-1 max-w-2xl relative">
           <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500" />
           <input 
             type="text" 
             placeholder="Busca insumos, marcas o proveedores..." 
             value={searchTerm}
             onChange={(e) => setSearchTerm(e.target.value)}
             className="w-full bg-white/5 border border-white/10 rounded-full py-3.5 pl-12 pr-6 text-white text-sm outline-none focus:bg-white/10 focus:border-blue-500/50 transition-all placeholder:text-gray-600"
           />
        </div>

        <button onClick={() => setIsCartOpen(true)} className="flex items-center gap-4 bg-blue-600 hover:bg-blue-500 px-6 py-3 rounded-2xl shadow-xl shadow-blue-900/20 transition-all active:scale-95 group">
          <div className="relative">
            <ShoppingCart size={22} className="group-hover:rotate-12 transition-transform" />
            {cart.length > 0 && (
              <span className="absolute -top-3 -right-3 bg-white text-blue-600 text-[9px] font-black w-5 h-5 flex items-center justify-center rounded-full border-2 border-blue-600 animate-in zoom-in">
                {cart.length}
              </span>
            )}
          </div>
          <div className="hidden md:flex flex-col items-start leading-none">
            <span className="text-[10px] font-black uppercase text-blue-100/60">Checkout</span>
            <span className="text-sm font-black italic">$ {cartTotalAmount.toLocaleString()}</span>
          </div>
        </button>
      </header>

      {/* Selector de Modo */}
      <div className="bg-white border-b border-gray-200 px-12 py-3 flex items-center justify-between shadow-sm relative z-50">
         <div className="flex bg-gray-100 p-1.5 rounded-[1.2rem] border border-gray-200">
            <button 
              onClick={() => setMode('internal')}
              className={`px-8 py-2.5 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all flex items-center gap-3 ${mode === 'internal' ? 'bg-white text-blue-600 shadow-xl' : 'text-gray-500 hover:text-gray-700'}`}
            >
              <Building2 size={14} /> Bodega Central (OMM)
            </button>
            <button 
              onClick={() => setMode('external')}
              className={`px-8 py-2.5 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all flex items-center gap-3 ${mode === 'external' ? 'bg-white text-blue-600 shadow-xl' : 'text-gray-500 hover:text-gray-700'}`}
            >
              <Truck size={14} /> Red de Proveedores
            </button>
         </div>
         <div className="hidden lg:flex items-center gap-6">
            <div className="flex items-center gap-2 text-green-600">
               <ShieldCheck size={14} />
               <span className="text-[9px] font-black uppercase">DIAN Gateway Active</span>
            </div>
            <div className="flex items-center gap-2 text-blue-600">
               <BadgePercent size={14} />
               <span className="text-[9px] font-black uppercase">Corporate Discounts Applied</span>
            </div>
         </div>
      </div>

      <div className="flex-1 flex flex-col md:flex-row gap-10 p-6 md:p-12 overflow-hidden">
        
        {/* Sidebar IA & Filtros */}
        <aside className="w-full md:w-80 shrink-0 space-y-8 overflow-y-auto no-scrollbar pb-20">
           <div className="bg-[#0a0a0c] text-white p-8 rounded-[3rem] shadow-2xl relative overflow-hidden group">
              <div className="absolute top-0 right-0 p-6 opacity-10 group-hover:scale-110 transition-transform duration-700"><Sparkles size={80} fill="white" /></div>
              <div className="relative z-10 space-y-6">
                 <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-blue-600 rounded-xl flex items-center justify-center text-white">
                       <Brain size={18} />
                    </div>
                    <h4 className="text-[10px] font-black uppercase tracking-widest text-blue-400">Nexum AI Suggest</h4>
                 </div>
                 <p className="text-xs font-bold italic leading-relaxed text-gray-300">
                   "He detectado que el <strong>Salmón Noruego</strong> subirá un 8% el lunes. Sugiero comprar stock para 15 días hoy."
                 </p>
                 <button className="w-full bg-blue-600 hover:bg-blue-500 py-4 rounded-2xl font-black italic text-[9px] uppercase tracking-[0.2em] shadow-xl transition-all">
                    AUTO-POBLAR CARRITO
                 </button>
              </div>
           </div>

           <div>
              <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-gray-400 mb-6 px-4 italic">Clasificación P&L</h3>
              <div className="space-y-1">
                 <button onClick={() => setSelectedCategory(null)} className={`w-full text-left px-6 py-3.5 rounded-2xl text-[11px] font-black uppercase transition-all flex items-center justify-between group ${!selectedCategory ? 'bg-white shadow-xl text-blue-600' : 'text-gray-500 hover:bg-white/50'}`}>
                   <span>Todos</span>
                   <ChevronRight size={14} className={`${!selectedCategory ? 'opacity-100' : 'opacity-0'} transition-opacity`} />
                 </button>
                 {categories.map(cat => (
                   <button key={cat} onClick={() => setSelectedCategory(cat)} className={`w-full text-left px-6 py-3.5 rounded-2xl text-[11px] font-black uppercase transition-all flex items-center justify-between group ${selectedCategory === cat ? 'bg-white shadow-xl text-blue-600' : 'text-gray-500 hover:bg-white/50'}`}>
                     <span className="truncate">{cat}</span>
                     <ChevronRight size={14} className={`${selectedCategory === cat ? 'opacity-100' : 'opacity-0'} transition-opacity`} />
                   </button>
                 ))}
              </div>
           </div>
        </aside>

        {/* Grid de Productos */}
        <main className="flex-1 overflow-y-auto no-scrollbar pb-24">
           <div className="grid grid-cols-1 xl:grid-cols-2 2xl:grid-cols-3 gap-8">
              {filteredItems.map(item => (
                <div key={item.id} className="bg-white rounded-[3rem] border border-gray-100 overflow-hidden shadow-[0_15px_50px_-15px_rgba(0,0,0,0.1)] hover:shadow-2xl hover:shadow-blue-500/10 transition-all flex flex-col group border-t-4 border-t-transparent hover:border-t-blue-500">
                   
                   {/* Imagen & Badge */}
                   <div className="aspect-[16/10] bg-gray-50 flex items-center justify-center relative group-hover:bg-blue-50 transition-colors">
                      <div className="w-24 h-24 bg-white rounded-[2rem] shadow-xl flex items-center justify-center">
                        <Box size={48} className="text-gray-200 group-hover:text-blue-300 transition-colors" />
                      </div>
                      <div className="absolute top-6 left-6 flex flex-col gap-2">
                         <span className="bg-white/90 backdrop-blur-md text-blue-600 px-3 py-1 rounded-full text-[8px] font-black uppercase tracking-widest shadow-sm border border-blue-100">
                            {item.unit}
                         </span>
                         {item.isExpiringSoon && (
                           <span className="bg-red-500 text-white px-3 py-1 rounded-full text-[8px] font-black uppercase tracking-widest shadow-lg animate-pulse">
                              STOCK CRÍTICO
                           </span>
                         )}
                      </div>
                   </div>

                   <div className="p-8 flex-1 flex flex-col">
                      <div className="mb-6">
                         <h4 className="text-xl font-black text-gray-900 uppercase tracking-tight leading-none mb-2">{item.name}</h4>
                         <p className="text-[9px] text-gray-400 font-bold uppercase tracking-widest">{item.pyg_category || item.category}</p>
                      </div>

                      {/* VENDOR SELECTOR CORE */}
                      <div className="space-y-3 mb-8">
                        <span className="text-[8px] font-black text-gray-400 uppercase tracking-widest ml-1 italic">Comparador de Precios</span>
                        <div className="grid grid-cols-1 gap-2">
                           {item.offers.map((offer) => {
                             const isSelected = selectedVendorMap[item.id] === offer.vendorId;
                             const isBestPrice = offer.price === item.bestPrice;
                             
                             return (
                               <button 
                                 key={offer.vendorId}
                                 onClick={() => setSelectedVendorMap(prev => ({...prev, [item.id]: offer.vendorId}))}
                                 className={`p-4 rounded-2xl border-2 transition-all text-left flex items-center justify-between group/offer ${
                                   isSelected ? 'bg-blue-50 border-blue-500 shadow-lg shadow-blue-500/10' : 'bg-white border-gray-100 hover:border-gray-200'
                                 }`}
                               >
                                  <div className="flex items-center gap-3">
                                     <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${isSelected ? 'border-blue-500' : 'border-gray-200'}`}>
                                        {isSelected && <div className="w-2 h-2 bg-blue-500 rounded-full"></div>}
                                     </div>
                                     <div>
                                        <h5 className={`text-[10px] font-black uppercase leading-none mb-1 ${isSelected ? 'text-blue-700' : 'text-gray-700'}`}>
                                          {offer.vendorName}
                                        </h5>
                                        <div className="flex items-center gap-3">
                                           <span className="text-[8px] text-gray-400 font-bold flex items-center gap-1">
                                              <Clock size={8} /> {offer.deliveryDays === 0 ? 'HOY' : `${offer.deliveryDays}d`}
                                           </span>
                                           <span className={`text-[8px] font-black ${offer.availableStock < 50 ? 'text-orange-500' : 'text-green-600'}`}>
                                              STOCK: {offer.availableStock}
                                           </span>
                                        </div>
                                     </div>
                                  </div>
                                  <div className="text-right">
                                     <span className={`text-sm font-black italic block ${isSelected ? 'text-blue-600' : 'text-gray-900'}`}>
                                       $ {offer.price.toLocaleString()}
                                     </span>
                                     {isBestPrice && <span className="text-[7px] bg-green-500 text-white px-2 py-0.5 rounded-full font-black uppercase">Ahorro IA</span>}
                                  </div>
                               </button>
                             );
                           })}
                        </div>
                      </div>

                      <button 
                        onClick={() => addToCart(item)}
                        className="w-full bg-[#ffd814] hover:bg-[#f7ca00] text-black py-4 rounded-2xl font-black italic text-[10px] uppercase tracking-[0.2em] shadow-xl transition-all active:scale-95 flex items-center justify-center gap-3"
                      >
                         <Plus size={16} /> AÑADIR A ORDEN
                      </button>
                   </div>
                </div>
              ))}
           </div>
        </main>
      </div>

      {/* Mini-Cart Overlay */}
      {isCartOpen && (
        <div className="fixed inset-0 z-[200] flex justify-end animate-in fade-in duration-300">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setIsCartOpen(false)}></div>
          <div className="w-full max-w-lg bg-white h-full relative z-10 shadow-[-20px_0_50px_rgba(0,0,0,0.2)] flex flex-col animate-in slide-in-from-right duration-500">
             <div className="p-8 border-b border-gray-100 flex justify-between items-center bg-[#0a0a0c] text-white">
                <div className="flex items-center gap-4">
                   <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center">
                      <ShoppingCart size={20} />
                   </div>
                   <div>
                      <h3 className="text-xl font-black italic uppercase tracking-tighter">Mi Orden de Compra</h3>
                      <span className="text-[9px] text-blue-400 font-bold uppercase tracking-widest">{cart.length} productos listos</span>
                   </div>
                </div>
                <button onClick={() => setIsCartOpen(false)} className="p-2 hover:bg-white/10 rounded-full transition-colors">
                   <X size={24} />
                </button>
             </div>

             <div className="flex-1 overflow-y-auto p-8 space-y-6 custom-scrollbar">
                {cart.length > 0 ? cart.map((item, idx) => (
                  <div key={idx} className="flex gap-4 p-4 rounded-3xl border border-gray-50 bg-gray-50/50 group">
                     <div className="w-20 h-20 bg-white rounded-2xl border border-gray-100 shrink-0 flex items-center justify-center">
                        <Box size={24} className="text-gray-300" />
                     </div>
                     <div className="flex-1 flex flex-col justify-center">
                        <div className="flex justify-between items-start mb-1">
                           <h4 className="text-[11px] font-black uppercase text-gray-900 leading-tight">{item.name}</h4>
                           <button onClick={() => removeFromCart(`${item.id}-${item.selectedVendor.vendorId}`)} className="text-gray-300 hover:text-red-500">
                              <Trash2 size={14} />
                           </button>
                        </div>
                        <p className="text-[8px] text-blue-600 font-black uppercase tracking-widest mb-3">{item.selectedVendor.vendorName}</p>
                        <div className="flex justify-between items-end">
                           <div className="flex items-center gap-4 bg-white border border-gray-100 rounded-xl px-3 py-1">
                              <span className="text-[10px] font-black">{item.cartQuantity} {item.unit}</span>
                           </div>
                           <span className="text-sm font-black italic text-gray-900">$ {(item.selectedVendor.price * item.cartQuantity).toLocaleString()}</span>
                        </div>
                     </div>
                  </div>
                )) : (
                  <div className="h-full flex flex-col items-center justify-center text-center opacity-20">
                     <ShoppingCart size={64} className="mb-6" />
                     <p className="text-sm font-black uppercase tracking-widest italic">El carrito está vacío</p>
                  </div>
                )}
             </div>

             <div className="p-10 border-t border-gray-100 bg-gray-50">
                <div className="flex justify-between items-center mb-8">
                   <span className="text-xs font-black text-gray-400 uppercase tracking-widest">Total Estimado</span>
                   <span className="text-3xl font-black italic text-gray-900">$ {cartTotalAmount.toLocaleString()}</span>
                </div>
                <button 
                  disabled={cart.length === 0}
                  onClick={() => setOrderComplete(true)}
                  className="w-full bg-[#ffd814] hover:bg-[#f7ca00] text-black py-5 rounded-[2rem] font-black italic text-sm uppercase tracking-widest shadow-xl transition-all disabled:opacity-20 active:scale-95"
                >
                   TRAMITAR ÓRDENES DE COMPRA
                </button>
                <div className="mt-6 flex items-center justify-center gap-3 opacity-40">
                   <ShieldCheck size={14} className="text-green-600" />
                   <span className="text-[8px] font-black text-gray-600 uppercase tracking-widest">Compra Protegida por Nexum Trust</span>
                </div>
             </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default SupplyMarketplace;
