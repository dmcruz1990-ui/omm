// OhYeahPage.tsx
// Reemplaza el componente actual en: src/components/OhYeahPage.tsx
// Carga ohyeah.html en iframe full-screen + bridge postMessage con Supabase realtime

import { useEffect, useRef, useState, useCallback } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://kxaxjttvkaeewsjbpert.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt4YXhqdHR2a2FlZXdzamJwZXJ0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjkxMTc0MjgsImV4cCI6MjA4NDY5MzQyOH0.fMINxNqrLT6f8lNPrpRZYPpm6IjTlKg6wAH7aAlfz_o'
);

interface OhYeahReserva {
  id: string;
  created_at: string;
  restaurant_id: string;
  restaurant_name: string;
  date: string;
  time: string;
  pax: number;
  guest_name: string;
  guest_email: string;
  gourmand_level: string;
  is_first_visit: boolean;
  mood: string;
  occasion: string;
  status: string;
  bono_aplicado?: string;
  nexum_brief?: Record<string, string>;
}

export default function OhYeahPage() {
  const iframeRef   = useRef<HTMLIFrameElement>(null);
  const [badge, setBadge]         = useState(0);
  const [reservas, setReservas]   = useState<OhYeahReserva[]>([]);
  const [showPanel, setShowPanel] = useState(false);
  const [restaurantes, setRestaurantes] = useState<any[]>([]);

  // ─── 1. Load active restaurants and send to iframe ───────────
  const loadRestaurantes = useCallback(async () => {
    const { data } = await supabase
      .from('ohyeah_restaurantes')
      .select('*')
      .eq('activo', true)
      .order('destacado', { ascending: false });
    if (data) {
      setRestaurantes(data);
      // Send to iframe portal
      iframeRef.current?.contentWindow?.postMessage(
        { type: 'RESTAURANTES', payload: data },
        '*'
      );
    }
  }, []);

  // ─── 2. Realtime: new reservations from Oh Yeah! ─────────────
  useEffect(() => {
    loadRestaurantes();

    const channel = supabase.channel('ohyeah-reservas-live')
      .on('postgres_changes', {
        event:  'INSERT',
        schema: 'public',
        table:  'ohyeah_reservas',
      }, (payload) => {
        const nueva = payload.new as OhYeahReserva;
        setBadge(c => c + 1);
        setReservas(prev => [nueva, ...prev]);

        // Notify iframe that a confirmation was saved
        iframeRef.current?.contentWindow?.postMessage(
          { type: 'RESERVA_GUARDADA', payload: nueva },
          '*'
        );
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [loadRestaurantes]);

  // ─── 3. Listen to messages from the iframe ───────────────────
  useEffect(() => {
    const handler = async (e: MessageEvent) => {
      if (!e.data?.type) return;

      switch (e.data.type) {

        // New reservation from portal
        case 'NUEVA_RESERVA': {
          const res = e.data.payload;
          const { data, error } = await supabase
            .from('ohyeah_reservas')
            .insert([{
              ...res,
              source: 'ohyeah',
              created_at: new Date().toISOString(),
            }])
            .select()
            .single();
          if (!error && data) {
            iframeRef.current?.contentWindow?.postMessage(
              { type: 'RESERVA_CONFIRMADA', id: data.id },
              '*'
            );
          }
          break;
        }

        // Validate and redeem a bonus code
        case 'CANJEAR_BONO': {
          const { codigo, reserva_id, guest_email } = e.data.payload;
          const { data: bono } = await supabase
            .from('bonos_regalo')
            .select('*')
            .eq('codigo', codigo.toUpperCase())
            .eq('activo', true)
            .eq('usado', false)
            .single();

          if (bono) {
            // Mark as used
            await supabase
              .from('bonos_regalo')
              .update({
                usado:     true,
                usado_at:  new Date().toISOString(),
                usado_por: guest_email || 'ohyeah_portal',
                reserva_id,
              })
              .eq('id', bono.id);

            iframeRef.current?.contentWindow?.postMessage(
              { type: 'BONO_VALIDO', bono },
              '*'
            );
          } else {
            iframeRef.current?.contentWindow?.postMessage(
              { type: 'BONO_INVALIDO', codigo },
              '*'
            );
          }
          break;
        }

        // Restaurant join request
        case 'SOLICITUD_RESTAURANTE': {
          await supabase
            .from('ohyeah_solicitudes')
            .insert([e.data.payload]);
          break;
        }

        default: break;
      }
    };

    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, []);

  // ─── 4. Load today's reservations panel ──────────────────────
  const loadTodayReservas = async () => {
    const today = new Date().toISOString().split('T')[0];
    const { data } = await supabase
      .from('ohyeah_reservas')
      .select('*')
      .eq('date', today)
      .eq('status', 'confirmed')
      .order('time', { ascending: true });
    if (data) setReservas(data);
    setBadge(0);
  };

  return (
    <div style={{ position: 'relative', width: '100%', height: '100vh', background: '#000' }}>

      {/* ── Badge + Panel toggle ── */}
      <button
        onClick={() => { setShowPanel(p => !p); if (!showPanel) loadTodayReservas(); }}
        style={{
          position: 'absolute', top: 12, right: 12, zIndex: 1000,
          background: '#FF007F', color: '#fff', border: 'none',
          borderRadius: 20, padding: '8px 16px', fontWeight: 700,
          fontSize: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8,
        }}
      >
        📋 Reservas Oh Yeah!
        {badge > 0 && (
          <span style={{
            background: '#DFFF00', color: '#000', borderRadius: '50%',
            width: 20, height: 20, display: 'flex', alignItems: 'center',
            justifyContent: 'center', fontSize: 11, fontWeight: 900,
          }}>
            {badge}
          </span>
        )}
      </button>

      {/* ── Side panel with today's reservations ── */}
      {showPanel && (
        <div style={{
          position: 'absolute', top: 0, right: 0, width: 360, height: '100vh',
          background: '#111', borderLeft: '1px solid #222', zIndex: 999,
          overflowY: 'auto', padding: 20,
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <div style={{ fontSize: 14, fontWeight: 800, color: '#DFFF00' }}>RESERVAS HOY — OH YEAH!</div>
            <button onClick={() => setShowPanel(false)} style={{ background: '#222', border: 'none', color: '#fff', borderRadius: '50%', width: 28, height: 28, cursor: 'pointer' }}>✕</button>
          </div>

          {reservas.length === 0 ? (
            <div style={{ color: '#666', fontSize: 13, textAlign: 'center', marginTop: 40 }}>Sin reservas hoy aún</div>
          ) : (
            reservas.map(r => (
              <div key={r.id} style={{
                background: '#1a1a1a', border: '1px solid #2a2a2a', borderRadius: 12,
                padding: 14, marginBottom: 10,
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                  <span style={{ fontWeight: 800, fontSize: 14 }}>{r.guest_name || 'Invitado'}</span>
                  <span style={{ color: '#DFFF00', fontWeight: 700, fontSize: 13 }}>{r.time}</span>
                </div>
                <div style={{ fontSize: 11, color: '#888', marginBottom: 4 }}>
                  {r.pax} personas · {r.restaurant_name}
                </div>
                {r.gourmand_level && (
                  <span style={{ background: '#FF007F22', color: '#FF007F', border: '1px solid #FF007F44', borderRadius: 4, padding: '2px 8px', fontSize: 10, fontWeight: 700 }}>
                    {r.gourmand_level}
                  </span>
                )}
                {r.is_first_visit && (
                  <span style={{ background: '#DFFF0022', color: '#DFFF00', border: '1px solid #DFFF0044', borderRadius: 4, padding: '2px 8px', fontSize: 10, fontWeight: 700, marginLeft: 6 }}>
                    PRIMERA VISITA
                  </span>
                )}
                {r.nexum_brief?.instruccion && (
                  <div style={{ marginTop: 8, fontSize: 11, color: '#aaa', fontStyle: 'italic' }}>
                    📋 {r.nexum_brief.instruccion}
                  </div>
                )}
                {r.bono_aplicado && (
                  <div style={{ marginTop: 6, fontSize: 11, color: '#FFD700' }}>
                    🎟 Bono: {r.bono_aplicado}
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      )}

      {/* ── Oh Yeah! iframe ── */}
      <iframe
        ref={iframeRef}
        src="/ohyeah.html"
        style={{
          width: '100%',
          height: '100%',
          border: 'none',
          display: 'block',
        }}
        title="Oh Yeah! Portal"
        onLoad={() => {
          // Send restaurantes on iframe load
          setTimeout(loadRestaurantes, 500);
        }}
      />
    </div>
  );
}
