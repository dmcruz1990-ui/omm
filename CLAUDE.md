# NEXUM V4 — Hospitality Intelligence OS

## Project Overview

**NEXUM V4** is a full-stack restaurant management and hospitality intelligence platform for **Grupo OMM** (operated by Grupo Seratta). It integrates AI-powered analytics, computer vision, a POS system, CRM, finance, payroll, inventory, and kitchen management into a single React SPA.

- **Language**: TypeScript / React 18
- **Build tool**: Vite (dev port `3000`)
- **Backend**: Supabase (PostgreSQL + realtime + auth)
- **AI**: Google Gemini SDK (`@google/genai`, model `gemini-3-flash-preview`)
- **Vision AI (browser)**: MediaPipe Hand Landmarker
- **Vision AI (server/reference)**: Python YOLOv8 (`vision_ai_backend.py`)
- **Mobile**: Capacitor (Android, app ID `com.seratta.nexum.manager`)
- **Styling**: Tailwind CSS (utility-first, dark theme, Inter font)

---

## Development Commands

```bash
npm install       # Install dependencies
npm run dev       # Start Vite dev server at http://localhost:3000
npm run build     # Production build → dist/
npm run preview   # Preview production build
```

There are no test scripts or linter configs configured. Avoid adding them unless explicitly requested.

---

## Environment Variables

Copy `.env.example` to `.env` and fill in values:

```
VITE_SUPABASE_URL=your_supabase_url_here
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key_here
VITE_GOOGLE_API_KEY=your_google_api_key_here
VITE_ENV=development
```

**Important**: `lib/supabase.ts` contains hardcoded fallback credentials for the OMM Supabase project. These are anon-only keys. Always prefer env variables in production. The Google API key is read via `process.env.API_KEY` inside `lib/ai/brain.ts`.

---

## Repository Structure

```
/
├── App.tsx                    # Root dashboard, navigation, module router
├── index.tsx                  # React DOM entry point
├── index.html                 # HTML shell (import map, Tailwind CDN, Google Fonts)
├── index.css                  # Minimal global CSS
├── types.ts                   # ALL shared TypeScript types and enums
├── constants.ts               # Game/ExperienceBeats constants and chart generator
├── vite.config.ts             # Vite config (port 3000, sourcemaps)
├── tsconfig.json              # TypeScript config (ES2022, bundler resolution)
├── tailwind.config.js         # Tailwind config (nexum color tokens, Inter/JetBrains fonts)
├── capacitor.config.json      # Android mobile app config
├── metadata.json              # App metadata
├── vision_ai_backend.py       # Reference Python/YOLOv8 server-side vision AI
│
├── lib/
│   ├── supabase.ts            # Supabase client singleton + connection test
│   └── ai/
│       └── brain.ts           # Google Gemini chat agent (askNexumAI)
│
├── contexts/
│   └── AuthContext.tsx        # Auth state, RBAC role assignment, mock login
│
├── hooks/
│   └── useMediaPipe.ts        # MediaPipe hand landmarker hook (lazy init)
│
└── components/                # All module components (flat directory)
    ├── Login.tsx
    ├── AIConcierge.tsx
    ├── BrandStudio.tsx
    ├── CareModule.tsx
    ├── CheckoutModal.tsx
    ├── CommandModule.tsx
    ├── DiscoverModule.tsx
    ├── EventStaffModule.tsx
    ├── EventsModule.tsx
    ├── ExecutiveCockpit.tsx
    ├── ExperienceBeatsModule.tsx
    ├── FinanceAutopilot.tsx
    ├── FinanceHub.tsx          # Finance container (Autopilot + Ledger + Cierre tabs)
    ├── FinanceModule.tsx       # Ledger sub-view
    ├── FlowModule.tsx
    ├── GameScene.tsx           # Three.js Beat Saber-style game (used in ExperienceBeats)
    ├── GenesisModule.tsx       # Onboarding wizard for new restaurants
    ├── KPIModule.tsx
    ├── KitchenModule.tsx       # Kitchen Display System (KDS)
    ├── MarketingModule.tsx
    ├── MenuGrid.tsx
    ├── MobileManagerApp.tsx    # Full-screen mobile manager view
    ├── Note.tsx                # 3D note component for GameScene
    ├── OhYeahPage.tsx          # Public client-facing view
    ├── OrderTicket.tsx
    ├── POSModule.tsx           # Service OS / Point of Sale
    ├── PayrollModule.tsx       # DIAN payroll intelligence
    ├── PersonalModule.tsx
    ├── RecipeManager.tsx
    ├── RelationshipModule.tsx  # CRM / VIP customer management
    ├── ReserveModule.tsx       # Table map and reservations
    ├── Saber.tsx               # 3D saber component for GameScene
    ├── SettingsModule.tsx      # Business DNA / AI agency config
    ├── StaffHubModule.tsx      # Staff ranking and coaching
    ├── SupplyMarketplace.tsx
    ├── SupplyModule.tsx        # AI inventory / stock management
    ├── SurveillanceModule.tsx  # MediaPipe-powered vision AI for tables
    └── WebcamPreview.tsx
```

