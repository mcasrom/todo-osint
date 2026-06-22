import React, { useState, useEffect, useCallback } from 'react';
import { Plus, Search, Brain, Map, Timer, BookOpen, Info, BarChart3, CheckCircle, Trash2, Tag, Folder, Zap } from 'lucide-react';
import { Entry, MindMapNode, PomodoroSession } from './types';

type TabType = 'capture' | 'entries' | 'mindmap' | 'pomodoro' | 'knowledge' | 'about';

export default function App() {
  const [activeTab, setActiveTab] = useState<TabType>('capture');
  const [entries, setEntries] = useState<Entry[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<string>('');
  const [stats, setStats] = useState<any>(null);
  const [pomodoroStats, setPomodoroStats] = useState<any>(null);

  useEffect(() => {
    fetchEntries();
    fetchStats();
    fetchPomodoroStats();
  }, []);

  const fetchEntries = async () => {
    const params = new URLSearchParams();
    if (searchQuery) params.set('search', searchQuery);
    if (filterType) params.set('type', filterType);
    const res = await fetch(`/api/entries?${params}`);
    const data = await res.json();
    setEntries(data);
  };

  const fetchStats = async () => {
    const res = await fetch('/api/stats');
    setStats(await res.json());
  };

  const fetchPomodoroStats = async () => {
    const res = await fetch('/api/pomodoro/stats');
    setPomodoroStats(await res.json());
  };

  const handleAddEntry = async (entry: Partial<Entry>) => {
    const res = await fetch('/api/entries', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(entry),
    });
    if (res.ok) {
      const newEntry = await res.json();
      fetchEntries();
      fetchStats();
      // Trigger AI connection in background
      if (process.env.NODE_ENV !== 'test') {
        fetch('/api/ai/connect', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ entryId: newEntry.id }),
        }).catch(() => {});
      }
    }
  };

  const handleDeleteEntry = async (id: number) => {
    await fetch(`/api/entries/${id}`, { method: 'DELETE' });
    fetchEntries();
    fetchStats();
  };

  const handleToggleStatus = async (entry: Entry) => {
    const newStatus = entry.status === 'completed' ? 'active' : 'completed';
    await fetch(`/api/entries/${entry.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: newStatus }),
    });
    fetchEntries();
    fetchStats();
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 font-sans">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-zinc-900/90 backdrop-blur border-b border-zinc-800">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Zap size={20} className="text-amber-400" />
            <h1 className="text-lg font-bold tracking-tight">Todo-OSINT</h1>
            <span className="text-[10px] bg-zinc-800 text-zinc-400 px-1.5 py-0.5 rounded font-mono">v1.0</span>
          </div>
          <div className="flex items-center gap-1 text-xs text-zinc-400">
            {stats && (
              <>
                <span>{stats.total?.count || 0} entries</span>
                <span className="text-zinc-700">|</span>
                <span>{stats.recent?.count || 0} today</span>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Tabs */}
      <nav className="bg-zinc-900 border-b border-zinc-800 sticky top-14 z-40">
        <div className="max-w-6xl mx-auto px-4 flex gap-1 overflow-x-auto py-2">
          {([
            { id: 'capture' as TabType, icon: Plus, label: 'Capturar' },
            { id: 'entries' as TabType, icon: BookOpen, label: 'Entradas' },
            { id: 'mindmap' as TabType, icon: Map, label: 'MindMap' },
            { id: 'pomodoro' as TabType, icon: Timer, label: 'Pomodoro' },
            { id: 'knowledge' as TabType, icon: Brain, label: 'Knowledge' },
            { id: 'about' as TabType, icon: Info, label: 'About' },
          ]).map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium whitespace-nowrap transition ${
                activeTab === tab.id
                  ? 'bg-amber-500/20 text-amber-400'
                  : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800'
              }`}
            >
              <tab.icon size={14} />
              {tab.label}
            </button>
          ))}
        </div>
      </nav>

      {/* Content */}
      <main className="max-w-6xl mx-auto px-4 py-6">
        {activeTab === 'capture' && <CaptureTab onAdd={handleAddEntry} />}
        {activeTab === 'entries' && (
          <EntriesTab
            entries={entries}
            searchQuery={searchQuery}
            setSearchQuery={setSearchQuery}
            filterType={filterType}
            setFilterType={setFilterType}
            onDelete={handleDeleteEntry}
            onToggle={handleToggleStatus}
          />
        )}
        {activeTab === 'mindmap' && <MindMapTab />}
        {activeTab === 'pomodoro' && <PomodoroTab stats={pomodoroStats} onRefresh={fetchPomodoroStats} />}
        {activeTab === 'knowledge' && <KnowledgeTab />}
        {activeTab === 'about' && <AboutTab />}
      </main>
    </div>
  );
}

