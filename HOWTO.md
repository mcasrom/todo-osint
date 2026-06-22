# Todo-OSINT — HowTo Test en Local

## 1. Setup (2 min)

```bash
cd /home/miguelc/todo-osint
npm install
cp .env.example .env
npm run dev
```

Abre **http://localhost:3000**

## 2. Test sin IA

La app funciona sin API key. Prueba:

1. **Capturar** → Escribe título → Click Capturar
2. **Entradas** → Ver lista, buscar, filtrar, completar, borrar
3. **Pomodoro** → Selecciona 25min → Iniciar → Pausar → Reset
4. **About** → Lee FAQ, Metodología, HowTo

## 3. Test con IA

1. Consigue key: https://aistudio.google.com/app/apikey
2. Edita `.env`:
   ```
   GEMINI_API_KEY=tu_key_aqui
   ```
3. Reinicia: `Ctrl+C` → `npm run dev`
4. Prueba:
   - **Capturar** → Añade 3-4 entradas → La IA conecta automáticamente
   - **MindMap** → Click Generar → Ve estructura
   - **Knowledge** → Click Analizar → Lee insights

## 4. Test API

```bash
# Health
curl http://localhost:3000/api/health

# Stats
curl http://localhost:3000/api/stats

# Crear entrada
curl -X POST http://localhost:3000/api/entries \
  -H "Content-Type: application/json" \
  -d '{"type":"idea","title":"Test idea","content":"testing"}'

# Listar entradas
curl http://localhost:3000/api/entries

# AI connect
curl -X POST http://localhost:3000/api/ai/connect \
  -H "Content-Type: application/json" \
  -d '{"entryId":1}'

# AI mindmap
curl -X POST http://localhost:3000/api/ai/mindmap \
  -H "Content-Type: application/json" \
  -d '{}'

# Pomodoro
curl -X POST http://localhost:3000/api/pomodoro \
  -H "Content-Type: application/json" \
  -d '{"duration_minutes":25}'

# Pomodoro stats
curl http://localhost:3000/api/pomodoro/stats
```

## 5. Test Docker

```bash
docker compose up --build
# Abre http://localhost:3000
```

## 6. Es viable?

**Sí.** Razones:

- ✅ Problema real: ideas perdidas
- ✅ Solución simple: 3 segundos capturar
- ✅ Diferenciador: IA conecta conocimiento
- ✅ Monetización clara: freemium €5/mes
- ✅ Stack barato: Vercel free tier o €5 Hetzner
- ✅ Target amplio: knowledge workers, founders, devs

**Riesgos:**
- Competencia: Notion, Obsidian, Roam (pero son complejos)
- Retención: necesita hábito diario
- IA coste: Gemini free tier generoso

**Veredicto:** Viable como side project con potencial de €2-5K MRR año 1 si consigues 10K users.