> **Note**: There is a file named `components>FinanceHub.tsx` (with `>` in the name) in the root. This is a stale/corrupted file path artifact. Do not edit it; the canonical file is `components/FinanceHub.tsx`.

---

## Module System

The app is a single-page application using **hash-based routing** (`window.location.hash`). Module navigation is handled by the `activeModule` state in the `Dashboard` component in `App.tsx`.

All modules are **lazy-loaded** using `React.lazy()` with a `<Suspense>` boundary and a `ModuleLoader` spinner.

### Module Registry (`ModuleType` enum — `types.ts`)

| Enum Value      | Component           | Description                          |
|-----------------|---------------------|--------------------------------------|
| `GENESIS`       | `GenesisModule`     | Initial onboarding wizard            |
| `DISCOVER`      | `DiscoverModule`    | Marketing / web presence             |
| `RESERVE`       | `ReserveModule`     | Table map & reservations             |
| `RELATIONSHIP`  | `RelationshipModule`| CRM & VIP customer management        |
| `SERVICE_OS`    | `POSModule` + `SurveillanceModule` | POS, ritual tasks, vision AI |
| `KITCHEN_KDS`   | `KitchenModule`     | Kitchen Display System               |
| `FLOW`          | `FlowModule`        | Kitchen stations management          |
| `SUPPLY`        | `SupplyModule`      | AI inventory & stock control         |
| `CARE`          | `CareModule`        | Customer support CX                  |
| `STAFF_HUB`     | `StaffHubModule`    | Staff ranking & coaching             |
| `COMMAND`       | `CommandModule`     | AI strategy intelligence             |
| `FINANCE_HUB`   | `FinanceHub`        | Finance (autopilot, ledger, closing) |
| `PAYROLL`       | `PayrollModule`     | DIAN payroll intelligence            |
| `BRAND_STUDIO`  | `BrandStudio`       | CMS / design studio                  |
| `CONFIG`        | `SettingsModule`    | Business DNA & AI agency settings    |
| `MOBILE_MGR`    | `MobileManagerApp`  | Full-screen mobile manager view      |

### Module Visibility by Role

The `getVisibleModules(role)` function in `App.tsx` controls which modules each role can access:

| Role         | Access                                                                 |
|--------------|------------------------------------------------------------------------|
| `admin`      | All modules                                                            |
| `desarrollo` | All modules                                                            |
| `gerencia`   | DISCOVER, RESERVE, RELATIONSHIP, SERVICE_OS, KITCHEN_KDS, CARE, FINANCE_HUB, COMMAND, STAFF_HUB, BRAND_STUDIO, PAYROLL, SUPPLY, FLOW, MOBILE_MGR |
| `mesero`     | DISCOVER, SERVICE_OS, RESERVE, RELATIONSHIP, STAFF_HUB                |
| `cocina`     | KITCHEN_KDS, FLOW, SUPPLY, STAFF_HUB                                  |

---

## Authentication & RBAC

Defined in `contexts/AuthContext.tsx`.

- **Provider**: Supabase Auth (email + password)
- **Session persistence**: enabled via Supabase client config
- **Role assignment**: Derived from email prefix at login time:
  - `admin*` → `admin`
  - `dev*` / `desarrollo*` → `desarrollo`
  - `gerente*` / `gerencia*` → `gerencia`
  - `cocina*` / `chef*` → `cocina`
  - `mesero*` → `mesero`
  - anything else → `mesero`
- **Profile sync**: On login, a profile row is upserted to the `profiles` Supabase table.

### Mock / QA Login

The Login page exposes a **Sandbox portal** with role-bypass buttons. These call `signInMock(role)` from `AuthContext`, which injects a fake user/profile without hitting Supabase. Only intended for development/testing.

