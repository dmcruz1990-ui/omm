
# NEXUM V4 | Operational Core

Este repositorio contiene la suite de inteligencia para el grupo OMM, integrando visión artificial, IA generativa y control fiscal en tiempo real.

## Estructura del Proyecto
```text
.
├── App.tsx                 # Dashboard & Routing Core
├── types.ts                # Modelos de Datos Maestros
├── constants.ts            # Configuración Global
├── lib/
│   ├── supabase.ts         # Gateway de Base de Datos
│   └── ai/brain.ts         # Integración Gemini SDK
├── components/
│   ├── POSModule.tsx       # Service OS / Punto de Venta
│   ├── KitchenModule.tsx   # KDS de Cocina
│   ├── SupplyModule.tsx    # Inventario Atómico
│   ├── FinanceHub.tsx      # Intelligence Finance
│   └── Surveillance.tsx    # Vision AI & Biometría
└── vision_ai_backend.py    # Lógica YOLOv8 (Referencia)
```

## Setup
1. Clonar repositorio.
2. `npm install`
3. Configurar `.env` con `NEXT_PUBLIC_SUPABASE_URL` y `GOOGLE_API_KEY`.
4. `npm run dev`
