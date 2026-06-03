# Sandbox Hallmark · NEXUM rediseños

Este directorio contiene **copias** de módulos NEXUM rediseñadas con el skill
[Hallmark](https://github.com/nutlope/hallmark). **NO** están conectadas al
sidebar, rutas, ni al `App.tsx`. Producción sigue intacta.

## Reglas del sandbox

- ❌ Las copias NO se importan desde producción.
- ❌ Las copias NO se registran en `App.tsx` ni en `types.ts/ModuleType`.
- ✅ Para preview: importar manualmente el archivo en un Storybook o en una
  ruta efímera fuera del flujo productivo.
- ✅ Si una copia se aprueba → se migra puerta a puerta a producción y se
  borra de aquí.
- ✅ Si no se aprueba → se borra de aquí y producción no se entera.

## Cómo ver una preview rápida sin tocar el sidebar

Edita temporalmente `App.tsx` SOLO en tu rama local (sin commit):

```tsx
import LoginCopy   from './experiments/hallmark/LoginScreen.copy';
import CrewCopy    from './experiments/hallmark/CrewAdminModule.copy';
import PuntosCopy  from './experiments/hallmark/PuntosNXModule.copy';

// y renderiza uno donde quieras temporalmente
return <LoginCopy />;
```

Cuando termines de revisar, **revierte el cambio** (`git checkout App.tsx`).

## DNA visual del rediseño

Tema escogido: **Premium dark · editorial NEXUM**

Paleta lockeada:
```
--bg-base    : #06060c           (negro azulado profundo)
--bg-card    : rgba(255,255,255,0.025)  (vidrio sutil)
--ink-1      : #ffffff           (titulares)
--ink-2      : #a8a8b8           (cuerpo)
--ink-3      : #565664           (metadata)
--rule       : rgba(255,255,255,0.07)
--accent-nx  : #b896ff           (morado NEXUM, más liviano)
--accent-warm: #ff9a6b           (cobre, contraste cálido)
--accent-cool: #5dd4ff           (cian eléctrico)
--ok         : #4dd982
--danger     : #ff5d5d
```

Tipografía lockeada:
```
--font-display : 'Syne', sans-serif       (titulares — ya en la app)
--font-body    : 'DM Sans', sans-serif    (cuerpo — ya en la app)
--font-mono    : 'IBM Plex Mono', monospace  (números, código)
```

## Archivos

| Archivo | Estado |
|---|---|
| `LoginScreen.copy.tsx`     | rediseño |
| `CrewAdminModule.copy.tsx` | rediseño |
| `PuntosNXModule.copy.tsx`  | rediseño |
