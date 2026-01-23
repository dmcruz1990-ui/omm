
import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { Profile } from '../types';
import type { Session, User } from 'https://esm.sh/@supabase/supabase-js@2.45.1';

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
        // Obtenemos la sesión lo más rápido posible
        const { data: { session: initialSession } } = await supabase.auth.getSession();
        
        if (mounted) {
          setSession(initialSession);
          setUser(initialSession?.user ?? null);
          
          if (initialSession?.user) {
            // Sincronización en segundo plano para no bloquear el Main
            fetchAndSyncProfile(initialSession.user);
          }
          
          // Liberamos el loading lo antes posible
          setLoading(false);
        }
      } catch (err) {
        console.error("Auth error:", err);
        if (mounted) setLoading(false);
      }
    };

    initAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, currentSession) => {
      if (!mounted) return;
      setSession(currentSession);
      setUser(currentSession?.user ?? null);
      if (currentSession?.user) fetchAndSyncProfile(currentSession.user);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const fetchAndSyncProfile = async (user: User) => {
    try {
      // Perfil virtual inmediato para no esperar a la DB
      const virtualProfile: Profile = { id: user.id, email: user.email || '', role: 'mesero' };
      setProfile(virtualProfile);

      // Upsert silencioso en background
      await supabase
        .from('profiles')
        .upsert({ id: user.id, email: user.email, role: 'mesero' }, { onConflict: 'id' });
        
    } catch (err) {
      console.warn("Background profile sync failed.");
    }
  };

  const signOut = async () => {
    await supabase.auth.signOut();
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