// --- Capture Tab ---
function CaptureTab({ onAdd }: { onAdd: (e: Partial<Entry>) => void }) {
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [type, setType] = useState<Entry['type']>('idea');
  const [project, setProject] = useState('');
  const [tags, setTags] = useState('');
  const [priority, setPriority] = useState(0);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    onAdd({
      type,
      title: title.trim(),
      content: content.trim(),
      project: project.trim(),
      tags: tags.split(',').map(t => t.trim()).filter(Boolean),
      priority,
    });
    setTitle('');
    setContent('');
    setProject('');
    setTags('');
    setPriority(0);
  };

  const types: { value: Entry['type']; label: string; color: string }[] = [
    { value: 'idea', label: '💡 Idea', color: 'bg-amber-500/20 text-amber-400 border-amber-500/40' },
    { value: 'task', label: '✅ Tarea', color: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40' },
    { value: 'note', label: '📝 Nota', color: 'bg-blue-500/20 text-blue-400 border-blue-500/40' },
    { value: 'insight', label: '🧠 Insight', color: 'bg-purple-500/20 text-purple-400 border-purple-500/40' },
  ];

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="text-center space-y-2">
        <h2 className="text-2xl font-bold">Captura al vuelo</h2>
        <p className="text-zinc-500 text-sm">Apareció una idea? Anótala antes de que se escape.</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4 bg-zinc-900 border border-zinc-800 rounded-xl p-6">
        {/* Type selector */}
        <div className="flex gap-2">
          {types.map(t => (
            <button
              key={t.value}
              type="button"
              onClick={() => setType(t.value)}
              className={`flex-1 py-2 px-3 rounded-lg text-xs font-medium border transition ${
                type === t.value ? t.color : 'bg-zinc-800 text-zinc-500 border-zinc-700'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Title */}
        <input
          type="text"
          value={title}
          onChange={e => setTitle(e.target.value)}
          placeholder="Título de la idea..."
          className="w-full bg-zinc-950 border border-zinc-700 rounded-lg px-4 py-3 text-sm focus:outline-none focus:border-amber-500/50 focus:ring-1 focus:ring-amber-500/20"
          autoFocus
        />

        {/* Content */}
        <textarea
          value={content}
          onChange={e => setContent(e.target.value)}
          placeholder="Detalles (opcional)..."
          rows={3}
          className="w-full bg-zinc-950 border border-zinc-700 rounded-lg px-4 py-3 text-sm focus:outline-none focus:border-amber-500/50 focus:ring-1 focus:ring-amber-500/20 resize-none"
        />

        {/* Project + Tags */}
        <div className="grid grid-cols-2 gap-3">
          <div className="flex items-center gap-2 bg-zinc-950 border border-zinc-700 rounded-lg px-3">
            <Folder size={14} className="text-zinc-500" />
            <input
              type="text"
              value={project}
              onChange={e => setProject(e.target.value)}
              placeholder="Proyecto"
              className="w-full bg-transparent py-2 text-sm focus:outline-none"
            />
          </div>
          <div className="flex items-center gap-2 bg-zinc-950 border border-zinc-700 rounded-lg px-3">
            <Tag size={14} className="text-zinc-500" />
            <input
              type="text"
              value={tags}
              onChange={e => setTags(e.target.value)}
              placeholder="tags, separados"
              className="w-full bg-transparent py-2 text-sm focus:outline-none"
            />
          </div>
        </div>

        {/* Priority */}
        <div className="flex items-center gap-3">
          <span className="text-xs text-zinc-500">Prioridad:</span>
          <div className="flex gap-1">
            {[0, 1, 2, 3].map(p => (
              <button
                key={p}
                type="button"
                onClick={() => setPriority(p)}
                className={`w-8 h-8 rounded text-xs font-bold transition ${
                  priority === p
                    ? p >= 3 ? 'bg-red-500/20 text-red-400' : p >= 2 ? 'bg-amber-500/20 text-amber-400' : 'bg-zinc-700 text-zinc-300'
                    : 'bg-zinc-800 text-zinc-600'
                }`}
              >
                {p}
              </button>
            ))}
          </div>
        </div>

        {/* Submit */}
        <button
          type="submit"
          disabled={!title.trim()}
          className="w-full bg-amber-500 hover:bg-amber-400 disabled:opacity-30 disabled:cursor-not-allowed text-zinc-950 font-bold py-3 rounded-lg transition text-sm"
        >
          Capturar
        </button>
      </form>
    </div>
  );
}

// --- Entries Tab ---
function EntriesTab({ entries, searchQuery, setSearchQuery, filterType, setFilterType, onDelete, onToggle }: any) {
  const typeColors: Record<string, string> = {
    idea: 'text-amber-400',
    task: 'text-emerald-400',
    note: 'text-blue-400',
    insight: 'text-purple-400',
  };

  const typeIcons: Record<string, string> = {
    idea: '💡',
    task: '✅',
    note: '📝',
    insight: '🧠',
  };

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex gap-3">
        <div className="flex-1 flex items-center gap-2 bg-zinc-900 border border-zinc-800 rounded-lg px-3">
          <Search size={14} className="text-zinc-500" />
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Buscar..."
            className="w-full bg-transparent py-2 text-sm focus:outline-none"
          />
        </div>
        <select
          value={filterType}
          onChange={e => setFilterType(e.target.value)}
          className="bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-sm focus:outline-none"
        >
          <option value="">Todos</option>
          <option value="idea">Ideas</option>
          <option value="task">Tareas</option>
          <option value="note">Notas</option>
          <option value="insight">Insights</option>
        </select>
      </div>

      {/* Entries list */}
      <div className="space-y-2">
        {entries.length === 0 ? (
          <div className="text-center py-12 text-zinc-600">
            <BookOpen size={32} className="mx-auto mb-3 opacity-50" />
            <p className="text-sm">No hay entradas aún.</p>
            <p className="text-xs mt-1">Captura tu primera idea!</p>
          </div>
        ) : (
          entries.map((entry: Entry) => (
            <div
              key={entry.id}
              className={`bg-zinc-900 border border-zinc-800 rounded-lg p-4 transition hover:border-zinc-700 ${
                entry.status === 'completed' ? 'opacity-60' : ''
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-sm">{typeIcons[entry.type]}</span>
                    <span className={`text-xs font-medium ${typeColors[entry.type]}`}>{entry.type}</span>
                    {entry.project && (
                      <span className="text-[10px] bg-zinc-800 text-zinc-400 px-1.5 py-0.5 rounded font-mono">{entry.project}</span>
                    )}
                    {entry.priority > 0 && (
                      <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                        entry.priority >= 3 ? 'bg-red-500/20 text-red-400' : 'bg-amber-500/20 text-amber-400'
                      }`}>P{entry.priority}</span>
                    )}
                  </div>
                  <h3 className={`text-sm font-semibold ${entry.status === 'completed' ? 'line-through text-zinc-500' : 'text-zinc-200'}`}>
                    {entry.title}
                  </h3>
                  {entry.content && <p className="text-xs text-zinc-500 mt-1 line-clamp-2">{entry.content}</p>}
                  {entry.tags.length > 0 && (
                    <div className="flex gap-1 mt-2 flex-wrap">
                      {entry.tags.map((tag, i) => (
                        <span key={i} className="text-[10px] bg-zinc-800 text-zinc-400 px-1.5 py-0.5 rounded">#{tag}</span>
                      ))}
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button onClick={() => onToggle(entry)} className="p-1.5 text-zinc-500 hover:text-emerald-400 transition">
                    <CheckCircle size={16} />
                  </button>
                  <button onClick={() => onDelete(entry.id)} className="p-1.5 text-zinc-500 hover:text-red-400 transition">
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
              <div className="text-[10px] text-zinc-600 mt-2 font-mono">{new Date(entry.created_at).toLocaleString()}</div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

// --- MindMap Tab ---
function MindMapTab() {
  const [project, setProject] = useState('');
  const [mindmap, setMindmap] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const generateMindmap = async () => {
    setLoading(true);
    const res = await fetch('/api/ai/mindmap', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ project: project || undefined }),
    });
    const data = await res.json();
    setMindmap(data);
    setLoading(false);
  };

  return (
    <div className="space-y-6">
      <div className="text-center space-y-2">
        <h2 className="text-2xl font-bold">MindMap</h2>
        <p className="text-zinc-500 text-sm">Visualiza conexiones entre tus ideas con IA.</p>
      </div>

      <div className="flex gap-3 max-w-md mx-auto">
        <input
          type="text"
          value={project}
          onChange={e => setProject(e.target.value)}
          placeholder="Proyecto (opcional)"
          className="flex-1 bg-zinc-900 border border-zinc-800 rounded-lg px-4 py-2 text-sm focus:outline-none focus:border-amber-500/50"
        />
        <button
          onClick={generateMindmap}
          disabled={loading}
          className="bg-amber-500 hover:bg-amber-400 disabled:opacity-30 text-zinc-950 font-bold px-4 py-2 rounded-lg text-sm transition"
        >
          {loading ? 'Generando...' : 'Generar'}
        </button>
      </div>

      {mindmap && (
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
          {mindmap.nodes?.length > 0 ? (
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-zinc-300 mb-4">Estructura generada ({mindmap.nodes.length} nodos, {mindmap.edges?.length || 0} conexiones)</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {mindmap.nodes.map((node: any, i: number) => (
                  <div key={i} className="bg-zinc-950 border border-zinc-800 rounded-lg p-3">
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-amber-400" />
                      <span className="text-sm font-medium">{node.label}</span>
                      <span className="text-[10px] text-zinc-500 ml-auto">{node.group}</span>
                    </div>
                  </div>
                ))}
              </div>
              {mindmap.edges?.length > 0 && (
                <div className="mt-4 pt-4 border-t border-zinc-800">
                  <h4 className="text-xs font-medium text-zinc-400 mb-2">Conexiones:</h4>
                  <div className="flex flex-wrap gap-2">
                    {mindmap.edges.map((edge: any, i: number) => (
                      <span key={i} className="text-[10px] bg-zinc-800 text-zinc-400 px-2 py-1 rounded font-mono">
                        {edge.from} → {edge.to}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="text-center py-8 text-zinc-600">
              <Map size={32} className="mx-auto mb-3 opacity-50" />
              <p className="text-sm">No hay datos suficientes para generar un mindmap.</p>
              <p className="text-xs mt-1">Añade más entradas o filtra por proyecto.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// --- Pomodoro Tab ---
function PomodoroTab({ stats, onRefresh }: { stats: any; onRefresh: () => void }) {
  const [timeLeft, setTimeLeft] = useState(25 * 60);
  const [isRunning, setIsRunning] = useState(false);
  const [duration, setDuration] = useState(25);

  useEffect(() => {
    if (!isRunning || timeLeft <= 0) return;
    const timer = setInterval(() => setTimeLeft(t => t - 1), 1000);
    return () => clearInterval(timer);
  }, [isRunning, timeLeft]);

  useEffect(() => {
    if (timeLeft === 0 && isRunning) {
      setIsRunning(false);
      fetch('/api/pomodoro', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ duration_minutes: duration }),
      }).then(() => onRefresh());
    }
  }, [timeLeft, isRunning, duration, onRefresh]);

  const toggleTimer = () => setIsRunning(!isRunning);
  const resetTimer = () => { setIsRunning(false); setTimeLeft(duration * 60); };

  const minutes = Math.floor(timeLeft / 60);
  const seconds = timeLeft % 60;

  return (
    <div className="max-w-md mx-auto space-y-6">
      <div className="text-center space-y-2">
        <h2 className="text-2xl font-bold">Pomodoro</h2>
        <p className="text-zinc-500 text-sm">Enfócate. 25 minutos de trabajo profundo.</p>
      </div>

      {/* Timer */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-8 text-center space-y-6">
        <div className="text-7xl font-mono font-bold tracking-wider">
          <span className={timeLeft < 60 ? 'text-red-400' : 'text-amber-400'}>
            {String(minutes).padStart(2, '0')}:{String(seconds).padStart(2, '0')}
          </span>
        </div>

        {/* Duration selector */}
        <div className="flex justify-center gap-2">
          {[15, 25, 45, 60].map(d => (
            <button
              key={d}
              onClick={() => { setDuration(d); setTimeLeft(d * 60); setIsRunning(false); }}
              className={`px-3 py-1 rounded text-xs font-medium transition ${
                duration === d ? 'bg-amber-500/20 text-amber-400' : 'bg-zinc-800 text-zinc-500'
              }`}
            >
              {d}m
            </button>
          ))}
        </div>

        <div className="flex justify-center gap-3">
          <button
            onClick={toggleTimer}
            className={`px-8 py-3 rounded-lg font-bold text-sm transition ${
              isRunning ? 'bg-zinc-700 text-zinc-300' : 'bg-amber-500 hover:bg-amber-400 text-zinc-950'
            }`}
          >
            {isRunning ? 'Pausar' : 'Iniciar'}
          </button>
          <button onClick={resetTimer} className="px-4 py-3 rounded-lg bg-zinc-800 text-zinc-400 text-sm hover:bg-zinc-700 transition">
            Reset
          </button>
        </div>
      </div>

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4 text-center">
            <div className="text-2xl font-bold text-amber-400">{stats.completed?.count || 0}</div>
            <div className="text-xs text-zinc-500 mt-1">Completados</div>
          </div>
          <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4 text-center">
            <div className="text-2xl font-bold text-emerald-400">{stats.totalMinutes?.total || 0}m</div>
            <div className="text-xs text-zinc-500 mt-1">Tiempo enfocado</div>
          </div>
          <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4 text-center">
            <div className="text-2xl font-bold text-blue-400">{stats.today?.count || 0}</div>
            <div className="text-xs text-zinc-500 mt-1">Hoy</div>
          </div>
          <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4 text-center">
            <div className="text-2xl font-bold text-purple-400">{stats.total?.count || 0}</div>
            <div className="text-xs text-zinc-500 mt-1">Total</div>
          </div>
        </div>
      )}
    </div>
  );
}

// --- Knowledge Tab ---
function KnowledgeTab() {
  const [summary, setSummary] = useState('');
  const [loading, setLoading] = useState(false);
  const [project, setProject] = useState('');

  const generateSummary = async () => {
    setLoading(true);
    const res = await fetch('/api/ai/summarize', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ project: project || undefined }),
    });
    const data = await res.json();
    setSummary(data.summary);
    setLoading(false);
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="text-center space-y-2">
        <h2 className="text-2xl font-bold">Knowledge Engine</h2>
        <p className="text-zinc-500 text-sm">La IA analiza tus entradas y genera insights conectados.</p>
      </div>

      <div className="flex gap-3">
        <input
          type="text"
          value={project}
          onChange={e => setProject(e.target.value)}
          placeholder="Proyecto (opcional)"
          className="flex-1 bg-zinc-900 border border-zinc-800 rounded-lg px-4 py-2 text-sm focus:outline-none"
        />
        <button
          onClick={generateSummary}
          disabled={loading}
          className="bg-amber-500 hover:bg-amber-400 disabled:opacity-30 text-zinc-950 font-bold px-4 py-2 rounded-lg text-sm transition"
        >
          {loading ? 'Analizando...' : 'Analizar'}
        </button>
      </div>

      {summary && (
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
          <div className="prose prose-invert prose-sm max-w-none">
            <pre className="whitespace-pre-wrap text-sm text-zinc-300 font-sans leading-relaxed">{summary}</pre>
          </div>
        </div>
      )}
    </div>
  );
}

// --- About Tab ---
function AboutTab() {
  return (
    <div className="max-w-2xl mx-auto space-y-8">
      <div className="text-center space-y-2">
        <h2 className="text-2xl font-bold">Todo-OSINT</h2>
        <p className="text-zinc-500 text-sm">Captura ideas al vuelo. Conecta conocimiento con IA.</p>
      </div>

      {/* About */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 space-y-3">
        <h3 className="text-lg font-semibold text-amber-400">Sobre el proyecto</h3>
        <p className="text-sm text-zinc-400 leading-relaxed">
          Todo-OSINT nace de una necesidad real: las mejores ideas aparecen cuando no estás buscando — duchándote, corriendo, a las 3am. 
          Esta app te permite capturarlas con mínima fricción y luego usar IA para conectarlas con tu conocimiento existente, 
          generando un sistema de inteligencia personal que crece contigo.
        </p>
      </div>

      {/* Methodology */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 space-y-4">
        <h3 className="text-lg font-semibold text-emerald-400">Metodología</h3>
        <div className="space-y-3">
          {[
            { step: '01', title: 'Captura', desc: 'Aparece una idea? 3 segundos para anotarla. Sin fricción.' },
            { step: '02', title: 'Organiza', desc: 'Tipos: idea, tarea, nota, insight. Proyectos y tags para contexto.' },
            { step: '03', title: 'Conecta', desc: 'La IA encuentra relaciones automáticas entre tus entradas.' },
            { step: '04', title: 'Visualiza', desc: 'MindMap generado por IA para ver el panorama completo.' },
            { step: '05', title: 'Ejecuta', desc: 'Pomodoro integrado para convertir ideas en acción.' },
          ].map(item => (
            <div key={item.step} className="flex gap-3">
              <span className="text-amber-400 font-mono font-bold shrink-0">{item.step}/</span>
              <div>
                <strong className="text-zinc-200 text-sm block">{item.title}</strong>
                <span className="text-xs text-zinc-500">{item.desc}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* HowTo */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 space-y-3">
        <h3 className="text-lg font-semibold text-blue-400">How To</h3>
        <div className="space-y-2 text-sm text-zinc-400">
          <p><strong className="text-zinc-200">Test local:</strong></p>
          <pre className="bg-zinc-950 p-3 rounded text-xs font-mono text-zinc-300">
{`cd /home/miguelc/todo-osint
npm install
cp .env.example .env
npm run dev`}
          </pre>
          <p className="mt-2"><strong className="text-zinc-200">Con IA:</strong> Añade GEMINI_API_KEY en .env</p>
          <p><strong className="text-zinc-200">Deploy Vercel:</strong> Push a GitHub → Import en Vercel</p>
          <p><strong className="text-zinc-200">Deploy Hetzner:</strong> Usar deploy/hetzner-deploy.sh</p>
        </div>
      </div>

      {/* FAQ */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 space-y-4">
        <h3 className="text-lg font-semibold text-purple-400">FAQ</h3>
        {[
          { q: 'Es viable monetizar?', a: 'Sí. Modelo freemium: gratis para uso personal, premium (€5-9/mes) para IA ilimitada, mindmaps avanzados, sync multi-device, y export.' },
          { q: 'Donde se guardan los datos?', a: 'SQLite local en el servidor. En Vercel se usa PostgreSQL. Tus datos son tuyos.' },
          { q: 'Necesito API key de Gemini?', a: 'No. La app funciona sin IA. Con Gemini se activan conexiones automáticas, mindmaps y resúmenes.' },
          { q: 'Puedo usarlo offline?', a: 'Como PWA sí. Los datos se sync cuando vuelves online.' },
        ].map((faq, i) => (
          <div key={i} className="space-y-1">
            <p className="text-sm font-medium text-zinc-200">{faq.q}</p>
            <p className="text-xs text-zinc-500">{faq.a}</p>
          </div>
        ))}
      </div>

      {/* Monetization */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 space-y-3">
        <h3 className="text-lg font-semibold text-amber-400">Monetización</h3>
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-zinc-950 border border-zinc-800 rounded-lg p-4">
            <div className="text-sm font-bold text-zinc-200">Free</div>
            <div className="text-xs text-zinc-500 mt-1">Entradas ilimitadas, Pomodoro, búsqueda</div>
            <div className="text-lg font-bold text-zinc-400 mt-2">€0</div>
          </div>
          <div className="bg-zinc-950 border border-amber-500/30 rounded-lg p-4">
            <div className="text-sm font-bold text-amber-400">Pro</div>
            <div className="text-xs text-zinc-500 mt-1">IA ilimitada, MindMaps, sync, export</div>
            <div className="text-lg font-bold text-amber-400 mt-2">€5/mes</div>
          </div>
        </div>
      </div>

      <div className="text-center text-xs text-zinc-600 pt-4">
        threatradar-osint@viajeinteligencia.com • github.com/mcasrom
      </div>
    </div>
  );
}
