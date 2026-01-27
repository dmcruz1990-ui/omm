
import React, { useState } from 'react';
import { 
  X, CreditCard, Banknote, QrCode, CheckCircle2, 
  Loader2, Receipt, ShieldCheck, DollarSign 
} from 'lucide-react';
import { supabase } from '../lib/supabase';

interface CheckoutModalProps {
  isOpen: boolean;
  onClose: () => void;
  order: any;
  items: any[];
  tableId: number;
  total: number;
  onSuccess: () => void;
}

const CheckoutModal: React.FC<CheckoutModalProps> = ({ 
  isOpen, onClose, order, items, tableId, total, onSuccess 
}) => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<string | null>(null);
  const [tipEnabled, setTipEnabled] = useState(true);
  const [showSuccess, setShowSuccess] = useState(false);

  if (!isOpen) return null;

  const tipAmount = tipEnabled ? total * 0.10 : 0;
  const taxAmount = total * 0.08;
  const subtotal = total - taxAmount;
  const finalTotal = total + tipAmount;

  const handleProcessPayment = async () => {
    if (!paymentMethod) return;
    
    setIsProcessing(true);
    try {
      console.log(`[CHECKOUT] Procesando pago Mesa ${tableId} vía ${paymentMethod}`);
      
      // 1. Actualizar Orden
      const { error: orderError } = await supabase
        .from('orders')
        .update({ 
          status: 'paid', 
          total_amount: finalTotal,
          closed_at: new Date().toISOString()
        })
        .eq('id', order.id);

      if (orderError) throw orderError;

      // 2. Liberar Mesa
      const { error: tableError } = await supabase
        .from('tables')
        .update({ 
          status: 'free', 
          ritual_step: 0,
          welcome_timer_start: null 
        })
        .eq('id', tableId);

      if (tableError) throw tableError;

      console.log("✅ [CHECKOUT] Transacción completada con éxito");
      setShowSuccess(true);
      
      setTimeout(() => {
        onSuccess();
        onClose();
        setShowSuccess(false);
      }, 2500);

    } catch (err: any) {
      console.error("❌ [CHECKOUT] Error crítico:", err);
      alert("Error al procesar el pago. Intente de nuevo.");
    } finally {
      setIsProcessing(false);
    }
  };

  if (showSuccess) {
    return (
      <div className="fixed inset-0 z-[600] flex items-center justify-center p-8 bg-black/95 backdrop-blur-3xl animate-in fade-in duration-500">
        <div className="flex flex-col items-center text-center">
           <div className="w-32 h-32 bg-green-600 rounded-full flex items-center justify-center mb-8 shadow-[0_0_80px_rgba(22,163,74,0.4)] animate-in zoom-in duration-700">
              <CheckCircle2 size={64} className="text-white" />
           </div>
           <h2 className="text-5xl font-black italic tracking-tighter uppercase mb-4">¡PAGO EXITOSO!</h2>
           <p className="text-gray-500 text-[10px] font-black uppercase tracking-[0.4em] mb-10 italic">Transacción Sincronizada con DIAN</p>
           <div className="text-3xl font-black text-white italic font-mono">
             $ {finalTotal.toLocaleString()}
           </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[500] flex items-center justify-center p-6 sm:p-8 animate-in fade-in backdrop-blur-xl">
      <div className="absolute inset-0 bg-black/80" onClick={onClose}></div>
      
      <div className="bg-[#0a0a0c] border border-white/10 rounded-[4rem] w-full max-w-4xl relative z-10 overflow-hidden shadow-[0_0_120px_rgba(0,0,0,0.8)] flex flex-col lg:flex-row h-[90vh] lg:h-auto">
        
        {/* Lado Izquierdo: Resumen Fiscal */}
        <div className="flex-1 p-10 border-r border-white/5 bg-white/5 overflow-y-auto custom-scrollbar">
           <div className="flex items-center gap-4 mb-10">
              <div className="p-3 bg-blue-600 rounded-2xl text-white">
                <Receipt size={24} />
              </div>
              <h3 className="text-2xl font-black italic uppercase tracking-tighter">Resumen de Factura</h3>
           </div>

           <div className="space-y-6">
              {items.map((item, idx) => (
                <div key={idx} className="flex justify-between items-center text-xs font-bold text-gray-400">
                   <span>{item.quantity}x {item.menu_items?.name}</span>
                   <span className="font-mono text-white">${item.subtotal.toLocaleString()}</span>
                </div>
              ))}
           </div>

           <div className="mt-12 pt-8 border-t-2 border-dashed border-white/10 space-y-4">
              <div className="flex justify-between items-center text-[10px] text-gray-500 font-black uppercase tracking-widest">
                 <span>Subtotal Neto</span>
                 <span className="font-mono">${subtotal.toLocaleString()}</span>
              </div>
              <div className="flex justify-between items-center text-[10px] text-gray-500 font-black uppercase tracking-widest">
                 <span>Impoconsumo (8%)</span>
                 <span className="font-mono">${taxAmount.toLocaleString()}</span>
              </div>
              <div className="flex justify-between items-center p-4 bg-white/5 rounded-2xl border border-white/5">
                 <div className="flex flex-col">
                    <span className="text-[10px] text-blue-500 font-black uppercase">Propina Sugerida (10%)</span>
                    <span className="text-[8px] text-gray-600 font-bold">Voluntaria para el equipo</span>
                 </div>
                 <div className="flex items-center gap-4">
                    <span className="font-mono text-white text-sm">${tipAmount.toLocaleString()}</span>
                    <button 
                      onClick={() => setTipEnabled(!tipEnabled)}
                      className={`w-12 h-6 rounded-full relative transition-all ${tipEnabled ? 'bg-blue-600' : 'bg-gray-800'}`}
                    >
                      <div className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all ${tipEnabled ? 'left-7' : 'left-1'}`}></div>
                    </button>
                 </div>
              </div>
           </div>
        </div>

        {/* Lado Derecho: Procesamiento de Pago */}
        <div className="flex-1 p-10 flex flex-col justify-between">
           <div>
              <div className="flex justify-between items-center mb-10">
                 <span className="text-[10px] font-black text-gray-600 uppercase tracking-widest italic">Mesa {tableId} • Checkout</span>
                 <button onClick={onClose} className="text-gray-600 hover:text-white"><X size={24} /></button>
              </div>

              <div className="text-center mb-12">
                 <span className="text-[10px] text-blue-500 font-black uppercase tracking-[0.4em] block mb-2">Total Final a Cobrar</span>
                 <div className="text-6xl font-black italic text-white tracking-tighter">
                   $ {finalTotal.toLocaleString()}
                 </div>
              </div>

              <div className="space-y-4">
                 <h4 className="text-[10px] font-black text-gray-600 uppercase tracking-widest mb-4">Seleccione Método de Pago</h4>
                 <div className="grid grid-cols-1 gap-4">
                    <PaymentOption 
                      active={paymentMethod === 'card'} 
                      onClick={() => setPaymentMethod('card')}
                      icon={<CreditCard size={20} />}
                      label="Tarjeta de Crédito / Débito"
                    />
                    <PaymentOption 
                      active={paymentMethod === 'cash'} 
                      onClick={() => setPaymentMethod('cash')}
                      icon={<Banknote size={20} />}
                      label="Efectivo (Cash)"
                    />
                    <PaymentOption 
                      active={paymentMethod === 'qr'} 
                      onClick={() => setPaymentMethod('qr')}
                      icon={<QrCode size={20} />}
                      label="Transferencia / QR Link"
                    />
                 </div>
              </div>
           </div>

           <button 
             onClick={handleProcessPayment}
             disabled={!paymentMethod || isProcessing}
             className="w-full mt-10 bg-blue-600 hover:bg-blue-500 text-white py-6 rounded-[2rem] font-black italic text-sm uppercase tracking-widest flex items-center justify-center gap-4 transition-all shadow-[0_15px_40px_rgba(37,99,235,0.3)] active:scale-95 disabled:opacity-20"
           >
              {isProcessing ? <Loader2 className="animate-spin" /> : <><ShieldCheck size={20} /> FINALIZAR TRANSACCIÓN</>}
           </button>
        </div>

      </div>
    </div>
  );
};

const PaymentOption = ({ active, onClick, icon, label }: any) => (
  <button 
    onClick={onClick}
    className={`w-full p-6 rounded-[1.8rem] border-2 flex items-center gap-6 transition-all ${
      active 
        ? 'bg-blue-600/10 border-blue-600 text-white' 
        : 'bg-white/5 border-white/5 text-gray-500 hover:border-white/10'
    }`}
  >
    <div className={`p-3 rounded-xl ${active ? 'bg-blue-600 text-white' : 'bg-black text-gray-700'}`}>
       {icon}
    </div>
    <span className="text-xs font-black uppercase tracking-widest">{label}</span>
  </button>
);

export default CheckoutModal;
