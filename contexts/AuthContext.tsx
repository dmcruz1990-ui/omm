
import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase.ts';
import { Profile, UserRole, LoyaltyLevel } from '../types.ts';
import type { Session, User } from '@supabase/supabase-js';

interface AuthContextType {
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  loading: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    const initAuth = async () => {
      try {
        // Manejo robusto de la sesión inicial
        const { data: { session: initialSession }, error } = await supabase.auth.getSession();
        
        if (error) {
           console.warn("⚠️ Auth Init Warning:", error.message);
           if (error.message.includes("refresh_token")) {
             // Si el token de refresco es inválido, forzamos salida para limpiar localStorage
             await supabase.auth.signOut();
           }
        }

        if (mounted) {
          setSession(initialSession);
          setUser(initialSession?.user ?? null);
          if (initialSession?.user) await fetchAndSyncProfile(initialSession.user);
          setLoading(false);
        }
      } catch (err) {
        console.error("❌ Auth Error:", err);
        if (mounted) setLoading(false);
      }
    };
    initAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, currentSession) => {
      if (!mounted) return;
      
      // Si el evento indica un error de token, limpiamos
      if (_event === 'SIGNED_OUT') {
        setSession(null);
        setUser(null);
        setProfile(null);
      } else {
        setSession(currentSession);
        setUser(currentSession?.user ?? null);
        if (currentSession?.user) fetchAndSyncProfile(currentSession.user);
        else setProfile(null);
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const fetchAndSyncProfile = async (user: User) => {
    try {
      let assignedRole: UserRole = 'mesero';
      const email = user.email?.toLowerCase() || '';
      if (email.startsWith('admin')) assignedRole = 'admin';
      else if (email.startsWith('dev') || email.startsWith('desarrollo')) assignedRole = 'desarrollo';
      else if (email.startsWith('gerente') || email.startsWith('gerencia')) assignedRole = 'gerencia';
      else if (email.startsWith('chef') || email.startsWith('cocina')) assignedRole = 'chef';
      else if (email.startsWith('guest')) assignedRole = 'guest';
      
      const virtualProfile: Profile = { 
        id: user.id, 
        email: email, 
        role: assignedRole, 
        full_name: email.split('@')[0].toUpperCase(),
        loyalty_level: 'UMBRAL'
      };
      
      setProfile(virtualProfile);
      
      // Solo sincronizamos con Supabase si no hay errores de red
      try {
        await supabase.from('profiles').upsert({ 
          id: user.id, 
          email: email, 
          role: assignedRole, 
          full_name: virtualProfile.full_name,
          loyalty_level: 'UMBRAL'
        }, { onConflict: 'id' });
      } catch (e) {
        console.warn("Profile table sync skipped (offline or table missing)");
      }
    } catch (err) { console.warn("Profile logic error"); }
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setSession(null);
    setUser(null);
    setProfile(null);
  };

  return (
    <AuthContext.Provider value={{ session, user, profile, loading, signOut }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) throw new Error('useAuth must be used within an AuthProvider');
  return context;
};