To use programmatically:
```tsx
const { signInMock } = useAuth();
signInMock('admin');  // or 'desarrollo', 'gerencia', 'mesero', 'cocina'
```

---

## Supabase Integration

Client singleton: `lib/supabase.ts`

```typescript
import { supabase } from './lib/supabase.ts';
```

### Known Tables (used in codebase)

| Table           | Usage                                              |
|-----------------|----------------------------------------------------|
| `profiles`      | User profile with role and loyalty_level           |
| `tables`        | Restaurant floor tables (status, zone, seats)      |
| `ritual_tasks`  | Service ritual steps per table                     |

### Realtime Subscriptions

`App.tsx` subscribes to `postgres_changes` on `tables` and `ritual_tasks` tables via a channel named `main-sync`. Subscriptions fire `fetchData()` on any change event.

```typescript
const channel = supabase.channel('main-sync')
  .on('postgres_changes', { event: '*', schema: 'public', table: 'tables' }, fetchData)
  .on('postgres_changes', { event: '*', schema: 'public', table: 'ritual_tasks' }, fetchData)
  .subscribe();
```

---

## AI Integration

### Gemini Chat Agent (`lib/ai/brain.ts`)

```typescript
import { askNexumAI } from './lib/ai/brain.ts';

const response = await askNexumAI(userMessage, chatHistory, eventContext);
```

- Model: `gemini-3-flash-preview`
- System persona: NEXUM Concierge for OMM (reservations + event tickets)
- Requires `process.env.API_KEY` (set via `VITE_GOOGLE_API_KEY` in `.env`)
- Returns structured confirmation strings (e.g., `CONFIRMAR_RESERVA: ...`) that components parse to trigger Supabase operations

### MediaPipe Vision AI (`hooks/useMediaPipe.ts`)

Only activated when `SERVICE_OS` module is active. Detects hand positions for table service gestures.

```typescript
const { isCameraReady, lastResultsRef, error, retry } = useMediaPipe(videoRef, enabled);
```

- Loads from CDN: `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.9/wasm`
- Tracks 2 hands, maps webcam coordinates to 3D world space
- `lastResultsRef` is passed to `SurveillanceModule` for table-level gesture detection

---

## Styling Conventions

- **Background**: `#0a0a0c` (near-black)
- **Accent**: `#2563eb` (Nexum blue)
- **Text**: white on dark, gray-500 for secondary
- **Borders**: `border-white/5` (subtle) to `border-white/10` (active)
- **Radius**: Very large rounded corners (`rounded-2xl`, `rounded-3xl`, `rounded-[2.5rem]`, `rounded-[4rem]`)
- **Typography**: All-caps, italic, `font-black`, tight letter-spacing (`tracking-widest`, `tracking-tighter`)
- **Text sizes**: Micro text is common (`text-[8px]`, `text-[9px]`, `text-[10px]`) for labels
- **Scrollbars**: Use `.custom-scrollbar` class for styled scrollbars, `.no-scrollbar` to hide
- **Animations**: `animate-in fade-in`, `animate-pulse`, `animate-spin`, `transition-all`

### Tailwind Custom Tokens

```javascript
// tailwind.config.js
colors: {
  nexum: {
    primary: '#2563eb',
    success: '#10b981',
    warning: '#f59e0b',
    danger:  '#ef4444',
    dark:    '#0f172a',
    light:   '#f8fafc',
  }
}
```

### Inline Styles vs Tailwind

Prefer Tailwind utility classes. Use inline `style={}` only for dynamic values (e.g., calculated widths, progress bars).

---

## TypeScript Conventions

- All shared types live in **`types.ts`** at the project root. Add new types here.
- Component props are typed inline as interfaces within the component file.
- Use `.tsx` extension for all React files and import them with the explicit `.tsx` extension (e.g., `import Foo from './Foo.tsx'`).
- `tsconfig.json` uses `"moduleResolution": "bundler"` and `"allowImportingTsExtensions": true`.
- Path alias `@/*` maps to the project root (`./`).
- Target is **ES2022** — modern JS features (optional chaining, nullish coalescing, etc.) are safe to use.

---

## Key Data Models (from `types.ts`)

### `Table`
```typescript
interface Table {
  id: number;
  status: 'free' | 'occupied' | 'calling' | 'reserved' | 'seated' | 'waiting_list';
  seats: number;
  zone: string;
  name?: string;
  welcome_timer_start?: string | null;
  ritual_step?: number;
}
```

