
import React, { useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext.tsx';
import { Zap, Mail, Lock, Loader2, AlertCircle, ChevronRight, FlaskConical, ShieldCheck, Cpu, Briefcase, ShoppingCart, ChefHat } from 'lucide-react';
import { UserRole } from '../types.ts';

const IS_DEV = import.meta.env.VITE_ENV === 'development' || import.meta.env.DEV;

const Login: React.FC = () => {
  const { signInMock } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) throw error;
    } catch (err: any) {
      setError(err.message || 'Error al iniciar sesión. Verifica tus credenciales.');
      setLoading(false);
    }
  };

  const testRoles: { role: UserRole; icon: any; color: string; label: string }[] = [
    { role: 'admin', icon: <ShieldCheck size={16} />, color: 'bg-red-600', label: 'Admin' },
    { role: 'desarrollo', icon: <Cpu size={16} />, color: 'bg-purple-600', label: 'Dev' },
    { role: 'gerencia', icon: <Briefcase size={16} />, color: 'bg-blue-600', label: 'Gerente' },
    { role: 'mesero', icon: <ShoppingCart size={16} />, color: 'bg-green-600', label: 'Mesero' },
    { role: 'cocina', icon: <ChefHat size={16} />, color: 'bg-orange-600', label: 'Cocina' },
  ];

  return (
    <div className="min-h-screen w-full bg-[#0a0a0c] flex items-center justify-center p-6 relative overflow-hidden text-left">
      {/* Background Glows */}
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-blue-600/10 blur-[120px] rounded-full"></div>
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-blue-900/10 blur-[120px] rounded-full"></div>

      <div className="w-full max-w-md animate-in fade-in zoom-in duration-700 space-y-10">
        <div className="text-center">
          <div className="w-20 h-20 bg-[#2563eb] rounded-[2rem] flex items-center justify-center shadow-[0_0_40px_rgba(37,99,235,0.4)] mx-auto mb-8">
            <Zap className="text-white" size={40} fill="currentColor" />
          </div>
          <h1 className="text-4xl font-black tracking-tighter italic leading-none flex items-center justify-center gap-2 text-white">
            NEXUM <span className="text-[#2563eb]">V4</span>
          </h1>
          <p className="text-[10px] text-gray-500 font-bold uppercase tracking-[0.4em] mt-3">Hospitality Intelligence OS</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-6 bg-white/[0.02] border border-white/5 p-8 rounded-[2.5rem] backdrop-blur-xl">
          <div className="space-y-4">
            <div className="relative group">
              <div className="absolute left-5 top-1/2 -translate-y-1/2 text-gray-500 group-focus-within:text-blue-500 transition-colors">
                <Mail size={18} />
              </div>
              <input 
                type="email" 
                placeholder="EMAIL CORPORATIVO" 
                required
                className="w-full bg-[#111114] border border-white/5 rounded-2xl py-5 pl-14 pr-6 text-[11px] font-black tracking-widest outline-none focus:border-blue-500 transition-all placeholder:text-gray-700 text-white"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>

            <div className="relative group">
              <div className="absolute left-5 top-1/2 -translate-y-1/2 text-gray-500 group-focus-within:text-blue-500 transition-colors">
                <Lock size={18} />
              </div>
              <input 
                type="password" 
                placeholder="CONTRASEÑA" 
                required
                className="w-full bg-[#111114] border border-white/5 rounded-2xl py-5 pl-14 pr-6 text-[11px] font-black tracking-widest outline-none focus:border-blue-500 transition-all placeholder:text-gray-700 text-white"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
          </div>

          {error && (
            <div className="bg-red-500/10 border border-red-500/20 p-4 rounded-xl flex items-center gap-3 animate-in shake duration-300">
              <AlertCircle size={16} className="text-red-500 shrink-0" />
              <p className="text-[10px] text-red-400 font-bold uppercase tracking-wider">{error}</p>
            </div>
          )}

          <button 
            type="submit" 
            disabled={loading}
            className="w-full bg-blue-600 hover:bg-blue-500 text-white py-5 rounded-2xl font-black italic text-sm uppercase tracking-widest flex items-center justify-center gap-3 transition-all shadow-xl shadow-blue-600/20 active:scale-95 disabled:opacity-50"
          >
            {loading ? <Loader2 size={20} className="animate-spin" /> : <>ACCEDER AL NÚCLEO <ChevronRight size={18} /></>}
          </button>
        </form>

        {/* SECCIÓN DE PRUEBAS / QA ACCESS — solo visible en development */}
        {IS_DEV && (
          <div className="space-y-6 pt-6 border-t border-white/5">
             <div className="flex items-center gap-3 px-4">
                <div className="p-2 bg-yellow-500/10 rounded-lg text-yellow-500">
                   <FlaskConical size={16} />
                </div>
                <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-[0.3em] italic">Sandbox / QA Portal Access</h3>
             </div>

             <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 px-2">
                {testRoles.map((t) => (
                  <button
                    key={t.role}
                    onClick={() => signInMock(t.role)}
                    className="flex flex-col items-center gap-3 p-4 rounded-3xl bg-white/5 border border-white/5 hover:border-white/20 hover:bg-white/10 transition-all group active:scale-95"
                  >
                     <div className={`w-10 h-10 ${t.color} rounded-xl flex items-center justify-center text-white shadow-lg group-hover:scale-110 transition-transform`}>
                        {t.icon}
                     </div>
                     <span className="text-[9px] font-black uppercase tracking-widest text-gray-400 group-hover:text-white transition-colors">{t.label}</span>
                  </button>
                ))}
             </div>

             <p className="text-[8px] text-gray-600 font-bold uppercase text-center tracking-widest px-8">
                Bypass de seguridad activado solo para el entorno de desarrollo y pruebas de OMM.
             </p>
          </div>
        )}

        <div className="text-center">
          <p className="text-[9px] text-gray-600 font-bold uppercase tracking-widest">
            Personal autorizado de <span className="text-gray-400 italic">Grupo Seratta</span>
          </p>
        </div>
      </div>
    </div>
  );
};

export default Login;
