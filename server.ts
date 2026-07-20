import express from 'express';
import path from 'path';
import fs from 'fs';
import { createServer as createViteServer } from 'vite';
import { db, JWT_SECRET } from './src/db';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import cors from 'cors';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { generateAI, hasAnyAI } from './src/ai';

// --- Dev Pro User Setup ---
const DEV_USER_EMAIL = process.env.DEV_USER_EMAIL;
const DEV_USER_PASSWORD = process.env.DEV_USER_PASSWORD;

if (DEV_USER_EMAIL && DEV_USER_PASSWORD) {
  const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(DEV_USER_EMAIL);
  if (!existing) {
    const hash = bcrypt.hashSync(DEV_USER_PASSWORD, 10);
    db.prepare('INSERT INTO users (email, password_hash, plan) VALUES (?, ?, ?)').run(
      DEV_USER_EMAIL, hash, 'pro'
    );
    console.log(`[DEV] Pro user created: ${DEV_USER_EMAIL}`);
  }
}

const app = express();
const PORT = parseInt(process.env.PORT || '3000', 10);
app.set('trust proxy', 'loopback');

const isProduction = process.env.NODE_ENV === 'production';

if (isProduction) {
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

const limiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 200 });
app.use('/api/', limiter);

const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 10, message: { error: 'Too many auth attempts. Try again later.' } });
app.use('/api/auth/', authLimiter);

const registerLimiter = rateLimit({ windowMs: 60 * 60 * 1000, max: 5, message: { error: 'Too many registrations from this IP.' } });
app.use('/api/auth/register', registerLimiter);

