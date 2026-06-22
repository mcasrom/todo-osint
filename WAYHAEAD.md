# Todo-OSINT — WAYHAEAD & Roadmap

> **Email:** threatradar-osint@viajeinteligencia.com  
> **Repo:** https://github.com/mcasrom/todo-osint

---

## 📋 APIs Necesarias

| API | Uso | Precio | Prioridad |
|-----|-----|--------|-----------|
| **Google Gemini** | Conexiones IA, MindMaps, resúmenes | Free (60 req/min) | 🔴 |
| **Stripe** | Pagos suscripción Pro | 2.9% + €0.25 | 🟡 |

Solo necesitas **Gemini** para que la app brille. El resto es infraestructura.

---

## 🗺️ Roadmap

### Sprint 1 — MVP Funcional (Semana 1-2)
- [x] Captura rápida de ideas/tareas/notas
- [x] SQLite persistence
- [x] Búsqueda y filtros
- [x] Pomodoro timer
- [x] CRUD completo
- [ ] Auth básica (JWT)
- [ ] PWA manifest + service worker

### Sprint 2 — IA Knowledge (Semana 3-4)
- [x] AI connect endpoint (relaciones automáticas)
- [x] AI mindmap generation
- [x] AI summarize
- [ ] Visual mindmap interactivo (canvas/SVG)
- [ ] Auto-tagging con IA
- [ ] Sugerencias de proyecto

### Sprint 3 — Monetización (Semana 5-6)
- [ ] Stripe integration
- [ ] Feature gating (free vs pro)
- [ ] Export PDF/Markdown
- [ ] Landing page pricing
- [ ] Trial 14 días

### Sprint 4 — Pro Features (Semana 7-8)
- [ ] Sync multi-device
- [ ] Mobile app (React Native o PWA avanzada)
- [ ] Voice capture (speech-to-text)
- [ ] Calendar integration
- [ ] Team workspace

### Sprint 5 — Growth (Semana 9+)
- [ ] API pública
- [ ] Integrations (Notion, Obsidian, Roam)
- [ ] Templates de proyectos
- [ ] Community features
- [ ] Analytics dashboard

---

## 💰 Proyección

| Mes | Users | Conversion | MRR |
|-----|-------|------------|-----|
| 3 | 500 | 2% | €50 |
| 6 | 2,000 | 4% | €400 |
| 12 | 10,000 | 5% | €2,500 |

---

## 🚀 Deploy Checklist

- [ ] `npm install`
- [ ] `.env` con GEMINI_API_KEY
- [ ] `npm run dev` → test local
- [ ] Push a GitHub
- [ ] Deploy Vercel o Hetzner
- [ ] Configurar dominio + SSL
- [ ] Test completo

---

*Documento vivo — actualizar cada sprint*
