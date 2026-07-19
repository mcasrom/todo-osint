import path from 'path';
import fs from 'fs';
import Database from 'better-sqlite3';
import dotenv from 'dotenv';

dotenv.config();

const DATA_DIR = path.join(process.cwd(), 'data');
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

const DB_PATH = path.join(DATA_DIR, 'todo-osint.db');
const db = new Database(DB_PATH);

db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// Create tables
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    plan TEXT DEFAULT 'free' CHECK(plan IN ('free', 'pro', 'team')),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS device_fingerprints (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER REFERENCES users(id),
    fingerprint TEXT NOT NULL,
    ip_address TEXT,
    user_agent TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS entries (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER REFERENCES users(id),
    type TEXT NOT NULL CHECK(type IN ('idea', 'task', 'note', 'insight')),
    title TEXT NOT NULL,
    content TEXT DEFAULT '',
    tags TEXT DEFAULT '[]',
    project TEXT DEFAULT '',
    priority INTEGER DEFAULT 0,
    status TEXT DEFAULT 'active' CHECK(status IN ('active', 'completed', 'archived')),
    related_ids TEXT DEFAULT '[]',
    due_date TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS mindmap_nodes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER REFERENCES users(id),
    entry_id INTEGER REFERENCES entries(id),
    parent_id INTEGER,
    label TEXT NOT NULL,
    x REAL DEFAULT 0,
    y REAL DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS pomodoro_sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER REFERENCES users(id),
    entry_id INTEGER REFERENCES entries(id),
    duration_minutes INTEGER DEFAULT 25,
    completed BOOLEAN DEFAULT 0,
    started_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    finished_at DATETIME
  );

  CREATE TABLE IF NOT EXISTS ai_usage (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER REFERENCES users(id),
    endpoint TEXT NOT NULL,
    date TEXT NOT NULL DEFAULT (date('now')),
    count INTEGER DEFAULT 1
  );
`);

// Migrations for existing databases
try { db.exec(`ALTER TABLE entries ADD COLUMN due_date TEXT;`); } catch {}
try { db.exec(`ALTER TABLE entries ADD COLUMN user_id INTEGER REFERENCES users(id);`); } catch {}
try { db.exec(`ALTER TABLE pomodoro_sessions ADD COLUMN user_id INTEGER REFERENCES users(id);`); } catch {}
try { db.exec(`ALTER TABLE mindmap_nodes ADD COLUMN user_id INTEGER REFERENCES users(id);`); } catch {}
try { db.exec(`ALTER TABLE users ADD COLUMN plan TEXT DEFAULT 'free';`); } catch {}

// Indexes (after migrations)
db.exec(`
  CREATE INDEX IF NOT EXISTS idx_entries_user ON entries(user_id);
  CREATE INDEX IF NOT EXISTS idx_entries_type ON entries(type);
  CREATE INDEX IF NOT EXISTS idx_entries_status ON entries(status);
  CREATE INDEX IF NOT EXISTS idx_entries_project ON entries(project);
  CREATE INDEX IF NOT EXISTS idx_entries_created ON entries(created_at);
  CREATE INDEX IF NOT EXISTS idx_entries_due_date ON entries(due_date);
  CREATE INDEX IF NOT EXISTS idx_pomodoro_user ON pomodoro_sessions(user_id);
`);

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || '';
const JWT_SECRET = process.env.JWT_SECRET || 'todo-osint-secret-change-in-production';

export { db, GEMINI_API_KEY, JWT_SECRET };
