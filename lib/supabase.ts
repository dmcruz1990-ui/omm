
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.1';

// Función para obtener variables de forma segura
const getEnv = (key: string, fallback: string) => {
  try {
    if (typeof process !== 'undefined' && process.env && process.env[key]) {
      return process.env[key];
    }
  } catch (e) {}
  return fallback;
};

const supabaseUrl = getEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://kxaxjttvkaeewsjbpert.supabase.co');
const supabaseAnonKey = getEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt4YXhqdHR2a2FlZXdzamJwZXJ0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjkxMTc0MjgsImV4cCI6MjA4NDY5MzQyOH0.fMINxNqrLT6f8lNPrpRZYPpm6IjTlKg6wAH7aAlfz_o');

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
