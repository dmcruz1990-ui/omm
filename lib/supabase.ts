
import { createClient } from '@supabase/supabase-js';

// Helper para obtener variables de entorno de forma segura en navegador
const getSafeEnv = (key: string, fallback: string): string => {
  try {
    // Intento con Vite/Meta
    // @ts-ignore
    if (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env[key]) {
      // @ts-ignore
      return import.meta.env[key];
    }
    // Intento con process (inyectado por shim en index.html)
    if (typeof process !== 'undefined' && process.env && process.env[key]) {
      return process.env[key];
    }
  } catch (e) {}
  return fallback;
};

const supabaseUrl = getSafeEnv('VITE_SUPABASE_URL', 'https://kxaxjttvkaeewsjbpert.supabase.co');
const supabaseAnonKey = getSafeEnv('VITE_SUPABASE_ANON_KEY', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt4YXhqdHR2a2FlZXdzamJwZXJ0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjkxMTc0MjgsImV4cCI6MjA4NDY5MzQyOH0.fMINxNqrLT6f8lNPrpRZYPpm6IjTlKg6wAH7aAlfz_o');

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
