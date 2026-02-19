
import { createClient } from '@supabase/supabase-js';

// Credenciales de fallback para el proyecto OMM (solo entorno de desarrollo/demo)
const FALLBACK_URL = 'https://kxaxjttvkaeewsjbpert.supabase.co';
const FALLBACK_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt4YXhqdHR2a2FlZXdzamJwZXJ0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjkxMTc0MjgsImV4cCI6MjA4NDY5MzQyOH0.fMINxNqrLT6f8lNPrpRZYPpm6IjTlKg6wAH7aAlfz_o';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || FALLBACK_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || FALLBACK_KEY;

if (import.meta.env.PROD && (!import.meta.env.VITE_SUPABASE_URL || !import.meta.env.VITE_SUPABASE_ANON_KEY)) {
  console.error('❌ NEXUM: VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY son obligatorias en producción. Revisa tu archivo .env');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  },
  realtime: {
    params: {
      eventsPerSecond: 10
    }
  }
});

export const testSupabaseConnection = async () => {
  try {
    const { data, error } = await supabase.from('profiles').select('count').limit(1);
    if (error) throw error;
    console.log('✅ NEXUM: Supabase connected');
    return true;
  } catch (error) {
    console.error('❌ NEXUM: Supabase connection failed:', error);
    return false;
  }
};
