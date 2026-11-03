## Linting

**Never edit `eslint.config.mjs` or any lint rules without the user's explicit authorization.** The lint rules
enforce the MVVM boundaries below.

---

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read
the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.

<!-- END:nextjs-agent-rules -->

## Architecture: MVVM (same style as inboxforge-ui)

```
lib/models/            Models: domain types (Member, Together, Chore, Place, WishItem…). No logic, no IO.
lib/<feature>/         Pure helpers that shape models for the UI (month grid, suggestions, maps-link parsing). Tested.
lib/backend/
├── interfaces/        The contract: ServerBackendService (data) and BrowserBackendService (auth)
├── services/stub/     In-memory stub with seed data (USE_STUB_DATABASE=true)
├── services/real/     Supabase implementations
├── server.ts          serverBackend: picks stub or real
└── browser.ts         browserBackend: picks stub or real
lib/actions/           Server actions ("use server"). The only way client code reaches serverBackend.

app/<route>/
├── page.tsx           Server Component: loads initial data through lib/actions, renders the View
├── view.tsx           Client Component (View): wires the view-model to a screen component
└── view-model.ts      Client hook (ViewModel): state + ALL IO (server actions, browserBackend, routing)

components/
├── ui/                The design system (tokens in app/globals.css, showcase at /design-system)
└── <feature>/         Screens: pure UI. Props in, callbacks out. Local UI-only state (focus, hover) is fine.
```

### Where IO happens

**Only in view-models (`app/**/view-model.ts`) and server pages (`app/**/page.tsx`).** Components never import
`lib/actions`, `lib/backend`, `lib/supabase` or `next/navigation` (lint enforces it). If a component needs to do
something, it takes a callback prop (`onToggle`, `onSubmit`) that the view-model provides.

View-models update state optimistically, call the server action, and roll back + set an error if it fails.

### Stub backend

With `USE_STUB_DATABASE=true` / `NEXT_PUBLIC_USE_STUB_DATABASE=true` (the default in `.env.example`) the app runs on
seed data in `lib/backend/services/stub/seed.ts`, kept in memory for the life of the dev server. Any 6-digit code
signs you in; `000000` fails so error states can be checked. Every stub call logs `[stub] …` to the server console.

### Design system

Tokens (colours, type, radii, shadows) live in `app/globals.css` and mirror the Figma file
(https://www.figma.com/design/PpfaPk3jkZjwmsL4JeNzYJ/Together). Components in `components/ui/` are the Figma
components. `/design-system` shows every token and component.
