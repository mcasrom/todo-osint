<div align="center">

# ⚡ Todo-OSINT

**Captura ideas al vuelo. Conecta conocimiento con IA.**

[![Version](https://img.shields.io/badge/version-1.0.0-blue.svg)](https://github.com/mcasrom/todo-osint)
[![License](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)

[Instalación](#-instalación) • [HowTo](#-howto) • [Metodología](#-metodología) • [FAQ](#-faq)

</div>

---

## 💡 Concepto

Las mejores ideas aparecen cuando no las buscas: duchándote, corriendo, a las 3am. **Todo-OSINT** te permite:

1. **Capturar** en 3 segundos — sin fricción
2. **Organizar** — ideas, tareas, notas, insights con proyectos y tags
3. **Conectar** — IA encuentra relaciones automáticas entre tus entradas
4. **Visualizar** — MindMap generado por IA del conocimiento
5. **Ejecutar** — Pomodoro integrado para convertir ideas en acción

---

## 🚀 Instalación

### Local (2 minutos)

```bash
git clone https://github.com/mcasrom/todo-osint.git
cd todo-osint
npm install
cp .env.example .env
npm run dev
```

Abre `http://localhost:3000`

### Con IA (opcional)

Edita `.env` y añade tu API key de Gemini:
```
GEMINI_API_KEY=tu_key_aqui
```
Get key: https://aistudio.google.com/app/apikey

### Docker

```bash
docker compose up -d
```

### Hetzner

```bash
chmod +x deploy/hetzner-deploy.sh
./deploy/hetzner-deploy.sh tu-dominio.com tu@email.com
```

### Vercel

Push a GitHub → Import en Vercel → Deploy automático.

---

## 📋 HowTo

### Capturar una idea
1. Ve a tab "Capturar"
2. Selecciona tipo: 💡 Idea, ✅ Tarea, 📝 Nota, 🧠 Insight
3. Escribe título (obligatorio) + detalles (opcional)
4. Añade proyecto y tags si quieres
5. Click "Capturar" — listo

### Ver entradas
- Tab "Entradas" — lista completa
- Busca por texto o filtra por tipo
- Click ✓ para completar, 🗑️ para borrar

### MindMap con IA
1. Tab "MindMap"
2. Opcional: filtra por proyecto
3. Click "Generar"
4. La IA analiza tus entradas y crea estructura visual

### Pomodoro
1. Tab "Pomodoro"
2. Selecciona duración: 15, 25, 45, 60 min
3. Click "Iniciar"
4. Al completar se registra automáticamente

### Knowledge Engine
1. Tab "Knowledge"
2. Click "Analizar"
3. La IA genera resumen con patrones, conexiones y recomendaciones

---

## 🧠 Metodología

| Paso | Acción | Tiempo |
|------|--------|--------|
| **01** | Captura — aparece idea → anótala | 3 seg |
| **02** | Organiza — tipo, proyecto, tags | 10 seg |
| **03** | Conecta — IA encuentra relaciones | Auto |
| **04** | Visualiza — MindMap del conocimiento | 1 click |
| **05** | Ejecuta — Pomodoro para acción | 25 min |

---

## 💰 Monetización

| Plan | Precio | Features |
|------|--------|----------|
| **Free** | €0 | Entradas ilimitadas, Pomodoro, búsqueda |
| **Pro** | €5/mes | IA ilimitada, MindMaps, sync, export PDF |
| **Team** | €15/mes | Workspace compartido, admin, analytics |

**Viable?** Sí. Target: knowledge workers, founders, investigadores, estudiantes. 1000 users → 5% conversion → €250 MRR.

---

## ❓ FAQ

**¿Necesito API key de Gemini?**
No. La app funciona sin IA. Con Gemini se activan conexiones automáticas, mindmaps y resúmenes.

**¿Dónde se guardan los datos?**
SQLite local. Tus datos son tuyos. Export en cualquier momento.

**¿Puedo usarlo offline?**
Como PWA sí. Sync cuando vuelves online.

**¿Es viable monetizar?**
Sí. Modelo freemium probado. Target: 10K users año 1.

---

## 🛠 Stack

- React 19 + TypeScript + Vite
- Express + SQLite (better-sqlite3)
- Google Gemini AI
- Tailwind CSS
- Deploy: Vercel / Docker / Hetzner

---

## 📞 Contacto

- **Email:** threatradar-osint@viajeinteligencia.com
- **GitHub:** [@mcasrom](https://github.com/mcasrom)

---

<div align="center">

**Todo-OSINT** • Captura ideas. Conecta conocimiento. Ejecuta.

</div>
