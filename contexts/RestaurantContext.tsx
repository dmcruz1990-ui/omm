import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { useAuth } from './AuthContext';

// ═══════════════════════════════════════════════════════════════
// RestaurantContext — restaurante activo del usuario.
// CADA USUARIO PERTENECE A UN SOLO RESTAURANTE (profile.restaurante_id).
// OMM y Gallo Colorado son universos separados: para operar Gallo,
// hay que loguearse con un usuario asignado a Gallo (id=23).
// Sólo el rol "desarrollo" (Dale) puede saltar entre ambos para QA.
// ═══════════════════════════════════════════════════════════════

export interface RestauranteOption {
  id: number;
  nombre: string;
  emoji: string;
  categoria: string;
}

// Restaurantes disponibles. Hardcoded por simplicidad; en el futuro lee de BD.
export const RESTAURANTES: RestauranteOption[] = [
  { id: 6,  nombre: 'OMM',            emoji: '🎌', categoria: 'Japonés-Latino' },
  { id: 23, nombre: 'Gallo Colorado', emoji: '🐓', categoria: 'Tradicional' },
];

const STORAGE_KEY = 'nexum_active_restaurant_id';

interface Ctx {
  activeId: number;
  activeRestaurant: RestauranteOption;
  canSwitch: boolean;
  setActiveId: (id: number) => void;
  options: RestauranteOption[];
}

const RestaurantContext = createContext<Ctx | undefined>(undefined);

export const RestaurantProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { profile } = useAuth();
  const role = profile?.role || 'mesero';
  // Sólo "desarrollo" puede saltar entre restaurantes (QA).
  // Admin/gerencia ahora quedan fijos al restaurante de su profile.
  const canSwitch = role === 'desarrollo';

  const defaultId = profile?.restaurante_id || 6;

  const [activeId, setActiveIdState] = useState<number>(() => {
    if (!canSwitch) return defaultId;
    try {
      const v = Number(localStorage.getItem(STORAGE_KEY));
      if (v && RESTAURANTES.some(r => r.id === v)) return v;
    } catch {}
    return defaultId;
  });

  // Cuando cambia el profile (login), sincronizar
  useEffect(() => {
    if (!canSwitch) {
      // Mesero/cocina: forzar a su restaurante asignado
      if (profile?.restaurante_id && profile.restaurante_id !== activeId) {
        setActiveIdState(profile.restaurante_id);
      }
    }
  }, [profile?.restaurante_id, canSwitch]);

  const setActiveId = (id: number) => {
    if (!canSwitch) return; // solo admin/gerencia pueden cambiar
    setActiveIdState(id);
    try { localStorage.setItem(STORAGE_KEY, String(id)); } catch {}
  };

  const activeRestaurant = RESTAURANTES.find(r => r.id === activeId) || RESTAURANTES[0];

  return (
    <RestaurantContext.Provider value={{ activeId, activeRestaurant, canSwitch, setActiveId, options: RESTAURANTES }}>
      {children}
    </RestaurantContext.Provider>
  );
};

export const useRestaurant = (): Ctx => {
  const ctx = useContext(RestaurantContext);
  if (!ctx) throw new Error('useRestaurant must be used inside RestaurantProvider');
  return ctx;
};
