import express from 'express';
import path from 'path';
import fs from 'fs';
import { createServer as createViteServer } from 'vite';
import { db, GEMINI_API_KEY } from './src/db';
import { GoogleGenAI } from '@google/genai';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import cors from 'cors';

let ai: GoogleGenAI | null = null;
if (GEMINI_API_KEY) {
  ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });
}

const app = express();
const PORT = process.env.PORT || 3000;

// Security - relaxed for dev, strict for prod
const isProduction = process.env.NODE_ENV === 'production';

if (isProduction) {
  app.use(helmet());
} else {
  app.use(helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
        styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
        fontSrc: ["'self'", "https://fonts.gstatic.com", "data:"],
        imgSrc: ["'self'", "data:", "https:"],
        connectSrc: ["'self'", "ws:", "wss:", "https:"],
        workerSrc: ["'self'", "blob:"],
      },
    },
  }));
}
app.use(cors());
app.use(express.json({ limit: '5mb' }));

// Rate limiting
const limiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 200 });
app.use('/api/', limiter);

// Logging
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.originalUrl} ${res.statusCode} ${Date.now() - start}ms`);
  });
  next();
});

// --- Health ---
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// --- Entries CRUD ---
app.get('/api/entries', (req, res) => {
  const { type, status, project, search } = req.query;
  let query = 'SELECT * FROM entries WHERE 1=1';
  const params: any[] = [];

  if (type) { query += ' AND type = ?'; params.push(type); }
  if (status) { query += ' AND status = ?'; params.push(status); }
  if (project) { query += ' AND project = ?'; params.push(project); }
  if (search) { query += ' AND (title LIKE ? OR content LIKE ?)'; params.push(`%${search}%`, `%${search}%`); }

  query += ' ORDER BY created_at DESC';
  const entries = db.prepare(query).all(...params).map((e: any) => ({
    ...e,
    tags: JSON.parse(e.tags || '[]'),
    related_ids: JSON.parse(e.related_ids || '[]')
  }));
  res.json(entries);
});

app.get('/api/entries/:id', (req, res) => {
  const entry = db.prepare('SELECT * FROM entries WHERE id = ?').get(req.params.id);
  if (!entry) return res.status(404).json({ error: 'Entry not found' });
  const e = entry as any;
  res.json({ ...e, tags: JSON.parse(e.tags || '[]'), related_ids: JSON.parse(e.related_ids || '[]') });
});

app.post('/api/entries', (req, res) => {
  const { type, title, content, tags, project, priority, related_ids } = req.body;
  if (!type || !title) return res.status(400).json({ error: 'type and title required' });

  const stmt = db.prepare(`
    INSERT INTO entries (type, title, content, tags, project, priority, related_ids)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);
  const result = stmt.run(
    type,
    title,
    content || '',
    JSON.stringify(tags || []),
    project || '',
    priority || 0,
    JSON.stringify(related_ids || [])
  );

  const entry = db.prepare('SELECT * FROM entries WHERE id = ?').get(result.lastInsertRowid);
  const e = entry as any;
  res.status(201).json({ ...e, tags: JSON.parse(e.tags), related_ids: JSON.parse(e.related_ids) });
});