app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.originalUrl} ${res.statusCode} ${Date.now() - start}ms`);
  });
  next();
});

// --- Guest user setup ---
const GUEST_EMAIL = 'guest@todo-osint.local';
let GUEST_ID = 1;
const existingGuest = db.prepare('SELECT id FROM users WHERE email = ?').get(GUEST_EMAIL) as any;
if (existingGuest) {
  GUEST_ID = existingGuest.id;
} else {
  const r = db.prepare('INSERT INTO users (email, password_hash, plan) VALUES (?, ?, ?)').run(GUEST_EMAIL, 'guest', 'free');
  GUEST_ID = Number(r.lastInsertRowid);
}

// --- Auth Middleware (supports guest mode) ---
const authMiddleware = (req: express.Request, res: express.Response, next: express.NextFunction) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) {
    (req as any).userId = GUEST_ID;
    (req as any).userEmail = GUEST_EMAIL;
    (req as any).userPlan = 'free';
    (req as any).isGuest = true;
    return next();
  }
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as { userId: number; email: string };
    const user = db.prepare('SELECT id, email, plan FROM users WHERE id = ?').get(decoded.userId) as any;
    if (!user) return res.status(401).json({ error: 'User not found' });
    (req as any).userId = user.id;
    (req as any).userEmail = user.email;
    (req as any).userPlan = user.plan;
    (req as any).isGuest = user.id === GUEST_ID;
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid token' });
  }
};

const aiMiddleware = (limits: { connect?: number; mindmap?: number; summarize?: number; tags?: number }) => {
  return (req: express.Request, res: express.Response, next: express.NextFunction) => {
    authMiddleware(req, res, () => {
      if ((req as any).userPlan === 'pro') {
        (req as any).aiModel = 'gemini-2.5-flash';
        return next();
      }

      const endpoint = req.path.split('/').pop() || '';
      const limit = (limits as any)[endpoint] ?? 3;
      const today = new Date().toISOString().slice(0, 10);
      const usage = db.prepare('SELECT COALESCE(SUM(count), 0) as total FROM ai_usage WHERE user_id = ? AND endpoint = ? AND date = ?').get((req as any).userId, endpoint, today) as any;

      if (usage.total >= limit) {
        return res.status(429).json({ error: `Daily AI limit reached (${limit}/${limit}). Upgrade to Pro for unlimited.`, upgrade: true, remaining: 0, limit });
      }

      db.prepare('INSERT INTO ai_usage (user_id, endpoint) VALUES (?, ?) ON CONFLICT DO NOTHING').run((req as any).userId, endpoint);
      (req as any).aiModel = 'gemini-2.5-flash';
      next();
    });
  };
};

// --- Auth Endpoints ---
app.post('/api/auth/register', async (req, res) => {
  const { email, password, deviceFingerprint } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'email and password required' });
  if (password.length < 6) return res.status(400).json({ error: 'password must be at least 6 characters' });

  const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
  if (existing) return res.status(409).json({ error: 'email already registered' });

  if (deviceFingerprint) {
    const deviceCount = db.prepare('SELECT COUNT(*) as count FROM device_fingerprints WHERE fingerprint = ?').get(deviceFingerprint) as any;
    if (deviceCount.count >= 3) return res.status(429).json({ error: 'Too many accounts from this device.' });
  }

  const hash = bcrypt.hashSync(password, 10);
  const result = db.prepare('INSERT INTO users (email, password_hash) VALUES (?, ?)').run(email, hash);

  if (deviceFingerprint) {
    db.prepare('INSERT INTO device_fingerprints (user_id, fingerprint, ip_address, user_agent) VALUES (?, ?, ?, ?)').run(
      result.lastInsertRowid, deviceFingerprint, req.ip, req.headers['user-agent']
    );
  }

  const token = jwt.sign({ userId: result.lastInsertRowid, email }, JWT_SECRET, { expiresIn: '30d' });
  res.status(201).json({ token, email, userId: result.lastInsertRowid });
});

app.post('/api/auth/login', (req, res) => {
  const { email, password, deviceFingerprint } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'email and password required' });

  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email) as any;
  if (!user) return res.status(401).json({ error: 'invalid credentials' });
  if (!bcrypt.compareSync(password, user.password_hash)) return res.status(401).json({ error: 'invalid credentials' });

  if (deviceFingerprint) {
    const existing = db.prepare('SELECT id FROM device_fingerprints WHERE user_id = ? AND fingerprint = ?').get(user.id, deviceFingerprint);
    if (!existing) {
      db.prepare('INSERT INTO device_fingerprints (user_id, fingerprint, ip_address, user_agent) VALUES (?, ?, ?, ?)').run(
        user.id, deviceFingerprint, req.ip, req.headers['user-agent']
      );
    }
  }

  const token = jwt.sign({ userId: user.id, email: user.email }, JWT_SECRET, { expiresIn: '30d' });
  res.json({ token, email: user.email, userId: user.id });
});

app.get('/api/auth/me', authMiddleware, (req, res) => {
  res.json({ email: (req as any).userEmail, userId: (req as any).userId, plan: (req as any).userPlan });
});

app.get('/api/user/plan', authMiddleware, (req, res) => {
  res.json({ plan: (req as any).userPlan });
});

app.get('/api/ai/usage', authMiddleware, (req, res) => {
  const userId = (req as any).userId;
  const plan = (req as any).userPlan;
  const today = new Date().toISOString().slice(0, 10);
  const usage = db.prepare("SELECT endpoint, SUM(count) as total FROM ai_usage WHERE user_id = ? AND date = ? GROUP BY endpoint").all(userId, today);
  res.json({ plan, today, usage: plan === 'pro' ? 'unlimited' : usage });
});

// --- Health ---
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// --- Entries CRUD (user-scoped) ---
app.get('/api/entries', authMiddleware, (req, res) => {
  const userId = (req as any).userId;
  const { type, status, project, search } = req.query;
  let query = 'SELECT * FROM entries WHERE user_id = ?';
  const params: any[] = [userId];

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

app.get('/api/entries/:id', authMiddleware, (req, res) => {
  const entry = db.prepare('SELECT * FROM entries WHERE id = ? AND user_id = ?').get(req.params.id, (req as any).userId);
  if (!entry) return res.status(404).json({ error: 'Entry not found' });
  const e = entry as any;
  res.json({ ...e, tags: JSON.parse(e.tags || '[]'), related_ids: JSON.parse(e.related_ids || '[]') });
});

app.post('/api/entries', authMiddleware, (req, res) => {
  const userId = (req as any).userId;
  const { type, title, content, tags, project, priority, related_ids, due_date } = req.body;
  if (!type || !title) return res.status(400).json({ error: 'type and title required' });

  const stmt = db.prepare(`
    INSERT INTO entries (user_id, type, title, content, tags, project, priority, related_ids, due_date)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const result = stmt.run(
    userId, type, title, content || '',
    JSON.stringify(tags || []), project || '', priority || 0,
    JSON.stringify(related_ids || []), due_date || null
  );

  const entry = db.prepare('SELECT * FROM entries WHERE id = ?').get(result.lastInsertRowid);
  const e = entry as any;
  res.status(201).json({ ...e, tags: JSON.parse(e.tags), related_ids: JSON.parse(e.related_ids) });
});

