
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
    // 1. Obtener sesión inicial con manejo de errores
    supabase.auth.getSession()
      .then(({ data: { session } }) => {
        setSession(session);
        setUser(session?.user ?? null);
        if (session?.user) {
          fetchAndSyncProfile(session.user);
        } else {
          setLoading(false);
        }
      })
      .catch((err) => {
        console.error("Auth initialization error:", err);
        setLoading(false);
      });

    // 2. Escuchar cambios de autenticación
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, currentSession) => {
      setSession(currentSession);
      setUser(currentSession?.user ?? null);
      
      if (currentSession?.user) {
        await fetchAndSyncProfile(currentSession.user);
      } else {
        setProfile(null);
        setLoading(false);
      }
    });

    // Seguridad: Reducido a 2.5s para no bloquear al usuario si el servidor está lento
    const timeout = setTimeout(() => {
      setLoading(false);
    }, 2500);

    return () => {
      subscription.unsubscribe();
      clearTimeout(timeout);
    };
  }, []);

  const fetchAndSyncProfile = async (user: User) => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .upsert({ 
          id: user.id, 
          email: user.email, 
          role: 'mesero' 
        }, { onConflict: 'id' })
        .select()
        .single();

      if (error) throw error;
      setProfile(data as Profile);
    } catch (err) {
      console.warn("Profile sync issue (using virtual profile):", err);
      setProfile({ id: user.id, email: user.email || '', role: 'mesero' });
    } finally {
      setLoading(false);
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
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
