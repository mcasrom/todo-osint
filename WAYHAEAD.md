# Todo-OSINT — WAYHAEAD & Roadmap

> **Email:** todo-osint@viajeinteligencia.com  
> **Repo:** https://github.com/mcasrom/todo-osint  
> **Estado:** v1.2.1 — AI Fallback + Bug Fixes + Sprint Wrap  
> **Fecha:** Junio 2026

---

## ✅ Sprint 0 — Completado

- [x] Captura rápida (ideas, tareas, notas, insights)
- [x] SQLite persistence
- [x] Búsqueda y filtros
- [x] Pomodoro timer con stats
- [x] CRUD completo
- [x] AI connect endpoint (relaciones automáticas)
- [x] AI mindmap generation
- [x] AI summarize
- [x] Docs: README, HOWTO, WAYHAEAD

---

## ✅ Sprint 1 — Auth + PWA + Calendario — Completado

- [x] JWT auth (registro/login con bcrypt)
- [x] User isolation (cada user ve solo sus entradas)
- [x] PWA manifest + service worker (offline cache)
- [x] Calendario mensual con vista de entradas por fecha
- [x] Due date opcional al capturar
- [x] Pomodoro persistente en header (visible entre tabs)
- [x] Filtro por estado (activas/completadas) en Entradas
- [x] HowTo limpio (sin rutas absolutas)
- [x] FAQ actualizado (PWA, auth, datos)

---

## ✅ Sprint 2 — AI Fallback + Dev Pro User — Completado

- [x] AI fallback: free users acceden con rate limits
  - Connect: 5/día (free) / unlimited (pro)
  - MindMap: 3/día (free) / unlimited (pro)
  - Summarize: 3/día (free) / unlimited (pro)
- [x] Modelos por plan: `gemini-3.5-flash` (free) → `gemini-2.5-pro` (pro)
- [x] Tabla `ai_usage` para tracking de consumo diario
- [x] Endpoint `GET /api/ai/usage` para ver remaining calls
- [x] Dev Pro User auto-creado desde `.env` (no sube a GitHub)
  - Email: `dev@todo-osint.local` | Plan: pro
- [x] `.project` file con credenciales y comandos (gitignored)
- [x] Puerto configurable por `.env` (default 3500)

---

## ✅ Sprint 3 — Zero-Friction + Real AI (Julio 2026)

- [x] **Modo invitado**: captura sin login (guest user sistema, fricción 3 seg recuperada)
- [x] **IA real cableada**: capa multi-proveedor `src/ai.ts` (Gemini 2.5 Flash principal + Groq Llama 70B fallback)
- [x] Endpoints `/api/ai/connect`, `/api/ai/summarize`, `/api/ai/mindmap` enriquecidos con IA real (fallback local si no hay keys)
- [x] Toast de conexión sugerida por IA al crear entrada (`aiInsight`)
- [x] Progress bar de AI usage en tab Knowledge (free tier)
- [x] Voice capture (Web Speech API) en tab Capturar
- [x] Drag & drop roto eliminado de Entries (evita fricción inútil)
- [x] Unificado README/WAYHAEAD a v1.3

**Proveedor elegido:** Gemini free tier (ilimitado rate-limited, sin tarjeta, 1M contexto) como principal; Groq como fallback gratuito. Maxiza valor user, diferencial (mindmaps/conexiones de calidad) y monetización (Pro = volumen + modelos mejores).

---

## 📋 Sprint 4 — UX Polish + Export (Semana 1-2)

- [x] Workspace: Outline + Kanban + Linked Notes + Graph (replaces MindMap)
- [ ] Auto-tagging con IA
- [ ] Export JSON/Markdown/PDF
- [ ] Drag & drop reordenar entradas
- [ ] Bulk actions (select multiple → delete/complete)
- [ ] Dark/light theme toggle
- [ ] Indicador visual de AI usage restante en UI

---

## 📋 Sprint 4 — Monetización (Semana 3-4)

- [ ] Stripe integration
- [ ] Landing page pricing
- [ ] Trial 14 días
- [ ] Upgrade flow in-app
- [ ] Usage limits visual (progress bar free tier)
- [ ] Email notifications (trial expiring, upgrade offer)

---

## 📋 Sprint 5 — Pro Features (Semana 5-6)

- [ ] Voice capture (speech-to-text browser)
- [ ] Calendar integration (Google Calendar sync)
- [ ] Team workspace (compartir proyectos)
- [ ] API pública (REST + API keys)
- [ ] Webhooks para integraciones
- [ ] Multi-model AI selector (Gemini / OpenAI / Claude)

---

## 📋 Sprint 6 — Growth (Semana 7+)

- [ ] Integrations (Notion, Obsidian, Google Keep)
- [ ] Templates de proyectos
- [ ] Analytics dashboard
- [ ] Community features
- [ ] Mobile app (React Native)

---

## 🚀 Deploy

### Local Dev
```bash
PORT=3500 npm run dev
# → http://localhost:3500
```

### Vercel
⚠️ **No compatible con SQLite.** Necesita migrar a PostgreSQL/Supabase.
- Frontend: deploy directo
- Backend: serverless functions
- DB: Supabase / Neon / Railway

### Hetzner / VPS
✅ **Full compatible.** Docker o deploy directo.
```bash
docker compose up -d
# o
chmod +x deploy/hetzner-deploy.sh
./deploy/hetzner-deploy.sh tu-dominio.com tu@email.com
```
- SQLite funciona perfecto
- PM2 para process management
- Nginx reverse proxy + Let's Encrypt

### Docker
✅ **Compatible.** Todo incluido en `Dockerfile` + `docker-compose.yml`.
```bash
docker compose up -d
```

---

## 💰 Proyección

| Mes | Users | Conversion | MRR |
|-----|-------|------------|-----|
| 3 | 500 | 2% | €50 |
| 6 | 2,000 | 4% | €400 |
| 12 | 10,000 | 5% | €2,500 |

---

## 🔧 Tech Debt

- [ ] Tests (Jest + React Testing Library)
- [ ] CI/CD GitHub Actions
- [ ] Error boundaries React
- [ ] Input validation Zod
- [ ] Rate limiting per user
- [ ] DB migrations formales
- [ ] JWT_SECRET rotation en producción
- [ ] Password reset flow
- [ ] Streaming AI responses (SSE)
- [ ] Caché de resultados AI (evitar llamadas duplicadas)
- [ ] Fallback offline cuando AI no responde

---

*Documento vivo — actualizar cada sprint*
