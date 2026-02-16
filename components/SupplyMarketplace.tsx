
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
  X,
  ArrowLeft,
  Truck,
  Building2,
  Brain,
  Clock,
  ShieldCheck,
  MessageCircle,
  FileText,
  Mail,
  Download,
  BarChart3,
  Send,
  Sparkles,
  ChevronRight,
  Store
} from 'lucide-react';
import { jsPDF } from 'https://esm.sh/jspdf';
import autoTable from 'https://esm.sh/jspdf-autotable';
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
  email: string;
  phone: string;
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
  const [mode, setMode] = useState<'internal' | 'external' | 'stats'>('external');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [isDispatching, setIsDispatching] = useState(false);
  const [selectedVendorMap, setSelectedVendorMap] = useState<Record<string, string>>({});
  const [showPODocument, setShowPODocument] = useState<{vendor: VendorOffer, items: CartItem[]} | null>(null);
  const [dispatchedVendors, setDispatchedVendors] = useState<Set<string>>(new Set());

  const TEST_PHONE = "573204297359";

  const categories: PYGCategory[] = [
    'Costo de alimentos',
    'Costo de bebidas',
    'Empaques y desechables',
    'Comisiones y plataformas',
    'Aseo, mantenimiento y operación'
  ];

  const enrichedItems: SmartSupplyItem[] = useMemo(() => {
    return items.map(item => {
      const offers: VendorOffer[] = [
        { vendorId: 'v1', vendorName: 'Distribuidora Seratta', price: item.costPerUnit * 0.92, deliveryDays: 1, availableStock: 450, email: 'compras@seratta.com', phone: TEST_PHONE },
        { vendorId: 'v2', vendorName: 'Macro Proveedores', price: item.costPerUnit, deliveryDays: 2, availableStock: 1200, email: 'ventas@macro.com', phone: TEST_PHONE },
        { vendorId: 'v3', vendorName: 'Disto Express', price: item.costPerUnit * 1.05, deliveryDays: 0, availableStock: 25, email: 'pedidos@disto.com', phone: TEST_PHONE },
      ];

      return {
        ...item,
        offers,
        bestPrice: Math.min(...offers.map(o => o.price)),
        isExpiringSoon: item.status === 'low'
      };
    });
  }, [items]);

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

  const generatePDF = (vendor: VendorOffer, cartItems: CartItem[]) => {
    try {
      const doc = new jsPDF();
      const poNumber = `PO-2025-${Math.floor(Math.random() * 9000) + 1000}`;
      
      // Header Corporativo Grupo Seratta
      doc.setFillColor(10, 10, 12);
      doc.rect(0, 0, 210, 45, 'F');
      
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(24);
      doc.setFont('helvetica', 'bold');
      doc.text('GRUPO SERATTA SAS', 20, 25);
      
      doc.setFontSize(9);
      doc.setFont('helvetica', 'italic');
      doc.text('EXPERIENTIAL RESTAURANTS', 20, 33);
      
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      doc.text('ORDEN DE COMPRA OFICIAL', 145, 20);
      doc.setFontSize(16);
      doc.setTextColor(59, 130, 246);
      doc.setFont('helvetica', 'bold');
      doc.text(poNumber, 145, 30);
      
      // Información de Emisión
      doc.setTextColor(10, 10, 12);
      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');
      doc.text('DATOS DEL EMISOR:', 20, 60);
      doc.setFont('helvetica', 'normal');
      doc.text('NIT: 900.429.735-9', 20, 66);
      doc.text('Autopista Norte #114-44', 20, 72);
      doc.text('Bogotá D.C., Colombia', 20, 78);
      
      doc.setFont('helvetica', 'bold');
      doc.text('PROVEEDOR DESTINATARIO:', 115, 60);
      doc.setFont('helvetica', 'normal');
      doc.text(vendor.vendorName.toUpperCase(), 115, 66);
      doc.text(vendor.email, 115, 72);
      doc.text(`Tel: +${vendor.phone}`, 115, 78);
      
      // Tabla de Productos
      const tableData = cartItems.map(item => [
        item.name.toUpperCase(),
        `${item.cartQuantity} ${item.unit}`,
        `$ ${item.selectedVendor.price.toLocaleString()}`,
        `$ ${(item.selectedVendor.price * item.cartQuantity).toLocaleString()}`
      ]);
      
      autoTable(doc, {
        startY: 90,
        head: [['DESCRIPCIÓN DEL INSUMO', 'CANTIDAD', 'V. UNITARIO', 'SUBTOTAL']],
        body: tableData,
        theme: 'grid',
        headStyles: { fillColor: [10, 10, 12], textColor: [255, 255, 255], fontStyle: 'bold' },
        styles: { fontSize: 9, cellPadding: 5 },
        columnStyles: {
          2: { halign: 'right' },
          3: { halign: 'right' }
        }
      });
      
      const finalY = (doc as any).lastAutoTable.finalY || 150;
      const subtotal = cartItems.reduce((sum, i) => sum + (i.selectedVendor.price * i.cartQuantity), 0);
      const iva = subtotal * 0.19;
      const total = subtotal + iva;
      
      // Totales
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.text('SUBTOTAL:', 130, finalY + 15);
      doc.text('IVA (19%):', 130, finalY + 22);
      doc.setFontSize(14);
      doc.text('TOTAL ORDEN:', 130, finalY + 32);
      
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10);
      doc.text(`$ ${subtotal.toLocaleString()}`, 190, finalY + 15, { align: 'right' });
      doc.text(`$ ${iva.toLocaleString()}`, 190, finalY + 22, { align: 'right' });
      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.text(`$ ${total.toLocaleString()}`, 190, finalY + 32, { align: 'right' });
      
      // Footer con Sello Digital
      doc.setDrawColor(200, 200, 200);
      doc.line(20, 270, 190, 270);
      doc.setFontSize(7);
      doc.setTextColor(150, 150, 150);
      doc.text('Documento generado automáticamente por NEXUM Operational Core V4.', 20, 276);
      doc.text('GRUPO SERATTA SAS - Propiedad Intelectual Reservada 2025.', 20, 280);
      
      doc.save(`${poNumber}_Seratta.pdf`);
    } catch (error) {
      console.error("Error generando PDF:", error);
      alert("Error al generar el documento. Por favor intente de nuevo.");
    }
  };

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

  const groupedCart = useMemo(() => {
    const groups: Record<string, { vendor: VendorOffer, items: CartItem[] }> = {};
    cart.forEach(item => {
      const vId = item.selectedVendor.vendorId;
      if (!groups[vId]) {
        groups[vId] = { vendor: item.selectedVendor, items: [] };
      }
      groups[vId].items.push(item);
    });
    return Object.values(groups);
  }, [cart]);

  const sendWhatsAppOrder = (vendor: VendorOffer, vendorItems: CartItem[]) => {
    let message = `*ORDEN DE COMPRA OMM - ${new Date().toLocaleDateString()}*\n\n`;
    message += `Hola *${vendor.vendorName}*, solicito formalmente el despacho de los siguientes insumos:\n\n`;
    
    let total = 0;
    vendorItems.forEach(item => {
      const subtotal = item.selectedVendor.price * item.cartQuantity;
      message += `• *${item.cartQuantity} ${item.unit}* de ${item.name} - ($${subtotal.toLocaleString()})\n`;
      total += subtotal;
    });

    message += `\n*VALOR ESTIMADO: $${total.toLocaleString()}*\n\n`;
    message += `_Por favor confirmar el recibido y el tiempo estimado de entrega._\n\n_Generado automáticamente por Nexum Supply Intelligence_`;

    const encodedMessage = encodeURIComponent(message);
    window.open(`https://wa.me/${TEST_PHONE}?text=${encodedMessage}`, '_blank');
    
    setDispatchedVendors(prev => new Set(prev).add(vendor.vendorId));
  };

  const sendEmailOrder = (vendor: VendorOffer, vendorItems: CartItem[]) => {
    const subject = encodeURIComponent(`ORDEN DE COMPRA OMM - ${vendor.vendorName} - ${new Date().toLocaleDateString()}`);
    let body = `Estimados ${vendor.vendorName},\n\nSe adjunta detalle del pedido solicitado para el restaurante OMM Bogotá:\n\n`;
    
    vendorItems.forEach(item => {
      body += `- ${item.name}: ${item.cartQuantity} ${item.unit} (Precio Pactado: $${item.selectedVendor.price.toLocaleString()})\n`;
    });

    body += `\nTotal Orden: $${vendorItems.reduce((s,i) => s + (i.selectedVendor.price * i.cartQuantity), 0).toLocaleString()}\n\n`;
    body += `Favor confirmar recepción y enviar factura electrónica.\n\nAtentamente,\nDirección de Suministros OMM.`;
    
    window.location.href = `mailto:${vendor.email}?subject=${subject}&body=${encodeURIComponent(body)}`;
    setDispatchedVendors(prev => new Set(prev).add(vendor.vendorId));
  };

  if (isDispatching) {
    return (
      <div className="min-h-screen bg-[#f3f4f6] text-black font-sans flex flex-col animate-in fade-in duration-500 text-left">
         <header className="bg-[#0a0a0c] text-white p-8 px-12 flex justify-between items-center shadow-2xl sticky top-0 z-[200]">
            <div className="flex items-center gap-6">
               <div className="w-12 h-12 bg-blue-600 rounded-2xl flex items-center justify-center shadow-lg shadow-blue-900/40">
                  <Send size={24} />
               </div>
               <div>
                  <h2 className="text-3xl font-black italic uppercase tracking-tighter">Centro de Despacho</h2>
                  <p className="text-[10px] text-gray-500 font-bold uppercase tracking-[0.3em]">Gestión de pedidos a proveedores externos</p>
               </div>
            </div>
            <button onClick={() => setIsDispatching(false)} className="text-gray-400 hover:text-white transition-all text-[10px] font-black uppercase tracking-widest flex items-center gap-2">
               <ChevronLeft size={16} /> REGRESAR
            </button>
         </header>

         <main className="flex-1 max-w-5xl mx-auto w-full p-8 md:p-16 space-y-12">
            <div className="bg-white border-l-8 border-blue-600 p-8 rounded-[2.5rem] shadow-xl flex flex-col md:flex-row items-center justify-between gap-6">
               <div>
                  <h3 className="text-xl font-black uppercase italic">Progreso de Envío</h3>
                  <p className="text-gray-500 text-sm italic font-medium">Tienes {groupedCart.length} proveedores en espera de confirmación.</p>
               </div>
               <div className="flex items-center gap-6">
                  <div className="text-right">
                    <span className="text-3xl font-black italic text-blue-600">{(dispatchedVendors.size / groupedCart.length * 100).toFixed(0)}%</span>
                    <p className="text-[8px] font-black text-gray-400 uppercase">COMPLETADO</p>
                  </div>
                  <div className="w-48 h-3 bg-gray-100 rounded-full overflow-hidden">
                     <div className="h-full bg-blue-600 transition-all duration-700 shadow-[0_0_10px_rgba(37,99,235,0.4)]" style={{ width: `${dispatchedVendors.size / groupedCart.length * 100}%` }}></div>
                  </div>
               </div>
            </div>

            <div className="grid grid-cols-1 gap-8">
               {groupedCart.map((group, idx) => {
                 const isSent = dispatchedVendors.has(group.vendor.vendorId);
                 return (
                   <div key={idx} className={`bg-white rounded-[3rem] border-2 overflow-hidden transition-all shadow-xl flex flex-col md:flex-row ${isSent ? 'border-green-500/30' : 'border-gray-100 hover:border-blue-500/20'}`}>
                      <div className="md:w-72 bg-gray-50 p-10 flex flex-col justify-center border-r border-gray-100">
                         <div className="w-16 h-16 bg-white rounded-2xl shadow-lg flex items-center justify-center mb-6">
                            <Truck size={32} className="text-blue-600" />
                         </div>
                         <h4 className="text-lg font-black uppercase leading-tight mb-2">{group.vendor.vendorName}</h4>
                         <span className="text-[9px] bg-blue-600/10 text-blue-600 px-3 py-1 rounded-full font-black uppercase w-fit">{group.items.length} PRODUCTOS</span>
                      </div>

                      <div className="flex-1 p-10 space-y-8 flex flex-col justify-center">
                         <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {group.items.slice(0, 3).map((item, i) => (
                               <div key={i} className="bg-gray-50/50 p-3 rounded-xl border border-gray-100">
                                  <span className="text-[9px] font-black text-blue-500 uppercase">{item.cartQuantity} {item.unit}</span>
                                  <p className="text-[11px] font-bold uppercase truncate text-gray-800">{item.name}</p>
                               </div>
                            ))}
                         </div>

                         <div className="flex flex-wrap gap-4 pt-6 border-t border-gray-100">
                            <button 
                              onClick={() => sendWhatsAppOrder(group.vendor, group.items)}
                              className={`px-8 py-4 rounded-2xl font-black text-[10px] uppercase tracking-widest flex items-center gap-3 transition-all shadow-lg ${
                                isSent ? 'bg-green-500 text-white' : 'bg-green-600 hover:bg-green-700 text-white active:scale-95'
                              }`}
                            >
                               <MessageCircle size={18} fill="white" /> {isSent ? 'RE-ENVIAR WHATSAPP' : 'ENVIAR WHATSAPP'}
                            </button>
                            <button 
                              onClick={() => sendEmailOrder(group.vendor, group.items)}
                              className="bg-white border border-gray-200 hover:bg-gray-50 text-gray-800 px-8 py-4 rounded-2xl font-black text-[10px] uppercase tracking-widest flex items-center gap-3 transition-all active:scale-95"
                            >
                               <Mail size={18} /> ENVIAR EMAIL
                            </button>
                            <button 
                              onClick={() => generatePDF(group.vendor, group.items)}
                              className="bg-gray-900 hover:bg-black text-white px-8 py-4 rounded-2xl font-black text-[10px] uppercase tracking-widest flex items-center gap-3 transition-all shadow-xl active:scale-95"
                            >
                               <FileText size={18} /> ORDEN COMPRA (PO)
                            </button>
                         </div>
                      </div>

                      {isSent && (
                        <div className="bg-green-500 text-white flex items-center justify-center px-10 border-l border-green-600">
                           <CheckCircle size={32} />
                        </div>
                      )}
                   </div>
                 );
               })}
            </div>

            {dispatchedVendors.size === groupedCart.length && (
              <div className="pt-10 flex flex-col items-center gap-6 animate-in zoom-in duration-500">
                 <div className="w-24 h-24 bg-green-500 rounded-full flex items-center justify-center text-white shadow-[0_0_50px_rgba(34,197,94,0.5)] animate-bounce">
                    <CheckCircle size={48} />
                 </div>
                 <h3 className="text-4xl font-black italic uppercase tracking-tighter">¡Todas las órdenes enviadas!</h3>
                 <button onClick={onBack} className="bg-black text-white px-16 py-6 rounded-full font-black text-xs uppercase tracking-[0.2em] shadow-2xl hover:scale-105 transition-all">
                    FINALIZAR Y REGISTRAR PENDIENTES
                 </button>
              </div>
            )}
         </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f3f4f6] text-black font-sans flex flex-col animate-in fade-in duration-500 text-left">
      
      {showPODocument && (
        <div className="fixed inset-0 z-[600] bg-black/80 backdrop-blur-md flex items-center justify-center p-4 md:p-12 animate-in fade-in">
           <div className="bg-white w-full max-w-4xl h-full rounded-[3rem] shadow-2xl flex flex-col overflow-hidden relative border-8 border-gray-100">
              <button onClick={() => setShowPODocument(null)} className="absolute top-10 right-10 p-3 hover:bg-gray-100 rounded-full transition-colors text-gray-400 z-50">
                 <X size={24} />
              </button>

              <div className="flex-1 overflow-y-auto p-12 md:p-24 space-y-12">
                 <div className="flex justify-between items-start border-b-4 border-black pb-12">
                    <div className="space-y-6">
                       <h2 className="text-5xl font-black italic tracking-tighter">GRUPO SERATTA SAS</h2>
                       <div className="text-[11px] font-bold text-gray-500 uppercase space-y-1 tracking-widest">
                          <p>NIT: 900.429.735-9</p>
                          <p>AUTOPISTA NORTE #114-44</p>
                          <p>BOGOTÁ D.C., COLOMBIA</p>
                       </div>
                    </div>
                    <div className="text-right space-y-4">
                       <div className="bg-black text-white px-6 py-2 rounded-xl inline-block">
                          <h3 className="text-sm font-black uppercase tracking-widest">ORDEN DE COMPRA</h3>
                       </div>
                       <p className="text-blue-600 font-mono font-bold text-xl">#PO-2025-{Date.now().toString().slice(-4)}</p>
                    </div>
                 </div>

                 <div className="grid grid-cols-2 gap-16">
                    <div className="space-y-6">
                       <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-widest border-b border-gray-100 pb-2">DESTINATARIO</h4>
                       <div className="text-sm font-black uppercase">
                          <p className="text-2xl italic tracking-tighter">{showPODocument.vendor.vendorName}</p>
                          <p className="text-gray-500 mt-2 font-medium italic normal-case">{showPODocument.vendor.email}</p>
                       </div>
                    </div>
                 </div>

                 <table className="w-full text-left">
                    <thead>
                       <tr className="border-b-2 border-black text-[10px] font-black uppercase tracking-[0.2em]">
                          <th className="py-6">DESCRIPCIÓN</th>
                          <th className="py-6 text-center">CANTIDAD</th>
                          <th className="py-6 text-right">TOTAL</th>
                       </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                       {showPODocument.items.map((item, idx) => (
                          <tr key={idx} className="text-sm">
                             <td className="py-8 font-black uppercase italic tracking-tight">{item.name}</td>
                             <td className="py-8 text-center font-bold">{item.cartQuantity} {item.unit}</td>
                             <td className="py-8 text-right font-black">$ {(item.selectedVendor.price * item.cartQuantity).toLocaleString()}</td>
                          </tr>
                       ))}
                    </tbody>
                 </table>

                 <div className="flex justify-end pt-12 border-t-2 border-black">
                    <div className="w-80 space-y-5">
                       <div className="flex justify-between items-center pt-6 border-t-2 border-black">
                          <span className="text-xs font-black uppercase tracking-widest">GRAN TOTAL PO</span>
                          <span className="text-4xl font-black italic tracking-tighter">$ {(showPODocument.items.reduce((sum, i) => sum + (i.selectedVendor.price * i.cartQuantity), 0) * 1.19).toLocaleString()}</span>
                       </div>
                    </div>
                 </div>
              </div>

              <div className="p-10 bg-gray-50 border-t border-gray-100 flex justify-center gap-6">
                 <button 
                  onClick={() => generatePDF(showPODocument.vendor, showPODocument.items)}
                  className="bg-black text-white px-12 py-5 rounded-full font-black text-xs uppercase tracking-widest flex items-center gap-4 shadow-2xl hover:scale-105 transition-all"
                 >
                    <Download size={20} /> GUARDAR PDF
                 </button>
                 <button onClick={() => sendEmailOrder(showPODocument.vendor, showPODocument.items)} className="bg-blue-600 text-white px-12 py-5 rounded-full font-black text-xs uppercase tracking-widest flex items-center gap-4 shadow-2xl hover:scale-105 transition-all shadow-blue-900/20">
                    <Mail size={20} /> DESPACHAR
                 </button>
              </div>
           </div>
        </div>
      )}

      {/* Header Marketplace */}
      <header className="bg-[#0a0a0c] text-white py-6 px-12 flex items-center justify-between gap-10 sticky top-0 z-[100] shadow-2xl">
        <div className="flex items-center gap-8">
          <button onClick={onBack} className="hover:text-blue-400 transition-colors flex items-center gap-3 text-[10px] font-black uppercase tracking-widest">
            <ArrowLeft size={18} /> VOLVER
          </button>
          <div className="w-[1px] h-8 bg-white/10"></div>
          <h1 className="text-3xl font-black italic tracking-tighter leading-none flex items-center gap-3">
             <Store size={24} className="text-blue-500" />
             NEXUM <span className="text-blue-500 uppercase text-xs font-black tracking-[0.4em] align-middle mt-1">E-MARKET</span>
          </h1>
        </div>

        <div className="flex-1 max-w-2xl relative group">
           <Search size={20} className="absolute left-6 top-1/2 -translate-y-1/2 text-gray-600 group-focus-within:text-blue-500 transition-colors" />
           <input 
             type="text" 
             placeholder="BUSCAR INSUMOS, MARCAS O ALIADOS..." 
             value={searchTerm}
             onChange={(e) => setSearchTerm(e.target.value)}
             className="w-full bg-white/5 border border-white/10 rounded-full py-4 pl-16 pr-8 text-white text-sm font-medium outline-none focus:bg-white/10 focus:border-blue-500/50 transition-all placeholder:text-gray-700"
           />
        </div>

        <button onClick={() => setIsCartOpen(true)} className="flex items-center gap-6 bg-blue-600 hover:bg-blue-500 px-8 py-4 rounded-3xl shadow-2xl shadow-blue-900/40 transition-all active:scale-95 group relative">
          <div className="relative">
            <ShoppingCart size={24} className="group-hover:rotate-12 transition-transform" />
            {cart.length > 0 && (
              <span className="absolute -top-4 -right-4 bg-white text-blue-600 text-[10px] font-black w-6 h-6 flex items-center justify-center rounded-full border-2 border-blue-600 animate-in zoom-in">
                {cart.length}
              </span>
            )}
          </div>
          <div className="hidden xl:flex flex-col items-start leading-none">
            <span className="text-[10px] font-black uppercase text-blue-100/60 mb-1">Tu Orden</span>
            <span className="text-lg font-black italic">$ {cartTotalAmount.toLocaleString()}</span>
          </div>
        </button>
      </header>

      {/* Grid de Productos */}
      <main className="flex-1 p-12 overflow-y-auto">
          <div className="grid grid-cols-1 xl:grid-cols-2 2xl:grid-cols-3 gap-10">
            {filteredItems.map(item => (
              <div key={item.id} className="bg-white rounded-[3.5rem] border border-gray-100 overflow-hidden shadow-2xl hover:shadow-blue-500/10 transition-all flex flex-col group border-t-8 border-t-transparent hover:border-t-blue-500">
                <div className="aspect-video bg-gray-50 flex items-center justify-center relative group-hover:bg-blue-50/30 transition-colors">
                    <div className="w-24 h-24 bg-white rounded-[2.5rem] shadow-xl flex items-center justify-center">
                      <Box size={48} className="text-gray-100 group-hover:text-blue-400 transition-colors" />
                    </div>
                </div>
                <div className="p-10 flex-1 flex flex-col">
                    <div className="mb-8">
                      <h4 className="text-2xl font-black text-gray-900 uppercase tracking-tight leading-none mb-3 group-hover:text-blue-600 transition-colors">{item.name}</h4>
                      <span className="text-[10px] text-gray-400 font-bold uppercase tracking-[0.2em]">{item.pyg_category || item.category}</span>
                    </div>
                    <div className="space-y-3 mb-10">
                      <div className="grid grid-cols-1 gap-3">
                        {item.offers.map((offer) => {
                          const isSelected = selectedVendorMap[item.id] === offer.vendorId;
                          return (
                            <button key={offer.vendorId} onClick={() => setSelectedVendorMap(prev => ({...prev, [item.id]: offer.vendorId}))} className={`p-5 rounded-3xl border-2 transition-all text-left flex items-center justify-between group/offer ${isSelected ? 'bg-blue-50 border-blue-500 shadow-xl' : 'bg-white border-gray-100 hover:border-gray-200'}`}>
                                <div className="flex items-center gap-4">
                                  <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${isSelected ? 'border-blue-600' : 'border-gray-200'}`}>{isSelected && <div className="w-2.5 h-2.5 bg-blue-600 rounded-full animate-in zoom-in"></div>}</div>
                                  <h5 className={`text-[11px] font-black uppercase ${isSelected ? 'text-blue-800' : 'text-gray-700'}`}>{offer.vendorName}</h5>
                                </div>
                                <span className={`text-base font-black italic block ${isSelected ? 'text-blue-600' : 'text-gray-900'}`}>$ {offer.price.toLocaleString()}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                    <button onClick={() => addToCart(item)} className="w-full bg-[#ffd814] hover:bg-[#f7ca00] text-black py-5 rounded-3xl font-black italic text-xs uppercase tracking-widest shadow-2xl transition-all active:scale-95 flex items-center justify-center gap-4 group/add">
                      <Plus size={20} className="group-hover:rotate-90 transition-transform" /> AÑADIR A LA ORDEN
                    </button>
                </div>
              </div>
            ))}
          </div>
      </main>

      {/* Mini-Cart Overlay */}
      {isCartOpen && (
        <div className="fixed inset-0 z-[500] flex justify-end animate-in fade-in duration-300">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setIsCartOpen(false)}></div>
          <div className="w-full max-w-2xl bg-white h-full relative z-10 shadow-[-40px_0_100px_rgba(0,0,0,0.4)] flex flex-col animate-in slide-in-from-right duration-500">
             <div className="p-10 border-b border-gray-100 flex justify-between items-center bg-[#0a0a0c] text-white">
                <div className="flex items-center gap-6">
                   <div className="w-14 h-14 bg-blue-600 rounded-[1.5rem] flex items-center justify-center shadow-xl shadow-blue-900/50">
                      <ShoppingCart size={28} />
                   </div>
                   <div>
                      <h3 className="text-2xl font-black italic uppercase tracking-tighter leading-none mb-1">Mi Carrito</h3>
                      <span className="text-[10px] text-blue-400 font-bold uppercase tracking-[0.3em]">{cart.length} REFERENCIAS</span>
                   </div>
                </div>
                <button onClick={() => setIsCartOpen(false)} className="p-3 hover:bg-white/10 rounded-full transition-colors"><X size={28} /></button>
             </div>

             <div className="flex-1 overflow-y-auto p-10 space-y-12 bg-gray-50/50">
                {groupedCart.length > 0 ? groupedCart.map((group, idx) => (
                  <div key={idx} className="bg-white border border-gray-100 rounded-[3rem] overflow-hidden shadow-xl animate-in slide-in-from-bottom-4 duration-500">
                     <div className="p-8 bg-gray-50 border-b border-gray-100 flex items-center justify-between">
                        <div className="flex items-center gap-4">
                           <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center text-white"><Truck size={20} /></div>
                           <h4 className="text-sm font-black uppercase italic tracking-widest">{group.vendor.vendorName}</h4>
                        </div>
                        <div className="flex gap-3">
                           <button onClick={() => sendWhatsAppOrder(group.vendor, group.items)} className="bg-green-500 hover:bg-green-600 text-white p-3 rounded-2xl transition-all shadow-xl active:scale-95"><MessageCircle size={22} fill="white" /></button>
                           <button onClick={() => setShowPODocument({vendor: group.vendor, items: group.items})} className="bg-gray-900 hover:bg-black text-white p-3 rounded-2xl transition-all shadow-xl active:scale-95"><FileText size={22} /></button>
                        </div>
                     </div>
                     <div className="p-8 space-y-6">
                        {group.items.map((item, i) => (
                           <div key={i} className="flex justify-between items-center border-b border-gray-50 pb-4 last:border-0 last:pb-0">
                              <span className="text-[11px] font-black bg-gray-100 px-4 py-2 rounded-xl border border-gray-200">{item.cartQuantity} {item.unit}</span>
                              <span className="text-sm font-bold uppercase text-gray-900">{item.name}</span>
                              <span className="text-sm font-black italic text-gray-900">$ {(item.selectedVendor.price * item.cartQuantity).toLocaleString()}</span>
                           </div>
                        ))}
                     </div>
                  </div>
                )) : (
                  <div className="h-full flex flex-col items-center justify-center text-center opacity-20 py-20">
                     <ShoppingCart size={64} className="text-gray-300" />
                     <h4 className="text-2xl font-black italic uppercase tracking-[0.2em]">CARRITO VACÍO</h4>
                  </div>
                )}
             </div>

             <div className="p-12 border-t border-gray-100 bg-white">
                <div className="flex justify-between items-center mb-10">
                   <h4 className="text-xl font-black italic uppercase tracking-tighter text-gray-900">Total Gran Orden</h4>
                   <span className="text-5xl font-black italic text-gray-900 tracking-tighter">$ {cartTotalAmount.toLocaleString()}</span>
                </div>
                <button disabled={cart.length === 0} onClick={() => setIsDispatching(true)} className="w-full bg-[#ffd814] hover:bg-[#f7ca00] text-black py-7 rounded-[2.5rem] font-black italic text-sm uppercase tracking-[0.2em] shadow-2xl transition-all disabled:opacity-20 active:scale-95 flex items-center justify-center gap-4 group">
                   <CheckCircle size={24} className="group-hover:scale-110 transition-transform" /> CONFIRMAR Y GESTIONAR DESPACHO
                </button>
             </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SupplyMarketplace;
