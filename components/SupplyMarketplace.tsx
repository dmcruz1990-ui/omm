
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
  Calendar
} from 'lucide-react';
import { SupplyItem } from '../types.ts';

interface MarketplaceProps {
  items: SupplyItem[];
  onBack: () => void;
}

interface VendorOffer {
  vendorId: string;
  vendorName: string;
  price: number;
  deliveryDays: number;
}

interface SmartSupplyItem extends SupplyItem {
  offers?: VendorOffer[];
  bestPrice?: number;
  isExpiringSoon?: boolean;
}

interface CartItem extends SmartSupplyItem {
  cartQuantity: number;
  selectedVendor?: VendorOffer;
}

const SupplyMarketplace: React.FC<MarketplaceProps> = ({ items, onBack }) => {
  const [mode, setMode] = useState<'internal' | 'external'>('internal');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [orderComplete, setOrderComplete] = useState(false);
  const [showVendorManager, setShowVendorManager] = useState(false);

  // MOCK: Enriquecimiento de datos con lógica de proveedores e IA
  const enrichedItems: SmartSupplyItem[] = useMemo(() => {
    return items.map(item => {
      const hasOffers = mode === 'external';
      const offers: VendorOffer[] = hasOffers ? [
        { vendorId: 'v1', vendorName: 'Pesquera Central', price: item.costPerUnit * 0.95, deliveryDays: 1 },
        { vendorId: 'v2', vendorName: 'Global Foods', price: item.costPerUnit, deliveryDays: 2 },
        { vendorId: 'v3', vendorName: 'Disto Express', price: item.costPerUnit * 1.1, deliveryDays: 0 },
      ] : [];

      return {
        ...item,
        offers,
        bestPrice: offers.length > 0 ? Math.min(...offers.map(o => o.price)) : item.costPerUnit,
        isExpiringSoon: item.id === '6' || item.id === '2', // Simulación de vencimiento
      };
    });
  }, [items, mode]);

  const filteredItems = useMemo(() => {
    return enrichedItems.filter(item => {
      const matchesSearch = item.name.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesCategory = selectedCategory ? item.category === selectedCategory : true;
      return matchesSearch && matchesCategory;
    });
  }, [enrichedItems, searchTerm, selectedCategory]);

  const addToCart = (item: SmartSupplyItem, vendor?: VendorOffer) => {
    setCart(prev => {
      const cartId = vendor ? `${item.id}-${vendor.vendorId}` : item.id;
      const existing = prev.find(i => (vendor ? `${i.id}-${i.selectedVendor?.vendorId}` : i.id) === cartId);
      
      if (existing) {
        return prev.map(i => (vendor ? `${i.id}-${i.selectedVendor?.vendorId}` : i.id) === cartId 
          ? { ...i, cartQuantity: i.cartQuantity + 1 } 
          : i
        );
      }
      return [...prev, { ...item, cartQuantity: 1, selectedVendor: vendor }];
    });
  };

  const generateSmartOrder = () => {
    const criticalItems = enrichedItems.filter(i => i.status === 'critical' || i.status === 'low');
    const smartAdditions: CartItem[] = criticalItems.map(item => {
      const bestOffer = item.offers?.reduce((prev, curr) => prev.price < curr.price ? prev : curr);
      return {
        ...item,
        cartQuantity: item.status === 'critical' ? 5 : 2,
        selectedVendor: bestOffer
      };
    });
    setCart(prev => [...prev, ...smartAdditions]);
    setIsCartOpen(true);
  };

  const cartTotalAmount = cart.reduce((sum, item) => 
    sum + ((item.selectedVendor?.price || item.bestPrice || 0) * item.cartQuantity), 0
  );

  if (orderComplete) {
    return (
      <div className="fixed inset-0 z-[500] bg-white flex flex-col items-center justify-center p-6 text-black animate-in fade-in zoom-in duration-500">
        <div className="w-24 h-24 bg-green-500 rounded-full flex items-center justify-center mb-8 shadow-xl">
          <CheckCircle size={48} className="text-white" />
        </div>
        <h2 className="text-4xl font-black uppercase italic tracking-tighter mb-4">
          {mode === 'internal' ? 'Solicitud Enviada' : 'Compra Procesada'}
        </h2>
        <p className="text-gray-500 text-lg font-medium text-center max-w-md">
          {mode === 'internal' 
            ? 'Bodega Central ha recibido tu pedido de reposición.' 
            : 'Las órdenes de compra han sido enviadas a los proveedores seleccionados.'}
        </p>
        <button onClick={onBack} className="mt-12 bg-black text-white px-10 py-4 rounded-full font-black text-xs uppercase tracking-widest">
          VOLVER AL CORE
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f3f4f6] text-black font-sans flex flex-col animate-in fade-in duration-500">
      
      {/* AMAZON STYLE HEADER */}
      <header className="bg-[#131921] text-white py-3 px-6 md:px-12 flex items-center justify-between gap-8 sticky top-0 z-[100] shadow-xl">
        <div className="flex items-center gap-6">
          <button onClick={onBack} className="hover:text-amber-400 transition-colors flex items-center gap-2 text-[10px] font-black uppercase tracking-widest">
            <ArrowLeft size={18} /> SALIR
          </button>
          <h1 className="text-2xl font-black italic tracking-tighter leading-none hidden lg:block">NEXUM <span className="text-amber-400 uppercase text-xs align-top ml-1">Market</span></h1>
        </div>

        <div className="flex-1 max-w-2xl">
          <div className="flex h-11">
             <input 
               type="text" 
               placeholder={mode === 'internal' ? "Busca en Bodega OMM..." : "Busca entre 40+ Proveedores..."} 
               value={searchTerm}
               onChange={(e) => setSearchTerm(e.target.value)}
               className="flex-1 px-4 py-2 text-black text-sm outline-none rounded-l-lg"
             />
             <button className="bg-amber-400 hover:bg-amber-500 text-black px-6 rounded-r-lg">
               <Search size={20} />
             </button>
          </div>
        </div>

        <button onClick={() => setIsCartOpen(true)} className="relative flex items-center gap-3 group">
          <div className="relative">
            <ShoppingCart size={28} />
            {cart.length > 0 && (
              <span className="absolute -top-2 -right-2 bg-amber-500 text-black text-[10px] font-black px-1.5 py-0.5 rounded-full border-2 border-[#131921]">
                {cart.length}
              </span>
            )}
          </div>
          <div className="hidden md:flex flex-col items-start leading-none">
            <span className="text-[10px] font-bold text-gray-400 uppercase">Mi Carrito</span>
            <span className="text-sm font-black italic">$ {cartTotalAmount.toLocaleString()}</span>
          </div>
        </button>
      </header>

      {/* MODE SWITCHER */}
      <div className="bg-white border-b border-gray-200 px-12 py-4 flex items-center justify-between">
         <div className="flex bg-gray-100 p-1 rounded-2xl border border-gray-200">
            <button 
              onClick={() => setMode('internal')}
              className={`px-8 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2 ${mode === 'internal' ? 'bg-white text-blue-600 shadow-md' : 'text-gray-400'}`}
            >
              <Building2 size={14} /> Requisición Interna
            </button>
            <button 
              onClick={() => setMode('external')}
              className={`px-8 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2 ${mode === 'external' ? 'bg-white text-blue-600 shadow-md' : 'text-gray-400'}`}
            >
              <Truck size={14} /> Compra a Proveedores
            </button>
         </div>

         {mode === 'external' && (
           <button className="text-[10px] font-black uppercase tracking-widest text-blue-600 flex items-center gap-2 hover:underline">
              <Plus size={14} /> Gestionar Proveedores
           </button>
         )}
      </div>

      <div className="flex-1 flex flex-col md:flex-row gap-8 p-6 md:p-12">
        
        {/* NEXUM AI SIDEBAR */}
        <aside className="w-full md:w-80 shrink-0 space-y-8">
           {/* AI Procurement Widget */}
           <div className="bg-[#131921] text-white p-8 rounded-[2.5rem] shadow-2xl relative overflow-hidden group">
              <div className="absolute top-0 right-0 p-6 opacity-10"><Brain size={60} fill="white" /></div>
              <div className="relative z-10">
                 <div className="flex items-center gap-2 mb-6">
                    <Sparkles className="text-amber-400" size={18} />
                    <h4 className="text-[10px] font-black uppercase tracking-widest text-amber-400">Nexum AI Assistant</h4>
                 </div>
                 <p className="text-sm font-bold italic leading-relaxed mb-8">
                   "He detectado <span className="text-red-500">2 productos</span> con stock crítico y <span className="text-amber-400">1 próximo a vencer</span>."
                 </p>
                 
                 <div className="space-y-4 mb-8">
                    {enrichedItems.filter(i => i.status === 'critical').map(i => (
                       <div key={i.id} className="flex items-center gap-3 bg-white/5 p-3 rounded-xl border border-white/5">
                          <AlertTriangle className="text-red-500" size={14} />
                          <span className="text-[10px] font-bold uppercase truncate">{i.name}</span>
                       </div>
                    ))}
                 </div>

                 <button 
                  onClick={generateSmartOrder}
                  className="w-full bg-amber-400 hover:bg-amber-500 text-black py-4 rounded-2xl font-black italic text-[10px] uppercase tracking-[0.2em] shadow-xl flex items-center justify-center gap-2"
                 >
                    <Zap size={14} fill="black" /> GENERAR PEDIDO INTELIGENTE
                 </button>
              </div>
           </div>

           <div>
              <h3 className="text-xs font-black uppercase tracking-widest text-gray-500 mb-6 px-2">Filtrar por</h3>
              <div className="space-y-1">
                 <button onClick={() => setSelectedCategory(null)} className={`w-full text-left px-6 py-3.5 rounded-xl text-sm font-bold transition-all ${!selectedCategory ? 'bg-white shadow-md text-blue-600' : 'text-gray-500 hover:bg-white/50'}`}>Todos</button>
                 {Array.from(new Set(items.map(i => i.category))).map(cat => (
                   <button key={cat} onClick={() => setSelectedCategory(cat)} className={`w-full text-left px-6 py-3.5 rounded-xl text-sm font-bold transition-all ${selectedCategory === cat ? 'bg-white shadow-md text-blue-600' : 'text-gray-500 hover:bg-white/50'}`}>{cat}</button>
                 ))}
              </div>
           </div>
        </aside>

        {/* MAIN PRODUCT GRID */}
        <main className="flex-1">
           <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {filteredItems.map(item => (
                <div key={item.id} className="bg-white rounded-[2rem] border border-gray-200 overflow-hidden hover:shadow-2xl transition-all flex flex-col group relative">
                   
                   {/* AI Badges */}
                   {item.isExpiringSoon && (
                     <div className="absolute top-4 left-4 z-10 bg-orange-100 text-orange-600 px-3 py-1 rounded-full text-[8px] font-black uppercase border border-orange-200 flex items-center gap-1 shadow-sm">
                        <Calendar size={10} /> Vence Pronto
                     </div>
                   )}

                   <div className="aspect-square bg-gray-50 flex items-center justify-center p-12 relative overflow-hidden">
                      <Box size={80} className="text-gray-200 group-hover:scale-110 transition-transform duration-700" />
                      <div className="absolute bottom-4 right-6 text-[10px] font-black text-gray-300 uppercase">{item.unit}</div>
                   </div>

                   <div className="p-6 flex-1 flex flex-col">
                      <span className="text-[8px] font-black uppercase text-blue-600 tracking-widest mb-1">{item.category}</span>
                      <h4 className="text-base font-black text-gray-900 uppercase leading-tight mb-4">{item.name}</h4>
                      
                      {mode === 'internal' ? (
                        <div className="flex items-center gap-2 mb-6">
                           <div className={`w-2 h-2 rounded-full ${item.status === 'optimal' ? 'bg-green-500' : 'bg-red-500'}`}></div>
                           <span className="text-[10px] font-bold text-gray-500 uppercase italic">Stock: {item.real} {item.unit}</span>
                        </div>
                      ) : (
                        <div className="space-y-4 mb-6">
                           {item.offers?.map((offer, idx) => (
                             <div key={offer.vendorId} className={`p-3 rounded-xl border flex items-center justify-between transition-all ${idx === 0 ? 'bg-blue-50 border-blue-200 ring-1 ring-blue-500/10' : 'border-gray-100 opacity-60'}`}>
                                <div>
                                   <p className="text-[10px] font-black uppercase text-gray-900 leading-none">{offer.vendorName}</p>
                                   <p className="text-[8px] text-gray-500 font-bold uppercase mt-1">Llega en {offer.deliveryDays}d</p>
                                </div>
                                <div className="text-right">
                                   <p className="text-sm font-black italic text-gray-900">$ {offer.price.toLocaleString()}</p>
                                   {idx === 0 && <span className="text-[7px] font-black text-blue-600 uppercase flex items-center gap-1 justify-end"><Sparkles size={8} /> Mejor Precio</span>}
                                </div>
                             </div>
                           ))}
                        </div>
                      )}

                      <button 
                        onClick={() => addToCart(item, mode === 'external' ? item.offers?.[0] : undefined)}
                        className="w-full bg-[#ffd814] hover:bg-[#f7ca00] text-black py-4 rounded-2xl font-black italic text-[10px] uppercase tracking-widest shadow-md transition-all active:scale-95 flex items-center justify-center gap-2"
                      >
                         <Plus size={16} /> {mode === 'internal' ? 'Solicitar' : 'Comprar Ahora'}
                      </button>
                   </div>
                </div>
              ))}
           </div>
        </main>
      </div>

      {/* SHOPPING CART (DRAWER) */}
      {isCartOpen && (
        <div className="fixed inset-0 z-[200] flex justify-end">
           <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setIsCartOpen(false)}></div>
           <div className="relative w-full max-w-md bg-white h-full shadow-2xl flex flex-col animate-in slide-in-from-right">
              <div className="p-8 bg-[#131921] text-white flex items-center justify-between">
                 <div className="flex items-center gap-3 text-amber-400">
                    <ShoppingCart size={24} />
                    <h3 className="text-xl font-black italic uppercase tracking-tighter">Checkout {mode === 'internal' ? 'Interno' : 'Externo'}</h3>
                 </div>
                 <button onClick={() => setIsCartOpen(false)}><X size={24} /></button>
              </div>

              <div className="flex-1 overflow-y-auto p-8 space-y-6">
                 {cart.map((item, idx) => (
                   <div key={idx} className="flex gap-4 border-b border-gray-100 pb-6 group">
                      <div className="w-16 h-16 bg-gray-100 rounded-xl flex items-center justify-center shrink-0"><Box size={24} className="text-gray-300" /></div>
                      <div className="flex-1">
                         <div className="flex justify-between">
                            <h4 className="text-[11px] font-black text-gray-900 uppercase">{item.name}</h4>
                            <button onClick={() => setCart(prev => prev.filter((_, i) => i !== idx))}><Trash2 size={14} className="text-gray-300 hover:text-red-500" /></button>
                         </div>
                         {item.selectedVendor && <p className="text-[8px] font-bold text-blue-600 uppercase mt-1">Proveedor: {item.selectedVendor.vendorName}</p>}
                         <div className="flex items-center justify-between mt-4">
                            <div className="flex items-center bg-gray-100 rounded-lg p-1">
                               <button onClick={() => {
                                 const newCart = [...cart];
                                 newCart[idx].cartQuantity = Math.max(1, item.cartQuantity - 1);
                                 setCart(newCart);
                               }} className="p-1"><Minus size={12} /></button>
                               <span className="px-4 font-black italic text-xs">{item.cartQuantity}</span>
                               <button onClick={() => {
                                 const newCart = [...cart];
                                 newCart[idx].cartQuantity += 1;
                                 setCart(newCart);
                               }} className="p-1"><Plus size={12} /></button>
                            </div>
                            <span className="text-sm font-black italic">$ {((item.selectedVendor?.price || item.bestPrice || 0) * item.cartQuantity).toLocaleString()}</span>
                         </div>
                      </div>
                   </div>
                 ))}
              </div>

              <div className="p-8 bg-gray-50 border-t border-gray-200">
                 <div className="flex justify-between items-center mb-6">
                    <span className="text-sm font-bold text-gray-500 uppercase">Total Estimado</span>
                    <span className="text-2xl font-black italic text-black">$ {cartTotalAmount.toLocaleString()}</span>
                 </div>
                 <button 
                  onClick={() => { setOrderComplete(true); }}
                  className="w-full bg-[#ffd814] hover:bg-[#f7ca00] text-black py-5 rounded-[2rem] font-black italic text-sm uppercase tracking-widest shadow-xl flex items-center justify-center gap-3 border border-[#fcd200]"
                 >
                    <PackageCheck size={20} /> {mode === 'internal' ? 'Confirmar Requisición' : 'Emitir Órdenes de Compra'}
                 </button>
              </div>
           </div>
        </div>
      )}
    </div>
  );
};

export default SupplyMarketplace;
