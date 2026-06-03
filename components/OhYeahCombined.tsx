import React, { useState, lazy, Suspense } from 'react';

// Wrapper unificado: un solo módulo OH YEAH 😎 que contiene Admin
// (gestión de la plataforma) y Restaurantes (registro externo) en tabs.
const OhYeahAdminModule = lazy(() => import('./OhYeahAdminModule.tsx'));
const OhYeahRestauranteModule = lazy(() => import('./OhYeahRestauranteModule.tsx'));

type SubTab = 'admin' | 'restaurantes';

export default function OhYeahCombined() {
  const [tab, setTab] = useState<SubTab>('admin');
  return (
    <div style={{height:'100%',display:'flex',flexDirection:'column',background:'#0a0a14',color:'#fff'}}>
      <div style={{padding:'14px 22px',borderBottom:'1px solid rgba(255,255,255,0.07)',background:'#0f0f1a',display:'flex',alignItems:'center',gap:14,flexShrink:0}}>
        <div style={{width:46,height:46,borderRadius:13,background:'linear-gradient(135deg,#FFE600,#FFD700)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:26}}>😎</div>
        <div style={{flex:1}}>
          <div style={{fontFamily:"'Syne',sans-serif",fontSize:17,fontWeight:900,letterSpacing:'-0.01em'}}>OH YEAH</div>
          <div style={{fontSize:11,color:'#a8a8b8',letterSpacing:'.08em',textTransform:'uppercase'}}>Plataforma · Admin & Registro de restaurantes</div>
        </div>
      </div>

      <div style={{display:'flex',borderBottom:'1px solid rgba(255,255,255,0.07)',background:'#0f0f1a',padding:'0 22px',flexShrink:0}}>
        {([
          { id:'admin' as const, l:'⚙️ Admin de la plataforma' },
          { id:'restaurantes' as const, l:'🏨 Registro de restaurantes' },
        ]).map(t => (
          <button key={t.id} onClick={()=>setTab(t.id)}
            style={{
              padding:'12px 18px',background:'transparent',border:'none',
              borderBottom:`2px solid ${tab===t.id?'#FFE600':'transparent'}`,
              color:tab===t.id?'#FFE600':'#a8a8b8',
              fontSize:12,fontWeight:700,cursor:'pointer',whiteSpace:'nowrap',transition:'all .15s',
            }}>
            {t.l}
          </button>
        ))}
      </div>

      <div style={{flex:1,overflow:'auto'}}>
        <Suspense fallback={<div style={{padding:40,textAlign:'center',color:'#a8a8b8'}}>Cargando…</div>}>
          {tab === 'admin' && <OhYeahAdminModule />}
          {tab === 'restaurantes' && <OhYeahRestauranteModule />}
        </Suspense>
      </div>
    </div>
  );
}