### `UserRole`
```typescript
type UserRole = 'admin' | 'gerencia' | 'mesero' | 'cocina' | 'desarrollo';
```

### `CustomerProfile` / `RFMSegment`
CRM customers are segmented as: `CHAMPION | LOYAL | AT_RISK | ABOUT_TO_SLEEP | NEW | POTENTIAL`

### `SupplyItem`
Inventory items with `status: 'optimal' | 'low' | 'critical' | 'variance_alert'` and NIIF/accounting mappings.

### `OperationalSettings`
Business DNA: `FINE_DINING | BAR_NIGHTLIFE | CASUAL_DINING | CASUAL_PREMIUM | QSR_FAST_CASUAL`
AI Agency Level: `ADVISORY | CO_PILOT | AUTONOMOUS`

---

## Adding a New Module

1. **Create component**: `components/MyModule.tsx`
2. **Add enum value**: Add `MY_MODULE = 'MY_MODULE'` to `ModuleType` in `types.ts`
3. **Register lazy import** in `App.tsx`:
   ```typescript
   const MyModule = lazy(() => import('./components/MyModule.tsx'));
   ```
4. **Add to navigation** in `App.tsx` inside the module packages array (choose the appropriate package group)
5. **Add render condition** in the `<main>` section:
   ```tsx
   {activeModule === ModuleType.MY_MODULE && <MyModule />}
   ```
6. **Add to role visibility** in `getVisibleModules()` for each role that should see it

---

## Navigation Structure (Sidebar)

The sidebar groups modules into four packages rendered in `App.tsx`:

| Package             | Modules                                          |
|---------------------|--------------------------------------------------|
| PAQUETE MARKETING   | DISCOVER, RESERVE, RELATIONSHIP                  |
| PAQUETE OPERACIONES | SERVICE_OS, KITCHEN_KDS, FLOW                    |
| CONTROL & SUMINISTROS | SUPPLY, CARE, STAFF_HUB                        |
| ESTRATEGIA & ADMIN  | COMMAND, FINANCE_HUB, PAYROLL, BRAND_STUDIO, CONFIG |

Admin/gerencia roles also see two special top-level buttons: **Nexum Copilot** (opens `ExecutiveCockpit` overlay) and **MODO ANDROID** (navigates to `MOBILE_MGR`).

---

## Important Patterns

### Fetching from Supabase
```typescript
const { data, error } = await supabase
  .from('table_name')
  .select('*')
  .eq('column', value);
```
Always use the singleton from `lib/supabase.ts`. Do not create new Supabase clients.

### Admin/Dev role check
```typescript
const isAdmin = profile?.role === 'admin' || profile?.role === 'gerencia' || profile?.role === 'desarrollo';
```

### Hash-based routing
```typescript
// Navigate to client view
window.location.hash = '/oh-yeah';

// Check current route
const isOhYeah = window.location.hash.includes('/oh-yeah');
```

### Loading state pattern
Use a boolean `loading` state with a centered spinner using the `Loader2` Lucide icon with `animate-spin`.

---

## Python Vision AI Backend (`vision_ai_backend.py`)

A reference-only server-side script using:
- **YOLOv8-Pose** (ultralytics) for skeletal pose estimation
- **BoT-SORT tracking** (`model.track(persist=True)`) for per-person ID persistence
- Service-request detection: triggers when wrist Y < nose Y for ~1.2s (30 frames at 25fps)
- Sends alerts to a local REST endpoint (`http://localhost:3000/api/alerts`)

This script is **not integrated into the frontend build**. It is a Python standalone meant to run as a separate service.

---

## No-Test / No-Lint Environment

There are no test runners or linting tools configured. The `package.json` only includes `dev`, `build`, and `preview` scripts. Do not add tests or lint configs unless explicitly requested.

---

## Language Notes

- **UI text is primarily in Spanish** (Colombia context). Keep any new user-facing strings in Spanish.
- **Code comments** are in Spanish. AI assistants may use Spanish in code comments for consistency.
- **Uppercase UI labels** are intentional — the design language uses all-caps for all labels and buttons.

---

## Branch & Git Conventions

- Feature branches follow the pattern `claude/<session-id>`
- Commit messages use conventional commits style: `feat:`, `fix:`, `refactor:`, etc.
- Always push with `git push -u origin <branch-name>`
