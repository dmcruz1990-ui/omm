
import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { Profile, UserRole } from '../types';
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
        const { data: { session: initialSession } } = await supabase.auth.getSession();
        
        if (mounted) {
          setSession(initialSession);
          setUser(initialSession?.user ?? null);
          
          if (initialSession?.user) {
            await fetchAndSyncProfile(initialSession.user);
          }
          
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
      else setProfile(null);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const fetchAndSyncProfile = async (user: User) => {
    try {
      // Lógica de asignación de roles por Email para el Parcial
      let assignedRole: UserRole = 'mesero'; // Rol por defecto
      const email = user.email?.toLowerCase() || '';

      if (email.startsWith('admin')) assignedRole = 'admin';
      else if (email.startsWith('dev') || email.startsWith('desarrollo')) assignedRole = 'desarrollo';
      else if (email.startsWith('gerente') || email.startsWith('gerencia')) assignedRole = 'gerencia';
      else if (email.startsWith('chef') || email.startsWith('cocina')) assignedRole = 'chef';
      else assignedRole = 'mesero';

      const virtualProfile: Profile = { 
        id: user.id, 
        email: email, 
        role: assignedRole,
        full_name: email.split('@')[0].toUpperCase()
      };
      
      setProfile(virtualProfile);

      // Sincronizar con la base de datos para persistencia real
      await supabase
        .from('profiles')
        .upsert({ 
          id: user.id, 
          email: email, 
          role: assignedRole,
          full_name: virtualProfile.full_name 
        }, { onConflict: 'id' });
        
    } catch (err) {
      console.warn("Profile sync logic used assigned role mapping.");
    }
  };

  const signOut = async () => {
    await supabase.auth.signOut();
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