app.put('/api/entries/:id', authMiddleware, (req, res) => {
  const userId = (req as any).userId;
  const { title, content, tags, project, priority, status, related_ids, due_date } = req.body;
  const existing = db.prepare('SELECT * FROM entries WHERE id = ? AND user_id = ?').get(req.params.id, userId);
  if (!existing) return res.status(404).json({ error: 'Entry not found' });

  db.prepare(`
    UPDATE entries SET title = COALESCE(?, title), content = COALESCE(?, content),
    tags = COALESCE(?, tags), project = COALESCE(?, project),
    priority = COALESCE(?, priority), status = COALESCE(?, status),
    related_ids = COALESCE(?, related_ids), due_date = COALESCE(?, due_date), updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(
    title, content,
    tags ? JSON.stringify(tags) : undefined,
    project, priority, status,
    related_ids ? JSON.stringify(related_ids) : undefined,
    due_date, req.params.id
  );

  const entry = db.prepare('SELECT * FROM entries WHERE id = ?').get(req.params.id);
  const e = entry as any;
  res.json({ ...e, tags: JSON.parse(e.tags), related_ids: JSON.parse(e.related_ids) });
});

app.delete('/api/entries/:id', authMiddleware, (req, res) => {
  const result = db.prepare('DELETE FROM entries WHERE id = ? AND user_id = ?').run(req.params.id, (req as any).userId);
  if (result.changes === 0) return res.status(404).json({ error: 'Entry not found' });
  res.json({ success: true });
});

// --- Entry Comments ---
app.get('/api/entries/:id/comments', authMiddleware, (req, res) => {
  const entry = db.prepare('SELECT id FROM entries WHERE id = ? AND user_id = ?').get(req.params.id, (req as any).userId);
  if (!entry) return res.status(404).json({ error: 'Entry not found' });
  const comments = db.prepare('SELECT * FROM entry_comments WHERE entry_id = ? ORDER BY created_at ASC').all(req.params.id);
  res.json(comments);
});

app.post('/api/entries/:id/comments', authMiddleware, (req, res) => {
  const { content } = req.body;
  if (!content || !content.trim()) return res.status(400).json({ error: 'content required' });
  const entry = db.prepare('SELECT id FROM entries WHERE id = ? AND user_id = ?').get(req.params.id, (req as any).userId);
  if (!entry) return res.status(404).json({ error: 'Entry not found' });
  const result = db.prepare('INSERT INTO entry_comments (entry_id, user_id, content) VALUES (?, ?, ?)').run(req.params.id, (req as any).userId, content.trim());
  const comment = db.prepare('SELECT * FROM entry_comments WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json(comment);
});

app.delete('/api/comments/:id', authMiddleware, (req, res) => {
  const result = db.prepare('DELETE FROM entry_comments WHERE id = ? AND user_id = ?').run(req.params.id, (req as any).userId);
  if (result.changes === 0) return res.status(404).json({ error: 'Comment not found' });
  res.json({ success: true });
});

// --- Projects ---
app.get('/api/projects', authMiddleware, (req, res) => {
  const projects = db.prepare('SELECT DISTINCT project, COUNT(*) as count FROM entries WHERE user_id = ? AND project != "" GROUP BY project ORDER BY count DESC').all((req as any).userId);
  res.json(projects);
});

// --- Stats ---
app.get('/api/stats', authMiddleware, (req, res) => {
  const userId = (req as any).userId;
  const stats: any = {};
  stats.total = db.prepare('SELECT COUNT(*) as count FROM entries WHERE user_id = ?').get(userId);
  stats.byType = db.prepare('SELECT type, COUNT(*) as count FROM entries WHERE user_id = ? GROUP BY type').all(userId);
  stats.byStatus = db.prepare('SELECT status, COUNT(*) as count FROM entries WHERE user_id = ? GROUP BY status').all(userId);
  stats.recent = db.prepare("SELECT COUNT(*) as count FROM entries WHERE user_id = ? AND created_at > datetime('now', '-24 hours')").get(userId);
  res.json(stats);
});

// --- Calendar entries ---
app.get('/api/calendar', authMiddleware, (req, res) => {
  const userId = (req as any).userId;
  const { year, month } = req.query;
  if (!year || !month) return res.status(400).json({ error: 'year and month required' });
  const start = `${year}-${String(month).padStart(2, '0')}-01`;
  const end = `${year}-${String(month).padStart(2, '0')}-31`;
  const entries = db.prepare(
    "SELECT id, type, title, due_date FROM entries WHERE user_id = ? AND due_date IS NOT NULL AND due_date >= ? AND due_date <= ?"
  ).all(userId, start, end).map((e: any) => ({
    ...e,
    due_date: e.due_date
  }));
  res.json(entries);
});

// --- Rule-based Knowledge Engine (no AI required) ---
app.post('/api/ai/connect', aiMiddleware({ connect: 5 }), async (req, res) => {
  const userId = (req as any).userId;
  const { entryId } = req.body;
  const entry = db.prepare('SELECT * FROM entries WHERE id = ? AND user_id = ?').get(entryId, userId) as any;
  if (!entry) return res.status(404).json({ error: 'Entry not found' });

  const allEntries = db.prepare(
    "SELECT id, type, title, content, tags, project FROM entries WHERE user_id = ? AND id != ? AND status = 'active' LIMIT 30"
  ).all(userId, entryId) as any[];

  const entryTags = JSON.parse((entry as any).tags || '[]');
  const entryWords = extractWords((entry as any).title, (entry as any).content);
  const connections: any[] = [];

  for (const e of allEntries) {
    const eTags = JSON.parse(e.tags || '[]');
    const eWords = extractWords(e.title, e.content);
    const sharedTags = entryTags.filter((t: string) => eTags.includes(t));
    const sharedWords = entryWords.filter((w: string) => eWords.includes(w)).filter(w => w.length > 3);

    if (sharedTags.length > 0 || sharedWords.length >= 2 || (entry as any).project === e.project) {
      const reasons: string[] = [];
      if ((entry as any).project && (entry as any).project === e.project) reasons.push('Same project');
      if (sharedTags.length > 0) reasons.push(`Shared tags: ${sharedTags.join(', ')}`);
      if (sharedWords.length >= 2) reasons.push(`Keyword overlap: ${sharedWords.slice(0, 3).join(', ')}`);
      if (entry.type === e.type) reasons.push(`Same type: ${entry.type}`);

      connections.push({ id: e.id, reason: reasons.join('. ') || 'Related content' });
    }
  }

  const topTags = getTopTags(allEntries, 3);
  const suggestions = generateSuggestions(allEntries, entry as any);
  const themes = extractThemes(allEntries);

  let aiInsight: string | null = null;
  if (hasAnyAI() && allEntries.length > 0) {
    try {
      const prompt = `Entry: "${((entry as any).title)}${((entry as any).content ? ' — ' + (entry as any).content : '')}"
Other entries (title only):
${allEntries.map(e => `- ${e.title}`).join('\n')}

Suggest 1-3 non-obvious connections or insights between the entry and the others. Be concise (max 80 words). If none, reply "NONE".`;
      const ai = await generateAI(prompt, {
        system: 'You are a knowledge connector. Find surprising links between ideas.',
        model: (req as any).aiModel || 'gemini-2.5-flash',
      });
      if (ai && ai.text.trim() !== 'NONE') aiInsight = ai.text.trim();
    } catch {}
  }

  if (connections.length > 0) {
    const ids = connections.map(c => c.id);
    const existing = (entry as any).related_ids ? JSON.parse((entry as any).related_ids) : [];
    const newRelated = [...new Set([...existing, ...ids])];
    db.prepare('UPDATE entries SET related_ids = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(
      JSON.stringify(newRelated), entryId
    );
  }

  res.json({
    connections: connections.slice(0, 5),
    summary: `Found ${connections.length} connections across your knowledge base. ${topTags.length > 0 ? `Top themes: ${topTags.join(', ')}.` : ''}`,
    suggestions,
    themes,
    aiInsight,
    aiProvider: hasAnyAI() ? 'ai' : 'local',
  });
});

app.post('/api/ai/mindmap', aiMiddleware({ mindmap: 3 }), async (req, res) => {
  const userId = (req as any).userId;
  const { project } = req.body;

  let entries: any[];
  if (project) {
    entries = db.prepare("SELECT id, type, title, content, tags, project FROM entries WHERE user_id = ? AND project = ? AND status = 'active'").all(userId, project);
  } else {
    entries = db.prepare("SELECT id, type, title, content, tags, project FROM entries WHERE user_id = ? AND status = 'active' LIMIT 50").all(userId);
  }

  if (entries.length === 0) return res.json({ nodes: [], edges: [], rootLabel: 'MindMap' });

  let groupEntries: [string, any[]][] = [];

  if (hasAnyAI() && entries.length > 2) {
    try {
      const data = entries.map(e => `${e.id}|${e.title}${e.project ? '|' + e.project : ''}`).join('\n');
      const prompt = `Cluster these ${entries.length} entries into 3-6 thematic groups. Reply ONLY as CSV: id|group_name per line (one per entry). Groups: ${data}`;
      const ai = await generateAI(prompt, {
        system: 'You are a clustering engine. Output only CSV id|group.',
        model: (req as any).aiModel || 'gemini-2.5-flash',
      });
      if (ai && ai.text.trim()) {
        const map = new Map<number, string>();
        ai.text.trim().split('\n').forEach(line => {
          const [id, g] = line.split('|');
          if (id && g && !isNaN(Number(id))) map.set(Number(id), g.trim());
        });
        const grouped = new Map<string, any[]>();
        for (const e of entries) {
          const g = map.get(e.id) || e.project || e.type;
          if (!grouped.has(g)) grouped.set(g, []);
          grouped.get(g)!.push(e);
        }
        groupEntries = [...grouped.entries()];
      }
    } catch {}
  }

  if (groupEntries.length === 0) {
    const groups = new Map<string, any[]>();
    for (const e of entries) {
      const groupKey = e.project || e.type;
      if (!groups.has(groupKey)) groups.set(groupKey, []);
      groups.get(groupKey)!.push(e);
    }
    groupEntries = [...groups.entries()];
  }

  const nodes: any[] = [];
  const edges: any[] = [];
  const rootLabel = project || 'Knowledge Map';
  const ROOT_ID = -1;

  nodes.push({ id: ROOT_ID, label: rootLabel, group: 'root', level: 0 });

  const groups = new Map<string, any[]>(groupEntries);

  let groupIdx = 0;
  for (const [groupName, groupEntries] of groups) {
    const groupId = -(groupIdx + 2);
    nodes.push({ id: groupId, label: groupName, group: groupName, level: 1 });
    edges.push({ from: ROOT_ID, to: groupId });

    for (const e of groupEntries) {
      nodes.push({ id: e.id, label: e.title, group: groupName, level: 2 });
      edges.push({ from: groupId, to: e.id });
    }
    groupIdx++;
  }

  // Cross-connections by shared tags
  for (let i = 0; i < entries.length; i++) {
    for (let j = i + 1; j < entries.length; j++) {
      const tagsA = JSON.parse(entries[i].tags || '[]');
      const tagsB = JSON.parse(entries[j].tags || '[]');
      const shared = tagsA.filter((t: string) => tagsB.includes(t));
      if (shared.length > 0) {
        edges.push({ from: entries[i].id, to: entries[j].id });
      }
    }
  }

  res.json({ nodes, edges, rootLabel });
});

app.post('/api/ai/summarize', aiMiddleware({ summarize: 3 }), async (req, res) => {
  const userId = (req as any).userId;
  const { project } = req.body;

  let entries: any[];
  if (project) {
    entries = db.prepare("SELECT type, title, content, tags, project, created_at FROM entries WHERE user_id = ? AND project = ? AND status = 'active' ORDER BY created_at DESC LIMIT 30").all(userId, project);
  } else {
    entries = db.prepare("SELECT type, title, content, tags, project, created_at FROM entries WHERE user_id = ? AND status = 'active' ORDER BY created_at DESC LIMIT 30").all(userId);
  }

  if (entries.length === 0) return res.json({ summary: 'No entries to analyze.' });

  const byType = new Map<string, number>();
  const tagCount = new Map<string, number>();
  const projectCount = new Map<string, number>();
  const priorityCount = new Map<number, number>();
  let withDueDate = 0;
  let withTags = 0;

  for (const e of entries) {
    byType.set(e.type, (byType.get(e.type) || 0) + 1);
    const tags = JSON.parse(e.tags || '[]');
    if (tags.length > 0) withTags++;
    if (e.due_date) withDueDate++;
    if (e.project) projectCount.set(e.project, (projectCount.get(e.project) || 0) + 1);
    for (const tag of tags) {
      tagCount.set(tag, (tagCount.get(tag) || 0) + 1);
    }
  }

  const topTags = [...tagCount.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8);
  const topProjects = [...projectCount.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);
  const typeBreakdown = [...byType.entries()].map(([type, count]) => `- **${type}**: ${count}`).join('\n');
  const tagCloud = topTags.map(([tag, count]) => `#${tag} (${count})`).join(', ');
  const projectList = topProjects.map(([name, count]) => `- **${name}**: ${count} entries`).join('\n');

  const connections = findConnections(entries);
  const suggestions = generateSuggestions(entries, null);
  const themes = extractThemes(entries);

  if (hasAnyAI()) {
    try {
      const data = entries.map(e => `- [${e.type}] ${e.title}${e.content ? ': ' + e.content.slice(0, 120) : ''}${e.project ? ' (proj: ' + e.project + ')' : ''}`).join('\n');
      const prompt = `Analyze this personal knowledge base of ${entries.length} entries:\n${data}\n\nProduce a markdown report with: 1) Key themes, 2) Hidden connections between entries, 3) 3 actionable recommendations. Be concise and insightful.`;
      const ai = await generateAI(prompt, {
        system: 'You are a personal knowledge analyst. Output clean markdown.',
        model: (req as any).aiModel || 'gemini-2.5-flash',
      });
      if (ai && ai.text.trim()) {
        return res.json({ summary: ai.text.trim(), aiProvider: ai.provider });
      }
    } catch {}
  }

  const summary = `## 📊 Knowledge Overview

**Total entries analyzed:** ${entries.length}

### By Type
${typeBreakdown}

### 🔑 Key Themes
${themes.map((t: string) => `- ${t}`).join('\n')}

### 🏷️ Tag Cloud
${tagCloud}

${topProjects.length > 0 ? `### 📁 Top Projects
${projectList}` : ''}

## 🔗 Hidden Connections
${connections.length > 0 ? connections.slice(0, 5).map((c: any) => `- "${c.from}" ↔ "${c.to}" (${c.reason})`).join('\n') : 'No obvious connections found. Try adding more tags to discover relationships.'}

## 🎯 Recommendations
${suggestions.map((s: string) => `- ${s}`).join('\n')}

## 🔍 Areas to Explore
- ${entries.length - withTags} entries without tags — consider tagging them
- ${withDueDate} entries with due dates — check upcoming deadlines
- Look for entries with high priority that lack connections`;

  res.json({ summary });
});

app.post('/api/ai/tags', aiMiddleware({ tags: 10 }), (req, res) => {
  const { title, content, type } = req.body;
  if (!title) return res.status(400).json({ error: 'title required' });

  const words = extractWords(title, content);
  const stopWords = new Set(['the', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could', 'should', 'may', 'might', 'shall', 'can', 'need', 'dare', 'ought', 'used', 'to', 'of', 'in', 'for', 'on', 'with', 'at', 'by', 'from', 'as', 'into', 'through', 'during', 'before', 'after', 'above', 'below', 'between', 'out', 'off', 'over', 'under', 'again', 'further', 'then', 'once', 'here', 'there', 'when', 'where', 'why', 'how', 'all', 'both', 'each', 'few', 'more', 'most', 'other', 'some', 'such', 'no', 'nor', 'not', 'only', 'own', 'same', 'so', 'than', 'too', 'very', 'just', 'because', 'but', 'and', 'or', 'if', 'while', 'about', 'that', 'this', 'these', 'those', 'it', 'its', 'i', 'me', 'my', 'we', 'our', 'you', 'your', 'he', 'him', 'his', 'she', 'her', 'they', 'them', 'their', 'what', 'which', 'who', 'whom']);

  const meaningful = words.filter(w => w.length > 3 && !stopWords.has(w.toLowerCase()));
  const freq = new Map<string, number>();
  for (const word of meaningful) {
    const lower = word.toLowerCase();
    freq.set(lower, (freq.get(lower) || 0) + 1);
  }

  const tags = [...freq.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([word]) => word.replace(/\s+/g, '-'));

  if (type && tags.length < 5) {
    const typeTag = type.toLowerCase().replace(/\s+/g, '-');
    if (!tags.includes(typeTag)) tags.push(typeTag);
  }

  res.json({ tags: tags.slice(0, 5) });
});

// --- Helper Functions ---
function extractWords(title: string, content: string): string[] {
  const text = `${title} ${content || ''}`;
  return text.toLowerCase().replace(/[^a-z0-9\s]/g, '').split(/\s+/).filter(Boolean);
}

function getTopTags(entries: any[], limit: number): string[] {
  const count = new Map<string, number>();
  for (const e of entries) {
    const tags = JSON.parse(e.tags || '[]');
    for (const tag of tags) {
      count.set(tag, (count.get(tag) || 0) + 1);
    }
  }
  return [...count.entries()].sort((a, b) => b[1] - a[1]).slice(0, limit).map(([tag]) => tag);
}

function generateSuggestions(entries: any[], newEntry: any | null): string[] {
  const suggestions: string[] = [];
  const withoutTags = entries.filter(e => {
    const tags = JSON.parse(e.tags || '[]');
    return tags.length === 0;
  });
  if (withoutTags.length > 3) suggestions.push(`${withoutTags.length} entries lack tags — add tags to discover connections`);

  const projects = new Set(entries.map(e => e.project).filter(Boolean));
  const singleEntryProjects = [...projects].filter(p => entries.filter(e => e.project === p).length === 1);
  if (singleEntryProjects.length > 0) suggestions.push(`Projects with only 1 entry: ${singleEntryProjects.slice(0, 3).join(', ')} — expand or merge them`);

  const highPriority = entries.filter(e => e.priority >= 3);
  if (highPriority.length > 0) suggestions.push(`${highPriority.length} high-priority entries need attention`);

  const dueEntries = entries.filter(e => e.due_date && new Date(e.due_date) <= new Date());
  if (dueEntries.length > 0) suggestions.push(`${dueEntries.length} entries are past their due date`);

  if (newEntry && !newEntry.project) suggestions.push('Consider assigning a project to organize this entry');
  if (newEntry && JSON.parse(newEntry.tags || '[]').length === 0) suggestions.push('Add tags to help connect this entry with related content');

  if (suggestions.length === 0) suggestions.push('Knowledge base looks healthy — keep capturing ideas!');
  return suggestions.slice(0, 3);
}

function extractThemes(entries: any[]): string[] {
  const projectCount = new Map<string, number>();
  const typeCount = new Map<string, number>();
  const tagCount = new Map<string, number>();

  for (const e of entries) {
    if (e.project) projectCount.set(e.project, (projectCount.get(e.project) || 0) + 1);
    typeCount.set(e.type, (typeCount.get(e.type) || 0) + 1);
    const tags = JSON.parse(e.tags || '[]');
    for (const tag of tags) tagCount.set(tag, (tagCount.get(tag) || 0) + 1);
  }

  const themes: string[] = [];
  const topProject = [...projectCount.entries()].sort((a, b) => b[1] - a[1])[0];
  if (topProject) themes.push(`${topProject[0]} is your most active project (${topProject[1]} entries)`);

  const topType = [...typeCount.entries()].sort((a, b) => b[1] - a[1])[0];
  if (topType) themes.push(`You capture mostly ${topType}s (${topType[1]} entries)`);

  const topTags = [...tagCount.entries()].sort((a, b) => b[1] - a[1]).slice(0, 2);
  if (topTags.length > 0) themes.push(`Top themes: ${topTags.map(([t]) => t).join(', ')}`);

  return themes.length > 0 ? themes : ['Growing knowledge base — keep adding entries'];
}

function findConnections(entries: any[]): any[] {
  const connections: any[] = [];
  for (let i = 0; i < entries.length; i++) {
    for (let j = i + 1; j < entries.length; j++) {
      const tagsA = JSON.parse(entries[i].tags || '[]');
      const tagsB = JSON.parse(entries[j].tags || '[]');
      const shared = tagsA.filter((t: string) => tagsB.includes(t));
      if (shared.length > 0) {
        connections.push({ from: entries[i].title, to: entries[j].title, reason: `Shared tags: ${shared.join(', ')}` });
      } else if (entries[i].project && entries[i].project === entries[j].project) {
        connections.push({ from: entries[i].title, to: entries[j].title, reason: `Same project: ${entries[i].project}` });
      }
    }
  }
  return connections.slice(0, 10);
}

// --- Export ---
app.get('/api/export/json', authMiddleware, (req, res) => {
  const userId = (req as any).userId;
  const entries = db.prepare('SELECT * FROM entries WHERE user_id = ? ORDER BY created_at DESC').all(userId).map((e: any) => ({
    ...e,
    tags: JSON.parse(e.tags || '[]'),
    related_ids: JSON.parse(e.related_ids || '[]')
  }));
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Content-Disposition', 'attachment; filename=todo-osint-export.json');
  res.json(entries);
});

app.get('/api/export/markdown', authMiddleware, (req, res) => {
  const userId = (req as any).userId;
  const entries = db.prepare('SELECT * FROM entries WHERE user_id = ? ORDER BY created_at DESC').all(userId).map((e: any) => ({
    ...e,
    tags: JSON.parse(e.tags || '[]'),
  }));

  let md = `# Todo-OSINT Export\n\nExported: ${new Date().toISOString()}\n\n---\n\n`;
  for (const e of entries) {
    md += `## ${e.title}\n\n`;
    md += `- **Type:** ${e.type}\n`;
    md += `- **Status:** ${e.status}\n`;
    md += `- **Priority:** ${e.priority}\n`;
    if (e.project) md += `- **Project:** ${e.project}\n`;
    if (e.tags.length) md += `- **Tags:** ${e.tags.join(', ')}\n`;
    if (e.due_date) md += `- **Due:** ${e.due_date}\n`;
    md += `- **Created:** ${e.created_at}\n\n`;
    if (e.content) md += `${e.content}\n\n`;
    md += `---\n\n`;
  }

  res.setHeader('Content-Type', 'text/markdown');
  res.setHeader('Content-Disposition', 'attachment; filename=todo-osint-export.md');
  res.send(md);
});

app.get('/api/export/pdf', authMiddleware, (req, res) => {
  const plan = (req as any).userPlan;
  if (plan !== 'pro' && plan !== 'team') return res.status(403).json({ error: 'PDF export requires Pro plan' });

  const userId = (req as any).userId;
  const entries = db.prepare('SELECT * FROM entries WHERE user_id = ? ORDER BY created_at DESC').all(userId) as any[];

  let html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Todo-OSINT Export</title>
<style>
body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 800px; margin: 0 auto; padding: 40px 20px; color: #1a1a1a; }
h1 { font-size: 24px; border-bottom: 2px solid #f59e0b; padding-bottom: 8px; }
h2 { font-size: 18px; margin-top: 24px; }
.meta { color: #666; font-size: 13px; margin-bottom: 16px; }
.entry { border-left: 3px solid #e5e5e5; padding: 12px 16px; margin: 16px 0; page-break-inside: avoid; }
.entry.idea { border-color: #f59e0b; }
.entry.task { border-color: #10b981; }
.entry.note { border-color: #3b82f6; }
.entry.insight { border-color: #8b5cf6; }
.type-badge { display: inline-block; padding: 2px 8px; border-radius: 4px; font-size: 11px; font-weight: 600; text-transform: uppercase; }
.type-badge.idea { background: #fef3c7; color: #92400e; }
.type-badge.task { background: #d1fae5; color: #065f46; }
.type-badge.note { background: #dbeafe; color: #1e40af; }
.type-badge.insight { background: #ede9fe; color: #5b21b6; }
.tag { display: inline-block; background: #f3f4f6; padding: 1px 6px; border-radius: 3px; font-size: 11px; margin-right: 4px; color: #374151; }
.content { margin-top: 8px; font-size: 14px; line-height: 1.6; white-space: pre-wrap; }
.priority { font-weight: bold; }
.priority.p3 { color: #dc2626; }
.priority.p2 { color: #f59e0b; }
@media print { .entry { page-break-inside: avoid; } }
</style></head><body>
<h1>Todo-OSINT Export</h1>
<p class="meta">Exported: ${new Date().toISOString().slice(0, 10)} | ${entries.length} entries</p>`;

  for (const e of entries) {
    const tags = JSON.parse(e.tags || '[]');
    html += `<div class="entry ${e.type}">
<h2>${e.title}</h2>
<p class="meta">
<span class="type-badge ${e.type}">${e.type}</span>
${e.project ? ` · <strong>${e.project}</strong>` : ''}
${e.priority > 0 ? ` · <span class="priority p${e.priority}">P${e.priority}</span>` : ''}
${e.status !== 'active' ? ` · ${e.status}` : ''}
${e.due_date ? ` · 📅 ${e.due_date}` : ''}
 · ${e.created_at?.slice(0, 10)}
</p>
${tags.length > 0 ? `<p>${tags.map((t: string) => `<span class="tag">#${t}</span>`).join('')}</p>` : ''}
${e.content ? `<p class="content">${e.content}</p>` : ''}
</div>`;
  }

  html += `</body></html>`;

  res.setHeader('Content-Type', 'text/html');
  res.setHeader('Content-Disposition', 'attachment; filename=todo-osint-export.html');
  res.send(html);
});

// --- Bulk Actions ---
app.post('/api/entries/bulk', authMiddleware, (req, res) => {
  const userId = (req as any).userId;
  const { ids, action } = req.body;
  if (!Array.isArray(ids) || ids.length === 0) return res.status(400).json({ error: 'ids array required' });
  if (!['delete', 'complete', 'activate', 'archive'].includes(action)) return res.status(400).json({ error: 'invalid action' });

  const placeholders = ids.map(() => '?').join(',');
  let result;

  if (action === 'delete') {
    result = db.prepare(`DELETE FROM entries WHERE id IN (${placeholders}) AND user_id = ?`).run(...ids, userId);
  } else {
    const status = action === 'complete' ? 'completed' : action === 'activate' ? 'active' : 'archived';
    result = db.prepare(`UPDATE entries SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id IN (${placeholders}) AND user_id = ?`).run(status, ...ids, userId);
  }

  res.json({ success: true, affected: result.changes });
});

// --- Pomodoro (user-scoped) ---
app.post('/api/pomodoro', authMiddleware, (req, res) => {
  const userId = (req as any).userId;
  const { entry_id, duration_minutes } = req.body;
  const result = db.prepare('INSERT INTO pomodoro_sessions (user_id, entry_id, duration_minutes) VALUES (?, ?, ?)').run(
    userId, entry_id || null, duration_minutes || 25
  );
  const session = db.prepare('SELECT * FROM pomodoro_sessions WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json(session);
});

app.put('/api/pomodoro/:id/complete', authMiddleware, (req, res) => {
  db.prepare('UPDATE pomodoro_sessions SET completed = 1, finished_at = CURRENT_TIMESTAMP WHERE id = ? AND user_id = ?').run(req.params.id, (req as any).userId);
  const session = db.prepare('SELECT * FROM pomodoro_sessions WHERE id = ?').get(req.params.id);
  res.json(session);
});

app.get('/api/pomodoro/stats', authMiddleware, (req, res) => {
  const userId = (req as any).userId;
  const stats: any = {};
  stats.total = db.prepare('SELECT COUNT(*) as count FROM pomodoro_sessions WHERE user_id = ?').get(userId);
  stats.completed = db.prepare('SELECT COUNT(*) as count FROM pomodoro_sessions WHERE user_id = ? AND completed = 1').get(userId);
  stats.totalMinutes = db.prepare('SELECT COALESCE(SUM(duration_minutes), 0) as total FROM pomodoro_sessions WHERE user_id = ? AND completed = 1').get(userId);
  stats.today = db.prepare("SELECT COUNT(*) as count FROM pomodoro_sessions WHERE user_id = ? AND date(started_at) = date('now')").get(userId);
  res.json(stats);
});

// --- Vite ---
async function startServer() {
  const distPath = path.join(process.cwd(), 'dist');
  const hasDist = fs.existsSync(distPath);
  const isProd = process.env.NODE_ENV === 'production' && hasDist;

  if (!isProd) {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(distPath));
    app.get('*', (req, res) => res.sendFile(path.join(distPath, 'index.html')));
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Todo-OSINT running on http://0.0.0.0:${PORT}`);
    console.log(`Knowledge engine: rule-based (no external AI)`);
  });
}

startServer();
