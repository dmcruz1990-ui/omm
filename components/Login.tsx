
import React, { useState } from 'react';
import { supabase } from '../lib/supabase';
import { Zap, Mail, Lock, Loader2, AlertCircle, ChevronRight } from 'lucide-react';

const Login: React.FC = () => {
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

  return (
    <div className="min-h-screen w-full bg-[#0a0a0c] flex items-center justify-center p-6 relative overflow-hidden">
      {/* Background Glows */}
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-blue-600/10 blur-[120px] rounded-full"></div>
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-blue-900/10 blur-[120px] rounded-full"></div>

      <div className="w-full max-w-md animate-in fade-in zoom-in duration-700">
        <div className="text-center mb-12">
          <div className="w-20 h-20 bg-[#2563eb] rounded-[2rem] flex items-center justify-center shadow-[0_0_40px_rgba(37,99,235,0.4)] mx-auto mb-8">
            <Zap className="text-white" size={40} fill="currentColor" />
          </div>
          <h1 className="text-4xl font-black tracking-tighter italic leading-none flex items-center justify-center gap-2">
            NEXUM <span className="text-[#2563eb]">V4</span>
          </h1>
          <p className="text-[10px] text-gray-500 font-bold uppercase tracking-[0.4em] mt-3">Hospitality Intelligence OS</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-6">
          <div className="space-y-4">
            <div className="relative group">
              <div className="absolute left-5 top-1/2 -translate-y-1/2 text-gray-500 group-focus-within:text-blue-500 transition-colors">
                <Mail size={18} />
              </div>
              <input 
                type="email" 
                placeholder="EMAIL CORPORATIVO" 
                required
                className="w-full bg-[#111114] border border-white/5 rounded-2xl py-5 pl-14 pr-6 text-[11px] font-black tracking-widest outline-none focus:border-blue-500 transition-all placeholder:text-gray-700"
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
                className="w-full bg-[#111114] border border-white/5 rounded-2xl py-5 pl-14 pr-6 text-[11px] font-black tracking-widest outline-none focus:border-blue-500 transition-all placeholder:text-gray-700"
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
            {loading ? <Loader2 size={20} className="animate-spin" /> : <>INICIAR SESIÓN <ChevronRight size={18} /></>}
          </button>
        </form>

        <div className="mt-12 text-center">
          <p className="text-[9px] text-gray-600 font-bold uppercase tracking-widest">
            Acceso restringido a personal de <span className="text-gray-400">Grupo Seratta</span>
          </p>
          <div className="flex items-center justify-center gap-4 mt-6 opacity-30">
            <div className="h-[1px] w-8 bg-gray-800"></div>
            <Zap size={12} className="text-gray-600" />
            <div className="h-[1px] w-8 bg-gray-800"></div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;