app.put('/api/entries/:id', (req, res) => {
  const { title, content, tags, project, priority, status, related_ids } = req.body;
  const existing = db.prepare('SELECT * FROM entries WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Entry not found' });

  db.prepare(`
    UPDATE entries SET title = COALESCE(?, title), content = COALESCE(?, content),
    tags = COALESCE(?, tags), project = COALESCE(?, project),
    priority = COALESCE(?, priority), status = COALESCE(?, status),
    related_ids = COALESCE(?, related_ids), updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(
    title, content,
    tags ? JSON.stringify(tags) : undefined,
    project, priority, status,
    related_ids ? JSON.stringify(related_ids) : undefined,
    req.params.id
  );

  const entry = db.prepare('SELECT * FROM entries WHERE id = ?').get(req.params.id);
  const e = entry as any;
  res.json({ ...e, tags: JSON.parse(e.tags), related_ids: JSON.parse(e.related_ids) });
});

app.delete('/api/entries/:id', (req, res) => {
  const result = db.prepare('DELETE FROM entries WHERE id = ?').run(req.params.id);
  if (result.changes === 0) return res.status(404).json({ error: 'Entry not found' });
  res.json({ success: true });
});

// --- Projects ---
app.get('/api/projects', (req, res) => {
  const projects = db.prepare('SELECT DISTINCT project, COUNT(*) as count FROM entries WHERE project != "" GROUP BY project ORDER BY count DESC').all();
  res.json(projects);
});

// --- Stats ---
app.get('/api/stats', (req, res) => {
  const stats: any = {};
  stats.total = db.prepare('SELECT COUNT(*) as count FROM entries').get();
  stats.byType = db.prepare('SELECT type, COUNT(*) as count FROM entries GROUP BY type').all();
  stats.byStatus = db.prepare('SELECT status, COUNT(*) as count FROM entries GROUP BY status').all();
  stats.recent = db.prepare('SELECT COUNT(*) as count FROM entries WHERE created_at > datetime("now", "-24 hours")').get();
  res.json(stats);
});

// --- AI Knowledge Engine ---
app.post('/api/ai/connect', async (req, res) => {
  if (!ai) return res.status(503).json({ error: 'GEMINI_API_KEY not configured' });

  const { entryId } = req.body;
  const entry = db.prepare('SELECT * FROM entries WHERE id = ?').get(entryId);
  if (!entry) return res.status(404).json({ error: 'Entry not found' });

  const allEntries = db.prepare("SELECT id, type, title, content, tags, project FROM entries WHERE id != ? AND status = 'active'").all(entryId);

  try {
    const prompt = `You are a knowledge graph assistant. Analyze this new entry and find connections with existing entries.

NEW ENTRY:
- ID: ${(entry as any).id}
- Type: ${(entry as any).type}
- Title: ${(entry as any).title}
- Content: ${(entry as any).content}
- Tags: ${(entry as any).tags}
- Project: ${(entry as any).project}

EXISTING ENTRIES:
${(allEntries as any[]).map(e => `- ID: ${e.id}, Type: ${e.type}, Title: ${e.title}, Tags: ${e.tags}, Project: ${e.project}`).join('\n')}

Return a JSON object with:
1. "connections": array of entry IDs that are related to the new entry (max 5)
2. "summary": brief insight about how this connects to existing knowledge
3. "suggestions": array of 2-3 actionable suggestions based on these connections

Return ONLY valid JSON, no markdown.`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.5-flash',
      contents: prompt,
    });

    let result;
    try {
      const text = response.text?.replace(/```json\n?|\n?```/g, '').trim();
      result = JSON.parse(text || '{}');
    } catch {
      result = { connections: [], summary: 'Could not analyze connections.', suggestions: [] };
    }

    // Update related_ids if connections found
    if (result.connections?.length > 0) {
      const existing = (entry as any).related_ids ? JSON.parse((entry as any).related_ids) : [];
      const newRelated = [...new Set([...existing, ...result.connections])];
      db.prepare('UPDATE entries SET related_ids = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(
        JSON.stringify(newRelated), entryId
      );
    }

    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/ai/mindmap', async (req, res) => {
  if (!ai) return res.status(503).json({ error: 'GEMINI_API_KEY not configured' });

  const { project } = req.body;
  let entries: any[];
  if (project) {
    entries = db.prepare("SELECT id, type, title, content, tags FROM entries WHERE project = ? AND status = 'active'").all(project);
  } else {
    entries = db.prepare("SELECT id, type, title, content, tags FROM entries WHERE status = 'active' LIMIT 50").all();
  }

  if (entries.length === 0) return res.json({ nodes: [], edges: [] });

  try {
    const prompt = `Create a mindmap structure from these entries. Group related items hierarchically.

ENTRIES:
${entries.map(e => `ID: ${e.id}, Type: ${e.type}, Title: ${e.title}, Tags: ${e.tags}`).join('\n')}

Return JSON with:
- "nodes": array of {id: number (use entry ID), label: string, group: string}
- "edges": array of {from: number, to: number}

Return ONLY valid JSON.`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.5-flash',
      contents: prompt,
    });

    let result;
    try {
      const text = response.text?.replace(/```json\n?|\n?```/g, '').trim();
      result = JSON.parse(text || '{}');
    } catch {
      result = { nodes: [], edges: [] };
    }

    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/ai/summarize', async (req, res) => {
  if (!ai) return res.status(503).json({ error: 'GEMINI_API_KEY not configured' });

  const { project } = req.body;
  let entries: any[];
  if (project) {
    entries = db.prepare("SELECT type, title, content FROM entries WHERE project = ? AND status = 'active' ORDER BY created_at DESC LIMIT 30").all(project);
  } else {
    entries = db.prepare("SELECT type, title, content FROM entries WHERE status = 'active' ORDER BY created_at DESC LIMIT 30").all();
  }

  if (entries.length === 0) return res.json({ summary: 'No entries to summarize.' });

  try {
    const prompt = `Summarize this knowledge base and identify patterns, themes, and actionable insights.

ENTRIES:
${entries.map(e => `[${e.type}] ${e.title}: ${e.content}`).join('\n')}

Provide:
1. A brief summary of the main themes
2. Key patterns or connections you notice
3. 3 actionable recommendations
4. Areas that need more exploration

Format in clean markdown.`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.5-flash',
      contents: prompt,
    });

    res.json({ summary: response.text || 'No summary generated.' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// --- Pomodoro ---
app.post('/api/pomodoro', (req, res) => {
  const { entry_id, duration_minutes } = req.body;
  const result = db.prepare('INSERT INTO pomodoro_sessions (entry_id, duration_minutes) VALUES (?, ?)').run(
    entry_id || null, duration_minutes || 25
  );
  const session = db.prepare('SELECT * FROM pomodoro_sessions WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json(session);
});

app.put('/api/pomodoro/:id/complete', (req, res) => {
  db.prepare('UPDATE pomodoro_sessions SET completed = 1, finished_at = CURRENT_TIMESTAMP WHERE id = ?').run(req.params.id);
  const session = db.prepare('SELECT * FROM pomodoro_sessions WHERE id = ?').get(req.params.id);
  res.json(session);
});

app.get('/api/pomodoro/stats', (req, res) => {
  const stats: any = {};
  stats.total = db.prepare('SELECT COUNT(*) as count FROM pomodoro_sessions').get();
  stats.completed = db.prepare('SELECT COUNT(*) as count FROM pomodoro_sessions WHERE completed = 1').get();
  stats.totalMinutes = db.prepare('SELECT COALESCE(SUM(duration_minutes), 0) as total FROM pomodoro_sessions WHERE completed = 1').get();
  stats.today = db.prepare('SELECT COUNT(*) as count FROM pomodoro_sessions WHERE date(started_at) = date("now")').get();
  res.json(stats);
});

// --- Vite ---
async function startServer() {
  const distPath = path.join(process.cwd(), 'dist');
  const hasDist = fs.existsSync(distPath);
  const isProduction = process.env.NODE_ENV === 'production' && hasDist;

  if (!isProduction) {
    const vite = await createViteServer({ server: { middlewareMode: true }, appType: 'spa' });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(distPath));
    app.get('*', (req, res) => res.sendFile(path.join(distPath, 'index.html')));
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Todo-OSINT running on http://0.0.0.0:${PORT}`);
    console.log(`AI: ${GEMINI_API_KEY ? 'configured' : 'not configured (offline mode)'}`);
  });
}

startServer();
